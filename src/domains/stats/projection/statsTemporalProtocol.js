import { DEFAULT_ACTIVITY_DAY_RESET_HOUR } from '../shared/activityDay.js'
import {
  parseLocalDateParts,
  shiftDateStr,
} from '../shared/dateMath.js'

export const STATS_TEMPORAL_PROTOCOL_VERSION = 'stats-temporal-v1'

export const STATS_TEMPORAL_BASIS = Object.freeze({
  CALENDAR: 'calendar',
  ACTIVITY: 'activity',
})

const DAY_GRAINS = new Set(['day', 'week', 'month'])
const SERIES_GRAINS = new Set(['hour', 'day', 'week', 'month'])

function pad2(value) {
  return String(value).padStart(2, '0')
}

export function isStatsResetHourValue(value) {
  if (value === null || typeof value === 'undefined') return false
  if (typeof value === 'string' && value.trim() === '') return false
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 23
}

export function normalizeStatsResetHour(value, fallback = DEFAULT_ACTIVITY_DAY_RESET_HOUR) {
  if (isStatsResetHourValue(value)) {
    return Math.min(23, Math.max(0, Math.floor(Number(value))))
  }
  if (isStatsResetHourValue(fallback)) {
    return Math.min(23, Math.max(0, Math.floor(Number(fallback))))
  }
  return DEFAULT_ACTIVITY_DAY_RESET_HOUR
}

export function normalizeStatsTemporalBasis(value) {
  return value === STATS_TEMPORAL_BASIS.ACTIVITY
    ? STATS_TEMPORAL_BASIS.ACTIVITY
    : STATS_TEMPORAL_BASIS.CALENDAR
}

export function normalizeStatsTemporalGrain(value, {
  fallback = 'day',
  allowHour = false,
} = {}) {
  const source = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const allowed = allowHour ? SERIES_GRAINS : DAY_GRAINS
  if (allowed.has(source)) return source
  return allowed.has(fallback) ? fallback : 'day'
}

export function resolveStatsTemporalResetHour({
  resetHour = null,
  cycleState = null,
  fallback = DEFAULT_ACTIVITY_DAY_RESET_HOUR,
} = {}) {
  if (isStatsResetHourValue(resetHour)) {
    return normalizeStatsResetHour(resetHour, fallback)
  }

  const policyHour = cycleState?.resetPolicy?.effectiveResetHour
  if (isStatsResetHourValue(policyHour)) {
    return normalizeStatsResetHour(policyHour, fallback)
  }

  const directHour = cycleState?.effectiveResetHour
  if (isStatsResetHourValue(directHour)) {
    return normalizeStatsResetHour(directHour, fallback)
  }

  return normalizeStatsResetHour(fallback)
}

export function createStatsTemporalProtocol({
  basis = STATS_TEMPORAL_BASIS.CALENDAR,
  grain = null,
  groupBy = null,
  bucket = null,
  resetHour = null,
  cycleState = null,
  fallbackGrain = 'day',
  allowHour = false,
} = {}) {
  const normalizedBasis = normalizeStatsTemporalBasis(basis)
  const requestedGrain = grain ?? bucket ?? groupBy
  const normalizedGrain = normalizeStatsTemporalGrain(requestedGrain, {
    fallback: fallbackGrain,
    allowHour,
  })
  const normalizedResetHour = normalizedBasis === STATS_TEMPORAL_BASIS.ACTIVITY
    ? resolveStatsTemporalResetHour({ resetHour, cycleState })
    : null

  return {
    version: STATS_TEMPORAL_PROTOCOL_VERSION,
    basis: normalizedBasis,
    grain: normalizedGrain,
    resetHour: normalizedResetHour,
  }
}

export function toStatsTemporalWeekStart(dateStr) {
  const parts = parseLocalDateParts(dateStr)
  if (!parts) return null
  const date = new Date(parts.year, parts.month - 1, parts.day)
  const dayOfWeek = date.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  date.setDate(date.getDate() + mondayOffset)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function toStatsTemporalMonthKey(dateStr) {
  const parts = parseLocalDateParts(dateStr)
  if (!parts) return null
  return `${String(parts.year).padStart(4, '0')}-${pad2(parts.month)}`
}

export function getStatsTemporalGroupKey(dateStr, grain) {
  if (grain === 'week') return toStatsTemporalWeekStart(dateStr)
  if (grain === 'month') return toStatsTemporalMonthKey(dateStr)
  return parseLocalDateParts(dateStr) ? dateStr : null
}

export function createStatsActivityDayWindow(dateStr, resetHour = DEFAULT_ACTIVITY_DAY_RESET_HOUR) {
  const normalizedResetHour = normalizeStatsResetHour(resetHour)
  const startDateStr = parseLocalDateParts(dateStr) ? dateStr : null
  if (!startDateStr) return null
  const endDateStr = normalizedResetHour === 0
    ? startDateStr
    : shiftDateStr(startDateStr, 1)
  if (!endDateStr) return null

  return {
    basis: STATS_TEMPORAL_BASIS.ACTIVITY,
    resetHour: normalizedResetHour,
    activityDateStr: startDateStr,
    startDateStr,
    endDateStr,
    startHour: normalizedResetHour,
    endHour: (normalizedResetHour + 23) % 24,
  }
}
