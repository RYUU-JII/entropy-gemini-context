import { DEFAULT_KOI_TUNING } from '../../../model/koi/constants.js';
import {
    buildZenPondOptimizationSnapshot,
    resolveZenPondOptimizationProfile,
} from '../../../runtime/core/zenPondOptimizationMaster.js';
import { normalizeZenRendererDebugToggles } from '../../../contracts/zenRendererDebugToggles.js';
import {
    isZenWaterSurfaceFieldAlgorithm,
} from '../../../contracts/zenWaterReflectionAlgorithms.js';
import { normalizeRuntimeEnvAuthority } from './zenPondWorkerEnvironment.js';
import {
    ensureEnvironmentRuntime,
    normalizeRuntimeEnv,
    resolveZenPondWorkerEnvironmentTarget,
    setZenPondEnvironmentPresentationTarget,
    updateZenPondEnvironmentPresentation,
} from './zenPondWorkerEnvironmentPresentation.js';
import {
    ZEN_WORLD_ENVIRONMENT_CLOCK_MODES,
} from '../../../../runtime/environment/zenWorldEnvironmentAuthority.js';
import { resolveWorkerRuntimeFrameState } from './zenPondWorkerFrameSnapshot.js';
import {
    DEFAULT_WATER_PALETTE,
    ZEN_QUALITY_MODE_FULL,
} from './zenPondWorkerPolicy.js';
import {
    buildZenPondVisualProfileSignature,
    requireZenPondVisualProfile,
} from '../../../contracts/zenPondVisualProfile.js';
import {
    normalizeZenPondCanopyPreparationResearch,
} from '../../../contracts/zenPondCanopyPreparationResearch.js';

const CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : false
);

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const clamp = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const normalizeJsonValue = (value, depth = 0) => {
    if (depth > 6) return null;
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) {
        const next = [];
        for (let i = 0; i < value.length; i += 1) {
            const child = normalizeJsonValue(value[i], depth + 1);
            if (child !== null) next.push(child);
        }
        return next;
    }
    if (isObject(value)) {
        const next = {};
        const keys = Object.keys(value);
        for (let i = 0; i < keys.length; i += 1) {
            const key = keys[i];
            const child = normalizeJsonValue(value[key], depth + 1);
            if (child !== null) {
                next[key] = child;
            }
        }
        return next;
    }
    const valueType = typeof value;
    if (valueType === 'string') return value;
    if (valueType === 'boolean') return value;
    if (valueType === 'number') return Number.isFinite(value) ? value : null;
    return null;
};

const normalizeRuntimePalette = (palette = null) => {
    const gradientStops = Array.isArray(palette?.gradientStops)
        ? palette.gradientStops
            .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
            .filter(Boolean)
            .slice(0, 3)
        : [];
    return {
        gradientStops: gradientStops.length ? gradientStops : [...DEFAULT_WATER_PALETTE.gradientStops],
        depthStrengthBias: clamp(Number(palette?.depthStrengthBias ?? DEFAULT_WATER_PALETTE.depthStrengthBias), -0.8, 0.8),
        contourDensityBias: clamp(Number(palette?.contourDensityBias ?? DEFAULT_WATER_PALETTE.contourDensityBias), -0.8, 0.8),
        sedimentAmountBias: clamp(Number(palette?.sedimentAmountBias ?? DEFAULT_WATER_PALETTE.sedimentAmountBias), -0.8, 0.8),
        mineralStrength: clamp(Number(palette?.mineralStrength ?? DEFAULT_WATER_PALETTE.mineralStrength), 0, 0.65),
    };
};

const normalizeRuntimeToggles = (toggles = null) => (
    normalizeZenRendererDebugToggles(toggles)
);

const normalizeRuntimeTelemetry = (
    telemetry = null,
    fallback = null,
) => {
    const source = isObject(telemetry)
        ? telemetry
        : (isObject(fallback) ? fallback : {});
    const sampleIntervalMs = Number(source.sampleIntervalMs);
    const canopyPreparation = CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED
        ? normalizeZenPondCanopyPreparationResearch(source.canopyPreparation)
        : undefined;
    if (canopyPreparation !== undefined && source.enabled !== true) {
        throw new Error('ZEN_POND_CANOPY_PREPARATION_RESEARCH_TELEMETRY_REQUIRED');
    }
    return {
        enabled: source.enabled === true,
        sampleIntervalMs: Number.isFinite(sampleIntervalMs)
            ? Math.round(clamp(sampleIntervalMs, 500, 10_000))
            : 2_000,
        ...(canopyPreparation === undefined ? {} : { canopyPreparation }),
    };
};

