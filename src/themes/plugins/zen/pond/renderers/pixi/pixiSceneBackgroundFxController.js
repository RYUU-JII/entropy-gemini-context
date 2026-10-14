import { BaseTexture, Texture } from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import {
    createBaseWaterTexture,
} from './pixiSceneTextureFactories.js';
import { resolvePixiSceneEffectRenderPlan } from './pixiSceneWorldPolicy.js';
import {
    flushPixiTextureDisposalQueue,
    queuePixiTextureDisposal,
} from '../../../shared/pixiDeferredTextureDisposal.js';

const createTextureFromSource = (source) => {
    if (typeof source === 'string') {
        return Texture.from(source);
    }
    if (!source) return null;
    return new Texture(new BaseTexture(source));
};

// Depth wash presentation. The wash texture now ramps its own coverage with
// bathymetric depth, so the sprite alpha only has to set how much of that
// basin shading the scene carries. STANDING_FLOOR keeps depth present in clear
// still water; PRESENCE_GAIN and ALPHA_CAP set how far it can go.
const DEPTH_WASH_STANDING_FLOOR = 0.42;
const DEPTH_WASH_PRESENCE_GAIN = 3.4;
const DEPTH_WASH_ALPHA_CAP = 0.34;
const parseRgbChannels = (raw) => {
    if (typeof raw !== 'string') return null;
    if (raw.startsWith('#') && raw.length >= 7) {
        return {
            r: Number.parseInt(raw.slice(1, 3), 16),
            g: Number.parseInt(raw.slice(3, 5), 16),
            b: Number.parseInt(raw.slice(5, 7), 16),
        };
    }
    const match = raw.match(/[\d.]+/g);
    if (!Array.isArray(match) || match.length < 3) return null;
    return {
        r: Number(match[0]) || 0,
        g: Number(match[1]) || 0,
        b: Number(match[2]) || 0,
    };
};

const resolvePaletteComposition = (palette) => {
    if (!palette || typeof palette !== 'object') {
        throw new Error('ZEN_WATER_MATERIAL_PALETTE_REQUIRED');
    }
    const requireScalar = (field, min, max) => {
        const value = palette[field];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new Error(`ZEN_WATER_MATERIAL_PALETTE_INVALID:${field}`);
        }
        return clampValue(value, min, max);
    };
    return {
        depthStrengthBias: requireScalar('depthStrengthBias', -0.8, 0.8),
        contourDensityBias: requireScalar('contourDensityBias', -0.8, 0.8),
        sedimentAmountBias: requireScalar('sedimentAmountBias', -0.8, 0.8),
        mineralStrength: requireScalar('mineralStrength', 0, 0.65),
    };
};

const toResolvedChannels = (raw) => {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const r = Number(raw.r);
        const g = Number(raw.g);
        const b = Number(raw.b);
        if ([r, g, b].every(Number.isFinite)) {
            return {
                r: clampValue(r, 0, 255),
                g: clampValue(g, 0, 255),
                b: clampValue(b, 0, 255),
            };
        }
    }
    const parsed = parseRgbChannels(raw);
    if (parsed) return parsed;
    return null;
};

const formatRgb = (channels) => {
    return `rgb(${Math.round(clampValue(channels.r, 0, 255))}, ${Math.round(clampValue(channels.g, 0, 255))}, ${Math.round(clampValue(channels.b, 0, 255))})`;
};

// Authored, calibrated gradient stops are the complete material pigment. Do not
// remix them with a shared substrate or lift their encoded RGB values: the live
// surface pass owns illumination in linear RGB.
const composeStaticBaseWaterColors = (waterPalette) => {
    if (!Array.isArray(waterPalette?.gradientStops) || waterPalette.gradientStops.length !== 3) {
        throw new Error('ZEN_WATER_MATERIAL_GRADIENT_REQUIRED');
    }
    return waterPalette.gradientStops.map((color) => {
        const source = toResolvedChannels(color);
        if (!source || !Object.values(source).every(Number.isFinite)) {
            throw new Error('ZEN_WATER_MATERIAL_COLOR_INVALID');
        }
        return formatRgb(source);
    });
};

