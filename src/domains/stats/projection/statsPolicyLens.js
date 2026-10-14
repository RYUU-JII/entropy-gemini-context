import { isHostnameInList } from '../../../lib/index.js'

function normalizeUrlList(list) {
  if (!Array.isArray(list)) return []

  const normalized = []
  const seen = new Set()
  for (const rawValue of list) {
    const value = String(rawValue ?? '').trim().toLowerCase()
    if (!value || seen.has(value)) continue
    seen.add(value)
    normalized.push(value)
  }

  return normalized
}

function normalizeTimelineEntries(value) {
  const entries = Array.isArray(value) ? value : []
  return entries
    .map((entry) => {
      const source = entry && typeof entry === 'object' ? entry : {}
      const type = source.type === 'allowed' ? 'allowed' : 'blocked'
      const startEpochMs = Math.floor(Number(source.startEpochMs))
      if (!Number.isFinite(startEpochMs) || startEpochMs < 0) return null
      const endEpochMs = Math.floor(Number(source.endEpochMs))
      return {
        type,
        startEpochMs,
        ...(Number.isFinite(endEpochMs) && endEpochMs > startEpochMs ? { endEpochMs } : null),
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.startEpochMs - right.startEpochMs)
}

function normalizeSiteRuleTimeline(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const normalized = {}
  Object.entries(value).forEach(([domain, entries]) => {
    const key = String(domain ?? '').trim().toLowerCase()
    if (!key) return
    const timelineEntries = normalizeTimelineEntries(entries)
    if (timelineEntries.length > 0) normalized[key] = Object.freeze(timelineEntries)
  })
  return normalized
}

export function createStatsPolicyContext({
  blockedUrls = [],
  allowedUrls = [],
  trackingExcludedUrls = [],
  filteringMode = 'blocklist',
  siteRuleTimeline = {},
} = {}) {
  return Object.freeze({
    blockedUrls: Object.freeze(normalizeUrlList(blockedUrls)),
    allowedUrls: Object.freeze(normalizeUrlList(allowedUrls)),
    trackingExcludedUrls: Object.freeze(normalizeUrlList(trackingExcludedUrls)),
    siteRuleTimeline: Object.freeze(normalizeSiteRuleTimeline(siteRuleTimeline)),
    filteringMode: typeof filteringMode === 'string' && filteringMode.trim()
      ? filteringMode.trim()
      : 'blocklist',
  })
}

function findTimelineMatch(hostname, siteRuleTimeline = {}) {
  if (!hostname || !siteRuleTimeline || typeof siteRuleTimeline !== 'object') return null
  let best = null
  Object.entries(siteRuleTimeline).forEach(([ruleDomain, entries]) => {
    if (!Array.isArray(entries) || entries.length <= 0) return
    if (!isHostnameInList(hostname, [ruleDomain])) return
    if (!best || ruleDomain.length > best.ruleDomain.length) {
      best = { ruleDomain, entries }
    }
  })
  return best
}

function resolveTimelineCategory(entries = [], epochMs = null) {
  const timestamp = Math.floor(Number(epochMs))
  if (!Number.isFinite(timestamp) || timestamp < 0) return null
  let activeType = null
  entries.forEach((entry) => {
    if (!entry || !Number.isFinite(Number(entry.startEpochMs))) return
    const startsBeforeBucket = Number(entry.startEpochMs) <= timestamp
    const endsAfterBucket = !Number.isFinite(Number(entry.endEpochMs)) || timestamp < Number(entry.endEpochMs)
    if (startsBeforeBucket && endsAfterBucket) {
      activeType = entry.type === 'allowed' ? 'allowed' : 'blocked'
    }
  })
  return activeType
}

export function classifyDomain(domain, policyContext = createStatsPolicyContext(), timeContext = {}) {
  const hostname = String(domain ?? '').trim().toLowerCase()
  if (!hostname) return 'other'
  const timelineMatch = findTimelineMatch(hostname, policyContext.siteRuleTimeline)
  const timestamp = Math.floor(Number(timeContext?.epochMs))
  if (timelineMatch && Number.isFinite(timestamp) && timestamp >= 0) {
    return resolveTimelineCategory(timelineMatch.entries, timeContext?.epochMs) || 'other'
  }
  if (isHostnameInList(hostname, policyContext.blockedUrls)) return 'blocked'
  if (isHostnameInList(hostname, policyContext.allowedUrls)) return 'allowed'
  return 'other'
}

export function matchesDomainFilter(domain, filterDomains) {
  if (!Array.isArray(filterDomains)) return true
  const hostname = String(domain ?? '').trim().toLowerCase()
  if (!hostname) return false
  return filterDomains.includes(hostname)
}

export function isTrackingExcludedDomain(domain, policyContext = createStatsPolicyContext()) {
  const hostname = String(domain ?? '').trim().toLowerCase()
  if (!hostname) return false
  return isHostnameInList(hostname, policyContext.trackingExcludedUrls)
}

export function matchesCategoryFilter(categoryId, filterCategories) {
  if (!Array.isArray(filterCategories)) return true
  const normalized = String(categoryId ?? '').trim().toLowerCase()
  return filterCategories.includes(normalized)
}
