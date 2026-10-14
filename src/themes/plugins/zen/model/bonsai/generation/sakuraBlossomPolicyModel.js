import { HardConstraintModel } from './hardConstraintModel';

const clamp = (value, min, max) => HardConstraintModel.clamp(value, min, max);
const lerp = (a, b, t) => a + ((b - a) * t);
const clamp01 = (value) => clamp(value, 0, 1);

const round3 = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Number(numeric.toFixed(3));
};

const BLOSSOM_SCALE_CONTEXT = Object.freeze({
    terminal: {
        baseScale: 2.04,
        clusterInfluence: 0.01,
        distanceInfluence: 0.012,
        outerInfluence: 0.012,
        apexInfluence: 0.004,
        jitterRange: 0.04,
    },
    cluster: {
        baseScale: 2.0,
        clusterInfluence: 0.012,
        distanceInfluence: 0.008,
        outerInfluence: 0.008,
        apexInfluence: 0.004,
        jitterRange: 0.03,
    },
    twig: {
        baseScale: 1.96,
        clusterInfluence: 0.008,
        distanceInfluence: 0.008,
        outerInfluence: 0.004,
        apexInfluence: 0,
        jitterRange: 0.028,
    },
    canopy: {
        baseScale: 2.08,
        clusterInfluence: 0.008,
        distanceInfluence: 0.016,
        outerInfluence: 0.014,
        apexInfluence: 0.01,
        jitterRange: 0.032,
    },
    fallback: {
        baseScale: 1.98,
        clusterInfluence: 0.008,
        distanceInfluence: 0.006,
        outerInfluence: 0.004,
        apexInfluence: 0.004,
        jitterRange: 0.024,
    },
});

const resolveScaleContextProfile = (context = 'terminal') => (
    BLOSSOM_SCALE_CONTEXT[context] || BLOSSOM_SCALE_CONTEXT.terminal
);

const resolveTreeScaleBias = (gene = {}, flowerDominance = 0.5) => {
    const bloomPeak = clamp01(gene?.bloomPeak ?? gene?.flowerChance ?? flowerDominance);
    const speciesCharacter = clamp01(gene?.speciesCharacter ?? 0.5);
    const warmth = clamp01(gene?.petalWarmth ?? 0.5);
    const signal = clamp01(
        (bloomPeak * 0.42)
        + (speciesCharacter * 0.38)
        + (warmth * 0.2),
    );
    return lerp(0.97, 1.03, signal);
};

export const resolveSakuraFlowerScale = ({
    rng,
    nextRandom,
    gene = {},
    context = 'terminal',
    index = 0,
    flowerDominance = 0.5,
    distanceRatio = 0.5,
    clusterTightness = 0.5,
    outerBias = 0.5,
    apexWeight = 0.5,
} = {}) => {
    const profile = resolveScaleContextProfile(context);
    const treeBias = resolveTreeScaleBias(gene, flowerDominance);
    const clusterBias = clamp(
        1
        + ((clamp01(distanceRatio) - 0.5) * profile.distanceInfluence * 2)
        + ((clamp01(outerBias) - 0.5) * profile.outerInfluence * 2)
        - ((clamp01(clusterTightness) - 0.5) * profile.clusterInfluence * 2)
        - ((clamp01(apexWeight) - 0.5) * profile.apexInfluence * 2),
        0.97,
        1.03,
    );
    const jitter = clamp(
        1 + (((nextRandom?.(rng, `${context}_${index}_flower_size`) ?? 0.5) - 0.5) * profile.jitterRange),
        0.98,
        1.02,
    );

    return round3(
        clamp(profile.baseScale * treeBias * clusterBias * jitter, 1.84, 2.28),
        1,
    );
};

export const resolveSakuraBlossomFacing = ({
    rng,
    nextRandom,
    context = 'terminal',
    index = 0,
    angle = 0,
    openness = 0.72,
    exposure = 0.5,
    distanceRatio = 0.5,
    clusterTightness = 0.5,
    apexWeight = 0.5,
} = {}) => {
    const safeOpenness = clamp01(openness);
    const sidePreference = Math.sin(Number(angle) || 0);
    const yawSignal = clamp(
        (sidePreference * lerp(0.24, 0.72, clamp01(distanceRatio)))
        + (((nextRandom?.(rng, `${context}_${index}_flower_yaw`) ?? 0.5) - 0.5) * 0.24)
        - ((clamp01(clusterTightness) - 0.5) * 0.12),
        -0.88,
        0.88,
    );
    const pitchBase = context === 'canopy'
        ? 0.12
        : context === 'twig'
            ? -0.04
            : context === 'cluster'
                ? 0.03
                : 0.05;
    const pitchSignal = clamp(
        pitchBase
        + (clamp01(exposure) * 0.22)
        + ((safeOpenness - 0.5) * 0.12)
        - (clamp01(apexWeight) * 0.08)
        + (((nextRandom?.(rng, `${context}_${index}_flower_pitch`) ?? 0.5) - 0.5) * 0.16),
        -0.34,
        0.42,
    );

    return {
        facingYaw: round3(yawSignal, 0),
        facingPitch: round3(pitchSignal, 0),
    };
};
