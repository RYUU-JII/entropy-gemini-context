import { getLocalDateStr } from '../../../lib/index.js'
import {
    estimateSleepPattern,
    resolveWakeUpHour,
    resolveWakeActivityHour,
    ACTIVE_HOUR_THRESHOLD_MS,
    DEFAULT_WAKE_WINDOW_HOURS,
} from '../../../lib/sleepPattern.js'
import {
    createStatsPolicyContext,
    projectStatsDay,
    projectStatsWindow,
} from '../projection/index.js'
import { listDateStrRange } from '../shared/dateMath.js'
import { calculateDigitalWellnessScore, DAY_MS, DEFAULT_SCORE_WINDOW_DAYS } from './scoringEngine.js'

export { estimateSleepPattern, resolveWakeUpHour, resolveWakeActivityHour }

export function getRecentDateStrs(windowDays, baseTs = Date.now()) {
    const days = Math.max(1, Number(windowDays) || DEFAULT_SCORE_WINDOW_DAYS)
    const dateStrs = []
    for (let offset = 1; offset <= days; offset += 1) {
        dateStrs.push(getLocalDateStr(baseTs - DAY_MS * offset))
    }
    return dateStrs
}

export function sumMs(values) {
    if (!Array.isArray(values)) return 0
    return values.reduce((acc, v) => acc + (Number(v) || 0), 0)
}

export function normalizeSiteLists(blockedUrls, siteLists = {}) {
    return {
        blockedUrls: Array.isArray(blockedUrls)
            ? blockedUrls
            : Array.isArray(siteLists.blockedUrls)
                ? siteLists.blockedUrls
                : [],
        allowedUrls: Array.isArray(siteLists.allowedUrls) ? siteLists.allowedUrls : [],
        trackingExcludedUrls: Array.isArray(siteLists.trackingExcludedUrls) ? siteLists.trackingExcludedUrls : [],
        filteringMode: typeof siteLists.filteringMode === 'string' ? siteLists.filteringMode : 'blocklist',
    }
}

function createProjectionPolicyContext(blockedUrls, options = {}) {
    return createStatsPolicyContext(normalizeSiteLists(blockedUrls, options.siteLists || {}))
}

function resolveHour(value, fallback = null) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return fallback
    return Math.max(0, Math.min(23, Math.floor(numeric)))
}

function resolveWindowProjectionRange(window = {}) {
    const startDateStr = typeof window.startDateStr === 'string' ? window.startDateStr : null
    const endDateStr = typeof window.endDateStr === 'string' ? window.endDateStr : null
    const startHour = resolveHour(window.startHour, null)
    const endHour = resolveHour(window.endHour, null)
    if (!startDateStr || !endDateStr || startHour === null || endHour === null) return null
    if (startHour !== window.startHour || endHour !== window.endHour) return null
    return { startDateStr, endDateStr, startHour, endHour }
}

function buildSiteDetailsFromDomainTotals(domainTotals = []) {
    const siteDetails = {}

    if (Array.isArray(domainTotals)) {
        domainTotals.forEach((entry) => {
            const domain = typeof entry?.domain === 'string' ? entry.domain.trim().toLowerCase() : ''
            if (!domain) return
            siteDetails[domain] = Number(entry?.activeMs) || 0
        })
        return siteDetails
    }

    Object.entries(domainTotals || {}).forEach(([domainRaw, totals]) => {
        const domain = typeof domainRaw === 'string' ? domainRaw.trim().toLowerCase() : ''
        if (!domain) return
        siteDetails[domain] = Number(totals?.activeMs) || 0
    })

    return siteDetails
}

function projectionToDailyArrays(dayProjection) {
    const hourly = dayProjection.hourlyBuckets.map((bucket) => Number(bucket?.activeMs) || 0)
    const hourlyBlocked = dayProjection.hourlyBuckets.map((bucket) => Number(bucket?.byCategory?.blocked?.activeMs) || 0)
    const hourlyUnmanaged = dayProjection.hourlyBuckets.map((bucket) => Number(bucket?.byCategory?.other?.activeMs) || 0)

    return {
        hourly,
        hourlyBlocked,
        hourlyUnmanaged,
        hourlySessions: dayProjection.hourlyBuckets.map((bucket) => Number(bucket?.sessions?.count) || 0),
        hourlySwitches: dayProjection.hourlyBuckets.map((bucket) => {
            const switches = bucket?.switches || {}
            return (
                (Number(switches.toBlocked) || 0) +
                (Number(switches.toAllowed) || 0) +
                (Number(switches.toUnmanaged) || 0) +
                (Number(switches.internal) || 0)
            )
        }),
        totalActive: dayProjection.totals.activeMs,
        blockedActive: dayProjection.totals.byCategory.blocked.activeMs,
        unmanagedActive: dayProjection.totals.byCategory.other.activeMs,
        totalSessions: dayProjection.totals.sessions.count,
        totalSwitches: dayProjection.totals.switches,
    }
}

