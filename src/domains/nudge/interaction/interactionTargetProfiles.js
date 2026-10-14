import {
  TARGET_MERGE_POLICIES,
  TARGET_VALUE_KINDS,
  createTargetProfileResolver,
  defineTargetProfileFields,
} from '../targeting/contracts/targetProfileContracts.js';

const CLICK_BOUNDARY_HINT_KEYS = Object.freeze([
  'currentContentTargets',
  'escapeTargets',
  'nativeControlTargets',
  'rewardContinuationTargets',
  'rewardEntryTargets',
  'socialReinforcementTargets',
  'utilityTargets',
]);
const ACTIONABLE_FORM_CONTROL_KEYS = Object.freeze(['inputImage', 'inputSubmit']);
const REQUIRED_SELECTOR = Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR });
const OPTIONAL_SELECTOR = Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR, allowEmpty: true });

export const INTERACTION_TARGET_PROFILE_SCHEMA = Object.freeze({
  actionableFormControls: Object.freeze({
    kind: TARGET_VALUE_KINDS.SELECTOR_MAP,
    keys: ACTIONABLE_FORM_CONTROL_KEYS,
  }),
  clickBoundaryHints: Object.freeze({
    kind: TARGET_VALUE_KINDS.SELECTOR_MAP,
    keys: CLICK_BOUNDARY_HINT_KEYS,
    allowEmpty: true,
  }),
  clickDelayActionableTargets: OPTIONAL_SELECTOR,
  clickDelayBypassTargets: REQUIRED_SELECTOR,
  clickDelayNativeGestureBypassTargets: REQUIRED_SELECTOR,
  continuousFeedContextTargets: OPTIONAL_SELECTOR,
  inputDelayBypassTargets: REQUIRED_SELECTOR,
  interactiveTargets: REQUIRED_SELECTOR,
  rewardContainerTargets: REQUIRED_SELECTOR,
  rewardContentItemTargets: REQUIRED_SELECTOR,
  rewardMediaTargets: REQUIRED_SELECTOR,
});

export const INTERACTION_TARGET_MERGE_POLICIES = Object.freeze({
  actionableFormControls: TARGET_MERGE_POLICIES.REPLACE,
  clickBoundaryHints: TARGET_MERGE_POLICIES.MERGE_MAP,
  clickDelayActionableTargets: TARGET_MERGE_POLICIES.EXTEND_SELECTOR,
  clickDelayBypassTargets: TARGET_MERGE_POLICIES.EXTEND_SELECTOR,
  clickDelayNativeGestureBypassTargets: TARGET_MERGE_POLICIES.EXTEND_SELECTOR,
  continuousFeedContextTargets: TARGET_MERGE_POLICIES.REPLACE,
  inputDelayBypassTargets: TARGET_MERGE_POLICIES.EXTEND_SELECTOR,
  interactiveTargets: TARGET_MERGE_POLICIES.REPLACE,
  rewardContainerTargets: TARGET_MERGE_POLICIES.REPLACE,
  rewardContentItemTargets: TARGET_MERGE_POLICIES.REPLACE,
  rewardMediaTargets: TARGET_MERGE_POLICIES.REPLACE,
});

const GENERIC_INTERACTIVE_TARGETS =
  ':is(a, button, article, [onclick], input[type="submit"], [role="button"], [role="link"], [role="article"])';
const GENERIC_REWARD_CONTENT_ITEM_TARGETS =
  ':is(article, main, section, figure, [role="article"], [role="main"], [role="listitem"])';
const GENERIC_REWARD_CONTAINER_TARGETS =
  ':is(article, main, section, figure, [role="article"], [role="main"], [role="listitem"], [data-testid*="post" i], [data-testid*="feed" i], [class*="card" i], [class*="post" i], [class*="feed" i], [class*="story" i], [class*="thumb" i], [id*="post" i], [id*="feed" i], [id*="thumb" i])';
const GENERIC_REWARD_MEDIA_TARGETS =
  ':is(img, picture img, video, canvas, [role="img"], [style*="background-image"])';
