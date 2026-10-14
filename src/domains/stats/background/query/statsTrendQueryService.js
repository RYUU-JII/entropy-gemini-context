import { getLocalDateStr } from '../../../../lib/index.js'
import {
  buildStatsDashboardPolicyFingerprint,
} from '../../analysis/index.js'
import {
  createStatsTemporalProtocol,
  createStatsPolicyContext,
  isStatsResetHourValue,
  projectStatsDomainSeries,
  projectStatsSummary,
  STATS_TEMPORAL_BASIS,
} from '../../projection/index.js'
import {
  compareDateStr,
  parseLocalDateParts,
  shiftDateStr,
} from '../../shared/dateMath.js'
import { resolveStatsDaysBack } from './statsFactsRepositoryReadUtils.js'
import { STATS_RANGE_MAX_DAYS } from '../../contracts/statsContracts.js'
import {
  normalizePolicyOverride,
  readOptionalStatsCycleState,
  readRequiredStatsSettingsSnapshot,
} from './statsAnalysisQueryShared.js'

const DEFAULT_TREND_DAYS_BACK = 30
const DEFAULT_GROUP_BY = 'day'
const DEFAULT_BUCKET = 'day'
const DEFAULT_TOP_N = 8

function createStatsTrendQueryError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function normalizeExplicitTrendDate(value, errorCode) {
  if (value === null || typeof value === 'undefined') return null
  if (typeof value !== 'string') throw createStatsTrendQueryError(errorCode)
  const normalized = value.trim()
  if (!parseLocalDateParts(normalized)) throw createStatsTrendQueryError(errorCode)
  return normalized
}

function countTrendCalendarDaysInclusive(startDateStr, endDateStr) {
  const start = parseLocalDateParts(startDateStr)
  const end = parseLocalDateParts(endDateStr)
  if (!start || !end) return null
  const startEpochDay = Date.UTC(start.year, start.month - 1, start.day)
  const endEpochDay = Date.UTC(end.year, end.month - 1, end.day)
  return Math.floor((endEpochDay - startEpochDay) / 86_400_000) + 1
}

function resolveTrendWindow({
  startDateStr,
  endDateStr,
  daysBack,
  maxDaysStored,
  now = Date.now(),
} = {}) {
  const normalizedMaxDaysStored = resolveStatsDaysBack(maxDaysStored, {
    fallbackDays: STATS_RANGE_MAX_DAYS,
    maxDays: STATS_RANGE_MAX_DAYS,
  })
  const span = resolveStatsDaysBack(daysBack, {
    fallbackDays: DEFAULT_TREND_DAYS_BACK,
    maxDays: normalizedMaxDaysStored,
  })
  const normalizedStart = normalizeExplicitTrendDate(
    startDateStr,
    'STATS_TREND_QUERY_START_DATE_INVALID',
  )
  const normalizedEnd = normalizeExplicitTrendDate(
    endDateStr,
    'STATS_TREND_QUERY_END_DATE_INVALID',
  )

  let windowStart = normalizedStart
  let windowEnd = normalizedEnd

  if (windowStart && !windowEnd) {
    windowEnd = shiftDateStr(windowStart, span - 1)
  } else if (!windowStart && windowEnd) {
    windowStart = shiftDateStr(windowEnd, -(span - 1))
  } else if (!windowStart && !windowEnd) {
    windowEnd = getLocalDateStr(now)
    windowStart = shiftDateStr(windowEnd, -(span - 1))
  }

  if (!windowStart || !windowEnd) {
    throw createStatsTrendQueryError('STATS_TREND_QUERY_RANGE_RESOLUTION_FAILED')
  }

  if (compareDateStr(windowStart, windowEnd) > 0) {
    throw createStatsTrendQueryError('STATS_TREND_QUERY_RANGE_ORDER_INVALID')
  }
  const rangeDays = countTrendCalendarDaysInclusive(windowStart, windowEnd)
  if (!rangeDays || rangeDays > normalizedMaxDaysStored) {
    throw createStatsTrendQueryError('STATS_TREND_QUERY_RANGE_SPAN_EXCEEDED')
  }
  const todayDateStr = getLocalDateStr(now)
  if (compareDateStr(windowEnd, todayDateStr) > 0) {
    throw createStatsTrendQueryError('STATS_TREND_QUERY_RANGE_FUTURE')
  }
  const oldestRetainedDateStr = shiftDateStr(todayDateStr, -(normalizedMaxDaysStored - 1))
  if (!oldestRetainedDateStr || compareDateStr(windowStart, oldestRetainedDateStr) < 0) {
    throw createStatsTrendQueryError('STATS_TREND_QUERY_RANGE_OUT_OF_RETENTION')
  }

  return { startDateStr: windowStart, endDateStr: windowEnd }
}

