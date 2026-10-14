import {
  attachProgressionUnlockSnapshot,
} from './progressionUnlockPolicy.js';
import {
  PROGRESSION_ARTIFACT_ACCESS_MODE,
  resolveProgressionArtifactAccess,
} from './progressionArtifactAccessPolicy.js';
import {
  PROGRESSION_JOURNEY_FAMILY_ORDER,
  PROGRESSION_JOURNEY_STARTER_FAMILY_IDS,
  resolveProgressionJourneyFamilyIds,
  resolveProgressionFamilyUnlockDay,
} from './progressionJourneyPolicy.js';

// The first public baseline owns this exact current shape, independent of
// pre-release iterations. Incompatible presence is rejected, never converted.
export const ARTIFACT_DISCLOSURE_POLICY_VERSION = 1;

export const ARTIFACT_DISCLOSURE_FAMILY_ORDER = PROGRESSION_JOURNEY_FAMILY_ORDER;

export const ARTIFACT_DISCLOSURE_INITIAL_FAMILY_ID = PROGRESSION_JOURNEY_STARTER_FAMILY_IDS[0];

export const ARTIFACT_DISCLOSURE_REASONS = Object.freeze({
  FIRST_VISION_SPENT: 'first_vision_spent',
  ACTIVITY_DAY: 'activity_day',
  GRANDFATHERED: 'grandfathered',
  MANUAL_UNLOCK: 'manual_unlock',
});

export const ARTIFACT_DISCLOSURE_ACTIVITY_RESULTS = Object.freeze({
  ADVANCED: 'advanced',
  QUALIFIED_PENDING_FIRST_VISION: 'qualified_pending_first_vision',
  DUPLICATE_DAY: 'duplicate_day',
  STALE_DAY: 'stale_day',
});

const FAMILY_ID_SET = new Set(ARTIFACT_DISCLOSURE_FAMILY_ORDER);
const DISCLOSURE_REASON_SET = new Set(Object.values(ARTIFACT_DISCLOSURE_REASONS));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function createArtifactDisclosureContractError(field) {
  const error = new Error(`ARTIFACT_DISCLOSURE_STATE_CONTRACT_INVALID:${field}`);
  error.code = 'ARTIFACT_DISCLOSURE_STATE_CONTRACT_INVALID';
  error.field = field;
  return error;
}

function requireExactKeys(value, keys, field) {
  if (!isPlainObject(value)) throw createArtifactDisclosureContractError(field);
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== keys.length
    || keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw createArtifactDisclosureContractError(field);
  }
}

function requireNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw createArtifactDisclosureContractError(field);
  }
  return value;
}

function normalizeTimestamp(value, field) {
  return requireNonNegativeInteger(value, field);
}

export function normalizeArtifactDisclosureActivityDayKey(value, {
  allowEmpty = false,
} = {}) {
  if (allowEmpty && value === '') return '';
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    : null;
  if (!match) {
    throw createArtifactDisclosureContractError('activityDayKey');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw createArtifactDisclosureContractError('activityDayKey');
  }
  return value;
}

export function isArtifactDisclosureFamilyId(value) {
  return typeof value === 'string' && FAMILY_ID_SET.has(value);
}

function normalizeDisclosureEntry(value, familyId) {
  requireExactKeys(
    value,
    ['disclosedAtMs', 'reason', 'activityDayKey'],
    `disclosedByFamilyId.${familyId}`,
  );
  const reason = typeof value.reason === 'string' ? value.reason : '';
  if (!DISCLOSURE_REASON_SET.has(reason)) {
    throw createArtifactDisclosureContractError(`disclosedByFamilyId.${familyId}.reason`);
  }
  const activityDayKey = normalizeArtifactDisclosureActivityDayKey(value.activityDayKey, {
    allowEmpty: true,
  });
  if (
    reason === ARTIFACT_DISCLOSURE_REASONS.ACTIVITY_DAY
    && activityDayKey === ''
  ) {
    throw createArtifactDisclosureContractError(
      `disclosedByFamilyId.${familyId}.activityDayKey`,
    );
  }
  return Object.freeze({
    disclosedAtMs: normalizeTimestamp(
      value.disclosedAtMs,
      `disclosedByFamilyId.${familyId}.disclosedAtMs`,
    ),
    reason,
    activityDayKey,
  });
}

