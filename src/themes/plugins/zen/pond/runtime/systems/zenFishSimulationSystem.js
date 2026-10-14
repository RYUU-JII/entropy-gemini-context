import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import { createKoiNeighborGrid } from '../../model/koi/koiNeighborGrid.js';
import {
    ZEN_SURFACE_DISTURBANCE_SOURCES,
    assertZenSurfaceDisturbanceRuntimeRefs,
    pushZenSurfaceDisturbance,
} from '../surface/zenSurfaceDisturbance.js';
import { resolveKoiSleepContext } from '../zenKoiSleep.js';
import {
    resolveKoiActivationScore,
    resolveKoiGlobalActivityScale,
} from '../zenKoiActivation.js';
import { resolveKoiIndividualActivityScale } from '../workerSafe/zenKoiEnergyMath.js';
import { resolveZenKoiBehaviorIntent } from '../zenKoiBehaviorIntent.js';
import { acquireZenKoiBehaviorMemory } from '../zenKoiBehaviorMemory.js';
import {
    pruneZenKoiInteractionStimuli,
    admitZenKoiInteractionStimuli,
    resolveZenKoiInteractionStimulusForFish,
} from '../zenKoiInteractionStimulus.js';
import { resolveZenKoiFormationTarget } from '../../model/koi/zenKoiFormationProfile.js';
import {
    isZenPondWorldSimulationEnabled,
    resolveZenPondWorldPolicy,
} from '../core/zenPondWorldProfile.js';
import { resolveZenVisibleWorldBounds } from '../zenCoverMath.js';
import { advanceZenFishRosterLifecycle } from '../zenFishRosterEntitySync.js';
import { resolveZenKoiRosterTransit, finishZenKoiRosterTransitStep } from '../zenKoiRosterTransit.js';
import { resolveZenInvitationKoiPatrolBounds } from '../zenInvitationKoiPresentation.js';
import { resolveZenPondRegistrationFishTarget, resolveZenPondRegistrationPresentation } from '../../contracts/zenPondRegistrationPresentation.js';

const TRANSIT_INTENT = Object.freeze({ enabled: true, kind: 'roster_transit', steeringAuthority: 1, throttleBias: 0.03 });

const NEIGHBOR_CACHE_SIZE = 3;

const normalizeExpressionMotion = (fish = null) => {
    const motion = fish?.expressionProfile?.motion;
    if (!motion || typeof motion !== 'object') {
        return {
            activityScale: 1,
            decisionCadenceScale: 1,
            turnBias: 0,
            burstBias: 0,
            cTurnBias: 0,
        };
    }
    return {
        activityScale: clampValue(Number(motion.activityScale) || 1, 0.9, 1.12),
        decisionCadenceScale: clampValue(Number(motion.decisionCadenceScale) || 1, 0.78, 1.12),
        turnBias: clampValue(Number(motion.turnBias) || 0, 0, 0.08),
        burstBias: clampValue(Number(motion.burstBias) || 0, 0, 0.08),
        cTurnBias: clampValue(Number(motion.cTurnBias) || 0, 0, 0.06),
    };
};

const applyExpressionMotionToBehaviorIntent = (behaviorIntent = null, expressionMotion = null) => {
    if (!behaviorIntent || behaviorIntent.enabled !== true) return behaviorIntent;
    const motion = expressionMotion || normalizeExpressionMotion(null);
    const eventBias = behaviorIntent.eventBias || {};
    return {
        ...behaviorIntent,
        decisionCadenceScale: clampValue(
            (Number(behaviorIntent.decisionCadenceScale) || 1) * motion.decisionCadenceScale,
            0.55,
            1.7,
        ),
        eventBias: {
            ...eventBias,
            turn: clampValue((Number(eventBias.turn) || 0) + motion.turnBias, -0.22, 0.28),
            burst: clampValue((Number(eventBias.burst) || 0) + motion.burstBias, -0.12, 0.2),
            cTurn: clampValue((Number(eventBias.cTurn) || 0) + motion.cTurnBias, -0.1, 0.12),
        },
    };
};

