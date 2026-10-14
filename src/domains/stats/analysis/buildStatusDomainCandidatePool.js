import { isHostnameInList } from '../../../lib/index.js';
import { requireRollingPressureRecentTrajectory } from './rollingPressureModel.js';

const DEFAULT_FALLBACK_GOAL_MINUTES = 60;
const MAX_SIGNAL_SCANNER_TARGET_COUNT = 6;
const MINUTE_MS = 60_000;
export const DEFAULT_VISIBLE_DOMAIN_COUNT = 6;
export const DEFAULT_PROTECTED_VISIBLE_DOMAIN_FLOOR = 3;
export const DEFAULT_RECOMMENDED_VISIBLE_DOMAIN_FLOOR = 1;
export const STATUS_DOMAIN_CANDIDATE_DISPOSITIONS = Object.freeze({
  PROTECTED: 'protected',
  MANAGED_ALLOWED: 'managed_allowed',
  RECOMMENDED: 'recommended',
  UNMANAGED: 'unmanaged',
});
const RECOMMENDED_RISK_THRESHOLD = 0.65;
const RECOMMENDED_TREND_RATIO_THRESHOLD = 1.35;
const RECOMMENDED_VOLATILITY_THRESHOLD = 0.45;
const RECOMMENDED_SELECTION_SCORE_THRESHOLD = 6;

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const roundNumber = (value, digits = 3, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Number(numeric.toFixed(digits));
};

const clampNumber = (value, min, max, fallback = min) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const normalizeDomain = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const resolvePositiveInteger = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
};

const readDomainUsageOverrideMs = (usageByDomain, domain) => {
  if (!domain || !usageByDomain || typeof usageByDomain !== 'object') return null;
  if (!hasOwn(usageByDomain, domain)) return null;
  return Math.max(0, toNumber(usageByDomain[domain]));
};

export const resolveVisibleDomainCandidateUsageMs = (candidate = null, {
  usageByDomain = null,
} = {}) => {
  const domain = normalizeDomain(candidate?.domain);
  const usageOverrideMs = readDomainUsageOverrideMs(usageByDomain, domain);
  if (usageOverrideMs !== null) return usageOverrideMs;

  const usageKeys = [
    'weightedPressureMs',
    'pressureMs',
    'visiblePressureMs',
    'activeMs',
    'visibleUsageMs',
    'rawWindowMs',
    'cycleActiveMs',
    'rhythmActiveMs',
    'todayActiveMs',
    'windowActiveMs',
  ];
  for (const key of usageKeys) {
    const usageMs = Math.max(0, toNumber(candidate?.[key]));
    if (usageMs > 0) return usageMs;
  }
  return 0;
};

export const isVisibleProtectedDomainCandidate = (candidate = null) => {
  const cohort = typeof candidate?.cohort === 'string' ? candidate.cohort.trim().toLowerCase() : '';
  return candidate?.blocked === true
    || candidate?.policyStatus === 'blocked'
    || cohort === 'blocked';
};

export const isProtectionRecommendedDomainCandidate = (candidate = null) => {
  if (!candidate || isVisibleProtectedDomainCandidate(candidate)) return false;
  const cohort = typeof candidate?.cohort === 'string' ? candidate.cohort.trim().toLowerCase() : '';
  const unmanaged = candidate?.managed === false || cohort === 'unmanaged';
  if (!unmanaged) return false;
  return clampNumber(candidate?.risk, 0, 1.2, 0) >= RECOMMENDED_RISK_THRESHOLD
    || Math.max(0, toNumber(candidate?.trendRatio)) >= RECOMMENDED_TREND_RATIO_THRESHOLD
    || clampNumber(candidate?.volatility, 0, 1.5, 0) >= RECOMMENDED_VOLATILITY_THRESHOLD
    || Math.max(0, Math.floor(toNumber(candidate?.overLimitDays))) > 0
    || Math.max(0, toNumber(candidate?.selectionScore)) >= RECOMMENDED_SELECTION_SCORE_THRESHOLD;
};

