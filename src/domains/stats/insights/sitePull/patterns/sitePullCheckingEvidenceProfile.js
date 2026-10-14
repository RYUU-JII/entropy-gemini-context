import { buildSitePullTabContextEvidenceProfile } from './sitePullTabContextEvidenceProfile.js';
import { resolveSitePullEntryVisitSummary } from '../sitePullEntryFacts.js';
import { SITE_PULL_MINUTE_MS, clamp, clamp01, toNumber } from '../sitePullMath.js';
import { normalizeReentryGapBuckets } from '../../../contracts/statsContracts.js';
import { buildSitePullNavigationIntentMetrics } from '../navigationIntentMetrics.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  getSitePullPersonalBaselineMetric,
  resolveSitePullPersonalBaselineMetricScores,
} from '../personalBaselineMetrics.js';
import { resolveSitePullSessionShape } from './sitePullSessionFactSource.js';
import {
  countActiveHours,
  countVisitHours,
  maxRollingSum,
} from './patternUtils.js';

export const SITE_PULL_CHECKING_EVIDENCE_PROFILE_VERSION = 'site-pull-checking-evidence-profile-v3';

export const SITE_PULL_EVIDENCE_STATUS = Object.freeze({
  ABSENT: 'absent',
  OBSERVED: 'observed',
  WEAK: 'weak',
  CANDIDATE: 'candidate',
  STRONG: 'strong',
});

export const SITE_PULL_CHECKING_COUNTER_AUTHORITY = Object.freeze({
  revisitWithin10m: Object.freeze({
    owner: 'statsAggregator.incrementDomainVisit',
    timing: 'visit_event',
    rule: 'current visit timestamp minus domain behavior.lastVisitAt is >0 and <=10m',
    storage: 'stats day domain.behavior.revisitWithin10m and hourlyRevisitWithin10m',
    downstream: 'buildSitePullFacts.behavior -> checking evidence profile -> personal baseline and pattern detectors',
  }),
  reentryGapBuckets: Object.freeze({
    owner: 'statsAggregator.incrementDomainVisit / statsAggregator.recordDomainSwitch',
    timing: 'visit_event_or_domain_switch_event',
    rule: 'current gap is bucketed into 0-2m, 2-5m, 5-10m, 10-30m, or 30-120m without raw interval storage',
    storage: 'stats day domain.behavior.reentryGapBuckets and hourlyReentryGapBuckets',
    downstream: 'temporal evidence interval profile and future parser/model inputs',
  }),
  switchBackWithin10m: Object.freeze({
    owner: 'statsAggregator.recordDomainSwitch',
    timing: 'domain_switch_event',
    rule: 'switching into a domain after its lastExitAt is >0 and <=10m',
    storage: 'stats day domain.behavior.switchBackWithin10m and hourlySwitchBackWithin10m',
    downstream: 'buildSitePullFacts.behavior -> quick return and checking carousel evidence',
  }),
  shortSessionCount: Object.freeze({
    owner: 'statsAggregator.incrementDomainSession',
    timing: 'session_close_or_flush',
    rule: 'domain session duration is <2m',
    storage: 'stats day domain.sessions.shortCount and hourlyShortCount',
    downstream: 'buildSitePullFacts.session -> session fragmentation and personal baseline evidence',
  }),
  newTabEntrances: Object.freeze({
    owner: 'statsAggregator.recordDomainTabContext',
    timing: 'tab_context_event',
    rule: 'domain entrance is marked fromNewTab',
    storage: 'stats day domain.behavior.newTabEntrances and hourlyNewTabEntrances',
    downstream: 'buildSitePullFacts.behavior -> tab context evidence',
  }),
  duplicateTabEntrances: Object.freeze({
    owner: 'statsAggregator.recordDomainTabContext',
    timing: 'tab_context_event',
    rule: 'same-domain open tab count is >=2 at entrance/context observation time',
    storage: 'stats day domain.behavior.duplicateTabEntrances and hourlyDuplicateTabEntrances',
    downstream: 'buildSitePullFacts.behavior -> duplicate tab context evidence',
  }),
  tabOpenContext: Object.freeze({
    owner: 'statsAggregator.recordDomainTabContext',
    timing: 'tab_context_event',
    rule: 'high-open-tab entrance count and max open-tab counts are updated from the current tab context snapshot',
    storage: 'stats day domain.behavior.highOpenTabEntrances/maxOpenTabs and hourly equivalents',
    downstream: 'buildSitePullFacts.behavior -> tab hoarding context evidence',
  }),
});

