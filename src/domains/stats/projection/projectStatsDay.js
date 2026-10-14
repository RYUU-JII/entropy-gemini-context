import {
  STATS_REENTRY_GAP_BUCKET_KEYS,
  buildStatsDomainCollectionObservation,
  normalizeHourlyRollup,
} from '../contracts/statsContracts.js'
import {
  createEmptyProjectionCategoryTotals,
  normalizeStatsProjectionFilter,
  STATS_PROJECTION_CATEGORY_IDS,
} from './projectionTypes.js'
import {
  classifyDomain,
  createStatsPolicyContext,
  isTrackingExcludedDomain,
  matchesCategoryFilter,
  matchesDomainFilter,
} from './statsPolicyLens.js'

const EMPTY_SWITCHES = Object.freeze({
  toBlocked: 0,
  toAllowed: 0,
  toUnmanaged: 0,
  internal: 0,
})

function getStatsDates(statsRange) {
  if (statsRange?.dates && typeof statsRange.dates === 'object') {
    return statsRange.dates
  }

  return statsRange && typeof statsRange === 'object' ? statsRange : {}
}

function toNumber(value) {
  return Number.isFinite(value) ? value : 0
}

function toArray24(value) {
  const source = Array.isArray(value) ? value : []
  return Array.from({ length: 24 }, (_, index) => toNumber(source[index]))
}

function normalizeReentryGapBuckets(source) {
  const buckets = source && typeof source === 'object' ? source : {}
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = Math.max(0, Math.floor(toNumber(buckets[key])))
    return result
  }, {})
}

function normalizeHourlyReentryGapBuckets(source) {
  const buckets = source && typeof source === 'object' ? source : {}
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = toArray24(buckets[key]).map((value) => Math.max(0, Math.floor(value)))
    return result
  }, {})
}

function hasReentryGapBucketSignal(source) {
  const buckets = normalizeReentryGapBuckets(source)
  return STATS_REENTRY_GAP_BUCKET_KEYS.some((key) => buckets[key] > 0)
}

function createBucket(dateStr, hour) {
  return {
    dateStr,
    hour,
    bucketKey: `${dateStr}:${String(hour).padStart(2, '0')}`,
    activeMs: 0,
    backgroundMs: 0,
    backgroundOpenMs: 0,
    backgroundMediaMs: 0,
    backgroundLingerMs: 0,
    staleTabMs: 0,
    totalMs: 0,
    byCategory: createEmptyProjectionCategoryTotals(),
    domains: [],
    topDomains: [],
    sessions: { count: 0, totalMs: 0 },
    switches: { ...EMPTY_SWITCHES },
  }
}

