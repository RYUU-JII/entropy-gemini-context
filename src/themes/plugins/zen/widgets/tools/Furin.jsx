import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMotionValue } from 'framer-motion';
import { useArtifactSimulationController } from '@/themes/core/artifacts/runtime/useArtifactSimulationController.js';

import ZenFurinScene from './presentation/ZenFurinScene.jsx';
import {
  DEFAULT_FURIN_TUNING,
  createFurinPhysicsState,
  resolveFurinQualityProfile,
  resolveFurinSimulationRecipe,
  stepFurinPhysics,
} from './recipes/zenFurinRuntimeRecipe.js';
import { resolveDailyFurinMantra } from './recipes/zenFurinInscriptions.js';
import { useZenArtifactRenderChannels } from './useZenArtifactRenderChannels.js';
import { projectZenFurinImpact } from './recipes/zenFurinImpact.js';

export default function ZenFurin({
  isActive = true,
  color = '#c84f42',
  artifactActivity = null,
  artifactRenderContext = null,
  artifactRenderState = null,
  tuning = DEFAULT_FURIN_TUNING,
  cycleState = null,
}) {
  const renderChannels = useZenArtifactRenderChannels({
    artifactRenderContext,
    artifactRenderState,
    color,
    isActive,
  });
  const qualityProfile = useMemo(
    () => resolveFurinQualityProfile(renderChannels.runtimeBudget),
    [renderChannels.runtimeBudget],
  );
  const resolvedArtifactRenderState = artifactRenderState || renderChannels.renderState;
  const resolvedArtifactActivity = artifactActivity || renderChannels.activity;
  const artifactColor = renderChannels.color;
  const {
    activityWeight,
    simulationMode,
    isSimulationLive,
    shouldRunSimulation,
    visualWeight: ambientVisualWeight,
    shouldAnimateSimulation,
    runSimulationLoop,
  } = useArtifactSimulationController({
    artifactId: resolvedArtifactRenderState.artifactId,
    artifactActivity: resolvedArtifactActivity,
    artifactRenderState: resolvedArtifactRenderState,
    runtimeBudget: renderChannels.runtimeBudget,
    isActive: renderChannels.isVisuallyActive,
    visualKey: resolvedArtifactRenderState.visualKey,
    settleVisualFloor: 0.1,
    settleVisualScale: 0.85,
    liveWeightFloor: 0,
  });
  const shouldAnimateAmbientMotion = renderChannels.shouldAnimateAmbient && shouldAnimateSimulation;
  const shouldAnimateFullMotion = renderChannels.shouldAnimateFull && shouldAnimateSimulation;

  const mainRotate = useMotionValue(0);
  const strikerRotate = useMotionValue(0);
  const paperBendRotate = useMotionValue(0);
  const paperYawRotate = useMotionValue(0);
  const paperSkew = useMotionValue(0);
  const bellShimmer = useMotionValue(0);
  const impactX = useMotionValue(0);
  const impactScale = useMotionValue(0.35);
  const impactOpacity = useMotionValue(0);

  const physics = useRef(createFurinPhysicsState());
  const simulationRecipe = useMemo(() => resolveFurinSimulationRecipe({
    activityWeight,
    isSimulationLive,
    simulationMode,
    tuning,
  }), [activityWeight, isSimulationLive, simulationMode, tuning]);

  const applyRestPose = useCallback(() => {
    physics.current = createFurinPhysicsState();
    mainRotate.set(0);
    strikerRotate.set(0);
    paperBendRotate.set(0);
    paperYawRotate.set(0);
    paperSkew.set(0);
    bellShimmer.set(0);
    impactX.set(0);
    impactScale.set(0.35);
    impactOpacity.set(0);
  }, [bellShimmer, impactX, impactScale, impactOpacity, mainRotate, paperBendRotate, paperSkew, paperYawRotate, strikerRotate]);

  useEffect(() => {
    if (simulationMode !== 'halt') return;
    applyRestPose();
  }, [applyRestPose, simulationMode]);

  useEffect(() => runSimulationLoop({
    simHz: qualityProfile.simHz,
    targetFps: qualityProfile.targetFps,
    maxCatchUpSteps: 24,
    onPause: () => {
      if (simulationMode === 'halt') {
        applyRestPose();
      }
    },
    onSimStep: ({ simStepMs, simTimeMs }) => {
      stepFurinPhysics({
        state: physics.current,
        simStepMs,
        simTimeMs,
        recipe: simulationRecipe,
      });
    },
    onRender: () => {
      const state = physics.current;
      mainRotate.set(state.bell.pos);
      strikerRotate.set(state.striker.pos - state.bell.pos);
      paperBendRotate.set(state.paper.pos - state.striker.pos);
      paperYawRotate.set(state.paper.yaw);
      paperSkew.set(state.paper.skew);
      bellShimmer.set(state.shimmer);
      const impact = projectZenFurinImpact(state);
      impactX.set(impact.x);
      impactScale.set(impact.scale);
      impactOpacity.set(qualityProfile.enableImpactPulse ? impact.opacity : 0);
    },
  }), [
    applyRestPose,
    bellShimmer,
    impactX,
    impactScale,
    impactOpacity,
    mainRotate,
    paperBendRotate,
    paperSkew,
    paperYawRotate,
    qualityProfile.simHz,
    qualityProfile.targetFps,
    qualityProfile.enableImpactPulse,
    runSimulationLoop,
    simulationMode,
    simulationRecipe,
    strikerRotate,
  ]);

  const mantra = useMemo(
    () => resolveDailyFurinMantra({ cycleState }),
    [cycleState],
  );

  return (
    <div
      data-zen-furin-widget-scene="shared"
      style={{
        position: 'relative',
        width: 300,
        height: 360,
        pointerEvents: 'none',
        transform: 'translateY(-70px)',
      }}
    >
      <ZenFurinScene
        ambientVisualWeight={ambientVisualWeight}
        bellShimmer={bellShimmer}
        color={artifactColor}
        isSimulationLive={isSimulationLive}
        mainRotation={mainRotate}
        mantra={mantra}
        paperRotation={paperBendRotate}
        paperSkew={paperSkew}
        paperYaw={paperYawRotate}
        particleCount={qualityProfile.particleCount}
        impactX={impactX}
        impactScale={impactScale}
        impactOpacity={impactOpacity}
        shouldAnimateAmbientGlow={
          qualityProfile.animateAmbientGlow
          && shouldRunSimulation
          && shouldAnimateAmbientMotion
        }
        shouldAnimateVisual={shouldAnimateFullMotion}
        shouldRunSimulation={shouldRunSimulation && shouldAnimateAmbientMotion}
        strikerRotation={strikerRotate}
      />
    </div>
  );
}
