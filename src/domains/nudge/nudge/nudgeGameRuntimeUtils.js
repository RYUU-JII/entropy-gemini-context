import { normalizeDomain } from '../../../lib/domain.js';
import { resolveGlobalSentinelSimulationPolicy } from './nudgeGameGlobalSentinelProtocol.js';
import {
  NUDGE_RENDER_PRESSURE_LEVELS,
} from '../rendering/nudgeRenderPressureGovernor.js';

const GLOBAL_SENTINEL_HIT_AFTERMATH_PHASE_SET = new Set([
  'fracture',
  'reverse-recall',
  'repair-seam-annulment',
]);

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export function normalizeRenderPressureLevel(level, fallback = NUDGE_RENDER_PRESSURE_LEVELS.NORMAL) {
  if (Object.values(NUDGE_RENDER_PRESSURE_LEVELS).includes(level)) return level;
  return Object.values(NUDGE_RENDER_PRESSURE_LEVELS).includes(fallback)
    ? fallback
    : NUDGE_RENDER_PRESSURE_LEVELS.NORMAL;
}

function normalizeWorkerStatCount(value, fallback, max) {
  if (value !== null && typeof value !== 'undefined') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return Math.round(clamp(numeric, 0, max));
  }
  const fallbackNumeric = Number(fallback);
  return Math.round(clamp(Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0, 0, max));
}

function normalizeWorkerStatUnit(value, fallback = 0) {
  if (value !== null && typeof value !== 'undefined') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return clamp(numeric, 0, 1);
  }
  const fallbackNumeric = Number(fallback);
  return clamp(Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0, 0, 1);
}

function normalizeWorkerStatNonNegative(value, fallback = 0, max = 8) {
  if (value !== null && typeof value !== 'undefined') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return clamp(numeric, 0, max);
  }
  const fallbackNumeric = Number(fallback);
  return clamp(Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0, 0, max);
}

export function normalizeSpawnHint(rawHint) {
  const source = rawHint && typeof rawHint === 'object' ? rawHint : {};
  const modeRaw = typeof source.mode === 'string' ? source.mode.trim().toLowerCase() : '';
  const mode = modeRaw === 'center' || modeRaw === 'manual' ? modeRaw : 'auto';
  const heading = Number(source.heading);
  const allowOffscreen = source.allowOffscreen === true;
  return {
    mode,
    xPercent: clamp(source.xPercent, allowOffscreen ? -20 : 0, allowOffscreen ? 120 : 100),
    yPercent: clamp(source.yPercent, 0, 100),
    ...(Number.isFinite(heading) ? { heading } : {}),
    ...(allowOffscreen ? { allowOffscreen } : {}),
  };
}

export function resolveSpawnPointFromHint(rawHint, bounds = null) {
  const hint = normalizeSpawnHint(rawHint);
  if (hint.mode === 'auto') return null;
  const width = Math.max(1, Number(bounds?.width) || 1);
  const height = Math.max(1, Number(bounds?.height) || 1);
  const metadata = {
    ...(hint.allowOffscreen === true ? { allowOffscreen: true } : {}),
  };
  if (hint.mode === 'center') {
    return {
      x: width * 0.5,
      y: height * 0.5,
      ...(Number.isFinite(Number(hint.heading)) ? { heading: Number(hint.heading) } : {}),
      ...metadata,
    };
  }
  return {
    x: width * (hint.xPercent / 100),
    y: height * (hint.yPercent / 100),
    ...(Number.isFinite(Number(hint.heading)) ? { heading: Number(hint.heading) } : {}),
    ...metadata,
  };
}

export const GLOBAL_SENTINEL_RHYTHM_DIAGNOSTIC_KEYS = Object.freeze([
  'globalSentinelRhythmBeatIndex', 'globalSentinelRhythmPhase',
  'globalSentinelRhythmPhaseProgress', 'globalSentinelRhythmSlowMotion',
  'globalSentinelRhythmActIndex', 'globalSentinelRhythmActId',
  'globalSentinelRhythmActProgress', 'globalSentinelRhythmAttemptIndex',
  'globalSentinelRhythmRepairPressure', 'globalSentinelRhythmPhaseRemainingMs',
  'globalSentinelFractureRepairBeatIndex',
]);

export function projectGlobalSentinelRhythmStats(source) {
  // A complete observed clock, including signed idle indices. Do not merge
  // absent fields with a previous frame or the inactive main renderer.
  return Object.fromEntries(GLOBAL_SENTINEL_RHYTHM_DIAGNOSTIC_KEYS.map(key => [key, source?.[key]]));
}

