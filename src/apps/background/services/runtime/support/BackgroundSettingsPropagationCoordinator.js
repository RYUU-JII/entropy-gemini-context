import { normalizeChangedKeys } from '../../../../../domains/settings/config/settingsUpdateKeys.js';
import { mergeBootstrapSnapshotChangedKeys } from '../../../../../domains/settings/config/bootstrapSnapshotInvalidation.js';
import { requireInjectionSummary, createCatchUpReadinessFailureError } from '../../../../../domains/tracking/background/contentScriptOrchestratorState.js';
import { requireSettingsPropagationContext, settingsPropagationDiagnostic } from '../../../../../domains/settings/contracts/settingsPropagationContext.js';

const SETTINGS_PROPAGATION_RETRY_BASE_DELAY_MS = 250;
const SETTINGS_PROPAGATION_RETRY_MAX_DELAY_MS = 4000;
const SETTINGS_PROPAGATION_MAX_RETRIES = 3;
const SETTINGS_BROADCAST_FAILURE_DIAGNOSTIC_LIMIT = 8;
const SETTINGS_BROADCAST_DIAGNOSTIC_TEXT_LIMIT = 240;

const SETTINGS_PROPAGATION_STAGE_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: 'refresh_cache',
    enabledKey: 'shouldRefresh',
    handlerKey: 'refreshSettingsCache',
    call: async ({ handlers }) => handlers.refreshSettingsCache(),
  }),
  Object.freeze({
    key: 'auto_purge',
    enabledKey: 'shouldAutoPurge',
    handlerKey: 'cleanupBlockedHistory',
    call: async ({ handlers }) => handlers.cleanupBlockedHistory(),
  }),
  Object.freeze({
    key: 'sync_blocked_bookmarks',
    enabledKey: 'shouldSyncBlockedBookmarks',
    handlerKey: 'syncBlockedBookmarks',
    call: async ({ handlers }) => handlers.syncBlockedBookmarks(),
  }),
  Object.freeze({
    key: 'runtime_adapters',
    enabledKey: 'shouldRunRuntimeAdapters',
    handlerKey: 'applyRuntimeSettingsAdapters',
    call: async ({ handlers, task }) => handlers.applyRuntimeSettingsAdapters({
      changedKeys: task.changedKeys,
    }),
  }),
  Object.freeze({
    key: 'managed_content_script_sync',
    enabledKey: 'shouldSyncScripts',
    handlerKey: 'syncManagedContentScripts',
    call: async ({ handlers, task, propagationContext }) => {
      const result = await handlers.syncManagedContentScripts({
        injectOpenTabs: true,
        reason: task.actionReason,
        propagationContext,
      });
      const summary = requireInjectionSummary(result?.injectionSummary);
      if (summary.failureCount > 0) {
        throw createCatchUpReadinessFailureError(summary, summary.failures, task.actionReason);
      }
      return result;
    },
  }),
  Object.freeze({
    key: 'broadcast',
    enabledKey: 'shouldBroadcast',
    handlerKey: 'broadcastSettingsUpdate',
    call: async ({ handlers, task, propagationContext }) => {
      const summary = validateBroadcastSummary(
        await handlers.broadcastSettingsUpdate({ changedKeys: task.changedKeys, propagationContext }),
      );
      if (summary.success !== true) {
        const diagnostic = buildBoundedBroadcastDiagnostic(summary);
        const error = new Error(`SETTINGS_BROADCAST_INCOMPLETE summary=${diagnostic}`);
        error.code = 'SETTINGS_BROADCAST_INCOMPLETE';
        error.summary = summary;
        throw error;
      }
      return summary;
    },
  }),
]);

const STAGE_KEYS = Object.freeze(SETTINGS_PROPAGATION_STAGE_DEFINITIONS.map((stage) => stage.key));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function createBroadcastSummaryContractError(field) {
  const error = new Error(`SETTINGS_BROADCAST_SUMMARY_INVALID:${field}`);
  error.code = 'SETTINGS_BROADCAST_SUMMARY_INVALID';
  error.field = field;
  return error;
}

function requireBroadcastSummaryCount(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw createBroadcastSummaryContractError(field);
  }
  return value;
}

function validateBroadcastSummary(summary) {
  if (!isPlainObject(summary)) {
    throw createBroadcastSummaryContractError('summary');
  }
  if (typeof summary.success !== 'boolean') {
    throw createBroadcastSummaryContractError('success');
  }
  if (typeof summary.mode !== 'string' || !summary.mode.trim()) {
    throw createBroadcastSummaryContractError('mode');
  }

  const attemptedCount = requireBroadcastSummaryCount(summary.attemptedCount, 'attemptedCount');
  const acknowledgedCount = requireBroadcastSummaryCount(
    summary.acknowledgedCount,
    'acknowledgedCount',
  );
  const skippedCount = requireBroadcastSummaryCount(summary.skippedCount, 'skippedCount');
  const failedCount = requireBroadcastSummaryCount(summary.failedCount, 'failedCount');
  if (attemptedCount !== acknowledgedCount + skippedCount + failedCount) {
    throw createBroadcastSummaryContractError('attemptedCount');
  }
  if (!Array.isArray(summary.failures)) {
    throw createBroadcastSummaryContractError('failures');
  }
  if (summary.failures.length !== failedCount) {
    throw createBroadcastSummaryContractError('failures.length');
  }
  summary.failures.forEach((failure, index) => {
    if (!isPlainObject(failure)) {
      throw createBroadcastSummaryContractError(`failures.${index}`);
    }
  });
  if (summary.success !== (failedCount === 0)) {
    throw createBroadcastSummaryContractError('success');
  }
  return summary;
}

