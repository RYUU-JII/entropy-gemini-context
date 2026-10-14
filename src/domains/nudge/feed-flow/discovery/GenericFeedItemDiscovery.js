import {
  GENERIC_FEED_ITEM_SELECTOR,
} from './genericFeedItemFeatures.js';
import { isGenericFeedItemCandidate, isSemanticFeedItemBoundary, resolveFeedItemBoundaries } from './feedItemBoundaries.js';
import { buildStableItemContentKey } from './feedItemContentIdentity.js';

const MAX_MUTATION_ELEMENTS = 40;
const MAX_SEED_ELEMENTS = 200;
const MAX_CONTENT_IDENTITIES = 128;

function isElement(node) {
  return typeof Element !== 'undefined' && node instanceof Element;
}

function reportSelectorFailure(onSelectorFailure, phase, error, details = {}) {
  if (typeof onSelectorFailure !== 'function') return;
  onSelectorFailure(phase, error, {
    phase,
    error: String(error?.message || error || 'FEED_ITEM_DISCOVERY_SELECTOR_FAILURE'),
    ...details,
  });
}

function safeMatches(node, selector, onSelectorFailure = null) {
  if (!isElement(node) || !selector) return false;
  try {
    return node.matches(selector);
  } catch (error) {
    reportSelectorFailure(onSelectorFailure, 'feed_item_discovery_match_selector', error, { selector });
    return null;
  }
}

// Bound explicit Element visits before selector/feature work. A declared or
// semantic item owns its descendants, so no nested discovery is needed there.
// This is not a bound on selector-engine work, identity reads or CPU time.
function collectDiscoveryCandidates(
  roots, selector, onSelectorFailure, { generic, maxElements },
) {
  const candidates = [];
  let visitedElements = 0;
  for (const root of roots) {
    let node = isElement(root) ? root : root.documentElement;
    if (!node?.isConnected) continue;
    const boundary = node;
    while (node) {
      if (visitedElements === maxElements) {
        return { candidates, visitedElements, complete: false, reason: 'visit_limit' };
      }
      visitedElements += 1;
      const explicitMatch = safeMatches(node, selector, onSelectorFailure);
      if (explicitMatch === null) {
        return { candidates: [], visitedElements, complete: false, reason: 'invalid_selector' };
      }
      const candidate = explicitMatch || (generic && (
        node === root || node.matches(GENERIC_FEED_ITEM_SELECTOR)
      ));
      if (candidate) candidates.push(node);
      const ownsDescendants = candidate && (!generic || isSemanticFeedItemBoundary(node));
      if (!ownsDescendants && node.firstElementChild) {
        node = node.firstElementChild;
        continue;
      }
      while (node !== boundary && !node.nextElementSibling) node = node.parentElement;
      node = node === boundary ? null : node.nextElementSibling;
    }
  }
  return { candidates, visitedElements, complete: true, reason: null };
}

function collectMinimalMutationRoots(mutations, findKnownBoundary) {
  const roots = [];
  const seen = new Set();
  mutations.forEach((mutation) => {
    const knownBoundary = findKnownBoundary(mutation.target);
    const changedNodes = knownBoundary ? [knownBoundary] : [
      ...Array.from(mutation?.addedNodes || []),
      ...((mutation.type === 'attributes' || mutation.type === 'characterData'
        || mutation.removedNodes?.length) ? [mutation.target] : []),
    ];
    changedNodes.forEach((changedNode) => {
      const element = isElement(changedNode) ? changedNode : changedNode?.parentElement;
      const node = findKnownBoundary(element) || element;
      if (!isElement(node) || seen.has(node)) return;
      seen.add(node);
      roots.push(node);
    });
  });

  return roots.filter((root, rootIndex) => !roots.some((candidate, candidateIndex) => (
    candidateIndex !== rootIndex
    && typeof candidate.contains === 'function'
    && candidate.contains(root)
  )));
}

export class GenericFeedItemDiscovery {
  constructor({
    documentRef = typeof document !== 'undefined' ? document : null,
    onSelectorFailure = null,
  } = {}) {
    this._document = documentRef;
    this._onSelectorFailure = typeof onSelectorFailure === 'function' ? onSelectorFailure : null;
    this._knownItems = new WeakMap();
    this._contentIdentities = new Set();
    this._surface = null;
    this._seedComplete = true;
  }

