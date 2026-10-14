import { STORAGE_SESSION_KEYS } from '../../../../../platform/storage/runtime/RuntimeSessionRepository.js';
import {
  PROFILE_RESET_LIFECYCLE_OPERATIONS,
} from '../../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import {
  ZEN_THEME_MODEL_STATE_KEYS,
  requireZenThemeModelStateValue,
} from '../../../../../platform/storage/themes/zen/ZenThemeModelStateContract.js';

const STORAGE_SNAPSHOT_RUNTIME_SESSION_RESET_KEYS = Object.freeze(
  Object.values(STORAGE_SESSION_KEYS),
);

function isStorageSnapshotPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireStorageSnapshotImportResult(result) {
  if (!isStorageSnapshotPlainObject(result)) {
    throw new Error('BACKGROUND_STORAGE_SNAPSHOT_IMPORT_RESULT_INVALID');
  }
  return result;
}

function requireStorageSnapshotFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
}

function createStorageSnapshotCleanupError(failures) {
  const error = new Error('BACKGROUND_STORAGE_SNAPSHOT_RUNTIME_CLEANUP_FAILED');
  error.code = 'BACKGROUND_STORAGE_SNAPSHOT_RUNTIME_CLEANUP_FAILED';
  error.cause = failures[0]?.error;
  error.cleanupFailures = failures.map(({ stage, error: failure }) => ({
    stage,
    error: failure instanceof Error
      ? failure.message
      : String(failure || 'BACKGROUND_STORAGE_SNAPSHOT_RUNTIME_CLEANUP_FAILED'),
  }));
  return error;
}

async function runRequiredSnapshotRuntimeCleanup({
  workerRuntimeEventCapability,
  clearBootstrapSnapshots,
  runtimeSessionRepository,
}) {
  const failures = [];
  try {
    await workerRuntimeEventCapability.clearForProfileMutation();
  } catch (error) {
    failures.push({ stage: 'worker_runtime_events', error });
  }
  try {
    await clearBootstrapSnapshots('storage_snapshot_import');
  } catch (error) {
    failures.push({ stage: 'bootstrap_snapshots', error });
  }

  try {
    await runtimeSessionRepository.remove(STORAGE_SNAPSHOT_RUNTIME_SESSION_RESET_KEYS);
  } catch (error) {
    failures.push({ stage: 'runtime_session', error });
  }

  if (failures.length > 0) throw createStorageSnapshotCleanupError(failures);
}

function requireStorageSnapshotImportMode(mode) {
  if (mode !== 'replace') {
    throw new Error('STORAGE_SNAPSHOT_IMPORT_MODE_INVALID');
  }
  return mode;
}

function requireStorageSnapshotZenProfileGenerationState(value, profileEpoch) {
  if (
    !isStorageSnapshotPlainObject(value)
    || !isStorageSnapshotPlainObject(value.profileAggregate)
    || value.profileAggregate.profileEpoch !== profileEpoch
  ) {
    throw new Error('BACKGROUND_STORAGE_SNAPSHOT_ZEN_PROFILE_GENERATION_STATE_INVALID');
  }
  try {
    requireZenThemeModelStateValue(
      ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE,
      value.profileAggregate,
    );
  } catch (cause) {
    const error = new Error('BACKGROUND_STORAGE_SNAPSHOT_ZEN_PROFILE_GENERATION_STATE_INVALID');
    error.cause = cause;
    throw error;
  }
  return value;
}

