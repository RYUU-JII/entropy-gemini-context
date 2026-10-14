import { STATS_CATEGORY_IDS } from '../contracts/statsContracts.js'

export const STATS_PROJECTION_CATEGORY_IDS = STATS_CATEGORY_IDS

export const STATS_PROJECTION_DEFAULT_FILTER = Object.freeze({
  activity: 'active',
  categories: null,
  domains: null,
  includeTopDomains: false,
  topN: 5,
})

export function createEmptyProjectionCategoryTotals() {
  const totals = {}
  for (const categoryId of STATS_PROJECTION_CATEGORY_IDS) {
    totals[categoryId] = {
      activeMs: 0,
      backgroundMs: 0,
      backgroundOpenMs: 0,
      backgroundMediaMs: 0,
      backgroundLingerMs: 0,
      staleTabMs: 0,
      totalMs: 0,
    }
  }
  return totals
}

export function createEmptyProjectionSwitches() {
  return {
    toBlocked: 0,
    toAllowed: 0,
    toUnmanaged: 0,
    internal: 0,
  }
}

export function createEmptyProjectionSessions() {
  return {
    count: 0,
    totalMs: 0,
  }
}

function normalizeStringList(list) {
  if (!Array.isArray(list)) return null
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

export function normalizeStatsProjectionFilter(filter = {}) {
  const source = filter && typeof filter === 'object' ? filter : {}
  const numericTopN = Number(source.topN)

  return {
    activity: source.activity === 'background' || source.activity === 'total'
      ? source.activity
      : STATS_PROJECTION_DEFAULT_FILTER.activity,
    categories: Array.isArray(source.categories)
      ? normalizeStringList(source.categories) || []
      : null,
    domains: Array.isArray(source.domains)
      ? normalizeStringList(source.domains) || []
      : null,
    includeTopDomains: source.includeTopDomains === true,
    topN: Number.isFinite(numericTopN)
      ? Math.max(1, Math.floor(numericTopN))
      : STATS_PROJECTION_DEFAULT_FILTER.topN,
  }
}
