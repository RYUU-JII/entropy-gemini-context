import { callExtensionCallbackApiResult } from '../../../../platform/extension/extensionApiCall.js';

export const PROTECTION_TABS_QUERY_ERROR_CODES = Object.freeze({
  UNAVAILABLE: 'PROTECTION_TABS_QUERY_UNAVAILABLE',
  FAILED: 'PROTECTION_TABS_QUERY_FAILED',
  RESULT_INVALID: 'PROTECTION_TABS_QUERY_RESULT_INVALID',
});

function createTabsQueryError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function describeValueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertValidProtectionTabEntry(tab, entryIndex) {
  if (!isPlainObject(tab)) {
    throw createTabsQueryError(PROTECTION_TABS_QUERY_ERROR_CODES.RESULT_INVALID, {
      entryIndex,
      entryReason: 'TAB_ENTRY_NOT_PLAIN_OBJECT',
      entryType: describeValueType(tab),
    });
  }
  if (!Number.isInteger(tab.id) || tab.id < 0) {
    throw createTabsQueryError(PROTECTION_TABS_QUERY_ERROR_CODES.RESULT_INVALID, {
      entryIndex,
      entryReason: 'TAB_ID_INVALID',
      tabIdType: describeValueType(tab.id),
      tabIdValue: String(tab.id),
    });
  }
  if (Object.prototype.hasOwnProperty.call(tab, 'url') && typeof tab.url !== 'string') {
    throw createTabsQueryError(PROTECTION_TABS_QUERY_ERROR_CODES.RESULT_INVALID, {
      entryIndex,
      entryReason: 'TAB_URL_INVALID',
      tabIdValue: String(tab.id),
      urlType: describeValueType(tab.url),
    });
  }
}

export function createStrictProtectionTabsQuery({ api } = {}) {
  return async function tabsQuery(queryInfo = {}) {
    if (typeof api?.tabs?.query !== 'function') {
      throw createTabsQueryError(PROTECTION_TABS_QUERY_ERROR_CODES.UNAVAILABLE);
    }

    const { value, error } = await callExtensionCallbackApiResult(
      api,
      api.tabs.query,
      [queryInfo],
      null,
      { thisArg: api.tabs },
    );
    if (error) {
      throw createTabsQueryError(PROTECTION_TABS_QUERY_ERROR_CODES.FAILED, {
        causeMessage: String(error?.message || error || 'EXTENSION_TABS_QUERY_FAILED'),
      });
    }
    if (!Array.isArray(value)) {
      throw createTabsQueryError(PROTECTION_TABS_QUERY_ERROR_CODES.RESULT_INVALID, {
        resultType: describeValueType(value),
      });
    }
    value.forEach(assertValidProtectionTabEntry);
    return value;
  };
}
