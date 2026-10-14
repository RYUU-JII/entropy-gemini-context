import { SOCIAL_METRIC_ATTRS } from '../../../core/constants.js';
import { getInstagramSocialLabels } from '../../../core/socialLabels.js';
import {
  removeAttribute,
  removeStyleProperty,
  setAttribute,
  setStyleProperty,
  setText,
  setTextNode,
} from '../../FastStyleEngine.js';
import {
  addUniqueCapped,
  normalizeSemanticMetricText,
} from '../core/semanticActionMetricMatcher.js';
import { isInstagramHost } from './hostUtils.js';
import { collapseMutationSourceNodes, collectMutationCausalRoots } from '../core/dirtyRootReducer.js';
import { createMetricCollectionPlan, collectMetricCollectionPlan } from '../core/metricCollectionCursor.js';
import {
  INSTAGRAM_ADAPTER_TARGETS,
  INSTAGRAM_LABELLED_FEEDBACK_CANDIDATE_SELECTOR,
  INSTAGRAM_STANDALONE_POST_ROOT_SELECTOR,
  INSTAGRAM_SPLIT_FEEDBACK_CANDIDATE_SELECTOR,
} from './instagramProfile.js';
import { getInstagramReplyReplacement, getInstagramSplitLikeLabel, getInstagramSplitLikeStructure } from './instagramFeedbackLabel.js';
import {
  SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES,
} from '../core/selectorDriftRecoveryContract.js';

const INSTAGRAM_FAST_SIGNAL_RE = /좋아요|like|likes|댓글|답글|comment|reply|리포스트|reposts?|팔로워|followers?|팔로잉|팔로우|following|게시물|posts?|조회|views?|\d/i;
const INSTAGRAM_FAST_LONG_TEXT_THRESHOLD = 48;
const INSTAGRAM_ACTION_BUTTON_SELECTOR =
  ':is(button, [role="button"], a[role="button"], a[role="link"], a)';
const INSTAGRAM_ACTION_ROOT_SELECTOR =
  `:is(section, article, section[role="dialog"], div[role="dialog"], ${INSTAGRAM_STANDALONE_POST_ROOT_SELECTOR})`;
const INSTAGRAM_ACTION_CANDIDATE_SELECTOR = ':is(span, strong, div, [role="text"])';
const INSTAGRAM_PRIMARY_SCOPE_SELECTOR =
  `:is(article, header, section[role="dialog"], div[role="dialog"], ${INSTAGRAM_STANDALONE_POST_ROOT_SELECTOR})`;
const INSTAGRAM_POST_LINK_SELECTOR = 'a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]';
const INSTAGRAM_NUMERIC_COUNTER_TEXT = /^\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*$/i;
const INSTAGRAM_LABELLED_FEEDBACK_TEXT = /^\s*(?:(좋아요|댓글|답글|likes?|comments?|replies?)\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:개)?|[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:likes?|comments?|replies?))\s*$/i;
const INSTAGRAM_LABEL_ATTR = 'data-friction-instagram-count-label';
const INSTAGRAM_TIME_SEPARATOR_TEXT_RE = /^[·•]$/;
const INSTAGRAM_LIKE_LABEL_RE = /좋아요|likes?\b/i;
const INSTAGRAM_COMMENT_LABEL_RE = /댓글|comments?|reply/i;
const INSTAGRAM_REPOST_LABEL_RE = /리포스트|reposts?/i;
const INSTAGRAM_SHARE_SAVE_LABEL_RE = /공유|share|저장|save/i;
const INSTAGRAM_POSTS_LABEL_RE = /게시물|\bposts?\b/i;
const INSTAGRAM_FOLLOWER_LABEL_RE = /팔로워|followers?/i;
const INSTAGRAM_FOLLOWING_LABEL_RE = /팔로잉|팔로우|following/i;
const INSTAGRAM_SEMANTIC_MAX_CANDIDATES = 80;
const INSTAGRAM_SEMANTIC_MAX_TEXT_LENGTH = 64;
const instagramSemanticInfoByElement = new WeakMap();
const instagramStabilityScopeByElement = new WeakMap();

