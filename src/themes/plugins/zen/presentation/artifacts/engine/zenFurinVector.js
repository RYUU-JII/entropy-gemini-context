import { buildZenFurinScene } from '../../../widgets/tools/recipes/zenFurinSceneRecipe.jsx';
import { createZenSvgScope } from './zenSvgDocument.jsx';

export function createZenFurinVector({ color, mantra, paperYaw = 0, scope = 'zen-engine-furin', supportStyle = 'branch' }) {
  return buildZenFurinScene({ idScope: createZenSvgScope(scope), color, mantra,
    mainRotation: 0, strikerRotation: 0, paperRotation: 0, paperYaw, paperSkew: 0,
    bellShimmer: 0, impactX: 0, impactScale: 0.35, impactOpacity: 0,
    shouldAnimateAmbientGlow: false, shouldRunSimulation: false, isSimulationLive: true,
    ambientVisualWeight: 1, particleCount: 0, shouldAnimateVisual: false, supportStyle,
  });
}
