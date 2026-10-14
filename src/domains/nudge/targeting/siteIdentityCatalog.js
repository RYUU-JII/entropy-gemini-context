const SITE_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const RESERVED_SITE_IDS = new Set([
  ...Object.getOwnPropertyNames(Object.prototype),
  'prototype',
]);

function fail(path, reason) {
  const error = new Error(`SITE_IDENTITY_CATALOG_INVALID:${path}:${reason}`);
  error.code = 'SITE_IDENTITY_CATALOG_INVALID';
  error.details = Object.freeze({ path, reason });
  throw error;
}

function failHostname(reason) {
  const error = new Error(`SITE_IDENTITY_HOSTNAME_INVALID:${reason}`);
  error.code = 'SITE_IDENTITY_HOSTNAME_INVALID';
  error.details = Object.freeze({ reason });
  throw error;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateRecordShape(value, path, reason = 'object_required') {
  if (!isPlainObject(value)) fail(path, reason);
  Reflect.ownKeys(value).forEach((key) => {
    if (typeof key !== 'string') fail(path, 'symbol_property_forbidden');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail(`${path}.${key}`, 'enumerable_data_property_required');
    }
  });
}

function validateDenseArray(value, path) {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) fail(`${path}[${index}]`, 'sparse_array_forbidden');
  }
  Reflect.ownKeys(value).forEach((key) => {
    if (key === 'length') return;
    if (
      typeof key !== 'string'
      || !/^(?:0|[1-9][0-9]*)$/u.test(key)
      || Number(key) >= value.length
    ) {
      fail(`${path}.${String(key)}`, 'array_property_forbidden');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail(`${path}.${key}`, 'enumerable_data_property_required');
    }
  });
}

function validateCanonicalHost(hostname, path) {
  if (typeof hostname !== 'string') fail(path, 'string_required');
  if (!hostname || hostname !== hostname.trim() || hostname !== hostname.toLowerCase()) {
    fail(path, 'canonical_hostname_required');
  }
  if (!HOST_PATTERN.test(hostname)) fail(path, 'canonical_hostname_required');
}

export function defineSiteIdentityCatalog(catalog) {
  validateRecordShape(catalog, 'catalog');
  if (!Object.hasOwn(catalog, 'default')) fail('catalog.default', 'default_site_required');

  const registeredHosts = [];
  const normalized = {};
  Object.entries(catalog).forEach(([siteId, declaration]) => {
    if (!SITE_ID_PATTERN.test(siteId) || RESERVED_SITE_IDS.has(siteId)) {
      fail(siteId || 'catalog', 'canonical_site_id_required');
    }
    validateRecordShape(declaration, siteId, 'site_declaration_object_required');
    Object.keys(declaration).forEach((key) => {
      if (key !== 'hostnames') fail(`${siteId}.${key}`, 'unknown_site_identity_key');
    });
    if (!Object.hasOwn(declaration, 'hostnames')) fail(`${siteId}.hostnames`, 'hostnames_required');
    if (!Array.isArray(declaration.hostnames)) fail(`${siteId}.hostnames`, 'array_required');
    validateDenseArray(declaration.hostnames, `${siteId}.hostnames`);
    if (siteId === 'default' && declaration.hostnames.length !== 0) {
      fail(`${siteId}.hostnames`, 'default_hosts_forbidden');
    }
    if (siteId !== 'default' && declaration.hostnames.length === 0) {
      fail(`${siteId}.hostnames`, 'site_host_required');
    }

    const localHosts = new Set();
    declaration.hostnames.forEach((hostname, index) => {
      const path = `${siteId}.hostnames[${index}]`;
      validateCanonicalHost(hostname, path);
      if (localHosts.has(hostname)) fail(path, 'duplicate_hostname');
      for (const localHostname of localHosts) {
        if (
          hostname.endsWith(`.${localHostname}`)
          || localHostname.endsWith(`.${hostname}`)
        ) {
          fail(path, 'redundant_hostname_alias');
        }
      }
      localHosts.add(hostname);
      for (const registered of registeredHosts) {
        const overlaps = hostname === registered.hostname
          || hostname.endsWith(`.${registered.hostname}`)
          || registered.hostname.endsWith(`.${hostname}`);
        if (overlaps && registered.siteId !== siteId) fail(path, 'hostname_owner_collision');
      }
      registeredHosts.push({ hostname, siteId });
    });

    normalized[siteId] = Object.freeze({
      hostnames: Object.freeze([...declaration.hostnames]),
    });
  });

  return Object.freeze(normalized);
}

const SITE_IDENTITIES = defineSiteIdentityCatalog({
  default: { hostnames: [] },
  youtube: { hostnames: ['youtube.com', 'youtu.be'] },
  x: { hostnames: ['x.com', 'twitter.com'] },
  instagram: { hostnames: ['instagram.com'] },
  tiktok: { hostnames: ['tiktok.com'] },
  facebook: { hostnames: ['facebook.com', 'fb.com'] },
  reddit: { hostnames: ['reddit.com'] },
});

export const SUPPORTED_SITE_IDS = Object.freeze(Object.keys(SITE_IDENTITIES));

const SITE_IDENTITY_ENTRIES = Object.freeze(
  Object.entries(SITE_IDENTITIES).filter(([siteId]) => siteId !== 'default'),
);

function isCanonicalBracketedIpv6(hostname) {
  if (!/^\[[0-9a-f:.]+\]$/u.test(hostname)) return false;
  try {
    return new URL(`http://${hostname}/`).hostname === hostname;
  } catch {
    return false;
  }
}

export function normalizeSiteHostname(hostname = '') {
  if (typeof hostname !== 'string') failHostname('string_required');
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return '';

  const withoutTerminalDot = normalized.endsWith('.')
    ? normalized.slice(0, -1)
    : normalized;
  if (
    !withoutTerminalDot
    || (!HOST_PATTERN.test(withoutTerminalDot) && !isCanonicalBracketedIpv6(withoutTerminalDot))
  ) {
    failHostname('hostname_shape_required');
  }
  return withoutTerminalDot.replace(/^www\./, '');
}

function matchesHost(host, candidates) {
  return candidates.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
}

export function resolveSiteId(hostname = '') {
  const host = normalizeSiteHostname(hostname);
  if (!host) return 'default';
  for (const [siteId, identity] of SITE_IDENTITY_ENTRIES) {
    if (matchesHost(host, identity.hostnames)) return siteId;
  }
  return 'default';
}
