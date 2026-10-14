import {
  getExtensionApi,
  getExtensionRuntimeId,
} from '../extension/extensionApi.js';

function resolveRuntimeId() {
  return String(getExtensionRuntimeId() || '').trim();
}

function resolveSenderExtensionOrigin(sender) {
  const senderUrl = resolveSenderPageUrl(sender);
  if (!senderUrl) return null;
  try {
    const parsed = new URL(senderUrl);
    if (parsed.protocol !== 'chrome-extension:') return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch (_error) {
    return null;
  }
}

function resolveRuntimeIdForPageSender(sender, runtimeIdOption) {
  const runtimeId = typeof runtimeIdOption === 'string' && runtimeIdOption.trim()
    ? runtimeIdOption.trim()
    : resolveRuntimeId();
  if (runtimeId) return runtimeId;

  const senderId = String(sender?.id || '').trim();
  if (!senderId) return '';
  const senderOrigin = resolveSenderExtensionOrigin(sender);
  return senderOrigin === `chrome-extension://${senderId}` ? senderId : '';
}

function resolveRuntimeOrigin(runtimeId) {
  const runtimeUrl = getExtensionApi()?.runtime?.getURL?.('');
  if (runtimeUrl) {
    try {
      const parsed = new URL(runtimeUrl);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (_error) {
      return '';
    }
  }
  return runtimeId ? `chrome-extension://${runtimeId}` : '';
}

function isTrustedExtensionPageUrl(url, runtimeId) {
  const runtimeOrigin = resolveRuntimeOrigin(runtimeId);
  return typeof url === 'string' && !!runtimeOrigin && url.startsWith(`${runtimeOrigin}/`);
}

export function resolveSenderPageUrl(sender) {
  if (typeof sender?.url === 'string' && sender.url.trim()) return sender.url.trim();
  if (typeof sender?.documentUrl === 'string' && sender.documentUrl.trim()) return sender.documentUrl.trim();
  if (typeof sender?.origin === 'string' && sender.origin.trim()) return sender.origin.trim();
  return '';
}

export function resolveTrustedSenderTabId(sender) {
  const tabId = Number(sender?.tab?.id);
  if (!Number.isFinite(tabId) || tabId < 0) return null;
  return Math.floor(tabId);
}

export function resolveSenderDocumentId(sender) {
  if (typeof sender?.documentId !== 'string') return null;
  const documentId = sender.documentId.trim();
  return documentId || null;
}

export function resolveSenderFrameId(sender) {
  const frameId = Number(sender?.frameId);
  if (!Number.isInteger(frameId) || frameId < 0) return null;
  return frameId;
}

export function isTrustedExtensionSender(sender, { runtimeId: runtimeIdOption = null } = {}) {
  const runtimeId = typeof runtimeIdOption === 'string' && runtimeIdOption.trim()
    ? runtimeIdOption.trim()
    : resolveRuntimeId();
  if (!runtimeId) return false;
  const senderId = String(sender?.id || '').trim();
  return senderId === runtimeId;
}

export function isTrustedExtensionBackgroundSender(
  sender,
  {
    runtimeId: runtimeIdOption = null,
    serviceWorkerPath = '/service-worker-loader.js',
  } = {},
) {
  const runtimeId = typeof runtimeIdOption === 'string' && runtimeIdOption.trim()
    ? runtimeIdOption.trim()
    : resolveRuntimeId();
  if (!runtimeId || !isTrustedExtensionSender(sender, { runtimeId })) return false;
  if (resolveTrustedSenderTabId(sender) !== null) return false;

  const senderUrl = resolveSenderPageUrl(sender);
  if (!senderUrl) return true;
  try {
    const parsed = new URL(senderUrl);
    const normalizedServiceWorkerPath = String(serviceWorkerPath || '').startsWith('/')
      ? String(serviceWorkerPath)
      : `/${String(serviceWorkerPath || '')}`;
    return `${parsed.protocol}//${parsed.host}` === resolveRuntimeOrigin(runtimeId)
      && parsed.pathname === normalizedServiceWorkerPath;
  } catch (_error) {
    return false;
  }
}

export function isTrustedExtensionTabSender(sender, { runtimeId: runtimeIdOption = null } = {}) {
  const runtimeId = typeof runtimeIdOption === 'string' && runtimeIdOption.trim()
    ? runtimeIdOption.trim()
    : resolveRuntimeId();
  if (!isTrustedExtensionSender(sender, { runtimeId })) return false;

  const senderTabId = resolveTrustedSenderTabId(sender);
  if (senderTabId === null) return false;

  return !isTrustedExtensionPageUrl(resolveSenderPageUrl(sender), runtimeId);
}

export function isTrustedExtensionPageSender(
  sender,
  {
    runtimeId: runtimeIdOption = null,
    allowInternalNoUrl = false,
  } = {},
) {
  const runtimeId = resolveRuntimeIdForPageSender(sender, runtimeIdOption);
  if (!runtimeId) return false;

  const senderId = String(sender?.id || '').trim();
  if (senderId && senderId !== runtimeId) return false;

  const senderUrl = resolveSenderPageUrl(sender);
  if (!senderUrl) {
    const senderTabId = resolveTrustedSenderTabId(sender);
    if (senderTabId !== null) return false;
    return allowInternalNoUrl === true && senderId === runtimeId;
  }
  return isTrustedExtensionPageUrl(senderUrl, runtimeId);
}

export function isTrustedDashboardPageSender(sender, options = {}) {
  if (!isTrustedExtensionPageSender(sender, options)) return false;
  try {
    return new URL(resolveSenderPageUrl(sender)).pathname === '/src/pages/dashboard.html';
  } catch (_error) {
    return false;
  }
}

export function isPrivilegedSettingsFlowSender(sender, { runtimeId: runtimeIdOption = null } = {}) {
  const runtimeId = typeof runtimeIdOption === 'string' && runtimeIdOption.trim()
    ? runtimeIdOption.trim()
    : resolveRuntimeId();
  if (!runtimeId) return false;
  if (isTrustedExtensionPageSender(sender, { runtimeId })) return true;

  const senderId = String(sender?.id || '').trim();
  if (senderId !== runtimeId) return false;

  const senderTabId = resolveTrustedSenderTabId(sender);
  if (senderTabId !== null) return false;
  return !resolveSenderPageUrl(sender);
}
