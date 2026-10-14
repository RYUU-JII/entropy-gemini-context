import { useCallback } from 'react';

import { runArtifactSimulationLoop } from './runArtifactSimulationLoop.js';
import {
  recordArtifactRuntimeMetric,
  shouldRecordArtifactRuntimeMetrics,
} from './artifactRuntimeMetrics.js';
import { resolveArtifactSimulationRuntime } from './simulationRuntime.js';

export function useArtifactSimulationController({
  artifactId = '',
  artifactActivity = null,
  artifactRenderState = null,
  runtimeBudget = null,
  isActive = true,
  visualKey = '',
  settleVisualFloor = 0.12,
  settleVisualScale = 0.85,
  liveWeightFloor = 0.18,
} = {}) {
  const budgetAllowsRuntime = runtimeBudget?.enabled !== false;
  const shouldAnimateSimulation = (artifactRenderState?.shouldAnimate ?? true)
    && budgetAllowsRuntime;
  const simulationRuntime = resolveArtifactSimulationRuntime({
    artifactActivity,
    artifactRenderState,
    isActive,
    shouldAnimate: shouldAnimateSimulation,
    settleVisualFloor,
    settleVisualScale,
    liveWeightFloor,
  });

  const runSimulationLoop = useCallback((loopOptions = {}) => {
    const requestedSimHz = Number(loopOptions.simHz) || Number(runtimeBudget?.simHz) || 60;
    const requestedTargetFps = Number(loopOptions.targetFps) || Number(runtimeBudget?.targetFps) || 60;
    const budgetSimHz = Number(runtimeBudget?.simHz);
    const budgetTargetFps = Number(runtimeBudget?.targetFps);
    const budgetMaxCatchUpSteps = Number(runtimeBudget?.maxCatchUpSteps);
    const nextSimHz = budgetSimHz > 0
      ? Math.min(requestedSimHz, budgetSimHz)
      : requestedSimHz;
    const nextTargetFps = budgetTargetFps > 0
      ? Math.min(requestedTargetFps, budgetTargetFps)
      : requestedTargetFps;
    const requestedMaxCatchUpSteps = Number(loopOptions.maxCatchUpSteps) || budgetMaxCatchUpSteps || 30;
    const nextMaxCatchUpSteps = budgetMaxCatchUpSteps > 0
      ? Math.min(requestedMaxCatchUpSteps, budgetMaxCatchUpSteps)
      : requestedMaxCatchUpSteps;
    const onMetrics = loopOptions.onMetrics;
    const shouldCollectRuntimeMetrics = typeof onMetrics === 'function' || shouldRecordArtifactRuntimeMetrics();

    return runArtifactSimulationLoop({
      ...loopOptions,
      simulationMode: simulationRuntime.simulationMode,
      shouldAnimate: shouldAnimateSimulation,
      simHz: nextSimHz,
      targetFps: nextTargetFps,
      maxCatchUpSteps: nextMaxCatchUpSteps,
      pausedFrameIntervalMs: loopOptions.pausedFrameIntervalMs ?? runtimeBudget?.pausedFrameIntervalMs,
      metricsSampleIntervalMs: shouldCollectRuntimeMetrics
        ? loopOptions.metricsSampleIntervalMs ?? runtimeBudget?.metricsSampleIntervalMs
        : null,
      metricsLabel: loopOptions.metricsLabel || `${artifactId || artifactRenderState?.artifactId || 'artifact'}:${visualKey || artifactRenderState?.visualKey || 'visual'}`,
      onMetrics: shouldCollectRuntimeMetrics
        ? (sample) => {
          onMetrics?.(sample);
          recordArtifactRuntimeMetric({
            artifactId: artifactId || artifactRenderState?.artifactId,
            visualKey: visualKey || artifactRenderState?.visualKey,
            budgetMode: runtimeBudget?.mode,
            runtimeBudget,
            sample,
          });
        }
        : null,
    });
  }, [
    artifactId,
    artifactRenderState,
    runtimeBudget,
    shouldAnimateSimulation,
    simulationRuntime.simulationMode,
    visualKey,
  ]);

  return Object.freeze({
    ...simulationRuntime,
    runtimeBudget,
    shouldAnimateSimulation,
    runSimulationLoop,
  });
}
