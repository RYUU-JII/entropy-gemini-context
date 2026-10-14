export const nextRandom = (rng = null, decisionType = 'random') => {
    if (typeof rng?.next === 'function') {
        const value = Number(rng.next(decisionType));
        if (Number.isFinite(value)) {
            return value;
        }
    }
    // Canonical path must stay deterministic under CRN.
    return 0.5;
};
