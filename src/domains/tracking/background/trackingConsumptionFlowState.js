// Derived facts only. No recovery threshold, admission, timer, or browser API.
export const CONSUMPTION_CONTEXT_WINDOW_MS = 60 * 60_000;
export const CONSUMPTION_CONTEXT_LIMIT = 128;

function invalid(field) {
  throw new Error(`TRACKING_CONSUMPTION_INVALID:${field}`);
}

function exact(value, keys, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length
    || keys.some((key) => !Object.hasOwn(value, key))) invalid(field);
}

function timestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) invalid(field);
}

export function requireConsumptionSegment(segment) {
  exact(segment, ['tabId', 'hostname', 'startedAt', 'endedAt', 'isProtected', 'audible', 'closed'], 'segment');
  timestamp(segment.tabId, 'tabId');
  timestamp(segment.startedAt, 'startedAt');
  timestamp(segment.endedAt, 'endedAt');
  if (segment.endedAt <= segment.startedAt) invalid('interval');
  if (typeof segment.hostname !== 'string' || !segment.hostname
    || segment.hostname !== segment.hostname.trim().toLowerCase()) invalid('hostname');
  for (const key of ['isProtected', 'audible', 'closed']) {
    if (typeof segment[key] !== 'boolean') invalid(key);
  }
  return segment;
}

function requireRun(run, field) {
  if (run === null) return;
  exact(run, ['startedAt', 'endedAt', 'foregroundMs'], field);
  timestamp(run.startedAt, `${field}.startedAt`);
  timestamp(run.endedAt, `${field}.endedAt`);
  timestamp(run.foregroundMs, `${field}.foregroundMs`);
  if (run.endedAt <= run.startedAt || run.foregroundMs !== run.endedAt - run.startedAt) invalid(field);
}

export function createEmptyConsumptionFlowState() {
  return {
    schemaVersion: 1,
    lastSegment: null,
    protectedForegroundMs: 0,
    protectedRun: null,
    outsideRun: null,
    contexts: [],
  };
}

export function requireConsumptionFlowState(state) {
  exact(state, ['schemaVersion', 'lastSegment', 'protectedForegroundMs', 'protectedRun', 'outsideRun', 'contexts'], 'state');
  if (state.schemaVersion !== 1) invalid('schemaVersion');
  timestamp(state.protectedForegroundMs, 'protectedForegroundMs');
  if (state.lastSegment !== null) requireConsumptionSegment(state.lastSegment);
  requireRun(state.protectedRun, 'protectedRun');
  requireRun(state.outsideRun, 'outsideRun');
  if (!Array.isArray(state.contexts) || state.contexts.length > CONSUMPTION_CONTEXT_LIMIT) invalid('contexts');
  let previousEnd = 0;
  for (const context of state.contexts) {
    requireConsumptionSegment(context);
    if (!context.isProtected || context.startedAt < previousEnd
      || !state.lastSegment || context.endedAt > state.lastSegment.endedAt) invalid('contexts.order');
    previousEnd = context.endedAt;
  }
  if (state.lastSegment === null && (state.protectedForegroundMs !== 0
    || state.protectedRun !== null || state.outsideRun !== null || state.contexts.length !== 0)) invalid('empty');
  if (state.protectedRun && (state.protectedRun.endedAt > state.lastSegment.endedAt
    || state.protectedRun.foregroundMs > state.protectedForegroundMs)) invalid('protectedRun.range');
  if (state.outsideRun && (state.lastSegment.isProtected
    || state.outsideRun.endedAt !== state.lastSegment.endedAt)) invalid('outsideRun.range');
  if (state.lastSegment && (state.lastSegment.isProtected
    ? !state.protectedRun || state.protectedRun.endedAt !== state.lastSegment.endedAt
    : !state.outsideRun)) invalid('current_run');
  return state;
}

function sameSource(left, right) {
  return left.tabId === right.tabId && left.hostname === right.hostname
    && left.isProtected === right.isProtected;
}

// Input is the entire sealed interval, including a stats-ACK replay. The single
// foreground watermark clips retries before either counters or contexts change.
export function reduceConsumptionSegment(previous, source) {
  requireConsumptionFlowState(previous);
  requireConsumptionSegment(source);
  const last = previous.lastSegment;
  if (last && source.endedAt < last.endedAt) return { changed: false, reason: 'stale', state: previous };
  if (last && source.startedAt < last.endedAt && !sameSource(last, source)) invalid('overlapping_sources');
  if (last && source.endedAt === last.endedAt) {
    if (!sameSource(last, source)) invalid('conflicting_receipt');
    if (!source.closed || last.closed) return { changed: false, reason: 'replay', state: previous };
    const state = structuredClone(previous);
    state.lastSegment.closed = true;
    const context = state.contexts.at(-1);
    if (context && context.endedAt === last.endedAt) context.closed = true;
    return { changed: true, reason: 'closed', state: requireConsumptionFlowState(state) };
  }

  const segment = { ...source, startedAt: last ? Math.max(source.startedAt, last.endedAt) : source.startedAt };
  const state = structuredClone(previous);
  const elapsed = segment.endedAt - segment.startedAt;
  const contiguous = last !== null && last.endedAt === segment.startedAt;
  state.contexts = state.contexts.filter((context) => segment.endedAt - context.endedAt <= CONSUMPTION_CONTEXT_WINDOW_MS);
  // A later source proves the preceding context ended, even if its final seal
  // was a heartbeat before a missed activation or worker restart.
  const context = state.contexts.at(-1);
  if (context && (!contiguous || !sameSource(context, segment))) context.closed = true;
  if (segment.isProtected) {
    state.protectedForegroundMs += elapsed;
    state.protectedRun = contiguous && last.isProtected
      ? { ...state.protectedRun, endedAt: segment.endedAt, foregroundMs: state.protectedRun.foregroundMs + elapsed }
      : { startedAt: segment.startedAt, endedAt: segment.endedAt, foregroundMs: elapsed };
    state.outsideRun = null;
    if (context && !context.closed && contiguous && sameSource(context, segment)) {
      context.endedAt = segment.endedAt;
      context.closed = segment.closed;
      context.audible = context.audible || segment.audible;
    } else {
      state.contexts.push(segment);
    }
  } else {
    state.outsideRun = contiguous && !last.isProtected
      ? { ...state.outsideRun, endedAt: segment.endedAt, foregroundMs: state.outsideRun.foregroundMs + elapsed }
      : { startedAt: segment.startedAt, endedAt: segment.endedAt, foregroundMs: elapsed };
  }
  state.contexts = state.contexts.slice(-CONSUMPTION_CONTEXT_LIMIT);
  state.lastSegment = { ...source };
  return { changed: true, reason: 'applied', state: requireConsumptionFlowState(state) };
}

export function projectConsumptionFlow(state, now) {
  requireConsumptionFlowState(state);
  timestamp(now, 'now');
  const snapshot = structuredClone(state);
  const observedThroughAt = snapshot.lastSegment?.endedAt ?? null;
  return {
    ...snapshot,
    basis: 'collection-admitted-foreground',
    observedThroughAt,
    unobservedMs: observedThroughAt === null ? null : Math.max(0, now - observedThroughAt),
    clockRegressed: observedThroughAt !== null && now < observedThroughAt,
    // Outside foreground use is not equivalent to restorative rest. Idle,
    // unfocused time and background media are deliberately not extrapolated.
    recovery: 'not_evaluated',
    contexts: snapshot.contexts.filter((context) => context.endedAt <= now
      && now - context.endedAt <= CONSUMPTION_CONTEXT_WINDOW_MS),
  };
}
