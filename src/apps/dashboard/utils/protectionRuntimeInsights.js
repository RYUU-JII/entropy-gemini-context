import { buildProtectionRuntimeSnapshot } from '../../../domains/protection/contracts/protectionRuntimeSnapshotBridge.js';
import { PERSONAL_BASELINE_ROLES } from '../../../lib/personalBaselineContract.js';

const RESOLVED_OUTCOME_THRESHOLD = 2;
const RECOMMENDED_TARGET_MIN_DELTA = 10;

function normalizeSnapshot(snapshot = null) {
  return buildProtectionRuntimeSnapshot({
    hostname: snapshot?.scope?.host,
    tabId: snapshot?.scope?.tabId,
    source: snapshot?.scope?.source,
    capturedAt: snapshot?.capturedAt,
    runtime: snapshot?.runtime,
  });
}

function isMeaningfullyHigherRecommended(declaredTargetMinutes = 0, recommendedTargetMinutes = 0) {
  const declared = Math.max(0, Number(declaredTargetMinutes) || 0);
  const recommended = Math.max(0, Number(recommendedTargetMinutes) || 0);
  if (declared <= 0 || recommended <= 0) return false;
  return recommended >= declared + RECOMMENDED_TARGET_MIN_DELTA && recommended >= declared * 1.15;
}

function buildReviewGoalAction(normalizedSnapshot, tTabs) {
  const host = normalizedSnapshot?.scope?.host || '';
  const strategy = normalizedSnapshot?.runtime?.strategy || null;
  const targetRecommendation = strategy?.targetRecommendation || null;
  const declaredTargetMinutes = Math.max(0, Number(strategy?.declaredTargetMinutes) || 0);
  const recommendedTargetMinutes = Math.max(
    0,
    Number(targetRecommendation?.recommendedTargetMinutes) || 0,
  );

  if (!host) return null;
  if (targetRecommendation?.role !== PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE
    || targetRecommendation.requiresUserReview !== true
    || targetRecommendation.autoApply !== false) return null;
  if (!isMeaningfullyHigherRecommended(declaredTargetMinutes, recommendedTargetMinutes)) return null;

  return {
    id: 'review-goal',
    label: tTabs('runtime_insights.target_review_cta', {
      }),
    tabId: 'sites',
    params: {
      domain: host,
      recovery: 'reviewGoal',
    },
  };
}


function resolveOutcomeLabel(outcome, tTabs) {
  switch (outcome) {
    case 'leave':
      return tTabs('runtime_insights.outcome_leave', { });
    case 'stay':
      return tTabs('runtime_insights.outcome_stay', { });
    case 'aborted':
      return tTabs('runtime_insights.outcome_aborted', { });
    default:
      return tTabs('runtime_insights.outcome_unknown', { });
  }
}

function resolveActionLabel(recoveryAction, tTabs) {
  switch (recoveryAction) {
    case 'pause':
      return tTabs('runtime_insights.action_pause', { });
    case 'dashboard':
      return tTabs('runtime_insights.action_dashboard', { });
    case 'reviewGoal':
      return tTabs('runtime_insights.action_review_goal', { });
    case 'productiveSite':
      return tTabs('runtime_insights.action_productive_site', { });
    default:
      return tTabs('runtime_insights.action_quiet', { });
  }
}

