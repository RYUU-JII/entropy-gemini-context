import { createZenSentinelDeparture } from '../koi/ZenSentinelDeparture.js';
import { ZEN_SENTINEL_SHIKIGAMI_VISIBLE_MS } from '../rendering/ZenSentinelInvocation.js';
import {
  clamp,
  resolveNudgeTheme,
  updateNudgeEntity,
  drawNudgeEntity,
  hitTestNudgeEntity,
  markNudgeEntitySinking,
  isNudgeEntitySinkComplete,
  drawGlobalSentinelInkBurst,
  GLOBAL_SENTINEL_FINAL_HIT_AFTERMATH_MS,
  GLOBAL_SENTINEL_HIT_AFTERMATH_MS,
  resolveGlobalSentinelInkBurstLifetimeMs,
  resolveGlobalSentinelHitAftermathTimeline,
} from '../nudge/index.js';
import {
  buildSentinelSpawnedEntity,
  resolveSentinelSpawnBlockReason,
  speedUpSentinelEntities,
  runSentinelSplitCycle,
} from '../nudge/nudgeGameSpawn.js';
import {
  NUDGE_SCENE_PHASES,
  resolveNudgeScenePresentation,
} from '../nudge/nudgeGameScene.js';
import {
  NUDGE_ENGINE_CLOCK_MODES,
  NUDGE_ENGINE_INPUT_MODES,
  NUDGE_ENGINE_SPAWN_MODES,
  NUDGE_ENGINE_SPLIT_MODES,
  resolveNudgeEngineControl,
} from '../nudge/nudgeGameEngineControl.js';
import {
  isGlobalNudgeProtocolScene,
  resolveNudgeProtocolScene,
  sampleNudgeProtocolSceneSpawnHint,
} from '../protocols/nudgeProtocolScene.js';
import {
  advanceGlobalSentinelSimulationOnStroke,
  createGlobalSentinelSimulationState,
  GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS,
  GLOBAL_SENTINEL_GAME_PHASES,
  GLOBAL_SENTINEL_MIN_INTERVENTION_QUALITY,
  GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
  GLOBAL_SENTINEL_RIFT_APERTURE_OPEN_MS,
  resolveGlobalSentinelMinimumStrokeBudget,
  resolveGlobalSentinelRhythmState,
  resolveGlobalSentinelSimulationPolicy,
  resolveGlobalSentinelSimulationProgress,
} from '../nudge/nudgeGameGlobalSentinelProtocol.js';
import {
  NUDGE_TERMINAL_SEQUENCE_MODES,
  NUDGE_TERMINAL_SEQUENCE_OUTCOMES,
} from '../nudge/nudgeGameTerminalSequence.js';
import {
  drawNudgeProtocolSceneBackground,
  drawNudgeProtocolSceneForeground,
  resolveGlobalSimulationBreakCrackSkeleton,
} from '../rendering/NudgeProtocolSceneBackground.js';
import { resolveGlobalSentinelRepairSite, resolveGlobalSentinelRepairFrame } from '../rendering/GlobalSentinelRepairMaterial.js';
import {
  resolveNudgeRenderBudget,
} from '../rendering/nudgeRenderBudget.js';
import {
  computeNudgeRenderPressureState,
  createNudgeRenderPressureState,
  resolveInitialNudgePressureLevel,
} from '../rendering/nudgeRenderPressureGovernor.js';
import { resolveNudgeLiveEntityLimit } from './nudgeEntityBudget.js';

const SIMULATION_BREAK_SEED_MOD = 0x7fffffff;
const GLOBAL_SENTINEL_SYNC_PRESSURE_LIMIT = 1;
const GLOBAL_SENTINEL_FRACTURE_IMPACT_MS = 340;
const GLOBAL_SENTINEL_FRACTURE_IMPACT_MIN = 0.34;
const GLOBAL_SENTINEL_FRACTURE_IMPACT_MAX = 1;
const GLOBAL_SENTINEL_INK_BURST_CAP = 8;
const GLOBAL_SENTINEL_STARTER_FEEDBACK_MS = 760;
const GLOBAL_SENTINEL_HIT_AFTERMATH_MARGIN_MS = 20;

const GLOBAL_SENTINEL_GAME_PHASE_SET = new Set(Object.values(GLOBAL_SENTINEL_GAME_PHASES));

function clampUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function resolveGlobalSentinelHitAftermathDurationMs(policy, terminalHit = false) {
  const availableWindowMs = Math.max(0, Math.floor(Number(terminalHit
    ? policy?.collapseHoldMs
    : policy?.hitAftermathWindowMs) || 0));
  const maximumDurationMs = terminalHit
    ? GLOBAL_SENTINEL_FINAL_HIT_AFTERMATH_MS
    : GLOBAL_SENTINEL_HIT_AFTERMATH_MS;
  return Math.max(0, Math.min(
    maximumDurationMs,
    availableWindowMs - GLOBAL_SENTINEL_HIT_AFTERMATH_MARGIN_MS,
  ));
}

function isGlobalSentinelFailureResync(sequence = null) {
  return sequence?.outcome === NUDGE_TERMINAL_SEQUENCE_OUTCOMES.FAILURE
    || sequence?.mode === NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC;
}

function hashSimulationBreakSeed(value) {
  const text = String(value ?? '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % SIMULATION_BREAK_SEED_MOD;
}

function normalizeSimulationBreakSeed(value) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) && numeric >= 0
    ? numeric % SIMULATION_BREAK_SEED_MOD
    : null;
}

function resolveExplicitSimulationBreakSeed(nextConfig = null) {
  const nested = nextConfig?.globalSentinel && typeof nextConfig.globalSentinel === 'object'
    ? nextConfig.globalSentinel.simulationBreakSeed
    : undefined;
  return normalizeSimulationBreakSeed(
    nested ?? nextConfig?.simulationBreakSeed ?? nextConfig?.protocol?.simulationBreakSeed,
  );
}

function resolveInitialSimulationBreakSeed(nextConfig = null, protocolStartAt = Date.now()) {
  const explicit = resolveExplicitSimulationBreakSeed(nextConfig);
  if (explicit !== null) return explicit;
  return hashSimulationBreakSeed([
    Number(protocolStartAt) || Date.now(),
    nextConfig?.protocolScope || '',
    nextConfig?.protocolVariant || '',
  ].join(':'));
}

function createGlobalSentinelGameDiagnostics() {
  return {
    globalSentinelGamePhase: '',
    globalSentinelBaseSyncPressure: 0,
    globalSentinelSyncPressure: 0,
    globalSentinelSyncPressureRelief: 0,
    globalSentinelSyncPressureFailureThreshold: GLOBAL_SENTINEL_SYNC_PRESSURE_LIMIT,
    globalSentinelFracture: 0,
    globalSentinelFractureThreshold: resolveGlobalSentinelSimulationPolicy().fractureThreshold,
    globalSentinelIntegrity: 0,
    globalSentinelFractureRepairAmount: 0,
    globalSentinelFractureRepairPressure: 0,
    globalSentinelFractureRepairElapsedMs: 0,
    globalSentinelStableFracture: 0,
    globalSentinelVolatileFracture: 0,
    globalSentinelMissCount: 0,
    globalSentinelRhythmBeatIndex: -1,
    globalSentinelRhythmPhase: '',
    globalSentinelRhythmPhaseProgress: 0,
    globalSentinelRhythmSlowMotion: 0,
    globalSentinelFractureImpact: 0,
    globalSentinelFractureImpactStrength: 0,
    globalSentinelFractureImpactSerial: 0,
    globalSentinelFractureImpactX: 0,
    globalSentinelFractureImpactY: 0,
    globalSentinelHitAftermathActiveCount: 0,
    globalSentinelHitAftermathPhase: '',
    globalSentinelHitAftermathProgress: 0,
    globalSentinelHitAftermathTerminal: false,
    globalSentinelHitAftermathSerial: 0,
    globalSentinelEntryRevealProgress: 0,
    globalSentinelStarterFeedbackSerial: 0,
    globalSentinelStarterFeedbackX: 0,
    globalSentinelStarterFeedbackY: 0,
    globalSentinelLastHitEfficiency: 0,
    globalSentinelLastFractureImpulse: 0,
    globalSentinelLastSyncPressureRelief: 0,
  };
}

function assertGlobalSentinelSpawnBudget(config = null, protocolScene = null) {
  if (!isGlobalNudgeProtocolScene(protocolScene || resolveNudgeProtocolScene(config))) return;
  const maxTotalSpawned = Math.round(Number(config?.maxTotalSpawned));
  const minimumStrokeBudget = resolveGlobalSentinelMinimumStrokeBudget(config);
  if (!Number.isFinite(maxTotalSpawned) || maxTotalSpawned < minimumStrokeBudget) {
    const available = Number.isFinite(maxTotalSpawned) ? maxTotalSpawned : 'missing';
    throw new Error(
      `global_sentinel_spawn_budget_insufficient:${available}:${minimumStrokeBudget}`,
    );
  }
}

function assertGlobalSentinelProtocolProgress(progress = null, protocolScene = null) {
  if (!isGlobalNudgeProtocolScene(protocolScene)) return;
  if (!progress || typeof progress !== 'object') {
    throw new Error('global_sentinel_protocol_progress_missing');
  }
  if (progress?.protocolSystem !== GLOBAL_SENTINEL_PROTOCOL_SYSTEM) {
    throw new Error('global_sentinel_protocol_progress_system_invalid');
  }
  const gamePhase = typeof progress?.gamePhase === 'string' ? progress.gamePhase : '';
  if (!GLOBAL_SENTINEL_GAME_PHASE_SET.has(gamePhase)) {
    throw new Error(`global_sentinel_protocol_progress_phase_invalid:${gamePhase || 'missing'}`);
  }
}

