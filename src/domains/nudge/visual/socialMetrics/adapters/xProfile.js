import { cloneAndFreezeTargetValue } from '../../../targeting/contracts/targetProfileContracts.js';

const X_BOOKMARK_STAT_ROOT_SELECTOR =
  ':is(button, a, [role="button"], [role="link"], div:not([role]))[aria-label*="bookmark" i]';
const X_BOOKMARK_STAT_SELECTOR =
  `${X_BOOKMARK_STAT_ROOT_SELECTOR} span, ${X_BOOKMARK_STAT_ROOT_SELECTOR} strong`;
const X_NEWS_ARTICLE_ROOT_SELECTOR =
  '[data-testid^="news_sidebar_article_"][role="link"]';
const X_NEWS_ARTICLE_TEXT_SELECTOR =
  `${X_NEWS_ARTICLE_ROOT_SELECTOR} span:not(:has(*))`;
export const X_ACCESSIBLE_METRIC_LABEL_SELECTOR = ':is(article, [role="group"], [data-testid="reply"], [data-testid="retweet"], [data-testid="like"], [data-testid="bookmark"], [data-testid="removeBookmark"], [data-testid="viewCount"], a[href*="/analytics"], a[href*="/following"], a[href*="/followers"])[aria-label]';

export const X_SOCIAL_METRIC_TARGETS = cloneAndFreezeTargetValue({
  metricSelectors: {
    feedbackCounts: [
      '[data-testid="like"] span',
      '[data-testid="retweet"] span',
      '[data-testid="reply"] span',
      '[data-testid="bookmark"] span',
      '[data-testid="removeBookmark"] span',
      X_BOOKMARK_STAT_SELECTOR,
      '[role="group"][aria-label]',
      'article[aria-label]',
      ':is([data-testid="reply"], [data-testid="retweet"], [data-testid="like"], [data-testid="bookmark"], [data-testid="removeBookmark"])[aria-label]',
    ],
    viewCounts: [
      '[data-testid="viewCount"] span',
      'a[href*="/analytics"] span',
      X_NEWS_ARTICLE_TEXT_SELECTOR,
      '[role="group"][aria-label]',
      'article[aria-label]',
      '[data-testid="viewCount"][aria-label]',
      'a[href*="/analytics"][aria-label]',
    ],
    timeSignals: ['time[datetime]', X_NEWS_ARTICLE_TEXT_SELECTOR],
    audienceCounts: [
      'a[href$="/following"] span',
      'a[href*="/following"] span',
      'a[href$="/followers"] span',
      'a[href*="/followers"] span',
      'a[href$="/verified_followers"] span',
      'a[href*="/verified_followers"] span',
      'a[href*="/creator-subscriptions/subscriptions"] span',
      '[data-testid="HoverCard"] a[href*="/following"] span',
      '[data-testid="HoverCard"] a[href*="/followers"] span',
      '[data-testid="HoverCard"] a[href*="/verified_followers"] span',
      '[data-testid="UserName"] + div',
      '[data-testid="User-Name"] + div',
      '[data-testid="primaryColumn"] [role="heading"] + div',
      'a[href*="/following"][aria-label]',
      'a[href*="/followers"][aria-label]',
    ],
  },
  scanRoots: [
    'article',
    '[data-testid="tweet"]',
    '[data-testid="reply"]',
    '[data-testid="retweet"]',
    '[data-testid="like"]',
    '[data-testid="bookmark"]',
    '[data-testid="removeBookmark"]',
    X_BOOKMARK_STAT_ROOT_SELECTOR,
    '[data-testid="viewCount"]',
    'a[href*="/analytics"]',
    'time[datetime]',
    X_NEWS_ARTICLE_ROOT_SELECTOR,
    '[data-testid="UserProfileHeader_Items"]',
    '[data-testid="UserName"]',
    '[data-testid="UserName"] + div',
    '[data-testid="User-Name"] + div',
    '[data-testid="primaryColumn"] [role="heading"] + div',
    '[data-testid="User-Name"]',
    '[data-testid="UserDescription"]',
    '[data-testid="HoverCard"]',
    '[data-testid="hoverCard"]',
    '[data-testid="primaryColumn"]',
    'a[href*="/following"]',
    'a[href*="/followers"]',
    'a[href*="/verified_followers"]',
  ],
});
