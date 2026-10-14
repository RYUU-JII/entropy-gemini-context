import { getLocalDateStr } from '../../../lib/index.js';

export const DEFAULT_ACTIVITY_DAY_RESET_HOUR = 4;

export function resolveActivityDayWindow({
  now = Date.now(),
  resetHour = DEFAULT_ACTIVITY_DAY_RESET_HOUR,
} = {}) {
  if (!Number.isSafeInteger(now) || !Number.isFinite(new Date(now).getTime())) {
    throw new Error('STATS_ACTIVITY_DAY_TIMESTAMP_INVALID');
  }
  if (!Number.isInteger(resetHour) || resetHour < 0 || resetHour > 23) {
    throw new Error('STATS_ACTIVITY_DAY_RESET_HOUR_INVALID');
  }
  const boundaryHour = resetHour;
  const start = new Date(now);
  start.setHours(boundaryHour, 0, 0, 0);
  if (start.getTime() > now) {
    start.setDate(start.getDate() - 1);
  }

  const end = new Date(start.getTime());
  end.setHours(start.getHours() + 23, 0, 0, 0);
  const nextStart = new Date(start.getTime());
  nextStart.setDate(nextStart.getDate() + 1);
  nextStart.setHours(boundaryHour, 0, 0, 0);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())
    || !Number.isFinite(nextStart.getTime())) {
    throw new Error('STATS_ACTIVITY_DAY_WINDOW_INVALID');
  }

  return {
    basis: 'activity-day',
    resetHour: boundaryHour,
    startDateStr: getLocalDateStr(start.getTime()),
    endDateStr: getLocalDateStr(end.getTime()),
    startHour: boundaryHour,
    endHour: end.getHours(),
    startEpochMs: start.getTime(),
    nextStartEpochMs: nextStart.getTime(),
    endEpochMs: end.getTime(),
  };
}
