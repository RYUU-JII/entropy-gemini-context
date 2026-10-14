import {
  SITE_PULL_MINUTE_MS,
  countActiveHours,
  sumVisits,
  toCount,
  toNumber,
} from './sitePullMath.js';
import { resolveSitePullEntryVisitSummary } from './sitePullEntryFacts.js';
import { STATS_REENTRY_GAP_BUCKET_KEYS } from '../../contracts/statsContracts.js';

export const SITE_PULL_TEMPORAL_EVIDENCE_VERSION = 'site-pull-temporal-evidence-v2';
export const SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODES = Object.freeze({
  FACTS: 'facts',
  FACT_DRAFT: 'fact_draft',
});

const PLAIN_OBJECT_PROTOTYPE = Object.prototype;

function normalizeReentryGapBuckets(source = {}) {
  const buckets = source && typeof source === 'object' ? source : {};
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = toCount(buckets[key]);
    return result;
  }, {});
}

function sumReentryGapBuckets(source = {}) {
  const buckets = normalizeReentryGapBuckets(source);
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((total, key) => total + buckets[key], 0);
}


function roundNumber(value, digits = 4) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scale = 10 ** digits;
  return Math.round(numeric * scale) / scale;
}

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isObjectRecord(value) && PLAIN_OBJECT_PROTOTYPE.hasOwnProperty.call(value, key);
}

function createTemporalEvidenceSourceError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function requireTemporalEvidenceSourceMode(sourceMode) {
  if (sourceMode === SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODES.FACTS
    || sourceMode === SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODES.FACT_DRAFT) {
    return sourceMode;
  }
  throw createTemporalEvidenceSourceError('SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODE_INVALID', {
    sourceMode,
  });
}

function normalizeFeatureVectorFamily(value) {
  return isObjectRecord(value) ? value : {};
}

function resolveTodayFactFamily({
  facts = {},
  featureVector = {},
  factKey,
  vectorKey,
  sourceMode,
}) {
  if (hasOwn(facts, factKey)) {
    if (isObjectRecord(facts[factKey])) {
      return facts[factKey];
    }
    throw createTemporalEvidenceSourceError('SITE_PULL_TEMPORAL_EVIDENCE_FACT_FAMILY_INVALID', {
      factKey,
      vectorKey,
    });
  }

  if (sourceMode === SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODES.FACT_DRAFT) {
    return normalizeFeatureVectorFamily(featureVector?.[vectorKey]);
  }

  throw createTemporalEvidenceSourceError('SITE_PULL_TEMPORAL_EVIDENCE_FACT_FAMILY_MISSING', {
    factKey,
    vectorKey,
  });
}

function resolveTemporalEvidenceFactSource(featureVector, facts, sourceMode) {
  return {
    behavior: resolveTodayFactFamily({
      facts,
      featureVector,
      factKey: 'behavior',
      vectorKey: 'todayBehaviorStats',
      sourceMode,
    }),
    entry: resolveTodayFactFamily({
      facts,
      featureVector,
      factKey: 'entry',
      vectorKey: 'todayEntryStats',
      sourceMode,
    }),
    navigation: resolveTodayFactFamily({
      facts,
      featureVector,
      factKey: 'navigation',
      vectorKey: 'todayNavigationStats',
      sourceMode,
    }),
  };
}

function buildTodayContext(featureVector, entryVisitSummary = {}) {
  return {
    activeMs: toNumber(featureVector?.todayTotalMs),
    visits: toCount(entryVisitSummary.todayVisits),
    activeHours: countActiveHours(featureVector?.todayHourly),
    visitHours: toCount(entryVisitSummary.visitHoursToday),
  };
}

function entryVisitCount(source) {
  const entry = source?.entry || {};
  return Math.max(
    toCount(entry.todayVisits),
    sumVisits(entry.todayHourlyVisits),
  );
}

