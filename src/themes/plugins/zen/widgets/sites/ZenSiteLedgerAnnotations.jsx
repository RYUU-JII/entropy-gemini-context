import React from 'react';
import { ZenReadingBlock } from '../../api/homeReadingSpace.js';
import ZenSiteLedgerGlyph from './ZenSiteLedgerGlyph.jsx';
import ZenLedgerPages from './ZenLedgerPages.jsx';
import { zenLedgerDuration, zenLedgerEvidenceDuration, zenLedgerPatternTitle, zenLedgerShortDate } from './zenSiteLedgerFormat.js';

const selected = (focus, key) => focus !== null && focus.kind === key.kind && focus.id === key.id;

function ZenLedgerAnnotation({ item, focus, onFocus, fieldId }) {
  const pressed = selected(focus, item.focus);
  return <button className="zen-site-ledger-annotations__item" type="button"
    aria-pressed={pressed} aria-controls={fieldId} data-annotation-kind={item.focus.kind}
    data-annotation-id={item.focus.id} onClick={() => onFocus(item.focus)}>
    <ZenSiteLedgerGlyph kind={item.glyph} />
    <span className="zen-site-ledger-annotations__copy">
      <span className="zen-site-ledger-annotations__label">{item.label}</span>
      <span className="zen-site-ledger-annotations__definition">{item.definition}</span>
    </span>
    <span className="zen-site-ledger-annotations__measure">
      <span><span className="zen-site-ledger-annotations__number">{item.value}</span>
        {item.denominator !== null && <span className="zen-site-ledger-annotations__denominator">{item.denominator}</span>}</span>
      <span className="zen-site-ledger-annotations__caption">{item.caption}</span>
    </span>
  </button>;
}

function patternAnnotation(pattern, model, t) {
  const criteria = model.criteria;
  const definitions = {
    short_sessions: () => t('usage_ledger.pattern_short_definition', {
      count: criteria.shortDailyCount, shortCount: criteria.shortDailyShortCount,
      minutes: criteria.shortSessionMaxMsExclusive / 60_000, share: Math.round(criteria.shortDailyShare * 100),
    }),
    long_sessions: () => t('usage_ledger.pattern_long_definition', { minutes: criteria.longSessionMinMs / 60_000 }),
    recurring_time: () => t('usage_ledger.pattern_recurring_definition', { hours: pattern.durationHours }),
  };
  return {
    focus: { kind: 'pattern', id: pattern.id }, glyph: pattern.id,
    label: zenLedgerPatternTitle(pattern, model, t), definition: definitions[pattern.id](),
    value: pattern.repeatedDayCount,
    denominator: t('usage_ledger.denominator_days', { count: pattern.activeDayCount }),
    caption: t('usage_ledger.caption_active_days'),
  };
}

function changeAnnotation(change, t) {
  return {
    focus: { kind: 'change', id: 'change' }, glyph: 'change',
    label: t('usage_ledger.change_title'),
    definition: t('usage_ledger.change_definition', {
      referenceStart: zenLedgerShortDate(change.reference.startDateStr),
      referenceEnd: zenLedgerShortDate(change.reference.endDateStr), referenceCount: change.reference.observedDayCount,
      recentStart: zenLedgerShortDate(change.recent.startDateStr),
      recentEnd: zenLedgerShortDate(change.recent.endDateStr), recentCount: change.recent.observedDayCount,
    }),
    value: t('usage_ledger.change_value', {
      before: zenLedgerDuration(change.reference.averageActiveMs, t), after: zenLedgerDuration(change.recent.averageActiveMs, t),
    }),
    denominator: null,
    caption: t('usage_ledger.change_caption', { reference: change.reference.windowDays, recent: change.recent.windowDays }),
  };
}

function todayAnnotation(note, model, t) {
  const item = { focus: { kind: 'today', id: note.id }, glyph: note.id, value: note.value, denominator: null, caption: t('usage_ledger.today') };
  switch (note.id) {
    case 'short_sessions':
      return { ...item,
        label: t('usage_ledger.today_short_title', { minutes: model.criteria.shortSessionMaxMsExclusive / 60_000 }),
        definition: t('usage_ledger.today_short_definition'),
        denominator: t('usage_ledger.denominator_count', { count: note.denominator }),
        caption: t('usage_ledger.caption_today_completed'),
      };
    case 'peak_time_window':
      return { ...item,
        label: t('usage_ledger.today_window_title', { start: note.window.startHour, end: note.window.endHourExclusive }),
        definition: t('usage_ledger.today_window_definition', { hours: note.window.durationHours }),
        value: zenLedgerEvidenceDuration(note.value, t),
        denominator: t('usage_ledger.denominator_duration', { duration: zenLedgerEvidenceDuration(note.denominator, t) }),
        caption: t('usage_ledger.caption_today_recorded'),
      };
    case 'revisit_within_5m':
      return { ...item, label: t('usage_ledger.today_revisit_title'), definition: t('usage_ledger.today_revisit_definition'),
        denominator: t('usage_ledger.denominator_visits', { count: note.denominator }), caption: t('usage_ledger.caption_today_visits'),
      };
    case 'friction_response':
      return { ...item, label: t('usage_ledger.today_friction_title'),
        definition: t('usage_ledger.today_friction_definition', { continued: note.responses.continued, left: note.responses.left }),
        denominator: t('usage_ledger.count_unit'),
      };
    default:
      throw new Error('ZEN_SITE_LEDGER_TODAY_NOTE_INVALID');
  }
}

