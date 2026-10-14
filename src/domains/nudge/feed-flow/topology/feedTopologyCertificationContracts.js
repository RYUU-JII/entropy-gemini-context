import {
  FEED_TOPOLOGY_CERTIFICATE_STATES,
  buildFeedTopologyCertificateSurfaceKey,
  normalizeFeedLocalTopologyDescriptor,
  normalizeFeedTopologyCertificateSurface,
  requireFeedLocalTopologyFingerprint,
} from '../../../../platform/storage/model/FeedTopologyCertificateCheckpointContract.js';

export const FEED_TOPOLOGY_OBSERVATION_FACT_VERSION = 1;
export const FEED_TOPOLOGY_CERTIFICATION_SNAPSHOT_VERSION = 1;
export const FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CONTRACT = (
  'feed-topology-local-certificate-evidence-v1'
);
export const FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY = Object.freeze({
  minimumLearnerConfidence: 0.72,
  minimumLearnerSampleCount: 8,
  liveStabilitySamples: 3,
  minimumLiveProbeIntervalMs: 750,
  certifiedValidationIntervalMs: 2_500,
  shadowValidationIntervalMs: 10_000,
  liveProofTtlMs: 10_000,
});

export const FEED_TOPOLOGY_OBSERVATION_OUTCOMES = Object.freeze({
  CORROBORATED: 'corroborated',
  INVALIDATED: 'invalidated',
});

const FACT_KEYS = Object.freeze([
  'version',
  'surface',
  'observationId',
  'observedAt',
  'outcome',
  'fingerprint',
  'descriptor',
  'learnerVersion',
  'learnerState',
  'learnerConfidence',
  'learnerSampleCount',
]);
const OUTCOMES = new Set(Object.values(FEED_TOPOLOGY_OBSERVATION_OUTCOMES));
const LEARNER_STATES = new Set(['ready', 'volatile', 'invalid']);
const LEARNER_VERSION_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/i;
const LIVE_FINGERPRINT_PATTERN = /^lft1:[a-z0-9._:-]{1,155}$/i;
const EVIDENCE_STATES = new Set([
  'none',
  FEED_TOPOLOGY_CERTIFICATE_STATES.LEARNING,
  FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED,
  FEED_TOPOLOGY_CERTIFICATE_STATES.INVALIDATED,
  FEED_TOPOLOGY_CERTIFICATE_STATES.EXPIRED,
  'live_verification_pending',
  'failed',
]);
const EVIDENCE_KEYS = Object.freeze([
  'contractVersion',
  'state',
  'surface',
  'fingerprint',
  'descriptor',
  'certificateRevision',
  'certifiedAt',
  'expiresAt',
  'liveFingerprint',
  'liveStableSamples',
  'checkpointStateRevision',
]);

function requireExactObject(value, keys, errorCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(errorCode);
  }
  return value;
}

function requireTimestamp(value, errorCode) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
  return value;
}

function requireNonNegativeInteger(value, errorCode) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
  return value;
}

function requireContentFreeId(value, errorCode) {
  if (
    typeof value !== 'string'
    || value !== value.trim()
    || !LEARNER_VERSION_PATTERN.test(value)
  ) {
    throw new Error(errorCode);
  }
  return value;
}

