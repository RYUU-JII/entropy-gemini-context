import {
  PROGRESSION_EVENT_TYPES,
  PROGRESSION_FIRST_VISION_STATES,
  PROGRESSION_STATE_SCHEMA_VERSION,
  isProgressionFeatureId,
} from '../contracts/progressionIds.js';
import {
  ARTIFACT_DISCLOSURE_ACTIVITY_RESULTS,
  ARTIFACT_DISCLOSURE_INITIAL_FAMILY_ID,
  ARTIFACT_DISCLOSURE_REASONS,
  advanceArtifactDisclosureForActivityDay,
  buildDefaultArtifactDisclosureState,
  discloseArtifactFamiliesForQualifiedUseDays,
  discloseInitialArtifactFamily,
  grandfatherArtifactDisclosureFamilies,
  normalizeArtifactDisclosureState,
  resolveArtifactDisclosureFamilyIdFromFeatureId,
} from '../policy/artifactDisclosurePolicy.js';
import { resolveProgressionJourneyFamilyIds } from '../policy/progressionJourneyPolicy.js';

const MAX_TRACKED_DATE_KEYS = 180;
const MAX_TRACKED_IDS = 512;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toTimestamp(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}

function toCount(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}

function createProgressionContractError(field) {
  const error = new Error(`PROGRESSION_STATE_CONTRACT_INVALID:${field}`);
  error.code = 'PROGRESSION_STATE_CONTRACT_INVALID';
  error.field = field;
  return error;
}

function requireExactKeys(value, keys, field) {
  if (!isPlainObject(value)) throw createProgressionContractError(field);
  const actualKeys = Object.keys(value);
  if (
    actualKeys.length !== keys.length
    || keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw createProgressionContractError(field);
  }
}

function requireNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw createProgressionContractError(field);
  }
  return value;
}

function normalizeIdSet(value = {}, { allowUnknown = false } = {}) {
  if (!isPlainObject(value)) throw createProgressionContractError('idSet');
  const source = value;
  if (Object.keys(source).length > MAX_TRACKED_IDS) {
    throw createProgressionContractError('idSet.size');
  }

  return Object.freeze(
    Object.entries(source).reduce((acc, [id, enabled]) => {
      const normalizedId = typeof id === 'string' ? id.trim() : '';
      if (!normalizedId || normalizedId !== id || enabled !== true) {
        throw createProgressionContractError('idSet.entry');
      }
      if (!allowUnknown && !isProgressionFeatureId(normalizedId)) {
        throw createProgressionContractError('idSet.id');
      }
      acc[normalizedId] = true;
      return acc;
    }, {}),
  );
}

function normalizeDateKey(value) {
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    : null;
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? value
    : '';
}

function normalizeDateKeys(value = {}) {
  if (!isPlainObject(value)) throw createProgressionContractError('activeProtectionDateKeys');
  const source = value;
  if (Object.keys(source).length > MAX_TRACKED_DATE_KEYS) {
    throw createProgressionContractError('activeProtectionDateKeys.size');
  }

  return Object.freeze(
    Object.entries(source)
      .map(([key, enabled]) => {
        const normalizedKey = normalizeDateKey(key);
        if (!normalizedKey || normalizedKey !== key || enabled !== true) {
          throw createProgressionContractError('activeProtectionDateKeys.entry');
        }
        return [normalizedKey, true];
      })
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce((acc, [key]) => {
        acc[key] = true;
        return acc;
      }, {}),
  );
}

function addTrackedDateKey(source = {}, dateKey) {
  const retainedKeys = Array.from(new Set([
    ...Object.keys(source),
    dateKey,
  ]))
    .sort((left, right) => left.localeCompare(right))
    .slice(-MAX_TRACKED_DATE_KEYS);
  return normalizeDateKeys(Object.fromEntries(
    retainedKeys.map((key) => [key, true]),
  ));
}

