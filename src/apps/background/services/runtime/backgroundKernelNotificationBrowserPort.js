import { getExtensionApi } from '../../../../platform/extension/extensionApi.js';
import {
  addExtensionListener,
  callExtensionCallbackApiResult,
  removeExtensionListener,
} from '../../../../platform/extension/extensionApiCall.js';

const chromeApi = getExtensionApi();

function toErrorMessage(error) {
  return error?.message || String(error || 'UNKNOWN_CHROME_ERROR');
}

export function createBackgroundKernelNotificationBrowserPort() {
  return {
    notificationsCreate: async (notificationId, options = {}) => {
      if (typeof chromeApi?.notifications?.create !== 'function') {
        return { notificationId: null, error: 'CHROME_NOTIFICATIONS_UNAVAILABLE' };
      }
      try {
        const { value: createdId, error } = await callExtensionCallbackApiResult(
          chromeApi,
          chromeApi.notifications.create,
          [notificationId, options],
          null,
          { thisArg: chromeApi.notifications },
        );
        if (error) return { notificationId: null, error };
        const resolvedNotificationId = typeof createdId === 'string' && createdId.trim()
          ? createdId.trim()
          : null;
        if (!resolvedNotificationId) {
          return { notificationId: null, error: 'CHROME_NOTIFICATION_ID_UNAVAILABLE' };
        }
        return { notificationId: resolvedNotificationId, error: null };
      } catch (error) {
        return { notificationId: null, error: toErrorMessage(error) };
      }
    },
    notificationsCanCreate: () => typeof chromeApi?.notifications?.create === 'function',
    notificationsCanListen: () => ['onClicked', 'onClosed'].every((eventName) => (
      typeof chromeApi?.notifications?.[eventName]?.addListener === 'function'
      && typeof chromeApi?.notifications?.[eventName]?.removeListener === 'function'
    )),
    notificationsOnClickedAddListener: (listener) => addExtensionListener(chromeApi?.notifications?.onClicked, listener),
    notificationsOnClickedRemoveListener: (listener) => removeExtensionListener(chromeApi?.notifications?.onClicked, listener),
    notificationsOnClosedAddListener: (listener) => addExtensionListener(chromeApi?.notifications?.onClosed, listener),
    notificationsOnClosedRemoveListener: (listener) => removeExtensionListener(chromeApi?.notifications?.onClosed, listener),
    runtimeGetURL: (path = '') => (chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL(path) : null),
    runtimeCanGetURL: () => typeof chromeApi?.runtime?.getURL === 'function',
  };
}
