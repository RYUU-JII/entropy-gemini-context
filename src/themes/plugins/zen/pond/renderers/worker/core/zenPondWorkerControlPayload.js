import { projectZenPondTuningV1 } from '../../../contracts/zenPondTuningContract.js';
import { normalizeZenKoiInvitationAssignment } from '../../../roster/zenKoiInvitationAssignment.js';
import { countZenPondDeferredInvitations } from '../../../contracts/zenPondPresentationSceneCommit.js';
import { normalizeZenKoiPresentationRole } from '../../../model/koi/zenKoiPresentationRole.js';
import {
    ZEN_RENDERER_DEBUG_TOGGLES_GLOBAL_KEY,
    normalizeZenRendererDebugToggles,
} from '../../../contracts/zenRendererDebugToggles.js';
import {
    buildZenPondOptimizationSignature,
    buildZenPondOptimizationSnapshot,
    resolveZenPondOptimizationProfile,
} from '../../../runtime/core/zenPondOptimizationMaster.js';
import {
    buildRuntimeEnvAuthoritySnapshot,
} from './zenPondWorkerEnvironment.js';
import { requireKoiActivityProfileSnapshot } from '../../../runtime/workerSafe/zenKoiEnergyMath.js';
import { normalizeZenKoiRosterSnapshot } from '../../../roster/zenKoiRosterContract.js';
import { projectZenKoiRosterSnapshotToWorkerFishRoster } from '../../../roster/zenKoiRosterProjector.js';
import { normalizeZenKoiFormationProfile } from '../../../model/koi/zenKoiFormationProfile.js';
import { normalizeZenKoiExpressionProfile } from '../../../roster/zenKoiExpressionProfile.js';
import {
    buildZenPondPresentationSceneCommitDescriptor,
    normalizeZenPondPresentationSceneCommitKey,
    normalizeZenPondPresentationRequiredVisibleFishCount,
} from '../../../contracts/zenPondPresentationSceneCommit.js';
import {
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

const DEFAULT_MAX_FISH_ROSTER_SYNC_COUNT = 72;
const DEFAULT_ZEN_QUALITY_MODE = 'full';

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const isRefObject = (value) => (
    Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'current'))
);

const assertObjectInput = (value, fieldName) => {
    if (!isObject(value)) {
        throw new Error(`ZEN_POND_WORKER_CONTROL_PAYLOAD_INVALID_FIELD:${fieldName}`);
    }
    return value;
};

const assertObjectRefCurrent = (options, refName) => {
    const ref = options?.[refName];
    if (!isRefObject(ref)) {
        throw new Error(`ZEN_POND_WORKER_CONTROL_PAYLOAD_MISSING_REF:${refName}`);
    }
    if (!isObject(ref.current)) {
        throw new Error(`ZEN_POND_WORKER_CONTROL_PAYLOAD_INVALID_REF_CURRENT:${refName}`);
    }
    return ref.current;
};

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const roundNumber = (value, digits = 2, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Number(numeric.toFixed(digits));
};

const normalizeColorValue = (value) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : null
);

const buildRuntimeEnvAuthorityProbeSnapshot = (envAuthority = null) => {
    const snapshot = buildRuntimeEnvAuthoritySnapshot(envAuthority);
    return {
        authoritySignature: snapshot.authoritySignature,
    };
};

// Only material pigment and bathymetric composition cross the worker boundary.
// Scanner CSS sheen/vignette colors do not invalidate the rendered pond.
const buildRuntimeWaterPaletteSnapshot = (waterPalette = null) => ({
    gradientStops: Array.isArray(waterPalette?.gradientStops)
        ? waterPalette.gradientStops
            .slice(0, 3)
            .map((entry) => normalizeColorValue(entry))
            .filter(Boolean)
        : [],
    depthStrengthBias: roundNumber(clampNumber(waterPalette?.depthStrengthBias, -0.8, 0.8, 0), 3, 0),
    contourDensityBias: roundNumber(clampNumber(waterPalette?.contourDensityBias, -0.8, 0.8, 0), 3, 0),
    sedimentAmountBias: roundNumber(clampNumber(waterPalette?.sedimentAmountBias, -0.8, 0.8, 0), 3, 0),
    mineralStrength: roundNumber(clampNumber(waterPalette?.mineralStrength, 0, 0.65, 0.16), 3, 0.16),
});

