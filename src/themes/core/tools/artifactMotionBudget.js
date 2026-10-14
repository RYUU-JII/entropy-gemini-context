import { createRenderBudget } from '@/platform/rendering/renderBudgetContract.js';

export const ARTIFACT_MOTION_BUDGETS = Object.freeze({
  still: 'still',
  ambient: 'ambient',
  full: 'full',
});

export const ARTIFACT_FIXED_RENDER_BUDGET = createRenderBudget({
  policyId: 'artifact-fixed',
  targetFps: 60,
  pixelRatioCap: 2,
  maxRenderPixels: 8_294_400,
});

export const ARTIFACT_RUNTIME_PROFILE = Object.freeze({
  renderBudget: ARTIFACT_FIXED_RENDER_BUDGET,
  simHz: 60,
  maxCatchUpSteps: 24,
  pausedFrameIntervalMs: 250,
  metricsSampleIntervalMs: 1200,
  particleScale: 1,
  vectorEffectScale: 1,
  allowHeavyEffects: true,
  allowImpactEffects: true,
});

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function freezeRecord(record) {
  return Object.freeze(record);
}

export function resolveArtifactMotionBudget({
  artifactRenderState = null,
  visualWeight = 0,
  shouldAnimateMotion = false,
  shouldRunSimulation = false,
  motionMode = 'none',
  simulationMode = 'none',
} = {}) {
  if (visualWeight <= 0 || artifactRenderState?.shouldRenderEffects !== true) {
    return ARTIFACT_MOTION_BUDGETS.still;
  }
  if (!shouldAnimateMotion && !shouldRunSimulation) {
    return ARTIFACT_MOTION_BUDGETS.still;
  }
  if (shouldRunSimulation === true) {
    if (simulationMode === 'live') return ARTIFACT_MOTION_BUDGETS.full;
    if (simulationMode === 'settle') return ARTIFACT_MOTION_BUDGETS.ambient;
    return ARTIFACT_MOTION_BUDGETS.still;
  }
  if (shouldAnimateMotion === true) {
    if (motionMode === 'full') return ARTIFACT_MOTION_BUDGETS.full;
    if (motionMode === 'ambient') return ARTIFACT_MOTION_BUDGETS.ambient;
  }
  return ARTIFACT_MOTION_BUDGETS.still;
}

export function resolveArtifactRuntimeBudget({
  motionBudgetMode = ARTIFACT_MOTION_BUDGETS.still,
  visualWeight = 0,
} = {}) {
  const profile = ARTIFACT_RUNTIME_PROFILE;
  const resolvedVisualWeight = clamp01(visualWeight);
  const runtimeEnabled = motionBudgetMode !== ARTIFACT_MOTION_BUDGETS.still && resolvedVisualWeight > 0;

  return freezeRecord({
    mode: motionBudgetMode,
    renderBudget: profile.renderBudget,
    enabled: runtimeEnabled,
    targetFps: runtimeEnabled ? profile.renderBudget.targetFps : 0,
    simHz: runtimeEnabled ? profile.simHz : 0,
    maxCatchUpSteps: runtimeEnabled ? profile.maxCatchUpSteps : 1,
    pausedFrameIntervalMs: profile.pausedFrameIntervalMs,
    metricsSampleIntervalMs: profile.metricsSampleIntervalMs,
    particleScale: runtimeEnabled ? profile.particleScale : 0,
    vectorEffectScale: runtimeEnabled ? profile.vectorEffectScale : 0,
    allowHeavyEffects: runtimeEnabled && profile.allowHeavyEffects,
    allowImpactEffects: runtimeEnabled && profile.allowImpactEffects,
    visualWeight: resolvedVisualWeight,
  });
}
