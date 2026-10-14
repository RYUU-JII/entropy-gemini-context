import { runtimeGetURL } from '../../../platform/chrome/ChromeService.js';
import {
  DEFAULT_NUDGE_RUNTIME_TUNING,
  normalizeNudgeRuntimeConfig,
} from '../../settings/config/nudgeConfig.js';
import { normalizeWorkerStatsSnapshot } from '../nudge/index.js';
import { projectGlobalSentinelRhythmStats } from '../nudge/nudgeGameRuntimeUtils.js';
import { resolveGlobalSentinelSimulationPolicy } from '../nudge/nudgeGameGlobalSentinelProtocol.js';
import { SITE_FURIN_PROTOCOL_SYSTEM } from '../nudge/nudgeGameSiteFurinProtocol.js';
import {
  NUDGE_EXTENSION_FRAME_WORKER_PROBE,
  createFrameWorkerProbeCommand,
} from './NudgeExtensionFrameWorkerProbeProtocol.js';
import { NUDGE_WORKER_MESSAGE } from './NudgeProtocol.js';
import { issueNudgeFrameHostCapability } from './frame-host/nudgeFrameHostCapabilityClient.js';
import {
  createNudgeRuntimeState,
  NUDGE_RUNTIME_EVENT,
  transitionNudgeRuntime,
} from './NudgeRuntimeMachine.js';

const HOST_PAGE_PATH = 'src/pages/nudge-render-host.html';
const FRAME_ID = 'entropy-nudge-extension-frame-worker-runtime';
const RUNTIME_NAME = 'extension_frame_worker';
const DEFAULT_WORKER_SESSION_ID = 1;

function nowMs() {
  return typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();
}

function createRuntimeId(prefix) {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const words = new Uint32Array(4);
    globalThis.crypto.getRandomValues(words);
    return `${prefix}_${Array.from(words, (word) => word.toString(16).padStart(8, '0')).join('')}`;
  }
  throw new Error('frame_host_secure_runtime_id_unavailable');
}

function createFrameHostMessageChannel() {
  if (typeof globalThis.MessageChannel !== 'function') {
    throw new Error('frame_host_message_channel_unavailable');
  }
  return new globalThis.MessageChannel();
}

function toCount(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.round(numeric));
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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

function normalizeBounds(bounds = null) {
  const source = bounds && typeof bounds === 'object' ? bounds : {};
  return {
    width: Math.max(1, Math.round(Number(source.width) || 1)),
    height: Math.max(1, Math.round(Number(source.height) || 1)),
  };
}

function normalizeDpr(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return Math.max(1, Number(globalThis.devicePixelRatio) || 1);
  return numeric;
}

function normalizeTelemetrySnapshot(input, fallback = null) {
  const source = input && typeof input === 'object' ? input : null;
  if (!source) return fallback;
  return {
    ...(fallback && typeof fallback === 'object' ? fallback : {}),
    ...source,
    spawnLifecycle: source.spawnLifecycle || fallback?.spawnLifecycle || null,
  };
}

function normalizeWorkerClock(payload = null, fallback = null) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const previous = fallback && typeof fallback === 'object' ? fallback : {};
  return {
    requestedAtMs: toFiniteNumber(source.requestedAtMs, previous.requestedAtMs || 0),
    acceptedAtMs: toFiniteNumber(source.acceptedAtMs, previous.acceptedAtMs || 0),
    renderedAtMs: toFiniteNumber(source.renderedAtMs, previous.renderedAtMs || 0),
    rejectedAtMs: toFiniteNumber(source.rejectedAtMs, previous.rejectedAtMs || 0),
  };
}

