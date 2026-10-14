import { createNudgeSwarmEngine } from './engine/NudgeSwarmEngine.js';
import { projectGlobalSentinelRhythmStats } from './nudge/nudgeGameRuntimeUtils.js';
import {
  DEFAULT_THEME_ID,
  assertCanonicalThemeId,
} from '../../themes/core/ids.js';
import {
  DEFAULT_NUDGE_RUNTIME_TUNING,
  normalizeNudgeRuntimeConfig,
} from '../settings/config/nudgeConfig.js';
import { NUDGE_WORKER_MESSAGE } from './runtime/NudgeProtocol.js';
import {
  isNudgeTerminalSequenceDone,
  normalizeNudgeTerminalSequenceState,
} from './nudge/nudgeGameTerminalSequence.js';
import {
  NUDGE_SCENE_PHASES,
  assertNudgeScenePhase,
} from './nudge/nudgeGameScene.js';
import {
  resolveNudgeProtocolScene,
} from './protocols/nudgeProtocolScene.js';
import { resolveRenderResolution } from '../../platform/rendering/renderBudgetContract.js';
import { createRenderHealthSample } from '../../platform/rendering/renderHealthSample.js';

const DEFAULT_CONFIG = Object.freeze({
  ...DEFAULT_NUDGE_RUNTIME_TUNING,
  protocol: { rampMs: 45000 },
});

const WORKER_STATS_FRAME_INTERVAL = 20;
const FRAME_WORK_SAMPLE_LIMIT = 120;

const hasWorkerRaf = (
  typeof self.requestAnimationFrame === 'function'
  && typeof self.cancelAnimationFrame === 'function'
);

let sessionId = 0;
let canvas = null;
let ctx = null;
let bounds = { width: 1, height: 1 };
let config = { ...DEFAULT_CONFIG };
let protocolScene = resolveNudgeProtocolScene(config);
let protocolProgress = null;
let activeThemeId = assertCanonicalThemeId(DEFAULT_THEME_ID, 'nudge swarm default theme');
let protocolStartAt = Date.now();
let modalOpen = false;
let runtimeActive = false;
let runtimeVisible = true;
let scenePhase = 'ritual';
let terminalSequenceState = null;

let frameCounter = 0;
let lastTs = null;
let loopToken = null;
let loopScheduleKind = '';
let pendingSpawnRenderAcks = [];
let postFailureReported = false;
let effectiveDpr = 1;
let requestedDpr = 1;
let lastFrameWorkMs = 0;
let lastUpdateWorkMs = 0;
let lastRenderWorkMs = 0;
let maxFrameWorkMs = 0;
let frameWorkSamples = [];
let frameWorkSampleCursor = 0;
let pendingRenderBudgetResize = false;

// The worker owns only the OffscreenCanvas loop and message boundary. Both
// site_furin and global_sentinel render through this one context-agnostic swarm
// engine; protocolScene data selects the actor/background/detail policy.
const swarm = createNudgeSwarmEngine({ runtimeNavigator: self.navigator });

