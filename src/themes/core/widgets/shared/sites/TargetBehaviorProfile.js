import { requireSitePullInterpretation } from '../../../../../domains/stats/insights/sitePull/sitePullInterpretation.js';
import { buildSitePullEvidenceReadout } from '../../../../../domains/stats/insights/sitePull/sitePullInterpretationEvidence.js';
import { formatSiteIntelReading, formatSiteIntelReadingMetric } from './siteIntelReading.js';
import { PERSONAL_BASELINE_STATUSES } from '../../../../../lib/personalBaselineContract.js';

const MINUTE_MS = 60_000;

export const TARGET_BEHAVIOR_FEEDBACK_SURFACES = Object.freeze({
  BADGE: 'badge',
  DETAIL: 'detail',
});

export const TARGET_BEHAVIOR_SURFACE_VISIBILITY = Object.freeze({
  VISIBLE: 'visible',
  DIAGNOSTIC: 'diagnostic',
});

export const TARGET_BEHAVIOR_CLAIM_VISIBILITY = Object.freeze({
  PRIMARY: 'primary_claim',
  SUPPORTING: 'supporting_evidence',
});

const TARGET_BEHAVIOR_BADGE_IDS = new Set([
  'goal_exceeded',
  'goal_exceeded_repeated',
  'goal_missing',
  'time_heavy_today',
  'personal_spike',
  'deep_immersion',
  'focused_block',
  'session_depth_spike',
  'checking_pattern',
  'checking_pattern_proxy',
  'visit_spike',
  'reentry_spike',
  'quick_return_loop',
  'switch_churn_loop',
  'checking_carousel',
  'session_fragmentation',
  'protected_route_return',
  'domain_pair_loop',
  'loop_route_hint',
  'habitual_entry',
  'reload_checking',
  'new_tab_loop',
  'duplicate_tab_entry',
  'tab_queue_pattern',
  'tab_hoarding_context',
  'background_residency',
  'feed_skimming',
  'feed_loop_pattern',
  'fast_scroll_bursts',
  'daily_habit',
  'rising_trend',
  'late_night',
  'late_night_binge',
  'intervention_resistance_loop',
  'intervention_reentry',
  'intervention_recovery',
  'controlled_brief_check',
  'goal_kept',
  'insufficient_data',
  'no_activity',
  'steady',
]);


const TARGET_BEHAVIOR_DECISION_QUALITY_STATUSES = new Set([
  'provisional',
  'supported',
  'strong',
]);

export function isKnownTargetBehaviorBadgeId(id) {
  return TARGET_BEHAVIOR_BADGE_IDS.has(id);
}

function requireKnownTargetBehaviorBadgeId(id) {
  if (!isKnownTargetBehaviorBadgeId(id)) {
    throw createSurfaceContractError('TARGET_BEHAVIOR_BADGE_ID_UNKNOWN', {
      patternId: id || null,
    });
  }
  return id;
}

function targetBehaviorPatternId(item) {
  return item?.patternId || item?.id || '';
}

function surfaceItems(profile, surface) {
  const items = profile?.feedbackSurfaces?.[surface];
  return Array.isArray(items) ? items : [];
}

function createSurfaceContractError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  return error;
}

function allowedClaimVisibilityForSurface(surface) {
  if (surface === TARGET_BEHAVIOR_FEEDBACK_SURFACES.BADGE) {
    return [TARGET_BEHAVIOR_CLAIM_VISIBILITY.PRIMARY];
  }
  if (surface === TARGET_BEHAVIOR_FEEDBACK_SURFACES.DETAIL) {
    return [
      TARGET_BEHAVIOR_CLAIM_VISIBILITY.PRIMARY,
      TARGET_BEHAVIOR_CLAIM_VISIBILITY.SUPPORTING,
    ];
  }
  throw createSurfaceContractError('TARGET_BEHAVIOR_SURFACE_UNKNOWN', { surface });
}

export function assertTargetBehaviorSurfaceItemContract(item, expectedSurface) {
  const patternId = targetBehaviorPatternId(item);
  if (item?.surface !== expectedSurface) {
    throw createSurfaceContractError('TARGET_BEHAVIOR_SURFACE_ITEM_SURFACE_MISMATCH', {
      expectedSurface,
      itemSurface: item?.surface || null,
      patternId,
    });
  }
  if (item?.visibility !== TARGET_BEHAVIOR_SURFACE_VISIBILITY.VISIBLE) {
    throw createSurfaceContractError('TARGET_BEHAVIOR_SURFACE_ITEM_VISIBILITY_INVALID', {
      expectedVisibility: TARGET_BEHAVIOR_SURFACE_VISIBILITY.VISIBLE,
      itemVisibility: item?.visibility || null,
      patternId,
    });
  }
  if (item?.surfaceVisibility !== TARGET_BEHAVIOR_SURFACE_VISIBILITY.VISIBLE) {
    throw createSurfaceContractError('TARGET_BEHAVIOR_SURFACE_ITEM_SURFACE_VISIBILITY_INVALID', {
      expectedSurfaceVisibility: TARGET_BEHAVIOR_SURFACE_VISIBILITY.VISIBLE,
      itemSurfaceVisibility: item?.surfaceVisibility || null,
      patternId,
    });
  }

  const allowedClaimVisibilities = allowedClaimVisibilityForSurface(expectedSurface);
  if (!allowedClaimVisibilities.includes(item?.claimVisibility)) {
    throw createSurfaceContractError('TARGET_BEHAVIOR_SURFACE_ITEM_CLAIM_VISIBILITY_INVALID', {
      allowedClaimVisibilities,
      itemClaimVisibility: item?.claimVisibility || null,
      patternId,
    });
  }
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value) {
  return `${Math.round(clamp(Number(value) || 0, 0, 1) * 100)}%`;
}

