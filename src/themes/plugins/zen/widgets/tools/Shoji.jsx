import React from 'react';
import ZenShojiVisualCore from '../../presentation/artifacts/shoji/ZenShojiVisualCore.jsx';
import { useZenArtifactRenderChannels } from './useZenArtifactRenderChannels.js';

export default function ZenShoji({
    isActive = true,
    color = '#cbd9d6',
    artifactRenderContext = null,
    artifactRenderState = null,
}) {
    const renderChannels = useZenArtifactRenderChannels({
        artifactRenderContext,
        artifactRenderState,
        color,
        isActive,
    });

    return (
        <ZenShojiVisualCore
            nightDepth={renderChannels.nightDepth}
            shouldAnimateFloat={renderChannels.shouldAnimateActiveVisual}
            motionBudgetMode={renderChannels.motionBudgetMode}
            ariaHidden={false}
            ariaLabel="Shoji cube"
        />
    );
}
