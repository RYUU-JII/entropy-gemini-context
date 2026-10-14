const PACKAGED_EXTENSION_PROTOCOLS = new Set([
  'chrome-extension:',
  'moz-extension:',
  'safari-web-extension:',
]);

const requireUrl = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`PACKAGED_EXTENSION_ASSET_${label}_URL_REQUIRED`);
  }
  try {
    return new URL(value);
  } catch (_) {
    throw new Error(`PACKAGED_EXTENSION_ASSET_${label}_URL_INVALID`);
  }
};

export const fetchPackagedExtensionAsset = async (
  assetUrl,
  { runtimeUrl = globalThis.location?.href, signal, cache = 'force-cache' } = {},
) => {
  const runtime = requireUrl(runtimeUrl, 'RUNTIME');
  const asset = requireUrl(assetUrl, 'TARGET');
  if (!PACKAGED_EXTENSION_PROTOCOLS.has(runtime.protocol)) {
    throw new Error(
      `PACKAGED_EXTENSION_ASSET_RUNTIME_PROTOCOL_INVALID:${runtime.protocol}`,
    );
  }
  if (
    asset.protocol !== runtime.protocol
    || asset.host !== runtime.host
    || asset.username
    || asset.password
  ) {
    throw new Error('PACKAGED_EXTENSION_ASSET_ORIGIN_MISMATCH');
  }
  if (cache !== 'force-cache' && cache !== 'no-store') {
    throw new Error('PACKAGED_EXTENSION_ASSET_CACHE_MODE_INVALID');
  }
  return fetch(asset.href, {
    method: 'GET',
    signal,
    credentials: 'same-origin',
    cache,
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  });
};
