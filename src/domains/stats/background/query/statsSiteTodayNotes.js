import { parseLocalDateParts } from '../../shared/dateMath.js';
import {
  SITE_TODAY_NOTES_VERSION,
  SITE_TODAY_NOTES_BASIS,
  requireSiteTodayNotes,
} from '../../contracts/siteTodayNotesContract.js';

function fail(context) {
  const error = new Error('SITE_TODAY_NOTES_SOURCE_INVALID');
  error.code = 'SITE_TODAY_NOTES_SOURCE_INVALID';
  error.context = context;
  throw error;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isDuration(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function requireTodayFacts(intel) {
  if (!isRecord(intel) || intel.todayBasis !== 'calendar-day' || intel.todayHorizon !== 'calendar_today'
    || !parseLocalDateParts(intel.todayDateStr) || typeof intel.todayObserved !== 'boolean') fail('period');
  if (!isDuration(intel.todayTotal) || !isCount(intel.todayVisits)
    || !Array.isArray(intel.todayHourly) || intel.todayHourly.length !== 24
    || Array.from(intel.todayHourly).some(value => !isDuration(value))
    || Math.abs(intel.todayHourly.reduce((sum, value) => sum + value, 0) - intel.todayTotal) > 0.001) fail('activity');
  const sessions = intel.todaySessionStats;
  if (!isRecord(sessions) || ['count', 'shortCount', 'longCount'].some(key => !isCount(sessions[key]))
    || !isDuration(sessions.totalMs) || !isDuration(sessions.maxMs)
    || sessions.shortCount + sessions.longCount > sessions.count
    || sessions.maxMs > sessions.totalMs) fail('sessions');
  if (!isRecord(intel.todayBehaviorStats) || !isCount(intel.todayBehaviorStats.revisitWithin5m)
    || intel.todayBehaviorStats.revisitWithin5m > intel.todayVisits) fail('visits');
  const interventions = intel.todayInterventionStats;
  if (!isRecord(interventions)
    || ['frictionShown', 'continued', 'left'].some(key => !isCount(interventions[key]))) fail('interventions');
  if (!intel.todayObserved && (intel.todayTotal > 0 || intel.todayVisits > 0
    || ['count', 'shortCount', 'longCount', 'totalMs', 'maxMs'].some(key => sessions[key] > 0)
    || intel.todayBehaviorStats.revisitWithin5m > 0
    || ['frictionShown', 'continued', 'left'].some(key => interventions[key] > 0))) fail('observation');
}

function peakTwoHourWindow(hourly) {
  let startHour = 0;
  let activeMs = hourly[0] + hourly[1];
  // Both hours belong to this calendar date. Equal peaks retain the earlier start.
  for (let hour = 1; hour <= 22; hour += 1) {
    const candidateMs = hourly[hour] + hourly[hour + 1];
    if (candidateMs > activeMs) {
      startHour = hour;
      activeMs = candidateMs;
    }
  }
  return {
    value: activeMs,
    window: { startHour, durationHours: 2, endHourExclusive: startHour + 2, wrapsMidnight: false },
  };
}

// Terminal display facts: neither interpretation output nor a classifier input.
export function buildSitesSiteTodayNotes(intel) {
  requireTodayFacts(intel);
  const notes = [];
  if (intel.todayObserved) {
    const sessions = intel.todaySessionStats;
    if (sessions.count > 0) notes.push({
      id: 'short_sessions', value: sessions.shortCount, denominator: sessions.count,
      unit: 'count', source: 'todaySessionStats.shortCount',
    });
    if (intel.todayTotal > 0) {
      const peak = peakTwoHourWindow(intel.todayHourly);
      if (peak.value > 0) notes.push({
        id: 'peak_time_window', ...peak, denominator: intel.todayTotal,
        unit: 'duration_ms', source: 'todayHourly',
      });
    }
    if (intel.todayVisits > 0) notes.push({
      id: 'revisit_within_5m', value: intel.todayBehaviorStats.revisitWithin5m, denominator: intel.todayVisits,
      unit: 'count', source: 'todayBehaviorStats.revisitWithin5m',
    });
    const interventions = intel.todayInterventionStats;
    if (interventions.frictionShown > 0) notes.push({
      id: 'friction_response', value: interventions.frictionShown, denominator: interventions.frictionShown,
      unit: 'count', source: 'todayInterventionStats',
      // Independent event-date counters; these are not shares of today's shown events.
      responses: { continued: interventions.continued, left: interventions.left },
    });
  }
  return requireSiteTodayNotes({
    version: SITE_TODAY_NOTES_VERSION,
    basis: SITE_TODAY_NOTES_BASIS,
    status: intel.todayObserved ? 'observed' : 'missing',
    dateStr: intel.todayDateStr,
    notes,
  });
}
