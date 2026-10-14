import { buildRootVisualFilterValue } from '../../settings/config/index.js';
import { recordProtectionFeatureError } from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import { suppressPrepaintVisualEffects } from '../../protection/content/prepaintVisualRuntime.js';

const ROOT_FILTER_PRELOAD_STATE_KEY = '__entropyRootFilterPreloadState__';

function reportRootFilterFailure(phase, error) {
  const diagnostic = {
    phase,
    error: String(error?.message || error || 'ROOT_FILTER_RUNTIME_FAILURE'),
  };
  recordProtectionFeatureError('visualManager', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[VisualManager] root filter failure', diagnostic);
  }
}

export function buildRootFilter(filters) {
  return buildRootVisualFilterValue(filters);
}

export function readRootFilterPreloadState() {
  try {
    return globalThis[ROOT_FILTER_PRELOAD_STATE_KEY] || window[ROOT_FILTER_PRELOAD_STATE_KEY] || null;
  } catch (error) {
    reportRootFilterFailure('root_filter_preload_state_read', error);
    return null;
  }
}

export function writeRootFilterPreloadState(nextState) {
  let wrote = false;
  try {
    globalThis[ROOT_FILTER_PRELOAD_STATE_KEY] = nextState;
    wrote = true;
  } catch (error) {
    reportRootFilterFailure('root_filter_preload_state_global_write', error);
  }
  try {
    window[ROOT_FILTER_PRELOAD_STATE_KEY] = nextState;
    wrote = true;
  } catch (error) {
    reportRootFilterFailure('root_filter_preload_state_window_write', error);
  }
  if (!wrote) {
    reportRootFilterFailure(
      'root_filter_preload_state_write',
      new Error('ROOT_FILTER_PRELOAD_STATE_WRITE_FAILED'),
    );
  }
  return nextState;
}

export function clearRootFilterPreloadState() {
  writeRootFilterPreloadState(null);
}

export function ensureRootFilterObserver(manager) {
  if (manager._rootFilterObserver || typeof MutationObserver === 'undefined') return;
  const root = document.documentElement;
  if (!root) return;

  manager._rootFilterObserver = new MutationObserver(() => {
    reconcileRootFilter(manager);
  });
  manager._rootFilterObserver.observe(root, {
    attributes: true,
    attributeFilter: ['style'],
  });
}

export function releaseRootFilterObserver(manager) {
  if (!manager._rootFilterObserver) return;
  manager._rootFilterObserver.disconnect();
  manager._rootFilterObserver = null;
}

export function composeRootFilter(baseFilter, rootFilter) {
  return [baseFilter, rootFilter].filter(Boolean).join(' ');
}

export function stripManagedRootFilter(baseFilter, rootFilter = '') {
  if (!baseFilter || !rootFilter) return baseFilter;
  if (baseFilter === rootFilter) return '';

  const suffix = ` ${rootFilter}`;
  if (!baseFilter.endsWith(suffix)) return baseFilter;
  return baseFilter.slice(0, -suffix.length).trim();
}

export function ensureRootFilterCache(manager) {
  if (manager._rootFilterCache) return manager._rootFilterCache;
  const root = document.documentElement;
  if (!root) return null;

  const preloadState = readRootFilterPreloadState();
  let inlineValue = root.style.getPropertyValue('filter');
  let inlinePriority = root.style.getPropertyPriority('filter');
  let hasInline = inlineValue !== '' || inlinePriority !== '';
  const computed = window.getComputedStyle(root)?.filter || 'none';
  let baseFilter = computed === 'none' ? '' : computed;
  let applied = '';

  if (preloadState?.active && preloadState.rootFilter) {
    baseFilter = stripManagedRootFilter(baseFilter, preloadState.rootFilter);
    if (inlineValue === preloadState.applied && inlinePriority === 'important') {
      inlineValue = typeof preloadState.inlineValue === 'string' ? preloadState.inlineValue : '';
      inlinePriority = typeof preloadState.inlinePriority === 'string' ? preloadState.inlinePriority : '';
      hasInline = preloadState.hasInline === true;
    }
    if (typeof preloadState.applied === 'string' && preloadState.applied) {
      applied = preloadState.applied;
    }
  } else if (manager._currentRootFilter) {
    baseFilter = stripManagedRootFilter(baseFilter, manager._currentRootFilter);
  }

  manager._rootFilterCache = {
    baseFilter,
    inlineValue,
    inlinePriority,
    hasInline,
    applied,
  };

  return manager._rootFilterCache;
}

