const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export const resolveZenPetalViewportScale = (width, height) => {
    if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        throw new Error('ZEN_APP_PETAL_RATE_ENVIRONMENT_INVALID');
    }
    return clamp(Math.sqrt(width * height / (1440 * 900)), 0.65, 1.3);
};

const requireUnit = (value, field) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`ZEN_APP_PETAL_SOURCE_INVALID:${field}`);
    }
    return value;
};

// The Home publication describes available blossoms. This projection alone
// decides their app-wide supply; preview and mature bloom never add twice.
export const resolveZenAppPetalRate = ({ sourceSignal, width, height, windIntensity }) => {
    if (sourceSignal === null) return 0; // Explicit awaiting-source presentation state.
    const capacity = requireUnit(sourceSignal.petalCapacity, 'petalCapacity');
    const bloom = requireUnit(sourceSignal.bloomRatio, 'bloomRatio');
    const readiness = requireUnit(sourceSignal.petalFallLimit, 'petalFallLimit');
    const preview = requireUnit(sourceSignal.previewPetalRate, 'previewPetalRate');
    if (![width, height, windIntensity].every(Number.isFinite) || width <= 0 || height <= 0) {
        throw new Error('ZEN_APP_PETAL_RATE_ENVIRONMENT_INVALID');
    }
    // Home already folds visible flower availability into capacity and bloom.
    // Ease mature release through that signal's occupied range instead of
    // multiplying the same availability repeatedly. Early preview stays sparse.
    const previewSupply = preview * 0.42;
    const bloomProgress = clamp((bloom - 0.12) / 0.5, 0, 1);
    const bloomRelease = bloomProgress * bloomProgress * (3 - 2 * bloomProgress);
    const bloomSupply = capacity * (0.18 + 3.42 * bloomRelease) * (0.55 + readiness * 0.45);
    const areaScale = resolveZenPetalViewportScale(width, height);
    return Math.max(previewSupply, bloomSupply) * areaScale
        * (1 + clamp(windIntensity, 0, 1.6) * 0.12);
};
