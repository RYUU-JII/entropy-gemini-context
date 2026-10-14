import { createRenderBudget, requireRenderPixelRatioCap } from '@/platform/rendering/renderBudgetContract.js';
import {
  ZEN_QUALITY_MODES,
  normalizeZenQualityMode,
  resolveZenRenderPreset,
  resolveZenMainTargetFps,
  ZEN_GRAPHICS_BUDGETS,
} from './zenRenderQuality.js';
import {
  ZEN_BONSAI_CADENCE_CONTEXTS,
  resolveZenBonsaiCadenceContext,
  resolveZenBonsaiCadenceProfile,
} from './zenBonsaiCadenceProfile.js';
import {
  DEFAULT_ZEN_POND_FIRST_FRAME_EFFECT_POLICY,
  normalizeZenPondFirstFrameEffectPolicy,
} from '../pond/contracts/zenPondFirstFrameEffectPolicy.js';

export const ZEN_MAIN_WORKER_RENDER_BUDGET_SCHEMA_VERSION = 1;

export const ZEN_MAIN_WORKER_RENDER_BUDGET_POLICY_IDS = Object.freeze({
  FIXED_HOME: 'fixed-home',
});

const DEFAULT_POND_EFFECT_INTENSITY_SCALE = 1;
// Home's full-quality tree must retain native detail on DPR 2 displays. The
// complete expanded surface still shares the existing bounded pixel budget.
export const ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP = 2;

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const resolvePolicyId = (policyId = ZEN_MAIN_WORKER_RENDER_BUDGET_POLICY_IDS.FIXED_HOME) => {
  const normalized = typeof policyId === 'string' ? policyId.trim().toLowerCase() : '';
  if (!normalized || normalized === ZEN_MAIN_WORKER_RENDER_BUDGET_POLICY_IDS.FIXED_HOME) {
    return ZEN_MAIN_WORKER_RENDER_BUDGET_POLICY_IDS.FIXED_HOME;
  }
  throw new Error(`ZEN_MAIN_WORKER_RENDER_BUDGET_POLICY_UNKNOWN:${String(policyId || '')}`);
};

export const resolveZenMainPondWorkerRenderBudget = (budget = null) => {
  const input = isObject(budget) ? budget : {};
  const qualityMode = normalizeZenQualityMode(input.qualityMode, ZEN_QUALITY_MODES.FULL);
  const targetFps = Math.round(clampNumber(
    input.targetFps,
    12,
    120,
    resolveZenMainTargetFps(qualityMode),
  ));
  const pixelRatioCap = input.pixelRatioCap === undefined
    ? ZEN_GRAPHICS_BUDGETS[qualityMode].pixelRatioCap
    : requireRenderPixelRatioCap(input.pixelRatioCap);
  return Object.freeze({
    surface: 'pond',
    render: createRenderBudget({
      policyId: `zen-pond-${qualityMode}`,
      targetFps,
      pixelRatioCap,
      maxRenderPixels: ZEN_GRAPHICS_BUDGETS[qualityMode].maxRenderPixels,
    }),
    qualityMode,
    cadenceTier: typeof input.cadenceTier === 'string' && input.cadenceTier.trim()
      ? input.cadenceTier.trim()
      : qualityMode,
    targetFps,
    pixelRatioCap,
    effectIntensityScale: clampNumber(
      input.effectIntensityScale,
      0.2,
      2.4,
      DEFAULT_POND_EFFECT_INTENSITY_SCALE,
    ),
    firstFrameEffectPolicy: normalizeZenPondFirstFrameEffectPolicy(
      input.firstFrameEffectPolicy || DEFAULT_ZEN_POND_FIRST_FRAME_EFFECT_POLICY,
    ),
  });
};

