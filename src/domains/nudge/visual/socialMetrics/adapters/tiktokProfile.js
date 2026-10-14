import { cloneAndFreezeTargetValue } from '../../../targeting/contracts/targetProfileContracts.js';
import { SOCIAL_METRIC_ATTRS } from '../../../core/constants.js';

export const TIKTOK_CINEMA_COMMENT_ROW_SELECTOR = '[role="status"][data-testid="cinema-side-panel-comment-count-row"]';
export const TIKTOK_CINEMA_DIALOG_SELECTOR = '[role="dialog"][aria-label="Cinema mode"]';
export const TIKTOK_CINEMA_REPLY_LABEL_SELECTOR = `${TIKTOK_CINEMA_DIALOG_SELECTOR} [class*="DivViewRepliesContainer"] > button > div.TUXButton-content > div.TUXButton-label:not(:has(*))`;
export const TIKTOK_CINEMA_ACCESSIBLE_ACTION_SELECTOR = [
  `${TIKTOK_CINEMA_DIALOG_SELECTOR} [role="button"]:is([data-e2e="like-icon"], [data-e2e="comment-icon"], [data-e2e="favorite-icon"], [data-e2e="share-icon"])[aria-label]`,
  `${TIKTOK_CINEMA_DIALOG_SELECTOR} [role="region"][aria-label="cinema-side-panel-comment-panel"] [role="button"][aria-label]`,
].join(',');
export const TIKTOK_FEED_ACCESSIBLE_ACTION_SELECTOR = [
  'main article div[role="button"][data-e2e="like-icon"][aria-label]:has(> strong[data-e2e="like-count"])',
  'main article div[role="button"][data-e2e="comment-icon"][aria-label]:has(> strong[data-e2e="comment-count"])',
  'main article div[role="button"][data-e2e="favorite-icon"][aria-label]:has(> strong[data-e2e="favorite-count"])',
  'main article div[role="button"][data-e2e="share-icon"][aria-label]:has(> strong[data-e2e="share-count"])',
].join(',');
export const TIKTOK_DIRECT_DETAIL_ACCESSIBLE_ACTION_SELECTOR = [
  '#main-content-video_detail article div[role="button"][data-e2e="like-icon"][aria-label]:has(> strong[data-e2e="like-count"])',
  '#main-content-video_detail article div[role="button"][data-e2e="comment-icon"][aria-label]:has(> strong[data-e2e="comment-count"])',
  '#main-content-video_detail article div[role="button"][data-e2e="favorite-icon"][aria-label]:has(> strong[data-e2e="favorite-count"])',
  '#main-content-video_detail article div[role="button"][data-e2e="share-icon"][aria-label]:has(> strong[data-e2e="share-count"])',
].join(',');
export const TIKTOK_DIRECT_DETAIL_COMMENT_PANEL_SELECTOR = '#main-content-video_detail [class*="--RightPanelContainer"] [class*="--DivCommentMain"]';
export const TIKTOK_DIRECT_DETAIL_COMMENT_LIST_SELECTOR = `${TIKTOK_DIRECT_DETAIL_COMMENT_PANEL_SELECTOR} > [class*="--DivCommentListContainer"]`;
export const TIKTOK_DIRECT_DETAIL_COMMENT_HEADER_SELECTOR = `${TIKTOK_DIRECT_DETAIL_COMMENT_PANEL_SELECTOR} > [class*="--DivCommentCountContainer"] > span:not(:has(*))`;
export const TIKTOK_DIRECT_DETAIL_REPLY_LABEL_SELECTOR = `${TIKTOK_DIRECT_DETAIL_COMMENT_LIST_SELECTOR} [class*="--DivViewRepliesContainer"] > button > div.TUXButton-content > div.TUXButton-label:not(:has(*))`;
export const TIKTOK_DIRECT_DETAIL_REPLY_CONTINUATION_SELECTOR = `${TIKTOK_DIRECT_DETAIL_COMMENT_LIST_SELECTOR} > [class*="--DivCommentObjectWrapper"] > [class*="--DivReplyContainer"] > [class*="--DivViewMoreRepliesWrapper"] > [class*="--DivViewMoreRepliesOptionsContainer"] > [class*="--DivViewRepliesContainer"][data-key-interaction="comment_view_replies"]:has(> svg) > span:not(:has(*))`;
export const TIKTOK_DIRECT_DETAIL_COMMENT_LIKE_SELECTOR = `${TIKTOK_DIRECT_DETAIL_COMMENT_LIST_SELECTOR} > [class*="--DivCommentObjectWrapper"] [class*="--DivCommentItemWrapper"] div[role="button"][data-key-interaction="comment_like"][aria-label]`;
export const TIKTOK_ACCESSIBLE_ACTION_SELECTOR = `${TIKTOK_CINEMA_ACCESSIBLE_ACTION_SELECTOR}, ${TIKTOK_FEED_ACCESSIBLE_ACTION_SELECTOR}, ${TIKTOK_DIRECT_DETAIL_ACCESSIBLE_ACTION_SELECTOR}, ${TIKTOK_DIRECT_DETAIL_COMMENT_LIKE_SELECTOR}`;

