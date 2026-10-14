import {
  extractBaseDomainLabel,
  extractBaseDomainParts,
  isSameBaseDomainMatch,
  normalizeDomain,
} from '../../../lib/domain.js';
import { getHostname } from '../../../lib/index.js';
import { buildSiteRuleHostCandidates, isSiteRuleMatch } from '../../../lib/siteIdentity.js';
import { requireEchoArtifactMutationCurrent } from '../../protection/runtime/echoArtifactMutationPolicy.js';

const HISTORY_SEARCH_PAGE_SIZE = 250;
const HISTORY_DELETE_BATCH_SIZE = 25;
const RECENT_HISTORY_SWEEP_MAX_PAGES = 12;
const REQUIRED_HISTORY_BROWSER_PORT_METHODS = Object.freeze([
  'historySearch',
  'historyDeleteUrl',
]);

const COMMON_PROACTIVE_TLDS = Object.freeze([
  'com',
  'co',
  'net',
  'org',
  'kr',
  'co.kr',
  'io',
  'app',
]);

const KNOWN_SEARCH_HOST_PATTERNS = Object.freeze([
  'google.',
  'bing.com',
  'duckduckgo.com',
  'search.daum.net',
  'search.yahoo.com',
  'search.naver.com',
  'm.search.naver.com',
  'baidu.com',
  'ecosia.org',
  'kagi.com',
  'yandex.',
]);

const KNOWN_SEARCH_QUERY_PARAMS = Object.freeze([
  'q',
  'query',
  'p',
  'wd',
  'text',
  'search_query',
]);

let activeFullCleanupPromise = null;
let activeFullCleanupSignature = '';
let activeFullCleanupIsCurrent = null;

function normalizeBlockedUrlList(blockedUrls = []) {
  return Array.from(
    new Set(
      (Array.isArray(blockedUrls) ? blockedUrls : [])
        .filter((entry) => typeof entry === 'string' && entry.trim())
        .map((entry) => normalizeDomain(entry))
        .filter(Boolean),
    ),
  );
}

function buildBlockedHistorySignature(blockedUrls = []) {
  return normalizeBlockedUrlList(blockedUrls)
    .slice()
    .sort()
    .join('|');
}

export function isSearchEngineHostname(hostname = '') {
  const normalized = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
  if (!normalized) return false;
  return KNOWN_SEARCH_HOST_PATTERNS.some((pattern) => (
    pattern.endsWith('.')
      ? (normalized.includes(pattern) || normalized.endsWith(pattern.slice(0, -1)))
      : (normalized === pattern || normalized.endsWith(`.${pattern}`))
  ));
}

