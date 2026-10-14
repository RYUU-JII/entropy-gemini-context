import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import {
    buildZenRendererDebugTogglesSignature,
    DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES,
    resolveZenRendererDebugTogglesForControlState,
    resolveZenWaterSurfaceFeaturePlan,
} from '../../contracts/zenRendererDebugToggles.js';

const WATER_SURFACE_TOGGLE_KEYS = Object.freeze([
    'surfaceOpticsEnabled',
    'surfaceNormalEnabled',
    'screenRefractionEnabled',
    'surfaceReflectionEnabled',
    'rgbSplitEnabled',
    'yoonseulEnabled',
]);

const WATER_LAYER_TOGGLE_KEYS = Object.freeze([
    'benthicEnabled',
    'causticsEnabled',
    'komorebiEnabled',
    'godRaysEnabled',
    'cloudReflectionEnabled',
    'atmosphereEnabled',
]);

const FISH_STRATEGY_VISUAL_LOCK = 'visual_lock';

const disableToggleKeys = (target, keys) => {
    for (let i = 0; i < keys.length; i += 1) {
        target[keys[i]] = false;
    }
};

const resolveSafeQualityProfile = (qualityProfile = null) => (
    qualityProfile && typeof qualityProfile === 'object' ? qualityProfile : {}
);

const resolveEffectIntensityScale = (qualityProfile = null) => {
    const raw = Number(qualityProfile?.effectIntensityScale);
    return clampValue(Number.isFinite(raw) ? raw : 1, 0.2, 2.4);
};

const resolveFishShadowProfile = (
    qualityProfile = null,
    rendererDebugToggles = null,
) => ({
    enabled: (
        qualityProfile?.fishShadowEnabled !== false
        && rendererDebugToggles?.fishShadowEnabled === true
    ),
    blur: Math.max(0, Math.floor(Number(qualityProfile?.fishShadowBlur) || 0)),
    cadence: Math.max(0, Math.floor(Number(qualityProfile?.fishShadowCadence) || 0)),
    opacity: clampValue(Number(qualityProfile?.fishShadowOpacity ?? 0.2), 0, 0.35),
    scale: clampValue(Number(qualityProfile?.fishShadowScale ?? 0.88), 0.8, 0.95),
    includeFins: qualityProfile?.fishShadowIncludeFins !== false,
});

const buildWaterLayerAssetSignature = (resolvedToggles) => (
    [
        resolvedToggles.waterEffectsEnabled ? 1 : 0,
        resolvedToggles.waterLayerEffectsEnabled ? 1 : 0,
        resolvedToggles.benthicEnabled ? 1 : 0,
        resolvedToggles.causticsEnabled ? 1 : 0,
        resolvedToggles.komorebiEnabled ? 1 : 0,
        resolvedToggles.godRaysEnabled ? 1 : 0,
        resolvedToggles.cloudReflectionEnabled ? 1 : 0,
        resolvedToggles.atmosphereEnabled ? 1 : 0,
    ].join('|')
);

const buildOptimizationSignature = ({
    requestedDebugToggles,
    resolvedDebugToggles,
    effectIntensityScale,
} = {}) => (
    [
        `ei:${Number(effectIntensityScale).toFixed(3)}`,
        `req:${buildZenRendererDebugTogglesSignature(requestedDebugToggles)}`,
        `eff:${buildZenRendererDebugTogglesSignature(resolvedDebugToggles)}`,
    ].join('|')
);

const resolveWaterDebugToggles = ({
    qualityProfile = null,
    rendererDebugToggles = null,
} = {}) => {
    const requestedDebugToggles = resolveZenRendererDebugTogglesForControlState({
        toggles: rendererDebugToggles,
    });
    const resolvedDebugToggles = {
        ...requestedDebugToggles,
    };
    if (resolvedDebugToggles.waterEffectsEnabled !== true) {
        resolvedDebugToggles.waterSurfaceEffectsEnabled = false;
        resolvedDebugToggles.waterLayerEffectsEnabled = false;
        disableToggleKeys(resolvedDebugToggles, WATER_SURFACE_TOGGLE_KEYS);
        disableToggleKeys(resolvedDebugToggles, WATER_LAYER_TOGGLE_KEYS);
    }
    if (resolvedDebugToggles.waterSurfaceEffectsEnabled !== true) {
        disableToggleKeys(resolvedDebugToggles, WATER_SURFACE_TOGGLE_KEYS);
    }
    if (resolvedDebugToggles.waterLayerEffectsEnabled !== true) {
        disableToggleKeys(resolvedDebugToggles, WATER_LAYER_TOGGLE_KEYS);
    }

    const surfaceFeaturePlan = resolveZenWaterSurfaceFeaturePlan(resolvedDebugToggles);
    const layerFeaturesEnabled = (
        resolvedDebugToggles.waterEffectsEnabled === true
        && resolvedDebugToggles.waterLayerEffectsEnabled === true
        && WATER_LAYER_TOGGLE_KEYS.some((key) => resolvedDebugToggles[key] === true)
    );

    return {
        requestedDebugToggles,
        resolvedDebugToggles,
        surfaceFeaturePlan,
        surfaceFeaturesEnabled: surfaceFeaturePlan.surfaceEffectsEnabled,
        layerFeaturesEnabled,
    };
};

class ZenPondOptimizationMaster {
    constructor(options = {}) {
        this.options = options;
    }

