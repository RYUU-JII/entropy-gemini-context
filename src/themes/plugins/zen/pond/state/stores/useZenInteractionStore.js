import { create } from 'zustand';

const normalizeDomain = (candidate) => {
    if (typeof candidate !== 'string') return null;
    const normalized = candidate.trim();
    return normalized || null;
};

const normalizeSelectedFishUid = (candidate) => {
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed)) return null;
    const uid = Math.floor(parsed);
    return uid > 0 ? uid : null;
};

const normalizeSelectedFishIntentUid = (candidate) => {
    if (candidate === undefined) return undefined;
    if (candidate === null || candidate === '') return null;
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed)) return undefined;
    const uid = Math.floor(parsed);
    return uid > 0 ? uid : null;
};

const normalizePointer = (candidate) => {
    if (!candidate || typeof candidate !== 'object') return { x: -100, y: -100 };
    const x = Number(candidate.x);
    const y = Number(candidate.y);
    return {
        x: Number.isFinite(x) ? x : -100,
        y: Number.isFinite(y) ? y : -100,
    };
};

const useZenInteractionStore = create((set, get) => ({
    lockedTarget: null,
    hoveredDomain: null,
    // Hover intent originating OUTSIDE the pond canvas (e.g. the rhythm-band
    // share canopy). Kept separate from hoveredDomain: the worker's pointer
    // hit-test remains the sole author of hoveredDomain, so echoing external
    // hover into the worker cannot wedge a stale pond hover open.
    externalHoverDomain: null,
    // Rail/readout pointer or keyboard engagement, including the non-site
    // remainder. Separate from the domain channel that lights a matching koi.
    pressureRailInteractionActive: false,
    selectedFishUid: null,
    selectedFishIntentUid: undefined,
    pointer: { x: -100, y: -100 },

    setLockedTarget: (candidate) => {
        const next = normalizeDomain(candidate);
        if (get().lockedTarget === next) return next;
        set({ lockedTarget: next });
        return next;
    },

    setHoveredDomain: (candidate) => {
        const next = normalizeDomain(candidate);
        if (get().hoveredDomain === next) return next;
        set({ hoveredDomain: next });
        return next;
    },

    setExternalHoverDomain: (candidate) => {
        const next = normalizeDomain(candidate);
        if (get().externalHoverDomain === next) return next;
        set({ externalHoverDomain: next });
        return next;
    },

    setPressureRailInteractionActive: (active) => {
        const next = active === true;
        if (get().pressureRailInteractionActive === next) return next;
        set({ pressureRailInteractionActive: next });
        return next;
    },

    setSelectedFishUid: (candidate) => {
        const next = normalizeSelectedFishUid(candidate);
        if (get().selectedFishUid === next) return next;
        set({ selectedFishUid: next });
        return next;
    },

    setSelectedFishIntentUid: (candidate) => {
        const next = normalizeSelectedFishIntentUid(candidate);
        if (get().selectedFishIntentUid === next) return next;
        set({ selectedFishIntentUid: next });
        return next;
    },

    setPointer: (candidate) => {
        const next = normalizePointer(candidate);
        const prev = get().pointer;
        if (prev.x === next.x && prev.y === next.y) return next;
        set({ pointer: next });
        return next;
    },

    resetInteraction: () => {
        set({
            hoveredDomain: null,
            externalHoverDomain: null,
            pressureRailInteractionActive: false,
            selectedFishUid: null,
            selectedFishIntentUid: undefined,
            pointer: { x: -100, y: -100 },
        });
    },
}));

export {
    useZenInteractionStore,
};
