import React, { memo, useMemo } from 'react';

import ArtifactSvgStage from '../../../../../core/artifacts/scene/ArtifactSvgStage.jsx';
import { createArtifactSvgViewBox } from '../../../../../core/artifacts/scene/artifactSvgCoordinateSystem.js';
import { useArtifactSvgIdScope } from '../../../../../core/artifacts/scene/useArtifactSvgIdScope.js';
import {
  ZEN_FURIN_STAGE_HEIGHT,
  ZEN_FURIN_STAGE_WIDTH,
  buildZenFurinScene,
} from '../recipes/zenFurinSceneRecipe.jsx';

const ZEN_FURIN_VIEW_BOX = createArtifactSvgViewBox(
  ZEN_FURIN_STAGE_WIDTH,
  ZEN_FURIN_STAGE_HEIGHT,
);

function requireRotation(value, field) {
  if (value === null || value === undefined) {
    throw new Error(`ZEN_FURIN_SCENE_${field}_REQUIRED`);
  }
  return value;
}

function requireUnitInterval(value, field) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`ZEN_FURIN_SCENE_${field}_INVALID`);
  }
  return value;
}

function requireNonNegativeDuration(value, field) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`ZEN_FURIN_SCENE_${field}_INVALID`);
  }
  return value;
}

function ZenFurinScene({
  ambientVisualWeight,
  bellShimmer = 0,
  className = '',
  color,
  isSimulationLive,
  mainRotation,
  mantra,
  paperRotation,
  paperSkew = 0,
  paperYaw = 0,
  particleCount = 0,
  impactX = 0,
  impactScale = 0.35,
  impactOpacity = 0,
  shouldAnimateAmbientGlow,
  shouldAnimateVisual,
  shouldRunSimulation,
  settleTransitionDuration = 0.2,
  strikerRotation,
  style,
}) {
  const idScope = useArtifactSvgIdScope('zen-furin-scene');
  const resolvedAmbientVisualWeight = requireUnitInterval(
    ambientVisualWeight,
    'AMBIENT_VISUAL_WEIGHT',
  );
  if (typeof color !== 'string' || !color.trim()) {
    throw new Error('ZEN_FURIN_SCENE_COLOR_REQUIRED');
  }
  if (!Array.isArray(mantra) || mantra.length === 0) {
    throw new Error('ZEN_FURIN_SCENE_MANTRA_REQUIRED');
  }
  const resolvedSettleTransitionDuration = requireNonNegativeDuration(
    settleTransitionDuration,
    'SETTLE_TRANSITION_DURATION',
  );

  const scene = useMemo(() => buildZenFurinScene({
    idScope,
    color,
    mainRotation: requireRotation(mainRotation, 'MAIN_ROTATION'),
    strikerRotation: requireRotation(strikerRotation, 'STRIKER_ROTATION'),
    paperRotation: requireRotation(paperRotation, 'PAPER_ROTATION'),
    paperYaw,
    paperSkew,
    bellShimmer,
    impactX,
    impactScale,
    impactOpacity,
    mantra,
    shouldAnimateAmbientGlow: shouldAnimateAmbientGlow === true,
    shouldRunSimulation: shouldRunSimulation === true,
    isSimulationLive: isSimulationLive === true,
    ambientVisualWeight: resolvedAmbientVisualWeight,
    particleCount: Math.max(0, Math.floor(Number(particleCount) || 0)),
    shouldAnimateVisual: shouldAnimateVisual === true,
    settleTransitionDuration: resolvedSettleTransitionDuration,
  }), [
    bellShimmer,
    color,
    idScope,
    isSimulationLive,
    mainRotation,
    mantra,
    paperRotation,
    paperSkew,
    paperYaw,
    particleCount,
    impactX,
    impactScale,
    impactOpacity,
    resolvedAmbientVisualWeight,
    resolvedSettleTransitionDuration,
    shouldAnimateAmbientGlow,
    shouldAnimateVisual,
    shouldRunSimulation,
    strikerRotation,
  ]);

  return (
    <ArtifactSvgStage
      width={ZEN_FURIN_STAGE_WIDTH}
      height={ZEN_FURIN_STAGE_HEIGHT}
      viewBox={ZEN_FURIN_VIEW_BOX}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
        ...style,
      }}
      defs={scene.defs}
      nodes={scene.nodes}
      aria-hidden="true"
      focusable="false"
    />
  );
}

export default memo(ZenFurinScene);
