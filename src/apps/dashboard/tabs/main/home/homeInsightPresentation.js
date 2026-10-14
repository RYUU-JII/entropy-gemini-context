import { formatMinutes } from '@/apps/dashboard/utils/formatters.js';
import { SITE_INSIGHT_ACTION_IDS } from '../../../../../domains/stats/insights/contracts/siteInsightContracts.js';

const MINUTE_MS = 60000;

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatAbsoluteMinutes(ms) {
  return formatMinutes(Math.max(0, toNumber(ms)));
}

function findSupportingFact(primaryInsight, factId) {
  const facts = Array.isArray(primaryInsight?.supportingFacts) ? primaryInsight.supportingFacts : [];
  return facts.find((fact) => fact?.id === factId) || null;
}

function formatPeakWindowLabel(primaryInsight, peakWindow) {
  const dominantWindow = findSupportingFact(primaryInsight, 'dominant_window')?.value || null;
  if (dominantWindow) {
    const startHour = Number(dominantWindow?.startHour);
    const endHour = Number(dominantWindow?.endHour);
    if (Number.isFinite(startHour) && Number.isFinite(endHour)) {
      return `${String(startHour).padStart(2, '0')}:00-${String(endHour).padStart(2, '0')}:00`;
    }
  }
  return peakWindow?.label || '';
}

function buildSitesAction({
  id,
  focusDomain,
  label,
  title = null,
  body = null,
} = {}) {
  if (!focusDomain || !label) return null;
  return {
    id,
    label,
    title,
    body,
    tabId: 'sites',
    params: { domain: focusDomain },
  };
}

function resolvePrimaryAction({
  primaryInsight,
  focusDomain,
  primaryReason,
  tTabs,
} = {}) {
  const actionId = typeof primaryInsight?.recommendedAction?.id === 'string'
    ? primaryInsight.recommendedAction.id
    : '';
  if (!actionId || !focusDomain) return undefined;

  if (actionId === SITE_INSIGHT_ACTION_IDS.DEFINE_GOAL) {
    return buildSitesAction({
      id: 'define-goal',
      focusDomain,
      label: tTabs('main.home_action_review_site_cta', {}),
      title: tTabs('main.home_action_review_site_title', { domain: focusDomain }),
      body: primaryReason || tTabs('main.scan_reason_no_target', {}),
    });
  }

  if (actionId === SITE_INSIGHT_ACTION_IDS.REVIEW_GOAL) {
    const body = primaryInsight?.id === 'over_target'
      ? tTabs('main.home_action_review_site_body_over', {})
      : primaryInsight?.id === 'near_limit'
        ? tTabs('main.home_action_review_site_body_near', {})
        : primaryReason || tTabs('main.home_actions_narrative', {});
    return buildSitesAction({
      id: 'review-site',
      focusDomain,
      label: tTabs('main.home_action_review_site_cta', {}),
      title: tTabs('main.home_action_review_site_title', { domain: focusDomain }),
      body,
    });
  }

  if (actionId === SITE_INSIGHT_ACTION_IDS.WATCH_WINDOW) {
    return buildSitesAction({
      id: 'review-window',
      focusDomain,
      label: tTabs('main.home_action_review_site_cta', {}),
      title: tTabs('main.home_action_review_site_title', { domain: focusDomain }),
      body: primaryReason || tTabs('main.home_actions_narrative', {}),
    });
  }

  if (actionId === SITE_INSIGHT_ACTION_IDS.HOLD_COURSE) {
    return null;
  }

  return undefined;
}

