const MINUTE_MS = 60000;

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toPositiveMinutes(ms) {
  return Math.max(0, Math.round(toFiniteNumber(ms) / MINUTE_MS));
}

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function cleanSupportingFact(fact) {
  if (!fact || typeof fact !== 'object') return null;
  const id = cleanString(fact.id);
  if (!id) return null;
  const value = fact.value;
  if (
    value !== null
    && typeof value !== 'string'
    && typeof value !== 'number'
    && typeof value !== 'boolean'
    && typeof value !== 'object'
  ) {
    return null;
  }
  return {
    id,
    value,
  };
}

function cleanPattern(pattern) {
  if (!pattern || typeof pattern !== 'object') return null;
  const id = cleanString(pattern.id);
  if (!id) return null;
  return {
    id,
    family: cleanString(pattern.family, 'baseline'),
    severity: cleanString(pattern.severity, 'neutral'),
    score: toFiniteNumber(pattern.score),
    confidence: toFiniteNumber(pattern.confidence),
    summaryCode: cleanString(pattern.summaryCode),
  };
}

function buildFromSiteInsightModel(siteInsightModel) {
  const featureSummary = siteInsightModel?.featureSummary && typeof siteInsightModel.featureSummary === 'object'
    ? siteInsightModel.featureSummary
    : {};
  const primaryInsight = siteInsightModel?.primaryInsight && typeof siteInsightModel.primaryInsight === 'object'
    ? siteInsightModel.primaryInsight
    : {};
  const supportingFacts = Array.isArray(primaryInsight.supportingFacts)
    ? primaryInsight.supportingFacts.map(cleanSupportingFact).filter(Boolean).slice(0, 8)
    : [];
  const topPatterns = Array.isArray(siteInsightModel?.patterns)
    ? siteInsightModel.patterns.map(cleanPattern).filter(Boolean).slice(0, 5)
    : [];

  return {
    sourceKind: 'siteInsightModel',
    engineVersion: cleanString(siteInsightModel?.engineVersion),
    depth: cleanString(siteInsightModel?.depth),
    mode: cleanString(siteInsightModel?.mode),
    featureSummary: {
      domain: cleanString(featureSummary.domain),
      type: cleanString(featureSummary.type, 'unmanaged'),
      goalMinutes: Math.max(0, Math.round(toFiniteNumber(featureSummary.goalMinutes))),
      todayTotalMinutes: toPositiveMinutes(featureSummary.todayTotalMs),
      weeklyAverageMinutes: toPositiveMinutes(featureSummary.weeklyAverageMs),
      usageRatio: toFiniteNumber(featureSummary.usageRatio),
      trendDirection: cleanString(featureSummary.trendDirection, 'flat'),
      trendRatio: toFiniteNumber(featureSummary.trendRatio, 1),
      dominantTodayWindow: featureSummary.dominantTodayWindow || null,
      dominantTodayShare: toFiniteNumber(featureSummary.dominantTodayShare),
    },
    primaryInsight: {
      id: cleanString(primaryInsight.id),
      family: cleanString(primaryInsight.family, 'baseline'),
      severity: cleanString(primaryInsight.severity, 'neutral'),
      score: toFiniteNumber(primaryInsight.score),
      confidence: toFiniteNumber(primaryInsight.confidence),
      summaryCode: cleanString(primaryInsight.summaryCode),
      recommendedActionId: cleanString(primaryInsight.recommendedAction?.id),
      supportingFacts,
    },
    topPatterns,
  };
}

function buildHomeRecentTrajectoryProjection(homeScanSnapshot) {
  const trajectory = homeScanSnapshot?.recentTrajectory;
  if (!trajectory || typeof trajectory !== 'object') return null;
  const referenceState = cleanString(trajectory?.reference?.state, 'missing');
  const hasReference = referenceState === 'zero' || referenceState === 'positive';
  return {
    version: cleanString(trajectory.version),
    role: cleanString(trajectory.role),
    grain: cleanString(trajectory.grain),
    status: cleanString(trajectory?.evidence?.status, 'sparse'),
    provenanceSource: cleanString(trajectory?.provenance?.source),
    windowKind: cleanString(trajectory?.window?.kind),
    targetDays: Math.max(0, Math.floor(toFiniteNumber(trajectory?.window?.targetDays))),
    observedDays: Math.max(0, Math.floor(toFiniteNumber(trajectory?.window?.observedDays))),
    missingDays: Math.max(0, Math.floor(toFiniteNumber(trajectory?.evidence?.missingDays))),
    zeroDays: Math.max(0, Math.floor(toFiniteNumber(trajectory?.evidence?.zeroDays))),
    excludeCurrent: trajectory.excludeCurrent === true,
    referenceState,
    recentAverageMinutes: hasReference
      ? toPositiveMinutes(trajectory?.reference?.weightedDailyAverageMs)
      : null,
    deltaMinutes: hasReference
      ? Math.round(toFiniteNumber(trajectory?.comparison?.deltaMs) / MINUTE_MS)
      : null,
  };
}

function buildFromHomeScanSnapshot(homeScanSnapshot) {
  const peakWindow = homeScanSnapshot?.peakWindow && typeof homeScanSnapshot.peakWindow === 'object'
    ? homeScanSnapshot.peakWindow
    : null;
  const recentTrajectory = buildHomeRecentTrajectoryProjection(homeScanSnapshot);
  return {
    sourceKind: 'homeScanSnapshot',
    focusDomain: cleanString(homeScanSnapshot?.focusDomain),
    focusUsedMinutes: toPositiveMinutes(homeScanSnapshot?.focusUsedMs),
    focusGoalMinutes: Math.max(0, Math.round(toFiniteNumber(homeScanSnapshot?.focusGoalMinutes))),
    recentTrajectory,
    recentAverageMinutes: recentTrajectory?.recentAverageMinutes ?? null,
    deltaMinutes: recentTrajectory?.deltaMinutes ?? null,
    peakWindow: peakWindow
      ? {
          label: cleanString(peakWindow.label),
          activeMinutes: toPositiveMinutes(peakWindow.activeMs),
        }
      : null,
    riskTone: cleanString(homeScanSnapshot?.riskTone, 'muted'),
    riskLabel: cleanString(homeScanSnapshot?.riskLabel),
    reasons: Array.isArray(homeScanSnapshot?.reasons)
      ? homeScanSnapshot.reasons.map((reason) => cleanString(reason)).filter(Boolean).slice(0, 4)
      : [],
    brief: homeScanSnapshot?.brief && typeof homeScanSnapshot.brief === 'object'
      ? {
          statusLabel: cleanString(homeScanSnapshot.brief.statusLabel),
          verdict: cleanString(homeScanSnapshot.brief.verdict),
          supportingText: cleanString(homeScanSnapshot.brief.supportingText),
        }
      : null,
  };
}

export function buildUsageInsightNarrationInput({
  siteInsightModel = null,
  homeScanSnapshot = null,
} = {}) {
  if (siteInsightModel && typeof siteInsightModel === 'object') {
    return buildFromSiteInsightModel(siteInsightModel);
  }
  if (homeScanSnapshot && typeof homeScanSnapshot === 'object') {
    return buildFromHomeScanSnapshot(homeScanSnapshot);
  }
  throw new Error('Usage insight narration requires a siteInsightModel or homeScanSnapshot input.');
}
