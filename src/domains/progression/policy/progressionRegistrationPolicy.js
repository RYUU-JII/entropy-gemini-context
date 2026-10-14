import { requireQualifiedUseDayCount } from '../contracts/qualifiedUseFacts.js';

export const PROGRESSION_REPRESENTED_SITE_LIMIT = 5;
export const PROGRESSION_DIRECT_REGISTRATION_SITE_COUNT = 5;
export const PROGRESSION_DIRECT_REGISTRATION_DAY_COUNT = 5;

const stage = (qualifiedUseDayCount, limit) => Object.freeze({ qualifiedUseDayCount,
  siteRegistrationBudget: Object.freeze(limit === null ? { mode: 'unlimited' } : { mode: 'limited', limit }) });

export const PROGRESSION_REGISTRATION_STAGES = Object.freeze([
  stage(0, 1), stage(2, 2), stage(3, 3), stage(4, 4), stage(5, null),
]);
export const PROGRESSION_REGISTRATION_TARGET_DAY_COUNT = PROGRESSION_REGISTRATION_STAGES.at(-1).qualifiedUseDayCount;

export function resolveProgressionSiteRegistrationBudget(dayCount, {
  accessOpen = false, stages = PROGRESSION_REGISTRATION_STAGES,
} = {}) {
  requireQualifiedUseDayCount(dayCount);
  if (typeof accessOpen !== 'boolean') throw new Error('PROGRESSION_SITE_REGISTRATION_POLICY_INVALID');
  if (accessOpen) return Object.freeze({ mode: 'unlimited' });
  const current = stages.findLast((entry) => entry.qualifiedUseDayCount <= dayCount);
  if (!current) throw new Error('PROGRESSION_SITE_REGISTRATION_STAGE_REQUIRED');
  return current.siteRegistrationBudget;
}

export function resolveProgressionNextSiteRegistrationIncreaseDay(dayCount, options = {}) {
  const currentBudget = resolveProgressionSiteRegistrationBudget(dayCount, options);
  if (currentBudget.mode === 'unlimited') return null;
  const stages = options.stages === undefined ? PROGRESSION_REGISTRATION_STAGES : options.stages;
  const next = stages.find((entry) => entry.qualifiedUseDayCount > dayCount
    && (entry.siteRegistrationBudget.mode === 'unlimited'
      || entry.siteRegistrationBudget.limit > currentBudget.limit));
  if (!next) throw new Error('PROGRESSION_SITE_REGISTRATION_TERMINAL_STAGE_REQUIRED');
  return next.qualifiedUseDayCount;
}

export function resolveProgressionSiteSlotUnlockDay(slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > PROGRESSION_REPRESENTED_SITE_LIMIT) {
    throw new Error('PROGRESSION_SITE_SLOT_INDEX_INVALID');
  }
  const available = PROGRESSION_REGISTRATION_STAGES.find((entry) =>
    entry.siteRegistrationBudget.mode === 'unlimited' || entry.siteRegistrationBudget.limit >= slotIndex);
  if (!available) throw new Error('PROGRESSION_SITE_SLOT_STAGE_REQUIRED');
  return available.qualifiedUseDayCount;
}

export function isProgressionDirectRegistrationReady({ protectedSiteCount, qualifiedUseDayCount }) {
  if (!Number.isInteger(protectedSiteCount) || protectedSiteCount < 0) {
    throw new Error('SITE_REGISTRATION_JOURNEY_PROTECTED_SITE_COUNT_REQUIRED');
  }
  requireQualifiedUseDayCount(qualifiedUseDayCount);
  return protectedSiteCount >= PROGRESSION_DIRECT_REGISTRATION_SITE_COUNT
    || qualifiedUseDayCount >= PROGRESSION_DIRECT_REGISTRATION_DAY_COUNT;
}
