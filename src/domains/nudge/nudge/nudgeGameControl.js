import {
  runtimeCanSendMessage,
  runtimeGetURL,
  runtimeSendMessageReliable,
} from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';

export const SENTINEL_ROOM_478_PAGE_PATH = 'src/pages/room-478.html';

export async function closeSiteFurinTab({
  admissionLease,
  sendRuntimeMessage = runtimeSendMessageReliable,
} = {}) {
  const result = await sendRuntimeMessage({
    action: MESSAGE_ACTIONS.SITE_FURIN_CLOSE_CURRENT_TAB, admissionLease,
  }, { timeoutMs: 2_000 });
  if (result?.ok !== true || result.response?.success !== true || result.response?.outcome !== 'closed') {
    const reason = result?.response?.refusalReason || result?.response?.error || result?.error || 'UNCONFIRMED';
    throw new Error(`SITE_FURIN_TAB_CLOSE_FAILED:${reason}`);
  }
  return result.response;
}

export function buildSentinelStartMetadata({
  nextConfig = null,
  mergeConfig,
  stripConfigRuntimeMeta,
  now = Date.now(),
} = {}) {
  const resolvedNextConfig = nextConfig && typeof nextConfig === 'object' ? nextConfig : null;
  return {
    config: mergeConfig(stripConfigRuntimeMeta(resolvedNextConfig)),
    mode: resolvedNextConfig?.__mode === 'debug' ? 'debug' : 'auto',
    activeNudgeKey: typeof resolvedNextConfig?.__nudgeKey === 'string' ? resolvedNextConfig.__nudgeKey : null,
    activeNudgeRunId: typeof resolvedNextConfig?.__nudgeRunId === 'string' ? resolvedNextConfig.__nudgeRunId : null,
    lifecycleFinalAction: null,
    lifecyclePresentedSent: false,
    startedAtMs: now,
  };
}

export function buildSentinelRuntimeResetState() {
  return {
    entities: [],
    totalSpawned: 0,
    totalSplitSpawned: 0,
    entitySerial: 0,
    splitTimerMs: 0,
    frameCounter: 0,
    frameTimeEmaMs: 16.67,
    renderPressureFrames: 0,
    renderRecoveryFrames: 0,
    renderPressureLevel: 'normal',
    renderBudgetPolicyId: 'nudge-normal',
    speedScalar: 1,
    protocolStartAt: 0,
    lastHudUpdateAt: 0,
    telemetryConsoleAnnounced: false,
    telemetryPublication: null,
    lastRuntimeError: '',
    runtimeStage: 'idle',
  };
}

export function applySentinelConfigToMainEntities({
  config,
  entities = [],
  enforceEntityBudget,
} = {}) {
  const baseSize = config.spriteSizePx;
  const baseSpeed = config.baseSpeedPxPerSec;
  for (const entity of entities) {
    if (entity?.koiActor?.kind === 'shadow_koi_actor' && typeof entity.koiActor.applyRuntimeConfig === 'function') {
      entity.koiActor.applyRuntimeConfig(config);
      continue;
    }
    const sizeRatio = Number(entity.sizeRatio) || 1;
    const speedRatio = Number(entity.speedRatio) || 1;
    entity.size = baseSize * sizeRatio;
    entity.baseSpeed = baseSpeed * speedRatio;
    entity.hitRadius = entity.size * 0.5;
  }
  enforceEntityBudget();
}

export function buildSentinelDebugRuntimeSnapshot({
  telemetry,
  isWorkerRuntimeActive = false,
  hasCanvasContext = false,
  spawnTimerActive = false,
  runtimeStage = 'idle',
  lastRuntimeError = '',
  telemetryPublication = null,
} = {}) {
  return {
    workerRuntimeActive: isWorkerRuntimeActive,
    runtimeMode: telemetry.runtime,
    runtimeStage,
    lastRuntimeError,
    renderPressureLevel: telemetry.renderPressureLevel,
    renderBudgetPolicyId: telemetry.renderBudgetPolicyId,
    liveCount: telemetry.liveCount,
    totalSpawned: telemetry.totalSpawned,
    totalSplitSpawned: telemetry.totalSplitSpawned,
    telemetry: telemetry.telemetry || null,
    telemetryPublication,
    spawnTimerActive,
    hasCanvasContext,
  };
}

