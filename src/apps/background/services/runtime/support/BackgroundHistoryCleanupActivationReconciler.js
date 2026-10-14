import { isEchoArtifactMutationSuppressed } from '../../../../../domains/protection/runtime/echoArtifactMutationPolicy.js';

function requireActivationFunction(value, errorCode) {
  if (typeof value !== 'function') {
    throw new Error(errorCode);
  }
  return value;
}

function requireActivationMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
}

export function createBackgroundHistoryCleanupActivationReconciler({
  settingsService,
  settingsCache,
  hasHistoryPermission,
  cleanupBlockedHistory,
  checkpointRepository,
} = {}) {
  requireActivationMethod(
    settingsService,
    'ensureSettingsCache',
    'HISTORY_CLEANUP_ACTIVATION_SETTINGS_SERVICE_REQUIRED',
  );
  if (!settingsCache || typeof settingsCache !== 'object') {
    throw new Error('HISTORY_CLEANUP_ACTIVATION_SETTINGS_CACHE_REQUIRED');
  }
  requireActivationFunction(
    hasHistoryPermission,
    'HISTORY_CLEANUP_ACTIVATION_PERMISSION_READER_REQUIRED',
  );
  requireActivationFunction(
    cleanupBlockedHistory,
    'HISTORY_CLEANUP_ACTIVATION_CLEANUP_OWNER_REQUIRED',
  );
  requireActivationMethod(
    checkpointRepository,
    'readOptional',
    'HISTORY_CLEANUP_ACTIVATION_CHECKPOINT_READER_REQUIRED',
  );
  requireActivationMethod(
    checkpointRepository,
    'markCompleted',
    'HISTORY_CLEANUP_ACTIVATION_CHECKPOINT_WRITER_REQUIRED',
  );
  requireActivationMethod(
    checkpointRepository,
    'clear',
    'HISTORY_CLEANUP_ACTIVATION_CHECKPOINT_CLEARER_REQUIRED',
  );

  let operationTail = Promise.resolve();
  let activeActivationReconciliation = null;
  let activePermissionGrantReconciliation = null;

  function enqueueOperation(operation) {
    const operationPromise = operationTail.then(operation);
    operationTail = operationPromise.catch(() => undefined);
    return operationPromise;
  }

  async function runReconciliation({
    resetCheckpoint = false,
    requireGrantedPermission = false,
  } = {}) {
    if (resetCheckpoint) {
      await checkpointRepository.clear();
    }
    const checkpoint = await checkpointRepository.readOptional();
    if (checkpoint?.found !== true && checkpoint?.found !== false) {
      throw new Error('HISTORY_CLEANUP_ACTIVATION_CHECKPOINT_RESULT_INVALID');
    }
    if (checkpoint.found) {
      return Object.freeze({
        status: 'already_reconciled',
        cleanupAttempted: false,
        itemCount: 0,
      });
    }

    await settingsService.ensureSettingsCache();
    if (typeof settingsCache.historyCleanupForBlocked !== 'boolean') {
      throw new Error('HISTORY_CLEANUP_ACTIVATION_SETTING_INVALID');
    }

    if (!settingsCache.historyCleanupForBlocked) {
      await checkpointRepository.markCompleted();
      return Object.freeze({
        status: 'disabled',
        cleanupAttempted: false,
        itemCount: 0,
      });
    }

    const pausedResult = () => Object.freeze({ status: 'paused', cleanupAttempted: false, itemCount: 0 });
    if (isEchoArtifactMutationSuppressed(settingsCache)) return pausedResult();

    const permissionGranted = await hasHistoryPermission();
    if (typeof permissionGranted !== 'boolean') {
      throw new Error('HISTORY_CLEANUP_ACTIVATION_PERMISSION_RESULT_INVALID');
    }
    if (isEchoArtifactMutationSuppressed(settingsCache)) return pausedResult();
    if (!settingsCache.historyCleanupForBlocked) {
      await checkpointRepository.markCompleted();
      return Object.freeze({ status: 'disabled', cleanupAttempted: false, itemCount: 0 });
    }
    if (!permissionGranted) {
      if (requireGrantedPermission) {
        throw new Error('HISTORY_CLEANUP_PERMISSION_ADDED_NOT_GRANTED');
      }
      await checkpointRepository.markCompleted();
      return Object.freeze({
        status: 'permission_missing',
        cleanupAttempted: false,
        itemCount: 0,
      });
    }

    if (isEchoArtifactMutationSuppressed(settingsCache)) return pausedResult();

    const items = await cleanupBlockedHistory({ requireEnabledConsent: true });
    if (!Array.isArray(items)) {
      throw new Error('HISTORY_CLEANUP_ACTIVATION_RESULT_INVALID');
    }
    if (isEchoArtifactMutationSuppressed(settingsCache)) return pausedResult();
    if (!settingsCache.historyCleanupForBlocked) {
      await checkpointRepository.markCompleted();
      return Object.freeze({ status: 'disabled', cleanupAttempted: false, itemCount: 0 });
    }
    await checkpointRepository.markCompleted();
    return Object.freeze({
      status: 'cleaned',
      cleanupAttempted: true,
      itemCount: items.length,
    });
  }

  function reconcile() {
    if (activeActivationReconciliation) return activeActivationReconciliation;
    const nextReconciliation = enqueueOperation(() => runReconciliation()).finally(() => {
      if (activeActivationReconciliation === nextReconciliation) {
        activeActivationReconciliation = null;
      }
    });
    activeActivationReconciliation = nextReconciliation;
    return nextReconciliation;
  }

  function reconcileAfterHistoryPermissionAdded() {
    if (activePermissionGrantReconciliation) return activePermissionGrantReconciliation;
    const nextReconciliation = enqueueOperation(() => runReconciliation({
      resetCheckpoint: true,
      requireGrantedPermission: true,
    })).finally(() => {
      if (activePermissionGrantReconciliation === nextReconciliation) {
        activePermissionGrantReconciliation = null;
      }
    });
    activePermissionGrantReconciliation = nextReconciliation;
    return nextReconciliation;
  }

  return Object.freeze({
    reconcile,
    reconcileAfterHistoryPermissionAdded,
  });
}

export default createBackgroundHistoryCleanupActivationReconciler;
