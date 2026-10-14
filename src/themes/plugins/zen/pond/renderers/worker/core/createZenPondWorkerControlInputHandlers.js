import { mapZenViewportPointToWorld } from '../../../runtime/zenCoverMath.js';
import { pushZenKoiInteractionStimulus } from '../../../runtime/zenKoiInteractionStimulus.js';
import {
    ZEN_SURFACE_DISTURBANCE_SOURCES,
    readZenSurfaceDisturbanceSource,
} from '../../../runtime/surface/zenSurfaceDisturbance.js';
import { applyZenPondPetalLandings } from './zenPondPetalLandingReceiver.js';
import { normalizeZenPondRegistrationEntityId } from '../../../contracts/zenPondRegistrationPresentation.js';

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const toOptionalFiniteNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const toOptionalUid = (value) => {
    const numeric = toOptionalFiniteNumber(value);
    if (numeric === null) return null;
    const uid = Math.floor(numeric);
    return uid > 0 ? uid : null;
};

const mapViewportPointerToWorld = (runtimeState, pointer) => {
    if (!isObject(pointer)) return null;
    const viewportX = Number(pointer.x);
    const viewportY = Number(pointer.y);
    if (!Number.isFinite(viewportX) || !Number.isFinite(viewportY)) return null;
    return mapZenViewportPointToWorld({
        viewportX,
        viewportY,
        worldWidth: runtimeState?.width,
        worldHeight: runtimeState?.height,
        viewportWidth: runtimeState?.viewportWidth,
        viewportHeight: runtimeState?.viewportHeight,
    });
};

const mapWorldPointerToWorld = (runtimeState, pointer) => {
    if (!isObject(pointer)) return null;
    const worldX = Number(pointer.x);
    const worldY = Number(pointer.y);
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;
    const worldWidth = Math.max(1, Math.round(toFiniteNumber(runtimeState?.width, 1)));
    const worldHeight = Math.max(1, Math.round(toFiniteNumber(runtimeState?.height, 1)));
    if (worldX < 0 || worldY < 0 || worldX > worldWidth || worldY > worldHeight) {
        return null;
    }
    return {
        x: worldX,
        y: worldY,
    };
};

const mapInputPointerToWorld = (runtimeState, pointer, space = 'world') => {
    const normalizedSpace = typeof space === 'string'
        ? space.trim().toLowerCase()
        : '';
    if (normalizedSpace === 'viewport') {
        return mapViewportPointerToWorld(runtimeState, pointer);
    }
    if (normalizedSpace === 'world') {
        return mapWorldPointerToWorld(runtimeState, pointer);
    }
    const worldPointer = mapWorldPointerToWorld(runtimeState, pointer);
    if (worldPointer) return worldPointer;
    return mapViewportPointerToWorld(runtimeState, pointer);
};

