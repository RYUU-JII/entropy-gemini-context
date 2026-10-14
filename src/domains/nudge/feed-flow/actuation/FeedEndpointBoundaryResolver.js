import {
  findScrollableAncestor,
  getRootScroller,
  isRootLikeScroller,
  normalizeScroller,
  readContainerHeight,
  readScrollerPosition,
} from '../resolve/ActiveScrollContainerResolver.js';
import {
  buildLocallyCertifiedFeedTopologyId,
  resolveFeedEndpointAdapter,
  resolveLocallyCertifiedFeedEndpointAdapter,
} from './feedEndpointAdapterCatalog.js';
import {
  FEED_TOPOLOGY_AUTHORITY_SOURCES,
  FEED_TOPOLOGY_AUTHORITY_VERSION,
  isFeedTopologyActuationAuthorized,
} from '../../../protection/contracts/feedTopologyAuthorityContract.js';
import {
  FEED_LOCAL_TOPOLOGY_LIVE_CONTRACT,
} from '../topology/FeedLocalTopologyProbe.js';
import {
  closestFeedTopologyCandidate as closestCandidate,
  directChildWithinFeedTopologyLane as directChildWithin,
  isNestedFeedTopologyCandidate as isNestedCandidate,
  resolveFeedTopologyLane as resolveLane,
} from '../topology/feedTopologyDomFacts.js';
import {
  BOUNDARY_BASIS_ANCHOR_BRANCH_EDGE,
  BOUNDARY_BASIS_COMPLETED_WRAP_ROW_EDGE,
  BOUNDARY_BASIS_NEXT_CONTAINMENT_START,
  TAIL_LAYOUT_WRAPPED_ROW_FLOW,
  inspectDeclaredFeedEndpointScroller,
  inspectDeclaredFeedEndpointTopology,
} from './feedEndpointTopologyInspection.js';
import {
  resolveFeedEndpointBoundaryMotionProfile,
} from '../terminus/feedEndpointBoundaryMotionProfile.js';
import {
  resolveFeedEndpointTailPaintProfile,
  resolveFeedEndpointReadableInk,
} from '../terminus/feedEndpointTailPaintProfile.js';
import {
  validateFeedEndpointForwardControlContract,
  validateFeedEndpointForwardControlDefinition,
} from '../contracts/feedEndpointPlanContract.js';

const DEFAULT_MAX_CANDIDATES = 320;
const DEFAULT_MAX_QUARANTINE_NODES = 120;
const DEFAULT_STABILITY_FRAMES = 2;
const GEOMETRY_TOLERANCE_PX = 2;
const CONTINUOUS_MAX_TRAVEL_RATIO = 0.72;
const PAGED_MIN_COVERAGE_RATIO = 0.42;
const PAGED_MAX_TRAVEL_RATIO = 1.35;
const ENDPOINT_ISOLATION_LAYOUTS = new Set(['collapse', 'preserve']);
const ENDPOINT_TAIL_LAYOUTS = new Set([
  'flow',
  'absolute_anchor_edge',
  TAIL_LAYOUT_WRAPPED_ROW_FLOW,
]);

function isElement(node, documentRef) {
  const ElementCtor = documentRef?.defaultView?.Element || globalThis.Element;
  return typeof ElementCtor === 'function' && node instanceof ElementCtor;
}

function readRect(node) {
  if (!node || typeof node.getBoundingClientRect !== 'function') return null;
  const rect = node.getBoundingClientRect();
  const top = Number(rect?.top);
  const bottom = Number(rect?.bottom);
  const left = Number(rect?.left);
  const right = Number(rect?.right);
  const width = Number(rect?.width);
  const height = Number(rect?.height);
  if (![top, bottom, left, right, width, height].every(Number.isFinite)) return null;
  return { top, bottom, left, right, width, height };
}

function visiblePixels(rect, viewport) {
  if (!rect || !viewport) return 0;
  if (rect.right <= viewport.left || rect.left >= viewport.right) return 0;
  return Math.max(0, Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top));
}

// Bound layout reads around the current reference, not the oldest retained
// feed items. Keep the complete identity list for structural safety checks.
function selectReferenceCandidateWindow(candidates, referenceItem, limit) {
  const referenceIndex = candidates.indexOf(referenceItem);
  const start = Math.max(0, Math.min(
    referenceIndex - Math.floor(limit / 2),
    candidates.length - limit,
  ));
  const end = Math.min(candidates.length, start + limit);
  return {
    candidates: candidates.slice(start, end),
    truncated: start > 0 || end < candidates.length,
    adjacentExcluded: [candidates[start - 1], candidates[end]].filter(Boolean),
  };
}

