import { resolveKoiEventMotionRange } from '../model/koi/koiEventMotionLimits.js';

const DEFAULT_KOI_MOTION_PROFILE = Object.freeze({
    grace: 0.62,
    agility: 0.48,
    tailDrive: 0.58,
    turnSharpness: 0.46,
});

const clamp01 = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(1, numeric));
};

const lerp = (a, b, t) => a + (b - a) * t;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function resolveKoiMotionProfile(candidate = null) {
    const source = isObject(candidate) ? candidate : {};
    return {
        grace: clamp01(source.grace, DEFAULT_KOI_MOTION_PROFILE.grace),
        agility: clamp01(source.agility, DEFAULT_KOI_MOTION_PROFILE.agility),
        tailDrive: clamp01(source.tailDrive, DEFAULT_KOI_MOTION_PROFILE.tailDrive),
        turnSharpness: clamp01(source.turnSharpness, DEFAULT_KOI_MOTION_PROFILE.turnSharpness),
    };
}

export function projectKoiMotionProfileToPhysics(profileInput, swimModel = 'event_fsm_life_v1', basePhysics = {}) {
    const profile = resolveKoiMotionProfile(profileInput);
    const grace = profile.grace;
    const agility = profile.agility;
    const tailDrive = profile.tailDrive;
    const turnSharpness = profile.turnSharpness;
    const continuousSpine = swimModel === 'event_fsm_life_v2';
    const hybrid = swimModel === 'kinematic_hybrid';
    const cpg = swimModel === 'cpg_dynamics';

    const waveAmplitudeScale = lerp(2.0, 4.05, tailDrive)
        * lerp(1.08, 0.86, grace)
        * (continuousSpine ? 0.88 : 1);
    const swimSpeedScale = lerp(2.55, 4.65, tailDrive)
        + agility * 0.42
        + (continuousSpine ? -0.12 : 0);
    const eventRange = resolveKoiEventMotionRange(swimModel, 'spineStiffness');
    const spineStiffness = eventRange
        ? lerp(eventRange.min, eventRange.max, grace * (1 - agility * 0.2))
        : lerp(2.65, 5.15, grace)
        + lerp(0.55, -0.45, agility)
        + (continuousSpine ? 0.72 : 0);
    const accelScale = lerp(1.82, 3.16, agility) * lerp(0.96, 1.04, tailDrive);
    const frictionScale = lerp(1.012, 1.05, grace) * lerp(1.008, 0.99, agility);
    const eventHeadTurnLeadGain = lerp(1.5, 2.8, turnSharpness) * lerp(0.92, 1.03, grace);
    const eventHeadSwayGain = lerp(1.36, 2.8, tailDrive) * lerp(1.02, 0.9, grace);
    const eventHeadYawGain = lerp(1.42, 2.8, tailDrive) * lerp(1.02, 0.92, grace);
    const eventHeadPivotFollow = lerp(1.45, 2.8, turnSharpness) * lerp(0.92, 1.06, agility);

    const physics = {
        ...basePhysics,
        waveAmplitudeScale,
        swimSpeedScale,
        spineStiffness,
        accelScale,
        frictionScale,
        eventHeadYawGain,
        eventHeadTurnLeadGain,
        eventHeadSwayGain,
        eventHeadPivotFollow,
    };

    if (hybrid) {
        physics.hybridCurvatureGain = lerp(0.78, 1.48, turnSharpness);
        physics.hybridTurnResponse = lerp(0.72, 1.55, agility);
        physics.hybridThrustGain = lerp(0.78, 1.46, tailDrive);
        physics.hybridRearWaveGain = lerp(0.88, 1.64, tailDrive) * lerp(1.04, 0.92, grace);
        physics.hybridHeadSwayGain = lerp(0.76, 1.5, tailDrive);
    }

    if (cpg) {
        physics.coreSegment = lerp(0.42, 0.28, agility);
    } else if (swimModel === 'event_fsm' || swimModel === 'event_fsm_life_v1') {
        physics.coreSegment = lerp(0.48, 0.32, turnSharpness);
    }

    return physics;
}

export function applyKoiMotionProfileProjection(tuning = {}) {
    const source = isObject(tuning) ? tuning : {};
    const physics = isObject(source.physics) ? source.physics : {};
    const profile = resolveKoiMotionProfile(source.koiMotionProfile);
    const swimModel = typeof physics.swimModel === 'string' ? physics.swimModel : 'event_fsm_life_v1';
    return {
        ...source,
        koiMotionProfile: profile,
        physics: projectKoiMotionProfileToPhysics(profile, swimModel, physics),
    };
}

export { DEFAULT_KOI_MOTION_PROFILE };
