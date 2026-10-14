export const SITE_PULL_PATTERN_FEEDBACK_SPEC_VERSION = 'site-pull-pattern-feedback-spec-release-v1';
export const SITE_PULL_PATTERN_FEEDBACK_SURFACE_POLICY_VERSION =
  'site-pull-pattern-feedback-surface-policy-v1';
export const SITE_PULL_PATTERN_FEEDBACK_SURFACE_AUDIT_VERSION =
  'site-pull-pattern-feedback-surface-audit-v1';

export const SITE_PULL_PATTERN_FEEDBACK_ROLES = Object.freeze({
  USER_FEEDBACK: 'user_feedback',
  SUPPORTING_EVIDENCE: 'supporting_evidence',
  STATE_NOTICE: 'state_notice',
  POSITIVE_REINFORCEMENT: 'positive_reinforcement',
  DECISION_QUEUE: 'decision_queue',
});

export const SITE_PULL_PATTERN_FEEDBACK_SURFACES = Object.freeze({
  BADGE: 'badge',
  DETAIL: 'detail',
  RECAP: 'recap',
  DIAGNOSTIC: 'diagnostic',
  HIDDEN: 'hidden',
});

export const SITE_PULL_PATTERN_RECOMMENDATION_FAMILIES = Object.freeze({
  NONE: 'none',
  GOAL: 'goal',
  TIME_BOUNDARY: 'time_boundary',
  CHECKING_COOLDOWN: 'checking_cooldown',
  SESSION_CHECKIN: 'session_checkin',
  NIGHT_GUARD: 'night_guard',
  SCROLL_GUARD: 'scroll_guard',
  TAB_REVIEW: 'tab_review',
  BACKGROUND_REVIEW: 'background_review',
  FRICTION_TUNING: 'friction_tuning',
  WEEKLY_REVIEW: 'weekly_review',
  MAINTAIN: 'maintain',
});

export const SITE_PULL_PATTERN_FEEDBACK_SCOPES = Object.freeze({
  DOMAIN: 'domain',
  PROTECTED_SET: 'protected_set',
  TEMPORAL_RECAP: 'temporal_recap',
  GLOBAL: 'global',
});

const {
  USER_FEEDBACK,
  SUPPORTING_EVIDENCE,
  STATE_NOTICE,
  POSITIVE_REINFORCEMENT,
  DECISION_QUEUE,
} = SITE_PULL_PATTERN_FEEDBACK_ROLES;

const {
  BADGE,
  DETAIL,
  RECAP,
  DIAGNOSTIC,
  HIDDEN,
} = SITE_PULL_PATTERN_FEEDBACK_SURFACES;

const {
  NONE,
  GOAL,
  TIME_BOUNDARY,
  CHECKING_COOLDOWN,
  SESSION_CHECKIN,
  NIGHT_GUARD,
  SCROLL_GUARD,
  TAB_REVIEW,
  BACKGROUND_REVIEW,
  FRICTION_TUNING,
  WEEKLY_REVIEW,
  MAINTAIN,
} = SITE_PULL_PATTERN_RECOMMENDATION_FAMILIES;

const {
  DOMAIN,
  PROTECTED_SET,
  TEMPORAL_RECAP,
  GLOBAL,
} = SITE_PULL_PATTERN_FEEDBACK_SCOPES;

const KNOWN_PATTERN_FEEDBACK_SURFACES = new Set(
  Object.values(SITE_PULL_PATTERN_FEEDBACK_SURFACES),
);

function freezeArray(values = []) {
  return Object.freeze([...values]);
}

export function requireSitePullPatternFeedbackSurface(surface) {
  if (!KNOWN_PATTERN_FEEDBACK_SURFACES.has(surface)) {
    const error = new Error('SITE_PULL_PATTERN_FEEDBACK_SURFACE_INVALID');
    error.code = 'SITE_PULL_PATTERN_FEEDBACK_SURFACE_INVALID';
    throw error;
  }
  return surface;
}

function feedbackSpec({
  role,
  surfaces = [],
  recommendationFamily = NONE,
  feedbackScope = DOMAIN,
  aggregationHint = null,
  userValue,
  decisionPrompt = null,
} = {}) {
  return Object.freeze({
    role,
    surfaces: freezeArray(surfaces),
    recommendationFamily,
    feedbackScope,
    aggregationHint,
    userValue,
    decisionRequired: role === DECISION_QUEUE,
    decisionPrompt,
  });
}

