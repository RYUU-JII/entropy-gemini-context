import { DEFAULT_KOI_TUNING } from '@/themes/plugins/zen/api/koi.js';
import {
    normalizeZenRendererDebugToggles,
    resolveZenRendererDebugTogglePreset,
    resolveZenWaterSurfaceFeaturePlan,
    ZEN_RENDERER_SURFACE_PIPELINE_MODES,
} from '@/themes/plugins/zen/pond/contracts/zenRendererDebugToggles.js';
import {
    normalizeZenWaterReflectionAlgorithm,
    ZEN_WATER_REFLECTION_ALGORITHMS,
} from '@/themes/plugins/zen/pond/contracts/zenWaterReflectionAlgorithms.js';

const LIFE_INTENT_SWIM_MODELS = Object.freeze([
    'event_fsm_life_v1',
    'event_fsm_life_v2',
]);

const OPTICS_TOGGLE_KEYS = new Set([
    'surfaceOpticsEnabled',
    'surfaceNormalEnabled',
    'screenRefractionEnabled',
    'surfaceReflectionEnabled',
    'rgbSplitEnabled',
]);

export const ZEN_POND_LAB_WATER_EFFECT_GROUPS = Object.freeze([
    Object.freeze({
        id: 'gates',
        title: 'Runtime Gates',
        iconId: 'gates',
        items: Object.freeze([
            Object.freeze({ key: 'waterEffectsEnabled', label: 'All FX' }),
            Object.freeze({ key: 'waterSurfaceEffectsEnabled', label: 'Surface' }),
            Object.freeze({ key: 'waterLayerEffectsEnabled', label: 'Layer' }),
        ]),
    }),
    Object.freeze({
        id: 'surface',
        title: 'Surface Result',
        iconId: 'surface',
        items: Object.freeze([
            Object.freeze({ key: 'yoonseulEnabled', label: 'Yoonseul' }),
            Object.freeze({ key: 'cloudReflectionEnabled', label: 'Clouds' }),
            Object.freeze({ key: 'surfaceOpticsEnabled', label: 'Optics' }),
            Object.freeze({ key: 'surfaceNormalEnabled', label: 'Normal' }),
            Object.freeze({ key: 'screenRefractionEnabled', label: 'Refract' }),
            Object.freeze({ key: 'surfaceReflectionEnabled', label: 'Reflect' }),
            Object.freeze({ key: 'rgbSplitEnabled', label: 'RGB' }),
        ]),
    }),
    Object.freeze({
        id: 'layers',
        title: 'Pond Layers',
        iconId: 'layers',
        items: Object.freeze([
            Object.freeze({ key: 'benthicEnabled', label: 'Benthic' }),
            Object.freeze({ key: 'causticsEnabled', label: 'Caustics' }),
            Object.freeze({ key: 'godRaysEnabled', label: 'Rays' }),
            Object.freeze({ key: 'atmosphereEnabled', label: 'Atmos.' }),
            Object.freeze({ key: 'komorebiEnabled', label: 'Komorebi' }),
        ]),
    }),
    Object.freeze({
        id: 'interaction', title: 'Shadows & Disturbances', iconId: 'surface',
        items: Object.freeze([
            Object.freeze({ key: 'fishShadowEnabled', label: 'Fish shadows' }),
            Object.freeze({ key: 'koiWakeDisturbanceEnabled', label: 'Koi wake' }),
            Object.freeze({ key: 'tapDisturbanceEnabled', label: 'Tap ripples' }),
            Object.freeze({ key: 'petalDisturbanceEnabled', label: 'Petal ripples' }),
        ]),
    }),
]);

export const clampPondLabNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

export const formatPondLabDurationMinutes = (ms) => {
    const minutes = Math.max(0, Math.round((Number(ms) || 0) / 60_000));
    return `${minutes}m`;
};

export const formatPondLabPercent = (value) => (
    `${Math.round(clampPondLabNumber(value, 0, 1, 0) * 100)}%`
);

export const mergePondLabTuningWithDefaults = (tuning = null) => ({
    ...DEFAULT_KOI_TUNING,
    ...(tuning || {}),
    physics: {
        ...DEFAULT_KOI_TUNING.physics,
        ...(tuning?.physics || {}),
    },
});

const isLifeIntentSwimModel = (swimModel) => LIFE_INTENT_SWIM_MODELS.includes(swimModel);

export const resolvePondLabCompareWaterReflectionAlgorithmA = (tuning = null) => (
    normalizeZenWaterReflectionAlgorithm(
        tuning?.compareWaterReflectionAlgorithmA,
        ZEN_WATER_REFLECTION_ALGORITHMS.LOOPED_CAUSTIC,
    )
);

export const resolvePondLabCompareWaterReflectionAlgorithmB = (tuning = null, algorithmA = '') => {
    const resolvedA = normalizeZenWaterReflectionAlgorithm(
        algorithmA,
        ZEN_WATER_REFLECTION_ALGORITHMS.LOOPED_CAUSTIC,
    );
    const candidate = normalizeZenWaterReflectionAlgorithm(
        tuning?.compareWaterReflectionAlgorithmB,
        ZEN_WATER_REFLECTION_ALGORITHMS.LIMITED_WAVES,
    );
    if (candidate !== resolvedA) return candidate;
    return [
        ZEN_WATER_REFLECTION_ALGORITHMS.SURFACE_FIELD,
        ZEN_WATER_REFLECTION_ALGORITHMS.LIMITED_WAVES,
        ZEN_WATER_REFLECTION_ALGORITHMS.PHASE_NOISE,
        ZEN_WATER_REFLECTION_ALGORITHMS.LOOPED_CAUSTIC,
        ZEN_WATER_REFLECTION_ALGORITHMS.YOONSEUL_GLINT,
        ZEN_WATER_REFLECTION_ALGORITHMS.SLOPE_LOBE,
        ZEN_WATER_REFLECTION_ALGORITHMS.STOCHASTIC_SLOPE_SPECTRUM,
    ].find((entry) => entry !== resolvedA) || ZEN_WATER_REFLECTION_ALGORITHMS.PHASE_NOISE;
};

