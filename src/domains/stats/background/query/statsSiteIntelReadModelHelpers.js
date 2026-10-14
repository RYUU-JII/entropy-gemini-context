import { isHostnameInList } from '../../../../lib/domain.js';
import { buildScoreSetupRecentTrajectory } from '../../analysis/scoreSetupRecommendations.js';
import {
  createUnobservedStatsDomainCollectionObservation,
  mergeStatsDomainCollectionObservations,
  requireStatsDomainCollectionObservation,
} from '../../contracts/statsContracts.js';
import { normalizeSitePullBaselineSeriesSource } from '../../insights/sitePull/baselineSeriesSource.js';
import { toNumber } from './statsAnalysisQueryShared.js';
import {
  normalizeSiteBehaviorStats,
  normalizeSiteInterventionStats,
  normalizeSiteNavigationStats,
  normalizeSiteSessionStats,
  sumSiteBehaviorStats,
  sumSiteInterventionStats,
  sumSiteNavigationStats,
  sumSiteSessionStats,
} from './statsSiteIntelMetricStats.js';

const DAY_LABELS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

function findDomainProjectionEntries(projection, domain) {
  const domainTotals = Array.isArray(projection?.domainTotals) ? projection.domainTotals : [];
  return domainTotals.filter((entry) => (
    typeof entry?.domain === 'string'
    && isHostnameInList(entry.domain, [domain])
  ));
}

export function buildDomainProjectionEntry(projection, domain) {
  const entries = findDomainProjectionEntries(projection, domain);
  if (entries.length <= 0) return null;

  return {
    domain,
    collectionObservation: mergeStatsDomainCollectionObservations(
      entries.map((entry, index) => requireStatsDomainCollectionObservation(
        entry?.collectionObservation,
        { source: `buildDomainProjectionEntry.${domain}[${index}]` },
      )),
      { source: `buildDomainProjectionEntry.${domain}` },
    ),
    activeMs: entries.reduce((sum, entry) => sum + toNumber(entry?.activeMs), 0),
    visits: entries.reduce((sum, entry) => sum + toNumber(entry?.visits), 0),
    hourlyVisits: Array.from({ length: 24 }, (_, hour) => (
      entries.reduce((sum, entry) => sum + toNumber(entry?.hourlyVisits?.[hour]), 0)
    )),
    sessions: sumSiteSessionStats(entries),
    behavior: sumSiteBehaviorStats(entries),
    interventions: sumSiteInterventionStats(entries),
    navigation: sumSiteNavigationStats(entries),
  };
}

export function buildDomainProjectionHourly(projection, domain) {
  const buckets = Array.isArray(projection?.hourlyBuckets) ? projection.hourlyBuckets : [];
  const hourly = Array(24).fill(0);
  buckets.forEach((bucket) => {
    const hour = Math.max(0, Math.min(23, Math.floor(toNumber(bucket?.hour))));
    const matchingEntries = (Array.isArray(bucket?.domains) ? bucket.domains : [])
      .filter((entry) => (
        typeof entry?.domain === 'string'
        && isHostnameInList(entry.domain, [domain])
      ));
    hourly[hour] += matchingEntries.reduce(
      (sum, entry) => sum + Math.max(0, toNumber(entry?.activeMs)),
      0,
    );
  });
  return hourly;
}

export function buildDomainProjectionHourlyVisits(projection, domain, {
  preferDomainTotals = true,
} = {}) {
  const domainEntry = buildDomainProjectionEntry(projection, domain);
  if (preferDomainTotals && Array.isArray(domainEntry?.hourlyVisits)) {
    return domainEntry.hourlyVisits.map((value) => Math.max(0, Math.floor(toNumber(value))));
  }

  const buckets = Array.isArray(projection?.hourlyBuckets) ? projection.hourlyBuckets : [];
  const hourlyVisits = Array(24).fill(0);
  buckets.forEach((bucket) => {
    const hour = Math.max(0, Math.min(23, Math.floor(toNumber(bucket?.hour))));
    const matchingEntries = (Array.isArray(bucket?.domains) ? bucket.domains : [])
      .filter((entry) => (
        typeof entry?.domain === 'string'
        && isHostnameInList(entry.domain, [domain])
      ));
    hourlyVisits[hour] += matchingEntries.reduce(
      (sum, entry) => sum + Math.max(0, Math.floor(toNumber(entry?.visits))),
      0,
    );
  });
  return hourlyVisits;
}

