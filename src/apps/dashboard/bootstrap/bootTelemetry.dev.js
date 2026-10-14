import {
  readPageLocalJsonItem,
  removePageLocalStorageItem,
  writePageLocalJsonItem,
} from '../../../platform/browser/pageLocalStorage.js';

const MAX_MARKS = 500;
const MAX_TASKS = 200;
const MAX_PHASES = 40;
const MAX_LONG_TASK_ENTRIES = 80;
const MAX_REPORT_HISTORY = 8;
const BOOT_TELEMETRY_REPORT_TTL_MS = 2 * 60 * 60 * 1000;
const BOOT_TELEMETRY_REPORT_HISTORY_KEY = 'entropy_debug_dashboard_boot_report_history';

const hasWindow = () => typeof window !== 'undefined';
const hasPerformanceNow = () => typeof performance !== 'undefined' && typeof performance.now === 'function';
const nowMs = () => (hasPerformanceNow() ? performance.now() : Date.now());
const toFixedMs = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const safeClone = (value) => {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return String(value);
  }
};

const formatErrorMessage = (error) => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string' && error.message.trim()) return error.message;
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
};

const serializeErrorDetails = (error) => {
  if (!error) return null;
  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
      code: null,
      stack: null,
      details: null,
      cause: null,
    };
  }
  const cause = error?.cause;
  return {
    name: typeof error?.name === 'string' && error.name ? error.name : 'Error',
    message: formatErrorMessage(error),
    code: typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : null,
    stack: typeof error?.stack === 'string' && error.stack.trim() ? error.stack : null,
    details: error?.details && typeof error.details === 'object' ? safeClone(error.details) : null,
    cause: cause ? {
      name: typeof cause?.name === 'string' && cause.name ? cause.name : 'Error',
      message: formatErrorMessage(cause),
      code: typeof cause?.code === 'string' && cause.code.trim() ? cause.code.trim() : null,
      stack: typeof cause?.stack === 'string' && cause.stack.trim() ? cause.stack : null,
    } : null,
  };
};

let sessionCounter = 0;
let activeSession = null;
let activeTaskStartMap = new Map();
let debugBridgeReady = false;
let activeLongTaskObserver = null;
let activePaintObserver = null;

const isBootTelemetryEnabled = () => true;

const trimList = (list, maxLength) => {
  if (!Array.isArray(list) || list.length <= maxLength) return;
  list.splice(0, list.length - maxLength);
};

const createSession = (metadata = null) => {
  const startedAtMs = nowMs();
  return {
    id: ++sessionCounter,
    startedAtMs,
    startedAtEpochMs: Date.now(),
    completedAtMs: 0,
    status: 'running',
    metadata: safeClone(metadata),
    marks: [],
    phases: [],
    tasks: [],
    loader: {
      mountCount: 0,
      unmountCount: 0,
      lastMountAtMs: null,
      lastUnmountAtMs: null,
      visibleForMs: 0,
    },
    performance: {
      longTasks: {
        count: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
        entries: [],
      },
      paints: {},
    },
    errors: [],
    summary: null,
  };
};

const getPerformanceObserver = () => {
  if (!hasWindow()) return null;
  return window.PerformanceObserver || null;
};

const disconnectPerformanceObservers = () => {
  try {
    activeLongTaskObserver?.disconnect?.();
  } catch (_) {
    // PerformanceObserver teardown is best-effort diagnostics only.
  }
  try {
    activePaintObserver?.disconnect?.();
  } catch (_) {
    // PerformanceObserver teardown is best-effort diagnostics only.
  }
  activeLongTaskObserver = null;
  activePaintObserver = null;
};

