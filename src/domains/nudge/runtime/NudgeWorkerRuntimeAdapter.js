import { normalizeWorkerStatsSnapshot } from '../nudge/index.js';
import { resolveGlobalSentinelSimulationPolicy } from '../nudge/nudgeGameGlobalSentinelProtocol.js';
import { NUDGE_RUNTIME_EVENT } from './NudgeRuntimeMachine.js';
import { NUDGE_WORKER_MESSAGE } from './NudgeProtocol.js';
import NudgeRuntimeCoordinator from './NudgeRuntimeCoordinator.js';

function nowMs() {
  if (typeof performance?.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function isWorkerReadyState(state) {
  return (
    state?.runtimeMode === 'worker'
    && (
      state?.stage === 'worker:ready'
      || state?.stage === 'worker:active'
    )
  );
}

function isWorkerTerminalState(state) {
  if (!state || typeof state !== 'object') return false;
  if (state.stage === 'worker:error') return true;
  return state.runtimeMode !== 'worker' && state.stage !== 'worker:activating' && state.stage !== 'worker:booting';
}

function normalizeWorkerRuntimeFailureReason(error = '') {
  const text = typeof error === 'string' ? error : String(error || '');
  if (text.includes('nudge_worker_post_failed')) return 'worker_post_failed';
  if (text.includes('loop_failure')) return 'worker_render_loop_failed';
  if (text.includes('activate_failed')) return 'worker_activation_failed';
  if (text.includes('boot_timeout')) return 'worker_boot_timeout';
  return 'worker_runtime_error';
}

function toCount(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.round(numeric));
}

function toUnit(value, fallback = 0) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(1, numeric));
  const fallbackNumeric = Number(fallback);
  return Math.max(0, Math.min(1, Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0));
}

function toNonNegativeNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.max(0, numeric);
  const fallbackNumeric = Number(fallback);
  return Math.max(0, Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0);
}

class NudgeWorkerRuntimeAdapter {
  constructor({
    workerUrl,
    onHitResult = null,
    onStateChange = null,
    onStageChange = null,
    onError = null,
    CoordinatorClass = NudgeRuntimeCoordinator,
  } = {}) {
    this.workerUrl = workerUrl;
    this.onHitResult = onHitResult;
    this.onStateChange = onStateChange;
    this.onStageChange = onStageChange;
    this.onError = onError;
    this.CoordinatorClass = CoordinatorClass;
    this.coordinator = null;
    this.spawnRequestSerial = 0;
    this.spawnOutcomeWaiters = new Map();
    this.workerActiveWaiters = new Set();
  }

  ensureCoordinator() {
    if (!this.coordinator) {
      this.coordinator = new this.CoordinatorClass({
        workerUrl: this.workerUrl,
        onHitResult: this.onHitResult,
        onStateChange: (nextState, prevState) => {
          this.handleStateChange(nextState, prevState);
          if (typeof this.onStateChange === 'function') {
            this.onStateChange(nextState, prevState);
          }
        },
        onStageChange: this.onStageChange,
        onError: this.onError,
      });
    }
    return this.coordinator;
  }

  getCoordinator({ ensure = true } = {}) {
    if (ensure) return this.ensureCoordinator();
    return this.coordinator;
  }

  destroy() {
    this.settleAllSpawnOutcomeWaiters({
      ok: false,
      phase: 'destroyed',
      runtime: 'worker',
      rejectReason: 'runtime_destroyed',
    });
    this.settleAllWorkerActiveWaiters({
      ok: false,
      phase: 'rejected',
      runtime: 'worker',
      rejectReason: 'runtime_destroyed',
    });
    if (this.coordinator) {
      this.coordinator.destroy();
      this.coordinator = null;
    }
  }

  isActive() {
    if (!this.coordinator) return false;
    return this.coordinator.isActive();
  }

  isReady() {
    if (!this.coordinator) return false;
    return this.coordinator.isReady();
  }

  getStatsSnapshot(fallback = null) {
    if (!this.coordinator) {
      return normalizeWorkerStatsSnapshot(fallback);
    }
    return this.coordinator.getStatsSnapshot(fallback);
  }

  getTelemetrySnapshot() {
    if (!this.coordinator) return null;
    return this.coordinator.getTelemetrySnapshot();
  }

  getStateSnapshot() {
    if (!this.coordinator) return null;
    return this.coordinator.getStateSnapshot?.() || null;
  }

