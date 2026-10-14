import {
  freezeRenderProfile,
  scaleRenderCount,
} from './nudgeRenderProfileUtils.js';

const CANONICAL_GLOBAL_BACKGROUND_PROFILE = Object.freeze({
  entryLcdRows: 17,
  entryLcdColumns: 25,
  moteCount: 18,
});

export function resolveNudgeGlobalBackgroundRenderProfile(cost) {
  const fullRiftDetail = cost.detailScale > 0.8;
  const severeRiftDetail = cost.optionalPasses !== true;
  return freezeRenderProfile({
    structuralShadowBlurCapPx: Math.max(0, Number(cost.blurCapPx) || 0),
    entryLcdEnabled: cost.optionalPasses,
    entryLcdCell: cost.detailScale > 0.8 ? 3 : 4,
    entryLcdRows: cost.optionalPasses
      ? scaleRenderCount(CANONICAL_GLOBAL_BACKGROUND_PROFILE.entryLcdRows, cost.detailScale, 9)
      : 0,
    entryLcdColumns: cost.optionalPasses
      ? scaleRenderCount(CANONICAL_GLOBAL_BACKGROUND_PROFILE.entryLcdColumns, cost.detailScale, 13)
      : 0,
    perspectiveLayers: fullRiftDetail ? 4 : (severeRiftDetail ? 1 : 2),
    connectivePassesEnabled: fullRiftDetail,
    moteCount: scaleRenderCount(CANONICAL_GLOBAL_BACKGROUND_PROFILE.moteCount, cost.detailScale, 4),
    edgeShadowEnabled: fullRiftDetail,
    tertiaryPassesEnabled: fullRiftDetail,
    fractureMicroRays: scaleRenderCount(52, cost.detailScale, 12),
    fractureDriverColumns: scaleRenderCount(96, cost.detailScale, 16),
    fractureDriverRows: scaleRenderCount(40, cost.detailScale, 6),
    fractureBloomEnabled: fullRiftDetail,
    repairStitches: scaleRenderCount(14, cost.detailScale, 5),
    repairStressFlecks: scaleRenderCount(12, cost.detailScale, 3),
  });
}