const recordLongTaskEntry = (entry) => {
  if (!activeSession || !entry) return;
  const startTimeMs = Number(entry.startTime);
  const durationMs = Number(entry.duration);
  if (!Number.isFinite(startTimeMs) || !Number.isFinite(durationMs)) return;
  const endTimeMs = startTimeMs + durationMs;
  if (endTimeMs < activeSession.startedAtMs) return;

  const longTasks = activeSession.performance.longTasks;
  const bootRelativeStartMs = toFixedMs(startTimeMs - activeSession.startedAtMs);
  const normalizedDurationMs = toFixedMs(durationMs);
  longTasks.count += 1;
  longTasks.totalDurationMs = toFixedMs(longTasks.totalDurationMs + normalizedDurationMs);
  longTasks.maxDurationMs = Math.max(longTasks.maxDurationMs, normalizedDurationMs);
  longTasks.entries.push({
    name: String(entry.name || 'longtask'),
    startAtMs: bootRelativeStartMs,
    durationMs: normalizedDurationMs,
  });
  trimList(longTasks.entries, MAX_LONG_TASK_ENTRIES);
};

const recordPaintEntry = (entry) => {
  if (!activeSession || !entry) return;
  const name = String(entry.name || '');
  if (!name) return;
  const startTimeMs = Number(entry.startTime);
  if (!Number.isFinite(startTimeMs)) return;
  activeSession.performance.paints[name] = {
    startTimeMs: toFixedMs(startTimeMs),
    bootRelativeMs: toFixedMs(startTimeMs - activeSession.startedAtMs),
  };
};

const captureBufferedPaintEntries = () => {
  if (!activeSession || typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
    return;
  }
  try {
    performance.getEntriesByType('paint').forEach(recordPaintEntry);
  } catch (_) {
    // Paint timing is diagnostic-only and may be unavailable in some contexts.
  }
};

const startPerformanceObservers = () => {
  disconnectPerformanceObservers();
  captureBufferedPaintEntries();
  const PerformanceObserverRef = getPerformanceObserver();
  if (!PerformanceObserverRef) return;

  try {
    activeLongTaskObserver = new PerformanceObserverRef((list) => {
      list.getEntries().forEach(recordLongTaskEntry);
    });
    activeLongTaskObserver.observe({ type: 'longtask', buffered: true });
  } catch (_) {
    activeLongTaskObserver = null;
  }

  try {
    activePaintObserver = new PerformanceObserverRef((list) => {
      list.getEntries().forEach(recordPaintEntry);
    });
    activePaintObserver.observe({ type: 'paint', buffered: true });
  } catch (_) {
    activePaintObserver = null;
  }
};

const pushMark = (type, payload = null) => {
  if (!activeSession) return;
  const atMs = toFixedMs(nowMs() - activeSession.startedAtMs);
  activeSession.marks.push({
    type: String(type || 'unknown'),
    atMs,
    payload: safeClone(payload),
  });
  trimList(activeSession.marks, MAX_MARKS);
};

const finalizeOpenPhase = (atMs) => {
  if (!activeSession || !Array.isArray(activeSession.phases) || !activeSession.phases.length) return;
  const last = activeSession.phases[activeSession.phases.length - 1];
  if (!last || Number.isFinite(last.endAtMs)) return;
  last.endAtMs = atMs;
  last.durationMs = toFixedMs(atMs - last.startAtMs);
};

