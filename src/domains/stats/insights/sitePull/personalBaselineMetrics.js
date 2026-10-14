import {
  STATS_PERSONAL_BASELINE_METRIC_DIRECTIONS,
  STATS_PERSONAL_BASELINE_METRIC_GRAINS,
  STATS_PERSONAL_BASELINE_METRIC_KINDS,
  buildPersonalBaselineMetricProfileMap,
  derivePersonalBaselineMetricAnomaly,
} from '../../baseline/index.js';
import {
  SITE_PULL_MINUTE_MS as MINUTE_MS,
  clamp01,
  toCount,
  toNumber,
} from './sitePullMath.js';
import {
  SITE_PULL_PERSONAL_BASELINE_POLICY,
  SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION,
} from './personalBaselinePolicy.js';

export const SITE_PULL_PERSONAL_BASELINE_METRICS_VERSION = 'site-pull-personal-baseline-metrics-v3';
export const SITE_PULL_PERSONAL_BASELINE_METRIC_PROVENANCE = Object.freeze({
  source: 'site_pull_baseline_series',
  windowBasis: 'completed_day',
  excludeCurrent: true,
});

export const SITE_PULL_PERSONAL_BASELINE_METRIC_IDS = Object.freeze({
  ACTIVE_MS: 'active_ms',
  VISIT_COUNT: 'visit_count',
  REVISIT_COUNT: 'revisit_count',
  REVISIT_RATE: 'revisit_rate',
  SWITCH_IN_COUNT: 'switch_in_count',
  SWITCH_OUT_COUNT: 'switch_out_count',
  SWITCH_BACK_COUNT: 'switch_back_count',
  SWITCH_CHURN_COUNT: 'switch_churn_count',
  QUICK_RETURN_RATE: 'quick_return_rate',
  SESSION_COUNT: 'session_count',
  SHORT_SESSION_COUNT: 'short_session_count',
  SHORT_SESSION_RATE: 'short_session_rate',
  LONG_SESSION_COUNT: 'long_session_count',
  LONG_SESSION_RATE: 'long_session_rate',
  MAX_SESSION_MS: 'max_session_ms',
});

