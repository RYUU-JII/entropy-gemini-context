import { normalizeDomain } from './domain.js';

function isValidIpv4Address(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const numeric = Number(part);
    return Number.isInteger(numeric) && numeric >= 0 && numeric <= 255;
  });
}

function isValidIpv6Address(value) {
  const safe = String(value || '').trim().toLowerCase();
  if (!safe || !safe.includes(':')) return false;
  try {
    const parsed = new URL(`http://[${safe}]/`);
    const resolved = String(parsed.hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
    return resolved === safe;
  } catch {
    return false;
  }
}

function isValidDomainLabel(label) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label);
}

function normalizeDomainForOriginPermission(domain) {
  const raw = typeof domain === 'string' ? domain.trim().toLowerCase() : '';
  if (!raw) return '';

  if (raw.startsWith('[')) {
    // A host boundary must reject trailing authority/path input rather than
    // let the general UI domain normalizer truncate it into a wider grant.
    const match = raw.match(/^\[([^\]]+)\]$/);
    return match && isValidIpv6Address(match[1]) ? match[1] : '';
  }

  if (isValidIpv6Address(raw)) return raw;
  if (!/^[a-z0-9.-]+$/.test(raw) || raw.includes('..')) return '';

  return normalizeDomain(raw);
}

function supportsSubdomainWildcard(hostname) {
  if (!hostname) return false;
  if (hostname === 'localhost') return false;
  if (isValidIpv4Address(hostname)) return false;
  if (isValidIpv6Address(hostname)) return false;
  return true;
}

export function isValidDomainForOriginPermission(domain) {
  const normalized = normalizeDomainForOriginPermission(domain);
  if (!normalized) return false;
  if (normalized === '*' || normalized.includes('*')) return false;
  if (normalized.startsWith('.') || normalized.includes('..')) return false;
  if (normalized === 'localhost') return true;
  if (isValidIpv4Address(normalized)) return true;
  if (isValidIpv6Address(normalized)) return true;
  if (normalized.length > 253 || /^[\d.]+$/.test(normalized)) return false;

  const labels = normalized.split('.');
  if (labels.length < 2) return false;
  if (!labels.every(isValidDomainLabel)) return false;

  const tld = labels[labels.length - 1];
  if (!tld || tld.length < 2) return false;
  return true;
}

export function normalizePermissionDomainInput(value) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  let hostname = raw;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    if (!/^https?:\/\//i.test(raw) || /[\\\s]/.test(raw)) return '';
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      return '';
    }
    // Validate the complete authority before extracting its host. URL parsing
    // can otherwise discard credentials/ports or reinterpret malformed input.
    const authority = raw.slice(raw.indexOf('://') + 3).split(/[/?#]/)[0];
    const authorityHost = normalizeDomainForOriginPermission(authority);
    const parsedHost = normalizeDomainForOriginPermission(parsed.hostname);
    if (!authorityHost || authorityHost !== parsedHost || parsed.username || parsed.password || parsed.port) return '';
    hostname = parsed.hostname;
  }

  const normalized = normalizeDomainForOriginPermission(hostname);
  return isValidDomainForOriginPermission(normalized) ? normalized : '';
}

export function buildOriginPatternsForDomain(domain) {
  const normalized = normalizeDomainForOriginPermission(domain);
  if (!isValidDomainForOriginPermission(normalized)) return [];

  if (normalized === 'localhost' || isValidIpv4Address(normalized)) {
    return [`*://${normalized}/*`];
  }

  if (isValidIpv6Address(normalized)) {
    return [`*://[${normalized}]/*`];
  }

  return [`*://${normalized}/*`, `*://*.${normalized}/*`];
}

export function buildExactOriginPatternForUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const hostname = parsed.hostname;
  if (!hostname) return null;
  return `${parsed.protocol}//${hostname}/*`;
}

export function getUniqueOrigins(origins = []) {
  if (!Array.isArray(origins)) return [];
  const seen = new Set();
  const next = [];
  origins.forEach((origin) => {
    const value = typeof origin === 'string' ? origin.trim() : '';
    if (!value || seen.has(value)) return;
    seen.add(value);
    next.push(value);
  });
  return next;
}