const resolveFishHeadPosition = (fish) => {
    const history = Array.isArray(fish?.history) ? fish.history : [];
    const head = history.length > 0 ? history[0] : fish;
    const x = Number(head?.x);
    const y = Number(head?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
};

const findFishHitAtPoint = (runtimeState, pointer, {
    interactionMode = 'hover',
} = {}) => {
    if (!isObject(pointer)) return null;
    const x = Number(pointer.x);
    const y = Number(pointer.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const fishList = Array.isArray(runtimeState?.refs?.fishRef?.current)
        ? runtimeState.refs.fishRef.current
        : [];
    for (let i = fishList.length - 1; i >= 0; i -= 1) {
        const fish = fishList[i];
        if (!fish) continue;
        let hit = false;
        if (typeof fish.containsPoint === 'function') {
            try {
                hit = fish.containsPoint(x, y) === true;
            } catch (_) {
                hit = false;
            }
        } else {
            const head = resolveFishHeadPosition(fish);
            if (head) {
                const baseSize = Number(fish.baseSize);
                const hoverScale = Number(fish.hoverScale);
                const expressionScale = Number(fish.expressionProfile?.size?.effectiveScale);
                const bodySize = Math.max(
                    6,
                    (Number.isFinite(baseSize) ? baseSize : 16)
                        * (Number.isFinite(hoverScale) ? hoverScale : 1)
                        * (Number.isFinite(expressionScale) ? Math.min(1.18, Math.max(0.96, expressionScale)) : 1),
                );
                hit = Math.hypot(x - head.x, y - head.y) <= Math.max(10, bodySize * 0.9);
            }
        }
        if (!hit) continue;
        const uid = Number(fish.uid);
        const domain = typeof fish.domain === 'string' && fish.domain.trim()
            ? fish.domain.trim()
            : null;
        const interactionAction = typeof fish.interactionAction === 'string' && fish.interactionAction.trim()
            ? fish.interactionAction.trim()
            : null;
        // Decorative filler/control koi intentionally have no domain and should not
        // swallow hover/click hit-tests that belong to interactive site koi below.
        if (!domain && !interactionAction) continue;
        const presenceState = typeof fish.presenceState === 'string'
            ? fish.presenceState.trim().toLowerCase()
            : 'active';
        // Roster-exit fades are visual-only; they should not keep a removed domain
        // hoverable or selectable while the fish is fading out.
        if (presenceState === 'retiring') continue;
        return {
            uid: Number.isFinite(uid) ? uid : null,
            entityId: fish.entityId,
            domain,
            interactionAction,
        };
    }
    return null;
};

export const createZenPondWorkerControlInputHandlers = ({
    MESSAGE_TYPE,
    runtimeState,
    buildControlAck,
    respondResult,
} = {}) => {
    const handleInjectDebugSurfaceDisturbances = (
        id,
        payload,
    ) => {
        const fixtureId = typeof payload?.fixtureId === 'string'
            ? payload.fixtureId.trim()
            : '';
        if (!fixtureId) {
            throw new Error(
                'ZEN_POND_DEBUG_DISTURBANCE_FIXTURE_ID_REQUIRED',
            );
        }
        const fixtures = payload?.fixtures;
        if (
            !Array.isArray(fixtures)
            || fixtures.length === 0
            || fixtures.length > 24
        ) {
            throw new Error(
                'ZEN_POND_DEBUG_DISTURBANCE_FIXTURES_INVALID',
            );
        }
        const eventsRef =
            runtimeState.refs?.surfaceDisturbanceEventsRef;
        if (!eventsRef || !Array.isArray(eventsRef.current)) {
            throw new Error(
                'ZEN_SURFACE_DISTURBANCE_EVENT_REF_MISSING',
            );
        }
        const worldWidth = Math.max(
            1,
            Math.round(toFiniteNumber(runtimeState.width, 1)),
        );
        const worldHeight = Math.max(
            1,
            Math.round(toFiniteNumber(runtimeState.height, 1)),
        );
        const queued = fixtures.map((fixture, index) => {
            if (!isObject(fixture)) {
                throw new Error(
                    'ZEN_POND_DEBUG_DISTURBANCE_FIXTURE_INVALID:'
                    + index,
                );
            }
            const source = readZenSurfaceDisturbanceSource(
                fixture.source,
            );
            const normalizedX = Number(fixture.normalizedX);
            const normalizedY = Number(fixture.normalizedY);
            const impulse = Number(fixture.impulse);
            if (
                !Number.isFinite(normalizedX)
                || normalizedX < 0
                || normalizedX > 1
                || !Number.isFinite(normalizedY)
                || normalizedY < 0
                || normalizedY > 1
                || !Number.isFinite(impulse)
                || impulse < 0.2
                || impulse > 3
            ) {
                throw new Error(
                    'ZEN_POND_DEBUG_DISTURBANCE_FIXTURE_VALUE_INVALID:'
                    + index,
                );
            }
            return {
                x: normalizedX * worldWidth,
                y: normalizedY * worldHeight,
                impulse,
                source,
                debugFixtureId: fixtureId,
                debugFixtureIndex: index,
            };
        });
        eventsRef.current.push(...queued);
        respondResult(id, {
            fixtureId,
            queuedCount: queued.length,
            sources: queued.map((entry) => entry.source),
            ack: buildControlAck({
                payload: {
                    fixtureId,
                    queuedCount: queued.length,
                },
                channel:
                    MESSAGE_TYPE
                        .INJECT_DEBUG_SURFACE_DISTURBANCES,
                applied: true,
            }),
        });
    };

    const handleSetInputState = (id, payload) => {
        const previousLockedTarget = runtimeState.refs.lockedTargetRef.current;
        runtimeState.refs.invitationRegistrationEntityIdRef.current = normalizeZenPondRegistrationEntityId(
            Object.prototype.hasOwnProperty.call(payload, 'invitationRegistrationEntityId')
                ? payload.invitationRegistrationEntityId
                : null,
        );
        const pointerSpace = typeof payload?.pointerSpace === 'string'
            ? payload.pointerSpace
            : 'world';
        const pointer = mapInputPointerToWorld(runtimeState, payload?.pointer, pointerSpace);
        runtimeState.refs.mousePos.current = pointer
            ? {
                x: Number(pointer.x) || -1000,
                y: Number(pointer.y) || -1000,
            }
            : { x: -1000, y: -1000 };
        const hoveredHit = pointer
            ? findFishHitAtPoint(runtimeState, pointer, { interactionMode: 'hover' })
            : null;
        // External hover (e.g. the rhythm-band canopy) glints the matching koi
        // when the pointer itself is not over a fish. Pointer hit-tests win so
        // in-pond hover semantics stay unchanged.
        const externalHoverTarget = typeof payload?.hoverTarget === 'string' && payload.hoverTarget.trim()
            ? payload.hoverTarget.trim()
            : null;
        let hoveredDomain = hoveredHit?.domain || null;
        let nextHoveredFishUid = toOptionalUid(hoveredHit?.uid);
        if (!hoveredDomain && externalHoverTarget) {
            const fishList = Array.isArray(runtimeState?.refs?.fishRef?.current)
                ? runtimeState.refs.fishRef.current
                : [];
            const externallyHoveredFish = fishList.find((fish) => (
                fish
                && typeof fish.domain === 'string'
                && fish.domain === externalHoverTarget
                && (typeof fish.presenceState !== 'string'
                    || fish.presenceState.trim().toLowerCase() !== 'retiring')
            )) || null;
            if (externallyHoveredFish) {
                hoveredDomain = externalHoverTarget;
                nextHoveredFishUid = toOptionalUid(externallyHoveredFish.uid);
            }
        }
        runtimeState.refs.hoveredDomainRef.current = hoveredDomain;
        runtimeState.refs.hoveredFishUidRef.current = nextHoveredFishUid;
        runtimeState.refs.lockedTargetRef.current = typeof payload?.lockedTarget === 'string'
            ? payload.lockedTarget
            : null;

        const hasSelectedFishUidInput = Object.prototype.hasOwnProperty.call(payload || {}, 'selectedFishUid');
        if (hasSelectedFishUidInput) {
            runtimeState.refs.selectedFishUidRef.current = toOptionalUid(payload?.selectedFishUid);
        }

        const clickPulseTokenRaw = toOptionalFiniteNumber(payload?.clickPulseToken);
        const clickPulseToken = clickPulseTokenRaw !== null
            ? Math.max(0, Math.floor(clickPulseTokenRaw))
            : null;
        const prevClickPulseToken = Number(runtimeState.lastInputClickPulseToken);
        const nextClickPulseToken = Number.isFinite(prevClickPulseToken)
            ? Math.max(0, Math.floor(prevClickPulseToken))
            : 0;
        let clickDomain = null;
        let clickFishUid = null;
        let clickAction = null;
        let clickEntityId = null;
        const freshClick = clickPulseToken !== null && clickPulseToken > nextClickPulseToken;
        if (freshClick) {
            runtimeState.lastInputClickPulseToken = clickPulseToken;
            const clickPointerSpace = typeof payload?.clickPointerSpace === 'string'
                ? payload.clickPointerSpace
                : pointerSpace;
            const clickPointerInput = isObject(payload?.clickPointer)
                ? payload.clickPointer
                : payload?.pointer;
            const clickPointer = mapInputPointerToWorld(runtimeState, clickPointerInput, clickPointerSpace);
            if (clickPointer && Array.isArray(runtimeState.refs?.surfaceDisturbanceEventsRef?.current)) {
                runtimeState.refs.surfaceDisturbanceEventsRef.current.push({
                    x: Number(clickPointer.x) || 0,
                    y: Number(clickPointer.y) || 0,
                    impulse: 1.2,
                    source: ZEN_SURFACE_DISTURBANCE_SOURCES.TAP,
                });
            }
            const clickHit = clickPointer
                ? findFishHitAtPoint(runtimeState, clickPointer, { interactionMode: 'click' })
                : null;
            clickDomain = clickHit?.domain || null;
            clickFishUid = toOptionalUid(clickHit?.uid);
            clickAction = clickHit?.interactionAction || null;
            clickEntityId = clickHit?.entityId || null;
            // Consume this handoff on the next lock transition. The pointer
            // tap already supplied feedback; its controller echo must not tap twice.
            runtimeState.pendingInputClickLockDomain = clickDomain;
            runtimeState.refs.selectedFishUidRef.current = clickFishUid;
            if (clickPointer) {
                pushZenKoiInteractionStimulus(runtimeState.refs?.interactionStimuliRef, {
                    token: clickPulseToken,
                    x: Number(clickPointer.x) || 0,
                    y: Number(clickPointer.y) || 0,
                    clickedDomain: clickDomain,
                    clickedFishUid: clickFishUid,
                    strength: clickFishUid !== null ? 1 : 0.72,
                });
            }
        }

        const lockedTarget = runtimeState.refs.lockedTargetRef.current;
        if (lockedTarget !== previousLockedTarget) {
            const pointerClickEcho = runtimeState.pendingInputClickLockDomain === lockedTarget;
            runtimeState.pendingInputClickLockDomain = null;
            if (lockedTarget && !freshClick && !pointerClickEcho) {
                const fish = runtimeState.refs.fishRef.current.find(candidate => (
                    candidate?.domain === lockedTarget && candidate.presenceState !== 'retiring'
                ));
                if (fish) {
                    const head = fish.history?.[0];
                    const tail = fish.history?.[fish.history.length - 1];
                    if (!head || !tail || ![head.x, head.y, tail.x, tail.y].every(Number.isFinite)) {
                        throw new Error('ZEN_KOI_SELECTION_RIPPLE_POSE_INVALID');
                    }
                    runtimeState.refs.surfaceDisturbanceEventsRef.current.push({
                        x: (head.x + tail.x) / 2,
                        y: (head.y + tail.y) / 2,
                        impulse: 0.4,
                        source: ZEN_SURFACE_DISTURBANCE_SOURCES.TAP,
                        selectionCue: true,
                    });
                }
            }
        }

        respondResult(id, {
            pointer: runtimeState.refs.mousePos.current,
            hoverDomain: runtimeState.refs.hoveredDomainRef.current,
            hoveredFishUid: nextHoveredFishUid,
            hoverAction: hoveredHit?.interactionAction || null,
            lockedTarget: runtimeState.refs.lockedTargetRef.current,
            selectedFishUid: toOptionalUid(runtimeState.refs.selectedFishUidRef.current),
            clickPulseToken: runtimeState.lastInputClickPulseToken,
            clickDomain,
            clickFishUid,
            clickAction,
            clickEntityId,
            ack: buildControlAck({
                payload,
                channel: MESSAGE_TYPE.SET_INPUT_STATE,
                applied: true,
            }),
        });
    };

    const handleLandPetals = (id, payload) => {
        const result = applyZenPondPetalLandings(runtimeState, payload);
        respondResult(id, {
            ...result,
            ack: buildControlAck({ payload, channel: MESSAGE_TYPE.LAND_PETALS, applied: true }),
        });
    };

    return {
        handleLandPetals,
        handleInjectDebugSurfaceDisturbances,
        handleSetInputState,
    };
};
