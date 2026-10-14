import {
  normalizeStatsDateStr,
  normalizeStatsDomainKey,
  normalizeStatsTransitionEdges,
} from '../../contracts/statsContracts.js';
import { isHostnameInList } from '../../../../lib/domain.js';
import { toNumber } from './statsAnalysisQueryShared.js';

function createTransitionEdgeIndexError(code, source = '') {
  const error = new Error(source ? `${code}:${source}` : code);
  error.code = code;
  error.source = source;
  return error;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireTransitionEdgeIndex(index) {
  if (!(index?.byDomain instanceof Map) || !(index?.observedDates instanceof Set)) {
    throw createTransitionEdgeIndexError('STATS_TRANSITION_EDGE_INDEX_REQUIRED');
  }
  return index;
}

function resolveOwnedDomainSet(ownedDomains) {
  if (ownedDomains === null || typeof ownedDomains === 'undefined') return null;
  if (!Array.isArray(ownedDomains)) {
    throw createTransitionEdgeIndexError('STATS_TRANSITION_EDGE_OWNED_DOMAINS_INVALID');
  }
  const normalized = ownedDomains.map(normalizeStatsDomainKey);
  if (normalized.some((domain) => !domain) || new Set(normalized).size !== normalized.length) {
    throw createTransitionEdgeIndexError('STATS_TRANSITION_EDGE_OWNED_DOMAINS_INVALID');
  }
  return new Set(normalized);
}

export function buildTransitionEdgeIndex(statsRange) {
  if (!isRecord(statsRange)) {
    throw createTransitionEdgeIndexError('STATS_TRANSITION_EDGE_INDEX_STATS_RANGE_REQUIRED');
  }
  if (!isRecord(statsRange.dates)) {
    throw createTransitionEdgeIndexError('STATS_TRANSITION_EDGE_INDEX_DATES_REQUIRED');
  }

  const byDomain = new Map();
  const observedDates = new Set();
  const add = (domain, edge) => {
    if (!byDomain.has(domain)) byDomain.set(domain, new Map());
    const byDate = byDomain.get(domain);
    if (!byDate.has(edge.dateStr)) byDate.set(edge.dateStr, []);
    byDate.get(edge.dateStr).push(edge);
  };

  Object.entries(statsRange.dates).forEach(([dateStr, day]) => {
    if (normalizeStatsDateStr(dateStr, null) !== dateStr || !isRecord(day)) {
      throw createTransitionEdgeIndexError('STATS_TRANSITION_EDGE_DAY_INVALID', dateStr);
    }
    observedDates.add(dateStr);
    Object.entries(normalizeStatsTransitionEdges(day.transitionEdges)).forEach(([edgeKey, value]) => {
      const edge = {
        id: `${dateStr}|${edgeKey}`,
        dateStr,
        ...value,
      };
      add(edge.fromDomain, edge);
      add(edge.toDomain, edge);
    });
  });

  return { byDomain, observedDates };
}

export function getDomainTransitionEdges(transitionEdgeIndex, domain, dates = [], {
  ownedDomains = null,
} = {}) {
  const { byDomain } = requireTransitionEdgeIndex(transitionEdgeIndex);
  const normalizedDomain = normalizeStatsDomainKey(domain);
  if (!normalizedDomain) {
    throw createTransitionEdgeIndexError('STATS_TRANSITION_EDGE_DOMAIN_INVALID');
  }
  const ownedDomainSet = resolveOwnedDomainSet(ownedDomains);
  if (ownedDomainSet && !ownedDomainSet.has(normalizedDomain)) {
    throw createTransitionEdgeIndexError('STATS_TRANSITION_EDGE_OWNER_DOMAIN_MISSING');
  }
  const matchingDateMaps = ownedDomainSet
    ? Array.from(ownedDomainSet)
        .map((ownedDomain) => byDomain.get(ownedDomain))
        .filter(Boolean)
    : Array.from(byDomain.entries())
        .filter(([candidateDomain]) => isHostnameInList(candidateDomain, [normalizedDomain]))
        .map(([, byDate]) => byDate);
  if (matchingDateMaps.length <= 0) return [];
  const uniqueEdges = new Map();
  (Array.isArray(dates) ? dates : [])
    .flatMap((dateStr) => matchingDateMaps.flatMap((byDate) => byDate.get(dateStr) || []))
    .forEach((edge) => uniqueEdges.set(edge.id, edge));
  return Array.from(uniqueEdges.values())
    .filter((edge) => {
      const fromInsideScope = ownedDomainSet
        ? ownedDomainSet.has(edge.fromDomain)
        : isHostnameInList(edge.fromDomain, [normalizedDomain]);
      const toInsideScope = ownedDomainSet
        ? ownedDomainSet.has(edge.toDomain)
        : isHostnameInList(edge.toDomain, [normalizedDomain]);
      return fromInsideScope !== toInsideScope;
    })
    .map((edge) => ({
      ...edge,
      // The query owns managed-child exclusions; consumers must not infer
      // direction again from a hostname suffix.
      scopeDirection: (ownedDomainSet
        ? ownedDomainSet.has(edge.toDomain)
        : isHostnameInList(edge.toDomain, [normalizedDomain])) ? 'incoming' : 'outgoing',
    }))
    .sort((left, right) => {
      const scoreDiff = ((right.count || 0) + ((right.returnWithin10m || 0) * 0.75))
        - ((left.count || 0) + ((left.returnWithin10m || 0) * 0.75));
      if (scoreDiff !== 0) return scoreDiff;
      return left.id.localeCompare(right.id);
    });
}

export function buildDomainTransitionEdgeSeries(transitionEdgeIndex, domain, dates = [], {
  ownedDomains = null,
} = {}) {
  const index = requireTransitionEdgeIndex(transitionEdgeIndex);
  return (Array.isArray(dates) ? dates : []).map((dateStr) => {
    const edges = getDomainTransitionEdges(index, domain, [dateStr], {
      ownedDomains,
    });
    return {
      dateStr,
      count: edges.reduce((sum, edge) => sum + toNumber(edge.count), 0),
      returnWithin10m: edges.reduce((sum, edge) => sum + toNumber(edge.returnWithin10m), 0),
      distinctEdgeCount: edges.length,
      topEdges: edges.slice(0, 5),
      observed: index.observedDates.has(dateStr),
    };
  });
}
