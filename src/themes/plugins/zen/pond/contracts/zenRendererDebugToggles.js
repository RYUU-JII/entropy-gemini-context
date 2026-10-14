export const ZEN_RENDERER_SURFACE_PIPELINE_MODES = Object.freeze({
    YOONSEUL_ONLY: 'yoonseul_only',
    OPTICS_EXPERIMENTAL: 'optics_experimental',
});

const SURFACE_PIPELINE_MODE_VALUES = Object.freeze(
    Object.values(ZEN_RENDERER_SURFACE_PIPELINE_MODES),
);

const OFF_TOGGLE_SOURCE = Object.freeze({
    waterEffectsEnabled: false,
    waterSurfaceEffectsEnabled: false,
    waterLayerEffectsEnabled: false,
    surfacePipelineMode: ZEN_RENDERER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY,
    surfaceOpticsEnabled: false,
    surfaceNormalEnabled: false,
    screenRefractionEnabled: false,
    surfaceReflectionEnabled: false,
    rgbSplitEnabled: false,
    yoonseulEnabled: false,
    cloudReflectionEnabled: false,
    benthicEnabled: false,
    causticsEnabled: false,
    komorebiEnabled: false,
    godRaysEnabled: false,
    atmosphereEnabled: false,
    fishShadowEnabled: false,
    koiWakeDisturbanceEnabled: false,
    tapDisturbanceEnabled: false,
    petalDisturbanceEnabled: false,
    topShadowDebugBlackout: false,
    koiIntentHudEnabled: false,
});

const ENABLED_TOGGLE_SOURCE = Object.freeze({
    waterEffectsEnabled: true,
    waterSurfaceEffectsEnabled: true,
    waterLayerEffectsEnabled: true,
    surfacePipelineMode: ZEN_RENDERER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY,
    surfaceOpticsEnabled: false,
    surfaceNormalEnabled: false,
    screenRefractionEnabled: false,
    surfaceReflectionEnabled: false,
    rgbSplitEnabled: false,
    yoonseulEnabled: true,
    cloudReflectionEnabled: true,
    benthicEnabled: true,
    causticsEnabled: true,
    komorebiEnabled: true,
    godRaysEnabled: true,
    atmosphereEnabled: true,
    fishShadowEnabled: true,
    koiWakeDisturbanceEnabled: true,
    tapDisturbanceEnabled: true,
    petalDisturbanceEnabled: true,
    topShadowDebugBlackout: false,
    koiIntentHudEnabled: false,
});

export const ZEN_RENDERER_DEBUG_TOGGLES_GLOBAL_KEY = '__ZEN_POND_EFFECT_DEBUG_TOGGLES';

export const ZEN_RENDERER_WATER_EFFECT_COST_TIERS = Object.freeze({
    low: Object.freeze([
        'benthicEnabled',
        'atmosphereEnabled',
    ]),
    moderate: Object.freeze([
        'causticsEnabled',
        'komorebiEnabled',
        'godRaysEnabled',
        'fishShadowEnabled',
    ]),
    high: Object.freeze([
        'waterSurfaceEffectsEnabled',
        'surfacePipelineMode',
        'surfaceOpticsEnabled',
        'surfaceNormalEnabled',
        'screenRefractionEnabled',
        'surfaceReflectionEnabled',
        'yoonseulEnabled',
        'rgbSplitEnabled',
        'cloudReflectionEnabled',
    ]),
    source: Object.freeze([
        'koiWakeDisturbanceEnabled',
        'tapDisturbanceEnabled',
        'petalDisturbanceEnabled',
    ]),
});

export const ZEN_RENDERER_DEBUG_TOGGLE_PRESETS = Object.freeze({
    off: OFF_TOGGLE_SOURCE,
    on: ENABLED_TOGGLE_SOURCE,
    low: ENABLED_TOGGLE_SOURCE,
    balanced: ENABLED_TOGGLE_SOURCE,
    full: ENABLED_TOGGLE_SOURCE,
});

export const DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES = ZEN_RENDERER_DEBUG_TOGGLE_PRESETS.off;

const resolveToggleBoolean = (value, fallback = false) => {
    if (value === true) return true;
    if (value === false) return false;
    return fallback === true;
};

const resolveSurfaceOpticsEnabled = (toggles = null) => resolveToggleBoolean(
    toggles?.surfaceOpticsEnabled,
    DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.surfaceOpticsEnabled,
);

const normalizeSurfacePipelineMode = (value, fallback = ZEN_RENDERER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY) => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (SURFACE_PIPELINE_MODE_VALUES.includes(normalized)) {
        return normalized;
    }
    return SURFACE_PIPELINE_MODE_VALUES.includes(fallback)
        ? fallback
        : ZEN_RENDERER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY;
};

const isToggleObject = (value) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
);

