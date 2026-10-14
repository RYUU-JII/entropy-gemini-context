// Evaluation-only facts boundary shared by model candidates and current replay.
// This is not UsageFlowObservationWindow's complete availability/exposure
// contract, and it assigns no source meaning, initial availability, or decisions.
const MAX_EVENTS = 100_000;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const TRACE_KEYS = ['version', 'surfaceMode', 'startMs', 'endMs', 'events'];
const EVENT_KEYS = Object.freeze({
  advance: ['at', 'kind', 'direction', 'screenfuls', 'itemTransitions', 'quality', 'source'],
  supply: ['at', 'kind', 'count'],
  availability: ['at', 'kind', 'visible', 'available'],
  input: ['at', 'kind', 'mode'],
});

function fail(detail) {
  throw new Error(`CURRENT_FLOW_REPLAY_INVALID_TRACE:${detail}`);
}

function requireExactKeys(value, keys, detail) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(detail);
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(detail);
  for (const key of actual) {
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) fail(detail);
  }
}

function isAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    && value <= Number.MAX_SAFE_INTEGER;
}

export function validateFlowModelTrace(trace) {
  requireExactKeys(trace, TRACE_KEYS, 'trace_keys');
  if (trace.version !== 1) fail('version');
  if (!['continuous', 'paged'].includes(trace.surfaceMode)) fail('surface_mode');
  if (!isAmount(trace.startMs) || trace.startMs < 1) fail('start_ms');
  if (!isAmount(trace.endMs) || trace.endMs <= trace.startMs
    || trace.endMs - trace.startMs > MAX_DURATION_MS) fail('end_ms');
  if (!Array.isArray(trace.events) || trace.events.length > MAX_EVENTS) fail('events');
  let previousAt = trace.startMs;
  for (const event of trace.events) {
    if (!event || !Object.hasOwn(EVENT_KEYS, event.kind)) fail('event_kind');
    requireExactKeys(event, EVENT_KEYS[event.kind], 'event_keys');
    if (!isAmount(event.at) || event.at < previousAt
      || event.at >= trace.endMs) fail('event_time');
    previousAt = event.at;
    if (event.kind === 'advance') {
      if (!['forward', 'backward'].includes(event.direction)) fail('direction');
      if (!isAmount(event.screenfuls)) fail('screenfuls');
      if (!Number.isSafeInteger(event.itemTransitions) || event.itemTransitions < 0) fail('item_transitions');
      // This replay enters after measured progression is confirmed. The shipped
      // continuous adapter also emits fresh-only candidates, but those belong
      // exclusively to the separate supply probe, not this advance boundary.
      if (event.direction === 'forward') {
        if (trace.surfaceMode === 'paged' && event.itemTransitions < 1) fail('paged_progression_required');
        if (trace.surfaceMode === 'continuous' && event.screenfuls <= 0) fail('continuous_progression_required');
      }
      if (!isAmount(event.quality) || event.quality > 1) fail('quality');
      if (!['user', 'programmatic', 'unknown'].includes(event.source)) fail('source');
    } else if (event.kind === 'supply') {
      if (!Number.isSafeInteger(event.count) || event.count < 0) fail('supply_count');
    } else if (event.kind === 'availability') {
      if (typeof event.visible !== 'boolean' || typeof event.available !== 'boolean') fail('availability');
    } else if (!['typing', 'composition', 'paste'].includes(event.mode)) fail('input_mode');
  }
}
