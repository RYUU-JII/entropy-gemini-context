import { runtimeSendMessage } from '../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../platform/messaging/messageTypes.js';

const RECENT_CAPTURE_TTL_MS = 45_000;
const MAX_RECENT_BATCHES = 96;
const MAX_CANDIDATES = 4;
const recentCapturedBatches = new Map();
const pendingBatches = new Set();
let pendingTimer = null;
let mutationObserver = null;
let loadListener = null;
let initialized = false;
let captureEpoch = 0;

function parseSizeScore(sizes) {
  return String(sizes || '').toLowerCase().split(/\s+/).reduce((best, part) => {
    const [width, height] = part.split('x').map(Number);
    return Number.isFinite(width) && Number.isFinite(height)
      ? Math.max(best, width * height)
      : best;
  }, 0);
}

function getIconUrls() {
  const candidates = Array.from(document.querySelectorAll('link[rel]'))
    .filter((link) => String(link.getAttribute('rel') || '').toLowerCase().split(/\s+/)
      .some((rel) => rel === 'icon' || rel === 'apple-touch-icon' || rel === 'apple-touch-icon-precomposed'))
    .map((link) => ({ href: link.getAttribute('href'), score: parseSizeScore(link.getAttribute('sizes')) }))
    .filter((candidate) => !!candidate.href)
    .sort((a, b) => b.score - a.score);
  candidates.push({ href: new URL('/favicon.ico', window.location.href).toString() });
  const urls = [];
  for (const { href } of candidates) {
    try {
      const url = new URL(href, document.baseURI || window.location.href).toString();
      if (!urls.includes(url)) urls.push(url);
    } catch {
      // A malformed page-owned candidate does not invalidate the remaining candidates.
    }
    if (urls.length === MAX_CANDIDATES) break;
  }
  return urls;
}

async function processAndSendFavicon() {
  const timestamp = Date.now();
  for (const [batch, capturedAt] of recentCapturedBatches) {
    if (timestamp - capturedAt >= RECENT_CAPTURE_TTL_MS) recentCapturedBatches.delete(batch);
  }
  const pageUrl = window.location.href;
  const iconUrls = getIconUrls();
  if (!iconUrls.length) return;
  const batch = JSON.stringify([pageUrl, iconUrls]);
  if (recentCapturedBatches.has(batch) || pendingBatches.has(batch)) return;

  const epoch = captureEpoch;
  pendingBatches.add(batch);
  try {
    const response = await runtimeSendMessage({ action: MESSAGE_ACTIONS.CAPTURE_FAVICON, pageUrl, iconUrls });
    if (epoch !== captureEpoch || !initialized) return;
    if (response?.success !== true) {
      console.warn('[FaviconCapture] capture request rejected', response?.error || 'FAVICON_CAPTURE_RESPONSE_INVALID');
      return;
    }
    if (response.captured !== true) return;
    while (recentCapturedBatches.size >= MAX_RECENT_BATCHES) {
      recentCapturedBatches.delete(recentCapturedBatches.keys().next().value);
    }
    recentCapturedBatches.set(batch, Date.now());
  } catch (error) {
    if (epoch === captureEpoch && initialized) console.warn('[FaviconCapture] capture delivery failed', error);
  } finally {
    if (epoch === captureEpoch) pendingBatches.delete(batch);
  }
}

function scheduleCapture(delayMs = 0) {
  if (pendingTimer !== null) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    void processAndSendFavicon();
  }, delayMs);
}

export function initFaviconCapture() {
  if (initialized) return;
  if (window.top !== window || !['http:', 'https:'].includes(window.location.protocol)) return;
  if (!['text/html', 'application/xhtml+xml'].includes(document.contentType)) return;
  initialized = true;
  scheduleCapture();
  loadListener = () => scheduleCapture();
  window.addEventListener('load', loadListener, { once: true });
  mutationObserver = new MutationObserver(() => scheduleCapture(150));
  mutationObserver.observe(document.head || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'rel', 'sizes'],
  });
}

export function teardownFaviconCapture() {
  initialized = false;
  captureEpoch += 1;
  if (pendingTimer !== null) clearTimeout(pendingTimer);
  pendingTimer = null;
  mutationObserver?.disconnect();
  mutationObserver = null;
  if (loadListener) window.removeEventListener('load', loadListener);
  loadListener = null;
  recentCapturedBatches.clear();
  pendingBatches.clear();
}
