import React from 'react';
import { ChevronRight, Plus, Search, X } from 'lucide-react';
import SitesRegistryScopeTabs from './SitesRegistryScopeTabs.jsx';
import { SitesRegistryList, SitesRegistryRow } from './SitesRegistryList.jsx';
import { sitesRecordingLabel } from './sitesRecordingPresentation.js';
import useSitesRegistryModel from './useSitesRegistryModel.js';
import './sitesUnifiedRegistry.css';

const EMPTY = Object.freeze([]);
const FILTERS = ['all', 'blocked'];

export default function StandardSiteRegistryPanel({
  allowedTargets = EMPTY, siteRegistry, recording, policyFingerprint,
  onOpenRecordingSettings, onManageExclusions, pendingRelease = null,
  activeScope, selectedDomain = null, onScopeChange, onSelectBlocked, onSelectAllowed, onSelectTracked,
  world = 'entropy', onRequestRegistration, registrationPending = false, layout = 'compact', presentationState,
}) {
  if (layout !== 'compact' && layout !== 'ledger') throw new Error('SITES_REGISTRY_LAYOUT_INVALID');
  const isLedger = layout === 'ledger';
  const {
    t, id, scope, hasFilters, scopeLabel, query, setQuery, management, setManagement,
    sortBy, setSortBy, searchInputRef, targets, policyByDomain, comparison,
    normalizedCandidate, isValidNewDomain, filtered, listResetKey, listPresentationState, select, policyLabels, window,
    openRegistration, handleScopeChange, handleSearchKeyDown, handleSortKeyDown, renderTime,
  } = useSitesRegistryModel({
    siteRegistry, recording, policyFingerprint, activeScope, selectedDomain,
    onScopeChange, onSelectBlocked, onSelectAllowed, onSelectTracked,
    onRequestRegistration, registrationPending, presentationState,
  });
  return <section className="sites-unified-registry font-sans" data-sites-registry-world={world} data-recording-scope={recording.effectiveScope} data-layout={layout}>
    <header className="sites-unified-registry__header">
      {management && <div className="sites-registry-management-heading"><button type="button" onClick={() => setManagement(false)}>{t('workspace.back_to_ledger')}</button><h2>{t('recording.manage_allowed')}</h2><p>{t('recording.allowed_explanation')}</p></div>}
      <div className="sites-unified-registry__search-zone">
        {!management && <div className="sites-unified-registry__search"><Search size={14} aria-hidden="true" className="sites-unified-registry__search-icon" />
          <label className="sr-only" htmlFor={id+'-search'}>{t('registry.search_label')}</label>
          <input id={id+'-search'} ref={searchInputRef} type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder={t('registry.search_placeholder')} autoComplete="off" spellCheck={false} />
          {query && <button type="button" onClick={() => { setQuery(''); searchInputRef.current?.focus(); }} aria-label={t('common:action.clear')}><X size={13} aria-hidden="true" /></button>}
        </div>}
        <button type="button" className="sites-unified-registry__add-btn" disabled={registrationPending} onClick={() => openRegistration(isValidNewDomain ? normalizedCandidate : '', management ? 'allowed' : 'blocked')}><Plus size={15} aria-hidden="true" />{t(management ? 'recording.add_allowed' : 'registry.add_protected')}</button>
      </div>
      {!management && <>
        <div className="sites-unified-registry__meta-bar"><div className="sites-unified-registry__scope-zone">
          {hasFilters ? <SitesRegistryScopeTabs tabs={FILTERS.map(type => ({ id:type, label:policyLabels[type], count:targets[type].length }))} activeTab={scope} onChange={handleScopeChange}
            classNames={{ container:'sites-unified-registry__filters',track:'sites-unified-registry__filter-track',button:'sites-unified-registry__filter',content:'sites-unified-registry__filter-content',label:'',count:'' }} />
            : <span>{t('recording.protected_sites')} · {targets.blocked.length}</span>}
        </div>
        <div className="sites-registry-sort" role="radiogroup" aria-label={t('registry.sort_label')} onKeyDown={handleSortKeyDown}>{['average','today','name'].map(option => <button key={option} type="button" role="radio" data-sort={option} tabIndex={sortBy === option ? 0 : -1} aria-checked={sortBy === option} onClick={() => setSortBy(option)}>{{ average: t('registry.sort_average'), today: t('registry.sort_today'), name: t('registry.sort_name') }[option]}</button>)}</div></div>
        {recording.effectiveScope !== 'off' && window && <p className="sites-unified-registry__ledger-basis">{t('registry.average_period', { start:window.windowStartDateStr,end:window.windowEndDateStr,hour:String(window.resetHour).padStart(2,'0') })} · {t('registry.window_coverage',{count:window.observedDayCount,days:window.windowDayCount})}</p>}
        {isValidNewDomain && <button type="button" className="sites-registry-search-candidate" disabled={registrationPending} onClick={() => openRegistration(normalizedCandidate)}>{t('registry.connect_candidate',{domain:normalizedCandidate})}</button>}
      </>}
    </header>
    {management ? <div className="sites-registry-allowances">{allowedTargets.length === 0 && <p>{t('recording.allowed_empty')}</p>}{allowedTargets.map(domain => <button key={domain} type="button" onClick={() => onSelectAllowed(domain)}>{domain}<ChevronRight size={16} aria-hidden="true" /></button>)}</div> : (
        <SitesRegistryList
          items={filtered}
          resetKey={listResetKey}
          presentationState={listPresentationState}
          selectedIndex={filtered.indexOf(selectedDomain)}
          loadMoreLabel={({ count }) => t('registry.load_more', { count })}
          emptyLabel={t(query ? 'registry.search_empty' : hasFilters ? 'registry.unified_empty' : 'recording.protected_empty')}
          classNames={{ container: 'sites-unified-registry__list' }}
          renderItem={(domain) => {
            const type = policyByDomain[domain];
            const average = comparison.averages[domain];
            const entryRecording = siteRegistry.byDomain[domain].recording;
            const todayMs = comparison.todayByDomain[domain];
            const known = entryRecording.enabled && average && average.averageMs !== null;
            const partial = known && average.status === 'partial';
            const pending = pendingRelease?.domain === domain;

            const displayMs = sortBy === 'today' ? todayMs : (known ? average.averageMs : null);
            const usageRatio = sortBy === 'today'
              ? (todayMs !== null && comparison.maximumToday > 0 ? todayMs / comparison.maximumToday : null)
              : (known && comparison.maximum > 0 ? average.averageMs / comparison.maximum : null);
            const policy = (
              <span className="sites-unified-registry__policy" data-policy={type}>
                <i aria-hidden="true" />
                {t(type === 'blocked' ? 'registry.blocked_label' : 'recording.record_only')}
                {pending && <span>{t('release.row_pending', { seconds: pendingRelease.remainingSeconds })}</span>}
              </span>
            );

            return (
              <SitesRegistryRow
                key={domain}
                domain={domain}
                selected={selectedDomain === domain}
                onSelect={() => select[type]?.(domain)}
                usageRatio={isLedger ? null : usageRatio}
                comparison={isLedger && (
                  <span className="sites-unified-registry__comparison" aria-hidden="true" data-known={displayMs !== null}>
                    {displayMs !== null && <span style={{ width: `${Math.min(1, usageRatio === null ? 0 : usageRatio) * 100}%` }} />}
                  </span>
                )}
                trailing={
                  <span
                    className="sites-unified-registry__time"
                    title={
                      sortBy === 'today' && todayMs !== null
                        ? t('registry.today_usage_short', { value: renderTime(todayMs) })
                        : known
                        ? `${t('registry.site_average_detail', { value: renderTime(average.totalMs), count: average.observedDayCount, days: window?.observedDayCount })}${todayMs > 0 ? ` · ${t('registry.today_usage_short', { value: renderTime(todayMs) })}` : ''}`
                        : entryRecording.enabled
                          ? t('registry.collecting')
                          : sitesRecordingLabel(entryRecording, t)
                    }
                  >
                    {isLedger && <span className="sr-only">{t(sortBy === 'today' ? 'registry.sort_today' : 'registry.average_basis')} </span>}
                    {displayMs !== null ? (
                      <strong>
                        {renderTime(displayMs)}
                        {sortBy === 'average' && partial && <span aria-label={t('registry.partial_records')}>*</span>}
                      </strong>
                    ) : (
                      <small>{entryRecording.enabled ? t('registry.collecting') : sitesRecordingLabel(entryRecording, t)}</small>
                    )}
                    {isLedger && policy}
                  </span>
                }
                secondary={isLedger ? null : policy}
                endAdornment={isLedger && <span className="sites-unified-registry__row-action"><ChevronRight size={16} aria-hidden="true" /><span className="sr-only">{t('registry.open_notebook')}</span></span>}
                classNames={{
                  container: 'sites-registry-row sites-unified-registry__row',
                  selected: 'sites-registry-row--selected',
                  idle: '',
                  button: 'sites-unified-registry__row-button',
                  primary: 'sites-unified-registry__domain',
                  secondary: 'sites-unified-registry__secondary',
                  avatarFrame: 'sites-unified-registry__favicon',
                  accent: 'bg-accent',
                  accentIdle: 'bg-transparent',
                }}
              />
            );
          }}
        />
    )}
    <footer className="sites-registry-management"><span>{scopeLabel}</span>
      {!management && <button type="button" onClick={() => setManagement(true)}>{t('recording.manage_allowed')} · {allowedTargets.length}</button>}
      <button type="button" onClick={onOpenRecordingSettings}>{t('recording.settings')}</button>
      <button type="button" onClick={onManageExclusions}>{t('recording.manage_exclusions')}</button>
    </footer>
  </section>;
}
