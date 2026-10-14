/**
 * Sleep Pattern Estimation Utilities
 * 
 * Analyzes weekly usage data to estimate user's sleep/wake patterns.
 * Used for calculating usage cycles (first activity → last activity before sleep).
 */

// Constants
export const ACTIVE_HOUR_THRESHOLD_MS = 5 * 60 * 1000;
export const DEFAULT_WAKE_WINDOW_HOURS = 3;
export const MIN_SLEEP_GAP_HOURS = 3;
export const MAX_SLEEP_GAP_HOURS = 14;
export const IDLE_HOUR_THRESHOLD_MINUTES = 1;
export const MAX_ADAPTIVE_IDLE_THRESHOLD_MINUTES = 5;
export const ADAPTIVE_IDLE_PERCENTILE = 0.25;
export const ADAPTIVE_IDLE_SCALE = 0.35;

// Circadian rhythm weights: positive = likely sleep time, negative = unlikely
export const CIRCADIAN_WEIGHTS = {
    0: 3, 1: 3, 2: 3, 3: 3, 4: 3, 5: 3,
    6: 1, 7: 1, 8: 1, 9: 1,
    10: -5, 11: -5, 12: -5, 13: -5, 14: -5, 15: -5, 16: -5, 17: -5, 18: -5,
    19: -2, 20: -2, 21: -2, 22: -1, 23: 1,
};

// Helpers
function toMinutesFloat(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n)) return 0;
    return n / 60000;
}

function circularDistance(a, b) {
    const diff = Math.abs(a - b);
    return Math.min(diff, 24 - diff);
}

function clampHour(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return ((Math.floor(numeric) % 24) + 24) % 24;
}

function percentile(sortedValues, ratio) {
    if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
    const normalizedRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    const index = Math.min(
        sortedValues.length - 1,
        Math.max(0, Math.floor((sortedValues.length - 1) * normalizedRatio))
    );
    return sortedValues[index];
}

function resolveIdleThresholdMinutes(dailyStats, options = {}) {
    if (Number.isFinite(options.idleThresholdMinutes)) {
        return Math.max(0, options.idleThresholdMinutes);
    }

    const positiveMinutes = [];
    (Array.isArray(dailyStats) ? dailyStats : []).forEach((day) => {
        const hourly = Array.isArray(day?.hourly) ? day.hourly : [];
        hourly.forEach((ms) => {
            const minutes = toMinutesFloat(ms);
            if (minutes > 0) positiveMinutes.push(minutes);
        });
    });

    if (positiveMinutes.length < 6) return IDLE_HOUR_THRESHOLD_MINUTES;

    positiveMinutes.sort((a, b) => a - b);
    const lowActivityMinutes = percentile(positiveMinutes, ADAPTIVE_IDLE_PERCENTILE);
    if (!Number.isFinite(lowActivityMinutes) || lowActivityMinutes <= 0) {
        return IDLE_HOUR_THRESHOLD_MINUTES;
    }

    return Math.max(
        IDLE_HOUR_THRESHOLD_MINUTES,
        Math.min(MAX_ADAPTIVE_IDLE_THRESHOLD_MINUTES, lowActivityMinutes * ADAPTIVE_IDLE_SCALE)
    );
}

function scoreSleepGap({
    idleHours,
    lengthHours,
    wakeUpHour,
    hourlyMinutes,
    weights,
    crossesMidnight = false,
}) {
    const circadianScore = idleHours.reduce((sum, hour) => sum + (Number(weights[hour]) || 0), 0);
    const wakeActivityScore = Math.min(3, Math.max(0, Number(hourlyMinutes[wakeUpHour]) || 0) / 10);
    const midnightBonus = crossesMidnight ? 1.25 : 0;
    return circadianScore + lengthHours + wakeActivityScore + midnightBonus;
}

function createSleepCandidate({
    startHour,
    lengthHours,
    wakeUpHour,
    hourlyMinutes,
    weights,
    dateStr,
    crossesMidnight = false,
}) {
    const idleHours = Array.from({ length: lengthHours }, (_, index) => (startHour + index) % 24);
    return {
        startHour,
        lengthHours,
        wakeUpHour,
        crossesMidnight,
        finalScore: scoreSleepGap({
            idleHours,
            lengthHours,
            wakeUpHour,
            hourlyMinutes,
            weights,
            crossesMidnight,
        }),
        dateStr,
    };
}