export const TIKTOK_SOCIAL_METRIC_TARGETS = cloneAndFreezeTargetValue({
  metricSelectors: {
    feedbackCounts: [
      '[data-e2e="like-count"]',
      '[data-e2e="comment-count"]',
      '[data-e2e="share-count"]',
      '[data-e2e="browse-like-count"]',
      '[data-e2e="browse-comment-count"]',
      '[data-e2e="browse-share-count"]',
      '[data-e2e="browse-favorite-count"]',
      '[data-e2e="comment-like-count"]',
      '[data-e2e^="view-more-"]',
      '[class*="--DivTabItem"]',
      '[data-e2e*="like-count" i]',
      '[data-e2e*="comment-count" i]',
      '[data-e2e*="share-count" i]',
      '[data-e2e*="collect-count" i]',
      '[data-e2e*="favorite-count" i]',
      '[data-e2e="likes-count"]',
      `${TIKTOK_CINEMA_COMMENT_ROW_SELECTOR} > span`,
      TIKTOK_CINEMA_REPLY_LABEL_SELECTOR,
      TIKTOK_DIRECT_DETAIL_COMMENT_HEADER_SELECTOR,
      TIKTOK_DIRECT_DETAIL_REPLY_LABEL_SELECTOR,
      TIKTOK_DIRECT_DETAIL_REPLY_CONTINUATION_SELECTOR,
      `[${SOCIAL_METRIC_ATTRS.TIKTOK_LABEL}]`,
      TIKTOK_ACCESSIBLE_ACTION_SELECTOR,
    ],
    viewCounts: [
      '[data-e2e*="view-count" i]',
      '[data-e2e*="play-count" i]',
    ],
    timeSignals: [
      'time[datetime]',
      '[datetime]',
      '[data-e2e="browser-nickname"] > span:last-child',
    ],
    audienceCounts: [
      '[data-e2e*="followers-count" i]',
      '[data-e2e*="following-count" i]',
      '[data-e2e*="user-followers" i]',
      '[data-e2e*="user-following" i]',
    ],
  },
  scanRoots: [
    '[data-e2e="recommend-list-item-container"]',
    '[data-e2e="user-post-item"]',
    '[data-e2e*="feed-item" i]',
    '[data-e2e*="video-item" i]',
    '[data-e2e*="browse-video" i]',
    '[data-e2e*="video-player" i]',
    '[data-e2e*="recommend-video" i]',
    '[data-e2e="explore-item"]',
    '[data-e2e^="comment-level-"]',
    '[data-e2e="browser-nickname"]',
    '[data-e2e="browse-like-count"]',
    '[data-e2e="like-count"]',
    '[data-e2e="comment-count"]',
    '[data-e2e="favorite-count"]',
    '[data-e2e="share-count"]',
    TIKTOK_CINEMA_DIALOG_SELECTOR,
    TIKTOK_FEED_ACCESSIBLE_ACTION_SELECTOR,
    TIKTOK_DIRECT_DETAIL_ACCESSIBLE_ACTION_SELECTOR,
    TIKTOK_DIRECT_DETAIL_COMMENT_PANEL_SELECTOR,
    TIKTOK_DIRECT_DETAIL_COMMENT_HEADER_SELECTOR,
    TIKTOK_DIRECT_DETAIL_REPLY_LABEL_SELECTOR,
    TIKTOK_DIRECT_DETAIL_REPLY_CONTINUATION_SELECTOR,
    TIKTOK_DIRECT_DETAIL_COMMENT_LIKE_SELECTOR,
    `[${SOCIAL_METRIC_ATTRS.TIKTOK_LABEL}]`,
    TIKTOK_CINEMA_COMMENT_ROW_SELECTOR,
    TIKTOK_CINEMA_REPLY_LABEL_SELECTOR,
    '[data-e2e="browse-comment-count"]',
    '[data-e2e="browse-favorite-count"]',
    '[data-e2e="browse-share-count"]',
    '[data-e2e="comment-like-count"]',
    '[data-e2e^="view-more-"]',
    '[class*="--DivTabItem"]',
    '[data-e2e="following-count"]',
    '[data-e2e="followers-count"]',
    '[data-e2e="likes-count"]',
    '[data-e2e="video-views"]',
    '[data-e2e*="user-page" i]',
    '[data-e2e*="profile" i]',
  ],
});
