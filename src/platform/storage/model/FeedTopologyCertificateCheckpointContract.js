import {
  requireModelStateProfileEpochId,
} from './ProfileEpochContract.js';

export const FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY = (
  'feed_topology_certificate_checkpoint_v1'
);
export const FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_CONTRACT = (
  'feed_topology_certificate_checkpoint_v1'
);
export const FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_SCHEMA_VERSION = 1;
export const FEED_LOCAL_TOPOLOGY_DESCRIPTOR_CONTRACT = 'feed_local_topology_descriptor_v1';
export const FEED_TOPOLOGY_CERTIFICATE_PERSISTENCE = 'indexeddb_checkpoint';

export const FEED_TOPOLOGY_CERTIFICATE_POLICY = Object.freeze({
  evidenceHalfLifeMs: 14 * 24 * 60 * 60 * 1000,
  certificateTtlMs: 30 * 24 * 60 * 60 * 1000,
  minimumObservationCount: 3,
  minimumObservationDayCount: 2,
  minimumEffectiveEvidence: 2.4,
  maximumEffectiveEvidence: 64,
  surfaceLimit: 32,
  observationDayRetention: 16,
});

export const FEED_TOPOLOGY_CERTIFICATE_STATES = Object.freeze({
  LEARNING: 'learning',
  CERTIFIED: 'certified',
  INVALIDATED: 'invalidated',
  EXPIRED: 'expired',
});

const STORED_CERTIFICATE_STATES = new Set([
  FEED_TOPOLOGY_CERTIFICATE_STATES.LEARNING,
  FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED,
  FEED_TOPOLOGY_CERTIFICATE_STATES.INVALIDATED,
]);
const SURFACE_MODES = new Set(['continuous', 'paged']);
const CAPABILITIES = new Set(['anchored_continuous', 'paged_hold']);
const LANE_LAYOUTS = new Set(['block_stack', 'flex_column']);
const SCROLLER_KINDS = new Set(['root', 'element']);
const SCROLL_SNAP_AXES = new Set(['none', 'y']);
const BRANCH_SNAP_ALIGNS = new Set(['none', 'start', 'center', 'end']);
const BOUNDARY_BASES = new Set(['anchor_branch_edge', 'next_containment_start']);
const ISOLATION_LAYOUTS = new Set(['preserve', 'collapse']);
const TAIL_LAYOUTS = new Set(['flow']);
const MUTATION_MODES = new Set(['sibling_inert_isolation']);
const CANDIDATE_CARDINALITIES = new Set(['one_per_branch']);
const CONTENT_FREE_CODE_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const HOSTNAME_PATTERN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

const CHECKPOINT_KEYS = Object.freeze([
  'contract',
  'schemaVersion',
  'profileEpoch',
  'stateRevision',
  'createdAt',
  'updatedAt',
  'surfaces',
]);
const CERTIFICATE_KEYS = Object.freeze([
  'key',
  'surface',
  'status',
  'certificateRevision',
  'fingerprint',
  'descriptor',
  'observationCount',
  'effectiveEvidence',
  'observationDays',
  'recentObservationIds',
  'firstObservedAt',
  'lastObservedAt',
  'decayEvaluatedAt',
  'certifiedAt',
  'expiresAt',
  'lastInvalidatedAt',
  'invalidationCount',
]);
const SURFACE_KEYS = Object.freeze([
  'hostname',
  'profileId',
  'semanticSurfaceId',
  'surfaceMode',
  'contentClass',
]);
const DESCRIPTOR_KEYS = Object.freeze([
  'contract',
  'surfaceMode',
  'capability',
  'candidateDepth',
  'laneLayout',
  'scrollerKind',
  'scrollSnapAxis',
  'branchScrollSnapAlign',
  'boundaryBasis',
  'mutationMode',
  'isolationLayout',
  'tailLayout',
  'candidateCardinality',
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

function requireFiniteRange(value, minimum, maximum, errorCode) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) {
    throw new Error(errorCode);
  }
  return numeric;
}

