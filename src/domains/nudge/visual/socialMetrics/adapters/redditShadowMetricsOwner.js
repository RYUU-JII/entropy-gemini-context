import { SOCIAL_METRIC_ATTRS } from '../../../core/constants.js';
import { removeAttribute } from '../../FastStyleEngine.js';
import {
  REDDIT_SEMANTIC_MUTATION_ATTRIBUTES,
} from './redditSemanticMutationAttributes.js';

export const REDDIT_SHADOW_METRICS_STYLE_ATTR =
  'data-friction-reddit-social-metrics-shadow-style';

const REDDIT_SHADOW_HOST_SELECTOR = 'shreddit-post';
const REDDIT_SHADOW_ROOT_LIMIT = 24;
const REDDIT_SHADOW_SCAN_DEBOUNCE_MS = 100;
const REDDIT_SHADOW_METRICS_STYLE = `
[${SOCIAL_METRIC_ATTRS.ENGAGEMENT}="1"] {
  visibility: hidden !important;
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  text-shadow: none !important;
  pointer-events: none !important;
  user-select: none !important;
}
`.trim();

function createLifecycleError(message, errors) {
  const normalizedErrors = Array.isArray(errors) ? errors.filter(Boolean) : [];
  const AggregateErrorCtor = globalThis?.AggregateError;
  if (typeof AggregateErrorCtor === 'function') {
    return new AggregateErrorCtor(normalizedErrors, message);
  }
  const error = new Error(message);
  error.errors = normalizedErrors;
  if (normalizedErrors[0]) error.cause = normalizedErrors[0];
  return error;
}

function createShadowStyle(root) {
  const existing = root.querySelector?.(`style[${REDDIT_SHADOW_METRICS_STYLE_ATTR}]`);
  if (existing instanceof Element) return existing;

  const style = document.createElement('style');
  style.setAttribute(REDDIT_SHADOW_METRICS_STYLE_ATTR, '1');
  style.textContent = REDDIT_SHADOW_METRICS_STYLE;
  root.prepend(style);
  return style;
}

function clearShadowMetricMarks(root) {
  root.querySelectorAll?.(`[${SOCIAL_METRIC_ATTRS.ENGAGEMENT}]`).forEach((element) => {
    removeAttribute(element, SOCIAL_METRIC_ATTRS.ENGAGEMENT);
  });
}

function isLiveEntry(host, entry) {
  return host instanceof Element
    && host.isConnected
    && host.shadowRoot === entry?.root;
}

export function isManagedRedditShadowRoot(root) {
  return !!root?.querySelector?.(`style[${REDDIT_SHADOW_METRICS_STYLE_ATTR}]`);
}

