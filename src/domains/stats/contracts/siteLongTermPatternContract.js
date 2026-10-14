import { parseLocalDateParts, shiftDateStr } from '../shared/dateMath.js';

export const SITE_LONG_TERM_PATTERNS_VERSION = 'sites-site-long-term-patterns-v2';
export const SITE_LONG_TERM_PATTERNS_BASIS = 'completed-calendar-day-hourly-domain-activity';
export const SITE_LONG_TERM_PATTERNS_WINDOW_DAYS = 30;
export const SITE_OBSERVATION_AXES_VERSION = 'sites-site-observation-axes-v1';
export const SITE_OBSERVATION_CHANGE_HALF_DAYS = 15;
export const SITE_OBSERVATION_CHANGE_MIN_OBSERVED_DAYS = 7;
export const SITE_LONG_TERM_PATTERN_CRITERIA = Object.freeze({
  minObservedDays: 7,
  minActiveDays: 4,
  minRepeatedDays: 3,
  minRepeatedActiveDayShare: 0.5,
  shortSessionMaxMsExclusive: 2 * 60_000,
  longSessionMinMs: 20 * 60_000,
  shortDailyCount: 6,
  shortDailyShortCount: 4,
  shortDailyShare: 0.55,
});

const STATUSES = new Set([
  'detail_not_loaded', 'missing', 'observed_zero',
  'insufficient_history', 'unclassified', 'available',
]);
const PATTERN_SERIES = Object.freeze({
  short_sessions: 'short_sessions',
  long_sessions: 'long_sessions',
  recurring_time: 'activity',
});
const DAY_COUNTS = ['sessionCount', 'shortSessionCount', 'longSessionCount'];
const DAY_DURATIONS = ['activeMs', 'sessionTotalMs', 'maxSessionMs'];
const HOUR_COUNTS = [
  'activeDayCount', 'sessionCount', 'shortSessionCount', 'shortSessionDayCount',
  'longSessionCount', 'longSessionDayCount', 'visits', 'visitDayCount',
];

function fail(code = 'SITE_LONG_TERM_PATTERNS_CONTRACT_INVALID') {
  const error = new Error(code);
  error.code = code;
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

export function createUnloadedSiteLongTermPatterns() {
  return {
    version: SITE_LONG_TERM_PATTERNS_VERSION,
    basis: SITE_LONG_TERM_PATTERNS_BASIS,
    currentDayExcluded: true,
    status: 'detail_not_loaded',
    period: null,
    primaryId: null,
    patterns: [],
    observations: null,
    hourly: [],
    days: [],
    criteria: { ...SITE_LONG_TERM_PATTERN_CRITERIA },
  };
}

function sameNumber(actual, expected) {
  return expected === null ? actual === null
    : typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) <= 0.001;
}

function sameDates(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && actual.every((dateStr, index) => dateStr === expected[index]);
}

function requireDayRecurringWindows(days, recurring) {
  days.forEach(day => {
    if (!recurring || !day.observed) {
      if (day.recurringWindow !== null) fail();
      return;
    }
    const window = day.recurringWindow;
    const expectedActiveMs = Array.from({ length: recurring.durationHours }, (_, offset) =>
      day.hourlyActiveMs[(recurring.startHour + offset) % 24])
      .reduce((sum, activeMs) => sum + activeMs, 0);
    if (!isRecord(window) || !isDuration(window.activeMs)
      || window.activeMs > day.activeMs || !sameNumber(window.activeMs, expectedActiveMs)) fail();
    if (day.activeMs === 0) {
      // Recorded zero is a measured duration, but it has no ratio denominator.
      if (window.activeMs !== 0 || window.share !== null) fail();
    } else if (!isDuration(window.share) || window.share > 1
      || !sameNumber(window.share, window.activeMs / day.activeMs)) fail();
  });
}

function expectedObservationStatus(period, available, hasCompletionEvidence) {
  if (period.observedDayCount === 0) return 'missing';
  if (period.activeDayCount === 0 && !hasCompletionEvidence) return 'observed_zero';
  if (period.observedDayCount < SITE_LONG_TERM_PATTERN_CRITERIA.minObservedDays
    || period.activeDayCount < SITE_LONG_TERM_PATTERN_CRITERIA.minActiveDays) return 'insufficient_history';
  return available ? 'available' : 'unclassified';
}

