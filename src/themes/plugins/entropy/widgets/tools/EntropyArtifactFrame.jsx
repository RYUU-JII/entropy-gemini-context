import React from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactSvgIdScope } from '@/themes/core/artifacts/scene/useArtifactSvgIdScope.js';
import { ARTIFACT_SVG_FILTER_REGIONS, createArtifactSvgViewBox } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
import { ENTROPY_ARTIFACT_PALETTE as p } from './entropyArtifactPalette.js';

const VIEW_BOX = createArtifactSvgViewBox(420, 420);

// Static materials only: ArtifactRenderStage owns readiness and placement. Each
// synchronous vector instrument meets the same floor without another driver.
export default function EntropyArtifactFrame({ presentation, children }) {
  const { familyId, channels } = presentation;
  const scope = useArtifactSvgIdScope(`entropy-${familyId}`);
  const { t } = useAppTranslation('tools');
  const ids = Object.fromEntries(['title', 'hull', 'metal', 'edge', 'glass', 'optic', 'monolith', 'shadow', 'glow', 'mesh']
    .map(key => [key, scope.get(key)]));
  return <svg viewBox={VIEW_BOX} width="360" height="360" role="img" aria-labelledby={ids.title}
    focusable="false" className="pointer-events-none block overflow-visible"
    data-entropy-artifact={familyId} data-artifact-runtime-state={channels.renderState.runtimeState}
    data-artifact-motion-mode={presentation.shouldAnimateMotion ? channels.motionBudgetMode : 'still'}
    data-artifact-configured={String(channels.activity.configuredActive)}
    data-artifact-runtime-active={String(channels.activity.isRuntimeActive)}>
    <title id={ids.title}>{t(`artifacts.${familyId}.title`)}</title>
    <defs>
      <linearGradient id={ids.hull} x1="0" y1="0" x2="0.85" y2="1">
        <stop stopColor={p.white} /><stop offset="0.4" stopColor={p.plastic} /><stop offset="1" stopColor={p.plasticEdge} />
      </linearGradient>
      <linearGradient id={ids.metal} x1="0" y1="0" x2="1" y2="0">
        <stop stopColor={p.metalEdge} /><stop offset="0.18" stopColor={p.metal} /><stop offset="0.44" stopColor={p.white} />
        <stop offset="0.52" stopColor={p.metal} /><stop offset="1" stopColor={p.metalEdge} />
      </linearGradient>
      <linearGradient id={ids.edge} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor={p.metal} /><stop offset="1" stopColor={p.graphite} />
      </linearGradient>
      <linearGradient id={ids.glass} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor={p.white} stopOpacity="0.3" /><stop offset="0.24" stopColor={p.recess} stopOpacity="0.84" />
        <stop offset="1" stopColor={p.graphite} stopOpacity="0.98" />
      </linearGradient>
      <radialGradient id={ids.optic} cx="0.36" cy="0.3" r="0.7">
        <stop stopColor={p.metalEdge} /><stop offset="0.3" stopColor={p.graphite} /><stop offset="1" stopColor={p.recess} />
      </radialGradient>
      <linearGradient id={ids.monolith} x1="0" y1="0" x2="1" y2="0.15">
        <stop stopColor={p.recess} /><stop offset="0.88" stopColor={p.recess} /><stop offset="1" stopColor={p.graphite} />
      </linearGradient>
      <pattern id={ids.mesh} width="7" height="7" patternUnits="userSpaceOnUse">
        <path d="M0 0h7v7" fill="none" stroke={p.metal} strokeWidth="0.65" opacity="0.42" />
      </pattern>
      <filter id={ids.shadow} {...ARTIFACT_SVG_FILTER_REGIONS.objectGlow}>
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor={p.recess} floodOpacity="0.2" />
      </filter>
      <filter id={ids.glow} {...ARTIFACT_SVG_FILTER_REGIONS.objectGlow}>
        <feGaussianBlur stdDeviation="1.8" />
      </filter>
    </defs>
    <g transform="translate(0 20)">
      <ellipse cx="210" cy="396" rx="114" ry="4" fill={p.recess} opacity="0.24" />
      {children({ ids, palette: p })}
    </g>
  </svg>;
}
