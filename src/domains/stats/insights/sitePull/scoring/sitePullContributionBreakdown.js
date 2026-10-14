import { toPublicPersonalBaseline } from '../personalBaseline.js';
import { resolveSitePullEntryVisitSummary } from '../sitePullEntryFacts.js';
import { resolveSitePullInterventionWindows, selectSitePullInterventionReentryWindow } from '../sitePullInterventionFacts.js';
import {
  SITE_PULL_CORE_LATE_HOURS,
  SITE_PULL_NIGHT_HOURS,
  clamp01,
  countActiveHours,
  maxRollingSum,
  sumHours,
  toNumber,
} from '../sitePullMath.js';
import { SITE_PULL_FEATURE_IDS } from './sitePullScoreModel.js';

export function buildContributionBreakdown(
  featureVector,
  subscores,
  featureConfidences,
  weights,
  facts = null,
  personalBaseline = null,
) {
  const resolvePublicPersonalBaseline = createPublicPersonalBaselineResolver(personalBaseline);
  return Object.entries(weights)
    .map(([key, weight]) => {
      const subscore = clamp01(subscores[key]);
      return {
        id: SITE_PULL_FEATURE_IDS[key] || key,
        feature: key,
        subscore: Math.round(subscore * 100),
        weight,
        contribution: Number((subscore * weight).toFixed(1)),
        confidence: Number(clamp01(featureConfidences[key]).toFixed(2)),
        evidence: buildContributionEvidence(featureVector, key, facts, resolvePublicPersonalBaseline),
      };
    })
    .sort((a, b) => b.contribution - a.contribution);
}

function createPublicPersonalBaselineResolver(personalBaseline = null) {
  let resolved = false;
  let publicPersonalBaseline = null;
  return () => {
    if (!resolved) {
      publicPersonalBaseline = toPublicPersonalBaseline(personalBaseline);
      resolved = true;
    }
    return publicPersonalBaseline;
  };
}

