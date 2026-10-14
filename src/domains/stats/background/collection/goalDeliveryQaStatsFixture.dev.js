import { createEmptyDomainStats, requireStatsProtectedActiveFacts } from '../../contracts/statsContracts.js';
import { requireGoalDeliveryQaDelta, goalDeliveryQaError } from '../../contracts/goalDeliveryQaFixtureContract.dev.js';
import { ensureDomainRecord } from '../aggregation/statsAggregateScaffold.js';

// Explicit synthetic facts for a sealed disposable functional QA run. This is
// deliberately separate from elapsed collection: it neither claims an interval
// of consumption nor changes the native collection/active-commit cursor.
export function createGoalDeliveryQaStatsFixtureBatch({ dayData, targetNow, markDirtyDomainAt, markChanged }) {
  return {
    recordGoalDeliveryQaCharge({ hostname, observedDeltaMs, protectedDeltaMs }) {
      requireGoalDeliveryQaDelta({ hostname, observedDeltaMs, protectedDeltaMs });
      if (!Number.isSafeInteger(targetNow) || targetNow <= 0) throw goalDeliveryQaError('COMMIT_TIME_INVALID');
      const { domainData } = ensureDomainRecord(dayData, hostname, { createEmptyDomainStats, now: targetNow });
      requireStatsProtectedActiveFacts(domainData);
      const hour = new Date(targetNow).getHours();
      const before = {
        observedActiveMs: domainData.active,
        protectedActiveMs: domainData.protectedActive,
        globalProtectedActiveMs: Object.values(dayData.domains).reduce((sum, fact) => {
          requireStatsProtectedActiveFacts(fact);
          return sum + fact.protectedActive;
        }, 0),
      };
      if (Object.values(before).some(value => !Number.isFinite(value) || value < 0)
        || before.observedActiveMs + observedDeltaMs > Number.MAX_SAFE_INTEGER
        || before.globalProtectedActiveMs + protectedDeltaMs > Number.MAX_SAFE_INTEGER) {
        throw goalDeliveryQaError('FACTS_INVALID');
      }
      domainData.active += observedDeltaMs;
      domainData.protectedActive += protectedDeltaMs;
      domainData.hourly[hour] += observedDeltaMs;
      domainData.hourlyActive[hour] += observedDeltaMs;
      domainData.hourlyProtectedActive[hour] += protectedDeltaMs;
      dayData.totals.totalActive += observedDeltaMs;
      dayData.totals.blockedActive += protectedDeltaMs;
      dayData.hourlyRollup.active[hour] += observedDeltaMs;
      for (const [category, delta] of [['blocked', protectedDeltaMs], ['other', observedDeltaMs - protectedDeltaMs]]) {
        dayData.byCategory[category].active += delta;
        dayData.hourlyRollup.byCategory[category].active[hour] += delta;
      }
      requireStatsProtectedActiveFacts(domainData);
      markChanged();
      markDirtyDomainAt(hostname, targetNow);
      return Object.freeze({ before: Object.freeze(before), after: Object.freeze({
        observedActiveMs: before.observedActiveMs + observedDeltaMs,
        protectedActiveMs: before.protectedActiveMs + protectedDeltaMs,
        globalProtectedActiveMs: before.globalProtectedActiveMs + protectedDeltaMs,
      }) });
    },
  };
}
