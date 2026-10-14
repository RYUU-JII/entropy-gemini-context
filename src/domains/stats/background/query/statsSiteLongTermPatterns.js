import { isHostnameInList } from '../../../../lib/domain.js';
import { shiftDateStr } from '../../shared/dateMath.js';
import { normalizeSitePullBaselineSeriesSource } from '../../insights/sitePull/baselineSeriesSource.js';
import {
  createUnobservedStatsDomainCollectionObservation,
  mergeStatsDomainCollectionObservations,
  requireStatsDomainCollectionObservation,
} from '../../contracts/statsContracts.js';
import {
  SITE_LONG_TERM_PATTERNS_VERSION,
  SITE_LONG_TERM_PATTERNS_BASIS,
  SITE_LONG_TERM_PATTERNS_WINDOW_DAYS,
  SITE_LONG_TERM_PATTERN_CRITERIA,
  SITE_OBSERVATION_AXES_VERSION,
  SITE_OBSERVATION_CHANGE_HALF_DAYS,
  SITE_OBSERVATION_CHANGE_MIN_OBSERVED_DAYS,
  requireSiteLongTermPatterns,
} from '../../contracts/siteLongTermPatternContract.js';
import {
  SITES_SITE_RECURRING_TIME_EVIDENCE_VERSION,
  SITES_SITE_RECURRING_TIME_EVIDENCE_BASIS,
} from './statsSiteRecurringTimeEvidence.js';

const SESSION_FIELDS = ['count', 'shortCount', 'longCount', 'totalMs', 'maxMs'];
const COUNT_FIELDS = ['count', 'shortCount', 'longCount'];
const PRIORITY = Object.freeze({ short_sessions: 0, long_sessions: 1, recurring_time: 2 });

function fail(code, context) {
  const error = new Error(code);
  error.code = code;
  error.context = context;
  throw error;
}

function requireNonnegative(value, context, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0
    || (integer && !Number.isSafeInteger(value))) fail('SITE_LONG_TERM_PATTERN_FACT_INVALID', context);
  return value;
}

function requireEntries(entries, domain, context) {
  if (!Array.isArray(entries)) fail('SITE_LONG_TERM_PATTERN_DOMAIN_ENTRIES_REQUIRED', context);
  return entries.filter(entry => {
    if (!entry || typeof entry !== 'object' || typeof entry.domain !== 'string') {
      fail('SITE_LONG_TERM_PATTERN_DOMAIN_ENTRY_INVALID', context);
    }
    return isHostnameInList(entry.domain, [domain]);
  });
}

function readSessions(entries, context) {
  const result = { count: 0, shortCount: 0, longCount: 0, totalMs: 0, maxMs: 0 };
  entries.forEach((entry, index) => {
    if (!entry.sessions || typeof entry.sessions !== 'object' || Array.isArray(entry.sessions)) {
      fail('SITE_LONG_TERM_PATTERN_SESSION_FACTS_REQUIRED', `${context}[${index}]`);
    }
    SESSION_FIELDS.forEach(key => {
      const value = requireNonnegative(entry.sessions[key], `${context}[${index}].sessions.${key}`, COUNT_FIELDS.includes(key));
      if (key === 'maxMs') result.maxMs = Math.max(result.maxMs, value);
      else result[key] += value;
    });
    if (entry.sessions.shortCount + entry.sessions.longCount > entry.sessions.count) {
      fail('SITE_LONG_TERM_PATTERN_SESSION_COUNTS_INVALID', `${context}[${index}]`);
    }
  });
  return result;
}

