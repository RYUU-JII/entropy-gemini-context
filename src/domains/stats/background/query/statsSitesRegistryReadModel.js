import { isHostnameInList } from '../../../../lib/domain.js';
import {
  getProtectedCollectionDomains,
  resolveDomainUsageRecording,
  resolveTimeCapAvailability,
} from '../../../settings/config/dataCollectionPolicy.js';
import { hasSitesActivityObservation } from './sitesCompletedActivityDays.js';
import { resolveSitesRegistryDomain } from '../../shared/sitesDomainScope.js';
import { groupProtectionBudgetSites, projectProtectionBudgetWindow } from '../../projection/projectProtectionBudget.js';
import {
  isTrackingExcludedDomain,
  normalizeDomainKey,
  toNumber,
} from './statsAnalysisQueryShared.js';

export const SITES_REGISTRY_USAGE_BASIS = 'activity-day-observed';
export const SITES_REGISTRY_PROTECTION_BASIS = 'activity-day-charged';

function normalizeDomainList(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map(normalizeDomainKey)
      .filter(Boolean),
  ));
}

export function buildSitesObservedSiteDetails({
  rawSiteDetails = {},
  blockedTargets = [],
  allowedTargets = [],
  trackingExcludedUrls = [],
} = {}) {
  return Object.entries(rawSiteDetails && typeof rawSiteDetails === 'object' ? rawSiteDetails : {})
    .reduce((result, [domain, activeMs]) => {
      const observedDomain = normalizeDomainKey(domain);
      if (!observedDomain || isTrackingExcludedDomain(observedDomain, trackingExcludedUrls)) {
        return result;
      }
      const registryDomain = resolveSitesRegistryDomain(observedDomain, {
        blockedTargets,
        allowedTargets,
      });
      if (!registryDomain || isTrackingExcludedDomain(registryDomain, trackingExcludedUrls)) {
        return result;
      }
      result[registryDomain] = toNumber(result[registryDomain]) + toNumber(activeMs);
      return result;
    }, {});
}

export function buildSitesProtectedExposureDetails({
  statsRange,
  range,
  blockedTargets = [],
  allowedTargets = [],
  trackingExcludedUrls = [],
} = {}) {
  const budget = projectProtectionBudgetWindow({ statsRange, ...range, trackingExcludedUrls });
  const blockedSet = new Set(blockedTargets);
  return {
    siteDetails: Object.fromEntries(Object.entries(groupProtectionBudgetSites(budget.byDomain, { blockedTargets, allowedTargets }))
      .filter(([domain]) => blockedSet.has(domain))),
    totalExposure: budget.totalExposure,
  };
}

function resolveProtectionState({ chargedMs, goalMs }) {
  if (goalMs <= 0) return 'unset';
  if (chargedMs > goalMs) return 'over';
  if (chargedMs >= goalMs * 0.8) return 'near';
  return 'within';
}

function buildRegistryEntry({
  domain,
  type,
  observedMs,
  protectedExposureMs,
  goalMinutes,
  recording,
  capAvailability,
}) {
  const normalizedGoalMinutes = Math.max(0, Math.floor(toNumber(goalMinutes)));
  const goalMs = normalizedGoalMinutes * 60_000;
  const normalizedObservedMs = Math.max(0, toNumber(observedMs));
  const normalizedProtectedExposureMs = Math.max(0, toNumber(protectedExposureMs));
  const protectionBudget = type === 'blocked'
    ? {
        basis: SITES_REGISTRY_PROTECTION_BASIS,
        chargedMs: capAvailability.available ? normalizedProtectedExposureMs : null,
        goalMinutes: normalizedGoalMinutes,
        goalMs,
        remainingMs: capAvailability.available && goalMs > 0 ? Math.max(0, goalMs - normalizedProtectedExposureMs) : null,
        overMs: capAvailability.available ? (goalMs > 0 ? Math.max(0, normalizedProtectedExposureMs - goalMs) : 0) : null,
        ratio: capAvailability.available && goalMs > 0 ? normalizedProtectedExposureMs / goalMs : null,
        state: !capAvailability.available ? 'inactive' : resolveProtectionState({
          chargedMs: normalizedProtectedExposureMs,
          goalMs,
        }),
      }
    : null;

  return {
    domain,
    type,
    recording,
    capAvailability,
    usage: {
      basis: SITES_REGISTRY_USAGE_BASIS,
      observedMs: recording.enabled ? normalizedObservedMs : null,
    },
    protectionBudget,
  };
}

export function buildSitesPolicyOnlyRegistryEntry(domain, recordingPolicy) {
  const recording = resolveDomainUsageRecording(domain, recordingPolicy);
  if (recording.enabled) throw new Error('SITES_POLICY_ONLY_RECORDING_MUST_BE_DISABLED');
  return {
    ...buildRegistryEntry({
      domain,
      type: isHostnameInList(domain, recordingPolicy.blockedUrls) ? 'blocked'
        : isHostnameInList(domain, recordingPolicy.allowedUrls) ? 'allowed' : 'tracked',
      goalMinutes: recordingPolicy.siteGoals[domain],
      recording,
      capAvailability: resolveTimeCapAvailability(domain, recordingPolicy),
    }),
    usageAverage: { averageMs: null, totalMs: null, observedDayCount: 0, status: 'disabled' },
  };
}

