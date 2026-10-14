import {
  TAB_NAVIGATION_STATE_SCHEMA_VERSION,
  normalizeHostname,
} from './navigationContinuityState.js';

const SNAPSHOT_KEYS = Object.freeze([
  'schemaVersion',
  'updatedAt',
  'completed',
  'committed',
  'created',
  'hosts',
  'foreground',
  'foregroundEvents',
]);
const COMPLETED_KEYS = Object.freeze([
  'tabId', 'hostname', 'normalizedUrl', 'completedAt', 'visitIntentReason',
]);
const COMMITTED_KEYS = Object.freeze([
  'tabId', 'hostname', 'normalizedUrl', 'committedAt', 'transitionType', 'transitionQualifiers',
]);
const CREATED_KEYS = Object.freeze(['tabId', 'createdAt', 'tabContextConsumed']);
const HOST_KEYS = Object.freeze([
  'hostname',
  'lastForegroundAt',
  'lastExitAt',
  'lastTabId',
  'lastUrl',
  'recentSwitchAts',
  'recentReturnAts',
  'recentlyAudibleUntil',
]);
const FOREGROUND_KEYS = Object.freeze(['hostname', 'tabId', 'activeAt']);
const FOREGROUND_EVENT_KEYS = Object.freeze(['hostname', 'tabId', 'at']);

