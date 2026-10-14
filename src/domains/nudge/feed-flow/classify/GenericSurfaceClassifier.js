import {
  isElement,
  readViewportHeight,
  readViewportWidth,
} from '../resolve/ActiveScrollContainerResolver.js';
import {
  GENERIC_FEED_ITEM_SELECTOR,
  getGenericFeedItemTextLength,
  hasGenericFeedItemMedia,
} from '../discovery/genericFeedItemFeatures.js';
import { isGenericFeedItemCandidate, resolveFeedItemBoundaries } from '../discovery/feedItemBoundaries.js';

const MAX_CANDIDATES = 48;
const MAX_SELECTOR_MATCHES = MAX_CANDIDATES * 2;
const MAX_VISITED_ELEMENTS = 2400;
const DOCUMENT_ROOT_SELECTOR = ':is(main, article, [role="main"])';
const GENERIC_DOMINANT_SELECTOR = ':is(video, article, section, main, [role="article"], [role="main"], [role="listitem"], li, figure, div)';

function reportSelectorFailure(onSelectorFailure, phase, error, details = {}) {
  if (typeof onSelectorFailure !== 'function') return;
  onSelectorFailure(phase, error, {
    phase,
    error: String(error?.message || error || 'GENERIC_SURFACE_SELECTOR_FAILURE'),
    ...details,
  });
}

function safeCollectMatches(
  root,
  selector,
  onSelectorFailure = null,
  { limit = MAX_SELECTOR_MATCHES, maxVisited = MAX_VISITED_ELEMENTS } = {},
) {
  if (!root || !selector) return [];
  try {
    const documentRef = root.nodeType === 9 ? root : root.ownerDocument;
    const startNode = root.nodeType === 9 ? root.documentElement : root;
    if (!documentRef?.createTreeWalker || !startNode) {
      throw new Error('GENERIC_SURFACE_TREE_WALKER_UNAVAILABLE');
    }
    // Validate once before walking so malformed profile selectors fail loudly
    // even when the current document has no elements.
    startNode.matches(selector);
    const walker = documentRef.createTreeWalker(startNode, 1);
    const matches = [];
    let node = startNode;
    let visited = 0;
    while (node && visited < maxVisited && matches.length < limit) {
      visited += 1;
      if (node.matches?.(selector)) matches.push(node);
      node = walker.nextNode();
    }
    return matches;
  } catch (error) {
    reportSelectorFailure(onSelectorFailure, 'generic_surface_query_selector', error, { selector });
    return null;
  }
}

function getElementRect(node) {
  if (!isElement(node) || typeof node.getBoundingClientRect !== 'function') return null;
  const rect = node.getBoundingClientRect();
  if (!rect) return null;
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return rect;
}

function computeVisibleAreaRatio(rect, viewportWidth, viewportHeight) {
  const visibleLeft = Math.max(0, rect.left);
  const visibleTop = Math.max(0, rect.top);
  const visibleRight = Math.min(viewportWidth, rect.right);
  const visibleBottom = Math.min(viewportHeight, rect.bottom);
  const visibleWidth = Math.max(0, visibleRight - visibleLeft);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const visibleArea = visibleWidth * visibleHeight;
  return visibleArea > 0 ? visibleArea / Math.max(1, viewportWidth * viewportHeight) : 0;
}

function filterRepeatedItems(candidates = []) {
  return resolveFeedItemBoundaries(candidates.filter(isGenericFeedItemCandidate))
    .slice(0, MAX_CANDIDATES);
}

function findDominantCandidate(candidates, viewportWidth, viewportHeight) {
  let winner = null;
  let bestCoverage = 0;

  candidates.forEach((candidate) => {
    const rect = getElementRect(candidate);
    if (!rect) return;
    const coverage = computeVisibleAreaRatio(rect, viewportWidth, viewportHeight);
    if (coverage <= bestCoverage) return;
    bestCoverage = coverage;
    winner = {
      node: candidate,
      coverage,
      hasRichMedia: hasGenericFeedItemMedia(candidate)
        || candidate.matches?.('video') === true,
      textLength: getGenericFeedItemTextLength(candidate),
    };
  });

  return winner;
}

function buildDocumentSignals(documentRef, onSelectorFailure = null) {
  const roots = safeCollectMatches(
    documentRef,
    DOCUMENT_ROOT_SELECTOR,
    onSelectorFailure,
    { limit: 6 },
  ) || [];
  const signals = roots.map((root) => ({
    node: root,
    textLength: getGenericFeedItemTextLength(root),
    imageCount: root.querySelectorAll?.('img, picture img').length || 0,
    videoCount: root.querySelectorAll?.('video').length || 0,
  }));
  return signals.sort((left, right) => right.textLength - left.textLength);
}

