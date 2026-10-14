import { clamp, normalizeRenderPressureLevel } from './nudgeGameRuntimeUtils.js';
import { GLOBAL_SENTINEL_PROTOCOL_SYSTEM } from './nudgeGameGlobalSentinelProtocol.js';
import { SITE_FURIN_PROTOCOL_SYSTEM } from './nudgeGameSiteFurinProtocol.js';

export const SENTINEL_TELEMETRY_EVENT = 'entropy:sentinel-flare-telemetry';
export const SENTINEL_TELEMETRY_GLOBAL_KEY = '__ENTROPY_SENTINEL_FLARE_DEBUG__';

function resolveWindowRef(windowRef = null) {
  if (windowRef && typeof windowRef === 'object') {
    return windowRef;
  }
  return typeof window === 'undefined' ? null : window;
}

function resolveCustomEventCtor(CustomEventCtor = null) {
  if (typeof CustomEventCtor === 'function') {
    return CustomEventCtor;
  }
  return typeof CustomEvent === 'function' ? CustomEvent : null;
}

function resolveConsoleRef(consoleRef = null) {
  if (consoleRef && typeof consoleRef === 'object') {
    return consoleRef;
  }
  return typeof console === 'undefined' ? null : console;
}

function getHudTelemetryErrorMessage(error, fallback = 'SENTINEL_HUD_TELEMETRY_FAILURE') {
  return String(error?.message || error || fallback);
}

function warnHudTelemetryFailure(consoleRef, message, details) {
  const targetConsole = resolveConsoleRef(consoleRef);
  if (typeof targetConsole?.warn !== 'function') return null;
  try {
    targetConsole.warn(message, details);
    return null;
  } catch (error) {
    return getHudTelemetryErrorMessage(error, 'SENTINEL_HUD_TELEMETRY_WARNING_FAILED');
  }
}

function roundMetric(value, min, max) {
  return Math.round(clamp(value, min, max));
}

function resolveTelemetryMetric(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Number(0).toFixed(digits);
  }
  return numeric.toFixed(digits);
}

function resolveUnitMetric(value, fallback = 0) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return clamp(numeric, 0, 1);
  return clamp(fallback, 0, 1);
}

function resolveNonNegativeMetric(value, fallback = 0) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.max(0, numeric);
  const fallbackNumeric = Number(fallback);
  return Math.max(0, Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0);
}

function resolveCountMetric(value, max = 4000) {
  return roundMetric(value, 0, max);
}

function resolvePercentMetric(value, fallback = 0) {
  return roundMetric(resolveUnitMetric(value, fallback) * 100, 0, 100);
}

function resolvePhaseMetric(value, fallback = 'running') {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return raw.replace(/_/g, '-').toUpperCase();
}

function resolveProtocolProgressTelemetryLines(progress = null) {
  if (!progress || typeof progress !== 'object') return [];
  if (progress.protocolSystem === SITE_FURIN_PROTOCOL_SYSTEM || progress.protocolScope === 'site') {
    return [
      `SITE ${resolvePhaseMetric(progress.phase)} | RETURN ${resolvePercentMetric(progress.returnProgress)}% | SCHOOL ${resolvePercentMetric(progress.schoolCoherence)}%`,
      `CURRENT ${resolvePercentMetric(progress.currentStrength)}% | DESCENT ${resolvePercentMetric(progress.descentProgress)}% | READY ${progress.ready === true ? 'Y' : 'N'}`,
    ];
  }
  return [];
}

// Presentation labels read the same entry timeline as the renderer. No HUD
// clock or duplicate electrical/recovery duration is maintained here.
const GLOBAL_ENTRY_STAGE_LABELS = Object.freeze({
  impact: 'IMPACT / CRACK',
  detachment: 'SHADOW DISCONNECT',
  shadow_departure: 'SENTINEL DEPARTURE',
  electrical_cascade: 'LCD FAILURE',
  power_cut: 'POWER OFF',
  false_calm: 'WHITE FIELD / STILLNESS',
  giant_return: 'GIANT RETURN / REPAIR',
  handoff: 'REPAIR HANDOFF',
});
const GLOBAL_ACT_LABELS = Object.freeze({
  discovery: 'DISCOVERY', system_surge: 'SURGE', final_decision: 'DECISION',
});

