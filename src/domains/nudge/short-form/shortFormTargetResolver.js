import { isShortFormUrl } from './rules.js';
import { compileSelectorAttributeDependencyPlan } from '../../../lib/dom/selectorAttributeDependencies.js';
import {
  TIKTOK_SHORT_FORM_MUTATION_ATTRIBUTES,
  resolveTikTokShortFormActionIntents,
} from './platforms/tiktokShortFormResolver.js';
import {
  YOUTUBE_SHORT_FORM_MUTATION_ATTRIBUTES,
  collectYouTubeShortFormLabelMutationRoots,
  collectYouTubeShortFormShelfMutationRoots,
  normalizeYouTubeShortFormMutationRoots,
  resolveYouTubeShortFormActionIntents,
} from './platforms/youtubeShortFormResolver.js';

const REMOVAL_CONTAINER_SELECTOR = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-reel-item-renderer',
  'ytd-reel-video-renderer',
  'article',
  '[role="listitem"]',
  'li',
].join(',');
const NON_PRUNABLE_CONTAINER_TAGS = new Set([
  'HTML',
  'BODY',
  'HEAD',
  'MAIN',
  'NAV',
  'HEADER',
  'FOOTER',
]);
const SHORTFORM_EXCLUDED_CONTEXT_SELECTOR = [
  'ytd-comments',
  'ytd-comments-header-renderer',
  'ytd-comment-thread-renderer',
  'ytd-comment-view-model',
  'ytd-comment-renderer',
  'ytd-comment-replies-renderer',
  '#comments',
  '#comment-teaser',
  '#comment-input',
].join(', ');
const SHORTFORM_CONTAINER_MAX_DEPTH = 7;
const SHORTFORM_CONTAINER_MAX_LINKS = 16;
const SHORTFORM_CONTAINER_MAX_NODES = 220;
const SELECTOR_FAILURE = Symbol('short_form_target_selector_failure');

export function resolveShortFormObserverAttributes(rule) {
  if (!rule) return Object.freeze([]);
  const semanticAttributes = rule.id === 'youtube'
    ? YOUTUBE_SHORT_FORM_MUTATION_ATTRIBUTES
    : rule.id === 'tiktok'
      ? TIKTOK_SHORT_FORM_MUTATION_ATTRIBUTES
      : [];
  return compileSelectorAttributeDependencyPlan({
    selectors: rule.hideSelectors,
    semanticAttributes,
  }).observedAttributes;
}

function isElement(value) {
  return typeof Element !== 'undefined' && value instanceof Element;
}

function createDomReader({ onSelectorFailure, ruleId }) {
  const report = (error, details) => {
    if (typeof onSelectorFailure === 'function') {
      onSelectorFailure(error, { ruleId: ruleId || null, ...details });
    }
    return SELECTOR_FAILURE;
  };
  return Object.freeze({
    isElement,
    isFailure: (value) => value === SELECTOR_FAILURE,
    closest(element, selector, details = {}) {
      if (!isElement(element) || !selector || typeof element.closest !== 'function') return null;
      try {
        return element.closest(selector);
      } catch (error) {
        return report(error, { operation: 'closest', selector, ...details });
      }
    },
    matches(element, selector, details = {}) {
      if (!isElement(element) || !selector || typeof element.matches !== 'function') return false;
      try {
        return element.matches(selector);
      } catch (error) {
        return report(error, { operation: 'matches', selector, ...details });
      }
    },
    queryOne(root, selector, details = {}) {
      if (!isElement(root) || !selector || typeof root.querySelector !== 'function') return null;
      try {
        return root.querySelector(selector);
      } catch (error) {
        return report(error, { operation: 'querySelector', selector, ...details });
      }
    },
    queryAll(root, selector, details = {}) {
      if (!isElement(root) || !selector || typeof root.querySelectorAll !== 'function') return [];
      try {
        return Array.from(root.querySelectorAll(selector));
      } catch (error) {
        return report(error, { operation: 'querySelectorAll', selector, ...details });
      }
    },
  });
}