const YOUTUBE_PLAYER_CONTROL_SELECTOR = [
  '.ytp-chrome-controls',
  '.ytp-chrome-controls *',
  '.ytp-chrome-bottom',
  '.ytp-chrome-bottom *',
  '.ytp-progress-bar-container',
  '.ytp-progress-bar-container *',
  '.ytp-progress-list',
  '.ytp-progress-list *',
  '.ytp-scrubber-button',
  '.ytp-scrubber-button *',
  '.ytp-button',
  '.ytp-button *',
  '.ytp-volume-area',
  '.ytp-volume-area *',
  '.ytp-volume-panel',
  '.ytp-volume-panel *',
  '.ytp-volume-slider',
  '.ytp-volume-slider *',
  '.ytp-settings-menu',
  '.ytp-settings-menu *',
  '.ytp-panel',
  '.ytp-panel *',
  '.ytp-popup',
  '.ytp-popup *',
  '.ytp-menuitem',
  '.ytp-menuitem *',
].join(', ');
const YOUTUBE_REWARD_CONTENT_ITEM_TARGETS =
  ':is(ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, yt-lockup-view-model)';
const YOUTUBE_REWARD_CONTAINER_TARGETS =
  ':is(ytd-thumbnail, yt-thumbnail-view-model, #thumbnail, [class*="thumbnail" i], [id*="thumbnail" i], ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, yt-lockup-view-model, .ytp-videowall-still)';
const YOUTUBE_CONTINUOUS_FEED_CONTEXT_TARGETS =
  ':is(ytd-reel-item-renderer, ytd-reel-video-renderer, ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2), grid-shelf-view-model:has(ytm-shorts-lockup-view-model), a[href*="/shorts/"], a[href^="/shorts"], #shorts-player, ytd-shorts)';
const TIKTOK_REWARD_CONTENT_ITEM_TARGETS =
  ':is([data-e2e="recommend-list-item-container"], [data-e2e="user-post-item"], [data-e2e*="feed-item" i], [data-e2e*="video-item" i], [data-e2e*="browse-video" i], [data-e2e*="video-player" i], [data-e2e*="recommend-video" i])';
const TIKTOK_REWARD_CONTAINER_TARGETS =
  ':is([data-e2e="recommend-list-item-container"], [data-e2e="user-post-item"], [data-e2e*="feed-item" i], [data-e2e*="video-item" i], [data-e2e*="browse-video" i], [data-e2e*="video-player" i], video)';

