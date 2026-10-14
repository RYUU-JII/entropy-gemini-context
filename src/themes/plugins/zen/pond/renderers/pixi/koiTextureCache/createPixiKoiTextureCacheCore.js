import { BaseTexture, Texture } from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { parseHexColorSafe } from '../../../model/koi/appearance/colorMath.js';
import { normalizeHistoryAnglesInPlace } from '../../../model/koi/koiMotion.js';
import {
    flushPixiTextureDisposalQueue,
    queuePixiTextureDisposal,
} from '../../../../shared/pixiDeferredTextureDisposal.js';
import {
    FALLBACK_FISH_SIZE,
    KOI_BAKE_RESOLUTION,
    KOI_BODY_BAKE_RESOLUTION,
    KOI_TEXTURE_SAMPLE_OPTIONS,
    MAX_CACHE_ENTRIES,
    MAX_CANVAS_EDGE,
    MAX_SHADOW_CACHE_ENTRIES,
    SHADOW_TAIL_ALPHA_BAKE_FALLBACK,
    SHADOW_TAIL_SEAM_CLEAR_RADIUS_SIZE_FACTOR,
    SHADOW_TAIL_SEAM_CLEAR_RADIUS_SPACING_FACTOR,
    createLinearGradientSafe,
    isFinitePoint,
    toClampedNumber,
    toPositiveInt,
} from './shared.js';
import {
    generateKey,
    generateShadowKey,
    resolveShadowProfileForTexture,
} from './keying.js';
import { createBodyBakeApi } from './bakeBody.js';
import { createFinTailBakeApi } from './bakeFinTail.js';
import { createShadowBakeApi } from './bakeShadow.js';
import { createPixiKoiTextureBakeSource } from './koiTextureBakeSource.js';

// Form and packed coverage are opaque byte data, already complete before upload.
// BufferResource owns these bytes directly; there is no Canvas copy to retain.
export const createPixiKoiRgba8Texture = (source) => {
    if (
        source?.kind !== 'rgba8'
        || !(source.data instanceof Uint8Array)
        || !Number.isInteger(source.width)
        || source.width <= 0
        || source.width > MAX_CANVAS_EDGE
        || !Number.isInteger(source.height)
        || source.height <= 0
        || source.height > MAX_CANVAS_EDGE
        || source.data.byteLength !== source.width * source.height * 4
    ) {
        throw new Error('ZEN_PIXI_KOI_RGBA8_SOURCE_INVALID');
    }
    const baseTexture = BaseTexture.fromBuffer(source.data, source.width, source.height, {
        // fromBuffer otherwise selects different alpha/scale defaults from Canvas.
        ...BaseTexture.defaultOptions,
        ...KOI_TEXTURE_SAMPLE_OPTIONS,
        resolution: KOI_BAKE_RESOLUTION,
    });
    baseTexture.update();
    return new Texture(baseTexture);
};