function collapseConnectedMutationRoots(nodes = []) {
  const candidates = Array.from(new Set(Array.from(nodes || []).filter((node) => (
    isElement(node) && node.isConnected
  ))));
  if (candidates.length <= 1) return candidates;
  const candidateSet = new Set(candidates);
  return candidates.filter((node) => {
    let ancestor = node.parentElement;
    while (ancestor) {
      if (candidateSet.has(ancestor)) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  });
}

function resolveUrl(rawUrl, baseUrl) {
  try {
    return new URL(rawUrl, baseUrl).href;
  } catch (_) {
    return null;
  }
}

function isShortFormAnchor(anchor, currentUrl) {
  if (!isElement(anchor) || String(anchor.tagName || '').toUpperCase() !== 'A') return false;
  const href = anchor.getAttribute('href') || anchor.href || '';
  return isShortFormUrl(href, { baseUrl: currentUrl });
}

function collectBoundedContainerLinks(container) {
  const walker = container.ownerDocument.createTreeWalker(container, 1);
  const links = [];
  let visited = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (++visited > SHORTFORM_CONTAINER_MAX_NODES) return null;
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      links.push(node);
      if (links.length > SHORTFORM_CONTAINER_MAX_LINKS) return null;
    }
  }
  return links;
}

function findShortFormOnlyContainer(anchor, dom, currentUrl) {
  if (!isShortFormAnchor(anchor, currentUrl)) return null;
  const anchorExcluded = dom.closest(anchor, SHORTFORM_EXCLUDED_CONTEXT_SELECTOR, {
    reason: 'shortform_container',
  });
  if (dom.isFailure(anchorExcluded)) return anchorExcluded;
  if (anchorExcluded) return null;
  let current = anchor.parentElement;
  let depth = 0;
  while (current && depth < SHORTFORM_CONTAINER_MAX_DEPTH) {
    const indicator = dom.closest(current, '[data-friction-indicator="1"]', {
      reason: 'shortform_container',
    });
    if (dom.isFailure(indicator)) return indicator;
    if (indicator) return null;
    const excluded = dom.closest(current, SHORTFORM_EXCLUDED_CONTEXT_SELECTOR, {
      reason: 'shortform_container',
    });
    if (dom.isFailure(excluded)) return excluded;
    if (excluded) return null;
    if (NON_PRUNABLE_CONTAINER_TAGS.has(String(current.tagName || '').toUpperCase())) break;
    const links = collectBoundedContainerLinks(current);
    if (links && links.length > 0) {
      let shortCount = 0;
      let nonShortCount = 0;
      for (const link of links) {
        if (isShortFormAnchor(link, currentUrl)) shortCount += 1;
        else nonShortCount += 1;
        if (nonShortCount > 0) break;
      }
      if (shortCount > 0 && nonShortCount === 0) return current;
    }
    current = current.parentElement;
    depth += 1;
  }
  return null;
}

function resolveGenericRemovalTarget(element, dom, currentUrl) {
  if (!isElement(element)) return null;
  const indicator = dom.closest(element, '[data-friction-indicator="1"]', {
    reason: 'resolve_removal_target',
  });
  if (dom.isFailure(indicator)) return indicator;
  if (indicator) return null;
  const excluded = dom.closest(element, SHORTFORM_EXCLUDED_CONTEXT_SELECTOR, {
    reason: 'resolve_removal_target',
  });
  if (dom.isFailure(excluded)) return excluded;
  if (excluded) return null;
  if (String(element.tagName || '').toUpperCase() !== 'A') return element;
  const shortFormOnlyContainer = findShortFormOnlyContainer(element, dom, currentUrl);
  if (dom.isFailure(shortFormOnlyContainer)) return shortFormOnlyContainer;
  if (shortFormOnlyContainer) return shortFormOnlyContainer;
  const container = dom.closest(element, REMOVAL_CONTAINER_SELECTOR, {
    reason: 'resolve_removal_target',
  });
  if (dom.isFailure(container)) return container;
  if (!container) return element;
  const containerIndicator = dom.closest(container, '[data-friction-indicator="1"]', {
    reason: 'resolve_removal_target',
  });
  if (dom.isFailure(containerIndicator)) return containerIndicator;
  return containerIndicator ? element : container;
}

