import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Favicon from '@/ui-kit/Favicon.jsx';

function joinClassNames(...values) {
  return values.filter(Boolean).join(' ');
}

const DEFAULT_LIST_CLASS_NAMES = Object.freeze({
  container: 'min-h-0 flex-1 overflow-y-auto',
  empty: 'flex h-full items-center justify-center p-6 text-[11px] font-semibold text-on-surface-muted/65',
  loadMore: 'mx-auto my-3 flex min-h-8 min-w-16 items-center justify-center rounded-full border border-border/30 px-3 text-[10px] font-semibold tabular-nums text-on-surface-muted transition-colors hover:border-border/60 hover:text-on-surface focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40',
});

const EMPTY_ITEMS = Object.freeze([]);
const DEFAULT_INITIAL_RENDER_COUNT = 40;
const DEFAULT_RENDER_CHUNK_SIZE = 40;
const FAVICON_ENRICHMENT_ROOT_MARGIN = '200px 0px';
const SELECTED_INDEX_UNSET = Symbol('sites-registry-selected-index-unset');

let faviconEnrichmentObserver = null;
const faviconEnrichmentTargets = new Map();

function releaseFaviconEnrichmentObserverWhenIdle() {
  if (faviconEnrichmentTargets.size > 0 || !faviconEnrichmentObserver) return;
  faviconEnrichmentObserver.disconnect();
  faviconEnrichmentObserver = null;
}

function getFaviconEnrichmentObserver() {
  if (faviconEnrichmentObserver) return faviconEnrichmentObserver;
  if (typeof globalThis.IntersectionObserver !== 'function') return null;

  faviconEnrichmentObserver = new globalThis.IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const reveal = faviconEnrichmentTargets.get(entry.target);
      if (!reveal) return;
      faviconEnrichmentObserver?.unobserve(entry.target);
      faviconEnrichmentTargets.delete(entry.target);
      reveal();
    });
    releaseFaviconEnrichmentObserverWhenIdle();
  }, {
    root: null,
    rootMargin: FAVICON_ENRICHMENT_ROOT_MARGIN,
  });
  return faviconEnrichmentObserver;
}

function observeFaviconEnrichment(target, reveal) {
  const observer = getFaviconEnrichmentObserver();
  if (!observer) return null;
  faviconEnrichmentTargets.set(target, reveal);
  observer.observe(target);
  return () => {
    observer.unobserve(target);
    faviconEnrichmentTargets.delete(target);
    releaseFaviconEnrichmentObserverWhenIdle();
  };
}

