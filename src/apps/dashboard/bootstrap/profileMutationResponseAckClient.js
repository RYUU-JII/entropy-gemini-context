import {
  runtimeCanSendMessage,
  runtimeSendMessage,
} from '../../../platform/chrome/ChromeService.js';
import {
  createProfileMutationResponseHandoffFromLifecycle,
  normalizeProfileMutationResponseHandoff,
} from '../../../platform/messaging/contracts/profileMutationResponseHandoff.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';

function createProfileMutationResponseAckClientError(code, cause = null) {
  const error = new Error(code);
  error.code = code;
  if (cause !== null) error.cause = cause;
  return error;
}

function dispatchProfileMutationAck({ profileMutationHandoff, canSendMessage, sendMessage }) {
  let canStart = false;
  try {
    canStart = typeof canSendMessage === 'function' && canSendMessage() === true;
  } catch (cause) {
    throw createProfileMutationResponseAckClientError(
      'PROFILE_MUTATION_RESPONSE_ACK_START_FAILED',
      cause,
    );
  }
  if (!canStart || typeof sendMessage !== 'function') {
    throw createProfileMutationResponseAckClientError(
      'PROFILE_MUTATION_RESPONSE_ACK_START_FAILED',
    );
  }

  let acknowledgementTask;
  try {
    acknowledgementTask = sendMessage({
      action: MESSAGE_ACTIONS.PROFILE_MUTATION_RESPONSE_ACK,
      profileMutationHandoff,
    });
  } catch (cause) {
    throw createProfileMutationResponseAckClientError(
      'PROFILE_MUTATION_RESPONSE_ACK_START_FAILED',
      cause,
    );
  }
  if (!acknowledgementTask || typeof acknowledgementTask.then !== 'function') {
    throw createProfileMutationResponseAckClientError(
      'PROFILE_MUTATION_RESPONSE_ACK_START_FAILED',
    );
  }
  return acknowledgementTask;
}

export function startProfileMutationResponseAck({
  response,
  canSendMessage = runtimeCanSendMessage,
  sendMessage = runtimeSendMessage,
} = {}) {
  if (response?.success !== true) {
    throw createProfileMutationResponseAckClientError(
      'PROFILE_MUTATION_RESPONSE_ACK_SUCCESS_RESPONSE_REQUIRED',
    );
  }
  const profileMutationHandoff = normalizeProfileMutationResponseHandoff(
    response.profileMutationHandoff,
  );
  const acknowledgementTask = dispatchProfileMutationAck({
    profileMutationHandoff, canSendMessage, sendMessage,
  });

  // The original mutation response has already settled before this function is
  // called. Receipt of this ACK is the terminal signal, so runtime reload may
  // invalidate its return channel. Only synchronous dispatch start is owned by
  // the Dashboard; post-start rejection is not a second success criterion.
  void Promise.resolve(acknowledgementTask).catch(() => undefined);
  return Object.freeze({
    started: true,
    profileMutationHandoff,
  });
}

export function startProfileMutationLifecycleAck({
  lifecycle,
  onRejected,
  canSendMessage = runtimeCanSendMessage,
  sendMessage = runtimeSendMessage,
} = {}) {
  if (typeof onRejected !== 'function') {
    throw createProfileMutationResponseAckClientError('PROFILE_MUTATION_RESPONSE_ACK_REJECTION_OWNER_REQUIRED');
  }
  const profileMutationHandoff = createProfileMutationResponseHandoffFromLifecycle(
    lifecycle, { expectedOperation: lifecycle?.operation },
  );
  const acknowledgementTask = dispatchProfileMutationAck({
    profileMutationHandoff, canSendMessage, sendMessage,
  });
  // COMPLETE is the durable receipt after document re-entry. The background
  // still validates the exact lifecycle and sealed local runtime gate. An
  // explicit negative ACK is actionable; reload can invalidate the channel
  // after an accepted ACK, which does not undo the committed mutation.
  void Promise.resolve(acknowledgementTask).then((response) => {
    if (response?.success !== false) return;
    const code = typeof response.error === 'string' && response.error.trim()
      ? response.error : 'PROFILE_MUTATION_RESPONSE_ACK_RESPONSE_INVALID';
    onRejected(createProfileMutationResponseAckClientError(code));
  }, () => undefined);
  return Object.freeze({ started: true, profileMutationHandoff });
}

export default startProfileMutationResponseAck;
