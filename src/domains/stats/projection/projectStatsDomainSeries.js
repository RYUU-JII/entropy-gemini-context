import { listDateStrRange } from '../shared/dateMath.js'
import { createStatsPolicyContext } from './statsPolicyLens.js'
import { projectStatsDay } from './projectStatsDay.js'
import { projectStatsWindow } from './projectStatsWindow.js'
import {
  createStatsActivityDayWindow,
  getStatsTemporalGroupKey,
  normalizeStatsResetHour,
  normalizeStatsTemporalBasis,
  STATS_TEMPORAL_BASIS,
  STATS_TEMPORAL_PROTOCOL_VERSION,
} from './statsTemporalProtocol.js'

function createEmptySeries(domain, bucket, {
  basis = STATS_TEMPORAL_BASIS.CALENDAR,
  resetHour = null,
} = {}) {
  return {
    meta: {
      policyBasis: 'current',
      temporal: {
        version: STATS_TEMPORAL_PROTOCOL_VERSION,
        basis,
        grain: bucket,
        resetHour,
      },
      completeness: {
        time: 'derived',
        categoryTime: 'derived',
        sessions: 'unavailable',
        switches: 'unavailable',
      },
    },
    domain,
    bucket,
    grain: bucket,
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
      visits: 0,
    },
    points: [],
  }
}

function findDomainTotalsEntry(dayProjection, domain) {
  const domainTotals = Array.isArray(dayProjection?.domainTotals) ? dayProjection.domainTotals : []
  return domainTotals.find((entry) => entry?.domain === domain) || null
}

function buildDomainPeriodProjections({
  statsRange,
  dateStrs,
  domain,
  basis,
  resetHour,
  policyContext,
} = {}) {
  if (basis !== STATS_TEMPORAL_BASIS.ACTIVITY) {
    return dateStrs.map((dateStr) => projectStatsDay({
      statsRange,
      dateStr,
      policyContext,
      filter: {
        domains: [domain],
        topN: 1,
      },
    }))
  }

  return dateStrs.map((dateStr) => {
    const window = createStatsActivityDayWindow(dateStr, resetHour)
    if (!window) {
      return {
        dateStr,
        domainTotals: [],
        hourlyBuckets: [],
      }
    }

    const projection = projectStatsWindow({
      statsRange,
      policyContext,
      filter: {
        domains: [domain],
        topN: 1,
      },
      targetDomain: domain,
      startDateStr: window.startDateStr,
      endDateStr: window.endDateStr,
      startHour: window.startHour,
      endHour: window.endHour,
    })

    return {
      dateStr,
      domainTotals: Array.isArray(projection.domainTotals) ? projection.domainTotals : [],
      hourlyBuckets: Array.isArray(projection.buckets)
        ? projection.buckets.map((bucket) => ({
            ...bucket,
            activityDateStr: dateStr,
          }))
        : [],
    }
  })
}

