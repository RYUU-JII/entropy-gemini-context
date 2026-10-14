import { MESSAGE_ACTIONS } from '../../../../../platform/messaging/messageTypes.js';
import {
  BUILD_ENABLE_VIDEO_SKIP_COOLDOWN,
} from '../../../../../platform/build/releaseCapabilities.js';
import {
  isTrustedExtensionTabSender,
  resolveSenderFrameId,
  resolveSenderPageUrl,
  resolveTrustedSenderTabId,
} from '../../../../../platform/security/senderTrust.js';

export function createVideoSkipPoolMessageRoutes({
  mergeVideoSkipPool,
  executeVideoSkipMainWorldCommand,
} = {}) {
  if (BUILD_ENABLE_VIDEO_SKIP_COOLDOWN && typeof mergeVideoSkipPool !== 'function') {
    throw new Error('VIDEO_SKIP_POOL_MESSAGE_ROUTE_MERGE_OWNER_REQUIRED');
  }
  if (typeof executeVideoSkipMainWorldCommand !== 'function') {
    throw new Error('VIDEO_SKIP_MAIN_WORLD_MESSAGE_ROUTE_OWNER_REQUIRED');
  }

  // The cooldown ledger is dormant unless the capability is on. Leaving the route
  // unregistered makes an unexpected merge fail loudly at the router rather than
  // resolving into a write nobody owns.
  const cooldownPoolActions = BUILD_ENABLE_VIDEO_SKIP_COOLDOWN
    ? {
      [MESSAGE_ACTIONS.MERGE_VIDEO_SKIP_POOL]: (message, sender, sendResponse) => {
        if (!isTrustedExtensionTabSender(sender)) {
          sendResponse?.({ success: false, error: 'UNTRUSTED_SENDER' });
          return false;
        }

        void mergeVideoSkipPool(message?.snapshot)
          .then((snapshot) => {
            sendResponse?.({ success: true, snapshot });
          })
          .catch((error) => {
            sendResponse?.({
              success: false,
              error: error?.message || 'VIDEO_SKIP_POOL_MERGE_FAILED',
            });
          });
        return true;
      },
    }
    : {};

  return {
    actions: {
      ...cooldownPoolActions,
      [MESSAGE_ACTIONS.EXECUTE_VIDEO_SKIP_MAIN_WORLD_COMMAND]: (message, sender, sendResponse) => {
        if (!isTrustedExtensionTabSender(sender)) {
          sendResponse?.({ success: false, error: 'UNTRUSTED_SENDER' });
          return false;
        }
        if (
          Object.prototype.hasOwnProperty.call(message || {}, 'targetTabId')
          || Object.prototype.hasOwnProperty.call(message || {}, 'targetFrameId')
          || Object.prototype.hasOwnProperty.call(message || {}, 'pageUrl')
          || Object.prototype.hasOwnProperty.call(message || {}, 'expectedHostname')
        ) {
          sendResponse?.({
            success: false,
            error: 'VIDEO_SKIP_MAIN_WORLD_TARGET_OVERRIDE_FORBIDDEN',
          });
          return false;
        }

        const tabId = resolveTrustedSenderTabId(sender);
        const frameId = resolveSenderFrameId(sender);
        const pageUrl = resolveSenderPageUrl(sender);
        if (tabId === null || frameId !== 0 || !pageUrl) {
          sendResponse?.({
            success: false,
            error: 'VIDEO_SKIP_MAIN_WORLD_SENDER_TARGET_INVALID',
          });
          return false;
        }

        void executeVideoSkipMainWorldCommand({
          tabId,
          frameId,
          pageUrl,
          command: message?.command,
          mediaToken: message?.mediaToken,
          ...(Object.prototype.hasOwnProperty.call(message || {}, 'targetTime')
            ? { targetTime: message.targetTime }
            : {}),
        })
          .then((result) => {
            sendResponse?.({ success: true, result });
          })
          .catch((error) => {
            sendResponse?.({
              success: false,
              error: error?.message || 'VIDEO_SKIP_MAIN_WORLD_COMMAND_FAILED',
            });
          });
        return true;
      },
    },
  };
}

export default createVideoSkipPoolMessageRoutes;
