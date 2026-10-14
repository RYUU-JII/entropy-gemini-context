import { cloneAndFreezeTargetValue } from '../../../targeting/contracts/targetProfileContracts.js';
import { SOCIAL_METRIC_ATTRS } from '../../../core/constants.js';

export const FACEBOOK_DETAIL_ACTION_SCOPE_SELECTOR = ':is(button, a, [role="button"], [role="link"]):is([aria-label*="reaction" i], [aria-label*="like" i], [aria-label*="comment" i], [aria-label*="share" i], [aria-label*="좋아요"], [aria-label*="반응"], [aria-label*="공감"], [aria-label*="댓글"], [aria-label*="공유"], [aria-label*="친구들에게 보내"])';
export const FACEBOOK_REACTION_TOOLBAR_SCOPE_SELECTOR = '[role="toolbar"][aria-label="공감한 사람 보기"]';
const FACEBOOK_ARTICLE_REPLY_SCOPE_SELECTOR = '[role="complementary"] [role="article"] + div';
export const FACEBOOK_PHOTO_PANEL_SCOPE_SELECTOR = '[role="main"] + [role="complementary"]';
export const FACEBOOK_PHOTO_COMMENT_THREAD_SCOPE_SELECTOR = `${FACEBOOK_PHOTO_PANEL_SCOPE_SELECTOR} div > h2[dir="auto"] ~ div`;
export const FACEBOOK_COMMENT_REPLY_SCOPE_SELECTOR = `${FACEBOOK_ARTICLE_REPLY_SCOPE_SELECTOR}, ${FACEBOOK_PHOTO_COMMENT_THREAD_SCOPE_SELECTOR}`;
export const FACEBOOK_REPLY_ACTION_LEAF_SELECTOR = '[role="button"] > span > span[dir="auto"]';
export const FACEBOOK_COMMENT_REPLY_LABEL_SELECTOR = `[role="complementary"] ${FACEBOOK_REPLY_ACTION_LEAF_SELECTOR}`;
export const FACEBOOK_REPLY_LABEL_ATTR = SOCIAL_METRIC_ATTRS.FACEBOOK_REPLY_LABEL;
export const FACEBOOK_ACCESSIBLE_REACTION_LABEL_SELECTOR = [
  `${FACEBOOK_REACTION_TOOLBAR_SCOPE_SELECTOR} [role="button"][aria-label]`,
  '[role="article"] [role="button"][aria-label*="공감한 사람 보기"]',
].join(', ');

export const FACEBOOK_SOCIAL_METRIC_TARGETS = cloneAndFreezeTargetValue({
  metricSelectors: {
    feedbackCounts: [
      FACEBOOK_COMMENT_REPLY_LABEL_SELECTOR,
      FACEBOOK_ACCESSIBLE_REACTION_LABEL_SELECTOR,
      `[${FACEBOOK_REPLY_LABEL_ATTR}]`,
      ':is([aria-label*="reaction" i], [aria-label*="like" i], [aria-label*="comment" i], [aria-label*="share" i], [aria-label*="repost" i], [aria-label*="reshare" i], [aria-label*="좋아요"], [aria-label*="반응"], [aria-label*="공감"], [aria-label*="댓글"], [aria-label*="공유"], [aria-label*="리포스트"], [aria-label*="재게시"]) :is(span, strong)',
      'a[href*="/ufi/reaction/profile/browser"] :is(span, strong)',
      'a[href*="comment_id"] :is(span, strong)',
      'a[href*="/shares/"] :is(span, strong)',
      'a[href*="/reposts/"] :is(span, strong)',
      ':is(div, span):has(> [data-ad-rendering-role="share_button"]) + :is(div, span) :is(span, strong, [role="text"])',
    ],
    viewCounts: [
      ':is([aria-label*="view" i], [title*="view" i], [aria-label*="조회"], [aria-label*="재생"], [title*="조회"], [title*="재생"]) :is(span, strong)',
      'a[href*="/videos/"] :is([aria-label*="view" i], [title*="view" i], span, strong)',
    ],
    timeSignals: ['time[datetime]'],
    audienceCounts: [
      ':is([aria-label*="followers" i], [title*="followers" i], [aria-label*="팔로워"], [aria-label*="팔로잉"], [title*="팔로워"], [title*="팔로잉"]) :is(span, strong)',
      'a[href*="/followers"] :is(span, strong)',
      'a[href*="/friends"] :is(span, strong)',
    ],
  },
  scanRoots: [
    FACEBOOK_COMMENT_REPLY_SCOPE_SELECTOR,
    '[role="article"]',
    '[data-pagelet^="FeedUnit_"]',
    '[data-pagelet*="FeedUnit" i]',
    '[aria-posinset][aria-describedby]',
    FACEBOOK_DETAIL_ACTION_SCOPE_SELECTOR,
    FACEBOOK_REACTION_TOOLBAR_SCOPE_SELECTOR,
    `[${FACEBOOK_REPLY_LABEL_ATTR}]`,
    'time[datetime]',
  ],
});
