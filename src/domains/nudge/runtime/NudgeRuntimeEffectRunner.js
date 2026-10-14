import { NUDGE_RUNTIME_EVENT } from './NudgeRuntimeMachine.js';

export const NUDGE_RUNTIME_EFFECT = Object.freeze({
  EXECUTE_PREWARM: 'EXECUTE_PREWARM',
  EXECUTE_ACTIVATE: 'EXECUTE_ACTIVATE',
  SCHEDULE_BOOT_TIMEOUT: 'SCHEDULE_BOOT_TIMEOUT',
  CLEAR_BOOT_TIMEOUT: 'CLEAR_BOOT_TIMEOUT',
  DEACTIVATE_WORKER_RUNTIME: 'DEACTIVATE_WORKER_RUNTIME',
  RELEASE_WORKER_SESSION: 'RELEASE_WORKER_SESSION',
});

function pushUniqueEffect(effects, type) {
  if (!effects.some((effect) => effect?.type === type)) {
    effects.push({ type });
  }
}

function normalizeOperationContext(context) {
  return context?.operation && typeof context.operation === 'object'
    ? context.operation
    : {};
}

function createFailedOperationResult() {
  return { ok: false };
}

function formatWorkerOperationError(prefix, error) {
  const code = typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim()
    : '';
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : String(error || 'worker_operation_failed');
  if (!code || message.startsWith(`${code}:`)) {
    return `${prefix}:${message}`;
  }
  return `${prefix}:${code}:${message}`;
}

function didWorkerBootResolve(prevStage, nextStage, prevMode, nextMode) {
  if (prevMode === 'worker' && nextMode !== 'worker') return true;
  if (prevStage !== 'worker:booting') return false;
  return (
    nextStage === 'worker:ready'
    || nextStage === 'worker:active'
    || nextStage === 'worker:error'
    || nextStage === 'worker:deactivated'
  );
}

export function planNudgeRuntimeEffects({
  prevState,
  nextState,
  event,
} = {}) {
  const effects = [];
  const eventType = typeof event?.type === 'string' ? event.type : '';
  const prevStage = typeof prevState?.stage === 'string' ? prevState.stage : '';
  const nextStage = typeof nextState?.stage === 'string' ? nextState.stage : '';
  const prevMode = typeof prevState?.runtimeMode === 'string' ? prevState.runtimeMode : 'none';
  const nextMode = typeof nextState?.runtimeMode === 'string' ? nextState.runtimeMode : 'none';

  if (eventType === NUDGE_RUNTIME_EVENT.PREWARM_BEGIN) {
    pushUniqueEffect(effects, NUDGE_RUNTIME_EFFECT.EXECUTE_PREWARM);
  }

  if (eventType === NUDGE_RUNTIME_EVENT.WORKER_ACTIVATE_BEGIN) {
    pushUniqueEffect(effects, NUDGE_RUNTIME_EFFECT.EXECUTE_ACTIVATE);
  }

  if (nextStage === 'worker:booting' && prevStage !== 'worker:booting') {
    pushUniqueEffect(effects, NUDGE_RUNTIME_EFFECT.SCHEDULE_BOOT_TIMEOUT);
  }

  if (didWorkerBootResolve(prevStage, nextStage, prevMode, nextMode)) {
    pushUniqueEffect(effects, NUDGE_RUNTIME_EFFECT.CLEAR_BOOT_TIMEOUT);
  }

  if (eventType === NUDGE_RUNTIME_EVENT.WORKER_DEACTIVATE && nextStage === 'worker:deactivated') {
    pushUniqueEffect(effects, NUDGE_RUNTIME_EFFECT.DEACTIVATE_WORKER_RUNTIME);
  }

  if (eventType === NUDGE_RUNTIME_EVENT.WORKER_ERROR && nextStage === 'worker:error') {
    pushUniqueEffect(effects, NUDGE_RUNTIME_EFFECT.RELEASE_WORKER_SESSION);
  }

  if (eventType === NUDGE_RUNTIME_EVENT.RESET) {
    pushUniqueEffect(effects, NUDGE_RUNTIME_EFFECT.RELEASE_WORKER_SESSION);
  }

  return effects;
}

export function runNudgeRuntimeEffects({
  coordinator,
  effects = [],
  nextState,
  context = null,
} = {}) {
  if (!coordinator || !Array.isArray(effects) || effects.length === 0) {
    return null;
  }

  let operationResult = null;

  for (const effect of effects) {
    const effectType = typeof effect?.type === 'string' ? effect.type : '';

    switch (effectType) {
      case NUDGE_RUNTIME_EFFECT.EXECUTE_PREWARM: {
        const operation = normalizeOperationContext(context);
        try {
          const session = coordinator.ensureSession();
          const prepared = session.prewarm(operation);
          if (prepared) {
            coordinator.dispatch(NUDGE_RUNTIME_EVENT.PREWARM_READY, {
              sessionId: session.getSessionId(),
            });
            operationResult = { ok: true };
          } else {
            coordinator.dispatch(NUDGE_RUNTIME_EVENT.PREWARM_FAIL, {
              error: 'prewarm_failed',
            });
            operationResult = createFailedOperationResult();
          }
        } catch (error) {
          coordinator.dispatch(NUDGE_RUNTIME_EVENT.PREWARM_FAIL, {
            error: formatWorkerOperationError('worker:prewarm_throw', error),
          });
          coordinator.resetSession();
          operationResult = createFailedOperationResult();
        }
        break;
      }

      case NUDGE_RUNTIME_EFFECT.EXECUTE_ACTIVATE: {
        const operation = normalizeOperationContext(context);
        try {
          const session = coordinator.ensureSession();
          const sessionId = session.activate(operation);
          if (!sessionId) {
            coordinator.dispatch(NUDGE_RUNTIME_EVENT.WORKER_ACTIVATE_FAIL, {
              error: 'activate_failed',
            });
            operationResult = createFailedOperationResult();
            break;
          }
          coordinator.dispatch(NUDGE_RUNTIME_EVENT.WORKER_ACTIVATE_SUCCESS, {
            sessionId,
            stats: context?.mainSnapshot || null,
          });
          operationResult = { ok: true };
        } catch (error) {
          coordinator.dispatch(NUDGE_RUNTIME_EVENT.WORKER_ACTIVATE_FAIL, {
            error: formatWorkerOperationError('worker:activate_throw', error),
          });
          coordinator.resetSession();
          operationResult = createFailedOperationResult();
        }
        break;
      }

      case NUDGE_RUNTIME_EFFECT.SCHEDULE_BOOT_TIMEOUT:
        coordinator.scheduleBootTimeout();
        break;

      case NUDGE_RUNTIME_EFFECT.CLEAR_BOOT_TIMEOUT:
        coordinator.clearBootTimeout();
        break;

      case NUDGE_RUNTIME_EFFECT.DEACTIVATE_WORKER_RUNTIME:
        coordinator.deactivate({ resetSession: false });
        break;

      case NUDGE_RUNTIME_EFFECT.RELEASE_WORKER_SESSION:
        coordinator.deactivate({ resetSession: true });
        break;

      default:
        break;
    }
  }

  return operationResult;
}
