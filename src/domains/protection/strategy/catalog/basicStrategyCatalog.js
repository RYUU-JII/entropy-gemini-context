import { normalizeProtectionPosture } from '../../contracts/protectionContracts.js';
import { normalizeStrategyDecision } from '../contracts/strategyContracts.js';

export const BASIC_STRATEGY_THRESHOLDS = Object.freeze({
  gentle: Object.freeze({ guideRatio: 0.58, constrainRatio: 0.86, interruptPatternPressure: 2.4 }),
  balanced: Object.freeze({ guideRatio: 0.48, constrainRatio: 0.76, interruptPatternPressure: 2.1 }),
  strict: Object.freeze({ guideRatio: 0.38, constrainRatio: 0.66, interruptPatternPressure: 1.8 }),
});

export const BASIC_STRATEGY_STATE_RECIPES = Object.freeze({
  observe: Object.freeze({
    strategySet: Object.freeze(['rewardSuppression']),
    recoveryAction: 'none',
    levelLaneFloors: Object.freeze({
      1: Object.freeze({ reward: 1, pace: 0, friction: 0, advanced: 0 }),
      2: Object.freeze({ reward: 2, pace: 1, friction: 0, advanced: 0 }),
      3: Object.freeze({ reward: 2, pace: 2, friction: 1, advanced: 0 }),
      4: Object.freeze({ reward: 3, pace: 3, friction: 2, advanced: 0 }),
      5: Object.freeze({ reward: 3, pace: 3, friction: 3, advanced: 0 }),
    }),
  }),
  guide: Object.freeze({
    strategySet: Object.freeze(['rewardSuppression', 'paceControl']),
    recoveryAction: 'none',
    levelLaneFloors: Object.freeze({
      1: Object.freeze({ reward: 1, pace: 1, friction: 0, advanced: 0 }),
      2: Object.freeze({ reward: 2, pace: 1, friction: 0, advanced: 0 }),
      3: Object.freeze({ reward: 2, pace: 2, friction: 1, advanced: 0 }),
      4: Object.freeze({ reward: 3, pace: 3, friction: 2, advanced: 0 }),
      5: Object.freeze({ reward: 3, pace: 3, friction: 3, advanced: 0 }),
    }),
  }),
  constrain: Object.freeze({
    strategySet: Object.freeze(['rewardSuppression', 'paceControl']),
    recoveryAction: 'pause',
    levelLaneFloors: Object.freeze({
      1: Object.freeze({ reward: 2, pace: 1, friction: 0, advanced: 0 }),
      2: Object.freeze({ reward: 2, pace: 2, friction: 1, advanced: 0 }),
      3: Object.freeze({ reward: 2, pace: 2, friction: 1, advanced: 0 }),
      4: Object.freeze({ reward: 3, pace: 3, friction: 2, advanced: 0 }),
      5: Object.freeze({ reward: 3, pace: 3, friction: 3, advanced: 0 }),
    }),
  }),
  interrupt: Object.freeze({
    strategySet: Object.freeze(['rewardSuppression', 'paceControl', 'sessionFracture']),
    recoveryAction: 'pause',
    levelLaneFloors: Object.freeze({
      1: Object.freeze({ reward: 2, pace: 2, friction: 1, advanced: 0 }),
      2: Object.freeze({ reward: 2, pace: 2, friction: 1, advanced: 0 }),
      3: Object.freeze({ reward: 2, pace: 2, friction: 1, advanced: 0 }),
      4: Object.freeze({ reward: 3, pace: 3, friction: 2, advanced: 0 }),
      5: Object.freeze({ reward: 3, pace: 3, friction: 3, advanced: 0 }),
    }),
  }),
  recover: Object.freeze({
    strategySet: Object.freeze(['rewardSuppression', 'recoveryRedirect']),
    recoveryAction: 'dashboard',
    levelLaneFloors: Object.freeze({
      1: Object.freeze({ reward: 1, pace: 0, friction: 0, advanced: 0 }),
      2: Object.freeze({ reward: 1, pace: 1, friction: 0, advanced: 0 }),
      3: Object.freeze({ reward: 2, pace: 1, friction: 0, advanced: 0 }),
      4: Object.freeze({ reward: 2, pace: 2, friction: 1, advanced: 0 }),
      5: Object.freeze({ reward: 3, pace: 3, friction: 2, advanced: 0 }),
    }),
  }),
  lock: Object.freeze({
    strategySet: Object.freeze(['rewardSuppression', 'paceControl', 'hardStop']),
    recoveryAction: 'reviewGoal',
    levelLaneFloors: Object.freeze({
      1: Object.freeze({ reward: 3, pace: 2, friction: 1, advanced: 0 }),
      2: Object.freeze({ reward: 3, pace: 3, friction: 2, advanced: 0 }),
      3: Object.freeze({ reward: 3, pace: 3, friction: 2, advanced: 0 }),
      4: Object.freeze({ reward: 3, pace: 3, friction: 3, advanced: 0 }),
      5: Object.freeze({ reward: 3, pace: 3, friction: 3, advanced: 0 }),
    }),
  }),
});

export function getBasicStrategyThresholds(posture = 'balanced') {
  const normalizedPosture = normalizeProtectionPosture(posture, 'balanced');
  return BASIC_STRATEGY_THRESHOLDS[normalizedPosture] || BASIC_STRATEGY_THRESHOLDS.balanced;
}

export function getBasicStrategyStateRecipe(state = 'observe') {
  return normalizeStrategyDecision(BASIC_STRATEGY_STATE_RECIPES[state] || BASIC_STRATEGY_STATE_RECIPES.observe);
}
