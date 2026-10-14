import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Clock3, Copy, FlaskConical, MonitorPlay, Play, RefreshCw, Square, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { RangeInput, Select, UiToggle } from '@/ui-kit/index.js';
import { runtimeSendMessage } from '../../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { useProtocolStore, useTheme } from '../../stores/index.js';
import { useProtectionNudgeDispatchControl } from '../../hooks/useProtectionNudgeDispatchControl.js';
import { normalizeNudgeRuntimeContext } from '../../../../domains/nudge/runtime/nudgeRuntimeContext.js';
import {
  DEFAULT_DEBUG_CONFIG,
  normalizeDebugConfig,
} from '../../../../domains/settings/config/debugConfig.js';
import { requireProtocolSyncSuccess } from '../../stores/protocolStoreHelpers.js';
import {
  SENTINEL_FLARE_PROTOCOL_SCOPES,
  SENTINEL_FLARE_PROTOCOL_VARIANTS,
} from '../../../../domains/nudge/runtime/sentinelFlareProtocolProfile.js';
import {
  drawNudgeProtocolSceneBackground,
  drawNudgeProtocolSceneForeground,
  GLOBAL_SIMULATION_BREAK_CRACK_ARCHETYPES,
  resolveGlobalSimulationBreakDebugProfile,
} from '../../../../domains/nudge/rendering/NudgeProtocolSceneBackground.js';

const SPAWN_TARGET_AUTO = 'auto';

const TIMELINE_POLL_INTERVAL_MS = 1500;
const EXTENSION_FRAME_WORKER_RUNTIME = 'extension_frame_worker';
const MAIN_CANVAS_RUNTIME = 'main';
const SIMULATION_BREAK_PREVIEW_ARCHETYPE_AUTO = 'seed';
const SIMULATION_BREAK_PREVIEW_DURATION_MS = 1800;
const SIMULATION_BREAK_PREVIEW_SCENE = Object.freeze({
  protocolIntensity: 0.88,
  background: Object.freeze({
    owner: 'worker_canvas',
    mode: 'global_sentinel_field',
  }),
});
const SIMULATION_BREAK_PREVIEW_DEFAULTS = Object.freeze({
  archetype: SIMULATION_BREAK_PREVIEW_ARCHETYPE_AUTO,
  fracture: 0.44,
  seed: 2468,
  syncPressure: 0.18,
});
const SIMULATION_BREAK_PREVIEW_ARCHETYPE_KEYS = Object.freeze({
  [SIMULATION_BREAK_PREVIEW_ARCHETYPE_AUTO]: 'experiment.sentinel_lab.break_shape_seeded',
  diagonal_spine: 'experiment.sentinel_lab.break_shape_diagonal_spine',
  center_spider: 'experiment.sentinel_lab.break_shape_center_spider',
  edge_tear: 'experiment.sentinel_lab.break_shape_edge_tear',
  horizontal_lcd_split: 'experiment.sentinel_lab.break_shape_horizontal_lcd_split',
});
const SIMULATION_BREAK_PREVIEW_SURFACE_BACKGROUND = [
  'linear-gradient(135deg, rgba(15,23,42,0.18), rgba(255,255,255,0.12))',
  'repeating-linear-gradient(0deg, rgba(125,211,252,0.12) 0, rgba(125,211,252,0.12) 1px, transparent 1px, transparent 34px)',
  'linear-gradient(90deg, rgba(34,197,94,0.16), rgba(248,113,113,0.12), rgba(56,189,248,0.16))',
].join(', ');

const PAGE_WORKER_BLOCK_ERROR_CODES = Object.freeze([
  'worker_script_csp_blocked',
  'worker_script_origin_blocked',
]);

const TIMELINE_PHASE_KEYS = Object.freeze({
  requested: 'experiment.sentinel_lab.timeline_phase_requested',
  background_accepted: 'experiment.sentinel_lab.timeline_phase_background_accepted',
  protected_site_validated: 'experiment.sentinel_lab.timeline_phase_protected_site_validated',
  content_ready: 'experiment.sentinel_lab.timeline_phase_content_ready',
  nudge_dispatched: 'experiment.sentinel_lab.timeline_phase_nudge_dispatched',
  content_rendered: 'experiment.sentinel_lab.timeline_phase_content_rendered',
  worker_probed: 'experiment.sentinel_lab.timeline_phase_worker_probed',
  config_delivered: 'experiment.sentinel_lab.timeline_phase_config_delivered',
  stopped: 'experiment.sentinel_lab.timeline_phase_stopped',
  skipped: 'experiment.sentinel_lab.timeline_phase_skipped',
  failed: 'experiment.sentinel_lab.timeline_phase_failed',
});

const TIMELINE_STATUS_KEYS = Object.freeze({
  info: 'experiment.sentinel_lab.timeline_status_info',
  pending: 'experiment.sentinel_lab.timeline_status_pending',
  success: 'experiment.sentinel_lab.timeline_status_success',
  skipped: 'experiment.sentinel_lab.timeline_status_skipped',
  error: 'experiment.sentinel_lab.timeline_status_error',
});

const TIMELINE_SOURCE_KEYS = Object.freeze({
  experiment_lab: 'experiment.sentinel_lab.timeline_source_experiment_lab',
  runtime: 'experiment.sentinel_lab.timeline_source_runtime',
});

const RENDER_STEP_KEYS = Object.freeze({
  target: 'experiment.sentinel_lab.render_step_target',
  content: 'experiment.sentinel_lab.render_step_content',
  delivery: 'experiment.sentinel_lab.render_step_delivery',
  render: 'experiment.sentinel_lab.render_step_render',
});

const RENDER_STEP_STATUS_KEYS = Object.freeze({
  idle: 'experiment.sentinel_lab.render_step_idle',
  pending: 'experiment.sentinel_lab.render_step_pending',
  success: 'experiment.sentinel_lab.render_step_success',
  error: 'experiment.sentinel_lab.render_step_error',
});

function getTimelineToneClass(status) {
  if (status === 'error') return 'border-rose-400/25 bg-rose-400/8 text-rose-200';
  if (status === 'skipped') return 'border-amber-300/25 bg-amber-300/8 text-amber-100';
  if (status === 'success') return 'border-emerald-400/25 bg-emerald-400/8 text-emerald-100';
  if (status === 'pending') return 'border-accent/25 bg-accent/10 text-accent';
  return 'border-border/20 bg-surface-elevated/25 text-on-surface-muted';
}

function formatTimelineTime(timestamp) {
  const date = new Date(Number(timestamp) || 0);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function describeSentinelLabError(error) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  const message = String(error || '').trim();
  return message || 'SENTINEL_LAB_ACTION_FAILED';
}

function getRenderStepToneClass(status) {
  if (status === 'error') return 'border-rose-400/25 bg-rose-400/8 text-rose-200';
  if (status === 'success') return 'border-emerald-400/25 bg-emerald-400/8 text-emerald-100';
  if (status === 'pending') return 'border-accent/25 bg-accent/10 text-accent';
  return 'border-border/20 bg-surface-elevated/25 text-on-surface-muted';
}

function getRenderStepIcon(status) {
  if (status === 'error') return AlertTriangle;
  if (status === 'success') return CheckCircle2;
  return Circle;
}

function getProbeToneClass(probe = null, { expectedBlocked = false } = {}) {
  if (probe?.ok === true) return 'border-emerald-400/25 bg-emerald-400/8 text-emerald-100';
  if (expectedBlocked) return 'border-border/20 bg-surface-elevated/25 text-on-surface-muted';
  if (!probe) return 'border-border/20 bg-surface-elevated/25 text-on-surface-muted';
  if (
    probe.phase === 'worker_api_unavailable'
    || probe.phase === 'offscreen_canvas_unavailable'
    || probe.phase === 'canvas_transfer_unavailable'
  ) {
    return 'border-amber-300/25 bg-amber-300/8 text-amber-100';
  }
  return 'border-rose-400/25 bg-rose-400/8 text-rose-200';
}

