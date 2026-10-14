import { isHostnameMatch, normalizeDomain } from '../../../lib/domain.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toCount(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}

function normalizeDomainList(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeDomain(value))
      .filter(Boolean),
  ));
}

function resolveManagedProtectedDomains(settings = {}) {
  const source = isPlainObject(settings) ? settings : {};
  const blocked = normalizeDomainList(source.blockedUrls);
  const goalDomains = normalizeDomainList(Object.keys(isPlainObject(source.siteGoals) ? source.siteGoals : {}));
  return Array.from(new Set([...blocked, ...goalDomains]));
}

export function resolveProgressionManagedProtectedDomains(settings = {}) {
  return resolveManagedProtectedDomains(settings);
}

function getStatsDates(statsRange) {
  const dates = statsRange?.dates;
  return isPlainObject(dates) ? dates : {};
}

function isManagedStatsDomain(hostname = '', managedDomains = []) {
  const normalized = normalizeDomain(hostname);
  if (!normalized) return false;
  return (Array.isArray(managedDomains) ? managedDomains : [])
    .some((domain) => isHostnameMatch(normalized, domain));
}

function resolveDomainVisitCount(domainStats = null) {
  return toCount(domainStats?.visits, 0);
}

function resolveDomainUsageMs(domainStats = null) {
  return Math.max(0, Number(domainStats?.active) || 0) + Math.max(0, Number(domainStats?.background) || 0);
}

function resolveDomainFrictionSuccessCount(domainStats = null) {
  const interventions = domainStats?.interventions;
  const shown = toCount(interventions?.frictionShown, 0);
  const continued = toCount(interventions?.continued, 0);
  return Math.max(0, shown - continued);
}

function summarizeStatsRange(statsRange = null, managedDomains = []) {
  const domains = Array.isArray(managedDomains) ? managedDomains : [];
  const dates = getStatsDates(statsRange);
  let protectedVisitCount = 0;
  let frictionSuccessCount = 0;
  let activeProtectedDayCount = 0;

  Object.values(dates).forEach((dayStats) => {
    let activeDay = false;
    Object.entries(isPlainObject(dayStats?.domains) ? dayStats.domains : {}).forEach(([hostname, domainStats]) => {
      if (!isManagedStatsDomain(hostname, domains)) return;
      const visits = resolveDomainVisitCount(domainStats);
      const usageMs = resolveDomainUsageMs(domainStats);
      protectedVisitCount += visits;
      frictionSuccessCount += resolveDomainFrictionSuccessCount(domainStats);
      if (visits > 0 || usageMs > 0) {
        activeDay = true;
      }
    });
    if (activeDay) {
      activeProtectedDayCount += 1;
    }
  });

  return {
    protectedVisitCount,
    frictionSuccessCount,
    activeProtectedDayCount,
  };
}

export function createProgressionFactsProvider({
  getSettingsSnapshot,
  getStatsFactsRange,
  daysBack = 14,
  now = () => Date.now(),
} = {}) {
  if (typeof getSettingsSnapshot !== 'function') {
    throw new Error('PROGRESSION_FACTS_SETTINGS_SOURCE_REQUIRED');
  }
  if (typeof getStatsFactsRange !== 'function') {
    throw new Error('PROGRESSION_FACTS_STATS_RANGE_SOURCE_REQUIRED');
  }

  async function readFacts({ nowMs = now() } = {}) {
    const settings = await getSettingsSnapshot();
    const protectedDomains = resolveManagedProtectedDomains(settings);
    const baseFacts = {
      nowMs,
      activeProtectedSiteCount: protectedDomains.length,
      queuedProtectedSiteCount: 0,
    };

    if (protectedDomains.length === 0) {
      return baseFacts;
    }

    const statsRange = await getStatsFactsRange({
      daysBack: Math.max(1, Math.floor(Number(daysBack) || 14)),
    });
    return {
      ...baseFacts,
      ...summarizeStatsRange(statsRange, protectedDomains),
    };
  }

  return Object.freeze({
    readFacts,
  });
}

export const progressionFactsInternals = Object.freeze({
  resolveManagedProtectedDomains,
  summarizeStatsRange,
});

export default createProgressionFactsProvider;
