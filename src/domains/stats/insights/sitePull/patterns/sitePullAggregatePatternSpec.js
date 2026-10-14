import { STATS_RANGE_MAX_DAYS } from '../../../contracts/statsContracts.js';

export const SITE_PULL_AGGREGATE_PATTERN_SPEC_VERSION = 'site-pull-aggregate-pattern-spec-v1';

export const SITE_PULL_AGGREGATE_PATTERN_SCOPES = Object.freeze({
  PROTECTED_SET: 'protected_set',
  GLOBAL: 'global',
  TEMPORAL_RECAP: 'temporal_recap',
});

export const SITE_PULL_AGGREGATE_TIME_AXES = Object.freeze({
  DAY: 'day',
  RECENT_7D: 'recent_7d',
  HOUR_BLOCK: 'hour_block',
  NIGHT_WINDOW: 'night_window',
  CYCLE_WINDOW: 'cycle_window',
});

export const SITE_PULL_AGGREGATE_SIGNAL_FAMILIES = Object.freeze({
  USAGE: 'usage',
  VISIT: 'visit',
  REENTRY: 'reentry',
  SWITCH: 'switch',
  ROUTE: 'route',
  TAB: 'tab',
  FEED: 'feed',
  BACKGROUND: 'background',
  INTERVENTION: 'intervention',
  GOAL: 'goal',
});

export const SITE_PULL_AGGREGATE_ENTITY_PROJECTIONS = Object.freeze({
  PROTECTED_TOTAL: 'protected_total',
  ALL: 'all',
  TOP_K_DOMAINS: 'top_k_domains',
  TOP_K_EDGES: 'top_k_edges',
  TOP_K_TIME_BLOCKS: 'top_k_time_blocks',
});

export const SITE_PULL_AGGREGATE_BASELINE_MODES = Object.freeze({
  NONE: 'none',
  SAME_USER_30D: 'same_user_30d',
  RECENT_7D: 'recent_7d',
  WEIGHTED_RECENT: 'weighted_recent',
  PREVIOUS_PERIOD: 'previous_period',
});

export const SITE_PULL_AGGREGATE_ANALYSIS_METHODS = Object.freeze({
  FIXED_WINDOW_SPLIT: 'fixed_window_split',
  WEIGHTED_WINDOW: 'weighted_window',
  ROBUST_ANOMALY: 'robust_anomaly',
  HEAVY_HITTER_TOP_K: 'heavy_hitter_top_k',
  TRANSITION_GRAPH: 'transition_graph',
  EWMA_SLOPE: 'ewma_slope',
  BOUNDED_TEMPLATE: 'bounded_template',
});

export const SITE_PULL_AGGREGATE_COST_CLASSES = Object.freeze({
  CHEAP: 'cheap',
  MODERATE: 'moderate',
  ANALYSIS_SESSION: 'analysis_session',
});

export const SITE_PULL_AGGREGATE_PLAN_STATUSES = Object.freeze({
  DISABLED: 'disabled',
  PLANNED: 'planned',
  EMPTY: 'empty',
});

export const SITE_PULL_AGGREGATE_CANDIDATE_PLAN_STATUSES = Object.freeze({
  BLOCKED_BY_GLOBAL_TOGGLE: 'blocked_by_global_toggle',
  CANDIDATE_DISABLED: 'candidate_disabled',
  COST_BUDGET_EXCEEDED: 'cost_budget_exceeded',
  MISSING_DATA: 'missing_data',
  READY: 'ready',
});

const {
  PROTECTED_SET,
  GLOBAL,
  TEMPORAL_RECAP,
} = SITE_PULL_AGGREGATE_PATTERN_SCOPES;

const {
  DAY,
  RECENT_7D,
  HOUR_BLOCK,
  NIGHT_WINDOW,
  CYCLE_WINDOW,
} = SITE_PULL_AGGREGATE_TIME_AXES;

const {
  USAGE,
  VISIT,
  REENTRY,
  SWITCH,
  ROUTE,
  TAB,
  FEED,
  BACKGROUND,
  INTERVENTION,
  GOAL,
} = SITE_PULL_AGGREGATE_SIGNAL_FAMILIES;