function resolveViewport(scroller, windowRef, documentRef) {
  const rootLike = isRootLikeScroller(scroller, documentRef);
  if (rootLike) {
    const width = Math.max(
      1,
      Number(windowRef?.innerWidth)
        || Number(documentRef?.documentElement?.clientWidth)
        || 1,
    );
    const height = readContainerHeight(scroller, windowRef, documentRef);
    return {
      top: 0,
      bottom: height,
      left: 0,
      right: width,
      width,
      height,
    };
  }

  const rect = readRect(scroller);
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

function prefersReducedMotion(windowRef) {
  return windowRef?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function matchesContainmentSelector(node, selector, documentRef) {
  if (!selector) return true;
  return isElement(node, documentRef) && node.matches(selector);
}

function collectFollowingNodes(anchorBranch, containmentSelector, documentRef) {
  const nodes = [];
  let cursor = anchorBranch?.nextSibling || null;
  while (cursor) {
    if (matchesContainmentSelector(cursor, containmentSelector, documentRef)) nodes.push(cursor);
    cursor = cursor.nextSibling;
  }
  return nodes;
}

function resolveForwardControl(adapter, documentRef) {
  const contract = adapter?.forwardControl || null;
  if (!contract) return { status: 'resolved', control: null };
  try {
    validateFeedEndpointForwardControlDefinition(contract);
  } catch {
    return {
      status: 'unsafe',
      reason: 'feed_endpoint_forward_control_contract_invalid',
    };
  }
  let matches = [];
  try {
    matches = Array.from(documentRef?.querySelectorAll?.(contract.selector) || []);
  } catch {
    return {
      status: 'unsafe',
      reason: 'feed_endpoint_forward_control_selector_invalid',
    };
  }
  const resolvedContract = {
    element: matches[0] || null,
    controlKind: contract.controlKind,
    policy: contract.policy,
  };
  try {
    if (matches.length !== 1) {
      throw new Error('FEED_ENDPOINT_FORWARD_CONTROL_CARDINALITY_INVALID');
    }
    validateFeedEndpointForwardControlContract(resolvedContract, documentRef);
  } catch {
    return {
      status: 'unsafe',
      reason: 'feed_endpoint_forward_control_topology_mismatch',
    };
  }
  return {
    status: 'resolved',
    control: resolvedContract,
  };
}

function isTransparentColor(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'transparent') return true;
  const rgba = normalized.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
  return !!rgba && Number(rgba[1]) <= 0.01;
}

function resolvePaint(lane, windowRef, documentRef) {
  let cursor = lane;
  let backgroundColor = 'transparent';
  while (isElement(cursor, documentRef)) {
    const style = windowRef?.getComputedStyle?.(cursor)
      || globalThis.getComputedStyle?.(cursor)
      || null;
    if (style?.backgroundColor && !isTransparentColor(style.backgroundColor)) {
      backgroundColor = style.backgroundColor;
      break;
    }
    cursor = cursor.parentElement;
  }
  return {
    backgroundColor,
    color: resolveFeedEndpointReadableInk(backgroundColor),
  };
}

function geometryMatches(previous, next, tolerancePx) {
  if (!previous || !next) return false;
  if (
    previous.anchorItem !== next.anchorItem
    || previous.anchorBranch !== next.anchorBranch
    || previous.lane !== next.lane
    || previous.scroller !== next.scroller
    || previous.forwardControl !== next.forwardControl
    || previous.adapterId !== next.adapterId
    || previous.topologyId !== next.topologyId
  ) return false;
  return [
    'anchorTop',
    'anchorBottom',
    'anchorBranchTop',
    'anchorBranchBottom',
    'viewportTop',
    'viewportBottom',
    'boundaryEdge',
    'motionEndpointEdge',
    'boundaryPosition',
    'tailTopPx',
  ].every((key) => Math.abs(previous[key] - next[key]) <= tolerancePx);
}

function resolveAuthorizedAdapter({
  authority,
  profileId,
  semanticSurfaceId,
  surfaceMode,
  localTopology,
  now,
}) {
  if (!isFeedTopologyActuationAuthorized(authority)) {
    return {
      status: 'unsafe',
      capability: 'observe_only',
      reasons: ['feed_topology_authority_unavailable'],
    };
  }
  if (
    authority.profileId !== profileId
    || authority.semanticSurfaceId !== semanticSurfaceId
    || authority.surfaceMode !== surfaceMode
  ) {
    return {
      status: 'unsafe',
      capability: 'observe_only',
      reasons: ['feed_topology_authority_surface_mismatch'],
    };
  }

  if (authority.topologySource === FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED) {
    if (
      !Number.isSafeInteger(authority.topologyCertificateExpiresAt)
      || authority.topologyCertificateExpiresAt <= now
    ) {
      return {
        status: 'unsafe',
        capability: 'observe_only',
        reasons: ['feed_topology_local_certificate_expired'],
      };
    }
    if (
      !localTopology
      || localTopology.contract !== FEED_LOCAL_TOPOLOGY_LIVE_CONTRACT
      || localTopology.status !== 'resolved'
      || localTopology.fingerprint !== authority.topologyFingerprint
      || localTopology.descriptor?.surfaceMode !== surfaceMode
    ) {
      return {
        status: 'unsafe',
        capability: 'observe_only',
        reasons: ['feed_topology_local_live_proof_mismatch'],
      };
    }
    const adapter = resolveLocallyCertifiedFeedEndpointAdapter({
      surfaceMode,
      fingerprint: authority.topologyFingerprint,
    });
    if (
      adapter.capability === 'observe_only'
      || adapter.adapterId !== authority.adapterId
      || adapter.capability !== authority.capability
      || adapter.mutationMode !== authority.mutationMode
      || buildLocallyCertifiedFeedTopologyId(authority.topologyFingerprint)
        !== authority.topologyId
    ) {
      return {
        status: 'unsafe',
        capability: 'observe_only',
        reasons: ['feed_topology_local_adapter_mismatch'],
      };
    }
    return { status: 'resolved', adapter };
  }

  const adapter = resolveFeedEndpointAdapter({
    profileId,
    semanticSurfaceId,
    surfaceMode,
  });
  const topologyId = adapter.endpointTopology?.topologyId || '';
  if (
    adapter.capability === 'observe_only'
    || adapter.adapterId !== authority.adapterId
    || adapter.capability !== authority.capability
    || adapter.mutationMode !== authority.mutationMode
    || topologyId !== authority.topologyId
  ) {
    return {
      status: 'unsafe',
      capability: 'observe_only',
      reasons: ['feed_topology_authority_catalog_mismatch'],
    };
  }
  return { status: 'resolved', adapter };
}

export class FeedEndpointBoundaryResolver {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    stabilityFrames = DEFAULT_STABILITY_FRAMES,
    maxCandidates = DEFAULT_MAX_CANDIDATES,
    maxQuarantineNodes = DEFAULT_MAX_QUARANTINE_NODES,
    onRuntimeFailure = null,
    now = () => Date.now(),
  } = {}) {
    this._window = windowRef;
    this._document = documentRef;
    this._stabilityFrames = Math.max(2, Math.round(Number(stabilityFrames) || DEFAULT_STABILITY_FRAMES));
    this._maxCandidates = Math.max(8, Math.round(Number(maxCandidates) || DEFAULT_MAX_CANDIDATES));
    this._maxQuarantineNodes = Math.max(
      8,
      Math.round(Number(maxQuarantineNodes) || DEFAULT_MAX_QUARANTINE_NODES),
    );
    this._onRuntimeFailure = typeof onRuntimeFailure === 'function' ? onRuntimeFailure : null;
    if (typeof now !== 'function') {
      throw new Error('FEED_ENDPOINT_BOUNDARY_CLOCK_REQUIRED');
    }
    this._now = now;
    this.reset();
  }

  reset() {
    this._lastGeometry = null;
    this._stableFrames = 0;
  }

  resolve({ decision = null, admission = null, actuationContext = null } = {}) {
    const context = actuationContext && typeof actuationContext === 'object'
      ? actuationContext
      : {};
    const surfaceMode = typeof decision?.surfaceMode === 'string'
      ? decision.surfaceMode
      : (context.surfaceMode || 'unknown');
    const profileId = typeof context.profileId === 'string' ? context.profileId : '';
    const semanticSurfaceId = typeof context.semanticSurfaceId === 'string'
      ? context.semanticSurfaceId
      : '';
    const authority = context.topologyAuthority;
    const evaluatedAt = Math.round(Number(this._now()));
    if (!Number.isSafeInteger(evaluatedAt) || evaluatedAt < 0) {
      throw new Error('FEED_ENDPOINT_BOUNDARY_CLOCK_INVALID');
    }
    const authorizedAdapter = resolveAuthorizedAdapter({
      authority,
      profileId,
      semanticSurfaceId,
      surfaceMode,
      localTopology: context.localTopology,
      now: evaluatedAt,
    });
    if (authorizedAdapter.status !== 'resolved') {
      this.reset();
      return authorizedAdapter;
    }
    const adapter = authorizedAdapter.adapter;
    if (
      decision?.readiness?.contractVersion !== FEED_TOPOLOGY_AUTHORITY_VERSION
      || decision.readiness.topologyEpoch !== authority.topologyEpoch
      || decision.readiness.adapterId !== authority.adapterId
      || decision.readiness.topologyId !== authority.topologyId
    ) {
      this.reset();
      return {
        status: 'unsafe',
        capability: 'observe_only',
        reasons: ['feed_topology_decision_authority_mismatch'],
      };
    }
    if (
      adapter.mutationMode === 'sibling_inert_isolation'
      && !ENDPOINT_ISOLATION_LAYOUTS.has(adapter.isolationLayout)
    ) {
      this.reset();
      this._reportFailure(
        'feed_endpoint_adapter_isolation_layout',
        new Error('FEED_ENDPOINT_ADAPTER_ISOLATION_LAYOUT_INVALID'),
        { adapterId: adapter.adapterId },
      );
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_adapter_topology_invalid'],
      };
    }
    if (!ENDPOINT_TAIL_LAYOUTS.has(adapter.tailLayout)) {
      this.reset();
      this._reportFailure(
        'feed_endpoint_adapter_tail_layout',
        new Error('FEED_ENDPOINT_ADAPTER_TAIL_LAYOUT_INVALID'),
        { adapterId: adapter.adapterId },
      );
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_adapter_topology_invalid'],
      };
    }
    const resolvedForwardControl = resolveForwardControl(adapter, this._document);
    if (resolvedForwardControl.status !== 'resolved') {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: [resolvedForwardControl.reason],
      };
    }
    if (
      adapter.capability === 'anchored_continuous'
      && !adapter.endpointTopology
      && authority.topologySource !== FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED
    ) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_adapter_topology_invalid'],
      };
    }

    if (
      admission?.status !== 'admitted'
      || admission?.admitted !== true
      || decision?.readiness?.status !== 'ready'
      || decision?.actuationSafety?.status !== 'safe'
    ) {
      this.reset();
      return {
        status: 'pending',
        capability: adapter.capability,
        reasons: ['enso_feed_episode_not_actuatable'],
      };
    }

    const localTopology = authority.topologySource
      === FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED
      ? context.localTopology
      : null;
    const selector = typeof (
      localTopology?.candidateSelector || context.candidateItemSelectors
    ) === 'string'
      ? (localTopology?.candidateSelector || context.candidateItemSelectors).trim()
      : '';
    if (!selector) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['candidate_item_selector_missing'],
      };
    }
    let referenceItem = null;
    let candidates = [];
    if (localTopology) {
      referenceItem = localTopology.referenceItem;
      candidates = Array.isArray(localTopology.candidateItems)
        ? localTopology.candidateItems
          .filter((node) => isElement(node, this._document) && node.isConnected)
        : [];
    } else {
      try {
        referenceItem = closestCandidate(
          context.referenceNode || decision?.referenceNode,
          selector,
          this._document,
        );
        candidates = Array.from(this._document?.querySelectorAll?.(selector) || [])
          .filter((node) => isElement(node, this._document) && node.isConnected)
          .filter((node) => !isNestedCandidate(node, selector, this._document));
      } catch (error) {
        this.reset();
        this._reportFailure('feed_endpoint_selector_resolution', error, { selector });
        return {
          status: 'unsafe',
          capability: adapter.capability,
          reasons: ['candidate_item_selector_invalid'],
        };
      }
    }

    if (!referenceItem?.isConnected || !candidates.includes(referenceItem)) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['candidate_reference_anchor_missing'],
      };
    }

    let declaredTopology = null;
    try {
      declaredTopology = inspectDeclaredFeedEndpointTopology(
        referenceItem,
        adapter,
        this._window,
        this._document,
      );
    } catch (error) {
      this.reset();
      this._reportFailure('feed_endpoint_adapter_topology_resolution', error, {
        adapterId: adapter.adapterId,
      });
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_adapter_topology_invalid'],
      };
    }
    if (declaredTopology?.status === 'mismatch') {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_adapter_topology_mismatch'],
      };
    }

    const lane = declaredTopology?.lane
      || localTopology?.lane
      || resolveLane(referenceItem, candidates, this._document);
    if (!lane?.isConnected) {
      this.reset();
      return {
        status: 'pending',
        capability: adapter.capability,
        reasons: ['feed_endpoint_lane_unresolved'],
      };
    }

    let activeScroller = null;
    if (declaredTopology) {
      const scrollerInspection = inspectDeclaredFeedEndpointScroller(
        declaredTopology,
        context.activeScroller,
        this._document,
      );
      if (scrollerInspection.status === 'mismatch') {
        this.reset();
        return {
          status: 'unsafe',
          capability: adapter.capability,
          reasons: ['feed_endpoint_active_scroller_mismatch'],
        };
      }
      activeScroller = scrollerInspection.scroller;
    } else {
      const requestedScroller = context.activeScroller || findScrollableAncestor(
        referenceItem,
        1,
        this._document,
      );
      activeScroller = normalizeScroller(requestedScroller, this._document)
        || getRootScroller(this._document);
    }
    const scroller = localTopology?.scroller || activeScroller;
    if (!scroller || (!isRootLikeScroller(scroller, this._document) && !scroller.isConnected)) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_scroller_missing'],
      };
    }
    if (!isRootLikeScroller(scroller, this._document) && !scroller.contains(referenceItem)) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_scroller_anchor_mismatch'],
      };
    }
    if (
      localTopology
      && (
        localTopology.lane !== lane
        || localTopology.scroller !== scroller
        || localTopology.anchorBranch?.parentElement !== lane
        || !localTopology.anchorBranch.contains(referenceItem)
      )
    ) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_topology_local_live_ownership_mismatch'],
      };
    }

    const viewport = resolveViewport(scroller, this._window, this._document);
    if (!viewport) {
      this.reset();
      return {
        status: 'pending',
        capability: adapter.capability,
        reasons: ['feed_endpoint_viewport_unresolved'],
      };
    }

    const laneCandidates = candidates.filter((candidate) => lane.contains(candidate));
    const candidateWindow = selectReferenceCandidateWindow(
      laneCandidates,
      referenceItem,
      this._maxCandidates,
    );
    // A bounded subset cannot certify an entire wrapped row. Keep this layout
    // unavailable until a separate complete-row acquisition contract exists.
    if (
      candidateWindow.truncated
      && declaredTopology?.boundaryBasis === BOUNDARY_BASIS_COMPLETED_WRAP_ROW_EDGE
    ) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_completed_wrap_row_truncated'],
      };
    }
    if (candidateWindow.adjacentExcluded.some((candidate) => {
      const rect = readRect(candidate);
      return !rect || visiblePixels(rect, viewport) > 1;
    })) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_candidate_window_truncated'],
      };
    }
    const visibleCandidates = candidateWindow.candidates
      .map((candidate) => ({
        candidate,
        rect: readRect(candidate),
      }))
      .filter(({ rect }) => rect && rect.width > 0 && rect.height > 0 && visiblePixels(rect, viewport) > 1);
    if (visibleCandidates.length === 0) {
      this.reset();
      return {
        status: 'pending',
        capability: adapter.capability,
        reasons: ['feed_endpoint_visible_anchor_missing'],
      };
    }

    const visibleAnchor = visibleCandidates[visibleCandidates.length - 1];
    let anchorItem = visibleAnchor.candidate;
    let anchorRect = visibleAnchor.rect;
    let anchorBranch = declaredTopology
      ? anchorItem.closest(declaredTopology.anchorBranchSelector)
      : directChildWithin(lane, anchorItem);
    if (!anchorBranch || anchorBranch === lane) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_anchor_branch_unresolved'],
      };
    }
    if (anchorBranch.parentElement !== lane) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_anchor_branch_lane_mismatch'],
      };
    }
    let anchorBranchRect = readRect(anchorBranch);
    if (!anchorBranchRect || anchorBranchRect.width <= 0 || anchorBranchRect.height <= 0) {
      this.reset();
      return {
        status: 'pending',
        capability: adapter.capability,
        reasons: ['feed_endpoint_anchor_branch_geometry_unresolved'],
      };
    }
    const laneStyle = this._window?.getComputedStyle?.(lane)
      || globalThis.getComputedStyle?.(lane)
      || null;
    let completedWrapRowItemCount = 0;
    let completedWrapRowBoundaryEdge = null;
    let completedWrapRowTrailingSpacePx = 0;
    if (
      declaredTopology?.boundaryBasis
      === BOUNDARY_BASIS_COMPLETED_WRAP_ROW_EDGE
    ) {
      const laneChildren = Array.from(lane.children);
      const rowEntries = [];
      const seenBranches = new Set();
      let duplicateCandidateBranch = false;
      laneCandidates.forEach((candidate) => {
        const branch = candidate.closest(declaredTopology.anchorBranchSelector);
        if (!branch || branch.parentElement !== lane) return;
        const branchRect = readRect(branch);
        if (
          !branchRect
          || branchRect.width <= 0
          || branchRect.height <= 0
          || Math.abs(branchRect.top - anchorBranchRect.top) > GEOMETRY_TOLERANCE_PX
        ) return;
        if (seenBranches.has(branch)) {
          duplicateCandidateBranch = true;
          return;
        }
        seenBranches.add(branch);
        const branchStyle = this._window?.getComputedStyle?.(branch)
          || globalThis.getComputedStyle?.(branch)
          || null;
        const parsedMarginBottom = Number.parseFloat(branchStyle?.marginBottom || '');
        const marginBottom = Number.isFinite(parsedMarginBottom)
          ? parsedMarginBottom
          : 0;
        rowEntries.push({
          candidate,
          candidateRect: readRect(candidate),
          branch,
          branchRect,
          marginBottom,
          laneIndex: laneChildren.indexOf(branch),
        });
      });
      rowEntries.sort((left, right) => left.laneIndex - right.laneIndex);
      if (
        duplicateCandidateBranch
        || rowEntries.length === 0
        || rowEntries.some((entry) => (
          entry.laneIndex < 0
          || !entry.candidateRect
          || entry.candidateRect.width <= 0
          || entry.candidateRect.height <= 0
        ))
      ) {
        this.reset();
        return {
          status: 'unsafe',
          capability: adapter.capability,
          reasons: ['feed_endpoint_completed_wrap_row_unresolved'],
        };
      }
      const completedRowAnchor = rowEntries[rowEntries.length - 1];
      anchorItem = completedRowAnchor.candidate;
      anchorRect = completedRowAnchor.candidateRect;
      anchorBranch = completedRowAnchor.branch;
      anchorBranchRect = completedRowAnchor.branchRect;
      completedWrapRowItemCount = rowEntries.length;
      const parsedRowGap = Number.parseFloat(laneStyle?.rowGap || '');
      const rowGap = Number.isFinite(parsedRowGap) ? Math.max(0, parsedRowGap) : 0;
      const completedWrapRowContentEdge = Math.max(
        ...rowEntries.map((entry) => entry.branchRect.bottom),
      );
      completedWrapRowBoundaryEdge = Math.max(
        ...rowEntries.map((entry) => entry.branchRect.bottom + entry.marginBottom),
      );
      completedWrapRowBoundaryEdge += rowGap;
      completedWrapRowTrailingSpacePx = (
        completedWrapRowBoundaryEdge - completedWrapRowContentEdge
      );
    }

    const anchorIndex = laneCandidates.indexOf(anchorItem);
    const laterCandidates = anchorIndex >= 0 ? laneCandidates.slice(anchorIndex + 1) : [];
    if (laterCandidates.some((candidate) => directChildWithin(lane, candidate) === anchorBranch)) {
      this.reset();
      return {
        status: surfaceMode === 'continuous' ? 'pending' : 'unsafe',
        capability: adapter.capability,
        reasons: [
          surfaceMode === 'continuous'
            ? 'feed_endpoint_anchor_branch_contains_future_items'
            : 'feed_endpoint_recycled_branch_ambiguous',
        ],
      };
    }

    const containmentSelector = declaredTopology?.containmentSelector || null;
    if (declaredTopology) {
      const declaredCandidateBranches = [anchorItem, ...laterCandidates]
        .map((candidate) => directChildWithin(lane, candidate));
      if (
        declaredCandidateBranches.some((branch) => (
          !branch
          || !matchesContainmentSelector(branch, containmentSelector, this._document)
        ))
      ) {
        this.reset();
        return {
          status: 'unsafe',
          capability: adapter.capability,
          reasons: ['feed_endpoint_adapter_topology_mismatch'],
        };
      }
    }
    const followingNodes = collectFollowingNodes(
      anchorBranch,
      containmentSelector,
      this._document,
    );
    if (declaredTopology?.branchScrollSnapAlign) {
      const branches = [anchorBranch, ...followingNodes];
      const everyBranchPreservesSnap = branches.every((branch) => {
        const style = this._window?.getComputedStyle?.(branch)
          || globalThis.getComputedStyle?.(branch)
          || null;
        return String(style?.scrollSnapAlign || '').split(/\s+/)
          .includes(declaredTopology.branchScrollSnapAlign);
      });
      if (!everyBranchPreservesSnap) {
        this.reset();
        return {
          status: 'unsafe',
          capability: adapter.capability,
          reasons: ['feed_endpoint_adapter_topology_mismatch'],
        };
      }
    }
    const followingNodeCount = followingNodes.length;
    if (followingNodeCount === 0) {
      this.reset();
      return {
        status: 'pending',
        capability: adapter.capability,
        reasons: ['feed_endpoint_future_supply_missing'],
      };
    }
    if (followingNodeCount > this._maxQuarantineNodes) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_quarantine_bound_exceeded'],
      };
    }

    const currentPosition = readScrollerPosition(scroller, this._window, this._document);
    const boundaryMotionProfile = resolveFeedEndpointBoundaryMotionProfile({
      capability: adapter.capability,
      surfaceMode,
      viewportHeight: viewport.height,
      reducedMotion: prefersReducedMotion(this._window),
    });
    const tailPaintProfile = resolveFeedEndpointTailPaintProfile({
      surfaceMode,
    });
    const restEdgePosition = viewport.bottom;
    let maxTravel = viewport.height * CONTINUOUS_MAX_TRAVEL_RATIO;
    let boundaryEdge = Number.isFinite(completedWrapRowBoundaryEdge)
      ? completedWrapRowBoundaryEdge
      : anchorBranchRect.bottom;
    if (surfaceMode === 'paged') {
      const coverage = visiblePixels(anchorRect, viewport) / Math.max(1, anchorRect.height);
      if (coverage < PAGED_MIN_COVERAGE_RATIO) {
        this.reset();
        return {
          status: 'pending',
          capability: adapter.capability,
          reasons: ['paged_endpoint_anchor_not_dominant'],
        };
      }
      maxTravel = viewport.height * PAGED_MAX_TRAVEL_RATIO;
      if (
        declaredTopology?.boundaryBasis
        === BOUNDARY_BASIS_NEXT_CONTAINMENT_START
      ) {
        const followingBranchRect = readRect(followingNodes[0]);
        if (!followingBranchRect || followingBranchRect.top <= anchorBranchRect.top) {
          this.reset();
          return {
            status: 'pending',
            capability: adapter.capability,
            reasons: ['feed_endpoint_following_branch_geometry_unresolved'],
          };
        }
        const nativeBranchStride = followingBranchRect.top - anchorBranchRect.top;
        boundaryEdge = followingBranchRect.top;
        maxTravel = Math.max(
          maxTravel,
          nativeBranchStride + GEOMETRY_TOLERANCE_PX,
        );
      }
    }

    // The tail is inserted after anchorBranch, not necessarily after the
    // selector-matching item nested inside it. Use the actual sibling branch
    // edge so wrappers, controls, and card chrome cannot leave the endpoint
    // below an unreachable hard boundary.
    const supplyBoundaryTravelPx = boundaryEdge - (
      surfaceMode === 'paged' ? viewport.top : restEdgePosition
    );
    if (supplyBoundaryTravelPx < -GEOMETRY_TOLERANCE_PX) {
      this.reset();
      return {
        status: 'pending',
        capability: adapter.capability,
        reasons: ['feed_endpoint_anchor_past_rest_edge'],
      };
    }
    if (supplyBoundaryTravelPx > maxTravel) {
      this.reset();
      return {
        status: 'pending',
        capability: adapter.capability,
        reasons: ['feed_endpoint_anchor_not_consumed'],
      };
    }
    const motionEndpointEdge = boundaryEdge;
    const motionTravelPx = motionEndpointEdge - restEdgePosition + boundaryMotionProfile.revealPx;

    const laneRect = adapter.tailLayout === 'absolute_anchor_edge'
      ? readRect(lane)
      : null;
    if (
      adapter.tailLayout === 'absolute_anchor_edge'
      && (!laneRect || laneRect.width <= 0 || laneRect.height <= 0)
    ) {
      this.reset();
      return {
        status: 'pending',
        capability: adapter.capability,
        reasons: ['feed_endpoint_lane_geometry_unresolved'],
      };
    }
    const tailTopPx = adapter.tailLayout === 'absolute_anchor_edge'
      ? anchorBranchRect.bottom - laneRect.top + Math.max(0, Number(lane.scrollTop) || 0)
      : 0;
    if (!Number.isFinite(tailTopPx) || tailTopPx < 0) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_tail_geometry_invalid'],
      };
    }

    const geometry = {
      adapterId: adapter.adapterId,
      topologyId: declaredTopology?.topologyId || authority.topologyId || null,
      anchorItem,
      anchorBranch,
      lane,
      scroller,
      forwardControl: resolvedForwardControl.control?.element || null,
      anchorTop: anchorRect.top,
      anchorBottom: anchorRect.bottom,
      anchorBranchTop: anchorBranchRect.top,
      anchorBranchBottom: anchorBranchRect.bottom,
      viewportTop: viewport.top,
      viewportBottom: viewport.bottom,
      boundaryEdge,
      motionEndpointEdge,
      boundaryPosition: currentPosition + Math.max(0, motionTravelPx),
      inputCapturePosition: Math.max(0, currentPosition + Math.min(
        0, anchorBranchRect.top - viewport.top,
      )),
      tailTopPx,
    };
    if (geometryMatches(this._lastGeometry, geometry, GEOMETRY_TOLERANCE_PX)) {
      this._stableFrames += 1;
    } else {
      this._lastGeometry = geometry;
      this._stableFrames = 1;
    }

    if (this._stableFrames < this._stabilityFrames) {
      return {
        status: 'pending',
        capability: adapter.capability,
        reasons: ['feed_endpoint_geometry_warming'],
        stableFrames: this._stableFrames,
      };
    }

    const laneDisplay = laneStyle?.display || 'block';
    const laneFlexDirection = laneStyle?.flexDirection || '';
    const laneFlexWrap = laneStyle?.flexWrap || '';
    const lanePosition = laneStyle?.position || 'static';
    const wrappedRowTail = adapter.tailLayout === TAIL_LAYOUT_WRAPPED_ROW_FLOW;
    if (
      wrappedRowTail
      && (
        !laneDisplay.includes('flex')
        || !laneFlexDirection.startsWith('row')
        || !String(laneFlexWrap).toLowerCase().includes('wrap')
      )
    ) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_wrapped_row_lane_mismatch'],
      };
    }
    if (
      !wrappedRowTail
      && laneDisplay.includes('flex')
      && laneFlexDirection.startsWith('row')
    ) {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_horizontal_lane_unsupported'],
      };
    }
    if (adapter.tailLayout === 'absolute_anchor_edge' && lanePosition === 'static') {
      this.reset();
      return {
        status: 'unsafe',
        capability: adapter.capability,
        reasons: ['feed_endpoint_absolute_tail_lane_unpositioned'],
      };
    }
    const tailHeightPx = Math.ceil(viewport.height * (surfaceMode === 'paged' ? 1.08 : 1.45));
    return {
      status: 'resolved',
      capability: adapter.capability,
      reasons: ['feed_endpoint_geometry_stable', 'feed_endpoint_topology_resolved'],
      plan: {
        topologyContractVersion: authority.contractVersion,
        topologyState: authority.topologyState,
        topologySource: authority.topologySource,
        topologyEpoch: authority.topologyEpoch,
        topologyEvaluatedAt: authority.topologyEvaluatedAt,
        topologyFingerprint: authority.topologyFingerprint || '',
        topologyCertificateRevision: authority.topologyCertificateRevision || 0,
        topologyCertificateExpiresAt: authority.topologyCertificateExpiresAt || 0,
        adapterId: adapter.adapterId,
        topologyId: declaredTopology?.topologyId || authority.topologyId || '',
        mutationMode: adapter.mutationMode,
        isolationLayout: adapter.isolationLayout || null,
        tailLayout: adapter.tailLayout,
        containmentSelector,
        boundaryBasis: declaredTopology?.boundaryBasis || null,
        capability: adapter.capability,
        profileId,
        semanticSurfaceId,
        surfaceMode,
        candidateItemSelectors: selector,
        anchorItem,
        anchorBranch,
        lane,
        scroller,
        forwardControl: resolvedForwardControl.control,
        boundaryPosition: geometry.boundaryPosition,
        inputCapturePosition: geometry.inputCapturePosition,
        tailHeightPx: Math.max(320, tailHeightPx),
        tailTopPx: geometry.tailTopPx,
        boundaryMotionProfile,
        tailPaintProfile,
        maxQuarantineNodes: this._maxQuarantineNodes,
        paint: resolvePaint(lane, this._window, this._document),
        laneDisplay,
        laneFlexDirection,
        laneFlexWrap,
        completedWrapRowItemCount,
        completedWrapRowTrailingSpacePx,
        viewport: { ...viewport },
      },
    };
  }

  _reportFailure(phase, error, details = {}) {
    if (!this._onRuntimeFailure) return;
    this._onRuntimeFailure(phase, error, {
      phase,
      error: String(error?.message || error || 'FEED_ENDPOINT_BOUNDARY_RESOLUTION_FAILED'),
      ...details,
    });
  }
}

export default FeedEndpointBoundaryResolver;
