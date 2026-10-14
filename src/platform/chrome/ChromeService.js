import {
  getRuntimeId as getRuntimeIdPlatform,
  hasChromeRuntime as hasChromeRuntimePlatform,
  runtimeCanSendMessage as runtimeCanSendMessagePlatform,
  runtimeOnMessageAddListener as runtimeOnMessageAddListenerPlatform,
  runtimeOnMessageRemoveListener as runtimeOnMessageRemoveListenerPlatform,
  runtimeSendMessage as runtimeSendMessagePlatform,
  runtimeSendMessageReliable as runtimeSendMessageReliablePlatform,
} from '../messaging/runtime/runtimeMessaging.js';
import { getExtensionApi } from '../extension/extensionApi.js';
import {
  callExtensionCallbackApi,
  callExtensionCallbackApiResult,
} from '../extension/extensionApiCall.js';

const chromeApi = getExtensionApi();

export function hasChromeRuntime() {
  return hasChromeRuntimePlatform();
}

export function hasChromeStorage() {
  return !!chromeApi?.storage;
}

export function hasChromeTabs() {
  return !!chromeApi?.tabs;
}

export function hasChromeScripting() {
  return !!chromeApi?.scripting;
}

export function hasChromeNotifications() {
  return !!chromeApi?.notifications?.create;
}

export function hasChromeOffscreen() {
  return !!chromeApi?.offscreen?.createDocument;
}

export function hasChromeTabCapture() {
  return !!chromeApi?.tabCapture?.getMediaStreamId;
}

export function getUILanguage() {
  return chromeApi?.i18n?.getUILanguage ? chromeApi.i18n.getUILanguage() : '';
}

export function getRuntimeId() {
  return getRuntimeIdPlatform();
}

export function runtimeGetURL(path) {
  if (!path) return '';
  try {
    if (chromeApi?.runtime?.getURL) return chromeApi.runtime.getURL(path);
  } catch (e) {
    // Context invalidated or API unavailable
  }
  return path;
}

export function runtimeGetContexts(query = {}) {
  if (!chromeApi?.runtime?.getContexts) return Promise.resolve([]);
  return callExtensionCallbackApi(chromeApi, chromeApi.runtime.getContexts, [query], [], { thisArg: chromeApi.runtime })
    .then((contexts) => (Array.isArray(contexts) ? contexts : []));
}

export function runtimeOpenOptionsPage() {
  if (!chromeApi?.runtime?.openOptionsPage) return false;
  chromeApi.runtime.openOptionsPage();
  return true;
}

export function runtimeSendMessage(message) {
  return runtimeSendMessagePlatform(message);
}

export function runtimeCanSendMessage() {
  return runtimeCanSendMessagePlatform();
}

export function runtimeSendMessageReliable(message, { timeoutMs = 0 } = {}) {
  return runtimeSendMessageReliablePlatform(message, { timeoutMs });
}

export function runtimeOnMessageAddListener(listener) {
  return runtimeOnMessageAddListenerPlatform(listener);
}

export function runtimeOnMessageRemoveListener(listener) {
  return runtimeOnMessageRemoveListenerPlatform(listener);
}

export function tabsQuery(queryInfo) {
  if (!chromeApi?.tabs?.query) return Promise.resolve([]);
  return callExtensionCallbackApi(chromeApi, chromeApi.tabs.query, [queryInfo], [], { thisArg: chromeApi.tabs })
    .then((tabs) => (Array.isArray(tabs) ? tabs : []));
}

export function tabsGet(tabId) {
  if (!chromeApi?.tabs?.get) return Promise.resolve(null);
  return callExtensionCallbackApi(chromeApi, chromeApi.tabs.get, [tabId], null, { thisArg: chromeApi.tabs });
}

export function tabsCreate(createProperties = {}) {
  if (!chromeApi?.tabs?.create) return Promise.resolve(null);
  return callExtensionCallbackApi(chromeApi, chromeApi.tabs.create, [createProperties], null, { thisArg: chromeApi.tabs });
}

