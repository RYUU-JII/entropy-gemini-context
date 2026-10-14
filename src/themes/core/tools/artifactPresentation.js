import { getToolsArtifactRenderTier } from './artifacts.js';

export const ARTIFACT_PRESENTATION_VERSION = 1;
export const ARTIFACT_RENDER_STATE_VERSION = 1;
export const ARTIFACT_PREVIEW_RENDER_STATE_VERSION = 1;

export const ARTIFACT_RENDER_TIERS = Object.freeze({
  static: 'static',
  motion: 'motion',
  simulation: 'simulation',
});

export const ARTIFACT_ACTIVITY_PHASES = Object.freeze({
  parked: 'parked',
  arming: 'arming',
  active: 'active',
  cooling: 'cooling',
  unavailable: 'unavailable',
});

export const ARTIFACT_MOTION_MODES = Object.freeze({
  none: 'none',
  ambient: 'ambient',
  full: 'full',
});

export const ARTIFACT_SIMULATION_MODES = Object.freeze({
  none: 'none',
  halt: 'halt',
  settle: 'settle',
  live: 'live',
});

const ARTIFACT_RUNTIME_STATE_WEIGHTS = Object.freeze({
  unavailable: 0,
  disabled: 0,
  armed: 0.35,
  cleanup: 0.25,
  engaged: 1,
});

