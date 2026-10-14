import {
  clamp01,
  smooth01,
  toNumber,
} from '../sitePullMath.js';
import { requireWeeklyObservationState } from '../../contracts/weeklyObservationContract.js';

export const SITE_PULL_ROUTE_PRESSURE_EVIDENCE_PROFILE_VERSION = 'site-pull-route-pressure-evidence-profile-v2';

export const SITE_PULL_ROUTE_PRESSURE_STATUSES = Object.freeze({
  INSUFFICIENT_ROUTE_EVIDENCE: 'insufficient_route_evidence',
  PAIR_REPETITION: 'pair_repetition',
  MULTI_EDGE_ROUTE_LOOP: 'multi_edge_route_loop',
  PROTECTED_ROUTE_RETURN: 'protected_route_return',
  PROTECTED_ROUTE_CAROUSEL: 'protected_route_carousel',
});

const MIN_PAIR_LOOP_SCORE = 0.3;
const MIN_PROTECTED_RETURN_SCORE = 0.55;
const MIN_ROUTE_LOOP_SCORE = 0.55;

function toCount(value) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function round3(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(Math.max(0, numeric).toFixed(3)) : 0;
}

function round4(value) {
  return Number(clamp01(value).toFixed(4));
}

function normalizeDomain(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/^www\./, '');
}

function normalizeEdge(edge = {}) {
  const fromDomain = normalizeDomain(edge.fromDomain);
  const toDomain = normalizeDomain(edge.toDomain);
  if (!fromDomain || !toDomain || fromDomain === toDomain) return null;
  return {
    fromDomain,
    toDomain,
    scopeDirection: edge.scopeDirection,
    count: toCount(edge.count),
    returnWithin10m: toCount(edge.returnWithin10m),
  };
}

function normalizeEdges(edges = []) {
  return Array.isArray(edges) ? edges.map(normalizeEdge).filter(Boolean) : [];
}

function normalizeSeries(series = []) {
  return Array.isArray(series)
    ? series.map((entry, index) => ({
        count: toCount(entry?.count),
        returnWithin10m: toCount(entry?.returnWithin10m),
        distinctEdgeCount: toCount(entry?.distinctEdgeCount),
        topEdges: normalizeEdges(entry?.topEdges),
        observed: requireWeeklyObservationState(entry, index, {
          source: 'sitePullRoutePressure.transitionEdgeSeries',
        }),
      }))
    : [];
}

function edgeStrength(edge = {}) {
  return toCount(edge.count) + (toCount(edge.returnWithin10m) * 1.25);
}

function sortEdges(edges = []) {
  return normalizeEdges(edges)
    .slice()
    .sort((left, right) => {
      const strengthDelta = edgeStrength(right) - edgeStrength(left);
      if (strengthDelta !== 0) return strengthDelta;
      return `${left.fromDomain}|${left.toDomain}`.localeCompare(`${right.fromDomain}|${right.toDomain}`);
    });
}

function aggregateEdges(edges = []) {
  const pairs = new Map();
  normalizeEdges(edges).forEach(edge => {
    const key = `${edge.fromDomain}|${edge.toDomain}`;
    const current = pairs.get(key);
    pairs.set(key, current ? { ...current, count: current.count + edge.count,
      returnWithin10m: current.returnWithin10m + edge.returnWithin10m } : edge);
  });
  const sortedEdges = sortEdges([...pairs.values()]);
  const count = sortedEdges.reduce((sum, edge) => sum + edge.count, 0);
  const returnWithin10m = sortedEdges.reduce((sum, edge) => sum + edge.returnWithin10m, 0);
  return {
    edges: sortedEdges,
    count,
    returnWithin10m,
    distinctEdgeCount: sortedEdges.length,
    returnRate: count > 0 ? returnWithin10m / count : 0,
    topEdge: sortedEdges[0] || null,
  };
}