function requireCode(value, errorCode) {
  if (
    typeof value !== 'string'
    || value !== value.trim()
    || !CONTENT_FREE_CODE_PATTERN.test(value)
  ) {
    throw new Error(errorCode);
  }
  return value.toLowerCase();
}

function requireEnum(value, allowed, errorCode) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new Error(`${errorCode}:${String(value || '')}`);
  }
  return value;
}

export function normalizeFeedTopologyCertificateSurface(surface) {
  const source = requireExactObject(
    surface,
    SURFACE_KEYS,
    'FEED_TOPOLOGY_CERTIFICATE_SURFACE_INVALID',
  );
  const hostname = typeof source.hostname === 'string'
    ? source.hostname.trim().toLowerCase()
    : '';
  if (!HOSTNAME_PATTERN.test(hostname)) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_HOSTNAME_INVALID');
  }
  const surfaceMode = requireEnum(
    source.surfaceMode,
    SURFACE_MODES,
    'FEED_TOPOLOGY_CERTIFICATE_SURFACE_MODE_INVALID',
  );
  return Object.freeze({
    hostname,
    profileId: requireCode(
      source.profileId,
      'FEED_TOPOLOGY_CERTIFICATE_PROFILE_ID_INVALID',
    ),
    semanticSurfaceId: requireCode(
      source.semanticSurfaceId,
      'FEED_TOPOLOGY_CERTIFICATE_SEMANTIC_SURFACE_ID_INVALID',
    ),
    surfaceMode,
    contentClass: requireCode(
      source.contentClass,
      'FEED_TOPOLOGY_CERTIFICATE_CONTENT_CLASS_INVALID',
    ),
  });
}

export function buildFeedTopologyCertificateSurfaceKey(surface) {
  const normalized = normalizeFeedTopologyCertificateSurface(surface);
  return [
    normalized.hostname,
    normalized.profileId,
    normalized.semanticSurfaceId,
    normalized.surfaceMode,
    normalized.contentClass,
  ].join('|');
}

export function normalizeFeedLocalTopologyDescriptor(descriptor) {
  const source = requireExactObject(
    descriptor,
    DESCRIPTOR_KEYS,
    'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_INVALID',
  );
  if (source.contract !== FEED_LOCAL_TOPOLOGY_DESCRIPTOR_CONTRACT) {
    throw new Error('FEED_LOCAL_TOPOLOGY_DESCRIPTOR_CONTRACT_INVALID');
  }
  const surfaceMode = requireEnum(
    source.surfaceMode,
    SURFACE_MODES,
    'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_SURFACE_MODE_INVALID',
  );
  const capability = requireEnum(
    source.capability,
    CAPABILITIES,
    'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_CAPABILITY_INVALID',
  );
  const candidateDepth = requireNonNegativeInteger(
    source.candidateDepth,
    'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_CANDIDATE_DEPTH_INVALID',
  );
  if (candidateDepth > 8) {
    throw new Error('FEED_LOCAL_TOPOLOGY_DESCRIPTOR_CANDIDATE_DEPTH_INVALID');
  }
  const normalized = {
    contract: FEED_LOCAL_TOPOLOGY_DESCRIPTOR_CONTRACT,
    surfaceMode,
    capability,
    candidateDepth,
    laneLayout: requireEnum(
      source.laneLayout,
      LANE_LAYOUTS,
      'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_LANE_LAYOUT_INVALID',
    ),
    scrollerKind: requireEnum(
      source.scrollerKind,
      SCROLLER_KINDS,
      'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_SCROLLER_KIND_INVALID',
    ),
    scrollSnapAxis: requireEnum(
      source.scrollSnapAxis,
      SCROLL_SNAP_AXES,
      'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_SCROLL_SNAP_AXIS_INVALID',
    ),
    branchScrollSnapAlign: requireEnum(
      source.branchScrollSnapAlign,
      BRANCH_SNAP_ALIGNS,
      'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_BRANCH_SNAP_ALIGN_INVALID',
    ),
    boundaryBasis: requireEnum(
      source.boundaryBasis,
      BOUNDARY_BASES,
      'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_BOUNDARY_BASIS_INVALID',
    ),
    mutationMode: requireEnum(
      source.mutationMode,
      MUTATION_MODES,
      'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_MUTATION_MODE_INVALID',
    ),
    isolationLayout: requireEnum(
      source.isolationLayout,
      ISOLATION_LAYOUTS,
      'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_ISOLATION_LAYOUT_INVALID',
    ),
    tailLayout: requireEnum(
      source.tailLayout,
      TAIL_LAYOUTS,
      'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_TAIL_LAYOUT_INVALID',
    ),
    candidateCardinality: requireEnum(
      source.candidateCardinality,
      CANDIDATE_CARDINALITIES,
      'FEED_LOCAL_TOPOLOGY_DESCRIPTOR_CANDIDATE_CARDINALITY_INVALID',
    ),
  };
  if (
    (
      surfaceMode === 'continuous'
      && (
        capability !== 'anchored_continuous'
        || normalized.scrollSnapAxis !== 'none'
        || normalized.branchScrollSnapAlign !== 'none'
        || normalized.boundaryBasis !== 'anchor_branch_edge'
        || normalized.isolationLayout !== 'preserve'
      )
    )
    || (
      surfaceMode === 'paged'
      && (
        capability !== 'paged_hold'
        || normalized.scrollSnapAxis !== 'y'
        || normalized.branchScrollSnapAlign === 'none'
        || normalized.boundaryBasis !== 'next_containment_start'
        || normalized.isolationLayout !== 'collapse'
      )
    )
  ) {
    throw new Error('FEED_LOCAL_TOPOLOGY_DESCRIPTOR_MODE_INVARIANT_INVALID');
  }
  return Object.freeze(normalized);
}

