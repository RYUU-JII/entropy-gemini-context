import { readFlowObservationTrace } from './flowObservationTraceReader.mjs';
import { EditorObservationJournal, copyEditorObservationEvent } from '../../../src/domains/nudge/feed-flow/observation/EditorObservationJournal.js';

// The same cursor/retention owner reads both typed journals. Missing editor
// prefixes close support; retained inputs without a known state are withheld.
export function projectEditorObservationTrace(trace) {
  const retained = readFlowObservationTrace(trace, { createJournal: (capacity) => new EditorObservationJournal({ capacity }) });
  const events = [];
  let withheldInputEvents = 0;
  for (const frame of trace.frames) {
    const snapshot = frame.observation;
    if (typeof snapshot.allowed !== 'boolean' || snapshot.source !== 'unknown'
      || (snapshot.active && !snapshot.allowed)) throw new Error('EDITOR_TRACE_CAPABILITY_INVALID');
    if (!snapshot.state || typeof snapshot.state !== 'object'
      || Reflect.ownKeys(snapshot.state).length !== 2) throw new Error('EDITOR_TRACE_STATE_INVALID');
    for (const key of Reflect.ownKeys(snapshot.state)) {
      const descriptor = Object.getOwnPropertyDescriptor(snapshot.state, key);
      if (!['available', 'focused'].includes(key) || !descriptor.enumerable
        || !Object.hasOwn(descriptor, 'value')) throw new Error('EDITOR_TRACE_STATE_INVALID');
    }
    copyEditorObservationEvent({ kind: 'editor_state', at: frame.at, ...snapshot.state });
    if (!snapshot.active && snapshot.state.available) throw new Error('EDITOR_TRACE_INACTIVE_STATE');
  }
  let previousCaptureAt = null;
  for (const segment of retained.segments) {
    const frames = trace.frames.filter((frame) => frame.ownerId === segment.ownerId && frame.observation.epoch === segment.epoch);
    const initial = frames[0];
    // An uncaptured stop/regrant cannot carry old input into a new epoch.
    // Its exact boundary is unknown, so close support at the previous read,
    // only once the new baseline has actually arrived.
    if (previousCaptureAt !== null) events.push({ kind: 'editor_state', at: previousCaptureAt,
      availableAt: segment.startAt, available: false, focused: null });
    let available = initial.observation.state.available;
    events.push({ kind: 'editor_state', at: segment.startAt, availableAt: segment.startAt, ...initial.observation.state });
    for (const record of segment.records) {
      if (record.kind === 'cursor_gap') {
        available = false;
        events.push({ kind: 'editor_state', at: record.uncertainFrom, availableAt: record.detectedAt, available: false, focused: null });
      } else if (record.kind === 'editor_state') {
        available = record.available;
        events.push({ kind: record.kind, at: record.at, availableAt: record.availableAt, available, focused: record.focused });
      } else if (available) events.push({ kind: record.kind, at: record.at, availableAt: record.availableAt });
      else withheldInputEvents += 1;
    }
    for (const frame of frames) if (!frame.observation.active) {
      events.push({ kind: 'editor_state', at: frame.observation.at === null ? frame.at : frame.observation.at,
        availableAt: frame.at, available: false, focused: null });
    }
    previousCaptureAt = frames.at(-1).at;
  }
  // Equal-time facts preserve insertion order. Capability closure at an earlier
  // accounting time is an observation, not a reconstruction of missing typing.
  events.sort((left, right) => left.at - right.at);
  return { events, diagnostics: { ...retained.diagnostics, withheldInputEvents } };
}
