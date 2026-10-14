// Pure bounded chronology shared by typed observation journals. Record schemas,
// capacity policies and errors belong to the typed owners supplied at creation.
export class BoundedObservationJournal {
  constructor({ capacity, maximumCapacity, copyRecord, fail }) {
    if (typeof copyRecord !== "function" || typeof fail !== "function") throw new Error("OBSERVATION_JOURNAL_OWNERS_REQUIRED");
    this._copyRecord = copyRecord;
    this._fail = fail;
    if (!Number.isSafeInteger(maximumCapacity) || maximumCapacity < 1
      || !Number.isSafeInteger(capacity) || capacity < 1 || capacity > maximumCapacity) this._fail('capacity');
    this._capacity = capacity;
    this._events = [];
    this._lastSequence = 0;
    this._lastAt = null;
    this._lastEpoch = null;
    this._overflowDroppedEvents = 0;
    this._resetDiscardedEvents = 0;
  }

  append(record) {
    const copy = this._copyRecord(record);
    if (this._lastAt !== null && copy.at < this._lastAt) this._fail('time_reversed');
    if (this._lastEpoch !== null && copy.epoch < this._lastEpoch) this._fail('epoch_reversed');
    if (this._lastSequence === Number.MAX_SAFE_INTEGER) this._fail('sequence_exhausted');
    const event = Object.freeze({ sequence: this._lastSequence + 1, ...copy });
    this._events.push(event);
    this._lastSequence = event.sequence;
    this._lastAt = event.at;
    this._lastEpoch = event.epoch;
    if (this._events.length > this._capacity) {
      this._events.shift();
      this._overflowDroppedEvents += 1;
    }
    return event;
  }

  reset() {
    this._resetDiscardedEvents += this._events.length;
    this._events = [];
    return this.getSnapshot();
  }

  getSnapshot() {
    return Object.freeze({ version: 1, capacity: this._capacity,
      firstSequence: this._events.length ? this._events[0].sequence : null,
      lastSequence: this._lastSequence,
      droppedEvents: this._overflowDroppedEvents + this._resetDiscardedEvents,
      overflowDroppedEvents: this._overflowDroppedEvents, resetDiscardedEvents: this._resetDiscardedEvents,
      events: Object.freeze([...this._events]) });
  }

  readSince(afterSequence) {
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0 || afterSequence > this._lastSequence) this._fail('cursor');
    const snapshot = this.getSnapshot();
    const missingEvents = snapshot.firstSequence === null
      ? this._lastSequence - afterSequence
      : Math.max(0, snapshot.firstSequence - afterSequence - 1);
    return Object.freeze({ ...snapshot, afterSequence, cursorGap: missingEvents > 0, missingEvents,
      events: Object.freeze(this._events.filter((event) => event.sequence > afterSequence)) });
  }
}