const computeSummary = (session) => {
  if (!session) return null;
  const completedAtMs = (
    Number.isFinite(session.completedAtMs)
    && session.completedAtMs >= session.startedAtMs
  )
    ? session.completedAtMs
    : nowMs();
  const totalDurationMs = toFixedMs(Math.max(0, completedAtMs - session.startedAtMs));
  const firstPaint = session.performance?.paints?.['first-paint'] || null;
  const firstContentfulPaint = session.performance?.paints?.['first-contentful-paint'] || null;

  return {
    sessionId: session.id,
    status: session.status,
    totalDurationMs,
    phaseDurationsMs: (session.phases || []).map((phase) => {
      const startAtMs = Number(phase.startAtMs) || 0;
      const endAtMs = phase.endAtMs != null && Number.isFinite(Number(phase.endAtMs))
        ? Number(phase.endAtMs)
        : totalDurationMs;
      return {
        phase: phase.phase,
        durationMs: phase.durationMs != null && Number.isFinite(Number(phase.durationMs))
          ? Number(phase.durationMs)
          : toFixedMs(Math.max(0, endAtMs - startAtMs)),
        startAtMs,
        endAtMs,
      };
    }),
    taskDurationsMs: (session.tasks || []).map((task) => ({
      task: task.task,
      durationMs: Number(task.durationMs) || 0,
      startAtMs: Number.isFinite(Number(task.startAtMs)) ? Number(task.startAtMs) : null,
      endAtMs: Number.isFinite(Number(task.endAtMs)) ? Number(task.endAtMs) : null,
      error: task.error || null,
    })),
    loaderVisibleForMs: Number(session.loader?.visibleForMs) || 0,
    loaderMountCount: Number(session.loader?.mountCount) || 0,
    loaderUnmountCount: Number(session.loader?.unmountCount) || 0,
    longTaskCount: Number(session.performance?.longTasks?.count) || 0,
    longTaskTotalMs: Number(session.performance?.longTasks?.totalDurationMs) || 0,
    longTaskMaxMs: Number(session.performance?.longTasks?.maxDurationMs) || 0,
    firstPaintMs: Number.isFinite(Number(firstPaint?.startTimeMs)) ? Number(firstPaint.startTimeMs) : null,
    firstPaintFromBootMs: Number.isFinite(Number(firstPaint?.bootRelativeMs)) ? Number(firstPaint.bootRelativeMs) : null,
    firstContentfulPaintMs: Number.isFinite(Number(firstContentfulPaint?.startTimeMs))
      ? Number(firstContentfulPaint.startTimeMs)
      : null,
    firstContentfulPaintFromBootMs: Number.isFinite(Number(firstContentfulPaint?.bootRelativeMs))
      ? Number(firstContentfulPaint.bootRelativeMs)
      : null,
    errorCount: Array.isArray(session.errors) ? session.errors.length : 0,
  };
};

const normalizeReportHistory = (reports = []) => {
  if (!Array.isArray(reports)) return [];
  const now = Date.now();
  return reports
    .filter((report) => report && typeof report === 'object')
    .filter((report) => {
      const expiresAt = Number(report.expiresAtEpochMs);
      return !Number.isFinite(expiresAt) || expiresAt > now;
    })
    .sort((a, b) => (Number(b.capturedAtEpochMs) || 0) - (Number(a.capturedAtEpochMs) || 0))
    .slice(0, MAX_REPORT_HISTORY);
};

const readReportHistory = () => normalizeReportHistory(
  readPageLocalJsonItem(BOOT_TELEMETRY_REPORT_HISTORY_KEY, []),
);

const writeReportHistory = (reports = []) => writePageLocalJsonItem(
  BOOT_TELEMETRY_REPORT_HISTORY_KEY,
  normalizeReportHistory(reports),
);

const isDiagnosticMark = (mark = null) => {
  const type = typeof mark?.type === 'string' ? mark.type.toLowerCase() : '';
  if (!type) return false;
  return type.includes('failed')
    || type.includes('failure')
    || type.includes('error')
    || type.includes('timeout')
    || type.includes('degraded');
};

