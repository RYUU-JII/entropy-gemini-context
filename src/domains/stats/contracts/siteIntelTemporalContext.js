// Query-owned display facts. Never consume interpretation or feed the classifier.
export const SITE_INTEL_TEMPORAL_CONTEXT_VERSION = 'site-intel-temporal-context-v1';
const SERIES = Object.freeze({
  recent_usage: { source: 'habitHourly', period: 'weekly', unit: 'duration_ms' },
  today_usage: { source: 'todayHourly', period: 'today', unit: 'duration_ms' },
  today_visits: { source: 'todayHourlyVisits', period: 'today', unit: 'count' },
});

export function buildSiteIntelTemporalContext(intel) {
  const days = intel.weeklySeries;
  if (!Array.isArray(days) || days.length === 0 || days.some((day, index) =>
    typeof day.observed !== 'boolean' || !/^\d{4}-\d{2}-\d{2}$/.test(day.dateStr)
    || (index > 0 && day.dateStr <= days[index - 1].dateStr))) {
    throw new Error('SITE_INTEL_HOURLY_PERIOD_INVALID');
  }
  if (typeof intel.todayObserved !== 'boolean' || intel.todayDateStr !== days.at(-1).dateStr) {
    throw new Error('SITE_INTEL_HOURLY_TODAY_PERIOD_INVALID');
  }
  const series = Object.fromEntries(Object.entries(SERIES).map(([id, definition]) => {
    const range = definition.period === 'today'
      ? [{ dateStr: intel.todayDateStr, observed: intel.todayObserved }] : days;
    const values = intel[definition.source];
    if (!Array.isArray(values) || values.length !== 24
      || Array.from(values).some(value => !Number.isFinite(value) || value < 0
        || (definition.unit === 'count' && !Number.isInteger(value)))) {
      throw new Error('SITE_INTEL_HOURLY_CONTEXT_INVALID');
    }
    const observedDays = range.filter(day => day.observed).length;
    if (observedDays === 0 && values.some(value => value > 0)) throw new Error('SITE_INTEL_HOURLY_OBSERVATION_MISMATCH');
    return [id, { id, ...definition, basis: 'local-calendar-day-hour',
      bucketMeaning: 'recorded-total-within-clock-hour', coverageMeaning: 'day-has-records-not-continuous-coverage',
      startDate: range[0].dateStr, endDate: range.at(-1).dateStr,
      observedDays, windowDays: range.length, availability: observedDays > 0 ? 'observed' : 'missing',
      values: [...values] }];
  }));
  return { version: SITE_INTEL_TEMPORAL_CONTEXT_VERSION, series };
}

export function requireSiteIntelTemporalSeries(context, id) {
  const definition = SERIES[id];
  const series = context?.series?.[id];
  if (!definition || context?.version !== SITE_INTEL_TEMPORAL_CONTEXT_VERSION || !series
    || series.id !== id || series.source !== definition.source || series.period !== definition.period
    || series.unit !== definition.unit || series.basis !== 'local-calendar-day-hour'
    || series.bucketMeaning !== 'recorded-total-within-clock-hour'
    || series.coverageMeaning !== 'day-has-records-not-continuous-coverage'
    || !/^\d{4}-\d{2}-\d{2}$/.test(series.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(series.endDate)
    || series.startDate > series.endDate || (series.period === 'today' && series.startDate !== series.endDate)
    || !Number.isInteger(series.windowDays) || series.windowDays < 1
    || !Number.isInteger(series.observedDays) || series.observedDays < 0 || series.observedDays > series.windowDays
    || series.availability !== (series.observedDays > 0 ? 'observed' : 'missing')
    || !Array.isArray(series.values) || series.values.length !== 24
    || Array.from(series.values).some(value => !Number.isFinite(value) || value < 0
      || (series.unit === 'count' && !Number.isInteger(value)))
    || (series.availability === 'missing' && series.values.some(value => value > 0))) {
    throw new Error('SITE_INTEL_TEMPORAL_CONTEXT_INVALID');
  }
  return series;
}
