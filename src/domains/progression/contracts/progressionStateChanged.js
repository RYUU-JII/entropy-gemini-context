import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';

export function buildProgressionStateChangedMessage({ profileGeneration }) {
  if (typeof profileGeneration !== 'string' || !profileGeneration.trim()
      || profileGeneration.trim() !== profileGeneration) {
    throw new Error('PROGRESSION_STATE_CHANGED_GENERATION_REQUIRED');
  }
  return Object.freeze({ type: MESSAGE_TYPES.PROGRESSION_STATE_CHANGED, profileGeneration });
}

export function isProgressionStateChangedMessage(message) {
  return message !== null && typeof message === 'object' && !Array.isArray(message)
    && Object.keys(message).length === 2
    && message.type === MESSAGE_TYPES.PROGRESSION_STATE_CHANGED
    && typeof message.profileGeneration === 'string' && !!message.profileGeneration.trim()
    && message.profileGeneration.trim() === message.profileGeneration;
}
