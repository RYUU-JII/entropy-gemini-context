import { DEFAULT_KOI_TUNING } from '../../../themes/plugins/zen/api/koi.js';
import { assertNudgeScenePhase } from '../nudge/nudgeGameScene.js';
import { normalizeSentinelFlareProtocolScope } from '../runtime/sentinelFlareProtocolProfile.js';

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeScenePhase(value) {
  return assertNudgeScenePhase(value, 'nudge_shadow_koi_scene_phase') === 'escape'
    ? 'escape'
    : 'ritual';
}

function resolveDisabledShadowProfile() {
  return { enabled: false, cadence: 0, blur: 0, opacity: 0, scale: 1 };
}

function resolveKoiBudget(renderBudget) {
  if (!renderBudget?.koi || typeof renderBudget.render?.policyId !== 'string') {
    throw new Error('NUDGE_KOI_RENDER_BUDGET_REQUIRED');
  }
  return renderBudget.koi;
}

// Pure, allocation-aware derivations. These let the per-frame render path
// (NudgeShadowKoiEntity) memoize the expensive objects (tuning / render policy)
// and compute the cheap per-frame scalars (speed, time) without constructing a
// policy instance every frame per koi. The class below delegates to these so
// there is a single source of truth.
export function resolveKoiHistoryLengthFor(renderBudget) {
  return resolveKoiBudget(renderBudget).historyLength;
}

export function resolveKoiTuningFor(renderBudget, baseSize) {
  return {
    ...DEFAULT_KOI_TUNING,
    baseSize: clamp(baseSize, 6, 56),
    historyLength: resolveKoiHistoryLengthFor(renderBudget),
    physics: {
      ...DEFAULT_KOI_TUNING.physics,
      debugOverlay: false,
      debugVectors: false,
    },
  };
}

export function resolveKoiSpeedMultiplierFor(baseSpeedMultiplier, speedScalar) {
  const base = Number(baseSpeedMultiplier) || 1;
  const scalar = clamp(speedScalar, 0.4, 4);
  const compressedScalar = 1 + ((scalar - 1) * 0.42);
  return clamp(base * compressedScalar * 0.78, 0.24, 2.4);
}

export function resolveKoiTimeScaleFor(dt) {
  return clamp(clamp(dt, 1 / 240, 0.05) * 60 * 0.84, 0.22, 2.2);
}

export function resolveKoiRenderPolicyFor({
  renderBudget,
  intensity = 1,
  protocolScope = 'site',
  scenePhase = 'ritual',
  appearance = 'sentinel',
} = {}) {
  const koiBudget = resolveKoiBudget(renderBudget);
  const alphaScale = clamp(intensity, 0.1, 1.2);
  const globalSignal = normalizeSentinelFlareProtocolScope(protocolScope) === 'global';
  normalizeScenePhase(scenePhase);
  if (!['sentinel', 'shikigami'].includes(appearance)) throw new Error('NUDGE_KOI_APPEARANCE_INVALID');
  const includePectoral = koiBudget.includePectoral;
  const passes = {
    body: true,
    tail: true,
    pectoral: includePectoral,
  };
  if (!globalSignal || appearance === 'shikigami') {
    return {
      mode: 'natural',
      passes,
      shadowRenderProfile: resolveDisabledShadowProfile(),
      glitch: { enabled: false, offsetPx: 0, redGhostAlpha: 0, paleGhostAlpha: 0 },
      hideLabel: true,
    };
  }
  return {
    mode: 'shadow',
    passes,
    // The sentinel is allowed to exceed the viewport; clipping must never
    // compress its tail into a different animal during camera projection.
    tailCanvasFit: false,
    shadowRenderProfile: resolveDisabledShadowProfile(),
    // A dense, continuous shadow: only the fin tips lose density.
    shadowBodyAlpha: clamp(0.99 * alphaScale, 0.94, 1),
    shadowTailAlpha: clamp(0.98 * alphaScale, 0.92, 1),
    shadowFinAlpha: clamp(0.98 * alphaScale, 0.92, 1),
    shadowOutlineColor: '',
    shadowOutlineWidthScale: 0,
    shadowCrackColor: '',
    shadowCrackLineWidthScale: 0,
    glitch: { enabled: false, offsetPx: 0, redGhostAlpha: 0, paleGhostAlpha: 0 },
    hideLabel: true,
  };
}

class NudgeShadowKoiPolicy {
  constructor({
    renderBudget,
    intensity = 1,
    speedScalar = 1,
    dt = 1 / 60,
    baseSize = 16,
    protocolScope = 'site',
    scenePhase = 'ritual',
  } = {}) {
    resolveKoiBudget(renderBudget);
    this.renderBudget = renderBudget;
    this.intensity = clamp(intensity, 0.1, 1.2);
    this.speedScalar = clamp(speedScalar, 0.4, 4);
    this.dt = clamp(dt, 1 / 240, 0.05);
    this.baseSize = clamp(baseSize, 6, 56);
    this.protocolScope = normalizeSentinelFlareProtocolScope(protocolScope);
    this.scenePhase = normalizeScenePhase(scenePhase);
  }

  resolveHistoryLength() {
    return resolveKoiHistoryLengthFor(this.renderBudget);
  }

  resolveKoiTuning() {
    return resolveKoiTuningFor(this.renderBudget, this.baseSize);
  }

  resolveRenderPolicy() {
    return resolveKoiRenderPolicyFor({
      renderBudget: this.renderBudget,
      intensity: this.intensity,
      protocolScope: this.protocolScope,
      scenePhase: this.scenePhase,
    });
  }

  resolveSpeedMultiplier(baseSpeedMultiplier) {
    return resolveKoiSpeedMultiplierFor(baseSpeedMultiplier, this.speedScalar);
  }

  resolveTimeScale() {
    return resolveKoiTimeScaleFor(this.dt);
  }
}

export { NudgeShadowKoiPolicy };
