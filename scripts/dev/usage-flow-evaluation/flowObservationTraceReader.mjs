import { FeedObservationJournal } from '../../../src/domains/nudge/feed-flow/observation/FeedObservationJournal.js';

const JOURNAL_KEYS = ['version', 'capacity', 'firstSequence', 'lastSequence', 'droppedEvents',
  'overflowDroppedEvents', 'resetDiscardedEvents', 'events'];
const fail = (detail) => { throw new Error(`FLOW_OBSERVATION_TRACE_INVALID:${detail}`); };
function number(value, detail) {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) fail(detail);
}
function integer(value, detail) {
  if (!Number.isSafeInteger(value) || value < 0) fail(detail);
}
function dataProperties(value, detail) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(detail);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(detail);
  }
}
function exactKeys(value, keys, detail) {
  dataProperties(value, detail);
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(detail);
}
function denseArray(value, maximum, detail) {
  if (!Array.isArray(value) || value.length > maximum
    || Reflect.ownKeys(value).length !== value.length + 1) fail(detail);
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail(detail);
  }
}

function validatedJournal(snapshot, observation, createJournal) {
  exactKeys(snapshot, JOURNAL_KEYS, 'journal_keys');
  if (snapshot.version !== 1) fail('journal_version');
  // The actual content-free producer owns record kinds, fractions, identity
  // membership and payload limits. This isolated validator owns no live state.
  const validator = createJournal(snapshot.capacity);
  denseArray(snapshot.events, snapshot.capacity, 'journal_events');
  for (const key of ['lastSequence', 'droppedEvents', 'overflowDroppedEvents', 'resetDiscardedEvents']) {
    integer(snapshot[key], `journal_${key}`);
  }
  if (snapshot.droppedEvents !== snapshot.overflowDroppedEvents + snapshot.resetDiscardedEvents
    || snapshot.lastSequence - snapshot.events.length !== snapshot.droppedEvents) fail('journal_accounting');
  const first = snapshot.events.length ? snapshot.droppedEvents + 1 : null;
  if (snapshot.firstSequence !== first) fail('journal_first_sequence');
  const events = snapshot.events.map((event, index) => {
    dataProperties(event, 'event_properties');
    if (event.sequence !== first + index) fail('event_sequence');
    const { sequence, ...record } = event;
    const accepted = validator.append(record);
    if (accepted.epoch > observation.epoch || observation.at === null || accepted.at > observation.at) {
      fail('event_outside_observation');
    }
    return { ...accepted, sequence };
  });
  return { ...snapshot, events };
}

function validateFrame(frame, createJournal) {
  exactKeys(frame, ['ownerId', 'at', 'observation'], 'frame_keys');
  if (typeof frame.ownerId !== 'string' || !frame.ownerId.trim()) fail('owner_id');
  number(frame.at, 'capture_time');
  const current = frame.observation;
  dataProperties(current, 'observation');
  if (current.version !== 1 || typeof current.active !== 'boolean') fail('observation_contract');
  integer(current.epoch, 'epoch');
  if (current.at === null) {
    if (current.active || current.epoch !== 0) fail('uninitialized_observation');
  } else {
    number(current.at, 'accounting_time');
    if (current.at > frame.at) fail('accounting_after_capture');
  }
  if (current.active && current.epoch < 1) fail('active_epoch');
  const journal = validatedJournal(current.eventJournal, current, createJournal);
  if (current.at === null && journal.lastSequence !== 0) fail('uninitialized_journal_history');
  return journal;
}

