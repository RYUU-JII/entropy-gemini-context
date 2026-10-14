import {
  runtimeSendMessage as runtimeSendMessagePlatform,
  runtimeSendMessageReliable as runtimeSendMessageReliablePlatform,
} from '../messaging/runtime/runtimeMessaging.js';
import { getExtensionApi } from '../extension/extensionApi.js';
import { callExtensionCallbackApi } from '../extension/extensionApiCall.js';

const extensionApi = getExtensionApi();

export function runtimeGetURL(relativePath) {
  if (!relativePath) return '';
  try {
    if (extensionApi?.runtime?.getURL) {
      return extensionApi.runtime.getURL(relativePath);
    }
  } catch (_error) {
    // Extension-context invalidation degrades only the UI link target.
  }
  return relativePath;
}

export function runtimeGetUILanguage() {
  return extensionApi?.i18n?.getUILanguage
    ? extensionApi.i18n.getUILanguage()
    : '';
}

export function runtimeSendMessage(message) {
  return runtimeSendMessagePlatform(message);
}

export function runtimeSendMessageReliable(message, { timeoutMs = 0 } = {}) {
  return runtimeSendMessageReliablePlatform(message, { timeoutMs });
}

export function tabsQuery(queryInfo) {
  if (!extensionApi?.tabs?.query) return Promise.resolve([]);
  return callExtensionCallbackApi(
    extensionApi,
    extensionApi.tabs.query,
    [queryInfo],
    [],
    { thisArg: extensionApi.tabs },
  ).then((tabs) => (Array.isArray(tabs) ? tabs : []));
}
