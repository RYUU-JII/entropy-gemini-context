import { SOCIAL_METRIC_ATTRS } from '../../../core/constants.js';
import {
  removeAttribute,
  removeStyleProperty,
  setAttribute,
  setStyleProperty,
  setText,
} from '../../FastStyleEngine.js';
import {
  normalizeSemanticMetricText,
  resolveSemanticActionMetricCandidate,
  resolveSemanticActionMetricMatchForElement,
} from '../core/semanticActionMetricMatcher.js';
import {
  SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES,
} from '../core/selectorDriftRecoveryContract.js';
import { collapseMutationSourceNodes, collectMutationCausalRoots } from '../core/dirtyRootReducer.js';
import { X_ACCESSIBLE_METRIC_LABEL_SELECTOR } from './xProfile.js';

export function isXAccessibleMetricContainer(el) {
  return el.matches(X_ACCESSIBLE_METRIC_LABEL_SELECTOR)
    && (el.matches('article, [role="group"]') || el.childElementCount > 0);
}

export function projectXAccessibleMetricLabel(el, source, activeMetricKeys) {
  if (!el.matches(X_ACCESSIBLE_METRIC_LABEL_SELECTOR)) return null;
  // Article prose is not a metric label. Only a count-only composite is owned.
  if (el.matches('article') && !source.split(/,\s+|\.\s+/u).every((part) => (
    /^\s*[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*(?:replies|reply|reposts?|retweets?|likes?|bookmarks?|views?|답글|댓글|리포스트|재게시|좋아요|북마크|조회수)\s*$/iu.test(part)
  ))) return { label: source, keys: [] };
  const patterns = {
    feedbackCounts: /(?<![\p{L}\p{N}])[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*(replies|reply|reposts?|retweets?|likes?|bookmarks?|답글|댓글|리포스트|재게시|좋아요|북마크)/giu,
    viewCounts: /(?<![\p{L}\p{N}])[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*(views?|조회수)/giu,
    audienceCounts: /(?<![\p{L}\p{N}])[\d,.]+(?:\s*(?:K|M|B|천|만|억))?\s*(followers?|following|posts?|팔로워|팔로잉|게시물)/giu,
  };
  let label = source;
  const keys = [];
  for (const key of activeMetricKeys) {
    if (!patterns[key]) continue;
    const next = label.replace(patterns[key], '$1');
    if (next !== label) keys.push(key);
    label = next;
  }
  return { label, keys };
}

const X_METADATA_SEPARATOR_TEXT = /^\s*·\s*$/;
const X_METADATA_CLUSTER_ATTR = 'data-friction-x-metadata-cluster';
const X_METADATA_ITEM_ATTR = 'data-friction-x-metadata-item';
const X_METADATA_SEPARATOR_ATTR = 'data-friction-x-metadata-separator';
const X_METADATA_ORIGINAL_DISPLAY_PREFIX = 'display:';
const X_ACTION_SCAN_SCOPE_SELECTOR =
  ':is(article, [data-testid="tweet"], [role="group"][aria-label], [data-testid="UserProfileHeader_Items"], [data-testid="HoverCard"], [data-testid="hoverCard"], [data-testid="UserName"], [data-testid="User-Name"], [data-testid="UserDescription"], [data-testid="primaryColumn"])';
const X_ACTION_BUTTON_SELECTOR =
  ':is(button[aria-label], a[aria-label], [role="button"][aria-label], [role="link"][aria-label], [data-testid="reply"], [data-testid="retweet"], [data-testid="like"], [data-testid="bookmark"], [data-testid="removeBookmark"], [data-testid="viewCount"], a[href*="/analytics"], div:not([role])[aria-label*="bookmark" i])';
const X_ACTION_ROOT_SELECTOR = ':is([role="group"][aria-label], article, [data-testid="tweet"])';
const X_ACTION_CONTAINER_SELECTOR =
  ':is([role="group"][aria-label], button, a, [role="button"], [role="link"], [data-testid="reply"], [data-testid="retweet"], [data-testid="like"], [data-testid="bookmark"], [data-testid="removeBookmark"], [data-testid="viewCount"])';
const X_METADATA_SCAN_MAX_DEPTH = 7;
const X_METADATA_MAX_CHILDREN = 8;
const X_METADATA_SIGNIFICANT_TEXT = /[^\s\u00A0·]/;
const X_GRAPHIC_SELECTOR = 'svg, img, canvas, [role="img"]';
const X_METRIC_LEAF_SELECTOR = 'span, strong, div';
const X_VIEW_METRIC_CONTAINER_SELECTOR = 'a[href*="/analytics"], [data-testid="viewCount"]';
const X_ACTION_TEXT_CANDIDATE_SELECTOR =
  ':is(span, strong, div, [role="text"], [data-testid="app-text-transition-container"])';
const X_VIEW_LABEL_TEXT = /^\s*(?:views?|조회수)\s*$/i;
const X_VIEW_ARIA_LABEL_TEXT = /\bviews?\b|조회수/i;
const X_NUMERIC_COUNTER_TEXT = /^\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*$/i;
const X_NEWS_ARTICLE_SELECTOR = '[data-testid^="news_sidebar_article_"][role="link"]';
const X_NEWS_METADATA_ORIGINAL_ATTR = SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT;
const X_NEWS_METADATA_SEPARATOR_RE = /\s*[·•]\s*/u;
const X_NEWS_POST_COUNT_SEGMENT_RE =
  /^\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:posts?|게시물)\s*$/iu;
const X_NEWS_TIME_SEGMENT_RE =
  /^\s*(?:now|trending\s+now|\d+\s*(?:s|m|h|d|w|mo|y)|\d+\s*(?:seconds?|secs?|minutes?|mins?|hours?|days?|weeks?|months?|years?)\s+ago|\d+\s*(?:초|분|시간|일|주|개월|년)\s*전)\s*$/iu;
const X_REPLY_LABEL_RE = /\brepl(?:y|ies)\b|답글|댓글/i;
const X_REPOST_LABEL_RE = /\breposts?\b|\bretweets?\b|리포스트|재게시/i;
const X_LIKE_LABEL_RE = /\blikes?\b|좋아요/i;
const X_BOOKMARK_LABEL_RE = /\bbookmarks?\b|북마크/i;
const X_VIEW_LABEL_RE = /\bviews?\b|조회수/i;
const X_NON_METRIC_ACTION_RE = /\bshare\b|공유/i;
// Point-classification limits, not scan-lifetime discovery caps.
const X_ACTION_MAX_ROOTS = 24;
const X_ACTION_MAX_BUTTONS = 32;
const X_ACTION_MAX_CANDIDATES = 48;
const X_ACTION_MAX_TEXT_LENGTH = 96;
const X_ACTION_MAX_ANCESTOR_DEPTH = 5;
const X_ACTION_DISCOVERY_NODES_PER_STEP = 32;
const X_ACTION_SCORE_THRESHOLD = 110;
const X_ACTION_MIN_SCORE_MARGIN = 12;
const xSemanticSurfaceByElement = new WeakMap();
const xNewsTextByElement = new WeakMap();

const X_ACTION_ORDER = Object.freeze({
  reply: 0,
  repost: 1,
  like: 2,
  view: 3,
  bookmark: 4,
});

function getXActionTestId(el) {
  if (!(el instanceof Element)) return '';
  const self = el.getAttribute?.('data-testid') || '';
  if (self) return self;
  return el.closest?.('[data-testid]')?.getAttribute?.('data-testid') || '';
}

function getXActionLabelText(el) {
  if (!(el instanceof Element)) return '';
  const direct = [
    el.getAttribute?.('aria-label'),
    el.getAttribute?.('title'),
  ].filter(Boolean).join(' ');
  if (direct.trim()) return direct;

  const testId = getXActionTestId(el);
  if (testId) return testId;

  const group = el.closest?.('[role="group"][aria-label]');
  return group?.getAttribute?.('aria-label') || '';
}

function resolveXActionType(el, labelText = getXActionLabelText(el)) {
  if (!(el instanceof Element)) return null;
  const testId = getXActionTestId(el).toLowerCase();
  if (testId === 'reply') return 'reply';
  if (testId === 'retweet') return 'repost';
  if (testId === 'like') return 'like';
  if (testId === 'bookmark' || testId === 'removebookmark') return 'bookmark';
  if (testId === 'viewcount') return 'view';
  if (el.matches?.('a[href*="/analytics"]')) return 'view';

  const label = normalizeSemanticMetricText(labelText);
  if (!label || X_NON_METRIC_ACTION_RE.test(label)) return null;
  if (X_REPLY_LABEL_RE.test(label)) return 'reply';
  if (X_REPOST_LABEL_RE.test(label)) return 'repost';
  if (X_LIKE_LABEL_RE.test(label)) return 'like';
  if (X_BOOKMARK_LABEL_RE.test(label)) return 'bookmark';
  if (X_VIEW_LABEL_RE.test(label)) return 'view';
  return null;
}

function createXActionProfile(ctx = {}) {
  const allowEngagement = ctx?.group === 'engagement' && ctx?.filterKeys?.includes('feedbackCounts');
  const allowExposure = ctx?.group === 'exposure' && ctx?.filterKeys?.includes('viewCounts');
  return Object.freeze({
    actionButtonSelector: X_ACTION_BUTTON_SELECTOR,
    actionRootSelector: X_ACTION_ROOT_SELECTOR,
    actionContainerSelector: X_ACTION_CONTAINER_SELECTOR,
    candidateSelector: X_ACTION_TEXT_CANDIDATE_SELECTOR,
    candidateTextPattern: X_NUMERIC_COUNTER_TEXT,
    graphicSelector: X_GRAPHIC_SELECTOR,
    limits: Object.freeze({
      maxRoots: X_ACTION_MAX_ROOTS,
      maxButtons: X_ACTION_MAX_BUTTONS,
      maxCandidateTextLength: X_ACTION_MAX_TEXT_LENGTH,
      maxCandidatesPerButton: X_ACTION_MAX_CANDIDATES,
      maxAncestorDepth: X_ACTION_MAX_ANCESTOR_DEPTH,
      threshold: X_ACTION_SCORE_THRESHOLD,
      minScoreMargin: X_ACTION_MIN_SCORE_MARGIN,
    }),
    actions: Object.freeze({
      reply: Object.freeze({ expectedOrder: X_ACTION_ORDER.reply }),
      repost: Object.freeze({ expectedOrder: X_ACTION_ORDER.repost }),
      like: Object.freeze({ expectedOrder: X_ACTION_ORDER.like }),
      view: Object.freeze({ expectedOrder: X_ACTION_ORDER.view }),
      bookmark: Object.freeze({ expectedOrder: X_ACTION_ORDER.bookmark }),
    }),
    getActionLabelText: (button) => getXActionLabelText(button),
    getCandidateText: (el) => getTrimmedText(el),
    resolveActionType: (button, labelText) => {
      const actionType = resolveXActionType(button, labelText);
      if (!actionType) return null;
      if (actionType === 'view') return allowExposure ? actionType : null;
      return allowEngagement ? actionType : null;
    },
    scoreCandidate: ({ button, candidate }) => {
      if (button?.contains?.(candidate)) return 0;
      const labelText = getXActionLabelText(button).replace(/\s+/g, '');
      const candidateText = getTrimmedText(candidate).replace(/\s+/g, '');
      return candidateText && labelText.includes(candidateText) ? 0 : -200;
    },
  });
}

function getTrimmedText(el) {
  return (el?.textContent || '').trim();
}

function parseXNewsMetadataText(value) {
  const text = normalizeSemanticMetricText(value);
  if (!text || !/[·•]/u.test(text)) return null;
  const segments = text.split(X_NEWS_METADATA_SEPARATOR_RE)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (
    segments.length < 2
    || !segments.some((segment) => (
      X_NEWS_TIME_SEGMENT_RE.test(segment)
      || X_NEWS_POST_COUNT_SEGMENT_RE.test(segment)
    ))
  ) {
    return null;
  }
  return segments;
}

function isXNewsMetadataElement(el, sourceText = null) {
  if (
    !(el instanceof Element)
    || el.children.length > 0
    || !el.closest?.(X_NEWS_ARTICLE_SELECTOR)
  ) {
    return false;
  }
  return !!parseXNewsMetadataText(
    sourceText ?? el.getAttribute(X_NEWS_METADATA_ORIGINAL_ATTR) ?? el.textContent
  );
}

function projectXNewsMetadataText(sourceText, filterKeys = []) {
  const segments = parseXNewsMetadataText(sourceText);
  if (!segments) return null;
  const hideTime = filterKeys.includes('timeSignals');
  const hidePostCount = filterKeys.includes('viewCounts');
  return segments.filter((segment) => (
    !(hideTime && X_NEWS_TIME_SEGMENT_RE.test(segment))
    && !(hidePostCount && X_NEWS_POST_COUNT_SEGMENT_RE.test(segment))
  )).join(' · ');
}

export function applyXNewsMetadataReplacement(el, filterKeys = []) {
  if (!(el instanceof Element)) return null;
  const currentText = el.textContent || '';
  let originalText = el.hasAttribute(X_NEWS_METADATA_ORIGINAL_ATTR)
    ? el.getAttribute(X_NEWS_METADATA_ORIGINAL_ATTR)
    : currentText;
  if (!isXNewsMetadataElement(el, originalText)) return null;

  const expectedCurrentText = projectXNewsMetadataText(originalText, filterKeys);
  let changed = false;
  if (
    el.hasAttribute(X_NEWS_METADATA_ORIGINAL_ATTR)
    && expectedCurrentText !== null
    && normalizeSemanticMetricText(currentText) !== expectedCurrentText
  ) {
    originalText = currentText;
    if (!isXNewsMetadataElement(el, originalText)) return null;
    changed = setAttribute(el, X_NEWS_METADATA_ORIGINAL_ATTR, originalText) || changed;
  } else if (!el.hasAttribute(X_NEWS_METADATA_ORIGINAL_ATTR)) {
    changed = setAttribute(el, X_NEWS_METADATA_ORIGINAL_ATTR, originalText) || changed;
  }

  const nextText = projectXNewsMetadataText(originalText, filterKeys);
  if (nextText === null) return null;
  if (el.hasAttribute(SOCIAL_METRIC_ATTRS.EXPOSURE)) {
    changed = removeAttribute(el, SOCIAL_METRIC_ATTRS.EXPOSURE) || changed;
  }
  if (el.textContent !== nextText) {
    changed = setText(el, nextText) || changed;
  }
  xNewsTextByElement.set(el, { originalText, appliedText: nextText });
  return {
    target: el,
    changed,
    originalText,
    nextText,
  };
}

export function restoreXNewsMetadataElement(el) {
  if (
    !(el instanceof Element)
    || !el.hasAttribute(X_NEWS_METADATA_ORIGINAL_ATTR)
  ) {
    return false;
  }
  const originalText = el.getAttribute(X_NEWS_METADATA_ORIGINAL_ATTR);
  const owned = xNewsTextByElement.get(el);
  let changed = false;
  if (owned && el.textContent === owned.appliedText && originalText !== null && el.textContent !== originalText) {
    changed = setText(el, originalText) || changed;
  }
  changed = removeAttribute(el, X_NEWS_METADATA_ORIGINAL_ATTR) || changed;
  xNewsTextByElement.delete(el);
  return changed;
}

export function getXMetricSourceText(el) {
  const owned = xNewsTextByElement.get(el);
  return owned && el.textContent === owned.appliedText ? owned.originalText : el.textContent;
}

export function restoreXNewsMetadata() {
  document.querySelectorAll(
    `[${X_NEWS_METADATA_ORIGINAL_ATTR}]`
  ).forEach((el) => {
    restoreXNewsMetadataElement(el);
  });
}

function elementHasGraphic(el) {
  if (!(el instanceof Element)) return false;
  return !!(el.matches?.(X_GRAPHIC_SELECTOR) || el.querySelector?.(X_GRAPHIC_SELECTOR));
}

function textMatchesXFilter(text, ctx, filterKey) {
  return !!ctx?.patternMap?.[filterKey]?.some((re) => re.test(text));
}

function textMatchesAnyXFilter(text, ctx) {
  return Array.isArray(ctx?.filterKeys)
    && ctx.filterKeys.some((filterKey) => textMatchesXFilter(text, ctx, filterKey));
}

function getClosestXViewMetricContainer(el) {
  if (!(el instanceof Element)) return null;
  return el.closest?.(X_VIEW_METRIC_CONTAINER_SELECTOR) || null;
}

function hasXNumericMetricText(root, excluded = null) {
  if (!(root instanceof Element)) return false;
  const text = getTrimmedText(root);
  if (root !== excluded && X_NUMERIC_COUNTER_TEXT.test(text)) return true;
  return Array.from(root.querySelectorAll?.(X_METRIC_LEAF_SELECTOR) || [])
    .some((node) => node !== excluded && X_NUMERIC_COUNTER_TEXT.test(getTrimmedText(node)));
}

function isXViewLabelNode(el) {
  return el instanceof Element && X_VIEW_LABEL_TEXT.test(getTrimmedText(el));
}

function hasXViewContainerSignal(container) {
  if (!(container instanceof Element)) return false;
  const label = container.getAttribute('aria-label') || '';
  return X_VIEW_ARIA_LABEL_TEXT.test(label) || container.matches?.(X_VIEW_METRIC_CONTAINER_SELECTOR);
}

function isXViewMetricTextNode(el, container) {
  if (!(el instanceof Element) || !hasXViewContainerSignal(container)) return false;
  const text = getTrimmedText(el);
  return X_NUMERIC_COUNTER_TEXT.test(text) || isXViewLabelNode(el);
}

function getXViewLabelNodes(container) {
  if (!(container instanceof Element)) return [];
  const labels = [];
  if (isXViewLabelNode(container)) labels.push(container);
  container.querySelectorAll?.(X_METRIC_LEAF_SELECTOR).forEach((node) => {
    if (isXViewLabelNode(node)) labels.push(node);
  });
  return Array.from(new Set(labels));
}

function getXMetricLeafTargets(el, ctx) {
  if (!(el instanceof Element)) return [];
  const descendants = Array.from(el.querySelectorAll?.(X_METRIC_LEAF_SELECTOR) || [])
    .filter((node) => (
      node !== el
      && !elementHasGraphic(node)
      && textMatchesAnyXFilter(getTrimmedText(node), ctx)
    ));

  if (descendants.length === 0) return [];
  return descendants.filter((node) => !descendants.some((other) => (
    other !== node && node.contains(other)
  )));
}

function getXViewMetricCompanions(el, ctx) {
  if (ctx?.group !== 'exposure' || !ctx?.filterKeys?.includes('viewCounts')) return [];
  const container = getClosestXViewMetricContainer(el);
  if (!container || !hasXNumericMetricText(container)) return [];
  return getXViewLabelNodes(container);
}

const X_AUDIENCE_LINK_SELECTOR =
  'a[href*="/following"], a[href*="/followers"], a[href*="/verified_followers"], a[href*="/creator-subscriptions/subscriptions"]';
const X_AUDIENCE_LABEL_TEXT =
  /^\s*(?:followers?|following|verified\s+followers?|팔로워|팔로우(?:\s*중)?|팔로잉|구독자|subscriptions?)\s*$/i;

function isXAudienceLinkElement(el) {
  if (!(el instanceof Element)) return false;
  return el.matches?.(X_AUDIENCE_LINK_SELECTOR) || el.closest?.(X_AUDIENCE_LINK_SELECTOR) !== null;
}

function isXAudienceLabelElement(el, text = getTrimmedText(el)) {
  if (!(el instanceof Element)) return false;
  if (!isXAudienceLinkElement(el)) return false;
  return X_AUDIENCE_LABEL_TEXT.test(text) && !X_NUMERIC_COUNTER_TEXT.test(text);
}

function resolveXAudienceCountInfo(el, ctx = {}) {
  if (!(el instanceof Element)) return null;
  if (!isXAudienceLinkElement(el)) return null;
  const text = getTrimmedText(el);
  if (isXAudienceLabelElement(el, text)) return null;
  if (X_NUMERIC_COUNTER_TEXT.test(text) || textMatchesXFilter(text, ctx, 'audienceCounts')) {
    return { group: 'engagement', key: 'audienceCounts' };
  }
  if (hasXNumericMetricText(el)) {
    return { group: 'engagement', key: 'audienceCounts' };
  }
  return null;
}

export function getXMetricInfo(el, ctx = {}) {
  if (!(el instanceof Element)) return null;
  if (
    ctx.filterKeys?.includes('audienceCounts')
    && el.matches(':is([data-testid="UserName"], [data-testid="User-Name"]) + div, [data-testid="primaryColumn"] [role="heading"] + div')
    && !el.closest('article, [data-testid="tweet"]')
    && X_NEWS_POST_COUNT_SEGMENT_RE.test(getTrimmedText(el))
  ) return { group: 'engagement', key: 'audienceCounts', kind: 'profile-post-total' };
  // Semantic provenance is diagnostic history, never proof of current meaning.
  const match = resolveXActionMetricEdge(el, createXActionProfile(ctx));
  if (match?.type) {
    return {
      group: match.type === 'view' ? 'exposure' : 'engagement',
      key: match.type === 'view' ? 'viewCounts' : 'feedbackCounts',
      actionType: match.type,
    };
  }
  if (ctx.group === 'engagement' && ctx.filterKeys?.includes('audienceCounts')) {
    const audienceInfo = resolveXAudienceCountInfo(el, ctx);
    if (audienceInfo) return audienceInfo;
  }
  if (X_NUMERIC_COUNTER_TEXT.test(getTrimmedText(el)) && requiresXActionMetricQualification(el, ctx)) return null;
  if (ctx.group !== 'exposure') return null;
  if (
    ctx.filterKeys?.includes('timeSignals')
    && el.matches?.('time[datetime]')
  ) {
    return { group: 'exposure', key: 'timeSignals' };
  }
  if (!ctx.filterKeys?.includes('viewCounts')) return null;
  const container = getClosestXViewMetricContainer(el);
  if (!container || !isXViewMetricTextNode(el, container)) return null;
  if (!hasXNumericMetricText(container, isXViewLabelNode(el) ? el : null)) return null;
  if (isXViewLabelNode(el) && !Array.from(container.querySelectorAll(X_METRIC_LEAF_SELECTOR))
    .some((candidate) => resolveXActionMetricEdge(candidate, createXActionProfile(ctx)))) return null;
  return { group: 'exposure', key: 'viewCounts' };
}

function resolveXActionMetricEdge(el, profile) {
  const match = resolveSemanticActionMetricMatchForElement(el, profile);
  if (!match) return null;
  // Both directions qualify the same current edge. A selector hit cannot
  // bypass the button's competing-number margin during apply/revalidation.
  const winner = resolveSemanticActionMetricCandidate(match.button, profile);
  return winner?.target === el && winner.type === match.type ? match : null;
}

export function requiresXActionMetricQualification(el, ctx = {}) {
  if (!(el instanceof Element)) return false;
  if (!ctx.filterKeys?.some((key) => key === 'feedbackCounts' || key === 'viewCounts')) return false;
  if (!X_NUMERIC_COUNTER_TEXT.test(getTrimmedText(el))) return false;
  return !!el.closest(':is([data-testid="reply"], [data-testid="retweet"], [data-testid="like"], [data-testid="bookmark"], [data-testid="removeBookmark"], [data-testid="viewCount"], a[href*="/analytics"], [aria-label*="bookmark" i])')
    || !!resolveSemanticActionMetricMatchForElement(el, createXActionProfile(ctx));
}

export function createXSemanticMetricCandidateCollectionPlan(ctx = {}) {
  const profile = createXActionProfile(ctx);
  const enabled = (ctx.group === 'engagement' && ctx.filterKeys?.includes('feedbackCounts'))
    || (ctx.group === 'exposure' && ctx.filterKeys?.includes('viewCounts'));
  // Keep broad residual content and collapse nested article/group roots before
  // discovery. No descendant query or semantic classification runs in plan creation.
  const scopes = enabled ? collapseMutationSourceNodes(Array.isArray(ctx.roots)
    ? ctx.roots
    : (typeof document !== 'undefined' ? [document.documentElement] : [])) : [];
  const seenButtons = new WeakSet();
  const seenCandidates = new Set();
  return Object.freeze({
    scopes: Object.freeze(scopes),
    createScopeCursor(scope) {
      // NodeIterator adjusts its reference when an in-flight descendant is removed.
      // A filtered TreeWalker would hide an unbounded search inside nextNode().
      const iterator = scope.ownerDocument.createNodeIterator(scope, NodeFilter.SHOW_ELEMENT);
      let done = false;
      return Object.freeze({
        next() {
          if (done || !scope.isConnected) {
            done = true;
            return { done: true, value: undefined };
          }
          for (let visited = 0; visited < X_ACTION_DISCOVERY_NODES_PER_STEP; visited += 1) {
            const element = iterator.nextNode();
            if (!element) {
              done = true;
              return { done: true, value: undefined };
            }
            if (!element.matches(X_ACTION_BUTTON_SELECTOR) || seenButtons.has(element)) continue;
            seenButtons.add(element);
            // At most one action verdict per step. Its existing ambiguity, text,
            // ancestor and nearby-button limits remain local semantic policy.
            const candidate = resolveSemanticActionMetricCandidate(element, profile)?.target;
            const match = candidate && resolveXActionMetricEdge(candidate, profile);
            if (!match?.type || seenCandidates.has(candidate)) return { done: false, value: [] };
            seenCandidates.add(candidate);
            xSemanticSurfaceByElement.set(candidate, SOCIAL_METRICS_SELECTOR_DRIFT_SURFACES.X_ACTION_GROUP);
            return { done: false, value: [candidate] };
          }
          return { done: false, value: [] };
        },
      });
    },
  });
}

export function collectXSemanticMetricCandidates(ctx = {}) {
  const plan = createXSemanticMetricCandidateCollectionPlan(ctx);
  const candidates = [];
  for (const scope of plan.scopes) {
    const cursor = plan.createScopeCursor(scope);
    for (let step = cursor.next(); !step.done; step = cursor.next()) candidates.push(...step.value);
  }
  return candidates;
}

export function getXSelectorDriftSurface(el) {
  if (!(el instanceof Element)) return null;
  return xSemanticSurfaceByElement.get(el) || null;
}

export function collectXSemanticMutationRoots(payload = {}) {
  return collapseMutationSourceNodes(collectMutationCausalRoots(payload).map((element) => {
    const closestScope = element.closest?.(X_ACTION_SCAN_SCOPE_SELECTOR);
    if (closestScope && !closestScope.matches('[data-testid="primaryColumn"]')) {
      return closestScope;
    }
    // An added broad source is walked by the scheduled cursor. A small change
    // inside primaryColumn stays local instead of enumerating the whole feed here.
    return element.closest?.(X_ACTION_CONTAINER_SELECTOR) || element;
  }));
}

export function resolveXMetricTargets(el, ctx = {}, match = {}) {
  if (!(el instanceof Element)) return [];
  const targets = [];

  if (match?.matchedKey === 'audienceCounts' || match?.xInfo?.key === 'audienceCounts') {
    if (match?.xInfo?.kind === 'profile-post-total') return [el];
    if (isXAudienceLabelElement(el)) {
      return [];
    }
    if (hasXNumericMetricText(el) && el.children.length > 0) {
      const leaves = getXMetricLeafTargets(el, ctx).filter((leaf) => (
        !isXAudienceLabelElement(leaf) && X_NUMERIC_COUNTER_TEXT.test(getTrimmedText(leaf))
      ));
      if (leaves.length > 0) {
        targets.push(...leaves);
      }
    } else if (X_NUMERIC_COUNTER_TEXT.test(getTrimmedText(el))) {
      targets.push(el);
    }
  } else if (elementHasGraphic(el)) {
    targets.push(...getXMetricLeafTargets(el, ctx));
  } else if (match?.xInfo) {
    targets.push(el);
  } else {
    targets.push(el);
  }

  if (match?.matchedKey === 'viewCounts' || match?.xInfo?.key === 'viewCounts') {
    targets.push(...getXViewMetricCompanions(el, ctx));
  }

  return Array.from(new Set(targets));
}

function getXMetadataMetricNodes(el) {
  if (!(el instanceof Element)) return [];
  const selector = `time[datetime], [${SOCIAL_METRIC_ATTRS.EXPOSURE}]`;
  const nodes = [];
  if (el.matches?.(selector)) nodes.push(el);
  el.querySelectorAll?.(selector).forEach((node) => nodes.push(node));
  return Array.from(new Set(nodes));
}

function isXMetadataSeparator(el) {
  if (!(el instanceof Element)) return false;
  return el.getAttribute('aria-hidden') === 'true'
    && X_METADATA_SEPARATOR_TEXT.test(el.textContent || '');
}

function hasSignificantNonMetricText(root, metricNodes) {
  if (!(root instanceof Element) || !Array.isArray(metricNodes) || metricNodes.length === 0) return true;
  if (typeof document === 'undefined' || typeof NodeFilter === 'undefined') return false;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const text = current.textContent || '';
    if (X_METADATA_SIGNIFICANT_TEXT.test(text)) {
      const owner = current.parentElement;
      const insideMetric = owner instanceof Element
        && metricNodes.some((node) => node === owner || node.contains(owner));
      if (!insideMetric) return true;
    }
    current = walker.nextNode();
  }
  return false;
}

function getXMetadataChildKind(child) {
  if (!(child instanceof Element)) return 'other';
  if (isXMetadataSeparator(child)) return 'separator';
  if (elementHasGraphic(child)) return 'other';
  const metricNodes = getXMetadataMetricNodes(child);
  if (metricNodes.length === 0) return 'other';
  return hasSignificantNonMetricText(child, metricNodes) ? 'other' : 'item';
}

function isPotentialXMetadataCluster(candidate) {
  if (!(candidate instanceof Element)) return false;
  const children = Array.from(candidate.children);
  if (candidate.hasAttribute(X_METADATA_CLUSTER_ATTR)
    || children.some((child) => child.hasAttribute(X_METADATA_ITEM_ATTR)
      || child.hasAttribute(X_METADATA_SEPARATOR_ATTR))) return true;
  if (children.length === 0 || children.length > X_METADATA_MAX_CHILDREN) return false;
  return children.some((child) => getXMetadataChildKind(child) === 'item');
}

export function collectXMetadataClusters(el) {
  if (!(el instanceof Element)) return [];
  const clusters = [];
  let current = el;
  for (let depth = 0; current && depth < X_METADATA_SCAN_MAX_DEPTH; depth += 1) {
    if (current === document.body || current === document.documentElement) break;
    if (isPotentialXMetadataCluster(current)) {
      clusters.push(current);
    }
    current = current.parentElement;
  }
  return clusters;
}

function collapseXMetadataNode(node, ownerAttribute) {
  if (!(node instanceof Element) || !node.style) return;
  if (!node.hasAttribute(ownerAttribute)) {
    const originalDisplay = node.style.getPropertyValue('display');
    const originalPriority = node.style.getPropertyPriority('display');
    if (originalPriority || originalDisplay === 'none') return;
    setAttribute(
      node,
      ownerAttribute,
      `${X_METADATA_ORIGINAL_DISPLAY_PREFIX}${originalDisplay}`,
    );
  }
  if (
    node.style.getPropertyValue('display') === 'none'
    && !node.style.getPropertyPriority('display')
  ) return;
  setStyleProperty(node, 'display', 'none');
}

function restoreXMetadataNode(node, ownerAttribute) {
  if (!(node instanceof Element) || !node.hasAttribute(ownerAttribute)) return;
  const ownerState = node.getAttribute(ownerAttribute) || '';
  if (!ownerState.startsWith(X_METADATA_ORIGINAL_DISPLAY_PREFIX)) {
    throw new Error(`X_METADATA_DISPLAY_OWNER_STATE_INVALID:${ownerAttribute}`);
  }
  const originalDisplay = ownerState.slice(X_METADATA_ORIGINAL_DISPLAY_PREFIX.length);
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

function syncXMetadataNodeDisplay(node, ownerAttribute, shouldHide) {
  if (shouldHide) {
    collapseXMetadataNode(node, ownerAttribute);
    return;
  }
  restoreXMetadataNode(node, ownerAttribute);
}

export function syncXMetadataCluster(cluster, helpers) {
  const { isMetricHidden } = helpers || {};
  if (!(cluster instanceof Element) || typeof isMetricHidden !== 'function') return;

  const children = Array.from(cluster.children);
  if (!children.some((child) => getXMetadataChildKind(child) === 'item')) {
    // The last metric may have lost its href/datetime or been removed entirely.
    // A former row is still an owner of display writes until those are restored.
    for (const child of children) {
      restoreXMetadataNode(child, X_METADATA_ITEM_ATTR);
      restoreXMetadataNode(child, X_METADATA_SEPARATOR_ATTR);
    }
    restoreXMetadataNode(cluster, X_METADATA_CLUSTER_ATTR);
    return;
  }

  const states = children.map((child) => {
    const kind = getXMetadataChildKind(child);
    if (kind === 'item') {
      const metricNodes = getXMetadataMetricNodes(child);
      const visible = metricNodes.some((node) => !isMetricHidden(node));
      syncXMetadataNodeDisplay(child, X_METADATA_ITEM_ATTR, !visible);
      return { child, kind, visible };
    }
    if (kind === 'separator') {
      return { child, kind, visible: false };
    }
    restoreXMetadataNode(child, X_METADATA_ITEM_ATTR);
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
    syncXMetadataNodeDisplay(
      state.child,
      X_METADATA_SEPARATOR_ATTR,
      shouldHide,
    );
  });

  const hasVisibleNonSeparator = states.some((state) => state.kind !== 'separator' && state.visible);
  syncXMetadataNodeDisplay(cluster, X_METADATA_CLUSTER_ATTR, !hasVisibleNonSeparator);
}

export function syncXMetadataForElement(el, helpers) {
  collectXMetadataClusters(el).forEach((cluster) => {
    syncXMetadataCluster(cluster, helpers);
  });
}

export function markXMetadataDirty(el, ctx) {
  if (!(el instanceof Element) || !ctx?.dirtyXMetadataClusters) return;
  collectXMetadataClusters(el).forEach((cluster) => {
    ctx.dirtyXMetadataClusters.add(cluster);
  });
}

export function flushDirtyXMetadataClusters(ctx, helpers) {
  if (!ctx?.dirtyXMetadataClusters || ctx.dirtyXMetadataClusters.size === 0) return;
  Array.from(ctx.dirtyXMetadataClusters).forEach((cluster) => syncXMetadataCluster(cluster, helpers));
  ctx.dirtyXMetadataClusters.clear();
}

export function restoreXMetadataClusters() {
  document.querySelectorAll(`[${X_METADATA_CLUSTER_ATTR}]`).forEach((cluster) => {
    restoreXMetadataNode(cluster, X_METADATA_CLUSTER_ATTR);
  });
  document.querySelectorAll(`[${X_METADATA_ITEM_ATTR}]`).forEach((item) => {
    restoreXMetadataNode(item, X_METADATA_ITEM_ATTR);
  });
  document.querySelectorAll(`[${X_METADATA_SEPARATOR_ATTR}]`).forEach((separator) => {
    restoreXMetadataNode(separator, X_METADATA_SEPARATOR_ATTR);
  });
}
