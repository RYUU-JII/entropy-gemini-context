import { requireSiteIntelTemporalSeries } from '../../../../../domains/stats/contracts/siteIntelTemporalContext.js';

// Explicit display relationships: a shared unit alone cannot license a link.
const HOURLY_LINKS = Object.freeze({
  todayMs: { family: 'active_usage', unit: 'duration_ms', seriesId: 'today_usage' },
  todayTotalMs: { family: 'active_usage', unit: 'duration_ms', seriesId: 'today_usage' },
  todayVisits: { family: 'navigation_entry', unit: 'count', seriesId: 'today_visits' },
});
export function buildSiteIntelHourlyContext(intel, metric = null) {
  const link = metric?.period === 'today' ? HOURLY_LINKS[metric.field] : null;
  const connected = Boolean(link && metric.unit === link.unit
    && metric.provenance.family === link.family && metric.provenance.kind === 'recorded_aggregate');
  const series = requireSiteIntelTemporalSeries(intel.temporalContext, connected ? link.seriesId : 'recent_usage');
  if (connected && (metric.periodRange?.startDateStr !== series.startDate
    || metric.periodRange?.endDateStr !== series.endDate
    || Math.abs(series.values.reduce((sum, value) => sum + value, 0) - metric.numericValue) > .01)) {
    throw new Error('SITE_INTEL_TEMPORAL_EVIDENCE_MISMATCH');
  }
  return projectSeries(series, connected ? 'evidence' : 'context', connected ? metric.id : null);
}

// An explicitly named recorded series is context, not evidence for a claim.
// In particular calendar hours never become activity-day usage or cap charge.
export function buildSiteIntelHourlySeriesContext(intel, seriesId) {
  return projectSeries(requireSiteIntelTemporalSeries(intel.temporalContext, seriesId), 'context', null);
}

function projectSeries(series, relation, evidenceId) {
  const ceiling = Math.max(...series.values);
  return { ...series, relation, evidenceId,
    state: series.availability === 'missing' ? 'missing' : ceiling === 0 ? 'zero' : 'activity', ceiling,
    hours: series.values.map((value, hour) => ({ hour, value, ratio: ceiling > 0 ? value / ceiling : 0 })) };
}
export function formatSiteIntelHourlyValue(value, unit, t) {
  if (unit === 'count') return t('intel_reading.hourly_count', { value });
  return value > 0 && value < 60_000 ? t('target_profile.reading_less_than_minute')
    : t('target_profile.metric_minutes', { value: Math.round(value / 60_000) });
}
