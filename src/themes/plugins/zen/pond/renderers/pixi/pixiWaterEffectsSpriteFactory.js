import {
    BLEND_MODES,
    Texture,
    TilingSprite,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { ZenCanopyLightTransferMesh } from './waterEffects/passes/ZenCanopyLightTransferMesh.js';

export const createPixiWaterEffectsSpriteFactory = ({
    width,
    height,
    webGLVersion,
    pebbleTexture,
    pebbleTextureDetail,
    causticTexture,
    mistTexture,
    canopyDirectOcclusionTexture,
    canopySkyOcclusionTexture,
    pebbleDetailTextureSize,
    causticTextureSize,
}) => {
    const safePebbleSize = Math.max(1, Number(pebbleDetailTextureSize) || 256);
    const safeCausticSize = Math.max(1, Number(causticTextureSize) || 256);

    const pebbleSprite = new TilingSprite(pebbleTexture, width, height);
    // These two nodes remain the canonical material descriptors (including
    // alpha, tint and tiling) and bake signature inputs. The floor filter
    // samples them together with the actual backdrop instead of drawing them.
    pebbleSprite.renderable = false;
    pebbleSprite.alpha = 0.45;
    pebbleSprite.tilePosition.set(Math.random() * safePebbleSize, Math.random() * safePebbleSize);

    const pebbleDetailSprite = new TilingSprite(pebbleTextureDetail, width, height);
    pebbleDetailSprite.renderable = false;
    pebbleDetailSprite.alpha = 0.14;
    pebbleDetailSprite.tileScale.set(1.37, 1.29);
    pebbleDetailSprite.tilePosition.set(Math.random() * safePebbleSize, Math.random() * safePebbleSize);

    const waterAtmosphereSprite = new TilingSprite(mistTexture || Texture.WHITE, width, height);
    waterAtmosphereSprite.blendMode = BLEND_MODES.NORMAL;
    waterAtmosphereSprite.alpha = 0.08;
    waterAtmosphereSprite.tileScale.set(2.1, 1.95);

    const topShadowPrimarySprite = new ZenCanopyLightTransferMesh({
        width,
        height,
        webGLVersion,
        directOcclusionTexture: canopyDirectOcclusionTexture,
        skyOcclusionTexture: canopySkyOcclusionTexture,
    });

    const causticLayerPrimary = new TilingSprite(causticTexture, width, height);
    causticLayerPrimary.blendMode = BLEND_MODES.SCREEN;
    causticLayerPrimary.tileScale.set(1.6, 1.6);
    causticLayerPrimary.alpha = 0;
    causticLayerPrimary.visible = false;

    const causticLayerSecondary = new TilingSprite(causticTexture, width, height);
    causticLayerSecondary.blendMode = BLEND_MODES.SCREEN;
    causticLayerSecondary.tileScale.set(1.3, 1.3);
    causticLayerSecondary.alpha = 0;
    causticLayerSecondary.visible = false;

    const refractedGuideSprite = new TilingSprite(causticTexture || Texture.WHITE, width, height);
    refractedGuideSprite.blendMode = BLEND_MODES.NORMAL;
    refractedGuideSprite.tileScale.set(1.24, 1.16);
    refractedGuideSprite.tilePosition.set(Math.random() * safeCausticSize, Math.random() * safeCausticSize);
    refractedGuideSprite.alpha = 0;
    refractedGuideSprite.visible = false;

    // Sky reflection is sampled by the surface-field filter. These scene graph
    // lists deliberately contain no refracted cloud display objects.
    const cloudReflectionPrimaryStates = Object.freeze([]);
    const cloudReflectionDetailStates = Object.freeze([]);

    const benthicObjects = Object.freeze([
        pebbleSprite,
        pebbleDetailSprite,
    ]);
    const refractedSurfaceObjects = Object.freeze([
        refractedGuideSprite,
    ]);
    const cloudReflectionObjects = Object.freeze([
        ...cloudReflectionPrimaryStates.map((state) => state.sprite),
    ]);
    const topShadowObjects = Object.freeze([
        topShadowPrimarySprite,
    ]);
    const surfaceObjects = Object.freeze([
        waterAtmosphereSprite,
        causticLayerPrimary,
        causticLayerSecondary,
    ]);
    const displayObjects = Object.freeze([
        ...benthicObjects,
        ...refractedSurfaceObjects,
        ...cloudReflectionObjects,
        ...surfaceObjects,
        ...topShadowObjects,
    ]);

    return {
        pebbleSprite,
        pebbleDetailSprite,
        waterAtmosphereSprite,
        topShadowPrimarySprite,
        causticLayerPrimary,
        causticLayerSecondary,
        cloudReflectionPrimaryStates,
        cloudReflectionDetailStates,
        benthicObjects,
        refractedSurfaceObjects,
        cloudReflectionObjects,
        topShadowObjects,
        surfaceObjects,
        displayObjects,
        frame: 0,
        bootElapsedMs: 0,
        topShadowDriftState: {
            phaseX: Math.random() * Math.PI * 2,
            phaseY: Math.random() * Math.PI * 2,
        },
        causticDriftState: {
            primaryU: Math.random() * safeCausticSize,
            primaryV: Math.random() * safeCausticSize,
            secondaryU: Math.random() * safeCausticSize,
            secondaryV: Math.random() * safeCausticSize,
        },
        atmosphereDriftState: {
            x: Math.random() * 512,
            y: Math.random() * 512,
        },
        sunlightIntensityState: 0,
        cachedLightHex: 0xfff0ca,
    };
};
