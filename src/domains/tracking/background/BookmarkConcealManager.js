import { getHostname } from '../../../lib/index.js';
import { isSiteRuleMatch } from '../../../lib/siteIdentity.js';
import { requireEchoArtifactMutationCurrent } from '../../protection/runtime/echoArtifactMutationPolicy.js';

const REQUIRED_BOOKMARK_BROWSER_PORT_METHODS = Object.freeze([
  'bookmarksGetTree',
  'bookmarksRemove',
]);

function normalizeDomain(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeBlockedDomains(blockedUrls = []) {
  return (Array.isArray(blockedUrls) ? blockedUrls : [])
    .map((entry) => normalizeDomain(entry))
    .filter(Boolean);
}

function resolveBookmarkBrowserPort(browserPort) {
  const missingMethod = REQUIRED_BOOKMARK_BROWSER_PORT_METHODS
    .find((method) => typeof browserPort?.[method] !== 'function');
  if (missingMethod) {
    throw new Error(`BOOKMARK_BROWSER_PORT_METHOD_REQUIRED:${missingMethod}`);
  }
  return browserPort;
}

async function rejectMissingBookmarkBrowserPort() {
  throw new Error('BOOKMARK_BROWSER_PORT_REQUIRED');
}

function isBlockedBookmarkHostname(hostname, blockedUrls) {
  if (!hostname || !Array.isArray(blockedUrls)) return false;
  return blockedUrls.some((blocked) => isSiteRuleMatch(hostname, blocked));
}

function toErrorMessage(error) {
  return String(error?.message || error || 'UNKNOWN_ERROR');
}

function createBookmarkTreeReadFailure(error) {
  const nextError = new Error(`BOOKMARK_TREE_READ_FAILED:${toErrorMessage(error)}`);
  nextError.code = 'BOOKMARK_TREE_READ_FAILED';
  return nextError;
}

function createBookmarkRemoveFailure(failures = []) {
  const nextError = new Error(`BOOKMARK_REMOVE_FAILED:${failures.length}`);
  nextError.code = 'BOOKMARK_REMOVE_FAILED';
  nextError.failures = failures.slice(0, 8);
  return nextError;
}

function walkBookmarkNodes(nodes = [], visit) {
  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    if (!node || typeof node !== 'object') return;
    visit(node);
    if (Array.isArray(node.children) && node.children.length > 0) {
      walkBookmarkNodes(node.children, visit);
    }
  });
}

async function listVisibleBlockedBookmarks(blockedUrls = [], browserPort) {
  const normalizedBlockedUrls = normalizeBlockedDomains(blockedUrls);
  if (!normalizedBlockedUrls.length) {
    return [];
  }

  try {
    const tree = await browserPort.bookmarksGetTree();
    const matches = [];

    walkBookmarkNodes(tree, (node) => {
      if (typeof node?.url !== 'string' || !node.url) return;
      if (node?.unmodifiable) return;
      const domain = normalizeDomain(getHostname(node.url));
      if (!domain || !isBlockedBookmarkHostname(domain, normalizedBlockedUrls)) return;
      matches.push({
        bookmarkId: String(node.id),
        domain,
        url: node.url,
        title: typeof node.title === 'string' ? node.title : '',
        parentId: typeof node.parentId === 'string' ? node.parentId : '',
        index: Number.isFinite(Number(node.index)) ? Math.max(0, Math.floor(Number(node.index))) : null,
        dateAddedEpochMs: Number.isFinite(Number(node.dateAdded))
          ? Math.floor(Number(node.dateAdded))
          : Date.now(),
      });
    });

    return matches;
  } catch (error) {
    throw createBookmarkTreeReadFailure(error);
  }
}

function summarizeBookmarkEntries(entries = []) {
  const itemsByDomain = new Map();

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const domain = normalizeDomain(entry?.domain || getHostname(entry?.url));
    if (!domain) return;
    const current = itemsByDomain.get(domain) || {
      domain,
      count: 0,
      bookmarkCount: 0,
    };
    current.count += 1;
    current.bookmarkCount += 1;
    itemsByDomain.set(domain, current);
  });

  return Array.from(itemsByDomain.values());
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildBackupFileName(now = Date.now()) {
  const date = new Date(now);
  const stamp = Number.isFinite(date.getTime())
    ? date.toISOString().slice(0, 10)
    : 'current';
  return `entropy-memory-purge-bookmarks-${stamp}.html`;
}

function buildBookmarkBackupHtml(entries = [], now = Date.now()) {
  const generatedAt = new Date(now);
  const generatedAtText = Number.isFinite(generatedAt.getTime())
    ? generatedAt.toISOString()
    : '';
  const addDate = Math.floor((Number.isFinite(generatedAt.getTime()) ? generatedAt.getTime() : Date.now()) / 1000);
  const rows = (Array.isArray(entries) ? entries : []).map((entry) => {
    const href = escapeHtml(entry?.url);
    const title = escapeHtml(entry?.title || entry?.domain || entry?.url);
    const entryAddDate = Number.isFinite(Number(entry?.dateAddedEpochMs))
      ? Math.floor(Number(entry.dateAddedEpochMs) / 1000)
      : addDate;
    return `        <DT><A HREF="${href}" ADD_DATE="${entryAddDate}">${title}</A>`;
  });

  return [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Entropy Memory Purge Bookmark Backup</TITLE>',
    '<H1>Entropy Memory Purge Bookmark Backup</H1>',
    `<!-- Generated locally by Entropy at ${escapeHtml(generatedAtText)}. Entropy does not retain this URL list. -->`,
    '<DL><p>',
    `    <DT><H3 ADD_DATE="${addDate}">Entropy Memory Purge Backup</H3>`,
    '    <DL><p>',
    ...rows,
    '    </DL><p>',
    '</DL><p>',
    '',
  ].join('\n');
}

