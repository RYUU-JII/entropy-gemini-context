import React from 'react';
import { createArtifactSvgViewBox } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';

const ICON_VIEW_BOX = createArtifactSvgViewBox(24, 24);
const SCP_ICONS = Object.freeze({
  lens: () => <><path d="M5 17h14v4H5Z" /><path d="M9 17v-3m6 3v-3" /><circle cx="12" cy="8" r="6" /><circle cx="12" cy="8" r="3" /><path d="M12 3v2m0 6v2M7 8h2m6 0h2" /></>,
  veil: () => <><path d="M5 3h12l3 3v15H5Z" /><path d="M8 7h9M8 11h7M8 15h9" strokeWidth="2.5" /><path d="M4 19h17" /></>,
  brake: () => <><path d="M3 5h6l2 3v8H7V9H3Zm18 0h-6l-2 3v8h4V9h4Z" /><path d="M12 2v18M6 21h12" /><path d="M9 11h6m-6 3h6" /></>,
  barrier: () => <><path d="m8 2-3 3v14l3 3h8l3-3V5l-3-3Z" /><path d="M8 6h8v12H8ZM3 8h4m10 0h4M3 16h4m10 0h4" /></>,
  gate: () => <><path d="M3 3h18v18H3Z" /><circle cx="12" cy="12" r="7" /><path d="m12 5-2 7 7-2m2 2-7-2 2 7m-2 2 2-7-7 2m-2-2 7 2-2-7" /></>,
  flare: () => <><path d="M8 20h8v2H8Zm2-8h4v8h-4ZM6 7a6 6 0 0 1 12 0v5H6Z" /><path d="M9 6h6v3H9ZM2 7h2m16 0h2M4 2l2 2m12 0 2-2" /></>,
  echo: () => <><path d="M6 2h12v16H6ZM3 17h18v5H3Z" /><path d="M9 5h6m-6 3h6M8 14h8M8 18v2m3-2v2m3-2v2m3-2v2" /><path d="M8 11h8" strokeWidth="2.5" /></>,
});

export default function SCPArtifactIcons({ artifactKey, className, color, ...props }) {
  if (!Object.prototype.hasOwnProperty.call(SCP_ICONS, artifactKey)) {
    throw new Error(`ARTIFACT_ICON_KEY_UNDECLARED:scp:${artifactKey}`);
  }
  const Icon = SCP_ICONS[artifactKey];
  return <svg viewBox={ICON_VIEW_BOX} fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="square" strokeLinejoin="miter" className={className} color={color} focusable="false" {...props}>
    <Icon />
  </svg>;
}
