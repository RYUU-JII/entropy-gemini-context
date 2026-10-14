// Measurement only: no intention, admission, pressure, baseline, or persistence.
// Availability is supplied by the observer; a lack of events cannot establish it.
const AVAILABILITY = {
  feed: ['supported', 'unsupported', 'unavailable'],
  input: ['available', 'unavailable'],
  visibility: ['visible', 'hidden'],
};
const EVENT_KEYS = {
  availability: ['at', 'type', 'feed', 'input', 'visibility'],
  feed_advance: ['at', 'type', 'screenfuls', 'itemTransitions', 'source'],
  input: ['at', 'type', 'mode'],
  intervention: ['at', 'type', 'active'],
};
const COUNT_FIELDS = [
  'userScreenfuls', 'userItemTransitions',
  'programmaticScreenfuls', 'programmaticItemTransitions',
  'unknownSourceScreenfuls', 'unknownSourceItemTransitions',
  'acceptedFeedAdvanceEvents', 'excludedFeedAdvanceEvents',
  'typingEvents', 'compositionEvents', 'pasteEvents', 'excludedInputEvents',
];
const TIME_FIELDS = [
  'visibleMs', 'hiddenMs', 'feedObservedVisibleMs',
  'feedUnavailableVisibleMs', 'feedUnsupportedVisibleMs',
  'inputObservedVisibleMs', 'inputUnavailableVisibleMs', 'interventionExposedMs',
];

function requireShape(value, keys, label) {
  if (
    value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length
    || keys.some((key) => !Object.hasOwn(value, key))
  ) throw new Error(`USAGE_FLOW_${label}_SHAPE_INVALID`);
}

function requireNonnegativeNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`USAGE_FLOW_${label}_INVALID`);
  }
  return value;
}

function requireEvent(event) {
  if (!event || !Object.hasOwn(EVENT_KEYS, event.type)) {
    throw new Error('USAGE_FLOW_EVENT_TYPE_INVALID');
  }
  requireShape(event, EVENT_KEYS[event.type], 'EVENT');
  requireNonnegativeNumber(event.at, 'EVENT_TIME');
  if (event.type === 'availability') {
    for (const [key, values] of Object.entries(AVAILABILITY)) {
      if (!values.includes(event[key])) throw new Error(`USAGE_FLOW_AVAILABILITY_${key}_INVALID`);
    }
  } else if (event.type === 'feed_advance') {
    requireNonnegativeNumber(event.screenfuls, 'SCREENFULS');
    if (!Number.isSafeInteger(event.itemTransitions) || event.itemTransitions < 0) {
      throw new Error('USAGE_FLOW_ITEM_TRANSITIONS_INVALID');
    }
    if (event.screenfuls === 0 && event.itemTransitions === 0) {
      throw new Error('USAGE_FLOW_EMPTY_ADVANCE');
    }
    if (!['user', 'programmatic', 'unknown'].includes(event.source)) {
      throw new Error('USAGE_FLOW_ADVANCE_SOURCE_INVALID');
    }
  } else if (event.type === 'input') {
    if (!['typing', 'composition', 'paste'].includes(event.mode)) {
      throw new Error('USAGE_FLOW_INPUT_MODE_INVALID');
    }
  } else if (typeof event.active !== 'boolean') {
    throw new Error('USAGE_FLOW_INTERVENTION_EXPOSURE_INVALID');
  }
  return event;
}

export class UsageFlowObservationWindow {
  constructor({ startMs, initialInterventionActive }) {
    this._startMs = requireNonnegativeNumber(startMs, 'START_TIME');
    if (typeof initialInterventionActive !== 'boolean') {
      throw new Error('USAGE_FLOW_INITIAL_INTERVENTION_EXPOSURE_REQUIRED');
    }
    this._cursorMs = startMs;
    this._lastEventAt = null;
    this._availability = null;
    this._exposed = initialInterventionActive;
    this._totals = Object.fromEntries([...TIME_FIELDS, ...COUNT_FIELDS].map((key) => [key, 0]));
  }