const resolveRuntimeDebugToggleSource = (options = {}) => {
    const togglesRef = options?.rendererDebugTogglesRef;
    const refToggles = isRefObject(togglesRef) && isObject(togglesRef.current)
        ? togglesRef.current
        : null;
    const optionToggles = isObject(options?.rendererDebugToggles)
        ? options.rendererDebugToggles
        : null;
    const debugGlobal = typeof globalThis !== 'undefined' ? globalThis : null;
    const globalToggles = debugGlobal && isObject(debugGlobal[ZEN_RENDERER_DEBUG_TOGGLES_GLOBAL_KEY])
        ? debugGlobal[ZEN_RENDERER_DEBUG_TOGGLES_GLOBAL_KEY]
        : null;
    if (!refToggles && !optionToggles && !globalToggles) return null;
    return {
        ...(refToggles || optionToggles || {}),
        ...(globalToggles || {}),
    };
};

const resolveRuntimeDebugTogglesSnapshot = (options = {}) => {
    const source = resolveRuntimeDebugToggleSource(options);
    return source ? normalizeZenRendererDebugToggles(source) : null;
};

const resolveSceneGenerationKeySnapshot = (options = {}) => {
    const refKey = isRefObject(options?.sceneGenerationKeyRef)
        && typeof options.sceneGenerationKeyRef.current === 'string'
        && options.sceneGenerationKeyRef.current.trim()
        ? options.sceneGenerationKeyRef.current.trim()
        : '';
    if (refKey) return refKey;
    return typeof options?.sceneGenerationKey === 'string' && options.sceneGenerationKey.trim()
        ? options.sceneGenerationKey.trim()
        : '';
};

const resolveSceneSeedSnapshot = (options = {}) => {
    const raw = Number(options?.sessionSaltRef?.current);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.floor(raw)) >>> 0;
};

const toDomainText = (value, fallback = '') => {
    if (typeof value !== 'string') return fallback;
    const text = value.trim();
    return text || fallback;
};

const normalizeHexColor = (value) => {
    if (typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw) return null;
    const body = raw.startsWith('#') ? raw.slice(1) : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(body)) return null;
    return `#${body.toUpperCase()}`;
};

const resolveBlipRisk = (value) => roundNumber(clampNumber(value, 0, 1.2, 0), 3, 0);

const resolveFishStatus = (value, fallback = 'allowed') => (
    typeof value === 'string' && value.trim() ? value.trim() : fallback
);

const toPayloadSignature = (value) => {
    try {
        return JSON.stringify(value) || '';
    } catch (_) {
        return '';
    }
};

const projectRuntimeJsonValue = (value, depth = 0) => {
    if (depth > 1 || value === null || value === undefined) return null;
    if (Array.isArray(value)) {
        const next = [];
        for (let i = 0; i < Math.min(value.length, 24); i += 1) {
            const child = projectRuntimeJsonValue(value[i], depth + 1);
            if (child !== null) next.push(child);
        }
        return next.length > 0 ? next : null;
    }
    if (isObject(value)) {
        const next = {};
        const keys = Object.keys(value);
        for (let i = 0; i < keys.length; i += 1) {
            const key = keys[i];
            const child = projectRuntimeJsonValue(value[key], depth + 1);
            if (child !== null) {
                next[key] = child;
            }
        }
        return Object.keys(next).length > 0 ? next : null;
    }
    const valueType = typeof value;
    if (valueType === 'string') return value;
    if (valueType === 'boolean') return value;
    if (valueType === 'number') return Number.isFinite(value) ? value : null;
    return null;
};

const normalizeAppearanceProfile = (profile = null) => {
    if (!isObject(profile)) return null;
    const seed = Number(profile?.seed);
    if (!Number.isFinite(seed)) return null;
    const paletteIndex = Number(profile?.paletteIndex);
    const colorMix = Array.isArray(profile?.colorMix)
        ? profile.colorMix
            .slice(0, 3)
            .map((entry) => {
                if (isObject(entry)) {
                    const hex = normalizeHexColor(entry?.hex);
                    if (!hex) return null;
                    return {
                        hex,
                        weight: roundNumber(clampNumber(entry?.weight, 0, 1, 0), 3, 0),
                    };
                }
                const hex = normalizeHexColor(entry);
                return hex ? { hex, weight: 1 } : null;
            })
            .filter((entry) => entry !== null)
        : [];
    const appearanceMode = typeof profile?.appearanceMode === 'string'
        ? profile.appearanceMode
        : null;
    const breedMatch = isObject(profile?.breedMatch)
        ? {
            id: typeof profile.breedMatch.id === 'string' ? profile.breedMatch.id : null,
            score: roundNumber(clampNumber(profile.breedMatch.score, 0, 1, 0), 3, 0),
            algoVersion: typeof profile.breedMatch.algoVersion === 'string'
                ? profile.breedMatch.algoVersion
                : null,
        }
        : (typeof profile?.breedMatch === 'string' && profile.breedMatch.trim()
            ? { id: profile.breedMatch.trim(), score: 0, algoVersion: null }
            : null);
    return {
        seed: seed >>> 0,
        paletteIndex: Number.isFinite(paletteIndex) ? Math.max(0, Math.floor(paletteIndex)) : 0,
        appearanceMode,
        presentationRole: normalizeZenKoiPresentationRole(profile.presentationRole),
        colorMix,
        breedMatch,
    };
};

