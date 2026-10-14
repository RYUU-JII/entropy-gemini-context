import {
  PERSONAL_BASELINE_ROLES,
  PERSONAL_BASELINE_STATUSES,
} from '../../../../../lib/personalBaselineContract.js';
import {
  deriveWeeklyObservationSummary,
  requireWeeklyObservationState,
} from '../../../../../domains/stats/insights/contracts/weeklyObservationContract.js';
import { USAGE_BAND_STATUSES } from '@/themes/core/widgets/shared/sites/index.js';

const HOURS_PER_DAY = 24;
const WEEK_DAYS = 7;

// Site Intel Zone B renders one chart over a trailing window instead of the old
// 7-bar weekly strip. 14 days is the widest window that still keeps one bar
// legible at the narrow end of the detail pane track.
const TRAILING_DAY_WINDOW = 14;

// The canonical daily-usage metric published on the personal baseline. The band
// (p25-p75) and the median line are read from this metric only.
const BASELINE_ACTIVE_MS_METRIC_ID = 'active_ms';


function toNonNegativeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export function formatDateYmd(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function subtractDays(dateLike, days) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() - (Number.isFinite(days) ? days : 0));
  return date;
}

function normalize24hSeries(values) {
  return Array.from({ length: HOURS_PER_DAY }, (_, hour) => toNonNegativeNumber(values?.[hour]));
}

function normalizeWeeklySeries(series, weeklyFallbackLabels) {
  if (Array.isArray(series) && series.length > 0) {
    return series.map((entry, index) => {
      const observed = requireWeeklyObservationState(entry, index, {
        source: 'TargetPanelViewModel.weeklySeries',
      });
      return {
        ...entry,
        activeMs: toNonNegativeNumber(entry?.activeMs),
        overLimit: Boolean(entry?.overLimit),
        observed,
        dateStr: entry?.dateStr || '',
        label: entry?.label || '',
      };
    });
  }

  const today = new Date();
  return Array.from({ length: WEEK_DAYS }, (_, index) => {
    const dateObj = subtractDays(today, WEEK_DAYS - 1 - index);
    const weekdayIndex = dateObj.getDay();
    return {
      label: weeklyFallbackLabels?.[weekdayIndex] || '',
      activeMs: 0,
      overLimit: false,
      observed: false,
      dateStr: formatDateYmd(dateObj),
    };
  });
}

export function computePeakIndex(values = []) {
  return values.reduce(
    (best, value, index) => (value > best.value ? { index, value } : best),
    { index: null, value: 0 },
    ).index;
}

function computeDominantWindow(values = [], windowSize = 3) {
  const safeValues = Array.isArray(values) ? values.map((value) => toNonNegativeNumber(value)) : [];
  if (!safeValues.some((value) => value > 0)) return null;

  const safeWindowSize = Math.max(1, Math.min(safeValues.length, Math.floor(windowSize) || 1));
  let bestStart = 0;
  let bestTotal = -1;

  for (let index = 0; index <= safeValues.length - safeWindowSize; index += 1) {
    const total = safeValues.slice(index, index + safeWindowSize).reduce((acc, value) => acc + value, 0);
    if (total > bestTotal) {
      bestStart = index;
      bestTotal = total;
    }
  }

  return {
    startHour: bestStart,
    endHour: bestStart + safeWindowSize,
    totalMs: Math.max(0, bestTotal),
  };
}

function requireRecentTrajectorySummary(featureSummary) {
  if (featureSummary === null || typeof featureSummary === 'undefined') return null;
  if (typeof featureSummary !== 'object' || Array.isArray(featureSummary)) {
    throw new Error('TARGET_PANEL_FEATURE_SUMMARY_INVALID');
  }
  const role = featureSummary.trendRole;
  if (role === null || typeof role === 'undefined') {
    if (featureSummary.hasTrendComparison !== false) {
      throw new Error('TARGET_PANEL_RECENT_TRAJECTORY_ROLE_MISSING');
    }
    return null;
  }
  if (role !== PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY) {
    throw new Error(`TARGET_PANEL_RECENT_TRAJECTORY_ROLE_INVALID:${role}`);
  }
  if (typeof featureSummary.hasTrendComparison !== 'boolean') {
    throw new Error('TARGET_PANEL_RECENT_TRAJECTORY_COMPARISON_STATE_INVALID');
  }
  if (typeof featureSummary.trendRatio !== 'number'
    || !Number.isFinite(featureSummary.trendRatio)
    || featureSummary.trendRatio < 0) {
    throw new Error('TARGET_PANEL_RECENT_TRAJECTORY_RATIO_INVALID');
  }
  if (!['up', 'down', 'flat'].includes(featureSummary.trendDirection)) {
    throw new Error('TARGET_PANEL_RECENT_TRAJECTORY_DIRECTION_INVALID');
  }
  if (typeof featureSummary.weeklyAverageMs !== 'number'
    || !Number.isFinite(featureSummary.weeklyAverageMs)
    || featureSummary.weeklyAverageMs < 0) {
    throw new Error('TARGET_PANEL_RECENT_TRAJECTORY_WEEKLY_AVERAGE_INVALID');
  }
  if (featureSummary.hasTrendComparison === false && featureSummary.trendDirection !== 'flat') {
    throw new Error('TARGET_PANEL_RECENT_TRAJECTORY_DIRECTION_RELATION_INVALID');
  }
  return featureSummary;
}

