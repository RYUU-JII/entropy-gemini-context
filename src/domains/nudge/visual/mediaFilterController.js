import { isLikelyEmojiOrIcon } from '../../../lib/visualHeuristics.js';
import {
  buildMediaVisualFilterValue,
  VISUAL_FRICTION_CONTROLS,
} from '../../settings/config/index.js';
import { isShortFormUrl } from '../short-form/rules.js';
import { resolveSiteId } from '../targeting/siteIdentityCatalog.js';
import {
  createMainThreadSliceDeadline,
  yieldMainThreadContinuation,
} from '../../../platform/scheduling/mainThreadCooperativeScheduler.js';
import { validateMediaTargets } from './mediaTargetProfiles.js';

const SHORT_FORM_PORTRAIT_MIN_RATIO = 1.25;
const SHORT_FORM_PORTRAIT_MIN_LONGEST_EDGE = 220;
const SHORT_FORM_PORTRAIT_MIN_SHORTEST_EDGE = 96;
const SHORT_FORM_PORTRAIT_BLUR_MULTIPLIER = 1.8;
const SHORT_FORM_PORTRAIT_BLUR_EXTRA_PX = 0.175;
const SHORT_FORM_PORTRAIT_BLUR_MAX_PX = VISUAL_FRICTION_CONTROLS.blur.maximum;
const SHORT_FORM_PORTRAIT_CONTEXT_LINK_SELECTOR = 'a[href]';
const SHORT_FORM_CONTEXT_LINK_SCAN_LIMIT = 40;
const COMPOSITE_MEDIA_FILTER_DURATION_MS = 0;
const mediaTargetingPlanCache = new WeakMap();
const additiveCompositeSupportDocuments = new WeakSet();
const MEDIA_OBSERVER_BASE_ATTRIBUTES = Object.freeze([
  'alt',
  'aria-label',
  'aria-modal',
  'class',
  'data-friction-indicator',
  'data-intervention-indicator',
  'data-testid',
  'height',
  'href',
  'id',
  'poster',
  'role',
  'sizes',
  'src',
  'srcset',
  'style',
  'title',
  'width',
]);
const MEDIA_DESCENDANT_REVALIDATION_BASE_ATTRIBUTES = Object.freeze([
  'class',
  'id',
]);

function collectSelectorAttributeNames(selectorText, attributes) {
  const attributePattern = /\[\s*([^\s~|^$*=\]]+)/g;
  let match = attributePattern.exec(selectorText);
  while (match) {
    attributes.add(String(match[1]).toLowerCase());
    match = attributePattern.exec(selectorText);
  }
  return attributes;
}

function resolveMediaObserverAttributes(config) {
  const attributes = new Set(MEDIA_OBSERVER_BASE_ATTRIBUTES);
  const selectorText = [
    config.visualMediaCandidates,
    config.visualVideoTargets,
    config.visualMediaContexts,
    config.visualMediaOverlayExempt,
    config.visualShortFormContexts,
    config.visualShortFormDescendantContexts,
  ].filter(Boolean).join(', ');
  collectSelectorAttributeNames(selectorText, attributes);
  return Object.freeze(Array.from(attributes).sort());
}

function resolveMediaDescendantRevalidationAttributes(config) {
  const attributes = new Set(MEDIA_DESCENDANT_REVALIDATION_BASE_ATTRIBUTES);
  const selectorText = [
    config.visualMediaContexts,
    config.visualMediaOverlayExempt,
    config.visualShortFormContexts,
    config.visualShortFormDescendantContexts,
  ].filter(Boolean).join(', ');
  collectSelectorAttributeNames(selectorText, attributes);
  return Object.freeze(Array.from(attributes).sort());
}

function normalizeMediaExcludedKeywords(selectors) {
  return Object.freeze(selectors.visualMediaExcludeKeywords
    .map((keyword) => keyword.toLowerCase()));
}

