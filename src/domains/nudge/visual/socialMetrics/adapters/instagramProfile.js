import {
  TARGET_VALUE_KINDS,
  cloneAndFreezeTargetValue,
  defineTargetProfileFields,
} from '../../../targeting/contracts/targetProfileContracts.js';

export const INSTAGRAM_STANDALONE_POST_ROOT_SELECTOR = 'main[role="main"]';

export const INSTAGRAM_SPLIT_FEEDBACK_CANDIDATE_SELECTOR =
  `:is(article, section[role="dialog"], div[role="dialog"], ${INSTAGRAM_STANDALONE_POST_ROOT_SELECTOR}) :is(button, [role="button"]):has(> span)`;

export const INSTAGRAM_LABELLED_FEEDBACK_CANDIDATE_SELECTOR = [
  ':is(article, section[role="dialog"], div[role="dialog"]) :is(button, [role="button"]) span:not(:has(*))',
  ':is(article, section[role="dialog"], div[role="dialog"]) section span:not(:has(*))',
  `${INSTAGRAM_STANDALONE_POST_ROOT_SELECTOR} :is(button, [role="button"]) span:not(:has(*))`,
].join(',');

export const INSTAGRAM_SOCIAL_METRIC_TARGETS = cloneAndFreezeTargetValue({
  metricSelectors: {
    feedbackCounts: [
      'a[href*="/liked_by/"] span',
      'a[href*="/likes/"] span',
    ],
    viewCounts: [
      'article section span[dir="auto"]',
      'section[role="dialog"] section span[dir="auto"]',
      'div[role="dialog"] section span[dir="auto"]',
    ],
    timeSignals: ['time[datetime]'],
    audienceCounts: [
      'a[href$="/followers/"] span',
      'a[href*="/followers/"] span',
      'header section ul li a span',
    ],
  },
  scanRoots: [
    'article',
    'section[role="dialog"]',
    'div[role="dialog"]',
    INSTAGRAM_STANDALONE_POST_ROOT_SELECTOR,
    'header',
    'time[datetime]',
  ],
});

export const INSTAGRAM_ADAPTER_TARGET_PROFILE_SCHEMA = Object.freeze(Object.fromEntries(
  [
    'buttonOrLink',
    'deepLabel',
    'deepLabelScan',
    'gridMedia',
    'gridOverlayIcons',
    'postLink',
    'time',
  ].map((key) => [key, Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR })]),
));

export const INSTAGRAM_ADAPTER_TARGETS = defineTargetProfileFields({
  ownerId: 'instagram_social_adapter',
  schema: INSTAGRAM_ADAPTER_TARGET_PROFILE_SCHEMA,
  path: 'adapter_targets',
  fields: {
    time: 'time[datetime]',
    buttonOrLink: ':is(button, a, [role="button"], [role="link"])',
    postLink: 'a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]',
    gridMedia: ':is(img, video, canvas, [role="img"])',
    gridOverlayIcons:
      ':is(svg, [role="img"], [aria-label*="like" i], [aria-label*="comment" i], [title*="like" i], [title*="comment" i])',
    deepLabel: ':is(svg[aria-label], svg[title], [role="img"][aria-label], [role="img"][title])',
    deepLabelScan:
      ':is(svg[aria-label], svg[title], [role="img"][aria-label], [role="img"][title], [aria-label], [title])',
  },
});
