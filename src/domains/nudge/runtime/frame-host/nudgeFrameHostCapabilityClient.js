import { runtimeSendMessageReliable } from '../../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { NUDGE_FRAME_HOST_CAPABILITY_CONTRACT } from '../NudgeExtensionFrameWorkerProbeProtocol.js';

const CAPABILITY_REQUEST_TIMEOUT_MS = 1800;

function createClientError(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  return error;
}

function requireTicket(response, sessionId) {
  const ticket = response?.ticket;
  if (
    response?.success !== true
    || ticket?.contract !== NUDGE_FRAME_HOST_CAPABILITY_CONTRACT
    || ticket?.sessionId !== sessionId
    || typeof ticket?.capability !== 'string'
    || !ticket.capability
    || !Number.isFinite(Number(ticket?.expiresAtMs))
  ) {
    throw createClientError(
      response?.error || 'NUDGE_FRAME_HOST_CAPABILITY_ISSUE_RESPONSE_INVALID',
    );
  }
  return ticket;
}

function requireAuthorization(response, sessionId) {
  const authorization = response?.authorization;
  if (
    response?.success !== true
    || authorization?.contract !== NUDGE_FRAME_HOST_CAPABILITY_CONTRACT
    || authorization?.sessionId !== sessionId
    || authorization?.authorized !== true
  ) {
    throw createClientError(
      response?.error || 'NUDGE_FRAME_HOST_CAPABILITY_CONSUME_RESPONSE_INVALID',
    );
  }
  return authorization;
}

async function requestCapability(message, {
  sendMessage = runtimeSendMessageReliable,
  timeoutMs = CAPABILITY_REQUEST_TIMEOUT_MS,
} = {}) {
  if (typeof sendMessage !== 'function') {
    throw createClientError('NUDGE_FRAME_HOST_CAPABILITY_TRANSPORT_REQUIRED');
  }
  const delivery = await sendMessage(message, { timeoutMs });
  if (delivery?.ok !== true) {
    throw createClientError(
      'NUDGE_FRAME_HOST_CAPABILITY_TRANSPORT_FAILED',
      String(delivery?.error || 'unknown'),
    );
  }
  return delivery.response;
}

export async function issueNudgeFrameHostCapability({ sessionId, nonce } = {}, options = {}) {
  const response = await requestCapability({
    action: MESSAGE_ACTIONS.ISSUE_NUDGE_FRAME_HOST_CAPABILITY,
    sessionId,
    nonce,
  }, options);
  return requireTicket(response, sessionId);
}

export async function consumeNudgeFrameHostCapability({
  sessionId,
  nonce,
  capability,
} = {}, options = {}) {
  const response = await requestCapability({
    action: MESSAGE_ACTIONS.CONSUME_NUDGE_FRAME_HOST_CAPABILITY,
    sessionId,
    nonce,
    capability,
  }, options);
  return requireAuthorization(response, sessionId);
}
