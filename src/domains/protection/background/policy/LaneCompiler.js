import {
  normalizeLaneState,
} from '../../contracts/protectionContracts.js';
import { getLaneRecipeForLevel } from '../../catalog/laneRecipes.js';

export function createLaneCompiler() {
  function compile({
    profile = null,
    level = 1,
    advancedAutoEnabled = false,
  } = {}) {
    const profileLanes = profile && typeof profile === 'object' ? profile.levelLanes : null;
    const profileRecipe = profileLanes && typeof profileLanes === 'object'
      ? profileLanes[String(level)]
      : null;

    return normalizeLaneState(
      profileRecipe || getLaneRecipeForLevel(level, {
        advancedAutoEnabled,
      })
    );
  }

  return {
    compile,
  };
}
