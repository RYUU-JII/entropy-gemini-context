export const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export const round = (value, digits = 3) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

export const toDisplayLabel = (key) => String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (text) => text.toUpperCase());

export const mean = (values = []) => {
    const finite = values.filter((value) => Number.isFinite(value));
    if (!finite.length) {
        return 0;
    }
    return finite.reduce((acc, value) => acc + value, 0) / finite.length;
};

export const stdDev = (values = []) => {
    const finite = values.filter((value) => Number.isFinite(value));
    if (!finite.length) {
        return 0;
    }
    const avg = mean(finite);
    const variance = finite.reduce((acc, value) => {
        const diff = value - avg;
        return acc + (diff * diff);
    }, 0) / finite.length;
    return Math.sqrt(Math.max(0, variance));
};

export const quantile = (values = [], q = 0.5, fallback = 0) => {
    const finite = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (!finite.length) {
        return fallback;
    }
    const safeQ = clamp(Number(q), 0, 1);
    const index = (finite.length - 1) * safeQ;
    const lower = Math.floor(index);
    const upper = Math.min(finite.length - 1, lower + 1);
    const ratio = index - lower;
    return finite[lower] + ((finite[upper] - finite[lower]) * ratio);
};

export const pearsonCorrelation = (xs = [], ys = []) => {
    const points = [];
    const len = Math.min(xs.length, ys.length);
    for (let index = 0; index < len; index += 1) {
        const x = Number(xs[index]);
        const y = Number(ys[index]);
        if (Number.isFinite(x) && Number.isFinite(y)) {
            points.push({ x, y });
        }
    }
    if (points.length < 2) {
        return 0;
    }
    const xMean = points.reduce((acc, point) => acc + point.x, 0) / points.length;
    const yMean = points.reduce((acc, point) => acc + point.y, 0) / points.length;
    let numerator = 0;
    let xNorm = 0;
    let yNorm = 0;
    for (let index = 0; index < points.length; index += 1) {
        const dx = points[index].x - xMean;
        const dy = points[index].y - yMean;
        numerator += dx * dy;
        xNorm += dx * dx;
        yNorm += dy * dy;
    }
    const denom = Math.sqrt(xNorm * yNorm);
    if (denom <= 1e-9) {
        return 0;
    }
    return numerator / denom;
};

export const formatPercent = (value, digits = 0) => {
    const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
    return `${(numeric * 100).toFixed(digits)}%`;
};