export function resolveGlobalSentinelHudEntryStage(context = null) {
  if (!context) return 'UNAVAILABLE';
  if (context.preparingViewport) return 'VIEWPORT PREPARE';
  if (context.riftReady) return 'ROOM 478 READY';
  const entry = context.entry;
  if (!entry?.active) return resolvePhaseMetric(context.scenePhase, 'unavailable');
  const timeline = entry.timeline;
  return GLOBAL_ENTRY_STAGE_LABELS[timeline?.stage] ?? 'UNAVAILABLE';
}

function diagnosticNumber(value, digits = 1) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function readRenderMetrics(stats) {
  const metric = (key) => typeof stats?.[key] === 'number' && Number.isFinite(stats[key])
    ? stats[key] : null;
  return {
    backend: typeof stats?.renderBackend === 'string' ? stats.renderBackend : null,
    frameWorkMs: metric('frameWorkMs'),
    renderWorkMs: metric('renderWorkMs'),
    frameWorkP95Ms: metric('frameWorkP95Ms'),
  };
}

function formatGlobalSentinelTelemetry({ snapshot, protocolProgress: progress, runtimeContext, runtimeStage, lastRuntimeError }) {
  const context = runtimeContext;
  const input = context?.inputPending === true ? 'PENDING ACK'
    : (typeof context?.inputReady === 'boolean'
      ? (context.inputReady ? 'READY' : 'BLOCKED') : 'UNAVAILABLE');
  const view = context ? (context.fullscreen ? 'FULLSCREEN' : 'WINDOW') : 'UNAVAILABLE';
  const point = context?.entryPoint;
  const origin = point
    ? `${diagnosticNumber(point.xRatio * 100)}, ${diagnosticNumber(point.yRatio * 100)}%`
    : 'NOT COMMITTED';
  const awaiting = progress.gamePhase === 'awaiting_start';
  const finished = progress.completed || progress.failed;
  const clock = awaiting ? 'NOT STARTED'
    : (finished ? 'FINISHED' : `${diagnosticNumber(progress.remainingMs / 1000)}s LEFT`);
  const actLabel = GLOBAL_ACT_LABELS[progress.rhythmActId];
  const stage = !awaiting && !finished && !context?.entry?.active
    && !context?.preparingViewport && actLabel && Number.isInteger(progress.rhythmActIndex)
    ? `${progress.rhythmActIndex + 1}/3 ${actLabel} · ${resolvePhaseMetric(progress.rhythmPhase, 'unavailable')}`
    : resolveGlobalSentinelHudEntryStage(context);
  const lines = [
    `${resolvePhaseMetric(context?.mode, 'unavailable')} · INPUT ${input} · ${view}`,
    `${stage} · ${clock}`,
    `ORIGIN ${origin} · ${runtimeStage}`,
    `HIT ${diagnosticNumber(progress.lastHitEfficiency * 100, 0)}% · DRAW ${diagnosticNumber(snapshot?.render?.renderWorkMs)}ms · P95 ${diagnosticNumber(snapshot?.render?.frameWorkP95Ms)}ms`,
  ];
  if (lastRuntimeError) lines.push(`ERR ${lastRuntimeError}`);
  return lines.join('\n');
}

