import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import { runtimeSendMessageReliable } from '../../../platform/messaging/runtime/runtimeMessaging.js';
import { requireFrameMediaSupportSnapshot } from '../../nudge/media/frameMediaProtocol.js';

export async function getPopupMediaSupport(tabId, { sendMessage = runtimeSendMessageReliable } = {}) {
  if (!Number.isInteger(tabId) || tabId < 0) throw new Error('POPUP_MEDIA_SUPPORT_TAB_REQUIRED');
  const delivery = await sendMessage({
    type: MESSAGE_TYPES.GET_MEDIA_FRAME_SUPPORT, payload: { tabId },
  }, { timeoutMs: 5_000 });
  if (delivery?.ok !== true || delivery.response?.success !== true) {
    throw new Error(delivery?.response?.error || delivery?.error || 'POPUP_MEDIA_SUPPORT_QUERY_FAILED');
  }
  return requireFrameMediaSupportSnapshot(delivery.response.result);
}
