import { readZenPondShadowLightingMetrics } from '../../contracts/zenPondShadowLightingMetrics.js';
import {
    ZEN_RENDERER_DEBUG_TOGGLE_PRESETS,
    ZEN_RENDERER_DEBUG_TOGGLES_GLOBAL_KEY,
    ZEN_RENDERER_SURFACE_PIPELINE_MODES,
    ZEN_RENDERER_WATER_EFFECT_COST_TIERS,
    normalizeZenRendererDebugToggles,
    resolveZenRendererDebugTogglePreset,
} from '../../contracts/zenRendererDebugToggles.js';
import {
    readZenWaterSurfaceFieldRainModelId,
} from '../../contracts/zenWaterSurfaceFieldRainModel.js';
import {
    readZenWaterSurfaceFieldYoonseulModelId,
} from '../../contracts/zenWaterSurfaceFieldYoonseulModel.js';
import {
    readZenPondBenthicMaterialOwnerId,
} from '../../contracts/zenPondBenthicMaterial.js';
import {
    readZenPondCanopyModelId,
} from '../../contracts/zenPondCanopyMaterial.js';
import {
    readZenPondCausticReceiverModelId,
    readZenPondCausticPresentationModelId,
    ZEN_POND_CAUSTIC_PRESENTATION_MODEL_IDS,
} from '../../contracts/zenPondCausticPresentation.js';
import {
    ZEN_SURFACE_DISTURBANCE_SOURCES,
} from '../../runtime/surface/zenSurfaceDisturbance.js';
import { isObject } from './sharedUtils.js';

export const ZEN_POND_WATER_EFFECTS_DEBUG_GLOBAL_KEY = '__ZEN_POND_WATER_EFFECTS_DEBUG';
export const ZEN_POND_WATER_EFFECTS_DEBUG_OWNER_KEY = '__ZEN_POND_WATER_EFFECTS_DEBUG_OWNER';

const MASTER_TOGGLE_KEY = 'waterEffectsEnabled';
const SURFACE_PARENT_TOGGLE_KEY = 'waterSurfaceEffectsEnabled';
const LAYER_PARENT_TOGGLE_KEY = 'waterLayerEffectsEnabled';

const WATER_SURFACE_CHILD_TOGGLE_KEYS = Object.freeze([
    'surfaceOpticsEnabled',
    'surfaceNormalEnabled',
    'screenRefractionEnabled',
    'surfaceReflectionEnabled',
    'rgbSplitEnabled',
    'yoonseulEnabled',
    'koiWakeDisturbanceEnabled',
    'tapDisturbanceEnabled',
    'petalDisturbanceEnabled',
]);

const SURFACE_DISTURBANCE_TOGGLE_KEYS = Object.freeze([
    'koiWakeDisturbanceEnabled',
    'tapDisturbanceEnabled',
    'petalDisturbanceEnabled',
]);

const WATER_SURFACE_OPTICS_TOGGLE_KEYS = Object.freeze([
    'surfaceOpticsEnabled',
    'surfaceNormalEnabled',
    'screenRefractionEnabled',
    'surfaceReflectionEnabled',
    'rgbSplitEnabled',
]);

const WATER_LAYER_CHILD_TOGGLE_KEYS = Object.freeze([
    'benthicEnabled',
    'causticsEnabled',
    'komorebiEnabled',
    'godRaysEnabled',
    'cloudReflectionEnabled',
    'atmosphereEnabled',
]);

export const WATER_EFFECT_DEBUG_TOGGLE_KEYS = Object.freeze([
    MASTER_TOGGLE_KEY,
    SURFACE_PARENT_TOGGLE_KEY,
    LAYER_PARENT_TOGGLE_KEY,
    ...WATER_SURFACE_CHILD_TOGGLE_KEYS,
    ...WATER_LAYER_CHILD_TOGGLE_KEYS,
    'fishShadowEnabled',
    'topShadowDebugBlackout',
]);

export const WATER_EFFECT_DEBUG_TOGGLE_ALIASES = Object.freeze({
    benthic: 'benthicEnabled',
    atmosphere: 'atmosphereEnabled',
    godRays: 'godRaysEnabled',
    caustics: 'causticsEnabled',
    komorebi: 'komorebiEnabled',
    fishShadow: 'fishShadowEnabled',
    koiWake: 'koiWakeDisturbanceEnabled',
    tapDisturbance: 'tapDisturbanceEnabled',
    petalDisturbance: 'petalDisturbanceEnabled',
    surfaceOptics: 'surfaceOpticsEnabled',
    surfaceNormal: 'surfaceNormalEnabled',
    screenRefraction: 'screenRefractionEnabled',
    surfaceReflection: 'surfaceReflectionEnabled',
    yoonseul: 'yoonseulEnabled',
    cloudReflection: 'cloudReflectionEnabled',
    rgbSplit: 'rgbSplitEnabled',
});

export const WATER_EFFECT_DEBUG_PROFILE_KEYS = Object.freeze(
    Object.keys(WATER_EFFECT_DEBUG_TOGGLE_ALIASES),
);

const wait = (durationMs) => new Promise((resolve) => {
    setTimeout(resolve, durationMs);
});

const RUNTIME_HEALTH_SYNC_COUNTER_KEYS = Object.freeze([
    'runtimeParamSyncCount',
    'ambientPopulationSyncCount',
    'fishRosterSyncCount',
    'sceneSessionSyncCount',
    'staticSceneSyncCount',
]);

const roundNumber = (value, digits = 2, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Number(numeric.toFixed(digits));
};

const clampDurationMs = (value, fallback = 1200) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(10000, Math.max(120, Math.floor(numeric)));
};

const clampTimelineIntervalMs = (value, fallback = 250) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(1000, Math.max(60, Math.floor(numeric)));
};

const resolveToggleKey = (key) => {
    if (typeof key !== 'string' || !key.trim()) {
        throw new Error('ZEN_POND_WATER_EFFECT_DEBUG_TOGGLE_KEY_REQUIRED');
    }
    const trimmed = key.trim();
    const canonicalKey =
        WATER_EFFECT_DEBUG_TOGGLE_ALIASES[trimmed]
        || trimmed;
    if (!WATER_EFFECT_DEBUG_TOGGLE_KEYS.includes(canonicalKey)) {
        throw new Error(`ZEN_POND_WATER_EFFECT_DEBUG_TOGGLE_UNKNOWN:${trimmed}`);
    }
    return canonicalKey;
};

const resolveToggleKeyList = (keys) => {
    const list = Array.isArray(keys) ? keys : [keys];
    return list.map((key) => resolveToggleKey(key));
};

const buildDefaultToggleState = () => normalizeZenRendererDebugToggles(
    ZEN_RENDERER_DEBUG_TOGGLE_PRESETS.off,
);

