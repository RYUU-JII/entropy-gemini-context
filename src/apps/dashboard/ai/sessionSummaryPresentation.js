import {
  SESSION_SUMMARY_DRAFT_CONTRACT_VERSION,
} from '@/domains/ai/tasks/sessionSummary/buildSessionSummaryNarrationInput.js';

const MINUTE_MS = 60000;

function cleanString(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toMinutes(ms) {
  return Math.max(0, Math.round(toFiniteNumber(ms) / MINUTE_MS));
}

function readRecentTrajectory(scanSnapshot = {}) {
  const recentTrajectory = scanSnapshot?.recentTrajectory;
  return recentTrajectory && typeof recentTrajectory === 'object' ? recentTrajectory : null;
}

function hasRecentTrajectoryReference(recentTrajectory = null) {
  return recentTrajectory?.reference?.state === 'zero'
    || recentTrajectory?.reference?.state === 'positive';
}

function buildLabel(id, severity = 'neutral', confidence = 1) {
  const normalizedId = cleanString(id);
  if (!normalizedId) return null;
  return {
    id: normalizedId,
    severity: cleanString(severity, 'neutral'),
    confidence: Math.max(0, Math.min(1, toFiniteNumber(confidence, 1))),
  };
}

function buildSummaryLabels(scanSnapshot = {}) {
  const labels = [
    buildLabel(
      `risk_${cleanString(scanSnapshot.riskTone, 'muted')}`,
      scanSnapshot.riskTone || 'neutral',
    ),
  ];
  const focusGoalMinutes = toFiniteNumber(scanSnapshot.focusGoalMinutes);
  const focusUsedMs = toFiniteNumber(scanSnapshot.focusUsedMs);
  const goalMs = focusGoalMinutes * MINUTE_MS;
  const recentTrajectory = readRecentTrajectory(scanSnapshot);
  const hasRecentReference = hasRecentTrajectoryReference(recentTrajectory);
  const deltaMs = hasRecentReference
    ? toFiniteNumber(recentTrajectory?.comparison?.deltaMs)
    : 0;
  const peakActiveMs = toFiniteNumber(scanSnapshot.peakWindow?.activeMs);

  if (focusGoalMinutes <= 0) labels.push(buildLabel('goal_unset', 'warn'));
  if (goalMs > 0 && focusUsedMs > goalMs) labels.push(buildLabel('over_daily_goal', 'alert'));
  if (goalMs > 0 && focusUsedMs <= goalMs && focusUsedMs >= goalMs * 0.85) {
    labels.push(buildLabel('near_daily_goal', 'warn'));
  }
  if (hasRecentReference && deltaMs >= 10 * MINUTE_MS) {
    labels.push(buildLabel('above_recent_average', 'warn'));
  }
  if (hasRecentReference && deltaMs <= -10 * MINUTE_MS) {
    labels.push(buildLabel('below_recent_average', 'ok'));
  }
  if (peakActiveMs >= 8 * MINUTE_MS) {
    labels.push(buildLabel('clustered_peak_window', 'active'));
  }

  return labels.filter(Boolean);
}

function resolvePrimaryLabelId(labels = []) {
  const priority = [
    'over_daily_goal',
    'near_daily_goal',
    'above_recent_average',
    'clustered_peak_window',
    'goal_unset',
  ];
  for (const id of priority) {
    if (labels.some((label) => label.id === id)) return id;
  }
  return labels[0]?.id || '';
}

export function buildSessionSummaryDraftFromHomeScanSnapshot(scanSnapshot = null) {
  if (!scanSnapshot || typeof scanSnapshot !== 'object') return null;
  const brief = scanSnapshot.brief && typeof scanSnapshot.brief === 'object'
    ? scanSnapshot.brief
    : null;
  const focusDomain = cleanString(scanSnapshot.focusDomain || brief?.focusDomain);
  if (!focusDomain || !brief) return null;

  const labels = buildSummaryLabels(scanSnapshot);
  const primaryLabelId = resolvePrimaryLabelId(labels);
  const action = scanSnapshot.primaryAction || brief.action || null;
  const suggestions = action?.label ? [action.label] : [];
  const recentTrajectory = readRecentTrajectory(scanSnapshot);
  const hasRecentReference = hasRecentTrajectoryReference(recentTrajectory);
  const recentAverageMs = hasRecentReference
    ? toFiniteNumber(recentTrajectory?.reference?.weightedDailyAverageMs)
    : null;
  const recentDeltaMs = hasRecentReference
    ? toFiniteNumber(recentTrajectory?.comparison?.deltaMs)
    : null;

  return {
    id: `home-focus:${focusDomain}`,
    version: SESSION_SUMMARY_DRAFT_CONTRACT_VERSION,
    scope: 'home_focus_session',
    domain: focusDomain,
    durationMs: toFiniteNumber(scanSnapshot.focusUsedMs),
    severity: cleanString(scanSnapshot.riskTone || brief.tone, 'neutral'),
    primaryLabelId,
    labels,
    metrics: {
      focusUsedMinutes: toMinutes(scanSnapshot.focusUsedMs),
      focusGoalMinutes: Math.max(0, Math.round(toFiniteNumber(scanSnapshot.focusGoalMinutes))),
      recentAverageMinutes: recentAverageMs === null ? null : toMinutes(recentAverageMs),
      deltaMinutes: recentDeltaMs === null ? null : Math.round(recentDeltaMs / MINUTE_MS),
      peakWindowMinutes: toMinutes(scanSnapshot.peakWindow?.activeMs),
      totalTrackedMinutes: toMinutes(scanSnapshot.totalTrackedMs),
      totalBlockedMinutes: toMinutes(scanSnapshot.totalBlockedMs),
      ...(recentTrajectory ? {
        recentTrajectoryVersion: cleanString(recentTrajectory.version),
        recentTrajectoryRole: cleanString(recentTrajectory.role),
        recentTrajectoryGrain: cleanString(recentTrajectory.grain),
        recentTrajectoryStatus: cleanString(recentTrajectory.evidence?.status),
        recentTrajectoryExcludeCurrent: recentTrajectory.excludeCurrent === true,
        recentTrajectoryObservedDays: Math.max(
          0,
          Math.floor(toFiniteNumber(recentTrajectory.window?.observedDays)),
        ),
        recentTrajectoryMissingDays: Math.max(
          0,
          Math.floor(toFiniteNumber(recentTrajectory.evidence?.missingDays)),
        ),
        recentTrajectoryZeroDays: Math.max(
          0,
          Math.floor(toFiniteNumber(recentTrajectory.evidence?.zeroDays)),
        ),
      } : {}),
    },
    evidence: Array.isArray(scanSnapshot.reasons) ? scanSnapshot.reasons : [],
    recommendedActionId: action?.id || '',
    deterministicCopy: {
      title: cleanString(brief.verdict),
      body: cleanString(brief.supportingText),
      suggestions,
    },
  };
}

export function buildSessionSummaryPresentationSignature({
  summaryDraft = null,
  locale = 'en',
} = {}) {
  if (!summaryDraft || typeof summaryDraft !== 'object') return '';
  return JSON.stringify({
    locale,
    summaryDraft,
  });
}

export function applySessionSummaryNarrationToBrief({
  brief = null,
  narration = null,
} = {}) {
  if (!brief || typeof brief !== 'object') return brief;
  if (!narration || typeof narration !== 'object') return brief;
  const title = cleanString(narration.title);
  const body = cleanString(narration.body);
  if (!title && !body) return brief;
  return {
    ...brief,
    verdict: title || brief.verdict,
    supportingText: body || brief.supportingText,
    aiNarration: {
      title,
      body,
      suggestions: Array.isArray(narration.suggestions)
        ? narration.suggestions.slice(0, 2)
        : [],
      confidence: cleanString(narration.confidence, 'medium'),
    },
  };
}
