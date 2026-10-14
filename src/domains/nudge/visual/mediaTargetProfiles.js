import {
  TARGET_MERGE_POLICIES,
  TARGET_VALUE_KINDS,
  createTargetProfileResolver,
  defineTargetProfileFields,
} from '../targeting/contracts/targetProfileContracts.js';

const REPLACE = TARGET_MERGE_POLICIES.REPLACE;
const SELECTOR = Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR, allowEmpty: true });
const REQUIRED_SELECTOR = Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR });
const STRING_LIST = Object.freeze({ kind: TARGET_VALUE_KINDS.STRING_LIST });
const NON_NEGATIVE_NUMBER = Object.freeze({ kind: TARGET_VALUE_KINDS.NUMBER, minimum: 0 });

export const MEDIA_TARGET_PROFILE_SCHEMA = Object.freeze({
  visualMediaCandidates: REQUIRED_SELECTOR,
  visualMediaContexts: REQUIRED_SELECTOR,
  visualMediaExcludeKeywords: STRING_LIST,
  visualMediaMinArea: NON_NEGATIVE_NUMBER,
  visualMediaMinHeight: NON_NEGATIVE_NUMBER,
  visualMediaMinLongestEdge: NON_NEGATIVE_NUMBER,
  visualMediaMinWidth: NON_NEGATIVE_NUMBER,
  visualMediaOverlayExempt: REQUIRED_SELECTOR,
  visualMediaSmallSquareEdgeMax: NON_NEGATIVE_NUMBER,
  visualMediaWideAspectMinArea: NON_NEGATIVE_NUMBER,
  visualMediaWideAspectMinLongestEdge: NON_NEGATIVE_NUMBER,
  visualMediaWideAspectMinRatio: NON_NEGATIVE_NUMBER,
  visualShortFormContexts: SELECTOR,
  visualShortFormDescendantContexts: SELECTOR,
  visualShortFormStructuralContexts: SELECTOR,
  visualShortFormStructuralEvidence: SELECTOR,
  visualVideoTargets: REQUIRED_SELECTOR,
});

export const MEDIA_TARGET_MERGE_POLICIES = Object.freeze(Object.fromEntries(
  Object.keys(MEDIA_TARGET_PROFILE_SCHEMA).map((key) => [key, REPLACE]),
));

const GENERIC_CONTAINER_TARGETS =
  ':is(article, main, section, figure, [role="article"], [role="main"], [role="listitem"], [data-testid*="post" i], [data-testid*="feed" i], [class*="card" i], [class*="post" i], [class*="feed" i], [class*="story" i], [class*="thumb" i], [id*="post" i], [id*="feed" i], [id*="thumb" i])';
const GENERIC_MEDIA_CANDIDATES = ':is(img, picture img, video, canvas, [role="img"], [style*="background-image"])';
const GENERIC_MEDIA_EXCLUDE_KEYWORDS = [
  'icon',
  'emoji',
  'emoticon',
  'badge',
  'avatar',
  'logo',
  'sprite',
  'favicon',
];
const STANDARD_DOMAIN_MEDIA_EXCLUDE_KEYWORDS = [
  'avatar',
  'profile',
  'icon',
  'emoji',
  'badge',
  'logo',
  'favicon',
];
const STANDARD_SOCIAL_MEDIA_GEOMETRY = {
  visualMediaMinWidth: 88,
  visualMediaMinHeight: 60,
  visualMediaMinArea: 5000,
  visualMediaMinLongestEdge: 96,
  visualMediaSmallSquareEdgeMax: 84,
};

const YOUTUBE_CONTAINER_TARGETS =
  ':is(ytd-thumbnail, yt-thumbnail-view-model, #thumbnail, [class*="thumbnail" i], [id*="thumbnail" i], ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, yt-lockup-view-model, .ytp-videowall-still)';
const TIKTOK_CONTAINER_TARGETS =
  ':is([data-e2e="recommend-list-item-container"], [data-e2e="user-post-item"], [data-e2e*="feed-item" i], [data-e2e*="video-item" i], [data-e2e*="browse-video" i], [data-e2e*="video-player" i], video)';

