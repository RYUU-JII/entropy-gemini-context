import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { normalizePermissionDomainInput } from '@/lib/permissions.js';
import { sortSitesRegistryDomains } from './sitesRegistryOrdering.js';
import { requireSitesRegistryScope } from './sitesRegistryScope.js';
import { sitesRecordingScopeLabel } from './sitesRecordingPresentation.js';

const DOMAIN_SYNTAX_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,63}$/i;

function isValidDomainSyntax(candidate) {
  if (!candidate || typeof candidate !== 'string') return false;
  if (!candidate.includes('.')) return false;
  if (candidate.includes(' ') || candidate.includes('/') || candidate.includes('?') || candidate.includes('#')) return false;
  return DOMAIN_SYNTAX_REGEX.test(candidate);
}

function readTodayUsage(entry) {
  if (entry.recording.enabled === false) return null;
  if (entry.recording.enabled !== true || entry.usage?.basis !== 'activity-day-observed'
    || !Number.isFinite(entry.usage.observedMs) || entry.usage.observedMs < 0) {
    throw new Error('SITES_REGISTRY_ACTIVITY_DAY_USAGE_INVALID');
  }
  return entry.usage.observedMs;
}

// A comparison is a presentation snapshot: ordinary facts polling must not move
// rows or rescale them while a notebook is open. Policy, membership, selection
// and completed-period changes establish a new comparison for every theme.
function useComparison(domains, siteRegistry, selectedDomain, recording, policyFingerprint, sortBy) {
  const ref = useRef(null);
  const window = siteRegistry.averageWindow;
  const key = [
    sortBy, policyFingerprint, selectedDomain, recording.effectiveScope, recording.reason,
    window?.windowStartDateStr, window?.windowEndDateStr, window?.resetHour, window?.observedDayCount,
    domains.map((domain) => `${domain}:${siteRegistry.byDomain[domain]?.recording?.reason}`).sort().join('|'),
  ].join('::');

  if (!ref.current || ref.current.key !== key) {
    const todayByDomain = Object.fromEntries(domains.map((domain) => [domain, readTodayUsage(siteRegistry.byDomain[domain])]));
    let ordered;
    if (sortBy === 'name' || recording.effectiveScope === 'off') {
      ordered = [...domains].sort((a, b) => a.localeCompare(b));
    } else if (sortBy === 'today') {
      ordered = [...domains].sort((a, b) => {
        const aToday = todayByDomain[a] === null ? -1 : todayByDomain[a];
        const bToday = todayByDomain[b] === null ? -1 : todayByDomain[b];
        return bToday - aToday || a.localeCompare(b);
      });
    } else {
      ordered = sortSitesRegistryDomains(domains, { siteRegistry });
    }
    const averages = Object.fromEntries(ordered.map((domain) => [domain, siteRegistry.byDomain[domain]?.usageAverage || null]));
    const maximum = Object.values(averages).reduce((max, average) => Math.max(max, average?.averageMs ?? 0), 0);
    const maximumToday = domains.reduce((max, domain) => Math.max(max, todayByDomain[domain] === null ? 0 : todayByDomain[domain]), 0);
    ref.current = { key, ordered, averages, maximum, maximumToday, todayByDomain };
  }
  return ref.current;
}

