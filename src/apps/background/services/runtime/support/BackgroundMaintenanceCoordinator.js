import { STORAGE_SESSION_KEYS } from '../../../../../platform/storage/runtime/RuntimeSessionRepository.js';
import {
  PROFILE_RESET_LIFECYCLE_OPERATIONS,
} from '../../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import {
  STORAGE_SUPPORT_SESSION_KEYS,
  STORAGE_SUPPORT_TASKS,
} from '../../../../../platform/storage/support/StorageInspectorCapability.js';
import {
  ZEN_THEME_MODEL_STATE_KEYS,
  requireZenThemeModelStateValue,
} from '../../../../../platform/storage/themes/zen/ZenThemeModelStateContract.js';

const PROFILE_AGGREGATE_KEY = ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE;

function buildMaintenanceWarning(code, error) {
  return {
    code,
    error: error?.message || String(error || code),
  };
}

async function runBestEffortMaintenanceStep(warnings, code, task) {
  if (typeof task !== 'function') {
    throw new Error(`${code}:TASK_UNAVAILABLE`);
  }
  try {
    return await Promise.resolve(task());
  } catch (error) {
    warnings.push(buildMaintenanceWarning(code, error));
    return null;
  }
}

function withMaintenanceWarnings(result, warnings) {
  return warnings.length > 0
    ? { ...result, warnings }
    : result;
}

function isMaintenancePlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireMaintenanceFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
}

function requireMaintenanceOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return (...args) => owner[methodName](...args);
}

function requireMaintenanceBoolean(value, errorCode) {
  if (typeof value !== 'boolean') {
    throw new Error(errorCode);
  }
  return value;
}

async function runRequiredMaintenanceWave(errorCode, tasks) {
  const settled = await Promise.allSettled(tasks.map((task) => Promise.resolve().then(task)));
  const failures = settled
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => result.status === 'rejected')
    .map(({ result, index }) => ({
      index,
      error: result.reason instanceof Error
        ? result.reason
        : new Error(String(result.reason || errorCode)),
    }));
  if (failures.length === 0) return;

  const failure = new Error(errorCode);
  failure.code = errorCode;
  failure.cause = failures[0].error;
  failure.maintenanceWaveFailures = failures.map(({ index, error }) => ({
    index,
    error: error.message,
  }));
  // The durable lifecycle retains the phase code; keep the individual owner
  // failures observable without logging settings, credentials or discarded data.
  console.error('[BackgroundMaintenance] Required reset clear failed:', {
    code: failure.code,
    failures: failure.maintenanceWaveFailures,
  });
  throw failure;
}