function buildDay(dateStr, projection, domain) {
  if (!projection || typeof projection !== 'object' || Array.isArray(projection)
    || typeof projection.hasStatsDay !== 'boolean') fail('SITE_LONG_TERM_PATTERN_DAY_PROJECTION_INVALID', dateStr);
  const entries = requireEntries(projection.domainTotals, domain, dateStr);
  const observation = entries.length === 0 ? createUnobservedStatsDomainCollectionObservation()
    : mergeStatsDomainCollectionObservations(entries.map((entry, index) => (
      requireStatsDomainCollectionObservation(entry.collectionObservation, { source: `${dateStr}[${index}]` })
    )));
  if (observation.observed && !projection.hasStatsDay) fail('SITE_LONG_TERM_PATTERN_COLLECTION_RELATION_INVALID', dateStr);
  if (!Array.isArray(projection.hourlyBuckets) || projection.hourlyBuckets.length !== 24) {
    fail('SITE_LONG_TERM_PATTERN_HOURLY_BUCKETS_REQUIRED', dateStr);
  }
  const hours = projection.hourlyBuckets.map((bucket, hour) => {
    if (!bucket || bucket.hour !== hour) fail('SITE_LONG_TERM_PATTERN_HOUR_INVALID', `${dateStr}:${hour}`);
    const hourEntries = requireEntries(bucket.domains, domain, `${dateStr}:${hour}`);
    return {
      hour,
      activeMs: hourEntries.reduce((sum, entry) => sum + requireNonnegative(entry.activeMs, `${dateStr}:${hour}.activeMs`), 0),
      visits: hourEntries.reduce((sum, entry) => sum + requireNonnegative(entry.visits, `${dateStr}:${hour}.visits`, true), 0),
      sessions: readSessions(hourEntries, `${dateStr}:${hour}`),
    };
  });
  if (!observation.observed) {
    if (hours.some(hour => hour.activeMs > 0 || hour.visits > 0
      || SESSION_FIELDS.some(key => hour.sessions[key] > 0))) fail('SITE_LONG_TERM_PATTERN_UNOBSERVED_FACTS_INVALID', dateStr);
    return {
      dateStr, observed: false, activeMs: null, sessionCount: null,
      shortSessionCount: null, longSessionCount: null, sessionTotalMs: null,
      maxSessionMs: null, hours,
    };
  }
  const activeMs = entries.reduce((sum, entry) => sum + requireNonnegative(entry.activeMs, `${dateStr}.activeMs`), 0);
  const sessions = readSessions(entries, dateStr);
  if (activeMs !== hours.reduce((sum, hour) => sum + hour.activeMs, 0)
    || SESSION_FIELDS.filter(key => key !== 'maxMs').some(key => (
      sessions[key] !== hours.reduce((sum, hour) => sum + hour.sessions[key], 0)
    )) || sessions.maxMs !== Math.max(...hours.map(hour => hour.sessions.maxMs))) {
    fail('SITE_LONG_TERM_PATTERN_HOURLY_TOTAL_MISMATCH', dateStr);
  }
  return {
    dateStr, observed: true, activeMs,
    sessionCount: sessions.count, shortSessionCount: sessions.shortCount,
    longSessionCount: sessions.longCount, sessionTotalMs: sessions.totalMs,
    maxSessionMs: sessions.maxMs, hours,
  };
}

function repeatsAcrossDays(matchedDays, activeDayCount) {
  return matchedDays.length >= SITE_LONG_TERM_PATTERN_CRITERIA.minRepeatedDays
    && matchedDays.length / activeDayCount >= SITE_LONG_TERM_PATTERN_CRITERIA.minRepeatedActiveDayShare;
}

function createPattern(id, matchedDays, activeDayCount, extra = {}) {
  return {
    id, repeatedDayCount: matchedDays.length, activeDayCount,
    matchedDates: matchedDays.map(day => day.dateStr),
    graphSeriesId: id === 'recurring_time' ? 'activity' : id,
    ...extra,
  };
}

function buildRecurringWindowMeasure(day, window) {
  const activeMs = Array.from({ length: window.durationHours }, (_, offset) => (
    day.hours[(window.startHour + offset) % 24].activeMs
  )).reduce((sum, value) => sum + value, 0);
  return { activeMs, share: day.activeMs > 0 ? activeMs / day.activeMs : null };
}

