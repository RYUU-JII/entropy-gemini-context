import { getLocalDateStr } from '../../../../lib/index.js';
import { TRACKING_OBSERVATION_SUPERSEDED } from '../../../tracking/background/trackingTabActivityObservation.js';

export function createStatsTickRuntimeService({
  TabTimeTracker,
  runStatsMutationBatch,
  runStatsRolloverMutationBatch,
} = {}) {
  if (
    !TabTimeTracker
    || typeof TabTimeTracker.prepareRolloverTabActivityObservation !== 'function'
    || typeof TabTimeTracker.settleRolloverTabActivityObservation !== 'function'
    || typeof TabTimeTracker.primeNewDayAt !== 'function'
    || typeof TabTimeTracker.getActiveTabInfo !== 'function'
    || typeof TabTimeTracker.getDomainSessionCursor !== 'function'
  ) {
      throw new Error('STATS_TICK_RUNTIME_SERVICE_TAB_TIME_TRACKER_REQUIRED');
  }
  if (typeof runStatsMutationBatch !== 'function') {
    throw new Error('STATS_TICK_RUNTIME_SERVICE_MUTATION_BATCH_REQUIRED');
  }
  if (typeof runStatsRolloverMutationBatch !== 'function') {
    throw new Error('STATS_TICK_RUNTIME_SERVICE_ROLLOVER_MUTATION_BATCH_REQUIRED');
  }

  async function settlePreviousDayForRollover({ previousDateStr, boundaryTs } = {}) {
    if (!Number.isFinite(Number(boundaryTs))) {
      throw new Error('STATS_ROLLOVER_BOUNDARY_REQUIRED');
    }
    const boundary = Number(boundaryTs);
    const context = Object.freeze({ previousDateStr, boundaryTs: boundary });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      // Calendar admission stays closed; only browser acquisition leaves the
      // mutation FIFO. Idle refresh would recurse through that calendar barrier.
      const observation = await TabTimeTracker.prepareRolloverTabActivityObservation(context);
      try {
        await runStatsRolloverMutationBatch(
          () => TabTimeTracker.settleRolloverTabActivityObservation(observation, context),
          { now: boundary, dateStr: previousDateStr, finalizeHistoricalDay: true },
        );
        return;
      } catch (error) {
        if (attempt !== 0 || error?.code !== TRACKING_OBSERVATION_SUPERSEDED
          || error.beforeMutation !== true) throw error;
      }
    }
  }

  async function primeLoadedDayForRollover({ nextDateStr, boundaryTs } = {}) {
    if (typeof nextDateStr !== 'string' || !nextDateStr || !Number.isFinite(Number(boundaryTs))) {
      throw new Error('STATS_ROLLOVER_PRIME_CONTEXT_REQUIRED');
    }
    const boundary = Number(boundaryTs);
    await runStatsRolloverMutationBatch(() => TabTimeTracker.primeNewDayAt(boundary, {
      dateStr: nextDateStr,
      skipCacheLoad: true,
    }), { now: boundary, dateStr: nextDateStr });
  }

  function resolveColdStartRecoveryDate({ nextDateStr } = {}) {
    if (typeof nextDateStr !== 'string' || !nextDateStr) {
      throw new Error('STATS_COLD_START_RECOVERY_DATE_REQUIRED');
    }
    const activeTabInfo = TabTimeTracker.getActiveTabInfo();
    const domainSessionCursor = TabTimeTracker.getDomainSessionCursor();
    const startedAt = Number(activeTabInfo?.startedAt);
    const recoveryDates = [];
    if (
      activeTabInfo?.hostname
      && activeTabInfo?.startedAt !== null
      && typeof activeTabInfo?.startedAt !== 'undefined'
      && Number.isFinite(startedAt)
    ) {
      recoveryDates.push(getLocalDateStr(startedAt));
    }
    if (domainSessionCursor?.phase === 'pending_commit') {
      recoveryDates.push(domainSessionCursor.targetDateStr);
    } else if (
      domainSessionCursor?.phase === 'active'
      && Number.isFinite(Number(domainSessionCursor.startedAt))
    ) {
      recoveryDates.push(getLocalDateStr(Number(domainSessionCursor.startedAt)));
    }
    return recoveryDates
      .filter((dateStr) => typeof dateStr === 'string' && dateStr < nextDateStr)
      .sort()[0] || null;
  }

  return {
    primeLoadedDayForRollover,
    resolveColdStartRecoveryDate,
    runStatsMutationBatch: (task, options) => runStatsMutationBatch(task, options),
    settlePreviousDayForRollover,
  };
}
