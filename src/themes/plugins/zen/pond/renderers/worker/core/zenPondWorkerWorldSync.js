import { resolveZenPondViewportLayout } from '../../../runtime/zenPondViewportPolicy.js';
import { normalizeZenKoiInvitationAssignment } from '../../../roster/zenKoiInvitationAssignment.js';
import { normalizeZenKoiInvitationArrivalMode } from '../../../roster/zenKoiInvitationSlots.js';
import { normalizeZenKoiPresentationRole } from '../../../model/koi/zenKoiPresentationRole.js';
import { captureZenPondComposition, reflowZenPondComposition, reflowZenPondMovingState } from '../../../runtime/zenPondSpatialReflow.js';
import { ZEN_ROCK_LAYOUT_KEY_PROP } from '../../../runtime/zenRockLayoutSync.js';
import { resolveZenAmbientPopulationTargetsFromFrameState } from '../../../runtime/zenAmbientPopulationPlan.js';
import { buildZenRockLayoutKey } from '../../../runtime/zenRockLayoutSync.js';
import { buildZenRockLayout } from '../../../runtime/zenRockLayoutSync.js';
import {
    buildZenRockLayout as buildZenIshigumiRockLayout,
    buildZenRockLayoutKey as buildZenIshigumiRockLayoutKey,
} from '../../../runtime/visualProfiles/zenPondIshigumiLayout.js';
import {
    ZEN_POND_ROCK_PROFILES,
} from '../../../contracts/zenPondVisualProfile.js';
import {
    isZenPondWorldEntityEnabled,
    resolveZenPondWorldPolicy,
} from '../../../runtime/core/zenPondWorldProfile.js';
import {
    buildZenKoiFormationProfileSignature,
    normalizeZenKoiFormationProfile,
} from '../../../model/koi/zenKoiFormationProfile.js';
import {
    buildZenKoiExpressionProfileSignature,
    normalizeZenKoiExpressionProfile,
} from '../../../roster/zenKoiExpressionProfile.js';
import { resolveZenVisibleWorldBounds } from '../../../runtime/zenCoverMath.js';
import { requireKoiActivityProfileSnapshot } from '../../../runtime/workerSafe/zenKoiEnergyMath.js';
import {
    buildZenPondBathymetryFieldKey,
    createZenPondBathymetryField,
    requireZenPondBathymetryField,
} from '../../../world/fields/zenPondBathymetryField.js';

const MAX_SYNC_FISH_COUNT_DEFAULT = 96;

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const clamp = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const round = (value, digits = 2, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Number(numeric.toFixed(digits));
};

const buildBioticPetalPopulationSignature = ({
    frameState = null,
    enabled = true,
} = {}) => {
    if (!enabled) return 'petals:off';
    const biotic = frameState?.channels?.biotic || {};
    return [
        'petals',
        round(biotic.bonsaiPetalCapacity ?? biotic.bonsaiPetalSupply, 3, 0),
        round(biotic.bonsaiBloomRatio ?? biotic.bonsaiBloomSupply, 3, 0),
        round(biotic.bonsaiPetalFallLimit ?? biotic.bonsaiPetalFallSupply, 3, 0),
        round(biotic.bonsaiPreviewPetalRate, 3, 0),
    ].join(':');
};

const resolveWorkerWorldPolicy = (state = null) => (
    resolveZenPondWorldPolicy(state?.refs?.frameStateRef?.current?.worldPolicy)
);

const resolveStaticSceneEntityPlan = (worldPolicy = null) => {
    const lilyPads = isZenPondWorldEntityEnabled(worldPolicy, 'lilyPads');
    const waterLilies = isZenPondWorldEntityEnabled(worldPolicy, 'waterLilies');
    const irises = isZenPondWorldEntityEnabled(worldPolicy, 'irises');
    return Object.freeze({
        lilyPads,
        waterLilies,
        irises,
        hasStaticPlants: lilyPads || waterLilies || irises,
    });
};

const resolveAmbientEntityPlan = (worldPolicy = null) => {
    const particles = isZenPondWorldEntityEnabled(worldPolicy, 'particles');
    const petals = isZenPondWorldEntityEnabled(worldPolicy, 'petals');
    const glimmers = isZenPondWorldEntityEnabled(worldPolicy, 'glimmers');
    const rocks = isZenPondWorldEntityEnabled(worldPolicy, 'rocks');
    return Object.freeze({
        particles,
        petals,
        glimmers,
        rocks,
        hasPopulation: particles || petals || glimmers,
    });
};