const { ABSENT, OBSERVED, WEAK, CANDIDATE, STRONG } = SITE_PULL_EVIDENCE_STATUS;

const STATUS_RANK = Object.freeze({
  [ABSENT]: 0,
  [OBSERVED]: 1,
  [WEAK]: 2,
  [CANDIDATE]: 3,
  [STRONG]: 4,
});

const QUICK_RETURN_IMPULSE_BUCKET_WEIGHTS = Object.freeze({
  within2m: 1,
  between2m5m: 0.72,
  between5m10m: 0.38,
  between10m30m: 0.08,
  between30m120m: 0.02,
});

const QUICK_RETURN_IMPULSE_THRESHOLDS = Object.freeze({
  weak: Object.freeze({
    switchIns: 2,
    weightedSwitchCount: 0.65,
  }),
  candidate: Object.freeze({
    switchIns: 3,
    weightedSwitchCount: 1.2,
    weightedRate: 0.3,
  }),
  strong: Object.freeze({
    switchIns: 5,
    weightedSwitchCount: 2.4,
    weightedRate: 0.45,
  }),
});

function toCount(value) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function roundRatio(value) {
  return Number(clamp01(value).toFixed(4));
}

function statusAtLeast(status, floor) {
  return (STATUS_RANK[status] || 0) >= (STATUS_RANK[floor] || 0);
}

function profileEntry({
  id,
  status,
  strength = 0,
  canEmitAtomic = false,
  canSupportComposite = false,
  evidence = {},
  criteria = {},
  caveats = [],
  authorityKeys = [],
}) {
  return {
    id,
    status,
    strength: Number(clamp01(strength).toFixed(4)),
    canEmitAtomic,
    canSupportComposite,
    evidence,
    criteria,
    caveats,
    authorityKeys,
  };
}

function roundNumber(value) {
  return Number(toNumber(value).toFixed(4));
}

function resolveEntryShape(facts) {
  const entry = resolveSitePullEntryVisitSummary({ facts });
  const todayHourlyVisits = Array.isArray(entry.todayHourlyVisits)
    ? entry.todayHourlyVisits
    : [];
  const todayVisits = entry.todayVisits;
  const visitHourCount = countVisitHours(todayHourlyVisits);
  const maxHourlyVisits = Math.max(0, ...todayHourlyVisits.map(toCount));
  const rolling2hVisits = maxRollingSum(todayHourlyVisits, 2);
  const weeklyVisits = toCount(entry.weeklyVisits);

  return {
    hasEntryFacts: facts?.dataCoverage?.hasEntryFacts === true
      || entry.hasVisitFacts === true
      || todayVisits > 0
      || weeklyVisits > 0,
    todayVisits,
    weeklyVisits,
    todayHourlyVisits,
    visitHourCount,
    maxHourlyVisits,
    rolling2hVisits,
  };
}

function resolveUsageShape(facts) {
  const usage = facts?.usage || {};
  return {
    activeHoursToday: countActiveHours(usage.todayHourly),
    activeHoursHabit: countActiveHours(usage.habitHourly),
  };
}

function sumCounts(values) {
  return values.reduce((sum, value) => sum + toCount(value), 0);
}

function statusStrength(status) {
  return clamp01((STATUS_RANK[status] || 0) / STATUS_RANK[STRONG]);
}

function buildQuickReturnImpulseEvidence({ behavior, switchIns, switchBackWithin10m }) {
  const buckets = normalizeReentryGapBuckets(behavior?.reentryGapBuckets);
  const switchBuckets = {
    within2m: toCount(buckets.switch0To2m),
    between2m5m: toCount(buckets.switch2To5m),
    between5m10m: toCount(buckets.switch5To10m),
    between10m30m: toCount(buckets.switch10To30m),
    between30m120m: toCount(buckets.switch30To120m),
  };
  const switchBucketSampleCount = sumCounts(Object.values(switchBuckets));
  const weightedSwitchCount = Object.entries(switchBuckets).reduce((sum, [key, count]) => (
    sum + (count * QUICK_RETURN_IMPULSE_BUCKET_WEIGHTS[key])
  ), 0);
  const coarseSwitchBackScore = toCount(switchBackWithin10m) * 0.65;
  const usesBucketFacts = switchBucketSampleCount > 0;
  const impulseWeightedSwitchCount = usesBucketFacts
    ? weightedSwitchCount
    : coarseSwitchBackScore;
  const impulseReentryRate = switchIns > 0 ? impulseWeightedSwitchCount / switchIns : 0;
  const impulseReentryScore = Math.max(
    clamp01(impulseWeightedSwitchCount / 3),
    clamp01(impulseReentryRate / 0.55),
  );

  return {
    hasImpulseBucketFacts: usesBucketFacts,
    impulseBucketMode: usesBucketFacts ? 'weighted_switch_gap_buckets' : 'coarse_switch_back_counter',
    impulseSwitchBuckets: switchBuckets,
    impulseSwitchBucketSampleCount: switchBucketSampleCount,
    impulseWeightedSwitchCount: roundNumber(impulseWeightedSwitchCount),
    impulseReentryRate: roundRatio(impulseReentryRate),
    impulseReentryScore: roundRatio(impulseReentryScore),
    impulseCoarseSwitchBackScore: roundNumber(coarseSwitchBackScore),
  };
}

