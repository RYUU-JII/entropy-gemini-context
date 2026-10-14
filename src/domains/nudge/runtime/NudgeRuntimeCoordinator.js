import NudgeWorkerSession from './NudgeWorkerSession.js';
import { NUDGE_WORKER_MESSAGE } from './NudgeProtocol.js';
import { normalizeRenderPressureLevel, normalizeWorkerStatsSnapshot } from '../nudge/index.js';
import {
  createNudgeRuntimeState,
  NUDGE_RUNTIME_EVENT,
  transitionNudgeRuntime,
} from './NudgeRuntimeMachine.js';
import {
  planNudgeRuntimeEffects,
  runNudgeRuntimeEffects,
} from './NudgeRuntimeEffectRunner.js';

function normalizeWorkerTelemetrySnapshot(input, fallback = null) {
  const source = input && typeof input === 'object' ? input : null;
  if (!source) return fallback;

  const toNumber = (value, previous = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : previous;
  };
  const toCount = (value, previous = 0) => Math.max(0, Math.round(toNumber(value, previous)));

  return {
    runtime: typeof source.runtime === 'string' ? source.runtime : (fallback?.runtime || 'zen_sentinel'),
    renderPressureLevel: normalizeRenderPressureLevel(
      source.renderPressureLevel,
      fallback?.renderPressureLevel,
    ),
    renderBudgetPolicyId: typeof source.renderBudgetPolicyId === 'string'
      ? source.renderBudgetPolicyId
      : (fallback?.renderBudgetPolicyId || ''),
    liveCount: toCount(source.liveCount, fallback?.liveCount || 0),
    activationFirstFrameMs: toNumber(source.activationFirstFrameMs, fallback?.activationFirstFrameMs || 0),
    activationFirstSpawnMs: toNumber(source.activationFirstSpawnMs, fallback?.activationFirstSpawnMs || 0),
    frameEmaMs: toNumber(source.frameEmaMs, fallback?.frameEmaMs || 0),
    framePeakMs: toNumber(source.framePeakMs, fallback?.framePeakMs || 0),
    updateEmaMs: toNumber(source.updateEmaMs, fallback?.updateEmaMs || 0),
    renderEmaMs: toNumber(source.renderEmaMs, fallback?.renderEmaMs || 0),
    renderPeakMs: toNumber(source.renderPeakMs, fallback?.renderPeakMs || 0),
    renderSyncEmaMs: toNumber(source.renderSyncEmaMs, fallback?.renderSyncEmaMs || 0),
    renderDrawEmaMs: toNumber(source.renderDrawEmaMs, fallback?.renderDrawEmaMs || 0),
    drawPerFishMs: toNumber(source.drawPerFishMs, fallback?.drawPerFishMs || 0),
    spawnEmaMs: toNumber(source.spawnEmaMs, fallback?.spawnEmaMs || 0),
    hitTestEmaMs: toNumber(source.hitTestEmaMs, fallback?.hitTestEmaMs || 0),
    slowFramePct: toNumber(source.slowFramePct, fallback?.slowFramePct || 0),
    renderSampleCount: toCount(source.renderSampleCount, fallback?.renderSampleCount || 0),
    spawnLifecycle: normalizeSpawnLifecycleSnapshot(source.spawnLifecycle, fallback?.spawnLifecycle || null),
  };
}

function normalizeSpawnLifecycleSnapshot(input, fallback = null) {
  const source = input && typeof input === 'object' ? input : null;
  if (!source) return fallback;

  const toNumber = (value, previous = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : previous;
  };
  const toCount = (value, previous = 0) => Math.max(0, Math.round(toNumber(value, previous)));
  const phase = typeof source.phase === 'string' && source.phase.trim()
    ? source.phase.trim()
    : (fallback?.phase || 'unknown');
  return {
    phase,
    requestId: toCount(source.requestId, fallback?.requestId || 0),
    reason: typeof source.reason === 'string' && source.reason.trim()
      ? source.reason.trim()
      : (fallback?.reason || 'spawn'),
    requestedAtMs: toNumber(source.requestedAtMs, fallback?.requestedAtMs || 0),
    acceptedAtMs: toNumber(source.acceptedAtMs, fallback?.acceptedAtMs || 0),
    renderedAtMs: toNumber(source.renderedAtMs, fallback?.renderedAtMs || 0),
    rejectedAtMs: toNumber(source.rejectedAtMs, fallback?.rejectedAtMs || 0),
    liveCount: toCount(source.liveCount, fallback?.liveCount || 0),
    totalSpawned: toCount(source.totalSpawned, fallback?.totalSpawned || 0),
    totalSplitSpawned: toCount(source.totalSplitSpawned, fallback?.totalSplitSpawned || 0),
    renderedCount: toCount(source.renderedCount, fallback?.renderedCount || 0),
    frameCount: toCount(source.frameCount, fallback?.frameCount || 0),
    rejectReason: typeof source.rejectReason === 'string' ? source.rejectReason : (fallback?.rejectReason || ''),
  };
}