export function extractSearchQuery(url = '') {
  if (typeof url !== 'string' || !url) return '';
  try {
    const parsed = new URL(url);
    if (!isSearchEngineHostname(parsed.hostname)) {
      return '';
    }
    for (const param of KNOWN_SEARCH_QUERY_PARAMS) {
      const val = parsed.searchParams.get(param);
      if (val && typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }
  } catch {
    return '';
  }
  return '';
}

export function isBlockedSearchQueryUrl(url, blockedUrls = []) {
  if (typeof url !== 'string' || !url) return false;
  const query = extractSearchQuery(url);
  if (!query) return false;
  const normalizedQuery = query.toLowerCase();

  const normalizedBlockedUrls = normalizeBlockedUrlList(blockedUrls);
  for (const rule of normalizedBlockedUrls) {
    const candidates = buildSiteRuleHostCandidates(rule);
    for (const candidate of candidates) {
      if (!candidate) continue;
      const lowerCandidate = candidate.toLowerCase();
      if (normalizedQuery.includes(lowerCandidate)) {
        return true;
      }
      const baseLabel = extractBaseDomainLabel(lowerCandidate);
      if (baseLabel && baseLabel.length >= 3 && normalizedQuery.includes(baseLabel)) {
        return true;
      }
    }
  }
  return false;
}

export function buildHistorySearchQueryTerms(blockedUrls = []) {
  const normalizedBlockedUrls = normalizeBlockedUrlList(blockedUrls);
  const terms = new Set();
  normalizedBlockedUrls.forEach((rule) => {
    buildSiteRuleHostCandidates(rule).forEach((candidate) => {
      if (typeof candidate === 'string' && candidate.trim()) {
        const normalizedCandidate = candidate.trim().toLowerCase();
        terms.add(normalizedCandidate);
        const baseLabel = extractBaseDomainLabel(normalizedCandidate);
        if (baseLabel && baseLabel.length >= 3) {
          terms.add(baseLabel);
        }
      }
    });
  });
  return Array.from(terms);
}

export function buildProactiveRootUrlCandidates(blockedUrls = []) {
  const normalizedBlockedUrls = normalizeBlockedUrlList(blockedUrls);
  const urls = new Set();

  normalizedBlockedUrls.forEach((rule) => {
    buildSiteRuleHostCandidates(rule).forEach((candidate) => {
      if (!candidate) return;
      const normCandidate = normalizeDomain(candidate);
      if (!normCandidate) return;

      urls.add(`https://${normCandidate}/`);
      urls.add(`http://${normCandidate}/`);
      if (!normCandidate.startsWith('www.')) {
        urls.add(`https://www.${normCandidate}/`);
        urls.add(`http://www.${normCandidate}/`);
      }

      const parts = extractBaseDomainParts(normCandidate);
      if (parts.baseLabel && parts.baseLabel.length >= 3) {
        const prefix = parts.subdomain ? `${parts.subdomain}.${parts.baseLabel}` : parts.baseLabel;
        COMMON_PROACTIVE_TLDS.forEach((tld) => {
          urls.add(`https://${prefix}.${tld}/`);
          urls.add(`http://${prefix}.${tld}/`);
          if (!parts.subdomain) {
            urls.add(`https://www.${prefix}.${tld}/`);
            urls.add(`http://www.${prefix}.${tld}/`);
          }
        });
      }
    });
  });

  return Array.from(urls);
}

function mergeWithProactiveEntries(matchedEntries = [], blockedUrls = []) {
  const proactiveUrls = buildProactiveRootUrlCandidates(blockedUrls);
  const combinedEntries = [...(Array.isArray(matchedEntries) ? matchedEntries : [])];
  const existingUrls = new Set(combinedEntries.map((entry) => entry?.url).filter(Boolean));

  proactiveUrls.forEach((url) => {
    if (!existingUrls.has(url)) {
      combinedEntries.push({
        url,
        domain: getHostname(url) || normalizeDomain(url) || 'unknown',
        visitCount: 1,
      });
      existingUrls.add(url);
    }
  });

  return combinedEntries;
}

function resolveHistoryBrowserPort(browserPort) {
  const missingMethod = REQUIRED_HISTORY_BROWSER_PORT_METHODS
    .find((method) => typeof browserPort?.[method] !== 'function');
  if (missingMethod) {
    throw new Error(`HISTORY_BROWSER_PORT_METHOD_REQUIRED:${missingMethod}`);
  }
  return browserPort;
}

async function rejectMissingHistoryBrowserPort() {
  throw new Error('HISTORY_BROWSER_PORT_REQUIRED');
}

function resolveHistoryVisitCount(entry) {
  const visitCount = Number(entry?.visitCount);
  return Number.isFinite(visitCount) ? Math.max(1, Math.floor(visitCount)) : 1;
}

function toErrorMessage(error) {
  return String(error?.message || error || 'UNKNOWN_ERROR');
}

function createHistorySearchFailure(error) {
  const nextError = new Error(`HISTORY_SEARCH_FAILED:${toErrorMessage(error)}`);
  nextError.code = 'HISTORY_SEARCH_FAILED';
  return nextError;
}

function createHistoryDeleteFailure(failures = []) {
  const nextError = new Error(`HISTORY_DELETE_FAILED:${failures.length}`);
  nextError.code = 'HISTORY_DELETE_FAILED';
  nextError.failures = failures.slice(0, 8);
  return nextError;
}

function summarizeHistoryEntries(entries = []) {
  const itemsByDomain = new Map();

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const domain = typeof entry?.domain === 'string'
      ? entry.domain.trim().toLowerCase()
      : '';
    if (!domain) return;

    const current = itemsByDomain.get(domain) || {
      domain,
      count: 0,
    };
    current.count += resolveHistoryVisitCount(entry);
    itemsByDomain.set(domain, current);
  });

  return Array.from(itemsByDomain.values())
    .sort((left, right) => {
      const countDelta = Number(right?.count || 0) - Number(left?.count || 0);
      if (countDelta !== 0) return countDelta;
      return String(left?.domain || '').localeCompare(String(right?.domain || ''));
    });
}

function resolveOldestVisitTimestamp(entries = [], fallback = 0) {
  let oldest = Number.isFinite(fallback) ? fallback : 0;

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const lastVisitTime = Number(entry?.lastVisitTime);
    if (!Number.isFinite(lastVisitTime) || lastVisitTime <= 0) return;
    if (!oldest || lastVisitTime < oldest) {
      oldest = lastVisitTime;
    }
  });

  return oldest;
}

