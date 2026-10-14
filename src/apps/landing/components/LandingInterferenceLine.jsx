import React from 'react';

import { resolveLandingLensTextProjection } from '../experience/index.js';

export default function LandingInterferenceLine({ label, progress, sourceText }) {
  if (typeof label !== 'string' || !label.trim()) {
    throw new Error('LANDING_INTERFERENCE_LABEL_REQUIRED');
  }
  const projection = resolveLandingLensTextProjection({ sourceText, progress });

  return (
    <div
      className="landing-interference-line"
      data-profile-band={projection.profile.band}
      data-projection-step={projection.projectionStep}
      style={{
        '--landing-interference': projection.steppedProgress,
        '--landing-interference-blur': projection.profile.textBlur,
        '--landing-interference-opacity': projection.profile.textOpacity,
      }}
    >
      <span className="sr-only">{label}</span>
      <span className="landing-interference-line__visual" aria-hidden="true">
        {projection.projectedText}
      </span>
    </div>
  );
}
