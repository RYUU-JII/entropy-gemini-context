import { readFlowObservationTrace } from './flowObservationTraceReader.mjs';
import { copyEditorObservationEvent } from '../../../src/domains/nudge/feed-flow/observation/EditorObservationJournal.js';

export const FLOW_TEMPORAL_CONFIG = Object.freeze({ timeConstantsMs: Object.freeze([8000, 40000]) });
const fail = (detail) => { throw new Error(`FLOW_TEMPORAL_INVALID:${detail}`); };
const numeric = (value) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
function denseArray(value, maximum) {
  if (!Array.isArray(value) || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) fail('array');
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail('array');
  }
}
function keys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Reflect.ownKeys(value).length !== expected.length) fail('keys');
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!expected.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('keys');
  }
}
const ratio = (numerator, denominator) => denominator > 0 ? numerator / denominator : null;
const sum = (values) => values.reduce((total, value) => total + value, 0);
function overlap(left, right) {
  const previous = new Map(left.map((item) => [item.itemId, item.regionFraction]));
  const intersection = sum(right.map((item) => Math.min(previous.get(item.itemId) || 0, item.regionFraction)));
  const union = sum(left.map((item) => item.regionFraction)) + sum(right.map((item) => item.regionFraction)) - intersection;
  return ratio(intersection, union);
}
function editorIntervals(events, start, at) {
  let available = false;
  let focused = null;
  let lastInputAt = null;
  let stateSinceAt = null;
  let from = start;
  const intervals = [];
  for (const event of events) {
    if (event.at < start) continue;
    if (event.at > at) break;
    if (event.availableAt > at) continue;
    if (event.at >= start) {
      intervals.push({ from, to: event.at, available, focused });
      from = event.at;
    }
    if (event.kind === 'editor_state') {
      if (stateSinceAt === null || available !== event.available || focused !== event.focused) stateSinceAt = event.at;
      available = event.available; focused = event.focused;
      if (!available) lastInputAt = null;
    } else {
      if (!available) fail('input_without_segment_observation');
      lastInputAt = event.at;
    }
  }
  intervals.push({ from, to: at, available, focused });
  return { intervals, available, focused, stateSinceAt, lastInputAt };
}
function validateEditor(events, start, end) {
  denseArray(events, 100000);
  let previous = start;
  let available = false;
  for (const event of events) {
    const kind = event && Object.getOwnPropertyDescriptor(event, 'kind');
    if (!kind || !Object.hasOwn(kind, 'value')) fail('editor_kind');
    if (kind.value === 'editor_state') {
      keys(event, ['kind', 'at', 'availableAt', 'available', 'focused']);
      if (typeof event.available !== 'boolean' || (event.available
        ? typeof event.focused !== 'boolean' : event.focused !== null)) fail('editor_state');
      available = event.available;
    } else if (kind.value === 'input_activity') {
      keys(event, ['kind', 'at', 'availableAt']);
      if (!available) fail('input_without_observation');
    } else fail('editor_kind');
    if (!numeric(event.at) || event.at < previous || event.at > end) fail('editor_time');
    if (!numeric(event.availableAt) || event.availableAt < event.at || event.availableAt > end) fail('editor_arrival_time');
    const { availableAt, ...fact } = event;
    copyEditorObservationEvent(fact);
    previous = event.at;
  }
}