export function resolveMediaTargetingPlan(selectors) {
  const cached = selectors && typeof selectors === 'object'
    ? mediaTargetingPlanCache.get(selectors)
    : null;
  if (cached) return cached;
  const config = validateMediaTargets(selectors);

  const candidateSelector = config.visualMediaCandidates;
  const videoSelector = config.visualVideoTargets;
  const plan = Object.freeze({
    candidateSelector,
    videoSelector,
    discoverySelector: Array.from(new Set([candidateSelector, videoSelector])).join(', '),
    contextSelector: config.visualMediaContexts,
    overlayExemptSelector: config.visualMediaOverlayExempt,
    excludedKeywords: normalizeMediaExcludedKeywords(config),
    minWidth: config.visualMediaMinWidth,
    minHeight: config.visualMediaMinHeight,
    minArea: config.visualMediaMinArea,
    minLongestEdge: config.visualMediaMinLongestEdge,
    smallSquareEdgeMax: config.visualMediaSmallSquareEdgeMax,
    wideAspectMinRatio: config.visualMediaWideAspectMinRatio,
    wideAspectMinArea: config.visualMediaWideAspectMinArea,
    wideAspectMinLongestEdge: config.visualMediaWideAspectMinLongestEdge,
    shortFormContextSelector: config.visualShortFormContexts,
    shortFormDescendantContextSelector: config.visualShortFormDescendantContexts,
    shortFormStructuralContextSelector: config.visualShortFormStructuralContexts,
    shortFormStructuralEvidenceSelector: config.visualShortFormStructuralEvidence,
    shortFormLinkSelector: SHORT_FORM_PORTRAIT_CONTEXT_LINK_SELECTOR,
    shortFormPortraitMinRatio: SHORT_FORM_PORTRAIT_MIN_RATIO,
    shortFormPortraitMinLongestEdge: SHORT_FORM_PORTRAIT_MIN_LONGEST_EDGE,
    shortFormPortraitMinShortestEdge: SHORT_FORM_PORTRAIT_MIN_SHORTEST_EDGE,
    observerAttributes: resolveMediaObserverAttributes(config),
    descendantRevalidationAttributes: resolveMediaDescendantRevalidationAttributes(config),
  });
  mediaTargetingPlanCache.set(selectors, plan);
  return plan;
}

export function resolveMediaCandidateSelector(selectors) {
  return resolveMediaTargetingPlan(selectors).candidateSelector;
}

export function resolveMediaContextSelector(selectors) {
  return resolveMediaTargetingPlan(selectors).contextSelector;
}

