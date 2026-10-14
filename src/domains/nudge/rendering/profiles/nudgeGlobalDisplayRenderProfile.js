import {
  capRenderBlur,
  freezeRenderProfile,
  scaleRenderCount,
} from './nudgeRenderProfileUtils.js';

const CANONICAL_GLOBAL_DISPLAY_PROFILE = Object.freeze({
  deadCells: 28,
  microTears: 12,
  craterRings: 3,
  spall: 11,
  rgbSliceRows: 5,
  frontShadowBlur: 12,
});

export function resolveNudgeGlobalDisplayRenderProfile(cost) {
  return freezeRenderProfile({
    deadCells: scaleRenderCount(CANONICAL_GLOBAL_DISPLAY_PROFILE.deadCells, cost.detailScale, 6),
    microTears: scaleRenderCount(CANONICAL_GLOBAL_DISPLAY_PROFILE.microTears, cost.detailScale, 3),
    craterRings: scaleRenderCount(CANONICAL_GLOBAL_DISPLAY_PROFILE.craterRings, cost.detailScale, 1),
    spall: scaleRenderCount(CANONICAL_GLOBAL_DISPLAY_PROFILE.spall, cost.detailScale, 3, 'ceil'),
    shadowsEnabled: cost.blurCapPx > 0,
    deadCellLargeEvery: cost.detailScale > 0.9 ? 6 : 0,
    deadCellMediumEvery: cost.optionalPasses ? (cost.detailScale > 0.9 ? 3 : 5) : 0,
    rgbSliceRows: scaleRenderCount(CANONICAL_GLOBAL_DISPLAY_PROFILE.rgbSliceRows, cost.detailScale, 1),
    spallStrokeEnabled: cost.detailScale > 0.9,
    frontShadowBlur: capRenderBlur(
      CANONICAL_GLOBAL_DISPLAY_PROFILE.frontShadowBlur,
      cost.detailScale,
      cost.blurCapPx,
      cost.optionalPasses,
    ),
    frontEndpointEnabled: cost.optionalPasses,
  });
}