function resolveGlobalSentinelTelemetry(stats = null) {
  const source = stats && typeof stats === 'object' ? stats : {};
  return {
    protocolScope: typeof source.protocolScope === 'string' ? source.protocolScope : '',
    protocolVariant: typeof source.protocolVariant === 'string' ? source.protocolVariant : '',
    protocolSystem: typeof source.protocolSystem === 'string' ? source.protocolSystem : '',
    gamePhase: typeof source.globalSentinelGamePhase === 'string'
      ? source.globalSentinelGamePhase
      : '',
    baseSyncPressure: resolveNonNegativeMetric(source.globalSentinelBaseSyncPressure),
    syncPressure: resolveUnitMetric(source.globalSentinelSyncPressure),
    syncPressureRelief: resolveUnitMetric(source.globalSentinelSyncPressureRelief),
    syncPressureFailureThreshold: resolveUnitMetric(
      source.globalSentinelSyncPressureFailureThreshold,
      1,
    ),
    fracture: resolveUnitMetric(source.globalSentinelFracture),
    fractureThreshold: typeof source.globalSentinelFractureThreshold === 'number'
      ? resolveUnitMetric(source.globalSentinelFractureThreshold) : null,
    integrity: resolveUnitMetric(source.globalSentinelIntegrity),
    fractureRepairAmount: resolveUnitMetric(source.globalSentinelFractureRepairAmount),
    fractureRepairPressure: resolveNonNegativeMetric(source.globalSentinelFractureRepairPressure),
    fractureRepairElapsedMs: resolveNonNegativeMetric(source.globalSentinelFractureRepairElapsedMs),
    fractureImpact: resolveUnitMetric(source.globalSentinelFractureImpact),
    fractureImpactStrength: resolveUnitMetric(source.globalSentinelFractureImpactStrength),
    fractureImpactSerial: resolveCountMetric(source.globalSentinelFractureImpactSerial),
    fractureImpactX: resolveUnitMetric(source.globalSentinelFractureImpactX),
    fractureImpactY: resolveUnitMetric(source.globalSentinelFractureImpactY),
    entryRevealProgress: resolveUnitMetric(source.globalSentinelEntryRevealProgress),
    starterFeedbackSerial: resolveCountMetric(source.globalSentinelStarterFeedbackSerial),
    starterFeedbackX: resolveUnitMetric(source.globalSentinelStarterFeedbackX),
    starterFeedbackY: resolveUnitMetric(source.globalSentinelStarterFeedbackY),
    lastHitEfficiency: resolveUnitMetric(source.globalSentinelLastHitEfficiency),
    lastFractureImpulse: resolveUnitMetric(source.globalSentinelLastFractureImpulse),
    lastSyncPressureRelief: resolveUnitMetric(source.globalSentinelLastSyncPressureRelief),
    rhythmActIndex: Number.isInteger(source.globalSentinelRhythmActIndex) ? source.globalSentinelRhythmActIndex : null,
    rhythmActId: typeof source.globalSentinelRhythmActId === 'string' ? source.globalSentinelRhythmActId : null,
    rhythmPhase: typeof source.globalSentinelRhythmPhase === 'string' ? source.globalSentinelRhythmPhase : null,
    rhythmPhaseRemainingMs: typeof source.globalSentinelRhythmPhaseRemainingMs === 'number'
      ? resolveNonNegativeMetric(source.globalSentinelRhythmPhaseRemainingMs) : null,
    rhythmAttemptIndex: Number.isInteger(source.globalSentinelRhythmAttemptIndex) ? source.globalSentinelRhythmAttemptIndex : null,
    fractureRepairBeatIndex: Number.isInteger(source.globalSentinelFractureRepairBeatIndex) ? source.globalSentinelFractureRepairBeatIndex : null,
  };
}

export function clearPublishedSentinelTelemetry({
  telemetryGlobalKey,
  windowRef = null,
  consoleRef = null,
} = {}) {
  const targetWindow = resolveWindowRef(windowRef);
  if (!targetWindow || !telemetryGlobalKey) {
    return {
      cleared: false,
      error: null,
      warningError: null,
    };
  }
  try {
    targetWindow[telemetryGlobalKey] = null;
    return {
      cleared: true,
      error: null,
      warningError: null,
    };
  } catch (error) {
    const errorMessage = getHudTelemetryErrorMessage(error);
    const warningError = warnHudTelemetryFailure(
      consoleRef,
      '[sentinel flare] telemetry clear failed',
      {
        telemetryGlobalKey,
        error: errorMessage,
      },
    );
    return {
      cleared: false,
      error: errorMessage,
      warningError,
    };
  }
}

