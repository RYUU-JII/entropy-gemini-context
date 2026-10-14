import { useMemo } from 'react';
import {
  ARTIFACT_MOTION_BUDGETS,
  resolveArtifactMotionBudget,
  resolveArtifactRuntimeBudget,
} from './artifactMotionBudget.js';
import { useArtifactRenderContext } from './artifactRenderContext.js';

const EMPTY_OBJECT = Object.freeze({});

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function resolveString(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function resolveBudgetedCount(count, runtimeBudget) {
  const baseCount = Math.max(0, Math.floor(Number(count) || 0));
  if (baseCount <= 0) return 0;
  const scale = Math.max(0, Number(runtimeBudget?.particleScale) || 0);
  if (scale <= 0) return 0;
  return Math.max(1, Math.round(baseCount * scale));
}

export function useArtifactRenderChannels({
  artifactRenderContext = null,
  artifactRenderState = null,
  color = '',
  isActive = true,
  systemMode = '',
} = {}) {
  const inheritedRenderContext = useArtifactRenderContext();

  return useMemo(() => {
    const context = artifactRenderContext || inheritedRenderContext || EMPTY_OBJECT;
    const renderState = artifactRenderState || context.renderState || EMPTY_OBJECT;
    const material = context.material || EMPTY_OBJECT;
    const motion = context.motion || EMPTY_OBJECT;
    const budget = motion.budget || EMPTY_OBJECT;
    const rawRuntimeBudget = motion.runtime || EMPTY_OBJECT;
    const environment = context.environment || EMPTY_OBJECT;
    const visualWeight = clamp01(material.visualWeight ?? renderState.visualWeight ?? (isActive ? 1 : 0));
    const isVisuallyActive = typeof renderState.isVisuallyActive === 'boolean'
      ? renderState.isVisuallyActive
      : isActive;
    const shouldRenderEffects = typeof motion.glow?.enabled === 'boolean'
      ? motion.glow.enabled
      : (renderState.shouldRenderEffects ?? isVisuallyActive);
    const fallbackBudgetMode = resolveArtifactMotionBudget({
      artifactRenderState: { shouldRenderEffects },
      visualWeight,
      shouldAnimateMotion: renderState.shouldAnimateMotion ?? isActive,
      shouldRunSimulation: renderState.shouldRunSimulation === true,
      motionMode: resolveString(renderState.motionMode, isActive ? 'ambient' : 'none'),
      simulationMode: resolveString(renderState.simulationMode, 'none'),
    });
    const motionBudgetMode = resolveString(budget.mode, fallbackBudgetMode);
    const isMotionStill = typeof budget.isStill === 'boolean'
      ? budget.isStill
      : motionBudgetMode === ARTIFACT_MOTION_BUDGETS.still;
    const isMotionAmbient = typeof budget.isAmbient === 'boolean'
      ? budget.isAmbient
      : motionBudgetMode === ARTIFACT_MOTION_BUDGETS.ambient;
    const isMotionFull = typeof budget.isFull === 'boolean'
      ? budget.isFull
      : motionBudgetMode === ARTIFACT_MOTION_BUDGETS.full;
    const shouldAnimateMotion = typeof budget.shouldAnimate === 'boolean'
      ? budget.shouldAnimate
      : !isMotionStill;
    const shouldAnimateActiveVisual = isVisuallyActive && renderState.reducedMotion !== true;
    const themeId = resolveString(context.themeId, systemMode);
    const motionBudget = Object.freeze({
      ...budget,
      mode: motionBudgetMode,
      isStill: isMotionStill,
      isAmbient: isMotionAmbient,
      isFull: isMotionFull,
      shouldAnimate: shouldAnimateMotion,
      visualWeight,
    });
    const runtimeBudget = rawRuntimeBudget.mode
      ? rawRuntimeBudget
      : resolveArtifactRuntimeBudget({ motionBudgetMode, visualWeight });

    return Object.freeze({
      activity: context.activity || EMPTY_OBJECT,
      color: material.signatureColor || color,
      colorTokens: material.colorTokens || EMPTY_OBJECT,
      daylight: clamp01(environment.daylight ?? 1),
      environment,
      nightDepth: clamp01(environment.nightDepth),
      lowSun: clamp01(environment.lowSun),
      twilightWeight: clamp01(environment.twilightWeight),
      nightWeight: clamp01(environment.nightWeight),
      phase: resolveString(environment.phase, 'neutral'),
      isMotionAmbient,
      isMotionFull,
      isMotionStill,
      isVisuallyActive,
      motion,
      motionBudget,
      motionBudgetMode,
      presentation: context.presentation || EMPTY_OBJECT,
      renderState,
      resolveBudgetedCount: (count) => resolveBudgetedCount(count, runtimeBudget),
      runtimeBudget,
      scene: context.scene || EMPTY_OBJECT,
      shouldAnimateActiveVisual,
      shouldAnimateAmbient: isMotionAmbient || isMotionFull,
      shouldAnimateFull: isMotionFull,
      shouldAnimateMotion,
      shouldRenderEffects,
      themeId,
      visualState: context.visualState,
      visualWeight,
    });
  }, [
    artifactRenderContext,
    artifactRenderState,
    color,
    inheritedRenderContext,
    isActive,
    systemMode,
  ]);
}
