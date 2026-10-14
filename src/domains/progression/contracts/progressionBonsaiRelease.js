import { requireQualifiedUseDayCount as requireRawQualifiedUseDayCount } from './qualifiedUseFacts.js';

export const PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT = 5;
export const PROGRESSION_UNLOCK_BONSAI_FULL_FORM_SCORE = 88;
export const PROGRESSION_BONSAI_RELEASE_CONTRACT = 'progression_bonsai_release_v1';

export const PROGRESSION_BONSAI_RELEASE_STAGE_IDS = Object.freeze({
  FIRST_SIGHT: 'first_sight',
  SEEDLING: 'seedling',
  YOUNG_BONSAI: 'young_bonsai',
  TRAINED_SHAPE: 'trained_shape',
  FLOWER_BUD: 'flower_bud',
  FULL_BLOOM: 'full_bloom',
});

export const PROGRESSION_BONSAI_RELEASE_STAGES = Object.freeze([
  { id: PROGRESSION_BONSAI_RELEASE_STAGE_IDS.FIRST_SIGHT, labelKey: 'progression.bonsaiGrowth.firstSight',
    minScore: 0, maxScore: 8, meaning: 'No real protection yet, but the garden is alive.' },
  { id: PROGRESSION_BONSAI_RELEASE_STAGE_IDS.SEEDLING, labelKey: 'progression.bonsaiGrowth.seedling',
    minScore: 9, maxScore: 23, meaning: 'The first protected site is taking root.' },
  { id: PROGRESSION_BONSAI_RELEASE_STAGE_IDS.YOUNG_BONSAI, labelKey: 'progression.bonsaiGrowth.youngBonsai',
    minScore: 24, maxScore: 43, meaning: 'Repeated practice has started.' },
  { id: PROGRESSION_BONSAI_RELEASE_STAGE_IDS.TRAINED_SHAPE, labelKey: 'progression.bonsaiGrowth.trainedShape',
    minScore: 44, maxScore: 59, meaning: 'The garden is forming a visible rhythm.' },
  { id: PROGRESSION_BONSAI_RELEASE_STAGE_IDS.FLOWER_BUD, labelKey: 'progression.bonsaiGrowth.flowerBud',
    minScore: 60, maxScore: 84, meaning: 'Durable change is beginning to flower.' },
  { id: PROGRESSION_BONSAI_RELEASE_STAGE_IDS.FULL_BLOOM, labelKey: 'progression.bonsaiGrowth.fullBloom',
    minScore: 85, maxScore: 100, meaning: 'The real garden is approaching the first vision.' },
].map(Object.freeze));

const RELEASE_STAGE_ID_VALUES = new Set(Object.values(PROGRESSION_BONSAI_RELEASE_STAGE_IDS));

function createReleaseContractError(field) {
  const error = new Error(`PROGRESSION_UNLOCK_CONTRACT_INVALID:${field}`);
  error.code = 'PROGRESSION_UNLOCK_CONTRACT_INVALID';
  error.field = field;
  return error;
}
function requireReleaseDayCount(value) {
  if (
    !Number.isInteger(value)
    || value < 0
    || value > PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT
  ) {
    throw createReleaseContractError('bonsaiRelease.qualifiedUseDayCount');
  }
  return value;
}

function resolveReleaseStageId(growthScore) {
  const stage = PROGRESSION_BONSAI_RELEASE_STAGES.find((candidate) =>
    growthScore >= candidate.minScore && growthScore <= candidate.maxScore);
  if (!stage) throw createReleaseContractError('bonsaiRelease.growthScore');
  return stage.id;
}

export function buildProgressionBonsaiRelease(qualifiedUseDayCount, {
  fullFormDayCount = PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT,
} = {}) {
  requireRawQualifiedUseDayCount(qualifiedUseDayCount);
  if (!Number.isSafeInteger(fullFormDayCount) || fullFormDayCount < 1) {
    throw createReleaseContractError('bonsaiRelease.targetDayCount');
  }
  const dayCount = Math.min(qualifiedUseDayCount, fullFormDayCount);
  const releaseRatio = Number((dayCount / fullFormDayCount).toFixed(4));
  const growthScore = Math.round(
    releaseRatio * PROGRESSION_UNLOCK_BONSAI_FULL_FORM_SCORE,
  );
  return Object.freeze({
    contract: PROGRESSION_BONSAI_RELEASE_CONTRACT,
    qualifiedUseDayCount: dayCount,
    targetDayCount: fullFormDayCount,
    releaseRatio,
    growthScore,
    stageId: resolveReleaseStageId(growthScore),
    fullFormReady: dayCount === fullFormDayCount,
  });
}

export function requireProgressionBonsaiRelease(value) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || value.contract !== PROGRESSION_BONSAI_RELEASE_CONTRACT
  ) {
    throw createReleaseContractError('bonsaiRelease.contract');
  }
  const canonical = buildProgressionBonsaiRelease(value.qualifiedUseDayCount);
  requireReleaseDayCount(value.qualifiedUseDayCount);
  if (
    value.targetDayCount !== canonical.targetDayCount
    || value.releaseRatio !== canonical.releaseRatio
    || value.growthScore !== canonical.growthScore
    || !RELEASE_STAGE_ID_VALUES.has(value.stageId)
    || value.stageId !== canonical.stageId
    || value.fullFormReady !== canonical.fullFormReady
  ) {
    throw createReleaseContractError('bonsaiRelease');
  }
  return value;
}

export function isProgressionBonsaiFirstBloomEligible({
  firstVisionSpent, bonsaiRelease, bonsaiFirstBloomOpened, canonicalMode,
}) {
  if (typeof firstVisionSpent !== 'boolean'
    || typeof bonsaiFirstBloomOpened !== 'boolean' || typeof canonicalMode !== 'boolean') {
    throw new Error('BONSAI_FIRST_BLOOM_ELIGIBILITY_FACTS_REQUIRED');
  }
  requireProgressionBonsaiRelease(bonsaiRelease);
  return canonicalMode && firstVisionSpent && bonsaiRelease.fullFormReady && !bonsaiFirstBloomOpened;
}
