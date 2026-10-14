/**
 * Lunar Calculations Utility
 *
 * Local-first moon ephemeris powered by the same SunCalc formulas as
 * solarCalculations: topocentric position, illuminated fraction, the lunation
 * phase and the orientation of the bright limb.
 */

import SunCalc from './vendor/suncalcLite.js';

const DEG = 180 / Math.PI;

/**
 * The moon seen from a place at a moment. Angles are radians; azimuth is
 * measured from south toward west like the solar azimuth. `brightLimbAngleRad`
 * is the bright limb's midpoint reckoned eastward from the disc's north point,
 * and subtracting `parallacticAngleRad` gives it from the zenith instead.
 */
export function getLunarState(date, lat, lon) {
  const targetDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(targetDate.getTime()) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('LUNAR_STATE_INPUT_INVALID');
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('LUNAR_STATE_COORDINATES_INVALID');
  }
  const position = SunCalc.getMoonPosition(targetDate, lat, lon);
  const illumination = SunCalc.getMoonIllumination(targetDate);
  const values = [position.altitude, position.azimuth, position.parallacticAngle,
    illumination.fraction, illumination.phase, illumination.angle];
  if (!values.every(Number.isFinite)) throw new Error('LUNAR_STATE_SAMPLE_INVALID');
  return Object.freeze({
    timestampMs: targetDate.getTime(),
    altitudeRad: position.altitude,
    altitudeDeg: position.altitude * DEG,
    azimuthSouthRad: position.azimuth,
    parallacticAngleRad: position.parallacticAngle,
    illuminatedFraction: illumination.fraction,
    // 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
    phase: illumination.phase,
    brightLimbAngleRad: illumination.angle,
  });
}
