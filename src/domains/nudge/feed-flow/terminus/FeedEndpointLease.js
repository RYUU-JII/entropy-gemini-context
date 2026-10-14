import observerHub from '../../../../lib/dom/ObserverHub.js';
import {
  FEED_TOPOLOGY_AUTHORITY_SOURCES,
  FEED_TOPOLOGY_AUTHORITY_STATES,
  FEED_TOPOLOGY_AUTHORITY_VERSION,
} from '../../../protection/contracts/feedTopologyAuthorityContract.js';
import FeedEndpointBoundaryMotion from './FeedEndpointBoundaryMotion.js';
import FeedEndpointForwardControlLease from './FeedEndpointForwardControlLease.js';
import {
  FEED_ENDPOINT_TAIL_PAINT_MODES,
} from './feedEndpointTailPaintProfile.js';
import {
  validateFeedEndpointForwardControlContract,
  validateFeedEndpointSurfacePlanContract,
} from '../contracts/feedEndpointPlanContract.js';

const MARKER_ID = 'entropy-feed-endpoint-marker';
const TAIL_ID = 'entropy-feed-endpoint-tail';
const QUARANTINE_ID = 'entropy-feed-endpoint-quarantine';
const ENDPOINT_OWNERSHIP_PROPERTY = '__entropyFeedEndpointOwnershipV1';
const SIBLING_QUARANTINE_MODE = 'sibling_quarantine';
const SIBLING_INERT_ISOLATION_MODE = 'sibling_inert_isolation';
const COLLAPSE_ISOLATION_LAYOUT = 'collapse';
const PRESERVE_ISOLATION_LAYOUT = 'preserve';
const FLOW_TAIL_LAYOUT = 'flow';
const ABSOLUTE_ANCHOR_EDGE_TAIL_LAYOUT = 'absolute_anchor_edge';
const WRAPPED_ROW_FLOW_TAIL_LAYOUT = 'wrapped_row_flow';
const SUPPORTED_ISOLATION_LAYOUTS = new Set([
  COLLAPSE_ISOLATION_LAYOUT,
  PRESERVE_ISOLATION_LAYOUT,
]);
const SUPPORTED_MUTATION_MODES = new Set([
  SIBLING_QUARANTINE_MODE,
  SIBLING_INERT_ISOLATION_MODE,
]);
const SUPPORTED_TAIL_LAYOUTS = new Set([
  FLOW_TAIL_LAYOUT,
  ABSOLUTE_ANCHOR_EDGE_TAIL_LAYOUT,
  WRAPPED_ROW_FLOW_TAIL_LAYOUT,
]);
const ISOLATION_ATTRIBUTES = Object.freeze({
  marker: 'data-entropy-feed-endpoint-isolated',
  displayValue: 'data-entropy-feed-endpoint-display-value',
  displayPriority: 'data-entropy-feed-endpoint-display-priority',
  visibilityValue: 'data-entropy-feed-endpoint-visibility-value',
  visibilityPriority: 'data-entropy-feed-endpoint-visibility-priority',
  isolationLayout: 'data-entropy-feed-endpoint-isolation-layout',
  inertPresent: 'data-entropy-feed-endpoint-inert-present',
  inertValue: 'data-entropy-feed-endpoint-inert-value',
  inertBoolean: 'data-entropy-feed-endpoint-inert-boolean',
  ariaHiddenPresent: 'data-entropy-feed-endpoint-aria-hidden-present',
  ariaHiddenValue: 'data-entropy-feed-endpoint-aria-hidden-value',
});
const ISOLATED_ELEMENT_SELECTOR = `[${ISOLATION_ATTRIBUTES.marker}="true"]`;

function isElement(node, documentRef) {
  const ElementCtor = documentRef?.defaultView?.Element || globalThis.Element;
  return typeof ElementCtor === 'function' && node instanceof ElementCtor;
}

function matchesPlanContainment(node, plan, documentRef) {
  const selector = plan?.containmentSelector;
  if (!selector) return true;
  return isElement(node, documentRef) && node.matches(selector);
}

function getErrorMessage(error, fallback = 'FEED_ENDPOINT_LEASE_FAILURE') {
  return String(error?.message || error || fallback);
}

function createLeaseError(message, cause = null) {
  const error = new Error(message);
  if (cause) error.cause = cause;
  return error;
}

function applyTailLayout(tail, plan) {
  const tailHeightPx = plan.tailHeightPx;
  tail.setAttribute('aria-hidden', 'false');
  tail.dataset.entropyFeedEndpointTail = 'true';
  tail.dataset.entropyFeedEndpointTailLayout = plan.tailLayout;
  tail.dataset.entropyFeedEndpointAdapter = plan.adapterId;
  tail.dataset.entropyFeedEndpointProfile = plan.profileId;
  tail.dataset.entropyFeedEndpointSurfaceMode = plan.surfaceMode;
  tail.dataset.entropyFeedEndpointSemanticSurface = plan.semanticSurfaceId;
  tail.dataset.entropyFeedEndpointTopologyAuthority = plan.topologyState;
  tail.dataset.entropyFeedEndpointTopologyEpoch = String(plan.topologyEpoch);
  tail.dataset.entropyFeedEndpointMotion = plan.boundaryMotionProfile.mode;
  tail.dataset.entropyFeedEndpointReveal = String(plan.boundaryMotionProfile.revealPx);
  tail.dataset.entropyFeedEndpointEdge = plan.boundaryMotionProfile.endpointEdge;
  tail.dataset.entropyFeedEndpointTailPaint = plan.tailPaintProfile.mode;
  tail.dataset.entropyFeedEndpointMaximumDisplacement = String(
    plan.boundaryMotionProfile.maximumDisplacementPx,
  );
  if (plan.boundaryBasis) {
    tail.dataset.entropyFeedEndpointBoundaryBasis = plan.boundaryBasis;
  }
  if (Number.isSafeInteger(plan.completedWrapRowItemCount)) {
    tail.dataset.entropyFeedEndpointCompletedWrapRowItemCount = String(
      plan.completedWrapRowItemCount,
    );
  }
  if (plan.topologyId) {
    tail.dataset.entropyFeedEndpointTopology = plan.topologyId;
  }
  tail.style.setProperty('box-sizing', 'border-box', 'important');
  tail.style.setProperty('display', 'block', 'important');
  tail.style.setProperty('min-height', `${tailHeightPx}px`, 'important');
  tail.style.setProperty('overflow', 'hidden', 'important');
  const tailBackground = (
    plan.tailPaintProfile.mode
    === FEED_ENDPOINT_TAIL_PAINT_MODES.TRANSPARENT_NATIVE_BLEED
  )
    ? 'transparent'
    : plan.paint.backgroundColor;
  tail.style.setProperty('background-color', tailBackground, 'important');
  tail.style.setProperty('color', plan.paint.color, 'important');
  tail.style.setProperty('overscroll-behavior', 'contain', 'important');

  if (plan.tailLayout === ABSOLUTE_ANCHOR_EDGE_TAIL_LAYOUT) {
    tail.style.setProperty('position', 'absolute', 'important');
    tail.style.setProperty('top', `${Math.round(plan.tailTopPx)}px`, 'important');
    tail.style.setProperty('left', '0', 'important');
    tail.style.setProperty('right', '0', 'important');
    tail.style.setProperty('width', 'auto', 'important');
  } else {
    tail.style.setProperty('position', 'relative', 'important');
    tail.style.setProperty('width', '100%', 'important');
  }

  const display = String(plan.laneDisplay || '').toLowerCase();
  const flexDirection = String(plan.laneFlexDirection || '').toLowerCase();
  if (
    plan.tailLayout === FLOW_TAIL_LAYOUT
    && display.includes('flex')
    && !flexDirection.startsWith('row')
  ) {
    tail.style.setProperty('flex', `0 0 ${tailHeightPx}px`, 'important');
    tail.style.setProperty('align-self', 'stretch', 'important');
  } else if (plan.tailLayout === FLOW_TAIL_LAYOUT && display.includes('grid')) {
    tail.style.setProperty('grid-column', '1 / -1', 'important');
  } else if (plan.tailLayout === WRAPPED_ROW_FLOW_TAIL_LAYOUT) {
    tail.style.setProperty('flex', '0 0 100%', 'important');
    tail.style.setProperty('min-width', '100%', 'important');
    tail.style.setProperty('max-width', '100%', 'important');
    tail.style.setProperty('align-self', 'stretch', 'important');
  }
  if (plan.surfaceMode === 'paged') {
    tail.style.setProperty('scroll-snap-align', 'start', 'important');
    tail.style.setProperty('scroll-snap-stop', 'always', 'important');
  }
}

