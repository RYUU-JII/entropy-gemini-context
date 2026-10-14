import { compareDateStr } from '../shared/dateMath.js'

function getStatsDates(statsRange) {
  if (statsRange?.dates && typeof statsRange.dates === 'object') {
    return statsRange.dates
  }

  return statsRange && typeof statsRange === 'object' ? statsRange : {}
}

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : ''
}

function toNumber(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeDays(days, fallback = 7) {
  const numeric = Math.floor(Number(days))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function resolveActivityMode(activity = 'total') {
  if (activity === 'active' || activity === 'background') return activity
  return 'total'
}

function resolveUsageByActivity({ activeMs = 0, backgroundMs = 0, activity = 'total' } = {}) {
  const normalizedActive = Math.max(0, toNumber(activeMs))
  const normalizedBackground = Math.max(0, toNumber(backgroundMs))
  const mode = resolveActivityMode(activity)

  if (mode === 'active') return normalizedActive
  if (mode === 'background') return normalizedBackground
  return normalizedActive + normalizedBackground
}

export function getStatsDateEntries(statsRange) {
  return Object.entries(getStatsDates(statsRange)).sort(([left], [right]) => compareDateStr(left, right))
}

export function getRecentStatsDateEntries(statsRange, { days = 7 } = {}) {
  const span = normalizeDays(days, 7)
  return getStatsDateEntries(statsRange).slice(-span)
}

export function resolveDomainUsageMs(dayStats = null, hostname = '', { activity = 'total' } = {}) {
  const normalizedHostname = normalizeHost(hostname)
  if (!dayStats || typeof dayStats !== 'object' || !normalizedHostname) return 0

  const domainStats = dayStats?.domains?.[normalizedHostname]
  return resolveUsageByActivity({
    activeMs: domainStats?.active,
    backgroundMs: domainStats?.background,
    activity,
  })
}

export function resolveTrackedUsageMs(dayStats = null, { activity = 'total' } = {}) {
  if (!dayStats || typeof dayStats !== 'object') return 0

  return resolveUsageByActivity({
    activeMs: dayStats?.totals?.totalActive,
    backgroundMs: dayStats?.totals?.totalBackground,
    activity,
  })
}

export function buildDomainUsageWindowSummary({
  statsRange = null,
  hostname = '',
  days = 7,
  activity = 'total',
  thresholdMs = 0,
} = {}) {
  const span = normalizeDays(days, 7)
  const entries = getRecentStatsDateEntries(statsRange, { days: span })
  const normalizedThresholdMs = Math.max(0, toNumber(thresholdMs))

  const totalMs = entries.reduce(
    (sum, [, dayStats]) => sum + resolveDomainUsageMs(dayStats, hostname, { activity }),
    0,
  )

  const exceededDays = normalizedThresholdMs > 0
    ? entries.reduce((count, [, dayStats]) => (
      resolveDomainUsageMs(dayStats, hostname, { activity }) > normalizedThresholdMs ? count + 1 : count
    ), 0)
    : 0

  return {
    days: span,
    totalMs,
    averageDailyMs: totalMs > 0 ? totalMs / span : 0,
    exceededDays,
    entries,
  }
}
