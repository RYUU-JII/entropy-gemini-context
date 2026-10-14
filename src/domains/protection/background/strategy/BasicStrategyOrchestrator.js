import {
  normalizeObservation,
  normalizeProtectionProfile,
} from '../../contracts/protectionContracts.js';
import { PROTECTION_RUNTIME_ARTIFACT_IDS } from '../../contracts/artifactIds.js';
import {
  getBasicStrategyStateRecipe,
  getBasicStrategyThresholds,
} from '../../strategy/catalog/basicStrategyCatalog.js';
import {
  normalizeStrategyDecision,
} from '../../strategy/contracts/strategyContracts.js';
import {
  requireBasicRecentUsageTrajectory,
  requireBasicTargetRecommendationForTrajectory,
} from '../../strategy/contracts/basicStrategyContextContract.js';

const INTERRUPT_TRIGGER_SET = new Set([
  'SHORT_FORM_ENTRY',
  'VIDEO_SEEK_ABUSE',
]);

const RECOVERY_TRIGGER_SET = new Set([
  'SESSION_END',
  'SITE_EXIT',
]);

function hasDirectTrigger(observation, trigger) {
  return Array.isArray(observation?.directTriggers) && observation.directTriggers.includes(trigger);
}

function hasPressureSignal(observation, signal) {
  return Array.isArray(observation?.pressureSignals) && observation.pressureSignals.includes(signal);
}

function requireNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`BASIC_STRATEGY_CONTEXT_FIELD_INVALID:${field}`);
  }
  return value;
}

function normalizeStrategyContext(strategyContext = null) {
  if (strategyContext === null || strategyContext === undefined) {
    return {
      lifecyclePhase: 'stabilize',
      declaredTargetMinutes: 0,
      recommendedTargetMinutes: 0,
      effectiveTargetMinutes: 0,
      effectiveTargetSource: 'none',
      exceededDaysInWindow: 0,
      recentUsageTrajectory: null,
      targetRecommendation: null,
    };
  }
  if (typeof strategyContext !== 'object' || Array.isArray(strategyContext)) {
    throw new Error('BASIC_STRATEGY_CONTEXT_INVALID');
  }
  if (strategyContext.lifecyclePhase !== 'stabilize') {
    throw new Error('BASIC_STRATEGY_LIFECYCLE_PHASE_INVALID');
  }
  if (strategyContext.effectiveTargetSource !== 'declared_target') {
    throw new Error('BASIC_STRATEGY_EFFECTIVE_TARGET_SOURCE_INVALID');
  }
  const recentUsageTrajectory = requireBasicRecentUsageTrajectory(
    strategyContext.recentUsageTrajectory,
  );
  const targetRecommendation = requireBasicTargetRecommendationForTrajectory(
    strategyContext.targetRecommendation,
    recentUsageTrajectory,
  );
  const declaredTargetMinutes = requireNonNegativeInteger(
    strategyContext.declaredTargetMinutes,
    'declaredTargetMinutes',
  );
  const recommendedTargetMinutes = requireNonNegativeInteger(
    strategyContext.recommendedTargetMinutes,
    'recommendedTargetMinutes',
  );
  const effectiveTargetMinutes = requireNonNegativeInteger(
    strategyContext.effectiveTargetMinutes,
    'effectiveTargetMinutes',
  );
  const exceededDaysInWindow = requireNonNegativeInteger(
    strategyContext.exceededDaysInWindow,
    'exceededDaysInWindow',
  );
  if (effectiveTargetMinutes !== declaredTargetMinutes) {
    throw new Error('BASIC_STRATEGY_EFFECTIVE_TARGET_RELATION_INVALID');
  }
  if (recommendedTargetMinutes !== targetRecommendation.recommendedTargetMinutes) {
    throw new Error('BASIC_STRATEGY_RECOMMENDATION_RELATION_INVALID');
  }
  if (exceededDaysInWindow !== recentUsageTrajectory.evidence.exceededDays) {
    throw new Error('BASIC_STRATEGY_TRAJECTORY_EVIDENCE_RELATION_INVALID');
  }
  return {
    lifecyclePhase: 'stabilize',
    declaredTargetMinutes,
    recommendedTargetMinutes,
    effectiveTargetMinutes,
    effectiveTargetSource: 'declared_target',
    exceededDaysInWindow,
    recentUsageTrajectory,
    targetRecommendation,
  };
}

function computePatternPressure(observation) {
  let score = 0;
  if (hasDirectTrigger(observation, 'SHORT_FORM_ENTRY')) score += 1.4;
  if (hasDirectTrigger(observation, 'VIDEO_SEEK_ABUSE')) score += 1.2;
  score += Math.min(1.5, (observation?.pressureSignals?.length || 0) * 0.4);
  return Math.max(0, score);
}

function computeReentryPressure(observation) {
  return hasPressureSignal(observation, 'REENTRY_AFTER_BLOCK') ? 1 : 0;
}