function dedupeCandidates(candidates) {
    const byWakeHour = new Map();
    candidates.forEach((candidate) => {
        const existing = byWakeHour.get(candidate.wakeUpHour);
        if (!existing || candidate.finalScore > existing.finalScore) {
            byWakeHour.set(candidate.wakeUpHour, candidate);
        }
    });
    return Array.from(byWakeHour.values());
}

function collectLinearSleepCandidates({
    hourlyMinutes,
    idleThresholdMinutes,
    minGapHours,
    maxGapHours,
    weights,
    dateStr,
}) {
    const candidates = [];
    let current = null;

    for (let h = 0; h < 24; h++) {
        const isIdle = hourlyMinutes[h] < idleThresholdMinutes;
        if (isIdle) {
            if (!current) {
                current = { startHour: h, lengthHours: 0 };
            }
            current.lengthHours += 1;
        } else if (current) {
            if (current.lengthHours >= minGapHours && current.lengthHours <= maxGapHours) {
                candidates.push(createSleepCandidate({
                    startHour: current.startHour,
                    lengthHours: current.lengthHours,
                    wakeUpHour: h,
                    hourlyMinutes,
                    weights,
                    dateStr,
                }));
            }
            current = null;
        }
    }

    return candidates;
}

function collectCircularSleepCandidates({
    hourlyMinutes,
    idleThresholdMinutes,
    minGapHours,
    maxGapHours,
    weights,
    dateStr,
}) {
    const candidates = [];
    const isIdleHour = (hour) => hourlyMinutes[clampHour(hour)] < idleThresholdMinutes;

    for (let wakeUpHour = 0; wakeUpHour < 24; wakeUpHour++) {
        if (isIdleHour(wakeUpHour) || !isIdleHour(wakeUpHour - 1)) continue;

        let lengthHours = 0;
        let cursor = wakeUpHour - 1;
        while (lengthHours < 24 && isIdleHour(cursor)) {
            lengthHours += 1;
            cursor -= 1;
        }

        if (lengthHours < minGapHours || lengthHours > maxGapHours) continue;

        const startHour = clampHour(wakeUpHour - lengthHours);
        const crossesMidnight = startHour > wakeUpHour;
        if (!crossesMidnight) continue;

        candidates.push(createSleepCandidate({
            startHour,
            lengthHours,
            wakeUpHour,
            hourlyMinutes,
            weights,
            dateStr,
            crossesMidnight,
        }));
    }

    return candidates;
}

function computeReliability({
    dailyStats,
    candidates,
    validCandidates,
    meanWakeDistance,
}) {
    const totalDays = Math.max(1, Array.isArray(dailyStats) ? dailyStats.length : 0);
    const coverageRatio = validCandidates.length / totalDays;
    const agreementRatio = candidates.length > 0 ? validCandidates.length / candidates.length : 0;

    if (coverageRatio >= 0.5 && agreementRatio >= 0.65 && meanWakeDistance <= 1.25) {
        return { reliability: 'HIGH', coverageRatio, agreementRatio };
    }
    if (coverageRatio >= 0.34 && agreementRatio >= 0.5 && meanWakeDistance <= 2) {
        return { reliability: 'MEDIUM', coverageRatio, agreementRatio };
    }
    return { reliability: 'LOW', coverageRatio, agreementRatio };
}

export function findFirstActiveHour(hourly, thresholdMs) {
    if (!Array.isArray(hourly)) return null;
    const threshold = Number.isFinite(thresholdMs) ? thresholdMs : ACTIVE_HOUR_THRESHOLD_MS;
    for (let h = 0; h < 24; h++) {
        if (Number(hourly[h]) >= threshold) return h;
    }
    return null;
}