  setSurface(surface = null) {
    this._surface = surface && typeof surface === 'object' ? { ...surface } : null;
    this._knownItems = new WeakMap();
    this._contentIdentities.clear();
    this._seedComplete = true;
  }

  seedKnownItems() {
    const selector = typeof this._surface?.candidateItemSelectors === 'string'
      ? this._surface.candidateItemSelectors
      : '';
    if (!this._document) throw new Error('FEED_ITEM_DISCOVERY_DOCUMENT_REQUIRED');
    const scan = collectDiscoveryCandidates([this._document], selector, this._onSelectorFailure,
      { generic: this._usesGenericInference(), maxElements: MAX_SEED_ELEMENTS });
    this._seedComplete = scan.complete;
    // A truncated candidate tree cannot establish generic wrapper ownership.
    if (scan.complete) this._resolveBoundaries(scan.candidates).forEach((node) => this._rememberCandidate(node));
    return { complete: scan.complete, reason: scan.reason, visitedElements: scan.visitedElements };
  }

  observeMutations(payload = null) {
    const selector = typeof this._surface?.candidateItemSelectors === 'string'
      ? this._surface.candidateItemSelectors
      : '';
    if (!Array.isArray(payload?.mutations)) {
      throw new Error('FEED_ITEM_DISCOVERY_MUTATIONS_REQUIRED');
    }

    const roots = collectMinimalMutationRoots(payload.mutations, (node) => this._findKnownBoundary(node));
    const scan = collectDiscoveryCandidates(roots, selector, this._onSelectorFailure,
      { generic: this._usesGenericInference(), maxElements: MAX_MUTATION_ELEMENTS });
    const invalid = scan.reason === 'invalid_selector';
    const complete = scan.complete && (roots.length === 0 || this._seedComplete);
    const invalidatesKnownItem = roots.some((node) => this._knownItems.has(node))
      || payload.mutations.some((mutation) => mutation.removedNodes?.length > 0);
    // Unknown baseline coverage must never turn an unseeded old node into fresh
    // supply. The coordinator can still revalidate the actual dominant item.
    const freshItems = complete
      ? this._resolveBoundaries(scan.candidates).reduce((count, node) => count + this._rememberCandidate(node), 0)
      : null;
    return {
      complete,
      reason: scan.reason || (complete ? null : 'seed_incomplete'),
      needsRevalidation: !invalid && (!complete || freshItems > 0 || invalidatesKnownItem),
      freshItems,
      mutationRoots: roots.length,
      candidateCount: scan.candidates.length,
      visitedElements: scan.visitedElements,
    };
  }

  _resolveBoundaries(candidates) {
    const generic = this._usesGenericInference();
    return resolveFeedItemBoundaries(candidates.filter((node) => (
      node.isConnected && (!generic || isGenericFeedItemCandidate(node))
    )), { declared: !generic });
  }

  _findKnownBoundary(node) {
    let boundary = null;
    for (let candidate = isElement(node) ? node : node?.parentElement;
      isElement(candidate); candidate = candidate.parentElement) {
      if (this._knownItems.has(candidate)) boundary = candidate;
    }
    return boundary;
  }

  _rememberCandidate(node) {
    const key = buildStableItemContentKey(node);
    const known = this._knownItems.has(node);
    const previousKey = this._knownItems.get(node);
    this._knownItems.set(node, key);
    // Missing identity remains node-level evidence. A key first becoming
    // available on an existing node is not evidence of content replacement.
    if (!key) return known ? 0 : 1;
    const seenContent = this._contentIdentities.has(key);
    this._contentIdentities.delete(key);
    this._contentIdentities.add(key);
    if (this._contentIdentities.size > MAX_CONTENT_IDENTITIES) {
      this._contentIdentities.delete(this._contentIdentities.values().next().value);
    }
    if (seenContent || (known && (!previousKey || previousKey === key))) return 0;
    return 1;
  }

  _usesGenericInference() {
    const profileId = typeof this._surface?.profileId === 'string'
      ? this._surface.profileId.trim()
      : '';
    return !profileId || profileId === 'default';
  }
}

export default GenericFeedItemDiscovery;
