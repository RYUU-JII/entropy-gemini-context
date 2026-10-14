import { createRenderBudget } from '@/platform/rendering/renderBudgetContract.js';
import {
  NUDGE_RENDER_PRESSURE_LEVELS,
  assertNudgeRenderPressureLevel,
} from './nudgeRenderPressureGovernor.js';
import { resolveNudgeEntityRenderProfile } from './profiles/nudgeEntityRenderProfile.js';
import { resolveNudgeGlobalBackgroundRenderProfile } from './profiles/nudgeGlobalBackgroundRenderProfile.js';
import { resolveNudgeGlobalDisplayRenderProfile } from './profiles/nudgeGlobalDisplayRenderProfile.js';
import { resolveNudgeKoiRenderProfile } from './profiles/nudgeKoiRenderProfile.js';

function freezeCost(cost) {
  return Object.freeze({ ...cost });
}

export const NUDGE_RENDER_COSTS = Object.freeze({
  [NUDGE_RENDER_PRESSURE_LEVELS.NORMAL]: freezeCost({
    pixelRatioCap: 2,
    maxRenderPixels: 8_294_400,
    detailScale: 1,
    particleScale: 1,
    historyScale: 1,
    blurCapPx: 24,
    optionalPasses: true,
    trailAlphaScale: 1,
  }),
  [NUDGE_RENDER_PRESSURE_LEVELS.PRESSURE]: freezeCost({
    pixelRatioCap: 1.5,
    maxRenderPixels: 4_665_600,
    detailScale: 0.58,
    particleScale: 0.5,
    historyScale: 0.8,
    blurCapPx: 12,
    optionalPasses: true,
    trailAlphaScale: 0.65,
  }),
  [NUDGE_RENDER_PRESSURE_LEVELS.SEVERE]: freezeCost({
    pixelRatioCap: 1,
    maxRenderPixels: 2_073_600,
    detailScale: 0.22,
    particleScale: 0,
    historyScale: 0.6,
    blurCapPx: 0,
    optionalPasses: false,
    trailAlphaScale: 0.35,
  }),
});

function createNudgeRenderBudget(pressureLevel) {
  const resolvedLevel = assertNudgeRenderPressureLevel(pressureLevel);
  const cost = NUDGE_RENDER_COSTS[resolvedLevel];
  if (!cost) {
    throw new Error(`NUDGE_RENDER_COST_MISSING:${resolvedLevel}`);
  }
  return Object.freeze({
    pressureLevel: resolvedLevel,
    render: createRenderBudget({
      policyId: `nudge-${resolvedLevel}`,
      targetFps: 60,
      pixelRatioCap: cost.pixelRatioCap,
      maxRenderPixels: cost.maxRenderPixels,
    }),
    cost,
    trailAlphaScale: cost.trailAlphaScale,
    allowExpensivePasses: cost.optionalPasses,
    koi: resolveNudgeKoiRenderProfile(cost),
    entity: resolveNudgeEntityRenderProfile(cost),
    globalDisplay: resolveNudgeGlobalDisplayRenderProfile(cost),
    globalBackground: resolveNudgeGlobalBackgroundRenderProfile(cost),
  });
}

export const NUDGE_RENDER_BUDGETS = Object.freeze({
  [NUDGE_RENDER_PRESSURE_LEVELS.NORMAL]: createNudgeRenderBudget(
    NUDGE_RENDER_PRESSURE_LEVELS.NORMAL,
  ),
  [NUDGE_RENDER_PRESSURE_LEVELS.PRESSURE]: createNudgeRenderBudget(
    NUDGE_RENDER_PRESSURE_LEVELS.PRESSURE,
  ),
  [NUDGE_RENDER_PRESSURE_LEVELS.SEVERE]: createNudgeRenderBudget(
    NUDGE_RENDER_PRESSURE_LEVELS.SEVERE,
  ),
});

export function resolveNudgeRenderBudget(pressureLevel) {
  const resolvedLevel = assertNudgeRenderPressureLevel(pressureLevel);
  const budget = NUDGE_RENDER_BUDGETS[resolvedLevel];
  if (!budget) {
    throw new Error(`NUDGE_RENDER_BUDGET_MISSING:${resolvedLevel}`);
  }
  return budget;
}
