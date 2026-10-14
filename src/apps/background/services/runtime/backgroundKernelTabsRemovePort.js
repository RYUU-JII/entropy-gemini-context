import { callExtensionCallbackApiResult } from '../../../../platform/extension/extensionApiCall.js';

/**
 * The one `tabs.remove` contract for the background.
 *
 * Three ports used to expose their own: one accepted batches and swallowed
 * synchronous throws, one accepted a single id, one threw where the others
 * returned. A tab closure now goes through a single authority, and an authority
 * that has to reason about three different failure shapes for one browser call
 * cannot report faithfully what happened.
 *
 * Shape: `tabsRemove(tabIdOrIds) -> Promise<{ success, error }>`. Never throws.
 */
export function createBackgroundKernelTabsRemovePort(chromeApi) {
  return async function tabsRemove(tabIdOrIds) {
    if (typeof chromeApi?.tabs?.remove !== 'function') {
      return { success: false, error: 'TABS_REMOVE_UNAVAILABLE' };
    }
    const requested = Array.isArray(tabIdOrIds) ? tabIdOrIds : [tabIdOrIds];
    const normalized = [];
    for (const candidate of requested) {
      const numeric = Number(candidate);
      if (!Number.isInteger(numeric) || numeric < 0) {
        return { success: false, error: 'INVALID_TAB_ID' };
      }
      normalized.push(numeric);
    }
    if (!normalized.length) {
      return { success: false, error: 'INVALID_TAB_ID' };
    }

    const { error } = await callExtensionCallbackApiResult(
      chromeApi,
      chromeApi.tabs.remove,
      [Array.isArray(tabIdOrIds) ? normalized : normalized[0]],
      true,
      { thisArg: chromeApi.tabs },
    );
    return error ? { success: false, error } : { success: true, error: null };
  };
}

export default createBackgroundKernelTabsRemovePort;
