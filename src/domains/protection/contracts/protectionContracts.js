import { RUNTIME_ARTIFACT_IDS, isRuntimeArtifactId } from './artifactIds.js';
import { LANE_IDS } from './laneIds.js';

export const PROTECTION_POSTURES = Object.freeze(['gentle', 'balanced', 'strict']);
export const PROTECTION_LEVELS = Object.freeze([1, 2, 3, 4, 5]);
export const LANE_INTENSITIES = Object.freeze([0, 1, 2, 3]);
export const PRESSURE_SIGNALS = Object.freeze([
  'LONG_SESSION',
  'HIGH_CONTEXT_SWITCH',
  'HIGH_SCROLL_VELOCITY',
  'CLSE_AGITATION',
  'FEED_FLOW_PRESSURE',
  'REENTRY_AFTER_BLOCK',
]);
export const DIRECT_TRIGGERS = Object.freeze([
  'SHORT_FORM_ENTRY',
  'VIDEO_SEEK_ABUSE',
  'ISOLATION_SESSION_ACTIVE',
  'GLOBAL_PROTOCOL_LOCK',
  'BUDGET_NEAR_EXHAUSTED',
  'BUDGET_EXCEEDED',
  'ENTRY_CHECKPOINT_REQUIRED',
  'RETURN_GUARD_REQUIRED',
  'DETOUR_SPREAD_DETECTED',
  'PROTECTED_TAB_CLUSTER',
  'PROTECTED_CONTEXT_CONSUMED',
  'RAPID_RETURN',
  'SESSION_END',
  'SITE_EXIT',
]);
export const ARTIFACT_STATES = Object.freeze(['disabled', 'armed', 'engaged', 'cleanup']);
export const DEFAULT_PROTECTION_POSTURE = 'balanced';
export const DEFAULT_PROTECTION_LEVEL = 1;
export const DEFAULT_LANE_INTENSITY = 0;

const PRESSURE_SIGNAL_SET = new Set(PRESSURE_SIGNALS);
const DIRECT_TRIGGER_SET = new Set(DIRECT_TRIGGERS);
const ARTIFACT_STATE_SET = new Set(ARTIFACT_STATES);
const ARTIFACT_PREFERENCE_KEYS = new Set(['enabled', 'autoTrigger']);
const INTERVENTION_PLAN_STATE_KEYS = new Set(['level', 'reasons']);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireKnownObjectKeys(source, allowedKeys, errorCode) {
  const unknownKey = Object.keys(source).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    throw new Error(`${errorCode}:${unknownKey}`);
  }
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function isProtectionPosture(value) {
  return typeof value === 'string' && PROTECTION_POSTURES.includes(value);
}

export function normalizeProtectionPosture(value, fallback = DEFAULT_PROTECTION_POSTURE) {
  const normalized = normalizeString(value, fallback);
  return isProtectionPosture(normalized) ? normalized : fallback;
}

export function clampLevel(value, fallback = DEFAULT_PROTECTION_LEVEL) {
  const numeric = Math.round(normalizeFiniteNumber(value, fallback));
  return Math.max(1, Math.min(5, numeric));
}

export function clampLaneIntensity(value, fallback = DEFAULT_LANE_INTENSITY) {
  const numeric = Math.round(normalizeFiniteNumber(value, fallback));
  return Math.max(0, Math.min(3, numeric));
}

export function isPressureSignal(value) {
  return typeof value === 'string' && PRESSURE_SIGNAL_SET.has(value);
}

export function isDirectTrigger(value) {
  return typeof value === 'string' && DIRECT_TRIGGER_SET.has(value);
}

export function normalizePressureSignals(values = []) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  values.forEach((value) => {
    if (isPressureSignal(value)) unique.add(value);
  });
  return Array.from(unique);
}

export function normalizeDirectTriggers(values = []) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  values.forEach((value) => {
    if (isDirectTrigger(value)) unique.add(value);
  });
  return Array.from(unique);
}

export function isArtifactState(value) {
  return typeof value === 'string' && ARTIFACT_STATE_SET.has(value);
}

export function normalizeArtifactState(value, fallback = 'disabled') {
  const normalized = normalizeString(value, fallback);
  return isArtifactState(normalized) ? normalized : fallback;
}

export function normalizeArtifactPreference(value) {
  const source = isPlainObject(value) ? value : {};
  requireKnownObjectKeys(
    source,
    ARTIFACT_PREFERENCE_KEYS,
    'PROTECTION_ARTIFACT_PREFERENCE_FIELD_INVALID',
  );
  return {
    enabled: normalizeBoolean(source.enabled, false),
    autoTrigger: normalizeBoolean(source.autoTrigger, true),
  };
}

function normalizeProtectionLevelLaneMap(rawLaneMap) {
  const source = isPlainObject(rawLaneMap) ? rawLaneMap : {};
  return PROTECTION_LEVELS.reduce((acc, level) => {
    acc[String(level)] = normalizeLaneState(source[String(level)] || source[level]);
    return acc;
  }, {});
}