export function buildFeedLocalTopologyFingerprint(descriptor) {
  const normalized = normalizeFeedLocalTopologyDescriptor(descriptor);
  return [
    'lft1',
    normalized.surfaceMode,
    normalized.capability,
    normalized.candidateDepth,
    normalized.laneLayout,
    normalized.scrollerKind,
    normalized.scrollSnapAxis,
    normalized.branchScrollSnapAlign,
    normalized.boundaryBasis,
    normalized.mutationMode,
    normalized.isolationLayout,
    normalized.tailLayout,
    normalized.candidateCardinality,
  ].join(':');
}

export function requireFeedLocalTopologyFingerprint(value, descriptor) {
  const fingerprint = requireCode(
    value,
    'FEED_LOCAL_TOPOLOGY_FINGERPRINT_INVALID',
  );
  if (fingerprint !== buildFeedLocalTopologyFingerprint(descriptor)) {
    throw new Error('FEED_LOCAL_TOPOLOGY_FINGERPRINT_MISMATCH');
  }
  return fingerprint;
}

function normalizeObservationDays(values, lastObservedAt) {
  if (
    !Array.isArray(values)
    || values.length < 1
    || values.length > FEED_TOPOLOGY_CERTIFICATE_POLICY.observationDayRetention
  ) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_OBSERVATION_DAYS_INVALID');
  }
  const days = values.map((value) => requireNonNegativeInteger(
    value,
    'FEED_TOPOLOGY_CERTIFICATE_OBSERVATION_DAY_INVALID',
  ));
  if (
    days.some((value, index) => index > 0 && value <= days[index - 1])
    || days.at(-1) !== Math.floor(lastObservedAt / 86_400_000)
  ) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_OBSERVATION_DAYS_INVALID');
  }
  return Object.freeze(days);
}

function normalizeRecentObservationIds(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 16) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_OBSERVATION_IDS_INVALID');
  }
  const ids = values.map((value) => requireCode(
    value,
    'FEED_TOPOLOGY_CERTIFICATE_OBSERVATION_ID_INVALID',
  ));
  if (new Set(ids).size !== ids.length) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_OBSERVATION_IDS_INVALID');
  }
  return Object.freeze(ids);
}