export class GenericSurfaceClassifier {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    onSelectorFailure = null,
  } = {}) {
    if (onSelectorFailure !== null && typeof onSelectorFailure !== 'function') {
      throw new Error('FEED_SELECTOR_FAILURE_REPORTER_INVALID');
    }
    this._window = windowRef;
    this._document = documentRef;
    this._onSelectorFailure = onSelectorFailure;
  }

  classify({ feedDiscoveryItemSelector } = {}) {
    if (
      typeof feedDiscoveryItemSelector !== 'string'
      || !feedDiscoveryItemSelector
      || feedDiscoveryItemSelector !== feedDiscoveryItemSelector.trim()
    ) {
      throw new Error('FEED_DISCOVERY_ITEM_SELECTOR_INVALID');
    }
    if (!this._document) {
      return {
        surfaceMode: 'unknown',
        contentClass: 'unknown',
        confidence: 0,
        repeatedItemCount: 0,
        dominantCoverage: 0,
      };
    }

    const viewportWidth = readViewportWidth(this._window, this._document);
    const viewportHeight = readViewportHeight(this._window, this._document);
    const explicitItemSelector = feedDiscoveryItemSelector;
    const explicitCandidates = safeCollectMatches(
      this._document,
      explicitItemSelector,
      this._onSelectorFailure,
    );
    if (explicitCandidates === null) {
      return {
        surfaceMode: 'unknown',
        contentClass: 'unknown',
        confidence: 0,
        repeatedItemCount: 0,
        dominantCoverage: 0,
      };
    }
    const genericCandidates = safeCollectMatches(
      this._document,
      GENERIC_FEED_ITEM_SELECTOR,
      this._onSelectorFailure,
    ) || [];
    const selectorCandidates = filterRepeatedItems([
      ...explicitCandidates,
      ...genericCandidates,
    ]);
    const repeatedItemCount = selectorCandidates.length;
    const dominant = findDominantCandidate(
      selectorCandidates.length > 0
        ? selectorCandidates
        : (safeCollectMatches(
            this._document,
            GENERIC_DOMINANT_SELECTOR,
            this._onSelectorFailure,
            { limit: MAX_CANDIDATES },
          ) || []),
      viewportWidth,
      viewportHeight,
    );
    const documentSignals = buildDocumentSignals(this._document, this._onSelectorFailure);
    const primaryDocument = documentSignals[0] || null;
    const dominantCoverage = dominant?.coverage || 0;
    const documentLike = !!(
      primaryDocument
      && repeatedItemCount <= 2
      && (
        primaryDocument.textLength >= 1200
        || (primaryDocument.imageCount >= 4 && primaryDocument.textLength >= 160)
        || (primaryDocument.imageCount >= 7 && primaryDocument.videoCount === 0)
      )
    );

    if (documentLike) {
      return {
        surfaceMode: 'document',
        contentClass: 'document',
        confidence: 0.88,
        repeatedItemCount,
        dominantCoverage,
      };
    }

    if (dominantCoverage >= 0.55 && repeatedItemCount <= 6 && dominant?.hasRichMedia) {
      return {
        surfaceMode: repeatedItemCount >= 3 ? 'hybrid' : 'paged',
        contentClass: 'feed',
        confidence: Math.min(0.95, 0.6 + dominantCoverage),
        repeatedItemCount,
        dominantCoverage,
      };
    }

    if (repeatedItemCount >= 3) {
      return {
        surfaceMode: dominantCoverage >= 0.42 ? 'hybrid' : 'continuous',
        contentClass: 'feed',
        confidence: Math.min(0.9, 0.45 + (repeatedItemCount * 0.06)),
        repeatedItemCount,
        dominantCoverage,
      };
    }

    return {
      surfaceMode: dominantCoverage >= 0.45 && dominant?.hasRichMedia ? 'paged' : 'unknown',
      contentClass: dominantCoverage >= 0.45 ? 'feed' : 'unknown',
      confidence: dominantCoverage >= 0.45 ? Math.min(0.72, 0.3 + dominantCoverage) : 0.2,
      repeatedItemCount,
      dominantCoverage,
    };
  }
}

export default GenericSurfaceClassifier;
