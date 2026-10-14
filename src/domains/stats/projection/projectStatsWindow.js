import { compareDateStr, listDateStrRange } from '../shared/dateMath.js'
import {
  STATS_REENTRY_GAP_BUCKET_KEYS,
  createUnobservedStatsDomainCollectionObservation,
  mergeStatsDomainCollectionObservations,
  requireStatsDomainCollectionObservation,
} from '../contracts/statsContracts.js'
import {
  createEmptyProjectionCategoryTotals,
  createEmptyProjectionSwitches,
  normalizeStatsProjectionFilter,
  STATS_PROJECTION_CATEGORY_IDS,
} from './projectionTypes.js'
import { projectStatsDay } from './projectStatsDay.js'

function toNumber(value) {
  return Number.isFinite(value) ? value : 0
}

function addCategoryTotals(target, source) {
  STATS_PROJECTION_CATEGORY_IDS.forEach((categoryId) => {
    const sourceEntry = source?.[categoryId]
    const targetEntry = target[categoryId]
    targetEntry.activeMs += toNumber(sourceEntry?.activeMs)
    targetEntry.backgroundMs += toNumber(sourceEntry?.backgroundMs)
    targetEntry.backgroundOpenMs += toNumber(sourceEntry?.backgroundOpenMs)
    targetEntry.backgroundMediaMs += toNumber(sourceEntry?.backgroundMediaMs)
    targetEntry.backgroundLingerMs += toNumber(sourceEntry?.backgroundLingerMs)
    targetEntry.staleTabMs += toNumber(sourceEntry?.staleTabMs)
    targetEntry.totalMs += toNumber(sourceEntry?.totalMs)
  })
}

function addSwitchTotals(target, source) {
  target.toBlocked += toNumber(source?.toBlocked)
  target.toAllowed += toNumber(source?.toAllowed)
  target.toUnmanaged += toNumber(source?.toUnmanaged)
  target.internal += toNumber(source?.internal)
}

function shouldIncludeHour(dateStr, hour, startDateStr, endDateStr, startHour, endHour) {
  if (compareDateStr(dateStr, startDateStr) < 0) {
    return false
  }

  if (compareDateStr(dateStr, endDateStr) > 0) {
    return false
  }

  if (dateStr === startDateStr && hour < startHour) {
    return false
  }

  if (dateStr === endDateStr && hour > endHour) {
    return false
  }

  return true
}

function resolveLocalHourEpochMs(dateStr, hour) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''))
  if (!match || !Number.isInteger(hour) || hour < 0 || hour > 24) return null
  const epochMs = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    hour,
    0,
    0,
    0,
  ).getTime()
  return Number.isFinite(epochMs) ? epochMs : null
}

function windowIncludesWholeDate(dateStr, startDateStr, endDateStr, startHour, endHour) {
  const afterStart = compareDateStr(dateStr, startDateStr) > 0
    || (dateStr === startDateStr && startHour === 0)
  const beforeEnd = compareDateStr(dateStr, endDateStr) < 0
    || (dateStr === endDateStr && endHour === 23)
  return afterStart && beforeEnd
}

function collectionObservationOverlapsWindow(
  observation,
  { startDateStr, endDateStr, startHour, endHour } = {},
) {
  if (!observation.observed) return false
  const windowStartAt = resolveLocalHourEpochMs(startDateStr, startHour)
  const windowEndExclusiveAt = resolveLocalHourEpochMs(endDateStr, endHour + 1)
  if (!Number.isFinite(windowStartAt) || !Number.isFinite(windowEndExclusiveAt)) {
    throw new Error('STATS_WINDOW_COLLECTION_RANGE_INVALID')
  }
  return observation.lastCapturedAt >= windowStartAt
    && observation.firstCapturedAt < windowEndExclusiveAt
}