function normalizeBroadcastDiagnosticText(value, maxLength = SETTINGS_BROADCAST_DIAGNOSTIC_TEXT_LIMIT) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim().slice(0, maxLength);
}

function buildBoundedBroadcastDiagnostic(summary) {
  const failures = summary.failures
    .slice(0, SETTINGS_BROADCAST_FAILURE_DIAGNOSTIC_LIMIT)
    .map((failure) => ({
      tabId: Number.isInteger(failure.tabId) && failure.tabId >= 0 ? failure.tabId : null,
      url: normalizeBroadcastDiagnosticText(failure.url),
      code: normalizeBroadcastDiagnosticText(failure.code, 96),
      message: normalizeBroadcastDiagnosticText(failure.message),
      reason: normalizeBroadcastDiagnosticText(failure.reason, 96),
    }));
  return JSON.stringify({
    mode: normalizeBroadcastDiagnosticText(summary.mode, 64),
    attemptedCount: summary.attemptedCount,
    acknowledgedCount: summary.acknowledgedCount,
    skippedCount: summary.skippedCount,
    failedCount: summary.failedCount,
    failures,
    omittedFailureCount: Math.max(0, summary.failures.length - failures.length),
  });
}

function describePropagationError(error) {
  return {
    code: typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : null,
    message: typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : String(error || 'UNKNOWN_ERROR'),
    name: typeof error?.name === 'string' && error.name.trim() ? error.name.trim() : null,
  };
}

function createStageCheckpointError(stageKey, cause) {
  const error = new Error(`SETTINGS_PROPAGATION_STAGE_CHECKPOINT_FAILED:${stageKey}`);
  error.code = 'SETTINGS_PROPAGATION_STAGE_CHECKPOINT_FAILED';
  error.stage = stageKey;
  error.cause = cause;
  return error;
}

function formatList(values = []) {
  return Array.isArray(values) && values.length > 0 ? values.join(',') : '(none)';
}

