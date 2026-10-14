import { normalizeDomain } from '../../../../lib/domain.js';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '../../../../platform/build/releaseCapabilities.js';
import { resolveTrustedSenderTabId } from '../../../../platform/security/senderTrust.js';
import { normalizeDebugConfig } from '../../../settings/config/debugConfig.js';

export const DEBUG_NUDGE_CONTROL_SOURCES = Object.freeze({
  DASHBOARD: 'dashboard',
  RUNTIME_DEBUGGER: 'runtime_debugger',
});

function parseWebUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function isPageUrlBoundToSenderTab(pageUrl, senderTabUrl) {
  const requested = parseWebUrl(pageUrl);
  const trusted = parseWebUrl(senderTabUrl);
  if (!requested || !trusted) return false;

  const requestedHost = normalizeDomain(requested.hostname);
  const trustedHost = normalizeDomain(trusted.hostname);
  if (!requestedHost || !trustedHost) return false;
  if (requestedHost !== trustedHost) return false;
  if (requested.protocol !== trusted.protocol) return false;

  const requestedPort = requested.port || (requested.protocol === 'https:' ? '443' : '80');
  const trustedPort = trusted.port || (trusted.protocol === 'https:' ? '443' : '80');
  if (requestedPort !== trustedPort) return false;
  return true;
}

async function resolveTrustedSenderTabUrl(sender, browserPort) {
  const senderTabId = resolveTrustedSenderTabId(sender);
  if (senderTabId === null) {
    return { ok: false, url: '', error: 'SENDER_TAB_ID_REQUIRED' };
  }

  const senderTabUrl = String(sender?.tab?.url || '');
  const trustedSenderTabUrl = parseWebUrl(senderTabUrl);
  if (trustedSenderTabUrl) {
    return { ok: true, url: trustedSenderTabUrl.toString(), error: null };
  }

  if (typeof browserPort?.tabsGet !== 'function') {
    return { ok: false, url: '', error: 'SENDER_TAB_URL_OWNER_REQUIRED' };
  }
  try {
    const tab = await browserPort.tabsGet(senderTabId);
    const trustedTabUrl = parseWebUrl(tab?.url || '');
    return trustedTabUrl
      ? { ok: true, url: trustedTabUrl.toString(), error: null }
      : { ok: false, url: '', error: 'SENDER_TAB_URL_INVALID' };
  } catch {
    return { ok: false, url: '', error: 'SENDER_TAB_URL_READ_FAILED' };
  }
}

export function createSupportDebugPolicy({ browserPort, settingsCache } = {}) {
  const authorizeNudgeDebugControl = ({ source = DEBUG_NUDGE_CONTROL_SOURCES.DASHBOARD } = {}) => {
    if (!BUILD_INCLUDE_DEBUG_TOOLS) {
      return { authorized: false, error: 'DEBUG_TOOLS_UNAVAILABLE' };
    }
    if (
      !settingsCache
      || typeof settingsCache !== 'object'
      || Array.isArray(settingsCache)
      || !Object.prototype.hasOwnProperty.call(settingsCache, 'debugConfig')
    ) {
      return { authorized: false, error: 'DEBUG_CONFIG_UNAVAILABLE' };
    }
    const debugConfig = normalizeDebugConfig(settingsCache.debugConfig);
    if (!debugConfig.enabled) {
      return { authorized: false, error: 'DEBUG_NUDGE_CONTROL_DISABLED' };
    }
    if (
      source === DEBUG_NUDGE_CONTROL_SOURCES.RUNTIME_DEBUGGER
      && !debugConfig.runtimeDebuggerEnabled
    ) {
      return { authorized: false, error: 'RUNTIME_DEBUGGER_DISABLED' };
    }
    return { authorized: true, error: null };
  };

  return {
    authorizeNudgeDebugControl,
    isPageUrlBoundToSenderTab,
    resolveTrustedSenderTabUrl: (sender) => resolveTrustedSenderTabUrl(sender, browserPort),
  };
}
