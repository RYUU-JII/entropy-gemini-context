import { getExtensionApi } from '../../../extension/extensionApi.js';

const chromeApi = getExtensionApi();

function isThenable(value) {
  return !!value && typeof value.then === 'function';
}

function resolveSessionArea() {
  return chromeApi?.storage?.session || null;
}

export async function restrictChromeStorageSessionToTrustedContexts({ extensionApi = chromeApi } = {}) {
  const area = extensionApi?.storage?.session;
  if (typeof area?.setAccessLevel !== 'function') {
    throw new Error('CHROME_STORAGE_SESSION_ACCESS_CONTROL_UNAVAILABLE');
  }
  await area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

function normalizeStorageError(error, code) {
  if (error instanceof Error) return error;
  const normalized = new Error(code);
  if (typeof error !== 'undefined') normalized.cause = error;
  return normalized;
}

function invokeAreaGet(area, query, resolve, reject) {
  let settled = false;
  const finish = (items) => {
    if (settled) return;
    settled = true;
    resolve(items || {});
  };
  const fail = (error) => {
    if (settled) return;
    settled = true;
    reject(normalizeStorageError(error, 'CHROME_STORAGE_SESSION_GET_FAILED'));
  };

  try {
    const result = area.get(query || {}, (items) => {
      const callbackError = chromeApi?.runtime?.lastError;
      if (callbackError) {
        fail(new Error(callbackError.message || 'CHROME_STORAGE_SESSION_GET_FAILED'));
        return;
      }
      finish(items);
    });
    if (isThenable(result)) {
      result.then((items) => finish(items)).catch(fail);
    }
  } catch (error) {
    fail(error);
  }
}

function invokeAreaWrite(area, methodName, payload, resolve, reject) {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    resolve();
  };
  const fail = (error) => {
    if (settled) return;
    settled = true;
    reject(normalizeStorageError(error, `CHROME_STORAGE_SESSION_${methodName.toUpperCase()}_FAILED`));
  };

  try {
    const result = area[methodName](payload, () => {
      const callbackError = chromeApi?.runtime?.lastError;
      if (callbackError) {
        fail(new Error(callbackError.message || `CHROME_STORAGE_SESSION_${methodName.toUpperCase()}_FAILED`));
        return;
      }
      finish();
    });
    if (isThenable(result)) {
      result.then(() => finish()).catch(fail);
    }
  } catch (error) {
    fail(error);
  }
}

export function readChromeStorageSession(query = {}) {
  const area = resolveSessionArea();
  if (!area?.get) {
    return Promise.reject(new Error('CHROME_STORAGE_SESSION_UNAVAILABLE'));
  }

  return new Promise((resolve, reject) => {
    invokeAreaGet(area, query, resolve, reject);
  });
}

export function writeChromeStorageSession(items = {}) {
  const area = resolveSessionArea();
  if (!area?.set) return Promise.reject(new Error('CHROME_STORAGE_SESSION_UNAVAILABLE'));

  return new Promise((resolve, reject) => {
    invokeAreaWrite(area, 'set', items || {}, resolve, reject);
  });
}

export function removeChromeStorageSession(keys) {
  const area = resolveSessionArea();
  if (!area?.remove) return Promise.reject(new Error('CHROME_STORAGE_SESSION_UNAVAILABLE'));

  return new Promise((resolve, reject) => {
    invokeAreaWrite(area, 'remove', keys, resolve, reject);
  });
}
