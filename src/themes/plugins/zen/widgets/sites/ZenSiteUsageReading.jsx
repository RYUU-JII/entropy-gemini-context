import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { requireSiteLongTermPatterns } from '@/domains/stats/contracts/siteLongTermPatternContract.js';
import { requireSiteTodayNotes } from '@/domains/stats/contracts/siteTodayNotesContract.js';
import { shiftDateStr } from '@/domains/stats/shared/dateMath.js';
import { SiteIntelBoundary } from '@/themes/core/widgets/shared/sites/index.js';
import ZenSiteLedgerAnnotations from './ZenSiteLedgerAnnotations.jsx';
import ZenSiteLedgerField from './ZenSiteLedgerField.jsx';
import ZenSiteDaySlip from './ZenSiteDaySlip.jsx';
import ZenLedgerPages from './ZenLedgerPages.jsx';
import { ZenReadingBlock } from '../../api/homeReadingSpace.js';
import { zenLedgerDuration } from './zenSiteLedgerFormat.js';
import './zenSiteUsageReading.css';

function ZenTodayReading({ intel, ready, entry, window, t }) {
  if (ready) {
    const notes = requireSiteTodayNotes(intel.todayNotes);
    if (notes.status === 'detail_not_loaded') return <p>{t('usage_ledger.unloaded')}</p>;
    if (notes.status === 'missing') return <p>{t('usage_ledger.today_missing')}</p>;
    if (intel.todayBasis !== 'calendar-day' || intel.todayHorizon !== 'calendar_today'
      || intel.todayDateStr !== notes.dateStr || intel.todayObserved !== true
      || !Number.isFinite(intel.todayTotal) || intel.todayTotal < 0
      || !Number.isSafeInteger(intel.todaySessionStats?.count) || intel.todaySessionStats.count < 0) {
      throw new Error('ZEN_SITE_LEDGER_TODAY_INVALID');
    }
    return <div className="zen-site-ledger__today-reading" data-time-kind="today" data-usage-basis="local-calendar-day-hour">
      <span className="zen-site-ledger__today-label">{t('usage_ledger.today')}</span>
      <strong className="zen-site-ledger__today-value">{intel.todayTotal > 0 && intel.todayTotal < 60_000
        ? <span className="zen-site-ledger__under-minute">{zenLedgerDuration(intel.todayTotal, t)}</span>
        : <><span>{Math.round(intel.todayTotal / 60_000)}</span><small>{t('usage_ledger.field_minute_unit')}</small></>}</strong>
      <div className="zen-site-ledger__today-context">
        <span>{t('usage_ledger.calendar_basis')}</span>
        <span>{t('usage_ledger.completed_sessions', { count: intel.todaySessionStats.count })}</span>
      </div>
    </div>;
  }
  // A pending calendar query may still show the independent snapshot, with its
  // own activity-day scope. It never supplies a ledger row or a today note.
  if (entry === null || entry.recording.enabled !== true) return <p>{t('usage_ledger.recording_unavailable')}</p>;
  if (entry.usage?.basis !== 'activity-day-observed' || !Number.isFinite(entry.usage.observedMs)
    || entry.usage.observedMs < 0 || window?.basis !== 'completed-activity-days-recorded'
    || !Number.isInteger(window.resetHour) || window.resetHour < 0 || window.resetHour > 23) {
    throw new Error('SITES_OBSERVED_USAGE_INVALID');
  }
  return <p data-time-kind="today" data-usage-basis={entry.usage.basis}>{t('usage_ledger.snapshot_usage', {
    duration: zenLedgerDuration(entry.usage.observedMs, t), hour: String(window.resetHour).padStart(2, '0'),
  })}</p>;
}

