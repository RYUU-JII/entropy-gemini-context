import { SOCIAL_METRIC_ATTRS } from '../../../core/constants.js';
import {
  removeAttribute,
  setAttribute,
  setTextNode,
} from '../../FastStyleEngine.js';
import {
  normalizeSemanticMetricText,
} from '../core/semanticActionMetricMatcher.js';
import {
  TIKTOK_CINEMA_COMMENT_ROW_SELECTOR,
  TIKTOK_CINEMA_DIALOG_SELECTOR,
  TIKTOK_CINEMA_ACCESSIBLE_ACTION_SELECTOR,
  TIKTOK_FEED_ACCESSIBLE_ACTION_SELECTOR,
  TIKTOK_DIRECT_DETAIL_ACCESSIBLE_ACTION_SELECTOR,
  TIKTOK_DIRECT_DETAIL_COMMENT_PANEL_SELECTOR,
  TIKTOK_DIRECT_DETAIL_COMMENT_HEADER_SELECTOR,
  TIKTOK_DIRECT_DETAIL_REPLY_LABEL_SELECTOR,
  TIKTOK_DIRECT_DETAIL_REPLY_CONTINUATION_SELECTOR,
  TIKTOK_DIRECT_DETAIL_COMMENT_LIKE_SELECTOR,
  TIKTOK_CINEMA_REPLY_LABEL_SELECTOR,
} from './tiktokProfile.js';
import { createMetricCollectionPlan, collectMetricCollectionPlan } from '../core/metricCollectionCursor.js';
import { collapseMutationSourceNodes, collectMutationCausalRoots } from '../core/dirtyRootReducer.js';