const readRawGlobalToggles = (debugGlobal = null) => (
    isObject(debugGlobal?.[ZEN_RENDERER_DEBUG_TOGGLES_GLOBAL_KEY])
        ? debugGlobal[ZEN_RENDERER_DEBUG_TOGGLES_GLOBAL_KEY]
        : null
);

const readNormalizedGlobalToggles = (debugGlobal = null) => (
    normalizeZenRendererDebugToggles(readRawGlobalToggles(debugGlobal))
);

const disableKeys = (target, keys) => {
    for (let i = 0; i < keys.length; i += 1) {
        target[keys[i]] = false;
    }
};

const hasEnabledSurfaceOpticsToggle = (target) => (
    WATER_SURFACE_OPTICS_TOGGLE_KEYS.some((key) => target[key] === true)
);

const applyParentToggleRules = (target, changedKey, nextValue) => {
    if (nextValue === true) {
        if (changedKey === SURFACE_PARENT_TOGGLE_KEY) {
            target[MASTER_TOGGLE_KEY] = true;
            return;
        }
        if (changedKey === LAYER_PARENT_TOGGLE_KEY) {
            target[MASTER_TOGGLE_KEY] = true;
            return;
        }
        if (WATER_SURFACE_CHILD_TOGGLE_KEYS.includes(changedKey)) {
            target[MASTER_TOGGLE_KEY] = true;
            target[SURFACE_PARENT_TOGGLE_KEY] = true;
            if (SURFACE_DISTURBANCE_TOGGLE_KEYS.includes(changedKey)) {
                target.yoonseulEnabled = true;
            }
            if (WATER_SURFACE_OPTICS_TOGGLE_KEYS.includes(changedKey)) {
                target.surfacePipelineMode = ZEN_RENDERER_SURFACE_PIPELINE_MODES.OPTICS_EXPERIMENTAL;
            }
            return;
        }
        if (WATER_LAYER_CHILD_TOGGLE_KEYS.includes(changedKey)) {
            target[MASTER_TOGGLE_KEY] = true;
            target[LAYER_PARENT_TOGGLE_KEY] = true;
        }
        return;
    }

    if (changedKey === MASTER_TOGGLE_KEY) {
        target[SURFACE_PARENT_TOGGLE_KEY] = false;
        target.surfacePipelineMode = ZEN_RENDERER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY;
        target[LAYER_PARENT_TOGGLE_KEY] = false;
        disableKeys(target, WATER_SURFACE_CHILD_TOGGLE_KEYS);
        disableKeys(target, WATER_LAYER_CHILD_TOGGLE_KEYS);
        return;
    }
    if (changedKey === SURFACE_PARENT_TOGGLE_KEY) {
        target.surfacePipelineMode = ZEN_RENDERER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY;
        disableKeys(target, WATER_SURFACE_CHILD_TOGGLE_KEYS);
        return;
    }
    if (changedKey === LAYER_PARENT_TOGGLE_KEY) {
        disableKeys(target, WATER_LAYER_CHILD_TOGGLE_KEYS);
    }
};

export const applyZenPondWaterEffectDebugPatch = (baseToggles, patch = {}) => {
    if (!isObject(patch)) {
        throw new Error('ZEN_POND_WATER_EFFECT_DEBUG_PATCH_OBJECT_REQUIRED');
    }
    const next = {
        ...buildDefaultToggleState(),
        ...normalizeZenRendererDebugToggles(baseToggles),
    };
    const entries = Object.entries(patch);
    for (let i = 0; i < entries.length; i += 1) {
        const [rawKey, rawValue] = entries[i];
        const key = resolveToggleKey(rawKey);
        if (rawValue !== true && rawValue !== false) {
            throw new Error(`ZEN_POND_WATER_EFFECT_DEBUG_TOGGLE_BOOLEAN_REQUIRED:${rawKey}`);
        }
        next[key] = rawValue;
        applyParentToggleRules(next, key, rawValue);
        if (
            rawValue === false
            && WATER_SURFACE_OPTICS_TOGGLE_KEYS.includes(key)
            && !hasEnabledSurfaceOpticsToggle(next)
        ) {
            next.surfacePipelineMode = ZEN_RENDERER_SURFACE_PIPELINE_MODES.YOONSEUL_ONLY;
        }
    }
    return normalizeZenRendererDebugToggles(next);
};

export const buildZenPondWaterEffectOnlyDebugToggles = (keys) => {
    const next = {
        ...buildDefaultToggleState(),
    };
    const resolvedKeys = resolveToggleKeyList(keys);
    for (let i = 0; i < resolvedKeys.length; i += 1) {
        const key = resolvedKeys[i];
        next[key] = true;
        applyParentToggleRules(next, key, true);
    }
    return normalizeZenRendererDebugToggles(next);
};

const summarizeProbeGates = (probe = null) => {
    if (!isObject(probe)) return null;
    return {
        surfaceOptics: Number(probe.surfaceOpticsGate) || 0,
        benthic: Number(probe.benthicGate) || 0,
        caustics: Number(probe.causticGate) || 0,
        komorebi: Number(probe.komorebiActive ? 1 : 0),
        godRays: Number(probe.godRaysGate) || 0,
        highlights: Number(probe.highlightsGate) || 0,
        cloudReflection: Number(probe.cloudReflectionToggleGate) || 0,
        cloudReflectionCompute: probe.cloudReflectionComputeEnabled === true,
        atmosphere: Number(probe.atmosphereGate) || 0,
    };
};