const mergeTuning = (baseTuning = null, patchTuning = null, fallbackTuning = null) => {
    const base = isObject(baseTuning)
        ? baseTuning
        : (isObject(fallbackTuning) ? fallbackTuning : {});
    const patch = isObject(patchTuning) ? patchTuning : {};
    const basePhysics = isObject(base.physics) ? base.physics : {};
    const patchPhysics = isObject(patch.physics) ? patch.physics : {};
    return {
        ...base,
        ...patch,
        physics: {
            ...basePhysics,
            ...patchPhysics,
        },
    };
};

const applyRuntimeEnvironmentSnapshot = ({
    state,
    envAuthority,
    env,
} = {}) => {
    // Both authority and numeric presentation have been validated at target
    // admission. Do not repeat schema projection on the interpolation cadence.
    state.runtimeParams.envAuthority = envAuthority;
    state.runtimeParams.env = env;
    state.refs.envStateRef.current = state.runtimeParams.env;
    state.refs.frameStateRef.current = resolveWorkerRuntimeFrameState({
        tuning: state.runtimeParams.tuning,
        envState: state.runtimeParams.env,
        qualityProfile: state.qualityProfile,
        effectIntensityScale: state.runtimeParams.effectIntensityScale,
        envAuthority: state.runtimeParams.envAuthority,
    });
};

const resolveRuntimeQualityProfile = (modules, runtimeParams = null) => {
    const qualityMode = modules.resolveQualityMode(runtimeParams?.qualityMode || ZEN_QUALITY_MODE_FULL);
    const baseProfile = modules.QUALITY_PROFILES[qualityMode] || modules.DEFAULT_QUALITY_PROFILE;
    const nextProfile = {
        ...baseProfile,
    };

    const targetFps = Number(runtimeParams?.targetFps);
    if (Number.isFinite(targetFps)) {
        nextProfile.targetFps = Math.floor(clamp(targetFps, 12, 120));
    }

    const effectIntensityScale = Number(runtimeParams?.effectIntensityScale);
    if (Number.isFinite(effectIntensityScale)) {
        nextProfile.effectIntensityScale = clamp(effectIntensityScale, 0.2, 2.4);
    }
    nextProfile.telemetry = normalizeRuntimeTelemetry(
        runtimeParams?.telemetry,
    );

    return {
        qualityMode,
        qualityProfile: nextProfile,
    };
};

const signatureNumber = (value, digits = 3) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)) : 'na';
};

const buildQualitySignature = (qualityMode, qualityProfile = null) => {
    const profile = isObject(qualityProfile) ? qualityProfile : {};
    return [
        qualityMode || 'unknown',
        signatureNumber(profile.simHz, 0),
        signatureNumber(profile.targetFps, 0),
        signatureNumber(profile.maxCatchUpSteps, 0),
        typeof profile.cadenceTier === 'string' ? profile.cadenceTier : '',
        profile.telemetry?.enabled === true ? 'telemetry' : 'quiet',
        signatureNumber(profile.telemetry?.sampleIntervalMs, 0),
        ...(CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED && profile.telemetry?.canopyPreparation !== undefined
            ? [profile.telemetry.canopyPreparation]
            : []),
    ].join('|');
};

const buildWaterLayerApplySignature = ({
    optimization = null,
    tuning = null,
} = {}) => {
    const layerAssetSignature = typeof optimization?.water?.layerAssetSignature === 'string'
        ? optimization.water.layerAssetSignature
        : '';
    const algorithmInput = typeof tuning?.waterReflectionAlgorithm === 'string'
        ? tuning.waterReflectionAlgorithm.trim()
        : '';
    if (!algorithmInput) {
        return `${layerAssetSignature}|surface_field:uninitialized`;
    }
    const canonicalSurfaceField = isZenWaterSurfaceFieldAlgorithm(algorithmInput);
    return `${layerAssetSignature}|surface_field:${canonicalSurfaceField ? 1 : 0}`;
};

