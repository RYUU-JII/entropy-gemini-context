import {
  clamp01,
  toNumber,
} from './sitePullMath.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  SITE_PULL_PERSONAL_BASELINE_METRIC_PROVENANCE,
  SITE_PULL_PERSONAL_BASELINE_METRICS_VERSION,
  deriveSitePullPersonalBaselineMetricAnomaly,
  getSitePullPersonalBaselineMetricDefinition,
  getSitePullPersonalBaselineMetric,
  resolveSitePullPersonalBaselineMetricScores,
} from './personalBaselineMetrics.js';
import {
  SITE_PULL_ADAPTIVE_REFERENCE_STATES,
  SITE_PULL_PERSONAL_BASELINE_POLICY,
  SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION,
  SITE_PULL_PERSONAL_BASELINE_ROLES,
  SITE_PULL_PERSONAL_TRAJECTORY_STATES,
  buildSitePullPersonalBaselinePolicySummary,
  computeSitePullPersonalWeight,
  deriveSitePullAdaptiveReferenceProjection,
  deriveSitePullRecentTrajectoryProjection,
  resolveSitePullPersonalBaselineStatus,
} from './personalBaselinePolicy.js';
import {
  STATS_PERSONAL_BASELINE_CORE_VERSION,
  STATS_PERSONAL_BASELINE_METRIC_KINDS,
} from '../../baseline/index.js';

export const SITE_PULL_PERSONAL_BASELINE_VERSION = 'site-pull-personal-baseline-v3';

const PLAIN_OBJECT_PROTOTYPE = Object.prototype;
const PUBLIC_PERSONAL_BASELINE_KEYS = Object.freeze([
  'version',
  'policyVersion',
  'policy',
  'targetDays',
  'currentObserved',
  'observedDays',
  'activeDays',
  'activeDayRate',
  'totalBaselineMs',
  'medianDailyMs',
  'p75DailyMs',
  'p90DailyMs',
  'activeMedianMs',
  'activeP75Ms',
  'activeP90Ms',
  'p75ReferenceMs',
  'p90ReferenceMs',
  'madMs',
  'iqrMs',
  'robustSigmaMs',
  'todayVsP75Ratio',
  'robustZ',
  'timeAnomalyScore',
  'trendAnomalyScore',
  'todayVisits',
  'visitMedian',
  'visitP75',
  'visitP90',
  'todayVsVisitP75Ratio',
  'visitAnomalyScore',
  'visitConfidence',
  'todayRevisitWithin10m',
  'todayRevisitRate',
  'revisitMedian',
  'revisitP75',
  'revisitP90',
  'revisitRateP75',
  'todayVsRevisitP75Ratio',
  'revisitAnomalyScore',
  'revisitConfidence',
  'todaySwitchIns',
  'todaySwitchOuts',
  'todaySwitchChurn',
  'switchChurnMedian',
  'switchChurnP75',
  'switchChurnP90',
  'todayVsSwitchChurnP75Ratio',
  'switchChurnAnomalyScore',
  'todaySwitchBackWithin10m',
  'todayQuickReturnRate',
  'quickReturnRateP75',
  'quickReturnAnomalyScore',
  'loopConfidence',
  'todaySessionCount',
  'todayShortSessionCount',
  'todayShortSessionRate',
  'shortSessionRateP75',
  'shortSessionAnomalyScore',
  'todayLongSessionCount',
  'todayLongSessionRate',
  'longSessionRateP75',
  'todayMaxSessionMs',
  'maxSessionMedianMs',
  'maxSessionP75Ms',
  'maxSessionP90Ms',
  'todayVsMaxSessionP75Ratio',
  'maxSessionRobustZ',
  'sessionDepthAnomalyScore',
  'sessionConfidence',
  'recentAverageMs',
  'baselineAverageMs',
  'trendRatio',
  'confidence',
  'personalWeight',
  'status',
  'metrics',
  'recentTrajectory',
  'adaptiveReference',
]);
const PUBLIC_METRIC_PROFILE_KEYS = Object.freeze([
  'role',
  'coreVersion',
  'metricVersion',
  'policyVersion',
  'id',
  'kind',
  'family',
  'unit',
  'grain',
  'direction',
  'scope',
  'exposureUnit',
  'provenance',
  'currentObserved',
  'currentValue',
  'currentEligible',
  'currentExposure',
  'sample',
  'stats',
  'reference',
  'anomaly',
  'confidence',
  'confidenceGate',
  'anomalyScore',
]);
const PUBLIC_METRIC_PROVENANCE_KEYS = Object.freeze([
  'source',
  'windowBasis',
  'excludeCurrent',
]);
const PUBLIC_METRIC_SAMPLE_KEYS = Object.freeze([
  'observedCount',
  'eligibleCount',
  'ineligibleCount',
  'missingCount',
  'exposureTotal',
  'positiveCount',
  'valueTotal',
]);
const PUBLIC_METRIC_ANOMALY_KEYS = Object.freeze(['score', 'ratio', 'robustZ']);
const PUBLIC_TIME_METRIC_STAT_KEYS = Object.freeze([
  'medianDailyMs',
  'p25DailyMs',
  'p75DailyMs',
  'p90DailyMs',
  'activeMedianMs',
  'activeP75Ms',
  'activeP90Ms',
  'madMs',
  'iqrMs',
  'robustSigmaMs',
]);
const PUBLIC_VALUE_METRIC_STAT_KEYS = Object.freeze([
  'median',
  'p25',
  'p75',
  'p90',
  'positiveMedian',
  'positiveP75',
  'mad',
  'iqr',
  'sigma',
  'p75Reference',
  'p90Reference',
]);
const PUBLIC_METRIC_STAT_KEYS = Object.freeze([
  ...PUBLIC_VALUE_METRIC_STAT_KEYS,
  ...PUBLIC_TIME_METRIC_STAT_KEYS,
]);
const PUBLIC_TIME_METRIC_REFERENCE_KEYS = Object.freeze([
  'p75ReferenceMs',
  'p90ReferenceMs',
]);
const PUBLIC_POLICY_KEYS = Object.freeze([
  'version',
  'observedBaselineRole',
  'recentTrajectoryRole',
  'adaptiveReferenceRole',
  'normativeAnchorRole',
  'targetDays',
  'excludeCurrentDay',
  'observedBaselineIsGoal',
  'mutatesObservedBaseline',
  'duplicateProductionPolicy',
]);
const PUBLIC_RECENT_TRAJECTORY_KEYS = Object.freeze([
  'version',
  'role',
  'state',
  'sampleDays',
  'comparisonDays',
  'recentDays',
  'momentumDays',
  'recentActiveDays',
  'previousActiveDays',
  'recentTotalMs',
  'recentPreviousMaxMs',
  'currentObserved',
  'todayMs',
  'todayShareOfRecent',
  'singleDaySpikeScore',
  'recentAverageMs',
  'momentumAverageMs',
  'priorAverageMs',
  'recentMeanAbsoluteDeviationMs',
  'referenceMs',
  'recentVsReferenceRatio',
  'momentumVsReferenceRatio',
  'todayVsReferenceRatio',
  'improvementScore',
  'risingScore',
  'reboundScore',
  'volatilityScore',
  'confidence',
  'mutatesObservedBaseline',
  'caveats',
]);
const PUBLIC_ADAPTIVE_REFERENCE_KEYS = Object.freeze([
  'version',
  'role',
  'referenceMode',
  'state',
  'observedReferenceMs',
  'referenceMs',
  'tighteningRatio',
  'maxTightenRatio',
  'confidence',
  'mutatesObservedBaseline',
  'caveats',
]);
const EXPECTED_METRIC_IDS = Object.freeze(Object.values(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS));

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isObjectRecord(value) && PLAIN_OBJECT_PROTOTYPE.hasOwnProperty.call(value, key);
}

