import { normalizeDomain } from '../../lib/domain.js';

const HMAC_ALGO = 'HMAC';
const HASH_ALGO = 'SHA-256';
const hmacKeyPromiseCache = new Map();

export function clearDomainHmacKeyCache() {
  hmacKeyPromiseCache.clear();
}
const CANONICAL_DOMAIN_HASH_PATTERN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;

function createDomainHashingError(code, extra = {}) {
  const message = typeof code === 'string' && code.trim()
    ? code.trim()
    : 'DOMAIN_HASHING_FAILED';
  const error = new Error(message);
  error.code = message;
  Object.assign(error, extra);
  return error;
}

function requireDomainHmacSecret(secretBase64Url) {
  if (typeof secretBase64Url !== 'string' || !secretBase64Url.trim()) {
    throw createDomainHashingError('DOMAIN_HMAC_SECRET_REQUIRED');
  }
  return secretBase64Url.trim();
}

export function requireCanonicalDomainHashList(value) {
  if (!Array.isArray(value)
    || Array.from(value).some((hash) => typeof hash !== 'string' || !CANONICAL_DOMAIN_HASH_PATTERN.test(hash))
    || new Set(value).size !== value.length) {
    throw createDomainHashingError('DOMAIN_HASH_LIST_CONTRACT_INVALID');
  }
  return value;
}

export function requireCanonicalDomainGoalHashMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.entries(value).some(([hash, minutes]) => (
      !CANONICAL_DOMAIN_HASH_PATTERN.test(hash) || !Number.isInteger(minutes) || minutes <= 0
    ))) {
    throw createDomainHashingError('DOMAIN_GOAL_HASH_MAP_CONTRACT_INVALID');
  }
  return value;
}

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function getCryptoApi() {
  if (typeof crypto !== 'undefined' && crypto?.subtle) return crypto;
  throw new Error('Web Crypto API is unavailable');
}

export function createDomainHmacSecret() {
  const webCrypto = getCryptoApi();
  const bytes = new Uint8Array(32);
  webCrypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function importHmacKey(secretBase64Url) {
  const secret = requireDomainHmacSecret(secretBase64Url);
  const cached = hmacKeyPromiseCache.get(secret);
  if (cached) return cached;

  const webCrypto = getCryptoApi();
  let rawKey;
  try {
    rawKey = fromBase64Url(secret);
  } catch (error) {
    throw createDomainHashingError('DOMAIN_HMAC_SECRET_DECODE_FAILED', { cause: error });
  }
  const importPromise = webCrypto.subtle.importKey(
    'raw',
    rawKey,
    { name: HMAC_ALGO, hash: HASH_ALGO },
    false,
    ['sign']
  );
  hmacKeyPromiseCache.set(secret, importPromise);
  try {
    return await importPromise;
  } catch (error) {
    hmacKeyPromiseCache.delete(secret);
    throw error;
  }
}

export async function computeDomainHmac(domain, secretBase64Url) {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    throw createDomainHashingError('DOMAIN_HMAC_DOMAIN_INVALID');
  }
  const webCrypto = getCryptoApi();
  const key = await importHmacKey(secretBase64Url);
  const data = new TextEncoder().encode(normalized);
  const signature = await webCrypto.subtle.sign(HMAC_ALGO, key, data);
  return toBase64Url(new Uint8Array(signature));
}

export async function hashDomainList(domains = [], secretBase64Url) {
  if (!Array.isArray(domains)) {
    throw createDomainHashingError('DOMAIN_HASH_LIST_INPUT_INVALID');
  }
  const normalizedDomains = [];
  const seenDomains = new Set();
  for (const domain of domains) {
    const normalized = normalizeDomain(domain);
    if (!normalized || seenDomains.has(normalized)) continue;
    seenDomains.add(normalized);
    normalizedDomains.push(normalized);
  }
  if (!normalizedDomains.length) return [];

  const secret = requireDomainHmacSecret(secretBase64Url);
  const computedHashes = await Promise.all(
    normalizedDomains.map((domain) => computeDomainHmac(domain, secret))
  );
  const dedupeHashes = new Set();
  const hashes = [];
  for (const hash of computedHashes) {
    if (!hash || dedupeHashes.has(hash)) continue;
    dedupeHashes.add(hash);
    hashes.push(hash);
  }
  return hashes;
}

export async function hashDomainValueMap(entries = {}, secretBase64Url) {
  if (entries === null || typeof entries !== 'object' || Array.isArray(entries)) {
    throw createDomainHashingError('DOMAIN_HASH_VALUE_MAP_INPUT_INVALID');
  }
  const normalizedEntries = [];
  const seenDomains = new Set();
  for (const [domain, value] of Object.entries(entries)) {
    const normalized = normalizeDomain(domain);
    if (!normalized || seenDomains.has(normalized)) continue;
    seenDomains.add(normalized);
    normalizedEntries.push([normalized, value]);
  }
  if (!normalizedEntries.length) return {};

  const secret = requireDomainHmacSecret(secretBase64Url);
  const computedHashes = await Promise.all(
    normalizedEntries.map(([domain]) => computeDomainHmac(domain, secret))
  );
  const out = {};
  const seen = new Set();
  for (let i = 0; i < normalizedEntries.length; i += 1) {
    const [, value] = normalizedEntries[i];
    const hash = computedHashes[i];
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    out[hash] = value;
  }
  return out;
}