const SHARED_BG_TEXTURE_CACHE = new Map();
let SHARED_BG_TEXTURE_CACHE_GENERATION_KEY = '';
const SHARED_BG_CURRENT_KEYS_BY_ROLE = new Map();
const SHARED_TEXTURE_OWNER = { add: () => { } };

const destroySharedBackgroundTextureEntry = (entry, { immediate = false } = {}) => {
    const texture = entry?.texture;
    if (texture && !texture.destroyed) {
        queuePixiTextureDisposal(texture, { destroyBase: true, immediate });
    }
};

const pruneSharedBackgroundTextureCache = () => {
    flushPixiTextureDisposalQueue();
    for (const [key, entry] of SHARED_BG_TEXTURE_CACHE.entries()) {
        if (!entry || typeof entry !== 'object') {
            SHARED_BG_TEXTURE_CACHE.delete(key);
            continue;
        }
        if ((Number(entry.refCount) || 0) > 0) continue;
        const currentRoleKey = SHARED_BG_CURRENT_KEYS_BY_ROLE.get(entry.role);
        if (entry.generationKey !== SHARED_BG_TEXTURE_CACHE_GENERATION_KEY || key !== currentRoleKey) {
            SHARED_BG_TEXTURE_CACHE.delete(key);
            destroySharedBackgroundTextureEntry(entry);
        }
    }
};

const clearSharedBackgroundTextureCache = ({ immediate = true } = {}) => {
    for (const entry of SHARED_BG_TEXTURE_CACHE.values()) {
        destroySharedBackgroundTextureEntry(entry, { immediate });
    }
    SHARED_BG_TEXTURE_CACHE.clear();
    SHARED_BG_CURRENT_KEYS_BY_ROLE.clear();
};

const acquireSharedBackgroundTexture = (key, buildTexture, {
    generationKey = '',
    role = 'default',
} = {}) => {
    SHARED_BG_CURRENT_KEYS_BY_ROLE.set(role, key);
    pruneSharedBackgroundTextureCache();
    const cached = SHARED_BG_TEXTURE_CACHE.get(key);
    if (cached?.texture && !cached.texture.destroyed) {
        cached.refCount = (Number(cached.refCount) || 0) + 1;
        cached.lastUsed = Date.now();
        return cached.texture;
    }
    const texture = buildTexture();
    if (!texture) return null;
    SHARED_BG_TEXTURE_CACHE.set(key, {
        key,
        texture,
        generationKey,
        role,
        refCount: 1,
        lastUsed: Date.now(),
    });
    if (SHARED_BG_TEXTURE_CACHE.size > 24) {
        const entries = Array.from(SHARED_BG_TEXTURE_CACHE.values())
            .sort((a, b) => (Number(a?.lastUsed) || 0) - (Number(b?.lastUsed) || 0));
        const removeCount = SHARED_BG_TEXTURE_CACHE.size - 24;
        for (let i = 0; i < removeCount; i += 1) {
            const entry = entries[i];
            if (!entry || entry.key === key) continue;
            if ((Number(entry.refCount) || 0) > 0) continue;
            SHARED_BG_TEXTURE_CACHE.delete(entry.key);
            destroySharedBackgroundTextureEntry(entry);
        }
    }
    pruneSharedBackgroundTextureCache();
    return texture;
};

const releaseSharedBackgroundTexture = (key) => {
    if (!key) return;
    const entry = SHARED_BG_TEXTURE_CACHE.get(key);
    if (!entry) return;
    entry.refCount = Math.max(0, (Number(entry.refCount) || 0) - 1);
    if (entry.refCount <= 0) {
        entry.lastUnusedAt = Date.now();
    }
    pruneSharedBackgroundTextureCache();
};

const clearSharedBackgroundCurrentKey = (role, key) => {
    if (key && SHARED_BG_CURRENT_KEYS_BY_ROLE.get(role) === key) {
        SHARED_BG_CURRENT_KEYS_BY_ROLE.delete(role);
    }
};

