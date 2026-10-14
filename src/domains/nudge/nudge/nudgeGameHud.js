import { setInlineStyle, setText } from '../visual/index.js';
import { GLOBAL_SENTINEL_PROTOCOL_SYSTEM, resolveGlobalSentinelSimulationPolicy } from './nudgeGameGlobalSentinelProtocol.js';
import { clamp } from './nudgeGameRuntimeUtils.js';
import { SITE_FURIN_PROTOCOL_SYSTEM } from './nudgeGameSiteFurinProtocol.js';

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toPercent(value) {
  return Math.round(clamp(toFiniteNumber(value), 0, 1) * 100);
}

function toRatioPercent(value, target, fallbackTarget = 1) {
  const denominator = Math.max(0.001, toFiniteNumber(target, fallbackTarget));
  return Math.round(clamp(toFiniteNumber(value) / denominator, 0, 1) * 100);
}

function toCount(value) {
  return Math.max(0, Math.round(toFiniteNumber(value)));
}

function toPhaseLabel(value) {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : 'running';
  return raw.replace(/_/g, ' ').toUpperCase();
}

function translateHud(translate, key, options) {
  if (typeof translate !== 'function') return '';
  const translated = translate(key, options);
  return typeof translated === 'string' ? translated : '';
}

function resolveGlobalSentinelHudState({
  progress = null,
  syncLevel = 0,
  activeThemeId = '',
  translate,
} = {}) {
  const fracture = clamp(toFiniteNumber(progress?.fracture, progress?.progress), 0, 1);
  const fractureThreshold = clamp(toFiniteNumber(progress?.fractureThreshold,
    resolveGlobalSentinelSimulationPolicy(null).fractureThreshold), 0.001, 1);
  const restorePressure = clamp(toFiniteNumber(progress?.syncPressure, syncLevel), 0, 1);
  const restoreThreshold = clamp(toFiniteNumber(progress?.syncPressureFailureThreshold, 1), 0.001, 1);
  const breakProgressPercent = toRatioPercent(fracture, fractureThreshold);
  const breakPercent = toPercent(fracture);
  const breakTargetPercent = toPercent(fractureThreshold);
  const restorePercent = toRatioPercent(restorePressure, restoreThreshold);
  const reliefPercent = toPercent(progress?.syncPressureRelief);
  const integrityPercent = toPercent(progress?.sentinelIntegrity ?? (1 - fracture));
  const strokes = toCount(progress?.strokeCount);
  const phase = toPhaseLabel(progress?.gamePhase || progress?.outcome);
  const context = {
    context: activeThemeId,
    breakPercent,
    breakTargetPercent,
    breakProgressPercent,
    restorePercent,
    reliefPercent,
    integrityPercent,
    strokes,
    phase,
    seconds: (Math.max(0, toFiniteNumber(progress?.remainingMs)) / 1000).toFixed(1),
  };

  return {
    meterValue: breakProgressPercent / 100,
    meterLabel: translateHud(
      translate,
      'tools:sentinel_flare_protocol.global_sentinel_hud_meter',
      context,
    ),
    status: translateHud(
      translate,
      'tools:sentinel_flare_protocol.global_sentinel_hud_status',
      context,
    ),
    hint: translateHud(
      translate,
      progress?.gamePhase === 'awaiting_start'
        ? 'tools:sentinel_flare_protocol.global_sentinel_hud_waiting'
        : (progress?.completed || progress?.failed
          ? 'tools:sentinel_flare_protocol.global_sentinel_hud_finished'
          : 'tools:sentinel_flare_protocol.global_sentinel_hud_hint'),
      context,
    ),
    telemetryPercent: toPercent(syncLevel),
  };
}

function resolveSiteFurinHudState({ progress } = {}) {
  return { meterValue: progress.progress,
    meterLabel: `${Math.round(progress.visibleElapsedMs)} / ${progress.durationMs} ms`,
    status: progress.phase,
    hint: 'FURIN · visible interval',
    telemetryPercent: Math.round(progress.progress * 100) };
}

function resolveSentinelHudState({
  progress = null,
  syncLevel = 0,
  activeThemeId = '',
  translate,
} = {}) {
  if (progress?.protocolSystem === GLOBAL_SENTINEL_PROTOCOL_SYSTEM || progress?.protocolScope === 'global') {
    return resolveGlobalSentinelHudState({
      progress,
      syncLevel,
      activeThemeId,
      translate,
    });
  }
  if (progress?.protocolSystem === SITE_FURIN_PROTOCOL_SYSTEM || progress?.protocolScope === 'site') {
    return resolveSiteFurinHudState({
      progress,
      syncLevel,
      activeThemeId,
      translate,
    });
  }
  const pct = toPercent(syncLevel);
  return {
    meterValue: clamp(syncLevel, 0, 1),
    meterLabel: translateHud(
      translate,
      'tools:sentinel_flare_protocol.sync_level',
      { context: activeThemeId, percent: pct },
    ),
    status: '',
    hint: '',
    telemetryPercent: pct,
  };
}