export function collectWindowSiteDetails(stats, window, options = {}) {
    if (!stats?.dates || !window) return null
    const range = resolveWindowProjectionRange(window)
    if (!range) return null

    const projection = projectStatsWindow({
        statsRange: stats,
        ...range,
        policyContext: createProjectionPolicyContext(options.blockedUrls || [], options),
        filter: {
            includeTopDomains: true,
            topN: 5,
        },
    })

    return buildSiteDetailsFromDomainTotals(projection.domainTotals)
}

export function mergeHourlySeries(prevDay, nextDay) {
    const mergeArray = (key) => [...(prevDay?.[key] || Array(24).fill(0)), ...(nextDay?.[key] || Array(24).fill(0))]

    const total = mergeArray('hourly')
    const blocked = mergeArray('hourlyBlocked')
    const unmanaged = mergeArray('hourlyUnmanaged')
    const sessions = mergeArray('hourlySessions')
    const switches = [...(prevDay?.hourlySwitches || Array(24).fill(null)), ...(nextDay?.hourlySwitches || Array(24).fill(null))]

    return { total, blocked, unmanaged, sessions, switches }
}

export function findLastActiveHour(mergedHourly, startIndex, thresholdMs) {
    if (!Array.isArray(mergedHourly) || mergedHourly.length === 0) return null
    const start = Math.min(Math.max(0, startIndex), mergedHourly.length - 1)
    const threshold = Number.isFinite(thresholdMs) ? thresholdMs : ACTIVE_HOUR_THRESHOLD_MS
    for (let i = start; i >= 0; i--) {
        if (Number(mergedHourly[i]) >= threshold) return i
    }
    return null
}

export function sliceBehavioralWindow(mergedData, endIndex) {
    const startIndex = endIndex - 23
    if (startIndex < 0) return null

    const slice = (arr) => arr.slice(startIndex, endIndex + 1)

    const windowTotal = slice(mergedData.total)
    if (windowTotal.length !== 24) return null

    const windowBlocked = slice(mergedData.blocked)
    const windowUnmanaged = slice(mergedData.unmanaged)
    const windowSessions = slice(mergedData.sessions)
    const windowSwitches = slice(mergedData.switches)

    const totalActive = sumMs(windowTotal)
    const blockedActive = sumMs(windowBlocked)
    const unmanagedActive = sumMs(windowUnmanaged)
    const totalSessions = sumMs(windowSessions)

    const totalSwitches = windowSwitches.reduce((acc, curr) => {
        if (!curr) return acc
        acc.toBlocked += (curr.toBlocked || 0)
        acc.toAllowed += (curr.toAllowed || 0)
        acc.toUnmanaged += (curr.toUnmanaged || 0)
        acc.internal += (curr.internal || 0)
        return acc
    }, { toBlocked: 0, toAllowed: 0, toUnmanaged: 0, internal: 0 })

    return {
        windowTotal,
        windowBlocked,
        windowUnmanaged,
        totalActive,
        blockedActive,
        unmanagedActive,
        totalSessions,
        totalSwitches,
        startIndex,
        endIndex,
    }
}

