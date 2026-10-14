import { formatMinutes } from '@/apps/dashboard/utils/formatters.js';
import { normalizeCoolingCurve, resolveCoolingCurvePosture } from '@/domains/settings/config/coolingCurvePolicy.js';
import { buildProtectionRuntimeInsightCards } from '@/apps/dashboard/utils/protectionRuntimeInsights.js';
import { buildDailyFlowPressureProfile } from './dailyFlowPressureProfile.js';
import {
  buildDailyFlowViewModel,
  buildLensHourlySeries,
} from './dailyFlowViewModel.js';
import { buildHomeBriefViewModel } from './homeBriefViewModel.js';
import { resolveHomeHabitCue } from './homeHabitCueViewModel.js';
import { resolveHomeInsightPresentation } from './homeInsightPresentation.js';
import { buildRhythmTopSitesViewModel } from './rhythmTopSitesViewModel.js';
import {
  projectRollingPressureRecentTrajectoryScalars,
  resolveRollingPressureActiveDayCount,
  resolveRollingPressureRecentTrajectory,
} from './rollingPressureEvidence.js';
const MINUTE_MS = 60000;
const HOUR_COUNT = 24;
const ALERT_RATIO = 1;
const WARN_RATIO = 0.85;
function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
function formatAbsoluteMinutes(ms) {
  return formatMinutes(Math.max(0, toNumber(ms)));
}
function resolvePosture(coolingCurve, tTabs) {
  const posture = resolveCoolingCurvePosture(normalizeCoolingCurve(coolingCurve));
  if (posture === 'gentle') {
    return {
      id: 'gentle',
      label: tTabs('main.home_posture_gentle', {})
    };
  }
  if (posture === 'strict') {
    return {
      id: 'strict',
      label: tTabs('main.home_posture_strict', {})
    };
  }
  return {
    id: 'balanced',
    label: tTabs('main.home_posture_balanced', {})
  };
}

function resolvePostureDetail(postureId, tTabs) {
  switch (postureId) {
    case 'gentle':
      return tTabs('main.home_posture_gentle_detail', {});
    case 'strict':
      return tTabs('main.home_posture_strict_detail', {});
    default:
      return tTabs('main.home_posture_balanced_detail', {});
  }
}
function resolveRhythmLensDomain(ctrl) {
  const explicitLens = typeof ctrl?.rhythmLensDomain === 'string'
    ? ctrl.rhythmLensDomain.trim().toLowerCase()
    : '';
  if (explicitLens) return explicitLens;
  return typeof ctrl?.lockedTarget === 'string' ? ctrl.lockedTarget.trim().toLowerCase() : '';
}

function resolveRhythmDayProjection(ctrl) {
  return ctrl?.rhythmDayProjection || null;
}

function resolveCalendarTodayProjection(ctrl) {
  return ctrl?.calendarTodayProjection || null;
}

function resolveCurrentCycleProjection(ctrl) {
  return ctrl?.currentCycleProjection || null;
}

function buildHomePressureSummary(rollingPressure = null, pressureRailReadiness = null) {
  const domains = Array.isArray(rollingPressure?.domains) ? rollingPressure.domains : [];
  let protectedMs = 0;

  for (const domainEntry of domains) {
    if (domainEntry?.blocked === true || domainEntry?.policyStatus === 'blocked') {
      protectedMs += Math.max(0, toNumber(domainEntry?.weightedPressureMs));
    }
  }

  return {
    mode: 'recent-pressure',
    basis: rollingPressure?.basis || null,
    windowDays: Math.max(0, Math.floor(toNumber(rollingPressure?.windowDays))),
    totalMs: Math.max(0, toNumber(rollingPressure?.totalPressureMs)),
    protectedMs: Math.max(0, protectedMs),
    activeDayCount: resolveRollingPressureActiveDayCount(rollingPressure),
    temporal: rollingPressure?.temporal || null,
    readiness: pressureRailReadiness,
  };
}

