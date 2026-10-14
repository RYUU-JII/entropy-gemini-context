import { getExtensionApi } from '../../extension/extensionApi.js';
import {
  addExtensionListener,
  callExtensionCallbackApi,
  callExtensionCallbackApiResult,
  removeExtensionListener,
} from '../../extension/extensionApiCall.js';

const chromeApi = getExtensionApi();
const listenerMap = new WeakMap();

function isThenable(value) {
  return !!value && typeof value.then === 'function';
}

export function hasChromeRuntime() {
  return !!chromeApi?.runtime;
}

export function runtimeCanSendMessage() {
  return typeof chromeApi?.runtime?.sendMessage === 'function';
}

export function getRuntimeId() {
  return chromeApi?.runtime?.id || null;
}

const EXTENSION_CONTEXT_INVALIDATED_FRAGMENT = 'Extension context invalidated';

// An orphaned content script outliving its extension (reload, update, disable) is a
// declared MV3 terminus, not a runtime failure. Callers use this to end their work
// quietly instead of reporting a fault they cannot act on.
export function isExtensionContextInvalidatedError(error) {
  const text = typeof error === 'string'
    ? error
    : `${error?.message || ''} ${error?.code || ''}`;
  return text.includes(EXTENSION_CONTEXT_INVALIDATED_FRAGMENT);
}

export function runtimeSendMessage(message) {
  if (!chromeApi?.runtime?.sendMessage) return Promise.resolve(null);
  return callExtensionCallbackApi(chromeApi, chromeApi.runtime.sendMessage, [message], null, { thisArg: chromeApi.runtime });
}

export function runtimeSendMessageReliable(message, { timeoutMs = 0 } = {}) {
  if (!chromeApi?.runtime?.sendMessage) {
    return Promise.resolve({ ok: false, response: null, error: 'RUNTIME_UNAVAILABLE' });
  }

  return new Promise((resolve) => {
    let settled = false;
    let timer = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      resolve(result);
    };

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = setTimeout(() => {
        finish({ ok: false, response: null, error: 'TIMEOUT' });
      }, timeoutMs);
    }

    try {
      const result = callExtensionCallbackApiResult(
        chromeApi,
        chromeApi.runtime.sendMessage,
        [message],
        null,
        { thisArg: chromeApi.runtime },
      ).then(({ value, error }) => {
        if (error) {
          finish({
            ok: false,
            response: null,
            error,
          });
          return;
        }
        finish({ ok: true, response: value ?? null, error: null });
      });

      if (isThenable(result)) {
        result.catch((error) => {
          finish({
            ok: false,
            response: null,
            error: String(error?.message || error || 'RUNTIME_SEND_FAILED'),
          });
        });
      }
    } catch (error) {
      finish({
        ok: false,
        response: null,
        error: String(error?.message || error || 'RUNTIME_SEND_FAILED'),
      });
    }
  });
}

export function runtimeOnMessageAddListener(listener) {
  if (!chromeApi?.runtime?.onMessage?.addListener) return false;
  if (typeof listener !== 'function') return false;

  const secureListener = (message, sender, sendResponse) => {
    if (sender.id !== chromeApi.runtime.id) {
      console.warn(`[Security] Blocked message from unknown sender: ${sender.id}`);
      return;
    }
    return listener(message, sender, sendResponse);
  };

  addExtensionListener(chromeApi.runtime.onMessage, secureListener);
  listenerMap.set(listener, secureListener);
  return true;
}

export function runtimeOnMessageRemoveListener(listener) {
  if (!chromeApi?.runtime?.onMessage?.removeListener) return false;
  if (typeof listener !== 'function') return false;

  const secureListener = listenerMap.get(listener);
  if (secureListener) {
    removeExtensionListener(chromeApi.runtime.onMessage, secureListener);
    listenerMap.delete(listener);
    return true;
  }

  removeExtensionListener(chromeApi.runtime.onMessage, listener);
  return true;
}