export function getBehavioralWindow(stats, blockedUrls, options = {}) {
    if (!stats?.dates) return null
    const offsetDays = Math.max(1, Math.floor(Number(options.offsetDays) || 1))
    const baseTs = Number.isFinite(options.baseTs) ? options.baseTs : Date.now()
    const wakeDayTs = baseTs - DAY_MS * (offsetDays - 1)
    const targetDayTs = baseTs - DAY_MS * offsetDays
    const wakeDayStr = getLocalDateStr(wakeDayTs)
    const targetDayStr = getLocalDateStr(targetDayTs)

    const activeThresholdMs = Number.isFinite(options.activeThresholdMs) ? options.activeThresholdMs : ACTIVE_HOUR_THRESHOLD_MS
    const windowDays = Number(options.windowDays) || DEFAULT_SCORE_WINDOW_DAYS
    const policyContext = createProjectionPolicyContext(blockedUrls, options)

    const targetDaily = projectionToDailyArrays(projectStatsDay({
        statsRange: stats,
        dateStr: targetDayStr,
        policyContext,
    }))
    const wakeDaily = projectionToDailyArrays(projectStatsDay({
        statsRange: stats,
        dateStr: wakeDayStr,
        policyContext,
    }))

    const mergedData = mergeHourlySeries(targetDaily, wakeDaily)

    const patternDates = getRecentDateStrs(windowDays, wakeDayTs)
    const patternStats = patternDates.map((dateStr) => {
        const dailyProjection = projectStatsDay({
            statsRange: stats,
            dateStr,
            policyContext,
        })
        return {
            dateStr,
            hourly: dailyProjection.hourlyBuckets.map((bucket) => Number(bucket?.activeMs) || 0),
        }
    })
    const sleepPattern = estimateSleepPattern(patternStats)

    const fallbackWake = resolveWakeUpHour(wakeDaily.hourly, null, activeThresholdMs, DEFAULT_WAKE_WINDOW_HOURS)
    const wakeUpHour = Number.isFinite(sleepPattern?.wakeUpHour) ? sleepPattern.wakeUpHour : fallbackWake
    const wakeUpSource = Number.isFinite(sleepPattern?.wakeUpHour) ? 'pattern' : 'fallback'
    if (wakeUpHour === null) return null

    const requireWakeActivity = options.requireWakeActivity === true
    let wakeActivityHour = resolveWakeActivityHour(
        wakeDaily.hourly,
        wakeUpHour,
        activeThresholdMs,
        options.wakeWindowHours
    )
    if (requireWakeActivity && wakeActivityHour === null && wakeUpSource === 'pattern') {
        wakeActivityHour = wakeUpHour
    }
    if (requireWakeActivity && wakeActivityHour === null) return null
    const effectiveWakeHour = Number.isFinite(wakeActivityHour) ? wakeActivityHour : wakeUpHour

    const searchStart = 24 + effectiveWakeHour - 1
    const lastActiveIndex = findLastActiveHour(mergedData.total, searchStart, activeThresholdMs)
    if (lastActiveIndex === null) return null

    const window = sliceBehavioralWindow(mergedData, lastActiveIndex)
    if (!window) return null

    const resolvedWindow = {
        ...window,
        wakeUpHour: effectiveWakeHour,
        wakeUpSource,
        wakeActivityHour,
        sleepPattern: sleepPattern ? { ...sleepPattern } : null,
        startDateStr: window.startIndex < 24 ? targetDayStr : wakeDayStr,
        startHour: window.startIndex % 24,
        endDateStr: lastActiveIndex < 24 ? targetDayStr : wakeDayStr,
        endHour: lastActiveIndex % 24,
    }
    const projectionRange = resolveWindowProjectionRange(resolvedWindow)
    if (projectionRange) {
        resolvedWindow.startDateStr = projectionRange.startDateStr
        resolvedWindow.endDateStr = projectionRange.endDateStr
        resolvedWindow.startHour = projectionRange.startHour
        resolvedWindow.endHour = projectionRange.endHour
    }
    resolvedWindow.siteDetails = collectWindowSiteDetails(stats, resolvedWindow, {
        blockedUrls,
        siteLists: options.siteLists,
    })

    return resolvedWindow
}

export function calculateYesterdayFocusScore(stats, blockedUrls, options = {}) {
    const windowDays = Number(options.windowDays) || DEFAULT_SCORE_WINDOW_DAYS
    const activeThresholdMs = Number.isFinite(Number(options.activeThresholdMs)) ? Number(options.activeThresholdMs) : ACTIVE_HOUR_THRESHOLD_MS
    const wakeWindowHours = Number.isFinite(Number(options.wakeWindowHours)) ? Number(options.wakeWindowHours) : DEFAULT_WAKE_WINDOW_HOURS

    const requireWakeActivity = options.requireWakeActivity === true
    let window = getBehavioralWindow(stats, blockedUrls, {
        offsetDays: 1,
        windowDays,
        activeThresholdMs,
        wakeWindowHours,
        requireWakeActivity,
        siteLists: options.siteLists,
    })
    if (!window && requireWakeActivity) {
        window = getBehavioralWindow(stats, blockedUrls, {
            offsetDays: 2,
            windowDays,
            activeThresholdMs,
            wakeWindowHours,
            requireWakeActivity,
            siteLists: options.siteLists,
        })
    }
    if (!window) return null

    const goals = options.goals || {}
    const enrichedWindow = {
        ...window,
        hourlyTotal: window.windowTotal,
        hourly: window.windowTotal,
        hourlyBlocked: window.windowBlocked,
        hourlyUnmanaged: window.windowUnmanaged,
    }

    const { score, breakdown } = calculateDigitalWellnessScore(enrichedWindow, goals)

    return {
        score,
        breakdown,
        rawScore: 0,
        baselineScore: null,
        sampleCount: 0,
        dateStr: enrichedWindow.endDateStr,
        startDateStr: enrichedWindow.startDateStr || null,
        endDateStr: enrichedWindow.endDateStr || null,
        window: enrichedWindow,
    }
}

