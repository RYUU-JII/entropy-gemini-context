import { getLocalDateStr } from '../../../../lib/index.js';
import {
  normalizeStatsDay,
} from '../../contracts/statsContracts.js';
import {
  parseLocalDateParts,
  shiftDateStr,
} from '../../shared/dateMath.js';
import {
  PROFILE_RESET_LIFECYCLE_OPERATIONS,
} from '../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import {
  createStatsProfileMutationAdmissionOwner,
  createStatsProfileMutationError,
  STATS_PROFILE_MUTATION_PHASES,
} from '../runtime/statsProfileMutationAdmission.js';
import {
  clearStatsCommitEventState,
  clearStatsRuntimeDiagnostic,
  clearStatsRuntimeDirtyHours,
  ensureStatsRuntimeState,
  getStatsRuntimeDirtyHourScopes,
  getStatsRuntimeDirtyHours,
  getStatsRuntimeRevisionFor,
  invalidateStatsFactsRuntimeRangeCacheFor,
  isStatsRuntimeCacheFresh,
  isStatsRuntimeRevisionFor,
  markStatsRuntimeDirtyWithHours,
  pruneStatsRuntimeDates,
  resetStatsRuntimeStateFor,
  setStatsRuntimeDiagnostic,
  setStatsRuntimeDay,
} from '../runtime/statsRuntimeCache.js';
import { createStatsHourlyProjectionCommitter } from './statsHourlyProjectionCommitter.js';
import { prepareStatsDayForHourlyMaterialization } from './statsBucketMaterializer.js';

function requireStatsRuntimePersistenceOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
}

function requireStatsRuntimePersistenceFunction(ownerFn, errorCode) {
  if (typeof ownerFn !== 'function') {
    throw new Error(errorCode);
  }
  return ownerFn;
}

function createStatsRolloverError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function createStatsPersistenceError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function resolveLocalDateStartTs(dateStr) {
  const parts = parseLocalDateParts(dateStr);
  if (!parts) throw createStatsRolloverError('STATS_ROLLOVER_NEXT_DATE_INVALID');
  const boundaryTs = new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0).getTime();
  if (!Number.isFinite(boundaryTs) || getLocalDateStr(boundaryTs) !== dateStr) {
    throw createStatsRolloverError('STATS_ROLLOVER_BOUNDARY_INVALID');
  }
  return boundaryTs;
}

function resolveStatsRolloverContext({ previousDateStr, nextDateStr, observedAt } = {}) {
  const settlementEndDateStr = shiftDateStr(previousDateStr, 1);
  if (!settlementEndDateStr || nextDateStr < settlementEndDateStr) {
    throw createStatsRolloverError('STATS_ROLLOVER_DATES_OUT_OF_ORDER');
  }
  const skippedUnobservedDates = settlementEndDateStr !== nextDateStr;
  const observedAtTs = Number(observedAt);
  if (
    skippedUnobservedDates
    && (
      !Number.isFinite(observedAtTs)
      || getLocalDateStr(observedAtTs) !== nextDateStr
    )
  ) {
    throw createStatsRolloverError('STATS_ROLLOVER_OBSERVED_AT_INVALID');
  }
  return {
    previousDateStr,
    nextDateStr,
    settlementEndDateStr,
    settlementBoundaryTs: resolveLocalDateStartTs(settlementEndDateStr),
    primeBoundaryTs: skippedUnobservedDates
      ? observedAtTs
      : resolveLocalDateStartTs(nextDateStr),
    skippedUnobservedDates,
  };
}

function requireStatsRolloverLifecycle(lifecycle) {
  if (
    !lifecycle
    || typeof lifecycle.settlePreviousDay !== 'function'
    || typeof lifecycle.primeLoadedDay !== 'function'
    || typeof lifecycle.resolveColdStartRecoveryDate !== 'function'
  ) {
    throw createStatsRolloverError('STATS_ROLLOVER_LIFECYCLE_REQUIRED');
  }
  return Object.freeze({
    settlePreviousDay: lifecycle.settlePreviousDay.bind(lifecycle),
    primeLoadedDay: lifecycle.primeLoadedDay.bind(lifecycle),
    resolveColdStartRecoveryDate: lifecycle.resolveColdStartRecoveryDate.bind(lifecycle),
  });
}

