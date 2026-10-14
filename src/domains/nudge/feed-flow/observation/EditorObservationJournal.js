import { BoundedObservationJournal } from '../../../../lib/BoundedObservationJournal.js';

export const EDITOR_OBSERVATION_CAPACITY = 256;
const fail = (detail) => { throw new Error(`EDITOR_OBSERVATION_INVALID:${detail}`); };
export function copyEditorObservationEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) fail('event');
  const kind = Object.getOwnPropertyDescriptor(event, 'kind');
  if (!kind || !Object.hasOwn(kind, 'value')) fail('kind');
  const expected = kind.value === 'editor_state' ? ['kind', 'at', 'available', 'focused']
    : kind.value === 'input_activity' ? ['kind', 'at'] : null;
  if (expected === null || Reflect.ownKeys(event).length !== expected.length) fail('keys');
  for (const key of Reflect.ownKeys(event)) {
    const descriptor = Object.getOwnPropertyDescriptor(event, key);
    if (!expected.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('keys');
  }
  if (!Number.isFinite(event.at) || event.at < 0 || event.at > Number.MAX_SAFE_INTEGER) fail('at');
  if (event.kind === 'editor_state' && (typeof event.available !== 'boolean'
    || (event.available ? typeof event.focused !== 'boolean' : event.focused !== null))) fail('state');
  return { ...event };
}
function copyRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail('record');
  for (const key of Reflect.ownKeys(record)) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('record_properties');
  }
  const { epoch, ...event } = record;
  if (!Number.isSafeInteger(epoch) || epoch < 1) fail('epoch');
  return { ...copyEditorObservationEvent(event), epoch };
}
export class EditorObservationJournal extends BoundedObservationJournal {
  constructor({ capacity = EDITOR_OBSERVATION_CAPACITY } = {}) {
    super({ capacity, maximumCapacity: EDITOR_OBSERVATION_CAPACITY, copyRecord, fail });
  }
}

// A content-local memory channel. Permission does not create demand; a running
// capture and explicit permission are both required. No text/target is retained.
export class EditorObservationChannel {
  constructor() {
    this._journal = new EditorObservationJournal();
    this._allowed = false; this._active = false; this._epoch = 0; this._at = null;
    this._state = { available: false, focused: null };
  }
  _time(at) {
    if (!Number.isFinite(at) || at < 0 || at > Number.MAX_SAFE_INTEGER
      || (this._at !== null && at < this._at)) fail('clock');
    this._at = at;
  }
  get enabled() { return this._active && this._allowed; }
  setAllowed(allowed, at) {
    if (typeof allowed !== 'boolean') fail('permission');
    this._time(at);
    if (allowed === this._allowed) return;
    this._allowed = allowed;
    this._epoch += 1;
    this._journal.reset();
    this._state = { available: false, focused: null };
  }
  start(at) {
    this._time(at);
    if (this._active) return;
    this._active = true; this._epoch += 1;
    this._journal.reset(); this._state = { available: false, focused: null };
  }
  stop(at) {
    this._time(at);
    this._active = false; this._journal.reset();
    this._state = { available: false, focused: null };
  }
  recordState({ available, focused }, at) {
    if (!this._active || !this._allowed) return;
    const event = copyEditorObservationEvent({ kind: 'editor_state', at, available, focused });
    this._time(at); this._state = { available, focused };
    this._journal.append({ ...event, epoch: this._epoch });
  }
  recordInput(at) {
    if (!this._active || !this._allowed || !this._state.available) return;
    this._time(at);
    this._journal.append({ kind: 'input_activity', at, epoch: this._epoch });
  }
  getSnapshot() {
    return { version: 1, allowed: this._allowed, active: this._active && this._allowed,
      epoch: this._epoch, at: this._at, state: { ...this._state },
      source: 'unknown', eventJournal: this._journal.getSnapshot() };
  }
}
