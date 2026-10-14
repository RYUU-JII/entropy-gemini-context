import {
  getExtensionApiNamespace,
  isPromiseExtensionApiNamespace,
} from './extensionApi.js';

function isThenable(value) {
  return !!value && typeof value.then === 'function';
}

function resolveRuntimeLastError(api) {
  try {
    return api?.runtime?.lastError?.message || null;
  } catch (_error) {
    return null;
  }
}

export async function callExtensionPromiseApi(method, args = [], fallback = null, { thisArg = null } = {}) {
  if (typeof method !== 'function') return fallback;
  try {
    const result = method.apply(thisArg, Array.isArray(args) ? args : []);
    if (isThenable(result)) {
      const value = await result;
      return value === undefined ? fallback : value;
    }
    return result === undefined ? fallback : result;
  } catch (_error) {
    return fallback;
  }
}

export function callExtensionCallbackApi(api, method, args = [], fallback = null, { thisArg = null } = {}) {
  return callExtensionCallbackApiResult(api, method, args, fallback, { thisArg })
    .then((result) => result.value);
}

export function callExtensionCallbackApiResult(api, method, args = [], fallback = null, { thisArg = null } = {}) {
  if (typeof method !== 'function') return Promise.resolve({ value: fallback, error: null });
  const namespace = getExtensionApiNamespace();
  if (isPromiseExtensionApiNamespace(namespace)) {
    return (async () => {
      try {
        const result = method.apply(thisArg, Array.isArray(args) ? args : []);
        const value = isThenable(result) ? await result : result;
        return { value: value === undefined ? fallback : value, error: null };
      } catch (error) {
        return {
          value: fallback,
          error: String(error?.message || error || 'EXTENSION_API_FAILED'),
        };
      }
    })();
  }

  return new Promise((resolve) => {
    try {
      const callback = (value) => {
        const error = resolveRuntimeLastError(api);
        if (error) {
          resolve({ value: fallback, error });
          return;
        }
        resolve({ value: value === undefined ? fallback : value, error: null });
      };
      const result = method.apply(thisArg, [...(Array.isArray(args) ? args : []), callback]);
      if (isThenable(result)) {
        result.then((value) => {
          resolve({ value: value === undefined ? fallback : value, error: null });
        }).catch((error) => {
          resolve({
            value: fallback,
            error: String(error?.message || error || 'EXTENSION_API_FAILED'),
          });
        });
      }
    } catch (error) {
      resolve({
        value: fallback,
        error: String(error?.message || error || 'EXTENSION_API_FAILED'),
      });
    }
  });
}

export function addExtensionListener(event, listener) {
  if (!event?.addListener || typeof listener !== 'function') return false;
  event.addListener(listener);
  return true;
}

export function removeExtensionListener(event, listener) {
  if (!event?.removeListener || typeof listener !== 'function') return false;
  event.removeListener(listener);
  return true;
}