function requireNoUnexpectedFields(value, allowedFields, errorPrefix) {
  const allowed = new Set(allowedFields);
  const unexpectedField = Object.keys(value).find((fieldName) => !allowed.has(fieldName));
  if (unexpectedField) {
    throw new Error(`${errorPrefix}_FIELD_UNEXPECTED:${unexpectedField}`);
  }
}

function requireExactFields(value, expectedFields, errorPrefix) {
  requireNoUnexpectedFields(value, expectedFields, errorPrefix);
  const missingField = expectedFields.find((fieldName) => !hasOwn(value, fieldName));
  if (missingField) {
    throw new Error(`${errorPrefix}_FIELD_MISSING:${missingField}`);
  }
}

function requireExactString(value, errorCode) {
  if (typeof value !== 'string' || value.length <= 0 || value.trim() !== value) {
    throw new Error(errorCode);
  }
  return value;
}

function requireExactBoolean(value, errorCode) {
  if (typeof value !== 'boolean') {
    throw new Error(errorCode);
  }
  return value;
}

function requireExactNumber(value, errorCode, { max = Infinity, integer = false } = {}) {
  if (!Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(errorCode);
  }
  return value;
}

function requireExactStringArray(value, errorCode) {
  if (!Array.isArray(value) || value.some((entry) => (
    typeof entry !== 'string' || entry.length <= 0 || entry.trim() !== entry
  ))) {
    throw new Error(errorCode);
  }
  return value;
}

function hasExactProjectionValues(actual, expected, keys) {
  return keys.every((key) => {
    if (Array.isArray(expected[key])) {
      return Array.isArray(actual[key])
        && actual[key].length === expected[key].length
        && actual[key].every((value, index) => value === expected[key][index]);
    }
    return actual[key] === expected[key];
  });
}

function requireMetricProfileField(metric, metricId, fieldName) {
  if (!hasOwn(metric, fieldName)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_MISSING:${metricId}:${fieldName}`);
  }
  return metric[fieldName];
}

function requireMetricProfileString(metric, metricId, fieldName) {
  const value = requireMetricProfileField(metric, metricId, fieldName);
  if (typeof value !== 'string' || value.length <= 0) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_INVALID:${metricId}:${fieldName}`);
  }
  return value;
}

function requireMetricProfileNumber(metric, metricId, fieldName) {
  const value = requireMetricProfileField(metric, metricId, fieldName);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_INVALID:${metricId}:${fieldName}`);
  }
  return value;
}

function requireMetricProfileObject(metric, metricId, fieldName) {
  const value = requireMetricProfileField(metric, metricId, fieldName);
  if (!isObjectRecord(value)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_INVALID:${metricId}:${fieldName}`);
  }
  return value;
}

function requireMetricSectionNumber(
  section,
  metricId,
  sectionName,
  fieldName,
  { nonNegative = true } = {},
) {
  if (!hasOwn(section, fieldName)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_MISSING:${metricId}:${sectionName}.${fieldName}`);
  }
  const value = section[fieldName];
  if (!Number.isFinite(value) || (nonNegative && value < 0)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_INVALID:${metricId}:${sectionName}.${fieldName}`);
  }
  return value;
}

function toPublicMetricStats(stats, metricId, kind) {
  const requiredKeys = kind === 'time'
    ? PUBLIC_TIME_METRIC_STAT_KEYS
    : PUBLIC_VALUE_METRIC_STAT_KEYS;
  requireNoUnexpectedFields(
    stats,
    requiredKeys,
    `SITE_PULL_PERSONAL_BASELINE_METRIC_STATS:${metricId}`,
  );
  requiredKeys.forEach((key) => requireMetricSectionNumber(stats, metricId, 'stats', key));
  const publicStats = PUBLIC_METRIC_STAT_KEYS.reduce((projection, key) => {
    if (hasOwn(stats, key)) projection[key] = stats[key];
    return projection;
  }, {});
  if (kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.TIME) {
    if (publicStats.p25DailyMs > publicStats.medianDailyMs
      || publicStats.medianDailyMs > publicStats.p75DailyMs
      || publicStats.p75DailyMs > publicStats.p90DailyMs
      || publicStats.activeMedianMs > publicStats.activeP75Ms
      || publicStats.activeP75Ms > publicStats.activeP90Ms) {
      throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_STATS_RELATION_INVALID:${metricId}`);
    }
  } else if (publicStats.p25 > publicStats.median
    || publicStats.median > publicStats.p75
    || publicStats.p75 > publicStats.p90
    || publicStats.positiveMedian > publicStats.positiveP75
    || publicStats.p75Reference > publicStats.p90Reference) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_STATS_RELATION_INVALID:${metricId}`);
  }
  return publicStats;
}

