import {
  GLOBAL_SENTINEL_GAME_PHASES,
  GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
} from '../nudge/nudgeGameGlobalSentinelProtocol.js';
import {
  SITE_FURIN_PROTOCOL_SYSTEM,
  beginSiteFurinExit,
  resetSiteFurinExit,
  setSiteFurinAction,
} from '../nudge/nudgeGameSiteFurinProtocol.js';
import {
  globalSentinelProtocolAdapter,
  resolveSentinelProtocolAdapter,
  siteFurinProtocolAdapter,
} from '../nudge/sentinelProtocolAdapters.js';
import {
  isGlobalNudgeProtocolScene,
} from '../protocols/nudgeProtocolScene.js';
import {
  createSentinelProtocolStatePair,
} from './SentinelProtocolHostSessionModel.js';

const GLOBAL_OUTCOME_NUMERIC_FIELDS = Object.freeze([
  'fracture',
  'stableFracture',
  'volatileFracture',
  'syncPressure',
  'syncPressureRelief',
  'lastHitEfficiency',
  'lastFractureImpulse',
  'lastSyncPressureRelief',
]);
const GLOBAL_OUTCOME_INTEGER_FIELDS = Object.freeze([
  'strokeCount',
  'dormantCount',
  'startedAtMs',
  'deadlineAtMs',
  'hardDeadlineAtMs',
  'missCount',
  'evaluatedThroughBeatIndex',
]);
const GLOBAL_OUTCOME_EPSILON = 1e-7;

function resolveGlobalOutcomeMismatch(expected = null, actual = null) {
  if (!expected || typeof expected !== 'object') return 'missing';
  if (expected.protocolSystem !== GLOBAL_SENTINEL_PROTOCOL_SYSTEM) return 'protocol_system';
  if (expected.gamePhase !== actual?.gamePhase) return 'game_phase';
  if ((expected.completed === true) !== (actual?.completed === true)) return 'completed';
  if ((expected.failed === true) !== (actual?.failed === true)) return 'failed';
  for (const field of GLOBAL_OUTCOME_INTEGER_FIELDS) {
    const expectedValue = Math.round(Number(expected[field]));
    const actualValue = Math.round(Number(actual?.[field]));
    if (!Number.isFinite(expectedValue) || expectedValue !== actualValue) return field;
  }
  for (const field of GLOBAL_OUTCOME_NUMERIC_FIELDS) {
    const expectedValue = Number(expected[field]);
    const actualValue = Number(actual?.[field]);
    if (
      !Number.isFinite(expectedValue)
      || !Number.isFinite(actualValue)
      || Math.abs(expectedValue - actualValue) > GLOBAL_OUTCOME_EPSILON
    ) {
      return field;
    }
  }
  const impactSerial = Math.round(Number(expected.fractureImpactSerial));
  if (!Number.isFinite(impactSerial) || impactSerial !== actual.strokeCount) {
    return 'fracture_impact_serial';
  }
  return '';
}