  buildDiagnostics(state = null) {
    const coordinator = this.getCoordinator({ ensure: false });
    const snapshot = state || coordinator?.getStateSnapshot?.() || null;
    const stats = coordinator?.getStatsSnapshot?.(snapshot?.stats || null) || snapshot?.stats || null;
    const telemetry = coordinator?.getTelemetrySnapshot?.() || snapshot?.telemetry || null;
    const spawnLifecycle = telemetry?.spawnLifecycle && typeof telemetry.spawnLifecycle === 'object'
      ? telemetry.spawnLifecycle
      : null;

    return {
      runtimeStage: typeof snapshot?.stage === 'string' ? snapshot.stage : '',
      runtimeMode: typeof snapshot?.runtimeMode === 'string' ? snapshot.runtimeMode : '',
      workerRuntimeActive: coordinator?.isActive?.() === true,
      workerSessionReady: coordinator?.isReady?.() === true,
      lastError: typeof snapshot?.lastError === 'string' ? snapshot.lastError : '',
      protocolScope: typeof stats?.protocolScope === 'string' ? stats.protocolScope.trim() : '',
      protocolVariant: typeof stats?.protocolVariant === 'string' ? stats.protocolVariant.trim() : '',
      protocolSystem: typeof stats?.protocolSystem === 'string' ? stats.protocolSystem.trim() : '',
      globalSentinelGamePhase: typeof stats?.globalSentinelGamePhase === 'string'
        ? stats.globalSentinelGamePhase.trim()
        : '',
      engineControlClockMode: typeof stats?.engineControlClockMode === 'string'
        ? stats.engineControlClockMode.trim()
        : '',
      engineControlSpawnMode: typeof stats?.engineControlSpawnMode === 'string'
        ? stats.engineControlSpawnMode.trim()
        : '',
      engineControlSplitMode: typeof stats?.engineControlSplitMode === 'string'
        ? stats.engineControlSplitMode.trim()
        : '',
      engineControlInputMode: typeof stats?.engineControlInputMode === 'string'
        ? stats.engineControlInputMode.trim()
        : '',
      engineControlEntityMode: typeof stats?.engineControlEntityMode === 'string'
        ? stats.engineControlEntityMode.trim()
        : '',
      engineControlRenderMode: typeof stats?.engineControlRenderMode === 'string'
        ? stats.engineControlRenderMode.trim()
        : '',
      engineControlBlockReason: typeof stats?.engineControlBlockReason === 'string'
        ? stats.engineControlBlockReason.trim()
        : '',
      protocolProgressPhase: typeof stats?.protocolProgressPhase === 'string'
        ? stats.protocolProgressPhase.trim()
        : '',
      protocolProgressInteractionOpen: stats?.protocolProgressInteractionOpen === true,
      globalSentinelBaseSyncPressure: toNonNegativeNumber(stats?.globalSentinelBaseSyncPressure, 0),
      globalSentinelSyncPressure: toUnit(stats?.globalSentinelSyncPressure, 0),
      globalSentinelSyncPressureRelief: toUnit(stats?.globalSentinelSyncPressureRelief, 0),
      globalSentinelSyncPressureFailureThreshold: toUnit(
        stats?.globalSentinelSyncPressureFailureThreshold,
        1,
      ),
      globalSentinelFracture: toUnit(stats?.globalSentinelFracture, 0),
      globalSentinelFractureThreshold: toUnit(stats?.globalSentinelFractureThreshold, resolveGlobalSentinelSimulationPolicy().fractureThreshold),
      globalSentinelIntegrity: toUnit(stats?.globalSentinelIntegrity, 0),
      globalSentinelFractureRepairAmount: toUnit(stats?.globalSentinelFractureRepairAmount, 0),
      globalSentinelFractureRepairPressure: toNonNegativeNumber(
        stats?.globalSentinelFractureRepairPressure,
        0,
      ),
      globalSentinelFractureRepairElapsedMs: toNonNegativeNumber(
        stats?.globalSentinelFractureRepairElapsedMs,
        0,
      ),
      globalSentinelFractureImpact: toUnit(stats?.globalSentinelFractureImpact, 0),
      globalSentinelFractureImpactStrength: toUnit(stats?.globalSentinelFractureImpactStrength, 0),
      globalSentinelFractureImpactSerial: toCount(stats?.globalSentinelFractureImpactSerial, 0),
      globalSentinelFractureImpactX: toUnit(stats?.globalSentinelFractureImpactX, 0),
      globalSentinelFractureImpactY: toUnit(stats?.globalSentinelFractureImpactY, 0),
      globalSentinelEntryRevealProgress: toUnit(stats?.globalSentinelEntryRevealProgress, 0),
      globalSentinelStarterFeedbackSerial: toCount(stats?.globalSentinelStarterFeedbackSerial, 0),
      globalSentinelStarterFeedbackX: toUnit(stats?.globalSentinelStarterFeedbackX, 0),
      globalSentinelStarterFeedbackY: toUnit(stats?.globalSentinelStarterFeedbackY, 0),
      globalSentinelLastHitEfficiency: toUnit(stats?.globalSentinelLastHitEfficiency, 0),
      globalSentinelLastFractureImpulse: toUnit(stats?.globalSentinelLastFractureImpulse, 0),
      globalSentinelLastSyncPressureRelief: toUnit(
        stats?.globalSentinelLastSyncPressureRelief,
        0,
      ),
      renderPressureLevel: typeof stats?.renderPressureLevel === 'string'
        ? stats.renderPressureLevel
        : '',
      renderBudgetPolicyId: typeof stats?.renderBudgetPolicyId === 'string'
        ? stats.renderBudgetPolicyId
        : '',
      renderFrameIntervalEmaMs: toNonNegativeNumber(stats?.renderFrameIntervalEmaMs, 0),
      renderWorkTimeEmaMs: toNonNegativeNumber(stats?.renderWorkTimeEmaMs, 0),
      renderBackend: typeof stats?.renderBackend === 'string' ? stats.renderBackend : '',
      effectiveDpr: toNonNegativeNumber(stats?.effectiveDpr, 1),
      frameWorkMs: toNonNegativeNumber(stats?.frameWorkMs, 0),
      updateWorkMs: toNonNegativeNumber(stats?.updateWorkMs, 0),
      renderWorkMs: toNonNegativeNumber(stats?.renderWorkMs, 0),
      frameWorkP95Ms: toNonNegativeNumber(stats?.frameWorkP95Ms, 0),
      frameWorkMaxMs: toNonNegativeNumber(stats?.frameWorkMaxMs, 0),
      liveCount: toCount(stats?.liveCount, 0),
      totalSpawned: toCount(stats?.totalSpawned, 0),
      totalSplitSpawned: toCount(stats?.totalSplitSpawned, 0),
      spriteCacheMode: typeof stats?.spriteCacheMode === 'string' ? stats.spriteCacheMode : '',
      spriteCacheHitCount: toCount(stats?.spriteCacheHitCount, 0),
      spriteCacheMissCount: toCount(stats?.spriteCacheMissCount, 0),
      spriteVectorCount: toCount(stats?.spriteVectorCount, 0),
      spriteCacheUnavailableCount: toCount(stats?.spriteCacheUnavailableCount, 0),
      spawnLifecycle,
    };
  }