export const buildPondLabWaterReflectionCompareTuning = (tuning = null, algorithm) => ({
    ...(tuning || {}),
    waterReflectionAlgorithm: normalizeZenWaterReflectionAlgorithm(algorithm),
});

export const resolvePondLabCompareModelA = (tuning = null) => (
    tuning?.physics?.compareModelA || 'event_fsm'
);

export const resolvePondLabCompareModelB = (tuning = null, compareModelA = '') => {
    const candidate = tuning?.physics?.compareModelB || 'event_fsm_life_v2';
    if (candidate !== compareModelA) return candidate;
    return [
        'event_fsm_life_v2',
        'event_fsm_life_v1',
        'event_fsm',
        'cpg_dynamics',
        'kinematic_hybrid',
    ].find((entry) => entry !== compareModelA) || 'event_fsm_life_v2';
};

export const resolvePondLabRendererDebugTogglesForSwimModel = (baseToggles, swimModel) => (
    normalizeZenRendererDebugToggles({
        ...baseToggles,
        koiIntentHudEnabled: isLifeIntentSwimModel(swimModel) && baseToggles.koiIntentHudEnabled === true,
    })
);

export const resolvePondLabRendererTogglePatch = (current, patch) => {
    const next = {
        ...current,
        ...patch,
    };

    if (patch.surfaceOpticsEnabled === false) {
        for (const key of OPTICS_TOGGLE_KEYS) next[key] = false;
    }
    if (patch.screenRefractionEnabled === false) next.rgbSplitEnabled = false;
    if (patch.surfaceOpticsEnabled === true) {
        next.surfaceNormalEnabled = true;
        next.screenRefractionEnabled = true;
        next.surfaceReflectionEnabled = true;
    }
    if (next.rgbSplitEnabled === true) {
        next.screenRefractionEnabled = true;
    }
    if (
        next.screenRefractionEnabled === true
        || next.surfaceReflectionEnabled === true
        || next.surfaceNormalEnabled === true
    ) {
        next.surfaceOpticsEnabled = true;
    }

    const patchEnablesOptics = Object.keys(patch).some(
        (key) => OPTICS_TOGGLE_KEYS.has(key) && patch[key] === true,
    );
    const opticsActive = (
        next.surfaceOpticsEnabled === true
        || next.surfaceNormalEnabled === true
        || next.screenRefractionEnabled === true
        || next.surfaceReflectionEnabled === true
        || next.rgbSplitEnabled === true
    );
    next.surfacePipelineMode = patchEnablesOptics || opticsActive
        ? ZEN_RENDERER_SURFACE_PIPELINE_MODES.OPTICS_EXPERIMENTAL
        : ZEN_RENDERER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY;

    return normalizeZenRendererDebugToggles(next);
};

export const resolvePondLabEffectControl = (toggles, key) => {
    const plan = resolveZenWaterSurfaceFeaturePlan(toggles);
    const layerKeys = ['benthicEnabled', 'causticsEnabled', 'godRaysEnabled', 'atmosphereEnabled', 'komorebiEnabled'];
    let disabled = false;
    if (key === 'waterSurfaceEffectsEnabled' || key === 'waterLayerEffectsEnabled') disabled = !plan.waterEffectsEnabled;
    else if (key in plan && key !== 'waterEffectsEnabled') {
        disabled = !plan.waterSurfaceEffectsEnabled;
        if (key === 'rgbSplitEnabled') disabled ||= !plan.screenRefractionEnabled;
    } else if (layerKeys.includes(key)) {
        disabled = !plan.waterEffectsEnabled || !toggles.waterLayerEffectsEnabled;
    }
    const active = key in plan ? plan[key] === true : toggles[key] === true;
    let blockedBy = null;
    if (disabled) {
        if (!plan.waterEffectsEnabled) blockedBy = 'waterEffectsEnabled';
        else if (layerKeys.includes(key)) blockedBy = 'waterLayerEffectsEnabled';
        else if (!plan.waterSurfaceEffectsEnabled) blockedBy = 'waterSurfaceEffectsEnabled';
        else blockedBy = 'screenRefractionEnabled';
    }
    return { active: !disabled && active, disabled, blockedBy, requested: toggles[key] === true };
};

export const createPondLabSoloEffects = (key) => {
    const group = ZEN_POND_LAB_WATER_EFFECT_GROUPS.find(entry => entry.id !== 'gates' && entry.items.some(item => item.key === key));
    if (!group) throw new Error(`ZEN_POND_LAB_SOLO_EFFECT_INVALID:${key}`);
    const patch = { [key]: true };
    if (group.id === 'layers') Object.assign(patch, { waterEffectsEnabled: true, waterLayerEffectsEnabled: true });
    if (group.id === 'surface') Object.assign(patch, { waterEffectsEnabled: true, waterSurfaceEffectsEnabled: true });
    // A disturbance source needs the surface consumer to make its field visible.
    if (group.id === 'interaction' && key !== 'fishShadowEnabled') Object.assign(patch, {
        waterEffectsEnabled: true, waterSurfaceEffectsEnabled: true, screenRefractionEnabled: true, surfaceNormalEnabled: true,
    });
    return resolvePondLabRendererTogglePatch(resolveZenRendererDebugTogglePreset('off'), patch);
};