  record(rawEvent) {
    const event = requireEvent(rawEvent);
    if (this._availability === null) {
      if (event.type !== 'availability' || event.at !== this._startMs) {
        throw new Error('USAGE_FLOW_INITIAL_AVAILABILITY_REQUIRED');
      }
    }
    this._advanceTo(event.at);
    if (event.type === 'availability') {
      this._availability = { feed: event.feed, input: event.input, visibility: event.visibility };
    } else if (event.type === 'intervention') {
      this._exposed = event.active;
    } else if (event.type === 'input') {
      if (this._availability.visibility !== 'visible' || this._availability.input !== 'available') {
        this._totals.excludedInputEvents += 1;
      } else {
        this._totals[`${event.mode}Events`] += 1;
      }
    } else if (this._availability.visibility !== 'visible' || this._availability.feed !== 'supported') {
      this._totals.excludedFeedAdvanceEvents += 1;
    } else {
      const prefix = event.source === 'unknown' ? 'unknownSource' : event.source;
      this._totals[`${prefix}Screenfuls`] += event.screenfuls;
      this._totals[`${prefix}ItemTransitions`] += event.itemTransitions;
      this._totals.acceptedFeedAdvanceEvents += 1;
    }
    this._lastEventAt = event.at;
  }

  // The caller supplies a monotonic clock. Closing at t integrates [cursor,t).
  // This consumes time; subsequent events must be at or after t.
  getSnapshot({ endMs }) {
    if (this._availability === null) throw new Error('USAGE_FLOW_INITIAL_AVAILABILITY_REQUIRED');
    if (endMs <= this._lastEventAt) throw new Error('USAGE_FLOW_CLOSE_MUST_FOLLOW_LAST_EVENT');
    this._advanceTo(endMs);
    const values = this._totals;
    if (Object.values(values).some((value) => !Number.isFinite(value))) {
      throw new Error('USAGE_FLOW_MEASUREMENT_OVERFLOW');
    }
    if (COUNT_FIELDS.some((key) => !key.endsWith('Screenfuls') && !Number.isSafeInteger(values[key]))) {
      throw new Error('USAGE_FLOW_MEASUREMENT_OVERFLOW');
    }
    const observedMinutes = values.feedObservedVisibleMs / 60000;
    const snapshot = {
      elapsedMs: endMs - this._startMs,
      ...values,
      // These are window averages of confirmed user-source advances. They are
      // neither instantaneous speed nor item dwell / reading / typing duration.
      screenfulsPerObservedMinute: observedMinutes > 0 ? values.userScreenfuls / observedMinutes : null,
      itemTransitionsPerObservedMinute: observedMinutes > 0 ? values.userItemTransitions / observedMinutes : null,
    };
    if (Object.values(snapshot).some((value) => value !== null && !Number.isFinite(value))) {
      throw new Error('USAGE_FLOW_MEASUREMENT_OVERFLOW');
    }
    return Object.freeze(snapshot);
  }

  _advanceTo(at) {
    requireNonnegativeNumber(at, 'TIME');
    if (at < this._cursorMs) throw new Error('USAGE_FLOW_TIME_REGRESSION');
    const elapsed = at - this._cursorMs;
    if (elapsed > 0 && this._availability === null) {
      throw new Error('USAGE_FLOW_INITIAL_AVAILABILITY_REQUIRED');
    }
    if (elapsed > 0) {
      const { visibility, feed, input } = this._availability;
      if (visibility === 'hidden') {
        this._totals.hiddenMs += elapsed;
      } else {
        this._totals.visibleMs += elapsed;
        const feedTime = {
          supported: 'feedObservedVisibleMs',
          unsupported: 'feedUnsupportedVisibleMs',
          unavailable: 'feedUnavailableVisibleMs',
        }[feed];
        this._totals[feedTime] += elapsed;
        this._totals[input === 'available' ? 'inputObservedVisibleMs' : 'inputUnavailableVisibleMs'] += elapsed;
        if (this._exposed) this._totals.interventionExposedMs += elapsed;
      }
    }
    this._cursorMs = at;
  }
}

export function measureUsageFlowTrace(trace) {
  requireShape(trace, ['startMs', 'endMs', 'initialInterventionActive', 'events'], 'TRACE');
  requireNonnegativeNumber(trace.startMs, 'START_TIME');
  requireNonnegativeNumber(trace.endMs, 'END_TIME');
  if (trace.endMs <= trace.startMs) throw new Error('USAGE_FLOW_TRACE_INTERVAL_INVALID');
  if (!Array.isArray(trace.events) || trace.events.length === 0) {
    throw new Error('USAGE_FLOW_TRACE_EVENTS_REQUIRED');
  }
  const window = new UsageFlowObservationWindow({
    startMs: trace.startMs, initialInterventionActive: trace.initialInterventionActive,
  });
  for (const event of trace.events) {
    requireEvent(event);
    if (event.at < trace.startMs || event.at >= trace.endMs) {
      throw new Error('USAGE_FLOW_EVENT_OUTSIDE_TRACE');
    }
    window.record(event);
  }
  return window.getSnapshot({ endMs: trace.endMs });
}

export default UsageFlowObservationWindow;