function formatBooleanFlag(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return '-';
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function readBoundedInputNumber(event, min, max, fallback = min) {
  const numeric = Number(event?.target?.value);
  return Number.isFinite(numeric) ? clampNumber(numeric, min, max) : fallback;
}

function formatPreviewScalar(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '-';
}

function formatPreviewPercent(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(clampNumber(numeric, 0, 1) * 100)}%` : '-';
}

function getPreviewNow() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function requestPreviewFrame(callback) {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout(() => callback(getPreviewNow()), 16);
}

function cancelPreviewFrame(frameId) {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(frameId);
    return;
  }
  globalThis.clearTimeout(frameId);
}

function easeOutPreview(value) {
  const t = clampNumber(value, 0, 1);
  return 1 - ((1 - t) ** 3);
}

function resolvePreviewArchetypeOverride(value) {
  return value === SIMULATION_BREAK_PREVIEW_ARCHETYPE_AUTO ? null : value;
}

function buildSimulationBreakPreviewProfile({
  archetype,
  fracture,
  seed,
  syncPressure,
}) {
  return {
    effectiveFracture: clampNumber(fracture, 0, 1),
    effectiveSyncPressure: clampNumber(syncPressure, 0, 1),
    repairPass: 0,
    ...resolveGlobalSimulationBreakDebugProfile({
      archetype: resolvePreviewArchetypeOverride(archetype),
      fracture,
      seed,
      syncPressure,
    }),
  };
}

function drawPreviewSentinelPass(ctx, bounds, progress) {
  const width = Math.max(1, Number(bounds?.width) || 1);
  const height = Math.max(1, Number(bounds?.height) || 1);
  const t = clampNumber(progress, 0, 1);
  if (t <= 0 || t >= 1) return;
  const eased = easeOutPreview(t);
  const x = width * (-0.08 + eased * 1.16);
  const y = height * (0.72 - Math.sin(t * Math.PI) * 0.34);
  const angle = -0.58 + Math.sin(t * Math.PI) * 0.34;
  const scale = Math.max(0.8, Math.min(width, height) / 360);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.32 + Math.sin(t * Math.PI) * 0.34;

  const trail = ctx.createRadialGradient(-28, 0, 0, -28, 0, 72);
  trail.addColorStop(0, 'rgba(5, 10, 16, 0.28)');
  trail.addColorStop(0.48, 'rgba(5, 10, 16, 0.12)');
  trail.addColorStop(1, 'rgba(5, 10, 16, 0)');
  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.ellipse(-30, 0, 76, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(3, 7, 12, 0.88)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(3, 7, 12, 0.76)';
  ctx.beginPath();
  ctx.moveTo(-29, 0);
  ctx.lineTo(-55, -17);
  ctx.lineTo(-47, 0);
  ctx.lineTo(-55, 17);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(3, 7, 12, 0.48)';
  ctx.beginPath();
  ctx.ellipse(8, -12, 18, 5, -0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(8, 12, 18, 5, 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.38 + Math.sin(t * Math.PI) * 0.24;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-18, -1);
  ctx.quadraticCurveTo(4, -8, 24, -2);
  ctx.stroke();
  ctx.restore();
}

function getTraceResponse(trace) {
  return trace?.response && typeof trace.response === 'object' ? trace.response : null;
}

function getSpawnResult(trace) {
  const response = getTraceResponse(trace);
  return response?.spawnResult && typeof response.spawnResult === 'object'
    ? response.spawnResult
    : null;
}

function getWorkerProbe(trace) {
  const response = getTraceResponse(trace);
  return response?.workerProbe && typeof response.workerProbe === 'object'
    ? response.workerProbe
    : null;
}

function getFrameWorkerProbe(trace) {
  const response = getTraceResponse(trace);
  return response?.frameWorkerProbe && typeof response.frameWorkerProbe === 'object'
    ? response.frameWorkerProbe
    : null;
}

function getSpawnDiagnostics(spawnResult = null) {
  return spawnResult?.diagnostics && typeof spawnResult.diagnostics === 'object'
    ? spawnResult.diagnostics
    : null;
}

function getProbeErrorText(probe = null) {
  const attemptErrors = Array.isArray(probe?.bootstrapAttempts)
    ? probe.bootstrapAttempts
      .map((attempt) => attempt?.error)
      .filter(Boolean)
      .join(' ')
    : '';
  return [probe?.error, attemptErrors].filter(Boolean).join(' ');
}

function isPageWorkerScriptBlocked(probe = null) {
  const errorText = getProbeErrorText(probe);
  return PAGE_WORKER_BLOCK_ERROR_CODES.some((code) => errorText.includes(code));
}

function isExtensionFrameWorkerSpawn(spawnResult = null) {
  return spawnResult?.runtime === EXTENSION_FRAME_WORKER_RUNTIME;
}

function isExtensionFrameWorkerRendered(spawnResult = null) {
  return isExtensionFrameWorkerSpawn(spawnResult)
    && spawnResult?.ok === true
    && spawnResult?.phase === 'rendered';
}

function isExpectedPageWorkerProbeBlock({
  frameWorkerProbe = null,
  spawnResult = null,
  workerProbe = null,
} = {}) {
  return isExtensionFrameWorkerRendered(spawnResult)
    && frameWorkerProbe?.ok === true
    && workerProbe?.ok !== true
    && isPageWorkerScriptBlocked(workerProbe);
}

function buildRuntimePathReport({
  frameWorkerProbe = null,
  spawnResult = null,
  workerProbe = null,
} = {}) {
  const diagnostics = getSpawnDiagnostics(spawnResult);
  return {
    primaryRuntime: spawnResult?.runtime || null,
    primaryRuntimeRendered: isExtensionFrameWorkerRendered(spawnResult),
    frameWorkerHostReady: frameWorkerProbe?.ok === true,
    pageWorkerProbeExpectedBlocked: isExpectedPageWorkerProbeBlock({
      frameWorkerProbe,
      spawnResult,
      workerProbe,
    }),
    mainCanvasRenderDetached: isExtensionFrameWorkerSpawn(spawnResult)
      && diagnostics?.hasCanvasContext === false,
    mainCanvasRenderActive: spawnResult?.runtime === MAIN_CANVAS_RUNTIME
      && diagnostics?.hasCanvasContext === true,
    protocolScope: diagnostics?.protocolScope || null,
    protocolVariant: diagnostics?.protocolVariant || null,
    protocolSystem: diagnostics?.protocolSystem || null,
    protocolSceneId: diagnostics?.protocolSceneId || null,
    protocolRenderer: diagnostics?.protocolRenderer || null,
    protocolBackgroundOwner: diagnostics?.protocolBackgroundOwner || null,
    protocolBackgroundMode: diagnostics?.protocolBackgroundMode || null,
    protocolBudgetLabel: diagnostics?.protocolBudgetLabel || null,
    siteFurinReturnProgress: Number.isFinite(Number(diagnostics?.siteFurinReturnProgress))
      ? Number(diagnostics.siteFurinReturnProgress)
      : null,
    siteFurinSchoolCoherence: Number.isFinite(Number(diagnostics?.siteFurinSchoolCoherence))
      ? Number(diagnostics.siteFurinSchoolCoherence)
      : null,
    siteFurinCurrentStrength: Number.isFinite(Number(diagnostics?.siteFurinCurrentStrength))
      ? Number(diagnostics.siteFurinCurrentStrength)
      : null,
    renderBackend: diagnostics?.renderBackend || null,
    effectiveDpr: Number.isFinite(Number(diagnostics?.effectiveDpr))
      ? Number(diagnostics.effectiveDpr)
      : null,
    frameWorkP95Ms: Number.isFinite(Number(diagnostics?.frameWorkP95Ms))
      ? Number(diagnostics.frameWorkP95Ms)
      : null,
    globalSentinelSimulationProgress: Number.isFinite(Number(diagnostics?.globalSentinelSimulationProgress))
      ? Number(diagnostics.globalSentinelSimulationProgress)
      : null,
    globalSentinelDormantCount: Number.isFinite(Number(diagnostics?.globalSentinelDormantCount))
      ? Number(diagnostics.globalSentinelDormantCount)
      : null,
    globalSentinelTargetDormantCount: Number.isFinite(Number(diagnostics?.globalSentinelTargetDormantCount))
      ? Number(diagnostics.globalSentinelTargetDormantCount)
      : null,
    globalSentinelSyncLevel: Number.isFinite(Number(diagnostics?.globalSentinelSyncLevel))
      ? Number(diagnostics.globalSentinelSyncLevel)
      : null,
    globalSentinelSyncRemainingMs: Number.isFinite(Number(diagnostics?.globalSentinelSyncRemainingMs))
      ? Number(diagnostics.globalSentinelSyncRemainingMs)
      : null,
    scenePhase: diagnostics?.scenePhase || null,
    workerRuntimeActive: diagnostics?.workerRuntimeActive === true,
    workerSessionReady: diagnostics?.workerSessionReady === true,
    hostConnected: diagnostics?.hostConnected === true,
  };
}

function formatWorkerBootstrapAttempts(workerProbe = null) {
  const attempts = Array.isArray(workerProbe?.bootstrapAttempts)
    ? workerProbe.bootstrapAttempts
    : [];
  if (!attempts.length) return workerProbe?.bootstrap?.mode || workerProbe?.error || '-';
  return attempts
    .map((attempt) => {
      const mode = attempt?.mode || 'unknown';
      const phase = attempt?.phase || (attempt?.ok === true ? 'ok' : 'failed');
      return `${mode}:${phase}`;
    })
    .join(' / ');
}

function resolveValidationNotice({
  frameWorkerProbe = null,
  spawnResult = null,
  t,
  workerProbe = null,
} = {}) {
  if (spawnResult?.rejectReason) return spawnResult.rejectReason;
  if (isExpectedPageWorkerProbeBlock({ frameWorkerProbe, spawnResult, workerProbe })) {
    return t('experiment.sentinel_lab.validation_frame_success_worker_blocked');
  }
  if (frameWorkerProbe?.error) return frameWorkerProbe.error;
  if (workerProbe?.error) return workerProbe.error;
  return t('experiment.sentinel_lab.validation_copy_hint');
}

export function buildValidationReport({
  dispatchTrace = null,
  frameWorkerProbeTrace = null,
  workerProbeTrace = null,
  contentDiagnostics = null,
  timelineEvents = [],
} = {}) {
  const spawnResult = getSpawnResult(dispatchTrace);
  const workerProbe = getWorkerProbe(workerProbeTrace);
  const frameWorkerProbe = getFrameWorkerProbe(frameWorkerProbeTrace);
  const runtimePath = buildRuntimePathReport({
    frameWorkerProbe,
    spawnResult,
    workerProbe,
  });
  return {
    generatedAt: new Date().toISOString(),
    target: dispatchTrace?.target || workerProbeTrace?.target || frameWorkerProbeTrace?.target || null,
    runtimePath,
    spawn: {
      status: dispatchTrace?.status || null,
      phase: getRenderPhase(dispatchTrace),
      response: getTraceResponse(dispatchTrace),
      spawnResult: spawnResult || null,
    },
    workerProbe: {
      status: workerProbeTrace?.status || null,
      phase: workerProbeTrace?.response?.phase || workerProbe?.phase || null,
      response: getTraceResponse(workerProbeTrace),
      workerProbe: workerProbe || null,
    },
    frameWorkerProbe: {
      status: frameWorkerProbeTrace?.status || null,
      phase: frameWorkerProbeTrace?.response?.phase || frameWorkerProbe?.phase || null,
      response: getTraceResponse(frameWorkerProbeTrace),
      frameWorkerProbe: frameWorkerProbe || null,
    },
    contentDiagnostics: contentDiagnostics || null,
    recentTimelineEvents: Array.isArray(timelineEvents) ? timelineEvents.slice(-12) : [],
  };
}

function getRenderPhase(trace) {
  const response = getTraceResponse(trace);
  const spawnResult = getSpawnResult(trace);
  return response?.phase || spawnResult?.phase || null;
}

function getSpawnRejectReason(trace) {
  const spawnResult = getSpawnResult(trace);
  return typeof spawnResult?.rejectReason === 'string' && spawnResult.rejectReason.trim()
    ? spawnResult.rejectReason.trim()
    : '';
}

function getSpawnLifecycle(trace) {
  const spawnResult = getSpawnResult(trace);
  const diagnostics = spawnResult?.diagnostics && typeof spawnResult.diagnostics === 'object'
    ? spawnResult.diagnostics
    : null;
  const lifecycle = diagnostics?.spawnLifecycle && typeof diagnostics.spawnLifecycle === 'object'
    ? diagnostics.spawnLifecycle
    : null;
  return lifecycle;
}

const WORKER_ACTIVATION_DETAIL_CODES = Object.freeze([
  'worker_blob_bootstrap_unavailable',
  'worker_module_load_failed',
  'worker_script_csp_blocked',
  'worker_script_origin_blocked',
  'worker_script_url_invalid',
]);

function getSpawnFailureCode(trace) {
  const spawnResult = getSpawnResult(trace);
  const rejectReason = getSpawnRejectReason(trace);
  const errorText = String(spawnResult?.error || '');
  const detailCode = WORKER_ACTIVATION_DETAIL_CODES.find((code) => errorText.includes(code));
  if (detailCode) return detailCode;
  if (rejectReason) return rejectReason;
  return errorText || '';
}

function getRecentDiagnosticEvents(contentDiagnostics) {
  return Array.isArray(contentDiagnostics?.events)
    ? contentDiagnostics.events
    : [];
}

function getLatestBootstrapEvent(contentDiagnostics) {
  const events = getRecentDiagnosticEvents(contentDiagnostics);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.event === 'bootstrap_state_observed') return event;
  }
  return null;
}

function getRenderRootCauseKey(trace, contentDiagnostics = null) {
  if (!trace || trace.status === 'idle') return 'experiment.sentinel_lab.render_root_idle';
  if (trace.status === 'resolving' || trace.status === 'dispatching') return 'experiment.sentinel_lab.render_root_pending';
  if (trace.stage === 'target' && trace.error === 'API_UNAVAILABLE') return 'experiment.sentinel_lab.render_root_api_unavailable';
  if (trace.stage === 'target' && trace.error === 'NO_TARGET_TAB') return 'experiment.sentinel_lab.render_root_no_target';
  if (trace.stage === 'target' && trace.error === 'INVALID_TARGET_TAB') return 'experiment.sentinel_lab.render_root_invalid_target';

  const response = getTraceResponse(trace);
  const ensureResult = response?.ensureResult && typeof response.ensureResult === 'object'
    ? response.ensureResult
    : null;
  const ensureReason = ensureResult?.reason || response?.contentReadyReason || '';
  const errorText = String(response?.error || trace.error || '');
  if (ensureResult?.ok === false || ensureReason) {
    if (ensureReason === 'dispatch_ready_timeout' || errorText.includes('dispatch_ready_timeout')) {
      const latestBootstrapEvent = getLatestBootstrapEvent(contentDiagnostics);
      const latestBootstrapStatus = latestBootstrapEvent?.bootstrapStatus || null;
      const sessionStatus = contentDiagnostics?.currentSession?.status || null;
      if (latestBootstrapEvent && !latestBootstrapStatus) {
        return 'experiment.sentinel_lab.render_root_bootstrap_message_invalid';
      }
      if (latestBootstrapStatus === 'bootstrapping') {
        return 'experiment.sentinel_lab.render_root_bootstrap_stalled';
      }
      if ((latestBootstrapStatus === 'receiver_ready' || latestBootstrapStatus === 'active') && sessionStatus === 'injecting') {
        return 'experiment.sentinel_lab.render_root_bootstrap_signal_ignored';
      }
      if (!latestBootstrapEvent && sessionStatus === 'injecting') {
        return 'experiment.sentinel_lab.render_root_loader_no_bootstrap';
      }
      return 'experiment.sentinel_lab.render_root_dispatch_ready_timeout';
    }
    if (ensureReason === 'content_bootstrap_failed' || errorText.includes('CONTENT_BOOTSTRAP_FAILED')) {
      return 'experiment.sentinel_lab.render_root_bootstrap_failed';
    }
    if (ensureReason === 'inject_failed' || errorText.includes('inject_failed')) {
      return 'experiment.sentinel_lab.render_root_inject_failed';
    }
    if (ensureReason === 'missing_scripting_permission' || errorText.includes('missing_scripting_permission')) {
      return 'experiment.sentinel_lab.render_root_missing_scripting';
    }
    return 'experiment.sentinel_lab.render_root_content_not_ready';
  }

  if (response?.delivery === 'send_error' || errorText.includes('Receiving end does not exist')) {
    return 'experiment.sentinel_lab.render_root_send_failed';
  }

  const phase = getRenderPhase(trace);
  const spawnResult = getSpawnResult(trace);
  if (trace.messageType === 'NUDGE_DEBUG_SPAWN') {
    if (response?.success && phase === 'rendered') return 'experiment.sentinel_lab.render_root_rendered';
    if (phase === 'timeout' || spawnResult?.rejectReason === 'spawn_render_timeout') {
      const lifecycle = getSpawnLifecycle(trace);
      if (spawnResult?.runtime === 'worker' && lifecycle?.phase === 'accepted') {
        return 'experiment.sentinel_lab.render_root_worker_spawn_accepted_timeout';
      }
      if (spawnResult?.runtime === 'worker' && lifecycle?.phase === 'requested') {
        return 'experiment.sentinel_lab.render_root_worker_spawn_requested_timeout';
      }
      return 'experiment.sentinel_lab.render_root_spawn_timeout';
    }
    const rejectReason = getSpawnRejectReason(trace);
    if (rejectReason === 'runtime_start_exception') return 'experiment.sentinel_lab.render_root_runtime_start_exception';
    if (rejectReason === 'canvas_context_missing') return 'experiment.sentinel_lab.render_root_spawn_canvas_missing';
    if (rejectReason === 'live_limit') return 'experiment.sentinel_lab.render_root_spawn_live_limit';
    if (rejectReason === 'total_limit') return 'experiment.sentinel_lab.render_root_spawn_total_limit';
    const failureCode = getSpawnFailureCode(trace);
    if (failureCode === 'worker_script_origin_blocked') {
      return 'experiment.sentinel_lab.render_root_worker_script_origin_blocked';
    }
    if (
      failureCode === 'worker_blob_bootstrap_unavailable'
      || failureCode === 'worker_script_csp_blocked'
      || failureCode === 'worker_script_url_invalid'
      || failureCode === 'worker_module_load_failed'
    ) return 'experiment.sentinel_lab.render_root_worker_bootstrap_failed';
    if (
      rejectReason === 'runtime_inactive'
      || rejectReason === 'worker_runtime_inactive'
      || rejectReason === 'worker_activation_failed'
      || rejectReason === 'worker_activation_timeout'
      || rejectReason === 'worker_boot_timeout'
    ) return 'experiment.sentinel_lab.render_root_spawn_runtime_inactive';
    if (rejectReason === 'worker_render_loop_failed' || rejectReason === 'worker_runtime_error') {
      return 'experiment.sentinel_lab.render_root_worker_runtime_failed';
    }
    if (rejectReason === 'split_limit' || rejectReason === 'split_generation_limit' || rejectReason === 'split_source_missing') {
      return 'experiment.sentinel_lab.render_root_spawn_split_limit';
    }
    if (rejectReason || phase === 'rejected') return 'experiment.sentinel_lab.render_root_spawn_rejected';
    return 'experiment.sentinel_lab.render_root_render_failed';
  }

  if (response?.success) return 'experiment.sentinel_lab.render_root_delivered';
  return 'experiment.sentinel_lab.render_root_unknown';
}

function buildRenderRootCauseParams(trace) {
  const response = getTraceResponse(trace);
  const spawnResult = getSpawnResult(trace);
  const ensureResult = response?.ensureResult && typeof response.ensureResult === 'object'
    ? response.ensureResult
    : null;
  return {
    code: String(
      getSpawnFailureCode(trace)
      || spawnResult?.rejectReason
      || response?.error
      || ensureResult?.reason
      || trace?.error
      || getRenderPhase(trace)
      || 'UNKNOWN',
    ),
  };
}

function buildRenderSteps(trace, contentDiagnostics) {
  const response = getTraceResponse(trace);
  const ensureResult = response?.ensureResult && typeof response.ensureResult === 'object'
    ? response.ensureResult
    : null;
  const spawnResult = getSpawnResult(trace);
  const spawnDiagnostics = spawnResult?.diagnostics && typeof spawnResult.diagnostics === 'object'
    ? spawnResult.diagnostics
    : null;
  const spawnLifecycle = getSpawnLifecycle(trace);
  const spawnErrorDetail = typeof spawnResult?.error === 'string' && spawnResult.error.trim()
    ? spawnResult.error.trim()
    : '';
  const phase = getRenderPhase(trace);
  const isSpawn = trace?.messageType === 'NUDGE_DEBUG_SPAWN';
  const sessionStatus = contentDiagnostics?.currentSession?.status || null;

  const targetStatus = trace?.targetTabId
    ? 'success'
    : trace?.status === 'resolving'
      ? 'pending'
      : trace?.stage === 'target' && trace?.status === 'error'
        ? 'error'
        : 'idle';
  const contentStatus = ensureResult?.ok === false || response?.contentReadyReason
    ? 'error'
    : response?.contentReadySource || ensureResult?.ok === true
      ? 'success'
      : trace?.status === 'dispatching'
        ? 'pending'
        : 'idle';
  const deliveryStatus = contentStatus === 'error'
    ? 'error'
    : response?.delivery && response.delivery !== 'send_error'
      ? 'success'
      : response?.delivery === 'send_error'
      ? 'error'
      : trace?.status === 'dispatching'
        ? 'pending'
        : 'idle';
  const renderStatus = isSpawn && response?.success && phase === 'rendered'
    ? 'success'
    : isSpawn && trace?.status === 'dispatching'
      ? 'pending'
      : isSpawn && (trace?.status === 'error' || response?.success === false || (phase && phase !== 'rendered'))
        ? 'error'
        : 'idle';

  return [
    {
      id: 'target',
      status: targetStatus,
      detail: trace?.target?.host || trace?.target?.title || (trace?.targetTabId ? String(trace.targetTabId) : ''),
    },
    {
      id: 'content',
      status: contentStatus,
      detail: response?.contentReadyReason || ensureResult?.reason || response?.contentReadySource || sessionStatus || '',
    },
    {
      id: 'delivery',
      status: deliveryStatus,
      detail: response?.delivery || response?.error || ensureResult?.reason || '',
    },
    {
      id: 'render',
      status: renderStatus,
      detail: [
        phase,
        spawnResult?.runtime,
        spawnResult?.requestId ? `#${spawnResult.requestId}` : '',
        spawnResult?.rejectReason,
        getSpawnFailureCode(trace) !== spawnResult?.rejectReason ? getSpawnFailureCode(trace) : '',
        spawnErrorDetail && spawnErrorDetail !== spawnResult?.rejectReason ? spawnErrorDetail : '',
        spawnLifecycle
          ? [
            spawnLifecycle.phase ? `lc:${spawnLifecycle.phase}` : '',
            spawnLifecycle.requestId ? `#${spawnLifecycle.requestId}` : '',
            spawnLifecycle.frameCount ? `f:${spawnLifecycle.frameCount}` : '',
          ].filter(Boolean).join('')
          : '',
        spawnDiagnostics
          ? [
            `ctx:${spawnDiagnostics.hasCanvasContext ? 1 : 0}`,
            spawnDiagnostics.activeThemeId ? `theme:${spawnDiagnostics.activeThemeId}` : '',
            spawnDiagnostics.protocolScope
              ? `scope:${spawnDiagnostics.protocolScope}/${spawnDiagnostics.protocolVariant || '-'}`
              : '',
            spawnDiagnostics.protocolSystem ? `system:${spawnDiagnostics.protocolSystem}` : '',
            spawnDiagnostics.protocolSceneId ? `scene:${spawnDiagnostics.protocolSceneId}` : '',
            spawnDiagnostics.protocolRenderer ? `renderer:${spawnDiagnostics.protocolRenderer}` : '',
            spawnDiagnostics.protocolBackgroundOwner || spawnDiagnostics.protocolBackgroundMode
              ? `bg:${spawnDiagnostics.protocolBackgroundOwner || '-'}/${spawnDiagnostics.protocolBackgroundMode || '-'}`
              : '',
            Number.isFinite(Number(spawnDiagnostics.siteFurinReturnProgress))
              ? `return:${Math.round(Number(spawnDiagnostics.siteFurinReturnProgress) * 100)}%`
              : '',
            Number.isFinite(Number(spawnDiagnostics.siteFurinSchoolCoherence))
              ? `school:${Math.round(Number(spawnDiagnostics.siteFurinSchoolCoherence) * 100)}%`
              : '',
            Number.isFinite(Number(spawnDiagnostics.globalSentinelSimulationProgress))
              ? `sentinel:${Math.round(Number(spawnDiagnostics.globalSentinelSimulationProgress) * 100)}%`
              : '',
            Number.isFinite(Number(spawnDiagnostics.globalSentinelSyncLevel))
              ? `sync:${Math.round(Number(spawnDiagnostics.globalSentinelSyncLevel) * 100)}%`
              : '',
            `worker:${spawnDiagnostics.workerRuntimeActive ? 1 : 0}/${spawnDiagnostics.workerSessionReady ? 1 : 0}/${spawnDiagnostics.supportsWorkerRuntime ? 1 : 0}`,
            `engine:${spawnDiagnostics.liveCount ?? '-'}/${spawnDiagnostics.engineLiveLimit ?? spawnDiagnostics.liveLimit ?? '-'}`,
            spawnDiagnostics.renderBackend
              ? `render:${spawnDiagnostics.renderBackend}@${Number(spawnDiagnostics.effectiveDpr || 0).toFixed(1)}x/p95:${Number(spawnDiagnostics.frameWorkP95Ms || 0).toFixed(1)}ms`
              : '',
            `spawned:${spawnDiagnostics.totalSpawned ?? '-'}/${spawnDiagnostics.maxTotalSpawned ?? '-'}`,
          ].filter(Boolean).join(' ')
          : '',
      ].filter(Boolean).join(' / '),
    },
  ];
}