export function setSentinelModalText({
  shadowRoot = null,
  title = '',
  body = '',
  message = null,
  defaults = null,
} = {}) {
  const resolvedDefaults = defaults && typeof defaults === 'object' ? defaults : {};
  const resolvedMessage = message && typeof message === 'object' ? message : {};
  const titleEl = shadowRoot?.getElementById?.('nudgeTitle');
  const bodyEl = shadowRoot?.getElementById?.('nudgeBody');
  const continueEl = shadowRoot?.getElementById?.('nudgeContinueBtn');
  const leaveEl = shadowRoot?.getElementById?.('nudgeLeaveBtn');
  const tagEl = shadowRoot?.getElementById?.('nudgeModalTag');
  const driftTitleEl = shadowRoot?.getElementById?.('nudgeChoiceDriftTitle');
  const driftDescEl = shadowRoot?.getElementById?.('nudgeChoiceDriftDesc');
  const escapeTitleEl = shadowRoot?.getElementById?.('nudgeChoiceEscapeTitle');
  const escapeDescEl = shadowRoot?.getElementById?.('nudgeChoiceEscapeDesc');

  if (titleEl) setText(titleEl, title || resolvedDefaults?.message?.title || '');
  if (bodyEl) setText(bodyEl, body || resolvedDefaults?.message?.body || '');
  if (continueEl) setText(continueEl, resolvedMessage?.primaryCta || resolvedDefaults?.message?.primaryCta || '');
  if (leaveEl) setText(leaveEl, resolvedMessage?.secondaryCta || resolvedDefaults?.message?.secondaryCta || '');
  if (tagEl) setText(tagEl, resolvedMessage?.systemTag || resolvedDefaults?.message?.systemTag || '');
  if (driftTitleEl) setText(driftTitleEl, resolvedMessage?.primaryCta || resolvedDefaults?.message?.primaryCta || '');
  if (driftDescEl) setText(driftDescEl, resolvedMessage?.primaryDesc || resolvedDefaults?.message?.primaryDesc || '');
  if (escapeTitleEl) setText(escapeTitleEl, resolvedMessage?.secondaryCta || resolvedDefaults?.message?.secondaryCta || '');
  if (escapeDescEl) setText(escapeDescEl, resolvedMessage?.secondaryDesc || resolvedDefaults?.message?.secondaryDesc || '');
}

export function setSentinelHudText({
  protocol = null,
  defaults = null,
  hudTitle = null,
  hudStatus = null,
  hudHint = null,
  hudMeterLabel = null,
  hudTelemetry = null,
  activeThemeId = '',
  buildStamp = '',
  protocolScope = '',
  translate,
  createInitialTelemetryText,
} = {}) {
  const resolvedDefaults = defaults && typeof defaults === 'object' ? defaults : {};
  const resolvedProtocol = protocol && typeof protocol === 'object'
    ? protocol
    : (resolvedDefaults.protocol || {});

  if (hudTitle) {
    const baseTitle = protocolScope === 'global'
      ? translate('tools:sentinel_flare_protocol.global_sentinel_hud_title')
      : (resolvedProtocol.title || resolvedDefaults?.protocol?.title || '');
    setText(hudTitle, baseTitle);
    // Keep the exact build available to inspection without expanding the HUD.
    hudTitle.title = `${baseTitle} · ${buildStamp}`;
  }
  if (hudStatus) setText(hudStatus, resolvedProtocol.subtitle || resolvedDefaults?.protocol?.subtitle || '');
  if (hudHint) setText(hudHint, resolvedProtocol.hint || resolvedDefaults?.protocol?.hint || '');
  if (hudMeterLabel) {
    setText(
      hudMeterLabel,
      translate(
        'tools:sentinel_flare_protocol.sync_level',
        { context: activeThemeId, percent: 0 },
      ),
    );
  }
  if (hudTelemetry) {
    setText(
      hudTelemetry,
      protocolScope === 'global' ? translate('tools:sentinel_flare_protocol.global_sentinel_hud_boot') : createInitialTelemetryText({
        activeThemeId,
        translate,
      }),
    );
  }
}

export function updateSentinelHud({
  syncLevel = 0,
  protocolProgress = null,
  lastHudUpdateAt = 0,
  updateIntervalMs = 200,
  hudStatus = null,
  hudHint = null,
  hudMeter = null,
  hudMeterLabel = null,
  hudTelemetry = null,
  activeThemeId = '',
  translate,
  formatTelemetryText,
  publishTelemetrySnapshot,
  now = Date.now(),
} = {}) {
  if (now - lastHudUpdateAt < updateIntervalMs) return lastHudUpdateAt;

  const hudState = resolveSentinelHudState({
    progress: protocolProgress,
    syncLevel,
    activeThemeId,
    translate,
  });
  if (hudStatus) setText(hudStatus, hudState.status);
  if (hudHint) setText(hudHint, hudState.hint);
  if (hudMeter) setInlineStyle(hudMeter, 'width', `${toPercent(hudState.meterValue)}%`);
  if (hudMeterLabel) setText(hudMeterLabel, hudState.meterLabel);
  if (hudTelemetry) {
    setText(hudTelemetry, formatTelemetryText(hudState.telemetryPercent, protocolProgress));
  }
  publishTelemetrySnapshot(hudState.telemetryPercent);
  return now;
}
