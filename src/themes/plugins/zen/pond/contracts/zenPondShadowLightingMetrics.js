const SHADOW_LIGHTING_FIELDS = Object.freeze([
    'directStrength', 'bottomVisibility', 'waterVisibility', 'alphaFactor',
]);

// A sample can be absent before the scene has rendered. A present sample must
// carry the exact canonical light/receiver response, never reconstructed weather.
export const readZenPondShadowLightingMetrics = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('ZEN_POND_SHADOW_LIGHTING_METRICS_INVALID');
    }
    const result = {};
    for (const field of SHADOW_LIGHTING_FIELDS) {
        const numeric = value[field];
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
            throw new Error(`ZEN_POND_SHADOW_LIGHTING_METRIC_INVALID:${field}`);
        }
        result[field] = Number(numeric.toFixed(5));
    }
    return result;
};
