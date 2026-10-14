export const ZEN_KOI_EXPRESSION_PROFILE_SCHEMA_VERSION = 1;
export const ZEN_KOI_EXPRESSION_PROFILE_BASIS = 'rolling-pressure-expression-v1';

export const ZEN_KOI_PRESSURE_SIZE_CLASS = Object.freeze({
    STANDARD: 'standard',
    LARGE: 'large',
    DOMINANT: 'dominant',
});

const MINUTE_MS = 60_000;
const PROMOTION_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const DEMOTION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const PRESSURE_RENDER_SCALE_MIN = 0.985;
const PRESSURE_RENDER_SCALE_MAX = 1.045;
const EFFECTIVE_VISUAL_SCALE_MIN = 0.96;
const EFFECTIVE_VISUAL_SCALE_MAX = 1.18;

const SIZE_CLASS_SCALE = Object.freeze({
    [ZEN_KOI_PRESSURE_SIZE_CLASS.STANDARD]: 1,
    [ZEN_KOI_PRESSURE_SIZE_CLASS.LARGE]: 1.06,
    [ZEN_KOI_PRESSURE_SIZE_CLASS.DOMINANT]: 1.12,
});

const SIZE_CLASS_RENDER_BANDS = Object.freeze({
    [ZEN_KOI_PRESSURE_SIZE_CLASS.STANDARD]: Object.freeze({ min: 0, max: 0.58 }),
    [ZEN_KOI_PRESSURE_SIZE_CLASS.LARGE]: Object.freeze({ min: 0.42, max: 0.84 }),
    [ZEN_KOI_PRESSURE_SIZE_CLASS.DOMINANT]: Object.freeze({ min: 0.68, max: 1 }),
});

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const roundNumber = (value, digits = 4, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Number(numeric.toFixed(digits));
};

const smoothstep = (edge0, edge1, value) => {
    if (edge0 === edge1) return value >= edge1 ? 1 : 0;
    const t = clampNumber((value - edge0) / (edge1 - edge0), 0, 1, 0);
    return t * t * (3 - (2 * t));
};

const lerp = (start, end, alpha) => start + ((end - start) * alpha);

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const isFiniteInput = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && !value.trim()) return false;
    return Number.isFinite(Number(value));
};

export const normalizeZenKoiPressureSizeClass = (value) => {
    if (typeof value !== 'string') return ZEN_KOI_PRESSURE_SIZE_CLASS.STANDARD;
    const normalized = value.trim().toLowerCase();
    return normalized === ZEN_KOI_PRESSURE_SIZE_CLASS.LARGE
        || normalized === ZEN_KOI_PRESSURE_SIZE_CLASS.DOMINANT
        || normalized === ZEN_KOI_PRESSURE_SIZE_CLASS.STANDARD
        ? normalized
        : ZEN_KOI_PRESSURE_SIZE_CLASS.STANDARD;
};

const resolveRankSignal = (pressureRank) => {
    const rank = Math.max(0, Math.floor(Number(pressureRank) || 0));
    if (rank === 1) return 1;
    if (rank === 2) return 0.7;
    if (rank === 3) return 0.45;
    if (rank >= 4 && rank <= 6) return 0.2;
    return 0;
};

const resolvePressureInputs = (candidate = null) => {
    if (candidate?.hasPressureInput === false) {
        return {
            weightedPressureMs: 0,
            weightedMinutes: 0,
            pressureShare: 0,
            pressureRank: null,
            absolute01: 0,
            share01: 0,
            rank01: 0,
            pressureMass01: 0,
            hasPressureInput: false,
        };
    }
    const hasPressureInput = isFiniteInput(candidate?.weightedPressureMs)
        || isFiniteInput(candidate?.pressureShare)
        || isFiniteInput(candidate?.pressureRank);
    if (!hasPressureInput) {
        return {
            weightedPressureMs: 0,
            weightedMinutes: 0,
            pressureShare: 0,
            pressureRank: null,
            absolute01: 0,
            share01: 0,
            rank01: 0,
            pressureMass01: 0,
            hasPressureInput: false,
        };
    }
    const weightedPressureMs = Math.max(0, Number(candidate?.weightedPressureMs) || 0);
    const weightedMinutes = weightedPressureMs / MINUTE_MS;
    const pressureShare = clampNumber(candidate?.pressureShare, 0, 1, 0);
    const pressureRank = isFiniteInput(candidate?.pressureRank)
        ? Math.max(1, Math.floor(Number(candidate.pressureRank)))
        : null;
    const absolute01 = smoothstep(30, 360, weightedMinutes);
    const share01 = smoothstep(0.08, 0.35, pressureShare);
    const rank01 = resolveRankSignal(pressureRank);
    const pressureMass01 = clampNumber(
        (absolute01 * 0.72) + (share01 * 0.2) + (rank01 * 0.08),
        0,
        1,
        0,
    );
    return {
        weightedPressureMs,
        weightedMinutes,
        pressureShare,
        pressureRank,
        absolute01,
        share01,
        rank01,
        pressureMass01,
        hasPressureInput: true,
    };
};