export function buildSitesRegistryReadModel({
  rawSiteDetails = {},
  protectedSiteDetails = {},
  blockedTargets = [],
  allowedTargets = [],
  siteGoals = {},
  trackingExcludedUrls = [],
  completedDays = null,
  recordingPolicy,
} = {}) {
  if (!recordingPolicy || typeof recordingPolicy !== 'object') throw new Error('SITES_REGISTRY_RECORDING_POLICY_REQUIRED');
  const normalizedBlockedTargets = normalizeDomainList(blockedTargets);
  const protectedTargets = getProtectedCollectionDomains(recordingPolicy);
  const normalizedAllowedTargets = normalizeDomainList(allowedTargets);
  // Recording scope may include a retained goal/preset without a protection
  // rule. Membership is owned by blockedTargets, independently of collection.
  const blockedSet = new Set(normalizedBlockedTargets);
  const allowedSet = new Set(normalizedAllowedTargets);
  const observedSiteDetails = buildSitesObservedSiteDetails({
    rawSiteDetails: Object.fromEntries(Object.entries(rawSiteDetails).filter(([domain]) =>
      resolveDomainUsageRecording(domain, recordingPolicy).enabled)),
    blockedTargets: normalizedBlockedTargets,
    allowedTargets: normalizedAllowedTargets,
    trackingExcludedUrls,
  });
  const recentByDomain = new Map();
  for (const { projection } of completedDays?.observed || []) {
    const observedDomains = new Set();
    for (const fact of projection.domainTotals) {
      if (!hasSitesActivityObservation(fact) || !resolveDomainUsageRecording(fact.domain, recordingPolicy).enabled) continue;
      const domain = resolveSitesRegistryDomain(fact.domain, { blockedTargets: normalizedBlockedTargets, allowedTargets: normalizedAllowedTargets });
      if (isTrackingExcludedDomain(domain, trackingExcludedUrls)) continue;
      if (!recentByDomain.has(domain)) recentByDomain.set(domain, { totalMs: 0, observedDayCount: 0 });
      recentByDomain.get(domain).totalMs += fact.activeMs;
      observedDomains.add(domain);
    }
    for (const domain of observedDomains) recentByDomain.get(domain).observedDayCount += 1;
  }
  const domains = Array.from(new Set([
    ...protectedTargets,
    ...normalizedAllowedTargets,
    ...Object.keys(siteGoals || {}).map((domain) => resolveSitesRegistryDomain(domain, {
      blockedTargets: normalizedBlockedTargets,
      allowedTargets: normalizedAllowedTargets,
    })),
    ...Object.keys(observedSiteDetails),
    ...recentByDomain.keys(),
  ]))
    .filter((domain) => domain && (blockedSet.has(domain) || resolveDomainUsageRecording(domain, recordingPolicy).enabled));

  const entries = domains.map((domain) => {
    const recording = resolveDomainUsageRecording(domain, recordingPolicy);
    return { ...buildRegistryEntry({
    domain,
    type: blockedSet.has(domain) ? 'blocked' : allowedSet.has(domain) ? 'allowed' : 'tracked',
    observedMs: observedSiteDetails[domain],
    protectedExposureMs: protectedSiteDetails?.[domain],
    goalMinutes: siteGoals?.[domain],
    recording,
    capAvailability: resolveTimeCapAvailability(domain, recordingPolicy),
  }), usageAverage: !recording.enabled
    ? { averageMs: null, totalMs: null, observedDayCount: 0, status: 'disabled' }
    : buildRegistryAverage(recentByDomain.get(domain), completedDays?.window) };
  });

  return {
    usageBasis: SITES_REGISTRY_USAGE_BASIS,
    protectionBasis: SITES_REGISTRY_PROTECTION_BASIS,
    averageWindow: completedDays ? completedDays.window : null,
    observedSiteDetails,
    entries,
    byDomain: Object.fromEntries(entries.map((entry) => [entry.domain, entry])),
  };
}

function buildRegistryAverage(record, window) {
  if (!record || !window || window.observedDayCount === 0) {
    return { averageMs: null, totalMs: null, observedDayCount: 0, status: 'collecting' };
  }
  // Normalize recorded use by the same observed activity days for every site.
  // Missing site-day evidence remains explicit; it is not a verified zero day.
  return {
    averageMs: record.totalMs / window.observedDayCount,
    totalMs: record.totalMs,
    observedDayCount: record.observedDayCount,
    status: record.observedDayCount === window.windowDayCount ? 'recorded' : 'partial',
  };
}
