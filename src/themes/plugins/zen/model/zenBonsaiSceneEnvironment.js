import {
    projectZenWorldEnvironmentRuntimeTarget,
} from '../runtime/environment/zenWorldEnvironmentRuntimeTarget.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp01 = (value) => clamp(value, 0, 1);
const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};
const lerp = (a, b, t) => a + (b - a) * t;

export const ZEN_BONSAI_WIND_STATE_ENVELOPE = Object.freeze({
    // Canonical generator maximum, including the 1.08 life-response ceiling.
    maximumFlutter: 0.003,
});

// Irrational spacing for the wind's frequency bands.
//
// Four sinusoids on commensurable frequencies re-phase on a common period, and
// a signal that repeats the same gesture on a fixed cycle stops reading as
// weather: it reads as a mechanism being switched on and off. Spacing the bands
// by irrationals means the composite never closes, so no two swells of the same
// shape ever arrive twice.
const PHI = 1.6180339887498949;
const SQRT2 = 1.4142135623730951;
const SQRT5 = 2.23606797749979;

// The share of the mean flow that survives its own slowest lull. Air moving
// past a tree eases; it does not stop and restart.
const STEADY_FLOOR = 0.32;

const resolveSourceEnvState = (candidate = null) => {
    if (candidate?.envState && typeof candidate.envState === 'object') {
        return candidate.envState;
    }
    return candidate && typeof candidate === 'object' ? candidate : null;
};

export const resolveZenBonsaiSceneEnvironment = (candidate = null) => {
    return projectZenWorldEnvironmentRuntimeTarget(resolveSourceEnvState(candidate));
};

export const resolveZenBonsaiWindState = ({
    environmentState = null,
    frameCount = 0,
} = {}) => {
    const env = environmentState;
    for (const field of ['windIntensity', 'gustEnvelope', 'windDirection']) {
        if (!Number.isFinite(env?.[field])) throw new Error(`ZEN_BONSAI_WIND_FIELD_REQUIRED:${field}`);
    }
    const intensity = clamp(env.windIntensity, 0.08, 1);
    const gustEnvelope = clamp01(env.gustEnvelope);
    const direction = env.windDirection;
    const dirX = Math.cos(direction);
    const dirY = Math.sin(direction);
    const time = Math.max(0, Math.floor(toNumber(frameCount, 0)));
    const phase = direction * 0.73;
    const intensityEase = smoothstep01(intensity);
    const lightAir = 1 - intensityEase;
    // Radians per frame at 60fps; the comment gives the period a viewer sees.
    // Calm air moves on longer scales than a blow, which is what `lightAir`
    // stretches. These are the weather's own bands, deliberately slow: they are
    // the envelope the tree stands in, not the rhythm it answers at. That
    // rhythm belongs to each limb's own resonance, which is sampled every frame
    // rather than every fourth one and can therefore be as quick as the wood is.
    const broadFrequency = 0.0112 + (lightAir * 0.0046);        // 9.4s -> 6.6s
    const gustFrequency = broadFrequency / PHI;                 // 15.2s -> 10.7s
    const eddyFrequency = broadFrequency * SQRT5;               // 4.2s -> 3.0s
    const flutterFrequency = eddyFrequency * PHI;               // 2.6s -> 1.8s
    const steadyFrequency = broadFrequency / (PHI * SQRT5);     // 34s -> 24s
    const steadySwellFrequency = steadyFrequency * PHI;         // 21s -> 15s
    const swirlFrequency = broadFrequency / (SQRT2 * SQRT5);    // 30s -> 21s
    const swirlEddyFrequency = swirlFrequency * SQRT5 * 1.19;   // 11s -> 7.9s

    const swayAmplitude = 0.0012 + (Math.pow(intensity, 1.24) * 0.0078) + (gustEnvelope * 0.0024);
    const gustAmplitude = 0.0009 + (Math.pow(intensity, 1.12) * 0.0021) + (gustEnvelope * 0.0038);
    const eddyAmplitude = 0.0007 + (Math.pow(intensity, 0.92) * 0.0017) + (gustEnvelope * 0.0028);
    const flutterAmplitude = 0.00044
        + (Math.pow(intensity, 0.72) * 0.00082)
        + (lightAir * 0.00036)
        + (gustEnvelope * 0.0007);
    const sway = Math.sin(time * broadFrequency + phase) * swayAmplitude;
    const gust = (
        Math.sin(time * gustFrequency + phase * 1.7) * gustAmplitude
        + Math.sin(time * eddyFrequency + phase * 0.41) * eddyAmplitude
    );
    const flutter = Math.sin(time * flutterFrequency + phase * 0.92)
        * flutterAmplitude
        * lerp(1.18, 0.92, intensityEase);

    // Mean flow, and the one channel here that is never negative.
    //
    // Air moving past a tree holds it leaning and then lets it up; it does not
    // haul it upwind on the return stroke. Every other band is zero-mean, so on
    // their own the drive crosses zero twice a cycle and the specimen reads as a
    // pendulum somebody is pushing. Carrying the lean as its own signed-positive
    // channel is what turns that back into wood standing in a breeze.
    const steadyAmplitude = 0.0013
        + (Math.pow(intensity, 1.16) * 0.0074)
        + (gustEnvelope * 0.0021);
    const steadySwell = (
        (0.62 * Math.sin(time * steadyFrequency + phase * 0.37))
        + (0.38 * Math.sin(time * steadySwellFrequency + phase * 1.83))
    );
    const steady = steadyAmplitude * (
        STEADY_FLOOR + ((1 - STEADY_FLOOR) * (0.5 + (0.5 * steadySwell)))
    );

    // How far the flow has wandered off its mean bearing, in radians.
    //
    // A single fixed bearing is the other half of why the old signal read as a
    // machine: one axis, on and off. Real air meanders, and it meanders most
    // when there is least of it — a light breeze searches for its direction
    // while a real blow holds its line, which is what the intensity term does
    // to the span. `dirX`/`dirY` stay the mean bearing, because that is the
    // scene-level fact petals and light are entitled to; this is the local
    // departure from it.
    const swirlAmplitude = (0.055 + (lightAir * 0.135)) * lerp(1, 0.58, gustEnvelope);
    const swirl = swirlAmplitude * (
        (0.66 * Math.sin(time * swirlFrequency + phase * 0.53))
        + (0.34 * Math.sin(time * swirlEddyFrequency + phase * 2.11))
    );

    return {
        intensity,
        gustEnvelope,
        direction,
        dirX,
        dirY,
        steady,
        swirl,
        sway,
        gust,
        flutter,
        scalar: sway + gust + flutter,
    };
};
