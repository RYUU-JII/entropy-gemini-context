import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMotionValue, useTransform } from 'framer-motion';
import { useArtifactSimulationController } from '@/themes/core/artifacts/runtime/useArtifactSimulationController.js';
import { DEFAULT_SHISHI_ODOSHI_TUNING, resolveShishiOdoshiTuning } from './recipes/zenShishiOdoshiTuning.js';
import ZenShishiOdoshiScene from './presentation/ZenShishiOdoshiScene.jsx';
import { SHISHI_ODOSHI_SCENE_OFFSET_Y } from './recipes/zenShishiOdoshiGeometry.js';
import {
  DEFAULT_INITIAL_FILL,
  IDLE_ROTATE,
  SHISHI_ODOSHI_LIP_SPLASH_PARTICLES,
  clamp01,
  createShishiOdoshiFrameState,
  createShishiOdoshiPhysicsState,
  resolveConnectedShishiOdoshiGround,
  resolveRippleOpacity,
  resolveRippleScaleX,
  resolveRippleScaleY,
  resolveShishiOdoshiQualityProfile,
  resolveShishiOdoshiRestStreamHeight,
  smoothstep,
  stepShishiOdoshiPhysics,
} from './recipes/zenShishiOdoshiRuntimeRecipe.js';
import { useZenArtifactRenderChannels } from './useZenArtifactRenderChannels.js';
import { resolveZenShishiGroundSplashPose } from './recipes/zenShishiOdoshiWaterMaterial.js';

