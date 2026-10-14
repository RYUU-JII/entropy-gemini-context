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
  resolveSemanticActionMetricCandidate,
  normalizeSemanticMetricText,
} from '../core/semanticActionMetricMatcher.js';
import {
  FACEBOOK_ACCESSIBLE_REACTION_LABEL_SELECTOR,
  FACEBOOK_DETAIL_ACTION_SCOPE_SELECTOR,
  FACEBOOK_REACTION_TOOLBAR_SCOPE_SELECTOR,
  FACEBOOK_COMMENT_REPLY_SCOPE_SELECTOR,
  FACEBOOK_PHOTO_PANEL_SCOPE_SELECTOR,
  FACEBOOK_PHOTO_COMMENT_THREAD_SCOPE_SELECTOR,
  FACEBOOK_COMMENT_REPLY_LABEL_SELECTOR,
  FACEBOOK_REPLY_ACTION_LEAF_SELECTOR,
  FACEBOOK_REPLY_LABEL_ATTR,
} from './facebookProfile.js';
import { createMetricCollectionPlan, collectMetricCollectionPlan } from '../core/metricCollectionCursor.js';
import { collapseMutationSourceNodes, collectMutationCausalRoots } from '../core/dirtyRootReducer.js';

const FACEBOOK_FEED_SCOPE_SELECTOR =
  ':is([role="article"], [data-pagelet^="FeedUnit_"], [data-pagelet*="FeedUnit" i], [aria-posinset][aria-describedby])';
const FACEBOOK_SCAN_SCOPE_SELECTOR = `${FACEBOOK_COMMENT_REPLY_SCOPE_SELECTOR}, ${FACEBOOK_FEED_SCOPE_SELECTOR}, ${FACEBOOK_DETAIL_ACTION_SCOPE_SELECTOR}, ${FACEBOOK_REACTION_TOOLBAR_SCOPE_SELECTOR}`;
const FACEBOOK_ACTION_BUTTON_SELECTOR =
  ':is(button[aria-label], a[aria-label], [role="button"][aria-label], [role="link"][aria-label])';
const FACEBOOK_ACTION_CONTAINER_SELECTOR =
  ':is(button, a, span, div, [role="button"], [role="link"])';
const FACEBOOK_ACTION_CANDIDATE_SELECTOR = ':is(span, strong, [role="text"], div:not(:has(*)))';
const FACEBOOK_LABELLED_COUNT_SELECTOR = ':is(span, strong, [role="text"])';
const FACEBOOK_SHARE_RENDER_ROLE_SELECTOR =
  '[data-ad-rendering-role="share_button"]';
const FACEBOOK_PERMALINK_TIME_SELECTOR =
  ':is(a[href*="/posts/"], a[href*="story_fbid"], a[href*="/permalink/"], a[href*="/reel/"], a[href*="/videos/"])[role="link"]';
const FACEBOOK_NUMERIC_COUNTER_TEXT =
  /^\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*$/i;
const FACEBOOK_COUNT_TEXT_SOURCE =
  '[\\d,.]+(?:\\.\\d+)?\\s*(?:천|만|억|K|M|B)?';
const FACEBOOK_REACTION_LABEL_SOURCE = '(?:좋아요|반응|공감|likes?|reactions?)';
const FACEBOOK_COMMENT_LABEL_SOURCE = '(?:댓글|답글|comments?|repl(?:y|ies))';
const FACEBOOK_SHARE_LABEL_SOURCE =
  '(?:공유|리포스트|재게시|shares?|reposts?|reshares?)';