export const resolveStatusDomainCandidateDisposition = (candidate = null) => {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('STATUS_DOMAIN_CANDIDATE_DISPOSITION_INPUT_INVALID');
  }
  if (isVisibleProtectedDomainCandidate(candidate)) {
    return STATUS_DOMAIN_CANDIDATE_DISPOSITIONS.PROTECTED;
  }
  const cohort = typeof candidate?.cohort === 'string' ? candidate.cohort.trim().toLowerCase() : '';
  if (candidate?.managed === true || cohort === 'managed' || candidate?.policyStatus === 'managed') {
    return STATUS_DOMAIN_CANDIDATE_DISPOSITIONS.MANAGED_ALLOWED;
  }
  if (isProtectionRecommendedDomainCandidate(candidate)) {
    return STATUS_DOMAIN_CANDIDATE_DISPOSITIONS.RECOMMENDED;
  }
  return STATUS_DOMAIN_CANDIDATE_DISPOSITIONS.UNMANAGED;
};

const compareVisibleDomainCandidates = (left, right) => {
  const usageDiff = toNumber(right?.visibleUsageMs) - toNumber(left?.visibleUsageMs);
  if (usageDiff !== 0) return usageDiff;
  const pressureDiff = toNumber(right?.weightedPressureMs) - toNumber(left?.weightedPressureMs);
  if (pressureDiff !== 0) return pressureDiff;
  const protectedDiff = Number(isVisibleProtectedDomainCandidate(right)) - Number(isVisibleProtectedDomainCandidate(left));
  if (protectedDiff !== 0) return protectedDiff;
  const scoreDiff = toNumber(right?.selectionScore) - toNumber(left?.selectionScore);
  if (scoreDiff !== 0) return scoreDiff;
  const riskDiff = toNumber(right?.risk) - toNumber(left?.risk);
  if (riskDiff !== 0) return riskDiff;
  return String(left?.domain || '').localeCompare(String(right?.domain || ''));
};

const normalizeVisibleDomainCandidate = (candidate = null, {
  usageByDomain = null,
} = {}) => {
  const domain = normalizeDomain(candidate?.domain);
  if (!domain) return null;
  const visibleUsageMs = resolveVisibleDomainCandidateUsageMs(candidate, { usageByDomain });
  if (visibleUsageMs <= 0) return null;
  return {
    ...candidate,
    domain,
    visibleUsageMs,
  };
};

const buildVisibleDomainCandidatePool = (domainCandidates = [], {
  usageByDomain = null,
} = {}) => {
  if (!Array.isArray(domainCandidates)) return [];
  const candidateByDomain = new Map();
  domainCandidates.forEach((candidate) => {
    const normalized = normalizeVisibleDomainCandidate(candidate, { usageByDomain });
    if (!normalized) return;
    const current = candidateByDomain.get(normalized.domain);
    if (!current || compareVisibleDomainCandidates(normalized, current) < 0) {
      candidateByDomain.set(normalized.domain, normalized);
    }
  });
  return Array.from(candidateByDomain.values()).sort(compareVisibleDomainCandidates);
};

const findWeakestReplacementIndex = (selectedCandidates, canReplace) => {
  let weakestIndex = -1;
  for (let index = 0; index < selectedCandidates.length; index += 1) {
    const candidate = selectedCandidates[index];
    if (!canReplace(candidate)) continue;
    if (
      weakestIndex < 0
      || compareVisibleDomainCandidates(candidate, selectedCandidates[weakestIndex]) > 0
    ) {
      weakestIndex = index;
    }
  }
  return weakestIndex;
};

const addVisibleCandidateWithReplacement = ({
  candidate,
  selectedCandidates,
  selectedDomains,
  maxCount,
  canReplace,
} = {}) => {
  if (!candidate || selectedDomains.has(candidate.domain)) return false;
  if (selectedCandidates.length < maxCount) {
    selectedCandidates.push(candidate);
    selectedDomains.add(candidate.domain);
    return true;
  }
  const replacementIndex = findWeakestReplacementIndex(selectedCandidates, canReplace);
  if (replacementIndex < 0) return false;
  selectedDomains.delete(selectedCandidates[replacementIndex].domain);
  selectedCandidates[replacementIndex] = candidate;
  selectedDomains.add(candidate.domain);
  return true;
};