function resolveSessionShape(_featureVector, facts) {
  return resolveSitePullSessionShape(facts, { errorCode: 'SITE_PULL_CHECKING_SESSION_FACTS_INVALID' });
}

function buildCheckingLoopEvidence({ facts, subscores }) {
  const entryShape = resolveEntryShape(facts);
  const usageShape = resolveUsageShape(facts);
  const visitsAvailable = entryShape.hasEntryFacts;
  const checkingScore = clamp01(subscores?.checkingLoop);
  const threshold = visitsAvailable ? 0.4 : 0.55;
  const weakThreshold = visitsAvailable ? 0.25 : 0.4;
  const strongThreshold = visitsAvailable ? 0.7 : 0.75;
  let status = ABSENT;
  if (checkingScore > 0) status = OBSERVED;
  if (checkingScore >= weakThreshold) status = WEAK;
  if (checkingScore >= threshold) status = CANDIDATE;
  if (checkingScore >= strongThreshold) status = STRONG;

  return profileEntry({
    id: visitsAvailable ? 'checking_loop' : 'checking_loop_proxy',
    status,
    strength: checkingScore,
    canEmitAtomic: statusAtLeast(status, CANDIDATE),
    canSupportComposite: statusAtLeast(status, WEAK),
    evidence: {
      checkingScore: Number(checkingScore.toFixed(4)),
      todayVisits: entryShape.todayVisits,
      activeHoursToday: usageShape.activeHoursToday,
      visitHoursToday: entryShape.visitHourCount,
      activeHoursHabit: usageShape.activeHoursHabit,
      visitsAvailable,
    },
    criteria: {
      weak: `checkingLoop>=${weakThreshold}`,
      candidate: `checkingLoop>=${threshold}`,
      strong: `checkingLoop>=${strongThreshold}`,
    },
    caveats: visitsAvailable ? [] : ['visit_facts_unavailable_proxy'],
  });
}

