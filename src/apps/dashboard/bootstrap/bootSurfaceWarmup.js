import { DEFAULT_THEME_ID, normalizeThemeId } from '@/themes/core/ids.js';
import { preloadThemeWidgetChunk } from '@/themes/core/registry/index.js';
import {
  getDashboardTabDeferredThemeWidgetTypes,
  getDashboardTabBootDataPreloadEntries,
  getDashboardBootPreloadTabIds,
  getDashboardTabThemeWidgetTypes,
  resolveDashboardTabWidgetThemeId,
  shouldDashboardTabPreloadOnRoute,
} from '../tabs/registry.js';
import {
  BOOT_SURFACE_DEFERRED_IDLE_TIMEOUT_MS,
  BOOT_SURFACE_DEFERRED_TIMEOUT_MS,
  BOOT_SURFACE_INTERACTIVE_TIMEOUT_MS,
  BOOT_SURFACE_WARMUP_TIMEOUT_MS,
} from './bootConfig.js';
import { buildDashboardWarmupContext } from './dashboardLaunchContext.js';
import {
  preloadDashboardTabBoot,
  preloadDashboardTabModule,
} from '../loading/preloadDashboardTab.js';
import { throwIfDashboardPreloadAborted } from '../loading/dashboardPreloadAdmission.js';

const DEFAULT_WARMUP_TIMEOUT_MS = BOOT_SURFACE_WARMUP_TIMEOUT_MS;
const DEFAULT_INTERACTIVE_TIMEOUT_MS = BOOT_SURFACE_INTERACTIVE_TIMEOUT_MS;
const DEFAULT_DEFERRED_TIMEOUT_MS = BOOT_SURFACE_DEFERRED_TIMEOUT_MS;
const INTERACTIVE_WARMUP_CONCURRENCY = 1;
const DEFERRED_WARMUP_CONCURRENCY = 1;
const CRITICAL_WARMUP_CONCURRENCY = 16;
const BOOT_VISUAL_TAB_ID = 'main';

const SURFACE_PRELOADERS = Object.freeze({
  dashboard_layout: () => import('../layout/DashboardLayout.jsx'),
});

const preloadCache = new Map();

const nowMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const toFixedMs = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const runCachedPreload = (key, loader) => {
  if (preloadCache.has(key)) {
    return preloadCache.get(key);
  }
  const promise = Promise.resolve()
    .then(() => loader())
    .catch((error) => {
      preloadCache.delete(key);
      throw error;
    });
  preloadCache.set(key, promise);
  return promise;
};

const normalizeTimeoutMs = (timeoutMs) => Math.max(0, Math.floor(Number(timeoutMs) || 0));

const resolveAbortReason = (signal) => {
  const reason = signal?.reason;
  if (typeof reason === 'string' && reason.trim()) return reason.trim();
  if (reason instanceof Error && reason.message) return reason.message;
  return signal?.aborted ? 'aborted' : null;
};

const waitForIdleSlot = ({
  deadlineMs = Number.POSITIVE_INFINITY,
  signal = null,
  timeoutMs = BOOT_SURFACE_DEFERRED_IDLE_TIMEOUT_MS,
} = {}) => new Promise((resolve) => {
  if (signal?.aborted) {
    resolve({ cancelled: true, timedOut: false });
    return;
  }

  const remainingMs = Number.isFinite(deadlineMs)
    ? Math.max(0, deadlineMs - nowMs())
    : Number.POSITIVE_INFINITY;
  if (remainingMs <= 0) {
    resolve({ cancelled: false, timedOut: true });
    return;
  }

  const safeIdleTimeoutMs = Math.max(
    1,
    Math.min(normalizeTimeoutMs(timeoutMs) || 1, remainingMs),
  );
  let idleCallbackId = 0;
  let fallbackTimeoutId = 0;
  let deadlineTimeoutId = 0;
  let settled = false;

  const cleanup = () => {
    if (
      idleCallbackId
      && typeof window !== 'undefined'
      && typeof window.cancelIdleCallback === 'function'
    ) {
      window.cancelIdleCallback(idleCallbackId);
    }
    if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
    if (deadlineTimeoutId) clearTimeout(deadlineTimeoutId);
    signal?.removeEventListener?.('abort', handleAbort);
  };
  const finish = (result) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolve(result);
  };
  const handleAbort = () => finish({ cancelled: true, timedOut: false });
  signal?.addEventListener?.('abort', handleAbort, { once: true });

  if (Number.isFinite(remainingMs)) {
    deadlineTimeoutId = setTimeout(
      () => finish({ cancelled: false, timedOut: true }),
      remainingMs,
    );
  }
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    idleCallbackId = window.requestIdleCallback(
      () => finish({ cancelled: false, timedOut: false }),
      { timeout: safeIdleTimeoutMs },
    );
    return;
  }
  fallbackTimeoutId = setTimeout(
    () => finish({ cancelled: false, timedOut: false }),
    Math.min(24, safeIdleTimeoutMs),
  );
});