const ensureVisibleCandidateFloor = ({
  selectedCandidates,
  selectedDomains,
  candidatePool,
  maxCount,
  targetCount,
  isTargetCandidate,
  canReplace,
} = {}) => {
  const resolvedTargetCount = Math.min(maxCount, Math.max(0, Math.floor(Number(targetCount) || 0)));
  if (resolvedTargetCount <= 0) return;
  let currentCount = selectedCandidates.filter(isTargetCandidate).length;
  if (currentCount >= resolvedTargetCount) return;
  const eligibleCandidates = candidatePool.filter((candidate) => (
    isTargetCandidate(candidate) && !selectedDomains.has(candidate.domain)
  ));
  for (const candidate of eligibleCandidates) {
    if (currentCount >= resolvedTargetCount) break;
    const added = addVisibleCandidateWithReplacement({
      candidate,
      selectedCandidates,
      selectedDomains,
      maxCount,
      canReplace,
    });
    if (added) currentCount += 1;
  }
};

export function selectVisibleDomainCandidates(
  domainCandidates = [],
  {
    maxCount = DEFAULT_VISIBLE_DOMAIN_COUNT,
    protectedFloor = DEFAULT_PROTECTED_VISIBLE_DOMAIN_FLOOR,
    recommendedFloor = DEFAULT_RECOMMENDED_VISIBLE_DOMAIN_FLOOR,
    focusDomain = null,
    usageByDomain = null,
  } = {},
) {
  const resolvedMaxCount = resolvePositiveInteger(maxCount, DEFAULT_VISIBLE_DOMAIN_COUNT);
  if (resolvedMaxCount <= 0) return [];

  const candidatePool = buildVisibleDomainCandidatePool(domainCandidates, { usageByDomain });
  if (candidatePool.length <= 0) return [];

  const selectedCandidates = candidatePool.slice(0, resolvedMaxCount);
  const selectedDomains = new Set(selectedCandidates.map((candidate) => candidate.domain));
  const normalizedFocusDomain = normalizeDomain(focusDomain);
  const focusCandidate = normalizedFocusDomain
    ? candidatePool.find((candidate) => candidate.domain === normalizedFocusDomain) || null
    : null;

  if (focusCandidate && !selectedDomains.has(focusCandidate.domain)) {
    addVisibleCandidateWithReplacement({
      candidate: focusCandidate,
      selectedCandidates,
      selectedDomains,
      maxCount: resolvedMaxCount,
      canReplace: (candidate) => !isVisibleProtectedDomainCandidate(candidate),
    });
  }

  const protectedCandidateCount = candidatePool.filter(isVisibleProtectedDomainCandidate).length;
  ensureVisibleCandidateFloor({
    selectedCandidates,
    selectedDomains,
    candidatePool,
    maxCount: resolvedMaxCount,
    targetCount: Math.min(protectedCandidateCount, protectedFloor),
    isTargetCandidate: isVisibleProtectedDomainCandidate,
    canReplace: (candidate) => (
      !isVisibleProtectedDomainCandidate(candidate)
      && candidate?.domain !== normalizedFocusDomain
    ),
  });

  const recommendedCandidateCount = candidatePool.filter(isProtectionRecommendedDomainCandidate).length;
  ensureVisibleCandidateFloor({
    selectedCandidates,
    selectedDomains,
    candidatePool,
    maxCount: resolvedMaxCount,
    targetCount: Math.min(recommendedCandidateCount, recommendedFloor),
    isTargetCandidate: isProtectionRecommendedDomainCandidate,
    canReplace: (candidate) => (
      !isVisibleProtectedDomainCandidate(candidate)
      && !isProtectionRecommendedDomainCandidate(candidate)
      && candidate?.domain !== normalizedFocusDomain
    ),
  });

  return selectedCandidates
    .sort(compareVisibleDomainCandidates)
    .map((candidate, index) => ({
      ...candidate,
      visibleRank: index + 1,
    }));
}

