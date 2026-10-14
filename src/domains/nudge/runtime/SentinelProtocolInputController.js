import { NUDGE_WORKER_MESSAGE } from './NudgeProtocol.js';
import {
  GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
} from '../nudge/nudgeGameGlobalSentinelProtocol.js';
import { NUDGE_SCENE_PHASES } from '../nudge/nudgeGameScene.js';
import { reportSentinelRuntimeRecoveryFailure } from '../nudge/nudgeGameControl.js';

const GLOBAL_SENTINEL_INTERACTION_TIMEOUT_MS = 3000;

function normalizeInteractionSerial(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function isPrimaryPointerActivation(event = null) {
  if (!event || event.type !== 'pointerdown') return false;
  if (event.isPrimary === false) return false;
  const button = Number(event.button);
  return !Number.isFinite(button) || button === 0;
}

export function createSentinelProtocolInputController({
  protocolSession,
  getRoot = () => null,
  getScene = () => null,
  getScenePhase = () => NUDGE_SCENE_PHASES.RITUAL,
  isModalOpen = () => false,
  isTerminalSequenceActive = () => false,
  isGlobalProtocolActive = () => false,
  isGlobalSentinelAwaitingStart = () => false,
  canAcceptProtocolInput = () => false,
  commitProtocolInput = () => null,
  normalizeViewportPoint = (point) => point,
  requestGlobalStarterFullscreen = () => {},
  prepareGlobalStarterViewport = async () => {},
  pulseGlobalStarterFeedback = () => false,
  publishWorkerProtocolProgress = () => null,
  updateRitualPresentation = () => {},
  isWorkerRuntimeActive = () => false,
  isProtocolInputRuntimeReady = () => true,
  postWorkerMessage = () => false,
  handleMainRuntimePointer = () => ({ hit: false }),
  handleMainRuntimeEligibleGlobalTarget = () => ({ hit: false }),
  handleProtocolInputFailure = () => {},
  stopProtocolSoundscape = () => {},
  setLastRuntimeError = () => {},
  scheduleTimeout = (callback, delayMs) => setTimeout(callback, delayMs),
  clearScheduledTimeout = (timeoutId) => clearTimeout(timeoutId),
  now = Date.now,
} = {}) {
  let globalInteractionSerial = 0;
  let pendingGlobalInteraction = null;

  function clearPendingGlobalInteraction() {
    if (pendingGlobalInteraction?.timeoutId != null) {
      clearScheduledTimeout(pendingGlobalInteraction.timeoutId);
    }
    const pending = pendingGlobalInteraction;
    pendingGlobalInteraction = null;
    return pending;
  }

  function failGlobalProtocolInput(reason = 'global_protocol_input_failed') {
    clearPendingGlobalInteraction();
    const error = String(reason || 'global_protocol_input_failed');
    setLastRuntimeError(error);
    reportSentinelRuntimeRecoveryFailure('global_protocol_input', error);
    handleProtocolInputFailure(error);
    return false;
  }

  function beginGlobalWorkerInteraction({
    inputPoint = null,
    inputSource = 'pointer',
  } = {}) {
    if (pendingGlobalInteraction) return null;
    globalInteractionSerial = (globalInteractionSerial % Number.MAX_SAFE_INTEGER) + 1;
    const interactionSerial = globalInteractionSerial;
    const awaitingStart = isGlobalSentinelAwaitingStart();
    const timeoutId = scheduleTimeout(() => {
      if (pendingGlobalInteraction?.interactionSerial !== interactionSerial) return;
      failGlobalProtocolInput(`global_interaction_timeout:${interactionSerial}`);
    }, GLOBAL_SENTINEL_INTERACTION_TIMEOUT_MS);
    pendingGlobalInteraction = {
      interactionSerial,
      inputPoint,
      inputSource,
      awaitingStart,
      stage: awaitingStart ? 'prepare' : 'commit',
      timeoutId,
    };
    return pendingGlobalInteraction;
  }

  function dispatchGlobalWorkerInteraction({
    inputPoint = null,
    inputSource = 'pointer',
  } = {}) {
    const pending = beginGlobalWorkerInteraction({ inputPoint, inputSource });
    if (!pending) return false;
    publishWorkerProtocolProgress();
    const starterPhase = pending.awaitingStart ? 'prepare' : '';
    const sent = inputSource === 'semantic'
      ? postWorkerMessage(NUDGE_WORKER_MESSAGE.ACTIVATE_ELIGIBLE_GLOBAL_TARGET, {
        commit: starterPhase !== 'prepare',
        starterPhase,
        interactionSerial: pending.interactionSerial,
      })
      : postWorkerMessage(NUDGE_WORKER_MESSAGE.POINTER_DOWN, {
        x: Number(inputPoint?.x),
        y: Number(inputPoint?.y),
        commit: starterPhase !== 'prepare',
        starterPhase,
        interactionSerial: pending.interactionSerial,
      });
    if (sent !== false) return true;
    return failGlobalProtocolInput(
      `global_interaction_dispatch_failed:${pending.interactionSerial}`,
    );
  }

  function prepareAcceptedGlobalStarter(message, pending) {
    const xRatio = Number(message.xRatio);
    const yRatio = Number(message.yRatio);
    if (message.xRatio == null || message.yRatio == null
      || message.wasGlobalAwaitingStart !== true || !Number.isFinite(xRatio)
      || !Number.isFinite(yRatio) || xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1
      || !(Number(message.targetId) > 0)) {
      return failGlobalProtocolInput('global_starter_preparation_invalid');
    }
    pending.stage = 'viewport';
    const point = { xRatio, yRatio };
    Promise.resolve().then(() => prepareGlobalStarterViewport(point)).then(() => {
      if (pendingGlobalInteraction !== pending) return;
      if (isModalOpen() || isTerminalSequenceActive() || !isGlobalSentinelAwaitingStart()) {
        failGlobalProtocolInput('global_starter_preparation_cancelled');
        return;
      }
      pending.inputPoint = normalizeViewportPoint(point);
      pending.stage = 'commit';
      const command = {
        x: pending.inputPoint.x,
        y: pending.inputPoint.y,
        commit: true,
        starterPhase: 'commit',
        interactionSerial: pending.interactionSerial,
      };
      if (isWorkerRuntimeActive()) {
        if (postWorkerMessage(NUDGE_WORKER_MESSAGE.POINTER_DOWN, command) === false) {
          failGlobalProtocolInput('global_starter_commit_dispatch_failed');
        }
      } else {
        const result = handleMainRuntimePointer(command);
        clearPendingGlobalInteraction();
        if (!commitAcceptedGlobalEngineResult(result)) failGlobalProtocolInput('global_starter_commit_failed');
      }
    }).catch((error) => {
      if (pendingGlobalInteraction === pending) failGlobalProtocolInput(String(error.message || error));
    });
    return true;
  }

  function prepareMainGlobalStarter({ inputPoint = null, inputSource = 'pointer' } = {}) {
    const pending = beginGlobalWorkerInteraction({ inputPoint, inputSource });
    if (!pending) return false;
    const command = { ...inputPoint, commit: false, starterPhase: 'prepare' };
    const result = inputSource === 'semantic'
      ? handleMainRuntimeEligibleGlobalTarget(command)
      : handleMainRuntimePointer(command);
    if (result.hit !== true) {
      clearPendingGlobalInteraction();
      if (inputPoint) pulseGlobalStarterFeedback({ point: inputPoint, eventType: 'starter_miss' });
      return false;
    }
    return prepareAcceptedGlobalStarter(result, pending);
  }

  function validateGlobalWorkerHitEnvelope(message, pending) {
    if (message?.protocolSystem !== GLOBAL_SENTINEL_PROTOCOL_SYSTEM) return 'protocol_system';
    if (!message?.protocolSnapshot || typeof message.protocolSnapshot !== 'object') {
      return 'protocol_snapshot_missing';
    }
    const acceptedAtMs = Number(message.acceptedAtMs);
    if (!Number.isFinite(acceptedAtMs) || acceptedAtMs <= 0) return 'accepted_at';
    const hitEfficiency = Number(message.hitEfficiency);
    if (!Number.isFinite(hitEfficiency) || hitEfficiency <= 0 || hitEfficiency > 1) {
      return 'hit_efficiency';
    }
    if ((message.wasGlobalAwaitingStart === true) !== pending.awaitingStart) {
      return 'awaiting_start';
    }
    const x = Number(message.x);
    const y = Number(message.y);
    if (
      message?.x === null
      || message?.x === undefined
      || message?.y === null
      || message?.y === undefined
      || !Number.isFinite(x)
      || !Number.isFinite(y)
    ) {
      return 'accepted_point';
    }
    const xRatio = Number(message.xRatio);
    const yRatio = Number(message.yRatio);
    if (
      message?.xRatio === null
      || message?.xRatio === undefined
      || message?.yRatio === null
      || message?.yRatio === undefined
      || !Number.isFinite(xRatio)
      || xRatio < 0
      || xRatio > 1
      || !Number.isFinite(yRatio)
      || yRatio < 0
      || yRatio > 1
    ) {
      return 'accepted_point_ratio';
    }
    if (pending.inputSource === 'pointer') {
      const requestedX = Number(pending.inputPoint?.x);
      const requestedY = Number(pending.inputPoint?.y);
      if (
        !Number.isFinite(requestedX)
        || !Number.isFinite(requestedY)
        || Math.abs(requestedX - x) > 0.5
        || Math.abs(requestedY - y) > 0.5
      ) {
        return 'accepted_point_mismatch';
      }
    }
    return '';
  }

  function handleWorkerHitResult(message) {

    if (!isGlobalProtocolActive()) return;
    const interactionSerial = normalizeInteractionSerial(message?.interactionSerial);
    const pending = pendingGlobalInteraction;
    if (!pending || pending.interactionSerial !== interactionSerial) {
      failGlobalProtocolInput(`global_interaction_serial_mismatch:${interactionSerial}`);
      return;
    }
    if (message?.hit !== true) {
      if (
        pending.inputSource === 'semantic'
        && pending.awaitingStart !== true
        && message?.rejectReason === 'global_semantic_rhythm_closed'
      ) {
        clearPendingGlobalInteraction();
        updateRitualPresentation();
        return;
      }
      if (typeof message?.rejectReason === 'string' && message.rejectReason) {
        failGlobalProtocolInput(`global_interaction_rejected:${message.rejectReason}`);
        return;
      }
      clearPendingGlobalInteraction();
      if (pending.awaitingStart && pending.inputPoint) {
        pulseGlobalStarterFeedback({
          eventType: 'starter_miss',
          point: pending.inputPoint,
        });
      }
      return;
    }
    if (pending.stage === 'prepare') {
      if (message.starterPhase !== 'prepare' || message.protocolSystem !== GLOBAL_SENTINEL_PROTOCOL_SYSTEM) {
        failGlobalProtocolInput('global_starter_preparation_envelope_mismatch');
        return;
      }
      prepareAcceptedGlobalStarter(message, pending);
      return;
    }
    if (pending.stage !== 'commit') {
      failGlobalProtocolInput('global_starter_commit_before_viewport_ready');
      return;
    }
    const envelopeMismatch = validateGlobalWorkerHitEnvelope(message, pending);
    if (envelopeMismatch) {
      failGlobalProtocolInput(`worker_protocol_snapshot_mismatch:${envelopeMismatch}`);
      return;
    }
    if (isModalOpen()) {
      failGlobalProtocolInput('global_interaction_authority_closed');
      return;
    }
    if (isTerminalSequenceActive()) {
      clearPendingGlobalInteraction();
      return;
    }
    clearPendingGlobalInteraction();
    const inputPoint = normalizeViewportPoint({
      x: Number(message.x),
      y: Number(message.y),
      xRatio: Number(message.xRatio),
      yRatio: Number(message.yRatio),
    });
    const commitResult = commitProtocolInput({
      inputPoint,
      acceptedAtMs: Number(message.acceptedAtMs),
      hitEfficiency: Number(message.hitEfficiency),
      expectedGlobalOutcome: message.protocolSnapshot,
      interactionSerial,
    });
    if (!commitResult || commitResult.rejected === true) {
      failGlobalProtocolInput(
        commitResult?.rejectionReason || 'global_protocol_commit_rejected',
      );
      return;
    }
    if (commitResult.terminalStarted === true) return;
    if (commitResult.advanced !== true && commitResult.alreadyCompleted !== true) {
      failGlobalProtocolInput('global_protocol_commit_not_advanced');
      return;
    }
  }

  function commitAcceptedGlobalEngineResult(result = null) {
    if (result?.hit !== true) return false;
    const x = Number(result.x);
    const y = Number(result.y);
    const xRatio = Number(result.xRatio);
    const yRatio = Number(result.yRatio);
    const acceptedAtMs = Number(result.acceptedAtMs);
    const hitEfficiency = Number(result.hitEfficiency);
    if (
      result?.x === null
      || result?.x === undefined
      || result?.y === null
      || result?.y === undefined
      || result?.xRatio === null
      || result?.xRatio === undefined
      || result?.yRatio === null
      || result?.yRatio === undefined
      || !Number.isFinite(x)
      || !Number.isFinite(y)
      || !Number.isFinite(xRatio)
      || xRatio < 0
      || xRatio > 1
      || !Number.isFinite(yRatio)
      || yRatio < 0
      || yRatio > 1
      || !Number.isFinite(acceptedAtMs)
      || acceptedAtMs <= 0
      || !Number.isFinite(hitEfficiency)
      || hitEfficiency <= 0
      || hitEfficiency > 1
      || !result.protocolOutcome
    ) {
      return failGlobalProtocolInput('main_protocol_outcome_invalid');
    }
    const commitResult = commitProtocolInput({
      inputPoint: normalizeViewportPoint({ x, y, xRatio, yRatio }),
      acceptedAtMs,
      hitEfficiency,
      expectedGlobalOutcome: result.protocolOutcome,
      interactionSerial: 0,
    });
    if (!commitResult || commitResult.rejected === true) {
      return failGlobalProtocolInput(
        commitResult?.rejectionReason || 'main_protocol_commit_rejected',
      );
    }
    if (commitResult.terminalStarted === true) return true;
    if (commitResult.advanced !== true && commitResult.alreadyCompleted !== true) {
      return failGlobalProtocolInput('main_protocol_commit_not_advanced');
    }
    return true;
  }

  function handleGlobalSemanticAction() {
    if (
      !isGlobalProtocolActive()
      || isModalOpen()
      || isTerminalSequenceActive()
      || getScenePhase() === NUDGE_SCENE_PHASES.RIFT
      || !isProtocolInputRuntimeReady()
      || !canAcceptProtocolInput()
      || pendingGlobalInteraction
    ) {
      return false;
    }
    const awaitingStarter = isGlobalSentinelAwaitingStart();
    if (isWorkerRuntimeActive()) {
      const dispatched = dispatchGlobalWorkerInteraction({ inputSource: 'semantic' });
      // Reserve against the visible starter bounds before the browser can
      // enqueue its fullscreen resize. Both operations stay in this gesture.
      if (dispatched && awaitingStarter) requestGlobalStarterFullscreen();
      return dispatched;
    }
    if (awaitingStarter) {
      const prepared = prepareMainGlobalStarter({ inputSource: 'semantic' });
      if (prepared) requestGlobalStarterFullscreen();
      return prepared;
    }
    return commitAcceptedGlobalEngineResult(
      handleMainRuntimeEligibleGlobalTarget({ commit: true }),
    );
  }

  function handleCanvasPointer(event) {
    if (isModalOpen() || isTerminalSequenceActive() || getScenePhase() === NUDGE_SCENE_PHASES.RIFT) {
      return;
    }
    const x = event.clientX;
    const y = event.clientY;
    const inputPoint = { x, y };
    if (!isGlobalProtocolActive()) return;
    if (event.type && event.type !== 'pointerdown') return;
    if (isGlobalProtocolActive()) {
      if (!isPrimaryPointerActivation(event)) return;
      if (!isProtocolInputRuntimeReady()) return;
      if (!canAcceptProtocolInput()) return;
      event?.preventDefault?.();
      if (pendingGlobalInteraction) return;
      const awaitingGlobalStarter = isGlobalSentinelAwaitingStart();
      if (isWorkerRuntimeActive()) {
        const dispatched = dispatchGlobalWorkerInteraction({ inputPoint, inputSource: 'pointer' });
        if (dispatched && awaitingGlobalStarter) requestGlobalStarterFullscreen();
        return;
      }
      if (awaitingGlobalStarter) {
        const prepared = prepareMainGlobalStarter({ inputPoint, inputSource: 'pointer' });
        if (prepared) requestGlobalStarterFullscreen();
        return;
      }
      const result = handleMainRuntimePointer({ x, y, commit: true });
      if (result?.hit === true) {
        commitAcceptedGlobalEngineResult(result);
      } else if (awaitingGlobalStarter) {
        pulseGlobalStarterFeedback({
          eventType: 'starter_miss',
          point: inputPoint,
        });
      }
      return;
    }
  }

  function reset() {
    clearPendingGlobalInteraction();
  }

  return {
    handleCanvasPointer,
    handleWorkerHitResult,
    handleGlobalSemanticAction,
    hasPendingGlobalInteraction: () => pendingGlobalInteraction !== null,
    reset,
  };
}
