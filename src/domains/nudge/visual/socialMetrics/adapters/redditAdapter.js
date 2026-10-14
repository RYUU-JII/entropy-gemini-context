import {
  addUniqueCapped,
  resolveSemanticActionMetricCandidate,
  normalizeSemanticMetricText,
} from '../core/semanticActionMetricMatcher.js';
import {
  removeAttribute,
  removeStyleProperty,
  setAttribute,
  setStyleProperty,
} from '../../FastStyleEngine.js';
import {
  isManagedRedditShadowRoot,
} from './redditShadowMetricsOwner.js';
import { createMetricCollectionPlan, collectMetricCollectionPlan } from '../core/metricCollectionCursor.js';
import { collapseMutationSourceNodes, collectMutationCausalRoots } from '../core/dirtyRootReducer.js';

const REDDIT_SCAN_SCOPE_SELECTOR =
  ':is(shreddit-post, shreddit-comment, reddit-pdp-right-rail-post, [data-testid="post-container"], [data-testid="action-row"], article)';
const REDDIT_ACTION_BUTTON_SELECTOR =
  ':is(button[data-action-bar-action], a[data-action-bar-action], button[upvote], button[downvote], button[aria-label], a[aria-label], [role="button"][aria-label], [role="link"][aria-label])';
const REDDIT_ACTION_ROOT_SELECTOR =
  ':is([data-testid="action-row"], .rpl-vote-button-group, [data-post-click-location="vote"], shreddit-post, shreddit-comment, article)';
const REDDIT_ACTION_CONTAINER_SELECTOR =
  ':is([data-testid="action-row"], .rpl-vote-button-group, [data-post-click-location="vote"], [data-post-click-location="comments-button"], [data-action-bar-action], a, button, span)';
const REDDIT_ACTION_CANDIDATE_SELECTOR = 'faceplate-number';
const REDDIT_TIME_SELECTOR = 'faceplate-timeago time';
const REDDIT_SHADOW_SCAN_SCOPE_SELECTOR =
  ':is(rpl-action-bar, [data-testid="action-row"])';
const REDDIT_SEPARATOR_COLLAPSED_ATTR = 'data-friction-reddit-time-separator-collapsed';
const REDDIT_SEPARATOR_ORIGINAL_DISPLAY_ATTR = 'data-friction-reddit-time-separator-original-display';
const REDDIT_SEPARATOR_ORIGINAL_VISIBILITY_ATTR = 'data-friction-reddit-time-separator-original-visibility';
const REDDIT_NUMERIC_COUNTER_TEXT = /^\s*[\d,.]+(?:\.\d+)?\s*(?:K|M|B|천|만|억)?\s*$/i;
const REDDIT_TIME_TEXT_RE =
  /^\s*(?:now|\d+\s*(?:s|m|h|d|w|mo|y)|\d+\s*(?:seconds?|secs?|minutes?|mins?|hours?|days?|weeks?|months?|years?)\s+ago|\d+\s*(?:초|분|시간|일|주|개월|년)\s*전)\s*$/i;
const REDDIT_SEPARATOR_TEXT_RE = /^[\s•·]+$/;
const REDDIT_MAX_ROOTS = 24;
const REDDIT_MAX_CANDIDATES = 64;
const REDDIT_MAX_BUTTONS = 32;
const REDDIT_MAX_TEXT_LENGTH = 48;
const REDDIT_MAX_ANCESTOR_DEPTH = 5;
const REDDIT_SCORE_THRESHOLD = 110;

const REDDIT_ACTION_ORDER = Object.freeze({
  score: 0,
  comment: 2,
});

function hasActiveFilter(ctx, filterKey) {
  return Array.isArray(ctx?.filterKeys) && ctx.filterKeys.includes(filterKey);
}

function getTrimmedText(el) {
  const text = normalizeSemanticMetricText(el?.textContent);
  if (text) return text;
  return normalizeSemanticMetricText(el?.getAttribute?.('number'));
}

function getRedditActionLabelText(button) {
  if (!(button instanceof Element)) return '';
  return [
    button.getAttribute?.('data-action-bar-action'),
    button.getAttribute?.('data-post-click-location'),
    button.getAttribute?.('name'),
    button.getAttribute?.('aria-label'),
    button.getAttribute?.('title'),
    button.textContent,
  ].filter(Boolean).join(' ');
}

