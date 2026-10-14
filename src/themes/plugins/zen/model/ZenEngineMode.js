export const ZEN_ENGINE_MODE = Object.freeze({
    VNEXT: 'vnext',
});

export const resolveZenEngineMode = (value) => {
    if (value === ZEN_ENGINE_MODE.VNEXT) {
        return value;
    }
    throw new Error(`ZEN_ENGINE_MODE_INVALID:${value || 'missing'}`);
};

export const isVNextEngineMode = (value) => (
    resolveZenEngineMode(value) === ZEN_ENGINE_MODE.VNEXT
);