export function tabsSendMessage(tabId, message, options = undefined) {
  if (!chromeApi?.tabs?.sendMessage) {
    return Promise.resolve({ response: null, error: 'tabs API not available' });
  }
  return callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.tabs.sendMessage,
    options === undefined ? [tabId, message] : [tabId, message, options],
    null,
    { thisArg: chromeApi.tabs },
  ).then(({ value, error }) => ({ response: value, error }));
}

export function scriptingExecuteScript(options) {
  if (!chromeApi?.scripting?.executeScript) {
    return Promise.resolve('scripting API not available');
  }
  return callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.scripting.executeScript,
    [options],
    null,
    { thisArg: chromeApi.scripting },
  ).then(({ error }) => error);
}

export function scriptingExecuteScriptWithResults(options) {
  if (!chromeApi?.scripting?.executeScript) {
    return Promise.resolve({
      results: null,
      error: 'scripting API not available',
    });
  }
  return callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.scripting.executeScript,
    [options],
    null,
    { thisArg: chromeApi.scripting },
  ).then(({ value, error }) => ({
    results: value,
    error,
  }));
}

export function scriptingRegisterContentScripts(scripts = []) {
  if (!chromeApi?.scripting?.registerContentScripts) {
    return Promise.resolve('scripting API not available');
  }
  return callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.scripting.registerContentScripts,
    [scripts],
    null,
    { thisArg: chromeApi.scripting },
  ).then(({ error }) => error);
}

export function scriptingUpdateContentScripts(scripts = []) {
  if (!chromeApi?.scripting?.updateContentScripts) {
    return Promise.resolve('scripting API not available');
  }
  return callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.scripting.updateContentScripts,
    [scripts],
    null,
    { thisArg: chromeApi.scripting },
  ).then(({ error }) => error);
}

export function scriptingUnregisterContentScripts(ids) {
  if (!chromeApi?.scripting?.unregisterContentScripts) {
    return Promise.resolve('scripting API not available');
  }
  const payload = Array.isArray(ids) && ids.length ? { ids } : {};
  return callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.scripting.unregisterContentScripts,
    [payload],
    null,
    { thisArg: chromeApi.scripting },
  ).then(({ error }) => error);
}

function createPermissionsApiError(code, detail = '') {
  const message = detail ? `${code}:${detail}` : code;
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireBooleanPermissionResult(value, code) {
  if (typeof value !== 'boolean') {
    throw createPermissionsApiError(code);
  }
  return value;
}

export function permissionsContains(request = {}) {
  if (!chromeApi?.permissions?.contains) return Promise.resolve(false);
  return callExtensionCallbackApi(chromeApi, chromeApi.permissions.contains, [request], false, { thisArg: chromeApi.permissions })
    .then((granted) => !!granted);
}

export async function permissionsContainsStrict(request = {}) {
  if (!chromeApi?.permissions?.contains) {
    throw createPermissionsApiError('PERMISSIONS_CONTAINS_UNAVAILABLE');
  }
  const { value, error } = await callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.permissions.contains,
    [request],
    null,
    { thisArg: chromeApi.permissions },
  );
  if (error) {
    throw createPermissionsApiError('PERMISSIONS_CONTAINS_FAILED', error);
  }
  return requireBooleanPermissionResult(value, 'PERMISSIONS_CONTAINS_RESULT_INVALID');
}

export function permissionsRequest(request = {}) {
  if (!chromeApi?.permissions?.request) return Promise.resolve(false);
  return callExtensionCallbackApi(chromeApi, chromeApi.permissions.request, [request], false, { thisArg: chromeApi.permissions })
    .then((granted) => !!granted);
}

export async function permissionsRequestStrict(request = {}) {
  if (!chromeApi?.permissions?.request) {
    throw createPermissionsApiError('PERMISSIONS_REQUEST_UNAVAILABLE');
  }
  const { value, error } = await callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.permissions.request,
    [request],
    null,
    { thisArg: chromeApi.permissions },
  );
  if (error) {
    throw createPermissionsApiError('PERMISSIONS_REQUEST_FAILED', error);
  }
  return requireBooleanPermissionResult(value, 'PERMISSIONS_REQUEST_RESULT_INVALID');
}