const resolveWorkerRockLayoutStrategy = (state = null) => {
    const rockProfile = state?.runtimeParams?.visualProfile?.rocks;
    if (rockProfile === ZEN_POND_ROCK_PROFILES.ISHIGUMI) {
        return Object.freeze({
            id: ZEN_POND_ROCK_PROFILES.ISHIGUMI,
            buildLayoutKey: buildZenIshigumiRockLayoutKey,
            buildLayout: buildZenIshigumiRockLayout,
        });
    }
    return Object.freeze({
        id: rockProfile,
        buildLayoutKey: buildZenRockLayoutKey,
        buildLayout: buildZenRockLayout,
    });
};

const ensureWorldSyncCache = (state) => {
    const nextCache = {
        bathymetryFieldSignature: '',
        staticSceneSignature: '',
        ambientPopulationSignature: '',
        fishRosterSignature: '',
        hasBathymetryFieldSync: false,
        hasStaticSceneSync: false,
        hasAmbientPopulationSync: false,
        hasFishRosterSync: false,
    };
    if (isObject(state?.worldSyncCache)) {
        const worldSyncCache = {
            ...nextCache,
            ...state.worldSyncCache,
        };
        if (state && typeof state === 'object') {
            state.worldSyncCache = worldSyncCache;
        }
        return worldSyncCache;
    }
    if (state && typeof state === 'object') {
        state.worldSyncCache = nextCache;
    }
    return nextCache;
};

const resolveWorkerBathymetryFieldOptions = (state) => {
    const sceneGenerationKey = typeof state?.sceneGenerationKey === 'string'
        ? state.sceneGenerationKey.trim()
        : '';
    if (!sceneGenerationKey) {
        throw new Error('ZEN_POND_BATHYMETRY_SCENE_GENERATION_KEY_MISSING');
    }
    const sessionSalt =
        state?.refs?.sessionSaltRef?.current;
    if (
        !Number.isSafeInteger(sessionSalt)
        || sessionSalt < 0
        || sessionSalt > 0xffffffff
    ) {
        throw new Error(
            'ZEN_POND_BATHYMETRY_SESSION_SALT_INVALID',
        );
    }
    return {
        worldWidth: state?.width,
        worldHeight: state?.height,
        seed: [
            sceneGenerationKey,
            sessionSalt,
        ].join(':'),
    };
};

export const buildWorkerBathymetryFieldSignature = ({
    state,
} = {}) => {
    return buildZenPondBathymetryFieldKey(
        resolveWorkerBathymetryFieldOptions(state),
    );
};

const syncBathymetryFieldForWorkerState = ({
    state,
    worldSyncCache,
} = {}) => {
    const signature = buildWorkerBathymetryFieldSignature({ state });
    const changed = (
        !worldSyncCache.hasBathymetryFieldSync
        || worldSyncCache.bathymetryFieldSignature !== signature
    );
    if (!changed) {
        requireZenPondBathymetryField(
            state.refs.bathymetryFieldRef.current,
        );
        return {
            bathymetryFieldChanged: false,
            bathymetryFieldSignature: signature,
        };
    }
    const nextField = createZenPondBathymetryField(
        resolveWorkerBathymetryFieldOptions(state),
    );
    state.refs.bathymetryFieldRef.current =
        requireZenPondBathymetryField(nextField);
    worldSyncCache.bathymetryFieldSignature = signature;
    worldSyncCache.hasBathymetryFieldSync = true;
    return {
        bathymetryFieldChanged: true,
        bathymetryFieldSignature: signature,
    };
};

export const buildWorkerStaticSceneLayoutSignature = ({
    state,
} = {}) => {
    const tuning = state.refs.tuningRef.current || {};
    const worldPolicy = resolveWorkerWorldPolicy(state);
    const staticPlan = resolveStaticSceneEntityPlan(worldPolicy);
    // Keep aligned with DEFAULT_KOI_TUNING in model/koi/constants.js.
    const padDensity = Number(tuning?.padDensity ?? 32);
    const flowerChance = Number(tuning?.flowerChance ?? 0.35);
    return [
        worldPolicy.id,
        staticPlan.lilyPads ? 1 : 0,
        staticPlan.waterLilies ? 1 : 0,
        staticPlan.irises ? 1 : 0,
        Math.round(state.width),
        Math.round(state.height),
        state.sceneGenerationKey,
        staticPlan.hasStaticPlants ? round(padDensity, 3, 12) : 'off',
        staticPlan.hasStaticPlants ? round(flowerChance, 3, 0.65) : 'off',
        staticPlan.hasStaticPlants ? Number(state.qualityProfile?.densityScale) || 1 : 'off',
    ].join('|');
};

