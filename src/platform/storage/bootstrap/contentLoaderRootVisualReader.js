import { runtimeSendMessageReliable } from '../../chrome/ChromeService.js';
import { MESSAGE_TYPES } from '../../messaging/messageTypes.js';
import { requireCanonicalRuntimeLanguage } from '../../../domains/settings/i18n/language.js';

export async function readContentBootstrapSnapshot(operation, {
  hostname = '',
  request = runtimeSendMessageReliable,
} = {}) {
  if (!['root_visual', 'friction', 'language'].includes(operation)) {
    throw new Error('CONTENT_BOOTSTRAP_SNAPSHOT_OPERATION_INVALID');
  }
  const sentAt = Date.now();
  const delivery = await request({
    type: MESSAGE_TYPES.CONTENT_BOOTSTRAP_SNAPSHOT,
    operation,
  }, { timeoutMs: 3000 });
  if (delivery?.ok !== true) {
    const code = delivery?.error || 'CONTENT_BOOTSTRAP_SNAPSHOT_TRANSPORT_FAILED';
    const error = new Error(`${code}:operation=${operation}:elapsedMs=${Math.max(0, Date.now() - sentAt)}`);
    error.code = code;
    error.operation = operation;
    throw error;
  }
  const response = delivery.response;
  if (response?.success === false) {
    throw new Error(response.error || 'CONTENT_BOOTSTRAP_SNAPSHOT_READ_FAILED');
  }
  if (
    response?.success !== true
    || response.type !== MESSAGE_TYPES.CONTENT_BOOTSTRAP_SNAPSHOT
    || response.operation !== operation
    || typeof response.hostname !== 'string'
    || !response.hostname
    || (hostname && response.hostname !== hostname.trim().toLowerCase())
    || !Object.hasOwn(response, 'snapshot')
  ) {
    throw new Error('CONTENT_BOOTSTRAP_SNAPSHOT_RESPONSE_INVALID');
  }
  if (operation === 'language') {
    return requireCanonicalRuntimeLanguage(response.snapshot);
  }
  if (
    response.snapshot !== null
    && (
      typeof response.snapshot !== 'object'
      || Array.isArray(response.snapshot)
      || response.snapshot.host?.hostname !== response.hostname
    )
  ) {
    throw new Error('CONTENT_BOOTSTRAP_SNAPSHOT_RESPONSE_INVALID');
  }
  return response.snapshot;
}

export async function readContentLoaderRootVisualSnapshot({
  hostname = '',
} = {}) {
  return readContentBootstrapSnapshot('root_visual', { hostname });
}

export async function readContentLoaderFrictionSnapshot({
  hostname = '',
} = {}) {
  return readContentBootstrapSnapshot('friction', { hostname });
}

export function readContentRuntimeLanguage() {
  return readContentBootstrapSnapshot('language');
}

export default readContentLoaderRootVisualSnapshot;