export function findFirstActiveHourAfter(hourly, startHour, thresholdMs) {
    if (!Array.isArray(hourly)) return null;
    const threshold = Number.isFinite(thresholdMs) ? thresholdMs : ACTIVE_HOUR_THRESHOLD_MS;
    const start = Number.isFinite(startHour) ? Math.max(0, Math.min(23, startHour)) : 0;
    for (let h = start; h < 24; h++) {
        if (Number(hourly[h]) >= threshold) return h;
    }
    return null;
}

export function findFirstActiveHourInWindow(hourly, startHour, endHour, thresholdMs) {
    if (!Array.isArray(hourly)) return null;
    const threshold = Number.isFinite(thresholdMs) ? thresholdMs : ACTIVE_HOUR_THRESHOLD_MS;
    const start = Number.isFinite(startHour) ? Math.max(0, Math.min(23, startHour)) : 0;
    const end = Number.isFinite(endHour) ? Math.max(0, Math.min(23, endHour)) : 23;
    if (end < start) return null;
    for (let h = start; h <= end; h++) {
        if (Number(hourly[h]) >= threshold) return h;
    }
    return null;
}

/**
 * Resolve wake-up hour based on activity data and optional average.
 */
export function resolveWakeUpHour(hourly, averageWakeHour, thresholdMs, windowHours) {
    const firstActive = findFirstActiveHour(hourly, thresholdMs);
    if (firstActive === null) return null;
    if (!Number.isFinite(averageWakeHour)) return firstActive;

    const window = Number.isFinite(windowHours) ? Math.max(0, windowHours) : DEFAULT_WAKE_WINDOW_HOURS;
    const start = Math.max(0, Math.floor(averageWakeHour - window));
    const end = Math.min(23, Math.ceil(averageWakeHour + window));
    for (let h = start; h <= end; h++) {
        if (Number(hourly[h]) >= (Number.isFinite(thresholdMs) ? thresholdMs : ACTIVE_HOUR_THRESHOLD_MS)) return h;
    }

    return firstActive;
}

/**
 * Find the first meaningful activity hour after wake-up.
 */
export function resolveWakeActivityHour(hourly, wakeUpHour, thresholdMs, windowHours) {
    if (!Array.isArray(hourly)) return null;
    const threshold = Number.isFinite(thresholdMs) ? thresholdMs : ACTIVE_HOUR_THRESHOLD_MS;
    if (Number.isFinite(wakeUpHour)) {
        const window = Number.isFinite(windowHours) ? Math.max(0, windowHours) : DEFAULT_WAKE_WINDOW_HOURS;
        const start = Math.max(0, Math.floor(wakeUpHour));
        const end = Math.min(23, Math.ceil(wakeUpHour + window));
        const relaxed = findFirstActiveHourInWindow(hourly, start, end, 1);
        if (Number.isFinite(relaxed)) return relaxed;
    }
    return findFirstActiveHourAfter(hourly, wakeUpHour, threshold);
}

/**
 * Estimate user's sleep pattern from multiple days of hourly activity data.
 * @param {Array} dailyStats - Array of { dateStr, hourly: number[24] }
 * @param {Object} options - { minGapHours, maxGapHours, idleThresholdMinutes, circadianWeights }
 * @returns {{ wakeUpHour, bedTimeHour, reliability, candidateCount, validCount, meanWakeDistance, idleThresholdMinutes } | null}
 */
