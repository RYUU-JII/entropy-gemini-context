import {
  FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_CONTRACT,
  FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_SCHEMA_VERSION,
  FEED_TOPOLOGY_CERTIFICATE_POLICY,
  FEED_TOPOLOGY_CERTIFICATE_STATES,
  buildFeedTopologyCertificateSurfaceKey,
  normalizeFeedTopologyCertificateSurface,
  requireFeedTopologyCertificate,
  requireFeedTopologyCertificateCheckpoint,
} from '../../../../platform/storage/model/FeedTopologyCertificateCheckpointContract.js';
import {
  FEED_TOPOLOGY_OBSERVATION_OUTCOMES,
  normalizeFeedTopologyObservationFact,
  resolveEffectiveFeedTopologyCertificateState,
} from './feedTopologyCertificationContracts.js';

function roundEvidence(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function requireNow(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_MODEL_TIME_INVALID');
  }
  return value;
}

function cloneCertificate(certificate) {
  if (!certificate) return null;
  return {
    ...certificate,
    surface: { ...certificate.surface },
    descriptor: { ...certificate.descriptor },
    observationDays: [...certificate.observationDays],
    recentObservationIds: [...certificate.recentObservationIds],
  };
}

function decayEvidence(certificate, now) {
  if (!certificate || certificate.effectiveEvidence <= 0) return 0;
  const elapsedMs = Math.max(0, now - certificate.decayEvaluatedAt);
  if (elapsedMs === 0) return certificate.effectiveEvidence;
  const decayFactor = 0.5 ** (
    elapsedMs / FEED_TOPOLOGY_CERTIFICATE_POLICY.evidenceHalfLifeMs
  );
  return roundEvidence(Math.max(
    0,
    certificate.effectiveEvidence * decayFactor,
  ));
}

function appendObservationDay(days, observedAt) {
  const day = Math.floor(observedAt / 86_400_000);
  const next = Array.from(new Set([...(days || []), day]))
    .sort((left, right) => left - right);
  return next.slice(-FEED_TOPOLOGY_CERTIFICATE_POLICY.observationDayRetention);
}

function appendObservationId(ids, observationId) {
  return [...(ids || []), observationId].slice(-16);
}

function compareCertificateKeys(left, right) {
  if (left.key < right.key) return -1;
  if (left.key > right.key) return 1;
  return 0;
}

function qualifiesForCertification(certificate) {
  return certificate.observationCount
      >= FEED_TOPOLOGY_CERTIFICATE_POLICY.minimumObservationCount
    && certificate.observationDays.length
      >= FEED_TOPOLOGY_CERTIFICATE_POLICY.minimumObservationDayCount
    && certificate.effectiveEvidence
      >= FEED_TOPOLOGY_CERTIFICATE_POLICY.minimumEffectiveEvidence;
}

function buildFreshLearningCertificate(fact, {
  certificateRevision,
  invalidationCount,
  lastInvalidatedAt,
}) {
  return {
    key: buildFeedTopologyCertificateSurfaceKey(fact.surface),
    surface: { ...fact.surface },
    status: FEED_TOPOLOGY_CERTIFICATE_STATES.LEARNING,
    certificateRevision,
    fingerprint: fact.fingerprint,
    descriptor: { ...fact.descriptor },
    observationCount: 1,
    effectiveEvidence: 1,
    observationDays: [Math.floor(fact.observedAt / 86_400_000)],
    recentObservationIds: [fact.observationId],
    firstObservedAt: fact.observedAt,
    lastObservedAt: fact.observedAt,
    decayEvaluatedAt: fact.observedAt,
    certifiedAt: 0,
    expiresAt: 0,
    lastInvalidatedAt,
    invalidationCount,
  };
}