function resolveStrategyState({
  observation,
  previousDecision = null,
  thresholds,
  patternPressure = 0,
  reentryPressure = 0,
} = {}) {
  const budgetPressure = Math.max(0, Number(observation?.budgetRatio) || 0);
  const hasBudgetExceeded = hasDirectTrigger(observation, 'BUDGET_EXCEEDED') || budgetPressure >= 1;

  const previousState = previousDecision?.state || 'observe';
  const shouldRecover = (previousState === 'interrupt' || previousState === 'lock')
    && observation.directTriggers.some((trigger) => RECOVERY_TRIGGER_SET.has(trigger));
  if (shouldRecover) return 'recover';

  const hasInterruptTrigger = observation.directTriggers.some((trigger) => INTERRUPT_TRIGGER_SET.has(trigger));
  if (hasInterruptTrigger || patternPressure >= thresholds.interruptPatternPressure) {
    return 'interrupt';
  }

  if (budgetPressure >= thresholds.constrainRatio || patternPressure >= 1.5 || reentryPressure > 0 || hasBudgetExceeded) {
    return 'constrain';
  }

  if (budgetPressure >= thresholds.guideRatio || patternPressure >= 0.6 || observation.pressureSignals.length > 0) {
    return 'guide';
  }

  return 'observe';
}

function resolveStrategyIntensity({ state, observation }) {
  const budgetPressure = Math.max(0, Number(observation?.budgetRatio) || 0);
  let intensity;
  switch (state) {
    case 'guide':
      intensity = budgetPressure >= 0.75 ? 2 : 1;
      break;
    case 'constrain':
      intensity = budgetPressure >= 0.9 ? 3 : 2;
      break;
    case 'interrupt':
      intensity = budgetPressure >= 0.9 ? 3 : 2;
      break;
    case 'recover':
      intensity = 1;
      break;
    case 'lock':
      intensity = 3;
      break;
    default:
      intensity = 0;
      break;
  }

  return intensity;
}

function resolvePreferredArtifactIds({ state, observation, profile }) {
  const preferred = [];
  const artifactPreferences = profile?.artifacts || {};
  const maybePush = (artifactId, predicate = true) => {
    if (!predicate) return;
    if (!artifactPreferences?.[artifactId]?.enabled) return;
    if (!preferred.includes(artifactId)) preferred.push(artifactId);
  };

  maybePush(
    PROTECTION_RUNTIME_ARTIFACT_IDS.SENTINEL_FLARE,
    state === 'constrain' || state === 'lock' || hasDirectTrigger(observation, 'BUDGET_NEAR_EXHAUSTED'),
  );
  maybePush(
    PROTECTION_RUNTIME_ARTIFACT_IDS.MEMORY_PURGE,
    state === 'recover' && observation.directTriggers.some((trigger) => RECOVERY_TRIGGER_SET.has(trigger)),
  );

  return preferred;
}

function buildExplanations({ state, observation, patternPressure, reentryPressure, strategyContext }) {
  const explanations = [state, `phase:${strategyContext.lifecyclePhase}`];
  const budgetPressure = Math.max(0, Number(observation?.budgetRatio) || 0);

  if (budgetPressure >= 1) {
    explanations.push('budget_exceeded');
  } else if (budgetPressure >= 0.85) explanations.push('budget_near_exhausted');
  else if (budgetPressure >= 0.5) explanations.push('budget_pressure_rising');

  if (patternPressure >= 1.5) explanations.push('pattern_pressure_elevated');
  if (reentryPressure > 0) explanations.push('reentry_pressure_detected');
  observation.directTriggers.forEach((trigger) => explanations.push(`trigger:${trigger.toLowerCase()}`));

  return Array.from(new Set(explanations));
}

export function createBasicStrategyOrchestrator() {
  function decide({
    profile = null,
    observation = null,
    previousDecision = null,
    strategyContext = null,
  } = {}) {
    const normalizedProfile = normalizeProtectionProfile(profile);
    const normalizedObservation = normalizeObservation(observation);
    const normalizedStrategyContext = normalizeStrategyContext(strategyContext);
    const thresholds = getBasicStrategyThresholds(normalizedProfile.posture);
    const patternPressure = computePatternPressure(normalizedObservation);
    const reentryPressure = computeReentryPressure(normalizedObservation);
    const state = resolveStrategyState({
      observation: normalizedObservation,
      previousDecision,
      thresholds,
      patternPressure,
      reentryPressure,
    });
    const intensity = resolveStrategyIntensity({
      state,
      observation: normalizedObservation,
    });
    const recipe = getBasicStrategyStateRecipe(state);

    return normalizeStrategyDecision({
      ...recipe,
      state,
      lifecyclePhase: normalizedStrategyContext.lifecyclePhase,
      declaredTargetMinutes: normalizedStrategyContext.declaredTargetMinutes,
      recommendedTargetMinutes: normalizedStrategyContext.recommendedTargetMinutes,
      effectiveTargetMinutes: normalizedStrategyContext.effectiveTargetMinutes,
      effectiveTargetSource: normalizedStrategyContext.effectiveTargetSource,
      recentUsageTrajectory: normalizedStrategyContext.recentUsageTrajectory,
      targetRecommendation: normalizedStrategyContext.targetRecommendation,
      intensity,
      preferredArtifactIds: resolvePreferredArtifactIds({
        state,
        observation: normalizedObservation,
        profile: normalizedProfile,
      }),
      explanations: buildExplanations({
        state,
        observation: normalizedObservation,
        patternPressure,
        reentryPressure,
        strategyContext: normalizedStrategyContext,
      }),
      metrics: {
        budgetPressure: normalizedObservation.budgetRatio,
        patternPressure,
        reentryPressure,
        exceededDaysInWindow: normalizedStrategyContext.exceededDaysInWindow,
      },
    });
  }

  return {
    decide,
  };
}