const FACEBOOK_VIEW_LABEL_SOURCE = '(?:조회|재생|views?|plays?)';
const FACEBOOK_AUDIENCE_LABEL_SOURCE = '(?:팔로워|팔로잉|followers?|following)';
const FACEBOOK_REACTION_LABEL_RE = new RegExp(FACEBOOK_REACTION_LABEL_SOURCE, 'i');
const FACEBOOK_COMMENT_LABEL_RE = new RegExp(FACEBOOK_COMMENT_LABEL_SOURCE, 'i');
const FACEBOOK_SHARE_LABEL_RE = new RegExp(FACEBOOK_SHARE_LABEL_SOURCE, 'i');
const FACEBOOK_VIEW_LABEL_RE = new RegExp(FACEBOOK_VIEW_LABEL_SOURCE, 'i');
const FACEBOOK_AUDIENCE_LABEL_RE = new RegExp(FACEBOOK_AUDIENCE_LABEL_SOURCE, 'i');
const createFacebookLabelledCountPattern = (labelSource, unitSource = '(?:명|개|회|번)?') => (
  new RegExp(
    `^\\s*(?:(?:${labelSource})\\s*[:：]?\\s*${FACEBOOK_COUNT_TEXT_SOURCE}\\s*${unitSource}|${FACEBOOK_COUNT_TEXT_SOURCE}\\s*${unitSource}\\s*(?:${labelSource}))\\s*$`,
    'i',
  )
);
const FACEBOOK_FEEDBACK_COUNT_RES = Object.freeze([
  createFacebookLabelledCountPattern(FACEBOOK_REACTION_LABEL_SOURCE),
  createFacebookLabelledCountPattern(FACEBOOK_COMMENT_LABEL_SOURCE),
  createFacebookLabelledCountPattern(FACEBOOK_SHARE_LABEL_SOURCE),
]);
const FACEBOOK_VIEW_COUNT_RE =
  createFacebookLabelledCountPattern(FACEBOOK_VIEW_LABEL_SOURCE);
const FACEBOOK_AUDIENCE_COUNT_RE =
  createFacebookLabelledCountPattern(FACEBOOK_AUDIENCE_LABEL_SOURCE, '(?:명|개)?');
const FACEBOOK_TIME_TEXT_RE =
  /^\s*(?:now|\d+\s*(?:s|m|h|d|w|mo|y)|\d+\s*(?:초|분|시간|일|주|개월|년)(?:\s*전)?|\d+\s*(?:seconds?|secs?|minutes?|mins?|hours?|days?|weeks?|months?|years?)\s+ago|(?:\d{4}년\s*)?\d{1,2}월\s*\d{1,2}일(?:\s*(?:오전|오후)?\s*\d{1,2}:\d{2})?)\s*$/i;
const FACEBOOK_MAX_ROOTS = 24;
const FACEBOOK_MAX_BUTTONS = 48;
const FACEBOOK_MAX_CANDIDATES = 80;
const FACEBOOK_MAX_TEXT_LENGTH = 72;
const FACEBOOK_MAX_ANCESTOR_DEPTH = 6;
const FACEBOOK_MAX_COUNT_OWNER_DEPTH = 4;
const FACEBOOK_METADATA_SEPARATOR_TEXT_RE = /^[\s\u00A0·•]*$/;
const FACEBOOK_METADATA_MAX_CHILDREN = 8;
const FACEBOOK_METADATA_SCAN_MAX_DEPTH = 7;
const FACEBOOK_METADATA_CLUSTER_ATTR = 'data-friction-facebook-metadata-cluster';
const FACEBOOK_METADATA_ITEM_ATTR = 'data-friction-facebook-metadata-item';
const FACEBOOK_METADATA_SEPARATOR_ATTR = 'data-friction-facebook-metadata-separator';
const FACEBOOK_METADATA_ORIGINAL_DISPLAY_PREFIX = 'display:';
const FACEBOOK_SCORE_THRESHOLD = 110;
const FACEBOOK_TOOLBAR_REACTION_COUNT_RE = new RegExp(
  `^(\\s*(?:좋아요|최고예요))\\s*[:：]\\s*${FACEBOOK_COUNT_TEXT_SOURCE}\\s*명\\s*$`,
  'u',
);
const FACEBOOK_COMMENT_REACTION_COUNT_RE = new RegExp(
  `^(\\s*공감)\\s*${FACEBOOK_COUNT_TEXT_SOURCE}\\s*개(?=\\s*,\\s*공감한 사람 보기\\s*$)`,
  'u',
);
const FACEBOOK_REPLY_COUNT_LABEL_RE = /^\s*답글\s*[\d,.]+(?:\s*(?:천|만|억|K|M|B))?\s*개\s*보기\s*$/u;

