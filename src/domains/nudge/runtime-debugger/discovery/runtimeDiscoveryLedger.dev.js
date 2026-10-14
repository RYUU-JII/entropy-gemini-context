const RUNTIME_DISCOVERY_LEDGER_SCHEMA_VERSION = 1;
const RUNTIME_DISCOVERY_RECORD_LIMIT = 4096;
const RUNTIME_DISCOVERY_FLUSH_LIMIT = 20;

const OWNER_IDS = new Set([
  'socialMetrics',
  'shortForm',
]);

const DISCOVERY_PHASES = new Set([
  'scan_root',
  'candidate_visit',
  'effect_target',
]);

const WORK_REASONS = new Set([
  'relevant_mutation',
  'activation_configuration_transition',
  'direct_owner_request',
  'scheduled_full_scope',
  'navigation_refresh',
  'unknown',
]);

let generation = 0;
let state = createState(false);

function createState(active) {
  return {
    active,
    nodeIds: new WeakMap(),
    nextNodeId: 1,
    nextRecordId: 1,
    recordsByKey: new Map(),
    visitCount: 0,
    droppedVisitCount: 0,
    recordOverheadMs: 0,
    recordOverheadMaxMs: 0,
    recordCallCount: 0,
    recordOverheadByOwner: {
      socialMetrics: 0,
      shortForm: 0,
    },
    recordCallCountByOwner: {
      socialMetrics: 0,
      shortForm: 0,
    },
    snapshotReadOverheadMs: 0,
    snapshotReadOverheadMaxMs: 0,
    snapshotReadCount: 0,
  };
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function roundMs(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(3)) : 0;
}

function isObjectKey(value) {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function normalizeToken(value, fallback = 'unknown') {
  const token = String(value || '').trim();
  if (!token || token.length > 64 || !/^[a-z0-9_:-]+$/i.test(token)) return fallback;
  return token;
}

function normalizeFlushIds(value) {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values
    .map(Number)
    .filter((entry) => Number.isSafeInteger(entry) && entry > 0))]
    .sort((left, right) => left - right)
    .slice(-RUNTIME_DISCOVERY_FLUSH_LIMIT);
}

function getNodeId(node) {
  const existing = state.nodeIds.get(node);
  if (existing) return existing;
  const nodeId = state.nextNodeId;
  state.nextNodeId += 1;
  state.nodeIds.set(node, nodeId);
  return nodeId;
}

function createRecordKey(record) {
  return [
    record.ownerId,
    record.phase,
    record.nodeId,
    record.workReason,
    record.ownerReason,
    record.source,
    record.flushIds.join(','),
  ].join('|');
}

export function beginRuntimeDiscoverySession() {
  generation += 1;
  state = createState(true);
  return generation;
}

export function resetRuntimeDiscoverySession() {
  return beginRuntimeDiscoverySession();
}

export function stopRuntimeDiscoverySession() {
  const wasActive = state.active;
  state.active = false;
  return wasActive;
}

/**
 * Records identity only for nodes an owner already holds. This seam performs no
 * selector, traversal, text, attribute, or layout read of its own.
 */
export function recordRuntimeDiscoveryVisit({
  ownerId,
  phase,
  node,
  flushIds = [],
  workReason = 'unknown',
  ownerReason = 'unknown',
  source = 'unknown',
} = {}) {
  if (!state.active || !OWNER_IDS.has(ownerId) || !DISCOVERY_PHASES.has(phase)) {
    return false;
  }
  const startedAt = nowMs();
  try {
    if (!isObjectKey(node)) return false;
    const normalizedWorkReason = WORK_REASONS.has(workReason) ? workReason : 'unknown';
    const nodeId = getNodeId(node);
    const record = {
      id: state.nextRecordId,
      ownerId,
      phase,
      nodeId,
      flushIds: normalizeFlushIds(flushIds),
      workReason: normalizedWorkReason,
      ownerReason: normalizeToken(ownerReason),
      source: normalizeToken(source),
      visitCount: 1,
    };
    const key = createRecordKey(record);
    const existing = state.recordsByKey.get(key);
    state.visitCount += 1;
    if (existing) {
      existing.visitCount += 1;
      return true;
    }
    if (state.recordsByKey.size >= RUNTIME_DISCOVERY_RECORD_LIMIT) {
      state.droppedVisitCount += 1;
      return false;
    }
    state.nextRecordId += 1;
    state.recordsByKey.set(key, record);
    return true;
  } finally {
    const elapsedMs = Math.max(0, nowMs() - startedAt);
    state.recordOverheadMs += elapsedMs;
    state.recordOverheadMaxMs = Math.max(state.recordOverheadMaxMs, elapsedMs);
    state.recordCallCount += 1;
    state.recordOverheadByOwner[ownerId] += elapsedMs;
    state.recordCallCountByOwner[ownerId] += 1;
  }
}

export function readRuntimeDiscoveryLedgerSnapshot() {
  const startedAt = nowMs();
  const records = Array.from(state.recordsByKey.values(), (record) => ({
    ...record,
    flushIds: [...record.flushIds],
  }));
  const uniqueNodeCount = new Set(records.map((record) => record.nodeId)).size;
  const measured = records.length > 0;
  const elapsedMs = Math.max(0, nowMs() - startedAt);
  state.snapshotReadOverheadMs += elapsedMs;
  state.snapshotReadOverheadMaxMs = Math.max(state.snapshotReadOverheadMaxMs, elapsedMs);
  state.snapshotReadCount += 1;
  return {
    schemaVersion: RUNTIME_DISCOVERY_LEDGER_SCHEMA_VERSION,
    state: measured ? 'measured' : (state.active ? 'armed_idle' : 'inactive'),
    reason: measured
      ? 'runtime_discovery_identity_records_measured'
      : (state.active
        ? 'runtime_discovery_identity_armed_idle'
        : 'runtime_discovery_identity_session_inactive'),
    active: state.active,
    generation,
    complete: state.droppedVisitCount === 0,
    retentionLimit: RUNTIME_DISCOVERY_RECORD_LIMIT,
    recordCount: records.length,
    visitCount: state.visitCount,
    droppedVisitCount: state.droppedVisitCount,
    uniqueNodeCount,
    records,
    instrumentation: {
      identity: 'weakmap_numeric_node_id',
      retainsDomNodes: false,
      extraDomReads: 0,
      recordOverheadMs: roundMs(state.recordOverheadMs),
      recordOverheadMaxMs: roundMs(state.recordOverheadMaxMs),
      recordCallCount: state.recordCallCount,
      recordOverheadByOwner: {
        socialMetrics: roundMs(state.recordOverheadByOwner.socialMetrics),
        shortForm: roundMs(state.recordOverheadByOwner.shortForm),
      },
      recordCallCountByOwner: {
        ...state.recordCallCountByOwner,
      },
      snapshotReadOverheadMs: roundMs(state.snapshotReadOverheadMs),
      snapshotReadOverheadMaxMs: roundMs(state.snapshotReadOverheadMaxMs),
      snapshotReadCount: state.snapshotReadCount,
    },
  };
}
