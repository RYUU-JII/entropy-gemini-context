import {
  normalizeSiteHostname,
  resolveSiteId,
} from '../../../targeting/siteIdentityCatalog.js';

export function normalizeSocialMetricsHost(hostname = '') {
  return normalizeSiteHostname(hostname);
}

export function isYoutubeHost(hostname = '') {
  return resolveSiteId(hostname) === 'youtube';
}

export function isXHost(hostname = '') {
  return resolveSiteId(hostname) === 'x';
}

export function isInstagramHost(hostname = '') {
  return resolveSiteId(hostname) === 'instagram';
}

export function isTikTokHost(hostname = '') {
  return resolveSiteId(hostname) === 'tiktok';
}

export function isFacebookHost(hostname = '') {
  return resolveSiteId(hostname) === 'facebook';
}

export function isRedditHost(hostname = '') {
  return resolveSiteId(hostname) === 'reddit';
}