function buildQuickReturnEvidence({ facts, personalBaseline }) {
  const behavior = facts?.behavior || {};
  const hasBehaviorFacts = behavior.hasBehaviorFacts === true;
  const behaviorSwitchBackWithin10m = toCount(behavior.switchBackWithin10m);
  const behaviorSwitchIns = toCount(behavior.switchIns);
  const switchBackMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_BACK_COUNT,
  );
  const switchInMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_IN_COUNT,
  );
  const metricScores = resolveSitePullPersonalBaselineMetricScores(personalBaseline);
  const baselineSwitchBackWithin10m = toCount(switchBackMetric?.currentValue);
  const baselineSwitchIns = toCount(switchInMetric?.currentValue);
  const switchBackWithin10m = hasBehaviorFacts ? behaviorSwitchBackWithin10m : baselineSwitchBackWithin10m;
  const switchIns = hasBehaviorFacts ? behaviorSwitchIns : baselineSwitchIns;
  const quickReturnRate = switchIns > 0 ? switchBackWithin10m / switchIns : 0;
  const baselineScore = clamp01(metricScores?.quickReturnAnomalyScore);
  const baselineConfidence = clamp01(metricScores?.loopConfidence);
  const behaviorQuickReturnRate = behaviorSwitchIns > 0
    ? behaviorSwitchBackWithin10m / behaviorSwitchIns
    : 0;
  const impulseEvidence = buildQuickReturnImpulseEvidence({
    behavior,
    switchIns: behaviorSwitchIns,
    switchBackWithin10m: behaviorSwitchBackWithin10m,
  });
  const impulseWeightedSwitchCount = toNumber(impulseEvidence.impulseWeightedSwitchCount);
  const impulseReentryRate = toNumber(impulseEvidence.impulseReentryRate);
  const hasImpulseBucketFacts = impulseEvidence.hasImpulseBucketFacts;
  const behaviorWeak = hasBehaviorFacts
    && behaviorSwitchIns >= QUICK_RETURN_IMPULSE_THRESHOLDS.weak.switchIns
    && (
      hasImpulseBucketFacts
        ? impulseWeightedSwitchCount >= QUICK_RETURN_IMPULSE_THRESHOLDS.weak.weightedSwitchCount
        : behaviorSwitchBackWithin10m >= 1
    );
  const hasBehaviorCandidate = hasBehaviorFacts
    && behaviorSwitchIns >= QUICK_RETURN_IMPULSE_THRESHOLDS.candidate.switchIns
    && (
      hasImpulseBucketFacts
        ? (
          impulseWeightedSwitchCount >= QUICK_RETURN_IMPULSE_THRESHOLDS.candidate.weightedSwitchCount
          && impulseReentryRate >= QUICK_RETURN_IMPULSE_THRESHOLDS.candidate.weightedRate
        )
        : (
          behaviorSwitchBackWithin10m >= 2
          && behaviorQuickReturnRate >= 0.3
        )
    );
  const hasBehaviorStrong = hasBehaviorFacts
    && behaviorSwitchIns >= QUICK_RETURN_IMPULSE_THRESHOLDS.strong.switchIns
    && (
      hasImpulseBucketFacts
        ? (
          impulseWeightedSwitchCount >= QUICK_RETURN_IMPULSE_THRESHOLDS.strong.weightedSwitchCount
          && impulseReentryRate >= QUICK_RETURN_IMPULSE_THRESHOLDS.strong.weightedRate
        )
        : (
          behaviorSwitchBackWithin10m >= 4
          && quickReturnRate >= 0.5
        )
    );
  const baselineCandidate = switchIns >= 3 && switchBackWithin10m >= 2
    && baselineConfidence >= 0.35 && baselineScore >= 0.55;
  let status = ABSENT;
  if (switchBackWithin10m > 0 || impulseWeightedSwitchCount > 0 || baselineScore > 0) status = OBSERVED;
  if (
    behaviorWeak
    || (baselineConfidence >= 0.25 && baselineScore >= 0.4)
  ) {
    status = WEAK;
  }
  if (
    hasBehaviorCandidate
    || baselineCandidate
  ) {
    status = CANDIDATE;
  }
  if (
    hasBehaviorStrong
    || (baselineCandidate && switchIns >= 5 && switchBackWithin10m >= 4 && baselineConfidence >= 0.5 && baselineScore >= 0.75)
  ) {
    status = STRONG;
  }

  return profileEntry({
    id: 'quick_return',
    status,
    strength: Math.max(toNumber(impulseEvidence.impulseReentryScore), baselineScore),
    canEmitAtomic: statusAtLeast(status, CANDIDATE),
    canSupportComposite: switchIns >= 2 && switchBackWithin10m >= 1 && statusAtLeast(status, WEAK),
    evidence: {
      hasBehaviorFacts,
      hasBehaviorCandidate,
      hasBaselineCandidate: baselineCandidate,
      switchBackWithin10m,
      switchIns,
      quickReturnRate: Number(quickReturnRate.toFixed(4)),
      behaviorSwitchBackWithin10m,
      behaviorSwitchIns,
      behaviorQuickReturnRate: Number(behaviorQuickReturnRate.toFixed(4)),
      baselineSwitchBackWithin10m,
      baselineSwitchIns,
      baselineScore: Number(baselineScore.toFixed(4)),
      baselineConfidence: Number(baselineConfidence.toFixed(4)),
      ...impulseEvidence,
    },
    criteria: {
      weak: 'weighted quick-return impulse>=0.65 with switchIns>=2, or baseline score>=0.4',
      candidate: 'weighted quick-return impulse>=1.2 and weighted rate>=0.3 with switchIns>=3, or baseline score>=0.55 with >=3 current switches and >=2 returns',
      strong: 'weighted quick-return impulse>=2.4 and weighted rate>=0.45 with switchIns>=5, or baseline score>=0.75 with >=5 current switches and >=4 returns',
    },
    caveats: hasBehaviorFacts ? [] : ['behavior_facts_unavailable_baseline_only'],
    authorityKeys: ['switchBackWithin10m', 'reentryGapBuckets'],
  });
}