const isLargeEnter = ({ pressureMass01, weightedMinutes }) => (
    pressureMass01 >= 0.58 && weightedMinutes >= 120
);

const isLargeRelease = ({ pressureMass01, weightedMinutes }) => (
    pressureMass01 < 0.42 || weightedMinutes < 90
);

const isDominantEnter = ({ pressureMass01, weightedMinutes }) => (
    (pressureMass01 >= 0.84 && weightedMinutes >= 300)
    || weightedMinutes >= 480
);

const isDominantRelease = ({ pressureMass01, weightedMinutes }) => (
    pressureMass01 < 0.68 && weightedMinutes < 360
);

const resolveImmediateSizeClass = (pressureInputs) => {
    if (isDominantEnter(pressureInputs)) return ZEN_KOI_PRESSURE_SIZE_CLASS.DOMINANT;
    if (isLargeEnter(pressureInputs)) return ZEN_KOI_PRESSURE_SIZE_CLASS.LARGE;
    return ZEN_KOI_PRESSURE_SIZE_CLASS.STANDARD;
};

const resolveSizeClassTransition = ({
    pressureInputs,
    previousExpressionProfile = null,
    nowMs = Date.now(),
} = {}) => {
    const safeNowMs = Math.max(0, Math.trunc(Number(nowMs) || Date.now()));
    const previousSize = isObject(previousExpressionProfile?.size)
        ? previousExpressionProfile.size
        : null;
    const previousClass = previousSize
        ? normalizeZenKoiPressureSizeClass(previousSize.pressureSizeClass)
        : null;
    const previousChangedAtMs = Number.isFinite(Number(previousExpressionProfile?.transition?.changedAtMs))
        ? Math.max(0, Math.trunc(Number(previousExpressionProfile.transition.changedAtMs)))
        : null;

    if (!previousClass) {
        const pressureSizeClass = resolveImmediateSizeClass(pressureInputs);
        return {
            pressureSizeClass,
            previousSizeClass: null,
            changedAtMs: safeNowMs,
            nextEligiblePromotionAtMs: safeNowMs + PROMOTION_COOLDOWN_MS,
            nextEligibleDemotionAtMs: safeNowMs + DEMOTION_COOLDOWN_MS,
        };
    }

    const changedAtMs = previousChangedAtMs ?? safeNowMs;
    const promotionReady = safeNowMs >= changedAtMs + PROMOTION_COOLDOWN_MS;
    const demotionReady = safeNowMs >= changedAtMs + DEMOTION_COOLDOWN_MS;
    let pressureSizeClass = previousClass;

    if (previousClass === ZEN_KOI_PRESSURE_SIZE_CLASS.STANDARD) {
        if (promotionReady && isDominantEnter(pressureInputs)) {
            pressureSizeClass = ZEN_KOI_PRESSURE_SIZE_CLASS.DOMINANT;
        } else if (promotionReady && isLargeEnter(pressureInputs)) {
            pressureSizeClass = ZEN_KOI_PRESSURE_SIZE_CLASS.LARGE;
        }
    } else if (previousClass === ZEN_KOI_PRESSURE_SIZE_CLASS.LARGE) {
        if (promotionReady && isDominantEnter(pressureInputs)) {
            pressureSizeClass = ZEN_KOI_PRESSURE_SIZE_CLASS.DOMINANT;
        } else if (demotionReady && isLargeRelease(pressureInputs)) {
            pressureSizeClass = ZEN_KOI_PRESSURE_SIZE_CLASS.STANDARD;
        }
    } else if (
        previousClass === ZEN_KOI_PRESSURE_SIZE_CLASS.DOMINANT
        && demotionReady
        && isDominantRelease(pressureInputs)
    ) {
        pressureSizeClass = isLargeEnter(pressureInputs)
            ? ZEN_KOI_PRESSURE_SIZE_CLASS.LARGE
            : ZEN_KOI_PRESSURE_SIZE_CLASS.STANDARD;
    }

    const nextChangedAtMs = pressureSizeClass === previousClass ? changedAtMs : safeNowMs;
    return {
        pressureSizeClass,
        previousSizeClass: previousClass,
        changedAtMs: nextChangedAtMs,
        nextEligiblePromotionAtMs: nextChangedAtMs + PROMOTION_COOLDOWN_MS,
        nextEligibleDemotionAtMs: nextChangedAtMs + DEMOTION_COOLDOWN_MS,
    };
};

