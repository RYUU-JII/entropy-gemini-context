import { resolveSiteId } from '../targeting/siteIdentityCatalog.js';

const PROFILE_KEYS = Object.freeze([
  'id',
  'siteId',
  'playerRootSelector',
  'timelineTargetSelector',
  'timelineValidation',
  'excludedTargetSelector',
  'scrubberSelector',
  'previewSelector',
]);

function fail(path, reason) {
  const error = new Error(`VIDEO_SKIP_CONTROL_SURFACE_PROFILE_INVALID:${path}:${reason}`);
  error.code = 'VIDEO_SKIP_CONTROL_SURFACE_PROFILE_INVALID';
  error.details = Object.freeze({ path, reason });
  throw error;
}

function defineProfile(siteId, declaration) {
  if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) {
    fail(siteId, 'object_required');
  }
  const keys = Object.keys(declaration).sort();
  const expectedKeys = [...PROFILE_KEYS].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    fail(siteId, 'exact_profile_shape_required');
  }
  if (declaration.siteId !== siteId || declaration.id !== `${siteId}_control_surface`) {
    fail(siteId, 'canonical_identity_required');
  }
  PROFILE_KEYS.filter((key) => key.endsWith('Selector')).forEach((key) => {
    const value = declaration[key];
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      fail(`${siteId}.${key}`, 'selector_required');
    }
  });
  if (!['selector', 'instagram_structural', 'native_declared'].includes(declaration.timelineValidation)) {
    fail(`${siteId}.timelineValidation`, 'policy_invalid');
  }
  return Object.freeze({ ...declaration });
}

const NON_VOLUME_RANGE_SELECTOR = ':is('
  + '[data-testid*="progress" i], '
  + '[data-testid*="seek" i], '
  + '[data-testid*="scrub" i], '
  + '[role="slider"][aria-valuemin][aria-valuemax], '
  + 'input[type="range"][max]'
  + '):not([data-testid*="volume" i]):not([aria-label*="volume" i])'
  + ':not([aria-valuemax="1"]):not(input[max="1"])';

const CONTROL_SURFACE_PROFILES = Object.freeze({
  youtube: defineProfile('youtube', {
    id: 'youtube_control_surface',
    siteId: 'youtube',
    playerRootSelector: ':is(#movie_player, .html5-video-player, #shorts-player, ytd-shorts)',
    timelineTargetSelector: ':is(.ytp-progress-bar-container, .ytp-progress-bar, .ytp-progress-list, .ytp-scrubber-container, .ytp-scrubber-button)',
    timelineValidation: 'selector',
    excludedTargetSelector: ':is(.ytp-volume-area, .ytp-volume-panel, .ytp-mute-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-overlay-container, .ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-preview-container, .ytp-ad-module, .video-ads)',
    scrubberSelector: ':is(.ytp-scrubber-container, .ytp-scrubber-button)',
    previewSelector: ':is(.ytp-preview, .ytp-storyboard-framepreview, .ytp-time-preview, .ytp-progress-bar-container .ytp-tooltip)',
  }),
  x: defineProfile('x', {
    id: 'x_control_surface',
    siteId: 'x',
    playerRootSelector: ':is([data-testid="videoPlayer"], [data-testid="videoComponent"])',
    timelineTargetSelector: NON_VOLUME_RANGE_SELECTOR,
    timelineValidation: 'selector',
    excludedTargetSelector: ':is([data-testid*="volume" i], [aria-label*="volume" i], [class*="volume" i], [id*="volume" i])',
    scrubberSelector: ':is([data-testid*="thumb" i])',
    previewSelector: ':is([data-testid*="preview" i], [data-testid*="tooltip" i])',
  }),
  instagram: defineProfile('instagram', {
    id: 'instagram_control_surface',
    siteId: 'instagram',
    playerRootSelector: ':is(article, section[role="dialog"], div[role="dialog"])',
    timelineTargetSelector: NON_VOLUME_RANGE_SELECTOR,
    timelineValidation: 'instagram_structural',
    excludedTargetSelector: ':is([data-testid*="volume" i], [aria-label*="volume" i], [class*="volume" i], [id*="volume" i])',
    scrubberSelector: ':is([data-testid*="scrub" i], [data-testid*="thumb" i])',
    previewSelector: ':is([data-testid*="preview" i], [data-testid*="tooltip" i])',
  }),
  tiktok: defineProfile('tiktok', {
    id: 'tiktok_control_surface',
    siteId: 'tiktok',
    playerRootSelector: ':is([data-e2e*="video-player" i], [data-e2e*="browse-video" i], [data-e2e*="recommend-video" i], [data-e2e="recommend-list-item-container"])',
    timelineTargetSelector: ':is([data-e2e*="progress" i], [data-e2e*="seek" i], [data-e2e*="scrub" i], [class*="DivVideoProgressContainer"], [class*="DivProgressBar"], [role="slider"][aria-valuenow], [role="slider"][aria-valuemin][aria-valuemax], input[type="range"][max]):not([data-e2e*="volume" i]):not([aria-label*="volume" i]):not([aria-valuemax="1"]):not(input[max="1"])',
    timelineValidation: 'selector',
    excludedTargetSelector: ':is([data-e2e*="volume" i], [aria-label*="volume" i], [class*="volume" i], [id*="volume" i])',
    scrubberSelector: ':is([data-e2e*="scrub" i], [data-e2e*="thumb" i], [class*="DivProgressBarScrubHead"])',
    previewSelector: ':is([data-e2e*="preview" i], [data-e2e*="tooltip" i])',
  }),
  reddit: defineProfile('reddit', {
    id: 'reddit_control_surface',
    siteId: 'reddit',
    playerRootSelector: ':is(shreddit-player, rs-video-player, [data-testid*="video-player" i], [data-testid="videoPlayer"], [data-video-player])',
    timelineTargetSelector: ':is(faceplate-slider, [part*="progress" i], [part*="seek" i], [data-testid*="progress" i], [data-testid*="seek" i], [role="slider"][aria-valuemin][aria-valuemax], input[type="range"][max]):not([part*="volume" i]):not([data-testid*="volume" i]):not([aria-label*="volume" i]):not([aria-valuemax="1"]):not(input[max="1"])',
    timelineValidation: 'selector',
    excludedTargetSelector: ':is([part*="volume" i], [data-testid*="volume" i], [aria-label*="volume" i], [class*="volume" i], [id*="volume" i])',
    scrubberSelector: ':is([part*="thumb" i], [part*="scrub" i], [data-testid*="thumb" i], [data-testid*="scrub" i])',
    previewSelector: ':is([part*="preview" i], [data-testid*="preview" i], [data-testid*="tooltip" i])',
  }),
});