function resolveInterventionInsight(normalizedSnapshot, tTabs) {
  const runtime = normalizedSnapshot.runtime;
  const strategy = runtime.strategy;
  const recovery = runtime.recovery;
  const effectiveness = runtime.effectiveness;
  const summary = effectiveness?.summary || {};
  const recoveryAction = recovery?.action || strategy?.recoveryAction || 'none';
  const actionLabel = resolveActionLabel(recoveryAction, tTabs);

  if (!runtime.available || !strategy) {
    return {
      id: 'intervention',
      tone: 'muted',
      title: tTabs('runtime_insights.intervention_idle_title', {
        }),
      body: tTabs('runtime_insights.intervention_idle_body', {
        }),
      meta: '',
    };
  }

  if ((summary.resolvedCount || 0) >= RESOLVED_OUTCOME_THRESHOLD) {
    if ((summary.leaveRate || 0) >= 0.6) {
      return {
        id: 'intervention',
        tone: 'ok',
        title: tTabs('runtime_insights.intervention_working_title', {
          }),
        body: tTabs('runtime_insights.intervention_working_body', {
          action: actionLabel,
          leave: summary.leaveCount || 0,
          resolved: summary.resolvedCount || 0,
        }),
        meta: tTabs('runtime_insights.intervention_meta_last_outcome', {
          outcome: resolveOutcomeLabel(summary.lastOutcome, tTabs),
        }),
      };
    }

    if ((summary.leaveRate || 0) >= 0.34) {
      return {
        id: 'intervention',
        tone: 'active',
        title: tTabs('runtime_insights.intervention_mixed_title', {
          }),
        body: tTabs('runtime_insights.intervention_mixed_body', {
          action: actionLabel,
          leave: summary.leaveCount || 0,
          resolved: summary.resolvedCount || 0,
        }),
        meta: tTabs('runtime_insights.intervention_meta_leave_rate', {
          rate: Math.round((summary.leaveRate || 0) * 100),
        }),
      };
    }

    return {
      id: 'intervention',
      tone: 'warn',
      title: tTabs('runtime_insights.intervention_soft_title', {
        }),
      body: tTabs('runtime_insights.intervention_soft_body', {
        action: actionLabel,
        stay: summary.stayCount || 0,
        resolved: summary.resolvedCount || 0,
      }),
      meta: tTabs('runtime_insights.intervention_meta_watch', {
        }),
    };
  }

  if (recovery?.suggested) {
    return {
      id: 'intervention',
      tone: recoveryAction === 'reviewGoal' ? 'warn' : 'active',
      title: tTabs(`runtime_insights.intervention_armed_title_${recoveryAction}`, {
        }),
      body: tTabs(`runtime_insights.intervention_armed_body_${recoveryAction}`, {
        action: actionLabel,
      }),
      meta: tTabs('runtime_insights.intervention_meta_state', {
        }),
    };
  }

  return {
    id: 'intervention',
    tone: 'muted',
    title: tTabs('runtime_insights.intervention_waiting_title', {
      }),
    body: tTabs('runtime_insights.intervention_waiting_body', {
      }),
    meta: tTabs('runtime_insights.intervention_meta_phase', {
      }),
  };
}

function resolveTargetInsight(normalizedSnapshot, tTabs) {
  const runtime = normalizedSnapshot.runtime;
  const strategy = runtime.strategy;
  const reviewGoalAction = buildReviewGoalAction(normalizedSnapshot, tTabs);

  if (!runtime.available || !strategy) {
    return {
      id: 'target',
      tone: 'muted',
      title: tTabs('runtime_insights.target_idle_title', {
        }),
      body: tTabs('runtime_insights.target_idle_body', {
        }),
      meta: '',
    };
  }

  const declared = Math.max(0, Number(strategy.declaredTargetMinutes) || 0);
  const recommendationReviewOnly = strategy.targetRecommendation?.role === PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE
    && strategy.targetRecommendation.requiresUserReview === true
    && strategy.targetRecommendation.autoApply === false;
  const recommended = recommendationReviewOnly
    ? Math.max(0, Number(strategy.targetRecommendation.recommendedTargetMinutes) || 0)
    : 0;
  const exceededDays = Math.max(0, Number(strategy.metrics?.exceededDaysInWindow) || 0);
  const recommendationGap = isMeaningfullyHigherRecommended(declared, recommended);

  if (recommendationGap && exceededDays >= 3) {
    return {
      id: 'target',
      tone: 'warn',
      title: tTabs('runtime_insights.target_review_title', {
        }),
      body: tTabs('runtime_insights.target_review_body', {
        declared,
        recommended,
      }),
      meta: tTabs('runtime_insights.target_meta_exceeded', {
        days: exceededDays,
      }),
      actions: reviewGoalAction ? [reviewGoalAction] : [],
    };
  }

  if (declared > 0 && recommended > 0 && recommended <= declared && exceededDays <= 1) {
    return {
      id: 'target',
      tone: 'ok',
      title: tTabs('runtime_insights.target_fit_title', {
        }),
      body: tTabs('runtime_insights.target_fit_body', {
        declared,
      }),
      meta: tTabs('runtime_insights.target_meta_fit', {
        }),
    };
  }

  return {
    id: 'target',
    tone: 'muted',
    title: tTabs('runtime_insights.target_watch_title', {
      }),
    body: tTabs('runtime_insights.target_watch_body', {
      }),
    meta: tTabs('runtime_insights.target_meta_declared', {
      declared,
    }),
    actions: [],
  };
}

export function buildProtectionRuntimeInsightCards(snapshot, tTabs) {
  const normalizedSnapshot = normalizeSnapshot(snapshot);
  return {
    snapshot: normalizedSnapshot,
    cards: [
      resolveInterventionInsight(normalizedSnapshot, tTabs),
      resolveTargetInsight(normalizedSnapshot, tTabs),
    ],
  };
}