    resolveProfile() {
        const safeQualityProfile = resolveSafeQualityProfile(this.options?.qualityProfile);
        const effectIntensityScale = resolveEffectIntensityScale(safeQualityProfile);
        const waterDebug = resolveWaterDebugToggles({
            qualityProfile: safeQualityProfile,
            rendererDebugToggles: this.options?.rendererDebugToggles,
        });
        const layerAssetSignature = buildWaterLayerAssetSignature(
            waterDebug.resolvedDebugToggles,
        );
        const signature = buildOptimizationSignature({
            qualityProfile: safeQualityProfile,
            requestedDebugToggles: waterDebug.requestedDebugToggles,
            resolvedDebugToggles: waterDebug.resolvedDebugToggles,
            effectIntensityScale,
        });

        return Object.freeze({
            signature,
            effectIntensityScale,
            requestedDebugToggles: Object.freeze({
                ...waterDebug.requestedDebugToggles,
            }),
            debugToggles: Object.freeze({
                ...waterDebug.resolvedDebugToggles,
            }),
            water: Object.freeze({
                effectsEnabled: waterDebug.resolvedDebugToggles.waterEffectsEnabled === true,
                surfaceEffectsEnabled: waterDebug.surfaceFeaturesEnabled,
                surfaceFeaturePlan: waterDebug.surfaceFeaturePlan,
                layerEffectsEnabled: waterDebug.layerFeaturesEnabled,
                layerAssetSignature,
                signature: buildZenRendererDebugTogglesSignature(waterDebug.resolvedDebugToggles),
            }),
            fish: Object.freeze({
                strategy: FISH_STRATEGY_VISUAL_LOCK,
                allowCadenceDegrade: false,
                allowShadowReduction: false,
                allowOffscreenCull: false,
                priorityVisibleFish: true,
                shadow: Object.freeze(resolveFishShadowProfile(
                    safeQualityProfile,
                    waterDebug.resolvedDebugToggles,
                )),
            }),
        });
    }
}

export const resolveZenPondOptimizationProfile = (options = {}) => (
    new ZenPondOptimizationMaster(options).resolveProfile()
);

const OPTIMIZATION_QUALITY_INPUT_KEYS = Object.freeze([
    'effectIntensityScale',
    'fishShadowEnabled',
    'fishShadowBlur',
    'fishShadowCadence',
    'fishShadowOpacity',
    'fishShadowScale',
    'fishShadowIncludeFins',
]);
const OPTIMIZATION_TOGGLE_INPUT_KEYS = Object.freeze(Object.keys(DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES));

// Each scene keeps one projection. Compare the declared scalar inputs before
// normalizing toggles or building signatures, including mutable research inputs.
export const createZenPondOptimizationProfileResolver = () => {
    let cachedProfile = null;
    let cachedQualityInput = null;
    let cachedToggleInput = null;
    const captureInput = (input, keys) => ({
        source: input,
        frozen: Object.isFrozen(input),
        values: keys.map((key) => input?.[key]),
    });
    const matchesInput = (input, previous, keys) => {
        if (input === previous.source && previous.frozen) return true;
        if ((input == null) !== (previous.source == null)) return false;
        for (let index = 0; index < keys.length; index += 1) {
            if (!Object.is(input?.[keys[index]], previous.values[index])) return false;
        }
        return true;
    };

    return ({ qualityProfile = null, rendererDebugToggles = null } = {}) => {
        const toggleInput = rendererDebugToggles && typeof rendererDebugToggles === 'object' && !Array.isArray(rendererDebugToggles)
            ? rendererDebugToggles
            : null;
        if (
            cachedProfile
            && matchesInput(qualityProfile, cachedQualityInput, OPTIMIZATION_QUALITY_INPUT_KEYS)
            && matchesInput(toggleInput, cachedToggleInput, OPTIMIZATION_TOGGLE_INPUT_KEYS)
        ) {
            return cachedProfile;
        }
        const nextProfile = resolveZenPondOptimizationProfile({ qualityProfile, rendererDebugToggles });
        cachedQualityInput = captureInput(qualityProfile, OPTIMIZATION_QUALITY_INPUT_KEYS);
        cachedToggleInput = captureInput(toggleInput, OPTIMIZATION_TOGGLE_INPUT_KEYS);
        cachedProfile = nextProfile;
        return nextProfile;
    };
};

export const buildZenPondOptimizationSignature = (options = {}) => (
    resolveZenPondOptimizationProfile(options).signature
);

export const buildZenPondOptimizationSnapshot = (options = {}) => {
    const resolved = options?.signature
        ? options
        : resolveZenPondOptimizationProfile(options);
    return {
        signature: typeof resolved?.signature === 'string' ? resolved.signature : '',
        effectIntensityScale: Number(resolved?.effectIntensityScale) || 1,
        debugToggles: {
            ...(resolved?.debugToggles || {}),
        },
        water: {
            effectsEnabled: resolved?.water?.effectsEnabled === true,
            surfaceEffectsEnabled: resolved?.water?.surfaceEffectsEnabled === true,
            layerEffectsEnabled: resolved?.water?.layerEffectsEnabled === true,
            layerAssetSignature: typeof resolved?.water?.layerAssetSignature === 'string'
                ? resolved.water.layerAssetSignature
                : '',
        },
        fish: {
            strategy: typeof resolved?.fish?.strategy === 'string'
                ? resolved.fish.strategy
                : FISH_STRATEGY_VISUAL_LOCK,
            allowCadenceDegrade: resolved?.fish?.allowCadenceDegrade === true,
            allowShadowReduction: resolved?.fish?.allowShadowReduction === true,
            allowOffscreenCull: resolved?.fish?.allowOffscreenCull === true,
            priorityVisibleFish: resolved?.fish?.priorityVisibleFish !== false,
            shadow: {
                ...(resolved?.fish?.shadow || {}),
            },
        },
    };
};

export {
    FISH_STRATEGY_VISUAL_LOCK,
    ZenPondOptimizationMaster,
};
