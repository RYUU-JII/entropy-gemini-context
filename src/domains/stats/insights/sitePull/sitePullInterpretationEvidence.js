// Terminal readout projection. Never import this module into facts, baseline,
// scoring or detectors: these descriptors explain accepted observations only.
const metric = (field, label, unit, family, period = 'today') => Object.freeze({
  field, labelKey: `target_profile.reading_${label}`, unit, family, period,
});
const count = (field, label, family, period) => metric(field, label, 'count', family, period);
const duration = (field, label, family = 'active_usage', period) => metric(field, label, 'duration_ms', family, period);
const days = (field, label) => metric(field, label, 'days', 'daily_usage', 'weekly');
const spec = (headline, metrics = [], limits = [], explanation = null) => Object.freeze({
  headlineKey: `target_profile.${headline}`, metrics: Object.freeze(metrics),
  explanationKey: explanation === null ? null : `target_profile.reading_explanation_${explanation}`,
  limitationKeys: Object.freeze(limits.map((key) => `target_profile.reading_limit_${key}`)),
});
const returns = [count('reenteredWithin30m', 'returns_30m', 'intervention_exposure_response', 'selected'),
  count('frictionShown', 'eligible_exposures', 'intervention_exposure_response', 'selected')];
const routeLimits = ['route_histogram'];
const interventionLimits = ['intervention_followup'];

