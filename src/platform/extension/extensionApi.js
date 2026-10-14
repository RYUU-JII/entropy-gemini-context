const EXTENSION_API_NAMESPACES = Object.freeze({
  CHROME: 'chrome',
  BROWSER: 'browser',
});

function readGlobalApi(namespace) {
  try {
    const api = globalThis?.[namespace];
    return api && typeof api === 'object' ? api : null;
  } catch (_error) {
    return null;
  }
}

function hasRuntime(api) {
  return !!api?.runtime;
}

function resolvePreferredNamespace(preferredNamespace) {
  return preferredNamespace === EXTENSION_API_NAMESPACES.BROWSER
    ? EXTENSION_API_NAMESPACES.BROWSER
    : EXTENSION_API_NAMESPACES.CHROME;
}

export function resolveExtensionApi({ preferredNamespace = EXTENSION_API_NAMESPACES.CHROME } = {}) {
  const preferred = resolvePreferredNamespace(preferredNamespace);
  const chromeApi = readGlobalApi(EXTENSION_API_NAMESPACES.CHROME);
  const browserApi = readGlobalApi(EXTENSION_API_NAMESPACES.BROWSER);

  if (preferred === EXTENSION_API_NAMESPACES.BROWSER && hasRuntime(browserApi)) {
    return { api: browserApi, namespace: EXTENSION_API_NAMESPACES.BROWSER };
  }
  if (hasRuntime(chromeApi)) {
    return { api: chromeApi, namespace: EXTENSION_API_NAMESPACES.CHROME };
  }
  if (hasRuntime(browserApi)) {
    return { api: browserApi, namespace: EXTENSION_API_NAMESPACES.BROWSER };
  }

  return { api: null, namespace: null };
}

export function getExtensionApi(options = {}) {
  return resolveExtensionApi(options).api;
}

export function getExtensionApiNamespace(options = {}) {
  return resolveExtensionApi(options).namespace;
}

export function hasExtensionRuntime(options = {}) {
  return hasRuntime(getExtensionApi(options));
}

export function isPromiseExtensionApiNamespace(namespace) {
  return namespace === EXTENSION_API_NAMESPACES.BROWSER;
}

export function getExtensionRuntimeId(options = {}) {
  return getExtensionApi(options)?.runtime?.id || null;
}