export function buildDomainProjectionSeries({
  dates = [],
  dayProjections = {},
  domain,
  goalMs = 0,
} = {}) {
  return (Array.isArray(dates) ? dates : []).map((dateStr) => {
    const projection = dayProjections?.[dateStr];
    const domainEntry = buildDomainProjectionEntry(projection, domain);
    const collectionObservation = domainEntry?.collectionObservation
      || createUnobservedStatsDomainCollectionObservation();
    const activeMs = Math.max(0, toNumber(domainEntry?.activeMs));
    const visits = Math.max(0, Math.floor(toNumber(domainEntry?.visits)));
    const parts = dateStr.split('-').map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    return {
      dateStr,
      collectionObservation,
      activeMs,
      visits,
      sessions: normalizeSiteSessionStats(domainEntry?.sessions),
      behavior: normalizeSiteBehaviorStats(domainEntry?.behavior),
      interventions: normalizeSiteInterventionStats(domainEntry?.interventions),
      navigation: normalizeSiteNavigationStats(domainEntry?.navigation),
      label: DAY_LABELS[dateObj.getDay()],
      overLimit: goalMs > 0 && activeMs > goalMs,
      observed: collectionObservation.observed,
    };
  });
}

export function buildSitePullBaselineProjectionSeries({
  dates,
  dayProjections,
  domain,
  goalMs = 0,
  currentDateStr,
} = {}) {
  if (!Array.isArray(dates)
    || !dayProjections
    || typeof dayProjections !== 'object'
    || Array.isArray(dayProjections)) {
    throw new Error('SITE_PULL_BASELINE_PROJECTION_INPUT_INVALID');
  }
  dates.forEach((dateStr) => {
    if (!Object.prototype.hasOwnProperty.call(dayProjections, dateStr)) {
      throw new Error(`SITE_PULL_BASELINE_DAY_PROJECTION_MISSING:${dateStr}`);
    }
    const projection = dayProjections[dateStr];
    if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
      throw new Error(`SITE_PULL_BASELINE_DAY_PROJECTION_INVALID:${dateStr}`);
    }
    if (typeof projection.hasStatsDay !== 'boolean') {
      throw new Error(`SITE_PULL_BASELINE_DAY_OBSERVED_MARKER_INVALID:${dateStr}`);
    }
  });
  const baselineSeries = buildDomainProjectionSeries({
    dates,
    dayProjections,
    domain,
    goalMs,
  }).map((entry) => ({
    ...entry,
    activeMs: entry.observed ? entry.activeMs : null,
  }));
  return normalizeSitePullBaselineSeriesSource({
    baselineSeries,
    baselineCurrentDateStr: currentDateStr,
  }).series;
}

export function attachScoreSetupRecentTrajectoryToDomainCandidates({
  domainCandidates,
  dates,
  dayProjections,
  currentDateStr,
} = {}) {
  if (!Array.isArray(domainCandidates)) {
    throw new Error('SCORE_SETUP_DOMAIN_CANDIDATES_INVALID');
  }
  if (!Array.isArray(dates)
    || !dayProjections
    || typeof dayProjections !== 'object'
    || Array.isArray(dayProjections)) {
    throw new Error('SCORE_SETUP_DAY_PROJECTION_INPUT_INVALID');
  }
  return domainCandidates.map((candidate) => ({
    ...candidate,
    scoreSetupRecentTrajectory: buildScoreSetupRecentTrajectory({
      observations: dates.map((dateStr) => {
        if (!Object.prototype.hasOwnProperty.call(dayProjections, dateStr)) {
          throw new Error(`SCORE_SETUP_DAY_PROJECTION_MISSING:${dateStr}`);
        }
        const projection = dayProjections[dateStr];
        if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
          throw new Error(`SCORE_SETUP_DAY_PROJECTION_INVALID:${dateStr}`);
        }
        if (typeof projection.hasStatsDay !== 'boolean') {
          throw new Error(`SCORE_SETUP_DAY_OBSERVATION_MARKER_INVALID:${dateStr}`);
        }
        const domainEntry = buildDomainProjectionEntry(projection, candidate.domain);
        const collectionObservation = domainEntry?.collectionObservation
          || createUnobservedStatsDomainCollectionObservation();
        if (collectionObservation.observed && !projection.hasStatsDay) {
          throw new Error(`SCORE_SETUP_DAY_COLLECTION_RELATION_INVALID:${dateStr}`);
        }
        if (!collectionObservation.observed) {
          return { dateStr, observed: false, activeMs: null };
        }
        return {
          dateStr,
          observed: true,
          activeMs: Math.max(0, toNumber(domainEntry?.activeMs)),
        };
      }),
      currentDateStr,
    }),
  }));
}
