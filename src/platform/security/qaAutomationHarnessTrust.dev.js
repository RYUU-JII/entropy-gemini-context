import {
  isTrustedExtensionPageSender,
  isTrustedExtensionSender,
  resolveSenderPageUrl,
} from './senderTrust.js';

export const QA_AUTOMATION_HARNESS_PATH = '/entropy-e2e.html';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function isQaAutomationWebUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

export function assertTrustedQaAutomationHarnessSender(
  sender,
  browserPort,
  {
    errorCode = 'QA_AUTOMATION_HARNESS_SENDER_UNTRUSTED',
  } = {},
) {
  const runtimeId = String(browserPort?.getRuntimeId?.() || '').trim();
  if (
    !runtimeId
    || !isTrustedExtensionSender(sender, { runtimeId })
    || !isTrustedExtensionPageSender(sender, { runtimeId })
  ) {
    fail(errorCode);
  }
  let senderUrl;
  try {
    senderUrl = new URL(resolveSenderPageUrl(sender));
  } catch (_error) {
    fail(errorCode);
  }
  const senderOrigin = `${senderUrl.protocol}//${senderUrl.host}`;
  if (
    senderOrigin !== `chrome-extension://${runtimeId}`
    || senderUrl.pathname !== QA_AUTOMATION_HARNESS_PATH
  ) {
    fail(errorCode);
  }
}

export function requireQaAutomationTargetWebTab(
  tab,
  targetTabId,
  {
    errorCode = 'QA_AUTOMATION_TARGET_TAB_UNAVAILABLE',
  } = {},
) {
  if (
    !tab
    || Number(tab.id) !== targetTabId
    || !isQaAutomationWebUrl(tab.url)
  ) {
    fail(errorCode);
  }
  return tab;
}