function formatRuntimeFailure(error = null) {
  if (!error) return 'worker:runtime_failure';

  if (error instanceof Error) {
    const message = typeof error.message === 'string' && error.message.trim()
      ? error.message.trim()
      : error.name;
    const code = typeof error.code === 'string' && error.code.trim()
      ? error.code.trim()
      : '';
    if (code && message.startsWith(`${code}:`)) {
      return `worker:${message}`;
    }
    return code ? `worker:${code}:${message}` : `worker:${message}`;
  }

  const message = typeof error === 'string' && error.trim()
    ? error.trim()
    : String(error);
  return `worker:${message}`;
}

class NudgeRuntimeCoordinator {
  constructor({
    workerUrl,
    onHitResult = null,
    onStateChange = null,
    onStageChange = null,
    onError = null,
  } = {}) {
    this.workerUrl = workerUrl;
    this.onHitResult = onHitResult;
    this.onStateChange = onStateChange;
    this.onStageChange = onStageChange;
    this.onError = onError;

    this.workerSession = null;
    this.workerBootTimeoutId = null;
    this.state = createNudgeRuntimeState();
  }

  ensureSession() {
    if (!this.workerSession) {
      this.workerSession = new NudgeWorkerSession({
        workerUrl: this.workerUrl,
        onMessage: (event) => this.handleWorkerMessage(event),
        onError: (error) => this.handleRuntimeFailure(error),
      });
    }
    return this.workerSession;
  }