function normalizeSpawnLifecycle(payload = null, fallback = null, {
  requestClock = null,
  receivedAtMs = nowMs(),
} = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const sourceRequestId = toCount(source.requestId, 0);
  const fallbackRequestId = toCount(fallback?.requestId, 0);
  const previous = fallback && typeof fallback === 'object' && sourceRequestId === fallbackRequestId
    ? fallback
    : {};
  const phase = typeof source.phase === 'string' && source.phase.trim()
    ? source.phase.trim()
    : (previous.phase || 'unknown');
  const observedAtMs = toFiniteNumber(receivedAtMs, nowMs());
  const runtimeClock = requestClock && typeof requestClock === 'object' ? requestClock : null;
  const hasRuntimeClock = !!runtimeClock;
  const requestedAtMs = toFiniteNumber(
    runtimeClock?.requestedAtMs,
    toFiniteNumber(source.requestedAtMs, previous.requestedAtMs || 0),
  );
  const acceptedAtMs = hasRuntimeClock && (phase === 'accepted' || phase === 'rendered')
    ? toFiniteNumber(previous.acceptedAtMs, observedAtMs) || observedAtMs
    : toFiniteNumber(source.acceptedAtMs, previous.acceptedAtMs || 0);
  const renderedAtMs = hasRuntimeClock && phase === 'rendered'
    ? observedAtMs
    : toFiniteNumber(source.renderedAtMs, previous.renderedAtMs || 0);
  const rejectedAtMs = hasRuntimeClock && phase === 'rejected'
    ? observedAtMs
    : toFiniteNumber(source.rejectedAtMs, previous.rejectedAtMs || 0);
  return {
    ...previous,
    phase,
    requestId: toCount(source.requestId, previous.requestId || 0),
    reason: typeof source.reason === 'string' && source.reason.trim()
      ? source.reason.trim()
      : (previous.reason || 'spawn'),
    requestedAtMs,
    acceptedAtMs,
    renderedAtMs,
    rejectedAtMs,
    liveCount: toCount(source.liveCount, previous.liveCount || 0),
    totalSpawned: toCount(source.totalSpawned, previous.totalSpawned || 0),
    totalSplitSpawned: toCount(source.totalSplitSpawned, previous.totalSplitSpawned || 0),
    renderedCount: toCount(source.renderedCount, previous.renderedCount || 0),
    frameCount: toCount(source.frameCount, previous.frameCount || 0),
    rejectReason: typeof source.rejectReason === 'string'
      ? source.rejectReason
      : (previous.rejectReason || ''),
    workerClock: normalizeWorkerClock(source.workerClock || source, previous.workerClock),
  };
}

function isReadyState(state) {
  return (
    state?.runtimeMode === 'worker'
    && (
      state.stage === 'worker:ready'
      || state.stage === 'worker:active'
    )
  );
}