export const SITE_PULL_PATTERN_FEEDBACK_SPEC = Object.freeze({
  no_activity: feedbackSpec({
    role: STATE_NOTICE,
    surfaces: [BADGE, DETAIL],
    userValue: 'Usage is not visible, so judgment is deferred.',
  }),
  insufficient_data: feedbackSpec({
    role: STATE_NOTICE,
    surfaces: [BADGE, DETAIL],
    userValue: 'Activity exists, but confidence is too sparse for a strong claim.',
  }),
  steady: feedbackSpec({
    role: STATE_NOTICE,
    surfaces: [BADGE, DETAIL],
    recommendationFamily: MAINTAIN,
    userValue: 'No strong pattern is visible under the current rules.',
  }),
  goal_exceeded: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL],
    recommendationFamily: GOAL,
    userValue: 'The domain exceeded the configured use boundary.',
  }),
  goal_exceeded_repeated: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: GOAL,
    userValue: 'The domain repeatedly exceeded the configured use boundary.',
  }),
  goal_missing: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL],
    recommendationFamily: GOAL,
    userValue: 'The protected domain is active without a target boundary.',
  }),
  goal_kept: feedbackSpec({
    role: POSITIVE_REINFORCEMENT,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: MAINTAIN,
    userValue: 'The domain stayed meaningfully inside its configured boundary.',
  }),
  time_heavy_today: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL],
    recommendationFamily: TIME_BOUNDARY,
    userValue: 'The domain consumed a large amount of time today.',
  }),
  personal_spike: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [DETAIL, RECAP, DIAGNOSTIC],
    recommendationFamily: WEEKLY_REVIEW,
    aggregationHint: 'Prefer detail or recap context; a single-day personal-baseline spike is weak as a standalone domain badge.',
    userValue: 'The domain was unusually high compared with the user baseline.',
  }),
  deep_immersion: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL],
    recommendationFamily: SESSION_CHECKIN,
    userValue: 'A measured long session and same-day movement or returns were observed; their temporal association and intent are unknown.',
  }),
  focused_block: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL],
    recommendationFamily: SESSION_CHECKIN,
    userValue: 'A measured long session was observed; attention quality and intent are unknown.',
  }),
  session_depth_spike: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [DETAIL, RECAP, DIAGNOSTIC],
    recommendationFamily: SESSION_CHECKIN,
    userValue: 'One session was unusually deep compared with baseline.',
  }),
  checking_pattern: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL],
    recommendationFamily: CHECKING_COOLDOWN,
    userValue: 'The domain has enough checking pressure to show a fallback habit label.',
  }),
  checking_pattern_proxy: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [DETAIL, DIAGNOSTIC],
    recommendationFamily: CHECKING_COOLDOWN,
    userValue: 'Hourly spread suggests checking pressure when stronger entry facts are unavailable.',
  }),
  visit_spike: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [RECAP, DIAGNOSTIC],
    recommendationFamily: CHECKING_COOLDOWN,
    feedbackScope: PROTECTED_SET,
    aggregationHint: 'Prefer recap aggregation by day, protected set, or top domains instead of a standalone domain badge.',
    userValue: 'Visits were unusually high compared with baseline.',
  }),
  reentry_spike: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [RECAP, DIAGNOSTIC],
    recommendationFamily: CHECKING_COOLDOWN,
    feedbackScope: TEMPORAL_RECAP,
    aggregationHint: 'Prefer day or time-window recap; repeated quick reentry can indicate temporal pressure across domains.',
    userValue: 'Quick reentries were unusually high compared with baseline.',
  }),
  quick_return_loop: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [DETAIL, RECAP, DIAGNOSTIC],
    recommendationFamily: CHECKING_COOLDOWN,
    userValue: 'Immediate return pressure supports higher-level checking or route labels.',
  }),
  switch_churn_loop: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [RECAP, DIAGNOSTIC],
    recommendationFamily: CHECKING_COOLDOWN,
    feedbackScope: GLOBAL,
    aggregationHint: 'Prefer global/protected-set switching summaries; domain-level churn is weak as standalone feedback.',
    userValue: 'Frequent switching around the domain suggests churn, but the standalone advice is weak.',
  }),
  checking_carousel: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL],
    recommendationFamily: CHECKING_COOLDOWN,
    userValue: 'Multiple dimensions describe repeated use on the same day; they do not establish an ordered loop or independent events.',
  }),
  session_fragmentation: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: CHECKING_COOLDOWN,
    userValue: 'The domain was used through repeated short fragments.',
  }),
  protected_route_return: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [DETAIL, RECAP, DIAGNOSTIC],
    recommendationFamily: CHECKING_COOLDOWN,
    feedbackScope: PROTECTED_SET,
    aggregationHint: 'Prefer protected-set route recap; do not attach a return-route badge to every participant domain.',
    userValue: 'The scoped destination was revisited within ten minutes of its last exit; the source site policy is not inferred.',
  }),
  domain_pair_loop: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [DETAIL, DIAGNOSTIC],
    recommendationFamily: CHECKING_COOLDOWN,
    userValue: 'This directed domain pair frequently appears together.',
  }),
  loop_route_hint: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [RECAP, DIAGNOSTIC],
    recommendationFamily: CHECKING_COOLDOWN,
    feedbackScope: PROTECTED_SET,
    aggregationHint: 'Prefer protected-route graph recap; do not attach the same route-loop badge to every participant domain.',
    userValue: 'The domain participates in a broader protected-route loop.',
  }),
  habitual_entry: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL],
    recommendationFamily: CHECKING_COOLDOWN,
    userValue: 'The domain is directly invoked through address/search entry.',
  }),
  reload_checking: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL],
    recommendationFamily: CHECKING_COOLDOWN,
    userValue: 'The domain is repeatedly refreshed as a checking behavior.',
  }),
  new_tab_loop: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [DETAIL, DIAGNOSTIC],
    recommendationFamily: TAB_REVIEW,
    userValue: 'New-tab entry supports tab-queue interpretation.',
  }),
  duplicate_tab_entry: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [DETAIL, DIAGNOSTIC],
    recommendationFamily: TAB_REVIEW,
    userValue: 'Duplicate same-domain tabs support tab-queue interpretation.',
  }),
  tab_queue_pattern: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: TAB_REVIEW,
    userValue: 'The domain is being handled as a queue of tabs.',
  }),
  tab_hoarding_context: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [DETAIL, DIAGNOSTIC],
    recommendationFamily: TAB_REVIEW,
    userValue: 'Broad tab pressure contextualizes tab-queue behavior.',
  }),
  background_residency: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: BACKGROUND_REVIEW,
    userValue: 'Background tab channels accumulated time; overlap and attention are unknown.',
  }),
  feed_skimming: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [DETAIL, DIAGNOSTIC],
    recommendationFamily: SCROLL_GUARD,
    userValue: 'Feed skim signals support feed-loop interpretation.',
  }),
  feed_loop_pattern: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: SCROLL_GUARD,
    userValue: 'The domain shows continuous feed-consumption pressure.',
  }),
  fast_scroll_bursts: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [DETAIL, DIAGNOSTIC],
    recommendationFamily: SCROLL_GUARD,
    userValue: 'Scroll bursts support feed-loop interpretation.',
  }),
  daily_habit: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: WEEKLY_REVIEW,
    userValue: 'The domain is a regular touchpoint across the week.',
  }),
  rising_trend: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: WEEKLY_REVIEW,
    userValue: 'Recent use is rising compared with nearby or personal context.',
  }),
  late_night_binge: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: NIGHT_GUARD,
    userValue: 'Use accumulated in a fixed late-hour window; personal sleep and repeated nights are not established.',
  }),
  late_night: feedbackSpec({
    role: SUPPORTING_EVIDENCE,
    surfaces: [RECAP, DIAGNOSTIC],
    recommendationFamily: NIGHT_GUARD,
    feedbackScope: TEMPORAL_RECAP,
    aggregationHint: 'Prefer night-window recap or support for late_night_binge instead of a standalone domain badge.',
    userValue: 'The domain appeared during late hours without necessarily being a binge.',
  }),
  intervention_resistance_loop: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: NONE,
    userValue: 'The domain is repeatedly revisited after intervention.',
  }),
  intervention_reentry: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL],
    recommendationFamily: NONE,
    userValue: 'The user came back after an intervention on this domain.',
  }),
  intervention_recovery: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: NONE,
    userValue: 'Leaving was chosen; follow-up duration and causal effectiveness are not established.',
  }),
  controlled_brief_check: feedbackSpec({
    role: USER_FEEDBACK,
    surfaces: [BADGE, DETAIL, RECAP],
    recommendationFamily: NONE,
    userValue: 'Measured sessions were short; brevity does not establish successful control or an intentional exit.',
  }),
});