function formatMinutesValue(valueMs, t) {
  return t('target_profile.metric_minutes', {
    value: Math.round(toNumber(valueMs) / MINUTE_MS),
  });
}

function buildPatternEvidenceChips(item, t) {
  return buildSitePullEvidenceReadout(item).metrics.map((metric) => formatSiteIntelReadingMetric(metric, t)).filter(Boolean);
}

function resolveEvidenceWhy(item, t) {
  const family = item?.recommendationFamily || 'none';
  const role = item?.role || '';
  if (role === 'supporting_evidence') {
    return t('target_profile.evidence_why_supporting', {});
  }
  const keyByFamily = {
    goal: 'goal',
    time_boundary: 'time_boundary',
    checking_cooldown: 'checking_cooldown',
    session_checkin: 'session_checkin',
    night_guard: 'night_guard',
    scroll_guard: 'scroll_guard',
    tab_review: 'tab_review',
    background_review: 'background_review',
    friction_tuning: 'friction_tuning',
    weekly_review: 'weekly_review',
    maintain: 'maintain',
  };
  return t(`target_profile.evidence_why_${keyByFamily[family] || 'observed'}`, {});
}

function resolveConfidenceLabel(confidence, t) {
  const value = toNumber(confidence);
  if (value >= 0.8) return t('target_profile.confidence_stable', {});
  if (value >= 0.6) return t('target_profile.confidence_solid', {});
  if (value >= 0.35) return t('target_profile.confidence_provisional', {});
  return t('target_profile.confidence_sparse', {});
}

function resolvePatternEvidenceQuality(item, t) {
  const decisionQuality = item?.decisionQuality;
  if (decisionQuality === null || decisionQuality === undefined) {
    throw createSurfaceContractError('TARGET_BEHAVIOR_DECISION_QUALITY_MISSING', {
      patternId: targetBehaviorPatternId(item),
    });
  }
  if (!decisionQuality || typeof decisionQuality !== 'object' || Array.isArray(decisionQuality)) {
    throw createSurfaceContractError('TARGET_BEHAVIOR_DECISION_QUALITY_INVALID', {
      patternId: targetBehaviorPatternId(item),
    });
  }
  const status = decisionQuality.status;
  const score = Number(decisionQuality.score);
  if (
    !TARGET_BEHAVIOR_DECISION_QUALITY_STATUSES.has(status)
    || !Number.isFinite(score)
    || score < 0
    || score > 1
    || typeof decisionQuality.nearBoundary !== 'boolean'
  ) {
    throw createSurfaceContractError('TARGET_BEHAVIOR_DECISION_QUALITY_INVALID', {
      patternId: targetBehaviorPatternId(item),
      status: status || null,
      score: Number.isFinite(score) ? score : null,
    });
  }
  return {
    source: 'decision_quality',
    status,
    score: Math.round(score * 100),
    label: t(`target_profile.decision_quality_${status}`, {}),
    nearBoundary: decisionQuality.nearBoundary,
  };
}

function resolveNudgeTone(type) {
  if (type === 'goal_reflection' || type === 'friction_step_up') return 'warning';
  if (type === 'cooldown' || type === 'session_checkin' || type === 'night_guard') return 'warning';
  if (type === 'maintain' || type === 'none') return 'positive';
  return 'neutral';
}

function resolveNudgeCopy(recommendedNudge, t) {
  if (!recommendedNudge?.type) return null;
  const type = recommendedNudge.type;
  const actionId = recommendedNudge.actionId || '';
  let message = t('target_profile.nudge_message_gentle_pause', {});
  if (type === 'none') message = t('target_profile.nudge_message_none', {});
  if (type === 'set_goal') message = t('target_profile.nudge_message_set_goal', {});
  if (type === 'friction_step_up') message = t('target_profile.nudge_message_friction_step_up', {});
  if (type === 'goal_reflection') message = t('target_profile.nudge_message_goal_reflection', {});
  if (type === 'cooldown') message = t('target_profile.nudge_message_cooldown', {});
  if (type === 'session_checkin') message = t('target_profile.nudge_message_session_checkin', {});
  if (type === 'night_guard') message = t('target_profile.nudge_message_night_guard', {});
  if (type === 'weekly_review') message = t('target_profile.nudge_message_weekly_review', {});
  if (type === 'maintain') message = t('target_profile.nudge_message_maintain', {});

  let action = t('target_profile.nudge_action_confirm_intent', {});
  if (actionId === 'observe') action = t('target_profile.nudge_action_observe', {});
  if (actionId === 'set_daily_goal') action = t('target_profile.nudge_action_set_daily_goal', {});
  if (actionId === 'increase_friction') action = t('target_profile.nudge_action_increase_friction', {});
  if (actionId === 'enable_goal_pause') action = t('target_profile.nudge_action_enable_goal_pause', {});
  if (actionId === 'enable_cooldown') action = t('target_profile.nudge_action_enable_cooldown', {});
  if (actionId === 'enable_session_checkin') action = t('target_profile.nudge_action_enable_session_checkin', {});
  if (actionId === 'enable_night_guard') action = t('target_profile.nudge_action_enable_night_guard', {});
  if (actionId === 'review_weekly_goal') action = t('target_profile.nudge_action_review_weekly_goal', {});
  if (actionId === 'hold_course') action = t('target_profile.nudge_action_hold_course', {});

  return {
    title: t('target_profile.nudge_title', {}),
    message,
    action,
    tone: resolveNudgeTone(type),
  };
}

