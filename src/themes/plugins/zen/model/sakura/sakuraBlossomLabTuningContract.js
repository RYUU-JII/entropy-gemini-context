const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(value, 0, 1);
const clampInt = (value, min, max, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.round(numeric)));
};

export const SAKURA_BLOSSOM_LAB_TUNING_DEFS = Object.freeze({
    openness_bias: { min: -0.18, max: 0.18, step: 0.01, default: 0 },
    notch_depth_gain: { min: 0.7, max: 1.4, step: 0.01, default: 1 },
    warmth_bias: { min: -0.18, max: 0.18, step: 0.01, default: 0 },
});

export const DEFAULT_SAKURA_BLOSSOM_LAB_TUNING = Object.freeze(
    Object.entries(SAKURA_BLOSSOM_LAB_TUNING_DEFS).reduce((acc, [key, def]) => {
        acc[key] = def.default;
        return acc;
    }, {}),
);

export const sanitizeSakuraBlossomLabTuning = (value = {}) => (
    Object.entries(SAKURA_BLOSSOM_LAB_TUNING_DEFS).reduce((acc, [key, def]) => {
        const fallback = def.default;
        if (def.integer) {
            acc[key] = clampInt(value?.[key], def.min, def.max, fallback);
            return acc;
        }
        const numeric = Number(value?.[key]);
        acc[key] = Number.isFinite(numeric)
            ? Number(clamp(numeric, def.min, def.max).toFixed(3))
            : fallback;
        return acc;
    }, {})
);

export const applySakuraBlossomLabTuning = (
    blossom = {},
    tuning = DEFAULT_SAKURA_BLOSSOM_LAB_TUNING,
) => {
    const resolved = sanitizeSakuraBlossomLabTuning(tuning);
    return {
        ...blossom,
        openness: clamp01((Number(blossom?.openness) || 0.72) + resolved.openness_bias),
        notchDepth: clamp01((Number(blossom?.notchDepth) || 0.6) * resolved.notch_depth_gain),
        warmth: clamp01((Number(blossom?.warmth) || 0.5) + resolved.warmth_bias),
    };
};