export const buildRuntimeTuningSnapshot = (tuning = null) => {
    const safeTuning = projectZenPondTuningV1(isObject(tuning) ? tuning : {});
    const keys = Object.keys(safeTuning);
    const next = {};
    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        const projected = projectRuntimeJsonValue(safeTuning[key], 0);
        if (projected !== null) {
            next[key] = projected;
        }
    }
    return next;
};

const buildRuntimeQualityProbeSnapshot = (qualityProfile = null) => (
    projectRuntimeJsonValue(isObject(qualityProfile) ? qualityProfile : {}, 0) || {}
);

export const buildSceneSessionInputProbe = (options = {}) => ({
    sceneGenerationKey: resolveSceneGenerationKeySnapshot(options),
    seed: resolveSceneSeedSnapshot(options),
});

export const shouldRebuildSceneSessionPayload = (prevProbe = null, nextProbe = null) => {
    if (!nextProbe || !isObject(nextProbe)) return false;
    if (!prevProbe || !isObject(prevProbe)) return true;
    return (
        prevProbe.sceneGenerationKey !== nextProbe.sceneGenerationKey
        || prevProbe.seed !== nextProbe.seed
    );
};

export const buildSceneSessionSyncPayload = (options = {}) => {
    const payload = {
        sceneGenerationKey: resolveSceneGenerationKeySnapshot(options),
        seed: resolveSceneSeedSnapshot(options),
    };
    return {
        payload,
        signature: toPayloadSignature(payload),
    };
};

export const buildRuntimeParamsInputProbe = (options = {}) => {
    const qualityProfile = assertObjectInput(options?.qualityProfile, 'qualityProfile');
    const waterPalette = assertObjectRefCurrent(options, 'waterPaletteRef');
    const tuning = assertObjectRefCurrent(options, 'tuningRef');
    const runtimeToggles = resolveRuntimeDebugTogglesSnapshot(options);
    const visualProfile = requireZenPondVisualProfile(options?.visualProfile);
    return {
        qualitySignature: toPayloadSignature(buildRuntimeQualityProbeSnapshot(qualityProfile)),
        waterPaletteSignature: toPayloadSignature(buildRuntimeWaterPaletteSnapshot(waterPalette)),
        tuningSignature: toPayloadSignature(buildRuntimeTuningSnapshot(tuning)),
        optimizationSignature: buildZenPondOptimizationSignature({
            qualityProfile,
            rendererDebugToggles: runtimeToggles,
        }),
        visualProfileSignature: toPayloadSignature(visualProfile),
    };
};

export const shouldRebuildRuntimeParamsPayload = (prevProbe = null, nextProbe = null) => {
    if (!nextProbe || !isObject(nextProbe)) return false;
    if (!prevProbe || !isObject(prevProbe)) return true;
    return (
        prevProbe.qualitySignature !== nextProbe.qualitySignature
        || prevProbe.waterPaletteSignature !== nextProbe.waterPaletteSignature
        || prevProbe.tuningSignature !== nextProbe.tuningSignature
        || prevProbe.optimizationSignature !== nextProbe.optimizationSignature
        || prevProbe.visualProfileSignature !== nextProbe.visualProfileSignature
    );
};

export const buildEnvironmentAuthorityInputProbe = (options = {}) => {
    const envAuthority = assertObjectRefCurrent(options, 'envAuthorityRef');
    return {
        authoritySignature: toPayloadSignature(
            buildRuntimeEnvAuthorityProbeSnapshot(envAuthority),
        ),
    };
};

