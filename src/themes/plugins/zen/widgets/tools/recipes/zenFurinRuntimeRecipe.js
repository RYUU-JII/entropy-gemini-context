import { advanceFurinPhysics } from './zenFurinPhysics.js';
export { createFurinPhysicsState } from './zenFurinPhysics.js';

export const DEFAULT_FURIN_TUNING = Object.freeze({
  M_BELL: 6.2, M_STRIKER: 0.93, M_PAPER: 0.28,
  DAMP_BELL: 0.45, DAMP_STRIKER: 0.8, DAMP_PAPER: 1.0,
  WIND_MULT: 1.86, G: 480,
  WIND_DEBUG_MODE: 'off', WIND_DEBUG_STRENGTH: 0.85,
  WIND_DEBUG_PERIOD_SEC: 4.0, WIND_DEBUG_MIX: 1.0,
});

const VALID_WIND_DEBUG_MODES = new Set(['off', 'fixed_left', 'fixed_right', 'cycle_lr', 'cycle_rl']);

const FULL_QUALITY_PROFILE = Object.freeze({
  targetFps: 60,
  simHz: 60,
  particleCount: 6,
  enableImpactPulse: true,
  animateAmbientGlow: true,
});

export const FURIN_WASHI_TEXTURE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));



export function resolveFurinQualityProfile(runtimeBudget = null) {
  const particleScale = Math.max(0, Number(runtimeBudget?.particleScale) || 0);
  const runtimeEnabled = runtimeBudget?.enabled !== false;
  if (!runtimeEnabled) {
    return Object.freeze({
      targetFps: 0,
      simHz: 0,
      particleCount: 0,
      enableImpactPulse: false,
      animateAmbientGlow: false,
    });
  }
  return Object.freeze({
    targetFps: Math.max(1, Number(runtimeBudget?.targetFps) || FULL_QUALITY_PROFILE.targetFps),
    simHz: Math.max(1, Number(runtimeBudget?.simHz) || FULL_QUALITY_PROFILE.simHz),
    particleCount: Math.max(0, Math.round(FULL_QUALITY_PROFILE.particleCount * particleScale)),
    enableImpactPulse: runtimeBudget?.allowImpactEffects === true,
    animateAmbientGlow: Number(runtimeBudget?.vectorEffectScale) > 0,
  });
}

export function resolveFurinSimulationRecipe({
  activityWeight = 0,
  isSimulationLive = false,
  simulationMode = 'halt',
  tuning = null,
} = {}) {
  // Lab tuning is an explicit input, never persisted production policy.
  const input = { ...DEFAULT_FURIN_TUNING, ...tuning };
  if (!VALID_WIND_DEBUG_MODES.has(input.WIND_DEBUG_MODE)) throw new Error('ZEN_FURIN_WIND_MODE_INVALID');
  for (const key of ['M_BELL','M_STRIKER','M_PAPER','G','WIND_DEBUG_PERIOD_SEC']) {
    if (!Number.isFinite(input[key]) || input[key] <= 0) throw new Error(`ZEN_FURIN_TUNING_INVALID:${key}`);
  }
  for (const key of ['DAMP_BELL','DAMP_STRIKER','DAMP_PAPER','WIND_MULT','WIND_DEBUG_STRENGTH','WIND_DEBUG_MIX']) {
    if (!Number.isFinite(input[key]) || input[key] < 0) throw new Error(`ZEN_FURIN_TUNING_INVALID:${key}`);
  }
  // An enabled, armed gallery is `settle`: it still has an ambient breeze.
  // `halt` adds no ambient wind; Site supplies its finite entrance/choice breeze.
  const windModeScale = isSimulationLive
    ? Math.max(0.18, activityWeight)
    : simulationMode === 'settle' ? 0.3 : 0;
  return Object.freeze({
    impactCooldownMs: 300, impactMinSpeed: 6, restitution: 0.22,
    gravity: input.G,
    mBell: input.M_BELL, mStriker: input.M_STRIKER, mPaper: input.M_PAPER,
    dampBell: input.DAMP_BELL, dampStriker: input.DAMP_STRIKER, dampPaper: input.DAMP_PAPER,
    windMult: input.WIND_MULT * windModeScale,
    windDebugMode: input.WIND_DEBUG_MODE,
    windDebugStrength: input.WIND_DEBUG_STRENGTH,
    windDebugPeriodMs: Math.max(250, input.WIND_DEBUG_PERIOD_SEC * 1000),
    windDebugMix: clamp(input.WIND_DEBUG_MIX, 0, 1),
  });
}

function resolveFurinWind(simTimeMs, recipe) {
  const w1 = Math.sin(simTimeMs / 2900) * 0.35;
  const w2 = Math.sin(simTimeMs / 1700) * 0.25;
  const w3 = Math.sin(simTimeMs / 850) * 0.15;
  const flutter = Math.sin(simTimeMs / 350) * 0.1;
  const gustRaw = Math.sin(simTimeMs / 6300) * Math.cos(simTimeMs / 4100);
  const gust = Math.abs(gustRaw) > 0.65
    ? Math.sign(gustRaw) * (Math.abs(gustRaw) - 0.65) * 3.5
    : 0;
  const naturalWind = w1 + w2 + w3 + flutter + gust;
  const cyclePhase = Math.floor(simTimeMs / recipe.windDebugPeriodMs) % 2;
  const debugWind = (() => {
    switch (recipe.windDebugMode) {
      case 'fixed_left':
        return -recipe.windDebugStrength;
      case 'fixed_right':
        return recipe.windDebugStrength;
      case 'cycle_lr':
        return cyclePhase === 0 ? -recipe.windDebugStrength : recipe.windDebugStrength;
      case 'cycle_rl':
        return cyclePhase === 0 ? recipe.windDebugStrength : -recipe.windDebugStrength;
      default:
        return 0;
    }
  })();
  const mixedWind = recipe.windDebugMode === 'off'
    ? naturalWind
    : (naturalWind * (1 - recipe.windDebugMix)) + (debugWind * recipe.windDebugMix);
  return mixedWind * recipe.windMult;
}

export function stepFurinPhysics({ state, simStepMs, recipe, onImpact, windInput = 0 }) {
  advanceFurinPhysics({ state, simStepMs, recipe, onImpact, windInput,
    windAt: time => resolveFurinWind(time, recipe) });
}
