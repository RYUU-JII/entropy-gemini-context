import { runtimeOnMessageAddListener } from '../../../../platform/chrome/ChromeService.js';
import { getExtensionApi } from '../../../../platform/extension/extensionApi.js';
import { callExtensionCallbackApi } from '../../../../platform/extension/extensionApiCall.js';
import { addObservedBackgroundBrowserListener } from './backgroundKernelBrowserEventListener.js';

const chromeApi = getExtensionApi();

function readChromeCallbackOrPromise(method, args = [], fallback = null, thisArg = null) {
  return callExtensionCallbackApi(chromeApi, method, args, fallback, { thisArg });
}

export function createBackgroundKernelBrowserEventBindings({ tabManagement, waitForFullInit } = {}) {
  return {
    windowIdNone: chromeApi?.windows?.WINDOW_ID_NONE ?? -1,
    readLastFocusedWindow: (queryInfo = {}) => (
      readChromeCallbackOrPromise(
        chromeApi?.windows?.getLastFocused,
        [queryInfo],
        null,
        chromeApi?.windows,
      )
    ),
    registerBrowserListeners: ({
      handleAlarm,
      handleTabCreated,
      handleTabActivated,
      handleWindowFocusChanged,
      handleTabUpdated,
      handleTabRemoved,
      handleTabReplaced,
      handleWebNavigationCommitted,
      handleWebNavigationHistoryStateUpdated,
      handleHistoryVisited,
      handleBookmarkCreated,
      handleBookmarkChanged,
      handleBookmarkImportBegan,
      handleBookmarkImportEnded,
      handlePermissionAdded,
      handlePermissionRemoved,
      handleBuildCapabilityActionClicked,
      combinedMessageHandler,
      handleSuspend,
    } = {}) => {
      addObservedBackgroundBrowserListener(chromeApi?.alarms?.onAlarm, handleAlarm, 'alarms.onAlarm');
      addObservedBackgroundBrowserListener(chromeApi?.tabs?.onCreated, handleTabCreated, 'tabs.onCreated');
      addObservedBackgroundBrowserListener(chromeApi?.tabs?.onActivated, handleTabActivated, 'tabs.onActivated');
      addObservedBackgroundBrowserListener(chromeApi?.windows?.onFocusChanged, handleWindowFocusChanged, 'windows.onFocusChanged');
      addObservedBackgroundBrowserListener(chromeApi?.tabs?.onUpdated, handleTabUpdated, 'tabs.onUpdated');
      addObservedBackgroundBrowserListener(chromeApi?.tabs?.onRemoved, handleTabRemoved, 'tabs.onRemoved');
      addObservedBackgroundBrowserListener(chromeApi?.tabs?.onReplaced, handleTabReplaced, 'tabs.onReplaced');
      addObservedBackgroundBrowserListener(chromeApi?.webNavigation?.onCommitted, handleWebNavigationCommitted, 'webNavigation.onCommitted');
      addObservedBackgroundBrowserListener(chromeApi?.webNavigation?.onHistoryStateUpdated, handleWebNavigationHistoryStateUpdated, 'webNavigation.onHistoryStateUpdated');
      addObservedBackgroundBrowserListener(chromeApi?.history?.onVisited, handleHistoryVisited, 'history.onVisited');
      addObservedBackgroundBrowserListener(chromeApi?.bookmarks?.onCreated, handleBookmarkCreated, 'bookmarks.onCreated');
      addObservedBackgroundBrowserListener(chromeApi?.bookmarks?.onChanged, handleBookmarkChanged, 'bookmarks.onChanged');
      addObservedBackgroundBrowserListener(chromeApi?.bookmarks?.onImportBegan, handleBookmarkImportBegan, 'bookmarks.onImportBegan');
      addObservedBackgroundBrowserListener(chromeApi?.bookmarks?.onImportEnded, handleBookmarkImportEnded, 'bookmarks.onImportEnded');
      addObservedBackgroundBrowserListener(chromeApi?.permissions?.onAdded, handlePermissionAdded, 'permissions.onAdded');
      addObservedBackgroundBrowserListener(chromeApi?.permissions?.onRemoved, handlePermissionRemoved, 'permissions.onRemoved');
      addObservedBackgroundBrowserListener(
        chromeApi?.action?.onClicked,
        handleBuildCapabilityActionClicked,
        'action.onClicked',
      );
      runtimeOnMessageAddListener(combinedMessageHandler);
      addObservedBackgroundBrowserListener(chromeApi?.runtime?.onSuspend, handleSuspend, 'runtime.onSuspend');
      if (tabManagement) {
        const afterInit = (label, task) => (...args) => {
          if (typeof waitForFullInit !== 'function') throw new Error('TAB_MANAGEMENT_INIT_OWNER_REQUIRED');
          return waitForFullInit({ label: `tab_management:${label}`, task: () => task(...args) });
        };
        addObservedBackgroundBrowserListener(chromeApi?.tabs?.onCreated, afterInit('created', tab => tabManagement.observeTab(tab.id)), 'tabs.onCreated:tab_management');
        const observeUpdated = afterInit('updated', tabId => tabManagement.observeTab(tabId));
        addObservedBackgroundBrowserListener(chromeApi?.tabs?.onUpdated, (tabId, change) => {
          if (['url', 'status', 'groupId', 'pinned'].some(key => Object.hasOwn(change, key))) return observeUpdated(tabId);
        }, 'tabs.onUpdated:tab_management');
        addObservedBackgroundBrowserListener(chromeApi?.tabs?.onActivated, afterInit('activated', info => tabManagement.observeTab(info.tabId)), 'tabs.onActivated:tab_management');
        addObservedBackgroundBrowserListener(chromeApi?.tabs?.onRemoved, afterInit('removed', () => tabManagement.refresh()), 'tabs.onRemoved:tab_management');
        addObservedBackgroundBrowserListener(chromeApi?.tabs?.onReplaced, afterInit('replaced', tabId => tabManagement.observeTab(tabId)), 'tabs.onReplaced:tab_management');
        addObservedBackgroundBrowserListener(chromeApi?.tabs?.onAttached, afterInit('attached', tabId => tabManagement.observeTab(tabId)), 'tabs.onAttached:tab_management');
        addObservedBackgroundBrowserListener(chromeApi?.tabs?.onDetached, afterInit('detached', () => tabManagement.refresh()), 'tabs.onDetached:tab_management');
        addObservedBackgroundBrowserListener(chromeApi?.permissions?.onRemoved, afterInit('permission_removed', () => tabManagement.refresh()), 'permissions.onRemoved:tab_management');
        addObservedBackgroundBrowserListener(chromeApi?.permissions?.onAdded, afterInit('permission_added', () => tabManagement.refresh()), 'permissions.onAdded:tab_management');
        addObservedBackgroundBrowserListener(chromeApi?.tabGroups?.onRemoved, afterInit('group_removed', () => tabManagement.refresh()), 'tabGroups.onRemoved:tab_management');
      }
    },
  };
}
