import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import { requireFeedContentFlowHistory } from '../../stats/contracts/feedContentFlowHistory.js';
import {
  PRESSURE_SIGNALS,
} from './protectionContracts.js';
import {
  FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES,
  FEED_TOPOLOGY_AUTHORITY_SOURCES,
  FEED_TOPOLOGY_AUTHORITY_STATES,
  FEED_TOPOLOGY_AUTHORITY_VERSION,
} from './feedTopologyAuthorityContract.js';

export const FEED_FLOW_STATES = Object.freeze(['none', 'pressure', 'interrupt']);
export const FEED_SURFACE_MODES = Object.freeze(['continuous', 'paged', 'hybrid', 'document', 'unknown']);
// The background lease expires first so the content sender has time to receive
// a named commit failure before its own runtime-message channel closes.
export const FEED_FLOW_SNAPSHOT_COMMIT_DEADLINE_MS = 1_500;
export const FEED_FLOW_SNAPSHOT_DELIVERY_TIMEOUT_MS = 2_000;
export const FEED_READINESS_STATUSES = Object.freeze([
  'pending',
  'warming',
  'ready',
  'volatile',
  'invalid',
]);
export const FEED_ACTUATION_CAPABILITIES = Object.freeze([
  'observe_only',
  'anchored_continuous',
  'paged_hold',
]);
export const FEED_ACTUATION_SAFETY_STATUSES = Object.freeze([
  'pending',
  'safe',
  'unsafe',
]);
export const FEED_TOPOLOGY_AUTHORITY_STATE_VALUES = Object.freeze(
  Object.values(FEED_TOPOLOGY_AUTHORITY_STATES),
);
export const FEED_TOPOLOGY_AUTHORITY_SOURCE_VALUES = Object.freeze(
  Object.values(FEED_TOPOLOGY_AUTHORITY_SOURCES),
);
export const FEED_SHIPPED_TOPOLOGY_HEALTH_STATUS_VALUES = Object.freeze(
  Object.values(FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES),
);

const FEED_FLOW_STATE_SET = new Set(FEED_FLOW_STATES);
const FEED_SURFACE_MODE_SET = new Set(FEED_SURFACE_MODES);
const FEED_READINESS_STATUS_SET = new Set(FEED_READINESS_STATUSES);
const FEED_ACTUATION_CAPABILITY_SET = new Set(FEED_ACTUATION_CAPABILITIES);
const FEED_ACTUATION_SAFETY_STATUS_SET = new Set(FEED_ACTUATION_SAFETY_STATUSES);
const FEED_TOPOLOGY_AUTHORITY_STATE_SET =
  new Set(FEED_TOPOLOGY_AUTHORITY_STATE_VALUES);
const FEED_TOPOLOGY_AUTHORITY_SOURCE_SET =
  new Set(FEED_TOPOLOGY_AUTHORITY_SOURCE_VALUES);
const FEED_SHIPPED_TOPOLOGY_HEALTH_STATUS_SET =
  new Set(FEED_SHIPPED_TOPOLOGY_HEALTH_STATUS_VALUES);
const ACTUATABLE_TOPOLOGY_STATE_SET = new Set([
  FEED_TOPOLOGY_AUTHORITY_STATES.CANONICAL_VERIFIED,
  FEED_TOPOLOGY_AUTHORITY_STATES.LOCALLY_CERTIFIED,
]);
const DIRECT_TRIGGER_SET = new Set(['INFINITE_SCROLL_DETECTED']);
const PRESSURE_SIGNAL_SET = new Set(PRESSURE_SIGNALS);
const CONTENT_FREE_CODE_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/i;
const TOPOLOGY_FINGERPRINT_PATTERN = /^lft1:[a-z0-9._:-]{1,155}$/i;
const INFINITE_SCROLL_DIRECT_TRIGGER = 'INFINITE_SCROLL_DETECTED';
const normalizedFeedFlowSnapshots = new WeakSet();

function freezeCanonicalFeedFlowSnapshot(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach((nestedValue) => {
    freezeCanonicalFeedFlowSnapshot(nestedValue);
  });
  return Object.freeze(value);
}

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function normalizeState(value) {
  return normalizeExplicitEnum(value, {
    allowed: FEED_FLOW_STATE_SET,
    fallback: 'none',
    errorCode: 'feed_flow_snapshot_state_invalid',
  });
}

