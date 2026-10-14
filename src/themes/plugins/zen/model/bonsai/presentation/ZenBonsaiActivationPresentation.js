export const ZEN_BONSAI_ACTIVATION_PRESENTATION_BANDS = Object.freeze({
    LOW: 'low',
    STEADY: 'steady',
    HIGH: 'high',
});

const BAND_VALUES = new Set(Object.values(ZEN_BONSAI_ACTIVATION_PRESENTATION_BANDS));
const LOW_BAND_CEILING = 0.42;
const HIGH_BAND_FLOOR = 0.82;
const BAKE_SIGNAL_STEP = 0.1;

const requireRatio = (value, code) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(code);
    }
    return Number(value.toFixed(4));
};

export const resolveZenBonsaiActivationPresentationSignal = ({
    ratio,
    reliability,
} = {}) => {
    const normalizedRatio = requireRatio(
        ratio,
        'ZEN_BONSAI_ACTIVATION_PRESENTATION_RATIO_INVALID',
    );
    const normalizedReliability = requireRatio(
        reliability,
        'ZEN_BONSAI_ACTIVATION_PRESENTATION_RELIABILITY_INVALID',
    );
    const trust = 0.58 + (normalizedReliability * 0.42);
    return Number((0.5 + ((normalizedRatio - 0.5) * trust)).toFixed(4));
};

export const resolveZenBonsaiActivationPresentationBand = (ratio, reliability = 1) => {
    const normalized = requireRatio(
        ratio,
        'ZEN_BONSAI_ACTIVATION_PRESENTATION_RATIO_INVALID',
    );
    const normalizedReliability = requireRatio(
        reliability,
        'ZEN_BONSAI_ACTIVATION_PRESENTATION_RELIABILITY_INVALID',
    );
    const expressed = resolveZenBonsaiActivationPresentationSignal({
        ratio: normalized,
        reliability: normalizedReliability,
    });
    if (expressed <= LOW_BAND_CEILING) {
        return ZEN_BONSAI_ACTIVATION_PRESENTATION_BANDS.LOW;
    }
    if (expressed >= HIGH_BAND_FLOOR) {
        return ZEN_BONSAI_ACTIVATION_PRESENTATION_BANDS.HIGH;
    }
    return ZEN_BONSAI_ACTIVATION_PRESENTATION_BANDS.STEADY;
};

export const createZenBonsaiActivationPresentation = ({
    ratio,
    reliability,
} = {}) => {
    const normalizedRatio = requireRatio(
        ratio,
        'ZEN_BONSAI_ACTIVATION_PRESENTATION_RATIO_INVALID',
    );
    const normalizedReliability = requireRatio(
        reliability,
        'ZEN_BONSAI_ACTIVATION_PRESENTATION_RELIABILITY_INVALID',
    );
    return Object.freeze({
        ratio: normalizedRatio,
        band: resolveZenBonsaiActivationPresentationBand(
            normalizedRatio,
            normalizedReliability,
        ),
        reliability: normalizedReliability,
    });
};

export const normalizeZenBonsaiActivationPresentation = (candidate = null) => {
    if (candidate === null || candidate === undefined) {
        return null;
    }
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new Error('ZEN_BONSAI_ACTIVATION_PRESENTATION_INVALID');
    }
    if (!BAND_VALUES.has(candidate.band)) {
        throw new Error('ZEN_BONSAI_ACTIVATION_PRESENTATION_BAND_INVALID');
    }
    const normalized = createZenBonsaiActivationPresentation({
        ratio: candidate.ratio,
        reliability: candidate.reliability,
    });
    if (candidate.band !== normalized.band) {
        throw new Error('ZEN_BONSAI_ACTIVATION_PRESENTATION_BAND_MISMATCH');
    }
    return normalized;
};

export const resolveZenBonsaiActivationBakeSignal = (candidate = null) => {
    const activation = normalizeZenBonsaiActivationPresentation(candidate);
    if (!activation) {
        return null;
    }
    const signal = resolveZenBonsaiActivationPresentationSignal(activation);
    return Number(
        (Math.round(signal / BAKE_SIGNAL_STEP) * BAKE_SIGNAL_STEP).toFixed(1),
    );
};

export const resolveZenBonsaiActivationBakePresentation = (candidate = null) => {
    const bakeSignal = resolveZenBonsaiActivationBakeSignal(candidate);
    if (bakeSignal === null) {
        return null;
    }
    return createZenBonsaiActivationPresentation({
        ratio: bakeSignal,
        reliability: 1,
    });
};

export default createZenBonsaiActivationPresentation;
