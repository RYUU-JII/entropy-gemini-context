export const hashStringFNV1a = (value = '') => {
    const text = String(value ?? '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

export const mulberry32 = (seed = 0) => {
    let state = Number(seed) >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
};

export const createZenSeededRandom = (...seedParts) => (
    mulberry32(hashStringFNV1a(seedParts.map((part) => String(part ?? '')).join('|')))
);

export const sampleZenRange = (rng, min, max) => {
    const random = typeof rng === 'function' ? rng : Math.random;
    return min + ((max - min) * random());
};

export const pickZenIndex = (rng, length) => {
    const size = Math.max(0, Math.floor(Number(length) || 0));
    if (size <= 1) return 0;
    const random = typeof rng === 'function' ? rng : Math.random;
    return Math.min(size - 1, Math.floor(random() * size));
};