function applyCorroboratedObservation(current, fact, now) {
  const currentState = resolveEffectiveFeedTopologyCertificateState(current, { now });
  const sameActiveFingerprint = current
    && current.fingerprint === fact.fingerprint
    && currentState !== FEED_TOPOLOGY_CERTIFICATE_STATES.EXPIRED
    && current.status !== FEED_TOPOLOGY_CERTIFICATE_STATES.INVALIDATED;
  let draft;
  let transition;
  if (!sameActiveFingerprint) {
    const rotatedFingerprint = !!current
      && current.fingerprint !== fact.fingerprint;
    draft = buildFreshLearningCertificate(fact, {
      certificateRevision: current ? current.certificateRevision + 1 : 0,
      invalidationCount: current
        ? current.invalidationCount + (rotatedFingerprint ? 1 : 0)
        : 0,
      lastInvalidatedAt: current
        ? (
          rotatedFingerprint
            ? fact.observedAt
            : current.lastInvalidatedAt
        )
        : 0,
    });
    transition = rotatedFingerprint
      ? 'fingerprint_rotated'
      : (current ? 'learning_restarted' : 'learning_started');
  } else {
    draft = {
      ...cloneCertificate(current),
      certificateRevision: current.certificateRevision + 1,
      observationCount: current.observationCount + 1,
      effectiveEvidence: Math.min(
        FEED_TOPOLOGY_CERTIFICATE_POLICY.maximumEffectiveEvidence,
        roundEvidence(decayEvidence(current, now) + 1),
      ),
      observationDays: appendObservationDay(
        current.observationDays,
        fact.observedAt,
      ),
      recentObservationIds: appendObservationId(
        current.recentObservationIds,
        fact.observationId,
      ),
      lastObservedAt: fact.observedAt,
      decayEvaluatedAt: now,
    };
    transition = current.status === FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED
      ? 'certificate_refreshed'
      : 'learning_advanced';
  }

  if (qualifiesForCertification(draft)) {
    const newlyCertified = draft.status !== FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED;
    draft.status = FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED;
    draft.certifiedAt = newlyCertified ? fact.observedAt : draft.certifiedAt;
    draft.expiresAt = fact.observedAt
      + FEED_TOPOLOGY_CERTIFICATE_POLICY.certificateTtlMs;
    if (newlyCertified) transition = 'certificate_issued';
  } else {
    draft.status = FEED_TOPOLOGY_CERTIFICATE_STATES.LEARNING;
    draft.certifiedAt = 0;
    draft.expiresAt = 0;
  }
  return {
    certificate: requireFeedTopologyCertificate(draft),
    transition,
    changed: true,
  };
}

function applyInvalidation(current, fact) {
  if (!current || current.fingerprint !== fact.fingerprint) {
    return {
      certificate: current ? requireFeedTopologyCertificate(current) : null,
      transition: 'stale_invalidation_ignored',
      changed: false,
    };
  }
  const invalidated = requireFeedTopologyCertificate({
    ...cloneCertificate(current),
    status: FEED_TOPOLOGY_CERTIFICATE_STATES.INVALIDATED,
    certificateRevision: current.certificateRevision + 1,
    effectiveEvidence: 0,
    decayEvaluatedAt: fact.observedAt,
    certifiedAt: 0,
    expiresAt: 0,
    lastInvalidatedAt: fact.observedAt,
    invalidationCount: current.invalidationCount + 1,
    recentObservationIds: appendObservationId(
      current.recentObservationIds,
      fact.observationId,
    ),
  });
  return {
    certificate: invalidated,
    transition: 'certificate_invalidated',
    changed: true,
  };
}

function upsertSurface(surfaces, certificate) {
  const retained = surfaces.filter((entry) => entry.key !== certificate.key);
  retained.push(certificate);
  if (retained.length > FEED_TOPOLOGY_CERTIFICATE_POLICY.surfaceLimit) {
    retained.sort((left, right) => (
      (right.lastObservedAt - left.lastObservedAt)
      || compareCertificateKeys(left, right)
    ));
    retained.length = FEED_TOPOLOGY_CERTIFICATE_POLICY.surfaceLimit;
  }
  return retained.sort(compareCertificateKeys);
}

