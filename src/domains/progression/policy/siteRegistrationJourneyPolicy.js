import { requireProgressionUnlockSnapshot } from './progressionUnlockPolicy.js';
import {
  PROGRESSION_REPRESENTED_SITE_LIMIT,
  PROGRESSION_DIRECT_REGISTRATION_DAY_COUNT,
  isProgressionDirectRegistrationReady,
  resolveProgressionSiteRegistrationBudget,
  resolveProgressionNextSiteRegistrationIncreaseDay,
} from './progressionRegistrationPolicy.js';

export const SITE_REGISTRATION_JOURNEY_CONTRACT = 'site_registration_journey_v1';

export function requireProtectedSiteCount(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('SITE_REGISTRATION_JOURNEY_PROTECTED_SITE_COUNT_REQUIRED');
  }
  return value;
}

export function requireAllowedSiteCount(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('SITE_REGISTRATION_JOURNEY_ALLOWED_SITE_COUNT_REQUIRED');
  }
  return value;
}

export function requireSiteRegistrationJourneyMilestones(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 3
    || typeof value.firstProtectedSiteRegistered !== 'boolean'
    || typeof value.directRegistrationUnlocked !== 'boolean'
    || !Number.isInteger(value.admittedInvitationCapacity)
    || value.admittedInvitationCapacity < 0
    || value.admittedInvitationCapacity > PROGRESSION_REPRESENTED_SITE_LIMIT) {
    throw new Error('SITE_REGISTRATION_JOURNEY_MILESTONES_REQUIRED');
  }
  return value;
}

export function hasCompletedSiteRegistrationJourney({ protectedSiteCount, qualifiedUseDayCount }) {
  requireProtectedSiteCount(protectedSiteCount);
  if (!Number.isInteger(qualifiedUseDayCount) || qualifiedUseDayCount < 0) {
    throw new Error('SITE_REGISTRATION_JOURNEY_USE_DAY_COUNT_REQUIRED');
  }
  return isProgressionDirectRegistrationReady({ protectedSiteCount, qualifiedUseDayCount });
}

// This projection is shared by Main, Sites, Popup and the background admission
// route. Only the progression service can persist its monotonic milestones.
export function buildSiteRegistrationJourneySnapshot({
  unlockProgress,
  protectedSiteCount,
  allowedSiteCount,
  firstProtectedSiteRegistered,
  directRegistrationUnlocked,
  admittedInvitationCapacity,
}) {
  const unlock = requireProgressionUnlockSnapshot(unlockProgress);
  const count = requireProtectedSiteCount(protectedSiteCount);
  const allowedCount = requireAllowedSiteCount(allowedSiteCount);
  requireSiteRegistrationJourneyMilestones({ firstProtectedSiteRegistered, directRegistrationUnlocked,
    admittedInvitationCapacity });
  const budget = unlock.siteRegistrationBudget;
  const remainingRegistrationCount = budget.mode === 'unlimited'
    ? null : Math.max(0, budget.limit - count);
  const directRegistrationEnabled = directRegistrationUnlocked
    || hasCompletedSiteRegistrationJourney({
      protectedSiteCount: count,
      qualifiedUseDayCount: unlock.qualifiedUseFacts.effectiveDayCount,
    });
  const nextIncreaseDay = budget.mode === 'unlimited' ? null
    : resolveProgressionNextSiteRegistrationIncreaseDay(unlock.qualifiedUseFacts.effectiveDayCount);
  const nextBudget = nextIncreaseDay === null ? null
    : resolveProgressionSiteRegistrationBudget(nextIncreaseDay);
  return Object.freeze({
    contract: SITE_REGISTRATION_JOURNEY_CONTRACT,
    protectedSiteCount: count,
    mode: budget.mode,
    limit: budget.mode === 'unlimited' ? null : budget.limit,
    available: remainingRegistrationCount === null || remainingRegistrationCount > 0,
    nextIncreaseDay,
    nextLimit: nextBudget === null || nextBudget.mode === 'unlimited' ? null : nextBudget.limit,
    remainingRegistrationCount,
    invitationCount: directRegistrationEnabled
      ? (remainingRegistrationCount === null || remainingRegistrationCount > 0 ? 1 : 0)
      : remainingRegistrationCount,
    sitesManagementVisible: firstProtectedSiteRegistered || count > 0 || allowedCount > 0
      || (unlock.debugOverrideActive && unlock.qualifiedUseFacts.effectiveDayCount >= PROGRESSION_DIRECT_REGISTRATION_DAY_COUNT),
    directRegistrationEnabled,
    requiresDashboardRegistration: !directRegistrationEnabled,
    admittedInvitationCapacity,
  });
}
