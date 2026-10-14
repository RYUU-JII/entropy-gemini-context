import {
  FEED_LOCAL_TOPOLOGY_DESCRIPTOR_CONTRACT,
  buildFeedLocalTopologyFingerprint,
  normalizeFeedLocalTopologyDescriptor,
} from '../../../../platform/storage/model/FeedTopologyCertificateCheckpointContract.js';
import {
  findScrollableAncestor,
  getRootScroller,
  isRootLikeScroller,
  normalizeScroller,
} from '../resolve/ActiveScrollContainerResolver.js';
import {
  directChildWithinFeedTopologyLane,
  isFeedTopologyElement,
  isUnsafeFeedTopologyLane,
  readFeedTopologyDepth,
} from './feedTopologyDomFacts.js';

export const FEED_LOCAL_TOPOLOGY_LIVE_CONTRACT = 'feed-local-topology-live-v1';

const SUPPORTED_MODES = new Set(['continuous', 'paged']);
const MIN_BRANCH_COUNT = 4;
const MIN_FUTURE_BRANCH_COUNT = 2;
const MAX_CANDIDATES = 320;
const MAX_ANCESTOR_DEPTH = 8;

function readStyle(node, windowRef) {
  return windowRef?.getComputedStyle?.(node)
    || globalThis.getComputedStyle?.(node)
    || null;
}

function normalizeSelector(value) {
  return typeof value === 'string' && value.trim() === value && value
    ? value
    : '';
}

function resolveLaneLayout(style) {
  const display = String(style?.display || '').toLowerCase();
  const flexDirection = String(style?.flexDirection || '').toLowerCase();
  if (display.includes('flex') && flexDirection.startsWith('column')) {
    return 'flex_column';
  }
  if (
    display === 'block'
    || display === 'flow-root'
    || display === 'list-item'
  ) {
    return 'block_stack';
  }
  return null;
}

function resolveScrollSnapAxis(style) {
  const tokens = String(style?.scrollSnapType || '').trim().toLowerCase().split(/\s+/);
  if (tokens[0] === 'y') return 'y';
  if (!tokens[0] || tokens[0] === 'none') return 'none';
  return 'unsupported';
}

