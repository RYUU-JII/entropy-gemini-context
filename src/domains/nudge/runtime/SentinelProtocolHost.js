import { observeDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import { createSentinelProtocolFullscreenController } from './SentinelProtocolFullscreenController.js';
import interventionAdmissionClient from './interventionAdmissionClient.js';
import { requireGoalEpisodeBinding, areGoalEpisodeBindingsEqual } from './goalEpisodeBinding.js';
import { createInterventionActivationTrace, recordInterventionLifecycleEvent } from './interventionLifecycleDiagnostics.js';
import { ENTROPY_RUNTIME_BUILD_INFO } from '../../../platform/build/runtimeBuildInfo.js';
import {
  toggleClass,
} from '../visual/index.js';
import NudgeOverlayHost from './NudgeOverlayHost.js';
import { createSiteFurinReflectionView } from '../nudge/SiteFurinReflectionView.js';
import {
  createNudgeRuntimeState,
  NUDGE_RUNTIME_EVENT,
  transitionNudgeRuntime,
} from './NudgeRuntimeMachine.js';
import { NUDGE_WORKER_MESSAGE } from './NudgeProtocol.js';
import {
  SENTINEL_PROTOCOL_TIMER_KEYS,
  createSentinelProtocolTimerController,
} from './SentinelProtocolTimerController.js';
import {
  SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS,
  createSentinelProtocolWorkerBridge,
} from './SentinelProtocolWorkerBridge.js';
import {
  createSentinelProtocolSessionController,
} from './SentinelProtocolSessionController.js';
import {
  createSentinelProtocolTerminalController,
} from './SentinelProtocolTerminalController.js';
import {
  createSentinelProtocolFrameLoop,
} from './SentinelProtocolFrameLoop.js';
import { createRenderHealthSample } from '../../../platform/rendering/renderHealthSample.js';
import {
  shouldHandleGlobalSentinelEntryFeedbackEvent,
} from './GlobalSentinelEntryController.js';
import {
  buildSentinelMainSpawnDiagnostics,
  buildSentinelProtocolStateDiagnostics,
} from './SentinelProtocolDiagnosticsBuilder.js';
import { projectSentinelStartFailureDiagnostics } from '../../protection/debug/SentinelProtocolTimeline.js';
import {
  buildSentinelProtocolHostStopModel,
  hasSentinelProtocolConfigChanged,
  resolveSentinelProtocolStartAdmission,
} from './SentinelProtocolHostSessionModel.js';
import {
  RITUAL_SURFACE_TYPES,
  claimRitualSurface,
} from './ritualSurfaceArbiter.js';
import { createGlobalSentinelSurfaceInputPolicy } from './nudgeGlobalSentinelInputGate.js';
import { createSiteFurinSurfaceInputPolicy } from './nudgeSiteFurinInputGate.js';
import {
  resolveNudgeTheme,
} from '../nudge/index.js';
import { DEFAULT_THEME_ID, canonicalizeThemeIdInput } from '../../../themes/core/ids.js';
import { getRuntimeLanguage, setRuntimeLanguage, tRuntime } from '../../settings/i18n/runtime.js';
import { resolveRuntimeThemeIdSync } from '../../../themes/core/friction/runtime.js';
import {
  assertNudgeRuntimeThemeId,
  normalizeNudgeRuntimeContext,
} from './nudgeRuntimeContext.js';
import {
  normalizeNudgeRuntimeConfig,
} from '../../settings/config/nudgeConfig.js';
import {
  createDefaultSentinelNudgeConfig,
  mergeSentinelNudgeProtocolCopy,
} from '../nudge/nudgeGameCopyConfig.js';
import {
  setSentinelModalText,
} from '../nudge/nudgeGameHud.js';
import {
  buildSentinelWorkerRuntimeConfig,
  ensureSentinelCanvasContext,
  ensureSentinelMainRuntimeCanvasContext,
  resizeSentinelCanvas,
} from '../nudge/nudgeGameRuntime.js';
import {
  createGlobalSentinelAudioController,
  exitSentinelFurinSiteSoundscape,
  playSentinelFurinPreludeChime,
  playSentinelFurinSurfaceOut,
} from '../nudge/nudgeGameAudio.js';
import {
  SENTINEL_MEDIA_RESTORE_MODES,
} from '../nudge/nudgeGameMediaSuppression.js';
import { createSiteFurinPageIsolation } from './SiteFurinPageIsolation.js';
import { createGlobalSentinelPageIsolation } from './GlobalSentinelPageIsolation.js';
import {
  resolveSentinelProtocolSyncLevel,
} from '../nudge/nudgeGameLoop.js';
import {
  NUDGE_ENGINE_INPUT_MODES,
  resolveNudgeEngineControl,
} from '../nudge/nudgeGameEngineControl.js';
import {
  NUDGE_ESCAPE_SEQUENCE_MS,
  NUDGE_SCENE_PHASES,
  assertNudgeScenePhase,
  resolveNudgeScenePresentation,
} from '../nudge/nudgeGameScene.js';
import {
  isGlobalNudgeProtocolScene,
  resolveNudgeProtocolScene,
} from '../protocols/nudgeProtocolScene.js';
import {
  buildSentinelDebugRuntimeSnapshot,
  buildSentinelRuntimeResetState,
  buildSentinelStartMetadata,
  isSentinelGameActive,
  resolveSentinelRoom478HandoffRunId,
  navigateSentinelRoom478,
  navigateSentinelAway,
  closeSiteFurinTab,
  reportSentinelRuntimeRecoveryFailure,
} from '../nudge/nudgeGameControl.js';
import {
  SENTINEL_OUTCOME_REASONS,
} from './sentinelOutcomeContract.js';
import { createNudgeSwarmEngine } from '../engine/NudgeSwarmEngine.js';
import {
  resolveGlobalSimulationBreakCrackSkeleton,
  resolveGlobalSentinelRiftAperturePlan,
} from '../rendering/NudgeProtocolSceneBackground.js';
import { createSentinelProtocolGlobalEntryRuntime } from './SentinelProtocolGlobalEntryRuntime.js';
import { createSentinelProtocolInputController } from './SentinelProtocolInputController.js';
import { createSentinelProtocolLifecycleController } from './SentinelProtocolLifecycleController.js';
import { createSentinelProtocolPresentationController } from './SentinelProtocolPresentationController.js';
import { createSentinelProtocolDebugController } from './SentinelProtocolDebugController.js';
import { applyGlobalRiftTargetDom } from './SentinelProtocolPresentationAdapter.js';

const SENTINEL_PROTOCOL_HOST_SURFACE_OWNER_ID = 'sentinel_protocol_host';
const SENTINEL_WORKER_FIRST_FRAME_TIMEOUT_MS = 4000;

const SentinelProtocolHost = (() => {
  const FALLBACK_THEME_ID = assertNudgeRuntimeThemeId(DEFAULT_THEME_ID, 'sentinel nudge default theme');
  let runtimeContext = null;
  let activeThemeId = FALLBACK_THEME_ID;
  let activeTheme = resolveNudgeTheme(FALLBACK_THEME_ID);

  function createDefaultConfig(copyContext = null) {
    return createDefaultSentinelNudgeConfig({
      copyContext,
      activeThemeId,
      fallbackThemeId: FALLBACK_THEME_ID,
      runtimeContext,
    });
  }

  let config = createDefaultConfig({
    themeId: FALLBACK_THEME_ID,
    language: getRuntimeLanguage(),
    variantId: FALLBACK_THEME_ID,
  });
  let activeProtocolScene = resolveNudgeProtocolScene(config);
  let mode = 'auto';
  let activeNudgeKey = null;
  let activeNudgeRunId = null;
  let lifecycleTrace = null;
  let cancelPendingPaint = null;
  let root = null;
  let shadow = null;
  let canvas = null;
  let ctx = null;
  let siteFurinAction = null;
  let globalSentinelAction = null;
  let globalSentinelStatus = null;
  let ritualGuide = null;
  let ritualTitle = null;
  let ritualBody = null;
  let ritualHint = null;
  let modalOpen = false;
  let workerPresentationReady = false;
  let startedAtMs = 0;

  let scene = null;
  let scrim = null;
  let hud = null;
  let hudTitle = null;
  let hudStatus = null;
  let hudHint = null;
  let hudMeter = null;
  let hudMeterLabel = null;
  let hudTelemetry = null;
  let riftInviteButton = null;
  let protocolStartAt = 0;
  let bounds = { width: 0, height: 0 };
  runtimeContext = normalizeNudgeRuntimeContext(null, {
    themeId: FALLBACK_THEME_ID,
    language: getRuntimeLanguage(),
    variantId: FALLBACK_THEME_ID,
  });
  let resizeHandler = null;
  let stopDprObservation = null;
  let resizeRafId = null;
  let visibilityHandler = null;
  const renderOptions = {
    renderBudget: null,
    protocolScope: 'site',
    protocolVariant: 'site_furin',
    scenePhase: NUDGE_SCENE_PHASES.RITUAL,
    protocolIntensity: 0.62,
    terminalSequence: null,
  };
  let overlayHost = null;
  let runtimeState = createNudgeRuntimeState();
  let lastRuntimeError = '';
  let runtimeStage = 'idle';
  let canvasRuntimeOwner = 'layout';
  let effectiveCanvasPixelRatio = 1;
  let pendingRenderBudgetResize = false;
  const protocolSession = createSentinelProtocolSessionController({
    config,
    protocolScene: activeProtocolScene,
    now: 0,
  });
  const timers = createSentinelProtocolTimerController();
  const globalAudio = createGlobalSentinelAudioController();
  let ritualSurfaceClaim = null;
  let admissionLease = null;
  let cleanupFailure = null;
  let startEpoch = 0;
  let starting = false;
  let pendingStart = null;
  let siteFurinVisual = null;
  let siteFurinReflectionView = null;
  let siteFurinIsolation = null;
  let globalSentinelIsolation = null;
  let siteFurinChoicePending = false;
  let scenePhase = NUDGE_SCENE_PHASES.RITUAL;
  let scenePhaseStartedAtMs = 0;
  let escapeSequenceResolve = null;
  let escapeSequenceToken = 0;
  const lifecycleController = createSentinelProtocolLifecycleController({
    isGlobalProtocolActive,
    onPresentedUnconfirmed: handlePresentedLifecycleUnconfirmed,
  });
  let presentationController = null;
  let globalEntryRuntime = null;
  let inputController = null;
  let debugController = null;
  const terminalController = createSentinelProtocolTerminalController({
    timerController: timers,
    onTerminalSequenceChange: applyTerminalSequenceState,
    onClearRitualReveal: clearRitualRevealTimer,
    onClearRitualWatch: clearRitualWatchTimer,
    onSetScenePhase: setScenePhase,
    onUpdatePresentation: updateRitualPresentation,
    onSetRiftAutoMs: (durationMs) => {
      if (root) {
        root.style.setProperty('--nudge-rift-auto-ms', `${durationMs}ms`);
      }
    },
    onFocusRiftInvite: () => {
      riftInviteButton?.focus?.({ preventScroll: true });
    },
    onRestoreMedia: restoreProtocolPageMedia,
    onMarkResolved: markNudgeResolved,
    onResolutionFailed: handleTerminalResolutionFailure,
    onStopHost: stop,
    onNavigateAway: navigateSentinelAway,
    onNavigateRoom: navigateSentinelRoom478,
    onRoomNavigationFailed: handleRoom478NavigationFailure,
    onTerminalStageFailed: handleTerminalStageFailure,
    getRecoveryDashboardUrl: () => config?.recovery?.dashboardUrl || '',
    getRunId: () => resolveSentinelRoom478HandoffRunId({ mode, activeNudgeRunId, admissionLease }),
    getAdmissionLease: () => admissionLease,
    getRiftHandoff,
  });

  // The context-agnostic swarm engine owns the koi sim + canvas render for the
  // main-thread path. The host (this module) keeps the overlay DOM, ritual,
  // modal, lifecycle, theme/config/runtime context, and the worker bridge.
  const swarm = createNudgeSwarmEngine();

  function syncRuntimeMachineState(nextState) {
    if (!nextState || typeof nextState !== 'object') return;
    runtimeStage = typeof nextState.stage === 'string' && nextState.stage.trim()
      ? nextState.stage.trim()
      : 'unknown';
    lastRuntimeError = typeof nextState.lastError === 'string'
      ? nextState.lastError
      : '';
  }

  function syncSelectedWorkerRuntimeState(nextState) {
    runtimeState = nextState;
    syncRuntimeMachineState(nextState);
  }

  function applyLocalRuntimeEvent(type, payload = {}) {
    const prevState = runtimeState;
    const nextState = transitionNudgeRuntime(prevState, {
      type,
      payload,
    });
    runtimeState = nextState;
    if (nextState !== prevState) {
      syncRuntimeMachineState(nextState);
    }
    return nextState;
  }

  function handleSelectedWorkerRuntimeFailure(runtimeLabel, error) {
    if (!error) return;
    const errorText = String(error?.message || error);
    console.error(`[sentinel flare] ${runtimeLabel} runtime failure`, errorText);
    reportSentinelRuntimeRecoveryFailure(`${runtimeLabel}_runtime`, errorText);
    if (!workerPresentationReady || !root) return;
    const failedRoot = root;
    Promise.resolve().then(() => {
      if (!workerPresentationReady || root !== failedRoot) return;
      if (!lifecycleController.hasFinalAction()) {
        markNudgeAborted(`${runtimeLabel}_runtime_error`);
      }
      stop();
    });
  }

  const workerBridge = createSentinelProtocolWorkerBridge({
    preparedRuntimeOptions: {
      onHitResult: handleWorkerHitResult,
      onError: (error) => handleSelectedWorkerRuntimeFailure('worker', error),
      onStateChange: (nextState) => {
        syncSelectedWorkerRuntimeState(nextState, 'worker');
      },
    },
    extensionFrameRuntimeOptions: {
      onHitResult: handleWorkerHitResult,
      onError: (error) => handleSelectedWorkerRuntimeFailure('extension_frame_worker', error),
      onStateChange: (nextState) => {
        syncSelectedWorkerRuntimeState(nextState, 'extension_frame_worker');
      },
    },
    getMainRuntimeSnapshot,
  });

  presentationController = createSentinelProtocolPresentationController({
    buildStamp: ENTROPY_RUNTIME_BUILD_INFO.buildId,
    getRefs: getHostRefs,
    getConfig: () => config,
    getRuntimeContext: () => runtimeContext,
    getActiveThemeId: () => activeThemeId,
    getActiveTheme: () => activeTheme,
    getRuntimeStage: () => runtimeStage,
    getHudRuntimeContext: () => ({
      mode,
      fullscreen: Boolean(globalThis.document.fullscreenElement),
      preparingViewport: scene?.classList.contains('is-global-entry-press') === true,
      inputPending: inputController.hasPendingGlobalInteraction(),
      inputReady: isProtocolInputRuntimeReady(),
      entry: globalEntryRuntime.getRevealPresentation(),
      entryPoint: globalEntryRuntime.getEntryPoint(),
      scenePhase,
      riftReady: terminalController.isGlobalRiftInviteOpen(),
    }),
    getLastRuntimeError: () => lastRuntimeError,
    getStartedAtMs: () => startedAtMs,
    getScenePhase: () => scenePhase,
    isModalOpen: () => modalOpen,
    isWorkerRuntimeActive,
    getWorkerRuntimeStatsSnapshot,
    getWorkerRuntimeTelemetrySnapshot,
    getMainRuntimeStats: () => swarm.getStats(),
    resolveActiveProtocolProgress,
    isProtocolInputRuntimeReady,
    createDefaultConfig,
    syncRenderOptions,
    applyRuptureRevealPresentation: (now) => globalEntryRuntime?.applyRuptureRevealPresentation(now),
  });
  globalEntryRuntime = createSentinelProtocolGlobalEntryRuntime({
    timers,
    getBounds: () => bounds,
    getRoot: () => root,
    getScene: () => scene,
    getReducedMotion: () => config.reducedMotion === true,
    isAwaitingStart: isGlobalSentinelAwaitingStart,
    isWorkerRuntimeActive,
    postWorkerMessage,
    pulseMainRuntimeFeedback: (payload) => swarm.pulseGlobalStarterFeedback(payload),
    updateRitualPresentation,
    windowRef: globalThis.window,
  });
  inputController = createSentinelProtocolInputController({
    protocolSession,
    getRoot: () => root,
    getScene: () => scene,
    getScenePhase: () => scenePhase,
    isModalOpen: () => modalOpen,
    isTerminalSequenceActive,
    isGlobalProtocolActive,
    isGlobalSentinelAwaitingStart,
    canAcceptProtocolInput,
    commitProtocolInput: commitSentinelProtocolInput,
    normalizeViewportPoint,
    requestGlobalStarterFullscreen: () => requestRitualFullscreen(),
    prepareGlobalStarterViewport: () => fullscreenController.prepare({ enabled: config.fullscreenRitualEnabled !== false }),
    pulseGlobalStarterFeedback,
    publishWorkerProtocolProgress,
    updateRitualPresentation,
    isWorkerRuntimeActive,
    isProtocolInputRuntimeReady,
    postWorkerMessage,
    handleMainRuntimePointer: (pointer) => swarm.handlePointer(pointer),
    handleMainRuntimeEligibleGlobalTarget: (options) => (
      swarm.handleEligibleGlobalTarget(options)
    ),
    handleProtocolInputFailure: () => stop(),
    stopProtocolSoundscape,
    setLastRuntimeError: (error) => {
      lastRuntimeError = error;
    },
  });
  debugController = createSentinelProtocolDebugController({
    getMainSpawnDiagnostics: buildMainSpawnDiagnostics,
    getMainRuntimeStats: () => swarm.getStats(),
    getCanvasRuntimeOwner: () => canvasRuntimeOwner,
    isWorkerRuntimeActive,
    getActiveWorkerRuntime,
    getWorkerRuntimeResultName,
    getWorkerRuntimeHost: () => workerBridge.getRuntimeHost(),
    showOverlay: () => overlayHost?.show?.(),
    syncOverlayRefs: syncOverlayHostRefs,
    spawnMainRuntime: (spawnHint) => swarm.spawn({ reason: 'spawn', spawnHint }),
    getMainSpawnBlockReason: () => swarm.getSpawnBlockReason('spawn', null),
    buildRuntimeStartFailureOutcome,
    isActive,
    getMode: () => mode,
    start,
    setRuntimeContext,
    setConfig,
    getRuntimeContext: () => runtimeContext,
    getActiveThemeId: () => activeThemeId,
    getConfig: () => config,
    createDefaultConfig,
  });

  function getActiveWorkerRuntime() {
    return workerBridge.getActiveRuntime();
  }

  function getWorkerRuntimeResultName() {
    return workerBridge.getResultName();
  }

  function getMainRuntimeSnapshot() {
    return swarm.getStats();
  }

  function getHostRefs() {
    return {
      root,
      shadow,
      scene,
      scrim,
      canvas,
      siteFurinAction,
      globalSentinelAction,
      globalSentinelStatus,
      ritualGuide,
      ritualTitle,
      ritualBody,
      ritualHint,
      hud,
      hudTitle,
      hudStatus,
      hudHint,
      hudMeter,
      hudMeterLabel,
      hudTelemetry,
      riftInviteButton,
    };
  }

  function syncActiveProtocolScene() {
    activeProtocolScene = resolveNudgeProtocolScene(config);
    protocolSession.setContext({
      config,
      protocolScene: activeProtocolScene,
    });
    return activeProtocolScene;
  }

  function isGlobalProtocolActive() {
    return isGlobalNudgeProtocolScene(activeProtocolScene);
  }

  function releaseSentinelProtocolSurfaceClaim(reason = 'release') {
    ritualSurfaceClaim?.release?.({ reason });
    ritualSurfaceClaim = null;
  }

  function claimSentinelProtocolSurface(replaceClaim = null) {
    releaseSentinelProtocolSurfaceClaim('replace');
    const globalProtocol = isGlobalProtocolActive();
    const surfaceType = globalProtocol
      ? RITUAL_SURFACE_TYPES.GLOBAL_SENTINEL
      : RITUAL_SURFACE_TYPES.SITE_FURIN;
    const onBlockedInput = ({ eventType, key, point }) => {
      if (!globalProtocol) {
        if (eventType === 'keydown' && key === 'Tab') {
          root?.focus({ preventScroll: true });
        }
        return;
      }
      if (!isGlobalSentinelAwaitingStart()) return;
      if (!shouldHandleGlobalSentinelEntryFeedbackEvent(eventType || '')) return;
      pulseGlobalStarterFeedback({ eventType: eventType || 'blocked_input', point });
    };
    const inputPolicy = globalProtocol
      ? createGlobalSentinelSurfaceInputPolicy({
        rootRef: () => root,
        isAwaitingStart: isGlobalSentinelAwaitingStart,
        onBlockedInput,
      })
      : createSiteFurinSurfaceInputPolicy({
        rootRef: () => root,
        onBlockedInput,
      });
    const result = claimRitualSurface({
      type: surfaceType,
      ownerId: SENTINEL_PROTOCOL_HOST_SURFACE_OWNER_ID,
      replaceClaim,
      admissionLease,
      scope: config?.protocolScope || '',
      metadata: {
        protocolScope: config?.protocolScope || '',
        protocolVariant: config?.protocolVariant || '',
      },
      inputPolicy,
      onSuppress: () => stop(),
    });
    if (result.accepted) {
      ritualSurfaceClaim = result.claim;
    }
    return result;
  }

  function normalizeViewportPoint(point = null) {
    return globalEntryRuntime.normalizePoint(point);
  }

	  function isGlobalSentinelAwaitingStart(now = Date.now()) {
	    return protocolSession.isGlobalAwaitingStart({
	      now,
	      modalOpen,
	      terminalActive: isTerminalSequenceActive(),
	    });
	  }

  function pulseGlobalStarterFeedback({
    point = null,
    eventType = 'blocked_input',
  } = {}) {
    return globalEntryRuntime.pulseFeedback({ point, eventType });
  }

  function startGlobalRuptureReveal(point = null, now = Date.now()) {
    globalEntryRuntime.startRuptureReveal(point, now);
  }

	  function resolveActiveProtocolSystem() {
	    return protocolSession.resolveActiveProtocolSystem();
	  }

	  function resolveActiveProtocolProgress(options = {}) {
	    return protocolSession.resolveProgress(options);
	  }

	  function buildWorkerProtocolProgress(now = Date.now()) {
	    return protocolSession.buildWorkerProtocolProgress({ now });
	  }

  function resolveHostEngineControl(now = Date.now()) {
    return resolveNudgeEngineControl({
	      scenePhase,
	      protocolScene: activeProtocolScene,
	      protocolProgress: buildWorkerProtocolProgress(now),
	      modalOpen,
	      terminalSequence: terminalController.getTerminalSequenceState(),
	    });
	  }

  function canAcceptProtocolInput(now = Date.now()) {
    const control = resolveHostEngineControl(now);
    if (!isGlobalProtocolActive() && control.inputMode === NUDGE_ENGINE_INPUT_MODES.STARTER) {
      return false;
    }
    return control.inputMode !== NUDGE_ENGINE_INPUT_MODES.NONE;
  }

  function buildProtocolStateDiagnostics() {
    const progress = resolveActiveProtocolProgress({ now: Date.now() });
    return { ...buildSentinelProtocolStateDiagnostics({
      progress,
      protocolSystem: resolveActiveProtocolSystem(),
      isGlobalProtocolActive: isGlobalProtocolActive(),
      globalEntryRevealProgress: globalEntryRuntime.getRevealProgress(),
    }), fullscreen: fullscreenController.getSnapshot() };
  }

  function syncRenderOptions(scenePresentation = null) {
    const presentation = scenePresentation || resolveNudgeScenePresentation({
      config,
      phase: scenePhase,
    });
    renderOptions.renderBudget = swarm.getRenderBudget();
	    renderOptions.protocolScope = presentation.renderOptions.protocolScope;
	    renderOptions.protocolVariant = presentation.renderOptions.protocolVariant;
	    renderOptions.scenePhase = presentation.renderOptions.scenePhase;
	    renderOptions.protocolIntensity = presentation.renderOptions.protocolIntensity;
	    renderOptions.terminalSequence = terminalController.getTerminalSequenceState();
	    return presentation;
	  }

  function setScenePhase(nextPhase, { startedAtMs = Date.now() } = {}) {
    const normalized = assertNudgeScenePhase(nextPhase, 'nudge_scene_phase_transition');
    if (!Number.isFinite(startedAtMs) || startedAtMs < 0) {
      throw new Error('nudge_scene_phase_started_at_invalid');
    }
    if (scenePhase !== normalized) scenePhaseStartedAtMs = startedAtMs;
    const phasePayload = { phase: normalized, startedAtMs: scenePhaseStartedAtMs };
    const riftOpen = normalized === NUDGE_SCENE_PHASES.RIFT;
    if (riftOpen) {
      applyGlobalRiftTargetDom({
        root,
        point: globalEntryRuntime.getEntryPoint(),
      });
    }
    if (riftOpen) syncRiftInviteGeometry();
    overlayHost?.setRiftInviteOpen?.(riftOpen && terminalController.isGlobalRiftInviteOpen());
    swarm.setScenePhase(normalized, { startedAtMs: scenePhaseStartedAtMs });
    if (scenePhase === normalized) {
      syncRenderOptions();
      postWorkerMessage(NUDGE_WORKER_MESSAGE.SET_SCENE_PHASE, phasePayload);
      return;
    }
    scenePhase = normalized;
    if (!root) {
      syncRenderOptions();
      postWorkerMessage(NUDGE_WORKER_MESSAGE.SET_SCENE_PHASE, phasePayload);
      return;
    }
    applyProtocolPresentation();
    postWorkerMessage(NUDGE_WORKER_MESSAGE.SET_SCENE_PHASE, phasePayload);
  }

	  function clearEscapeSequenceTimer() {
	    timers.clearTimeout(SENTINEL_PROTOCOL_TIMER_KEYS.ESCAPE_SEQUENCE);
	    const resolve = escapeSequenceResolve;
	    escapeSequenceResolve = null;
	    resolve?.();
	  }

	  function ensureWorkerRuntime() {
	    return workerBridge.ensureRuntime();
	  }

	  function destroyWorkerRuntime() {
	    workerBridge.destroy();
	  }

	  function isWorkerRuntimeActive() {
	    return workerBridge.isActive();
	  }

	  function hasReadyWorkerSession() {
	    return workerBridge.hasReadySession();
	  }

    function isProtocolInputRuntimeReady() {
      if (canvasRuntimeOwner === 'host_dom') return workerPresentationReady;
      if (canvasRuntimeOwner === 'main') return true;
      return workerPresentationReady && hasReadyWorkerSession();
    }

	  function getWorkerRuntimeStatsSnapshot() {
	    return workerBridge.getStatsSnapshot();
	  }

  function getRiftHandoff() {
    const stats = isWorkerRuntimeActive()
      ? getWorkerRuntimeStatsSnapshot()
      : swarm.getStats();
    const entryPoint = globalEntryRuntime?.getEntryPoint?.();
    if (
      !Number.isFinite(entryPoint?.xRatio) || entryPoint.xRatio < 0 || entryPoint.xRatio > 1
      || !Number.isFinite(entryPoint?.yRatio) || entryPoint.yRatio < 0 || entryPoint.yRatio > 1
    ) {
      throw new Error('sentinel_room_478_entry_point_missing');
    }
    if (!Number.isSafeInteger(stats?.simulationBreakSeed) || stats.simulationBreakSeed < 0) {
      throw new Error('sentinel_room_478_seed_missing');
    }
    return {
      seed: stats.simulationBreakSeed,
      originX: Number(entryPoint.xRatio),
      originY: Number(entryPoint.yRatio),
    };
  }

  function syncRiftInviteGeometry() {
    if (!overlayHost || bounds.width <= 0 || bounds.height <= 0) return;
    const handoff = getRiftHandoff();
    const skeleton = resolveGlobalSimulationBreakCrackSkeleton({
      seed: handoff.seed,
      impactPoint: { x: handoff.originX, y: handoff.originY },
    });
    const aperture = resolveGlobalSentinelRiftAperturePlan({
      progress: 1, seed: handoff.seed, skeleton,
      width: bounds.width, height: bounds.height,
    });
    overlayHost.setRiftInviteGeometry({
      contour: aperture.contour, width: bounds.width, height: bounds.height,
    });
  }

	  function getWorkerRuntimeTelemetrySnapshot() {
	    return workerBridge.getTelemetrySnapshot();
	  }

	  function getWorkerRuntimeStateOwner() {
	    return workerBridge.getPreparedRuntimeStateOwner();
	  }

	  function dispatchRuntimeEvent(type, payload = {}, { ensure = false } = {}) {
	    if (getWorkerRuntimeStateOwner()) {
	      return workerBridge.dispatchPreparedRuntimeEvent(type, payload, { ensure });
	    }
	    return applyLocalRuntimeEvent(type, payload);
	  }

  function clearPublishedTelemetry() {
    presentationController.clearPublishedTelemetry();
  }

  function syncOverlayHostRefs() {
    overlayHost?.syncRefs?.();
    const refs = overlayHost?.getRefs?.();
    if (!refs) return false;
    root = refs.root || overlayHost?.root || null;
    shadow = refs.shadow || overlayHost?.shadow || null;
    scene = refs.scene || null;
    scrim = refs.scrim || null;
    canvas = refs.canvas || null;
    siteFurinAction = refs.siteFurinAction || null;
    globalSentinelAction = refs.globalSentinelAction || null;
    globalSentinelStatus = refs.globalSentinelStatus || null;
    ritualGuide = refs.ritualGuide || null;
    ritualTitle = refs.ritualTitle || null;
    ritualBody = refs.ritualBody || null;
    ritualHint = refs.ritualHint || null;
    hud = refs.hud || null;
    hudTitle = refs.hudTitle || null;
    hudStatus = refs.hudStatus || null;
    hudHint = refs.hudHint || null;
    hudMeter = refs.hudMeter || null;
    hudMeterLabel = refs.hudMeterLabel || null;
    hudTelemetry = refs.hudTelemetry || null;
    riftInviteButton = refs.riftInviteButton || null;
    return !!(root && shadow && canvas);
  }

  function ensureOverlayHost() {
    if (!overlayHost) {
      overlayHost = new NudgeOverlayHost({
        onContinue: () => ackAndStop(),
        onLeave: () => navigateAway(),
        onRiftEnter: () => enterGlobalRift(),
        onGlobalSentinelAction: () => {
          inputController.handleGlobalSemanticAction();
        },
        onCanvasPointerDown: handleCanvasPointer,
        onCanvasPointerMove: handleCanvasPointer,
        onCanvasPointerHover: (event) => globalEntryRuntime.pulseHoverFeedback({
          x: event.clientX,
          y: event.clientY,
        }),
        onCanvasPointerUp: handleCanvasPointer,
        onCanvasPointerCancel: handleCanvasPointer,
        getPrimaryChoiceAction: () => (isGlobalProtocolActive() ? 'continue' : 'leave'),
      });
    }
    overlayHost.ensure();
    syncOverlayHostRefs();
    if (scenePhase === NUDGE_SCENE_PHASES.RIFT) {
      applyGlobalRiftTargetDom({
        root,
        point: globalEntryRuntime.getEntryPoint(),
      });
    }
    overlayHost.setRiftInviteOpen(scenePhase === NUDGE_SCENE_PHASES.RIFT
      && terminalController.isGlobalRiftInviteOpen());
    overlayHost.setRiftInviteAriaLabel(
      tRuntime('tools:sentinel_flare_protocol.rift_invite_aria_label')
    );
    overlayHost.setModalAriaLabel(
      tRuntime(
        'tools:sentinel_flare_protocol.modal_aria_label',
        { context: activeThemeId }
      )
    );
    return overlayHost;
  }

  function ensureCanvasContext(dpr = window.devicePixelRatio || 1) {
    ctx = ensureSentinelCanvasContext({
      canvas,
      ctx,
      dpr,
    });
    return ctx;
  }

	  function supportsWorkerRuntime() {
	    return workerBridge.supportsRuntime({ canvas });
	  }

  function buildWorkerRuntimeConfig() {
    return buildSentinelWorkerRuntimeConfig(config);
  }

  function publishWorkerProtocolProgress(now = Date.now()) {
    const protocolProgress = buildWorkerProtocolProgress(now);
    if (!isGlobalProtocolActive()) return protocolProgress;
    if (isWorkerRuntimeActive() || hasReadyWorkerSession()) {
      postWorkerMessage(NUDGE_WORKER_MESSAGE.SET_PROTOCOL_PROGRESS, { protocolProgress });
    } else {
      swarm.setProtocolProgress(protocolProgress);
    }
    return protocolProgress;
  }

  function stopWorkerRuntime() {
    dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.WORKER_DEACTIVATE, {}, { ensure: false });
  }

	  function postWorkerMessage(type, payload = null) {
	    return workerBridge.post(type, payload);
	  }

  function ensureMainRuntimeCanvasContext() {
    const nextState = ensureSentinelMainRuntimeCanvasContext({
      canvas,
      shadow,
      scene,
      onCanvasPointerDown: handleCanvasPointer,
      onCanvasPointerMove: handleCanvasPointer,
      onCanvasPointerUp: handleCanvasPointer,
      onCanvasPointerCancel: handleCanvasPointer,
      overlayHost,
      syncOverlayHostRefs,
      commitCanvas: (nextCanvas) => {
        canvas = nextCanvas;
      },
      resizeCanvas,
      ensureCanvasContext,
    });
    canvas = nextState.canvas;
    ctx = nextState.ctx;
    return ctx;
  }

  function mergeConfig(partial) {
    const defaults = createDefaultConfig(runtimeContext);
    return normalizeNudgeRuntimeConfig(partial, { defaults });
  }

  function stripConfigRuntimeMeta(input) {
    if (!input || typeof input !== 'object') return {};
    const {
      __mode: _mode,
      __nudgeKey: _nudgeKey,
      __nudgeRunId: _nudgeRunId,
      __runtimeContext: _runtimeContext,
      __runtimeHost: _runtimeHost,
      __entryHandoff: _entryHandoff,
      __candidateObservedAt: _candidateObservedAt,
      __goalBinding: _goalBinding,
      ...rest
    } = input;
    return rest;
  }

  function ensureRoot({ runtimeOwner = 'layout' } = {}) {
    ensureOverlayHost();
    syncOverlayHostRefs();
    if (runtimeOwner !== 'main') {
      ctx = null;
    }
    if (!resizeHandler) {
      resizeHandler = scheduleCanvasResize;
      window.addEventListener('resize', resizeHandler);
      stopDprObservation = observeDevicePixelRatio({ onChange: resizeHandler });
    }
    if (!visibilityHandler) {
      visibilityHandler = () => syncRuntimeVisibility();
      document.addEventListener('visibilitychange', visibilityHandler);
    }
    resizeCanvas({ runtimeOwner });
  }

  function scheduleCanvasResize() {
    if (resizeRafId !== null) return;
    resizeRafId = window.requestAnimationFrame(() => {
      resizeRafId = null;
      if (!root) return;
      resizeCanvas({ runtimeOwner: canvasRuntimeOwner });
    });
  }

  function isRuntimeDocumentVisible() {
    return document.visibilityState !== 'hidden'
      && document.visibilityState !== 'prerender';
  }

  function isSiteFurinReflectionIdle() {
    return !isGlobalProtocolActive()
      && !resolveActiveProtocolProgress().needsFrame
      && siteFurinVisual?.isSettled() === true;
  }

  function syncRuntimeVisibility() {
    const visible = isRuntimeDocumentVisible();
    if (!visible && starting && pendingStart?.mode === 'auto' && !workerPresentationReady) {
      // A prepared automatic entry that was never painted cannot resume on
      // return. Its boundary owner may already have cancelled the exact goal.
      stop();
      return false;
    }
    if (!visible) siteFurinReflectionView?.cancel();
    if (workerPresentationReady && (isWorkerRuntimeActive() || hasReadyWorkerSession())) {
      postWorkerMessage(NUDGE_WORKER_MESSAGE.SET_VISIBILITY, { visible });
    }
    if (!visible || isSiteFurinReflectionIdle()) {
      stopLoop();
    } else if (root && workerPresentationReady && !frameLoop.isRunning()) {
      startLoop();
    }
    return visible;
  }

  function setModalOpen(isOpen, { preserveScenePhase = false } = {}) {
    modalOpen = isOpen;
    swarm.setModalOpen(isOpen);
    const terminalPhase = scenePhase === NUDGE_SCENE_PHASES.ESCAPE
      || scenePhase === NUDGE_SCENE_PHASES.BANISH
      || scenePhase === NUDGE_SCENE_PHASES.RESYNCING
      || scenePhase === NUDGE_SCENE_PHASES.COLLAPSE
      || scenePhase === NUDGE_SCENE_PHASES.RESYNC
      || scenePhase === NUDGE_SCENE_PHASES.RIFT;
    if (!preserveScenePhase && !terminalPhase) {
      setScenePhase(isOpen ? NUDGE_SCENE_PHASES.REFLECTION : NUDGE_SCENE_PHASES.RITUAL);
    }
    updateRitualPresentation();
    if (isWorkerRuntimeActive()) {
      postWorkerMessage(NUDGE_WORKER_MESSAGE.SET_MODAL_OPEN, { open: !!isOpen });
    }
    const backdrop = shadow?.getElementById('nudgeModalBackdrop');
    if (backdrop) toggleClass(backdrop, 'is-open', !!isOpen);
    if (isOpen) {
      const isZen = activeThemeId === 'zen' || !isGlobalProtocolActive();
      const focusTarget = isZen
        ? shadow?.getElementById('nudgeChoiceDrift')
        : shadow?.getElementById('nudgeContinueBtn');
      focusTarget?.focus?.();
    }
    syncRuntimeVisibility();
  }

  function setModalText(title, body, messageOverride = null) {
    const defaults = createDefaultConfig(runtimeContext);
    setSentinelModalText({
      shadowRoot: shadow,
      title,
      body,
      message: messageOverride || config?.message,
      defaults,
    });
  }

	  function clearRitualRevealTimer() {
	    timers.clearTimeout(SENTINEL_PROTOCOL_TIMER_KEYS.RITUAL_REVEAL);
	  }

	  function clearRitualWatchTimer() {
	    timers.clearInterval(SENTINEL_PROTOCOL_TIMER_KEYS.RITUAL_WATCH);
	  }

  function isTerminalSequenceActive() {
    return terminalController.isTerminalSequenceActive();
  }

	  function applyTerminalSequenceState(sequence = null, {
	    clearEntities = false,
	    notifyWorker = true,
	  } = {}) {
	    renderOptions.terminalSequence = sequence || null;
	    swarm.setTerminalSequence(sequence || null, { clearEntities });
	    syncRenderOptions();
	    if (notifyWorker) {
	      const payload = sequence
	        ? { sequence }
	        : { sequence: null, clearEntities };
	      postWorkerMessage(NUDGE_WORKER_MESSAGE.SET_TERMINAL_SEQUENCE, payload);
	    }
	  }

  function clearTerminalSequence(options = {}) {
    terminalController.clearTerminalSequence(options);
  }

  async function enterGlobalRift() {
    return terminalController.enterGlobalRift();
  }

  function startGlobalTerminalSequence(outcome) {
    const sequence = terminalController.startGlobalTerminalSequence(outcome, {
      blocked: modalOpen,
      now: Date.now(),
    });
    if (sequence) globalAudio.finish(outcome, { themeId: activeThemeId, intensity: 0.72 });
    return sequence;
  }

  function resolveSiteFurinCompletionMessage() {
    return presentationController.resolveSiteFurinCompletionMessage();
  }

  function updateRitualPresentation() {
    presentationController.updateRitualPresentation();
    if (scenePhase === NUDGE_SCENE_PHASES.RIFT) {
      overlayHost?.setRiftInviteOpen?.(terminalController.isGlobalRiftInviteOpen());
    }
    if (isGlobalProtocolActive()) {
      globalAudio.sync(resolveActiveProtocolProgress(), config, { themeId: activeThemeId, intensity: 0.5 });
    }
  }

  function resetRitualState(now = Date.now()) {
    clearRitualRevealTimer();
    clearTerminalSequence({ clearEntities: false, notifyWorker: false });
    terminalController.reset();
    globalEntryRuntime.reset();
    globalAudio.reset();
    inputController.reset();
    protocolSession.reset({
      now,
      config,
      protocolScene: activeProtocolScene,
    });
    presentationController.resetRitual();
    lifecycleController.resetEpisodeAbsorbed();
    updateRitualPresentation();
    startRitualWatchTimer();
  }

  function showRitualCompletionModal() {
    if (!isGlobalProtocolActive() || modalOpen) return;
    clearRitualRevealTimer();
    protocolSession.markActiveCompletedReady({ now: Date.now() });
    updateRitualPresentation();
    startGlobalTerminalSequence('success');
  }

  function scheduleRitualCompletion() {
    clearRitualRevealTimer();
    const delayMs = protocolSession.resolveCompletionDelayMs({ now: Date.now() });
    if (delayMs === null) return;
    if (delayMs <= 0) {
      showRitualCompletionModal();
      return;
    }
    timers.scheduleTimeout(SENTINEL_PROTOCOL_TIMER_KEYS.RITUAL_REVEAL, () => {
      showRitualCompletionModal();
    }, delayMs);
  }

  function checkRitualFailure({
    now: failureNow = Date.now(),
  } = {}) {
    const result = protocolSession.checkGlobalFailure({
      now: failureNow,
      blocked: modalOpen || inputController?.hasPendingGlobalInteraction?.() === true,
    });
    if (!result.failed) return false;
    updateRitualPresentation();
    startGlobalTerminalSequence('failure');
    return true;
  }

  function startRitualWatchTimer() {
    clearRitualWatchTimer();
    if (!isGlobalProtocolActive()) return;
    timers.scheduleInterval(SENTINEL_PROTOCOL_TIMER_KEYS.RITUAL_WATCH, () => {
      if (isGlobalProtocolActive()) {
        checkRitualFailure();
      } else if (protocolSession.isActiveCompleted()) {
        scheduleRitualCompletion();
      }
      publishWorkerProtocolProgress();
      updateRitualPresentation();
    }, 250);
  }

  function commitSentinelProtocolInput({
    inputPoint = null,
    acceptedAtMs = null,
    hitEfficiency = null,
    expectedGlobalOutcome = null,
  } = {}) {
    if (isTerminalSequenceActive()) return null;
    const now = Date.now();
	    if (isGlobalProtocolActive()) {
      const acceptedAt = Number(acceptedAtMs);
      const inputNow = Number.isFinite(acceptedAt) && acceptedAt > 0 ? acceptedAt : now;
	      if (checkRitualFailure({ now: inputNow })) {
        return {
          advanced: false,
          rejected: false,
          terminalStarted: true,
          progress: resolveActiveProtocolProgress({ now }),
        };
      }
      const result = protocolSession.advanceAcceptedInput({
        now: inputNow,
        hitEfficiency,
        expectedGlobalOutcome,
      });
	      if (result.rejected) return result;
      if (!result.alreadyCompleted) globalAudio.accepted({
        started: result.wasGlobalAwaitingStart,
        themeId: activeThemeId,
        intensity: 0.72,
      });
	      if (result.alreadyCompleted) {
	        scheduleRitualCompletion();
	        return result;
	      }
	      if (result.wasGlobalAwaitingStart) {
        globalSentinelIsolation = createGlobalSentinelPageIsolation({ documentRef: document, root });
        globalSentinelIsolation.acquire();
	        startGlobalRuptureReveal(inputPoint, inputNow);
	      }
	      publishWorkerProtocolProgress(inputNow);
	      updateRitualPresentation();
	      if (result.shouldScheduleCompletion) {
	        scheduleRitualCompletion();
	      }
	      return result;
	    }

    throw new Error('site_furin_visible_frame_required');
	  }

  function applyHudPresentation() {
    presentationController.applyHudPresentation();
  }

  function applyProtocolPresentation() {
    presentationController.applyProtocolPresentation();
  }

  function applyThemeVars(theme) {
    presentationController.applyThemeVars(theme);
  }

  function setHudText(protocol) {
    presentationController.setHudText(protocol);
  }

  function resolveHudTelemetrySnapshot() {
    return presentationController.resolveHudTelemetrySnapshot();
  }

  function formatHudTelemetryText(syncPercent, protocolProgress = null) {
    return presentationController.formatHudTelemetryText(syncPercent, protocolProgress);
  }

  function updateHud(syncLevel) {
    presentationController.updateHud(syncLevel);
  }

  function handleWorkerHitResult(message) {
    inputController?.handleWorkerHitResult(message);
  }

  const fullscreenController = createSentinelProtocolFullscreenController({
    documentRef: globalThis.document,
    windowRef: globalThis.window,
    resizeCanvas: () => resizeCanvas(),
    setPreparing: (active) => scene?.classList.toggle('is-global-entry-press', active),
    reportFailure: (phase, error) => reportSentinelRuntimeRecoveryFailure(phase, error),
  });

  function requestRitualFullscreen() {
    if (config.fullscreenRitualEnabled === false) return;
    fullscreenController.request({ retry: true }).catch((error) => reportSentinelRuntimeRecoveryFailure('fullscreen_request', error));
  }

  function exitRitualFullscreen() {
    fullscreenController.exit();
  }

  function handleCanvasPointer(event) {
    if (!isGlobalProtocolActive()) return;
    inputController.handleCanvasPointer(event);
  }

  function applyTheme(themeId) {
    const nextId = assertNudgeRuntimeThemeId(themeId, 'sentinel nudge applyTheme');
    activeThemeId = nextId;
    activeTheme = resolveNudgeTheme(nextId);
    applyThemeVars(activeTheme);
    if (isWorkerRuntimeActive()) {
      postWorkerMessage(NUDGE_WORKER_MESSAGE.SET_THEME, { themeId: activeThemeId });
    }
  }

  function resolveContextThemeId(nextConfig) {
    const rawDebugOverride = mode === 'debug'
      ? (nextConfig?.visualThemeId || nextConfig?.themeId || config?.visualThemeId)
      : null;
    const rawDebugOverrideThemeId = typeof rawDebugOverride === 'string'
      ? rawDebugOverride.trim()
      : '';
    if (rawDebugOverrideThemeId) {
      const normalizedDebugOverride = canonicalizeThemeIdInput(rawDebugOverrideThemeId, '');
      if (normalizedDebugOverride) return normalizedDebugOverride;
      return assertNudgeRuntimeThemeId(
        rawDebugOverrideThemeId,
        'sentinel nudge debug theme override',
      );
    }

    if (runtimeContext?.themeId) {
      return assertNudgeRuntimeThemeId(
        runtimeContext.themeId,
        'sentinel nudge runtime context theme',
      );
    }

    return assertNudgeRuntimeThemeId(
      resolveRuntimeThemeIdSync(FALLBACK_THEME_ID),
      'sentinel nudge stored theme preference',
    );
  }

  function applyRuntimeContext(nextContext = null, nextConfig = null) {
    runtimeContext = normalizeNudgeRuntimeContext(nextContext, {
      themeId: resolveRuntimeThemeIdSync(FALLBACK_THEME_ID),
      language: getRuntimeLanguage(),
      variantId: runtimeContext?.variantId || FALLBACK_THEME_ID,
    });
    const resolvedLanguage = setRuntimeLanguage(runtimeContext.language);
    const themeId = resolveContextThemeId(nextConfig);
    runtimeContext = normalizeNudgeRuntimeContext({
      ...runtimeContext,
      themeId,
      language: resolvedLanguage,
      variantId: runtimeContext.variantId || themeId,
    }, runtimeContext);
    applyTheme(themeId);
  }

  function applyProtocolCopyForTheme(themeId) {
    const copyThemeId = assertNudgeRuntimeThemeId(
      themeId,
      'sentinel nudge protocol copy theme',
    );
    config = mergeSentinelNudgeProtocolCopy(config, {
      themeId: copyThemeId,
      activeThemeId,
      fallbackThemeId: FALLBACK_THEME_ID,
      runtimeContext,
    });
  }

  function setRuntimeContext(nextContext = null, nextConfig = null) {
    applyRuntimeContext(nextContext, nextConfig);
    applyProtocolCopyForTheme(activeThemeId);
    if (!root) return;
    setHudText(config.protocol);
    setModalText(config.message.title, config.message.body);
    presentationController.setLastHudUpdateAt(0);
    const syncLevel = resolveSentinelProtocolSyncLevel({
      config,
      protocolStartAt,
    });
    updateHud(syncLevel);
  }

  function buildMainSpawnDiagnostics() {
    if (!isGlobalProtocolActive()) {
      const progress = resolveActiveProtocolProgress();
      return { runtime: 'host_dom', workerRuntimeHost: 'host_dom', workerRuntimeActive: false,
        runtimeStage, protocolScope: 'site', protocolVariant: 'site_furin', protocolSystem: progress.protocolSystem,
        protocolSceneId: activeProtocolScene.sceneId, protocolRenderer: 'furin_svg', scenePhase,
        siteFurinPhase: progress.phase, siteFurinDeliveryForm: progress.deliveryForm,
        siteFurinExitChoice:progress.exitChoice,
        siteFurinExitElapsedMs:progress.exitElapsedMs,
        siteFurinExitProgress:progress.exitProgress,
        siteFurinExitComplete:progress.exitComplete,
        siteFurinReflection:siteFurinReflectionView?.snapshot(),
        siteFurinVisibleElapsedMs: progress.visibleElapsedMs, siteFurinDurationMs: progress.durationMs,
        siteFurinReady: progress.ready, siteFurinCompleted: progress.completed,
        liveCount: 0, renderedCount: siteFurinVisual ? 1 : 0,
        totalSpawned: 0, rootConnected: root?.isConnected === true,
        canvasRuntimeOwner: 'host_dom', visible: isRuntimeDocumentVisible(),
        ...siteFurinVisual?.snapshot(), mediaHold: lifecycleController.getSiteMediaSnapshot(),
        scrollLocked: siteFurinIsolation !== null };
    }
    const workerRuntimeActive = isWorkerRuntimeActive();
    const activeWorkerRuntime = workerRuntimeActive ? getActiveWorkerRuntime() : null;
    const workerDiagnostics = activeWorkerRuntime?.buildDiagnostics?.() || null;
    const stats = workerRuntimeActive ? getWorkerRuntimeStatsSnapshot() : swarm.getStats();
    const protocolDiagnostics = buildProtocolStateDiagnostics();
    return buildSentinelMainSpawnDiagnostics({
      workerDiagnostics,
      stats,
      protocolDiagnostics,
      runtimeStage,
      workerRuntimeHost: workerBridge.getRuntimeHost(),
      activeThemeId,
      workerRuntimeActive,
      workerSessionReady: hasReadyWorkerSession(),
      supportsWorkerRuntime: supportsWorkerRuntime(),
      hasCanvasContext: !!ctx,
      canvasConnected: canvas?.isConnected === true,
      rootConnected: root?.isConnected === true,
      bounds,
      activeProtocolScene,
      config,
      scenePhase,
      globalRiftOpenProgress: swarm._debugGetGlobalSentinelRiftOpenProgress(),
      globalRiftInviteOpen: terminalController.isGlobalRiftInviteOpen(),
      engineLiveLimit: swarm.getLiveEntityLimit(),
    });
  }

  function runFrame({ frameMs, dt }) {
    if (!root) return false;
    if (!isRuntimeDocumentVisible() || isSiteFurinReflectionIdle()) return false;
    if (!isGlobalProtocolActive()) {
      const result = protocolSession.advanceSiteFurinFrame({ frameMs, visible: true, presented: workerPresentationReady });
      const visual = siteFurinVisual.frame({ frameMs, progress: result.progress });
      siteFurinReflectionView.update(result.progress, { presented:workerPresentationReady, pending:siteFurinChoicePending, visual });
      if (visual.chime && result.progress.exitChoice === 'leave') playSentinelFurinPreludeChime({ themeId: activeThemeId, protocolScope: 'site', intensity: 0.45 });
      if (result.progress.continueReady && !siteFurinChoicePending) void resolveSiteFurinChoice('stay');
      if (result.advanced) updateRitualPresentation();
      if (config.hudVisible) updateHud(result.progress.progress);
      return !isSiteFurinReflectionIdle();
    }
    const now = Date.now();
    const syncLevel = resolveSentinelProtocolSyncLevel({ config, protocolStartAt, now });
    updateHud(syncLevel);

    if (!isWorkerRuntimeActive()) {
      if (!ctx) throw new Error('canvas_context_missing');
      if (pendingRenderBudgetResize) {
        pendingRenderBudgetResize = false;
        resizeCanvas({ runtimeOwner: 'main' });
      }
      const workStartedAt = sampleRenderWorkNow();
      swarm.update(dt, now);
      const updateFinishedAt = sampleRenderWorkNow();
      swarm.render(now);
      const renderFinishedAt = sampleRenderWorkNow();
      const health = swarm.observeRenderHealth(createRenderHealthSample({
        surfaceId: 'nudge-main-canvas',
        observedAtMs: renderFinishedAt,
        frameIntervalMs: frameMs > 0 ? frameMs : 16.67,
        updateWorkMs: updateFinishedAt - workStartedAt,
        renderWorkMs: renderFinishedAt - updateFinishedAt,
        droppedFrameRatio: frameMs > 25 && frameMs <= 250 ? 1 : 0,
        visible: document.visibilityState !== 'hidden'
          && document.visibilityState !== 'prerender',
        viewportWidth: bounds.width,
        viewportHeight: bounds.height,
        effectivePixelRatio: effectiveCanvasPixelRatio,
      }));
      if (health.pressureChanged) pendingRenderBudgetResize = true;
    }
  }

  function sampleRenderWorkNow() {
    return typeof performance?.now === 'function' ? performance.now() : Date.now();
  }

  function handleFrameFailure(error) {
    console.error('[sentinel flare] main runtime loop failure', error);
    if (!isGlobalProtocolActive()) {
      reportSentinelRuntimeRecoveryFailure('site_furin_frame', error);
      stop();
      return;
    }
    dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.MAIN_ERROR, {
      error: `main:${String(error?.message || error)}`,
    });
    presentationController.setLastHudUpdateAt(0);
    try {
      const syncLevel = resolveSentinelProtocolSyncLevel({ config, protocolStartAt });
      updateHud(syncLevel);
    } catch (hudError) {
      reportSentinelRuntimeRecoveryFailure('main_hud_refresh', hudError);
    }
  }

  function handlePresentedLifecycleUnconfirmed(sendResult) {
    if (!root) return;
    reportSentinelRuntimeRecoveryFailure(
      'lifecycle_presented',
      sendResult?.error || 'presented_authority_unconfirmed',
    );
    stop();
  }

  function handleTerminalResolutionFailure({ outcome, outcomeReason } = {}) {
    reportSentinelRuntimeRecoveryFailure(
      'lifecycle_terminal',
      `terminal_resolution_unconfirmed:${outcome || 'unknown'}:${outcomeReason || 'unknown'}`,
    );
  }

  function handleRoom478NavigationFailure({ error } = {}) {
    reportSentinelRuntimeRecoveryFailure(
      'navigation_room_478',
      error || 'room_478_navigation_failed',
    );
  }

  function handleTerminalStageFailure({ stage, error, stale } = {}) {
    if (stale !== true) lastRuntimeError = `terminal_${stage}:${String(error?.message || error)}`;
    reportSentinelRuntimeRecoveryFailure(`terminal_${stage}`, error);
  }

  const frameLoop = createSentinelProtocolFrameLoop({
    onFrame: runFrame,
    onError: handleFrameFailure,
  });

  function startLoop() {
    frameLoop.start();
  }

  function stopLoop() {
    frameLoop.stop();
  }

  function bindLifecycleListeners() {
    lifecycleController.bindListeners();
  }

  function unbindLifecycleListeners() {
    lifecycleController.unbindListeners();
  }

  function markNudgePresented() {
    lifecycleController.markPresented();
  }

  function markNudgeEpisodeAbsorbed(reason) {
    lifecycleController.markEpisodeAbsorbed(reason);
  }

  function markNudgeAborted(reason = 'aborted') {
    lifecycleController.markAborted(reason);
  }

  async function markNudgeResolved(reason = 'resolved') {
    return lifecycleController.markResolved(reason);
  }

  function resolveProtocolOutcomeReason(fallbackReason = 'stay') {
    return terminalController.resolveProtocolOutcomeReason(fallbackReason);
  }

  function suppressProtocolPageMedia() {
    lifecycleController.suppressMedia();
  }

  function restoreProtocolPageMedia(mode) {
    lifecycleController.restoreMedia(mode);
  }

  function stopProtocolSoundscape() {
    globalAudio.reset();
    exitSentinelFurinSiteSoundscape();
  }

  async function ackAndStop() {
    if (!isGlobalProtocolActive()) return resolveSiteFurinChoice('stay');
    const epoch = startEpoch;
    exitRitualFullscreen();
    const outcomeReason = resolveProtocolOutcomeReason('stay');
    if (!isGlobalProtocolActive()) {
      playSentinelFurinSurfaceOut({
        themeId: activeThemeId,
        protocolScope: config?.protocolScope,
        intensity: config?.protocolIntensity,
      });
    }
    const resolved = await markNudgeResolved(outcomeReason);
    if (epoch !== startEpoch) return;
    if (!resolved) {
      reportSentinelRuntimeRecoveryFailure('lifecycle_manual_choice', 'sentinel_resolution_unconfirmed');
      stop();
      return;
    }
    // Preserve the selected restore policy only after this run's resolution ACK.
    restoreProtocolPageMedia(outcomeReason === SENTINEL_OUTCOME_REASONS.GLOBAL_RESYNC_FAILURE
      ? SENTINEL_MEDIA_RESTORE_MODES.RESUME
      : SENTINEL_MEDIA_RESTORE_MODES.SURFACE);
    stop();
  }

  async function navigateAway() {
    if (!isGlobalProtocolActive()) return resolveSiteFurinChoice('leave');
    const epoch = startEpoch;
    const endingLease = admissionLease;
    exitRitualFullscreen();
    if (scenePhase === NUDGE_SCENE_PHASES.ESCAPE) return;
    const recoveryDashboardUrl = config?.recovery?.dashboardUrl || '';
    setModalOpen(false, { preserveScenePhase: true });
    setScenePhase(NUDGE_SCENE_PHASES.ESCAPE);
    const escapeToken = escapeSequenceToken + 1;
    escapeSequenceToken = escapeToken;
	    await new Promise((resolve) => {
	      clearEscapeSequenceTimer();
	      escapeSequenceResolve = resolve;
	      timers.scheduleTimeout(SENTINEL_PROTOCOL_TIMER_KEYS.ESCAPE_SEQUENCE, () => {
	        escapeSequenceResolve = null;
	        resolve();
	      }, NUDGE_ESCAPE_SEQUENCE_MS);
    });
    if (escapeSequenceToken !== escapeToken || scenePhase !== NUDGE_SCENE_PHASES.ESCAPE) {
      return;
    }
    restoreProtocolPageMedia(SENTINEL_MEDIA_RESTORE_MODES.RELEASE);
    await markNudgeResolved(resolveProtocolOutcomeReason('leave'));
    if (epoch !== startEpoch) return;
    stop();
    navigateSentinelAway({
      recoveryDashboardUrl,
      admissionLease: endingLease,
    });
  }

  async function resolveSiteFurinChoice(choice, direction = 1) {
    if (!workerPresentationReady || siteFurinChoicePending || !root) return;
    if (choice === 'stay' && !resolveActiveProtocolProgress().continueReady) return;
    siteFurinChoicePending = true;
    overlayHost.setChoicePending(true);
    siteFurinReflectionView.update(resolveActiveProtocolProgress(), { presented:true,pending:true,reducedMotion:config.reducedMotion });
    const epoch = startEpoch, endingLease = admissionLease;
    markNudgeEpisodeAbsorbed('site_furin_choice');
    const resolved = await markNudgeResolved(choice);
    if (epoch !== startEpoch) return;
    if (!resolved) {
      reportSentinelRuntimeRecoveryFailure('lifecycle_site_choice', 'site_furin_resolution_unconfirmed');
      stop();
      return;
    }
    // The host clock starts only after ACK. It pauses together with the physical
    // scene when hidden, and keeps the exact lease through browser removal.
    protocolSession.beginSiteFurinExit(choice, { reducedMotion: config.reducedMotion });
    if (choice === 'leave') siteFurinVisual.blow({ direction });
    const closing = siteFurinReflectionView.close({ choice });
    syncRuntimeVisibility();
    try { await closing; }
    catch (error) {
      if (epoch !== startEpoch) return;
      reportSentinelRuntimeRecoveryFailure('site_furin_exit_animation', error);
      stop();
      return;
    }
    if (epoch !== startEpoch) return;
    if (choice === 'leave') {
      try {
        // Keep the exact visible lease and its control listener alive until the
        // background authorizes removal. stop() must not race this request.
        await interventionAdmissionClient.drain();
        if (epoch !== startEpoch) return;
        await closeSiteFurinTab({ admissionLease: endingLease });
      } catch (error) {
        if (epoch !== startEpoch) return;
        console.error(`[site furin] ${error.message}`);
        siteFurinChoicePending = false;
        protocolSession.resetSiteFurinExit();
        siteFurinVisual.cancelBreeze();
        overlayHost.setChoicePending(false);
        siteFurinReflectionView.showCloseFailure();
        siteFurinReflectionView.update(resolveActiveProtocolProgress(), { presented: true, pending: false, reducedMotion: config.reducedMotion });
        siteFurinVisual.frame({ frameMs: 0, progress: resolveActiveProtocolProgress() });
        syncRuntimeVisibility();
        return;
      }
      if (epoch !== startEpoch) return;
      stop();
      return;
    }
    restoreProtocolPageMedia(choice === 'stay' ? SENTINEL_MEDIA_RESTORE_MODES.SURFACE : SENTINEL_MEDIA_RESTORE_MODES.RELEASE);
    stop();
  }

  function buildRuntimeStartFailureOutcome({
    runtime = 'unknown',
    rejectReason = 'runtime_start_failed',
    error = '',
    startFailureDiagnostics = null,
  } = {}) {
    const stats = swarm.getStats();
    return {
      ok: false,
      phase: 'rejected',
      runtime,
      requestId: 0,
      liveCount: stats.liveCount,
      totalSpawned: stats.totalSpawned,
      totalSplitSpawned: stats.totalSplitSpawned,
      renderedCount: 0,
      rejectReason,
      error: error || rejectReason,
      diagnostics: {
        ...buildMainSpawnDiagnostics(),
        ...startFailureDiagnostics,
      },
    };
  }

  async function start(nextConfig, {
    workerActivationTimeoutMs = SENTINEL_WORKER_FIRST_FRAME_TIMEOUT_MS,
  } = {}) {
    if (cleanupFailure) return { ok: false, rejectReason: 'intervention_cleanup_pending' };
    if (starting) return { ok: false, rejectReason: 'intervention_start_pending' };
    const activeAdmission = resolveSentinelProtocolStartAdmission({ active: isActive(), currentMode: mode, incomingMode: nextConfig?.__mode === 'debug' ? 'debug' : 'auto' });
    if (!activeAdmission.accepted) return { ok: false, rejectReason: activeAdmission.rejectReason, error: activeAdmission.rejectReason };
    if (root) stop();
    const requestEpoch = ++startEpoch;
    const startTrace = createInterventionActivationTrace({ runId: nextConfig?.__nudgeRunId ?? null });
    lifecycleTrace = startTrace;
    recordInterventionLifecycleEvent('activation_preparing', startTrace);
    starting = true;
    let boundaryOwnsAdoptedLease = false;
    try {
      const startMetadata = buildSentinelStartMetadata({
        nextConfig,
        mergeConfig,
        stripConfigRuntimeMeta,
      });
      const admission = resolveSentinelProtocolStartAdmission({
        active: isActive(),
        currentMode: mode,
        incomingMode: startMetadata.mode,
      });
      if (!admission.accepted) {
        return buildRuntimeStartFailureOutcome({
          runtime: getWorkerRuntimeResultName(),
          rejectReason: admission.rejectReason,
          error: admission.rejectReason,
        });
      }
      // The pending run already owns cancellation, even before it owns a
      // visible surface. STOP must be able to address this exact run/mode.
      pendingStart = startMetadata;
      const goalBinding = startMetadata.mode === 'auto' ? requireGoalEpisodeBinding(nextConfig?.__goalBinding) : null;
      const kind = startMetadata.config.protocolScope === 'global' ? 'global_sentinel' : 'site_furin';
      const handoff = nextConfig?.__entryHandoff;
      if (handoff !== undefined && (startMetadata.mode !== 'auto'
        || !handoff || typeof handoff !== 'object'
        || handoff.kind !== kind || typeof handoff.leaseId !== 'string' || !handoff.leaseId
        || !['goal_feed_horizon', 'furin_entry_action'].includes(handoff.source)
        || (handoff.source === 'goal_feed_horizon' && handoff.replaceClaim === undefined)
        || (handoff.source === 'goal_feed_horizon' && typeof handoff.onClaimTransferred !== 'function')
        || (handoff.replaceClaim !== undefined && (!handoff.replaceClaim
          || handoff.replaceClaim.ownerId !== SENTINEL_PROTOCOL_HOST_SURFACE_OWNER_ID
          || !Number.isSafeInteger(handoff.replaceClaim.serial) || handoff.replaceClaim.serial < 1)))) {
        return { ok: false, rejectReason: 'furin_entry_handoff_invalid', error: 'furin_entry_handoff_invalid' };
      }
      // Entry already consumed this exact candidate on native input. Adoption
      // keeps the same lease through Horizon -> Furin without a second request
      // or a shared-recovery gap. Debug/direct starts retain their own prepare.
      const permission = handoff === undefined
        ? await interventionAdmissionClient.prepare({
          kind,
          manual: startMetadata.mode === 'debug',
          observedAt: startMetadata.mode === 'debug' ? Date.now() : nextConfig.__candidateObservedAt,
          lifecycleTrace: startTrace,
          goalBinding,
        })
        : interventionAdmissionClient.adoptPreparedFurin({ kind, manual: false,
          leaseId: handoff.leaseId, source: handoff.source });
      boundaryOwnsAdoptedLease = permission.accepted === true && handoff?.source === 'goal_feed_horizon';
      if (requestEpoch !== startEpoch) {
        recordInterventionLifecycleEvent('activation_cancelled', { ...startTrace, reason: 'intervention_start_superseded' });
        if (permission.accepted && !boundaryOwnsAdoptedLease) interventionAdmissionClient.release(permission.lease);
        return { ok: false, rejectReason: 'intervention_start_superseded' };
      }
      if (!permission.accepted) return { ok: false, rejectReason: permission.reason, error: permission.reason };
      admissionLease = permission.lease;
      if (goalBinding && !areGoalEpisodeBindingsEqual(admissionLease.goalBinding, goalBinding)) throw new Error('INTERVENTION_GOAL_HANDOFF_BINDING_MISMATCH');
      stopWorkerRuntime();
      workerPresentationReady = false;
      workerBridge.setRuntimeHost(nextConfig?.__runtimeHost);
      dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_INIT);
      config = {
        ...startMetadata.config,
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
      };
      syncActiveProtocolScene();
      const surfaceResult = claimSentinelProtocolSurface(handoff?.replaceClaim);
      if (!surfaceResult.accepted) {
        // Until replacement succeeds, the boundary still owns its endpoint and
        // cleanup. Its coordinator ends the shared lease after that cleanup.
        if (!boundaryOwnsAdoptedLease) interventionAdmissionClient.release(admissionLease);
        admissionLease = null;
        const activeSurfaceType = surfaceResult.active?.type || 'unknown';
        const rejectReason = `ritual_surface_blocked:${activeSurfaceType}`;
        dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_FAIL, { error: rejectReason });
        return buildRuntimeStartFailureOutcome({
          runtime: getWorkerRuntimeResultName(),
          rejectReason,
          error: rejectReason,
        });
      }
      if (handoff?.source === 'goal_feed_horizon') {
        // The old serial becomes stale at claim replacement, before any async
        // import/paint. Its owner must drop that handle and confirm physical
        // endpoint cleanup synchronously before Host takes lease ownership.
        const transfer = handoff.onClaimTransferred({ leaseId: admissionLease.leaseId,
          previousClaim: handoff.replaceClaim, claim: ritualSurfaceClaim });
        if (transfer && typeof transfer.then === 'function') {
          throw new Error('FURIN_ENTRY_SYNCHRONOUS_CLAIM_TRANSFER_REQUIRED');
        }
        if (transfer !== true) throw new Error('FURIN_ENTRY_CLAIM_TRANSFER_UNCONFIRMED');
      }
      // A successful transfer confirms physical endpoint cleanup, as well as
      // dropping its old claim. Only now may Host cleanup end the shared lease.
      boundaryOwnsAdoptedLease = false;
      if (requestEpoch !== startEpoch) return { ok: false, rejectReason: 'intervention_start_superseded' };
      mode = startMetadata.mode;
      activeNudgeKey = startMetadata.activeNudgeKey;
      activeNudgeRunId = startMetadata.activeNudgeRunId;
      startedAtMs = startMetadata.startedAtMs;
      lifecycleController.configure({
        mode,
        activeNudgeKey,
        activeNudgeRunId,
        admissionLeaseId: admissionLease.leaseId,
        goalBinding,
        startedAtMs,
        lifecycleFinalAction: startMetadata.lifecycleFinalAction,
        lifecyclePresentedSent: startMetadata.lifecyclePresentedSent,
        lifecycleEpisodeAbsorbedSent: false,
      });

      dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_ROOT);
      ensureRoot();
      bindLifecycleListeners();

      dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_THEME);
      applyRuntimeContext(nextConfig?.__runtimeContext, nextConfig);
      applyProtocolCopyForTheme(activeThemeId);
      applyThemeVars(activeTheme);

      dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_STATE);
      const resetState = buildSentinelRuntimeResetState();
      clearEscapeSequenceTimer();
      terminalController.reset();
      scenePhase = NUDGE_SCENE_PHASES.RITUAL;
      scenePhaseStartedAtMs = startedAtMs;
      resetRitualState(startedAtMs);

      dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_HUD);
      setModalOpen(false);
      setModalText(config.message.title, config.message.body);
      setHudText(config.protocol);
      protocolStartAt = startedAtMs;
      presentationController.setLastHudUpdateAt(resetState.lastHudUpdateAt);
      overlayHost.prepareForPresentation();

      dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_RUNTIME);
      if (!isGlobalProtocolActive()) {
        const activationRoot = root;
        suppressProtocolPageMedia();
        const { createZenFurinPresentation } = await import('../../../themes/plugins/zen/api/furin.js');
        if (requestEpoch !== startEpoch || root !== activationRoot) return { ok: false, rejectReason: 'site_furin_activation_superseded' };
        if (mode === 'auto') {
          await interventionAdmissionClient.authorizeGoal(admissionLease);
          if (requestEpoch !== startEpoch || root !== activationRoot) return { ok: false, rejectReason: 'site_furin_activation_superseded' };
        }
        const stage = overlayHost.prepareSiteFurinChime({
          label: tRuntime('tools:sentinel_flare_protocol.site_furin_chime_label'),
        });
        siteFurinVisual = createZenFurinPresentation({ container: stage, reducedMotion: config.reducedMotion });
        if (mode !== 'debug' && !Object.hasOwn(config,'siteFurinReflection')) throw new Error('SITE_FURIN_REFLECTION_REQUIRED');
        siteFurinReflectionView = createSiteFurinReflectionView({ root,stage,
          data:Object.hasOwn(config,'siteFurinReflection') ? config.siteFurinReflection : null,
          onAction:action=>{
            if (!root || !workerPresentationReady || siteFurinChoicePending) return;
            const progress = protocolSession.setSiteFurinAction(action);
            siteFurinReflectionView.update(progress, { presented:workerPresentationReady,
              pending:siteFurinChoicePending, reducedMotion:config.reducedMotion });
            if (progress.continueReady) void resolveSiteFurinChoice('stay');
            if (isRuntimeDocumentVisible() && !frameLoop.isRunning()) startLoop();
          },onLeave:direction=>void resolveSiteFurinChoice('leave', direction),
          onWind:wind=>{
            if (!siteFurinVisual || (siteFurinChoicePending && wind !== 0)) return;
            siteFurinVisual.setWind(wind);
            if (wind !== 0) syncRuntimeVisibility();
          } });
        siteFurinIsolation = createSiteFurinPageIsolation({ documentRef: document, root });
        window.addEventListener('blur',cancelSiteFurinInput);
        siteFurinVisual.frame({ frameMs: 0, progress: resolveActiveProtocolProgress() });
        overlayHost?.show?.();
        // A visible painted document, not module resolution, is presentation.
        await waitForSiteFurinPaint(activationRoot, requestEpoch, workerActivationTimeoutMs);
        if (requestEpoch !== startEpoch || root !== activationRoot) return { ok: false, rejectReason: 'site_furin_activation_superseded' };
        dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_LOOP);
        workerPresentationReady = true;
        interventionAdmissionClient.present(admissionLease);
        markNudgePresented();
        siteFurinReflectionView.update(resolveActiveProtocolProgress(), { presented: true });
        syncRuntimeVisibility();
        return { ok: true, phase: 'active', runtime: 'host_dom' };
      }
      const workerEligible = supportsWorkerRuntime();
      const workerStartOutcome = workerEligible ? startWorkerRuntime() : null;
      const workerStarted = workerStartOutcome?.ok === true;
      if (workerEligible && !workerStarted) {
        const rejectReason = workerStartOutcome?.rejectReason || 'worker_activation_failed';
        const error = workerStartOutcome?.error || lastRuntimeError || rejectReason;
        dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_FAIL, { error });
        const outcome = buildRuntimeStartFailureOutcome({
          runtime: getWorkerRuntimeResultName(),
          rejectReason,
          error,
        });
        stop();
        return outcome;
      }

      if (!workerEligible) {
        const error = `${getWorkerRuntimeResultName()}_runtime_unsupported`;
        dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_FAIL, { error });
        const outcome = buildRuntimeStartFailureOutcome({
          runtime: getWorkerRuntimeResultName(),
          rejectReason: error,
          error,
        });
        stop();
        return outcome;
      }

      const normalizedActivationTimeoutMs = Number(workerActivationTimeoutMs);
      const activationRoot = root;
      const workerReadyOutcome = await workerBridge.waitForActive({
        timeoutMs: Number.isFinite(normalizedActivationTimeoutMs) && normalizedActivationTimeoutMs > 0
          ? normalizedActivationTimeoutMs
          : SENTINEL_WORKER_FIRST_FRAME_TIMEOUT_MS,
      });
      if (root !== activationRoot) {
        return {
          ok: false,
          phase: 'rejected',
          runtime: getWorkerRuntimeResultName(),
          requestId: 0,
          rejectReason: 'worker_activation_superseded',
          error: 'worker_activation_superseded',
        };
      }
      if (workerReadyOutcome?.ok !== true || workerReadyOutcome?.phase !== 'active') {
        const hasRejectReason = typeof workerReadyOutcome?.rejectReason === 'string'
          && workerReadyOutcome.rejectReason.trim();
        const rejectReason = hasRejectReason
          ? workerReadyOutcome.rejectReason.trim()
          : (workerReadyOutcome?.ok === true
            ? `worker_first_frame_phase_invalid:${String(workerReadyOutcome?.phase)}`
            : 'worker_first_frame_failed');
        const error = typeof workerReadyOutcome?.error === 'string' && workerReadyOutcome.error.trim()
          ? workerReadyOutcome.error.trim()
          : rejectReason;
        const startFailureDiagnostics = projectSentinelStartFailureDiagnostics(workerReadyOutcome?.diagnostics);
        dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_FAIL, { error });
        const outcome = buildRuntimeStartFailureOutcome({
          runtime: getWorkerRuntimeResultName(),
          rejectReason,
          error,
          startFailureDiagnostics,
        });
        stop();
        return outcome;
      }

      dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_LOOP);
      if (mode === 'auto') {
        await interventionAdmissionClient.authorizeGoal(admissionLease);
        if (requestEpoch !== startEpoch || root !== activationRoot) return { ok: false, rejectReason: 'worker_activation_superseded' };
      }
      overlayHost?.show?.();
      workerPresentationReady = true;
      updateRitualPresentation();
      syncRuntimeVisibility();
      interventionAdmissionClient.present(admissionLease);
      markNudgePresented();
      suppressProtocolPageMedia();
      return {
        ok: true,
        phase: 'active',
        runtime: getWorkerRuntimeResultName(),
      };
    } catch (error) {
      if (cleanupFailure) throw cleanupFailure;
      if (requestEpoch !== startEpoch) return { ok: false, rejectReason: 'intervention_start_superseded' };
      if (boundaryOwnsAdoptedLease) admissionLease = null;
      recordInterventionLifecycleEvent('activation_failed', { ...startTrace, error: error.message });
      console.error('[sentinel flare] start failed', error);
      const errorText = `start:${String(error?.message || error)}`;
      dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.START_FAIL, { error: errorText });
      const outcome = buildRuntimeStartFailureOutcome({
        runtime: getWorkerRuntimeResultName(),
        rejectReason: 'runtime_start_exception',
        error: errorText,
      });
      if (requestEpoch === startEpoch) stop();
      return outcome;
    } finally {
      if (requestEpoch === startEpoch) {
        starting = false;
        pendingStart = null;
      }
    }
  }

  function setConfig(partial) {
    const runtimeActive = isActive();
    const previousConfig = config;
    if (runtimeActive && partial?.protocolScope && partial.protocolScope !== config.protocolScope) throw new Error('ACTIVE_INTERVENTION_PROTOCOL_CHANGE_FORBIDDEN');
    if (runtimeActive && Object.hasOwn(partial || {}, 'deliveryForm') && partial.deliveryForm !== config.deliveryForm) {
      throw new Error('ACTIVE_INTERVENTION_DELIVERY_FORM_CHANGE_FORBIDDEN');
    }
    config = mergeConfig({
      ...config,
      ...stripConfigRuntimeMeta(partial),
    });
    syncActiveProtocolScene();
    if (!runtimeActive) return;
    const protocolChanged = hasSentinelProtocolConfigChanged(previousConfig, config);
    if (protocolChanged) {
      protocolStartAt = Date.now();
      const surfaceResult = claimSentinelProtocolSurface();
      if (!surfaceResult.accepted) {
        stop();
        return;
      }
      resetRitualState(protocolStartAt);
    }
    if (!isGlobalProtocolActive()) {
      applyRuntimeContext(null, config);
      if (modalOpen) {
        const message = resolveSiteFurinCompletionMessage();
        setModalText(message.title, message.body, message);
      }
      updateRitualPresentation();
      return;
    }
    const activeWorkerRuntime = getActiveWorkerRuntime();
    const protocolProgress = buildWorkerProtocolProgress();
    if (hasReadyWorkerSession()) {
      activeWorkerRuntime?.setConfig?.(buildWorkerRuntimeConfig(), protocolProgress);
    } else if (isWorkerRuntimeActive()) {
      postWorkerMessage(NUDGE_WORKER_MESSAGE.SET_CONFIG, {
        config: buildWorkerRuntimeConfig(),
        protocolProgress,
      });
    } else {
      swarm.setConfig(config, protocolProgress);
    }
    applyRuntimeContext(null, config);
    applyProtocolCopyForTheme(activeThemeId);
    applyProtocolPresentation();
    applyHudPresentation();
    setHudText(config.protocol);
    setModalText(config.message.title, config.message.body);
    if (!protocolChanged) {
      startRitualWatchTimer();
    }
  }

  function spawn(spawnHint = null, { waitForRendered = false, timeoutMs = 1800 } = {}) {
    if (!isGlobalProtocolActive()) return { ok: false, rejectReason: 'site_furin_has_no_swarm' };
    return debugController.spawn(spawnHint, { waitForRendered, timeoutMs });
  }

  async function spawnDebug({
    config: nextConfig = null,
    runtimeContext: nextRuntimeContext = null,
    runtimeHost: nextRuntimeHost = null,
    spawnHint = null,
    timeoutMs = 1800,
  } = {}) {
    if (nextConfig?.protocolScope !== 'global') return { ok: false, rejectReason: 'site_furin_use_protocol_start' };
    return debugController.spawnDebug({
      config: nextConfig,
      runtimeContext: nextRuntimeContext,
      runtimeHost: nextRuntimeHost,
      spawnHint,
      timeoutMs,
    });
  }

  async function probeWorkerAdmission({
    config: nextConfig = null,
    runtimeContext: nextRuntimeContext = null,
    timeoutMs = 2200,
  } = {}) {
    return debugController.probeWorkerAdmission({
      config: nextConfig,
      runtimeContext: nextRuntimeContext,
      timeoutMs,
    });
  }

  function isActive() {
    return isSentinelGameActive({
      root,
      startedAtMs,
    });
  }

  function getMode() {
    return pendingStart ? pendingStart.mode : mode;
  }

  function hasLifecycleOwnership() {
    return starting || admissionLease !== null || root !== null || cleanupFailure !== null;
  }

  function getDebugRuntimeSnapshot() {
    const telemetry = resolveHudTelemetrySnapshot();
    return {
      ...buildSentinelDebugRuntimeSnapshot({
        telemetry,
        isWorkerRuntimeActive: isWorkerRuntimeActive(),
        hasCanvasContext: !!ctx,
        spawnTimerActive: false,
        runtimeStage,
        lastRuntimeError,
        telemetryPublication: presentationController.getTelemetryPublication(),
      }),
      diagnostics: buildMainSpawnDiagnostics(),
      siteFurin: siteFurinVisual ? { ...siteFurinVisual.snapshot(), ...resolveActiveProtocolProgress(),
        reflection:siteFurinReflectionView?.snapshot(),
        presented: workerPresentationReady, scrollLocked: siteFurinIsolation !== null } : null,
    };
  }

  function resizeCanvas({ runtimeOwner = canvasRuntimeOwner } = {}) {
    if (!isGlobalProtocolActive()) {
      bounds = { width: window.innerWidth, height: window.innerHeight };
      canvasRuntimeOwner = 'host_dom';
      return;
    }
    const nextState = resizeSentinelCanvas({
      canvas,
      renderBudget: swarm.getRenderBudget().render,
      runtimeOwner,
      isWorkerRuntimeActive,
      ensureWorkerRuntime,
      ensureCanvasContext,
    });
    bounds = nextState.bounds || bounds;
    ctx = nextState.ctx;
    effectiveCanvasPixelRatio = Number(nextState.effectivePixelRatio) || 1;
    canvasRuntimeOwner = runtimeOwner;
    if (runtimeOwner === 'main') {
      swarm.setContext(ctx, bounds);
    }
    if (scenePhase === NUDGE_SCENE_PHASES.RIFT) syncRiftInviteGeometry();
  }

  function startWorkerRuntime() {
    const workerStartOutcome = workerBridge.activateSelectedRuntime({
      ensureWorkerRoot: () => ensureRoot({ runtimeOwner: 'worker' }),
      overlayHost,
      canvas,
      scene,
      bounds,
      dpr: window.devicePixelRatio || 1,
      activeThemeId,
      buildWorkerRuntimeConfig,
      buildWorkerProtocolProgress,
      runtimeContext,
      protocolStartAt,
    });
    presentationController.resetTelemetryConsole();
    return workerStartOutcome;
  }

  function cancelSiteFurinInput() { siteFurinReflectionView?.cancel(); }

  function waitForSiteFurinPaint(activationRoot, epoch, timeoutMs) {
    return new Promise((resolve, reject) => {
      let frames = 0, raf = null, settled = false;
      const timer = window.setTimeout(() => finish(new Error('site_furin_first_paint_timeout')), timeoutMs);
      const finish = error => {
        if (settled) return;
        window.clearTimeout(timer);
        if (raf !== null) window.cancelAnimationFrame(raf);
        settled = true;
        if (cancelPendingPaint === cancel) cancelPendingPaint = null;
        if (error) reject(error); else resolve();
      };
      const cancel = () => finish(new Error('site_furin_activation_superseded'));
      cancelPendingPaint = cancel;
      const paint = () => {
        if (epoch !== startEpoch || root !== activationRoot) { finish(new Error('site_furin_activation_superseded')); return; }
        if (!isRuntimeDocumentVisible()) { frames = 0; raf = window.requestAnimationFrame(paint); return; }
        if (++frames >= 2 && activationRoot.getBoundingClientRect().width > 0) { finish(); return; }
        raf = window.requestAnimationFrame(paint);
      };
      raf = window.requestAnimationFrame(paint);
    });
  }

  function stop() {
    const endingTrace = lifecycleTrace;
    if (endingTrace) recordInterventionLifecycleEvent('activation_stopping', endingTrace);
    startEpoch += 1;
    starting = false;
    const failures = [];
    const clean = (operation) => {
      try { operation(); } catch (error) { failures.push(error); }
    };
    const requireClean = () => {
      if (!failures.length) return;
      cleanupFailure = new AggregateError(failures, 'SENTINEL_PROTOCOL_CLEANUP_FAILED');
      if (endingTrace) recordInterventionLifecycleEvent('cleanup_failed', {
        ...endingTrace, leaseId: admissionLease?.leaseId ?? null, errors: failures.map(error => error.message),
      });
      throw cleanupFailure;
    };
    clean(() => cancelPendingPaint?.());
    clean(() => {
      if (pendingStart) {
        const kind = pendingStart.config.protocolScope === 'global' ? 'global_sentinel' : 'site_furin';
        interventionAdmissionClient.cancelPending({ kind, source: kind });
      }
    });
    clean(() => window.removeEventListener('blur', cancelSiteFurinInput));
    clean(() => { siteFurinReflectionView?.dispose(); siteFurinReflectionView = null; });
    clean(() => { siteFurinVisual?.dispose(); siteFurinVisual = null; });
    clean(() => { siteFurinIsolation?.release(); siteFurinIsolation = null; });
    siteFurinChoicePending = false;
    const endingLease = admissionLease;
    clean(exitRitualFullscreen);
    workerPresentationReady = false;
    clean(stopProtocolSoundscape);
    clean(() => {
      if (!lifecycleController.hasFinalAction()) markNudgeAborted('stop');
    });
    // safety net for abort/failure paths; no-op when ackAndStop/navigateAway
    // already restored (restore consumes the tracked entries). Not dispose():
    // that would cut short an in-flight SURFACE volume ramp.
    clean(() => restoreProtocolPageMedia(SENTINEL_MEDIA_RESTORE_MODES.RELEASE));
    clean(() => dispatchRuntimeEvent(NUDGE_RUNTIME_EVENT.STOP_BEGIN, {}, { ensure: false }));
    clean(unbindLifecycleListeners);
    clean(() => swarm.destroy());
    clean(stopLoop);
    clean(destroyWorkerRuntime);
    clean(clearRitualRevealTimer);
    clean(clearRitualWatchTimer);
    clean(() => terminalController.reset());
    clean(() => globalEntryRuntime.reset());
    clean(() => inputController.reset());
    escapeSequenceToken += 1;
    clean(clearEscapeSequenceTimer);
    clean(() => {
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    });
    clean(() => { stopDprObservation?.(); stopDprObservation = null; });
    clean(() => {
      if (resizeRafId !== null) window.cancelAnimationFrame(resizeRafId);
      resizeRafId = null;
    });
    clean(() => {
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    });
    clean(() => { overlayHost?.destroy?.(); overlayHost = null; });
    // A failed owner remains addressable; other owners have still been stopped.
    // Do not release the surface or lease until the whole synchronous cleanup
    // contract succeeds. A subsequent explicit stop can retry the failed owner.
    requireClean();
    root = null;
    shadow = null;
    scene = null;
    canvas = null;
    ctx = null;
    siteFurinAction = null;
    globalSentinelAction = null;
    globalSentinelStatus = null;
    ritualGuide = null;
    ritualTitle = null;
    ritualBody = null;
    ritualHint = null;
    scrim = null;
    hudTitle = null;
    hud = null;
    hudStatus = null;
    hudHint = null;
    hudMeter = null;
    hudMeterLabel = null;
    hudTelemetry = null;
    riftInviteButton = null;
    const resetState = buildSentinelRuntimeResetState();
    const stopModel = buildSentinelProtocolHostStopModel({
      resetState,
      workerRuntimeHost: SENTINEL_PROTOCOL_WORKER_RUNTIME_HOSTS.EXTENSION_FRAME_WORKER,
    });
    modalOpen = false;
    clean(() => workerBridge.setRuntimeHost(stopModel.workerRuntimeHost));
    clean(() => lifecycleController.reset(stopModel));
    protocolStartAt = stopModel.protocolStartAt;
    scenePhase = stopModel.scenePhase;
    scenePhaseStartedAtMs = 0;
    clean(() => protocolSession.reset({
      now: 0,
      config,
      protocolScene: activeProtocolScene,
    }));
    renderOptions.terminalSequence = null;
    clean(() => presentationController.resetSession());
    lastRuntimeError = stopModel.lastRuntimeError;
    runtimeStage = stopModel.runtimeStage;
    runtimeState = stopModel.runtimeState;
    canvasRuntimeOwner = stopModel.canvasRuntimeOwner;
    effectiveCanvasPixelRatio = 1;
    pendingRenderBudgetResize = false;
    clean(() => presentationController.setLastHudUpdateAt(stopModel.lastHudUpdateAt));
    clean(syncRenderOptions);
    clean(clearPublishedTelemetry);
    requireClean();
    clean(() => { globalSentinelIsolation?.release(); globalSentinelIsolation = null; });
    requireClean();
    clean(() => releaseSentinelProtocolSurfaceClaim('stop'));
    requireClean();
    clean(() => { if (endingLease) interventionAdmissionClient.release(endingLease); });
    requireClean();
    admissionLease = null;
    cleanupFailure = null;
    pendingStart = null;
    mode = stopModel.mode;
    activeNudgeKey = stopModel.activeNudgeKey;
    activeNudgeRunId = stopModel.activeNudgeRunId;
    startedAtMs = stopModel.startedAtMs;
    if (endingTrace) recordInterventionLifecycleEvent('activation_stopped', endingTrace);
    lifecycleTrace = null;
  }

  return {
    start,
    stop,
    setRuntimeContext,
    setConfig,
    spawn,
    spawnDebug,
    probeWorkerAdmission,
    isActive,
    hasLifecycleOwnership,
    getMode,
    getRunId: () => pendingStart ? pendingStart.activeNudgeRunId : activeNudgeRunId,
    _debugGetRuntimeSnapshot: getDebugRuntimeSnapshot,
    _debugFormatHudTelemetryText: formatHudTelemetryText,
  };
})();

export default SentinelProtocolHost;