function isNode(node, documentRef) {
  const NodeCtor = documentRef?.defaultView?.Node || globalThis.Node;
  return typeof NodeCtor === 'function' && node instanceof NodeCtor;
}

function removeOwnedArtifact(node) {
  if (!node?.parentNode) return;
  node.parentNode.removeChild(node);
}

function isRestorableTrackedNode(node, { lane, anchorBranch, quarantine }) {
  if (!node?.isConnected) return true;
  if (quarantine?.contains?.(node)) return true;
  if (node.parentNode !== lane) return false;
  const children = Array.from(lane.childNodes);
  return children.indexOf(node) > children.indexOf(anchorBranch);
}

function restoreQuarantinedEndpoint(ownership, documentRef) {
  const lane = ownership?.lane || null;
  const anchorBranch = ownership?.anchorBranch || null;
  if (!isElement(lane, documentRef)) {
    throw new Error('FEED_ENDPOINT_RESTORE_LANE_INVALID');
  }
  if (!isElement(anchorBranch, documentRef) || anchorBranch.parentNode !== lane) {
    throw new Error('FEED_ENDPOINT_RESTORE_ANCHOR_INVALID');
  }

  const artifacts = new Set([
    ownership?.marker,
    ownership?.tail,
    ownership?.quarantine,
  ].filter(Boolean));
  const orderedNodes = [];
  const seen = new Set();
  const appendRestorableNode = (node) => {
    if (!isNode(node, documentRef) || artifacts.has(node) || seen.has(node)) return;
    seen.add(node);
    orderedNodes.push(node);
  };
  (ownership?.quarantinedNodes || []).forEach(appendRestorableNode);
  Array.from(ownership?.quarantine?.childNodes || []).forEach(appendRestorableNode);
  const ownershipLost = orderedNodes.some((node) => !isRestorableTrackedNode(node, {
    lane,
    anchorBranch,
    quarantine: ownership?.quarantine || null,
  }));
  if (ownershipLost) {
    throw new Error('FEED_ENDPOINT_TRACKED_NODE_OWNERSHIP_LOST');
  }

  const fragment = documentRef.createDocumentFragment();
  orderedNodes.forEach((node) => fragment.appendChild(node));
  lane.insertBefore(fragment, anchorBranch.nextSibling);

  let cursor = anchorBranch.nextSibling;
  orderedNodes.forEach((node) => {
    if (cursor !== node || node.parentNode !== lane) {
      throw new Error('FEED_ENDPOINT_RESTORE_ORDER_UNCONFIRMED');
    }
    cursor = cursor.nextSibling;
  });

  artifacts.forEach((artifact) => removeOwnedArtifact(artifact));
  artifacts.forEach((artifact) => delete artifact[ENDPOINT_OWNERSHIP_PROPERTY]);
  return true;
}

function readIsolationSnapshot(node, documentRef) {
  if (
    !isElement(node, documentRef)
    || node.getAttribute(ISOLATION_ATTRIBUTES.marker) !== 'true'
  ) {
    throw new Error('FEED_ENDPOINT_ISOLATION_METADATA_MISSING');
  }
  const requiredAttributes = [
    ISOLATION_ATTRIBUTES.displayValue,
    ISOLATION_ATTRIBUTES.displayPriority,
    ISOLATION_ATTRIBUTES.visibilityValue,
    ISOLATION_ATTRIBUTES.visibilityPriority,
    ISOLATION_ATTRIBUTES.isolationLayout,
    ISOLATION_ATTRIBUTES.inertPresent,
    ISOLATION_ATTRIBUTES.inertValue,
    ISOLATION_ATTRIBUTES.inertBoolean,
    ISOLATION_ATTRIBUTES.ariaHiddenPresent,
    ISOLATION_ATTRIBUTES.ariaHiddenValue,
  ];
  if (requiredAttributes.some((attribute) => !node.hasAttribute(attribute))) {
    throw new Error('FEED_ENDPOINT_ISOLATION_METADATA_INCOMPLETE');
  }
  const isolationLayout = node.getAttribute(ISOLATION_ATTRIBUTES.isolationLayout);
  if (!SUPPORTED_ISOLATION_LAYOUTS.has(isolationLayout)) {
    throw new Error('FEED_ENDPOINT_ISOLATION_LAYOUT_INVALID');
  }
  return {
    node,
    displayValue: node.getAttribute(ISOLATION_ATTRIBUTES.displayValue) || '',
    displayPriority: node.getAttribute(ISOLATION_ATTRIBUTES.displayPriority) || '',
    visibilityValue: node.getAttribute(ISOLATION_ATTRIBUTES.visibilityValue) || '',
    visibilityPriority: node.getAttribute(ISOLATION_ATTRIBUTES.visibilityPriority) || '',
    isolationLayout,
    inertPresent: node.getAttribute(ISOLATION_ATTRIBUTES.inertPresent) === 'true',
    inertValue: node.getAttribute(ISOLATION_ATTRIBUTES.inertValue) || '',
    inertBoolean: node.getAttribute(ISOLATION_ATTRIBUTES.inertBoolean) === 'true',
    ariaHiddenPresent: node.getAttribute(ISOLATION_ATTRIBUTES.ariaHiddenPresent) === 'true',
    ariaHiddenValue: node.getAttribute(ISOLATION_ATTRIBUTES.ariaHiddenValue) || '',
  };
}

