import { getExtensionApi } from '../../../../platform/extension/extensionApi.js';
import {
  callExtensionCallbackApi,
  callExtensionCallbackApiResult,
} from '../../../../platform/extension/extensionApiCall.js';

const chromeApi = getExtensionApi();

function callChromeCallbackApi(method, args = [], fallback = null, thisArg = null) {
  return callExtensionCallbackApi(chromeApi, method, args, fallback, { thisArg });
}

function runtimeSendMessage(message) {
  if (typeof chromeApi?.runtime?.sendMessage !== 'function') {
    return Promise.resolve({ sent: false, error: 'RUNTIME_SEND_MESSAGE_UNAVAILABLE' });
  }
  return callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.runtime.sendMessage,
    [message],
    null,
    { thisArg: chromeApi.runtime },
  ).then(({ error }) => ({ sent: !error, error }));
}

export function createBackgroundKernelRuntimeMessageBrowserPort() {
  return {
    runtimeGetURL: (path = '') => (
      chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL(path) : null
    ),
    runtimeSendMessage,
    webNavigationGetFrame: (details) => (
      callChromeCallbackApi(chromeApi?.webNavigation?.getFrame, [details], null, chromeApi?.webNavigation)
    ),
    tabsGet: (tabId) => (
      callChromeCallbackApi(chromeApi?.tabs?.get, [tabId], null, chromeApi?.tabs)
    ),
    tabsQuery: (queryInfo = {}) => (
      callChromeCallbackApi(chromeApi?.tabs?.query, [queryInfo], [], chromeApi?.tabs)
    ),
  };
}
