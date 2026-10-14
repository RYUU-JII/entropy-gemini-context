export function clamp(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
}

export function isFinitePositive(n) {
    return Number.isFinite(n) && n > 0;
}

export function formatSeconds(sec) {
    const s = Math.max(0, Math.ceil(sec || 0));
    if (s >= 60) {
        const m = Math.floor(s / 60);
        const r = s % 60;
        return r ? `${m}m ${r}s` : `${m}m`;
    }
    return `${s}s`;
}

export function formatRingTime(sec) {
    const s = Math.max(0, Math.ceil(sec || 0));
    if (s >= 60) {
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${String(r).padStart(2, '0')}`;
    }
    return `${s}s`;
}