export function getSitePullPatternFeedbackSpec(id) {
  return SITE_PULL_PATTERN_FEEDBACK_SPEC[id] || null;
}

export function resolveSitePullPatternFeedbackSurfacePolicy(patternOrId, {
  surface = SITE_PULL_PATTERN_FEEDBACK_SURFACES.BADGE,
} = {}) {
  const resolvedSurface = requireSitePullPatternFeedbackSurface(surface);
  const id = typeof patternOrId === 'string'
    ? patternOrId
    : typeof patternOrId?.id === 'string'
      ? patternOrId.id
      : '';
  const spec = getSitePullPatternFeedbackSpec(id);
  if (!spec) {
    return {
      version: SITE_PULL_PATTERN_FEEDBACK_SURFACE_POLICY_VERSION,
      id,
      surface: resolvedSurface,
      allowed: false,
      reason: 'unknown_feedback_spec',
      role: null,
      feedbackScope: null,
      surfaces: [],
      recommendationFamily: null,
    };
  }
  const surfaces = [...spec.surfaces];
  const allowed = surfaces.includes(resolvedSurface);
  return {
    version: SITE_PULL_PATTERN_FEEDBACK_SURFACE_POLICY_VERSION,
    id,
    surface: resolvedSurface,
    allowed,
    reason: allowed ? null : 'surface_not_allowed',
    role: spec.role,
    feedbackScope: spec.feedbackScope,
    surfaces,
    recommendationFamily: spec.recommendationFamily,
  };
}

