import { listDateStrRange, parseLocalDateParts } from '../shared/dateMath.js';
import { resolveSitesRegistryDomain } from '../shared/sitesDomainScope.js';
import { isHostnameInList } from '../../../lib/domain.js';

export function requireProtectionCharge(value, source) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`STATS_PROTECTION_CHARGE_INVALID:${source}`);
  }
  return value;
}

// Protection charge is a recorded fact. Current membership, category labels and
// optional interval coverage cannot reclassify or reconstruct an earlier charge.
export function projectProtectionBudgetWindow({
  statsRange, startDateStr, endDateStr, startHour = 0, endHour = 23, trackingExcludedUrls = [],
}) {
  if (!statsRange || !statsRange.dates || typeof statsRange.dates !== 'object' || Array.isArray(statsRange.dates)
    || !parseLocalDateParts(startDateStr) || !parseLocalDateParts(endDateStr) || startDateStr > endDateStr
    || !Array.isArray(trackingExcludedUrls)
    || !Number.isInteger(startHour) || startHour < 0 || startHour > 23
    || !Number.isInteger(endHour) || endHour < 0 || endHour > 23
    || (startDateStr === endDateStr && startHour > endHour)) {
    throw new Error('STATS_PROTECTION_BUDGET_WINDOW_INVALID');
  }
  const byDomain = {};
  for (const dateStr of listDateStrRange(startDateStr, endDateStr)) {
    if (!Object.hasOwn(statsRange.dates, dateStr)) continue;
    const day = statsRange.dates[dateStr];
    if (!day || !day.domains || typeof day.domains !== 'object' || Array.isArray(day.domains)) {
      throw new Error(`STATS_PROTECTION_BUDGET_DAY_INVALID:${dateStr}`);
    }
    for (const [domain, fact] of Object.entries(day.domains)) {
      if (isHostnameInList(domain, trackingExcludedUrls)) continue;
      const hours = fact.hourlyProtectedActive;
      if (!Array.isArray(hours) || hours.length !== 24) {
        throw new Error(`STATS_PROTECTION_CHARGE_HOURS_INVALID:${dateStr}:${domain}`);
      }
      let chargedMs = 0;
      for (let hour = 0; hour < 24; hour += 1) {
        const value = requireProtectionCharge(hours[hour], `${dateStr}:${domain}:${hour}`);
        if (dateStr === startDateStr && hour < startHour) continue;
        if (dateStr === endDateStr && hour > endHour) continue;
        chargedMs += value;
      }
      byDomain[domain] = (Object.hasOwn(byDomain, domain) ? byDomain[domain] : 0) + chargedMs;
    }
  }
  return {
    basis: 'activity-day-charged', byDomain,
    totalExposure: Object.values(byDomain).reduce((total, value) => total + value, 0),
  };
}

export function groupProtectionBudgetSites(byDomain, rules) {
  const siteDetails = {};
  for (const [domain, value] of Object.entries(byDomain)) {
    const target = resolveSitesRegistryDomain(domain, rules);
    const charge = requireProtectionCharge(value, domain);
    siteDetails[target] = (Object.hasOwn(siteDetails, target) ? siteDetails[target] : 0) + charge;
  }
  return siteDetails;
}

export function readActivityDaySiteCharge(day, hostname, rules) {
  if (day === undefined) return 0; // No recorded facts for this activity day yet.
  if (!day || !day.domains || typeof day.domains !== 'object' || Array.isArray(day.domains)) {
    throw new Error('STATS_PROTECTION_BUDGET_DOMAINS_INVALID');
  }
  const target = resolveSitesRegistryDomain(hostname, rules);
  let chargedMs = 0;
  for (const [domain, fact] of Object.entries(day.domains)) {
    if (resolveSitesRegistryDomain(domain, rules) !== target) continue;
    chargedMs += requireProtectionCharge(fact.protectedActive, domain);
  }
  return chargedMs;
}
