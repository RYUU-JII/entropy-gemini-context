import {
  buildLocallyCertifiedFeedTopologyId,
  resolveFeedEndpointAdapter,
  resolveLocallyCertifiedFeedEndpointAdapter,
} from '../actuation/feedEndpointAdapterCatalog.js';
import {
  FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES,
  FEED_SHIPPED_TOPOLOGY_PROBE_CONTRACT,
  FEED_TOPOLOGY_AUTHORITY_SOURCES,
  FEED_TOPOLOGY_AUTHORITY_STATES,
  FEED_TOPOLOGY_AUTHORITY_VERSION,
  isFeedTopologyActuationAuthorized,
} from '../../../protection/contracts/feedTopologyAuthorityContract.js';
import {
  FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CONTRACT,
  normalizeFeedTopologyLocalCertificateEvidence,
} from './feedTopologyCertificationContracts.js';

export {
  FEED_TOPOLOGY_AUTHORITY_SOURCES,
  FEED_TOPOLOGY_AUTHORITY_STATES,
  FEED_TOPOLOGY_AUTHORITY_VERSION,
  isFeedTopologyActuationAuthorized,
};

const LEARNER_STATES = new Set([
  'pending',
  'warming',
  'ready',
  'volatile',
  'invalid',
]);

const SURFACE_MODES = new Set([
  'continuous',
  'paged',
  'hybrid',
  'document',
  'unknown',
]);
const SHIPPED_TOPOLOGY_HEALTH_STATUS_SET = new Set(
  Object.values(FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES),
);

function uniqueStrings(values = []) {
  return Array.from(new Set(values.filter(
    (value) => typeof value === 'string' && value,
  )));
}

function normalizeSurfaceMode(value) {
  const normalized = typeof value === 'string' && value ? value : 'unknown';
  if (!SURFACE_MODES.has(normalized)) {
    throw new Error(`FEED_TOPOLOGY_SURFACE_MODE_INVALID:${normalized}`);
  }
  return normalized;
}

function normalizeLearnerState(learnerSnapshot) {
  if (!learnerSnapshot) return 'pending';
  const state = learnerSnapshot.state;
  if (typeof state !== 'string' || !LEARNER_STATES.has(state)) {
    throw new Error(`FEED_TOPOLOGY_LEARNER_STATE_INVALID:${String(state || '')}`);
  }
  return state;
}

function resolveAuthorityState({
  contentClass,
  learnerState,
  modeMismatch,
  profileId,
  adapter,
  localCertification,
  shippedTopologyStatus,
  useLocalCertification,
}) {
  if (contentClass === 'document') {
    return {
      state: FEED_TOPOLOGY_AUTHORITY_STATES.UNSUPPORTED,
      source: FEED_TOPOLOGY_AUTHORITY_SOURCES.NONE,
      reason: 'document_surface_excluded',
    };
  }

  const adapterAvailable = adapter.capability !== 'observe_only';
  if (!adapterAvailable && profileId !== 'default') {
    return {
      state: FEED_TOPOLOGY_AUTHORITY_STATES.UNSUPPORTED,
      source: FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE,
      reason: 'shipped_endpoint_topology_unsupported',
    };
  }

  if (learnerState === 'invalid') {
    return {
      state: FEED_TOPOLOGY_AUTHORITY_STATES.QUARANTINED,
      source: adapterAvailable
        ? FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE
        : FEED_TOPOLOGY_AUTHORITY_SOURCES.DYNAMIC_SHADOW,
      reason: 'topology_evidence_quarantined',
    };
  }

  if (learnerState === 'volatile' || modeMismatch) {
    return {
      state: FEED_TOPOLOGY_AUTHORITY_STATES.DRIFT_SUSPECTED,
      source: adapterAvailable
        ? FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE
        : FEED_TOPOLOGY_AUTHORITY_SOURCES.DYNAMIC_SHADOW,
      reason: 'topology_drift_suspected',
    };
  }

  if (
    adapterAvailable
    && shippedTopologyStatus === FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES.INVALID
  ) {
    return {
      state: FEED_TOPOLOGY_AUTHORITY_STATES.QUARANTINED,
      source: FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE,
      reason: 'shipped_topology_contract_invalid',
    };
  }

  if (
    adapterAvailable
    && shippedTopologyStatus === FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES.MISMATCH
  ) {
    if (useLocalCertification && localCertification?.authorized === true) {
      return {
        state: FEED_TOPOLOGY_AUTHORITY_STATES.LOCALLY_CERTIFIED,
        source: FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED,
        reason: 'shipped_topology_drift_locally_recovered',
      };
    }
    return {
      state: FEED_TOPOLOGY_AUTHORITY_STATES.DRIFT_SUSPECTED,
      source: FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE,
      reason: 'shipped_topology_live_mismatch',
    };
  }

  if (!adapterAvailable) {
    if (useLocalCertification && localCertification?.authorized === true) {
      return {
        state: FEED_TOPOLOGY_AUTHORITY_STATES.LOCALLY_CERTIFIED,
        source: FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED,
        reason: 'durable_local_topology_certified',
      };
    }
    return {
      state: FEED_TOPOLOGY_AUTHORITY_STATES.SHADOW_LEARNING,
      source: FEED_TOPOLOGY_AUTHORITY_SOURCES.DYNAMIC_SHADOW,
      reason: 'dynamic_topology_shadow_only',
    };
  }

  if (
    adapterAvailable
    && shippedTopologyStatus === FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES.RESOLVED
  ) {
    return {
      state: FEED_TOPOLOGY_AUTHORITY_STATES.CANONICAL_VERIFIED,
      source: FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE,
      reason: learnerState === 'ready'
        ? 'shipped_topology_corroborated'
        : 'shipped_topology_live_verified',
    };
  }

  return {
    state: FEED_TOPOLOGY_AUTHORITY_STATES.CANONICAL_LEARNING,
    source: FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE,
    reason: learnerState === 'ready'
      ? 'shipped_topology_live_verification_pending'
      : 'shipped_topology_learning',
  };
}

