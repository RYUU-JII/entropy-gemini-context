const DEFAULT_DRIFT_WRAP_SPAN = 16384;

const toFinite = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

export const accumulateBoundedDrift = (
    current,
    delta,
    wrapSpan = DEFAULT_DRIFT_WRAP_SPAN,
) => {
    const safeCurrent = toFinite(current, 0);
    const safeDelta = toFinite(delta, 0);
    const safeSpan = Math.max(64, toFinite(wrapSpan, DEFAULT_DRIFT_WRAP_SPAN));
    const period = safeSpan * 2;
    let next = safeCurrent + safeDelta;
    if (!Number.isFinite(next)) next = 0;
    if (next > safeSpan || next < -safeSpan) {
        next %= period;
        if (next > safeSpan) {
            next -= period;
        } else if (next < -safeSpan) {
            next += period;
        }
    }
    return next;
};

export const normalizeBoundedDrift = (
    value,
    wrapSpan = DEFAULT_DRIFT_WRAP_SPAN,
) => {
    return accumulateBoundedDrift(0, value, wrapSpan);
};

export const resolveDriftWrapSpan = (baseSpan = DEFAULT_DRIFT_WRAP_SPAN, scale = 1) => {
    const safeBase = Math.max(64, toFinite(baseSpan, DEFAULT_DRIFT_WRAP_SPAN));
    const safeScale = Math.max(0.25, Math.min(8, toFinite(scale, 1)));
    return Math.max(64, Math.round(safeBase * safeScale));
};
