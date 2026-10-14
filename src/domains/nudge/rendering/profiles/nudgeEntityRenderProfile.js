import {
  capRenderBlur,
  freezeRenderProfile,
  scaleRenderCount,
} from './nudgeRenderProfileUtils.js';

const CANONICAL_ENTITY_RENDER_PROFILE = Object.freeze({
  terminalResidueCount: 5,
  siteWakeHistoryLimit: 24,
  rendezvousStrandCount: 3,
  rendezvousRippleCount: 3,
  globalKoiShadowBlur: 18,
  globalEscapeKoiShadowBlur: 24,
  shadowKoiBlur: 11,
  genericShadowBase: 8,
  genericShadowPulse: 12,
  inkParticleCount: 18,
});

export function resolveNudgeEntityRenderProfile(cost) {
  const optional = cost.optionalPasses;
  const reducedAlphaScale = optional ? 1 : 0.58;
  return freezeRenderProfile({
    terminalResidueEnabled: optional,
    terminalResidueCount: scaleRenderCount(CANONICAL_ENTITY_RENDER_PROFILE.terminalResidueCount, cost.detailScale, 3),
    // The guide wake is a world-space trace, not geometry attached to the koi.
    // Pressure shortens the trace and drops secondary ripples without removing it.
    siteWakeAlpha: 0.3 * reducedAlphaScale,
    siteWakeHistoryLimit: scaleRenderCount(
      CANONICAL_ENTITY_RENDER_PROFILE.siteWakeHistoryLimit,
      cost.historyScale,
      10,
    ),
    siteWakeLifetimeMs: optional ? 1450 : 920,
    siteWakeRippleStride: optional ? 4 : 0,
    rendezvousStrandCount: scaleRenderCount(CANONICAL_ENTITY_RENDER_PROFILE.rendezvousStrandCount, cost.detailScale, 1),
    rendezvousRippleCount: scaleRenderCount(CANONICAL_ENTITY_RENDER_PROFILE.rendezvousRippleCount, cost.detailScale, 1),
    rendezvousStrongStyle: optional,
    vulnerabilityTelegraphAlpha: 0.66 * reducedAlphaScale,
    vulnerabilityActiveAlpha: 0.84 * reducedAlphaScale,
    vulnerabilityFeedbackAlpha: 0.52 * reducedAlphaScale,
    vulnerabilityBlurEnabled: optional,
    vulnerabilityDetailEnabled: optional,
    globalKoiShadowBlur: capRenderBlur(CANONICAL_ENTITY_RENDER_PROFILE.globalKoiShadowBlur, 1, cost.blurCapPx),
    globalEscapeKoiShadowBlur: capRenderBlur(CANONICAL_ENTITY_RENDER_PROFILE.globalEscapeKoiShadowBlur, 1, cost.blurCapPx),
    shadowKoiBlur: capRenderBlur(CANONICAL_ENTITY_RENDER_PROFILE.shadowKoiBlur, cost.detailScale, cost.blurCapPx),
    genericShadowBase: capRenderBlur(CANONICAL_ENTITY_RENDER_PROFILE.genericShadowBase, cost.detailScale, cost.blurCapPx),
    genericShadowPulse: capRenderBlur(CANONICAL_ENTITY_RENDER_PROFILE.genericShadowPulse, cost.detailScale, cost.blurCapPx),
    beamEnabled: optional,
    inkParticleCount: scaleRenderCount(CANONICAL_ENTITY_RENDER_PROFILE.inkParticleCount, cost.particleScale, 7),
    inkHaloEnabled: optional,
  });
}