function resolveBranchSnapAlign(branches, windowRef) {
  const values = branches.map((branch) => {
    const tokens = String(readStyle(branch, windowRef)?.scrollSnapAlign || '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return ['start', 'center', 'end'].find((value) => tokens.includes(value)) || 'none';
  });
  const unique = Array.from(new Set(values));
  return unique.length === 1 ? unique[0] : 'mixed';
}

function resolveCandidateAncestry(referenceNode, selector, documentRef, scroller) {
  if (!isFeedTopologyElement(referenceNode, documentRef)) return null;
  const nearest = referenceNode.matches(selector)
    ? referenceNode
    : referenceNode.closest(selector);
  if (!nearest || !scroller.contains(nearest)) return [];
  const candidates = [nearest];
  let cursor = nearest.parentElement;
  let depth = 0;
  while (
    isFeedTopologyElement(cursor, documentRef)
    && cursor !== documentRef?.body
    && scroller.contains(cursor)
    && depth < MAX_ANCESTOR_DEPTH
  ) {
    depth += 1;
    if (cursor.matches(selector)) candidates.push(cursor);
    cursor = cursor.parentElement;
  }
  return candidates;
}

// The shared budget counts nonmatching Elements and unsuccessful ancestors too.
// Stop at the reference's depth; item contents do not need to be enumerated.
function collectDepthCandidates(lane, candidateDepth, selector, budget) {
  const candidates = [];
  let node = lane.firstElementChild;
  let depth = 1;
  while (node) {
    if (budget.visitedElements === budget.maximumElements) {
      budget.complete = false;
      return null;
    }
    budget.visitedElements += 1;
    if (depth === candidateDepth && node.matches(selector)) candidates.push(node);
    if (depth < candidateDepth && node.firstElementChild) {
      node = node.firstElementChild;
      depth += 1;
      continue;
    }
    while (node.parentElement !== lane && !node.nextElementSibling) {
      node = node.parentElement;
      depth -= 1;
    }
    node = node.nextElementSibling;
  }
  return candidates;
}

function findRepeatedLane({
  referenceItem,
  selector,
  scroller,
  budget,
  documentRef,
}) {
  let lane = referenceItem?.parentElement || null;
  let ancestorDepth = 0;
  while (
    isFeedTopologyElement(lane, documentRef)
    && lane !== documentRef?.body
    && !isUnsafeFeedTopologyLane(lane, documentRef)
    && scroller.contains(lane)
    && ancestorDepth < MAX_ANCESTOR_DEPTH
  ) {
    ancestorDepth += 1;
    const candidateDepth = readFeedTopologyDepth(
      lane,
      referenceItem,
      MAX_ANCESTOR_DEPTH,
    );
    if (candidateDepth > 0) {
      const depthCandidates = collectDepthCandidates(lane, candidateDepth, selector, budget);
      if (!depthCandidates) return null;
      const branchMap = new Map();
      depthCandidates.forEach((candidate) => {
        const branch = directChildWithinFeedTopologyLane(lane, candidate);
        if (!branch) return;
        const entries = branchMap.get(branch) || [];
        entries.push(candidate);
        branchMap.set(branch, entries);
      });
      const oneCandidateBranches = Array.from(branchMap.entries())
        .filter(([, entries]) => entries.length === 1);
      if (
        oneCandidateBranches.length >= MIN_BRANCH_COUNT
        && oneCandidateBranches.some(([, entries]) => entries[0] === referenceItem)
      ) {
        const orderedBranches = Array.from(lane.children || [])
          .filter((branch) => branchMap.get(branch)?.length === 1);
        return {
          lane,
          candidateDepth,
          branches: orderedBranches,
          candidates: orderedBranches.map((branch) => branchMap.get(branch)[0]),
        };
      }
    }
    if (lane === scroller) break;
    lane = lane.parentElement;
  }
  return null;
}

function resolveFutureBranchProof(lane, anchorBranch, candidateBranches) {
  const laneChildren = Array.from(lane.children || []);
  const anchorIndex = laneChildren.indexOf(anchorBranch);
  if (anchorIndex < 0) return null;
  const followingBranches = laneChildren.slice(anchorIndex + 1);
  if (followingBranches.length < MIN_FUTURE_BRANCH_COUNT) return null;
  const candidateBranchSet = new Set(candidateBranches);
  if (followingBranches.some((branch) => !candidateBranchSet.has(branch))) return null;
  return followingBranches;
}

function buildDescriptor({
  surfaceMode,
  candidateDepth,
  laneLayout,
  scrollerKind,
  scrollSnapAxis,
  branchScrollSnapAlign,
}) {
  return normalizeFeedLocalTopologyDescriptor({
    contract: FEED_LOCAL_TOPOLOGY_DESCRIPTOR_CONTRACT,
    surfaceMode,
    capability: surfaceMode === 'paged' ? 'paged_hold' : 'anchored_continuous',
    candidateDepth,
    laneLayout,
    scrollerKind,
    scrollSnapAxis,
    branchScrollSnapAlign,
    boundaryBasis: surfaceMode === 'paged'
      ? 'next_containment_start'
      : 'anchor_branch_edge',
    mutationMode: 'sibling_inert_isolation',
    isolationLayout: surfaceMode === 'paged' ? 'collapse' : 'preserve',
    tailLayout: 'flow',
    candidateCardinality: 'one_per_branch',
  });
}

export class FeedLocalTopologyProbe {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    maximumCandidates = MAX_CANDIDATES,
  } = {}) {
    if (!Number.isSafeInteger(maximumCandidates) || maximumCandidates < MIN_BRANCH_COUNT) {
      throw new Error('FEED_LOCAL_TOPOLOGY_PROBE_CANDIDATE_LIMIT_INVALID');
    }
    this._window = windowRef;
    this._document = documentRef;
    this._maximumCandidates = maximumCandidates;
  }

  inspect({
    surface = null,
    actuationContext = null,
  } = {}) {
    const surfaceMode = typeof surface?.surfaceMode === 'string'
      ? surface.surfaceMode
      : 'unknown';
    if (!SUPPORTED_MODES.has(surfaceMode)) {
      return this._result('unsupported', ['local_topology_surface_mode_unsupported']);
    }
    if (!this._document) {
      return this._result('unavailable', ['local_topology_document_unavailable']);
    }
    const selector = normalizeSelector(surface?.candidateItemSelectors);
    if (!selector) {
      return this._result('unsafe', ['local_topology_candidate_selector_missing']);
    }

    const referenceNode = actuationContext?.referenceNode;
    if (
      !isFeedTopologyElement(referenceNode, this._document)
      || !referenceNode.isConnected
      || referenceNode.ownerDocument !== this._document
    ) return this._result('pending', ['local_topology_reference_candidate_missing']);
    const requestedScroller = actuationContext?.activeScroller
      || findScrollableAncestor(referenceNode, 1, this._document);
    const scroller = normalizeScroller(requestedScroller, this._document)
      || getRootScroller(this._document);
    if (
      !scroller?.isConnected
      || scroller.ownerDocument !== this._document
      || !scroller.contains(referenceNode)
    ) return this._result('unsafe', ['local_topology_scroller_unresolved']);
    const discovery = {
      complete: true,
      reason: null,
      visitedElements: 0,
      maximumElements: this._maximumCandidates,
    };
    let referenceItems;
    let referenceItem = null;
    let repeatedLane = null;
    try {
      referenceItems = resolveCandidateAncestry(
        referenceNode,
        selector,
        this._document,
        scroller,
      );
      if (!Array.isArray(referenceItems) || !referenceItems.some((item) => item.isConnected)) {
        return this._result('pending', ['local_topology_reference_candidate_missing']);
      }
      for (const candidate of referenceItems) {
        const resolved = findRepeatedLane({
          referenceItem: candidate,
          selector,
          scroller,
          budget: discovery,
          documentRef: this._document,
        });
        if (!discovery.complete) {
          discovery.reason = 'visit_limit';
          return this._result('pending', ['local_topology_candidate_discovery_incomplete'], discovery);
        }
        if (!resolved) continue;
        referenceItem = candidate;
        repeatedLane = resolved;
        break;
      }
    } catch (error) {
      const result = this._result('unsafe', ['local_topology_candidate_selector_invalid']);
      result.error = String(error?.message || error);
      return result;
    }
    if (!repeatedLane || isUnsafeFeedTopologyLane(repeatedLane.lane, this._document)) {
      return this._result('pending', ['local_topology_repeated_lane_unresolved'], discovery);
    }
    const referenceIndex = repeatedLane.candidates.indexOf(referenceItem);
    const anchorBranch = repeatedLane.branches[referenceIndex];
    if (!anchorBranch || anchorBranch.parentElement !== repeatedLane.lane) {
      return this._result('unsafe', ['local_topology_anchor_branch_unresolved']);
    }
    const futureBranches = resolveFutureBranchProof(
      repeatedLane.lane,
      anchorBranch,
      repeatedLane.branches,
    );
    if (!futureBranches) {
      return this._result('pending', ['local_topology_future_branch_purity_unproven'], discovery);
    }

    if (!scroller.contains(repeatedLane.lane)) {
      return this._result('unsafe', ['local_topology_scroller_unresolved']);
    }

    const laneLayout = resolveLaneLayout(readStyle(repeatedLane.lane, this._window));
    if (!laneLayout) {
      return this._result('unsafe', ['local_topology_lane_layout_unsupported']);
    }
    const scrollSnapAxis = resolveScrollSnapAxis(readStyle(scroller, this._window));
    const branchScrollSnapAlign = resolveBranchSnapAlign(
      repeatedLane.branches,
      this._window,
    );
    if (
      scrollSnapAxis === 'unsupported'
      || branchScrollSnapAlign === 'mixed'
      || (
        surfaceMode === 'continuous'
        && (
          scrollSnapAxis !== 'none'
          || branchScrollSnapAlign !== 'none'
        )
      )
      || (
        surfaceMode === 'paged'
        && (
          scrollSnapAxis !== 'y'
          || branchScrollSnapAlign === 'none'
        )
      )
    ) {
      return this._result('unsafe', ['local_topology_scroll_contract_mismatch']);
    }

    const descriptor = buildDescriptor({
      surfaceMode,
      candidateDepth: repeatedLane.candidateDepth,
      laneLayout,
      scrollerKind: isRootLikeScroller(scroller, this._document) ? 'root' : 'element',
      scrollSnapAxis,
      branchScrollSnapAlign,
    });
    const fingerprint = buildFeedLocalTopologyFingerprint(descriptor);
    return {
      contract: FEED_LOCAL_TOPOLOGY_LIVE_CONTRACT,
      status: 'resolved',
      reasons: ['local_topology_live_structure_resolved'],
      fingerprint,
      descriptor,
      candidateSelector: selector,
      referenceItem,
      anchorBranch,
      lane: repeatedLane.lane,
      scroller,
      candidateItems: [...repeatedLane.candidates],
      candidateBranches: [...repeatedLane.branches],
      futureBranchCount: futureBranches.length,
      discovery,
    };
  }

  _result(status, reasons, discovery = null) {
    return {
      contract: FEED_LOCAL_TOPOLOGY_LIVE_CONTRACT,
      status,
      reasons: [...reasons],
      ...(discovery ? { discovery } : {}),
      fingerprint: '',
      descriptor: null,
      candidateSelector: '',
      referenceItem: null,
      anchorBranch: null,
      lane: null,
      scroller: null,
      candidateItems: [],
      candidateBranches: [],
      futureBranchCount: 0,
    };
  }
}

export default FeedLocalTopologyProbe;
