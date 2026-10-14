import { normalizeWorkerStatsSnapshot } from '../nudge/index.js';

export const NUDGE_RUNTIME_EVENT = Object.freeze({
  START_INIT: 'START_INIT',
  START_ROOT: 'START_ROOT',
  START_THEME: 'START_THEME',
  START_STATE: 'START_STATE',
  START_HUD: 'START_HUD',
  START_RUNTIME: 'START_RUNTIME',
  START_LOOP: 'START_LOOP',
  START_FAIL: 'START_FAIL',
  PREWARM_BEGIN: 'PREWARM_BEGIN',
  PREWARM_READY: 'PREWARM_READY',
  PREWARM_FAIL: 'PREWARM_FAIL',
  WORKER_ACTIVATE_BEGIN: 'WORKER_ACTIVATE_BEGIN',
  WORKER_ACTIVATE_SUCCESS: 'WORKER_ACTIVATE_SUCCESS',
  WORKER_ACTIVATE_FAIL: 'WORKER_ACTIVATE_FAIL',
  WORKER_READY: 'WORKER_READY',
  WORKER_STATS: 'WORKER_STATS',
  WORKER_SPAWN_REQUESTED: 'WORKER_SPAWN_REQUESTED',
  WORKER_SPAWN_ACCEPTED: 'WORKER_SPAWN_ACCEPTED',
  WORKER_SPAWN_RENDERED: 'WORKER_SPAWN_RENDERED',
  WORKER_SPAWN_REJECTED: 'WORKER_SPAWN_REJECTED',
  WORKER_ERROR: 'WORKER_ERROR',
  WORKER_DEACTIVATE: 'WORKER_DEACTIVATE',
  MAIN_ACTIVE: 'MAIN_ACTIVE',
  MAIN_ERROR: 'MAIN_ERROR',
  STOP_BEGIN: 'STOP_BEGIN',
  STOP_COMPLETE: 'STOP_COMPLETE',
  RESET: 'RESET',
});

function baseState() {
  return {
    stage: 'idle',
    runtimeMode: 'none',
    sessionId: 0,
    lastError: '',
    stats: normalizeWorkerStatsSnapshot(null),
    telemetry: null,
  };
}

export function createNudgeRuntimeState() {
  return baseState();
}

function sameStageTransition(state, patch = {}) {
  return {
    ...state,
    ...patch,
  };
}

function withStage(state, stage, patch = {}) {
  return {
    ...state,
    stage,
    ...patch,
  };
}

function withError(state, stage, error, patch = {}) {
  return {
    ...state,
    stage,
    lastError: typeof error === 'string' ? error : String(error?.message || error || ''),
    ...patch,
  };
}

function canStartAdvance(stage, expected) {
  return stage === expected;
}

function normalizeTelemetryObject(value) {
  return value && typeof value === 'object' ? value : null;
}

function mergeTelemetrySnapshot(currentTelemetry, nextTelemetry) {
  const currentSource = normalizeTelemetryObject(currentTelemetry);
  const nextSource = normalizeTelemetryObject(nextTelemetry);
  if (!nextSource) return currentTelemetry ?? null;
  return {
    ...(currentSource || {}),
    ...nextSource,
    spawnLifecycle: nextSource.spawnLifecycle || currentSource?.spawnLifecycle || null,
  };
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toCount(value, fallback = 0) {
  return Math.max(0, Math.round(toFiniteNumber(value, fallback)));
}

function toNonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function toPositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeSpawnLifecycle(payload, phase, previous = null) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const prev = previous && typeof previous === 'object' ? previous : {};
  const requestId = toCount(source.requestId, prev.requestId || 0);
  const workerClock = source.workerClock && typeof source.workerClock === 'object'
    ? source.workerClock
    : (prev.workerClock && typeof prev.workerClock === 'object' ? prev.workerClock : null);
  return {
    ...prev,
    phase,
    requestId,
    reason: typeof source.reason === 'string' && source.reason.trim()
      ? source.reason.trim()
      : (prev.reason || 'spawn'),
    requestedAtMs: toFiniteNumber(source.requestedAtMs, prev.requestedAtMs || 0),
    acceptedAtMs: toFiniteNumber(source.acceptedAtMs, prev.acceptedAtMs || 0),
    renderedAtMs: toFiniteNumber(source.renderedAtMs, prev.renderedAtMs || 0),
    rejectedAtMs: toFiniteNumber(source.rejectedAtMs, prev.rejectedAtMs || 0),
    liveCount: toCount(source.liveCount, prev.liveCount || 0),
    totalSpawned: toCount(source.totalSpawned, prev.totalSpawned || 0),
    totalSplitSpawned: toCount(source.totalSplitSpawned, prev.totalSplitSpawned || 0),
    renderedCount: toCount(source.renderedCount, prev.renderedCount || 0),
    frameCount: toCount(source.frameCount, prev.frameCount || 0),
    rejectReason: typeof source.rejectReason === 'string' && source.rejectReason.trim()
      ? source.rejectReason.trim()
      : (phase === 'rejected' ? (prev.rejectReason || 'rejected') : ''),
    workerClock,
  };
}