export function buildSentinelRenderDiagnostics(trace, contentDiagnostics = null) {
  return {
    rootCauseKey: getRenderRootCauseKey(trace, contentDiagnostics),
    rootCauseParams: buildRenderRootCauseParams(trace),
    steps: buildRenderSteps(trace, contentDiagnostics),
  };
}

function ProtocolLabPanel({ title, eyebrow, children }) {
  return (
    <section className="min-w-0 rounded-[8px] border border-border/25 bg-surface p-4">
      <div className="mb-4">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-on-surface-muted/70">
          {eyebrow}
        </div>
        <h4 className="mt-1 text-sm font-black uppercase tracking-[0.06em] text-on-surface">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function ToggleLine({ label, description, checked, disabled = false, onChange }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-border/10 py-3">
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-on-surface">{label}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-on-surface-muted">{description}</p>
      </div>
      <UiToggle
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event?.target?.checked === true)}
      />
    </div>
  );
}

function RangeLine({ label, value, min, max, step, output, disabled = false, onChange }) {
  return (
    <div className="border-b border-border/10 py-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
        <span>{label}</span>
        <span className="tabular-nums text-accent">{output}</span>
      </div>
      <RangeInput
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        variant="fader"
        onChange={onChange}
        ariaLabel={label}
      />
    </div>
  );
}

