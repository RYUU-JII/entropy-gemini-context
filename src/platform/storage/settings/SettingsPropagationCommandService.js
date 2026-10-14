import { runtimeSendMessageReliable } from '../../chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../messaging/contracts/messageTypes.js';
import {
  SETTINGS_PROPAGATION_DELIVERY_TIMEOUT_MS,
  requireSettingsPropagationRetryKeys,
  requireSettingsPropagationRetryResult,
  requireSettingsPropagationWaitReceipt,
  requireSettingsPropagationWaitRequest,
  requireSettingsPropagationWaitResult,
} from '../../../domains/settings/config/settingsPropagationCommandContract.js';

export async function retrySettingsPropagationViaRuntime(keys, {
  expectedProfileGeneration,
  timeoutMs = SETTINGS_PROPAGATION_DELIVERY_TIMEOUT_MS,
  sendMessage = runtimeSendMessageReliable,
} = {}) {
  if (typeof expectedProfileGeneration !== 'string' || !expectedProfileGeneration.trim()
    || expectedProfileGeneration.trim() !== expectedProfileGeneration) {
    throw new Error('SETTINGS_EXPECTED_PROFILE_GENERATION_INVALID');
  }
  const retryKeys = requireSettingsPropagationRetryKeys(keys);
  const delivery = await sendMessage({
    action: MESSAGE_ACTIONS.RETRY_SETTINGS_PROPAGATION,
    keys: retryKeys,
    expectedProfileGeneration,
  }, { timeoutMs });
  if (delivery?.ok !== true) {
    const error = new Error(delivery?.error || 'SETTINGS_PROPAGATION_DELIVERY_FAILED');
    error.code = error.message;
    throw error;
  }
  const response = delivery.response;
  if (response?.success !== true && !response?.propagation) {
    throw new Error(response?.error || 'SETTINGS_PROPAGATION_RETRY_FAILED');
  }
  const result = requireSettingsPropagationRetryResult(response);
  if (retryKeys.some((key) => !result.changedKeys.includes(key))) {
    throw new Error('SETTINGS_PROPAGATION_RETRY_ACK_INVALID');
  }
  return result;
}

export async function waitForSettingsPropagationViaRuntime(receipt, {
  expectedProfileGeneration,
  timeoutMs = SETTINGS_PROPAGATION_DELIVERY_TIMEOUT_MS,
  sendMessage = runtimeSendMessageReliable,
} = {}) {
  if (typeof expectedProfileGeneration !== 'string' || !expectedProfileGeneration.trim()
    || expectedProfileGeneration.trim() !== expectedProfileGeneration) {
    throw new Error('SETTINGS_EXPECTED_PROFILE_GENERATION_INVALID');
  }
  requireSettingsPropagationWaitReceipt(receipt);
  const request = requireSettingsPropagationWaitRequest({
    action: MESSAGE_ACTIONS.WAIT_SETTINGS_PROPAGATION,
    taskId: receipt.taskId,
    ownerEpoch: receipt.ownerEpoch,
    commitVersion: receipt.commitVersion,
    keys: [...receipt.changedKeys],
    expectedProfileGeneration,
  });
  const delivery = await sendMessage(request, { timeoutMs });
  if (delivery?.ok !== true) {
    const error = new Error(delivery?.error || 'SETTINGS_PROPAGATION_DELIVERY_FAILED');
    error.code = error.message;
    throw error;
  }
  if (delivery.response?.success !== true) {
    const error = new Error(delivery.response?.error || 'SETTINGS_PROPAGATION_WAIT_FAILED');
    error.code = error.message;
    throw error;
  }
  return requireSettingsPropagationWaitResult(delivery.response.propagation, request);
}
