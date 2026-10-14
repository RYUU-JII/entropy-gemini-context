import {
  SITE_PULL_PATTERN_LEVELS,
  SITE_PULL_PATTERN_POLARITIES,
  createSitePullPatternSignal,
} from './sitePullPatternContracts.js';

export const SITE_PULL_PATTERN_DEFINITION_VERSION = 'site-pull-pattern-definitions-v1';

const { ATOMIC, COMPOSITE, STATE } = SITE_PULL_PATTERN_LEVELS;
const { NEGATIVE, NEUTRAL, POSITIVE } = SITE_PULL_PATTERN_POLARITIES;

function patternDefinition({
  level = ATOMIC,
  polarity = NEUTRAL,
  rank,
  group,
  slot = 'badge',
  componentIds = [],
  suppresses = [],
} = {}) {
  return Object.freeze({
    level,
    polarity,
    componentIds: Object.freeze([...componentIds]),
    suppresses: Object.freeze([...suppresses]),
    presentation: Object.freeze({
      rank,
      group,
      slot,
    }),
  });
}

export const SITE_PULL_PATTERN_DEFINITIONS = Object.freeze({
  no_activity: patternDefinition({
    level: STATE,
    polarity: NEUTRAL,
    rank: 10,
    group: 'data',
  }),
  insufficient_data: patternDefinition({
    level: STATE,
    polarity: NEUTRAL,
    rank: 20,
    group: 'data',
  }),
  goal_exceeded: patternDefinition({
    polarity: NEGATIVE,
    rank: 100,
    group: 'plan',
  }),
  goal_exceeded_repeated: patternDefinition({
    level: COMPOSITE,
    polarity: NEGATIVE,
    rank: 110,
    group: 'plan',
    componentIds: ['goal_exceeded'],
  }),
  goal_missing: patternDefinition({
    polarity: NEUTRAL,
    rank: 120,
    group: 'plan',
  }),
  time_heavy_today: patternDefinition({
    polarity: NEGATIVE,
    rank: 200,
    group: 'time',
  }),
  personal_spike: patternDefinition({
    polarity: NEGATIVE,
    rank: 210,
    group: 'time',
  }),
  deep_immersion: patternDefinition({
    polarity: NEUTRAL,
    rank: 220,
    group: 'immersion',
  }),
  focused_block: patternDefinition({
    polarity: NEUTRAL,
    rank: 225,
    group: 'focus',
  }),
  session_depth_spike: patternDefinition({
    polarity: NEGATIVE,
    rank: 230,
    group: 'immersion',
  }),
  checking_pattern: patternDefinition({
    polarity: NEUTRAL,
    rank: 390,
    group: 'checking',
  }),
  checking_pattern_proxy: patternDefinition({
    polarity: NEUTRAL,
    rank: 395,
    group: 'checking',
    slot: 'supporting',
  }),
  visit_spike: patternDefinition({
    polarity: NEUTRAL,
    rank: 320,
    group: 'checking',
    slot: 'shadow',
  }),
  reentry_spike: patternDefinition({
    polarity: NEGATIVE,
    rank: 330,
    group: 'checking',
    slot: 'shadow',
  }),
  quick_return_loop: patternDefinition({
    polarity: NEUTRAL,
    rank: 340,
    group: 'route',
    slot: 'shadow',
  }),
  switch_churn_loop: patternDefinition({
    polarity: NEUTRAL,
    rank: 350,
    group: 'route',
    slot: 'shadow',
  }),
  checking_carousel: patternDefinition({
    level: COMPOSITE,
    polarity: NEUTRAL,
    rank: 360,
    group: 'checking',
    componentIds: [
      'quick_return_loop',
      'switch_churn_loop',
      'visit_spike',
      'reentry_spike',
      'session_fragmentation',
      'habitual_entry',
      'reload_checking',
    ],
  }),
  session_fragmentation: patternDefinition({
    polarity: NEGATIVE,
    rank: 370,
    group: 'checking',
  }),
  protected_route_return: patternDefinition({
    polarity: NEUTRAL,
    rank: 398,
    group: 'route',
  }),
  domain_pair_loop: patternDefinition({
    polarity: NEUTRAL,
    rank: 400,
    group: 'route',
    slot: 'shadow',
  }),
  loop_route_hint: patternDefinition({
    level: COMPOSITE,
    polarity: NEUTRAL,
    rank: 410,
    group: 'route',
    slot: 'shadow',
    componentIds: ['domain_pair_loop'],
  }),
  habitual_entry: patternDefinition({
    polarity: NEUTRAL,
    rank: 500,
    group: 'navigation',
  }),
  reload_checking: patternDefinition({
    polarity: NEGATIVE,
    rank: 510,
    group: 'navigation',
  }),
  new_tab_loop: patternDefinition({
    polarity: NEUTRAL,
    rank: 520,
    group: 'tab_context',
    slot: 'shadow',
  }),
  duplicate_tab_entry: patternDefinition({
    polarity: NEUTRAL,
    rank: 530,
    group: 'tab_context',
    slot: 'shadow',
  }),
  tab_queue_pattern: patternDefinition({
    level: COMPOSITE,
    polarity: NEUTRAL,
    rank: 535,
    group: 'tab_context',
    componentIds: ['new_tab_loop', 'duplicate_tab_entry'],
  }),
  tab_hoarding_context: patternDefinition({
    polarity: NEUTRAL,
    rank: 540,
    group: 'tab_context',
    slot: 'shadow',
  }),
  background_residency: patternDefinition({
    polarity: NEUTRAL,
    rank: 545,
    group: 'tab_context',
  }),
  feed_skimming: patternDefinition({
    polarity: NEUTRAL,
    rank: 550,
    group: 'content_flow',
    slot: 'supporting',
  }),
  feed_loop_pattern: patternDefinition({
    level: COMPOSITE,
    polarity: NEGATIVE,
    rank: 560,
    group: 'content_flow',
    componentIds: ['feed_skimming', 'fast_scroll_bursts'],
  }),
  fast_scroll_bursts: patternDefinition({
    polarity: NEUTRAL,
    rank: 570,
    group: 'content_flow',
    slot: 'supporting',
  }),
  daily_habit: patternDefinition({
    polarity: NEUTRAL,
    rank: 600,
    group: 'habit',
  }),
  rising_trend: patternDefinition({
    polarity: NEUTRAL,
    rank: 590,
    group: 'trend',
  }),
  late_night_binge: patternDefinition({
    level: COMPOSITE,
    polarity: NEUTRAL,
    rank: 615,
    group: 'circadian',
    componentIds: ['late_night'],
  }),
  late_night: patternDefinition({
    polarity: NEUTRAL,
    rank: 620,
    group: 'circadian',
    slot: 'shadow',
  }),
  intervention_resistance_loop: patternDefinition({
    level: COMPOSITE,
    polarity: NEUTRAL,
    rank: 690,
    group: 'intervention',
    componentIds: [
      'intervention_reentry',
    ],
  }),
  intervention_reentry: patternDefinition({
    polarity: NEUTRAL,
    rank: 700,
    group: 'intervention',
  }),
  intervention_recovery: patternDefinition({
    polarity: NEUTRAL,
    rank: 710,
    group: 'intervention',
  }),
  controlled_brief_check: patternDefinition({
    polarity: NEUTRAL,
    rank: 840,
    group: 'steady',
  }),
  goal_kept: patternDefinition({
    level: STATE,
    polarity: POSITIVE,
    rank: 830,
    group: 'plan',
  }),
  steady: patternDefinition({
    level: STATE,
    polarity: POSITIVE,
    rank: 860,
    group: 'steady',
  }),
});

