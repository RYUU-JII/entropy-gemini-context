import { projectGlobalSentinelRhythmStats } from '../nudge/nudgeGameRuntimeUtils.js';

export function readDiagnosticsCount(source = null, key = '', fallback = 0) {
  const numeric = Number(source?.[key]);
  if (Number.isFinite(numeric)) return Math.max(0, Math.round(numeric));
  const fallbackNumeric = Number(fallback);
  return Math.max(0, Math.round(Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0));
}

export function readDiagnosticsUnit(source = null, key = '', fallback = 0) {
  const numeric = Number(source?.[key]);
  if (Number.isFinite(numeric)) return Math.max(0, Math.min(1, numeric));
  const fallbackNumeric = Number(fallback);
  return Math.max(0, Math.min(1, Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0));
}

export function readDiagnosticsNonNegative(source = null, key = '', fallback = 0) {
  const numeric = Number(source?.[key]);
  if (Number.isFinite(numeric)) return Math.max(0, numeric);
  const fallbackNumeric = Number(fallback);
  return Math.max(0, Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0);
}

const GLOBAL_RHYTHM_PROJECTION = Object.freeze({
  rhythmBeatIndex: -1,
  rhythmPhase: '',
  rhythmPhaseProgress: 0,
  rhythmSlowMotion: 0,
  rhythmActIndex: -1,
  rhythmActId: '',
  rhythmActProgress: 0,
  rhythmAttemptIndex: 0,
  rhythmRepairPressure: 0,
  rhythmPhaseRemainingMs: 0,
  fractureRepairBeatIndex: -1,
});

function buildGlobalRhythmProjection(source, { active = true, diagnosticKeys = false } = {}) {
  return Object.fromEntries(Object.entries(GLOBAL_RHYTHM_PROJECTION).map(([key, inactiveValue]) => {
    const diagnosticKey = `globalSentinel${key[0].toUpperCase()}${key.slice(1)}`;
    // Keep one complete selected-runtime observation. Missing evidence remains
    // undefined instead of borrowing an apparently valid phase from another clock.
    return [diagnosticKey, active ? source?.[diagnosticKeys ? diagnosticKey : key] : inactiveValue];
  }));
}

export function buildSentinelProtocolStateDiagnostics({
  progress = null,
  protocolSystem = '',
  isGlobalProtocolActive = false,
  globalEntryRevealProgress = 0,
} = {}) {
  const active = isGlobalProtocolActive === true;
  const source = progress && typeof progress === 'object' ? progress : {};
  return {
    protocolSystem: source.protocolSystem || protocolSystem,
    siteFurinPhase: active ? null : source.phase,
    siteFurinDeliveryForm: active ? null : source.deliveryForm,
    siteFurinVisibleElapsedMs: active ? null : source.visibleElapsedMs,
    siteFurinDurationMs: active ? null : source.durationMs,
    siteFurinReady: active ? null : source.ready,

    globalSentinelSimulationProgress: active ? source.progress : 0,
    globalSentinelDormantCount: active ? source.dormantCount : 0,
    globalSentinelTargetDormantCount: active ? source.targetDormantCount : 0,
    globalSentinelSyncLevel: active ? source.syncLevel : 0,
    globalSentinelSyncRemainingMs: active ? source.remainingMs : 0,
    globalSentinelGamePhase: active ? source.gamePhase : '',
    globalSentinelBaseSyncPressure: active ? source.baseSyncPressure : 0,
    globalSentinelSyncPressure: active ? source.syncPressure : 0,
    globalSentinelSyncPressureRelief: active ? source.syncPressureRelief : 0,
    globalSentinelSyncPressureFailureThreshold: active ? source.syncPressureFailureThreshold : 0,
    globalSentinelFracture: active ? source.fracture : 0,
    globalSentinelFractureThreshold: active ? source.fractureThreshold : 0,
    globalSentinelIntegrity: active ? source.sentinelIntegrity : 0,
    ...buildGlobalRhythmProjection(source, { active }),
    globalSentinelFractureRepairAmount: 0,
    globalSentinelFractureRepairPressure: 0,
    globalSentinelFractureRepairElapsedMs: 0,
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
    globalSentinelEntryRevealProgress: active ? globalEntryRevealProgress : 0,
    globalSentinelStarterFeedbackSerial: 0,
    globalSentinelStarterFeedbackX: 0,
    globalSentinelStarterFeedbackY: 0,
    globalSentinelStrokeCount: active ? source.strokeCount : 0,
    globalSentinelLastHitEfficiency: active ? source.lastHitEfficiency : 0,
    globalSentinelLastFractureImpulse: active ? source.lastFractureImpulse : 0,
    globalSentinelLastSyncPressureRelief: active ? source.lastSyncPressureRelief : 0,
  };
}