export function isConcreteOriginPermissionPattern(origin) {
  const value = typeof origin === 'string' ? origin.trim().toLowerCase() : '';
  if (!value) return false;

  const match = value.match(/^(?:\*|https?):\/\/((?:\*\.)?(?:[a-z0-9.-]+|\[[0-9a-f:.]+\]))\/\*$/);
  if (!match) return false;

  const rawHostPattern = String(match[1] || '').trim();
  if (!rawHostPattern || rawHostPattern === '*') return false;
  if (rawHostPattern.startsWith('*.')) {
    const base = normalizeDomainForOriginPermission(rawHostPattern.slice(2));
    return isValidDomainForOriginPermission(base) && supportsSubdomainWildcard(base);
  }

  const hostname = normalizeDomainForOriginPermission(rawHostPattern);
  return isValidDomainForOriginPermission(hostname);
}

export function requireConcreteOriginPermissions(
  origins = [],
  errorCode = 'HOST_PERMISSION_ORIGIN_CONTRACT_INVALID',
) {
  if (!Array.isArray(origins)) {
    const error = new Error(`${errorCode}:origins`);
    error.code = errorCode;
    error.field = 'origins';
    throw error;
  }
  const invalidIndex = origins.findIndex((origin) => typeof origin !== 'string' || !origin.trim());
  if (invalidIndex !== -1) {
    const error = new Error(`${errorCode}:origins[${invalidIndex}]`);
    error.code = errorCode;
    error.field = `origins[${invalidIndex}]`;
    throw error;
  }
  const uniqueOrigins = getUniqueOrigins(origins);
  const invalidOrigin = uniqueOrigins.find((origin) => !isConcreteOriginPermissionPattern(origin));
  if (invalidOrigin) {
    const error = new Error(`${errorCode}:${invalidOrigin}`);
    error.code = errorCode;
    error.origin = invalidOrigin;
    throw error;
  }
  return uniqueOrigins;
}

export function createOriginPermissionMatcher(origins = []) {
  const uniqueOrigins = requireConcreteOriginPermissions(origins);
  const exactHosts = new Set();
  const wildcardBases = new Set();

  uniqueOrigins.forEach((origin) => {
    const value = String(origin || '').trim().toLowerCase();
    const match = value.match(/^(?:\*|https?):\/\/([^/]+)\/\*$/);
    if (!match) {
      throw new Error(`HOST_PERMISSION_ORIGIN_CONTRACT_INVALID:${value}`);
    }

    const rawHostPattern = String(match[1] || '').trim().toLowerCase().replace(/\.+$/g, '');
    if (rawHostPattern.startsWith('*.')) {
      const base = normalizeDomainForOriginPermission(rawHostPattern.slice(2));
      if (!isValidDomainForOriginPermission(base) || !supportsSubdomainWildcard(base)) {
        throw new Error(`HOST_PERMISSION_ORIGIN_CONTRACT_INVALID:${value}`);
      }
      wildcardBases.add(base);
      return;
    }
    const hostPattern = normalizeDomainForOriginPermission(rawHostPattern);
    if (!isValidDomainForOriginPermission(hostPattern)) {
      throw new Error(`HOST_PERMISSION_ORIGIN_CONTRACT_INVALID:${value}`);
    }
    exactHosts.add(hostPattern);
  });

  return Object.freeze({
    hasDomain(domain) {
      const normalized = normalizeDomainForOriginPermission(domain);
      if (!isValidDomainForOriginPermission(normalized)) return false;
      if (exactHosts.has(normalized)) return true;
      let candidate = normalized;
      while (candidate) {
        if (wildcardBases.has(candidate)) return true;
        const separatorIndex = candidate.indexOf('.');
        if (separatorIndex < 0) break;
        candidate = candidate.slice(separatorIndex + 1);
      }
      return false;
    },
  });
}

export function hasOriginPermissionForDomain(origins = [], domain) {
  return createOriginPermissionMatcher(origins).hasDomain(domain);
}
