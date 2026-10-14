import React from 'react';

import ZenLandingFurin from './layers/ZenLandingFurin.jsx';
import ZenLandingShoji from './layers/ZenLandingShoji.jsx';
import ZenLandingShishiOdoshi from './layers/ZenLandingShishiOdoshi.jsx';
import './ZenLandingStage.css';

const REQUIRED_ARTIFACT_PALETTE_FIELDS = Object.freeze([
  'flare',
  'gate',
  'ink',
  'lens',
  'paper',
]);
const LANDING_MOTION_MODES = new Set(['full', 'reduced']);

function requireArtifactPresentation(presentation) {
  if (
    !presentation
    || typeof presentation !== 'object'
    || !presentation.state
    || !presentation.state.environment
    || !Number.isFinite(presentation.state.environment.nightDepth)
    || !presentation.palette
    || !presentation.layers
    || !presentation.artifactEffects
  ) {
    throw new Error('ZEN_LANDING_ARTIFACT_PRESENTATION_REQUIRED');
  }
  if (!LANDING_MOTION_MODES.has(presentation.state.motionMode)) {
    throw new Error('ZEN_LANDING_ARTIFACT_MOTION_MODE_INVALID');
  }
  const missingPaletteField = REQUIRED_ARTIFACT_PALETTE_FIELDS.find((field) => (
    typeof presentation.palette[field] !== 'string' || !presentation.palette[field].trim()
  ));
  if (missingPaletteField) {
    throw new Error(`ZEN_LANDING_ARTIFACT_PALETTE_REQUIRED:${missingPaletteField}`);
  }
  return presentation;
}

export default function ZenLandingArtifactPlane({ className = '', presentation }) {
  const resolvedPresentation = requireArtifactPresentation(presentation);
  const { motionMode, phase } = resolvedPresentation.state;
  const planeClassName = ['zenLandingArtifactPlane', className].filter(Boolean).join(' ');
  const style = {
    '--zen-landing-flare': resolvedPresentation.palette.flare,
    '--zen-landing-gate': resolvedPresentation.palette.gate,
    '--zen-landing-ink': resolvedPresentation.palette.ink,
    '--zen-landing-lens': resolvedPresentation.palette.lens,
    '--zen-landing-paper': resolvedPresentation.palette.paper,
  };

  return (
    <div
      className={planeClassName}
      data-motion={motionMode}
      data-phase={phase}
      data-shishi-phase={resolvedPresentation.shishiPhase}
      style={style}
      aria-hidden="true"
    >
      <ZenLandingShoji
        intensity={resolvedPresentation.shojiIntensity}
        nightDepth={resolvedPresentation.state.environment.nightDepth}
        opacity={resolvedPresentation.layers.shoji}
        reducedMotion={motionMode === 'reduced'}
      />
      <ZenLandingFurin
        opacity={resolvedPresentation.layers.furin}
        reducedMotion={motionMode === 'reduced'}
        responseProgress={resolvedPresentation.furinResponseProgress}
        rotationDeg={resolvedPresentation.furinRotationDeg}
        triggered={resolvedPresentation.furinTriggered}
      />
      <ZenLandingShishiOdoshi
        fill={resolvedPresentation.shishiFill}
        opacity={resolvedPresentation.layers.shishi}
        phase={resolvedPresentation.shishiPhase}
        reducedMotion={motionMode === 'reduced'}
        tiltDeg={resolvedPresentation.shishiTiltDeg}
      />
    </div>
  );
}