export function reconcileRootFilter(manager) {
  if (!manager._currentRootFilter) return;

  const root = document.documentElement;
  if (!root) return;

  const cached = manager._rootFilterCache;
  const currentInline = root.style.getPropertyValue('filter');
  const currentPriority = root.style.getPropertyPriority('filter');
  if (cached && currentInline === cached.applied && currentPriority === 'important') {
    return;
  }

  const computed = window.getComputedStyle(root)?.filter || 'none';
  const baseFilter = stripManagedRootFilter(computed === 'none' ? '' : computed, manager._currentRootFilter);
  const combined = composeRootFilter(baseFilter, manager._currentRootFilter);

  if (cached) {
    cached.inlineValue = stripManagedRootFilter(currentInline, manager._currentRootFilter);
    cached.inlinePriority = currentPriority;
    cached.hasInline = cached.inlineValue !== '';
    cached.baseFilter = baseFilter;
    cached.applied = combined;
  }

  if (combined) {
    root.style.setProperty('filter', combined, 'important');
  } else {
    root.style.removeProperty('filter');
  }
}

export function applyRootFilter(manager, rootFilter) {
  if (!rootFilter) {
    if (!manager._rootFilterCache && readRootFilterPreloadState()?.active) {
      ensureRootFilterCache(manager);
    }
    restoreRootFilter(manager);
    return;
  }

  const root = document.documentElement;
  if (!root) return;

  // Runtime application is also a valid prepaint handoff owner. This covers an
  // early-runtime snapshot that is available even when the compact root-visual
  // reader could not establish preload state, without adopting the prepaint CSS
  // tier as page-owned computed style.
  suppressPrepaintVisualEffects(root);
  // A policy update can run before the root-style observer receives a page write.
  if (manager._rootFilterCache && manager._currentRootFilter) {
    const cached = manager._rootFilterCache;
    const currentInline = root.style.getPropertyValue('filter');
    const currentPriority = root.style.getPropertyPriority('filter');
    if (currentInline !== cached.applied || currentPriority !== 'important') {
      cached.inlineValue = stripManagedRootFilter(currentInline, manager._currentRootFilter);
      cached.inlinePriority = currentPriority;
      cached.hasInline = cached.inlineValue !== '';
      const computed = window.getComputedStyle(root)?.filter || 'none';
      cached.baseFilter = stripManagedRootFilter(computed === 'none' ? '' : computed, manager._currentRootFilter);
    }
  }
  const cached = ensureRootFilterCache(manager);
  if (!cached) return;

  const strippedBaseFilter = stripManagedRootFilter(cached.baseFilter, rootFilter);
  const combined = composeRootFilter(strippedBaseFilter, rootFilter);
  const currentInline = root.style.getPropertyValue('filter');
  const currentPriority = root.style.getPropertyPriority('filter');
  if (
    (manager._currentRootFilter === rootFilter || currentInline === combined || cached.applied === combined)
    && currentInline === combined
    && currentPriority === 'important'
  ) {
    cached.baseFilter = strippedBaseFilter;
    cached.applied = combined;
    manager._currentRootFilter = rootFilter;
    clearRootFilterPreloadState();
    ensureRootFilterObserver(manager);
    return;
  }

  cached.baseFilter = strippedBaseFilter;
  cached.applied = combined;
  manager._currentRootFilter = rootFilter;
  root.style.setProperty('filter', combined, 'important');
  clearRootFilterPreloadState();
  ensureRootFilterObserver(manager);
}

export function restoreRootFilter(manager) {
  const root = document.documentElement;
  const preloadState = readRootFilterPreloadState();
  if (!manager._rootFilterCache && preloadState?.active) {
    ensureRootFilterCache(manager);
  }
  const cached = manager._rootFilterCache;

  // The page may have changed its filter before the observer's microtask runs.
  // Restore the latest page-owned value, never a stale entry snapshot.
  if (root && cached) {
    const currentInline = root.style.getPropertyValue('filter');
    const currentPriority = root.style.getPropertyPriority('filter');
    if (currentInline !== cached.applied || currentPriority !== 'important') {
      const managedFilter = manager._currentRootFilter || (preloadState?.active ? preloadState.rootFilter : '');
      cached.inlineValue = stripManagedRootFilter(currentInline, managedFilter);
      cached.inlinePriority = currentPriority;
      cached.hasInline = cached.inlineValue !== '';
    }
  }

  manager._currentRootFilter = '';
  releaseRootFilterObserver(manager);

  if (!root || !cached) {
    clearRootFilterPreloadState();
    manager._rootFilterCache = null;
    return;
  }

  if (cached.hasInline) {
    root.style.setProperty('filter', cached.inlineValue, cached.inlinePriority || '');
  } else {
    root.style.removeProperty('filter');
  }

  clearRootFilterPreloadState();
  manager._rootFilterCache = null;
}
