import { getLunarState } from '@/lib/lunarCalculations.js';

const SYNODIC_MONTH_DAYS = 29.530588;

/**
 * The world's moon from the same time and place as its sun: real position,
 * illuminated fraction and bright-limb orientation. Only astronomy lives here;
 * weather attenuation and presentation belong to their own owners.
 */
export const resolveZenWorldLunar = ({ timeContext, solarCoordinates }) => {
    if (!Number.isFinite(timeContext?.timestampMs) || !solarCoordinates) {
        throw new Error('ZEN_WORLD_LUNAR_INPUT_REQUIRED');
    }
    const state = getLunarState(
        new Date(timeContext.timestampMs), solarCoordinates.latitude, solarCoordinates.longitude,
    );
    return {
        lunarState: state,
        channels: {
            moonAltitudeRadians: state.altitudeRad,
            moonAzimuthSouthRadians: state.azimuthSouthRad,
            moonParallacticAngle: state.parallacticAngleRad,
            moonBrightLimbAngle: state.brightLimbAngleRad,
            moonIllumination: state.illuminatedFraction,
            moonAge: state.phase * SYNODIC_MONTH_DAYS,
        },
    };
};
