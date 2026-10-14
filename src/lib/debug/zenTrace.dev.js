const ZEN_TRACE_CONFIG_KEY = 'entropy_debug_zen_render_trace_config';
const ZEN_TRACE_HISTORY_KEY = 'entropy_debug_zen_render_trace_history';
const ZEN_TRACE_GLOBAL_KEY = '__ENTROPY_ZEN_RENDER_TRACE__';
const ZEN_TRACE_DEFAULT_TTL_MS = 5 * 60 * 1000;
// A complete initial model request adds bounded phase/transport receipts to
// the existing boot trace. Keep its start until the first UI commit is read.
const ZEN_TRACE_MAX_EVENTS = 512;
const ZEN_TRACE_MAX_OBJECT_KEYS = 32;
const ZEN_TRACE_MAX_ARRAY_ITEMS = 32;
const ZEN_TRACE_MAX_STRING_LENGTH = 480;
const ZEN_TRACE_MAX_SIGNATURE_LENGTH = 180;
const ZEN_TRACE_TERMINAL_FLUSH_DELAY_MS = 120;
const ZEN_TRACE_TERMINAL_DISABLE_DELAY_MS = 1800;
const ZEN_TRACE_MODE = Object.freeze({
  FULL: 'full',
  MARKS: 'marks',
});
const ZEN_TRACE_MODE_SET = new Set(Object.values(ZEN_TRACE_MODE));

const ZEN_TRACE_TERMINAL_EVENTS = new Set([
  'boot_manager:dismissible',
  'boot_manager:failed',
  'boot_shell:fade_start',
  'boot_shell:hard_timeout_fail_open',
  'boot_shell:report_dismissed',
]);

const isZenTraceBuildEnabled = () => true;

let tracePageId = '';
let tracePageStartPerfAt = 0;
let activeTraceConfig = null;
let traceConfigLoaded = false;
let traceHistoryCache = [];
let traceHistoryLoaded = false;
let traceHistoryDirty = false;
let traceHistoryFlushTimerId = 0;
let traceDisableTimerId = 0;