function buildContributionEvidence(featureVector, key, facts = null, resolvePublicPersonalBaseline = () => null) {
  if (key === 'timePressure') {
    return {
      todayMs: featureVector.todayTotalMs,
      weeklyAverageMs: featureVector.weeklyAverageMs,
      personalBaseline: resolvePublicPersonalBaseline(),
    };
  }
  if (key === 'planFriction') {
    return {
      hasGoal: featureVector.hasGoal,
      todayMs: facts.goal.context.usageMs,
      basis: facts.goal.context.basis,
      goalMinutes: featureVector.goalMinutes,
      usageRatio: featureVector.usageRatio,
      overGoalMs: featureVector.overGoalMs,
    };
  }
  if (key === 'checkingLoop') {
    const entryVisitSummary = resolveSitePullEntryVisitSummary({ facts });
    const todayVisits = entryVisitSummary.todayVisits;
    const visitHoursToday = entryVisitSummary.visitHoursToday;
    const behaviorFacts = facts?.behavior || {};
    const sessionFacts = facts?.session || {};
    const navigationFacts = facts?.navigation || {};
    const transitionEdgeFacts = facts?.transitionEdges || {};
    return {
      hasVisitFacts: entryVisitSummary.hasVisitFacts,
      hasBehaviorFacts: Boolean(behaviorFacts.hasBehaviorFacts),
      hasMeasuredSessionFacts: Boolean(sessionFacts.hasMeasuredSessionFacts),
      hasNavigationFacts: Boolean(navigationFacts.hasNavigationFacts),
      hasTransitionEdgeFacts: Boolean(transitionEdgeFacts.hasTransitionEdgeFacts),
      todayVisits,
      typedEntrances: Math.floor(toNumber(navigationFacts.typed)),
      addressBarEntrances: Math.floor(toNumber(navigationFacts.addressBar)),
      reloads: Math.floor(toNumber(navigationFacts.reload)),
      revisitWithin10m: Math.floor(toNumber(behaviorFacts.revisitWithin10m)),
      switchIns: Math.floor(toNumber(behaviorFacts.switchIns)),
      switchOuts: Math.floor(toNumber(behaviorFacts.switchOuts)),
      switchChurn: Math.floor(toNumber(behaviorFacts.switchIns) + toNumber(behaviorFacts.switchOuts)),
      switchBackWithin10m: Math.floor(toNumber(behaviorFacts.switchBackWithin10m)),
      transitionEdgeCount: Math.floor(toNumber(transitionEdgeFacts.todayCount)),
      transitionEdgeReturnWithin10m: Math.floor(toNumber(transitionEdgeFacts.todayReturnWithin10m)),
      transitionEdgeDistinctCount: Math.floor(toNumber(transitionEdgeFacts.todayDistinctEdgeCount)),
      topTransitionEdges: Array.isArray(transitionEdgeFacts.topEdges) ? transitionEdgeFacts.topEdges.slice(0, 5) : [],
      newTabEntrances: Math.floor(toNumber(behaviorFacts.newTabEntrances)),
      duplicateTabEntrances: Math.floor(toNumber(behaviorFacts.duplicateTabEntrances)),
      highOpenTabEntrances: Math.floor(toNumber(behaviorFacts.highOpenTabEntrances)),
      maxSameDomainOpenTabs: Math.floor(toNumber(behaviorFacts.maxSameDomainOpenTabs)),
      maxOpenTabs: Math.floor(toNumber(behaviorFacts.maxOpenTabs)),
      scrollSpikeBursts: Math.floor(toNumber(behaviorFacts.scrollSpikeBursts)),
      fastScrollBursts: Math.floor(toNumber(behaviorFacts.fastScrollBursts)),
      feedAdvanceBursts: Math.floor(toNumber(behaviorFacts.feedAdvanceBursts)),
      feedSkimSignals: Math.floor(toNumber(behaviorFacts.feedSkimSignals)),
      maxFeedScreenfuls: toNumber(behaviorFacts.maxFeedScreenfuls),
      maxFeedItemTransitions: Math.floor(toNumber(behaviorFacts.maxFeedItemTransitions)),
      shortSessionCount: Math.floor(toNumber(sessionFacts.shortSessionCount)),
      activeHoursToday: countActiveHours(featureVector.todayHourly),
      visitHoursToday,
      activeHoursHabit: countActiveHours(featureVector.habitHourly),
      personalBaseline: resolvePublicPersonalBaseline(),
      confidenceNote: behaviorFacts.hasBehaviorFacts || sessionFacts.hasMeasuredSessionFacts
        ? 'behavior_facts'
        : navigationFacts.hasNavigationFacts ? 'navigation_facts' : todayVisits > 0 ? 'visit_facts' : 'proxy',
    };
  }
  if (key === 'immersionDepth') {
    const sessionFacts = facts?.session || null;
    return {
      max3hTodayMs: maxRollingSum(featureVector.todayHourly, 3),
      dominantTodayShare: featureVector.dominantTodayShare,
      sessionMode: sessionFacts?.mode || 'unavailable',
      hasMeasuredSessionFacts: Boolean(sessionFacts?.hasMeasuredSessionFacts),
      hasEstimatedSessionFacts: Boolean(sessionFacts?.hasEstimatedSessionFacts),
      measuredSessionCount: Math.floor(toNumber(sessionFacts?.measuredSessionCount)),
      measuredAverageSessionMs: toNumber(sessionFacts?.measuredAverageSessionMs),
      maxSessionMs: toNumber(sessionFacts?.maxSessionMs),
      estimatedSessionCount: Math.floor(toNumber(sessionFacts?.estimatedSessionCount)),
      estimatedAverageSessionMs: toNumber(sessionFacts?.estimatedAverageSessionMs),
      estimatedLongSessionBucketCount: Math.floor(toNumber(sessionFacts?.estimatedLongSessionBucketCount)),
      personalBaseline: resolvePublicPersonalBaseline(),
    };
  }
  if (key === 'habitRegularity') {
    return {
      activeDays: featureVector.activeDays,
      streakDays: featureVector.streakDays,
      weeklyTotalMs: featureVector.weeklyTotalMs,
    };
  }
  if (key === 'trendAcceleration') {
    return {
      recentAverageMs: featureVector.recentAverageMs,
      baselineAverageMs: featureVector.baselineAverageMs,
      trendRatio: featureVector.trendRatio,
      personalBaseline: resolvePublicPersonalBaseline(),
    };
  }
  if (key === 'circadianRisk') {
    return {
      nightMsToday: sumHours(featureVector.todayHourly, SITE_PULL_NIGHT_HOURS),
      coreLateMsToday: sumHours(featureVector.todayHourly, SITE_PULL_CORE_LATE_HOURS),
    };
  }
  if (key === 'interventionResistance') {
    const intervention = facts?.intervention || {};
    const windows = resolveSitePullInterventionWindows(intervention);
    const { selected, name } = selectSitePullInterventionReentryWindow(windows);
    return {
      evidenceWindow: name, evidenceCohort: windows.cohort,
      frictionShown: selected.frictionShown,
      continued: selected.continued,
      left: selected.left,
      reenteredWithin5m: selected.reenteredWithin5m,
      reenteredWithin30m: selected.reenteredWithin30m,
      escapeClosed: selected.escapeClosed,
      weeklyFrictionShown: Math.floor(toNumber(intervention.weeklyFrictionShown)),
      weeklyContinued: Math.floor(toNumber(intervention.weeklyContinued)),
      weeklyLeft: Math.floor(toNumber(intervention.weeklyLeft)),
      weeklyReenteredWithin5m: Math.floor(toNumber(intervention.weeklyReenteredWithin5m)),
      weeklyReenteredWithin30m: Math.floor(toNumber(intervention.weeklyReenteredWithin30m)),
      weeklyEscapeClosed: Math.floor(toNumber(intervention.weeklyEscapeClosed)),
    };
  }
  return {};
}

export function buildDrivers(contributionBreakdown, badges) {
  const badgeIds = new Set((Array.isArray(badges) ? badges : []).map((badge) => badge.id));
  return contributionBreakdown
    .filter((entry) => entry.contribution >= 2.5)
    .slice(0, 4)
    .map((entry) => ({
      id: `${entry.id}_driver`,
      feature: entry.feature,
      labelId: entry.id,
      contribution: entry.contribution,
      confidence: entry.confidence,
      evidence: entry.evidence,
      matchedBadgeIds: [...badgeIds].filter((id) => id.includes(entry.id)),
    }));
}