function availableFocus(focus, model, todayNotes) {
  if (focus === null) return null;
  if (focus.kind === 'pattern' && model.patterns.some(pattern => pattern.id === focus.id)) return focus;
  if (focus.kind === 'change' && ['available', 'unclassified'].includes(model.status)
    && model.observations.change.available) return focus;
  if (focus.kind === 'today' && model.period.observedDayCount === 0
    && todayNotes.notes.some(note => note.id === focus.id)) return focus;
  if (focus.kind === 'early' && model.status === 'insufficient_history' && model.observations.way.sessionCount > 0
    && ['short_sessions', 'longest_session'].includes(focus.id)) return focus;
  return null; // Expired presentation intent is cleared when its evidence changes.
}

// A reading starting point, never a new representative-day or pattern decision.
function focusAnchor(focus, model, todayNotes) {
  if (focus.kind === 'today') return todayNotes.dateStr;
  if (focus.kind === 'pattern') {
    const pattern = model.patterns.find(item => item.id === focus.id);
    if (pattern === undefined || pattern.matchedDates.length === 0) throw new Error('ZEN_SITE_LEDGER_FOCUS_INVALID');
    return pattern.matchedDates[pattern.matchedDates.length - 1];
  }
  if (focus.kind === 'early') {
    const day = model.days.findLast(item => item.observed && item.sessionCount > 0);
    if (day === undefined) throw new Error('ZEN_SITE_LEDGER_FOCUS_INVALID');
    return day.dateStr;
  }
  if (focus.kind === 'change') {
    const recent = model.observations.change.recent;
    const day = model.days.find(item => item.observed && item.dateStr >= recent.startDateStr && item.dateStr <= recent.endDateStr);
    if (day === undefined) throw new Error('ZEN_SITE_LEDGER_FOCUS_INVALID');
    return day.dateStr;
  }
  throw new Error('ZEN_SITE_LEDGER_FOCUS_INVALID');
}