export const SITE_PULL_INTERPRETATION_EVIDENCE_SPECS = Object.freeze({
  no_activity: spec('reading_state_zero'),
  insufficient_data: spec('reading_state_collecting'),
  steady: spec('reading_state_unclassified'),
  goal_exceeded: spec('summary_plan_missed'),
  goal_exceeded_repeated: spec('summary_plan_missed'),
  goal_missing: spec('summary_goal_missing'),
  goal_kept: spec('summary_steady'),
  time_heavy_today: spec('reading_headline_usage', [duration('todayMs', 'usage'),
    duration('weeklyAverageMs', 'recorded_average', 'active_usage', 'weekly')], [], 'usage'),
  personal_spike: spec('summary_personal_spike', [duration('todayMs', 'usage'),
    duration('p75ReferenceMs', 'personal_reference', 'active_usage', 'personal_reference')], [], 'personal_reference'),
  deep_immersion: spec('summary_high_immersion', [duration('sustainedBlockMs', 'longest_session', 'session_duration'),
    duration('todayTotalMs', 'usage')], ['session_context'], 'session_context'),
  focused_block: spec('reading_headline_long_session', [duration('sustainedBlockMs', 'longest_session', 'session_duration')], ['session_intent'], 'session_max'),
  session_depth_spike: spec('reading_headline_session_reference', [duration('todayMaxSessionMs', 'longest_session', 'session_duration'),
    duration('maxSessionP75Ms', 'session_reference', 'session_duration', 'personal_reference')], ['session_intent'], 'personal_reference'),
  session_fragmentation: spec('summary_session_fragmentation', [count('shortSessionCount', 'short_sessions', 'session_duration'),
    count('sessionCount', 'sessions', 'session_duration'), duration('averageSessionMs', 'average_session', 'session_duration')], ['session_intent'], 'short_sessions'),
  controlled_brief_check: spec('reading_headline_brief', [duration('maxSessionMs', 'longest_session', 'session_duration'),
    count('sessionCount', 'sessions', 'session_duration')], ['session_intent'], 'short_sessions'),
  checking_pattern: spec('summary_habitual_checking', [count('todayVisits', 'visits', 'navigation_entry'),
    count('visitHoursToday', 'visit_hours', 'entry_distribution')], ['entry_intent'], 'entries'),
  checking_pattern_proxy: spec('reading_headline_hourly_proxy', [count('activeHoursToday', 'active_hours', 'hourly_usage')], ['hourly_proxy'], 'hourly'),
  checking_carousel: spec('summary_habitual_checking', [count('todayVisits', 'visits', 'navigation_entry'),
    count('todaySwitchBackWithin10m', 'returns_10m', 'foreground_return'),
    count('todaySwitchChurn', 'switches', 'foreground_transition'),
    count('todayShortSessionCount', 'short_sessions', 'session_duration'),
    count('directEntryCount', 'direct_entries', 'navigation_entry'),
    count('reloadCount', 'reloads', 'navigation_entry')], ['cooccurrence'], 'cooccurrence'),
  quick_return_loop: spec('reading_headline_quick_return', [count('todaySwitchBackWithin10m', 'returns_10m', 'foreground_return'),
    count('todaySwitchIns', 'foreground_entries', 'foreground_return')], ['entry_intent'], 'returns'),
  switch_churn_loop: spec('reading_headline_switching', [count('todaySwitchChurn', 'switches', 'foreground_transition'),
    count('switchChurnP75', 'switch_reference', 'foreground_transition', 'personal_reference')], ['entry_intent'], 'switching'),
  visit_spike: spec('reading_headline_visit_reference', [count('todayVisits', 'visits', 'navigation_entry'),
    count('visitP75', 'visit_reference', 'navigation_entry', 'personal_reference')], ['entry_intent'], 'personal_reference'),
  reentry_spike: spec('reading_headline_return_reference', [count('todayRevisitWithin10m', 'returns_10m', 'visit_return'),
    count('revisitP75', 'return_reference', 'visit_return', 'personal_reference')], ['entry_intent'], 'personal_reference'),
  protected_route_return: spec('summary_route_loop', [count('returnWithin10m', 'route_returns', 'foreground_transition'),
    count('count', 'incoming_moves', 'foreground_transition')], routeLimits, 'routes'),
  domain_pair_loop: spec('summary_route_loop', [count('count', 'pair_moves', 'foreground_transition'),
    count('returnWithin10m', 'route_returns', 'foreground_transition')], routeLimits, 'routes'),
  loop_route_hint: spec('summary_route_loop', [count('count', 'route_moves', 'foreground_transition'),
    count('distinctEdgeCount', 'route_pairs', 'foreground_transition')], routeLimits, 'routes'),
  habitual_entry: spec('reading_headline_direct_entry', [count('typedEntrances', 'direct_entries', 'navigation_entry'),
    count('totalNavigations', 'navigations', 'navigation_entry')], ['entry_intent'], 'entries'),
  reload_checking: spec('reading_headline_reload', [count('reloads', 'reloads', 'navigation_entry'),
    count('totalNavigations', 'navigations', 'navigation_entry')], ['entry_intent'], 'entries'),
  new_tab_loop: spec('summary_tab_queue', [count('newTabEntrances', 'new_tabs', 'tab_context_snapshot')], ['tab_snapshot'], 'tabs'),
  duplicate_tab_entry: spec('summary_tab_queue', [count('duplicateTabEntrances', 'duplicate_entries', 'tab_context_snapshot'),
    count('maxSameDomainOpenTabs', 'same_domain_tabs', 'tab_context_snapshot')], ['tab_snapshot'], 'tabs'),
  tab_queue_pattern: spec('summary_tab_queue', [count('maxSameDomainOpenTabs', 'same_domain_tabs', 'tab_context_snapshot'),
    count('duplicateTabEntrances', 'duplicate_entries', 'tab_context_snapshot'),
    count('newTabEntrances', 'new_tabs', 'tab_context_snapshot')], ['tab_snapshot'], 'tabs'),
  tab_hoarding_context: spec('reading_headline_browser_tabs', [count('maxOpenTabs', 'browser_tabs', 'browser_context')], ['browser_context'], 'tabs'),
  background_residency: spec('reading_headline_background', [duration('backgroundMediaMs', 'background_media', 'background_residency', 'selected'),
    duration('backgroundLingerMs', 'background_linger', 'background_residency', 'selected'),
    duration('staleTabMs', 'stale_tab', 'background_residency', 'selected')], ['background'], 'background'),
  feed_skimming: spec('summary_feed_loop', [count('feedAdvanceBursts', 'feed_advances', 'feed_progression'),
    count('feedSkimSignals', 'feed_skims', 'feed_progression')], ['feed_lineage'], 'feed'),
  feed_loop_pattern: spec('summary_feed_loop', [count('feedAdvanceBursts', 'feed_advances', 'feed_progression'),
    count('feedSkimSignals', 'feed_skims', 'feed_progression')], ['feed_lineage'], 'feed'),
  fast_scroll_bursts: spec('reading_headline_scroll', [count('scrollBurstCount', 'scroll_bursts', 'feed_progression')], ['feed_lineage'], 'feed'),
  daily_habit: spec('reading_headline_days', [days('activeDays', 'active_days'), days('weeklyDays', 'observed_days'),
    days('streakDays', 'consecutive_days')], ['habit'], 'days'),
  rising_trend: spec('summary_rising', [duration('recentAverageMs', 'recent_average', 'daily_usage', 'recent_trajectory'),
    duration('previousAverageMs', 'trajectory_reference', 'daily_usage', 'trajectory_reference')], ['trajectory'], 'trend'),
  late_night: spec('reading_headline_night', [duration('nightMsToday', 'night_usage')], ['night'], 'night'),
  late_night_binge: spec('reading_headline_night', [duration('nightMsToday', 'night_usage')], ['night'], 'night'),
  intervention_reentry: spec('summary_intervention_reentry', returns, interventionLimits, 'intervention'),
  intervention_resistance_loop: spec('summary_intervention_reentry', returns, interventionLimits, 'intervention'),
  intervention_recovery: spec('reading_headline_leave', [count('left', 'leave_choices', 'intervention_exposure_response', 'selected'),
    count('frictionShown', 'eligible_exposures', 'intervention_exposure_response', 'selected')], interventionLimits, 'intervention'),
});