function toPublicMetricReference(reference, metricId, kind) {
  const expectedKeys = kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.TIME
    ? PUBLIC_TIME_METRIC_REFERENCE_KEYS
    : [];
  requireNoUnexpectedFields(
    reference,
    expectedKeys,
    `SITE_PULL_PERSONAL_BASELINE_METRIC_REFERENCE:${metricId}`,
  );
  const publicReference = expectedKeys.reduce((projection, key) => {
    projection[key] = requireMetricSectionNumber(reference, metricId, 'reference', key);
    return projection;
  }, {});
  if (kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.TIME
    && publicReference.p75ReferenceMs > publicReference.p90ReferenceMs) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_REFERENCE_RELATION_INVALID:${metricId}`);
  }
  return publicReference;
}

function toPublicMetricProfile(metric = null) {
  if (!isObjectRecord(metric)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_METRIC_INVALID');
  }
  const metricId = requireMetricProfileString(metric, 'unknown', 'id');
  requireNoUnexpectedFields(
    metric,
    PUBLIC_METRIC_PROFILE_KEYS,
    `SITE_PULL_PERSONAL_BASELINE_METRIC:${metricId}`,
  );
  const definition = getSitePullPersonalBaselineMetricDefinition(metricId);
  const kind = requireMetricProfileString(metric, metricId, 'kind');
  const role = requireMetricProfileString(metric, metricId, 'role');
  const coreVersion = requireMetricProfileString(metric, metricId, 'coreVersion');
  const metricVersion = requireMetricProfileString(metric, metricId, 'metricVersion');
  const policyVersion = requireMetricProfileString(metric, metricId, 'policyVersion');
  const family = requireMetricProfileString(metric, metricId, 'family');
  const unit = requireMetricProfileString(metric, metricId, 'unit');
  const grain = requireMetricProfileString(metric, metricId, 'grain');
  const direction = requireMetricProfileString(metric, metricId, 'direction');
  const scope = requireMetricProfileString(metric, metricId, 'scope');
  const exposureUnit = requireMetricProfileString(metric, metricId, 'exposureUnit');
  if (role !== SITE_PULL_PERSONAL_BASELINE_ROLES.OBSERVED_BASELINE
    || coreVersion !== STATS_PERSONAL_BASELINE_CORE_VERSION
    || metricVersion !== SITE_PULL_PERSONAL_BASELINE_METRICS_VERSION
    || policyVersion !== SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION
    || kind !== definition.kind
    || family !== definition.family
    || unit !== definition.unit
    || grain !== definition.grain
    || direction !== definition.direction
    || scope !== definition.scope
    || exposureUnit !== definition.exposureUnit) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_IDENTITY_INVALID:${metricId}`);
  }
  const currentObserved = requireMetricProfileField(metric, metricId, 'currentObserved');
  if (typeof currentObserved !== 'boolean') {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_INVALID:${metricId}:currentObserved`);
  }
  const currentEligible = requireMetricProfileField(metric, metricId, 'currentEligible');
  if (typeof currentEligible !== 'boolean') {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_INVALID:${metricId}:currentEligible`);
  }
  const currentValue = requireMetricProfileField(metric, metricId, 'currentValue');
  if (currentEligible) {
    if (!Number.isFinite(currentValue) || currentValue < 0) {
      throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_INVALID:${metricId}:currentValue`);
    }
  } else if (currentValue !== null) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_INVALID:${metricId}:currentValue`);
  }
  if (kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.RATIO
    && currentEligible
    && currentValue > 1) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_INVALID:${metricId}:currentValue`);
  }
  const provenance = requireMetricProfileObject(metric, metricId, 'provenance');
  requireNoUnexpectedFields(
    provenance,
    PUBLIC_METRIC_PROVENANCE_KEYS,
    `SITE_PULL_PERSONAL_BASELINE_METRIC_PROVENANCE:${metricId}`,
  );
  if (PUBLIC_METRIC_PROVENANCE_KEYS.some((fieldName) => (
    provenance[fieldName] !== SITE_PULL_PERSONAL_BASELINE_METRIC_PROVENANCE[fieldName]
  ))) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_FIELD_INVALID:${metricId}:provenance`);
  }
  const currentExposure = requireMetricProfileNumber(metric, metricId, 'currentExposure');
  if ((currentEligible && (!currentObserved || currentExposure <= 0))
    || (!currentEligible && currentExposure !== 0)
    || (!currentObserved && currentValue !== null)
    || (kind !== STATS_PERSONAL_BASELINE_METRIC_KINDS.RATIO
      && currentObserved !== currentEligible)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_CURRENT_RELATION_INVALID:${metricId}`);
  }
  const sample = requireMetricProfileObject(metric, metricId, 'sample');
  requireNoUnexpectedFields(
    sample,
    PUBLIC_METRIC_SAMPLE_KEYS,
    `SITE_PULL_PERSONAL_BASELINE_METRIC_SAMPLE:${metricId}`,
  );
  const sampleProjection = PUBLIC_METRIC_SAMPLE_KEYS.reduce((result, key) => {
    result[key] = requireMetricSectionNumber(sample, metricId, 'sample', key);
    return result;
  }, {});
  if (![sampleProjection.observedCount, sampleProjection.eligibleCount,
    sampleProjection.ineligibleCount, sampleProjection.missingCount,
    sampleProjection.positiveCount].every(Number.isInteger)
    || sampleProjection.observedCount !== (
      sampleProjection.eligibleCount + sampleProjection.ineligibleCount
    )
    || sampleProjection.positiveCount > sampleProjection.eligibleCount
    || sampleProjection.observedCount + sampleProjection.missingCount
      !== SITE_PULL_PERSONAL_BASELINE_POLICY.observedBaseline.targetDays
    || (kind !== STATS_PERSONAL_BASELINE_METRIC_KINDS.RATIO && (
      sampleProjection.eligibleCount !== sampleProjection.observedCount
      || sampleProjection.ineligibleCount !== 0
      || sampleProjection.exposureTotal !== sampleProjection.eligibleCount
    ))
    || (kind === STATS_PERSONAL_BASELINE_METRIC_KINDS.RATIO
      && sampleProjection.valueTotal > sampleProjection.eligibleCount)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_SAMPLE_RELATION_INVALID:${metricId}`);
  }
  const stats = requireMetricProfileObject(metric, metricId, 'stats');
  const reference = requireMetricProfileObject(metric, metricId, 'reference');
  const publicStats = toPublicMetricStats(stats, metricId, kind);
  const publicReference = toPublicMetricReference(reference, metricId, kind);
  const anomaly = requireMetricProfileObject(metric, metricId, 'anomaly');
  requireNoUnexpectedFields(
    anomaly,
    PUBLIC_METRIC_ANOMALY_KEYS,
    `SITE_PULL_PERSONAL_BASELINE_METRIC_ANOMALY:${metricId}`,
  );
  const anomalyScore = requireMetricProfileNumber(metric, metricId, 'anomalyScore');
  const confidence = requireMetricProfileNumber(metric, metricId, 'confidence');
  const confidenceGate = requireMetricProfileNumber(metric, metricId, 'confidenceGate');
  if (confidence > 1
    || confidenceGate !== definition.confidenceGate
    || anomalyScore > 1) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_SCORE_INVALID:${metricId}`);
  }
  const anomalyValue = requireMetricSectionNumber(anomaly, metricId, 'anomaly', 'score');
  const anomalyRatio = requireMetricSectionNumber(anomaly, metricId, 'anomaly', 'ratio');
  const anomalyRobustZ = requireMetricSectionNumber(
    anomaly,
    metricId,
    'anomaly',
    'robustZ',
    { nonNegative: false },
  );
  const publicAnomaly = {
    score: Number(anomalyValue.toFixed(4)),
    ratio: Number(anomalyRatio.toFixed(3)),
    robustZ: Number(anomalyRobustZ.toFixed(3)),
  };
  const canonicalAnomaly = deriveSitePullPersonalBaselineMetricAnomaly({
    metricId,
    currentValue,
    currentEligible,
    stats: publicStats,
    reference: publicReference,
  });
  const canonicalPublicAnomaly = {
    score: Number(canonicalAnomaly.score.toFixed(4)),
    ratio: Number(canonicalAnomaly.ratio.toFixed(3)),
    robustZ: Number(canonicalAnomaly.robustZ.toFixed(3)),
  };
  if (!hasExactProjectionValues(
    publicAnomaly,
    canonicalPublicAnomaly,
    PUBLIC_METRIC_ANOMALY_KEYS,
  )) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_ANOMALY_RELATION_INVALID:${metricId}`);
  }
  const publicAnomalyScore = Number(anomalyScore.toFixed(4));
  const expectedAnomalyScore = Number((
    confidence >= confidenceGate ? canonicalAnomaly.score : 0
  ).toFixed(4));
  if (anomalyValue > 1 || publicAnomalyScore !== expectedAnomalyScore) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_SCORE_RELATION_INVALID:${metricId}`);
  }
  return {
    role,
    coreVersion,
    metricVersion,
    policyVersion,
    id: metricId,
    kind,
    family,
    unit,
    grain,
    direction,
    scope,
    exposureUnit,
    provenance: {
      source: provenance.source,
      windowBasis: provenance.windowBasis,
      excludeCurrent: provenance.excludeCurrent,
    },
    currentObserved,
    currentValue,
    currentEligible,
    currentExposure,
    sample: sampleProjection,
    stats: publicStats,
    reference: publicReference,
    anomaly: publicAnomaly,
    confidence: Number(confidence.toFixed(4)),
    confidenceGate: Number(confidenceGate.toFixed(4)),
    anomalyScore: publicAnomalyScore,
  };
}

function toPublicPersonalBaselineMetrics(metrics = null) {
  if (!isObjectRecord(metrics)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_METRICS_MISSING');
  }
  const metricIds = Object.keys(metrics);
  const unexpectedMetricId = metricIds.find((id) => !EXPECTED_METRIC_IDS.includes(id));
  if (unexpectedMetricId) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_ID_UNEXPECTED:${unexpectedMetricId}`);
  }
  const missingMetricId = EXPECTED_METRIC_IDS.find((id) => !hasOwn(metrics, id));
  if (missingMetricId) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_ID_MISSING:${missingMetricId}`);
  }
  const publicMetrics = Object.entries(metrics).reduce((result, [id, metric]) => {
    const publicMetric = toPublicMetricProfile(metric);
    if (publicMetric.id !== id) {
      throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_ID_MISMATCH:${id}:${publicMetric.id}`);
    }
    result[id] = publicMetric;
    return result;
  }, {});
  const coverageAuthority = publicMetrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS].sample;
  Object.entries(publicMetrics).forEach(([id, metric]) => {
    if (metric.sample.observedCount !== coverageAuthority.observedCount
      || metric.sample.missingCount !== coverageAuthority.missingCount
      || metric.currentObserved
        !== publicMetrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS].currentObserved) {
      throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_SAMPLE_RELATION_INVALID:${id}`);
    }
  });
  return publicMetrics;
}

function requirePersonalBaselineField(baseline, fieldName) {
  if (!hasOwn(baseline, fieldName)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_FIELD_MISSING:${fieldName}`);
  }
  return baseline[fieldName];
}

