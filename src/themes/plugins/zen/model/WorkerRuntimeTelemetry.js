import {
    WORKER_RUNTIME_EVENT_TYPE,
    readWorkerRuntimeEvents,
    persistWorkerRuntimeEvents,
    recordWorkerRuntimeEvent,
    clearWorkerRuntimeEvents,
} from '../../../../platform/workers/runtime/WorkerTelemetry.js';
import { WORKER_RUNTIME_EVENT_STORAGE_KEY } from '../../../../platform/storage/runtime/WorkerRuntimeEventRepository.js';

export const ZEN_WORKER_RUNTIME_EVENT_STORAGE_KEY = WORKER_RUNTIME_EVENT_STORAGE_KEY;

export {
    WORKER_RUNTIME_EVENT_TYPE,
    readWorkerRuntimeEvents,
    persistWorkerRuntimeEvents,
    recordWorkerRuntimeEvent,
    clearWorkerRuntimeEvents,
};