const summarizeProbeKomorebi = (probe = null) => {
    if (!isObject(probe)) return null;
    const requested = probe.komorebiRequested === true;
    const textureAllocated = probe.komorebiTextureAllocated === true;
    return {
        modelId: readZenPondCanopyModelId(
            probe.komorebiModelId,
            {
                required: requested || textureAllocated,
            },
        ),
        requested,
        active: probe.komorebiActive === true,
        alpha: roundNumber(Number(probe.komorebiAlpha) || 0, 6, 0),
        maximumAlpha: roundNumber(
            Number(probe.komorebiMaximumAlpha) || 0,
            6,
            0,
        ),
        textureAllocated,
        textureSize: Math.max(
            0,
            Math.floor(Number(probe.komorebiTextureSize) || 0),
        ),
        textureCount: Math.max(0, Math.floor(Number(probe.komorebiTextureCount) || 0)),
        rawTextureBytes: Math.max(
            0,
            Math.floor(Number(probe.komorebiRawTextureBytes) || 0),
        ),
        textureBuildMs: probe.komorebiTextureBuildMs === null
            || probe.komorebiTextureBuildMs === undefined
            ? null
            : roundNumber(probe.komorebiTextureBuildMs, 4, 0),
        maskCoverageRatio: roundNumber(
            Number(probe.komorebiMaskCoverageRatio) || 0,
            6,
            0,
        ),
        maskPatchCount: Math.max(
            0,
            Math.floor(Number(probe.komorebiMaskPatchCount) || 0),
        ),
        drawCount: Math.max(
            0,
            Math.floor(Number(probe.komorebiDrawCount) || 0),
        ),
        sharedCanopyDrawCount: Math.max(0, Math.floor(Number(probe.canopyDrawCount) || 0)),
        transferModelId: probe.canopyTransferModelId,
        directContrast: roundNumber(Number(probe.canopyDirectContrast) || 0, 6, 0),
        diffuseContrast: roundNumber(Number(probe.canopyDiffuseContrast) || 0, 6, 0),
        shadeCoverageRatio: roundNumber(Number(probe.canopyShadeCoverageRatio) || 0, 6, 0),
        foliageLobeCount: Math.max(0, Math.floor(Number(probe.canopyFoliageLobeCount) || 0)),
        openTransfer: probe.canopyOpenTransfer,
        gapTransfer: probe.canopyGapTransfer,
        shadeTransfer: probe.canopyShadeTransfer,
        textureBakeSupported:
            probe.komorebiTextureBakeSupported === true,
        reason:
            typeof probe.komorebiReason === 'string'
            && probe.komorebiReason.trim()
                ? probe.komorebiReason.trim()
                : null,
        daylightGate: roundNumber(
            Number(probe.komorebiDaylightGate) || 0,
            6,
            0,
        ),
        directLightGate: roundNumber(
            Number(probe.komorebiDirectLightGate) || 0,
            6,
            0,
        ),
        weatherGate: roundNumber(
            Number(probe.komorebiWeatherGate) || 0,
            6,
            0,
        ),
    };
};

const summarizeProbeAlphas = (probe = null) => {
    if (!isObject(probe)) return null;
    return {
        pebble: Number(probe.pebbleAlpha) || 0,
        pebbleDetail: Number(probe.pebbleDetailAlpha) || 0,
        refractedGuide: Number(probe.refractedGuideAlpha) || 0,
        causticPrimary: Number(probe.causticPrimaryAlpha) || 0,
        causticSecondary: Number(probe.causticSecondaryAlpha) || 0,
        highlightPrimary: Number(probe.highlightPrimaryAlpha) || 0,
        highlightMicro: Number(probe.highlightMicroAlpha) || 0,
        atmosphere: Number(probe.atmosphereAlpha) || 0,
        topShadow: Number(probe.primaryAlpha) || 0,
    };
};

const summarizeProbeSkyReflection = (probe = null) => {
    if (!isObject(probe)) return null;
    return {
        enabled: probe.cloudReflectionEnabled === true,
        sourceOwner: probe.cloudReflectionSourceOwner,
        cloudFieldSeed: probe.cloudFieldSeed,
        textureCount: Math.max(0, Math.floor(Number(probe.cloudFieldTextureCount) || 0)),
        textureBytes: Math.max(0, Math.floor(Number(probe.cloudFieldTextureBytes) || 0)),
        additionalPasses: Math.max(0, Math.floor(Number(probe.cloudReflectionAdditionalPasses) || 0)),
        sunTransmission: roundNumber(Number(probe.sunTransmission) || 0, 6, 0),
        directSunlight: roundNumber(Number(probe.directSunlight) || 0, 6, 0),
        diffuseSkylight: roundNumber(Number(probe.diffuseSkylight) || 0, 6, 0),
        sceneBrightness: roundNumber(Number(probe.sceneBrightness) || 0, 6, 0),
    };
};

const summarizeProbeYoonseul = (probe = null) => {
    if (!isObject(probe)) return null;
    return {
        enabled: probe.yoonseulEnabled === true,
        modelId: readZenWaterSurfaceFieldYoonseulModelId(
            probe.surfaceFieldYoonseulModelId,
            {
                required: (
                    probe.yoonseulEnabled === true
                    && (
                        probe.surfaceFieldActive === true
                        || probe.surfaceFieldReady === true
                    )
                ),
            },
        ),
        topViewBlend: {
            min: roundNumber(
                Number(probe.yoonseulTopViewBlendMin) || 0,
                4,
                0,
            ),
            max: roundNumber(
                Number(probe.yoonseulTopViewBlendMax) || 0,
                4,
                0,
            ),
        },
        coverageRoughness: {
            min: roundNumber(
                Number(probe.yoonseulCoverageRoughnessMin) || 0,
                4,
                0,
            ),
            max: roundNumber(
                Number(probe.yoonseulCoverageRoughnessMax) || 0,
                4,
                0,
            ),
        },
        coverageWeight: {
            unfocused: roundNumber(
                Number(probe.yoonseulCoverageWeightUnfocused) || 0,
                4,
                0,
            ),
            focused: roundNumber(
                Number(probe.yoonseulCoverageWeightFocused) || 0,
                4,
                0,
            ),
        },
        surfacePipelineMode: typeof probe.surfacePipelineMode === 'string'
            ? probe.surfacePipelineMode
            : '',
        surfaceOpticsEnabled: probe.surfaceOpticsEnabled === true,
        surfaceNormalEnabled: probe.surfaceNormalEnabled === true,
        screenRefractionEnabled: probe.screenRefractionEnabled === true,
        surfaceReflectionEnabled: probe.surfaceReflectionEnabled === true,
        rgbSplitEnabled: probe.rgbSplitEnabled === true,
        algorithmMode: roundNumber(Number(probe.waterReflectionAlgorithmMode) || 0, 3, 0),
        stability: roundNumber(Number(probe.waterReflectionStability) || 0, 3, 0),
        spatialStability: roundNumber(Number(probe.waterReflectionSpatialStability) || 0, 3, 0),
        detailStability: roundNumber(Number(probe.waterReflectionDetailStability) || 0, 3, 0),
        temporalStability: roundNumber(Number(probe.waterReflectionTemporalStability) || 0, 3, 0),
        softKnee: roundNumber(Number(probe.waterReflectionSoftKnee) || 0, 3, 0),
        time: roundNumber(Number(probe.yoonseulTime) || 0, 3, 0),
        timeDelta: roundNumber(Number(probe.yoonseulTimeDelta) || 0, 3, 0),
        waterTime: roundNumber(Number(probe.yoonseulWaterTime) || 0, 3, 0),
        intensity: roundNumber(Number(probe.yoonseulIntensity) || 0, 4, 0),
        opacity: roundNumber(Number(probe.yoonseulOpacity) || 0, 4, 0),
        drive: roundNumber(Number(probe.yoonseulDrive) || 0, 4, 0),
        focus: roundNumber(Number(probe.yoonseulFocus) || 0, 4, 0),
        materialRoughness: roundNumber(Number(probe.surfaceMaterialRoughness) || 0, 4, 0),
        phaseRate: roundNumber(Number(probe.surfacePhaseRate) || 0, 4, 0),
        patchScale: roundNumber(Number(probe.yoonseulPatchScale) || 0, 4, 0),
        motion: roundNumber(Number(probe.yoonseulMotion) || 0, 4, 0),
        flickerAmount: roundNumber(Number(probe.yoonseulFlickerAmount) || 0, 4, 0),
        temporalCoherence: roundNumber(Number(probe.yoonseulTemporalCoherence) || 0, 4, 0),
        lowBand: roundNumber(Number(probe.yoonseulLowBand) || 0, 4, 0),
        microBand: roundNumber(Number(probe.yoonseulMicroBand) || 0, 4, 0),
        glintStability: roundNumber(Number(probe.yoonseulGlintStability) || 0, 4, 0),
        beatDamping: roundNumber(Number(probe.yoonseulBeatDamping) || 0, 4, 0),
        surfaceUniformFullUpdate: probe.surfaceUniformFullUpdate === true,
    };
};