function requireMaintenancePlainObject(value, errorCode) {
  if (!isMaintenancePlainObject(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireMaintenanceZenProfileGenerationState(value, profileEpoch) {
  const state = requireMaintenancePlainObject(
    value,
    'BACKGROUND_MAINTENANCE_ZEN_PROFILE_GENERATION_STATE_INVALID',
  );
  if (
    !isMaintenancePlainObject(state.profileAggregate)
    || state.profileAggregate.profileEpoch !== profileEpoch
    || !Array.isArray(state.modelStateInitialEntries)
    || state.modelStateInitialEntries.length !== 1
  ) {
    throw new Error('BACKGROUND_MAINTENANCE_ZEN_PROFILE_GENERATION_STATE_INVALID');
  }
  const [aggregateEntry] = state.modelStateInitialEntries;
  if (
    !isMaintenancePlainObject(aggregateEntry)
    || Object.keys(aggregateEntry).length !== 2
    || aggregateEntry.key !== PROFILE_AGGREGATE_KEY
    || aggregateEntry.value !== state.profileAggregate
  ) {
    throw new Error('BACKGROUND_MAINTENANCE_ZEN_PROFILE_GENERATION_STATE_INVALID');
  }
  try {
    requireZenThemeModelStateValue(PROFILE_AGGREGATE_KEY, state.profileAggregate);
  } catch (cause) {
    const error = new Error('BACKGROUND_MAINTENANCE_ZEN_PROFILE_GENERATION_STATE_INVALID');
    error.cause = cause;
    throw error;
  }
  return state;
}

function requireMaintenanceOutcomeObject(value, errorCode, {
  requireSkipped = false,
} = {}) {
  const payload = requireMaintenancePlainObject(value, errorCode);
  if (typeof payload.ok !== 'boolean') {
    throw new Error(errorCode);
  }
  if (requireSkipped && typeof payload.skipped !== 'boolean') {
    throw new Error(errorCode);
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, 'error')
    && payload.error !== null
    && typeof payload.error !== 'string'
  ) {
    throw new Error(errorCode);
  }
  if (payload.ok === false && (typeof payload.error !== 'string' || !payload.error.trim())) {
    throw new Error(errorCode);
  }
  return payload;
}

function requireStatsRetentionResult(result) {
  const payload = requireMaintenancePlainObject(
    result,
    'BACKGROUND_MAINTENANCE_STATS_RETENTION_RESULT_INVALID',
  );
  if (!Number.isFinite(Number(payload.removedStatsDays))) {
    throw new Error('BACKGROUND_MAINTENANCE_STATS_RETENTION_REMOVED_DAYS_INVALID');
  }
  const statsCleanup = requireMaintenanceOutcomeObject(
    payload.statsCleanup,
    'BACKGROUND_MAINTENANCE_STATS_RETENTION_STATS_CLEANUP_INVALID',
  );
  if (!Array.isArray(payload.cleanupResults)) {
    throw new Error('BACKGROUND_MAINTENANCE_STATS_RETENTION_CLEANUP_RESULTS_INVALID');
  }
  const cleanupResults = payload.cleanupResults.map((entry) => requireMaintenanceOutcomeObject(
    entry,
    'BACKGROUND_MAINTENANCE_STATS_RETENTION_CLEANUP_RESULTS_INVALID',
  ));
  const markerRead = requireMaintenanceOutcomeObject(
    payload.markerRead,
    'BACKGROUND_MAINTENANCE_STATS_RETENTION_MARKER_READ_INVALID',
    { requireSkipped: true },
  );
  const marker = requireMaintenanceOutcomeObject(
    payload.marker,
    'BACKGROUND_MAINTENANCE_STATS_RETENTION_MARKER_INVALID',
  );
  return {
    ...payload,
    statsCleanup,
    cleanupResults,
    markerRead,
    marker,
  };
}

export function createBackgroundMaintenanceCoordinator({
  workerRuntimeEventCapability,
  clearGatePruningPresentation,
  clearFurinDailyReceiptForProfileReset,
  clearGuidanceForProfileReset,
  statsRepository,
  eventLogRepository,
  deleteCLSEData,
  resetStatsState,
  runStatsReset,
  runTerminalStatsReset,
  runTerminalTrackingReset,
  TabTimeTracker,
  loadStatsCache,
  faviconRepository,
  statsFeaturePackRepository,
  interventionEffectRepository,
  settingsDocumentRepository,
  modelStateRepository,
  zenArtifactRepository,
  keyMaterialRepository,
  cycleStateManager,
  runtimeSessionRepository,
  profileMutationCoordinator,
  resetCLSEData,
  settingsService,
  checkGlobalCapStatus,
  invalidateBootPrewarmSnapshot,
  clearBootstrapSnapshots,
  settingsPersistence,
  statsRetentionJob,
  maxDaysStored,
  progressionService,
  createZenProfileGenerationState,
} = {}) {
  requireMaintenanceFunction(clearBootstrapSnapshots, 'BACKGROUND_MAINTENANCE_CLEAR_BOOTSTRAP_SNAPSHOTS_REQUIRED');
  requireMaintenanceFunction(clearFurinDailyReceiptForProfileReset, 'BACKGROUND_MAINTENANCE_FURIN_RECEIPT_RESET_REQUIRED');
  requireMaintenanceFunction(clearGuidanceForProfileReset, 'BACKGROUND_MAINTENANCE_GUIDANCE_RESET_REQUIRED');
  requireMaintenanceFunction(clearGatePruningPresentation, 'BACKGROUND_MAINTENANCE_GATE_PRUNING_RESET_REQUIRED');
  requireMaintenanceFunction(runStatsReset, 'BACKGROUND_MAINTENANCE_STATS_RESET_OWNER_REQUIRED');
  requireMaintenanceFunction(
    runTerminalStatsReset,
    'BACKGROUND_MAINTENANCE_TERMINAL_STATS_RESET_OWNER_REQUIRED',
  );
  requireMaintenanceFunction(
    runTerminalTrackingReset,
    'BACKGROUND_MAINTENANCE_TERMINAL_TRACKING_RESET_OWNER_REQUIRED',
  );
  requireMaintenanceFunction(deleteCLSEData, 'BACKGROUND_MAINTENANCE_CLSE_HISTORY_RESET_OWNER_REQUIRED');
  requireMaintenanceFunction(resetCLSEData, 'BACKGROUND_MAINTENANCE_CLSE_FULL_RESET_OWNER_REQUIRED');
  requireMaintenanceFunction(
    createZenProfileGenerationState,
    'BACKGROUND_MAINTENANCE_ZEN_PROFILE_GENERATION_FACTORY_REQUIRED',
  );
  if (
    !settingsService
    || typeof settingsService.runExclusiveTerminalSettingsMutation !== 'function'
  ) {
    throw new Error('BACKGROUND_MAINTENANCE_TERMINAL_SETTINGS_MUTATION_OWNER_REQUIRED');
  }
  const clearStatsFeaturePacks = requireMaintenanceOwnerMethod(
    statsFeaturePackRepository,
    'clearAll',
    'BACKGROUND_MAINTENANCE_STATS_FEATURE_PACK_REPOSITORY_REQUIRED',
  );
  const clearInterventionEffects = requireMaintenanceOwnerMethod(
    interventionEffectRepository,
    'clearAll',
    'BACKGROUND_MAINTENANCE_INTERVENTION_EFFECT_REPOSITORY_REQUIRED',
  );
  const clearProgressionForProfileMutation = requireMaintenanceOwnerMethod(
    progressionService,
    'clearForProfileMutation',
    'BACKGROUND_MAINTENANCE_PROGRESSION_MUTATION_OWNER_REQUIRED',
  );
  const clearWorkerRuntimeEventsForProfileMutation = requireMaintenanceOwnerMethod(
    workerRuntimeEventCapability,
    'clearForProfileMutation',
    'BACKGROUND_MAINTENANCE_WORKER_RUNTIME_EVENTS_MUTATION_OWNER_REQUIRED',
  );
  const resetModelStateForProfileEpoch = requireMaintenanceOwnerMethod(
    modelStateRepository,
    'resetForProfileEpoch',
    'BACKGROUND_MAINTENANCE_MODEL_STATE_PROFILE_EPOCH_RESET_REQUIRED',
  );
  const clearZenArtifactsForProfileMutation = requireMaintenanceOwnerMethod(
    zenArtifactRepository,
    'clearForProfileMutation',
    'BACKGROUND_MAINTENANCE_ZEN_ARTIFACT_PROFILE_MUTATION_OWNER_REQUIRED',
  );
  const resetEventLogsForProfileMutation = requireMaintenanceOwnerMethod(
    eventLogRepository,
    'resetForProfileMutation',
    'BACKGROUND_MAINTENANCE_EVENT_LOG_PROFILE_MUTATION_OWNER_REQUIRED',
  );
  const runExclusiveProfileMutation = requireMaintenanceOwnerMethod(
    profileMutationCoordinator,
    'runExclusiveMutation',
    'BACKGROUND_MAINTENANCE_PROFILE_MUTATION_COORDINATOR_REQUIRED',
  );

  async function resetAnalyticsData() {
    const now = Date.now();
    const warnings = [];
    await runStatsReset(async () => {
      await statsRepository.clearAllStatsDays({ feedHistoryResetAt: now });
      await clearStatsFeaturePacks();
      await clearInterventionEffects();
      await eventLogRepository.clear();
      await runBestEffortMaintenanceStep(
        warnings,
        'RESET_ANALYTICS_DELETE_CLSE_DATA_FAILED',
        deleteCLSEData,
      );
      await TabTimeTracker.resetState();
    });
    await loadStatsCache(now);
    return withMaintenanceWarnings({ reset: 'analytics' }, warnings);
  }

  async function resetAppData({ expectedClosedResetId = null } = {}) {
    const now = Date.now();
    const outcome = await runExclusiveProfileMutation({
      operation: PROFILE_RESET_LIFECYCLE_OPERATIONS.FULL_RESET,
      expectedClosedResetId,
      task: async ({ lifecycle: resetLifecycle }) => {
        const profileGenerationState = requireMaintenanceZenProfileGenerationState(
          createZenProfileGenerationState({ profileEpoch: resetLifecycle.resetId }),
          resetLifecycle.resetId,
        );
        let settingsMutationError = null;
        try {
          await settingsService.runExclusiveTerminalSettingsMutation({
            mutate: () => Promise.resolve(runTerminalTrackingReset())
              .then(() => runTerminalStatsReset(async () => {
                await runRequiredMaintenanceWave('RESET_APP_HISTORY_CLEAR_PHASE_FAILED', [
                  resetEventLogsForProfileMutation,
                  () => statsRepository.clearAllStatsDays(),
                  clearStatsFeaturePacks,
                  clearInterventionEffects,
                  () => faviconRepository.clear(),
                ]);
                await runRequiredMaintenanceWave('RESET_APP_DURABLE_CLEAR_PHASE_FAILED', [
                  clearWorkerRuntimeEventsForProfileMutation,
                  clearGatePruningPresentation,
                  clearFurinDailyReceiptForProfileReset,
                  clearGuidanceForProfileReset,
                  () => settingsDocumentRepository.clear(),
                  async () => {
                    await resetModelStateForProfileEpoch(resetLifecycle.resetId, {
                      initialEntries: profileGenerationState.modelStateInitialEntries,
                    });
                    await clearZenArtifactsForProfileMutation();
                  },
                  () => keyMaterialRepository.clear(),
                  () => clearProgressionForProfileMutation({ nowMs: now }),
                ]);
                await clearBootstrapSnapshots('reset_app_data');
              }).then(() => ({
                result: { reset: 'app' },
                settingsChanged: true,
              }))),
          });
        } catch (error) {
          settingsMutationError = error;
        }

        const requiredTailFailures = [];
        const runRequiredTailStep = async (code, task) => {
          try {
            await task();
          } catch (error) {
            requiredTailFailures.push({
              code,
              error: error instanceof Error ? error : new Error(String(error || code)),
            });
          }
        };
        await runRequiredTailStep(
          'RESET_APP_CLSE_DATA_RESET_FAILED',
          resetCLSEData,
        );
        await runRequiredTailStep(
          'RESET_APP_RUNTIME_SESSION_REMOVE_FAILED',
          () => runtimeSessionRepository.remove(Object.values(STORAGE_SESSION_KEYS)),
        );
        const requiredTailWarnings = requiredTailFailures.map(({ code, error }) => (
          buildMaintenanceWarning(code, error)
        ));
        if (settingsMutationError) {
          settingsMutationError.maintenanceTail = {
            failures: requiredTailWarnings,
          };
          throw settingsMutationError;
        }
        if (requiredTailFailures.length > 0) {
          const [primaryTailFailure] = requiredTailFailures;
          primaryTailFailure.error.maintenanceTailFailures = requiredTailWarnings;
          throw primaryTailFailure.error;
        }
        return { reset: 'app' };
      },
    });
    return outcome.value;
  }

  async function runStorageSupportAction({ task } = {}) {
    const normalizedTask = typeof task === 'string' ? task.trim() : '';
    const now = Date.now();

    if (normalizedTask === STORAGE_SUPPORT_TASKS.ENSURE_DOMAIN_HASH_ARTIFACTS) {
      const settingsMutation = await settingsService.runExclusiveExternalSettingsMutation({
        actionReason: 'ensure_domain_hash_artifacts',
        mutate: () => settingsPersistence.ensureDomainHashArtifacts().then((repaired) => ({
          result: requireMaintenanceBoolean(
            repaired,
            'BACKGROUND_MAINTENANCE_DOMAIN_HASH_REPAIR_RESULT_INVALID',
          ),
          settingsChanged: repaired === true,
        })),
      });
      return {
        task: normalizedTask,
        repaired: requireMaintenanceBoolean(
          settingsMutation.mutationResult,
          'BACKGROUND_MAINTENANCE_DOMAIN_HASH_REPAIR_RESULT_INVALID',
        ),
      };
    }

    if (normalizedTask === STORAGE_SUPPORT_TASKS.RUN_STATS_RETENTION) {
      const retention = await statsRetentionJob.run({
        now,
        maxDays: maxDaysStored,
        force: true,
      });
      return {
        task: normalizedTask,
        retention: requireStatsRetentionResult(retention),
      };
    }

    if (normalizedTask === STORAGE_SUPPORT_TASKS.CLEAR_RUNTIME_SESSION) {
      const warnings = [];
      await runBestEffortMaintenanceStep(
        warnings,
        'CLEAR_RUNTIME_SESSION_REMOVE_SESSION_FAILED',
        () => runtimeSessionRepository.remove(STORAGE_SUPPORT_SESSION_KEYS),
      );
      resetStatsState();
      await TabTimeTracker.resetState();
      await runBestEffortMaintenanceStep(
        warnings,
        'CLEAR_RUNTIME_SESSION_LOAD_STATS_CACHE_FAILED',
        () => loadStatsCache(now),
      );
      await runBestEffortMaintenanceStep(
        warnings,
        'CLEAR_RUNTIME_SESSION_CYCLE_RELOAD_FAILED',
        () => cycleStateManager.reload(now, { resetRuntimeCheckpoint: true }),
      );
      await runBestEffortMaintenanceStep(
        warnings,
        'CLEAR_RUNTIME_SESSION_GLOBAL_CAP_STATUS_FAILED',
        () => checkGlobalCapStatus(now),
      );
      invalidateBootPrewarmSnapshot('support_clear_runtime_session');
      return withMaintenanceWarnings({
        task: normalizedTask,
        clearedKeys: [...STORAGE_SUPPORT_SESSION_KEYS],
      }, warnings);
    }

    if (normalizedTask === STORAGE_SUPPORT_TASKS.CLEAR_FAVICON_CACHE) {
      await faviconRepository.clear();
      return {
        task: normalizedTask,
        cleared: true,
      };
    }

    throw new Error('UNSUPPORTED_STORAGE_SUPPORT_TASK');
  }

  return {
    resetAnalyticsData,
    resetAppData,
    runStorageSupportAction,
  };
}
