import { DEFAULT_ACTIVITY_DAY_RESET_HOUR } from '../../stats/shared/activityDay.js';

// Qualification is independent of every consumer's release schedule.
export const PROGRESSION_QUALIFIED_USE_DAY_POLICY = Object.freeze({
  activityDayResetHour: DEFAULT_ACTIVITY_DAY_RESET_HOUR,
  qualifiedUseDayQualification: 'successfully_recorded_managed_protected_visit',
  maximumQualifiedUseCreditsPerActivityDay: 1,
  streakRequired: false,
  missedDayReset: false,
});