const summarizeProbeBenthic = (probe = null) => {
    if (!isObject(probe)) return null;
    const sourceSpriteCount = Math.max(
        0,
        Math.floor(Number(probe.benthicSourceSpriteCount) || 0),
    );
    return {
        ownerId: readZenPondBenthicMaterialOwnerId(
            probe.benthicOwnerId,
            {
                required: (
                    sourceSpriteCount > 0
                    || Number(probe.benthicGate) > 0
                ),
            },
        ),
        sourceSpriteCount,
        visibleSpriteCount: Math.max(
            0,
            Math.floor(Number(probe.benthicVisibleSpriteCount) || 0),
        ),
        primaryAlphaScale: roundNumber(
            Number(probe.benthicPrimaryAlphaScale) || 0,
            4,
            0,
        ),
        detailAlphaScale: roundNumber(
            Number(probe.benthicDetailAlphaScale) || 0,
            4,
            0,
        ),
        primaryAlpha: roundNumber(
            Number(probe.pebbleAlpha) || 0,
            5,
            0,
        ),
        detailAlpha: roundNumber(
            Number(probe.pebbleDetailAlpha) || 0,
            5,
            0,
        ),
    };
};

const summarizeProbeSurfaceField = (
    probe = null,
    surfaceDisturbanceTelemetry = null,
) => {
    if (!isObject(probe)) return null;
    const summarizeSourceCounts = (value) => {
        if (!isObject(value)) return null;
        const normalized = {};
        Object.values(ZEN_SURFACE_DISTURBANCE_SOURCES)
            .forEach((source) => {
                normalized[source] = Math.max(
                    0,
                    Math.floor(Number(value[source]) || 0),
                );
            });
        return normalized;
    };
    return {
        active: probe.surfaceFieldActive === true,
        ready: probe.surfaceFieldReady === true,
        rainModelId: readZenWaterSurfaceFieldRainModelId(
            probe.surfaceFieldRainModelId,
            {
                required: (
                    probe.surfaceFieldActive === true
                    || probe.surfaceFieldReady === true
                ),
            },
        ),
        causticModelId:
            readZenPondCausticPresentationModelId(
                probe.surfaceFieldCausticModelId,
                {
                    required:
                        probe.surfaceFieldCausticsRequested
                        === true,
                },
            ),
        causticsRequested:
            probe.surfaceFieldCausticsRequested === true,
        causticsEnabled:
            probe.surfaceFieldCausticsEnabled === true,
        causticsSuppressed:
            probe.surfaceFieldCausticsSuppressed === true,
        causticRequestedStrength: roundNumber(
            Number(
                probe.surfaceFieldCausticRequestedStrength,
            ) || 0,
            4,
            0,
        ),
        causticStrength: roundNumber(Number(probe.surfaceFieldCausticStrength) || 0, 4, 0),
        causticDrawCount: Math.max(
            0,
            Math.floor(
                Number(probe.surfaceFieldCausticDrawCount) || 0,
            ),
        ),
        causticFieldTextureFetchesPerPixel: Math.max(
            0,
            Math.floor(
                Number(
                    probe
                        .surfaceFieldCausticFieldTextureFetchesPerPixel,
                ) || 0,
            ),
        ),
        causticReceiverModelId:
            readZenPondCausticReceiverModelId(
                probe.surfaceFieldCausticReceiverModelId,
                {
                    required: (
                        probe.surfaceFieldCausticModelId
                            === ZEN_POND_CAUSTIC_PRESENTATION_MODEL_IDS
                                .CONNECTED_SUNWEB
                        && probe.surfaceFieldCausticsRequested
                            === true
                    ),
                },
            ),
        causticReceiverTextureFetchesPerPixel:
            Math.max(
                0,
                Math.floor(
                    Number(
                        probe
                            .surfaceFieldCausticReceiverTextureFetchesPerPixel,
                    ) || 0,
                ),
            ),
        causticTotalTextureFetchesPerPixel:
            Math.max(
                0,
                Math.floor(
                    Number(
                        probe
                            .surfaceFieldCausticTotalTextureFetchesPerPixel,
                    ) || 0,
                ),
            ),
        causticGateOff: roundNumber(
            Number(probe.surfaceFieldCausticGateOff) || 0,
            4,
            0,
        ),
        causticGateOn: roundNumber(
            Number(probe.surfaceFieldCausticGateOn) || 0,
            4,
            0,
        ),
        causticGateTransitionCount: Math.max(
            0,
            Math.floor(
                Number(
                    probe.surfaceFieldCausticGateTransitionCount,
                ) || 0,
            ),
        ),
        width: Math.max(0, Math.floor(Number(probe.surfaceFieldWidth) || 0)),
        height: Math.max(0, Math.floor(Number(probe.surfaceFieldHeight) || 0)),
        cadenceTier: typeof probe.surfaceFieldCadenceTier === 'string'
            ? probe.surfaceFieldCadenceTier
            : '',
        disturbanceCount: Math.max(
            0,
            Math.floor(Number(probe.surfaceFieldDisturbanceCount) || 0),
        ),
        disturbanceCandidateCount: Math.max(
            0,
            Math.floor(Number(probe.surfaceFieldDisturbanceCandidateCount) || 0),
        ),
        disturbanceDroppedCount: Math.max(
            0,
            Math.floor(Number(probe.surfaceFieldDisturbanceDroppedCount) || 0),
        ),
        sourceRequested: isObject(
            surfaceDisturbanceTelemetry?.requested,
        )
            ? {
                koiWake:
                    surfaceDisturbanceTelemetry
                        .requested.koi_wake === true,
                tap:
                    surfaceDisturbanceTelemetry
                        .requested.tap === true,
                petal:
                    surfaceDisturbanceTelemetry
                        .requested.petal === true,
            }
            : null,
        disturbanceSourceCounts: isObject(
            probe.surfaceFieldDisturbanceSourceCounts,
        )
            ? {
                candidate: summarizeSourceCounts(
                    probe.surfaceFieldDisturbanceSourceCounts
                        .candidate,
                ),
                selected: summarizeSourceCounts(
                    probe.surfaceFieldDisturbanceSourceCounts
                        .selected,
                ),
                dropped: summarizeSourceCounts(
                    probe.surfaceFieldDisturbanceSourceCounts
                        .dropped,
                ),
            }
            : null,
        rainIntensity: roundNumber(Number(probe.surfaceFieldRainIntensity) || 0, 4, 0),
        rainVisibilityDrive: roundNumber(
            Number(probe.surfaceFieldRainVisibilityDrive) || 0,
            4,
            0,
        ),
        rainRippleTargetBudget: Math.max(
            0,
            Math.floor(Number(probe.surfaceFieldRainRippleTargetBudget) || 0),
        ),
        rainRippleCellCount: Math.max(
            0,
            Math.floor(Number(probe.surfaceFieldRainRippleCellCount) || 0),
        ),
        rainCandidateEvaluationsPerPixel: Math.max(
            0,
            Math.floor(Number(probe.surfaceFieldRainCandidateEvaluationsPerPixel) || 0),
        ),
        submitMs: roundNumber(Number(probe.surfaceFieldSubmitMs) || 0, 3, 0),
    };
};

