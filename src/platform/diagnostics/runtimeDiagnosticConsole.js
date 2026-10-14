import { BUILD_INCLUDE_DEBUG_TOOLS } from '../build/releaseCapabilities.js';

const RUNTIME_DIAGNOSTIC_SEVERITIES = new Set([
  'debug',
  'info',
  'warn',
  'error',
]);

export function isRuntimeDiagnosticConsoleEnabled() {
  return BUILD_INCLUDE_DEBUG_TOOLS === true;
}

function normalizeToken(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function formatValue(value) {
  if (value === null || typeof value === 'undefined') return 'none';
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim() || 'empty';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((entry) => formatValue(entry)).join(',');
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return 'unserializable';
  }
}

function resolveErrorCode(error, fallback) {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  return code || fallback;
}

const MAX_ERROR_CAUSE_DEPTH = 8;

function describeErrorLink(error) {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  if (code) return code;
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'unknown';
}

export function formatErrorCauseChain(error) {
  const links = [];
  const seen = new Set();
  let current = error?.cause;
  while (current && links.length < MAX_ERROR_CAUSE_DEPTH) {
    if (typeof current === 'object') {
      if (seen.has(current)) break;
      seen.add(current);
    }
    links.push(describeErrorLink(current));
    current = current?.cause;
  }
  return links.join('<-');
}

// Names a thrown value for humans: its message, else its code, else a serialization.
// Never "[object Object]" -- a diagnostic that cannot name its error is not a diagnostic.
export function describeErrorMessage(error, fallback) {
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error?.code === 'string' && error.code.trim()) return error.code.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error === 'object') {
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') return serialized;
    } catch (_error) {
      // Fall through to the declared fallback.
    }
  }
  return fallback;
}

function resolveErrorMessage(error, fallback) {
  return describeErrorMessage(error, fallback);
}

export function formatRuntimeDiagnostic({
  scope,
  severity,
  event,
  code,
  error = null,
  fields = {},
} = {}) {
  const normalizedScope = normalizeToken(scope, 'Runtime');
  const normalizedSeverity = RUNTIME_DIAGNOSTIC_SEVERITIES.has(severity)
    ? severity
    : 'error';
  const normalizedEvent = normalizeToken(event, 'runtime_failure');
  const normalizedCode = resolveErrorCode(error, normalizeToken(code, 'RUNTIME_FAILURE'));
  const errorMessage = resolveErrorMessage(error, normalizedCode);
  const causeChain = formatErrorCauseChain(error);
  const fieldParts = Object.entries(fields || {})
    .filter(([key]) => typeof key === 'string' && key.trim())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key.trim()}=${formatValue(value)}`);
  return [
    `[${normalizedScope}]`,
    `severity=${normalizedSeverity}`,
    `event=${normalizedEvent}`,
    `code=${normalizedCode}`,
    ...fieldParts,
    ...(causeChain ? [`cause=${formatValue(causeChain)}`] : []),
    `error=${formatValue(errorMessage)}`,
  ].join(' ');
}

export function reportRuntimeDiagnostic(input, consoleRef = console, options = {}) {
  const enabled = typeof options?.enabled === 'boolean'
    ? options.enabled
    : isRuntimeDiagnosticConsoleEnabled();
  if (!enabled) return false;

  const severity = RUNTIME_DIAGNOSTIC_SEVERITIES.has(input?.severity)
    ? input.severity
    : 'error';
  const writer = consoleRef?.[severity];
  if (typeof writer !== 'function') return false;
  writer.call(consoleRef, formatRuntimeDiagnostic({ ...input, severity }));
  return true;
}
