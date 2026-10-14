import { INTERVENTION_RESERVATION_TTL_MS } from '../../../nudge/runtime/interventionPolicy.js';

export const INTERVENTION_EXPOSURE_WINDOW_MS = 60 * 60_000;
export const INTERVENTION_EXPOSURE_INTERVAL_LIMIT = 256;
const KINDS = ['presented', 'uncertain'];
function time(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('INTERVENTION_EXPOSURE_TIME_INVALID');
}
function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new Error('INTERVENTION_EXPOSURE_SHAPE_INVALID');
  }
}
function interval(value) {
  exact(value, ['startedAt', 'endedAt', 'kind']); time(value.startedAt); time(value.endedAt);
  if (value.endedAt <= value.startedAt || !KINDS.includes(value.kind)) throw new Error('INTERVENTION_EXPOSURE_INTERVAL_INVALID');
}
export function createInterventionExposureWindow(at) {
  time(at);
  return { version: 1, startedAt: at, updatedAt: at, intervals: [] };
}
export function requireInterventionExposureWindow(value) {
  exact(value, ['version', 'startedAt', 'updatedAt', 'intervals']);
  time(value.startedAt); time(value.updatedAt);
  if (value.version !== 1 || value.updatedAt < value.startedAt || !Array.isArray(value.intervals)
    || value.intervals.length > INTERVENTION_EXPOSURE_INTERVAL_LIMIT) throw new Error('INTERVENTION_EXPOSURE_WINDOW_INVALID');
  let previousEnd = value.startedAt;
  for (const item of value.intervals) {
    interval(item);
    if (item.startedAt < previousEnd || item.endedAt > value.updatedAt) throw new Error('INTERVENTION_EXPOSURE_ORDER_INVALID');
    previousEnd = item.endedAt;
  }
  return value;
}

function unionIntervals(items, from, through) {
  const clipped = items.map((item) => ({ ...item, startedAt: Math.max(from, item.startedAt),
    endedAt: Math.min(through, item.endedAt) })).filter((item) => item.endedAt > item.startedAt);
  const cuts = [...new Set(clipped.flatMap((item) => [item.startedAt, item.endedAt]))].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i], end = cuts[i + 1];
    const active = clipped.filter((item) => item.startedAt <= start && item.endedAt >= end);
    if (!active.length) continue;
    const kind = active.some((item) => item.kind === 'uncertain') ? 'uncertain' : 'presented';
    const previous = result.at(-1);
    if (previous?.endedAt === start && previous.kind === kind) previous.endedAt = end;
    else result.push({ startedAt: start, endedAt: end, kind });
  }
  return result;
}

export function advanceInterventionExposureWindow(value, at, additions = []) {
  requireInterventionExposureWindow(value); time(at); additions.forEach(interval);
  if (at < value.updatedAt) throw new Error('INTERVENTION_EXPOSURE_CLOCK_REGRESSED');
  if (additions.some((item) => item.endedAt > at)) throw new Error('INTERVENTION_EXPOSURE_FUTURE_INTERVAL');
  let startedAt = Math.max(value.startedAt, at - INTERVENTION_EXPOSURE_WINDOW_MS);
  let intervals = unionIntervals([...value.intervals, ...additions], startedAt, at);
  if (intervals.length > INTERVENTION_EXPOSURE_INTERVAL_LIMIT) {
    intervals = intervals.slice(-INTERVENTION_EXPOSURE_INTERVAL_LIMIT);
    startedAt = Math.max(startedAt, intervals[0].startedAt);
  }
  return requireInterventionExposureWindow({ version: 1, startedAt, updatedAt: at, intervals });
}