// A cache of static vector-raster textures and opaque RGBA8 data for Koi fish.
// This prevents drawing the fish vectors on the CPU every frame.
export const createPixiKoiTextureCacheCore = () => {
    const cache = new Map();
    const shadowCache = new Map();
    const disposeHooks = new Set();
    const preparations = new Set();
    let cacheClock = 0;
    let diagnosticsSnapshot = null;
    // One neutral soft-disc primitive is shared by presentation roles.
    // Focus and receiver-shadow owners still own their own blend, tint,
    // geometry, and visibility policy.
    let softDiscTexture = null;

    const createTextureFromCanvas = (canvas, resolution = KOI_BAKE_RESOLUTION) => {
        if (!canvas) return null;
        const textureResolution = toClampedNumber(resolution, KOI_BAKE_RESOLUTION, 0.5, 4);
        const baseTexture = new BaseTexture(canvas, {
            ...KOI_TEXTURE_SAMPLE_OPTIONS,
            resolution: textureResolution,
        });
        baseTexture.scaleMode = KOI_TEXTURE_SAMPLE_OPTIONS.scaleMode;
        baseTexture.mipmap = KOI_TEXTURE_SAMPLE_OPTIONS.mipmap;
        baseTexture.resolution = textureResolution;
        baseTexture.anisotropicLevel = 0;
        baseTexture.update();
        return new Texture(baseTexture);
    };

    const bodyBakeApi = createBodyBakeApi({
        createTextureFromCanvas,
        createTextureFromRgba8: createPixiKoiRgba8Texture,
        normalizeHistoryAnglesInPlace,
        toClampedNumber,
        toPositiveInt,
        isFinitePoint,
        createLinearGradientSafe,
        KOI_BAKE_RESOLUTION,
        KOI_BODY_BAKE_RESOLUTION,
        FALLBACK_FISH_SIZE,
        MAX_CANVAS_EDGE,
    });
    const {
        createCanvas,
        buildBodyBakeData,
        drawBodyBaseTexture,
        drawBodyFormTexture,
    } = bodyBakeApi;

    const { drawFinTexture, drawTailTexture, drawFinShadowAtlas } = createFinTailBakeApi({
        createTextureFromCanvas,
        createTextureFromRgba8: createPixiKoiRgba8Texture,
        createCanvas,
        normalizeHistoryAnglesInPlace,
        parseHexColorSafe,
        toClampedNumber,
        toPositiveInt,
        FALLBACK_FISH_SIZE,
        SHADOW_TAIL_ALPHA_BAKE_FALLBACK,
        SHADOW_TAIL_SEAM_CLEAR_RADIUS_SIZE_FACTOR,
        SHADOW_TAIL_SEAM_CLEAR_RADIUS_SPACING_FACTOR,
    });

    const { drawBodyShadowTexture } = createShadowBakeApi({
        createTextureFromRgba8: createPixiKoiRgba8Texture,
        createCanvas,
    });

    const destroyTexture = (texture, { immediate = false } = {}) => {
        if (texture && texture !== Texture.WHITE && texture !== Texture.EMPTY && !texture.destroyed) {
            queuePixiTextureDisposal(texture, { destroyBase: true, immediate });
        }
    };

    const destroyTextureBundle = (textures = null, { immediate = false } = {}) => {
        if (!textures || typeof textures !== 'object') return;
        destroyTexture(textures.body, { immediate });
        destroyTexture(textures.bodyForm, { immediate });
        destroyTexture(textures.finMain, { immediate });
        destroyTexture(textures.finSub, { immediate });
        destroyTexture(textures.tail, { immediate });
    };

    const destroyShadowTextureBundle = (textures = null, { immediate = false } = {}) => {
        if (!textures || typeof textures !== 'object') return;
        destroyTexture(textures.shadow, { immediate });
        destroyTexture(textures.shadowTail, { immediate });
        destroyTexture(textures.shadowFins, { immediate });
    };

    const pruneCache = () => {
        flushPixiTextureDisposalQueue();
        if (cache.size <= MAX_CACHE_ENTRIES) return;
        const evictable = [];
        for (const [key, record] of cache.entries()) {
            if (!record || typeof record !== 'object') {
                cache.delete(key);
                diagnosticsSnapshot = null;
                continue;
            }
            if ((Number(record.refCount) || 0) > 0) continue;
            evictable.push(record);
        }
        if (!evictable.length) return;
        evictable.sort((a, b) => (Number(a.lastUsed) || 0) - (Number(b.lastUsed) || 0));
        let overflow = cache.size - MAX_CACHE_ENTRIES;
        for (let i = 0; i < evictable.length && overflow > 0; i += 1) {
            const record = evictable[i];
            cache.delete(record.key);
            diagnosticsSnapshot = null;
            destroyTextureBundle(record.textures);
            overflow -= 1;
        }
    };

    const pruneShadowCache = () => {
        flushPixiTextureDisposalQueue();
        if (shadowCache.size <= MAX_SHADOW_CACHE_ENTRIES) return;
        const evictable = [];
        for (const [key, record] of shadowCache.entries()) {
            if (!record || typeof record !== 'object') {
                shadowCache.delete(key);
                diagnosticsSnapshot = null;
                continue;
            }
            if ((Number(record.refCount) || 0) > 0) continue;
            evictable.push(record);
        }
        if (!evictable.length) return;
        evictable.sort((a, b) => (Number(a.lastUsed) || 0) - (Number(b.lastUsed) || 0));
        let overflow = shadowCache.size - MAX_SHADOW_CACHE_ENTRIES;
        for (let i = 0; i < evictable.length && overflow > 0; i += 1) {
            const record = evictable[i];
            shadowCache.delete(record.key);
            diagnosticsSnapshot = null;
            destroyShadowTextureBundle(record.textures);
            overflow -= 1;
        }
    };

    function* bakeTextures(fishInfo, size) {
        const bakeSource = createPixiKoiTextureBakeSource(fishInfo);
        const bakeData = buildBodyBakeData(bakeSource, size);
        const textures = { size };
        let complete = false;
        try {
            const tailTexture = drawTailTexture(bakeSource, size, false);
            textures.tail = tailTexture?.texture || null;
            textures.tailAnchor = tailTexture?.anchor || { x: 0.5, y: 0.5 };
            yield;
            textures.body = bakeData ? drawBodyBaseTexture(bakeSource, size, bakeData) : null;
            yield;
            textures.bodyForm = bakeData ? drawBodyFormTexture(bakeSource, size, bakeData) : null;
            yield;
            textures.finMain = drawFinTexture(bakeSource, size, true);
            yield;
            textures.finSub = drawFinTexture(bakeSource, size, false);
            complete = true;
            return textures;
        } finally {
            if (!complete) destroyTextureBundle(textures);
        }
    }

    const commitBodyRecord = (key, textures) => {
        const record = { key, textures, refCount: 0, lastUsed: ++cacheClock };
        cache.set(key, record);
        diagnosticsSnapshot = null;
        return record;
    };

    const getOrCreateRecord = (fishInfo, key, size) => {
        const cached = cache.get(key);
        if (cached) {
            cached.lastUsed = ++cacheClock;
            return cached;
        }
        const iterator = bakeTextures(fishInfo, size);
        let result;
        do { result = iterator.next(); } while (!result.done);
        return commitBodyRecord(key, result.value);
    };

    const getOrCreateShadowRecord = (fishInfo, key, size, shadowProfile = null) => {
        const cached = shadowCache.get(key);
        if (cached) {
            cached.lastUsed = ++cacheClock;
            return cached;
        }

        const resolvedProfile = resolveShadowProfileForTexture(shadowProfile);
        if (resolvedProfile.enabled === false) return null;
        const bakeSource = createPixiKoiTextureBakeSource(fishInfo);
        const bakeData = buildBodyBakeData(bakeSource, size);
        const textures = {};
        try {
            textures.shadow = bakeData ? drawBodyShadowTexture(bakeSource, size, bakeData, resolvedProfile) : null;
            const tailShadowTexture = drawTailTexture(bakeSource, size, true);
            textures.shadowTail = tailShadowTexture?.texture || null;
            textures.shadowTailAnchor = tailShadowTexture?.anchor || { x: 0.5, y: 0.5 };
            const finShadowAtlas = drawFinShadowAtlas(bakeSource, size);
            textures.shadowFins = finShadowAtlas.texture;
            textures.shadowFinFrames = finShadowAtlas.frames;
            const record = { key, textures, refCount: 0, lastUsed: ++cacheClock };
            shadowCache.set(key, record);
            diagnosticsSnapshot = null;
            return record;
        } catch (error) {
            destroyShadowTextureBundle(textures);
            throw error;
        }
    };

    const acquireSoftDiscTexture = () => {
        if (
            softDiscTexture
            && !softDiscTexture.destroyed
        ) {
            return softDiscTexture;
        }
        const SIZE = 128;
        const { canvas, ctx } = createCanvas(SIZE, SIZE, 1);
        if (!ctx) return null;
        const c = SIZE / 2;
        const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.82)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
        grad.addColorStop(0.78, 'rgba(255, 255, 255, 0.08)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c, c, c, 0, Math.PI * 2);
        ctx.fill();
        softDiscTexture =
            createTextureFromCanvas(canvas, 1);
        return softDiscTexture;
    };

    return {
        prepare(fishInfo) {
            if (preparations.size >= MAX_CACHE_ENTRIES) throw new Error('ZEN_KOI_TEXTURE_PREPARATION_CAPACITY');
            const key = generateKey(fishInfo);
            const size = toClampedNumber(fishInfo.baseSize, FALLBACK_FISH_SIZE, 1, 1024);
            const iterator = bakeTextures(fishInfo, size);
            let finished = false;
            const preparation = {
                key,
                advance() {
                    if (finished) throw new Error('ZEN_KOI_TEXTURE_PREPARATION_FINISHED');
                    try {
                        if (cache.has(key)) {
                            preparation.cancel();
                            return true;
                        }
                        const result = iterator.next();
                        if (!result.done) return false;
                        commitBodyRecord(key, result.value);
                        finished = true;
                        preparations.delete(preparation);
                        return true;
                    } catch (error) {
                        preparation.cancel();
                        throw error;
                    }
                },
                cancel() {
                    if (finished) return;
                    finished = true;
                    preparations.delete(preparation);
                    iterator.return();
                },
            };
            preparations.add(preparation);
            return preparation;
        },
        registerDisposeHook(hook) {
            if (typeof hook !== 'function') {
                throw new TypeError(
                    'ZEN_PIXI_KOI_TEXTURE_CACHE_DISPOSE_HOOK_INVALID',
                );
            }
            disposeHooks.add(hook);
            return () => disposeHooks.delete(hook);
        },

        acquireSoftDiscTexture() {
            return acquireSoftDiscTexture();
        },

        acquireGlowTexture() {
            return acquireSoftDiscTexture();
        },

        getKey(fishInfo) {
            return generateKey(fishInfo);
        },

        getShadowKey(fishInfo, shadowProfile = null) {
            return generateShadowKey(fishInfo, shadowProfile);
        },

        get(fishInfo) {
            const size = toClampedNumber(fishInfo?.baseSize, FALLBACK_FISH_SIZE, 1, 1024);
            const key = generateKey(fishInfo);
            const record = getOrCreateRecord(fishInfo, key, size);
            pruneCache();
            return record.textures;
        },

        acquire(fishInfo) {
            const size = toClampedNumber(fishInfo?.baseSize, FALLBACK_FISH_SIZE, 1, 1024);
            const key = generateKey(fishInfo);
            const record = getOrCreateRecord(fishInfo, key, size);
            record.refCount = (Number(record.refCount) || 0) + 1;
            diagnosticsSnapshot = null;
            record.lastUsed = ++cacheClock;
            pruneCache();
            return {
                key: record.key,
                textures: record.textures,
            };
        },

        release(key) {
            if (!key) return;
            const record = cache.get(key);
            if (!record) return;
            record.refCount = Math.max(0, (Number(record.refCount) || 0) - 1);
            diagnosticsSnapshot = null;
            record.lastUsed = ++cacheClock;
            if (record.refCount === 0) {
                pruneCache();
            }
        },

        getShadow(fishInfo, shadowProfile = null) {
            const size = toClampedNumber(fishInfo?.baseSize, FALLBACK_FISH_SIZE, 1, 1024);
            const key = generateShadowKey(fishInfo, shadowProfile);
            const record = getOrCreateShadowRecord(fishInfo, key, size, shadowProfile);
            pruneShadowCache();
            return record?.textures?.shadow || null;
        },

        acquireShadow(fishInfo, shadowProfile = null) {
            const size = toClampedNumber(fishInfo?.baseSize, FALLBACK_FISH_SIZE, 1, 1024);
            const profile = resolveShadowProfileForTexture(shadowProfile);
            const key = generateShadowKey(fishInfo, profile);
            const record = getOrCreateShadowRecord(fishInfo, key, size, profile);
            if (!record) return null;
            record.refCount = (Number(record.refCount) || 0) + 1;
            diagnosticsSnapshot = null;
            record.lastUsed = ++cacheClock;
            pruneShadowCache();
            return {
                key: record.key,
                textures: record.textures,
            };
        },

        releaseShadow(key, { evictUnused = false } = {}) {
            if (!key) return;
            const record = shadowCache.get(key);
            if (!record) return;
            record.refCount = Math.max(0, (Number(record.refCount) || 0) - 1);
            diagnosticsSnapshot = null;
            record.lastUsed = ++cacheClock;
            if (
                record.refCount === 0
                && evictUnused === true
            ) {
                shadowCache.delete(key);
                diagnosticsSnapshot = null;
                destroyShadowTextureBundle(record.textures);
            } else if (record.refCount === 0) {
                pruneShadowCache();
            }
        },

        getDiagnostics() {
            if (diagnosticsSnapshot !== null) return diagnosticsSnapshot;
            let bodyReferencedEntryCount = 0;
            let bodyReferenceCount = 0;
            cache.forEach((record) => {
                const refCount = Math.max(
                    0,
                    Math.floor(Number(record?.refCount) || 0),
                );
                if (refCount > 0) {
                    bodyReferencedEntryCount += 1;
                    bodyReferenceCount += refCount;
                }
            });
            let shadowReferencedEntryCount = 0;
            let shadowReferenceCount = 0;
            shadowCache.forEach((record) => {
                const refCount = Math.max(
                    0,
                    Math.floor(Number(record?.refCount) || 0),
                );
                if (refCount > 0) {
                    shadowReferencedEntryCount += 1;
                    shadowReferenceCount += refCount;
                }
            });
            diagnosticsSnapshot = Object.freeze({
                bodyEntryCount: cache.size,
                bodyReferencedEntryCount,
                bodyReferenceCount,
                shadowEntryCount: shadowCache.size,
                shadowReferencedEntryCount,
                shadowReferenceCount,
            });
            return diagnosticsSnapshot;
        },

        dispose() {
            for (const preparation of preparations) preparation.cancel();
            let firstHookError = null;
            for (const hook of disposeHooks) {
                try {
                    hook();
                } catch (error) {
                    firstHookError ??= error;
                }
            }
            disposeHooks.clear();
            cache.forEach((record) => {
                destroyTextureBundle(record?.textures, { immediate: true });
            });
            cache.clear();
            diagnosticsSnapshot = null;
            shadowCache.forEach((record) => {
                destroyShadowTextureBundle(record?.textures, { immediate: true });
            });
            shadowCache.clear();
            diagnosticsSnapshot = null;
            destroyTexture(
                softDiscTexture,
                { immediate: true },
            );
            softDiscTexture = null;
            if (firstHookError) {
                throw firstHookError;
            }
        },
    };
};
