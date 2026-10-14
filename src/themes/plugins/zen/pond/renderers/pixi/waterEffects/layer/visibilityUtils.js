import { setVisibleFromAlpha } from '../../pixiWaterEffectsMath.js';

export const applyWaterEffectsVisibility = ({
    pebbleSprite = null,
    pebbleDetailSprite = null,
    refractedGuideSprite = null,
    waterAtmosphereSprite = null,
    causticLayerPrimary = null,
    causticLayerSecondary = null,
    cloudReflectionObjects = [],
} = {}) => {
    // The canopy pass owns mesh visibility from its actual light transfer.
    // Alpha alone cannot distinguish incident darkness from rendered shade.
    setVisibleFromAlpha(pebbleSprite, 0.001);
    setVisibleFromAlpha(pebbleDetailSprite, 0.001);
    if (refractedGuideSprite) {
        setVisibleFromAlpha(refractedGuideSprite, 0.001);
    }
    setVisibleFromAlpha(waterAtmosphereSprite, 0.001);
    setVisibleFromAlpha(causticLayerPrimary, 0.001);
    setVisibleFromAlpha(causticLayerSecondary, 0.001);
    for (let i = 0; i < cloudReflectionObjects.length; i += 1) {
        setVisibleFromAlpha(cloudReflectionObjects[i], 0.001);
    }
};

export const hideAllWaterEffects = ({
    topShadowPrimarySprite = null,
    pebbleSprite = null,
    pebbleDetailSprite = null,
    refractedGuideSprite = null,
    waterAtmosphereSprite = null,
    causticLayerPrimary = null,
    causticLayerSecondary = null,
    cloudReflectionObjects = [],
} = {}) => {
    if (topShadowPrimarySprite) {
        topShadowPrimarySprite.alpha = 0;
        topShadowPrimarySprite.visible = false;
    }
    if (pebbleSprite) {
        pebbleSprite.alpha = 0;
        pebbleSprite.visible = false;
    }
    if (pebbleDetailSprite) {
        pebbleDetailSprite.alpha = 0;
        pebbleDetailSprite.visible = false;
    }
    if (refractedGuideSprite) {
        refractedGuideSprite.alpha = 0;
        refractedGuideSprite.visible = false;
    }
    if (waterAtmosphereSprite) {
        waterAtmosphereSprite.alpha = 0;
        waterAtmosphereSprite.visible = false;
    }
    if (causticLayerPrimary) {
        causticLayerPrimary.alpha = 0;
        causticLayerPrimary.visible = false;
    }
    if (causticLayerSecondary) {
        causticLayerSecondary.alpha = 0;
        causticLayerSecondary.visible = false;
    }
    for (let i = 0; i < cloudReflectionObjects.length; i += 1) {
        cloudReflectionObjects[i].alpha = 0;
        cloudReflectionObjects[i].visible = false;
    }
};

export const countVisibleCloudsInViewport = ({
    cloudReflectionComputeEnabled = false,
    cloudReflectionObjects = [],
    width = 0,
    height = 0,
} = {}) => {
    let cloudVisibleCount = 0;
    let cloudOnscreenCount = 0;
    if (!cloudReflectionComputeEnabled) {
        return {
            cloudVisibleCount,
            cloudOnscreenCount,
        };
    }

    for (let i = 0; i < cloudReflectionObjects.length; i += 1) {
        const sprite = cloudReflectionObjects[i];
        if (!sprite?.visible) continue;
        cloudVisibleCount += 1;
        const halfW = Math.max(1, Number(sprite.width) || 0) * 0.5;
        const halfH = Math.max(1, Number(sprite.height) || 0) * 0.5;
        const x = Number(sprite.x) || 0;
        const y = Number(sprite.y) || 0;
        const overlapsViewport = (
            x + halfW >= 0
            && x - halfW <= width
            && y + halfH >= 0
            && y - halfH <= height
        );
        if (overlapsViewport) cloudOnscreenCount += 1;
    }

    return {
        cloudVisibleCount,
        cloudOnscreenCount,
    };
};