export function createRedditShadowMetricsOwner({
  onDirtyRoots,
  onFailure = null,
} = {}) {
  if (typeof onDirtyRoots !== 'function') {
    throw new Error('REDDIT_SHADOW_METRICS_DIRTY_ROOT_HANDLER_REQUIRED');
  }
  if (onFailure !== null && typeof onFailure !== 'function') {
    throw new Error('REDDIT_SHADOW_METRICS_FAILURE_HANDLER_INVALID');
  }

  const entries = new Map();
  const pendingHosts = new Set();
  let scanTimer = null;

  const reportFailure = (phase, error, details = {}) => {
    onFailure?.(phase, error, details);
  };

  const flushDirtyRoots = () => {
    scanTimer = null;
    const roots = Array.from(pendingHosts).filter((host) => (
      isLiveEntry(host, entries.get(host))
    ));
    pendingHosts.clear();
    if (roots.length === 0) return;
    try {
      onDirtyRoots(roots);
    } catch (error) {
      reportFailure('shadow_dirty_scan_schedule', error, {
        rootCount: roots.length,
      });
    }
  };

  const scheduleDirtyRoot = (host) => {
    if (!isLiveEntry(host, entries.get(host))) return;
    pendingHosts.add(host);
    if (scanTimer !== null) return;
    scanTimer = setTimeout(flushDirtyRoots, REDDIT_SHADOW_SCAN_DEBOUNCE_MS);
  };

  const releaseEntry = (host, entry) => {
    const errors = [];
    try {
      entry.observer.disconnect();
    } catch (error) {
      errors.push(error);
    }
    try {
      clearShadowMetricMarks(entry.root);
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 0) {
      try {
        entry.style?.remove();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 0) {
      pendingHosts.delete(host);
      entries.delete(host);
      return;
    }
    throw createLifecycleError('REDDIT_SHADOW_METRICS_ENTRY_RELEASE_FAILED', errors);
  };

  const ensureEntryStyle = (host, entry) => {
    if (entry.style?.parentNode === entry.root) return;
    try {
      entry.style = createShadowStyle(entry.root);
    } catch (error) {
      reportFailure('shadow_style_restore', error, {
        hostConnected: host.isConnected === true,
      });
      throw error;
    }
  };

  const registerHost = (host) => {
    if (!(host instanceof Element) || !host.isConnected) return false;
    const root = host.shadowRoot;
    if (!root || entries.has(host)) return false;
    if (typeof MutationObserver !== 'function') {
      throw new Error('REDDIT_SHADOW_METRICS_OBSERVER_UNAVAILABLE');
    }

    const style = createShadowStyle(root);
    const entry = {
      root,
      style,
      observer: null,
    };
    const observer = new MutationObserver(() => {
      try {
        ensureEntryStyle(host, entry);
        scheduleDirtyRoot(host);
      } catch (_) {
        // ensureEntryStyle records the diagnosed failure.
      }
    });
    entry.observer = observer;
    try {
      observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: REDDIT_SEMANTIC_MUTATION_ATTRIBUTES,
      });
      entries.set(host, entry);
      return true;
    } catch (error) {
      try {
        observer.disconnect();
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      try {
        style.remove();
      } catch (cleanupError) {
        if (error && typeof error === 'object' && !error.cleanupError) {
          error.cleanupError = cleanupError;
        }
      }
      throw error;
    }
  };

  const reconcile = () => {
    const errors = [];
    entries.forEach((entry, host) => {
      if (isLiveEntry(host, entry)) return;
      try {
        releaseEntry(host, entry);
      } catch (error) {
        errors.push(error);
        reportFailure('detached_shadow_release', error);
      }
    });

    const availableSlots = Math.max(0, REDDIT_SHADOW_ROOT_LIMIT - entries.size);
    if (availableSlots > 0) {
      const hosts = Array.from(document.querySelectorAll(REDDIT_SHADOW_HOST_SELECTOR));
      let registered = 0;
      for (const host of hosts) {
        if (registered >= availableSlots) break;
        if (entries.has(host) || !host.shadowRoot) continue;
        try {
          if (registerHost(host)) registered += 1;
        } catch (error) {
          errors.push(error);
          reportFailure('shadow_observer_register', error, {
            hostConnected: host.isConnected === true,
          });
        }
      }
    }

    if (errors.length > 0) {
      throw createLifecycleError('REDDIT_SHADOW_METRICS_RECONCILE_FAILED', errors);
    }
    return entries.size;
  };

  const teardown = () => {
    const errors = [];
    if (scanTimer !== null) {
      try {
        clearTimeout(scanTimer);
        scanTimer = null;
      } catch (error) {
        errors.push(error);
      }
    }
    pendingHosts.clear();
    entries.forEach((entry, host) => {
      try {
        releaseEntry(host, entry);
      } catch (error) {
        errors.push(error);
        reportFailure('shadow_owner_teardown', error);
      }
    });
    if (errors.length > 0) {
      throw createLifecycleError('REDDIT_SHADOW_METRICS_TEARDOWN_FAILED', errors);
    }
  };

  return Object.freeze({
    reconcile,
    teardown,
    getObservedRootCount: () => entries.size,
  });
}

export default createRedditShadowMetricsOwner;
