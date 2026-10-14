// Artifact admission boundary; source imports keep the canonical worker owners.
export const WORKER_RUNTIME_CONTROL_CHUNK_NAME = 'worker-runtime-control';

export const WORKER_RUNTIME_CONTROL_MODULES = Object.freeze([
  'src/platform/workers/runtime/AdmittedWorkerRuntimeSession.js',
  'src/platform/workers/runtime/WorkerExecutionController.js',
  'src/platform/workers/runtime/WorkerPool.js',
  'src/platform/workers/runtime/WorkerRequestClient.js',
  'src/platform/workers/runtime/WorkerRuntimeAdmissionController.js',
  'src/platform/workers/runtime/WorkerRuntimeRegistry.js',
  'src/platform/workers/runtime/WorkerSurfaceFailureTelemetry.js',
  'src/platform/workers/runtime/WorkerTaskQueue.js',
  'src/platform/workers/runtime/WorkerTelemetry.js',
  'src/platform/workers/runtime/config.js',
  'src/platform/workers/runtime/index.js',
  'src/platform/workers/runtime/types.js',
  'src/platform/storage/runtime/WorkerRuntimeEventRepository.js',
  'src/platform/storage/internal/chrome-storage/stores/WorkerRuntimeEventStore.js',
]);

export function resolveWorkerRuntimeManualChunk(id) {
  if (typeof id !== 'string') throw new TypeError('WORKER_RUNTIME_CHUNK_MODULE_ID_REQUIRED');
  const moduleId = id.replaceAll('\\', '/').split('?')[0];
  return WORKER_RUNTIME_CONTROL_MODULES.some(sourceId => (
    moduleId === sourceId || moduleId.endsWith(`/${sourceId}`)
  )) ? WORKER_RUNTIME_CONTROL_CHUNK_NAME : null;
}