const summarizeProbeWeather = (probe = null) => {
    if (!isObject(probe)) return null;
    return {
        regime: typeof probe.weatherRegime === 'string' ? probe.weatherRegime : '',
        eventScheduled: probe.weatherEventScheduled === true,
        eventActive: probe.weatherEventActive === true,
        eventId: typeof probe.weatherEventId === 'string' ? probe.weatherEventId : '',
        eventKind: typeof probe.weatherEventKind === 'string' ? probe.weatherEventKind : '',
        eventPhase: typeof probe.weatherEventPhase === 'string' ? probe.weatherEventPhase : '',
        eventProgress: roundNumber(Number(probe.weatherEventProgress) || 0, 4, 0),
        eventPhaseProgress: roundNumber(
            Number(probe.weatherEventPhaseProgress) || 0,
            4,
            0,
        ),
        frontWeight: roundNumber(Number(probe.weatherFrontWeight) || 0, 4, 0),
        postRainWeight: roundNumber(Number(probe.postRainWeight) || 0, 4, 0),
        guaranteedRainDay: probe.guaranteedRainDay === true,
    };
};

const pickRuntimeHealthSyncCounters = (metrics = null) => {
    const counters = {};
    RUNTIME_HEALTH_SYNC_COUNTER_KEYS.forEach((key) => {
        counters[key] = Math.max(0, Math.floor(Number(metrics?.[key]) || 0));
    });
    return counters;
};

const diffRuntimeHealthSyncCounters = (after = null, before = null) => {
    const beforeCounters = pickRuntimeHealthSyncCounters(before);
    const afterCounters = pickRuntimeHealthSyncCounters(after);
    const delta = {};
    RUNTIME_HEALTH_SYNC_COUNTER_KEYS.forEach((key) => {
        delta[key] = Math.max(0, afterCounters[key] - beforeCounters[key]);
    });
    return {
        before: beforeCounters,
        after: afterCounters,
        delta,
    };
};

const buildRuntimeHealthWarnings = ({
    syncCounters,
    initOrder = null,
} = {}) => {
    const warnings = [];
    const delta = syncCounters?.delta || {};
    if (Number(delta.runtimeParamSyncCount) > 0) warnings.push('runtime_params_resynced');
    if (Number(delta.ambientPopulationSyncCount) > 0) warnings.push('ambient_population_resynced');
    if (Number(delta.fishRosterSyncCount) > 0) warnings.push('fish_roster_resynced');
    if (Number(delta.sceneSessionSyncCount) > 0) warnings.push('scene_session_resynced');
    if (Number(delta.staticSceneSyncCount) > 0) warnings.push('static_scene_resynced');
    if (isObject(initOrder) && initOrder.firstFrameAcked === true && initOrder.ok !== true) {
        warnings.push('init_order_incomplete');
    }
    return warnings;
};

const summarizeKoiRenderDiagnostics = (value = null) => {
    if (!isObject(value)) return null;
    const lighting = readZenPondShadowLightingMetrics(value.shadowLighting);
    return {
        fishCount: Math.max(0, Math.floor(Number(value.fishCount) || 0)),
        firstSiteRevealCount: value.firstSiteRevealCount,
        firstSiteMaterialPresence: value.firstSiteMaterialPresence,
        invitationEnteringCount: value.invitationEnteringCount,
        shadowSentinelCount: value.shadowSentinelCount,
        focusHoveredCount: value.focusHoveredCount,
        focusSelectedCount: value.focusSelectedCount,
        focusGlowVisibleCount: value.focusGlowVisibleCount,
        visibleFishCount: Math.max(0, Math.floor(Number(value.visibleFishCount) || 0)),
        createdFishCount: Math.max(0, Math.floor(Number(value.createdFishCount) || 0)),
        materialSignatureUpdates: Math.max(0, Math.floor(Number(value.materialSignatureUpdates) || 0)),
        materialWrites: Math.max(0, Math.floor(Number(value.materialWrites) || 0)),
        materialSkipCount: Math.max(0, Math.floor(Number(value.materialSkipCount) || 0)),
        fishShadowRequested:
            value.fishShadowRequested === true,
        shadowRequestedCount: Math.max(
            0,
            Math.floor(
                Number(value.shadowRequestedCount) || 0,
            ),
        ),
        shadowEnabledCount: Math.max(0, Math.floor(Number(value.shadowEnabledCount) || 0)),
        shadowTextureAllocatedCount: Math.max(
            0,
            Math.floor(
                Number(
                    value.shadowTextureAllocatedCount,
                ) || 0,
            ),
        ),
        shadowGeometryUpdateCount: Math.max(
            0,
            Math.floor(
                Number(
                    value.shadowGeometryUpdateCount,
                ) || 0,
            ),
        ),
        shadowPointWriteCount: Math.max(
            0,
            Math.floor(
                Number(value.shadowPointWriteCount) || 0,
            ),
        ),
        shadowCacheEntryCount: Math.max(
            0,
            Math.floor(
                Number(value.shadowCacheEntryCount) || 0,
            ),
        ),
        shadowCacheReferencedEntryCount: Math.max(
            0,
            Math.floor(
                Number(
                    value.shadowCacheReferencedEntryCount,
                ) || 0,
            ),
        ),
        shadowCacheReferenceCount: Math.max(
            0,
            Math.floor(
                Number(
                    value.shadowCacheReferenceCount,
                ) || 0,
            ),
        ),
        shadowAlphaWrites: Math.max(0, Math.floor(Number(value.shadowAlphaWrites) || 0)),
        shadowAlphaAvg: roundNumber(Number(value.shadowAlphaAvg) || 0, 5, 0),
        shadowAlphaMin: roundNumber(Number(value.shadowAlphaMin) || 0, 5, 0),
        shadowAlphaMax: roundNumber(Number(value.shadowAlphaMax) || 0, 5, 0),
        shadowLighting: lighting,
    };
};

