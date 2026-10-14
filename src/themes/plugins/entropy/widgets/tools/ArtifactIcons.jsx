import React from 'react';
import { createArtifactSvgViewBox } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';

const VIEW_BOX = createArtifactSvgViewBox(24, 24);
const ICONS = Object.freeze({
  lens: <><rect x="3" y="3" width="18" height="15" rx="1" /><circle cx="12" cy="10.5" r="5" /><path d="M8 10.5h8m-4-4v8M8 18v3m8-3v3H8" /></>,
  veil: <><rect x="3" y="4" width="18" height="17" rx="1" /><path d="M6 7h3v10H6zm5 0h3v10h-3zm5 0h3v10h-3zM6 19h12" /></>,
  brake: <><rect x="9" y="5" width="8" height="15" rx="2" /><path d="M13 2v8m-3 0h6m-6 5h6M7 20h13M7 8H5v8h4" /><circle cx="5" cy="15" r="3" /><path d="m5 15 1-1" /></>,
  barrier: <><path d="M8 2h8v18H8zm8 0 2-1v18l-2 1M5 20h15v2H5" /><path d="M20 5v12m0-9h1m-1 3h1m-1 3h1" /></>,
  gate: <><circle cx="12" cy="11" r="9" /><circle cx="12" cy="11" r="6" /><path d="M12 5v6l5 3m-5-3-5 3M3 10h3m12 0h3M7 21h10" /><circle cx="12" cy="11" r="1" /></>,
  flare: <><rect x="6" y="2" width="12" height="19" rx="1" /><circle cx="12" cy="9" r="4" /><circle cx="12" cy="9" r="1" /><path d="M9 16h6m-6 3h6M4 22h16" /></>,
  echo: <><rect x="2" y="4" width="20" height="17" rx="1" /><path d="M5 7h3v10H5zm6 0h3v10h-3zm6 0h3v10h-3zM5 19h15M6 4V2h12v2" /></>,
});

export default function ArtifactIcons({ artifactKey, className, color, ...props }) {
  if (!Object.hasOwn(ICONS, artifactKey)) {
    throw new Error(`ARTIFACT_ICON_KEY_UNDECLARED:entropy:${artifactKey}`);
  }
  return <svg viewBox={VIEW_BOX} fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="square" strokeLinejoin="miter" className={className} color={color}
    focusable="false" {...props}>{ICONS[artifactKey]}</svg>;
}