export const applyRuntimeParamsForWorkerState = ({
    modules,
    state,
    runtimeParamsInput = null,
    remountEngine,
    syncAmbientEntitiesForState,
} = {}) => {
    const incoming = isObject(runtimeParamsInput) ? runtimeParamsInput : {};
    const nextVisualProfile = requireZenPondVisualProfile(
        Object.prototype.hasOwnProperty.call(incoming, 'visualProfile')
            ? incoming.visualProfile
            : state.runtimeParams.visualProfile,
    );
    const previousWaterLayerApplySignature = buildWaterLayerApplySignature({
        optimization: state.runtimeParams?.optimization,
        tuning: state.runtimeParams?.tuning,
    });
    const nextTuning = mergeTuning(
        state.runtimeParams.tuning,
        normalizeJsonValue(incoming.tuning),
        modules.DEFAULT_KOI_TUNING || DEFAULT_KOI_TUNING,
    );
    const nextEnvAuthority = normalizeRuntimeEnvAuthority(
        isObject(incoming.envAuthority)
            ? incoming.envAuthority
            : state.runtimeParams.envAuthority,
    );
    const nextEnvironmentTarget = resolveZenPondWorkerEnvironmentTarget({
        tuning: nextTuning,
        envAuthority: nextEnvAuthority,
    });
    const envRuntime = ensureEnvironmentRuntime(state);
    const presentationSeed = setZenPondEnvironmentPresentationTarget({
        envRuntime,
        previousEnvAuthority: state.runtimeParams.envAuthority,
        nextTarget: nextEnvironmentTarget,
        firstFrameAckEmitted: state.firstFrameAckEmitted === true,
    });
    const nextRuntimeParamsBase = {
        ...state.runtimeParams,
        qualityMode: modules.resolveQualityMode(incoming.qualityMode || state.runtimeParams.qualityMode || ZEN_QUALITY_MODE_FULL),
        targetFps: Number.isFinite(Number(incoming.targetFps))
            ? Math.floor(clamp(Number(incoming.targetFps), 12, 120))
            : state.runtimeParams.targetFps,
        waterEffectsEnabled: incoming.waterEffectsEnabled === false
            ? false
            : (incoming.waterEffectsEnabled === true ? true : state.runtimeParams.waterEffectsEnabled),
        effectIntensityScale: Number.isFinite(Number(incoming.effectIntensityScale))
            ? clamp(Number(incoming.effectIntensityScale), 0.2, 2.4)
            : state.runtimeParams.effectIntensityScale,
        telemetry: normalizeRuntimeTelemetry(
            incoming.telemetry,
            state.runtimeParams.telemetry,
        ),
        envAuthority: nextEnvironmentTarget.envAuthority,
        env: normalizeRuntimeEnv(presentationSeed.currentEnv || nextEnvironmentTarget.env),
        waterPalette: normalizeRuntimePalette({
            ...state.runtimeParams.waterPalette,
            ...(isObject(incoming.waterPalette) ? incoming.waterPalette : {}),
        }),
        toggles: normalizeRuntimeToggles({
            ...state.runtimeParams.toggles,
            ...(isObject(incoming.toggles) ? incoming.toggles : {}),
        }),
        tuning: nextTuning,
        visualProfile: nextVisualProfile,
    };
    const nextResolved = resolveRuntimeQualityProfile(modules, nextRuntimeParamsBase);
    const optimizationProfile = resolveZenPondOptimizationProfile({
        qualityProfile: nextResolved.qualityProfile,
        rendererDebugToggles: nextRuntimeParamsBase.toggles,
    });
    const nextRuntimeParams = {
        ...nextRuntimeParamsBase,
        waterEffectsEnabled: optimizationProfile.water.effectsEnabled === true,
        effectIntensityScale: optimizationProfile.effectIntensityScale,
        toggles: optimizationProfile.debugToggles,
        optimization: buildZenPondOptimizationSnapshot(optimizationProfile),
    };

    state.runtimeParams = nextRuntimeParams;
    envRuntime.currentEnv = nextRuntimeParams.env;
    state.refs.envStateRef.current = nextRuntimeParams.env;
    state.refs.waterPaletteRef.current = nextRuntimeParams.waterPalette;
    state.refs.rendererDebugTogglesRef.current = nextRuntimeParams.toggles;
    state.refs.tuningRef.current = nextRuntimeParams.tuning;

    const nextQualitySignature = buildQualitySignature(nextResolved.qualityMode, nextResolved.qualityProfile);
    const qualityChanged = nextQualitySignature !== state.qualitySignature;
    const nextVisualProfileSignature = buildZenPondVisualProfileSignature(
        nextRuntimeParams.visualProfile,
    );
    const visualProfileChanged = (
        nextVisualProfileSignature !== state.visualProfileSignature
    );

    state.qualityMode = nextResolved.qualityMode;
    state.qualityProfile = nextResolved.qualityProfile;
    state.qualitySignature = nextQualitySignature;
    state.visualProfileSignature = nextVisualProfileSignature;
    state.refs.frameStateRef.current = resolveWorkerRuntimeFrameState({
        tuning: nextRuntimeParams.tuning,
        envState: nextRuntimeParams.env,
        qualityProfile: state.qualityProfile,
        effectIntensityScale: nextRuntimeParams.effectIntensityScale,
        envAuthority: nextRuntimeParams.envAuthority,
    });
    state.metrics.runtimeParamSyncCount += 1;

    const remountPromise = qualityChanged || visualProfileChanged
        ? remountEngine(modules, state)
        : null;
    if (!qualityChanged && !visualProfileChanged) {
        syncAmbientEntitiesForState(modules, state);
    }
    return Object.freeze({
        qualityChanged,
        visualProfileChanged,
        waterLayerChanged: previousWaterLayerApplySignature !== buildWaterLayerApplySignature({
            optimization: nextRuntimeParams.optimization,
            tuning: nextRuntimeParams.tuning,
        }),
        remountPromise: (
            remountPromise
            && typeof remountPromise.then === 'function'
                ? remountPromise
                : null
        ),
        optimizationSignature: optimizationProfile.signature,
        waterLayerRequested:
            optimizationProfile.water.layerEffectsEnabled === true,
        waterLayerRequestedSignature:
            optimizationProfile.water.layerAssetSignature,
    });
};