const rebuildStaticSceneLayout = (modules, state) => {
    const tuning = state.refs.tuningRef.current || {};
    const worldPolicy = resolveWorkerWorldPolicy(state);
    const staticPlan = resolveStaticSceneEntityPlan(worldPolicy);
    if (!staticPlan.hasStaticPlants) {
        state.refs.lilyPadsRef.current = [];
        state.refs.waterLilyRef.current = [];
        state.refs.zenIrisClustersRef.current = [];
        return;
    }
    // Keep aligned with DEFAULT_KOI_TUNING in model/koi/constants.js.
    const padDensity = Number(tuning?.padDensity ?? 32);
    const flowerChance = Number(tuning?.flowerChance ?? 0.35);
    const qualityDensityScale = Number(state.qualityProfile?.densityScale) || 1;
    const padCount = modules.scaleCount(
        padDensity * Math.min(1.5, (state.width * state.height) / (1280 * 720)),
        qualityDensityScale,
        2,
    );
    const layout = modules.buildClusteredPondLayout({
        width: state.width,
        height: state.height,
        count: padCount,
        flowerChance,
        sceneGenerationKey: state.sceneGenerationKey,
    });
    state.refs.lilyPadsRef.current = staticPlan.lilyPads && Array.isArray(layout?.lilyPads)
        ? layout.lilyPads
        : [];
    state.refs.waterLilyRef.current = staticPlan.waterLilies && Array.isArray(layout?.waterLilyBlooms)
        ? layout.waterLilyBlooms
        : [];
    state.refs.zenIrisClustersRef.current = staticPlan.irises && Array.isArray(layout?.zenIrisClusters)
        ? layout.zenIrisClusters
        : [];
};

export const buildWorkerAmbientPopulationSignature = ({
    state,
} = {}) => {
    const tuning = state?.refs?.tuningRef?.current || {};
    const qualityProfile = state?.qualityProfile || {};
    const worldPolicy = resolveWorkerWorldPolicy(state);
    const ambientPlan = resolveAmbientEntityPlan(worldPolicy);
    const populationTargets = ambientPlan.hasPopulation
        ? resolveZenAmbientPopulationTargetsFromFrameState({
            frameState: state?.refs?.frameStateRef?.current || null,
            renderParticles: ambientPlan.particles,
            renderPetals: ambientPlan.petals,
            renderGlimmers: ambientPlan.glimmers,
        })
        : {
            targets: {
                particles: 0,
                petals: 0,
                glimmers: 0,
            },
        };
    const rockLayoutStrategy = resolveWorkerRockLayoutStrategy(state);
    const rockLayoutKey = ambientPlan.rocks
        ? rockLayoutStrategy.buildLayoutKey({
            width: state?.width,
            height: state?.height,
            tuning,
            qualityProfile,
            rockSeedSalt: state?.refs?.sessionSaltRef?.current,
        })
        : 'rocks:off';
    return [
        worldPolicy.id,
        ambientPlan.particles ? 1 : 0,
        ambientPlan.petals ? 1 : 0,
        ambientPlan.glimmers ? 1 : 0,
        ambientPlan.rocks ? 1 : 0,
        populationTargets.targets.particles,
        populationTargets.targets.petals,
        buildBioticPetalPopulationSignature({
            frameState: state?.refs?.frameStateRef?.current || null,
            enabled: ambientPlan.petals,
        }),
        populationTargets.targets.glimmers,
        rockLayoutKey,
        rockLayoutStrategy.id,
    ].join('|');
};

