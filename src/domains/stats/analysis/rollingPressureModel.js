import { isHostnameInList } from '../../../lib/index.js';
import { PERSONAL_BASELINE_STATUSES } from '../../../lib/personalBaselineContract.js';
import {
  STATS_PERSONAL_BASELINE_METRIC_GRAINS,
  STATS_PERSONAL_BASELINE_ROLES,
} from '../baseline/index.js';
import { requireStatsDomainCollectionObservation } from '../contracts/statsContracts.js';

export const ROLLING_PRESSURE_BASIS = 'weighted-active-time';
export const ROLLING_PRESSURE_SCHEMA_VERSION = 1;
export const ROLLING_PRESSURE_RECENT_TRAJECTORY_VERSION = 'rolling-pressure-recent-trajectory-v2';
export const DEFAULT_ROLLING_PRESSURE_WINDOW_DAYS = 7;
export const DEFAULT_ROLLING_PRESSURE_WEIGHTS_BY_AGE = Object.freeze([
  1,
  0.9,
  0.8,
  0.7,
  0.6,
  0.5,
  0.4,
]);

const MINUTE_MS = 60_000;
const ROLLING_PRESSURE_TRAJECTORY_FORMING_DAYS = 3;
const ROLLING_PRESSURE_TRAJECTORY_SOURCE = 'stats_activity_day_period_projection';
const ROLLING_PRESSURE_TRAJECTORY_WINDOW_BASIS = 'completed_activity_days';

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const roundNumber = (value, digits = 4, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Number(numeric.toFixed(digits));
};

const normalizeDomain = (value) => (
  typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : ''
);

const normalizeDomainList = (value = []) => (
  Array.isArray(value)
    ? value.map(normalizeDomain).filter(Boolean)
    : []
);

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const isObjectRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function hasExactKeys(value, expectedKeys) {
  if (!isObjectRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function isCanonicalDateStr(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function requireFiniteNonNegative(value, code) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(code);
  }
  return value;
}

function normalizeHour(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const hour = Math.floor(numeric);
  return hour >= 0 && hour < 24 ? hour : null;
}

function createHourlyPressureEntry(hour) {
  return {
    hour,
    rawTotalMs: 0,
    weightedTotalMs: 0,
    rawProtectedMs: 0,
    weightedProtectedMs: 0,
  };
}

function createDomainHourlyEntry(hour) {
  return {
    hour,
    rawMs: 0,
    weightedMs: 0,
  };
}

function createDomainHourlyProfile() {
  return Array.from({ length: 24 }, (_, hour) => createDomainHourlyEntry(hour));
}

function normalizeWeightsByAge({
  weightsByAge = DEFAULT_ROLLING_PRESSURE_WEIGHTS_BY_AGE,
  windowDays = DEFAULT_ROLLING_PRESSURE_WINDOW_DAYS,
} = {}) {
  if (!Number.isInteger(windowDays) || windowDays <= 0) {
    throw new Error('ROLLING_PRESSURE_WINDOW_DAYS_INVALID');
  }
  if (!Array.isArray(weightsByAge) || weightsByAge.length < windowDays) {
    throw new Error('ROLLING_PRESSURE_WEIGHTS_INVALID');
  }
  return Array.from({ length: windowDays }, (_, ageDays) => {
    const weight = weightsByAge[ageDays];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
      throw new Error(`ROLLING_PRESSURE_WEIGHT_INVALID:${ageDays}`);
    }
    return weight;
  });
}

function readProjectionDomainFacts(projection = null) {
  if (!isObjectRecord(projection) || !Array.isArray(projection.domainTotals)) {
    throw new Error('ROLLING_PRESSURE_PROJECTION_DOMAIN_TOTALS_INVALID');
  }
  const activeMsByDomain = new Map();
  const observedByDomain = new Map();
  projection.domainTotals.forEach((entry, index) => {
    const domain = normalizeDomain(entry?.domain);
    if (!domain || entry.domain !== domain) {
      throw new Error(`ROLLING_PRESSURE_PROJECTION_DOMAIN_INVALID:${index}`);
    }
    if (observedByDomain.has(domain)) {
      throw new Error(`ROLLING_PRESSURE_PROJECTION_DOMAIN_DUPLICATED:${domain}`);
    }
    const activeMs = requireFiniteNonNegative(
      entry.activeMs,
      `ROLLING_PRESSURE_PROJECTION_DOMAIN_ACTIVE_INVALID:${domain}`,
    );
    const collectionObservation = requireStatsDomainCollectionObservation(
      entry.collectionObservation,
      { source: `rollingPressure.periodProjection.${domain}.collectionObservation` },
    );
    if (!collectionObservation.observed && activeMs > 0) {
      throw new Error(`ROLLING_PRESSURE_PROJECTION_DOMAIN_COLLECTION_RELATION_INVALID:${domain}`);
    }
    observedByDomain.set(domain, collectionObservation.observed);
    if (activeMs > 0) activeMsByDomain.set(domain, activeMs);
  });
  return { activeMsByDomain, observedByDomain };
}

