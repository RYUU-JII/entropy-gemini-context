import { listDateStrRange } from '../shared/dateMath.js'
import {
  createEmptyProjectionCategoryTotals,
  createEmptyProjectionSessions,
  createEmptyProjectionSwitches,
  normalizeStatsProjectionFilter,
  STATS_PROJECTION_CATEGORY_IDS,
} from './projectionTypes.js'
import { createStatsPolicyContext } from './statsPolicyLens.js'
import { projectStatsDay } from './projectStatsDay.js'
import { projectStatsWindow } from './projectStatsWindow.js'
import {
  createStatsActivityDayWindow,
  getStatsTemporalGroupKey,
  normalizeStatsTemporalBasis,
  normalizeStatsResetHour,
  STATS_TEMPORAL_BASIS,
  STATS_TEMPORAL_PROTOCOL_VERSION,
} from './statsTemporalProtocol.js'

function createEmptySummary(groupBy, {
  basis = STATS_TEMPORAL_BASIS.CALENDAR,
  resetHour = null,
} = {}) {
  return {
    meta: {
      policyBasis: 'current',
      temporal: {
        version: STATS_TEMPORAL_PROTOCOL_VERSION,
        basis,
        grain: groupBy,
        resetHour,
      },
      completeness: {
        time: 'exact',
        categoryTime: 'exact',
        sessions: 'exact',
        switches: 'exact',
      },
    },
    groupBy,
    grain: groupBy,
    basis,
    resetHour,
    totals: {
      activeMs: 0,
      backgroundMs: 0,
      backgroundOpenMs: 0,
      backgroundMediaMs: 0,
      backgroundLingerMs: 0,
      staleTabMs: 0,
      totalMs: 0,
      byCategory: createEmptyProjectionCategoryTotals(),
      sessions: createEmptyProjectionSessions(),
      switches: createEmptyProjectionSwitches(),
    },
    groups: [],
    topDomains: [],
  }
}

function createGroup(key, label, startDateStr, endDateStr) {
  return {
    key,
    label,
    startDateStr,
    endDateStr,
    activeMs: 0,
    backgroundMs: 0,
    backgroundOpenMs: 0,
    backgroundMediaMs: 0,
    backgroundLingerMs: 0,
    staleTabMs: 0,
    totalMs: 0,
    byCategory: createEmptyProjectionCategoryTotals(),
    sessions: createEmptyProjectionSessions(),
    switches: createEmptyProjectionSwitches(),
  }
}

function sortDomainEntries(entries) {
  return [...entries].sort((left, right) => {
    const activeDiff = (Number(right.activeMs) || 0) - (Number(left.activeMs) || 0)
    if (activeDiff !== 0) return activeDiff

    const totalDiff = (Number(right.totalMs) || 0) - (Number(left.totalMs) || 0)
    if (totalDiff !== 0) return totalDiff

    return String(left.domain).localeCompare(String(right.domain))
  })
}

function buildPeriodProjections({
  statsRange,
  dateStrs,
  basis,
  resetHour,
  policyContext,
  filter,
} = {}) {
  if (basis !== STATS_TEMPORAL_BASIS.ACTIVITY) {
    return dateStrs.map((dateStr) => projectStatsDay({
      statsRange,
      dateStr,
      policyContext,
      filter,
    }))
  }

  return dateStrs.map((dateStr) => {
    const window = createStatsActivityDayWindow(dateStr, resetHour)
    if (!window) {
      return {
        dateStr,
        meta: {
          completeness: {
            time: 'exact',
            categoryTime: 'exact',
            sessions: 'unavailable',
            switches: 'unavailable',
          },
        },
        totals: createEmptySummary('day').totals,
        domainTotals: [],
      }
    }

    const projection = projectStatsWindow({
      statsRange,
      policyContext,
      filter,
      startDateStr: window.startDateStr,
      endDateStr: window.endDateStr,
      startHour: window.startHour,
      endHour: window.endHour,
    })

    return {
      dateStr,
      meta: projection.meta,
      range: {
        ...projection.range,
        basis: window.basis,
        resetHour: window.resetHour,
        activityDateStr: window.activityDateStr,
      },
      totals: projection.totals,
      domainTotals: Array.isArray(projection.domainTotals) ? projection.domainTotals : [],
    }
  })
}

