import { getExtensionApi } from '../../../../platform/extension/extensionApi.js';
import {
  addExtensionListener,
  callExtensionCallbackApi,
  callExtensionCallbackApiResult,
  callExtensionPromiseApi,
} from '../../../../platform/extension/extensionApiCall.js';
import { createBackgroundKernelTabsRemovePort } from './backgroundKernelTabsRemovePort.js';

const chromeApi = getExtensionApi();

export function createBackgroundKernelTrackingBrowserPort() {
  return {
    windowIdNone: chromeApi?.windows?.WINDOW_ID_NONE ?? -1,
    getRuntimeId: () => chromeApi?.runtime?.id || '',
    runtimeGetURL: (path = '') => (
      chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL(path) : null
    ),
    alarmsCreate: (name, alarmInfo = {}) => (
      callExtensionPromiseApi(chromeApi?.alarms?.create, [name, alarmInfo], null, {
        thisArg: chromeApi?.alarms,
      })
    ),
    alarmsGet: (name) => (
      chromeApi?.alarms?.get
        ? callExtensionCallbackApi(chromeApi, chromeApi.alarms.get, [name], null, {
          thisArg: chromeApi.alarms,
        })
        : null
    ),
    idleOnStateChangedAddListener: (listener) => (
      chromeApi?.idle?.onStateChanged?.addListener
        ? addExtensionListener(chromeApi.idle.onStateChanged, listener)
        : false
    ),
    idleQueryState: (detectionIntervalSeconds) => (
      chromeApi?.idle?.queryState
        ? callExtensionCallbackApi(chromeApi, chromeApi.idle.queryState, [detectionIntervalSeconds], null, {
          thisArg: chromeApi.idle,
        })
        : Promise.resolve(null)
    ),
    idleSetDetectionInterval: (detectionIntervalSeconds) => {
      if (typeof chromeApi?.idle?.setDetectionInterval !== 'function') return false;
      try {
        chromeApi.idle.setDetectionInterval(detectionIntervalSeconds);
        return true;
      } catch (_error) {
        return false;
      }
    },
    tabsGet: (tabId) => (
      callExtensionCallbackApi(chromeApi, chromeApi?.tabs?.get, [tabId], null, {
        thisArg: chromeApi?.tabs,
      })
    ),
    tabsQuery: (queryInfo = {}) => (
      callExtensionCallbackApi(chromeApi, chromeApi?.tabs?.query, [queryInfo], [], {
        thisArg: chromeApi?.tabs,
      })
    ),
    tabsCreate: (createProperties = {}) => (
      callExtensionCallbackApi(chromeApi, chromeApi?.tabs?.create, [createProperties], null, {
        thisArg: chromeApi?.tabs,
      })
    ),
    tabsUpdate: async (tabId, updateProperties = {}) => {
      const numericTabId = Number(tabId);
      if (!Number.isSafeInteger(numericTabId) || numericTabId < 0) {
        return { tab: null, error: 'INVALID_TAB_ID' };
      }
      if (typeof chromeApi?.tabs?.update !== 'function') {
        return { tab: null, error: 'TABS_UPDATE_UNAVAILABLE' };
      }
      const { value, error } = await callExtensionCallbackApiResult(
        chromeApi,
        chromeApi.tabs.update,
        [numericTabId, updateProperties],
        null,
        { thisArg: chromeApi.tabs },
      );
      return { tab: value, error };
    },
    tabsRemove: createBackgroundKernelTabsRemovePort(chromeApi),
    tabsSendMessage: async (tabId, message, options = undefined) => {
      const args = options === undefined
        ? [tabId, message]
        : [tabId, message, options];
      const { value, error } = await callExtensionCallbackApiResult(
        chromeApi,
        chromeApi?.tabs?.sendMessage,
        args,
        null,
        { thisArg: chromeApi?.tabs },
      );
      return { response: value, error };
    },
    windowsGet: (windowId, queryInfo = {}) => (
      callExtensionCallbackApi(chromeApi, chromeApi?.windows?.get, [windowId, queryInfo], null, {
        thisArg: chromeApi?.windows,
      })
    ),
  };
}
