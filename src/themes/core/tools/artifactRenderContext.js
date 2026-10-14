import React, { createContext, useContext } from 'react';
import {
  ARTIFACT_MOTION_BUDGETS,
  resolveArtifactMotionBudget,
  resolveArtifactRuntimeBudget,
} from './artifactMotionBudget.js';

export {
  ARTIFACT_FIXED_RENDER_BUDGET,
  ARTIFACT_MOTION_BUDGETS,
  ARTIFACT_RUNTIME_PROFILE,
  resolveArtifactMotionBudget,
  resolveArtifactRuntimeBudget,
} from './artifactMotionBudget.js';

export const ARTIFACT_RENDER_PIPELINE_VERSION = 2;

const EMPTY_OBJECT = Object.freeze({});

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function resolveFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function resolveString(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function freezeRecord(record) {
  return Object.freeze(record);
}

function normalizeDiagnostics(diagnostics = null) {
  if (!diagnostics || typeof diagnostics !== 'object' || Array.isArray(diagnostics)) {
    return freezeRecord({
      rendererWidget: freezeRecord({
        status: 'unknown',
        themeId: '',
        visualKey: '',
        widgetName: '',
      }),
    });
  }
  const rendererWidget = diagnostics.rendererWidget
    && typeof diagnostics.rendererWidget === 'object'
    && !Array.isArray(diagnostics.rendererWidget)
    ? diagnostics.rendererWidget
    : {};

  return freezeRecord({
    ...diagnostics,
    rendererWidget: freezeRecord({
      status: resolveString(rendererWidget.status, 'unknown'),
      themeId: resolveString(rendererWidget.themeId),
      visualKey: resolveString(rendererWidget.visualKey),
      widgetName: resolveString(rendererWidget.widgetName),
    }),
  });
}

function normalizeEnvironmentPresentation(environment = null) {
  const source = environment && typeof environment === 'object' && !Array.isArray(environment)
    ? environment
    : null;
  if (!source) {
    return freezeRecord({
      available: false,
      themeId: '',
      source: 'unavailable',
      phase: 'neutral',
      daylight: 1,
      nightDepth: 0,
      solarElevation: 1,
      dawnWeight: 0,
      duskWeight: 0,
      warmth: 0,
      lowSun: 0,
      twilightWeight: 0,
      nightWeight: 0,
      lightVector: freezeRecord({ x: 0, y: -0.5 }),
    });
  }
  const lightVector = source.lightVector && typeof source.lightVector === 'object'
    ? source.lightVector
    : EMPTY_OBJECT;
  return freezeRecord({
    available: true,
    themeId: resolveString(source.themeId),
    source: resolveString(source.source, 'theme_ambient_presentation'),
    phase: resolveString(source.phase, 'neutral'),
    daylight: clamp01(source.daylight),
    nightDepth: clamp01(source.nightDepth),
    solarElevation: clamp01(source.solarElevation),
    dawnWeight: clamp01(source.dawnWeight),
    duskWeight: clamp01(source.duskWeight),
    warmth: clamp01(source.warmth),
    lowSun: clamp01(source.lowSun),
    twilightWeight: clamp01(source.twilightWeight),
    nightWeight: clamp01(source.nightWeight),
    lightVector: freezeRecord({
      x: Math.max(-1, Math.min(1, resolveFiniteNumber(lightVector.x, 0))),
      y: Math.max(-1, Math.min(1, resolveFiniteNumber(lightVector.y, -0.5))),
    }),
  });
}

function buildArtifactMotionChannels({
  artifactRenderState = null,
  activityWeight = 0,
} = {}) {
  const visualWeight = clamp01(artifactRenderState?.visualWeight ?? activityWeight);
  const shouldAnimateMotion = artifactRenderState?.shouldAnimateMotion === true;
  const shouldRunSimulation = artifactRenderState?.shouldRunSimulation === true;
  const motionMode = resolveString(artifactRenderState?.motionMode, 'none');
  const simulationMode = resolveString(artifactRenderState?.simulationMode, 'none');
  const budgetMode = resolveArtifactMotionBudget({
    artifactRenderState,
    visualWeight,
    shouldAnimateMotion,
    shouldRunSimulation,
    motionMode,
    simulationMode,
  });
  const isStill = budgetMode === ARTIFACT_MOTION_BUDGETS.still;
  const isAmbient = budgetMode === ARTIFACT_MOTION_BUDGETS.ambient;
  const isFull = budgetMode === ARTIFACT_MOTION_BUDGETS.full;

  return freezeRecord({
    budget: freezeRecord({
      mode: budgetMode,
      isStill,
      isAmbient,
      isFull,
      shouldAnimate: !isStill,
      visualWeight,
    }),
    runtime: resolveArtifactRuntimeBudget({
      motionBudgetMode: budgetMode,
      visualWeight,
    }),
    breath: freezeRecord({
      enabled: !isStill && motionMode !== 'none',
      weight: visualWeight,
      mode: motionMode,
    }),
    glow: freezeRecord({
      enabled: artifactRenderState?.shouldRenderEffects === true && visualWeight > 0,
      weight: visualWeight,
    }),
    flow: freezeRecord({
      enabled: !isStill && (motionMode === 'ambient' || motionMode === 'full'),
      weight: visualWeight,
      mode: motionMode,
    }),
    impact: freezeRecord({
      enabled: isFull && shouldRunSimulation && simulationMode === 'live',
      weight: visualWeight,
      mode: simulationMode,
    }),
    settle: freezeRecord({
      enabled: isAmbient && shouldRunSimulation && simulationMode === 'settle',
      weight: visualWeight,
      mode: simulationMode,
    }),
  });
}

export function buildArtifactRenderContext({
  ambientPresentation = null,
  artifactActivity = null,
  artifactPresentation = null,
  artifactRenderState = null,
  artifactVisualState = null,
  activityWeight = 0,
  color = '',
  cycleState = null,
  colorTokens = null,
  diagnostics = null,
  groundProjection = null,
  mode = 'stable',
  systemMode = '',
  visualKey = '',
} = {}) {
  const resolvedVisualKey = resolveString(
    artifactRenderState?.visualKey || artifactPresentation?.visualKey || visualKey,
    visualKey,
  );
  const artifactId = resolveString(
    artifactRenderState?.artifactId
      || artifactActivity?.artifactId
      || artifactPresentation?.artifactId,
    resolvedVisualKey,
  );
  const visualWeight = clamp01(artifactRenderState?.visualWeight ?? activityWeight);

  return freezeRecord({
    version: ARTIFACT_RENDER_PIPELINE_VERSION,
    artifactId,
    visualKey: resolvedVisualKey,
    themeId: resolveString(systemMode),
    stage: freezeRecord({
      mode: resolveString(mode, 'stable'),
      coordinateSpace: 'artifact_gallery_scene',
      bodyModel: 'heterogeneous',
    }),
    environment: normalizeEnvironmentPresentation(ambientPresentation),
    material: freezeRecord({
      colorTokens: colorTokens || EMPTY_OBJECT,
      signatureColor: color,
      visualWeight,
    }),
    activity: artifactActivity || EMPTY_OBJECT,
    presentation: artifactPresentation || EMPTY_OBJECT,
    renderState: artifactRenderState || EMPTY_OBJECT,
    visualState: artifactVisualState,
    diagnostics: normalizeDiagnostics(diagnostics),
    motion: buildArtifactMotionChannels({ artifactRenderState, activityWeight: visualWeight }),
    scene: freezeRecord({
      cycleState,
      groundProjection,
    }),
  });
}

const ArtifactRenderContext = createContext(null);

export function ArtifactRenderContextProvider({ value, children }) {
  return React.createElement(ArtifactRenderContext.Provider, { value }, children);
}

export function useArtifactRenderContext() {
  return useContext(ArtifactRenderContext);
}