export function resolveHomeInsightPresentation({
  primaryInsight,
  focusUsedMs = 0,
  goalMs = 0,
  recentDeltaMs = 0,
  peakWindow = null,
  focusDomain = '',
  tTabs,
} = {}) {
  const insightId = typeof primaryInsight?.id === 'string' ? primaryInsight.id : '';
  if (!insightId || typeof tTabs !== 'function') return null;

  if (insightId === 'goal_missing') {
    const primaryReason = tTabs('main.scan_reason_no_target', {});
    return {
      riskTone: 'warn',
      riskLabel: tTabs('main.scan_goal_unset', {}),
      reasons: [primaryReason],
      primaryReason,
      briefTone: 'warn',
      briefStatusLabel: tTabs('main.scan_goal_unset', {}),
      briefVerdict: tTabs('main.scan_goal_unset', {}),
      briefSupportingText: primaryReason,
      briefChip: {
        id: 'target-unset',
        text: tTabs('main.brief_chip_target_unset', {}),
      },
      primaryAction: resolvePrimaryAction({
        primaryInsight,
        focusDomain,
        primaryReason,
        tTabs,
      }),
    };
  }

  if (insightId === 'over_target') {
    const overGoalMinutes = toNumber(findSupportingFact(primaryInsight, 'over_goal_minutes')?.value);
    const overGoalMs = overGoalMinutes > 0 ? overGoalMinutes * MINUTE_MS : Math.max(0, focusUsedMs - goalMs);
    const primaryReason = tTabs('main.scan_reason_over_target', {
      value: formatAbsoluteMinutes(overGoalMs),
    });
    const primaryAction = resolvePrimaryAction({
      primaryInsight,
      focusDomain,
      primaryReason,
      tTabs,
    });
    return {
      riskTone: 'alert',
      riskLabel: tTabs('main.scan_risk_alert', {}),
      reasons: [primaryReason],
      primaryReason,
      briefTone: 'alert',
      briefStatusLabel: tTabs('main.brief_status_over', {}),
      briefVerdict: tTabs('main.brief_verdict_over_value', {
        value: formatAbsoluteMinutes(overGoalMs),
      }),
      briefSupportingText: primaryAction?.body || primaryReason,
      briefChip: {
        id: 'over',
        text: tTabs('main.brief_chip_over_compact', {
          value: formatAbsoluteMinutes(overGoalMs),
        }),
      },
      primaryAction,
    };
  }

  if (insightId === 'near_limit') {
    const remainingMinutes = toNumber(findSupportingFact(primaryInsight, 'remaining_minutes')?.value);
    const remainingMs = remainingMinutes > 0 ? remainingMinutes * MINUTE_MS : Math.max(0, goalMs - focusUsedMs);
    const ratioPercent = goalMs > 0
      ? Math.round((focusUsedMs / goalMs) * 100)
      : 0;
    const primaryReason = tTabs('main.scan_reason_near_target', {
      value: ratioPercent,
    });
    const primaryAction = resolvePrimaryAction({
      primaryInsight,
      focusDomain,
      primaryReason,
      tTabs,
    });
    return {
      riskTone: 'warn',
      riskLabel: tTabs('main.scan_risk_warn', {}),
      reasons: [primaryReason],
      primaryReason,
      briefTone: 'warn',
      briefStatusLabel: tTabs('main.brief_status_near', {}),
      briefVerdict: tTabs('main.brief_verdict_left_value', {
        value: formatAbsoluteMinutes(remainingMs),
      }),
      briefSupportingText: primaryAction?.body || primaryReason,
      briefChip: {
        id: 'remaining',
        text: tTabs('main.brief_chip_remaining_compact', {
          value: formatAbsoluteMinutes(remainingMs),
        }),
      },
      primaryAction,
    };
  }

  if (insightId === 'rising_vs_baseline') {
    const recentAverageMinutes = toNumber(findSupportingFact(primaryInsight, 'recent_average_minutes')?.value);
    const baselineAverageMinutes = toNumber(findSupportingFact(primaryInsight, 'baseline_average_minutes')?.value);
    const weeklyDeltaMs = Math.max(0, (recentAverageMinutes - baselineAverageMinutes) * MINUTE_MS);
    const effectiveDeltaMs = Math.max(weeklyDeltaMs, Math.max(0, toNumber(recentDeltaMs)));
    const primaryReason = tTabs('main.scan_reason_above_average', {
      value: formatAbsoluteMinutes(effectiveDeltaMs),
    });
    const primaryAction = resolvePrimaryAction({
      primaryInsight,
      focusDomain,
      primaryReason,
      tTabs,
    });
    return {
      riskTone: 'active',
      riskLabel: tTabs('main.scan_risk_active', {}),
      reasons: [primaryReason],
      primaryReason,
      briefTone: 'active',
      briefStatusLabel: tTabs('main.brief_status_rising', {}),
      briefVerdict: tTabs('main.brief_verdict_rising', {}),
      briefSupportingText: primaryAction?.body || primaryReason,
      briefChip: {
        id: 'delta',
        text: tTabs('main.brief_chip_average_up_compact', {
          value: formatAbsoluteMinutes(effectiveDeltaMs),
        }),
      },
      primaryAction,
    };
  }

  if (insightId === 'clustered_peak') {
    const windowLabel = formatPeakWindowLabel(primaryInsight, peakWindow);
    const primaryReason = windowLabel
      ? tTabs('main.scan_reason_peak_window', { window: windowLabel })
      : null;
    const primaryAction = resolvePrimaryAction({
      primaryInsight,
      focusDomain,
      primaryReason,
      tTabs,
    });
    return {
      riskTone: 'active',
      riskLabel: tTabs('main.scan_risk_active', {}),
      reasons: primaryReason ? [primaryReason] : [],
      primaryReason,
      briefTone: 'active',
      briefStatusLabel: tTabs('main.brief_status_rising', {}),
      briefVerdict: tTabs('main.brief_verdict_today_value', {
        value: formatAbsoluteMinutes(focusUsedMs),
      }),
      briefSupportingText: primaryAction?.body || primaryReason,
      briefChip: windowLabel
        ? {
            id: 'peak',
            text: tTabs('main.brief_chip_peak_compact', {
              window: windowLabel,
            }),
          }
        : null,
      primaryAction,
    };
  }

  if (insightId === 'quiet') {
    return {
      riskTone: 'ok',
      riskLabel: tTabs('main.scan_risk_ok', {}),
      reasons: [],
      primaryReason: null,
      briefTone: 'ok',
      briefStatusLabel: tTabs('main.brief_status_stable', {}),
      briefVerdict: tTabs('main.brief_verdict_stable', {}),
      briefSupportingText: tTabs('main.home_actions_narrative_idle', {}),
      briefChip: null,
      primaryAction: resolvePrimaryAction({
        primaryInsight,
        focusDomain,
        primaryReason: null,
        tTabs,
      }),
    };
  }

  return null;
}
