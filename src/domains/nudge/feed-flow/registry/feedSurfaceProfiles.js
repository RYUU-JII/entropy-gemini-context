import {
  SUPPORTED_SITE_IDS,
  normalizeSiteHostname,
  resolveSiteId,
} from '../../targeting/siteIdentityCatalog.js';

const FEED_PROFILE_KEYS = Object.freeze([
  'candidateItemSelectors',
  'dominantItemSelectors',
  'id',
  'resolveRoute',
  'scrollerHint',
]);
const FEED_SCROLLER_HINTS = new Set(['auto', 'root', 'viewport']);

function requireSelectorOrNull(value, path) {
  if (value === null) return;
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new Error(`FEED_SURFACE_PROFILE_INVALID:${path}`);
  }
}

function createProfile(definition) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw new Error('FEED_SURFACE_PROFILE_INVALID:profile_object_required');
  }
  const keys = Object.keys(definition).sort();
  if (
    keys.length !== FEED_PROFILE_KEYS.length
    || keys.some((key, index) => key !== FEED_PROFILE_KEYS[index])
  ) {
    throw new Error('FEED_SURFACE_PROFILE_INVALID:profile_shape');
  }
  if (
    typeof definition.id !== 'string'
    || !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u.test(definition.id)
  ) {
    throw new Error('FEED_SURFACE_PROFILE_INVALID:id');
  }
  requireSelectorOrNull(definition.candidateItemSelectors, 'candidateItemSelectors');
  requireSelectorOrNull(definition.dominantItemSelectors, 'dominantItemSelectors');
  if (
    (definition.candidateItemSelectors === null)
    !== (definition.dominantItemSelectors === null)
  ) {
    throw new Error('FEED_SURFACE_PROFILE_INVALID:selector_pair');
  }
  if (!FEED_SCROLLER_HINTS.has(definition.scrollerHint)) {
    throw new Error('FEED_SURFACE_PROFILE_INVALID:scrollerHint');
  }
  if (typeof definition.resolveRoute !== 'function') {
    throw new Error('FEED_SURFACE_PROFILE_INVALID:resolveRoute');
  }
  return Object.freeze({ ...definition });
}

const INSTAGRAM_FEED_ITEM_SELECTORS = [
  'main[role="main"] > div:first-child > div video',
  'article',
  'section[role="dialog"]',
  'div[role="dialog"]',
  'main article',
].join(', ');

const INSTAGRAM_DOMINANT_ITEM_SELECTORS = [
  INSTAGRAM_FEED_ITEM_SELECTORS,
  'section[role="dialog"] video',
  'div[role="dialog"] video',
  'main video[playsinline]',
].join(', ');

const TIKTOK_FEED_ITEM_SELECTORS = [
  '[data-e2e="recommend-list-item-container"]',
  '[data-e2e="user-post-item"]',
  '[data-e2e*="feed-item" i]',
  '[data-e2e*="video-item" i]',
  '[data-e2e*="browse-video" i]',
  '[data-e2e*="video-player" i]',
  '[data-e2e*="recommend-video" i]',
].join(', ');

const TIKTOK_DOMINANT_ITEM_SELECTORS = [
  TIKTOK_FEED_ITEM_SELECTORS,
  'video',
].join(', ');

const YOUTUBE_SHORTS_ITEM_SELECTORS = [
  '#shorts-container ytd-reel-video-renderer',
  '#shorts-container ytd-reel-item-renderer',
  'ytd-reel-video-renderer',
  'ytd-reel-item-renderer',
  'video[playsinline]',
].join(', ');

const YOUTUBE_HOME_ITEM_SELECTORS = [
  'ytd-rich-grid-renderer #contents',
  '> ytd-rich-item-renderer:has(yt-lockup-view-model)',
].join(' ');

const GENERIC_FEED_DISCOVERY_ITEM_SELECTOR =
  ':is(article, main, section, figure, [role="article"], [role="main"], [role="listitem"])';
const REDDIT_FEED_DISCOVERY_ITEM_SELECTOR =
  ':is(shreddit-post, shreddit-comment, [data-testid="post-container"], [data-testid*="post" i], article)';

export const FEED_SURFACE_MODES = Object.freeze({
  CONTINUOUS: 'continuous',
  PAGED: 'paged',
  HYBRID: 'hybrid',
  DOCUMENT: 'document',
  UNKNOWN: 'unknown',
});