function buildSwitchChurnEvidence({ facts, personalBaseline }) {
  const behavior = facts?.behavior || {};
  const entryShape = resolveEntryShape(facts);
  const hasBehaviorFacts = behavior.hasBehaviorFacts === true;
  const behaviorSwitchIns = toCount(behavior.switchIns);
  const behaviorSwitchOuts = toCount(behavior.switchOuts);
  const switchChurnMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT,
  );
  const switchInMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_IN_COUNT,
  );
  const switchOutMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_OUT_COUNT,
  );
  const metricScores = resolveSitePullPersonalBaselineMetricScores(personalBaseline);
  const baselineSwitchIns = toCount(switchInMetric?.currentValue);
  const baselineSwitchOuts = toCount(switchOutMetric?.currentValue);
  const switchIns = hasBehaviorFacts ? behaviorSwitchIns : baselineSwitchIns;
  const switchOuts = hasBehaviorFacts ? behaviorSwitchOuts : baselineSwitchOuts;
  const switchChurn = switchIns + switchOuts;
  const entranceCount = Math.max(entryShape.todayVisits, toCount(facts?.navigation?.total), 1);
  const churnPerEntrance = switchChurn / entranceCount;
  const baselineScore = clamp01(metricScores?.switchChurnAnomalyScore);
  const baselineConfidence = clamp01(metricScores?.loopConfidence);
  const behaviorSwitchChurn = behaviorSwitchIns + behaviorSwitchOuts;
  const behaviorChurnPerEntrance = behaviorSwitchChurn / entranceCount;
  const hasBehaviorCandidate = hasBehaviorFacts
    && behaviorSwitchChurn >= 8
    && behaviorChurnPerEntrance >= 1.2;
  const hasBaselineCandidate = baselineConfidence >= 0.35 && baselineScore >= 0.6;
  let status = ABSENT;
  if (switchChurn > 0 || baselineScore > 0) status = OBSERVED;
  if (
    (switchChurn >= 4 && churnPerEntrance >= 0.7)
    || (baselineConfidence >= 0.25 && baselineScore >= 0.45)
  ) {
    status = WEAK;
  }
  if (
    hasBehaviorCandidate
    || hasBaselineCandidate
  ) {
    status = CANDIDATE;
  }
  if (
    (hasBehaviorFacts && switchChurn >= 12 && churnPerEntrance >= 1.8)
    || (baselineConfidence >= 0.5 && baselineScore >= 0.78)
  ) {
    status = STRONG;
  }

  return profileEntry({
    id: 'switch_churn',
    status,
    strength: Math.max(clamp(churnPerEntrance / 2, 0, 1), baselineScore),
    canEmitAtomic: statusAtLeast(status, CANDIDATE),
    canSupportComposite: statusAtLeast(status, WEAK),
    evidence: {
      hasBehaviorFacts,
      hasBehaviorCandidate,
      hasBaselineCandidate,
      switchIns,
      switchOuts,
      switchChurn,
      entranceCount,
      churnPerEntrance: Number(churnPerEntrance.toFixed(4)),
      behaviorSwitchIns,
      behaviorSwitchOuts,
      behaviorSwitchChurn,
      behaviorChurnPerEntrance: Number(behaviorChurnPerEntrance.toFixed(4)),
      baselineSwitchIns,
      baselineSwitchOuts,
      baselineSwitchChurn: toCount(switchChurnMetric?.currentValue),
      baselineScore: Number(baselineScore.toFixed(4)),
      baselineConfidence: Number(baselineConfidence.toFixed(4)),
    },
    criteria: {
      weak: 'switchChurn>=4 and churnPerEntrance>=0.7, or baseline score>=0.45',
      candidate: 'switchChurn>=8 and churnPerEntrance>=1.2, or baseline score>=0.6',
      strong: 'switchChurn>=12 and churnPerEntrance>=1.8, or baseline score>=0.78',
    },
    caveats: hasBehaviorFacts ? [] : ['behavior_facts_unavailable_baseline_only'],
    authorityKeys: ['switchBackWithin10m'],
  });
}

