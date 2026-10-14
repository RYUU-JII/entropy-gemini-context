import { getExtensionApi } from '../../../../platform/extension/extensionApi.js';
import { callExtensionCallbackApiResult } from '../../../../platform/extension/extensionApiCall.js';

export function createBackgroundKernelTabManagementBrowserPort({ api = getExtensionApi() } = {}) {
  async function call(owner, method, args) {
    if (typeof owner?.[method] !== 'function') throw new Error(`TAB_MANAGEMENT_API_UNAVAILABLE:${method}`);
    const { value, error } = await callExtensionCallbackApiResult(api, owner[method], args, undefined, { thisArg: owner });
    if (error) throw new Error(`TAB_MANAGEMENT_API_FAILED:${method}:${error}`);
    return value;
  }
  return {
    tabsQuery: query => call(api.tabs, 'query', [query]),
    tabsGet: tabId => call(api.tabs, 'get', [tabId]),
    tabsGroup: options => call(api.tabs, 'group', [options]),
    tabsUngroup: tabIds => call(api.tabs, 'ungroup', [tabIds]),
    tabGroupsQuery: query => call(api.tabGroups, 'query', [query]),
    tabGroupsUpdate: (groupId, patch) => call(api.tabGroups, 'update', [groupId, patch]),
    permissionsContains: async query => {
      const granted = await call(api.permissions, 'contains', [query]);
      if (typeof granted !== 'boolean') throw new Error('TAB_MANAGEMENT_PERMISSION_RESULT_INVALID');
      return granted;
    },
    setBadge: async text => {
      await call(api.action, 'setBadgeBackgroundColor', [{ color: '#64706a' }]);
      await call(api.action, 'setBadgeText', [{ text }]);
    },
  };
}