function createMeta({ sessionsState, switchesState, categoryTimeState = 'exact' }) {
  return {
    policyBasis: 'current',
    completeness: {
      time: 'exact',
      categoryTime: categoryTimeState,
      sessions: sessionsState,
      switches: switchesState,
    },
  }
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

function normalizeDomainSessionProjection(source) {
  return {
    count: Math.max(0, Math.floor(toNumber(source?.count))),
    totalMs: toNumber(source?.totalMs),
    shortCount: Math.max(0, Math.floor(toNumber(source?.shortCount))),
    longCount: Math.max(0, Math.floor(toNumber(source?.longCount))),
    maxMs: toNumber(source?.maxMs),
  }
}

function normalizeDomainBehaviorProjection(source) {
  return {
    backgroundMediaMs: toNumber(source?.backgroundMediaMs),
    backgroundLingerMs: toNumber(source?.backgroundLingerMs),
    staleTabMs: toNumber(source?.staleTabMs),
    revisitWithin2m: Math.max(0, Math.floor(toNumber(source?.revisitWithin2m))),
    revisitWithin5m: Math.max(0, Math.floor(toNumber(source?.revisitWithin5m))),
    revisitWithin10m: Math.max(0, Math.floor(toNumber(source?.revisitWithin10m))),
    reentryGapBuckets: normalizeReentryGapBuckets(source?.reentryGapBuckets),
    switchIns: Math.max(0, Math.floor(toNumber(source?.switchIns))),
    switchOuts: Math.max(0, Math.floor(toNumber(source?.switchOuts))),
    switchBackWithin10m: Math.max(0, Math.floor(toNumber(source?.switchBackWithin10m))),
    newTabEntrances: Math.max(0, Math.floor(toNumber(source?.newTabEntrances))),
    duplicateTabEntrances: Math.max(0, Math.floor(toNumber(source?.duplicateTabEntrances))),
    highOpenTabEntrances: Math.max(0, Math.floor(toNumber(source?.highOpenTabEntrances))),
    maxSameDomainOpenTabs: Math.max(0, Math.floor(toNumber(source?.maxSameDomainOpenTabs))),
    maxOpenTabs: Math.max(0, Math.floor(toNumber(source?.maxOpenTabs))),
    scrollSpikeBursts: Math.max(0, Math.floor(toNumber(source?.scrollSpikeBursts))),
    fastScrollBursts: Math.max(0, Math.floor(toNumber(source?.fastScrollBursts))),
    feedPressureSignals: Math.max(0, Math.floor(toNumber(source?.feedPressureSignals))),
    feedInterruptSignals: Math.max(0, Math.floor(toNumber(source?.feedInterruptSignals))),
    feedAdvanceBursts: Math.max(0, Math.floor(toNumber(source?.feedAdvanceBursts))),
    feedSkimSignals: Math.max(0, Math.floor(toNumber(source?.feedSkimSignals))),
    shortMediaAttentionSignals: Math.max(0, Math.floor(toNumber(source?.shortMediaAttentionSignals))),
    shortMediaWatchMs: Math.max(0, toNumber(source?.shortMediaWatchMs)),
    maxFeedScreenfuls: toNumber(source?.maxFeedScreenfuls),
    maxFeedItemTransitions: Math.max(0, Math.floor(toNumber(source?.maxFeedItemTransitions))),
  }
}

function normalizeDomainInterventionProjection(source) {
  return {
    frictionShown: Math.max(0, Math.floor(toNumber(source?.frictionShown))),
    continued: Math.max(0, Math.floor(toNumber(source?.continued))),
    left: Math.max(0, Math.floor(toNumber(source?.left))),
    reenteredWithin5m: Math.max(0, Math.floor(toNumber(source?.reenteredWithin5m))),
    reenteredWithin30m: Math.max(0, Math.floor(toNumber(source?.reenteredWithin30m))),
    escapeClosed: Math.max(0, Math.floor(toNumber(source?.escapeClosed))),
  }
}

function normalizeDomainNavigationProjection(source) {
  return {
    total: Math.max(0, Math.floor(toNumber(source?.total))),
    link: Math.max(0, Math.floor(toNumber(source?.link))),
    typed: Math.max(0, Math.floor(toNumber(source?.typed))),
    reload: Math.max(0, Math.floor(toNumber(source?.reload))),
    generated: Math.max(0, Math.floor(toNumber(source?.generated))),
    keyword: Math.max(0, Math.floor(toNumber(source?.keyword))),
    formSubmit: Math.max(0, Math.floor(toNumber(source?.formSubmit))),
    startPage: Math.max(0, Math.floor(toNumber(source?.startPage))),
    autoBookmark: Math.max(0, Math.floor(toNumber(source?.autoBookmark))),
    other: Math.max(0, Math.floor(toNumber(source?.other))),
    addressBar: Math.max(0, Math.floor(toNumber(source?.addressBar))),
    forwardBack: Math.max(0, Math.floor(toNumber(source?.forwardBack))),
  }
}

function getRollupBucketValues(rollup, hour) {
  const activeMs = toNumber(rollup?.active?.[hour])
  const backgroundMs = toNumber(rollup?.background?.[hour])
  return {
    activeMs,
    backgroundMs,
    backgroundOpenMs: backgroundMs,
    totalMs: activeMs + backgroundMs,
  }
}

function resolveLocalHourEpochMs(dateStr, hour) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''))
  const normalizedHour = Math.max(0, Math.min(23, Math.floor(Number(hour) || 0)))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const epochMs = new Date(year, month - 1, day, normalizedHour, 0, 0, 0).getTime()
  return Number.isFinite(epochMs) ? epochMs : null
}

