import { cloneAndFreezeTargetValue } from '../../../targeting/contracts/targetProfileContracts.js';

const YOUTUBE_VIDEOWALL_VIEW_DATE_SELECTOR =
  '.ytp-modern-videowall-still-view-count-and-date-info';
export const YOUTUBE_SHORTS_ACTION_LABEL_OWNER_SELECTOR = 'label.ytSpecButtonShapeWithLabelHost';
export const YOUTUBE_ACCESSIBLE_ACTION_LABEL_SELECTOR = `:is(like-button-view-model, segmented-like-dislike-button-view-model, ytd-toggle-button-renderer, ytd-comment-action-buttons-renderer, ytd-comment-view-model) :is(button, [role="button"])[aria-label], ${YOUTUBE_SHORTS_ACTION_LABEL_OWNER_SELECTOR} > button[aria-label]`;

export const YOUTUBE_SOCIAL_METRIC_TARGETS = cloneAndFreezeTargetValue({
  metricSelectors: {
    feedbackCounts: [
      '#vote-count-middle',
      '.yt-spec-button-shape-next__button-text-content',
      '.ytSpecButtonShapeNextButtonTextContent',
      'ytd-comments-header-renderer yt-formatted-string.count-text',
      YOUTUBE_ACCESSIBLE_ACTION_LABEL_SELECTOR,
    ],
    viewCounts: [
      'ytm-shorts-lockup-view-model .shortsLockupViewModelHostMetadataSubhead span',
      'ytm-shorts-lockup-view-model-v2 .shortsLockupViewModelHostMetadataSubhead span',
      'ytd-video-view-count-renderer span',
      '#metadata-line span:first-child',
      'ytd-video-meta-block #metadata-line .inline-metadata-item',
      '#view-count',
      '#view-count yt-animated-rolling-number',
      '#info > span',
      '.ytContentMetadataViewModelMetadataText',
      YOUTUBE_VIDEOWALL_VIEW_DATE_SELECTOR,
    ],
    timeSignals: [
      'badge-shape',
      '#info-strings yt-formatted-string',
      'ytd-video-meta-block #metadata-line span',
      '#published-time-text',
      'ytd-comment-renderer #published-time-text',
      '#date-text',
      '#date-text yt-animated-rolling-number',
      '#info > span',
      '.ytContentMetadataViewModelMetadataText',
      YOUTUBE_VIDEOWALL_VIEW_DATE_SELECTOR,
    ],
    audienceCounts: [
      '#owner-sub-count',
      'yt-formatted-string#owner-sub-count[aria-label]',
      '#subscriber-count',
      'yt-formatted-string#owner-sub-count',
    ],
  },
  scanRoots: [
    'badge-shape',
    'ytm-shorts-lockup-view-model-v2',
    'ytm-shorts-lockup-view-model',
    'ytd-watch-metadata',
    'ytd-comments-header-renderer',
    'ytd-comment-thread-renderer',
    'ytd-comment-view-model',
    'ytd-rich-grid-media',
    'ytd-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-playlist-video-renderer',
    'ytd-reel-item-renderer',
    'ytd-reel-video-renderer',
    'like-button-view-model',
    YOUTUBE_SHORTS_ACTION_LABEL_OWNER_SELECTOR,
    '#metadata-line',
    '.ytContentMetadataViewModelMetadataRow',
    '.yt-content-metadata-view-model__metadata-row',
    YOUTUBE_VIDEOWALL_VIEW_DATE_SELECTOR,
  ],
});