function buildPatterns(days, recurringTimeEvidence) {
  const activeDays = days.filter(day => day.observed && day.activeMs > 0);
  const observedDayCount = days.filter(day => day.observed).length;
  if (!recurringTimeEvidence || recurringTimeEvidence.version !== SITES_SITE_RECURRING_TIME_EVIDENCE_VERSION
    || recurringTimeEvidence.basis !== SITES_SITE_RECURRING_TIME_EVIDENCE_BASIS
    || recurringTimeEvidence.currentDayExcluded !== true
    || recurringTimeEvidence.observedDayCount !== observedDayCount
    || recurringTimeEvidence.activeDayCount !== activeDays.length) {
    fail('SITE_LONG_TERM_PATTERN_RECURRING_EVIDENCE_INVALID', 'recurringTimeEvidence');
  }
  if (observedDayCount < SITE_LONG_TERM_PATTERN_CRITERIA.minObservedDays
    || activeDays.length < SITE_LONG_TERM_PATTERN_CRITERIA.minActiveDays) return [];

  const shortDays = activeDays.filter(day => day.sessionCount >= SITE_LONG_TERM_PATTERN_CRITERIA.shortDailyCount
    && day.shortSessionCount >= SITE_LONG_TERM_PATTERN_CRITERIA.shortDailyShortCount
    && day.shortSessionCount / day.sessionCount >= SITE_LONG_TERM_PATTERN_CRITERIA.shortDailyShare);
  const longDays = activeDays.filter(day => day.longSessionCount > 0);
  const patterns = [];
  if (repeatsAcrossDays(shortDays, activeDays.length)) patterns.push(createPattern('short_sessions', shortDays, activeDays.length));
  if (repeatsAcrossDays(longDays, activeDays.length)) patterns.push(createPattern('long_sessions', longDays, activeDays.length));
  if (recurringTimeEvidence.available) {
    const { startHour, durationHours, endHourExclusive, wrapsMidnight } = recurringTimeEvidence;
    const matchedDays = activeDays.filter(day => {
      const window = buildRecurringWindowMeasure(day, recurringTimeEvidence);
      return window.activeMs >= 5 * 60_000 && window.share >= 0.4;
    });
    if (matchedDays.length !== recurringTimeEvidence.repeatedDayCount) {
      fail('SITE_LONG_TERM_PATTERN_RECURRING_DAYS_MISMATCH', 'recurringTimeEvidence');
    }
    patterns.push(createPattern('recurring_time', matchedDays, activeDays.length, {
      startHour, durationHours, endHourExclusive, wrapsMidnight,
    }));
  }
  return patterns.sort((left, right) => right.repeatedDayCount - left.repeatedDayCount || PRIORITY[left.id] - PRIORITY[right.id]);
}

function observationStatus(observedDayCount, activeDayCount, available, hasCompletionEvidence) {
  if (observedDayCount === 0) return 'missing';
  if (activeDayCount === 0 && !hasCompletionEvidence) return 'observed_zero';
  if (observedDayCount < SITE_LONG_TERM_PATTERN_CRITERIA.minObservedDays
    || activeDayCount < SITE_LONG_TERM_PATTERN_CRITERIA.minActiveDays) return 'insufficient_history';
  return available ? 'available' : 'unclassified';
}

function buildComparisonHalf(days) {
  const observed = days.filter(day => day.observed);
  const totalActiveMs = observed.length > 0 ? observed.reduce((sum, day) => sum + day.activeMs, 0) : null;
  return {
    startDateStr: days[0].dateStr,
    endDateStr: days[days.length - 1].dateStr,
    windowDays: days.length,
    observedDayCount: observed.length,
    missingDayCount: days.length - observed.length,
    activeDayCount: observed.filter(day => day.activeMs > 0).length,
    totalActiveMs,
    averageActiveMs: observed.length > 0 ? totalActiveMs / observed.length : null,
  };
}