  resetSession() {
    if (this.workerSession) {
      try {
        this.workerSession.terminate();
      } catch (error) {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error('[sentinel flare] worker session reset failure', error);
        }
        this.handleRuntimeFailure(error);
      }
    }
    this.workerSession = null;
  }

  clearBootTimeout() {
    if (!this.workerBootTimeoutId) return;
    clearTimeout(this.workerBootTimeoutId);
    this.workerBootTimeoutId = null;
  }

  scheduleBootTimeout() {
    this.clearBootTimeout();
    this.workerBootTimeoutId = setTimeout(() => {
      this.workerBootTimeoutId = null;
      if (!this.isActive()) return;
      this.handleRuntimeFailure('boot_timeout');
    }, 1200);
  }

  emitState(prevState, nextState) {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(nextState, prevState);
    }
    if (typeof this.onStageChange === 'function' && prevState?.stage !== nextState?.stage) {
      this.onStageChange(nextState.stage);
    }
    if (typeof this.onError === 'function' && prevState?.lastError !== nextState?.lastError) {
      this.onError(nextState.lastError);
    }
  }

  applyEvent(type, payload = {}, effectContext = null) {
    const prevState = this.state;
    const event = { type, payload };
    const nextState = transitionNudgeRuntime(prevState, event);
    if (nextState === prevState) {
      return {
        prevState,
        nextState,
        effectResult: null,
      };
    }

    const effects = planNudgeRuntimeEffects({
      prevState,
      nextState,
      event,
    });
    this.state = nextState;
    this.emitState(prevState, nextState);
    const effectResult = runNudgeRuntimeEffects({
      coordinator: this,
      effects,
      prevState,
      nextState,
      event,
      context: effectContext,
    });

    return {
      prevState,
      nextState,
      effectResult,
    };
  }

  dispatch(type, payload = {}, effectContext = null) {
    return this.applyEvent(type, payload, effectContext).nextState;
  }

  dispatchWithEffectResult(type, payload = {}, effectContext = null) {
    return this.applyEvent(type, payload, effectContext);
  }

  supports(canvas) {
    return this.ensureSession().supports(canvas);
  }

  isReady() {
    return !!this.workerSession?.isReady?.();
  }

  isActive() {
    return this.state.runtimeMode === 'worker';
  }

  getStateSnapshot() {
    return this.state;
  }

  getStatsSnapshot(fallback = null) {
    return normalizeWorkerStatsSnapshot(this.state.stats, fallback);
  }

  getTelemetrySnapshot() {
    return normalizeWorkerTelemetrySnapshot(this.state.telemetry, null);
  }

  prepare({
    canvas,
    bounds,
    dpr = 1,
    themeId,
    config,
    protocolStartAt,
    protocolProgress = null,
  } = {}) {
    if (!this.supports(canvas)) {
      return { ok: false };
    }

    const { effectResult } = this.dispatchWithEffectResult(
      NUDGE_RUNTIME_EVENT.PREWARM_BEGIN,
      {},
      {
        operation: {
          canvas,
          bounds,
          dpr,
          themeId,
          config,
          protocolStartAt,
          protocolProgress,
        },
      }
    );
    return effectResult || { ok: false };
  }

  activate({
    canvas,
    bounds,
    dpr = 1,
    themeId,
    config,
    protocolStartAt,
    protocolProgress = null,
    mainSnapshot = null,
  } = {}) {
    if (!this.supports(canvas)) {
      return { ok: false };
    }

    const { effectResult } = this.dispatchWithEffectResult(
      NUDGE_RUNTIME_EVENT.WORKER_ACTIVATE_BEGIN,
      {},
      {
        operation: {
          canvas,
          bounds,
          dpr,
          themeId,
          config,
          protocolStartAt,
          protocolProgress,
        },
        mainSnapshot,
      }
    );
    return effectResult || { ok: false };
  }

  deactivate({ resetSession = false } = {}) {
    this.clearBootTimeout();
    if (this.workerSession?.isReady?.()) {
      this.workerSession.deactivate();
    }
    if (resetSession) {
      this.resetSession();
    }
  }

  destroy() {
    this.dispatch(NUDGE_RUNTIME_EVENT.RESET);
  }

  post(type, payload = null) {
    if (!this.isActive() || !this.workerSession?.isReady?.()) return false;
    return this.workerSession.post(type, payload, this.state.sessionId);
  }

  resize({ bounds, dpr = 1 } = {}) {
    if (!this.workerSession?.isReady?.()) return false;
    return this.workerSession.resize({ bounds, dpr });
  }

  setConfig(config, protocolProgress = null) {
    if (!this.workerSession?.isReady?.()) return false;
    return this.workerSession.setConfig(config, protocolProgress);
  }

  handleWorkerMessage(event) {
    const message = event?.data;
    if (!message || typeof message !== 'object') return;

    const sessionId = Number(message.sessionId);
    if (Number.isFinite(sessionId) && sessionId !== this.state.sessionId) return;

    const type = typeof message.type === 'string' ? message.type : '';

    if (type === NUDGE_WORKER_MESSAGE.READY) {
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_READY);
      return;
    }

    if (type === NUDGE_WORKER_MESSAGE.HIT_RESULT) {
      if (typeof this.onHitResult === 'function') {
        this.onHitResult(message);
      }
      return;
    }

    if (type === NUDGE_WORKER_MESSAGE.STATS) {
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_STATS, {
        stats: normalizeWorkerStatsSnapshot(message, this.state.stats),
        telemetry: normalizeWorkerTelemetrySnapshot(message.telemetry, this.state.telemetry),
      });
      return;
    }

    if (type === NUDGE_WORKER_MESSAGE.SPAWN_STATUS) {
      this.handleSpawnStatus(message);
      return;
    }

    if (type === NUDGE_WORKER_MESSAGE.ERROR) {
      this.handleRuntimeFailure(message.error || message?.payload?.error || 'worker_error');
    }
  }

  handleSpawnStatus(message) {
    const phase = typeof message.phase === 'string' ? message.phase : '';
    const lifecycle = normalizeSpawnLifecycleSnapshot(message, this.state.telemetry?.spawnLifecycle || null);
    if (phase === 'accepted') {
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_SPAWN_ACCEPTED, lifecycle);
      return;
    }
    if (phase === 'rendered') {
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_SPAWN_RENDERED, lifecycle);
      return;
    }
    if (phase === 'rejected') {
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_SPAWN_REJECTED, lifecycle);
    }
  }

  handleRuntimeFailure(error = null, { emitErrorEvent = true } = {}) {
    if (!this.isActive()) return;

    const normalizedError = formatRuntimeFailure(error);
    const snapshot = this.getStatsSnapshot();
    const telemetry = this.getTelemetrySnapshot();
    if (emitErrorEvent) {
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_ERROR, {
        error: normalizedError,
        stats: snapshot,
        telemetry,
      });
    }
  }
}

export default NudgeRuntimeCoordinator;