export function resolveSentinelHudTelemetrySnapshot({
  workerRuntimeActive = false,
  getWorkerRuntimeStatsSnapshot = null,
  getWorkerRuntimeTelemetrySnapshot = null,
  activeThemeId = '',
  renderPressureLevel = 'normal',
  renderBudgetPolicyId = '',
  entityCount = 0,
  totalSpawned = 0,
  totalSplitSpawned = 0,
  globalSentinelStats = null,
} = {}) {
  if (workerRuntimeActive) {
    const stats = typeof getWorkerRuntimeStatsSnapshot === 'function'
      ? getWorkerRuntimeStatsSnapshot()
      : null;
    return {
      runtime: 'worker',
      renderPressureLevel: normalizeRenderPressureLevel(stats?.renderPressureLevel, 'normal'),
      renderBudgetPolicyId: typeof stats?.renderBudgetPolicyId === 'string'
        ? stats.renderBudgetPolicyId
        : '',
      liveCount: roundMetric(stats?.liveCount, 0, 400),
      totalSpawned: roundMetric(stats?.totalSpawned, 0, 4000),
      totalSplitSpawned: roundMetric(stats?.totalSplitSpawned, 0, 4000),
      render: readRenderMetrics(stats),
      globalSentinel: resolveGlobalSentinelTelemetry(stats),
      telemetry: activeThemeId === 'zen' && typeof getWorkerRuntimeTelemetrySnapshot === 'function'
        ? (getWorkerRuntimeTelemetrySnapshot() || null)
        : null,
    };
  }

  return {
    runtime: 'main',
    renderPressureLevel: normalizeRenderPressureLevel(renderPressureLevel, 'normal'),
    renderBudgetPolicyId,
    liveCount: roundMetric(entityCount, 0, 400),
    totalSpawned: roundMetric(totalSpawned, 0, 4000),
    totalSplitSpawned: roundMetric(totalSplitSpawned, 0, 4000),
    render: readRenderMetrics(globalSentinelStats),
    globalSentinel: resolveGlobalSentinelTelemetry(globalSentinelStats),
    telemetry: null,
  };
}

export function createInitialSentinelHudTelemetryText({
  activeThemeId = '',
  translate,
}) {
  return translate(
    'tools:sentinel_flare_protocol.telemetry',
    {
      context: activeThemeId,
      percent: 0,
      runtime: translate(
        'tools:sentinel_flare_protocol.telemetry_runtime_main',
        { context: activeThemeId },
      ),
      quality: translate(
        'tools:sentinel_flare_protocol.telemetry_quality_high',
        { context: activeThemeId },
      ),
      live: 0,
      total: 0,
      split: 0,
    },
  );
}

export function formatSentinelHudTelemetryText({
  syncPercent = 0,
  protocolProgress = null,
  snapshot,
  activeThemeId = '',
  activeTheme = null,
  runtimeStage = 'idle',
  sceneClassName = '',
  lastRuntimeError = '',
  runtimeContext = null,
  translate,
}) {
  if (protocolProgress?.protocolSystem === GLOBAL_SENTINEL_PROTOCOL_SYSTEM || protocolProgress?.protocolScope === 'global') {
    return formatGlobalSentinelTelemetry({ snapshot, protocolProgress, runtimeContext, runtimeStage, lastRuntimeError });
  }
  const runtimeKey = snapshot?.runtime === 'worker' ? 'worker' : 'main';
  const runtimeLabel = translate(
    `tools:sentinel_flare_protocol.telemetry_runtime_${runtimeKey}`,
    { context: activeThemeId },
  );
  const renderPressureLabel = normalizeRenderPressureLevel(
    snapshot?.renderPressureLevel,
    'normal',
  ).toUpperCase();
  const primaryLine = translate(
    'tools:sentinel_flare_protocol.telemetry',
    {
      context: activeThemeId,
      percent: roundMetric(syncPercent, 0, 100),
      runtime: runtimeLabel,
      quality: renderPressureLabel,
      live: roundMetric(snapshot?.liveCount, 0, 400),
      total: roundMetric(snapshot?.totalSpawned, 0, 4000),
      split: roundMetric(snapshot?.totalSplitSpawned, 0, 4000),
    },
  );
  const protocolLines = resolveProtocolProgressTelemetryLines(protocolProgress);
  const zenTelemetry = snapshot?.telemetry || null;
  if (!zenTelemetry || activeThemeId !== 'zen') {
    const lines = [primaryLine, ...protocolLines];
    if (lastRuntimeError) {
      lines.push(`ERR ${lastRuntimeError}`);
    }
    return lines.join('\n');
  }

  const lines = [
    primaryLine,
    ...protocolLines,
    `STAGE ${runtimeStage} | THEME ${activeThemeId || '-'} | SHAPE ${activeTheme?.shape || '-'} | CLASS ${sceneClassName || '-'}`,
    `ACT ${resolveTelemetryMetric(zenTelemetry.activationFirstFrameMs, 1)}MS | SPAWN ${resolveTelemetryMetric(zenTelemetry.activationFirstSpawnMs, 1)}MS | HIT ${resolveTelemetryMetric(zenTelemetry.hitTestEmaMs, 2)}MS`,
    `FRAME ${resolveTelemetryMetric(zenTelemetry.frameEmaMs, 2)} | UPD ${resolveTelemetryMetric(zenTelemetry.updateEmaMs, 2)} | REN ${resolveTelemetryMetric(zenTelemetry.renderEmaMs, 2)} | DRAW/FISH ${resolveTelemetryMetric(zenTelemetry.drawPerFishMs, 2)}`,
    `SYNC ${resolveTelemetryMetric(zenTelemetry.renderSyncEmaMs, 2)} | DRAW ${resolveTelemetryMetric(zenTelemetry.renderDrawEmaMs, 2)} | SPAWN ${resolveTelemetryMetric(zenTelemetry.spawnEmaMs, 2)} | SLOW ${resolveTelemetryMetric(zenTelemetry.slowFramePct, 1)}%`,
  ];
  const spawnLifecycle = zenTelemetry.spawnLifecycle || null;
  if (spawnLifecycle && typeof spawnLifecycle === 'object') {
    lines.push(
      `SPAWN-LC ${String(spawnLifecycle.phase || '-').toUpperCase()} #${roundMetric(spawnLifecycle.requestId, 0, 9999)} | LIVE ${roundMetric(spawnLifecycle.liveCount, 0, 400)} | RENDER ${roundMetric(spawnLifecycle.renderedCount, 0, 400)} | REASON ${spawnLifecycle.rejectReason || spawnLifecycle.reason || '-'}`,
    );
  }
  if (lastRuntimeError) {
    lines.push(`ERR ${lastRuntimeError}`);
  }
  return lines.join('\n');
}