export function restoreFeedTopologyCertificate({
  checkpoint = null,
  profileEpoch,
  surface,
  now,
} = {}) {
  const evaluatedAt = requireNow(now);
  const normalizedSurface = normalizeFeedTopologyCertificateSurface(surface);
  const normalizedCheckpoint = checkpoint === null
    ? null
    : requireFeedTopologyCertificateCheckpoint(checkpoint, {
      expectedProfileEpoch: profileEpoch,
    });
  const key = buildFeedTopologyCertificateSurfaceKey(normalizedSurface);
  const certificate = normalizedCheckpoint?.surfaces.find((entry) => entry.key === key) || null;
  return Object.freeze({
    checkpointFound: normalizedCheckpoint !== null,
    checkpointStateRevision: normalizedCheckpoint?.stateRevision ?? null,
    effectiveState: resolveEffectiveFeedTopologyCertificateState(
      certificate,
      { now: evaluatedAt },
    ),
    certificate: certificate
      ? Object.freeze(cloneCertificate(certificate))
      : null,
  });
}

export function applyFeedTopologyObservationToCheckpoint({
  checkpoint = null,
  profileEpoch,
  fact: rawFact,
  now,
} = {}) {
  const fact = normalizeFeedTopologyObservationFact(rawFact);
  const normalizedCheckpoint = checkpoint === null
    ? null
    : requireFeedTopologyCertificateCheckpoint(checkpoint, {
      expectedProfileEpoch: profileEpoch,
    });
  const updateAt = Math.max(
    requireNow(now),
    fact.observedAt,
    normalizedCheckpoint?.updatedAt || 0,
  );
  const key = buildFeedTopologyCertificateSurfaceKey(fact.surface);
  const current = normalizedCheckpoint?.surfaces.find((entry) => entry.key === key) || null;
  if (current?.recentObservationIds.includes(fact.observationId)) {
    return Object.freeze({
      changed: false,
      checkpoint: normalizedCheckpoint,
      certificate: Object.freeze(cloneCertificate(current)),
      transition: 'duplicate_observation_ignored',
      effectiveState: resolveEffectiveFeedTopologyCertificateState(
        current,
        { now: updateAt },
      ),
    });
  }
  if (current && fact.observedAt < current.lastObservedAt) {
    return Object.freeze({
      changed: false,
      checkpoint: normalizedCheckpoint,
      certificate: Object.freeze(cloneCertificate(current)),
      transition: 'stale_observation_ignored',
      effectiveState: resolveEffectiveFeedTopologyCertificateState(
        current,
        { now: updateAt },
      ),
    });
  }
  const applied = fact.outcome === FEED_TOPOLOGY_OBSERVATION_OUTCOMES.CORROBORATED
    ? applyCorroboratedObservation(current, fact, updateAt)
    : applyInvalidation(current, fact);
  if (!applied.changed) {
    return Object.freeze({
      changed: false,
      checkpoint: normalizedCheckpoint,
      certificate: applied.certificate
        ? Object.freeze(cloneCertificate(applied.certificate))
        : null,
      transition: applied.transition,
      effectiveState: resolveEffectiveFeedTopologyCertificateState(
        applied.certificate,
        { now: updateAt },
      ),
    });
  }
  const checkpointValue = requireFeedTopologyCertificateCheckpoint({
    contract: FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_CONTRACT,
    schemaVersion: FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_SCHEMA_VERSION,
    profileEpoch,
    stateRevision: normalizedCheckpoint ? normalizedCheckpoint.stateRevision + 1 : 0,
    createdAt: normalizedCheckpoint?.createdAt ?? updateAt,
    updatedAt: updateAt,
    surfaces: upsertSurface(
      normalizedCheckpoint?.surfaces || [],
      applied.certificate,
    ),
  }, { expectedProfileEpoch: profileEpoch });
  return Object.freeze({
    changed: true,
    checkpoint: checkpointValue,
    certificate: Object.freeze(cloneCertificate(applied.certificate)),
    transition: applied.transition,
    effectiveState: resolveEffectiveFeedTopologyCertificateState(
      applied.certificate,
      { now: updateAt },
    ),
  });
}