function enforceIsolatedElementState(node, isolationLayout) {
  if (isolationLayout === COLLAPSE_ISOLATION_LAYOUT) {
    if (
      node.style.getPropertyValue('display') !== 'none'
      || node.style.getPropertyPriority('display') !== 'important'
    ) {
      node.style.setProperty('display', 'none', 'important');
    }
  } else if (isolationLayout === PRESERVE_ISOLATION_LAYOUT) {
    if (
      node.style.getPropertyValue('visibility') !== 'hidden'
      || node.style.getPropertyPriority('visibility') !== 'important'
    ) {
      node.style.setProperty('visibility', 'hidden', 'important');
    }
  } else {
    throw new Error('FEED_ENDPOINT_ISOLATION_LAYOUT_INVALID');
  }
  if (node.inert !== true) node.inert = true;
  if (node.getAttribute('aria-hidden') !== 'true') {
    node.setAttribute('aria-hidden', 'true');
  }
}

function isolateElement(node, documentRef, isolationLayout) {
  if (!isElement(node, documentRef)) return false;
  if (node.getAttribute(ISOLATION_ATTRIBUTES.marker) === 'true') {
    const snapshot = readIsolationSnapshot(node, documentRef);
    if (snapshot.isolationLayout !== isolationLayout) {
      throw new Error('FEED_ENDPOINT_ISOLATION_LAYOUT_MISMATCH');
    }
  } else {
    if (!SUPPORTED_ISOLATION_LAYOUTS.has(isolationLayout)) {
      throw new Error('FEED_ENDPOINT_ISOLATION_LAYOUT_INVALID');
    }
    node.setAttribute(ISOLATION_ATTRIBUTES.marker, 'true');
    node.setAttribute(
      ISOLATION_ATTRIBUTES.displayValue,
      node.style.getPropertyValue('display'),
    );
    node.setAttribute(
      ISOLATION_ATTRIBUTES.displayPriority,
      node.style.getPropertyPriority('display'),
    );
    node.setAttribute(
      ISOLATION_ATTRIBUTES.visibilityValue,
      node.style.getPropertyValue('visibility'),
    );
    node.setAttribute(
      ISOLATION_ATTRIBUTES.visibilityPriority,
      node.style.getPropertyPriority('visibility'),
    );
    node.setAttribute(ISOLATION_ATTRIBUTES.isolationLayout, isolationLayout);
    node.setAttribute(
      ISOLATION_ATTRIBUTES.inertPresent,
      node.hasAttribute('inert') ? 'true' : 'false',
    );
    node.setAttribute(
      ISOLATION_ATTRIBUTES.inertValue,
      node.getAttribute('inert') || '',
    );
    node.setAttribute(
      ISOLATION_ATTRIBUTES.inertBoolean,
      node.inert === true ? 'true' : 'false',
    );
    node.setAttribute(
      ISOLATION_ATTRIBUTES.ariaHiddenPresent,
      node.hasAttribute('aria-hidden') ? 'true' : 'false',
    );
    node.setAttribute(
      ISOLATION_ATTRIBUTES.ariaHiddenValue,
      node.getAttribute('aria-hidden') || '',
    );
  }
  enforceIsolatedElementState(node, isolationLayout);
  return true;
}

function restoreIsolatedElement(snapshot) {
  const { node } = snapshot;
  if (snapshot.displayValue) {
    node.style.setProperty('display', snapshot.displayValue, snapshot.displayPriority);
  } else {
    node.style.removeProperty('display');
  }
  if (snapshot.visibilityValue) {
    node.style.setProperty(
      'visibility',
      snapshot.visibilityValue,
      snapshot.visibilityPriority,
    );
  } else {
    node.style.removeProperty('visibility');
  }
  if (snapshot.inertPresent) {
    node.setAttribute('inert', snapshot.inertValue);
  } else {
    node.removeAttribute('inert');
  }
  node.inert = snapshot.inertBoolean;
  if (snapshot.ariaHiddenPresent) {
    node.setAttribute('aria-hidden', snapshot.ariaHiddenValue);
  } else {
    node.removeAttribute('aria-hidden');
  }
  Object.values(ISOLATION_ATTRIBUTES).forEach((attribute) => node.removeAttribute(attribute));
}

function restoreInertIsolationEndpoint(ownership, documentRef) {
  const artifacts = new Set([
    ownership?.marker,
    ownership?.tail,
    ownership?.quarantine,
  ].filter(Boolean));
  const artifactsPresent = Array.from(artifacts).some((artifact) => artifact?.parentNode);
  const isolated = [];
  const seen = new Set();
  let trackedMetadataMissing = false;
  const appendIsolated = (node) => {
    if (!isElement(node, documentRef) || seen.has(node)) return;
    seen.add(node);
    if (node.getAttribute(ISOLATION_ATTRIBUTES.marker) !== 'true') {
      trackedMetadataMissing = true;
      return;
    }
    isolated.push(node);
  };
  (ownership?.isolatedNodes || []).forEach(appendIsolated);
  Array.from(documentRef.querySelectorAll?.(ISOLATED_ELEMENT_SELECTOR) || [])
    .forEach(appendIsolated);
  if (trackedMetadataMissing && artifactsPresent) {
    throw new Error('FEED_ENDPOINT_ISOLATION_METADATA_MISSING');
  }

  const snapshots = isolated.map((node) => readIsolationSnapshot(node, documentRef));
  snapshots.forEach(restoreIsolatedElement);
  artifacts.forEach((artifact) => removeOwnedArtifact(artifact));
  artifacts.forEach((artifact) => delete artifact[ENDPOINT_OWNERSHIP_PROPERTY]);
  return true;
}

