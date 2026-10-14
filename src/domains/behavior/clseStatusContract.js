import { CLSE_CONSTANTS } from './clseSchema.js';
import { requireCanonicalCLSEBaselineSummary } from './clseBaselineReadContract.js';
import {
  PERSONAL_BASELINE_REFERENCE_MODES,
  PERSONAL_BASELINE_STATUSES,
} from '../../lib/personalBaselineContract.js';
import {
  CLSE_BASELINE_GRAINS,
} from '../../platform/storage/clse/clseBaselineStorageContract.js';

const RETIRED_BASELINE_STATUS_FIELDS = Object.freeze([
  'baselineCalibrationDays',
  'baselineCalibrated',
  'calibrationProgress',
  'baselineStatus',
  'calibration_days',
  'baseline_calibrated',
  'calibration_progress',
  'baseline_status',
  'feature_stats',
  'thresholds',
  'cooldowns',
]);
const CLSE_CONTROL_FIELDS = Object.freeze([
  'isEnabled',
  'sensitivityScale',
  'alertCooldownMs',
]);
const CLSE_STATUS_FIELDS = Object.freeze([
  'isInitialized',
  'isEnabled',
  'bucketCount',
  'sustainedLoadState',
  'loopStats',
  'sensitivityScale',
  'alertCooldownMs',
  'alert',
  'baseline',
]);
const CLSE_SUSTAINED_LOAD_STATE_FIELDS = Object.freeze([
  'inSustainedLoad',
  'elevatedWindowCount',
  'startedAt',
  'currentSeverity',
  'referenceMode',
  'baselineStatus',
  'baselineGrain',
  'baselineResetEpoch',
  'normativeElevated',
  'adaptiveElevated',
  'adaptiveLift',
]);
const CLSE_LOOP_STATS_FIELDS = Object.freeze([
  'trackedPages',
  'trackedSites',
]);
const CLSE_ALERT_FIELDS = Object.freeze([
  'type',
  'severity',
  'ts',
  'data',
]);
const PERSONAL_BASELINE_REFERENCE_MODE_VALUES = Object.freeze(
  Object.values(PERSONAL_BASELINE_REFERENCE_MODES),
);
const PERSONAL_BASELINE_STATUS_VALUES = Object.freeze(
  Object.values(PERSONAL_BASELINE_STATUSES),
);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function requireExactFields(value, fields, errorCode) {
  if (!isPlainObject(value)) throw new Error(`${errorCode}:shape`);
  const missingField = fields.find((field) => !hasOwn(value, field));
  if (missingField) throw new Error(`${errorCode}:${missingField}`);
  const unexpectedField = Object.keys(value).find((field) => !fields.includes(field));
  if (unexpectedField) throw new Error(`${errorCode}:unexpected:${unexpectedField}`);
}

function requireNumberInRange(value, {
  field,
  min,
  max,
  errorCode,
}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${errorCode}:${field}`);
  }
  return value;
}

function requireNonNegativeSafeInteger(value, field, errorCode) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${errorCode}:${field}`);
  }
  return value;
}

function requireNullableTimestamp(value, field, errorCode) {
  if (value !== null) requireNonNegativeSafeInteger(value, field, errorCode);
  return value;
}

function requireNullablePositiveSafeInteger(value, field, errorCode) {
  if (value !== null && (!Number.isSafeInteger(value) || value <= 0)) {
    throw new Error(`${errorCode}:${field}`);
  }
  return value;
}