export function isFacebookReplyLabelCandidate(el) {
  return el.matches(FACEBOOK_COMMENT_REPLY_LABEL_SELECTOR)
    || el.hasAttribute(FACEBOOK_REPLY_LABEL_ATTR);
}

function hasFacebookReplyLabelOwner(el) {
  if (el.childElementCount !== 0 || !el.matches(FACEBOOK_REPLY_ACTION_LEAF_SELECTOR)) return false;
  const replyScope = el.closest(FACEBOOK_COMMENT_REPLY_SCOPE_SELECTOR);
  if (!replyScope) return false;
  return !replyScope.matches(FACEBOOK_PHOTO_COMMENT_THREAD_SCOPE_SELECTOR)
    || normalizeSemanticMetricText(replyScope.parentElement.querySelector(':scope > h2[dir="auto"]')?.textContent) === '댓글';
}

export function getFacebookReplyMetricInfo(el, sourceText) {
  if (!hasFacebookReplyLabelOwner(el) || !FACEBOOK_REPLY_COUNT_LABEL_RE.test(sourceText)) return null;
  return { key: 'feedbackCounts', group: 'engagement', replacementLabel: '답글 보기' };
}

export function createFacebookReplyLabelOwner() {
  const records = new Map();
  function sourceText(el) {
    const previous = records.get(el);
    return previous && el.textContent === previous.applied ? previous.original : el.textContent;
  }
  function restore(el) {
    const previous = records.get(el);
    if (!previous) return;
    if (el.textContent === previous.applied) setText(el, previous.original);
    removeAttribute(el, FACEBOOK_REPLY_LABEL_ATTR);
    records.delete(el);
  }
  return Object.freeze({
    sourceText, restore, owns: (el) => records.has(el), hasRecords: () => records.size > 0,
    apply(el, label) {
      if (!hasFacebookReplyLabelOwner(el)) throw new Error('FACEBOOK_REPLY_LABEL_OWNER_REQUIRED');
      records.set(el, { original: sourceText(el), applied: label });
      setText(el, label);
      setAttribute(el, FACEBOOK_REPLY_LABEL_ATTR, '1');
      return el;
    },
    restoreAll() { for (const [el] of records) restore(el); },
  });
}

export function isFacebookAccessibleMetricContainer(el) {
  if (!el.matches(FACEBOOK_ACCESSIBLE_REACTION_LABEL_SELECTOR)) return false;
  const label = el.getAttribute('aria-label') || '';
  return FACEBOOK_TOOLBAR_REACTION_COUNT_RE.test(label)
    || FACEBOOK_COMMENT_REACTION_COUNT_RE.test(label)
    || /^\s*(?:좋아요|최고예요|공감\s*,\s*공감한 사람 보기)\s*$/u.test(label);
}

export function projectFacebookAccessibleMetricLabel(el, source, activeMetricKeys) {
  if (!el.matches(FACEBOOK_ACCESSIBLE_REACTION_LABEL_SELECTOR)) return null;
  if (!activeMetricKeys.includes('feedbackCounts')) return { label: source, keys: [] };
  // Native reaction names stay actionable; only the two observed count clauses
  // qualify inside their declared toolbar/article owners.
  const label = source
    .replace(FACEBOOK_TOOLBAR_REACTION_COUNT_RE, '$1')
    .replace(FACEBOOK_COMMENT_REACTION_COUNT_RE, '$1');
  return { label, keys: label === source ? [] : ['feedbackCounts'] };
}

function hasActiveFilter(ctx, filterKey) {
  return Array.isArray(ctx?.filterKeys) && ctx.filterKeys.includes(filterKey);
}

function getTrimmedText(el) {
  return normalizeSemanticMetricText(el?.textContent);
}

function getFacebookActionLabelText(el) {
  if (!(el instanceof Element)) return '';
  return normalizeSemanticMetricText([
    el.getAttribute?.('aria-label'),
    el.getAttribute?.('title'),
  ].filter(Boolean).join(' '));
}

