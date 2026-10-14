import { getExtensionApi } from '../../../../platform/extension/extensionApi.js';
import {
  addExtensionListener,
  callExtensionCallbackApi,
  callExtensionPromiseApi,
  removeExtensionListener,
} from '../../../../platform/extension/extensionApiCall.js';

const chromeApi = getExtensionApi();

async function callChromeApi(invoke, fallback = null) {
  return callExtensionPromiseApi(invoke, [], fallback);
}

function addChromeListener(event, listener) {
  return addExtensionListener(event, listener);
}

function removeChromeListener(event, listener) {
  return removeExtensionListener(event, listener);
}

function callChromeCallbackApi(method, args = [], fallback = null, thisArg = null) {
  return callExtensionCallbackApi(chromeApi, method, args, fallback, { thisArg });
}

function sendRuntimeMessage(message) {
  if (typeof chromeApi?.runtime?.sendMessage !== 'function') return false;
  try {
    chromeApi.runtime.sendMessage(message);
    return true;
  } catch (_error) {
    return false;
  }
}

export function createBackgroundKernelBehaviorBrowserPort() {
  return {
    windowIdNone: chromeApi?.windows?.WINDOW_ID_NONE ?? -1,
    idleOnStateChangedAddListener: (listener) => addChromeListener(chromeApi?.idle?.onStateChanged, listener),
    idleOnStateChangedRemoveListener: (listener) => removeChromeListener(chromeApi?.idle?.onStateChanged, listener),
    idleQueryState: (seconds) => callChromeCallbackApi(chromeApi?.idle?.queryState, [seconds], null, chromeApi?.idle),
    idleSetDetectionInterval: (seconds) => callChromeApi(() => chromeApi?.idle?.setDetectionInterval?.(seconds), null),
    runtimeOnMessageAddListener: (listener) => addChromeListener(chromeApi?.runtime?.onMessage, listener),
    runtimeOnMessageRemoveListener: (listener) => removeChromeListener(chromeApi?.runtime?.onMessage, listener),
    runtimeSendMessage: sendRuntimeMessage,
    tabsOnActivatedAddListener: (listener) => addChromeListener(chromeApi?.tabs?.onActivated, listener),
    tabsOnActivatedRemoveListener: (listener) => removeChromeListener(chromeApi?.tabs?.onActivated, listener),
    tabsOnCreatedAddListener: (listener) => addChromeListener(chromeApi?.tabs?.onCreated, listener),
    tabsOnCreatedRemoveListener: (listener) => removeChromeListener(chromeApi?.tabs?.onCreated, listener),
    tabsOnRemovedAddListener: (listener) => addChromeListener(chromeApi?.tabs?.onRemoved, listener),
    tabsOnRemovedRemoveListener: (listener) => removeChromeListener(chromeApi?.tabs?.onRemoved, listener),
    tabsQuery: (queryInfo = {}) => callChromeCallbackApi(chromeApi?.tabs?.query, [queryInfo], [], chromeApi?.tabs),
    tabsSendMessage: (tabId, message) => callChromeCallbackApi(chromeApi?.tabs?.sendMessage, [tabId, message], null, chromeApi?.tabs),
    webNavigationOnCommittedAddListener: (listener) => addChromeListener(chromeApi?.webNavigation?.onCommitted, listener),
    webNavigationOnCommittedRemoveListener: (listener) => removeChromeListener(chromeApi?.webNavigation?.onCommitted, listener),
    webNavigationOnCompletedAddListener: (listener) => addChromeListener(chromeApi?.webNavigation?.onCompleted, listener),
    webNavigationOnCompletedRemoveListener: (listener) => removeChromeListener(chromeApi?.webNavigation?.onCompleted, listener),
    webNavigationOnHistoryStateUpdatedAddListener: (listener) => addChromeListener(chromeApi?.webNavigation?.onHistoryStateUpdated, listener),
    webNavigationOnHistoryStateUpdatedRemoveListener: (listener) => removeChromeListener(chromeApi?.webNavigation?.onHistoryStateUpdated, listener),
    windowsOnFocusChangedAddListener: (listener) => addChromeListener(chromeApi?.windows?.onFocusChanged, listener),
    windowsOnFocusChangedRemoveListener: (listener) => removeChromeListener(chromeApi?.windows?.onFocusChanged, listener),
  };
}