function buildSessionFragmentationEvidence({ featureVector, facts, personalBaseline }) {
  const session = resolveSessionShape(featureVector, facts);
  const metricScores = resolveSitePullPersonalBaselineMetricScores(personalBaseline);
  const baselineScore = clamp01(metricScores?.shortSessionAnomalyScore);
  const baselineConfidence = clamp01(metricScores?.sessionConfidence);
  const caveats = [];
  if (!session.hasMeasuredSessionFacts && session.hasSessionFacts) caveats.push('estimated_session_shape');
  if (session.maxSessionMs >= 10 * SITE_PULL_MINUTE_MS && session.shortSessionCount >= 2) {
    caveats.push('long_session_mixed_in');
  }
  let status = ABSENT;
  if (session.sessionCount > 0 || baselineScore > 0) status = OBSERVED;
  if (
    (session.hasMeasuredSessionFacts
      && session.sessionCount >= 4
      && session.shortSessionCount >= 2
      && session.shortSessionRate >= 0.4)
    || (baselineConfidence >= 0.25 && baselineScore >= 0.4)
  ) {
    status = WEAK;
  }
  if (
    (session.hasMeasuredSessionFacts
      && session.sessionCount >= 6
      && session.shortSessionCount >= 4
      && session.shortSessionRate >= 0.55)
    || (session.hasMeasuredSessionFacts && session.sessionCount >= 6 && session.shortSessionCount >= 4
      && baselineConfidence >= 0.35 && baselineScore >= 0.6)
  ) {
    status = CANDIDATE;
  }
  if (
    (session.hasMeasuredSessionFacts
      && session.sessionCount >= 8
      && session.shortSessionCount >= 6
      && session.shortSessionRate >= 0.7)
    || (session.hasMeasuredSessionFacts && session.sessionCount >= 8 && session.shortSessionCount >= 6
      && baselineConfidence >= 0.5 && baselineScore >= 0.78)
  ) {
    status = STRONG;
  }

  return profileEntry({
    id: 'session_fragmentation',
    status,
    strength: Math.max(session.shortSessionRate, baselineScore),
    canEmitAtomic: session.hasMeasuredSessionFacts && statusAtLeast(status, CANDIDATE),
    canSupportComposite: session.hasMeasuredSessionFacts && statusAtLeast(status, WEAK),
    evidence: {
      hasSessionFacts: session.hasSessionFacts,
      sessionBasis: session.sessionBasis,
      evidenceFamilyIds: session.hasMeasuredSessionFacts ? ['session_duration'] : [],
      hasMeasuredSessionFacts: session.hasMeasuredSessionFacts,
      sessionCount: session.sessionCount,
      shortSessionCount: session.shortSessionCount,
      shortSessionRate: Number(session.shortSessionRate.toFixed(4)),
      averageSessionMs: Math.round(session.averageSessionMs),
      maxSessionMs: Math.round(session.maxSessionMs),
      baselineScore: Number(baselineScore.toFixed(4)),
      baselineConfidence: Number(baselineConfidence.toFixed(4)),
      longSessionMixedIn: caveats.includes('long_session_mixed_in'),
    },
    criteria: {
      weak: 'sessionCount>=4 and shortSessionCount>=2 and shortRate>=0.4',
      candidate: 'sessionCount>=6 and shortSessionCount>=4 and shortRate>=0.55',
      strong: 'sessionCount>=8 and shortSessionCount>=6 and shortRate>=0.7',
    },
    caveats,
    authorityKeys: ['shortSessionCount'],
  });
}

function buildShortSessionLoopEvidence({ featureVector, facts, personalBaseline }) {
  const fragmentation = buildSessionFragmentationEvidence({ featureVector, facts, personalBaseline });
  return profileEntry({
    ...fragmentation,
    id: 'short_session_loop',
    canEmitAtomic: false,
    canSupportComposite: fragmentation.canSupportComposite,
  });
}

function buildDistributedVisitsEvidence({ facts, personalBaseline }) {
  const entryShape = resolveEntryShape(facts);
  const {
    todayVisits,
    visitHourCount,
    maxHourlyVisits,
    rolling2hVisits,
  } = entryShape;
  const visitSpreadRate = todayVisits > 0 ? visitHourCount / Math.min(todayVisits, 8) : 0;
  const visitDensityScore = Math.max(
    clamp01(todayVisits / 10),
    clamp01(rolling2hVisits / 5),
  );
  const metricScores = resolveSitePullPersonalBaselineMetricScores(personalBaseline);
  const baselineScore = clamp01(metricScores?.visitAnomalyScore);
  const baselineConfidence = clamp01(metricScores?.loopConfidence);
  let status = ABSENT;
  if (todayVisits > 0 || baselineScore > 0) status = OBSERVED;
  if (
    (todayVisits >= 4 && visitHourCount >= 2)
    || (baselineConfidence >= 0.25 && baselineScore >= 0.4)
  ) {
    status = WEAK;
  }
  if (
    (todayVisits >= 6 && (visitHourCount >= 3 || rolling2hVisits >= 5))
    || (baselineConfidence >= 0.35 && baselineScore >= 0.6)
  ) {
    status = CANDIDATE;
  }
  if (
    (todayVisits >= 9 && (visitHourCount >= 4 || rolling2hVisits >= 7))
    || (baselineConfidence >= 0.5 && baselineScore >= 0.78)
  ) {
    status = STRONG;
  }

  return profileEntry({
    id: 'distributed_visits',
    status,
    strength: Math.max(visitSpreadRate, visitDensityScore, baselineScore),
    canEmitAtomic: false,
    canSupportComposite: statusAtLeast(status, WEAK),
    evidence: {
      todayVisits,
      visitHourCount,
      maxHourlyVisits,
      rolling2hVisits,
      visitSpreadRate: Number(visitSpreadRate.toFixed(4)),
      visitDensityScore: Number(visitDensityScore.toFixed(4)),
      baselineScore: Number(baselineScore.toFixed(4)),
      baselineConfidence: Number(baselineConfidence.toFixed(4)),
    },
    criteria: {
      weak: 'todayVisits>=4 and visitHourCount>=2',
      candidate: 'todayVisits>=6 and (visitHourCount>=3 or rolling2hVisits>=5)',
      strong: 'todayVisits>=9 and (visitHourCount>=4 or rolling2hVisits>=7)',
    },
    caveats: visitHourCount <= 1 && rolling2hVisits > 0 ? ['hourly_bucket_resolution'] : [],
  });
}