function normalizePeriodProjectionEntries(periodProjections = []) {
  if (!Array.isArray(periodProjections)) {
    throw new Error('ROLLING_PRESSURE_PERIOD_PROJECTIONS_INVALID');
  }
  const seenAges = new Set();
  const seenDates = new Set();
  const normalized = periodProjections.map((entry, index) => {
    if (!hasExactKeys(entry, ['period', 'projection', 'evidence'])) {
      throw new Error(`ROLLING_PRESSURE_PERIOD_ENTRY_SHAPE_INVALID:${index}`);
    }
    const { period, projection, evidence } = entry;
    if (!hasExactKeys(period, ['basis', 'activityDateStr', 'ageDays', 'resetHour', 'current', 'range'])) {
      throw new Error(`ROLLING_PRESSURE_PERIOD_SHAPE_INVALID:${index}`);
    }
    if (period.basis !== 'activity-day') {
      throw new Error(`ROLLING_PRESSURE_PERIOD_BASIS_INVALID:${index}`);
    }
    if (!isCanonicalDateStr(period.activityDateStr)) {
      throw new Error(`ROLLING_PRESSURE_PERIOD_DATE_INVALID:${index}`);
    }
    if (!Number.isInteger(period.ageDays) || period.ageDays < 0) {
      throw new Error(`ROLLING_PRESSURE_PERIOD_AGE_INVALID:${index}`);
    }
    if (!Number.isInteger(period.resetHour) || period.resetHour < 0 || period.resetHour > 23) {
      throw new Error(`ROLLING_PRESSURE_PERIOD_RESET_HOUR_INVALID:${index}`);
    }
    if (typeof period.current !== 'boolean' || period.current !== (period.ageDays === 0)) {
      throw new Error(`ROLLING_PRESSURE_PERIOD_CURRENT_INVALID:${index}`);
    }
    const expectedEndDate = new Date(`${period.activityDateStr}T00:00:00.000Z`);
    if (period.resetHour !== 0) expectedEndDate.setUTCDate(expectedEndDate.getUTCDate() + 1);
    const expectedEndDateStr = expectedEndDate.toISOString().slice(0, 10);
    if (!isObjectRecord(period.range)
      || period.range.basis !== period.basis
      || period.range.activityDateStr !== period.activityDateStr
      || period.range.resetHour !== period.resetHour
      || period.range.startDateStr !== period.activityDateStr
      || period.range.endDateStr !== expectedEndDateStr
      || !isCanonicalDateStr(period.range.startDateStr)
      || !isCanonicalDateStr(period.range.endDateStr)
      || period.range.endDateStr < period.range.startDateStr) {
      throw new Error(`ROLLING_PRESSURE_PERIOD_RANGE_INVALID:${index}`);
    }
    if (!isObjectRecord(projection)
      || !Array.isArray(projection.domainTotals)
      || !Array.isArray(projection.hourlyBuckets)) {
      throw new Error(`ROLLING_PRESSURE_PERIOD_PROJECTION_INVALID:${index}`);
    }
    if (!hasExactKeys(evidence, ['observed']) || typeof evidence.observed !== 'boolean') {
      throw new Error(`ROLLING_PRESSURE_PERIOD_EVIDENCE_INVALID:${index}`);
    }
    if (seenAges.has(period.ageDays)) {
      throw new Error(`ROLLING_PRESSURE_PERIOD_AGE_DUPLICATED:${period.ageDays}`);
    }
    if (seenDates.has(period.activityDateStr)) {
      throw new Error(`ROLLING_PRESSURE_PERIOD_DATE_DUPLICATED:${period.activityDateStr}`);
    }
    seenAges.add(period.ageDays);
    seenDates.add(period.activityDateStr);
    const domainFacts = readProjectionDomainFacts(projection);
    if (
      !period.current
      && !evidence.observed
      && Array.from(domainFacts.observedByDomain.values()).some(Boolean)
    ) {
      throw new Error(`ROLLING_PRESSURE_PERIOD_COLLECTION_RELATION_INVALID:${index}`);
    }
    return {
      period,
      projection,
      domainMap: domainFacts.activeMsByDomain,
      domainObservationMap: domainFacts.observedByDomain,
      evidence,
    };
  });
  if (normalized.length > 0) {
    const currentPeriods = normalized.filter((entry) => entry.period.current);
    if (currentPeriods.length !== 1) {
      throw new Error('ROLLING_PRESSURE_CURRENT_PERIOD_CARDINALITY_INVALID');
    }
    const currentEpoch = Date.parse(`${currentPeriods[0].period.activityDateStr}T00:00:00.000Z`);
    normalized.forEach((entry, index) => {
      const entryEpoch = Date.parse(`${entry.period.activityDateStr}T00:00:00.000Z`);
      const ageDays = (currentEpoch - entryEpoch) / 86_400_000;
      if (ageDays !== entry.period.ageDays) {
        throw new Error(`ROLLING_PRESSURE_PERIOD_DATE_AGE_RELATION_INVALID:${index}`);
      }
    });
  }
  return normalized;
}