export function requireFeedTopologyCertificate(value) {
  const source = requireExactObject(
    value,
    CERTIFICATE_KEYS,
    'FEED_TOPOLOGY_CERTIFICATE_INVALID',
  );
  const surface = normalizeFeedTopologyCertificateSurface(source.surface);
  const key = buildFeedTopologyCertificateSurfaceKey(surface);
  if (source.key !== key) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_KEY_MISMATCH');
  }
  const status = requireEnum(
    source.status,
    STORED_CERTIFICATE_STATES,
    'FEED_TOPOLOGY_CERTIFICATE_STATUS_INVALID',
  );
  const certificateRevision = requireNonNegativeInteger(
    source.certificateRevision,
    'FEED_TOPOLOGY_CERTIFICATE_REVISION_INVALID',
  );
  const descriptor = normalizeFeedLocalTopologyDescriptor(source.descriptor);
  if (descriptor.surfaceMode !== surface.surfaceMode) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_DESCRIPTOR_SURFACE_MISMATCH');
  }
  const fingerprint = requireFeedLocalTopologyFingerprint(
    source.fingerprint,
    descriptor,
  );
  const observationCount = requireNonNegativeInteger(
    source.observationCount,
    'FEED_TOPOLOGY_CERTIFICATE_OBSERVATION_COUNT_INVALID',
  );
  if (observationCount < 1) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_OBSERVATION_COUNT_INVALID');
  }
  const effectiveEvidence = requireFiniteRange(
    source.effectiveEvidence,
    0,
    FEED_TOPOLOGY_CERTIFICATE_POLICY.maximumEffectiveEvidence,
    'FEED_TOPOLOGY_CERTIFICATE_EVIDENCE_INVALID',
  );
  const firstObservedAt = requireTimestamp(
    source.firstObservedAt,
    'FEED_TOPOLOGY_CERTIFICATE_FIRST_OBSERVED_INVALID',
  );
  const lastObservedAt = requireTimestamp(
    source.lastObservedAt,
    'FEED_TOPOLOGY_CERTIFICATE_LAST_OBSERVED_INVALID',
  );
  const decayEvaluatedAt = requireTimestamp(
    source.decayEvaluatedAt,
    'FEED_TOPOLOGY_CERTIFICATE_DECAY_EVALUATED_INVALID',
  );
  const certifiedAt = requireTimestamp(
    source.certifiedAt,
    'FEED_TOPOLOGY_CERTIFICATE_CERTIFIED_AT_INVALID',
  );
  const expiresAt = requireTimestamp(
    source.expiresAt,
    'FEED_TOPOLOGY_CERTIFICATE_EXPIRES_AT_INVALID',
  );
  const lastInvalidatedAt = requireTimestamp(
    source.lastInvalidatedAt,
    'FEED_TOPOLOGY_CERTIFICATE_LAST_INVALIDATED_INVALID',
  );
  const invalidationCount = requireNonNegativeInteger(
    source.invalidationCount,
    'FEED_TOPOLOGY_CERTIFICATE_INVALIDATION_COUNT_INVALID',
  );
  if (
    firstObservedAt > lastObservedAt
    || lastObservedAt > decayEvaluatedAt
    || (
      status === FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED
      && (
        certifiedAt < firstObservedAt
        || certifiedAt > lastObservedAt
        || expiresAt !== (
          lastObservedAt + FEED_TOPOLOGY_CERTIFICATE_POLICY.certificateTtlMs
        )
        || observationCount < FEED_TOPOLOGY_CERTIFICATE_POLICY.minimumObservationCount
        || effectiveEvidence < FEED_TOPOLOGY_CERTIFICATE_POLICY.minimumEffectiveEvidence
      )
    )
    || (
      status !== FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED
      && certifiedAt !== 0
    )
    || (
      status === FEED_TOPOLOGY_CERTIFICATE_STATES.INVALIDATED
      && (
        effectiveEvidence !== 0
        || expiresAt !== 0
        || lastInvalidatedAt < lastObservedAt
        || invalidationCount < 1
      )
    )
    || (
      status === FEED_TOPOLOGY_CERTIFICATE_STATES.LEARNING
      && (
        expiresAt !== 0
        || lastInvalidatedAt > lastObservedAt
      )
    )
  ) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_STATE_INVARIANT_INVALID');
  }
  const observationDays = normalizeObservationDays(
    source.observationDays,
    lastObservedAt,
  );
  const recentObservationIds = normalizeRecentObservationIds(
    source.recentObservationIds,
  );
  if (
    status === FEED_TOPOLOGY_CERTIFICATE_STATES.CERTIFIED
    && observationDays.length
      < FEED_TOPOLOGY_CERTIFICATE_POLICY.minimumObservationDayCount
  ) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_DAY_EVIDENCE_INVALID');
  }
  return Object.freeze({
    key,
    surface,
    status,
    certificateRevision,
    fingerprint,
    descriptor,
    observationCount,
    effectiveEvidence,
    observationDays,
    recentObservationIds,
    firstObservedAt,
    lastObservedAt,
    decayEvaluatedAt,
    certifiedAt,
    expiresAt,
    lastInvalidatedAt,
    invalidationCount,
  });
}

