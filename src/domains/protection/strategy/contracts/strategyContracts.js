import {
  PROTECTION_LEVELS,
  clampLaneIntensity,
  normalizeLaneState,
} from '../../contracts/protectionContracts.js';
import {
  RUNTIME_ARTIFACT_IDS,
  isRuntimeArtifactId,
} from '../../contracts/artifactIds.js';
import {
  requireBasicRecentUsageTrajectory,
  requireBasicTargetRecommendationForTrajectory,
} from './basicStrategyContextContract.js';

export const STRATEGY_STATES = Object.freeze([
  'observe',
  'guide',
  'constrain',
  'interrupt',
  'recover',
  'lock',
]);

export const STRATEGY_IDS = Object.freeze([
  'rewardSuppression',
  'paceControl',
  'sessionFracture',
  'shortFormShield',
  'recoveryRedirect',
  'hardStop',
]);

export const STRATEGY_RECOVERY_ACTIONS = Object.freeze([
  'none',
  'pause',
  'dashboard',
  'productiveSite',
  'reviewGoal',
]);

export const STRATEGY_LIFECYCLE_PHASES = Object.freeze([
  'stabilize',
]);

const STRATEGY_STATE_SET = new Set(STRATEGY_STATES);
const STRATEGY_ID_SET = new Set(STRATEGY_IDS);
const STRATEGY_RECOVERY_ACTION_SET = new Set(STRATEGY_RECOVERY_ACTIONS);
const STRATEGY_LIFECYCLE_PHASE_SET = new Set(STRATEGY_LIFECYCLE_PHASES);
const EFFECTIVE_TARGET_SOURCE_SET = new Set(['none', 'declared_target']);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function isStrategyState(value) {
  return typeof value === 'string' && STRATEGY_STATE_SET.has(value);
}

export function isStrategyId(value) {
  return typeof value === 'string' && STRATEGY_ID_SET.has(value);
}

export function normalizeStrategyState(value, fallback = 'observe') {
  const normalized = normalizeString(value, fallback);
  return isStrategyState(normalized) ? normalized : fallback;
}

export function normalizeStrategyRecoveryAction(value, fallback = 'none') {
  const normalized = normalizeString(value, fallback);
  return STRATEGY_RECOVERY_ACTION_SET.has(normalized) ? normalized : fallback;
}

function normalizeStrategyLifecyclePhase(value, fallback = 'stabilize') {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') {
    throw new Error(`STRATEGY_LIFECYCLE_PHASE_INVALID:${typeof value}`);
  }
  const normalized = normalizeString(value, fallback);
  if (!STRATEGY_LIFECYCLE_PHASE_SET.has(normalized)) {
    throw new Error(`STRATEGY_LIFECYCLE_PHASE_INVALID:${normalized}`);
  }
  return normalized;
}

function normalizeEffectiveTargetSource(value) {
  if (value === undefined || value === null || value === '') return 'none';
  const normalized = normalizeString(value);
  if (!EFFECTIVE_TARGET_SOURCE_SET.has(normalized)) {
    throw new Error(`STRATEGY_EFFECTIVE_TARGET_SOURCE_INVALID:${normalized}`);
  }
  return normalized;
}

function cloneRecentUsageTrajectory(value) {
  if (value === undefined || value === null) return null;
  const trajectory = requireBasicRecentUsageTrajectory(value);
  return {
    ...trajectory,
    provenance: { ...trajectory.provenance },
    window: { ...trajectory.window },
    evidence: { ...trajectory.evidence },
    observations: trajectory.observations.map((observation) => ({ ...observation })),
  };
}

function cloneTargetRecommendation(value, recentUsageTrajectory) {
  if (value === undefined || value === null) return null;
  return {
    ...requireBasicTargetRecommendationForTrajectory(value, recentUsageTrajectory),
  };
}

export function clampStrategyIntensity(value, fallback = 0) {
  const numeric = Math.round(normalizeFiniteNumber(value, fallback));
  return Math.max(0, Math.min(3, numeric));
}

export function normalizeStrategySet(values = []) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  values.forEach((value) => {
    if (isStrategyId(value)) unique.add(value);
  });
  return Array.from(unique);
}

export function normalizePreferredArtifactIds(values = []) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  values.forEach((value) => {
    if (isRuntimeArtifactId(value)) unique.add(value);
  });
  return RUNTIME_ARTIFACT_IDS.filter((artifactId) => unique.has(artifactId));
}

export function normalizeStrategyLevelLaneFloors(rawFloors = {}) {
  const source = isPlainObject(rawFloors) ? rawFloors : {};
  return PROTECTION_LEVELS.reduce((acc, level) => {
    const rawLevel = source[String(level)] || source[level];
    const laneState = normalizeLaneState(rawLevel);
    acc[String(level)] = {
      reward: clampLaneIntensity(laneState.reward, 0),
      pace: clampLaneIntensity(laneState.pace, 0),
      friction: clampLaneIntensity(laneState.friction, 0),
      advanced: 0,
    };
    return acc;
  }, {});
}

export function normalizeStrategyDecision(rawDecision = {}) {
  const source = isPlainObject(rawDecision) ? rawDecision : {};
  const recentUsageTrajectory = cloneRecentUsageTrajectory(source.recentUsageTrajectory);
  const targetRecommendation = cloneTargetRecommendation(
    source.targetRecommendation,
    recentUsageTrajectory,
  );
  return {
    state: normalizeStrategyState(source.state, 'observe'),
    lifecyclePhase: normalizeStrategyLifecyclePhase(source.lifecyclePhase, 'stabilize'),
    declaredTargetMinutes: Math.max(0, Math.floor(normalizeFiniteNumber(source.declaredTargetMinutes, 0))),
    recommendedTargetMinutes: Math.max(0, Math.floor(normalizeFiniteNumber(source.recommendedTargetMinutes, 0))),
    effectiveTargetMinutes: Math.max(0, Math.floor(normalizeFiniteNumber(source.effectiveTargetMinutes, 0))),
    effectiveTargetSource: normalizeEffectiveTargetSource(source.effectiveTargetSource),
    recentUsageTrajectory,
    targetRecommendation,
    intensity: clampStrategyIntensity(source.intensity, 0),
    strategySet: normalizeStrategySet(source.strategySet),
    levelLaneFloors: normalizeStrategyLevelLaneFloors(source.levelLaneFloors),
    preferredArtifactIds: normalizePreferredArtifactIds(source.preferredArtifactIds),
    recoveryAction: normalizeStrategyRecoveryAction(source.recoveryAction, 'none'),
    explanations: Array.isArray(source.explanations)
      ? source.explanations.filter((item) => typeof item === 'string' && item.trim().length > 0)
      : [],
    metrics: isPlainObject(source.metrics)
      ? {
        budgetPressure: Math.max(0, normalizeFiniteNumber(source.metrics.budgetPressure, 0)),
        patternPressure: Math.max(0, normalizeFiniteNumber(source.metrics.patternPressure, 0)),
        reentryPressure: Math.max(0, normalizeFiniteNumber(source.metrics.reentryPressure, 0)),
        exceededDaysInWindow: Math.max(0, Math.floor(normalizeFiniteNumber(source.metrics.exceededDaysInWindow, 0))),
      }
      : {
        budgetPressure: 0,
        patternPressure: 0,
        reentryPressure: 0,
        exceededDaysInWindow: 0,
      },
  };
}