function withSummaryCounts(summary, counters = {}) {
  const count = toCount(counters.count);
  const returnWithin10m = toCount(counters.returnWithin10m);
  const distinctEdgeCount = toCount(counters.distinctEdgeCount);
  if (count < summary.count || returnWithin10m < summary.returnWithin10m
    || distinctEdgeCount < summary.distinctEdgeCount || returnWithin10m > count) {
    throw new Error('SITE_PULL_ROUTE_SUMMARY_INCONSISTENT');
  }
  return {
    ...summary,
    count,
    returnWithin10m,
    distinctEdgeCount,
    returnRate: count > 0 ? returnWithin10m / count : 0,
  };
}

function edgeMatchesTarget(edge, targetDomain, direction) {
  if (!targetDomain) return false;
  return edge.scopeDirection === direction;
}

function summarizeSeries(series = []) {
  const recent7 = normalizeSeries(series).slice(-7);
  const observed = recent7.filter((entry) => entry.observed);
  const routeActiveDays = observed.filter((entry) => entry.count > 0).length;
  let routeStreakDays = 0;
  for (let index = recent7.length - 1; index >= 0; index -= 1) {
    if (!recent7[index].observed || recent7[index].count <= 0) break;
    routeStreakDays += 1;
  }
  return {
    observedDays: observed.length,
    recent7Days: observed.length,
    routeActiveDays,
    routeStreakDays,
    recent7Count: observed.reduce((sum, entry) => sum + entry.count, 0),
    recent7ReturnWithin10m: observed.reduce((sum, entry) => sum + entry.returnWithin10m, 0),
    recent7MaxDistinctEdgeCount: observed.reduce(
      (best, entry) => Math.max(best, entry.distinctEdgeCount),
      0,
    ),
  };
}

function computePairLoopScore({ topEdge, todayCount }) {
  if (!topEdge) return 0;
  const pairReturnRate = topEdge.count > 0 ? topEdge.returnWithin10m / topEdge.count : 0;
  const pairConcentration = todayCount > 0 ? topEdge.count / todayCount : 1;
  return clamp01(
    (smooth01(topEdge.count, 1, 5) * 0.4)
    + (smooth01(topEdge.returnWithin10m, 0, 3) * 0.25)
    + (smooth01(pairConcentration, 0.2, 0.5) * 0.25)
    + (smooth01(pairReturnRate, 0.2, 0.6) * 0.1),
  );
}

function computeProtectedReturnScore({ incoming }) {
  return clamp01(
    (smooth01(incoming.count, 1, 5) * 0.42)
    + (smooth01(incoming.returnWithin10m, 1, 3) * 0.36)
    + (smooth01(incoming.returnRate, 0.25, 0.65) * 0.22),
  );
}

function computeRoutePressureScore({ today }) {
  const todayScore = clamp01(
    (smooth01(today.count, 4, 10) * 0.32)
    + (smooth01(today.distinctEdgeCount, 2, 4) * 0.25)
    + (smooth01(today.returnRate, 0.15, 0.55) * 0.25)
    + (smooth01(today.returnWithin10m, 1, 5) * 0.18),
  );
  // Historical recurrence is context; it cannot promote today's histogram.
  return todayScore;
}

function resolveStatus({
  pairLoopScore,
  protectedReturnScore,
  routePressureScore,
  today,
  incoming,
}) {
  const canReturn = incoming.count >= 3
    && incoming.returnWithin10m >= 2
    && protectedReturnScore >= MIN_PROTECTED_RETURN_SCORE;
  const canRouteLoop = today.count >= 6
    && today.distinctEdgeCount >= 3
    && routePressureScore >= MIN_ROUTE_LOOP_SCORE;
  if (canReturn && canRouteLoop) {
    return SITE_PULL_ROUTE_PRESSURE_STATUSES.PROTECTED_ROUTE_CAROUSEL;
  }
  if (canReturn) return SITE_PULL_ROUTE_PRESSURE_STATUSES.PROTECTED_ROUTE_RETURN;
  if (canRouteLoop) return SITE_PULL_ROUTE_PRESSURE_STATUSES.MULTI_EDGE_ROUTE_LOOP;
  if (today.topEdge?.count >= 2 && pairLoopScore >= MIN_PAIR_LOOP_SCORE) {
    return SITE_PULL_ROUTE_PRESSURE_STATUSES.PAIR_REPETITION;
  }
  return SITE_PULL_ROUTE_PRESSURE_STATUSES.INSUFFICIENT_ROUTE_EVIDENCE;
}

