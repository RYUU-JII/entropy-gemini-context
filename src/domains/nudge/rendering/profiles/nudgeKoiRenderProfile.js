import {
  freezeRenderProfile,
  scaleRenderCount,
} from './nudgeRenderProfileUtils.js';

const CANONICAL_KOI_RENDER_PROFILE = Object.freeze({
  historyLength: 31,
  outlineWidthScale: 0.042,
  crackLineWidthScale: 0.011,
});

export function resolveNudgeKoiRenderProfile(cost) {
  return freezeRenderProfile({
    historyLength: scaleRenderCount(
      CANONICAL_KOI_RENDER_PROFILE.historyLength,
      cost.historyScale,
      19,
    ),
    includePectoral: cost.optionalPasses,
    outlineWidthScale: CANONICAL_KOI_RENDER_PROFILE.outlineWidthScale
      * (0.6 + cost.detailScale * 0.4),
    crackLineWidthScale: cost.optionalPasses
      ? CANONICAL_KOI_RENDER_PROFILE.crackLineWidthScale
      : 0.008,
  });
}