// Theme-neutral ledger interaction. This hook owns presentation state only;
// canonical DTO admission, commands and selected-detail loading stay in the app.
export default function useSitesRegistryModel({
  siteRegistry, recording, policyFingerprint, activeScope, selectedDomain = null,
  onScopeChange, onSelectBlocked, onSelectAllowed, onSelectTracked,
  onRequestRegistration, registrationPending = false, presentationState,
}) {
  const { t } = useAppTranslation('sites');
  if (!siteRegistry || !Array.isArray(siteRegistry.entries)) throw new Error('SITES_REGISTRY_READ_MODEL_REQUIRED');
  if (typeof policyFingerprint !== 'string' || !policyFingerprint.trim()) throw new Error('SITES_REGISTRY_POLICY_FINGERPRINT_REQUIRED');
  const id = useId();
  const scope = requireSitesRegistryScope(activeScope);
  const hasFilters = recording.effectiveScope === 'all_sites';
  const scopeLabel = sitesRecordingScopeLabel(recording, t);
  const [query, setQuery] = useState(() => presentationState?.query || '');
  const [management, setManagement] = useState(() => presentationState?.management === true);
  const [sortBy, setSortBy] = useState(() => presentationState?.sortBy || 'average');
  if (presentationState) presentationState.listWindow ||= {};
  const listPresentationState = presentationState?.listWindow;
  const searchInputRef = useRef(null);
  useEffect(() => {
    if (presentationState) Object.assign(presentationState, { query, management, sortBy });
  }, [query, management, sortBy, presentationState]);
  const targets = useMemo(() => ({
    all: siteRegistry.entries.map(entry => entry.domain),
    blocked: siteRegistry.entries.filter(entry => entry.type === 'blocked').map(entry => entry.domain),
  }), [siteRegistry]);
  const policyByDomain = useMemo(() => Object.fromEntries(siteRegistry.entries.map(entry => [entry.domain, entry.type])), [siteRegistry]);
  const comparison = useComparison(targets.all, siteRegistry, selectedDomain, recording, policyFingerprint, sortBy);
  const trimmedQuery = query.trim().toLowerCase();
  const normalizedCandidate = normalizePermissionDomainInput(trimmedQuery);
  const isValidNewDomain = Boolean(normalizedCandidate && isValidDomainSyntax(normalizedCandidate) && !policyByDomain[normalizedCandidate]);
  const filtered = comparison.ordered.filter(domain => (scope === 'all' || policyByDomain[domain] === scope) && domain.includes(trimmedQuery));
  // Query context owns a new render window. Membership and usage refreshes in
  // that context must not collapse rows the user has already revealed.
  const listResetKey = management ? 'allowances' : JSON.stringify([scope, sortBy, trimmedQuery]);
  const select = { blocked: onSelectBlocked, allowed: onSelectAllowed, tracked: onSelectTracked };
  const policyLabels = { all: t('registry.all_label'), blocked: t('registry.blocked_label') };
  const openRegistration = (domain = '', type = 'blocked') => {
    if (registrationPending) return;
    if (typeof onRequestRegistration !== 'function') throw new Error('SITES_NOTEBOOK_REGISTRATION_OWNER_REQUIRED');
    onRequestRegistration({ domain, type });
  };
  const handleScopeChange = next => { setQuery(''); onScopeChange(requireSitesRegistryScope(next)); };
  const handleSearchKeyDown = event => {
    if (event.key === 'Escape' && query) {
      event.preventDefault();
      setQuery('');
      return;
    }
    if (event.key !== 'Enter' || isValidNewDomain) return;
    const target = filtered.find(domain => domain === normalizedCandidate || domain === trimmedQuery) || filtered[0];
    if (target) { event.preventDefault(); select[policyByDomain[target]](target); }
  };
  const handleSortKeyDown = event => {
    const options = ['average', 'today', 'name'];
    const current = options.indexOf(event.target.dataset.sort);
    if (current < 0) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2
      : ['ArrowDown', 'ArrowRight'].includes(event.key) ? (current + 1) % 3
      : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? (current + 2) % 3 : null;
    if (next === null) return;
    event.preventDefault();
    setSortBy(options[next]);
    event.currentTarget.querySelector('[data-sort="' + options[next] + '"]').focus();
  };
  const renderTime = ms => {
    if (ms > 0 && ms < 60000) return t('registry.under_minute');
    const minutes = Math.round(ms / 60000);
    const suffix = t('standard_panel.minute_suffix');
    return minutes >= 60 ? t('units.hour_short', { count: Math.floor(minutes / 60) }) + (minutes % 60 ? ' ' + minutes % 60 + suffix : '') : minutes + suffix;
  };

  return {
    t, id, scope, hasFilters, scopeLabel, query, setQuery, management, setManagement,
    sortBy, setSortBy, searchInputRef, targets, policyByDomain, comparison,
    normalizedCandidate, isValidNewDomain, filtered, listResetKey, listPresentationState, select, policyLabels,
    window: siteRegistry.averageWindow,
    openRegistration, handleScopeChange, handleSearchKeyDown, handleSortKeyDown, renderTime,
  };
}
