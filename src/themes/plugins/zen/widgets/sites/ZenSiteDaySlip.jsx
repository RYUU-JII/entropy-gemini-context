import React from 'react';
import { ZenReadingBlock } from '../../api/homeReadingSpace.js';
import ZenLedgerPages from './ZenLedgerPages.jsx';
import { zenLedgerDayLabel, zenLedgerEvidenceDuration, zenLedgerEvidenceShare, zenLedgerFocusTitle } from './zenSiteLedgerFormat.js';
import './zenSiteDaySlip.css';

function ZenDayMetrics({ items }) {
  return <ZenReadingBlock as="dl" className="zen-site-ledger-slip__metrics">
    {items.map(item => <div key={item.id}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
  </ZenReadingBlock>;
}

// This is a reading of the selected day's canonical facts, not another pattern
// admission. Today's notes never supply historical visit or friction counts.
function contextFact({ day, isToday, observed, sessions, focus, model, todayNotes, t }) {
  if (!observed || focus === null) return null;
  if (isToday) {
    if (focus.kind !== 'today') return null;
    const note = todayNotes.notes.find(item => item.id === focus.id);
    if (note === undefined) throw new Error('ZEN_SITE_LEDGER_FOCUS_INVALID');
    if (note.id === 'short_sessions') return {
      label: null, value: t('usage_ledger.field_ratio', { value: note.value, total: note.denominator }), detail: null, window: null,
    };
    if (note.id === 'peak_time_window') return {
      label: null, value: t('usage_ledger.slip_window_ratio', {
        value: zenLedgerEvidenceDuration(note.value, t), total: zenLedgerEvidenceDuration(note.denominator, t),
      }), detail: null, window: note.window,
    };
    if (note.id === 'revisit_within_5m') return {
      label: null, value: t('usage_ledger.field_ratio', { value: note.value, total: note.denominator }),
      detail: t('usage_ledger.today_revisit_definition'), window: null,
    };
    if (note.id === 'friction_response') return {
      label: null, value: t('usage_ledger.field_event_count', { count: note.value }),
      detail: t('usage_ledger.today_friction_definition', note.responses), window: null,
    };
    throw new Error('ZEN_SITE_LEDGER_FOCUS_INVALID');
  }
  if (focus.kind === 'today' || focus.kind === 'change') return null;
  if (focus.id === 'short_sessions') return {
    label: t('usage_ledger.today_short_title', { minutes: model.criteria.shortSessionMaxMsExclusive / 60_000 }),
    value: sessions.count === 0 ? t('usage_ledger.field_no_sessions')
      : t('usage_ledger.field_ratio', { value: sessions.short, total: sessions.count }),
    detail: null, window: null,
  };
  if (focus.kind === 'early' && focus.id === 'longest_session') return {
    label: null, value: zenLedgerEvidenceDuration(sessions.longest, t), detail: null, window: null,
  };
  if (focus.kind === 'pattern' && focus.id === 'long_sessions') return {
    label: null, value: t('usage_ledger.slip_count', { count: sessions.long }), detail: null, window: null,
  };
  if (focus.kind === 'pattern' && focus.id === 'recurring_time') {
    const pattern = model.patterns.find(item => item.id === focus.id);
    if (pattern === undefined) throw new Error('ZEN_SITE_LEDGER_FOCUS_INVALID');
    return {
      label: null, value: t('usage_ledger.slip_window_measure', {
        value: zenLedgerEvidenceDuration(day.recurringWindow.activeMs, t),
        total: zenLedgerEvidenceDuration(day.activeMs, t),
        share: day.recurringWindow.share === null ? '—' : zenLedgerEvidenceShare(day.recurringWindow.share) + '%',
      }), detail: null, window: pattern,
    };
  }
  throw new Error('ZEN_SITE_LEDGER_FOCUS_INVALID');
}

function inWindow(hour, window) {
  return window !== null && (hour - window.startHour + 24) % 24 < window.durationHours;
}

export default function ZenSiteDaySlip({ day, isToday, model, todayNotes, intel, focus, subview, onSubviewChange,
  selectedHour, onSelectedHourChange, anchor, onAnchor, onOpenDates, onSelectDate, onOpenBasis, onOpenAnnotations, t, slipId }) {
  if (!['summary', 'sessions', 'hours'].includes(subview)
    || !Number.isInteger(selectedHour) || selectedHour < 0 || selectedHour > 23
    || typeof onSubviewChange !== 'function' || typeof onSelectedHourChange !== 'function'
    || typeof anchor !== 'string' || typeof onAnchor !== 'function') throw new Error('ZEN_SITE_DAY_SLIP_INTENT_INVALID');
  const dateStr = isToday ? todayNotes.dateStr : day.dateStr;
  const observed = isToday ? intel.todayObserved : day.observed;
  if (!observed && subview !== 'summary') throw new Error('ZEN_SITE_DAY_SLIP_UNOBSERVED_SUBVIEW');
  const activeMs = isToday ? intel.todayTotal : day.activeMs;
  const sessions = !observed ? null : isToday ? {
    count: intel.todaySessionStats.count, short: intel.todaySessionStats.shortCount,
    long: intel.todaySessionStats.longCount, longest: intel.todaySessionStats.maxMs,
  } : { count: day.sessionCount, short: day.shortSessionCount, long: day.longSessionCount, longest: day.maxSessionMs };
  const focusTitle = zenLedgerFocusTitle(focus, model, todayNotes, t);
  const fact = contextFact({ day, isToday, observed, sessions, focus, model, todayNotes, t });
  const summaryFacts = observed ? t('usage_ledger.slip_summary_facts', {
    count: sessions.count, longest: zenLedgerEvidenceDuration(sessions.longest, t),
  }) : null;
  const shortMinutes = model.criteria.shortSessionMaxMsExclusive / 60_000;
  const longMinutes = model.criteria.longSessionMinMs / 60_000;
  const hourlyActiveMs = observed ? isToday ? intel.todayHourly : day.hourlyActiveMs : null;
  const hourRange = t('usage_ledger.slip_hour_range', {
    start: String(selectedHour).padStart(2, '0'), end: String(selectedHour + 1).padStart(2, '0'),
  });
  const dates = [...model.days.map(item => item.dateStr), todayNotes.dateStr];
  const dateIndex = dates.indexOf(dateStr);
  const summaryItems = observed ? [
    { key: 'facts', content: <div className="zen-site-ledger-slip__facts">
      <p className="zen-site-ledger-slip__sentence">{t(sessions.count === 0 ? 'usage_ledger.day_no_completed'
        : sessions.short === sessions.count ? 'usage_ledger.day_all_short' : 'usage_ledger.day_some_short', {
          count: sessions.count, short: sessions.short, minutes: shortMinutes,
        })}</p>
      {sessions.count > 0 && <p className="zen-site-ledger-slip__sentence">{t('usage_ledger.day_longest', { duration: zenLedgerEvidenceDuration(sessions.longest, t) })}</p>}
      {activeMs === 0 && <p className="zen-site-ledger-slip__sentence">{t('usage_ledger.slip_zero')}</p>}
    </div> },
    ...(fact !== null && focus.id === 'recurring_time' ? [{ key: 'context-note', content: <p className="zen-site-ledger-slip__sentence">{focusTitle} · {fact.value}</p> }] : []),
  ] : [{ key: 'facts', content: <p className="zen-site-ledger-slip__sentence">{t('usage_ledger.slip_missing')}</p> }];
  return <section id={slipId} className="zen-site-ledger-slip zen-site-ledger-slip--detail" tabIndex={-1}
    aria-label={zenLedgerDayLabel(dateStr, t)} data-date={dateStr} data-today={isToday}
    data-day-view={subview} data-focus-kind={focus?.kind} data-focus-id={focus?.id}>
    <ZenReadingBlock as="header" className="zen-site-ledger-slip__heading">
      <button type="button" aria-label={t('usage_ledger.previous_day')} disabled={dateIndex <= 0} onClick={() => onSelectDate(dates[dateIndex - 1])}>‹</button>
      <button type="button" data-ledger-action="history" onClick={onOpenDates} aria-label={t('usage_ledger.choose_date', { date: zenLedgerDayLabel(dateStr, t) })}>
        {isToday ? t('usage_ledger.slip_today_title') : zenLedgerDayLabel(dateStr, t)} ▾</button>
      <button type="button" aria-label={t('usage_ledger.next_day')} disabled={dateIndex >= dates.length - 1} onClick={() => onSelectDate(dates[dateIndex + 1])}>›</button>
      <strong className="zen-site-ledger-slip__duration">{observed ? zenLedgerEvidenceDuration(activeMs, t) : t('usage_ledger.field_missing')}</strong>
    </ZenReadingBlock>
    <ZenReadingBlock as="nav" className="zen-record-day-tabs" aria-label={t('usage_ledger.views')}>
      {['summary', 'hours', 'sessions'].map(value => <button key={value} type="button" data-day-action={value}
        aria-pressed={subview === value} disabled={!observed && value !== 'summary'} onClick={() => onSubviewChange(value)}>
        {t('usage_ledger.day_tab_' + value)}</button>)}
      {onOpenAnnotations && <button type="button" data-ledger-action="annotations" onClick={onOpenAnnotations}>{t('usage_ledger.cumulative')}</button>}
      <button type="button" data-ledger-action="basis" aria-label={t('usage_ledger.nav_basis')} onClick={onOpenBasis}>ⓘ</button>
    </ZenReadingBlock>
    {subview === 'summary' && <ZenLedgerPages className="zen-site-ledger-slip__summary" items={summaryItems.map(item => ({...item, content:<ZenReadingBlock>{item.content}</ZenReadingBlock>}))}
      anchor={anchor} onAnchor={onAnchor} hideSinglePageNavigation t={t} />}
    {subview === 'sessions' && <ZenLedgerPages className="zen-site-ledger-slip__sessions" anchor={anchor} onAnchor={onAnchor}
      hideSinglePageNavigation t={t} items={[
      { key: 'length-counts', content: <ZenDayMetrics items={[
        { id: 'short', label: t('usage_ledger.slip_short', { minutes: shortMinutes }), value: t('usage_ledger.slip_count', { count: sessions.short }) },
        { id: 'medium', label: t('usage_ledger.slip_medium', { start: shortMinutes, end: longMinutes }), value: t('usage_ledger.slip_count', { count: sessions.count - sessions.short - sessions.long }) },
        { id: 'long', label: t('usage_ledger.slip_long', { minutes: longMinutes }), value: t('usage_ledger.slip_count', { count: sessions.long }) },
      ]} /> },
      { key: 'length-summary', content: <ZenReadingBlock as="p" className="zen-site-ledger-slip__summary-facts">{summaryFacts}</ZenReadingBlock> },
      { key: 'length-definition', content: <ZenReadingBlock as="p" className="zen-site-ledger-slip__sentence">{t('usage_ledger.slip_sessions_hint')}</ZenReadingBlock> },
    ]} />}
    {subview === 'hours' && <ZenReadingBlock className="zen-site-ledger-slip__hours">
      <h5 className="sr-only">{t('usage_ledger.slip_open_hours')}</h5>
      <div className="zen-site-ledger-slip__hour-strip" aria-hidden="true">
        {hourlyActiveMs.map((value, hour) => <span key={hour} data-hour={hour} data-active-ms={value}
          data-selected={hour === selectedHour} data-in-window={inWindow(hour, fact === null ? null : fact.window)}
          style={{ '--zen-ledger-cell-opacity': value > 0 ? 0.16 + 0.8 * Math.min(1, value / (30 * 60_000)) : 0 }}>
          {value > 0 && <i />}
        </span>)}
      </div>
      <div className="zen-site-ledger-slip__hour-axis" aria-hidden="true">{['00', '06', '12', '18', '24'].map(hour => <span key={hour}>{hour}</span>)}</div>
      <input type="range" min="0" max="23" step="1" value={selectedHour} data-ledger-hour-select
        aria-label={t('usage_ledger.slip_hours_label')} aria-valuetext={t('usage_ledger.slip_hour_value', {
          range: hourRange, duration: zenLedgerEvidenceDuration(hourlyActiveMs[selectedHour], t),
        })} onChange={event => onSelectedHourChange(Number(event.target.value))} />
      <p className="zen-site-ledger-slip__selected-hour" data-selected-hour={selectedHour} data-active-ms={hourlyActiveMs[selectedHour]} aria-live="polite">
        <span>{hourRange}</span><strong>{zenLedgerEvidenceDuration(hourlyActiveMs[selectedHour], t)}</strong>
      </p>
    </ZenReadingBlock>}
  </section>;
}