export function projectStatsSummary({
  statsRange,
  startDateStr,
  endDateStr,
  groupBy = 'day',
  basis = STATS_TEMPORAL_BASIS.CALENDAR,
  resetHour = null,
  policyContext = createStatsPolicyContext(),
  filter = {},
} = {}) {
  const normalizedBasis = normalizeStatsTemporalBasis(basis)
  const normalizedResetHour = normalizedBasis === STATS_TEMPORAL_BASIS.ACTIVITY
    ? normalizeStatsResetHour(resetHour)
    : null
  const summary = createEmptySummary(groupBy, {
    basis: normalizedBasis,
    resetHour: normalizedResetHour,
  })
  const normalizedFilter = normalizeStatsProjectionFilter(filter)
  const dateStrs = listDateStrRange(startDateStr, endDateStr)
  if (!dateStrs.length) return summary

  const dayProjections = buildPeriodProjections({
    statsRange,
    dateStrs,
    basis: normalizedBasis,
    resetHour: normalizedResetHour,
    policyContext,
    filter: normalizedFilter,
  })

  const groups = new Map()
  const domainTotals = new Map()

  for (const dayProjection of dayProjections) {
    let key = dayProjection.dateStr
    let label = dayProjection.dateStr

    if (groupBy === 'week' || groupBy === 'month') {
      key = getStatsTemporalGroupKey(dayProjection.dateStr, groupBy)
      label = key
    }

    if (!key) continue

    const currentGroup = groups.get(key) || createGroup(key, label, dayProjection.dateStr, dayProjection.dateStr)
    currentGroup.endDateStr = dayProjection.dateStr
    currentGroup.activeMs += dayProjection.totals.activeMs
    currentGroup.backgroundMs += dayProjection.totals.backgroundMs
    currentGroup.backgroundOpenMs += dayProjection.totals.backgroundOpenMs
    currentGroup.backgroundMediaMs += dayProjection.totals.backgroundMediaMs
    currentGroup.backgroundLingerMs += dayProjection.totals.backgroundLingerMs
    currentGroup.staleTabMs += dayProjection.totals.staleTabMs
    currentGroup.totalMs += dayProjection.totals.totalMs
    currentGroup.sessions.count += dayProjection.totals.sessions.count
    currentGroup.sessions.totalMs += dayProjection.totals.sessions.totalMs
    currentGroup.switches.toBlocked += dayProjection.totals.switches.toBlocked
    currentGroup.switches.toAllowed += dayProjection.totals.switches.toAllowed
    currentGroup.switches.toUnmanaged += dayProjection.totals.switches.toUnmanaged
    currentGroup.switches.internal += dayProjection.totals.switches.internal

    for (const categoryId of STATS_PROJECTION_CATEGORY_IDS) {
      currentGroup.byCategory[categoryId].activeMs += dayProjection.totals.byCategory[categoryId].activeMs
      currentGroup.byCategory[categoryId].backgroundMs += dayProjection.totals.byCategory[categoryId].backgroundMs
      currentGroup.byCategory[categoryId].backgroundOpenMs += dayProjection.totals.byCategory[categoryId].backgroundOpenMs
      currentGroup.byCategory[categoryId].backgroundMediaMs += dayProjection.totals.byCategory[categoryId].backgroundMediaMs
      currentGroup.byCategory[categoryId].backgroundLingerMs += dayProjection.totals.byCategory[categoryId].backgroundLingerMs
      currentGroup.byCategory[categoryId].staleTabMs += dayProjection.totals.byCategory[categoryId].staleTabMs
      currentGroup.byCategory[categoryId].totalMs += dayProjection.totals.byCategory[categoryId].totalMs
      summary.totals.byCategory[categoryId].activeMs += dayProjection.totals.byCategory[categoryId].activeMs
      summary.totals.byCategory[categoryId].backgroundMs += dayProjection.totals.byCategory[categoryId].backgroundMs
      summary.totals.byCategory[categoryId].backgroundOpenMs += dayProjection.totals.byCategory[categoryId].backgroundOpenMs
      summary.totals.byCategory[categoryId].backgroundMediaMs += dayProjection.totals.byCategory[categoryId].backgroundMediaMs
      summary.totals.byCategory[categoryId].backgroundLingerMs += dayProjection.totals.byCategory[categoryId].backgroundLingerMs
      summary.totals.byCategory[categoryId].staleTabMs += dayProjection.totals.byCategory[categoryId].staleTabMs
      summary.totals.byCategory[categoryId].totalMs += dayProjection.totals.byCategory[categoryId].totalMs
    }

    groups.set(key, currentGroup)

    summary.totals.activeMs += dayProjection.totals.activeMs
    summary.totals.backgroundMs += dayProjection.totals.backgroundMs
    summary.totals.backgroundOpenMs += dayProjection.totals.backgroundOpenMs
    summary.totals.backgroundMediaMs += dayProjection.totals.backgroundMediaMs
    summary.totals.backgroundLingerMs += dayProjection.totals.backgroundLingerMs
    summary.totals.staleTabMs += dayProjection.totals.staleTabMs
    summary.totals.totalMs += dayProjection.totals.totalMs
    summary.totals.sessions.count += dayProjection.totals.sessions.count
    summary.totals.sessions.totalMs += dayProjection.totals.sessions.totalMs
    summary.totals.switches.toBlocked += dayProjection.totals.switches.toBlocked
    summary.totals.switches.toAllowed += dayProjection.totals.switches.toAllowed
    summary.totals.switches.toUnmanaged += dayProjection.totals.switches.toUnmanaged
    summary.totals.switches.internal += dayProjection.totals.switches.internal

    for (const domainEntry of dayProjection.domainTotals) {
      const currentDomain = domainTotals.get(domainEntry.domain) || {
        domain: domainEntry.domain,
        categoryId: domainEntry.categoryId,
        activeMs: 0,
        backgroundMs: 0,
        backgroundOpenMs: 0,
        backgroundMediaMs: 0,
        backgroundLingerMs: 0,
        staleTabMs: 0,
        totalMs: 0,
        visits: 0,
      }
      currentDomain.activeMs += domainEntry.activeMs
      currentDomain.backgroundMs += domainEntry.backgroundMs
      currentDomain.backgroundOpenMs += domainEntry.backgroundOpenMs
      currentDomain.backgroundMediaMs += domainEntry.backgroundMediaMs
      currentDomain.backgroundLingerMs += domainEntry.backgroundLingerMs
      currentDomain.staleTabMs += domainEntry.staleTabMs
      currentDomain.totalMs += domainEntry.totalMs
      currentDomain.visits += domainEntry.visits
      domainTotals.set(domainEntry.domain, currentDomain)
    }
  }

  summary.groups = Array.from(groups.values()).sort((left, right) => String(left.key).localeCompare(String(right.key)))
  summary.topDomains = sortDomainEntries(domainTotals.values()).slice(0, normalizedFilter.topN)

  summary.meta.completeness.time = dayProjections.some((projection) => projection.meta.completeness.time === 'derived')
    ? 'derived'
    : 'exact'
  summary.meta.completeness.categoryTime = dayProjections.some((projection) => projection.meta.completeness.categoryTime === 'derived')
    ? 'derived'
    : 'exact'
  summary.meta.completeness.sessions = dayProjections.some((projection) => projection.meta.completeness.sessions === 'unavailable')
    ? 'unavailable'
    : 'exact'
  summary.meta.completeness.switches = dayProjections.some((projection) => projection.meta.completeness.switches === 'unavailable')
    ? 'unavailable'
    : 'exact'

  return summary
}
