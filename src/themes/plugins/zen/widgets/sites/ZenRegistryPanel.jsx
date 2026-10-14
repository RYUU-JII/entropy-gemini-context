import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ZenReadingBlock } from '../../api/homeReadingSpace.js';
import { ArrowLeft, ChevronDown, MoreHorizontal, Plus, Search, X } from 'lucide-react';
import {
  SitesRegistryList,
  SitesRegistryRow,
  SitesRegistryScopeTabs,
  sitesRecordingLabel,
  useSitesRegistryModel,
} from '@/themes/core/widgets/shared/sites/index.js';
import './zenRegistryPanel.css';
import './zenLedgerPages.css';

const EMPTY = Object.freeze([]);
const FILTERS = ['all', 'blocked'];
const SORT_OPTIONS = ['average', 'today', 'name'];
const ROW_CLASSES = Object.freeze({
  container: 'zen-ledger__row', selected: 'zen-ledger__row--selected', idle: '',
  button: 'zen-ledger__row-button', primary: 'zen-ledger__domain',
  secondary: 'zen-ledger__state', avatarFrame: 'zen-ledger__favicon',
  accent: 'zen-ledger__selection', accentIdle: 'zen-ledger__selection--idle',
});

function ZenLedgerDisclosure({ label, children, menu = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dismiss = event => {
      if (ref.current?.open && !ref.current.contains(event.target)) ref.current.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  return <details ref={ref} className={`zen-ledger__disclosure${menu ? ' zen-ledger__disclosure--menu' : ''}`}
    data-sites-ledger-menu={menu || undefined} onKeyDown={event => {
    if (event.key !== 'Escape' || !event.currentTarget.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.open = false;
    event.currentTarget.querySelector('summary').focus();
  }}>
    <summary data-sites-ledger-menu-trigger={menu || undefined}>
      {menu ? <><MoreHorizontal size={18} aria-hidden="true" /><span className="sr-only">{label}</span></>
        : <>{label}<ChevronDown size={12} aria-hidden="true" /></>}
    </summary>
    <div className="zen-ledger__disclosure-content">{children}</div>
  </details>;
}

export default function ZenRegistryPanel({
  allowedTargets = EMPTY, siteRegistry, recording, policyFingerprint,
  onOpenRecordingSettings, onManageExclusions, pendingRelease = null,
  activeScope, selectedDomain = null, onScopeChange, onSelectBlocked, onSelectAllowed, onSelectTracked,
  onRequestRegistration, registrationPending = false, layout = 'compact', presentationState,
  policyControl = null,
}) {
  if (!['compact', 'ledger', 'notebook'].includes(layout)) throw new Error('SITES_REGISTRY_LAYOUT_INVALID');
  const {
    t, id, scope, hasFilters, scopeLabel, query, setQuery, management, setManagement,
    sortBy, setSortBy, searchInputRef, targets, policyByDomain, comparison,
    normalizedCandidate, isValidNewDomain, filtered, listResetKey, listPresentationState, select, policyLabels, window,
    openRegistration, handleScopeChange, handleSearchKeyDown, renderTime,
  } = useSitesRegistryModel({
    siteRegistry, recording, policyFingerprint, activeScope, selectedDomain,
    onScopeChange, onSelectBlocked, onSelectAllowed, onSelectTracked,
    onRequestRegistration, registrationPending, presentationState,
  });
  const managementBackRef = useRef(null);
  const bodyRef = useRef(null);
  const [pageSize, setPageSize] = useState(8);
  const [pageAnchor, setPageAnchor] = useState(() => presentationState?.pageAnchor);
  useLayoutEffect(() => {
    const node = bodyRef.current;
    const measure = () => {
      const height = node.getBoundingClientRect().height;
      if (height > 0) setPageSize(Math.max(1, Math.min(40, Math.floor((height - 44) / 56))));
    };
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (presentationState) presentationState.pageAnchor = pageAnchor; }, [presentationState, pageAnchor]);
  // Alphabetical ordering changes position, not the measure being read. This
  // intent is Zen presentation only; shared registry owners retain both facts.
  const [metricBasis, setMetricBasis] = useState(() => sortBy === 'name'
    ? presentationState?.metricBasis === 'today' ? 'today' : 'average' : sortBy);
  useEffect(() => {
    if (presentationState) presentationState.metricBasis = metricBasis;
  }, [metricBasis, presentationState]);
  const changeSort = next => {
    if (next !== 'name') setMetricBasis(next);
    setSortBy(next);
  };
  const previousManagement = useRef(management);
  useEffect(() => {
    if (previousManagement.current === management) return;
    previousManagement.current = management;
    (management ? managementBackRef.current : searchInputRef.current)?.focus({ preventScroll: true });
  }, [management, searchInputRef]);
  const addLabel = management ? t('recording.add_allowed')
    : isValidNewDomain ? t('registry.connect_candidate', { domain: normalizedCandidate })
      : t('registry.add_protected');
  const metricLabel = t(metricBasis === 'today' ? 'registry.ledger_metric_today' : 'registry.ledger_metric_average');

  const renderRow = domain => {
    const type = policyByDomain[domain];
    const average = comparison.averages[domain];
    const entryRecording = siteRegistry.byDomain[domain].recording;
    const todayMs = comparison.todayByDomain[domain];
    const known = entryRecording.enabled && average && average.averageMs !== null;
    const displayMs = metricBasis === 'today' ? todayMs : known ? average.averageMs : null;
    const partial = metricBasis !== 'today' && known && average.status === 'partial';
    const pending = pendingRelease?.domain === domain;
    const unavailableLabel = entryRecording.enabled ? t('registry.collecting') : sitesRecordingLabel(entryRecording, t);
    const stateLabel = !entryRecording.enabled ? sitesRecordingLabel(entryRecording, t)
      : t(type === 'blocked' ? 'registry.blocked_label' : 'recording.record_only');
    const collecting = entryRecording.enabled && displayMs === null;

    return <ZenReadingBlock key={domain} className="zen-ledger__row-space"><SitesRegistryRow domain={domain} selected={selectedDomain === domain}
      onSelect={() => select[type]?.(domain)} faviconSize={20} classNames={ROW_CLASSES}
      secondary={<>
        <span data-policy={type} title={stateLabel} className="zen-ledger__policy-mark"><span aria-hidden="true">{type === 'blocked' ? '│' : '○'}</span><span className="sr-only">{stateLabel}</span></span>
        {collecting && <span>{t('registry.collecting')}</span>}
        {pending && <span className="zen-ledger__pending">{t('release.row_pending', { seconds: pendingRelease.remainingSeconds })}</span>}
      </>}
      trailing={<span className="zen-ledger__time" title={displayMs === null ? unavailableLabel
          : metricBasis === 'today' ? t('registry.today_usage_short', { value: renderTime(todayMs) })
            : t('registry.site_average_detail', { value: renderTime(average.totalMs), count: average.observedDayCount, days: window?.observedDayCount })}>
          <span className="sr-only">{t(metricBasis === 'today' ? 'registry.sort_today' : 'registry.average_basis')} </span>
          {displayMs !== null ? <>
            {renderTime(displayMs)}
            {partial && <span className="zen-ledger__partial"><span aria-hidden="true">*</span><span className="sr-only">{t('registry.partial_records')}</span></span>}
          </> : <><span aria-hidden="true">—</span><span className="sr-only">{unavailableLabel}</span></>}
        {partial && <span className="zen-ledger__coverage-tooltip" role="tooltip">{t('registry.site_average_detail', { value: renderTime(average.totalMs), count: average.observedDayCount, days: window.observedDayCount })}</span>}
      </span>}
      endAdornment={<span className="sr-only">{t('registry.open_notebook')}</span>}
    /></ZenReadingBlock>;
  };

  const pageItems = management ? allowedTargets : filtered;
  const anchorIndex = pageItems.indexOf(pageAnchor);
  const pageIndex = anchorIndex < 0 ? 0 : Math.floor(anchorIndex / pageSize);
  const pageCount = Math.ceil(pageItems.length / pageSize);
  const visibleItems = pageItems.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  return <section className="zen-ledger sites-unified-registry font-sans" data-sites-registry-world="zen" data-layout={layout} data-recording-scope={recording.effectiveScope}>
    <ZenReadingBlock as="header" className="zen-ledger__header">
      {layout === 'notebook' && <h2 className="zen-ledger__index-title">{t('workspace.ledger_title')}</h2>}
      <div className="zen-ledger__entry">
        {!management && <h2 className="zen-ledger__index-title">{t('workspace.ledger_title')}</h2>}
        {management ? <div className="zen-ledger__management-heading">
          <button ref={managementBackRef} type="button" onClick={() => setManagement(false)} aria-label={t('workspace.back_to_ledger')}><ArrowLeft size={16} aria-hidden="true" /></button>
          <h2>{t('recording.manage_allowed')}</h2>
        </div> : <div className="zen-ledger__search sites-unified-registry__search">
          <Search size={15} aria-hidden="true" />
          <label className="sr-only" htmlFor={`${id}-search`}>{t('registry.search_label')}</label>
          <input id={`${id}-search`} ref={searchInputRef} type="search" value={query}
            onChange={event => setQuery(event.target.value)} onKeyDown={handleSearchKeyDown}
            placeholder={t('registry.unified_search_zen')} autoComplete="off" spellCheck={false} />
          {query && <button type="button" onClick={() => { setQuery(''); searchInputRef.current?.focus(); }} aria-label={t('common:action.clear')}><X size={14} aria-hidden="true" /></button>}
        </div>}
        <button type="button" className="zen-ledger__add" aria-label={addLabel} title={addLabel} disabled={registrationPending}
          onClick={() => openRegistration(isValidNewDomain ? normalizedCandidate : '', management ? 'allowed' : 'blocked')}><Plus size={18} aria-hidden="true" /></button>
        <ZenLedgerDisclosure menu label={t('registry.ledger_management_toggle')}>
          {policyControl}
          <button type="button" onClick={event => { event.currentTarget.closest('details').open = false; onOpenRecordingSettings(); }}>{t('recording.settings')}</button>
          <button type="button" onClick={event => { event.currentTarget.closest('details').open = false; onManageExclusions(); }}>{t('recording.manage_exclusions')}</button>
          {!management && <button type="button" onClick={event => { event.currentTarget.closest('details').open = false; setManagement(true); }}>{t('recording.manage_allowed')} · {allowedTargets.length}</button>}
          <p className="zen-ledger__scope-note">{scopeLabel}</p>
        </ZenLedgerDisclosure>
      </div>
      <div className="zen-ledger__utility">
        {!management && hasFilters && <SitesRegistryScopeTabs tabs={FILTERS.map(type => ({ id: type, label: policyLabels[type], count: targets[type].length }))}
          activeTab={scope} onChange={handleScopeChange} classNames={{
            container: 'zen-ledger__filters', track: 'zen-ledger__filter-track', button: 'zen-ledger__filter',
            content: 'zen-ledger__filter-content', label: '', count: '',
          }} />}
        {!management && targets.all.length > 0 && <ZenLedgerDisclosure label={metricLabel}>
          <label className="sr-only" htmlFor={`${id}-sort`}>{t('registry.sort_label')}</label>
          <select id={`${id}-sort`} className="zen-ledger__sort" value={sortBy}
            onChange={event => changeSort(event.target.value)}>
            {SORT_OPTIONS.map(option => <option key={option} value={option}>{t(`registry.sort_${option}`)}</option>)}
          </select>
          {window && recording.effectiveScope !== 'off' && <div className="zen-ledger__basis">
            {metricBasis === 'today' ? <p>{t('registry.ledger_today_basis', { hour: String(window.resetHour).padStart(2, '0') })}</p> : <>
              <p>{t('registry.average_period', { start: window.windowStartDateStr, end: window.windowEndDateStr, hour: String(window.resetHour).padStart(2, '0') })}</p>
              <p>{t('registry.window_coverage', { count: window.observedDayCount, days: window.windowDayCount })}</p>
            </>}
            {metricBasis !== 'today' && <p>{t('registry.partial_records')}</p>}
          </div>}
        </ZenLedgerDisclosure>}
      </div>
    </ZenReadingBlock>
    <div ref={bodyRef} className="zen-ledger__body"><SitesRegistryList items={visibleItems}
      resetKey={listResetKey}
      presentationState={listPresentationState}
      selectedIndex={visibleItems.indexOf(selectedDomain)}
      loadMoreLabel={({ count }) => t('registry.load_more', { count })}
      emptyLabel={t(management ? 'recording.allowed_empty' : query ? 'registry.search_empty' : hasFilters ? 'registry.unified_empty' : 'recording.protected_empty')}
      classNames={{ container: 'zen-ledger__list', empty: 'zen-ledger__empty', loadMore: 'zen-ledger__load-more' }}
      renderItem={management ? domain => <SitesRegistryRow key={domain} domain={domain}
        selected={selectedDomain === domain} onSelect={() => onSelectAllowed(domain)} faviconSize={20} classNames={ROW_CLASSES}
        endAdornment={<span className="sr-only">{t('registry.open_notebook')}</span>} /> : renderRow} />
    {pageCount > 1 && <nav className="zen-ledger-pages__navigation" aria-label={t('usage_ledger.pages')}>
      <button type="button" aria-label={t('usage_ledger.page_previous')} disabled={pageIndex === 0} onClick={() => setPageAnchor(pageItems[(pageIndex - 1) * pageSize])}>←</button>
      <span>{t('usage_ledger.page_status', { page: pageIndex + 1, total: pageCount })}</span>
      <button type="button" aria-label={t('usage_ledger.page_next')} disabled={pageIndex + 1 >= pageCount} onClick={() => setPageAnchor(pageItems[(pageIndex + 1) * pageSize])}>→</button>
    </nav>}</div>
  </section>;
}