function earlyAnnotations(model, t) {
  const way = model.observations.way;
  if (way.sessionCount === 0) return [];
  const shortMinutes = model.criteria.shortSessionMaxMsExclusive / 60_000;
  const longMinutes = model.criteria.longSessionMinMs / 60_000;
  return [
    {
      focus: { kind: 'early', id: 'short_sessions' }, glyph: 'short_sessions',
      label: t('usage_ledger.today_short_title', { minutes: shortMinutes }),
      definition: t('usage_ledger.early_short_definition', { observed: model.period.observedDayCount }),
      value: way.shortSessionCount,
      denominator: t('usage_ledger.denominator_count', { count: way.sessionCount }), caption: t('usage_ledger.caption_completed'),
    },
    {
      focus: { kind: 'early', id: 'longest_session' }, glyph: 'longest_session',
      label: t('usage_ledger.early_longest_title'),
      definition: t(way.longSessionCount === 0 ? 'usage_ledger.early_longest_without_long' : 'usage_ledger.early_longest_definition', { minutes: longMinutes }),
      value: zenLedgerEvidenceDuration(way.maxSessionMs, t), denominator: null, caption: t('usage_ledger.caption_one_session'),
    },
  ];
}

export default function ZenSiteLedgerAnnotations({ model, todayNotes, focus, onFocus, fieldId, t, anchor, onAnchor, todayReading, cumulativeOnly = false }) {
  if (model.period === null) return <p className="zen-site-ledger-annotations__lead">{t('usage_ledger.unloaded')}</p>;
  const { period, criteria } = model;
  const first = period.observedDayCount === 0;
  const early = model.status === 'insufficient_history';
  let items = [];
  let lead = null;
  if (first) {
    items = todayNotes.notes.map(note => todayAnnotation(note, model, t));
    if (items.length === 0) lead = t(todayNotes.status === 'missing' ? 'usage_ledger.today_missing' : 'usage_ledger.today_no_notes');
  } else if (early) {
    items = earlyAnnotations(model, t);
  } else if (model.status === 'observed_zero') {
    lead = t('usage_ledger.lead_zero', { observed: period.observedDayCount });
  } else {
    items = model.patterns.map(pattern => patternAnnotation(pattern, model, t));
    if (model.status === 'unclassified') lead = t('usage_ledger.lead_none', { days: period.windowDays });
    if (model.observations.change.available) items.push(changeAnnotation(model.observations.change, t));
  }
  if (cumulativeOnly) {
    const cumulative = model.patterns.map(pattern => patternAnnotation(pattern, model, t));
    if (model.observations.change.available) cumulative.push(changeAnnotation(model.observations.change, t));
    return <ZenReadingBlock as="section" className="zen-record-annotations" style={{ height: cumulative.length * 52 }} aria-label={t('usage_ledger.cumulative')}>
      <ZenLedgerPages anchor={anchor} onAnchor={onAnchor} hideSinglePageNavigation t={t} items={cumulative.map(item => ({
        key: item.focus.kind + ':' + item.focus.id,
        content: <button type="button" className="zen-record-annotation" aria-pressed={selected(focus, item.focus)} aria-controls={fieldId}
          data-annotation-kind={item.focus.kind} data-annotation-id={item.focus.id} onClick={() => onFocus(item.focus)}>
          <ZenSiteLedgerGlyph kind={item.glyph} /><span>{item.label}</span>
          <span>{item.value}{item.denominator}</span>
        </button>,
      }))} />
    </ZenReadingBlock>;
  }
  const scope = first ? t('usage_ledger.today_scope', { date: zenLedgerShortDate(todayNotes.dateStr) })
    : t('usage_ledger.scope', {
      start: zenLedgerShortDate(period.startDateStr), end: zenLedgerShortDate(period.endDateStr),
      observed: period.observedDayCount, active: period.activeDayCount,
    });
  const foot = first ? t('usage_ledger.foot_first', { observed: criteria.minObservedDays, active: criteria.minActiveDays })
    : early ? t('usage_ledger.foot_early', {
      observed: criteria.minObservedDays, active: criteria.minActiveDays,
      currentObserved: period.observedDayCount, currentActive: period.activeDayCount,
    }) : t('usage_ledger.foot_accumulated', { minutes: criteria.longSessionMinMs / 60_000 });
  return <section className="zen-site-ledger-annotations" data-ledger-state={model.status}
    data-period-start={period.startDateStr} data-period-end={period.endDateStr}>
    <div className="zen-site-ledger-annotations__heading">
      <h3>{t(first ? 'usage_ledger.notes_title_first' : early ? 'usage_ledger.notes_title_early' : 'usage_ledger.notes_title_accumulated', { days: period.windowDays })}</h3>
      <p className="zen-site-ledger-annotations__scope">{scope}</p>
    </div>
    {lead !== null && <p className="zen-site-ledger-annotations__lead">{lead}</p>}
    <ZenLedgerPages anchor={anchor} onAnchor={onAnchor} t={t} className="zen-site-ledger-annotations__list" items={[
      { key: 'today', content: todayReading },
      ...items.map(item => ({ key: item.focus.kind + ':' + item.focus.id, content:
        <ZenLedgerAnnotation item={item} focus={focus} onFocus={onFocus} fieldId={fieldId} /> })),
      { key: 'scope', content: <p className="zen-site-ledger-annotations__foot">{foot}</p> },
    ]} />
  </section>;
}
