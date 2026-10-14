export const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

export const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

export const roundNumber = (value, digits = 2, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Number(numeric.toFixed(digits));
};

export const toOptionalFiniteNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

export const toOptionalUid = (value) => {
    const numeric = toOptionalFiniteNumber(value);
    if (numeric === null) return null;
    const uid = Math.floor(numeric);
    return uid > 0 ? uid : null;
};

export const nowPerfMs = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
};
