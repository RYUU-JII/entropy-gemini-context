import {
  PROGRESSION_CATALOG,
  PROGRESSION_CATALOG_BY_ID,
} from '../catalog/progressionCatalog.js';
import {
  PROGRESSION_EXPERIENCE_PRESENTATION_POLICY,
  resolveProgressionBonsaiGrowth,
} from '../policy/progressionPolicy.js';
import {
  PROGRESSION_CONDITION_TYPES,
  PROGRESSION_ENGINE_VERSION,
  PROGRESSION_FEATURE_KINDS,
  PROGRESSION_FEATURE_STATES,
  PROGRESSION_FIRST_VISION_STATES,
  PROGRESSION_MILESTONE_IDS,
  PROGRESSION_PHASES,
  PROGRESSION_SITE_SLOT_FEATURE_IDS,
  PROGRESSION_STATE_SCHEMA_VERSION,
} from '../contracts/progressionIds.js';
import { normalizeProgressionState } from './progressionSnapshot.js';
import { buildArtifactDisclosureSnapshot } from '../policy/artifactDisclosurePolicy.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toCount(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}

function toTimestamp(value, fallback = Date.now()) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}

function normalizeIdArray(value = []) {
  if (Array.isArray(value)) {
    return value
      .map((id) => (typeof id === 'string' ? id.trim() : ''))
      .filter(Boolean);
  }
  if (isPlainObject(value)) {
    return Object.entries(value)
      .filter(([, enabled]) => enabled === true)
      .map(([id]) => id.trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizeProgressionFacts(facts = {}, state = null) {
  const source = isPlainObject(facts) ? facts : {};
  const normalizedState = normalizeProgressionState(state);
  const dateCount = Object.keys(normalizedState.activeProtectionDateKeys || {}).length;
  return Object.freeze({
    nowMs: toTimestamp(source.nowMs, Date.now()),
    activeProtectedSiteCount: Math.max(
      normalizedState.counters.activeProtectedSiteCount,
      toCount(source.activeProtectedSiteCount, 0),
    ),
    queuedProtectedSiteCount: toCount(source.queuedProtectedSiteCount, 0),
    protectedVisitCount: Math.max(
      normalizedState.counters.protectedVisitCount,
      toCount(source.protectedVisitCount, 0),
    ),
    activeProtectedDayCount: Math.max(
      dateCount,
      toCount(source.activeProtectedDayCount, 0),
    ),
    qualifiedUseDayCount: normalizedState.artifactDisclosure.qualifiedActivityDayCount,
    frictionSuccessCount: Math.max(
      normalizedState.counters.frictionSuccessCount,
      toCount(source.frictionSuccessCount, 0),
    ),
    advancedMode: source.advancedMode === true,
    manualUnlockFeatureIds: normalizeIdArray(source.manualUnlockFeatureIds),
    grandfatheredFeatureIds: normalizeIdArray(source.grandfatheredFeatureIds),
  });
}

function createProgressionCatalogError(message, extra = {}) {
  const error = new Error(message);
  error.code = message;
  Object.assign(error, extra);
  return error;
}

function assertKnownFeatureId(featureId) {
  if (PROGRESSION_CATALOG_BY_ID[featureId]) return;
  throw createProgressionCatalogError('PROGRESSION_UNKNOWN_FEATURE_ID', { featureId });
}

export function assertProgressionCatalogValid(catalog = PROGRESSION_CATALOG) {
  const ids = new Set();
  (Array.isArray(catalog) ? catalog : []).forEach((entry) => {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) {
      throw createProgressionCatalogError('PROGRESSION_CATALOG_ENTRY_ID_REQUIRED');
    }
    if (ids.has(entry.id)) {
      throw createProgressionCatalogError('PROGRESSION_CATALOG_DUPLICATE_ID', { featureId: entry.id });
    }
    ids.add(entry.id);
    if ((entry.kind === PROGRESSION_FEATURE_KINDS.ARTIFACT_FAMILY
      || entry.kind === PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD)
      && (Object.hasOwn(entry, 'reveal') || Object.hasOwn(entry, 'unlock'))) {
      throw createProgressionCatalogError('PROGRESSION_ARTIFACT_DISCLOSURE_CONDITIONS_FORBIDDEN', {
        featureId: entry.id,
      });
    }
    [...(entry.reveal || []), ...(entry.unlock || [])].forEach((condition) => {
      const type = condition?.type;
      if (!Object.values(PROGRESSION_CONDITION_TYPES).includes(type)) {
        throw createProgressionCatalogError('PROGRESSION_UNKNOWN_CONDITION_TYPE', {
          featureId: entry.id,
          conditionType: type,
        });
      }
      if (type === PROGRESSION_CONDITION_TYPES.FEATURE_UNLOCKED) {
        assertKnownFeatureId(condition.featureId);
      }
    });
  });
}

function buildUnlockedSet(state, facts) {
  const unlocked = new Set([
    ...normalizeIdArray(state.manualUnlocks),
    ...normalizeIdArray(state.grandfatheredFeatureIds),
    ...facts.manualUnlockFeatureIds,
    ...facts.grandfatheredFeatureIds,
  ]);
  return unlocked;
}

function resolveCondition(condition = {}, context = {}) {
  const { facts, unlockedFeatureIds } = context;
  const count = toCount(condition.count, 0);
  switch (condition.type) {
    case PROGRESSION_CONDITION_TYPES.ALWAYS:
      return true;
    case PROGRESSION_CONDITION_TYPES.FIRST_VISION_SPENT:
      return context.firstVisionState === PROGRESSION_FIRST_VISION_STATES.SPENT;
    case PROGRESSION_CONDITION_TYPES.ACTIVE_PROTECTED_SITE_COUNT_AT_LEAST:
      return facts.activeProtectedSiteCount >= count;
    case PROGRESSION_CONDITION_TYPES.PROTECTED_VISIT_COUNT_AT_LEAST:
      return facts.protectedVisitCount >= count;
    case PROGRESSION_CONDITION_TYPES.ACTIVE_PROTECTED_DAY_COUNT_AT_LEAST:
      return facts.activeProtectedDayCount >= count;
    case PROGRESSION_CONDITION_TYPES.QUALIFIED_USE_DAY_COUNT_AT_LEAST:
      return facts.qualifiedUseDayCount >= count;
    case PROGRESSION_CONDITION_TYPES.FRICTION_SUCCESS_COUNT_AT_LEAST:
      return facts.frictionSuccessCount >= count;
    case PROGRESSION_CONDITION_TYPES.FEATURE_UNLOCKED:
      return unlockedFeatureIds.has(condition.featureId);
    case PROGRESSION_CONDITION_TYPES.ADVANCED_MODE:
      return facts.advancedMode === true;
    default:
      throw createProgressionCatalogError('PROGRESSION_UNKNOWN_CONDITION_TYPE', {
        conditionType: condition.type,
      });
  }
}

function resolveConditionList(conditions = [], context = {}) {
  return (Array.isArray(conditions) ? conditions : [])
    .every((condition) => resolveCondition(condition, context));
}

function buildFeatureState(entry, context) {
  if (
    entry.kind === PROGRESSION_FEATURE_KINDS.ARTIFACT_FAMILY
    || entry.kind === PROGRESSION_FEATURE_KINDS.ARTIFACT_CHILD
  ) {
    const familyId = typeof entry.metadata?.artifactId === 'string'
      ? entry.metadata.artifactId
      : '';
    const disclosure = context.artifactDisclosure.entriesByFamilyId[familyId];
    if (!disclosure) {
      throw createProgressionCatalogError('PROGRESSION_ARTIFACT_FAMILY_DISCLOSURE_REQUIRED', {
        featureId: entry.id,
        familyId,
      });
    }
    const visible = disclosure.visible === true;
    const configurable = disclosure.configurable === true;
    const runtime = disclosure.runtimeEligible === true;
    return Object.freeze({
      id: entry.id,
      kind: entry.kind,
      state: configurable
        ? PROGRESSION_FEATURE_STATES.UNLOCKED
        : (visible ? PROGRESSION_FEATURE_STATES.REVEALED : PROGRESSION_FEATURE_STATES.HIDDEN),
      visible,
      discoverable: visible,
      configurable,
      runtime,
      stage: toCount(entry.stage, 0),
      order: toCount(entry.order, 0),
      metadata: Object.freeze({ ...(entry.metadata || {}) }),
      manualOverride: disclosure.reason === 'manual_unlock',
      disclosure,
    });
  }
  const manuallyUnlocked = context.unlockedFeatureIds.has(entry.id);
  const unlocked = manuallyUnlocked || resolveConditionList(entry.unlock, context);
  const revealed = unlocked || resolveConditionList(entry.reveal, context);
  const state = unlocked
    ? PROGRESSION_FEATURE_STATES.UNLOCKED
    : (revealed ? PROGRESSION_FEATURE_STATES.REVEALED : PROGRESSION_FEATURE_STATES.HIDDEN);
  const visible = state !== PROGRESSION_FEATURE_STATES.HIDDEN;
  const configurable = state === PROGRESSION_FEATURE_STATES.UNLOCKED;
  return Object.freeze({
    id: entry.id,
    kind: entry.kind,
    state,
    visible,
    discoverable: visible,
    configurable,
    runtime: configurable,
    stage: toCount(entry.stage, 0),
    order: toCount(entry.order, 0),
    metadata: Object.freeze({ ...(entry.metadata || {}) }),
    manualOverride: manuallyUnlocked,
  });
}

function resolvePhase({ state, features }) {
  if (state.firstVision.state !== PROGRESSION_FIRST_VISION_STATES.SPENT) {
    return PROGRESSION_PHASES.FIRST_VISION;
  }
  const slot2 = features[PROGRESSION_SITE_SLOT_FEATURE_IDS[1]];
  if (!slot2 || slot2.state !== PROGRESSION_FEATURE_STATES.UNLOCKED) {
    return PROGRESSION_PHASES.SEEDLING_REALITY;
  }
  return PROGRESSION_PHASES.CULTIVATION;
}

function resolveSiteBudget(artifactDisclosure) {
  return Object.freeze({
    siteRegistrationBudget: artifactDisclosure.unlockProgress.siteRegistrationBudget,
    representedSiteLimit: artifactDisclosure.unlockProgress.representedSiteLimit,
  });
}

function resolveExperiencePresentation(phase) {
  return phase === PROGRESSION_PHASES.FIRST_VISION
    ? PROGRESSION_EXPERIENCE_PRESENTATION_POLICY.firstVision
    : PROGRESSION_EXPERIENCE_PRESENTATION_POLICY.seedlingReality;
}

export function evaluateProgressionSnapshot({
  state = null,
  facts = {},
  catalog = PROGRESSION_CATALOG,
} = {}) {
  assertProgressionCatalogValid(catalog);
  const normalizedState = normalizeProgressionState(state);
  const normalizedFacts = normalizeProgressionFacts(facts, normalizedState);
  const artifactDisclosure = buildArtifactDisclosureSnapshot(
    normalizedState.artifactDisclosure,
    { stateUpdatedAtMs: normalizedState.updatedAtMs,
      canonicalFirstVisionSpent: normalizedState.firstVision.state === PROGRESSION_FIRST_VISION_STATES.SPENT,
      bonsaiFirstBloomOpened: normalizedState.completedMilestoneIds[
        PROGRESSION_MILESTONE_IDS.BONSAI_FIRST_BLOOM_OPENED
      ] === true },
  );
  const unlockedFeatureIds = buildUnlockedSet(normalizedState, normalizedFacts);
  const context = {
    facts: normalizedFacts,
    firstVisionState: normalizedState.firstVision.state,
    unlockedFeatureIds,
    artifactDisclosure,
  };
  const features = Object.freeze(
    catalog.reduce((acc, entry) => {
      acc[entry.id] = buildFeatureState(entry, context);
      if (acc[entry.id].state === PROGRESSION_FEATURE_STATES.UNLOCKED) {
        unlockedFeatureIds.add(entry.id);
      }
      return acc;
    }, {}),
  );

  const phase = resolvePhase({ state: normalizedState, features });
  return Object.freeze({
    schemaVersion: PROGRESSION_STATE_SCHEMA_VERSION,
    engineVersion: PROGRESSION_ENGINE_VERSION,
    evaluatedAtMs: normalizedFacts.nowMs,
    phase,
    firstVision: normalizedState.firstVision,
    artifactDisclosure,
    budgets: resolveSiteBudget(artifactDisclosure),
    facts: normalizedFacts,
    bonsaiGrowth: resolveProgressionBonsaiGrowth(normalizedFacts),
    presentation: Object.freeze({
      experience: resolveExperiencePresentation(phase),
    }),
    features,
    diagnostics: Object.freeze([]),
  });
}

export function buildDegradedProgressionSnapshot({
  state = null,
  facts = {},
  diagnostics = [],
  nowMs = Date.now(),
} = {}) {
  const normalizedState = normalizeProgressionState(state, { nowMs });
  const normalizedFacts = normalizeProgressionFacts({ ...facts, nowMs }, normalizedState);
  const artifactDisclosure = buildArtifactDisclosureSnapshot(
    normalizedState.artifactDisclosure,
    { stateUpdatedAtMs: normalizedState.updatedAtMs,
      canonicalFirstVisionSpent: normalizedState.firstVision.state === PROGRESSION_FIRST_VISION_STATES.SPENT,
      bonsaiFirstBloomOpened: normalizedState.completedMilestoneIds[
        PROGRESSION_MILESTONE_IDS.BONSAI_FIRST_BLOOM_OPENED
      ] === true },
  );
  const features = Object.freeze(
    PROGRESSION_CATALOG.reduce((acc, entry) => {
      const familyId = typeof entry.metadata?.artifactId === 'string'
        ? entry.metadata.artifactId
        : '';
      const durableArtifactDisclosure = familyId
        ? artifactDisclosure.entriesByFamilyId[familyId]?.disclosed === true
        : null;
      const isInitial = durableArtifactDisclosure === null
        ? entry.stage <= 1
        : durableArtifactDisclosure;
      const featureState = isInitial
        ? PROGRESSION_FEATURE_STATES.UNLOCKED
        : PROGRESSION_FEATURE_STATES.HIDDEN;
      acc[entry.id] = Object.freeze({
        id: entry.id,
        kind: entry.kind,
        state: featureState,
        visible: isInitial,
        discoverable: isInitial,
        configurable: isInitial,
        runtime: isInitial,
        stage: toCount(entry.stage, 0),
        order: toCount(entry.order, 0),
        metadata: Object.freeze({ ...(entry.metadata || {}) }),
        manualOverride: false,
      });
      return acc;
    }, {}),
  );
  const phase = normalizedState.firstVision.state === PROGRESSION_FIRST_VISION_STATES.SPENT
    ? PROGRESSION_PHASES.SEEDLING_REALITY
    : PROGRESSION_PHASES.FIRST_VISION;
  return Object.freeze({
    schemaVersion: PROGRESSION_STATE_SCHEMA_VERSION,
    engineVersion: PROGRESSION_ENGINE_VERSION,
    evaluatedAtMs: normalizedFacts.nowMs,
    phase,
    firstVision: normalizedState.firstVision,
    artifactDisclosure,
    budgets: resolveSiteBudget(artifactDisclosure),
    facts: normalizedFacts,
    bonsaiGrowth: resolveProgressionBonsaiGrowth(normalizedFacts),
    presentation: Object.freeze({
      experience: resolveExperiencePresentation(phase),
    }),
    features,
    diagnostics: Object.freeze(
      (Array.isArray(diagnostics) ? diagnostics : []).map((diagnostic) => Object.freeze({
        code: typeof diagnostic?.code === 'string' ? diagnostic.code : 'PROGRESSION_DEGRADED',
        message: typeof diagnostic?.message === 'string' ? diagnostic.message : '',
      })),
    ),
  });
}

export function getProgressionFeatureAccess(snapshot = null, featureId = '') {
  const id = typeof featureId === 'string' ? featureId.trim() : '';
  const feature = snapshot?.features?.[id];
  if (!feature) {
    assertKnownFeatureId(id);
  }
  return feature;
}

export function getProgressionArtifactAccess(snapshot = null, artifactId = '') {
  const id = typeof artifactId === 'string' ? artifactId.trim() : '';
  if (!id) return Object.freeze({ visible: false, configurable: false, runtime: false, children: Object.freeze({}) });
  const children = {};
  let visible = false;
  let configurable = false;
  let runtime = false;
  Object.values(snapshot?.features || {}).forEach((feature) => {
    if (feature?.metadata?.artifactId !== id) return;
    visible = visible || feature.visible === true;
    configurable = configurable || feature.configurable === true;
    runtime = runtime || feature.runtime === true;
    if (feature.metadata.childId) {
      children[feature.metadata.childId] = feature;
    }
  });
  return Object.freeze({
    visible,
    configurable,
    runtime,
    children: Object.freeze(children),
  });
}

export function getProgressionProtectedSiteAdmission(snapshot = null, {
  activeProtectedSiteCount = 0,
} = {}) {
  const budget = snapshot?.budgets?.siteRegistrationBudget;
  if (!budget || !['limited', 'unlimited'].includes(budget.mode)
    || !Number.isInteger(activeProtectedSiteCount) || activeProtectedSiteCount < 0) {
    throw new Error('PROGRESSION_SITE_REGISTRATION_SNAPSHOT_REQUIRED');
  }
  return Object.freeze({
    allowed: budget.mode === 'unlimited' || activeProtectedSiteCount < budget.limit,
    activeProtectedSiteCount,
    siteRegistrationBudget: budget,
    representedSiteLimit: snapshot.budgets.representedSiteLimit,
  });
}
