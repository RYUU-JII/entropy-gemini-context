// Optional exact foreground coverage within existing hourly facts. Absence is
// unmeasured history, never zero usage. No second collector or persistence lane.
export const ACTIVE_USAGE_INTERVALS_PER_HOUR = 32;
export const ACTIVE_USAGE_INTERVALS_MAX = 24 * ACTIVE_USAGE_INTERVALS_PER_HOUR;

export function requireActiveUsageIntervals(value) {
  if (!Array.isArray(value) || value.length > ACTIVE_USAGE_INTERVALS_MAX) throw new Error('STATS_ACTIVE_INTERVALS_INVALID');
  let previousEnd = -1;
  return value.map(interval => {
    if (!Array.isArray(interval) || interval.length !== 2
      || !interval.every(Number.isFinite) || interval[0] < 0
      || interval[1] <= interval[0] || interval[0] < previousEnd) throw new Error('STATS_ACTIVE_INTERVAL_INVALID');
    previousEnd = interval[1];
    return [...interval];
  });
}

export function mergeActiveUsageIntervals(intervals) {
  const sorted = intervals.map(pair => [...pair]).sort((a,b) => a[0]-b[0]);
  const merged = [];
  for (const pair of sorted) {
    const last = merged.at(-1);
    if (last && pair[0] <= last[1]) last[1] = Math.max(last[1],pair[1]);
    else merged.push(pair);
  }
  return merged;
}

export function appendActiveUsageInterval(existing, start, end) {
  requireActiveUsageIntervals([[start,end]]);
  const merged = mergeActiveUsageIntervals([...requireActiveUsageIntervals(existing),[start,end]]);
  // Split before bounding: saturation loses coverage, never invents a joined gap.
  const hours = new Map();
  for (const [from,to] of merged) {
    for (let cursor=from; cursor<to;) {
      const boundary = new Date(cursor); boundary.setMinutes(0,0,0);
      const key = boundary.getTime(); boundary.setHours(boundary.getHours()+1);
      const stop = Math.min(to,boundary.getTime());
      if (!(stop>cursor)) throw new Error('STATS_ACTIVE_INTERVAL_HOUR_INVALID');
      if (!hours.has(key)) hours.set(key,[]);
      hours.get(key).push([cursor,stop]); cursor=stop;
    }
  }
  return [...hours.values()].flatMap(pairs=>pairs.slice(-ACTIVE_USAGE_INTERVALS_PER_HOUR)).slice(-ACTIVE_USAGE_INTERVALS_MAX);
}

export function clipActiveUsageIntervals(intervals, start, end) {
  return requireActiveUsageIntervals(intervals).map(([a,b])=>[Math.max(a,start),Math.min(b,end)]).filter(([a,b])=>b>a);
}
