import { getHostname } from '../../../lib/index.js';
import { normalizeDomain } from '../../../lib/domain.js';
import { isAllowedFaviconDataUrl } from '@/platform/storage/assets/faviconDataUrlPolicy.js';

export const FAVICON_CAPTURE_FRESHNESS_MS = 24 * 60 * 60 * 1000;
const FAILED_CAPTURE_COOLDOWN_MS = 45_000;
const MAX_CACHED_DOMAINS = 128;
const MAX_FAILED_CANDIDATES = 256;
const MAX_CANDIDATES = 4;

function setBoundedEntry(map, key, value, maxEntries) {
  map.delete(key);
  while (map.size >= maxEntries) map.delete(map.keys().next().value);
  map.set(key, value);
}

export function createFaviconService({
  faviconRepository,
  enableFetch = true,
  shouldCaptureFavicon = null,
  fetchFaviconDataUrl: fetchFaviconDataUrlPort,
  now = Date.now,
} = {}) {
  if (enableFetch && typeof fetchFaviconDataUrlPort !== 'function') {
    throw new Error('FAVICON_FETCH_PORT_REQUIRED');
  }
  if (!faviconRepository
    || ['getByDomain', 'saveDataUrl', 'getRevision'].some((method) => typeof faviconRepository[method] !== 'function')) {
    throw new Error('FAVICON_REPOSITORY_REQUIRED');
  }

  const cachedByDomain = new Map();
  const observedInputsByDomain = new Map();
  const pendingReads = new Map();
  const captureLanes = new Map();
  const failedCaptureAt = new Map();
  let observedRevision = faviconRepository.getRevision();

  function currentRevision() {
    const revision = faviconRepository.getRevision();
    if (revision !== observedRevision) {
      observedRevision = revision;
      cachedByDomain.clear();
      observedInputsByDomain.clear();
      failedCaptureAt.clear();
    }
    return revision;
  }

  function readMemoryFavicon(key) {
    const entry = cachedByDomain.get(key);
    if (entry) setBoundedEntry(cachedByDomain, key, entry, MAX_CACHED_DOMAINS);
    return entry;
  }

  async function readStoredFavicon(key, revision) {
    if (currentRevision() !== revision) return null;
    const cached = readMemoryFavicon(key);
    if (cached) return cached;

    const readKey = `${revision}:${key}`;
    if (pendingReads.has(readKey)) return pendingReads.get(readKey);
    const request = (async () => {
      const stored = await faviconRepository.getByDomain(key);
      if (currentRevision() !== revision) return null;
      // A capture may have installed its selected source while this durable read waited.
      const installed = readMemoryFavicon(key);
      if (installed) return installed;
      if (!isAllowedFaviconDataUrl(stored?.dataUrl)) return null;
      const entry = { dataUrl: stored.dataUrl, updatedAt: stored.updatedAt, sourceUrl: '' };
      setBoundedEntry(cachedByDomain, key, entry, MAX_CACHED_DOMAINS);
      return entry;
    })();
    pendingReads.set(readKey, request);
    try {
      return await request;
    } finally {
      if (pendingReads.get(readKey) === request) pendingReads.delete(readKey);
    }
  }

  function wasRecentFailure(key, iconUrl) {
    const failureKey = `${key}::${iconUrl}`;
    const failedAt = failedCaptureAt.get(failureKey);
    if (failedAt === undefined) return false;
    const age = now() - failedAt;
    if (age >= 0 && age < FAILED_CAPTURE_COOLDOWN_MS) return true;
    failedCaptureAt.delete(failureKey);
    return false;
  }

  function markFailure(key, iconUrl) {
    const timestamp = now();
    for (const [failureKey, failedAt] of failedCaptureAt) {
      if (timestamp - failedAt >= FAILED_CAPTURE_COOLDOWN_MS) failedCaptureAt.delete(failureKey);
    }
    setBoundedEntry(failedCaptureAt, `${key}::${iconUrl}`, timestamp, MAX_FAILED_CANDIDATES);
  }

  async function captureCandidates({ key, pageUrl, candidates, providedDataUrl, revision, requestSource }) {
    if (currentRevision() !== revision) return false;
    if (typeof shouldCaptureFavicon === 'function'
      && await shouldCaptureFavicon({ pageUrl, hostname: key }) === false) return false;
    if (currentRevision() !== revision) return false;
    const stored = await readStoredFavicon(key, revision);
    if (currentRevision() !== revision) return false;
    const age = now() - stored?.updatedAt;
    const observedInputs = observedInputsByDomain.get(key) || {};
    const inputIdentity = JSON.stringify(candidates);
    const previousInput = observedInputs[requestSource];
    const sourceChanged = previousInput !== undefined && previousInput !== inputIdentity;
    const provided = isAllowedFaviconDataUrl(providedDataUrl) ? providedDataUrl : '';
    const providedChanged = provided !== '' && provided !== stored?.dataUrl;
    const rememberInput = () => setBoundedEntry(observedInputsByDomain, key, {
      ...observedInputs, [requestSource]: inputIdentity,
    }, MAX_CACHED_DOMAINS);
    // Compare each entrypoint's own observations: tab and page candidates can differ legitimately.
    // A worker restart has no source history, so durable freshness owns that first observation.
    if (stored && Number.isFinite(age) && age >= 0 && age < FAVICON_CAPTURE_FRESHNESS_MS
      && !providedChanged && (!sourceChanged || candidates[0] === stored.sourceUrl)) {
      rememberInput();
      return true;
    }

    for (const iconUrl of candidates) {
      if (currentRevision() !== revision) return false;
      if (!provided && wasRecentFailure(key, iconUrl)) continue;
      let dataUrl = provided || (isAllowedFaviconDataUrl(iconUrl) ? iconUrl : '');
      if (!dataUrl) {
        dataUrl = await fetchFaviconDataUrlPort(iconUrl, pageUrl);
      }
      if (currentRevision() !== revision) return false;
      if (!isAllowedFaviconDataUrl(dataUrl)) {
        markFailure(key, iconUrl);
        continue;
      }

      // Notification readers must follow the repository's mutation tail until this commit installs memory.
      cachedByDomain.delete(key);
      const committed = await faviconRepository.saveDataUrl(key, dataUrl, { expectedRevision: revision });
      if (committed === false || currentRevision() !== revision) return false;
      rememberInput();
      failedCaptureAt.delete(`${key}::${iconUrl}`);
      setBoundedEntry(cachedByDomain, key, { dataUrl, updatedAt: now(), sourceUrl: iconUrl }, MAX_CACHED_DOMAINS);
      return true;
    }
    return false;
  }

  function runCaptureRequest(key, lane, request) {
    lane.running = request;
    // The runner owns completion and always settles callers before advancing the lane.
    void (async () => {
      try {
        request.resolve(await captureCandidates(request.input));
      } catch (error) {
        request.reject(error);
      } finally {
        lane.running = null;
        const next = lane.pending;
        lane.pending = null;
        if (next) runCaptureRequest(key, lane, next);
        else if (captureLanes.get(key) === lane) captureLanes.delete(key);
      }
    })();
  }

  async function coordinateCapture({ pageUrl, iconUrls, providedDataUrl = '', requestSource }) {
    if (!enableFetch) return false;
    const key = getHostname(pageUrl);
    if (!key) return false;
    const candidates = [...new Set(iconUrls
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim()))].slice(0, MAX_CANDIDATES);
    if (!candidates.length) return false;
    const revision = currentRevision();

    let lane = captureLanes.get(key);
    if (!lane) {
      lane = { running: null, pending: null };
      captureLanes.set(key, lane);
    }
    const requestKey = JSON.stringify([revision, candidates, providedDataUrl, requestSource]);
    if (lane.pending?.key === requestKey) return lane.pending.promise;
    if (lane.pending) {
      // Supersession is a normal captured:false outcome, never a delivery/storage error.
      lane.pending.resolve(false);
      lane.pending = null;
    }
    if (lane.running?.key === requestKey) return lane.running.promise;

    const request = {
      key: requestKey,
      input: { key, pageUrl, candidates, providedDataUrl, revision, requestSource },
    };
    request.promise = new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });
    if (lane.running) lane.pending = request;
    else runCaptureRequest(key, lane, request);
    return request.promise;
  }

  async function captureTabFavicon(tab) {
    if (!tab?.url) return false;
    const declaredIconUrl = typeof tab.favIconUrl === 'string' ? tab.favIconUrl.trim() : '';
    let defaultIconUrl = '';
    try {
      defaultIconUrl = new URL('/favicon.ico', tab.url).toString();
    } catch {
      return false;
    }
    return coordinateCapture({
      pageUrl: tab.url,
      iconUrls: declaredIconUrl ? [declaredIconUrl] : [defaultIconUrl],
      requestSource: 'tab',
    });
  }

  async function captureFaviconFromUrl({ pageUrl, iconUrl, iconUrls, dataUrl = '' } = {}) {
    return coordinateCapture({
      pageUrl,
      iconUrls: Array.isArray(iconUrls) ? iconUrls : [iconUrl],
      providedDataUrl: dataUrl,
      requestSource: 'content',
    });
  }

  async function getCachedFaviconData(domain) {
    const key = normalizeDomain(domain);
    if (!key) return '';
    const revision = currentRevision();
    const entry = await readStoredFavicon(key, revision);
    return currentRevision() === revision && entry ? entry.dataUrl : '';
  }

  async function inspectCache(domain) {
    const key = normalizeDomain(domain);
    if (!key) return { key: '', stored: null, cached: null };
    currentRevision();
    const stored = await faviconRepository.getByDomain(key);
    currentRevision();
    return { key, stored, cached: readMemoryFavicon(key) || null };
  }

  return { captureTabFavicon, captureFaviconFromUrl, getCachedFaviconData, inspectCache };
}