function resolveFactsDaysBack({
  startDateStr,
  maxDaysStored,
  now = Date.now(),
} = {}) {
  const todayDateStr = getLocalDateStr(now)
  const calendarDays = countTrendCalendarDaysInclusive(startDateStr, todayDateStr)
  if (!calendarDays || calendarDays < 1) {
    return resolveStatsDaysBack(DEFAULT_TREND_DAYS_BACK, {
      fallbackDays: DEFAULT_TREND_DAYS_BACK,
      maxDays: maxDaysStored,
    })
  }

  return resolveStatsDaysBack(calendarDays, {
    fallbackDays: calendarDays,
    maxDays: maxDaysStored,
  })
}

function normalizeGroupBy(groupBy) {
  return groupBy === 'week' || groupBy === 'month' ? groupBy : DEFAULT_GROUP_BY
}

function normalizeBucket(bucket) {
  return bucket === 'hour' || bucket === 'week' || bucket === 'month' ? bucket : DEFAULT_BUCKET
}

function normalizeFilter(filter = {}) {
  const source = filter && typeof filter === 'object' ? filter : {}
  return {
    domains: Array.isArray(source.domains) ? source.domains : undefined,
    categories: Array.isArray(source.categories) ? source.categories : undefined,
    includeTopDomains: source.includeTopDomains !== false,
    topN: Number.isFinite(Number(source.topN)) ? Math.max(1, Math.floor(Number(source.topN))) : DEFAULT_TOP_N,
  }
}

function pickTemporalValue(source, key) {
  if (
    source
    && Object.prototype.hasOwnProperty.call(source, key)
    && source[key] !== null
    && typeof source[key] !== 'undefined'
  ) {
    return source[key]
  }
  if (source?.temporal && Object.prototype.hasOwnProperty.call(source.temporal, key)) {
    return source.temporal[key]
  }
  return null
}

