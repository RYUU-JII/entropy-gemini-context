import { STORAGE_SESSION_KEYS } from '../../../../platform/storage/runtime/RuntimeSessionRepository.js';

const reportedRunIdFailureCodes = new Set();

export const NUDGE_SESSION_KEYS = Object.freeze({
  PENDING: STORAGE_SESSION_KEYS.NUDGE_PENDING,
  DEBT: STORAGE_SESSION_KEYS.NUDGE_DEBT,
  LEASE: STORAGE_SESSION_KEYS.NUDGE_LEASE,
  TERMINAL: STORAGE_SESSION_KEYS.NUDGE_TERMINAL,
  TERMINAL_OUTBOX: STORAGE_SESSION_KEYS.NUDGE_TERMINAL_OUTBOX,
  SHOWN: STORAGE_SESSION_KEYS.NUDGE_SHOWN,
  ACK: STORAGE_SESSION_KEYS.NUDGE_ACK,
});

function describeSessionMapValue(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

export function readNudgeSessionMap(session, key) {
  const value = session?.[key];
  if (value === undefined || value === null) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  throw new Error(`nudge_session_map_invalid:${key}:${describeSessionMapValue(value)}`);
}

export function reportNudgeRunIdGenerationFailure(error, consoleRef = console) {
  const diagnostic = {
    code: 'nudge_run_id_crypto_random_uuid_failed',
    error: String(error?.message || error || 'run_id_generation_failed'),
  };
  if (
    !reportedRunIdFailureCodes.has(diagnostic.code)
    && consoleRef
    && typeof consoleRef.warn === 'function'
  ) {
    reportedRunIdFailureCodes.add(diagnostic.code);
    consoleRef.warn('[nudge session] run id crypto source failed', diagnostic);
  }
  return diagnostic;
}

export function createNudgeRunId({
  cryptoRef = globalThis.crypto,
  random = Math.random,
  now = Date.now,
  consoleRef = console,
} = {}) {
  try {
    if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  } catch (error) {
    reportNudgeRunIdGenerationFailure(error, consoleRef);
  }
  return `nudge_${now().toString(36)}_${random().toString(36).slice(2, 10)}`;
}

export function getNudgeDayKey(dateStr, hostname) {
  return `${dateStr}|${hostname}`;
}

export const NUDGE_GLOBAL_PROTOCOL_DAY_HOST = '__global_protocol__';

export function getNudgeGlobalProtocolDayKey(dateStr) {
  return getNudgeDayKey(dateStr, NUDGE_GLOBAL_PROTOCOL_DAY_HOST);
}

export function resolveNudgeHostnameFromDayKey(key) {
  if (typeof key !== 'string') return '';
  const separatorAt = key.indexOf('|');
  if (separatorAt < 0) return '';
  const hostname = key.slice(separatorAt + 1).trim().toLowerCase();
  return hostname === NUDGE_GLOBAL_PROTOCOL_DAY_HOST ? '' : hostname;
}