export const shouldRebuildEnvironmentAuthorityPayload = (prevProbe = null, nextProbe = null) => {
    if (!nextProbe || !isObject(nextProbe)) return false;
    if (!prevProbe || !isObject(prevProbe)) return true;
    return prevProbe.authoritySignature !== nextProbe.authoritySignature;
};

export const buildEnvironmentAuthoritySyncPayload = (options = {}) => {
    const envAuthority = buildRuntimeEnvAuthoritySnapshot(
        assertObjectRefCurrent(options, 'envAuthorityRef'),
    );
    return {
        payload: envAuthority,
        signature: toPayloadSignature(envAuthority),
    };
};

const resolveEnvironmentAuthorityDayIndex = (options = {}) => {
    const envAuthority = buildRuntimeEnvAuthoritySnapshot(
        assertObjectRefCurrent(options, 'envAuthorityRef'),
    );
    return Math.trunc(Number(envAuthority.timeContext.dayIndex));
};

export const buildFishRosterInputProbe = (options = {}) => {
    const rosterSnapshot = normalizeZenKoiRosterSnapshot(
        assertObjectRefCurrent(options, 'rosterSnapshotRef'),
    );
    const appearanceMap = assertObjectRefCurrent(options, 'appearanceMapRef');
    const dayIndex = resolveEnvironmentAuthorityDayIndex(options);
    const presentationSceneCommitKey = normalizeZenPondPresentationSceneCommitKey(
        options?.presentationSceneCommitKey,
    );
    const expectedFishCount = Array.isArray(rosterSnapshot.items)
        ? rosterSnapshot.items.length
        : 0;
    const requiredVisibleFishCount = presentationSceneCommitKey === null
        ? 0
        : normalizeZenPondPresentationRequiredVisibleFishCount(
            options?.presentationSceneRequiredVisibleFishCount,
            { expectedFishCount },
        );
    return {
        rosterSignature: rosterSnapshot.signature,
        appearanceMap,
        dayIndex,
        presentationSceneCommitKey,
        requiredVisibleFishCount,
    };
};

export const shouldRebuildFishRosterPayload = (prevProbe = null, nextProbe = null) => {
    if (!nextProbe || !isObject(nextProbe)) return false;
    if (!prevProbe || !isObject(prevProbe)) return true;
    return (
        prevProbe.rosterSignature !== nextProbe.rosterSignature
        || prevProbe.appearanceMap !== nextProbe.appearanceMap
        || prevProbe.dayIndex !== nextProbe.dayIndex
        || prevProbe.presentationSceneCommitKey !== nextProbe.presentationSceneCommitKey
        || prevProbe.requiredVisibleFishCount !== nextProbe.requiredVisibleFishCount
    );
};