export function createStatsTrendQueryService({
  getStatsFactsRange,
  getSettingsSnapshot,
  getCycleState = null,
  maxDaysStored = STATS_RANGE_MAX_DAYS,
} = {}) {
  if (typeof getStatsFactsRange !== 'function') {
    throw new Error('STATS_TREND_QUERY_FACTS_RANGE_REQUIRED')
  }
  if (typeof getSettingsSnapshot !== 'function') {
    throw new Error('STATS_TREND_QUERY_SETTINGS_REQUIRED')
  }
  const readSettingsSnapshot = () => readRequiredStatsSettingsSnapshot(
    getSettingsSnapshot,
    'STATS_TREND_QUERY_SETTINGS_SNAPSHOT_REQUIRED',
  )

  async function resolveTemporalProtocol(input = {}, {
    now = Date.now(),
    fallbackGrain = DEFAULT_GROUP_BY,
    allowHour = false,
  } = {}) {
    const basis = pickTemporalValue(input, 'basis')
    const resetHour = pickTemporalValue(input, 'resetHour')
    const grain = pickTemporalValue(input, 'grain')
    const protocolBasis = basis === STATS_TEMPORAL_BASIS.ACTIVITY
      ? STATS_TEMPORAL_BASIS.ACTIVITY
      : STATS_TEMPORAL_BASIS.CALENDAR
    const needsCycleResetPolicy = protocolBasis === STATS_TEMPORAL_BASIS.ACTIVITY
      && !isStatsResetHourValue(resetHour)
    if (needsCycleResetPolicy && typeof getCycleState !== 'function') {
      throw createStatsTrendQueryError('STATS_TREND_QUERY_CYCLE_STATE_REQUIRED')
    }
    const cycleState = needsCycleResetPolicy
      ? await readOptionalStatsCycleState(getCycleState, {
          now,
          code: 'STATS_TREND_QUERY_CYCLE_STATE_INVALID',
        })
      : null

    return createStatsTemporalProtocol({
      basis: protocolBasis,
      grain,
      groupBy: input?.groupBy,
      bucket: input?.bucket,
      resetHour,
      cycleState,
      fallbackGrain,
      allowHour,
    })
  }

  async function getTrendSummary({
    startDateStr = null,
    endDateStr = null,
    daysBack = DEFAULT_TREND_DAYS_BACK,
    groupBy = DEFAULT_GROUP_BY,
    grain = null,
    basis = null,
    resetHour = null,
    temporal = null,
    policyInput = null,
    filter = {},
  } = {}) {
    const now = Date.now()
    const window = resolveTrendWindow({
      startDateStr,
      endDateStr,
      daysBack,
      maxDaysStored,
      now,
    })
    const factsDaysBack = resolveFactsDaysBack({
      startDateStr: window.startDateStr,
      maxDaysStored,
      now,
    })
    const [statsRange, settingsSnapshot] = await Promise.all([
      getStatsFactsRange({ daysBack: factsDaysBack }),
      readSettingsSnapshot(),
    ])
    const resolvedPolicyInput = normalizePolicyOverride(policyInput, settingsSnapshot)
    const policyFingerprint = buildStatsDashboardPolicyFingerprint(resolvedPolicyInput)
    const policyContext = createStatsPolicyContext(resolvedPolicyInput)
    const temporalProtocol = await resolveTemporalProtocol({
      groupBy,
      grain,
      basis,
      resetHour,
      temporal,
    }, {
      now,
      fallbackGrain: normalizeGroupBy(groupBy),
      allowHour: false,
    })
    const normalizedGroupBy = normalizeGroupBy(temporalProtocol.grain)
    const trendSummary = projectStatsSummary({
      statsRange,
      startDateStr: window.startDateStr,
      endDateStr: window.endDateStr,
      groupBy: normalizedGroupBy,
      basis: temporalProtocol.basis,
      resetHour: temporalProtocol.resetHour,
      policyContext,
      filter: normalizeFilter(filter),
    })

    return {
      policyBasis: 'current',
      policyFingerprint,
      computedAtEpochMs: now,
      available: Number(trendSummary?.totals?.totalMs) > 0 || Number(trendSummary?.totals?.sessions?.count) > 0,
      startDateStr: window.startDateStr,
      endDateStr: window.endDateStr,
      groupBy: normalizedGroupBy,
      grain: normalizedGroupBy,
      basis: temporalProtocol.basis,
      resetHour: temporalProtocol.resetHour,
      temporal: temporalProtocol,
      trendSummary,
    }
  }

  async function getDomainSeries({
    domain,
    startDateStr = null,
    endDateStr = null,
    daysBack = DEFAULT_TREND_DAYS_BACK,
    bucket = DEFAULT_BUCKET,
    grain = null,
    basis = null,
    resetHour = null,
    temporal = null,
    policyInput = null,
  } = {}) {
    const now = Date.now()
    const window = resolveTrendWindow({
      startDateStr,
      endDateStr,
      daysBack,
      maxDaysStored,
      now,
    })
    const factsDaysBack = resolveFactsDaysBack({
      startDateStr: window.startDateStr,
      maxDaysStored,
      now,
    })
    const [statsRange, settingsSnapshot] = await Promise.all([
      getStatsFactsRange({ daysBack: factsDaysBack }),
      readSettingsSnapshot(),
    ])
    const resolvedPolicyInput = normalizePolicyOverride(policyInput, settingsSnapshot)
    const policyFingerprint = buildStatsDashboardPolicyFingerprint(resolvedPolicyInput)
    const policyContext = createStatsPolicyContext(resolvedPolicyInput)
    const temporalProtocol = await resolveTemporalProtocol({
      bucket,
      grain,
      basis,
      resetHour,
      temporal,
    }, {
      now,
      fallbackGrain: normalizeBucket(bucket),
      allowHour: true,
    })
    const normalizedBucket = normalizeBucket(temporalProtocol.grain)
    const domainSeries = projectStatsDomainSeries({
      statsRange,
      domain,
      startDateStr: window.startDateStr,
      endDateStr: window.endDateStr,
      bucket: normalizedBucket,
      basis: temporalProtocol.basis,
      resetHour: temporalProtocol.resetHour,
      policyContext,
    })

    return {
      policyBasis: 'current',
      policyFingerprint,
      computedAtEpochMs: now,
      available: Number(domainSeries?.totals?.totalMs) > 0 || Number(domainSeries?.totals?.visits) > 0,
      startDateStr: window.startDateStr,
      endDateStr: window.endDateStr,
      bucket: normalizedBucket,
      grain: normalizedBucket,
      basis: temporalProtocol.basis,
      resetHour: temporalProtocol.resetHour,
      temporal: temporalProtocol,
      domainSeries,
    }
  }

  return {
    getTrendSummary,
    getDomainSeries,
  }
}
