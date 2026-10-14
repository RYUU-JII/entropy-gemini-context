import { SOCIAL_METRIC_ATTRS } from '../../../core/constants.js';
import { YOUTUBE_ACCESSIBLE_ACTION_LABEL_SELECTOR } from './youtubeProfile.js';

import { getGenericSocialLabels } from '../../../core/socialLabels.js';
import {
  removeAttribute,
  removeStyleProperty,
  setAttribute,
  setStyleProperty,
  setText,
} from '../../FastStyleEngine.js';
import {
  addUniqueCapped,
  collectMatchingElements,
  collectSemanticActionMutationRoots,
  normalizeSemanticMetricText,
  resolveClosestElementCached,
  resolveSemanticActionMetricCandidate,
  resolveSemanticActionMetricMatchForElement,
  toSemanticElement,
} from '../core/semanticActionMetricMatcher.js';
import {
  collapseMutationSourceNodes,
  collectUniqueMutationSourceNodes,
  collectRemovalMutationTargets,
} from '../core/dirtyRootReducer.js';

export function isYoutubeAccessibleMetricContainer(el) {
  return el.matches(YOUTUBE_ACCESSIBLE_ACTION_LABEL_SELECTOR) && el.childElementCount > 0;
}

export function projectYoutubeAccessibleMetricLabel(el, source, activeMetricKeys) {
  if (!el.matches(YOUTUBE_ACCESSIBLE_ACTION_LABEL_SELECTOR)) return null;
  if (!activeMetricKeys.includes('feedbackCounts')) return { label: source, keys: [] };
  const label = source
    .replace(/\s+along with\s+[\d,.]+(?:\s*(?:K|M|B|thousand|million|billion))?\s+other people\.?/gi, '')
    .replace(/다른 사용자\s*[\d,.]+(?:\s*(?:천|만|억))?\s*명과 함께\s*/g, '')
    .replace(/[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*(likes?|replies|comments?|좋아요|답글|댓글)/gi, '$1')
    .replace(/(좋아요|답글|댓글)\s*[\d,.]+(?:\s*(?:천|만|억))?\s*개?/g, '$1')
    .trim();
  return { label, keys: label === source ? [] : ['feedbackCounts'] };
}

export function isYoutubeThumbnailBadge(el) {
  // Keep discovery independent of positive evidence so reused badges can clear.
  return el instanceof Element && el.localName === 'badge-shape';
}

export function isYoutubeFreshnessBadge(el) {
  if (!isYoutubeThumbnailBadge(el) || el.getAttribute('role') !== 'img') return false;
  const freshnessLabel = /^(?:신규|new)$/i;
  return freshnessLabel.test(normalizeSemanticMetricText(el.getAttribute('aria-label')))
    && freshnessLabel.test(getNormalizedText(el))
    && !!el.closest('ytd-thumbnail, yt-thumbnail-view-model');
}

const YOUTUBE_STRUCTURED_METADATA_ROW_SELECTOR =
  ':is(.yt-content-metadata-view-model__metadata-row, .ytContentMetadataViewModelMetadataRow)';
const YOUTUBE_LEGACY_METADATA_ROW_SELECTOR = '#metadata-line';
const YOUTUBE_WATCH_INFO_ROW_SELECTOR = 'ytd-watch-info-text';
export const YOUTUBE_METADATA_ROW_SELECTOR =
  `:is(${YOUTUBE_LEGACY_METADATA_ROW_SELECTOR}, ${YOUTUBE_STRUCTURED_METADATA_ROW_SELECTOR})`;
const YOUTUBE_METADATA_TEXT_SELECTOR =
  ':is(.yt-content-metadata-view-model__metadata-text, .ytContentMetadataViewModelMetadataText)';
const YOUTUBE_METADATA_INLINE_ITEM_SELECTOR = '.inline-metadata-item';
const YOUTUBE_METADATA_DELIMITER_SELECTOR =
  ':is(.yt-content-metadata-view-model__delimiter, .ytContentMetadataViewModelDelimiter)';
const YOUTUBE_METADATA_LEADING_ICON_SELECTOR =
  ':is(.yt-content-metadata-view-model__leading-icon, .ytContentMetadataViewModelLeadingIcon)';
const YOUTUBE_COMMENT_COUNT_SELECTOR =
  'ytd-comments-header-renderer yt-formatted-string.count-text';
const YOUTUBE_COMMENT_HEADER_SELECTOR =
  'ytd-comments-header-renderer';
const YOUTUBE_COMMENT_TIME_SCOPE_SELECTOR =
  ':is(ytd-comment-view-model, ytd-comment-renderer, ytd-backstage-post-renderer)';
const YOUTUBE_COMMENT_VOTE_COUNT_SELECTOR =
  '#vote-count-middle';
const YOUTUBE_SEMANTIC_WATCH_LINK_SELECTOR =
  'a[href^="/watch"], a[href*="youtube.com/watch"], a[href*="/watch?"]';
const YOUTUBE_SHORTS_CARD_SELECTOR = 'ytm-shorts-lockup-view-model-v2, ytm-shorts-lockup-view-model';
const YOUTUBE_SEMANTIC_CHANNEL_SURFACE_SELECTOR =
  'yt-page-header-view-model, yt-content-metadata-view-model, yt-lockup-view-model, ytd-reel-shelf-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2';
const YOUTUBE_SEMANTIC_COMMUNITY_SURFACE_SELECTOR =
  'ytd-backstage-post-renderer, ytd-comment-action-buttons-renderer, ytd-comment-replies-renderer';
const YOUTUBE_SEMANTIC_PRIMARY_SCAN_SCOPE_SELECTOR =
  `:is(#movie_player, #related, ytd-watch-next-secondary-results-renderer, ytd-watch-metadata, ytd-watch-flexy, ytd-watch-info-text, ytd-comments-header-renderer, ytd-comment-view-model, ytd-comment-renderer, ytd-reel-player-overlay-renderer, ytd-shorts-player-controls, ${YOUTUBE_SEMANTIC_CHANNEL_SURFACE_SELECTOR}, ${YOUTUBE_SEMANTIC_COMMUNITY_SURFACE_SELECTOR})`;
const YOUTUBE_SEMANTIC_SCAN_SCOPE_SELECTOR =
  `:is(#movie_player, #related, ytd-watch-next-secondary-results-renderer, ytd-watch-metadata, ytd-watch-flexy, ytd-watch-info-text, ytd-comments-header-renderer, ytd-comment-view-model, ytd-comment-renderer, ytd-reel-player-overlay-renderer, ytd-shorts-player-controls, like-button-view-model, button-view-model, #top-level-buttons-computed, ${YOUTUBE_SEMANTIC_CHANNEL_SURFACE_SELECTOR}, ${YOUTUBE_SEMANTIC_COMMUNITY_SURFACE_SELECTOR})`;
const YOUTUBE_SEMANTIC_TEXT_SELECTOR =
  ':is(a, span, yt-formatted-string, yt-attributed-string, yt-animated-rolling-number, [role="text"])';
const YOUTUBE_SEMANTIC_ACTION_LABEL_LEAF_SELECTOR =
  ':is(span, yt-formatted-string, yt-attributed-string, [role="text"])';
const YOUTUBE_COMBINED_ACTION_LABEL_TEXT_SELECTOR = [
  YOUTUBE_SEMANTIC_ACTION_LABEL_LEAF_SELECTOR,
  '.ytSpecButtonShapeWithLabelLabel',
  '.yt-spec-button-shape-with-label__label',
  '.ytSpecButtonShapeNextButtonTextContent',
  '.yt-spec-button-shape-next__button-text-content',
].join(', ');
const YOUTUBE_SEMANTIC_ACTION_BUTTON_SELECTOR =
  ':is(button[aria-label], button[title], [role="button"][aria-label], [role="button"][title])';
const YOUTUBE_SEMANTIC_ACTION_ROOT_SELECTOR =
  ':is(like-button-view-model, button-view-model, #top-level-buttons-computed, ytd-reel-player-overlay-renderer, ytd-shorts-player-controls, ytd-comment-action-buttons-renderer, ytd-comment-replies-renderer)';
const YOUTUBE_ACTION_COUNT_CONTAINER_SELECTOR =
  '#vote-count-middle, .yt-spec-button-shape-next__button-text-content, .ytSpecButtonShapeNextButtonTextContent';
const YOUTUBE_SEMANTIC_LIKE_TEXT_SELECTOR =
  `:is(${YOUTUBE_ACTION_COUNT_CONTAINER_SELECTOR}, span, div, yt-formatted-string, yt-attributed-string, yt-animated-rolling-number, [role="text"])`;
const YOUTUBE_SEMANTIC_ACTION_CONTAINER_SELECTOR = ':is(label, like-button-view-model, button-view-model, #top-level-buttons-computed, ytd-reel-player-overlay-renderer, ytd-shorts-player-controls, ytd-comment-action-buttons-renderer, ytd-comment-replies-renderer)';
const YOUTUBE_SEMANTIC_MAX_ROOTS = 24;
const YOUTUBE_SEMANTIC_MAX_LINKS = 48;
const YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES = 160;
const YOUTUBE_SEMANTIC_MAX_LIKE_BUTTONS = 32;
const YOUTUBE_SEMANTIC_MAX_BUTTON_TEXT_CANDIDATES = 48;
const YOUTUBE_SEMANTIC_CURSOR_BATCH_SIZE = 8;
const YOUTUBE_SEMANTIC_MAX_ACTION_ANCESTOR_DEPTH = 5;
const YOUTUBE_SEMANTIC_TEXT_MAX_LENGTH = 96;
const YOUTUBE_ACTION_LABEL_SCORE_THRESHOLD = 110;
const YOUTUBE_ACTION_LABEL_MIN_SCORE_MARGIN = 12;
const YOUTUBE_SEMANTIC_COUNT_TEXT_SOURCE =
  '[\\d,.]+(?:\\.\\d+)?\\s*(?:천|만|억|K|M|B)?';
const YOUTUBE_SEMANTIC_COMPACT_COUNT_TEXT_SOURCE =
  '[\\d,.]+(?:\\.\\d+)?\\s*(?:천|만|억|K|M|B)';
const YOUTUBE_SEMANTIC_TIME_TEXT_SOURCE =
  '(?:\\d+\\s*(?:초|분|시간|일|주|개월|년)\\s*전|\\d+\\s*(?:seconds?|secs?|minutes?|mins?|hours?|days?|weeks?|months?|years?)\\s+ago)';
const YOUTUBE_SEMANTIC_VIEW_TEXT_RE =
  new RegExp(`(?:조회수\\s*${YOUTUBE_SEMANTIC_COUNT_TEXT_SOURCE}|views?\\s*${YOUTUBE_SEMANTIC_COUNT_TEXT_SOURCE}|${YOUTUBE_SEMANTIC_COUNT_TEXT_SOURCE}\\s*(?:회|views?))`, 'i');
const YOUTUBE_SEMANTIC_SUBSCRIBER_TEXT_RE =
  new RegExp(`(?:구독자\\s*${YOUTUBE_SEMANTIC_COUNT_TEXT_SOURCE}\\s*명?|${YOUTUBE_SEMANTIC_COUNT_TEXT_SOURCE}\\s*subscribers?)`, 'i');
const YOUTUBE_SEMANTIC_TIME_TEXT_RE =
  new RegExp(YOUTUBE_SEMANTIC_TIME_TEXT_SOURCE, 'i');
const YOUTUBE_SEMANTIC_STRICT_TIME_TEXT_RE =
  new RegExp(`^\\s*${YOUTUBE_SEMANTIC_TIME_TEXT_SOURCE}\\s*$`, 'i');
const YOUTUBE_SEMANTIC_COMPACT_VIEW_WITH_TIME_TEXT_RE =
  new RegExp(`^\\s*${YOUTUBE_SEMANTIC_COMPACT_COUNT_TEXT_SOURCE}\\s*[·•]\\s*${YOUTUBE_SEMANTIC_TIME_TEXT_SOURCE}\\s*$`, 'i');
const YOUTUBE_SEMANTIC_NUMERIC_TEXT_RE =
  /^\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*$/i;
const YOUTUBE_LIKE_LABEL_RE = /좋아요|like/i;
const YOUTUBE_LIKED_LABEL_RE = /좋아함|liked/i;
const YOUTUBE_NOT_LIKE_LABEL_RE = /싫어요|dislike|not interested|관심 없음/i;
const YOUTUBE_COMMENT_LABEL_RE = /댓글|comments?|comment|답글|repl(?:y|ies)/i;
const YOUTUBE_NON_METRIC_ACTION_LABEL_RE = /공유|share|리믹스|remix|저장|save|구독|subscribe|신고|report/i;
const YOUTUBE_COMMENT_COUNT_TEXT_RE =
  /(?:댓글\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*개?|\bcomments?\s*[\d,.]+(?:\.\d+)?\s*(?:K|M|B)?\b|[\d,.]+(?:\.\d+)?\s*(?:K|M|B)?\s*comments?\b)/i;
const YOUTUBE_REPLY_COUNT_TEXT_RE =
  /(?:답글\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*개?|\brepl(?:y|ies)\s*[\d,.]+(?:\.\d+)?\s*(?:K|M|B)?\b|[\d,.]+(?:\.\d+)?\s*(?:K|M|B)?\s*repl(?:y|ies)\b)/i;
const YOUTUBE_COUNT_LABEL_TEXT_RE =
  new RegExp(`${YOUTUBE_COMMENT_COUNT_TEXT_RE.source}|${YOUTUBE_REPLY_COUNT_TEXT_RE.source}`, 'i');
const YOUTUBE_METADATA_SEPARATOR_TEXT_RE = /^[·•\s]*$/;
const YOUTUBE_METADATA_COLLAPSED_ATTR = 'data-friction-youtube-metadata-collapsed';
const YOUTUBE_METADATA_ORIGINAL_DISPLAY_ATTR = 'data-friction-youtube-metadata-original-display';
const YOUTUBE_METADATA_ORIGINAL_VISIBILITY_ATTR =
  'data-friction-youtube-metadata-original-visibility';
const YOUTUBE_METADATA_COLLAPSED_VISIBILITY_PREFIX = 'visibility:';
const YOUTUBE_METADATA_COLLAPSED_HOST_PRIORITY = 'host-priority';
const YOUTUBE_METADATA_ROW_RELEVANCE_SELECTOR =
  '#metadata-line, .yt-content-metadata-view-model__metadata-row, .ytContentMetadataViewModelMetadataRow';
const YOUTUBE_METADATA_TEXT_RELEVANCE_SELECTOR =
  '.yt-content-metadata-view-model__metadata-text, .ytContentMetadataViewModelMetadataText';
const YOUTUBE_SEMANTIC_LOCAL_MUTATION_CONTEXT_SELECTOR =
  `:is(${YOUTUBE_METADATA_ROW_RELEVANCE_SELECTOR}, ${YOUTUBE_METADATA_TEXT_RELEVANCE_SELECTOR}, .ytp-modern-videowall-still, .ytp-modern-videowall-still-view-count-and-date-info)`;
const YOUTUBE_SEMANTIC_BROAD_MUTATION_SCOPE_SELECTOR =
  ':is(#movie_player, #related, ytd-watch-next-secondary-results-renderer, ytd-watch-flexy)';
const YOUTUBE_ROOT_RELEVANCE_SELECTORS = Object.freeze({
  feedbackCounts:
    `ytd-watch-flexy, ytd-watch-metadata, ytd-comments-header-renderer, ytd-comment-thread-renderer, ytd-comment-view-model, ytd-comment-renderer, like-button-view-model, button-view-model, #top-level-buttons-computed, ytd-reel-player-overlay-renderer, ytd-shorts-player-controls, ytd-comment-action-buttons-renderer, ytd-comment-replies-renderer, ${YOUTUBE_SEMANTIC_ACTION_BUTTON_SELECTOR}`,
  viewCounts:
    `#movie_player, #related, ytd-watch-next-secondary-results-renderer, ytd-watch-metadata, ytd-watch-info-text, #info, #info-container, ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, yt-lockup-view-model, ${YOUTUBE_SHORTS_CARD_SELECTOR}, .shortsLockupViewModelHostMetadataSubhead, ${YOUTUBE_METADATA_ROW_RELEVANCE_SELECTOR}, ${YOUTUBE_METADATA_TEXT_RELEVANCE_SELECTOR}, .ytp-modern-videowall-still, .ytp-modern-videowall-still-view-count-and-date-info, ${YOUTUBE_SEMANTIC_WATCH_LINK_SELECTOR}`,
  timeSignals:
    `badge-shape, #movie_player, #related, ytd-watch-next-secondary-results-renderer, ytd-watch-metadata, ytd-watch-info-text, #info, #info-container, ytd-comment-thread-renderer, ytd-comment-view-model, ytd-comment-renderer, ytd-backstage-post-renderer, ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, yt-lockup-view-model, ${YOUTUBE_METADATA_ROW_RELEVANCE_SELECTOR}, ${YOUTUBE_METADATA_TEXT_RELEVANCE_SELECTOR}, .ytp-modern-videowall-still, .ytp-modern-videowall-still-view-count-and-date-info, ${YOUTUBE_SEMANTIC_WATCH_LINK_SELECTOR}`,
  audienceCounts:
    'ytd-watch-flexy, ytd-watch-metadata, #owner, #owner-sub-count, #subscriber-count, yt-page-header-view-model, yt-content-metadata-view-model',
});

const YOUTUBE_SEMANTIC_ACTION_PROFILE = Object.freeze({
  actionButtonSelector: YOUTUBE_SEMANTIC_ACTION_BUTTON_SELECTOR,
  actionRootSelector: YOUTUBE_SEMANTIC_ACTION_ROOT_SELECTOR,
  actionContainerSelector: YOUTUBE_SEMANTIC_ACTION_CONTAINER_SELECTOR,
  candidateSelector: YOUTUBE_SEMANTIC_LIKE_TEXT_SELECTOR,
  candidateTextPattern: YOUTUBE_SEMANTIC_NUMERIC_TEXT_RE,
  limits: Object.freeze({
    maxRoots: YOUTUBE_SEMANTIC_MAX_ROOTS,
    maxButtons: YOUTUBE_SEMANTIC_MAX_LIKE_BUTTONS,
    maxCandidateTextLength: YOUTUBE_SEMANTIC_TEXT_MAX_LENGTH,
    maxCandidatesPerButton: YOUTUBE_SEMANTIC_MAX_BUTTON_TEXT_CANDIDATES,
    maxAncestorDepth: YOUTUBE_SEMANTIC_MAX_ACTION_ANCESTOR_DEPTH,
    threshold: YOUTUBE_ACTION_LABEL_SCORE_THRESHOLD,
    minScoreMargin: YOUTUBE_ACTION_LABEL_MIN_SCORE_MARGIN,
  }),
  actions: Object.freeze({
    like: Object.freeze({ expectedOrder: 0 }),
    comment: Object.freeze({ expectedOrder: 2, scoreBonus: 4 }),
  }),
  getActionLabelText: (button) => getYoutubeActionLabelText(button),
  getCandidateText: (el) => getYoutubeMetricCandidateText(el),
  resolveActionType: (button, labelText) => resolveYoutubeActionButtonType(button, labelText),
});

function getNormalizedText(el) {
  return String(el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function getYoutubeAccessibleText(el) {
  if (!(el instanceof Element)) return '';
  return normalizeSemanticMetricText(
    el.getAttribute?.('aria-label')
    || el.getAttribute?.('title')
    || el.textContent
  );
}

function getYoutubeMetricCandidateText(el) {
  if (!(el instanceof Element)) return '';
  const originalAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT;
  const source = el.hasAttribute(originalAttr)
    ? el.getAttribute(originalAttr)
    : el.textContent;
  return normalizeSemanticMetricText(source);
}

function matchesSelectorSafely(el, selector) {
  if (!(el instanceof Element) || !selector) return false;
  try {
    return !!el.matches?.(selector) || !!el.querySelector?.(selector);
  } catch (cause) {
    const error = new Error('YOUTUBE_ROOT_RELEVANCE_SELECTOR_FAILED', { cause });
    error.selector = selector;
    throw error;
  }
}

export function isYoutubeSocialMetricRootRelevant(root, group, filterKeys = []) {
  if (!(root instanceof Element)) return true;
  const keys = Array.isArray(filterKeys) ? filterKeys : [];
  if (keys.length === 0) return true;
  return keys.some((key) => {
    const selector = YOUTUBE_ROOT_RELEVANCE_SELECTORS[key];
    if (!selector) return true;
    if (group === 'engagement' && key === 'viewCounts') return false;
    if (group === 'exposure' && (key === 'feedbackCounts' || key === 'audienceCounts')) return false;
    return matchesSelectorSafely(root, selector);
  });
}

function hasActiveFilter(ctx, filterKey) {
  return Array.isArray(ctx?.filterKeys) && ctx.filterKeys.includes(filterKey);
}

function isShortMetricText(el) {
  const text = getNormalizedText(el);
  return text.length > 0 && text.length <= YOUTUBE_SEMANTIC_TEXT_MAX_LENGTH;
}

function hasNearbyYoutubeSemanticViewText(el) {
  if (!(el instanceof Element)) return false;
  const link = el.closest?.(YOUTUBE_SEMANTIC_WATCH_LINK_SELECTOR);
  if (!(link instanceof Element)) return false;
  return collectMatchingElements(link, YOUTUBE_SEMANTIC_TEXT_SELECTOR, 24)
    .some((candidate) => (
      candidate !== el
      && YOUTUBE_SEMANTIC_VIEW_TEXT_RE.test(getNormalizedText(candidate))
    ));
}

function hasNearbyYoutubeViewTextInContainer(el, container) {
  if (!(el instanceof Element) || !(container instanceof Element)) return false;
  return collectMatchingElements(container, YOUTUBE_SEMANTIC_TEXT_SELECTOR, 32)
    .some((candidate) => (
      candidate !== el
      && isYoutubeMetadataViewCandidate(candidate, container)
    ));
}

function hasYoutubeViewAndTimeInContainer(container) {
  if (!(container instanceof Element)) return false;
  const texts = collectMatchingElements(container, YOUTUBE_SEMANTIC_TEXT_SELECTOR, 32);
  return texts.some((candidate) => isYoutubeMetadataViewCandidate(candidate, container))
    && texts.some((candidate) => YOUTUBE_SEMANTIC_TIME_TEXT_RE.test(getYoutubeAccessibleText(candidate)));
}

function getYoutubeActionLabelText(button) {
  if (!(button instanceof Element)) return '';
  const host = button.closest?.('like-button-view-model');
  const label = button.closest?.('label');
  return [
    button.getAttribute?.('aria-label'),
    button.getAttribute?.('title'),
    host?.getAttribute?.('aria-label'),
    host?.getAttribute?.('title'),
    label?.getAttribute?.('aria-label'),
    label?.getAttribute?.('title'),
  ].filter(Boolean).join(' ');
}

function matchesYoutubeSemanticExposureText(el, ctx) {
  if (!(el instanceof Element) || ctx?.group !== 'exposure' || !isShortMetricText(el)) return false;
  const text = getNormalizedText(el);
  if (hasActiveFilter(ctx, 'viewCounts') && YOUTUBE_SEMANTIC_VIEW_TEXT_RE.test(text)) {
    return true;
  }
  if (hasActiveFilter(ctx, 'viewCounts') && YOUTUBE_SEMANTIC_COMPACT_VIEW_WITH_TIME_TEXT_RE.test(text)) {
    return true;
  }
  if (!hasActiveFilter(ctx, 'timeSignals')) return false;
  if (YOUTUBE_SEMANTIC_STRICT_TIME_TEXT_RE.test(text)) {
    return hasNearbyYoutubeSemanticViewText(el);
  }
  return YOUTUBE_SEMANTIC_VIEW_TEXT_RE.test(text) && YOUTUBE_SEMANTIC_TIME_TEXT_RE.test(text);
}

function hasNestedYoutubeSemanticExposureCandidate(el, ctx) {
  if (!(el instanceof Element)) return false;
  return collectMatchingElements(el, YOUTUBE_SEMANTIC_TEXT_SELECTOR, 32)
    .some((candidate) => candidate !== el && matchesYoutubeSemanticExposureText(candidate, ctx));
}

function isPreferredYoutubeSemanticExposureCandidate(el, ctx) {
  return matchesYoutubeSemanticExposureText(el, ctx)
    && !hasNestedYoutubeSemanticExposureCandidate(el, ctx);
}

function resolveYoutubeActionButtonType(button, labelText = getYoutubeActionLabelText(button)) {
  if (!(button instanceof Element)) return null;
  const host = button.closest?.('like-button-view-model');
  const label = labelText;
  if (!label) return host ? 'like' : null;
  if (YOUTUBE_NOT_LIKE_LABEL_RE.test(label)) return null;
  if (YOUTUBE_NON_METRIC_ACTION_LABEL_RE.test(label)) return null;
  if (YOUTUBE_LIKE_LABEL_RE.test(label) || YOUTUBE_LIKED_LABEL_RE.test(label)) return 'like';
  if (YOUTUBE_COMMENT_LABEL_RE.test(label)) return 'comment';
  return null;
}

function collectYoutubeSemanticScopes(roots) {
  if (Array.isArray(roots) && roots.length > 0) {
    return collapseMutationSourceNodes(roots);
  }
  if (typeof document === 'undefined') return [];
  const scopes = Array.from(document.documentElement.querySelectorAll(
    `${YOUTUBE_SEMANTIC_PRIMARY_SCAN_SCOPE_SELECTOR}, ${YOUTUBE_SEMANTIC_SCAN_SCOPE_SELECTOR}`,
  ));
  if (scopes.length > 0) {
    // Retain broad surfaces for metrics outside known child owners. They must
    // not subsume independently scheduled cards, or a per-scope text budget
    // could starve later cards. Nested local wrappers belong to one owner.
    const broad = [];
    const local = [];
    for (const scope of scopes) {
      (scope.matches(YOUTUBE_SEMANTIC_BROAD_MUTATION_SCOPE_SELECTOR) ? broad : local).push(scope);
    }
    return [...broad, ...collapseMutationSourceNodes(local)];
  }

  return document.body instanceof Element ? [document.body] : [];
}

function collectYoutubeSemanticAudienceCandidates(scope, ctx) {
  if (ctx?.group !== 'engagement' || !hasActiveFilter(ctx, 'audienceCounts')) return [];
  const candidates = [];
  collectMatchingElements(scope, YOUTUBE_SEMANTIC_TEXT_SELECTOR, YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES)
    .forEach((candidate) => {
      if (YOUTUBE_SEMANTIC_SUBSCRIBER_TEXT_RE.test(getYoutubeAccessibleText(candidate))) {
        addUniqueCapped(candidates, candidate, YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES);
      }
    });
  return candidates;
}

function getYoutubeMetadataRow(el) {
  if (!(el instanceof Element)) return null;
  const structuredRow = el.closest?.(YOUTUBE_STRUCTURED_METADATA_ROW_SELECTOR);
  if (structuredRow) return structuredRow;
  const legacyRow = el.closest?.(YOUTUBE_LEGACY_METADATA_ROW_SELECTOR);
  if (legacyRow && hasYoutubeViewAndTimeInContainer(legacyRow)) return legacyRow;
  const watchInfoRow = el.closest?.(YOUTUBE_WATCH_INFO_ROW_SELECTOR);
  if (watchInfoRow && hasYoutubeViewAndTimeInContainer(watchInfoRow)) return watchInfoRow;

  let current = el.parentElement;
  for (let depth = 0; current instanceof Element && depth < 5; depth += 1) {
    if (current === document.body || current === document.documentElement) return null;
    if (
      current.getAttribute?.('role') === 'group'
      && hasYoutubeViewAndTimeInContainer(current)
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function getYoutubeLegacyMetadataDirectItems(row) {
  if (!(row instanceof Element) || !row.matches?.(YOUTUBE_LEGACY_METADATA_ROW_SELECTOR)) return [];
  return Array.from(row.children || []).filter((child) => {
    if (!(child instanceof Element)) return false;
    if (child.hasAttribute?.('hidden') || child.getAttribute?.('aria-hidden') === 'true') return false;
    if (!child.matches?.(`${YOUTUBE_METADATA_INLINE_ITEM_SELECTOR}, span, yt-formatted-string, yt-attributed-string, [role="text"]`)) {
      return false;
    }
    const text = getYoutubeAccessibleText(child);
    if (!text) return false;
    if (YOUTUBE_METADATA_SEPARATOR_TEXT_RE.test(text) && !child.querySelector?.('a[href]')) return false;
    if (child.querySelector?.('svg, img, canvas, video')) return false;
    return true;
  });
}

function getYoutubeLegacyMetadataNumericViewCandidate(row) {
  const items = getYoutubeLegacyMetadataDirectItems(row);
  const firstTimeIndex = items.findIndex((item) => (
    YOUTUBE_SEMANTIC_STRICT_TIME_TEXT_RE.test(getYoutubeAccessibleText(item))
  ));
  if (firstTimeIndex <= 0) return null;
  return items.slice(0, firstTimeIndex).find((item) => (
    YOUTUBE_SEMANTIC_NUMERIC_TEXT_RE.test(getYoutubeAccessibleText(item))
  )) || null;
}

function isYoutubeLegacyMetadataNumericViewCandidate(el, row) {
  if (!(el instanceof Element) || !(row instanceof Element)) return false;
  return getYoutubeLegacyMetadataNumericViewCandidate(row) === el;
}

function isYoutubeMetadataViewCandidate(el, row = null) {
  if (YOUTUBE_SEMANTIC_VIEW_TEXT_RE.test(getYoutubeAccessibleText(el))) return true;
  if (YOUTUBE_SEMANTIC_COMPACT_VIEW_WITH_TIME_TEXT_RE.test(getYoutubeAccessibleText(el))) return true;
  const metadataRow = row instanceof Element ? row : el?.closest?.(YOUTUBE_LEGACY_METADATA_ROW_SELECTOR);
  return isYoutubeLegacyMetadataNumericViewCandidate(el, metadataRow);
}

function isYoutubeMetadataTimeCandidate(el, row) {
  return YOUTUBE_SEMANTIC_STRICT_TIME_TEXT_RE.test(getYoutubeAccessibleText(el))
    && hasNearbyYoutubeViewTextInContainer(el, row);
}

function isYoutubeMetadataMetricCandidate(el, row) {
  return isYoutubeMetadataViewCandidate(el) || isYoutubeMetadataTimeCandidate(el, row);
}

function collectYoutubeSemanticMetadataRowCandidates(scope, ctx) {
  if (ctx?.group !== 'exposure') return [];
  const candidates = [];
  const rows = [];
  collectMatchingElements(scope, '[role="group"]', YOUTUBE_SEMANTIC_MAX_ROOTS)
    .forEach((row) => addUniqueCapped(rows, row, YOUTUBE_SEMANTIC_MAX_ROOTS));
  collectMatchingElements(scope, YOUTUBE_METADATA_ROW_SELECTOR, YOUTUBE_SEMANTIC_MAX_ROOTS)
    .forEach((row) => addUniqueCapped(rows, row, YOUTUBE_SEMANTIC_MAX_ROOTS));
  rows
    .forEach((row) => {
      const texts = collectMatchingElements(row, YOUTUBE_SEMANTIC_TEXT_SELECTOR, 32);
      const hasView = texts.some((candidate) => isYoutubeMetadataViewCandidate(candidate, row));
      const hasTime = texts.some((candidate) => YOUTUBE_SEMANTIC_TIME_TEXT_RE.test(getYoutubeAccessibleText(candidate)));
      if (!hasView || !hasTime) return;
      texts.forEach((candidate) => {
        if (hasActiveFilter(ctx, 'viewCounts') && isYoutubeMetadataViewCandidate(candidate, row)) {
          addUniqueCapped(candidates, candidate, YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES);
        }
        if (hasActiveFilter(ctx, 'timeSignals') && isYoutubeMetadataTimeCandidate(candidate, row)) {
          addUniqueCapped(candidates, candidate, YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES);
        }
      });
    });
  return candidates;
}

function collectYoutubeShortsShelfViewCandidates(scope, ctx) {
  if (ctx?.group !== 'exposure' || !hasActiveFilter(ctx, 'viewCounts')) return [];
  const candidates = [];
  collapseMutationSourceNodes(collectMatchingElements(
    scope,
    ':is(ytd-reel-shelf-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2)',
    YOUTUBE_SEMANTIC_MAX_ROOTS
  )).forEach((root) => {
    // Dedicated Shorts owners are structural evidence, including before their
    // endpoint hydrates. Metric text qualification remains independent of href.
    collectMatchingElements(root, YOUTUBE_SEMANTIC_TEXT_SELECTOR, 32)
      .forEach((candidate) => {
        if (YOUTUBE_SEMANTIC_VIEW_TEXT_RE.test(getYoutubeAccessibleText(candidate))) {
          addUniqueCapped(candidates, candidate, YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES);
        }
      });
  });
  return candidates;
}

function collectYoutubeSemanticWatchInfoCandidates(scope, ctx) {
  if (ctx?.group !== 'exposure') return [];
  const candidates = [];
  collectMatchingElements(scope, ':is(ytd-watch-info-text, #info-container, #info)', YOUTUBE_SEMANTIC_MAX_ROOTS)
    .forEach((container) => {
      collectMatchingElements(container, YOUTUBE_SEMANTIC_TEXT_SELECTOR, 48)
        .forEach((candidate) => {
          const text = getYoutubeAccessibleText(candidate);
          const hasNestedViewCandidate = collectMatchingElements(
            candidate,
            YOUTUBE_SEMANTIC_TEXT_SELECTOR,
            16,
          ).some((nested) => (
            nested !== candidate
            && YOUTUBE_SEMANTIC_VIEW_TEXT_RE.test(getYoutubeAccessibleText(nested))
          ));
          if (
            hasActiveFilter(ctx, 'viewCounts')
            && YOUTUBE_SEMANTIC_VIEW_TEXT_RE.test(text)
            && !hasNestedViewCandidate
          ) {
            addUniqueCapped(candidates, candidate, YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES);
          }
          if (
            hasActiveFilter(ctx, 'timeSignals')
            && YOUTUBE_SEMANTIC_STRICT_TIME_TEXT_RE.test(text)
            && hasNearbyYoutubeViewTextInContainer(candidate, container)
          ) {
            addUniqueCapped(candidates, candidate, YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES);
          }
        });
    });
  return candidates;
}

function collectYoutubeSemanticCommentTimeCandidates(scope, ctx) {
  if (ctx?.group !== 'exposure' || !hasActiveFilter(ctx, 'timeSignals')) return [];
  const candidates = [];
  collectMatchingElements(scope, YOUTUBE_COMMENT_TIME_SCOPE_SELECTOR, YOUTUBE_SEMANTIC_MAX_ROOTS)
    .forEach((comment) => {
      collectMatchingElements(comment, '#published-time-text, #published-time-text a', 8)
        .forEach((candidate) => {
          if (YOUTUBE_SEMANTIC_STRICT_TIME_TEXT_RE.test(getYoutubeAccessibleText(candidate))) {
            addUniqueCapped(candidates, candidate, YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES);
          }
        });
    });
  return candidates;
}

function collectYoutubeCommentCountCandidates(scope) {
  const candidates = [];
  collectMatchingElements(scope, YOUTUBE_COMMENT_HEADER_SELECTOR, YOUTUBE_SEMANTIC_MAX_ROOTS)
    .forEach((header) => {
      collectMatchingElements(header, ':is(h2, yt-formatted-string, [role="heading"], span)', 24)
        .forEach((candidate) => {
          if (YOUTUBE_COMMENT_COUNT_TEXT_RE.test(getYoutubeAccessibleText(candidate))) {
            const target = getYoutubeCommentCountTarget(candidate) || candidate;
            addUniqueCapped(candidates, target, YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES);
          }
        });
    });
  return candidates;
}

function collectYoutubeCombinedCountLabelCandidatesForButton(button) {
  const candidates = [];
  const label = getYoutubeActionLabelText(button);
  if (!YOUTUBE_COUNT_LABEL_TEXT_RE.test(label)) return candidates;
  collectYoutubeActionLabelRoots(button).forEach((root) => {
    collectMatchingElements(root, YOUTUBE_COMBINED_ACTION_LABEL_TEXT_SELECTOR, 16)
      .forEach((candidate) => {
        if (!YOUTUBE_COUNT_LABEL_TEXT_RE.test(getYoutubeAccessibleText(candidate))) return;
        const target = resolveYoutubeActionLabelTarget(candidate) || candidate;
        addUniqueCapped(candidates, target, YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES);
      });
  });
  return candidates;
}

function collectYoutubeActionLabelRoots(button) {
  const roots = [];
  addUniqueCapped(roots, button, 4);
  addUniqueCapped(roots, button.closest?.('label'), 4);
  addUniqueCapped(roots, button.closest?.(YOUTUBE_SEMANTIC_ACTION_ROOT_SELECTOR), 4);
  return roots;
}

function createYoutubeSemanticBatchTasks(elements, collectBatch) {
  const tasks = [];
  for (let offset = 0; offset < elements.length; offset += YOUTUBE_SEMANTIC_CURSOR_BATCH_SIZE) {
    const batch = elements.slice(offset, offset + YOUTUBE_SEMANTIC_CURSOR_BATCH_SIZE);
    tasks.push(() => collectBatch(batch));
  }
  return tasks;
}

function createYoutubeSemanticMetricScopeCursor(scope, ctx = {}) {
  const pendingTasks = [];
  const prependTasks = (tasks) => {
    if (Array.isArray(tasks) && tasks.length > 0) pendingTasks.unshift(...tasks);
  };

  const isShortsCard = scope.matches(YOUTUBE_SHORTS_CARD_SELECTOR);
  if (isShortsCard) {
    pendingTasks.push(() => collectYoutubeShortsShelfViewCandidates(scope, ctx));
  } else if (ctx?.group === 'exposure') {
    pendingTasks.push(
      () => {
        const links = collectMatchingElements(
          scope,
          YOUTUBE_SEMANTIC_WATCH_LINK_SELECTOR,
          YOUTUBE_SEMANTIC_MAX_LINKS,
        );
        prependTasks(createYoutubeSemanticBatchTasks(links, (linkBatch) => {
          const textTasks = [];
          linkBatch.forEach((link) => {
            const textCandidates = collectMatchingElements(
              link,
              YOUTUBE_SEMANTIC_TEXT_SELECTOR,
              YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES,
            );
            textTasks.push(...createYoutubeSemanticBatchTasks(textCandidates, (textBatch) => {
              const candidates = [];
              textBatch.forEach((textNode) => {
                if (isPreferredYoutubeSemanticExposureCandidate(textNode, ctx)) {
                  addUniqueCapped(
                    candidates,
                    textNode,
                    YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES,
                  );
                }
              });
              return candidates;
            }));
          });
          prependTasks(textTasks);
          return [];
        }));
        return [];
      },
      () => collectYoutubeShortsShelfViewCandidates(scope, ctx),
      () => collectYoutubeSemanticMetadataRowCandidates(scope, ctx),
      () => collectYoutubeSemanticWatchInfoCandidates(scope, ctx),
      () => collectYoutubeSemanticCommentTimeCandidates(scope, ctx),
    );
  }

  if (!isShortsCard && ctx?.group === 'engagement') {
    if (hasActiveFilter(ctx, 'feedbackCounts')) {
      pendingTasks.push(
        () => {
          const buttons = collectMatchingElements(
            scope,
            YOUTUBE_SEMANTIC_ACTION_BUTTON_SELECTOR,
            YOUTUBE_SEMANTIC_MAX_LIKE_BUTTONS,
          );
          prependTasks(createYoutubeSemanticBatchTasks(buttons, (buttonBatch) => {
            const candidates = [];
            buttonBatch.forEach((button) => {
              const match = resolveSemanticActionMetricCandidate(
                button,
                YOUTUBE_SEMANTIC_ACTION_PROFILE,
              );
              if (match?.target) {
                addUniqueCapped(
                  candidates,
                  match.target,
                  YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES,
                );
              }
            });
            return candidates;
          }));
          return [];
        },
        () => collectYoutubeCommentCountCandidates(scope),
        () => {
          const buttons = collectMatchingElements(
            scope,
            YOUTUBE_SEMANTIC_ACTION_BUTTON_SELECTOR,
            YOUTUBE_SEMANTIC_MAX_LIKE_BUTTONS,
          );
          prependTasks(createYoutubeSemanticBatchTasks(buttons, (buttonBatch) => {
            const candidates = [];
            buttonBatch.forEach((button) => {
              collectYoutubeCombinedCountLabelCandidatesForButton(button)
                .forEach((candidate) => {
                  addUniqueCapped(
                    candidates,
                    candidate,
                    YOUTUBE_SEMANTIC_MAX_TEXT_CANDIDATES,
                  );
                });
            });
            return candidates;
          }));
          return [];
        },
      );
    }
    pendingTasks.push(() => collectYoutubeSemanticAudienceCandidates(scope, ctx));
  }

  return Object.freeze({
    next() {
      if (pendingTasks.length === 0) return { done: true, value: undefined };
      const task = pendingTasks.shift();
      const candidates = task();
      if (!Array.isArray(candidates)) {
        throw new Error('YOUTUBE_SEMANTIC_COLLECTION_CURSOR_TASK_INVALID');
      }
      return { done: false, value: candidates };
    },
  });
}

function drainYoutubeSemanticMetricScopeCursor(cursor, candidates) {
  while (true) {
    const step = cursor.next();
    if (step.done) break;
    step.value.forEach((candidate) => {
      addUniqueCapped(candidates, candidate, Number.MAX_SAFE_INTEGER);
    });
  }
}

export function collectYoutubeSemanticMetricCandidates(ctx = {}) {
  const scopes = collectYoutubeSemanticScopes(ctx.roots);
  if (scopes.length === 0) return [];
  const candidates = [];
  scopes.forEach((scope) => {
    drainYoutubeSemanticMetricScopeCursor(
      createYoutubeSemanticMetricScopeCursor(scope, ctx),
      candidates,
    );
  });
  return candidates;
}

export function createYoutubeSemanticMetricCandidateCollectionPlan(ctx = {}) {
  return Object.freeze({
    // The scan runtime yields between scope/cursor units and cancels superseded
    // work. A lifetime result cap must not permanently discard later cards.
    scopes: Object.freeze([...collectYoutubeSemanticScopes(ctx.roots)]),
    createScopeCursor: (scope) => createYoutubeSemanticMetricScopeCursor(scope, ctx),
  });
}

function collectYoutubeAddedNodeLocalRoots(element, roots, caches) {
  const closestSemanticScope = resolveClosestElementCached(
    element,
    YOUTUBE_SEMANTIC_SCAN_SCOPE_SELECTOR,
    caches.scanScope,
  );
  if (closestSemanticScope) {
    const closestLink = resolveClosestElementCached(
      element,
      YOUTUBE_SEMANTIC_WATCH_LINK_SELECTOR,
      caches.watchLink,
    );
    if (closestLink) addUniqueCapped(roots, closestLink, YOUTUBE_SEMANTIC_MAX_ROOTS);

    const localContext = resolveClosestElementCached(
      element,
      YOUTUBE_SEMANTIC_LOCAL_MUTATION_CONTEXT_SELECTOR,
      caches.localContext,
    );
    if (localContext) {
      addUniqueCapped(roots, localContext, YOUTUBE_SEMANTIC_MAX_ROOTS);
      return true;
    }

    if (
      closestSemanticScope === element
      && element.matches?.(YOUTUBE_SEMANTIC_BROAD_MUTATION_SCOPE_SELECTOR)
    ) {
      return false;
    }

    const root = closestSemanticScope.matches?.(YOUTUBE_SEMANTIC_BROAD_MUTATION_SCOPE_SELECTOR)
      && closestSemanticScope !== element
      ? element
      : closestSemanticScope;
    addUniqueCapped(roots, root, YOUTUBE_SEMANTIC_MAX_ROOTS);
    return true;
  }

  const closestLink = resolveClosestElementCached(
    element,
    YOUTUBE_SEMANTIC_WATCH_LINK_SELECTOR,
    caches.watchLink,
  );
  if (!closestLink) return false;
  addUniqueCapped(roots, closestLink, YOUTUBE_SEMANTIC_MAX_ROOTS);
  return true;
}

function collectYoutubeLocalMutationRoots(element, roots, caches) {
  const closestLink = resolveClosestElementCached(
    element,
    YOUTUBE_SEMANTIC_WATCH_LINK_SELECTOR,
    caches.watchLink,
  );
  if (closestLink) {
    addUniqueCapped(roots, closestLink, YOUTUBE_SEMANTIC_MAX_ROOTS);
    return;
  }

  const localContext = resolveClosestElementCached(
    element,
    YOUTUBE_SEMANTIC_LOCAL_MUTATION_CONTEXT_SELECTOR,
    caches.localContext,
  );
  if (localContext) {
    addUniqueCapped(roots, localContext, YOUTUBE_SEMANTIC_MAX_ROOTS);
    return;
  }

  const closestSemanticScope = resolveClosestElementCached(
    element,
    YOUTUBE_SEMANTIC_SCAN_SCOPE_SELECTOR,
    caches.scanScope,
  );
  if (!closestSemanticScope) return;
  const root = closestSemanticScope.matches?.(YOUTUBE_SEMANTIC_BROAD_MUTATION_SCOPE_SELECTOR)
    && closestSemanticScope !== element
    ? element
    : closestSemanticScope;
  addUniqueCapped(roots, root, YOUTUBE_SEMANTIC_MAX_ROOTS);
}

function collectYoutubeAddedNodeBroadRoots(element, roots) {
  const discoveredRoots = collectMatchingElements(
    element,
    `${YOUTUBE_SEMANTIC_WATCH_LINK_SELECTOR}, ${YOUTUBE_SEMANTIC_SCAN_SCOPE_SELECTOR}`,
    YOUTUBE_SEMANTIC_MAX_ROOTS,
  );
  const nestedRoots = discoveredRoots.filter((root) => root !== element);
  const rootsToAdd = element.matches?.(YOUTUBE_SEMANTIC_BROAD_MUTATION_SCOPE_SELECTOR)
    && nestedRoots.length > 0
    ? nestedRoots
    : discoveredRoots;
  rootsToAdd.forEach((root) => addUniqueCapped(roots, root, YOUTUBE_SEMANTIC_MAX_ROOTS));
}

export function collectYoutubeSemanticMutationRoots(payload = {}) {
  const roots = [];
  const addedNodes = collectUniqueMutationSourceNodes(
    Array.isArray(payload.addedNodes) ? payload.addedNodes : [],
  );
  const localMutationNodes = collectUniqueMutationSourceNodes([
    ...(Array.isArray(payload.attributeTargets) ? payload.attributeTargets : []),
    ...(Array.isArray(payload.textNodes) ? payload.textNodes : []),
    ...collectRemovalMutationTargets(payload),
  ]);
  const broadAddedNodes = [];
  const closestCaches = Object.freeze({
    localContext: new WeakMap(),
    scanScope: new WeakMap(),
    watchLink: new WeakMap(),
  });

  addedNodes.forEach((node) => {
    if (roots.length >= YOUTUBE_SEMANTIC_MAX_ROOTS) return;
    const element = toSemanticElement(node);
    if (!(element instanceof Element) || !element.isConnected) return;
    if (!collectYoutubeAddedNodeLocalRoots(element, roots, closestCaches)) {
      broadAddedNodes.push(element);
    }
  });

  localMutationNodes.forEach((node) => {
    if (roots.length >= YOUTUBE_SEMANTIC_MAX_ROOTS) return;
    const element = toSemanticElement(node);
    if (!(element instanceof Element) || !element.isConnected) return;
    collectYoutubeLocalMutationRoots(element, roots, closestCaches);
  });

  collectSemanticActionMutationRoots(payload, YOUTUBE_SEMANTIC_ACTION_PROFILE)
    .forEach((root) => addUniqueCapped(roots, root, YOUTUBE_SEMANTIC_MAX_ROOTS));

  collapseMutationSourceNodes(broadAddedNodes).forEach((element) => {
    if (roots.length >= YOUTUBE_SEMANTIC_MAX_ROOTS) return;
    collectYoutubeAddedNodeBroadRoots(element, roots);
  });
  return roots;
}

function resolveYoutubeLeadingIconMetric(icon) {
  if (!(icon instanceof Element)) return null;
  let current = icon.nextElementSibling;
  while (current instanceof Element) {
    if (current.matches?.(YOUTUBE_METADATA_TEXT_SELECTOR)) {
      return current;
    }
    if (
      current.matches?.(YOUTUBE_METADATA_DELIMITER_SELECTOR)
      || current.matches?.(YOUTUBE_METADATA_LEADING_ICON_SELECTOR)
    ) {
      return null;
    }
    current = current.nextElementSibling;
  }
  return null;
}

function collectYoutubeMetadataTextItems(row) {
  if (row.matches?.(YOUTUBE_WATCH_INFO_ROW_SELECTOR)) {
    const metricItems = collectMatchingElements(row, YOUTUBE_SEMANTIC_TEXT_SELECTOR, 48)
      .filter((item) => isYoutubeMetadataMetricCandidate(item, row));
    return metricItems.filter((item) => !metricItems.some((nested) => (
      nested !== item && item.contains(nested)
    )));
  }

  const items = [];
  collectMatchingElements(row, YOUTUBE_METADATA_TEXT_SELECTOR, 48)
    .forEach((item) => addUniqueCapped(items, item, 48));
  collectMatchingElements(row, YOUTUBE_SEMANTIC_TEXT_SELECTOR, 48)
    .forEach((item) => {
      if (isYoutubeMetadataMetricCandidate(item, row)) {
        addUniqueCapped(items, item, 48);
      }
    });
  Array.from(row.children || []).forEach((child) => {
    if (!(child instanceof Element)) return;
    if (child.matches?.(`${YOUTUBE_METADATA_DELIMITER_SELECTOR}, ${YOUTUBE_METADATA_LEADING_ICON_SELECTOR}`)) return;
    if (child.getAttribute?.('aria-hidden') === 'true') return;
    if (YOUTUBE_METADATA_SEPARATOR_TEXT_RE.test(getNormalizedText(child)) && !child.querySelector?.('a[href]')) return;
    if (child.querySelector?.('svg, img, canvas, video')) return;
    if (getNormalizedText(child) || child.querySelector?.('a[href]')) {
      addUniqueCapped(items, child, 48);
    }
  });
  return items;
}

function collectYoutubeMetadataDelimiters(row) {
  const delimiters = [];
  collectMatchingElements(row, YOUTUBE_METADATA_DELIMITER_SELECTOR, 24)
    .forEach((delimiter) => addUniqueCapped(delimiters, delimiter, 24));
  Array.from(row.children || []).forEach((child) => {
    if (
      child instanceof Element
      && child.getAttribute?.('aria-hidden') === 'true'
      && YOUTUBE_METADATA_SEPARATOR_TEXT_RE.test(getNormalizedText(child))
      && !child.querySelector?.('svg, img, canvas, video')
    ) {
      addUniqueCapped(delimiters, child, 24);
    }
  });
  return delimiters;
}

function collectYoutubeMetadataLeadingIcons(row) {
  const icons = [];
  collectMatchingElements(row, YOUTUBE_METADATA_LEADING_ICON_SELECTOR, 24)
    .forEach((icon) => addUniqueCapped(icons, icon, 24));
  Array.from(row.children || []).forEach((child) => {
    if (
      child instanceof Element
      && child.getAttribute?.('aria-hidden') === 'true'
      && child.querySelector?.('svg, img, canvas')
      && !getNormalizedText(child)
    ) {
      addUniqueCapped(icons, child, 24);
    }
  });
  return icons;
}

function isYoutubeVisibleMetadataItem(item, helpers) {
  const { isMetricHidden } = helpers || {};
  if (!(item instanceof Element)) return false;
  if (typeof isMetricHidden === 'function' && isMetricHidden(item)) return false;
  return !!getNormalizedText(item) || item.querySelector?.('a[href], yt-formatted-string, [role="text"]');
}

function findNearestVisibleYoutubeMetadataItem(anchor, metrics, direction, helpers) {
  if (!(anchor instanceof Element) || !Array.isArray(metrics)) return null;
  let current = direction < 0 ? anchor.previousElementSibling : anchor.nextElementSibling;
  while (current instanceof Element) {
    const direct = metrics.includes(current) ? current : null;
    const nested = direct ? null : metrics.find((metric) => current.contains(metric));
    const metric = direct || nested;
    if (metric instanceof Element && isYoutubeVisibleMetadataItem(metric, helpers)) {
      return metric;
    }
    current = direction < 0 ? current.previousElementSibling : current.nextElementSibling;
  }
  return null;
}

function setYoutubeMetadataStyleProperty(node, name, value) {
  if (!(node instanceof Element) || !node.style) return false;
  const nextValue = String(value);
  if (
    node.style.getPropertyValue(name) === nextValue
    && !node.style.getPropertyPriority(name)
  ) return false;
  return setStyleProperty(node, name, nextValue);
}

function removeYoutubeMetadataStyleProperty(node, name) {
  if (!(node instanceof Element) || !node.style) return false;
  if (
    !node.style.getPropertyValue(name)
    && !node.style.getPropertyPriority(name)
  ) return false;
  return removeStyleProperty(node, name);
}

function collapseYoutubeMetadataNode(node) {
  if (!(node instanceof Element)) return;
  if (!node.hasAttribute(YOUTUBE_METADATA_COLLAPSED_ATTR)) {
    const originalVisibility = node.style?.getPropertyValue('visibility') || '';
    const visibilityPriority = node.style?.getPropertyPriority('visibility') || '';
    setAttribute(
      node,
      YOUTUBE_METADATA_COLLAPSED_ATTR,
      visibilityPriority
        ? YOUTUBE_METADATA_COLLAPSED_HOST_PRIORITY
        : `${YOUTUBE_METADATA_COLLAPSED_VISIBILITY_PREFIX}${originalVisibility}`,
    );
    setAttribute(node, YOUTUBE_METADATA_ORIGINAL_DISPLAY_ATTR, node.style?.display || '');
  }
  setYoutubeMetadataStyleProperty(node, 'display', 'none');
}

function restoreYoutubeMetadataDisplay(node) {
  if (!(node instanceof Element)) return;
  if (!node.hasAttribute(YOUTUBE_METADATA_COLLAPSED_ATTR)) return;
  const originalDisplay = node.getAttribute(YOUTUBE_METADATA_ORIGINAL_DISPLAY_ATTR);
  if (originalDisplay) {
    setYoutubeMetadataStyleProperty(node, 'display', originalDisplay);
  } else {
    removeYoutubeMetadataStyleProperty(node, 'display');
  }
  removeAttribute(node, YOUTUBE_METADATA_ORIGINAL_DISPLAY_ATTR);
  removeAttribute(node, YOUTUBE_METADATA_COLLAPSED_ATTR);
}

function hideYoutubeMetadataVisibility(node) {
  if (!(node instanceof Element) || !node.style) return;
  if (node.hasAttribute(YOUTUBE_METADATA_COLLAPSED_ATTR)) {
    const collapsedState = node.getAttribute(YOUTUBE_METADATA_COLLAPSED_ATTR) || '';
    if (!collapsedState.startsWith(YOUTUBE_METADATA_COLLAPSED_VISIBILITY_PREFIX)) return;
    setYoutubeMetadataStyleProperty(node, 'visibility', 'hidden');
    return;
  }
  if (!node.hasAttribute(YOUTUBE_METADATA_ORIGINAL_VISIBILITY_ATTR)) {
    const originalVisibility = node.style.getPropertyValue('visibility');
    const originalPriority = node.style.getPropertyPriority('visibility');
    if (originalPriority || originalVisibility === 'hidden') return;
    setAttribute(node, YOUTUBE_METADATA_ORIGINAL_VISIBILITY_ATTR, originalVisibility);
  }
  setYoutubeMetadataStyleProperty(node, 'visibility', 'hidden');
}

function restoreYoutubeMetadataVisibility(node) {
  if (!(node instanceof Element)) return;
  const hasStandaloneOwnership = node.hasAttribute(YOUTUBE_METADATA_ORIGINAL_VISIBILITY_ATTR);
  const collapsedState = node.getAttribute(YOUTUBE_METADATA_COLLAPSED_ATTR) || '';
  const hasCollapsedOwnership = collapsedState.startsWith(
    YOUTUBE_METADATA_COLLAPSED_VISIBILITY_PREFIX,
  );
  if (!hasStandaloneOwnership && !hasCollapsedOwnership) return;
  const originalVisibility = hasStandaloneOwnership
    ? node.getAttribute(YOUTUBE_METADATA_ORIGINAL_VISIBILITY_ATTR)
    : collapsedState.slice(YOUTUBE_METADATA_COLLAPSED_VISIBILITY_PREFIX.length);
  if (originalVisibility) {
    setYoutubeMetadataStyleProperty(node, 'visibility', originalVisibility);
  } else {
    removeYoutubeMetadataStyleProperty(node, 'visibility');
  }
  if (hasStandaloneOwnership) {
    removeAttribute(node, YOUTUBE_METADATA_ORIGINAL_VISIBILITY_ATTR);
  }
}

function restoreYoutubeMetadataNode(node) {
  restoreYoutubeMetadataVisibility(node);
  restoreYoutubeMetadataDisplay(node);
}

function setYoutubeMetadataNodeVisibility(
  node,
  {
    shouldHide = false,
    shouldCollapse = false,
  } = {},
) {
  if (!(node instanceof Element)) return;
  if (shouldCollapse) {
    collapseYoutubeMetadataNode(node);
    hideYoutubeMetadataVisibility(node);
    return;
  }
  if (shouldHide) {
    if (node.hasAttribute(YOUTUBE_METADATA_COLLAPSED_ATTR)) {
      restoreYoutubeMetadataNode(node);
    }
    hideYoutubeMetadataVisibility(node);
    return;
  }
  restoreYoutubeMetadataNode(node);
}

function reconcileYoutubeMetadataNode(node, options, helpers) {
  const disposition = options?.shouldHide === true || options?.shouldCollapse === true
    ? 'apply'
    : 'clear';
  const reconcile = () => setYoutubeMetadataNodeVisibility(node, options);
  if (typeof helpers?.runWithReconciliationDisposition !== 'function') {
    reconcile();
    return;
  }
  helpers.runWithReconciliationDisposition(node, disposition, reconcile);
}

export function syncYoutubeMetadataRow(row, helpers) {
  const {
    isMetricHidden,
  } = helpers || {};
  if (!(row instanceof Element) || typeof isMetricHidden !== 'function') return;

  const metrics = collectYoutubeMetadataTextItems(row);
  if (metrics.length === 0) return;

  let visibleMetricCount = 0;
  metrics.forEach((metric) => {
    if (isYoutubeVisibleMetadataItem(metric, helpers)) {
      visibleMetricCount += 1;
    }
  });

  const shouldCollapseHiddenItems = visibleMetricCount > 0;
  metrics.forEach((metric) => {
    const shouldCollapse = shouldCollapseHiddenItems && isMetricHidden(metric);
    reconcileYoutubeMetadataNode(metric, {
      shouldHide: isMetricHidden(metric),
      shouldCollapse,
    }, helpers);
  });

  const delimiters = collectYoutubeMetadataDelimiters(row);
  const visibleDelimiterPairs = new Set();
  const metricPairIds = new Map(metrics.map((metric, index) => [metric, String(index)]));
  delimiters.forEach((delimiter) => {
    const prevMetric = findNearestVisibleYoutubeMetadataItem(delimiter, metrics, -1, helpers);
    const nextMetric = findNearestVisibleYoutubeMetadataItem(delimiter, metrics, 1, helpers);
    const pairKey = prevMetric instanceof Element && nextMetric instanceof Element
      ? `${metricPairIds.get(prevMetric)}:${metricPairIds.get(nextMetric)}`
      : '';
    const shouldHide = !pairKey || visibleDelimiterPairs.has(pairKey);
    if (shouldHide) {
      reconcileYoutubeMetadataNode(delimiter, {
        shouldHide,
        shouldCollapse: shouldCollapseHiddenItems,
      }, helpers);
    } else {
      visibleDelimiterPairs.add(pairKey);
      reconcileYoutubeMetadataNode(delimiter, {}, helpers);
    }
  });

  const leadingIcons = collectYoutubeMetadataLeadingIcons(row);
  leadingIcons.forEach((icon) => {
    const metric = resolveYoutubeLeadingIconMetric(icon) || findNearestYoutubeMetadataItem(icon, metrics, 1);
    const shouldHide = !(metric instanceof Element) || !isYoutubeVisibleMetadataItem(metric, helpers);
    if (shouldHide) {
      reconcileYoutubeMetadataNode(icon, {
        shouldHide,
        shouldCollapse: shouldCollapseHiddenItems,
      }, helpers);
    } else {
      reconcileYoutubeMetadataNode(icon, {}, helpers);
    }
  });

  reconcileYoutubeMetadataNode(row, {
    shouldHide: visibleMetricCount === 0,
    shouldCollapse: visibleMetricCount === 0,
  }, helpers);
}

export function syncYoutubeMetadataForElement(el, helpers) {
  if (!(el instanceof Element)) return;
  const row = getYoutubeMetadataRow(el);
  if (row) syncYoutubeMetadataRow(row, helpers);
}

export function markYoutubeMetadataDirty(el, ctx) {
  if (!(el instanceof Element) || !ctx?.dirtyMetadataRows) return;
  const row = getYoutubeMetadataRow(el);
  if (row) ctx.dirtyMetadataRows.add(row);
}

export function flushDirtyYoutubeMetadataRows(ctx, helpers) {
  if (!ctx?.dirtyMetadataRows || ctx.dirtyMetadataRows.size === 0) return;
  Array.from(ctx.dirtyMetadataRows).forEach((row) => syncYoutubeMetadataRow(row, helpers));
  ctx.dirtyMetadataRows.clear();
}

export function restoreYoutubeMetadataRows() {
  const ownedSelector = [
    `[${YOUTUBE_METADATA_COLLAPSED_ATTR}]`,
    `[${YOUTUBE_METADATA_ORIGINAL_VISIBILITY_ATTR}]`,
  ].join(', ');
  document.querySelectorAll(ownedSelector).forEach((node) => {
    restoreYoutubeMetadataNode(node);
  });
}

export function isYoutubeCommentCount(el) {
  if (!(el instanceof Element)) return false;
  return !!getYoutubeCommentCountTarget(el);
}

export function getYoutubeActionLabelInfo(el) {
  if (!(el instanceof Element)) return null;
  const combinedLabel = getYoutubeCombinedCountReplacementLabel(el);
  if (combinedLabel) {
    return { type: 'comment', label: combinedLabel };
  }
  const match = resolveSemanticActionMetricMatchForElement(el, YOUTUBE_SEMANTIC_ACTION_PROFILE);
  if (!match?.type || !(match.button instanceof Element)) return null;
  if (match.button.contains(el)) return null;

  const labels = getGenericSocialLabels();
  return {
    type: match.type,
    label: match.type === 'like' ? labels.LIKE : labels.COMMENT,
  };
}

export function shouldCollapseYoutubeFeedbackCount(el) {
  if (!(el instanceof Element)) return false;
  return !!el.closest?.(YOUTUBE_COMMENT_VOTE_COUNT_SELECTOR);
}

export function resolveYoutubeFeedbackCountTarget(el) {
  if (!(el instanceof Element)) return null;
  const container = el.closest?.(YOUTUBE_ACTION_COUNT_CONTAINER_SELECTOR);
  if (!(container instanceof Element)) return null;
  if (!container.contains(el)) return null;
  if (getYoutubeCombinedCountReplacementLabel(container)) return null;

  const button = container.closest?.(YOUTUBE_SEMANTIC_ACTION_BUTTON_SELECTOR);
  if (!(button instanceof Element) || !button.contains(container)) return null;
  if (resolveYoutubeActionButtonType(button) !== 'like') return null;

  return container;
}

export function applyYoutubeCollapsedFeedbackCount(el) {
  if (!(el instanceof Element)) return null;
  const target = el.closest?.(YOUTUBE_COMMENT_VOTE_COUNT_SELECTOR) || el;
  if (!(target instanceof Element)) return null;
  const originalAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT;
  const originalDisplayAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_DISPLAY;
  if (!target.hasAttribute(originalAttr)) {
    setAttribute(target, originalAttr, target.textContent || '');
  }
  if (!target.hasAttribute(originalDisplayAttr)) {
    setAttribute(target, originalDisplayAttr, target.style?.display || '');
  }
  setStyleProperty(target, 'display', 'none');
  setAttribute(target, SOCIAL_METRIC_ATTRS.ACTION_LABEL, '1');
  return target;
}

export function applyYoutubeActionLabel(el, label) {
  if (!(el instanceof Element) || !label) return null;
  const target = resolveYoutubeActionLabelTarget(el);
  if (!(target instanceof Element)) return null;
  const originalAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT;
  if (!target.hasAttribute(originalAttr)) {
    setAttribute(target, originalAttr, target.textContent || '');
  }
  if (
    target.hasAttribute(SOCIAL_METRIC_ATTRS.ACTION_LABEL)
    && getNormalizedText(target) === normalizeSemanticMetricText(label)
  ) {
    return target;
  }
  setText(target, label);
  setAttribute(target, SOCIAL_METRIC_ATTRS.ACTION_LABEL, '1');
  return target;
}

export function isYoutubeActionLabelApplied(el, label) {
  if (!(el instanceof Element) || !label) return false;
  const target = resolveYoutubeActionLabelTarget(el);
  return target instanceof Element
    && target.hasAttribute(SOCIAL_METRIC_ATTRS.ACTION_LABEL)
    && getNormalizedText(target) === normalizeSemanticMetricText(label);
}

export function restoreYoutubeActionLabel(el, helpers) {
  const { restoreOriginalText } = helpers || {};
  if (!(el instanceof Element) || typeof restoreOriginalText !== 'function') return;
  const target = el.closest?.(`[${SOCIAL_METRIC_ATTRS.ACTION_LABEL}]`) || el;
  if (!(target instanceof Element)) return;
  if (!target.hasAttribute(SOCIAL_METRIC_ATTRS.ACTION_LABEL)) return;
  restoreOriginalText(target);
  removeAttribute(target, SOCIAL_METRIC_ATTRS.ACTION_LABEL);
}

export function applyYoutubeCommentLabel(el) {
  if (!(el instanceof Element)) return null;
  const target = getYoutubeCommentCountTarget(el);
  if (!(target instanceof Element)) return null;
  const originalAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT;
  if (!target.hasAttribute(originalAttr)) {
    setAttribute(target, originalAttr, target.textContent || '');
  }
  const commentLabel = getGenericSocialLabels().COMMENT;
  if (
    target.hasAttribute(SOCIAL_METRIC_ATTRS.COMMENT_LABEL)
    && getNormalizedText(target) === normalizeSemanticMetricText(commentLabel)
  ) {
    return target;
  }
  setText(target, commentLabel);
  setAttribute(target, SOCIAL_METRIC_ATTRS.COMMENT_LABEL, '1');
  return target;
}

export function isYoutubeCommentLabelApplied(el) {
  if (!(el instanceof Element)) return false;
  const target = getYoutubeCommentCountTarget(el);
  return target instanceof Element
    && target.hasAttribute(SOCIAL_METRIC_ATTRS.COMMENT_LABEL)
    && getNormalizedText(target) === normalizeSemanticMetricText(getGenericSocialLabels().COMMENT);
}

export function restoreYoutubeCommentLabel(el, helpers) {
  const { restoreOriginalText } = helpers || {};
  if (!(el instanceof Element) || typeof restoreOriginalText !== 'function') return;
  const target = getYoutubeCommentCountTarget(el) || el;
  if (!(target instanceof Element)) return;
  if (!target.hasAttribute(SOCIAL_METRIC_ATTRS.COMMENT_LABEL)) return;
  restoreOriginalText(target);
  removeAttribute(target, SOCIAL_METRIC_ATTRS.COMMENT_LABEL);
}

function findNearestYoutubeMetadataItem(anchor, metrics, direction) {
  if (!(anchor instanceof Element) || !Array.isArray(metrics)) return null;
  let current = direction < 0 ? anchor.previousElementSibling : anchor.nextElementSibling;
  while (current instanceof Element) {
    if (metrics.includes(current)) return current;
    const nested = metrics.find((metric) => current.contains(metric));
    if (nested) return nested;
    current = direction < 0 ? current.previousElementSibling : current.nextElementSibling;
  }
  return null;
}

function getYoutubeCommentCountTarget(el) {
  if (!(el instanceof Element)) return null;
  const classTarget = el.closest?.(YOUTUBE_COMMENT_COUNT_SELECTOR);
  if (classTarget) return classTarget;
  const header = el.closest?.(YOUTUBE_COMMENT_HEADER_SELECTOR);
  if (!(header instanceof Element)) return null;
  let current = el;
  while (current instanceof Element && current !== header) {
    if (YOUTUBE_COMMENT_COUNT_TEXT_RE.test(getYoutubeAccessibleText(current))) return current;
    current = current.parentElement;
  }
  return YOUTUBE_COMMENT_COUNT_TEXT_RE.test(getYoutubeAccessibleText(header)) ? header : null;
}

function getYoutubeCombinedCountReplacementLabel(el) {
  if (!(el instanceof Element)) return '';
  const originalAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT;
  const text = el.hasAttribute(originalAttr)
    ? el.getAttribute(originalAttr)
    : getYoutubeAccessibleText(el);
  if (YOUTUBE_REPLY_COUNT_TEXT_RE.test(text)) {
    return stripYoutubeCountFromLabel(text, '답글', 'Replies');
  }
  if (YOUTUBE_COMMENT_COUNT_TEXT_RE.test(text)) {
    return stripYoutubeCountFromLabel(text, getGenericSocialLabels().COMMENT, getGenericSocialLabels().COMMENT);
  }
  return '';
}

function resolveYoutubeActionLabelTarget(el) {
  if (!(el instanceof Element)) return null;
  if (el.matches?.(YOUTUBE_SEMANTIC_ACTION_LABEL_LEAF_SELECTOR)) return el;
  const leaf = collectMatchingElements(el, YOUTUBE_SEMANTIC_ACTION_LABEL_LEAF_SELECTOR, 12)
    .find((candidate) => candidate !== el && YOUTUBE_COUNT_LABEL_TEXT_RE.test(getYoutubeAccessibleText(candidate)));
  return leaf || el;
}

function stripYoutubeCountFromLabel(text, koreanFallback, englishFallback) {
  const normalized = normalizeSemanticMetricText(text);
  const stripped = normalized
    .replace(/[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*개?/gi, '')
    .replace(/\b[\d,.]+(?:\.\d+)?\s*(?:K|M|B)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/답글/.test(stripped)) return '답글';
  if (/댓글/.test(stripped)) return getGenericSocialLabels().COMMENT;
  if (/\brepl(?:y|ies)\b/i.test(stripped)) return englishFallback;
  if (/\bcomments?\b/i.test(stripped)) return getGenericSocialLabels().COMMENT;
  return /[가-힣]/.test(normalized) ? koreanFallback : englishFallback;
}