function requireCanonicalCLSESustainedLoadState(value, errorCode) {
  if (value === null) return null;
  requireExactFields(value, CLSE_SUSTAINED_LOAD_STATE_FIELDS, errorCode);
  if (typeof value.inSustainedLoad !== 'boolean') {
    throw new Error(`${errorCode}:inSustainedLoad`);
  }
  const elevatedWindowCount = requireNonNegativeSafeInteger(
    value.elevatedWindowCount,
    'elevatedWindowCount',
    errorCode,
  );
  const startedAt = requireNullableTimestamp(value.startedAt, 'startedAt', errorCode);
  const currentSeverity = requireNumberInRange(value.currentSeverity, {
    field: 'currentSeverity',
    min: 0,
    max: 1,
    errorCode,
  });
  const referenceMode = value.referenceMode;
  const baselineStatus = value.baselineStatus;
  if (
    referenceMode !== null
    && !PERSONAL_BASELINE_REFERENCE_MODE_VALUES.includes(referenceMode)
  ) {
    throw new Error(`${errorCode}:referenceMode`);
  }
  if (baselineStatus !== null && !PERSONAL_BASELINE_STATUS_VALUES.includes(baselineStatus)) {
    throw new Error(`${errorCode}:baselineStatus`);
  }
  if (value.baselineGrain !== CLSE_BASELINE_GRAINS.BUCKET_60S) {
    throw new Error(`${errorCode}:baselineGrain`);
  }
  const baselineResetEpoch = requireNullablePositiveSafeInteger(
    value.baselineResetEpoch,
    'baselineResetEpoch',
    errorCode,
  );
  if (typeof value.normativeElevated !== 'boolean') {
    throw new Error(`${errorCode}:normativeElevated`);
  }
  if (typeof value.adaptiveElevated !== 'boolean') {
    throw new Error(`${errorCode}:adaptiveElevated`);
  }
  const adaptiveLift = requireNumberInRange(value.adaptiveLift, {
    field: 'adaptiveLift',
    min: 0,
    max: 1,
    errorCode,
  });

  if (value.inSustainedLoad !== (startedAt !== null)) {
    throw new Error(`${errorCode}:sustainedState`);
  }
  if ((referenceMode === null) !== (baselineStatus === null)) {
    throw new Error(`${errorCode}:baselineReference`);
  }
  if ((referenceMode === null) !== (baselineResetEpoch === null)) {
    throw new Error(`${errorCode}:baselineReference`);
  }
  if (
    referenceMode === PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE
    && baselineStatus !== PERSONAL_BASELINE_STATUSES.STABLE
  ) {
    throw new Error(`${errorCode}:baselineReference`);
  }
  if (
    referenceMode === PERSONAL_BASELINE_REFERENCE_MODES.NORMATIVE_ONLY
    && baselineStatus === PERSONAL_BASELINE_STATUSES.STABLE
  ) {
    throw new Error(`${errorCode}:baselineReference`);
  }
  if (
    referenceMode !== PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE
    && (value.adaptiveElevated || adaptiveLift !== 0)
  ) {
    throw new Error(`${errorCode}:adaptiveReference`);
  }

  return {
    inSustainedLoad: value.inSustainedLoad,
    elevatedWindowCount,
    startedAt,
    currentSeverity,
    referenceMode,
    baselineStatus,
    baselineGrain: value.baselineGrain,
    baselineResetEpoch,
    normativeElevated: value.normativeElevated,
    adaptiveElevated: value.adaptiveElevated,
    adaptiveLift,
  };
}

function requireCanonicalCLSESustainedBaselineReference({
  sustainedLoadState,
  baseline,
  errorCode,
}) {
  if (sustainedLoadState === null || sustainedLoadState.referenceMode === null) return;
  if (baseline === null) throw new Error(`${errorCode}:sustainedBaselineReference`);

  const profile = baseline.profiles.find((entry) => (
    entry.grain === CLSE_BASELINE_GRAINS.BUCKET_60S
  ));
  const expectedReferenceMode = profile?.status === PERSONAL_BASELINE_STATUSES.STABLE
    ? PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE
    : PERSONAL_BASELINE_REFERENCE_MODES.NORMATIVE_ONLY;
  if (
    !profile
    || sustainedLoadState.baselineGrain !== profile.grain
    || sustainedLoadState.baselineStatus !== profile.status
    || sustainedLoadState.referenceMode !== expectedReferenceMode
    || sustainedLoadState.baselineResetEpoch !== baseline.resetEpoch
  ) {
    throw new Error(`${errorCode}:sustainedBaselineReference`);
  }
}

function requireCanonicalCLSELoopStats(value, errorCode) {
  if (value === null) return null;
  requireExactFields(value, CLSE_LOOP_STATS_FIELDS, errorCode);
  return {
    trackedPages: requireNonNegativeSafeInteger(value.trackedPages, 'trackedPages', errorCode),
    trackedSites: requireNonNegativeSafeInteger(value.trackedSites, 'trackedSites', errorCode),
  };
}

