import React from 'react';
import ZenShojiVisualCore from '../../artifacts/shoji/ZenShojiVisualCore.jsx';
import './ZenLandingShoji.css';

function requireUnitInterval(value, field) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`ZEN_LANDING_SHOJI_${field}_INVALID`);
  }
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new Error(`ZEN_LANDING_SHOJI_${field}_INVALID`);
  }
  return value;
}

export default function ZenLandingShoji({ intensity, nightDepth, opacity, reducedMotion }) {
  const resolvedIntensity = requireUnitInterval(intensity, 'INTENSITY');
  const resolvedNightDepth = requireUnitInterval(nightDepth, 'NIGHT_DEPTH');
  const resolvedOpacity = requireUnitInterval(opacity, 'OPACITY');
  const resolvedReducedMotion = requireBoolean(reducedMotion, 'REDUCED_MOTION');
  const shouldAnimateFloat = !resolvedReducedMotion && resolvedOpacity > 0;

  return (
    <div
      className="zenLandingArtifact zenLandingShojiShared"
      style={{
        '--zen-landing-shoji-intensity': resolvedIntensity,
        '--zen-landing-shoji-opacity': resolvedOpacity,
      }}
      aria-hidden="true"
      data-zen-landing-shoji-source="shared-visual-core"
    >
      <div className="zenLandingShojiShared__visual">
        <ZenShojiVisualCore
          nightDepth={resolvedNightDepth}
          shouldAnimateFloat={shouldAnimateFloat}
          motionBudgetMode={shouldAnimateFloat ? 'ambient' : 'still'}
          ariaHidden
          ariaLabel={null}
        />
      </div>
    </div>
  );
}