export function resolveTargetBehaviorBadgeCopy(badge, t) {
  const id = requireKnownTargetBehaviorBadgeId(targetBehaviorPatternId(badge));
  const evidence = badge?.evidence || {};
  if (id === 'goal_exceeded_repeated') {
    return {
      label: t('target_profile.badge_plan_missed_repeated', {}),
      detail: t('target_profile.badge_plan_missed_repeated_detail', {
        value: Math.round(toNumber(evidence.usageRatio) * 100),
        days: Math.round(toNumber(evidence.overLimitDays)),
      }),
    };
  }
  if (id === 'goal_exceeded') {
    return {
      label: t('target_profile.badge_plan_missed', {}),
      detail: t('target_profile.badge_plan_missed_detail', {
        value: Math.round(toNumber(evidence.usageRatio) * 100),
      }),
    };
  }
  if (id === 'goal_missing') {
    return {
      label: t('target_profile.badge_goal_missing', {}),
      detail: t('target_profile.badge_goal_missing_detail', {
        today: formatMinutesValue(evidence.todayMs, t),
        visits: Math.round(toNumber(evidence.todayVisits)),
      }),
    };
  }
  if (id === 'time_heavy_today') {
    const channelIds = Array.isArray(evidence.timePressureChannelIds)
      ? evidence.timePressureChannelIds
      : [];
    if (evidence.timePressureStatus === 'unusually_heavy_for_you') {
      return {
        label: t('target_profile.badge_excessive_time', {}),
        detail: t('target_profile.badge_excessive_time_baseline_detail', {
          today: Math.round(toNumber(evidence.todayMs) / MINUTE_MS),
          ratio: Math.round(toNumber(evidence.todayVsP75Ratio) * 10) / 10,
        }),
      };
    }
    if (channelIds.includes('weekly_lift')) {
      return {
        label: t('target_profile.badge_excessive_time', {}),
        detail: t('target_profile.badge_excessive_time_weekly_detail', {
          today: Math.round(toNumber(evidence.todayMs) / MINUTE_MS),
          ratio: Math.round(toNumber(evidence.todayVsWeeklyRatio) * 10) / 10,
        }),
      };
    }
    return {
      label: t('target_profile.badge_excessive_time', {}),
      detail: t('target_profile.badge_excessive_time_detail_simple', {
        today: Math.round(toNumber(evidence.todayMs) / MINUTE_MS),
      }),
    };
  }
  if (id === 'personal_spike') {
    return {
      label: t('target_profile.badge_personal_spike', {}),
      detail: t('target_profile.badge_personal_spike_detail', {
        today: Math.round(toNumber(evidence.todayMs) / MINUTE_MS),
        baseline: Math.round(toNumber(evidence.p75ReferenceMs) / MINUTE_MS),
        ratio: Math.round(toNumber(evidence.todayVsP75Ratio) * 10) / 10,
      }),
    };
  }
  if (id === 'deep_immersion') {
    const channelIds = Array.isArray(evidence.absorptionSupportChannelIds)
      ? evidence.absorptionSupportChannelIds
      : [];
    if (channelIds.includes('same_day_returns')) {
      return {
        label: t('target_profile.badge_high_immersion', {}),
        detail: t('target_profile.badge_high_immersion_exit_detail', {
          duration: formatMinutesValue(evidence.sustainedBlockMs, t),
        }),
      };
    }
    if (channelIds.includes('feed_continuity')) {
      return {
        label: t('target_profile.badge_high_immersion', {}),
        detail: t('target_profile.badge_high_immersion_feed_detail', {
          duration: formatMinutesValue(evidence.sustainedBlockMs, t),
        }),
      };
    }
    if (channelIds.includes('navigation_continuity')) {
      return {
        label: t('target_profile.badge_high_immersion', {}),
        detail: t('target_profile.badge_high_immersion_navigation_detail', {
          duration: formatMinutesValue(evidence.sustainedBlockMs, t),
        }),
      };
    }
    return {
      label: t('target_profile.badge_high_immersion', {}),
      detail: t('target_profile.badge_high_immersion_detail_no_window', {}),
    };
  }
  if (id === 'focused_block') {
    return {
      label: t('target_profile.badge_focused_block', {}),
      detail: t('target_profile.badge_focused_block_detail', {
        duration: formatMinutesValue(evidence.sustainedBlockMs || evidence.todayMs, t),
      }),
    };
  }
  if (id === 'session_depth_spike') {
    return {
      label: t('target_profile.badge_session_depth_spike', {}),
      detail: t('target_profile.badge_session_depth_spike_detail', {
        today: Math.round(toNumber(evidence.todayMaxSessionMs) / MINUTE_MS),
        baseline: Math.round(toNumber(evidence.maxSessionP75Ms) / MINUTE_MS),
      }),
    };
  }
  if (id === 'session_fragmentation') {
    return {
      label: t('target_profile.badge_session_fragmentation', {}),
      detail: t('target_profile.badge_session_fragmentation_detail', {
        short: Math.round(toNumber(evidence.shortSessionCount)),
        total: Math.round(toNumber(evidence.sessionCount || evidence.measuredSessionCount)),
      }),
    };
  }
  if (id === 'checking_pattern') {
    return {
      label: t('target_profile.badge_habitual_checking', {}),
      detail: t('target_profile.badge_habitual_checking_visit_detail', {
        visits: Math.round(toNumber(evidence.todayVisits)),
        hours: Math.round(toNumber(evidence.visitHoursToday)),
      }),
    };
  }
  if (id === 'checking_pattern_proxy') {
    return {
      label: t('target_profile.badge_habitual_checking', {}),
      detail: t('target_profile.badge_habitual_checking_proxy_detail', {
        todayHours: Math.round(toNumber(evidence.activeHoursToday)),
        habitHours: Math.round(toNumber(evidence.activeHoursHabit)),
      }),
    };
  }
  if (id === 'visit_spike') {
    return {
      label: t('target_profile.badge_visit_spike', {}),
      detail: t('target_profile.badge_visit_spike_detail', {
        visits: Math.round(toNumber(evidence.todayVisits)),
        baseline: Math.round(toNumber(evidence.visitP75)),
        ratio: Math.round(toNumber(evidence.todayVsVisitP75Ratio) * 10) / 10,
      }),
    };
  }
  if (id === 'reentry_spike') {
    return {
      label: t('target_profile.badge_reentry_spike', {}),
      detail: t('target_profile.badge_reentry_spike_detail', {
        reentries: Math.round(toNumber(evidence.todayRevisitWithin10m)),
        baseline: Math.round(toNumber(evidence.revisitP75)),
      }),
    };
  }
  if (id === 'quick_return_loop') {
    return {
      label: t('target_profile.badge_quick_return_loop', {}),
      detail: t('target_profile.badge_quick_return_loop_detail', {
        returns: Math.round(toNumber(evidence.todaySwitchBackWithin10m)),
        entries: Math.round(toNumber(evidence.todaySwitchIns)),
        rate: Math.round(toNumber(evidence.todayQuickReturnRate) * 100),
      }),
    };
  }
  if (id === 'switch_churn_loop') {
    return {
      label: t('target_profile.badge_switch_churn_loop', {}),
      detail: t('target_profile.badge_switch_churn_loop_detail', {
        switches: Math.round(toNumber(evidence.todaySwitchChurn)),
        baseline: Math.round(toNumber(evidence.switchChurnP75)),
        ratio: Math.round(toNumber(evidence.todayVsSwitchChurnP75Ratio) * 10) / 10,
      }),
    };
  }
  if (id === 'checking_carousel') {
    return {
      label: t('target_profile.badge_checking_carousel', {}),
      detail: t('target_profile.badge_checking_carousel_detail', {
        visits: Math.round(toNumber(evidence.todayVisits)),
        switches: Math.round(toNumber(evidence.todaySwitchChurn)),
        returns: Math.round(toNumber(evidence.todaySwitchBackWithin10m)),
      }),
    };
  }
  if (id === 'protected_route_return') {
    return {
      label: t('target_profile.badge_protected_route_return', {}),
      detail: t('target_profile.badge_protected_route_return_detail', {
        returns: Math.round(Math.max(
          toNumber(evidence.protectedRouteReturnEvents),
          toNumber(evidence.returnWithin10m),
          toNumber(evidence.transitionEdgeReturnWithin10m),
        )),
      }),
    };
  }
  if (id === 'domain_pair_loop') {
    return {
      label: t('target_profile.badge_domain_pair_loop', {}),
      detail: t('target_profile.badge_domain_pair_loop_detail', {
        from: evidence.fromDomain || '',
        to: evidence.toDomain || '',
        count: Math.round(toNumber(evidence.count)),
        returns: Math.round(toNumber(evidence.returnWithin10m)),
      }),
    };
  }
  if (id === 'loop_route_hint') {
    return {
      label: t('target_profile.badge_loop_route_hint', {}),
      detail: t('target_profile.badge_loop_route_hint_detail', {
        count: Math.round(toNumber(evidence.count)),
        edges: Math.round(toNumber(evidence.distinctEdgeCount)),
        returns: Math.round(toNumber(evidence.returnWithin10m)),
      }),
    };
  }
  if (id === 'habitual_entry') {
    return {
      label: t('target_profile.badge_habitual_entry', {}),
      detail: t('target_profile.badge_habitual_entry_detail', {
        entries: Math.round(toNumber(evidence.typedEntrances)),
        total: Math.round(toNumber(evidence.totalNavigations)),
      }),
    };
  }
  if (id === 'reload_checking') {
    return {
      label: t('target_profile.badge_reload_checking', {}),
      detail: t('target_profile.badge_reload_checking_detail', {
        reloads: Math.round(toNumber(evidence.reloads)),
        total: Math.round(toNumber(evidence.totalNavigations)),
      }),
    };
  }
  if (id === 'new_tab_loop') {
    return {
      label: t('target_profile.badge_new_tab_loop', {}),
      detail: t('target_profile.badge_new_tab_loop_detail', {
        entries: Math.round(toNumber(evidence.newTabEntrances)),
      }),
    };
  }
  if (id === 'duplicate_tab_entry') {
    return {
      label: t('target_profile.badge_duplicate_tab_entry', {}),
      detail: t('target_profile.badge_duplicate_tab_entry_detail', {
        entries: Math.round(toNumber(evidence.duplicateTabEntrances)),
        max: Math.round(toNumber(evidence.maxSameDomainOpenTabs)),
      }),
    };
  }
  if (id === 'tab_queue_pattern') {
    return {
      label: t('target_profile.badge_tab_queue_pattern', {}),
      detail: t('target_profile.badge_tab_queue_pattern_detail', {
        newTabs: Math.round(toNumber(evidence.newTabEntrances)),
        duplicates: Math.round(toNumber(evidence.duplicateTabEntrances)),
        max: Math.round(toNumber(evidence.maxSameDomainOpenTabs)),
      }),
    };
  }
  if (id === 'tab_hoarding_context') {
    return {
      label: t('target_profile.badge_tab_hoarding_context', {}),
      detail: t('target_profile.badge_tab_hoarding_context_detail', {
        max: Math.round(toNumber(evidence.maxOpenTabs)),
      }),
    };
  }
  if (id === 'background_residency') {
    const weekly = evidence.evidenceWindow === 'weekly';
    return {
      label: t('target_profile.badge_background_residency', {}),
      detail: t(weekly ? 'target_profile.badge_background_residency_weekly_detail'
        : 'target_profile.badge_background_residency_detail', {
        media: formatMinutesValue(weekly ? evidence.weeklyBackgroundMediaMs : evidence.backgroundMediaMs, t),
        linger: formatMinutesValue(weekly ? evidence.weeklyBackgroundLingerMs : evidence.backgroundLingerMs, t),
        stale: formatMinutesValue(weekly ? evidence.weeklyStaleTabMs : evidence.staleTabMs, t),
      }),
    };
  }
  if (id === 'feed_skimming') {
    return {
      label: t('target_profile.badge_feed_skimming', {}),
      detail: t('target_profile.badge_feed_skimming_detail', {
        signals: Math.round(toNumber(evidence.feedSkimSignals)),
        screenfuls: Math.round(toNumber(evidence.maxFeedScreenfuls)),
      }),
    };
  }
  if (id === 'feed_loop_pattern') {
    return {
      label: t('target_profile.badge_feed_loop_pattern', {}),
      detail: t('target_profile.badge_feed_loop_pattern_detail', {
        advances: Math.round(toNumber(evidence.feedAdvanceBursts)),
        pressure: Math.round(toNumber(evidence.feedPressureSignals) + toNumber(evidence.feedInterruptSignals)),
      }),
    };
  }
  if (id === 'fast_scroll_bursts') {
    return {
      label: t('target_profile.badge_fast_scroll_bursts', {}),
      detail: t('target_profile.badge_fast_scroll_bursts_detail', {
        bursts: Math.round(Math.max(
          toNumber(evidence.fastScrollBursts),
          toNumber(evidence.scrollSpikeBursts),
        )),
      }),
    };
  }
  if (id === 'daily_habit') {
    return {
      label: t('target_profile.badge_daily_habit', {}),
      detail: t('target_profile.badge_daily_habit_detail', {
        days: Math.round(toNumber(evidence.activeDays)),
        observed: Math.round(toNumber(evidence.weeklyDays)),
        streak: Math.round(toNumber(evidence.streakDays)),
      }),
    };
  }
  if (id === 'rising_trend') {
    return {
      label: t('target_profile.badge_rising', {}),
      detail: t('target_profile.badge_rising_detail', {
        value: Math.round(Math.max(0, toNumber(evidence.trendRatio) - 1) * 100),
      }),
    };
  }
  if (id === 'late_night') {
    return {
      label: t('target_profile.badge_late_night', {}),
      detail: t('target_profile.badge_late_night_detail', {
        value: Math.round(toNumber(evidence.nightMsToday) / MINUTE_MS),
      }),
    };
  }
  if (id === 'late_night_binge') {
    return {
      label: t('target_profile.badge_late_night_binge', {}),
      detail: t('target_profile.badge_late_night_binge_detail', {
        night: Math.round(toNumber(evidence.nightMsToday) / MINUTE_MS),
        duration: formatMinutesValue(evidence.sustainedBlockMs || evidence.todayMs, t),
      }),
    };
  }
  if (id === 'intervention_resistance_loop') {
    return {
      label: t('target_profile.badge_intervention_resistance_loop', {}),
      detail: t('target_profile.badge_intervention_resistance_loop_detail', {
        shown: Math.round(toNumber(evidence.frictionShown)),
        reentries: Math.round(toNumber(evidence.reenteredWithin30m)),
      }),
    };
  }
  if (id === 'intervention_reentry') {
    return {
      label: t('target_profile.badge_intervention_reentry', {}),
      detail: t('target_profile.badge_intervention_reentry_detail', {
        shown: Math.round(toNumber(evidence.frictionShown)),
        reentries: Math.round(toNumber(evidence.reenteredWithin30m)),
      }),
    };
  }
  if (id === 'intervention_recovery') {
    return {
      label: t('target_profile.badge_intervention_recovery', {}),
      detail: t('target_profile.badge_intervention_recovery_detail', {
        shown: Math.round(toNumber(evidence.frictionShown)),
        left: Math.round(toNumber(evidence.left)),
      }),
    };
  }
  if (id === 'controlled_brief_check') {
    return {
      label: t('target_profile.badge_brief_check_observed', {}),
      detail: t('target_profile.badge_brief_check_observed_detail', {
        duration: formatMinutesValue(evidence.todayMs, t),
        count: Math.round(toNumber(evidence.sessionCount)),
      }),
    };
  }
  if (id === 'goal_kept') {
    return {
      label: t('target_profile.badge_goal_kept', {}),
      detail: t('target_profile.badge_goal_kept_detail', {
        value: Math.round(toNumber(evidence.usageRatio) * 100),
        today: formatMinutesValue(evidence.todayMs, t),
      }),
    };
  }
  if (id === 'insufficient_data') {
    return {
      label: t('target_profile.badge_insufficient_data', {}),
      detail: t('target_profile.badge_insufficient_data_detail', {
        confidence: formatPercent(evidence.confidence),
      }),
    };
  }
  if (id === 'no_activity') {
    return {
      label: t('target_profile.badge_no_activity', {}),
      detail: t('target_profile.badge_no_activity_detail', {}),
    };
  }
  if (id === 'steady') {
    return {
      label: t('target_profile.badge_steady', {}),
      detail: t('target_profile.badge_steady_detail', {
        today: formatMinutesValue(evidence.todayMs, t),
        confidence: formatPercent(evidence.confidence ?? badge?.confidence),
      }),
    };
  }
  throw createSurfaceContractError('TARGET_BEHAVIOR_BADGE_COPY_UNHANDLED', {
    patternId: id,
  });
}