export const summarizeZenPondRuntimeHealthCapture = ({
    before = null,
    after = null,
    durationMs = 0,
} = {}) => {
    if (!isObject(before) || !isObject(after)) {
        throw new Error('ZEN_POND_RUNTIME_HEALTH_CAPTURE_METRICS_REQUIRED');
    }
    const syncCounters = diffRuntimeHealthSyncCounters(after, before);
    const initOrder = isObject(after.runtimeHealth?.initOrder)
        ? { ...after.runtimeHealth.initOrder }
        : null;
    const warnings = buildRuntimeHealthWarnings({
        syncCounters,
        initOrder,
    });
    return {
        durationMs: Math.max(0, Math.floor(Number(durationMs) || 0)),
        frames: Math.max(
            0,
            Math.floor(Number(after.sampleFrames) || 0) - Math.floor(Number(before.sampleFrames) || 0),
        ),
        syncCounters,
        initOrder,
        warnings,
        ok: warnings.length === 0,
        latestEvents: Array.isArray(after.runtimeHealth?.events)
            ? after.runtimeHealth.events.slice(-16)
            : [],
    };
};

export const summarizeZenPondWaterEffectsDebugMetrics = (
    metrics = null,
    previousMetrics = null,
) => {
    if (!isObject(metrics)) return null;
    const mainMetrics = isObject(metrics.mainMetrics) ? metrics.mainMetrics : null;
    const probe = isObject(mainMetrics?.waterEffects) ? mainMetrics.waterEffects : null;
    const koiRender = summarizeKoiRenderDiagnostics(mainMetrics?.koiRender);
    const sampleFrames = Math.max(0, Math.floor(Number(metrics.sampleFrames) || 0));
    const avgDtMs = Number(metrics.avgDtMs) || 0;
    const totalDtMs = Number(metrics.totalDtMs) || 0;
    const previousFrames = Math.max(0, Math.floor(Number(previousMetrics?.sampleFrames) || 0));
    const previousTotalDtMs = Number(previousMetrics?.totalDtMs) || 0;
    const frameDelta = Math.max(0, sampleFrames - previousFrames);
    const totalDtDelta = Math.max(0, totalDtMs - previousTotalDtMs);
    const sampleAvgDtMs = frameDelta > 0 && totalDtDelta > 0
        ? totalDtDelta / frameDelta
        : 0;
    return {
        sampleFrames,
        avgDtMs: roundNumber(avgDtMs, 2, 0),
        fps: avgDtMs > 0 ? roundNumber(1000 / avgDtMs, 1, 0) : 0,
        maxDtMs: roundNumber(Number(metrics.maxDtMs) || 0, 2, 0),
        sample: previousMetrics
            ? {
                frames: frameDelta,
                avgDtMs: roundNumber(sampleAvgDtMs, 2, 0),
                fps: sampleAvgDtMs > 0 ? roundNumber(1000 / sampleAvgDtMs, 1, 0) : 0,
                over24: Math.max(0, Math.floor(Number(metrics.over24) || 0) - Math.floor(Number(previousMetrics.over24) || 0)),
                over32: Math.max(0, Math.floor(Number(metrics.over32) || 0) - Math.floor(Number(previousMetrics.over32) || 0)),
                over50: Math.max(0, Math.floor(Number(metrics.over50) || 0) - Math.floor(Number(previousMetrics.over50) || 0)),
                over100: Math.max(0, Math.floor(Number(metrics.over100) || 0) - Math.floor(Number(previousMetrics.over100) || 0)),
            }
            : null,
        lastFrame: mainMetrics
            ? {
                updateMs: roundNumber(Number(mainMetrics.updateMs) || 0, 3, 0),
                renderMs: roundNumber(Number(mainMetrics.renderMs) || 0, 3, 0),
                frameMs: roundNumber(Number(mainMetrics.frameMs) || 0, 3, 0),
                gpuTiming: isObject(mainMetrics.gpuTiming)
                    ? { ...mainMetrics.gpuTiming }
                    : null,
                backgroundFxTickMs: roundNumber(Number(probe?.backgroundFxTickMs) || 0, 3, 0),
                waterEffectsTickMs: roundNumber(Number(probe?.waterEffectsTickMs) || 0, 3, 0),
                waterSurfaceFilterTickMs: roundNumber(Number(probe?.waterSurfaceFilterTickMs) || 0, 3, 0),
                surfacePipelineMode: typeof probe?.surfacePipelineMode === 'string'
                    ? probe.surfacePipelineMode
                    : '',
                waterReflectionAlgorithmMode: roundNumber(Number(probe?.waterReflectionAlgorithmMode) || 0, 3, 0),
                waterReflectionStability: roundNumber(Number(probe?.waterReflectionStability) || 0, 3, 0),
                waterReflectionSpatialStability: roundNumber(Number(probe?.waterReflectionSpatialStability) || 0, 3, 0),
                waterReflectionDetailStability: roundNumber(Number(probe?.waterReflectionDetailStability) || 0, 3, 0),
                waterReflectionTemporalStability: roundNumber(Number(probe?.waterReflectionTemporalStability) || 0, 3, 0),
                waterReflectionSoftKnee: roundNumber(Number(probe?.waterReflectionSoftKnee) || 0, 3, 0),
                yoonseulTime: roundNumber(Number(probe?.yoonseulTime) || 0, 3, 0),
                yoonseulTimeDelta: roundNumber(Number(probe?.yoonseulTimeDelta) || 0, 3, 0),
                yoonseulDrive: roundNumber(Number(probe?.yoonseulDrive) || 0, 4, 0),
                yoonseulFocus: roundNumber(Number(probe?.yoonseulFocus) || 0, 4, 0),
                surfaceMaterialRoughness: roundNumber(
                    Number(probe?.surfaceMaterialRoughness) || 0,
                    4,
                    0,
                ),
                surfacePhaseRate: roundNumber(Number(probe?.surfacePhaseRate) || 0, 4, 0),
                surfaceUniformFullUpdate: probe?.surfaceUniformFullUpdate === true,
            }
            : null,
        koiRender,
        weather: summarizeProbeWeather(probe),
        yoonseul: summarizeProbeYoonseul(probe),
        benthic: summarizeProbeBenthic(probe),
        komorebi: summarizeProbeKomorebi(probe),
        skyReflection: summarizeProbeSkyReflection(probe),
        surfaceField: summarizeProbeSurfaceField(
            probe,
            metrics.surfaceDisturbanceTelemetry,
        ),
        surfaceDisturbanceTelemetry: isObject(
            metrics.surfaceDisturbanceTelemetry,
        )
            ? {
                ...metrics.surfaceDisturbanceTelemetry,
                bySource: {
                    ...(metrics.surfaceDisturbanceTelemetry
                        .bySource || {}),
                },
            }
            : null,
        gates: summarizeProbeGates(probe),
        alphas: summarizeProbeAlphas(probe),
        reason: typeof probe?.reason === 'string' ? probe.reason : '',
        probe,
        runtimeHealth: isObject(metrics.runtimeHealth) ? metrics.runtimeHealth : null,
    };
};

