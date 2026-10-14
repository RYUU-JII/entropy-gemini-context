export const DEFAULT_CATCH_UP_CONCURRENCY = 4;
export const MAX_CATCH_UP_CONCURRENCY = 12;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeReason(reason, fallback = 'unspecified') {
  return typeof reason === 'string' && reason.trim() ? reason.trim() : fallback;
}

export function createInjectionSummary({
  attemptedCount = 0,
  successCount = 0,
  failureCount = 0,
  failures = [],
} = {}) {
  return {
    attemptedCount: Number.isFinite(attemptedCount) ? Math.max(0, Math.floor(attemptedCount)) : 0,
    successCount: Number.isFinite(successCount) ? Math.max(0, Math.floor(successCount)) : 0,
    failureCount: Number.isFinite(failureCount) ? Math.max(0, Math.floor(failureCount)) : 0,
    failures: Array.isArray(failures) ? failures : [],
  };
}

function createInvalidInjectionSummaryError(fieldName) {
  const error = new Error(`CONTENT_SCRIPT_INJECTION_SUMMARY_INVALID:${fieldName}`);
  error.code = 'CONTENT_SCRIPT_INJECTION_SUMMARY_INVALID';
  error.field = fieldName;
  return error;
}

function requireInjectionSummaryCount(summary, fieldName) {
  if (!Number.isInteger(summary[fieldName]) || summary[fieldName] < 0) {
    throw createInvalidInjectionSummaryError(fieldName);
  }
  return summary[fieldName];
}

export function requireInjectionSummary(summary) {
  if (!isPlainObject(summary)) {
    throw createInvalidInjectionSummaryError('summary');
  }
  if (!Array.isArray(summary.failures)) {
    throw createInvalidInjectionSummaryError('failures');
  }
  const validated = {
    attemptedCount: requireInjectionSummaryCount(summary, 'attemptedCount'),
    successCount: requireInjectionSummaryCount(summary, 'successCount'),
    failureCount: requireInjectionSummaryCount(summary, 'failureCount'),
    failures: summary.failures,
  };
  if (validated.attemptedCount !== validated.successCount + validated.failureCount) {
    throw createInvalidInjectionSummaryError('attemptedCount');
  }
  if (validated.failures.length !== validated.failureCount) {
    throw createInvalidInjectionSummaryError('failures.length');
  }
  return validated;
}

export function normalizeCatchUpConcurrency(limit, fallback = DEFAULT_CATCH_UP_CONCURRENCY) {
  const value = Number(limit);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(MAX_CATCH_UP_CONCURRENCY, Math.max(1, Math.floor(value)));
}

export function normalizeDiagnosticsTabId(tabId) {
  if (tabId === null || typeof tabId === 'undefined') return null;
  if (typeof tabId === 'string' && !tabId.trim()) return null;
  const value = Number(tabId);
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

export function assertContentRuntimeDiagnostics(contentRuntimeDiagnostics) {
  if (
    !contentRuntimeDiagnostics
    || typeof contentRuntimeDiagnostics.getMeta !== 'function'
    || typeof contentRuntimeDiagnostics.list !== 'function'
    || typeof contentRuntimeDiagnostics.record !== 'function'
  ) {
    const error = new Error('CONTENT_RUNTIME_DIAGNOSTICS_REQUIRED');
    error.code = 'CONTENT_RUNTIME_DIAGNOSTICS_REQUIRED';
    throw error;
  }
  return contentRuntimeDiagnostics;
}

export function normalizeCatchUpTargets(catchUpTabs = []) {
  if (!Array.isArray(catchUpTabs)) return [];
  const seenTabIds = new Set();
  return catchUpTabs
    .filter((entry) => Number.isInteger(Number(entry?.tabId)))
    .map((entry) => ({
      tabId: Number(entry.tabId),
      url: typeof entry?.url === 'string' ? entry.url : '',
    }))
    .filter((entry) => {
      if (seenTabIds.has(entry.tabId)) return false;
      seenTabIds.add(entry.tabId);
      return true;
    });
}

export function createCatchUpReadinessFailureError(summary, catchUpTabs, reason) {
  const catchUpReadinessSummary = requireInjectionSummary(summary);
  const failureCount = catchUpReadinessSummary.failureCount;
  // Preserve the owning readiness reason through code/name/message-only error
  // projections (console and propagation checkpoint), without copying page URLs.
  const failures = catchUpReadinessSummary.failures.slice(0, 8).map((failure) => ({
    tabId: failure.tabId,
    reason: typeof failure.reason === 'string' ? failure.reason.slice(0, 240) : null,
    error: String(failure.error).slice(0, 240),
  }));
  const diagnostic = JSON.stringify({ failureCount, failures,
    omittedCount: Math.max(0, catchUpReadinessSummary.failures.length - failures.length) });
  const error = new Error(`CONTENT_SCRIPT_CATCH_UP_READINESS_FAILED:${failureCount} summary=${diagnostic}`);
  error.code = 'CONTENT_SCRIPT_CATCH_UP_READINESS_FAILED';
  error.catchUpReadinessSummary = catchUpReadinessSummary;
  error.catchUpTabs = normalizeCatchUpTargets(catchUpTabs);
  error.reason = normalizeReason(reason, 'sync');
  return error;
}

function createInvalidSyncResultError(fieldName) {
  const error = new Error(`CONTENT_SCRIPT_SYNC_RESULT_INVALID:${fieldName}`);
  error.code = 'CONTENT_SCRIPT_SYNC_RESULT_INVALID';
  error.field = fieldName;
  return error;
}

function requireSyncResultObject(result) {
  if (!isPlainObject(result)) {
    throw createInvalidSyncResultError('result');
  }
  return result;
}

function requireSyncResultArray(result, fieldName) {
  if (!Array.isArray(result?.[fieldName])) {
    throw createInvalidSyncResultError(fieldName);
  }
  return result[fieldName];
}

function requireSyncResultBoolean(result, fieldName) {
  if (typeof result?.[fieldName] !== 'boolean') {
    throw createInvalidSyncResultError(fieldName);
  }
  return result[fieldName];
}

function requireSyncResultCatchUpTabs(result) {
  return requireSyncResultArray(result, 'catchUpTabs').map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw createInvalidSyncResultError(`catchUpTabs.${index}`);
    }
    const tabId = Number(entry.tabId);
    if (!Number.isInteger(tabId) || tabId < 0) {
      throw createInvalidSyncResultError(`catchUpTabs.${index}.tabId`);
    }
    if (typeof entry.url !== 'string') {
      throw createInvalidSyncResultError(`catchUpTabs.${index}.url`);
    }
    return {
      tabId,
      url: entry.url,
    };
  });
}

