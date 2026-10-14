import { MESSAGE_ACTIONS } from '../../../../../platform/messaging/messageTypes.js';
import {
  isTrustedExtensionTabSender,
  resolveSenderFrameId,
} from '../../../../../platform/security/senderTrust.js';

function requireServiceMethod(service, method, errorCode) {
  if (!service || typeof service[method] !== 'function') throw new Error(errorCode);
  return service[method].bind(service);
}

function resolveFailureCode(error, fallbackCode) {
  if (typeof error?.code === 'string' && error.code) return error.code;
  if (typeof error?.message === 'string' && error.message) return error.message;
  return fallbackCode;
}

function isTrustedTopFrameContentSender(sender) {
  return isTrustedExtensionTabSender(sender) && resolveSenderFrameId(sender) === 0;
}

function runRequest({
  sender,
  sendResponse,
  operation,
  fallbackError,
}) {
  if (!isTrustedTopFrameContentSender(sender)) {
    sendResponse?.({ success: false, error: 'UNTRUSTED_SENDER' });
    return false;
  }
  void Promise.resolve()
    .then(operation)
    .then((result) => sendResponse?.({ success: true, result }))
    .catch((error) => {
      sendResponse?.({
        success: false,
        error: resolveFailureCode(error, fallbackError),
      });
    });
  return true;
}

export function createFeedTopologyCertificateMessageRoutes({
  feedTopologyPersistentCertificationService,
} = {}) {
  const restoreSurface = requireServiceMethod(
    feedTopologyPersistentCertificationService,
    'restoreSurface',
    'FEED_TOPOLOGY_MESSAGE_RESTORE_OWNER_REQUIRED',
  );
  const commitObservation = requireServiceMethod(
    feedTopologyPersistentCertificationService,
    'commitObservation',
    'FEED_TOPOLOGY_MESSAGE_COMMIT_OWNER_REQUIRED',
  );
  return {
    actions: {
      [MESSAGE_ACTIONS.GET_FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT]: (
        message,
        sender,
        sendResponse,
      ) => runRequest({
        sender,
        sendResponse,
        operation: () => restoreSurface(message?.surface),
        fallbackError: 'FEED_TOPOLOGY_CERTIFICATE_RESTORE_FAILED',
      }),
      [MESSAGE_ACTIONS.COMMIT_FEED_TOPOLOGY_OBSERVATION]: (
        message,
        sender,
        sendResponse,
      ) => runRequest({
        sender,
        sendResponse,
        operation: () => commitObservation(message?.fact),
        fallbackError: 'FEED_TOPOLOGY_CERTIFICATE_COMMIT_FAILED',
      }),
    },
  };
}

export default createFeedTopologyCertificateMessageRoutes;