function normalizeDisclosedByFamilyId(value) {
  if (!isPlainObject(value)) {
    throw createArtifactDisclosureContractError('disclosedByFamilyId');
  }
  return Object.freeze(Object.entries(value).reduce((acc, [familyId, entry]) => {
    if (!isArtifactDisclosureFamilyId(familyId)) {
      throw createArtifactDisclosureContractError(`disclosedByFamilyId.${familyId}`);
    }
    acc[familyId] = normalizeDisclosureEntry(entry, familyId);
    return acc;
  }, {}));
}

export function buildDefaultArtifactDisclosureState() {
  return Object.freeze({
    policyVersion: ARTIFACT_DISCLOSURE_POLICY_VERSION,
    qualifiedActivityDayCount: 0,
    lastProcessedActivityDayKey: '',
    disclosedByFamilyId: Object.freeze({}),
  });
}

export function normalizeArtifactDisclosureState(value = null) {
  if (value === null || typeof value === 'undefined') {
    return buildDefaultArtifactDisclosureState();
  }
  requireExactKeys(value, [
    'policyVersion',
    'qualifiedActivityDayCount',
    'lastProcessedActivityDayKey',
    'disclosedByFamilyId',
  ], 'artifactDisclosure');
  if (value.policyVersion !== ARTIFACT_DISCLOSURE_POLICY_VERSION) {
    throw createArtifactDisclosureContractError('policyVersion');
  }
  const qualifiedActivityDayCount = requireNonNegativeInteger(
    value.qualifiedActivityDayCount,
    'qualifiedActivityDayCount',
  );
  const lastProcessedActivityDayKey = normalizeArtifactDisclosureActivityDayKey(
    value.lastProcessedActivityDayKey,
    { allowEmpty: true },
  );
  if (
    (qualifiedActivityDayCount === 0) !== (lastProcessedActivityDayKey === '')
  ) {
    throw createArtifactDisclosureContractError('activityDayProgress');
  }
  return Object.freeze({
    policyVersion: ARTIFACT_DISCLOSURE_POLICY_VERSION,
    qualifiedActivityDayCount,
    lastProcessedActivityDayKey,
    disclosedByFamilyId: normalizeDisclosedByFamilyId(value.disclosedByFamilyId),
  });
}

function discloseFamily(state, familyId, {
  atMs,
  reason,
  activityDayKey = '',
} = {}) {
  if (!isArtifactDisclosureFamilyId(familyId)) {
    throw createArtifactDisclosureContractError('familyId');
  }
  if (state.disclosedByFamilyId[familyId]) return state;
  return normalizeArtifactDisclosureState({
    ...state,
    disclosedByFamilyId: {
      ...state.disclosedByFamilyId,
      [familyId]: {
        disclosedAtMs: normalizeTimestamp(atMs, 'disclosedAtMs'),
        reason,
        activityDayKey,
      },
    },
  });
}

export function discloseInitialArtifactFamily(currentState = null, {
  atMs = Date.now(),
} = {}) {
  const state = normalizeArtifactDisclosureState(currentState);
  return PROGRESSION_JOURNEY_STARTER_FAMILY_IDS.reduce((next, familyId) => discloseFamily(next, familyId, {
    atMs, reason: ARTIFACT_DISCLOSURE_REASONS.FIRST_VISION_SPENT,
  }), state);
}

