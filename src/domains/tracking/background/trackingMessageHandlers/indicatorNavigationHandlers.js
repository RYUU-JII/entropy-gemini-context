import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { isTrustedExtensionTabSender } from '../../../../platform/security/senderTrust.js';
import { normalizeDomain } from '../../../../lib/domain.js';
import { runAsyncHandler } from './runtimeHandlerUtils.js';

const DASHBOARD_PATH = 'src/pages/dashboard.html';

function parseWebUrl(value, errorCode) {
  try {
    if (typeof value !== 'string' || !value.trim()) throw new Error(errorCode);
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
      throw new Error(errorCode);
    }
    return url;
  } catch (_error) {
    throw new Error(errorCode);
  }
}

function resolveSenderSite(request, sender) {
  if (
    !isTrustedExtensionTabSender(sender)
    || !Number.isSafeInteger(sender?.tab?.id)
    || sender.tab.id < 0
    || sender.frameId !== 0
  ) {
    throw new Error('INDICATOR_SITE_RECORD_TRUSTED_TOP_FRAME_REQUIRED');
  }
  const senderUrl = parseWebUrl(sender.url, 'INDICATOR_SITE_RECORD_SENDER_URL_INVALID');
  const requestUrl = parseWebUrl(request?.url, 'INDICATOR_SITE_RECORD_REQUEST_URL_INVALID');
  if (requestUrl.origin !== senderUrl.origin) {
    throw new Error('INDICATOR_SITE_RECORD_REQUEST_URL_MISMATCH');
  }
  return senderUrl;
}

function parseDashboardUrl(value, runtimeId) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'chrome-extension:'
      || url.hostname !== runtimeId
      || url.pathname !== `/${DASHBOARD_PATH}`
      || url.search
      || url.hash
    ) {
      throw new Error('INDICATOR_SITE_RECORD_DASHBOARD_URL_INVALID');
    }
    return url;
  } catch (_error) {
    throw new Error('INDICATOR_SITE_RECORD_DASHBOARD_URL_INVALID');
  }
}

export function createIndicatorNavigationActionHandlers({ browserPort } = {}) {
  for (const method of ['runtimeGetURL', 'tabsGet', 'tabsCreate']) {
    if (typeof browserPort?.[method] !== 'function') {
      throw new Error('INDICATOR_SITE_RECORD_BROWSER_PORT_REQUIRED');
    }
  }

  return {
    [MESSAGE_ACTIONS.OPEN_SITE_RECORD]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const senderUrl = resolveSenderSite(request, sender);
        const currentTab = await browserPort.tabsGet(sender.tab.id);
        if (!currentTab || currentTab.id !== sender.tab.id) {
          throw new Error('INDICATOR_SITE_RECORD_SENDER_TAB_UNAVAILABLE');
        }
        const currentUrl = parseWebUrl(currentTab.url, 'INDICATOR_SITE_RECORD_CURRENT_URL_INVALID');
        if (currentUrl.origin !== senderUrl.origin) {
          throw new Error('INDICATOR_SITE_RECORD_SENDER_TAB_CHANGED');
        }
        if (typeof currentTab.pendingUrl === 'string' && currentTab.pendingUrl) {
          const pendingUrl = parseWebUrl(currentTab.pendingUrl, 'INDICATOR_SITE_RECORD_CURRENT_URL_INVALID');
          if (pendingUrl.origin !== senderUrl.origin) {
            throw new Error('INDICATOR_SITE_RECORD_SENDER_TAB_CHANGED');
          }
        }

        const dashboardUrl = parseDashboardUrl(browserPort.runtimeGetURL(DASHBOARD_PATH), sender.id);
        dashboardUrl.searchParams.set('tab', 'sites');
        dashboardUrl.searchParams.set('domain', normalizeDomain(senderUrl.hostname));
        const openedTab = await browserPort.tabsCreate({ url: dashboardUrl.href, active: true });
        if (!Number.isSafeInteger(openedTab?.id) || openedTab.id < 0) {
          throw new Error('INDICATOR_SITE_RECORD_TAB_CREATE_FAILED');
        }
        return { success: true };
      },
    ),
  };
}