function buildAuthorityIdentity(snapshot) {
  return [
    snapshot.contractVersion,
    snapshot.topologyState,
    snapshot.topologySource,
    snapshot.profileId,
    snapshot.semanticSurfaceId,
    snapshot.surfaceMode,
    snapshot.adapterId,
    snapshot.topologyId,
    snapshot.capability,
    snapshot.mutationMode,
    snapshot.topologyFingerprint,
    snapshot.topologyCertificateRevision,
    snapshot.shippedTopologyStatus,
  ].join('::');
}

function normalizeShippedTopologyHealth(health, adapter) {
  if (adapter?.capability === 'observe_only') {
    return {
      status: FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES.UNSUPPORTED,
      reasons: ['shipped_topology_not_declared'],
    };
  }
  if (health === null || health === undefined) {
    return {
      status: FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES.UNAVAILABLE,
      reasons: [],
    };
  }
  if (typeof health !== 'object' || Array.isArray(health)) {
    throw new Error('FEED_SHIPPED_TOPOLOGY_HEALTH_INVALID');
  }
  if (health.contract !== FEED_SHIPPED_TOPOLOGY_PROBE_CONTRACT) {
    throw new Error('FEED_SHIPPED_TOPOLOGY_HEALTH_CONTRACT_INVALID');
  }
  if (
    typeof health.status !== 'string'
    || !SHIPPED_TOPOLOGY_HEALTH_STATUS_SET.has(health.status)
  ) {
    throw new Error(`FEED_SHIPPED_TOPOLOGY_HEALTH_STATUS_INVALID:${String(health.status || '')}`);
  }
  if (
    health.adapterId
    && health.adapterId !== adapter.adapterId
  ) {
    throw new Error('FEED_SHIPPED_TOPOLOGY_HEALTH_ADAPTER_MISMATCH');
  }
  return {
    status: health.status,
    reasons: uniqueStrings(Array.isArray(health.reasons) ? health.reasons : []),
  };
}

function requireEvaluationTime(value) {
  const normalized = Math.round(Number(value));
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error('FEED_TOPOLOGY_EVALUATION_TIME_INVALID');
  }
  return normalized;
}

function resolveLocalCertification({
  surface,
  surfaceMode,
  learnerState,
  evidence,
  now,
}) {
  const unavailable = (reason) => ({
    authorized: false,
    reason,
    adapter: null,
    fingerprint: '',
    certificateRevision: 0,
    certificateExpiresAt: 0,
    checkpointStateRevision: 0,
  });
  if (!evidence || typeof evidence !== 'object') {
    return unavailable('local_certificate_unavailable');
  }
  const normalizedEvidence = normalizeFeedTopologyLocalCertificateEvidence(
    evidence,
  );
  if (
    normalizedEvidence.contractVersion
    !== FEED_TOPOLOGY_LOCAL_CERTIFICATE_EVIDENCE_CONTRACT
  ) {
    throw new Error('FEED_TOPOLOGY_LOCAL_CERTIFICATE_CONTRACT_INVALID');
  }
  if (normalizedEvidence.state !== 'certified') {
    return unavailable(
      `local_certificate_${normalizedEvidence.state || 'unavailable'}`,
    );
  }
  if (
    learnerState !== 'ready'
    || !normalizedEvidence.surface
    || normalizedEvidence.surface.hostname !== surface?.hostname
    || normalizedEvidence.surface.profileId !== surface?.profileId
    || normalizedEvidence.surface.semanticSurfaceId !== surface?.semanticSurfaceId
    || normalizedEvidence.surface.surfaceMode !== surfaceMode
    || normalizedEvidence.surface.contentClass !== surface?.contentClass
    || normalizedEvidence.expiresAt <= now
  ) {
    return unavailable('local_certificate_live_evidence_mismatch');
  }
  const adapter = resolveLocallyCertifiedFeedEndpointAdapter({
    surfaceMode,
    fingerprint: normalizedEvidence.fingerprint,
  });
  if (!adapter || adapter.capability === 'observe_only') {
    return unavailable('local_certificate_adapter_unsupported');
  }
  return {
    authorized: true,
    reason: 'local_certificate_live_match',
    adapter,
    fingerprint: normalizedEvidence.fingerprint,
    certificateRevision: normalizedEvidence.certificateRevision,
    certificateExpiresAt: normalizedEvidence.expiresAt,
    checkpointStateRevision: normalizedEvidence.checkpointStateRevision,
  };
}