export function isBlockedHistoryHostname(hostname, blockedUrls) {
  if (!hostname || !Array.isArray(blockedUrls)) return false;
  return normalizeBlockedUrlList(blockedUrls).some((blocked) => (
    isSiteRuleMatch(hostname, blocked) || isSameBaseDomainMatch(hostname, blocked)
  ));
}

async function collectBlockedHistoryEntries({
  browserPort,
  blockedUrls = [],
  startTime = 0,
  endTime = Date.now(),
  maxPages = Infinity,
} = {}) {
  const normalizedBlockedUrls = normalizeBlockedUrlList(blockedUrls);
  if (!normalizedBlockedUrls.length) {
    return [];
  }

  const queryTerms = buildHistorySearchQueryTerms(normalizedBlockedUrls);
  if (!queryTerms.length) {
    return [];
  }

  const lowerBound = Math.max(0, Math.floor(Number(startTime) || 0));
  const pageLimit = Number.isFinite(maxPages) ? Math.max(1, Math.floor(maxPages)) : Infinity;
  const matchedByUrl = new Map();

  for (const term of queryTerms) {
    let cursorEndTime = Math.max(lowerBound, Math.floor(Number(endTime) || Date.now()));
    let pageCount = 0;

    while (cursorEndTime >= lowerBound && pageCount < pageLimit) {
      let searchResults = [];
      try {
        searchResults = await browserPort.historySearch({
          text: term,
          startTime: lowerBound,
          endTime: cursorEndTime,
          maxResults: HISTORY_SEARCH_PAGE_SIZE,
        });
      } catch (error) {
        throw createHistorySearchFailure(error);
      }

      const results = Array.isArray(searchResults) ? searchResults : [];
      if (!results.length) {
        break;
      }

      results.forEach((entry) => {
        const url = entry?.url;
        if (!url || matchedByUrl.has(url)) return;

        const hostname = getHostname(url);
        const isDirectMatch = isBlockedHistoryHostname(hostname, normalizedBlockedUrls);
        const isSearchMatch = !isDirectMatch && isBlockedSearchQueryUrl(url, normalizedBlockedUrls);
        if (!isDirectMatch && !isSearchMatch) return;

        matchedByUrl.set(url, {
          url,
          domain: hostname || normalizeDomain(term) || 'unknown',
          visitCount: resolveHistoryVisitCount(entry),
        });
      });

      pageCount += 1;
      if (results.length < HISTORY_SEARCH_PAGE_SIZE) {
        break;
      }

      const oldestVisitTime = resolveOldestVisitTimestamp(results, cursorEndTime);
      if (!Number.isFinite(oldestVisitTime) || oldestVisitTime <= lowerBound) {
        break;
      }

      const nextCursorEndTime = Math.max(lowerBound, Math.floor(oldestVisitTime) - 1);
      if (nextCursorEndTime >= cursorEndTime) {
        break;
      }

      cursorEndTime = nextCursorEndTime;
    }
  }

  return Array.from(matchedByUrl.values());
}

async function deleteBlockedHistoryEntries(entries = [], browserPort, isCurrent) {
  requireEchoArtifactMutationCurrent(isCurrent);
  const failures = [];
  const validEntries = (Array.isArray(entries) ? entries : [])
    .filter((entry) => typeof entry?.url === 'string' && entry.url);

  for (let i = 0; i < validEntries.length; i += HISTORY_DELETE_BATCH_SIZE) {
    requireEchoArtifactMutationCurrent(isCurrent);
    const batch = validEntries.slice(i, i + HISTORY_DELETE_BATCH_SIZE);
    const outcomes = await Promise.allSettled(
      batch.map(async (entry) => {
        requireEchoArtifactMutationCurrent(isCurrent);
        try {
          await browserPort.historyDeleteUrl({ url: entry.url });
          return null;
        } catch (error) {
          return {
            url: entry.url,
            error: toErrorMessage(error),
          };
        }
      }),
    );
    requireEchoArtifactMutationCurrent(isCurrent);

    outcomes.forEach((outcome, idx) => {
      if (outcome.status === 'fulfilled' && outcome.value) {
        failures.push(outcome.value);
      } else if (outcome.status === 'rejected') {
        failures.push({
          url: batch[idx]?.url,
          error: toErrorMessage(outcome.reason),
        });
      }
    });
  }

  if (failures.length > 0) {
    throw createHistoryDeleteFailure(failures);
  }
}