function withSpawnLifecycle(state, phase, payload = {}) {
  const currentTelemetry = normalizeTelemetryObject(state.telemetry) || {};
  const spawnLifecycle = normalizeSpawnLifecycle(
    payload,
    phase,
    currentTelemetry.spawnLifecycle,
  );
  return sameStageTransition(state, {
    telemetry: {
      ...currentTelemetry,
      spawnLifecycle,
    },
  });
}

export function transitionNudgeRuntime(state, event) {
  const current = state && typeof state === 'object' ? state : baseState();
  const type = typeof event?.type === 'string' ? event.type : '';
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};

  switch (type) {
    case NUDGE_RUNTIME_EVENT.START_INIT:
      return withStage(baseState(), 'start:init');

    case NUDGE_RUNTIME_EVENT.START_ROOT:
      return canStartAdvance(current.stage, 'start:init')
        ? withStage(current, 'start:root')
        : current;

    case NUDGE_RUNTIME_EVENT.START_THEME:
      return canStartAdvance(current.stage, 'start:root')
        ? withStage(current, 'start:theme')
        : current;

    case NUDGE_RUNTIME_EVENT.START_STATE:
      return canStartAdvance(current.stage, 'start:theme')
        ? withStage(current, 'start:state')
        : current;

    case NUDGE_RUNTIME_EVENT.START_HUD:
      return canStartAdvance(current.stage, 'start:state')
        ? withStage(current, 'start:hud')
        : current;

    case NUDGE_RUNTIME_EVENT.START_RUNTIME:
      return canStartAdvance(current.stage, 'start:hud')
        ? withStage(current, 'start:runtime')
        : current;

    case NUDGE_RUNTIME_EVENT.START_LOOP:
      if (current.runtimeMode === 'worker') {
        return current;
      }
      return (
        current.stage === 'start:runtime'
        || current.stage === 'main:active'
      )
        ? withStage(current, 'start:loop')
        : current;

    case NUDGE_RUNTIME_EVENT.START_FAIL:
      return withError(current, 'start:failed', payload.error, {
        runtimeMode: 'none',
        sessionId: 0,
      });

    case NUDGE_RUNTIME_EVENT.PREWARM_BEGIN:
      return current.runtimeMode === 'none'
        ? withStage(current, 'worker:prewarming', { lastError: '' })
        : current;

    case NUDGE_RUNTIME_EVENT.PREWARM_READY:
      if (current.stage !== 'worker:prewarming') {
        return current;
      }
      {
        const sessionId = toNonNegativeInteger(payload.sessionId);
        return sessionId === null
          ? withError(current, 'worker:prewarm-failed', 'worker:invalid_session_id')
          : withStage(current, 'worker:prewarmed', { sessionId });
      }

    case NUDGE_RUNTIME_EVENT.PREWARM_FAIL:
      return current.stage === 'worker:prewarming'
        ? withError(current, 'worker:prewarm-failed', payload.error)
        : current;

    case NUDGE_RUNTIME_EVENT.WORKER_ACTIVATE_BEGIN:
      return (
        current.stage === 'start:runtime'
        || current.stage === 'main:active'
        || current.stage === 'worker:prewarmed'
        || current.stage === 'idle'
      )
        ? withStage(current, 'worker:activating', {
          runtimeMode: 'worker',
          sessionId: 0,
          lastError: '',
          telemetry: null,
        })
        : current;

    case NUDGE_RUNTIME_EVENT.WORKER_ACTIVATE_SUCCESS:
      if (current.stage !== 'worker:activating') {
        return current;
      }
      {
        const sessionId = toPositiveInteger(payload.sessionId);
        return sessionId === null
          ? withError(current, 'worker:activate-failed', 'worker:invalid_session_id', {
            runtimeMode: 'none',
            sessionId: 0,
          })
          : withStage(current, 'worker:booting', {
            runtimeMode: 'worker',
            sessionId,
            stats: normalizeWorkerStatsSnapshot(payload.stats, current.stats),
            telemetry: null,
          });
      }

    case NUDGE_RUNTIME_EVENT.WORKER_ACTIVATE_FAIL:
      return current.stage === 'worker:activating'
        ? withError(current, 'worker:activate-failed', payload.error, {
          runtimeMode: 'none',
          sessionId: 0,
        })
        : current;

    case NUDGE_RUNTIME_EVENT.WORKER_READY:
      return (
        current.stage === 'worker:booting'
        || current.stage === 'start:loop'
      )
        ? withStage(current, 'worker:ready', { runtimeMode: 'worker' })
        : current;

    case NUDGE_RUNTIME_EVENT.WORKER_STATS:
      return current.runtimeMode === 'worker'
        ? withStage(current, 'worker:active', {
          stats: normalizeWorkerStatsSnapshot(payload.stats, current.stats),
          telemetry: mergeTelemetrySnapshot(current.telemetry, payload.telemetry),
        })
        : current;

    case NUDGE_RUNTIME_EVENT.WORKER_SPAWN_REQUESTED:
      return current.runtimeMode === 'worker'
        ? withSpawnLifecycle(current, 'requested', payload)
        : current;

    case NUDGE_RUNTIME_EVENT.WORKER_SPAWN_ACCEPTED:
      return current.runtimeMode === 'worker'
        ? withSpawnLifecycle(current, 'accepted', payload)
        : current;

    case NUDGE_RUNTIME_EVENT.WORKER_SPAWN_RENDERED:
      return current.runtimeMode === 'worker'
        ? withSpawnLifecycle(current, 'rendered', payload)
        : current;

    case NUDGE_RUNTIME_EVENT.WORKER_SPAWN_REJECTED:
      return current.runtimeMode === 'worker'
        ? withSpawnLifecycle(current, 'rejected', payload)
        : current;

    case NUDGE_RUNTIME_EVENT.WORKER_ERROR:
      return current.runtimeMode === 'worker'
        ? withError(current, 'worker:error', payload.error, {
          runtimeMode: 'none',
          sessionId: 0,
          stats: normalizeWorkerStatsSnapshot(payload.stats, current.stats),
          telemetry: mergeTelemetrySnapshot(current.telemetry, payload.telemetry),
        })
        : current;

    case NUDGE_RUNTIME_EVENT.WORKER_DEACTIVATE:
      return (
        current.runtimeMode === 'worker'
        || current.stage === 'worker:booting'
        || current.stage === 'worker:ready'
        || current.stage === 'worker:active'
        || current.stage === 'worker:error'
      )
        ? withStage(current, 'worker:deactivated', {
          runtimeMode: 'none',
          sessionId: 0,
          lastError: '',
        })
        : current;

    case NUDGE_RUNTIME_EVENT.MAIN_ACTIVE:
      return withStage(current, 'main:active', {
        runtimeMode: 'main',
        stats: normalizeWorkerStatsSnapshot(payload.stats, current.stats),
      });

    case NUDGE_RUNTIME_EVENT.MAIN_ERROR:
      return withError(current, 'main:error', payload.error, {
        runtimeMode: 'main',
      });

    case NUDGE_RUNTIME_EVENT.STOP_BEGIN:
      return withStage(current, 'stop:stopping');

    case NUDGE_RUNTIME_EVENT.STOP_COMPLETE:
    case NUDGE_RUNTIME_EVENT.RESET:
      return baseState();

    default:
      return current;
  }
}