function buildPrimaryInsight(ctrl, domain) {
  if (!domain) return null;
  return ctrl?.domainInsights?.[domain]?.primaryInsight || ctrl?.domainInsights?.[domain]?.analysis?.primaryInsight || null;
}
function normalizeHour(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const hour = Math.floor(numeric);
  return hour >= 0 && hour < HOUR_COUNT ? hour : null;
}

function buildRhythmSummary({
  dailyFlow,
  topSites,
  lensDomain,
  lensUsedMs,
  lensGoalMinutes,
  lensBrief = null,
  globalGoalMinutes,
  tTabs,
}) {
  const totalMs = Math.max(0, toNumber(dailyFlow?.totalMs));
  const protectedMs = Math.max(0, toNumber(dailyFlow?.protectedMs));
  const globalGoalMs = Math.max(0, toNumber(globalGoalMinutes) * MINUTE_MS);
  const protectedGoalRatio = globalGoalMs > 0 ? protectedMs / globalGoalMs : 0;
  const selectedDomain = typeof lensDomain === 'string' ? lensDomain.trim().toLowerCase() : '';
  return {
    basis: dailyFlow?.basis || 'rhythm-day',
    startHour: normalizeHour(dailyFlow?.startHour),
    resetHour: normalizeHour(dailyFlow?.resetHour),
    totalMs,
    protectedMs,
    otherMs: Math.max(0, totalMs - protectedMs),
    protectedShareOfDay: totalMs > 0 ? protectedMs / totalMs : 0,
    globalGoalMinutes: Math.max(0, Math.floor(toNumber(globalGoalMinutes))),
    protectedGoalRatio,
    peakTotalHour: dailyFlow?.peakTotalHour || null,
    topSites: Array.isArray(topSites) ? topSites : [],
    lens: selectedDomain ? {
      domain: selectedDomain,
      activeMs: Math.max(0, toNumber(lensUsedMs)),
      goalMinutes: Math.max(0, Math.floor(toNumber(lensGoalMinutes))),
      statusLabel: lensBrief?.statusLabel || '',
      verdict: lensBrief?.verdict || '',
      action: lensBrief?.action || null,
    } : null,
    emptyLabel: totalMs > 0 ? '' : tTabs('target_protocol.no_activity_hint', {}),
  };
}

