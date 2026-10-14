const MAX_INTENTS = 80;
const MAX_TRACES = 50;
const MAX_PENDING_EVENTS_PER_TAB = 24;
const PENDING_EVENT_WINDOW_MS = 10_000;

const intents = [];
const traces = [];
const activeTraceByTabId = new Map();
const pendingEventsByTabId = new Map();
let traceSequence = 0;
let longTaskObserver = null;

const nowMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

function trim(list, maxLength) {
  if (list.length > maxLength) list.splice(0, list.length - maxLength);
}

function clone(value) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function normalizeTabId(tabId) {
  return typeof tabId === 'string' ? tabId.trim() : '';
}

function createEvent(stage, metadata = null, atMs = nowMs()) {
  return Object.freeze({
    stage: String(stage || 'unknown'),
    atMs,
    metadata: clone(metadata),
  });
}

function recordPendingEvent(tabId, event) {
  const current = pendingEventsByTabId.get(tabId) || [];
  current.push(event);
  trim(current, MAX_PENDING_EVENTS_PER_TAB);
  pendingEventsByTabId.set(tabId, current);
}

function ensureLongTaskObserver() {
  if (longTaskObserver || typeof window === 'undefined') return;
  const Observer = window.PerformanceObserver;
  if (typeof Observer !== 'function') return;
  try {
    longTaskObserver = new Observer((list) => {
      list.getEntries().forEach((entry) => {
        const startTime = Number(entry.startTime);
        const duration = Number(entry.duration);
        if (!Number.isFinite(startTime) || !Number.isFinite(duration)) return;
        activeTraceByTabId.forEach((trace) => {
          if (startTime + duration < trace.startedAtMs) return;
          trace.longTasks.count += 1;
          trace.longTasks.totalDurationMs += duration;
          trace.longTasks.maxDurationMs = Math.max(trace.longTasks.maxDurationMs, duration);
        });
      });
    });
    longTaskObserver.observe({ type: 'longtask', buffered: false });
  } catch {
    longTaskObserver = null;
  }
}

function stopLongTaskObserverWhenIdle() {
  if (activeTraceByTabId.size > 0 || !longTaskObserver) return;
  longTaskObserver.disconnect();
  longTaskObserver = null;
}

function updateCounters(trace, metadata = null) {
  const cacheStatus = metadata?.cacheStatus;
  if (cacheStatus === 'hit' || cacheStatus === 'join' || cacheStatus === 'miss') {
    trace.cache[cacheStatus] += 1;
  }
  if (metadata?.ioKind === 'runtime-message') trace.io.runtimeMessages += 1;
  if (metadata?.ioKind === 'indexeddb') trace.io.indexedDbReads += 1;
  if (metadata?.ioKind === 'browser-permission') trace.io.browserPermissionReads += 1;
}

function scheduleUsablePaint(trace) {
  if (trace.usablePaintScheduled) return;
  trace.usablePaintScheduled = true;
  const scheduleFrame = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (callback) => setTimeout(() => callback(nowMs()), 0);
  scheduleFrame(() => {
    scheduleFrame(() => {
      if (activeTraceByTabId.get(trace.tabId)?.id !== trace.id) return;
      completeDashboardTabEntryTrace(trace.tabId, { status: 'ready' });
    });
  });
}

export function recordDashboardTabIntent({
  tabId,
  kind = 'unknown',
  themeId = '',
} = {}) {
  const normalizedTabId = normalizeTabId(tabId);
  if (!normalizedTabId) return null;
  const intent = Object.freeze({
    tabId: normalizedTabId,
    kind: String(kind || 'unknown'),
    themeId: String(themeId || ''),
    atMs: nowMs(),
    atEpochMs: Date.now(),
  });
  intents.push(intent);
  trim(intents, MAX_INTENTS);
  recordPendingEvent(normalizedTabId, createEvent('intent', intent, intent.atMs));
  return intent;
}