async function removeBookmarkWithoutBackup(entry, browserPort, isCurrent) {
  if (!entry?.bookmarkId) {
    return { removed: false, failure: null };
  }
  requireEchoArtifactMutationCurrent(isCurrent);
  try {
    await browserPort.bookmarksRemove(entry.bookmarkId);
    return { removed: true, failure: null };
  } catch (error) {
    return {
      removed: false,
      failure: {
        bookmarkId: entry.bookmarkId,
        url: entry.url,
        error: toErrorMessage(error),
      },
    };
  }
}

function createBookmarkConcealManagerApi({ browserPort } = {}) {
  async function previewBlockedBookmarks(blockedUrls) {
    const matches = await listVisibleBlockedBookmarks(blockedUrls, browserPort);
    return summarizeBookmarkEntries(matches);
  }

  async function exportBlockedBookmarksHtml(blockedUrls) {
    const matches = await listVisibleBlockedBookmarks(blockedUrls, browserPort);
    const summary = summarizeBookmarkEntries(matches);
    return {
      html: buildBookmarkBackupHtml(matches),
      filename: buildBackupFileName(),
      count: matches.length,
      domains: summary.length,
    };
  }

const BOOKMARK_REMOVE_BATCH_SIZE = 25;

  async function cleanupBlockedBookmarks(blockedUrls, { isCurrent } = {}) {
    requireEchoArtifactMutationCurrent(isCurrent);
    const matches = await listVisibleBlockedBookmarks(blockedUrls, browserPort);
    const removedEntries = [];
    const failures = [];

    for (let i = 0; i < matches.length; i += BOOKMARK_REMOVE_BATCH_SIZE) {
      requireEchoArtifactMutationCurrent(isCurrent);
      const batch = matches.slice(i, i + BOOKMARK_REMOVE_BATCH_SIZE);
      const outcomes = await Promise.allSettled(
        batch.map((entry) => removeBookmarkWithoutBackup(entry, browserPort, isCurrent)),
      );
      requireEchoArtifactMutationCurrent(isCurrent);

      outcomes.forEach((outcome, idx) => {
        const entry = batch[idx];
        if (outcome.status === 'fulfilled') {
          const { removed, failure } = outcome.value;
          if (removed) {
            removedEntries.push(entry);
          } else if (failure) {
            failures.push(failure);
          }
        } else {
          failures.push({
            bookmarkId: entry?.bookmarkId,
            url: entry?.url,
            error: toErrorMessage(outcome.reason),
          });
        }
      });
    }

    if (failures.length) {
      throw createBookmarkRemoveFailure(failures);
    }

    return summarizeBookmarkEntries(removedEntries);
  }

  async function syncBlockedBookmarks({
    blockedUrls = [],
    enabled = false,
    suppressed = false,
    isCurrent,
  } = {}) {
    if (typeof suppressed !== 'boolean' || (suppressed && enabled)) {
      throw new Error('BOOKMARK_SYNC_SUPPRESSION_INVALID');
    }
    const normalizedBlockedUrls = normalizeBlockedDomains(blockedUrls);

    if (!enabled) {
      return {
        status: suppressed ? 'suppressed' : 'disabled',
        destroyed: [],
      };
    }

    const destroyed = await cleanupBlockedBookmarks(normalizedBlockedUrls, { isCurrent });
    return {
      destroyed,
    };
  }

  return {
    cleanupBlockedBookmarks,
    exportBlockedBookmarksHtml,
    previewBlockedBookmarks,
    syncBlockedBookmarks,
  };
}

export function createBookmarkConcealManager(options = {}) {
  return createBookmarkConcealManagerApi({
    browserPort: resolveBookmarkBrowserPort(options.browserPort),
  });
}

const defaultBookmarkConcealManager = Object.freeze({
  cleanupBlockedBookmarks: rejectMissingBookmarkBrowserPort,
  exportBlockedBookmarksHtml: rejectMissingBookmarkBrowserPort,
  previewBlockedBookmarks: rejectMissingBookmarkBrowserPort,
  syncBlockedBookmarks: rejectMissingBookmarkBrowserPort,
});

export async function previewBlockedBookmarks(blockedUrls) {
  return defaultBookmarkConcealManager.previewBlockedBookmarks(blockedUrls);
}

export async function exportBlockedBookmarksHtml(blockedUrls) {
  return defaultBookmarkConcealManager.exportBlockedBookmarksHtml(blockedUrls);
}

export async function cleanupBlockedBookmarks(blockedUrls) {
  return defaultBookmarkConcealManager.cleanupBlockedBookmarks(blockedUrls);
}

export async function syncBlockedBookmarks(options = {}) {
  return defaultBookmarkConcealManager.syncBlockedBookmarks(options);
}

export default {
  cleanupBlockedBookmarks,
  exportBlockedBookmarksHtml,
  previewBlockedBookmarks,
  syncBlockedBookmarks,
};