const resolvePresetName = (presetName = 'full', fallbackName = 'full') => {
    const normalized = typeof presetName === 'string' ? presetName.trim().toLowerCase() : '';
    if (Object.prototype.hasOwnProperty.call(ZEN_RENDERER_DEBUG_TOGGLE_PRESETS, normalized)) {
        return normalized;
    }
    const fallback = typeof fallbackName === 'string' ? fallbackName.trim().toLowerCase() : '';
    if (Object.prototype.hasOwnProperty.call(ZEN_RENDERER_DEBUG_TOGGLE_PRESETS, fallback)) {
        return fallback;
    }
    return 'full';
};

export const normalizeZenRendererDebugToggles = (toggles = null) => {
    const requestedPipelineMode = typeof toggles?.surfacePipelineMode === 'string'
        ? toggles.surfacePipelineMode.trim().toLowerCase()
        : '';
    const hasExplicitPipelineMode = SURFACE_PIPELINE_MODE_VALUES.includes(requestedPipelineMode);
    const surfaceOpticsRequested = resolveSurfaceOpticsEnabled(toggles);
    const explicitSurfaceNormal = resolveToggleBoolean(
        toggles?.surfaceNormalEnabled,
        surfaceOpticsRequested,
    );
    const explicitScreenRefraction = resolveToggleBoolean(
        toggles?.screenRefractionEnabled,
        surfaceOpticsRequested,
    );
    const explicitSurfaceReflection = resolveToggleBoolean(
        toggles?.surfaceReflectionEnabled,
        surfaceOpticsRequested,
    );
    const surfaceNormalEnabled = (
        explicitSurfaceNormal
        || explicitScreenRefraction
        || explicitSurfaceReflection
    );
    const surfaceOpticsEnabled = (
        surfaceOpticsRequested
        || surfaceNormalEnabled
        || explicitScreenRefraction
        || explicitSurfaceReflection
    );
    const pipelineFallback = surfaceOpticsEnabled
        ? ZEN_RENDERER_SURFACE_PIPELINE_MODES.OPTICS_EXPERIMENTAL
        : ZEN_RENDERER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY;
    const surfacePipelineMode = hasExplicitPipelineMode
        ? requestedPipelineMode
        : pipelineFallback;
    const yoonseulOnlyPipeline = surfacePipelineMode === ZEN_RENDERER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY;

    return {
        waterEffectsEnabled: resolveToggleBoolean(
            toggles?.waterEffectsEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.waterEffectsEnabled,
        ),
        waterSurfaceEffectsEnabled: resolveToggleBoolean(
            toggles?.waterSurfaceEffectsEnabled,
            toggles?.waterEffectsEnabled ?? DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.waterSurfaceEffectsEnabled,
        ),
        waterLayerEffectsEnabled: resolveToggleBoolean(
            toggles?.waterLayerEffectsEnabled,
            toggles?.waterEffectsEnabled ?? DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.waterLayerEffectsEnabled,
        ),
        surfacePipelineMode,
        surfaceOpticsEnabled: yoonseulOnlyPipeline ? false : surfaceOpticsEnabled,
        surfaceNormalEnabled: yoonseulOnlyPipeline ? false : surfaceNormalEnabled,
        screenRefractionEnabled: yoonseulOnlyPipeline ? false : explicitScreenRefraction,
        surfaceReflectionEnabled: yoonseulOnlyPipeline ? false : explicitSurfaceReflection,
        rgbSplitEnabled: resolveToggleBoolean(
            toggles?.rgbSplitEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.rgbSplitEnabled,
        ),
        yoonseulEnabled: resolveToggleBoolean(
            toggles?.yoonseulEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.yoonseulEnabled,
        ),
        cloudReflectionEnabled: resolveToggleBoolean(
            toggles?.cloudReflectionEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.cloudReflectionEnabled,
        ),
        benthicEnabled: resolveToggleBoolean(
            toggles?.benthicEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.benthicEnabled,
        ),
        causticsEnabled: resolveToggleBoolean(
            toggles?.causticsEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.causticsEnabled,
        ),
        komorebiEnabled: resolveToggleBoolean(
            toggles?.komorebiEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.komorebiEnabled,
        ),
        godRaysEnabled: resolveToggleBoolean(
            toggles?.godRaysEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.godRaysEnabled,
        ),
        atmosphereEnabled: resolveToggleBoolean(
            toggles?.atmosphereEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.atmosphereEnabled,
        ),
        fishShadowEnabled: resolveToggleBoolean(
            toggles?.fishShadowEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.fishShadowEnabled,
        ),
        koiWakeDisturbanceEnabled: resolveToggleBoolean(
            toggles?.koiWakeDisturbanceEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.koiWakeDisturbanceEnabled,
        ),
        tapDisturbanceEnabled: resolveToggleBoolean(
            toggles?.tapDisturbanceEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.tapDisturbanceEnabled,
        ),
        petalDisturbanceEnabled: resolveToggleBoolean(
            toggles?.petalDisturbanceEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.petalDisturbanceEnabled,
        ),
        topShadowDebugBlackout: resolveToggleBoolean(
            toggles?.topShadowDebugBlackout,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.topShadowDebugBlackout,
        ),
        koiIntentHudEnabled: resolveToggleBoolean(
            toggles?.koiIntentHudEnabled,
            DEFAULT_ZEN_RENDERER_DEBUG_TOGGLES.koiIntentHudEnabled,
        ),
    };
};