export function startDashboardTabEntryTrace({
  tabId,
  themeId = '',
  source = 'selection',
} = {}) {
  const normalizedTabId = normalizeTabId(tabId);
  if (!normalizedTabId) return null;
  const startedAtMs = nowMs();
  const previous = activeTraceByTabId.get(normalizedTabId);
  if (previous) {
    completeDashboardTabEntryTrace(normalizedTabId, { status: 'superseded' });
  }
  const pendingEvents = (pendingEventsByTabId.get(normalizedTabId) || [])
    .filter((event) => startedAtMs - event.atMs <= PENDING_EVENT_WINDOW_MS);
  pendingEventsByTabId.delete(normalizedTabId);
  const trace = {
    id: ++traceSequence,
    tabId: normalizedTabId,
    themeId: String(themeId || ''),
    source: String(source || 'selection'),
    startedAtMs,
    startedAtEpochMs: Date.now(),
    completedAtMs: null,
    durationMs: null,
    status: 'running',
    events: [...pendingEvents, createEvent('selection:start', null, startedAtMs)],
    cache: { hit: 0, join: 0, miss: 0 },
    io: { runtimeMessages: 0, indexedDbReads: 0, browserPermissionReads: 0 },
    longTasks: { count: 0, totalDurationMs: 0, maxDurationMs: 0 },
    usablePaintScheduled: false,
  };
  pendingEvents.forEach((event) => updateCounters(trace, event.metadata));
  activeTraceByTabId.set(normalizedTabId, trace);
  ensureLongTaskObserver();
  return trace.id;
}

export function ensureDashboardTabEntryTrace(options = {}) {
  const normalizedTabId = normalizeTabId(options?.tabId);
  if (!normalizedTabId) return null;
  return activeTraceByTabId.get(normalizedTabId)?.id
    || startDashboardTabEntryTrace(options);
}

export function recordDashboardTabEntryStage(tabId, stage, metadata = null) {
  const normalizedTabId = normalizeTabId(tabId);
  if (!normalizedTabId) return null;
  const event = createEvent(stage, metadata);
  const trace = activeTraceByTabId.get(normalizedTabId);
  if (!trace && stage !== 'readiness:inactive' && metadata?.source !== 'boot') {
    recordPendingEvent(normalizedTabId, event);
  }
  if (!trace) return event;
  trace.events.push(event);
  updateCounters(trace, metadata);
  // Root dependencies can be ready while a selected workspace is still loading.
  // Presentation owners acknowledge submission separately; two rAFs represent
  // a paint opportunity, never proof of physical scan-out.
  if ((stage === 'readiness:ready' && metadata?.waitForPresentation !== true)
    || stage === 'presentation:ready') scheduleUsablePaint(trace);
  if (stage === 'readiness:error') {
    completeDashboardTabEntryTrace(normalizedTabId, {
      status: 'error',
      metadata,
    });
  }
  if (stage === 'readiness:inactive') {
    completeDashboardTabEntryTrace(normalizedTabId, {
      status: 'inactive',
      metadata,
    });
  }
  return event;
}

export function completeDashboardTabEntryTrace(tabId, {
  status = 'ready',
  metadata = null,
} = {}) {
  const normalizedTabId = normalizeTabId(tabId);
  const trace = activeTraceByTabId.get(normalizedTabId);
  if (!trace) return null;
  const completedAtMs = nowMs();
  const normalizedStatus = String(status || 'ready');
  trace.events.push(createEvent(
    normalizedStatus === 'ready' ? 'usable-paint' : 'trace:complete',
    normalizedStatus === 'ready' ? metadata : { ...metadata, status: normalizedStatus },
    completedAtMs,
  ));
  trace.completedAtMs = completedAtMs;
  trace.durationMs = completedAtMs - trace.startedAtMs;
  trace.status = normalizedStatus;
  delete trace.usablePaintScheduled;
  traces.push(Object.freeze({
    ...trace,
    events: Object.freeze([...trace.events]),
    cache: Object.freeze({ ...trace.cache }),
    io: Object.freeze({ ...trace.io }),
    longTasks: Object.freeze({ ...trace.longTasks }),
  }));
  trim(traces, MAX_TRACES);
  activeTraceByTabId.delete(normalizedTabId);
  stopLongTaskObserverWhenIdle();
  return traces[traces.length - 1];
}

export function getDashboardTabEntryTelemetrySnapshot() {
  return Object.freeze({
    intents: Object.freeze(intents.map((intent) => ({ ...intent }))),
    traces: Object.freeze(traces.map((trace) => clone(trace))),
    active: Object.freeze(Array.from(activeTraceByTabId.values()).map((trace) => clone(trace))),
  });
}

export function resetDashboardTabEntryTelemetry() {
  longTaskObserver?.disconnect();
  longTaskObserver = null;
  intents.length = 0;
  traces.length = 0;
  activeTraceByTabId.clear();
  pendingEventsByTabId.clear();
  traceSequence = 0;
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__ENTROPY_TAB_ENTRY_TELEMETRY__', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      getSnapshot: getDashboardTabEntryTelemetrySnapshot,
      reset: resetDashboardTabEntryTelemetry,
    }),
  });
}