export function buildSentinelMainSpawnDiagnostics({
  workerDiagnostics = null,
  stats = null,
  protocolDiagnostics = null,
  runtimeStage = '',
  workerRuntimeHost = '',
  activeThemeId = '',
  workerRuntimeActive = false,
  workerSessionReady = false,
  supportsWorkerRuntime = false,
  hasCanvasContext = false,
  canvasConnected = false,
  rootConnected = false,
  bounds = null,
  activeProtocolScene = null,
  config = null,
  scenePhase = '',
  globalRiftOpenProgress = 0,
  globalRiftInviteOpen = false,
  engineLiveLimit = 0,
} = {}) {
  const safeStats = stats && typeof stats === 'object' ? stats : {};
  const safeProtocolDiagnostics = protocolDiagnostics && typeof protocolDiagnostics === 'object'
    ? protocolDiagnostics
    : {};
  const fallbackEngineLiveLimit = readDiagnosticsCount(
    { engineLiveLimit },
    'engineLiveLimit',
    safeStats.engineLiveLimit,
  );
  const hitAftermathDiagnostics = scenePhase === 'ritual'
    ? {
      globalSentinelHitAftermathActiveCount: readDiagnosticsCount(
        workerDiagnostics,
        'globalSentinelHitAftermathActiveCount',
        safeStats.globalSentinelHitAftermathActiveCount,
      ),
      globalSentinelHitAftermathPhase: typeof workerDiagnostics?.globalSentinelHitAftermathPhase === 'string'
        ? workerDiagnostics.globalSentinelHitAftermathPhase
        : (typeof safeStats.globalSentinelHitAftermathPhase === 'string'
          ? safeStats.globalSentinelHitAftermathPhase
          : ''),
      globalSentinelHitAftermathProgress: readDiagnosticsUnit(
        workerDiagnostics,
        'globalSentinelHitAftermathProgress',
        safeStats.globalSentinelHitAftermathProgress,
      ),
      globalSentinelHitAftermathTerminal: typeof workerDiagnostics?.globalSentinelHitAftermathTerminal === 'boolean'
        ? workerDiagnostics.globalSentinelHitAftermathTerminal
        : safeStats.globalSentinelHitAftermathTerminal === true,
      globalSentinelHitAftermathSerial: readDiagnosticsCount(
        workerDiagnostics,
        'globalSentinelHitAftermathSerial',
        safeStats.globalSentinelHitAftermathSerial,
      ),
    }
    : {
      globalSentinelHitAftermathActiveCount: 0,
      globalSentinelHitAftermathPhase: '',
      globalSentinelHitAftermathProgress: 0,
      globalSentinelHitAftermathTerminal: false,
      globalSentinelHitAftermathSerial: 0,
    };

  return {
    runtimeStage: workerDiagnostics?.runtimeStage || runtimeStage,
    workerRuntimeHost,
    activeThemeId,
    workerRuntimeActive: workerRuntimeActive === true,
    workerSessionReady: workerSessionReady === true,
    supportsWorkerRuntime: supportsWorkerRuntime === true,
    hasCanvasContext: hasCanvasContext === true,
    canvasConnected: canvasConnected === true,
    rootConnected: rootConnected === true,
    bounds: {
      width: Math.max(0, Math.round(Number(bounds?.width) || 0)),
      height: Math.max(0, Math.round(Number(bounds?.height) || 0)),
    },
    protocolScope: workerDiagnostics?.protocolScope || activeProtocolScene?.protocolScope || config?.protocolScope || '',
    protocolVariant: workerDiagnostics?.protocolVariant || activeProtocolScene?.protocolVariant || config?.protocolVariant || '',
    deliveryForm: config?.deliveryForm,
    protocolSceneId: workerDiagnostics?.protocolSceneId || activeProtocolScene?.sceneId || '',
    protocolRenderer: workerDiagnostics?.protocolRenderer || activeProtocolScene?.renderer?.kind || '',
    protocolBackgroundOwner: workerDiagnostics?.protocolBackgroundOwner || activeProtocolScene?.background?.owner || '',
    protocolBackgroundMode: workerDiagnostics?.protocolBackgroundMode || activeProtocolScene?.background?.mode || '',
    protocolBudgetLabel: activeProtocolScene?.diagnostics?.budgetLabel || '',
    protocolIntensity: Number.isFinite(Number(config?.protocolIntensity))
      ? Number(config.protocolIntensity)
      : null,
    ...safeProtocolDiagnostics,
    ...projectGlobalSentinelRhythmStats(workerRuntimeActive ? workerDiagnostics : safeStats),
    globalSentinelFractureRepairAmount: readDiagnosticsUnit(
      workerDiagnostics,
      'globalSentinelFractureRepairAmount',
      safeStats.globalSentinelFractureRepairAmount,
    ),
    globalSentinelFractureRepairPressure: readDiagnosticsNonNegative(
      workerDiagnostics,
      'globalSentinelFractureRepairPressure',
      safeStats.globalSentinelFractureRepairPressure,
    ),
    globalSentinelFractureRepairElapsedMs: readDiagnosticsNonNegative(
      workerDiagnostics,
      'globalSentinelFractureRepairElapsedMs',
      safeStats.globalSentinelFractureRepairElapsedMs,
    ),
    globalSentinelFractureImpactX: readDiagnosticsUnit(
      workerDiagnostics,
      'globalSentinelFractureImpactX',
      safeStats.globalSentinelFractureImpactX,
    ),
    globalSentinelFractureImpactY: readDiagnosticsUnit(
      workerDiagnostics,
      'globalSentinelFractureImpactY',
      safeStats.globalSentinelFractureImpactY,
    ),
    ...hitAftermathDiagnostics,
    globalSentinelEntryRevealProgress: readDiagnosticsUnit(
      workerDiagnostics,
      'globalSentinelEntryRevealProgress',
      safeStats.globalSentinelEntryRevealProgress,
    ),
    globalSentinelStarterFeedbackSerial: readDiagnosticsCount(
      workerDiagnostics,
      'globalSentinelStarterFeedbackSerial',
      safeStats.globalSentinelStarterFeedbackSerial,
    ),
    globalSentinelStarterFeedbackX: readDiagnosticsUnit(
      workerDiagnostics,
      'globalSentinelStarterFeedbackX',
      safeStats.globalSentinelStarterFeedbackX,
    ),
    globalSentinelStarterFeedbackY: readDiagnosticsUnit(
      workerDiagnostics,
      'globalSentinelStarterFeedbackY',
      safeStats.globalSentinelStarterFeedbackY,
    ),
    globalSentinelRiftOpenProgress: readDiagnosticsUnit(
      { globalRiftOpenProgress },
      'globalRiftOpenProgress',
    ),
    globalSentinelRiftInviteOpen: globalRiftInviteOpen === true,
    scenePhase,
    renderPressureLevel: workerDiagnostics?.renderPressureLevel || safeStats.renderPressureLevel,
    renderBudgetPolicyId: workerDiagnostics?.renderBudgetPolicyId || safeStats.renderBudgetPolicyId,
    renderFrameIntervalEmaMs: readDiagnosticsNonNegative(
      workerDiagnostics,
      'renderFrameIntervalEmaMs',
      safeStats.renderFrameIntervalEmaMs,
    ),
    renderWorkTimeEmaMs: readDiagnosticsNonNegative(
      workerDiagnostics,
      'renderWorkTimeEmaMs',
      safeStats.renderWorkTimeEmaMs,
    ),
    renderBackend: workerDiagnostics?.renderBackend || safeStats.renderBackend || '',
    effectiveDpr: readDiagnosticsNonNegative(workerDiagnostics, 'effectiveDpr', safeStats.effectiveDpr),
    frameWorkMs: readDiagnosticsNonNegative(workerDiagnostics, 'frameWorkMs', safeStats.frameWorkMs),
    updateWorkMs: readDiagnosticsNonNegative(workerDiagnostics, 'updateWorkMs', safeStats.updateWorkMs),
    renderWorkMs: readDiagnosticsNonNegative(workerDiagnostics, 'renderWorkMs', safeStats.renderWorkMs),
    frameWorkP95Ms: readDiagnosticsNonNegative(workerDiagnostics, 'frameWorkP95Ms', safeStats.frameWorkP95Ms),
    frameWorkMaxMs: readDiagnosticsNonNegative(workerDiagnostics, 'frameWorkMaxMs', safeStats.frameWorkMaxMs),
    liveCount: readDiagnosticsCount(workerDiagnostics, 'liveCount', safeStats.liveCount),

    engineLiveLimit: readDiagnosticsCount(workerDiagnostics, 'engineLiveLimit', fallbackEngineLiveLimit),
    liveLimit: readDiagnosticsCount(workerDiagnostics, 'liveLimit', fallbackEngineLiveLimit),
    totalSpawned: readDiagnosticsCount(workerDiagnostics, 'totalSpawned', safeStats.totalSpawned),
    maxTotalSpawned: readDiagnosticsCount(workerDiagnostics, 'maxTotalSpawned', config?.maxTotalSpawned),
    totalSplitSpawned: readDiagnosticsCount(workerDiagnostics, 'totalSplitSpawned', safeStats.totalSplitSpawned),
    maxSplits: readDiagnosticsCount(workerDiagnostics, 'maxSplits', config?.maxSplits),
    maxSplitGeneration: readDiagnosticsCount(workerDiagnostics, 'maxSplitGeneration', config?.maxSplitGeneration),
    spriteCacheMode: workerDiagnostics?.spriteCacheMode || safeStats.spriteCacheMode || '',
    spriteCacheHitCount: readDiagnosticsCount(workerDiagnostics, 'spriteCacheHitCount', safeStats.spriteCacheHitCount),
    spriteCacheMissCount: readDiagnosticsCount(workerDiagnostics, 'spriteCacheMissCount', safeStats.spriteCacheMissCount),
    spriteVectorCount: readDiagnosticsCount(workerDiagnostics, 'spriteVectorCount', safeStats.spriteVectorCount),
    spriteCacheUnavailableCount: readDiagnosticsCount(
      workerDiagnostics,
      'spriteCacheUnavailableCount',
      safeStats.spriteCacheUnavailableCount,
    ),
    ...(workerDiagnostics ? {
      runtimeMode: workerDiagnostics.runtimeMode,
      lastError: workerDiagnostics.lastError,
      spawnLifecycle: workerDiagnostics.spawnLifecycle,
      hostConnected: workerDiagnostics.hostConnected,
      hostChannelAuthenticated: typeof workerDiagnostics.hostChannelAuthenticated === 'boolean'
        ? workerDiagnostics.hostChannelAuthenticated : null,
      workerBootReady: workerDiagnostics.workerBootReady === true,
      workerFirstFrameReady: workerDiagnostics.workerFirstFrameReady === true,
      firstFrame: workerDiagnostics.firstFrame && typeof workerDiagnostics.firstFrame === 'object'
        ? { ...workerDiagnostics.firstFrame }
        : null,
    } : {}),
  };
}
