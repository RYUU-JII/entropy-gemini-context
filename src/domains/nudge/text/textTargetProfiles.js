import {
  TARGET_MERGE_POLICIES,
  TARGET_VALUE_KINDS,
  createTargetProfileResolver,
  defineTargetProfileFields,
} from '../targeting/contracts/targetProfileContracts.js';

const GENERIC_TEXT_EFFECT_TARGETS = [
  'p:not(:has(img, video, canvas))',
  'li:not(:has(img, video, canvas))',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'td',
  'th',
  'figcaption',
  'caption',
  'summary',
  'label',
  'legend',
  'small',
  'time',
  'cite',
  'dt',
  'dd',
  'a:not(:has(img, video, canvas))',
  'button',
  '[role="button"]',
  '[role="link"]',
  '[role="heading"]',
  '[role="text"]',
  'span[role="text"]',
  'span[dir="auto"]',
  'span[lang]',
  'span:not(:empty):not(:has(img, video, canvas, svg))',
  'strong',
  'em',
  'b',
  'i',
  'mark',
].join(', ');
const GENERIC_TEXT_VISUAL_TARGETS = [
  'p:not(:has(img, video))',
  'li:not(:has(img, video))',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  '[role="heading"]',
  '[role="article"]',
  '[itemprop="articleBody"]',
  '[itemprop="text"]',
  '.write_div',
  '.xe_content',
  '.fr-view',
  '.ql-editor',
  '.entry-content',
  '.post-content',
  '.post_content',
  '.article-body',
  '.article_body',
  '.comment-content',
  '.comment_content',
  '.comment-body',
  '.comment_body',
  '.comment-text',
  '.comment_text',
  '.commentContent',
  '.commentText',
  '.usertxt',
  'td:not(:has(img, video))',
  'th:not(:has(img, video))',
  'figcaption',
  'caption',
  'summary',
  'dt',
  'dd',
  'a:not(:has(img, video, canvas))',
].join(', ');
const YOUTUBE_CORE_TEXT_TARGETS = [
  'ytd-watch-metadata h1',
  'ytd-watch-metadata h1 yt-formatted-string',
  'ytd-watch-metadata #description',
  'ytd-watch-metadata ytd-text-inline-expander',
  'ytd-expander #content',
  'ytd-comment-thread-renderer #content-text',
  'ytd-comment-view-model #content-text',
  'ytd-comment-renderer #content-text',
  'ytd-reel-player-overlay-renderer yt-formatted-string',
  'ytd-reel-player-overlay-renderer yt-attributed-string',
  'ytd-reel-player-overlay-renderer .yt-core-attributed-string',
];
const YOUTUBE_WATCH_TITLE_TEXT_TARGETS = [
  'h3 a[href^="/watch"] :is([role="text"], span[dir="auto"])',
  'h3 a[href*="youtube.com/watch"] :is([role="text"], span[dir="auto"])',
  '[role="heading"] a[href^="/watch"] :is([role="text"], span[dir="auto"])',
  '[role="heading"] a[href*="youtube.com/watch"] :is([role="text"], span[dir="auto"])',
  'yt-lockup-view-model a[href^="/watch"] :is([role="text"], span[dir="auto"])',
  'yt-lockup-view-model a[href*="youtube.com/watch"] :is([role="text"], span[dir="auto"])',
];
const GENERIC_TEXT_SHUFFLE_EXCLUDED_TARGETS = [
  'script', 'style', 'noscript', 'textarea', 'input', 'select', 'option', 'pre', 'code', 'kbd', 'samp', 'svg', 'math',
  'button', '[role="button"]', '[role="menu"]', '[role="menubar"]', '[role="menuitem"]', '[role="tab"]',
  'nav', '[role="navigation"]', '[role="toolbar"]',
  '[contenteditable="true"]', '[contenteditable=""]',
];
const GENERIC_TEXT_SHUFFLE_EXCLUDED_CLOSEST = GENERIC_TEXT_SHUFFLE_EXCLUDED_TARGETS.join(', ');
// Instagram exposes entire caption/comment rows as role-buttons. Their list
// item and reading/author heading distinguish them from nested action controls.
const INSTAGRAM_READING_ROW = 'article [role="button"]:has(li :is(h1, h3))';

export const TEXT_TARGET_PROFILE_SCHEMA = Object.freeze({
  overlayExempt: Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR }),
  textEffectTargets: Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR }),
  textLayoutTargets: Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR }),
  textShuffleExcludedClosest: Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR }),
  textShuffleTargets: Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR }),
});

export const TEXT_TARGET_MERGE_POLICIES = Object.freeze({
  overlayExempt: TARGET_MERGE_POLICIES.REPLACE,
  textEffectTargets: TARGET_MERGE_POLICIES.EXTEND_SELECTOR,
  textLayoutTargets: TARGET_MERGE_POLICIES.REPLACE,
  textShuffleExcludedClosest: TARGET_MERGE_POLICIES.REPLACE,
  textShuffleTargets: TARGET_MERGE_POLICIES.REPLACE,
});