export function normalizeFeedTopologyObservationFact(value) {
  const source = requireExactObject(
    value,
    FACT_KEYS,
    'FEED_TOPOLOGY_OBSERVATION_FACT_INVALID',
  );
  if (source.version !== FEED_TOPOLOGY_OBSERVATION_FACT_VERSION) {
    throw new Error('FEED_TOPOLOGY_OBSERVATION_FACT_VERSION_INVALID');
  }
  const surface = normalizeFeedTopologyCertificateSurface(source.surface);
  const observationId = requireContentFreeId(
    source.observationId,
    'FEED_TOPOLOGY_OBSERVATION_ID_INVALID',
  );
  const observedAt = requireTimestamp(
    source.observedAt,
    'FEED_TOPOLOGY_OBSERVATION_TIMESTAMP_INVALID',
  );
  if (typeof source.outcome !== 'string' || !OUTCOMES.has(source.outcome)) {
    throw new Error('FEED_TOPOLOGY_OBSERVATION_OUTCOME_INVALID');
  }
  if (typeof source.learnerState !== 'string' || !LEARNER_STATES.has(source.learnerState)) {
    throw new Error('FEED_TOPOLOGY_OBSERVATION_LEARNER_STATE_INVALID');
  }
  const learnerConfidence = Number(source.learnerConfidence);
  if (!Number.isFinite(learnerConfidence) || learnerConfidence < 0 || learnerConfidence > 1) {
    throw new Error('FEED_TOPOLOGY_OBSERVATION_LEARNER_CONFIDENCE_INVALID');
  }
  const learnerSampleCount = requireNonNegativeInteger(
    source.learnerSampleCount,
    'FEED_TOPOLOGY_OBSERVATION_LEARNER_SAMPLE_COUNT_INVALID',
  );
  const descriptor = normalizeFeedLocalTopologyDescriptor(source.descriptor);
  if (descriptor.surfaceMode !== surface.surfaceMode) {
    throw new Error('FEED_TOPOLOGY_OBSERVATION_DESCRIPTOR_SURFACE_MISMATCH');
  }
  const fingerprint = requireFeedLocalTopologyFingerprint(
    source.fingerprint,
    descriptor,
  );
  if (
    (
      source.outcome === FEED_TOPOLOGY_OBSERVATION_OUTCOMES.CORROBORATED
      && (
        source.learnerState !== 'ready'
        || learnerConfidence
          < FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.minimumLearnerConfidence
        || learnerSampleCount
          < FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.minimumLearnerSampleCount
      )
    )
    || (
      source.outcome === FEED_TOPOLOGY_OBSERVATION_OUTCOMES.INVALIDATED
      && source.learnerState !== 'volatile'
      && source.learnerState !== 'invalid'
    )
  ) {
    throw new Error('FEED_TOPOLOGY_OBSERVATION_EVIDENCE_INELIGIBLE');
  }
  return Object.freeze({
    version: FEED_TOPOLOGY_OBSERVATION_FACT_VERSION,
    surface,
    observationId,
    observedAt,
    outcome: source.outcome,
    fingerprint,
    descriptor,
    learnerVersion: requireContentFreeId(
      source.learnerVersion,
      'FEED_TOPOLOGY_OBSERVATION_LEARNER_VERSION_INVALID',
    ),
    learnerState: source.learnerState,
    learnerConfidence,
    learnerSampleCount,
  });
}

export function buildFeedTopologyObservationFact({
  surface,
  observationId,
  observedAt,
  outcome,
  fingerprint,
  descriptor,
  learnerSnapshot,
} = {}) {
  return normalizeFeedTopologyObservationFact({
    version: FEED_TOPOLOGY_OBSERVATION_FACT_VERSION,
    surface,
    observationId,
    observedAt,
    outcome,
    fingerprint,
    descriptor,
    learnerVersion: learnerSnapshot?.version,
    learnerState: learnerSnapshot?.state,
    learnerConfidence: learnerSnapshot?.confidence,
    learnerSampleCount: learnerSnapshot?.sampleCount,
  });
}

export function cloneFeedTopologyObservationFact(fact) {
  if (!fact || typeof fact !== 'object') return null;
  return {
    ...fact,
    surface: fact.surface ? { ...fact.surface } : null,
    descriptor: fact.descriptor ? { ...fact.descriptor } : null,
  };
}

export function buildFeedTopologyCertificationSurface(surface) {
  const normalized = normalizeFeedTopologyCertificateSurface(surface);
  return Object.freeze({
    ...normalized,
    key: buildFeedTopologyCertificateSurfaceKey(normalized),
  });
}

