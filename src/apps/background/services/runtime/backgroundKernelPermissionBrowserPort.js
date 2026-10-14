import { callExtensionCallbackApiResult } from '../../../../platform/extension/extensionApiCall.js';

function createBrowserPortError(code, detail = '') {
  const message = detail ? `${code}: ${detail}` : code;
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireBooleanPermissionResult(value, code) {
  if (typeof value !== 'boolean') {
    throw createBrowserPortError(code);
  }
  return value;
}

async function callRequiredPermissionApi({ api, method, request, thisArg, unavailableCode, failedCode, invalidCode }) {
  if (typeof method !== 'function') {
    throw createBrowserPortError(unavailableCode);
  }
  const { value, error } = await callExtensionCallbackApiResult(
    api,
    method,
    [request],
    null,
    { thisArg },
  );
  if (error) {
    throw createBrowserPortError(failedCode, error);
  }
  return requireBooleanPermissionResult(value, invalidCode);
}

export function createBackgroundKernelPermissionBrowserPort({ api } = {}) {
  return {
    permissionsContains: (request = {}) => callRequiredPermissionApi({
      api,
      method: api?.permissions?.contains,
      request,
      thisArg: api?.permissions,
      unavailableCode: 'PERMISSIONS_CONTAINS_UNAVAILABLE',
      failedCode: 'PERMISSIONS_CONTAINS_FAILED',
      invalidCode: 'PERMISSIONS_CONTAINS_RESULT_INVALID',
    }),
    permissionsRequest: (request = {}) => callRequiredPermissionApi({
      api,
      method: api?.permissions?.request,
      request,
      thisArg: api?.permissions,
      unavailableCode: 'PERMISSIONS_REQUEST_UNAVAILABLE',
      failedCode: 'PERMISSIONS_REQUEST_FAILED',
      invalidCode: 'PERMISSIONS_REQUEST_RESULT_INVALID',
    }),
  };
}