  dispatch(type, payload = {}, { ensure = true } = {}) {
    const coordinator = this.getCoordinator({ ensure });
    if (!coordinator) return null;
    return coordinator.dispatch(type, payload);
  }

  post(type, payload = null) {
    if (!this.coordinator) return false;
    return this.coordinator.post(type, payload);
  }

  forceSpawn(spawnHint = null) {
    return this.dispatchForceSpawn(spawnHint).sent;
  }

  forceSpawnAndWait(spawnHint = null, { timeoutMs = 1800 } = {}) {
    const coordinator = this.getCoordinator({ ensure: false });
    if (!coordinator) {
      return Promise.resolve({
        ok: false,
        phase: 'rejected',
        runtime: 'worker',
        requestId: 0,
        rejectReason: 'runtime_unavailable',
      });
    }

    if (!coordinator.isActive?.()) {
      return Promise.resolve(this.buildSpawnOutcome({
        phase: 'rejected',
        requestId: 0,
        rejectReason: 'worker_runtime_inactive',
      }));
    }

    if (!coordinator.isReady?.()) {
      return Promise.resolve(this.buildSpawnOutcome({
        phase: 'rejected',
        requestId: 0,
        rejectReason: 'worker_session_not_ready',
      }));
    }

    const timeoutDelay = Number(timeoutMs);
    if (!Number.isFinite(timeoutDelay) || timeoutDelay <= 0) {
      return Promise.resolve(this.buildSpawnOutcome({
        phase: 'timeout',
        requestId: 0,
        rejectReason: 'spawn_render_timeout',
      }));
    }

    this.spawnRequestSerial += 1;
    const requestId = this.spawnRequestSerial;
    const requestedAtMs = nowMs();
    const outcomePromise = this.waitForSpawnOutcome(requestId, { timeoutMs: timeoutDelay });
    const { sent } = this.dispatchForceSpawn(spawnHint, {
      coordinator,
      requestId,
      requestedAtMs,
    });

    if (!sent) {
      return outcomePromise;
    }
    return outcomePromise;
  }

