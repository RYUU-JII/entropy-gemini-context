import { clamp as clampValue } from '../model/koi/koiMotion.js';

const wrapHour = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    let hour = numeric % 24;
    if (hour < 0) hour += 24;
    return hour;
};

const smoothstep = (edge0, edge1, x) => {
    if (edge0 === edge1) return x >= edge1 ? 1 : 0;
    const t = clampValue((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
};

const lerp = (a, b, t) => a + (b - a) * t;

const ZERO_SLEEP_CONTEXT = Object.freeze({
    sleepBlend: 0,
    activityMultiplier: 1,
    drift: Object.freeze({ x: 0, y: 0 }),
    sleeping: false,
});

const ensureSleepContextBuffer = (fish) => {
    if (!fish) return null;
    if (!fish.sleepContextBuffer) {
        fish.sleepContextBuffer = {
            sleepBlend: 0,
            activityMultiplier: 1,
            drift: { x: 0, y: 0 },
            sleeping: false,
        };
    }
    if (!fish.sleepContextBuffer.drift) {
        fish.sleepContextBuffer.drift = { x: 0, y: 0 };
    }
    return fish.sleepContextBuffer;
};

const writeSleepContext = (target, {
    sleepBlend = 0,
    activityMultiplier = 1,
    driftX = 0,
    driftY = 0,
    sleeping = false,
} = {}) => {
    if (!target) return ZERO_SLEEP_CONTEXT;
    target.sleepBlend = sleepBlend;
    target.activityMultiplier = activityMultiplier;
    target.sleeping = sleeping;
    target.drift.x = driftX;
    target.drift.y = driftY;
    return target;
};

const ensureSleepProfile = (fish) => {
    if (fish?.sleepProfile && fish.sleepProfile.version === 1) {
        if (!Number.isFinite(Number(fish.sleepProfile.focusBlend))) {
            fish.sleepProfile.focusBlend = 0;
        }
        return fish.sleepProfile;
    }
    const laziness = clampValue(Number(fish?.personality?.laziness) || Math.random(), 0, 1);
    const profile = {
        version: 1,
        blend: 0,
        focusBlend: 0,
        sleepBias: clampValue(0.22 + laziness * 0.94 + Math.random() * 0.16, 0.12, 1),
        wakeBias: clampValue(0.18 + Math.random() * 0.44, 0.18, 0.62),
        napPhase: Math.random() * Math.PI * 2,
        driftAxis: Math.random() * Math.PI * 2,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.0012 + Math.random() * 0.0018,
    };
    fish.sleepProfile = profile;
    return profile;
};

const computeNightSleepPressure = (envState = {}) => {
    const hour = wrapHour(envState?.time);
    const daylightHint = Number(envState?.daylight);
    const fallbackDaylight = clampValue(
        (Math.sin(((hour - 6) / 24) * Math.PI * 2) + 1) * 0.5,
        0,
        1,
    );
    const daylight = Number.isFinite(daylightHint)
        ? clampValue(daylightHint, 0, 1)
        : fallbackDaylight;
    const nightBlend = clampValue(1 - daylight, 0, 1);
    const koiActivity = clampValue(Number(envState?.koiActivity) || 0.85, 0, 2);

    const lateEvening = smoothstep(20.6, 23.1, hour);
    const deepNight = hour < 7 ? (1 - smoothstep(4.8, 7.0, hour)) : 0;
    const nightEnvelope = Math.max(lateEvening, deepNight);
    const quietEnvelopeGate = clampValue(
        Math.pow(nightBlend, 1.25) + lateEvening * 0.3,
        0,
        1,
    );
    const quietEnvelope = clampValue((0.74 - koiActivity) / 0.52, 0, 1) * quietEnvelopeGate;

    return clampValue(nightEnvelope * 0.8 + quietEnvelope * 0.2, 0, 1);
};

export function resolveKoiSleepContext(
    fish,
    {
        envState = null,
        simStepScale = 1,
        isFocused = false,
    } = {},
) {
    if (!fish) return ZERO_SLEEP_CONTEXT;

    const profile = ensureSleepProfile(fish);
    const contextBuffer = ensureSleepContextBuffer(fish);
    const step = clampValue(Number(simStepScale) || 1, 0.35, 2.5);
    const focusTarget = isFocused ? 1 : 0;
    const focusBlend = clampValue(Number(profile.focusBlend) || 0, 0, 1);
    const focusRiseRate = clampValue(0.24 * step, 0.08, 0.48);
    const focusFallRate = clampValue(0.1 * step, 0.03, 0.26);
    const focusFollowRate = focusTarget > focusBlend ? focusRiseRate : focusFallRate;
    profile.focusBlend = clampValue(lerp(focusBlend, focusTarget, focusFollowRate), 0, 1);

    const sleepPressure = computeNightSleepPressure(envState);
    profile.napPhase += (0.0016 + sleepPressure * 0.0024) * step;

    const napRhythm = 0.78 + (0.5 + Math.sin(profile.napPhase) * 0.5) * 0.22;
    const targetBlend = clampValue(
        sleepPressure * (0.26 + profile.sleepBias * 0.96) * napRhythm
        - 0.14
        - profile.wakeBias * 0.12,
        0,
        1,
    );

    const riseRate = clampValue((0.014 + sleepPressure * 0.012) * step, 0.01, 0.065);
    const fallRate = clampValue(0.085 * step, 0.03, 0.22);
    const followRate = targetBlend > profile.blend ? riseRate : fallRate;
    profile.blend = clampValue(lerp(profile.blend, targetBlend, followRate), 0, 1);

    const effectiveSleepBlend = clampValue(profile.blend * (1 - profile.focusBlend * 0.94), 0, 1);
    profile.driftPhase += profile.driftSpeed * (0.35 + effectiveSleepBlend * 0.65) * step;
    const driftMag = Math.pow(effectiveSleepBlend, 1.75) * (0.00042 + (1 - profile.sleepBias) * 0.00018);
    const driftX = Math.cos(profile.driftAxis + profile.driftPhase) * driftMag;
    const driftY = Math.sin(profile.driftAxis + profile.driftPhase) * driftMag * 0.68;

    return writeSleepContext(contextBuffer, {
        sleepBlend: effectiveSleepBlend,
        activityMultiplier: clampValue(1 - effectiveSleepBlend * 0.92, 0.06, 1),
        driftX,
        driftY,
        sleeping: effectiveSleepBlend > 0.62,
    });
}
