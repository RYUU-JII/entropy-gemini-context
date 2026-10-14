import { MESSAGE_TYPES } from '../../../../platform/messaging/messageTypes.js';

export function isProtectionUpdateMessage(request) {
  if (!request || typeof request !== 'object') return false;
  return request.type === MESSAGE_TYPES.PROTECTION_UPDATE;
}