export function createSentinelProtocolSessionController({
  config = null,
  protocolScene = null,
  now = 0,
} = {}) {
  let activeConfig = config;
  let activeProtocolScene = protocolScene;
  let states = createSentinelProtocolStatePair({
    now,
    config: activeConfig,
    isGlobalProtocolActive: isGlobalProtocolActive(),
  });

  function setContext({
    config: nextConfig = activeConfig,
    protocolScene: nextProtocolScene = activeProtocolScene,
  } = {}) {
    activeConfig = nextConfig;
    activeProtocolScene = nextProtocolScene;
    return {
      config: activeConfig,
      protocolScene: activeProtocolScene,
    };
  }

  function isGlobalProtocolActive() {
    return isGlobalNudgeProtocolScene(activeProtocolScene);
  }

  function resolveActiveProtocolAdapter() {
    return resolveSentinelProtocolAdapter(activeProtocolScene || activeConfig);
  }

  function resolveActiveProtocolSystem() {
    return activeProtocolScene?.protocolSystem
      || (isGlobalProtocolActive() ? GLOBAL_SENTINEL_PROTOCOL_SYSTEM : SITE_FURIN_PROTOCOL_SYSTEM);
  }

  function getActiveState() {
    return isGlobalProtocolActive()
      ? states.globalSentinelSimulationState
      : states.siteFurinState;
  }

  function setActiveState(nextState = null) {
    if (isGlobalProtocolActive()) {
      states = {
        ...states,
        globalSentinelSimulationState: nextState,
      };
      return;
    }
    states = {
      ...states,
      siteFurinState: nextState,
    };
  }

  function resolveProgress(options = {}) {
    const adapter = resolveActiveProtocolAdapter();
    const state = adapter.protocolSystem === GLOBAL_SENTINEL_PROTOCOL_SYSTEM
      ? states.globalSentinelSimulationState
      : states.siteFurinState;
    return adapter.resolveProgress(state, activeConfig, options);
  }

  function buildWorkerProtocolProgress({
    now: progressNow = Date.now(),
  } = {}) {
    const progress = resolveProgress({ now: progressNow });
    return resolveActiveProtocolAdapter().buildWorkerProgress(progress);
  }

  function reset({
    now: resetNow = Date.now(),
    config: nextConfig = activeConfig,
    protocolScene: nextProtocolScene = activeProtocolScene,
  } = {}) {
    setContext({
      config: nextConfig,
      protocolScene: nextProtocolScene,
    });
    states = createSentinelProtocolStatePair({
      now: resetNow,
      config: activeConfig,
      isGlobalProtocolActive: isGlobalProtocolActive(),
    });
    return getStateSnapshot();
  }

  function getStateSnapshot() {
    return {
      globalSentinelSimulationState: states.globalSentinelSimulationState,
      siteFurinState: states.siteFurinState,
    };
  }

  function isGlobalAwaitingStart({
    now: progressNow = Date.now(),
    modalOpen = false,
    terminalActive = false,
  } = {}) {
    if (!isGlobalProtocolActive() || modalOpen || terminalActive) return false;
    const progress = resolveProgress({ now: progressNow });
    return progress.gamePhase === GLOBAL_SENTINEL_GAME_PHASES.AWAITING_START;
  }

  function checkGlobalFailure({
    now: failureNow = Date.now(),
    blocked = false,
  } = {}) {
    if (blocked || !isGlobalProtocolActive()) {
      return {
        failed: false,
        progress: resolveProgress({ now: failureNow }),
      };
    }
    const current = states.globalSentinelSimulationState;
    if (current?.completed || current?.failed) {
      return {
        failed: false,
        progress: resolveProgress({ now: failureNow }),
      };
    }
    if (!globalSentinelProtocolAdapter.isExpired(current, activeConfig, { now: failureNow })) {
      return {
        failed: false,
        progress: resolveProgress({ now: failureNow }),
      };
    }
    states = {
      ...states,
      globalSentinelSimulationState: {
        ...current,
        failed: true,
      },
    };
    return {
      failed: true,
      progress: resolveProgress({ now: failureNow }),
    };
  }

  function advanceAcceptedInput({
    now: inputNow = Date.now(),
    hitEfficiency = null,
    expectedGlobalOutcome = null,
  } = {}) {
    if (isGlobalProtocolActive()) {
      if (states.globalSentinelSimulationState?.completed) {
        return {
          advanced: false,
          rejected: false,
          alreadyCompleted: true,
          completed: true,
          shouldSetReflection: false,
          shouldScheduleCompletion: true,
          wasGlobalAwaitingStart: false,
          progress: resolveProgress({ now: inputNow }),
        };
      }
      const wasGlobalAwaitingStart = isGlobalAwaitingStart({ now: inputNow });
      const nextState = globalSentinelProtocolAdapter.advanceAcceptedInput(
        states.globalSentinelSimulationState,
        activeConfig,
        { now: inputNow, hitEfficiency },
      );
      const nextProgress = globalSentinelProtocolAdapter.resolveProgress(
        nextState,
        activeConfig,
        { now: inputNow },
      );
      if (expectedGlobalOutcome) {
        const mismatch = resolveGlobalOutcomeMismatch(expectedGlobalOutcome, nextProgress);
        if (mismatch) {
          return {
            advanced: false,
            rejected: true,
            rejectionReason: `worker_protocol_snapshot_mismatch:${mismatch}`,
            alreadyCompleted: false,
            completed: false,
            shouldSetReflection: false,
            shouldScheduleCompletion: false,
            wasGlobalAwaitingStart,
            progress: resolveProgress({ now: inputNow }),
          };
        }
      }
      states = {
        ...states,
        globalSentinelSimulationState: nextState,
      };
      const completed = states.globalSentinelSimulationState?.completed === true;
      return {
        advanced: true,
        rejected: false,
        alreadyCompleted: false,
        completed,
        shouldSetReflection: false,
        shouldScheduleCompletion: completed,
        wasGlobalAwaitingStart,
        progress: resolveProgress({ now: inputNow }),
      };
    }

    if (states.siteFurinState?.completed) {
      return {
        advanced: false,
        alreadyCompleted: true,
        completed: true,
        shouldSetReflection: false,
        shouldScheduleCompletion: true,
        wasGlobalAwaitingStart: false,
        progress: resolveProgress({ now: inputNow }),
      };
    }
    return {
      advanced: false,
      rejected: true,
      rejectionReason: 'site_furin_visible_frame_required',
      alreadyCompleted: false,
      completed: false,
      shouldSetReflection: false,
      shouldScheduleCompletion: false,
      wasGlobalAwaitingStart: false,
      progress: resolveProgress({ now: inputNow }),
    };
  }

  function advanceSiteFurinFrame(options) {
    if (isGlobalProtocolActive()) throw new Error('site_furin_scope_required');
    const current = states.siteFurinState;
    const next = siteFurinProtocolAdapter.advanceFrame(current, options);
    states = { ...states, siteFurinState: next };
    return { advanced: next !== current, completed: next.completed, progress: resolveProgress() };
  }

  function markActiveCompletedReady({
    now: readyNow = Date.now(),
  } = {}) {
    const current = getActiveState();
    setActiveState({
      ...current,
      completed: true,
      readyAtMs: readyNow,
    });
    return resolveProgress({ now: readyNow });
  }

  function resolveCompletionDelayMs({
    now: progressNow = Date.now(),
  } = {}) {
    const state = getActiveState();
    if (!state?.completed) return null;
    return Math.max(0, Math.round((Number(state.readyAtMs) || 0) - progressNow));
  }

  function isActiveCompleted() {
    return getActiveState()?.completed === true;
  }

  return {
    setContext,
    setSiteFurinAction(action) {
      if (isGlobalProtocolActive()) throw new Error('site_furin_scope_required');
      states = { ...states, siteFurinState:setSiteFurinAction(states.siteFurinState,action) };
      return resolveProgress();
    },
    beginSiteFurinExit(choice, options) {
      if (isGlobalProtocolActive()) throw new Error('site_furin_scope_required');
      states = { ...states, siteFurinState:beginSiteFurinExit(states.siteFurinState,choice,options) };
      return resolveProgress();
    },
    resetSiteFurinExit() {
      if (isGlobalProtocolActive()) throw new Error('site_furin_scope_required');
      states = { ...states, siteFurinState:resetSiteFurinExit(states.siteFurinState) };
      return resolveProgress();
    },
    reset,
    getStateSnapshot,
    isGlobalProtocolActive,
    resolveActiveProtocolAdapter,
    resolveActiveProtocolSystem,
    resolveProgress,
    buildWorkerProtocolProgress,
    isGlobalAwaitingStart,
    advanceSiteFurinFrame,
    checkGlobalFailure,
    advanceAcceptedInput,
    markActiveCompletedReady,
    resolveCompletionDelayMs,
    isActiveCompleted,
  };
}