export const FEED_SEMANTIC_SURFACE_IDS = Object.freeze({
  DEFAULT_ROUTE: 'default:route',
  X_HOME: 'x:home',
  X_DOCUMENT: 'x:document',
  FACEBOOK_HOME: 'facebook:home',
  FACEBOOK_DOCUMENT: 'facebook:document',
  INSTAGRAM_HOME: 'instagram:home',
  INSTAGRAM_REELS: 'instagram:reels',
  INSTAGRAM_EXPLORE: 'instagram:explore',
  INSTAGRAM_DOCUMENT: 'instagram:document',
  TIKTOK_FEED: 'tiktok:feed',
  TIKTOK_DOCUMENT: 'tiktok:document',
  YOUTUBE_HOME: 'youtube:home',
  YOUTUBE_BROWSE: 'youtube:browse',
  YOUTUBE_SHORTS: 'youtube:shorts',
  YOUTUBE_WATCH: 'youtube:watch',
});

export function requireFeedSurfacePathname(pathname) {
  if (
    typeof pathname !== 'string'
    || (pathname.length > 0 && !/^\/[^\s\\?#]*$/u.test(pathname))
  ) {
    throw new Error('FEED_SURFACE_PATHNAME_INVALID');
  }
  return pathname;
}

function createSurfaceRoute(
  semanticSurfaceId,
  routeFamily,
  surfaceMode,
  selectorOverrides = null,
) {
  if (
    typeof semanticSurfaceId !== 'string'
    || !semanticSurfaceId
    || semanticSurfaceId !== semanticSurfaceId.trim()
    || typeof routeFamily !== 'string'
    || !routeFamily
    || routeFamily !== routeFamily.trim()
    || !Object.values(FEED_SURFACE_MODES).includes(surfaceMode)
  ) {
    throw new Error(`FEED_SURFACE_ROUTE_INVALID:${String(semanticSurfaceId || 'unknown')}`);
  }
  const route = {
    semanticSurfaceId,
    routeFamily,
    surfaceMode,
  };
  if (selectorOverrides === null) return Object.freeze(route);
  if (!selectorOverrides || typeof selectorOverrides !== 'object') {
    throw new Error(`FEED_SURFACE_ROUTE_SELECTOR_OVERRIDE_INVALID:${semanticSurfaceId}`);
  }
  const overrideKeys = Object.keys(selectorOverrides).sort();
  if (
    overrideKeys.length !== 2
    || overrideKeys[0] !== 'candidateItemSelectors'
    || overrideKeys[1] !== 'dominantItemSelectors'
  ) {
    throw new Error(`FEED_SURFACE_ROUTE_SELECTOR_OVERRIDE_INVALID:${semanticSurfaceId}`);
  }
  const candidateItemSelectors = selectorOverrides.candidateItemSelectors;
  const dominantItemSelectors = selectorOverrides.dominantItemSelectors;
  if (
    typeof candidateItemSelectors !== 'string'
    || !candidateItemSelectors.trim()
    || candidateItemSelectors !== candidateItemSelectors.trim()
    || typeof dominantItemSelectors !== 'string'
    || !dominantItemSelectors.trim()
    || dominantItemSelectors !== dominantItemSelectors.trim()
  ) {
    throw new Error(`FEED_SURFACE_ROUTE_SELECTOR_OVERRIDE_INVALID:${semanticSurfaceId}`);
  }
  return Object.freeze({
    ...route,
    candidateItemSelectors,
    dominantItemSelectors,
  });
}

const DEFAULT_PROFILE = createProfile({
  id: 'default',
  candidateItemSelectors: null,
  dominantItemSelectors: null,
  scrollerHint: 'auto',
  resolveRoute: () => createSurfaceRoute(
    FEED_SEMANTIC_SURFACE_IDS.DEFAULT_ROUTE,
    'route',
    FEED_SURFACE_MODES.UNKNOWN,
  ),
});

const X_PROFILE = createProfile({
  id: 'x',
  candidateItemSelectors: 'main article[data-testid="tweet"]',
  dominantItemSelectors: 'main article[data-testid="tweet"]',
  scrollerHint: 'root',
  resolveRoute: ({ pathname = '' } = {}) => {
    if (/^\/home\/?$/i.test(pathname)) {
      return createSurfaceRoute(
        FEED_SEMANTIC_SURFACE_IDS.X_HOME,
        'home',
        FEED_SURFACE_MODES.CONTINUOUS,
      );
    }
    return createSurfaceRoute(
      FEED_SEMANTIC_SURFACE_IDS.X_DOCUMENT,
      'document',
      FEED_SURFACE_MODES.DOCUMENT,
    );
  },
});

const FACEBOOK_PROFILE = createProfile({
  id: 'facebook',
  candidateItemSelectors: '[role="main"] [role="feed"] [role="article"]',
  dominantItemSelectors: '[role="main"] [role="feed"] [role="article"]',
  scrollerHint: 'root',
  resolveRoute: ({ pathname = '' } = {}) => {
    if (/^\/?$/i.test(pathname)) {
      return createSurfaceRoute(
        FEED_SEMANTIC_SURFACE_IDS.FACEBOOK_HOME,
        'home',
        FEED_SURFACE_MODES.CONTINUOUS,
      );
    }
    return createSurfaceRoute(
      FEED_SEMANTIC_SURFACE_IDS.FACEBOOK_DOCUMENT,
      'document',
      FEED_SURFACE_MODES.DOCUMENT,
    );
  },
});

const INSTAGRAM_PROFILE = createProfile({
  id: 'instagram',
  candidateItemSelectors: INSTAGRAM_FEED_ITEM_SELECTORS,
  dominantItemSelectors: INSTAGRAM_DOMINANT_ITEM_SELECTORS,
  scrollerHint: 'auto',
  resolveRoute: ({ pathname = '' } = {}) => {
    if (/^\/(?:reels?|explore\/reels)(?:\/|$)/i.test(pathname)) {
      return createSurfaceRoute(
        FEED_SEMANTIC_SURFACE_IDS.INSTAGRAM_REELS,
        'reels',
        FEED_SURFACE_MODES.PAGED,
      );
    }
    if (/^\/explore(?:\/|$)/i.test(pathname)) {
      return createSurfaceRoute(
        FEED_SEMANTIC_SURFACE_IDS.INSTAGRAM_EXPLORE,
        'explore',
        FEED_SURFACE_MODES.HYBRID,
      );
    }
    if (/^\/?$/i.test(pathname)) {
      return createSurfaceRoute(
        FEED_SEMANTIC_SURFACE_IDS.INSTAGRAM_HOME,
        'home',
        FEED_SURFACE_MODES.CONTINUOUS,
      );
    }
    return createSurfaceRoute(
      FEED_SEMANTIC_SURFACE_IDS.INSTAGRAM_DOCUMENT,
      'document',
      FEED_SURFACE_MODES.DOCUMENT,
    );
  },
});

const TIKTOK_PROFILE = createProfile({
  id: 'tiktok',
  candidateItemSelectors: TIKTOK_FEED_ITEM_SELECTORS,
  dominantItemSelectors: TIKTOK_DOMINANT_ITEM_SELECTORS,
  scrollerHint: 'viewport',
  resolveRoute: ({ pathname = '' } = {}) => {
    const isPagedFeedRoute = /^\/(?:foryou|following)?\/?$/i.test(pathname)
      || /^\/(?:@[^/]+\/)?video\/[^/]+(?:\/|$)/i.test(pathname);
    if (isPagedFeedRoute) {
      return createSurfaceRoute(
        FEED_SEMANTIC_SURFACE_IDS.TIKTOK_FEED,
        'feed',
        FEED_SURFACE_MODES.PAGED,
      );
    }
    return createSurfaceRoute(
      FEED_SEMANTIC_SURFACE_IDS.TIKTOK_DOCUMENT,
      'document',
      FEED_SURFACE_MODES.DOCUMENT,
    );
  },
});

const YOUTUBE_PROFILE = createProfile({
  id: 'youtube',
  candidateItemSelectors: ':is(ytd-rich-grid-media, ytd-video-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer)',
  dominantItemSelectors: YOUTUBE_SHORTS_ITEM_SELECTORS,
  scrollerHint: 'auto',
  resolveRoute: ({ hostname = '', pathname = '' } = {}) => {
    if (/^\/shorts(?:\/|$)/i.test(pathname)) {
      return createSurfaceRoute(
        FEED_SEMANTIC_SURFACE_IDS.YOUTUBE_SHORTS,
        'shorts',
        FEED_SURFACE_MODES.PAGED,
      );
    }
    const isShortLinkHost = hostname === 'youtu.be';
    if (isShortLinkHost || /^\/(?:watch|live|embed)(?:\/|$)/i.test(pathname)) {
      return createSurfaceRoute(
        FEED_SEMANTIC_SURFACE_IDS.YOUTUBE_WATCH,
        'watch',
        FEED_SURFACE_MODES.DOCUMENT,
      );
    }
    if (/^\/?$/i.test(pathname)) {
      return createSurfaceRoute(
        FEED_SEMANTIC_SURFACE_IDS.YOUTUBE_HOME,
        'home',
        FEED_SURFACE_MODES.CONTINUOUS,
        {
          candidateItemSelectors: YOUTUBE_HOME_ITEM_SELECTORS,
          dominantItemSelectors: YOUTUBE_HOME_ITEM_SELECTORS,
        },
      );
    }
    return createSurfaceRoute(
      FEED_SEMANTIC_SURFACE_IDS.YOUTUBE_BROWSE,
      'browse',
      FEED_SURFACE_MODES.CONTINUOUS,
    );
  },
});

const FEED_SURFACE_PROFILES = Object.freeze({
  default: DEFAULT_PROFILE,
  x: X_PROFILE,
  facebook: FACEBOOK_PROFILE,
  instagram: INSTAGRAM_PROFILE,
  tiktok: TIKTOK_PROFILE,
  youtube: YOUTUBE_PROFILE,
  reddit: DEFAULT_PROFILE,
});

const FEED_DISCOVERY_ITEM_SELECTORS = Object.freeze({
  default: GENERIC_FEED_DISCOVERY_ITEM_SELECTOR,
  youtube: GENERIC_FEED_DISCOVERY_ITEM_SELECTOR,
  x: GENERIC_FEED_DISCOVERY_ITEM_SELECTOR,
  instagram: GENERIC_FEED_DISCOVERY_ITEM_SELECTOR,
  tiktok: GENERIC_FEED_DISCOVERY_ITEM_SELECTOR,
  facebook: GENERIC_FEED_DISCOVERY_ITEM_SELECTOR,
  reddit: REDDIT_FEED_DISCOVERY_ITEM_SELECTOR,
});

const profileSiteIds = Object.keys(FEED_SURFACE_PROFILES).sort();
const discoverySiteIds = Object.keys(FEED_DISCOVERY_ITEM_SELECTORS).sort();
const supportedSiteIds = [...SUPPORTED_SITE_IDS].sort();
if (
  JSON.stringify(profileSiteIds) !== JSON.stringify(supportedSiteIds)
  || JSON.stringify(discoverySiteIds) !== JSON.stringify(supportedSiteIds)
) {
  throw new Error('FEED_SURFACE_SITE_COVERAGE_INVALID');
}
Object.entries(FEED_SURFACE_PROFILES).forEach(([siteId, profile]) => {
  const expectedProfileId = siteId === 'reddit' ? 'default' : siteId;
  if (profile.id !== expectedProfileId) {
    throw new Error(`FEED_SURFACE_PROFILE_ASSIGNMENT_INVALID:${siteId}`);
  }
});
Object.entries(FEED_DISCOVERY_ITEM_SELECTORS).forEach(([siteId, selector]) => {
  if (typeof selector !== 'string' || !selector || selector !== selector.trim()) {
    throw new Error(`FEED_SURFACE_DISCOVERY_ASSIGNMENT_INVALID:${siteId}`);
  }
});

export function getFeedSurfaceProfile(hostname) {
  const siteId = resolveSiteId(hostname);
  return FEED_SURFACE_PROFILES[siteId];
}

export function getFeedDiscoveryItemSelector(hostname) {
  return FEED_DISCOVERY_ITEM_SELECTORS[resolveSiteId(hostname)];
}

export function resolveFeedSurfaceRoute({ hostname, pathname = '' } = {}) {
  requireFeedSurfacePathname(pathname);
  const canonicalHostname = normalizeSiteHostname(hostname);
  const profile = getFeedSurfaceProfile(canonicalHostname);
  const route = profile.resolveRoute({ hostname: canonicalHostname, pathname });
  if (
    !route
    || typeof route.semanticSurfaceId !== 'string'
    || !route.semanticSurfaceId
    || typeof route.routeFamily !== 'string'
    || !route.routeFamily
    || !Object.values(FEED_SURFACE_MODES).includes(route.surfaceMode)
  ) {
    throw new Error(`FEED_SURFACE_ROUTE_INVALID:${profile.id}`);
  }
  return route;
}

export function resolveFeedSurfaceMode({ hostname, pathname = '' } = {}) {
  return resolveFeedSurfaceRoute({ hostname, pathname }).surfaceMode;
}
