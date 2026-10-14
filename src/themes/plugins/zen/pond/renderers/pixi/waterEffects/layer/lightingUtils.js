import { toRgbHex } from '../../../../runtime/zenColorMath.js';

// Frame channels carry prevalidated numeric color from the world target. No
// alternate string source, cache, or per-frame color projection lives here.
export const resolveWaterLightChannels = ({ sharedChannels }) => ({
    lightChannels: sharedChannels.lightChannels,
});

export const applyWaterLightingState = ({
    lightChannels,
    unifiedTurbidity,
    unifiedScatter,
    pebbleSprite = null,
    pebbleDetailSprite = null,
    causticLayerPrimary = null,
    causticLayerSecondary = null,
    refractedGuideSprite = null,
} = {}) => {
    // Preserve the baked stone pigments. The common material pass owns the
    // solar/sky/moon illumination of these submerged receivers exactly once.
    if (pebbleSprite) pebbleSprite.tint = 0xffffff;
    if (pebbleDetailSprite) pebbleDetailSprite.tint = 0xffffff;

    const causticTint = toRgbHex(lightChannels.r, lightChannels.g, lightChannels.b);
    if (causticLayerPrimary) causticLayerPrimary.tint = causticTint;
    if (causticLayerSecondary) causticLayerSecondary.tint = causticTint;
    if (refractedGuideSprite) refractedGuideSprite.tint = causticTint;

    return {
        // Water-medium pigments remain independent of the color of daylight.
        veilTint: { r: 71, g: 92, b: 104 },
        hazeTint: { r: 150, g: 172, b: 180 },
        veilBaseAlpha: unifiedTurbidity * 0.012,
        hazeBaseAlpha: unifiedScatter * 0.006,
        hazeAntiBloom: 1,
    };
};