function requireHistoricalRecoveryReadResult(result) {
  if (
    !result
    || typeof result !== 'object'
    || !parseLocalDateParts(result.startDateStr)
    || !parseLocalDateParts(result.endDateStr)
    || !Array.isArray(result.finalizedDateStrs)
    || !Array.isArray(result.pendingDays)
    || result.startDateStr > result.endDateStr
  ) {
    throw createStatsRolloverError('STATS_HISTORICAL_RECOVERY_RESULT_INVALID');
  }
  const finalizedDates = new Set();
  result.finalizedDateStrs.forEach((dateStr) => {
    if (
      !parseLocalDateParts(dateStr)
      || dateStr < result.startDateStr
      || dateStr > result.endDateStr
      || finalizedDates.has(dateStr)
    ) {
      throw createStatsRolloverError('STATS_HISTORICAL_RECOVERY_RESULT_INVALID');
    }
    finalizedDates.add(dateStr);
  });
  const pendingDates = new Set();
  result.pendingDays.forEach((entry) => {
    if (
      !entry
      || !parseLocalDateParts(entry.dateStr)
      || entry.dateStr < result.startDateStr
      || entry.dateStr > result.endDateStr
      || finalizedDates.has(entry.dateStr)
      || pendingDates.has(entry.dateStr)
      || !Array.isArray(entry.hourlyBuckets)
      || entry.hourlyBuckets.length === 0
      || entry.hourlyBuckets.some((bucket) => bucket?.dateStr !== entry.dateStr)
      || !entry.dayData
      || !Number.isInteger(entry.sealedThroughHour)
      || entry.sealedThroughHour < -1
      || entry.sealedThroughHour > 23
      || !Number.isFinite(Number(entry.sourceHourlyRevision))
      || Number(entry.sourceHourlyRevision) < 0
    ) {
      throw createStatsRolloverError('STATS_HISTORICAL_RECOVERY_DAY_INVALID');
    }
    pendingDates.add(entry.dateStr);
  });
  return result;
}

