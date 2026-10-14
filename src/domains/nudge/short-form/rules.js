import { resolveSiteId } from '../targeting/siteIdentityCatalog.js';

const SHORT_FORM_RULES = Object.freeze([
  Object.freeze({
    id: 'youtube',
    pruneMode: 'remove',
    shortPagePatterns: Object.freeze([/^\/shorts(?:\/|$)/i]),
    hideSelectors: Object.freeze([
      'ytd-reel-item-renderer',
      'ytd-reel-video-renderer',
      'ytd-reel-shelf-renderer',
      'ytd-rich-shelf-renderer[is-shorts]',
    ]),
    safePath: '/',
  }),
  Object.freeze({
    id: 'instagram',
    pruneMode: 'hide',
    shortPagePatterns: Object.freeze([
      /^\/reels?(?:\/|$)/i,
      /^\/explore\/reels(?:\/|$)/i,
      /^\/[^/?#]+\/reels(?:\/|$)/i,
    ]),
    hideSelectors: Object.freeze([
      'a[href^="/reel/"]',
      'a[href^="/reels/"]',
      'a[href*="/reel/"]',
      'a[href*="/reels/"]',
      'a[href*="/explore/reels"]',
    ]),
    safePath: '/',
  }),
  Object.freeze({
    id: 'facebook',
    pruneMode: 'hide',
    shortPagePatterns: Object.freeze([
      /^\/reels?(?:\/|$)/i,
    ]),
    hideSelectors: Object.freeze([
      'a[href="/reel"]',
      'a[href="/reel/"]',
      'a[href^="/reel/"]',
      'a[href="/reels"]',
      'a[href="/reels/"]',
      'a[href^="/reels/"]',
      'a[href="https://www.facebook.com/reel"]',
      'a[href^="https://www.facebook.com/reel/"]',
      'a[href="https://www.facebook.com/reels"]',
      'a[href^="https://www.facebook.com/reels/"]',
      'a[href^="https://facebook.com/reel/"]',
      'a[href^="https://facebook.com/reels/"]',
      'a[href^="https://m.facebook.com/reel/"]',
      'a[href^="https://m.facebook.com/reels/"]',
      'a[href^="https://web.facebook.com/reel/"]',
      'a[href^="https://web.facebook.com/reels/"]',
    ]),
    safePath: '/',
  }),
  Object.freeze({
    id: 'tiktok',
    pruneMode: 'hide',
    shortPagePatterns: Object.freeze([
      /^\/$/i,
      /^\/foryou(?:\/|$)/i,
      /^\/following(?:\/|$)/i,
    ]),
    hideSelectors: Object.freeze([
      'a[data-e2e="nav-foryou"]',
      'a[data-e2e="nav-following"]',
    ]),
    safePath: '/explore',
  }),
]);

function findRuleByHost(hostname) {
  const siteId = resolveSiteId(hostname);
  return SHORT_FORM_RULES.find((rule) => rule.id === siteId) || null;
}

function tryParseUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null;
  try {
    if (baseUrl) return new URL(rawUrl, baseUrl);
    return new URL(rawUrl);
  } catch (_) {
    return null;
  }
}

function isShortPath(rule, pathname) {
  if (!rule || !pathname) return false;
  return (rule.shortPagePatterns || []).some((pattern) => pattern.test(pathname));
}

export function getShortFormRuleForHostname(hostname) {
  return findRuleByHost(hostname);
}

export function getShortFormHideSelectors(hostname) {
  return getShortFormRuleForHostname(hostname)?.hideSelectors || [];
}

export function isShortFormUrl(rawUrl, { baseUrl = null } = {}) {
  const parsed = tryParseUrl(rawUrl, baseUrl);
  if (!parsed) return false;
  const rule = findRuleByHost(parsed.hostname);
  if (!rule) return false;
  return isShortPath(rule, parsed.pathname);
}

export function getShortFormSafeUrl(hostname, origin) {
  const rule = findRuleByHost(hostname);
  if (!rule || !origin) return null;
  return `${origin}${rule.safePath || '/'}`;
}