function requirePersonalBaselineString(baseline, fieldName) {
  const value = requirePersonalBaselineField(baseline, fieldName);
  if (typeof value !== 'string' || value.length <= 0) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_FIELD_INVALID:${fieldName}`);
  }
  return value;
}

function requirePersonalBaselineObject(baseline, fieldName) {
  const value = requirePersonalBaselineField(baseline, fieldName);
  if (!isObjectRecord(value)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_FIELD_INVALID:${fieldName}`);
  }
  return value;
}

function requireProjectionField(section, sectionName, fieldName) {
  if (!hasOwn(section, fieldName)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_${sectionName}_FIELD_MISSING:${fieldName}`);
  }
  return section[fieldName];
}

function requireProjectionString(section, sectionName, fieldName) {
  return requireExactString(
    requireProjectionField(section, sectionName, fieldName),
    `SITE_PULL_PERSONAL_BASELINE_${sectionName}_FIELD_INVALID:${fieldName}`,
  );
}

function requireProjectionNumber(section, sectionName, fieldName, options) {
  return requireExactNumber(
    requireProjectionField(section, sectionName, fieldName),
    `SITE_PULL_PERSONAL_BASELINE_${sectionName}_FIELD_INVALID:${fieldName}`,
    options,
  );
}

function toPublicPersonalBaselinePolicy(policy) {
  requireNoUnexpectedFields(policy, PUBLIC_POLICY_KEYS, 'SITE_PULL_PERSONAL_BASELINE_POLICY');
  const version = requireProjectionString(policy, 'POLICY', 'version');
  const observedBaselineRole = requireProjectionString(policy, 'POLICY', 'observedBaselineRole');
  const recentTrajectoryRole = requireProjectionString(policy, 'POLICY', 'recentTrajectoryRole');
  const adaptiveReferenceRole = requireProjectionString(policy, 'POLICY', 'adaptiveReferenceRole');
  const normativeAnchorRole = requireProjectionString(policy, 'POLICY', 'normativeAnchorRole');
  const targetDays = requireProjectionNumber(policy, 'POLICY', 'targetDays', { integer: true });
  const excludeCurrentDay = requireExactBoolean(
    requireProjectionField(policy, 'POLICY', 'excludeCurrentDay'),
    'SITE_PULL_PERSONAL_BASELINE_POLICY_FIELD_INVALID:excludeCurrentDay',
  );
  const observedBaselineIsGoal = requireExactBoolean(
    requireProjectionField(policy, 'POLICY', 'observedBaselineIsGoal'),
    'SITE_PULL_PERSONAL_BASELINE_POLICY_FIELD_INVALID:observedBaselineIsGoal',
  );
  const mutatesObservedBaseline = requireExactBoolean(
    requireProjectionField(policy, 'POLICY', 'mutatesObservedBaseline'),
    'SITE_PULL_PERSONAL_BASELINE_POLICY_FIELD_INVALID:mutatesObservedBaseline',
  );
  const duplicateProductionPolicy = requireProjectionString(
    policy,
    'POLICY',
    'duplicateProductionPolicy',
  );
  const projection = {
    version,
    observedBaselineRole,
    recentTrajectoryRole,
    adaptiveReferenceRole,
    normativeAnchorRole,
    targetDays,
    excludeCurrentDay,
    observedBaselineIsGoal,
    mutatesObservedBaseline,
    duplicateProductionPolicy,
  };
  const canonicalPolicy = buildSitePullPersonalBaselinePolicySummary();
  if (PUBLIC_POLICY_KEYS.some((fieldName) => (
    projection[fieldName] !== canonicalPolicy[fieldName]
  ))) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_POLICY_IDENTITY_INVALID');
  }
  return projection;
}

function toPublicRecentTrajectory(recentTrajectory, {
  currentObserved,
  todayMs,
  p75ReferenceMs,
  p90ReferenceMs,
  confidence,
} = {}) {
  requireNoUnexpectedFields(
    recentTrajectory,
    PUBLIC_RECENT_TRAJECTORY_KEYS,
    'SITE_PULL_PERSONAL_BASELINE_RECENT_TRAJECTORY',
  );
  const version = requireProjectionString(recentTrajectory, 'RECENT_TRAJECTORY', 'version');
  const role = requireProjectionString(recentTrajectory, 'RECENT_TRAJECTORY', 'role');
  const state = requireProjectionString(recentTrajectory, 'RECENT_TRAJECTORY', 'state');
  if (version !== SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION
    || role !== SITE_PULL_PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY
    || !Object.values(SITE_PULL_PERSONAL_TRAJECTORY_STATES).includes(state)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_RECENT_TRAJECTORY_IDENTITY_INVALID');
  }
  const sampleDays = requireProjectionNumber(
    recentTrajectory,
    'RECENT_TRAJECTORY',
    'sampleDays',
    { integer: true },
  );
  const comparisonDays = requireProjectionNumber(
    recentTrajectory,
    'RECENT_TRAJECTORY',
    'comparisonDays',
    { integer: true },
  );
  const recentDays = requireProjectionNumber(
    recentTrajectory,
    'RECENT_TRAJECTORY',
    'recentDays',
    { integer: true },
  );
  const momentumDays = requireProjectionNumber(
    recentTrajectory,
    'RECENT_TRAJECTORY',
    'momentumDays',
    { integer: true },
  );
  if (recentDays > Math.min(
    sampleDays,
    SITE_PULL_PERSONAL_BASELINE_POLICY.recentTrajectory.recentDays,
  ) || momentumDays > Math.min(
    recentDays,
    SITE_PULL_PERSONAL_BASELINE_POLICY.recentTrajectory.momentumDays,
  )) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_RECENT_TRAJECTORY_DAY_RELATION_INVALID');
  }
  const projection = {
    version,
    role,
    state,
    sampleDays,
    comparisonDays,
    recentDays,
    momentumDays,
    recentActiveDays: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'recentActiveDays',
      { integer: true },
    ),
    previousActiveDays: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'previousActiveDays',
      { integer: true },
    ),
    recentTotalMs: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'recentTotalMs',
    ),
    recentPreviousMaxMs: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'recentPreviousMaxMs',
    ),
    currentObserved: requireExactBoolean(
      requireProjectionField(recentTrajectory, 'RECENT_TRAJECTORY', 'currentObserved'),
      'SITE_PULL_PERSONAL_BASELINE_RECENT_TRAJECTORY_FIELD_INVALID:currentObserved',
    ),
    todayMs: requireProjectionNumber(recentTrajectory, 'RECENT_TRAJECTORY', 'todayMs'),
    todayShareOfRecent: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'todayShareOfRecent',
      { max: 1 },
    ),
    singleDaySpikeScore: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'singleDaySpikeScore',
      { max: 1 },
    ),
    recentAverageMs: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'recentAverageMs',
    ),
    momentumAverageMs: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'momentumAverageMs',
    ),
    priorAverageMs: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'priorAverageMs',
    ),
    recentMeanAbsoluteDeviationMs: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'recentMeanAbsoluteDeviationMs',
    ),
    referenceMs: requireProjectionNumber(recentTrajectory, 'RECENT_TRAJECTORY', 'referenceMs'),
    recentVsReferenceRatio: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'recentVsReferenceRatio',
    ),
    momentumVsReferenceRatio: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'momentumVsReferenceRatio',
    ),
    todayVsReferenceRatio: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'todayVsReferenceRatio',
    ),
    improvementScore: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'improvementScore',
      { max: 1 },
    ),
    risingScore: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'risingScore',
      { max: 1 },
    ),
    reboundScore: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'reboundScore',
      { max: 1 },
    ),
    volatilityScore: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'volatilityScore',
      { max: 1 },
    ),
    confidence: requireProjectionNumber(
      recentTrajectory,
      'RECENT_TRAJECTORY',
      'confidence',
      { max: 1 },
    ),
    mutatesObservedBaseline: requireExactBoolean(
      requireProjectionField(recentTrajectory, 'RECENT_TRAJECTORY', 'mutatesObservedBaseline'),
      'SITE_PULL_PERSONAL_BASELINE_RECENT_TRAJECTORY_FIELD_INVALID:mutatesObservedBaseline',
    ),
    caveats: requireExactStringArray(
      requireProjectionField(recentTrajectory, 'RECENT_TRAJECTORY', 'caveats'),
      'SITE_PULL_PERSONAL_BASELINE_RECENT_TRAJECTORY_FIELD_INVALID:caveats',
    ).slice(),
  };
  const canonicalProjection = deriveSitePullRecentTrajectoryProjection({
    sampleDays: projection.sampleDays,
    recentDays: projection.recentDays,
    momentumDays: projection.momentumDays,
    comparisonDays: projection.comparisonDays,
    recentActiveDays: projection.recentActiveDays,
    previousActiveDays: projection.previousActiveDays,
    recentTotalMs: projection.recentTotalMs,
    recentPreviousMaxMs: projection.recentPreviousMaxMs,
    recentAverageMs: projection.recentAverageMs,
    momentumAverageMs: projection.momentumAverageMs,
    priorAverageMs: projection.priorAverageMs,
    recentMeanAbsoluteDeviationMs: projection.recentMeanAbsoluteDeviationMs,
    currentObserved,
    todayMs,
    p75ReferenceMs,
    p90ReferenceMs,
    confidence,
  });
  if (!hasExactProjectionValues(
    projection,
    canonicalProjection,
    PUBLIC_RECENT_TRAJECTORY_KEYS,
  )) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_RECENT_TRAJECTORY_CANONICAL_RELATION_INVALID');
  }
  return projection;
}

function toPublicAdaptiveReference(adaptiveReference, {
  p75ReferenceMs,
  confidence: baselineConfidence,
  personalWeight,
  recentTrajectory,
} = {}) {
  requireNoUnexpectedFields(
    adaptiveReference,
    PUBLIC_ADAPTIVE_REFERENCE_KEYS,
    'SITE_PULL_PERSONAL_BASELINE_ADAPTIVE_REFERENCE',
  );
  const version = requireProjectionString(adaptiveReference, 'ADAPTIVE_REFERENCE', 'version');
  const role = requireProjectionString(adaptiveReference, 'ADAPTIVE_REFERENCE', 'role');
  const referenceMode = requireProjectionString(
    adaptiveReference,
    'ADAPTIVE_REFERENCE',
    'referenceMode',
  );
  const state = requireProjectionString(adaptiveReference, 'ADAPTIVE_REFERENCE', 'state');
  if (version !== SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION
    || role !== SITE_PULL_PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE
    || !Object.values(SITE_PULL_ADAPTIVE_REFERENCE_STATES).includes(state)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_ADAPTIVE_REFERENCE_IDENTITY_INVALID');
  }
  const observedReferenceMs = requireProjectionNumber(
    adaptiveReference,
    'ADAPTIVE_REFERENCE',
    'observedReferenceMs',
  );
  const referenceMs = requireProjectionNumber(adaptiveReference, 'ADAPTIVE_REFERENCE', 'referenceMs');
  const tighteningRatio = requireProjectionNumber(
    adaptiveReference,
    'ADAPTIVE_REFERENCE',
    'tighteningRatio',
    { max: 1 },
  );
  const maxTightenRatio = requireProjectionNumber(
    adaptiveReference,
    'ADAPTIVE_REFERENCE',
    'maxTightenRatio',
    { max: 1 },
  );
  const confidence = requireProjectionNumber(
    adaptiveReference,
    'ADAPTIVE_REFERENCE',
    'confidence',
    { max: 1 },
  );
  const mutatesObservedBaseline = requireExactBoolean(
    requireProjectionField(adaptiveReference, 'ADAPTIVE_REFERENCE', 'mutatesObservedBaseline'),
    'SITE_PULL_PERSONAL_BASELINE_ADAPTIVE_REFERENCE_FIELD_INVALID:mutatesObservedBaseline',
  );
  const projection = {
    version,
    role,
    referenceMode,
    state,
    observedReferenceMs,
    referenceMs,
    tighteningRatio,
    maxTightenRatio,
    confidence,
    mutatesObservedBaseline,
    caveats: requireExactStringArray(
      requireProjectionField(adaptiveReference, 'ADAPTIVE_REFERENCE', 'caveats'),
      'SITE_PULL_PERSONAL_BASELINE_ADAPTIVE_REFERENCE_FIELD_INVALID:caveats',
    ).slice(),
  };
  const canonicalProjection = deriveSitePullAdaptiveReferenceProjection({
    p75ReferenceMs,
    confidence: baselineConfidence,
    personalWeight,
    trajectoryState: recentTrajectory?.state,
    trajectoryImprovementScore: recentTrajectory?.improvementScore,
    trajectoryConfidence: recentTrajectory?.confidence,
  });
  if (!hasExactProjectionValues(
    projection,
    canonicalProjection,
    PUBLIC_ADAPTIVE_REFERENCE_KEYS,
  )) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_ADAPTIVE_REFERENCE_CANONICAL_RELATION_INVALID');
  }
  return projection;
}

function requireMetricSection(metric, metricId, sectionName) {
  const value = metric[sectionName];
  if (!isObjectRecord(value)) {
    throw new Error(`SITE_PULL_PERSONAL_BASELINE_METRIC_SECTION_MISSING:${metricId}:${sectionName}`);
  }
  return value;
}

function buildPublicPersonalBaselineMetricProjection(baseline, recentTrajectory) {
  const metric = (metricId) => getSitePullPersonalBaselineMetric(baseline, metricId);
  const activeMsMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS);
  const visitMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.VISIT_COUNT);
  const revisitCountMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT);
  const revisitRateMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_RATE);
  const switchInMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_IN_COUNT);
  const switchOutMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_OUT_COUNT);
  const switchBackMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_BACK_COUNT);
  const switchChurnMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT);
  const quickReturnRateMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.QUICK_RETURN_RATE);
  const sessionCountMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SESSION_COUNT);
  const shortSessionCountMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_COUNT);
  const shortSessionRateMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_RATE);
  const longSessionCountMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_COUNT);
  const longSessionRateMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_RATE);
  const maxSessionMetric = metric(SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS);
  const metricScores = resolveSitePullPersonalBaselineMetricScores(baseline);
  const activeSample = requireMetricSection(
    activeMsMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
    'sample',
  );
  const activeMetricStats = requireMetricSection(
    activeMsMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
    'stats',
  );
  const activeReference = requireMetricSection(
    activeMsMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
    'reference',
  );
  const activeAnomaly = requireMetricSection(
    activeMsMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
    'anomaly',
  );
  const visitMetricStats = requireMetricSection(
    visitMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.VISIT_COUNT,
    'stats',
  );
  const visitAnomaly = requireMetricSection(
    visitMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.VISIT_COUNT,
    'anomaly',
  );
  const revisitMetricStats = requireMetricSection(
    revisitCountMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT,
    'stats',
  );
  const revisitRateMetricStats = requireMetricSection(
    revisitRateMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_RATE,
    'stats',
  );
  const revisitAnomaly = requireMetricSection(
    revisitCountMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.REVISIT_COUNT,
    'anomaly',
  );
  const switchChurnMetricStats = requireMetricSection(
    switchChurnMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT,
    'stats',
  );
  const switchChurnAnomaly = requireMetricSection(
    switchChurnMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT,
    'anomaly',
  );
  const quickReturnRateMetricStats = requireMetricSection(
    quickReturnRateMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.QUICK_RETURN_RATE,
    'stats',
  );
  const shortSessionRateMetricStats = requireMetricSection(
    shortSessionRateMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SHORT_SESSION_RATE,
    'stats',
  );
  const longSessionRateMetricStats = requireMetricSection(
    longSessionRateMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.LONG_SESSION_RATE,
    'stats',
  );
  const maxSessionMetricStats = requireMetricSection(
    maxSessionMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS,
    'stats',
  );
  const maxSessionAnomaly = requireMetricSection(
    maxSessionMetric,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.MAX_SESSION_MS,
    'anomaly',
  );
  const observedDays = Math.floor(toNumber(activeSample.observedCount));
  const activeDays = Math.floor(toNumber(activeSample.positiveCount));
  const totalBaselineMs = toNumber(activeSample.valueTotal);
  const activeDayRate = observedDays > 0 ? activeDays / observedDays : 0;

  return {
    observedDays,
    activeDays,
    activeDayRate: Number(clamp01(activeDayRate).toFixed(3)),
    totalBaselineMs,
    medianDailyMs: toNumber(activeMetricStats.medianDailyMs),
    p75DailyMs: toNumber(activeMetricStats.p75DailyMs),
    p90DailyMs: toNumber(activeMetricStats.p90DailyMs),
    activeMedianMs: toNumber(activeMetricStats.activeMedianMs),
    activeP75Ms: toNumber(activeMetricStats.activeP75Ms),
    activeP90Ms: toNumber(activeMetricStats.activeP90Ms),
    p75ReferenceMs: toNumber(activeReference.p75ReferenceMs),
    p90ReferenceMs: toNumber(activeReference.p90ReferenceMs),
    madMs: toNumber(activeMetricStats.madMs),
    iqrMs: toNumber(activeMetricStats.iqrMs),
    robustSigmaMs: toNumber(activeMetricStats.robustSigmaMs),
    todayVsP75Ratio: Number(toNumber(activeAnomaly.ratio).toFixed(3)),
    robustZ: Number(toNumber(activeAnomaly.robustZ).toFixed(3)),
    timeAnomalyScore: Number(clamp01(metricScores.timeAnomalyScore).toFixed(4)),
    trendAnomalyScore: Number(clamp01(recentTrajectory.risingScore).toFixed(4)),
    todayVisits: Math.floor(toNumber(visitMetric.currentValue)),
    visitMedian: toNumber(visitMetricStats.median),
    visitP75: toNumber(visitMetricStats.p75Reference),
    visitP90: toNumber(visitMetricStats.p90Reference),
    todayVsVisitP75Ratio: Number(toNumber(visitAnomaly.ratio).toFixed(3)),
    visitAnomalyScore: Number(clamp01(metricScores.visitAnomalyScore).toFixed(4)),
    visitConfidence: Number(clamp01(metricScores.visitConfidence).toFixed(4)),
    todayRevisitWithin10m: Math.floor(toNumber(revisitCountMetric.currentValue)),
    todayRevisitRate: Number(clamp01(revisitRateMetric.currentValue).toFixed(4)),
    revisitMedian: toNumber(revisitMetricStats.median),
    revisitP75: toNumber(revisitMetricStats.p75Reference),
    revisitP90: toNumber(revisitMetricStats.p90Reference),
    revisitRateP75: toNumber(revisitRateMetricStats.p75Reference),
    todayVsRevisitP75Ratio: Number(toNumber(revisitAnomaly.ratio).toFixed(3)),
    revisitAnomalyScore: Number(clamp01(metricScores.revisitAnomalyScore).toFixed(4)),
    revisitConfidence: Number(clamp01(metricScores.revisitConfidence).toFixed(4)),
    todaySwitchIns: Math.floor(toNumber(switchInMetric.currentValue)),
    todaySwitchOuts: Math.floor(toNumber(switchOutMetric.currentValue)),
    todaySwitchChurn: Math.floor(toNumber(switchChurnMetric.currentValue)),
    switchChurnMedian: toNumber(switchChurnMetricStats.median),
    switchChurnP75: toNumber(switchChurnMetricStats.p75Reference),
    switchChurnP90: toNumber(switchChurnMetricStats.p90Reference),
    todayVsSwitchChurnP75Ratio: Number(toNumber(switchChurnAnomaly.ratio).toFixed(3)),
    switchChurnAnomalyScore: Number(clamp01(metricScores.switchChurnAnomalyScore).toFixed(4)),
    todaySwitchBackWithin10m: Math.floor(toNumber(switchBackMetric.currentValue)),
    todayQuickReturnRate: Number(clamp01(quickReturnRateMetric.currentValue).toFixed(4)),
    quickReturnRateP75: toNumber(quickReturnRateMetricStats.p75Reference),
    quickReturnAnomalyScore: Number(clamp01(metricScores.quickReturnAnomalyScore).toFixed(4)),
    loopConfidence: Number(clamp01(metricScores.loopConfidence).toFixed(4)),
    todaySessionCount: Math.floor(toNumber(sessionCountMetric.currentValue)),
    todayShortSessionCount: Math.floor(toNumber(shortSessionCountMetric.currentValue)),
    todayShortSessionRate: Number(clamp01(shortSessionRateMetric.currentValue).toFixed(4)),
    shortSessionRateP75: toNumber(shortSessionRateMetricStats.p75Reference),
    shortSessionAnomalyScore: Number(clamp01(metricScores.shortSessionAnomalyScore).toFixed(4)),
    todayLongSessionCount: Math.floor(toNumber(longSessionCountMetric.currentValue)),
    todayLongSessionRate: Number(clamp01(longSessionRateMetric.currentValue).toFixed(4)),
    longSessionRateP75: toNumber(longSessionRateMetricStats.p75Reference),
    todayMaxSessionMs: toNumber(maxSessionMetric.currentValue),
    maxSessionMedianMs: toNumber(maxSessionMetricStats.median),
    maxSessionP75Ms: toNumber(maxSessionMetricStats.p75Reference),
    maxSessionP90Ms: toNumber(maxSessionMetricStats.p90Reference),
    todayVsMaxSessionP75Ratio: Number(toNumber(maxSessionAnomaly.ratio).toFixed(3)),
    maxSessionRobustZ: Number(toNumber(maxSessionAnomaly.robustZ).toFixed(3)),
    sessionDepthAnomalyScore: Number(clamp01(metricScores.sessionDepthAnomalyScore).toFixed(4)),
    sessionConfidence: Number(clamp01(metricScores.sessionConfidence).toFixed(4)),
    recentAverageMs: toNumber(recentTrajectory.recentAverageMs),
    baselineAverageMs: toNumber(recentTrajectory.referenceMs),
    trendRatio: Number(toNumber(recentTrajectory.recentVsReferenceRatio).toFixed(3)),
  };
}

export function toPublicPersonalBaseline(baseline = null) {
  if (baseline === null || baseline === undefined) return null;
  if (!isObjectRecord(baseline)) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_INVALID');
  }
  const metrics = toPublicPersonalBaselineMetrics(baseline.metrics);
  requireExactFields(
    baseline,
    PUBLIC_PERSONAL_BASELINE_KEYS,
    'SITE_PULL_PERSONAL_BASELINE',
  );
  const version = requirePersonalBaselineString(baseline, 'version');
  const policyVersion = requirePersonalBaselineString(baseline, 'policyVersion');
  const status = requirePersonalBaselineString(baseline, 'status');
  const targetDays = requireExactNumber(
    requirePersonalBaselineField(baseline, 'targetDays'),
    'SITE_PULL_PERSONAL_BASELINE_FIELD_INVALID:targetDays',
    { integer: true },
  );
  const currentObserved = requirePersonalBaselineField(baseline, 'currentObserved');
  if (typeof currentObserved !== 'boolean') {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_FIELD_INVALID:currentObserved');
  }
  const confidence = requireExactNumber(
    requirePersonalBaselineField(baseline, 'confidence'),
    'SITE_PULL_PERSONAL_BASELINE_FIELD_INVALID:confidence',
    { max: 1 },
  );
  const personalWeight = requireExactNumber(
    requirePersonalBaselineField(baseline, 'personalWeight'),
    'SITE_PULL_PERSONAL_BASELINE_FIELD_INVALID:personalWeight',
    { max: SITE_PULL_PERSONAL_BASELINE_POLICY.personalWeight.cap },
  );
  const activeMsMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS];
  const expectedConfidence = Number(activeMsMetric.confidence.toFixed(4));
  const expectedPersonalWeight = Number(computeSitePullPersonalWeight(
    activeMsMetric.sample.observedCount,
    activeMsMetric.confidence,
  ).toFixed(4));
  if (version !== SITE_PULL_PERSONAL_BASELINE_VERSION
    || policyVersion !== SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION
    || status !== resolveSitePullPersonalBaselineStatus(activeMsMetric.confidence)
    || confidence !== expectedConfidence
    || personalWeight !== expectedPersonalWeight
    || currentObserved !== activeMsMetric.currentObserved
    || targetDays !== SITE_PULL_PERSONAL_BASELINE_POLICY.observedBaseline.targetDays) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_IDENTITY_INVALID');
  }
  const policy = toPublicPersonalBaselinePolicy(requirePersonalBaselineObject(baseline, 'policy'));
  const recentTrajectory = toPublicRecentTrajectory(
    requirePersonalBaselineObject(baseline, 'recentTrajectory'),
    {
      currentObserved: activeMsMetric.currentObserved,
      todayMs: activeMsMetric.currentEligible ? activeMsMetric.currentValue : 0,
      p75ReferenceMs: activeMsMetric.reference.p75ReferenceMs,
      p90ReferenceMs: activeMsMetric.reference.p90ReferenceMs,
      confidence,
    },
  );
  if (recentTrajectory.sampleDays !== activeMsMetric.sample.observedCount) {
    throw new Error('SITE_PULL_PERSONAL_BASELINE_RECENT_TRAJECTORY_SAMPLE_RELATION_INVALID');
  }
  const metricProjection = buildPublicPersonalBaselineMetricProjection(baseline, recentTrajectory);
  const adaptiveReference = toPublicAdaptiveReference(
    requirePersonalBaselineObject(baseline, 'adaptiveReference'),
    {
      p75ReferenceMs: metricProjection.p75ReferenceMs,
      confidence,
      personalWeight,
      recentTrajectory,
    },
  );
  return {
    version,
    policyVersion,
    policy,
    status,
    targetDays,
    currentObserved,
    ...metricProjection,
    confidence: Number(confidence.toFixed(4)),
    personalWeight: Number(personalWeight.toFixed(4)),
    metrics,
    recentTrajectory,
    adaptiveReference,
  };
}