export function createBackgroundStorageSnapshotService({
  workerRuntimeEventCapability,
  runTerminalStatsReset,
  runTerminalTrackingReset,
  runtimeSessionRepository,
  profileMutationCoordinator,
  settingsService,
  storageSnapshotCapability,
  clearBootstrapSnapshots,
  runCLSEStorageSnapshotImport,
  createZenProfileGenerationState,
} = {}) {
  requireStorageSnapshotFunction(
    workerRuntimeEventCapability?.clearForProfileMutation,
    'BACKGROUND_STORAGE_SNAPSHOT_WORKER_RUNTIME_EVENTS_MUTATION_OWNER_REQUIRED',
  );
  if (
    !storageSnapshotCapability
    || typeof storageSnapshotCapability.exportSnapshot !== 'function'
    || typeof storageSnapshotCapability.importSnapshot !== 'function'
    || typeof storageSnapshotCapability.preflightImport !== 'function'
  ) {
    throw new Error('BACKGROUND_STORAGE_SNAPSHOT_SERVICE_CAPABILITY_REQUIRED');
  }
  if (
    !settingsService
    || typeof settingsService.runExclusiveTerminalSettingsMutation !== 'function'
  ) {
    throw new Error(
      'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_TERMINAL_SETTINGS_MUTATION_OWNER_REQUIRED',
    );
  }
  requireStorageSnapshotFunction(
    clearBootstrapSnapshots,
    'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_CLEAR_BOOTSTRAP_SNAPSHOTS_REQUIRED',
  );
  requireStorageSnapshotFunction(
    runTerminalStatsReset,
    'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_TERMINAL_STATS_RESET_OWNER_REQUIRED',
  );
  requireStorageSnapshotFunction(
    runTerminalTrackingReset,
    'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_TERMINAL_TRACKING_RESET_OWNER_REQUIRED',
  );
  requireStorageSnapshotFunction(
    runCLSEStorageSnapshotImport,
    'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_CLSE_IMPORT_LIFECYCLE_REQUIRED',
  );
  requireStorageSnapshotFunction(
    createZenProfileGenerationState,
    'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_ZEN_PROFILE_GENERATION_FACTORY_REQUIRED',
  );
  if (
    !profileMutationCoordinator
    || typeof profileMutationCoordinator.runExclusiveMutation !== 'function'
    || typeof profileMutationCoordinator.runStableRead !== 'function'
  ) {
    throw new Error('BACKGROUND_STORAGE_SNAPSHOT_SERVICE_PROFILE_MUTATION_COORDINATOR_REQUIRED');
  }

  async function exportStorageSnapshot({ backupPassphrase } = {}) {
    return profileMutationCoordinator.runStableRead({
      task: () => storageSnapshotCapability.exportSnapshot({
        backupPassphrase,
      }),
    });
  }

  async function importStorageSnapshot({
    snapshot,
    mode = 'replace',
    backupPassphrase,
    restorePassphrase,
    expectedClosedResetId = null,
  } = {}) {
    const importMode = requireStorageSnapshotImportMode(mode);
    const ownedSnapshot = structuredClone(snapshot);
    const preparedImport = await storageSnapshotCapability.preflightImport(ownedSnapshot, {
      mode: importMode, backupPassphrase, restorePassphrase,
    });
    const mutation = await profileMutationCoordinator.runExclusiveMutation({
      operation: PROFILE_RESET_LIFECYCLE_OPERATIONS.SNAPSHOT_IMPORT,
      expectedClosedResetId,
      task: async ({ lifecycle: resetLifecycle }) => {
        const profileGenerationState = requireStorageSnapshotZenProfileGenerationState(
          createZenProfileGenerationState({
            profileEpoch: resetLifecycle.resetId,
          }),
          resetLifecycle.resetId,
        );
        let result = null;
        let settingsMutationError = null;
        try {
          await runCLSEStorageSnapshotImport(async () => {
            result = await settingsService.runExclusiveTerminalSettingsMutation({
              mutate: () => Promise.resolve(runTerminalTrackingReset())
                .then(() => runTerminalStatsReset(async () => {
                  let importFailure = null;
                  try {
                    result = await storageSnapshotCapability.importSnapshot(ownedSnapshot, {
                      mode: importMode,
                      preparedImport,
                      targetProfileEpoch: resetLifecycle.resetId,
                      targetProfileAggregate: profileGenerationState.profileAggregate,
                    });
                  } catch (error) {
                    importFailure = error instanceof Error
                      ? error
                      : new Error(String(error || 'STORAGE_SNAPSHOT_IMPORT_FAILED'));
                  }

                  let cleanupFailure = null;
                  try {
                    await runRequiredSnapshotRuntimeCleanup({
                      workerRuntimeEventCapability,
                      clearBootstrapSnapshots,
                      runtimeSessionRepository,
                    });
                  } catch (error) {
                    cleanupFailure = error;
                  }

                  if (importFailure) {
                    if (cleanupFailure) {
                      importFailure.storageSnapshotRuntimeCleanupError = cleanupFailure;
                    }
                    throw importFailure;
                  }
                  if (cleanupFailure) throw cleanupFailure;
                }).then(() => ({
                  result,
                  settingsChanged: true,
                }))),
            });
          });
        } catch (error) {
          settingsMutationError = error;
        }
        if (settingsMutationError) {
          throw settingsMutationError;
        }

        return requireStorageSnapshotImportResult(result);
      },
    });
    return mutation.value;
  }

  return {
    exportStorageSnapshot,
    importStorageSnapshot,
  };
}
