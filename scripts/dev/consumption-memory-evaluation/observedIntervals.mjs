import { requireConsumptionSegment } from '../../../src/domains/tracking/background/trackingConsumptionFlowState.js';
import { requireConsumptionEnvironment } from '../../../src/domains/tracking/background/trackingConsumptionEnvironment.js';
import { requireConsumptionMemoryInterval } from '../../../src/domains/behavior/consumption/consumptionMemoryModel.js';

function range(value) {
  if (!Number.isSafeInteger(value.startedAt) || !Number.isSafeInteger(value.endedAt)
    || value.startedAt < 0 || value.endedAt <= value.startedAt) throw new Error('OBSERVED_INTERVAL_RANGE_INVALID');
}

// Offline join, deliberately limited to evidence the current owners can supply.
// Complete exposure coverage is a simulator assertion, not a live capability.
// Neither a silent nor an audible point certifies the time between observations.
export function projectObservedIntervals({ epoch, sequence, startedAt, endedAt,
  collectionEnabled, exposureCoverage, foregroundReceipts, environmentPoints, exposures }) {
  range({ startedAt, endedAt });
  if (typeof collectionEnabled !== 'boolean' || !['complete', 'unknown'].includes(exposureCoverage)
    || ![foregroundReceipts, environmentPoints, exposures].every(Array.isArray)) throw new Error('OBSERVED_INTERVAL_INPUT_INVALID');
  foregroundReceipts.forEach(requireConsumptionSegment);
  environmentPoints.forEach(requireConsumptionEnvironment);
  const sorted = [...foregroundReceipts].sort((a, b) => a.startedAt - b.startedAt);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startedAt < sorted[i - 1].endedAt) throw new Error('OBSERVED_FOREGROUND_OVERLAP');
  }
  for (const exposure of exposures) {
    range(exposure);
    if (typeof exposure.leaseId !== 'string' || !exposure.leaseId) throw new Error('OBSERVED_EXPOSURE_LEASE_REQUIRED');
  }
  const cuts = [...new Set([startedAt, endedAt, ...[...sorted, ...exposures]
    .flatMap((item) => [item.startedAt, item.endedAt])])]
    .filter((at) => at >= startedAt && at <= endedAt).sort((a, b) => a - b);
  const intervals = [], evidence = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i], end = cuts[i + 1];
    const foreground = sorted.find((item) => item.startedAt <= start && item.endedAt >= end);
    const presented = exposures.some((item) => item.startedAt <= start && item.endedAt >= end);
    let kind = 'unknown', reason = 'no_confirmed_foreground';
    if (!collectionEnabled) { kind = 'disabled'; reason = 'collection_disabled'; }
    else if (presented) { kind = 'intervention'; reason = 'actual_exposure_union'; }
    else if (exposureCoverage !== 'complete') reason = 'exposure_coverage_unknown';
    else if (foreground?.isProtected) { kind = 'protected_use'; reason = 'admitted_foreground'; }
    else if (foreground) reason = 'outside_without_media_interval_coverage';
    const interval = requireConsumptionMemoryInterval({ epoch, sequence: sequence + intervals.length,
      startedAt: start, endedAt: end, kind });
    intervals.push(interval);
    evidence.push({ startedAt: start, endedAt: end, kind, reason });
  }
  return { intervals, evidence, pointCount: environmentPoints.length,
    mediaDurationSupport: 'unavailable', outsideDurationSupport: 'unavailable' };
}
