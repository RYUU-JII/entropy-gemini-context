import { createBootIdleAdmission } from './bootIdleAdmission.js';
import {
  completeBootTelemetrySession,
  recordBootTelemetryEvent,
  recordBootTelemetryLoaderVisibility,
  recordBootTelemetryPhaseTransition,
  recordBootTelemetryTaskDone,
  recordBootTelemetryTaskStart,
  startBootTelemetrySession,
} from '@dashboard-boot-telemetry';
import { fetchBootPrewarmSnapshot } from './bootPrewarmClient.js';
import {
  warmupDashboardSurface,
  warmupDashboardSurfaceDeferred,
  warmupDashboardSurfaceInteractive,
} from './bootSurfaceWarmup.js';
import { emitDashboardBootSnapshot } from './bootEvents.js';
import {
  BOOT_CORE_TIMEOUT_MS,
  BOOT_LAZY_IDLE_TIMEOUT_MS,
  BOOT_POST_REVEAL_ADMISSION_TIMEOUT_MS,
  BOOT_SURFACE_DEFERRED_TIMEOUT_MS,
  BOOT_SURFACE_INTERACTIVE_TIMEOUT_MS,
  BOOT_SURFACE_WARMUP_TIMEOUT_MS,
} from './bootConfig.js';
import {
  compactDashboardMainFirstFrameMetadata as compactMainFirstFrameMetadata,
} from './mainFirstFrameDiagnostics.js';
import { emitZenTrace } from '@zen-trace';

const INITIAL_BOOT_STATE = Object.freeze({
  status: 'idle',
  phase: 'idle',
  startedAt: 0,
  themeReady: false,
  themeShellDegraded: false,
  coreReady: false,
  coreWaitBudgetExceeded: false,
  mainTabFirstFrameReady: false,
  mainTabFirstFrameDegraded: false,
  mainTabFirstFrameWaitBudgetExceeded: false,
  forcedVisualRelease: false,
  forcedVisualReleaseReason: null,
  shellDismissed: false,
  dismissible: false,
  degraded: false,
  errors: Object.freeze([]),
});

let bootState = {
  ...INITIAL_BOOT_STATE,
  errors: [],
};

let bootRunPromise = null;
let bootTimeoutId = 0;
let lazyPipelineStarted = false;
let lazyWarmupAbortController = null;
let lazyWarmupGeneration = 0;
let telemetryCompleted = false;

const listeners = new Set();

const nowMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const toFixedMs = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const cancelLazyWarmupGeneration = (reason = 'warmup_generation_cancelled') => {
  const controller = lazyWarmupAbortController;
  if (!controller || controller.signal.aborted) return false;
  controller.abort(reason);
  return true;
};

const beginLazyWarmupGeneration = () => {
  cancelLazyWarmupGeneration('warmup_generation_replaced');
  lazyWarmupGeneration += 1;
  const controller = new AbortController();
  lazyWarmupAbortController = controller;
  return Object.freeze({
    controller,
    generation: lazyWarmupGeneration,
    signal: controller.signal,
  });
};

const isLazyWarmupGenerationCurrent = (generation, controller) => (
  generation === lazyWarmupGeneration
  && controller === lazyWarmupAbortController
  && controller.signal.aborted !== true
);

const formatErrorMessage = (error) => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string' && error.message.trim()) return error.message;
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
};

function createBootManagerFailureError(code, details = {}, cause = null) {
  const error = new Error(code);
  error.name = 'DashboardBootManagerError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  if (cause) {
    error.cause = cause;
  }
  return error;
}

const getSnapshot = () => ({
  ...bootState,
  errors: Array.isArray(bootState.errors) ? [...bootState.errors] : [],
});

export const isDashboardUserControlReleased = (state) => (
  state?.dismissible === true
  || state?.forcedVisualRelease === true
);

const hasDegradedBootError = (errors = []) => (
  Array.isArray(errors)
  && errors.some((error) => error?.severity === 'degraded')
);

const resolveBootReleaseDegraded = ({
  forcedVisualRelease = bootState.forcedVisualRelease,
  mainTabFirstFrameDegraded = bootState.mainTabFirstFrameDegraded,
  themeShellDegraded = bootState.themeShellDegraded,
  errors = bootState.errors,
} = {}) => (
  forcedVisualRelease === true
  || mainTabFirstFrameDegraded === true
  || themeShellDegraded === true
  || hasDegradedBootError(errors)
);

const emit = () => {
  const snapshot = getSnapshot();
  listeners.forEach((listener) => {
    listener(snapshot);
  });
  emitDashboardBootSnapshot(snapshot);
};

const updateBootState = (patch = {}) => {
  const nextErrors = Object.prototype.hasOwnProperty.call(patch, 'errors')
    ? (Array.isArray(patch.errors) ? patch.errors : [])
    : bootState.errors;
  bootState = {
    ...bootState,
    ...patch,
    errors: nextErrors,
  };
  emit();
};

const resolveBootPhase = (state = bootState) => {
  if (state.status === 'failed') return 'failed';
  if (state.forcedVisualRelease && !state.dismissible) return 'forced_visual_release';
  if (state.degraded || state.status === 'timeout') return 'degraded';
  if (state.dismissible || state.status === 'ready') return 'ready';
  if (state.mainTabFirstFrameReady) return 'main_frame_ready';
  if (state.coreReady) return 'core_ready';
  if (state.themeReady) return 'theme_ready';
  if (state.status === 'booting') return 'booting';
  return 'idle';
};

