import { runtimeSendMessageReliable } from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { publishVaultSessionFailure } from './securityVaultStatusEvents.js';
import { requireSecurityVaultStatus } from '../../../platform/security/securityVaultStatusContract.js';

export async function sendSecurityRuntimeRequest(message, { timeoutMs = 30_000 } = {}) {
  const transport = await runtimeSendMessageReliable(message, { timeoutMs });
  if (transport?.ok !== true) {
    const error = new Error(transport?.error || 'SECURITY_RUNTIME_TRANSPORT_FAILED');
    error.code = error.message;
    throw error;
  }
  const response = transport.response;
  if (response?.success !== true) {
    const error = new Error(response?.error || 'SECURITY_VAULT_REQUEST_FAILED');
    error.code = error.message;
    throw error;
  }
  return response;
}

export async function requestSecurityVault(action, fields = {}) {
  let response;
  try {
    response = await sendSecurityRuntimeRequest({ ...fields, action });
  } catch (error) {
    publishVaultSessionFailure(error.code);
    throw error;
  }
  try {
    return requireSecurityVaultStatus(response.status);
  } catch {
    throw new Error('SECURITY_VAULT_RESPONSE_INVALID');
  }
}

export const readSecurityVaultStatus = () => requestSecurityVault(MESSAGE_ACTIONS.GET_SECURITY_VAULT_STATUS);