export function publishSentinelTelemetrySnapshot({
  telemetryGlobalKey,
  syncPercent = 0,
  snapshot,
  activeThemeId = '',
  startedAt = 0,
  telemetryConsoleAnnounced = false,
  windowRef = null,
  CustomEventCtor = null,
  consoleRef = null,
} = {}) {
  const targetWindow = resolveWindowRef(windowRef);
  if (!targetWindow || !telemetryGlobalKey) {
    return {
      detail: null,
      telemetryConsoleAnnounced,
    };
  }

  const detail = {
    themeId: activeThemeId,
    syncPercent: roundMetric(syncPercent, 0, 100),
    runtimeMode: snapshot?.runtime || 'main',
    renderPressureLevel: normalizeRenderPressureLevel(snapshot?.renderPressureLevel, 'normal'),
    renderBudgetPolicyId: typeof snapshot?.renderBudgetPolicyId === 'string'
      ? snapshot.renderBudgetPolicyId
      : '',
    liveCount: roundMetric(snapshot?.liveCount, 0, 400),
    totalSpawned: roundMetric(snapshot?.totalSpawned, 0, 4000),
    totalSplitSpawned: roundMetric(snapshot?.totalSplitSpawned, 0, 4000),
    globalSentinel: snapshot?.globalSentinel || null,
    telemetry: snapshot?.telemetry || null,
    startedAt: Math.max(0, Math.round(Number(startedAt) || 0)),
  };

  let didAnnounceTelemetry = telemetryConsoleAnnounced;
  let published = false;
  let publicationError = null;
  let warningError = null;
  try {
    targetWindow[telemetryGlobalKey] = detail;
    const EventCtor = resolveCustomEventCtor(CustomEventCtor);
    if (typeof targetWindow.dispatchEvent === 'function' && EventCtor) {
      targetWindow.dispatchEvent(
        new EventCtor(SENTINEL_TELEMETRY_EVENT, { detail }),
      );
    }
    if (detail.telemetry && !didAnnounceTelemetry) {
      resolveConsoleRef(consoleRef)?.info?.(
        `[sentinel flare] telemetry available at window.${telemetryGlobalKey}`,
        detail,
      );
      didAnnounceTelemetry = true;
    }
    published = true;
  } catch (error) {
    publicationError = getHudTelemetryErrorMessage(error);
    warningError = warnHudTelemetryFailure(
      consoleRef,
      '[sentinel flare] telemetry publication failed',
      {
        telemetryGlobalKey,
        error: publicationError,
      },
    );
  }

  return {
    detail,
    telemetryConsoleAnnounced: didAnnounceTelemetry,
    published,
    error: publicationError,
    warningError,
  };
}
