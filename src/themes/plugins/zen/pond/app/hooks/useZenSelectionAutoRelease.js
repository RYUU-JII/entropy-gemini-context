import { useEffect, useRef } from 'react';

export const ZEN_SELECTION_IDLE_RELEASE_MS = 8000;

// One timeout after actual koi/selection-control engagement ends. Ordinary
// pond pointer movement is unrelated to selection and never touches this timer.
const useZenSelectionAutoRelease = ({
    lockedTarget = null,
    interactionActive = false,
    onRelease = null,
    idleMs = ZEN_SELECTION_IDLE_RELEASE_MS,
} = {}) => {
    const onReleaseRef = useRef(onRelease);
    onReleaseRef.current = onRelease;

    useEffect(() => {
        if (typeof window === 'undefined' || !lockedTarget || interactionActive) return undefined;
        const delay = Number(idleMs) > 0 ? Number(idleMs) : ZEN_SELECTION_IDLE_RELEASE_MS;
        const timer = window.setTimeout(() => {
            const release = onReleaseRef.current;
            if (typeof release === 'function') release();
        }, delay);
        return () => window.clearTimeout(timer);
    }, [idleMs, interactionActive, lockedTarget]);
};

export {
    useZenSelectionAutoRelease,
};
