function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

const ALLOWED_SIMULATION_MODES = new Set(['live', 'settle', 'halt']);

export function normalizeArtifactSimulationMode(simulationMode, fallback = 'halt') {
  const normalized = typeof simulationMode === 'string' ? simulationMode.trim().toLowerCase() : '';
  return ALLOWED_SIMULATION_MODES.has(normalized) ? normalized : fallback;
}

export function resolveArtifactSimulationRuntime({
  artifactActivity = null,
  artifactRenderState = null,
  isActive = true,
  shouldAnimate = true,
  settleVisualFloor = 0.12,
  settleVisualScale = 0.85,
  liveWeightFloor = 0.18,
} = {}) {
  const activityWeight = clamp01(
    artifactRenderState?.activityWeight
    ?? artifactActivity?.weight
    ?? (isActive ? 1 : 0),
  );
  const simulationMode = normalizeArtifactSimulationMode(
    artifactRenderState?.simulationMode ?? artifactActivity?.simulationMode,
    isActive ? 'live' : 'halt',
  );
  const isSimulationLive = simulationMode === 'live';
  const isSimulationSettling = simulationMode === 'settle';
  const requestedVisualWeight = artifactRenderState?.visualWeight;
  const hasRequestedVisualWeight = requestedVisualWeight !== null
    && requestedVisualWeight !== undefined
    && Number.isFinite(Number(requestedVisualWeight));
  const visualWeight = hasRequestedVisualWeight
    ? clamp01(requestedVisualWeight)
    : (
      simulationMode === 'halt'
        ? 0
        : (
          isSimulationLive
            ? Math.max(liveWeightFloor, activityWeight)
            : clamp01((activityWeight * settleVisualScale) + settleVisualFloor)
        )
    );
  const renderStateAllowsSimulation = typeof artifactRenderState?.shouldRunSimulation === 'boolean'
    ? artifactRenderState.shouldRunSimulation
    : visualWeight > 0;
  const shouldRunSimulation = shouldAnimate
    && renderStateAllowsSimulation
    && simulationMode !== 'halt';

  return Object.freeze({
    activityWeight,
    simulationMode,
    isSimulationLive,
    isSimulationSettling,
    isSimulationHalted: simulationMode === 'halt',
    shouldRunSimulation,
    visualWeight,
  });
}