export function calculateCycleStats(stats, blockedUrls, startTime, endTime, options = {}) {
    if (!stats?.dates || !startTime) return null
    const endTs = endTime || Date.now()
    if (endTs < startTime) return null

    const startHour = new Date(startTime).getHours()
    const durationMs = endTs - startTime
    const durationHours = Math.ceil(durationMs / (60 * 60 * 1000))
    const goals = options.goals || {}
    const policyContext = createProjectionPolicyContext(blockedUrls, options)

    const startDateStr = getLocalDateStr(startTime)
    const endDateStr = getLocalDateStr(endTs)
    const dateStrs = listDateStrRange(startDateStr, endDateStr)
    if (!dateStrs.length) return null

    const dayProjections = dateStrs.map((dateStr) => projectStatsDay({
        statsRange: stats,
        dateStr,
        policyContext,
    }))

    const dailyScores = []
    const dailyBreakdowns = []

    for (const dayProjection of dayProjections) {
        const dayMetrics = {
            totalActive: dayProjection.totals.activeMs,
            blockedActive: dayProjection.totals.byCategory.blocked.activeMs,
            unmanagedActive: dayProjection.totals.byCategory.other.activeMs,
            totalSessions: dayProjection.totals.sessions.count,
            totalSwitches: dayProjection.totals.switches,
        }

        const { score, breakdown } = calculateDigitalWellnessScore(dayMetrics, goals)
        dailyScores.push(score)
        dailyBreakdowns.push(breakdown)
    }

    const mergedLength = dateStrs.length * 24
    const endIndex = startHour + durationHours - 1
    const boundedEndIndex = Math.min(endIndex, mergedLength - 1)
    const endHour = new Date(endTs).getHours()

    const windowProjection = projectStatsWindow({
        statsRange: stats,
        startDateStr,
        endDateStr,
        startHour,
        endHour,
        policyContext,
        filter: {
            includeTopDomains: true,
            topN: 5,
        },
    })

    const windowTotal = windowProjection.buckets.map((bucket) => Number(bucket.activeMs) || 0)
    const windowBlocked = windowProjection.buckets.map((bucket) => Number(bucket.byCategory?.blocked?.activeMs) || 0)
    const windowUnmanaged = windowProjection.buckets.map((bucket) => Number(bucket.byCategory?.other?.activeMs) || 0)

    const siteDetails = buildSiteDetailsFromDomainTotals(windowProjection.domainTotals)

    const window = {
        totalActive: windowProjection.totals.activeMs,
        blockedActive: windowProjection.totals.byCategory.blocked.activeMs,
        unmanagedActive: windowProjection.totals.byCategory.other.activeMs,
        totalSessions: windowProjection.totals.sessions.count,
        totalSwitches: windowProjection.totals.switches,
        hourlyTotal: windowTotal,
        hourlyBlocked: windowBlocked,
        hourlyUnmanaged: windowUnmanaged,
        startIndex: startHour,
        endIndex: boundedEndIndex,
        startDateStr,
        endDateStr,
        startHour,
        endHour,
        hourly: windowTotal,
        siteDetails,
    }

    let weightedScoreSum = 0
    let totalWeight = 0
    const weightedBreakdown = { complianceRatio: 0, complianceAbs: 0, pattern: 0, shadow: 0 }

    for (let i = 0; i < dailyScores.length; i++) {
        const score = dailyScores[dailyScores.length - 1 - i]
        const breakdown = dailyBreakdowns[dailyBreakdowns.length - 1 - i]
        const weight = Math.max(0.4, 1.0 - (i * 0.1))

        weightedScoreSum += score * weight
        weightedBreakdown.complianceRatio += breakdown.complianceRatio * weight
        weightedBreakdown.complianceAbs += breakdown.complianceAbs * weight
        weightedBreakdown.pattern += breakdown.pattern * weight
        weightedBreakdown.shadow += breakdown.shadow * weight
        totalWeight += weight
    }

    const score = totalWeight > 0 ? Math.round(weightedScoreSum / totalWeight) : 100
    const breakdown = {
        complianceRatio: totalWeight > 0 ? weightedBreakdown.complianceRatio / totalWeight : 0,
        complianceAbs: totalWeight > 0 ? weightedBreakdown.complianceAbs / totalWeight : 0,
        pattern: totalWeight > 0 ? weightedBreakdown.pattern / totalWeight : 0,
        shadow: totalWeight > 0 ? weightedBreakdown.shadow / totalWeight : 0,
    }

    const { details } = calculateDigitalWellnessScore(window, goals)

    return {
        score,
        breakdown,
        details,
        window,
        startDateStr,
        endDateStr,
    }
}
