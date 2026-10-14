import { toErrorMessage } from './ProtectionDispatchTransport.js';

const AUDIO_DULLING_COORDINATOR_UNAVAILABLE = 'AUDIO_DULLING_COORDINATOR_UNAVAILABLE';

function hasCoordinatorMethod(coordinator, methodName) {
  return typeof coordinator?.[methodName] === 'function';
}

export function createProtectionAudioDullingDispatchBridge({
  audioDullingCoordinator = null,
  recordDiagnostic,
} = {}) {
  if (typeof recordDiagnostic !== 'function') {
    throw new Error('PROTECTION_AUDIO_DULLING_DISPATCH_DIAGNOSTICS_REQUIRED');
  }

  async function stopTab(tabId, reason = 'protection_inactive') {
    if (!hasCoordinatorMethod(audioDullingCoordinator, 'stopTab')) return null;
    try {
      return await audioDullingCoordinator.stopTab(tabId, { reason });
    } catch (error) {
      recordDiagnostic('audio_dulling_stop_failed', {
        tabId,
        reason,
        error: toErrorMessage(error),
      });
      return {
        ok: false,
        error: toErrorMessage(error),
      };
    }
  }

  async function reconcileTab(tabId, url, runtimeSnapshot, {
    hostname = '',
    now = Date.now(),
    source = 'protection_dispatcher',
  } = {}) {
    if (!hasCoordinatorMethod(audioDullingCoordinator, 'reconcileTab')) return null;
    try {
      return await audioDullingCoordinator.reconcileTab({
        tabId,
        url,
        hostname,
        runtimeSnapshot,
        source,
        now,
      });
    } catch (error) {
      recordDiagnostic('audio_dulling_reconcile_failed', {
        tabId,
        hostname,
        source,
        error: toErrorMessage(error),
      });
      return {
        ok: false,
        error: toErrorMessage(error),
      };
    }
  }

  function startCaptureForTab(tabId, {
    captureCurrentActiveTab = false,
    requestPermission = true,
  } = {}) {
    if (!hasCoordinatorMethod(audioDullingCoordinator, 'startArmedTab')) {
      return { ok: false, error: AUDIO_DULLING_COORDINATOR_UNAVAILABLE };
    }
    return audioDullingCoordinator.startArmedTab(tabId, {
      captureCurrentActiveTab,
      requestPermission,
    });
  }

  function getTabState(tabId) {
    if (!hasCoordinatorMethod(audioDullingCoordinator, 'getTabState')) {
      return null;
    }
    return audioDullingCoordinator.getTabState(tabId);
  }

  return {
    getTabState,
    reconcileTab,
    startCaptureForTab,
    stopTab,
  };
}
