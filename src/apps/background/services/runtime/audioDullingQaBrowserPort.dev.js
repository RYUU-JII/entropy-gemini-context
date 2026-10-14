import {
  offscreenCreateDocument,
  permissionsContains,
  permissionsRequest,
  runtimeGetContexts,
  runtimeGetURL,
  runtimeSendMessage,
} from '../../../../platform/chrome/ChromeService.js';
import { getExtensionApi } from '../../../../platform/extension/extensionApi.js';
import {
  callExtensionCallbackApiResult,
} from '../../../../platform/extension/extensionApiCall.js';

export function createAudioDullingQaBrowserPort() {
  const api = getExtensionApi();
  const callActionResult = (method, args = [], fallback = null) => (
    typeof method === 'function'
      ? callExtensionCallbackApiResult(
        api,
        method,
        args,
        fallback,
        { thisArg: api?.action },
      )
      : Promise.resolve({
        value: fallback,
        error: 'AUDIO_DULLING_QA_ACTION_API_UNAVAILABLE',
      })
  );
  return Object.freeze({
    permissionsContains,
    permissionsRequest,
    runtimeGetContexts,
    runtimeGetURL,
    runtimeSendMessage,
    offscreenCreateDocument,
    actionGetUserSettingsResult: () => (
      callActionResult(api?.action?.getUserSettings, [], null)
    ),
    actionGetPopupResult: (tabId) => (
      callActionResult(api?.action?.getPopup, [{ tabId }], null)
    ),
    actionGetTitleResult: (tabId) => (
      callActionResult(api?.action?.getTitle, [{ tabId }], null)
    ),
    actionGetBadgeTextResult: (tabId) => (
      callActionResult(api?.action?.getBadgeText, [{ tabId }], null)
    ),
    actionGetBadgeBackgroundColorResult: (tabId) => (
      callActionResult(api?.action?.getBadgeBackgroundColor, [{ tabId }], null)
    ),
    actionSetPopupResult: (tabId, popup) => (
      callActionResult(api?.action?.setPopup, [{ tabId, popup }], null)
    ),
    actionSetTitleResult: (tabId, title) => (
      callActionResult(api?.action?.setTitle, [{ tabId, title }], null)
    ),
    actionSetIconResult: (tabId, path) => (
      callActionResult(api?.action?.setIcon, [{ tabId, path }], null)
    ),
    actionSetBadgeTextResult: (tabId, text) => (
      callActionResult(api?.action?.setBadgeText, [{ tabId, text }], null)
    ),
    actionSetBadgeBackgroundColorResult: (tabId, color) => (
      callActionResult(
        api?.action?.setBadgeBackgroundColor,
        [{ tabId, color }],
        null,
      )
    ),
    tabCaptureGetMediaStreamIdResult: (options = {}) => (
      callExtensionCallbackApiResult(
        api,
        api?.tabCapture?.getMediaStreamId,
        [options],
        null,
        { thisArg: api?.tabCapture },
      ).then(({ value, error }) => ({
        streamId: typeof value === 'string' && value ? value : null,
        error,
      }))
    ),
  });
}
