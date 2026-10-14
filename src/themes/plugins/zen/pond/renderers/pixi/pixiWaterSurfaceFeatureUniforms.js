import {
    normalizeZenRendererDebugToggles,
    resolveZenRendererDebugTogglePreset,
    resolveZenWaterSurfaceFeaturePlan,
    ZEN_RENDERER_SURFACE_PIPELINE_MODES,
} from '../../contracts/zenRendererDebugToggles.js';

export const PIXI_WATER_SURFACE_PIPELINE_MODES = ZEN_RENDERER_SURFACE_PIPELINE_MODES;

const SURFACE_PIPELINE_MODE_VALUES = Object.freeze(
    Object.values(PIXI_WATER_SURFACE_PIPELINE_MODES),
);

const isFullDebugToggleState = (value = null) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, 'waterEffectsEnabled')
    && Object.prototype.hasOwnProperty.call(value, 'waterSurfaceEffectsEnabled')
);

const resolveSurfaceFeatureToggleState = (effectDebugToggles = null) => {
    if (!effectDebugToggles) {
        return resolveZenRendererDebugTogglePreset('on');
    }
    if (isFullDebugToggleState(effectDebugToggles)) {
        return normalizeZenRendererDebugToggles(effectDebugToggles);
    }
    const defaultSurfaceToggles = {
        ...resolveZenRendererDebugTogglePreset('on'),
    };
    delete defaultSurfaceToggles.surfacePipelineMode;
    delete defaultSurfaceToggles.surfaceOpticsEnabled;
    delete defaultSurfaceToggles.surfaceNormalEnabled;
    delete defaultSurfaceToggles.screenRefractionEnabled;
    delete defaultSurfaceToggles.surfaceReflectionEnabled;
    return normalizeZenRendererDebugToggles({
        ...defaultSurfaceToggles,
        ...effectDebugToggles,
    });
};

export const normalizePixiWaterSurfacePipelineMode = (
    value,
    fallback = PIXI_WATER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY,
) => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (SURFACE_PIPELINE_MODE_VALUES.includes(normalized)) {
        return normalized;
    }
    return SURFACE_PIPELINE_MODE_VALUES.includes(fallback)
        ? fallback
        : PIXI_WATER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY;
};

export const resolvePixiWaterSurfacePipelineMode = (effectDebugToggles = null) => {
    const normalized = resolveSurfaceFeatureToggleState(effectDebugToggles);
    return resolveZenWaterSurfaceFeaturePlan(normalized).pipelineMode;
};

export const resolvePixiWaterSurfaceFeatureUniforms = (effectDebugToggles = null) => {
    const normalized = resolveSurfaceFeatureToggleState(effectDebugToggles);
    const featurePlan = resolveZenWaterSurfaceFeaturePlan(normalized);
    return {
        pipelineMode: featurePlan.pipelineMode,
        cloudReflectionEnabled: normalized.waterEffectsEnabled === true
            && normalized.waterSurfaceEffectsEnabled === true
            && normalized.cloudReflectionEnabled === true ? 1.0 : 0.0,
        surfaceOpticsEnabled: featurePlan.surfaceOpticsEnabled ? 1.0 : 0.0,
        surfaceNormalEnabled: featurePlan.surfaceNormalEnabled ? 1.0 : 0.0,
        screenRefractionEnabled: featurePlan.screenRefractionEnabled ? 1.0 : 0.0,
        surfaceReflectionEnabled: featurePlan.surfaceReflectionEnabled ? 1.0 : 0.0,
        rgbSplitEnabled: featurePlan.rgbSplitEnabled ? 1.0 : 0.0,
        yoonseulEnabled: featurePlan.yoonseulEnabled ? 1.0 : 0.0,
        surfaceFieldCausticsEnabled: normalized.causticsEnabled === true ? 1.0 : 0.0,
    };
};
