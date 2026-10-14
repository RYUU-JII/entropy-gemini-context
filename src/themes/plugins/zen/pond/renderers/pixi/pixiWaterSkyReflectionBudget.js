import { ZEN_WORLD_CLOUD_FIELD_SIZE } from '../../../runtime/environment/zenWorldCloudField.js';

// One immutable density texture; sampled inside the existing surface filter.
export const ZEN_WATER_SKY_REFLECTION_BUDGET = Object.freeze({
    textureCount: 1,
    textureSize: ZEN_WORLD_CLOUD_FIELD_SIZE,
    textureBytes: ZEN_WORLD_CLOUD_FIELD_SIZE * ZEN_WORLD_CLOUD_FIELD_SIZE * 4,
    spriteCount: 0,
    additionalRenderPasses: 0,
    reflectionFetchesPerPixel: 5,
});