export const VIDEO_SKIP_NATIVE_CONTROL_FAMILIES = Object.freeze([
  Object.freeze({ player: '.video-js', timeline: '.vjs-progress-control, .vjs-progress-holder' }),
  Object.freeze({ player: '.plyr', timeline: '.plyr__progress' }),
  Object.freeze({ player: '.jwplayer', timeline: '.jw-slider-time' }),
]);

// This is a capability declaration, not an unscoped range/slider heuristic.
// Each candidate still needs one exact video, seek semantics and a declared
// player family or an explicit aria-controls relationship at runtime.
const NATIVE_CONTROL_SURFACE_PROFILE = defineProfile('native', {
  id: 'native_control_surface',
  siteId: 'native',
  playerRootSelector: `:is(${VIDEO_SKIP_NATIVE_CONTROL_FAMILIES.map((family) => family.player).join(', ')}, [data-video-player], [data-media-player])`,
  timelineTargetSelector: `:is(${VIDEO_SKIP_NATIVE_CONTROL_FAMILIES.map((family) => family.timeline).join(', ')}, [data-media-control="seek"], [role="slider"][aria-controls], input[type="range"][aria-controls])`,
  timelineValidation: 'native_declared',
  excludedTargetSelector: ':is([data-media-control="volume"], [data-testid*="volume" i], [aria-label*="volume" i], [class*="volume" i], [id*="volume" i], [class*="ad-skip" i], [class*="skip-ad" i], .ad-showing, .ad-interrupting, .video-ads)',
  scrubberSelector: ':is(.vjs-progress-control .vjs-slider-handle, .jw-slider-time .jw-knob)',
  previewSelector: ':is(.vjs-mouse-display, .jw-slider-time .jw-preview, .plyr__preview-thumb)',
});

export const VIDEO_SKIP_CONTROL_SURFACE_SITE_IDS = Object.freeze(
  Object.keys(CONTROL_SURFACE_PROFILES),
);

export function getVideoSkipControlSurfaceProfile(siteId) {
  if (typeof siteId !== 'string' || !siteId) {
    throw new Error('VIDEO_SKIP_CONTROL_SURFACE_SITE_ID_REQUIRED');
  }
  return Object.hasOwn(CONTROL_SURFACE_PROFILES, siteId)
    ? CONTROL_SURFACE_PROFILES[siteId]
    : null;
}

export function resolveVideoSkipControlSurfaceProfile(hostname) {
  const siteId = resolveSiteId(hostname);
  const siteProfile = getVideoSkipControlSurfaceProfile(siteId);
  if (siteProfile) return siteProfile;
  return NATIVE_CONTROL_SURFACE_PROFILE;
}

export default resolveVideoSkipControlSurfaceProfile;
