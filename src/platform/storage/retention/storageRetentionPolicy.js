import { getLocalDateStr } from '../../../lib/index.js';
import { STATS_RANGE_MAX_DAYS } from '../../../domains/stats/contracts/statsContracts.js';

export const STORAGE_RETENTION_DAYS = Object.freeze({
  USAGE_LOGS: 7,
  CLSE_DIAGNOSTICS: 14,
  CLSE_60S_BUCKETS: 14,
  CLSE_5MIN_BUCKETS: 90,
  CLSE_DAILY_SUMMARIES: 365,
  INTERVENTION_EXPOSURES: 30,
  INTERVENTION_EFFECT_DAILY: 365,
  STATS_FEATURE_PACK_DAILY: STATS_RANGE_MAX_DAYS,
  STATS_FACTS: STATS_RANGE_MAX_DAYS,
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeRetentionDays(value, fallbackDays = 1) {
  const fallback = Number.isFinite(Number(fallbackDays))
    ? Math.max(1, Math.floor(Number(fallbackDays)))
    : 1;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.floor(numeric)) : fallback;
}

export function normalizeRetentionNow(value = Date.now()) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

export function resolveRetentionCutoffTimestamp({
  now = Date.now(),
  days,
  fallbackDays = 1,
} = {}) {
  const normalizedNow = normalizeRetentionNow(now);
  const keepDays = normalizeRetentionDays(days, fallbackDays);
  return normalizedNow - (keepDays * MS_PER_DAY);
}

export function resolveRetentionCutoffDateStr({
  now = Date.now(),
  days,
  fallbackDays = 1,
} = {}) {
  const normalizedNow = normalizeRetentionNow(now);
  const keepDays = normalizeRetentionDays(days, fallbackDays);
  return getLocalDateStr(normalizedNow - ((keepDays - 1) * MS_PER_DAY));
}