function ZenShishiOdoshi({
  isActive = true,
  color = '#5f8a6d',
  artifactActivity = null,
  artifactRenderContext = null,
  artifactRenderState = null,
  tuning = DEFAULT_SHISHI_ODOSHI_TUNING,
  groundProjection,
  onStrike = null,
  // null keeps the dashboard's autonomous cycle; a boolean selects the Gate pour.
  pourRequested = null,
  pourStartedAtMs = null,
  initialFill = DEFAULT_INITIAL_FILL,
  // Gate-only: { startAt, endAt } wall-clock window of a hold that fills the
  // tube while no pour is requested; it tips only when the hold ends.
  heldFillWindow = null,
}) {
  if (heldFillWindow !== null && (!Number.isFinite(heldFillWindow?.startAt)
    || !Number.isFinite(heldFillWindow?.endAt) || heldFillWindow.endAt <= heldFillWindow.startAt)) {
    throw new Error('ZEN_SHISHI_HELD_FILL_WINDOW_INVALID');
  }
  if (pourRequested === true && (!Number.isFinite(pourStartedAtMs) || pourStartedAtMs < 0)) {
    throw new Error('ZEN_SHISHI_POUR_START_INVALID');
  }
  const renderChannels = useZenArtifactRenderChannels({
    artifactRenderContext,
    artifactRenderState,
    color,
    isActive,
  });
  const qualityProfile = useMemo(
    () => resolveShishiOdoshiQualityProfile(renderChannels.runtimeBudget),
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
    visualWeight: residualVisualWeight,
    shouldAnimateSimulation,
    runSimulationLoop,
  } = useArtifactSimulationController({
    artifactId: resolvedArtifactRenderState.artifactId,
    artifactActivity: resolvedArtifactActivity,
    artifactRenderState: resolvedArtifactRenderState,
    runtimeBudget: renderChannels.runtimeBudget,
    isActive: renderChannels.isVisuallyActive,
    visualKey: resolvedArtifactRenderState.visualKey,
    settleVisualFloor: 0.12,
    settleVisualScale: 0.9,
    liveWeightFloor: 1,
  });
  const physics = useMemo(() => resolveShishiOdoshiTuning(tuning), [tuning]);
  const resolvedGroundProjection = renderChannels.scene?.groundProjection || groundProjection;
  const connectedGround = useMemo(
    () => resolveConnectedShishiOdoshiGround(resolvedGroundProjection),
    [resolvedGroundProjection],
  );
  const { groundTiltDeg: connectedGroundTiltDeg, rippleYAspectGain } = connectedGround;

  const tubeRotate = useMotionValue(IDLE_ROTATE);
  const streamHeight = useMotionValue(0);
  const captureStemHeight = useMotionValue(0);
  const captureTailLength = useMotionValue(0);
  const captureTailRotate = useMotionValue(0);
  const captureTailOpacity = useMotionValue(0);
  const streamSpread = useMotionValue(0.95);
  const streamBaseOpacity = useMotionValue(0);
  const streamCoreOpacity = useMotionValue(0);
  const freeFallBaseOpacity = useMotionValue(0);
  const freeFallCoreOpacity = useMotionValue(0);
  const groundImpactPulse = useMotionValue(0);
  const groundRippleTravel = useMotionValue(0);
  const groundRippleEnergy = useMotionValue(0);
  const lipPulse = useMotionValue(0);
  const phase = useMotionValue(0);

  const tubeFilter = useTransform(tubeRotate, (rotation) => {
    if (!qualityProfile.enableTubeShadow) return 'none';
    const nearGround = smoothstep((-rotation - 4) / 32);
    const y = 15 - (nearGround * 10);
    const blur = 10 - (nearGround * 3.5);
    const alpha = (0.3 + (nearGround * 0.28)) * qualityProfile.shadowAlphaScale;
    return `drop-shadow(0 ${y.toFixed(2)}px ${blur.toFixed(2)}px rgba(0,0,0,${alpha.toFixed(3)}))`;
  });
  const ripple1Opacity = useTransform([groundRippleEnergy, groundRippleTravel], ([energy, travel]) => {
    return resolveRippleOpacity(energy, travel, 0, 1.05);
  });
  const ripple2Opacity = useTransform([groundRippleEnergy, groundRippleTravel], ([energy, travel]) => {
    return resolveRippleOpacity(energy, travel, 0.6, 0.88);
  });
  const ripple3Opacity = useTransform([groundRippleEnergy, groundRippleTravel], ([energy, travel]) => {
    return resolveRippleOpacity(energy, travel, 1.2, 0.68);
  });
  const ripple1ScaleX = useTransform(
    groundRippleTravel,
    (travel) => resolveRippleScaleX(travel, 0),
  );
  const ripple1ScaleY = useTransform(
    groundRippleTravel,
    (travel) => resolveRippleScaleY(travel, 0, rippleYAspectGain),
  );
  const ripple2ScaleX = useTransform(
    groundRippleTravel,
    (travel) => resolveRippleScaleX(travel, 0.6),
  );
  const ripple2ScaleY = useTransform(
    groundRippleTravel,
    (travel) => resolveRippleScaleY(travel, 0.6, rippleYAspectGain),
  );
  const ripple3ScaleX = useTransform(
    groundRippleTravel,
    (travel) => resolveRippleScaleX(travel, 1.2),
  );
  const ripple3ScaleY = useTransform(
    groundRippleTravel,
    (travel) => resolveRippleScaleY(travel, 1.2, rippleYAspectGain),
  );
  const splashPose = useTransform([groundImpactPulse, groundRippleEnergy, phase],
    ([impact, energy, time]) => resolveZenShishiGroundSplashPose(impact, energy, time));
  const rippleSplashOpacity = useTransform(splashPose, value => value.opacity);
  const rippleSplashScaleX = useTransform(splashPose, value => value.scaleX);
  const rippleSplashScaleY = useTransform(splashPose, value => value.scaleY);
  const rippleDropletOpacity = useTransform(splashPose, value => value.dropletOpacity);
  const lipOpacity = useTransform(lipPulse, (value) => clamp01(value * 0.95));
  const lipY = useTransform(streamHeight, (value) => value - 2);
  const shouldAnimateMotion = renderChannels.shouldAnimateAmbient && shouldRunSimulation && residualVisualWeight > 0.02;
  const lipSplashParticles = useMemo(
    () => SHISHI_ODOSHI_LIP_SPLASH_PARTICLES.slice(0, qualityProfile.lipParticleCount),
    [qualityProfile.lipParticleCount],
  );
  const scenePose = useMemo(() => ({
    captureStemHeight,
    captureTailLength,
    captureTailOpacity,
    captureTailRotate,
    freeFallBaseOpacity,
    freeFallCoreOpacity,
    lipOpacity,
    lipY,
    ripple1Opacity,
    ripple1ScaleX,
    ripple1ScaleY,
    ripple2Opacity,
    ripple2ScaleX,
    ripple2ScaleY,
    ripple3Opacity,
    ripple3ScaleX,
    ripple3ScaleY,
    rippleSplashOpacity,
    rippleSplashScaleX,
    rippleSplashScaleY,
    rippleDropletOpacity,
    streamBaseOpacity,
    streamCoreOpacity,
    streamSpread,
    tubeFilter,
    tubeRotate,
  }), [
    captureStemHeight,
    captureTailLength,
    captureTailOpacity,
    captureTailRotate,
    freeFallBaseOpacity,
    freeFallCoreOpacity,
    lipOpacity,
    lipY,
    ripple1Opacity,
    ripple1ScaleX,
    ripple1ScaleY,
    ripple2Opacity,
    ripple2ScaleX,
    ripple2ScaleY,
    ripple3Opacity,
    ripple3ScaleX,
    ripple3ScaleY,
    rippleSplashOpacity,
    rippleSplashScaleX,
    rippleSplashScaleY,
    rippleDropletOpacity,
    streamBaseOpacity,
    streamCoreOpacity,
    streamSpread,
    tubeFilter,
    tubeRotate,
  ]);

  const physicsRef = useRef(null);
  if (physicsRef.current === null) {
    physicsRef.current = createShishiOdoshiPhysicsState(initialFill);
  }
  const frameRef = useRef(createShishiOdoshiFrameState());

  const onStrikeRef = useRef(onStrike);
  const pourRequestedRef = useRef(pourRequested);
  const pourStartedAtMsRef = useRef(pourStartedAtMs);
  const heldFillWindowRef = useRef(heldFillWindow);
  // The tube keeps its own fill across re-renders; only a remount reseeds it.
  const initialFillRef = useRef(initialFill);

  const applyRestPose = useCallback(() => {
    const restStreamHeight = resolveShishiOdoshiRestStreamHeight(IDLE_ROTATE);
    physicsRef.current = createShishiOdoshiPhysicsState(initialFillRef.current);
    frameRef.current = createShishiOdoshiFrameState();

    tubeRotate.set(IDLE_ROTATE);
    streamHeight.set(restStreamHeight);
    captureStemHeight.set(restStreamHeight);
    captureTailLength.set(0);
    captureTailRotate.set(0);
    captureTailOpacity.set(0);
    streamSpread.set(0.95);
    streamBaseOpacity.set(0);
    streamCoreOpacity.set(0);
    freeFallBaseOpacity.set(0);
    freeFallCoreOpacity.set(0);
    groundImpactPulse.set(0);
    groundRippleTravel.set(0);
    groundRippleEnergy.set(0);
    lipPulse.set(0);
    phase.set(0);
  }, [
    captureStemHeight,
    captureTailLength,
    captureTailOpacity,
    captureTailRotate,
    freeFallBaseOpacity,
    freeFallCoreOpacity,
    groundImpactPulse,
    groundRippleEnergy,
    groundRippleTravel,
    lipPulse,
    phase,
    streamBaseOpacity,
    streamCoreOpacity,
    streamHeight,
    streamSpread,
    tubeRotate,
  ]);

  useEffect(() => {
    onStrikeRef.current = onStrike;
  }, [onStrike]);

  useEffect(() => {
    pourRequestedRef.current = pourRequested;
    pourStartedAtMsRef.current = pourStartedAtMs;
    heldFillWindowRef.current = heldFillWindow;
  }, [heldFillWindow, pourRequested, pourStartedAtMs]);

  useEffect(() => {
    if (simulationMode !== 'halt') return;
    applyRestPose();
  }, [applyRestPose, simulationMode]);

  useEffect(() => {
    const state = physicsRef.current;
    streamHeight.set(resolveShishiOdoshiRestStreamHeight(state.angle));
  }, [streamHeight]);

  useEffect(() => {
    if (!shouldAnimateSimulation) {
      const state = physicsRef.current;
      state.lastFrame = 0;
      state.accumulatorMs = 0;
      return undefined;
    }

    const safeFixedStepMs = Math.max(1, Number(physics.fixedStepMs) || (1000 / 60));
    const simHz = Math.min(Math.max(1, 1000 / safeFixedStepMs), qualityProfile.simHz);
    const maxElapsedMs = Math.max(1, Number(physics.maxFrameMs) || 250);
    const maxCatchUpSteps = Math.max(1, Math.ceil(maxElapsedMs / safeFixedStepMs));

    return runSimulationLoop({
      simHz,
      targetFps: qualityProfile.targetFps,
      maxCatchUpSteps,
      maxElapsedMs,
      // Hidden documents freeze rendering; requested poses resume at the Gate's
      // current monotonic time, without extending its cue/decision deadlines.
      pauseWhenDocumentHidden: true,
      onPause: () => {
        const state = physicsRef.current;
        state.lastFrame = 0;
        state.accumulatorMs = 0;
        if (simulationMode === 'halt') {
          applyRestPose();
        }
      },
      onSimStep: ({ simStepSec }) => {
        const pourMode = typeof pourRequestedRef.current === 'boolean';
        const frame = stepShishiOdoshiPhysics({
          activityWeight,
          frame: frameRef.current,
          isSimulationLive,
          onStrike: onStrikeRef.current,
          physics,
          pourMode,
          pourRequested: pourRequestedRef.current === true,
          pourElapsedSec: pourRequestedRef.current === true
            ? (performance.now() - pourStartedAtMsRef.current) / 1000 : 0,
          heldFill: heldFillWindowRef.current
            ? (Date.now() - heldFillWindowRef.current.startAt)
              / (heldFillWindowRef.current.endAt - heldFillWindowRef.current.startAt)
            : null,
          residualVisualWeight,
          simulationMode,
          state: physicsRef.current,
          dt: simStepSec,
        });

        tubeRotate.set(frame.angle);
        streamHeight.set(frame.streamHeight);
        captureStemHeight.set(frame.captureStemHeight);
        captureTailLength.set(frame.captureTailLength);
        captureTailRotate.set(frame.captureTailRotate);
        captureTailOpacity.set(frame.captureTailOpacity);
        streamSpread.set(frame.streamSpread);
        streamBaseOpacity.set(frame.streamBaseOpacity);
        streamCoreOpacity.set(frame.streamCoreOpacity);
        freeFallBaseOpacity.set(frame.freeFallBaseOpacity);
        freeFallCoreOpacity.set(frame.freeFallCoreOpacity);
        groundImpactPulse.set(frame.groundImpactPulse);
        groundRippleTravel.set(frame.groundRippleTravel);
        groundRippleEnergy.set(frame.groundRippleEnergy);
        lipPulse.set(frame.lipPulse);
        phase.set(frame.phase);
      },
    });
  }, [
    activityWeight,
    applyRestPose,
    tubeRotate,
    streamHeight,
    captureStemHeight,
    captureTailLength,
    captureTailRotate,
    captureTailOpacity,
    streamSpread,
    streamBaseOpacity,
    streamCoreOpacity,
    freeFallBaseOpacity,
    freeFallCoreOpacity,
    groundImpactPulse,
    groundRippleTravel,
    groundRippleEnergy,
    lipPulse,
    phase,
    physics,
    residualVisualWeight,
    runSimulationLoop,
    simulationMode,
    shouldAnimateSimulation,
    isSimulationLive,
    qualityProfile.targetFps,
    qualityProfile.simHz,
  ]);

  return (
    <ZenShishiOdoshiScene
      activityWeight={activityWeight}
      color={artifactColor}
      groundTiltDeg={connectedGroundTiltDeg}
      groundAspect={connectedGround.rippleAspect}
      lipSplashParticles={lipSplashParticles}
      pose={scenePose}
      shouldAnimateMotion={shouldAnimateMotion}
      style={{ width: 320, height: 320, transform: `translateY(${SHISHI_ODOSHI_SCENE_OFFSET_Y}px)` }}
    />
  );
}

export default memo(ZenShishiOdoshi);