function buildObservations(days, patterns, recurringTimeEvidence) {
  const observed = days.filter(day => day.observed);
  const observedDayCount = observed.length;
  const activeDayCount = observed.filter(day => day.activeMs > 0).length;
  const short = patterns.find(pattern => pattern.id === 'short_sessions');
  const long = patterns.find(pattern => pattern.id === 'long_sessions');
  const recurring = patterns.find(pattern => pattern.id === 'recurring_time');
  const sum = key => observedDayCount > 0 ? observed.reduce((total, day) => total + day[key], 0) : null;
  const sessionCount = sum('sessionCount');
  const shortSessionCount = sum('shortSessionCount');
  const longSessionCount = sum('longSessionCount');
  const sessionTotalMs = sum('sessionTotalMs');
  const wayStatus = observationStatus(observedDayCount, activeDayCount, Boolean(short || long), sessionCount > 0);
  const totalActiveMs = sum('activeMs');
  const reference = buildComparisonHalf(days.slice(0, SITE_OBSERVATION_CHANGE_HALF_DAYS));
  const recent = buildComparisonHalf(days.slice(SITE_OBSERVATION_CHANGE_HALF_DAYS));
  const changeAvailable = reference.observedDayCount >= SITE_OBSERVATION_CHANGE_MIN_OBSERVED_DAYS
    && recent.observedDayCount >= SITE_OBSERVATION_CHANGE_MIN_OBSERVED_DAYS;
  const differenceMs = changeAvailable ? recent.averageActiveMs - reference.averageActiveMs : null;
  const changeStatus = observedDayCount === 0 ? 'missing'
    : !changeAvailable ? 'insufficient_history'
      : totalActiveMs === 0 ? 'observed_zero' : 'available';
  return {
    version: SITE_OBSERVATION_AXES_VERSION,
    way: {
      status: wayStatus,
      form: wayStatus === 'available' ? short && long ? 'mixed_repeated' : short ? 'short_repeated' : 'long_repeated'
        : wayStatus === 'unclassified' ? 'no_repeated_shape' : null,
      sessionCount,
      shortSessionCount,
      mediumSessionCount: observedDayCount > 0 ? sessionCount - shortSessionCount - longSessionCount : null,
      longSessionCount,
      sessionTotalMs,
      meanSessionMs: sessionCount > 0 ? sessionTotalMs / sessionCount : null,
      maxSessionMs: observedDayCount > 0 ? Math.max(...observed.map(day => day.maxSessionMs)) : null,
      shortRepeated: Boolean(short),
      longRepeated: Boolean(long),
      shortMatchedDates: short ? [...short.matchedDates] : [],
      longMatchedDates: long ? [...long.matchedDates] : [],
    },
    rhythm: {
      status: observationStatus(observedDayCount, activeDayCount, Boolean(recurring), false),
      recurringWindow: recurring ? { ...recurring, matchedDates: [...recurring.matchedDates], share: recurringTimeEvidence.share } : null,
      totalActiveMs,
      averageActiveMs: observedDayCount > 0 ? totalActiveMs / observedDayCount : null,
      activeDayCount,
      observedDayCount,
    },
    change: {
      status: changeStatus,
      available: changeAvailable,
      minObservedDaysPerHalf: SITE_OBSERVATION_CHANGE_MIN_OBSERVED_DAYS,
      reference,
      recent,
      differenceMs,
      ratio: changeAvailable && reference.averageActiveMs > 0 ? recent.averageActiveMs / reference.averageActiveMs : null,
      ratioUnavailableReason: !changeAvailable ? changeStatus : reference.averageActiveMs === 0 ? 'reference_zero' : null,
      direction: !changeAvailable ? null : differenceMs > 0 ? 'increased' : differenceMs < 0 ? 'decreased' : 'unchanged',
    },
  };
}