function buildCaveats({ today, seriesSummary, routePressureScore }) {
  const caveats = ['bounded_edge_projection', 'edge_histogram_not_ordered_path',
    'return_interval_since_destination_exit'];
  if (seriesSummary.recent7Days < 7) caveats.push('partial_route_window');
  if (today.count > 0 && today.count < 3) caveats.push('low_transition_sample');
  if (today.count >= 6 && today.distinctEdgeCount < 3) caveats.push('concentrated_pair_not_route_loop');
  if (routePressureScore >= MIN_ROUTE_LOOP_SCORE && today.returnWithin10m <= 0) {
    caveats.push('route_loop_without_fast_return');
  }
  return caveats;
}

function routeChannelIds({
  canEmitPairLoop,
  canEmitProtectedReturn,
  canEmitRouteLoop,
  today,
  seriesSummary,
}) {
  return [
    canEmitPairLoop ? 'pair_repetition' : null,
    canEmitProtectedReturn ? 'protected_return' : null,
    canEmitRouteLoop ? 'multi_edge_route_loop' : null,
    today.returnWithin10m >= 2 && today.returnRate >= 0.25 ? 'fast_return_pressure' : null,
    seriesSummary.routeActiveDays >= 2 ? 'weekly_route_recurrence' : null,
  ].filter(Boolean);
}

