import React from 'react';

function formatDuration(value, t) {
  return value > 0 && value < 60_000
    ? t('target_profile.reading_less_than_minute')
    : t('target_profile.metric_minutes', { value: Math.round(value / 60_000) });
}

// These are snapshot-owned activity-day facts, independent of the selected
// detail's calendar-day interpretation. Never derive one from the other.
export default function SiteObservedUsage({ entry, window, t }) {
  if (!entry || entry.recording.enabled !== true) return null;
  const { usage, usageAverage: average } = entry;
  if (usage?.basis !== 'activity-day-observed'
    || !Number.isFinite(usage.observedMs) || usage.observedMs < 0
    || !average || !['recorded', 'partial', 'collecting'].includes(average.status)
    || !window || window.basis !== 'completed-activity-days-recorded'
    || (average.status === 'collecting' ? average.averageMs !== null
      : !Number.isFinite(average.averageMs) || average.averageMs < 0)) {
    throw new Error('SITES_OBSERVED_USAGE_INVALID');
  }
  return <section className="site-intel__observed" aria-label={t('intel_reading.basic_statistics')}>
    <h4>{t('intel_reading.basic_statistics')}</h4>
    <dl>
      <div>
        <dt>{t('intel_reading.activity_day_usage')}</dt>
        <dd>{formatDuration(usage.observedMs, t)}</dd>
      </div>
      <div>
        <dt>{t('registry.average_basis')}</dt>
        <dd>{average.averageMs === null ? t('registry.collecting') : formatDuration(average.averageMs, t)}</dd>
      </div>
    </dl>
    <p className="site-intel__observed-basis">{t('intel_reading.basic_basis_note')}</p>
    <p className="site-intel__observed-period">{t('registry.average_period', { start: window.windowStartDateStr, end: window.windowEndDateStr, hour: window.resetHour })}
      {' · '}{t('intel_reading.basic_coverage', { count: average.observedDayCount, days: window.observedDayCount })}</p>
  </section>;
}