function invalidNavigationCheckpoint(path = 'record') {
  throw new Error(`TAB_NAVIGATION_STATE_CONTRACT_INVALID:${path}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireExactRecord(value, keys, path) {
  if (!isPlainObject(value)) invalidNavigationCheckpoint(path);
  if (
    Object.keys(value).length !== keys.length
    || keys.some((key) => !Object.hasOwn(value, key))
  ) {
    invalidNavigationCheckpoint(`${path}.keys`);
  }
  return value;
}

function requireTimestamp(value, path, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || (positive ? value <= 0 : value < 0)
  ) {
    invalidNavigationCheckpoint(path);
  }
  return value;
}

function requireTabId(value, path, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    invalidNavigationCheckpoint(path);
  }
  return value;
}

function requireHostname(value, path, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') invalidNavigationCheckpoint(path);
  if (allowEmpty && value === '') return '';
  if (!value || normalizeHostname(value) !== value) invalidNavigationCheckpoint(path);
  return value;
}

function requireString(value, path, { nullable = false, nonEmpty = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || (nonEmpty && (!value || value.trim() !== value))) {
    invalidNavigationCheckpoint(path);
  }
  return value;
}

function requireTimestampArray(value, path) {
  if (!Array.isArray(value)) invalidNavigationCheckpoint(path);
  value.forEach((entry, index) => requireTimestamp(entry, `${path}[${index}]`, { positive: true }));
  return value;
}

function requireCompletedEntry(value, index) {
  const path = `completed[${index}]`;
  const entry = requireExactRecord(value, COMPLETED_KEYS, path);
  requireTabId(entry.tabId, `${path}.tabId`);
  requireHostname(entry.hostname, `${path}.hostname`);
  requireString(entry.normalizedUrl, `${path}.normalizedUrl`);
  requireTimestamp(entry.completedAt, `${path}.completedAt`);
  requireString(entry.visitIntentReason, `${path}.visitIntentReason`, { nullable: true });
}

function requireCommittedEntry(value, index) {
  const path = `committed[${index}]`;
  const entry = requireExactRecord(value, COMMITTED_KEYS, path);
  requireTabId(entry.tabId, `${path}.tabId`);
  requireHostname(entry.hostname, `${path}.hostname`);
  requireString(entry.normalizedUrl, `${path}.normalizedUrl`);
  requireTimestamp(entry.committedAt, `${path}.committedAt`);
  requireString(entry.transitionType, `${path}.transitionType`, { nullable: true, nonEmpty: true });
  if (!Array.isArray(entry.transitionQualifiers)) {
    invalidNavigationCheckpoint(`${path}.transitionQualifiers`);
  }
  entry.transitionQualifiers.forEach((qualifier, qualifierIndex) => {
    requireString(
      qualifier,
      `${path}.transitionQualifiers[${qualifierIndex}]`,
      { nonEmpty: true },
    );
  });
}

function requireCreatedEntry(value, index) {
  const path = `created[${index}]`;
  const entry = requireExactRecord(value, CREATED_KEYS, path);
  requireTabId(entry.tabId, `${path}.tabId`);
  requireTimestamp(entry.createdAt, `${path}.createdAt`, { positive: true });
  if (typeof entry.tabContextConsumed !== 'boolean') {
    invalidNavigationCheckpoint(`${path}.tabContextConsumed`);
  }
}

function requireHostEntry(value, index) {
  const path = `hosts[${index}]`;
  const entry = requireExactRecord(value, HOST_KEYS, path);
  requireHostname(entry.hostname, `${path}.hostname`);
  requireTimestamp(entry.lastForegroundAt, `${path}.lastForegroundAt`);
  requireTimestamp(entry.lastExitAt, `${path}.lastExitAt`);
  requireTabId(entry.lastTabId, `${path}.lastTabId`, { nullable: true });
  requireString(entry.lastUrl, `${path}.lastUrl`);
  requireTimestampArray(entry.recentSwitchAts, `${path}.recentSwitchAts`);
  requireTimestampArray(entry.recentReturnAts, `${path}.recentReturnAts`);
  requireTimestamp(entry.recentlyAudibleUntil, `${path}.recentlyAudibleUntil`);
}

function requireForeground(value) {
  const entry = requireExactRecord(value, FOREGROUND_KEYS, 'foreground');
  requireHostname(entry.hostname, 'foreground.hostname', { allowEmpty: true });
  requireTabId(entry.tabId, 'foreground.tabId', { nullable: true });
  requireTimestamp(entry.activeAt, 'foreground.activeAt');
  if (entry.hostname === '' && (entry.tabId !== null || entry.activeAt !== 0)) {
    invalidNavigationCheckpoint('foreground.state');
  }
}

function requireForegroundEvent(value, index) {
  const path = `foregroundEvents[${index}]`;
  const entry = requireExactRecord(value, FOREGROUND_EVENT_KEYS, path);
  requireHostname(entry.hostname, `${path}.hostname`);
  requireTabId(entry.tabId, `${path}.tabId`, { nullable: true });
  requireTimestamp(entry.at, `${path}.at`, { positive: true });
}

export function requireNavigationCheckpointReadResult(result) {
  if (
    !isPlainObject(result)
    || Object.keys(result).length !== 2
    || !Object.hasOwn(result, 'found')
    || !Object.hasOwn(result, 'value')
    || typeof result.found !== 'boolean'
    || (result.found === false && typeof result.value !== 'undefined')
  ) {
    throw new Error('TAB_NAVIGATION_STATE_READ_INVALID');
  }
  return result;
}

export function requireNavigationContinuitySnapshot(snapshot) {
  const source = requireExactRecord(snapshot, SNAPSHOT_KEYS, 'record');
  if (source.schemaVersion !== TAB_NAVIGATION_STATE_SCHEMA_VERSION) {
    invalidNavigationCheckpoint('schemaVersion');
  }
  requireTimestamp(source.updatedAt, 'updatedAt');

  [
    ['completed', requireCompletedEntry],
    ['committed', requireCommittedEntry],
    ['created', requireCreatedEntry],
    ['hosts', requireHostEntry],
    ['foregroundEvents', requireForegroundEvent],
  ].forEach(([fieldName, validator]) => {
    if (!Array.isArray(source[fieldName])) invalidNavigationCheckpoint(fieldName);
    source[fieldName].forEach(validator);
  });
  requireForeground(source.foreground);
  return source;
}