function normalizeFirstVision(value = {}) {
  requireExactKeys(value, ['state', 'presentedAtMs', 'spentAtMs'], 'firstVision');
  const source = value;
  const stateValues = Object.values(PROGRESSION_FIRST_VISION_STATES);
  if (!stateValues.includes(source.state)) throw createProgressionContractError('firstVision.state');
  const state = source.state;
  const presentedAtMs = requireNonNegativeInteger(source.presentedAtMs, 'firstVision.presentedAtMs');
  const spentAtMs = requireNonNegativeInteger(source.spentAtMs, 'firstVision.spentAtMs');
  if (state === PROGRESSION_FIRST_VISION_STATES.PENDING && (presentedAtMs !== 0 || spentAtMs !== 0)) {
    throw createProgressionContractError('firstVision.pending');
  }
  if (state === PROGRESSION_FIRST_VISION_STATES.PRESENTED && (presentedAtMs === 0 || spentAtMs !== 0)) {
    throw createProgressionContractError('firstVision.presented');
  }
  if (state === PROGRESSION_FIRST_VISION_STATES.SPENT && (
    presentedAtMs === 0
    || spentAtMs < presentedAtMs
  )) {
    throw createProgressionContractError('firstVision.spent');
  }
  return Object.freeze({
    state,
    presentedAtMs,
    spentAtMs,
  });
}

function normalizeCounters(value = {}) {
  requireExactKeys(
    value,
    ['protectedVisitCount', 'frictionSuccessCount', 'activeProtectedSiteCount'],
    'counters',
  );
  const source = value;
  return Object.freeze({
    protectedVisitCount: requireNonNegativeInteger(source.protectedVisitCount, 'counters.protectedVisitCount'),
    frictionSuccessCount: requireNonNegativeInteger(source.frictionSuccessCount, 'counters.frictionSuccessCount'),
    activeProtectedSiteCount: requireNonNegativeInteger(source.activeProtectedSiteCount, 'counters.activeProtectedSiteCount'),
  });
}

export function buildDefaultProgressionState({ nowMs = Date.now() } = {}) {
  const timestamp = toTimestamp(nowMs, Date.now());
  return Object.freeze({
    schemaVersion: PROGRESSION_STATE_SCHEMA_VERSION,
    createdAtMs: timestamp,
    updatedAtMs: timestamp,
    firstVision: Object.freeze({
      state: PROGRESSION_FIRST_VISION_STATES.PENDING,
      presentedAtMs: 0,
      spentAtMs: 0,
    }),
    counters: Object.freeze({
      protectedVisitCount: 0,
      frictionSuccessCount: 0,
      activeProtectedSiteCount: 0,
    }),
    artifactDisclosure: buildDefaultArtifactDisclosureState(),
    activeProtectionDateKeys: Object.freeze({}),
    manualUnlocks: Object.freeze({}),
    grandfatheredFeatureIds: Object.freeze({}),
    completedMilestoneIds: Object.freeze({}),
  });
}

export function normalizeProgressionState(value = null, { nowMs = Date.now() } = {}) {
  if (value === null || typeof value === 'undefined') {
    return buildDefaultProgressionState({ nowMs });
  }
  if (!isPlainObject(value) || value.schemaVersion !== PROGRESSION_STATE_SCHEMA_VERSION) {
    throw createProgressionContractError('schemaVersion');
  }
  requireExactKeys(value, [
    'schemaVersion',
    'createdAtMs',
    'updatedAtMs',
    'firstVision',
    'counters',
    'artifactDisclosure',
    'activeProtectionDateKeys',
    'manualUnlocks',
    'grandfatheredFeatureIds',
    'completedMilestoneIds',
  ], 'state');
  const createdAtMs = requireNonNegativeInteger(value.createdAtMs, 'createdAtMs');
  const updatedAtMs = requireNonNegativeInteger(value.updatedAtMs, 'updatedAtMs');
  if (updatedAtMs < createdAtMs) throw createProgressionContractError('updatedAtMs');
  if (!isPlainObject(value.artifactDisclosure)) {
    throw createProgressionContractError('artifactDisclosure');
  }
  const firstVision = normalizeFirstVision(value.firstVision);
  const artifactDisclosure = normalizeArtifactDisclosureState(value.artifactDisclosure);
  if (
    firstVision.state === PROGRESSION_FIRST_VISION_STATES.SPENT
    && !artifactDisclosure.disclosedByFamilyId[ARTIFACT_DISCLOSURE_INITIAL_FAMILY_ID]
  ) {
    throw createProgressionContractError('firstVision.spentArtifactDisclosure');
  }
  if (firstVision.state === PROGRESSION_FIRST_VISION_STATES.SPENT) {
    const qualifiedFamilyPrefixComplete = resolveProgressionJourneyFamilyIds(
      artifactDisclosure.qualifiedActivityDayCount, { firstVisionSpent: true },
    )
      .every((familyId) => !!artifactDisclosure.disclosedByFamilyId[familyId]);
    if (!qualifiedFamilyPrefixComplete) {
      throw createProgressionContractError('artifactDisclosure.qualifiedUseFamilyPrefix');
    }
  }
  return Object.freeze({
    schemaVersion: PROGRESSION_STATE_SCHEMA_VERSION,
    createdAtMs,
    updatedAtMs,
    firstVision,
    counters: normalizeCounters(value.counters),
    artifactDisclosure,
    activeProtectionDateKeys: normalizeDateKeys(value.activeProtectionDateKeys),
    manualUnlocks: normalizeIdSet(value.manualUnlocks),
    grandfatheredFeatureIds: normalizeIdSet(value.grandfatheredFeatureIds),
    completedMilestoneIds: normalizeIdSet(value.completedMilestoneIds, { allowUnknown: true }),
  });
}

