import { getHostname } from '../../../lib/index.js';

function requireTabContextBrowserPort(browserPort) {
    if (!browserPort || typeof browserPort.tabsQuery !== 'function') {
        throw new Error('TRACKING_TAB_CONTEXT_BROWSER_PORT_REQUIRED');
    }
    return browserPort;
}

export async function readTabContextSnapshot(browserPort, {
    hostname,
    tabId,
    url,
} = {}) {
    const resolvedBrowserPort = requireTabContextBrowserPort(browserPort);
    const targetHostname = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
    if (!targetHostname) return { totalOpenTabs: 0, sameDomainOpenTabs: 0 };

    const tabs = await resolvedBrowserPort.tabsQuery({});
    let totalOpenTabs = 0;
    let sameDomainOpenTabs = 0;
    const normalizedTabId = Number(tabId);
    const currentTabId = Number.isInteger(normalizedTabId) && normalizedTabId >= 0 ? normalizedTabId : null;
    const currentUrl = typeof url === 'string' ? url : '';
    (Array.isArray(tabs) ? tabs : []).forEach((tab) => {
        if (!Number.isInteger(Number(tab?.id))) return;
        totalOpenTabs += 1;
        const tabUrl = currentTabId !== null && Number(tab.id) === currentTabId
            ? (currentUrl || tab.url || tab.pendingUrl || '')
            : (tab.url || tab.pendingUrl || '');
        if (getHostname(tabUrl) === targetHostname) {
            sameDomainOpenTabs += 1;
        }
    });
    if (currentTabId !== null && sameDomainOpenTabs <= 0) {
        sameDomainOpenTabs = 1;
    }
    return { totalOpenTabs, sameDomainOpenTabs };
}