const computeSignalScannerPolarHint = (domain, risk) => {
  const normalizedDist = 0.8 - (clampNumber(risk, 0, 1.2, 0) * 0.6);
  let hash = 0;
  for (let index = 0; index < domain.length; index += 1) {
    hash = domain.charCodeAt(index) + ((hash << 5) - hash);
  }
  const angle = Math.abs(hash % 360);
  return {
    rad: angle * (Math.PI / 180),
    dist: normalizedDist,
  };
};

const buildCandidatePriorityScore = ({
  risk = 0,
  todayActiveMs = 0,
  windowActiveMs = 0,
  recentAverageMs = 0,
  trajectoryDispersion = 0,
  blocked = false,
  managed = false,
  streakDays = 0,
  overLimitDays = 0,
} = {}) => {
  return roundNumber(
    (risk * 18)
    + Math.min(todayActiveMs / (12 * 60_000), 6)
    + Math.min(windowActiveMs / (18 * 60_000), 4)
    + Math.min(recentAverageMs / (12 * 60_000), 3)
    + Math.min(trajectoryDispersion * 6, 5)
    + (blocked ? 4 : 0)
    + (managed ? 1.5 : 0)
    + Math.min(streakDays, 5) * 0.45
    + Math.min(overLimitDays, 4) * 0.6,
    4,
    0,
  );
};

function buildPressureDomainMap(rollingPressure = null) {
  const domains = Array.isArray(rollingPressure?.domains) ? rollingPressure.domains : [];
  return new Map(
    domains
      .map((entry) => {
        const domain = normalizeDomain(entry?.domain);
        return domain ? [domain, entry] : null;
      })
      .filter(Boolean),
  );
}

function resolvePressureSelectionScore(pressureEntry = null) {
  const pressureMs = Math.max(0, toNumber(pressureEntry?.weightedPressureMs));
  if (pressureMs <= 0) return 0;
  return roundNumber(pressureMs / MINUTE_MS, 4, 0);
}

function projectCandidateTrajectorySignals(pressureEntry = null) {
  const recentTrajectory = pressureEntry?.recentTrajectory === null
    || typeof pressureEntry?.recentTrajectory === 'undefined'
    ? null
    : requireRollingPressureRecentTrajectory(pressureEntry.recentTrajectory);
  const weightedDailyAverageMs = recentTrajectory?.reference?.weightedDailyAverageMs;
  const trendRatioValue = recentTrajectory?.comparison?.trendRatio;
  const dispersionValue = recentTrajectory?.reference?.weightedRelativeDispersion;
  const referenceState = recentTrajectory?.reference?.state;
  const hasReference = referenceState === 'zero' || referenceState === 'positive';
  return {
    recentTrajectory,
    recentAverageMs: hasReference && Number.isFinite(weightedDailyAverageMs) && weightedDailyAverageMs >= 0
      ? weightedDailyAverageMs
      : null,
    trendRatio: hasReference && Number.isFinite(trendRatioValue) && trendRatioValue >= 0
      ? roundNumber(trendRatioValue, 3, 0)
      : null,
    trajectoryDispersion: hasReference && Number.isFinite(dispersionValue) && dispersionValue >= 0
      ? roundNumber(clampNumber(dispersionValue, 0, 1.5, 0), 3, 0)
      : null,
  };
}

