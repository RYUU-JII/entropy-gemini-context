export function requireSitesGlobalExposureAverage(value) {
  const validDate = (date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  const observedDayCount = Number(value?.observedDayCount);
  const windowDayCount = Number(value?.windowDayCount);
  const averageMs = value?.averageMs;
  const hasValidAverage = averageMs === null
    ? observedDayCount === 0
    : Number.isFinite(Number(averageMs)) && Number(averageMs) >= 0 && observedDayCount > 0;

  if (!value
      || !Number.isInteger(observedDayCount)
      || !Number.isInteger(windowDayCount)
      || observedDayCount < 0
      || windowDayCount <= 0
      || observedDayCount > windowDayCount
      || !validDate(value.windowStartDateStr)
      || !validDate(value.windowEndDateStr)
      || Date.parse(value.windowEndDateStr) - Date.parse(value.windowStartDateStr) !== (windowDayCount - 1) * 86_400_000
      || !Number.isInteger(value.resetHour) || value.resetHour < 0 || value.resetHour > 23
      || !hasValidAverage) {
    throw new Error('SITES_GLOBAL_EXPOSURE_AVERAGE_INVALID');
  }

  return value;
}