// Descriptive event-time estimates available at each requested read. Two time
// scales preserve mixtures and transitions; no argmax, learned label, pressure,
// intervention verdict or human intention is an input or a returned authority.
export function interpretFlowTimeline(input, config = FLOW_TEMPORAL_CONFIG) {
  keys(input, ['feedTrace', 'editorEvents', 'atMs']);
  keys(config, ['timeConstantsMs']);
  denseArray(config.timeConstantsMs, 2);
  if (config.timeConstantsMs.length !== 2
    || config.timeConstantsMs.some((value) => !numeric(value) || value === 0)
    || config.timeConstantsMs[0] >= config.timeConstantsMs[1]) fail('time_constants');
  const { feedTrace, editorEvents, atMs } = input;
  const retained = readFlowObservationTrace(feedTrace);
  validateEditor(editorEvents, feedTrace.startMs, feedTrace.endMs);
  denseArray(atMs, 1000);
  if (!atMs.length
    || atMs.some((at, i) => !numeric(at) || at < feedTrace.startMs || at > feedTrace.endMs
      || (i > 0 && at <= atMs[i - 1]))) fail('query_times');
  if (atMs.length * (retained.diagnostics.processedEvents + editorEvents.length) > 10000000) fail('work_budget');
  for (const segment of retained.segments) {
    const hold = segment.captures[0].maxSampleHoldMs;
    if (!numeric(hold) || hold <= 0 || segment.captures.some((capture) => capture.maxSampleHoldMs !== hold)) {
      fail('sample_hold_capability');
    }
  }
  const rows = atMs.map((at) => {
    const segment = retained.segments.findLast((value) => value.startAt <= at);
    if (!segment) fail('query_before_baseline');
    const hold = segment.captures[0].maxSampleHoldMs;
    const records = segment.records.filter((record) => (record.kind === 'cursor_gap'
      ? record.detectedAt : record.availableAt) <= at);
    const spans = [];
    const comparisons = [];
    const entries = [];
    let held = null;
    let previous = null;
    let missingEvents = 0;
    let latestForwardAt = null;
    let movementContinuitySinceAt = segment.startAt;
    function endHold(to) {
      if (held) {
        spans.push({ from: held.at, to: Math.min(to, held.at + hold), items: held.items });
        held = null;
      }
    }
    for (const record of records) {
      if (record.kind === 'cursor_gap') {
        endHold(record.uncertainFrom); previous = null;
        movementContinuitySinceAt = Math.max(movementContinuitySinceAt, record.detectedAt);
        missingEvents += record.missingEvents;
      } else if (record.kind === 'observation_gap') {
        endHold(record.at); previous = null;
        movementContinuitySinceAt = Math.max(movementContinuitySinceAt, record.at);
      } else if (record.kind === 'scroll_displacement') {
        endHold(record.at);
        if (record.direction === 'forward' && record.screenfuls > 0) latestForwardAt = record.at;
      }
      else {
        if (previous === null || record.at > previous.at + hold) {
          movementContinuitySinceAt = Math.max(movementContinuitySinceAt, record.at);
        }
        endHold(record.at);
        // A later sample establishes only the bounded overlap of the observed
        // pair. Missing pairs/baselines/evicted identities are not stability.
        if (previous && record.continuity && record.previousSampleAt === previous.at
          && record.at - previous.at <= hold) {
          const matching = overlap(previous.items, record.items);
          const span = spans.at(-1);
          if (matching !== null && span && span.from === previous.at) comparisons.push({ ...span, matching });
          const entered = record.items.filter((item) => record.enteredItemIds.includes(item.itemId));
          entries.push({ at: record.at, all: sum(entered.map((item) => item.regionFraction)),
            returned: sum(entered.filter((item) => record.reenteredItemIds.includes(item.itemId)).map((item) => item.regionFraction)) });
        }
        held = record; previous = record;
      }
    }
    const currentGeometrySupported = held !== null && at < held.at + hold;
    endHold(at);
    // Feed structure epochs do not end a still-observed editor in the same
    // document; replacing that owner still starts independent evidence.
    const ownerStart = retained.segments.find((value) => value.ownerId === segment.ownerId).startAt;
    const editor = editorIntervals(editorEvents, ownerStart, at);
    const windows = config.timeConstantsMs.map((tau) => {
      const decay = (time) => Math.exp(-(at - time) / tau);
      const integral = (from, to) => to > from ? tau * decay(to) * -Math.expm1(-(to - from) / tau) : 0;
      const ageWeight = integral(segment.startAt, at);
      const geometryWeight = sum(spans.map((span) => integral(span.from, span.to)));
      const comparableWeight = sum(comparisons.map((span) => integral(span.from, span.to)));
      const identityArea = (basis) => sum(spans.map((span) => integral(span.from, span.to)
        * sum(span.items.filter((item) => basis === null || item.identityBasis === basis).map((item) => item.regionFraction))));
      const totalIdentityArea = identityArea(null);
      const movement = records.filter((record) => record.kind === 'scroll_displacement');
      const forward = sum(movement.filter((record) => record.direction === 'forward').map((record) => record.screenfuls * decay(record.at))) * 1000 / tau;
      const backward = sum(movement.filter((record) => record.direction === 'backward').map((record) => record.screenfuls * decay(record.at))) * 1000 / tau;
      const editorWeight = sum(editor.intervals.filter((span) => span.available).map((span) => integral(span.from, span.to)));
      return { timeConstantMs: tau,
        geometrySupport: ratio(geometryWeight, ageWeight), comparisonSupport: ratio(comparableWeight, ageWeight),
        contentHintAreaShare: ratio(identityArea('content_hint'), totalIdentityArea),
        nodeOnlyAreaShare: ratio(identityArea('node_only'), totalIdentityArea),
        ambiguousHintAreaShare: ratio(identityArea('ambiguous_hint'), totalIdentityArea),
        observedForwardRate: forward, observedBackwardRate: backward,
        backwardShare: ratio(backward, forward + backward),
        matchedVisibleAreaShare: ratio(sum(comparisons.map((span) => span.matching * integral(span.from, span.to))), comparableWeight),
        retainedIdentityReentryShare: ratio(sum(entries.map((entry) => entry.returned * decay(entry.at))), sum(entries.map((entry) => entry.all * decay(entry.at)))),
        editorSupport: ratio(editorWeight, integral(ownerStart, at)),
        editorFocusShare: ratio(sum(editor.intervals.filter((span) => span.available && span.focused).map((span) => integral(span.from, span.to))), editorWeight),
        inputRecency: editor.available && editor.lastInputAt !== null ? decay(editor.lastInputAt) : null,
      };
    });
    if (windows.some((window) => Object.values(window).some((value) => value !== null && !Number.isFinite(value)))) fail('non_finite_projection');
    return { at, ownerId: segment.ownerId, epoch: segment.epoch, historySpanMs: at - segment.startAt,
      currentGeometrySupported, editorAvailable: editor.available,
      editorFocused: editor.focused, editorStateSinceAt: editor.stateSinceAt,
      lastInputAt: editor.lastInputAt, latestForwardAt, movementContinuitySinceAt,
      retainedEventsComplete: missingEvents === 0, missingEvents, windows };
  });
  return { version: 1, authority: 'evaluation_only_descriptive_temporal_evidence',
    timeConstantsMs: [...config.timeConstantsMs], rows,
    limitations: ['unknown_scroll_source_not_user_intention', 'sampled_geometry_not_reading',
      'local_identity_reentry_not_consumption', 'editor_focus_and_input_not_draft_identity',
      'input_events_not_human_or_submission_proof',
      'rates_after_cursor_loss_describe_only_retained_events', 'no_discrete_label_or_intervention_policy'] };
}
