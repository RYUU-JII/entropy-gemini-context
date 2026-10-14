import { clamp as clampValue } from '../../../../model/koi/koiMotion.js';
import { smoothTowards } from '../../pixiWaterEffectsMath.js';
import {
    resolveZenCanopyLightTransfer,
    sampleZenCanopyLightTransfer,
} from './zenCanopyLightTransfer.js';

// A single transfer of existing direct/diffuse illumination. Leaf gaps preserve
// direct light; they never screen a second dose of sunlight onto open water.
export const updateCanopyPass = ({
    frame,
    deltaFrames,
    visibleWorldBounds,
    shadowLight,
    unifiedWindIntensity,
    godRaysGate,
    stagedRayGate,
    topShadowPrimarySprite,
    topShadowDriftState,
    topShadowPrimaryAlphaState,
    komorebiEnabled,
}) => {
    const transfer = resolveZenCanopyLightTransfer(shadowLight);
    const elevation = Math.max(0, transfer.shadowLight.sunZ);
    const targetAmount = clampValue(Math.min(godRaysGate, stagedRayGate), 0, 1);
    const amount = smoothTowards(topShadowPrimaryAlphaState, targetAmount, deltaFrames, 14);
    topShadowPrimarySprite.setLightTransfer({
        ...transfer,
        gapEnabled: komorebiEnabled,
        amount,
    });

    topShadowPrimarySprite.setCanopyLayout(visibleWorldBounds);
    const extent = Math.min(visibleWorldBounds.width, visibleWorldBounds.height);
    topShadowPrimarySprite.setProjection({
        shadowLight: transfer.shadowLight,
        extent,
        windX: Math.sin(frame * 0.00042 + topShadowDriftState.phaseX) * (0.45 + unifiedWindIntensity * 0.8),
        windY: Math.cos(frame * 0.00036 + topShadowDriftState.phaseY) * (0.35 + unifiedWindIntensity * 0.6),
    });

    const directContrast = transfer.directShare.reduce((sum, value) => sum + value, 0) / 3;
    const skyContrast = transfer.skyShare.reduce((sum, value) => sum + value, 0) / 3;
    const gapContrast = komorebiEnabled ? directContrast * amount : 0;
    const komorebiActive = topShadowPrimarySprite.visible && gapContrast > 0.001;
    return {
        primaryAlphaMax: 1,
        canopyShadeGate: directContrast + skyContrast,
        canopySunElevationGate: elevation,
        komorebiAlphaState: komorebiActive ? gapContrast : 0,
        komorebiActive,
        canopyDirectContrast: directContrast,
        canopyDiffuseContrast: skyContrast,
        canopyOpenTransfer: [1, 1, 1],
        canopyGapTransfer: sampleZenCanopyLightTransfer({ ...transfer, directOcclusion: 0, skyOcclusion: 1 }),
        canopyShadeTransfer: sampleZenCanopyLightTransfer({ ...transfer, directOcclusion: 1, skyOcclusion: 1 }),
        weatherGate: directContrast + skyContrast > 0 ? 1 : 0,
        topShadowGate: targetAmount,
        baseOpTarget: targetAmount,
        topShadowGainCurve: directContrast + skyContrast,
        topShadowDensityCurve: directContrast + skyContrast,
        topShadowShadowGain: directContrast + skyContrast,
        topShadowPrimaryAlphaState: amount,
        topShadowStretchState: 1,
    };
};