const SESSION_SUM_FIELDS = Object.freeze(['count', 'totalMs', 'shortCount', 'longCount'])
const SESSION_MAX_FIELDS = Object.freeze(['maxMs'])
const BEHAVIOR_SUM_FIELDS = Object.freeze([
  'backgroundMediaMs',
  'backgroundLingerMs',
  'staleTabMs',
  'revisitWithin2m',
  'revisitWithin5m',
  'revisitWithin10m',
  'switchIns',
  'switchOuts',
  'switchBackWithin10m',
  'newTabEntrances',
  'duplicateTabEntrances',
  'highOpenTabEntrances',
  'scrollSpikeBursts',
  'fastScrollBursts',
  'feedPressureSignals',
  'feedInterruptSignals',
  'feedAdvanceBursts',
  'feedSkimSignals',
  'shortMediaAttentionSignals',
  'shortMediaWatchMs',
])
const BEHAVIOR_MAX_FIELDS = Object.freeze([
  'maxSameDomainOpenTabs',
  'maxOpenTabs',
  'maxFeedScreenfuls',
  'maxFeedItemTransitions',
])
const INTERVENTION_SUM_FIELDS = Object.freeze([
  'frictionShown',
  'continued',
  'left',
  'reenteredWithin5m',
  'reenteredWithin30m',
  'escapeClosed',
])
const NAVIGATION_SUM_FIELDS = Object.freeze([
  'total',
  'link',
  'typed',
  'reload',
  'generated',
  'keyword',
  'formSubmit',
  'startPage',
  'autoBookmark',
  'other',
  'addressBar',
  'forwardBack',
])

function mergeMetricFields(target, source, { sumFields = [], maxFields = [] } = {}) {
  sumFields.forEach((field) => {
    target[field] = toNumber(target[field]) + toNumber(source?.[field])
  })
  maxFields.forEach((field) => {
    target[field] = Math.max(toNumber(target[field]), toNumber(source?.[field]))
  })
}

function mergeDomainMetrics(existing, entry) {
  mergeMetricFields(existing.sessions, entry?.sessions, {
    sumFields: SESSION_SUM_FIELDS,
    maxFields: SESSION_MAX_FIELDS,
  })
  mergeMetricFields(existing.behavior, entry?.behavior, {
    sumFields: BEHAVIOR_SUM_FIELDS,
    maxFields: BEHAVIOR_MAX_FIELDS,
  })
  STATS_REENTRY_GAP_BUCKET_KEYS.forEach((key) => {
    existing.behavior.reentryGapBuckets[key] = (
      toNumber(existing.behavior.reentryGapBuckets[key])
      + toNumber(entry?.behavior?.reentryGapBuckets?.[key])
    )
  })
  mergeMetricFields(existing.interventions, entry?.interventions, {
    sumFields: INTERVENTION_SUM_FIELDS,
  })
  mergeMetricFields(existing.navigation, entry?.navigation, {
    sumFields: NAVIGATION_SUM_FIELDS,
  })
}

function ensureDomainEntry(domainAccumulator, entry) {
  if (!entry?.domain) return null
  if (!domainAccumulator.has(entry.domain)) {
    domainAccumulator.set(entry.domain, {
      domain: entry.domain,
      categoryId: entry.categoryId || 'other',
      collectionObservation: createUnobservedStatsDomainCollectionObservation(),
      activeMs: 0,
      backgroundMs: 0,
      backgroundOpenMs: 0,
      backgroundMediaMs: 0,
      backgroundLingerMs: 0,
      staleTabMs: 0,
      totalMs: 0,
      visits: 0,
      sessions: {},
      behavior: {
        reentryGapBuckets: {},
      },
      interventions: {},
      navigation: {},
    })
  }
  return domainAccumulator.get(entry.domain)
}

function mergeTimelineCollectionObservations(existing, incoming, source) {
  const merged = mergeStatsDomainCollectionObservations([existing, incoming], { source })
  if (!merged.observed) return merged
  return requireStatsDomainCollectionObservation({
    ...merged,
    sourceDomainCount: Math.max(existing.sourceDomainCount, incoming.sourceDomainCount),
  }, { source })
}