export function isSentinelGameActive({
  root = null,
  startedAtMs = 0,
} = {}) {
  return !!(
    root
    && root.isConnected
    && root.style.display !== 'none'
    && startedAtMs > 0
  );
}

export function reportSentinelRuntimeRecoveryFailure(
  phase,
  error,
  consoleRef = console,
) {
  const normalizedPhase = typeof phase === 'string' && phase.trim()
    ? phase.trim()
    : 'unknown';
  const diagnostic = {
    code: `sentinel_flare_runtime_${normalizedPhase}_failed`,
    error: String(error?.message || error || 'runtime_recovery_failed'),
  };
  if (consoleRef && typeof consoleRef.warn === 'function') {
    consoleRef.warn('[sentinel flare] runtime recovery failed', diagnostic);
  }
  return diagnostic;
}

function reportSentinelNavigationFailure(phase, error, consoleRef = console) {
  const code = `sentinel_flare_navigation_${phase}_failed`;
  if (!consoleRef || typeof consoleRef.warn !== 'function') {
    return { code, error: String(error?.message || error || code) };
  }
  const diagnostic = {
    code,
    error: String(error?.message || error || code),
  };
  consoleRef.warn('[sentinel flare] navigation recovery failed', diagnostic);
  return diagnostic;
}

function resolveSentinelRuntimeNavigationFailure(result) {
  if (result?.ok !== true) {
    return result?.error || 'RUNTIME_NAVIGATION_SEND_FAILED';
  }
  if (result?.response?.success !== true) {
    return result?.response?.error || 'RUNTIME_NAVIGATION_RESPONSE_INVALID';
  }
  return '';
}

function requireSentinelRoom478Seed(value) {
  if (
    value === null
    || typeof value === 'undefined'
    || (typeof value === 'string' && !value.trim())
  ) {
    throw new TypeError('sentinel_room_478_seed_required');
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0x7fffffff) {
    throw new TypeError('sentinel_room_478_seed_invalid');
  }
  return numeric;
}

function requireSentinelRoom478Origin(value, parameterName) {
  if (
    value === null
    || typeof value === 'undefined'
    || (typeof value === 'string' && !value.trim())
  ) {
    throw new TypeError(`sentinel_room_478_${parameterName}_required`);
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new TypeError(`sentinel_room_478_${parameterName}_invalid`);
  }
  return numeric;
}

function serializeSentinelRoom478Ratio(value) {
  return String(Number(value.toFixed(4)));
}

export function resolveSentinelRoom478HandoffRunId({
  mode,
  activeNudgeRunId = null,
  admissionLease = null,
} = {}) {
  if (mode === 'debug') {
    if (admissionLease?.manual !== true || admissionLease.kind !== 'global_sentinel') {
      throw new TypeError('sentinel_room_478_manual_lease_invalid');
    }
    if (typeof admissionLease.leaseId !== 'string' || !admissionLease.leaseId.trim()) {
      throw new TypeError('sentinel_room_478_manual_lease_id_required');
    }
    return admissionLease.leaseId;
  }
  if (mode !== 'auto') {
    throw new TypeError('sentinel_room_478_mode_invalid');
  }
  if (typeof activeNudgeRunId !== 'string' || !activeNudgeRunId.trim()) {
    throw new TypeError('sentinel_room_478_run_id_required');
  }
  return activeNudgeRunId;
}

