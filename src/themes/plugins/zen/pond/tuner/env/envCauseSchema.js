export const ZEN_ENV_CAUSE_KEYS = Object.freeze([
    'envCloudiness',
    'envRainIntensity',
    'envWaterClarity',
]);

export const ZEN_ENV_CAUSE_KEY_SET = new Set(ZEN_ENV_CAUSE_KEYS);

export const ZEN_ENV_CAUSE_DEFAULTS = Object.freeze({
    envCloudiness: 0.38,
    envRainIntensity: 0,
    envWaterClarity: 0.64,
});

const isPlainObject = (value) => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
};

export const isZenEnvCauseKey = (key) => {
    return ZEN_ENV_CAUSE_KEY_SET.has(key);
};

export const pickZenEnvCausePatch = (patch = null) => {
    if (!isPlainObject(patch)) return {};
    const nextPatch = {};
    const keys = Object.keys(patch);
    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (!isZenEnvCauseKey(key)) continue;
        const value = patch[key];
        if (value === undefined) continue;
        nextPatch[key] = value;
    }
    return nextPatch;
};
