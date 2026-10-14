import React from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { createArtifactSvgViewBox, ARTIFACT_SVG_FILTER_REGIONS } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
import { useArtifactSvgIdScope } from '@/themes/core/artifacts/scene/useArtifactSvgIdScope.js';
import { SCP_ARTIFACT_PALETTE as p } from './scpArtifactPalette.js';

const VIEW_BOX = createArtifactSvgViewBox(420, 420);

// A synchronous vector body keeps readiness with ArtifactRenderStage. This
// envelope owns only material definitions, never a second canvas or clock.
export default function SCPArtifactFrame({ presentation, children }) {
  const idScope = useArtifactSvgIdScope(`scp-${presentation.familyId}`);
  const { t } = useAppTranslation('tools');
  const ids = Object.fromEntries(['title', 'metal', 'edge', 'paper', 'glass', 'well', 'hazard', 'glow', 'opticalGrayscale', 'opticalBlur']
    .map(key => [key, idScope.get(key)]));
  const { familyId, channels, accent } = presentation;

  return (
    <svg viewBox={VIEW_BOX} width="360" height="360" className="pointer-events-none block overflow-visible"
      role="img" aria-labelledby={ids.title} focusable="false"
      data-scp-artifact={familyId} data-scp-artifact-phase={channels.renderState.phase}
      data-scp-artifact-motion={presentation.shouldAnimateMotion ? channels.motionBudgetMode : 'still'}
      data-scp-artifact-configured={channels.activity.configuredActive === true ? 'true' : 'false'}
      data-scp-artifact-runtime-active={channels.activity.isRuntimeActive === true ? 'true' : 'false'}>
      <title id={ids.title}>{t(`artifacts.${familyId}.title`)}</title>
      <defs>
        <linearGradient id={ids.metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.brushed} /><stop offset="0.22" stopColor={p.steel} />
          <stop offset="0.6" stopColor={p.charcoal} /><stop offset="0.88" stopColor={p.recess} />
          <stop offset="1" stopColor={p.steel} />
        </linearGradient>
        <linearGradient id={ids.edge} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={p.recess} /><stop offset="0.45" stopColor={p.brushed} />
          <stop offset="0.55" stopColor={p.ivory} /><stop offset="1" stopColor={p.steel} />
        </linearGradient>
        <linearGradient id={ids.paper} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={p.ivory} /><stop offset="1" stopColor={p.paperEdge} />
        </linearGradient>
        <linearGradient id={ids.glass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.ivory} stopOpacity="0.5" />
          <stop offset="0.38" stopColor={accent} stopOpacity="0.16" />
          <stop offset="1" stopColor={p.recess} stopOpacity="0.92" />
        </linearGradient>
        <radialGradient id={ids.well} cx="0.45" cy="0.36" r="0.65">
          <stop offset="0" stopColor={p.steel} /><stop offset="1" stopColor={p.recess} />
        </radialGradient>
        <pattern id={ids.hazard} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
          <rect width="12" height="12" fill={p.ink} /><rect width="5" height="12" fill={p.amber} />
        </pattern>
        <filter id={ids.glow} {...ARTIFACT_SVG_FILTER_REGIONS.objectGlow}>
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <path d="M52 380H158m104 0h106M66 374v12m288-12v12" stroke={p.steelEdge} strokeWidth="1" />
      {children({ ids, palette: p })}
    </svg>
  );
}