export function normalizeWorkerStatsSnapshot(raw, fallback = null) {
  const base = fallback && typeof fallback === 'object'
    ? fallback
    : {
      renderPressureLevel: NUDGE_RENDER_PRESSURE_LEVELS.NORMAL,
      renderBudgetPolicyId: '',
      renderFrameIntervalEmaMs: 0,
      renderWorkTimeEmaMs: 0,
      renderBackend: '',
      effectiveDpr: 1,
      frameWorkMs: 0,
      updateWorkMs: 0,
      renderWorkMs: 0,
      frameWorkP95Ms: 0,
      frameWorkMaxMs: 0,
      liveCount: 0,
      totalSpawned: 0,
      totalSplitSpawned: 0,
      spriteCacheMode: '',
      spriteCacheHitCount: 0,
      spriteCacheMissCount: 0,
      spriteVectorCount: 0,
      spriteCacheUnavailableCount: 0,
      protocolScope: '',
      protocolVariant: '',
      protocolSystem: '',
      protocolSceneId: '',
      protocolRenderer: '',
      protocolBackgroundOwner: '',
      protocolBackgroundMode: '',
      simulationBreakSeed: 0,
      engineControlClockMode: '',
      engineControlSpawnMode: '',
      engineControlSplitMode: '',
      engineControlInputMode: '',
      engineControlEntityMode: '',
      engineControlRenderMode: '',
      engineControlBlockReason: '',
      protocolProgressPhase: '',
      protocolProgressInteractionOpen: false,

      globalSentinelGamePhase: '',
      globalSentinelBaseSyncPressure: 0,
      globalSentinelSyncPressure: 0,
      globalSentinelSyncPressureRelief: 0,
      globalSentinelSyncPressureFailureThreshold: 1,
      globalSentinelFracture: 0,
      globalSentinelFractureThreshold: resolveGlobalSentinelSimulationPolicy().fractureThreshold,
      globalSentinelIntegrity: 0,
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
      globalSentinelEntryRevealProgress: 0,
      globalSentinelStarterFeedbackSerial: 0,
      globalSentinelStarterFeedbackX: 0,
      globalSentinelStarterFeedbackY: 0,
      globalSentinelLastHitEfficiency: 0,
      globalSentinelLastFractureImpulse: 0,
      globalSentinelLastSyncPressureRelief: 0,
      engineLiveLimit: 0,
    };
  const source = raw && typeof raw === 'object' ? raw : {};
  const spriteCacheMode = typeof source.spriteCacheMode === 'string' && source.spriteCacheMode.trim()
    ? source.spriteCacheMode.trim()
    : (typeof base.spriteCacheMode === 'string' ? base.spriteCacheMode : '');
  const readString = (key) => (typeof source[key] === 'string' && source[key].trim()
    ? source[key].trim()
    : (typeof base[key] === 'string' ? base[key] : ''));
  const hitAftermath = {
    activeCount: normalizeWorkerStatCount(
      source.globalSentinelHitAftermathActiveCount,
      base.globalSentinelHitAftermathActiveCount,
      8,
    ),
    phase: typeof source.globalSentinelHitAftermathPhase === 'string'
      ? source.globalSentinelHitAftermathPhase.trim()
      : (typeof base.globalSentinelHitAftermathPhase === 'string'
        ? base.globalSentinelHitAftermathPhase.trim()
        : ''),
    progress: normalizeWorkerStatUnit(
      source.globalSentinelHitAftermathProgress,
      base.globalSentinelHitAftermathProgress,
    ),
    terminal: typeof source.globalSentinelHitAftermathTerminal === 'boolean'
      ? source.globalSentinelHitAftermathTerminal
      : base.globalSentinelHitAftermathTerminal === true,
    serial: normalizeWorkerStatCount(
      source.globalSentinelHitAftermathSerial,
      base.globalSentinelHitAftermathSerial,
      4000,
    ),
  };
  if (hitAftermath.activeCount > 0) {
    if (!GLOBAL_SENTINEL_HIT_AFTERMATH_PHASE_SET.has(hitAftermath.phase)) {
      throw new Error(`global_sentinel_hit_aftermath_stats_phase_invalid:${hitAftermath.phase || 'missing'}`);
    }
    if (hitAftermath.serial <= 0) {
      throw new Error('global_sentinel_hit_aftermath_stats_serial_invalid');
    }
  } else if (
    hitAftermath.phase
    || hitAftermath.progress > 0
    || hitAftermath.terminal
    || hitAftermath.serial > 0
  ) {
    throw new Error('global_sentinel_hit_aftermath_stats_inactive_payload');
  }
  return {
    renderPressureLevel: normalizeRenderPressureLevel(
      source.renderPressureLevel,
      base.renderPressureLevel,
    ),
    renderBudgetPolicyId: readString('renderBudgetPolicyId'),
    renderFrameIntervalEmaMs: normalizeWorkerStatNonNegative(
      source.renderFrameIntervalEmaMs,
      base.renderFrameIntervalEmaMs,
      1000,
    ),
    renderWorkTimeEmaMs: normalizeWorkerStatNonNegative(
      source.renderWorkTimeEmaMs,
      base.renderWorkTimeEmaMs,
      1000,
    ),
    renderBackend: readString('renderBackend'),
    effectiveDpr: normalizeWorkerStatNonNegative(source.effectiveDpr, base.effectiveDpr, 4),
    frameWorkMs: normalizeWorkerStatNonNegative(source.frameWorkMs, base.frameWorkMs, 1000),
    updateWorkMs: normalizeWorkerStatNonNegative(source.updateWorkMs, base.updateWorkMs, 1000),
    renderWorkMs: normalizeWorkerStatNonNegative(source.renderWorkMs, base.renderWorkMs, 1000),
    frameWorkP95Ms: normalizeWorkerStatNonNegative(source.frameWorkP95Ms, base.frameWorkP95Ms, 1000),
    frameWorkMaxMs: normalizeWorkerStatNonNegative(source.frameWorkMaxMs, base.frameWorkMaxMs, 1000),
    protocolScope: readString('protocolScope'),
    protocolVariant: readString('protocolVariant'),
    protocolSystem: readString('protocolSystem'),
    protocolSceneId: readString('protocolSceneId'),
    protocolRenderer: readString('protocolRenderer'),
    protocolBackgroundOwner: readString('protocolBackgroundOwner'),
    protocolBackgroundMode: readString('protocolBackgroundMode'),
    simulationBreakSeed: normalizeWorkerStatCount(source.simulationBreakSeed, base.simulationBreakSeed, 0x7fffffff),
    engineControlClockMode: readString('engineControlClockMode'),
    engineControlSpawnMode: readString('engineControlSpawnMode'),
    engineControlSplitMode: readString('engineControlSplitMode'),
    engineControlInputMode: readString('engineControlInputMode'),
    engineControlEntityMode: readString('engineControlEntityMode'),
    engineControlRenderMode: readString('engineControlRenderMode'),
    engineControlBlockReason: readString('engineControlBlockReason'),
    protocolProgressPhase: readString('protocolProgressPhase'),
    protocolProgressInteractionOpen: source.protocolProgressInteractionOpen === true
      || (source.protocolProgressInteractionOpen !== false && base.protocolProgressInteractionOpen === true),

    globalSentinelGamePhase: readString('globalSentinelGamePhase'),
    ...projectGlobalSentinelRhythmStats(source),
    globalSentinelBaseSyncPressure: normalizeWorkerStatNonNegative(
      source.globalSentinelBaseSyncPressure,
      base.globalSentinelBaseSyncPressure,
    ),
    globalSentinelSyncPressure: normalizeWorkerStatUnit(
      source.globalSentinelSyncPressure,
      base.globalSentinelSyncPressure,
    ),
    globalSentinelSyncPressureRelief: normalizeWorkerStatUnit(
      source.globalSentinelSyncPressureRelief,
      base.globalSentinelSyncPressureRelief,
    ),
    globalSentinelSyncPressureFailureThreshold: normalizeWorkerStatUnit(
      source.globalSentinelSyncPressureFailureThreshold,
      base.globalSentinelSyncPressureFailureThreshold ?? 1,
    ),
    globalSentinelFracture: normalizeWorkerStatUnit(
      source.globalSentinelFracture,
      base.globalSentinelFracture,
    ),
    globalSentinelFractureThreshold: normalizeWorkerStatUnit(
      source.globalSentinelFractureThreshold,
      base.globalSentinelFractureThreshold ?? resolveGlobalSentinelSimulationPolicy().fractureThreshold,
    ),
    globalSentinelIntegrity: normalizeWorkerStatUnit(
      source.globalSentinelIntegrity,
      base.globalSentinelIntegrity,
    ),
    globalSentinelFractureRepairAmount: normalizeWorkerStatUnit(
      source.globalSentinelFractureRepairAmount,
      base.globalSentinelFractureRepairAmount,
    ),
    globalSentinelFractureRepairPressure: normalizeWorkerStatNonNegative(
      source.globalSentinelFractureRepairPressure,
      base.globalSentinelFractureRepairPressure,
      32,
    ),
    globalSentinelFractureRepairElapsedMs: normalizeWorkerStatNonNegative(
      source.globalSentinelFractureRepairElapsedMs,
      base.globalSentinelFractureRepairElapsedMs,
      10 * 60 * 1000,
    ),
    globalSentinelFractureImpact: normalizeWorkerStatUnit(
      source.globalSentinelFractureImpact,
      base.globalSentinelFractureImpact,
    ),
    globalSentinelFractureImpactStrength: normalizeWorkerStatUnit(
      source.globalSentinelFractureImpactStrength,
      base.globalSentinelFractureImpactStrength,
    ),
    globalSentinelFractureImpactSerial: normalizeWorkerStatCount(
      source.globalSentinelFractureImpactSerial,
      base.globalSentinelFractureImpactSerial,
      4000,
    ),
    globalSentinelFractureImpactX: normalizeWorkerStatUnit(
      source.globalSentinelFractureImpactX,
      base.globalSentinelFractureImpactX,
    ),
    globalSentinelFractureImpactY: normalizeWorkerStatUnit(
      source.globalSentinelFractureImpactY,
      base.globalSentinelFractureImpactY,
    ),
    globalSentinelHitAftermathActiveCount: hitAftermath.activeCount,
    globalSentinelHitAftermathPhase: hitAftermath.phase,
    globalSentinelHitAftermathProgress: hitAftermath.progress,
    globalSentinelHitAftermathTerminal: hitAftermath.terminal,
    globalSentinelHitAftermathSerial: hitAftermath.serial,
    globalSentinelEntryRevealProgress: normalizeWorkerStatUnit(
      source.globalSentinelEntryRevealProgress,
      base.globalSentinelEntryRevealProgress,
    ),
    globalSentinelStarterFeedbackSerial: normalizeWorkerStatCount(
      source.globalSentinelStarterFeedbackSerial,
      base.globalSentinelStarterFeedbackSerial,
      4000,
    ),
    globalSentinelStarterFeedbackX: normalizeWorkerStatUnit(
      source.globalSentinelStarterFeedbackX,
      base.globalSentinelStarterFeedbackX,
    ),
    globalSentinelStarterFeedbackY: normalizeWorkerStatUnit(
      source.globalSentinelStarterFeedbackY,
      base.globalSentinelStarterFeedbackY,
    ),
    globalSentinelLastHitEfficiency: normalizeWorkerStatUnit(
      source.globalSentinelLastHitEfficiency,
      base.globalSentinelLastHitEfficiency,
    ),
    globalSentinelLastFractureImpulse: normalizeWorkerStatUnit(
      source.globalSentinelLastFractureImpulse,
      base.globalSentinelLastFractureImpulse,
    ),
    globalSentinelLastSyncPressureRelief: normalizeWorkerStatUnit(
      source.globalSentinelLastSyncPressureRelief,
      base.globalSentinelLastSyncPressureRelief,
    ),
    engineLiveLimit: normalizeWorkerStatCount(source.engineLiveLimit, base.engineLiveLimit, 400),
    liveCount: normalizeWorkerStatCount(source.liveCount, base.liveCount, 400),
    totalSpawned: normalizeWorkerStatCount(source.totalSpawned, base.totalSpawned, 4000),
    totalSplitSpawned: normalizeWorkerStatCount(
      source.totalSplitSpawned,
      base.totalSplitSpawned,
      4000,
    ),
    spriteCacheMode,
    spriteCacheHitCount: normalizeWorkerStatCount(
      source.spriteCacheHitCount,
      base.spriteCacheHitCount,
      4000,
    ),
    spriteCacheMissCount: normalizeWorkerStatCount(
      source.spriteCacheMissCount,
      base.spriteCacheMissCount,
      4000,
    ),
    spriteVectorCount: normalizeWorkerStatCount(
      source.spriteVectorCount,
      base.spriteVectorCount,
      4000,
    ),
    spriteCacheUnavailableCount: normalizeWorkerStatCount(
      source.spriteCacheUnavailableCount,
      base.spriteCacheUnavailableCount,
      4000,
    ),
  };
}

function hexToRgb(hex) {
  const raw = (hex || '').replace('#', '').trim();
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return { r, g, b };
  }
  if (raw.length >= 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return { r, g, b };
  }
  return { r: 12, g: 15, b: 20 };
}

export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function parseHostnameFromNudgeKey(key) {
  if (typeof key !== 'string') return '';
  const separatorAt = key.indexOf('|');
  if (separatorAt < 0 || separatorAt >= key.length - 1) return '';
  const rawHost = key.slice(separatorAt + 1);
  return normalizeDomain(rawHost) || '';
}