const buildBootTelemetryReport = (snapshot, { reason = 'manual' } = {}) => {
  const source = safeClone(snapshot);
  if (!source || typeof source !== 'object') return null;
  const capturedAtEpochMs = Date.now();
  const summary = source.summary || computeSummary(source);
  const tasks = Array.isArray(source.tasks) ? source.tasks : [];
  const marks = Array.isArray(source.marks) ? source.marks : [];
  const taskErrors = tasks
    .filter((task) => task?.error || task?.errorDetails)
    .map((task) => ({
      task: task?.task || 'unknown',
      startAtMs: Number.isFinite(Number(task?.startAtMs)) ? Number(task.startAtMs) : null,
      endAtMs: Number.isFinite(Number(task?.endAtMs)) ? Number(task.endAtMs) : null,
      durationMs: Number(task?.durationMs) || 0,
      error: task?.error || task?.errorDetails?.message || 'Unknown error',
      errorDetails: task?.errorDetails || null,
      metadata: task?.metadata || null,
    }));

  return {
    kind: 'entropy.dashboard_boot_telemetry_report.v1',
    reportId: `boot-${capturedAtEpochMs}-${source.id || 'unknown'}`,
    reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'manual',
    capturedAtEpochMs,
    expiresAtEpochMs: capturedAtEpochMs + BOOT_TELEMETRY_REPORT_TTL_MS,
    sessionId: source.id || summary?.sessionId || null,
    status: source.status || summary?.status || 'unknown',
    metadata: source.metadata || null,
    summary,
    gates: {
      totalDurationMs: summary?.totalDurationMs ?? null,
      loaderVisibleForMs: summary?.loaderVisibleForMs ?? null,
      longTaskCount: summary?.longTaskCount ?? 0,
      longTaskTotalMs: summary?.longTaskTotalMs ?? 0,
      longTaskMaxMs: summary?.longTaskMaxMs ?? 0,
      errorCount: summary?.errorCount ?? 0,
    },
    timing: {
      phases: Array.isArray(source.phases) ? source.phases : [],
      tasks,
      loader: source.loader || null,
      performance: source.performance || null,
      paints: source.performance?.paints || {},
      longTasks: source.performance?.longTasks || null,
    },
    errors: {
      bootErrors: Array.isArray(source.errors) ? source.errors : [],
      taskErrors,
      diagnosticMarks: marks.filter(isDiagnosticMark),
    },
    marks,
    snapshot: source,
  };
};

const persistBootTelemetryReport = (snapshot, { reason = 'session_complete' } = {}) => {
  const report = buildBootTelemetryReport(snapshot, { reason });
  if (!report) return null;
  const reports = readReportHistory();
  writeReportHistory([report, ...reports]);
  return report;
};

const getSnapshot = () => {
  if (!isBootTelemetryEnabled()) return null;
  if (!activeSession) return null;
  const snapshot = safeClone(activeSession);
  if (!snapshot) return null;
  snapshot.summary = snapshot.summary || computeSummary(snapshot);
  return snapshot;
};

const ensureDebugBridge = () => {
  if (!isBootTelemetryEnabled()) return;
  if (!hasWindow() || debugBridgeReady) return;

  Object.defineProperty(window, '__ENTROPY_BOOT_TELEMETRY__', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      getSnapshot: () => getBootTelemetrySnapshot(),
      getLatestReport: () => getLatestBootTelemetryReport(),
      getReportHistory: () => getBootTelemetryReportHistory(),
      clearReportHistory: () => clearBootTelemetryReportHistory(),
      dumpBaseline: (reason = 'manual') => dumpBootTelemetryBaseline({ reason }),
    }),
  });
  debugBridgeReady = true;
};

export const startBootTelemetrySession = (metadata = null) => {
  if (!isBootTelemetryEnabled()) return null;
  activeTaskStartMap = new Map();
  activeSession = createSession(metadata);
  ensureDebugBridge();
  startPerformanceObservers();
  pushMark('session:start', metadata);
  return getSnapshot();
};

export const recordBootTelemetryPhaseTransition = (phase, metadata = null) => {
  if (!isBootTelemetryEnabled()) return;
  if (!activeSession) return;
  const atMs = toFixedMs(nowMs() - activeSession.startedAtMs);
  finalizeOpenPhase(atMs);
  activeSession.phases.push({
    phase: String(phase || 'unknown'),
    startAtMs: atMs,
    endAtMs: null,
    durationMs: null,
    metadata: safeClone(metadata),
  });
  trimList(activeSession.phases, MAX_PHASES);
  pushMark('phase:transition', { phase, metadata });
};

export const recordBootTelemetryTaskStart = (task, metadata = null) => {
  if (!isBootTelemetryEnabled()) return;
  if (!activeSession) return;
  const startedAt = nowMs();
  activeTaskStartMap.set(task, startedAt);
  pushMark('task:start', { task, metadata });
};

