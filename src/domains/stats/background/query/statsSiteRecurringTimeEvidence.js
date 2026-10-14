import { parseLocalDateParts } from '../../shared/dateMath.js';
import { requireStatsDomainCollectionObservation } from '../../contracts/statsContracts.js';
import {
  buildDomainProjectionEntry,
  buildDomainProjectionHourly,
} from './statsSiteIntelReadModelHelpers.js';
import { SITE_PULL_BASELINE_DAYS, toNumber } from './statsAnalysisQueryShared.js';

export const SITES_SITE_RECURRING_TIME_EVIDENCE_VERSION = 'sites-site-recurring-time-evidence-v1';
export const SITES_SITE_RECURRING_TIME_EVIDENCE_BASIS = (
  'completed-calendar-day-hourly-domain-activity'
);

export const SITES_SITE_RECURRING_TIME_EVIDENCE_STATUS = Object.freeze({
  AVAILABLE: 'available',
  DETAIL_NOT_LOADED: 'detail_not_loaded',
  INSUFFICIENT_OBSERVED_DAYS: 'insufficient_observed_days',
  INSUFFICIENT_ACTIVE_DAYS: 'insufficient_active_days',
  NO_RECURRING_WINDOW: 'no_recurring_window',
});

const WINDOW_DURATIONS = Object.freeze([2, 3]);
const MIN_OBSERVED_DAY_COUNT = 7;
const MIN_ACTIVE_DAY_COUNT = 4;
const MIN_REPEATED_DAY_COUNT = 3;
const MIN_REPEATED_ACTIVE_DAY_SHARE = 0.5;
const MIN_DAY_WINDOW_SHARE = 0.4;
const MIN_AGGREGATE_WINDOW_SHARE = 0.35;
const MIN_REPEATED_DAY_WINDOW_MS = 5 * 60_000;
const MAX_DOMINANT_DAY_SHARE = 0.5;
const SHORTER_WINDOW_SCORE_BONUS = 0.04;

function roundRatio(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(1, value)) * 10_000) / 10_000;
}

function createEvidence({
  status,
  observedDayCount = 0,
  activeDayCount = 0,
  repeatedDayCount = 0,
  share = null,
  confidence = 0,
  startHour = null,
  endHourExclusive = null,
  durationHours = null,
  wrapsMidnight = false,
} = {}) {
  return {
    version: SITES_SITE_RECURRING_TIME_EVIDENCE_VERSION,
    available: status === SITES_SITE_RECURRING_TIME_EVIDENCE_STATUS.AVAILABLE,
    status,
    basis: SITES_SITE_RECURRING_TIME_EVIDENCE_BASIS,
    currentDayExcluded: true,
    observedDayCount,
    activeDayCount,
    repeatedDayCount,
    share,
    confidence,
    startHour,
    endHourExclusive,
    durationHours,
    wrapsMidnight,
  };
}

export function createUnloadedSitesSiteRecurringTimeEvidence() {
  return createEvidence({
    status: SITES_SITE_RECURRING_TIME_EVIDENCE_STATUS.DETAIL_NOT_LOADED,
  });
}