function resolveInstagramFeedArticle(candidate, dom) {
  const article = dom.closest(candidate, 'article', {
    reason: 'instagram_feed_article',
  });
  if (dom.isFailure(article) || !article) return article;
  const video = dom.queryOne(article, 'video', {
    reason: 'instagram_feed_article',
  });
  if (dom.isFailure(video)) return video;
  return video ? article : null;
}

function resolveGenericSelectorIntents({ root, selectors, rule, dom, currentUrl }) {
  const matches = new Set();
  const querySelectors = rule?.id === 'instagram' ? [selectors.join(', ')] : selectors;
  for (const selector of querySelectors || []) {
    if (!selector) continue;
    const rootMatches = dom.matches(root, selector);
    if (dom.isFailure(rootMatches)) return [];
    if (rootMatches) matches.add(root);
    const descendants = dom.queryAll(root, selector);
    if (dom.isFailure(descendants)) return [];
    descendants.forEach((element) => matches.add(element));
  }
  const intents = [];
  const targets = new Set();
  const instagramArticles = new Map();
  for (const candidate of matches) {
    let instagramFeedArticle = null;
    if (rule?.id === 'instagram') {
      const article = dom.closest(candidate, 'article', { reason: 'instagram_feed_article' });
      if (dom.isFailure(article)) return [];
      if (article) {
        if (!instagramArticles.has(article)) {
          instagramArticles.set(article, resolveInstagramFeedArticle(article, dom));
        }
        instagramFeedArticle = instagramArticles.get(article);
        if (dom.isFailure(instagramFeedArticle)) return [];
        // Instagram hydrates the Reel link before its video. A partial article
        // waits for confirmed media before changing the feed slot's geometry.
        if (!instagramFeedArticle) continue;
      }
    }
    if (dom.isFailure(instagramFeedArticle)) return [];
    const target = instagramFeedArticle
      || resolveGenericRemovalTarget(candidate, dom, currentUrl);
    if (dom.isFailure(target)) return [];
    if (!target || targets.has(target)) continue;
    targets.add(target);
    intents.push(Object.freeze({
      type: 'prune',
      target,
      candidate,
      reason: instagramFeedArticle
        ? 'instagram_reel_feed_article'
        : 'selector_match',
      pruneModeOverride: instagramFeedArticle ? 'collapse' : null,
    }));
  }
  if (rule?.id === 'instagram' || rule?.id === 'facebook' || rule?.id === 'tiktok') {
    const reconciliationReason = `${rule.id}_reconcile`;
    const hiddenSelector = '[data-friction-shortform-hidden="1"]';
    const hidden = dom.queryAll(root, hiddenSelector, { reason: reconciliationReason });
    if (dom.isFailure(hidden)) return [];
    const owner = dom.closest(root, hiddenSelector, { reason: reconciliationReason });
    if (dom.isFailure(owner)) return [];
    if (owner) hidden.push(owner);
    for (const target of new Set(hidden)) {
      if (targets.has(target)) continue;
      const selfShort = dom.matches(target, selectors.join(', '), { reason: reconciliationReason });
      const shortLink = dom.queryOne(target, selectors.join(', '), { reason: reconciliationReason });
      if (dom.isFailure(selfShort) || dom.isFailure(shortLink)) return [];
      if (!selfShort && !shortLink) intents.push(Object.freeze({
        type: 'restore', target, reason: rule.id === 'tiktok'
          ? 'tiktok_navigation_owner_no_longer_short_form'
          : `${rule.id}_owner_no_longer_reel`,
        // Reversible selector hides are owned by this manager instance.
        // A public marker or another actuation reason cannot authorize restore.
        ...(rule.id === 'instagram' ? {} : { expectedPruneReason: 'selector_match' }),
      }));
    }
  }
  return intents;
}