export const recordBootTelemetryTaskDone = (task, { durationMs = null, error = null, metadata = null } = {}) => {
  if (!isBootTelemetryEnabled()) return;
  if (!activeSession) return;
  const startedAt = activeTaskStartMap.get(task);
  const completedAt = nowMs();
  activeTaskStartMap.delete(task);
  const measuredDurationMs = Number.isFinite(Number(durationMs))
    ? Number(durationMs)
    : (Number.isFinite(startedAt) ? (completedAt - startedAt) : 0);
  const endAtMs = toFixedMs(completedAt - activeSession.startedAtMs);
  const startAtMs = Number.isFinite(startedAt)
    ? toFixedMs(startedAt - activeSession.startedAtMs)
    : toFixedMs(Math.max(0, endAtMs - measuredDurationMs));
  activeSession.tasks.push({
    task: String(task || 'unknown'),
    startAtMs,
    endAtMs,
    durationMs: toFixedMs(measuredDurationMs),
    error: error ? formatErrorMessage(error) : null,
    errorDetails: error ? serializeErrorDetails(error) : null,
    metadata: safeClone(metadata),
  });
  trimList(activeSession.tasks, MAX_TASKS);
  pushMark(error ? 'task:error' : 'task:done', {
    task,
    startAtMs,
    endAtMs,
    durationMs: toFixedMs(measuredDurationMs),
    error: error ? formatErrorMessage(error) : null,
    errorDetails: error ? serializeErrorDetails(error) : null,
    metadata,
  });
};

export const recordBootTelemetryLoaderVisibility = (isVisible, metadata = null) => {
  if (!isBootTelemetryEnabled()) return;
  if (!activeSession) return;
  const atMs = toFixedMs(nowMs() - activeSession.startedAtMs);
  const loader = activeSession.loader;
  if (isVisible) {
    loader.mountCount += 1;
    loader.lastMountAtMs = atMs;
    pushMark('loader:mount', { atMs, metadata });
    return;
  }

  loader.unmountCount += 1;
  loader.lastUnmountAtMs = atMs;
  if (Number.isFinite(loader.lastMountAtMs)) {
    const visibleWindowMs = Math.max(0, atMs - loader.lastMountAtMs);
    loader.visibleForMs = toFixedMs(loader.visibleForMs + visibleWindowMs);
  }
  pushMark('loader:unmount', { atMs, metadata });
};

export const recordBootTelemetryEvent = (type, metadata = null) => {
  if (!isBootTelemetryEnabled()) return;
  pushMark(type, metadata);
};

export const completeBootTelemetrySession = ({ status = 'ready', errors = [], metadata = null } = {}) => {
  if (!isBootTelemetryEnabled()) return null;
  if (!activeSession) return null;
  captureBufferedPaintEntries();
  const atMs = toFixedMs(nowMs() - activeSession.startedAtMs);
  finalizeOpenPhase(atMs);
  activeSession.completedAtMs = nowMs();
  activeSession.status = String(status || 'ready');
  activeSession.errors = Array.isArray(errors) ? safeClone(errors) : [];
  pushMark('session:done', { status, errors: activeSession.errors, metadata });
  activeSession.summary = computeSummary(activeSession);
  persistBootTelemetryReport(activeSession, { reason: 'session_complete' });
  disconnectPerformanceObservers();
  return getSnapshot();
};

export const getBootTelemetrySnapshot = () => getSnapshot();

export const getBootTelemetryReportHistory = () => readReportHistory();

export const getLatestBootTelemetryReport = () => {
  const activeReport = buildBootTelemetryReport(getSnapshot(), { reason: 'active_snapshot' });
  if (activeReport) return activeReport;
  const reports = readReportHistory();
  return reports[0] || null;
};

export const clearBootTelemetryReportHistory = () => {
  removePageLocalStorageItem(BOOT_TELEMETRY_REPORT_HISTORY_KEY);
};

export const dumpBootTelemetryBaseline = ({ reason = 'manual' } = {}) => {
  if (!isBootTelemetryEnabled()) return null;
  const snapshot = getSnapshot();
  if (!snapshot) return null;
  const payload = {
    reason,
    capturedAtEpochMs: Date.now(),
    summary: snapshot.summary || computeSummary(snapshot),
    report: buildBootTelemetryReport(snapshot, { reason }),
    snapshot,
  };
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info('[BootTelemetry][baseline]', payload);
  }
  return payload;
};
