import { MESSAGE_ACTIONS } from '../../../../../platform/messaging/messageTypes.js';
import {
  isTrustedExtensionPageSender,
  isTrustedExtensionTabSender,
  resolveSenderFrameId,
  resolveSenderPageUrl,
  resolveTrustedSenderTabId,
} from '../../../../../platform/security/senderTrust.js';

const RENDER_HOST_PATH = '/src/pages/nudge-render-host.html';

function sendFailure(sendResponse, error) {
  sendResponse?.({
    success: false,
    error: typeof error?.code === 'string' && error.code
      ? error.code
      : typeof error?.message === 'string' && error.message
        ? error.message
        : 'NUDGE_FRAME_HOST_CAPABILITY_REQUEST_FAILED',
  });
  return true;
}

function isTrustedTopFrameContentSender(sender) {
  return isTrustedExtensionTabSender(sender) && resolveSenderFrameId(sender) === 0;
}

function isTrustedRenderHostSender(sender, sessionId) {
  if (!isTrustedExtensionPageSender(sender)) return false;
  const senderTabId = resolveTrustedSenderTabId(sender);
  const senderFrameId = resolveSenderFrameId(sender);
  if (senderTabId === null || senderFrameId === null || senderFrameId <= 0) return false;
  try {
    const senderUrl = new URL(resolveSenderPageUrl(sender));
    return senderUrl.pathname === RENDER_HOST_PATH
      && senderUrl.searchParams.get('session') === sessionId;
  } catch (_error) {
    return false;
  }
}

export function createNudgeFrameHostCapabilityMessageRoutes({
  capabilityBroker,
} = {}) {
  if (
    !capabilityBroker
    || typeof capabilityBroker.issue !== 'function'
    || typeof capabilityBroker.consume !== 'function'
  ) {
    throw new Error('NUDGE_FRAME_HOST_CAPABILITY_BROKER_REQUIRED');
  }

  return {
    actions: {
      [MESSAGE_ACTIONS.ISSUE_NUDGE_FRAME_HOST_CAPABILITY]: (message, sender, sendResponse) => {
        if (!isTrustedTopFrameContentSender(sender)) {
          return sendFailure(sendResponse, new Error('NUDGE_FRAME_HOST_CAPABILITY_ISSUER_UNTRUSTED'));
        }
        try {
          const ticket = capabilityBroker.issue({
            sessionId: message?.sessionId,
            nonce: message?.nonce,
            tabId: resolveTrustedSenderTabId(sender),
          });
          sendResponse?.({ success: true, ticket });
          return true;
        } catch (error) {
          return sendFailure(sendResponse, error);
        }
      },
      [MESSAGE_ACTIONS.CONSUME_NUDGE_FRAME_HOST_CAPABILITY]: (message, sender, sendResponse) => {
        if (!isTrustedRenderHostSender(sender, message?.sessionId)) {
          return sendFailure(sendResponse, new Error('NUDGE_FRAME_HOST_CAPABILITY_CONSUMER_UNTRUSTED'));
        }
        try {
          const authorization = capabilityBroker.consume({
            sessionId: message?.sessionId,
            nonce: message?.nonce,
            capability: message?.capability,
            tabId: resolveTrustedSenderTabId(sender),
          });
          sendResponse?.({ success: true, authorization });
          return true;
        } catch (error) {
          return sendFailure(sendResponse, error);
        }
      },
    },
  };
}

export default createNudgeFrameHostCapabilityMessageRoutes;