const transitionBootPhaseIfNeeded = (nextPhase, metadata = null) => {
  if (bootState.phase === nextPhase) return nextPhase;
  emitZenTrace('boot_manager:phase_transition', {
    from: bootState.phase,
    to: nextPhase,
    metadata,
  });
  updateBootState({ phase: nextPhase });
  if (!bootState.startedAt) return nextPhase;
  recordBootTelemetryPhaseTransition(nextPhase, {
    elapsedMs: toFixedMs(nowMs() - bootState.startedAt),
    ...(metadata && typeof metadata === 'object' ? metadata : {}),
  });
  return nextPhase;
};

const syncBootPhase = (metadata = null) => transitionBootPhaseIfNeeded(resolveBootPhase(), metadata);

const failBoot = (task, error, { optional = false, code = 'BOOT_MANAGER_FAILURE' } = {}) => {
  const bootError = error instanceof Error
    ? error
    : createBootManagerFailureError(code, { task, optional, error: formatErrorMessage(error) });
  cancelLazyWarmupGeneration('boot_failed');
  clearBootTimeout();
  emitZenTrace('boot_manager:failed', {
    task,
    optional,
    code: bootError.code || code,
    message: formatErrorMessage(bootError),
  });
  const nextErrors = [
    ...bootState.errors,
    {
      task,
      optional,
      code: bootError.code || code,
      message: formatErrorMessage(bootError),
      at: Date.now(),
    },
  ];
  updateBootState({
    status: 'failed',
    phase: 'failed',
    dismissible: false,
    degraded: false,
    errors: nextErrors,
  });
  recordBootTelemetryEvent('boot:failed', {
    task,
    optional,
    code: bootError.code || code,
    message: formatErrorMessage(bootError),
    elapsedMs: bootState.startedAt ? toFixedMs(nowMs() - bootState.startedAt) : 0,
  });
  completeTelemetryOnce({
    status: 'failed',
    metadata: {
      task,
      optional,
      code: bootError.code || code,
      message: formatErrorMessage(bootError),
    },
  });
  throw bootError;
};

const recordOptionalBootTaskError = (task, error, { code = 'BOOT_OPTIONAL_TASK_FAILED' } = {}) => {
  const bootError = error instanceof Error
    ? error
    : createBootManagerFailureError(code, { task, optional: true, error: formatErrorMessage(error) });
  const resolvedCode = bootError.code || code;
  const message = formatErrorMessage(bootError);
  emitZenTrace('boot_manager:optional_task_failed', {
    task,
    code: resolvedCode,
    message,
  });
  const nextErrors = [
    ...bootState.errors,
    {
      task,
      optional: true,
      code: resolvedCode,
      message,
      at: Date.now(),
    },
  ];
  updateBootState({
    errors: nextErrors,
  });
  recordBootTelemetryEvent('boot:optional_task_failed', {
    task,
    optional: true,
    code: resolvedCode,
    message,
    elapsedMs: bootState.startedAt ? toFixedMs(nowMs() - bootState.startedAt) : 0,
  });
  return bootError;
};

const recordBootDiagnosticError = (task, error, {
  code = 'BOOT_DIAGNOSTIC_EVENT',
  severity = 'warning',
  optional = false,
} = {}) => {
  const bootError = error instanceof Error
    ? error
    : createBootManagerFailureError(code, { task, optional, error: formatErrorMessage(error) });
  const resolvedCode = bootError.code || code;
  const message = formatErrorMessage(bootError);
  const resolvedSeverity = typeof severity === 'string' && severity.trim()
    ? severity.trim()
    : 'warning';
  emitZenTrace('boot_manager:diagnostic_error', {
    task,
    optional,
    severity: resolvedSeverity,
    code: resolvedCode,
    message,
  });
  const nextErrors = [
    ...bootState.errors,
    {
      task,
      optional,
      severity: resolvedSeverity,
      code: resolvedCode,
      message,
      at: Date.now(),
    },
  ];
  updateBootState({
    errors: nextErrors,
  });
  recordBootTelemetryEvent('boot:diagnostic_error', {
    task,
    optional,
    severity: resolvedSeverity,
    code: resolvedCode,
    message,
    elapsedMs: bootState.startedAt ? toFixedMs(nowMs() - bootState.startedAt) : 0,
  });
  return bootError;
};

const waitForIdleSlot = (
  timeoutMs = BOOT_LAZY_IDLE_TIMEOUT_MS,
  signal = null,
) => new Promise((resolve) => {
  if (signal?.aborted) {
    resolve(false);
    return;
  }
  let idleCallbackId = 0;
  let timeoutId = 0;
  let settled = false;
  const cleanup = () => {
    if (
      idleCallbackId
      && typeof window !== 'undefined'
      && typeof window.cancelIdleCallback === 'function'
    ) {
      window.cancelIdleCallback(idleCallbackId);
    }
    if (timeoutId) clearTimeout(timeoutId);
    signal?.removeEventListener?.('abort', handleAbort);
  };
  const finish = (admitted) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolve(admitted);
  };
  const handleAbort = () => finish(false);
  signal?.addEventListener?.('abort', handleAbort, { once: true });
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    idleCallbackId = window.requestIdleCallback(
      () => finish(true),
      { timeout: timeoutMs },
    );
    return;
  }
  timeoutId = setTimeout(() => finish(true), 48);
});

const resolveDeferredWarmupGate = (state = bootState) => {
  if (state?.forcedVisualRelease === true) return 'forced_visual_release';
  if (state?.status === 'failed') return 'failed';
  if (state?.mainTabFirstFrameReady === true) {
    if (state.mainTabFirstFrameDegraded === true) return 'main_frame_degraded';
    if (state.degraded === true) return 'dismissible_degraded';
    return state.dismissible === true && state.shellDismissed === true ? 'shell_dismissed' : null;
  }
  if (state?.dismissible === true && state?.degraded === true) return 'dismissible_degraded';
  return null;
};