const getTracePageId = () => {
  if (!tracePageId) {
    tracePageId = `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return tracePageId;
};

const getTracePageStartPerfAt = () => {
  if (!tracePageStartPerfAt) {
    tracePageStartPerfAt = nowPerfMs();
  }
  return tracePageStartPerfAt;
};

const getGlobal = () => (
  typeof globalThis !== 'undefined' ? globalThis : null
);

const nowWallMs = () => Date.now();

const nowPerfMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const getStorage = () => {
  const globalRef = getGlobal();
  const storage = globalRef?.localStorage;
  if (!storage) return null;
  try {
    const probeKey = '__entropy_zen_trace_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch (_) {
    return null;
  }
};

const readJson = (key, fallbackValue) => {
  const storage = getStorage();
  if (!storage) return fallbackValue;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallbackValue;
    return JSON.parse(raw);
  } catch (_) {
    return fallbackValue;
  }
};

const writeJson = (key, value) => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
};

const removeStored = (key) => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch (_) {
    return false;
  }
};

const createSessionId = () => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `zen-render-${Date.now().toString(36)}-${randomPart}`;
};

const normalizeTraceMode = (value, fallback = ZEN_TRACE_MODE.FULL) => {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!candidate) return fallback;
  return ZEN_TRACE_MODE_SET.has(candidate) ? candidate : null;
};

const normalizeConfig = (config) => {
  if (!config || typeof config !== 'object') return null;
  const enabled = config.enabled === true;
  const expiresAt = Number(config.expiresAt) || 0;
  if (!enabled || (expiresAt > 0 && expiresAt <= nowWallMs())) {
    return null;
  }
  const startedAt = Number(config.startedAt) || nowWallMs();
  const traceMode = normalizeTraceMode(config.traceMode);
  if (!traceMode) return null;
  const persistedStartPerfAt = Number(config.startPerfAt);
  const currentPerfAt = nowPerfMs();
  const pageId = getTracePageId();
  const resetPageOrigin = (
    config.pageId !== pageId
    || !Number.isFinite(persistedStartPerfAt)
    || persistedStartPerfAt > currentPerfAt + 100
  );
  const startPerfAt = resetPageOrigin
    ? getTracePageStartPerfAt()
    : persistedStartPerfAt;
  return {
    enabled: true,
    sessionId: typeof config.sessionId === 'string' && config.sessionId
      ? config.sessionId
      : createSessionId(),
    source: typeof config.source === 'string' ? config.source : 'unknown',
    traceMode,
    startedAt,
    startPerfAt,
    pageId,
    expiresAt,
    oneShot: config.oneShot === true,
  };
};

const getTraceConfig = () => {
  if (activeTraceConfig) {
    const expiresAt = Number(activeTraceConfig.expiresAt) || 0;
    if (expiresAt <= 0 || expiresAt > nowWallMs()) {
      return activeTraceConfig;
    }
    activeTraceConfig = null;
  }
  if (traceConfigLoaded) {
    return activeTraceConfig;
  }
  traceConfigLoaded = true;
  const rawConfig = readJson(ZEN_TRACE_CONFIG_KEY, null);
  const config = normalizeConfig(rawConfig);
  if (!config) {
    removeStored(ZEN_TRACE_CONFIG_KEY);
  } else if (
    rawConfig?.pageId !== config.pageId
    || rawConfig?.startPerfAt !== config.startPerfAt
    || rawConfig?.oneShot !== config.oneShot
  ) {
    writeJson(ZEN_TRACE_CONFIG_KEY, config);
  }
  activeTraceConfig = config;
  return config;
};

const trimString = (value) => {
  const text = String(value);
  if (text.length <= ZEN_TRACE_MAX_STRING_LENGTH) return text;
  return `${text.slice(0, ZEN_TRACE_MAX_STRING_LENGTH)}...`;
};

const summarizeSignatureString = (value) => {
  const text = String(value);
  if (text.length <= ZEN_TRACE_MAX_SIGNATURE_LENGTH) return text;
  return {
    length: text.length,
    preview: `${text.slice(0, ZEN_TRACE_MAX_SIGNATURE_LENGTH)}...`,
  };
};

const sanitizeValue = (value, depth = 0, seen = new WeakSet(), keyHint = '') => {
  if (value === null || value === undefined) return value ?? null;
  const keyText = String(keyHint || '').toLowerCase();
  if (typeof value === 'string') {
    if (keyText.includes('signature')) return summarizeSignatureString(value);
    return trimString(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (value instanceof Error) {
    return {
      name: value.name || 'Error',
      message: trimString(value.message || ''),
      stack: trimString(value.stack || ''),
    };
  }
  if (typeof Element !== 'undefined' && value instanceof Element) {
    return {
      tagName: value.tagName,
      id: value.id || '',
      className: typeof value.className === 'string' ? trimString(value.className) : '',
      clientWidth: Number(value.clientWidth) || 0,
      clientHeight: Number(value.clientHeight) || 0,
      isConnected: value.isConnected === true,
    };
  }
  if (typeof value !== 'object') return trimString(value);
  if (seen.has(value)) return '[Circular]';
  if (depth >= 4) return '[DepthLimit]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, ZEN_TRACE_MAX_ARRAY_ITEMS).map((entry) => (
      sanitizeValue(entry, depth + 1, seen, keyHint)
    ));
  }
  const output = {};
  Object.keys(value).slice(0, ZEN_TRACE_MAX_OBJECT_KEYS).forEach((key) => {
    output[key] = sanitizeValue(value[key], depth + 1, seen, key);
  });
  return output;
};

const readStoredHistory = () => {
  const history = readJson(ZEN_TRACE_HISTORY_KEY, []);
  return Array.isArray(history) ? history : [];
};

const writeStoredHistory = (history) => writeJson(
  ZEN_TRACE_HISTORY_KEY,
  Array.isArray(history) ? history.slice(-ZEN_TRACE_MAX_EVENTS) : [],
);

const readHistory = () => {
  if (!traceHistoryLoaded) {
    traceHistoryCache = readStoredHistory();
    traceHistoryLoaded = true;
  }
  return Array.isArray(traceHistoryCache) ? traceHistoryCache : [];
};

const cancelTraceHistoryFlush = () => {
  if (!traceHistoryFlushTimerId) return;
  clearTimeout(traceHistoryFlushTimerId);
  traceHistoryFlushTimerId = 0;
};

const cancelTraceDisable = () => {
  if (!traceDisableTimerId) return;
  clearTimeout(traceDisableTimerId);
  traceDisableTimerId = 0;
};

const flushTraceHistory = () => {
  cancelTraceHistoryFlush();
  if (!traceHistoryDirty) return false;
  traceHistoryDirty = false;
  return writeStoredHistory(traceHistoryCache);
};

const scheduleTraceHistoryFlush = ({ delayMs = ZEN_TRACE_TERMINAL_FLUSH_DELAY_MS } = {}) => {
  if (traceHistoryFlushTimerId) return;
  const safeDelayMs = Math.max(0, Number(delayMs) || 0);
  traceHistoryFlushTimerId = setTimeout(flushTraceHistory, safeDelayMs);
};

const disableTraceConfigAfterFlush = () => {
  if (traceDisableTimerId) return;
  traceDisableTimerId = setTimeout(() => {
    traceDisableTimerId = 0;
    flushTraceHistory();
    activeTraceConfig = null;
    traceConfigLoaded = true;
    removeStored(ZEN_TRACE_CONFIG_KEY);
  }, ZEN_TRACE_TERMINAL_DISABLE_DELAY_MS);
};

const logToConsole = (entry) => {
  if (typeof console === 'undefined' || typeof console.info !== 'function') return;
  const elapsed = Number(entry.elapsedMs || 0).toFixed(1);
  console.info(
    `[ZenRenderTrace +${elapsed}ms] ${entry.event}`,
    entry.details || null,
  );
};

export const isZenTraceEnabled = () => (
  isZenTraceBuildEnabled() ? Boolean(getTraceConfig()) : false
);

export const setZenTraceEnabled = (enabled = true, options = {}) => {
  if (!isZenTraceBuildEnabled()) return false;
  if (!enabled) {
    cancelTraceDisable();
    flushTraceHistory();
    activeTraceConfig = null;
    traceConfigLoaded = true;
    removeStored(ZEN_TRACE_CONFIG_KEY);
    return false;
  }
  cancelTraceDisable();
  const resetHistory = options?.resetHistory === true;
  if (resetHistory) {
    clearZenTraceHistory();
  }
  const ttlMs = Math.max(1000, Number(options?.ttlMs) || ZEN_TRACE_DEFAULT_TTL_MS);
  const config = {
    enabled: true,
    sessionId: typeof options?.sessionId === 'string' && options.sessionId
      ? options.sessionId
      : createSessionId(),
    source: typeof options?.source === 'string' ? options.source : 'manual',
    traceMode: normalizeTraceMode(options?.traceMode),
    startedAt: nowWallMs(),
    startPerfAt: nowPerfMs(),
    pageId: getTracePageId(),
    expiresAt: nowWallMs() + ttlMs,
    oneShot: options?.oneShot === true,
  };
  if (!config.traceMode) {
    throw new Error(`ZEN_TRACE_MODE_INVALID:${String(options?.traceMode)}`);
  }
  activeTraceConfig = config;
  traceConfigLoaded = true;
  writeJson(ZEN_TRACE_CONFIG_KEY, config);
  emitZenTrace('trace:enabled', {
    source: config.source,
    traceMode: config.traceMode,
    ttlMs,
    oneShot: config.oneShot,
  });
  return true;
};

export const getZenTraceHistory = () => (
  isZenTraceBuildEnabled() ? readHistory() : []
);

export const clearZenTraceHistory = () => {
  if (!isZenTraceBuildEnabled()) return;
  cancelTraceHistoryFlush();
  traceHistoryCache = [];
  traceHistoryLoaded = true;
  traceHistoryDirty = false;
  removeStored(ZEN_TRACE_HISTORY_KEY);
};

export const emitZenTrace = (event, details = null) => {
  if (!isZenTraceBuildEnabled()) return null;
  const config = getTraceConfig();
  if (!config) return null;
  const perfAt = nowPerfMs();
  const history = readHistory();
  const lastIndex = Number(history[history.length - 1]?.index) || history.length || 0;
  const entry = {
    index: lastIndex + 1,
    sessionId: config.sessionId,
    event: typeof event === 'string' && event ? event : 'unknown',
    at: nowWallMs(),
    perfAt: Number(perfAt.toFixed(2)),
    elapsedMs: Number(Math.max(0, perfAt - config.startPerfAt).toFixed(2)),
    details: config.traceMode === ZEN_TRACE_MODE.MARKS
      ? null
      : sanitizeValue(details),
  };
  const nextHistory = [...history, entry].slice(-ZEN_TRACE_MAX_EVENTS);
  traceHistoryCache = nextHistory;
  traceHistoryLoaded = true;
  traceHistoryDirty = true;
  if (config.oneShot === true && ZEN_TRACE_TERMINAL_EVENTS.has(entry.event)) {
    scheduleTraceHistoryFlush();
    disableTraceConfigAfterFlush();
  }
  if (config.traceMode === ZEN_TRACE_MODE.FULL) {
    logToConsole(entry);
  }
  return entry;
};

export const startZenTraceSpan = (event, details = null) => {
  const startedAt = nowPerfMs();
  emitZenTrace(`${event}:start`, details);
  return (finishDetails = null) => {
    const durationMs = Number(Math.max(0, nowPerfMs() - startedAt).toFixed(2));
    emitZenTrace(`${event}:end`, {
      ...(finishDetails && typeof finishDetails === 'object' ? finishDetails : {}),
      durationMs,
    });
    return durationMs;
  };
};

export const dumpZenTraceHistory = () => JSON.stringify(getZenTraceHistory(), null, 2);

export const copyZenTraceHistory = async () => {
  if (!isZenTraceBuildEnabled()) {
    throw new Error('ZEN_TRACE_DISABLED_IN_BUILD');
  }
  const text = dumpZenTraceHistory();
  const globalRef = getGlobal();
  if (!globalRef?.navigator?.clipboard?.writeText) {
    throw new Error('ZEN_TRACE_CLIPBOARD_UNAVAILABLE');
  }
  await globalRef.navigator.clipboard.writeText(text);
  return text.length;
};

export const startZenTraceReload = (options = {}) => {
  if (!isZenTraceBuildEnabled()) return false;
  setZenTraceEnabled(true, {
    ttlMs: options?.ttlMs || ZEN_TRACE_DEFAULT_TTL_MS,
    resetHistory: true,
    source: options?.source || 'reload',
    oneShot: options?.oneShot !== false,
  });
  const globalRef = getGlobal();
  if (globalRef?.location && typeof globalRef.location.reload === 'function') {
    globalRef.location.reload();
  }
};

const installTraceConsoleApi = () => {
  if (!isZenTraceBuildEnabled()) return;
  const globalRef = getGlobal();
  if (!globalRef) return;
  const api = {
    enable: (options = {}) => setZenTraceEnabled(true, {
      ...options,
      source: options?.source || 'console',
    }),
    disable: () => setZenTraceEnabled(false),
    clear: clearZenTraceHistory,
    copy: copyZenTraceHistory,
    dump: dumpZenTraceHistory,
    history: getZenTraceHistory,
    isEnabled: isZenTraceEnabled,
    startAndReload: (options = {}) => startZenTraceReload({
      ...options,
      source: options?.source || 'console_reload',
    }),
  };
  globalRef[ZEN_TRACE_GLOBAL_KEY] = api;
};

installTraceConsoleApi();

const installDashboardCaptureBootTrace = () => {
  const globalRef = getGlobal();
  if (
    !globalRef?.location
    || typeof globalRef.location.search !== 'string'
    || typeof URLSearchParams !== 'function'
  ) {
    return false;
  }
  const search = new URLSearchParams(globalRef.location.search);
  const requestedMode = search.get('entropy-qa-boot-trace');
  if (requestedMode === null) return false;
  if (requestedMode === 'off') {
    setZenTraceEnabled(false);
    return false;
  }
  const traceMode = requestedMode === '1'
    ? ZEN_TRACE_MODE.FULL
    : normalizeTraceMode(requestedMode, null);
  if (!traceMode) {
    throw new Error(`ZEN_TRACE_MODE_INVALID:${String(requestedMode)}`);
  }
  return setZenTraceEnabled(true, {
    resetHistory: true,
    source: 'dashboard_capture_boot',
    ttlMs: 2 * 60 * 1000,
    oneShot: false,
    traceMode,
  });
};

installDashboardCaptureBootTrace();

export const ZEN_TRACE_DEBUG_GLOBAL_KEY = ZEN_TRACE_GLOBAL_KEY;