const createPixiSceneBackgroundFxController = ({
    width,
    height,
    qualityProfile,
    sceneGenerationKey = '',
    resolveDepthTexture,
    waterPaletteRef,
    baseWaterSprite,
    depthMultiplySprite,
    depthSoftSprite,
    tintMultiplySprite,
    tintSoftSprite,
    tintScreenSprite,
}) => {
    const generationKey = String(sceneGenerationKey || '');
    if (SHARED_BG_TEXTURE_CACHE_GENERATION_KEY !== generationKey) {
        SHARED_BG_TEXTURE_CACHE_GENERATION_KEY = generationKey;
        pruneSharedBackgroundTextureCache();
    }
    let sceneWidth = Math.max(1, Math.round(Number(width) || 1));
    let sceneHeight = Math.max(1, Math.round(Number(height) || 1));
    let baseWaterKey = '';
    let baseWaterCacheKey = '';
    let depthTextureSource = null;
    let depthTexture = null;
    let resizePending = false;
    let materialPaletteRef = null;
    let materialComposition = null;
    const effectIntensityScale = Number(qualityProfile?.effectIntensityScale);
    const resolvedEffectIntensityScale = Number.isFinite(effectIntensityScale)
        ? effectIntensityScale
        : 1;
    const update = (frameChannels = null, updateOptions = null) => {
        const sharedChannels = frameChannels && typeof frameChannels === 'object'
            ? frameChannels
            : null;
        if (!sharedChannels) return;
        const effectPlan = resolvePixiSceneEffectRenderPlan(updateOptions?.worldPolicy);
        baseWaterSprite.visible = effectPlan.waterBase;
        depthMultiplySprite.visible = effectPlan.waterDepth;
        depthSoftSprite.visible = effectPlan.waterDepth;
        if (!effectPlan.waterBase && !effectPlan.waterDepth) {
            depthMultiplySprite.alpha = 0;
            depthSoftSprite.alpha = 0;
            return;
        }
        // The first frame after a world resize must replace extent-dependent
        // textures before the static floor is rebaked, regardless of cadence.
        const fullUpdate = resizePending || updateOptions?.fullUpdate !== false;
        const dynamicUpdate = fullUpdate || updateOptions?.dynamicUpdate !== false;
        if (!fullUpdate && !dynamicUpdate) return;
        const waterTurbidity = sharedChannels.waterTurbidity;
        const currentWaterPalette = waterPaletteRef.current;
        if (materialPaletteRef !== currentWaterPalette || materialComposition === null) {
            materialComposition = resolvePaletteComposition(currentWaterPalette);
            materialPaletteRef = currentWaterPalette;
        }
        const paletteComposition = materialComposition;
        if (effectPlan.waterBase && fullUpdate) {
            const baseColors = composeStaticBaseWaterColors(currentWaterPalette);
            const nextBaseKey = `${sceneWidth}|${sceneHeight}|${baseColors.join('|')}`;
            if (nextBaseKey !== baseWaterKey) {
                const nextBaseCacheKey = `${generationKey}|base|${nextBaseKey}`;
                const nextTexture = acquireSharedBackgroundTexture(
                    nextBaseCacheKey,
                    () => createBaseWaterTexture(SHARED_TEXTURE_OWNER, sceneWidth, sceneHeight, baseColors),
                    { generationKey, role: 'base' },
                );
                if (nextTexture) {
                    baseWaterSprite.texture = nextTexture;
                    if (baseWaterCacheKey && baseWaterCacheKey !== nextBaseCacheKey) {
                        releaseSharedBackgroundTexture(baseWaterCacheKey);
                    }
                    baseWaterCacheKey = nextBaseCacheKey;
                    baseWaterKey = nextBaseKey;
                }
            }
        }

        const depthStrength = clampValue(
            1 + paletteComposition.depthStrengthBias,
            0,
            2,
        );
        const contourDensity = clampValue(
            1 + paletteComposition.contourDensityBias - 0.04,
            0,
            2,
        );
        const sedimentAmount = clampValue(
            1 + paletteComposition.sedimentAmountBias + 0.12,
            0,
            2,
        );
        const depthSource = effectPlan.waterDepth && fullUpdate && typeof resolveDepthTexture === 'function'
            ? resolveDepthTexture(currentWaterPalette, { depthStrength, contourDensity, sedimentAmount })
            : depthTextureSource;
        if (effectPlan.waterDepth && depthSource) {
            if (fullUpdate && (resizePending || depthSource !== depthTextureSource || !depthTexture)) {
                const nextDepthTexture = createTextureFromSource(depthSource);
                const previousDepthTexture = depthTexture;
                depthTextureSource = depthSource;
                depthTexture = nextDepthTexture;
                depthMultiplySprite.texture = depthTexture;
                depthSoftSprite.texture = depthTexture;
                if (previousDepthTexture && previousDepthTexture !== nextDepthTexture && !previousDepthTexture.destroyed) {
                    queuePixiTextureDisposal(previousDepthTexture, { destroyBase: false });
                }
            }
            const depthAlphaBias = clampValue(
                1
                + (paletteComposition.sedimentAmountBias * 0.22)
                - (paletteComposition.mineralStrength * 0.18),
                0.72,
                1.24,
            );
            const depthAlphaBase = (
                (0.03 + depthStrength * 0.08)
                * (0.62 + resolvedEffectIntensityScale * 0.28)
                * depthAlphaBias
            );
            // Depth shading belongs to the water column, not to the weather.
            // Driving it from cloud/turbidity alone let it fall to ~2% in clear
            // water, which is exactly when a pond bottom reads deepest. Keep a
            // standing floor independent of weather and time of day.
            const atmosphereStrength = clampValue(
                DEPTH_WASH_STANDING_FLOOR
                + waterTurbidity * 0.42,
                DEPTH_WASH_STANDING_FLOOR,
                1,
            );
            const depthAlpha = clampValue(
                depthAlphaBase * atmosphereStrength * DEPTH_WASH_PRESENCE_GAIN,
                0,
                DEPTH_WASH_ALPHA_CAP,
            );
            depthMultiplySprite.visible = true;
            depthSoftSprite.visible = true;
            depthMultiplySprite.alpha = depthAlpha;
            depthSoftSprite.alpha = 0;
        } else {
            depthMultiplySprite.visible = false;
            depthSoftSprite.visible = false;
        }

        // No display exposure is layered over the canonical material pass.
        tintMultiplySprite.visible = false;
        tintMultiplySprite.alpha = 0;
        tintSoftSprite.visible = false;
        tintSoftSprite.alpha = 0;
        tintScreenSprite.visible = false;
        tintScreenSprite.alpha = 0;
        resizePending = false;
    };

    const resize = (nextWidth, nextHeight) => {
        const resolvedWidth = Math.max(1, Math.round(Number(nextWidth) || 1));
        const resolvedHeight = Math.max(1, Math.round(Number(nextHeight) || 1));
        if (resolvedWidth === sceneWidth && resolvedHeight === sceneHeight) {
            return false;
        }
        sceneWidth = resolvedWidth;
        sceneHeight = resolvedHeight;
        // Keep leases while sprites still reference the old textures. Worker
        // disposal can flush before the next frame (or another resize). update()
        // binds replacements first, then releases the previous textures.
        resizePending = true;

        baseWaterSprite.width = sceneWidth;
        baseWaterSprite.height = sceneHeight;
        depthMultiplySprite.width = sceneWidth;
        depthMultiplySprite.height = sceneHeight;
        depthSoftSprite.width = sceneWidth;
        depthSoftSprite.height = sceneHeight;
        tintMultiplySprite.width = sceneWidth;
        tintMultiplySprite.height = sceneHeight;
        tintSoftSprite.width = sceneWidth;
        tintSoftSprite.height = sceneHeight;
        tintScreenSprite.width = sceneWidth;
        tintScreenSprite.height = sceneHeight;
        return true;
    };

    const destroy = () => {
        if (depthTexture && !depthTexture.destroyed) {
            queuePixiTextureDisposal(depthTexture, { destroyBase: false, immediate: true });
        }
        depthTexture = null;
        depthTextureSource = null;
        clearSharedBackgroundCurrentKey('base', baseWaterCacheKey);
        releaseSharedBackgroundTexture(baseWaterCacheKey);
        baseWaterKey = '';
        baseWaterCacheKey = '';
    };

    return {
        update,
        resize,
        destroy,
    };
};

export { createPixiSceneBackgroundFxController };