export const applyEnvironmentAuthorityForWorkerState = ({
    modules,
    state,
    envAuthorityInput = null,
    syncAmbientEntitiesForState,
} = {}) => {
    if (!isObject(envAuthorityInput)) {
        throw new Error('ZEN_POND_WORKER_ENVIRONMENT_AUTHORITY_REQUIRED');
    }
    if (!state?.runtimeParams || !state?.qualityProfile) {
        throw new Error('ZEN_POND_WORKER_ENVIRONMENT_RUNTIME_NOT_READY');
    }
    const nextAuthority = normalizeRuntimeEnvAuthority(envAuthorityInput);
    const nextTarget = resolveZenPondWorkerEnvironmentTarget({
        tuning: state.runtimeParams.tuning,
        envAuthority: nextAuthority,
    });
    const envRuntime = ensureEnvironmentRuntime(state);
    const targetChanged = nextTarget.signature !== envRuntime.targetSignature;
    const presentationSeed = setZenPondEnvironmentPresentationTarget({
        envRuntime,
        previousEnvAuthority: state.runtimeParams.envAuthority,
        nextTarget,
        firstFrameAckEmitted: state.firstFrameAckEmitted === true,
    });
    applyRuntimeEnvironmentSnapshot({
        state,
        envAuthority: nextTarget.envAuthority,
        env: presentationSeed.currentEnv || nextTarget.env,
    });
    if (typeof syncAmbientEntitiesForState !== 'function') {
        throw new Error('ZEN_POND_WORKER_ENVIRONMENT_AMBIENT_SYNC_SEAM_MISSING');
    }
    syncAmbientEntitiesForState(modules, state);
    return Object.freeze({
        changed: targetChanged,
        solarSyncEnabled: (
            state.runtimeParams.envAuthority.clockMode
            === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME
        ),
    });
};

export const updateRuntimeEnvironmentForWorkerState = ({
    modules,
    state,
    timestampMs = 0,
    syncAmbientEntitiesForState,
} = {}) => {
    if (!state?.runtimeParams || !state?.qualityProfile) return false;
    const envRuntime = ensureEnvironmentRuntime(state);
    const presentationUpdate = updateZenPondEnvironmentPresentation({
        envRuntime,
        tuning: state.runtimeParams.tuning,
        envAuthority: state.runtimeParams.envAuthority,
        active: state.active === true,
        timestampMs,
    });
    if (!presentationUpdate.applied) {
        return false;
    }
    applyRuntimeEnvironmentSnapshot({
        state,
        envAuthority: presentationUpdate.envAuthority,
        env: presentationUpdate.env,
    });
    if (typeof syncAmbientEntitiesForState === 'function') {
        syncAmbientEntitiesForState(modules, state);
    }
    return true;
};
