export const destroyWaterEffectsDisplayObjects = (displayObjects = []) => {
    const seen = new Set();
    for (let i = 0; i < displayObjects.length; i += 1) {
        const node = displayObjects[i];
        if (!node || seen.has(node)) continue;
        seen.add(node);
        try {
            node.parent?.removeChild(node);
            node.destroy?.();
        } catch (_) {
            // Best-effort cleanup only.
        }
    }
};

export const buildTemporalStateSnapshot = ({
    frame = 0,
    bootElapsedMs = 0,
    atmosphereDriftState = null,
    toFinite,
} = {}) => ({
    frame,
    bootElapsedMs,
    atmosphereDriftState: {
        x: toFinite(atmosphereDriftState?.x, 0),
        y: toFinite(atmosphereDriftState?.y, 0),
    },
});

export const applyTemporalStateSnapshot = ({
    nextState = null,
    frame = 0,
    bootElapsedMs = 0,
    atmosphereDriftState = null,
    toFinite,
} = {}) => {
    let nextFrame = frame;
    let nextBootElapsedMs = bootElapsedMs;
    if (!nextState || typeof nextState !== 'object') {
        return { frame: nextFrame, bootElapsedMs: nextBootElapsedMs };
    }
    nextFrame = Math.max(0, toFinite(nextState.frame, nextFrame));
    nextBootElapsedMs = Math.max(0, toFinite(nextState.bootElapsedMs, nextBootElapsedMs));
    const nextAtmosphereDrift = nextState.atmosphereDriftState;
    if (nextAtmosphereDrift && typeof nextAtmosphereDrift === 'object' && atmosphereDriftState) {
        atmosphereDriftState.x = toFinite(nextAtmosphereDrift.x, atmosphereDriftState.x);
        atmosphereDriftState.y = toFinite(nextAtmosphereDrift.y, atmosphereDriftState.y);
    }
    return { frame: nextFrame, bootElapsedMs: nextBootElapsedMs };
};
