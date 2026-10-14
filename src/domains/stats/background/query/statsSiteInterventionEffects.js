import {
  resolveInterventionEffectMetadata,
} from '../../contracts/interventionEffectContracts.js';
import { isHostnameInList } from '../../../../lib/domain.js';
import { toNumber } from './statsAnalysisQueryShared.js';

const EFFECT_COUNTER_KEYS = Object.freeze([
  'shown',
  'continued',
  'left',
  'escapeClosed',
  'reentered',
  'reenteredWithin5m',
  'reenteredWithin30m',
  'totalOutcomeLatencyMs',
  'outcomeCount',
]);

function normalizeString(value, { maxLength = 160, lowercase = false } = {}) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return '';
  return lowercase ? trimmed.toLowerCase() : trimmed;
}

function normalizeArtifactId(value) {
  const normalized = normalizeString(value, { maxLength: 128 });
  return normalized.toLowerCase() === 'unknown' ? '' : normalized;
}

function normalizeDateStr(value) {
  const normalized = normalizeString(value, { maxLength: 16 });
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function toCount(value) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function createEmptyCounters() {
  return EFFECT_COUNTER_KEYS.reduce((result, key) => {
    result[key] = 0;
    return result;
  }, {});
}

function normalizeCounters(source = {}) {
  const counters = source && typeof source === 'object' ? source : {};
  return EFFECT_COUNTER_KEYS.reduce((result, key) => {
    result[key] = toCount(counters[key]);
    return result;
  }, {});
}

function addCounters(target, source) {
  const normalized = normalizeCounters(source);
  EFFECT_COUNTER_KEYS.forEach((key) => {
    target[key] += normalized[key];
  });
  return target;
}

function hasCounters(counters = {}) {
  return EFFECT_COUNTER_KEYS.some((key) => toCount(counters[key]) > 0);
}

function rate(count, total) {
  return total > 0 ? count / total : 0;
}

function normalizeRow(row = {}) {
  const dateStr = normalizeDateStr(row?.dateStr);
  const domain = normalizeString(row?.domain, { lowercase: true });
  const artifactFamily = normalizeString(row?.artifactFamily, { maxLength: 80 });
  const artifactId = normalizeArtifactId(row?.artifactId);
  const gateKind = normalizeString(row?.gateKind, { maxLength: 80 });
  const level = toCount(row?.level);
  if (!dateStr || !domain || !artifactFamily || !artifactId || !gateKind) return null;
  const metadata = resolveInterventionEffectMetadata({
    ...row,
    artifactFamily,
    artifactId,
    gateKind,
    level,
  });
  return {
    dateStr,
    domain,
    artifactFamily,
    artifactId,
    gateKind,
    level,
    interventionClass: metadata.interventionClass,
    resistanceEligible: metadata.resistanceEligible,
    effectivenessEligible: metadata.effectivenessEligible,
    counters: normalizeCounters(row?.counters),
  };
}

function artifactKey(row) {
  return [
    row.artifactFamily,
    row.artifactId,
    row.gateKind,
    String(row.level),
  ].join('|');
}

function buildArtifactSummary(key, row, counters) {
  const shown = toCount(counters.shown);
  const exitCount = toCount(counters.left) + toCount(counters.escapeClosed);
  return {
    key,
    artifactFamily: row.artifactFamily,
    artifactId: row.artifactId,
    gateKind: row.gateKind,
    level: row.level,
    interventionClass: row.interventionClass,
    resistanceEligible: row.resistanceEligible,
    effectivenessEligible: row.effectivenessEligible,
    counters: { ...counters },
    reentry30Rate: Number(rate(counters.reenteredWithin30m, shown).toFixed(4)),
    continueRate: Number(rate(counters.continued, shown).toFixed(4)),
    exitRate: Number(rate(exitCount, shown).toFixed(4)),
  };
}

function sortArtifactSummaries(left, right) {
  const shownDiff = right.counters.shown - left.counters.shown;
  if (shownDiff !== 0) return shownDiff;
  const reentryDiff = right.counters.reenteredWithin30m - left.counters.reenteredWithin30m;
  if (reentryDiff !== 0) return reentryDiff;
  return left.key.localeCompare(right.key);
}

function topByRate(artifacts, field) {
  return artifacts
    .filter((entry) => entry.counters.shown > 0)
    .slice()
    .sort((left, right) => {
      const rateDiff = right[field] - left[field];
      if (rateDiff !== 0) return rateDiff;
      const shownDiff = right.counters.shown - left.counters.shown;
      if (shownDiff !== 0) return shownDiff;
      return left.key.localeCompare(right.key);
    })[0] || null;
}

function createInterventionEffectIndexError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requireInterventionEffectRows(rows) {
  if (!Array.isArray(rows)) {
    throw createInterventionEffectIndexError('STATS_INTERVENTION_EFFECT_INDEX_ROWS_REQUIRED');
  }
  return rows;
}

function resolveOwnedDomainSet(ownedDomains) {
  if (ownedDomains === null || typeof ownedDomains === 'undefined') return null;
  if (!Array.isArray(ownedDomains)) {
    throw createInterventionEffectIndexError('STATS_INTERVENTION_EFFECT_OWNED_DOMAINS_INVALID');
  }
  const normalized = ownedDomains.map((domain) => normalizeString(domain, { lowercase: true }));
  if (normalized.some((domain) => !domain) || new Set(normalized).size !== normalized.length) {
    throw createInterventionEffectIndexError('STATS_INTERVENTION_EFFECT_OWNED_DOMAINS_INVALID');
  }
  return new Set(normalized);
}

function requireInterventionEffectRow(row) {
  const normalized = normalizeRow(row);
  if (!normalized) {
    throw createInterventionEffectIndexError('STATS_INTERVENTION_EFFECT_ROW_INVALID');
  }
  return normalized;
}

export function buildInterventionEffectIndex(rows) {
  const byDomainDate = new Map();
  requireInterventionEffectRows(rows)
    .map(requireInterventionEffectRow)
    .forEach((row) => {
      if (!byDomainDate.has(row.domain)) byDomainDate.set(row.domain, new Map());
      const dateMap = byDomainDate.get(row.domain);
      if (!dateMap.has(row.dateStr)) dateMap.set(row.dateStr, []);
      dateMap.get(row.dateStr).push(row);
    });
  return { byDomainDate };
}

export function buildInterventionEffectSummary(rows = []) {
  const all = createEmptyCounters();
  const resistanceEligible = createEmptyCounters();
  const effectivenessEligible = createEmptyCounters();
  const excludedFromResistance = createEmptyCounters();
  const classMap = new Map();
  const artifactMap = new Map();

  (Array.isArray(rows) ? rows : [])
    .map(requireInterventionEffectRow)
    .forEach((row) => {
      addCounters(all, row.counters);
      if (row.resistanceEligible) addCounters(resistanceEligible, row.counters);
      else addCounters(excludedFromResistance, row.counters);
      if (row.effectivenessEligible) addCounters(effectivenessEligible, row.counters);

      const classKey = row.interventionClass || 'unknown';
      if (!classMap.has(classKey)) {
        classMap.set(classKey, {
          interventionClass: classKey,
          counters: createEmptyCounters(),
          resistanceEligible: row.resistanceEligible,
          effectivenessEligible: row.effectivenessEligible,
        });
      }
      addCounters(classMap.get(classKey).counters, row.counters);

      const key = artifactKey(row);
      if (!artifactMap.has(key)) {
        artifactMap.set(key, {
          row,
          counters: createEmptyCounters(),
        });
      }
      addCounters(artifactMap.get(key).counters, row.counters);
    });

  const artifactSummaries = Array.from(artifactMap.entries())
    .map(([key, entry]) => buildArtifactSummary(key, entry.row, entry.counters))
    .sort(sortArtifactSummaries);
  const byArtifact = artifactSummaries.slice(0, 16);
  const byInterventionClass = Array.from(classMap.values())
    .sort((left, right) => right.counters.shown - left.counters.shown);

  return {
    hasEffectFacts: hasCounters(all),
    all,
    resistanceEligible,
    effectivenessEligible,
    excludedFromResistance,
    byInterventionClass,
    byArtifact,
    topReentryArtifact: topByRate(artifactSummaries, 'reentry30Rate'),
    topExitArtifact: topByRate(artifactSummaries, 'exitRate'),
  };
}

export function getDomainInterventionEffectSummary(effectIndex = null, domain, dateStrs = [], {
  ownedDomains = null,
} = {}) {
  const normalizedDomain = normalizeString(domain, { lowercase: true });
  if (!effectIndex?.byDomainDate || !normalizedDomain) {
    return buildInterventionEffectSummary([]);
  }
  const ownedDomainSet = resolveOwnedDomainSet(ownedDomains);
  if (ownedDomainSet && !ownedDomainSet.has(normalizedDomain)) {
    throw createInterventionEffectIndexError('STATS_INTERVENTION_EFFECT_OWNER_DOMAIN_MISSING');
  }
  const matchingDateMaps = ownedDomainSet
    ? Array.from(ownedDomainSet)
        .map((ownedDomain) => effectIndex.byDomainDate.get(ownedDomain))
        .filter(Boolean)
    : Array.from(effectIndex.byDomainDate.entries())
        .filter(([candidateDomain]) => isHostnameInList(candidateDomain, [normalizedDomain]))
        .map(([, dateMap]) => dateMap);
  if (matchingDateMaps.length <= 0) return buildInterventionEffectSummary([]);
  const requestedDates = Array.isArray(dateStrs)
    ? dateStrs.map(normalizeDateStr).filter(Boolean)
    : [];
  const rows = requestedDates.length > 0
    ? requestedDates.flatMap((dateStr) => (
        matchingDateMaps.flatMap((dateMap) => dateMap.get(dateStr) || [])
      ))
    : matchingDateMaps.flatMap((dateMap) => Array.from(dateMap.values()).flat());
  return buildInterventionEffectSummary(rows);
}