const ARTIFACT_RUNTIME_STATE_PHASES = Object.freeze({
  unavailable: ARTIFACT_ACTIVITY_PHASES.unavailable,
  disabled: ARTIFACT_ACTIVITY_PHASES.parked,
  armed: ARTIFACT_ACTIVITY_PHASES.arming,
  cleanup: ARTIFACT_ACTIVITY_PHASES.cooling,
  engaged: ARTIFACT_ACTIVITY_PHASES.active,
});

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function resolveString(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function resolveBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function resolvePresentationActivity(artifactActivity = null, artifactPresentation = null) {
  if (artifactActivity && typeof artifactActivity === 'object') {
    return artifactActivity;
  }
  if (artifactPresentation?.activity && typeof artifactPresentation.activity === 'object') {
    return artifactPresentation.activity;
  }
  return null;
}

function normalizeRuntimeState(runtimeState, isRuntimeActive, configuredActive) {
  if (typeof runtimeState === 'string' && runtimeState.trim()) {
    return runtimeState.trim();
  }
  if (isRuntimeActive) return 'engaged';
  if (configuredActive) return 'armed';
  return 'disabled';
}

function resolvePhase(runtimeState, isRuntimeActive, configuredActive) {
  if (ARTIFACT_RUNTIME_STATE_PHASES[runtimeState]) {
    return ARTIFACT_RUNTIME_STATE_PHASES[runtimeState];
  }
  if (isRuntimeActive) return ARTIFACT_ACTIVITY_PHASES.active;
  if (configuredActive) return ARTIFACT_ACTIVITY_PHASES.arming;
  return ARTIFACT_ACTIVITY_PHASES.parked;
}

function resolveMotionMode(renderTier, phase) {
  if (renderTier === ARTIFACT_RENDER_TIERS.static) {
    return ARTIFACT_MOTION_MODES.none;
  }
  if (phase === ARTIFACT_ACTIVITY_PHASES.active) {
    return ARTIFACT_MOTION_MODES.full;
  }
  if (
    phase === ARTIFACT_ACTIVITY_PHASES.arming
    || phase === ARTIFACT_ACTIVITY_PHASES.cooling
  ) {
    return ARTIFACT_MOTION_MODES.ambient;
  }
  return ARTIFACT_MOTION_MODES.none;
}

function resolveSimulationMode(renderTier, phase) {
  if (renderTier !== ARTIFACT_RENDER_TIERS.simulation) {
    return ARTIFACT_SIMULATION_MODES.none;
  }
  if (phase === ARTIFACT_ACTIVITY_PHASES.active) {
    return ARTIFACT_SIMULATION_MODES.live;
  }
  if (
    phase === ARTIFACT_ACTIVITY_PHASES.arming
    || phase === ARTIFACT_ACTIVITY_PHASES.cooling
  ) {
    return ARTIFACT_SIMULATION_MODES.settle;
  }
  return ARTIFACT_SIMULATION_MODES.halt;
}

export function buildArtifactActivityState({
  artifactId = '',
  runtimeState = '',
  isRuntimeActive = false,
  configuredActive = false,
} = {}) {
  const runtimeActive = isRuntimeActive === true;
  const normalizedRuntimeState = normalizeRuntimeState(runtimeState, runtimeActive, configuredActive);
  const renderTier = getToolsArtifactRenderTier(artifactId, ARTIFACT_RENDER_TIERS.motion);
  const phase = resolvePhase(normalizedRuntimeState, runtimeActive, configuredActive);
  const weight = clamp01(
    ARTIFACT_RUNTIME_STATE_WEIGHTS[normalizedRuntimeState]
    ?? (runtimeActive ? 1 : (configuredActive ? 0.35 : 0))
  );
  const motionMode = resolveMotionMode(renderTier, phase);
  const simulationMode = resolveSimulationMode(renderTier, phase);

  return Object.freeze({
    version: ARTIFACT_PRESENTATION_VERSION,
    artifactId,
    renderTier,
    runtimeState: normalizedRuntimeState,
    phase,
    weight,
    isRuntimeActive: runtimeActive,
    configuredActive: configuredActive === true,
    motionMode,
    simulationMode,
    shouldRenderEffects: weight > 0,
    isInteractive: phase !== ARTIFACT_ACTIVITY_PHASES.unavailable,
  });
}

export function buildArtifactPresentationState({
  artifactId = '',
  visualKey = '',
  runtimeState = '',
  isRuntimeActive = false,
  configuredActive = false,
  artifactActivity = null,
  artifactVisualState = null,
} = {}) {
  const activity = artifactActivity && typeof artifactActivity === 'object'
    ? artifactActivity
    : buildArtifactActivityState({
      artifactId,
      runtimeState,
      isRuntimeActive,
      configuredActive,
    });

  return Object.freeze({
    version: ARTIFACT_PRESENTATION_VERSION,
    artifactId,
    visualKey,
    renderTier: activity.renderTier,
    activity,
    visualState: artifactVisualState,
  });
}

export function resolveArtifactPreviewRenderState({
  artifactActivity = null,
  artifactPresentation = null,
  isRuntimeActive = null,
  isPreviewActive = false,
} = {}) {
  const activity = resolvePresentationActivity(artifactActivity, artifactPresentation);
  const runtimeActive = typeof isRuntimeActive === 'boolean'
    ? isRuntimeActive
    : activity?.isRuntimeActive === true;
  const requestedActive = runtimeActive === true
    || isPreviewActive === true
    || activity?.configuredActive === true;
  const phase = resolveString(
    activity?.phase,
    requestedActive ? ARTIFACT_ACTIVITY_PHASES.active : ARTIFACT_ACTIVITY_PHASES.parked,
  );
  const runtimeState = resolveString(
    activity?.runtimeState,
    requestedActive ? 'engaged' : 'disabled',
  );
  const isUnavailable = phase === ARTIFACT_ACTIVITY_PHASES.unavailable
    || runtimeState === 'unavailable'
    || activity?.isInteractive === false;
  const isActive = requestedActive && !isUnavailable;
  const visualActivityWeight = isActive ? 1 : clamp01(activity?.weight ?? 0);

  return Object.freeze({
    version: ARTIFACT_PREVIEW_RENDER_STATE_VERSION,
    presentationVersion: artifactPresentation?.version || activity?.version || ARTIFACT_PRESENTATION_VERSION,
    artifactId: resolveString(activity?.artifactId || artifactPresentation?.artifactId),
    visualKey: resolveString(artifactPresentation?.visualKey),
    phase,
    runtimeState,
    renderTier: resolveString(
      activity?.renderTier || artifactPresentation?.renderTier,
      ARTIFACT_RENDER_TIERS.motion,
    ),
    artifactActivity: activity,
    artifactPresentation,
    isActive,
    isVisuallyActive: isActive || visualActivityWeight > 0.001,
    isUnavailable,
    configuredActive: activity?.configuredActive === true,
    isRuntimeActive: runtimeActive,
    visualActivityWeight,
    activityWeight: clamp01(activity?.weight ?? visualActivityWeight),
  });
}

export function resolveArtifactRenderState({
  artifactActivity = null,
  artifactPresentation = null,
  isActive = false,
  visualActivityWeight = null,
  shouldAnimate = true,
  reducedMotion = false,
  forcePreviewActive = false,
} = {}) {
  const activity = resolvePresentationActivity(artifactActivity, artifactPresentation);
  const fallbackActive = isActive === true || forcePreviewActive === true;
  const renderTier = resolveString(
    activity?.renderTier || artifactPresentation?.renderTier,
    ARTIFACT_RENDER_TIERS.motion,
  );
  const phase = resolveString(
    activity?.phase,
    fallbackActive ? ARTIFACT_ACTIVITY_PHASES.active : ARTIFACT_ACTIVITY_PHASES.parked,
  );
  const runtimeState = resolveString(
    activity?.runtimeState,
    fallbackActive ? 'engaged' : 'disabled',
  );
  const rawWeight = visualActivityWeight ?? activity?.weight ?? (fallbackActive ? 1 : 0);
  const visualWeight = clamp01(rawWeight);
  const motionMode = resolveString(
    activity?.motionMode,
    resolveMotionMode(renderTier, phase),
  );
  const simulationMode = resolveString(
    activity?.simulationMode,
    resolveSimulationMode(renderTier, phase),
  );
  const canAnimate = shouldAnimate === true && reducedMotion !== true;
  const shouldRenderEffects = resolveBoolean(activity?.shouldRenderEffects, visualWeight > 0);
  const shouldAnimateMotion = canAnimate
    && shouldRenderEffects
    && motionMode !== ARTIFACT_MOTION_MODES.none
    && visualWeight > 0;
  const shouldRunSimulation = canAnimate
    && renderTier === ARTIFACT_RENDER_TIERS.simulation
    && simulationMode !== ARTIFACT_SIMULATION_MODES.none
    && simulationMode !== ARTIFACT_SIMULATION_MODES.halt
    && visualWeight > 0;

  return Object.freeze({
    version: ARTIFACT_RENDER_STATE_VERSION,
    presentationVersion: artifactPresentation?.version || activity?.version || ARTIFACT_PRESENTATION_VERSION,
    artifactId: resolveString(activity?.artifactId || artifactPresentation?.artifactId),
    visualKey: resolveString(artifactPresentation?.visualKey),
    runtimeState,
    phase,
    renderTier,
    motionMode,
    simulationMode,
    activityWeight: clamp01(activity?.weight ?? visualWeight),
    visualWeight,
    isActive: fallbackActive,
    isVisuallyActive: visualWeight > 0.001 || fallbackActive,
    shouldRenderEffects,
    shouldAnimate: canAnimate,
    shouldAnimateMotion,
    shouldRunSimulation,
    reducedMotion: reducedMotion === true,
  });
}