function resolveRedditActionType(button, labelText = getRedditActionLabelText(button)) {
  if (!(button instanceof Element)) return null;
  const action = String(button.getAttribute?.('data-action-bar-action') || '').toLowerCase();
  if (button.hasAttribute?.('upvote')) return 'score';
  if (button.hasAttribute?.('downvote')) return null;
  if (action === 'upvote') return 'score';
  if (action === 'comments') return 'comment';
  if (action === 'downvote' || action === 'share' || action === 'save' || action === 'award') return null;

  const label = normalizeSemanticMetricText(labelText).toLowerCase();
  if (!label || /\bdownvote\b|\bshare\b|\bsave\b|\baward\b|\breport\b/.test(label)) return null;
  if (/\bupvote\b|\bvote\b/.test(label)) return 'score';
  if (/\bcomments?\b|댓글/.test(label)) return 'comment';
  return null;
}

function createRedditActionProfile(ctx = {}) {
  const allowFeedback = ctx?.group === 'engagement' && hasActiveFilter(ctx, 'feedbackCounts');
  return Object.freeze({
    actionButtonSelector: REDDIT_ACTION_BUTTON_SELECTOR,
    actionRootSelector: REDDIT_ACTION_ROOT_SELECTOR,
    actionContainerSelector: REDDIT_ACTION_CONTAINER_SELECTOR,
    candidateSelector: REDDIT_ACTION_CANDIDATE_SELECTOR,
    candidateTextPattern: REDDIT_NUMERIC_COUNTER_TEXT,
    limits: Object.freeze({
      maxRoots: REDDIT_MAX_ROOTS,
      maxButtons: REDDIT_MAX_BUTTONS,
      maxCandidateTextLength: REDDIT_MAX_TEXT_LENGTH,
      maxCandidatesPerButton: REDDIT_MAX_CANDIDATES,
      maxAncestorDepth: REDDIT_MAX_ANCESTOR_DEPTH,
      threshold: REDDIT_SCORE_THRESHOLD,
    }),
    actions: Object.freeze({
      score: Object.freeze({ expectedOrder: REDDIT_ACTION_ORDER.score }),
      comment: Object.freeze({ expectedOrder: REDDIT_ACTION_ORDER.comment, scoreBonus: 8 }),
    }),
    getActionLabelText: (button) => getRedditActionLabelText(button),
    getCandidateText: (el) => getTrimmedText(el),
    resolveActionType: (button, labelText) => (allowFeedback
      ? resolveRedditActionType(button, labelText)
      : null),
    scoreCandidate: ({ actionType, candidate }) => {
      if (actionType === 'score' && candidate?.closest?.('[data-post-click-location="vote"], .rpl-vote-button-group')) {
        return 28;
      }
      if (actionType === 'comment' && candidate?.closest?.('[data-action-bar-action="comments"], [data-post-click-location="comments-button"]')) {
        return 28;
      }
      return 0;
    },
  });
}

function isRedditTimeCandidate(el) {
  if (!(el instanceof Element)) return false;
  if (!el.closest?.('faceplate-timeago, shreddit-post, shreddit-comment, article')) return false;
  const text = getTrimmedText(el);
  if (!text) return el.hasAttribute('datetime');
  return REDDIT_TIME_TEXT_RE.test(text);
}

function getRedditTimeElement(el) {
  if (!(el instanceof Element)) return null;
  if (el.matches?.(REDDIT_TIME_SELECTOR)) return el;
  const owner = el.closest?.('faceplate-timeago');
  if (owner instanceof Element) {
    const time = owner.querySelector?.('time');
    if (time instanceof Element) return time;
  }
  const nested = el.querySelector?.(REDDIT_TIME_SELECTOR);
  return nested instanceof Element ? nested : null;
}

function getRedditTimeBoundaryOwners(time) {
  if (!(time instanceof Element)) return [];
  const owners = [];
  const timeago = time.closest?.('faceplate-timeago');
  if (timeago instanceof Element) addUniqueCapped(owners, timeago, 4);
  const link = timeago?.parentElement?.matches?.('a') ? timeago.parentElement : null;
  if (link instanceof Element) addUniqueCapped(owners, link, 4);
  return owners;
}

function isRedditTimeSeparator(el) {
  return el instanceof Element
    && el.getAttribute?.('aria-hidden') === 'true'
    && REDDIT_SEPARATOR_TEXT_RE.test(el.textContent || '')
    && !el.querySelector?.('a, button, faceplate-timeago, faceplate-number, svg, img');
}

function getRedditTimeSeparators(time) {
  const separators = [];
  getRedditTimeBoundaryOwners(time).forEach((owner) => {
    [owner.previousElementSibling, owner.nextElementSibling].forEach((candidate) => {
      if (isRedditTimeSeparator(candidate)) {
        addUniqueCapped(separators, candidate, 4);
      }
    });
  });
  return separators;
}