function resolvePeakWindow(series = []) {
  if (!Array.isArray(series) || series.length <= 0) {
    return {
      startHour: null,
      endHour: null,
      activeMs: 0,
      label: 'No clear window'
    };
  }
  let best = {
    startHour: 0,
    endHour: 2,
    activeMs: 0
  };
  const seriesLength = Math.min(HOUR_COUNT, series.length);
  for (let index = 0; index < seriesLength; index += 1) {
    const current = series[index] || null;
    const next = series[(index + 1) % seriesLength] || null;
    const total = toNumber(current?.activeMs) + toNumber(next?.activeMs);
    if (total > best.activeMs) {
      const startHour = normalizeHour(current?.hour) ?? index;
      const endHour = normalizeHour(series[(index + 2) % seriesLength]?.hour) ?? ((startHour + 2) % HOUR_COUNT);
      best = {
        startHour,
        endHour,
        activeMs: total
      };
    }
  }
  const startLabel = `${String(best.startHour).padStart(2, '0')}:00`;
  const endLabel = `${String(best.endHour).padStart(2, '0')}:00`;
  return {
    ...best,
    label: `${startLabel}-${endLabel}`
  };
}
function resolveRiskTone({
  ratio = 0,
  deltaMs = 0,
  peakWindowActiveMs = 0,
  goalMs = 0
}) {
  if (goalMs > 0 && ratio >= ALERT_RATIO) return 'alert';
  if (goalMs > 0 && ratio >= WARN_RATIO) return 'warn';
  if (deltaMs >= 12 * MINUTE_MS) return 'warn';
  if (peakWindowActiveMs >= 14 * MINUTE_MS) return 'active';
  return 'ok';
}
function resolveRiskLabel(tone, tTabs) {
  switch (tone) {
    case 'alert':
      return tTabs('main.scan_risk_alert', {});
    case 'warn':
      return tTabs('main.scan_risk_warn', {});
    case 'active':
      return tTabs('main.scan_risk_active', {});
    default:
      return tTabs('main.scan_risk_ok', {});
  }
}
function buildReasons({
  preferredReasons = [],
  hasPrimaryInsight = false,
  goalMs,
  ratio,
  deltaMs,
  peakWindow,
  focusUsedMs,
  protectionCards,
  tTabs
}) {
  const reasons = [];
  for (const reason of Array.isArray(preferredReasons) ? preferredReasons : []) {
    if (typeof reason === 'string' && reason.trim()) {
      reasons.push(reason.trim());
    }
  }
  if (hasPrimaryInsight) {
    const targetCard = Array.isArray(protectionCards) ? protectionCards.find(card => card?.id === 'target') : null;
    if (reasons.length <= 0 && targetCard?.tone === 'warn' && typeof targetCard?.body === 'string' && targetCard.body.trim()) {
      reasons.push(targetCard.body.trim());
    }
    return [...new Set(reasons)].slice(0, 3);
  }
  if (goalMs <= 0) {
    reasons.push(tTabs('main.scan_reason_no_target', {}));
  } else if (ratio >= ALERT_RATIO) {
    reasons.push(tTabs('main.scan_reason_over_target', {
      value: formatAbsoluteMinutes(focusUsedMs - goalMs)
    }));
  } else if (ratio >= WARN_RATIO) {
    reasons.push(tTabs('main.scan_reason_near_target', {
      value: Math.round(ratio * 100)
    }));
  }
  if (deltaMs >= 10 * MINUTE_MS) {
    reasons.push(tTabs('main.scan_reason_above_average', {
      value: formatAbsoluteMinutes(deltaMs)
    }));
  }
  if (peakWindow?.activeMs >= 8 * MINUTE_MS) {
    reasons.push(tTabs('main.scan_reason_peak_window', {
      window: peakWindow.label
    }));
  }
  const targetCard = Array.isArray(protectionCards) ? protectionCards.find(card => card?.id === 'target') : null;
  if (targetCard?.tone === 'warn') {
    reasons.push(targetCard.body);
  }
  return [...new Set(reasons)].slice(0, 3);
}