export function buildStatusDomainCandidatePool({
  blockedUrls = [],
  allowedUrls = [],
  trackingExcludedUrls = [],
  siteDetails = {},
  todaySiteDetails = {},
  domainInsights = {},
  globalGoal = 0,
  siteGoals = {},
  rollingPressure = null,
  includeUnmanaged = true,
} = {}) {
  const blockedSet = new Set(Array.isArray(blockedUrls) ? blockedUrls.map(normalizeDomain).filter(Boolean) : []);
  const allowedSet = new Set(Array.isArray(allowedUrls) ? allowedUrls.map(normalizeDomain).filter(Boolean) : []);
  const normalizedTrackingExcludedUrls = Array.isArray(trackingExcludedUrls)
    ? trackingExcludedUrls.map(normalizeDomain).filter(Boolean)
    : [];
  const pressureByDomain = buildPressureDomainMap(rollingPressure);
  const domains = Array.from(
    new Set([
      ...Object.keys(siteDetails || {}),
      ...Object.keys(todaySiteDetails || {}),
      ...Object.keys(domainInsights || {}),
      ...Array.from(pressureByDomain.keys()),
      ...Array.from(blockedSet),
      ...Array.from(allowedSet),
      ...Object.keys(siteGoals || {}).map(normalizeDomain),
    ]),
  ).filter((domain) => domain && !isHostnameInList(domain, normalizedTrackingExcludedUrls));

  return domains
    .map((domain) => {
      const windowActiveMs = Math.max(0, toNumber(siteDetails?.[domain]));
      const todayActiveMs = Math.max(0, toNumber(todaySiteDetails?.[domain]));
      const insight = domainInsights?.[domain] && typeof domainInsights[domain] === 'object'
        ? domainInsights[domain]
        : null;
      const weeklyTotal = Math.max(0, toNumber(insight?.weeklyTotal));
      const scoreSetupRecentTrajectory = insight?.scoreSetupRecentTrajectory ?? null;
      const pressureEntry = pressureByDomain.get(domain) || null;
      const {
        recentTrajectory,
        recentAverageMs,
        trendRatio,
        trajectoryDispersion,
      } = projectCandidateTrajectorySignals(pressureEntry);
      const hasPressureInput = Boolean(pressureEntry);
      const rawWindowMs = Math.max(0, toNumber(pressureEntry?.rawWindowMs));
      const weightedPressureMs = Math.max(0, toNumber(pressureEntry?.weightedPressureMs));
      const pressureShare = clampNumber(pressureEntry?.pressureShare, 0, 1, 0);
      const pressureScore = resolvePressureSelectionScore(pressureEntry);
      const pressureRank = hasPressureInput && Number.isFinite(Number(pressureEntry?.pressureRank))
        ? Math.max(1, Math.floor(Number(pressureEntry.pressureRank)))
        : null;
      const activeDays = Math.max(0, Math.floor(toNumber(insight?.activeDays)));
      const streakDays = Math.max(0, Math.floor(toNumber(insight?.analysis?.streakDays ?? insight?.streakDays)));
      const overLimitDays = Math.max(0, Math.floor(toNumber(insight?.analysis?.overLimitDays ?? insight?.overLimitDays)));
      const goalMinutes = Math.max(
        0,
        Math.floor(toNumber(siteGoals?.[domain]) || toNumber(globalGoal) || DEFAULT_FALLBACK_GOAL_MINUTES),
      );
      const goalMs = Math.max(1, goalMinutes * 60_000);
      const blocked = blockedSet.has(domain);
      const managed = blocked || allowedSet.has(domain) || hasOwn(siteGoals, domain);
      const cohort = blocked ? 'blocked' : (managed ? 'managed' : 'unmanaged');
      const risk = roundNumber(clampNumber(windowActiveMs / goalMs, 0, 1.2, 0), 3, 0);
      const activitySelectionScore = buildCandidatePriorityScore({
        risk,
        todayActiveMs,
        windowActiveMs,
        recentAverageMs: recentAverageMs ?? 0,
        trajectoryDispersion: trajectoryDispersion ?? 0,
        blocked,
        managed,
        streakDays,
        overLimitDays,
      });
      const selectionScore = pressureScore > 0 ? pressureScore : activitySelectionScore;
      if (includeUnmanaged !== true && !managed) return null;

      return {
        domain,
        cohort,
        policyStatus: blocked ? 'blocked' : 'allowed',
        blocked,
        managed,
        windowActiveMs,
        rawWindowMs,
        weightedPressureMs,
        pressureShare,
        pressureScore,
        pressureRank,
        pressureBasis: hasPressureInput && typeof pressureEntry?.basis === 'string' ? pressureEntry.basis : null,
        pressureWindowDays: hasPressureInput ? Math.max(0, Math.floor(toNumber(pressureEntry?.windowDays))) : 0,
        hasPressureInput,
        todayActiveMs,
        recentTrajectory,
        recentAverageMs,
        weeklyTotal,
        scoreSetupRecentTrajectory,
        goalMinutes,
        risk,
        trendRatio,
        volatility: trajectoryDispersion,
        activeDays,
        streakDays,
        overLimitDays,
        selectionScore,
        activitySelectionScore,
      };
    })
    .filter((candidate) => (
      candidate
      && (
        candidate.windowActiveMs > 0
      || candidate.rawWindowMs > 0
      || candidate.weightedPressureMs > 0
      || candidate.todayActiveMs > 0
      || candidate.weeklyTotal > 0
      || candidate.recentTrajectory?.reference?.state === 'zero'
      || candidate.recentTrajectory?.reference?.state === 'positive'
      || candidate.activeDays > 0
      )
    ))
    .sort((left, right) => {
      const pressureDiff = right.weightedPressureMs - left.weightedPressureMs;
      if (pressureDiff !== 0) return pressureDiff;
      const scoreDiff = right.selectionScore - left.selectionScore;
      if (scoreDiff !== 0) return scoreDiff;
      const riskDiff = right.risk - left.risk;
      if (riskDiff !== 0) return riskDiff;
      const todayDiff = right.todayActiveMs - left.todayActiveMs;
      if (todayDiff !== 0) return todayDiff;
      const windowDiff = right.windowActiveMs - left.windowActiveMs;
      if (windowDiff !== 0) return windowDiff;
      if (right.managed !== left.managed) return Number(right.managed) - Number(left.managed);
      return left.domain.localeCompare(right.domain);
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      policyDisposition: resolveStatusDomainCandidateDisposition(candidate),
    }));
}