function buildDomainTotals(daySource, policyContext, filter, dateStr) {
  const domains = daySource?.domains || {}
  const domainTotals = []
  const bucketDomainMaps = Array.from({ length: 24 }, () => new Map())

  Object.entries(domains).forEach(([domain, domainStats]) => {
    if (isTrackingExcludedDomain(domain, policyContext)) {
      return
    }

    const categoryId = classifyDomain(domain, policyContext)

    if (!matchesDomainFilter(domain, filter.domains)) {
      return
    }

    const hourlyActive = toArray24(domainStats?.hourlyActive)
    const hourlyBackground = toArray24(domainStats?.hourlyBackground)
    const hourlyBackgroundMediaMs = toArray24(domainStats?.behavior?.hourlyBackgroundMediaMs)
    const hourlyBackgroundLingerMs = toArray24(domainStats?.behavior?.hourlyBackgroundLingerMs)
    const hourlyStaleTabMs = toArray24(domainStats?.behavior?.hourlyStaleTabMs)
    const hourlyVisits = toArray24(domainStats?.hourlyVisits).map((value) => Math.max(0, Math.floor(value)))
    const hourlySessionCount = toArray24(domainStats?.sessions?.hourlyCount).map((value) => Math.max(0, Math.floor(value)))
    const hourlySessionTotalMs = toArray24(domainStats?.sessions?.hourlyTotalMs)
    const hourlySessionShortCount = toArray24(domainStats?.sessions?.hourlyShortCount).map((value) => Math.max(0, Math.floor(value)))
    const hourlySessionLongCount = toArray24(domainStats?.sessions?.hourlyLongCount).map((value) => Math.max(0, Math.floor(value)))
    const hourlySessionMaxMs = toArray24(domainStats?.sessions?.hourlyMaxMs)
    const hourlyRevisitWithin2m = toArray24(domainStats?.behavior?.hourlyRevisitWithin2m).map((value) => Math.max(0, Math.floor(value)))
    const hourlyRevisitWithin5m = toArray24(domainStats?.behavior?.hourlyRevisitWithin5m).map((value) => Math.max(0, Math.floor(value)))
    const hourlyRevisitWithin10m = toArray24(domainStats?.behavior?.hourlyRevisitWithin10m).map((value) => Math.max(0, Math.floor(value)))
    const hourlyReentryGapBuckets = normalizeHourlyReentryGapBuckets(domainStats?.behavior?.hourlyReentryGapBuckets)
    const hourlySwitchIns = toArray24(domainStats?.behavior?.hourlySwitchIns).map((value) => Math.max(0, Math.floor(value)))
    const hourlySwitchOuts = toArray24(domainStats?.behavior?.hourlySwitchOuts).map((value) => Math.max(0, Math.floor(value)))
    const hourlySwitchBackWithin10m = toArray24(domainStats?.behavior?.hourlySwitchBackWithin10m).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNewTabEntrances = toArray24(domainStats?.behavior?.hourlyNewTabEntrances).map((value) => Math.max(0, Math.floor(value)))
    const hourlyDuplicateTabEntrances = toArray24(domainStats?.behavior?.hourlyDuplicateTabEntrances).map((value) => Math.max(0, Math.floor(value)))
    const hourlyHighOpenTabEntrances = toArray24(domainStats?.behavior?.hourlyHighOpenTabEntrances).map((value) => Math.max(0, Math.floor(value)))
    const hourlyMaxSameDomainOpenTabs = toArray24(domainStats?.behavior?.hourlyMaxSameDomainOpenTabs).map((value) => Math.max(0, Math.floor(value)))
    const hourlyMaxOpenTabs = toArray24(domainStats?.behavior?.hourlyMaxOpenTabs).map((value) => Math.max(0, Math.floor(value)))
    const hourlyScrollSpikeBursts = toArray24(domainStats?.behavior?.hourlyScrollSpikeBursts).map((value) => Math.max(0, Math.floor(value)))
    const hourlyFastScrollBursts = toArray24(domainStats?.behavior?.hourlyFastScrollBursts).map((value) => Math.max(0, Math.floor(value)))
    const hourlyFeedPressureSignals = toArray24(domainStats?.behavior?.hourlyFeedPressureSignals).map((value) => Math.max(0, Math.floor(value)))
    const hourlyFeedInterruptSignals = toArray24(domainStats?.behavior?.hourlyFeedInterruptSignals).map((value) => Math.max(0, Math.floor(value)))
    const hourlyFeedAdvanceBursts = toArray24(domainStats?.behavior?.hourlyFeedAdvanceBursts).map((value) => Math.max(0, Math.floor(value)))
    const hourlyFeedSkimSignals = toArray24(domainStats?.behavior?.hourlyFeedSkimSignals).map((value) => Math.max(0, Math.floor(value)))
    const hourlyShortMediaAttentionSignals = toArray24(domainStats?.behavior?.hourlyShortMediaAttentionSignals).map((value) => Math.max(0, Math.floor(value)))
    const hourlyShortMediaWatchMs = toArray24(domainStats?.behavior?.hourlyShortMediaWatchMs)
    const hourlyMaxFeedScreenfuls = toArray24(domainStats?.behavior?.hourlyMaxFeedScreenfuls)
    const hourlyMaxFeedItemTransitions = toArray24(domainStats?.behavior?.hourlyMaxFeedItemTransitions).map((value) => Math.max(0, Math.floor(value)))
    const hourlyFrictionShown = toArray24(domainStats?.interventions?.hourlyFrictionShown).map((value) => Math.max(0, Math.floor(value)))
    const hourlyContinued = toArray24(domainStats?.interventions?.hourlyContinued).map((value) => Math.max(0, Math.floor(value)))
    const hourlyLeft = toArray24(domainStats?.interventions?.hourlyLeft).map((value) => Math.max(0, Math.floor(value)))
    const hourlyReenteredWithin5m = toArray24(domainStats?.interventions?.hourlyReenteredWithin5m).map((value) => Math.max(0, Math.floor(value)))
    const hourlyReenteredWithin30m = toArray24(domainStats?.interventions?.hourlyReenteredWithin30m).map((value) => Math.max(0, Math.floor(value)))
    const hourlyEscapeClosed = toArray24(domainStats?.interventions?.hourlyEscapeClosed).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationTotal = toArray24(domainStats?.navigation?.hourlyTotal).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationLink = toArray24(domainStats?.navigation?.hourlyLink).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationTyped = toArray24(domainStats?.navigation?.hourlyTyped).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationReload = toArray24(domainStats?.navigation?.hourlyReload).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationGenerated = toArray24(domainStats?.navigation?.hourlyGenerated).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationKeyword = toArray24(domainStats?.navigation?.hourlyKeyword).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationFormSubmit = toArray24(domainStats?.navigation?.hourlyFormSubmit).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationStartPage = toArray24(domainStats?.navigation?.hourlyStartPage).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationAutoBookmark = toArray24(domainStats?.navigation?.hourlyAutoBookmark).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationOther = toArray24(domainStats?.navigation?.hourlyOther).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationAddressBar = toArray24(domainStats?.navigation?.hourlyAddressBar).map((value) => Math.max(0, Math.floor(value)))
    const hourlyNavigationForwardBack = toArray24(domainStats?.navigation?.hourlyForwardBack).map((value) => Math.max(0, Math.floor(value)))
    const activeMs = toNumber(domainStats?.active)
    const backgroundMs = toNumber(domainStats?.background)
    const backgroundMediaMs = toNumber(domainStats?.behavior?.backgroundMediaMs)
    const backgroundLingerMs = toNumber(domainStats?.behavior?.backgroundLingerMs)
    const staleTabMs = toNumber(domainStats?.behavior?.staleTabMs)
    const totalMs = activeMs + backgroundMs
    const sessions = normalizeDomainSessionProjection(domainStats?.sessions)
    const behavior = normalizeDomainBehaviorProjection(domainStats?.behavior)
    const interventions = normalizeDomainInterventionProjection(domainStats?.interventions)
    const navigation = normalizeDomainNavigationProjection(domainStats?.navigation)
    const collectionObservation = buildStatsDomainCollectionObservation(domainStats?.collection, {
      source: `projectStatsDay.domainTotals.${dateStr}.${domain}.collection`,
    })

    domainTotals.push({
      domain,
      categoryId,
      collectionObservation,
      activeMs,
      backgroundMs,
      backgroundOpenMs: backgroundMs,
      backgroundMediaMs,
      backgroundLingerMs,
      staleTabMs,
      totalMs,
      visits: toNumber(domainStats?.visits),
      sessions,
      behavior,
      interventions,
      navigation,
      hourlyActiveMs: hourlyActive,
      hourlyBackgroundMs: hourlyBackground,
      hourlyVisits,
    })

    for (let hour = 0; hour < 24; hour += 1) {
      const hourCategoryId = classifyDomain(domain, policyContext, {
        epochMs: resolveLocalHourEpochMs(dateStr, hour),
      })
      if (!matchesCategoryFilter(hourCategoryId, filter.categories)) {
        continue
      }

      const hourActive = hourlyActive[hour]
      const hourBackground = hourlyBackground[hour]
      const hourBackgroundMediaMs = hourlyBackgroundMediaMs[hour]
      const hourBackgroundLingerMs = hourlyBackgroundLingerMs[hour]
      const hourStaleTabMs = hourlyStaleTabMs[hour]
      const hourTotal = hourActive + hourBackground
      const hourVisits = hourlyVisits[hour]
      const hourSessions = {
        count: hourlySessionCount[hour],
        totalMs: hourlySessionTotalMs[hour],
        shortCount: hourlySessionShortCount[hour],
        longCount: hourlySessionLongCount[hour],
        maxMs: hourlySessionMaxMs[hour],
      }
      const hourBehavior = {
        backgroundMediaMs: hourBackgroundMediaMs,
        backgroundLingerMs: hourBackgroundLingerMs,
        staleTabMs: hourStaleTabMs,
        revisitWithin2m: hourlyRevisitWithin2m[hour],
        revisitWithin5m: hourlyRevisitWithin5m[hour],
        revisitWithin10m: hourlyRevisitWithin10m[hour],
        reentryGapBuckets: STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
          result[key] = hourlyReentryGapBuckets[key][hour]
          return result
        }, {}),
        switchIns: hourlySwitchIns[hour],
        switchOuts: hourlySwitchOuts[hour],
        switchBackWithin10m: hourlySwitchBackWithin10m[hour],
        newTabEntrances: hourlyNewTabEntrances[hour],
        duplicateTabEntrances: hourlyDuplicateTabEntrances[hour],
        highOpenTabEntrances: hourlyHighOpenTabEntrances[hour],
        maxSameDomainOpenTabs: hourlyMaxSameDomainOpenTabs[hour],
        maxOpenTabs: hourlyMaxOpenTabs[hour],
        scrollSpikeBursts: hourlyScrollSpikeBursts[hour],
        fastScrollBursts: hourlyFastScrollBursts[hour],
        feedPressureSignals: hourlyFeedPressureSignals[hour],
        feedInterruptSignals: hourlyFeedInterruptSignals[hour],
        feedAdvanceBursts: hourlyFeedAdvanceBursts[hour],
        feedSkimSignals: hourlyFeedSkimSignals[hour],
        shortMediaAttentionSignals: hourlyShortMediaAttentionSignals[hour],
        shortMediaWatchMs: hourlyShortMediaWatchMs[hour],
        maxFeedScreenfuls: hourlyMaxFeedScreenfuls[hour],
        maxFeedItemTransitions: hourlyMaxFeedItemTransitions[hour],
      }
      const hourInterventions = {
        frictionShown: hourlyFrictionShown[hour],
        continued: hourlyContinued[hour],
        left: hourlyLeft[hour],
        reenteredWithin5m: hourlyReenteredWithin5m[hour],
        reenteredWithin30m: hourlyReenteredWithin30m[hour],
        escapeClosed: hourlyEscapeClosed[hour],
      }
      const hourNavigation = {
        total: hourlyNavigationTotal[hour],
        link: hourlyNavigationLink[hour],
        typed: hourlyNavigationTyped[hour],
        reload: hourlyNavigationReload[hour],
        generated: hourlyNavigationGenerated[hour],
        keyword: hourlyNavigationKeyword[hour],
        formSubmit: hourlyNavigationFormSubmit[hour],
        startPage: hourlyNavigationStartPage[hour],
        autoBookmark: hourlyNavigationAutoBookmark[hour],
        other: hourlyNavigationOther[hour],
        addressBar: hourlyNavigationAddressBar[hour],
        forwardBack: hourlyNavigationForwardBack[hour],
      }
      const hasHourSessions = hourSessions.count > 0 || hourSessions.totalMs > 0 || hourSessions.shortCount > 0 || hourSessions.longCount > 0 || hourSessions.maxMs > 0
      const hasHourBehavior = hourBehavior.revisitWithin2m > 0
        || hourBehavior.backgroundMediaMs > 0
        || hourBehavior.backgroundLingerMs > 0
        || hourBehavior.staleTabMs > 0
        || hourBehavior.revisitWithin5m > 0
        || hourBehavior.revisitWithin10m > 0
        || hasReentryGapBucketSignal(hourBehavior.reentryGapBuckets)
        || hourBehavior.switchIns > 0
        || hourBehavior.switchOuts > 0
        || hourBehavior.switchBackWithin10m > 0
        || hourBehavior.newTabEntrances > 0
        || hourBehavior.duplicateTabEntrances > 0
        || hourBehavior.highOpenTabEntrances > 0
        || hourBehavior.maxSameDomainOpenTabs > 0
        || hourBehavior.maxOpenTabs > 0
        || hourBehavior.scrollSpikeBursts > 0
        || hourBehavior.fastScrollBursts > 0
        || hourBehavior.feedPressureSignals > 0
        || hourBehavior.feedInterruptSignals > 0
        || hourBehavior.feedAdvanceBursts > 0
        || hourBehavior.feedSkimSignals > 0
        || hourBehavior.shortMediaAttentionSignals > 0
        || hourBehavior.shortMediaWatchMs > 0
        || hourBehavior.maxFeedScreenfuls > 0
        || hourBehavior.maxFeedItemTransitions > 0
      const hasHourInterventions = hourInterventions.frictionShown > 0
        || hourInterventions.continued > 0
        || hourInterventions.left > 0
        || hourInterventions.reenteredWithin5m > 0
        || hourInterventions.reenteredWithin30m > 0
        || hourInterventions.escapeClosed > 0
      const hasHourNavigation = hourNavigation.total > 0
        || hourNavigation.link > 0
        || hourNavigation.typed > 0
        || hourNavigation.reload > 0
        || hourNavigation.generated > 0
        || hourNavigation.keyword > 0
        || hourNavigation.formSubmit > 0
        || hourNavigation.startPage > 0
        || hourNavigation.autoBookmark > 0
        || hourNavigation.other > 0
        || hourNavigation.addressBar > 0
        || hourNavigation.forwardBack > 0

      if (hourTotal <= 0 && hourVisits <= 0 && !hasHourSessions && !hasHourBehavior && !hasHourInterventions && !hasHourNavigation) {
        continue
      }

      bucketDomainMaps[hour].set(domain, {
        domain,
        categoryId: hourCategoryId,
        collectionObservation,
        activeMs: hourActive,
        backgroundMs: hourBackground,
        backgroundOpenMs: hourBackground,
        backgroundMediaMs: hourBackgroundMediaMs,
        backgroundLingerMs: hourBackgroundLingerMs,
        staleTabMs: hourStaleTabMs,
        totalMs: hourTotal,
        visits: hourVisits,
        sessions: hourSessions,
        behavior: hourBehavior,
        interventions: hourInterventions,
        navigation: hourNavigation,
      })
    }
  })

  domainTotals.sort((left, right) => right.totalMs - left.totalMs)
  return { domainTotals, bucketDomainMaps }
}

