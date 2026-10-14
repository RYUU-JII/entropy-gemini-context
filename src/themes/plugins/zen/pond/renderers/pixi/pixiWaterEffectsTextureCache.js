import {
    WRAP_MODES,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { hasCanvas2dSupport } from './waterEffects/textureBake/canvas2d.js';
import {
    flushPixiTextureDisposalQueue,
    queuePixiTextureDisposal,
} from '../../../shared/pixiDeferredTextureDisposal.js';

const SHARED_WATER_TEXTURE_CACHE = new Map();
let SHARED_WATER_TEXTURE_CACHE_GENERATION_KEY = '';
let SHARED_WATER_TEXTURE_CURRENT_KEY = '';
let CANVAS_TEXTURE_BAKE_SUPPORTED = null;

const destroySharedWaterTextureEntry = (entry, { immediate = false } = {}) => {
    if (!entry || typeof entry !== 'object') return;
    const textures = entry.textures || {};
    const unique = new Set();
    const destroyTexture = (texture) => {
        if (!texture || unique.has(texture)) return;
        unique.add(texture);
        queuePixiTextureDisposal(texture, { destroyBase: true, immediate });
    };
    destroyTexture(textures.pebbleTexture);
    destroyTexture(textures.pebbleTextureDetail);
    destroyTexture(textures.causticTexture);
    destroyTexture(textures.mistTexture);
    destroyTexture(textures.canopyDirectOcclusionTexture);
    destroyTexture(textures.canopySkyOcclusionTexture);
};

const pruneSharedWaterTextureCache = () => {
    flushPixiTextureDisposalQueue();
    for (const [key, entry] of SHARED_WATER_TEXTURE_CACHE.entries()) {
        if (!entry || typeof entry !== 'object') {
            SHARED_WATER_TEXTURE_CACHE.delete(key);
            continue;
        }
        if ((Number(entry.refCount) || 0) > 0) continue;
        const staleGeneration = entry.generationKey !== SHARED_WATER_TEXTURE_CACHE_GENERATION_KEY;
        const staleCurrentKey = key !== SHARED_WATER_TEXTURE_CURRENT_KEY;
        if (staleGeneration || staleCurrentKey) {
            SHARED_WATER_TEXTURE_CACHE.delete(key);
            destroySharedWaterTextureEntry(entry);
        }
    }
};

const clearSharedWaterTextureCache = () => {
    for (const entry of SHARED_WATER_TEXTURE_CACHE.values()) {
        destroySharedWaterTextureEntry(entry, { immediate: true });
    }
    SHARED_WATER_TEXTURE_CACHE.clear();
    SHARED_WATER_TEXTURE_CURRENT_KEY = '';
};

const ensureSharedWaterTextureCacheGeneration = (generationKey = '') => {
    if (SHARED_WATER_TEXTURE_CACHE_GENERATION_KEY === generationKey) return;
    SHARED_WATER_TEXTURE_CACHE_GENERATION_KEY = generationKey;
    pruneSharedWaterTextureCache();
};

const acquireSharedWaterTextureEntry = (cacheKey, buildTextures) => {
    SHARED_WATER_TEXTURE_CURRENT_KEY = cacheKey;
    pruneSharedWaterTextureCache();
    const cached = SHARED_WATER_TEXTURE_CACHE.get(cacheKey);
    if (cached) {
        cached.refCount = (Number(cached.refCount) || 0) + 1;
        return cached;
    }
    const created = buildTextures();
    const entry = {
        refCount: 1,
        textures: created,
        key: cacheKey,
        generationKey: SHARED_WATER_TEXTURE_CACHE_GENERATION_KEY,
    };
    SHARED_WATER_TEXTURE_CACHE.set(cacheKey, entry);
    pruneSharedWaterTextureCache();
    return entry;
};

const hasSharedWaterTextureEntry = (cacheKey) => (
    SHARED_WATER_TEXTURE_CACHE.has(cacheKey)
);

const releaseSharedWaterTextureEntry = (cacheKey) => {
    const entry = SHARED_WATER_TEXTURE_CACHE.get(cacheKey);
    if (!entry) return;
    entry.refCount = Math.max(0, (Number(entry.refCount) || 0) - 1);
    if (entry.refCount <= 0) {
        if (SHARED_WATER_TEXTURE_CURRENT_KEY === cacheKey) {
            SHARED_WATER_TEXTURE_CURRENT_KEY = '';
        }
    }
    pruneSharedWaterTextureCache();
};

const canBakeCanvasTextures = () => {
    if (CANVAS_TEXTURE_BAKE_SUPPORTED !== null) {
        return CANVAS_TEXTURE_BAKE_SUPPORTED;
    }
    CANVAS_TEXTURE_BAKE_SUPPORTED = hasCanvas2dSupport();
    return CANVAS_TEXTURE_BAKE_SUPPORTED;
};

const configureRepeatTexture = (texture) => {
    const baseTexture = texture?.baseTexture;
    if (!baseTexture) return;
    baseTexture.wrapMode = WRAP_MODES.REPEAT;
    baseTexture.update();
};

export {
    acquireSharedWaterTextureEntry,
    canBakeCanvasTextures,
    clearSharedWaterTextureCache,
    configureRepeatTexture,
    ensureSharedWaterTextureCacheGeneration,
    hasSharedWaterTextureEntry,
    releaseSharedWaterTextureEntry,
};