function normalizeSurfaceMode(value) {
  return normalizeExplicitEnum(value, {
    allowed: FEED_SURFACE_MODE_SET,
    fallback: 'unknown',
    errorCode: 'feed_flow_snapshot_surface_mode_invalid',
  });
}

function normalizeExplicitEnum(value, {
  allowed,
  fallback,
  errorCode,
}) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') {
    throw new Error(`${errorCode}:${typeof value}`);
  }
  const normalized = value.trim();
  if (!normalized) return fallback;
  if (!allowed.has(normalized)) {
    throw new Error(`${errorCode}:${normalized}`);
  }
  return normalized;
}

function normalizeEnumList(values, {
  allowed,
  errorCode,
}) {
  if (values === null || values === undefined) return [];
  if (!Array.isArray(values)) {
    throw new Error(`${errorCode}:${typeof values}`);
  }
  const unique = new Set();
  values.forEach((value) => {
    if (typeof value !== 'string') {
      throw new Error(`${errorCode}:${typeof value}`);
    }
    const normalized = value.trim();
    if (!normalized) return;
    if (!allowed.has(normalized)) {
      throw new Error(`${errorCode}:${normalized}`);
    }
    unique.add(normalized);
  });
  return Array.from(unique);
}

function normalizeContentFreeCode(value, {
  fallback = '',
  errorCode,
}) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') {
    throw new Error(`${errorCode}:${typeof value}`);
  }
  const normalized = value.trim();
  if (!normalized) return fallback;
  if (!CONTENT_FREE_CODE_PATTERN.test(normalized)) {
    throw new Error(`${errorCode}:${normalized}`);
  }
  return normalized;
}

function normalizeContentFreeCodeList(values, errorCode) {
  if (values === null || values === undefined) return [];
  if (!Array.isArray(values)) {
    throw new Error(`${errorCode}:${typeof values}`);
  }
  const unique = new Set();
  values.forEach((value) => {
    const normalized = normalizeContentFreeCode(value, { errorCode });
    if (normalized) unique.add(normalized);
  });
  return Array.from(unique);
}

function normalizeTopologyFingerprint(value) {
  if (value === null || value === undefined || value === '') return '';
  if (
    typeof value !== 'string'
    || value !== value.trim()
    || !TOPOLOGY_FINGERPRINT_PATTERN.test(value)
  ) {
    throw new Error('feed_flow_snapshot_readiness_topology_fingerprint_invalid');
  }
  return value;
}

function normalizeConfidence(value) {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`feed_flow_snapshot_confidence_invalid:${typeof value}`);
  }
  return Math.max(0, Math.min(1, numeric));
}

function normalizeNonNegativeNumber(value, fieldName, { integer = false, nullable = false } = {}) {
  if (value === null || value === undefined || value === '') {
    return nullable ? null : 0;
  }
  const numeric = integer ? Math.floor(Number(value)) : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`feed_flow_snapshot_metric_invalid:${fieldName}`);
  }
  return numeric;
}

function normalizeCount(value, fieldName) {
  return normalizeNonNegativeNumber(value, fieldName, { integer: true });
}

function normalizeRatio(value, fieldName) {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`feed_flow_snapshot_metric_invalid:${fieldName}`);
  }
  return Math.min(1, numeric);
}

function normalizeTimestamp(value, fieldName, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`feed_flow_snapshot_timestamp_invalid:${fieldName}`);
  }
  return numeric;
}

function normalizeSnapshotRevision(value) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new Error('feed_flow_snapshot_revision_invalid');
  }
  return numeric;
}

function normalizeNullableMs(value) {
  if (value === null || value === undefined || value === '') return null;
  return normalizeNonNegativeNumber(value, 'medianDwellMs', { integer: true, nullable: true });
}

