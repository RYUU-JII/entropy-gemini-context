import { clampLevel, normalizeLaneState } from '../contracts/protectionContracts.js';

export const LEVEL_LANE_RECIPES = Object.freeze({
  1: Object.freeze({ reward: 1, pace: 0, friction: 0, advanced: 0 }),
  2: Object.freeze({ reward: 2, pace: 1, friction: 0, advanced: 0 }),
  3: Object.freeze({ reward: 2, pace: 2, friction: 1, advanced: 0 }),
  4: Object.freeze({ reward: 3, pace: 3, friction: 2, advanced: 0 }),
  5: Object.freeze({ reward: 3, pace: 3, friction: 3, advanced: 0 }),
});

export function getLaneRecipeForLevel(level, { advancedAutoEnabled = false } = {}) {
  const normalizedLevel = clampLevel(level, 1);
  const baseRecipe = LEVEL_LANE_RECIPES[normalizedLevel] || LEVEL_LANE_RECIPES[1];
  const nextRecipe = {
    ...baseRecipe,
    advanced: advancedAutoEnabled ? baseRecipe.advanced : 0,
  };
  return normalizeLaneState(nextRecipe);
}
