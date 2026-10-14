// Report-only normalization. Live observation DTOs and replay inputs continue
// to contain event arrays. Only the two declared report frame paths are encoded.
export const FLOW_MEASURED_JOURNAL_ENCODING = Object.freeze({
  version: 1, format: 'scenario_owner_sequence',
});

const fail = (detail) => { throw new Error(`FLOW_MEASURED_REPORT_ENCODING_INVALID:${detail}`); };
function object(value, detail) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(detail);
}
function id(value, detail) {
  if (typeof value !== 'string' || !value.trim()) fail(detail);
}
function sequence(value, detail) {
  if (!Number.isSafeInteger(value) || value < 1) fail(detail);
}
function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object'
    || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
}
function scenariosOf(report) {
  object(report, 'report');
  if (!Object.hasOwn(report, 'scenarios')) return [];
  if (!Array.isArray(report.scenarios)) fail('scenarios');
  const ids = new Set();
  for (const scenario of report.scenarios) {
    object(scenario, 'scenario'); id(scenario.id, 'scenario_id');
    if (ids.has(scenario.id)) fail('duplicate_scenario_id');
    ids.add(scenario.id);
  }
  return report.scenarios;
}
function mapScenarioFrames(scenario, transform) {
  const result = { ...scenario };
  if (Object.hasOwn(scenario, 'trace')) {
    object(scenario.trace, 'trace');
    if (!Array.isArray(scenario.trace.frames)) fail('trace_frames');
    result.trace = { ...scenario.trace, frames: scenario.trace.frames.map(transform) };
  }
  if (Object.hasOwn(scenario, 'checkpoints')) {
    if (!Array.isArray(scenario.checkpoints)) fail('checkpoints');
    result.checkpoints = scenario.checkpoints.map((checkpoint) => {
      object(checkpoint, 'checkpoint');
      return { ...checkpoint, frame: transform(checkpoint.frame) };
    });
  }
  return result;
}
function mapJournal(frame, transform) {
  object(frame, 'frame');
  object(frame.observation, 'observation');
  if (!Object.hasOwn(frame.observation, 'eventJournal')) return frame;
  id(frame.ownerId, 'owner_id');
  object(frame.observation.eventJournal, 'journal');
  return { ...frame, observation: { ...frame.observation,
    eventJournal: transform(frame.observation.eventJournal, frame.ownerId) } };
}

/** Stores each immutable event once per scenario and owner lifetime sequence.
 * Restart epochs stay in their original records. Capture times, visible tail
 * ranges and all overflow/reset metadata remain on each original frame.
 */
export function encodeFlowMeasuredReport(report) {
  const scenarios = scenariosOf(report);
  if (Object.hasOwn(report, 'journalEncoding')) fail('already_encoded');
  const tables = [];
  const encodedScenarios = scenarios.map((scenario) => {
    const owners = new Map();
    const encoded = mapScenarioFrames(scenario, (frame) => mapJournal(frame, (journal, ownerId) => {
      if (Object.hasOwn(journal, 'eventRange') || !Array.isArray(journal.events)) fail('raw_event_array_required');
      if (!owners.has(ownerId)) owners.set(ownerId, new Map());
      const events = owners.get(ownerId);
      let firstSequence = null;
      for (const [index, event] of journal.events.entries()) {
        object(event, 'event'); sequence(event.sequence, 'event_sequence');
        if (index === 0) firstSequence = event.sequence;
        else if (event.sequence !== firstSequence + index) fail('noncontiguous_journal');
        if (events.has(event.sequence)) {
          if (!sameValue(events.get(event.sequence), event)) fail('conflicting_owner_sequence');
        } else events.set(event.sequence, structuredClone(event));
      }
      if (journal.firstSequence !== firstSequence) fail('journal_first_sequence');
      const { events: ignored, ...metadata } = journal;
      return { ...metadata, eventRange: { firstSequence, count: journal.events.length } };
    }));
    tables.push({ scenarioId: scenario.id, owners: [...owners].map(([ownerId, events]) => ({
      ownerId, events: [...events.values()].sort((a, b) => a.sequence - b.sequence),
    })) });
    return encoded;
  });
  return { ...report, ...(Object.hasOwn(report, 'scenarios') ? { scenarios: encodedScenarios } : {}),
    journalEncoding: { ...FLOW_MEASURED_JOURNAL_ENCODING, scenarios: tables } };
}

/** Explicit decoder for archived report tooling. This does not accept a raw
 * report as an alternate input, and missing references fail instead of creating
 * events. Recovered frames contain exactly their original retained window.
 */
export function decodeFlowMeasuredReport(encoded) {
  const scenarios = scenariosOf(encoded);
  const encoding = encoded.journalEncoding;
  object(encoding, 'encoding_required');
  if (encoding.version !== FLOW_MEASURED_JOURNAL_ENCODING.version
    || encoding.format !== FLOW_MEASURED_JOURNAL_ENCODING.format || !Array.isArray(encoding.scenarios)
    || encoding.scenarios.length !== scenarios.length) fail('encoding_contract');
  const tables = new Map();
  for (const table of encoding.scenarios) {
    object(table, 'scenario_table'); id(table.scenarioId, 'table_scenario_id');
    if (tables.has(table.scenarioId) || !scenarios.some((scenario) => scenario.id === table.scenarioId)
      || !Array.isArray(table.owners)) fail('scenario_table_identity');
    const owners = new Map();
    for (const owner of table.owners) {
      object(owner, 'owner_table'); id(owner.ownerId, 'table_owner_id');
      if (owners.has(owner.ownerId) || !Array.isArray(owner.events)) fail('owner_table_identity');
      const events = new Map();
      for (const event of owner.events) {
        object(event, 'event'); sequence(event.sequence, 'event_sequence');
        if (events.has(event.sequence)) fail('duplicate_table_sequence');
        events.set(event.sequence, event);
      }
      owners.set(owner.ownerId, events);
    }
    tables.set(table.scenarioId, owners);
  }
  const decodedScenarios = scenarios.map((scenario) => mapScenarioFrames(scenario,
    (frame) => mapJournal(frame, (journal, ownerId) => {
      if (Object.hasOwn(journal, 'events')) fail('encoded_event_range_required');
      const range = journal.eventRange;
      object(range, 'event_range');
      if (Object.keys(range).length !== 2 || !Object.hasOwn(range, 'firstSequence') || !Object.hasOwn(range, 'count')
        || !Number.isSafeInteger(range.count) || range.count < 0) fail('event_range');
      if (range.count === 0) {
        if (range.firstSequence !== null) fail('empty_event_range');
      } else sequence(range.firstSequence, 'range_first_sequence');
      if (range.firstSequence !== journal.firstSequence) fail('range_metadata_mismatch');
      const pool = tables.get(scenario.id).get(ownerId);
      if (!pool || range.count > pool.size) fail('event_table_missing');
      const events = [];
      for (let index = 0; index < range.count; index += 1) {
        const event = pool.get(range.firstSequence + index);
        if (!event) fail('event_reference_missing');
        events.push(structuredClone(event));
      }
      const { eventRange: ignored, ...metadata } = journal;
      return { ...metadata, events };
    })));
  const { journalEncoding: ignored, ...report } = encoded;
  return { ...report, ...(Object.hasOwn(encoded, 'scenarios') ? { scenarios: decodedScenarios } : {}) };
}
