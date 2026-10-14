import { runRenderLoop } from '@/platform/rendering/renderLoop.js';

import { normalizeArtifactSimulationMode } from './simulationRuntime.js';

export function runArtifactSimulationLoop({
  simulationMode = 'halt',
  shouldAnimate = true,
  ...loopOptions
}) {
  const normalizedMode = normalizeArtifactSimulationMode(simulationMode, 'halt');

  return runRenderLoop({
    ...loopOptions,
    enabled: shouldAnimate && normalizedMode !== 'halt',
  });
}