function getTrimmedText(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function hasActiveFilter(ctx, filterKey) {
  return Array.isArray(ctx?.filterKeys) && ctx.filterKeys.includes(filterKey);
}

function getInstagramActionLabelText(el) {
  if (!(el instanceof Element)) return '';
  const labels = [
    el.getAttribute?.('aria-label'),
    el.getAttribute?.('title'),
  ];
  const nested = el.querySelector?.(':is(svg[aria-label], svg title, [role="img"][aria-label], [aria-label], [title])');
  if (nested?.tagName === 'TITLE') {
    labels.push(nested.textContent || '');
  } else {
    labels.push(nested?.getAttribute?.('aria-label'));
    labels.push(nested?.getAttribute?.('title'));
  }
  return labels.filter(Boolean).join(' ');
}

function resolveInstagramActionType(_button, labelText = '') {
  const label = normalizeSemanticMetricText(labelText);
  if (!label || INSTAGRAM_SHARE_SAVE_LABEL_RE.test(label)) return null;
  if (INSTAGRAM_LIKE_LABEL_RE.test(label)) return 'like';
  if (INSTAGRAM_COMMENT_LABEL_RE.test(label)) return 'comment';
  if (INSTAGRAM_REPOST_LABEL_RE.test(label)) return 'repost';
  return null;
}

function getInstagramActionRootChild(root, node) {
  if (!(root instanceof Element) || !(node instanceof Element) || !root.contains(node)) return null;
  let current = node;
  while (current?.parentElement instanceof Element && current.parentElement !== root) {
    current = current.parentElement;
  }
  return current?.parentElement === root ? current : null;
}

function isInstagramSemanticNumericText(el) {
  return el instanceof Element
    && !hasInstagramIcon(el)
    && !el.closest?.('[hidden], [aria-hidden="true"]')
    && el.style?.display !== 'none'
    && el.style?.visibility !== 'hidden'
    && INSTAGRAM_NUMERIC_COUNTER_TEXT.test(getTrimmedText(el));
}

function findInstagramActionCountCandidate(button, root) {
  if (!(button instanceof Element) || !(root instanceof Element)) return null;
  const candidates = new Set(getInstagramLeafNumericTargets(button, 4));
  let container = button.parentElement;
  let depth = 0;
  while (
    container instanceof Element
    && root.contains(container)
    && container !== document.body
    && container !== document.documentElement
    && depth < 8
  ) {
    const buttonChild = getInstagramActionRootChild(container, button);
    if (buttonChild instanceof Element) {
      let current = buttonChild.nextElementSibling;
      while (current instanceof Element) {
        if (current.querySelector?.(INSTAGRAM_ACTION_BUTTON_SELECTOR)) break;
        if (current.matches?.(INSTAGRAM_ACTION_BUTTON_SELECTOR) && getInstagramActionLabelText(current)) break;

        if (isInstagramSemanticNumericText(current)) candidates.add(current);
        getInstagramLeafNumericTargets(current, 4).forEach((candidate) => {
          candidates.add(candidate);
        });

        current = current.nextElementSibling;
      }
    }
    if (container === root) break;
    container = container.parentElement;
    depth += 1;
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

function getInstagramLabelForActionType(actionType, labels) {
  if (actionType === 'like') return labels.LIKE;
  if (actionType === 'comment') return labels.COMMENT;
  if (actionType === 'repost') return labels.REPOST;
  return '';
}

function getInstagramProfileStatTypeFromText(text = '') {
  if (INSTAGRAM_POSTS_LABEL_RE.test(text)) return 'posts';
  if (INSTAGRAM_FOLLOWER_LABEL_RE.test(text)) return 'follower';
  if (INSTAGRAM_FOLLOWING_LABEL_RE.test(text)) return 'following';
  return null;
}

function getInstagramProfileStatLabelForType(type, labels) {
  if (type === 'posts') return labels.POSTS;
  if (type === 'follower') return labels.FOLLOWER;
  if (type === 'following') return labels.FOLLOWING;
  return '';
}

function countInstagramProfileStatKinds(text = '') {
  const kinds = new Set();
  if (INSTAGRAM_POSTS_LABEL_RE.test(text)) kinds.add('posts');
  if (INSTAGRAM_FOLLOWER_LABEL_RE.test(text)) kinds.add('follower');
  if (INSTAGRAM_FOLLOWING_LABEL_RE.test(text)) kinds.add('following');
  return kinds.size;
}

function findInstagramProfileStatsCluster(el) {
  let current = el instanceof Element ? el : null;
  for (let depth = 0; current && depth < 7; depth += 1) {
    const text = getTrimmedText(current);
    if (countInstagramProfileStatKinds(text) >= 2) return current;
    current = current.parentElement;
  }
  return null;
}

function resolveInstagramProfileStatInfo(el, labels) {
  if (!(el instanceof Element)) return null;
  if (!INSTAGRAM_NUMERIC_COUNTER_TEXT.test(getTrimmedText(el))) return null;
  const cluster = findInstagramProfileStatsCluster(el);
  if (!cluster) return null;

  let current = el;
  for (let depth = 0; current && depth < 5 && cluster.contains(current); depth += 1) {
    const type = getInstagramProfileStatTypeFromText(getTrimmedText(current));
    const label = getInstagramProfileStatLabelForType(type, labels);
    if (label) {
      return { key: 'audienceCounts', group: 'engagement', label };
    }
    current = current.parentElement;
  }
  return null;
}

function getInstagramGridOverlayInfoForItem(item, labels) {
  if (!(item instanceof Element) || item.tagName !== 'LI') return null;
  const postLink = item.closest?.(INSTAGRAM_POST_LINK_SELECTOR);
  if (!postLink) return null;
  const siblings = Array.from(item.parentElement?.children || [])
    .filter((child) => child instanceof Element && child.tagName === 'LI');
  const index = siblings.indexOf(item);
  if (index < 0 || index > 1) return null;
  return {
    key: 'feedbackCounts',
    group: 'engagement',
    label: index === 0 ? labels.LIKE : labels.COMMENT,
  };
}

function getInstagramLeafNumericTargets(root, limit = INSTAGRAM_SEMANTIC_MAX_CANDIDATES) {
  if (!(root instanceof Element)) return [];
  const candidates = [];
  if (root.matches(INSTAGRAM_ACTION_CANDIDATE_SELECTOR) && isInstagramLeafNumericTarget(root)) candidates.push(root);
  for (const candidate of root.querySelectorAll(INSTAGRAM_ACTION_CANDIDATE_SELECTOR)) {
    if (isInstagramLeafNumericTarget(candidate)) addUniqueCapped(candidates, candidate, limit);
    if (candidates.length >= limit) break;
  }
  return candidates;
}

function isInstagramLeafNumericTarget(candidate) {
  if (!isInstagramSemanticNumericText(candidate)) return false;
  return !Array.from(candidate.querySelectorAll(INSTAGRAM_ACTION_CANDIDATE_SELECTOR))
    .some((node) => isInstagramSemanticNumericText(node));
}

function resolveInstagramSemanticCollectionFlags(ctx = {}) {
  const collectFeedbackCounts = ctx?.group === 'engagement'
    && hasActiveFilter(ctx, 'feedbackCounts');
  const collectAudienceCounts = ctx?.group === 'engagement'
    && hasActiveFilter(ctx, 'audienceCounts');
  return Object.freeze({ collectFeedbackCounts, collectAudienceCounts });
}

export function createInstagramSemanticMetricCandidateCollectionPlan(ctx = {}) {
  const flags = resolveInstagramSemanticCollectionFlags(ctx);
  const labels = getInstagramSocialLabels();
  return createMetricCollectionPlan({
    roots: !flags.collectFeedbackCounts && !flags.collectAudienceCounts ? [] : ctx.roots,
    resolveElement(element) {
      if (flags.collectFeedbackCounts && element.matches(INSTAGRAM_ACTION_BUTTON_SELECTOR)) {
        const actionType = resolveInstagramActionType(element, getInstagramActionLabelText(element));
        const label = getInstagramLabelForActionType(actionType, labels);
        if (label) {
          const root = element.closest(INSTAGRAM_ACTION_ROOT_SELECTOR);
          const target = findInstagramActionCountCandidate(element, root);
          if (!target) return [];
          const surface = root.closest(':is(section[role="dialog"], div[role="dialog"])')
            ? SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_DIALOG
            : /^\/(?:reel|reels)\//u.test(globalThis.location?.pathname || '')
              ? SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_REEL_ACTION
              : SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_FEED_ACTION;
          rememberInstagramSemanticInfo(target, { key: 'feedbackCounts', group: 'engagement', label, surface, button: element });
          return [target];
        }
      }
      if (flags.collectFeedbackCounts && element.matches(INSTAGRAM_SPLIT_FEEDBACK_CANDIDATE_SELECTOR)
        && (getInstagramSplitLikeLabel(element) || element.hasAttribute(INSTAGRAM_LABEL_ATTR))) return [element];
      if (flags.collectFeedbackCounts && element.matches(INSTAGRAM_LABELLED_FEEDBACK_CANDIDATE_SELECTOR + ', [' + INSTAGRAM_LABEL_ATTR + ']')) {
        if (INSTAGRAM_LABELLED_FEEDBACK_TEXT.test(element.textContent)
          || getInstagramReplyReplacement(element.textContent)
          || element.hasAttribute(INSTAGRAM_LABEL_ATTR)) return [element];
      }
      if (!isInstagramSemanticNumericText(element)) return null;
      if (flags.collectAudienceCounts) {
        const info = resolveInstagramProfileStatInfo(element, labels);
        if (info) {
          rememberInstagramSemanticInfo(element, { ...info, surface: SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_PROFILE_STATS });
          return [element];
        }
      }
      if (flags.collectFeedbackCounts) {
        const info = getInstagramGridOverlayInfoForItem(element.closest('li'), labels);
        if (info && isInstagramLeafNumericTarget(element)) {
          rememberInstagramSemanticInfo(element, { ...info, surface: SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_GRID_OVERLAY });
          return [element];
        }
      }
      return [];
    },
  });
}

export function collectInstagramSemanticMetricCandidates(ctx = {}) {
  return collectMetricCollectionPlan(createInstagramSemanticMetricCandidateCollectionPlan(ctx));
}

export function collectInstagramSemanticMutationRoots(payload = {}) {
  return collapseMutationSourceNodes(collectMutationCausalRoots(payload).map((element) => (
    element.closest(INSTAGRAM_PRIMARY_SCOPE_SELECTOR + ', ' + INSTAGRAM_ACTION_ROOT_SELECTOR + ', ' + INSTAGRAM_POST_LINK_SELECTOR) || element
  )));
}

function getInstagramCandidateStabilityScope(el) {
  if (!(el instanceof Element) || !el.isConnected) return null;
  const cached = instagramStabilityScopeByElement.get(el);
  if (cached instanceof Element && cached.isConnected && cached.contains(el)) return cached;

  const scope = el.closest?.([
    INSTAGRAM_POST_LINK_SELECTOR,
    'section',
    'header',
    'article',
    'section[role="dialog"]',
    'div[role="dialog"]',
  ].join(',')) || el;
  instagramStabilityScopeByElement.set(el, scope);
  return scope;
}

export function shouldReuseStableInstagramCandidate(el, ctx = {}) {
  if (!(el instanceof Element) || ctx?.scanSource !== 'mutation') return false;
  const attr = String(ctx?.attr || '');
  if (!attr || el.getAttribute(attr) !== '1') return false;
  if (el.tagName === 'TIME' || el.closest?.('time[datetime]')) return false;
  if (el.getAttribute(SOCIAL_METRIC_ATTRS.INSTAGRAM_COLLAPSE) !== '1') return false;

  const causalRoots = Array.isArray(ctx?.causalRoots)
    ? ctx.causalRoots.filter((root) => root instanceof Element && root.isConnected)
    : [];
  if (causalRoots.length === 0) return false;
  const stabilityScope = getInstagramCandidateStabilityScope(el);
  if (!(stabilityScope instanceof Element)) return false;
  return causalRoots.every((root) => (
    root !== stabilityScope
    && !root.contains(stabilityScope)
    && !stabilityScope.contains(root)
  ));
}

function rememberInstagramSemanticInfo(el, info) {
  if (!(el instanceof Element) || !info) return;
  instagramSemanticInfoByElement.set(el, info);
}

function getRememberedInstagramSemanticInfo(el) {
  return el instanceof Element ? instagramSemanticInfoByElement.get(el) || null : null;
}

function revalidateInstagramSemanticInfo(el, previous, labels) {
  if (!el.isConnected || !isInstagramSemanticNumericText(el)) return null;
  if (previous.surface === SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_PROFILE_STATS) {
    const info = resolveInstagramProfileStatInfo(el, labels);
    return info ? { ...info, surface: previous.surface } : null;
  }
  if (previous.surface === SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_GRID_OVERLAY) {
    const item = el.closest('li');
    const info = getInstagramGridOverlayInfoForItem(item, labels);
    return info && isInstagramLeafNumericTarget(el)
      ? { ...info, surface: previous.surface } : null;
  }

  const button = previous.button;
  const root = button?.closest?.(INSTAGRAM_ACTION_ROOT_SELECTOR);
  if (!(button instanceof Element) || !button.isConnected || !root?.contains(el)) return null;
  const actionType = resolveInstagramActionType(button, getInstagramActionLabelText(button));
  const label = getInstagramLabelForActionType(actionType, labels);
  if (!label || findInstagramActionCountCandidate(button, root) !== el) return null;
  const surface = root.closest(':is(section[role="dialog"], div[role="dialog"])')
    ? SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_DIALOG
    : /^\/(?:reel|reels)\//u.test(globalThis.location?.pathname || '')
      ? SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_REEL_ACTION
      : SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.INSTAGRAM_FEED_ACTION;
  return { key: 'feedbackCounts', group: 'engagement', label, surface, button };
}

function readInstagramFastSignalText(el) {
  if (!(el instanceof Element)) return '';
  const originalAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT;
  return String(el.getAttribute(originalAttr) || el.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shouldFastRejectInstagramCandidate(hostname, el, precomputedText = '') {
  if (!isInstagramHost(hostname) || !(el instanceof Element)) return false;
  if (el.tagName === 'TIME') return false;

  const fastText = String(precomputedText || readInstagramFastSignalText(el)).trim();
  if (!fastText) return true;
  if (INSTAGRAM_FAST_SIGNAL_RE.test(fastText)) return false;

  const directAttrs = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.trim();
  if (INSTAGRAM_FAST_SIGNAL_RE.test(directAttrs)) return false;

  const insta = INSTAGRAM_ADAPTER_TARGETS;
  if (el.closest(insta.time)) return false;

  const interactive = el.closest(insta.buttonOrLink);
  if (interactive) {
    const interactiveAttrs =
      `${interactive.getAttribute('aria-label') || ''} ${interactive.getAttribute('title') || ''}`.trim();
    if (INSTAGRAM_FAST_SIGNAL_RE.test(interactiveAttrs)) return false;
  }

  return fastText.length > INSTAGRAM_FAST_LONG_TEXT_THRESHOLD || !INSTAGRAM_FAST_SIGNAL_RE.test(fastText);
}

function isInstagramPostCount(hostname, el) {
  if (!(el instanceof Element)) return false;
  let current = el;
  for (let i = 0; current && i < 4; i += 1) {
    const text = (current.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (text.includes('게시물') || text.includes('posts')) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

function isInstagramGridOverlayMetric(hostname, el) {
  if (!(el instanceof Element)) return false;
  const insta = INSTAGRAM_ADAPTER_TARGETS;
  const link = el.closest(insta.postLink);
  if (!link) return false;
  if (!link.querySelector || !link.querySelector(insta.gridMedia)) return false;
  const hasOverlayIcon = link.querySelector(insta.gridOverlayIcons);
  if (!hasOverlayIcon) return false;
  return true;
}

function getInstagramContextHints(hostname, el) {
  const parts = [];
  const insta = INSTAGRAM_ADAPTER_TARGETS;

  const pushAttr = (node, attr) => {
    if (!node || !node.getAttribute) return;
    const value = node.getAttribute(attr);
    if (value) parts.push(value);
  };

  pushAttr(el, 'aria-label');
  pushAttr(el, 'title');

  const interactive = el && el.closest ? el.closest(insta.buttonOrLink) : null;
  if (interactive) {
    pushAttr(interactive, 'aria-label');
    pushAttr(interactive, 'title');
    const icon = interactive.querySelector && interactive.querySelector(insta.deepLabel);
    if (icon) pushAttr(icon, 'aria-label');
  }

  const parent = el && el.parentElement ? el.parentElement : null;
  if (parent) {
    pushAttr(parent, 'aria-label');
    pushAttr(parent, 'title');
  }

  return parts.join(' ').toLowerCase();
}

function getInstagramButtonLabel(hostname, el) {
  const insta = INSTAGRAM_ADAPTER_TARGETS;
  const button = el && el.closest ? el.closest(insta.buttonOrLink) : null;
  if (!button) return '';

  const isRelevantLabel = (label) => /(좋아요|댓글|comment|reply|like|리포스트|repost)/i.test(label);

  const readLabel = (node) => {
    if (!node || !node.getAttribute) return '';
    const aria = node.getAttribute('aria-label');
    if (aria) return String(aria).toLowerCase();
    const title = node.getAttribute('title');
    if (title) return String(title).toLowerCase();
    const icon = node.querySelector ? node.querySelector(insta.deepLabel) : null;
    if (icon) {
      const iconLabel = icon.getAttribute('aria-label');
      if (iconLabel) return String(iconLabel).toLowerCase();
    }
    return '';
  };

  const readLabelDeep = (node) => {
    const direct = readLabel(node);
    if (direct) return direct;
    if (!node || !node.querySelector) return '';
    const nested = node.querySelector(insta.deepLabelScan);
    if (!nested) return '';
    return readLabel(nested);
  };

  const scanSiblingChain = (node) => {
    const directions = ['previousElementSibling', 'nextElementSibling'];
    let fallback = '';
    for (const direction of directions) {
      let sibling = node ? node[direction] : null;
      let steps = 0;
      while (sibling && steps < 6) {
        const label = readLabelDeep(sibling);
        if (label) {
          if (isRelevantLabel(label)) return label;
          if (!fallback) fallback = label;
        }
        sibling = sibling[direction];
        steps += 1;
      }
    }
    return fallback;
  };

  const direct = readLabelDeep(button);
  if (direct && isRelevantLabel(direct)) return direct;
  let fallback = direct;

  const parent = button.parentElement;
  if (parent) {
    const parentLabel = scanSiblingChain(button);
    if (parentLabel && isRelevantLabel(parentLabel)) return parentLabel;
    if (!fallback) fallback = parentLabel;
  }

  let current = parent;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const label = scanSiblingChain(current);
    if (label && isRelevantLabel(label)) return label;
    if (!fallback) fallback = label;
    current = current.parentElement;
  }

  return fallback || '';
}

export function getInstagramMetricInfo(hostname, el, { sourceText = getTrimmedText(el) } = {}) {
  if (!isInstagramHost(hostname) || !(el instanceof Element) || !el.isConnected) return null;
  const labels = getInstagramSocialLabels();

  if (el.matches(INSTAGRAM_SPLIT_FEEDBACK_CANDIDATE_SELECTOR)
    || (el.hasAttribute(INSTAGRAM_LABEL_ATTR) && el.childElementCount > 0)) {
    const split = getInstagramSplitLikeLabel(el, sourceText);
    return split ? { key: 'feedbackCounts', group: 'engagement', label: split.label,
      replacementLabel: split.label } : null;
  }

  if (
    el.childElementCount === 0
    && el.matches(INSTAGRAM_LABELLED_FEEDBACK_CANDIDATE_SELECTOR)
    && el.closest(INSTAGRAM_ACTION_BUTTON_SELECTOR)
    && getInstagramReplyReplacement(sourceText)
  ) {
    return {
      key: 'feedbackCounts', group: 'engagement', label: '답글',
      replacementLabel: getInstagramReplyReplacement(sourceText),
    };
  }

  if (
    el.childElementCount === 0
    && el.closest(INSTAGRAM_PRIMARY_SCOPE_SELECTOR)
    && INSTAGRAM_LABELLED_FEEDBACK_TEXT.test(sourceText)
  ) {
    const label = sourceText.match(/좋아요|댓글|답글|likes?|comments?|replies?/i)[0];
    return {
      key: 'feedbackCounts', group: 'engagement', label,
      replacementLabel: el.closest(INSTAGRAM_ACTION_BUTTON_SELECTOR) ? label : null,
    };
  }

  const rememberedInfo = getRememberedInstagramSemanticInfo(el);
  if (rememberedInfo) {
    // Previous discovery is only a local ownership edge to recheck. It cannot
    // retain a metric meaning after action, visibility, or structure changes.
    const currentInfo = revalidateInstagramSemanticInfo(el, rememberedInfo, labels);
    if (currentInfo) rememberInstagramSemanticInfo(el, currentInfo);
    // Keep a revoked edge until owner restoration: repeated checks must not
    // reinterpret the same former target through weaker adjacent-label hints.
    return currentInfo;
  }

  if (el.matches(INSTAGRAM_LABELLED_FEEDBACK_CANDIDATE_SELECTOR)
    && /좋아요|댓글|답글|likes?|comments?|replies?/i.test(sourceText)
    && !el.closest('a[href*="/liked_by/"], a[href*="/likes/"]')) return null;

  const profileStatInfo = resolveInstagramProfileStatInfo(el, labels);
  if (profileStatInfo) return profileStatInfo;

  if (isInstagramGridOverlayMetric(hostname, el)) return null;
  if (isInstagramPostCount(hostname, el)) return null;

  const originalAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT;
  const rawText = (el.getAttribute(originalAttr) || el.textContent || '').trim();
  if (!rawText) return null;

  const insta = INSTAGRAM_ADAPTER_TARGETS;

  if (el.tagName === 'TIME' || el.closest(insta.time)) {
    return { key: 'timeSignals', group: 'exposure', label: labels.UPLOAD };
  }

  const lowerText = rawText.toLowerCase();
  if (/좋아요|like/.test(lowerText)) {
    return { key: 'feedbackCounts', group: 'engagement', label: labels.LIKE };
  }
  if (/댓글|comment|reply/.test(lowerText)) {
    return { key: 'feedbackCounts', group: 'engagement', label: labels.COMMENT };
  }
  if (/리포스트|repost/.test(lowerText)) {
    return { key: 'feedbackCounts', group: 'engagement', label: labels.REPOST };
  }
  if (/팔로워|followers?/.test(lowerText)) {
    return { key: 'audienceCounts', group: 'engagement', label: labels.FOLLOWER };
  }
  if (/팔로잉|팔로우|following/.test(lowerText)) {
    return { key: 'audienceCounts', group: 'engagement', label: labels.FOLLOWING };
  }
  if (/조회|views?/.test(lowerText)) {
    return { key: 'viewCounts', group: 'exposure', label: labels.VIEWS };
  }

  const contextHints = getInstagramContextHints(hostname, el);
  if (/좋아요|like/.test(contextHints)) {
    return { key: 'feedbackCounts', group: 'engagement', label: labels.LIKE };
  }
  if (/댓글|comment|reply/.test(contextHints)) {
    return { key: 'feedbackCounts', group: 'engagement', label: labels.COMMENT };
  }
  if (/리포스트|repost/.test(contextHints)) {
    return { key: 'feedbackCounts', group: 'engagement', label: labels.REPOST };
  }
  if (/팔로워|followers?/.test(contextHints)) {
    return { key: 'audienceCounts', group: 'engagement', label: labels.FOLLOWER };
  }
  if (/팔로잉|팔로우|following/.test(contextHints)) {
    return { key: 'audienceCounts', group: 'engagement', label: labels.FOLLOWING };
  }
  if (/조회|views?/.test(contextHints)) {
    return { key: 'viewCounts', group: 'exposure', label: labels.VIEWS };
  }

  const buttonLabel = getInstagramButtonLabel(hostname, el);
  if (/좋아요|like/.test(buttonLabel)) {
    return { key: 'feedbackCounts', group: 'engagement', label: labels.LIKE };
  }
  if (/댓글|comment|reply/.test(buttonLabel)) {
    return { key: 'feedbackCounts', group: 'engagement', label: labels.COMMENT };
  }
  if (/리포스트|repost/.test(buttonLabel)) {
    return { key: 'feedbackCounts', group: 'engagement', label: labels.REPOST };
  }

  return null;
}

export function getInstagramSelectorDriftSurface(el) {
  if (!(el instanceof Element)) return null;
  return getRememberedInstagramSemanticInfo(el)?.surface || null;
}

export function isInstagramMetricEffectCurrent(record, hostname, ctx, sourceText) {
  const { target, metricTarget, kind } = record;
  if (!target.isConnected || !metricTarget.isConnected) return false;
  if (metricTarget.closest('[hidden], [aria-hidden="true"]')) return false;
  if (kind === 'label'
    && !metricTarget.matches(INSTAGRAM_LABELLED_FEEDBACK_CANDIDATE_SELECTOR)
    && !metricTarget.matches(INSTAGRAM_SPLIT_FEEDBACK_CANDIDATE_SELECTOR)
    && !metricTarget.matches(ctx.joinedSelector)) return false;
  if (target !== metricTarget && getInstagramTimeCluster(metricTarget) !== target) return false;
  const info = getInstagramMetricInfo(hostname, metricTarget, { sourceText });
  return !!info && info.group === ctx.group && ctx.filterKeys.includes(info.key);
}

export function shouldSkipInstagramActionButton(hostname, el, { sourceText = el?.textContent } = {}) {
  if (!isInstagramHost(hostname) || !(el instanceof Element)) return false;
  const insta = INSTAGRAM_ADAPTER_TARGETS;
  const button = el.closest ? el.closest(insta.buttonOrLink) : null;
  if (!button) return false;

  const text = (sourceText || '').trim();
  if (/\d/.test(text)) return false;

  const label =
    (button.getAttribute && (button.getAttribute('aria-label') || button.getAttribute('title'))) || '';
  if (String(label).trim()) return true;

  const icon =
    button.querySelector &&
    button.querySelector('svg, [role="img"], img, [aria-label], [title]');
  if (icon) return true;

  return false;
}

export function hasInstagramIcon(el) {
  if (!(el instanceof Element)) return false;
  return !!el.querySelector('svg, img, [role="img"]');
}

function getInstagramTimeCluster(el) {
  const time = el?.closest?.('time[datetime]') || (el?.matches?.('time[datetime]') ? el : null);
  if (!(time instanceof Element)) return null;
  let current = time.parentElement;
  for (let depth = 0; current instanceof Element && depth < 7; depth += 1) {
    if (current === document.body || current === document.documentElement) return null;
    const timeNodes = Array.from(current.querySelectorAll?.('time[datetime]') || []);
    if (!timeNodes.includes(time)) {
      current = current.parentElement;
      continue;
    }
    const timeTexts = timeNodes.map((node) => getTrimmedText(node)).filter(Boolean);
    const hasSeparator = Array.from(current.querySelectorAll?.('span') || [])
      .some((node) => INSTAGRAM_TIME_SEPARATOR_TEXT_RE.test(getTrimmedText(node)));
    const remainder = timeTexts.reduce(
      (text, value) => text.replace(value, ''),
      getTrimmedText(current)
    ).replace(/[·•\s]/g, '');
    if (hasSeparator && remainder === '') return current;
    current = current.parentElement;
  }
  return null;
}

function collapseInstagramTimeCluster(el, attr) {
  const cluster = getInstagramTimeCluster(el);
  if (!(cluster instanceof Element) || cluster === el) return null;
  const originalDisplayAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_DISPLAY;
  if (!cluster.hasAttribute(originalDisplayAttr)) {
    setAttribute(cluster, originalDisplayAttr, cluster.style?.display || '');
  }
  if (cluster.getAttribute(attr) !== '1') {
    setAttribute(cluster, attr, '1');
  }
  if (
    cluster.style?.getPropertyValue('display') !== 'none'
    || !!cluster.style?.getPropertyPriority('display')
  ) {
    setStyleProperty(cluster, 'display', 'none');
  }
  return cluster;
}

export function applyInstagramMetricCollapse(el, attr) {
  if (!(el instanceof Element) || hasInstagramIcon(el)) return [];
  if (el.tagName === 'TIME' || el.closest?.('time[datetime]')) {
    if (el.getAttribute(attr) !== '1') {
      setAttribute(el, attr, '1');
    }
    const cluster = collapseInstagramTimeCluster(el, attr);
    return cluster ? [el, cluster] : [el];
  }

  if (el.getAttribute(SOCIAL_METRIC_ATTRS.INSTAGRAM_COLLAPSE) !== '1') {
    setAttribute(el, SOCIAL_METRIC_ATTRS.INSTAGRAM_COLLAPSE, '1');
  }
  if (el.getAttribute(attr) !== '1') {
    setAttribute(el, attr, '1');
  }
  return [el];
}

export function createInstagramMetricLabelOwner({ runWithReconciliationDisposition } = {}) {
  if (typeof runWithReconciliationDisposition !== 'function') {
    throw new Error('INSTAGRAM_METRIC_LABEL_RECONCILIATION_OWNER_REQUIRED');
  }
  const records = new Map();
  const removedRoots = new Map();
  let removalRevision = 0;
  function sourcePart(previous, node) {
    const part = previous?.parts?.find(entry => entry.node === node);
    return part && node.parentNode === part.parent && node.nodeValue === part.applied
      ? part.original : node.nodeValue;
  }
  function sourceText(el) {
    const previous = records.get(el);
    if (previous?.parts) {
      const structure = getInstagramSplitLikeStructure(el);
      if (!structure) return el.textContent;
      return [structure.prefix, ...structure.countNodes, ...structure.suffixNodes]
        .map(node => sourcePart(previous, node)).join('');
    }
    return previous && el.textContent === previous.applied ? previous.original : el.textContent;
  }
  function restore(el) {
    const previous = records.get(el);
    if (!previous) return;
    if (previous.kind === 'label') {
      if (previous.parts) {
        for (const part of previous.parts) {
          if (el.contains(part.node) && part.node.parentNode === part.parent
            && part.node.nodeValue === part.applied) {
            runWithReconciliationDisposition(part.parent, 'clear', () => setTextNode(part.node, part.original));
          }
        }
      } else if (el.textContent === previous.applied) setText(el, previous.original);
      removeAttribute(el, INSTAGRAM_LABEL_ATTR);
    }
    records.delete(el);
  }

  function createCursor(group, roots) {
    const detachedVersions = [...(removedRoots.get(group) || [])];
    const scopes = [
      ...(roots === null ? [document.documentElement] : roots),
      ...detachedVersions.map(([scope]) => scope),
    ];
    let scopeIndex = 0;
    let iterator = null;
    let disconnectedIterator = null;
    const seen = new Set();
    function finish() {
      for (const [scope, revision] of detachedVersions) {
        const pending = removedRoots.get(group);
        if (pending?.get(scope) === revision) pending.delete(scope);
      }
      return { done: true };
    }
    return Object.freeze({
      next() {
        if (records.size === 0) return finish();
        const value = [];
        for (let visited = 0; visited < 32;) {
          if (!iterator) {
            if (scopeIndex >= scopes.length) {
              // Removed subtrees may be emptied before this deferred cursor.
              // Actual removals alone owe disconnected ownership cleanup; no
              // unrelated connected target is classified by this ledger pass.
              if (detachedVersions.length === 0) return value.length ? { done: false, value } : finish();
              if (!disconnectedIterator) disconnectedIterator = records.values();
              const step = disconnectedIterator.next();
              if (step.done) return value.length ? { done: false, value } : finish();
              visited += 1;
              const record = step.value;
              if (record.group !== group || seen.has(record.target)
                || (record.target.isConnected && record.metricTarget.isConnected)) continue;
              seen.add(record.target);
              value.push(record);
              continue;
            }
            const scope = scopes[scopeIndex++];
            if (!(scope instanceof Element)) continue;
            iterator = scope.ownerDocument.createNodeIterator(scope, NodeFilter.SHOW_ELEMENT);
          }
          const target = iterator.nextNode();
          if (!target) { iterator = null; continue; }
          visited += 1;
          const record = records.get(target);
          if (record?.group !== group || seen.has(target)) continue;
          seen.add(target);
          value.push(record);
        }
        return { done: false, value };
      },
    });
  }

  return Object.freeze({
    sourceText, restore, owns: (el) => records.get(el)?.kind === 'label', createCursor,
    rememberCollapse(target, metricTarget, attr) {
      if (!(target instanceof Element) || target.getAttribute(attr) !== '1') return;
      records.set(target, {
        kind: 'collapse', target, metricTarget, attr,
        group: attr === SOCIAL_METRIC_ATTRS.ENGAGEMENT ? 'engagement' : 'exposure',
      });
    },
    observeRemovals(payload, groups) {
      if (records.size === 0) return;
      for (const { group } of groups) {
        let roots = removedRoots.get(group);
        if (!roots) removedRoots.set(group, roots = new Map());
        for (const node of payload.removedNodes || []) {
          if (node instanceof Element) roots.set(node, ++removalRevision);
        }
      }
    },
    clearGroup(group, restoreEffect) {
      for (const record of records.values()) {
        if (record.group !== group) continue;
        try {
          restoreEffect(record);
        } catch (error) {
          records.set(record.target, record);
          throw error;
        }
        records.delete(record.target);
      }
      removedRoots.delete(group);
    },
    apply(el, label) {
      if (!(el instanceof Element) || !label) return null;
      if (el.childElementCount > 0) {
        const split = getInstagramSplitLikeLabel(el, sourceText(el));
        if (!split || split.label !== label) return null;
        const previous = records.get(el);
        const parts = split.parts.map(part => ({ ...part, parent: part.node.parentNode,
          original: sourcePart(previous, part.node) }));
        records.set(el, { kind: 'label', target: el, metricTarget: el, group: 'engagement',
          attr: SOCIAL_METRIC_ATTRS.ENGAGEMENT, parts });
        for (const part of parts) setTextNode(part.node, part.applied);
        setAttribute(el, INSTAGRAM_LABEL_ATTR, '1');
        return el;
      }
      records.set(el, {
        kind: 'label', target: el, metricTarget: el, group: 'engagement',
        attr: SOCIAL_METRIC_ATTRS.ENGAGEMENT, original: sourceText(el), applied: label,
      });
      setText(el, label);
      setAttribute(el, INSTAGRAM_LABEL_ATTR, '1');
      return el;
    },
    restoreAll() {
      for (const [el, record] of records) {
        if (record.kind === 'label') restore(el);
      }
    },
  });
}

export function restoreInstagramText(el) {
  if (!(el instanceof Element)) return;
  instagramSemanticInfoByElement.delete(el);
  instagramStabilityScopeByElement.delete(el);
  const originalAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT;
  const originalDisplayAttr = SOCIAL_METRIC_ATTRS.ORIGINAL_DISPLAY;
  if (el.hasAttribute(originalAttr)) {
    const original = el.getAttribute(originalAttr);
    if (original !== null && el.textContent !== original) {
      setText(el, original);
    }
    removeAttribute(el, originalAttr);
  }
  if (el.hasAttribute(originalDisplayAttr)) {
    const originalDisplay = el.getAttribute(originalDisplayAttr);
    if (originalDisplay) {
      if (
        el.style?.getPropertyValue('display') !== originalDisplay
        || !!el.style?.getPropertyPriority('display')
      ) {
        setStyleProperty(el, 'display', originalDisplay);
      }
    } else if (
      !!el.style?.getPropertyValue('display')
      || !!el.style?.getPropertyPriority('display')
    ) {
      removeStyleProperty(el, 'display');
    }
    removeAttribute(el, originalDisplayAttr);
  }
  if (el.hasAttribute(SOCIAL_METRIC_ATTRS.INSTAGRAM_COLLAPSE)) {
    removeAttribute(el, SOCIAL_METRIC_ATTRS.INSTAGRAM_COLLAPSE);
  }
}