export function projectStatusDomainCandidatesToSignalScannerTargets(
  domainCandidates = [],
  {
    maxCount = MAX_SIGNAL_SCANNER_TARGET_COUNT,
    focusDomain = null,
    usageByDomain = null,
  } = {},
) {
  if (!Array.isArray(domainCandidates)) return [];
  const resolvedMaxCount = resolvePositiveInteger(maxCount, MAX_SIGNAL_SCANNER_TARGET_COUNT);
  if (resolvedMaxCount <= 0) return [];
  const normalizedCandidates = buildVisibleDomainCandidatePool(domainCandidates, { usageByDomain });
  const hasPreselectedVisibleRanks = normalizedCandidates.length > 0
    && normalizedCandidates.every((candidate) => (
      Number.isFinite(Number(candidate?.visibleRank))
      && Number(candidate.visibleRank) > 0
    ));
  const scannerSourceCandidates = hasPreselectedVisibleRanks
    ? normalizedCandidates
      .slice()
      .sort((left, right) => {
        const rankDiff = Math.floor(Number(left.visibleRank)) - Math.floor(Number(right.visibleRank));
        if (rankDiff !== 0) return rankDiff;
        return String(left.domain || '').localeCompare(String(right.domain || ''));
      })
      .slice(0, resolvedMaxCount)
    : selectVisibleDomainCandidates(normalizedCandidates, {
      maxCount: resolvedMaxCount,
      focusDomain,
    });
  return scannerSourceCandidates
    .map((candidate) => {
      const domain = normalizeDomain(candidate?.domain);
      if (!domain) return null;
      const risk = roundNumber(clampNumber(candidate?.risk, 0, 1.2, 0), 3, 0);
      const polarHint = computeSignalScannerPolarHint(domain, risk);
      return {
        domain,
        risk,
        policyStatus: candidate?.policyStatus === 'blocked' ? 'blocked' : 'allowed',
        cohort: typeof candidate?.cohort === 'string' ? candidate.cohort : 'managed',
        priority: roundNumber(candidate?.selectionScore, 4, 0),
        ...polarHint,
      };
    })
    .filter(Boolean);
}
