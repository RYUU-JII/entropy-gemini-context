import { runtimeSendMessageReliable } from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import {
  SPECIAL_SESSION_DEFAULT_DURATION_MINUTES,
  normalizeSpecialSessionHosts,
} from '../../settings/config/specialSession.js';

async function sendSpecialSessionMessage(payload) {
  const delivery = await runtimeSendMessageReliable(payload, { timeoutMs: 8000 });
  if (!delivery.ok || !delivery.response?.success) {
    throw new Error(delivery.response?.error || delivery.error || 'SPECIAL_SESSION_REQUEST_FAILED');
  }
  if (!delivery.response.session || typeof delivery.response.session.active !== 'boolean') throw new Error('SPECIAL_SESSION_RESPONSE_INVALID');
  return delivery.response.session;
}

export function getSpecialSession() {
  return sendSpecialSessionMessage({
    action: MESSAGE_ACTIONS.GET_SPECIAL_SESSION,
  });
}

export function startSpecialSession({
  durationMinutes = SPECIAL_SESSION_DEFAULT_DURATION_MINUTES,
  temporaryAllowedHosts = [],
} = {}) {
  return sendSpecialSessionMessage({
    action: MESSAGE_ACTIONS.START_SPECIAL_SESSION,
    durationMinutes,
    temporaryAllowedHosts: normalizeSpecialSessionHosts(temporaryAllowedHosts),
  });
}

export function endSpecialSession(sessionId) {
  return sendSpecialSessionMessage({
    action: MESSAGE_ACTIONS.END_SPECIAL_SESSION,
    sessionId,
  });
}

export function addSpecialSessionTemporaryAllowedSite(hostname, sessionId) {
  return sendSpecialSessionMessage({
    action: MESSAGE_ACTIONS.ADD_SPECIAL_SESSION_TEMPORARY_ALLOWED_SITE,
    hostname,
    sessionId,
  });
}