function requireComparisonHalf(value, days) {
  const observed = days.filter(day => day.observed);
  const totalActiveMs = observed.length > 0 ? observed.reduce((sum, day) => sum + day.activeMs, 0) : null;
  if (!isRecord(value)
    || value.startDateStr !== days[0].dateStr || value.endDateStr !== days[days.length - 1].dateStr
    || value.windowDays !== SITE_OBSERVATION_CHANGE_HALF_DAYS
    || value.observedDayCount !== observed.length
    || value.missingDayCount !== days.length - observed.length
    || value.activeDayCount !== observed.filter(day => day.activeMs > 0).length
    || !sameNumber(value.totalActiveMs, totalActiveMs)
    || !sameNumber(value.averageActiveMs, observed.length > 0 ? totalActiveMs / observed.length : null)) fail();
}

function requireObservations(value) {
  const { observations, period } = value;
  if (!isRecord(observations) || observations.version !== SITE_OBSERVATION_AXES_VERSION
    || !isRecord(observations.way) || !isRecord(observations.rhythm) || !isRecord(observations.change)) fail();
  const observed = value.days.filter(day => day.observed);
  const sum = key => observed.length > 0 ? observed.reduce((total, day) => total + day[key], 0) : null;
  const way = observations.way;
  const short = value.patterns.find(pattern => pattern.id === 'short_sessions');
  const long = value.patterns.find(pattern => pattern.id === 'long_sessions');
  const wayStatus = expectedObservationStatus(period, Boolean(short || long), sum('sessionCount') > 0);
  const expectedForm = wayStatus === 'available' ? short && long ? 'mixed_repeated' : short ? 'short_repeated' : 'long_repeated'
    : wayStatus === 'unclassified' ? 'no_repeated_shape' : null;
  if (way.status !== wayStatus || way.form !== expectedForm
    || DAY_COUNTS.some(key => way[key] !== sum(key))
    || way.mediumSessionCount !== (observed.length > 0 ? sum('sessionCount') - sum('shortSessionCount') - sum('longSessionCount') : null)
    || !sameNumber(way.sessionTotalMs, sum('sessionTotalMs'))
    || !sameNumber(way.meanSessionMs, way.sessionCount > 0 ? way.sessionTotalMs / way.sessionCount : null)
    || !sameNumber(way.maxSessionMs, observed.length > 0 ? Math.max(...observed.map(day => day.maxSessionMs)) : null)
    || way.shortRepeated !== Boolean(short) || way.longRepeated !== Boolean(long)
    || !sameDates(way.shortMatchedDates, short ? short.matchedDates : [])
    || !sameDates(way.longMatchedDates, long ? long.matchedDates : [])) fail();

  const rhythm = observations.rhythm;
  const recurring = value.patterns.find(pattern => pattern.id === 'recurring_time');
  if (rhythm.status !== expectedObservationStatus(period, Boolean(recurring), false)
    || !sameNumber(rhythm.totalActiveMs, sum('activeMs'))
    || !sameNumber(rhythm.averageActiveMs, observed.length > 0 ? sum('activeMs') / observed.length : null)
    || rhythm.activeDayCount !== period.activeDayCount || rhythm.observedDayCount !== period.observedDayCount) fail();
  if (recurring) {
    const window = rhythm.recurringWindow;
    if (!isRecord(window) || Object.keys(recurring).some(key => key !== 'matchedDates' && window[key] !== recurring[key])
      || !sameDates(window.matchedDates, recurring.matchedDates)
      || typeof window.share !== 'number' || !Number.isFinite(window.share) || window.share < 0 || window.share > 1) fail();
  } else if (rhythm.recurringWindow !== null) fail();

  const change = observations.change;
  requireComparisonHalf(change.reference, value.days.slice(0, SITE_OBSERVATION_CHANGE_HALF_DAYS));
  requireComparisonHalf(change.recent, value.days.slice(SITE_OBSERVATION_CHANGE_HALF_DAYS));
  const available = change.reference.observedDayCount >= SITE_OBSERVATION_CHANGE_MIN_OBSERVED_DAYS
    && change.recent.observedDayCount >= SITE_OBSERVATION_CHANGE_MIN_OBSERVED_DAYS;
  const expectedStatus = period.observedDayCount === 0 ? 'missing'
    : !available ? 'insufficient_history' : sum('activeMs') === 0 ? 'observed_zero' : 'available';
  const differenceMs = available ? change.recent.averageActiveMs - change.reference.averageActiveMs : null;
  const ratio = available && change.reference.averageActiveMs > 0 ? change.recent.averageActiveMs / change.reference.averageActiveMs : null;
  const ratioUnavailableReason = !available ? expectedStatus : change.reference.averageActiveMs === 0 ? 'reference_zero' : null;
  const direction = !available ? null : differenceMs > 0 ? 'increased' : differenceMs < 0 ? 'decreased' : 'unchanged';
  if (change.status !== expectedStatus || change.available !== available
    || change.minObservedDaysPerHalf !== SITE_OBSERVATION_CHANGE_MIN_OBSERVED_DAYS
    || !sameNumber(change.differenceMs, differenceMs) || !sameNumber(change.ratio, ratio)
    || change.ratioUnavailableReason !== ratioUnavailableReason || change.direction !== direction) fail();
}