export const syncAmbientEntitiesForWorkerState = ({
    modules,
    state,
    forceStaticScene = false,
    forceAmbientPopulation = false,
} = {}) => {
    if (!state.width || !state.height || !state.qualityProfile) return {
        bathymetryFieldChanged: false,
        staticSceneChanged: false,
        ambientPopulationChanged: false,
    };
    const worldSyncCache = ensureWorldSyncCache(state);
    const bathymetrySync = syncBathymetryFieldForWorkerState({
        state,
        worldSyncCache,
    });
    const staticSceneSignature = buildWorkerStaticSceneLayoutSignature({ state });
    const staticSceneChanged = forceStaticScene
        || !worldSyncCache.hasStaticSceneSync
        || worldSyncCache.staticSceneSignature !== staticSceneSignature;
    if (staticSceneChanged) {
        state.pondComposition = null;
        rebuildStaticSceneLayout(modules, state);
        worldSyncCache.staticSceneSignature = staticSceneSignature;
        worldSyncCache.hasStaticSceneSync = true;
    }

    const ambientPopulationSignature = buildWorkerAmbientPopulationSignature({ state });
    const ambientPopulationChanged = forceAmbientPopulation
        || !worldSyncCache.hasAmbientPopulationSync
        || worldSyncCache.ambientPopulationSignature !== ambientPopulationSignature;
    if (ambientPopulationChanged) {
        state.pondComposition = null;
        const rockLayoutStrategy = resolveWorkerRockLayoutStrategy(state);
        modules.syncAmbientEntities({
            width: state.width,
            height: state.height,
            tuning: state.refs.tuningRef.current || {},
            qualityProfile: state.qualityProfile,
            frameState: state.refs.frameStateRef.current,
            envState: state.refs.envStateRef.current || {},
            rockSeedSalt: state.refs.sessionSaltRef.current,
            worldPolicy: resolveWorkerWorldPolicy(state),
            particlesRef: state.refs.particlesRef,
            petalsRef: state.refs.petalsRef,
            glimmersRef: state.refs.glimmersRef,
            rocksRef: state.refs.rocksRef,
            rockLayoutStrategy,
        });
        worldSyncCache.ambientPopulationSignature = ambientPopulationSignature;
        worldSyncCache.hasAmbientPopulationSync = true;
    }
    return {
        ...bathymetrySync,
        staticSceneChanged,
        ambientPopulationChanged,
        staticSceneSignature,
        ambientPopulationSignature,
    };
};

const normalizeAppearanceProfile = (profile = null) => {
    if (!isObject(profile)) return null;
    const seed = Number(profile.seed);
    if (!Number.isFinite(seed)) return null;
    const paletteIndexRaw = Number(profile.paletteIndex);
    const paletteIndex = Number.isFinite(paletteIndexRaw)
        ? Math.max(0, Math.floor(paletteIndexRaw))
        : null;
    return {
        seed: seed >>> 0,
        paletteIndex,
        presentationRole: normalizeZenKoiPresentationRole(profile.presentationRole),
        colorMix: Array.isArray(profile.colorMix)
            ? profile.colorMix
                .map((entry) => (
                    isObject(entry)
                        ? {
                            hex: typeof entry.hex === 'string' ? entry.hex : null,
                            weight: clamp(Number(entry.weight), 0, 1),
                        }
                        : null
                ))
                .filter((entry) => entry && entry.hex)
            : null,
        appearanceMode: typeof profile.appearanceMode === 'string' ? profile.appearanceMode : null,
        breedMatch: isObject(profile.breedMatch)
            ? {
                id: typeof profile.breedMatch.id === 'string' ? profile.breedMatch.id : null,
                score: clamp(Number(profile.breedMatch.score), 0, 1),
            }
            : null,
    };
};