function buildBehaviorDisplayItem(item, t, { expectedSurface, readout = null, formattedReadout = null } = {}) {
  if (expectedSurface) {
    assertTargetBehaviorSurfaceItemContract(item, expectedSurface);
  }
  const id = targetBehaviorPatternId(item);
  const copy = resolveTargetBehaviorBadgeCopy(item, t);
  if (expectedSurface === TARGET_BEHAVIOR_FEEDBACK_SURFACES.DETAIL && (!readout || !formattedReadout)) {
    throw new Error('SITE_INTEL_READING_CLAIM_MISSING');
  }
  const evidenceChips = formattedReadout ? formattedReadout.metrics : buildPatternEvidenceChips(item, t);
  const claimVisibility = item?.claimVisibility;
  const confidence = Math.round(toNumber(item?.confidence) * 100);
  const evidenceQuality = resolvePatternEvidenceQuality(item, t);
  return {
    id,
    patternId: id,
    surfaceItemId: item?.surfaceItemId || null,
    surface: item?.surface || null,
    visibility: item?.visibility || null,
    surfaceVisibility: item?.surfaceVisibility || null,
    claimVisibility,
    isPrimaryClaim: claimVisibility === TARGET_BEHAVIOR_CLAIM_VISIBILITY.PRIMARY,
    isSupportingEvidence: claimVisibility === TARGET_BEHAVIOR_CLAIM_VISIBILITY.SUPPORTING,
    label: copy.label,
    tone: item?.tone || 'neutral',
    detail: formattedReadout ? formattedReadout.headline : copy.detail,
    limitations: formattedReadout ? formattedReadout.limitations : [],
    why: formattedReadout ? formattedReadout.limitations.join(' ') : resolveEvidenceWhy(item, t),
    evidenceChips,
    confidence,
    decisionQuality: item?.decisionQuality || null,
    evidenceQualitySource: evidenceQuality.source,
    evidenceQualityStatus: evidenceQuality.status,
    evidenceQualityScore: evidenceQuality.score,
    evidenceQualityLabel: evidenceQuality.label,
    nearDecisionBoundary: evidenceQuality.nearBoundary,
    claimLabel: claimVisibility === TARGET_BEHAVIOR_CLAIM_VISIBILITY.PRIMARY
      ? t('target_profile.claim_primary', {})
      : t('target_profile.claim_supporting', {}),
    category: item?.category || '',
    role: item?.role || null,
    recommendationFamily: item?.recommendationFamily || null,
  };
}