function buildReentryIntervalProfile(source) {
  const behavior = source.behavior;
  const exactBuckets = normalizeReentryGapBuckets(behavior.reentryGapBuckets);
  const exactBucketSampleCount = sumReentryGapBuckets(exactBuckets);
  const visits = entryVisitCount(source);
  const within2m = toCount(behavior.revisitWithin2m);
  const within5m = toCount(behavior.revisitWithin5m);
  const within10m = toCount(behavior.revisitWithin10m);
  const switchBackWithin10m = toCount(behavior.switchBackWithin10m);
  const switchIns = toCount(behavior.switchIns);
  const denominator = Math.max(1, visits - 1);

  const exactVisitBuckets = {
    within2m: exactBuckets.visit0To2m,
    between2m5m: exactBuckets.visit2To5m,
    between5m10m: exactBuckets.visit5To10m,
    between10m30m: exactBuckets.visit10To30m,
    between30m120m: exactBuckets.visit30To120m,
  };
  const exactSwitchBuckets = {
    within2m: exactBuckets.switch0To2m,
    between2m5m: exactBuckets.switch2To5m,
    between5m10m: exactBuckets.switch5To10m,
    between10m30m: exactBuckets.switch10To30m,
    between30m120m: exactBuckets.switch30To120m,
  };
  const exactCombinedBuckets = {
    within2m: exactVisitBuckets.within2m + exactSwitchBuckets.within2m,
    between2m5m: exactVisitBuckets.between2m5m + exactSwitchBuckets.between2m5m,
    between5m10m: exactVisitBuckets.between5m10m + exactSwitchBuckets.between5m10m,
    between10m30m: exactVisitBuckets.between10m30m + exactSwitchBuckets.between10m30m,
    between30m120m: exactVisitBuckets.between30m120m + exactSwitchBuckets.between30m120m,
  };
  const exactShortVisitCount = exactVisitBuckets.within2m
    + exactVisitBuckets.between2m5m
    + exactVisitBuckets.between5m10m;
  const exactShortSwitchCount = exactSwitchBuckets.within2m
    + exactSwitchBuckets.between2m5m
    + exactSwitchBuckets.between5m10m;
  const shortReentryCount = exactBucketSampleCount > 0 ? exactShortVisitCount : within10m;
  const shortSwitchBackCount = exactBucketSampleCount > 0 ? exactShortSwitchCount : switchBackWithin10m;

  return {
    mode: exactBucketSampleCount > 0
      ? 'exact_bucket_counts'
      : within10m > 0 || switchBackWithin10m > 0 ? 'threshold_counts' : 'unavailable',
    source: exactBucketSampleCount > 0
      ? 'behavior_reentry_gap_buckets'
      : 'behavior_threshold_counters',
    buckets: {
      within2m,
      between2m5m: Math.max(0, within5m - within2m),
      between5m10m: Math.max(0, within10m - within5m),
      within10m,
    },
    shortReentryCount,
    shortReentryShare: roundNumber(shortReentryCount / denominator),
    switchBackWithin10m: shortSwitchBackCount,
    switchBackShare: roundNumber(switchIns > 0 ? shortSwitchBackCount / switchIns : 0),
    exactBuckets,
    exactVisitBuckets,
    exactSwitchBuckets,
    exactCombinedBuckets,
    sampleCount: Math.max(exactBucketSampleCount, within10m + switchBackWithin10m),
    limitation: exactBucketSampleCount > 0
      ? 'Uses compressed interval buckets; no raw reentry timestamps are stored.'
      : 'Uses current threshold counters; exact interval quantiles require interval buckets at collection time.',
  };
}

function buildBackgroundResidencyProfile(featureVector, source) {
  const behavior = source.behavior;
  const backgroundMediaMs = toNumber(behavior.backgroundMediaMs);
  const backgroundLingerMs = toNumber(behavior.backgroundLingerMs);
  const staleTabMs = toNumber(behavior.staleTabMs);
  const backgroundPressureSignalMs = backgroundMediaMs + backgroundLingerMs + staleTabMs;
  const totalBackgroundResidencyMs = Math.max(backgroundMediaMs, backgroundLingerMs, staleTabMs);
  const activeMs = toNumber(featureVector?.todayTotalMs);
  const denominator = Math.max(1, activeMs + totalBackgroundResidencyMs);

  return {
    hasBackgroundResidencyFacts: totalBackgroundResidencyMs > 0 || backgroundPressureSignalMs > 0,
    backgroundMediaMs,
    backgroundLingerMs,
    staleTabMs,
    backgroundPressureSignalMs,
    totalBackgroundResidencyMs,
    backgroundResidencyShare: roundNumber(totalBackgroundResidencyMs / denominator),
    activeToResidencyRatio: roundNumber(activeMs > 0 ? totalBackgroundResidencyMs / activeMs : 0),
  };
}

function buildTabBurstProfile(source) {
  const behavior = source.behavior;
  const visits = Math.max(1, entryVisitCount(source));
  const newTabEntrances = toCount(behavior.newTabEntrances);
  const duplicateTabEntrances = toCount(behavior.duplicateTabEntrances);
  const highOpenTabEntrances = toCount(behavior.highOpenTabEntrances);
  const maxSameDomainOpenTabs = toCount(behavior.maxSameDomainOpenTabs);
  const maxOpenTabs = toCount(behavior.maxOpenTabs);

  return {
    hasTabContextFacts: newTabEntrances > 0
      || duplicateTabEntrances > 0
      || highOpenTabEntrances > 0
      || maxSameDomainOpenTabs > 0
      || maxOpenTabs > 0,
    newTabEntrances,
    duplicateTabEntrances,
    highOpenTabEntrances,
    maxSameDomainOpenTabs,
    maxOpenTabs,
    newTabEntryShare: roundNumber(newTabEntrances / visits),
    duplicateTabEntryShare: roundNumber(duplicateTabEntrances / visits),
    limitation: 'Burst grouping and per-tab dwell require tab-session summaries at collection time.',
  };
}

