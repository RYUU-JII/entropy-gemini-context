import { clipActiveUsageIntervals, mergeActiveUsageIntervals } from '../../contracts/activeUsageIntervals.js';

// Presentation-only projection of the same committed facts that trigger the cap.
// Last confirmed coverage includes an ongoing session; the unsealed suffix is
// not extrapolated from wall time. Gaps mean no recorded site use, not rest.
export function projectSiteFurinReflection({ statsRange, hostname, startAt, observedAt, activeMs }) {
  const intervals = [];
  for (const day of Object.values(statsRange.dates)) {
    const domain = day.domains[hostname];
    if (domain && Object.hasOwn(domain,'activeUsageIntervals')) {
      intervals.push(...clipActiveUsageIntervals(domain.activeUsageIntervals,startAt,observedAt));
    }
  }
  const segments = mergeActiveUsageIntervals(intervals);
  const representedMs = segments.reduce((sum,[a,b])=>sum+b-a,0);
  if (representedMs > activeMs+1) throw new Error('SITE_FURIN_TIMELINE_TOTAL_MISMATCH');
  return { schemaVersion:1, hostname, cycleStartAt:startAt, observedAt, activeMs, representedMs,
    coverage: segments.length === 0 ? 'unavailable' : Math.abs(activeMs-representedMs)<1 ? 'complete' : 'partial', segments };
}