function formatContributionValue(row, viewModel, t) {
  const evidence = row?.evidence || {};
  if (row?.feature === 'timePressure') {
    const baseline = evidence.personalBaseline || {};
    if (toNumber(baseline.confidence) >= 0.35) {
      return t('target_profile.contribution_value_time_personal', {
        today: formatMinutesValue(evidence.todayMs, t),
        baseline: formatMinutesValue(baseline.p75ReferenceMs, t),
        ratio: Math.round(toNumber(baseline.todayVsP75Ratio) * 10) / 10,
      });
    }
    return t('target_profile.contribution_value_time', {
      today: formatMinutesValue(evidence.todayMs, t),
      average: formatMinutesValue(evidence.weeklyAverageMs, t),
    });
  }
  if (row?.feature === 'planFriction') {
    if (evidence.hasGoal) {
      return t('target_profile.contribution_value_goal', {
        today: formatMinutesValue(evidence.todayMs, t),
        goal: t('target_profile.metric_minutes', { value: Math.round(toNumber(evidence.goalMinutes)) }),
      });
    }
    return t('target_profile.contribution_value_goal_unset', {});
  }
  if (row?.feature === 'checkingLoop') {
    const baseline = evidence.personalBaseline || {};
    if (
      toNumber(baseline.visitConfidence) >= 0.35
      || toNumber(baseline.revisitConfidence) >= 0.35
      || toNumber(baseline.loopConfidence) >= 0.35
    ) {
      return t('target_profile.contribution_value_checking_personal', {
        visits: Math.round(toNumber(baseline.todayVisits)),
        visitBaseline: Math.round(toNumber(baseline.visitP75)),
        reentries: Math.round(toNumber(baseline.todayRevisitWithin10m)),
        switches: Math.round(toNumber(baseline.todaySwitchChurn)),
        returns: Math.round(toNumber(baseline.todaySwitchBackWithin10m)),
      });
    }
    if (evidence.hasVisitFacts) {
      if (evidence.hasTransitionEdgeFacts) {
        return t('target_profile.contribution_value_checking_edges', {
          visits: Math.round(toNumber(evidence.todayVisits)),
          edges: Math.round(toNumber(evidence.transitionEdgeDistinctCount)),
          switches: Math.round(toNumber(evidence.transitionEdgeCount)),
          returns: Math.round(toNumber(evidence.transitionEdgeReturnWithin10m)),
        });
      }
      if (evidence.feedSkimSignals > 0 || evidence.feedAdvanceBursts > 0) {
        return t('target_profile.contribution_value_checking_feed', {
          visits: Math.round(toNumber(evidence.todayVisits)),
          skim: Math.round(toNumber(evidence.feedSkimSignals)),
          advances: Math.round(toNumber(evidence.feedAdvanceBursts)),
        });
      }
      if (evidence.hasNavigationFacts) {
        return t('target_profile.contribution_value_checking_navigation', {
          visits: Math.round(toNumber(evidence.todayVisits)),
          typed: Math.round(toNumber(evidence.typedEntrances) + toNumber(evidence.addressBarEntrances)),
          reloads: Math.round(toNumber(evidence.reloads)),
        });
      }
      if (evidence.newTabEntrances > 0 || evidence.duplicateTabEntrances > 0) {
        return t('target_profile.contribution_value_checking_tabs', {
          visits: Math.round(toNumber(evidence.todayVisits)),
          newTabs: Math.round(toNumber(evidence.newTabEntrances)),
          duplicates: Math.round(toNumber(evidence.duplicateTabEntrances)),
        });
      }
      return t('target_profile.contribution_value_checking_visits', {
        visits: Math.round(toNumber(evidence.todayVisits)),
        hours: Math.round(toNumber(evidence.visitHoursToday)),
      });
    }
    return t('target_profile.contribution_value_checking_proxy', {
      todayHours: Math.round(toNumber(evidence.activeHoursToday)),
      habitHours: Math.round(toNumber(evidence.activeHoursHabit)),
    });
  }
  if (row?.feature === 'immersionDepth') {
    const baseline = evidence.personalBaseline || {};
    if (toNumber(baseline.sessionConfidence) >= 0.35 && toNumber(baseline.todayMaxSessionMs) > 0) {
      return t('target_profile.contribution_value_immersion_personal', {
        today: formatMinutesValue(baseline.todayMaxSessionMs, t),
        baseline: formatMinutesValue(baseline.maxSessionP75Ms, t),
      });
    }
    return t('target_profile.contribution_value_immersion', {
      duration: formatMinutesValue(evidence.max3hTodayMs, t),
      share: formatPercent(evidence.dominantTodayShare),
    });
  }
  if (row?.feature === 'habitRegularity') {
    return t('target_profile.contribution_value_habit', {
      days: Math.round(toNumber(evidence.activeDays)),
      streak: Math.round(toNumber(evidence.streakDays)),
    });
  }
  if (row?.feature === 'trendAcceleration') {
    return t('target_profile.contribution_value_trend', {
      baseline: formatMinutesValue(evidence.baselineAverageMs, t),
      recent: formatMinutesValue(evidence.recentAverageMs, t),
    });
  }
  if (row?.feature === 'circadianRisk') {
    return t('target_profile.contribution_value_night', {
      duration: formatMinutesValue(evidence.nightMsToday, t),
    });
  }
  if (row?.feature === 'interventionResistance') {
    return t('target_profile.contribution_value_intervention', {
      shown: Math.round(toNumber(evidence.frictionShown)),
      reentries: Math.round(Math.max(
        toNumber(evidence.reenteredWithin5m),
        toNumber(evidence.reenteredWithin30m),
      )),
    });
  }
  return viewModel?.hasAnyData ? t('target_profile.contribution_value_observed', {}) : t('target_profile.contribution_value_empty', {});
}