function normalizeMetrics(metrics = null) {
  if (metrics === null || metrics === undefined) {
    metrics = {};
  }
  if (typeof metrics !== 'object' || Array.isArray(metrics)) {
    throw new Error(`feed_flow_snapshot_metrics_invalid:${typeof metrics}`);
  }
  const source = metrics;
  return {
    advanceCount: normalizeCount(source.advanceCount, 'advanceCount'),
    screenfulsConsumed: normalizeNonNegativeNumber(source.screenfulsConsumed, 'screenfulsConsumed'),
    itemTransitions: normalizeCount(source.itemTransitions, 'itemTransitions'),
    freshItemsSeen: normalizeCount(source.freshItemsSeen, 'freshItemsSeen'),
    medianDwellMs: normalizeNullableMs(source.medianDwellMs),
    maxPauseMs: normalizeCount(source.maxPauseMs, 'maxPauseMs'),
    burstDurationMs: normalizeCount(source.burstDurationMs, 'burstDurationMs'),
    backwardIntentCount: normalizeCount(source.backwardIntentCount, 'backwardIntentCount'),
    backtrackRatio: normalizeRatio(source.backtrackRatio, 'backtrackRatio'),
    revisitCount: normalizeCount(source.revisitCount, 'revisitCount'),
    recentInteractiveActionCount: normalizeCount(source.recentInteractiveActionCount, 'recentInteractiveActionCount'),
    sustainedMediaWatchMs: normalizeCount(source.sustainedMediaWatchMs, 'sustainedMediaWatchMs'),
    supplyTotalSteps: normalizeCount(source.supplyTotalSteps, 'supplyTotalSteps'),
    supplyDemandSteps: normalizeCount(source.supplyDemandSteps, 'supplyDemandSteps'),
    supplyDemandRatio: normalizeRatio(source.supplyDemandRatio, 'supplyDemandRatio'),
    supplyLoopPressure: normalizeNonNegativeNumber(source.supplyLoopPressure, 'supplyLoopPressure'),
    supplyLateConfirmedSteps: normalizeCount(
      source.supplyLateConfirmedSteps,
      'supplyLateConfirmedSteps',
    ),
    supplyMaxDepthRatio: normalizeRatio(source.supplyMaxDepthRatio, 'supplyMaxDepthRatio'),
  };
}

function normalizeReadinessConfidence(value) {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`feed_flow_snapshot_readiness_confidence_invalid:${typeof value}`);
  }
  return Math.max(0, Math.min(1, numeric));
}

function normalizeReadinessSampleCount(value) {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('feed_flow_snapshot_readiness_sample_count_invalid');
  }
  return numeric;
}

export function normalizeFeedReadiness(readiness = null) {
  if (readiness !== null && readiness !== undefined
    && (typeof readiness !== 'object' || Array.isArray(readiness))) {
    throw new Error(`feed_flow_snapshot_readiness_invalid:${typeof readiness}`);
  }
  const source = readiness || {};
  return {
    status: normalizeExplicitEnum(source.status, {
      allowed: FEED_READINESS_STATUS_SET,
      fallback: 'pending',
      errorCode: 'feed_flow_snapshot_readiness_status_invalid',
    }),
    capability: normalizeExplicitEnum(source.capability, {
      allowed: FEED_ACTUATION_CAPABILITY_SET,
      fallback: 'observe_only',
      errorCode: 'feed_flow_snapshot_readiness_capability_invalid',
    }),
    confidence: normalizeReadinessConfidence(source.confidence),
    sampleCount: normalizeReadinessSampleCount(source.sampleCount),
    profileId: normalizeContentFreeCode(source.profileId, {
      errorCode: 'feed_flow_snapshot_readiness_profile_id_invalid',
    }),
    contractVersion: normalizeContentFreeCode(source.contractVersion, {
      errorCode: 'feed_flow_snapshot_readiness_contract_version_invalid',
    }),
    topologyState: normalizeExplicitEnum(source.topologyState, {
      allowed: FEED_TOPOLOGY_AUTHORITY_STATE_SET,
      fallback: FEED_TOPOLOGY_AUTHORITY_STATES.UNAVAILABLE,
      errorCode: 'feed_flow_snapshot_readiness_topology_state_invalid',
    }),
    topologySource: normalizeExplicitEnum(source.topologySource, {
      allowed: FEED_TOPOLOGY_AUTHORITY_SOURCE_SET,
      fallback: FEED_TOPOLOGY_AUTHORITY_SOURCES.NONE,
      errorCode: 'feed_flow_snapshot_readiness_topology_source_invalid',
    }),
    shippedTopologyStatus: normalizeExplicitEnum(source.shippedTopologyStatus, {
      allowed: FEED_SHIPPED_TOPOLOGY_HEALTH_STATUS_SET,
      fallback: FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES.UNAVAILABLE,
      errorCode: 'feed_flow_snapshot_readiness_shipped_topology_status_invalid',
    }),
    topologyEpoch: normalizeNonNegativeNumber(
      source.topologyEpoch,
      'readiness.topologyEpoch',
      { integer: true },
    ),
    topologyEvaluatedAt: normalizeNonNegativeNumber(
      source.topologyEvaluatedAt,
      'readiness.topologyEvaluatedAt',
      { integer: true },
    ),
    adapterId: normalizeContentFreeCode(source.adapterId, {
      errorCode: 'feed_flow_snapshot_readiness_adapter_id_invalid',
    }),
    topologyId: normalizeContentFreeCode(source.topologyId, {
      errorCode: 'feed_flow_snapshot_readiness_topology_id_invalid',
    }),
    topologyFingerprint: normalizeTopologyFingerprint(source.topologyFingerprint),
    topologyCertificateRevision: normalizeNonNegativeNumber(
      source.topologyCertificateRevision,
      'readiness.topologyCertificateRevision',
      { integer: true },
    ),
    topologyCertificateExpiresAt: normalizeNonNegativeNumber(
      source.topologyCertificateExpiresAt,
      'readiness.topologyCertificateExpiresAt',
      { integer: true },
    ),
    topologyCertificateCheckpointRevision: normalizeNonNegativeNumber(
      source.topologyCertificateCheckpointRevision,
      'readiness.topologyCertificateCheckpointRevision',
      { integer: true },
    ),
    reasons: normalizeContentFreeCodeList(
      source.reasons,
      'feed_flow_snapshot_readiness_reason_invalid',
    ),
  };
}