const waitForDeferredWarmupGate = (signal) => new Promise((resolve) => {
  if (signal.aborted) { resolve('cancelled'); return; }
  const immediateGate = resolveDeferredWarmupGate();
  if (immediateGate) {
    resolve(immediateGate);
    return;
  }

  const listener = (snapshot) => {
    const gate = resolveDeferredWarmupGate(snapshot);
    if (!gate) return;
    listeners.delete(listener);
    signal.removeEventListener('abort', onAbort);
    resolve(gate);
  };
  const onAbort = () => { listeners.delete(listener); resolve('cancelled'); };
  signal.addEventListener('abort', onAbort, { once: true });
  listeners.add(listener);
});

const WARMUP_TASK_NAMES = new Set([
  'warmupDashboardSurface',
  'warmupDashboardSurfaceInteractive',
  'warmupDashboardSurfaceDeferred',
]);

const buildTaskDoneMetadata = (task, optional, result) => {
  const metadata = { optional };
  if (!WARMUP_TASK_NAMES.has(task) || !result || typeof result !== 'object') {
    return metadata;
  }
  return {
    ...metadata,
    warmup: {
      admittedCount: Number(result.admittedCount) || 0,
      cancelled: result.cancelled === true,
      cancelReason: result.cancelReason || null,
      elapsedMs: Number(result.elapsedMs) || 0,
      pendingCount: Number(result.pendingCount) || 0,
      rejectedCount: Number(result.rejectedCount) || 0,
      scheduledCount: Number(result.scheduledCount) || 0,
      settledCount: Number(result.settledCount) || 0,
      skippedCount: Number(result.skippedCount) || 0,
      timedOut: result.timedOut === true,
      timeoutMs: Number(result.timeoutMs) || 0,
    },
  };
};

const runTask = async (task, fn, { optional = false, context = null } = {}) => {
  if (typeof fn !== 'function') {
    const error = createBootManagerFailureError('BOOT_TASK_FUNCTION_REQUIRED', {
      task,
      optional,
    });
    recordBootTelemetryEvent('task:skip', { task, reason: 'task_not_function' });
    if (optional) {
      return { task, optional, skipped: true, error: null, result: null };
    }
    throw error;
  }

  const startedAt = nowMs();
  recordBootTelemetryTaskStart(task, { optional });
  try {
    const result = await fn(context);
    const durationMs = nowMs() - startedAt;
    recordBootTelemetryTaskDone(task, {
      durationMs,
      metadata: buildTaskDoneMetadata(task, optional, result),
    });
    return { task, optional, skipped: false, error: null, result, durationMs };
  } catch (error) {
    const durationMs = nowMs() - startedAt;
    recordBootTelemetryTaskDone(task, {
      durationMs,
      error,
      metadata: { optional },
    });
    if (optional) {
      const bootError = recordOptionalBootTaskError(task, error);
      return { task, optional, skipped: false, error: bootError, result: null, durationMs };
    }
    throw error;
  }
};

const clearBootTimeout = () => {
  if (!bootTimeoutId) return;
  clearTimeout(bootTimeoutId);
  bootTimeoutId = 0;
};

const completeTelemetryOnce = ({ status, metadata = null } = {}) => {
  if (telemetryCompleted) return;
  telemetryCompleted = true;
  completeBootTelemetrySession({
    status,
    errors: [...bootState.errors],
    metadata: metadata || {},
  });
};

const maybePromoteDismissible = (reason = 'gate_ready') => {
  if (bootState.dismissible) return false;
  if (!bootState.themeReady || !bootState.coreReady || !bootState.mainTabFirstFrameReady) return false;

  const forcedVisualRelease = bootState.forcedVisualRelease === true;
  const visualDegraded = bootState.mainTabFirstFrameDegraded === true
    || bootState.themeShellDegraded === true;
  // `degraded` is a derived release summary. Feeding it back into itself makes
  // transient wait/diagnostic states poison a later clean first-frame commit.
  const nextDegraded = resolveBootReleaseDegraded({
    forcedVisualRelease,
  });
  const nextPhase = nextDegraded ? 'degraded' : 'ready';
  clearBootTimeout();
  const previousPhase = bootState.phase;
  updateBootState({
    status: 'ready',
    phase: nextPhase,
    dismissible: true,
    degraded: nextDegraded,
  });
  emitZenTrace('boot_manager:dismissible', {
    reason,
    elapsedMs: toFixedMs(nowMs() - bootState.startedAt),
    status: bootState.status,
    phase: bootState.phase,
    dismissible: bootState.dismissible,
    themeReady: bootState.themeReady,
    themeShellDegraded: bootState.themeShellDegraded,
    coreReady: bootState.coreReady,
    mainTabFirstFrameReady: bootState.mainTabFirstFrameReady,
    mainTabFirstFrameDegraded: bootState.mainTabFirstFrameDegraded,
    forcedVisualRelease,
    forcedVisualReleaseReason: bootState.forcedVisualReleaseReason,
    degraded: bootState.degraded,
  });
  if (previousPhase !== nextPhase && bootState.startedAt) {
    recordBootTelemetryPhaseTransition(nextPhase, {
      elapsedMs: toFixedMs(nowMs() - bootState.startedAt),
      reason,
      visualDegraded,
      themeShellDegraded: bootState.themeShellDegraded,
      forcedVisualRelease,
      forcedVisualReleaseReason: bootState.forcedVisualReleaseReason,
    });
  }
  recordBootTelemetryEvent('boot:dismissible', {
    reason,
    elapsedMs: toFixedMs(nowMs() - bootState.startedAt),
    degraded: nextDegraded,
    visualDegraded,
    themeShellDegraded: bootState.themeShellDegraded,
    forcedVisualRelease,
    forcedVisualReleaseReason: bootState.forcedVisualReleaseReason,
  });
  completeTelemetryOnce({
    status: 'ready',
    metadata: {
      reason,
      elapsedMs: toFixedMs(nowMs() - bootState.startedAt),
      degraded: nextDegraded,
      visualDegraded,
      themeShellDegraded: bootState.themeShellDegraded,
      forcedVisualRelease,
      forcedVisualReleaseReason: bootState.forcedVisualReleaseReason,
    },
  });
  return true;
};