export function requireFeedTopologyCertificateCheckpoint(
  value,
  { expectedProfileEpoch = null } = {},
) {
  const source = requireExactObject(
    value,
    CHECKPOINT_KEYS,
    'FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_INVALID',
  );
  if (source.contract !== FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_CONTRACT) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_CONTRACT_INVALID');
  }
  if (source.schemaVersion !== FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_SCHEMA_VERSION) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_SCHEMA_INVALID');
  }
  const profileEpoch = requireModelStateProfileEpochId(
    source.profileEpoch,
    'FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_EPOCH_INVALID',
  );
  if (expectedProfileEpoch !== null && profileEpoch !== expectedProfileEpoch) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_EPOCH_MISMATCH');
  }
  const stateRevision = requireNonNegativeInteger(
    source.stateRevision,
    'FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_REVISION_INVALID',
  );
  const createdAt = requireTimestamp(
    source.createdAt,
    'FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_CREATED_AT_INVALID',
  );
  const updatedAt = requireTimestamp(
    source.updatedAt,
    'FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_UPDATED_AT_INVALID',
  );
  if (
    createdAt > updatedAt
    || !Array.isArray(source.surfaces)
    || source.surfaces.length < 1
    || source.surfaces.length > FEED_TOPOLOGY_CERTIFICATE_POLICY.surfaceLimit
  ) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_SURFACES_INVALID');
  }
  const surfaces = source.surfaces.map((entry) => requireFeedTopologyCertificate(entry));
  const keys = surfaces.map((entry) => entry.key);
  if (
    new Set(keys).size !== keys.length
    || keys.some((key, index) => index > 0 && key <= keys[index - 1])
    || surfaces.some((entry) => entry.lastObservedAt > updatedAt)
  ) {
    throw new Error('FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_SURFACE_ORDER_INVALID');
  }
  return Object.freeze({
    contract: FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_CONTRACT,
    schemaVersion: FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_SCHEMA_VERSION,
    profileEpoch,
    stateRevision,
    createdAt,
    updatedAt,
    surfaces: Object.freeze(surfaces),
  });
}

export function rebaseFeedTopologyCertificateCheckpoint(
  checkpoint,
  targetProfileEpoch,
) {
  const normalized = requireFeedTopologyCertificateCheckpoint(checkpoint);
  const profileEpoch = requireModelStateProfileEpochId(
    targetProfileEpoch,
    'FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_REBASE_EPOCH_INVALID',
  );
  return requireFeedTopologyCertificateCheckpoint({
    ...normalized,
    profileEpoch,
    surfaces: normalized.surfaces.map((entry) => ({
      ...entry,
      surface: { ...entry.surface },
      descriptor: { ...entry.descriptor },
      observationDays: [...entry.observationDays],
      recentObservationIds: [...entry.recentObservationIds],
    })),
  }, { expectedProfileEpoch: profileEpoch });
}

export function isFeedTopologyCertificateCheckpointKey(key) {
  return key === FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY;
}
