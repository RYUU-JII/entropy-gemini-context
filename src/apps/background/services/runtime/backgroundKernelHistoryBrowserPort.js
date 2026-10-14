import { getExtensionApi } from '../../../../platform/extension/extensionApi.js';
import { callExtensionCallbackApiResult } from '../../../../platform/extension/extensionApiCall.js';
import { createBackgroundKernelTabsRemovePort } from './backgroundKernelTabsRemovePort.js';

const chromeApi = getExtensionApi();

function createBrowserPortFailure(code, detail = 'UNKNOWN_ERROR') {
  const error = new Error(`${code}:${String(detail || 'UNKNOWN_ERROR')}`);
  error.code = code;
  return error;
}

async function callRequiredChromeApi(method, args = [], thisArg = null, unavailableCode, failureCode, successValue) {
  if (typeof method !== 'function') throw createBrowserPortFailure(unavailableCode);
  const { value, error } = await callExtensionCallbackApiResult(
    chromeApi,
    method,
    args,
    successValue,
    { thisArg },
  );
  if (error) throw createBrowserPortFailure(failureCode, error);
  return value;
}

export function createBackgroundKernelHistoryBrowserPort() {
  return {
    historySearch: async (query = {}) => {
      const result = await callRequiredChromeApi(
        chromeApi?.history?.search,
        [query],
        chromeApi?.history,
        'HISTORY_SEARCH_API_UNAVAILABLE',
        'HISTORY_SEARCH_API_FAILED',
      );
      if (!Array.isArray(result)) {
        throw createBrowserPortFailure('HISTORY_SEARCH_INVALID_RESULT', typeof result);
      }
      return result;
    },
    historyDeleteUrl: (details = {}) => (
      callRequiredChromeApi(
        chromeApi?.history?.deleteUrl,
        [details],
        chromeApi?.history,
        'HISTORY_DELETE_API_UNAVAILABLE',
        'HISTORY_DELETE_API_FAILED',
        true,
      )
    ),
    bookmarksGetTree: async () => {
      const result = await callRequiredChromeApi(
        chromeApi?.bookmarks?.getTree,
        [],
        chromeApi?.bookmarks,
        'BOOKMARK_TREE_API_UNAVAILABLE',
        'BOOKMARK_TREE_API_FAILED',
      );
      if (!Array.isArray(result)) {
        throw createBrowserPortFailure('BOOKMARK_TREE_INVALID_RESULT', typeof result);
      }
      return result;
    },
    bookmarksRemove: (bookmarkId) => (
      callRequiredChromeApi(
        chromeApi?.bookmarks?.remove,
        [bookmarkId],
        chromeApi?.bookmarks,
        'BOOKMARK_REMOVE_API_UNAVAILABLE',
        'BOOKMARK_REMOVE_API_FAILED',
        true,
      )
    ),
    cookiesGetAll: async (details = {}) => {
      const result = await callRequiredChromeApi(
        chromeApi?.cookies?.getAll,
        [details],
        chromeApi?.cookies,
        'COOKIE_GET_ALL_API_UNAVAILABLE',
        'COOKIE_GET_ALL_API_FAILED',
      );
      if (!Array.isArray(result)) {
        throw createBrowserPortFailure('COOKIE_GET_ALL_INVALID_RESULT', typeof result);
      }
      return result;
    },
    cookiesRemove: (details = {}) => (
      callRequiredChromeApi(
        chromeApi?.cookies?.remove,
        [details],
        chromeApi?.cookies,
        'COOKIE_REMOVE_API_UNAVAILABLE',
        'COOKIE_REMOVE_API_FAILED',
        true,
      )
    ),
    tabsGet: async (tabId) => {
      if (typeof chromeApi?.tabs?.get !== 'function') throw createBrowserPortFailure('TABS_GET_API_UNAVAILABLE');
      const { value, error } = await callExtensionCallbackApiResult(chromeApi, chromeApi.tabs.get,
        [tabId], null, { thisArg: chromeApi.tabs });
      if (error) {
        const gone = /^No tab with id:\s*(\d+)\.?$/.exec(error);
        if (gone && Number(gone[1]) === tabId) return null;
        throw createBrowserPortFailure('TABS_GET_API_FAILED', error);
      }
      if (!value || value.id !== tabId) throw createBrowserPortFailure('TABS_GET_INVALID_RESULT');
      return value;
    },
    tabsQuery: async (queryInfo = {}) => {
      const result = await callRequiredChromeApi(
        chromeApi?.tabs?.query,
        [queryInfo],
        chromeApi?.tabs,
        'TABS_QUERY_API_UNAVAILABLE',
        'TABS_QUERY_API_FAILED',
      );
      if (!Array.isArray(result)) {
        throw createBrowserPortFailure('TABS_QUERY_INVALID_RESULT', typeof result);
      }
      return result;
    },
    tabsRemove: createBackgroundKernelTabsRemovePort(chromeApi),
  };
}
