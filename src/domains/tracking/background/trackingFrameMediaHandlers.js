import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import { isTrustedExtensionTabSender, isTrustedExtensionPageSender,
  resolveSenderDocumentId, resolveSenderFrameId, resolveSenderPageUrl,
  resolveTrustedSenderTabId } from '../../../platform/security/senderTrust.js';

function contextFor(sender, child, exiting = false) {
  if (!isTrustedExtensionTabSender(sender)) throw new Error('FRAME_MEDIA_TRUSTED_TAB_REQUIRED');
  const tabId = resolveTrustedSenderTabId(sender);
  const frameId = resolveSenderFrameId(sender);
  const documentId = resolveSenderDocumentId(sender);
  const url = resolveSenderPageUrl(sender);
  if (tabId === null || frameId === null || !documentId
    || (child ? frameId === 0 : frameId !== 0)) throw new Error('FRAME_MEDIA_SENDER_DOCUMENT_INVALID');
  if (!exiting && sender.documentLifecycle && sender.documentLifecycle !== 'active') throw new Error('FRAME_MEDIA_DOCUMENT_INACTIVE');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('FRAME_MEDIA_SENDER_URL_INVALID'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('FRAME_MEDIA_SENDER_URL_INVALID');
  return { tabId, frameId, documentId, url: parsed.href };
}

export function createTrackingFrameMediaHandlers({ contentScriptOrchestrator } = {}) {
  const owner = () => {
    if (typeof contentScriptOrchestrator?.getFrameMediaControl !== 'function') throw new Error('FRAME_MEDIA_CONTROL_OWNER_REQUIRED');
    return contentScriptOrchestrator.getFrameMediaControl();
  };
  function route(operation) {
    return (request, sender, sendResponse) => {
      Promise.resolve().then(() => operation(request, sender, sendResponse))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    };
  }
  return {
    [MESSAGE_TYPES.CONTENT_MEDIA_FRAME_CONTROL_EXIT]: route((request, sender, sendResponse) => {
      sendResponse(owner().exited(contextFor(sender, true, true), request.payload));
    }),
    [MESSAGE_TYPES.CONTENT_MEDIA_FRAME_CONTROL_READY]: route((request, sender, sendResponse) => {
      const context = contextFor(sender, true);
      const broker = owner();
      sendResponse(broker.ready(context, request.payload));
      // READY must reach the receiver before its first document-addressed command.
      setTimeout(() => {
        void broker.activateReady(context).catch(error => console.warn('[FrameMedia] READY activation failed', error.message));
      }, 0);
    }),
    [MESSAGE_TYPES.CONTENT_MEDIA_FRAME_HOLD]: route(async (request, sender, sendResponse) => {
      const cleanupOnly = request.payload?.action === 'end' && request.payload?.resume === false;
      const result = await owner().hold(contextFor(sender, false, cleanupOnly), request.payload);
      sendResponse({ success: true, result });
    }),
    [MESSAGE_TYPES.GET_MEDIA_FRAME_SUPPORT]: route(async (request, sender, sendResponse) => {
      if (!isTrustedExtensionPageSender(sender)) throw new Error('FRAME_MEDIA_EXTENSION_PAGE_REQUIRED');
      const tabId = request.payload?.tabId;
      if (!Number.isSafeInteger(tabId) || tabId < 0) throw new Error('FRAME_MEDIA_TAB_REQUIRED');
      sendResponse({ success: true, result: await owner().support(tabId) });
    }),
  };
}
