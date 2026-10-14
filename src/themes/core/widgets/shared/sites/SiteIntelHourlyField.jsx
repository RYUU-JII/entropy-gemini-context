import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatSiteIntelHourlyValue } from './siteIntelHourlyContext.js';

const hourLabel = hour => String(hour).padStart(2, '0') + ':00';
const formatShortDate = value => typeof value === 'string' ? value.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, '$1.$2') : value;

export default function SiteIntelHourlyField({ context, domain, t, periodLabel = null }) {
  const titleId = useId(), readoutId = useId();
  const [hour, setHour] = useState(null);
  const pinned = useRef(false);
  const buttons = useRef([]);
  useEffect(() => { setHour(null); pinned.current = false; }, [domain, context.id]);
  const format = value => formatSiteIntelHourlyValue(value, context.unit, t);
  const interval = value => hourLabel(value) + '–' + hourLabel(value + 1);
  const current = hour === null ? 0 : hour;
  const step = delta => { pinned.current = true; setHour(Math.max(0, Math.min(23, current + delta))); };
  return <figure className="site-intel__hourly" data-hourly-state={context.state} data-hourly-series={context.id}
    data-hourly-relation={context.relation} aria-labelledby={titleId} aria-describedby={readoutId + '-basis'}
    onKeyDown={event => { if (event.key === 'Escape' && hour !== null) { event.preventDefault(); event.stopPropagation(); setHour(null); pinned.current = false; } }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setHour(null); pinned.current = false; } }}>
    <p id={readoutId + '-basis'} className="sr-only">{t('intel_reading.hourly_description')}</p>
    <figcaption className="site-intel__hourly-heading"><span id={titleId}>{t(context.unit === 'count' ? 'intel_reading.hourly_visits_title' : 'intel_reading.hourly_title')}</span>
      <span>{t(context.relation === 'evidence' ? 'intel_reading.linked_evidence' : 'intel_reading.context_distribution')}</span></figcaption>
    <p className="site-intel__hourly-period">{periodLabel || (context.period === 'today'
      ? t('intel_reading.hourly_today', { date: formatShortDate(context.startDate) })
      : t('intel_reading.hourly_period', { start: formatShortDate(context.startDate), end: formatShortDate(context.endDate) }))}
      {' · '}{t('intel_reading.coverage', { observed: context.observedDays, days: context.windowDays })}</p>
    <div className="site-intel__hourly-plot" onMouseLeave={() => { if (!pinned.current) setHour(null); }}>
      <div className="site-intel__hourly-grid" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      {context.state !== 'missing' && <>
        <span className="site-intel__hourly-ceiling" aria-hidden="true">{t('intel_reading.hourly_scale_max', { value: format(context.ceiling) })}</span>
        <div className="site-intel__hourly-bars" role="group" aria-label={t('intel_reading.hourly_interaction')}>
          {context.hours.map(({ hour: index, value, ratio }) => <button type="button" key={index}
            ref={node => { buttons.current[index] = node; }} className="site-intel__hourly-bin"
            tabIndex={index === current ? 0 : -1} aria-pressed={hour === index} aria-label={interval(index) + ' · ' + format(value)}
            aria-describedby={readoutId} onClick={() => { pinned.current = true; setHour(index); }} onFocus={() => setHour(index)}
            onMouseEnter={() => { if (!pinned.current) setHour(index); }} onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault(); pinned.current = false;
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? 23 : Math.max(0, Math.min(23, index + (event.key === 'ArrowRight' ? 1 : -1)));
              setHour(next); buttons.current[next]?.focus({ preventScroll: true });
            }}><i aria-hidden="true" data-positive={value > 0} style={{ height: ratio * 100 + '%' }} /></button>)}
        </div>
      </>}
      {context.state !== 'activity' && <p className="site-intel__hourly-empty">{t(context.state === 'missing' ? 'intel_reading.hourly_missing' : context.unit === 'count' ? 'intel_reading.hourly_visits_zero' : 'intel_reading.hourly_zero')}</p>}
    </div>
    <div className="site-intel__hourly-axis" aria-hidden="true">{[0, 6, 12, 18, 24].map(value => <span key={value}>{hourLabel(value)}</span>)}</div>
    <div className="site-intel__inspection">
      <button type="button" aria-label={t('usage_reading.previous_hour')} disabled={context.state === 'missing' || current === 0} onClick={() => step(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
      <p id={readoutId} className="site-intel__hourly-readout" data-selected={hour !== null}>{context.state === 'missing' ? t('intel_reading.observation_basis') : hour === null ? t('intel_reading.hourly_explore') : interval(hour) + ' · ' + format(context.hours[hour].value)}</p>
      <button type="button" aria-label={t('usage_reading.next_hour')} disabled={context.state === 'missing' || current === 23} onClick={() => step(1)}><ChevronRight size={16} aria-hidden="true" /></button>
    </div>
  </figure>;
}