// Validation is public-boundary integrity only. Pattern selection remains with
// the selected-detail producer; consumers never run a second classifier.
export function requireSiteLongTermPatterns(value) {
  if (!isRecord(value)
    || value.version !== SITE_LONG_TERM_PATTERNS_VERSION
    || value.basis !== SITE_LONG_TERM_PATTERNS_BASIS
    || value.currentDayExcluded !== true
    || !STATUSES.has(value.status)
    || !Array.isArray(value.patterns)
    || !Array.isArray(value.hourly)
    || !Array.isArray(value.days)
    || !isRecord(value.criteria)
    || Object.keys(value.criteria).length !== Object.keys(SITE_LONG_TERM_PATTERN_CRITERIA).length
    || Object.entries(SITE_LONG_TERM_PATTERN_CRITERIA).some(([key, expected]) => value.criteria[key] !== expected)) fail();

  if (value.status === 'detail_not_loaded') {
    if (value.period !== null || value.primaryId !== null || value.observations !== null
      || value.patterns.length || value.hourly.length || value.days.length) fail();
    return value;
  }

  const period = value.period;
  if (!isRecord(period) || !parseLocalDateParts(period.currentDateStr)
    || period.windowDays !== SITE_LONG_TERM_PATTERNS_WINDOW_DAYS
    || period.startDateStr !== shiftDateStr(period.currentDateStr, -period.windowDays)
    || period.endDateStr !== shiftDateStr(period.currentDateStr, -1)
    || period.coverageMeaning !== 'recorded-days-not-continuous-coverage'
    || !isCount(period.observedDayCount) || !isCount(period.activeDayCount)
    || !isCount(period.missingDayCount)
    || period.activeDayCount > period.observedDayCount
    || period.observedDayCount + period.missingDayCount !== period.windowDays
    || value.days.length !== period.windowDays || value.hourly.length !== 24) fail();

  value.days.forEach((day, index) => {
    if (!isRecord(day) || day.dateStr !== shiftDateStr(period.startDateStr, index)
      || typeof day.observed !== 'boolean') fail();
    if (day.observed) {
      if (DAY_DURATIONS.some(key => !isDuration(day[key])) || DAY_COUNTS.some(key => !isCount(day[key]))
        || day.shortSessionCount + day.longSessionCount > day.sessionCount
        || day.maxSessionMs > day.sessionTotalMs
        || !Array.isArray(day.hourlyActiveMs) || day.hourlyActiveMs.length !== 24
        || Array.from(day.hourlyActiveMs).some(activeMs => !isDuration(activeMs))
        || !sameNumber(day.hourlyActiveMs.reduce((sum, activeMs) => sum + activeMs, 0), day.activeMs)) fail();
    } else if (DAY_DURATIONS.some(key => day[key] !== null) || DAY_COUNTS.some(key => day[key] !== null)
      || day.hourlyActiveMs !== null) fail();
  });
  const observed = value.days.filter(day => day.observed);
  const active = observed.filter(day => day.activeMs > 0);
  if (observed.length !== period.observedDayCount || active.length !== period.activeDayCount) fail();

  value.hourly.forEach((hour, index) => {
    if (!isRecord(hour) || hour.hour !== index || HOUR_COUNTS.some(key => !isCount(hour[key]))
      || hour.activeDayCount > period.activeDayCount
      || hour.shortSessionDayCount > period.observedDayCount
      || hour.longSessionDayCount > period.observedDayCount
      || hour.visitDayCount > period.observedDayCount
      || hour.shortSessionCount + hour.longSessionCount > hour.sessionCount
      || hour.shortSessionDayCount > hour.shortSessionCount
      || hour.longSessionDayCount > hour.longSessionCount
      || hour.visitDayCount > hour.visits
      || (period.observedDayCount === 0 ? hour.averageActiveMs !== null : !isDuration(hour.averageActiveMs))) fail();
  });
  DAY_COUNTS.forEach(key => {
    if (observed.reduce((sum, day) => sum + day[key], 0)
      !== value.hourly.reduce((sum, hour) => sum + hour[key], 0)) fail();
  });
  if (period.observedDayCount > 0) {
    const expectedAverageMs = observed.reduce((sum, day) => sum + day.activeMs, 0) / period.observedDayCount;
    if (Math.abs(value.hourly.reduce((sum, hour) => sum + hour.averageActiveMs, 0) - expectedAverageMs) > 0.001) fail();
  } else if (value.hourly.some(hour => HOUR_COUNTS.some(key => hour[key] !== 0))) fail();

  const patternIds = new Set();
  const activeDates = new Set(active.map(day => day.dateStr));
  value.patterns.forEach(pattern => {
    if (!isRecord(pattern) || !Object.hasOwn(PATTERN_SERIES, pattern.id)
      || patternIds.has(pattern.id) || pattern.graphSeriesId !== PATTERN_SERIES[pattern.id]
      || pattern.activeDayCount !== period.activeDayCount
      || !isCount(pattern.repeatedDayCount)
      || pattern.repeatedDayCount < SITE_LONG_TERM_PATTERN_CRITERIA.minRepeatedDays
      || pattern.repeatedDayCount / period.activeDayCount < SITE_LONG_TERM_PATTERN_CRITERIA.minRepeatedActiveDayShare
      || !Array.isArray(pattern.matchedDates)
      || pattern.matchedDates.length !== pattern.repeatedDayCount
      || new Set(pattern.matchedDates).size !== pattern.matchedDates.length
      || pattern.matchedDates.some(dateStr => !activeDates.has(dateStr))) fail();
    if (pattern.id === 'recurring_time') {
      if (!isCount(pattern.startHour) || pattern.startHour > 23
        || !isCount(pattern.endHourExclusive) || pattern.endHourExclusive > 23
        || ![2, 3].includes(pattern.durationHours)
        || pattern.endHourExclusive !== (pattern.startHour + pattern.durationHours) % 24
        || pattern.wrapsMidnight !== (pattern.startHour + pattern.durationHours > 24)) fail();
    }
    patternIds.add(pattern.id);
  });
  requireDayRecurringWindows(value.days, value.patterns.find(pattern => pattern.id === 'recurring_time'));
  const enoughHistory = period.observedDayCount >= SITE_LONG_TERM_PATTERN_CRITERIA.minObservedDays
    && period.activeDayCount >= SITE_LONG_TERM_PATTERN_CRITERIA.minActiveDays;
  const expectedStatus = period.observedDayCount === 0 ? 'missing'
    : period.activeDayCount === 0 ? 'observed_zero'
      : !enoughHistory ? 'insufficient_history'
        : value.patterns.length > 0 ? 'available' : 'unclassified';
  if (value.status !== expectedStatus
    || (value.patterns.length > 0 && !enoughHistory)
    || (value.status === 'available' ? !patternIds.has(value.primaryId) : value.primaryId !== null)) fail();
  requireObservations(value);
  return value;
}