const recordBootWaitBudgetExceeded = () => {
  if (bootState.dismissible) return;
  const elapsedMs = toFixedMs(nowMs() - bootState.startedAt);
  if (bootState.coreReady) {
    emitZenTrace('boot_manager:core_timeout_visual_wait', {
      timeoutMs: BOOT_CORE_TIMEOUT_MS,
      elapsedMs,
      themeReady: bootState.themeReady,
      coreReady: bootState.coreReady,
      mainTabFirstFrameReady: bootState.mainTabFirstFrameReady,
    });
    recordBootTelemetryEvent('boot:visual_wait_budget_exceeded', {
      timeoutMs: BOOT_CORE_TIMEOUT_MS,
      elapsedMs,
      themeReady: bootState.themeReady,
      coreReady: bootState.coreReady,
      mainTabFirstFrameReady: bootState.mainTabFirstFrameReady,
    });
    updateBootState({
      mainTabFirstFrameWaitBudgetExceeded: bootState.mainTabFirstFrameReady !== true,
    });
    return;
  }
  emitZenTrace('boot_manager:core_wait_budget_exceeded', {
    timeoutMs: BOOT_CORE_TIMEOUT_MS,
    elapsedMs,
    themeReady: bootState.themeReady,
    coreReady: bootState.coreReady,
    mainTabFirstFrameReady: bootState.mainTabFirstFrameReady,
  });
  recordBootTelemetryEvent('boot:core_wait_budget_exceeded', {
    timeoutMs: BOOT_CORE_TIMEOUT_MS,
    elapsedMs,
    themeReady: bootState.themeReady,
    coreReady: bootState.coreReady,
    mainTabFirstFrameReady: bootState.mainTabFirstFrameReady,
  });
  updateBootState({
    coreWaitBudgetExceeded: true,
  });
};

const isTimeoutLikeValue = (value) => (
  typeof value === 'string' && value.toLowerCase().includes('timeout')
);

const isTimeoutLikeReadyMetadata = (metadataObject = null) => {
  if (!metadataObject || typeof metadataObject !== 'object') return false;
  const renderer = metadataObject.renderer && typeof metadataObject.renderer === 'object'
    ? metadataObject.renderer
    : {};
  return isTimeoutLikeValue(metadataObject.source)
    || isTimeoutLikeValue(metadataObject.reason)
    || isTimeoutLikeValue(renderer.status)
    || isTimeoutLikeValue(renderer.reason)
    || isTimeoutLikeValue(renderer.causeCode)
    || isTimeoutLikeValue(renderer.error)
    || isTimeoutLikeValue(renderer.message);
};

const recordReadyMetadataBudgetExceeded = (gate, metadataObject, code) => {
  const diagnosticMetadata = compactMainFirstFrameMetadata(metadataObject);
  emitZenTrace('boot_manager:ready_metadata_wait_budget_exceeded', {
    gate,
    code,
    metadata: diagnosticMetadata,
  });
  recordBootTelemetryEvent('boot:ready_metadata_wait_budget_exceeded', {
    gate,
    code,
    elapsedMs: bootState.startedAt ? toFixedMs(nowMs() - bootState.startedAt) : 0,
    metadata: diagnosticMetadata,
  });
};

const resolveReadyMetadataContract = (metadataObject, {
  gate,
  degradedCode,
  invalidRendererCode = null,
  allowDegradedReadiness = false,
} = {}) => {
  if (!metadataObject || typeof metadataObject !== 'object') {
    return { accepted: true, degraded: false };
  }
  const rendererStatus = metadataObject?.renderer?.status ? String(metadataObject.renderer.status) : '';
  const timeoutLike = isTimeoutLikeReadyMetadata(metadataObject);
  const degraded = metadataObject.degraded === true
    || metadataObject?.renderer?.degraded === true
    || rendererStatus === 'timeout';

  if (rendererStatus === 'not_declared') {
    failBoot(gate, createBootManagerFailureError(invalidRendererCode || degradedCode, {
      gate,
      rendererStatus,
      renderer: metadataObject.renderer,
    }), {
      optional: false,
      code: invalidRendererCode || degradedCode,
    });
  }

  if (rendererStatus === 'failed' && !timeoutLike) {
    failBoot(gate, createBootManagerFailureError(invalidRendererCode || degradedCode, {
      gate,
      rendererStatus,
      renderer: metadataObject.renderer,
    }), {
      optional: false,
      code: invalidRendererCode || degradedCode,
    });
  }

  if (degraded && !allowDegradedReadiness) {
    recordReadyMetadataBudgetExceeded(gate, metadataObject, degradedCode);
    return {
      accepted: false,
      degraded: true,
    };
  }

  if (timeoutLike && !allowDegradedReadiness) {
    recordReadyMetadataBudgetExceeded(gate, metadataObject, degradedCode);
    return {
      accepted: false,
      degraded,
    };
  }

  if (timeoutLike) {
    recordReadyMetadataBudgetExceeded(gate, metadataObject, degradedCode);
  }

  return {
    accepted: true,
    degraded,
  };
};