export function normalizeFeedActuationSafety(actuationSafety = null) {
  if (actuationSafety !== null && actuationSafety !== undefined
    && (typeof actuationSafety !== 'object' || Array.isArray(actuationSafety))) {
    throw new Error(`feed_flow_snapshot_actuation_safety_invalid:${typeof actuationSafety}`);
  }
  const source = actuationSafety || {};
  return {
    status: normalizeExplicitEnum(source.status, {
      allowed: FEED_ACTUATION_SAFETY_STATUS_SET,
      fallback: 'pending',
      errorCode: 'feed_flow_snapshot_actuation_safety_status_invalid',
    }),
    capability: normalizeExplicitEnum(source.capability, {
      allowed: FEED_ACTUATION_CAPABILITY_SET,
      fallback: 'observe_only',
      errorCode: 'feed_flow_snapshot_actuation_safety_capability_invalid',
    }),
    reasons: normalizeContentFreeCodeList(
      source.reasons,
      'feed_flow_snapshot_actuation_safety_reason_invalid',
    ),
  };
}

function assertReadinessTopologyInvariant(readiness) {
  const state = readiness.topologyState;
  if (state === FEED_TOPOLOGY_AUTHORITY_STATES.UNAVAILABLE) return;
  if (readiness.contractVersion !== FEED_TOPOLOGY_AUTHORITY_VERSION) {
    throw new Error('feed_flow_snapshot_readiness_topology_contract_mismatch');
  }
  if (!Number.isSafeInteger(readiness.topologyEpoch) || readiness.topologyEpoch <= 0) {
    throw new Error('feed_flow_snapshot_readiness_topology_epoch_missing');
  }

  const isActuatable = ACTUATABLE_TOPOLOGY_STATE_SET.has(state);
  if (isActuatable) {
    if (!readiness.adapterId || readiness.capability === 'observe_only') {
      throw new Error('feed_flow_snapshot_readiness_topology_authority_incomplete');
    }
    const expectedSource = state === FEED_TOPOLOGY_AUTHORITY_STATES.LOCALLY_CERTIFIED
      ? FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED
      : FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE;
    if (readiness.topologySource !== expectedSource) {
      throw new Error('feed_flow_snapshot_readiness_topology_source_mismatch');
    }
    if (
      state === FEED_TOPOLOGY_AUTHORITY_STATES.LOCALLY_CERTIFIED
      && (
        !readiness.topologyFingerprint
        || readiness.topologyCertificateRevision <= 0
        || readiness.topologyCertificateExpiresAt <= readiness.topologyEvaluatedAt
      )
    ) {
      throw new Error('feed_flow_snapshot_readiness_local_certificate_incomplete');
    }
    return;
  }

  if (readiness.capability !== 'observe_only') {
    throw new Error('feed_flow_snapshot_readiness_topology_capability_unsafe');
  }
  if (
    state === FEED_TOPOLOGY_AUTHORITY_STATES.CANONICAL_LEARNING
    && (
      readiness.topologySource !== FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE
      || !readiness.adapterId
    )
  ) {
    throw new Error('feed_flow_snapshot_readiness_topology_learning_incomplete');
  }
  if (
    state === FEED_TOPOLOGY_AUTHORITY_STATES.SHADOW_LEARNING
    && readiness.topologySource !== FEED_TOPOLOGY_AUTHORITY_SOURCES.DYNAMIC_SHADOW
  ) {
    throw new Error('feed_flow_snapshot_readiness_topology_source_mismatch');
  }
}