function createInitialMediaFrameSnapshot(mediaFrameScriptFiles = []) {
  return {
    scriptId: null,
    js: mediaFrameScriptFiles,
    allFrames: true,
    registered: false,
    matches: [],
  };
}

function requireSyncResultStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw createInvalidSyncResultError(fieldName);
  }
  return value;
}

function requireSyncResultMediaFrameSnapshot(result) {
  const mediaFrame = result.mediaFrame;
  if (!isPlainObject(mediaFrame)) {
    throw createInvalidSyncResultError('mediaFrame');
  }
  if (
    mediaFrame.scriptId !== null
    && (typeof mediaFrame.scriptId !== 'string' || !mediaFrame.scriptId.trim())
  ) {
    throw createInvalidSyncResultError('mediaFrame.scriptId');
  }
  if (typeof mediaFrame.allFrames !== 'boolean') {
    throw createInvalidSyncResultError('mediaFrame.allFrames');
  }
  if (typeof mediaFrame.registered !== 'boolean') {
    throw createInvalidSyncResultError('mediaFrame.registered');
  }
  return {
    scriptId: typeof mediaFrame.scriptId === 'string' ? mediaFrame.scriptId.trim() : null,
    js: requireSyncResultStringArray(mediaFrame.js, 'mediaFrame.js'),
    allFrames: mediaFrame.allFrames,
    registered: mediaFrame.registered,
    matches: requireSyncResultStringArray(mediaFrame.matches, 'mediaFrame.matches'),
  };
}

export function createInitialSyncSnapshot(scriptFiles = [], mediaFrameScriptFiles = []) {
  return {
    registeredDomains: [],
    missingDomains: [],
    hasScripting: true,
    matches: [],
    scriptFiles,
    mediaFrame: createInitialMediaFrameSnapshot(mediaFrameScriptFiles),
    catchUpTabs: [],
    injectionSummary: null,
  };
}

export function normalizeSyncSnapshot(result, mediaFrameScriptFiles = []) {
  const source = requireSyncResultObject(result);
  return {
    registeredDomains: requireSyncResultArray(source, 'registeredDomains'),
    missingDomains: requireSyncResultArray(source, 'missingDomains'),
    hasScripting: requireSyncResultBoolean(source, 'hasScripting'),
    matches: requireSyncResultArray(source, 'matches'),
    scriptFiles: requireSyncResultArray(source, 'scriptFiles'),
    mediaFrame: requireSyncResultMediaFrameSnapshot(source),
    catchUpTabs: requireSyncResultCatchUpTabs(source),
    injectionSummary: requireInjectionSummary(source.injectionSummary),
  };
}
