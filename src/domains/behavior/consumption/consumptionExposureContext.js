import { requireConsumptionSegment } from '../../tracking/background/trackingConsumptionFlowState.js';
import { requireInterventionExposureSnapshot } from '../../protection/background/runtime/interventionExposureWindow.js';

// A query projection of the latest ACKed foreground receipt, never a replacement
// of historical Tracking totals or an incremental model commit.
export function projectConsumptionExposureContext(segment, exposure) {
  requireInterventionExposureSnapshot(exposure);
  if (segment === null) return { status: 'no_foreground_receipt', latestForeground: null };
  requireConsumptionSegment(segment);
  const from = segment.startedAt, through = segment.endedAt;
  const knownFrom = exposure.status === 'observed' ? Math.max(from, exposure.coverageFrom) : through;
  const knownThrough = exposure.status === 'observed' ? Math.min(through, exposure.evaluatedAt) : through;
  const coveredMs = Math.max(0, knownThrough - knownFrom);
  let uncertainMs = through - from - coveredMs, presentedMs = 0;
  for (const interval of exposure.intervals) {
    const elapsed = Math.max(0, Math.min(knownThrough, interval.endedAt) - Math.max(knownFrom, interval.startedAt));
    if (interval.kind === 'presented') presentedMs += elapsed;
    else uncertainMs += elapsed;
  }
  const unoccupiedForegroundMs = through - from - uncertainMs - presentedMs;
  return { status: uncertainMs > 0 ? 'partial' : 'covered', latestForeground: {
    startedAt: from, endedAt: through, isProtected: segment.isProtected,
    unoccupiedForegroundMs, presentedMs, uncertainMs,
  } };
}