const buildWarmupContext = () => buildDashboardWarmupContext({
  fallbackThemeId: DEFAULT_THEME_ID,
});

const resolveCriticalWidgetTargets = (themeId, targetTabId) => {
  const widgetTargets = [];

  if (shouldDashboardTabPreloadOnRoute(targetTabId)) {
    widgetTargets.push(...getDashboardTabThemeWidgetTypes(targetTabId, { themeId }));
  }

  return [...new Set(widgetTargets)];
};

const buildCriticalWarmupEntries = ({ targetThemeId }) => {
  const entries = [];
  entries.push(
    {
      key: 'dashboard_layout',
      run: () => runCachedPreload('dashboard_layout', SURFACE_PRELOADERS.dashboard_layout),
    },
    {
      key: `tab:${BOOT_VISUAL_TAB_ID}`,
      run: () => runCachedPreload(
        `tab:${BOOT_VISUAL_TAB_ID}`,
        () => preloadDashboardTabModule(BOOT_VISUAL_TAB_ID, { source: 'boot' }),
      ),
    },
  );

  resolveCriticalWidgetTargets(targetThemeId, BOOT_VISUAL_TAB_ID).forEach((widgetType) => {
    const widgetThemeId = normalizeThemeId(
      resolveDashboardTabWidgetThemeId(BOOT_VISUAL_TAB_ID, targetThemeId),
      targetThemeId,
    );
    const widgetKey = `widget:${widgetThemeId}:${widgetType}`;
    entries.push({
      key: widgetKey,
      run: () => runCachedPreload(
        widgetKey,
        () => preloadThemeWidgetChunk(widgetThemeId, widgetType),
      ),
    });
  });
  return entries;
};

const orderWarmupTabIds = (tabIds, targetTabId) => {
  const uniqueTabIds = [...new Set(
    (Array.isArray(tabIds) ? tabIds : [])
      .filter((tabId) => typeof tabId === 'string' && tabId && tabId !== BOOT_VISUAL_TAB_ID),
  )];
  if (!uniqueTabIds.includes(targetTabId)) return uniqueTabIds;
  return [targetTabId, ...uniqueTabIds.filter((tabId) => tabId !== targetTabId)];
};

const buildInteractiveWarmupEntries = ({ targetTabId, targetThemeId }) => (
  orderWarmupTabIds(getDashboardBootPreloadTabIds(), targetTabId).map((tabId) => ({
    key: `tab-group:${tabId}`,
    run: ({ signal }) => preloadDashboardTabBoot({
      tabId,
      themeId: targetThemeId,
      signal,
    }),
  }))
);

