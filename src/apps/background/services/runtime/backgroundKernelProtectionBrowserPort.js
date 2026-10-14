import { getExtensionApi } from '../../../../platform/extension/extensionApi.js';
import { callExtensionCallbackApi, callExtensionCallbackApiResult } from '../../../../platform/extension/extensionApiCall.js';
import { createBackgroundKernelPermissionBrowserPort } from './backgroundKernelPermissionBrowserPort.js';
import { createStrictProtectionTabsQuery } from './backgroundKernelProtectionTabsQuery.js';
import { createBackgroundKernelTabsRemovePort } from './backgroundKernelTabsRemovePort.js';

const chromeApi = getExtensionApi();

function callChromeCallbackApi(method, args = [], fallback = null, thisArg = null) {
  return callExtensionCallbackApi(chromeApi, method, args, fallback, { thisArg });
}

function toErrorMessage(error) {
  return error?.message || String(error || 'UNKNOWN_CHROME_ERROR');
}

export function createBackgroundKernelProtectionBrowserPort() {
  const permissionBrowserPort = createBackgroundKernelPermissionBrowserPort({ api: chromeApi });
  const tabsQuery = createStrictProtectionTabsQuery({ api: chromeApi });

  return {
    windowIdNone: chromeApi?.windows?.WINDOW_ID_NONE ?? -1,
    getUILanguage: () => (chromeApi?.i18n?.getUILanguage ? chromeApi.i18n.getUILanguage() : ''),
    permissionsContains: permissionBrowserPort.permissionsContains,
    permissionsRequest: permissionBrowserPort.permissionsRequest,
    runtimeGetContexts: (query = {}) => callChromeCallbackApi(chromeApi?.runtime?.getContexts, [query], [], chromeApi?.runtime),
    runtimeGetURL: (path = '') => (chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL(path) : null),
    runtimeSendMessage: (message = {}) => callChromeCallbackApi(chromeApi?.runtime?.sendMessage, [message], null, chromeApi?.runtime),
    tabsGet: (tabId) => callChromeCallbackApi(chromeApi?.tabs?.get, [tabId], null, chromeApi?.tabs),
    tabsGetLiveness: async (tabId) => {
      if (!Number.isInteger(tabId) || tabId < 0) throw new Error('INTERVENTION_TAB_LOOKUP_ID_INVALID');
      if (typeof chromeApi?.tabs?.get !== 'function') throw new Error('INTERVENTION_TAB_LOOKUP_UNAVAILABLE');
      let timer;
      const { value, error } = await Promise.race([
        callExtensionCallbackApiResult(chromeApi, chromeApi.tabs.get, [tabId], null, { thisArg: chromeApi.tabs }),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve({ value: null, error: 'INTERVENTION_TAB_LOOKUP_TIMEOUT' }), 800);
        }),
      ]).finally(() => clearTimeout(timer));
      if (error) {
        // Only Chrome's explicit absence of this exact tab is a liveness
        // conclusion. Permission/API failures and malformed replies are not.
        const gone = /^No tab with id:\s*(\d+)\.?$/.exec(error);
        if (gone && Number(gone[1]) === tabId) return { tabId, status: 'gone' };
        throw new Error(`INTERVENTION_TAB_LOOKUP_FAILED:${error}`);
      }
      if (!value || typeof value !== 'object' || Array.isArray(value) || !Number.isInteger(value.id) || value.id !== tabId) {
        throw new Error('INTERVENTION_TAB_LOOKUP_RESULT_INVALID');
      }
      return { tabId, status: 'alive' };
    },
    tabsQuery,
    webNavigationGetFrame: async (details) => {
      if (typeof chromeApi?.webNavigation?.getFrame !== 'function') {
        throw new Error('INTERVENTION_DOCUMENT_LOOKUP_UNAVAILABLE');
      }
      const { value, error } = await callExtensionCallbackApiResult(
        chromeApi, chromeApi?.webNavigation?.getFrame, [details], null,
        { thisArg: chromeApi?.webNavigation },
      );
      if (error) {
        if (/No tab with id|No frame with id|Invalid tab ID/i.test(error)) return null;
        throw new Error(`INTERVENTION_DOCUMENT_LOOKUP_FAILED:${error}`);
      }
      return value;
    },
    tabsSendMessage: async (tabId, message, options = undefined, { timeoutMs = 0 } = {}) => {
      const args = [tabId, message];
      if (typeof options !== 'undefined') args.push(options);
      const delivery = callExtensionCallbackApiResult(
        chromeApi,
        chromeApi?.tabs?.sendMessage,
        args,
        null,
        { thisArg: chromeApi?.tabs },
      );
      let timer;
      const { value, error } = await (timeoutMs > 0
        ? Promise.race([
          delivery,
          new Promise((resolve) => {
            timer = setTimeout(() => resolve({ value: null, error: 'INTERVENTION_CONTROL_PROBE_TIMEOUT' }), timeoutMs);
          }),
        ]).finally(() => clearTimeout(timer))
        : delivery);
      return { response: value, error };
    },
    tabsRemove: createBackgroundKernelTabsRemovePort(chromeApi),
    tabsUpdate: async (tabId, updateProperties = {}) => {
      if (typeof chromeApi?.tabs?.update !== 'function') {
        return { tab: null, error: 'TABS_UPDATE_UNAVAILABLE' };
      }
      try {
        const result = chromeApi.tabs.update(Number(tabId), updateProperties);
        const tab = result && typeof result.then === 'function' ? await result : (result || null);
        return { tab: tab || null, error: null };
      } catch (error) {
        return { tab: null, error: toErrorMessage(error) };
      }
    },
    windowsGetLastFocused: (queryInfo = {}) => callChromeCallbackApi(chromeApi?.windows?.getLastFocused, [queryInfo], null, chromeApi?.windows),
  };
}