const resolvePressureRenderScale = ({ pressureMass01, pressureSizeClass }) => {
    const sizeClass = normalizeZenKoiPressureSizeClass(pressureSizeClass);
    const band = SIZE_CLASS_RENDER_BANDS[sizeClass] || SIZE_CLASS_RENDER_BANDS.standard;
    const progress = smoothstep(band.min, band.max, pressureMass01);
    return roundNumber(lerp(PRESSURE_RENDER_SCALE_MIN, PRESSURE_RENDER_SCALE_MAX, progress), 4, 1);
};

const resolveNeutralPressureRenderScale = (pressureInputs, pressureSizeClass) => {
    if (pressureInputs.hasPressureInput !== false) {
        return resolvePressureRenderScale({
            pressureMass01: pressureInputs.pressureMass01,
            pressureSizeClass,
        });
    }
    return 1;
};

const resolveMotionProfile = (candidate = null, pressureMass01 = 0) => {
    const volatility01 = clampNumber(Number(candidate?.volatility) || 0, 0, 1, 0);
    const trend01 = smoothstep(1, 1.8, Math.max(0, Number(candidate?.trendRatio) || 0));
    const restless01 = clampNumber((pressureMass01 * 0.68) + (volatility01 * 0.22) + (trend01 * 0.1), 0, 1, 0);
    return {
        activityScale: roundNumber(1 + (restless01 * 0.1), 4, 1),
        decisionCadenceScale: roundNumber(1 - (restless01 * 0.18), 4, 1),
        turnBias: roundNumber((volatility01 * 0.05) + (restless01 * 0.025), 4, 0),
        burstBias: roundNumber((pressureMass01 * 0.045) + (trend01 * 0.025), 4, 0),
        cTurnBias: roundNumber(volatility01 * 0.035, 4, 0),
        wakeScale: roundNumber(1 + (pressureMass01 * 0.18), 4, 1),
    };
};

export const buildZenKoiExpressionProfile = ({
    candidate = null,
    previousExpressionProfile = null,
    nowMs = Date.now(),
} = {}) => {
    const pressureInputs = resolvePressureInputs(candidate);
    const transition = resolveSizeClassTransition({
        pressureInputs,
        previousExpressionProfile,
        nowMs,
    });
    const identityScale = 1;
    const classScale = SIZE_CLASS_SCALE[transition.pressureSizeClass] || 1;
    const pressureRenderScale = resolveNeutralPressureRenderScale(
        pressureInputs,
        transition.pressureSizeClass,
    );
    const effectiveScale = clampNumber(
        identityScale * classScale * pressureRenderScale,
        EFFECTIVE_VISUAL_SCALE_MIN,
        EFFECTIVE_VISUAL_SCALE_MAX,
        1,
    );
    return normalizeZenKoiExpressionProfile({
        schemaVersion: ZEN_KOI_EXPRESSION_PROFILE_SCHEMA_VERSION,
        basis: ZEN_KOI_EXPRESSION_PROFILE_BASIS,
        pressure: {
            weightedPressureMs: pressureInputs.weightedPressureMs,
            weightedMinutes: pressureInputs.weightedMinutes,
            pressureShare: pressureInputs.pressureShare,
            pressureRank: pressureInputs.pressureRank,
            pressureMass01: pressureInputs.pressureMass01,
        },
        size: {
            identityScale,
            pressureSizeClass: transition.pressureSizeClass,
            classScale,
            pressureRenderScale,
            effectiveScale,
            minEffectiveScale: EFFECTIVE_VISUAL_SCALE_MIN,
            maxEffectiveScale: EFFECTIVE_VISUAL_SCALE_MAX,
        },
        transition,
        motion: resolveMotionProfile(candidate, pressureInputs.pressureMass01),
    });
};

