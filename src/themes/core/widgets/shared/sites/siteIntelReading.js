const formatShortDate = (str) => (typeof str === 'string' ? str.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, '$1.$2') : str);

// Formatting only: the domain owns fields, periods, order and public claims.
export function formatSiteIntelReadingMetric(metric, t, period = null) {
  if (metric.status !== 'observed') return null;
  let value;
  if (metric.unit === 'duration_ms') {
    value = metric.value > 0 && metric.value < 60_000
      ? t('target_profile.reading_less_than_minute', {})
      : t('target_profile.metric_minutes', { value: Math.round(metric.value / 60_000) });
  } else if (metric.unit === 'count') {
    value = String(Math.round(metric.value * 10) / 10);
  } else if (metric.unit === 'days') {
    value = t('target_profile.metric_days', { value: metric.value });
  } else {
    throw new Error('SITE_INTEL_READING_UNIT_INVALID');
  }
  const periodLabel = t(`target_profile.reading_period_${metric.period}`, {});
  const label = t(metric.labelKey, {});
  return {
    id: metric.id, label, name: label, value,
    numericValue: metric.value, unit: metric.unit, field: metric.field,
    period: metric.period, periodRange: period, provenance: metric.provenance,
    scopedLabel: t('target_profile.reading_scoped_label', { label, period: periodLabel }),
    periodLabel,
    cohortLabel: metric.provenance.cohort === null ? null
      : t(`intel_reading.cohort_${metric.provenance.cohort}`, {}),
    title: period?.startDateStr && period?.endDateStr
      ? period.rangeRole !== 'source_history' && period.startDateStr === period.endDateStr
        ? t('intel_reading.metric_single_day', { date: formatShortDate(period.startDateStr), observed: period.observedDayCount })
        : t(period.rangeRole === 'source_history' ? 'target_profile.reading_reference_history_range' : 'target_profile.reading_period_range', { from: formatShortDate(period.startDateStr),
          to: formatShortDate(period.endDateStr), observed: period.observedDayCount, days: period.windowDayCount })
      : periodLabel,
  };
}

export function formatSiteIntelReading(interpretation, t) {
  const reading = interpretation.reading;
  const claims = reading.claims.map((claim) => ({
    surfaceItemId: claim.surfaceItemId, patternId: claim.patternId, role: claim.role, quality: claim.quality,
    headline: t(claim.headlineKey, {}),
    explanation: claim.explanationKey === null ? null : t(claim.explanationKey, {}),
    limitations: claim.limitationKeys.map((key) => t(key, {})),
    metrics: claim.metrics.map((metric) => formatSiteIntelReadingMetric(metric, t, reading.periods[metric.period])).filter(Boolean),
  }));
  const metrics = new Map(claims.flatMap((claim) => claim.metrics.map((metric) => [metric.id, metric])));
  const primaryEvidence = reading.primaryEvidenceIds.map((id) => {
    const formatted = metrics.get(id);
    if (!formatted) throw new Error('SITE_INTEL_READING_EVIDENCE_MISSING');
    return { ...formatted, label: formatted.scopedLabel };
  });
  return { headline: t(interpretation.headline.messageKey, {}), primaryEvidence, claims };
}