export function discloseArtifactFamiliesForQualifiedUseDays(currentState = null, {
  atMs = Date.now(),
  activityDayKey = '',
} = {}) {
  const state = normalizeArtifactDisclosureState(currentState);
  const timestamp = normalizeTimestamp(atMs, 'atMs');
  const targetFamilyIds = resolveProgressionJourneyFamilyIds(state.qualifiedActivityDayCount, {
    firstVisionSpent: true,
  });
  const activityFamilyIds = targetFamilyIds.filter((familyId) => !PROGRESSION_JOURNEY_STARTER_FAMILY_IDS.includes(familyId));
  const normalizedActivityDayKey = activityFamilyIds.length > 0
    ? normalizeArtifactDisclosureActivityDayKey(
      activityDayKey || state.lastProcessedActivityDayKey,
    )
    : '';
  let next = discloseInitialArtifactFamily(state, { atMs: timestamp });
  activityFamilyIds
    .forEach((familyId) => {
      next = discloseFamily(next, familyId, {
        atMs: timestamp,
        reason: ARTIFACT_DISCLOSURE_REASONS.ACTIVITY_DAY,
        activityDayKey: normalizedActivityDayKey,
      });
    });
  return next;
}

export function resolveNextArtifactDisclosureFamilyId(currentState = null) {
  const state = normalizeArtifactDisclosureState(currentState);
  return ARTIFACT_DISCLOSURE_FAMILY_ORDER.find(
    (familyId) => !state.disclosedByFamilyId[familyId],
  ) || '';
}

export function advanceArtifactDisclosureForActivityDay(currentState = null, {
  activityDayKey,
  atMs = Date.now(),
  firstVisionSpent = false,
} = {}) {
  const state = normalizeArtifactDisclosureState(currentState);
  const normalizedActivityDayKey = normalizeArtifactDisclosureActivityDayKey(activityDayKey);
  const timestamp = normalizeTimestamp(atMs, 'atMs');

  if (state.lastProcessedActivityDayKey === normalizedActivityDayKey) {
    return Object.freeze({
      state,
      result: ARTIFACT_DISCLOSURE_ACTIVITY_RESULTS.DUPLICATE_DAY,
      newlyGrantedFamilyIds: Object.freeze([]),
    });
  }
  if (
    state.lastProcessedActivityDayKey
    && normalizedActivityDayKey < state.lastProcessedActivityDayKey
  ) {
    return Object.freeze({
      state,
      result: ARTIFACT_DISCLOSURE_ACTIVITY_RESULTS.STALE_DAY,
      newlyGrantedFamilyIds: Object.freeze([]),
    });
  }

  const qualifiedActivityDayCount = state.qualifiedActivityDayCount + 1;
  let next = normalizeArtifactDisclosureState({
    ...state,
    qualifiedActivityDayCount,
    lastProcessedActivityDayKey: normalizedActivityDayKey,
  });
  let newlyGrantedFamilyIds = [];
  if (firstVisionSpent === true) {
    const previousDisclosedFamilyIdSet = new Set(Object.keys(next.disclosedByFamilyId));
    next = discloseArtifactFamiliesForQualifiedUseDays(next, {
      atMs: timestamp,
      activityDayKey: normalizedActivityDayKey,
    });
    newlyGrantedFamilyIds = ARTIFACT_DISCLOSURE_FAMILY_ORDER.filter((familyId) => (
      !previousDisclosedFamilyIdSet.has(familyId) && next.disclosedByFamilyId[familyId]
    ));
  }

  return Object.freeze({
    state: next,
    result: firstVisionSpent === true
      ? ARTIFACT_DISCLOSURE_ACTIVITY_RESULTS.ADVANCED
      : ARTIFACT_DISCLOSURE_ACTIVITY_RESULTS.QUALIFIED_PENDING_FIRST_VISION,
    newlyGrantedFamilyIds: Object.freeze(newlyGrantedFamilyIds),
  });
}

