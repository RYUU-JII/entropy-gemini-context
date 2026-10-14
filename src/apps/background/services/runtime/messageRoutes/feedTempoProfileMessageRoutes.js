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

export function createFeedTempoProfileMessageRoutes({
  feedTempoPersistentProfileService,
} = {}) {
  const restoreSurface = requireServiceMethod(
    feedTempoPersistentProfileService,
    'restoreSurface',
    'FEED_TEMPO_MESSAGE_RESTORE_OWNER_REQUIRED',
  );
  const commitEpisode = requireServiceMethod(
    feedTempoPersistentProfileService,
    'commitEpisode',
    'FEED_TEMPO_MESSAGE_COMMIT_OWNER_REQUIRED',
  );
  return {
    actions: {
      [MESSAGE_ACTIONS.GET_FEED_TEMPO_PROFILE_CHECKPOINT]: (
        message,
        sender,
        sendResponse,
      ) => runRequest({
        sender,
        sendResponse,
        operation: () => restoreSurface(message?.surface, { sender }),
        fallbackError: 'FEED_TEMPO_PROFILE_RESTORE_FAILED',
      }),
      [MESSAGE_ACTIONS.COMMIT_FEED_TEMPO_PROFILE_EPISODE]: (
        message,
        sender,
        sendResponse,
      ) => runRequest({
        sender,
        sendResponse,
        operation: () => commitEpisode(message?.fact, { sender, historyAdmission: message?.historyAdmission }),
        fallbackError: 'FEED_TEMPO_PROFILE_COMMIT_FAILED',
      }),
    },
  };
}

export default createFeedTempoProfileMessageRoutes;
