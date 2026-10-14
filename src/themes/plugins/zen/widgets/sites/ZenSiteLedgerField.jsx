import React from 'react';
import { ZenReadingBlock } from '../../api/homeReadingSpace.js';
import ZenLedgerPages from './ZenLedgerPages.jsx';
import ZenSiteLedgerGlyph from './ZenSiteLedgerGlyph.jsx';
import { zenLedgerShortDate, zenLedgerWeekday, zenLedgerDuration } from './zenSiteLedgerFormat.js';

export default function ZenSiteLedgerField({ model, todayNotes, intel, focus, selectedDate, onSelectDate,
  onOpenDates, allDates = false, fieldId, rowRef, t, anchor, onAnchor, maxHeight = 300 }) {
  const days = [...model.days, { dateStr: todayNotes.dateStr, observed: intel.todayObserved, activeMs: intel.todayTotal }];
  const items = [];
  for (let index = 0; index < days.length; index++) {
    const day = days[index];
    let end = index;
    if (!allDates && !day.observed && day.dateStr !== todayNotes.dateStr) {
      while (end + 1 < days.length && !days[end + 1].observed && days[end + 1].dateStr !== todayNotes.dateStr) end++;
    }
    if (end - index >= 2) {
      items.push({ key: day.dateStr, content: <button type="button" className="zen-record-date zen-record-date--missing"
        onClick={() => onOpenDates(day.dateStr)}><span>{zenLedgerShortDate(day.dateStr)}–{zenLedgerShortDate(days[end].dateStr)}</span>
        <span>{t('usage_ledger.field_missing')} · {end - index + 1}{t('usage_ledger.day_unit')}</span></button> });
      index = end; continue;
    }
    const matching = focus?.kind === 'pattern' && model.patterns.find(pattern => pattern.id === focus.id).matchedDates.includes(day.dateStr);
    items.push({ key: day.dateStr, content: <button type="button" ref={node => rowRef?.(day.dateStr, node)}
      className="zen-record-date" data-kind={day.observed ? day.activeMs === 0 ? 'zero' : 'observed' : 'missing'}
      data-date={day.dateStr} data-selected={selectedDate === day.dateStr} data-matched={matching}
      aria-pressed={selectedDate === day.dateStr} onClick={() => onSelectDate(day.dateStr)}>
      <span>{day.dateStr === todayNotes.dateStr ? t('usage_ledger.field_today') : zenLedgerShortDate(day.dateStr)}
        <small>{zenLedgerWeekday(day.dateStr, t, true)}</small></span>
      <span>{matching && <ZenSiteLedgerGlyph kind={focus.id} />}{day.observed ? zenLedgerDuration(day.activeMs, t) : t('usage_ledger.field_missing')}</span>
    </button> });
  }
  const naturalHeight = 32 + items.length * 34;
  return <ZenReadingBlock as="section" className="zen-record-dates" id={fieldId} tabIndex={-1} aria-label={t('usage_ledger.nav_history')}
    style={{ height: Math.min(naturalHeight, maxHeight) }}>
    <header className="zen-record-dates__scope"><span>{zenLedgerShortDate(model.period.startDateStr)}–{zenLedgerShortDate(model.period.endDateStr)}
      {' · '}{t('usage_ledger.recorded_days', { count: model.period.observedDayCount })}</span>
      {!intel.todayObserved && <span>{t('usage_ledger.today_missing_short')}</span>}</header>
    <ZenLedgerPages items={items} anchor={anchor} onAnchor={onAnchor} hideSinglePageNavigation t={t} />
  </ZenReadingBlock>;
}
