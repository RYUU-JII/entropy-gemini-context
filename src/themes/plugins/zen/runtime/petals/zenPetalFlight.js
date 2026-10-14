const TAU = Math.PI * 2;
const range = (random, min, max) => min + random() * (max - min);
const FLIGHT_PROFILES = Object.freeze({
    glide: Object.freeze({ flutterSpeed: [1.2, 1.9], flutterAmplitude: [24, 46],
        spin: [.12, .48], rollSpeed: [.6, 1.25], fallSpeed: [130, 180], windAffinity: [1, 1.45] }),
    pendulum: Object.freeze({ flutterSpeed: [1.6, 2.7], flutterAmplitude: [65, 110],
        spin: [.25, .8], rollSpeed: [1.1, 2.3], fallSpeed: [125, 175], windAffinity: [.55, .9] }),
    tumble_dive: Object.freeze({ flutterSpeed: [3, 4.5], flutterAmplitude: [40, 80],
        spin: [.8, 1.7], rollSpeed: [3.6, 5.6], fallSpeed: [155, 190], windAffinity: [.6, 1.1] }),
});

// One seeded flight recipe per identity. Drift, flutter and tumbling share the
// field's active clock; neither the renderer nor the pond runs a second flight.
export const createZenPetalFlight = (random) => {
    const choice = random();
    const flightKind = choice < .4 ? 'glide' : choice < .78 ? 'pendulum' : 'tumble_dive';
    const profile = FLIGHT_PROFILES[flightKind];
    return {
        flightKind,
        phase: random() * TAU,
        flutterSpeed: range(random, ...profile.flutterSpeed),
        flutterAmplitude: range(random, ...profile.flutterAmplitude),
        spin: (random() < .5 ? -1 : 1) * range(random, ...profile.spin),
        rollPhase: random() * TAU,
        rollSpeed: (random() < .5 ? -1 : 1) * range(random, ...profile.rollSpeed),
        fallSpeed: range(random, ...profile.fallSpeed),
        windAffinity: range(random, ...profile.windAffinity),
        diveFrequency: range(random, .8, 1.3),
        diveStrength: flightKind === 'tumble_dive' ? range(random, .85, 1) : 0,
    };
};

const flightPhase = (petal) => petal.age * petal.flutterSpeed + petal.phase
    + Math.sin(petal.age * 0.7 + petal.rollPhase) * 0.22;
const rollPhase = (petal, flutter) => petal.age * petal.rollSpeed + petal.rollPhase
    + Math.sin(flutter * 0.53) * 0.35;
const divePulse = (petal) => Math.pow((1 + Math.sin(petal.age * petal.diveFrequency + petal.phase)) / 2, 5)
    * petal.diveStrength;

export const advanceZenPetalFlight = (petal, { wind, rainIntensity, activeTime, motionScale, dtSec }) => {
    if (!Number.isFinite(rainIntensity) || rainIntensity < 0 || rainIntensity > 1) {
        throw new Error('ZEN_PETAL_FLIGHT_RAIN_INVALID');
    }
    const flutter = flightPhase(petal);
    const dive = divePulse(petal);
    const face = Math.abs(Math.cos(rollPhase(petal, flutter))) * (1 - dive * .78);
    // A shared gust carries the whole field, while each lamina catches it
    // differently. The stronger lateral flutter can reverse the drift.
    const breeze = (12 + wind.intensity * 40) * Math.cos(wind.direction);
    const gust = Math.sin(activeTime * 0.85) * wind.gust * 36;
    const zigzag = Math.sin(flutter) + Math.sin(flutter * 1.73 + petal.rollPhase) * 0.3;
    petal.velocityX = ((breeze + gust) * petal.windAffinity
        + zigzag * petal.flutterAmplitude * (1 - dive * .65) * (1 - rainIntensity * .45)) * motionScale;
    // Broadside drag slows the descent; an edge-on turn slips down faster.
    // Positive descent is retained through both flutter and vertical wind.
    // A brief tumble can settle into an edge-on dive. Rain adds weight without
    // resetting the seeded phase or creating another weather/flight clock.
    petal.velocityY = (petal.fallSpeed * (0.78 + (1 - face) * 0.34 + Math.sin(flutter * 0.7) * 0.06
        + dive * .28) * (1 + rainIntensity * .18)
        + Math.sin(wind.direction) * wind.intensity * 10) * motionScale;
    petal.rotation += (petal.spin + Math.sin(flutter * 0.6) * 0.7
        + gust * 0.008 * petal.windAffinity) * dtSec;
};

export const projectZenPetalTumble = (petal, landingBlend) => {
    const roll = rollPhase(petal, flightPhase(petal));
    // Signed width passes continuously through the thin edge to the reverse
    // face. Surface petals alone align to a full face before the exact handoff.
    petal.tumbleX = 1 - landingBlend + Math.cos(roll) * (1 - divePulse(petal) * .78) * landingBlend;
    petal.tumbleY = 1 - landingBlend * (0.17 + Math.sin(roll * 0.71 + petal.phase) * 0.17);
};