export function projectStatsDomainSeries({
  statsRange,
  domain,
  startDateStr,
  endDateStr,
  bucket = 'hour',
  basis = STATS_TEMPORAL_BASIS.CALENDAR,
  resetHour = null,
  policyContext = createStatsPolicyContext(),
} = {}) {
  const normalizedDomain = typeof domain === 'string' ? domain.trim().toLowerCase() : ''
  const normalizedBasis = normalizeStatsTemporalBasis(basis)
  const normalizedResetHour = normalizedBasis === STATS_TEMPORAL_BASIS.ACTIVITY
    ? normalizeStatsResetHour(resetHour)
    : null
  const projection = createEmptySeries(normalizedDomain, bucket, {
    basis: normalizedBasis,
    resetHour: normalizedResetHour,
  })
  if (!normalizedDomain) return projection

  const dateStrs = listDateStrRange(startDateStr, endDateStr)
  if (!dateStrs.length) return projection

  const dayProjections = buildDomainPeriodProjections({
    statsRange,
    dateStrs,
    domain: normalizedDomain,
    basis: normalizedBasis,
    resetHour: normalizedResetHour,
    policyContext,
  })

  const dayPoints = dayProjections.map((dayProjection) => {
    const domainTotals = findDomainTotalsEntry(dayProjection, normalizedDomain)

    return {
      key: dayProjection.dateStr,
      dateStr: dayProjection.dateStr,
      hour: null,
      activeMs: Number(domainTotals?.activeMs) || 0,
      backgroundMs: Number(domainTotals?.backgroundMs) || 0,
      backgroundOpenMs: Number(domainTotals?.backgroundOpenMs) || 0,
      backgroundMediaMs: Number(domainTotals?.backgroundMediaMs) || 0,
      backgroundLingerMs: Number(domainTotals?.backgroundLingerMs) || 0,
      staleTabMs: Number(domainTotals?.staleTabMs) || 0,
      totalMs: Number(domainTotals?.totalMs) || 0,
      visits: Number(domainTotals?.visits) || 0,
    }
  })

  if (bucket === 'hour') {
    for (const dayProjection of dayProjections) {
      for (const hourlyBucket of dayProjection.hourlyBuckets) {
        const hourlyDomain = hourlyBucket.domains.find((entry) => entry.domain === normalizedDomain)
        projection.points.push({
          key: hourlyBucket.bucketKey,
          dateStr: hourlyBucket.dateStr,
          activityDateStr: hourlyBucket.activityDateStr || null,
          hour: hourlyBucket.hour,
          activeMs: Number(hourlyDomain?.activeMs) || 0,
          backgroundMs: Number(hourlyDomain?.backgroundMs) || 0,
          backgroundOpenMs: Number(hourlyDomain?.backgroundOpenMs) || 0,
          backgroundMediaMs: Number(hourlyDomain?.backgroundMediaMs) || 0,
          backgroundLingerMs: Number(hourlyDomain?.backgroundLingerMs) || 0,
          staleTabMs: Number(hourlyDomain?.staleTabMs) || 0,
          totalMs: Number(hourlyDomain?.totalMs) || 0,
          visits: Number(hourlyDomain?.visits) || 0,
        })
      }
    }
  } else if (bucket === 'day') {
    projection.points = dayPoints
  } else {
    const aggregate = new Map()
    for (const point of dayPoints) {
      const key = getStatsTemporalGroupKey(point.dateStr, bucket)
      if (!key) continue

      const current = aggregate.get(key) || {
        key,
        dateStr: key,
        hour: null,
        activeMs: 0,
        backgroundMs: 0,
        backgroundOpenMs: 0,
        backgroundMediaMs: 0,
        backgroundLingerMs: 0,
        staleTabMs: 0,
        totalMs: 0,
        visits: 0,
      }
      current.activeMs += point.activeMs
      current.backgroundMs += point.backgroundMs
      current.backgroundOpenMs += point.backgroundOpenMs
      current.backgroundMediaMs += point.backgroundMediaMs
      current.backgroundLingerMs += point.backgroundLingerMs
      current.staleTabMs += point.staleTabMs
      current.totalMs += point.totalMs
      current.visits += point.visits
      aggregate.set(key, current)
    }

    projection.points = Array.from(aggregate.values()).sort((left, right) => String(left.key).localeCompare(String(right.key)))
  }

  for (const point of projection.points) {
    projection.totals.activeMs += point.activeMs
    projection.totals.backgroundMs += point.backgroundMs
    projection.totals.backgroundOpenMs += point.backgroundOpenMs
    projection.totals.backgroundMediaMs += point.backgroundMediaMs
    projection.totals.backgroundLingerMs += point.backgroundLingerMs
    projection.totals.staleTabMs += point.staleTabMs
    projection.totals.totalMs += point.totalMs
    projection.totals.visits += point.visits
  }

  return projection
}