export function grandfatherArtifactDisclosureFamilies(currentState = null, {
  familyIds = [],
  atMs = Date.now(),
  reason = ARTIFACT_DISCLOSURE_REASONS.GRANDFATHERED,
} = {}) {
  if (
    reason !== ARTIFACT_DISCLOSURE_REASONS.GRANDFATHERED
    && reason !== ARTIFACT_DISCLOSURE_REASONS.MANUAL_UNLOCK
  ) {
    throw createArtifactDisclosureContractError('grandfather.reason');
  }
  if (!Array.isArray(familyIds)) {
    throw createArtifactDisclosureContractError('grandfather.familyIds');
  }
  const timestamp = normalizeTimestamp(atMs, 'atMs');
  const normalizedFamilyIds = Array.from(new Set(
    familyIds.map((familyId) => {
      if (!isArtifactDisclosureFamilyId(familyId)) {
        throw createArtifactDisclosureContractError('grandfather.familyId');
      }
      return familyId;
    }),
  ));
  return normalizedFamilyIds.reduce((state, familyId) => discloseFamily(state, familyId, {
    atMs: timestamp,
    reason,
  }), normalizeArtifactDisclosureState(currentState));
}

export function resolveArtifactDisclosureFamilyIdFromFeatureId(featureId) {
  if (typeof featureId !== 'string') return '';
  const match = /^artifact\.([^.]+)(?:\.|$)/.exec(featureId);
  const familyId = match?.[1] || '';
  return isArtifactDisclosureFamilyId(familyId) ? familyId : '';
}

export function buildArtifactDisclosureSnapshot(currentState = null, {
  diagnostics = [],
  stateUpdatedAtMs = 0,
  bonsaiFirstBloomOpened = false,
  canonicalFirstVisionSpent = false,
} = {}) {
  if (typeof bonsaiFirstBloomOpened !== 'boolean') {
    throw new Error('BONSAI_FIRST_BLOOM_OPENED_REQUIRED');
  }
  if (typeof canonicalFirstVisionSpent !== 'boolean') {
    throw new Error('CANONICAL_FIRST_VISION_SPENT_REQUIRED');
  }
  const state = normalizeArtifactDisclosureState(currentState);
  const disclosedFamilyIds = ARTIFACT_DISCLOSURE_FAMILY_ORDER.filter(
    (familyId) => !!state.disclosedByFamilyId[familyId],
  );
  const nextFamilyId = resolveNextArtifactDisclosureFamilyId(state);
  const entries = ARTIFACT_DISCLOSURE_FAMILY_ORDER.map((familyId, index) => {
    const disclosure = state.disclosedByFamilyId[familyId] || null;
    const disclosed = !!disclosure;
    const access = resolveProgressionArtifactAccess(disclosed, {
      accessMode: PROGRESSION_ARTIFACT_ACCESS_MODE,
    });
    return Object.freeze({
      familyId,
      position: index + 1,
      unlockDay: resolveProgressionFamilyUnlockDay(familyId),
      catalogued: true,
      disclosed,
      ...access,
      next: familyId === nextFamilyId,
      disclosedAtMs: disclosure?.disclosedAtMs || 0,
      reason: disclosure?.reason || '',
      activityDayKey: disclosure?.activityDayKey || '',
    });
  });

  return attachProgressionUnlockSnapshot(Object.freeze({
    policyVersion: ARTIFACT_DISCLOSURE_POLICY_VERSION,
    accessMode: PROGRESSION_ARTIFACT_ACCESS_MODE,
    orderedFamilyIds: ARTIFACT_DISCLOSURE_FAMILY_ORDER,
    disclosedFamilyIds: Object.freeze(disclosedFamilyIds),
    nextFamilyId,
    qualifiedActivityDayCount: state.qualifiedActivityDayCount,
    lastProcessedActivityDayKey: state.lastProcessedActivityDayKey,
    stateUpdatedAtMs: normalizeTimestamp(stateUpdatedAtMs, 'stateUpdatedAtMs'),
    bonsaiFirstBloomOpened,
    canonicalFirstVisionSpent,
    entries: Object.freeze(entries),
    entriesByFamilyId: Object.freeze(entries.reduce((acc, entry) => {
      acc[entry.familyId] = entry;
      return acc;
    }, {})),
    diagnostics: Object.freeze((Array.isArray(diagnostics) ? diagnostics : []).map((entry) => (
      Object.freeze({
        code: typeof entry?.code === 'string' ? entry.code : 'ARTIFACT_DISCLOSURE_DIAGNOSTIC',
        message: typeof entry?.message === 'string' ? entry.message : '',
      })
    ))),
  }));
}