  dispatchForceSpawn(spawnHint = null, seed = {}) {
    const coordinator = this.getCoordinator({ ensure: false });
    if (!coordinator) {
      return {
        sent: false,
        requestId: 0,
      };
    }

    const requestId = Number(seed.requestId) > 0
      ? Math.round(Number(seed.requestId))
      : this.spawnRequestSerial + 1;
    if (requestId > this.spawnRequestSerial) {
      this.spawnRequestSerial = requestId;
    }
    const requestedAtMs = Number(seed.requestedAtMs) || nowMs();
    coordinator.dispatch(NUDGE_RUNTIME_EVENT.WORKER_SPAWN_REQUESTED, {
      requestId,
      reason: 'spawn',
      requestedAtMs,
      spawnHint,
    });

    const sent = coordinator.post(NUDGE_WORKER_MESSAGE.FORCE_SPAWN, {
      requestId,
      requestedAtMs,
      reason: 'spawn',
      spawnHint,
    });

    if (!sent) {
      coordinator.dispatch(NUDGE_RUNTIME_EVENT.WORKER_SPAWN_REJECTED, {
        requestId,
        reason: 'spawn',
        rejectedAtMs: nowMs(),
        rejectReason: 'post_failed',
      });
    }

    return {
      sent,
      requestId,
      requestedAtMs,
    };
  }

  waitForSpawnOutcome(requestId, { timeoutMs = 1800 } = {}) {
    const normalizedRequestId = Number(requestId);
    if (!Number.isInteger(normalizedRequestId) || normalizedRequestId <= 0) {
      return Promise.resolve({
        ok: false,
        phase: 'rejected',
        runtime: 'worker',
        requestId: 0,
        rejectReason: 'invalid_request_id',
      });
    }

    const timeoutDelay = Number(timeoutMs);
    if (!Number.isFinite(timeoutDelay) || timeoutDelay <= 0) {
      return Promise.resolve({
        ok: false,
        phase: 'timeout',
        runtime: 'worker',
        requestId: normalizedRequestId,
        rejectReason: 'spawn_render_timeout',
        diagnostics: this.buildDiagnostics(),
      });
    }

    return new Promise((resolve) => {
      const settle = (outcome) => {
        const current = this.spawnOutcomeWaiters.get(normalizedRequestId);
        if (current?.timer) {
          clearTimeout(current.timer);
        }
        this.spawnOutcomeWaiters.delete(normalizedRequestId);
        resolve({
          requestId: normalizedRequestId,
          runtime: 'worker',
          ...outcome,
          ok: outcome?.phase === 'rendered',
        });
      };

      const timer = setTimeout(() => {
        settle(this.buildSpawnOutcome({
          phase: 'timeout',
          requestId: normalizedRequestId,
          rejectReason: 'spawn_render_timeout',
        }));
      }, timeoutDelay);

      this.spawnOutcomeWaiters.set(normalizedRequestId, { settle, timer });
    });
  }

  waitForActive({ timeoutMs = 1200 } = {}) {
    const coordinator = this.getCoordinator({ ensure: false });
    if (!coordinator) {
      return Promise.resolve({
        ok: false,
        phase: 'rejected',
        runtime: 'worker',
        requestId: 0,
        rejectReason: 'runtime_unavailable',
      });
    }

    const currentState = coordinator.getStateSnapshot?.() || null;
    if (isWorkerReadyState(currentState)) {
      return Promise.resolve({
        ok: true,
        phase: 'active',
        runtime: 'worker',
        requestId: 0,
        diagnostics: this.buildDiagnostics(currentState),
      });
    }

    if (currentState?.stage === 'worker:error') {
      return Promise.resolve(this.buildWorkerActiveFailure(currentState));
    }

    const timeoutDelay = Number(timeoutMs);
    if (!Number.isFinite(timeoutDelay) || timeoutDelay <= 0) {
      return Promise.resolve({
        ok: false,
        phase: 'rejected',
        runtime: 'worker',
        requestId: 0,
        rejectReason: 'worker_activation_timeout',
        diagnostics: this.buildDiagnostics(),
      });
    }

    return new Promise((resolve) => {
      const waiter = {
        settle: (outcome) => {
          if (waiter.timer) {
            clearTimeout(waiter.timer);
          }
          this.workerActiveWaiters.delete(waiter);
          resolve(outcome);
        },
        timer: null,
      };

      waiter.timer = setTimeout(() => {
        waiter.settle({
          ok: false,
          phase: 'rejected',
          runtime: 'worker',
          requestId: 0,
          rejectReason: 'worker_activation_timeout',
          diagnostics: this.buildDiagnostics(),
        });
      }, timeoutDelay);

      this.workerActiveWaiters.add(waiter);
    });
  }

