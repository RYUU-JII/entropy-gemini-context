import { getRuntimeLanguage } from '../../settings/i18n/runtime.js';
import { normalizeNudgeRuntimeConfig } from '../../settings/config/nudgeConfig.js';
import { normalizeNudgeRuntimeContext } from './nudgeRuntimeContext.js';
import { runNudgeWorkerAdmissionProbe } from './NudgeWorkerAdmissionProbe.js';
import { normalizeSentinelProtocolWorkerRuntimeHost } from './SentinelProtocolWorkerBridge.js';

export function createSentinelProtocolDebugController({
  getMainSpawnDiagnostics = () => ({}),
  getMainRuntimeStats = () => ({}),
  getCanvasRuntimeOwner = () => 'layout',
  isWorkerRuntimeActive = () => false,
  getActiveWorkerRuntime = () => null,
  getWorkerRuntimeResultName = () => 'unknown',
  getWorkerRuntimeHost = () => 'extension_frame_worker',
  showOverlay = () => {},
  syncOverlayRefs = () => {},
  spawnMainRuntime = () => false,
  getMainSpawnBlockReason = () => 'spawn_failed',
  buildRuntimeStartFailureOutcome = null,
  isActive = () => false,
  getMode = () => 'auto',
  start = async () => ({ ok: false }),
  setRuntimeContext = () => {},
  setConfig = () => {},
  getRuntimeContext = () => null,
  getActiveThemeId = () => '',
  getConfig = () => ({}),
  createDefaultConfig = () => ({}),
} = {}) {
  function buildMainSpawnOutcome(didSpawn, rejectReason = '') {
    const diagnostics = getMainSpawnDiagnostics();
    const stats = getMainRuntimeStats();
    return {
      ok: !!didSpawn,
      phase: didSpawn ? 'rendered' : 'rejected',
      runtime: 'main',
      requestId: 0,
      liveCount: stats.liveCount,
      totalSpawned: stats.totalSpawned,
      totalSplitSpawned: stats.totalSplitSpawned,
      renderedCount: didSpawn ? stats.liveCount : 0,
      rejectReason: didSpawn ? '' : (rejectReason || 'spawn_failed'),
      diagnostics,
    };
  }

  function buildSpawnDebugDiagnostics(outcome = null) {
    const baseDiagnostics = getMainSpawnDiagnostics();
    const outcomeDiagnostics = outcome?.diagnostics && typeof outcome.diagnostics === 'object'
      ? outcome.diagnostics
      : null;
    if (!outcomeDiagnostics) return baseDiagnostics;
    return {
      ...baseDiagnostics,
      ...outcomeDiagnostics,
      activeThemeId: baseDiagnostics.activeThemeId,
      supportsWorkerRuntime: baseDiagnostics.supportsWorkerRuntime,
      hasCanvasContext: baseDiagnostics.hasCanvasContext,
      canvasConnected: baseDiagnostics.canvasConnected,
      rootConnected: baseDiagnostics.rootConnected,
      bounds: baseDiagnostics.bounds,
    };
  }

  function normalizeSpawnDebugOutcome(outcome = {}) {
    const source = outcome && typeof outcome === 'object' ? outcome : {};
    return {
      ...source,
      ok: source.ok === true,
      runtime: source.runtime || (isWorkerRuntimeActive() ? 'worker' : 'main'),
      diagnostics: buildSpawnDebugDiagnostics(source),
    };
  }

  function spawn(spawnHint = null, { waitForRendered = false, timeoutMs = 1800 } = {}) {
    showOverlay();
    if (isWorkerRuntimeActive()) {
      const activeWorkerRuntime = getActiveWorkerRuntime();
      if (waitForRendered) {
        return activeWorkerRuntime?.forceSpawnAndWait?.(spawnHint, { timeoutMs });
      }
      const sent = activeWorkerRuntime?.forceSpawn?.(spawnHint) || false;
      return {
        ok: sent,
        phase: sent ? 'requested' : 'rejected',
        runtime: getWorkerRuntimeResultName(),
        requestId: 0,
        rejectReason: sent ? '' : 'post_failed',
      };
    }
    if (getCanvasRuntimeOwner() === 'worker') {
      const stats = getMainRuntimeStats();
      return {
        ok: false,
        phase: 'rejected',
        runtime: getWorkerRuntimeResultName(),
        requestId: 0,
        liveCount: stats.liveCount,
        totalSpawned: stats.totalSpawned,
        totalSplitSpawned: stats.totalSplitSpawned,
        renderedCount: 0,
        rejectReason: 'worker_runtime_inactive',
        diagnostics: getMainSpawnDiagnostics(),
      };
    }
    const didSpawn = spawnMainRuntime(spawnHint);
    return buildMainSpawnOutcome(
      didSpawn,
      didSpawn ? '' : getMainSpawnBlockReason(),
    );
  }

  async function spawnDebug({
    config: nextConfig = null,
    runtimeContext: nextRuntimeContext = null,
    runtimeHost: nextRuntimeHost = null,
    spawnHint = null,
    timeoutMs = 1800,
  } = {}) {
    if (isActive() && getMode() !== 'debug') {
      if (typeof buildRuntimeStartFailureOutcome === 'function') {
        return buildRuntimeStartFailureOutcome({
          runtime: getWorkerRuntimeResultName(),
          rejectReason: 'debug_control_blocked_by_production',
          error: 'debug_control_blocked_by_production',
        });
      }
      return {
        ok: false,
        phase: 'rejected',
        runtime: getWorkerRuntimeResultName(),
        requestId: 0,
        rejectReason: 'debug_control_blocked_by_production',
        error: 'debug_control_blocked_by_production',
        diagnostics: getMainSpawnDiagnostics(),
      };
    }
    const requestedRuntimeHost = nextRuntimeHost
      ? normalizeSentinelProtocolWorkerRuntimeHost(nextRuntimeHost)
      : getWorkerRuntimeHost();
    const shouldRestartForRuntimeHost = !!nextRuntimeHost
      && requestedRuntimeHost !== getWorkerRuntimeHost();
    if (!isActive() || shouldRestartForRuntimeHost) {
      const startResult = await start({
        ...(nextConfig && typeof nextConfig === 'object' ? nextConfig : {}),
        __mode: 'debug',
        __runtimeHost: requestedRuntimeHost,
        __runtimeContext: nextRuntimeContext,
      }, {
        workerActivationTimeoutMs: timeoutMs,
      });
      if (startResult?.ok === false) return startResult;
    } else {
      showOverlay();
      if (nextRuntimeContext) setRuntimeContext(nextRuntimeContext);
      if (nextConfig) setConfig(nextConfig);
    }

    showOverlay();
    syncOverlayRefs();
    if (isWorkerRuntimeActive()) {
      const activeOutcome = await getActiveWorkerRuntime()?.waitForActive?.({ timeoutMs });
      if (activeOutcome?.ok !== true) return normalizeSpawnDebugOutcome(activeOutcome);
    }
    const outcome = await Promise.resolve(spawn(spawnHint, {
      waitForRendered: true,
      timeoutMs,
    }));
    return normalizeSpawnDebugOutcome(outcome);
  }

  async function probeWorkerAdmission({
    config: nextConfig = null,
    runtimeContext: nextRuntimeContext = null,
    timeoutMs = 2200,
  } = {}) {
    const runtimeContext = getRuntimeContext();
    const activeThemeId = getActiveThemeId();
    const probeRuntimeContext = normalizeNudgeRuntimeContext(nextRuntimeContext || runtimeContext || {
      themeId: activeThemeId,
      language: getRuntimeLanguage(),
      variantId: activeThemeId,
    });
    const probeConfig = normalizeNudgeRuntimeConfig(
      nextConfig && typeof nextConfig === 'object' ? nextConfig : getConfig(),
      { defaults: createDefaultConfig(probeRuntimeContext) },
    );
    return runNudgeWorkerAdmissionProbe({
      config: probeConfig,
      runtimeContext: probeRuntimeContext,
      timeoutMs,
    });
  }

  return {
    spawn,
    spawnDebug,
    probeWorkerAdmission,
  };
}