// Shared evaluation cursor/contract owner. Consumers receive only retained
// observations, explicit baselines and losses, never pressure or decisions.
export function readFlowObservationTrace(trace, { createJournal = (capacity) => new FeedObservationJournal({ capacity }) } = {}) {
  exactKeys(trace, ['version', 'clockBasis', 'startMs', 'endMs', 'frames'], 'trace_keys');
  number(trace.startMs, 'start_time'); number(trace.endMs, 'end_time');
  denseArray(trace.frames, 100_000, 'frames');
  if (trace.version !== 1 || trace.clockBasis !== 'shared_monotonic_milliseconds'
    || trace.endMs < trace.startMs || trace.endMs - trace.startMs > 86_400_000
    || trace.frames.length === 0) fail('trace');
  const segments = [];
  const seenOwners = new Set();
  const diagnostics = { duplicateReadings: 0, processedEvents: 0, missingEvents: 0, cursorGaps: [], boundaries: [] };
  let previous = null;
  let previousJournal = null;
  let segment = null;
  let cursor = 0;
  for (const [frameIndex, frame] of trace.frames.entries()) {
    const journal = validateFrame(frame, createJournal);
    if (frame.at < (previous ? previous.at : trace.startMs) || frame.at > trace.endMs) fail('capture_order');
    const current = frame.observation;
    const sameOwner = previous !== null && frame.ownerId === previous.ownerId;
    if (sameOwner) {
      const prior = previous.observation;
      if (current.epoch < prior.epoch) fail('epoch_reversed');
      if (current.at === null ? prior.at !== null : prior.at !== null && current.at < prior.at) fail('accounting_reversed');
      if (journal.capacity !== previousJournal.capacity) fail('journal_capacity_changed');
      for (const key of ['lastSequence', 'overflowDroppedEvents', 'resetDiscardedEvents']) {
        if (journal[key] < previousJournal[key]) fail(`journal_reversed:${key}`);
      }
      const priorEvents = new Map(previousJournal.events.map((event) => [event.sequence, event]));
      for (const event of journal.events) {
        const priorEvent = priorEvents.get(event.sequence);
        if (priorEvent && JSON.stringify(priorEvent) !== JSON.stringify(event)) fail('event_rewritten');
        if (event.sequence > previousJournal.lastSequence && event.at < previous.at) fail('event_before_previous_capture');
      }
      if (current.epoch === prior.epoch && !prior.active) {
        if (current.active) fail('restart_without_new_epoch');
        if (journal.lastSequence !== previousJournal.lastSequence) fail('inactive_events');
      }
    }
    if (!sameOwner || current.epoch !== previous.observation.epoch) {
      if (segment) segment.endAt = frame.at;
      if (!sameOwner) {
        if (seenOwners.has(frame.ownerId)) fail('owner_reentry_requires_separate_trace');
        seenOwners.add(frame.ownerId);
      }
      if (previous) diagnostics.boundaries.push({ at: frame.at,
        reason: sameOwner ? 'epoch_changed' : 'owner_replaced',
        excludedEventsSincePreviousCapture: sameOwner ? journal.lastSequence - cursor : null });
      cursor = journal.lastSequence;
      segment = { ownerId: frame.ownerId, epoch: current.epoch, startAt: frame.at, endAt: trace.endMs,
        baselineSequence: cursor, baselineRetainedEvents: journal.events.length,
        baselineDroppedEvents: journal.droppedEvents, records: [], captures: [] };
      segments.push(segment);
    } else {
      const missing = journal.firstSequence === null ? journal.lastSequence - cursor
        : Math.max(0, journal.firstSequence - cursor - 1);
      if (missing > 0) {
        const suffixStartAt = journal.events.length ? journal.events[0].at : frame.at;
        diagnostics.missingEvents += missing;
        diagnostics.cursorGaps.push({ ownerId: frame.ownerId, epoch: current.epoch, frameIndex,
          detectedAt: frame.at, afterSequence: cursor, missingEvents: missing, retainedSuffixStartAt: suffixStartAt });
        segment.records.push({ kind: 'cursor_gap', at: suffixStartAt, uncertainFrom: previous.at,
          detectedAt: frame.at, missingEvents: missing });
      }
      if (journal.lastSequence === cursor) diagnostics.duplicateReadings += 1;
      for (const event of journal.events) {
        if (event.sequence <= cursor) continue;
        if (event.epoch !== current.epoch) fail('event_epoch_without_boundary');
        diagnostics.processedEvents += 1;
        if (diagnostics.processedEvents > 1_000_000) fail('event_budget');
        segment.records.push({ ...event, availableAt: frame.at });
      }
      cursor = journal.lastSequence;
    }
    // Timing capability is measurement metadata. Unsupported older minimal
    // pressure traces need no geometry hold, and remain explicitly absent here.
    segment.captures.push({ at: frame.at, maxSampleHoldMs: Object.hasOwn(current, 'maxSampleHoldMs')
      ? current.maxSampleHoldMs : null });
    previous = frame;
    previousJournal = journal;
  }
  return { segments, diagnostics };
}