function requireCanonicalCLSEAlert(value, errorCode) {
  if (value === null) return null;
  requireExactFields(value, CLSE_ALERT_FIELDS, errorCode);
  if (typeof value.type !== 'string' || !value.type.trim()) {
    throw new Error(`${errorCode}:type`);
  }
  const severity = requireNumberInRange(value.severity, {
    field: 'severity',
    min: 0,
    max: 1,
    errorCode,
  });
  const ts = requireNonNegativeSafeInteger(value.ts, 'ts', errorCode);
  if (value.data !== null && !isPlainObject(value.data)) {
    throw new Error(`${errorCode}:data`);
  }
  return {
    type: value.type,
    severity,
    ts,
    data: value.data === null ? null : { ...value.data },
  };
}

function readCanonicalCLSEControls(value, errorCode) {
  if (!isPlainObject(value) || typeof value.isEnabled !== 'boolean') {
    throw new Error(`${errorCode}:isEnabled`);
  }
  const sensitivityScale = requireNumberInRange(value.sensitivityScale, {
    field: 'sensitivityScale',
    min: CLSE_CONSTANTS.SENSITIVITY_SCALE_MIN,
    max: CLSE_CONSTANTS.SENSITIVITY_SCALE_MAX,
    errorCode,
  });
  const alertCooldownMs = requireNumberInRange(value.alertCooldownMs, {
    field: 'alertCooldownMs',
    min: CLSE_CONSTANTS.ALERT_COOLDOWN_MIN_MS,
    max: CLSE_CONSTANTS.ALERT_COOLDOWN_MAX_MS,
    errorCode,
  });
  return {
    isEnabled: value.isEnabled,
    sensitivityScale,
    alertCooldownMs,
  };
}

export function requireCanonicalCLSEControlSnapshot(
  value,
  errorCode = 'CLSE_CONTROL_SNAPSHOT_INVALID',
) {
  requireExactFields(value, CLSE_CONTROL_FIELDS, errorCode);
  return readCanonicalCLSEControls(value, errorCode);
}

export function requireCanonicalCLSEStatusSnapshot(
  value,
  errorCode = 'CLSE_STATUS_RESPONSE_INVALID',
) {
  if (!isPlainObject(value)) throw new Error(`${errorCode}:shape`);
  const retiredField = RETIRED_BASELINE_STATUS_FIELDS.find((field) => (
    hasOwn(value, field)
  ));
  if (retiredField) throw new Error(`${errorCode}:retired:${retiredField}`);
  const controls = readCanonicalCLSEControls(value, errorCode);
  requireExactFields(value, CLSE_STATUS_FIELDS, errorCode);
  if (typeof value.isInitialized !== 'boolean') {
    throw new Error(`${errorCode}:isInitialized`);
  }
  const bucketCount = requireNonNegativeSafeInteger(value.bucketCount, 'bucketCount', errorCode);
  const sustainedLoadState = requireCanonicalCLSESustainedLoadState(
    value.sustainedLoadState,
    `${errorCode}:sustainedLoadState`,
  );
  const loopStats = requireCanonicalCLSELoopStats(
    value.loopStats,
    `${errorCode}:loopStats`,
  );
  const alert = requireCanonicalCLSEAlert(value.alert, `${errorCode}:alert`);
  const baseline = value.baseline === null
    ? null
    : requireCanonicalCLSEBaselineSummary(value.baseline, `${errorCode}:baseline`);

  if (!value.isEnabled && (
    bucketCount !== 0
    || sustainedLoadState !== null
    || loopStats !== null
  )) {
    throw new Error(`${errorCode}:disabledRuntimeState`);
  }
  if (value.isInitialized && value.isEnabled && (
    baseline === null
    || sustainedLoadState === null
    || loopStats === null
  )) {
    throw new Error(`${errorCode}:initializedRuntimeState`);
  }
  if (!value.isInitialized && !value.isEnabled && baseline !== null) {
    throw new Error(`${errorCode}:inactiveBaseline`);
  }
  requireCanonicalCLSESustainedBaselineReference({
    sustainedLoadState,
    baseline,
    errorCode,
  });

  return {
    isInitialized: value.isInitialized,
    isEnabled: controls.isEnabled,
    bucketCount,
    sustainedLoadState,
    loopStats,
    sensitivityScale: controls.sensitivityScale,
    alertCooldownMs: controls.alertCooldownMs,
    alert,
    baseline,
  };
}