const TEXT_TARGET_PROFILES = {
  default: {
    textLayoutTargets: ':is(p, li, h1, h2, h3, h4, h5, h6, [role="heading"], [role="article"], [itemprop="articleBody"], [itemprop="text"], .write_div, .xe_content, .fr-view, .ql-editor, .entry-content, .post-content, .post_content, .article-body, .article_body, .comment-content, .comment_content, .comment-body, .comment_body, .comment-text, .comment_text, .commentContent, .commentText, .usertxt, blockquote, td, th, figcaption, caption, summary, dt, dd)',
    textEffectTargets: GENERIC_TEXT_EFFECT_TARGETS,
    textShuffleTargets: GENERIC_TEXT_VISUAL_TARGETS,
    overlayExempt:
      ':is([role="dialog"], [aria-modal="true"], [data-friction-indicator="1"], [data-intervention-indicator="1"])',
    textShuffleExcludedClosest: GENERIC_TEXT_SHUFFLE_EXCLUDED_CLOSEST,
  },
  youtube: {
    textLayoutTargets: YOUTUBE_CORE_TEXT_TARGETS.join(', '),
    textShuffleTargets: [
      ...YOUTUBE_CORE_TEXT_TARGETS,
      ...YOUTUBE_WATCH_TITLE_TEXT_TARGETS,
    ].join(', '),
    textEffectTargets: [
      ...YOUTUBE_CORE_TEXT_TARGETS,
      'ytd-rich-grid-media #video-title',
      'ytd-video-renderer #video-title',
      'ytd-grid-video-renderer #video-title',
      'ytd-compact-video-renderer #video-title',
      'ytd-playlist-video-renderer #video-title',
      'yt-formatted-string',
      'yt-attributed-string',
      '.yt-core-attributed-string',
      '.yt-content-metadata-view-model__metadata-row',
      '.ytContentMetadataViewModelMetadataText',
      'ytd-badge-supported-renderer',
      'ytd-button-renderer',
      'a',
    ].join(', '),
  },
  x: {
    textLayoutTargets: ':is([data-testid="tweetText"], article div[lang])',
    textShuffleTargets: ':is([data-testid="tweetText"], article div[lang])',
    textEffectTargets: [
      '[data-testid="tweetText"]',
      'article div[lang]',
      'article a',
      'article button',
      'article [role="button"]',
      'article [role="link"]',
      'article time',
      'article span:not(:empty):not(:has(img, video, canvas, svg))',
    ].join(', '),
  },
  instagram: {
    // Instagram links identify accounts, mentions/tags, or navigation/actions.
    // Preserve that semantic boundary even when @/# and the label are split
    // across text nodes; reading prose outside the link remains eligible.
    textShuffleTargets: [
      GENERIC_TEXT_VISUAL_TARGETS,
      ':is(article, main[role="main"]) span[dir="auto"]:not([role="button"] span)',
      INSTAGRAM_READING_ROW,
    ].join(', '),
    overlayExempt: [
      ':is([role="dialog"], [aria-modal="true"]):not(:has(article))',
      '[data-friction-indicator="1"]',
      '[data-intervention-indicator="1"]',
    ].join(', '),
    textShuffleExcludedClosest: [
      ...GENERIC_TEXT_SHUFFLE_EXCLUDED_TARGETS.map(selector => selector === '[role="button"]'
        ? `[role="button"]:not(${INSTAGRAM_READING_ROW})` : selector),
      'a',
      '[role="link"]',
      'header',
      'time',
    ].join(', '),
  },
  tiktok: {
    textLayoutTargets: '[data-e2e="video-desc"]',
    textEffectTargets: '[data-e2e="video-desc"]',
    textShuffleExcludedClosest: [
      GENERIC_TEXT_SHUFFLE_EXCLUDED_CLOSEST,
      // Profile destinations identify the creator. Video destinations can
      // still contain reading text, so they retain the generic eligibility.
      ':is(a[href^="/@"], a[href^="https://www.tiktok.com/@"], a[href^="https://tiktok.com/@"]):not([href*="/video/"])',
    ].join(', '),
  },
};

export const getTextTargetProfile = createTargetProfileResolver({
  ownerId: 'text',
  schema: TEXT_TARGET_PROFILE_SCHEMA,
  mergePolicies: TEXT_TARGET_MERGE_POLICIES,
  profiles: TEXT_TARGET_PROFILES,
});

export function getTextTargets(hostname = '') {
  return getTextTargetProfile(hostname).targets;
}

export function validateTextTargets(targets) {
  return defineTargetProfileFields({
    ownerId: 'text',
    schema: TEXT_TARGET_PROFILE_SCHEMA,
    fields: targets,
    path: 'runtime_targets',
  });
}
