const flattenTuning = (source, target) => {
    Object.keys(source || {}).forEach((key) => {
        const value = source[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            flattenTuning(value, target);
            return;
        }
        target[key] = value;
    });
};

export const flattenTuningForClipboard = (tuning) => {
    const flat = {};
    flattenTuning(tuning || {}, flat);
    return flat;
};