function createFrameElement(hostUrl, {
  container = null,
  bounds = null,
  onLoad = null,
} = {}) {
  const parent = container || document.documentElement;
  const existing = typeof parent.querySelector === 'function'
    ? parent.querySelector(`#${FRAME_ID}`)
    : null;
  if (existing?.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const iframe = document.createElement('iframe');
  iframe.id = FRAME_ID;
  iframe.title = 'Entropy nudge extension frame worker runtime';
  iframe.src = hostUrl;
  iframe.allow = '';
  iframe.style.position = container ? 'absolute' : 'fixed';
  iframe.style.inset = '0';
  iframe.style.width = container ? '100%' : `${normalizeBounds(bounds).width}px`;
  iframe.style.height = container ? '100%' : `${normalizeBounds(bounds).height}px`;
  iframe.style.border = '0';
  iframe.style.margin = '0';
  iframe.style.padding = '0';
  iframe.style.background = 'transparent';
  iframe.style.backgroundColor = 'transparent';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '3';
  // Must match the render-host document's color-scheme exactly: browsers
  // drop alpha and give the frame an opaque canvas when the embedded
  // document's used color-scheme differs from the iframe element's. The
  // protocol scene is translucent — an opaque frame reads as a white wall
  // over the page.
  iframe.style.colorScheme = 'light';
  iframe.setAttribute('allowtransparency', 'true');
  if (onLoad) iframe.addEventListener('load', onLoad);
  parent.appendChild(iframe);
  return iframe;
}

class NudgeExtensionFrameWorkerRuntime {
  constructor({
    onHitResult = null,
    onStateChange = null,
    onError = null,
    issueFrameHostCapability = issueNudgeFrameHostCapability,
    messageChannelFactory = createFrameHostMessageChannel,
  } = {}) {
    this.onHitResult = onHitResult;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.issueFrameHostCapability = issueFrameHostCapability;
    this.messageChannelFactory = messageChannelFactory;

    this.state = createNudgeRuntimeState();
    this.iframe = null;
    this.boundFrameLoadHandler = null;
    this.hostOrigin = '';
    this.sessionId = '';
    this.nonce = '';
    this.hostPort = null;
    this.hostReady = false;
    this.hostChannelAuthenticated = false;
    this.capabilityTicket = null;
    this.activation = null;
    this.workerBootReady = false;
    this.ready = false;
    this.latestFirstFrame = null;
    this.latestStats = normalizeWorkerStatsSnapshot(null);
    this.latestTelemetry = null;
    this.latestSpawnLifecycle = null;
    this.spawnRequestSerial = 0;
    this.spawnClockByRequestId = new Map();
    this.spawnOutcomeWaiters = new Map();
    this.workerActiveWaiters = new Set();
    this.boundMessageHandler = (event) => this.handleHostMessage(event);
    this.boundHostPortMessageHandler = (event) => this.handleHostPortMessage(event);
  }

  isSupported() {
    return (
      typeof document !== 'undefined'
      && typeof document.createElement === 'function'
      && typeof HTMLIFrameElement !== 'undefined'
      && typeof this.messageChannelFactory === 'function'
      && typeof this.issueFrameHostCapability === 'function'
      && typeof globalThis.addEventListener === 'function'
      && typeof runtimeGetURL === 'function'
    );
  }

  emitState(prevState, nextState) {
    if (typeof this.onStateChange === 'function' && nextState !== prevState) {
      this.onStateChange(nextState, prevState);
    }
    if (
      typeof this.onError === 'function'
      && nextState !== prevState
      && prevState?.lastError !== nextState?.lastError
      && nextState?.lastError
    ) {
      this.onError(nextState.lastError);
    }
  }

  dispatch(type, payload = {}) {
    const prevState = this.state;
    const nextState = transitionNudgeRuntime(prevState, { type, payload });
    this.state = nextState;
    this.emitState(prevState, nextState);
    this.settleWorkerActiveWaitersForState(nextState);
    this.settleSpawnOutcomeWaitersForState(nextState);
    this.settleSpawnOutcomeWaitersForTerminalState(nextState);
    return nextState;
  }

  activate({
    container = null,
    bounds = null,
    dpr = 1,
    themeId = 'zen',
    config = null,
    runtimeContext = null,
    protocolStartAt = Date.now(),
    protocolProgress = null,
    mainSnapshot = null,
  } = {}) {
    if (!this.isSupported()) {
      return {
        ok: false,
        phase: 'rejected',
        runtime: RUNTIME_NAME,
        requestId: 0,
        rejectReason: 'extension_frame_worker_runtime_unsupported',
      };
    }

    let runtimeConfig = null;
    try {
      runtimeConfig = normalizeNudgeRuntimeConfig(config || {}, {
        defaults: DEFAULT_NUDGE_RUNTIME_TUNING,
      });
    } catch (error) {
      return {
        ok: false,
        phase: 'rejected',
        runtime: RUNTIME_NAME,
        requestId: 0,
        rejectReason: 'extension_frame_worker_config_invalid',
        error: String(error?.message || error),
      };
    }

    this.destroy({ resetState: true, notifyHost: true });
    this.workerBootReady = false;
    this.ready = false;
    this.latestFirstFrame = null;
    this.hostReady = false;
    this.hostChannelAuthenticated = false;
    this.capabilityTicket = null;
    this.sessionId = createRuntimeId('frame_worker_runtime');
    this.nonce = createRuntimeId('nonce');
    const hostUrl = new URL(runtimeGetURL(HOST_PAGE_PATH));
    hostUrl.searchParams.set('session', this.sessionId);
    this.hostOrigin = hostUrl.origin;
    this.activation = {
      bounds: normalizeBounds(bounds),
      dpr: normalizeDpr(dpr),
      themeId,
      config: runtimeConfig,
      runtimeContext,
      protocolStartAt: Number(protocolStartAt) || Date.now(),
      protocolProgress,
    };

    this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_ACTIVATE_BEGIN);
    try {
      globalThis.addEventListener('message', this.boundMessageHandler);
      const activationSessionId = this.sessionId;
      this.boundFrameLoadHandler = (event) => {
        if (this.sessionId !== activationSessionId || event.currentTarget !== this.iframe) return;
        this.rejectOverriddenFrameNavigation();
      };
      this.iframe = createFrameElement(hostUrl.href, {
        container,
        bounds: this.activation.bounds,
        onLoad: this.boundFrameLoadHandler,
      });
      if (this.rejectOverriddenFrameNavigation()) {
        return this.buildWorkerActiveFailure(this.state);
      }
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_ACTIVATE_SUCCESS, {
        sessionId: DEFAULT_WORKER_SESSION_ID,
        stats: mainSnapshot,
      });
      this.beginCapabilityIssue();
      return {
        ok: true,
        phase: 'requested',
        runtime: RUNTIME_NAME,
        requestId: 0,
      };
    } catch (error) {
      this.handleRuntimeFailure(`frame_runtime_activate_failed:${String(error?.message || error)}`);
      return {
        ok: false,
        phase: 'rejected',
        runtime: RUNTIME_NAME,
        requestId: 0,
        rejectReason: 'extension_frame_worker_activation_failed',
        error: String(error?.message || error),
      };
    }
  }

  destroy({
    resetState = true,
    notifyHost = true,
  } = {}) {
    this.settleAllSpawnOutcomeWaiters({
      ok: false,
      phase: 'destroyed',
      runtime: RUNTIME_NAME,
      rejectReason: 'runtime_destroyed',
    });
    this.settleAllWorkerActiveWaiters({
      ok: false,
      phase: 'rejected',
      runtime: RUNTIME_NAME,
      requestId: 0,
      rejectReason: 'runtime_destroyed',
    });
    if (notifyHost) {
      this.postHostCommand(NUDGE_EXTENSION_FRAME_WORKER_PROBE.DEACTIVATE, null);
    }
    globalThis.removeEventListener?.('message', this.boundMessageHandler);
    if (this.iframe && this.boundFrameLoadHandler) {
      this.iframe.removeEventListener('load', this.boundFrameLoadHandler);
    }
    if (this.hostPort) {
      this.hostPort.removeEventListener?.('message', this.boundHostPortMessageHandler);
      if (this.hostPort.onmessage === this.boundHostPortMessageHandler) {
        this.hostPort.onmessage = null;
      }
      try {
        this.hostPort.close?.();
      } catch (_error) {}
    }
    if (this.iframe?.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    this.iframe = null;
    this.boundFrameLoadHandler = null;
    this.hostOrigin = '';
    this.sessionId = '';
    this.nonce = '';
    this.hostPort = null;
    this.hostReady = false;
    this.hostChannelAuthenticated = false;
    this.capabilityTicket = null;
    this.activation = null;
    this.workerBootReady = false;
    this.ready = false;
    this.latestFirstFrame = null;
    this.spawnClockByRequestId.clear();
    this.latestStats = normalizeWorkerStatsSnapshot(null);
    this.latestTelemetry = null;
    this.latestSpawnLifecycle = null;
    if (resetState) {
      const prevState = this.state;
      this.state = createNudgeRuntimeState();
      this.emitState(prevState, this.state);
    }
  }

  isActive() {
    return this.state.runtimeMode === 'worker';
  }

  isReady() {
    return this.ready && this.isActive();
  }

  getStateSnapshot() {
    return {
      ...this.state,
      runtimeHost: RUNTIME_NAME,
    };
  }

  getStatsSnapshot(fallback = null) {
    return normalizeWorkerStatsSnapshot(this.latestStats, fallback);
  }

  getTelemetrySnapshot() {
    return this.latestTelemetry;
  }

  buildDiagnostics(state = null) {
    const snapshot = state || this.getStateSnapshot();
    const stats = this.getStatsSnapshot(snapshot?.stats || null);
    const runtimeConfig = this.activation?.config && typeof this.activation.config === 'object'
      ? this.activation.config
      : {};
    const protocolScene = runtimeConfig.protocolScene && typeof runtimeConfig.protocolScene === 'object'
      ? runtimeConfig.protocolScene
      : {};
    const reportedEngineLiveLimit = toCount(stats?.engineLiveLimit, 0);
    const runtimeLiveLimit = toCount(runtimeConfig.maxSprites, toCount(stats?.liveCount, 0));
    const engineLiveLimit = reportedEngineLiveLimit > 0 ? reportedEngineLiveLimit : runtimeLiveLimit;
    return {
      runtimeStage: typeof snapshot?.stage === 'string' ? snapshot.stage : '',
      runtimeMode: RUNTIME_NAME,
      workerRuntimeActive: this.isActive(),
      workerSessionReady: this.isReady(),
      workerBootReady: this.workerBootReady,
      workerFirstFrameReady: this.ready,
      firstFrame: this.latestFirstFrame,
      lastError: typeof snapshot?.lastError === 'string' ? snapshot.lastError : '',
      protocolScope: typeof protocolScene.protocolScope === 'string'
        ? protocolScene.protocolScope
        : (typeof runtimeConfig.protocolScope === 'string' ? runtimeConfig.protocolScope : ''),
      protocolVariant: typeof protocolScene.protocolVariant === 'string'
        ? protocolScene.protocolVariant
        : (typeof runtimeConfig.protocolVariant === 'string' ? runtimeConfig.protocolVariant : ''),
      protocolSystem: typeof stats?.protocolSystem === 'string' && stats.protocolSystem.trim()
        ? stats.protocolSystem.trim()
        : (typeof protocolScene.protocolSystem === 'string' && protocolScene.protocolSystem.trim()
          ? protocolScene.protocolSystem.trim()
          : (runtimeConfig.protocolScope === 'global' ? 'global_sentinel_simulation' : SITE_FURIN_PROTOCOL_SYSTEM)),
      protocolSceneId: typeof stats?.protocolSceneId === 'string' && stats.protocolSceneId.trim()
        ? stats.protocolSceneId.trim()
        : (typeof protocolScene.sceneId === 'string' ? protocolScene.sceneId : ''),
      protocolRenderer: typeof stats?.protocolRenderer === 'string' && stats.protocolRenderer.trim()
        ? stats.protocolRenderer.trim()
        : (typeof protocolScene.renderer?.kind === 'string' ? protocolScene.renderer.kind : ''),
      protocolBackgroundOwner: typeof stats?.protocolBackgroundOwner === 'string' && stats.protocolBackgroundOwner.trim()
        ? stats.protocolBackgroundOwner.trim()
        : (typeof protocolScene.background?.owner === 'string' ? protocolScene.background.owner : ''),
      protocolBackgroundMode: typeof stats?.protocolBackgroundMode === 'string' && stats.protocolBackgroundMode.trim()
        ? stats.protocolBackgroundMode.trim()
        : (typeof protocolScene.background?.mode === 'string' ? protocolScene.background.mode : ''),
      protocolIntensity: Number.isFinite(Number(runtimeConfig.protocolIntensity))
        ? Number(runtimeConfig.protocolIntensity)
        : null,
      simulationBreakSeed: toCount(stats?.simulationBreakSeed, 0),
      globalSentinelGamePhase: typeof stats?.globalSentinelGamePhase === 'string'
        ? stats.globalSentinelGamePhase
        : '',
      engineControlClockMode: typeof stats?.engineControlClockMode === 'string'
        ? stats.engineControlClockMode
        : '',
      engineControlSpawnMode: typeof stats?.engineControlSpawnMode === 'string'
        ? stats.engineControlSpawnMode
        : '',
      engineControlSplitMode: typeof stats?.engineControlSplitMode === 'string'
        ? stats.engineControlSplitMode
        : '',
      engineControlInputMode: typeof stats?.engineControlInputMode === 'string'
        ? stats.engineControlInputMode
        : '',
      engineControlEntityMode: typeof stats?.engineControlEntityMode === 'string'
        ? stats.engineControlEntityMode
        : '',
      engineControlRenderMode: typeof stats?.engineControlRenderMode === 'string'
        ? stats.engineControlRenderMode
        : '',
      engineControlBlockReason: typeof stats?.engineControlBlockReason === 'string'
        ? stats.engineControlBlockReason
        : '',
      protocolProgressPhase: typeof stats?.protocolProgressPhase === 'string'
        ? stats.protocolProgressPhase
        : '',
      protocolProgressInteractionOpen: stats?.protocolProgressInteractionOpen === true,

      globalSentinelBaseSyncPressure: toNonNegativeNumber(stats?.globalSentinelBaseSyncPressure, 0),
      ...projectGlobalSentinelRhythmStats(stats),
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
      globalSentinelHitAftermathActiveCount: toCount(
        stats?.globalSentinelHitAftermathActiveCount,
        0,
      ),
      globalSentinelHitAftermathPhase: typeof stats?.globalSentinelHitAftermathPhase === 'string'
        ? stats.globalSentinelHitAftermathPhase
        : '',
      globalSentinelHitAftermathProgress: toUnit(
        stats?.globalSentinelHitAftermathProgress,
        0,
      ),
      globalSentinelHitAftermathTerminal: stats?.globalSentinelHitAftermathTerminal === true,
      globalSentinelHitAftermathSerial: toCount(stats?.globalSentinelHitAftermathSerial, 0),
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
      engineLiveLimit,
      liveLimit: engineLiveLimit,
      totalSpawned: toCount(stats?.totalSpawned, 0),
      maxTotalSpawned: toCount(runtimeConfig.maxTotalSpawned, 0),
      totalSplitSpawned: toCount(stats?.totalSplitSpawned, 0),
      maxSplits: toCount(runtimeConfig.maxSplits, 0),
      maxSplitGeneration: toCount(runtimeConfig.maxSplitGeneration, 0),
      spriteCacheMode: typeof stats?.spriteCacheMode === 'string' ? stats.spriteCacheMode : '',
      spriteCacheHitCount: toCount(stats?.spriteCacheHitCount, 0),
      spriteCacheMissCount: toCount(stats?.spriteCacheMissCount, 0),
      spriteVectorCount: toCount(stats?.spriteVectorCount, 0),
      spriteCacheUnavailableCount: toCount(stats?.spriteCacheUnavailableCount, 0),
      spawnLifecycle: this.latestSpawnLifecycle,
      hostConnected: this.iframe?.isConnected === true,
      hostChannelAuthenticated: this.hostChannelAuthenticated,
    };
  }

  postHostCommand(command, payload = null) {
    if (!this.hostPort || !this.sessionId || !this.nonce) return false;
    try {
      this.hostPort.postMessage(createFrameWorkerProbeCommand({
        command,
        sessionId: this.sessionId,
        nonce: this.nonce,
        payload,
      }));
      return true;
    } catch (error) {
      this.handleRuntimeFailure(`frame_runtime_post_failed:${String(error?.message || error)}`);
      return false;
    }
  }

  post(type, payload = null) {
    return this.postHostCommand(NUDGE_EXTENSION_FRAME_WORKER_PROBE.WORKER_MESSAGE, {
      workerMessageType: type,
      workerPayload: payload,
    });
  }

  resize({ bounds, dpr = 1 } = {}) {
    const nextBounds = normalizeBounds(bounds || this.activation?.bounds);
    const nextDpr = normalizeDpr(dpr);
    if (this.activation) {
      this.activation = {
        ...this.activation,
        bounds: nextBounds,
        dpr: nextDpr,
      };
    }
    return this.post(NUDGE_WORKER_MESSAGE.RESIZE, {
      bounds: nextBounds,
      dpr: nextDpr,
    });
  }

  setConfig(config, protocolProgress = null) {
    if (this.activation) {
      this.activation = {
        ...this.activation,
        config,
        protocolProgress,
      };
    }
    return this.post(NUDGE_WORKER_MESSAGE.SET_CONFIG, { config, protocolProgress });
  }

  forceSpawn(spawnHint = null) {
    return this.dispatchForceSpawn(spawnHint).sent;
  }

  forceSpawnAndWait(spawnHint = null, { timeoutMs = 1800 } = {}) {
    if (!this.isActive()) {
      return Promise.resolve(this.buildSpawnOutcome({
        phase: 'rejected',
        requestId: 0,
        rejectReason: 'worker_runtime_inactive',
      }));
    }
    if (!this.isReady()) {
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
      requestId,
      requestedAtMs,
    });
    if (!sent) {
      return outcomePromise;
    }
    return outcomePromise;
  }

  dispatchForceSpawn(spawnHint = null, seed = {}) {
    const requestId = Number(seed.requestId) > 0
      ? Math.round(Number(seed.requestId))
      : this.spawnRequestSerial + 1;
    if (requestId > this.spawnRequestSerial) {
      this.spawnRequestSerial = requestId;
    }
    const requestedAtMs = Number(seed.requestedAtMs) || nowMs();
    this.spawnClockByRequestId.set(requestId, {
      requestedAtMs,
    });
    this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_SPAWN_REQUESTED, {
      requestId,
      reason: 'spawn',
      requestedAtMs,
      spawnHint,
    });
    const sent = this.post(NUDGE_WORKER_MESSAGE.FORCE_SPAWN, {
      requestId,
      requestedAtMs,
      reason: 'spawn',
      spawnHint,
    });
    if (!sent) {
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_SPAWN_REJECTED, {
        requestId,
        reason: 'spawn',
        requestedAtMs,
        rejectedAtMs: nowMs(),
        rejectReason: 'post_failed',
      });
      this.spawnClockByRequestId.delete(requestId);
    }
    return {
      sent,
      requestId,
      requestedAtMs,
    };
  }

  waitForActive({ timeoutMs = 1200 } = {}) {
    if (this.rejectOverriddenFrameNavigation()) {
      return Promise.resolve(this.buildWorkerActiveFailure(this.state));
    }
    if (isReadyState(this.state) && this.ready) {
      return Promise.resolve({
        ok: true,
        phase: 'active',
        runtime: RUNTIME_NAME,
        requestId: 0,
        diagnostics: this.buildDiagnostics(),
      });
    }
    if (this.state.stage === 'worker:error') {
      return Promise.resolve(this.buildWorkerActiveFailure(this.state));
    }

    const timeoutDelay = Number(timeoutMs);
    if (!Number.isFinite(timeoutDelay) || timeoutDelay <= 0) {
      return Promise.resolve({
        ok: false,
        phase: 'rejected',
        runtime: RUNTIME_NAME,
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
        if (this.rejectOverriddenFrameNavigation()) return;
        waiter.settle({
          ok: false,
          phase: 'rejected',
          runtime: RUNTIME_NAME,
          requestId: 0,
          rejectReason: 'worker_activation_timeout',
          diagnostics: this.buildDiagnostics(),
        });
      }, timeoutDelay);
      this.workerActiveWaiters.add(waiter);
    });
  }

  waitForSpawnOutcome(requestId, { timeoutMs = 1800 } = {}) {
    const normalizedRequestId = Number(requestId);
    if (!Number.isInteger(normalizedRequestId) || normalizedRequestId <= 0) {
      return Promise.resolve({
        ok: false,
        phase: 'rejected',
        runtime: RUNTIME_NAME,
        requestId: 0,
        rejectReason: 'invalid_request_id',
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
          runtime: RUNTIME_NAME,
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
      }, timeoutMs);

      this.spawnOutcomeWaiters.set(normalizedRequestId, { settle, timer });
    });
  }

  buildSpawnOutcome({
    phase = 'rejected',
    requestId = 0,
    rejectReason = '',
    error = '',
    lifecycle = null,
  } = {}) {
    const matchingLifecycle = Number(lifecycle?.requestId) === Number(requestId)
      ? lifecycle
      : (Number(this.latestSpawnLifecycle?.requestId) === Number(requestId) ? this.latestSpawnLifecycle : null);
    return {
      ...(matchingLifecycle || {}),
      phase,
      runtime: RUNTIME_NAME,
      requestId,
      rejectReason,
      error,
      diagnostics: this.buildDiagnostics(),
      ok: phase === 'rendered',
    };
  }

  buildWorkerActiveFailure(state = null) {
    const error = typeof state?.lastError === 'string' && state.lastError
      ? state.lastError
      : 'extension_frame_worker_runtime_error';
    return {
      ok: false,
      phase: 'rejected',
      runtime: RUNTIME_NAME,
      requestId: 0,
      rejectReason: error.includes('timeout') ? 'worker_activation_timeout' : 'worker_runtime_error',
      error,
      diagnostics: this.buildDiagnostics(state),
    };
  }

  handleHostMessage(event) {
    if (!this.iframe?.contentWindow || event.source !== this.iframe.contentWindow) return;
    if (this.hostOrigin && event.origin !== this.hostOrigin) return;
    const message = event?.data || {};
    if (message.type !== NUDGE_EXTENSION_FRAME_WORKER_PROBE.EVENT_TYPE) return;
    if (message.sessionId !== this.sessionId) return;
    if (message.phase !== NUDGE_EXTENSION_FRAME_WORKER_PROBE.HOST_READY) return;
    this.handleHostReady();
  }

  handleHostPortMessage(event) {
    const message = event?.data || {};
    if (message.type !== NUDGE_EXTENSION_FRAME_WORKER_PROBE.EVENT_TYPE) return;
    if (message.sessionId !== this.sessionId || message.nonce !== this.nonce) return;
    if (this.rejectOverriddenFrameNavigation()) return;

    if (message.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.CHANNEL_READY) {
      this.hostChannelAuthenticated = true;
      return;
    }

    if (message.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.WORKER_READY) {
      this.workerBootReady = true;
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_READY);
      return;
    }

    if (message.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.FIRST_FRAME) {
      this.handleFirstFrame(message.payload);
      return;
    }

    if (message.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.WORKER_STATS) {
      this.handleWorkerStats(message.payload);
      return;
    }

    if (message.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.SPAWN_STATUS) {
      this.handleSpawnStatus(message.payload);
      return;
    }

    if (message.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.HIT_RESULT) {
      if (typeof this.onHitResult === 'function') {
        this.onHitResult(message.payload || {});
      }
      return;
    }

    if (message.phase === NUDGE_EXTENSION_FRAME_WORKER_PROBE.ERROR) {
      this.handleRuntimeFailure(message.error || 'extension_frame_worker_host_error');
    }
  }

  handleHostReady() {
    this.hostReady = true;
    this.openAuthenticatedHostChannel();
  }

  beginCapabilityIssue() {
    const requestedSessionId = this.sessionId;
    const requestedNonce = this.nonce;
    void Promise.resolve(this.issueFrameHostCapability({
      sessionId: requestedSessionId,
      nonce: requestedNonce,
    })).then((ticket) => {
      if (
        this.sessionId !== requestedSessionId
        || this.nonce !== requestedNonce
        || !this.activation
      ) {
        return;
      }
      if (
        ticket?.sessionId !== requestedSessionId
        || typeof ticket?.capability !== 'string'
        || !ticket.capability
      ) {
        throw new Error('frame_host_capability_ticket_invalid');
      }
      this.capabilityTicket = ticket;
      this.openAuthenticatedHostChannel();
    }).catch((error) => {
      if (this.sessionId !== requestedSessionId || this.nonce !== requestedNonce) return;
      this.handleRuntimeFailure(`frame_host_capability_issue_failed:${String(error?.message || error)}`);
    });
  }

  openAuthenticatedHostChannel() {
    if (this.rejectOverriddenFrameNavigation() || this.state.stage === 'worker:error') return;
    const activation = this.activation;
    if (
      !activation
      || !this.hostReady
      || !this.capabilityTicket
      || this.hostPort
      || !this.iframe?.contentWindow
      || !this.hostOrigin
    ) {
      return;
    }
    try {
      const channel = this.messageChannelFactory();
      if (!channel?.port1 || !channel?.port2) {
        throw new Error('frame_host_message_channel_invalid');
      }
      this.hostPort = channel.port1;
      this.hostPort.addEventListener?.('message', this.boundHostPortMessageHandler);
      if (!this.hostPort.addEventListener) {
        this.hostPort.onmessage = this.boundHostPortMessageHandler;
      }
      this.hostPort.start?.();
      this.iframe.contentWindow.postMessage(createFrameWorkerProbeCommand({
        command: NUDGE_EXTENSION_FRAME_WORKER_PROBE.START,
        sessionId: this.sessionId,
        nonce: this.nonce,
        capability: this.capabilityTicket.capability,
        payload: {
          renderMode: 'nudge_swarm',
          runtimeMode: 'runtime',
          persistent: true,
          width: activation.bounds.width,
          height: activation.bounds.height,
          dpr: activation.dpr,
          themeId: activation.themeId,
          config: activation.config,
          runtimeContext: activation.runtimeContext,
          protocolStartAt: activation.protocolStartAt,
          protocolProgress: activation.protocolProgress,
        },
      }), this.hostOrigin, [channel.port2]);
    } catch (error) {
      this.handleRuntimeFailure(`frame_host_channel_bootstrap_failed:${String(error?.message || error)}`);
    }
  }

  handleWorkerStats(payload = null) {
    const source = payload && typeof payload === 'object' ? payload : {};
    this.latestStats = normalizeWorkerStatsSnapshot(source, this.latestStats);
    this.latestTelemetry = normalizeTelemetrySnapshot(source.telemetry, this.latestTelemetry);
    this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_STATS, {
      stats: this.latestStats,
      telemetry: this.latestTelemetry,
    });
  }

  handleFirstFrame(payload = null) {
    const source = payload && typeof payload === 'object' ? payload : {};
    if (source.stats && typeof source.stats === 'object') {
      this.latestStats = normalizeWorkerStatsSnapshot(source.stats, this.latestStats);
    }
    this.latestFirstFrame = {
      source: typeof source.source === 'string' ? source.source : '',
      frameCount: toCount(source.frameCount, this.latestStats?.frameCount || 0),
      elapsedMs: toNonNegativeNumber(source.elapsedMs, 0),
    };
    this.ready = true;
    this.settleWorkerActiveWaitersForState(this.state);
  }

  handleSpawnStatus(payload = null) {
    const requestId = toCount(payload?.requestId, 0);
    const requestClock = this.spawnClockByRequestId.get(requestId) || null;
    const lifecycle = normalizeSpawnLifecycle(payload, this.latestSpawnLifecycle, {
      requestClock,
      receivedAtMs: nowMs(),
    });
    if (requestClock) {
      this.spawnClockByRequestId.set(requestId, {
        ...requestClock,
        acceptedAtMs: lifecycle.acceptedAtMs || requestClock.acceptedAtMs || 0,
        renderedAtMs: lifecycle.renderedAtMs || requestClock.renderedAtMs || 0,
        rejectedAtMs: lifecycle.rejectedAtMs || requestClock.rejectedAtMs || 0,
      });
    }
    this.latestSpawnLifecycle = lifecycle;
    const phase = lifecycle.phase;
    if (phase === 'accepted') {
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_SPAWN_ACCEPTED, lifecycle);
      return;
    }
    if (phase === 'rendered') {
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_SPAWN_RENDERED, lifecycle);
      this.settleSpawnOutcomeWaiter(lifecycle);
      this.spawnClockByRequestId.delete(lifecycle.requestId);
      return;
    }
    if (phase === 'rejected') {
      this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_SPAWN_REJECTED, lifecycle);
      this.settleSpawnOutcomeWaiter(lifecycle);
      this.spawnClockByRequestId.delete(lifecycle.requestId);
    }
  }

  settleSpawnOutcomeWaiter(lifecycle) {
    const requestId = Number(lifecycle?.requestId);
    if (!Number.isInteger(requestId) || requestId <= 0) return;
    const waiter = this.spawnOutcomeWaiters.get(requestId);
    if (!waiter) return;
    waiter.settle(this.buildSpawnOutcome({
      phase: lifecycle.phase,
      requestId,
      rejectReason: lifecycle.phase === 'rejected' ? (lifecycle.rejectReason || 'rejected') : '',
      lifecycle,
    }));
  }

  settleSpawnOutcomeWaitersForState(nextState) {
    const lifecycle = nextState?.telemetry?.spawnLifecycle;
    if (!lifecycle || typeof lifecycle !== 'object') return;
    if (lifecycle.phase !== 'rendered' && lifecycle.phase !== 'rejected') return;
    this.latestSpawnLifecycle = normalizeSpawnLifecycle(lifecycle, this.latestSpawnLifecycle);
    this.settleSpawnOutcomeWaiter(this.latestSpawnLifecycle);
  }

  settleWorkerActiveWaitersForState(nextState) {
    if (this.workerActiveWaiters.size <= 0) return;
    if (isReadyState(nextState) && this.ready) {
      this.settleAllWorkerActiveWaiters({
        ok: true,
        phase: 'active',
        runtime: RUNTIME_NAME,
        requestId: 0,
        diagnostics: this.buildDiagnostics(nextState),
      });
      return;
    }
    if (nextState?.stage === 'worker:error') {
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
    this.spawnClockByRequestId.clear();
  }

  settleAllWorkerActiveWaiters(outcome = {}) {
    const waiters = Array.from(this.workerActiveWaiters);
    for (const waiter of waiters) {
      waiter?.settle?.(outcome);
    }
  }

  rejectOverriddenFrameNavigation() {
    if (!this.activation || !this.iframe?.hasAttribute('srcdoc')) return false;
    // Presence wins over src even for an empty value. Diagnose the owned
    // navigation; never remove another writer's attribute or retry the host.
    if (this.state.stage !== 'worker:error') {
      this.handleRuntimeFailure('frame_host_navigation_overridden:srcdoc');
    }
    return true;
  }

  handleRuntimeFailure(error = null) {
    const errorText = `extension_frame_worker:${String(error?.message || error || 'runtime_error')}`;
    this.ready = false;
    this.workerBootReady = false;
    this.hostChannelAuthenticated = false;
    this.latestFirstFrame = null;
    this.dispatch(NUDGE_RUNTIME_EVENT.WORKER_ERROR, {
      error: errorText,
      stats: this.latestStats,
      telemetry: this.latestTelemetry,
    });
  }
}

export function createNudgeExtensionFrameWorkerRuntime(options = {}) {
  return new NudgeExtensionFrameWorkerRuntime(options);
}

export { NudgeExtensionFrameWorkerRuntime };
export default NudgeExtensionFrameWorkerRuntime;