function requireCanonicalWeeklySummary(intel, field, expected, { integer = false } = {}) {
  if (!Object.hasOwn(intel, field)) {
    throw new Error(`TARGET_PANEL_WEEKLY_SUMMARY_MISSING:${field}`);
  }
  const value = intel[field];
  if (typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
    || (integer && !Number.isInteger(value))) {
    throw new Error(`TARGET_PANEL_WEEKLY_SUMMARY_INVALID:${field}`);
  }
  if (value !== expected) {
    throw new Error(`TARGET_PANEL_WEEKLY_SUMMARY_RELATION_INVALID:${field}`);
  }
  return value;
}

export function computeHabitScore({
  activeDays,
  observedDayCount,
  weeklyTotal,
  streakDays,
  recentTrajectorySummary = null,
}) {
  const freqScore = observedDayCount > 0
    ? (activeDays / observedDayCount) * 30
    : 0;
  const intensityScore = Math.min(30, (weeklyTotal / (14 * 3600000)) * 30);
  const streakBonus = Math.min(15, streakDays * 3);
  const trendScore = recentTrajectorySummary?.hasTrendComparison === true
    && recentTrajectorySummary.trendDirection === 'up'
    ? Math.min(25, Math.max(0, recentTrajectorySummary.trendRatio - 1) * 25)
    : 0;

  return Math.round(freqScore + intensityScore + streakBonus + trendScore);
}