function restoreOwnedEndpoint(ownership, documentRef) {
  if (ownership?.mutationMode === SIBLING_QUARANTINE_MODE) {
    return restoreQuarantinedEndpoint(ownership, documentRef);
  }
  if (ownership?.mutationMode === SIBLING_INERT_ISOLATION_MODE) {
    return restoreInertIsolationEndpoint(ownership, documentRef);
  }
  throw new Error(`FEED_ENDPOINT_MUTATION_MODE_UNSUPPORTED:${String(ownership?.mutationMode || '')}`);
}

function resolveStructuralOrphanOwnership(artifacts, documentRef) {
  const markers = artifacts.filter((node) => node?.id === MARKER_ID);
  const tails = artifacts.filter((node) => node?.id === TAIL_ID);
  const quarantines = artifacts.filter((node) => node?.id === QUARANTINE_ID);
  if (markers.length !== 1 || tails.length !== 1 || quarantines.length !== 1) return null;
  const [marker] = markers;
  const [tail] = tails;
  const [quarantine] = quarantines;
  const lane = marker.parentNode;
  const anchorBranch = marker.previousSibling;
  if (
    !isElement(lane, documentRef)
    || !lane.isConnected
    || !isElement(anchorBranch, documentRef)
    || anchorBranch.parentNode !== lane
    || marker.nextSibling !== tail
    || tail.nextSibling !== quarantine
    || quarantine.parentNode !== lane
  ) return null;
  const mutationMode = quarantine.dataset.entropyFeedEndpointMutationMode;
  if (!SUPPORTED_MUTATION_MODES.has(mutationMode)) return null;
  return {
    lane,
    anchorBranch,
    marker,
    tail,
    quarantine,
    mutationMode,
    quarantinedNodes: mutationMode === SIBLING_QUARANTINE_MODE
      ? Array.from(quarantine.childNodes)
      : [],
    isolatedNodes: mutationMode === SIBLING_INERT_ISOLATION_MODE
      ? Array.from(documentRef.querySelectorAll?.(ISOLATED_ELEMENT_SELECTOR) || [])
      : [],
  };
}

/**
 * Recovers an endpoint left behind by a previous content-runtime instance.
 * Quarantined site nodes remain connected under the extension-owned container,
 * so a reinjected manager can restore them without retaining old JS references.
 */
export function restoreOrphanedFeedEndpoints(documentRef = typeof document !== 'undefined' ? document : null) {
  if (!documentRef) return true;
  const artifacts = Array.from(documentRef.querySelectorAll?.(
    `#${MARKER_ID}, #${TAIL_ID}, #${QUARANTINE_ID}`,
  ) || []);
  if (artifacts.length === 0) {
    if (documentRef.querySelector?.(ISOLATED_ELEMENT_SELECTOR)) {
      throw new Error('FEED_ENDPOINT_ORPHAN_ARTIFACTS_MISSING');
    }
    return true;
  }

  const ownershipRecords = [];
  const seen = new Set();
  artifacts.forEach((artifact) => {
    const ownership = artifact?.[ENDPOINT_OWNERSHIP_PROPERTY] || null;
    if (!ownership || seen.has(ownership)) return;
    seen.add(ownership);
    ownershipRecords.push(ownership);
  });
  if (ownershipRecords.length === 0) {
    const structuralOwnership = resolveStructuralOrphanOwnership(artifacts, documentRef);
    if (!structuralOwnership) throw new Error('FEED_ENDPOINT_ORPHAN_OWNERSHIP_MISSING');
    ownershipRecords.push(structuralOwnership);
  }
  ownershipRecords.forEach((ownership) => restoreOwnedEndpoint(ownership, documentRef));

  const remaining = Array.from(documentRef.querySelectorAll?.(
    `#${MARKER_ID}, #${TAIL_ID}, #${QUARANTINE_ID}`,
  ) || []);
  if (remaining.length > 0) {
    throw new Error('FEED_ENDPOINT_ORPHAN_RESTORE_INCOMPLETE');
  }
  return true;
}

