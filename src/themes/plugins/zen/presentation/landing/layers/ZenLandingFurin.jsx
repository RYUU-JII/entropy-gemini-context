import React, { useMemo } from 'react';

import ZenFurinScene from '../../../widgets/tools/presentation/ZenFurinScene.jsx';
import { ZEN_FURIN_GEOMETRY } from '../../../widgets/tools/recipes/zenFurinGeometry.js';
import './ZenLandingFurin.css';

const LANDING_FURIN_MANTRA = Object.freeze(['清', '風', '明', '月']);

function requireUnitInterval(value, field) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`ZEN_LANDING_FURIN_${field}_INVALID`);
  }
  return value;
}

function requireFiniteNumber(value, field) {
  if (!Number.isFinite(value)) {
    throw new Error(`ZEN_LANDING_FURIN_${field}_INVALID`);
  }
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new Error(`ZEN_LANDING_FURIN_${field}_INVALID`);
  }
  return value;
}

function clampUnit(value) {
  return Math.min(1, Math.max(0, value));
}

function resolveLandingFurinPose({
  reducedMotion,
  responseProgress,
  rotationDeg,
  triggered,
}) {
  const mainRotation = reducedMotion ? 0 : rotationDeg;
  const strikeWindow = triggered
    ? Math.sin(clampUnit(responseProgress / 0.58) * Math.PI)
    : 0;
  const releaseWindow = triggered
    ? Math.sin(clampUnit((responseProgress - 0.12) / 0.76) * Math.PI)
    : 0;
  const direction = mainRotation < 0 ? -1 : 1;
  const strikerRotation = reducedMotion ? 0 : strikeWindow * 14 * direction;
  const paperRotation = reducedMotion
    ? 0
    : -(releaseWindow * 9 * direction);
  const pulseProgress = triggered
    ? Math.sin(clampUnit((responseProgress - 0.1) / 0.56) * Math.PI)
    : 0;

  return Object.freeze({
    mainRotation,
    strikerRotation,
    paperRotation,
    // Landing owns an authored response cue rather than a physical contact.
    impactX: -direction * ZEN_FURIN_GEOMETRY.bellInnerHalfWidth,
    impactScale: 0.35 + (pulseProgress * 1.8),
    impactOpacity: reducedMotion ? 0 : pulseProgress * 0.28,
  });
}

export default function ZenLandingFurin({
  opacity,
  reducedMotion,
  responseProgress,
  rotationDeg,
  triggered,
}) {
  const resolvedOpacity = requireUnitInterval(opacity, 'OPACITY');
  const resolvedRotationDeg = requireFiniteNumber(rotationDeg, 'ROTATION_DEG');
  const resolvedResponseProgress = requireUnitInterval(responseProgress, 'RESPONSE_PROGRESS');
  const isTriggered = requireBoolean(triggered, 'TRIGGERED');
  const isReducedMotion = requireBoolean(reducedMotion, 'REDUCED_MOTION');
  const pose = useMemo(() => resolveLandingFurinPose({
    reducedMotion: isReducedMotion,
    responseProgress: resolvedResponseProgress,
    rotationDeg: resolvedRotationDeg,
    triggered: isTriggered,
  }), [isReducedMotion, isTriggered, resolvedResponseProgress, resolvedRotationDeg]);
  const signalState = !isTriggered
    ? 'armed'
    : resolvedResponseProgress >= 1
      ? 'settled'
      : 'ringing';

  return (
    <div
      className="zenLandingArtifact zenLandingFurinActual"
      data-reduced-motion={isReducedMotion ? 'true' : 'false'}
      data-signal-state={signalState}
      data-scene-source="zen-furin-live-recipe"
      style={{ opacity: resolvedOpacity }}
      aria-hidden="true"
    >
      <ZenFurinScene
        ambientVisualWeight={clampUnit(0.28 + (resolvedOpacity * 0.72))}
        color="var(--zen-landing-flare)"
        isSimulationLive={false}
        mainRotation={pose.mainRotation}
        mantra={LANDING_FURIN_MANTRA}
        paperRotation={pose.paperRotation}
        particleCount={0}
        impactX={pose.impactX}
        impactScale={pose.impactScale}
        impactOpacity={pose.impactOpacity}
        shouldAnimateAmbientGlow={false}
        shouldAnimateVisual={false}
        shouldRunSimulation={false}
        settleTransitionDuration={isReducedMotion ? 0 : 0.2}
        strikerRotation={pose.strikerRotation}
      />
    </div>
  );
}