  buildSpawnOutcome({
    phase = 'rejected',
    requestId = 0,
    rejectReason = '',
    error = '',
    state = null,
    lifecycle = null,
  } = {}) {
    const diagnostics = this.buildDiagnostics(state);
    const sourceLifecycle = lifecycle && typeof lifecycle === 'object'
      ? lifecycle
      : diagnostics.spawnLifecycle;
    const matchingLifecycle = Number(sourceLifecycle?.requestId) === Number(requestId)
      ? sourceLifecycle
      : null;
    return {
      ...(matchingLifecycle || {}),
      phase,
      runtime: 'worker',
      requestId,
      rejectReason,
      error,
      diagnostics,
      ok: phase === 'rendered',
    };
  }

  buildWorkerActiveFailure(state = null) {
    const error = typeof state?.lastError === 'string' && state.lastError
      ? state.lastError
      : 'worker_runtime_error';
    return {
      ok: false,
      phase: 'rejected',
      runtime: 'worker',
      requestId: 0,
      rejectReason: normalizeWorkerRuntimeFailureReason(error),
      error,
      diagnostics: this.buildDiagnostics(state),
    };
  }

  handleStateChange(nextState) {
    this.settleWorkerActiveWaitersForState(nextState);
    this.settleSpawnOutcomeWaitersForTerminalState(nextState);

    const lifecycle = nextState?.telemetry?.spawnLifecycle;
    if (!lifecycle || typeof lifecycle !== 'object') return;
    const requestId = Number(lifecycle.requestId);
    if (!Number.isInteger(requestId) || requestId <= 0) return;
    const waiter = this.spawnOutcomeWaiters.get(requestId);
    if (!waiter) return;
    const phase = typeof lifecycle.phase === 'string' ? lifecycle.phase : '';
    if (phase !== 'rendered' && phase !== 'rejected') return;
    waiter.settle(this.buildSpawnOutcome({
      ...lifecycle,
      phase,
      requestId,
      rejectReason: phase === 'rejected' ? (lifecycle.rejectReason || 'rejected') : '',
      lifecycle,
      state: nextState,
    }));
  }

  settleWorkerActiveWaitersForState(nextState) {
    if (this.workerActiveWaiters.size <= 0) return;
    if (isWorkerReadyState(nextState)) {
      this.settleAllWorkerActiveWaiters({
        ok: true,
        phase: 'active',
        runtime: 'worker',
        requestId: 0,
        diagnostics: this.buildDiagnostics(nextState),
      });
      return;
    }
    if (nextState?.stage === 'worker:error' || isWorkerTerminalState(nextState)) {
      this.settleAllWorkerActiveWaiters(this.buildWorkerActiveFailure(nextState));
    }
  }

  settleSpawnOutcomeWaitersForTerminalState(nextState) {
    if (this.spawnOutcomeWaiters.size <= 0) return;
    if (nextState?.stage !== 'worker:error') return;
    const failure = this.buildWorkerActiveFailure(nextState);
    this.settleAllSpawnOutcomeWaiters({
      ...failure,
      phase: 'rejected',
      requestId: undefined,
    });
  }

  settleAllSpawnOutcomeWaiters(outcome = {}) {
    const waiters = Array.from(this.spawnOutcomeWaiters.entries());
    for (const [requestId, waiter] of waiters) {
      waiter?.settle?.({
        ...outcome,
        requestId,
      });
    }
  }

  settleAllWorkerActiveWaiters(outcome = {}) {
    const waiters = Array.from(this.workerActiveWaiters);
    for (const waiter of waiters) {
      waiter?.settle?.(outcome);
    }
  }

  resize({ bounds, dpr = 1 } = {}) {
    if (!this.coordinator) return false;
    return this.coordinator.resize({ bounds, dpr });
  }

  setConfig(config, protocolProgress = null) {
    if (!this.coordinator) return false;
    return this.coordinator.setConfig(config, protocolProgress);
  }

  prepare(operation = {}) {
    return this.ensureCoordinator().prepare(operation);
  }

  activate(operation = {}) {
    return this.ensureCoordinator().activate(operation);
  }
}

export { NudgeWorkerRuntimeAdapter };
export default NudgeWorkerRuntimeAdapter;