export function buildSitePullEvidenceReadout(item) {
  const patternId = item.patternId || item.id;
  const definition = SITE_PULL_INTERPRETATION_EVIDENCE_SPECS[patternId];
  if (!definition) throw new Error(`SITE_PULL_READING_PATTERN_UNKNOWN:${patternId}`);
  const evidence = item.evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error(`SITE_PULL_READING_EVIDENCE_SOURCE_INVALID:${patternId}`);
  }
  if (patternId.startsWith('intervention_')
    && !['resistanceEligible', 'effectivenessEligible', 'unclassified_coarse'].includes(evidence.evidenceCohort)) {
    throw new Error(`SITE_PULL_READING_COHORT_INVALID:${patternId}`);
  }
  let descriptors = definition.metrics;
  let { headlineKey, explanationKey } = definition;
  if (patternId === 'time_heavy_today' && evidence.timePressureStatus === 'unusually_heavy_for_you') {
    descriptors = SITE_PULL_INTERPRETATION_EVIDENCE_SPECS.personal_spike.metrics;
    headlineKey = SITE_PULL_INTERPRETATION_EVIDENCE_SPECS.personal_spike.headlineKey;
    explanationKey = SITE_PULL_INTERPRETATION_EVIDENCE_SPECS.personal_spike.explanationKey;
  } else if (patternId === 'time_heavy_today' && !evidence.timePressureChannelIds?.includes('weekly_lift')) {
    descriptors = definition.metrics.slice(0, 1);
  } else if (patternId === 'time_heavy_today') {
    explanationKey = 'target_profile.reading_explanation_weekly_comparison';
  }
  if (patternId === 'checking_carousel') {
    const dimensionFields = {
      entry_distribution: 'todayVisits',
      attention_switching: evidence.quickReturnSupport === true ? 'todaySwitchBackWithin10m' : 'todaySwitchChurn',
      session_shape: 'todayShortSessionCount',
      navigation_entry: evidence.habitualEntrySupport === true ? 'directEntryCount' : 'reloadCount',
    };
    const dimensions = evidence.corroboratingEvidenceFamilyIds;
    if (!Array.isArray(dimensions) || dimensions.length < 2
      || dimensions.some((id) => !Object.hasOwn(dimensionFields, id))) {
      throw new Error('SITE_PULL_READING_CHECKING_DIMENSIONS_INVALID');
    }
    // Explain the dimensions already admitted by Composer; a zero return
    // counter is not a reason for a summary supported by short sessions.
    descriptors = ['entry_distribution', 'attention_switching', 'session_shape', 'navigation_entry']
      .filter((id) => dimensions.includes(id))
      .map((id) => definition.metrics.find((metric) => metric.field === dimensionFields[id])).slice(0, 3);
  }
  const metrics = descriptors.map((descriptor) => {
    let { field, period } = descriptor;
    if (period === 'selected') {
      if (!['today', 'weekly'].includes(evidence.evidenceWindow)) {
        throw new Error(`SITE_PULL_READING_WINDOW_INVALID:${patternId}`);
      }
      period = evidence.evidenceWindow;
      if (patternId === 'background_residency' && period === 'weekly') {
        field = `weekly${field[0].toUpperCase()}${field.slice(1)}`;
      }
    }
    const value = evidence[field];
    const absent = value === undefined || value === null;
    if (!absent && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      throw new Error(`SITE_PULL_READING_VALUE_INVALID:${patternId}:${field}`);
    }
    return {
      id: `${item.surfaceItemId || patternId}:${field}`, field,
      labelKey: descriptor.labelKey, unit: descriptor.unit, period,
      value: absent ? null : value, status: absent ? 'unavailable' : 'observed',
      provenance: { patternId, family: descriptor.family,
        kind: period === 'personal_reference' || period.includes('trajectory') ? 'model_reference'
          : patternId === 'checking_pattern_proxy' ? 'hourly_proxy' : 'recorded_aggregate',
        cohort: typeof evidence.evidenceCohort === 'string' ? evidence.evidenceCohort : null },
    };
  });
  if (['target_profile.reading_explanation_personal_reference', 'target_profile.reading_explanation_weekly_comparison'].includes(explanationKey)
    && !metrics.some((metric) => metric.status === 'observed' && metric.period !== 'today')) {
    explanationKey = 'target_profile.reading_explanation_reference_unavailable';
  }
  if (patternId === 'checking_carousel' && metrics[0]?.field === 'todayVisits' && metrics[0].value > 0 && metrics[1]?.value > 0) {
    // Describe the same admitted dimensions that lead the terminal reading.
    // Other compositions retain the general co-occurrence explanation.
    const entryCompanions = {
      todayShortSessionCount: 'checking_short_sessions', todaySwitchBackWithin10m: 'checking_returns',
      todaySwitchChurn: 'checking_switches', directEntryCount: 'checking_direct', reloadCount: 'checking_reload',
    };
    if (Object.hasOwn(entryCompanions, metrics[1].field)) {
      explanationKey = `target_profile.reading_explanation_${entryCompanions[metrics[1].field]}`;
    }
  }
  return {
    surfaceItemId: item.surfaceItemId || null, patternId, headlineKey, explanationKey,
    metrics, limitationKeys: [...definition.limitationKeys],
    caveats: Array.isArray(evidence.caveats) ? [...evidence.caveats] : [],
  };
}