function requireRecurringTimeSource({ dates, dayProjections, currentDateStr }) {
  if (!Array.isArray(dates) || dates.length !== SITE_PULL_BASELINE_DAYS) {
    throw new Error('STATS_RULE_SITE_RECURRING_TIME_BASELINE_DATES_INVALID');
  }
  if (!dayProjections || typeof dayProjections !== 'object' || Array.isArray(dayProjections)) {
    throw new Error('STATS_RULE_SITE_RECURRING_TIME_DAY_PROJECTIONS_INVALID');
  }
  if (typeof currentDateStr !== 'string' || !parseLocalDateParts(currentDateStr)) {
    throw new Error('STATS_RULE_SITE_RECURRING_TIME_CURRENT_DATE_INVALID');
  }
  if (new Set(dates).size !== dates.length) {
    throw new Error('STATS_RULE_SITE_RECURRING_TIME_BASELINE_DATES_DUPLICATED');
  }
  dates.forEach((dateStr) => {
    if (typeof dateStr !== 'string' || !parseLocalDateParts(dateStr)) {
      throw new Error(`STATS_RULE_SITE_RECURRING_TIME_BASELINE_DATE_INVALID:${dateStr}`);
    }
    if (dateStr === currentDateStr) {
      throw new Error('STATS_RULE_SITE_RECURRING_TIME_CURRENT_DAY_INCLUDED');
    }
    if (!Object.prototype.hasOwnProperty.call(dayProjections, dateStr)) {
      throw new Error(`STATS_RULE_SITE_RECURRING_TIME_DAY_PROJECTION_MISSING:${dateStr}`);
    }
    const projection = dayProjections[dateStr];
    if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
      throw new Error(`STATS_RULE_SITE_RECURRING_TIME_DAY_PROJECTION_INVALID:${dateStr}`);
    }
    if (typeof projection.hasStatsDay !== 'boolean') {
      throw new Error(`STATS_RULE_SITE_RECURRING_TIME_DAY_OBSERVATION_MARKER_INVALID:${dateStr}`);
    }
  });
}

function buildObservedDaySeries({ dates, dayProjections, domain }) {
  return dates.flatMap((dateStr) => {
    const projection = dayProjections[dateStr];
    const domainEntry = buildDomainProjectionEntry(projection, domain);
    if (!domainEntry) return [];
    const collectionObservation = requireStatsDomainCollectionObservation(
      domainEntry.collectionObservation,
      { source: `buildSitesSiteRecurringTimeEvidence.${domain}.${dateStr}` },
    );
    if (!collectionObservation.observed) return [];
    if (!projection.hasStatsDay) {
      throw new Error(`STATS_RULE_SITE_RECURRING_TIME_COLLECTION_RELATION_INVALID:${dateStr}`);
    }
    const hourly = buildDomainProjectionHourly(projection, domain)
      .map((value) => Math.max(0, toNumber(value)));
    const hourlyTotalMs = hourly.reduce((sum, value) => sum + value, 0);
    const projectedTotalMs = Math.max(0, toNumber(domainEntry.activeMs));
    if (hourlyTotalMs !== projectedTotalMs) {
      throw new Error(`STATS_RULE_SITE_RECURRING_TIME_HOURLY_TOTAL_MISMATCH:${dateStr}`);
    }
    return [{ dateStr, hourly, totalMs: hourlyTotalMs }];
  });
}

function sumCircularWindow(hourly, startHour, durationHours) {
  let total = 0;
  for (let offset = 0; offset < durationHours; offset += 1) {
    total += hourly[(startHour + offset) % 24];
  }
  return total;
}

function buildWindowCandidate(observedDays, activeDayCount, startHour, durationHours) {
  const activeDays = observedDays.filter((day) => day.totalMs > 0);
  const dayEvidence = activeDays.map((day) => {
    const windowMs = sumCircularWindow(day.hourly, startHour, durationHours);
    return {
      windowMs,
      share: windowMs / day.totalMs,
      repeated: windowMs >= MIN_REPEATED_DAY_WINDOW_MS
        && windowMs / day.totalMs >= MIN_DAY_WINDOW_SHARE,
    };
  });
  const repeatedDays = dayEvidence.filter((day) => day.repeated);
  const repeatedDayCount = repeatedDays.length;
  const allActiveMs = activeDays.reduce((sum, day) => sum + day.totalMs, 0);
  const allWindowMs = dayEvidence.reduce((sum, day) => sum + day.windowMs, 0);
  const repeatedWindowMs = repeatedDays.reduce((sum, day) => sum + day.windowMs, 0);
  const dominantDayShare = repeatedWindowMs > 0
    ? Math.max(...repeatedDays.map((day) => day.windowMs)) / repeatedWindowMs
    : 1;
  const repeatedActiveDayShare = activeDayCount > 0 ? repeatedDayCount / activeDayCount : 0;
  const share = allActiveMs > 0 ? allWindowMs / allActiveMs : 0;
  const evidenceMaturity = Math.min(1, repeatedDayCount / 7);
  const balance = repeatedDayCount > 0 ? 1 - dominantDayShare : 0;
  const confidence = roundRatio(
    (repeatedActiveDayShare * 0.45)
    + (share * 0.25)
    + (evidenceMaturity * 0.2)
    + (balance * 0.1),
  );
  const qualifies = repeatedDayCount >= MIN_REPEATED_DAY_COUNT
    && repeatedActiveDayShare >= MIN_REPEATED_ACTIVE_DAY_SHARE
    && share >= MIN_AGGREGATE_WINDOW_SHARE
    && dominantDayShare <= MAX_DOMINANT_DAY_SHARE;
  const endHourExclusive = (startHour + durationHours) % 24;

  return {
    qualifies,
    repeatedDayCount,
    share: roundRatio(share),
    confidence,
    startHour,
    endHourExclusive,
    durationHours,
    wrapsMidnight: startHour + durationHours > 24,
    selectionScore: confidence + (durationHours === 2 ? SHORTER_WINDOW_SCORE_BONUS : 0),
  };
}