export function parseDimension(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

export function getElementDimensions(manager, el) {
  if (!el || !(el instanceof Element)) return { width: 0, height: 0 };
  const tagName = el.tagName?.toLowerCase() || '';

  let width = el.clientWidth || 0;
  let height = el.clientHeight || 0;

  if (tagName === 'img') {
    width = width || el.naturalWidth || 0;
    height = height || el.naturalHeight || 0;
  } else if (tagName === 'video') {
    width = width || el.videoWidth || 0;
    height = height || el.videoHeight || 0;
  }

  if (!width) width = manager._parseDimension(el.getAttribute('width'), 0);
  if (!height) height = manager._parseDimension(el.getAttribute('height'), 0);

  return { width, height };
}

export function hasKnownElementDimensions(manager, el) {
  const { width, height } = getElementDimensions(manager, el);
  return width > 0 && height > 0;
}

export function resolveMediaExcludedKeywords(selectors) {
  return resolveMediaTargetingPlan(selectors).excludedKeywords;
}

export function hasExcludedMediaKeyword(el, keywords) {
  if (!el || !(el instanceof Element) || !Array.isArray(keywords) || keywords.length === 0) return false;

  const className = typeof el.className === 'string'
    ? el.className
    : (el.className && typeof el.className.baseVal === 'string' ? el.className.baseVal : '');
  const context = [
    className,
    el.id || '',
    el.getAttribute('role') || '',
    el.getAttribute('aria-label') || '',
    el.getAttribute('title') || '',
    el.getAttribute('alt') || '',
    el.getAttribute('src') || '',
    el.getAttribute('data-testid') || '',
  ].join(' ').toLowerCase();

  return keywords.some((keyword) => context.includes(keyword));
}

export function passesContentMediaGate(manager, el, selectors) {
  if (!el || !(el instanceof Element)) return false;
  if (isLikelyEmojiOrIcon(el)) {
    manager._recordMediaFilterOutcome?.('emojiIconRejects');
    manager._cleanupUnknownDimensionMediaRecheck?.(el);
    return false;
  }

  const plan = resolveMediaTargetingPlan(selectors);
  const keywords = plan.excludedKeywords;
  if (manager._hasExcludedMediaKeyword(el, keywords)) {
    manager._recordMediaFilterOutcome?.('keywordRejects');
    manager._cleanupUnknownDimensionMediaRecheck?.(el);
    return false;
  }
  if (el.tagName?.toLowerCase() === 'video') {
    manager._recordMediaFilterOutcome?.('videoAccepts');
    return true;
  }

  const { width, height } = manager._getElementDimensions(el);
  if (width <= 0 || height <= 0) {
    manager._recordMediaFilterOutcome?.('unknownDimensionDeferrals');
    manager._queueUnknownDimensionMediaRecheck?.(el);
    return false;
  }
  manager._cleanupUnknownDimensionMediaRecheck?.(el);

  const minWidth = plan.minWidth;
  const minHeight = plan.minHeight;
  const minArea = plan.minArea;
  const minLongestEdge = plan.minLongestEdge;
  const smallSquareEdgeMax = plan.smallSquareEdgeMax;
  const longestEdge = Math.max(width, height);
  const shortestEdge = Math.min(width, height);
  const aspectRatio = shortestEdge > 0 ? (longestEdge / shortestEdge) : Infinity;
  const area = width * height;

  const wideAspectMinRatio = plan.wideAspectMinRatio;
  const wideAspectMinArea = plan.wideAspectMinArea;
  const wideAspectMinLongestEdge = plan.wideAspectMinLongestEdge;
  if (
    wideAspectMinRatio > 0 &&
    aspectRatio >= wideAspectMinRatio &&
    area >= wideAspectMinArea &&
    longestEdge >= wideAspectMinLongestEdge
  ) {
    manager._recordMediaFilterOutcome?.('mediaAccepts');
    return true;
  }

  if (area < minArea) {
    manager._recordMediaFilterOutcome?.('sizeRejects');
    return false;
  }
  if (width < minWidth && height < minHeight) {
    manager._recordMediaFilterOutcome?.('sizeRejects');
    return false;
  }
  if (longestEdge < minLongestEdge) {
    manager._recordMediaFilterOutcome?.('sizeRejects');
    return false;
  }
  if (longestEdge <= smallSquareEdgeMax && aspectRatio <= 1.25) {
    manager._recordMediaFilterOutcome?.('sizeRejects');
    return false;
  }

  manager._recordMediaFilterOutcome?.('mediaAccepts');
  return true;
}

export function buildMediaFilter(filters) {
  return buildMediaVisualFilterValue(filters);
}

function isNativeShortFormHost(hostname) {
  return resolveSiteId(hostname) === 'tiktok';
}

function contextHasShortFormLink(root, currentHref) {
  if (!root || !(root instanceof Element) || typeof root.querySelectorAll !== 'function') return false;
  const links = root.querySelectorAll(SHORT_FORM_PORTRAIT_CONTEXT_LINK_SELECTOR);
  let scanned = 0;
  for (const link of links) {
    if (scanned >= SHORT_FORM_CONTEXT_LINK_SCAN_LIMIT) break;
    scanned += 1;
    const href = link.getAttribute('href') || link.href || '';
    if (href && isShortFormUrl(href, { baseUrl: currentHref })) return true;
  }
  return false;
}

function parseBlurPx(mediaFilter) {
  const match = String(mediaFilter || '').match(/blur\(\s*(-?\d+(?:\.\d+)?)px\s*\)/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function formatBlurPx(value) {
  const rounded = Math.round(value * 100) / 100;
  const normalized = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
  return `${normalized}px`;
}

function amplifyShortFormPortraitBlurPx(basePx) {
  if (!Number.isFinite(basePx) || basePx <= 0) return basePx;
  return Math.min(
    SHORT_FORM_PORTRAIT_BLUR_MAX_PX,
    (basePx * SHORT_FORM_PORTRAIT_BLUR_MULTIPLIER) + SHORT_FORM_PORTRAIT_BLUR_EXTRA_PX,
  );
}

function replaceBlurPx(mediaFilter, blurPx) {
  const nextValue = formatBlurPx(blurPx);
  return String(mediaFilter || '').replace(/blur\(\s*-?\d+(?:\.\d+)?px\s*\)/i, `blur(${nextValue})`);
}

function isPortraitMediaElement(manager, el, selectors) {
  const { width, height } = manager._getElementDimensions(el);
  if (width <= 0 || height <= 0) {
    manager._queueUnknownDimensionMediaRecheck?.(el);
    return false;
  }

  const longestEdge = Math.max(width, height);
  const shortestEdge = Math.min(width, height);
  const plan = resolveMediaTargetingPlan(selectors);
  const minRatio = plan.shortFormPortraitMinRatio;
  const minLongestEdge = plan.shortFormPortraitMinLongestEdge;
  const minShortestEdge = plan.shortFormPortraitMinShortestEdge;

  return height > width
    && height / width >= minRatio
    && longestEdge >= minLongestEdge
    && shortestEdge >= minShortestEdge;
}

function isShortFormMediaContext(manager, el, selectors) {
  const currentHref = window.location?.href || '';
  if (isShortFormUrl(currentHref)) return true;

  if (isNativeShortFormHost(window.location?.hostname || '')) return true;

  const plan = resolveMediaTargetingPlan(selectors);
  const contextSelector = plan.shortFormContextSelector;
  if (
    contextSelector
    && (
      manager._safeMatches(el, contextSelector) === true
      || manager._safeClosest(el, contextSelector) instanceof Element
    )
  ) {
    return true;
  }

  const descendantContextSelector = plan.shortFormDescendantContextSelector;
  const descendantContext = descendantContextSelector
    ? manager._safeClosest(el, descendantContextSelector)
    : null;
  if (descendantContext && contextHasShortFormLink(descendantContext, currentHref)) {
    return true;
  }

  const link = manager._safeClosest(el, SHORT_FORM_PORTRAIT_CONTEXT_LINK_SELECTOR);
  const href = link?.getAttribute('href');
  return !!href && isShortFormUrl(href, { baseUrl: currentHref });
}

export function shouldAmplifyShortFormPortraitMedia(manager, el, selectors) {
  if (!el || !(el instanceof Element)) return false;
  if (!isShortFormMediaContext(manager, el, selectors)) return false;
  return isPortraitMediaElement(manager, el, selectors);
}

export function resolveMediaFilterForElement(manager, el, selectors, mediaFilter) {
  if (!mediaFilter) return '';
  const blurPx = parseBlurPx(mediaFilter);
  if (!Number.isFinite(blurPx) || blurPx <= 0) return mediaFilter;
  if (!shouldAmplifyShortFormPortraitMedia(manager, el, selectors)) return mediaFilter;

  return replaceBlurPx(mediaFilter, amplifyShortFormPortraitBlurPx(blurPx));
}

export function shouldApplyToMediaElement(manager, el, selectors, { discovered = false } = {}) {
  if (!el || !(el instanceof Element) || !el.isConnected) return false;
  const plan = resolveMediaTargetingPlan(selectors);
  if (plan.overlayExemptSelector) {
    const exemptRoot = manager._safeClosest(el, plan.overlayExemptSelector);
    if (exemptRoot === undefined || exemptRoot instanceof Element) {
      manager._recordMediaFilterOutcome?.('overlayExemptRejects');
      return false;
    }
  }
  if (plan.videoSelector && manager._safeMatches(el, plan.videoSelector) === true) {
    manager._recordMediaFilterOutcome?.('candidateEvaluations');
    const accepted = manager._passesContentMediaGate(el, selectors);
    manager._recordMediaFilterOutcome?.(
      accepted ? 'acceptedEvaluations' : 'contentGateRejects',
    );
    return accepted;
  }

  if (!discovered && manager._safeMatches(el, plan.candidateSelector) !== true) return false;
  manager._recordMediaFilterOutcome?.('candidateEvaluations');

  if (plan.contextSelector && !(manager._safeClosest(el, plan.contextSelector) instanceof Element)) {
    manager._recordMediaFilterOutcome?.('contextRejects');
    return false;
  }

  const accepted = manager._passesContentMediaGate(el, selectors);
  manager._recordMediaFilterOutcome?.(
    accepted ? 'acceptedEvaluations' : 'contentGateRejects',
  );
  return accepted;
}

export function collectMediaTargets(manager, root, selectors) {
  const targets = new Set();
  const rootEl = root instanceof Element ? root : null;
  if (!rootEl) return targets;

  const add = (el, discovered = false) => {
    if (manager._shouldApplyToMediaElement(el, selectors, { discovered })) {
      targets.add(el);
    }
  };

  add(rootEl);
  const plan = resolveMediaTargetingPlan(selectors);
  const mediaNodes = manager._safeQueryAll(rootEl, plan.discoverySelector);
  if (mediaNodes) mediaNodes.forEach((el) => add(el, true));

  manager._recordMediaFilterTargets?.(targets);

  return targets;
}

// Ownership is independent of selector membership: a target can lose its role,
// source or context and still need its effect restored. Walk only the causal
// light-DOM subtree, including non-candidates, without a public marker or a
// document-wide owned-target search. Every element is a cooperative work unit.
export function* iterateMediaOwnershipScope(manager, root) {
  if (!(root instanceof Element)) return;
  const iterator = root.ownerDocument.createNodeIterator(root, NodeFilter.SHOW_ELEMENT);
  let element;
  while ((element = iterator.nextNode())) {
    manager._recordMediaFilterOutcome?.('ownershipElementVisits');
    yield element;
  }
}

function* iterateMediaRevalidationScopes(manager, roots) {
  if (manager._mediaFilterElements.size === 0) return;
  const rootSet = new Set(roots);
  for (const root of rootSet) {
    let ancestor = root.parentElement;
    while (ancestor && !rootSet.has(ancestor)) ancestor = ancestor.parentElement;
    if (ancestor) continue;
    // A document-wide configuration reconciliation already owns the full set;
    // do not replace that target pass with a walk of all page metadata.
    if (root === root.ownerDocument.body || root === root.ownerDocument.documentElement) {
      yield* manager._mediaFilterElements;
    } else {
      yield* iterateMediaOwnershipScope(manager, root);
    }
  }
}

export function filterRelevantMediaMutationRoots(
  manager, roots, selectors, { reconcileExistingTargets = true } = {},
) {
  if (!Array.isArray(roots) || roots.length === 0) return [];
  const rootList = roots.filter((root) => root instanceof Element && root.isConnected);
  if (rootList.length === 0) return [];

  const plan = resolveMediaTargetingPlan(selectors);
  const unresolvedRoots = new Set(rootList);
  const relevantRoots = new Set();
  const markRelevant = (root) => {
    relevantRoots.add(root);
    unresolvedRoots.delete(root);
  };

  // A root can be an owned target even after losing candidate membership.
  // This lookup does not enumerate the document's unrelated owned media.
  for (const root of rootList) {
    if (manager._mediaFilterElements.has(root)) markRelevant(root);
  }

  for (const root of unresolvedRoots) {
    if (
      manager._safeMatches(root, plan.discoverySelector) === true
      || manager._safeQuery(root, plan.discoverySelector) instanceof Element
    ) {
      markRelevant(root);
      continue;
    }
    // A negative discovery query does not prove there is no restoration work.
    // Restrict that ownership check to this root rather than all page media.
    if (reconcileExistingTargets && manager._mediaFilterElements.size > 0) {
      for (const element of iterateMediaOwnershipScope(manager, root)) {
        if (!manager._mediaFilterElements.has(element)) continue;
        manager._recordMediaFilterOutcome?.('trackedTargetVisits');
        markRelevant(root);
        break;
      }
    }
  }

  return rootList.filter((root) => relevantRoots.has(root));
}

function createCompositeMediaFilterKeyframes(mediaFilter) {
  return [
    { offset: 0, filter: mediaFilter, composite: 'add' },
    { offset: 1, filter: mediaFilter, composite: 'add' },
  ];
}

function requireCompositeMediaFilterAnimation(animation, el, { verifyAdditive = false } = {}) {
  if (!animation || typeof animation.cancel !== 'function') {
    throw new Error('VISUAL_MEDIA_COMPOSITE_ANIMATION_INVALID');
  }
  const effect = animation.effect;
  if (!effect || effect.target !== el) {
    throw new Error('VISUAL_MEDIA_COMPOSITE_EFFECT_INVALID');
  }
  if (!verifyAdditive) return animation;
  if (typeof effect.getKeyframes !== 'function') {
    throw new Error('VISUAL_MEDIA_COMPOSITE_KEYFRAME_INSPECTION_UNAVAILABLE');
  }
  const keyframes = effect.getKeyframes();
  const additive = Array.isArray(keyframes)
    && keyframes.length >= 2
    && keyframes.every((keyframe) => keyframe.composite === 'add');
  if (!additive) {
    throw new Error('VISUAL_MEDIA_ADDITIVE_COMPOSITION_UNAVAILABLE');
  }
  return animation;
}

function createCompositeMediaFilterAnimation(el, mediaFilter) {
  if (typeof el?.animate !== 'function') {
    throw new Error('VISUAL_MEDIA_COMPOSITE_ANIMATION_UNAVAILABLE');
  }
  let animation = null;
  const documentRef = el.ownerDocument;
  const verifyAdditive = !documentRef || !additiveCompositeSupportDocuments.has(documentRef);
  try {
    animation = el.animate(
      createCompositeMediaFilterKeyframes(mediaFilter),
      {
        duration: COMPOSITE_MEDIA_FILTER_DURATION_MS,
        fill: 'both',
      },
    );
    requireCompositeMediaFilterAnimation(animation, el, { verifyAdditive });
    if (verifyAdditive && documentRef) additiveCompositeSupportDocuments.add(documentRef);
    return animation;
  } catch (error) {
    let cleanupError = null;
    try {
      animation?.cancel?.();
    } catch (caughtCleanupError) {
      cleanupError = caughtCleanupError;
    }
    const wrapped = new Error('VISUAL_MEDIA_COMPOSITE_EFFECT_CREATE_FAILED', { cause: error });
    if (cleanupError) wrapped.cleanupError = cleanupError;
    throw wrapped;
  }
}

function updateCompositeMediaFilterAnimation(animation, el, mediaFilter) {
  const effect = animation?.effect;
  if (!effect || effect.target !== el || typeof effect.setKeyframes !== 'function') {
    throw new Error('VISUAL_MEDIA_COMPOSITE_EFFECT_UPDATE_UNAVAILABLE');
  }
  const previousKeyframes = effect.getKeyframes();
  try {
    effect.setKeyframes(createCompositeMediaFilterKeyframes(mediaFilter));
    requireCompositeMediaFilterAnimation(animation, el);
  } catch (error) {
    try {
      effect.setKeyframes(previousKeyframes);
    } catch (rollbackError) {
      if (error && typeof error === 'object') error.rollbackError = rollbackError;
    }
    throw error;
  }
}

export function applyMediaFilterToElement(manager, el, mediaFilter, overlayExemptSelector) {
  const plan = prepareMediaFilterApply(manager, el, mediaFilter, overlayExemptSelector);
  if (plan) commitMediaFilterApply(manager, plan);
}

function prepareMediaFilterApply(manager, el, mediaFilter, overlayExemptSelector) {
  if (!el || !(el instanceof Element)) {
    manager._recordMediaFilterOutcome?.('noops');
    manager._recordMediaFilterOutcome?.('invalidTargetNoops');
    return null;
  }
  if (overlayExemptSelector && manager._safeClosest(el, overlayExemptSelector) !== null) {
    manager._recordMediaFilterOutcome?.('noops');
    manager._recordMediaFilterOutcome?.('exemptTargetNoops');
    return null;
  }
  if (!mediaFilter) {
    manager._recordMediaFilterOutcome?.('noops');
    manager._recordMediaFilterOutcome?.('emptyFilterNoops');
    return null;
  }

  const existing = manager._mediaFilterCache.get(el);
  if (
    existing?.managedFilter === mediaFilter
    && existing.active === true
  ) {
    manager._recordMediaFilterOutcome?.('noops');
    manager._recordMediaFilterOutcome?.('alreadyAppliedNoops');
    return null;
  }

  return {
    el,
    existing,
    mediaFilter,
    kind: !existing
      ? 'create'
      : existing.active !== true
        ? 'recreate'
        : 'update',
  };
}

function commitMediaFilterApply(manager, plan) {
  const {
    el,
    existing,
    mediaFilter,
    kind,
  } = plan;
  if (kind === 'update') {
    manager._runMediaFilterMeasuredPhase(
      'compositeEffectUpdateMs',
      () => updateCompositeMediaFilterAnimation(existing.animation, el, mediaFilter),
    );
    existing.managedFilter = mediaFilter;
    manager._recordMediaFilterOutcome?.('compositeEffectUpdates');
  } else {
    if (kind === 'recreate') {
      manager._runMediaFilterMeasuredPhase(
        'compositeEffectCancelMs',
        () => existing.animation.cancel(),
      );
      existing.active = false;
    }
    const animation = manager._runMediaFilterMeasuredPhase(
      'compositeEffectCreateMs',
      () => createCompositeMediaFilterAnimation(el, mediaFilter),
    );
    const cacheEntry = {
      animation,
      managedFilter: mediaFilter,
      active: true,
    };
    animation.oncancel = () => {
      cacheEntry.active = false;
    };
    manager._mediaFilterCache.set(el, cacheEntry);
    manager._recordMediaFilterOutcome?.(
      kind === 'recreate' ? 'compositeEffectRecreates' : 'compositeEffectCreates',
    );
  }

  manager._mediaFilterElements.add(el);
  manager._recordMediaFilterOutcome?.('writes');
}

function prepareMediaFilterRestore(manager, el) {
  const cached = manager._mediaFilterCache.get(el);
  if (!cached) return null;
  return { el, cached };
}

function commitMediaFilterRestore(manager, plan) {
  const { el, cached } = plan;
  manager._runMediaFilterMeasuredPhase(
    'compositeEffectCancelMs',
    () => cached.animation.cancel(),
  );
  cached.active = false;
  manager._mediaFilterCache.delete(el);
  manager._mediaFilterElements.delete(el);
  manager._recordMediaFilterOutcome?.('compositeEffectCancels');
  manager._recordMediaFilterOutcome?.('restores');
}

export function applyMediaFiltersToRoots(manager, roots, selectors, mediaFilter) {
  const rootList = Array.from(new Set(roots || []))
    .filter((root) => root instanceof Element);
  if (rootList.length === 0) return;
  const rootSet = new Set(rootList);
  const targetsByRoot = new Map(
    rootList.map((root) => [root, manager._collectMediaTargets(root, selectors)]),
  );
  const nextTargets = new Set();
  for (const targets of targetsByRoot.values()) {
    targets.forEach((target) => nextTargets.add(target));
  }

  const findOwningRoot = (el) => {
    let current = el;
    while (current instanceof Element) {
      if (rootSet.has(current)) return current;
      current = current.parentElement;
    }
    return null;
  };
  const restorePlans = [];
  const plannedRestores = new Set();
  for (const el of iterateMediaRevalidationScopes(manager, rootList)) {
    if (!manager._mediaFilterElements.has(el)) continue;
    manager._recordMediaFilterOutcome?.('trackedTargetVisits');
    const root = findOwningRoot(el);
    if (!root || nextTargets.has(el) || plannedRestores.has(el)) continue;
    plannedRestores.add(el);
    const plan = prepareMediaFilterRestore(manager, el);
    if (plan) restorePlans.push(plan);
  }

  const applyPlans = [];
  const appliedElements = new Set();
  for (const targets of targetsByRoot.values()) {
    for (const el of targets) {
      if (appliedElements.has(el)) continue;
      appliedElements.add(el);
      const plan = prepareMediaFilterApply(
        manager,
        el,
        manager._resolveMediaFilterForElement(el, selectors, mediaFilter),
        selectors?.visualMediaOverlayExempt,
      );
      if (plan) applyPlans.push(plan);
    }
  }

  // Resolve target membership for every dirty root before changing the owned
  // effect set, so overlapping roots cannot cancel and recreate the same effect.
  restorePlans.forEach((plan) => commitMediaFilterRestore(manager, plan));
  applyPlans.forEach((plan) => commitMediaFilterApply(manager, plan));
}

async function runCooperativeMediaSequence(items, visit, schedulingState) {
  // Awaiting even an already-completed sequence lets a newer update run.
  if (!schedulingState.isCurrent()) return false;
  let processedInSlice = schedulingState.processedInSlice;
  for (const item of items) {
    if (!schedulingState.deadline.hasTime(processedInSlice)) {
      const debugOperation = schedulingState.manager?._pauseMediaFilterDebugOperation?.();
      try {
        await yieldMainThreadContinuation();
      } finally {
        schedulingState.manager?._resumeMediaFilterDebugOperation?.(debugOperation);
      }
      if (!schedulingState.isCurrent()) return false;
      schedulingState.deadline.reset();
      processedInSlice = 0;
    }
    visit(item);
    processedInSlice += 1;
  }
  schedulingState.processedInSlice = processedInSlice;
  return true;
}

export async function applyMediaFiltersToRootsCooperatively(
  manager,
  roots,
  selectors,
  mediaFilter,
  { isCurrent = () => true, reconcileExistingTargets = true } = {},
) {
  if (typeof isCurrent !== 'function') {
    throw new Error('VISUAL_MEDIA_COOPERATIVE_CURRENT_GUARD_REQUIRED');
  }
  if (!isCurrent()) return Object.freeze({ completed: false, superseded: true });

  const debugOperation = manager._pauseMediaFilterDebugOperation?.();
  try {
    await yieldMainThreadContinuation();
  } finally {
    manager._resumeMediaFilterDebugOperation?.(debugOperation);
  }
  if (!isCurrent()) return Object.freeze({ completed: false, superseded: true });

  const schedulingState = {
    deadline: createMainThreadSliceDeadline(),
    isCurrent,
    manager,
    processedInSlice: 0,
  };
  const rootList = Array.from(new Set(roots || []))
    .filter((root) => root instanceof Element);
  if (rootList.length === 0) {
    return Object.freeze({ completed: true, superseded: false });
  }

  const rootSet = new Set(rootList);
  const targetsByRoot = new Map();
  const nextTargets = new Set();
  for (const root of rootList) {
    const targets = new Set();
    const addCandidate = (el) => {
      if (manager._shouldApplyToMediaElement(el, selectors)) {
        targets.add(el);
        nextTargets.add(el);
      }
    };

    addCandidate(root);
    schedulingState.processedInSlice += 1;
    const plan = resolveMediaTargetingPlan(selectors);
    const mediaNodes = manager._safeQueryAll(root, plan.discoverySelector);
    if (mediaNodes) {
      const completed = await runCooperativeMediaSequence(
        mediaNodes,
        // This static query result may outlive a yield. Only synchronous
        // collectMediaTargets can reuse discovery as membership proof.
        addCandidate,
        schedulingState,
      );
      if (!completed || !isCurrent()) return Object.freeze({ completed: false, superseded: true });
    }
    manager._recordMediaFilterTargets?.(targets);
    targetsByRoot.set(root, targets);
  }

  const findOwningRoot = (el) => {
    let current = el;
    while (current instanceof Element) {
      if (rootSet.has(current)) return current;
      current = current.parentElement;
    }
    return null;
  };
  const restorePlans = [];
  const plannedRestores = new Set();
  const restorePlanningCompleted = await runCooperativeMediaSequence(
    reconcileExistingTargets ? iterateMediaRevalidationScopes(manager, rootList) : [],
    (el) => {
      if (!manager._mediaFilterElements.has(el)) return;
      manager._recordMediaFilterOutcome?.('trackedTargetVisits');
      const root = findOwningRoot(el);
      if (!root || nextTargets.has(el) || plannedRestores.has(el)) return;
      plannedRestores.add(el);
      restorePlans.push(el);
    },
    schedulingState,
  );
  if (!restorePlanningCompleted || !isCurrent()) {
    return Object.freeze({ completed: false, superseded: true });
  }

  const applyPlans = [];
  const appliedElements = new Set();
  for (const targets of targetsByRoot.values()) {
    const applyPlanningCompleted = await runCooperativeMediaSequence(
      targets,
      (el) => {
        if (appliedElements.has(el)) return;
        appliedElements.add(el);
        applyPlans.push(el);
      },
      schedulingState,
    );
    if (!applyPlanningCompleted || !isCurrent()) {
      return Object.freeze({ completed: false, superseded: true });
    }
  }

  const reconcileTarget = (el) => {
    // Both lists can outlive DOM changes. Reconcile from live membership and
    // cache ownership: a regained candidate also needs the current filter.
    if (!manager._shouldApplyToMediaElement(el, selectors)) {
      const restorePlan = prepareMediaFilterRestore(manager, el);
      if (restorePlan) commitMediaFilterRestore(manager, restorePlan);
      return;
    }
    const currentPlan = prepareMediaFilterApply(
      manager,
      el,
      manager._resolveMediaFilterForElement(el, selectors, mediaFilter),
      selectors?.visualMediaOverlayExempt,
    );
    if (currentPlan) commitMediaFilterApply(manager, currentPlan);
  };
  const restoreCompleted = await runCooperativeMediaSequence(restorePlans, reconcileTarget, schedulingState);
  if (!restoreCompleted || !isCurrent()) return Object.freeze({ completed: false, superseded: true });

  const applyCompleted = await runCooperativeMediaSequence(applyPlans, reconcileTarget, schedulingState);
  if (!applyCompleted || !isCurrent()) {
    return Object.freeze({ completed: false, superseded: true });
  }

  return Object.freeze({ completed: true, superseded: false });
}

export function applyMediaFiltersToRoot(manager, root, selectors, mediaFilter) {
  applyMediaFiltersToRoots(manager, [root], selectors, mediaFilter);
}

export function cleanupMediaFilters(manager) {
  for (const el of Array.from(manager._mediaFilterElements)) {
    manager._recordMediaFilterOutcome?.('trackedTargetVisits');
    if (!el || !el.isConnected) {
      manager._restoreMediaFilter(el);
    }
  }
}

export function restoreMediaFilter(manager, el) {
  const plan = prepareMediaFilterRestore(manager, el);
  if (plan) commitMediaFilterRestore(manager, plan);
}

export function restoreAllMediaFilters(manager) {
  for (const el of Array.from(manager._mediaFilterElements)) {
    if (el) manager._restoreMediaFilter(el);
  }
  manager._mediaFilterElements.clear();
  manager._mediaFilterCache = new WeakMap();
}
