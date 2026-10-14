import { requireStatsRuntimeEpoch } from '../../contracts/statsRuntimeEpochContracts.js';

export {
  STATS_RUNTIME_EPOCH_HEX_LENGTH,
  requireStatsRuntimeEpoch,
} from '../../contracts/statsRuntimeEpochContracts.js';

export const STATS_DURABLE_FACT_STORE_ROLES = Object.freeze({
  HOURLY_FACT_LEDGER: 'stats_hourly_durable_fact_ledger',
  DAILY_MATERIALIZED_SUMMARY: 'stats_daily_materialized_summary',
});

export const STATS_FACTS_READ_BASIS = Object.freeze({
  DURABLE_HOURLY_AND_DAILY: 'durable_hourly_and_daily_facts',
});

export const STATS_FACTS_RUNTIME_OVERLAY = Object.freeze({
  DISABLED: 'runtime_overlay_disabled',
});

export const STATS_READ_MODEL_BASIS = Object.freeze({
  ACTIVITY_DAY: 'activity-day',
  CALENDAR_DAY: 'calendar-day',
  CYCLE_WINDOW: 'cycle-window',
});

export const STATS_EXPOSURE_READ_SOURCE = Object.freeze({
  REGISTRY_ACTIVITY_DAY: 'sites_registry_activity_day_projection',
  CYCLE_WINDOW: 'cycle_window_projection',
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function createDurableStatsFactsReadModel({
  spanDays = null,
  requestedDateStr = null,
  generatedAtEpochMs = Date.now(),
  runtimeEpoch,
  runtimeRevision,
} = {}) {
  const normalizedRuntimeEpoch = requireStatsRuntimeEpoch(runtimeEpoch);
  if (!Number.isSafeInteger(runtimeRevision) || runtimeRevision < 0) {
    const error = new Error('STATS_FACTS_READ_MODEL_RUNTIME_REVISION_INVALID');
    error.code = 'STATS_FACTS_READ_MODEL_RUNTIME_REVISION_INVALID';
    throw error;
  }
  return {
    basis: STATS_FACTS_READ_BASIS.DURABLE_HOURLY_AND_DAILY,
    sourceOfTruth: STATS_DURABLE_FACT_STORE_ROLES.HOURLY_FACT_LEDGER,
    materializedSummary: STATS_DURABLE_FACT_STORE_ROLES.DAILY_MATERIALIZED_SUMMARY,
    runtimeOverlay: STATS_FACTS_RUNTIME_OVERLAY.DISABLED,
    runtimeEpoch: normalizedRuntimeEpoch,
    runtimeRevision,
    spanDays: Number.isFinite(Number(spanDays)) ? Math.max(1, Math.floor(Number(spanDays))) : null,
    requestedDateStr: typeof requestedDateStr === 'string' && requestedDateStr ? requestedDateStr : null,
    generatedAtEpochMs: Number.isFinite(Number(generatedAtEpochMs))
      ? Number(generatedAtEpochMs)
      : Date.now(),
  };
}

export function attachDurableStatsFactsReadModel(range, options = {}) {
  const baseRange = isPlainObject(range) ? range : { dates: {} };
  return {
    ...baseRange,
    readModel: createDurableStatsFactsReadModel(options),
  };
}

export function requireStatsFactsRuntimeRevision(range) {
  const runtimeRevision = range?.readModel?.runtimeRevision;
  if (!Number.isSafeInteger(runtimeRevision) || runtimeRevision < 0) {
    const error = new Error('STATS_FACTS_READ_MODEL_RUNTIME_REVISION_REQUIRED');
    error.code = 'STATS_FACTS_READ_MODEL_RUNTIME_REVISION_REQUIRED';
    throw error;
  }
  return runtimeRevision;
}

export function requireStatsFactsRuntimeEpoch(range) {
  return requireStatsRuntimeEpoch(range?.readModel?.runtimeEpoch);
}

export function createStatsExposureReadModel({
  basis = STATS_READ_MODEL_BASIS.ACTIVITY_DAY,
  source = STATS_EXPOSURE_READ_SOURCE.REGISTRY_ACTIVITY_DAY,
  siteDetails = {},
  totalExposure = 0,
  generatedAtEpochMs = Date.now(),
} = {}) {
  return {
    basis,
    source,
    runtimeOverlay: STATS_FACTS_RUNTIME_OVERLAY.DISABLED,
    siteDetails: isPlainObject(siteDetails) ? { ...siteDetails } : {},
    totalExposure: Number.isFinite(Number(totalExposure)) ? Math.max(0, Number(totalExposure)) : 0,
    generatedAtEpochMs: Number.isFinite(Number(generatedAtEpochMs))
      ? Number(generatedAtEpochMs)
      : Date.now(),
  };
}