const {
  PROTECTED_TOTAL,
  ALL,
  TOP_K_DOMAINS,
  TOP_K_EDGES,
  TOP_K_TIME_BLOCKS,
} = SITE_PULL_AGGREGATE_ENTITY_PROJECTIONS;

const {
  NONE,
  SAME_USER_30D,
  RECENT_7D: RECENT_7D_BASELINE,
  WEIGHTED_RECENT,
  PREVIOUS_PERIOD,
} = SITE_PULL_AGGREGATE_BASELINE_MODES;

const {
  FIXED_WINDOW_SPLIT,
  WEIGHTED_WINDOW,
  ROBUST_ANOMALY,
  HEAVY_HITTER_TOP_K,
  TRANSITION_GRAPH,
  EWMA_SLOPE,
  BOUNDED_TEMPLATE,
} = SITE_PULL_AGGREGATE_ANALYSIS_METHODS;

const {
  CHEAP,
  MODERATE,
  ANALYSIS_SESSION,
} = SITE_PULL_AGGREGATE_COST_CLASSES;

const {
  BLOCKED_BY_GLOBAL_TOGGLE,
  CANDIDATE_DISABLED,
  COST_BUDGET_EXCEEDED,
  MISSING_DATA,
  READY,
} = SITE_PULL_AGGREGATE_CANDIDATE_PLAN_STATUSES;

const COST_RANK = Object.freeze({
  [CHEAP]: 1,
  [MODERATE]: 2,
  [ANALYSIS_SESSION]: 3,
});

function createAggregateCostError(code, value) {
  const error = new Error(code);
  error.code = code;
  error.value = value;
  return error;
}

function resolveCostRank(value, errorCode) {
  if (!Object.prototype.hasOwnProperty.call(COST_RANK, value)) {
    throw createAggregateCostError(errorCode, value);
  }
  return COST_RANK[value];
}

function requireKnownAggregateCostBudget(costBudget) {
  resolveCostRank(costBudget, 'SITE_PULL_AGGREGATE_COST_BUDGET_INVALID');
  return costBudget;
}

const SIGNAL_FAMILY_DATA_REQUIREMENTS = Object.freeze({
  [USAGE]: Object.freeze(['usage']),
  [VISIT]: Object.freeze(['entry']),
  [REENTRY]: Object.freeze(['behavior']),
  [SWITCH]: Object.freeze(['behavior']),
  [ROUTE]: Object.freeze(['transition_edges']),
  [TAB]: Object.freeze(['behavior']),
  [FEED]: Object.freeze(['behavior']),
  [BACKGROUND]: Object.freeze(['behavior']),
  [INTERVENTION]: Object.freeze(['intervention']),
  [GOAL]: Object.freeze(['usage']),
});

const BASELINE_MODE_DATA_REQUIREMENTS = Object.freeze({
  [NONE]: Object.freeze([]),
  [SAME_USER_30D]: Object.freeze(['personal_baseline']),
  [RECENT_7D_BASELINE]: Object.freeze(['weekly']),
  [WEIGHTED_RECENT]: Object.freeze(['weekly']),
  [PREVIOUS_PERIOD]: Object.freeze(['weekly']),
});
const AGGREGATE_PLAN_DATA_FAMILIES = new Set([
  ...Object.values(SIGNAL_FAMILY_DATA_REQUIREMENTS).flat(),
  ...Object.values(BASELINE_MODE_DATA_REQUIREMENTS).flat(),
]);