// Context-agnostic nudge swarm: owns the koi entities + canvas rendering, and
// nothing else (no DOM, window, worker, ritual state, or scene CSS — those are
// the host's). The same engine runs on a main-thread canvas or a worker
// OffscreenCanvas. Hosts feed it a ctx, frame deltas, and pointer coords; it
// owns spawn cadence, splits, render pressure, and the rise/sink lifecycle.
// Composes the existing spawn/visual helpers so behaviour
// stays identical across the main and worker generic paths.
export function createNudgeSwarmEngine({
  now: suppliedNow = Date.now,
  random: suppliedRandom = Math.random,
  runtimeNavigator = globalThis?.navigator,
  adaptiveRenderBudgetEnabled = true,
} = {}) {
  const runtimeNow = typeof suppliedNow === 'function' ? suppliedNow : Date.now;
  const runtimeRandom = typeof suppliedRandom === 'function' ? suppliedRandom : Math.random;
  let ctx = null;
  let bounds = { width: 1, height: 1 };
  let config = null;
  let activeTheme = null;
  let activeThemeId = '';
  let protocolScene = null;
  let protocolProgressSnapshot = null;
  let protocolStartAt = 0;
  let simulationBreakSeed = 0;
  let scenePhase = NUDGE_SCENE_PHASES.RITUAL;
  let scenePhaseStartedAtMs = 0;
  let modalOpen = false;
  let terminalSequenceState = null;

  let entities = [];
  let totalSpawned = 0;
  let totalSplitSpawned = 0;
  let entitySerial = 0;
  let splitTimerMs = 0;
  let spawnAccumMs = 0;
  let nextSpawnCadenceMs = 0;
  let globalDormantVisualCount = 0;
  let globalSentinelSimulationState = createGlobalSentinelSimulationState();
  let globalSentinelStartedAtMs = 0;
  let preparedGlobalStarter = null;
  let globalSentinelFracture = 0;
  let globalSentinelFractureUpdatedAtMs = 0;
  let globalSentinelSyncPressureRelief = 0;
  let globalSentinelLastHitAtMs = 0;
  let globalSentinelLastHitEfficiency = 0;
  let globalSentinelLastFractureImpulse = 0;
  let globalSentinelLastSyncPressureRelief = 0;
  let globalSentinelFractureImpactAtMs = 0;
  let globalSentinelFractureImpactStrength = 0;
  let globalSentinelFractureImpactSerial = 0;
  let globalSentinelFractureImpactX = 0;
  let globalSentinelFractureImpactY = 0;
  let globalSentinelCrackOriginX = 0;
  let globalSentinelCrackOriginY = 0;
  let globalSentinelStarterFeedbackAtMs = 0;
  let globalSentinelStarterFeedbackSerial = 0;
  let globalSentinelStarterFeedbackX = 0;
  let globalSentinelStarterFeedbackY = 0;
  let globalSentinelInkBursts = [];
  // Session-scoped presentation reference: the returning sentinel is the exact
  // actor that detached from the starter, not a regenerated silhouette.
  let globalSentinelWitnessBurst = null;
  let globalSentinelFractureRepairAmount = 0;
  let globalSentinelFractureRepairPressure = 0;
  let globalSentinelFractureRepairElapsedMs = 0;
  let globalSentinelRhythmTargetBeatIndex = -1;
  let globalSentinelRhythmTargetEntityId = 0;
  let globalGameDiagnostics = createGlobalSentinelGameDiagnostics();
  let globalProtocolFrameSnapshot = null;
  let globalProtocolFrameSnapshotResolutionCount = 0;
  let engineControlState = null;
  const initialRenderPressureLevel = resolveInitialNudgePressureLevel(runtimeNavigator);
  let renderPressureLevel = initialRenderPressureLevel;
  let renderBudget = resolveNudgeRenderBudget(renderPressureLevel);
  let renderPressureState = createNudgeRenderPressureState({
    pressureLevel: initialRenderPressureLevel,
  });
  let frameCounter = 0;
  let speedScalar = 1;

  const renderOptions = {
    renderBudget,
    protocolScope: 'site',
    protocolVariant: 'site_furin',
    scenePhase: 'ritual',
    protocolIntensity: 0.62,
    terminalSequence: null,
  };

  function hasCtx() {
    return !!ctx;
  }

  function resolveSyncLevel(now) {
    const rampMs = clamp(config?.protocol?.rampMs, 10_000, 180_000);
    return rampMs > 0 ? Math.min(1, (now - protocolStartAt) / rampMs) : 0;
  }

  function syncRenderOptions() {
    const presentation = resolveNudgeScenePresentation({ config, phase: scenePhase });
    protocolScene = presentation.protocolScene || resolveNudgeProtocolScene(config);
    renderOptions.renderBudget = renderBudget;
    renderOptions.protocolScope = presentation.renderOptions.protocolScope;
    renderOptions.protocolVariant = presentation.renderOptions.protocolVariant;
    renderOptions.scenePhase = presentation.renderOptions.scenePhase;
    renderOptions.protocolIntensity = presentation.renderOptions.protocolIntensity;
    renderOptions.terminalSequence = terminalSequenceState;
  }

  function speedUpAll() {
    speedScalar = speedUpSentinelEntities({ activeTheme, config, entities, speedScalar });
  }

  function resolveProtocolVisualProgress(now) {
    const scene = protocolScene || resolveNudgeProtocolScene(config);
    if (isGlobalNudgeProtocolScene(scene)) {
      return resolveGlobalProtocolFrameSnapshot(now).protocolVisualProgress;
    }
    return clampUnit(protocolProgressSnapshot?.returnProgress);
  }

  function resolveGlobalSentinelRiftOpenProgress(now = runtimeNow()) {
    if (scenePhase !== NUDGE_SCENE_PHASES.RIFT) return 0;
    return clampUnit(
      (Number(now) - scenePhaseStartedAtMs) / GLOBAL_SENTINEL_RIFT_APERTURE_OPEN_MS,
    );
  }

  function resolveGlobalFractureImpact(now = runtimeNow()) {
    if (!(globalSentinelFractureImpactAtMs > 0)) return 0;
    const elapsedMs = Math.max(0, now - globalSentinelFractureImpactAtMs);
    if (elapsedMs >= GLOBAL_SENTINEL_FRACTURE_IMPACT_MS) return 0;
    const t = elapsedMs / GLOBAL_SENTINEL_FRACTURE_IMPACT_MS;
    const envelope = (1 - t) ** 2.6;
    return clampUnit(globalSentinelFractureImpactStrength * envelope);
  }

  function resolveGlobalSentinelEntryRevealProgress(now = runtimeNow()) {
    if (!isGlobalSentinelStarted()) return 0;
    const elapsedMs = Math.max(0, now - Number(globalSentinelStartedAtMs));
    return clampUnit(elapsedMs / GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS);
  }

  function resolveGlobalStarterFeedbackProgress(now = runtimeNow()) {
    if (!(globalSentinelStarterFeedbackAtMs > 0)) return 0;
    const elapsedMs = Math.max(0, now - globalSentinelStarterFeedbackAtMs);
    if (elapsedMs >= GLOBAL_SENTINEL_STARTER_FEEDBACK_MS) return 0;
    return 1 - (elapsedMs / GLOBAL_SENTINEL_STARTER_FEEDBACK_MS);
  }

  function pruneGlobalSentinelInkBursts(now = runtimeNow()) {
    if (globalSentinelInkBursts.length === 0) return;
    globalSentinelInkBursts = globalSentinelInkBursts.filter((burst) => (
      now - Number(burst?.startedAtMs) < resolveGlobalSentinelInkBurstLifetimeMs(burst)
    ));
  }

  function resolveGlobalSentinelHitAftermathDiagnostics(now = runtimeNow()) {
    const active = globalSentinelInkBursts
      .filter((burst) => burst?.hitAftermath === true)
      .map((burst) => resolveGlobalSentinelHitAftermathTimeline(burst, now))
      .filter((timeline) => timeline.active === true)
      .sort((left, right) => left.impactSerial - right.impactSerial);
    const latest = active[active.length - 1] || null;
    return {
      globalSentinelHitAftermathActiveCount: active.length,
      globalSentinelHitAftermathPhase: latest?.phase || '',
      globalSentinelHitAftermathProgress: latest?.progress || 0,
      globalSentinelHitAftermathTerminal: latest?.terminal === true,
      globalSentinelHitAftermathSerial: latest?.impactSerial || 0,
    };
  }

  function pushGlobalSentinelInkBurst(entity, now = runtimeNow(), {
    starterActivation = false,
    repairSite = null,
    fractureBefore = null,
    impactX = null,
    impactY = null,
    impactSerial = 0,
    recallX = null,
    recallY = null,
    terminalHit = false,
    durationMs = null,
  } = {}) {
    if (!entity) return;
    pruneGlobalSentinelInkBursts(now);
    const x = Number(entity.x);
    const y = Number(entity.y);
    const size = Math.max(18, Number(entity.size) || 32);
    const heading = entity.koiActor.getSnapshot().heading;
    const burst = {
      x: Number.isFinite(x) ? x : bounds.width * 0.5,
      y: Number.isFinite(y) ? y : bounds.height * 0.5,
      size,
      heading,
      seed: Number(entity.entityId)
        || Number(entity.shadowKoiSeed)
        || globalSentinelFractureImpactSerial + 1,
      startedAtMs: now,
    };
    if (starterActivation === true) {
      const targetX = Number(impactX);
      const targetY = Number(impactY);
      if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
        throw new Error('global_sentinel_starter_activation_impact_invalid');
      }
      Object.assign(burst, {
        starterActivation: true,
        sourceX: burst.x,
        sourceY: burst.y,
        sourceSize: size,
        sourceHeading: heading,
        impactX: targetX,
        impactY: targetY,
        koiActor: entity.koiActor,
        shikigamiActor: entity.koiActor.forkRetainedShikigamiPresentation(),
      });
      burst.departure = createZenSentinelDeparture(burst, bounds);
      globalSentinelWitnessBurst = burst;
    } else {
      const targetX = Number(impactX);
      const targetY = Number(impactY);
      const targetRecallX = Number(recallX);
      const targetRecallY = Number(recallY);
      const serial = Math.round(Number(impactSerial));
      const normalizedDurationMs = Math.floor(Number(durationMs));
      if (![
        targetX,
        targetY,
        targetRecallX,
        targetRecallY,
        normalizedDurationMs,
      ].every(Number.isFinite) || serial <= 0 || normalizedDurationMs < 0
        || !Number.isFinite(fractureBefore) || !repairSite) {
        throw new Error('global_sentinel_hit_aftermath_payload_invalid');
      }
      if (normalizedDurationMs === 0) return;
      Object.assign(burst, {
        hitAftermath: true,
        repairSite,
        fractureBefore,
        repairSource: Object.freeze({ x: burst.x / bounds.width, y: burst.y / bounds.height }),
        sourceX: burst.x,
        sourceY: burst.y,
        sourceSize: size,
        sourceHeading: heading,
        impactX: targetX,
        impactY: targetY,
        recallX: targetRecallX,
        recallY: targetRecallY,
        impactSerial: serial,
        terminalHit: terminalHit === true,
        durationMs: normalizedDurationMs,
        koiActor: entity.koiActor,
      });
    }
    globalSentinelInkBursts.push(burst);
    if (globalSentinelInkBursts.length > GLOBAL_SENTINEL_INK_BURST_CAP) {
      globalSentinelInkBursts = globalSentinelInkBursts.slice(-GLOBAL_SENTINEL_INK_BURST_CAP);
    }
  }

  function resolveGlobalGameDiagnostics(now = runtimeNow()) {
    const scene = protocolScene || resolveNudgeProtocolScene(config);
    if (!isGlobalNudgeProtocolScene(scene)) return createGlobalSentinelGameDiagnostics();
    const progress = resolveGlobalSentinelSimulationProgress(
      globalSentinelSimulationState || createGlobalSentinelSimulationState({ now }),
      config,
      { now },
    );
    const fractureImpact = resolveGlobalFractureImpact(now);
    const hitAftermath = resolveGlobalSentinelHitAftermathDiagnostics(now);
    globalSentinelFracture = clampUnit(progress.fracture);
    globalSentinelSyncPressureRelief = clampUnit(progress.syncPressureRelief);
    globalSentinelFractureUpdatedAtMs = Number(progress.fractureUpdatedAtMs) || globalSentinelFractureUpdatedAtMs;
    globalSentinelFractureRepairAmount = Math.max(0, Number(progress.fractureRepairAmount) || 0);
    globalSentinelFractureRepairPressure = Math.max(0, Number(progress.fractureRepairPressure) || 0);
    globalSentinelFractureRepairElapsedMs = Math.max(0, Number(progress.fractureRepairElapsedMs) || 0);
    globalSentinelLastHitEfficiency = clampUnit(progress.lastHitEfficiency);
    globalSentinelLastFractureImpulse = clampUnit(progress.lastFractureImpulse);
    globalSentinelLastSyncPressureRelief = clampUnit(progress.lastSyncPressureRelief);
    return {
      globalSentinelGamePhase: progress.gamePhase || '',
      globalSentinelBaseSyncPressure: Math.max(0, Number(progress.baseSyncPressure) || 0),
      globalSentinelSyncPressure: clampUnit(progress.syncPressure),
      globalSentinelSyncPressureRelief: globalSentinelSyncPressureRelief,
      globalSentinelSyncPressureFailureThreshold: Math.max(
        0,
        Number(progress.syncPressureFailureThreshold) || GLOBAL_SENTINEL_SYNC_PRESSURE_LIMIT,
      ),
      globalSentinelFracture: globalSentinelFracture,
      globalSentinelFractureThreshold: clampUnit(progress.fractureThreshold),
      globalSentinelIntegrity: clampUnit(progress.sentinelIntegrity),
      globalSentinelFractureRepairAmount,
      globalSentinelFractureRepairPressure,
      globalSentinelFractureRepairElapsedMs,
      globalSentinelFractureRepairBeatIndex: progress.fractureRepairBeatIndex,
      globalSentinelStableFracture: clampUnit(progress.stableFracture),
      globalSentinelVolatileFracture: clampUnit(progress.volatileFracture),
      globalSentinelMissCount: Math.max(0, Math.round(Number(progress.missCount) || 0)),
      globalSentinelRhythmBeatIndex: Number.isFinite(Number(progress.rhythmBeatIndex))
        ? Math.round(Number(progress.rhythmBeatIndex))
        : -1,
      globalSentinelRhythmPhase: progress.rhythmPhase || '',
      globalSentinelRhythmPhaseProgress: clampUnit(progress.rhythmPhaseProgress),
      globalSentinelRhythmSlowMotion: clampUnit(progress.rhythmSlowMotion),
      globalSentinelRhythmActIndex: progress.rhythmActIndex,
      globalSentinelRhythmActId: progress.rhythmActId,
      globalSentinelRhythmActProgress: progress.rhythmActProgress,
      globalSentinelRhythmAttemptIndex: progress.rhythmAttemptIndex,
      globalSentinelRhythmRepairPressure: progress.rhythmRepairPressure,
      globalSentinelRhythmPhaseRemainingMs: progress.rhythmPhaseRemainingMs,
      globalSentinelFractureImpact: fractureImpact,
      globalSentinelFractureImpactStrength: globalSentinelFractureImpactStrength,
      globalSentinelFractureImpactSerial,
      globalSentinelFractureImpactX,
      globalSentinelFractureImpactY,
      ...hitAftermath,
      globalSentinelEntryRevealProgress: resolveGlobalSentinelEntryRevealProgress(now),
      globalSentinelStarterFeedbackSerial,
      globalSentinelStarterFeedbackX,
      globalSentinelStarterFeedbackY,
      globalSentinelLastHitEfficiency,
      globalSentinelLastFractureImpulse,
      globalSentinelLastSyncPressureRelief,
    };
  }

  function invalidateGlobalProtocolFrameSnapshot() {
    globalProtocolFrameSnapshot = null;
  }

  function resolveGlobalProtocolFrameSnapshot(now = runtimeNow()) {
    const timeMs = Number(now);
    if (globalProtocolFrameSnapshot
      && Object.is(globalProtocolFrameSnapshot.timeMs, timeMs)) {
      return globalProtocolFrameSnapshot;
    }
    globalGameDiagnostics = resolveGlobalGameDiagnostics(now);
    globalProtocolFrameSnapshotResolutionCount += 1;
    globalProtocolFrameSnapshot = Object.freeze({
      diagnostics: globalGameDiagnostics,
      protocolVisualProgress: globalGameDiagnostics.globalSentinelFracture,
      timeMs,
    });
    return globalProtocolFrameSnapshot;
  }

  function syncGlobalGameDiagnostics(now = runtimeNow()) {
    if (!protocolScene && !config) {
      invalidateGlobalProtocolFrameSnapshot();
      globalGameDiagnostics = createGlobalSentinelGameDiagnostics();
      return globalGameDiagnostics;
    }
    const scene = protocolScene || resolveNudgeProtocolScene(config);
    if (isGlobalNudgeProtocolScene(scene)) {
      return resolveGlobalProtocolFrameSnapshot(now).diagnostics;
    }
    globalGameDiagnostics = resolveGlobalGameDiagnostics(now);
    return globalGameDiagnostics;
  }

  function syncEngineControl(now = runtimeNow()) {
    if (!config || !protocolScene) {
      engineControlState = null;
      return null;
    }
    const scene = protocolScene || resolveNudgeProtocolScene(config);
    assertGlobalSentinelProtocolProgress(protocolProgressSnapshot, scene);
    engineControlState = resolveNudgeEngineControl({
      scenePhase,
      protocolScene: scene,
      protocolProgress: protocolProgressSnapshot,
      modalOpen,
      terminalSequence: terminalSequenceState,
      globalEntryRevealActive: isGlobalNudgeProtocolScene(scene)
        && isGlobalSentinelStarted()
        && resolveGlobalSentinelEntryRevealProgress(now) < 1,
    });
    return engineControlState;
  }

  function randomBetween(min, max) {
    return min + runtimeRandom() * Math.max(0, max - min);
  }

  function isGlobalProtocolScene() {
    if (!protocolScene && !config) return false;
    return isGlobalNudgeProtocolScene(protocolScene || resolveNudgeProtocolScene(config));
  }

  function resolveEngineLiveEntityLimit({ nextTotalSpawned = totalSpawned, nextEntitiesLength = entities.length } = {}) {
    return resolveNudgeLiveEntityLimit(config, nextTotalSpawned, nextEntitiesLength);
  }

  function isGlobalSentinelStarted() {
    return Number(globalSentinelStartedAtMs) > 0;
  }

  function isGlobalStarterSpawnRequest({ parent = null, spawnHint = null } = {}) {
    return !parent
      && !spawnHint
      && isGlobalProtocolScene()
      && !isGlobalSentinelStarted()
      && totalSpawned === 0;
  }

  function isInitialSpawnRequest({ parent = null, spawnHint = null } = {}) {
    return !parent && !spawnHint && totalSpawned === 0;
  }

  function resolveEngineControlSpawnBlockReason({
    reason = 'spawn',
    parent = null,
    spawnHint = null,
    now = runtimeNow(),
  } = {}) {
    const control = syncEngineControl(now);
    if (!control) return 'engine_control:not_initialized';
    if (control.spawnMode === NUDGE_ENGINE_SPAWN_MODES.NONE) {
      return `engine_control:${control.blockReason || 'spawn_none'}`;
    }
    if (control.spawnMode === NUDGE_ENGINE_SPAWN_MODES.REPAIR_BEAT) {
      const rhythm = resolveGlobalSentinelRhythmState(globalSentinelSimulationState, config, { now });
      if (parent || entities.length > 0 || !rhythm.active || rhythm.consumed) {
        return 'engine_control:repair_beat_closed';
      }
    }
    if (
      control.spawnMode === NUDGE_ENGINE_SPAWN_MODES.INITIAL_ONLY
      && !isInitialSpawnRequest({ parent, spawnHint })
    ) {
      return reason === 'split'
        ? 'engine_control:initial_only_split'
        : 'engine_control:initial_only';
    }
    if (
      control.spawnMode === NUDGE_ENGINE_SPAWN_MODES.STARTER_ONLY
      && !isGlobalStarterSpawnRequest({ parent, spawnHint })
    ) {
      return reason === 'split'
        ? 'engine_control:starter_only_split'
        : 'engine_control:starter_only';
    }
    const maxConcurrentCount = Math.max(0, Math.round(Number(protocolScene?.spawnPolicy?.maxConcurrentCount) || 0));
    if (
      maxConcurrentCount > 0
      && !parent
      && !spawnHint
      && entities.filter((entity) => entity).length >= maxConcurrentCount
    ) {
      return 'engine_control:max_concurrent';
    }
    return '';
  }

  function resolveGlobalSentinelClockStart(now = runtimeNow()) {
    return isGlobalSentinelStarted() ? Number(globalSentinelStartedAtMs) : now;
  }

  function resolveGlobalSentinelCrackOriginPoint() {
    if (!isGlobalSentinelStarted()) return null;
    return {
      x: clampUnit(globalSentinelCrackOriginX),
      y: clampUnit(globalSentinelCrackOriginY),
    };
  }

  function resolveGlobalSentinelStarterPoint() {
    const starter = entities.find((entity) => entity?.globalSentinelStartGate === true && !entity.sinking)
      || entities.find((entity) => entity && !entity.sinking)
      || null;
    if (!starter) return null;
    return {
      x: clampUnit((Number(starter.x) || bounds.width * 0.5) / Math.max(1, bounds.width)),
      y: clampUnit((Number(starter.y) || bounds.height * 0.5) / Math.max(1, bounds.height)),
    };
  }

  function pulseGlobalStarterFeedback({
    x,
    y,
    now = runtimeNow(),
  } = {}) {
    if (!isGlobalProtocolScene() || isGlobalSentinelStarted()) return false;
    const point = Number.isFinite(Number(x)) && Number.isFinite(Number(y))
      ? {
        x: clampUnit(Number(x) / Math.max(1, bounds.width)),
        y: clampUnit(Number(y) / Math.max(1, bounds.height)),
      }
      : (resolveGlobalSentinelStarterPoint() || { x: 0.5, y: 0.48 });
    invalidateGlobalProtocolFrameSnapshot();
    globalSentinelStarterFeedbackAtMs = now;
    globalSentinelStarterFeedbackSerial += 1;
    globalSentinelStarterFeedbackX = point.x;
    globalSentinelStarterFeedbackY = point.y;
    for (const entity of entities) {
      if (!entity || entity.sinking || entity.globalSentinelStartGate !== true) continue;
      entity.globalSentinelStarterFeedbackAtMs = now;
      entity.globalSentinelStarterFeedbackSerial = globalSentinelStarterFeedbackSerial;
      entity.globalSentinelStarterFeedbackX = point.x;
      entity.globalSentinelStarterFeedbackY = point.y;
    }
    syncGlobalGameDiagnostics(now);
    return true;
  }

  function resolveGlobalSentinelStarterSpawnHint() {
    return {
      mode: 'manual',
      xPercent: randomBetween(42, 58),
      yPercent: randomBetween(36, 58),
      heading: randomBetween(-0.9, 0.9),
    };
  }

  function initializeGlobalSentinelEntityState(entity, {
    now = runtimeNow(),
    startGate = false,
  } = {}) {
    if (!entity || !isGlobalProtocolScene()) return;
    entity.globalSentinelSpawnedAtMs = now;
    entity.globalSentinelStartGate = startGate === true;
    if (entity.globalSentinelStartGate) {
      entity.globalSentinelVulnerabilityOffsetMs = 0;
      entity.globalSentinelVulnerable = true;
      entity.globalSentinelVulnerabilityProgress = 0.5;
      entity.globalSentinelVulnerabilityTelegraphProgress = 1;
      entity.globalSentinelVulnerabilityCycleProgress = 0;
      entity.globalSentinelNextVulnerableInMs = 0;
      entity.globalSentinelRhythmBeatIndex = -1;
      entity.globalSentinelRhythmPhase = 'starter';
      entity.globalSentinelRhythmSlowMotion = 0;
      return;
    }
    entity.globalSentinelVulnerable = false;
    entity.globalSentinelVulnerabilityProgress = 0;
    entity.globalSentinelVulnerabilityTelegraphProgress = 0;
    entity.globalSentinelVulnerabilityCycleProgress = 0;
    entity.globalSentinelNextVulnerableInMs = 0;
    entity.globalSentinelRhythmBeatIndex = -1;
    entity.globalSentinelRhythmPhase = '';
    entity.globalSentinelRhythmSlowMotion = 0;
  }

  function syncGlobalSentinelEntityVulnerability(now = runtimeNow()) {
    if (!isGlobalProtocolScene()) return 0;
    let vulnerableCount = 0;
    for (const entity of entities) {
      if (!entity || entity.sinking) continue;
      if (!isGlobalSentinelStarted()) {
        if (!(Number(entity.globalSentinelSpawnedAtMs) > 0) || entity.globalSentinelStartGate !== true) {
          initializeGlobalSentinelEntityState(entity, { now, startGate: true });
        }
        entity.globalSentinelVulnerable = true;
        entity.globalSentinelVulnerabilityProgress = 0.5;
        entity.globalSentinelVulnerabilityTelegraphProgress = 1;
        entity.globalSentinelVulnerabilityCycleProgress = 0;
        entity.globalSentinelNextVulnerableInMs = 0;
        entity.globalSentinelRhythmBeatIndex = -1;
        entity.globalSentinelRhythmPhase = 'starter';
        entity.globalSentinelRhythmSlowMotion = 0;
        vulnerableCount += 1;
        continue;
      }
      if (!(Number(entity.globalSentinelSpawnedAtMs) > 0)) {
        initializeGlobalSentinelEntityState(entity, { now: resolveGlobalSentinelClockStart(now) });
      }
      entity.globalSentinelVulnerable = false;
      entity.globalSentinelVulnerabilityProgress = 0;
      entity.globalSentinelVulnerabilityTelegraphProgress = 0;
      entity.globalSentinelVulnerabilityCycleProgress = 0;
      entity.globalSentinelNextVulnerableInMs = 0;
      entity.globalSentinelRhythmBeatIndex = -1;
      entity.globalSentinelRhythmPhase = '';
      entity.globalSentinelRhythmSlowMotion = 0;
    }
    const rhythm = resolveGlobalSentinelRhythmState(
      globalSentinelSimulationState,
      config,
      { now },
    );
    const liveEntities = entities
      .filter((entity) => entity && !entity.sinking)
      .sort((left, right) => Number(left.entityId) - Number(right.entityId));
    if (rhythm.beatIndex !== globalSentinelRhythmTargetBeatIndex) {
      globalSentinelRhythmTargetBeatIndex = rhythm.beatIndex;
      globalSentinelRhythmTargetEntityId = rhythm.active && liveEntities.length > 0
        ? Number(liveEntities[rhythm.beatIndex % liveEntities.length].entityId) || 0
        : 0;
    } else if (
      rhythm.active
      && globalSentinelRhythmTargetEntityId <= 0
      && liveEntities.length > 0
    ) {
      globalSentinelRhythmTargetEntityId = Number(
        liveEntities[rhythm.beatIndex % liveEntities.length].entityId,
      ) || 0;
    }
    const target = liveEntities.find(
      (entity) => Number(entity.entityId) === globalSentinelRhythmTargetEntityId,
    ) || null;
    if (!target || !rhythm.active || rhythm.consumed) return 0;
    target.globalSentinelVulnerable = rhythm.phase === 'active';
    target.globalSentinelVulnerabilityProgress = rhythm.vulnerabilityProgress;
    target.globalSentinelVulnerabilityTelegraphProgress = rhythm.telegraphProgress;
    target.globalSentinelVulnerabilityCycleProgress = rhythm.phaseProgress;
    target.globalSentinelNextVulnerableInMs = Math.max(
      0,
      Number(rhythm.activeAtMs) - Number(now),
    );
    target.globalSentinelRhythmBeatIndex = rhythm.beatIndex;
    target.globalSentinelRhythmPhase = rhythm.phase;
    target.globalSentinelRhythmSlowMotion = rhythm.slowMotion;
    target.globalSentinelActIndex = rhythm.actIndex;
    target.globalSentinelActId = rhythm.actId;
    target.globalSentinelRepairPressure = rhythm.repairPressure;
    if (target.globalSentinelVulnerable) vulnerableCount = 1;
    return vulnerableCount;
  }

  function resolveGlobalSentinelInterventionQuality(entity = null) {
    if (!entity?.globalSentinelVulnerable) return 0;
    const progress = clampUnit(entity.globalSentinelVulnerabilityProgress);
    const centered = 1 - Math.abs(progress - 0.5) * 2;
    return clamp(
      GLOBAL_SENTINEL_MIN_INTERVENTION_QUALITY
        + centered * (1 - GLOBAL_SENTINEL_MIN_INTERVENTION_QUALITY),
      GLOBAL_SENTINEL_MIN_INTERVENTION_QUALITY,
      1,
    );
  }

  function resolveNextSpawnCadenceMs(syncPressure = 0) {
    const policy = (protocolScene || resolveNudgeProtocolScene(config))?.spawnPolicy || {};
    const pressure = clampUnit(syncPressure);
    const cadenceBoost = clamp(Number(policy.pressureCadenceBoost) || 0, 0, 0.75);
    const applyPressure = (cadenceMs) => Math.max(
      200,
      Math.round(cadenceMs * (1 - pressure * cadenceBoost)),
    );
    const fixedCadence = Math.max(200, Math.round(Number(policy.cadenceMs ?? config?.spawnIntervalMs) || 200));
    const initialCount = Math.max(1, Math.round(Number(policy.initialSchoolCount) || 1));
    const firstCadence = Number(policy.firstCadenceMs);
    if (totalSpawned <= initialCount && Number.isFinite(firstCadence) && firstCadence > 0) {
      return applyPressure(Math.max(200, Math.round(firstCadence)));
    }
    const lateAfterCount = Math.max(1, Math.round(Number(policy.lateCadenceAfterCount) || Number.POSITIVE_INFINITY));
    const lateMin = Number(policy.lateCadenceMinMs);
    const lateMax = Number(policy.lateCadenceMaxMs);
    if (totalSpawned >= lateAfterCount && Number.isFinite(lateMin) && Number.isFinite(lateMax)) {
      const min = Math.max(200, Math.min(lateMin, lateMax));
      const max = Math.max(min, Math.max(lateMin, lateMax));
      return applyPressure(Math.round(randomBetween(min, max)));
    }
    const minCadence = Number(policy.cadenceMinMs);
    const maxCadence = Number(policy.cadenceMaxMs);
    if (Number.isFinite(minCadence) && Number.isFinite(maxCadence)) {
      const min = Math.max(200, Math.min(minCadence, maxCadence));
      const max = Math.max(min, Math.max(minCadence, maxCadence));
      return applyPressure(Math.round(randomBetween(min, max)));
    }
    return applyPressure(fixedCadence);
  }

  function enforceEntityBudget() {
    const liveCap = resolveEngineLiveEntityLimit();
    if (entities.length <= liveCap) return;
    entities.sort((a, b) => (Number(a?.splitGeneration) || 0) - (Number(b?.splitGeneration) || 0));
    while (entities.length > liveCap) entities.pop();
  }

  function setRenderPressureLevel(nextPressureLevel) {
    if (nextPressureLevel === renderPressureLevel) return;
    renderPressureLevel = nextPressureLevel;
    renderBudget = resolveNudgeRenderBudget(renderPressureLevel);
    syncRenderOptions();
  }

  function observeRenderHealth(sample) {
    const previousPressureLevel = renderPressureLevel;
    renderPressureState = computeNudgeRenderPressureState({
      enabled: adaptiveRenderBudgetEnabled,
      sample,
      state: renderPressureState,
    });
    setRenderPressureLevel(renderPressureState.pressureLevel);
    return Object.freeze({
      pressureChanged: previousPressureLevel !== renderPressureLevel,
      pressureLevel: renderPressureLevel,
      renderBudget,
      frameIntervalEmaMs: renderPressureState.frameIntervalEmaMs,
      workTimeEmaMs: renderPressureState.workTimeEmaMs,
    });
  }

  function spawn({
    reason = 'spawn',
    parent = null,
    spawnHint = null,
    syncLevel = 0,
  } = {}) {
    const controlBlockReason = resolveEngineControlSpawnBlockReason({
      reason,
      parent,
      spawnHint,
    });
    if (controlBlockReason) return false;
    const blockReason = resolveSentinelSpawnBlockReason({
      reason,
      parent,
      hasCanvasContext: hasCtx(),
      entities,
      config,
      totalSpawned,
      totalSplitSpawned,
      resolveLiveEntityLimit: () => resolveEngineLiveEntityLimit(),
    });
    if (blockReason) return false;
    const useStarterSpawn = isGlobalStarterSpawnRequest({ parent, spawnHint });
    let protocolSpawnHint = spawnHint;
    if (useStarterSpawn) {
      protocolSpawnHint = resolveGlobalSentinelStarterSpawnHint();
    } else if (!parent && !spawnHint) {
      protocolSpawnHint = sampleNudgeProtocolSceneSpawnHint(protocolScene || resolveNudgeProtocolScene(config), {
        spawnIndex: totalSpawned,
        liveCount: entities.length,
        syncLevel,

        random: runtimeRandom,
      });
    }
    const entity = buildSentinelSpawnedEntity({
      parent,
      spawnHint: protocolSpawnHint,
      activeTheme,
      activeThemeId,
      bounds,
      config,
      protocolScene,
      nextEntitySerial: entitySerial + 1,
    });
    entitySerial = Number(entity?.entityId) || entitySerial;
    entities.push(entity);
    totalSpawned += 1;
    const spawnedAtMs = runtimeNow();
    initializeGlobalSentinelEntityState(entity, {
      now: spawnedAtMs,
      startGate: useStarterSpawn,
    });

    if (reason === 'split') totalSplitSpawned += 1;
    return true;
  }

  function resolveInitialSchoolSize() {
    const scene = protocolScene || resolveNudgeProtocolScene(config);
    if (!isGlobalNudgeProtocolScene(scene)) throw new Error('site_furin_has_no_swarm');
    if (!isGlobalSentinelStarted()) return 1;
    const configured = Number(scene.spawnPolicy.initialSchoolCount);
    return Math.max(1, Math.min(configured, resolveEngineLiveEntityLimit()));
  }

  function syncEntityFromKoiActorSnapshot(entity) {
    const snapshot = entity?.koiActor?.getSnapshot?.();
    if (!snapshot) return;
    entity.x = snapshot.x;
    entity.y = snapshot.y;
    entity.vx = snapshot.vx;
    entity.vy = snapshot.vy;
    entity.size = snapshot.size;
    entity.hitRadius = snapshot.hitRadius;
    entity.sizeRatio = snapshot.sizeRatio;
    entity.speedRatio = snapshot.speedRatio;
    entity.splitGeneration = snapshot.splitGeneration;
    entity.baseSpeed = Math.hypot(Number(snapshot.vx) || 0, Number(snapshot.vy) || 0);
  }

  function ensureInitialSchool() {
    syncEngineControl(runtimeNow());
    if (entities.length > 0) return;
    const targetCount = resolveInitialSchoolSize();
    while (entities.length < targetCount) {
      if (!spawn({ reason: 'spawn' })) break;
    }

  }

  function handlePointer({
    x,
    y,
    commit = true,
    semanticActivation = false,
    starterPhase = '',
  } = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { hit: false };
    const scene = protocolScene || resolveNudgeProtocolScene(config);
    const globalInteraction = scene?.interaction?.hitMode === 'remove_and_dormant';
    const now = runtimeNow();
    const control = syncEngineControl(now);
    if (!control) return { hit: false };
    if (control.inputMode === NUDGE_ENGINE_INPUT_MODES.NONE) return { hit: false };
    const awaitingGlobalStart = globalInteraction
      && control.inputMode === NUDGE_ENGINE_INPUT_MODES.STARTER;
    if (globalInteraction && !(
      control.inputMode === NUDGE_ENGINE_INPUT_MODES.STARTER
      || control.inputMode === NUDGE_ENGINE_INPUT_MODES.VULNERABLE_ENTITIES
    )) {
      return { hit: false };
    }
    if (starterPhase === 'commit') {
      if (!awaitingGlobalStart || !preparedGlobalStarter) {
        return { hit: false, rejectReason: 'global_starter_reservation_missing' };
      }
      x = preparedGlobalStarter.xRatio * bounds.width;
      y = preparedGlobalStarter.yRatio * bounds.height;
    }
    if (!globalInteraction) return { hit: false };
    if (globalInteraction) {
      syncGlobalSentinelEntityVulnerability(now);
    }
    let targetIndex = -1;
    let targetDistance = Number.POSITIVE_INFINITY;
    for (let i = entities.length - 1; i >= 0; i -= 1) {
      const entity = entities[i];
      if (starterPhase === 'commit'
        ? entity.entityId === preparedGlobalStarter.targetId
        : hitTestNudgeEntity(entity, x, y)) {
        const dx = (Number(entity?.x) || 0) - x;
        const dy = (Number(entity?.y) || 0) - y;
        const distance = Math.hypot(dx, dy);
        const vulnerable = globalInteraction
          ? (
            awaitingGlobalStart
            || semanticActivation === true
            || entity?.globalSentinelVulnerable === true
          )
          : false;
        if (vulnerable && distance < targetDistance) {
          targetDistance = distance;
          targetIndex = i;
        }
      }
    }
    if (targetIndex < 0) return { hit: false };
    if (starterPhase === 'prepare') {
      if (!awaitingGlobalStart || preparedGlobalStarter) {
        return { hit: false, rejectReason: 'global_starter_reservation_closed' };
      }
      preparedGlobalStarter = Object.freeze({
        targetId: entities[targetIndex].entityId,
        xRatio: clampUnit(x / bounds.width),
        yRatio: clampUnit(y / bounds.height),
      });
      pulseGlobalStarterFeedback({ x, y, eventType: 'starter_press' });
      return { hit: true, committed: false, wasGlobalAwaitingStart: true, x, y, ...preparedGlobalStarter };
    }
    if (commit === false) {
      return {
        hit: true,
        committed: false,
        targetId: entities[targetIndex]?.entityId || null,
      };
    }
    if (globalInteraction) {
      invalidateGlobalProtocolFrameSnapshot();
      const target = entities[targetIndex];
      if (starterPhase === 'commit') {
        // The ink source and first crack share the post-fullscreen coordinate.
        target.koiActor.reanchorGlobalStarterPose(x, y, bounds);
        syncEntityFromKoiActorSnapshot(target);
        preparedGlobalStarter = null;
      }
      const targetId = target?.entityId || null;
      const acceptedXRatio = clampUnit(x / Math.max(1, bounds.width));
      const acceptedYRatio = clampUnit(y / Math.max(1, bounds.height));
      if (awaitingGlobalStart) {
        globalSentinelStartedAtMs = now;
        globalSentinelFractureUpdatedAtMs = now;
        globalSentinelCrackOriginX = acceptedXRatio;
        globalSentinelCrackOriginY = acceptedYRatio;
      }
      const interventionQuality = awaitingGlobalStart || semanticActivation === true
        ? 1
        : resolveGlobalSentinelInterventionQuality(target);
      if (!(interventionQuality > 0)) return { hit: false };
      const policy = resolveGlobalSentinelSimulationPolicy(config);
      const hitEfficiency = interventionQuality;
      const fractureBefore = awaitingGlobalStart ? 0 : resolveGlobalSentinelSimulationProgress(
        globalSentinelSimulationState, config, { now },
      ).fracture;
      const repairSite = awaitingGlobalStart ? null : resolveGlobalSentinelRepairSite(
        resolveGlobalSimulationBreakCrackSkeleton({ seed: simulationBreakSeed, impactPoint: resolveGlobalSentinelCrackOriginPoint() }),
        resolveGlobalSentinelRhythmState(globalSentinelSimulationState, config, { now }).beatIndex,
      );
      globalSentinelSimulationState = advanceGlobalSentinelSimulationOnStroke(
        globalSentinelSimulationState || createGlobalSentinelSimulationState({ now }),
        config,
        { now, hitEfficiency },
      );
      const fractureImpulse = clampUnit(globalSentinelSimulationState.lastFractureImpulse);
      const syncPressureReliefImpulse = clampUnit(globalSentinelSimulationState.lastSyncPressureRelief);
      globalSentinelFracture = clampUnit(globalSentinelSimulationState.fracture);
      globalSentinelFractureUpdatedAtMs = Number(globalSentinelSimulationState.fractureUpdatedAtMs) || now;
      globalSentinelSyncPressureRelief = clampUnit(globalSentinelSimulationState.syncPressureRelief);
      globalSentinelLastHitAtMs = now;
      globalSentinelLastHitEfficiency = clampUnit(globalSentinelSimulationState.lastHitEfficiency);
      globalSentinelLastFractureImpulse = fractureImpulse;
      globalSentinelLastSyncPressureRelief = syncPressureReliefImpulse;
      globalSentinelFractureImpactAtMs = now;
      globalSentinelFractureImpactStrength = clamp(
        GLOBAL_SENTINEL_FRACTURE_IMPACT_MIN + fractureImpulse * 2.2 + hitEfficiency * 0.18,
        GLOBAL_SENTINEL_FRACTURE_IMPACT_MIN,
        GLOBAL_SENTINEL_FRACTURE_IMPACT_MAX,
      );
      globalSentinelFractureImpactSerial += 1;
      globalSentinelFractureImpactX = acceptedXRatio;
      globalSentinelFractureImpactY = acceptedYRatio;
      const acceptedProgress = resolveGlobalSentinelSimulationProgress(
        globalSentinelSimulationState,
        config,
        { now },
      );
      const terminalHit = acceptedProgress.gamePhase === GLOBAL_SENTINEL_GAME_PHASES.FRACTURE_OPEN;
      const aftermathDurationMs = resolveGlobalSentinelHitAftermathDurationMs(policy, terminalHit);
      if (terminalHit) {
        globalSentinelInkBursts = globalSentinelInkBursts.filter(
          (burst) => burst?.hitAftermath !== true,
        );
      }
      pushGlobalSentinelInkBurst(target, now, awaitingGlobalStart
        ? {
          starterActivation: true,
          impactX: x,
          impactY: y,
        }
        : {
          impactX: x,
          impactY: y,
          impactSerial: globalSentinelFractureImpactSerial,
          repairSite,
          fractureBefore,
          recallX: globalSentinelCrackOriginX * Math.max(1, bounds.width),
          recallY: globalSentinelCrackOriginY * Math.max(1, bounds.height),
          terminalHit,
          durationMs: aftermathDurationMs,
        });
      entities.splice(targetIndex, 1);
      if (awaitingGlobalStart) {
        globalSentinelStarterFeedbackAtMs = 0;
      }
      const targetCount = Math.max(
        1,
        Math.round(Number(scene?.statePolicy?.targetCount) || policy.targetDormantCount),
      );
      globalDormantVisualCount = Math.min(
        targetCount,
        Math.max(0, Number(globalSentinelSimulationState.dormantCount) || 0),
      );
      syncGlobalGameDiagnostics(now);
      syncEngineControl(now);
      return {
        hit: true,
        committed: true,
        targetId,
        x,
        y,
        xRatio: acceptedXRatio,
        yRatio: acceptedYRatio,
        acceptedAtMs: now,
        hitEfficiency,
        wasGlobalAwaitingStart: awaitingGlobalStart,
        protocolOutcome: {
          protocolSystem: GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
          ...acceptedProgress,
          fractureImpactSerial: globalSentinelFractureImpactSerial,
        },
      };
    } else {
      return {
        hit: true,
        committed: true,
        targetId: entities[targetIndex]?.entityId || null,
      };
    }
    return { hit: true };
  }

  function handleEligibleGlobalTarget({ commit = true, starterPhase = '' } = {}) {
    const now = runtimeNow();
    const control = syncEngineControl(now);
    const globalInteraction = isGlobalProtocolScene();
    if (!globalInteraction || !control || control.inputMode === NUDGE_ENGINE_INPUT_MODES.NONE) {
      return { hit: false };
    }
    const awaitingGlobalStart = control.inputMode === NUDGE_ENGINE_INPUT_MODES.STARTER;
    if (!awaitingGlobalStart && control.inputMode !== NUDGE_ENGINE_INPUT_MODES.VULNERABLE_ENTITIES) {
      return { hit: false };
    }
    syncGlobalSentinelEntityVulnerability(now);
    let target = awaitingGlobalStart
      ? (entities.find((entity) => !entity?.sinking) || null)
      : (entities.find((entity) => (
        !entity?.sinking
        && Number(entity?.entityId) === globalSentinelRhythmTargetEntityId
      )) || null);
    if (!target && !awaitingGlobalStart && spawn({ reason: 'spawn' })) {
      syncGlobalSentinelEntityVulnerability(now);
      target = entities.find((entity) => (
        !entity?.sinking
        && Number(entity?.entityId) === globalSentinelRhythmTargetEntityId
      )) || null;
    }
    if (!target) {
      return {
        hit: false,
        rejectReason: awaitingGlobalStart
          ? 'global_semantic_target_unavailable'
          : 'global_semantic_rhythm_closed',
      };
    }
    return handlePointer({
      x: Number(target.x),
      y: Number(target.y),
      commit,
      semanticActivation: true,
      starterPhase,
    });
  }

  function update(dt, now) {
    if (!hasCtx()) return;
    frameCounter += 1;

    const syncLevel = resolveSyncLevel(now);
    const scene = protocolScene || resolveNudgeProtocolScene(config);
    const globalFrameSnapshot = isGlobalNudgeProtocolScene(scene)
      ? resolveGlobalProtocolFrameSnapshot(now)
      : null;
    const globalDiagnostics = globalFrameSnapshot
      ? globalFrameSnapshot.diagnostics
      : syncGlobalGameDiagnostics(now);
    const protocolVisualProgress = globalFrameSnapshot
      ? globalFrameSnapshot.protocolVisualProgress
      : resolveProtocolVisualProgress(now);
    const control = syncEngineControl(now);
    if (!control) return;
    if (control.inputMode !== NUDGE_ENGINE_INPUT_MODES.NONE) {
      syncGlobalSentinelEntityVulnerability(now);
    }
    const protocolPressure = isGlobalNudgeProtocolScene(scene)
      ? globalDiagnostics.globalSentinelSyncPressure
      : syncLevel;

    if (globalSentinelWitnessBurst?.shikigamiActor) {
      const elapsedMs = Math.max(0, now - globalSentinelWitnessBurst.startedAtMs);
      if (elapsedMs >= ZEN_SENTINEL_SHIKIGAMI_VISIBLE_MS || terminalSequenceState
          || scenePhase !== NUDGE_SCENE_PHASES.RITUAL) {
        globalSentinelWitnessBurst.shikigamiActor = null;
      } else if (!modalOpen) {
        globalSentinelWitnessBurst.shikigamiActor.advanceRetainedShikigamiPresentation(dt, bounds, {
          renderBudget, timeMs: now, reducedMotion: config.reducedMotion === true,
        });
      }
    }
    if (globalSentinelWitnessBurst && isGlobalNudgeProtocolScene(scene) && scenePhase === NUDGE_SCENE_PHASES.RITUAL) {
      globalSentinelWitnessBurst.koiActor.advanceRetainedPresentation(dt, bounds, {
        renderBudget, timeMs: now,
        departure: globalSentinelWitnessBurst.departure,
        elapsedMs: Math.max(0, now - globalSentinelWitnessBurst.startedAtMs),
        reducedMotion: config.reducedMotion === true,
      });
    }

    if (control.spawnMode === NUDGE_ENGINE_SPAWN_MODES.REPAIR_BEAT) {
      const rhythm = resolveGlobalSentinelRhythmState(globalSentinelSimulationState, config, { now });
      // A missed repairer leaves before the next one arrives. Accepted repairers
      // already belong to the local hit aftermath, never a second live school.
      if (rhythm.phase === 'recovery' && now - rhythm.activeEndAtMs >= 1000) entities = [];
      if (rhythm.active && !rhythm.consumed && entities.length === 0) {
        spawn({ reason: 'spawn', syncLevel: protocolPressure });
        syncGlobalSentinelEntityVulnerability(now);
      }
    }

    // spawn cadence (dt-driven so it is
    // identical and drift-free across main/worker)

    if (control.spawnMode === NUDGE_ENGINE_SPAWN_MODES.CADENCE) {
      spawnAccumMs += dt * 1000;
      if (nextSpawnCadenceMs <= 0) nextSpawnCadenceMs = resolveNextSpawnCadenceMs(protocolPressure);
      while (spawnAccumMs >= nextSpawnCadenceMs) {
        spawnAccumMs -= nextSpawnCadenceMs;
        if (spawn({ reason: 'spawn', syncLevel: protocolPressure })) {
          speedUpAll();
          nextSpawnCadenceMs = resolveNextSpawnCadenceMs(protocolPressure);
        } else {
          spawnAccumMs = 0;
          nextSpawnCadenceMs = resolveNextSpawnCadenceMs(protocolPressure);
          break;
        }
      }
    }

    const split = runSentinelSplitCycle({
      modalOpen: control.splitMode !== NUDGE_ENGINE_SPLIT_MODES.ENABLED,
      config,
      totalSplitSpawned,
      entities,
      activeTheme,
      splitTimerMs,
      dtMs: dt * 1000,
      syncLevel: protocolPressure,
      spawnOne: spawn,
      speedUpAll,
    });
    splitTimerMs = split.splitTimerMs;

    enforceEntityBudget();

    // Retire koi after site collective descent or a global hit sink lifecycle.
    for (let i = entities.length - 1; i >= 0; i -= 1) {
      if (isNudgeEntitySinkComplete(entities[i], now)) entities.splice(i, 1);
    }

    if (control.clockMode === NUDGE_ENGINE_CLOCK_MODES.ACTIVE) {
      const globalRhythmMotionScale = isGlobalNudgeProtocolScene(scene)
        ? (() => {
          const rhythm = resolveGlobalSentinelRhythmState(
            globalSentinelSimulationState,
            config,
            { now },
          );
          return rhythm.motionScale;
        })()
        : 1;
      for (const entity of entities) {
        let globalSentinelRepairTarget = null;
        if (isGlobalNudgeProtocolScene(scene) && isGlobalSentinelStarted()) {
          const rhythm = resolveGlobalSentinelRhythmState(globalSentinelSimulationState, config, { now });
          if (rhythm.beatIndex >= 0) {
            const site = resolveGlobalSentinelRepairSite(
              resolveGlobalSimulationBreakCrackSkeleton({ seed: simulationBreakSeed, impactPoint: resolveGlobalSentinelCrackOriginPoint() }),
              rhythm.beatIndex,
            );
            const dx = (site.anchor[0] - site.origin[0]) * bounds.width;
            const dy = (site.anchor[1] - site.origin[1]) * bounds.height;
            const heading = Math.atan2(-dy, -dx);
            const contact = clampUnit(rhythm.telegraphProgress / 0.72);
            const approach = contact * contact * (3 - 2 * contact);
            const offset = rhythm.phase === 'recovery' ? 0 : (1 - approach) * Math.min(bounds.width, bounds.height) * 0.32;
            globalSentinelRepairTarget = {
              x: site.anchor[0] * bounds.width - Math.cos(heading) * offset,
              y: site.anchor[1] * bounds.height - Math.sin(heading) * offset,
              tangentX: Math.cos(heading), tangentY: Math.sin(heading),
              tangentInfluence: 1, translationSpeedScale: 0.12,
              arrivalPullRatePerSec: 28, arrivalMaxSpeedPxPerSec: 2400,
              radiusReference: entity.size, pinnedPose: true,
            };
            if (entity.globalSentinelRepairBeat !== rhythm.beatIndex) {
              entity.koiActor.teleport(globalSentinelRepairTarget.x, globalSentinelRepairTarget.y, bounds, { heading });
              syncEntityFromKoiActorSnapshot(entity);
              entity.globalSentinelRepairBeat = rhythm.beatIndex;
            }
            entity.globalSentinelRepairOpacity = rhythm.phase === 'recovery'
              ? 1 - clampUnit((now - rhythm.activeEndAtMs - 300) / 650)
              : clampUnit(rhythm.telegraphProgress / 0.18);
          }
        }
        updateNudgeEntity(entity, dt * globalRhythmMotionScale, bounds, activeTheme, speedScalar, {
          renderBudget,
          timeMs: now,
          protocolProgress: protocolVisualProgress,
          protocolSyncLevel: protocolPressure,

          globalSentinelRepairTarget,
        });
      }
    }
  }

  function render(now) {
    if (!hasCtx()) return 0;
    pruneGlobalSentinelInkBursts(now);
    ctx.clearRect(0, 0, bounds.width, bounds.height);
    const scene = protocolScene || resolveNudgeProtocolScene(config);
    const syncLevel = resolveSyncLevel(now);
    const globalFrameSnapshot = isGlobalNudgeProtocolScene(scene)
      ? resolveGlobalProtocolFrameSnapshot(now)
      : null;
    const globalDiagnostics = globalFrameSnapshot
      ? globalFrameSnapshot.diagnostics
      : syncGlobalGameDiagnostics(now);
    const progress = globalFrameSnapshot
      ? globalFrameSnapshot.protocolVisualProgress
      : resolveProtocolVisualProgress(now);

    const fractureImpactPoint = globalDiagnostics.globalSentinelFractureImpactSerial > 0
      ? {
        x: globalDiagnostics.globalSentinelFractureImpactX,
        y: globalDiagnostics.globalSentinelFractureImpactY,
      }
      : null;
    let repairFrame = null;
    if (globalFrameSnapshot && isGlobalSentinelStarted()) {
      const policy = resolveGlobalSentinelSimulationPolicy(config);
      const rhythm = resolveGlobalSentinelRhythmState(globalSentinelSimulationState, config, { now });
      const repairEntity = entities.find(entity => Number(entity.entityId) === globalSentinelRhythmTargetEntityId);
      repairFrame = resolveGlobalSentinelRepairFrame({
        skeleton: resolveGlobalSimulationBreakCrackSkeleton({ seed: simulationBreakSeed, impactPoint: resolveGlobalSentinelCrackOriginPoint() }),
        rhythm,
        fracture: globalDiagnostics.globalSentinelFracture,
        entity: repairEntity ? {
          x: repairEntity.x / bounds.width, y: repairEntity.y / bounds.height, sizePx: repairEntity.size,
        } : null,
        burst: globalSentinelInkBursts.findLast(burst => burst.hitAftermath === true),
        repairAmount: globalDiagnostics.globalSentinelFractureRepairAmount,
        repairElapsedMs: globalDiagnostics.globalSentinelFractureRepairElapsedMs,
        repairBeatIndex: globalDiagnostics.globalSentinelFractureRepairBeatIndex,
        repairDurationMs: policy.missRepairDurationMs,
        vulnerabilityWindowMs: rhythm.windowMs,
        cycleMs: rhythm.cycleMs,
        reducedMotion: config.reducedMotion === true,
        scenePhase, now,
      });
    }
    const displayFracture = repairFrame ? repairFrame.displayFracture : globalDiagnostics.globalSentinelFracture;
    drawNudgeProtocolSceneBackground(ctx, bounds, scene, {
      attunementProgress: protocolProgressSnapshot?.attunementProgress,
      currentStrength: protocolProgressSnapshot?.currentStrength,
      descentProgress: protocolProgressSnapshot?.descentProgress,
      progress,
      protocolPhase: protocolProgressSnapshot?.phase,
      quietHoldProgress: protocolProgressSnapshot?.quietHoldProgress,
      schoolCoherence: protocolProgressSnapshot?.schoolCoherence,
      syncLevel,
      syncPressure: globalDiagnostics.globalSentinelSyncPressure,
      attemptedRepairPressure: globalDiagnostics.globalSentinelBaseSyncPressure,
      fracture: displayFracture,
      fractureThreshold: globalDiagnostics.globalSentinelFractureThreshold,
      repairFrame,
      recoveryStarterBurst: globalSentinelWitnessBurst,
      fractureImpact: globalDiagnostics.globalSentinelFractureImpact,
      fractureImpactStrength: globalDiagnostics.globalSentinelFractureImpactStrength,
      fractureImpactSerial: globalDiagnostics.globalSentinelFractureImpactSerial,
      fractureImpactPoint,
      fractureRepairPulse: globalDiagnostics.globalSentinelFractureRepairPressure,
      renderBudget,
      terminalSequence: terminalSequenceState,
      timeMs: now,
      simulationBreakImpactPoint: resolveGlobalSentinelCrackOriginPoint(),
      simulationBreakEntryRevealProgress: globalDiagnostics.globalSentinelEntryRevealProgress,
      simulationBreakEntryRevealActive: isGlobalSentinelStarted(),
      simulationBreakEntryHandoffVisible: isGlobalSentinelStarted()
        && totalSpawned === 1
        && entities.length === 0,
      simulationBreakGamePhase: globalDiagnostics.globalSentinelGamePhase,
      simulationBreakRiftProgress: resolveGlobalSentinelRiftOpenProgress(now),
      simulationBreakSeed,
      reducedMotion: config.reducedMotion === true,
      scenePhase,
    });
    const fadeAlpha = (activeTheme?.trailAlpha ?? 0) * renderBudget.trailAlphaScale;
    if (fadeAlpha > 0) {
      ctx.fillStyle = `rgba(4, 6, 10, ${fadeAlpha})`;
      ctx.fillRect(0, 0, bounds.width, bounds.height);
    }
    const intensity = Math.max(0.4 + syncLevel * 0.6, clamp(config?.protocolIntensity, 0.35, 1));
    syncRenderOptions();
    for (const entity of entities) {
      drawNudgeEntity(ctx, entity, activeTheme, now, intensity, renderOptions);
    }
    for (const burst of globalSentinelInkBursts) {
      drawGlobalSentinelInkBurst(ctx, burst, now, renderBudget);
    }
    drawNudgeProtocolSceneForeground(ctx, bounds, scene, {
      progress,
      syncLevel,
      syncPressure: globalDiagnostics.globalSentinelSyncPressure,
      attemptedRepairPressure: globalDiagnostics.globalSentinelBaseSyncPressure,
      fracture: displayFracture,
      fractureThreshold: globalDiagnostics.globalSentinelFractureThreshold,
      repairFrame,
      recoveryStarterBurst: globalSentinelWitnessBurst,
      fractureImpact: globalDiagnostics.globalSentinelFractureImpact,
      fractureImpactStrength: globalDiagnostics.globalSentinelFractureImpactStrength,
      fractureImpactSerial: globalDiagnostics.globalSentinelFractureImpactSerial,
      fractureImpactPoint,
      fractureRepairPulse: globalDiagnostics.globalSentinelFractureRepairPressure,
      renderBudget,
      terminalSequence: terminalSequenceState,
      timeMs: now,
      simulationBreakImpactPoint: resolveGlobalSentinelCrackOriginPoint(),
      simulationBreakEntryRevealProgress: globalDiagnostics.globalSentinelEntryRevealProgress,
      simulationBreakEntryRevealActive: isGlobalSentinelStarted(),
      simulationBreakGamePhase: globalDiagnostics.globalSentinelGamePhase,
      simulationBreakRiftProgress: resolveGlobalSentinelRiftOpenProgress(now),
      simulationBreakSeed,
      reducedMotion: config.reducedMotion === true,
      scenePhase,
    });
    return entities.length;
  }

  function getSpriteCacheStats() {
    let hitCount = 0;
    let missCount = 0;
    let vectorCount = 0;
    let unavailableCount = 0;
    for (const entity of entities) {
      const diagnostics = entity?.koiActor?.getRenderDiagnostics?.() || null;
      const mode = typeof diagnostics?.mode === 'string' ? diagnostics.mode : '';
      if (mode === 'sprite_cache_hit') hitCount += 1;
      else if (mode === 'sprite_cache_miss') missCount += 1;
      else if (mode === 'vector' && diagnostics?.reason) unavailableCount += 1;
      else vectorCount += 1;
    }
    const spriteDrawCount = hitCount + missCount;
    return {
      spriteCacheMode: spriteDrawCount > 0
        ? 'canvas2d_sprite_cache'
        : (unavailableCount > 0 ? 'canvas2d_vector_cache_unavailable' : 'canvas2d_vector'),
      spriteCacheHitCount: hitCount,
      spriteCacheMissCount: missCount,
      spriteVectorCount: vectorCount,
      spriteCacheUnavailableCount: unavailableCount,
    };
  }

  function applyConfigToEntities() {
    for (const entity of entities) {
      if (entity?.koiActor?.kind === 'shadow_koi_actor'
        && typeof entity.koiActor.applyRuntimeConfig === 'function') {
        entity.koiActor.applyRuntimeConfig(config, protocolScene);
      }
    }
  }

  function setContext(nextCtx, nextBounds = null) {
    ctx = nextCtx || null;
    if (nextBounds) bounds = { width: Math.max(1, nextBounds.width || 1), height: Math.max(1, nextBounds.height || 1) };
  }

  function setTheme(themeId) {
    activeThemeId = themeId;
    activeTheme = resolveNudgeTheme(themeId);
  }

  function setConfig(nextConfig, nextProtocolProgress = undefined) {
    const nextProgressSnapshot = nextProtocolProgress !== undefined
      ? (nextProtocolProgress && typeof nextProtocolProgress === 'object'
        ? { ...nextProtocolProgress }
        : null)
      : protocolProgressSnapshot;
    const nextProtocolScene = resolveNudgeProtocolScene(nextConfig);
    assertGlobalSentinelSpawnBudget(nextConfig, nextProtocolScene);
    assertGlobalSentinelProtocolProgress(nextProgressSnapshot, nextProtocolScene);
    invalidateGlobalProtocolFrameSnapshot();
    config = nextConfig;
    protocolScene = nextProtocolScene;
    protocolProgressSnapshot = nextProgressSnapshot;
    const explicitSeed = resolveExplicitSimulationBreakSeed(config);
    if (explicitSeed !== null) simulationBreakSeed = explicitSeed;
    syncGlobalGameDiagnostics(runtimeNow());
    syncEngineControl(runtimeNow());

    applyConfigToEntities();
    enforceEntityBudget();
  }

  function setProtocolProgress(nextProtocolProgress = null) {
    const nextProgressSnapshot = nextProtocolProgress && typeof nextProtocolProgress === 'object'
      ? { ...nextProtocolProgress }
      : null;
    assertGlobalSentinelProtocolProgress(nextProgressSnapshot, protocolScene);
    protocolProgressSnapshot = nextProgressSnapshot;
    syncEngineControl(runtimeNow());

  }

  function resetCounters() {
    if (globalSentinelWitnessBurst) globalSentinelWitnessBurst.shikigamiActor = null;
    entities = [];
    totalSpawned = 0;
    totalSplitSpawned = 0;
    entitySerial = 0;
    splitTimerMs = 0;
    spawnAccumMs = 0;
    nextSpawnCadenceMs = 0;
    globalDormantVisualCount = 0;
    globalSentinelSimulationState = createGlobalSentinelSimulationState();
    globalSentinelStartedAtMs = 0;
    preparedGlobalStarter = null;
    globalSentinelFracture = 0;
    globalSentinelFractureUpdatedAtMs = 0;
    globalSentinelSyncPressureRelief = 0;
    globalSentinelLastHitAtMs = 0;
    globalSentinelLastHitEfficiency = 0;
    globalSentinelLastFractureImpulse = 0;
    globalSentinelLastSyncPressureRelief = 0;
    globalSentinelFractureImpactAtMs = 0;
    globalSentinelFractureImpactStrength = 0;
    globalSentinelFractureImpactSerial = 0;
    globalSentinelFractureImpactX = 0;
    globalSentinelFractureImpactY = 0;
    globalSentinelCrackOriginX = 0;
    globalSentinelCrackOriginY = 0;
    globalSentinelStarterFeedbackAtMs = 0;
    globalSentinelStarterFeedbackSerial = 0;
    globalSentinelStarterFeedbackX = 0;
    globalSentinelStarterFeedbackY = 0;
    globalSentinelInkBursts = [];
    globalSentinelWitnessBurst = null;
    globalSentinelFractureRepairAmount = 0;
    globalSentinelFractureRepairPressure = 0;
    globalSentinelFractureRepairElapsedMs = 0;
    globalSentinelRhythmTargetBeatIndex = -1;
    globalSentinelRhythmTargetEntityId = 0;
    globalGameDiagnostics = createGlobalSentinelGameDiagnostics();
    globalProtocolFrameSnapshot = null;
    globalProtocolFrameSnapshotResolutionCount = 0;
    engineControlState = null;
    protocolProgressSnapshot = null;
    scenePhaseStartedAtMs = 0;
    frameCounter = 0;
    renderPressureState = createNudgeRenderPressureState({
      pressureLevel: initialRenderPressureLevel,
    });
    speedScalar = 1;

  }

  function init({
    ctx: nextCtx = null,
    bounds: nextBounds = null,
    config: nextConfig = null,
    themeId = '',
    protocolStartAt: nextProtocolStartAt = runtimeNow(),
    scenePhase: nextScenePhase = NUDGE_SCENE_PHASES.RITUAL,
    protocolProgress: nextProtocolProgress = null,
  } = {}) {
    resetCounters();
    if (nextConfig) config = nextConfig;
    protocolScene = resolveNudgeProtocolScene(config);
    if (!isGlobalNudgeProtocolScene(protocolScene)) throw new Error('site_furin_has_no_swarm');
    assertGlobalSentinelSpawnBudget(config, protocolScene);
    protocolProgressSnapshot = nextProtocolProgress && typeof nextProtocolProgress === 'object'
      ? { ...nextProtocolProgress }
      : null;
    assertGlobalSentinelProtocolProgress(protocolProgressSnapshot, protocolScene);
    setTheme(themeId);
    setContext(nextCtx, nextBounds);
    protocolStartAt = Number(nextProtocolStartAt) || runtimeNow();
    globalSentinelSimulationState = createGlobalSentinelSimulationState({ now: protocolStartAt });
    globalSentinelFractureUpdatedAtMs = 0;
    simulationBreakSeed = resolveInitialSimulationBreakSeed(config, protocolStartAt);
    scenePhase = nextScenePhase;
    scenePhaseStartedAtMs = protocolStartAt;
    modalOpen = false;
    terminalSequenceState = null;
    renderPressureLevel = initialRenderPressureLevel;
    renderBudget = resolveNudgeRenderBudget(renderPressureLevel);
    renderPressureState = createNudgeRenderPressureState({
      pressureLevel: initialRenderPressureLevel,
    });
    syncRenderOptions();
    syncGlobalGameDiagnostics(protocolStartAt);
    syncEngineControl(protocolStartAt);
  }

  return {
    init,
    resize: (nextBounds) => setContext(ctx, nextBounds),
    setContext,
    setConfig,
    setProtocolProgress,
    setTheme,
    setScenePhase: (phase, { startedAtMs = runtimeNow() } = {}) => {
      if (!Number.isFinite(startedAtMs) || startedAtMs < 0) {
        throw new Error('nudge_scene_phase_started_at_invalid');
      }
      if (scenePhase !== phase) {
        scenePhaseStartedAtMs = startedAtMs;
      }
      scenePhase = phase;
      if (phase !== NUDGE_SCENE_PHASES.RITUAL && globalSentinelWitnessBurst) globalSentinelWitnessBurst.shikigamiActor = null;
      syncEngineControl(runtimeNow());
    },
    setModalOpen: (open) => {
      modalOpen = !!open;
      syncEngineControl(runtimeNow());
    },
    setTerminalSequence: (seq, { clearEntities = false } = {}) => {
      const now = runtimeNow();
      invalidateGlobalProtocolFrameSnapshot();
      terminalSequenceState = seq || null;
      if (terminalSequenceState && globalSentinelWitnessBurst) globalSentinelWitnessBurst.shikigamiActor = null;
      if (clearEntities) {
        entities = [];

        globalSentinelInkBursts = [];
      } else if (isGlobalSentinelFailureResync(terminalSequenceState)) {
        globalSentinelInkBursts = globalSentinelInkBursts.filter(
          (burst) => burst?.hitAftermath !== true,
        );
      }
      syncGlobalGameDiagnostics(now);
      syncEngineControl(now);
    },
    ensureInitialSchool,
    spawn,
    handlePointer,

    handleEligibleGlobalTarget,
    pulseGlobalStarterFeedback,
    update,
    render,
    observeRenderHealth,
    reset: () => { resetCounters(); },
    destroy: () => { resetCounters(); ctx = null; },
    getRenderPressureLevel: () => renderPressureLevel,
    getRenderBudget: () => renderBudget,
    getSpawnBlockReason: (reason = 'spawn', parent = null, spawnHint = null) => {
      const controlBlockReason = resolveEngineControlSpawnBlockReason({
        reason,
        parent,
        spawnHint,
      });
      if (controlBlockReason) return controlBlockReason;
      return resolveSentinelSpawnBlockReason({
        reason,
        parent,
        hasCanvasContext: hasCtx(),
        entities,
        config,
        totalSpawned,
        totalSplitSpawned,
        resolveLiveEntityLimit: () => resolveEngineLiveEntityLimit(),
      });
    },
    getLiveEntityLimit: () => resolveEngineLiveEntityLimit(),
    getStats: () => {

      return {
        protocolSceneId: protocolScene?.sceneId || '',
        protocolRenderer: protocolScene?.renderer?.kind || '',
        protocolSystem: protocolScene?.protocolSystem || '',
        engineLiveLimit: resolveEngineLiveEntityLimit(),
        liveCount: entities.length,
        totalSpawned,
        totalSplitSpawned,
        simulationBreakSeed,
        engineControlClockMode: engineControlState?.clockMode || '',
        engineControlSpawnMode: engineControlState?.spawnMode || '',
        engineControlSplitMode: engineControlState?.splitMode || '',
        engineControlInputMode: engineControlState?.inputMode || '',
        engineControlEntityMode: engineControlState?.entityMode || '',
        engineControlRenderMode: engineControlState?.renderMode || '',
        engineControlBlockReason: engineControlState?.blockReason || '',
        protocolProgressPhase: typeof protocolProgressSnapshot?.phase === 'string'
          ? protocolProgressSnapshot.phase
          : '',
        protocolProgressInteractionOpen: protocolProgressSnapshot?.interactionOpen === true,

        ...globalGameDiagnostics,
        renderPressureLevel,
        renderBudgetPolicyId: renderBudget.render.policyId,
        renderFrameIntervalEmaMs: renderPressureState.frameIntervalEmaMs,
        renderWorkTimeEmaMs: renderPressureState.workTimeEmaMs,
        renderedCount: entities.length,
        ...getSpriteCacheStats(),
      };
    },
    // test/diagnostic access
    _debugGetEntities: () => entities,
    _debugGetGlobalSentinelInkBursts: () => globalSentinelInkBursts,
    _debugGetGlobalSentinelRiftOpenProgress: (now = runtimeNow()) => (
      resolveGlobalSentinelRiftOpenProgress(now)
    ),
    _debugGetGlobalProtocolFrameSnapshotResolutionCount: () => (
      globalProtocolFrameSnapshotResolutionCount
    ),
    _debugGetGlobalStarterFeedbackProgress: (now = runtimeNow()) => resolveGlobalStarterFeedbackProgress(now),
    _debugGetProtocolVisualProgress: (now = runtimeNow()) => resolveProtocolVisualProgress(now),
  };
}