const scheduleBootTimeout = () => {
  clearBootTimeout();
  bootTimeoutId = setTimeout(() => {
    bootTimeoutId = 0;
    recordBootWaitBudgetExceeded();
  }, BOOT_CORE_TIMEOUT_MS);
};

const startLazyPipeline = ({
  initializeCLSE,
  analysisTaskPromise,
  taskContext,
} = {}) => {
  if (lazyPipelineStarted) return;
  lazyPipelineStarted = true;
  const warmupGeneration = beginLazyWarmupGeneration();
  const {
    controller,
    generation,
    signal,
  } = warmupGeneration;
  if (
    bootState.forcedVisualRelease === true
    || bootState.status === 'failed'
    || (
      bootState.mainTabFirstFrameReady === true
      && bootState.mainTabFirstFrameDegraded === true
    )
  ) {
    cancelLazyWarmupGeneration('boot_generation_not_clean');
    if (lazyWarmupAbortController === controller) {
      lazyWarmupAbortController = null;
    }
    return;
  }

  let idleAdmission = null;
  void (async () => {
    const initialIdleAdmitted = await waitForIdleSlot(BOOT_LAZY_IDLE_TIMEOUT_MS, signal);
    if (!initialIdleAdmitted || !isLazyWarmupGenerationCurrent(generation, controller)) {
      return;
    }

    const [, criticalWarmupOutcome] = await Promise.all([
      runTask('initializeCLSE', initializeCLSE, {
        optional: true,
        context: taskContext,
      }),
      runTask('warmupDashboardSurface', () => warmupDashboardSurface({
        signal,
        timeoutMs: BOOT_SURFACE_WARMUP_TIMEOUT_MS,
      }), {
        optional: true,
        context: taskContext,
      }),
    ]);
    if (!isLazyWarmupGenerationCurrent(generation, controller)) return;

    const analysisTaskOutcome = await analysisTaskPromise;
    if (analysisTaskOutcome.error) {
      throw analysisTaskOutcome.error;
    }

    const deferredWarmupGate = await waitForDeferredWarmupGate(signal);
    recordBootTelemetryEvent('boot:deferred_surface_warmup_gate', {
      gate: deferredWarmupGate,
      generation,
    });
    if (deferredWarmupGate !== 'shell_dismissed') {
      cancelLazyWarmupGeneration(`boot_gate:${deferredWarmupGate}`);
      return;
    }
    if (!isLazyWarmupGenerationCurrent(generation, controller)) return;
    if (
      criticalWarmupOutcome.result?.cancelled === true
      || criticalWarmupOutcome.result?.timedOut === true
      || Number(criticalWarmupOutcome.result?.pendingCount) > 0
    ) {
      return;
    }

    idleAdmission = createBootIdleAdmission({ signal });
    const admission = await idleAdmission.wait({
      deadlineMs: performance.now() + BOOT_POST_REVEAL_ADMISSION_TIMEOUT_MS,
    });
    recordBootTelemetryEvent('boot:post_reveal_idle_admission', admission);
    if (admission.cancelled || admission.timedOut) return;

    const interactiveWarmupOutcome = await runTask(
      'warmupDashboardSurfaceInteractive',
      () => warmupDashboardSurfaceInteractive({
        admitEntry: idleAdmission.wait,
        signal,
        timeoutMs: BOOT_SURFACE_INTERACTIVE_TIMEOUT_MS,
      }),
      {
        optional: true,
        context: taskContext,
      },
    );
    if (!isLazyWarmupGenerationCurrent(generation, controller)) return;
    if (
      interactiveWarmupOutcome.result?.cancelled === true
      || interactiveWarmupOutcome.result?.timedOut === true
      || Number(interactiveWarmupOutcome.result?.pendingCount) > 0
    ) {
      return;
    }

    await runTask('warmupDashboardSurfaceDeferred', () => warmupDashboardSurfaceDeferred({
      admitEntry: idleAdmission.wait,
      signal,
      timeoutMs: BOOT_SURFACE_DEFERRED_TIMEOUT_MS,
    }), {
      optional: true,
      context: taskContext,
    });
  })().catch((error) => {
    recordOptionalBootTaskError('lazy_pipeline', error, {
      code: 'BOOT_LAZY_PIPELINE_FAILED',
    });
  }).finally(() => {
    idleAdmission?.dispose();
    if (lazyWarmupAbortController === controller) {
      lazyWarmupAbortController = null;
    }
  });
};

const summarizeBootPrewarmSnapshot = (snapshot = null) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      available: false,
      sections: [],
      source: null,
      ageMs: null,
      staleInMs: null,
      diagnostics: null,
    };
  }

  const now = Date.now();
  const generatedAt = Number(snapshot.generatedAtEpochMs);
  const staleAfter = Number(snapshot.staleAfterEpochMs);
  return {
    available: true,
    sections: ['preference', 'protocol', 'analysis', 'clse'].filter((key) => (
      snapshot[key] && typeof snapshot[key] === 'object'
    )),
    source: typeof snapshot.source === 'string' ? snapshot.source : null,
    ageMs: Number.isFinite(generatedAt) ? Math.max(0, now - generatedAt) : null,
    staleInMs: Number.isFinite(staleAfter) ? Math.max(0, staleAfter - now) : null,
    diagnostics: snapshot.meta?.diagnostics && typeof snapshot.meta.diagnostics === 'object'
      ? snapshot.meta.diagnostics
      : null,
  };
};