export function estimateSleepPattern(dailyStats, options = {}) {
    if (!Array.isArray(dailyStats) || dailyStats.length === 0) return null;

    const minGapHours = Number.isFinite(options.minGapHours)
        ? Math.max(1, Math.floor(options.minGapHours))
        : MIN_SLEEP_GAP_HOURS;
    const maxGapHours = Number.isFinite(options.maxGapHours)
        ? Math.max(minGapHours, Math.floor(options.maxGapHours))
        : MAX_SLEEP_GAP_HOURS;
    const idleThresholdMinutes = resolveIdleThresholdMinutes(dailyStats, options);
    const weights = options.circadianWeights || CIRCADIAN_WEIGHTS;

    const candidates = [];

    dailyStats.forEach((day) => {
        const hourly = Array.isArray(day?.hourly) ? day.hourly : null;
        if (!hourly || hourly.length < 24) return;

        const hourlyMinutes = hourly.map((ms) => toMinutesFloat(ms));
        const dayCandidates = dedupeCandidates([
            ...collectLinearSleepCandidates({
                hourlyMinutes,
                idleThresholdMinutes,
                minGapHours,
                maxGapHours,
                weights,
                dateStr: day.dateStr,
            }),
            ...collectCircularSleepCandidates({
                hourlyMinutes,
                idleThresholdMinutes,
                minGapHours,
                maxGapHours,
                weights,
                dateStr: day.dateStr,
            }),
        ]);

        if (dayCandidates.length > 0) {
            dayCandidates.sort((a, b) => b.finalScore - a.finalScore);
            candidates.push(dayCandidates[0]);
        }
    });

    if (candidates.length === 0) return null;

    const wakeUpFrequency = new Map();
    const addWeight = (hour, weight) => {
        wakeUpFrequency.set(hour, (wakeUpFrequency.get(hour) || 0) + weight);
    };

    candidates.forEach((candidate) => {
        const hour = candidate.wakeUpHour;
        addWeight(hour, 1);
        addWeight((hour + 23) % 24, 0.5);
        addWeight((hour + 1) % 24, 0.5);
    });

    let bestWakeHour = null;
    let bestScore = -Infinity;
    for (const [hour, score] of wakeUpFrequency.entries()) {
        if (score > bestScore) {
            bestScore = score;
            bestWakeHour = Number(hour);
        }
    }

    if (!Number.isFinite(bestWakeHour)) return null;

    const validCandidates = candidates.filter(
        (candidate) => circularDistance(candidate.wakeUpHour, bestWakeHour) <= 2
    );
    const usableCandidates = validCandidates.length > 0 ? validCandidates : candidates;
    const wakeDistances = candidates.map(
        (candidate) => circularDistance(candidate.wakeUpHour, bestWakeHour)
    );
    const meanWakeDistance = wakeDistances.length > 0
        ? wakeDistances.reduce((sum, distance) => sum + distance, 0) / wakeDistances.length
        : 24;
    const avgDuration =
        usableCandidates.reduce((sum, candidate) => sum + candidate.lengthHours, 0) /
        usableCandidates.length;
    const bedTimeHour = (bestWakeHour - Math.round(avgDuration) + 24) % 24;

    const { reliability, coverageRatio, agreementRatio } = computeReliability({
        dailyStats,
        candidates,
        validCandidates: usableCandidates,
        meanWakeDistance,
    });

    return {
        wakeUpHour: bestWakeHour,
        bedTimeHour,
        reliability,
        candidateCount: candidates.length,
        validCount: validCandidates.length,
        coverageRatio,
        agreementRatio,
        meanWakeDistance,
        idleThresholdMinutes,
    };
}

// [NEW] Virtual Day Helpers

/**
 * Get the boundary hour (0-23) for the start of a virtual day.
 * Default is 3 hours before habitual wake time.
 */
export function getCycleBoundary(wakeHour) {
    const wake = Number.isFinite(wakeHour) ? wakeHour : 7; // Default 7 AM
    return (wake - 3 + 24) % 24;
}

/**
 * Get the virtual day string (YYYY-MM-DD) for a given timestamp.
 * A virtual day starts at `getCycleBoundary(wakeHour)`.
 */
export function getVirtualDay(ts, wakeHour) {
    const date = new Date(ts);
    const hour = date.getHours();
    const boundary = getCycleBoundary(wakeHour);

    // If current hour is before the boundary, it belongs to the previous calendar day
    if (hour < boundary) {
        date.setDate(date.getDate() - 1);
    }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Get the virtual day string using a direct boundary hour.
 * Used for Fixed Mode (e.g., rollover at 4 AM -> boundary = 4).
 */
export function getVirtualDayByBoundary(ts, boundaryHour) {
    const date = new Date(ts);
    const hour = date.getHours();

    // If current hour is before the boundary, it belongs to the previous calendar day
    if (hour < boundaryHour) {
        date.setDate(date.getDate() - 1);
    }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