const buildDeferredWarmupEntries = ({
  targetTabId,
  targetTabParams,
  targetThemeId,
}) => {
  const entries = [];
  const entryKeys = new Set();
  const pushEntry = (key, run) => {
    if (!key || typeof run !== 'function') return;
    if (entryKeys.has(key)) return;
    entryKeys.add(key);
    entries.push({ key, run });
  };
  const pushWidgetEntries = (tabId, widgetTypes) => {
    widgetTypes.forEach((widgetType) => {
      const widgetThemeId = normalizeThemeId(
        resolveDashboardTabWidgetThemeId(tabId, targetThemeId),
        targetThemeId,
      );
      const widgetKey = `widget:${widgetThemeId}:${widgetType}`;
      pushEntry(widgetKey, () => runCachedPreload(
        widgetKey,
        () => preloadThemeWidgetChunk(widgetThemeId, widgetType),
      ));
    });
  };

  const warmupTabIds = orderWarmupTabIds(getDashboardBootPreloadTabIds(), targetTabId);
  warmupTabIds.forEach((tabId) => {
    const dataPreloadContext = {
      preferredDomain: tabId === targetTabId
        ? targetTabParams?.domain || null
        : null,
    };
    getDashboardTabBootDataPreloadEntries(tabId, dataPreloadContext)
      .forEach(({ id, run }) => {
        pushEntry(`data:${tabId}:${id}`, run);
      });
  });
  warmupTabIds.forEach((tabId) => {
    pushWidgetEntries(
      tabId,
      getDashboardTabDeferredThemeWidgetTypes(tabId, { themeId: targetThemeId }),
    );
  });

  return entries;
};

const settleWarmupEntry = ({ entry, deadlineMs, signal }) => {
  if (signal?.aborted) {
    return Promise.resolve({ type: 'cancelled', rejected: false });
  }
  if (Number.isFinite(deadlineMs) && nowMs() >= deadlineMs) {
    return Promise.resolve({ type: 'timeout', rejected: false });
  }
  const entryAbortController = new AbortController();
  const entryOutcome = Promise.resolve()
    .then(() => {
      throwIfDashboardPreloadAborted(entryAbortController.signal);
      return entry.run({ deadlineMs, signal: entryAbortController.signal });
    })
    .then(
      () => ({ type: 'settled', rejected: false }),
      () => ({ type: 'settled', rejected: true }),
    );

  if (!Number.isFinite(deadlineMs) && !signal) {
    return entryOutcome;
  }

  return new Promise((resolve) => {
    let timeoutId = 0;
    let settled = false;
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      signal?.removeEventListener?.('abort', handleAbort);
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const abortEntry = (reason) => {
      if (!entryAbortController.signal.aborted) {
        entryAbortController.abort(reason);
      }
    };
    const handleAbort = () => {
      abortEntry(resolveAbortReason(signal) || 'warmup_generation_cancelled');
      finish({ type: 'cancelled', rejected: false });
    };

    if (signal?.aborted) {
      abortEntry(resolveAbortReason(signal) || 'warmup_generation_cancelled');
      finish({ type: 'cancelled', rejected: false });
      return;
    }
    signal?.addEventListener?.('abort', handleAbort, { once: true });
    if (Number.isFinite(deadlineMs)) {
      const remainingMs = Math.max(0, deadlineMs - nowMs());
      if (remainingMs <= 0) {
        abortEntry('warmup_deadline_exceeded');
        finish({ type: 'timeout', rejected: false });
        return;
      }
      timeoutId = setTimeout(
        () => {
          abortEntry('warmup_deadline_exceeded');
          finish({ type: 'timeout', rejected: false });
        },
        remainingMs,
      );
    }
    entryOutcome.then(finish);
  });
};

