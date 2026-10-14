const DEFAULT_MAX_ENTRIES = 120;
const DEFAULT_LIST_LIMIT = 40;
const STRING_LIMIT = 220;

export const SENTINEL_PROTOCOL_TIMELINE_PHASES = Object.freeze({
  REQUESTED: 'requested',
  BACKGROUND_ACCEPTED: 'background_accepted',
  PROTECTED_SITE_VALIDATED: 'protected_site_validated',
  CONTENT_READY: 'content_ready',
  NUDGE_DISPATCHED: 'nudge_dispatched',
  CONTENT_RENDERED: 'content_rendered',
  WORKER_PROBED: 'worker_probed',
  CONFIG_DELIVERED: 'config_delivered',
  STOPPED: 'stopped',
  SKIPPED: 'skipped',
  FAILED: 'failed',
});

export const SENTINEL_PROTOCOL_TIMELINE_STATUSES = Object.freeze({
  INFO: 'info',
  PENDING: 'pending',
  SUCCESS: 'success',
  SKIPPED: 'skipped',
  ERROR: 'error',
});

export const SENTINEL_PROTOCOL_TIMELINE_SOURCES = Object.freeze({
  EXPERIMENT_LAB: 'experiment_lab',
  RUNTIME: 'runtime',
});

const VALID_PHASES = new Set(Object.values(SENTINEL_PROTOCOL_TIMELINE_PHASES));
const VALID_STATUSES = new Set(Object.values(SENTINEL_PROTOCOL_TIMELINE_STATUSES));
const VALID_SOURCES = new Set(Object.values(SENTINEL_PROTOCOL_TIMELINE_SOURCES));

function normalizeLimit(value, fallback = DEFAULT_LIST_LIMIT) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.min(200, Math.floor(numeric)));
}

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > STRING_LIMIT ? text.slice(0, STRING_LIMIT) : text;
}

function normalizeTabId(tabId) {
  if (tabId === null || tabId === undefined) return null;
  const numeric = Number(tabId);
  if (!Number.isInteger(numeric) || numeric < 0) return null;
  return numeric;
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

export function projectSentinelStartFailureDiagnostics(diagnostics) {
  if (!diagnostics || typeof diagnostics !== 'object' || Array.isArray(diagnostics)) return null;
  return {
    runtimeStage: typeof diagnostics.runtimeStage === 'string'
      ? diagnostics.runtimeStage.slice(0, STRING_LIMIT) : null,
    lastError: typeof diagnostics.lastError === 'string'
      ? diagnostics.lastError.slice(0, STRING_LIMIT) : null,
    hostConnected: normalizeBoolean(diagnostics.hostConnected),
    hostChannelAuthenticated: normalizeBoolean(diagnostics.hostChannelAuthenticated),
    workerBootReady: normalizeBoolean(diagnostics.workerBootReady),
    workerFirstFrameReady: normalizeBoolean(diagnostics.workerFirstFrameReady),
  };
}

function cloneEntry(entry) {
  return entry && typeof entry === 'object' ? {
    ...entry,
    startFailureDiagnostics: projectSentinelStartFailureDiagnostics(entry.startFailureDiagnostics),
  } : null;
}

function normalizePhase(value) {
  const phase = normalizeString(value);
  if (!VALID_PHASES.has(phase)) {
    throw new Error('SENTINEL_PROTOCOL_TIMELINE_PHASE_UNSUPPORTED');
  }
  return phase;
}

function normalizeStatus(value, phase) {
  const status = normalizeString(value);
  if (VALID_STATUSES.has(status)) return status;
  if (phase === SENTINEL_PROTOCOL_TIMELINE_PHASES.FAILED) {
    return SENTINEL_PROTOCOL_TIMELINE_STATUSES.ERROR;
  }
  if (phase === SENTINEL_PROTOCOL_TIMELINE_PHASES.SKIPPED) {
    return SENTINEL_PROTOCOL_TIMELINE_STATUSES.SKIPPED;
  }
  return SENTINEL_PROTOCOL_TIMELINE_STATUSES.INFO;
}

function normalizeSource(value) {
  const source = normalizeString(value);
  if (!VALID_SOURCES.has(source)) {
    throw new Error('SENTINEL_PROTOCOL_TIMELINE_SOURCE_UNSUPPORTED');
  }
  return source;
}

function normalizeEntry(source, { id, recordedAt }) {
  const phase = normalizePhase(source?.phase);
  return {
    id,
    recordedAt,
    phase,
    status: normalizeStatus(source?.status, phase),
    source: normalizeSource(source?.source),
    route: normalizeString(source?.route),
    tabId: normalizeTabId(source?.tabId),
    hostname: normalizeString(source?.hostname),
    url: normalizeString(source?.url),
    messageType: normalizeString(source?.messageType),
    runId: normalizeString(source?.runId),
    reason: normalizeString(source?.reason),
    error: normalizeString(source?.error),
    startFailureDiagnostics: projectSentinelStartFailureDiagnostics(source?.startFailureDiagnostics),
    protocolScope: normalizeString(source?.protocolScope),
    protocolVariant: normalizeString(source?.protocolVariant),
    protocolIntensity: normalizeNumber(source?.protocolIntensity),
    delivery: normalizeString(source?.delivery),
    ensureSource: normalizeString(source?.ensureSource),
    recovery: normalizeBoolean(source?.recovery),
    traceId: normalizeString(source?.traceId),
  };
}

export function createSentinelProtocolTimeline({
  maxEntries = DEFAULT_MAX_ENTRIES,
  now = () => Date.now(),
} = {}) {
  const capacity = normalizeLimit(maxEntries, DEFAULT_MAX_ENTRIES);
  let sequence = 0;
  let entries = [];

  function record(event = {}) {
    const entry = normalizeEntry(event, {
      id: ++sequence,
      recordedAt: Number(now()) || Date.now(),
    });
    entries.push(entry);
    if (entries.length > capacity) {
      entries = entries.slice(entries.length - capacity);
    }
    return cloneEntry(entry);
  }

  function resolveScopedEntries({ tabId = null } = {}) {
    const normalizedTabId = normalizeTabId(tabId);
    if (normalizedTabId === null) return entries;
    return entries.filter((entry) => entry.tabId === normalizedTabId);
  }

  function list({ limit = DEFAULT_LIST_LIMIT, tabId = null } = {}) {
    const normalizedLimit = normalizeLimit(limit, DEFAULT_LIST_LIMIT);
    return resolveScopedEntries({ tabId }).slice(-normalizedLimit).map(cloneEntry);
  }

  function clear() {
    entries = [];
    sequence = 0;
  }

  function getSnapshot({ limit = DEFAULT_LIST_LIMIT, tabId = null } = {}) {
    const scopedEntries = resolveScopedEntries({ tabId });
    return {
      generatedAt: Number(now()) || Date.now(),
      maxEntries: capacity,
      totalEntries: scopedEntries.length,
      nextSequence: sequence + 1,
      events: scopedEntries.slice(-normalizeLimit(limit, DEFAULT_LIST_LIMIT)).map(cloneEntry),
    };
  }

  return {
    clear,
    getSnapshot,
    list,
    record,
  };
}

export default createSentinelProtocolTimeline;
