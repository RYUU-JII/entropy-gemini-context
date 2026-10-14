import {
  WORKER_RUNTIME_EVENT_STORAGE_KEY,
  requireWorkerRuntimeEvents,
} from '../internal/chrome-storage/stores/WorkerRuntimeEventStore.js';
import { getExtensionApi, getExtensionApiNamespace, isPromiseExtensionApiNamespace } from '../../extension/extensionApi.js';

export { WORKER_RUNTIME_EVENT_STORAGE_KEY };
export const WORKER_RUNTIME_EVENT_MESSAGE_TYPE = 'WORKER_RUNTIME_EVENT_CACHE';

let backgroundPersistencePort = null;

export function configureWorkerRuntimeEventPersistencePort(port) {
  if (!port || typeof port.request !== 'function') throw new Error('WORKER_RUNTIME_EVENTS_PERSISTENCE_PORT_REQUIRED');
  backgroundPersistencePort = port;
}

function sendRuntimeRequest(message) {
  if (backgroundPersistencePort) return backgroundPersistencePort.request(message);
  const api = getExtensionApi();
  if (typeof api?.runtime?.sendMessage !== 'function') {
    return Promise.reject(new Error('WORKER_RUNTIME_EVENTS_TRANSPORT_UNAVAILABLE'));
  }
  if (isPromiseExtensionApiNamespace(getExtensionApiNamespace())) return api.runtime.sendMessage(message);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
    const fail = (error) => { if (!settled) { settled = true; reject(error); } };
    try {
      const result = api.runtime.sendMessage(message, (response) => {
        const error = api.runtime.lastError;
        if (error) fail(new Error(error.message || 'WORKER_RUNTIME_EVENTS_TRANSPORT_FAILED'));
        else finish(response);
      });
      if (result && typeof result.then === 'function') result.then(finish, fail);
    } catch (error) { fail(error); }
  });
}

export function requireWorkerRuntimeEventGeneration(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw new Error('WORKER_RUNTIME_EVENTS_PROFILE_GENERATION_REQUIRED');
  }
  return value;
}

function requireResponse(response, operation, expectedGeneration = null) {
  if (response?.success === false && typeof response.error === 'string' && response.error) {
    const error = new Error(response.error);
    error.code = response.error;
    throw error;
  }
  if (response?.success !== true || response.type !== WORKER_RUNTIME_EVENT_MESSAGE_TYPE
    || response.operation !== operation) throw new Error('WORKER_RUNTIME_EVENTS_ACK_INVALID');
  const generation = requireWorkerRuntimeEventGeneration(response.profileGeneration);
  if (expectedGeneration !== null && generation !== expectedGeneration) {
    throw new Error('WORKER_RUNTIME_EVENTS_ACK_GENERATION_MISMATCH');
  }
  return response;
}

export class WorkerRuntimeEventRepository {
  constructor({ storageKey = WORKER_RUNTIME_EVENT_STORAGE_KEY, maxEvents = 200, request = sendRuntimeRequest } = {}) {
    if (storageKey !== WORKER_RUNTIME_EVENT_STORAGE_KEY) throw new Error('WORKER_RUNTIME_EVENTS_STORAGE_KEY_INVALID');
    if (typeof request !== 'function') throw new Error('WORKER_RUNTIME_EVENTS_REQUEST_PORT_REQUIRED');
    this.storageKey = storageKey;
    this.maxEvents = maxEvents;
    this.request = request;
    this.profileGenerationPromise = null;
  }

  static getInstance() {
    if (!WorkerRuntimeEventRepository.instance) WorkerRuntimeEventRepository.instance = new WorkerRuntimeEventRepository();
    return WorkerRuntimeEventRepository.instance;
  }

  captureWriteAdmission() {
    if (!this.profileGenerationPromise) {
      try {
        this.profileGenerationPromise = Promise.resolve(this.request({
          type: WORKER_RUNTIME_EVENT_MESSAGE_TYPE, operation: 'capture',
        })).then(response => requireResponse(response, 'capture').profileGeneration);
      } catch (error) { this.profileGenerationPromise = Promise.reject(error); }
      // The producer lifetime never rebinds old events to a later profile.
      void this.profileGenerationPromise.catch(() => undefined);
    }
    return this.profileGenerationPromise;
  }

  async execute(operation, { events, admission = this.captureWriteAdmission() } = {}) {
    const profileGeneration = requireWorkerRuntimeEventGeneration(await admission);
    const response = requireResponse(await this.request({
      type: WORKER_RUNTIME_EVENT_MESSAGE_TYPE, operation, profileGeneration,
      ...(operation === 'set' ? { events } : {}),
    }), operation, profileGeneration);
    return requireWorkerRuntimeEvents(response.events, this.maxEvents);
  }

  get() { return this.execute('get'); }
  async set(events = [], options = {}) {
    const captured = structuredClone(requireWorkerRuntimeEvents(events, this.maxEvents));
    return this.execute('set', { ...options, events: captured });
  }
  clear(options = {}) { return this.execute('clear', options); }
}

export default WorkerRuntimeEventRepository;