function resolveContributionLabel(row, t) {
  const id = row?.id || '';
  if (id === 'time_pressure') return t('target_profile.contribution_time_pressure', {});
  if (id === 'plan_friction') return t('target_profile.contribution_plan_friction', {});
  if (id === 'checking_loop') return t('target_profile.contribution_checking_loop', {});
  if (id === 'immersion_depth') return t('target_profile.contribution_immersion_depth', {});
  if (id === 'habit_regularity') return t('target_profile.contribution_habit_regularity', {});
  if (id === 'trend_acceleration') return t('target_profile.contribution_trend_acceleration', {});
  if (id === 'circadian_risk') return t('target_profile.contribution_circadian_risk', {});
  if (id === 'intervention_resistance') return t('target_profile.contribution_intervention_resistance', {});
  return id;
}

function formatDriver(row, viewModel, t) {
  const label = resolveContributionLabel(row, t);
  const value = formatContributionValue(row, viewModel, t);
  return t('target_profile.driver_contribution', {
    label,
    value,
    contribution: Math.round(toNumber(row?.contribution)),
  });
}

function buildDataBasisItems(sitePullProfile, t) {
  const dataCoverage = sitePullProfile?.dataCoverage || {};
  const baseline = sitePullProfile?.personalBaseline || {};
  const baselineStatus = baseline?.status;
  if (!Object.values(PERSONAL_BASELINE_STATUSES).includes(baselineStatus)) {
    throw new Error('TARGET_BEHAVIOR_PERSONAL_BASELINE_STATUS_INVALID');
  }
  const sessionValue = dataCoverage.hasSessionFacts
    ? t('target_profile.data_basis_measured', {})
    : dataCoverage.hasEstimatedSessionFacts
      ? t('target_profile.data_basis_estimated', {})
      : t('target_profile.data_basis_missing', {});
  const baselineValue = baselineStatus === PERSONAL_BASELINE_STATUSES.STABLE
    ? t('target_profile.data_basis_stable', {})
    : baselineStatus === PERSONAL_BASELINE_STATUSES.FORMING
      ? t('target_profile.data_basis_forming', {})
      : t('target_profile.data_basis_sparse', {});

  return [
    {
      id: 'usage',
      label: t('target_profile.data_basis_usage', {}),
      value: dataCoverage.hasUsageFacts ? t('target_profile.data_basis_present', {}) : t('target_profile.data_basis_missing', {}),
    },
    {
      id: 'visits',
      label: t('target_profile.data_basis_visits', {}),
      value: dataCoverage.hasEntryFacts ? t('target_profile.data_basis_present', {}) : t('target_profile.data_basis_time_proxy', {}),
    },
    {
      id: 'sessions',
      label: t('target_profile.data_basis_sessions', {}),
      value: sessionValue,
    },
    {
      id: 'routes',
      label: t('target_profile.data_basis_routes', {}),
      value: dataCoverage.hasTransitionEdgeFacts ? t('target_profile.data_basis_present', {}) : t('target_profile.data_basis_missing', {}),
    },
    {
      id: 'baseline',
      label: t('target_profile.data_basis_baseline', {}),
      value: baselineValue,
    },
  ];
}