function ZenLedgerContents({ intel, t, presentationState, notebookNavigation }) {
  const model = requireSiteLongTermPatterns(intel.longTermPatterns);
  const todayNotes = requireSiteTodayNotes(intel.todayNotes);
  const loaded = model.status !== 'detail_not_loaded' && todayNotes.status !== 'detail_not_loaded';
  if (loaded && (intel.todayBasis !== 'calendar-day' || intel.todayHorizon !== 'calendar_today'
    || intel.todayDateStr !== todayNotes.dateStr || intel.todayObserved !== (todayNotes.status === 'observed')
    || (intel.todayObserved && (!Number.isFinite(intel.todayTotal) || intel.todayTotal < 0
      || !Array.isArray(intel.todayHourly) || intel.todayHourly.length !== 24
      || intel.todayHourly.some(value => !Number.isFinite(value) || value < 0)
      || Math.abs(intel.todayHourly.reduce((sum, value) => sum + value, 0) - intel.todayTotal) > 1
      || !['count', 'shortCount', 'longCount'].every(key => Number.isSafeInteger(intel.todaySessionStats?.[key]) && intel.todaySessionStats[key] >= 0)
      || intel.todaySessionStats.shortCount + intel.todaySessionStats.longCount > intel.todaySessionStats.count
      || !Number.isFinite(intel.todaySessionStats.maxMs) || intel.todaySessionStats.maxMs < 0)))) {
    throw new Error('ZEN_SITE_LEDGER_TODAY_INVALID');
  }
  const saved = presentationState && presentationState.domain === intel.domain && presentationState.layoutVersion === 2 ? presentationState : null;
  const initialDate = () => !loaded ? null : intel.todayObserved ? todayNotes.dateStr
    : model.days.findLast(day => day.observed)?.dateStr === undefined ? todayNotes.dateStr : model.days.findLast(day => day.observed).dateStr;
  const [dateIntent, setDateIntent] = useState(() => saved === null ? initialDate() : saved.selectedDate);
  const [focusIntent, setFocusIntent] = useState(() => saved === null ? null : saved.focus);
  const [view, setView] = useState(() => saved === null ? 'slip' : saved.view);
  const [returnView, setReturnView] = useState(() => saved === null ? 'slip' : saved.returnView);
  const [fieldAnchor, setFieldAnchor] = useState(() => saved === null ? initialDate() : saved.fieldAnchor);
  const [annotationAnchor, setAnnotationAnchor] = useState(() => saved === null ? null : saved.annotationAnchor);
  const [basisAnchor, setBasisAnchor] = useState(() => saved === null ? 'basis_sessions' : saved.basisAnchor);
  const [basisPage, setBasisPage] = useState(() => saved === null ? 0 : saved.basisPageIndex);
  const [dayReadings, setDayReadings] = useState(() => saved === null ? {} : saved.dayReadings);
  const viewport = useRef(null), rowRefs = useRef(new Map());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const id = useId();
  const navigationFocus = useRef(null);
  const focus = loaded ? availableFocus(focusIntent, model, todayNotes) : null;
  const selectedDate = dateIntent;
  const selectedDay = loaded ? model.days.find(day => day.dateStr === selectedDate) : undefined;
  const isToday = loaded && selectedDate === todayNotes.dateStr;
  const selectedObserved = isToday ? intel.todayObserved : selectedDay?.observed === true;
  const dayReading = Object.hasOwn(dayReadings, selectedDate) ? dayReadings[selectedDate] : { subview: 'summary', hour: 0, anchor: 'facts' };
  const updateDayReading = update => setDayReadings(previous => ({ ...previous, [selectedDate]: { ...dayReading, ...update } }));
  const cumulativeCount = loaded ? model.patterns.length + Number(model.observations.change.available) : 0;
  const simultaneous = size.width >= 560 && size.height >= 448 + cumulativeCount * 52;
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return undefined;
    const measure = () => {
      const bounds = node.getBoundingClientRect();
      setSize(previous => previous.width === bounds.width && previous.height === bounds.height ? previous : { width: bounds.width, height: bounds.height });
    };
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (dateIntent === null && loaded) { const date = initialDate(); setDateIntent(date); setFieldAnchor(date); }
    if (presentationState && loaded) Object.assign(presentationState, {
      layoutVersion: 2, domain: intel.domain, focus, selectedDate, view, returnView, fieldAnchor, annotationAnchor,
      basisAnchor, basisPageIndex: basisPage, dayReadings,
    });
  });
  useLayoutEffect(() => {
    if (!notebookNavigation) return undefined;
    const navigation = { domain: intel.domain, back: () => {
      if (view === 'basis') { navigationFocus.current = dayReading.subview === 'hours' ? 'hour' : 'basis'; setView(returnView); return true; }
      if (view === 'evidence' && !simultaneous) { navigationFocus.current = 'day'; setView('slip'); return true; }
      return false;
    } };
    notebookNavigation.current = navigation;
    return () => { if (notebookNavigation.current === navigation) notebookNavigation.current = null; };
  }, [notebookNavigation, intel.domain, view, returnView, simultaneous]);
  useLayoutEffect(() => {
    if (!presentationState) return undefined;
    const focusRequest = presentationState.controlFocusRequest; delete presentationState.controlFocusRequest;
    const currentRoot = viewport.current;
    if (focusRequest !== undefined && focusRequest.domain === intel.domain
      && focusRequest.dateStr === selectedDate && focusRequest.view === view
      && currentRoot.ownerDocument.activeElement === currentRoot.ownerDocument.body) {
      const control = [...currentRoot.querySelectorAll('button, input')].find(node =>
        node.getClientRects().length > 0 && !node.closest('[inert], [aria-hidden="true"]')
        && !node.disabled && focusRequest.attributes.every(([name, value]) => node.getAttribute(name) === value)
        && node.textContent === focusRequest.text
        && node.closest('.zen-record-dates, .zen-site-ledger-slip, .zen-record-basis, .zen-record-annotations')?.className === focusRequest.region);
      control?.focus({ preventScroll: true });
    }
    const request = presentationState.hourFocusRequest; delete presentationState.hourFocusRequest;
    const root = viewport.current, range = root?.querySelector('[data-ledger-hour-select]');
    if (request !== undefined && selectedObserved && dayReading.subview === 'hours' && view === 'slip'
      && request.domain === intel.domain && request.dateStr === selectedDate && request.hour === dayReading.hour
      && range && root.ownerDocument.activeElement === root.ownerDocument.body) range.focus({ preventScroll: true });
    return () => {
      delete presentationState.hourFocusRequest;
      delete presentationState.controlFocusRequest;
      const current = viewport.current, input = current?.querySelector('[data-ledger-hour-select]');
      const slip = current?.querySelector('[data-date][data-day-view="hours"]');
      const active = current?.ownerDocument.activeElement;
      if (active !== input && current?.contains(active) && active.matches('button, input')) {
        presentationState.controlFocusRequest = {
          domain: intel.domain, dateStr: current.dataset.selectedDate, view: current.dataset.view,
          region: active.closest('.zen-record-dates, .zen-site-ledger-slip, .zen-record-basis, .zen-record-annotations')?.className,
          attributes: ['data-date', 'data-ledger-action', 'data-day-action', 'data-annotation-id', 'aria-label', 'type']
            .map(name => [name, active.getAttribute(name)]), text: active.textContent,
        };
      }
      if (input && slip && current.ownerDocument.activeElement === input) presentationState.hourFocusRequest = {
        domain: intel.domain, dateStr: slip.dataset.date, hour: Number(input.value),
      };
    };
  }, [presentationState, intel.domain]);
  const selectDate = date => { if (view === 'evidence') navigationFocus.current = 'day'; setDateIntent(date); setFieldAnchor(date); setView('slip'); };
  const openDates = date => { navigationFocus.current = 'dates'; setFieldAnchor(date); setView('evidence'); };
  const returnDay = () => { navigationFocus.current = 'day'; setView('slip'); };
  const chooseFocus = next => {
    const nextFocus = focus?.kind === next.kind && focus.id === next.id ? null : next;
    setFocusIntent(nextFocus); setAnnotationAnchor(next.kind + ':' + next.id);
    if (nextFocus !== null) setFieldAnchor(focusAnchor(nextFocus, model, todayNotes));
    if (!simultaneous) { navigationFocus.current = 'dates'; setView('evidence'); }
  };
  const openBasis = () => { setReturnView(view); setView('basis'); };
  const closeBasis = () => { navigationFocus.current = dayReading.subview === 'hours' ? 'hour' : 'basis'; setView(returnView); };
  useLayoutEffect(() => {
    const request = navigationFocus.current;
    if (request === null) return;
    navigationFocus.current = null;
    const selector = request === 'dates' ? '.zen-record-dates' : request === 'hour' ? '[data-ledger-hour-select]'
      : request === 'basis' ? '[data-ledger-action="basis"]' : '[data-ledger-action="history"]';
    viewport.current?.querySelector(selector)?.focus({ preventScroll: true });
  }, [view]);
  const field = loaded && <ZenSiteLedgerField model={model} todayNotes={todayNotes} intel={intel} focus={focus}
    selectedDate={selectedDate} onSelectDate={selectDate} onOpenDates={openDates} allDates={view === 'evidence'}
    anchor={fieldAnchor} onAnchor={setFieldAnchor} rowRef={(date, node) => { if (node) rowRefs.current.set(date, node); else rowRefs.current.delete(date); }}
    fieldId={id + '-dates'} t={t} maxHeight={view === 'evidence' ? Math.max(64, size.height - 56) : Math.max(168, size.height - 264 - cumulativeCount * 52)} />;
  const annotations = loaded && cumulativeCount > 0 && <ZenSiteLedgerAnnotations model={model} todayNotes={todayNotes}
    cumulativeOnly focus={focus} onFocus={chooseFocus} fieldId={id + '-dates'} t={t} anchor={annotationAnchor} onAnchor={setAnnotationAnchor} />;
  return <div className="zen-site-ledger__contents">
    <div ref={viewport} tabIndex={-1} id={id + '-viewport'} className="zen-site-ledger__viewport zen-record-sheet"
      data-view={view} data-simultaneous={simultaneous} data-selected-date={selectedDate} data-selected-hour={dayReading.hour}
      data-day-view={dayReading.subview} data-return-view={returnView} data-basis-page-index={basisPage}
      data-day-anchor={dayReading.anchor} data-field-anchor={fieldAnchor} data-annotation-anchor={annotationAnchor}
      data-focus-kind={focus?.kind} data-focus-id={focus?.id}>
      {!loaded ? <p role="status">{t('usage_ledger.unloaded')}</p> : view === 'basis' ? <ZenReadingBlock as="section" className="zen-record-basis">
        <button type="button" data-ledger-action="back" onClick={closeBasis}>{t('usage_ledger.return_reading')}</button>
        <ZenLedgerPages anchor={basisAnchor} onAnchor={setBasisAnchor} onPage={setBasisPage} hideSinglePageNavigation t={t}
          items={['basis_sessions', 'basis_missing', 'basis_cells', 'basis_admission', 'basis_caution'].map(key => ({ key, content: <p>{t('usage_ledger.' + key, {
            observed: model.criteria.minObservedDays, active: model.criteria.minActiveDays,
            repeated: model.criteria.minRepeatedDays, share: Math.round(model.criteria.minRepeatedActiveDayShare * 100),
          })}</p> }))} />
      </ZenReadingBlock> : view === 'annotations' ? annotations : <>
        {simultaneous && view === 'slip' && annotations}
        {(simultaneous || view === 'evidence') && field}
        {view !== 'evidence' && (isToday || selectedDay !== undefined) && <ZenSiteDaySlip day={selectedDay} isToday={isToday}
          model={model} todayNotes={todayNotes} intel={intel} focus={focus} subview={selectedObserved ? dayReading.subview : 'summary'}
          onSubviewChange={subview => updateDayReading({ subview })} selectedHour={dayReading.hour}
          onSelectedHourChange={hour => updateDayReading({ hour })} anchor={dayReading.anchor} onAnchor={anchor => updateDayReading({ anchor })}
          onOpenDates={() => openDates(selectedDate)} onSelectDate={selectDate} onOpenBasis={openBasis}
          onOpenAnnotations={cumulativeCount > 0 && !simultaneous ? () => setView('annotations') : null}
          t={t} slipId={id + '-day'} />}
        {view !== 'evidence' && !isToday && selectedDay === undefined && <div><p role="status">{t('usage_ledger.date_outside_window')}</p><button type="button" onClick={() => openDates(todayNotes.dateStr)}>{t('usage_ledger.nav_history')}</button></div>}
      </>}
      {(view === 'annotations' || view === 'evidence') && <button className="zen-record-return" type="button" onClick={returnDay}>{t('usage_ledger.return_day')}</button>}
    </div>
  </div>;
}

export default function ZenSiteUsageReading({ intel, ready, usageEntry, averageWindow, siteCapControl, reading, t, presentationState, notebookNavigation }) {
  const todayReading = <div className="zen-site-ledger__today">
      <SiteIntelBoundary domain={intel.domain} profile={ready ? intel : usageEntry} t={t}>
        <ZenTodayReading intel={intel} ready={ready} entry={usageEntry} window={averageWindow} t={t} />
      </SiteIntelBoundary>
      {siteCapControl && <div className="zen-site-ledger__cap">
        {siteCapControl}
        {averageWindow !== null && <small>{t('usage_ledger.cap_basis', { hour: String(averageWindow.resetHour).padStart(2, '0') })}</small>}
      </div>}
    </div>;
  return <div className="zen-site-usage zen-site-ledger">
    {ready ? <SiteIntelBoundary domain={intel.domain} profile={intel} t={t} errorContent={todayReading}>
      <ZenLedgerContents key={intel.domain} intel={intel} t={t} presentationState={presentationState} notebookNavigation={notebookNavigation} />
    </SiteIntelBoundary> : <>{todayReading}{reading}</>}
  </div>;
}
