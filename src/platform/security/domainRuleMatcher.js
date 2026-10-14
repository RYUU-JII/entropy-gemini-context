import { normalizeDomain } from '../../lib/domain.js';
import { buildObservedSiteHostCandidates } from '../../lib/siteIdentity.js';
import { computeDomainHmac } from './domainHashing.js';

const HASH_CANDIDATE_CACHE_TTL_MS = 30_000;
const HASH_CANDIDATE_CACHE_MAX = 500;
const hashCandidateCache = new Map();

function createDomainRuleMatcherError(code, extra = {}) {
  const message = typeof code === 'string' && code.trim()
    ? code.trim()
    : 'DOMAIN_RULE_MATCHER_FAILED';
  const error = new Error(message);
  error.code = message;
  Object.assign(error, extra);
  return error;
}

function toHashSet(values) {
  if (values === null || values === undefined) return null;
  if (!Array.isArray(values)) {
    throw createDomainRuleMatcherError('DOMAIN_HASH_LIST_INVALID');
  }
  return new Set(values.filter((value) => typeof value === 'string' && value.trim()));
}

function normalizeHashMap(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw createDomainRuleMatcherError('DOMAIN_HASH_MAP_INVALID');
  }
  return value;
}

export function buildDomainCandidates(domain) {
  return buildObservedSiteHostCandidates(domain);
}

function getHashCacheKey(domain, secretBase64Url) {
  const normalized = normalizeDomain(domain);
  if (!normalized || !secretBase64Url) return '';
  return `${secretBase64Url}:${normalized}`;
}

function getCachedHashCandidates(cacheKey) {
  if (!cacheKey) return null;
  const cached = hashCandidateCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    hashCandidateCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function setCachedHashCandidates(cacheKey, value) {
  if (!cacheKey) return;
  hashCandidateCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + HASH_CANDIDATE_CACHE_TTL_MS,
  });
  if (hashCandidateCache.size <= HASH_CANDIDATE_CACHE_MAX) return;
  const oldestKey = hashCandidateCache.keys().next().value;
  if (oldestKey) hashCandidateCache.delete(oldestKey);
}

async function buildHashCandidates(domain, secretBase64Url) {
  const cacheKey = getHashCacheKey(domain, secretBase64Url);
  const cached = getCachedHashCandidates(cacheKey);
  if (cached) return cached;

  const candidates = buildDomainCandidates(domain);
  if (!candidates.length) return [];
  const hashed = [];
  for (const candidate of candidates) {
    const hash = await computeDomainHmac(candidate, secretBase64Url);
    if (!hash) continue;
    hashed.push({ candidate, hash });
  }
  setCachedHashCandidates(cacheKey, hashed);
  return hashed;
}

export async function buildDomainHashCandidates(domain, secretBase64Url) {
  return buildHashCandidates(domain, secretBase64Url);
}

export async function isDomainInHashList(
  domain,
  hashList,
  secretBase64Url,
  precomputedCandidates = null
) {
  const set = toHashSet(hashList);
  if (!set) return null;
  if (!set.size) return null;
  if (!secretBase64Url) {
    throw createDomainRuleMatcherError('DOMAIN_HMAC_SECRET_REQUIRED');
  }

  const candidates = Array.isArray(precomputedCandidates)
    ? precomputedCandidates
    : await buildHashCandidates(domain, secretBase64Url);
  for (const entry of candidates) {
    if (set.has(entry.hash)) return true;
  }
  return false;
}

export async function getDomainValueFromHashMap(
  domain,
  hashMap,
  secretBase64Url,
  precomputedCandidates = null
) {
  const map = normalizeHashMap(hashMap);
  if (!map) return undefined;
  if (!Object.keys(map).length) return undefined;
  if (!secretBase64Url) {
    throw createDomainRuleMatcherError('DOMAIN_HMAC_SECRET_REQUIRED');
  }

  const candidates = Array.isArray(precomputedCandidates)
    ? precomputedCandidates
    : await buildHashCandidates(domain, secretBase64Url);
  for (const entry of candidates) {
    if (!Object.prototype.hasOwnProperty.call(map, entry.hash)) continue;
    return map[entry.hash];
  }
  return undefined;
}
