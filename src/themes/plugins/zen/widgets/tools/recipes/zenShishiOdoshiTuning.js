const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toFinite = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const DEFAULT_SHISHI_ODOSHI_TUNING = Object.freeze({
  fixedStepMs: 8.333333333333334,
  maxFrameMs: 48,
  restAngle: 20,
  minAngle: -60,
  maxAngle: 40,
  spring: 7,
  angularDrag: 0.8,
  balancePivotFill: 0.7,
  balanceGain: 60,
  stickTorqueThreshold: 15,
  stickOmegaThreshold: 1.15,
  inflowRate: 0.15,
  outflowRate: 2.4,
  spillStartAngle: 7.7,
  spillBandDeg: 30,
  spillPull: 900,
  fillRateTorque: 130,
  fillRateResponse: 5,
  impactAngle: 19,
  impactMinSpeed: 38,
  impactRestitution: 0.15,
  lowerStopRestitution: 0.32,
  upperStopRestitution: 0.24,
  pulseDecayPerSec: 6.6,
  lipDecayPerSec: 5.6,
  phaseSpeedBase: 1.6,
  phaseSpeedFlowBoost: 0.8,
});

const LIMITS = Object.freeze({
  fixedStepMs: { min: 1000 / 180, max: 1000 / 30 },
  maxFrameMs: { min: 8, max: 100 },
  restAngle: { min: 0, max: 35 },
  minAngle: { min: -80, max: -8 },
  maxAngle: { min: 8, max: 40 },
  spring: { min: 1.0, max: 30.0 },
  angularDrag: { min: 0.1, max: 8.0 },
  balancePivotFill: { min: 0.01, max: 0.98 },
  balanceGain: { min: 0.0, max: 200.0 },
  stickTorqueThreshold: { min: 0.0, max: 80.0 },
  stickOmegaThreshold: { min: 0.0, max: 12.0 },
  inflowRate: { min: 0.0, max: 0.6 },
  outflowRate: { min: 0.0, max: 10.0 },
  spillStartAngle: { min: -30.0, max: 35.0 },
  spillBandDeg: { min: 0.5, max: 60.0 },
  spillPull: { min: 0.0, max: 2000.0 },
  fillRateTorque: { min: 0.0, max: 600.0 },
  fillRateResponse: { min: 0.1, max: 40.0 },
  impactAngle: { min: 4.0, max: 35.0 },
  impactMinSpeed: { min: 0.0, max: 120.0 },
  impactRestitution: { min: 0.0, max: 1.0 },
  lowerStopRestitution: { min: 0.0, max: 1.0 },
  upperStopRestitution: { min: 0.0, max: 1.0 },
  pulseDecayPerSec: { min: 0.2, max: 20.0 },
  lipDecayPerSec: { min: 0.2, max: 20.0 },
  phaseSpeedBase: { min: 0.1, max: 6.0 },
  phaseSpeedFlowBoost: { min: 0.0, max: 4.0 },
});

export const resolveShishiOdoshiTuning = (tuning) => {
  const source = tuning && typeof tuning === 'object' ? tuning : {};
  const next = { ...DEFAULT_SHISHI_ODOSHI_TUNING };

  Object.entries(LIMITS).forEach(([key, limit]) => {
    const fallback = DEFAULT_SHISHI_ODOSHI_TUNING[key];
    const value = toFinite(source[key], fallback);
    next[key] = clamp(value, limit.min, limit.max);
  });

  if (next.minAngle >= -2) {
    next.minAngle = -2;
  }

  if (next.maxAngle <= 2) {
    next.maxAngle = 2;
  }

  if (next.minAngle >= next.maxAngle - 2) {
    next.maxAngle = next.minAngle + 2;
  }

  return next;
};

