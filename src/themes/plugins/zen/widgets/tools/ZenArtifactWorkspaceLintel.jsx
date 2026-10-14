import React, { useRef } from 'react';

import { getZenArtifactGalleryGeometry } from '../../presentation/artifacts/engine/zenArtifactGalleryGeometry.js';
import './zenArtifactWorkspaceLintel.css';

/**
 * ZenArtifactWorkspaceLintel
 * A lintel that cuts across the workspace for the scenes that hang from one
 * (Furin). It is not an object in the garden but the edge of the room the
 * garden is seen from: translucent, soft-edged, running out over the left
 * threshold and passing behind the control rail.
 *
 * The scene declares the height (`lintelOffsetY`, from the karesansui centre);
 * this layer only paints it, in the workspace coordinates the gallery hands
 * over. It keeps its last height while fading out, so leaving Furin dissolves
 * the beam in place instead of dropping it.
 */
export default function ZenArtifactWorkspaceLintel({ visualKey, anchorY }) {
  const lintelOffsetY = visualKey ? getZenArtifactGalleryGeometry(visualKey).lintelOffsetY : null;
  const present = lintelOffsetY !== null && Number.isFinite(anchorY);
  const lastTopRef = useRef(null);
  if (present) lastTopRef.current = anchorY + lintelOffsetY;
  if (lastTopRef.current === null) return null;

  return (
    <div
      className="zen-artifact-lintel"
      data-zen-artifact-lintel={present ? 'present' : 'absent'}
      style={{ top: `${lastTopRef.current}px` }}
    >
      <span className="zen-artifact-lintel__beam" />
      <span className="zen-artifact-lintel__shadow" />
    </div>
  );
}
