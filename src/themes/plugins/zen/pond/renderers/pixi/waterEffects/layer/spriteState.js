import { createPixiWaterEffectsSpriteFactory } from '../../pixiWaterEffectsSpriteFactory.js';

export const createWaterEffectsSpriteState = ({
    width,
    height,
    webGLVersion,
    cloudReflectionToggleEnabled,
    textures,
    pebbleDetailTextureSize,
    causticTextureSize,
}) => {
    const spriteFactory = createPixiWaterEffectsSpriteFactory({
        width,
        height,
        webGLVersion,
        cloudReflectionToggleEnabled,
        pebbleTexture: textures.pebbleTexture,
        pebbleTextureDetail: textures.pebbleTextureDetail,
        causticTexture: textures.causticTexture,
        mistTexture: textures.mistTexture,
        canopyDirectOcclusionTexture: textures.canopyDirectOcclusionTexture,
        canopySkyOcclusionTexture: textures.canopySkyOcclusionTexture,
        pebbleDetailTextureSize,
        causticTextureSize,
    });

    return {
        ...spriteFactory,
    };
};