function normalizeRenderCount(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isSelectedRegistryElement(element) {
  if (!React.isValidElement(element)) return false;
  return element.props?.selected === true || element.props?.['aria-current'] === 'true';
}

const DEFAULT_ROW_CLASS_NAMES = Object.freeze({
  container: 'group relative border-b border-border/20 transition-colors',
  selected: 'bg-surface-elevated/20',
  idle: 'bg-transparent hover:bg-surface-elevated/12',
  button: 'grid w-full grid-cols-[32px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left',
  accent: 'bg-accent/35',
  accentIdle: 'bg-transparent',
  avatarFrame: 'shrink-0 rounded-[10px] border-border/20 bg-surface',
  avatar: 'opacity-90',
  primary: 'truncate text-[13px] font-medium leading-5 text-on-surface',
  secondary: 'mt-1 text-[10px] text-on-surface-muted/70',
  value: 'text-[12px] font-medium tabular-nums text-on-surface-muted',
  valueIdle: 'text-transparent',
});

export function SitesRegistryList({
  items = [],
  renderItem,
  emptyState = null,
  emptyLabel = '',
  classNames = {},
  initialRenderCount = DEFAULT_INITIAL_RENDER_COUNT,
  renderChunkSize = DEFAULT_RENDER_CHUNK_SIZE,
  resetKey = '',
  presentationState = null,
  selectedIndex = SELECTED_INDEX_UNSET,
  loadMoreLabel = '',
}) {
  const resolvedClassNames = { ...DEFAULT_LIST_CLASS_NAMES, ...classNames };
  const safeItems = Array.isArray(items) ? items : EMPTY_ITEMS;
  const normalizedInitialCount = normalizeRenderCount(
    initialRenderCount,
    DEFAULT_INITIAL_RENDER_COUNT,
  );
  const normalizedChunkSize = normalizeRenderCount(
    renderChunkSize,
    DEFAULT_RENDER_CHUNK_SIZE,
  );
  const containerRef = useRef(null);
  const loadMoreRef = useRef(null);
  const [renderWindow, setRenderWindow] = useState(() => ({ resetKey, initialCount: normalizedInitialCount,
    visibleCount: presentationState?.resetKey === resetKey && presentationState?.initialCount === normalizedInitialCount
      ? normalizeRenderCount(presentationState.visibleCount, normalizedInitialCount) : normalizedInitialCount }));
  const contextMatches = renderWindow.resetKey === resetKey && renderWindow.initialCount === normalizedInitialCount;
  const visibleCount = contextMatches ? renderWindow.visibleCount : normalizedInitialCount;
  const hasDeclaredSelectedIndex = selectedIndex !== SELECTED_INDEX_UNSET;
  const hasValidSelectedIndex = hasDeclaredSelectedIndex
    && Number.isInteger(selectedIndex)
    && selectedIndex >= 0
    && selectedIndex < safeItems.length;
  const detectedSelectedIndex = useMemo(
    () => {
      if (hasDeclaredSelectedIndex) return -1;
      return safeItems.findIndex((item, index) => (
        isSelectedRegistryElement(renderItem?.(item, index))
      ));
    },
    [hasDeclaredSelectedIndex, renderItem, safeItems],
  );
  const normalizedSelectedIndex = hasValidSelectedIndex
    ? selectedIndex
    : hasDeclaredSelectedIndex
      ? -1
      : detectedSelectedIndex;

  useLayoutEffect(() => {
    const current = { resetKey, initialCount: normalizedInitialCount, visibleCount };
    if (!contextMatches) setRenderWindow(current);
    if (presentationState) Object.assign(presentationState, current);
  }, [contextMatches, resetKey, normalizedInitialCount, visibleCount, presentationState]);

  const boundedVisibleCount = Math.min(visibleCount, safeItems.length);
  const visibleElements = safeItems
    .slice(0, boundedVisibleCount)
    .map((item, index) => renderItem?.(item, index));
  const hasMore = boundedVisibleCount < safeItems.length;
  const remainingCount = Math.max(0, safeItems.length - boundedVisibleCount);
  const nextBatchSize = Math.min(normalizedChunkSize, remainingCount);
  const resolvedLoadMoreLabel = typeof loadMoreLabel === 'function'
    ? loadMoreLabel({ count: nextBatchSize, remainingCount })
    : loadMoreLabel;
  const pinnedSelection = normalizedSelectedIndex >= boundedVisibleCount
    ? renderItem?.(safeItems[normalizedSelectedIndex], normalizedSelectedIndex)
    : null;
  const showNextBatch = useCallback(() => {
    setRenderWindow(current => ({ resetKey, initialCount: normalizedInitialCount,
      visibleCount: Math.min(safeItems.length,
        (current.resetKey === resetKey && current.initialCount === normalizedInitialCount
          ? current.visibleCount : normalizedInitialCount) + normalizedChunkSize) }));
  }, [normalizedChunkSize, normalizedInitialCount, resetKey, safeItems.length]);

  useEffect(() => {
    if (!hasMore || typeof globalThis.IntersectionObserver !== 'function') return undefined;

    const target = loadMoreRef.current;
    if (!target) return undefined;

    const observer = new globalThis.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) showNextBatch();
    }, {
      root: null,
      rootMargin: '0px 0px 160px 0px',
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, showNextBatch]);

  return (
    <div
      ref={containerRef}
      className={resolvedClassNames.container}
      data-visible-count={boundedVisibleCount + (pinnedSelection ? 1 : 0)}
      data-total-count={safeItems.length}
    >
      {safeItems.length === 0 ? (
        emptyState || <div className={resolvedClassNames.empty}>{emptyLabel}</div>
      ) : (
        <>
          {visibleElements}
          {pinnedSelection ? (
            <div data-registry-pinned-selection="true">
              {pinnedSelection}
            </div>
          ) : null}
          {hasMore ? (
            <button
              ref={loadMoreRef}
              type="button"
              onClick={showNextBatch}
              aria-label={resolvedLoadMoreLabel || undefined}
              className={resolvedClassNames.loadMore}
            >
              +{nextBatchSize}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

export function SitesRegistryFavicon({
  domain,
  size = 28,
  className = '',
  imgClassName = '',
  deferUntilVisible = true,
}) {
  const containerRef = useRef(null);
  const [loadedDomain, setLoadedDomain] = useState(() => (
    deferUntilVisible ? null : domain
  ));
  const shouldLoad = !deferUntilVisible || loadedDomain === domain;

  useEffect(() => {
    if (!deferUntilVisible || shouldLoad) return undefined;
    const target = containerRef.current;
    if (!target || typeof globalThis.IntersectionObserver !== 'function') {
      setLoadedDomain(domain);
      return undefined;
    }
    return observeFaviconEnrichment(target, () => setLoadedDomain(domain));
  }, [deferUntilVisible, domain, shouldLoad]);

  if (!shouldLoad) {
    const label = String(domain || '').trim();
    return (
      <span
        ref={containerRef}
        aria-hidden="true"
        data-sites-favicon-enrichment="pending"
        className={joinClassNames(
          'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-surface-sunken/45 text-[10px] font-bold uppercase text-on-surface-muted/55',
          className,
        )}
        style={{ width: size, height: size }}
      >
        {label ? label[0] : '?'}
      </span>
    );
  }

  return (
    <Favicon
      domain={domain}
      size={size}
      className={joinClassNames(className)}
      imgClassName={imgClassName}
    />
  );
}

export function SitesRegistryRow({
  domain,
  primary = null,
  secondary = null,
  value = null,
  selected = false,
  onSelect,
  leading = null,
  trailing = null,
  endAdornment = null,
  comparison = null,
  usageRatio = null,
  faviconSize = 32,
  classNames = {},
}) {
  const resolvedClassNames = { ...DEFAULT_ROW_CLASS_NAMES, ...classNames };
  const primaryContent = primary || domain;
  const hasValue = value !== null && value !== undefined && value !== '';

  return (
    <div
      className={joinClassNames(
        resolvedClassNames.container,
        selected ? resolvedClassNames.selected : resolvedClassNames.idle
      )}
    >
      {usageRatio > 0 && <span aria-hidden="true" className="sites-registry-row__usage-fill" style={{ width: `${Math.min(1, usageRatio) * 100}%` }} />}
      <button
        type="button"
        onClick={() => onSelect?.()}
        aria-current={selected ? 'true' : undefined}
        aria-controls="sites-site-detail"
        title={domain}
        className={joinClassNames(
          resolvedClassNames.button,
          onSelect ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        <span
          className={joinClassNames(
            'sites-registry-row__accent absolute inset-y-0 left-0 w-[2px]',
            selected ? resolvedClassNames.accent : resolvedClassNames.accentIdle
          )}
        />
        {leading || (
          <SitesRegistryFavicon
            domain={domain}
            size={faviconSize}
            className={resolvedClassNames.avatarFrame}
            imgClassName={resolvedClassNames.avatar}
          />
        )}
        <div className="sites-registry-row__identity min-w-0">
          <div className={resolvedClassNames.primary}>{primaryContent}</div>
          {(secondary || hasValue) && <div className="sites-registry-row__meta">
            {hasValue && <span className={resolvedClassNames.value}>{value}</span>}
            {secondary && <span className={resolvedClassNames.secondary}>{secondary}</span>}
          </div>}
        </div>
        {comparison}
        {trailing}
        {endAdornment}
      </button>
    </div>
  );
}