function compareCandidates(left, right) {
  if (left.qualifies !== right.qualifies) return left.qualifies ? -1 : 1;
  if (left.selectionScore !== right.selectionScore) return right.selectionScore - left.selectionScore;
  if (left.repeatedDayCount !== right.repeatedDayCount) {
    return right.repeatedDayCount - left.repeatedDayCount;
  }
  if (left.share !== right.share) return right.share - left.share;
  if (left.durationHours !== right.durationHours) return left.durationHours - right.durationHours;
  return left.startHour - right.startHour;
}

export function buildSitesSiteRecurringTimeEvidence({
  dates,
  dayProjections,
  domain,
  currentDateStr,
} = {}) {
  requireRecurringTimeSource({ dates, dayProjections, currentDateStr });
  if (typeof domain !== 'string' || !domain.trim()) {
    throw new Error('STATS_RULE_SITE_RECURRING_TIME_DOMAIN_REQUIRED');
  }

  const observedDays = buildObservedDaySeries({ dates, dayProjections, domain });
  const observedDayCount = observedDays.length;
  const activeDayCount = observedDays.filter((day) => day.totalMs > 0).length;

  if (observedDayCount < MIN_OBSERVED_DAY_COUNT) {
    return createEvidence({
      status: SITES_SITE_RECURRING_TIME_EVIDENCE_STATUS.INSUFFICIENT_OBSERVED_DAYS,
      observedDayCount,
      activeDayCount,
    });
  }
  if (activeDayCount < MIN_ACTIVE_DAY_COUNT) {
    return createEvidence({
      status: SITES_SITE_RECURRING_TIME_EVIDENCE_STATUS.INSUFFICIENT_ACTIVE_DAYS,
      observedDayCount,
      activeDayCount,
    });
  }

  const candidates = WINDOW_DURATIONS.flatMap((durationHours) => (
    Array.from({ length: 24 }, (_, startHour) => buildWindowCandidate(
      observedDays,
      activeDayCount,
      startHour,
      durationHours,
    ))
  )).sort(compareCandidates);
  const best = candidates[0];

  if (!best?.qualifies) {
    return createEvidence({
      status: SITES_SITE_RECURRING_TIME_EVIDENCE_STATUS.NO_RECURRING_WINDOW,
      observedDayCount,
      activeDayCount,
      repeatedDayCount: best?.repeatedDayCount || 0,
      share: best?.share ?? null,
      confidence: best?.confidence || 0,
    });
  }

  return createEvidence({
    status: SITES_SITE_RECURRING_TIME_EVIDENCE_STATUS.AVAILABLE,
    observedDayCount,
    activeDayCount,
    repeatedDayCount: best.repeatedDayCount,
    share: best.share,
    confidence: best.confidence,
    startHour: best.startHour,
    endHourExclusive: best.endHourExclusive,
    durationHours: best.durationHours,
    wrapsMidnight: best.wrapsMidnight,
  });
}