function createHistoryManagerApi({ browserPort } = {}) {
  async function scanBlockedHistory({ deleteUrls = false, blockedUrls = [], isCurrent } = {}) {
    if (deleteUrls) requireEchoArtifactMutationCurrent(isCurrent);
    const matchedEntries = await collectBlockedHistoryEntries({
      browserPort,
      blockedUrls,
      startTime: 0,
      endTime: Date.now(),
    });

    if (deleteUrls) {
      const entriesToDelete = mergeWithProactiveEntries(matchedEntries, blockedUrls);
      await deleteBlockedHistoryEntries(entriesToDelete, browserPort, isCurrent);
    }

    return summarizeHistoryEntries(matchedEntries);
  }

  async function cleanupBlockedHistory(blockedUrls, { isCurrent } = {}) {
    requireEchoArtifactMutationCurrent(isCurrent);
    const signature = buildBlockedHistorySignature(blockedUrls);

    if (
      activeFullCleanupPromise
      && signature
      && activeFullCleanupSignature === signature
      && activeFullCleanupIsCurrent()
    ) {
      return activeFullCleanupPromise;
    }

    const nextPromise = scanBlockedHistory({ deleteUrls: true, blockedUrls, isCurrent })
      .finally(() => {
        if (activeFullCleanupPromise !== nextPromise) return;
        activeFullCleanupPromise = null;
        activeFullCleanupSignature = '';
        activeFullCleanupIsCurrent = null;
      });

    activeFullCleanupPromise = nextPromise;
    activeFullCleanupSignature = signature;
    activeFullCleanupIsCurrent = isCurrent;
    return nextPromise;
  }

  async function previewBlockedHistory(blockedUrls) {
    return scanBlockedHistory({ deleteUrls: false, blockedUrls });
  }

  async function cleanupRecentBlockedHistory({ blockedUrls = [], windowMs = 0, isCurrent } = {}) {
    const normalizedWindowMs = Math.max(0, Number(windowMs) || 0);
    if (!normalizedWindowMs || !Array.isArray(blockedUrls) || blockedUrls.length === 0) {
      return [];
    }
    requireEchoArtifactMutationCurrent(isCurrent);

    const matchedEntries = await collectBlockedHistoryEntries({
      browserPort,
      blockedUrls,
      startTime: Math.max(0, Date.now() - normalizedWindowMs),
      endTime: Date.now(),
      maxPages: RECENT_HISTORY_SWEEP_MAX_PAGES,
    });

    const entriesToDelete = mergeWithProactiveEntries(matchedEntries, blockedUrls);
    await deleteBlockedHistoryEntries(entriesToDelete, browserPort, isCurrent);
    return summarizeHistoryEntries(matchedEntries);
  }

  async function maybeDeleteHistoryForUrl(url, settings, { isCurrent } = {}) {
    if (!url) return;
    if (!settings?.historyCleanupForBlocked) return;

    const hostname = getHostname(url);
    const blockedUrls = settings.blockedUrls || [];
    const isDirectMatch = isBlockedHistoryHostname(hostname, blockedUrls);
    const isSearchMatch = !isDirectMatch && isBlockedSearchQueryUrl(url, blockedUrls);
    if (!isDirectMatch && !isSearchMatch) return;
    requireEchoArtifactMutationCurrent(isCurrent);

    try {
      await browserPort.historyDeleteUrl({ url });
    } catch (error) {
      throw createHistoryDeleteFailure([{ url, error: toErrorMessage(error) }]);
    }
  }

  return {
    scanBlockedHistory,
    cleanupBlockedHistory,
    cleanupRecentBlockedHistory,
    previewBlockedHistory,
    maybeDeleteHistoryForUrl,
  };
}

export function createHistoryManager(options = {}) {
  return createHistoryManagerApi({
    browserPort: resolveHistoryBrowserPort(options.browserPort),
  });
}

const defaultHistoryManager = Object.freeze({
  scanBlockedHistory: rejectMissingHistoryBrowserPort,
  cleanupBlockedHistory: rejectMissingHistoryBrowserPort,
  cleanupRecentBlockedHistory: rejectMissingHistoryBrowserPort,
  previewBlockedHistory: rejectMissingHistoryBrowserPort,
  maybeDeleteHistoryForUrl: rejectMissingHistoryBrowserPort,
});

export async function scanBlockedHistory(options = {}) {
  return defaultHistoryManager.scanBlockedHistory(options);
}

export async function cleanupBlockedHistory(blockedUrls) {
  return defaultHistoryManager.cleanupBlockedHistory(blockedUrls);
}

export async function previewBlockedHistory(blockedUrls) {
  return defaultHistoryManager.previewBlockedHistory(blockedUrls);
}

export async function cleanupRecentBlockedHistory(options = {}) {
  return defaultHistoryManager.cleanupRecentBlockedHistory(options);
}

export async function maybeDeleteHistoryForUrl(url, settings) {
  return defaultHistoryManager.maybeDeleteHistoryForUrl(url, settings);
}