function resolveRecentTrajectoryStatus(observedDays, targetDays) {
  if (observedDays >= targetDays) return PERSONAL_BASELINE_STATUSES.STABLE;
  if (observedDays >= Math.min(ROLLING_PRESSURE_TRAJECTORY_FORMING_DAYS, targetDays)) {
    return PERSONAL_BASELINE_STATUSES.FORMING;
  }
  return PERSONAL_BASELINE_STATUSES.SPARSE;
}

function numbersEqual(left, right) {
  if (left === right) return true;
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= Number.EPSILON * scale * 16;
}

function requireNullableDate(value, code) {
  if (value !== null && !isCanonicalDateStr(value)) throw new Error(code);
  return value;
}

function requireNullableNonNegative(value, code) {
  if (value === null) return null;
  return requireFiniteNonNegative(value, code);
}

function shiftCanonicalDate(activityDateStr, dayOffset) {
  const date = new Date(`${activityDateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function deriveRecentTrajectory({
  observations,
  current,
  targetDays,
}) {
  const observed = observations.filter((entry) => entry.observed);
  const observedDays = observed.length;
  const weightSum = observed.reduce((sum, entry) => sum + entry.weight, 0);
  const weightedDailyAverageMs = weightSum > 0
    ? observed.reduce((sum, entry) => sum + (entry.activeMs * entry.weight), 0) / weightSum
    : null;
  const weightedMeanAbsoluteDeviationMs = weightedDailyAverageMs === null
    ? null
    : observed.reduce(
        (sum, entry) => sum + (Math.abs(entry.activeMs - weightedDailyAverageMs) * entry.weight),
        0,
      ) / weightSum;
  const weightedRelativeDispersion = weightedDailyAverageMs === null
    ? null
    : weightedDailyAverageMs === 0
      ? 0
      : Math.min(weightedMeanAbsoluteDeviationMs / weightedDailyAverageMs, 1.5);
  const referenceState = weightedDailyAverageMs === null
    ? 'missing'
    : weightedDailyAverageMs === 0
      ? 'zero'
      : 'positive';

  let comparisonState = 'current_missing';
  let deltaMs = null;
  let trendRatio = null;
  if (current.observed) {
    comparisonState = referenceState === 'missing'
      ? 'reference_missing'
      : referenceState === 'zero'
        ? (current.activeMs === 0 ? 'both_zero' : 'from_zero')
        : 'comparable';
    deltaMs = weightedDailyAverageMs === null
      ? null
      : current.activeMs - weightedDailyAverageMs;
    trendRatio = referenceState === 'positive'
      ? current.activeMs / weightedDailyAverageMs
      : comparisonState === 'both_zero'
        ? 1
        : null;
  }

  return {
    window: {
      observedDays,
      startActivityDateStr: observations.at(-1)?.activityDateStr || null,
      endActivityDateStr: observations[0]?.activityDateStr || null,
    },
    evidence: {
      status: resolveRecentTrajectoryStatus(observedDays, targetDays),
      missingDays: targetDays - observedDays,
      zeroDays: observed.filter((entry) => entry.activeMs === 0).length,
      positiveDays: observed.filter((entry) => entry.activeMs > 0).length,
      weightSum,
    },
    reference: {
      state: referenceState,
      weightedDailyAverageMs,
      weightedMeanAbsoluteDeviationMs,
      weightedRelativeDispersion,
    },
    comparison: {
      state: comparisonState,
      deltaMs,
      trendRatio,
    },
  };
}

function nullableNumbersEqual(left, right) {
  if (left === null || right === null) return left === right;
  return numbersEqual(left, right);
}

export function requireRollingPressureRecentTrajectory(value) {
  if (!hasExactKeys(value, [
    'version',
    'role',
    'grain',
    'provenance',
    'window',
    'excludeCurrent',
    'observations',
    'evidence',
    'current',
    'reference',
    'comparison',
  ])) throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_SHAPE_INVALID');
  if (value.version !== ROLLING_PRESSURE_RECENT_TRAJECTORY_VERSION
    || value.role !== STATS_PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY
    || value.grain !== STATS_PERSONAL_BASELINE_METRIC_GRAINS.DAY
    || value.excludeCurrent !== true) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_IDENTITY_INVALID');
  }
  if (!hasExactKeys(value.provenance, ['source', 'windowBasis', 'weighting', 'excludeCurrent'])
    || value.provenance.source !== ROLLING_PRESSURE_TRAJECTORY_SOURCE
    || value.provenance.windowBasis !== ROLLING_PRESSURE_TRAJECTORY_WINDOW_BASIS
    || value.provenance.weighting !== 'completed_period_recency'
    || value.provenance.excludeCurrent !== true) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_PROVENANCE_INVALID');
  }
  if (!hasExactKeys(value.window, [
    'kind',
    'targetDays',
    'observedDays',
    'startActivityDateStr',
    'endActivityDateStr',
  ])
    || value.window.kind !== 'weighted_completed_activity_days'
    || !Number.isInteger(value.window.targetDays)
    || value.window.targetDays <= 0
    || !Number.isInteger(value.window.observedDays)
    || value.window.observedDays < 0
    || value.window.observedDays > value.window.targetDays) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_WINDOW_INVALID');
  }
  requireNullableDate(
    value.window.startActivityDateStr,
    'ROLLING_PRESSURE_RECENT_TRAJECTORY_WINDOW_START_INVALID',
  );
  requireNullableDate(
    value.window.endActivityDateStr,
    'ROLLING_PRESSURE_RECENT_TRAJECTORY_WINDOW_END_INVALID',
  );
  if (!hasExactKeys(value.current, ['activityDateStr', 'observed', 'activeMs'])) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_CURRENT_SHAPE_INVALID');
  }
  requireNullableDate(
    value.current.activityDateStr,
    'ROLLING_PRESSURE_RECENT_TRAJECTORY_CURRENT_DATE_INVALID',
  );
  if (typeof value.current.observed !== 'boolean') {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_CURRENT_RELATION_INVALID');
  }
  if (value.current.observed) {
    if (value.current.activityDateStr === null) {
      throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_CURRENT_RELATION_INVALID');
    }
    requireFiniteNonNegative(
      value.current.activeMs,
      'ROLLING_PRESSURE_RECENT_TRAJECTORY_CURRENT_ACTIVE_INVALID',
    );
  } else if (value.current.activeMs !== null) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_CURRENT_RELATION_INVALID');
  }
  if (!Array.isArray(value.observations)) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_OBSERVATIONS_INVALID');
  }
  if (value.current?.activityDateStr === null) {
    if (value.observations.length !== 0) {
      throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_OBSERVATION_COUNT_INVALID');
    }
  } else if (value.observations.length !== value.window.targetDays) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_OBSERVATION_COUNT_INVALID');
  }
  value.observations.forEach((entry, index) => {
    if (!hasExactKeys(entry, ['activityDateStr', 'ageDays', 'observed', 'activeMs', 'weight'])) {
      throw new Error(`ROLLING_PRESSURE_RECENT_TRAJECTORY_OBSERVATION_SHAPE_INVALID:${index}`);
    }
    if (!isCanonicalDateStr(entry.activityDateStr)
      || !Number.isInteger(entry.ageDays)
      || entry.ageDays !== index + 1
      || entry.activityDateStr !== shiftCanonicalDate(value.current.activityDateStr, -entry.ageDays)) {
      throw new Error(`ROLLING_PRESSURE_RECENT_TRAJECTORY_OBSERVATION_IDENTITY_INVALID:${index}`);
    }
    if (typeof entry.observed !== 'boolean') {
      throw new Error(`ROLLING_PRESSURE_RECENT_TRAJECTORY_OBSERVATION_EVIDENCE_INVALID:${index}`);
    }
    if (typeof entry.weight !== 'number' || !Number.isFinite(entry.weight) || entry.weight <= 0) {
      throw new Error(`ROLLING_PRESSURE_RECENT_TRAJECTORY_OBSERVATION_WEIGHT_INVALID:${index}`);
    }
    if (entry.observed) {
      requireFiniteNonNegative(
        entry.activeMs,
        `ROLLING_PRESSURE_RECENT_TRAJECTORY_OBSERVATION_ACTIVE_INVALID:${index}`,
      );
    } else if (entry.activeMs !== null) {
      throw new Error(`ROLLING_PRESSURE_RECENT_TRAJECTORY_OBSERVATION_ACTIVE_RELATION_INVALID:${index}`);
    }
  });
  if (!hasExactKeys(value.evidence, [
    'status',
    'missingDays',
    'zeroDays',
    'positiveDays',
    'weightSum',
  ])) throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_EVIDENCE_SHAPE_INVALID');
  const countFields = ['missingDays', 'zeroDays', 'positiveDays'];
  if (countFields.some((field) => !Number.isInteger(value.evidence[field]) || value.evidence[field] < 0)) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_EVIDENCE_RELATION_INVALID');
  }
  requireFiniteNonNegative(
    value.evidence.weightSum,
    'ROLLING_PRESSURE_RECENT_TRAJECTORY_WEIGHT_SUM_INVALID',
  );
  if (!hasExactKeys(value.reference, [
    'state',
    'weightedDailyAverageMs',
    'weightedMeanAbsoluteDeviationMs',
    'weightedRelativeDispersion',
  ])) throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_REFERENCE_SHAPE_INVALID');
  const averageMs = requireNullableNonNegative(
    value.reference.weightedDailyAverageMs,
    'ROLLING_PRESSURE_RECENT_TRAJECTORY_REFERENCE_AVERAGE_INVALID',
  );
  const deviationMs = requireNullableNonNegative(
    value.reference.weightedMeanAbsoluteDeviationMs,
    'ROLLING_PRESSURE_RECENT_TRAJECTORY_REFERENCE_DEVIATION_INVALID',
  );
  const dispersion = requireNullableNonNegative(
    value.reference.weightedRelativeDispersion,
    'ROLLING_PRESSURE_RECENT_TRAJECTORY_REFERENCE_DISPERSION_INVALID',
  );
  if ((averageMs === null) !== (deviationMs === null)
    || (averageMs === null) !== (dispersion === null)) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_REFERENCE_RELATION_INVALID');
  }
  if (!hasExactKeys(value.comparison, ['state', 'deltaMs', 'trendRatio'])) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_COMPARISON_SHAPE_INVALID');
  }
  if (value.comparison.deltaMs !== null
    && (typeof value.comparison.deltaMs !== 'number' || !Number.isFinite(value.comparison.deltaMs))) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_COMPARISON_DELTA_INVALID');
  }
  if (value.comparison.trendRatio !== null
    && (typeof value.comparison.trendRatio !== 'number'
      || !Number.isFinite(value.comparison.trendRatio)
      || value.comparison.trendRatio < 0)) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_COMPARISON_RATIO_INVALID');
  }
  const derived = deriveRecentTrajectory({
    observations: value.observations,
    current: value.current,
    targetDays: value.window.targetDays,
  });
  if (value.window.observedDays !== derived.window.observedDays
    || value.window.startActivityDateStr !== derived.window.startActivityDateStr
    || value.window.endActivityDateStr !== derived.window.endActivityDateStr) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_WINDOW_RELATION_INVALID');
  }
  if (value.evidence.status !== derived.evidence.status
    || value.evidence.missingDays !== derived.evidence.missingDays
    || value.evidence.zeroDays !== derived.evidence.zeroDays
    || value.evidence.positiveDays !== derived.evidence.positiveDays
    || !numbersEqual(value.evidence.weightSum, derived.evidence.weightSum)) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_EVIDENCE_RELATION_INVALID');
  }
  if (value.reference.state !== derived.reference.state
    || !nullableNumbersEqual(
      value.reference.weightedDailyAverageMs,
      derived.reference.weightedDailyAverageMs,
    )
    || !nullableNumbersEqual(
      value.reference.weightedMeanAbsoluteDeviationMs,
      derived.reference.weightedMeanAbsoluteDeviationMs,
    )
    || !nullableNumbersEqual(
      value.reference.weightedRelativeDispersion,
      derived.reference.weightedRelativeDispersion,
    )) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_REFERENCE_RELATION_INVALID');
  }
  if (value.comparison.state !== derived.comparison.state
    || !nullableNumbersEqual(value.comparison.deltaMs, derived.comparison.deltaMs)
    || !nullableNumbersEqual(value.comparison.trendRatio, derived.comparison.trendRatio)) {
    throw new Error('ROLLING_PRESSURE_RECENT_TRAJECTORY_COMPARISON_RELATION_INVALID');
  }
  return value;
}

function buildDomainRecentTrajectory({
  domain,
  periods = [],
  currentPeriod = null,
  windowDays = DEFAULT_ROLLING_PRESSURE_WINDOW_DAYS,
  completedWeightsByRecency = DEFAULT_ROLLING_PRESSURE_WEIGHTS_BY_AGE,
} = {}) {
  const completedPeriodsByAge = new Map(
    periods
      .filter((entry) => entry?.period?.current !== true)
      .map((entry) => [entry.period.ageDays, entry]),
  );
  const completedPeriods = currentPeriod
    ? Array.from({ length: windowDays }, (_, index) => {
        const ageDays = index + 1;
        const entry = completedPeriodsByAge.get(ageDays);
        if (!entry) {
          throw new Error(`ROLLING_PRESSURE_TRAJECTORY_COMPLETED_PERIOD_MISSING:${ageDays}`);
        }
        return entry;
      })
    : [];
  const observations = completedPeriods.map((entry) => {
    const observed = entry.evidence.observed === true
      && entry.domainObservationMap.get(domain) === true;
    const activeMs = observed
      ? Math.max(0, toNumber(entry.domainMap.get(domain)))
      : null;
    const completedRecencyIndex = Math.max(0, entry.period.ageDays - 1);
    const weight = Math.max(0, toNumber(completedWeightsByRecency[completedRecencyIndex]));
    return {
      activityDateStr: entry.period.activityDateStr,
      ageDays: entry.period.ageDays,
      observed,
      activeMs,
      weight,
    };
  });
  const current = currentPeriod?.period?.activityDateStr
    ? {
        activityDateStr: currentPeriod.period.activityDateStr,
        observed: currentPeriod.domainObservationMap.get(domain) === true,
        activeMs: currentPeriod.domainObservationMap.get(domain) === true
          ? Math.max(0, toNumber(currentPeriod.domainMap.get(domain)))
          : null,
      }
    : {
        activityDateStr: null,
        observed: false,
        activeMs: null,
      };
  const derived = deriveRecentTrajectory({
    observations,
    current,
    targetDays: windowDays,
  });

  return requireRollingPressureRecentTrajectory({
    version: ROLLING_PRESSURE_RECENT_TRAJECTORY_VERSION,
    role: STATS_PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY,
    grain: STATS_PERSONAL_BASELINE_METRIC_GRAINS.DAY,
    provenance: {
      source: ROLLING_PRESSURE_TRAJECTORY_SOURCE,
      windowBasis: ROLLING_PRESSURE_TRAJECTORY_WINDOW_BASIS,
      weighting: 'completed_period_recency',
      excludeCurrent: true,
    },
    window: {
      kind: 'weighted_completed_activity_days',
      targetDays: windowDays,
      ...derived.window,
    },
    excludeCurrent: true,
    observations,
    evidence: derived.evidence,
    current,
    reference: derived.reference,
    comparison: derived.comparison,
  });
}

function buildHourlyPressureProfile({
  periods = [],
  weights = [],
  domainSet = new Set(),
  trackingExcludedUrls = [],
} = {}) {
  const hours = Array.from({ length: 24 }, (_, hour) => createHourlyPressureEntry(hour));
  const domainProfiles = new Map(
    Array.from(domainSet)
      .filter(Boolean)
      .map((domain) => [domain, createDomainHourlyProfile()]),
  );

  periods.forEach((entry) => {
    const ageDays = entry?.period?.ageDays;
    const weight = weights[ageDays] ?? 0;
    const buckets = Array.isArray(entry?.projection?.hourlyBuckets) ? entry.projection.hourlyBuckets : [];
    buckets.forEach((bucket, bucketIndex) => {
      const hour = normalizeHour(bucket?.hour);
      if (hour === null) {
        throw new Error(`ROLLING_PRESSURE_HOURLY_BUCKET_HOUR_INVALID:${ageDays}:${bucketIndex}`);
      }
      const totalActiveMs = requireFiniteNonNegative(
        bucket.activeMs,
        `ROLLING_PRESSURE_HOURLY_BUCKET_ACTIVE_INVALID:${ageDays}:${hour}`,
      );
      const protectedActiveMs = requireFiniteNonNegative(
        bucket?.byCategory?.blocked?.activeMs,
        `ROLLING_PRESSURE_HOURLY_BUCKET_PROTECTED_INVALID:${ageDays}:${hour}`,
      );
      hours[hour].rawTotalMs += totalActiveMs;
      hours[hour].weightedTotalMs += totalActiveMs * weight;
      hours[hour].rawProtectedMs += protectedActiveMs;
      hours[hour].weightedProtectedMs += protectedActiveMs * weight;

      if (!Array.isArray(bucket.domains)) {
        throw new Error(`ROLLING_PRESSURE_HOURLY_BUCKET_DOMAINS_INVALID:${ageDays}:${hour}`);
      }
      bucket.domains.forEach((domainEntry, domainIndex) => {
        const domain = normalizeDomain(domainEntry?.domain);
        if (!domain || domainEntry.domain !== domain) {
          throw new Error(`ROLLING_PRESSURE_HOURLY_DOMAIN_INVALID:${ageDays}:${hour}:${domainIndex}`);
        }
        if (!domainSet.has(domain) || isHostnameInList(domain, trackingExcludedUrls)) return;
        const activeMs = requireFiniteNonNegative(
          domainEntry.activeMs,
          `ROLLING_PRESSURE_HOURLY_DOMAIN_ACTIVE_INVALID:${ageDays}:${hour}:${domain}`,
        );
        const profile = domainProfiles.get(domain);
        if (!profile) return;
        profile[hour].rawMs += activeMs;
        profile[hour].weightedMs += activeMs * weight;
      });
    });
  });

  return {
    hours: hours.map((entry) => ({
      ...entry,
      rawTotalMinutes: roundNumber(entry.rawTotalMs / MINUTE_MS, 2, 0),
      weightedTotalMinutes: roundNumber(entry.weightedTotalMs / MINUTE_MS, 2, 0),
      rawProtectedMinutes: roundNumber(entry.rawProtectedMs / MINUTE_MS, 2, 0),
      weightedProtectedMinutes: roundNumber(entry.weightedProtectedMs / MINUTE_MS, 2, 0),
    })),
    domainProfiles,
  };
}

export function buildRollingPressureReadModel({
  periodProjections = [],
  blockedUrls = [],
  allowedUrls = [],
  siteGoals = {},
  trackingExcludedUrls = [],
  windowDays = DEFAULT_ROLLING_PRESSURE_WINDOW_DAYS,
  weightsByAge = DEFAULT_ROLLING_PRESSURE_WEIGHTS_BY_AGE,
} = {}) {
  const resolvedWindowDays = Math.max(1, Math.floor(toNumber(windowDays) || DEFAULT_ROLLING_PRESSURE_WINDOW_DAYS));
  const normalizedPeriods = normalizePeriodProjectionEntries(periodProjections);
  const periods = normalizedPeriods
    .filter((entry) => entry.period.current || entry.period.ageDays < resolvedWindowDays)
    .sort((left, right) => right.period.ageDays - left.period.ageDays)
    .slice(-resolvedWindowDays);
  const weights = normalizeWeightsByAge({ weightsByAge, windowDays: resolvedWindowDays });
  const blockedSet = new Set(normalizeDomainList(blockedUrls));
  const allowedSet = new Set(normalizeDomainList(allowedUrls));
  const normalizedTrackingExcludedUrls = normalizeDomainList(trackingExcludedUrls);
  const normalizedSiteGoals = Object.fromEntries(
    Object.entries(siteGoals || {})
      .map(([domain, minutes]) => [normalizeDomain(domain), Math.max(0, Math.floor(toNumber(minutes)))])
      .filter(([domain]) => Boolean(domain)),
  );
  const currentPeriods = normalizedPeriods.filter((entry) => entry.period.current);
  if (currentPeriods.length > 1) {
    throw new Error('ROLLING_PRESSURE_CURRENT_PERIOD_DUPLICATED');
  }
  const currentPeriod = currentPeriods[0] || null;
  const todayMap = currentPeriod?.domainMap || new Map();
  const domainSet = new Set([
    ...normalizedPeriods.flatMap((entry) => Array.from(entry.domainMap.keys())),
    ...normalizedPeriods.flatMap((entry) => Array.from(entry.domainObservationMap.keys())),
    ...Array.from(blockedSet),
    ...Array.from(allowedSet),
    ...Object.keys(normalizedSiteGoals),
  ]);
  const hourlyPressureProfile = buildHourlyPressureProfile({
    periods,
    weights,
    domainSet,
    trackingExcludedUrls: normalizedTrackingExcludedUrls,
  });
  const periodWeights = periods.map((entry) => {
    const ageDays = entry.period.ageDays;
    return {
      basis: entry.period.basis,
      activityDateStr: entry.period.activityDateStr,
      ageDays,
      weight: weights[ageDays] ?? 0,
      resetHour: entry.period.resetHour,
      current: entry.period.current === true,
      range: entry.period.range,
    };
  });

  const domains = Array.from(domainSet)
    .filter((domain) => domain && !isHostnameInList(domain, normalizedTrackingExcludedUrls))
    .map((domain) => {
      const periodSeries = periods.map((entry) => {
        const ageDays = entry.period.ageDays;
        const weight = weights[ageDays] ?? 0;
        const activeMs = Math.max(0, toNumber(entry.domainMap.get(domain)));
        return {
          basis: entry.period.basis,
          activityDateStr: entry.period.activityDateStr,
          ageDays,
          weight,
          activeMs,
          weightedMs: activeMs * weight,
          resetHour: entry.period.resetHour,
          current: entry.period.current === true,
          range: entry.period.range,
        };
      });
      const rawWindowMs = periodSeries.reduce((sum, entry) => sum + entry.activeMs, 0);
      const weightedPressureMs = periodSeries.reduce((sum, entry) => sum + entry.weightedMs, 0);
      const activeDays = periodSeries.filter((entry) => entry.activeMs > 0).length;
      const todayActiveMs = Math.max(0, toNumber(todayMap.get(domain)));
      const blocked = blockedSet.has(domain);
      const managed = blocked || allowedSet.has(domain) || hasOwn(normalizedSiteGoals, domain);
      const recentTrajectory = buildDomainRecentTrajectory({
        domain,
        periods: normalizedPeriods,
        currentPeriod,
        windowDays: resolvedWindowDays,
        completedWeightsByRecency: weights,
      });
      return {
        domain,
        basis: ROLLING_PRESSURE_BASIS,
        windowDays: resolvedWindowDays,
        rawWindowMs,
        weightedPressureMs,
        pressureMinutes: roundNumber(weightedPressureMs / MINUTE_MS, 2, 0),
        todayActiveMs,
        activeDays,
        recentTrajectory,
        periodSeries,
        hourlyProfile: (hourlyPressureProfile.domainProfiles.get(domain) || createDomainHourlyProfile())
          .map((hourEntry) => ({
            ...hourEntry,
            rawMinutes: roundNumber(hourEntry.rawMs / MINUTE_MS, 2, 0),
            weightedMinutes: roundNumber(hourEntry.weightedMs / MINUTE_MS, 2, 0),
          })),
        policyStatus: blocked ? 'blocked' : 'allowed',
        blocked,
        managed,
        goalMinutes: Math.max(0, Math.floor(toNumber(normalizedSiteGoals?.[domain]))),
      };
    })
    .filter((entry) => (
      entry.rawWindowMs > 0
      || entry.weightedPressureMs > 0
      || entry.recentTrajectory.evidence.positiveDays > 0
      || entry.managed
    ))
    .sort((left, right) => {
      const pressureDiff = right.weightedPressureMs - left.weightedPressureMs;
      if (pressureDiff !== 0) return pressureDiff;
      const rawDiff = right.rawWindowMs - left.rawWindowMs;
      if (rawDiff !== 0) return rawDiff;
      const todayDiff = right.todayActiveMs - left.todayActiveMs;
      if (todayDiff !== 0) return todayDiff;
      if (right.managed !== left.managed) return Number(right.managed) - Number(left.managed);
      return left.domain.localeCompare(right.domain);
    });
  const totalPressureMs = domains.reduce((sum, entry) => sum + entry.weightedPressureMs, 0);
  const totalRawWindowMs = domains.reduce((sum, entry) => sum + entry.rawWindowMs, 0);
  const temporalBasis = currentPeriod?.period?.basis || periods[0]?.period?.basis || null;
  const temporalResetHour = currentPeriod?.period?.resetHour ?? periods[0]?.period?.resetHour ?? null;
  const completedEvidencePeriods = normalizedPeriods.filter((entry) => (
    entry.period.current !== true && entry.period.ageDays <= resolvedWindowDays
  ));
  const observedCompletedPeriods = completedEvidencePeriods.filter((entry) => entry.evidence.observed === true);
  const completedPositiveDays = observedCompletedPeriods.filter((entry) => (
    Array.from(entry.domainMap.values()).some((activeMs) => Math.max(0, toNumber(activeMs)) > 0)
  )).length;
  const currentObserved = currentPeriod?.evidence?.observed === true;
  const currentPositive = currentObserved && Array.from(currentPeriod.domainMap.values())
    .some((activeMs) => Math.max(0, toNumber(activeMs)) > 0);

  return {
    schemaVersion: ROLLING_PRESSURE_SCHEMA_VERSION,
    role: STATS_PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY,
    basis: ROLLING_PRESSURE_BASIS,
    windowDays: resolvedWindowDays,
    temporal: {
      basis: temporalBasis,
      resetHour: temporalResetHour,
      windowKind: 'rolling_activity_days',
      currentActivityDateStr: currentPeriod?.period?.activityDateStr || null,
      periodCount: periods.length,
    },
    evidence: {
      completedTargetDays: resolvedWindowDays,
      formingTargetDays: Math.min(ROLLING_PRESSURE_TRAJECTORY_FORMING_DAYS, resolvedWindowDays),
      completedObservedDays: observedCompletedPeriods.length,
      completedPositiveDays,
      currentObserved,
      currentPositive,
    },
    weightsByAge: weights,
    periodWeights,
    totalPressureMs,
    totalRawWindowMs,
    hourlyProfile: {
      basis: ROLLING_PRESSURE_BASIS,
      windowDays: resolvedWindowDays,
      hours: hourlyPressureProfile.hours,
    },
    domains: domains.map((entry, index) => ({
      ...entry,
      pressureShare: totalPressureMs > 0 ? entry.weightedPressureMs / totalPressureMs : 0,
      pressureRank: index + 1,
    })),
  };
}

export default buildRollingPressureReadModel;