function statsSnapshot() {
  return swarm.getStats();
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function refreshProtocolScene() {
  protocolScene = resolveNudgeProtocolScene(config);
  return protocolScene;
}

function getProtocolScope() {
  return (protocolScene || refreshProtocolScene()).protocolScope;
}

function getProtocolSystem() {
  return (protocolScene || refreshProtocolScene()).protocolSystem;
}

function getProtocolVariant() {
  return (protocolScene || refreshProtocolScene()).protocolVariant;
}

function setScenePhase(value, startedAtMs) {
  const nextPhase = assertNudgeScenePhase(value);
  if (!Number.isFinite(startedAtMs) || startedAtMs < 0) {
    throw new Error('nudge_scene_phase_started_at_invalid');
  }
  // Phase clocks cross the authenticated channel as Date.now epoch ms, never
  // worker-local performance.now work samples or a delivery-time restamp.
  swarm.setScenePhase(nextPhase, { startedAtMs });
  scenePhase = nextPhase;
  refreshProtocolScene();
}

function setTerminalSequence(sequence = null, { clearEntities = false } = {}) {
  terminalSequenceState = normalizeNudgeTerminalSequenceState(sequence);
  if (terminalSequenceState) {
    scenePhase = terminalSequenceState.scenePhase;
    swarm.setTerminalSequence(terminalSequenceState, { clearEntities });
  } else {
    swarm.setTerminalSequence(null, { clearEntities });
  }
  refreshProtocolScene();
}

function isTerminalSequenceActive() {
  return !!terminalSequenceState;
}

function finalizeTerminalSequenceIfDone(now = Date.now()) {
  if (!terminalSequenceState || !isNudgeTerminalSequenceDone(terminalSequenceState, { now })) return;
  setTerminalSequence(null, { clearEntities: true });
}

function post(type, payload = null) {
  try {
    self.postMessage({
      type,
      sessionId,
      ...(payload && typeof payload === 'object' ? payload : {}),
    });
  } catch (error) {
    if (!postFailureReported && typeof console !== 'undefined' && typeof console.error === 'function') {
      postFailureReported = true;
      console.error('[sentinel flare worker] postMessage failure', error);
    }
  }
}

function normalizeSpawnRequestId(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
}

function postSpawnStatus(phase, payload = {}) {
  const stats = statsSnapshot();
  post(NUDGE_WORKER_MESSAGE.SPAWN_STATUS, {
    phase,
    requestId: normalizeSpawnRequestId(payload.requestId),
    reason: typeof payload.reason === 'string' && payload.reason ? payload.reason : 'spawn',
    requestedAtMs: Number(payload.requestedAtMs) || 0,
    acceptedAtMs: Number(payload.acceptedAtMs) || 0,
    renderedAtMs: Number(payload.renderedAtMs) || 0,
    rejectedAtMs: Number(payload.rejectedAtMs) || 0,
    liveCount: stats.liveCount,
    totalSpawned: stats.totalSpawned,
    totalSplitSpawned: stats.totalSplitSpawned,
    renderedCount: Math.max(0, Math.round(Number(payload.renderedCount) || 0)),
    frameCount: frameCounter,
    rejectReason: typeof payload.rejectReason === 'string' ? payload.rejectReason : '',
  });
}

function mergeConfig(partial) {
  return normalizeNudgeRuntimeConfig(partial, {
    defaults: {
      ...DEFAULT_CONFIG,
      ...config,
    },
  });
}

function setTheme(themeId) {
  activeThemeId = assertCanonicalThemeId(themeId, 'nudge swarm SET_THEME');
  swarm.setTheme(activeThemeId);
}

function normalizeProtocolProgressSnapshot(input = null) {
  if (!input || typeof input !== 'object') return null;
  return { ...input };
}

function setProtocolProgress(input = null) {
  protocolProgress = normalizeProtocolProgressSnapshot(input);
  swarm.setProtocolProgress(protocolProgress);
}

function sampleNow() {
  if (typeof performance?.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function recordFrameWork({ frameWorkMs = 0, updateWorkMs = 0, renderWorkMs = 0 } = {}) {
  lastFrameWorkMs = Math.max(0, Number(frameWorkMs) || 0);
  lastUpdateWorkMs = Math.max(0, Number(updateWorkMs) || 0);
  lastRenderWorkMs = Math.max(0, Number(renderWorkMs) || 0);
  maxFrameWorkMs = Math.max(maxFrameWorkMs, lastFrameWorkMs);
  if (frameWorkSamples.length < FRAME_WORK_SAMPLE_LIMIT) {
    frameWorkSamples.push(lastFrameWorkMs);
    return;
  }
  frameWorkSamples[frameWorkSampleCursor] = lastFrameWorkMs;
  frameWorkSampleCursor = (frameWorkSampleCursor + 1) % FRAME_WORK_SAMPLE_LIMIT;
}

function resolveFrameWorkP95Ms() {
  if (frameWorkSamples.length === 0) return 0;
  const sorted = [...frameWorkSamples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  return sorted[index];
}

function resolveSpawnBlockReason(reason = 'spawn', parent = null, spawnHint = null) {
  if (!runtimeActive) return 'runtime_inactive';
  if (!ctx) return 'canvas_context_missing';
  return swarm.getSpawnBlockReason(reason, parent, spawnHint);
}

function canSpawnEntity(reason = 'spawn', parent = null, spawnHint = null) {
  return resolveSpawnBlockReason(reason, parent, spawnHint) === '';
}

function spawnOne({ reason = 'spawn', parent = null, spawnHint = null } = {}) {
  if (!runtimeActive) return false;
  if (!canSpawnEntity(reason, parent, spawnHint)) return false;
  return swarm.spawn({ reason, parent, spawnHint });
}

function scheduleLoop() {
  if (!runtimeActive || !runtimeVisible || loopToken !== null) return;

  if (hasWorkerRaf) {
    loopScheduleKind = 'raf';
    loopToken = self.requestAnimationFrame(loop);
    return;
  }
  loopScheduleKind = 'timeout';
  loopToken = self.setTimeout(() => {
    loopToken = null;
    loopScheduleKind = '';
    loop(sampleNow());
  }, 16);
}

function cancelLoop() {
  if (loopToken === null) return;
  if (loopScheduleKind === 'raf') {
    self.cancelAnimationFrame(loopToken);
  } else {
    self.clearTimeout(loopToken);
  }
  loopToken = null;
  loopScheduleKind = '';
}

function loop(ts) {
  try {
    loopToken = null;
    loopScheduleKind = '';
    if (!runtimeActive || !runtimeVisible || !ctx) return;
    if (pendingRenderBudgetResize) {
      pendingRenderBudgetResize = false;
      applyResize(bounds, requestedDpr);
    }
    if (lastTs === null) lastTs = ts;
    const frameMs = Math.max(0, ts - lastTs);
    const dt = Math.min(0.05, frameMs / 1000);
    lastTs = ts;
    const now = Date.now();
    finalizeTerminalSequenceIfDone(now);

    const workStartedAt = sampleNow();
    swarm.update(dt, now);
    const updateFinishedAt = sampleNow();
    swarm.render(now);
    const renderFinishedAt = sampleNow();
    recordFrameWork({
      frameWorkMs: renderFinishedAt - workStartedAt,
      updateWorkMs: updateFinishedAt - workStartedAt,
      renderWorkMs: renderFinishedAt - updateFinishedAt,
    });
    {
      const health = swarm.observeRenderHealth(createRenderHealthSample({
        surfaceId: 'nudge-worker-canvas',
        observedAtMs: renderFinishedAt,
        frameIntervalMs: frameMs > 0 ? frameMs : 16.67,
        updateWorkMs: updateFinishedAt - workStartedAt,
        renderWorkMs: renderFinishedAt - updateFinishedAt,
        droppedFrameRatio: frameMs > 25 ? 1 : 0,
        visible: runtimeVisible,
        viewportWidth: bounds.width,
        viewportHeight: bounds.height,
        effectivePixelRatio: effectiveDpr,
      }));
      if (health.pressureChanged) {
        pendingRenderBudgetResize = true;
        post(NUDGE_WORKER_MESSAGE.RENDER_BUDGET_CHANGED, {
          renderPressureLevel: health.pressureLevel,
          renderBudgetPolicyId: health.renderBudget.render.policyId,
        });
      }
    }
    frameCounter += 1;
    const shouldPostStats = frameCounter === 1
      || (frameCounter % WORKER_STATS_FRAME_INTERVAL) === 0;
    const shouldReadStats = shouldPostStats || pendingSpawnRenderAcks.length > 0;
    const stats = shouldReadStats ? swarm.getStats() : null;
    if (shouldPostStats) {
      post(NUDGE_WORKER_MESSAGE.STATS, {
        protocolScope: config?.protocolScope || getProtocolScope(),
        protocolVariant: config?.protocolVariant || getProtocolVariant(),
        protocolSystem: getProtocolSystem(),
        protocolSceneId: protocolScene?.sceneId || stats.protocolSceneId || '',
        protocolRenderer: protocolScene?.renderer?.kind || stats.protocolRenderer || '',
        protocolBackgroundOwner: protocolScene?.background?.owner || '',
        protocolBackgroundMode: protocolScene?.background?.mode || '',
        engineLiveLimit: stats.engineLiveLimit || 0,
        engineControlClockMode: stats.engineControlClockMode,
        engineControlSpawnMode: stats.engineControlSpawnMode,
        engineControlSplitMode: stats.engineControlSplitMode,
        engineControlInputMode: stats.engineControlInputMode,
        engineControlEntityMode: stats.engineControlEntityMode,
        engineControlRenderMode: stats.engineControlRenderMode,
        engineControlBlockReason: stats.engineControlBlockReason,
        protocolProgressPhase: stats.protocolProgressPhase,
        protocolProgressInteractionOpen: stats.protocolProgressInteractionOpen,

        renderPressureLevel: stats.renderPressureLevel,
        renderBudgetPolicyId: stats.renderBudgetPolicyId,
        renderFrameIntervalEmaMs: stats.renderFrameIntervalEmaMs,
        renderWorkTimeEmaMs: stats.renderWorkTimeEmaMs,
        liveCount: stats.liveCount,
        totalSpawned: stats.totalSpawned,
        totalSplitSpawned: stats.totalSplitSpawned,
        simulationBreakSeed: stats.simulationBreakSeed,
        globalSentinelGamePhase: stats.globalSentinelGamePhase,
        ...projectGlobalSentinelRhythmStats(stats),
        globalSentinelBaseSyncPressure: stats.globalSentinelBaseSyncPressure,
        globalSentinelSyncPressure: stats.globalSentinelSyncPressure,
        globalSentinelSyncPressureRelief: stats.globalSentinelSyncPressureRelief,
        globalSentinelSyncPressureFailureThreshold: stats.globalSentinelSyncPressureFailureThreshold,
        globalSentinelFracture: stats.globalSentinelFracture,
        globalSentinelFractureThreshold: stats.globalSentinelFractureThreshold,
        globalSentinelIntegrity: stats.globalSentinelIntegrity,
        globalSentinelFractureRepairAmount: stats.globalSentinelFractureRepairAmount,
        globalSentinelFractureRepairPressure: stats.globalSentinelFractureRepairPressure,
        globalSentinelFractureRepairElapsedMs: stats.globalSentinelFractureRepairElapsedMs,
        globalSentinelFractureImpact: stats.globalSentinelFractureImpact,
        globalSentinelFractureImpactStrength: stats.globalSentinelFractureImpactStrength,
        globalSentinelFractureImpactSerial: stats.globalSentinelFractureImpactSerial,
        globalSentinelFractureImpactX: stats.globalSentinelFractureImpactX,
        globalSentinelFractureImpactY: stats.globalSentinelFractureImpactY,
        globalSentinelHitAftermathActiveCount: stats.globalSentinelHitAftermathActiveCount,
        globalSentinelHitAftermathPhase: stats.globalSentinelHitAftermathPhase,
        globalSentinelHitAftermathProgress: stats.globalSentinelHitAftermathProgress,
        globalSentinelHitAftermathTerminal: stats.globalSentinelHitAftermathTerminal,
        globalSentinelHitAftermathSerial: stats.globalSentinelHitAftermathSerial,
        globalSentinelEntryRevealProgress: stats.globalSentinelEntryRevealProgress,
        globalSentinelStarterFeedbackSerial: stats.globalSentinelStarterFeedbackSerial,
        globalSentinelStarterFeedbackX: stats.globalSentinelStarterFeedbackX,
        globalSentinelStarterFeedbackY: stats.globalSentinelStarterFeedbackY,
        globalSentinelLastHitEfficiency: stats.globalSentinelLastHitEfficiency,
        globalSentinelLastFractureImpulse: stats.globalSentinelLastFractureImpulse,
        globalSentinelLastSyncPressureRelief: stats.globalSentinelLastSyncPressureRelief,
        spriteCacheMode: stats.spriteCacheMode,
        spriteCacheHitCount: stats.spriteCacheHitCount,
        spriteCacheMissCount: stats.spriteCacheMissCount,
        spriteVectorCount: stats.spriteVectorCount,
        spriteCacheUnavailableCount: stats.spriteCacheUnavailableCount,
        renderBackend: 'canvas2d',
        effectiveDpr,
        frameWorkMs: lastFrameWorkMs,
        updateWorkMs: lastUpdateWorkMs,
        renderWorkMs: lastRenderWorkMs,
        frameWorkP95Ms: resolveFrameWorkP95Ms(),
        frameWorkMaxMs: maxFrameWorkMs,
        frameCount: frameCounter,
      });
    }
    if (stats) flushRenderedSpawnAcks(stats.liveCount);
    scheduleLoop();
  } catch (error) {
    post(NUDGE_WORKER_MESSAGE.ERROR, {
      error: `loop_failure:${String(error?.message || error)}`,
    });
    stopRuntime();
  }
}

function applyResize(nextBounds, nextDpr) {
  if (!canvas) return;
  const width = Math.max(1, Number(nextBounds?.width) || 1);
  const height = Math.max(1, Number(nextBounds?.height) || 1);
  if (!Number.isFinite(nextDpr) || nextDpr <= 0) throw new Error('NUDGE_DEVICE_PIXEL_RATIO_INVALID');
  requestedDpr = nextDpr;
  const resolution = resolveRenderResolution({
    cssWidth: width,
    cssHeight: height,
    devicePixelRatio: requestedDpr,
    renderBudget: swarm.getRenderBudget().render,
  });
  const nextEffectiveDpr = resolution.effectivePixelRatio;
  const boundsChanged = bounds.width !== width || bounds.height !== height;
  const resolutionChanged = (
    canvas.width !== resolution.pixelWidth
    || canvas.height !== resolution.pixelHeight
  );
  const transformChanged = effectiveDpr !== nextEffectiveDpr;
  effectiveDpr = nextEffectiveDpr;
  bounds = { width, height };
  if (canvas.width !== resolution.pixelWidth) canvas.width = resolution.pixelWidth;
  if (canvas.height !== resolution.pixelHeight) canvas.height = resolution.pixelHeight;
  const contextCreated = !ctx;
  if (contextCreated) {
    ctx = canvas.getContext('2d', { alpha: true }) || null;
  }
  if (ctx && (contextCreated || resolutionChanged || transformChanged)) {
    ctx.setTransform(effectiveDpr, 0, 0, effectiveDpr, 0, 0);
  }
  if (ctx && (contextCreated || boundsChanged || resolutionChanged || transformChanged)) {
    swarm.setContext(ctx, bounds);
  }
}

function resetRuntimeState() {
  pendingSpawnRenderAcks = [];
  terminalSequenceState = null;
  scenePhase = 'ritual';
  frameCounter = 0;
  lastFrameWorkMs = 0;
  lastUpdateWorkMs = 0;
  lastRenderWorkMs = 0;
  maxFrameWorkMs = 0;
  frameWorkSamples = [];
  frameWorkSampleCursor = 0;
  pendingRenderBudgetResize = false;
  swarm.reset();
}

function clearCanvas() {
  if (!ctx) return;
  ctx.clearRect(0, 0, bounds.width, bounds.height);
}

function stopRuntime() {
  runtimeActive = false;
  cancelLoop();
  pendingSpawnRenderAcks = [];
  terminalSequenceState = null;
  protocolProgress = null;
  scenePhase = 'ritual';
  swarm.reset();
  lastTs = null;
  clearCanvas();
}

function queueSpawnRenderAck(payload = {}) {
  const requestId = normalizeSpawnRequestId(payload.requestId);
  if (requestId <= 0) return;
  pendingSpawnRenderAcks.push({
    requestId,
    reason: typeof payload.reason === 'string' && payload.reason ? payload.reason : 'spawn',
    requestedAtMs: Number(payload.requestedAtMs) || 0,
    acceptedAtMs: Number(payload.acceptedAtMs) || sampleNow(),
  });
}

function flushRenderedSpawnAcks(renderedCount = 0) {
  if (pendingSpawnRenderAcks.length <= 0) return;
  const safeRenderedCount = Math.max(0, Math.round(Number(renderedCount) || 0));
  if (safeRenderedCount <= 0) return;
  const acks = pendingSpawnRenderAcks;
  pendingSpawnRenderAcks = [];
  const renderedAtMs = sampleNow();
  for (let i = 0; i < acks.length; i += 1) {
    postSpawnStatus('rendered', {
      ...acks[i],
      renderedAtMs,
      renderedCount: safeRenderedCount,
    });
  }
}

function startRuntime() {
  if (!ctx) return false;
  const retainedProtocolProgress = protocolProgress;
  stopRuntime();
  protocolProgress = retainedProtocolProgress;
  resetRuntimeState();
  swarm.init({ ctx, bounds, config, themeId: activeThemeId, protocolStartAt, scenePhase, protocolProgress });
  swarm.setModalOpen(modalOpen);
  runtimeActive = true;
  swarm.ensureInitialSchool();
  // The extension-frame owner can be backgrounded before its worker rAF ever
  // fires. Paint one canonical zero-delta frame synchronously so activation
  // readiness never depends on page visibility; subsequent frames return to
  // the normal rAF/low-power scheduler.
  loop(sampleNow());
  return runtimeActive;
}

function applyConfig(nextConfig, nextProtocolProgress = null) {
  const previousProtocolScope = config?.protocolScope || '';
  const previousProtocolVariant = config?.protocolVariant || '';
  protocolProgress = normalizeProtocolProgressSnapshot(nextProtocolProgress);
  config = mergeConfig(nextConfig);
  refreshProtocolScene();
  swarm.setConfig(config, protocolProgress);
  const protocolChanged = runtimeActive && (
    (previousProtocolScope && previousProtocolScope !== config?.protocolScope)
    || (previousProtocolVariant && previousProtocolVariant !== config?.protocolVariant)
  );
  if (protocolChanged) {
    protocolStartAt = Date.now();
    startRuntime();
  }
}

function handlePointerDown(payload, {
  activateEligibleGlobalTarget = false,
} = {}) {
  const commit = payload?.commit !== false;
  const interactionIntent = typeof payload?.interactionIntent === 'string'
    ? payload.interactionIntent
    : '';
  const acceptedInteractionType = typeof payload?.acceptedInteractionType === 'string'
    ? payload.acceptedInteractionType
    : '';
  const interactionSerial = Math.max(0, Math.round(Number(payload?.interactionSerial) || 0));
  if (!runtimeActive || modalOpen || isTerminalSequenceActive()) {
    const rejectReason = !runtimeActive
      ? 'runtime_inactive'
      : (modalOpen ? 'modal_open' : 'terminal_sequence_active');
    post(NUDGE_WORKER_MESSAGE.HIT_RESULT, {
      hit: false,
      rejectReason,
      commit,
      interactionIntent,
      acceptedInteractionType,
      interactionSerial,
      protocolScope: config?.protocolScope || getProtocolScope(),
      protocolVariant: config?.protocolVariant || getProtocolVariant(),
      protocolSystem: getProtocolSystem(),
    });
    return;
  }
  const requestedX = Number(payload?.x);
  const requestedY = Number(payload?.y);
  if (
    !activateEligibleGlobalTarget
    && (!Number.isFinite(requestedX) || !Number.isFinite(requestedY))
  ) {
    post(NUDGE_WORKER_MESSAGE.HIT_RESULT, {
      hit: false,
      rejectReason: 'pointer_coordinates_invalid',
      commit,
      interactionIntent,
      acceptedInteractionType,
      interactionSerial,
      protocolScope: config?.protocolScope || getProtocolScope(),
      protocolVariant: config?.protocolVariant || getProtocolVariant(),
      protocolSystem: getProtocolSystem(),
    });
    return;
  }
  let result;
  if (activateEligibleGlobalTarget) {
    result = swarm.handleEligibleGlobalTarget({ commit, starterPhase: payload.starterPhase });
  } else {
    result = swarm.handlePointer({ x: requestedX, y: requestedY, commit, starterPhase: payload.starterPhase });
  }
  const hit = result.hit === true;
  const stats = swarm.getStats();
  const acceptedX = Number(result.x);
  const acceptedY = Number(result.y);
  const acceptedXRatio = Number(result.xRatio);
  const acceptedYRatio = Number(result.yRatio);
  const protocolOutcome = result?.protocolOutcome && typeof result.protocolOutcome === 'object'
    ? result.protocolOutcome
    : null;
  post(NUDGE_WORKER_MESSAGE.HIT_RESULT, {
    hit,
    rejectReason: typeof result.rejectReason === 'string' ? result.rejectReason : '',
    commit,
    interactionIntent,
    acceptedInteractionType,
    interactionSerial,
    targetId: result.targetId || null,
    starterPhase: payload.starterPhase,
    x: Number.isFinite(acceptedX) ? acceptedX : requestedX,
    y: Number.isFinite(acceptedY) ? acceptedY : requestedY,
    xRatio: Number.isFinite(acceptedXRatio) ? acceptedXRatio : null,
    yRatio: Number.isFinite(acceptedYRatio) ? acceptedYRatio : null,
    acceptedAtMs: Math.max(0, Number(result.acceptedAtMs) || 0),
    hitEfficiency: Number.isFinite(Number(result.hitEfficiency))
      ? Number(result.hitEfficiency)
      : 0,
    wasGlobalAwaitingStart: result.wasGlobalAwaitingStart === true,
    protocolScope: config?.protocolScope || getProtocolScope(),
    protocolVariant: config?.protocolVariant || getProtocolVariant(),
    protocolSystem: getProtocolSystem(),
    protocolSnapshot: {
      protocolSystem: getProtocolSystem(),
      protocolScope: config?.protocolScope || getProtocolScope(),
      protocolVariant: config?.protocolVariant || getProtocolVariant(),
      ...(protocolOutcome || {}),
      gamePhase: protocolOutcome?.gamePhase || stats.globalSentinelGamePhase,
      fracture: protocolOutcome?.fracture ?? stats.globalSentinelFracture,
      syncPressure: protocolOutcome?.syncPressure ?? stats.globalSentinelSyncPressure,
      fractureImpactSerial: stats.globalSentinelFractureImpactSerial,

    },
  });
}

function handleGlobalStarterFeedback(payload) {
  if (!runtimeActive || modalOpen || isTerminalSequenceActive()) return;
  swarm.pulseGlobalStarterFeedback({
    x: Number(payload?.x),
    y: Number(payload?.y),
    now: Date.now(),
  });
}

function applyInit(payload = {}) {
  if (payload.canvas) {
    canvas = payload.canvas;
    ctx = canvas.getContext('2d', { alpha: true }) || null;
  }
  if (payload.config) {
    config = mergeConfig(payload.config);
    refreshProtocolScene();
  }
  setProtocolProgress(payload.protocolProgress || null);
  if (payload.themeId) {
    setTheme(payload.themeId);
  }
  if (Number.isFinite(Number(payload.protocolStartAt))) {
    protocolStartAt = Number(payload.protocolStartAt);
  }
  refreshProtocolScene();
  applyResize(payload.bounds, payload.dpr);
  post(NUDGE_WORKER_MESSAGE.READY, {
    renderPressureLevel: swarm.getRenderPressureLevel(),
    renderBudgetPolicyId: swarm.getRenderBudget().render.policyId,
    liveCount: 0,
    totalSpawned: 0,
    totalSplitSpawned: 0,
    supportsWorkerRaf: hasWorkerRaf,
  });
}

function applyActivate(payload = {}) {
  if (payload.themeId) {
    setTheme(payload.themeId);
  }
  if (payload.config) {
    applyConfig(payload.config, payload.protocolProgress || null);
  }
  if (Number.isFinite(Number(payload.protocolStartAt))) {
    protocolStartAt = Number(payload.protocolStartAt);
  }
  applyResize(payload.bounds, payload.dpr);
  modalOpen = false;
  runtimeVisible = true;
  if (!startRuntime()) {
    post(NUDGE_WORKER_MESSAGE.ERROR, { error: 'activate_failed' });
  }
}

function isStaleMessage(messageSessionId) {
  const numeric = Number(messageSessionId);
  if (!Number.isFinite(numeric) || numeric <= 0) return false;
  if (sessionId <= 0) return false;
  return numeric !== sessionId;
}

function withMessageGuard(handler) {
  return (message) => {
    try {
      handler(message);
    } catch (error) {
      post(NUDGE_WORKER_MESSAGE.ERROR, { error: String(error?.message || error) });
    }
  };
}

self.onmessage = withMessageGuard((event) => {
  const message = event?.data || {};
  const type = typeof message?.type === 'string' ? message.type : '';
  const payload = message?.payload && typeof message.payload === 'object' ? message.payload : {};

  if (type === NUDGE_WORKER_MESSAGE.INIT) {
    sessionId = Number(message?.sessionId) || 0;
    applyInit(payload);
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.PREWARM) {
    if (payload.config) {
      config = mergeConfig(payload.config);
      refreshProtocolScene();
    }
    if (payload.themeId) {
      setTheme(payload.themeId);
    }
    const stats = statsSnapshot();
    post(NUDGE_WORKER_MESSAGE.PREWARMED, {
      renderPressureLevel: stats.renderPressureLevel,
      renderBudgetPolicyId: stats.renderBudgetPolicyId,
      liveCount: stats.liveCount,
      totalSpawned: stats.totalSpawned,
      totalSplitSpawned: stats.totalSplitSpawned,
    });
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.ACTIVATE) {
    sessionId = Number(message?.sessionId) || sessionId;
    applyActivate(payload);
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.DEACTIVATE) {
    if (isStaleMessage(message?.sessionId)) return;
    modalOpen = false;
    stopRuntime();
    return;
  }

  if (isStaleMessage(message?.sessionId)) return;

  if (type === NUDGE_WORKER_MESSAGE.RESIZE) {
    applyResize(payload.bounds, payload.dpr);
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.SET_MODAL_OPEN) {
    const nextModalOpen = !!payload.open;
    if (modalOpen !== nextModalOpen) lastTs = null;
    modalOpen = nextModalOpen;
    swarm.setModalOpen(modalOpen);
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.SET_SCENE_PHASE) {
    const previousPhase = scenePhase;
    setScenePhase(payload.phase, payload.startedAtMs);
    if (scenePhase !== previousPhase) lastTs = null;
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.SET_VISIBILITY) {
    const nextVisible = payload.visible !== false;
    if (runtimeVisible === nextVisible) return;
    runtimeVisible = nextVisible;
    cancelLoop();
    lastTs = null;
    if (runtimeVisible) scheduleLoop();
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.SET_TERMINAL_SEQUENCE) {
    setTerminalSequence(payload.sequence || null, {
      clearEntities: payload.clearEntities === true,
    });
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.SET_PROTOCOL_PROGRESS) {
    setProtocolProgress(payload.protocolProgress || null);
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.POINTER_DOWN) {
    handlePointerDown(payload);
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.ACTIVATE_ELIGIBLE_GLOBAL_TARGET) {
    handlePointerDown(payload, { activateEligibleGlobalTarget: true });
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.GLOBAL_STARTER_FEEDBACK) {
    handleGlobalStarterFeedback(payload);
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.SET_THEME) {
    setTheme(payload.themeId);
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.SET_CONFIG) {
    applyConfig(payload.config, payload.protocolProgress || null);
    return;
  }

  if (type === NUDGE_WORKER_MESSAGE.FORCE_SPAWN) {
    const requestId = normalizeSpawnRequestId(payload.requestId);
    const reason = typeof payload.reason === 'string' && payload.reason ? payload.reason : 'spawn';
    const requestedAtMs = Number(payload.requestedAtMs) || 0;
    const rejectReason = resolveSpawnBlockReason(reason, null, payload.spawnHint);
    if (rejectReason) {
      postSpawnStatus('rejected', {
        requestId,
        reason,
        requestedAtMs,
        rejectedAtMs: sampleNow(),
        rejectReason,
      });
      return;
    }
    if (spawnOne({ reason, spawnHint: payload.spawnHint })) {
      const acceptedAtMs = sampleNow();
      postSpawnStatus('accepted', {
        requestId,
        reason,
        requestedAtMs,
        acceptedAtMs,
      });
      queueSpawnRenderAck({
        requestId,
        reason,
        requestedAtMs,
        acceptedAtMs,
      });
    } else {
      postSpawnStatus('rejected', {
        requestId,
        reason,
        requestedAtMs,
        rejectedAtMs: sampleNow(),
        rejectReason: 'spawn_failed',
      });
    }
  }
});