export function buildSitePullRoutePressureEvidenceProfile({
  facts = {},
} = {}) {
  const transitionEdgeFacts = facts?.transitionEdges || {};
  const targetDomain = normalizeDomain(facts.domain);
  const todayEdges = normalizeEdges(transitionEdgeFacts.topEdges);
  const weeklyEdges = normalizeEdges(transitionEdgeFacts.weeklyTopEdges);
  const series = normalizeSeries(transitionEdgeFacts.series);

  const today = withSummaryCounts(aggregateEdges(todayEdges), {
    count: transitionEdgeFacts.todayCount,
    returnWithin10m: transitionEdgeFacts.todayReturnWithin10m,
    distinctEdgeCount: transitionEdgeFacts.todayDistinctEdgeCount,
  });
  const weekly = withSummaryCounts(aggregateEdges(weeklyEdges), {
    count: transitionEdgeFacts.weeklyCount,
    returnWithin10m: transitionEdgeFacts.weeklyReturnWithin10m,
    distinctEdgeCount: transitionEdgeFacts.weeklyDistinctEdgeCount,
  });
  const incoming = aggregateEdges(todayEdges.filter((edge) => edgeMatchesTarget(edge, targetDomain, 'incoming')));
  const outgoing = aggregateEdges(todayEdges.filter((edge) => edgeMatchesTarget(edge, targetDomain, 'outgoing')));
  const seriesSummary = summarizeSeries(series);
  const hasTransitionEdgeFacts = Boolean(transitionEdgeFacts.hasTransitionEdgeFacts)
    || today.count > 0
    || weekly.count > 0
    || seriesSummary.recent7Count > 0;

  const pairLoopScore = computePairLoopScore({
    topEdge: today.topEdge,
    todayCount: today.count,
  });
  const protectedReturnScore = computeProtectedReturnScore({ incoming });
  const routePressureScore = computeRoutePressureScore({ today });
  const status = resolveStatus({
    pairLoopScore,
    protectedReturnScore,
    routePressureScore,
    today,
    incoming,
  });
  const caveats = buildCaveats({ today, seriesSummary, routePressureScore });
  const confidence = hasTransitionEdgeFacts
    ? clamp01(transitionEdgeFacts.confidence)
    : 0;
  const canEmitPairLoop = Boolean(
    hasTransitionEdgeFacts
    && today.topEdge?.count >= 2
    && pairLoopScore >= MIN_PAIR_LOOP_SCORE
  );
  const canEmitProtectedReturn = Boolean(
    hasTransitionEdgeFacts
    && incoming.count >= 3
    && incoming.returnWithin10m >= 2
    && protectedReturnScore >= MIN_PROTECTED_RETURN_SCORE
  );
  const canEmitRouteLoop = Boolean(
    hasTransitionEdgeFacts
    && today.count >= 6
    && today.distinctEdgeCount >= 3
    && routePressureScore >= MIN_ROUTE_LOOP_SCORE
  );
  const channelIds = routeChannelIds({
    canEmitPairLoop,
    canEmitProtectedReturn,
    canEmitRouteLoop,
    today,
    seriesSummary,
  });
  const topEdge = today.topEdge || {};
  const topIncomingEdge = incoming.topEdge || {};

  const evidence = {
    evidenceWindow: 'today',
    temporalAssociation: 'directional_histogram',
    orderedSequenceObserved: false,
    evidenceFamilyIds: ['foreground_transition'],
    compositionBasis: 'single_family_intensity',
    targetDomain,
    routeStatus: status,
    routeChannelIds: channelIds,
    routeChannelCount: channelIds.length,
    pairRepetitionChannel: canEmitPairLoop,
    protectedReturnChannel: canEmitProtectedReturn,
    multiEdgeRouteChannel: canEmitRouteLoop,
    fastReturnPressureChannel: channelIds.includes('fast_return_pressure'),
    weeklyRouteRecurrenceChannel: channelIds.includes('weekly_route_recurrence'),
    todayCount: today.count,
    todayReturnWithin10m: today.returnWithin10m,
    todayDistinctEdgeCount: today.distinctEdgeCount,
    todayReturnRate: round3(today.returnRate),
    incomingCount: incoming.count,
    incomingReturnWithin10m: incoming.returnWithin10m,
    incomingDistinctEdgeCount: incoming.distinctEdgeCount,
    outgoingCount: outgoing.count,
    outgoingReturnWithin10m: outgoing.returnWithin10m,
    outgoingDistinctEdgeCount: outgoing.distinctEdgeCount,
    weeklyCount: weekly.count,
    weeklyReturnWithin10m: weekly.returnWithin10m,
    weeklyDistinctEdgeCount: weekly.distinctEdgeCount,
    routeActiveDays: seriesSummary.routeActiveDays,
    routeStreakDays: seriesSummary.routeStreakDays,
    topPairFromDomain: topEdge.fromDomain || '',
    topPairToDomain: topEdge.toDomain || '',
    topPairCount: toCount(topEdge.count),
    topPairReturnWithin10m: toCount(topEdge.returnWithin10m),
    topIncomingFromDomain: topIncomingEdge.fromDomain || '',
    topIncomingCount: toCount(topIncomingEdge.count),
    topIncomingReturnWithin10m: toCount(topIncomingEdge.returnWithin10m),
    pairLoopScore: round4(pairLoopScore),
    protectedReturnScore: round4(protectedReturnScore),
    routePressureScore: round4(routePressureScore),
    caveats,
  };

  return {
    version: SITE_PULL_ROUTE_PRESSURE_EVIDENCE_PROFILE_VERSION,
    status,
    hasTransitionEdgeFacts,
    score: round4(Math.max(routePressureScore, protectedReturnScore, pairLoopScore)),
    confidence,
    canEmitPairLoop,
    canEmitProtectedReturn,
    canEmitRouteLoop,
    evidence,
    pairLoop: {
      status: canEmitPairLoop
        ? SITE_PULL_ROUTE_PRESSURE_STATUSES.PAIR_REPETITION
        : SITE_PULL_ROUTE_PRESSURE_STATUSES.INSUFFICIENT_ROUTE_EVIDENCE,
      canEmitAtomic: canEmitPairLoop,
      strength: round4(pairLoopScore),
      evidence,
    },
    protectedReturn: {
      status: canEmitProtectedReturn
        ? status
        : SITE_PULL_ROUTE_PRESSURE_STATUSES.INSUFFICIENT_ROUTE_EVIDENCE,
      canEmitAtomic: canEmitProtectedReturn,
      strength: round4(protectedReturnScore),
      evidence,
    },
    routeLoop: {
      status: canEmitRouteLoop
        ? status
        : SITE_PULL_ROUTE_PRESSURE_STATUSES.INSUFFICIENT_ROUTE_EVIDENCE,
      canEmitComposite: canEmitRouteLoop,
      strength: round4(routePressureScore),
      evidence,
    },
  };
}