export function buildSentinelRoom478Url({
  runId = '',
  source = 'global_sentinel_success',
  seed,
  originX,
  originY,
  runtimeGetURLFn = runtimeGetURL,
} = {}) {
  const normalizedSeed = requireSentinelRoom478Seed(seed);
  const normalizedOriginX = requireSentinelRoom478Origin(originX, 'originX');
  const normalizedOriginY = requireSentinelRoom478Origin(originY, 'originY');
  const pageUrl = typeof runtimeGetURLFn === 'function'
    ? runtimeGetURLFn(SENTINEL_ROOM_478_PAGE_PATH)
    : SENTINEL_ROOM_478_PAGE_PATH;
  const url = new URL(pageUrl, 'chrome-extension://entropy/');
  const normalizedSource = typeof source === 'string' ? source.trim() : '';
  const normalizedRunId = typeof runId === 'string' ? runId.trim() : '';
  if (normalizedSource !== 'global_sentinel_success') {
    throw new TypeError('sentinel_room_478_source_invalid');
  }
  if (!normalizedRunId) {
    throw new TypeError('sentinel_room_478_run_id_required');
  }
  url.searchParams.set('source', normalizedSource);
  url.searchParams.set('runId', normalizedRunId);
  url.searchParams.set('seed', String(normalizedSeed));
  url.searchParams.set('originX', serializeSentinelRoom478Ratio(normalizedOriginX));
  url.searchParams.set('originY', serializeSentinelRoom478Ratio(normalizedOriginY));
  return url.toString();
}

export async function navigateSentinelRoom478({
  runId = '',
  source = 'global_sentinel_success',
  seed,
  originX,
  originY,
  admissionLease = null,
  runtimeGetURLFn = runtimeGetURL,
  runtimeCanSendMessageFn = runtimeCanSendMessage,
  sendRuntimeMessage = runtimeSendMessageReliable,
  consoleRef = console,
} = {}) {
  try {
    buildSentinelRoom478Url({
      runId,
      source,
      seed,
      originX,
      originY,
      runtimeGetURLFn,
    });
    const canSendRuntimeMessage = typeof runtimeCanSendMessageFn === 'function'
      ? runtimeCanSendMessageFn()
      : false;
    if (!canSendRuntimeMessage || typeof sendRuntimeMessage !== 'function') {
      throw new Error('sentinel_room_478_runtime_navigation_unavailable');
    }
    const result = await sendRuntimeMessage({
      action: MESSAGE_ACTIONS.OPEN_NUDGE_ROOM_478,
      admissionLease,
      runId,
      source,
      seed,
      originX,
      originY,
    }, { timeoutMs: 1_200 });
    const failure = resolveSentinelRuntimeNavigationFailure(result);
    if (failure) throw new Error(failure);
    return true;
  } catch (error) {
    reportSentinelNavigationFailure('room_478', error, consoleRef);
  }
  return false;
}

export function navigateSentinelAway({
  admissionLease = null,
  recoveryDashboardUrl = '',
  windowRef: _windowRef = window,
  runtimeCanSendMessageFn = runtimeCanSendMessage,
  sendRuntimeMessage = runtimeSendMessageReliable,
  consoleRef = console,
} = {}) {
  const trimmedRecoveryUrl = typeof recoveryDashboardUrl === 'string'
    ? recoveryDashboardUrl.trim()
    : '';

  try {
    const canSendRuntimeMessage = typeof runtimeCanSendMessageFn === 'function'
      ? runtimeCanSendMessageFn()
      : false;
    if (canSendRuntimeMessage && typeof sendRuntimeMessage === 'function') {
      const messagePromise = Promise.resolve(sendRuntimeMessage(
        {
          action: MESSAGE_ACTIONS.OPEN_NUDGE_RECOVERY_DASHBOARD,
          admissionLease,
          dashboardUrl: trimmedRecoveryUrl || undefined,
        },
        { timeoutMs: 600 },
      ));
      void messagePromise.then((result) => {
        const failure = resolveSentinelRuntimeNavigationFailure(result);
        if (!failure) return;
        reportSentinelNavigationFailure('runtime_message', failure, consoleRef);

      }, (error) => {
        reportSentinelNavigationFailure('runtime_message', error, consoleRef);

      });
      return true;
    }
  } catch (error) {
    reportSentinelNavigationFailure('runtime_message', error, consoleRef);
  }
  return false;
}
