import {
  isFeedTopologyElement,
} from '../topology/feedTopologyDomFacts.js';
import {
  normalizeScroller,
} from '../resolve/ActiveScrollContainerResolver.js';

export const BOUNDARY_BASIS_ANCHOR_BRANCH_EDGE = 'anchor_branch_edge';
export const BOUNDARY_BASIS_COMPLETED_WRAP_ROW_EDGE = 'completed_wrap_row_edge';
export const BOUNDARY_BASIS_NEXT_CONTAINMENT_START = 'next_containment_start';
export const TAIL_LAYOUT_WRAPPED_ROW_FLOW = 'wrapped_row_flow';

/**
 * Reconciles optional gesture-derived scroller evidence with the already
 * resolved shipped topology.
 *
 * Paged advances intentionally do not claim an active scroller: their
 * progression evidence is the dominant item transition. In that case the
 * exact catalog-declared scroller remains authoritative. When an advance does
 * provide a scroller, it must match the declared one exactly.
 */
export function inspectDeclaredFeedEndpointScroller(
  declaredTopology,
  requestedScroller,
  documentRef,
) {
  const declaredScroller = declaredTopology?.scroller || null;
  if (!isFeedTopologyElement(declaredScroller, documentRef)) {
    throw new Error('FEED_ENDPOINT_DECLARED_SCROLLER_REQUIRED');
  }
  if (requestedScroller === null || requestedScroller === undefined) {
    return Object.freeze({
      status: 'declared',
      scroller: declaredScroller,
    });
  }
  const observedScroller = normalizeScroller(requestedScroller, documentRef);
  return Object.freeze({
    status: observedScroller === declaredScroller ? 'matched' : 'mismatch',
    scroller: declaredScroller,
    observedScroller,
  });
}

function requireDeclaredTopologySelector(topology, key) {
  const value = topology?.[key];
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new Error(`FEED_ENDPOINT_ADAPTER_TOPOLOGY_${key.toUpperCase()}_INVALID`);
  }
  return value;
}

function readDeclaredTopologyEnum(topology, key, allowedValues) {
  const value = topology?.[key];
  if (value === null || value === undefined) return null;
  if (!allowedValues.includes(value)) {
    throw new Error(`FEED_ENDPOINT_ADAPTER_TOPOLOGY_${key.toUpperCase()}_INVALID`);
  }
  return value;
}

/**
 * Resolves the exact shipped catalog tuple against the current document.
 *
 * This seam is intentionally read-only and shared by both the early shipped
 * health probe and the final boundary resolver. Keeping the selector semantics
 * here prevents those two readers from drifting while FeedEndpointLease
 * remains the only endpoint DOM writer.
 */
export function inspectDeclaredFeedEndpointTopology(
  referenceItem,
  adapter,
  windowRef,
  documentRef,
) {
  const topology = adapter?.endpointTopology;
  if (!topology) return null;
  const topologyId = requireDeclaredTopologySelector(topology, 'topologyId');
  const anchorBranchSelector = requireDeclaredTopologySelector(
    topology,
    'anchorBranchSelector',
  );
  const laneSelector = requireDeclaredTopologySelector(topology, 'laneSelector');
  const scrollerSelector = requireDeclaredTopologySelector(topology, 'scrollerSelector');
  const containmentSelector = requireDeclaredTopologySelector(
    topology,
    'containmentSelector',
  );
  const boundaryBasis = readDeclaredTopologyEnum(
    topology,
    'boundaryBasis',
    [
      BOUNDARY_BASIS_ANCHOR_BRANCH_EDGE,
      BOUNDARY_BASIS_COMPLETED_WRAP_ROW_EDGE,
      BOUNDARY_BASIS_NEXT_CONTAINMENT_START,
    ],
  );
  const scrollerScrollSnapAxis = readDeclaredTopologyEnum(
    topology,
    'scrollerScrollSnapAxis',
    ['x', 'y'],
  );
  const branchScrollSnapAlign = readDeclaredTopologyEnum(
    topology,
    'branchScrollSnapAlign',
    ['start', 'center', 'end'],
  );
  if (
    (
      adapter?.capability === 'paged_hold'
      && boundaryBasis !== BOUNDARY_BASIS_NEXT_CONTAINMENT_START
    )
    || (
      adapter?.capability === 'anchored_continuous'
      && boundaryBasis !== (
        adapter?.tailLayout === TAIL_LAYOUT_WRAPPED_ROW_FLOW
          ? BOUNDARY_BASIS_COMPLETED_WRAP_ROW_EDGE
          : BOUNDARY_BASIS_ANCHOR_BRANCH_EDGE
      )
    )
  ) {
    throw new Error(`FEED_ENDPOINT_ADAPTER_TOPOLOGY_BOUNDARY_BASIS_INVALID:${topologyId}`);
  }

  try {
    const anchorBranch = referenceItem?.closest?.(anchorBranchSelector) || null;
    const lane = anchorBranch?.parentElement || null;
    const scroller = lane?.closest?.(scrollerSelector) || null;
    const scrollerStyle = scrollerScrollSnapAxis && isFeedTopologyElement(scroller, documentRef)
      ? windowRef?.getComputedStyle?.(scroller)
        || globalThis.getComputedStyle?.(scroller)
        || null
      : null;
    const branchStyle = branchScrollSnapAlign && isFeedTopologyElement(anchorBranch, documentRef)
      ? windowRef?.getComputedStyle?.(anchorBranch)
        || globalThis.getComputedStyle?.(anchorBranch)
        || null
      : null;
    if (
      !isFeedTopologyElement(anchorBranch, documentRef)
      || !anchorBranch.matches(containmentSelector)
      || !isFeedTopologyElement(lane, documentRef)
      || !lane.matches(laneSelector)
      || !isFeedTopologyElement(scroller, documentRef)
      || !scroller.contains(lane)
      || (
        scrollerScrollSnapAxis
        && !String(scrollerStyle?.scrollSnapType || '').startsWith(
          `${scrollerScrollSnapAxis} `,
        )
      )
      || (
        branchScrollSnapAlign
        && !String(branchStyle?.scrollSnapAlign || '').split(/\s+/)
          .includes(branchScrollSnapAlign)
      )
    ) {
      return {
        status: 'mismatch',
        topologyId,
      };
    }
    return {
      status: 'resolved',
      topologyId,
      anchorBranchSelector,
      containmentSelector,
      boundaryBasis,
      scrollerScrollSnapAxis,
      branchScrollSnapAlign,
      lane,
      scroller,
    };
  } catch (error) {
    throw new Error(
      `FEED_ENDPOINT_ADAPTER_TOPOLOGY_SELECTOR_INVALID:${topologyId}`,
      { cause: error },
    );
  }
}

export default inspectDeclaredFeedEndpointTopology;