function assertInfiniteScrollTriggerInvariant({
  state,
  surfaceMode,
  directTriggers,
  readiness,
  actuationSafety,
}) {
  if (!directTriggers.includes(INFINITE_SCROLL_DIRECT_TRIGGER)) return;

  if (state !== 'interrupt') {
    throw new Error(`feed_flow_snapshot_infinite_scroll_trigger_state_invalid:${state}`);
  }
  if (surfaceMode === 'document' || surfaceMode === 'unknown') {
    throw new Error(`feed_flow_snapshot_infinite_scroll_trigger_surface_invalid:${surfaceMode}`);
  }
  if (readiness.status !== 'ready') {
    throw new Error(
      `feed_flow_snapshot_infinite_scroll_trigger_readiness_invalid:${readiness.status}`,
    );
  }
  if (actuationSafety.status !== 'safe') {
    throw new Error(
      `feed_flow_snapshot_infinite_scroll_trigger_actuation_safety_invalid:${actuationSafety.status}`,
    );
  }
  if (readiness.capability !== actuationSafety.capability) {
    throw new Error(
      'feed_flow_snapshot_infinite_scroll_trigger_capability_mismatch:'
      + `${readiness.capability}:${actuationSafety.capability}`,
    );
  }
  if (readiness.capability === 'observe_only') {
    throw new Error('feed_flow_snapshot_infinite_scroll_trigger_capability_invalid:observe_only');
  }
}

function resolveSurfaceCapability(surfaceMode) {
  if (surfaceMode === 'paged') return 'paged_hold';
  if (surfaceMode === 'continuous' || surfaceMode === 'hybrid') {
    return 'anchored_continuous';
  }
  return 'observe_only';
}

function assertSurfaceCapabilityInvariant({
  surfaceMode,
  readiness,
  actuationSafety,
}) {
  const expectedCapability = resolveSurfaceCapability(surfaceMode);
  const assertCapability = (owner, status, capability) => {
    const topologyAllowsActuation = owner !== 'readiness'
      || ACTUATABLE_TOPOLOGY_STATE_SET.has(readiness.topologyState);
    const canRemainObserveOnly = expectedCapability !== 'observe_only'
      && (status !== 'ready' || !topologyAllowsActuation)
      && status !== 'safe';
    if (
      capability !== expectedCapability
      && !(canRemainObserveOnly && capability === 'observe_only')
    ) {
      throw new Error(
        `feed_flow_snapshot_${owner}_capability_surface_mismatch:`
        + `${surfaceMode}:${capability}:${expectedCapability}`,
      );
    }
  };

  assertCapability('readiness', readiness.status, readiness.capability);
  assertCapability(
    'actuation_safety',
    actuationSafety.status,
    actuationSafety.capability,
  );
}