export const buildFishRosterSyncPayload = (
    options = {},
    {
        maxFishRosterSyncCount = DEFAULT_MAX_FISH_ROSTER_SYNC_COUNT,
    } = {},
) => {
    const rosterSnapshot = normalizeZenKoiRosterSnapshot(
        assertObjectRefCurrent(options, 'rosterSnapshotRef'),
    );
    const appearanceMap = assertObjectRefCurrent(options, 'appearanceMapRef');
    const dayIndex = resolveEnvironmentAuthorityDayIndex(options);
    const fishRoster = projectZenKoiRosterSnapshotToWorkerFishRoster({
        rosterSnapshot,
        appearanceMap,
        dayIndex,
        maxFishCount: maxFishRosterSyncCount,
    }).map((entry) => ({
        entityId: toDomainText(entry?.entityId, ''),
        domain: toDomainText(entry?.domain, ''),
        entityKind: toDomainText(entry?.entityKind, ''),
        interactionAction: toDomainText(entry?.interactionAction, ''),
        slot: toDomainText(entry?.slot, ''),
        presenceState: toDomainText(entry?.presenceState, ''),
        priority: roundNumber(Number(entry?.priority) || 0, 3, 0),
        risk: resolveBlipRisk(entry?.risk),
        status: resolveFishStatus(entry?.status, 'allowed'),
        appearanceProfile: normalizeAppearanceProfile(entry?.appearanceProfile || null),
        ...(entry.invitationAssignment ? { invitationAssignment: normalizeZenKoiInvitationAssignment(entry.invitationAssignment) } : {}),
        ...(entry.entityKind === 'invitation' ? { invitationArrivalMode: entry.invitationArrivalMode } : {}),
        activityProfile: requireKoiActivityProfileSnapshot(entry?.activityProfile, {
            domain: toDomainText(entry?.domain, ''),
        }),
        expressionProfile: normalizeZenKoiExpressionProfile(entry?.expressionProfile),
        formationProfile: normalizeZenKoiFormationProfile(entry?.formationProfile),
    })).filter((entry) => entry.entityId && (entry.domain || entry.entityKind === 'invitation'));

    const workerRosterSignature = toPayloadSignature(fishRoster);
    if (!workerRosterSignature) {
        throw new Error('ZEN_POND_PRESENTATION_WORKER_ROSTER_SIGNATURE_UNAVAILABLE');
    }
    const presentationSceneCommitKey = normalizeZenPondPresentationSceneCommitKey(
        options?.presentationSceneCommitKey,
    );
    const presentationSceneCommit = presentationSceneCommitKey === null
        ? null
        : buildZenPondPresentationSceneCommitDescriptor({
            presentationSceneCommitKey,
            presentationRosterSignature: rosterSnapshot.signature,
            workerRosterSignature,
            expectedFishCount: fishRoster.length,
            deferredInvitationCount: countZenPondDeferredInvitations(fishRoster),
            requiredVisibleFishCount: options?.presentationSceneRequiredVisibleFishCount,
        });
    const controlSignature = presentationSceneCommit === null
        ? workerRosterSignature
        : toPayloadSignature({
            workerRosterSignature,
            presentationSceneCommit,
        });

    return {
        payload: fishRoster,
        signature: controlSignature,
        workerRosterSignature,
        presentationRosterSignature: rosterSnapshot.signature,
        presentationSceneCommitKey,
        expectedFishCount: fishRoster.length,
        deferredInvitationCount: countZenPondDeferredInvitations(fishRoster),
        requiredVisibleFishCount: presentationSceneCommit?.requiredVisibleFishCount ?? 0,
    };
};

export const buildRuntimeParamsSyncPayload = (
    options = {},
    {
        zenQualityMode = DEFAULT_ZEN_QUALITY_MODE,
        includeEnvironmentAuthority = true,
    } = {},
) => {
    const qualityProfile = assertObjectInput(options?.qualityProfile, 'qualityProfile');
    const waterPalette = assertObjectRefCurrent(options, 'waterPaletteRef');
    const tuning = assertObjectRefCurrent(options, 'tuningRef');
    const runtimeToggles = resolveRuntimeDebugTogglesSnapshot(options);
    const visualProfile = requireZenPondVisualProfile(options?.visualProfile);
    const optimizationProfile = resolveZenPondOptimizationProfile({
        qualityProfile,
        rendererDebugToggles: runtimeToggles,
    });
    const canopyPreparation = CANOPY_PREPARATION_RESEARCH_BUILD_ENABLED
        ? normalizeZenPondCanopyPreparationResearch(qualityProfile?.telemetry?.canopyPreparation)
        : undefined;
    if (canopyPreparation !== undefined && qualityProfile?.telemetry?.enabled !== true) {
        throw new Error('ZEN_POND_CANOPY_PREPARATION_RESEARCH_TELEMETRY_REQUIRED');
    }

    const runtimeParams = {
        qualityMode: zenQualityMode,
        targetFps: Math.floor(clampNumber(qualityProfile?.targetFps, 12, 120, 30)),
        telemetry: {
            enabled: qualityProfile?.telemetry?.enabled === true,
            sampleIntervalMs: Math.floor(clampNumber(
                qualityProfile?.telemetry?.sampleIntervalMs,
                500,
                10_000,
                2_000,
            )),
            ...(canopyPreparation === undefined ? {} : { canopyPreparation }),
        },
        waterEffectsEnabled: optimizationProfile.water.effectsEnabled === true,
        effectIntensityScale: roundNumber(optimizationProfile.effectIntensityScale, 3, 1),
        waterPalette: buildRuntimeWaterPaletteSnapshot(waterPalette),
        toggles: optimizationProfile.debugToggles,
        optimization: buildZenPondOptimizationSnapshot(optimizationProfile),
        tuning: buildRuntimeTuningSnapshot(tuning),
        visualProfile,
    };
    if (includeEnvironmentAuthority === true) {
        runtimeParams.envAuthority = buildRuntimeEnvAuthoritySnapshot(
            assertObjectRefCurrent(options, 'envAuthorityRef'),
        );
    }

    return {
        payload: runtimeParams,
        signature: toPayloadSignature(runtimeParams),
    };
};