export const getBootSnapshot = () => getSnapshot();

export const subscribeBootState = (listener) => {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const reportThemeReady = (metadata = null) => {
  if (bootState.themeReady) {
    failBoot('reportThemeReady', createBootManagerFailureError('BOOT_THEME_READY_DUPLICATE', {
      metadata,
      previous: {
        status: bootState.status,
        phase: bootState.phase,
        themeReady: bootState.themeReady,
      },
    }), {
      optional: false,
      code: 'BOOT_THEME_READY_DUPLICATE',
    });
  }
  const metadataObject = metadata && typeof metadata === 'object' ? { ...metadata } : null;
  const metadataContract = resolveReadyMetadataContract(metadataObject, {
    gate: 'reportThemeReady',
    degradedCode: 'BOOT_THEME_READY_DEGRADED',
    invalidRendererCode: 'BOOT_THEME_RENDERER_NOT_READY',
    allowDegradedReadiness: true,
  });
  const themeShellDegraded = metadataContract.degraded === true;
  emitZenTrace('boot_manager:theme_ready', { metadata });
  updateBootState({
    themeReady: true,
    themeShellDegraded,
  });
  syncBootPhase({
    gate: 'theme_ready',
    degraded: themeShellDegraded,
  });
  recordBootTelemetryEvent('theme_shell:ready', {
    elapsedMs: bootState.startedAt ? toFixedMs(nowMs() - bootState.startedAt) : 0,
    degraded: themeShellDegraded,
    metadata: metadataObject,
  });
  if (bootState.startedAt) {
    recordBootTelemetryLoaderVisibility(true, metadataObject);
  }
  maybePromoteDismissible('theme_ready');
  return getSnapshot();
};

export const reportMainTabFirstFrameReady = (metadata = null) => {
  if (bootState.mainTabFirstFrameReady) {
    failBoot('reportMainTabFirstFrameReady', createBootManagerFailureError('BOOT_MAIN_FIRST_FRAME_DUPLICATE', {
      metadata,
      previous: {
        status: bootState.status,
        phase: bootState.phase,
        mainTabFirstFrameReady: bootState.mainTabFirstFrameReady,
      },
    }), {
      optional: false,
      code: 'BOOT_MAIN_FIRST_FRAME_DUPLICATE',
    });
  }
  const metadataObject = metadata && typeof metadata === 'object' ? { ...metadata } : null;
  const metadataContract = resolveReadyMetadataContract(metadataObject, {
    gate: 'reportMainTabFirstFrameReady',
    degradedCode: 'BOOT_MAIN_FIRST_FRAME_DEGRADED',
  });
  if (!metadataContract.accepted) {
    updateBootState({
      mainTabFirstFrameWaitBudgetExceeded: true,
    });
    return getSnapshot();
  }
  const mainTabFirstFrameDegraded = metadataContract.degraded === true;
  const mainTabFirstFrameWaitBudgetExceeded = bootState.mainTabFirstFrameWaitBudgetExceeded === true
    || mainTabFirstFrameDegraded
    || bootState.forcedVisualRelease === true;
  const diagnosticMetadata = compactMainFirstFrameMetadata(metadataObject);
  // First-frame readiness is a release-gate state commit. Debug trace/telemetry
  // must never run ahead of it, because dev-only storage pressure can be busy.
  updateBootState({
    mainTabFirstFrameReady: true,
    mainTabFirstFrameDegraded,
    mainTabFirstFrameWaitBudgetExceeded,
    degraded: resolveBootReleaseDegraded({
      mainTabFirstFrameDegraded,
    }),
  });
  if (mainTabFirstFrameDegraded) {
    cancelLazyWarmupGeneration('main_frame_degraded');
  }
  syncBootPhase({
    gate: 'main_frame_ready',
    degraded: mainTabFirstFrameDegraded,
  });
  recordBootTelemetryEvent('main_tab:first_frame_ready', {
    elapsedMs: toFixedMs(nowMs() - bootState.startedAt),
    degraded: mainTabFirstFrameDegraded,
    metadata: diagnosticMetadata,
  });
  maybePromoteDismissible('main_tab_first_frame');
  emitZenTrace('boot_manager:main_tab_first_frame_ready', {
    metadata: diagnosticMetadata,
    degraded: mainTabFirstFrameDegraded,
  });
  return getSnapshot();
};

export const reportMainTabFirstFrameFailed = (metadata = null) => {
  cancelLazyWarmupGeneration('main_frame_failed');
  const metadataObject = metadata && typeof metadata === 'object' ? { ...metadata } : null;
  const diagnosticMetadata = compactMainFirstFrameMetadata(metadataObject);
  if (bootState.mainTabFirstFrameReady === true) {
    emitZenTrace('boot_manager:main_tab_first_frame_failed_ignored_after_ready', {
      metadata: diagnosticMetadata,
      mainTabFirstFrameDegraded: bootState.mainTabFirstFrameDegraded,
      mainTabFirstFrameWaitBudgetExceeded: bootState.mainTabFirstFrameWaitBudgetExceeded,
    });
    recordBootTelemetryEvent('main_tab:first_frame_failed_ignored_after_ready', {
      elapsedMs: bootState.startedAt ? toFixedMs(nowMs() - bootState.startedAt) : 0,
      degraded: bootState.mainTabFirstFrameDegraded === true,
      metadata: diagnosticMetadata,
    });
    return getSnapshot();
  }
  recordBootDiagnosticError('reportMainTabFirstFrameFailed', createBootManagerFailureError('BOOT_MAIN_FIRST_FRAME_FAILED', {
    metadata: metadataObject,
  }), {
    code: 'BOOT_MAIN_FIRST_FRAME_FAILED',
    severity: 'degraded',
    optional: false,
  });
  emitZenTrace('boot_manager:main_tab_first_frame_failed_degraded', {
    metadata: diagnosticMetadata,
  });
  updateBootState({
    mainTabFirstFrameReady: true,
    mainTabFirstFrameDegraded: true,
    mainTabFirstFrameWaitBudgetExceeded: true,
  });
  syncBootPhase({
    gate: 'main_frame_failed_degraded',
    degraded: true,
  });
  recordBootTelemetryEvent('main_tab:first_frame_failed_degraded', {
    elapsedMs: bootState.startedAt ? toFixedMs(nowMs() - bootState.startedAt) : 0,
    degraded: true,
    metadata: diagnosticMetadata,
  });
  maybePromoteDismissible('main_tab_first_frame_failed_degraded');
  return getSnapshot();
};

export const reportForcedVisualRelease = (metadata = null) => {
  if (bootState.dismissible) {
    emitZenTrace('boot_manager:forced_visual_release_ignored_after_dismissible', {
      metadata,
      status: bootState.status,
      phase: bootState.phase,
      forcedVisualRelease: bootState.forcedVisualRelease === true,
    });
    return getSnapshot();
  }
  const metadataObject = metadata && typeof metadata === 'object' ? { ...metadata } : null;
  const reason = typeof metadataObject?.reason === 'string' && metadataObject.reason.trim()
    ? metadataObject.reason.trim()
    : 'forced_visual_release';
  cancelLazyWarmupGeneration(`forced_visual_release:${reason}`);
  const elapsedMs = bootState.startedAt ? toFixedMs(nowMs() - bootState.startedAt) : 0;
  const previousPhase = bootState.phase;
  const nextPhase = 'forced_visual_release';

  // This is not clean readiness. Commit the visible forced-release state before
  // trace/telemetry so a busy diagnostic path cannot make the reveal look ready.
  updateBootState({
    phase: nextPhase,
    degraded: true,
    forcedVisualRelease: true,
    forcedVisualReleaseReason: reason,
    mainTabFirstFrameWaitBudgetExceeded: bootState.mainTabFirstFrameReady !== true
      || bootState.mainTabFirstFrameWaitBudgetExceeded === true,
  });
  if (previousPhase !== nextPhase && bootState.startedAt) {
    recordBootTelemetryPhaseTransition(nextPhase, {
      elapsedMs,
      reason,
      source: metadataObject?.source || null,
      timeoutMs: metadataObject?.timeoutMs ?? null,
    });
  }
  recordBootTelemetryEvent('boot:forced_visual_release', {
    elapsedMs,
    reason,
    status: bootState.status,
    phase: bootState.phase,
    themeReady: bootState.themeReady,
    coreReady: bootState.coreReady,
    mainTabFirstFrameReady: bootState.mainTabFirstFrameReady,
    mainTabFirstFrameWaitBudgetExceeded: bootState.mainTabFirstFrameWaitBudgetExceeded,
    metadata: metadataObject,
  });
  emitZenTrace('boot_manager:forced_visual_release', {
    elapsedMs,
    reason,
    metadata: metadataObject,
  });
  return getSnapshot();
};

export const reportBootShellDismissed = (metadata = null) => {
  if (bootState.shellDismissed) {
    failBoot('reportBootShellDismissed', createBootManagerFailureError('BOOT_SHELL_DISMISS_DUPLICATE', {
      metadata,
      previous: {
        status: bootState.status,
        phase: bootState.phase,
        shellDismissed: bootState.shellDismissed,
      },
    }), {
      optional: false,
      code: 'BOOT_SHELL_DISMISS_DUPLICATE',
    });
  }
  const metadataObject = metadata && typeof metadata === 'object' ? { ...metadata } : null;
  if (metadataObject?.reason === 'hard_timeout' || metadataObject?.reason === 'presentation_failed') {
    cancelLazyWarmupGeneration(`boot_shell:${metadataObject.reason}`);
  }
  updateBootState({
    shellDismissed: true,
  });
  emitZenTrace('boot_manager:shell_dismissed', {
    metadata,
    status: bootState.status,
    phase: bootState.phase,
    shellDismissed: bootState.shellDismissed,
  });
  recordBootTelemetryLoaderVisibility(false, metadataObject);
  recordBootTelemetryEvent('theme_shell:dismissed', {
    elapsedMs: bootState.startedAt ? toFixedMs(nowMs() - bootState.startedAt) : 0,
    metadata: metadataObject,
  });
  return getSnapshot();
};

export const startBootSequence = ({
  initializePreference,
  initializeProtocol,
  initializeCLSE,
  initializeAnalysis,
} = {}) => {
  if (bootState.status === 'ready' || bootState.status === 'timeout' || bootState.status === 'failed') {
    throw createBootManagerFailureError('BOOT_SEQUENCE_ALREADY_FINISHED', {
      status: bootState.status,
      phase: bootState.phase,
    });
  }
  if (bootRunPromise) {
    throw createBootManagerFailureError('BOOT_SEQUENCE_ALREADY_RUNNING', {
      status: bootState.status,
      phase: bootState.phase,
    });
  }

  const wasThemeReady = bootState.themeReady === true;
  const wasThemeShellDegraded = bootState.themeShellDegraded === true;
  const wasMainFrameReady = bootState.mainTabFirstFrameReady === true;
  const wasMainFrameDegraded = bootState.mainTabFirstFrameDegraded === true;
  const wasForcedVisualRelease = bootState.forcedVisualRelease === true;
  const wasShellDismissed = bootState.shellDismissed === true;
  const forcedVisualReleaseReason = bootState.forcedVisualReleaseReason;
  const prestartErrors = Array.isArray(bootState.errors) ? [...bootState.errors] : [];
  telemetryCompleted = false;
  cancelLazyWarmupGeneration('boot_sequence_restarted');
  lazyPipelineStarted = false;

  const startedAt = nowMs();
  emitZenTrace('boot_manager:start_sequence', {
    wasThemeReady,
    wasThemeShellDegraded,
    wasMainFrameReady,
    wasMainFrameDegraded,
    timeoutMs: BOOT_CORE_TIMEOUT_MS,
  });
  startBootTelemetrySession({
    bootTimeoutMs: BOOT_CORE_TIMEOUT_MS,
  });
  updateBootState({
    status: 'booting',
    phase: 'booting',
    startedAt,
    themeReady: wasThemeReady,
    themeShellDegraded: wasThemeReady ? wasThemeShellDegraded : false,
    coreReady: false,
    coreWaitBudgetExceeded: false,
    mainTabFirstFrameReady: wasMainFrameReady,
    mainTabFirstFrameDegraded: wasMainFrameReady ? wasMainFrameDegraded : false,
    mainTabFirstFrameWaitBudgetExceeded: false,
    forcedVisualRelease: wasForcedVisualRelease,
    forcedVisualReleaseReason: wasForcedVisualRelease ? forcedVisualReleaseReason : null,
    shellDismissed: wasShellDismissed,
    dismissible: false,
    degraded: wasForcedVisualRelease,
    errors: prestartErrors,
  });
  recordBootTelemetryPhaseTransition('booting', {
    timeoutMs: BOOT_CORE_TIMEOUT_MS,
  });
  if (wasThemeReady) {
    recordBootTelemetryLoaderVisibility(true, {
      source: 'prestart_theme_ready',
      degraded: wasThemeShellDegraded,
    });
    transitionBootPhaseIfNeeded('theme_ready', {
      source: 'prestart_theme_ready',
      degraded: wasThemeShellDegraded,
    });
  }
  if (wasMainFrameReady) {
    syncBootPhase({
      source: 'prestart_main_frame_ready',
    });
  }
  scheduleBootTimeout();

  bootRunPromise = (async () => {
    const prewarmResult = await runTask('fetchBootPrewarmSnapshot', () => fetchBootPrewarmSnapshot({
      reason: 'dashboard_boot_sequence',
    }), {
      optional: true,
    });
    const prewarmSnapshot = prewarmResult?.result || null;
    recordBootTelemetryEvent('prewarm:snapshot', {
      ...summarizeBootPrewarmSnapshot(prewarmSnapshot),
      failed: !!prewarmResult?.error,
      errorCode: prewarmResult?.error?.code || null,
      errorMessage: prewarmResult?.error ? formatErrorMessage(prewarmResult.error) : null,
    });
    const taskContext = {
      prewarmSnapshot,
      awaitFreshStatusSnapshot: prewarmSnapshot?.preference?.themeId === 'zen',
    };
    const analysisTaskPromise = runTask('initializeAnalysis', initializeAnalysis, {
      optional: true,
      context: taskContext,
    }).then(
      (result) => ({ result, error: null }),
      (error) => ({ result: null, error }),
    );

    const [preferenceResult, protocolResult] = await Promise.all([
      runTask('initializePreference', initializePreference, {
        optional: false,
        context: taskContext,
      }),
      runTask('initializeProtocol', initializeProtocol, {
        optional: false,
        context: taskContext,
      }),
    ]);

    emitZenTrace('boot_manager:core_ready', {
      preferenceMs: toFixedMs(preferenceResult?.durationMs || 0),
      protocolMs: toFixedMs(protocolResult?.durationMs || 0),
    });
    updateBootState({
      coreReady: true,
    });
    syncBootPhase({
      gate: 'core_ready',
    });
    recordBootTelemetryEvent('core:ready', {
      elapsedMs: toFixedMs(nowMs() - bootState.startedAt),
    });
    maybePromoteDismissible('core_ready');

    startLazyPipeline({
      initializeCLSE,
      analysisTaskPromise,
      taskContext,
    });

    return getSnapshot();
  })()
    .catch((error) => {
      failBoot('startBootSequence', error, {
        optional: false,
        code: error?.code || 'BOOT_SEQUENCE_FAILED',
      });
    })
    .finally(() => {
      bootRunPromise = null;
    });

  return bootRunPromise;
};

// React development lifecycles may detach and reattach the dashboard owner
// while the module-scoped boot state machine remains alive. Reconnect that
// owner to the canonical run without weakening startBootSequence's strict
// duplicate-owner detection for direct callers.
export const ensureBootSequenceStarted = (initializers = {}) => {
  if (bootRunPromise) {
    emitZenTrace('boot_manager:sequence_reused', {
      reason: 'run_in_flight',
      status: bootState.status,
      phase: bootState.phase,
    });
    return bootRunPromise;
  }
  if (bootState.status !== 'idle') {
    emitZenTrace('boot_manager:sequence_reused', {
      reason: 'state_already_started',
      status: bootState.status,
      phase: bootState.phase,
    });
    return Promise.resolve(getSnapshot());
  }
  return startBootSequence(initializers);
};