function mergeDomainCollectionObservation(
  domainAccumulator,
  entry,
  source,
  mergedObservationKeys,
  observationKey,
) {
  const existing = ensureDomainEntry(domainAccumulator, entry)
  if (!existing) return
  if (mergedObservationKeys.has(observationKey)) return
  existing.collectionObservation = mergeTimelineCollectionObservations(
    existing.collectionObservation,
    requireStatsDomainCollectionObservation(entry.collectionObservation, { source }),
    source,
  )
  mergedObservationKeys.add(observationKey)
}

function mergeDomainEntry(domainAccumulator, entry) {
  const existing = ensureDomainEntry(domainAccumulator, entry)
  if (!existing) return

  existing.activeMs += toNumber(entry.activeMs)
  existing.backgroundMs += toNumber(entry.backgroundMs)
  existing.backgroundOpenMs += toNumber(entry.backgroundOpenMs)
  existing.backgroundMediaMs += toNumber(entry.backgroundMediaMs)
  existing.backgroundLingerMs += toNumber(entry.backgroundLingerMs)
  existing.staleTabMs += toNumber(entry.staleTabMs)
  existing.totalMs += toNumber(entry.totalMs)
  existing.visits += toNumber(entry.visits)
  mergeDomainMetrics(existing, entry)
}

function resolveCompleteness(dayProjections, key) {
  if (dayProjections.every((projection) => projection?.meta?.completeness?.[key] === 'exact')) {
    return 'exact'
  }

  return 'unavailable'
}

function createWindowMeta(dayProjections) {
  return {
    policyBasis: 'current',
    completeness: {
      time: 'exact',
      categoryTime: dayProjections.every(
        (projection) => projection?.meta?.completeness?.categoryTime === 'exact'
      )
        ? 'exact'
        : 'derived',
      sessions: resolveCompleteness(dayProjections, 'sessions'),
      switches: resolveCompleteness(dayProjections, 'switches'),
    },
  }
}