export function createStatsRuntimePersistenceService({
  runtimeState,
  statsRepository,
  statsAggregateRepository,
  emitStatsCommitted,
  emitStatsReset,
  emitStatsRollover,
  shouldEmitStatsCommittedEvent,
  statsRuntimeHealthLedger,
  profileMutationAdmissionOwner = createStatsProfileMutationAdmissionOwner(),
} = {}) {
  if (
    !statsRepository
    || typeof statsRepository.loadRuntimeDaySnapshot !== 'function'
    || typeof statsRepository.readPendingHistoricalDayMaterializations !== 'function'
  ) {
    throw new Error('STATS_RUNTIME_PERSISTENCE_REPOSITORY_REQUIRED');
  }
  if (
    !statsAggregateRepository
    || typeof statsAggregateRepository.upsertHourlyFactBuckets !== 'function'
    || typeof statsAggregateRepository.finalizeHistoricalDayFacts !== 'function'
    || typeof statsAggregateRepository.finalizeRecoveredHistoricalDayFacts !== 'function'
  ) {
    throw new Error('STATS_RUNTIME_PERSISTENCE_AGGREGATE_REPOSITORY_REQUIRED');
  }
  requireStatsRuntimePersistenceOwnerMethod(
    statsRuntimeHealthLedger,
    'recordSaveStarted',
    'STATS_RUNTIME_PERSISTENCE_HEALTH_LEDGER_REQUIRED',
  );
  requireStatsRuntimePersistenceOwnerMethod(
    statsRuntimeHealthLedger,
    'recordSaveCompleted',
    'STATS_RUNTIME_PERSISTENCE_HEALTH_LEDGER_REQUIRED',
  );
  requireStatsRuntimePersistenceOwnerMethod(
    statsRuntimeHealthLedger,
    'recordSaveFailed',
    'STATS_RUNTIME_PERSISTENCE_HEALTH_LEDGER_REQUIRED',
  );
  [
    'assertOpen',
    'assertQuiesced',
    'beginQuiesce',
    'completeQuiesce',
    'failQuiesce',
    'getPhase',
  ].forEach((methodName) => {
    requireStatsRuntimePersistenceOwnerMethod(
      profileMutationAdmissionOwner,
      methodName,
      'STATS_PROFILE_MUTATION_ADMISSION_OWNER_REQUIRED',
    );
  });

  const runtime = ensureStatsRuntimeState(runtimeState);
  const aggregateStore = statsAggregateRepository;
  const hourlyProjectionCommitter = createStatsHourlyProjectionCommitter({
    statsAggregateRepository: aggregateStore,
  });
  const emitCommitted = requireStatsRuntimePersistenceFunction(
    emitStatsCommitted,
    'STATS_RUNTIME_PERSISTENCE_COMMITTED_EVENT_OWNER_REQUIRED',
  );
  const emitReset = requireStatsRuntimePersistenceFunction(
    emitStatsReset,
    'STATS_RUNTIME_PERSISTENCE_RESET_EVENT_OWNER_REQUIRED',
  );
  const emitRollover = requireStatsRuntimePersistenceFunction(
    emitStatsRollover,
    'STATS_RUNTIME_PERSISTENCE_ROLLOVER_EVENT_OWNER_REQUIRED',
  );
  const shouldEmitCommitted = requireStatsRuntimePersistenceFunction(
    shouldEmitStatsCommittedEvent,
    'STATS_RUNTIME_PERSISTENCE_COMMIT_EVENT_POLICY_REQUIRED',
  );
  let mutationBatchDepth = 0;
  let activeMutationDateStr = null;
  let mutationBatchTail = Promise.resolve();
  let mutationAdmissionTail = Promise.resolve();
  let saveDrainTail = Promise.resolve();
  let resetTail = Promise.resolve();
  let activeResetBarrier = null;
  let profileMutationQuiescePromise = null;
  let terminalProfileMutationResetTail = Promise.resolve();

  function assertProfileMutationAdmissionOpen() {
    profileMutationAdmissionOwner.assertOpen();
  }

  function getRuntimeRevision() {
    return getStatsRuntimeRevisionFor(runtime);
  }

  function setRolloverLifecycle(lifecycle) {
    assertProfileMutationAdmissionOpen();
    runtime.rolloverLifecycle = requireStatsRolloverLifecycle(lifecycle);
  }

  function getStatsCache() {
    assertProfileMutationAdmissionOpen();
    return runtime.statsCache;
  }

  function getStatsDateStr() {
    assertProfileMutationAdmissionOpen();
    return runtime.statsDateStr;
  }

  function getStatsDateData(dateStr) {
    assertProfileMutationAdmissionOpen();
    return runtime.statsCache?.dates?.[dateStr];
  }

  function markStatsDirty(options = {}) {
    assertProfileMutationAdmissionOpen();
    if (activeResetBarrier) {
      throw createStatsRolloverError('STATS_RESET_IN_PROGRESS');
    }
    return markStatsRuntimeDirtyWithHours(runtime, options);
  }

  async function recordRuntimeHealth(task, label) {
    if (typeof task !== 'function') return;
    // Admitted saves publish their final diagnostic before the service closes
    // health admission. Quiescing the producer must not discard completion.
    try {
      await task();
    } catch (error) {
      console.warn(`[StatsRuntimePersistenceService] Failed to record ${label}:`, error);
    }
  }

  function resetStatsStateOwned({
    includeFactsRange = true,
    emit = true,
    changedDates = null,
  } = {}) {
    const previousDateStr = runtime.statsDateStr;
    clearStatsCommitEventState(runtime);
    const revision = resetStatsRuntimeStateFor(runtime, {
      includeFactsRange,
      clearInflight: true,
    });
    if (emit) {
      emitReset({
        changedDates: Array.isArray(changedDates)
          ? changedDates
          : (previousDateStr ? [previousDateStr] : []),
        reason: 'reset_state',
        revision,
      });
    }
    return revision;
  }

  function resetStatsState(options = {}) {
    assertProfileMutationAdmissionOpen();
    return resetStatsStateOwned(options);
  }

  async function waitForActiveReset() {
    // Yield once so a reset requested in the same turn can publish its barrier
    // before this operation registers any storage work.
    await Promise.resolve();
    while (activeResetBarrier) {
      const barrier = activeResetBarrier;
      await barrier.promise;
    }
  }

  async function loadStatsDay(dateStr, { revision = getRuntimeRevision() } = {}) {
    const normalized = typeof dateStr === 'string' && dateStr ? dateStr : getLocalDateStr();
    const prevDateStr = runtime.statsDateStr;

    let day = null;
    let sealedThroughHour = -1;

    try {
      const snapshot = await statsRepository.loadRuntimeDaySnapshot(normalized);
      if (
        !snapshot
        || typeof snapshot !== 'object'
        || !snapshot.dayData
        || !Number.isInteger(snapshot.sealedThroughHour)
        || snapshot.sealedThroughHour < -1
        || snapshot.sealedThroughHour > 23
      ) {
        throw new Error('STATS_RUNTIME_DAY_SNAPSHOT_INVALID');
      }
      day = prepareStatsDayForHourlyMaterialization(snapshot.dayData, {
        now: Date.now(),
      });
      sealedThroughHour = snapshot.sealedThroughHour;
    } catch (error) {
      console.error('[StatsRuntimePersistenceService] Failed to load stats day:', error);
      if (isStatsRuntimeRevisionFor(runtime, revision)) {
        setStatsRuntimeDiagnostic(runtime, 'load', error, {
          code: 'STATS_LOAD_FAILED',
          operation: 'loadStatsDay',
        });
        if (!runtime.statsCache?.dates?.[runtime.statsDateStr]) {
          runtime.cacheLoaded = false;
        }
      }
      throw error;
    }

    if (!isStatsRuntimeRevisionFor(runtime, revision)) return;
    setStatsRuntimeDay(runtime, {
      dateStr: normalized,
      dayData: day,
      sealedThroughHour,
      cacheLoaded: true,
      statsDirty: false,
    });
    clearStatsRuntimeDiagnostic(runtime, 'load');
    clearStatsRuntimeDirtyHours(runtime, normalized);
    pruneStatsRuntimeDates(runtime, normalized);
    if (prevDateStr && prevDateStr !== normalized) {
      invalidateStatsFactsRuntimeRangeCacheFor(runtime);
    }
  }

  async function recoverHistoricalDaysBeforeInitialLoad({
    requestedDateStr,
    observedAt,
    revision,
  }) {
    const lifecycle = requireStatsRolloverLifecycle(runtime.rolloverLifecycle);
    const checkpointDateStr = lifecycle.resolveColdStartRecoveryDate({
      nextDateStr: requestedDateStr,
      observedAt,
    });
    if (
      checkpointDateStr !== null
      && (
        typeof checkpointDateStr !== 'string'
        || !parseLocalDateParts(checkpointDateStr)
        || checkpointDateStr >= requestedDateStr
      )
    ) {
      throw createStatsRolloverError('STATS_COLD_START_RECOVERY_DATE_INVALID');
    }

    const recoveryRead = requireHistoricalRecoveryReadResult(
      await statsRepository.readPendingHistoricalDayMaterializations({
        beforeDateStr: requestedDateStr,
      }),
    );
    if (!isStatsRuntimeRevisionFor(runtime, revision)) return false;

    const finalizedDateStrs = new Set(recoveryRead.finalizedDateStrs);
    const checkpointInRecoveryRange = checkpointDateStr !== null
      && checkpointDateStr >= recoveryRead.startDateStr
      && checkpointDateStr <= recoveryRead.endDateStr;
    const shouldSettleCheckpointDay = checkpointInRecoveryRange
      && !finalizedDateStrs.has(checkpointDateStr);
    const checkpointDay = shouldSettleCheckpointDay
      ? recoveryRead.pendingDays.find((entry) => entry.dateStr === checkpointDateStr) || null
      : null;
    const directlyMaterializedDates = [];

    for (const pendingDay of recoveryRead.pendingDays) {
      if (shouldSettleCheckpointDay && pendingDay.dateStr === checkpointDateStr) continue;
      await hourlyProjectionCommitter.commitRecoveredHistoricalDayProjection({
        dateStr: pendingDay.dateStr,
        dayData: pendingDay.dayData,
        hourlyBuckets: pendingDay.hourlyBuckets,
        now: observedAt,
        sourceHourlyRevision: pendingDay.sourceHourlyRevision,
      });
      directlyMaterializedDates.push(pendingDay.dateStr);
    }

    if (!isStatsRuntimeRevisionFor(runtime, revision)) return false;
    if (directlyMaterializedDates.length > 0) {
      invalidateStatsFactsRuntimeRangeCacheFor(runtime);
    }
    if (!shouldSettleCheckpointDay) return false;

    setStatsRuntimeDay(runtime, {
      dateStr: checkpointDateStr,
      dayData: prepareStatsDayForHourlyMaterialization(
        checkpointDay?.dayData || normalizeStatsDay(null),
        { now: observedAt },
      ),
      sealedThroughHour: checkpointDay?.sealedThroughHour ?? -1,
      cacheLoaded: true,
      statsDirty: false,
    });
    clearStatsRuntimeDiagnostic(runtime, 'load');
    clearStatsRuntimeDirtyHours(runtime, checkpointDateStr);
    pruneStatsRuntimeDates(runtime, checkpointDateStr);
    return true;
  }

  async function loadInitialStatsState(requestedDateStr, observedAt, revision) {
    try {
      const installedRecoveryDay = await recoverHistoricalDaysBeforeInitialLoad({
        requestedDateStr,
        observedAt,
        revision,
      });
      if (installedRecoveryDay || !isStatsRuntimeRevisionFor(runtime, revision)) return;
      await loadStatsDay(requestedDateStr, { revision: getRuntimeRevision() });
    } catch (error) {
      if (
        isStatsRuntimeRevisionFor(runtime, revision)
        && !runtime.statsDiagnostics?.load
      ) {
        setStatsRuntimeDiagnostic(runtime, 'load', error, {
          code: error?.code || 'STATS_HISTORICAL_RECOVERY_FAILED',
          operation: 'loadStatsCache.initialRecovery',
        });
      }
      throw error;
    }
  }

  async function completePendingRolloverPrime(pending) {
    const lifecycle = requireStatsRolloverLifecycle(runtime.rolloverLifecycle);
    if (
      !pending
      || !isStatsRuntimeRevisionFor(runtime, pending.revision)
      || runtime.statsRolloverPendingPrime !== pending
      || runtime.statsDateStr !== pending.nextDateStr
    ) {
      throw createStatsRolloverError('STATS_ROLLOVER_PRIME_STATE_INVALID');
    }

    await lifecycle.primeLoadedDay({
      ...pending,
      boundaryTs: pending.primeBoundaryTs,
    });
    if (
      runtime.statsRolloverPendingPrime !== pending
      || runtime.statsDateStr !== pending.nextDateStr
    ) {
      throw createStatsRolloverError('STATS_ROLLOVER_PRIME_STATE_CHANGED');
    }

    runtime.statsRolloverPendingPrime = null;
    clearStatsRuntimeDiagnostic(runtime, 'rollover');
    emitRollover({
      changedDates: [pending.previousDateStr, pending.nextDateStr],
      reason: 'day_rollover',
      revision: getRuntimeRevision(),
      meta: {
        fromDateStr: pending.previousDateStr,
        toDateStr: pending.nextDateStr,
        settlementEndDateStr: pending.settlementEndDateStr,
        skippedUnobservedDates: pending.skippedUnobservedDates,
      },
    });
  }

  function assignRolloverPromise(task) {
    let rolloverPromise = null;
    rolloverPromise = Promise.resolve()
      .then(task)
      .catch((error) => {
        if (runtime.statsRolloverPromise === rolloverPromise) {
          setStatsRuntimeDiagnostic(runtime, 'rollover', error, {
            code: error?.code || 'STATS_ROLLOVER_FAILED',
            operation: 'loadStatsCache.rollover',
          });
        }
        throw error;
      })
      .finally(() => {
        if (runtime.statsRolloverPromise === rolloverPromise) {
          runtime.statsRolloverPromise = null;
        }
      });
    runtime.statsRolloverPromise = rolloverPromise;
    return rolloverPromise;
  }

  function assignLoadPromise(dateStr, observedAt, revision) {
    let loadPromise = null;
    loadPromise = loadInitialStatsState(dateStr, observedAt, revision).finally(() => {
      if (runtime.statsLoadPromise === loadPromise) {
        runtime.statsLoadPromise = null;
      }
    });
    runtime.statsLoadPromise = loadPromise;
    return loadPromise;
  }

  async function loadStatsCache(now = Date.now()) {
    assertProfileMutationAdmissionOpen();
    await waitForActiveReset();
    const observedAt = Number(now);
    const requestedDateStr = Number.isFinite(observedAt) ? getLocalDateStr(observedAt) : '';
    if (!requestedDateStr) {
      throw createStatsRolloverError('STATS_LOAD_TIMESTAMP_INVALID');
    }

    // An admitted batch has one calendar date. A rollover requested by another
    // caller may be queued behind it; waiting for that rollover from the batch
    // would make the two owners wait for each other. The collector uses the
    // batch's admitted timestamp; external requests for a later date continue
    // to the normal rollover owner, which queues behind the active batch.
    if (mutationBatchDepth > 0 && requestedDateStr === activeMutationDateStr) {
      if (runtime.statsDateStr !== activeMutationDateStr || !runtime.cacheLoaded) {
        throw createStatsRolloverError('STATS_MUTATION_BATCH_DATE_NOT_ADMITTED');
      }
      return;
    }

    while (true) {
      if (runtime.statsRolloverPromise) {
        await runtime.statsRolloverPromise;
        continue;
      }

      if (runtime.statsRolloverPendingPrime) {
        const pending = runtime.statsRolloverPendingPrime;
        assignRolloverPromise(() => completePendingRolloverPrime(pending));
        await runtime.statsRolloverPromise;
        continue;
      }

      if (isStatsRuntimeCacheFresh(runtime, requestedDateStr)) return;

      if (!runtime.cacheLoaded || !runtime.statsDateStr) {
        if (!runtime.statsLoadPromise) {
          assignLoadPromise(requestedDateStr, observedAt, getRuntimeRevision());
        }
        await runtime.statsLoadPromise;
        continue;
      }

      if (runtime.statsDateStr === requestedDateStr) return;

      if (runtime.statsDateStr > requestedDateStr) {
        throw createStatsRolloverError('STATS_LOAD_TARGET_BEFORE_RUNTIME_DATE');
      }

      if (!runtime.statsRolloverPromise) {
        const prevDateStr = runtime.statsDateStr;
        const rolloverRevision = getRuntimeRevision();
        assignRolloverPromise(async () => {
          if (!isStatsRuntimeRevisionFor(runtime, rolloverRevision)) {
            throw createStatsRolloverError('STATS_ROLLOVER_INVALIDATED');
          }
          const lifecycle = requireStatsRolloverLifecycle(runtime.rolloverLifecycle);
          const rolloverContext = resolveStatsRolloverContext({
            previousDateStr: prevDateStr,
            nextDateStr: requestedDateStr,
            observedAt,
          });
          await lifecycle.settlePreviousDay({
            ...rolloverContext,
            boundaryTs: rolloverContext.settlementBoundaryTs,
          });
          // A successful historical-day finalize legitimately bumps the facts
          // revision. Capture the post-finalize revision for the new-day load
          // instead of treating that commit as a cancelled rollover.
          if (runtime.statsDateStr !== prevDateStr) {
            throw createStatsRolloverError('STATS_ROLLOVER_PREVIOUS_DAY_CHANGED');
          }
          const newDayLoadRevision = getRuntimeRevision();
          await loadStatsDay(requestedDateStr, { revision: newDayLoadRevision });
          if (runtime.statsDateStr !== requestedDateStr) {
            throw createStatsRolloverError('STATS_ROLLOVER_NEW_DAY_LOAD_INVALIDATED');
          }
          const pending = {
            ...rolloverContext,
            revision: getRuntimeRevision(),
          };
          runtime.statsRolloverPendingPrime = pending;
          await completePendingRolloverPrime(pending);
        });
      }

      await runtime.statsRolloverPromise;
    }
  }

  async function persistCurrentDayBuckets(dateStr, dayData, now, dirtyRevision, {
    closeUnfinalizedDay = false,
  } = {}) {
    const dirtyHours = getStatsRuntimeDirtyHours(runtime, dateStr);
    const commitProjection = closeUnfinalizedDay
      ? hourlyProjectionCommitter.commitUnfinalizedDayProjection
      : hourlyProjectionCommitter.commitCurrentDayProjection;
    const result = await commitProjection({
      dateStr,
      dayData,
      dirtyHours,
      dirtyHourScopes: getStatsRuntimeDirtyHourScopes(runtime, dateStr),
      sealedThroughHour: runtime.statsSealedThroughHour,
      now,
    });
    runtime.statsSealedThroughHour = result.sealedThroughHour;
    if (runtime.statsDirtyRevision === dirtyRevision) {
      clearStatsRuntimeDirtyHours(runtime, dateStr, result.committedHours);
    }
    return result;
  }

  async function finalizeHistoricalDayOwned(dateStr, dayData, now, sourceHourlyRevision) {
    const result = await hourlyProjectionCommitter.commitHistoricalDayProjection({
      dateStr,
      dayData,
      now,
      sourceHourlyRevision,
    });

    runtime.statsSealedThroughHour = 23;
    clearStatsRuntimeDirtyHours(runtime, dateStr);
    return result;
  }

  async function saveStatsCacheOwned({
    force = false,
    emitCommittedEvent = true,
    finalizeHistoricalDay = true,
  } = {}) {
    let drainForce = !!force;
    while (true) {
      if (!runtime.statsDirty && !drainForce) return;
      if (!runtime.statsDateStr) return;

      if (!runtime.statsDirty && drainForce) {
        const preflightNow = Date.now();
        const isCurrentRuntimeDay = runtime.statsDateStr === getLocalDateStr(preflightNow);
        const maxClosedHour = Math.max(-1, new Date(preflightNow).getHours() - 1);
        if (isCurrentRuntimeDay && runtime.statsSealedThroughHour >= maxClosedHour) {
          // A clean force is a durability barrier, not a heartbeat. When every
          // closed hour is already accounted for there is no row to seal and no
          // dirty open checkpoint to rewrite, so avoid even entering the health
          // and projection write lanes.
          return;
        }
      }

      const targetDirtyRevision = runtime.statsDirtyRevision;
      const targetDateStr = runtime.statsDateStr;
      let revision = getRuntimeRevision();
      let saveCompleted = false;
      let factsWritten = false;
      const saveForce = drainForce;
      drainForce = false;
      await recordRuntimeHealth(
        () => statsRuntimeHealthLedger.recordSaveStarted({ force: saveForce }),
        'save_started_health',
      );

      runtime.statsSaveInFlight = (async () => {
        const day = runtime.statsCache?.dates?.[targetDateStr];
        if (!day) {
          const error = new Error('STATS_SAVE_DAY_MISSING');
          error.code = 'STATS_SAVE_DAY_MISSING';
          throw error;
        }
        const now = Date.now();
        const todayDateStr = getLocalDateStr(now);
        let projectionResult;
        if (targetDateStr === todayDateStr || !finalizeHistoricalDay) {
          projectionResult = await persistCurrentDayBuckets(
            targetDateStr,
            day,
            now,
            targetDirtyRevision,
            { closeUnfinalizedDay: targetDateStr !== todayDateStr },
          );
        } else {
          projectionResult = await finalizeHistoricalDayOwned(
            targetDateStr,
            day,
            now,
            targetDirtyRevision,
          );
        }
        if (projectionResult?.didWriteFacts !== true && projectionResult?.didWriteFacts !== false) {
          throw createStatsPersistenceError('STATS_SAVE_PROJECTION_WRITE_DISPOSITION_REQUIRED');
        }
        factsWritten = projectionResult.didWriteFacts;
        saveCompleted = true;
        clearStatsRuntimeDiagnostic(runtime, 'save');
        if (
          isStatsRuntimeRevisionFor(runtime, revision) &&
          runtime.statsDateStr === targetDateStr &&
          runtime.statsDirtyRevision === targetDirtyRevision
        ) {
          runtime.statsDirty = false;
        }
      })();

      try {
        await runtime.statsSaveInFlight;
      } catch (error) {
        await recordRuntimeHealth(
          () => statsRuntimeHealthLedger.recordSaveFailed({ force: saveForce, error }),
          'save_failed_health',
        );
        console.error('[StatsRuntimePersistenceService] Failed to save stats:', error);
        if (isStatsRuntimeRevisionFor(runtime, revision)) {
          setStatsRuntimeDiagnostic(runtime, 'save', error, {
            code: error?.code || 'STATS_SAVE_FAILED',
            operation: 'saveStatsCache',
          });
        }
        throw error;
      } finally {
        if (isStatsRuntimeRevisionFor(runtime, revision)) {
          runtime.statsSaveInFlight = null;
        }
      }

      if (saveCompleted && isStatsRuntimeRevisionFor(runtime, revision)) {
        await recordRuntimeHealth(
          () => statsRuntimeHealthLedger.recordSaveCompleted({ force: saveForce }),
          'save_completed_health',
        );
      }

      if (factsWritten && isStatsRuntimeRevisionFor(runtime, revision)) {
        revision = invalidateStatsFactsRuntimeRangeCacheFor(runtime, { bumpRevision: true });
        const now = Date.now();
        const shouldEmit = emitCommittedEvent && shouldEmitCommitted({
          dateStr: targetDateStr,
          force: saveForce,
          now,
          lastDateStr: runtime.commitEventState.dateStr,
          lastEmittedAt: runtime.commitEventState.emittedAt,
        });

        if (shouldEmit) {
          emitCommitted({
            changedDates: [targetDateStr],
            reason: saveForce ? 'save_force' : 'save',
            revision: getRuntimeRevision(),
            meta: {
              force: saveForce,
              dirtyRevision: targetDirtyRevision,
            },
          });
          runtime.commitEventState.dateStr = targetDateStr;
          runtime.commitEventState.emittedAt = now;
        }
      }

      if (runtime.statsDirty && isStatsRuntimeRevisionFor(runtime, revision)) {
        continue;
      }
      return;
    }
  }

  function enqueueStatsSave(options = {}) {
    const operation = saveDrainTail.then(
      () => saveStatsCacheOwned(options),
      () => saveStatsCacheOwned(options),
    );
    saveDrainTail = operation.catch(() => undefined);
    return operation;
  }

  function saveStatsCache(options = {}) {
    assertProfileMutationAdmissionOpen();
    const barrier = activeResetBarrier;
    return barrier
      ? barrier.promise.then(() => saveStatsCache(options))
      : enqueueStatsSave(options);
  }

  async function commitStatsMutation({ dateStr = null, requireDurableCommit = false } = {}) {
    assertProfileMutationAdmissionOpen();
    await waitForActiveReset();
    if (dateStr && dateStr !== runtime.statsDateStr) {
      throw createStatsPersistenceError('STATS_MUTATION_COMMIT_DATE_CHANGED');
    }
    if (mutationBatchDepth > 0 && !requireDurableCommit) return;
    // Recovery checkpoints and content acknowledgements require an actual
    // durable barrier even inside a coalesced mutation batch. Until rollover
    // settlement has finished, only hourly facts may be installed.
    await saveStatsCache({ force: false, finalizeHistoricalDay: false });
  }

  async function executeStatsMutationBatch(task, {
    force = false,
    now,
    dateStr,
    finalizeHistoricalDay = false,
  }) {
    mutationBatchDepth = 1;
    activeMutationDateStr = dateStr;
    let result;
    let taskError = null;
    try {
      result = await task(Object.freeze({ now, dateStr }));
    } catch (error) {
      taskError = error;
    }

    mutationBatchDepth = 0;
    activeMutationDateStr = null;
    let saveError = null;
    if (runtime.statsDirty || force === true) {
      try {
        await enqueueStatsSave({
          force: force === true,
          finalizeHistoricalDay: finalizeHistoricalDay && !taskError,
        });
      } catch (error) {
        saveError = error;
      }
    }

    if (taskError && saveError) {
      const error = new AggregateError(
        [taskError, saveError],
        'Stats mutation batch and its durable commit both failed.',
      );
      error.code = 'STATS_MUTATION_BATCH_AND_SAVE_FAILED';
      throw error;
    }
    if (taskError) throw taskError;
    if (saveError) throw saveError;
    return result;
  }

  function enqueueStatsMutationBatch(task) {
    const operation = mutationBatchTail.then(task, task);
    mutationBatchTail = operation.catch(() => undefined);
    return operation;
  }

  const retryMutationAdmission = Symbol('retryStatsMutationAdmission');

  async function admitStatsMutationBatch(task, options) {
    while (true) {
      await waitForActiveReset();
      await mutationBatchTail;
      const observedAt = Date.now();
      await loadStatsCache(observedAt);
      const dateStr = getLocalDateStr(observedAt);
      const result = await enqueueStatsMutationBatch(() => {
        const now = Date.now();
        if (
          runtime.statsDateStr !== dateStr
          || getLocalDateStr(now) !== dateStr
          || runtime.statsRolloverPendingPrime
        ) return retryMutationAdmission;
        return executeStatsMutationBatch(task, { ...options, now, dateStr });
      });
      if (result !== retryMutationAdmission) return result;
    }
  }

  function runStatsMutationBatch(task, options = {}) {
    assertProfileMutationAdmissionOpen();
    if (typeof task !== 'function') {
      return Promise.reject(new Error('STATS_MUTATION_BATCH_TASK_REQUIRED'));
    }
    const operation = admitStatsMutationBatch(task, options);
    mutationAdmissionTail = Promise.allSettled([mutationAdmissionTail, operation]).then(() => undefined);
    return operation;
  }

  function runStatsRolloverMutationBatch(task, { now, dateStr, finalizeHistoricalDay = false } = {}) {
    assertProfileMutationAdmissionOpen();
    if (typeof task !== 'function') {
      return Promise.reject(new Error('STATS_MUTATION_BATCH_TASK_REQUIRED'));
    }
    if (
      !runtime.statsRolloverPromise
      || !Number.isSafeInteger(now)
      || !parseLocalDateParts(dateStr)
    ) {
      throw createStatsRolloverError('STATS_ROLLOVER_MUTATION_ADMISSION_REQUIRED');
    }
    return enqueueStatsMutationBatch(() => {
      if (runtime.statsDateStr !== dateStr || !runtime.statsRolloverPromise) {
        throw createStatsRolloverError('STATS_ROLLOVER_MUTATION_DATE_CHANGED');
      }
      return executeStatsMutationBatch(task, {
        force: finalizeHistoricalDay,
        now,
        dateStr,
        finalizeHistoricalDay,
      });
    });
  }

  async function executeStatsReset(task, barrier, { includeFactsRange = true } = {}) {
    const pendingLoad = runtime.statsLoadPromise;
    const resetChangedDates = runtime.statsDateStr ? [runtime.statsDateStr] : [];
    resetStatsStateOwned({ includeFactsRange, emit: false });

    let result;
    let resetError = null;
    try {
      if (pendingLoad) await Promise.allSettled([pendingLoad]);
      await mutationBatchTail;
      await saveDrainTail;
      result = await task();
    } catch (error) {
      resetError = error;
    } finally {
      resetStatsStateOwned({
        includeFactsRange,
        emit: profileMutationAdmissionOwner.getPhase() === STATS_PROFILE_MUTATION_PHASES.OPEN,
        changedDates: resetChangedDates,
      });
      if (activeResetBarrier === barrier) activeResetBarrier = null;
      barrier.release();
    }

    if (resetError) throw resetError;
    return result;
  }

  function runStatsReset(task, options = {}) {
    assertProfileMutationAdmissionOpen();
    if (typeof task !== 'function') {
      return Promise.reject(createStatsRolloverError('STATS_RESET_TASK_REQUIRED'));
    }
    let releaseBarrier = null;
    const barrier = {
      promise: new Promise((resolve) => {
        releaseBarrier = resolve;
      }),
      release: () => releaseBarrier(),
    };
    activeResetBarrier = barrier;
    const operation = resetTail.then(
      () => executeStatsReset(task, barrier, options),
      () => executeStatsReset(task, barrier, options),
    );
    resetTail = operation.catch(() => undefined);
    return operation;
  }

  function captureProfileMutationDrainState() {
    return Object.freeze({
      activeResetBarrier: activeResetBarrier?.promise || null,
      factsRangeRead: runtime.statsFactsRangeCachePromise || null,
      load: runtime.statsLoadPromise || null,
      mutationBatchTail,
      mutationAdmissionTail,
      resetTail,
      rollover: runtime.statsRolloverPromise || null,
      save: runtime.statsSaveInFlight || null,
      saveDrainTail,
    });
  }

  function isSameProfileMutationDrainState(left, right) {
    return Object.keys(left).every((key) => left[key] === right[key]);
  }

  async function drainProfileMutationRuntimeWork() {
    while (true) {
      const observed = captureProfileMutationDrainState();
      const pending = Array.from(new Set(
        Object.values(observed).filter((value) => value && typeof value.then === 'function'),
      ));
      await Promise.allSettled(pending);
      const current = captureProfileMutationDrainState();
      if (isSameProfileMutationDrainState(observed, current)) return;
    }
  }

  async function executeProfileMutationQuiesce(operation) {
    await drainProfileMutationRuntimeWork();
    if (operation === PROFILE_RESET_LIFECYCLE_OPERATIONS.SNAPSHOT_IMPORT) {
      await enqueueStatsSave({
        force: true,
        emitCommittedEvent: false,
      });
      await drainProfileMutationRuntimeWork();
    }
    if (mutationBatchDepth !== 0) {
      throw createStatsProfileMutationError('STATS_PROFILE_MUTATION_BATCH_DRAIN_INCOMPLETE');
    }
    profileMutationAdmissionOwner.completeQuiesce();
    return Object.freeze({ quiesced: true, reused: false });
  }

  function quiesceForProfileMutation({ operation } = {}) {
    const disposition = profileMutationAdmissionOwner.beginQuiesce(operation);
    if (disposition === 'in_progress') return profileMutationQuiescePromise;
    if (disposition === 'complete') {
      return Promise.resolve(Object.freeze({ quiesced: true, reused: true }));
    }

    const quiesceRun = executeProfileMutationQuiesce(operation).catch((cause) => {
      profileMutationAdmissionOwner.failQuiesce();
      const error = createStatsProfileMutationError(
        'STATS_PROFILE_MUTATION_QUIESCE_FAILED',
        profileMutationAdmissionOwner.getPhase(),
      );
      error.cause = cause;
      throw error;
    });
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
        }
      },
    );
    return quiesceRun;
  }

  async function executeTerminalProfileMutationReset(task, {
    includeFactsRange = true,
  } = {}) {
    profileMutationAdmissionOwner.assertQuiesced();
    resetStatsStateOwned({ includeFactsRange, emit: false });
    try {
      return await task();
    } finally {
      resetStatsStateOwned({ includeFactsRange, emit: false });
    }
  }

  function runTerminalProfileMutationReset(task, options = {}) {
    try {
      profileMutationAdmissionOwner.assertQuiesced();
    } catch (error) {
      return Promise.reject(error);
    }
    if (typeof task !== 'function') {
      return Promise.reject(createStatsProfileMutationError(
        'STATS_TERMINAL_PROFILE_MUTATION_RESET_TASK_REQUIRED',
      ));
    }
    const operation = terminalProfileMutationResetTail.then(
      () => executeTerminalProfileMutationReset(task, options),
      () => executeTerminalProfileMutationReset(task, options),
    );
    terminalProfileMutationResetTail = operation.catch(() => undefined);
    return operation;
  }

  return {
    commitStatsMutation,
    getStatsCache,
    getStatsDateData,
    getStatsDateStr,
    loadStatsCache,
    markStatsDirty,
    quiesceForProfileMutation,
    resetStatsState,
    runStatsMutationBatch,
    runStatsRolloverMutationBatch,
    runStatsReset,
    runTerminalProfileMutationReset,
    saveStatsCache,
    setRolloverLifecycle,
  };
}
