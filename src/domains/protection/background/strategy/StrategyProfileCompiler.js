import {
  PROTECTION_LEVELS,
  normalizeLaneState,
  normalizeProtectionProfile,
} from '../../contracts/protectionContracts.js';
import { getLaneRecipeForLevel } from '../../catalog/laneRecipes.js';
import { normalizeStrategyDecision } from '../../strategy/contracts/strategyContracts.js';

export function createStrategyProfileCompiler() {
  function compile({ profile = null, decision = null } = {}) {
    const normalizedProfile = normalizeProtectionProfile(profile);
    const normalizedDecision = normalizeStrategyDecision(decision);

    const levelLanes = PROTECTION_LEVELS.reduce((acc, level) => {
      const key = String(level);
      const baseRecipe = normalizedProfile.levelLanes?.[key] || getLaneRecipeForLevel(level);
      const floorRecipe = normalizedDecision.levelLaneFloors?.[key] || normalizeLaneState({});
      acc[key] = normalizeLaneState({
        reward: Math.max(baseRecipe.reward, floorRecipe.reward),
        pace: Math.max(baseRecipe.pace, floorRecipe.pace),
        friction: Math.max(baseRecipe.friction, floorRecipe.friction),
        advanced: Math.max(baseRecipe.advanced, floorRecipe.advanced),
      });
      return acc;
    }, {});

    return {
      ...normalizedProfile,
      levelLanes,
    };
  }

  return {
    compile,
  };
}