const EMPTY_ANOMALY_OPTIONS = Object.freeze({});
const SITE_PULL_PERSONAL_BASELINE_METRIC_ANOMALY_OPTIONS = Object.freeze({
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.VISIT_COUNT]: Object.freeze({
    evidenceLow: 2,
    evidenceHigh: 12,
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT]: Object.freeze({
    evidenceLow: 1,
    evidenceHigh: 8,
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_IN_COUNT]: Object.freeze({
    evidenceLow: 1,
    evidenceHigh: 9,
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_OUT_COUNT]: Object.freeze({
    evidenceLow: 1,
    evidenceHigh: 9,
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_BACK_COUNT]: Object.freeze({
    evidenceLow: 1,
    evidenceHigh: 7,
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT]: Object.freeze({
    evidenceLow: 3,
    evidenceHigh: 18,
    lowRatio: 1.08,
    highRatio: 2.4,
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SESSION_COUNT]: Object.freeze({
    evidenceLow: 2,
    evidenceHigh: 12,
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_COUNT]: Object.freeze({
    evidenceLow: 1,
    evidenceHigh: 8,
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_COUNT]: Object.freeze({
    evidenceLow: 1,
    evidenceHigh: 5,
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS]: Object.freeze({
    evidenceLow: 10 * MINUTE_MS,
    evidenceHigh: 70 * MINUTE_MS,
    lowRatio: 1.08,
    highRatio: 2.4,
  }),
});

const DAILY_HIGHER_METRIC = Object.freeze({
  grain: STATS_PERSONAL_BASELINE_METRIC_GRAINS.DAY,
  direction: STATS_PERSONAL_BASELINE_METRIC_DIRECTIONS.HIGHER,
  scope: 'site',
  confidenceGate: 0.25,
});
const DAILY_VALUE_METRIC = Object.freeze({
  ...DAILY_HIGHER_METRIC,
  kind: STATS_PERSONAL_BASELINE_METRIC_KINDS.VALUE,
  unit: 'count',
  exposureUnit: 'observed_day',
});
const DAILY_RATIO_METRIC = Object.freeze({
  ...DAILY_HIGHER_METRIC,
  kind: STATS_PERSONAL_BASELINE_METRIC_KINDS.RATIO,
  unit: 'ratio',
});

const SITE_PULL_PERSONAL_BASELINE_METRIC_DEFINITIONS = Object.freeze({
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS]: Object.freeze({
    ...DAILY_HIGHER_METRIC,
    kind: STATS_PERSONAL_BASELINE_METRIC_KINDS.TIME,
    family: 'usage_time',
    unit: 'ms',
    exposureUnit: 'observed_day',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.VISIT_COUNT]: Object.freeze({
    ...DAILY_VALUE_METRIC,
    family: 'site_entry',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT]: Object.freeze({
    ...DAILY_VALUE_METRIC,
    family: 'site_entry',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_RATE]: Object.freeze({
    ...DAILY_RATIO_METRIC,
    family: 'site_entry',
    exposureUnit: 'revisit_opportunity',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_IN_COUNT]: Object.freeze({
    ...DAILY_VALUE_METRIC,
    family: 'attention_switching',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_OUT_COUNT]: Object.freeze({
    ...DAILY_VALUE_METRIC,
    family: 'attention_switching',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_BACK_COUNT]: Object.freeze({
    ...DAILY_VALUE_METRIC,
    family: 'attention_switching',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT]: Object.freeze({
    ...DAILY_VALUE_METRIC,
    family: 'attention_switching',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.QUICK_RETURN_RATE]: Object.freeze({
    ...DAILY_RATIO_METRIC,
    family: 'attention_switching',
    exposureUnit: 'switch_in',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SESSION_COUNT]: Object.freeze({
    ...DAILY_VALUE_METRIC,
    family: 'session_shape',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_COUNT]: Object.freeze({
    ...DAILY_VALUE_METRIC,
    family: 'session_shape',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_RATE]: Object.freeze({
    ...DAILY_RATIO_METRIC,
    family: 'session_shape',
    exposureUnit: 'session',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_COUNT]: Object.freeze({
    ...DAILY_VALUE_METRIC,
    family: 'session_shape',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_RATE]: Object.freeze({
    ...DAILY_RATIO_METRIC,
    family: 'session_shape',
    exposureUnit: 'session',
  }),
  [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS]: Object.freeze({
    ...DAILY_VALUE_METRIC,
    family: 'session_shape',
    unit: 'ms',
  }),
});

export function getSitePullPersonalBaselineMetricDefinition(metricId) {
  const definition = SITE_PULL_PERSONAL_BASELINE_METRIC_DEFINITIONS[metricId];
  if (!definition) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_DEFINITION_MISSING:${metricId}`);
  }
  return definition;
}

export function getSitePullPersonalBaselineMetricAnomalyOptions(metricId) {
  getSitePullPersonalBaselineMetricDefinition(metricId);
  return SITE_PULL_PERSONAL_BASELINE_METRIC_ANOMALY_OPTIONS[metricId]
    || EMPTY_ANOMALY_OPTIONS;
}

export function deriveSitePullPersonalBaselineMetricAnomaly({
  metricId,
  currentValue,
  currentEligible,
  stats,
  reference,
} = {}) {
  const definition = getSitePullPersonalBaselineMetricDefinition(metricId);
  return derivePersonalBaselineMetricAnomaly({
    kind: definition.kind,
    currentValue,
    currentEligible,
    stats,
    reference,
    anomalyOptions: getSitePullPersonalBaselineMetricAnomalyOptions(metricId),
  });
}

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function buildMissingObservation() {
  return {
    observed: false,
    eligible: false,
    value: null,
    exposure: 0,
  };
}

function buildObservedValueObservation(value) {
  return {
    observed: true,
    eligible: true,
    value: toNumber(value),
    exposure: 1,
  };
}

function buildObservedCountObservation(value) {
  return buildObservedValueObservation(toCount(value));
}

function buildObservedRateObservation(numeratorValue, denominatorValue) {
  const denominator = toCount(denominatorValue);
  if (denominator <= 0) {
    return {
      observed: true,
      eligible: false,
      value: null,
      exposure: 0,
    };
  }
  return {
    observed: true,
    eligible: true,
    value: toCount(numeratorValue) / denominator,
    exposure: denominator,
  };
}

function buildBaselineValueObservation(entry, value) {
  return entry.observed
    ? buildObservedValueObservation(value)
    : buildMissingObservation();
}

function buildBaselineCountObservation(entry, value) {
  return entry.observed
    ? buildObservedCountObservation(value)
    : buildMissingObservation();
}

function buildBaselineRateObservation(entry, numeratorValue, denominatorValue) {
  return entry.observed
    ? buildObservedRateObservation(numeratorValue, denominatorValue)
    : buildMissingObservation();
}

function buildCurrentValueObservation(currentObserved, value) {
  return currentObserved
    ? buildObservedValueObservation(value)
    : buildMissingObservation();
}

function buildCurrentCountObservation(currentObserved, value) {
  return currentObserved
    ? buildObservedCountObservation(value)
    : buildMissingObservation();
}

function buildCurrentRateObservation(currentObserved, numeratorValue, denominatorValue) {
  return currentObserved
    ? buildObservedRateObservation(numeratorValue, denominatorValue)
    : buildMissingObservation();
}

function requireBaselineEntries(entries) {
  const targetDays = SITE_PULL_PERSONAL_BASELINE_POLICY.observedBaseline.targetDays;
  if (!Array.isArray(entries) || entries.length !== targetDays) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_METRIC_ENTRIES_INVALID');
  }
  entries.forEach((entry, index) => {
    if (!isObjectRecord(entry) || typeof entry.observed !== 'boolean') {
      throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_ENTRY_INVALID:${index}`);
    }
    if (entry.observed) {
      if (typeof entry.activeMs !== 'number'
        || !Number.isFinite(entry.activeMs)
        || entry.activeMs < 0) {
        throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_ENTRY_ACTIVE_MS_INVALID:${index}`);
      }
    } else if (entry.activeMs !== null) {
      throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_ENTRY_MISSING_RELATION_INVALID:${index}`);
    }
  });
  return entries;
}

function buildDescriptor({
  id,
  observations,
  current,
  statsOptions,
  confidenceOptions,
}) {
  const definition = getSitePullPersonalBaselineMetricDefinition(id);
  const descriptor = {
    id,
    ...definition,
    metricVersion: SITE_PULL_PERSONAL_BASELINE_METRICS_VERSION,
    policyVersion: SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION,
    provenance: SITE_PULL_PERSONAL_BASELINE_METRIC_PROVENANCE,
    observations,
    current,
  };
  if (statsOptions !== undefined) descriptor.statsOptions = statsOptions;
  const anomalyOptions = getSitePullPersonalBaselineMetricAnomalyOptions(id);
  if (Object.keys(anomalyOptions).length > 0) descriptor.anomalyOptions = anomalyOptions;
  if (confidenceOptions !== undefined) descriptor.confidenceOptions = confidenceOptions;
  return descriptor;
}

export function buildSitePullPersonalBaselineMetricProfiles({
  baselineEntries,
  currentObserved,
  todayActiveMs = 0,
  todayVisits = 0,
  todayBehavior = {},
  todaySession = {},
  robustSigmaFromMad,
  timeStatsOptions = {},
  confidenceOptions = {},
} = {}) {
  const entries = requireBaselineEntries(baselineEntries);
  if (typeof currentObserved !== 'boolean') {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_CURRENT_OBSERVED_INVALID');
  }
  const activeMsObservations = entries.map((entry) => (
    buildBaselineValueObservation(entry, entry.activeMs)
  ));
  const visitObservations = entries.map((entry) => (
    buildBaselineCountObservation(entry, entry.visits)
  ));
  const revisitObservations = entries.map((entry) => (
    buildBaselineCountObservation(entry, entry.behavior?.revisitWithin10m)
  ));
  const switchInObservations = entries.map((entry) => (
    buildBaselineCountObservation(entry, entry.behavior?.switchIns)
  ));
  const switchOutObservations = entries.map((entry) => (
    buildBaselineCountObservation(entry, entry.behavior?.switchOuts)
  ));
  const switchChurnObservations = entries.map((entry) => buildBaselineCountObservation(
    entry,
    toCount(entry.behavior?.switchIns) + toCount(entry.behavior?.switchOuts),
  ));
  const switchBackObservations = entries.map((entry) => (
    buildBaselineCountObservation(entry, entry.behavior?.switchBackWithin10m)
  ));
  const sessionCountObservations = entries.map((entry) => (
    buildBaselineCountObservation(entry, entry.sessions?.count)
  ));
  const shortSessionObservations = entries.map((entry) => (
    buildBaselineCountObservation(entry, entry.sessions?.shortCount)
  ));
  const longSessionObservations = entries.map((entry) => (
    buildBaselineCountObservation(entry, entry.sessions?.longCount)
  ));
  const maxSessionObservations = entries.map((entry) => (
    buildBaselineValueObservation(entry, entry.sessions?.maxMs)
  ));
  const revisitRateObservations = entries.map((entry) => buildBaselineRateObservation(
    entry,
    entry.behavior?.revisitWithin10m,
    Math.max(0, toCount(entry.visits) - 1),
  ));
  const quickReturnRateObservations = entries.map((entry) => buildBaselineRateObservation(
    entry,
    entry.behavior?.switchBackWithin10m,
    entry.behavior?.switchIns,
  ));
  const shortSessionRateObservations = entries.map((entry) => buildBaselineRateObservation(
    entry,
    entry.sessions?.shortCount,
    entry.sessions?.count,
  ));
  const longSessionRateObservations = entries.map((entry) => buildBaselineRateObservation(
    entry,
    entry.sessions?.longCount,
    entry.sessions?.count,
  ));

  const todayRevisitWithin10m = toCount(todayBehavior.revisitWithin10m);
  const todaySwitchIns = toCount(todayBehavior.switchIns);
  const todaySwitchOuts = toCount(todayBehavior.switchOuts);
  const todaySwitchChurn = todaySwitchIns + todaySwitchOuts;
  const todaySwitchBackWithin10m = toCount(todayBehavior.switchBackWithin10m);
  const todaySessionCount = toCount(todaySession.count);
  const todayShortSessionCount = toCount(todaySession.shortCount);
  const todayLongSessionCount = toCount(todaySession.longCount);
  const currentObservations = {
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS]: buildCurrentValueObservation(
      currentObserved,
      todayActiveMs,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.VISIT_COUNT]: buildCurrentCountObservation(
      currentObserved,
      todayVisits,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT]: buildCurrentCountObservation(
      currentObserved,
      todayRevisitWithin10m,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_RATE]: buildCurrentRateObservation(
      currentObserved,
      todayRevisitWithin10m,
      Math.max(0, toCount(todayVisits) - 1),
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_IN_COUNT]: buildCurrentCountObservation(
      currentObserved,
      todaySwitchIns,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_OUT_COUNT]: buildCurrentCountObservation(
      currentObserved,
      todaySwitchOuts,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_BACK_COUNT]: buildCurrentCountObservation(
      currentObserved,
      todaySwitchBackWithin10m,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT]: buildCurrentCountObservation(
      currentObserved,
      todaySwitchChurn,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.QUICK_RETURN_RATE]: buildCurrentRateObservation(
      currentObserved,
      todaySwitchBackWithin10m,
      todaySwitchIns,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SESSION_COUNT]: buildCurrentCountObservation(
      currentObserved,
      todaySessionCount,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_COUNT]: buildCurrentCountObservation(
      currentObserved,
      todayShortSessionCount,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_RATE]: buildCurrentRateObservation(
      currentObserved,
      todayShortSessionCount,
      todaySessionCount,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_COUNT]: buildCurrentCountObservation(
      currentObserved,
      todayLongSessionCount,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_RATE]: buildCurrentRateObservation(
      currentObserved,
      todayLongSessionCount,
      todaySessionCount,
    ),
    [SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS]: buildCurrentValueObservation(
      currentObserved,
      todaySession.maxMs,
    ),
  };
  const current = (metricId) => currentObservations[metricId];
  const robustStatsOptions = {
    robustSigmaFromMad,
  };
  const builtMetrics = buildPersonalBaselineMetricProfileMap([
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
      observations: activeMsObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS),
      statsOptions: timeStatsOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.VISIT_COUNT,
      observations: visitObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.VISIT_COUNT),
      statsOptions: { ...robustStatsOptions, minSigma: 1, referenceFloor: 1 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT,
      observations: revisitObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT),
      statsOptions: { ...robustStatsOptions, minSigma: 1, referenceFloor: 1 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_RATE,
      observations: revisitRateObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_RATE),
      statsOptions: { ...robustStatsOptions, minSigma: 0.05, referenceFloor: 0.05 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_IN_COUNT,
      observations: switchInObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_IN_COUNT),
      statsOptions: { ...robustStatsOptions, minSigma: 1, referenceFloor: 1 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_OUT_COUNT,
      observations: switchOutObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_OUT_COUNT),
      statsOptions: { ...robustStatsOptions, minSigma: 1, referenceFloor: 1 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_BACK_COUNT,
      observations: switchBackObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_BACK_COUNT),
      statsOptions: { ...robustStatsOptions, minSigma: 1, referenceFloor: 1 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT,
      observations: switchChurnObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT),
      statsOptions: { ...robustStatsOptions, minSigma: 2, referenceFloor: 2 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.QUICK_RETURN_RATE,
      observations: quickReturnRateObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.QUICK_RETURN_RATE),
      statsOptions: { ...robustStatsOptions, minSigma: 0.05, referenceFloor: 0.05 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SESSION_COUNT,
      observations: sessionCountObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SESSION_COUNT),
      statsOptions: { ...robustStatsOptions, minSigma: 1, referenceFloor: 1 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_COUNT,
      observations: shortSessionObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_COUNT),
      statsOptions: { ...robustStatsOptions, minSigma: 1, referenceFloor: 1 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_RATE,
      observations: shortSessionRateObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_RATE),
      statsOptions: { ...robustStatsOptions, minSigma: 0.05, referenceFloor: 0.05 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_COUNT,
      observations: longSessionObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_COUNT),
      statsOptions: { ...robustStatsOptions, minSigma: 1, referenceFloor: 1 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_RATE,
      observations: longSessionRateObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_RATE),
      statsOptions: { ...robustStatsOptions, minSigma: 0.05, referenceFloor: 0.05 },
      confidenceOptions,
    }),
    buildDescriptor({
      id: SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS,
      observations: maxSessionObservations,
      current: current(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS),
      statsOptions: {
        ...robustStatsOptions,
        minSigma: 5 * MINUTE_MS,
        referenceFloor: 5 * MINUTE_MS,
      },
      confidenceOptions,
    }),
  ]);

  return { metrics: builtMetrics };
}

export function getSitePullPersonalBaselineMetric(personalBaseline = null, metricId = '') {
  if (personalBaseline === null || personalBaseline === undefined) return null;
  if (!isObjectRecord(personalBaseline)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_INVALID');
  }
  if (!isObjectRecord(personalBaseline.metrics)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_METRICS_MISSING');
  }
  const metric = personalBaseline.metrics[metricId];
  if (!isObjectRecord(metric)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_MISSING:${metricId}`);
  }
  return metric;
}

export function resolveSitePullPersonalBaselineMetricScores(personalBaseline = null) {
  if (personalBaseline === null || personalBaseline === undefined) return null;
  if (!isObjectRecord(personalBaseline)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_INVALID');
  }
  if (!isObjectRecord(personalBaseline.metrics)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_METRICS_MISSING');
  }
  return buildSitePullPersonalBaselineMetricScores(personalBaseline.metrics);
}

function requireMetricScoreSection(metric, metricId, sectionName) {
  const section = metric?.[sectionName];
  if (!isObjectRecord(section)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_SCORE_SECTION_MISSING:${metricId}:${sectionName}`);
  }
  return section;
}

export function buildSitePullPersonalBaselineMetricScores(metrics = {}) {
  const activeMsMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS];
  const visitMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.VISIT_COUNT];
  const revisitCountMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT];
  const revisitRateMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_RATE];
  const switchInMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_IN_COUNT];
  const switchOutMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_OUT_COUNT];
  const switchBackMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_BACK_COUNT];
  const switchChurnMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT];
  const quickReturnRateMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.QUICK_RETURN_RATE];
  const sessionCountMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SESSION_COUNT];
  const shortSessionCountMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_COUNT];
  const shortSessionRateMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_RATE];
  const longSessionCountMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_COUNT];
  const longSessionRateMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_RATE];
  const maxSessionMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS];

  if (
    !activeMsMetric
    || !visitMetric
    || !revisitCountMetric
    || !revisitRateMetric
    || !switchInMetric
    || !switchOutMetric
    || !switchBackMetric
    || !switchChurnMetric
    || !quickReturnRateMetric
    || !sessionCountMetric
    || !shortSessionCountMetric
    || !shortSessionRateMetric
    || !longSessionCountMetric
    || !longSessionRateMetric
    || !maxSessionMetric
  ) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_METRIC_SCORE_INPUT_INVALID');
  }

  const activeMsAnomaly = requireMetricScoreSection(
    activeMsMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
    'anomaly',
  );
  const revisitCountAnomaly = requireMetricScoreSection(
    revisitCountMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT,
    'anomaly',
  );
  requireMetricScoreSection(
    revisitRateMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_RATE,
    'anomaly',
  );
  const switchBackAnomaly = requireMetricScoreSection(
    switchBackMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_BACK_COUNT,
    'anomaly',
  );
  const switchChurnAnomaly = requireMetricScoreSection(
    switchChurnMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT,
    'anomaly',
  );
  requireMetricScoreSection(
    quickReturnRateMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.QUICK_RETURN_RATE,
    'anomaly',
  );
  const sessionCountAnomaly = requireMetricScoreSection(
    sessionCountMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SESSION_COUNT,
    'anomaly',
  );
  const shortSessionCountAnomaly = requireMetricScoreSection(
    shortSessionCountMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_COUNT,
    'anomaly',
  );
  requireMetricScoreSection(
    shortSessionRateMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_RATE,
    'anomaly',
  );
  const longSessionCountAnomaly = requireMetricScoreSection(
    longSessionCountMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_COUNT,
    'anomaly',
  );
  requireMetricScoreSection(
    longSessionRateMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_RATE,
    'anomaly',
  );
  const maxSessionAnomaly = requireMetricScoreSection(
    maxSessionMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS,
    'anomaly',
  );
  const timeConfidence = activeMsMetric.confidence;
  const timeAnomalyScore = clamp01(activeMsAnomaly.score);
  const visitConfidence = visitMetric.confidence;
  const revisitConfidence = revisitCountMetric.confidence;
  const loopConfidence = switchChurnMetric.confidence;
  const sessionConfidence = sessionCountMetric.confidence;
  const visitAnomalyScore = visitMetric.anomalyScore;
  const revisitAnomalyScore = revisitConfidence >= 0.25
    ? clamp01(
        (revisitCountAnomaly.score * 0.42)
        + (clamp01(revisitRateMetric.anomalyScore) * 0.38)
        + (switchBackAnomaly.score * 0.2),
      )
    : 0;
  const switchChurnAnomalyScore = switchChurnMetric.anomalyScore;
  const quickReturnAnomalyScore = loopConfidence >= 0.25
    ? clamp01(
        (switchBackAnomaly.score * 0.46)
        + (clamp01(quickReturnRateMetric.anomalyScore) * 0.42)
        + (switchChurnAnomaly.score * 0.12),
      )
    : 0;
  const shortSessionAnomalyScore = sessionConfidence >= 0.25
    ? clamp01(
        (shortSessionCountAnomaly.score * 0.45)
        + (clamp01(shortSessionRateMetric.anomalyScore) * 0.4)
        + (sessionCountAnomaly.score * 0.15),
      )
    : 0;
  const sessionDepthAnomalyScore = sessionConfidence >= 0.25
    ? clamp01(
        (maxSessionAnomaly.score * 0.58)
        + (clamp01(longSessionRateMetric.anomalyScore) * 0.27)
        + (longSessionCountAnomaly.score * 0.15),
      )
    : 0;

  return {
    timeConfidence,
    timeAnomalyScore,
    visitConfidence,
    revisitConfidence,
    loopConfidence,
    sessionConfidence,
    visitAnomalyScore,
    revisitAnomalyScore,
    switchChurnAnomalyScore,
    quickReturnAnomalyScore,
    shortSessionAnomalyScore,
    sessionDepthAnomalyScore,
  };
}
