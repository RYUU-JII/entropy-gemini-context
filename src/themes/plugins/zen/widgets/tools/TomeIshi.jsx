import React from 'react';
import ArtifactSvgStage from '@/themes/core/artifacts/scene/ArtifactSvgStage.jsx';
import { createArtifactSvgViewBox } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
import { useArtifactSvgIdScope } from '@/themes/core/artifacts/scene/useArtifactSvgIdScope.js';
import { useZenArtifactRenderChannels } from './useZenArtifactRenderChannels.js';

const TOME_ISHI_VIEW_BOX_WIDTH = 340;
const TOME_ISHI_VIEW_BOX_HEIGHT = 280;
const TOME_ISHI_VIEW_BOX = createArtifactSvgViewBox(TOME_ISHI_VIEW_BOX_WIDTH, TOME_ISHI_VIEW_BOX_HEIGHT);

import { buildZenTomeIshiScene } from '../../presentation/artifacts/engine/zenTomeIshiRecipe.jsx';

export default function ZenTomeIshi({
  artifactRenderContext = null,
  artifactRenderState = null,
  color = '#8a6752',
  isActive = true,
}) {
  const ids = useArtifactSvgIdScope('zen-tome-ishi');
  const renderChannels = useZenArtifactRenderChannels({
    artifactRenderContext,
    artifactRenderState,
    color,
    isActive,
  });

  const visualWeight = renderChannels.visualWeight;
  const nightDepth = renderChannels.nightDepth;
  const shouldAnimate = renderChannels.shouldAnimateActiveVisual;

  const scene = buildZenTomeIshiScene({ ids, color: renderChannels.color, visualWeight, nightDepth, shouldAnimate });

  return (
    <div
      className="relative flex h-[280px] w-[340px] items-end justify-center overflow-visible pointer-events-none"
      aria-hidden="true"
      data-tome-ishi-surface="zen-cairn-stone-svg"
      data-tome-ishi-cairn-wrapper="balance-cairn"
    >
      <ArtifactSvgStage
        width={TOME_ISHI_VIEW_BOX_WIDTH}
        height={TOME_ISHI_VIEW_BOX_HEIGHT}
        viewBox={TOME_ISHI_VIEW_BOX}
        className="overflow-visible"
        data-tome-ishi-stage="karesansui-grounded"
        defs={scene.defs}
        nodes={scene.nodes}
      />
    </div>
  );
}