function collapseRedditTimeSeparator(separator) {
  if (!(separator instanceof Element)) return;
  if (!separator.hasAttribute(REDDIT_SEPARATOR_COLLAPSED_ATTR)) {
    setAttribute(separator, REDDIT_SEPARATOR_COLLAPSED_ATTR, '1');
    setAttribute(separator, REDDIT_SEPARATOR_ORIGINAL_DISPLAY_ATTR, separator.style?.display || '');
    setAttribute(separator, REDDIT_SEPARATOR_ORIGINAL_VISIBILITY_ATTR, separator.style?.visibility || '');
  }
  setStyleProperty(separator, 'display', 'none');
  setStyleProperty(separator, 'visibility', 'hidden');
}

function restoreRedditTimeSeparator(separator) {
  if (!(separator instanceof Element) || !separator.hasAttribute(REDDIT_SEPARATOR_COLLAPSED_ATTR)) return;
  const originalDisplay = separator.getAttribute(REDDIT_SEPARATOR_ORIGINAL_DISPLAY_ATTR) || '';
  const originalVisibility = separator.getAttribute(REDDIT_SEPARATOR_ORIGINAL_VISIBILITY_ATTR) || '';
  if (originalDisplay) setStyleProperty(separator, 'display', originalDisplay);
  else removeStyleProperty(separator, 'display');
  if (originalVisibility) setStyleProperty(separator, 'visibility', originalVisibility);
  else removeStyleProperty(separator, 'visibility');
  removeAttribute(separator, REDDIT_SEPARATOR_ORIGINAL_DISPLAY_ATTR);
  removeAttribute(separator, REDDIT_SEPARATOR_ORIGINAL_VISIBILITY_ATTR);
  removeAttribute(separator, REDDIT_SEPARATOR_COLLAPSED_ATTR);
}

export function syncRedditTimeSeparatorsForElement(el, helpers = {}) {
  const time = getRedditTimeElement(el);
  if (!(time instanceof Element)) return;
  const isHidden = typeof helpers.isMetricHidden === 'function' && helpers.isMetricHidden(time);
  getRedditTimeSeparators(time).forEach((separator) => {
    if (isHidden) {
      collapseRedditTimeSeparator(separator);
    } else {
      restoreRedditTimeSeparator(separator);
    }
  });
}

export function markRedditTimeSeparatorDirty(el, ctx) {
  if (!(el instanceof Element) || !ctx?.dirtyRedditTimeNodes) return;
  const time = getRedditTimeElement(el);
  if (time instanceof Element) ctx.dirtyRedditTimeNodes.add(time);
}

export function flushDirtyRedditTimeSeparators(ctx, helpers = {}) {
  if (!ctx?.dirtyRedditTimeNodes || ctx.dirtyRedditTimeNodes.size === 0) return;
  Array.from(ctx.dirtyRedditTimeNodes).forEach((time) => syncRedditTimeSeparatorsForElement(time, helpers));
  ctx.dirtyRedditTimeNodes.clear();
}

export function restoreRedditTimeSeparators() {
  document.querySelectorAll(`[${REDDIT_SEPARATOR_COLLAPSED_ATTR}]`).forEach((separator) => {
    restoreRedditTimeSeparator(separator);
  });
}

export function createRedditSemanticMetricCandidateCollectionPlan(ctx = {}) {
  const profile = createRedditActionProfile(ctx);
  return createMetricCollectionPlan({
    roots: ctx.roots,
    getOwnedSubtree(element) {
      return element.matches('shreddit-post') && isManagedRedditShadowRoot(element.shadowRoot)
        ? element.shadowRoot : null;
    },
    resolveElement(element) {
      const owner = element.closest(REDDIT_SCAN_SCOPE_SELECTOR);
      const managedShadowOwner = isManagedRedditShadowRoot(element.getRootNode())
        && element.closest(REDDIT_SHADOW_SCAN_SCOPE_SELECTOR);
      if (!owner && !managedShadowOwner) return null;
      if (ctx.group === 'engagement' && hasActiveFilter(ctx, 'feedbackCounts')
        && element.matches(REDDIT_ACTION_BUTTON_SELECTOR)) {
        const target = resolveSemanticActionMetricCandidate(element, profile)?.target;
        return target ? [target] : [];
      }
      if (ctx.group === 'exposure' && hasActiveFilter(ctx, 'timeSignals')
        && element.matches(REDDIT_TIME_SELECTOR)) return isRedditTimeCandidate(element) ? [element] : [];
      return null;
    },
  });
}

export function collectRedditSemanticMetricCandidates(ctx = {}) {
  return collectMetricCollectionPlan(createRedditSemanticMetricCandidateCollectionPlan(ctx));
}

export function collectRedditSemanticMutationRoots(payload = {}) {
  return collapseMutationSourceNodes(collectMutationCausalRoots(payload).map((element) => (
    element.closest(REDDIT_SCAN_SCOPE_SELECTOR) || element
  )));
}