export function supportsSitePullPatternFeedbackSurface(patternOrId, surface) {
  return resolveSitePullPatternFeedbackSurfacePolicy(patternOrId, { surface }).allowed;
}

export function listSitePullPatternFeedbackSurfaceRows() {
  return Object.entries(SITE_PULL_PATTERN_FEEDBACK_SPEC)
    .map(([id, spec]) => ({
      id,
      role: spec.role,
      feedbackScope: spec.feedbackScope,
      surfaces: [...spec.surfaces],
      badgeEligible: spec.surfaces.includes(BADGE),
      detailEligible: spec.surfaces.includes(DETAIL),
      recapEligible: spec.surfaces.includes(RECAP),
      diagnosticEligible: spec.surfaces.includes(DIAGNOSTIC),
      recommendationFamily: spec.recommendationFamily,
      aggregationHint: spec.aggregationHint,
      decisionRequired: spec.decisionRequired === true,
      userValue: spec.userValue,
    }));
}

export function buildSitePullPatternFeedbackSurfaceAudit() {
  const rows = listSitePullPatternFeedbackSurfaceRows();
  const violations = [];
  rows.forEach((row) => {
    if (row.badgeEligible && row.role === SUPPORTING_EVIDENCE) {
      violations.push({
        id: row.id,
        code: 'supporting_evidence_badge_surface',
        message: 'Supporting evidence must not render as a standalone domain badge.',
      });
    }
    if (row.badgeEligible && row.feedbackScope !== DOMAIN) {
      violations.push({
        id: row.id,
        code: 'non_domain_badge_surface',
        message: 'Non-domain feedback belongs in aggregate, recap, detail, or diagnostic surfaces.',
      });
    }
    if (!row.badgeEligible && row.role === USER_FEEDBACK && !row.recapEligible && !row.detailEligible) {
      violations.push({
        id: row.id,
        code: 'user_feedback_without_user_surface',
        message: 'User feedback without a badge still needs detail or recap visibility.',
      });
    }
  });

  return {
    version: SITE_PULL_PATTERN_FEEDBACK_SURFACE_AUDIT_VERSION,
    specVersion: SITE_PULL_PATTERN_FEEDBACK_SPEC_VERSION,
    surfacePolicyVersion: SITE_PULL_PATTERN_FEEDBACK_SURFACE_POLICY_VERSION,
    rowCount: rows.length,
    badgeEligiblePatternIds: rows.filter((row) => row.badgeEligible).map((row) => row.id),
    recapEligiblePatternIds: rows.filter((row) => row.recapEligible).map((row) => row.id),
    diagnosticEligiblePatternIds: rows.filter((row) => row.diagnosticEligible).map((row) => row.id),
    violations,
    ok: violations.length === 0,
  };
}

export function listSitePullPatternFeedbackDecisionQueue() {
  return Object.entries(SITE_PULL_PATTERN_FEEDBACK_SPEC)
    .filter(([, spec]) => spec.decisionRequired)
    .map(([id, spec]) => ({ id, ...spec }));
}
