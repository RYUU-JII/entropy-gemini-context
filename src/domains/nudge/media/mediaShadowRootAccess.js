import { getExtensionApi } from '../../../platform/extension/extensionApi.js';

// Chrome exposes closed roots to extension worlds. Open-only environments remain
// explicit capabilities (including DOM test environments), not failed API reads.
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const NATIVE_CONTROL_HOSTS = new Set([
  'video', 'audio', 'input', 'select', 'textarea', 'option', 'optgroup',
  'meter', 'progress', 'img',
]);

export function getMediaShadowRootAccessCapabilities() {
  const closedShadowSupported = typeof getExtensionApi()?.dom?.openOrClosedShadowRoot === 'function';
  return Object.freeze({
    mode: closedShadowSupported ? 'open_and_closed' : 'open_only',
    closedShadowSupported,
  });
}

export function readMediaShadowRoot(element) {
  // chrome.dom accepts HTMLElement only. Native control internals are browser
  // ownership, not author player roots, even when the API exposes them.
  if (
    element?.nodeType !== 1
    || element.namespaceURI !== HTML_NAMESPACE
    || NATIVE_CONTROL_HOSTS.has(element.localName)
  ) return null;
  const openRoot = element.shadowRoot;
  if (openRoot) return openRoot;
  const dom = getExtensionApi()?.dom;
  if (typeof dom?.openOrClosedShadowRoot !== 'function') return null;
  let root;
  try {
    root = dom.openOrClosedShadowRoot(element);
  } catch (cause) {
    throw new Error('MEDIA_SHADOW_ROOT_ACCESS_FAILED', { cause });
  }
  if (root == null) return null;
  if (root.nodeType !== 11 || root.host !== element || typeof root.querySelectorAll !== 'function') {
    throw new Error('MEDIA_SHADOW_ROOT_RESULT_INVALID');
  }
  return root;
}
