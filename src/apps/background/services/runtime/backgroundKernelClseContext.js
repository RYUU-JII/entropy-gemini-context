import { getHostname } from '../../../../lib/index.js';

function resolveClseContextBrowserPort(browserPort) {
  if (
    typeof browserPort?.tabsGet !== 'function'
    || typeof browserPort?.tabsQuery !== 'function'
  ) {
    throw new Error('CLSE_CONTEXT_BROWSER_PORT_REQUIRED');
  }
  return browserPort;
}

export function createResolveClseContextHostname({ browserPort } = {}) {
  const resolvedBrowserPort = resolveClseContextBrowserPort(browserPort);

  return async function resolveClseContextHostname(context = {}) {
    if (context.hostname) return context.hostname;

    const url = context.url || context?.sender?.tab?.url || null;
    if (url) return getHostname(url);

    if (context.tabId) {
      const tab = await resolvedBrowserPort.tabsGet(context.tabId);
      if (tab?.url) return getHostname(tab.url);
    }

    if (context.requireActiveTab) {
      const tabs = await resolvedBrowserPort.tabsQuery({ active: true, lastFocusedWindow: true });
      if (tabs?.[0]?.url) return getHostname(tabs[0].url);
    }

    return null;
  };
}
