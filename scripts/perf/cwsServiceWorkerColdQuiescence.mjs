export const CWS_SERVICE_WORKER_COLD_QUIET_WINDOW_MS = 100;
export const CWS_SERVICE_WORKER_COLD_QUIESCENCE_TIMEOUT_MS = 8_000;
export const CWS_SERVICE_WORKER_COLD_POLL_INTERVAL_MS = 25;

const CWS_SERVICE_WORKER_COLD_DIAGNOSTIC_TARGET_LIMIT = 20;

function waitForDuration(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

function requirePositiveDuration(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label}:${value}`);
  }
  return Math.floor(value);
}

function createColdQuiescenceState({ startedAtEpochMs, quietWindowMs, timeoutMs }) {
  return {
    startedAtEpochMs,
    quietWindowMs,
    timeoutMs,
    quietSinceEpochMs: null,
    lastClosedTarget: null,
    lastObservedTargetId: null,
    observedTargetCount: 0,
    closeAttemptCount: 0,
    closedTargetIds: new Set(),
    recentObservedTargetIds: [],
  };
}

function rememberObservedTarget(state, targetId) {
  state.lastObservedTargetId = targetId;
  state.observedTargetCount += 1;
  if (state.recentObservedTargetIds.at(-1) === targetId) return;
  state.recentObservedTargetIds.push(targetId);
  if (
    state.recentObservedTargetIds.length
    > CWS_SERVICE_WORKER_COLD_DIAGNOSTIC_TARGET_LIMIT
  ) {
    state.recentObservedTargetIds.shift();
  }
}

function projectColdQuiescenceDiagnostics(state, nowEpochMs) {
  return {
    lifecyclePhase: 'service_worker_cold_quiescence',
    startedAtEpochMs: state.startedAtEpochMs,
    observedAtEpochMs: nowEpochMs,
    elapsedMs: Math.max(0, nowEpochMs - state.startedAtEpochMs),
    quietWindowMs: state.quietWindowMs,
    timeoutMs: state.timeoutMs,
    quietForMs: Number.isFinite(state.quietSinceEpochMs)
      ? Math.max(0, nowEpochMs - state.quietSinceEpochMs)
      : 0,
    lastClosedTargetId: state.lastClosedTarget?.targetId || null,
    lastObservedTargetId: state.lastObservedTargetId,
    observedTargetCount: state.observedTargetCount,
    closeAttemptCount: state.closeAttemptCount,
    closedTargetCount: state.closedTargetIds.size,
    recentObservedTargetIds: [...state.recentObservedTargetIds],
  };
}

function createColdQuiescenceError(code, state, nowEpochMs, cause = null) {
  const diagnostics = projectColdQuiescenceDiagnostics(state, nowEpochMs);
  const error = new Error(
    `${code}:${JSON.stringify(diagnostics)}`,
    cause ? { cause } : undefined,
  );
  error.code = code;
  error.cwsRuntimeDiagnostics = diagnostics;
  return error;
}

export async function quiesceCwsServiceWorkerBeforeColdProbe({
  initialTarget,
  observeOwnedTarget,
  detachTarget,
  closeTarget,
  now = () => Date.now(),
  wait = waitForDuration,
  quietWindowMs = CWS_SERVICE_WORKER_COLD_QUIET_WINDOW_MS,
  timeoutMs = CWS_SERVICE_WORKER_COLD_QUIESCENCE_TIMEOUT_MS,
  pollIntervalMs = CWS_SERVICE_WORKER_COLD_POLL_INTERVAL_MS,
} = {}) {
  if (!initialTarget?.targetId) {
    throw new Error('CWS_SERVICE_WORKER_COLD_INITIAL_TARGET_INVALID');
  }
  for (const [label, callback] of [
    ['OBSERVE', observeOwnedTarget],
    ['DETACH', detachTarget],
    ['CLOSE', closeTarget],
    ['NOW', now],
    ['WAIT', wait],
  ]) {
    if (typeof callback !== 'function') {
      throw new Error(`CWS_SERVICE_WORKER_COLD_${label}_CALLBACK_INVALID`);
    }
  }
  const boundedQuietWindowMs = requirePositiveDuration(
    quietWindowMs,
    'CWS_SERVICE_WORKER_COLD_QUIET_WINDOW_INVALID',
  );
  const boundedTimeoutMs = requirePositiveDuration(
    timeoutMs,
    'CWS_SERVICE_WORKER_COLD_TIMEOUT_INVALID',
  );
  const boundedPollIntervalMs = requirePositiveDuration(
    pollIntervalMs,
    'CWS_SERVICE_WORKER_COLD_POLL_INTERVAL_INVALID',
  );
  if (boundedQuietWindowMs > boundedTimeoutMs) {
    throw new Error('CWS_SERVICE_WORKER_COLD_QUIET_WINDOW_EXCEEDS_TIMEOUT');
  }

  const startedAtEpochMs = now();
  const deadlineEpochMs = startedAtEpochMs + boundedTimeoutMs;
  const state = createColdQuiescenceState({
    startedAtEpochMs,
    quietWindowMs: boundedQuietWindowMs,
    timeoutMs: boundedTimeoutMs,
  });

  const closeObservedTarget = async (target) => {
    const targetId = target?.targetId;
    if (!targetId) {
      throw createColdQuiescenceError(
        'CWS_SERVICE_WORKER_COLD_OBSERVED_TARGET_INVALID',
        state,
        now(),
      );
    }
    rememberObservedTarget(state, targetId);
    state.quietSinceEpochMs = null;
    if (state.closedTargetIds.has(targetId)) return;
    state.closeAttemptCount += 1;
    try {
      await detachTarget(target);
      const result = await closeTarget(target);
      if (result?.success !== true) {
        throw new Error(`TARGET_CLOSE_REJECTED:${targetId}`);
      }
    } catch (cause) {
      throw createColdQuiescenceError(
        'CWS_SERVICE_WORKER_COLD_CLOSE_FAILED',
        state,
        now(),
        cause,
      );
    }
    state.closedTargetIds.add(targetId);
    state.lastClosedTarget = target;
  };

  await closeObservedTarget(initialTarget);
  while (true) {
    const beforeObservationEpochMs = now();
    if (beforeObservationEpochMs > deadlineEpochMs) {
      throw createColdQuiescenceError(
        'CWS_SERVICE_WORKER_COLD_QUIESCENCE_TIMEOUT',
        state,
        beforeObservationEpochMs,
      );
    }

    let observedTarget;
    try {
      observedTarget = await observeOwnedTarget();
    } catch (cause) {
      throw createColdQuiescenceError(
        'CWS_SERVICE_WORKER_COLD_OBSERVE_FAILED',
        state,
        now(),
        cause,
      );
    }
    const observedAtEpochMs = now();
    if (observedTarget?.targetId) {
      await closeObservedTarget(observedTarget);
    } else {
      if (!Number.isFinite(state.quietSinceEpochMs)) {
        state.quietSinceEpochMs = observedAtEpochMs;
      }
      if (observedAtEpochMs - state.quietSinceEpochMs >= boundedQuietWindowMs) {
        return {
          lastClosedTarget: state.lastClosedTarget,
          diagnostics: projectColdQuiescenceDiagnostics(state, observedAtEpochMs),
        };
      }
    }

    const remainingMs = deadlineEpochMs - now();
    if (remainingMs <= 0) {
      throw createColdQuiescenceError(
        'CWS_SERVICE_WORKER_COLD_QUIESCENCE_TIMEOUT',
        state,
        now(),
      );
    }
    await wait(Math.min(boundedPollIntervalMs, remainingMs));
  }
}
