import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useZenInteractionStore } from '../../state/stores/index.js';
import { normalizeZenKoiInvitationEntityIds } from '../../roster/zenKoiInvitationSlots.js';

const normalizeDomain = (candidate) => {
    if (typeof candidate !== 'string') return null;
    const normalized = candidate.trim();
    return normalized || null;
};

const useZenInteractionController = ({
    width = 0,
    height = 0,
    lockedTarget = null,
    onLockTarget,
    onInputStateChanged = null,
    onInteractionAction = null,
} = {}) => {
    const mousePos = useRef({ x: -100, y: -100 });
    const [hoveredAction, setHoveredAction] = useState(null);
    const [invitationEntityIds, setInvitationEntityIds] = useState([]);
    const pointerBoundsCacheRef = useRef({
        host: null,
        rect: null,
        frameId: null,
    });
    const clickPulseRef = useRef({ token: 0, x: -100, y: -100 });
    const {
        hoveredDomain,
        externalHoverDomain,
        pressureRailInteractionActive,
        selectedFishUid,
        selectedFishIntentUid,
        setHoveredDomain,
        setSelectedFishUid,
        setSelectedFishIntentUid,
    } = useZenInteractionStore(useShallow((state) => ({
        hoveredDomain: state.hoveredDomain,
        externalHoverDomain: state.externalHoverDomain,
        pressureRailInteractionActive: state.pressureRailInteractionActive,
        selectedFishUid: state.selectedFishUid,
        selectedFishIntentUid: state.selectedFishIntentUid,
        setHoveredDomain: state.setHoveredDomain,
        setSelectedFishUid: state.setSelectedFishUid,
        setSelectedFishIntentUid: state.setSelectedFishIntentUid,
    })));

    const lastHandledClickPulseTokenRef = useRef(0);

    const readPointerBounds = useCallback((host) => {
        if (!host || typeof host.getBoundingClientRect !== 'function') return null;
        const cache = pointerBoundsCacheRef.current;
        if (cache.host === host && cache.rect) return cache.rect;

        const rect = host.getBoundingClientRect();
        cache.host = host;
        cache.rect = rect;
        if (
            typeof window !== 'undefined'
            && typeof window.requestAnimationFrame === 'function'
            && cache.frameId === null
        ) {
            cache.frameId = window.requestAnimationFrame(() => {
                cache.host = null;
                cache.rect = null;
                cache.frameId = null;
            });
        }
        return rect;
    }, []);

    const resolveWorldPointerFromEvent = useCallback((event) => {
        const host = event?.currentTarget;
        if (!host || !width || !height) return null;
        const rect = readPointerBounds(host);
        if (!rect || !rect.width || !rect.height) return null;
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }, [height, readPointerBounds, width]);

    const handleWorkerInteractionFeedback = useCallback((feedback = null) => {
        if (feedback?.kind === 'invitation_membership') {
            setInvitationEntityIds(normalizeZenKoiInvitationEntityIds(feedback.entityIds));
            return;
        }
        const nextHoverDomain = typeof feedback?.hoverDomain === 'string' && feedback.hoverDomain
            ? feedback.hoverDomain
            : null;
        setHoveredDomain(nextHoverDomain);
        setHoveredAction(feedback?.hoverAction === 'register_protected_site' ? feedback.hoverAction : null);

        const selectedFishUidCandidate = Number(feedback?.selectedFishUid);
        let nextSelectedFishUid = Number.isFinite(selectedFishUidCandidate) && selectedFishUidCandidate > 0
            ? Math.floor(selectedFishUidCandidate)
            : null;

        const clickPulseTokenCandidate = Number(feedback?.clickPulseToken);
        const clickPulseToken = Number.isFinite(clickPulseTokenCandidate)
            ? Math.max(0, Math.floor(clickPulseTokenCandidate))
            : null;
        if (clickPulseToken !== null && clickPulseToken > lastHandledClickPulseTokenRef.current) {
            lastHandledClickPulseTokenRef.current = clickPulseToken;
            const clickAction = typeof feedback?.clickAction === 'string' && feedback.clickAction.trim()
                ? feedback.clickAction.trim()
                : null;
            if (clickAction && typeof onInteractionAction === 'function') {
                setSelectedFishIntentUid(null);
                onInteractionAction(clickAction, { entityId: feedback.clickEntityId });
                setSelectedFishUid(nextSelectedFishUid);
                return;
            }
            const clickDomain = normalizeDomain(feedback?.clickDomain);
            const normalizedLockedTarget = normalizeDomain(lockedTarget);
            const shouldReleaseLockedFish = !!clickDomain && clickDomain === normalizedLockedTarget;
            const nextLockTarget = shouldReleaseLockedFish ? null : clickDomain;
            if (shouldReleaseLockedFish) {
                nextSelectedFishUid = null;
                setSelectedFishIntentUid(null);
            } else if (clickDomain) {
                setSelectedFishIntentUid(undefined);
            }
            // A click on a fish locks it; a click on empty water releases the
            // current lock so the focus glow fades out naturally. Clicking the
            // already locked fish toggles the same canonical lock off.
            if (typeof onLockTarget === 'function') {
                onLockTarget(nextLockTarget);
            }
        }
        setSelectedFishUid(nextSelectedFishUid);
    }, [
        lockedTarget,
        onInteractionAction,
        onLockTarget,
        setHoveredDomain,
        setSelectedFishIntentUid,
        setSelectedFishUid,
    ]);

    const handlePointerMove = useCallback((event) => {
        const worldPointer = resolveWorldPointerFromEvent(event);
        if (!worldPointer) {
            const resetPointer = { x: -100, y: -100 };
            mousePos.current = resetPointer;
            setHoveredDomain(null);
            setHoveredAction(null);
            if (typeof onInputStateChanged === 'function') {
                onInputStateChanged({ force: false });
            }
            return;
        }
        const { x, y } = worldPointer;
        const nextPointer = { x, y };
        mousePos.current = nextPointer;
        if (typeof onInputStateChanged === 'function') {
            onInputStateChanged({ force: false });
        }
    }, [
        onInputStateChanged,
        resolveWorldPointerFromEvent,
        setHoveredDomain,
    ]);

    const handlePointerDown = useCallback((event) => {
        if (event.button > 0 || event.isPrimary === false) return;
        const worldPointer = resolveWorldPointerFromEvent(event);
        if (!worldPointer) return;
        const { x, y } = worldPointer;
        const nextPointer = { x, y };
        mousePos.current = nextPointer;
        const prevToken = Number(clickPulseRef.current?.token);
        const nextToken = Number.isFinite(prevToken) ? (prevToken + 1) : 1;
        clickPulseRef.current = { token: nextToken, x, y };
        if (typeof onInputStateChanged === 'function') {
            onInputStateChanged({ force: true });
        }
    }, [onInputStateChanged, resolveWorldPointerFromEvent]);

    const handlePointerLeave = useCallback(() => {
        const resetPointer = { x: -100, y: -100 };
        mousePos.current = resetPointer;
        setHoveredDomain(null);
        setHoveredAction(null);
        if (typeof onInputStateChanged === 'function') {
            onInputStateChanged({ force: true });
        }
    }, [onInputStateChanged, setHoveredDomain]);

    // A domain lock and the worker-local fish uid are one visual selection.
    // Releasing only the lock leaves the renderer's `localSelected` glow alive.
    const clearSelectedFishSelection = useCallback(() => {
        setSelectedFishUid(null);
        setSelectedFishIntentUid(null);
    }, [setSelectedFishIntentUid, setSelectedFishUid]);

    const resetInteractionState = useCallback(() => {
        const resetPointer = { x: -100, y: -100 };
        mousePos.current = resetPointer;
        setHoveredDomain(null);
        setHoveredAction(null);
        setSelectedFishUid(null);
        setSelectedFishIntentUid(undefined);
        clickPulseRef.current = { token: 0, x: -100, y: -100 };
        lastHandledClickPulseTokenRef.current = 0;
        if (typeof onInputStateChanged === 'function') {
            onInputStateChanged({ force: true });
        }
    }, [
        onInputStateChanged,
        setHoveredDomain,
        setSelectedFishIntentUid,
        setSelectedFishUid,
    ]);

    useEffect(() => () => {
        const cache = pointerBoundsCacheRef.current;
        if (
            cache.frameId !== null
            && typeof window !== 'undefined'
            && typeof window.cancelAnimationFrame === 'function'
        ) {
            window.cancelAnimationFrame(cache.frameId);
        }
        cache.host = null;
        cache.rect = null;
        cache.frameId = null;
    }, []);

    return {
        mousePos,
        clickPulseRef,
        hoveredDomain,
        hoveredAction,
        invitationEntityIds,
        externalHoverDomain,
        pressureRailInteractionActive,
        selectedFishUid,
        selectedFishIntentUid,
        handlePointerMove,
        handlePointerDown,
        handlePointerLeave,
        handleWorkerInteractionFeedback,
        clearSelectedFishSelection,
        resetInteractionState,
    };
};

export {
    useZenInteractionController,
};