function requireNullableRevision(value, errorCode) {
  if (value === null) return null;
  return requireNonNegativeInteger(value, errorCode);
}

export function normalizeFeedTopologyLocalCertificateEvidence(value) {
  const source = requireExactObject(
    value,
    EVIDENCE_KEYS,
    'FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_INVALID',
  );
  if (
    source.contractVersion
    !== FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CONTRACT
  ) {
    throw new Error('FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CONTRACT_INVALID');
  }
  if (typeof source.state !== 'string' || !EVIDENCE_STATES.has(source.state)) {
    throw new Error('FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_STATE_INVALID');
  }
  const surface = source.surface === null
    ? null
    : normalizeFeedTopologyCertificateSurface(source.surface);
  const descriptor = source.descriptor === null
    ? null
    : normalizeFeedLocalTopologyDescriptor(source.descriptor);
  const fingerprint = descriptor === null
    ? ''
    : requireFeedLocalTopologyFingerprint(source.fingerprint, descriptor);
  const certificateRevision = requireNullableRevision(
    source.certificateRevision,
    'FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_REVISION_INVALID',
  );
  const certifiedAt = requireTimestamp(
    source.certifiedAt,
    'FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CERTIFIED_AT_INVALID',
  );
  const expiresAt = requireTimestamp(
    source.expiresAt,
    'FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_EXPIRES_AT_INVALID',
  );
  const liveStableSamples = requireNonNegativeInteger(
    source.liveStableSamples,
    'FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_LIVE_SAMPLES_INVALID',
  );
  const checkpointStateRevision = requireNullableRevision(
    source.checkpointStateRevision,
    'FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CHECKPOINT_REVISION_INVALID',
  );
  const liveFingerprint = source.liveFingerprint;
  if (
    typeof liveFingerprint !== 'string'
    || liveFingerprint !== liveFingerprint.trim()
    || (
      liveFingerprint !== ''
      && !LIVE_FINGERPRINT_PATTERN.test(liveFingerprint)
    )
  ) {
    throw new Error(
      'FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_LIVE_FINGERPRINT_INVALID',
    );
  }
  const hasCertificate = certificateRevision !== null;
  if (
    (descriptor !== null && surface === null)
    || (descriptor === null && source.fingerprint !== '')
    || (
      descriptor
      && (
        !surface
        || descriptor.surfaceMode !== surface.surfaceMode
      )
    )
    || (
      !hasCertificate
      && (
        descriptor !== null
        || certifiedAt !== 0
        || expiresAt !== 0
      )
    )
    || (
      hasCertificate
      && (
        !descriptor
        || certificateRevision < 0
        || expiresAt < certifiedAt
      )
    )
    || (
      source.state === FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED
      && (
        !hasCertificate
        || certificateRevision <= 0
        || checkpointStateRevision === null
        || expiresAt <= certifiedAt
        || liveFingerprint !== fingerprint
        || liveStableSamples
          < FEED_TOPOLOGY_LIVE_CERTIFICATION_POLICY.liveStabilitySamples
      )
    )
  ) {
    throw new Error('FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_INVARIANT_INVALID');
  }
  return Object.freeze({
    contractVersion: FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CONTRACT,
    state: source.state,
    surface,
    fingerprint,
    descriptor,
    certificateRevision,
    certifiedAt,
    expiresAt,
    liveFingerprint,
    liveStableSamples,
    checkpointStateRevision,
  });
}

export function resolveEffectiveFeedTopologyCertificateState(
  certificate,
  { now = Date.now() } = {},
) {
  if (!certificate) return 'none';
  const evaluatedAt = requireTimestamp(
    Math.round(Number(now)),
    'FEED_TOPOLOGY_CERTIFICATE_EVALUATION_TIME_INVALID',
  );
  if (
    certificate.status === FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED
    && certificate.expiresAt <= evaluatedAt
  ) {
    return FEED_TOPOLOGY_CERTIFICATE_STATES.EXPIRED;
  }
  return certificate.status;
}