export function buildTargetBehaviorProfile({
  intel,
  viewModel,
  t,
} = {}) {
  if (!viewModel || typeof t !== 'function') return null;

  const sitePullProfile = intel?.sitePullProfile || null;
  if (!sitePullProfile || typeof sitePullProfile !== 'object') return null;

  const interpretation = requireSitePullInterpretation(sitePullProfile);
  const reading = formatSiteIntelReading(interpretation, t);
  const readouts = new Map(interpretation.reading.claims.map((claim) => [claim.surfaceItemId, claim]));
  const formattedReadouts = new Map(reading.claims.map((claim) => [claim.surfaceItemId, claim]));
  const rawBadges = surfaceItems(sitePullProfile, 'badge');
  const rawDetailItems = surfaceItems(sitePullProfile, 'detail');
  const badges = rawBadges.map((badge) => buildBehaviorDisplayItem(badge, t, {
    expectedSurface: TARGET_BEHAVIOR_FEEDBACK_SURFACES.BADGE,
  }));
  const detailItems = rawDetailItems.map((item) => buildBehaviorDisplayItem(item, t, {
    expectedSurface: TARGET_BEHAVIOR_FEEDBACK_SURFACES.DETAIL,
    readout: readouts.get(item.surfaceItemId),
    formattedReadout: formattedReadouts.get(item.surfaceItemId),
  }));
  const orderedDetailItems = interpretation.reading.expandedSurfaceItemIds.map((id) =>
    detailItems.find((item) => item.surfaceItemId === id));
  const contributionBreakdown = Array.isArray(sitePullProfile.contributionBreakdown)
    ? sitePullProfile.contributionBreakdown
    : [];
  const topContributions = contributionBreakdown
    .filter((row) => toNumber(row?.weight) > 0)
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      label: resolveContributionLabel(row, t),
      value: formatContributionValue(row, viewModel, t),
      score: t('target_profile.contribution_score', {
        contribution: Math.round(toNumber(row.contribution)),
        weight: Math.round(toNumber(row.weight)),
      }),
      ratio: toNumber(row.weight) > 0 ? clamp(toNumber(row.contribution) / toNumber(row.weight), 0, 1) : 0,
      tone: row.contribution >= 10 ? 'warning' : 'neutral',
      title: t('target_profile.contribution_confidence', {
        value: Math.round(toNumber(row.confidence) * 100),
      }),
    }));
  const todayMinutes = Math.round(toNumber(viewModel.todayTotal) / MINUTE_MS);
  const weeklyAverageMinutes = Math.round(toNumber(viewModel.weeklyAverageMs) / MINUTE_MS);
  const activeDays = Math.round(toNumber(viewModel.activeDays));
  const confidencePercent = Math.round(toNumber(sitePullProfile.confidence) * 100);
  const primaryDrivers = reading.primaryEvidence;

  return {
    title: t('target_profile.title', {}),
    riskLabel: '',
    confidenceLabel: resolveConfidenceLabel(sitePullProfile.confidence, t),
    sectionLabels: {
      drivers: t('target_profile.section_drivers', {}),
      patterns: t('target_profile.section_patterns', {}),
      composition: t('target_profile.section_composition', {}),
      basis: t('target_profile.section_basis', {}),
    },
    scoreLabel: t('target_profile.score_label', {}),
    scoreCaption: t('target_profile.score_caption_v1', {
      confidence: confidencePercent,
    }),
    score: sitePullProfile.score,
    tone: 'neutral',
    headline: reading.headline,
    reading,
    primaryPatternId: interpretation.headline.kind === 'pattern' ? interpretation.headline.patternId : null,
    badges: badges.slice(0, 6),
    patternCards: orderedDetailItems.map((item) => ({
      ...item,
      meta: t(item.nearDecisionBoundary
        ? 'target_profile.pattern_evidence_level_near_boundary'
        : 'target_profile.pattern_evidence_level', {
        quality: item.evidenceQualityLabel,
        value: item.evidenceQualityScore,
      }),
    })),
    metrics: [
      {
        label: t('target_profile.metric_today', {}),
        value: t('target_profile.metric_minutes', { value: todayMinutes }),
      },
      {
        label: t('target_profile.metric_daily_average', {}),
        value: t('target_profile.metric_minutes', { value: weeklyAverageMinutes }),
      },
      {
        label: t('target_profile.metric_confidence', {}),
        value: t('target_profile.metric_percent', { value: confidencePercent }),
      },
      {
        label: t('target_profile.metric_active_days', {}),
        value: t('target_profile.metric_days', { value: activeDays }),
      },
    ],
    dataBasis: buildDataBasisItems(sitePullProfile, t),
    primaryDrivers,
    contributions: topContributions,
    nudge: resolveNudgeCopy(sitePullProfile.recommendedNudge, t),
    drivers: contributionBreakdown
      .filter((row) => toNumber(row?.contribution) >= 2.5)
      .slice(0, 3)
      .map((row) => formatDriver(row, viewModel, t)),
  };
}

export default buildTargetBehaviorProfile;