// Reservation is uncertainty, not exposure. Only a presented ACK followed by a
// confirmed end can label the held interval. Disappearance/recovered receipts
// bound a possibly earlier end and therefore remain uncertain throughout.
export function recordInterventionExposureEnd(value, owner, at, { presentedAt, confirmedEnd }) {
  time(presentedAt); time(at);
  if (typeof confirmedEnd !== 'boolean') throw new Error('INTERVENTION_EXPOSURE_END_EVIDENCE_REQUIRED');
  const reservedAt = owner.reservedUntil - INTERVENTION_RESERVATION_TTL_MS;
  time(reservedAt);
  if (at < reservedAt || (presentedAt > 0 && (presentedAt < reservedAt || presentedAt > at))) {
    throw new Error('INTERVENTION_EXPOSURE_LIFECYCLE_INVALID');
  }
  const additions = [];
  const uncertainUntil = presentedAt > 0 && confirmedEnd ? presentedAt : at;
  if (uncertainUntil > reservedAt) additions.push({ startedAt: reservedAt, endedAt: uncertainUntil, kind: 'uncertain' });
  if (presentedAt > 0 && confirmedEnd && at > presentedAt) additions.push({ startedAt: presentedAt, endedAt: at, kind: 'presented' });
  return advanceInterventionExposureWindow(value, at, additions);
}

export function projectInterventionExposureSnapshot(state, evaluatedAt) {
  time(evaluatedAt);
  const base = { contract: 'intervention_exposure_snapshot_v1', evaluatedAt,
    status: 'unobserved', coverageFrom: null, committedAt: null, settledThroughAt: null, intervals: [] };
  // Optional current capability: absent means no interval recording yet. It
  // never means an empty/clear historical interval and never triggers a write.
  if (!state || !Object.hasOwn(state, 'exposureWindow')) return base;
  const value = requireInterventionExposureWindow(state.exposureWindow);
  // A later commit can still certify a retained earlier query. Only history
  // already outside the retained window is unavailable.
  if (evaluatedAt < value.startedAt) return { ...base, status: 'ahead_of_query', committedAt: value.updatedAt };
  const from = Math.max(value.startedAt, evaluatedAt - INTERVENTION_EXPOSURE_WINDOW_MS);
  const active = [state.owner, ...state.blockers].filter(Boolean).map((owner) => ({
    startedAt: owner.reservedUntil - INTERVENTION_RESERVATION_TTL_MS, endedAt: evaluatedAt, kind: 'uncertain',
  }));
  const settledThroughAt = Math.max(from, Math.min(evaluatedAt, ...active.map((item) => item.startedAt)));
  return { ...base, status: 'observed', coverageFrom: from, committedAt: value.updatedAt, settledThroughAt,
    intervals: unionIntervals([...value.intervals, ...active], from, evaluatedAt) };
}

export function requireInterventionExposureSnapshot(value) {
  exact(value, ['contract', 'evaluatedAt', 'status', 'coverageFrom', 'committedAt', 'settledThroughAt', 'intervals']);
  time(value.evaluatedAt);
  if (value.contract !== 'intervention_exposure_snapshot_v1' || !['observed', 'unobserved', 'ahead_of_query'].includes(value.status)
    || !Array.isArray(value.intervals)) throw new Error('INTERVENTION_EXPOSURE_SNAPSHOT_INVALID');
  if (value.status !== 'observed') {
    if (value.coverageFrom !== null || value.settledThroughAt !== null || value.intervals.length !== 0) throw new Error('INTERVENTION_EXPOSURE_UNOBSERVED_INVALID');
    if (value.status === 'unobserved' && value.committedAt !== null) throw new Error('INTERVENTION_EXPOSURE_UNOBSERVED_INVALID');
    if (value.status === 'ahead_of_query') { time(value.committedAt); if (value.committedAt <= value.evaluatedAt) throw new Error('INTERVENTION_EXPOSURE_QUERY_ORDER_INVALID'); }
    return value;
  }
  time(value.coverageFrom); time(value.committedAt); time(value.settledThroughAt);
  if (value.coverageFrom > value.settledThroughAt || value.settledThroughAt > value.evaluatedAt) throw new Error('INTERVENTION_EXPOSURE_QUERY_ORDER_INVALID');
  let through = value.coverageFrom;
  for (const item of value.intervals) {
    interval(item);
    if (item.startedAt < through || item.endedAt > value.evaluatedAt) throw new Error('INTERVENTION_EXPOSURE_ORDER_INVALID');
    through = item.endedAt;
  }
  return value;
}
