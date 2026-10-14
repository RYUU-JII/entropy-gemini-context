import {
  SITE_INSIGHT_ENGINE_VERSION,
  SITE_INSIGHT_FAMILIES,
  SITE_INSIGHT_SEVERITIES,
  resolveSiteInsightDepth,
} from '../contracts/siteInsightContracts.js';
import { PERSONAL_BASELINE_ROLES } from '../../../../lib/personalBaselineContract.js';
import { resolveSitePullObservationState } from '../sitePull/sitePullObservationState.js';

function requireFeatureSummaryTrendRole(value) {
  if (value === undefined || value === null) return null;
  if (value !== PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY) {
    throw new Error(`SITE_INSIGHT_FEATURE_TREND_ROLE_INVALID:${String(value)}`);
  }
  return value;
}

function severityRank(value) {
  if (value === SITE_INSIGHT_SEVERITIES.CRITICAL) return 4;
  if (value === SITE_INSIGHT_SEVERITIES.WARNING) return 3;
  if (value === SITE_INSIGHT_SEVERITIES.NEUTRAL) return 2;
  if (value === SITE_INSIGHT_SEVERITIES.POSITIVE) return 1;
  return 0;
}

function buildFeatureSummary(featureVector = {}) {
  const trendRatio = Number(featureVector.trendRatio);
  return {
    domain: featureVector.domain || '',
    type: featureVector.type || 'unmanaged',
    goalMinutes: featureVector.goalMinutes || 0,
    todayTotalMs: featureVector.todayTotalMs || 0,
    weeklyAverageMs: featureVector.weeklyAverageMs || 0,
    usageRatio: featureVector.usageRatio || 0,
    trendRole: requireFeatureSummaryTrendRole(featureVector.trendRole),
    hasTrendComparison: featureVector.hasTrendComparison === true,
    trendDirection: featureVector.trendDirection || 'flat',
    trendRatio: Number.isFinite(trendRatio) ? trendRatio : 1,
    dominantTodayWindow: featureVector.dominantTodayWindow || null,
    dominantTodayShare: featureVector.dominantTodayShare || 0,
  };
}

function pickPrimaryPattern(patterns = []) {
  return [...patterns].sort((left, right) => {
    const severityDelta = severityRank(right?.severity) - severityRank(left?.severity);
    if (severityDelta !== 0) return severityDelta;
    const scoreDelta = (Number(right?.score) || 0) - (Number(left?.score) || 0);
    if (scoreDelta !== 0) return scoreDelta;
    return (Number(right?.confidence) || 0) - (Number(left?.confidence) || 0);
  })[0] || null;
}

function buildNoSignalInsight(featureVector = {}) {
  const observation = resolveSitePullObservationState(featureVector);
  return {
    id: 'insufficient_signal',
    family: SITE_INSIGHT_FAMILIES.BASELINE,
    severity: SITE_INSIGHT_SEVERITIES.NEUTRAL,
    score: observation.status === 'missing' ? null : featureVector.hasAnyActivity ? 18 : 6,
    confidence: observation.status === 'missing' ? 0 : 0.4,
    summaryCode: observation.status === 'observed_zero' ? 'no_recent_activity' : 'insufficient_signal',
    supportingFacts: [],
    recommendedAction: null,
  };
}

export function synthesizeSiteInsight({
  featureVector,
  patterns,
  insightsMode,
} = {}) {
  const primaryPattern = pickPrimaryPattern(patterns);
  return {
    engineVersion: SITE_INSIGHT_ENGINE_VERSION,
    depth: resolveSiteInsightDepth(insightsMode),
    mode: insightsMode || 'off',
    featureSummary: buildFeatureSummary(featureVector),
    patterns: Array.isArray(patterns) ? patterns : [],
    primaryInsight: primaryPattern || buildNoSignalInsight(featureVector),
  };
}
