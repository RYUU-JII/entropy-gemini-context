import {
  SITE_PULL_PATTERN_CATEGORIES,
  createSitePullPatternSignal,
} from '../sitePullPatternContracts.js';
import {
  clamp,
  toNumber,
} from '../patternUtils.js';
import {
  SITE_PULL_EVIDENCE_STATUS,
} from '../sitePullCheckingEvidenceProfile.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  getSitePullPersonalBaselineMetric,
} from '../../personalBaselineMetrics.js';
import { requireSitePullDetectorEvidenceProfile } from './detectorEvidenceProfiles.js';

function scoreQuickReturnImpulse(evidence = {}) {
  const impulseScore = toNumber(evidence.impulseReentryScore);
  if (impulseScore > 0) return clamp(impulseScore * 100, 0, 100);
  return clamp(toNumber(evidence.quickReturnRate) * 100, 0, 100);
}

export function detectCheckingPatterns({
  personalBaseline,
  checkingEvidenceProfile = null,
}) {
  const signals = [];
  const profile = requireSitePullDetectorEvidenceProfile(checkingEvidenceProfile, 'checking');
  const checkingLoop = profile.checkingLoop;
  const quickReturn = profile.quickReturn;
  const switchChurn = profile.switchChurn;
  const quickReturnRateMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.QUICK_RETURN_RATE,
  );
  const switchChurnMetric = getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.SWITCH_CHURN_COUNT,
  );

  if (checkingLoop?.canEmitAtomic) {
    const hasVisits = checkingLoop.id === 'checking_loop';
    signals.push(createSitePullPatternSignal({
      id: hasVisits ? 'checking_pattern' : 'checking_pattern_proxy',
      category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
      severity: 'watch',
      tone: 'neutral',
      score: toNumber(checkingLoop.evidence?.checkingScore) * 100,
      confidence: hasVisits ? 0.72 : 0.48,
      evidence: {
        evidenceWindow: 'today',
        todayVisits: checkingLoop.evidence.todayVisits,
        activeHoursToday: checkingLoop.evidence.activeHoursToday,
        visitHoursToday: checkingLoop.evidence.visitHoursToday,
        activeHoursHabit: checkingLoop.evidence.activeHoursHabit,
        evidenceStatus: checkingLoop.status,
      },
    }));
  }
  if (quickReturn?.canEmitAtomic && quickReturn.evidence.hasBehaviorCandidate) {
    signals.push(createSitePullPatternSignal({
      id: 'quick_return_loop',
      category: SITE_PULL_PATTERN_CATEGORIES.ROUTE,
      severity: 'watch',
      tone: quickReturn.status === SITE_PULL_EVIDENCE_STATUS.STRONG ? 'warning' : 'neutral',
      score: scoreQuickReturnImpulse(quickReturn.evidence),
      confidence: Math.max(toNumber(quickReturn.evidence.baselineConfidence), 0.5),
      evidence: {
        evidenceWindow: 'today',
        todaySwitchBackWithin10m: quickReturn.evidence.switchBackWithin10m,
        todaySwitchIns: quickReturn.evidence.switchIns,
        todayQuickReturnRate: quickReturn.evidence.quickReturnRate,
        impulseReentryScore: quickReturn.evidence.impulseReentryScore,
        impulseWeightedSwitchCount: quickReturn.evidence.impulseWeightedSwitchCount,
        impulseReentryRate: quickReturn.evidence.impulseReentryRate,
        impulseBucketMode: quickReturn.evidence.impulseBucketMode,
        impulseSwitchBuckets: quickReturn.evidence.impulseSwitchBuckets,
        quickReturnRateP75: toNumber(quickReturnRateMetric?.stats?.p75Reference),
        confidence: Math.max(toNumber(quickReturn.evidence.baselineConfidence), 0.5),
        evidenceStatus: quickReturn.status,
      },
    }));
  }
  if (switchChurn?.canEmitAtomic && switchChurn.evidence.hasBehaviorCandidate) {
    signals.push(createSitePullPatternSignal({
      id: 'switch_churn_loop',
      category: SITE_PULL_PATTERN_CATEGORIES.ROUTE,
      severity: 'watch',
      tone: 'neutral',
      score: clamp(toNumber(switchChurn.evidence.churnPerEntrance) * 35, 0, 100),
      confidence: Math.max(toNumber(switchChurn.evidence.baselineConfidence), 0.5),
      evidence: {
        evidenceWindow: 'today',
        todaySwitchChurn: switchChurn.evidence.switchChurn,
        switchChurnP75: toNumber(switchChurnMetric?.stats?.p75Reference),
        todayVsSwitchChurnP75Ratio: toNumber(switchChurnMetric?.anomaly?.ratio),
        confidence: Math.max(toNumber(switchChurn.evidence.baselineConfidence), 0.5),
        evidenceStatus: switchChurn.status,
      },
    }));
  }
  return signals;
}

export function detectTransitionEdgePatterns({
  routePressureEvidenceProfile = null,
}) {
  const profile = requireSitePullDetectorEvidenceProfile(routePressureEvidenceProfile, 'route_pressure');
  const evidence = profile.evidence || {};
  const signals = [];

  if (
    profile.pairLoop?.canEmitAtomic
    && evidence.topPairCount >= 2
    && evidence.topPairFromDomain
    && evidence.topPairToDomain
  ) {
    signals.push(createSitePullPatternSignal({
      id: 'domain_pair_loop',
      category: SITE_PULL_PATTERN_CATEGORIES.ROUTE,
      severity: 'watch',
      tone: 'neutral',
      score: profile.pairLoop.strength * 100,
      confidence: profile.confidence,
      evidence: {
        evidenceWindow: 'today',
        ...evidence,
        fromDomain: evidence.topPairFromDomain,
        toDomain: evidence.topPairToDomain,
        count: Math.floor(toNumber(evidence.topPairCount)),
        returnWithin10m: Math.floor(toNumber(evidence.topPairReturnWithin10m)),
      },
      source: 'transition_edges',
    }));
  }

  if (profile.protectedReturn?.canEmitAtomic && evidence.targetDomain && evidence.topIncomingFromDomain) {
    signals.push(createSitePullPatternSignal({
      id: 'protected_route_return',
      category: SITE_PULL_PATTERN_CATEGORIES.ROUTE,
      severity: 'watch',
      tone: 'neutral',
      score: profile.protectedReturn.strength * 100,
      confidence: profile.confidence,
      evidence: {
        evidenceWindow: 'today',
        ...evidence,
        fromDomain: evidence.topIncomingFromDomain,
        count: Math.floor(toNumber(evidence.incomingCount)),
        returnWithin10m: Math.floor(toNumber(evidence.incomingReturnWithin10m)),
        distinctReturnEdgeCount: Math.floor(toNumber(evidence.incomingDistinctEdgeCount)),
      },
      source: 'transition_edges',
    }));
  }
  return signals;
}