const INTERACTION_TARGET_PROFILES = {
  default: {
    interactiveTargets: GENERIC_INTERACTIVE_TARGETS,
    clickDelayActionableTargets: '',
    clickDelayBypassTargets: ':is([data-friction-click-delay-bypass="1"])',
    clickDelayNativeGestureBypassTargets: ':is(video[controls], audio[controls])',
    inputDelayBypassTargets: ':is([data-friction-input-delay-bypass="1"])',
    clickBoundaryHints: {
      currentContentTargets: ':is(video, audio)',
      rewardEntryTargets: '',
      rewardContinuationTargets: '',
      socialReinforcementTargets: '',
      // Whole control names are interpreted by ClickBoundaryClassifier. Label
      // selectors here would bypass aria-labelledby precedence.
      utilityTargets: '',
      escapeTargets: '',
      nativeControlTargets: ':is(video[controls], audio[controls])',
    },
    actionableFormControls: {
      inputSubmit: 'input[type="submit"]',
      inputImage: 'input[type="image"]',
    },
    rewardContentItemTargets: GENERIC_REWARD_CONTENT_ITEM_TARGETS,
    rewardContainerTargets: GENERIC_REWARD_CONTAINER_TARGETS,
    rewardMediaTargets: GENERIC_REWARD_MEDIA_TARGETS,
    continuousFeedContextTargets: '',
  },
  youtube: {
    interactiveTargets: [
      GENERIC_INTERACTIVE_TARGETS,
      '#movie_player',
      '.html5-video-player',
      '.ytp-cued-thumbnail-overlay',
      '.ytp-large-play-button',
      '.ytp-videowall-still',
    ].join(', '),
    clickDelayActionableTargets:
      ':is(#movie_player, .html5-video-player, .ytp-cued-thumbnail-overlay, .ytp-large-play-button, .ytp-videowall-still)',
    clickDelayNativeGestureBypassTargets: YOUTUBE_PLAYER_CONTROL_SELECTOR,
    clickBoundaryHints: {
      currentContentTargets:
        ':is(#movie_player, .html5-video-player, .ytp-cued-thumbnail-overlay, .ytp-large-play-button)',
      nativeControlTargets: [
        ':is(video[controls], audio[controls])',
        YOUTUBE_PLAYER_CONTROL_SELECTOR,
      ].join(', '),
    },
    rewardContentItemTargets: YOUTUBE_REWARD_CONTENT_ITEM_TARGETS,
    rewardContainerTargets: YOUTUBE_REWARD_CONTAINER_TARGETS,
    rewardMediaTargets:
      ':is(img[src*="ytimg.com/vi"], img[src*="ytimg.com/vi_webp"], ytd-thumbnail img, yt-thumbnail-view-model img, [style*="ytimg.com/vi"], video, canvas)',
    continuousFeedContextTargets: YOUTUBE_CONTINUOUS_FEED_CONTEXT_TARGETS,
  },
  x: {
    clickDelayNativeGestureBypassTargets:
      ':is([data-testid="videoPlayer"], [data-testid="videoPlayer"] *, [data-testid="videoComponent"], [data-testid="videoComponent"] *, article video)',
    clickBoundaryHints: {
      nativeControlTargets:
        ':is([data-testid="videoPlayer"], [data-testid="videoPlayer"] *, [data-testid="videoComponent"], [data-testid="videoComponent"] *, article video)',
    },
    rewardContentItemTargets: ':is(article, [data-testid="tweet"])',
    rewardContainerTargets: ':is(article, [data-testid="tweet"], [data-testid="tweetPhoto"])',
    rewardMediaTargets:
      ':is([data-testid="tweetPhoto"] img, [data-testid="tweetPhoto"] [style*="background-image"], [data-testid="card.wrapper"] img, [data-testid="card.wrapper"] [style*="background-image"], img[src*="pbs.twimg.com/media" i], img[src*="pbs.twimg.com/card_img" i], [style*="pbs.twimg.com/media" i], [style*="pbs.twimg.com/card_img" i], article video, [data-testid="videoPlayer"] video)',
  },
  instagram: {
    rewardContentItemTargets: ':is(article, section[role="dialog"], div[role="dialog"])',
    rewardContainerTargets: ':is(article, section[role="dialog"], div[role="dialog"])',
    rewardMediaTargets:
      ':is(article img, article video, section[role="dialog"] img, section[role="dialog"] video, div[role="dialog"] img, div[role="dialog"] video, [style*="cdninstagram.com"])',
    continuousFeedContextTargets:
      ':is(a[href^="/reel/"], a[href^="/reels/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/explore/reels"], article:has(a[href*="/reel/"]), article:has(a[href*="/reels/"]), section[role="dialog"]:has(a[href*="/reel/"]), section[role="dialog"]:has(a[href*="/reels/"]), div[role="dialog"]:has(a[href*="/reel/"]), div[role="dialog"]:has(a[href*="/reels/"]))',
  },
  tiktok: {
    rewardContentItemTargets: TIKTOK_REWARD_CONTENT_ITEM_TARGETS,
    rewardContainerTargets: TIKTOK_REWARD_CONTAINER_TARGETS,
    rewardMediaTargets:
      ':is(video, picture img, img[src*="tiktokcdn" i], img[src*="muscdn" i], img[src*="ibyteimg" i])',
    continuousFeedContextTargets: TIKTOK_REWARD_CONTAINER_TARGETS,
  },
  facebook: {
    rewardContentItemTargets:
      ':is([role="article"], [data-pagelet^="FeedUnit_"], [data-pagelet*="FeedUnit" i], [aria-posinset][aria-describedby])',
    rewardContainerTargets:
      ':is([role="article"], [data-pagelet^="FeedUnit_"], [data-pagelet*="FeedUnit" i], [data-ad-preview], [aria-posinset][aria-describedby])',
    rewardMediaTargets:
      ':is(img[src*="fbcdn" i], video, canvas, [role="img"], [style*="fbcdn" i], [style*="background-image"])',
  },
  reddit: {
    rewardContentItemTargets:
      ':is(shreddit-post, shreddit-comment, [data-testid="post-container"], [data-testid*="post" i], article)',
    rewardContainerTargets:
      ':is(shreddit-post, shreddit-comment, [data-testid="post-container"], [data-testid*="post" i], article)',
    rewardMediaTargets:
      ':is(shreddit-post img, shreddit-post video, shreddit-post canvas, shreddit-post [style*="background-image"], article img, article video)',
  },
};

export const getInteractionTargetProfile = createTargetProfileResolver({
  ownerId: 'interaction',
  schema: INTERACTION_TARGET_PROFILE_SCHEMA,
  mergePolicies: INTERACTION_TARGET_MERGE_POLICIES,
  profiles: INTERACTION_TARGET_PROFILES,
});

export function getInteractionTargets(hostname = '') {
  return getInteractionTargetProfile(hostname).targets;
}

export function validateInteractionTargets(targets) {
  return defineTargetProfileFields({
    ownerId: 'interaction',
    schema: INTERACTION_TARGET_PROFILE_SCHEMA,
    fields: targets,
    path: 'runtime_targets',
  });
}