export const resolveZenMainBonsaiWorkerRenderBudget = (budget = null) => {
  const input = isObject(budget) ? budget : {};
  const cadenceContext = typeof input.cadenceContext === 'string' && input.cadenceContext.trim()
    ? input.cadenceContext.trim()
    : ZEN_BONSAI_CADENCE_CONTEXTS.HOME_EMBEDDED;
  const resolvedCadenceContext = resolveZenBonsaiCadenceContext(cadenceContext);
  const cadenceProfile = resolveZenBonsaiCadenceProfile({
    cadenceContext: resolvedCadenceContext,
    qualityMode: input.qualityMode,
    targetFps: input.targetFps,
  });
  const pixelRatioCap = input.pixelRatioCap === undefined
    ? (cadenceProfile.qualityMode === ZEN_QUALITY_MODES.FULL
      ? ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP
      : ZEN_GRAPHICS_BUDGETS[cadenceProfile.qualityMode].pixelRatioCap)
    : requireRenderPixelRatioCap(input.pixelRatioCap);

  return Object.freeze({
    surface: 'bonsai',
    render: createRenderBudget({
      policyId: `zen-bonsai-${resolvedCadenceContext}`,
      targetFps: cadenceProfile.targetFps,
      pixelRatioCap,
      maxRenderPixels: 4_665_600,
    }),
    cadenceContext: resolvedCadenceContext,
    qualityMode: cadenceProfile.qualityMode,
    cadenceTier: cadenceProfile.cadenceTier,
    targetFps: cadenceProfile.targetFps,
    simHz: cadenceProfile.simHz,
    maxCatchUpSteps: cadenceProfile.maxCatchUpSteps,
    pixelRatioCap,
  });
};

const buildBudgetSignature = ({ policyId, preset, pond, bonsai } = {}) => [
  ZEN_MAIN_WORKER_RENDER_BUDGET_SCHEMA_VERSION,
  policyId,
  preset,
  `pond:${pond.render.policyId}:${pond.targetFps}:${pond.pixelRatioCap}:${pond.render.maxRenderPixels}:${pond.effectIntensityScale}:${pond.firstFrameEffectPolicy}`,
  `bonsai:${bonsai.render.policyId}:${bonsai.targetFps}:${bonsai.pixelRatioCap}:${bonsai.render.maxRenderPixels}`,
].join('|');

export const resolveZenMainWorkerRenderBudget = ({
  policyId = ZEN_MAIN_WORKER_RENDER_BUDGET_POLICY_IDS.FIXED_HOME,
  preset = ZEN_QUALITY_MODES.FULL,
} = {}) => {
  const resolvedPolicyId = resolvePolicyId(policyId);
  const selection = resolveZenRenderPreset(preset);
  const graphics = ZEN_GRAPHICS_BUDGETS[selection.graphicsQuality];
  const targetFps = resolveZenMainTargetFps(preset);
  const pond = resolveZenMainPondWorkerRenderBudget({
    qualityMode: selection.graphicsQuality,
    cadenceTier: selection.graphicsQuality === 'full' ? 'canonical' : selection.graphicsQuality,
    targetFps,
    pixelRatioCap: graphics.pixelRatioCap,
    effectIntensityScale: DEFAULT_POND_EFFECT_INTENSITY_SCALE,
    firstFrameEffectPolicy: DEFAULT_ZEN_POND_FIRST_FRAME_EFFECT_POLICY,
  });
  const bonsai = resolveZenMainBonsaiWorkerRenderBudget({
    cadenceContext: ZEN_BONSAI_CADENCE_CONTEXTS.HOME_EMBEDDED,
    qualityMode: selection.graphicsQuality,
    targetFps,
    pixelRatioCap: preset === ZEN_QUALITY_MODES.FULL ? ZEN_HOME_BONSAI_FULL_PIXEL_RATIO_CAP : graphics.pixelRatioCap,
  });

  return Object.freeze({
    schemaVersion: ZEN_MAIN_WORKER_RENDER_BUDGET_SCHEMA_VERSION,
    policyId: resolvedPolicyId,
    preset,
    graphicsQuality: selection.graphicsQuality,
    frameRatePolicy: selection.frameRatePolicy,
    pond,
    bonsai,
    signature: buildBudgetSignature({ policyId: resolvedPolicyId, preset, pond, bonsai }),
  });
};