function readBaselineStatMs(stats, field) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null;
  if (!Object.hasOwn(stats, field)) return null;
  const value = stats[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function createUsageBaselineBand(status, {
  isProvisional = false,
  p25Ms = null,
  medianMs = null,
  p75Ms = null,
  observedDays = 0,
  diagnostic = null,
} = {}) {
  return {
    status,
    isProvisional,
    p25Ms,
    medianMs,
    p75Ms,
    observedDays,
    diagnostic,
  };
}

/**
 * Zone B compares each observed day against the site's own published baseline.
 * The three reference lines (p25-p75 band, median, goal) are what turn the bars
 * from an unreadable "always full" strip into a judgeable chart.
 *
 * This builder is total on purpose. The band is optional presentation data that
 * several themes' panels never read, so a malformed payload must not take the
 * whole Sites tab down on its way through the shared view model. Every failure
 * is reported as a status plus a `diagnostic` code the UI names on screen —
 * the "diagnosable failure state" the fallback protocol asks for, as opposed to
 * a silent zero band that would read as a real reference.
 */
export function buildUsageBaselineBand(intel) {
  const personalBaseline = intel?.sitePullProfile?.personalBaseline;
  if (personalBaseline === null || typeof personalBaseline === 'undefined') {
    return createUsageBaselineBand(USAGE_BAND_STATUSES.UNAVAILABLE);
  }
  if (typeof personalBaseline !== 'object' || Array.isArray(personalBaseline)) {
    return createUsageBaselineBand(USAGE_BAND_STATUSES.UNAVAILABLE, {
      diagnostic: 'PERSONAL_BASELINE_INVALID',
    });
  }

  const baselineStatus = personalBaseline.status;
  if (!Object.values(PERSONAL_BASELINE_STATUSES).includes(baselineStatus)) {
    return createUsageBaselineBand(USAGE_BAND_STATUSES.UNAVAILABLE, {
      diagnostic: 'PERSONAL_BASELINE_STATUS_INVALID',
    });
  }

  const metrics = personalBaseline.metrics;
  const hasMetrics = !!metrics && typeof metrics === 'object' && !Array.isArray(metrics);
  const activeMsMetric = hasMetrics ? metrics[BASELINE_ACTIVE_MS_METRIC_ID] : null;
  const hasActiveMsMetric = !!activeMsMetric
    && typeof activeMsMetric === 'object'
    && !Array.isArray(activeMsMetric);
  const observedDays = hasActiveMsMetric
    ? Math.max(0, Math.floor(toNonNegativeNumber(activeMsMetric.sample?.observedCount)))
    : 0;

  // `sparse` is the baseline's own verdict that it cannot yet describe a normal
  // day. Drawing a band from it would invent a reference the model disowns.
  // A baseline that publishes no daily-usage metric is in the same position.
  if (!hasActiveMsMetric || baselineStatus === PERSONAL_BASELINE_STATUSES.SPARSE) {
    return createUsageBaselineBand(USAGE_BAND_STATUSES.FORMING, {
      isProvisional: true,
      observedDays,
    });
  }

  const stats = activeMsMetric.stats;
  const p25Ms = readBaselineStatMs(stats, 'p25DailyMs');
  const medianMs = readBaselineStatMs(stats, 'medianDailyMs');
  const p75Ms = readBaselineStatMs(stats, 'p75DailyMs');
  if (p25Ms === null || medianMs === null || p75Ms === null) {
    return createUsageBaselineBand(USAGE_BAND_STATUSES.UNAVAILABLE, {
      observedDays,
      diagnostic: 'BASELINE_STATS_MISSING',
    });
  }
  if (p25Ms > medianMs || medianMs > p75Ms) {
    return createUsageBaselineBand(USAGE_BAND_STATUSES.UNAVAILABLE, {
      observedDays,
      diagnostic: 'BASELINE_STATS_ORDER_INVALID',
    });
  }
  // A degenerate band (every percentile equal) has no range to read and would
  // draw as a hairline pretending to be a distribution.
  if (p25Ms === p75Ms) {
    return createUsageBaselineBand(USAGE_BAND_STATUSES.FORMING, {
      isProvisional: true,
      observedDays,
    });
  }

  return createUsageBaselineBand(USAGE_BAND_STATUSES.AVAILABLE, {
    isProvisional: baselineStatus === PERSONAL_BASELINE_STATUSES.FORMING,
    p25Ms,
    medianMs,
    p75Ms,
    observedDays,
  });
}

function toTrailingDayEntry(entry, { observed, activeMs }) {
  return {
    dateStr: entry.dateStr,
    label: typeof entry.label === 'string' ? entry.label : '',
    activeMs,
    observed,
    overLimit: Boolean(entry.overLimit),
    isToday: false,
  };
}

// Merges the 30-day baseline window with the 7-day weekly window into one
// ordered trailing series. The weekly projection is the fresher authority for
// the days both windows cover, and it is the only one that carries today.
export function buildTrailingDailySeries(intel, weeklySeries) {
  const byDateStr = new Map();

  const baselineSeries = Array.isArray(intel?.baselineSeries) ? intel.baselineSeries : [];
  baselineSeries.forEach((entry) => {
    if (!entry || typeof entry !== 'object' || typeof entry.dateStr !== 'string') return;
    const observed = entry.observed === true;
    byDateStr.set(entry.dateStr, toTrailingDayEntry(entry, {
      observed,
      activeMs: observed ? toNonNegativeNumber(entry.activeMs) : 0,
    }));
  });

  weeklySeries.forEach((entry) => {
    if (!entry || typeof entry.dateStr !== 'string' || entry.dateStr === '') return;
    byDateStr.set(entry.dateStr, toTrailingDayEntry(entry, {
      observed: entry.observed === true,
      activeMs: toNonNegativeNumber(entry.activeMs),
    }));
  });

  const todayDateStr = typeof intel?.todayDateStr === 'string' ? intel.todayDateStr : '';
  return [...byDateStr.values()]
    .sort((left, right) => left.dateStr.localeCompare(right.dateStr))
    .slice(-TRAILING_DAY_WINDOW)
    .map((entry) => ({
      ...entry,
      isToday: todayDateStr !== '' && entry.dateStr === todayDateStr,
    }));
}

export function buildTargetPanelViewModel({ intel, weeklyFallbackLabels = [] }) {
  const weeklySeries = normalizeWeeklySeries(intel?.weeklySeries, weeklyFallbackLabels);
  const weeklyObservationSummary = deriveWeeklyObservationSummary(weeklySeries, {
    source: 'TargetPanelViewModel.weeklySeries',
  });
  const observedWeeklySeries = weeklyObservationSummary.observedEntries;
  const hasCanonicalWeeklySummary = Array.isArray(intel?.weeklySeries)
    && intel.weeklySeries.length > 0;
  const hasDetachedWeeklySummary = ['weeklyTotal', 'activeDays', 'streakDays', 'overLimitDays']
    .some((field) => intel && Object.hasOwn(intel, field));
  if (hasDetachedWeeklySummary && !hasCanonicalWeeklySummary) {
    throw new Error('TARGET_PANEL_WEEKLY_SERIES_MISSING');
  }

  const dailySeries = normalize24hSeries(intel?.todayHourly);

  const habitSeries = normalize24hSeries(intel?.habitHourly);

  const totalMs = toNonNegativeNumber(intel?.totalMs);
  const todayTotalFromSeries = dailySeries.reduce((acc, value) => acc + value, 0);
  const todayTotal = toNonNegativeNumber(intel?.todayTotal);
  if (intel && (typeof intel.todayTotal !== 'number' || !Number.isFinite(intel.todayTotal)
    || intel.todayTotal < 0 || Math.abs(todayTotal - todayTotalFromSeries) > 1)) {
    throw new Error('TARGET_PANEL_TODAY_USAGE_RELATION_INVALID');
  }

  const weeklyTotal = hasCanonicalWeeklySummary
    ? requireCanonicalWeeklySummary(intel, 'weeklyTotal', weeklyObservationSummary.activeMsTotal)
    : weeklyObservationSummary.activeMsTotal;
  const activeDays = hasCanonicalWeeklySummary
    ? requireCanonicalWeeklySummary(intel, 'activeDays', weeklyObservationSummary.activeDays, {
        integer: true,
      })
    : weeklyObservationSummary.activeDays;
  const streakDays = hasCanonicalWeeklySummary
    ? requireCanonicalWeeklySummary(intel, 'streakDays', weeklyObservationSummary.streakDays, {
        integer: true,
      })
    : weeklyObservationSummary.streakDays;
  const overLimitDays = hasCanonicalWeeklySummary
    ? requireCanonicalWeeklySummary(intel, 'overLimitDays', weeklyObservationSummary.overLimitDays, {
        integer: true,
      })
    : weeklyObservationSummary.overLimitDays;

  const limitMinutes = toNonNegativeNumber(intel?.limitMinutes);
  const limitMs = limitMinutes * 60000;
  const overMs = limitMs > 0 ? Math.max(todayTotal - limitMs, 0) : 0;
  const remainingMs = limitMs > 0 ? Math.max(limitMs - todayTotal, 0) : 0;

  const dailyPeakHour = Number.isFinite(intel?.dailyPeakIndex)
    ? Math.max(0, Math.min(HOURS_PER_DAY - 1, Number(intel.dailyPeakIndex)))
    : computePeakIndex(dailySeries);

  const habitPeakHour = Number.isFinite(intel?.peakIndex)
    ? Math.max(0, Math.min(HOURS_PER_DAY - 1, Number(intel.peakIndex)))
    : computePeakIndex(habitSeries);

  const dailyMax = dailySeries.reduce((acc, value) => Math.max(acc, value), 0);
  const weeklyMax = weeklyObservationSummary.activeMsMax;
  const habitMax = habitSeries.reduce((acc, value) => Math.max(acc, value), 0);
  const featureSummary = intel?.analysis?.featureSummary;
  const recentTrajectorySummary = requireRecentTrajectorySummary(featureSummary);
  const hasTrendComparison = recentTrajectorySummary?.hasTrendComparison === true;
  const trendAuthorityState = recentTrajectorySummary === null
    ? 'absent'
    : hasTrendComparison
      ? 'comparable'
      : 'insufficient';
  const weeklyAverageMs = featureSummary && typeof featureSummary === 'object'
    ? toNonNegativeNumber(featureSummary.weeklyAverageMs)
    : 0;
  const weeklyTrendRatio = hasTrendComparison
    ? recentTrajectorySummary.trendRatio
    : null;
  const weeklyTrendDirection = hasTrendComparison
    ? recentTrajectorySummary.trendDirection
    : null;
  const activeHoursToday = dailySeries.filter((value) => value > 0).length;
  const activeHoursHabit = habitSeries.filter((value) => value > 0).length;
  const dominantTodayWindow = computeDominantWindow(dailySeries, 3);
  const dominantHabitWindow = computeDominantWindow(habitSeries, 3);
  const dominantTodayShare = todayTotal > 0 && dominantTodayWindow
    ? dominantTodayWindow.totalMs / todayTotal
    : 0;
  const dominantHabitShare = weeklyTotal > 0 && dominantHabitWindow
    ? dominantHabitWindow.totalMs / weeklyTotal
    : 0;
  const usageRatio = limitMs > 0 ? todayTotal / limitMs : 0;

  const hasDailyData = todayTotal > 0 || dailySeries.some((value) => value > 0);
  const hasWeeklyData = observedWeeklySeries.some(
    (entry) => toNonNegativeNumber(entry?.activeMs) > 0,
  );
  const hasHabitData = habitSeries.some((value) => value > 0);
  const hasAnyData = hasDailyData || hasWeeklyData || hasHabitData;

  const habitScore = computeHabitScore({
    activeDays,
    observedDayCount: observedWeeklySeries.length,
    weeklyTotal,
    streakDays,
    recentTrajectorySummary,
  });

  const typicalDailyAverageMs = activeDays > 0
    ? Math.round(weeklyTotal / activeDays)
    : observedWeeklySeries.length > 0
      ? Math.round(weeklyTotal / observedWeeklySeries.length)
      : weeklyAverageMs > 0
        ? Math.round(weeklyAverageMs)
        : 0;

  const recurringEvidence = intel?.recurringTimeEvidence?.available
    ? intel.recurringTimeEvidence
    : null;
  const peakStartHour = recurringEvidence != null
    ? Number(recurringEvidence.startHour)
    : dominantHabitWindow?.startHour != null
      ? dominantHabitWindow.startHour
      : habitPeakHour != null
        ? habitPeakHour
        : null;
  const peakEndHour = recurringEvidence != null
    ? ((Number(recurringEvidence.endHourExclusive) % 24) + 24) % 24
    : dominantHabitWindow?.endHour != null
      ? ((Number(dominantHabitWindow.endHour) % 24) + 24) % 24
      : peakStartHour != null
        ? (peakStartHour + 3) % 24
        : null;
  const peakShare = recurringEvidence?.share != null
    ? Number(recurringEvidence.share)
    : dominantHabitShare > 0
      ? dominantHabitShare
      : 0;

  const timeWindowCategory = peakStartHour == null
    ? null
    : (peakStartHour >= 6 && peakStartHour < 12)
      ? 'morning'
      : (peakStartHour >= 12 && peakStartHour < 18)
        ? 'afternoon'
        : (peakStartHour >= 18 && peakStartHour < 22)
          ? 'evening'
          : 'night';

  const timeWindowProfile = {
    startHour: peakStartHour,
    endHour: peakEndHour,
    share: peakShare,
    category: timeWindowCategory,
    hasWindow: hasHabitData || recurringEvidence != null,
  };

  const adherenceDays = weeklySeries.map((entry) => ({
    dateStr: entry.dateStr || '',
    label: entry.label || '',
    activeMs: entry.activeMs || 0,
    overLimit: Boolean(entry.overLimit),
    observed: Boolean(entry.observed),
    isSuccess: Boolean(entry.observed) && !entry.overLimit,
  }));
  const compliantDays = adherenceDays.filter((d) => d.observed && !d.overLimit).length;
  const adherenceTone = overLimitDays >= 4
    ? 'danger'
    : overLimitDays >= 2
      ? 'warning'
      : hasWeeklyData
        ? 'positive'
        : 'neutral';

  const trailingDailySeries = buildTrailingDailySeries(intel, weeklySeries);
  const usageBaselineBand = buildUsageBaselineBand(intel);

  const weeklyAdherence = {
    days: adherenceDays,
    compliantDays,
    overLimitDays,
    observedCount: observedWeeklySeries.length,
    tone: adherenceTone,
  };

  return {
    weekdayLabels: Array.isArray(weeklyFallbackLabels) ? [...weeklyFallbackLabels] : [],
    type: intel?.type || 'unmanaged',
    totalMs,
    limitMinutes,
    limitMs,
    overMs,
    remainingMs,
    todayTotal,
    weeklyTotal,
    typicalDailyAverageMs,
    timeWindowProfile,
    weeklyAdherence,
    activeDays,
    streakDays,
    overLimitDays,
    dailyPeakHour,
    habitPeakHour,
    dailyMax,
    weeklyMax,
    habitMax,
    weeklyAverageMs,
    observedDayCount: observedWeeklySeries.length,
    trendAuthorityState,
    trendRole: recentTrajectorySummary?.trendRole || null,
    hasTrendComparison,
    weeklyTrendRatio,
    weeklyTrendDirection,
    activeHoursToday,
    activeHoursHabit,
    dominantTodayWindow,
    dominantHabitWindow,
    dominantTodayShare,
    dominantHabitShare,
    usageRatio,
    weeklySeries,
    trailingDailySeries,
    usageBaselineBand,
    dailySeries,
    habitSeries,
    hasDailyData,
    hasWeeklyData,
    hasHabitData,
    hasAnyData,
    habitScore,
  };
}