export function normalizeShortFormMutationRoots(nodes = [], {
  rule = null,
  currentUrl = '',
  mutationPayload = null,
  readOwnedHideReason = null,
  onSelectorFailure = null,
} = {}) {
  const sources = [...nodes];
  // Removed evidence is no longer connected. Its live parent must reconcile
  // an existing hide, even when no new positive candidate was inserted.
  for (const mutation of mutationPayload?.mutations || []) {
    if (mutation.type === 'childList' && mutation.removedNodes?.length > 0) {
      const relevantRemoval = Array.from(mutation.removedNodes).some((node) => (
        isElement(node) && (node.matches('a, video, [data-friction-shortform-hidden], ytm-shorts-lockup-view-model-v2, ytm-shorts-lockup-view-model')
          || node.querySelector('a, video, [data-friction-shortform-hidden], ytm-shorts-lockup-view-model-v2, ytm-shorts-lockup-view-model'))
      ));
      if (relevantRemoval && isElement(mutation.target)) {
        sources.push(mutation.target.closest('[data-friction-shortform-hidden="1"], article, ytd-shelf-renderer')
          || mutation.target);
      }
    }
  }
  const roots = collapseConnectedMutationRoots(sources);
  if (rule?.id === 'instagram') {
    const dom = createDomReader({ onSelectorFailure, ruleId: rule.id });
    const promoted = [];
    for (const root of roots) {
      const relevantSelector = 'a, video, article, [data-friction-shortform-hidden="1"]';
      const selfRelevant = dom.matches(root, relevantSelector, { reason: 'instagram_mutation_owner' });
      const child = dom.queryOne(root, relevantSelector, { reason: 'instagram_mutation_owner' });
      if (dom.isFailure(selfRelevant) || dom.isFailure(child)) return Object.freeze([]);
      if (!selfRelevant && !child) continue;
      const article = dom.closest(root, 'article', { reason: 'instagram_mutation_owner' });
      const hidden = dom.closest(root, '[data-friction-shortform-hidden="1"]', { reason: 'instagram_mutation_owner' });
      if (dom.isFailure(article) || dom.isFailure(hidden)) return Object.freeze([]);
      promoted.push(article || hidden || root);
    }
    return Object.freeze(collapseConnectedMutationRoots(promoted));
  }
  if (rule?.id !== 'youtube') return Object.freeze(roots);
  const dom = createDomReader({ onSelectorFailure, ruleId: rule.id });
  const shelfRoots = collectYouTubeShortFormShelfMutationRoots({ mutationPayload, dom });
  if (dom.isFailure(shelfRoots)) return Object.freeze([]);
  return normalizeYouTubeShortFormMutationRoots({
    roots: collapseConnectedMutationRoots([
      ...roots,
      ...shelfRoots,
      ...collectYouTubeShortFormLabelMutationRoots({ nodes, mutationPayload, dom }),
    ]),
    dom,
    currentUrl,
    normalizeRoots: collapseConnectedMutationRoots,
    mutationPayload,
    readOwnedHideReason,
  });
}

export function resolveShortFormNavigationActionIntent(target, {
  currentUrl,
  rule = null,
  onSelectorFailure = null,
} = {}) {
  const dom = createDomReader({ onSelectorFailure, ruleId: rule?.id || null });
  const anchor = dom.closest(target, 'a[href]', { reason: 'navigation_click' });
  if (dom.isFailure(anchor) || !anchor) return null;
  const url = resolveUrl(anchor.getAttribute('href'), currentUrl);
  if (!url || !isShortFormUrl(url, { baseUrl: currentUrl })) return null;
  return Object.freeze({
    type: 'block_navigation',
    target: anchor,
    reason: 'short_form_navigation',
    url,
  });
}

export function resolveShortFormTargetActionIntents({
  root,
  selectors,
  rule,
  currentUrl,
  pathname,
  documentElement,
  readOwnedHideReason = null,
  onSelectorFailure = null,
} = {}) {
  if (!isElement(root) || !Array.isArray(selectors) || selectors.length === 0 || !rule) {
    return Object.freeze([]);
  }
  const dom = createDomReader({ onSelectorFailure, ruleId: rule.id });
  const genericIntents = resolveGenericSelectorIntents({
    root,
    selectors,
    rule,
    dom,
    currentUrl,
  });
  let platformIntents = [];
  if (rule.id === 'youtube') {
    platformIntents = resolveYouTubeShortFormActionIntents({ root, dom, currentUrl, readOwnedHideReason });
  } else if (rule.id === 'tiktok') {
    platformIntents = resolveTikTokShortFormActionIntents({
      root,
      pathname,
      documentElement,
      dom,
    });
  }
  return Object.freeze([...genericIntents, ...platformIntents]);
}