export const createZenFishSimulationSystem = ({
    width,
    height,
    qualityProfile,
    fishRef,
    activityProfileByDomainRef,
    surfaceDisturbancesRef,
    surfaceDisturbanceTelemetryRef,
    rendererDebugTogglesRef,
    interactionStimuliRef,
    mousePos,
    commonEnvContextRef,
    viewportSizeRef,
    sessionSaltRef,
    tuningRef,
    hoveredDomainRef,
    lockedTargetRef,
    selectedFishUidRef,
    invitationRegistrationEntityIdRef,
    frameStateRef,
    envStateRef,
} = {}) => {
    assertZenSurfaceDisturbanceRuntimeRefs({
        rendererDebugTogglesRef,
        surfaceDisturbanceTelemetryRef,
    });
    const neighborGrid = createKoiNeighborGrid({ radius: 220, maxNeighbors: 3 });
    let behaviorTick = 0;
    let registrationViewportWidth = null;
    let registrationViewportHeight = null;
    let registrationPresentation = null;
    // A new system owns a new behavior clock, even if the roster retained fish.
    // Clear only intentions; body pose, momentum and the stroke clock survive.
    for (const fish of fishRef.current) {
        fish.zenKoiBehaviorMemory = null;
        fish.zenKoiBehaviorMicroGoal = null;
    }
    let neighborGridLastRefreshFrame = -Infinity;
    let neighborGridLastFishCount = -1;
    const sleepResolveOptionsScratch = {
        envState: null,
        simStepScale: 1,
        isFocused: false,
    };
    const fishUpdateContextScratch = {
        sessionSalt: null,
        tuning: null,
        activityScale: 1,
        globalActivityScale: 1,
        activationScore: 1,
        sleepActivityMultiplier: 1,
        individualActivityScale: 1,
        simStepRateScale: 1,
        neighbors: null,
        center: null,
        bounds: null,
        mousePos: null,
        sleepBlend: 0,
        sleepDrift: null,
        formationTarget: null,
        behaviorIntent: null,
    };

    const resolveNeighborRefreshInterval = (fishCount, hasActiveInteractionStimuli) => {
        if (hasActiveInteractionStimuli) return 1;
        if (fishCount <= 8) return 3;
        if (fishCount <= 16) return 2;
        return 1;
    };

    const ensureCachedNeighborPool = (fish) => {
        if (!Array.isArray(fish.zenKoiCachedNeighborPool)) {
            fish.zenKoiCachedNeighborPool = [];
        }
        while (fish.zenKoiCachedNeighborPool.length < NEIGHBOR_CACHE_SIZE) {
            fish.zenKoiCachedNeighborPool.push({ uid: null, x: 0, y: 0, angle: 0, vx: 0, vy: 0, distance: 0 });
        }
        if (!Array.isArray(fish.zenKoiCachedNeighbors)) {
            fish.zenKoiCachedNeighbors = [];
        }
        return {
            pool: fish.zenKoiCachedNeighborPool,
            out: fish.zenKoiCachedNeighbors,
        };
    };

    const writeNeighborCache = (fish, neighbors, frameCount) => {
        const { pool, out } = ensureCachedNeighborPool(fish);
        out.length = 0;
        const count = Math.min(Array.isArray(neighbors) ? neighbors.length : 0, pool.length);
        for (let i = 0; i < count; i += 1) {
            const source = neighbors[i];
            const target = pool[i];
            target.uid = source.uid;
            target.x = Number(source?.x) || 0;
            target.y = Number(source?.y) || 0;
            target.angle = Number(source?.angle) || 0;
            target.vx = Number(source?.vx) || 0;
            target.vy = Number(source?.vy) || 0;
            target.distance = Number(source?.distance) || 0;
            out.push(target);
        }
        fish.zenKoiCachedNeighborsFrame = frameCount;
    };

    const refreshNeighborCache = (fishes, frameCount) => {
        neighborGrid.build(fishes);
        neighborGridLastRefreshFrame = frameCount;
        neighborGridLastFishCount = fishes.length;
        for (let idx = 0; idx < fishes.length; idx += 1) {
            const fish = fishes[idx];
            if (!fish) continue;
            const neighbors = neighborGrid.getNearest(fishes, idx);
            writeNeighborCache(fish, neighbors, frameCount);
        }
    };

    const ensureCommonEnvContext = () => {
        const visibleBounds = resolveZenVisibleWorldBounds({
            worldWidth: width,
            worldHeight: height,
            viewportWidth: viewportSizeRef?.current?.width,
            viewportHeight: viewportSizeRef?.current?.height,
        });
        const centerX = visibleBounds.x + visibleBounds.width * 0.5;
        const centerY = visibleBounds.y + visibleBounds.height * 0.5;
        if (!commonEnvContextRef.current) {
            commonEnvContextRef.current = {
                center: { x: centerX, y: centerY },
                bounds: {
                    x: visibleBounds.x,
                    y: visibleBounds.y,
                    width: visibleBounds.width,
                    height: visibleBounds.height,
                    padding: 58,
                },
            };
        } else {
            commonEnvContextRef.current.center.x = centerX;
            commonEnvContextRef.current.center.y = centerY;
            commonEnvContextRef.current.bounds.x = visibleBounds.x;
            commonEnvContextRef.current.bounds.y = visibleBounds.y;
            commonEnvContextRef.current.bounds.width = visibleBounds.width;
            commonEnvContextRef.current.bounds.height = visibleBounds.height;
        }
        return commonEnvContextRef.current;
    };

    const step = ({ simStepSec, frameCount }) => {
        const currentTuning = tuningRef.current;
        const swimModel = currentTuning.physics.swimModel;
        const behaviorIntentEnabled = swimModel === 'event_fsm_life_v1' || swimModel === 'event_fsm_life_v2';
        const ginrinEnabled = qualityProfile.enableGinrinSparkle !== false;
        const ginrinScaleRaw = Number(qualityProfile.ginrinSparkleScale);
        const ginrinScale = Number.isFinite(ginrinScaleRaw)
            ? Math.max(0, Math.min(1, ginrinScaleRaw))
            : 1;
        const activeFrameState = frameStateRef?.current || null;
        const activeEnvState = activeFrameState?.envState || envStateRef.current;
        const worldPolicy = resolveZenPondWorldPolicy(activeFrameState?.worldPolicy);
        const waterMotionEnabled = isZenPondWorldSimulationEnabled(worldPolicy, 'waterMotion');
        const globalActivityScale = resolveKoiGlobalActivityScale(activeEnvState);
        const commonEnvContext = ensureCommonEnvContext();
        const center = commonEnvContext.center;
        const bounds = commonEnvContext.bounds;
        const viewport = viewportSizeRef.current;
        if (viewport.width !== registrationViewportWidth || viewport.height !== registrationViewportHeight) {
            registrationPresentation = resolveZenPondRegistrationPresentation(viewport);
            registrationViewportWidth = viewport.width;
            registrationViewportHeight = viewport.height;
        }
        advanceZenFishRosterLifecycle(fishRef, bounds, { width, height, tuning: currentTuning });
        const fishes = fishRef.current;
        const simStepRateScale = clampValue(simStepSec * 60, 0.5, 2.5);
        behaviorTick += simStepRateScale;
        const simStepScale = clampValue(globalActivityScale * simStepRateScale, 0.25, 2.6);
        const sessionSalt = sessionSaltRef.current;
        const mouseState = mousePos.current;
        const activityProfileByDomain = activityProfileByDomainRef?.current instanceof Map
            ? activityProfileByDomainRef.current
            : null;
        const hasActiveInteractionStimuli = pruneZenKoiInteractionStimuli(interactionStimuliRef, simStepRateScale);
        if (fishes.length <= 1) {
            neighborGridLastRefreshFrame = frameCount;
            neighborGridLastFishCount = fishes.length;
            if (fishes[0]) {
                const { out } = ensureCachedNeighborPool(fishes[0]);
                out.length = 0;
                fishes[0].zenKoiCachedNeighborsFrame = frameCount;
            }
        } else {
            const neighborRefreshInterval = resolveNeighborRefreshInterval(
                fishes.length,
                hasActiveInteractionStimuli,
            );
            if (
                neighborGridLastRefreshFrame < 0
                || fishes.length !== neighborGridLastFishCount
                || (frameCount - neighborGridLastRefreshFrame) >= neighborRefreshInterval
            ) {
                refreshNeighborCache(fishes, frameCount);
            }
        }
        const activeInteractionStimuli = Array.isArray(interactionStimuliRef?.current)
            ? interactionStimuliRef.current
            : [];
        if (behaviorIntentEnabled) admitZenKoiInteractionStimuli(fishes, activeInteractionStimuli, behaviorTick);

        for (let idx = 0; idx < fishes.length; idx += 1) {
            const fish = fishes[idx];
            fish.tuning = currentTuning;
            const transit = resolveZenKoiRosterTransit(fish, bounds);
            fish.ginrinRenderEnabled = ginrinEnabled;
            fish.ginrinQualityScale = ginrinScale;

            const neighbors = Array.isArray(fish.zenKoiCachedNeighbors)
                ? fish.zenKoiCachedNeighbors
                : [];
            const invitation = fish.entityKind === 'invitation';
            const registrationEntityId = invitationRegistrationEntityIdRef?.current;
            const registrationTarget = invitation && typeof registrationEntityId === 'string'
                && fish.entityId === registrationEntityId
                ? resolveZenPondRegistrationFishTarget(bounds, behaviorTick, registrationPresentation)
                : null;
            // Once invited toward the editor, keep the full pond patrol on
            // cancellation. Returning to the initial nook must not clamp its pose.
            if (registrationTarget) fish.zenInvitationPondPatrol = true;
            const fishBounds = invitation && !registrationTarget
                ? resolveZenInvitationKoiPatrolBounds(bounds, fish.zenInvitationPondPatrol) : bounds;
            fish.invitationAttending = invitation && (Boolean(registrationTarget)
                || (fish.interactionAction === 'register_protected_site'
                    && mouseState.x >= bounds.x && mouseState.y >= bounds.y
                    && fish.containsPoint(mouseState.x, mouseState.y)));
            const hovered = (fish.domain === hoveredDomainRef.current && !!fish.domain)
                || fish.invitationAttending;
            const interactionStimulus = behaviorIntentEnabled && !transit
                ? resolveZenKoiInteractionStimulusForFish({ fish, frameCount: behaviorTick }) : null;
            const formationTarget = transit ? null : registrationTarget || resolveZenKoiFormationTarget({
                fish,
                width,
                height,
                bounds,
                frameCount,
            });
            if (formationTarget) {
                fish.roamAnchor = {
                    x: formationTarget.x,
                    y: formationTarget.y,
                };
                fish.roamTimer = 24;
            }
            sleepResolveOptionsScratch.envState = activeEnvState;
            sleepResolveOptionsScratch.simStepScale = simStepScale;
            sleepResolveOptionsScratch.isFocused = hovered
                || (fish.domain && fish.domain === lockedTargetRef.current)
                || (selectedFishUidRef.current !== null && fish.uid === selectedFishUidRef.current)
                || Boolean(interactionStimulus)
                || Boolean(formationTarget);
            if (transit) sleepResolveOptionsScratch.isFocused = true;
            const sleepContext = resolveKoiSleepContext(fish, sleepResolveOptionsScratch);
            const activityProfileSnapshot = activityProfileByDomain && fish?.domain
                ? (activityProfileByDomain.get(fish.domain) || null)
                : null;
            const energyProfile = resolveKoiIndividualActivityScale({
                fish,
                envState: activeEnvState,
                activityProfileSnapshot,
            });
            const expressionMotion = normalizeExpressionMotion(fish);
            const sleepBlend = formationTarget || transit ? 0 : sleepContext.sleepBlend;
            const sleepActivityMultiplier = formationTarget || transit ? 1 : sleepContext.activityMultiplier;
            const activation = resolveKoiActivationScore({
                globalActivityScale,
                sleepBlend,
                sleepActivityMultiplier,
                individualActivityScale: energyProfile.individualActivityScale * expressionMotion.activityScale,
            });
            const focused = hovered
                || (fish.domain && fish.domain === lockedTargetRef.current)
                || (selectedFishUidRef.current !== null && fish.uid === selectedFishUidRef.current);
            const memory = acquireZenKoiBehaviorMemory(fish);
            if (!behaviorIntentEnabled) { memory.response = null; memory.intentCache = null; }
            let cache = memory.intentCache;
            const interactionToken = interactionStimulus ? interactionStimulus.token : null;
            const interactionPhase = interactionStimulus ? interactionStimulus.phase : null;
            const formationActive = Boolean(formationTarget);
            if (behaviorIntentEnabled && !transit && (!cache || behaviorTick >= cache.nextTick
                || cache.focused !== focused || cache.formationActive !== formationActive
                || cache.interactionToken !== interactionToken || cache.interactionPhase !== interactionPhase)) {
                const intent = applyExpressionMotionToBehaviorIntent(resolveZenKoiBehaviorIntent({
                    fish,
                    neighbors,
                    envState: activeEnvState,
                    sleepContext,
                    activation,
                    energyProfile,
                    mousePos: mouseState,
                    hovered,
                    focused,
                    interactionStimulus,
                    formationTarget,
                    bounds: fishBounds,
                    center,
                    frameCount: behaviorTick,
                    sessionSalt,
                }), expressionMotion);
                cache = { intent, nextTick: behaviorTick + 6, focused, formationActive, interactionToken, interactionPhase };
                memory.intentCache = cache;
            }
            const behaviorIntent = transit ? TRANSIT_INTENT : behaviorIntentEnabled ? cache.intent : null;

            fishUpdateContextScratch.sessionSalt = sessionSalt;
            fishUpdateContextScratch.tuning = currentTuning;
            const registrationArrivalRatio = registrationTarget
                ? clampValue(Math.hypot(registrationTarget.x - fish.x, registrationTarget.y - fish.y) / 140, 0.22, 1)
                : 1;
            fishUpdateContextScratch.activityScale = transit ? Math.max(0.9, activation.activationScore)
                : activation.activationScore * registrationArrivalRatio;
            fishUpdateContextScratch.globalActivityScale = activation.globalActivity;
            fishUpdateContextScratch.activationScore = activation.activationScore;
            fishUpdateContextScratch.sleepActivityMultiplier = sleepActivityMultiplier;
            fishUpdateContextScratch.individualActivityScale = activation.individualActivityScale;
            fishUpdateContextScratch.simStepRateScale = simStepRateScale;
            fishUpdateContextScratch.neighbors = neighbors;
            fishUpdateContextScratch.center = center;
            fishUpdateContextScratch.bounds = transit ? transit.bounds : fishBounds;
            fishUpdateContextScratch.rosterTransit = transit;
            fishUpdateContextScratch.mousePos = mouseState;
            fishUpdateContextScratch.sleepBlend = sleepBlend;
            fishUpdateContextScratch.sleepDrift = formationTarget ? null : sleepContext.drift;
            fishUpdateContextScratch.formationTarget = formationTarget;
            fishUpdateContextScratch.behaviorIntent = behaviorIntent;

            const wake = fish.update(width, height, frameCount, hovered, fish.targetRisk, fishUpdateContextScratch);
            finishZenKoiRosterTransitStep(fish, bounds);
            if (waterMotionEnabled && wake) {
                pushZenSurfaceDisturbance(surfaceDisturbancesRef, {
                    x: wake.x,
                    y: wake.y,
                    impulse: wake.force,
                    source: ZEN_SURFACE_DISTURBANCE_SOURCES.KOI_WAKE,
                }, {
                    rendererDebugToggles:
                        rendererDebugTogglesRef.current,
                    surfaceDisturbanceTelemetryRef,
                });
            }
        }

        if (fishes.some(fish => fish.rosterTransit?.complete)) {
            const retainedFish = fishes.filter(fish => !fish.rosterTransit?.complete);
            const selectedUid = Number(selectedFishUidRef.current);
            if (
                Number.isFinite(selectedUid)
                && !retainedFish.some((fish) => Number(fish?.uid) === selectedUid)
            ) {
                selectedFishUidRef.current = null;
            }
            fishRef.current = retainedFish;
        }
    };

    return {
        step,
        setWorldSize: (nextWidth, nextHeight) => { width = nextWidth; height = nextHeight; },
    };
};