export function normalizeProtectionProfile(rawProfile) {
  const source = isPlainObject(rawProfile) ? rawProfile : {};
  const rawBudgets = isPlainObject(source.budgets) ? source.budgets : {};
  const budgets = Object.entries(rawBudgets).reduce((acc, [host, entry]) => {
    const normalizedHost = normalizeString(host, '');
    if (!normalizedHost) return acc;
    const dailyMinutes = Math.max(0, Math.floor(normalizeFiniteNumber(entry?.dailyMinutes, 0)));
    acc[normalizedHost] = { dailyMinutes };
    return acc;
  }, {});

  const rawArtifacts = isPlainObject(source.artifacts) ? source.artifacts : {};
  const artifacts = RUNTIME_ARTIFACT_IDS.reduce((acc, artifactId) => {
    acc[artifactId] = normalizeArtifactPreference(rawArtifacts[artifactId]);
    return acc;
  }, {});

  return {
    posture: normalizeProtectionPosture(source.posture),
    budgets,
    artifacts,
    levelLanes: normalizeProtectionLevelLaneMap(source.levelLanes || source.lanes),
  };
}

export function normalizeLaneState(rawLaneState) {
  const source = isPlainObject(rawLaneState) ? rawLaneState : {};
  return LANE_IDS.reduce((acc, laneId) => {
    acc[laneId] = clampLaneIntensity(source[laneId], DEFAULT_LANE_INTENSITY);
    return acc;
  }, {});
}

export function normalizeArtifactStateMap(rawArtifactStateMap) {
  const source = isPlainObject(rawArtifactStateMap) ? rawArtifactStateMap : {};
  return RUNTIME_ARTIFACT_IDS.reduce((acc, artifactId) => {
    acc[artifactId] = normalizeArtifactState(source[artifactId], 'disabled');
    return acc;
  }, {});
}

export function normalizeObservation(rawObservation) {
  const source = isPlainObject(rawObservation) ? rawObservation : {};
  const host = normalizeString(source.host, '');
  const tabIdValue = Math.floor(normalizeFiniteNumber(source.tabId, -1));
  return {
    host,
    tabId: tabIdValue >= 0 ? tabIdValue : -1,
    now: normalizeFiniteNumber(source.now, Date.now()),
    siteDayMs: Math.max(0, normalizeFiniteNumber(source.siteDayMs, 0)),
    sessionMs: Math.max(0, normalizeFiniteNumber(source.sessionMs, 0)),
    budgetRatio: Math.max(0, normalizeFiniteNumber(source.budgetRatio, 0)),
    pressureSignals: normalizePressureSignals(source.pressureSignals),
    directTriggers: normalizeDirectTriggers(source.directTriggers),
  };
}

export function buildEmptyInterventionPlan() {
  return {
    state: {
      level: DEFAULT_PROTECTION_LEVEL,
      reasons: [],
    },
    lanes: normalizeLaneState({}),
    filterPlan: {},
    artifacts: normalizeArtifactStateMap({}),
    trace: {
      budgetRatio: 0,
      pressureSignals: [],
      directTriggers: [],
    },
  };
}

export function normalizeInterventionPlan(rawPlan) {
  const source = isPlainObject(rawPlan) ? rawPlan : {};
  const state = isPlainObject(source.state) ? source.state : {};
  const trace = isPlainObject(source.trace) ? source.trace : {};
  requireKnownObjectKeys(
    state,
    INTERVENTION_PLAN_STATE_KEYS,
    'PROTECTION_PLAN_STATE_FIELD_INVALID',
  );

  return {
    state: {
      level: clampLevel(state.level, DEFAULT_PROTECTION_LEVEL),
      reasons: Array.isArray(state.reasons)
        ? state.reasons.filter((item) => typeof item === 'string' && item.trim().length > 0)
        : [],
    },
    lanes: normalizeLaneState(source.lanes),
    filterPlan: isPlainObject(source.filterPlan) ? { ...source.filterPlan } : {},
    artifacts: normalizeArtifactStateMap(source.artifacts),
    trace: {
      budgetRatio: Math.max(0, normalizeFiniteNumber(trace.budgetRatio, 0)),
      pressureSignals: normalizePressureSignals(trace.pressureSignals),
      directTriggers: normalizeDirectTriggers(trace.directTriggers),
    },
  };
}

export function hasActiveArtifactStates(artifactStateMap) {
  if (!isPlainObject(artifactStateMap)) return false;
  return Object.values(artifactStateMap).some((state) => state === 'armed' || state === 'engaged');
}

export function isManagedArtifactPreferenceMap(value) {
  if (!isPlainObject(value)) return false;
  return Object.keys(value).every((artifactId) => isRuntimeArtifactId(artifactId));
}