function resolveFacebookActionType(el, labelText = getFacebookActionLabelText(el)) {
  if (!(el instanceof Element)) return null;
  const label = normalizeSemanticMetricText(labelText);
  if (!label) return null;
  if (FACEBOOK_VIEW_LABEL_RE.test(label)) return 'view';
  if (FACEBOOK_COMMENT_LABEL_RE.test(label)) return 'comment';
  if (FACEBOOK_SHARE_LABEL_RE.test(label) || /친구들에게 보내|send to friends/i.test(label)) return 'share';
  if (FACEBOOK_REACTION_LABEL_RE.test(label)) return 'reaction';
  return null;
}

function createFacebookActionProfile(ctx = {}) {
  const allowFeedback = ctx?.group === 'engagement' && hasActiveFilter(ctx, 'feedbackCounts');
  const allowViews = ctx?.group === 'exposure' && hasActiveFilter(ctx, 'viewCounts');
  return Object.freeze({
    actionButtonSelector: FACEBOOK_ACTION_BUTTON_SELECTOR,
    actionRootSelector: FACEBOOK_SCAN_SCOPE_SELECTOR,
    actionContainerSelector: FACEBOOK_ACTION_CONTAINER_SELECTOR,
    candidateSelector: FACEBOOK_ACTION_CANDIDATE_SELECTOR,
    candidateTextPattern: FACEBOOK_NUMERIC_COUNTER_TEXT,
    limits: Object.freeze({
      maxRoots: FACEBOOK_MAX_ROOTS,
      maxButtons: FACEBOOK_MAX_BUTTONS,
      maxCandidateTextLength: FACEBOOK_MAX_TEXT_LENGTH,
      maxCandidatesPerButton: FACEBOOK_MAX_CANDIDATES,
      maxAncestorDepth: FACEBOOK_MAX_ANCESTOR_DEPTH,
      threshold: FACEBOOK_SCORE_THRESHOLD,
    }),
    actions: Object.freeze({
      reaction: Object.freeze({}),
      comment: Object.freeze({}),
      share: Object.freeze({}),
      view: Object.freeze({}),
    }),
    getActionLabelText: (button) => getFacebookActionLabelText(button),
    getCandidateText: (candidate) => getTrimmedText(candidate),
    resolveActionType: (button, labelText) => {
      const actionType = resolveFacebookActionType(button, labelText);
      if (actionType === 'view') return allowViews ? actionType : null;
      return allowFeedback ? actionType : null;
    },
    scoreCandidate: ({ button, candidate }) => (
      button?.contains?.(candidate) ? 48 : -240
    ),
  });
}

function countMatchingMetricKinds(text, matchers) {
  return matchers.reduce((count, matcher) => count + (matcher.test(text) ? 1 : 0), 0);
}

function isFacebookLabelledCountText(text, ctx) {
  if (!text || text.length > FACEBOOK_MAX_TEXT_LENGTH || !/\d/.test(text)) return false;
  const allowedMatchers = [];
  if (
    ctx?.group === 'engagement'
    && hasActiveFilter(ctx, 'feedbackCounts')
  ) {
    allowedMatchers.push(...FACEBOOK_FEEDBACK_COUNT_RES);
  }
  if (
    ctx?.group === 'engagement'
    && hasActiveFilter(ctx, 'audienceCounts')
  ) {
    allowedMatchers.push(FACEBOOK_AUDIENCE_COUNT_RE);
  }
  if (
    ctx?.group === 'exposure'
    && hasActiveFilter(ctx, 'viewCounts')
  ) {
    allowedMatchers.push(FACEBOOK_VIEW_COUNT_RE);
  }
  return countMatchingMetricKinds(text, allowedMatchers) === 1;
}

function hasNestedFacebookLabelledCount(el, ctx) {
  return Array.from(el.querySelectorAll?.(FACEBOOK_LABELLED_COUNT_SELECTOR) || [])
    .some((candidate) => (
      candidate !== el
      && isFacebookLabelledCountText(getTrimmedText(candidate), ctx)
    ));
}

function resolveFacebookLabelledCountOwner(seed, scope, ctx) {
  let current = seed;
  for (
    let depth = 0;
    current instanceof Element && depth <= FACEBOOK_MAX_COUNT_OWNER_DEPTH;
    depth += 1
  ) {
    const text = getTrimmedText(current);
    if (text.length > FACEBOOK_MAX_TEXT_LENGTH) return null;
    if (isFacebookLabelledCountText(text, ctx)) return current;
    if (current === scope) return null;
    current = current.parentElement;
  }
  return null;
}

