import React, { useMemo } from 'react';

import ZenShishiOdoshiScene from '../../../widgets/tools/presentation/ZenShishiOdoshiScene.jsx';
import { SHISHI_ODOSHI_GROUND_VIEW } from '../../../widgets/tools/recipes/zenShishiOdoshiGeometry.js';
import { resolveZenShishiGroundSplashPose } from '../../../widgets/tools/recipes/zenShishiOdoshiWaterMaterial.js';
import {
  SHISHI_ODOSHI_LIP_SPLASH_PARTICLES,
  clamp01,
  resolveRipplePhase,
  resolveRippleScaleX,
  resolveRippleScaleY,
  resolveShishiOdoshiRestStreamHeight,
  smoothstep,
} from '../../../widgets/tools/recipes/zenShishiOdoshiRuntimeRecipe.js';
import './ZenLandingShishiOdoshi.css';

const SHISHI_PHASES = Object.freeze(new Set(['resting', 'filling', 'tipping', 'settled']));
const LANDING_LIP_PARTICLES = Object.freeze(SHISHI_ODOSHI_LIP_SPLASH_PARTICLES.slice(0, 5));

function requireUnitInterval(value, field) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`ZEN_LANDING_SHISHI_${field}_INVALID`);
  }
  return value;
}

function requireFiniteNumber(value, field) {
  if (!Number.isFinite(value)) {
    throw new Error(`ZEN_LANDING_SHISHI_${field}_INVALID`);
  }
  return value;
}

function requirePhase(value) {
  if (!SHISHI_PHASES.has(value)) {
    throw new Error('ZEN_LANDING_SHISHI_PHASE_INVALID');
  }
  return value;
}

function requireReducedMotion(value) {
  if (typeof value !== 'boolean') {
    throw new Error('ZEN_LANDING_SHISHI_REDUCED_MOTION_INVALID');
  }
  return value;
}

function resolveLandingTubeAngle({ fill, phase, tiltDeg }) {
  if (phase === 'filling') {
    return 20 - (fill * 13);
  }
  if (phase === 'tipping') {
    const tipProgress = clamp01((tiltDeg + 2) / 26);
    return 7 - (smoothstep(tipProgress) * 56);
  }
  return phase === 'settled' ? 19 : 20;
}

function resolveLandingShishiPose({ fill, phase, reducedMotion, tiltDeg }) {
  const tubeRotate = reducedMotion && phase === 'settled'
    ? 19
    : resolveLandingTubeAngle({ fill, phase, tiltDeg });
  const tipProgress = phase === 'tipping'
    ? clamp01((tiltDeg + 2) / 26)
    : (phase === 'settled' ? 1 : 0);
  const streamHeight = resolveShishiOdoshiRestStreamHeight(tubeRotate);
  const inflow = phase === 'filling'
    ? 0.5 + (fill * 0.44)
    : (phase === 'tipping' ? (1 - smoothstep((tipProgress - 0.42) / 0.46)) * 0.82 : 0);
  const freeFall = phase === 'tipping'
    ? smoothstep((tipProgress - 0.28) / 0.54)
    : 0;
  const capturedFlow = inflow * (1 - freeFall);
  const impactPulse = phase === 'tipping'
    ? smoothstep((tipProgress - 0.58) / 0.22)
    : (phase === 'settled' ? 0.34 : 0);
  const rippleEnergy = phase === 'tipping'
    ? smoothstep((tipProgress - 0.54) / 0.32) * 0.92
    : (phase === 'settled' ? 0.42 : 0);
  const rippleTravel = phase === 'tipping'
    ? Math.max(0, tipProgress - 0.56) * 2.25
    : (phase === 'settled' ? 0.86 : 0);
  const ripple1Phase = resolveRipplePhase(rippleTravel, 0);
  const ripple2Phase = resolveRipplePhase(rippleTravel, 0.6);
  const ripple3Phase = resolveRipplePhase(rippleTravel, 1.2);
  const tailBlend = phase === 'tipping'
    ? smoothstep((tipProgress - 0.12) / 0.46) * (1 - freeFall)
    : 0;
  const splash = resolveZenShishiGroundSplashPose(impactPulse, rippleEnergy, tipProgress);

  return Object.freeze({
    captureStemHeight: Math.max(0, streamHeight - (tailBlend * 11.2)),
    captureTailLength: 2 + (tailBlend * 14),
    captureTailOpacity: tailBlend * 0.82,
    captureTailRotate: tubeRotate * tailBlend,
    freeFallBaseOpacity: freeFall * 0.9,
    freeFallCoreOpacity: freeFall * 0.74,
    lipOpacity: clamp01(impactPulse * 0.9),
    lipY: streamHeight - 2,
    ripple1Opacity: clamp01(rippleEnergy * (1 - ripple1Phase) * 1.05),
    ripple1ScaleX: resolveRippleScaleX(rippleTravel, 0),
    ripple1ScaleY: resolveRippleScaleY(rippleTravel, 0),
    ripple2Opacity: clamp01(rippleEnergy * (1 - ripple2Phase) * 0.88),
    ripple2ScaleX: resolveRippleScaleX(rippleTravel, 0.6),
    ripple2ScaleY: resolveRippleScaleY(rippleTravel, 0.6),
    ripple3Opacity: clamp01(rippleEnergy * (1 - ripple3Phase) * 0.68),
    ripple3ScaleX: resolveRippleScaleX(rippleTravel, 1.2),
    ripple3ScaleY: resolveRippleScaleY(rippleTravel, 1.2),
    rippleSplashOpacity: splash.opacity,
    rippleSplashScaleX: splash.scaleX,
    rippleSplashScaleY: splash.scaleY,
    rippleDropletOpacity: splash.dropletOpacity,
    streamBaseOpacity: capturedFlow,
    streamCoreOpacity: capturedFlow * 0.84,
    streamSpread: 0.92 + (tipProgress * 0.16),
    tubeFilter: 'drop-shadow(0 9px 8px rgb(0 0 0 / 0.34))',
    tubeRotate,
  });
}

export default function ZenLandingShishiOdoshi({
  fill,
  opacity,
  phase,
  reducedMotion,
  tiltDeg,
}) {
  const resolvedFill = requireUnitInterval(fill, 'FILL');
  const resolvedPhase = requirePhase(phase);
  const resolvedOpacity = requireUnitInterval(opacity, 'OPACITY');
  const resolvedTiltDeg = requireFiniteNumber(tiltDeg, 'TILT_DEG');
  const isReducedMotion = requireReducedMotion(reducedMotion);
  const pose = useMemo(() => resolveLandingShishiPose({
    fill: resolvedFill,
    phase: resolvedPhase,
    reducedMotion: isReducedMotion,
    tiltDeg: resolvedTiltDeg,
  }), [isReducedMotion, resolvedFill, resolvedPhase, resolvedTiltDeg]);

  return (
    <div
      className="zenLandingArtifact zenLandingShishiActual"
      data-shishi-phase={resolvedPhase}
      data-reduced-motion={isReducedMotion ? 'true' : 'false'}
      data-scene-source="zen-shishi-live-recipe"
      style={{ opacity: resolvedOpacity }}
      aria-hidden="true"
    >
      <ZenShishiOdoshiScene
        activityWeight={resolvedOpacity}
        color="var(--zen-landing-gate)"
        groundTiltDeg={SHISHI_ODOSHI_GROUND_VIEW.tiltDeg}
        groundAspect={SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect}
        lipSplashParticles={LANDING_LIP_PARTICLES}
        pose={pose}
        shouldAnimateMotion={false}
      />
    </div>
  );
}
