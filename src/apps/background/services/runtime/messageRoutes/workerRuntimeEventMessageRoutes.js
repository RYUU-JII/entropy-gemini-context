import { WORKER_RUNTIME_EVENT_MESSAGE_TYPE } from '../../../../../platform/storage/runtime/WorkerRuntimeEventRepository.js';
import { isTrustedExtensionPageSender } from '../../../../../platform/security/senderTrust.js';

export function createWorkerRuntimeEventMessageRoutes({ workerRuntimeEventCapability } = {}) {
  if (typeof workerRuntimeEventCapability?.handleAdmittedRequest !== 'function') {
    throw new Error('WORKER_RUNTIME_EVENTS_MESSAGE_OWNER_REQUIRED');
  }
  return { types: {
    [WORKER_RUNTIME_EVENT_MESSAGE_TYPE]: (message, sender, sendResponse) => {
      if (!isTrustedExtensionPageSender(sender)) {
        sendResponse?.({ success: false, error: 'WORKER_RUNTIME_EVENTS_UNTRUSTED_SENDER' });
        return true;
      }
      Promise.resolve().then(() => workerRuntimeEventCapability.handleAdmittedRequest(message)).then(
        result => sendResponse?.(result),
        error => sendResponse?.({ success: false, error: error?.code || error?.message || 'WORKER_RUNTIME_EVENTS_REQUEST_FAILED' }),
      );
      return true;
    },
  } };
}