function hasNestedFacebookNumericCounter(el) {
  return Array.from(el.querySelectorAll?.(FACEBOOK_LABELLED_COUNT_SELECTOR) || [])
    .some((candidate) => (
      candidate !== el
      && FACEBOOK_NUMERIC_COUNTER_TEXT.test(getTrimmedText(candidate))
    ));
}

function isFacebookStructuralShareCountCandidate(candidate, scope) {
  if (!FACEBOOK_NUMERIC_COUNTER_TEXT.test(getTrimmedText(candidate)) || hasNestedFacebookNumericCounter(candidate)) return false;
  let countItem = candidate;
  while (countItem instanceof Element && scope.contains(countItem)) {
    const iconItem = countItem.previousElementSibling;
    if (iconItem?.querySelector(':scope > ' + FACEBOOK_SHARE_RENDER_ROLE_SELECTOR)) return true;
    if (countItem === scope) break;
    countItem = countItem.parentElement;
  }
  return false;
}

function isFacebookPermalinkTimeCandidate(el) {
  if (!(el instanceof Element)) return false;
  const text = getTrimmedText(el);
  const ariaLabel = normalizeSemanticMetricText(el.getAttribute?.('aria-label'));
  return FACEBOOK_TIME_TEXT_RE.test(text) || FACEBOOK_TIME_TEXT_RE.test(ariaLabel);
}

export function createFacebookSemanticMetricCandidateCollectionPlan(ctx = {}) {
  const actionProfile = createFacebookActionProfile(ctx);
  return createMetricCollectionPlan({
    roots: ctx.roots,
    resolveElement(element) {
      const scope = element.closest(FACEBOOK_SCAN_SCOPE_SELECTOR);
      if (!scope) return null;
      if (ctx.group === 'engagement' && hasActiveFilter(ctx, 'feedbackCounts')
        && element.matches(FACEBOOK_ACCESSIBLE_REACTION_LABEL_SELECTOR)) return [element];
      if (element.matches(FACEBOOK_ACTION_BUTTON_SELECTOR)) {
        const target = resolveSemanticActionMetricCandidate(element, actionProfile)?.target;
        if (target) return [target];
      }
      if (element.matches(FACEBOOK_LABELLED_COUNT_SELECTOR)) {
        const owner = resolveFacebookLabelledCountOwner(element, scope, ctx);
        if (owner && !hasNestedFacebookLabelledCount(owner, ctx)) return [owner];
        if (ctx.group === 'engagement' && hasActiveFilter(ctx, 'feedbackCounts')
          && isFacebookStructuralShareCountCandidate(element, scope)) return [element];
        return [];
      }
      if (ctx.group === 'exposure' && hasActiveFilter(ctx, 'timeSignals')
        && element.matches(FACEBOOK_PERMALINK_TIME_SELECTOR)) {
        return isFacebookPermalinkTimeCandidate(element) ? [element] : [];
      }
      return element.matches(FACEBOOK_ACTION_BUTTON_SELECTOR) ? [] : null;
    },
  });
}

export function collectFacebookSemanticMetricCandidates(ctx = {}) {
  return collectMetricCollectionPlan(createFacebookSemanticMetricCandidateCollectionPlan(ctx));
}

function getFacebookMetadataTimeNodes(el) {
  if (!(el instanceof Element)) return [];
  const nodes = [];
  if (
    el.matches?.(FACEBOOK_PERMALINK_TIME_SELECTOR)
    && isFacebookPermalinkTimeCandidate(el)
  ) {
    nodes.push(el);
  }
  el.querySelectorAll?.(FACEBOOK_PERMALINK_TIME_SELECTOR).forEach((candidate) => {
    if (isFacebookPermalinkTimeCandidate(candidate)) nodes.push(candidate);
  });
  return Array.from(new Set(nodes));
}