const summarizeYoonseulTimelineSample = (
    metrics = null,
    previousMetrics = null,
    elapsedMs = 0,
) => {
    const summary = summarizeZenPondWaterEffectsDebugMetrics(metrics, previousMetrics);
    if (!summary) return null;
    return {
        elapsedMs: Math.max(0, Math.floor(Number(elapsedMs) || 0)),
        sampleFrames: summary.sampleFrames,
        frameDelta: Math.max(0, Math.floor(Number(summary.sample?.frames) || 0)),
        fps: Number(summary.sample?.fps) || Number(summary.fps) || 0,
        reason: summary.reason,
        lastFrame: summary.lastFrame,
        yoonseul: summary.yoonseul,
    };
};

export const createZenPondWaterEffectsDebugControls = ({
    debugGlobal = null,
    syncRuntimeParams,
    readMetrics,
    readProbe,
    injectSurfaceDisturbanceFixtures,
    isDisposed,
} = {}) => {
    const ensureActive = () => {
        if (typeof isDisposed === 'function' && isDisposed()) {
            throw new Error('ZEN_POND_WATER_EFFECT_DEBUG_CONTROLLER_DISPOSED');
        }
    };

    const commit = (nextToggles, action = 'set') => {
        ensureActive();
        const normalized = normalizeZenRendererDebugToggles(nextToggles);
        if (debugGlobal) {
            debugGlobal[ZEN_RENDERER_DEBUG_TOGGLES_GLOBAL_KEY] = { ...normalized };
        }
        const sent = typeof syncRuntimeParams === 'function'
            ? syncRuntimeParams({ force: true })
            : false;
        return {
            action,
            sent: sent === true,
            toggles: { ...normalized },
        };
    };

    const snapshot = () => ({
        toggles: readNormalizedGlobalToggles(debugGlobal),
        raw: {
            ...(readRawGlobalToggles(debugGlobal) || {}),
        },
        keys: WATER_EFFECT_DEBUG_TOGGLE_KEYS.slice(),
        profileKeys: WATER_EFFECT_DEBUG_PROFILE_KEYS.slice(),
        costTiers: {
            low: ZEN_RENDERER_WATER_EFFECT_COST_TIERS.low.slice(),
            moderate: ZEN_RENDERER_WATER_EFFECT_COST_TIERS.moderate.slice(),
            high: ZEN_RENDERER_WATER_EFFECT_COST_TIERS.high.slice(),
            source: ZEN_RENDERER_WATER_EFFECT_COST_TIERS.source.slice(),
        },
    });

    const set = (patch = {}) => commit(
        applyZenPondWaterEffectDebugPatch(readNormalizedGlobalToggles(debugGlobal), patch),
        'set',
    );

    const enable = (keys) => {
        const patch = {};
        const resolvedKeys = resolveToggleKeyList(keys);
        for (let i = 0; i < resolvedKeys.length; i += 1) {
            patch[resolvedKeys[i]] = true;
        }
        return set(patch);
    };

    const disable = (keys) => {
        const patch = {};
        const resolvedKeys = resolveToggleKeyList(keys);
        for (let i = 0; i < resolvedKeys.length; i += 1) {
            patch[resolvedKeys[i]] = false;
        }
        return set(patch);
    };

    const only = (keys) => commit(buildZenPondWaterEffectOnlyDebugToggles(keys), 'only');

    const allOff = () => commit(buildDefaultToggleState(), 'allOff');

    const preset = (presetName = 'full') => commit(
        resolveZenRendererDebugTogglePreset(presetName, 'full'),
        'preset',
    );

    const allOn = () => commit(resolveZenRendererDebugTogglePreset('on'), 'allOn');

    const metrics = async () => (
        typeof readMetrics === 'function' ? readMetrics() : null
    );

    const requireMetricsSnapshot = (snapshot = null, phase = 'unknown') => {
        if (!isObject(snapshot)) {
            throw new Error(`ZEN_POND_RUNTIME_HEALTH_METRICS_UNAVAILABLE:${phase}`);
        }
        if (typeof snapshot.error === 'string' && snapshot.error.trim()) {
            throw new Error(`ZEN_POND_RUNTIME_HEALTH_METRICS_ERROR:${phase}:${snapshot.error}`);
        }
        return snapshot;
    };

    const sample = async (durationMs = 1200) => {
        ensureActive();
        const safeDurationMs = clampDurationMs(durationMs);
        const before = await metrics();
        await wait(safeDurationMs);
        const after = await metrics();
        return {
            durationMs: safeDurationMs,
            toggles: snapshot().toggles,
            summary: summarizeZenPondWaterEffectsDebugMetrics(after, before),
            metrics: after,
        };
    };

    const captureRuntimeHealth = async (durationMs = 10000) => {
        ensureActive();
        const safeDurationMs = clampDurationMs(durationMs, 10000);
        const before = requireMetricsSnapshot(await metrics(), 'before');
        await wait(safeDurationMs);
        const after = requireMetricsSnapshot(await metrics(), 'after');
        return {
            durationMs: safeDurationMs,
            summary: summarizeZenPondRuntimeHealthCapture({
                before,
                after,
                durationMs: safeDurationMs,
            }),
            before,
            after,
        };
    };

    const captureRenderDiagnostics = async (durationMs = 1800) => {
        ensureActive();
        const safeDurationMs = clampDurationMs(durationMs, 1800);
        const before = requireMetricsSnapshot(await metrics(), 'render_before');
        await wait(safeDurationMs);
        const after = requireMetricsSnapshot(await metrics(), 'render_after');
        const summary = summarizeZenPondWaterEffectsDebugMetrics(after, before);
        return {
            kind: 'zen_pond_render_diagnostics_v1',
            capturedAt: new Date().toISOString(),
            durationMs: safeDurationMs,
            toggles: snapshot().toggles,
            summary,
            beforeMetrics: before,
            metrics: after,
        };
    };

    const captureYoonseulTimeline = async (
        durationMs = 5000,
        intervalMs = 250,
    ) => {
        ensureActive();
        const safeDurationMs = clampDurationMs(durationMs, 5000);
        const safeIntervalMs = clampTimelineIntervalMs(intervalMs);
        const before = requireMetricsSnapshot(await metrics(), 'yoonseul_timeline_start');
        const samples = [
            summarizeYoonseulTimelineSample(before, null, 0),
        ].filter(Boolean);
        let previous = before;
        let elapsedMs = 0;
        while (elapsedMs < safeDurationMs) {
            const waitMs = Math.min(safeIntervalMs, safeDurationMs - elapsedMs);
            await wait(waitMs);
            elapsedMs += waitMs;
            const next = requireMetricsSnapshot(await metrics(), 'yoonseul_timeline_sample');
            const sample = summarizeYoonseulTimelineSample(next, previous, elapsedMs);
            if (sample) samples.push(sample);
            previous = next;
        }
        const after = previous;
        return {
            kind: 'zen_pond_yoonseul_timeline_v1',
            capturedAt: new Date().toISOString(),
            durationMs: safeDurationMs,
            intervalMs: safeIntervalMs,
            toggles: snapshot().toggles,
            summary: summarizeZenPondWaterEffectsDebugMetrics(after, before),
            samples,
            metrics: after,
        };
    };

    const injectDisturbanceFixtures = async ({
        fixtureId,
        fixtures,
    } = {}) => {
        ensureActive();
        if (
            typeof injectSurfaceDisturbanceFixtures
            !== 'function'
        ) {
            throw new Error(
                'ZEN_POND_DEBUG_DISTURBANCE_INJECTOR_UNAVAILABLE',
            );
        }
        return injectSurfaceDisturbanceFixtures({
            fixtureId,
            fixtures,
        });
    };

    const profile = async (
        keys = WATER_EFFECT_DEBUG_PROFILE_KEYS,
        durationMs = 1200,
    ) => {
        ensureActive();
        const original = snapshot().toggles;
        const safeKeys = Array.isArray(keys) && keys.length > 0
            ? keys
            : WATER_EFFECT_DEBUG_PROFILE_KEYS;
        const results = [];
        try {
            for (let i = 0; i < safeKeys.length; i += 1) {
                const key = safeKeys[i];
                only(key);
                const result = await sample(durationMs);
                const sampleSummary = result.summary?.sample || null;
                results.push({
                    effect: key,
                    fps: Number(sampleSummary?.fps) || 0,
                    avgDtMs: Number(sampleSummary?.avgDtMs) || 0,
                    frames: Number(sampleSummary?.frames) || 0,
                    frameMs: Number(result.summary?.lastFrame?.frameMs) || 0,
                    updateMs: Number(result.summary?.lastFrame?.updateMs) || 0,
                    renderMs: Number(result.summary?.lastFrame?.renderMs) || 0,
                    backgroundFxTickMs: Number(result.summary?.lastFrame?.backgroundFxTickMs) || 0,
                    waterEffectsTickMs: Number(result.summary?.lastFrame?.waterEffectsTickMs) || 0,
                    waterSurfaceFilterTickMs: Number(result.summary?.lastFrame?.waterSurfaceFilterTickMs) || 0,
                    reason: result.summary?.reason || '',
                });
            }
        } finally {
            commit(original, 'restore');
        }
        if (typeof console !== 'undefined' && typeof console.table === 'function') {
            console.table(results);
        }
        return results;
    };

    const print = async () => {
        const result = await metrics();
        const summary = summarizeZenPondWaterEffectsDebugMetrics(result);
        if (typeof console !== 'undefined' && typeof console.log === 'function') {
            console.log('[ZenPond][waterEffectsDebug]', {
                toggles: snapshot().toggles,
                summary,
            });
        }
        return summary;
    };

    const help = () => ({
        examples: [
            '__ZEN_POND_WATER_EFFECTS_DEBUG.allOff()',
            '__ZEN_POND_WATER_EFFECTS_DEBUG.preset("balanced")',
            '__ZEN_POND_WATER_EFFECTS_DEBUG.only("benthic")',
            '__ZEN_POND_WATER_EFFECTS_DEBUG.enable(["caustics", "godRays"])',
            'await __ZEN_POND_WATER_EFFECTS_DEBUG.sample(1500)',
            'await __ZEN_POND_WATER_EFFECTS_DEBUG.captureRenderDiagnostics(1800)',
            'await __ZEN_POND_WATER_EFFECTS_DEBUG.captureYoonseulTimeline(5000, 250)',
            'await __ZEN_POND_WATER_EFFECTS_DEBUG.captureRuntimeHealth(10000)',
            'await __ZEN_POND_WATER_EFFECTS_DEBUG.injectDisturbanceFixtures({ fixtureId: "audit", fixtures: [...] })',
            'await __ZEN_POND_WATER_EFFECTS_DEBUG.profile(["benthic", "caustics", "godRays"], 1200)',
        ],
        keys: WATER_EFFECT_DEBUG_TOGGLE_KEYS.slice(),
        profileKeys: WATER_EFFECT_DEBUG_PROFILE_KEYS.slice(),
        costTiers: snapshot().costTiers,
    });

    return Object.freeze({
        keys: WATER_EFFECT_DEBUG_TOGGLE_KEYS.slice(),
        profileKeys: WATER_EFFECT_DEBUG_PROFILE_KEYS.slice(),
        snapshot,
        set,
        enable,
        disable,
        only,
        preset,
        allOff,
        allOn,
        metrics,
        sample,
        captureRenderDiagnostics,
        captureYoonseulTimeline,
        captureRuntimeHealth,
        injectDisturbanceFixtures,
        profile,
        readProbe,
        print,
        help,
    });
};