export function permissionsRemove(request = {}) {
  if (!chromeApi?.permissions?.remove) return Promise.resolve(false);
  return callExtensionCallbackApi(chromeApi, chromeApi.permissions.remove, [request], false, { thisArg: chromeApi.permissions })
    .then((removed) => !!removed);
}

export async function permissionsRemoveStrict(request = {}) {
  if (!chromeApi?.permissions?.remove) {
    throw createPermissionsApiError('PERMISSIONS_REMOVE_UNAVAILABLE');
  }
  const { value, error } = await callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.permissions.remove,
    [request],
    null,
    { thisArg: chromeApi.permissions },
  );
  if (error) {
    throw createPermissionsApiError('PERMISSIONS_REMOVE_FAILED', error);
  }
  return requireBooleanPermissionResult(value, 'PERMISSIONS_REMOVE_RESULT_INVALID');
}

export function permissionsGetAll() {
  if (!chromeApi?.permissions?.getAll) {
    return Promise.resolve({ permissions: [], origins: [] });
  }
  return callExtensionCallbackApi(chromeApi, chromeApi.permissions.getAll, [], { permissions: [], origins: [] }, { thisArg: chromeApi.permissions })
    .then((result) => ({
      permissions: Array.isArray(result?.permissions) ? result.permissions : [],
      origins: Array.isArray(result?.origins) ? result.origins : [],
    }));
}

function requirePermissionsGetAllResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw createPermissionsApiError('PERMISSIONS_GET_ALL_RESULT_INVALID');
  }
  if (!Array.isArray(result.permissions)) {
    throw createPermissionsApiError('PERMISSIONS_GET_ALL_RESULT_INVALID', 'permissions');
  }
  if (!Array.isArray(result.origins)) {
    throw createPermissionsApiError('PERMISSIONS_GET_ALL_RESULT_INVALID', 'origins');
  }
  return {
    permissions: result.permissions,
    origins: result.origins,
  };
}

export async function permissionsGetAllStrict() {
  if (!chromeApi?.permissions?.getAll) {
    throw createPermissionsApiError('PERMISSIONS_GET_ALL_UNAVAILABLE');
  }
  const { value, error } = await callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.permissions.getAll,
    [],
    null,
    { thisArg: chromeApi.permissions },
  );
  if (error) {
    throw createPermissionsApiError('PERMISSIONS_GET_ALL_FAILED', error);
  }
  return requirePermissionsGetAllResult(value);
}

export function subscribePermissionsChanged(listener) {
  const added = chromeApi?.permissions?.onAdded;
  const removed = chromeApi?.permissions?.onRemoved;
  if (typeof listener !== 'function'
    || typeof added?.addListener !== 'function' || typeof removed?.addListener !== 'function'
    || typeof added?.removeListener !== 'function' || typeof removed?.removeListener !== 'function') {
    throw createPermissionsApiError('PERMISSIONS_CHANGE_SUBSCRIPTION_UNAVAILABLE');
  }
  added.addListener(listener);
  try {
    removed.addListener(listener);
  } catch (error) {
    added.removeListener(listener);
    throw error;
  }
  return () => { added.removeListener(listener); removed.removeListener(listener); };
}

export function offscreenCreateDocument(options = {}) {
  if (!chromeApi?.offscreen?.createDocument) {
    return Promise.resolve('offscreen API not available');
  }
  return callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.offscreen.createDocument,
    [options],
    null,
    { thisArg: chromeApi.offscreen },
  ).then(({ error }) => error);
}

export function offscreenCloseDocument() {
  if (!chromeApi?.offscreen?.closeDocument) {
    return Promise.resolve('offscreen API not available');
  }
  return callExtensionCallbackApiResult(
    chromeApi,
    chromeApi.offscreen.closeDocument,
    [],
    null,
    { thisArg: chromeApi.offscreen },
  ).then(({ error }) => error);
}

export function tabCaptureGetMediaStreamId(options = {}) {
  if (!chromeApi?.tabCapture?.getMediaStreamId) return Promise.resolve(null);
  return callExtensionCallbackApi(
    chromeApi,
    chromeApi.tabCapture.getMediaStreamId,
    [options],
    null,
    { thisArg: chromeApi.tabCapture },
  );
}
