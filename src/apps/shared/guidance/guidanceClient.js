import { runtimeSendMessage } from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';

let boundProfileGeneration = null;
async function request(action, payload = {}) {
  const response = await runtimeSendMessage({ action, ...payload,
    ...(boundProfileGeneration === null ? {} : { profileGeneration: boundProfileGeneration }) });
  if (response?.success !== true) throw new Error(response?.error || 'GUIDANCE_REQUEST_FAILED');
  if (typeof response.profileGeneration !== 'string' || !response.profileGeneration) throw new Error('GUIDANCE_RESPONSE_GENERATION_INVALID');
  if (boundProfileGeneration === null) boundProfileGeneration = response.profileGeneration;
  if (response.profileGeneration !== boundProfileGeneration) throw new Error('GUIDANCE_PROFILE_GENERATION_STALE');
  return response.result;
}
export function readState(payload = {}) { return request(MESSAGE_ACTIONS.GET_GUIDANCE_STATE, payload); }
async function mutate(action, payload) {
  if (boundProfileGeneration === null) await readState();
  return request(action, payload);
}
export const claim = (payload) => mutate(MESSAGE_ACTIONS.CLAIM_GUIDANCE, payload);
export const markPresented = (payload) => mutate(MESSAGE_ACTIONS.MARK_GUIDANCE_PRESENTED, payload);
export const dismiss = (payload) => mutate(MESSAGE_ACTIONS.DISMISS_GUIDANCE, payload);
export const complete = (payload) => mutate(MESSAGE_ACTIONS.COMPLETE_GUIDANCE, payload);
export const release = (payload) => mutate(MESSAGE_ACTIONS.RELEASE_GUIDANCE, payload);
export const renew = (payload) => mutate(MESSAGE_ACTIONS.RENEW_GUIDANCE, payload);
export const prepareFurinInstallation = (payload) => mutate(MESSAGE_ACTIONS.PREPARE_FURIN_INSTALLATION, payload);
export const recordFurinInstallation = (payload) => mutate(MESSAGE_ACTIONS.RECORD_FURIN_INSTALLATION, payload);
export const guidanceClient = Object.freeze({ readState, claim, markPresented, dismiss, complete, release, renew,
  prepareFurinInstallation, recordFurinInstallation });