export function resetProgressionFirstVisionState(currentState = null, { nowMs = Date.now() } = {}) {
  const timestamp = toTimestamp(nowMs, Date.now());
  const state = normalizeProgressionState(currentState, { nowMs: timestamp });
  const updatedAtMs = Math.max(state.updatedAtMs, timestamp);
  return normalizeProgressionState({
    ...state,
    updatedAtMs,
    firstVision: {
      state: PROGRESSION_FIRST_VISION_STATES.PENDING,
      presentedAtMs: 0,
      spentAtMs: 0,
    },
  }, { nowMs: updatedAtMs });
}

function mergeCounter(currentCounters, patch = {}) {
  return normalizeCounters({
    ...currentCounters,
    ...patch,
  });
}

function addId(source = {}, id, { allowUnknown = false } = {}) {
  const normalizedId = typeof id === 'string' ? id.trim() : '';
  if (!normalizedId || normalizedId !== id) throw createProgressionContractError('event.id');
  if (!allowUnknown && !isProgressionFeatureId(normalizedId)) {
    throw createProgressionContractError('event.featureId');
  }
  return normalizeIdSet({
    ...source,
    [normalizedId]: true,
  }, { allowUnknown });
}

export function recordProgressionEvent(currentState = null, event = {}, { nowMs = Date.now() } = {}) {
  const state = normalizeProgressionState(currentState, { nowMs });
  const source = isPlainObject(event) ? event : {};
  const type = typeof source.type === 'string' ? source.type.trim() : '';
  const timestamp = toTimestamp(source.atMs, toTimestamp(nowMs, Date.now()));
  const updatedAtMs = Math.max(state.updatedAtMs, timestamp);

  if (!Object.values(PROGRESSION_EVENT_TYPES).includes(type)) {
    throw createProgressionContractError('event.type');
  }

  if (type === PROGRESSION_EVENT_TYPES.FIRST_VISION_PRESENTED) {
    const alreadySpent = state.firstVision.state === PROGRESSION_FIRST_VISION_STATES.SPENT;
    return normalizeProgressionState({
      ...state,
      updatedAtMs,
      firstVision: alreadySpent
        ? state.firstVision
        : {
          state: PROGRESSION_FIRST_VISION_STATES.PRESENTED,
          presentedAtMs: state.firstVision.presentedAtMs || updatedAtMs,
          spentAtMs: 0,
        },
    }, { nowMs: updatedAtMs });
  }

  if (type === PROGRESSION_EVENT_TYPES.FIRST_VISION_SPENT) {
    if (state.firstVision.state === PROGRESSION_FIRST_VISION_STATES.PENDING) {
      throw new Error('PROGRESSION_FIRST_VISION_SPENT_REQUIRES_PRESENTED');
    }
    const artifactDisclosure = discloseArtifactFamiliesForQualifiedUseDays(
      discloseInitialArtifactFamily(state.artifactDisclosure, {
        atMs: updatedAtMs,
      }),
      {
        atMs: updatedAtMs,
        activityDayKey: state.artifactDisclosure.lastProcessedActivityDayKey,
      },
    );
    return normalizeProgressionState({
      ...state,
      updatedAtMs,
      artifactDisclosure,
      firstVision: {
        state: PROGRESSION_FIRST_VISION_STATES.SPENT,
        presentedAtMs: state.firstVision.presentedAtMs || updatedAtMs,
        spentAtMs: state.firstVision.spentAtMs || updatedAtMs,
      },
    }, { nowMs: updatedAtMs });
  }

  if (type === PROGRESSION_EVENT_TYPES.PROTECTED_VISIT_RECORDED) {
    const increment = Math.max(1, toCount(source.count, 1));
    return normalizeProgressionState({
      ...state,
      updatedAtMs,
      counters: mergeCounter(state.counters, {
        protectedVisitCount: state.counters.protectedVisitCount + increment,
      }),
    }, { nowMs: updatedAtMs });
  }

  if (type === PROGRESSION_EVENT_TYPES.FRICTION_SUCCESS_RECORDED) {
    const increment = Math.max(1, toCount(source.count, 1));
    return normalizeProgressionState({
      ...state,
      updatedAtMs,
      counters: mergeCounter(state.counters, {
        frictionSuccessCount: state.counters.frictionSuccessCount + increment,
      }),
    }, { nowMs: updatedAtMs });
  }

  if (type === PROGRESSION_EVENT_TYPES.ACTIVE_PROTECTION_DAY_RECORDED) {
    const dateKey = normalizeDateKey(source.dateKey);
    if (!dateKey) throw createProgressionContractError('event.dateKey');
    const disclosureResult = advanceArtifactDisclosureForActivityDay(
      state.artifactDisclosure,
      {
        activityDayKey: dateKey,
        atMs: updatedAtMs,
        firstVisionSpent: state.firstVision.state === PROGRESSION_FIRST_VISION_STATES.SPENT,
      },
    );
    if (
      disclosureResult.result === ARTIFACT_DISCLOSURE_ACTIVITY_RESULTS.DUPLICATE_DAY
      || disclosureResult.result === ARTIFACT_DISCLOSURE_ACTIVITY_RESULTS.STALE_DAY
    ) {
      return state;
    }
    return normalizeProgressionState({
      ...state,
      updatedAtMs,
      artifactDisclosure: disclosureResult.state,
      activeProtectionDateKeys: addTrackedDateKey(state.activeProtectionDateKeys, dateKey),
    }, { nowMs: updatedAtMs });
  }

  if (type === PROGRESSION_EVENT_TYPES.FEATURE_MANUALLY_UNLOCKED) {
    const featureId = typeof source.featureId === 'string' ? source.featureId : '';
    const artifactFamilyId = resolveArtifactDisclosureFamilyIdFromFeatureId(featureId);
    return normalizeProgressionState({
      ...state,
      updatedAtMs,
      manualUnlocks: addId(state.manualUnlocks, featureId),
      artifactDisclosure: (
        artifactFamilyId
        && state.firstVision.state === PROGRESSION_FIRST_VISION_STATES.SPENT
      )
        ? grandfatherArtifactDisclosureFamilies(state.artifactDisclosure, {
          familyIds: [artifactFamilyId],
          atMs: updatedAtMs,
          reason: ARTIFACT_DISCLOSURE_REASONS.MANUAL_UNLOCK,
        })
        : state.artifactDisclosure,
    }, { nowMs: updatedAtMs });
  }

  if (type === PROGRESSION_EVENT_TYPES.FEATURE_GRANDFATHERED) {
    const featureId = typeof source.featureId === 'string' ? source.featureId : '';
    const artifactFamilyId = resolveArtifactDisclosureFamilyIdFromFeatureId(featureId);
    return normalizeProgressionState({
      ...state,
      updatedAtMs,
      grandfatheredFeatureIds: addId(state.grandfatheredFeatureIds, featureId),
      artifactDisclosure: (
        artifactFamilyId
        && state.firstVision.state === PROGRESSION_FIRST_VISION_STATES.SPENT
      )
        ? grandfatherArtifactDisclosureFamilies(state.artifactDisclosure, {
          familyIds: [artifactFamilyId],
          atMs: updatedAtMs,
        })
        : state.artifactDisclosure,
    }, { nowMs: updatedAtMs });
  }

  if (type === PROGRESSION_EVENT_TYPES.MILESTONE_COMPLETED) {
    return normalizeProgressionState({
      ...state,
      updatedAtMs,
      completedMilestoneIds: addId(state.completedMilestoneIds, source.milestoneId, {
        allowUnknown: true,
      }),
    }, { nowMs: updatedAtMs });
  }

  return state;
}
