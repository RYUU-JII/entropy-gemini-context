import { estimateSleepPattern, getCycleBoundary } from '../../../lib/sleepPattern.js';
import { getLocalDateStr } from '../../../lib/index.js';
import { DEFAULT_ACTIVITY_DAY_RESET_HOUR } from '../../stats/shared/activityDay.js';
import {
  createStatsPolicyContext,
  projectStatsDay,
} from '../../stats/projection/index.js';

const DEFAULT_RESET_HOUR = DEFAULT_ACTIVITY_DAY_RESET_HOUR;
const DEFAULT_RECOMMENDATION_DAYS = 14;
const DEFAULT_BOOTSTRAP_DAYS = 7;

const STATS_QUERY_POLICY_CONTEXT = createStatsPolicyContext();

function clampHour(value, fallback = DEFAULT_RESET_HOUR) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const floored = Math.floor(numeric);
  return Math.min(23, Math.max(0, floored));
}

function circularHourDistance(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 24 - diff);
}

function resolveRecommendationReliabilityRank(reliability) {
  if (reliability === 'HIGH') return 2;
  if (reliability === 'MEDIUM') return 1;
  return 0;
}

function buildDailyProjectionSeries(stats, dateKeys) {
  if (!stats?.dates || !Array.isArray(dateKeys) || dateKeys.length === 0) return [];

  return dateKeys.map((dateStr) => {
    const projection = projectStatsDay({
      statsRange: stats,
      dateStr,
      policyContext: STATS_QUERY_POLICY_CONTEXT,
    });

    return {
      dateStr,
      hourly: projection.hourlyBuckets.map((bucket) => Number(bucket?.activeMs) || 0),
    };
  });
}

function normalizeDays(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.floor(numeric));
}

export function createCycleRecommendationService({
  getStatsFactsRange,
  recommendationDays = DEFAULT_RECOMMENDATION_DAYS,
  bootstrapDays = DEFAULT_BOOTSTRAP_DAYS,
  defaultResetHour = DEFAULT_RESET_HOUR,
} = {}) {
  if (typeof getStatsFactsRange !== 'function') {
    throw new Error('CYCLE_RECOMMENDATION_SERVICE_FACTS_REQUIRED');
  }

  const resolvedRecommendationDays = normalizeDays(recommendationDays, DEFAULT_RECOMMENDATION_DAYS);
  const resolvedBootstrapDays = normalizeDays(bootstrapDays, DEFAULT_BOOTSTRAP_DAYS);

  async function analyzeCycleResetPolicy({
    currentResetHour = defaultResetHour,
    cooldownUntil = 0,
    hasPendingReset = false,
    now = Date.now(),
  } = {}) {
    const stats = await getStatsFactsRange({ daysBack: resolvedRecommendationDays + 1 });
    if (!stats || !stats.dates || typeof stats.dates !== 'object' || Array.isArray(stats.dates)) {
      throw new Error('CYCLE_RECOMMENDATION_FACTS_INVALID');
    }
    const today = getLocalDateStr(now);
    const dateKeys = Object.keys(stats.dates).filter((dateStr) => dateStr < today).sort();
    const sampledDateKeys = dateKeys.slice(-resolvedRecommendationDays);
    const dailyStats = buildDailyProjectionSeries(stats, sampledDateKeys)
      .filter((day) => day.hourly.some((activeMs) => activeMs > 0));
    const trackedDays = dailyStats.length;
    const stage = trackedDays >= resolvedBootstrapDays ? 'adaptive' : 'bootstrap';
    // Browser activity is evidence of a usage rhythm, not proof of sleep.
    // Do not give conventional night-time hours extra authority over shift workers.
    const pattern = dailyStats.length >= 3
      ? estimateSleepPattern(dailyStats, { circadianWeights: {} })
      : null;
    const habitualWakeHour = Number.isFinite(pattern?.wakeUpHour)
      ? clampHour(pattern.wakeUpHour, defaultResetHour)
      : null;

    if (!Number.isFinite(pattern?.wakeUpHour) || stage === 'bootstrap' || hasPendingReset) {
      return {
        stage,
        trackedDays,
        habitualWakeHour,
        recommendation: null,
      };
    }

    const candidateHour = clampHour(getCycleBoundary(pattern.wakeUpHour), defaultResetHour);
    const reliabilityRank = resolveRecommendationReliabilityRank(pattern.reliability);
    const diffFromCurrent = circularHourDistance(candidateHour, clampHour(currentResetHour, defaultResetHour));
    const isActionable = reliabilityRank >= 1
      && diffFromCurrent >= 1
      && now >= (Number(cooldownUntil) || 0);

    return {
      stage,
      trackedDays,
      habitualWakeHour,
      recommendation: isActionable
        ? {
          id: `reset-rec-${now}-${candidateHour}`,
          candidateHour,
          reliability: pattern.reliability || 'LOW',
          basedOnDays: dailyStats.length,
          createdAt: now,
        }
        : null,
    };
  }

  return {
    analyzeCycleResetPolicy,
  };
}
