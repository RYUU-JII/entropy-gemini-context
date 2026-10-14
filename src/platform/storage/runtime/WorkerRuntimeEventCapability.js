import WorkerRuntimeEventStore, { requireWorkerRuntimeEvents } from '../internal/chrome-storage/stores/WorkerRuntimeEventStore.js';
import { resolveProfileResetGeneration } from './ProfileResetLifecycleRepository.js';
import {
  WORKER_RUNTIME_EVENT_MESSAGE_TYPE,
  WORKER_RUNTIME_EVENT_STORAGE_KEY,
  requireWorkerRuntimeEventGeneration,
} from './WorkerRuntimeEventRepository.js';

export { WORKER_RUNTIME_EVENT_STORAGE_KEY };

export function createWorkerRuntimeEventCapability({ runtimeAdmissionGate, lifecycleRepository,
  workerRuntimeEventStore = new WorkerRuntimeEventStore(), quiesceLocalTelemetry } = {}) {
  if (typeof runtimeAdmissionGate?.runAdmitted !== 'function') throw new Error('WORKER_RUNTIME_EVENTS_RUNTIME_GATE_REQUIRED');
  if (typeof lifecycleRepository?.read !== 'function' || typeof lifecycleRepository?.assertWriteAdmission !== 'function') {
    throw new Error('WORKER_RUNTIME_EVENTS_LIFECYCLE_OWNER_REQUIRED');
  }
  if (typeof quiesceLocalTelemetry !== 'function') throw new Error('WORKER_RUNTIME_EVENTS_TELEMETRY_QUIESCE_REQUIRED');
  let phase = 'open';
  let quiescePromise = null;

  async function handleAdmittedRequest(message) {
    if (phase !== 'open') throw new Error('WORKER_RUNTIME_EVENTS_WRITE_ADMISSION_CLOSED');
    const operation = message?.operation;
    if (message?.type !== WORKER_RUNTIME_EVENT_MESSAGE_TYPE
      || !['capture', 'get', 'set', 'clear'].includes(operation)) throw new Error('WORKER_RUNTIME_EVENTS_REQUEST_INVALID');
    const expectedKeys = operation === 'capture' ? ['type', 'operation']
      : operation === 'set' ? ['type', 'operation', 'profileGeneration', 'events']
        : ['type', 'operation', 'profileGeneration'];
    if (Object.keys(message).length !== expectedKeys.length
      || Object.keys(message).some(key => !expectedKeys.includes(key))) throw new Error('WORKER_RUNTIME_EVENTS_REQUEST_INVALID');
    const events = operation === 'set' ? structuredClone(requireWorkerRuntimeEvents(message.events)) : null;
    const generation = resolveProfileResetGeneration(await lifecycleRepository.read());
    if (operation !== 'capture' && requireWorkerRuntimeEventGeneration(message.profileGeneration) !== generation) {
      throw new Error('WORKER_RUNTIME_EVENTS_PROFILE_GENERATION_STALE');
    }
    await lifecycleRepository.assertWriteAdmission({ expectedResetId: generation });
    if (phase !== 'open') throw new Error('WORKER_RUNTIME_EVENTS_WRITE_ADMISSION_CLOSED');
    const response = { success: true, type: WORKER_RUNTIME_EVENT_MESSAGE_TYPE, operation, profileGeneration: generation };
    if (operation === 'get') response.events = await workerRuntimeEventStore.get();
    if (operation === 'set') response.events = await workerRuntimeEventStore.set(events);
    if (operation === 'clear') response.events = await workerRuntimeEventStore.clear();
    return response;
  }

  function request(message) {
    return runtimeAdmissionGate.runAdmitted({
      label: `worker_runtime_events:${message?.operation}`, task: () => handleAdmittedRequest(message),
    });
  }

  function quiesceForProfileMutation() {
    if (quiescePromise) return quiescePromise;
    phase = 'quiescing';
    quiescePromise = (async () => {
      const results = await Promise.allSettled([
        Promise.resolve().then(quiesceLocalTelemetry),
        Promise.resolve().then(() => workerRuntimeEventStore.quiesceForProfileMutation()),
      ]);
      const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
      if (failures.length) { phase = 'failed'; quiescePromise = null; throw new AggregateError(failures, 'WORKER_RUNTIME_EVENTS_QUIESCE_FAILED'); }
      phase = 'quiesced';
      return Object.freeze({ quiesced: true });
    })();
    return quiescePromise;
  }

  async function clearForProfileMutation() {
    if (phase !== 'quiesced') throw new Error('WORKER_RUNTIME_EVENTS_CLEAR_REQUIRES_QUIESCE');
    return workerRuntimeEventStore.clearForProfileMutation();
  }

  return Object.freeze({ request, handleAdmittedRequest, quiesceForProfileMutation, clearForProfileMutation });
}
