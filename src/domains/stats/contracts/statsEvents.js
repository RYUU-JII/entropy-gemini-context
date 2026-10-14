import {
  normalizeStatsDateStr,
} from './statsContracts.js';

export const STATS_EVENT_VERSION = 1;
export const STATS_EVENT_SCHEMA_VERSION = 1;
export const STATS_EVENT_CHANNEL = 'stats';

export const STATS_EVENT_TYPES = Object.freeze({
  COMMITTED: 'stats_committed',
  ROLLOVER: 'stats_rollover',
  RESET: 'stats_reset',
});

const STATS_EVENT_TYPE_SET = new Set(Object.values(STATS_EVENT_TYPES));
const STATS_EVENT_KEYS = Object.freeze([
  'channel',
  'type',
  'version',
  'schemaVersion',
  'revision',
  'emittedAt',
  'source',
  'reason',
  'changedDates',
  'meta',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isKnownStatsEventType(type) {
  return typeof type === 'string' && STATS_EVENT_TYPE_SET.has(type);
}

export function normalizeChangedDates(changedDates, { maxItems = 31 } = {}) {
  if (!Array.isArray(changedDates) || changedDates.length === 0) return [];
  const max = Number.isFinite(Number(maxItems))
    ? Math.max(1, Math.floor(Number(maxItems)))
    : 31;

  const dedupe = new Set();
  const out = [];

  for (const raw of changedDates) {
    if (out.length >= max) break;
    const normalized = normalizeStatsDateStr(raw, null);
    if (!normalized || dedupe.has(normalized)) continue;
    dedupe.add(normalized);
    out.push(normalized);
  }

  out.sort();
  return out;
}

function buildStatsEvent({
  type,
  changedDates = [],
  reason = 'unspecified',
  source = 'background',
  revision = 0,
  emittedAt = Date.now(),
  meta = {},
} = {}) {
  if (!isKnownStatsEventType(type)) {
    const error = new Error('STATS_EVENT_TYPE_REQUIRED');
    error.code = 'STATS_EVENT_TYPE_REQUIRED';
    throw error;
  }

  return {
    channel: STATS_EVENT_CHANNEL,
    type,
    version: STATS_EVENT_VERSION,
    schemaVersion: STATS_EVENT_SCHEMA_VERSION,
    revision: Number.isFinite(Number(revision)) ? Number(revision) : 0,
    emittedAt: Number.isFinite(Number(emittedAt)) ? Number(emittedAt) : Date.now(),
    source: typeof source === 'string' && source.trim().length > 0 ? source.trim() : 'background',
    reason: typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : 'unspecified',
    changedDates: normalizeChangedDates(changedDates),
    meta: isPlainObject(meta) ? { ...meta } : {},
  };
}

export function buildStatsCommittedEvent({
  changedDates = [],
  reason = 'commit',
  revision = 0,
  emittedAt = Date.now(),
  meta = {},
} = {}) {
  return buildStatsEvent({
    type: STATS_EVENT_TYPES.COMMITTED,
    changedDates,
    reason,
    revision,
    emittedAt,
    meta,
  });
}

export function buildStatsRolloverEvent({
  changedDates = [],
  reason = 'rollover',
  revision = 0,
  emittedAt = Date.now(),
  meta = {},
} = {}) {
  return buildStatsEvent({
    type: STATS_EVENT_TYPES.ROLLOVER,
    changedDates,
    reason,
    revision,
    emittedAt,
    meta,
  });
}

export function buildStatsResetEvent({
  changedDates = [],
  reason = 'reset',
  revision = 0,
  emittedAt = Date.now(),
  meta = {},
} = {}) {
  return buildStatsEvent({
    type: STATS_EVENT_TYPES.RESET,
    changedDates,
    reason,
    revision,
    emittedAt,
    meta,
  });
}

export function validateStatsEvent(event) {
  if (!isPlainObject(event)) {
    return { ok: false, error: 'EVENT_NOT_OBJECT' };
  }
  if (
    Object.keys(event).length !== STATS_EVENT_KEYS.length
    || STATS_EVENT_KEYS.some((key) => !Object.hasOwn(event, key))
  ) {
    return { ok: false, error: 'EVENT_SHAPE_INVALID' };
  }
  if (event.channel !== STATS_EVENT_CHANNEL) {
    return { ok: false, error: 'EVENT_CHANNEL_INVALID' };
  }
  if (!isKnownStatsEventType(event.type)) {
    return { ok: false, error: 'EVENT_TYPE_INVALID' };
  }
  if (event.version !== STATS_EVENT_VERSION) {
    return { ok: false, error: 'EVENT_VERSION_INVALID' };
  }
  if (event.schemaVersion !== STATS_EVENT_SCHEMA_VERSION) {
    return { ok: false, error: 'EVENT_SCHEMA_VERSION_INVALID' };
  }
  if (!Number.isFinite(event.revision) || event.revision < 0) {
    return { ok: false, error: 'EVENT_REVISION_INVALID' };
  }
  if (!Number.isFinite(event.emittedAt) || event.emittedAt < 0) {
    return { ok: false, error: 'EVENT_EMITTED_AT_INVALID' };
  }
  if (typeof event.source !== 'string' || !event.source.trim()) {
    return { ok: false, error: 'EVENT_SOURCE_INVALID' };
  }
  if (typeof event.reason !== 'string' || !event.reason.trim()) {
    return { ok: false, error: 'EVENT_REASON_INVALID' };
  }
  if (!Array.isArray(event.changedDates)) {
    return { ok: false, error: 'EVENT_CHANGED_DATES_INVALID' };
  }
  for (const dateStr of event.changedDates) {
    if (typeof dateStr !== 'string' || normalizeStatsDateStr(dateStr, null) !== dateStr) {
      return { ok: false, error: 'EVENT_CHANGED_DATE_INVALID' };
    }
  }
  if (!isPlainObject(event.meta)) {
    return { ok: false, error: 'EVENT_META_INVALID' };
  }
  return { ok: true, error: null };
}