export function projectStatsDay({
  statsRange,
  dateStr,
  policyContext = createStatsPolicyContext(),
  filter = {},
} = {}) {
  const normalizedFilter = normalizeStatsProjectionFilter(filter)
  const daySource = getStatsDates(statsRange)?.[dateStr]
  const topN = normalizedFilter.topN
  const hasDomainFilter = Array.isArray(normalizedFilter.domains)
  const hasCategoryFilter = Array.isArray(normalizedFilter.categories) && normalizedFilter.categories.length > 0
  const hasTrackingExclusions = Array.isArray(policyContext?.trackingExcludedUrls)
    && policyContext.trackingExcludedUrls.length > 0
  const canUseRollupTotals = !hasDomainFilter && !hasCategoryFilter && !hasTrackingExclusions
  const rollup = normalizeHourlyRollup(daySource?.hourlyRollup)
  const { domainTotals, bucketDomainMaps } = buildDomainTotals(daySource, policyContext, normalizedFilter, dateStr)

  const hourlyBuckets = Array.from({ length: 24 }, (_, hour) => createBucket(dateStr, hour))

  hourlyBuckets.forEach((bucket, hour) => {
    const domainEntries = Array.from(bucketDomainMaps[hour].values()).sort(
      (left, right) => right.totalMs - left.totalMs
    )

    const domainCategoryTotals = createEmptyProjectionCategoryTotals()
    let domainActiveMs = 0
    let domainBackgroundMs = 0
    let domainBackgroundMediaMs = 0
    let domainBackgroundLingerMs = 0
    let domainStaleTabMs = 0

    domainEntries.forEach((entry) => {
      domainActiveMs += entry.activeMs
      domainBackgroundMs += entry.backgroundMs
      domainBackgroundMediaMs += entry.backgroundMediaMs
      domainBackgroundLingerMs += entry.backgroundLingerMs
      domainStaleTabMs += entry.staleTabMs
      domainCategoryTotals[entry.categoryId].activeMs += entry.activeMs
      domainCategoryTotals[entry.categoryId].backgroundMs += entry.backgroundMs
      domainCategoryTotals[entry.categoryId].backgroundOpenMs += entry.backgroundOpenMs
      domainCategoryTotals[entry.categoryId].backgroundMediaMs += entry.backgroundMediaMs
      domainCategoryTotals[entry.categoryId].backgroundLingerMs += entry.backgroundLingerMs
      domainCategoryTotals[entry.categoryId].staleTabMs += entry.staleTabMs
      domainCategoryTotals[entry.categoryId].totalMs += entry.totalMs
    })

    bucket.domains = domainEntries
    bucket.topDomains = normalizedFilter.includeTopDomains ? domainEntries.slice(0, topN) : []
    bucket.byCategory = domainCategoryTotals

    if (canUseRollupTotals) {
      const rollupValues = getRollupBucketValues(rollup, hour)
      bucket.activeMs = rollupValues.activeMs
      bucket.backgroundMs = rollupValues.backgroundMs
      bucket.backgroundOpenMs = rollupValues.backgroundOpenMs
      bucket.backgroundMediaMs = domainBackgroundMediaMs
      bucket.backgroundLingerMs = domainBackgroundLingerMs
      bucket.staleTabMs = domainStaleTabMs
      bucket.totalMs = rollupValues.totalMs
      bucket.sessions = {
        count: toNumber(rollup?.sessions?.count?.[hour]),
        totalMs: toNumber(rollup?.sessions?.totalMs?.[hour]),
      }
      bucket.switches = {
        toBlocked: toNumber(rollup?.switches?.toBlocked?.[hour]),
        toAllowed: toNumber(rollup?.switches?.toAllowed?.[hour]),
        toUnmanaged: toNumber(rollup?.switches?.toUnmanaged?.[hour]),
        internal: toNumber(rollup?.switches?.internal?.[hour]),
      }
      return
    }

    bucket.activeMs = domainActiveMs
    bucket.backgroundMs = domainBackgroundMs
    bucket.backgroundOpenMs = domainBackgroundMs
    bucket.backgroundMediaMs = domainBackgroundMediaMs
    bucket.backgroundLingerMs = domainBackgroundLingerMs
    bucket.staleTabMs = domainStaleTabMs
    bucket.totalMs = domainActiveMs + domainBackgroundMs
  })

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
    switches: { ...EMPTY_SWITCHES },
  }

  hourlyBuckets.forEach((bucket) => {
    totals.activeMs += bucket.activeMs
    totals.backgroundMs += bucket.backgroundMs
    totals.backgroundOpenMs += bucket.backgroundOpenMs
    totals.backgroundMediaMs += bucket.backgroundMediaMs
    totals.backgroundLingerMs += bucket.backgroundLingerMs
    totals.staleTabMs += bucket.staleTabMs
    totals.totalMs += bucket.totalMs
    addCategoryTotals(totals.byCategory, bucket.byCategory)
  })

  if (canUseRollupTotals) {
    hourlyBuckets.forEach((bucket) => {
      totals.sessions.count += bucket.sessions.count
      totals.sessions.totalMs += bucket.sessions.totalMs
      addSwitchTotals(totals.switches, bucket.switches)
    })
  }

  return {
    dateStr,
    meta: createMeta({
      sessionsState: canUseRollupTotals ? 'exact' : 'unavailable',
      switchesState: canUseRollupTotals ? 'exact' : 'unavailable',
      categoryTimeState: 'exact',
    }),
    totals,
    domainTotals,
    hourlyBuckets,
  }
}