export function getSitePullPatternDefinition(id) {
  return SITE_PULL_PATTERN_DEFINITIONS[id] || null;
}

function mergeUniqueIds(first = [], second = []) {
  const seen = new Set();
  return [...first, ...second].filter((id) => {
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function buildPresentation(definition, signal, detectorIndex) {
  return {
    ...(definition?.presentation || {}),
    ...(signal?.presentation || {}),
    detectorIndex,
  };
}

export function annotateSitePullPatternSignal(signal, { detectorIndex = 0 } = {}) {
  if (!signal?.id) return null;
  const definition = getSitePullPatternDefinition(signal.id);
  return createSitePullPatternSignal({
    ...signal,
    level: definition?.level || signal.level || ATOMIC,
    polarity: definition?.polarity || signal.polarity || null,
    componentIds: mergeUniqueIds(definition?.componentIds, signal.componentIds),
    suppresses: mergeUniqueIds(definition?.suppresses, signal.suppresses),
    presentation: buildPresentation(definition, signal, detectorIndex),
  });
}

const SEVERITY_WEIGHT = Object.freeze({
  danger: 4,
  warning: 3,
  watch: 2,
  neutral: 1,
  positive: 0,
});

function presentationRank(pattern) {
  const rank = Number(pattern?.presentation?.rank);
  return Number.isFinite(rank) ? rank : 1_000;
}

function severityWeight(pattern) {
  return SEVERITY_WEIGHT[pattern?.severity] ?? 1;
}

function detectorIndex(pattern) {
  const index = Number(pattern?.presentation?.detectorIndex);
  return Number.isFinite(index) ? index : 1_000;
}

export function compareSitePullPatternPresentation(left, right) {
  const rankDelta = presentationRank(left) - presentationRank(right);
  if (rankDelta !== 0) return rankDelta;
  const severityDelta = severityWeight(right) - severityWeight(left);
  if (severityDelta !== 0) return severityDelta;
  const scoreDelta = Number(right?.score || 0) - Number(left?.score || 0);
  if (scoreDelta !== 0) return scoreDelta;
  const confidenceDelta = Number(right?.confidence || 0) - Number(left?.confidence || 0);
  if (confidenceDelta !== 0) return confidenceDelta;
  return detectorIndex(left) - detectorIndex(right);
}

export function rankSitePullPatternsForPresentation(patternSignals = []) {
  return (Array.isArray(patternSignals) ? patternSignals : [])
    .map((signal, index) => (
      signal?.presentation?.rank === undefined
        ? annotateSitePullPatternSignal(signal, { detectorIndex: index })
        : signal
    ))
    .filter(Boolean)
    .sort(compareSitePullPatternPresentation);
}