/**
 * Content-local SSOT for staged feed-topology authority.
 *
 * This protocol consumes only the canonical surface tuple and content-free
 * learner snapshot. It never reads or mutates DOM. Dynamic inference remains
 * shadow-only until the separate durable certificate owner supplies an
 * unexpired certificate plus fresh matching live proof; that proof can enter
 * through locally_certified without changing the endpoint writer contract.
 */
export class FeedTopologyRecoveryProtocol {
  constructor({
    adapterResolver = resolveFeedEndpointAdapter,
  } = {}) {
    if (typeof adapterResolver !== 'function') {
      throw new Error('FEED_TOPOLOGY_ADAPTER_RESOLVER_REQUIRED');
    }
    this._adapterResolver = adapterResolver;
    this._topologyEpoch = 0;
    this._authorityIdentity = '';
    this._latestSnapshot = null;
  }

  reset() {
    this._authorityIdentity = '';
    this._latestSnapshot = null;
  }

  evaluate({
    surface = null,
    learnerSnapshot = null,
    effectiveSurfaceMode = null,
    localCertificationEvidence = null,
    shippedTopologyHealth = null,
    now = Date.now(),
  } = {}) {
    const evaluatedAt = requireEvaluationTime(now);
    const profileId = typeof surface?.profileId === 'string' ? surface.profileId : '';
    const semanticSurfaceId = typeof surface?.semanticSurfaceId === 'string'
      ? surface.semanticSurfaceId
      : '';
    const surfaceMode = normalizeSurfaceMode(
      effectiveSurfaceMode
        || (typeof surface?.surfaceMode === 'string' ? surface.surfaceMode : 'unknown'),
    );
    const contentClass = surfaceMode === 'document' || surface?.contentClass === 'document'
      ? 'document'
      : 'feed';
    const learnerState = normalizeLearnerState(learnerSnapshot);
    const learnedSurfaceMode = normalizeSurfaceMode(
      typeof learnerSnapshot?.metrics?.dominantSurfaceMode === 'string'
        ? learnerSnapshot.metrics.dominantSurfaceMode
        : 'unknown',
    );
    const modeMismatch = learnerState === 'ready'
      && learnedSurfaceMode !== 'unknown'
      && learnedSurfaceMode !== surfaceMode;
    const learnerReadinessStatus = modeMismatch ? 'volatile' : learnerState;
    const adapter = this._adapterResolver({
      profileId,
      semanticSurfaceId,
      surfaceMode,
    });
    if (!adapter || typeof adapter !== 'object' || typeof adapter.capability !== 'string') {
      throw new Error('FEED_TOPOLOGY_ADAPTER_CONTRACT_INVALID');
    }
    const normalizedShippedTopologyHealth = normalizeShippedTopologyHealth(
      shippedTopologyHealth,
      adapter,
    );
    const shippedTopologyLiveVerified = (
      adapter.capability !== 'observe_only'
      && normalizedShippedTopologyHealth.status
        === FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES.RESOLVED
      && learnerReadinessStatus !== 'invalid'
      && learnerReadinessStatus !== 'volatile'
    );
    const readinessStatus = shippedTopologyLiveVerified
      ? 'ready'
      : learnerReadinessStatus;
    const authorityLearnedSurfaceMode = shippedTopologyLiveVerified
      ? surfaceMode
      : learnedSurfaceMode;
    const localCertification = resolveLocalCertification({
      surface,
      surfaceMode,
      learnerState: learnerReadinessStatus,
      evidence: localCertificationEvidence,
      now: evaluatedAt,
    });
    const useLocalCertification = localCertification.authorized && (
      (
        adapter.capability === 'observe_only'
        && profileId === 'default'
      )
      || (
        adapter.capability !== 'observe_only'
        && normalizedShippedTopologyHealth.status
          === FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES.MISMATCH
      )
    );
    const selectedAdapter = useLocalCertification
      ? localCertification.adapter
      : adapter;

    const authority = resolveAuthorityState({
      contentClass,
      learnerState: readinessStatus,
      modeMismatch,
      profileId,
      adapter,
      localCertification,
      shippedTopologyStatus: normalizedShippedTopologyHealth.status,
      useLocalCertification,
    });
    const canActuate = (
      authority.state === FEED_TOPOLOGY_AUTHORITY_STATES.CANONICAL_VERIFIED
      && authority.source === FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE
    ) || (
      authority.state === FEED_TOPOLOGY_AUTHORITY_STATES.LOCALLY_CERTIFIED
      && authority.source === FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED
      && localCertification.authorized
    );
    const draft = {
      contractVersion: FEED_TOPOLOGY_AUTHORITY_VERSION,
      topologyState: authority.state,
      topologySource: authority.source,
      topologyEpoch: 0,
      topologyEvaluatedAt: evaluatedAt,
      canActuate,
      status: readinessStatus,
      capability: canActuate ? selectedAdapter.capability : 'observe_only',
      surfaceMode,
      learnedSurfaceMode: authorityLearnedSurfaceMode,
      confidence: shippedTopologyLiveVerified
        ? 1
        : Math.max(0, Math.min(1, Number(learnerSnapshot?.confidence) || 0)),
      sampleCount: Math.max(0, Math.round(Number(learnerSnapshot?.sampleCount) || 0)),
      learnerStatus: learnerReadinessStatus,
      learnerConfidence: Math.max(
        0,
        Math.min(1, Number(learnerSnapshot?.confidence) || 0),
      ),
      learnerVersion: typeof learnerSnapshot?.version === 'string'
        ? learnerSnapshot.version
        : '',
      learnerReasons: uniqueStrings(
        Array.isArray(learnerSnapshot?.reasons)
          ? learnerSnapshot.reasons
          : ['structure_learner_not_initialized'],
      ),
      shippedTopologyStatus: normalizedShippedTopologyHealth.status,
      profileId,
      semanticSurfaceId,
      adapterId: selectedAdapter.capability === 'observe_only'
        ? ''
        : selectedAdapter.adapterId,
      topologyId: useLocalCertification
        ? buildLocallyCertifiedFeedTopologyId(localCertification.fingerprint)
        : (
          selectedAdapter.capability === 'observe_only'
            ? ''
            : (selectedAdapter.endpointTopology?.topologyId || '')
        ),
      mutationMode: selectedAdapter.capability === 'observe_only'
        ? 'none'
        : selectedAdapter.mutationMode,
      topologyFingerprint: useLocalCertification
        ? localCertification.fingerprint
        : '',
      topologyCertificateRevision: useLocalCertification
        ? localCertification.certificateRevision
        : 0,
      topologyCertificateExpiresAt: useLocalCertification
        ? localCertification.certificateExpiresAt
        : 0,
      topologyCertificateCheckpointRevision: useLocalCertification
        ? localCertification.checkpointStateRevision
        : 0,
      reasons: uniqueStrings([
        ...(
          shippedTopologyLiveVerified
            ? ['shipped_topology_live_verified', 'dynamic_learning_shadow']
            : (
              Array.isArray(learnerSnapshot?.reasons)
                ? learnerSnapshot.reasons
                : ['structure_learner_not_initialized']
            )
        ),
        ...(modeMismatch ? ['learned_surface_mode_mismatch'] : []),
        ...normalizedShippedTopologyHealth.reasons,
        ...(
          adapter.capability === 'observe_only'
          || normalizedShippedTopologyHealth.status
            === FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES.MISMATCH
            ? [localCertification.reason]
            : []
        ),
        authority.reason,
      ]),
    };
    const authorityIdentity = buildAuthorityIdentity(draft);
    if (authorityIdentity !== this._authorityIdentity) {
      this._topologyEpoch += 1;
      this._authorityIdentity = authorityIdentity;
    }
    draft.topologyEpoch = this._topologyEpoch;

    const snapshot = Object.freeze({
      ...draft,
      reasons: Object.freeze([...draft.reasons]),
      learnerReasons: Object.freeze([...draft.learnerReasons]),
    });
    this._latestSnapshot = snapshot;
    return snapshot;
  }

  getSnapshot() {
    if (!this._latestSnapshot) return null;
    return {
      ...this._latestSnapshot,
      reasons: [...this._latestSnapshot.reasons],
      learnerReasons: [...this._latestSnapshot.learnerReasons],
    };
  }
}

export default FeedTopologyRecoveryProtocol;