const normalizeFishRosterEntries = ({
    fishRoster = [],
    maxSyncFishCount = MAX_SYNC_FISH_COUNT_DEFAULT,
} = {}) => {
    if (!Array.isArray(fishRoster)) return [];
    const next = [];
    for (let i = 0; i < fishRoster.length; i += 1) {
        const item = fishRoster[i];
        if (!isObject(item)) continue;
        const domain = typeof item.domain === 'string' ? item.domain.trim() : '';
        const entityKind = typeof item.entityKind === 'string' ? item.entityKind.trim() : 'site';
        const isInvitation = entityKind === 'invitation';
        if (!domain && !isInvitation) continue;
        const entityId = typeof item.entityId === 'string' && item.entityId.trim()
            ? item.entityId.trim()
            : domain;
        if (!entityId) continue;
        next.push({
            entityId,
            domain: domain || null,
            entityKind,
            interactionAction: typeof item.interactionAction === 'string' && item.interactionAction.trim()
                ? item.interactionAction.trim()
                : null,
            slot: typeof item.slot === 'string' && item.slot.trim() ? item.slot.trim() : 'resident',
            presenceState: typeof item.presenceState === 'string' && item.presenceState.trim()
                ? item.presenceState.trim()
                : 'active',
            priority: round(Number(item.priority), 3, 0),
            risk: clamp(Number(item.risk), 0, 1.2),
            status: typeof item.status === 'string' && item.status.trim() ? item.status.trim() : 'safe',
            appearanceProfile: normalizeAppearanceProfile(item.appearanceProfile),
            ...(item.invitationAssignment ? { invitationAssignment: normalizeZenKoiInvitationAssignment(item.invitationAssignment) } : {}),
            ...(isInvitation ? { invitationArrivalMode: normalizeZenKoiInvitationArrivalMode(item.invitationArrivalMode) } : {}),
            activityProfile: requireKoiActivityProfileSnapshot(item.activityProfile, { domain }),
            expressionProfile: normalizeZenKoiExpressionProfile(item.expressionProfile),
            formationProfile: normalizeZenKoiFormationProfile(item.formationProfile),
        });
        if (next.length >= maxSyncFishCount) break;
    }
    return next;
};

const buildAppearanceProfileSignature = (appearanceProfile = null) => {
    if (!appearanceProfile) return '';
    const colorMix = Array.isArray(appearanceProfile.colorMix)
        ? appearanceProfile.colorMix
            .map((entry) => (
                entry && typeof entry === 'object'
                    ? [
                        typeof entry.hex === 'string' ? entry.hex : '',
                        round(entry.weight, 4, 0),
                    ].join('@')
                    : ''
            ))
            .join(',')
        : '';
    const breedMatch = appearanceProfile.breedMatch && typeof appearanceProfile.breedMatch === 'object'
        ? [
            typeof appearanceProfile.breedMatch.id === 'string' ? appearanceProfile.breedMatch.id : '',
            round(appearanceProfile.breedMatch.score, 4, 0),
        ].join('@')
        : '';
    return [
        Number(appearanceProfile.seed) || 0,
        appearanceProfile.presentationRole ?? '',
        Number.isFinite(Number(appearanceProfile.paletteIndex))
            ? Math.max(0, Math.floor(Number(appearanceProfile.paletteIndex)))
            : '',
        typeof appearanceProfile.appearanceMode === 'string' ? appearanceProfile.appearanceMode : '',
        colorMix,
        breedMatch,
    ].join('~');
};

const buildActivityProfileSignature = (activityProfile = null) => {
    if (!activityProfile) return '';
    return [
        activityProfile.persisted === false ? 0 : 1,
        round(activityProfile.quantile, 4, 0),
        activityProfile.boundDayIndex ?? '',
        Math.max(0, Math.floor(Number(activityProfile.rebindCount) || 0)),
    ].join('~');
};

export const buildWorkerFishRosterSignature = ({
    state,
    maxSyncFishCount = MAX_SYNC_FISH_COUNT_DEFAULT,
} = {}) => {
    const roster = normalizeFishRosterEntries({
        fishRoster: state?.fishRosterPayload,
        maxSyncFishCount,
    });
    const rosterSignature = roster.map((item) => (
        [
            item.entityId,
            item.domain || '',
            item.entityKind,
            item.interactionAction || '',
            item.invitationAssignment?.receiptId ?? '',
            item.invitationAssignment?.invitationEntityId ?? '',
            item.invitationArrivalMode ?? '',
            item.slot,
            item.presenceState,
            round(item.priority, 4, 0),
            round(item.risk, 4, 0),
            item.status,
            buildAppearanceProfileSignature(item.appearanceProfile),
            buildActivityProfileSignature(item.activityProfile),
            buildZenKoiExpressionProfileSignature(item.expressionProfile),
            buildZenKoiFormationProfileSignature(item.formationProfile),
        ].join(':')
    )).join('|');
    return {
        roster,
        signature: rosterSignature,
    };
};