function buildPrimaryCheckingPressureEvidence({
  checkingLoop,
  quickReturn,
  switchChurn,
  shortSessionLoop,
  distributedVisits,
}) {
  const pressureEntries = [
    ['checking_loop', checkingLoop],
    ['quick_return', quickReturn],
    ['switch_churn', switchChurn],
    ['short_session_loop', shortSessionLoop],
  ];
  const supportEntries = [
    ...pressureEntries,
    ['distributed_visits', distributedVisits],
  ];
  const candidateIds = pressureEntries
    .filter(([, entry]) => statusAtLeast(entry?.status, CANDIDATE))
    .map(([id]) => id);
  const supportIds = supportEntries
    .filter(([, entry]) => entry?.canSupportComposite)
    .map(([id]) => id);
  const strongestStatus = pressureEntries.reduce((current, [, entry]) => (
    statusAtLeast(entry?.status, current) ? entry.status : current
  ), ABSENT);
  const status = candidateIds.length > 0
    ? strongestStatus
    : supportIds.length >= 2
      ? WEAK
      : supportIds.length >= 1
        ? OBSERVED
        : ABSENT;

  return profileEntry({
    id: 'primary_checking_pressure',
    status,
    strength: Math.max(
      ...pressureEntries.map(([, entry]) => toNumber(entry?.strength)),
      statusStrength(status),
    ),
    canEmitAtomic: false,
    canSupportComposite: statusAtLeast(status, WEAK),
    evidence: {
      candidateIds,
      supportIds,
      candidateCount: candidateIds.length,
      supportCount: supportIds.length,
    },
    criteria: {
      weak: 'two supporting checking pressure atoms',
      candidate: 'at least one checking pressure atom reaches candidate',
      strong: 'at least one checking pressure atom reaches strong',
    },
  });
}