export function buildSitesSiteLongTermPatterns({ dates, dayProjections, domain, currentDateStr, recurringTimeEvidence } = {}) {
  if (typeof domain !== 'string' || !domain.trim()) fail('SITE_LONG_TERM_PATTERN_DOMAIN_REQUIRED', domain);
  if (!Array.isArray(dates) || dates.length !== SITE_LONG_TERM_PATTERNS_WINDOW_DAYS
    || !dayProjections || typeof dayProjections !== 'object' || Array.isArray(dayProjections)) {
    fail('SITE_LONG_TERM_PATTERN_SOURCE_INVALID', 'dates/dayProjections');
  }
  const days = dates.map(dateStr => {
    if (!Object.hasOwn(dayProjections, dateStr)) fail('SITE_LONG_TERM_PATTERN_DAY_PROJECTION_MISSING', dateStr);
    return buildDay(dateStr, dayProjections[dateStr], domain);
  });
  normalizeSitePullBaselineSeriesSource({ baselineSeries: days, baselineCurrentDateStr: currentDateStr });
  const observed = days.filter(day => day.observed);
  const activeDayCount = observed.filter(day => day.activeMs > 0).length;
  const patterns = buildPatterns(days, recurringTimeEvidence);
  const recurring = patterns.find(pattern => pattern.id === 'recurring_time');
  const enoughHistory = observed.length >= SITE_LONG_TERM_PATTERN_CRITERIA.minObservedDays
    && activeDayCount >= SITE_LONG_TERM_PATTERN_CRITERIA.minActiveDays;
  const status = observed.length === 0 ? 'missing' : activeDayCount === 0 ? 'observed_zero'
    : !enoughHistory ? 'insufficient_history' : patterns.length > 0 ? 'available' : 'unclassified';
  return requireSiteLongTermPatterns({
    version: SITE_LONG_TERM_PATTERNS_VERSION,
    basis: SITE_LONG_TERM_PATTERNS_BASIS,
    currentDayExcluded: true,
    status,
    period: {
      currentDateStr,
      startDateStr: shiftDateStr(currentDateStr, -SITE_LONG_TERM_PATTERNS_WINDOW_DAYS),
      endDateStr: shiftDateStr(currentDateStr, -1),
      windowDays: SITE_LONG_TERM_PATTERNS_WINDOW_DAYS,
      observedDayCount: observed.length,
      activeDayCount,
      missingDayCount: SITE_LONG_TERM_PATTERNS_WINDOW_DAYS - observed.length,
      coverageMeaning: 'recorded-days-not-continuous-coverage',
    },
    primaryId: patterns.length > 0 ? patterns[0].id : null,
    patterns,
    observations: buildObservations(days, patterns, recurringTimeEvidence),
    hourly: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      averageActiveMs: observed.length > 0 ? observed.reduce((sum, day) => sum + day.hours[hour].activeMs, 0) / observed.length : null,
      activeDayCount: observed.filter(day => day.hours[hour].activeMs > 0).length,
      sessionCount: observed.reduce((sum, day) => sum + day.hours[hour].sessions.count, 0),
      shortSessionCount: observed.reduce((sum, day) => sum + day.hours[hour].sessions.shortCount, 0),
      shortSessionDayCount: observed.filter(day => day.hours[hour].sessions.shortCount > 0).length,
      longSessionCount: observed.reduce((sum, day) => sum + day.hours[hour].sessions.longCount, 0),
      longSessionDayCount: observed.filter(day => day.hours[hour].sessions.longCount > 0).length,
      visits: observed.reduce((sum, day) => sum + day.hours[hour].visits, 0),
      visitDayCount: observed.filter(day => day.hours[hour].visits > 0).length,
    })),
    days: days.map(day => {
      const { hours, ...facts } = day;
      return {
        ...facts,
        hourlyActiveMs: day.observed ? hours.map(hour => hour.activeMs) : null,
        recurringWindow: day.observed && recurring ? buildRecurringWindowMeasure(day, recurring) : null,
      };
    }),
    criteria: { ...SITE_LONG_TERM_PATTERN_CRITERIA },
  });
}
