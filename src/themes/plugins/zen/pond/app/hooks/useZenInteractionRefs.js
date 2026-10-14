import { useCallback, useRef } from 'react';

const createPointerResetPosition = () => ({ x: -100, y: -100 });

const useZenInteractionRefs = ({
    lockedTarget = null,
    hoverTarget = null,
    selectedFishIntentUid = undefined,
    invitationRegistrationEntityId = null,
    tuning = null,
    waterPalette = null,
    mousePosRef = null,
} = {}) => {
    const internalMousePosRef = useRef(createPointerResetPosition());
    const mousePos = (mousePosRef && typeof mousePosRef === 'object')
        ? mousePosRef
        : internalMousePosRef;
    const lockedTargetRef = useRef(lockedTarget);
    const hoverTargetRef = useRef(hoverTarget);
    const selectedFishIntentUidRef = useRef(selectedFishIntentUid);
    const invitationRegistrationEntityIdRef = useRef(invitationRegistrationEntityId);
    const tuningRef = useRef(tuning);
    const waterPaletteRef = useRef(waterPalette);

    lockedTargetRef.current = lockedTarget;
    hoverTargetRef.current = hoverTarget;
    selectedFishIntentUidRef.current = selectedFishIntentUid;
    invitationRegistrationEntityIdRef.current = invitationRegistrationEntityId;
    tuningRef.current = tuning;
    waterPaletteRef.current = waterPalette;

    const resetControlInputState = useCallback(() => {
        mousePos.current = createPointerResetPosition();
    }, [mousePos]);

    return {
        mousePos,
        lockedTargetRef,
        hoverTargetRef,
        selectedFishIntentUidRef,
        invitationRegistrationEntityIdRef,
        tuningRef,
        waterPaletteRef,
        resetControlInputState,
    };
};

export {
    useZenInteractionRefs,
};