const MEDIA_TARGET_PROFILES = {
  default: {
    visualMediaCandidates: GENERIC_MEDIA_CANDIDATES,
    visualMediaContexts: GENERIC_CONTAINER_TARGETS,
    visualMediaExcludeKeywords: GENERIC_MEDIA_EXCLUDE_KEYWORDS,
    visualMediaMinArea: 3600,
    visualMediaMinHeight: 48,
    visualMediaMinLongestEdge: 88,
    visualMediaMinWidth: 80,
    visualMediaOverlayExempt:
      ':is([data-friction-indicator="1"], [data-intervention-indicator="1"])',
    visualMediaSmallSquareEdgeMax: 72,
    visualMediaWideAspectMinArea: 0,
    visualMediaWideAspectMinLongestEdge: 0,
    visualMediaWideAspectMinRatio: 0,
    visualShortFormContexts: '',
    visualShortFormDescendantContexts: '',
    visualShortFormStructuralContexts: '',
    visualShortFormStructuralEvidence: '',
    visualVideoTargets: 'video',
  },
  youtube: {
    visualMediaContexts: YOUTUBE_CONTAINER_TARGETS,
    visualMediaCandidates:
      ':is(img[src*="ytimg.com/vi"], img[src*="ytimg.com/vi_webp"], ytd-thumbnail img, yt-thumbnail-view-model img, [style*="ytimg.com/vi"], video, canvas)',
    visualShortFormContexts:
      ':is(ytd-reel-item-renderer, ytd-reel-video-renderer, ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2), grid-shelf-view-model:has(ytm-shorts-lockup-view-model), a[href*="/shorts/"], a[href^="/shorts"], #shorts-player, ytd-shorts)',
    visualShortFormStructuralContexts: 'grid-shelf-view-model',
    visualShortFormStructuralEvidence: 'ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2',
    visualMediaMinWidth: 64,
    visualMediaMinHeight: 36,
    visualMediaMinArea: 2300,
    visualMediaMinLongestEdge: 72,
    visualMediaSmallSquareEdgeMax: 64,
    visualMediaWideAspectMinRatio: 1.45,
    visualMediaWideAspectMinArea: 1700,
    visualMediaWideAspectMinLongestEdge: 58,
    visualMediaExcludeKeywords: ['avatar', 'profile', 'channel', 'icon', 'emoji', 'badge', 'logo'],
  },
  x: {
    visualMediaContexts:
      ':is(article, [data-testid="tweet"], [data-testid="tweetPhoto"], [data-testid="card.wrapper"], [role="dialog"])',
    visualMediaCandidates:
      ':is([data-testid="tweetPhoto"] img, [data-testid="tweetPhoto"] [style*="background-image"], [data-testid="card.wrapper"] img, [data-testid="card.wrapper"] [style*="background-image"], img[src*="pbs.twimg.com/media" i], img[src*="pbs.twimg.com/card_img" i], [style*="pbs.twimg.com/media" i], [style*="pbs.twimg.com/card_img" i], article video, [data-testid="videoPlayer"] video)',
    ...STANDARD_SOCIAL_MEDIA_GEOMETRY,
    visualMediaExcludeKeywords: STANDARD_DOMAIN_MEDIA_EXCLUDE_KEYWORDS,
  },
  instagram: {
    visualMediaContexts: ':is(article, section[role="dialog"], div[role="dialog"])',
    visualMediaCandidates:
      ':is(article img, article video, section[role="dialog"] img, section[role="dialog"] video, div[role="dialog"] img, div[role="dialog"] video, [style*="cdninstagram.com"])',
    visualShortFormContexts:
      ':is(a[href^="/reel/"], a[href^="/reels/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/explore/reels"], article:has(a[href*="/reel/"]), article:has(a[href*="/reels/"]), section[role="dialog"]:has(a[href*="/reel/"]), section[role="dialog"]:has(a[href*="/reels/"]), div[role="dialog"]:has(a[href*="/reel/"]), div[role="dialog"]:has(a[href*="/reels/"]))',
    visualShortFormDescendantContexts: ':is(article, section[role="dialog"], div[role="dialog"])',
    visualMediaMinWidth: 90,
    visualMediaMinHeight: 90,
    visualMediaMinArea: 6200,
    visualMediaMinLongestEdge: 100,
    visualMediaSmallSquareEdgeMax: 92,
    visualMediaExcludeKeywords: STANDARD_DOMAIN_MEDIA_EXCLUDE_KEYWORDS,
  },
  tiktok: {
    visualMediaContexts: TIKTOK_CONTAINER_TARGETS,
    visualMediaCandidates:
      ':is(video, picture img, img[src*="tiktokcdn" i], img[src*="muscdn" i], img[src*="ibyteimg" i])',
    visualShortFormContexts: TIKTOK_CONTAINER_TARGETS,
    visualMediaMinWidth: 96,
    visualMediaMinHeight: 128,
    visualMediaMinArea: 9000,
    visualMediaMinLongestEdge: 120,
    visualMediaSmallSquareEdgeMax: 84,
    visualMediaExcludeKeywords: STANDARD_DOMAIN_MEDIA_EXCLUDE_KEYWORDS,
  },
  facebook: {
    visualMediaContexts:
      ':is([role="article"], [data-pagelet^="FeedUnit_"], [data-pagelet*="FeedUnit" i], [data-ad-preview], [aria-posinset][aria-describedby])',
    visualMediaCandidates:
      ':is(img[src*="fbcdn" i], video, canvas, [role="img"], [style*="fbcdn" i], [style*="background-image"])',
    ...STANDARD_SOCIAL_MEDIA_GEOMETRY,
    visualMediaExcludeKeywords: STANDARD_DOMAIN_MEDIA_EXCLUDE_KEYWORDS,
  },
  reddit: {
    visualMediaContexts:
      ':is(shreddit-post, shreddit-comment, [data-testid="post-container"], [data-testid*="post" i], article)',
    visualMediaCandidates:
      ':is(shreddit-post img, shreddit-post video, shreddit-post canvas, shreddit-post [style*="background-image"], article img, article video)',
    ...STANDARD_SOCIAL_MEDIA_GEOMETRY,
    visualMediaExcludeKeywords: STANDARD_DOMAIN_MEDIA_EXCLUDE_KEYWORDS,
  },
};

export const getMediaTargetProfile = createTargetProfileResolver({
  ownerId: 'media',
  schema: MEDIA_TARGET_PROFILE_SCHEMA,
  mergePolicies: MEDIA_TARGET_MERGE_POLICIES,
  profiles: MEDIA_TARGET_PROFILES,
});

export function getMediaTargets(hostname = '') {
  return getMediaTargetProfile(hostname).targets;
}

export function validateMediaTargets(targets) {
  return defineTargetProfileFields({
    ownerId: 'media',
    schema: MEDIA_TARGET_PROFILE_SCHEMA,
    fields: targets,
    path: 'runtime_targets',
  });
}