function formatPropagationDiagnostic(fields = {}) {
  const error = describePropagationError(fields.error);
  return [
    `taskId=${Number.isInteger(fields.taskId) ? fields.taskId : 'n/a'}`,
    `commitVersion=${Number.isInteger(fields.commitVersion) ? fields.commitVersion : 'n/a'}`,
    `stage=${fields.stage || 'n/a'}`,
    `actionReason=${fields.actionReason || 'settings_change'}`,
    `changedKeys=${formatList(fields.changedKeys)}`,
    `retryCount=${Number.isInteger(fields.retryCount) ? fields.retryCount : 0}`,
    `retryDelayMs=${Number.isFinite(fields.retryDelayMs) ? fields.retryDelayMs : 'not_scheduled'}`,
    `code=${error.code || 'n/a'}`,
    `name=${error.name || 'n/a'}`,
    `message=${error.message}`,
  ].join(' ');
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function normalizeCommitVersion(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeActionReason(value, fallback = 'settings_change') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeRetryCounts(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(STAGE_KEYS.map((stageKey) => [
    stageKey,
    normalizeNonNegativeInteger(source[stageKey], 0),
  ]));
}

function normalizeAppliedStages(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(STAGE_KEYS.map((stageKey) => [
    stageKey,
    source[stageKey] === true,
  ]));
}

function normalizeTask(task = {}, { taskId = 0 } = {}) {
  return {
    taskId: normalizeNonNegativeInteger(task?.taskId, normalizeNonNegativeInteger(taskId, 0)),
    commitVersion: normalizeCommitVersion(task?.commitVersion),
    actionReason: typeof task?.actionReason === 'string' && task.actionReason.trim()
      ? task.actionReason.trim()
      : 'settings_change',
    changedKeys: normalizeChangedKeys(task?.changedKeys),
    shouldRefresh: task?.shouldRefresh === true,
    shouldAutoPurge: task?.shouldAutoPurge === true,
    shouldSyncBlockedBookmarks: task?.shouldSyncBlockedBookmarks === true,
    shouldRunRuntimeAdapters: task?.shouldRunRuntimeAdapters === true,
    shouldSyncScripts: task?.shouldSyncScripts === true,
    shouldBroadcast: task?.shouldBroadcast === true,
    retryCounts: normalizeRetryCounts(task?.retryCounts),
    appliedStages: normalizeAppliedStages(task?.appliedStages),
  };
}

function mergeTasks(base = null, next = null, { resetNextRetries = false } = {}) {
  if (!base) return next ? normalizeTask(next) : null;
  if (!next) return normalizeTask(base);

  const normalizedBase = normalizeTask(base);
  const normalizedNext = normalizeTask(next);
  const hasFreshNextTask = normalizedNext.taskId > normalizedBase.taskId;
  const merged = {
    taskId: Math.max(normalizedBase.taskId, normalizedNext.taskId),
    commitVersion: normalizedNext.commitVersion ?? normalizedBase.commitVersion,
    actionReason: normalizedNext.actionReason || normalizedBase.actionReason,
    changedKeys: mergeBootstrapSnapshotChangedKeys(normalizedBase.changedKeys, normalizedNext.changedKeys),
    retryCounts: {},
    appliedStages: {},
  };

  SETTINGS_PROPAGATION_STAGE_DEFINITIONS.forEach((stage) => {
    const baseEnabled = normalizedBase[stage.enabledKey];
    const nextEnabled = normalizedNext[stage.enabledKey];
    merged[stage.enabledKey] = baseEnabled || nextEnabled;
    merged.retryCounts[stage.key] = resetNextRetries && hasFreshNextTask && merged[stage.enabledKey]
      ? 0
      : Math.max(
        normalizedBase.retryCounts[stage.key],
        normalizedNext.retryCounts[stage.key],
      );
    merged.appliedStages[stage.key] = resetNextRetries && hasFreshNextTask && nextEnabled
      ? normalizedNext.appliedStages[stage.key]
      : (
        normalizedBase.appliedStages[stage.key]
        || normalizedNext.appliedStages[stage.key]
      );
  });

  return normalizeTask(merged);
}

function buildRetryTask(task, failures = []) {
  const failureStageKeys = new Set(failures.map((failure) => failure.stage));
  const retryCounts = { ...task.retryCounts };
  const retryTask = {
    ...task,
    retryCounts,
  };

  SETTINGS_PROPAGATION_STAGE_DEFINITIONS.forEach((stage) => {
    retryTask[stage.enabledKey] = failureStageKeys.has(stage.key);
  });
  failures.forEach((failure) => {
    if (failure.blocked === true) return;
    retryCounts[failure.stage] = normalizeNonNegativeInteger(retryCounts[failure.stage], 0) + 1;
  });
  return normalizeTask(retryTask);
}

function buildRecoverableFailedTask(task, failures = []) {
  const normalizedTask = normalizeTask(task);
  const failureStageKeys = new Set(
    failures
      .map((failure) => failure?.stage)
      .filter((stageKey) => STAGE_KEYS.includes(stageKey)),
  );
  const recoveryTask = {
    ...normalizedTask,
    retryCounts: { ...normalizedTask.retryCounts },
    appliedStages: { ...normalizedTask.appliedStages },
  };
  SETTINGS_PROPAGATION_STAGE_DEFINITIONS.forEach((stage) => {
    recoveryTask[stage.enabledKey] = failureStageKeys.has(stage.key);
  });
  return normalizeTask(recoveryTask);
}

function getRetryDelayMs(retryCount) {
  const normalizedRetryCount = normalizeNonNegativeInteger(retryCount, 0);
  return Math.min(
    SETTINGS_PROPAGATION_RETRY_MAX_DELAY_MS,
    SETTINGS_PROPAGATION_RETRY_BASE_DELAY_MS * (2 ** normalizedRetryCount),
  );
}

function validatePropagationHandlers(handlers) {
  for (const stage of SETTINGS_PROPAGATION_STAGE_DEFINITIONS) {
    if (typeof handlers[stage.handlerKey] !== 'function') {
      throw new Error(`SETTINGS_PROPAGATION_HANDLER_REQUIRED:${stage.handlerKey}`);
    }
  }
}

function validateCheckpointRepository(checkpointRepository) {
  if (
    !checkpointRepository
    || typeof checkpointRepository.read !== 'function'
    || typeof checkpointRepository.writePending !== 'function'
    || typeof checkpointRepository.writeFailed !== 'function'
    || typeof checkpointRepository.clear !== 'function'
  ) {
    throw new Error('SETTINGS_PROPAGATION_CHECKPOINT_REPOSITORY_REQUIRED');
  }
}

function createAppliedSummary(appliedStages = {}) {
  const source = normalizeAppliedStages(appliedStages);
  return {
    refreshed: source.refresh_cache,
    autoPurged: source.auto_purge,
    syncedBlockedBookmarks: source.sync_blocked_bookmarks,
    runtimeAdapters: source.runtime_adapters,
    syncScripts: source.managed_content_script_sync,
    broadcast: source.broadcast,
  };
}

function createFailureOutcome(task, failures) {
  return {
    status: 'failed',
    taskId: task.taskId,
    commitVersion: task.commitVersion,
    changedKeys: [...task.changedKeys],
    applied: createAppliedSummary(task.appliedStages),
    failures: failures.map((failure) => ({
      stage: failure.stage,
      retryCount: normalizeNonNegativeInteger(task.retryCounts[failure.stage], 0),
      error: describePropagationError(failure.error),
    })),
  };
}

function createSuccessOutcome(task) {
  return {
    status: 'succeeded',
    taskId: task.taskId,
    commitVersion: task.commitVersion,
    changedKeys: [...task.changedKeys],
    applied: createAppliedSummary(task.appliedStages),
    failures: [],
  };
}

function createCheckpointFailureOutcome(task, error, failures = []) {
  return createFailureOutcome(task, [
    ...failures,
    {
      stage: 'checkpoint_sync',
      error,
      blocked: false,
    },
  ]);
}

export function createBackgroundSettingsPropagationCoordinator({
  refreshSettingsCache,
  applyRuntimeSettingsAdapters,
  cleanupBlockedHistory,
  syncBlockedBookmarks,
  syncManagedContentScripts,
  broadcastSettingsUpdate,
  checkpointRepository,
} = {}) {
  const handlers = {
    refreshSettingsCache,
    applyRuntimeSettingsAdapters,
    cleanupBlockedHistory,
    syncBlockedBookmarks,
    syncManagedContentScripts,
    broadcastSettingsUpdate,
  };
  validatePropagationHandlers(handlers);
  validateCheckpointRepository(checkpointRepository);
  const ownerEpoch = crypto.randomUUID();

  let pendingTask = null;
  let pendingTaskAdmission = null;
  let processingTask = null;
  let settlingTask = null;
  let processingExecution = null;
  let processing = false;
  let retryTimerId = null;
  let nextTaskId = 1;
  let lastOutcome = null;
  let recoverableFailedTask = null;
  let checkpointRestorePromise = null;
  let checkpointSyncTail = Promise.resolve();
  let lifecycleGeneration = 0;
  let processingPromise = null;
  let profileMutationPhase = 'open';
  let profileMutationQuiescePromise = null;
  const idleWaiters = new Set();
  const taskWaiters = new Set();
  const taskOutcomeById = new Map();

  function assertProfileMutationAdmissionOpen() {
    if (profileMutationPhase !== 'open') {
      throw new Error(
        `SETTINGS_PROPAGATION_PROFILE_MUTATION_ADMISSION_CLOSED:${profileMutationPhase}`,
      );
    }
  }

  function isIdle() {
    return !pendingTask && !processing && retryTimerId === null;
  }

  function clearRetryTimer() {
    if (retryTimerId !== null) {
      clearTimeout(retryTimerId);
      retryTimerId = null;
    }
  }

  function buildOutstandingTask() {
    if (processingTask && pendingTask) {
      return mergeTasks(processingTask, pendingTask, { resetNextRetries: true });
    }
    return normalizeTask(processingTask || pendingTask || {});
  }

  function enqueueCheckpointOperation(operationName, operation, diagnosticTask = null) {
    const task = diagnosticTask ? normalizeTask(diagnosticTask) : buildOutstandingTask();
    const run = checkpointSyncTail.then(operation, operation);
    checkpointSyncTail = run.catch((error) => {
      console.warn(
        `[SETTINGS_FLOW][postCommit][checkpoint_sync_failed] operation=${operationName} ${formatPropagationDiagnostic({
          taskId: task.taskId,
          commitVersion: task.commitVersion,
          stage: 'checkpoint_sync',
          actionReason: task.actionReason,
          changedKeys: task.changedKeys,
          error,
        })}`,
      );
    });
    return run;
  }

  function logTerminalCheckpointFailure(task, error, phase) {
    console.error(
      `[SETTINGS_FLOW][postCommit][checkpoint_failed_retained] phase=${phase} ${formatPropagationDiagnostic({
        taskId: task.taskId,
        commitVersion: task.commitVersion,
        stage: 'checkpoint_sync',
        actionReason: task.actionReason,
        changedKeys: task.changedKeys,
        error,
      })}`,
    );
  }

  function persistOutstandingTask(diagnosticTask = null) {
    return enqueueCheckpointOperation('write_outstanding', async () => {
      const outstandingTask = processingTask || pendingTask
        ? buildOutstandingTask()
        : null;
      if (!outstandingTask) {
        await checkpointRepository.clear();
        return null;
      }
      return checkpointRepository.writePending(outstandingTask);
    }, diagnosticTask);
  }

  function persistFailure(task, outcome) {
    return enqueueCheckpointOperation(
      'write_failed',
      () => checkpointRepository.writeFailed(task, outcome),
      task,
    );
  }

  function recordTaskOutcome(outcome) {
    // Delivery identity belongs to this live owner, never to the durable outbox.
    const deliveryOutcome = { ...outcome, ownerEpoch };
    console.debug('[SETTINGS_FLOW][postCommit][terminal]', {
      taskId: outcome.taskId, commitVersion: outcome.commitVersion, status: outcome.status,
      applied: outcome.applied, failures: outcome.failures,
    });
    lastOutcome = deliveryOutcome;
    if (Number.isInteger(outcome?.taskId) && outcome.taskId > 0) {
      taskOutcomeById.forEach((knownOutcome, taskId) => {
        if (knownOutcome === null && taskId <= outcome.taskId) {
          taskOutcomeById.set(taskId, deliveryOutcome);
        }
      });
      taskOutcomeById.set(outcome.taskId, deliveryOutcome);
    }
    return deliveryOutcome;
  }

  function resolveTaskWaiters(outcome) {
    Array.from(taskWaiters).forEach((waiter) => {
      if (waiter.taskId > outcome.taskId) return;
      taskWaiters.delete(waiter);
      if (waiter.timerId !== null) clearTimeout(waiter.timerId);
      taskOutcomeById.set(waiter.taskId, outcome);
      waiter.resolve(outcome);
    });
  }

  function resolveIdleWaiters() {
    if (!isIdle()) return;
    const outcome = lastOutcome || {
      status: 'idle',
      taskId: 0,
      commitVersion: null,
      changedKeys: [],
      applied: createAppliedSummary(),
      failures: [],
    };
    Array.from(idleWaiters).forEach((waiter) => {
      idleWaiters.delete(waiter);
      if (waiter.timerId !== null) clearTimeout(waiter.timerId);
      waiter.resolve({ idle: true, ...outcome });
    });
  }

  async function runTask(task, isCurrent, propagationContext) {
    const failures = [];
    let refreshFailed = false;
    let checkpointFailed = false;

    for (const stage of SETTINGS_PROPAGATION_STAGE_DEFINITIONS) {
      if (!isCurrent()) return null;
      if (propagationContext.signal.aborted) return failures;
      if (!task[stage.enabledKey]) continue;
      if (task.appliedStages[stage.key] === true) continue;
      if (refreshFailed || checkpointFailed) {
        const blockedCode = refreshFailed
          ? 'SETTINGS_PROPAGATION_BLOCKED_BY_REFRESH'
          : 'SETTINGS_PROPAGATION_BLOCKED_BY_CHECKPOINT';
        const blockedError = new Error(blockedCode);
        blockedError.code = blockedCode;
        failures.push({
          stage: stage.key,
          error: blockedError,
          blocked: true,
        });
        continue;
      }

      try {
        console.debug('[SETTINGS_FLOW][postCommit][stage_started]', {
          ...settingsPropagationDiagnostic(propagationContext), stage: stage.key,
        });
        await stage.call({ handlers, task, propagationContext });
        if (!isCurrent()) return null;
        if (propagationContext.signal.aborted
          && (stage.key === 'managed_content_script_sync' || stage.key === 'broadcast')) return failures;
        task.appliedStages[stage.key] = true;
        try {
          await persistOutstandingTask(task);
          console.debug('[SETTINGS_FLOW][postCommit][stage_checkpointed]', {
            ...settingsPropagationDiagnostic(propagationContext), stage: stage.key,
          });
        } catch (error) {
          task.appliedStages[stage.key] = false;
          checkpointFailed = true;
          const checkpointError = createStageCheckpointError(stage.key, error);
          failures.push({ stage: stage.key, error: checkpointError, blocked: false });
          console.warn(
            `[SETTINGS_FLOW][postCommit][stage_checkpoint_failed] ${formatPropagationDiagnostic({
              taskId: task.taskId,
              commitVersion: task.commitVersion,
              stage: stage.key,
              actionReason: task.actionReason,
              changedKeys: task.changedKeys,
              retryCount: task.retryCounts[stage.key],
              error: checkpointError,
            })}`,
          );
        }
      } catch (error) {
        if (!isCurrent()) return null;
        if (propagationContext.signal.aborted) {
          console.debug('[SETTINGS_FLOW][postCommit][stage_cancelled]', {
            ...settingsPropagationDiagnostic(propagationContext), stage: stage.key,
            error: describePropagationError(error),
          });
          return failures;
        }
        failures.push({ stage: stage.key, error, blocked: false });
        if (stage.key === 'refresh_cache') refreshFailed = true;
        console.warn(
          `[SETTINGS_FLOW][postCommit][${stage.key}_failed] ${formatPropagationDiagnostic({
            taskId: task.taskId,
            commitVersion: task.commitVersion,
            stage: stage.key,
            actionReason: task.actionReason,
            changedKeys: task.changedKeys,
            retryCount: task.retryCounts[stage.key],
            error,
          })}`,
        );
      }
    }

    return failures;
  }

  function ensureProcessingScheduled() {
    if (
      profileMutationPhase !== 'open'
      || processing
      || processingPromise
      || retryTimerId !== null
      || !pendingTask
    ) return;
    const scheduledGeneration = lifecycleGeneration;
    queueMicrotask(() => {
      if (
        profileMutationPhase !== 'open'
        || scheduledGeneration !== lifecycleGeneration
        || processing
        || processingPromise
        || !pendingTask
      ) return;
      const run = processPendingTasks();
      processingPromise = run;
      void run.catch((error) => {
        console.error(
          `[SETTINGS_FLOW][postCommit][coordinator_failed] ${formatPropagationDiagnostic({
            taskId: processingTask?.taskId || pendingTask?.taskId,
            commitVersion: processingTask?.commitVersion ?? pendingTask?.commitVersion,
            stage: 'coordinator',
            actionReason: processingTask?.actionReason || pendingTask?.actionReason,
            changedKeys: processingTask?.changedKeys || pendingTask?.changedKeys,
            error,
          })}`,
        );
      }).finally(() => {
        if (processingPromise === run) {
          processingPromise = null;
          ensureProcessingScheduled();
        }
      });
    });
  }

  async function settleSuccessfulTask(task, isCurrent) {
    settlingTask = task;
    let outcome = createSuccessOutcome(task);
    try {
      await persistOutstandingTask(task);
    } catch (error) {
      outcome = createCheckpointFailureOutcome(task, error);
      logTerminalCheckpointFailure(task, error, 'success_checkpoint');
    }
    if (!isCurrent()) {
      settlingTask = null;
      return;
    }
    outcome = recordTaskOutcome(outcome);
    resolveTaskWaiters(outcome);
    settlingTask = null;
  }

  async function settleFailedTask(task, failures, isCurrent) {
    settlingTask = task;
    const recoveryTask = buildRecoverableFailedTask(task, failures);
    recoverableFailedTask = recoveryTask;
    let outcome = createFailureOutcome(task, failures);
    try {
      if (pendingTask) {
        pendingTask = mergeTasks(recoveryTask, pendingTask, { resetNextRetries: true });
        recoverableFailedTask = null;
        await persistOutstandingTask(task);
      } else {
        await persistFailure(task, outcome);
      }
    } catch (error) {
      outcome = createCheckpointFailureOutcome(task, error, failures);
      logTerminalCheckpointFailure(task, error, 'failure_checkpoint');
    }
    if (!isCurrent()) {
      settlingTask = null;
      return;
    }
    outcome = recordTaskOutcome(outcome);
    resolveTaskWaiters(outcome);
    settlingTask = null;
  }

  async function processPendingTasks() {
    if (processing || !pendingTask) {
      resolveIdleWaiters();
      return;
    }

    clearRetryTimer();
    processing = true;
    const runGeneration = lifecycleGeneration;
    const isCurrent = () => runGeneration === lifecycleGeneration;

    try {
      while (pendingTask && isCurrent()) {
        // A finishing older execution can observe fresh intent before its write
        // settles. Only the latest admission ACK may release that pending task.
        const admission = pendingTaskAdmission;
        if (admission) {
          try {
            await admission;
          } catch (error) {
            if (!isCurrent()) return;
            if (pendingTaskAdmission !== admission) continue;
            const failedTask = pendingTask;
            pendingTask = null;
            pendingTaskAdmission = null;
            const unfinished = SETTINGS_PROPAGATION_STAGE_DEFINITIONS
              .filter(stage => failedTask[stage.enabledKey] && !failedTask.appliedStages[stage.key])
              .map(stage => ({ stage: stage.key, error: createStageCheckpointError(stage.key, error), blocked: false }));
            if (unfinished.length > 0) {
              await settleFailedTask(failedTask, unfinished, isCurrent);
            } else {
              const outcome = recordTaskOutcome(createCheckpointFailureOutcome(failedTask, error));
              logTerminalCheckpointFailure(failedTask, error, 'admission_checkpoint');
              resolveTaskWaiters(outcome);
            }
            continue;
          }
          if (!isCurrent()) return;
          if (pendingTaskAdmission !== admission) continue;
          pendingTaskAdmission = null;
        }
        processingTask = pendingTask;
        pendingTask = null;
        const task = processingTask;
        const controller = new AbortController();
        const propagationContext = Object.freeze(requireSettingsPropagationContext({
          taskId: task.taskId, commitVersion: task.commitVersion,
          executionId: crypto.randomUUID(), signal: controller.signal,
        }));
        processingExecution = { controller, propagationContext };
        const failures = await runTask(task, isCurrent, propagationContext);
        processingExecution = null;
        if (!isCurrent() || failures === null) return;

        if (pendingTask && pendingTask.taskId > task.taskId) {
          // Carry every unfinished obligation into the latest task. Earlier
          // waiters resolve only when that covering task reaches a terminal result.
          pendingTask = mergeTasks(task, pendingTask, { resetNextRetries: true });
          processingTask = null;
          console.debug('[SETTINGS_FLOW][postCommit][superseded]', {
            ...settingsPropagationDiagnostic(propagationContext),
            successorTaskId: pendingTask.taskId, successorCommitVersion: pendingTask.commitVersion,
          });
          try {
            await persistOutstandingTask(task);
          } catch (error) {
            // No successor side effect may start without a durable handoff.
            const failedTask = pendingTask;
            pendingTask = null;
            pendingTaskAdmission = null;
            const unfinished = SETTINGS_PROPAGATION_STAGE_DEFINITIONS
              .filter(stage => failedTask[stage.enabledKey] && !failedTask.appliedStages[stage.key])
              .map(stage => ({ stage: stage.key, error: createStageCheckpointError(stage.key, error), blocked: false }));
            await settleFailedTask(failedTask, unfinished, isCurrent);
          }
          continue;
        }

        if (failures.length === 0) {
          processingTask = null;
          await settleSuccessfulTask(task, isCurrent);
          continue;
        }

        const exhaustedFailure = failures.find((failure) => (
          failure.blocked !== true
          && task.retryCounts[failure.stage] >= SETTINGS_PROPAGATION_MAX_RETRIES
        ));

        if (exhaustedFailure && pendingTask) {
          const retryTask = buildRetryTask(task, failures);
          pendingTask = mergeTasks(retryTask, pendingTask, { resetNextRetries: true });
          processingTask = null;
          try {
            await persistOutstandingTask(task);
          } catch (error) {
            // enqueueCheckpointOperation reports the durable-write failure; fresh live work still proceeds.
          }
          if (!isCurrent()) return;
          console.warn(
            `[SETTINGS_FLOW][postCommit][retry_budget_refreshed] ${formatPropagationDiagnostic({
              taskId: pendingTask.taskId,
              commitVersion: pendingTask.commitVersion,
              stage: exhaustedFailure.stage,
              actionReason: pendingTask.actionReason,
              changedKeys: pendingTask.changedKeys,
              retryCount: pendingTask.retryCounts[exhaustedFailure.stage],
              error: exhaustedFailure.error,
            })}`,
          );
          continue;
        }

        if (exhaustedFailure) {
          console.error(
            `[SETTINGS_FLOW][postCommit][failed_retained] ${formatPropagationDiagnostic({
              taskId: task.taskId,
              commitVersion: task.commitVersion,
              stage: exhaustedFailure.stage,
              actionReason: task.actionReason,
              changedKeys: task.changedKeys,
              retryCount: task.retryCounts[exhaustedFailure.stage],
              error: exhaustedFailure.error,
            })}`,
          );
          processingTask = null;
          await settleFailedTask(task, failures, isCurrent);
          continue;
        }

        const retryTask = buildRetryTask(task, failures);
        const nextRetryCount = Math.max(...failures
          .filter((failure) => failure.blocked !== true)
          .map((failure) => retryTask.retryCounts[failure.stage]));
        const retryDelayMs = getRetryDelayMs(Math.max(0, nextRetryCount - 1));
        pendingTask = pendingTask
          ? mergeTasks(retryTask, pendingTask, { resetNextRetries: true })
          : retryTask;
        processingTask = null;
        try {
          await persistOutstandingTask(task);
        } catch (error) {
          // enqueueCheckpointOperation reports the durable-write failure; the live retry still proceeds.
        }
        if (!isCurrent()) return;

        const primaryFailure = failures.find((failure) => failure.blocked !== true) || failures[0];
        console.warn(
          `[SETTINGS_FLOW][postCommit][retry_scheduled] ${formatPropagationDiagnostic({
            taskId: task.taskId,
            commitVersion: task.commitVersion,
            stage: primaryFailure.stage,
            actionReason: task.actionReason,
            changedKeys: task.changedKeys,
            retryCount: nextRetryCount,
            retryDelayMs,
            error: primaryFailure.error,
          })}`,
        );
        retryTimerId = setTimeout(() => {
          retryTimerId = null;
          ensureProcessingScheduled();
        }, retryDelayMs);
        return;
      }
    } finally {
      if (isCurrent()) {
        processing = false;
        resolveIdleWaiters();
      }
    }
  }

  function ensureCheckpointRestored() {
    assertProfileMutationAdmissionOpen();
    if (checkpointRestorePromise) return checkpointRestorePromise;
    const restoreGeneration = lifecycleGeneration;
    const isCurrent = () => restoreGeneration === lifecycleGeneration;
    const restoreRun = (async () => {
      const checkpoint = await checkpointRepository.read();
      if (!isCurrent()) return { restored: false, status: 'reset' };
      if (!checkpoint) return { restored: false, status: 'empty' };

      nextTaskId = Math.max(nextTaskId, checkpoint.task.taskId + 1);
      if (checkpoint.status === 'failed') {
        const outcome = recordTaskOutcome(checkpoint.outcome);
        recoverableFailedTask = buildRecoverableFailedTask(
          checkpoint.task,
          checkpoint.outcome.failures,
        );
        return {
          restored: false,
          status: 'failed',
          taskId: checkpoint.task.taskId,
          commitVersion: checkpoint.task.commitVersion,
          outcome,
        };
      }

      pendingTask = mergeTasks(pendingTask, checkpoint.task);
      ensureProcessingScheduled();
      return {
        restored: true,
        status: 'pending',
        taskId: checkpoint.task.taskId,
        commitVersion: checkpoint.task.commitVersion,
      };
    })();
    checkpointRestorePromise = restoreRun;
    void restoreRun.catch(() => {
      if (checkpointRestorePromise === restoreRun) {
        checkpointRestorePromise = null;
      }
    });
    return restoreRun;
  }

  async function schedulePostCommitEffects(task = {}, { waitForCompletion = false, timeoutMs = 0 } = {}) {
    assertProfileMutationAdmissionOpen();
    await ensureCheckpointRestored();
    assertProfileMutationAdmissionOpen();
    const taskId = nextTaskId;
    nextTaskId += 1;
    const nextTask = normalizeTask(task, { taskId });
    const recoveryTask = recoverableFailedTask;
    recoverableFailedTask = null;
    const scheduledTask = recoveryTask
      ? mergeTasks(recoveryTask, nextTask, { resetNextRetries: true })
      : nextTask;
    pendingTask = mergeTasks(pendingTask, scheduledTask, { resetNextRetries: true });
    // Persistence already committed this intent. Revoke older continuations
    // before awaiting the checkpoint write, while retaining their settlement.
    if (processingExecution && !processingExecution.controller.signal.aborted) {
      processingExecution.controller.abort(new Error('SETTINGS_PROPAGATION_SUPERSEDED'));
    }

    if (retryTimerId !== null) {
      clearRetryTimer();
    }
    const admissionTask = buildOutstandingTask();
    const admission = enqueueCheckpointOperation(
      'write_admission',
      () => checkpointRepository.writePending(admissionTask),
      admissionTask,
    );
    pendingTaskAdmission = admission;
    try {
      await admission;
    } catch (error) {
      if (profileMutationPhase === 'open') ensureProcessingScheduled();
      throw error;
    }
    assertProfileMutationAdmissionOpen();
    ensureProcessingScheduled();

    const receipt = {
      status: 'scheduled',
      taskId,
      ownerEpoch,
      commitVersion: nextTask.commitVersion,
      changedKeys: [...nextTask.changedKeys],
    };
    if (!waitForCompletion) return receipt;
    return waitForTask(taskId, { timeoutMs });
  }

  function reconcileStartupContentScripts({ reason = 'service_init' } = {}) {
    return schedulePostCommitEffects({
      actionReason: normalizeActionReason(reason, 'service_init'),
      commitVersion: null,
      changedKeys: [],
      shouldRefresh: false,
      shouldAutoPurge: false,
      shouldSyncBlockedBookmarks: false,
      shouldRunRuntimeAdapters: false,
      shouldSyncScripts: true,
      shouldBroadcast: false,
    }, {
      waitForCompletion: true,
    });
  }

  function waitForTask(taskId, options = {}) {
    const { timeoutMs = 0 } = options;
    if (Object.hasOwn(options, 'expectedOwnerEpoch')) {
      const expected = options.expectedOwnerEpoch;
      if (typeof expected !== 'string' || !expected || expected.trim() !== expected) {
        return Promise.reject(new Error('SETTINGS_PROPAGATION_OWNER_EPOCH_INVALID'));
      }
      if (expected !== ownerEpoch) {
        return Promise.reject(new Error('SETTINGS_PROPAGATION_OWNER_CHANGED'));
      }
      try {
        assertProfileMutationAdmissionOpen();
      } catch (error) {
        return Promise.reject(error);
      }
    }
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return Promise.reject(new Error('SETTINGS_PROPAGATION_TASK_ID_INVALID'));
    }
    const normalizedTaskId = taskId;
    const exactOutcome = taskOutcomeById.get(normalizedTaskId);
    if (exactOutcome) return Promise.resolve(exactOutcome);
    if (lastOutcome && lastOutcome.taskId >= normalizedTaskId) {
      return Promise.resolve(lastOutcome);
    }
    // A task remains waitable while its terminal checkpoint write is settling,
    // after pending/processing intent has already been cleared.
    const awaitedTask = settlingTask && settlingTask.taskId >= normalizedTaskId
      ? settlingTask
      : buildOutstandingTask();
    if (awaitedTask.taskId < normalizedTaskId) {
      return Promise.reject(new Error('SETTINGS_PROPAGATION_TASK_UNKNOWN'));
    }

    const normalizedTimeoutMs = Number.isFinite(Number(timeoutMs))
      ? Math.max(0, Number(timeoutMs))
      : 0;
    return new Promise((resolve) => {
      // This is the scheduled task's receipt, not another settings snapshot.
      // Keep its identity when a bounded wait expires before a terminal outcome.
      const waiter = {
        taskId: normalizedTaskId,
        commitVersion: awaitedTask.commitVersion,
        changedKeys: [...awaitedTask.changedKeys],
        resolve,
        timerId: null,
      };
      if (normalizedTimeoutMs > 0) {
        waiter.timerId = setTimeout(() => {
          taskWaiters.delete(waiter);
          // Retain only an outcome alias, so a later unrelated completion cannot
          // hide the covering terminal result after this observer timed out.
          taskOutcomeById.set(waiter.taskId, null);
          resolve({
            status: 'timed_out',
            taskId: normalizedTaskId,
            ownerEpoch,
            commitVersion: waiter.commitVersion,
            changedKeys: [...waiter.changedKeys],
            applied: createAppliedSummary(),
            failures: [],
          });
        }, normalizedTimeoutMs);
      }
      taskWaiters.add(waiter);
    });
  }

  function waitForIdle({ timeoutMs = 0 } = {}) {
    if (isIdle()) {
      return Promise.resolve({
        idle: true,
        ...(lastOutcome || {
          status: 'idle',
          taskId: 0,
          commitVersion: null,
          changedKeys: [],
          applied: createAppliedSummary(),
          failures: [],
        }),
      });
    }

    const normalizedTimeoutMs = Number.isFinite(Number(timeoutMs))
      ? Math.max(0, Number(timeoutMs))
      : 0;
    return new Promise((resolve) => {
      const waiter = { resolve, timerId: null };
      if (normalizedTimeoutMs > 0) {
        waiter.timerId = setTimeout(() => {
          idleWaiters.delete(waiter);
          resolve({
            idle: false,
            status: 'timed_out',
            timedOut: true,
            taskId: processingTask?.taskId || pendingTask?.taskId || 0,
          });
        }, normalizedTimeoutMs);
      }
      idleWaiters.add(waiter);
    });
  }

  async function restorePendingEffects() {
    assertProfileMutationAdmissionOpen();
    const restoration = await ensureCheckpointRestored();
    assertProfileMutationAdmissionOpen();
    if (restoration.status !== 'pending') return restoration;
    const outcome = await waitForTask(restoration.taskId);
    return {
      ...restoration,
      status: outcome.status,
      outcome,
    };
  }

  async function drainCheckpointOperations() {
    while (true) {
      const observedTail = checkpointSyncTail;
      await observedTail;
      if (observedTail === checkpointSyncTail) return;
    }
  }

  function quiesceForProfileMutation() {
    if (profileMutationPhase === 'quiesced') {
      return Promise.resolve(Object.freeze({ quiesced: true, reused: true }));
    }
    if (profileMutationPhase === 'quiescing') {
      return profileMutationQuiescePromise;
    }
    if (
      profileMutationPhase !== 'open'
      && profileMutationPhase !== 'quiesce_failed'
    ) {
      return Promise.reject(new Error(
        `SETTINGS_PROPAGATION_PROFILE_MUTATION_PHASE_INVALID:${profileMutationPhase}`,
      ));
    }

    // Close synchronously. No schedule/restore call that arrives after this
    // point may publish a new checkpoint or start another propagation stage.
    profileMutationPhase = 'quiescing';
    lifecycleGeneration += 1;
    processingExecution?.controller.abort(new Error('SETTINGS_PROPAGATION_PROFILE_MUTATION_QUIESCING'));
    clearRetryTimer();

    const activeProcessing = processingPromise;
    const activeRestore = checkpointRestorePromise;
    const quiesceRun = (async () => {
      await Promise.all([
        activeProcessing || Promise.resolve(),
        activeRestore || Promise.resolve(),
      ]);
      await drainCheckpointOperations();
      await enqueueCheckpointOperation(
        'profile_mutation_clear',
        () => checkpointRepository.clear(),
      );

      pendingTask = null;
      pendingTaskAdmission = null;
      processingTask = null;
      settlingTask = null;
      processing = false;
      lastOutcome = {
        status: 'profile_mutation_quiesced',
        taskId: 0,
        commitVersion: null,
        changedKeys: [],
        applied: createAppliedSummary(),
        failures: [],
      };
      recoverableFailedTask = null;
      checkpointRestorePromise = null;
      taskOutcomeById.clear();
      Array.from(taskWaiters).forEach((waiter) => {
        taskWaiters.delete(waiter);
        if (waiter.timerId !== null) clearTimeout(waiter.timerId);
        waiter.resolve({
          status: 'profile_mutation_quiesced',
          taskId: waiter.taskId,
        });
      });
      profileMutationPhase = 'quiesced';
      resolveIdleWaiters();
      return Object.freeze({ quiesced: true, reused: false });
    })();
    profileMutationQuiescePromise = quiesceRun;
    void quiesceRun.then(
      () => {
        if (profileMutationQuiescePromise === quiesceRun) {
          profileMutationQuiescePromise = null;
        }
      },
      () => {
        if (profileMutationQuiescePromise === quiesceRun) {
          profileMutationQuiescePromise = null;
          profileMutationPhase = 'quiesce_failed';
        }
      },
    );
    return quiesceRun;
  }

  function hasPendingRuntimeSettingsAdapters(changedKeys) {
    const keys = normalizeChangedKeys(changedKeys);
    return [pendingTask, processingTask, recoverableFailedTask].some(task => task
      && task.shouldRunRuntimeAdapters && task.appliedStages.runtime_adapters !== true
      && task.changedKeys.some(key => keys.includes(key)));
  }

  return {
    hasPendingRuntimeSettingsAdapters,
    reconcileStartupContentScripts,
    restorePendingEffects,
    schedulePostCommitEffects,
    waitForIdle,
    waitForTask,
    quiesceForProfileMutation,
  };
}

export default createBackgroundSettingsPropagationCoordinator;
