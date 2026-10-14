import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal,
} from '../localArea.js';
import { STORAGE_LOCAL_CACHE_KEYS } from '../storageKeyRegistry.js';

export const WORKER_RUNTIME_EVENT_STORAGE_KEY = STORAGE_LOCAL_CACHE_KEYS.WORKER_RUNTIME_EVENTS;
export const WORKER_RUNTIME_EVENTS_INVALID = 'WORKER_RUNTIME_EVENTS_INVALID';

function resolveMaxEvents(value, fallback = 200) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(20, Math.floor(numeric));
}

function hasOwnValue(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function isEventRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function createInvalidEventsError(reason) {
  return new Error(`${WORKER_RUNTIME_EVENTS_INVALID}:${reason}`);
}

export function requireWorkerRuntimeEvents(events, maxEvents = 200) {
  if (!Array.isArray(events)) {
    throw createInvalidEventsError('events');
  }
  for (let index = 0; index < events.length; index += 1) {
    if (!isEventRecord(events[index])) {
      throw createInvalidEventsError(`event:${index}`);
    }
  }
  return events.slice(-resolveMaxEvents(maxEvents));
}

export class WorkerRuntimeEventStore {
  static getInstance() {
    if (!WorkerRuntimeEventStore.instance) {
      WorkerRuntimeEventStore.instance = new WorkerRuntimeEventStore();
    }
    return WorkerRuntimeEventStore.instance;
  }

  constructor({
    storageKey = WORKER_RUNTIME_EVENT_STORAGE_KEY,
    maxEvents = 200,
  } = {}) {
    this.storageKey = storageKey || WORKER_RUNTIME_EVENT_STORAGE_KEY;
    this.maxEvents = resolveMaxEvents(maxEvents);
    this.operationTail = Promise.resolve();
    this.writeAdmissionOpen = true;
    this.quiescePromise = null;
  }

  enqueue(operation) {
    const pending = this.operationTail.then(operation, operation);
    this.operationTail = pending.catch(() => undefined);
    return pending;
  }

  assertWriteAdmission() {
    if (!this.writeAdmissionOpen) throw new Error('WORKER_RUNTIME_EVENTS_WRITE_ADMISSION_CLOSED');
  }

  async get() {
    return this.enqueue(async () => {
      const items = await readChromeStorageLocal([this.storageKey]);
      if (!hasOwnValue(items, this.storageKey)) return [];
      return requireWorkerRuntimeEvents(items[this.storageKey], this.maxEvents);
    });
  }

  async set(events = []) {
    this.assertWriteAdmission();
    const normalized = structuredClone(requireWorkerRuntimeEvents(events, this.maxEvents));
    return this.enqueue(async () => {
      if (!normalized.length) await removeChromeStorageLocal([this.storageKey]);
      else await writeChromeStorageLocal({ [this.storageKey]: normalized });
      return normalized;
    });
  }

  async clear() {
    this.assertWriteAdmission();
    return this.enqueue(async () => {
      await removeChromeStorageLocal([this.storageKey]);
      return [];
    });
  }

  quiesceForProfileMutation() {
    this.writeAdmissionOpen = false;
    this.quiescePromise ||= this.operationTail.then(() => Object.freeze({ quiesced: true }));
    return this.quiescePromise;
  }

  async clearForProfileMutation() {
    if (this.writeAdmissionOpen) throw new Error('WORKER_RUNTIME_EVENTS_CLEAR_REQUIRES_QUIESCE');
    await this.quiescePromise;
    return this.enqueue(async () => {
      await removeChromeStorageLocal([this.storageKey]);
      return [];
    });
  }
}

export default WorkerRuntimeEventStore;