export class FeedEndpointLease {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    orchestrator = null,
    boundaryMotion = null,
    forwardControlLease = null,
    mutationHub = observerHub,
    onRuntimeFailure = null,
    now = () => Date.now(),
  } = {}) {
    if (typeof now !== 'function') {
      throw new Error('FEED_ENDPOINT_LEASE_CLOCK_REQUIRED');
    }
    this._window = windowRef;
    this._document = documentRef;
    this._orchestrator = orchestrator;
    this._boundaryMotion = boundaryMotion || new FeedEndpointBoundaryMotion({
      windowRef,
      documentRef,
      readNow: now,
    });
    this._forwardControlLease = forwardControlLease
      || new FeedEndpointForwardControlLease({ documentRef });
    this._mutationHub = mutationHub;
    this._onRuntimeFailure = typeof onRuntimeFailure === 'function' ? onRuntimeFailure : null;
    this._now = now;
    this._boundScroll = () => this._handleScroll();
    this._boundMutations = (payload) => this._handleMutations(payload);
    this._state = 'idle';
    this._plan = null;
    this._marker = null;
    this._tail = null;
    this._quarantine = null;
    this._ownership = null;
    this._mutationUnsub = null;
    this._scrollAttached = false;
    this._boundaryEngaged = false;
    this._boundaryReached = false;
    this._callbacks = {};
    this._reconciling = false;
    this._invalidating = false;
  }

  getState() {
    return this._state;
  }

  isCommitted() {
    return this._state === 'committed';
  }

  isBoundaryReached() {
    return this.isCommitted() && this._boundaryReached;
  }

  getMountTarget() {
    return this.isCommitted() && this._tail?.isConnected ? this._tail : null;
  }

  getPlan() {
    return this._plan;
  }

  getBoundaryMotionState() {
    this._boundaryMotion.synchronize?.();
    return this._boundaryMotion.getState();
  }

  shouldCaptureForwardInput() {
    if (!this.isCommitted()) return false;
    return this._boundaryMotion.shouldCaptureForwardInput();
  }

  applyForwardIntent(deltaPx, ts = Date.now(), input) {
    if (!this.isCommitted()) return false;
    try {
      const applied = this._boundaryMotion.applyForwardIntent(deltaPx, ts, input);
      this._syncForwardControlState();
      return applied;
    } catch (error) {
      this._invalidate('feed_endpoint_forward_apply_failed', {
        error: getErrorMessage(error),
        deltaPx: Math.max(0, Number(deltaPx) || 0),
      });
      return false;
    }
  }

  applyBackwardIntent() {
    if (!this.isCommitted()) return false;
    try {
      this._callbacks.onBackwardIntent?.(this._readNow());
      const prepared = this._boundaryMotion.prepareBackwardInput();
      this._syncForwardControlState();
      return prepared;
    } catch (error) {
      this._invalidate('feed_endpoint_backward_prepare_failed', {
        error: getErrorMessage(error),
      });
      return false;
    }
  }

  commit(plan, callbacks = {}) {
    if (this.isCommitted()) {
      if (this._plan?.anchorBranch === plan?.anchorBranch && this._plan?.lane === plan?.lane) return true;
      throw new Error('FEED_ENDPOINT_LEASE_ALREADY_COMMITTED');
    }
    this._assertPlan(plan);
    this._state = 'committing';
    this._plan = plan;
    this._callbacks = callbacks && typeof callbacks === 'object' ? callbacks : {};

    try {
      if (plan.forwardControl) {
        this._forwardControlLease.acquire(plan.forwardControl);
      }
      this._createDomEndpoint();
      this._attachMutationOwner();
      this._attachScrollGuard();
      this._engageForwardBoundary();
      this._state = 'committed';
      this._reconcileBoundaryPosition();
      return true;
    } catch (error) {
      const rollbackError = this._rollbackCommit();
      if (rollbackError && error && typeof error === 'object') error.rollbackError = rollbackError;
      this._reportFailure('feed_endpoint_commit', error, {
        adapterId: plan?.adapterId || '',
        profileId: plan?.profileId || '',
        surfaceMode: plan?.surfaceMode || 'unknown',
      });
      throw error;
    }
  }

  release() {
    if (this._state === 'idle') return true;
    if (this._state !== 'committed') {
      throw new Error(`FEED_ENDPOINT_LEASE_RELEASE_STATE_INVALID:${this._state}`);
    }

    this._state = 'releasing';
    try {
      this._releaseForwardBoundary();
      this._detachScrollGuard();
      this._detachMutationOwner();
      this._forwardControlLease.release();
      this._restoreDomEndpoint();
      this._resetLocalState();
      return true;
    } catch (error) {
      this._state = 'committed';
      try {
        if (!this._boundaryEngaged) this._engageForwardBoundary();
        if (
          this._plan?.forwardControl
          && this._forwardControlLease.getState().acquired !== true
        ) {
          this._forwardControlLease.acquire(this._plan.forwardControl);
        }
        this._syncForwardControlState();
        if (!this._scrollAttached) this._attachScrollGuard();
        if (!this._mutationUnsub) this._attachMutationOwner();
      } catch (restoreError) {
        if (error && typeof error === 'object') error.leaseRestoreError = restoreError;
      }
      this._reportFailure('feed_endpoint_release', error, {
        adapterId: this._plan?.adapterId || '',
      });
      throw error;
    }
  }

  validate() {
    if (!this.isCommitted()) return false;
    if (
      this._plan?.topologySource === FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED
      && this._plan.topologyCertificateExpiresAt <= this._readNow()
    ) {
      this._invalidate('feed_topology_local_certificate_expired');
      return false;
    }
    if (!this._ownsCommittedDom({ allowInterleaved: true })) {
      this._invalidate('feed_endpoint_dom_ownership_lost');
      return false;
    }
    this._containFollowingNodes();
    if (!this.isCommitted() || !this._ownsCommittedDom()) return false;
    if (!this._forwardControlLease.validate()) {
      this._invalidate('feed_endpoint_forward_control_disconnected');
      return false;
    }
    if (this._boundaryReached) this._reconcileBoundaryGeometry();
    this._reconcileBoundaryPosition();
    return this.isCommitted();
  }

  _assertPlan(plan) {
    if (!plan || typeof plan !== 'object') throw new Error('FEED_ENDPOINT_PLAN_REQUIRED');
    if (plan.topologyContractVersion !== FEED_TOPOLOGY_AUTHORITY_VERSION) {
      throw new Error('FEED_ENDPOINT_TOPOLOGY_CONTRACT_INVALID');
    }
    const shippedAuthority = (
      plan.topologyState === FEED_TOPOLOGY_AUTHORITY_STATES.CANONICAL_VERIFIED
      && plan.topologySource === FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE
    );
    const localAuthority = (
      plan.topologyState === FEED_TOPOLOGY_AUTHORITY_STATES.LOCALLY_CERTIFIED
      && plan.topologySource === FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED
    );
    if (!shippedAuthority && !localAuthority) {
      throw new Error('FEED_ENDPOINT_TOPOLOGY_AUTHORITY_PAIR_UNAUTHORIZED');
    }
    if (!Number.isSafeInteger(plan.topologyEpoch) || plan.topologyEpoch <= 0) {
      throw new Error('FEED_ENDPOINT_TOPOLOGY_EPOCH_INVALID');
    }
    if (
      localAuthority
      && (
        plan.topologyState !== FEED_TOPOLOGY_AUTHORITY_STATES.LOCALLY_CERTIFIED
        || typeof plan.topologyFingerprint !== 'string'
        || !plan.topologyFingerprint.startsWith('lft1:')
        || !Number.isSafeInteger(plan.topologyCertificateRevision)
        || plan.topologyCertificateRevision <= 0
        || !Number.isSafeInteger(plan.topologyCertificateExpiresAt)
        || plan.topologyCertificateExpiresAt <= this._readNow()
      )
    ) {
      throw new Error('FEED_ENDPOINT_LOCAL_TOPOLOGY_CERTIFICATE_INVALID');
    }
    if (
      typeof plan.semanticSurfaceId !== 'string'
      || !plan.semanticSurfaceId.trim()
      || plan.semanticSurfaceId !== plan.semanticSurfaceId.trim()
    ) {
      throw new Error('FEED_ENDPOINT_SEMANTIC_SURFACE_REQUIRED');
    }
    if (!SUPPORTED_MUTATION_MODES.has(plan.mutationMode)) {
      throw new Error(`FEED_ENDPOINT_MUTATION_MODE_UNSUPPORTED:${String(plan.mutationMode || '')}`);
    }
    if (!SUPPORTED_TAIL_LAYOUTS.has(plan.tailLayout)) {
      throw new Error('FEED_ENDPOINT_TAIL_LAYOUT_INVALID');
    }
    if (
      plan.tailLayout === ABSOLUTE_ANCHOR_EDGE_TAIL_LAYOUT
      && (!Number.isFinite(Number(plan.tailTopPx)) || Number(plan.tailTopPx) < 0)
    ) {
      throw new Error('FEED_ENDPOINT_TAIL_TOP_INVALID');
    }
    if (
      plan.tailLayout === WRAPPED_ROW_FLOW_TAIL_LAYOUT
      && (
        !String(plan.laneDisplay || '').toLowerCase().includes('flex')
        || !String(plan.laneFlexDirection || '').toLowerCase().startsWith('row')
        || !String(plan.laneFlexWrap || '').toLowerCase().includes('wrap')
        || plan.boundaryBasis !== 'completed_wrap_row_edge'
        || !Number.isSafeInteger(plan.completedWrapRowItemCount)
        || plan.completedWrapRowItemCount < 1
      )
    ) {
      throw new Error('FEED_ENDPOINT_WRAPPED_ROW_LAYOUT_INVALID');
    }
    if (
      plan.mutationMode === SIBLING_INERT_ISOLATION_MODE
      && !SUPPORTED_ISOLATION_LAYOUTS.has(plan.isolationLayout)
    ) {
      throw new Error('FEED_ENDPOINT_ISOLATION_LAYOUT_INVALID');
    }
    if (!isElement(plan.lane, this._document) || !plan.lane.isConnected) {
      throw new Error('FEED_ENDPOINT_LANE_INVALID');
    }
    if (!isElement(plan.anchorBranch, this._document) || plan.anchorBranch.parentNode !== plan.lane) {
      throw new Error('FEED_ENDPOINT_ANCHOR_BRANCH_INVALID');
    }
    if (plan.containmentSelector !== null && plan.containmentSelector !== undefined) {
      if (
        typeof plan.containmentSelector !== 'string'
        || !plan.containmentSelector.trim()
        || plan.containmentSelector !== plan.containmentSelector.trim()
      ) {
        throw new Error('FEED_ENDPOINT_CONTAINMENT_SELECTOR_INVALID');
      }
      let anchorMatches = false;
      try {
        anchorMatches = plan.anchorBranch.matches(plan.containmentSelector);
      } catch (error) {
        throw createLeaseError('FEED_ENDPOINT_CONTAINMENT_SELECTOR_INVALID', error);
      }
      if (!anchorMatches) {
        throw new Error('FEED_ENDPOINT_CONTAINMENT_ANCHOR_MISMATCH');
      }
    }
    if (!Number.isFinite(Number(plan.boundaryPosition))) {
      throw new Error('FEED_ENDPOINT_BOUNDARY_POSITION_INVALID');
    }
    if (plan.forwardControl !== null && plan.forwardControl !== undefined) {
      validateFeedEndpointForwardControlContract(
        plan.forwardControl,
        this._document,
      );
    }
    validateFeedEndpointSurfacePlanContract(plan);
    if (typeof this._orchestrator?.engageForwardBoundary !== 'function') {
      throw new Error('FEED_ENDPOINT_FORWARD_BOUNDARY_UNAVAILABLE');
    }
    if (typeof this._orchestrator?.releaseForwardBoundary !== 'function') {
      throw new Error('FEED_ENDPOINT_FORWARD_BOUNDARY_RELEASE_UNAVAILABLE');
    }
    if (
      this._document?.getElementById?.(MARKER_ID)
      || this._document?.getElementById?.(TAIL_ID)
      || this._document?.getElementById?.(QUARANTINE_ID)
      || this._document?.querySelector?.(ISOLATED_ELEMENT_SELECTOR)
    ) {
      throw new Error('FEED_ENDPOINT_ORPHAN_PRESENT');
    }
  }

  _readNow() {
    const value = Math.round(Number(this._now()));
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('FEED_ENDPOINT_LEASE_CLOCK_INVALID');
    }
    return value;
  }

  _createDomEndpoint() {
    const plan = this._plan;
    const marker = this._document.createElement('span');
    marker.id = MARKER_ID;
    marker.dataset.entropyFeedEndpointMarker = 'true';
    marker.hidden = true;
    marker.setAttribute('aria-hidden', 'true');
    marker.style.setProperty('display', 'none', 'important');

    const tail = this._document.createElement('div');
    tail.id = TAIL_ID;
    applyTailLayout(tail, plan);

    const quarantine = this._document.createElement('div');
    quarantine.id = QUARANTINE_ID;
    quarantine.dataset.entropyFeedEndpointQuarantine = 'true';
    quarantine.dataset.entropyFeedEndpointMutationMode = plan.mutationMode;
    quarantine.hidden = true;
    quarantine.inert = true;
    quarantine.setAttribute('aria-hidden', 'true');
    quarantine.style.setProperty('display', 'none', 'important');

    const ownership = {
      lane: plan.lane,
      anchorBranch: plan.anchorBranch,
      marker,
      tail,
      quarantine,
      mutationMode: plan.mutationMode,
      isolationLayout: plan.isolationLayout || null,
      tailLayout: plan.tailLayout,
      containmentSelector: plan.containmentSelector || null,
      quarantinedNodes: [],
      isolatedNodes: [],
    };
    [marker, tail, quarantine].forEach((artifact) => {
      Object.defineProperty(artifact, ENDPOINT_OWNERSHIP_PROPERTY, {
        configurable: true,
        value: ownership,
      });
    });
    this._ownership = ownership;

    plan.anchorBranch.after(marker);
    marker.after(tail);
    tail.after(quarantine);
    this._marker = marker;
    this._tail = tail;
    this._quarantine = quarantine;
    this._containFollowingNodes();
  }

  _restoreDomEndpoint() {
    if (this._ownership) restoreOwnedEndpoint(this._ownership, this._document);
    else {
      removeOwnedArtifact(this._quarantine);
      removeOwnedArtifact(this._tail);
      removeOwnedArtifact(this._marker);
    }
    this._quarantine = null;
    this._tail = null;
    this._marker = null;
    this._ownership = null;
  }

  _quarantineFollowingNodes() {
    if (
      this._reconciling
      || !this._ownsCommittedDom({ allowCommitting: true, allowInterleaved: true })
    ) return;
    this._reconciling = true;
    try {
      const preserved = new Set([this._marker, this._tail, this._quarantine]);
      this._plan.anchorBranch.after(this._marker);
      this._marker.after(this._tail);
      this._tail.after(this._quarantine);

      let cursor = this._quarantine.nextSibling;
      while (cursor) {
        const next = cursor.nextSibling;
        if (
          !preserved.has(cursor)
          && matchesPlanContainment(cursor, this._plan, this._document)
        ) {
          if (!this._ownership.quarantinedNodes.includes(cursor)) {
            this._ownership.quarantinedNodes.push(cursor);
          }
          this._quarantine.appendChild(cursor);
        }
        cursor = next;
      }
      Array.from(this._quarantine.childNodes).forEach((node) => {
        if (!this._ownership.quarantinedNodes.includes(node)) {
          this._ownership.quarantinedNodes.push(node);
        }
      });
      const count = this._ownership.quarantinedNodes.length;
      if (count > this._plan.maxQuarantineNodes) {
        this._invalidate('feed_endpoint_quarantine_bound_exceeded', { count });
        return;
      }
      if (!this._ownsCommittedDom({ allowCommitting: true })) {
        this._invalidate('feed_endpoint_artifact_order_invalid');
      }
    } finally {
      this._reconciling = false;
    }
  }

  _isolateFollowingNodes() {
    if (
      this._reconciling
      || !this._ownsCommittedDom({ allowCommitting: true, allowInterleaved: true })
    ) return;
    this._reconciling = true;
    try {
      const lane = this._plan.lane;
      this._plan.anchorBranch.after(this._marker);
      this._marker.after(this._tail);
      this._tail.after(this._quarantine);

      let cursor = this._quarantine.nextSibling;
      while (cursor) {
        if (
          this._ownership.isolatedNodes.includes(cursor)
          && cursor.getAttribute?.(ISOLATION_ATTRIBUTES.marker) !== 'true'
        ) {
          this._invalidate('feed_endpoint_isolation_metadata_lost');
          return;
        }
        if (
          matchesPlanContainment(cursor, this._plan, this._document)
          && isolateElement(cursor, this._document, this._plan.isolationLayout)
        ) {
          if (!this._ownership.isolatedNodes.includes(cursor)) {
            this._ownership.isolatedNodes.push(cursor);
          }
        }
        cursor = cursor.nextSibling;
      }
      const count = this._ownership.isolatedNodes.length;
      if (count > this._plan.maxQuarantineNodes) {
        this._invalidate('feed_endpoint_isolation_bound_exceeded', { count });
        return;
      }
      if (!this._ownsCommittedDom({ allowCommitting: true })) {
        this._invalidate('feed_endpoint_artifact_order_invalid');
      }
      if (this._quarantine.parentNode !== lane) {
        this._invalidate('feed_endpoint_isolation_lane_invalid');
      }
    } finally {
      this._reconciling = false;
    }
  }

  _containFollowingNodes() {
    if (this._plan?.mutationMode === SIBLING_QUARANTINE_MODE) {
      this._quarantineFollowingNodes();
      return;
    }
    if (this._plan?.mutationMode === SIBLING_INERT_ISOLATION_MODE) {
      this._isolateFollowingNodes();
      return;
    }
    this._invalidate('feed_endpoint_mutation_mode_invalid');
  }

  _attachMutationOwner() {
    if (this._mutationUnsub) return;
    if (typeof this._mutationHub?.subscribe !== 'function') {
      throw new Error('FEED_ENDPOINT_OBSERVER_HUB_UNAVAILABLE');
    }
    this._mutationUnsub = this._mutationHub.subscribe(this._boundMutations, {
      childList: true,
      subtree: true,
      debugLabel: 'FeedEndpointLease.observer',
    });
  }

  _detachMutationOwner() {
    if (typeof this._mutationUnsub !== 'function') return;
    const unsubscribe = this._mutationUnsub;
    unsubscribe();
    this._mutationUnsub = null;
  }

  _attachScrollGuard() {
    if (this._scrollAttached) return;
    if (typeof this._window?.addEventListener !== 'function') {
      throw new Error('FEED_ENDPOINT_SCROLL_GUARD_UNAVAILABLE');
    }
    this._window.addEventListener('scroll', this._boundScroll, { capture: true, passive: true });
    this._scrollAttached = true;
  }

  _detachScrollGuard() {
    if (!this._scrollAttached) return;
    this._window?.removeEventListener?.('scroll', this._boundScroll, { capture: true });
    this._scrollAttached = false;
  }

  _engageForwardBoundary() {
    this._boundaryMotion.engage({
      scroller: this._plan.scroller,
      boundaryPosition: this._plan.boundaryPosition,
      inputCapturePosition: this._plan.inputCapturePosition,
      profile: this._plan.boundaryMotionProfile,
      onForwardIntent: (blockedPx, ts, input) => {
        this._callbacks.onForwardIntent?.(blockedPx, ts, input);
      },
      onBoundaryReached: () => this._markBoundaryReached(),
    });
    try {
      this._orchestrator.engageForwardBoundary({
        scroller: this._plan.scroller,
        position: this._plan.boundaryPosition,
        shouldCaptureForwardInput: () => (
          this._boundaryMotion.shouldCaptureForwardInput()
        ),
        onForwardInput: (deltaPx, ts) => this.applyForwardIntent(deltaPx, ts, { kind: 'wheel' }),
        onBackwardInput: () => this.applyBackwardIntent(),
      });
      this._boundaryEngaged = true;
    } catch (error) {
      try {
        this._boundaryMotion.release();
      } catch (motionError) {
        if (error && typeof error === 'object') error.boundaryMotionReleaseError = motionError;
      }
      throw error;
    }
  }

  _releaseForwardBoundary() {
    if (!this._boundaryEngaged && !this._boundaryMotion.isEngaged()) return;
    const errors = [];
    try {
      this._orchestrator.releaseForwardBoundary();
    } catch (error) {
      errors.push(error);
    }
    try {
      this._boundaryMotion.release();
    } catch (error) {
      errors.push(error);
    }
    this._boundaryEngaged = false;
    if (errors.length > 0) {
      throw createLeaseError('FEED_ENDPOINT_FORWARD_BOUNDARY_RELEASE_FAILED', errors[0]);
    }
  }

  _handleMutations({ mutations = [] } = {}) {
    if (!this.isCommitted() || this._reconciling) return;
    const lane = this._plan?.lane;
    const removedNodeOwnsBoundary = (node) => (
      node === this._marker
      || node === this._tail
      || node === this._quarantine
      || node === this._plan.anchorBranch
      || node?.contains?.(this._marker) === true
      || node?.contains?.(this._tail) === true
      || node?.contains?.(this._quarantine) === true
      || node?.contains?.(this._plan.anchorBranch) === true
    );
    const relevant = mutations.some((mutation) => (
      mutation?.target === lane
      || lane?.contains?.(mutation?.target)
      || Array.from(mutation?.removedNodes || []).some(removedNodeOwnsBoundary)
    ));
    if (!relevant) return;
    if (!this._ownsCommittedDom({ allowInterleaved: true })) {
      this._invalidate('feed_endpoint_dom_ownership_lost');
      return;
    }
    this._containFollowingNodes();
  }

  _handleScroll() {
    if (!this.isCommitted()) return;
    if (this._boundaryReached) this._reconcileBoundaryGeometry();
    this._reconcileBoundaryPosition();
  }

  _reconcileBoundaryGeometry() {
    if (
      !this._plan?.scroller
      || !this._tail?.isConnected
      || !this._boundaryMotion.isEngaged()
    ) return false;
    try {
      const profile = this._plan.boundaryMotionProfile;
      const endpointRect = this._tail.getBoundingClientRect();
      const endpointEdgePosition = Number(endpointRect?.top);
      const rootLike = (
        this._plan.scroller === this._document?.scrollingElement
        || this._plan.scroller === this._document?.documentElement
        || this._plan.scroller === this._document?.body
      );
      const scrollerRect = rootLike
        ? null
        : this._plan.scroller.getBoundingClientRect();
      const restEdgePosition = rootLike
        ? (
          Number(this._window?.innerHeight)
          || Number(this._document?.documentElement?.clientHeight)
        )
        : Number(scrollerRect?.bottom);
      this._boundaryMotion.reconcileEndpointEdge({
        endpointEdgePosition,
        restEdgePosition: restEdgePosition - profile.revealPx,
      });
      return true;
    } catch (error) {
      this._invalidate('feed_endpoint_boundary_geometry_reconcile_failed', {
        error: getErrorMessage(error),
      });
      return false;
    }
  }

  _reconcileBoundaryPosition() {
    if (!this._plan?.scroller || !this._boundaryMotion.isEngaged()) return;
    try {
      this._boundaryMotion.reconcileExternalPosition();
      this._syncForwardControlState();
    } catch (error) {
      this._invalidate('feed_endpoint_forward_drift_restore_failed', {
        boundary: Math.max(0, Number(this._plan.boundaryPosition) || 0),
        error: getErrorMessage(error),
      });
    }
  }

  _syncForwardControlState() {
    if (!this._plan?.forwardControl) return true;
    if (!this._forwardControlLease.validate()) {
      throw new Error('FEED_ENDPOINT_FORWARD_CONTROL_DISCONNECTED');
    }
    return this._forwardControlLease.setTerminal(
      this._boundaryMotion.isAtBoundaryPosition(),
    );
  }

  _markBoundaryReached() {
    if (this._boundaryReached) return;
    if (!this._reconcileBoundaryGeometry()) return;
    this._boundaryReached = true;
    this._callbacks.onBoundaryReached?.(Date.now());
  }

  _ownsCommittedDom({ allowCommitting = false, allowInterleaved = false } = {}) {
    const stateOwned = this._state === 'committed' || (allowCommitting && this._state === 'committing');
    const parentsOwned = !!(
      stateOwned
      && this._plan?.lane?.isConnected
      && this._plan?.anchorBranch?.isConnected
      && this._plan.anchorBranch.parentNode === this._plan.lane
      && this._marker?.parentNode === this._plan.lane
      && this._tail?.parentNode === this._plan.lane
      && this._quarantine?.parentNode === this._plan.lane
    );
    if (!parentsOwned) return false;

    const children = Array.from(this._plan.lane.childNodes);
    const anchorIndex = children.indexOf(this._plan.anchorBranch);
    const markerIndex = children.indexOf(this._marker);
    const tailIndex = children.indexOf(this._tail);
    const quarantineIndex = children.indexOf(this._quarantine);
    const ordered = anchorIndex >= 0
      && anchorIndex < markerIndex
      && markerIndex < tailIndex
      && tailIndex < quarantineIndex;
    if (!ordered) return false;
    if (allowInterleaved) return true;
    return this._plan.anchorBranch.nextSibling === this._marker
      && this._marker.nextSibling === this._tail
      && this._tail.nextSibling === this._quarantine;
  }

  _invalidate(reason, details = {}) {
    if (this._invalidating || !this._plan) return;
    this._invalidating = true;
    try {
      const error = createLeaseError(`FEED_ENDPOINT_INVALIDATED:${reason}`);
      this._reportFailure('feed_endpoint_invalidated', error, { reason, ...details });
      try {
        this._callbacks.onInvalidate?.(reason, details);
      } catch (callbackError) {
        this._reportFailure('feed_endpoint_invalidation_callback', callbackError, { reason });
      }
    } finally {
      this._invalidating = false;
    }
  }

  _rollbackCommit() {
    const errors = [];
    try {
      this._releaseForwardBoundary();
    } catch (error) {
      errors.push(error);
    }
    try {
      this._detachScrollGuard();
    } catch (error) {
      errors.push(error);
    }
    try {
      this._detachMutationOwner();
    } catch (error) {
      errors.push(error);
    }
    try {
      this._forwardControlLease.release();
    } catch (error) {
      errors.push(error);
    }
    try {
      this._restoreDomEndpoint();
    } catch (error) {
      errors.push(error);
    }
    this._resetLocalState();
    if (errors.length === 0) return null;
    return createLeaseError('FEED_ENDPOINT_COMMIT_ROLLBACK_FAILED', errors[0]);
  }

  _resetLocalState() {
    this._state = 'idle';
    this._plan = null;
    this._marker = null;
    this._tail = null;
    this._quarantine = null;
    this._ownership = null;
    this._mutationUnsub = null;
    this._scrollAttached = false;
    this._boundaryEngaged = false;
    this._boundaryReached = false;
    this._callbacks = {};
    this._reconciling = false;
    this._invalidating = false;
  }

  _reportFailure(phase, error, details = {}) {
    const diagnostic = {
      phase,
      error: getErrorMessage(error),
      ...details,
    };
    if (this._onRuntimeFailure) {
      this._onRuntimeFailure(phase, error, diagnostic);
      return diagnostic;
    }
    if (typeof console !== 'undefined') {
      console.warn?.('[FeedEndpointLease] runtime failure', diagnostic);
    }
    return diagnostic;
  }
}

export {
  MARKER_ID,
  QUARANTINE_ID,
  TAIL_ID,
};

export default FeedEndpointLease;