export const normalizeZenKoiExpressionProfile = (profile = null) => {
    if (!isObject(profile)) return null;
    const pressure = isObject(profile.pressure) ? profile.pressure : {};
    const size = isObject(profile.size) ? profile.size : {};
    const transition = isObject(profile.transition) ? profile.transition : {};
    const motion = isObject(profile.motion) ? profile.motion : {};
    const pressureSizeClass = normalizeZenKoiPressureSizeClass(size.pressureSizeClass);
    const classScale = SIZE_CLASS_SCALE[pressureSizeClass] || 1;
    const pressureRenderScale = roundNumber(
        clampNumber(size.pressureRenderScale, PRESSURE_RENDER_SCALE_MIN, PRESSURE_RENDER_SCALE_MAX, 1),
        4,
        1,
    );
    const identityScale = 1;
    const effectiveScale = roundNumber(
        clampNumber(
            identityScale * classScale * pressureRenderScale,
            EFFECTIVE_VISUAL_SCALE_MIN,
            EFFECTIVE_VISUAL_SCALE_MAX,
            1,
        ),
        4,
        1,
    );
    return {
        schemaVersion: ZEN_KOI_EXPRESSION_PROFILE_SCHEMA_VERSION,
        basis: ZEN_KOI_EXPRESSION_PROFILE_BASIS,
        pressure: {
            weightedPressureMs: Math.max(0, Math.round(Number(pressure.weightedPressureMs) || 0)),
            weightedMinutes: roundNumber(Math.max(0, Number(pressure.weightedMinutes) || 0), 3, 0),
            pressureShare: roundNumber(clampNumber(pressure.pressureShare, 0, 1, 0), 4, 0),
            pressureRank: isFiniteInput(pressure.pressureRank)
                ? Math.max(1, Math.floor(Number(pressure.pressureRank)))
                : null,
            pressureMass01: roundNumber(clampNumber(pressure.pressureMass01, 0, 1, 0), 4, 0),
        },
        size: {
            identityScale,
            pressureSizeClass,
            classScale,
            pressureRenderScale,
            effectiveScale,
            minEffectiveScale: EFFECTIVE_VISUAL_SCALE_MIN,
            maxEffectiveScale: EFFECTIVE_VISUAL_SCALE_MAX,
        },
        transition: {
            previousSizeClass: transition.previousSizeClass
                ? normalizeZenKoiPressureSizeClass(transition.previousSizeClass)
                : null,
            changedAtMs: Math.max(0, Math.trunc(Number(transition.changedAtMs) || 0)),
            nextEligiblePromotionAtMs: Math.max(0, Math.trunc(Number(transition.nextEligiblePromotionAtMs) || 0)),
            nextEligibleDemotionAtMs: Math.max(0, Math.trunc(Number(transition.nextEligibleDemotionAtMs) || 0)),
        },
        motion: {
            activityScale: roundNumber(clampNumber(motion.activityScale, 0.9, 1.12, 1), 4, 1),
            decisionCadenceScale: roundNumber(clampNumber(motion.decisionCadenceScale, 0.78, 1.12, 1), 4, 1),
            turnBias: roundNumber(clampNumber(motion.turnBias, 0, 0.08, 0), 4, 0),
            burstBias: roundNumber(clampNumber(motion.burstBias, 0, 0.08, 0), 4, 0),
            cTurnBias: roundNumber(clampNumber(motion.cTurnBias, 0, 0.06, 0), 4, 0),
            wakeScale: roundNumber(clampNumber(motion.wakeScale, 1, 1.22, 1), 4, 1),
        },
    };
};

export const buildZenKoiExpressionProfileSignature = (profile = null) => {
    const normalized = normalizeZenKoiExpressionProfile(profile);
    if (!normalized) return '';
    return [
        normalized.basis,
        normalized.pressure.pressureMass01,
        normalized.size.pressureSizeClass,
        normalized.size.pressureRenderScale,
        normalized.size.effectiveScale,
        normalized.transition.changedAtMs,
        normalized.motion.activityScale,
        normalized.motion.decisionCadenceScale,
        normalized.motion.turnBias,
        normalized.motion.burstBias,
        normalized.motion.cTurnBias,
        normalized.motion.wakeScale,
    ].join('~');
};