export function buildHomeScanSnapshot({
  ctrl,
  protocolState,
  protectionRuntimeSnapshot,
  tTabs
}) {
  const siteGoalMap = protocolState?.siteGoals && typeof protocolState.siteGoals === 'object' ? protocolState.siteGoals : {};
  const blockedSet = new Set(
    (Array.isArray(ctrl?.blockedList) ? ctrl.blockedList : [])
      .map((domain) => (typeof domain === 'string' ? domain.trim().toLowerCase() : ''))
      .filter(Boolean),
  );
  const rhythmLensDomain = resolveRhythmLensDomain(ctrl);
  const lensUsedMs = Math.max(0, toNumber(ctrl?.rhythmSiteDetails?.[rhythmLensDomain] ?? ctrl?.todaySiteDetails?.[rhythmLensDomain] ?? ctrl?.siteDetails?.[rhythmLensDomain]));
  const lensGoalMinutes = Math.max(0, Math.floor(toNumber(siteGoalMap?.[rhythmLensDomain])));
  const goalMs = lensGoalMinutes * MINUTE_MS;
  const ratio = goalMs > 0 ? lensUsedMs / goalMs : 0;
  const recentTrajectory = resolveRollingPressureRecentTrajectory(
    ctrl?.rollingPressure,
    rhythmLensDomain,
  );
  const {
    hasReference: hasRecentReference,
    recentAverageMs,
    deltaMs,
  } = projectRollingPressureRecentTrajectoryScalars(recentTrajectory);
  const neutralRecentDeltaMs = deltaMs ?? 0;
  const primaryInsight = buildPrimaryInsight(ctrl, rhythmLensDomain);
  const hourlySeries = buildLensHourlySeries(ctrl, rhythmLensDomain);
  const hourlyDomainCandidates = Array.isArray(ctrl?.visibleDomainCandidates)
    ? ctrl.visibleDomainCandidates
    : [];
  const baseDailyFlow = buildDailyFlowViewModel({
    ctrl,
    lensDomain: rhythmLensDomain,
    lensUsedMs,
    goalMs,
    hourlyDomainCandidates,
  });
  const dailyFlow = {
    ...baseDailyFlow,
    pressureProfile: buildDailyFlowPressureProfile({
      dailyFlow: baseDailyFlow,
      rollingPressure: ctrl?.rollingPressure,
      lensDomain: rhythmLensDomain,
    }),
  };
  const peakWindow = resolvePeakWindow(hourlySeries);
  const posture = resolvePosture(protocolState?.coolingCurve, tTabs);
  const protectionCards = buildProtectionRuntimeInsightCards(protectionRuntimeSnapshot, tTabs).cards || [];
  const isManaged = Boolean(rhythmLensDomain) && (blockedSet.has(rhythmLensDomain) || Object.prototype.hasOwnProperty.call(siteGoalMap, rhythmLensDomain));
  const insightPresentation = isManaged
    ? resolveHomeInsightPresentation({
        primaryInsight,
        focusUsedMs: lensUsedMs,
        goalMs,
        recentDeltaMs: neutralRecentDeltaMs,
        peakWindow,
        focusDomain: rhythmLensDomain,
        tTabs,
      })
    : null;
  const riskTone = insightPresentation?.riskTone || resolveRiskTone({
    ratio,
    deltaMs: neutralRecentDeltaMs,
    peakWindowActiveMs: peakWindow.activeMs,
    goalMs
  });
  const riskLabel = insightPresentation?.riskLabel || resolveRiskLabel(riskTone, tTabs);
  const reasons = buildReasons({
    preferredReasons: insightPresentation?.reasons || [],
    hasPrimaryInsight: Boolean(insightPresentation),
    goalMs,
    ratio,
    deltaMs: neutralRecentDeltaMs,
    peakWindow,
    focusUsedMs: lensUsedMs,
    protectionCards,
    tTabs
  });
  const visibleDomainCandidates = Array.isArray(ctrl?.visibleDomainCandidates) && ctrl.visibleDomainCandidates.length > 0
    ? ctrl.visibleDomainCandidates
    : [];
  const rhythmTopSites = buildRhythmTopSitesViewModel({
    lensDomain: rhythmLensDomain,
    visibleDomainCandidates,
  });
  const otherActiveSites = rhythmTopSites.filter(entry => entry.domain !== rhythmLensDomain).slice(0, 4);
  const interventionCard = protectionCards.find(card => card?.id === 'intervention') || null;
  const {
    brief: selectedLensBrief,
    primaryAction: displayedPrimaryAction,
    actions,
  } = buildHomeBriefViewModel({
    insightPresentation,
    riskTone,
    isManaged,
    focusDomain: rhythmLensDomain,
    focusUsedMs: lensUsedMs,
    goalMs,
    ratio,
    deltaMs: neutralRecentDeltaMs,
    peakWindow,
    scoreSetup: ctrl?.scoreSetup,
    tTabs,
  });
  const calendarTodayProjection = resolveCalendarTodayProjection(ctrl);
  const currentCycleProjection = resolveCurrentCycleProjection(ctrl);
  const calendarTodayTrackedMs = toNumber(calendarTodayProjection?.totals?.activeMs ?? ctrl?.todayActiveMs);
  const calendarTodayBlockedMs = toNumber(calendarTodayProjection?.totals?.byCategory?.blocked?.activeMs ?? ctrl?.todayProtectedMs);
  const rhythmDayTrackedMs = toNumber(dailyFlow?.totalMs);
  const rhythmDayBlockedMs = toNumber(dailyFlow?.protectedMs);
  const currentCycleTrackedMs = toNumber(currentCycleProjection?.totals?.activeMs);
  const currentCycleBlockedMs = toNumber(
    currentCycleProjection?.totals?.byCategory?.blocked?.activeMs ?? ctrl?.totalBlockedDuration,
  );
  const globalGoalMinutes = Math.max(0, Math.floor(toNumber(ctrl?.goals?.globalGoal)));
  const rhythmSummary = buildRhythmSummary({
    dailyFlow,
    topSites: rhythmTopSites,
    lensDomain: rhythmLensDomain,
    lensUsedMs,
    lensGoalMinutes,
    lensBrief: selectedLensBrief,
    globalGoalMinutes,
    tTabs,
  });
  const habitCue = resolveHomeHabitCue({
    habitFeedback: ctrl?.habitFeedback,
    rhythmLensDomain,
    tTabs,
  });
  return {
    rhythmLensDomain,
    rhythmLensUsedMs: lensUsedMs,
    rhythmLensGoalMinutes: lensGoalMinutes,
    focusDomain: rhythmLensDomain,
    focusUsedMs: lensUsedMs,
    focusGoalMinutes: lensGoalMinutes,
    focusGoalLabel: lensGoalMinutes > 0 ? formatAbsoluteMinutes(goalMs) : tTabs('main.scan_goal_unset', {}),
    recentTrajectory,
    hasRecentReference,
    recentAverageMs,
    deltaMs,
    peakWindow,
    riskTone,
    riskLabel,
    postureId: posture.id,
    postureLabel: posture.label,
    postureDetail: resolvePostureDetail(posture.id, tTabs),
    reasons,
    usageRowLabel: tTabs('main.scan_usage_row', {
      used: formatAbsoluteMinutes(lensUsedMs),
      goal: lensGoalMinutes > 0 ? formatAbsoluteMinutes(goalMs) : tTabs('main.scan_goal_unset', {})
    }),
    averageRowLabel: hasRecentReference
      ? deltaMs >= 0
        ? tTabs('main.scan_average_row_up', { value: formatAbsoluteMinutes(deltaMs) })
        : tTabs('main.scan_average_row_down', { value: formatAbsoluteMinutes(Math.abs(deltaMs)) })
      : '',
    peakRowLabel: peakWindow.activeMs > 0 ? tTabs('main.scan_peak_row', {
      window: peakWindow.label
    }) : tTabs('main.scan_peak_row_none', {}),
    protectionHeadline: interventionCard?.title || tTabs('main.scan_protection_headline', {}),
    protectionBody: interventionCard?.body || tTabs('main.scan_protection_body', {}),
    hourlySeries,
    dailyFlow,
    pressureSummary: buildHomePressureSummary(
      ctrl?.rollingPressure,
      ctrl?.pressureRailReadiness,
    ),
    rhythmSummary,
    habitCue,
    calendarTodayTrackedMs,
    calendarTodayBlockedMs,
    rhythmDayTrackedMs,
    rhythmDayBlockedMs,
    currentCycleTrackedMs,
    currentCycleBlockedMs,
    globalGoalMinutes,
    globalUsageMinutes: Math.max(0, Math.round(currentCycleBlockedMs / MINUTE_MS)),
    totalTrackedMs: rhythmDayTrackedMs,
    totalBlockedMs: rhythmDayBlockedMs,
    rhythmTopSites,
    otherActiveSites,
    brief: selectedLensBrief,
    primaryAction: displayedPrimaryAction,
    actions
  };
}