export const bindZenPondWaterEffectsDebugControls = ({
    debugGlobal = null,
    mountId = '',
    syncRuntimeParams,
    readMetrics,
    readProbe,
    injectSurfaceDisturbanceFixtures,
    isDisposed,
} = {}) => {
    if (!debugGlobal) return null;
    const controls = createZenPondWaterEffectsDebugControls({
        debugGlobal,
        syncRuntimeParams,
        readMetrics,
        readProbe,
        injectSurfaceDisturbanceFixtures,
        isDisposed,
    });
    debugGlobal[ZEN_POND_WATER_EFFECTS_DEBUG_OWNER_KEY] = mountId;
    debugGlobal[ZEN_POND_WATER_EFFECTS_DEBUG_GLOBAL_KEY] = controls;
    return controls;
};

export const unbindZenPondWaterEffectsDebugControls = ({
    debugGlobal = null,
    mountId = '',
} = {}) => {
    if (!debugGlobal) return;
    if (debugGlobal[ZEN_POND_WATER_EFFECTS_DEBUG_OWNER_KEY] !== mountId) return;
    debugGlobal[ZEN_POND_WATER_EFFECTS_DEBUG_OWNER_KEY] = null;
    debugGlobal[ZEN_POND_WATER_EFFECTS_DEBUG_GLOBAL_KEY] = null;
};