export function projectStatsWindow({
  statsRange,
  startDateStr,
  endDateStr,
  startHour = 0,
  endHour = 23,
  policyContext,
  filter = {},
  targetDomain = null,
} = {}) {
  const normalizedFilter = normalizeStatsProjectionFilter(filter)
  const dateRange = listDateStrRange(startDateStr, endDateStr)
  const dayProjections = dateRange.map((dateStr) =>
    projectStatsDay({
      statsRange,
      dateStr,
      policyContext,
      filter: normalizedFilter,
    })
  )

  const buckets = []
  const domainAccumulator = new Map()
  const mergedObservationKeys = new Set()
  const totals = {
    activeMs: 0,
    backgroundMs: 0,
    backgroundOpenMs: 0,
    backgroundMediaMs: 0,
    backgroundLingerMs: 0,
    staleTabMs: 0,
    totalMs: 0,
    byCategory: createEmptyProjectionCategoryTotals(),
    sessions: { count: 0, totalMs: 0 },
    switches: createEmptyProjectionSwitches(),
  }

  dayProjections.forEach((projection) => {
    projection.domainTotals.forEach((entry) => {
      const source = `projectStatsWindow.domainTotals.${projection.dateStr}.${entry?.domain}`
      const observation = requireStatsDomainCollectionObservation(entry.collectionObservation, {
        source,
      })
      if (
        windowIncludesWholeDate(
          projection.dateStr,
          startDateStr,
          endDateStr,
          startHour,
          endHour,
        )
        || collectionObservationOverlapsWindow(observation, {
          startDateStr,
          endDateStr,
          startHour,
          endHour,
        })
      ) {
        mergeDomainCollectionObservation(
          domainAccumulator,
          entry,
          source,
          mergedObservationKeys,
          `${projection.dateStr}:${entry.domain}`,
        )
      }
    })
    const includedBuckets = projection.hourlyBuckets.filter((bucket) =>
      shouldIncludeHour(
        projection.dateStr,
        bucket.hour,
        startDateStr,
        endDateStr,
        startHour,
        endHour
      )
    )

    includedBuckets.forEach((bucket) => {
      const nextBucketIndex = buckets.length
      const targetEntry = targetDomain
        ? bucket.domains.find((entry) => entry.domain === targetDomain) || null
        : null

      buckets.push({
        ...bucket,
        bucketIndex: nextBucketIndex,
        target: targetEntry
          ? {
              domain: targetDomain,
              activeMs: toNumber(targetEntry.activeMs),
              backgroundMs: toNumber(targetEntry.backgroundMs),
              backgroundOpenMs: toNumber(targetEntry.backgroundOpenMs),
              backgroundMediaMs: toNumber(targetEntry.backgroundMediaMs),
              backgroundLingerMs: toNumber(targetEntry.backgroundLingerMs),
              staleTabMs: toNumber(targetEntry.staleTabMs),
              totalMs: toNumber(targetEntry.totalMs),
            }
          : null,
      })

      totals.activeMs += toNumber(bucket.activeMs)
      totals.backgroundMs += toNumber(bucket.backgroundMs)
      totals.backgroundOpenMs += toNumber(bucket.backgroundOpenMs)
      totals.backgroundMediaMs += toNumber(bucket.backgroundMediaMs)
      totals.backgroundLingerMs += toNumber(bucket.backgroundLingerMs)
      totals.staleTabMs += toNumber(bucket.staleTabMs)
      totals.totalMs += toNumber(bucket.totalMs)
      addCategoryTotals(totals.byCategory, bucket.byCategory)
      bucket.domains.forEach((entry) => {
        mergeDomainCollectionObservation(
          domainAccumulator,
          entry,
          `projectStatsWindow.hourlyBuckets.${projection.dateStr}.${bucket.hour}.${entry?.domain}`,
          mergedObservationKeys,
          `${projection.dateStr}:${entry.domain}`,
        )
        mergeDomainEntry(domainAccumulator, entry)
      })
    })

    if (projection.meta?.completeness?.sessions === 'exact') {
      includedBuckets.forEach((bucket) => {
        totals.sessions.count += toNumber(bucket.sessions?.count)
        totals.sessions.totalMs += toNumber(bucket.sessions?.totalMs)
      })
    }

    if (projection.meta?.completeness?.switches === 'exact') {
      includedBuckets.forEach((bucket) => addSwitchTotals(totals.switches, bucket.switches))
    }
  })

  const domainTotals = Array.from(domainAccumulator.values()).sort(
    (left, right) => right.totalMs - left.totalMs
  )
  const targetHourlyActiveMs = targetDomain
    ? buckets.map((bucket) => Number(bucket?.target?.activeMs) || 0)
    : null
  const targetHourlyBackgroundMs = targetDomain
    ? buckets.map((bucket) => Number(bucket?.target?.backgroundMs) || 0)
    : null
  const targetHourlyBackgroundMediaMs = targetDomain
    ? buckets.map((bucket) => Number(bucket?.target?.backgroundMediaMs) || 0)
    : null
  const targetHourlyBackgroundLingerMs = targetDomain
    ? buckets.map((bucket) => Number(bucket?.target?.backgroundLingerMs) || 0)
    : null
  const targetHourlyStaleTabMs = targetDomain
    ? buckets.map((bucket) => Number(bucket?.target?.staleTabMs) || 0)
    : null
  const target = targetDomain
    ? {
        ...(domainAccumulator.get(targetDomain) || {
          domain: targetDomain,
          collectionObservation: createUnobservedStatsDomainCollectionObservation(),
          activeMs: 0,
          backgroundMs: 0,
          backgroundOpenMs: 0,
          backgroundMediaMs: 0,
          backgroundLingerMs: 0,
          staleTabMs: 0,
          totalMs: 0,
          visits: 0,
        }),
        hourlyActiveMs: targetHourlyActiveMs,
        hourlyBackgroundMs: targetHourlyBackgroundMs,
        hourlyBackgroundMediaMs: targetHourlyBackgroundMediaMs,
        hourlyBackgroundLingerMs: targetHourlyBackgroundLingerMs,
        hourlyStaleTabMs: targetHourlyStaleTabMs,
      }
    : null

  return {
    meta: createWindowMeta(dayProjections),
    range: {
      startDateStr,
      endDateStr,
      startHour,
      endHour,
      bucketCount: buckets.length,
    },
    totals,
    buckets,
    domainTotals,
    target,
  }
}
