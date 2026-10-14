import { requireConsumptionSegment } from '../../tracking/background/trackingConsumptionFlowState.js';
import { requireConsumptionMediaWindow } from '../../tracking/background/trackingConsumptionMediaWindow.js';
import { requireInterventionExposureSnapshot } from '../../protection/background/runtime/interventionExposureWindow.js';

// Finalize only evidence available at this commit. No reconstruction from stats,
// no point extrapolation and no second foreground/media accumulation path.
export function resolveConsumptionObservedIntervals({ startedAt, endedAt, admittedSince, contexts, media, exposure }) {
  if (!Number.isSafeInteger(startedAt) || startedAt < 0 || !Number.isSafeInteger(endedAt)
    || endedAt < startedAt || !Number.isSafeInteger(admittedSince) || admittedSince < 0
    || !Array.isArray(contexts)) throw new Error('CONSUMPTION_OBSERVATION_BOUNDS_INVALID');
  requireConsumptionMediaWindow(media); requireInterventionExposureSnapshot(exposure);
  let previousEnd = 0;
  for (const item of contexts) {
    requireConsumptionSegment(item);
    if (!item.isProtected || item.startedAt < previousEnd) throw new Error('CONSUMPTION_OBSERVATION_FOREGROUND_INVALID');
    previousEnd = item.endedAt;
  }
  const cuts = new Set([startedAt, endedAt]);
  cuts.add(Math.max(startedAt, Math.min(endedAt, admittedSince)));
  for (const item of [...contexts, ...media.intervals, ...exposure.intervals]) {
    cuts.add(Math.max(startedAt, Math.min(endedAt, item.startedAt)));
    cuts.add(Math.max(startedAt, Math.min(endedAt, item.endedAt)));
  }
  if (exposure.status === 'observed') {
    cuts.add(Math.max(startedAt, Math.min(endedAt, exposure.coverageFrom)));
    cuts.add(Math.max(startedAt, Math.min(endedAt, exposure.evaluatedAt)));
  }
  const boundaries = [...cuts].sort((a, b) => a - b), result = [];
  const covers = (item, from, through) => item.startedAt <= from && item.endedAt >= through;
  for (let i = 1; i < boundaries.length; i++) {
    const from = boundaries[i - 1], through = boundaries[i];
    if (through === from) continue;
    let kind = 'unknown';
    if (from >= admittedSince && exposure.status === 'observed'
      && from >= exposure.coverageFrom && through <= exposure.evaluatedAt) {
      const intervention = exposure.intervals.find((item) => covers(item, from, through));
      if (intervention) kind = intervention.kind === 'presented' ? 'intervention' : 'unknown';
      else if (contexts.some((item) => covers(item, from, through))) kind = 'protected_use';
      else if (media.intervals.some((item) => covers(item, from, through))) kind = 'protected_media';
    }
    const last = result.at(-1);
    if (last?.kind === kind) last.endedAt = through;
    else result.push({ startedAt: from, endedAt: through, kind });
  }
  return result;
}