const TIKTOK_ARTICLE_ACTION_COUNT_SELECTORS = Object.freeze({
  'like-icon': ':scope > strong[data-e2e="like-count"]',
  'comment-icon': ':scope > strong[data-e2e="comment-count"]',
  'favorite-icon': ':scope > strong[data-e2e="favorite-count"]',
  'share-icon': ':scope > strong[data-e2e="share-count"]',
});
const TIKTOK_DIRECT_DETAIL_ACTION_LABEL_PATTERNS = Object.freeze({
  'like-icon': /^\s*동영상에 좋아요 누르기\s*[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*개의\s*좋아요\s*$/iu,
  'comment-icon': /^\s*댓글 읽기 또는 추가\s*[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*개의\s*댓글\s*$/iu,
  'favorite-icon': /^\s*즐겨찾기에 추가합니다\.\s*[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*명이\s*즐겨찾기에 추가했습니다\s*$/iu,
  'share-icon': /^\s*동영상 공유\s*[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*회\s*공유\s*$/iu,
});

function isTikTokAccessibleMetricTarget(el) {
  if (el.matches(TIKTOK_CINEMA_ACCESSIBLE_ACTION_SELECTOR)) return true;
  if (el.matches(TIKTOK_DIRECT_DETAIL_COMMENT_LIKE_SELECTOR)) {
    const row = el.closest('[class*="--DivCommentItemWrapper"]');
    const count = el.querySelector(':scope > span');
    return !!row.querySelector(TIKTOK_COMMENT_MARKER_SELECTOR)
      && !!el.querySelector(':scope > svg')
      && !!count && count.childElementCount === 0 && TIKTOK_NUMERIC_COUNTER_RE.test(count.textContent);
  }
  if (!el.matches(TIKTOK_FEED_ACCESSIBLE_ACTION_SELECTOR)
    && !el.matches(TIKTOK_DIRECT_DETAIL_ACCESSIBLE_ACTION_SELECTOR)) return false;
  const selector = TIKTOK_ARTICLE_ACTION_COUNT_SELECTORS[el.getAttribute('data-e2e')];
  const count = el.querySelector(selector);
  return !!count && count.childElementCount === 0 && TIKTOK_NUMERIC_COUNTER_RE.test(count.textContent);
}

export function isTikTokAccessibleMetricContainer(el) {
  return isTikTokAccessibleMetricTarget(el)
    && /좋아요 누르기|댓글 읽기 또는 추가|즐겨찾기에 추가합니다|동영상 공유/u.test(el.getAttribute('aria-label') || '');
}

export function projectTikTokAccessibleMetricLabel(el, source, activeMetricKeys) {
  if (!isTikTokAccessibleMetricTarget(el)) return null;
  if (!activeMetricKeys.includes('feedbackCounts')) return { label: source, keys: [] };
  if (el.matches(TIKTOK_DIRECT_DETAIL_ACCESSIBLE_ACTION_SELECTOR)
    && !TIKTOK_DIRECT_DETAIL_ACTION_LABEL_PATTERNS[el.getAttribute('data-e2e')].test(source)) {
    return { label: source, keys: [] };
  }
  if (el.matches(TIKTOK_DIRECT_DETAIL_COMMENT_LIKE_SELECTOR)
    && !TIKTOK_DIRECT_DETAIL_ACTION_LABEL_PATTERNS['like-icon'].test(source)) {
    return { label: source, keys: [] };
  }
  const label = source
    .replace(/\s*[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*개의\s*(?:좋아요|댓글)\s*$/iu, '')
    .replace(/\s*[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*명이\s*즐겨찾기에 추가했습니다\s*$/iu, '')
    .replace(/\s*[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*회\s*공유\s*$/iu, '');
  return { label, keys: label === source ? [] : ['feedbackCounts'] };
}

const TIKTOK_COMMENT_MARKER_SELECTOR = '[data-e2e^="comment-level-"]';
const TIKTOK_COMMENT_ACTION_SELECTOR = '[role="button"][aria-label]';
const TIKTOK_COMMENT_LEAF_SELECTOR = ':is(span, strong, p)';
const TIKTOK_EXPLORE_COUNT_SELECTOR = '[data-e2e="explore-card-like-container"]';
const TIKTOK_PROFILE_LIKES_SELECTOR = '[data-e2e="likes-count"]';
const TIKTOK_PROFILE_VIEW_SELECTOR = '[data-e2e="video-views"]';
const TIKTOK_BROWSER_NICKNAME_SELECTOR = '[data-e2e="browser-nickname"]';
const TIKTOK_POST_ACTION_COUNT_SELECTOR = [
  '[data-e2e="like-count"]',
  '[data-e2e="comment-count"]',
  '[data-e2e="favorite-count"]',
  '[data-e2e="share-count"]',
  '[data-e2e="browse-like-count"]',
  '[data-e2e="browse-comment-count"]',
  '[data-e2e="browse-favorite-count"]',
  '[data-e2e="browse-share-count"]',
].join(',');
const TIKTOK_COMMENT_TAB_SELECTOR = `[class*="--DivTabItem"], ${TIKTOK_CINEMA_COMMENT_ROW_SELECTOR} > span, ${TIKTOK_DIRECT_DETAIL_COMMENT_HEADER_SELECTOR}`;
const TIKTOK_VIEW_MORE_REPLY_SELECTOR = `[data-e2e^="view-more-"], ${TIKTOK_CINEMA_REPLY_LABEL_SELECTOR}, ${TIKTOK_DIRECT_DETAIL_REPLY_LABEL_SELECTOR}, ${TIKTOK_DIRECT_DETAIL_REPLY_CONTINUATION_SELECTOR}`;
const TIKTOK_COMMENT_LIKE_COUNT_SELECTOR = '[data-e2e="comment-like-count"]';
const TIKTOK_MUTATION_OWNER_SELECTOR = [
  '[data-e2e="recommend-list-item-container"]',
  '[data-e2e="user-post-item"]',
  '[data-e2e="explore-item"]',
  TIKTOK_COMMENT_MARKER_SELECTOR,
  TIKTOK_BROWSER_NICKNAME_SELECTOR,
  TIKTOK_POST_ACTION_COUNT_SELECTOR,
  TIKTOK_CINEMA_DIALOG_SELECTOR,
  TIKTOK_FEED_ACCESSIBLE_ACTION_SELECTOR,
  TIKTOK_DIRECT_DETAIL_ACCESSIBLE_ACTION_SELECTOR,
  TIKTOK_DIRECT_DETAIL_COMMENT_PANEL_SELECTOR,
  TIKTOK_DIRECT_DETAIL_COMMENT_LIKE_SELECTOR,
  TIKTOK_CINEMA_COMMENT_ROW_SELECTOR,
  TIKTOK_COMMENT_TAB_SELECTOR,
  TIKTOK_VIEW_MORE_REPLY_SELECTOR,
  TIKTOK_COMMENT_LIKE_COUNT_SELECTOR,
  '[data-e2e="following-count"]',
  '[data-e2e="followers-count"]',
  TIKTOK_PROFILE_LIKES_SELECTOR,
  TIKTOK_PROFILE_VIEW_SELECTOR,
].join(',');
const TIKTOK_NUMERIC_COUNTER_RE =
  /^\s*[\d,.]+(?:\.\d+)?\s*(?:K|M|B|천|만|억)?\s*$/i;
const TIKTOK_COMMENT_TIME_RE =
  /^\s*(?:now|\d+\s*(?:s|m|h|d|w|mo|y)|\d+\s*(?:초|분|시간|일|주|개월|년)\s*전|\d+\s*(?:seconds?|secs?|minutes?|mins?|hours?|days?|weeks?|months?|years?)\s+ago|\d{1,2}-\d{1,2})\s*$/i;
const TIKTOK_COMMENT_LIKE_LABEL_RE =
  /(?:좋아요|likes?|me gusta|j’aime|gefällt|curtidas?|mi piace|いいね)/i;
const TIKTOK_COMMENT_TAB_COUNT_RE =
  /^\s*(?:댓글|comments?)\s*(?:\(\s*[\d,.]+(?:\.\d+)?\s*(?:K|M|B|천|만|억)?\s*\)|[\d,.]+(?:\.\d+)?\s*(?:K|M|B|천|만|억)?\s*개?)\s*$/i;
const TIKTOK_VIEW_MORE_REPLY_COUNT_RE =
  /^\s*(?:[\d,.]+(?:\.\d+)?\s*(?:K|M|B|천|만|억)?\s*개\s*더\s*보기|답글\s*[\d,.]+(?:\.\d+)?\s*(?:K|M|B|천|만|억)?\s*개\s*보기|(?:view\s+)?[\d,.]+(?:\.\d+)?\s*(?:K|M|B)?\s+more\s+repl(?:y|ies))\s*$/i;
const TIKTOK_SEPARATOR_RE = /^\s*[·•]\s*$/;
const TIKTOK_COMMENT_OWNER_DEPTH = 4;
const TIKTOK_METRIC_INFO_BY_ELEMENT = new WeakMap();

function hasActiveFilter(ctx, filterKey) {
  return Array.isArray(ctx?.filterKeys) && ctx.filterKeys.includes(filterKey);
}

function getTrimmedText(element) {
  return normalizeSemanticMetricText(element?.textContent);
}

function getDirectTextNode(element) {
  if (!(element instanceof Element)) return null;
  return Array.from(element.childNodes || []).find((node) => (
    node?.nodeType === 3 && normalizeSemanticMetricText(node.nodeValue)
  )) || null;
}

function getTikTokSourceText(element) {
  if (!(element instanceof Element)) return '';
  const directText = getDirectTextNode(element)?.nodeValue;
  if (element.hasAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT)) {
    const original = element.getAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT);
    const applied = getTikTokReplacementLabel(original, element.getAttribute(SOCIAL_METRIC_ATTRS.TIKTOK_LABEL));
    if (directText === applied) {
      return normalizeSemanticMetricText(original);
    }
  }
  return normalizeSemanticMetricText(directText ?? element.textContent);
}

function rememberTikTokMetricInfo(element, info) {
  if (!(element instanceof Element) || !info) return;
  TIKTOK_METRIC_INFO_BY_ELEMENT.set(element, Object.freeze({ ...info }));
}

function getTikTokReplacementLabel(text, kind) {
  const normalized = normalizeSemanticMetricText(text);
  if (kind === 'comment-tab') {
    return normalized
      .replace(/\s*\(\s*[\d,.]+(?:\.\d+)?\s*(?:K|M|B|천|만|억)?\s*\)\s*$/i, '')
      .replace(/\s*[\d,.]+(?:\.\d+)?\s*(?:K|M|B|천|만|억)?\s*개?\s*$/i, '')
      .trim();
  }
  if (kind === 'view-more-replies') {
    if (/[가-힣]/.test(normalized)) {
      return normalized
        .replace(/^(답글)\s*[\d,.]+(?:\.\d+)?\s*(?:K|M|B|천|만|억)?\s*개\s*(보기)$/i, '$1 $2')
        .replace(/^\s*[\d,.]+(?:\.\d+)?\s*(?:K|M|B|천|만|억)?\s*개\s*/i, '')
        .trim();
    }
    return normalized
      .replace(
        /^(\s*(?:view\s+)?)[\d,.]+(?:\.\d+)?\s*(?:K|M|B)?\s+(more\s+repl(?:y|ies)\s*)$/i,
        '$1$2',
      )
      .trim();
  }
  return '';
}

function rememberTikTokReplacementCandidate(element, kind) {
  const replacementLabel = getTikTokReplacementLabel(getTikTokSourceText(element), kind);
  if (!replacementLabel) return false;
  rememberTikTokMetricInfo(element, {
    key: 'feedbackCounts',
    group: 'engagement',
    kind,
    replacementLabel,
    ownershipSelector: kind === 'comment-tab'
      ? TIKTOK_COMMENT_TAB_SELECTOR : TIKTOK_VIEW_MORE_REPLY_SELECTOR,
  });
  return true;
}

function findTikTokCommentOwner(element) {
  if (!(element instanceof Element)) return null;
  let current = element;
  for (let depth = 0; current instanceof Element && depth <= TIKTOK_COMMENT_OWNER_DEPTH; depth += 1) {
    if (
      current.querySelector?.(`:scope > ${TIKTOK_COMMENT_MARKER_SELECTOR}`)
      || current.matches?.(TIKTOK_COMMENT_MARKER_SELECTOR)
    ) {
      return current.matches?.(TIKTOK_COMMENT_MARKER_SELECTOR)
        ? current.parentElement
        : current;
    }
    current = current.parentElement;
  }
  return null;
}

function resolveTikTokProfileViewOwner(viewCount) {
  if (!(viewCount instanceof Element)) return null;
  const owner = viewCount.parentElement;
  if (!(owner instanceof Element)) return viewCount;
  if (owner.matches?.('button, a, [role="button"], [role="link"]')) return viewCount;
  const directChildren = Array.from(owner.children);
  const ownsOnlyIndicator = directChildren.length <= 3
    && directChildren.includes(viewCount)
    && directChildren.some((child) => child.matches?.('svg'));
  return ownsOnlyIndicator ? owner : viewCount;
}

export function createTikTokSemanticMetricCandidateCollectionPlan(ctx = {}) {
  return createMetricCollectionPlan({
    roots: ctx.roots,
    resolveElement(element) {
      if (ctx.group === 'engagement' && hasActiveFilter(ctx, 'feedbackCounts')) {
        if (element.matches(TIKTOK_EXPLORE_COUNT_SELECTOR + ', ' + TIKTOK_PROFILE_LIKES_SELECTOR)) {
          if (!TIKTOK_NUMERIC_COUNTER_RE.test(getTrimmedText(element))) return [];
          rememberTikTokMetricInfo(element, { key: 'feedbackCounts', group: 'engagement',
            kind: element.matches(TIKTOK_EXPLORE_COUNT_SELECTOR) ? 'explore-count' : 'profile-likes' });
          return [element];
        }
        if (element.matches(TIKTOK_POST_ACTION_COUNT_SELECTOR + ', ' + TIKTOK_COMMENT_LIKE_COUNT_SELECTOR)) {
          if (!TIKTOK_NUMERIC_COUNTER_RE.test(getTrimmedText(element))) return [];
          rememberTikTokMetricInfo(element, { key: 'feedbackCounts', group: 'engagement',
            kind: element.matches(TIKTOK_COMMENT_LIKE_COUNT_SELECTOR) ? 'comment-like-count' : 'post-action-count' });
          return [element];
        }
        if (element.matches(TIKTOK_COMMENT_TAB_SELECTOR)) {
          return TIKTOK_COMMENT_TAB_COUNT_RE.test(getTikTokSourceText(element))
            && rememberTikTokReplacementCandidate(element, 'comment-tab') ? [element] : [];
        }
        if (element.matches(TIKTOK_VIEW_MORE_REPLY_SELECTOR)) {
          return TIKTOK_VIEW_MORE_REPLY_COUNT_RE.test(getTikTokSourceText(element))
            && rememberTikTokReplacementCandidate(element, 'view-more-replies') ? [element] : [];
        }
        if (element.matches(TIKTOK_COMMENT_LEAF_SELECTOR) && element.children.length === 0
          && TIKTOK_NUMERIC_COUNTER_RE.test(getTrimmedText(element))) {
          const button = element.closest(TIKTOK_COMMENT_ACTION_SELECTOR);
          if (button && findTikTokCommentOwner(element)
            && TIKTOK_COMMENT_LIKE_LABEL_RE.test(button.getAttribute('aria-label') || '')) {
            rememberTikTokMetricInfo(element, { key: 'feedbackCounts', group: 'engagement', kind: 'comment-like-count' });
            return [element];
          }
          return [];
        }
      }
      if (ctx.group === 'exposure' && hasActiveFilter(ctx, 'viewCounts') && element.matches(TIKTOK_PROFILE_VIEW_SELECTOR)) {
        if (!TIKTOK_NUMERIC_COUNTER_RE.test(getTrimmedText(element))) return [];
        const target = resolveTikTokProfileViewOwner(element);
        rememberTikTokMetricInfo(target, { key: 'viewCounts', group: 'exposure', kind: 'profile-views', viewCount: element,
          dependencyScope: target });
        return [target];
      }
      if (ctx.group === 'exposure' && hasActiveFilter(ctx, 'timeSignals') && element.children.length === 0
        && TIKTOK_COMMENT_TIME_RE.test(getTrimmedText(element))) {
        const postDate = element.parentElement?.matches(TIKTOK_BROWSER_NICKNAME_SELECTOR);
        if (postDate || (element.matches(TIKTOK_COMMENT_LEAF_SELECTOR) && findTikTokCommentOwner(element))) {
          rememberTikTokMetricInfo(element, { key: 'timeSignals', group: 'exposure', kind: postDate ? 'post-date' : 'comment-time',
            dependencyScope: postDate ? element.parentElement : findTikTokCommentOwner(element) });
          return [element];
        }
        return [];
      }
      return null;
    },
  });
}

export function collectTikTokSemanticMetricCandidates(ctx = {}) {
  return collectMetricCollectionPlan(createTikTokSemanticMetricCandidateCollectionPlan(ctx));
}

export function getTikTokMetricInfo(element) {
  if (!(element instanceof Element)) return null;
  const info = TIKTOK_METRIC_INFO_BY_ELEMENT.get(element);
  if (!info) return null;
  if (info.ownershipSelector) {
    if (!element.matches(info.ownershipSelector)) return null;
    const pattern = info.kind === 'comment-tab'
      ? TIKTOK_COMMENT_TAB_COUNT_RE : TIKTOK_VIEW_MORE_REPLY_COUNT_RE;
    if (!pattern.test(getTikTokSourceText(element))) return null;
  } else if (info.kind === 'explore-count' || info.kind === 'profile-likes') {
    const selector = info.kind === 'explore-count' ? TIKTOK_EXPLORE_COUNT_SELECTOR : TIKTOK_PROFILE_LIKES_SELECTOR;
    if (!element.matches(selector) || !TIKTOK_NUMERIC_COUNTER_RE.test(getTrimmedText(element))) return null;
  } else if (info.kind === 'profile-views') {
    if (!info.viewCount?.isConnected || !info.viewCount.matches(TIKTOK_PROFILE_VIEW_SELECTOR)
      || !TIKTOK_NUMERIC_COUNTER_RE.test(getTrimmedText(info.viewCount))
      || resolveTikTokProfileViewOwner(info.viewCount) !== element) return null;
  } else if (info.kind === 'post-action-count') {
    if (!element.matches(TIKTOK_POST_ACTION_COUNT_SELECTOR)
      || !TIKTOK_NUMERIC_COUNTER_RE.test(getTrimmedText(element))) return null;
  } else if (info.kind === 'comment-like-count') {
    if (!TIKTOK_NUMERIC_COUNTER_RE.test(getTrimmedText(element))) return null;
    if (!element.matches(TIKTOK_COMMENT_LIKE_COUNT_SELECTOR)) {
      const button = element.closest(TIKTOK_COMMENT_ACTION_SELECTOR);
      if (element.children.length !== 0 || !element.matches(TIKTOK_COMMENT_LEAF_SELECTOR)
        || !button || !findTikTokCommentOwner(element)
        || !TIKTOK_COMMENT_LIKE_LABEL_RE.test(button.getAttribute('aria-label') || '')) return null;
      return { ...info, dependencyScope: findTikTokCommentOwner(element) };
    }
  } else if (info.kind === 'post-date') {
    if (element.children.length !== 0 || !element.parentElement?.matches(TIKTOK_BROWSER_NICKNAME_SELECTOR)
      || !TIKTOK_COMMENT_TIME_RE.test(getTrimmedText(element))) return null;
  } else if (info.kind === 'comment-time') {
    if (element.children.length !== 0 || !element.matches(TIKTOK_COMMENT_LEAF_SELECTOR)
      || !findTikTokCommentOwner(element) || !TIKTOK_COMMENT_TIME_RE.test(getTrimmedText(element))) return null;
    return { ...info, dependencyScope: findTikTokCommentOwner(element) };
  }
  return info;
}

export function resolveTikTokMetricTargets(element, info = null) {
  if (!(element instanceof Element) || info?.kind !== 'post-date') return null;
  const targets = [element];
  const separator = element.previousElementSibling;
  if (
    separator instanceof Element
    && TIKTOK_SEPARATOR_RE.test(separator.textContent || '')
  ) {
    targets.unshift(separator);
  }
  return targets;
}

export function collapseTikTokMetricTarget(element) {
  if (!(element instanceof Element)) return false;
  if (element.getAttribute(SOCIAL_METRIC_ATTRS.TIKTOK_COLLAPSE) === '1') return false;
  setAttribute(element, SOCIAL_METRIC_ATTRS.TIKTOK_COLLAPSE, '1');
  return true;
}

export function restoreTikTokMetricTarget(element) {
  if (!(element instanceof Element)) return false;
  return removeAttribute(element, SOCIAL_METRIC_ATTRS.TIKTOK_COLLAPSE);
}

export function isTikTokMetricLabelApplied(element, info = null) {
  if (!(element instanceof Element) || !info?.replacementLabel) return false;
  if (!element.hasAttribute(SOCIAL_METRIC_ATTRS.TIKTOK_LABEL)) return false;
  if (!element.hasAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT)) {
    throw new Error('TIKTOK_SOCIAL_LABEL_ORIGINAL_TEXT_REQUIRED');
  }
  const visibleLabelMatches = getDirectTextNode(element)?.nodeValue === info.replacementLabel;
  if (!visibleLabelMatches) return false;
  if (!element.hasAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_ARIA_LABEL)) return true;
  const originalAriaLabel = element.getAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_ARIA_LABEL);
  return element.getAttribute('aria-label')
    === getTikTokReplacementLabel(originalAriaLabel, info.kind);
}

export function applyTikTokMetricLabel(element, info = null) {
  if (!(element instanceof Element) || !info?.replacementLabel || !info?.kind) return null;
  const textNode = getDirectTextNode(element);
  if (!textNode) {
    throw new Error('TIKTOK_SOCIAL_LABEL_TEXT_NODE_REQUIRED');
  }
  const markerAttr = SOCIAL_METRIC_ATTRS.TIKTOK_LABEL;
  const originalTextAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT;
  const originalAriaAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_ARIA_LABEL;
  if (!element.hasAttribute(markerAttr) && element.hasAttribute(originalTextAttr)) {
    throw new Error('TIKTOK_SOCIAL_LABEL_ORIGINAL_TEXT_OWNERSHIP_CONFLICT');
  }
  if (!element.hasAttribute(originalTextAttr)) {
    setAttribute(element, originalTextAttr, textNode.nodeValue || '');
  } else if (textNode.nodeValue
    !== getTikTokReplacementLabel(element.getAttribute(originalTextAttr), element.getAttribute(markerAttr))) {
    setAttribute(element, originalTextAttr, textNode.nodeValue || '');
  }
  setTextNode(textNode, info.replacementLabel);

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel !== null) {
    const replacementAriaLabel = getTikTokReplacementLabel(ariaLabel, info.kind);
    if (replacementAriaLabel) {
      if (!element.hasAttribute(originalAriaAttr)
        || ariaLabel !== getTikTokReplacementLabel(element.getAttribute(originalAriaAttr), info.kind)) {
        setAttribute(element, originalAriaAttr, ariaLabel);
      }
      setAttribute(element, 'aria-label', replacementAriaLabel);
    }
  }
  setAttribute(element, markerAttr, info.kind);
  return element;
}

export function restoreTikTokMetricLabel(element) {
  if (!(element instanceof Element)) return false;
  const markerAttr = SOCIAL_METRIC_ATTRS.TIKTOK_LABEL;
  const target = element.closest?.(`[${markerAttr}]`) || element;
  if (!(target instanceof Element) || !target.hasAttribute(markerAttr)) return false;

  const originalTextAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT;
  const originalAriaAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_ARIA_LABEL;
  const originalText = target.getAttribute(originalTextAttr);
  if (originalText === null) {
    throw new Error('TIKTOK_SOCIAL_LABEL_ORIGINAL_TEXT_REQUIRED');
  }
  const textNode = getDirectTextNode(target);
  if (!textNode) {
    throw new Error('TIKTOK_SOCIAL_LABEL_RESTORE_TEXT_NODE_REQUIRED');
  }
  const kind = target.getAttribute(markerAttr);
  if (textNode.nodeValue === getTikTokReplacementLabel(originalText, kind)) {
    setTextNode(textNode, originalText);
  }
  if (target.hasAttribute(originalAriaAttr)) {
    const originalAria = target.getAttribute(originalAriaAttr);
    if (target.getAttribute('aria-label') === getTikTokReplacementLabel(originalAria, kind)) {
      setAttribute(target, 'aria-label', originalAria);
    }
    removeAttribute(target, originalAriaAttr);
  }
  removeAttribute(target, originalTextAttr);
  removeAttribute(target, markerAttr);
  return true;
}

export function createTikTokMetricLabelOwner() {
  const records = new Map();

  function hasOwnedArtifacts(target, record) {
    return target.getAttribute(SOCIAL_METRIC_ATTRS.TIKTOK_LABEL) === record.kind
      && target.getAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT) === record.originalText
      && target.getAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_ARIA_LABEL) === record.originalAria;
  }

  function restore(target) {
    const record = records.get(target);
    if (!record) return false;
    // Public markers and saved text cannot grant this instance ownership. A
    // changed artifact envelope belongs to the host or a different instance.
    if (!hasOwnedArtifacts(target, record)) {
      records.delete(target);
      return false;
    }
    if (record.textNode.parentNode === target && record.textNode.nodeValue === record.appliedText) {
      setTextNode(record.textNode, record.originalText);
    }
    if (record.originalAria !== null && target.getAttribute('aria-label') === record.appliedAria) {
      setAttribute(target, 'aria-label', record.originalAria);
    }
    removeAttribute(target, SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT);
    if (record.originalAria !== null) removeAttribute(target, SOCIAL_METRIC_ATTRS.ORIGINAL_ARIA_LABEL);
    removeAttribute(target, SOCIAL_METRIC_ATTRS.TIKTOK_LABEL);
    records.delete(target);
    return true;
  }

  return Object.freeze({
    owns: (target) => records.has(target),
    restore,
    isApplied(target, info) {
      const record = records.get(target);
      return !!record && hasOwnedArtifacts(target, record)
        && getDirectTextNode(target) === record.textNode
        && isTikTokMetricLabelApplied(target, info);
    },
    apply(target, info) {
      if (!(target instanceof Element)) return null;
      const previous = records.get(target);
      if (previous && !hasOwnedArtifacts(target, previous)) {
        records.delete(target);
        return null;
      }
      if (!previous && (target.hasAttribute(SOCIAL_METRIC_ATTRS.TIKTOK_LABEL)
        || target.hasAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT)
        || target.hasAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_ARIA_LABEL))) return null;
      if (previous && getDirectTextNode(target) !== previous.textNode) {
        // A replaced node is native content. Release the old artifacts before
        // reading it; saved counts cannot authorize ownership of this new node.
        const nativeText = getDirectTextNode(target)?.nodeValue || '';
        restore(target);
        const hasNativeCount = info?.kind === 'comment-tab'
          ? TIKTOK_COMMENT_TAB_COUNT_RE.test(nativeText)
          : info?.kind === 'view-more-replies' && TIKTOK_VIEW_MORE_REPLY_COUNT_RE.test(nativeText);
        if (!hasNativeCount) return null;
      }
      const applied = applyTikTokMetricLabel(target, info);
      if (!applied) return null;
      records.set(target, {
        textNode: getDirectTextNode(target),
        kind: target.getAttribute(SOCIAL_METRIC_ATTRS.TIKTOK_LABEL),
        originalText: target.getAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT),
        appliedText: getDirectTextNode(target).nodeValue,
        originalAria: target.getAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_ARIA_LABEL),
        appliedAria: target.getAttribute('aria-label'),
      });
      return applied;
    },
    restoreAll() {
      for (const target of records.keys()) restore(target);
    },
  });
}

export function collectTikTokSemanticMutationRoots(payload = {}) {
  return collapseMutationSourceNodes(collectMutationCausalRoots(payload).map((element) => {
    const directOwner = element.closest(TIKTOK_DIRECT_DETAIL_ACCESSIBLE_ACTION_SELECTOR)
      || element.closest(TIKTOK_DIRECT_DETAIL_COMMENT_LIKE_SELECTOR)
      || findTikTokCommentOwner(element);
    if (directOwner) return directOwner;
    const closest = element.closest(TIKTOK_MUTATION_OWNER_SELECTOR);
    return closest?.matches(TIKTOK_COMMENT_MARKER_SELECTOR) ? closest.parentElement : closest || element;
  }));
}