function isFacebookMetadataSeparatorSlot(el) {
  if (!(el instanceof Element)) return false;
  const text = el.textContent || '';
  if (!FACEBOOK_METADATA_SEPARATOR_TEXT_RE.test(text) || !/[·•]/.test(text)) return false;
  return Array.from(el.querySelectorAll?.('[aria-hidden="true"]') || [])
    .some((candidate) => (
      FACEBOOK_METADATA_SEPARATOR_TEXT_RE.test(candidate.textContent || '')
      && /[·•]/.test(candidate.textContent || '')
    ));
}

function getFacebookMetadataChildKind(child) {
  if (isFacebookMetadataSeparatorSlot(child)) return 'separator';
  if (getFacebookMetadataTimeNodes(child).length > 0) return 'time';
  return 'other';
}

function isPotentialFacebookMetadataCluster(candidate) {
  if (!(candidate instanceof Element)) return false;
  const children = Array.from(candidate.children);
  if (children.length < 3 || children.length > FACEBOOK_METADATA_MAX_CHILDREN) return false;
  const kinds = children.map((child) => getFacebookMetadataChildKind(child));
  return kinds.includes('time') && kinds.includes('separator');
}

function collectFacebookMetadataClusters(el) {
  if (!(el instanceof Element)) return [];
  let current = el;
  for (
    let depth = 0;
    current instanceof Element && depth < FACEBOOK_METADATA_SCAN_MAX_DEPTH;
    depth += 1
  ) {
    if (current === document.body || current === document.documentElement) break;
    if (isPotentialFacebookMetadataCluster(current)) return [current];
    current = current.parentElement;
  }
  return [];
}

function collapseFacebookMetadataNode(node, ownerAttribute) {
  if (!(node instanceof Element) || !node.style) return;
  if (!node.hasAttribute(ownerAttribute)) {
    const originalDisplay = node.style.getPropertyValue('display');
    const originalPriority = node.style.getPropertyPriority('display');
    if (originalPriority || originalDisplay === 'none') return;
    setAttribute(
      node,
      ownerAttribute,
      `${FACEBOOK_METADATA_ORIGINAL_DISPLAY_PREFIX}${originalDisplay}`,
    );
  }
  if (
    node.style.getPropertyValue('display') === 'none'
    && !node.style.getPropertyPriority('display')
  ) return;
  setStyleProperty(node, 'display', 'none');
}

function restoreFacebookMetadataNode(node, ownerAttribute) {
  if (!(node instanceof Element) || !node.hasAttribute(ownerAttribute)) return;
  const ownerState = node.getAttribute(ownerAttribute) || '';
  if (!ownerState.startsWith(FACEBOOK_METADATA_ORIGINAL_DISPLAY_PREFIX)) {
    throw new Error(`FACEBOOK_METADATA_DISPLAY_OWNER_STATE_INVALID:${ownerAttribute}`);
  }
  const originalDisplay = ownerState.slice(FACEBOOK_METADATA_ORIGINAL_DISPLAY_PREFIX.length);
  if (originalDisplay) {
    if (
      node.style.getPropertyValue('display') !== originalDisplay
      || node.style.getPropertyPriority('display')
    ) {
      setStyleProperty(node, 'display', originalDisplay);
    }
  } else if (
    node.style.getPropertyValue('display')
    || node.style.getPropertyPriority('display')
  ) {
    removeStyleProperty(node, 'display');
  }
  removeAttribute(node, ownerAttribute);
}

function syncFacebookMetadataNodeDisplay(node, ownerAttribute, shouldHide) {
  if (shouldHide) {
    collapseFacebookMetadataNode(node, ownerAttribute);
    return;
  }
  restoreFacebookMetadataNode(node, ownerAttribute);
}

