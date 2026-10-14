import { requireQualifiedUseDayCount } from '../contracts/qualifiedUseFacts.js';

export const PROGRESSION_JOURNEY_STARTER_FAMILY_IDS = Object.freeze(['lens', 'gate', 'flare']);
export const PROGRESSION_JOURNEY_FAMILY_ORDER = Object.freeze([
  ...PROGRESSION_JOURNEY_STARTER_FAMILY_IDS, 'brake', 'barrier', 'echo', 'veil',
]);
const stage = (qualifiedUseDayCount, newFamilyIds) => Object.freeze({
  qualifiedUseDayCount,
  newFamilyIds: Object.freeze(newFamilyIds),
});

// Family cardinality, use-day age, and the number of represented koi are
// independent contracts. Day one lets users experience the starter set.
export const PROGRESSION_JOURNEY_STAGES = Object.freeze([
  stage(0, [...PROGRESSION_JOURNEY_STARTER_FAMILY_IDS]),
  stage(1, []),
  stage(2, ['brake']),
  stage(3, ['barrier']),
  stage(4, ['echo']),
  stage(5, ['veil']),
]);
export const PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT = PROGRESSION_JOURNEY_STAGES.at(-1).qualifiedUseDayCount;

export function resolveProgressionJourneyStage(dayCount, { stages = PROGRESSION_JOURNEY_STAGES } = {}) {
  requireQualifiedUseDayCount(dayCount);
  const current = stages.findLast((entry) => entry.qualifiedUseDayCount <= dayCount);
  if (!current) throw new Error('PROGRESSION_JOURNEY_STAGE_REQUIRED');
  return current;
}

export function resolveProgressionJourneyFamilyIds(dayCount, {
  firstVisionSpent, stages = PROGRESSION_JOURNEY_STAGES,
} = {}) {
  if (typeof firstVisionSpent !== 'boolean') {
    throw new Error('PROGRESSION_JOURNEY_FIRST_VISION_STATE_REQUIRED');
  }
  const currentStage = resolveProgressionJourneyStage(dayCount, { stages });
  if (!firstVisionSpent) return Object.freeze([]);
  return Object.freeze(stages
    .filter((entry) => entry.qualifiedUseDayCount <= currentStage.qualifiedUseDayCount)
    .flatMap((entry) => entry.newFamilyIds));
}

export function resolveProgressionFamilyUnlockDay(familyId) {
  const entry = PROGRESSION_JOURNEY_STAGES.find((candidate) => candidate.newFamilyIds.includes(familyId));
  if (!entry) throw new Error('PROGRESSION_JOURNEY_FAMILY_UNKNOWN');
  return entry.qualifiedUseDayCount;
}