export const resolveZenRendererDebugTogglePreset = (
    presetName = 'full',
    fallbackName = 'full',
) => normalizeZenRendererDebugToggles(
    ZEN_RENDERER_DEBUG_TOGGLE_PRESETS[resolvePresetName(presetName, fallbackName)],
);

export const resolveZenRendererDebugTogglesForControlState = ({
    presetName = 'on',
    toggles = null,
    fallbackName = 'on',
} = {}) => {
    if (isToggleObject(toggles)) {
        return normalizeZenRendererDebugToggles(toggles);
    }
    return resolveZenRendererDebugTogglePreset(presetName, fallbackName);
};

export const resolveZenWaterSurfaceFeaturePlan = (toggles = null) => {
    const normalized = normalizeZenRendererDebugToggles(toggles);
    const waterEffectsEnabled = normalized.waterEffectsEnabled === true;
    const waterSurfaceEffectsEnabled = (
        waterEffectsEnabled
        && normalized.waterSurfaceEffectsEnabled === true
    );
    const opticsPipeline = (
        waterSurfaceEffectsEnabled
        && normalized.surfacePipelineMode === ZEN_RENDERER_SURFACE_PIPELINE_MODES.OPTICS_EXPERIMENTAL
    );
    const surfaceNormalEnabled = opticsPipeline && normalized.surfaceNormalEnabled === true;
    const screenRefractionEnabled = opticsPipeline && normalized.screenRefractionEnabled === true;
    const surfaceReflectionEnabled = opticsPipeline && normalized.surfaceReflectionEnabled === true;
    const surfaceOpticsEnabled = (
        surfaceNormalEnabled
        || screenRefractionEnabled
        || surfaceReflectionEnabled
    );
    const yoonseulEnabled = (
        waterSurfaceEffectsEnabled
        && normalized.yoonseulEnabled === true
    );
    const rgbSplitEnabled = (
        screenRefractionEnabled
        && normalized.rgbSplitEnabled === true
    );

    return Object.freeze({
        debugToggles: Object.freeze({
            ...normalized,
        }),
        pipelineMode: normalized.surfacePipelineMode,
        waterEffectsEnabled,
        waterSurfaceEffectsEnabled,
        surfaceEffectsEnabled: waterSurfaceEffectsEnabled,
        cloudReflectionEnabled: waterSurfaceEffectsEnabled && normalized.cloudReflectionEnabled === true,
        opticsPipeline,
        surfaceOpticsEnabled,
        surfaceNormalEnabled,
        screenRefractionEnabled,
        surfaceReflectionEnabled,
        rgbSplitEnabled,
        yoonseulEnabled,
    });
};

export const buildZenRendererDebugTogglesSignature = (toggles = null) => {
    const normalized = normalizeZenRendererDebugToggles(toggles);
    return [
        `we:${normalized.waterEffectsEnabled ? 1 : 0}`,
        `ws:${normalized.waterSurfaceEffectsEnabled ? 1 : 0}`,
        `wl:${normalized.waterLayerEffectsEnabled ? 1 : 0}`,
        `sp:${normalized.surfacePipelineMode}`,
        `so:${normalized.surfaceOpticsEnabled ? 1 : 0}`,
        `sn:${normalized.surfaceNormalEnabled ? 1 : 0}`,
        `sr:${normalized.screenRefractionEnabled ? 1 : 0}`,
        `sf:${normalized.surfaceReflectionEnabled ? 1 : 0}`,
        `rs:${normalized.rgbSplitEnabled ? 1 : 0}`,
        `yo:${normalized.yoonseulEnabled ? 1 : 0}`,
        `cr:${normalized.cloudReflectionEnabled ? 1 : 0}`,
        `be:${normalized.benthicEnabled ? 1 : 0}`,
        `ca:${normalized.causticsEnabled ? 1 : 0}`,
        `ko:${normalized.komorebiEnabled ? 1 : 0}`,
        `gr:${normalized.godRaysEnabled ? 1 : 0}`,
        `at:${normalized.atmosphereEnabled ? 1 : 0}`,
        `fs:${normalized.fishShadowEnabled ? 1 : 0}`,
        `kw:${normalized.koiWakeDisturbanceEnabled ? 1 : 0}`,
        `td:${normalized.tapDisturbanceEnabled ? 1 : 0}`,
        `pd:${normalized.petalDisturbanceEnabled ? 1 : 0}`,
        `kb:${normalized.topShadowDebugBlackout ? 1 : 0}`,
        `kh:${normalized.koiIntentHudEnabled ? 1 : 0}`,
    ].join('|');
};