function buildNavigationEvidence({ facts }) {
  const metrics = buildSitePullNavigationIntentMetrics({ facts });
  const {
    hasNavigationFacts,
    directEntryCount,
    reloadCount,
    directEntryShare,
    reloadShare,
    navigationDenominator,
  } = metrics;

  const entryStatus = !hasNavigationFacts || directEntryCount <= 0
    ? ABSENT
    : (
      (directEntryCount >= 5 && directEntryShare >= 0.45)
      || (directEntryCount >= 4 && directEntryShare >= 0.65)
    )
      ? STRONG
      : (
        (directEntryCount >= 3 && directEntryShare >= 0.35)
        || (directEntryCount >= 2 && directEntryShare >= 0.55)
      )
        ? CANDIDATE
        : (
          (directEntryCount >= 2 && directEntryShare >= 0.2)
          || (directEntryCount >= 1 && directEntryShare >= 0.25)
        )
          ? WEAK
          : OBSERVED;

  const reloadStatus = !hasNavigationFacts || reloadCount <= 0
    ? ABSENT
    : (
      (reloadCount >= 5 && reloadShare >= 0.35)
      || (reloadCount >= 4 && reloadShare >= 0.5)
    )
      ? STRONG
      : (
        (reloadCount >= 3 && reloadShare >= 0.25)
        || (reloadCount >= 2 && reloadShare >= 0.45)
      )
        ? CANDIDATE
        : (
          (reloadCount >= 2 && reloadShare >= 0.15)
          || (reloadCount >= 1 && reloadShare >= 0.3)
        )
          ? WEAK
          : OBSERVED;

  return {
    habitualEntry: profileEntry({
      id: 'habitual_entry',
      status: entryStatus,
      strength: directEntryShare,
      canEmitAtomic: statusAtLeast(entryStatus, CANDIDATE),
      canSupportComposite: statusAtLeast(entryStatus, WEAK),
      evidence: {
        hasNavigationFacts,
        typedEntrances: directEntryCount,
        rawTypedEntrances: metrics.typedCount,
        addressBarEntrances: metrics.addressBarCount,
        keywordEntrances: metrics.keywordCount,
        rawTotalNavigations: metrics.rawTotalNavigations,
        totalNavigations: navigationDenominator,
        navigationDenominator,
        primaryNavigationCount: metrics.primaryNavigationCount,
        directEntryShare: Number(directEntryShare.toFixed(4)),
      },
      criteria: {
        weak: 'directEntryCount>=2 and share>=0.2, or directEntryCount>=1 and share>=0.25',
        candidate: 'directEntryCount>=3 and share>=0.35, or directEntryCount>=2 and share>=0.55',
        strong: 'directEntryCount>=5 and share>=0.45, or directEntryCount>=4 and share>=0.65',
      },
    }),
    reloadChecking: profileEntry({
      id: 'reload_checking',
      status: reloadStatus,
      strength: reloadShare,
      canEmitAtomic: statusAtLeast(reloadStatus, CANDIDATE),
      canSupportComposite: statusAtLeast(reloadStatus, WEAK),
      evidence: {
        hasNavigationFacts,
        reloads: reloadCount,
        rawTotalNavigations: metrics.rawTotalNavigations,
        totalNavigations: navigationDenominator,
        navigationDenominator,
        primaryNavigationCount: metrics.primaryNavigationCount,
        reloadShare: Number(reloadShare.toFixed(4)),
      },
      criteria: {
        weak: 'reloads>=2 and share>=0.15, or reloads>=1 and share>=0.3',
        candidate: 'reloads>=3 and share>=0.25, or reloads>=2 and share>=0.45',
        strong: 'reloads>=5 and share>=0.35, or reloads>=4 and share>=0.5',
      },
    }),
  };
}

export function isSitePullEvidenceStatusAtLeast(status, floor) {
  return statusAtLeast(status, floor);
}

export function buildSitePullCheckingEvidenceProfile({
  featureVector = {},
  subscores = {},
  facts = {},
  personalBaseline = null,
  tabContextEvidenceProfile = null,
} = {}) {
  const navigationEvidence = buildNavigationEvidence({ facts });
  const tabEvidence = (tabContextEvidenceProfile === null
    ? buildSitePullTabContextEvidenceProfile({ facts }) : tabContextEvidenceProfile).primitives;
  const checkingLoop = buildCheckingLoopEvidence({ facts, subscores });
  const quickReturn = buildQuickReturnEvidence({ facts, personalBaseline });
  const switchChurn = buildSwitchChurnEvidence({ facts, personalBaseline });
  const sessionFragmentation = buildSessionFragmentationEvidence({ featureVector, facts, personalBaseline });
  const shortSessionLoop = buildShortSessionLoopEvidence({ featureVector, facts, personalBaseline });
  const distributedVisits = buildDistributedVisitsEvidence({ facts, personalBaseline });
  return {
    version: SITE_PULL_CHECKING_EVIDENCE_PROFILE_VERSION,
    statusSemantics: {
      [ABSENT]: 'No usable local evidence for this primitive.',
      [OBSERVED]: 'A signal exists but is too small to influence labels by itself.',
      [WEAK]: 'Meaningful supporting evidence; preserve for diagnostics and composites, but do not emit a direct label.',
      [CANDIDATE]: 'Enough evidence to emit an atomic label candidate, subject to requirements and calibration.',
      [STRONG]: 'High-confidence evidence that can support composite dominance or stronger copy.',
    },
    counterAuthority: SITE_PULL_CHECKING_COUNTER_AUTHORITY,
    checkingLoop,
    quickReturn,
    switchChurn,
    sessionFragmentation,
    shortSessionLoop,
    distributedVisits,
    primaryCheckingPressure: buildPrimaryCheckingPressureEvidence({
      checkingLoop,
      quickReturn,
      switchChurn,
      shortSessionLoop,
      distributedVisits,
    }),
    ...navigationEvidence,
    ...tabEvidence,
  };
}
