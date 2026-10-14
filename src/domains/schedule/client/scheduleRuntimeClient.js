import { runtimeSendMessageReliable } from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { requireScheduleRuntimeState } from '../contracts/scheduleRuntimeState.js';

async function request(payload) {
  const delivery = await runtimeSendMessageReliable(payload, { timeoutMs: 8000 });
  if (!delivery.ok || delivery.response?.success !== true) {
    throw new Error(delivery.response?.error || delivery.error || 'SCHEDULE_RUNTIME_REQUEST_FAILED');
  }
  return requireScheduleRuntimeState(delivery.response.state);
}
export const getScheduleRuntimeState = () => request({ action: MESSAGE_ACTIONS.GET_SCHEDULE_RUNTIME_STATE });
export const endScheduleOccurrence = (sessionId) => request({ action: MESSAGE_ACTIONS.END_SCHEDULE_OCCURRENCE, sessionId });