export const syncFishRosterForWorkerState = ({
    modules,
    state,
    maxSyncFishCount = MAX_SYNC_FISH_COUNT_DEFAULT,
    forceRoster = false,
    replacePopulation = false,
} = {}) => {
    if (!state.width || !state.height) return {
        fishRosterChanged: false,
    };
    const { roster, signature } = buildWorkerFishRosterSignature({
        state,
        maxSyncFishCount,
    });
    const worldSyncCache = ensureWorldSyncCache(state);
    const fishRosterChanged = forceRoster || replacePopulation
        || !worldSyncCache.hasFishRosterSync
        || worldSyncCache.fishRosterSignature !== signature;
    if (!fishRosterChanged) {
        return {
            fishRosterChanged: false,
            fishRosterSignature: signature,
        };
    }
    worldSyncCache.fishRosterSignature = signature;
    worldSyncCache.hasFishRosterSync = true;
    state.fishAppearanceByDomain.clear();
    for (let i = 0; i < roster.length; i += 1) {
        const item = roster[i];
        if (item.domain && item.appearanceProfile) {
            state.fishAppearanceByDomain.set(item.domain, item.appearanceProfile);
        }
    }

    modules.syncFishRoster({
        width: state.width,
        height: state.height,
        spawnBounds: resolveZenVisibleWorldBounds({
            worldWidth: state.width,
            worldHeight: state.height,
            viewportWidth: state.viewportWidth,
            viewportHeight: state.viewportHeight,
        }),
        fishRoster: roster,
        replacePopulation,
        tuning: state.refs.tuningRef.current || {},
        fishRef: state.refs.fishRef,
        activityProfileByDomainRef: state.refs.activityProfileByDomainRef,
        dummyFishRef: state.refs.dummyFishRef,
        selectedFishUid: state.refs.selectedFishUidRef.current,
        setSelectedFishUid: (uid) => {
            const nextUid = Number(uid);
            state.refs.selectedFishUidRef.current = Number.isFinite(nextUid) ? nextUid : null;
        },
        applyDomainAppearanceToFish: (fish) => {
            if (!fish || typeof fish.setAppearanceProfile !== 'function') return;
            const domain = typeof fish.domain === 'string' ? fish.domain : '';
            if (!domain) return;
            const appearanceProfile = state.fishAppearanceByDomain.get(domain);
            if (!appearanceProfile) return;
            fish.setAppearanceProfile(appearanceProfile);
        },
    });
    return {
        fishRosterChanged: true,
        fishRosterSignature: signature,
    };
};

// Called only at the settled resize boundary. This is not a scene/session sync.
export const commitZenPondViewportReflow = (state) => {
    const next = resolveZenPondViewportLayout({ width: state.viewportWidth, height: state.viewportHeight });
    if (next.width === state.width && next.height === state.height) return false;
    if (typeof state.scene?.resizeWorld !== 'function' || typeof state.runtimeStopLoop?.setWorldSize !== 'function') {
        throw new Error('ZEN_POND_REFLOW_OWNERS_NOT_READY');
    }
    const previous = { width: state.width, height: state.height };
    const refs = state.refs;
    if (!state.pondComposition) {
        state.pondComposition = captureZenPondComposition({
            ...previous, pads: refs.lilyPadsRef.current, flowers: refs.waterLilyRef.current,
            rocks: refs.rocksRef.current, irises: refs.zenIrisClustersRef.current,
        });
    }
    reflowZenPondComposition(state.pondComposition, next);
    reflowZenPondMovingState(refs, previous, next);
    state.width = next.width;
    state.height = next.height;
    state.sceneLayout = next;
    const cache = ensureWorldSyncCache(state);
    syncBathymetryFieldForWorkerState({ state, worldSyncCache: cache });
    // A later weather/roster sync must not mistake the moved layout for stale data.
    const strategy = resolveWorkerRockLayoutStrategy(state);
    refs.rocksRef.current[ZEN_ROCK_LAYOUT_KEY_PROP] = strategy.buildLayoutKey({
        width: state.width, height: state.height, tuning: refs.tuningRef.current,
        qualityProfile: state.qualityProfile, rockSeedSalt: refs.sessionSaltRef.current,
    });
    cache.staticSceneSignature = buildWorkerStaticSceneLayoutSignature({ state });
    cache.ambientPopulationSignature = buildWorkerAmbientPopulationSignature({ state });
    state.runtimeStopLoop.setWorldSize(next.width, next.height);
    state.scene.resizeWorld(next);
    state.metrics.viewportReflowCount += 1;
    return true;
};