export function normalizeFeedFlowSnapshot(
  rawSnapshot = null,
  { host = '' } = {},
) {
  const source = rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};
  const checkedAt = normalizeTimestamp(source.checkedAt, 'checkedAt', Date.now());
  const expiresAt = normalizeTimestamp(source.expiresAt, 'expiresAt', checkedAt);
  if (expiresAt < checkedAt) {
    throw new Error('feed_flow_snapshot_expires_at_before_checked_at');
  }
  const state = normalizeState(source.state);
  const surfaceMode = normalizeSurfaceMode(source.surfaceMode);
  const directTriggers = normalizeEnumList(source.directTriggers, {
    allowed: DIRECT_TRIGGER_SET,
    errorCode: 'feed_flow_snapshot_direct_trigger_invalid',
  });
  const pressureSignals = normalizeEnumList(source.pressureSignals, {
    allowed: PRESSURE_SIGNAL_SET,
    errorCode: 'feed_flow_snapshot_pressure_signal_invalid',
  });
  const readiness = normalizeFeedReadiness(source.readiness);
  const actuationSafety = normalizeFeedActuationSafety(source.actuationSafety);
  assertReadinessTopologyInvariant(readiness);
  const metrics = normalizeMetrics(source.metrics);
  const snapshotRevision = normalizeSnapshotRevision(source.snapshotRevision);
  const normalizedSnapshot = {
    checkedAt,
    snapshotRevision,
    host: normalizeHost(host || source.host || ''),
    state,
    candidateState: source.candidateState === null
      || source.candidateState === undefined
      || source.candidateState === ''
      ? state
      : normalizeState(source.candidateState),
    surfaceMode,
    confidence: normalizeConfidence(source.confidence),
    detectorConfidence: normalizeConfidence(source.detectorConfidence),
    loopScore: normalizeConfidence(source.loopScore),
    directTriggers,
    pressureSignals,
    readiness,
    actuationSafety,
    metrics,
    history: source.history == null ? null : requireFeedContentFlowHistory(source.history),
    expiresAt,
  };

  if (normalizedSnapshot.history && normalizedSnapshot.history.observedAt > checkedAt) {
    throw new Error('feed_flow_snapshot_history_observed_at_after_checked_at');
  }

  assertInfiniteScrollTriggerInvariant(normalizedSnapshot);
  assertSurfaceCapabilityInvariant(normalizedSnapshot);
  // The WeakSet marker is a validation capability. Freeze the fresh canonical
  // graph before registering it so a same-realm caller cannot mutate a nested
  // metric or invariant-bearing array and then bypass the owner boundary.
  freezeCanonicalFeedFlowSnapshot(normalizedSnapshot);
  normalizedFeedFlowSnapshots.add(normalizedSnapshot);
  return normalizedSnapshot;
}

export function isNormalizedFeedFlowSnapshot(snapshot) {
  return !!snapshot
    && typeof snapshot === 'object'
    && normalizedFeedFlowSnapshots.has(snapshot);
}

export function cloneFeedFlowSnapshot(snapshot = null) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return {
    ...snapshot,
    confidence: Math.max(0, Number(snapshot.confidence) || 0),
    detectorConfidence: Math.max(0, Number(snapshot.detectorConfidence) || 0),
    loopScore: Math.max(0, Number(snapshot.loopScore) || 0),
    directTriggers: Array.isArray(snapshot.directTriggers) ? [...snapshot.directTriggers] : [],
    pressureSignals: Array.isArray(snapshot.pressureSignals) ? [...snapshot.pressureSignals] : [],
    readiness: normalizeFeedReadiness(snapshot.readiness),
    actuationSafety: normalizeFeedActuationSafety(snapshot.actuationSafety),
    metrics: snapshot.metrics && typeof snapshot.metrics === 'object'
      ? { ...snapshot.metrics }
      : {},
    history: snapshot.history == null ? null : requireFeedContentFlowHistory(snapshot.history),
  };
}

export function buildFeedFlowSnapshot({
  host = '',
  snapshot = null,
} = {}) {
  return normalizeFeedFlowSnapshot(snapshot, { host });
}

export function buildFeedFlowSnapshotMessage(args = {}) {
  return {
    type: MESSAGE_TYPES.FEED_FLOW_SNAPSHOT_UPDATED,
    payload: {
      snapshot: buildFeedFlowSnapshot(args),
    },
  };
}

export function isFeedFlowSnapshotMessage(message) {
  return message?.type === MESSAGE_TYPES.FEED_FLOW_SNAPSHOT_UPDATED
    && !!message?.payload
    && typeof message.payload === 'object'
    && !!message.payload.snapshot
    && typeof message.payload.snapshot === 'object';
}
