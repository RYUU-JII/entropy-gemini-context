import { runtimeSendMessageReliable } from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { normalizeBootPrewarmSnapshot } from './bootPrewarmSnapshot.js';
import { BOOT_PREWARM_REQUEST_TIMEOUT_MS } from './bootConfig.js';

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

function createBootPrewarmClientError(code, details = null) {
  const error = new Error(code);
  error.code = code;
  error.details = details && typeof details === 'object' ? { ...details } : null;
  return error;
}

export async function fetchBootPrewarmSnapshot({ force = false, reason = 'dashboard_boot' } = {}) {
  const result = await runtimeSendMessageReliable({
    action: MESSAGE_ACTIONS.GET_BOOT_PREWARM_SNAPSHOT,
    force: !!force,
    reason: String(reason || 'dashboard_boot'),
  }, {
    timeoutMs: BOOT_PREWARM_REQUEST_TIMEOUT_MS,
  });

  if (!result?.ok) {
    const deliveryError = typeof result?.error === 'string' && result.error.trim()
      ? result.error.trim()
      : 'UNKNOWN';
    throw createBootPrewarmClientError(
      deliveryError === 'TIMEOUT'
        ? 'BOOT_PREWARM_REQUEST_TIMEOUT'
        : 'BOOT_PREWARM_REQUEST_FAILED',
      { deliveryError },
    );
  }
  if (!isObject(result.response)) {
    throw createBootPrewarmClientError('BOOT_PREWARM_RESPONSE_INVALID', {
      responseType: Array.isArray(result.response) ? 'array' : typeof result.response,
    });
  }
  if (result.response.success !== true) {
    throw createBootPrewarmClientError('BOOT_PREWARM_RESPONSE_FAILED', {
      responseError: typeof result.response.error === 'string'
        ? result.response.error
        : null,
    });
  }

  const snapshot = normalizeBootPrewarmSnapshot(result.response.snapshot || null);
  if (!snapshot) {
    throw createBootPrewarmClientError('BOOT_PREWARM_SNAPSHOT_INVALID');
  }

  return snapshot;
}