export function syncFacebookMetadataCluster(cluster, helpers) {
  const { isMetricHidden } = helpers || {};
  if (!(cluster instanceof Element) || typeof isMetricHidden !== 'function') return;

  const children = Array.from(cluster.children);
  if (children.length === 0) return;
  const states = children.map((child) => {
    const kind = getFacebookMetadataChildKind(child);
    if (kind === 'time') {
      const timeNodes = getFacebookMetadataTimeNodes(child);
      const visible = timeNodes.some((node) => !isMetricHidden(node));
      syncFacebookMetadataNodeDisplay(child, FACEBOOK_METADATA_ITEM_ATTR, !visible);
      return { child, kind, visible };
    }
    if (kind === 'separator') return { child, kind, visible: false };
    return { child, kind, visible: true };
  });

  const visibleSeparatorPairs = new Set();
  states.forEach((state, index) => {
    if (state.kind !== 'separator') return;
    const prevVisible = states
      .slice(0, index)
      .reverse()
      .find((entry) => entry.kind !== 'separator' && entry.visible);
    const nextVisible = states
      .slice(index + 1)
      .find((entry) => entry.kind !== 'separator' && entry.visible);
    const pairKey = prevVisible && nextVisible
      ? `${states.indexOf(prevVisible)}:${states.indexOf(nextVisible)}`
      : '';
    const shouldHide = !pairKey || visibleSeparatorPairs.has(pairKey);
    if (!shouldHide) visibleSeparatorPairs.add(pairKey);
    syncFacebookMetadataNodeDisplay(
      state.child,
      FACEBOOK_METADATA_SEPARATOR_ATTR,
      shouldHide,
    );
  });

  const hasVisibleNonSeparator =
    states.some((state) => state.kind !== 'separator' && state.visible);
  syncFacebookMetadataNodeDisplay(
    cluster,
    FACEBOOK_METADATA_CLUSTER_ATTR,
    !hasVisibleNonSeparator,
  );
}

export function syncFacebookMetadataForElement(el, helpers) {
  collectFacebookMetadataClusters(el).forEach((cluster) => {
    syncFacebookMetadataCluster(cluster, helpers);
  });
}

export function markFacebookMetadataDirty(el, ctx) {
  if (!(el instanceof Element) || !ctx?.dirtyFacebookMetadataClusters) return;
  collectFacebookMetadataClusters(el).forEach((cluster) => {
    ctx.dirtyFacebookMetadataClusters.add(cluster);
  });
}

export function flushDirtyFacebookMetadataClusters(ctx, helpers) {
  if (
    !ctx?.dirtyFacebookMetadataClusters
    || ctx.dirtyFacebookMetadataClusters.size === 0
  ) return;
  Array.from(ctx.dirtyFacebookMetadataClusters)
    .forEach((cluster) => syncFacebookMetadataCluster(cluster, helpers));
  ctx.dirtyFacebookMetadataClusters.clear();
}

export function restoreFacebookMetadataClusters() {
  document.querySelectorAll(`[${FACEBOOK_METADATA_CLUSTER_ATTR}]`).forEach((cluster) => {
    restoreFacebookMetadataNode(cluster, FACEBOOK_METADATA_CLUSTER_ATTR);
  });
  document.querySelectorAll(`[${FACEBOOK_METADATA_ITEM_ATTR}]`).forEach((item) => {
    restoreFacebookMetadataNode(item, FACEBOOK_METADATA_ITEM_ATTR);
  });
  document.querySelectorAll(`[${FACEBOOK_METADATA_SEPARATOR_ATTR}]`).forEach((separator) => {
    restoreFacebookMetadataNode(separator, FACEBOOK_METADATA_SEPARATOR_ATTR);
  });
}

export function collectFacebookSemanticMutationRoots(payload = {}) {
  const roots = new Set();
  for (const element of collectMutationCausalRoots(payload)) {
    const followingPhotoPanel = element.nextElementSibling;
    if (followingPhotoPanel?.matches('[role="complementary"]')) roots.add(followingPhotoPanel);
    const photoSectionHeading = element.closest('h2');
    if (photoSectionHeading?.closest(FACEBOOK_PHOTO_PANEL_SCOPE_SELECTOR)) {
      roots.add(photoSectionHeading.parentElement);
      continue;
    }
    roots.add(element.closest(FACEBOOK_FEED_SCOPE_SELECTOR)
      || element.closest(FACEBOOK_DETAIL_ACTION_SCOPE_SELECTOR)
      || element.closest(FACEBOOK_REACTION_TOOLBAR_SCOPE_SELECTOR)
      || element.closest(FACEBOOK_COMMENT_REPLY_SCOPE_SELECTOR) || element);
  }
  return collapseMutationSourceNodes(Array.from(roots));
}