function freezeArray(values = []) {
  return Object.freeze([...values]);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeUniqueIds(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    if (typeof value !== 'string' || value.length === 0 || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function aggregatePatternSpec({
  enabled = false,
  scope,
  timeAxes = [],
  signalFamilies = [],
  entityProjection,
  baselineModes = [],
  analysisMethods = [],
  recommendationFamily,
  costClass = CHEAP,
  defaultWindowDays = 7,
  maxLookbackDays = STATS_RANGE_MAX_DAYS,
  topK = 5,
  boundedCandidateLimit = 24,
  outputSurfaces = ['recap', 'diagnostic'],
  userValue,
} = {}) {
  return Object.freeze({
    enabled: enabled === true,
    scope,
    timeAxes: freezeArray(timeAxes),
    signalFamilies: freezeArray(signalFamilies),
    entityProjection,
    baselineModes: freezeArray(baselineModes),
    analysisMethods: freezeArray(analysisMethods),
    recommendationFamily,
    costClass,
    defaultWindowDays,
    maxLookbackDays,
    topK,
    boundedCandidateLimit,
    outputSurfaces: freezeArray(outputSurfaces),
    userValue,
  });
}

export const SITE_PULL_AGGREGATE_PATTERN_SPECS = Object.freeze({
  protected_checking_pressure: aggregatePatternSpec({
    enabled: true,
    scope: PROTECTED_SET,
    timeAxes: [DAY, RECENT_7D, HOUR_BLOCK],
    signalFamilies: [VISIT, REENTRY, SWITCH],
    entityProjection: PROTECTED_TOTAL,
    baselineModes: [SAME_USER_30D, RECENT_7D_BASELINE, WEIGHTED_RECENT],
    analysisMethods: [FIXED_WINDOW_SPLIT, WEIGHTED_WINDOW, ROBUST_ANOMALY, HEAVY_HITTER_TOP_K],
    recommendationFamily: 'checking_cooldown',
    costClass: MODERATE,
    outputSurfaces: ['sites_overview', 'recap', 'diagnostic'],
    userValue: 'Protected sites as a whole show repeated checking pressure.',
  }),
  temporal_reentry_pressure: aggregatePatternSpec({
    scope: TEMPORAL_RECAP,
    timeAxes: [DAY, HOUR_BLOCK, CYCLE_WINDOW],
    signalFamilies: [REENTRY, VISIT],
    entityProjection: TOP_K_TIME_BLOCKS,
    baselineModes: [SAME_USER_30D, PREVIOUS_PERIOD],
    analysisMethods: [ROBUST_ANOMALY, HEAVY_HITTER_TOP_K, BOUNDED_TEMPLATE],
    recommendationFamily: 'checking_cooldown',
    costClass: MODERATE,
    userValue: 'Quick reentry clusters in specific days or time blocks.',
  }),
  global_switch_churn: aggregatePatternSpec({
    scope: GLOBAL,
    timeAxes: [DAY, RECENT_7D, HOUR_BLOCK],
    signalFamilies: [SWITCH, TAB],
    entityProjection: ALL,
    baselineModes: [SAME_USER_30D, WEIGHTED_RECENT],
    analysisMethods: [WEIGHTED_WINDOW, ROBUST_ANOMALY, EWMA_SLOPE],
    recommendationFamily: 'checking_cooldown',
    costClass: CHEAP,
    userValue: 'Overall browser switching is unusually high.',
  }),
  protected_route_cycling: aggregatePatternSpec({
    scope: PROTECTED_SET,
    timeAxes: [DAY, RECENT_7D],
    signalFamilies: [ROUTE, REENTRY],
    entityProjection: TOP_K_EDGES,
    baselineModes: [SAME_USER_30D, RECENT_7D_BASELINE],
    analysisMethods: [TRANSITION_GRAPH, HEAVY_HITTER_TOP_K, BOUNDED_TEMPLATE],
    recommendationFamily: 'checking_cooldown',
    costClass: MODERATE,
    userValue: 'Protected domains form repeated route cycles.',
  }),
  late_window_pressure: aggregatePatternSpec({
    scope: TEMPORAL_RECAP,
    timeAxes: [NIGHT_WINDOW, RECENT_7D],
    signalFamilies: [USAGE, VISIT, REENTRY],
    entityProjection: PROTECTED_TOTAL,
    baselineModes: [SAME_USER_30D, WEIGHTED_RECENT],
    analysisMethods: [WEIGHTED_WINDOW, ROBUST_ANOMALY, BOUNDED_TEMPLATE],
    recommendationFamily: 'night_guard',
    costClass: CHEAP,
    userValue: 'Protected-site pressure concentrates in late windows.',
  }),
  feed_consumption_pressure: aggregatePatternSpec({
    scope: PROTECTED_SET,
    timeAxes: [DAY, RECENT_7D],
    signalFamilies: [FEED, USAGE],
    entityProjection: TOP_K_DOMAINS,
    baselineModes: [SAME_USER_30D, RECENT_7D_BASELINE],
    analysisMethods: [HEAVY_HITTER_TOP_K, ROBUST_ANOMALY, BOUNDED_TEMPLATE],
    recommendationFamily: 'scroll_guard',
    costClass: MODERATE,
    userValue: 'Feed-style consumption pressure is concentrated in protected domains.',
  }),
  tab_bursting_pressure: aggregatePatternSpec({
    scope: GLOBAL,
    timeAxes: [DAY, HOUR_BLOCK, RECENT_7D],
    signalFamilies: [TAB, SWITCH],
    entityProjection: TOP_K_DOMAINS,
    baselineModes: [SAME_USER_30D, WEIGHTED_RECENT],
    analysisMethods: [HEAVY_HITTER_TOP_K, ROBUST_ANOMALY, BOUNDED_TEMPLATE],
    recommendationFamily: 'tab_review',
    costClass: CHEAP,
    userValue: 'Tab creation or same-domain tab queues are unusually high.',
  }),
  background_residency_load: aggregatePatternSpec({
    scope: PROTECTED_SET,
    timeAxes: [DAY, RECENT_7D],
    signalFamilies: [BACKGROUND, USAGE],
    entityProjection: TOP_K_DOMAINS,
    baselineModes: [SAME_USER_30D, RECENT_7D_BASELINE],
    analysisMethods: [HEAVY_HITTER_TOP_K, ROBUST_ANOMALY, BOUNDED_TEMPLATE],
    recommendationFamily: 'background_review',
    costClass: CHEAP,
    userValue: 'Protected domains create background residency load.',
  }),
  intervention_effectiveness: aggregatePatternSpec({
    scope: PROTECTED_SET,
    timeAxes: [DAY, RECENT_7D],
    signalFamilies: [INTERVENTION, REENTRY],
    entityProjection: TOP_K_DOMAINS,
    baselineModes: [NONE, RECENT_7D_BASELINE],
    analysisMethods: [HEAVY_HITTER_TOP_K, BOUNDED_TEMPLATE],
    recommendationFamily: 'friction_tuning',
    costClass: CHEAP,
    userValue: 'Interventions differ in whether they lead to leaving or quick return.',
  }),
  goal_boundary_drift: aggregatePatternSpec({
    scope: PROTECTED_SET,
    timeAxes: [RECENT_7D],
    signalFamilies: [GOAL, USAGE],
    entityProjection: TOP_K_DOMAINS,
    baselineModes: [PREVIOUS_PERIOD, WEIGHTED_RECENT],
    analysisMethods: [FIXED_WINDOW_SPLIT, WEIGHTED_WINDOW, EWMA_SLOPE],
    recommendationFamily: 'goal',
    costClass: CHEAP,
    userValue: 'Goal boundaries are repeatedly exceeded or drifting upward.',
  }),
});

function hasCostBudget(spec, costBudget = CHEAP) {
  const budgetRank = resolveCostRank(costBudget, 'SITE_PULL_AGGREGATE_COST_BUDGET_INVALID');
  const specRank = resolveCostRank(spec?.costClass, 'SITE_PULL_AGGREGATE_COST_CLASS_INVALID');
  return specRank <= budgetRank;
}

function normalizeRequestedIds(requestedPatternIds = []) {
  if (!Array.isArray(requestedPatternIds) || requestedPatternIds.length === 0) return null;
  return new Set(requestedPatternIds.filter((id) => typeof id === 'string' && id.length > 0));
}

function resolveAggregateDataFamilies(spec = {}) {
  return mergeUniqueIds([
    ...asArray(spec.signalFamilies).flatMap((family) => SIGNAL_FAMILY_DATA_REQUIREMENTS[family] || []),
  ]).sort();
}

function resolveAggregateBaselineDataFamilies(spec = {}) {
  return mergeUniqueIds([
    ...asArray(spec.baselineModes).flatMap((mode) => BASELINE_MODE_DATA_REQUIREMENTS[mode] || []),
  ]).sort();
}

function buildFamilyStatusIndex(dataFamilyDiagnostics = []) {
  const index = new Map();
  asArray(dataFamilyDiagnostics).forEach((entry) => {
    if (entry?.family) index.set(entry.family, entry);
  });
  return index;
}

function assertAggregatePlanDataFamily(family) {
  if (!AGGREGATE_PLAN_DATA_FAMILIES.has(family)) {
    throw new Error(`SITE_PULL_AGGREGATE_PLAN_DATA_FAMILY_UNKNOWN:${family || 'missing'}`);
  }
}

function compactFamilyGap(family, familyDiagnostic = null) {
  assertAggregatePlanDataFamily(family);
  if (!familyDiagnostic) {
    return {
      family,
      status: 'unavailable',
      reason: 'family diagnostic unavailable',
    };
  }
  if (typeof familyDiagnostic.status !== 'string' || familyDiagnostic.status.length === 0) {
    throw new Error(`SITE_PULL_AGGREGATE_PLAN_FAMILY_STATUS_INVALID:${family}`);
  }
  return {
    family,
    status: familyDiagnostic.status,
    reason: familyDiagnostic.reason || null,
    ...(familyDiagnostic.permissionKey ? { permissionKey: familyDiagnostic.permissionKey } : {}),
    ...(Object.prototype.hasOwnProperty.call(familyDiagnostic, 'permissionGranted')
      ? { permissionGranted: familyDiagnostic.permissionGranted }
      : {}),
  };
}

function isFamilyAvailableForPlan(familyDiagnostic = null) {
  if (!familyDiagnostic) return false;
  if (familyDiagnostic.status === 'available') return true;
  return familyDiagnostic.status === 'not_applicable' && familyDiagnostic.reason === 'no_activity';
}

function resolveMissingDataFamilies(dataFamilies = [], familyIndex = new Map()) {
  return asArray(dataFamilies)
    .map((family) => {
      const familyDiagnostic = familyIndex.get(family) || null;
      return isFamilyAvailableForPlan(familyDiagnostic)
        ? null
        : compactFamilyGap(family, familyDiagnostic);
    })
    .filter(Boolean);
}

function resolveCandidateExecutionStatus(candidate, {
  enabled,
  costBudget,
  missingDataFamilies = [],
} = {}) {
  if (!enabled) {
    return {
      executionStatus: BLOCKED_BY_GLOBAL_TOGGLE,
      reason: 'aggregate_analysis_disabled',
    };
  }
  if (!candidate.enabled) {
    return {
      executionStatus: CANDIDATE_DISABLED,
      reason: 'candidate_disabled',
    };
  }
  if (!hasCostBudget(candidate, costBudget)) {
    return {
      executionStatus: COST_BUDGET_EXCEEDED,
      reason: 'cost_budget_exceeded',
    };
  }
  if (missingDataFamilies.length > 0) {
    return {
      executionStatus: MISSING_DATA,
      reason: 'required_data_unavailable',
    };
  }
  return {
    executionStatus: READY,
    reason: null,
  };
}

function compactAggregateCandidatePlan(candidate, {
  enabled,
  costBudget,
  familyIndex,
} = {}) {
  const dataFamilies = resolveAggregateDataFamilies(candidate);
  const baselineDataFamilies = resolveAggregateBaselineDataFamilies(candidate);
  const missingDataFamilies = resolveMissingDataFamilies(dataFamilies, familyIndex);
  const missingBaselineDataFamilies = resolveMissingDataFamilies(baselineDataFamilies, familyIndex);
  const { executionStatus, reason } = resolveCandidateExecutionStatus(candidate, {
    enabled,
    costBudget,
    missingDataFamilies,
  });
  return {
    id: candidate.id,
    enabled: candidate.enabled === true,
    executionStatus,
    reason,
    scope: candidate.scope,
    timeAxes: asArray(candidate.timeAxes),
    signalFamilies: asArray(candidate.signalFamilies),
    dataFamilies,
    baselineDataFamilies,
    missingDataFamilies,
    missingBaselineDataFamilies,
    limitedByMissingData: missingDataFamilies.length > 0,
    limitedByBaselineData: missingBaselineDataFamilies.length > 0,
    entityProjection: candidate.entityProjection,
    baselineModes: asArray(candidate.baselineModes),
    analysisMethods: asArray(candidate.analysisMethods),
    recommendationFamily: candidate.recommendationFamily,
    costClass: candidate.costClass,
    costBudgetEligible: hasCostBudget(candidate, costBudget),
    defaultWindowDays: candidate.defaultWindowDays,
    maxLookbackDays: candidate.maxLookbackDays,
    topK: candidate.topK,
    boundedCandidateLimit: candidate.boundedCandidateLimit,
    outputSurfaces: asArray(candidate.outputSurfaces),
    userValue: candidate.userValue,
  };
}

function buildAggregatePlanSummary(candidatePlans = []) {
  const summary = candidatePlans.reduce((result, candidate) => {
    result.totalCandidates += 1;
    result.statusCounts[candidate.executionStatus] = (
      result.statusCounts[candidate.executionStatus] || 0
    ) + 1;
    if (candidate.executionStatus === READY) result.readyCandidates += 1;
    if (candidate.executionStatus === MISSING_DATA) result.missingDataCandidates += 1;
    if (candidate.limitedByMissingData) result.limitedByMissingDataCandidates += 1;
    if (candidate.limitedByBaselineData) result.limitedByBaselineDataCandidates += 1;
    return result;
  }, {
    totalCandidates: 0,
    readyCandidates: 0,
    missingDataCandidates: 0,
    limitedByMissingDataCandidates: 0,
    limitedByBaselineDataCandidates: 0,
    statusCounts: {},
  });

  return {
    ...summary,
    disabledByGlobalToggleCandidates: summary.statusCounts[BLOCKED_BY_GLOBAL_TOGGLE] || 0,
    candidateDisabledCandidates: summary.statusCounts[CANDIDATE_DISABLED] || 0,
    costBudgetExceededCandidates: summary.statusCounts[COST_BUDGET_EXCEEDED] || 0,
  };
}

export function getSitePullAggregatePatternSpec(id) {
  return SITE_PULL_AGGREGATE_PATTERN_SPECS[id] || null;
}

export function listSitePullAggregatePatternSpecs({ includeDisabled = true } = {}) {
  return Object.entries(SITE_PULL_AGGREGATE_PATTERN_SPECS)
    .filter(([, spec]) => includeDisabled || spec.enabled)
    .map(([id, spec]) => ({ id, ...spec }));
}

export function buildSitePullAggregatePatternPlan({
  enabled = false,
  requestedPatternIds = [],
  costBudget = CHEAP,
  dataFamilyDiagnostics = [],
} = {}) {
  const resolvedCostBudget = requireKnownAggregateCostBudget(costBudget);
  const requested = normalizeRequestedIds(requestedPatternIds);
  const candidates = listSitePullAggregatePatternSpecs()
    .filter((candidate) => !requested || requested.has(candidate.id));
  const familyIndex = buildFamilyStatusIndex(dataFamilyDiagnostics);
  const candidatePlans = candidates.map((candidate) => compactAggregateCandidatePlan(candidate, {
    enabled: enabled === true,
    costBudget: resolvedCostBudget,
    familyIndex,
  }));
  const summary = buildAggregatePlanSummary(candidatePlans);

  if (!enabled) {
    return {
      version: SITE_PULL_AGGREGATE_PATTERN_SPEC_VERSION,
      status: SITE_PULL_AGGREGATE_PLAN_STATUSES.DISABLED,
      reason: 'aggregate_analysis_disabled',
      executionEnabled: false,
      costBudget: resolvedCostBudget,
      summary,
      candidates: candidatePlans,
      runnableCandidates: [],
      skippedCandidates: candidatePlans.map((candidate) => ({
        id: candidate.id,
        reason: candidate.reason,
        executionStatus: candidate.executionStatus,
      })),
    };
  }

  const runnableCandidates = candidatePlans.filter((candidate) => candidate.executionStatus === READY);
  const skippedCandidates = candidatePlans
    .filter((candidate) => candidate.executionStatus !== READY)
    .map((candidate) => ({
      id: candidate.id,
      reason: candidate.reason,
      executionStatus: candidate.executionStatus,
    }));

  return {
    version: SITE_PULL_AGGREGATE_PATTERN_SPEC_VERSION,
    status: runnableCandidates.length > 0
      ? SITE_PULL_AGGREGATE_PLAN_STATUSES.PLANNED
      : SITE_PULL_AGGREGATE_PLAN_STATUSES.EMPTY,
    reason: runnableCandidates.length > 0 ? null : 'no_enabled_candidates',
    executionEnabled: true,
    costBudget: resolvedCostBudget,
    summary,
    candidates: candidatePlans,
    runnableCandidates,
    skippedCandidates,
  };
}
