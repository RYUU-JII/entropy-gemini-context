import { createPixiWaterEffectsLayerCore } from './waterEffects/layer/createPixiWaterEffectsLayerCore.js';

// Both canopy reads live in the core now. They used to be split across a core
// pass (shade) and a wrapper layer (komorebi) that baked its own uncorrelated
// texture, which is why the dapple never landed inside its own shadow.
export const createPixiWaterEffectsLayer = (options = {}) => (
    createPixiWaterEffectsLayerCore(options)
);

export { clearSharedWaterTextureCache } from './pixiWaterEffectsTextureCache.js';
