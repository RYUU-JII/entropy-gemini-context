import { MESSAGE_ACTIONS } from '../../../../../platform/messaging/messageTypes.js';
import { isTrustedExtensionPageSender, resolveSenderPageUrl } from '../../../../../platform/security/senderTrust.js';

const METHODS = Object.freeze({
  [MESSAGE_ACTIONS.GET_GUIDANCE_STATE]: 'readState', [MESSAGE_ACTIONS.CLAIM_GUIDANCE]: 'claim',
  [MESSAGE_ACTIONS.MARK_GUIDANCE_PRESENTED]: 'markPresented', [MESSAGE_ACTIONS.DISMISS_GUIDANCE]: 'dismiss',
  [MESSAGE_ACTIONS.COMPLETE_GUIDANCE]: 'complete', [MESSAGE_ACTIONS.RELEASE_GUIDANCE]: 'release',
  [MESSAGE_ACTIONS.RENEW_GUIDANCE]: 'renew', [MESSAGE_ACTIONS.PREPARE_FURIN_INSTALLATION]: 'prepareFurinInstallation',
  [MESSAGE_ACTIONS.RECORD_FURIN_INSTALLATION]: 'recordFurinInstallation',
});
export function createGuidanceMessageRoutes({ guidanceService } = {}) {
  for (const method of Object.values(METHODS)) {
    if (typeof guidanceService?.[method] !== 'function') throw new Error(`GUIDANCE_ROUTE_OWNER_REQUIRED:${method}`);
  }
  return { actions: Object.fromEntries(Object.entries(METHODS).map(([action, method]) => [action, (message, sender, sendResponse) => {
    let pathname;
    try { pathname = new URL(resolveSenderPageUrl(sender)).pathname; } catch { pathname = null; }
    if (!isTrustedExtensionPageSender(sender) || !['/src/pages/dashboard.html', '/src/pages/popup.html'].includes(pathname)) {
      sendResponse({ success: false, error: 'UNTRUSTED_SENDER' }); return false;
    }
    if (action !== MESSAGE_ACTIONS.GET_GUIDANCE_STATE && (typeof message.profileGeneration !== 'string' || !message.profileGeneration)) {
      sendResponse({ success: false, error: 'GUIDANCE_PROFILE_GENERATION_REQUIRED' }); return false;
    }
    const owner = JSON.stringify([pathname, sender.documentId, sender.tab?.id]);
    void guidanceService[method]({ ...message, owner }).then((result) => sendResponse({ success: true, result,
      profileGeneration: action === MESSAGE_ACTIONS.GET_GUIDANCE_STATE ? result.profileGeneration : message.profileGeneration,
    })).catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }])) };
}