function SegmentButton({ active, disabled = false, children, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-9 rounded-[8px] border px-3 text-[11px] font-black uppercase tracking-[0.08em] transition-colors ${active
        ? 'border-accent/35 bg-accent/15 text-accent'
        : 'border-border/25 bg-surface-elevated/35 text-on-surface-muted hover:border-border/45 hover:text-on-surface'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {children}
    </button>
  );
}

function MetricPill({ label, value, tone = 'muted' }) {
  const toneClass = tone === 'success'
    ? 'border-emerald-400/25 bg-emerald-400/8 text-emerald-100'
    : tone === 'error'
      ? 'border-rose-400/25 bg-rose-400/8 text-rose-200'
      : tone === 'warning'
        ? 'border-amber-300/25 bg-amber-300/8 text-amber-100'
        : 'border-border/20 bg-surface-elevated/25 text-on-surface-muted';
  return (
    <div className={`min-w-0 rounded-[8px] border px-3 py-2 ${toneClass}`}>
      <div className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-current/65">{label}</div>
      <div className="mt-1 truncate text-[12px] font-black tabular-nums">{value || '-'}</div>
    </div>
  );
}

function SimulationBreakPreviewPanel({ t }) {
  const canvasRef = useRef(null);
  const passStartedAtRef = useRef(0);
  const frameRef = useRef(null);
  const [previewState, setPreviewState] = useState(SIMULATION_BREAK_PREVIEW_DEFAULTS);
  const [passNonce, setPassNonce] = useState(0);
  const [previewTelemetry, setPreviewTelemetry] = useState(() => (
    buildSimulationBreakPreviewProfile(SIMULATION_BREAK_PREVIEW_DEFAULTS)
  ));

  const handlePreviewNumberChange = useCallback((key, min, max, transform = (value) => value) => (event) => {
    const fallback = Number(previewState[key]);
    const nextValue = transform(readBoundedInputNumber(event, min, max, fallback));
    passStartedAtRef.current = 0;
    setPreviewState((current) => ({
      ...current,
      [key]: clampNumber(nextValue, min, max),
    }));
  }, [previewState]);

  const handleArchetypeChange = useCallback((event) => {
    passStartedAtRef.current = 0;
    setPreviewState((current) => ({
      ...current,
      archetype: event?.target?.value || SIMULATION_BREAK_PREVIEW_ARCHETYPE_AUTO,
    }));
  }, []);

  const handleInjectSentinel = useCallback(() => {
    passStartedAtRef.current = getPreviewNow();
    setPassNonce((current) => current + 1);
  }, []);

  const handleResetPreview = useCallback(() => {
    passStartedAtRef.current = 0;
    setPreviewState(SIMULATION_BREAK_PREVIEW_DEFAULTS);
    setPassNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return undefined;
    let cancelled = false;

    const draw = (frameTime) => {
      if (cancelled) return;
      const now = Number.isFinite(Number(frameTime)) ? Number(frameTime) : getPreviewNow();
      const elapsed = passStartedAtRef.current > 0 ? now - passStartedAtRef.current : 0;
      const passProgress = passStartedAtRef.current > 0
        ? clampNumber(elapsed / SIMULATION_BREAK_PREVIEW_DURATION_MS, 0, 1)
        : 0;
      const passEase = easeOutPreview(passProgress);
      const passPulse = passProgress > 0 ? Math.sin(passProgress * Math.PI) : 0;
      const effectiveFracture = clampNumber(previewState.fracture - passEase * 0.36 - passPulse * 0.08, 0, 1);
      const effectiveSyncPressure = clampNumber(previewState.syncPressure + passEase * 0.62 + passPulse * 0.12, 0, 1);
      const rect = canvas.getBoundingClientRect();
      const cssWidth = Math.max(1, rect.width || 720);
      const cssHeight = Math.max(1, rect.height || 320);
      const pixelRatio = clampNumber(globalThis.devicePixelRatio || 1, 1, 2);
      const pixelWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
      const pixelHeight = Math.max(1, Math.round(cssHeight * pixelRatio));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const bounds = { width: cssWidth, height: cssHeight };
      const archetypeOverride = resolvePreviewArchetypeOverride(previewState.archetype);
      const renderOptions = {
        fracture: effectiveFracture,
        simulationBreakArchetype: archetypeOverride,
        simulationBreakSeed: previewState.seed,
        syncLevel: effectiveSyncPressure,
        syncPressure: effectiveSyncPressure,
        timeMs: now,
      };
      drawNudgeProtocolSceneBackground(ctx, bounds, SIMULATION_BREAK_PREVIEW_SCENE, renderOptions);
      drawNudgeProtocolSceneForeground(ctx, bounds, SIMULATION_BREAK_PREVIEW_SCENE, renderOptions);
      drawPreviewSentinelPass(ctx, bounds, passProgress);

      const nextTelemetry = buildSimulationBreakPreviewProfile({
        archetype: previewState.archetype,
        fracture: effectiveFracture,
        seed: previewState.seed,
        syncPressure: effectiveSyncPressure,
      });
      setPreviewTelemetry({
        ...nextTelemetry,
        effectiveFracture,
        effectiveSyncPressure,
        repairPass: passProgress,
      });

      if (passProgress > 0 && passProgress < 1) {
        frameRef.current = requestPreviewFrame(draw);
        return;
      }

      if (passProgress >= 1 && passStartedAtRef.current > 0) {
        passStartedAtRef.current = 0;
        setPreviewState((current) => ({
          ...current,
          fracture: effectiveFracture,
          syncPressure: effectiveSyncPressure,
        }));
      }
    };

    frameRef.current = requestPreviewFrame(draw);
    return () => {
      cancelled = true;
      if (frameRef.current !== null) cancelPreviewFrame(frameRef.current);
    };
  }, [passNonce, previewState]);

  return (
    <ProtocolLabPanel
      eyebrow={t('experiment.sentinel_lab.break_preview_eyebrow')}
      title={t('experiment.sentinel_lab.break_preview_title')}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
        <div className="min-w-0">
          <div
            className="relative h-[18rem] min-h-[18rem] overflow-hidden rounded-[8px] border border-border/25 bg-surface-elevated"
            style={{
              background: SIMULATION_BREAK_PREVIEW_SURFACE_BACKGROUND,
            }}
          >
            <canvas
              ref={canvasRef}
              aria-label={t('experiment.sentinel_lab.break_preview_canvas')}
              className="relative z-10 h-full w-full"
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricPill
              label={t('experiment.sentinel_lab.break_metric_fracture')}
              value={formatPreviewPercent(previewTelemetry.effectiveFracture)}
              tone={previewTelemetry.effectiveFracture > 0.58 ? 'warning' : 'muted'}
            />
            <MetricPill
              label={t('experiment.sentinel_lab.break_metric_sync')}
              value={formatPreviewPercent(previewTelemetry.effectiveSyncPressure)}
              tone={previewTelemetry.effectiveSyncPressure > 0.66 ? 'success' : 'muted'}
            />
            <MetricPill
              label={t('experiment.sentinel_lab.break_metric_repair')}
              value={formatPreviewScalar(previewTelemetry.repairPressure)}
              tone={previewTelemetry.repairPressure > 0.5 ? 'success' : 'muted'}
            />
            <MetricPill
              label={t('experiment.sentinel_lab.break_metric_shape')}
              value={t(SIMULATION_BREAK_PREVIEW_ARCHETYPE_KEYS[previewTelemetry.archetype] || SIMULATION_BREAK_PREVIEW_ARCHETYPE_KEYS.seed)}
            />
          </div>
        </div>

        <div className="min-w-0">
          <RangeLine
            label={t('experiment.sentinel_lab.break_control_fracture')}
            value={previewState.fracture}
            min={0}
            max={1}
            step={0.01}
            output={formatPreviewPercent(previewState.fracture)}
            onChange={handlePreviewNumberChange('fracture', 0, 1)}
          />
          <RangeLine
            label={t('experiment.sentinel_lab.break_control_sync')}
            value={previewState.syncPressure}
            min={0}
            max={1}
            step={0.01}
            output={formatPreviewPercent(previewState.syncPressure)}
            onChange={handlePreviewNumberChange('syncPressure', 0, 1)}
          />
          <RangeLine
            label={t('experiment.sentinel_lab.break_control_seed')}
            value={previewState.seed}
            min={0}
            max={9999}
            step={1}
            output={String(Math.round(previewState.seed))}
            onChange={handlePreviewNumberChange('seed', 0, 9999, Math.round)}
          />

          <div className="border-b border-border/10 py-3">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
              {t('experiment.sentinel_lab.break_control_shape')}
            </label>
            <Select
              value={previewState.archetype}
              onChange={handleArchetypeChange}
              aria-label={t('experiment.sentinel_lab.break_control_shape')}
              className="min-h-10 w-full rounded-[8px] border border-border/25 bg-surface-elevated/35 px-3 text-[12px] font-semibold text-on-surface"
            >
              <option value={SIMULATION_BREAK_PREVIEW_ARCHETYPE_AUTO}>
                {t(SIMULATION_BREAK_PREVIEW_ARCHETYPE_KEYS[SIMULATION_BREAK_PREVIEW_ARCHETYPE_AUTO])}
              </option>
              {GLOBAL_SIMULATION_BREAK_CRACK_ARCHETYPES.map((archetype) => (
                <option key={archetype} value={archetype}>
                  {t(SIMULATION_BREAK_PREVIEW_ARCHETYPE_KEYS[archetype])}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleInjectSentinel}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-accent/40 bg-accent/15 px-3 text-[11px] font-black uppercase tracking-[0.08em] text-accent hover:bg-accent/20"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('experiment.sentinel_lab.break_inject_sentinel')}</span>
            </button>
            <button
              type="button"
              onClick={handleResetPreview}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-border/25 bg-surface-elevated/35 px-3 text-[11px] font-black uppercase tracking-[0.08em] text-on-surface-muted hover:border-border/45 hover:text-on-surface"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('experiment.sentinel_lab.break_reset_preview')}</span>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <MetricPill
              label={t('experiment.sentinel_lab.break_metric_length')}
              value={formatPreviewScalar(previewTelemetry.length)}
            />
            <MetricPill
              label={t('experiment.sentinel_lab.break_metric_branch')}
              value={formatPreviewScalar(previewTelemetry.branchPresence)}
            />
            <MetricPill
              label={t('experiment.sentinel_lab.break_metric_aperture')}
              value={formatPreviewScalar(previewTelemetry.aperture)}
            />
            <MetricPill
              label={t('experiment.sentinel_lab.break_metric_debris')}
              value={formatPreviewScalar(previewTelemetry.debrisLeak)}
            />
          </div>
        </div>
      </div>
    </ProtocolLabPanel>
  );
}

function TimelineEventRow({ event, t }) {
  const phaseKey = TIMELINE_PHASE_KEYS[event?.phase] || 'experiment.sentinel_lab.timeline_phase_failed';
  const statusKey = TIMELINE_STATUS_KEYS[event?.status] || 'experiment.sentinel_lab.timeline_status_info';
  const sourceKey = TIMELINE_SOURCE_KEYS[event?.source] || 'experiment.sentinel_lab.timeline_source_runtime';
  const metadata = [
    event?.hostname,
    event?.protocolScope,
    event?.reason,
    event?.delivery,
    event?.error,
  ].filter(Boolean);

  return (
    <li className={`rounded-[8px] border px-3 py-2 ${getTimelineToneClass(event?.status)}`}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-black uppercase tracking-[0.08em]">
            {t(phaseKey)}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[10px] font-semibold text-current/75">
            <span>{t(sourceKey)}</span>
            <span>{t(statusKey)}</span>
            {metadata.slice(0, 4).map((item, index) => (
              <span key={`${item}:${index}`} className="max-w-[13rem] truncate">
                {item}
              </span>
            ))}
          </div>
        </div>
        <time className="shrink-0 text-[10px] font-black tabular-nums text-current/60">
          {formatTimelineTime(event?.recordedAt)}
        </time>
      </div>
    </li>
  );
}

function RenderStepRow({ step, t }) {
  const Icon = getRenderStepIcon(step.status);
  return (
    <li className={`rounded-[8px] border px-3 py-2 ${getRenderStepToneClass(step.status)}`}>
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-black uppercase tracking-[0.08em]">
            {t(RENDER_STEP_KEYS[step.id])}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[10px] font-semibold text-current/75">
            <span>{t(RENDER_STEP_STATUS_KEYS[step.status])}</span>
            {step.detail ? <span className="max-w-[16rem] truncate">{step.detail}</span> : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function RuntimeDiagnosticRow({ event }) {
  const detailParts = event?.event === 'bootstrap_state_observed'
    ? [
      `bootstrap:${event?.bootstrapStatus || 'missing_status'}`,
      `session:${event?.status || 'unknown'}`,
      event?.source,
      event?.bootstrapReason || event?.reason,
      event?.bootstrapError || event?.error,
    ]
    : [
      event?.status,
      event?.source,
      event?.reason,
      event?.error,
    ];
  const detail = detailParts.filter(Boolean).join(' / ');

  return (
    <li className="flex min-w-0 items-center justify-between gap-3 border-b border-border/10 py-2 text-[10px] font-semibold text-on-surface-muted">
      <span className="min-w-0 truncate">{event?.event || ''}</span>
      <span className="max-w-[18rem] truncate text-right text-on-surface-muted/75">{detail}</span>
    </li>
  );
}

function RenderDiagnosticsPanel({
  contentDiagnostics,
  contentDiagnosticsError,
  dispatchTrace,
  onRefreshDiagnostics,
  t,
}) {
  const {
    rootCauseKey,
    rootCauseParams,
    steps,
  } = buildSentinelRenderDiagnostics(dispatchTrace, contentDiagnostics);
  const session = contentDiagnostics?.currentSession || null;
  const diagnosticEvents = Array.isArray(contentDiagnostics?.events)
    ? contentDiagnostics.events.slice(-6).reverse()
    : [];
  const targetLabel = dispatchTrace?.target?.host
    || dispatchTrace?.target?.title
    || (dispatchTrace?.targetTabId ? String(dispatchTrace.targetTabId) : '');
  const sessionLabel = session
    ? [session.status, session.reason, session.error].filter(Boolean).join(' / ')
    : '';

  return (
    <ProtocolLabPanel
      eyebrow={t('experiment.sentinel_lab.render_eyebrow')}
      title={t('experiment.sentinel_lab.render_title')}
    >
      <div className={`rounded-[8px] border px-3 py-3 ${getRenderStepToneClass(dispatchTrace?.status === 'error' ? 'error' : dispatchTrace?.status === 'success' ? 'success' : dispatchTrace?.status === 'idle' ? 'idle' : 'pending')}`}>
        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-current/70">
          {t('experiment.sentinel_lab.render_root_cause')}
        </div>
        <div className="mt-1 text-[12px] font-semibold leading-relaxed">
          {t(rootCauseKey, rootCauseParams)}
        </div>
      </div>

      <ol className="mt-3 grid gap-2 md:grid-cols-2">
        {steps.map((step) => (
          <RenderStepRow key={step.id} step={step} t={t} />
        ))}
      </ol>

      <div className="mt-3 grid gap-2 text-[10px] font-semibold text-on-surface-muted md:grid-cols-2">
        <div className="min-w-0 border-b border-border/10 py-2">
          <div className="font-black uppercase tracking-[0.1em] text-on-surface-muted/70">
            {t('experiment.sentinel_lab.render_last_target')}
          </div>
          <div className="mt-1 truncate text-on-surface">{targetLabel || t('experiment.sentinel_lab.render_no_trace')}</div>
        </div>
        <div className="min-w-0 border-b border-border/10 py-2">
          <div className="font-black uppercase tracking-[0.1em] text-on-surface-muted/70">
            {t('experiment.sentinel_lab.render_current_session')}
          </div>
          <div className="mt-1 truncate text-on-surface">{sessionLabel || t('experiment.sentinel_lab.render_no_diagnostics')}</div>
        </div>
      </div>

      <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
          {t('experiment.sentinel_lab.render_recent_events')}
        </div>
        <button
          type="button"
          onClick={() => onRefreshDiagnostics?.()}
          className="inline-flex min-h-8 items-center justify-center gap-2 rounded-[8px] border border-border/25 bg-surface-elevated/35 px-3 text-[10px] font-black uppercase tracking-[0.08em] text-on-surface-muted hover:border-border/45 hover:text-on-surface"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('experiment.sentinel_lab.render_refresh_diagnostics')}</span>
        </button>
      </div>

      {contentDiagnosticsError ? (
        <div className="mt-2 rounded-[8px] border border-rose-400/25 bg-rose-400/8 px-3 py-2 text-[11px] font-semibold text-rose-200">
          {t('experiment.sentinel_lab.render_diagnostics_error', { error: contentDiagnosticsError })}
        </div>
      ) : null}

      {diagnosticEvents.length > 0 ? (
        <ol className="mt-1 max-h-40 overflow-auto pr-1">
          {diagnosticEvents.map((event) => (
            <RuntimeDiagnosticRow key={event.id} event={event} />
          ))}
        </ol>
      ) : (
        <div className="mt-2 rounded-[8px] border border-border/20 bg-surface-elevated/25 px-3 py-4 text-center text-[11px] font-semibold text-on-surface-muted">
          {t('experiment.sentinel_lab.render_no_diagnostics')}
        </div>
      )}
    </ProtocolLabPanel>
  );
}

function ValidationSummaryPanel({
  contentDiagnostics,
  dispatchTrace,
  frameWorkerProbeTrace,
  onCopyReport,
  t,
  timelineEvents,
  workerProbeTrace,
}) {
  const spawnResult = getSpawnResult(dispatchTrace);
  const workerProbe = getWorkerProbe(workerProbeTrace);
  const frameWorkerProbe = getFrameWorkerProbe(frameWorkerProbeTrace);
  const runtimePath = buildRuntimePathReport({
    frameWorkerProbe,
    spawnResult,
    workerProbe,
  });
  const spawnPhase = getRenderPhase(dispatchTrace);
  const spawnTone = dispatchTrace?.status === 'success' && spawnPhase === 'rendered'
    ? 'success'
    : dispatchTrace?.status === 'error' || (spawnPhase && spawnPhase !== 'rendered')
      ? 'error'
      : 'muted';
  const workerProbeExpectedBlocked = runtimePath.pageWorkerProbeExpectedBlocked;
  const runtimeTone = runtimePath.primaryRuntimeRendered
    ? 'success'
    : runtimePath.mainCanvasRenderActive
      ? 'muted'
      : spawnResult?.runtime
        ? 'warning'
        : 'muted';
  const workerTone = workerProbe?.ok === true
    ? 'success'
    : workerProbeExpectedBlocked
      ? 'muted'
    : workerProbe
      ? 'error'
      : 'muted';
  const frameWorkerTone = frameWorkerProbe?.ok === true
    ? 'success'
    : frameWorkerProbe
      ? 'error'
      : 'muted';
  const surface = workerProbe?.surface || null;
  const support = workerProbe?.support || null;
  const supportLabel = support
    ? [
      `W:${formatBooleanFlag(support.workerApi)}`,
      `O:${formatBooleanFlag(support.offscreenCanvasApi)}`,
      `T:${formatBooleanFlag(support.canvasTransfer)}`,
    ].join(' ')
    : '';
  const report = buildValidationReport({
    dispatchTrace,
    frameWorkerProbeTrace,
    workerProbeTrace,
    contentDiagnostics,
    timelineEvents,
  });
  const validationNotice = resolveValidationNotice({
    frameWorkerProbe,
    spawnResult,
    t,
    workerProbe,
  });
  const workerReadyLabel = workerProbeExpectedBlocked
    ? t('experiment.sentinel_lab.validation_page_worker_blocked')
    : workerProbe?.ready
      ? [workerProbe.ready.type, workerProbe.ready.renderPressureLevel].filter(Boolean).join(' / ')
      : workerProbe?.error || '-';
  const mainCanvasLabel = runtimePath.mainCanvasRenderDetached
    ? t('experiment.sentinel_lab.validation_detached')
    : runtimePath.mainCanvasRenderActive
      ? t('experiment.sentinel_lab.validation_active')
      : '-';
  const hasReport = !!(
    report.spawn.response
    || report.workerProbe.response
    || report.frameWorkerProbe.response
    || contentDiagnostics
  );

  return (
    <ProtocolLabPanel
      eyebrow={t('experiment.sentinel_lab.validation_eyebrow')}
      title={t('experiment.sentinel_lab.validation_title')}
    >
      <div className="grid gap-2 md:grid-cols-6">
        <MetricPill
          label={t('experiment.sentinel_lab.validation_spawn')}
          value={spawnPhase || dispatchTrace?.status || t('experiment.sentinel_lab.render_step_idle')}
          tone={spawnTone}
        />
        <MetricPill
          label={t('experiment.sentinel_lab.validation_runtime')}
          value={spawnResult?.runtime || '-'}
          tone={runtimeTone}
        />
        <MetricPill
          label={t('experiment.sentinel_lab.validation_probe')}
          value={workerProbeExpectedBlocked
            ? t('experiment.sentinel_lab.validation_page_worker_blocked')
            : workerProbe?.phase || workerProbeTrace?.status || t('experiment.sentinel_lab.render_step_idle')}
          tone={workerTone}
        />
        <MetricPill
          label={t('experiment.sentinel_lab.validation_surface')}
          value={[
            surface?.status,
            surface?.bypassedSurfaceForProbe ? 'probe-bypass' : '',
          ].filter(Boolean).join(' / ')}
          tone={surface ? (surface.status === 'active' ? 'success' : 'warning') : 'muted'}
        />
        <MetricPill
          label={t('experiment.sentinel_lab.validation_frame_host')}
          value={frameWorkerProbe
            ? [
              frameWorkerProbe.phase,
              frameWorkerProbe.renderMode,
            ].filter(Boolean).join(' / ')
            : frameWorkerProbeTrace?.status || t('experiment.sentinel_lab.render_step_idle')}
          tone={frameWorkerTone}
        />
        <MetricPill
          label={t('experiment.sentinel_lab.validation_main_canvas')}
          value={mainCanvasLabel}
          tone={runtimePath.mainCanvasRenderActive ? 'warning' : 'muted'}
        />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-5">
        <div className={`min-w-0 rounded-[8px] border px-3 py-2 ${getProbeToneClass(workerProbe, { expectedBlocked: workerProbeExpectedBlocked })}`}>
          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-current/65">
            {t('experiment.sentinel_lab.validation_worker_support')}
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold">{supportLabel || '-'}</div>
        </div>
        <div className={`min-w-0 rounded-[8px] border px-3 py-2 ${getProbeToneClass(workerProbe, { expectedBlocked: workerProbeExpectedBlocked })}`}>
          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-current/65">
            {t('experiment.sentinel_lab.validation_bootstrap')}
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold">
            {formatWorkerBootstrapAttempts(workerProbe)}
          </div>
        </div>
        <div className={`min-w-0 rounded-[8px] border px-3 py-2 ${getProbeToneClass(workerProbe, { expectedBlocked: workerProbeExpectedBlocked })}`}>
          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-current/65">
            {t('experiment.sentinel_lab.validation_ready')}
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold">
            {workerReadyLabel}
          </div>
        </div>
        <div className={`min-w-0 rounded-[8px] border px-3 py-2 ${getProbeToneClass(workerProbe, { expectedBlocked: workerProbeExpectedBlocked })}`}>
          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-current/65">
            {t('experiment.sentinel_lab.validation_activation')}
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold">
            {workerProbe?.activation
              ? [
                workerProbe.activation.type,
                `live:${workerProbe.activation.liveCount ?? '-'}`,
                `${workerProbe.elapsedMs}ms`,
              ].filter(Boolean).join(' / ')
              : workerProbe?.phase || '-'}
          </div>
        </div>
        <div className={`min-w-0 rounded-[8px] border px-3 py-2 ${getProbeToneClass(frameWorkerProbe)}`}>
          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-current/65">
            {t('experiment.sentinel_lab.validation_frame_first_frame')}
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold">
            {frameWorkerProbe?.firstFrame
              ? [
                frameWorkerProbe.firstFrame.source || frameWorkerProbe.renderMode,
                `frames:${frameWorkerProbe.complete?.frameCount ?? frameWorkerProbe.firstFrame.frameCount ?? '-'}`,
                `raf:${formatBooleanFlag(frameWorkerProbe.support?.workerRaf)}`,
                `${frameWorkerProbe.elapsedMs}ms`,
              ].filter(Boolean).join(' / ')
              : frameWorkerProbe?.phase || '-'}
          </div>
        </div>
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-[10px] font-semibold text-on-surface-muted">
          {validationNotice}
        </div>
        <button
          type="button"
          disabled={!hasReport}
          onClick={onCopyReport}
          className="inline-flex min-h-8 items-center justify-center gap-2 rounded-[8px] border border-border/25 bg-surface-elevated/35 px-3 text-[10px] font-black uppercase tracking-[0.08em] text-on-surface-muted hover:border-border/45 hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('experiment.sentinel_lab.validation_copy_report')}</span>
        </button>
      </div>
    </ProtocolLabPanel>
  );
}

export default function SentinelProtocolLab({
  isActive = false,
  nudgeRuntimeContext = null,
}) {
  const { t, i18n } = useAppTranslation('tools');
  const { themeId } = useTheme();
  const {
    debugConfig: storedDebugConfig,
    setDebugConfig,
  } = useProtocolStore(useShallow((state) => ({
    debugConfig: state.debugConfig,
    setDebugConfig: state.setDebugConfig,
  })));
  const resolvedDebugConfig = useMemo(
    () => normalizeDebugConfig(storedDebugConfig, { defaults: DEFAULT_DEBUG_CONFIG }),
    [storedDebugConfig],
  );
  const [statusNotice, setStatusNotice] = useState({ text: '', tone: 'muted' });
  const [timelineSnapshot, setTimelineSnapshot] = useState({
    events: [],
    totalEntries: 0,
    generatedAt: null,
  });
  const [timelineError, setTimelineError] = useState('');
  const resolvedNudgeRuntimeContext = useMemo(() => (
    normalizeNudgeRuntimeContext(nudgeRuntimeContext || {
      themeId,
      language: i18n?.resolvedLanguage || i18n?.language || 'en',
    })
  ), [i18n?.language, i18n?.resolvedLanguage, nudgeRuntimeContext, themeId]);
  const debugEnabled = resolvedDebugConfig.enabled === true;
  const sentinelConfig = resolvedDebugConfig.sentinel || DEFAULT_DEBUG_CONFIG.sentinel;
  const fieldScope = sentinelConfig.defaultProtocolScope === SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL
    ? SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL
    : SENTINEL_FLARE_PROTOCOL_SCOPES.SITE;
  const nudgeConfigOverrides = useMemo(() => ({
    hudVisible: sentinelConfig.hudVisible === true,
    protocolIntensity: Number(sentinelConfig.protocolIntensity),
    protocolScope: fieldScope,
    protocolVariant: fieldScope === SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL
      ? SENTINEL_FLARE_PROTOCOL_VARIANTS.GLOBAL_SENTINEL
      : SENTINEL_FLARE_PROTOCOL_VARIANTS.SITE_FURIN,
  }), [fieldScope, sentinelConfig.hudVisible, sentinelConfig.protocolIntensity]);
  const setStatus = useCallback((text, tone = 'muted') => {
    setStatusNotice({ text, tone });
  }, []);
  const {
    contentDiagnostics,
    contentDiagnosticsError,
    debugConfig: nudgeDebugConfig,
    dispatchTrace,
    frameWorkerProbeTrace,
    handleFrameWorkerProbe,
    handleSpawn,
    handleSpawnTargetTabChange,
    handleStop,
    refreshContentDiagnostics,
    refreshSpawnTargetTabs,
    spawnTargetTabId,
    spawnTargetTabs,
    updateDebugValue,
    workerProbeTrace,
  } = useProtectionNudgeDispatchControl({
    isActive,
    nudgeConfigOverrides,
    nudgeRuntimeContext: resolvedNudgeRuntimeContext,
    setStatus,
    t,
  });

  const statusToneClass = statusNotice.tone === 'error'
    ? 'border-rose-400/30 text-rose-300'
    : statusNotice.tone === 'success'
      ? 'border-emerald-400/30 text-emerald-300'
      : 'border-border/25 text-on-surface-muted';
  const timelineEvents = Array.isArray(timelineSnapshot.events) ? timelineSnapshot.events : [];

  const refreshTimeline = useCallback(async () => {
    const response = await runtimeSendMessage({
      action: MESSAGE_ACTIONS.DEBUG_GET_SENTINEL_PROTOCOL_TIMELINE,
      limit: 40,
    });
    if (response?.success) {
      setTimelineSnapshot(response.snapshot || { events: [], totalEntries: 0, generatedAt: null });
      setTimelineError('');
      return;
    }
    setTimelineError(String(response?.error || 'UNKNOWN_ERROR'));
  }, []);

  useEffect(() => {
    if (!isActive) return undefined;
    refreshTimeline().catch((error) => {
      setTimelineError(describeSentinelLabError(error));
    });
    const intervalId = globalThis.setInterval(() => {
      refreshTimeline().catch((error) => {
        setTimelineError(describeSentinelLabError(error));
      });
    }, TIMELINE_POLL_INTERVAL_MS);
    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [isActive, refreshTimeline]);

  const clearTimeline = useCallback(async () => {
    const response = await runtimeSendMessage({
      action: MESSAGE_ACTIONS.DEBUG_CLEAR_SENTINEL_PROTOCOL_TIMELINE,
    });
    if (response?.success) {
      setTimelineSnapshot(response.snapshot || { events: [], totalEntries: 0, generatedAt: null });
      setTimelineError('');
      return;
    }
    setTimelineError(String(response?.error || 'UNKNOWN_ERROR'));
  }, []);

  const updateDebugConfig = useCallback((patch) => {
    setDebugConfig((current) => ({
      ...normalizeDebugConfig(current, { defaults: DEFAULT_DEBUG_CONFIG }),
      ...patch,
    })).then(requireProtocolSyncSuccess).catch((error) => {
      setStatus(describeSentinelLabError(error), 'error');
    });
  }, [setDebugConfig, setStatus]);

  const updateSentinelConfig = useCallback((patch) => {
    setDebugConfig((current) => {
      const normalized = normalizeDebugConfig(current, { defaults: DEFAULT_DEBUG_CONFIG });
      return {
        ...normalized,
        sentinel: {
          ...normalized.sentinel,
          ...patch,
        },
      };
    }).then(requireProtocolSyncSuccess).catch((error) => {
      setStatus(describeSentinelLabError(error), 'error');
    });
  }, [setDebugConfig, setStatus]);

  const handleIntensityChange = useCallback((event) => {
    updateSentinelConfig({ protocolIntensity: Number(event?.target?.value) });
  }, [updateSentinelConfig]);

  const handleScopeChange = useCallback((scope) => {
    updateSentinelConfig({ defaultProtocolScope: scope });
  }, [updateSentinelConfig]);

  const targetOptions = Array.isArray(spawnTargetTabs) ? spawnTargetTabs : [];
  const handleSpawnAndRefreshTimeline = useCallback(() => {
    void handleSpawn()
      .catch((error) => {
        setStatus(describeSentinelLabError(error), 'error');
      })
      .finally(() => {
        refreshTimeline().catch((error) => {
          setTimelineError(describeSentinelLabError(error));
        });
      });
  }, [handleSpawn, refreshTimeline, setStatus]);
  const handleFrameWorkerProbeAndRefreshTimeline = useCallback(() => {
    void handleFrameWorkerProbe()
      .catch((error) => {
        setStatus(describeSentinelLabError(error), 'error');
      })
      .finally(() => {
        refreshTimeline().catch((error) => {
          setTimelineError(describeSentinelLabError(error));
        });
      });
  }, [handleFrameWorkerProbe, refreshTimeline, setStatus]);
  const handleRunValidation = useCallback(() => {
    void handleSpawn()
      .then(() => handleFrameWorkerProbe())
      .catch((error) => {
        setStatus(describeSentinelLabError(error), 'error');
      })
      .finally(() => {
        refreshTimeline().catch((error) => {
          setTimelineError(describeSentinelLabError(error));
        });
      });
  }, [handleFrameWorkerProbe, handleSpawn, refreshTimeline, setStatus]);
  const handleStopAndRefreshTimeline = useCallback(() => {
    void handleStop()
      .catch((error) => {
        setStatus(describeSentinelLabError(error), 'error');
      })
      .finally(() => {
        refreshTimeline().catch((error) => {
          setTimelineError(describeSentinelLabError(error));
        });
      });
  }, [handleStop, refreshTimeline, setStatus]);
  const handleRefreshDiagnostics = useCallback(() => {
    void refreshContentDiagnostics(dispatchTrace?.targetTabId).catch((error) => {
      setStatus(describeSentinelLabError(error), 'error');
    });
  }, [dispatchTrace?.targetTabId, refreshContentDiagnostics, setStatus]);
  const handleCopyValidationReport = useCallback(() => {
    const report = buildValidationReport({
      dispatchTrace,
      frameWorkerProbeTrace,
      workerProbeTrace,
      contentDiagnostics,
      timelineEvents,
    });
    const text = JSON.stringify(report, null, 2);
    if (!globalThis.navigator?.clipboard?.writeText) {
      setStatus(t('experiment.sentinel_lab.validation_copy_unavailable'), 'error');
      return;
    }
    void globalThis.navigator.clipboard.writeText(text)
      .then(() => {
        setStatus(t('experiment.sentinel_lab.validation_copied'), 'success');
      })
      .catch((error) => {
        setStatus(describeSentinelLabError(error), 'error');
      });
  }, [contentDiagnostics, dispatchTrace, frameWorkerProbeTrace, setStatus, t, timelineEvents, workerProbeTrace]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-auto pr-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <ProtocolLabPanel
        eyebrow={t('experiment.sentinel_lab.mode_eyebrow')}
        title={t('experiment.sentinel_lab.mode_title')}
      >
        <div className="space-y-1">
          <ToggleLine
            label={debugEnabled ? t('experiment.sentinel_lab.debug_enabled') : t('experiment.sentinel_lab.debug_disabled')}
            description={t('experiment.sentinel_lab.debug_desc')}
            checked={debugEnabled}
            onChange={(next) => updateDebugConfig({
              enabled: next,
            })}
          />
          <ToggleLine
            label={t('experiment.sentinel_lab.hud_visible')}
            description={t('experiment.sentinel_lab.hud_visible_desc')}
            checked={sentinelConfig.hudVisible === true}
            disabled={!debugEnabled}
            onChange={(next) => updateSentinelConfig({ hudVisible: next })}
          />
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
            {t('experiment.sentinel_lab.field_scope')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SegmentButton
              active={fieldScope === SENTINEL_FLARE_PROTOCOL_SCOPES.SITE}
              disabled={!debugEnabled}
              onClick={() => handleScopeChange(SENTINEL_FLARE_PROTOCOL_SCOPES.SITE)}
            >
              {t('experiment.sentinel_lab.scope_site')}
            </SegmentButton>
            <SegmentButton
              active={fieldScope === SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL}
              disabled={!debugEnabled}
              onClick={() => handleScopeChange(SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL)}
            >
              {t('experiment.sentinel_lab.scope_global')}
            </SegmentButton>
          </div>
        </div>

        <RangeLine
          label={t('experiment.sentinel_lab.intensity')}
          value={sentinelConfig.protocolIntensity}
          min={0.35}
          max={1}
          step={0.01}
          output={sentinelConfig.protocolIntensity.toFixed(2)}
          disabled={!debugEnabled}
          onChange={handleIntensityChange}
        />
      </ProtocolLabPanel>

      <div className="min-w-0 space-y-4">
        <SimulationBreakPreviewPanel t={t} />
        <ProtocolLabPanel
          eyebrow={t('experiment.sentinel_lab.spawn_eyebrow')}
          title={t('experiment.sentinel_lab.spawn_title')}
        >
        <div className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <Select
            value={spawnTargetTabId}
            disabled={!debugEnabled}
            onChange={handleSpawnTargetTabChange}
            aria-label={t('experiment.sentinel_lab.target_tab')}
            className="min-h-10 rounded-[8px] border border-border/25 bg-surface-elevated/35 px-3 text-[12px] font-semibold text-on-surface"
          >
            <option value={SPAWN_TARGET_AUTO}>{t('experiment.sentinel_lab.target_auto')}</option>
            {targetOptions.map((target) => (
              <option key={target.id} value={String(target.id)}>
                {target.active ? t('experiment.sentinel_lab.target_active_prefix') : ''}
                {target.host || target.title || target.id}
              </option>
            ))}
          </Select>
          <button
            type="button"
            disabled={!debugEnabled}
            onClick={() => {
              void refreshSpawnTargetTabs().catch((error) => {
                setStatus(describeSentinelLabError(error), 'error');
              });
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-border/25 bg-surface-elevated/35 px-3 text-[11px] font-black uppercase tracking-[0.08em] text-on-surface-muted hover:border-border/45 hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('experiment.sentinel_lab.refresh_targets')}</span>
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <button
            type="button"
            disabled={!debugEnabled}
            onClick={handleRunValidation}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-accent/40 bg-accent/15 px-4 text-[11px] font-black uppercase tracking-[0.08em] text-accent hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
          >
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('experiment.sentinel_lab.run_validation')}</span>
          </button>
          <button
            type="button"
            disabled={!debugEnabled}
            onClick={handleSpawnAndRefreshTimeline}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-border/25 bg-surface-elevated/35 px-4 text-[11px] font-black uppercase tracking-[0.08em] text-on-surface-muted hover:border-border/45 hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('experiment.sentinel_lab.spawn_only')}</span>
          </button>
          <button
            type="button"
            disabled={!debugEnabled}
            onClick={handleFrameWorkerProbeAndRefreshTimeline}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-border/25 bg-surface-elevated/35 px-4 text-[11px] font-black uppercase tracking-[0.08em] text-on-surface-muted hover:border-border/45 hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('experiment.sentinel_lab.frame_worker_probe')}</span>
          </button>
          <button
            type="button"
            disabled={!debugEnabled}
            onClick={handleStopAndRefreshTimeline}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-rose-400/30 bg-rose-400/10 px-4 text-[11px] font-black uppercase tracking-[0.08em] text-rose-300 hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-4"
          >
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('experiment.sentinel_lab.stop')}</span>
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <RangeLine
            label={t('experiment.sentinel_lab.live_entities')}
            value={nudgeDebugConfig.maxSprites}
            min={1}
            max={40}
            step={1}
            output={String(nudgeDebugConfig.maxSprites)}
            disabled={!debugEnabled}
            onChange={updateDebugValue('maxSprites', (value) => Math.round(Number(value) || 1))}
          />
          <RangeLine
            label={t('experiment.sentinel_lab.total_spawn_cap')}
            value={nudgeDebugConfig.maxTotalSpawned}
            min={1}
            max={160}
            step={1}
            output={String(nudgeDebugConfig.maxTotalSpawned)}
            disabled={!debugEnabled}
            onChange={updateDebugValue('maxTotalSpawned', (value) => Math.round(Number(value) || 1))}
          />
          <RangeLine
            label={t('experiment.sentinel_lab.split_cap')}
            value={nudgeDebugConfig.maxSplits}
            min={0}
            max={120}
            step={1}
            output={String(nudgeDebugConfig.maxSplits)}
            disabled={!debugEnabled}
            onChange={updateDebugValue('maxSplits', (value) => Math.round(Number(value) || 0))}
          />
          <RangeLine
            label={t('experiment.sentinel_lab.split_generation')}
            value={nudgeDebugConfig.maxSplitGeneration}
            min={0}
            max={8}
            step={1}
            output={String(nudgeDebugConfig.maxSplitGeneration)}
            disabled={!debugEnabled}
            onChange={updateDebugValue('maxSplitGeneration', (value) => Math.round(Number(value) || 0))}
          />
        </div>

        {statusNotice.text ? (
          <div className={`mt-4 rounded-[8px] border bg-surface-elevated/35 px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.08em] ${statusToneClass}`}>
            {statusNotice.text}
          </div>
        ) : null}
      </ProtocolLabPanel>
      <ValidationSummaryPanel
        contentDiagnostics={contentDiagnostics}
        dispatchTrace={dispatchTrace}
        frameWorkerProbeTrace={frameWorkerProbeTrace}
        onCopyReport={handleCopyValidationReport}
        t={t}
        timelineEvents={timelineEvents}
        workerProbeTrace={workerProbeTrace}
      />
      <ProtocolLabPanel
        eyebrow={t('experiment.sentinel_lab.timeline_eyebrow')}
        title={t('experiment.sentinel_lab.timeline_title')}
      >
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
            <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {t('experiment.sentinel_lab.timeline_count', {
                count: timelineSnapshot.totalEntries || timelineEvents.length,
              })}
            </span>
          </div>
          <button
            type="button"
            disabled={timelineEvents.length === 0}
            onClick={() => {
              void clearTimeline().catch((error) => {
                setTimelineError(describeSentinelLabError(error));
              });
            }}
            className="inline-flex min-h-8 items-center justify-center gap-2 rounded-[8px] border border-border/25 bg-surface-elevated/35 px-3 text-[10px] font-black uppercase tracking-[0.08em] text-on-surface-muted hover:border-border/45 hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('experiment.sentinel_lab.timeline_clear')}</span>
          </button>
        </div>

        {timelineError ? (
          <div className="rounded-[8px] border border-rose-400/25 bg-rose-400/8 px-3 py-2 text-[11px] font-semibold text-rose-200">
            {t('experiment.sentinel_lab.timeline_error', { error: timelineError })}
          </div>
        ) : null}

        {timelineEvents.length > 0 ? (
          <ol className="max-h-[22rem] space-y-2 overflow-auto pr-1">
            {timelineEvents.slice().reverse().map((event) => (
              <TimelineEventRow key={event.id} event={event} t={t} />
            ))}
          </ol>
        ) : (
          <div className="rounded-[8px] border border-border/20 bg-surface-elevated/25 px-3 py-6 text-center text-[11px] font-semibold text-on-surface-muted">
            {t('experiment.sentinel_lab.timeline_empty')}
          </div>
        )}
      </ProtocolLabPanel>
      <RenderDiagnosticsPanel
        contentDiagnostics={contentDiagnostics}
        contentDiagnosticsError={contentDiagnosticsError}
        dispatchTrace={dispatchTrace}
        onRefreshDiagnostics={handleRefreshDiagnostics}
        t={t}
      />
      </div>
    </div>
  );
}