const settleWarmupEntries = async ({
  entries,
  deadlineMs,
  concurrency,
  admitEntry = null,
  signal = null,
} = {}) => {
  let nextIndex = 0;
  let admittedCount = 0;
  let settledCount = 0;
  let rejectedCount = 0;
  let timedOut = false;
  let cancelled = false;
  const safeEntries = Array.isArray(entries) ? entries : [];
  const workerCount = Math.min(
    safeEntries.length,
    Math.max(1, Math.floor(Number(concurrency) || 1)),
  );

  const runWorker = async () => {
    while (nextIndex < safeEntries.length) {
      if (signal?.aborted) {
        cancelled = true;
        return;
      }
      if (nowMs() >= deadlineMs) {
        timedOut = true;
        return;
      }
      if (admitEntry) {
        const admission = await admitEntry({ deadlineMs, signal });
        if (admission.cancelled || admission.timedOut) {
          cancelled = admission.cancelled;
          timedOut = admission.timedOut;
          return;
        }
      }
      const entry = safeEntries[nextIndex];
      nextIndex += 1;
      admittedCount += 1;
      const outcome = await settleWarmupEntry({ entry, deadlineMs, signal });
      if (outcome.type === 'cancelled') {
        cancelled = true;
        return;
      }
      if (outcome.type === 'timeout') {
        timedOut = true;
        return;
      }
      settledCount += 1;
      if (outcome.rejected) rejectedCount += 1;
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  const pendingCount = Math.max(0, admittedCount - settledCount);
  const skippedCount = Math.max(0, safeEntries.length - admittedCount);
  if (
    !cancelled
    && Number.isFinite(deadlineMs)
    && nowMs() >= deadlineMs
    && (pendingCount > 0 || skippedCount > 0)
  ) {
    timedOut = true;
  }
  return {
    admittedCount,
    cancelled,
    cancelReason: cancelled ? resolveAbortReason(signal) : null,
    pendingCount,
    settledCount,
    rejectedCount,
    skippedCount,
    timedOut,
  };
};

export async function warmupDashboardSurface({
  signal = null,
  timeoutMs = DEFAULT_WARMUP_TIMEOUT_MS,
} = {}) {
  const startedAt = nowMs();
  const {
    targetTabId,
    targetThemeId,
  } = buildWarmupContext();
  const entries = buildCriticalWarmupEntries({ targetThemeId });
  const scheduled = entries.map((entry) => entry.key);
  const safeTimeoutMs = normalizeTimeoutMs(timeoutMs);
  const deadlineMs = safeTimeoutMs > 0
    ? startedAt + safeTimeoutMs
    : Number.POSITIVE_INFINITY;
  const result = await settleWarmupEntries({
    entries,
    deadlineMs,
    concurrency: CRITICAL_WARMUP_CONCURRENCY,
    signal,
  });

  return {
    targetTabId,
    targetThemeId,
    timeoutMs: safeTimeoutMs,
    ...result,
    scheduledCount: scheduled.length,
    scheduled,
    elapsedMs: toFixedMs(nowMs() - startedAt),
  };
}

export async function warmupDashboardSurfaceInteractive({
  admitEntry = waitForIdleSlot,
  signal = null,
  timeoutMs = DEFAULT_INTERACTIVE_TIMEOUT_MS,
} = {}) {
  const startedAt = nowMs();
  const {
    targetTabId,
    targetThemeId,
  } = buildWarmupContext();
  const entries = buildInteractiveWarmupEntries({ targetTabId, targetThemeId });
  const scheduled = entries.map((entry) => entry.key);
  const safeTimeoutMs = normalizeTimeoutMs(timeoutMs);
  const deadlineMs = safeTimeoutMs > 0 ? (startedAt + safeTimeoutMs) : Number.POSITIVE_INFINITY;

  const result = await settleWarmupEntries({
      admitEntry,
      entries,
      deadlineMs,
      concurrency: INTERACTIVE_WARMUP_CONCURRENCY,
      signal,
    });

  return {
    targetTabId,
    targetThemeId,
    timeoutMs: safeTimeoutMs,
    ...result,
    scheduledCount: scheduled.length,
    scheduled,
    elapsedMs: toFixedMs(nowMs() - startedAt),
  };
}

export async function warmupDashboardSurfaceDeferred({
  admitEntry = waitForIdleSlot,
  signal = null,
  timeoutMs = DEFAULT_DEFERRED_TIMEOUT_MS,
} = {}) {
  const startedAt = nowMs();
  const {
    targetTabId,
    targetTabParams,
    targetThemeId,
  } = buildWarmupContext();
  const entries = buildDeferredWarmupEntries({
    targetTabId,
    targetTabParams,
    targetThemeId,
  });
  const scheduled = entries.map((entry) => entry.key);
  const safeTimeoutMs = normalizeTimeoutMs(timeoutMs);
  const deadlineMs = safeTimeoutMs > 0 ? (startedAt + safeTimeoutMs) : Number.POSITIVE_INFINITY;
  const result = await settleWarmupEntries({
      admitEntry,
      entries,
      deadlineMs,
      concurrency: DEFERRED_WARMUP_CONCURRENCY,
      signal,
    });

  return {
    targetTabId,
    targetThemeId,
    timeoutMs: safeTimeoutMs,
    ...result,
    scheduledCount: scheduled.length,
    scheduled,
    elapsedMs: toFixedMs(nowMs() - startedAt),
  };
}