function buildInDomainNavigationDensity(featureVector, source) {
  const navigation = source.navigation;
  const linkNavigations = toCount(navigation.link);
  const totalNavigations = toCount(navigation.total);
  const activeMs = toNumber(featureVector?.todayTotalMs);
  const activeHours = Math.max(1, countActiveHours(featureVector?.todayHourly));
  const activeMinutes = Math.max(1, activeMs / SITE_PULL_MINUTE_MS);

  return {
    hasNavigationFacts: totalNavigations > 0 || linkNavigations > 0,
    linkNavigations,
    totalNavigations,
    linkShare: roundNumber(totalNavigations > 0 ? linkNavigations / totalNavigations : 0),
    linkPerActiveHour: roundNumber(linkNavigations / activeHours),
    linkPerActiveMinute: roundNumber(linkNavigations / activeMinutes),
    limitation: 'Same-domain density is inferred from domain navigation counters; URL-level path movement needs debounced URL transition buckets.',
  };
}

function firstPositiveIndex(values = []) {
  return Array.isArray(values)
    ? values.findIndex((value) => toNumber(value) > 0)
    : -1;
}

function lastPositiveIndex(values = []) {
  if (!Array.isArray(values)) return -1;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (toNumber(values[index]) > 0) return index;
  }
  return -1;
}

function buildCyclePositionProxy(featureVector) {
  const hourlyVisits = Array.isArray(featureVector?.todayHourlyVisits) ? featureVector.todayHourlyVisits : [];
  const hourlyUsage = Array.isArray(featureVector?.todayHourly) ? featureVector.todayHourly : [];
  const firstVisitHour = firstPositiveIndex(hourlyVisits);
  const lastVisitHour = lastPositiveIndex(hourlyVisits);
  const firstActiveHour = firstPositiveIndex(hourlyUsage);
  const lastActiveHour = lastPositiveIndex(hourlyUsage);
  const firstVisitLatencyHours = firstVisitHour >= 0 && firstActiveHour >= 0
    ? Math.max(0, firstVisitHour - firstActiveHour)
    : null;
  const tailLeadHours = lastVisitHour >= 0 && lastActiveHour >= 0
    ? Math.max(0, lastActiveHour - lastVisitHour)
    : null;

  return {
    mode: firstVisitHour >= 0 || lastVisitHour >= 0 ? 'hourly_proxy' : 'unavailable',
    firstActiveHour: firstActiveHour >= 0 ? firstActiveHour : null,
    firstVisitHour: firstVisitHour >= 0 ? firstVisitHour : null,
    firstVisitLatencyHours,
    lastActiveHour: lastActiveHour >= 0 ? lastActiveHour : null,
    lastVisitHour: lastVisitHour >= 0 ? lastVisitHour : null,
    tailLeadHours,
    limitation: 'Uses hourly visit buckets; exact cycle-first and cycle-tail profiles need cycle-anchored entry timestamps.',
  };
}

export function buildSitePullTemporalEvidence(featureVector = {}, facts = {}, options = {}) {
  const sourceMode = requireTemporalEvidenceSourceMode(options?.sourceMode);
  const factSource = resolveTemporalEvidenceFactSource(featureVector, facts, sourceMode);
  const entryVisitSummary = resolveSitePullEntryVisitSummary({
    facts: { entry: factSource.entry },
  });

  return {
    version: SITE_PULL_TEMPORAL_EVIDENCE_VERSION,
    basis: 'current_domain_temporal_facts',
    context: {
      today: buildTodayContext(featureVector, entryVisitSummary),
    },
    metrics: {
      reentryIntervalProfile: buildReentryIntervalProfile(factSource),
      backgroundResidencyProfile: buildBackgroundResidencyProfile(featureVector, factSource),
      tabBurstProfile: buildTabBurstProfile(factSource),
      inDomainNavigationDensity: buildInDomainNavigationDensity(featureVector, factSource),
      cyclePositionProxy: buildCyclePositionProxy(featureVector),
    },
    explanation: {
      factProfileMethod: 'Keeps current reentry, residency, tab, navigation, and cycle-position facts separate from the canonical personal trajectory.',
      cyclePositionMethod: 'Cycle-start and cycle-tail evidence should use first observed activity, not only the reset boundary; current output includes an hourly proxy until cycle-anchored entry timestamps are collected.',
    },
  };
}
