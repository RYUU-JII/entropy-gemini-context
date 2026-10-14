import {
  closestFeedTopologyCandidate,
  collectOutermostFeedTopologyCandidates,
  isFeedTopologyElement,
  isUnsafeFeedTopologyLane,
  resolveFeedTopologyLane,
} from '../topology/feedTopologyDomFacts.js';
import {
  inspectDeclaredFeedEndpointScroller,
  inspectDeclaredFeedEndpointTopology,
} from './feedEndpointTopologyInspection.js';
import {
  resolveFeedEndpointAdapter,
} from './feedEndpointAdapterCatalog.js';
import {
  FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES,
  FEED_SHIPPED_TOPOLOGY_PROBE_CONTRACT,
} from '../../../protection/contracts/feedTopologyAuthorityContract.js';
import {
  readFeedFlowDiagnosticElapsedMs,
  recordFeedFlowDiagnosticEvent,
  startFeedFlowDiagnosticMeasure,
} from '../diagnostics/feedFlowDiagnosticState.js';

export {
  FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES,
  FEED_SHIPPED_TOPOLOGY_PROBE_CONTRACT,
};

const DEFAULT_MAX_CANDIDATES = 320;

function normalizeSelector(value) {
  return typeof value === 'string' && value.trim() === value && value
    ? value
    : '';
}

/**
 * Read-only health seam for the shipped adapter catalog.
 *
 * It does not infer a replacement and never mutates DOM. It only answers
 * whether the current content-local anchor still satisfies the exact shipped
 * selector/topology tuple. FeedTopologyRecoveryProtocol owns the separate
 * decision to retain shipped authority, observe drift, or use a certified
 * local topology.
 */
export class FeedShippedTopologyProbe {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    adapterResolver = resolveFeedEndpointAdapter,
    maximumCandidates = DEFAULT_MAX_CANDIDATES,
  } = {}) {
    if (typeof adapterResolver !== 'function') {
      throw new Error('FEED_SHIPPED_TOPOLOGY_ADAPTER_RESOLVER_REQUIRED');
    }
    if (!Number.isSafeInteger(maximumCandidates) || maximumCandidates < 2) {
      throw new Error('FEED_SHIPPED_TOPOLOGY_CANDIDATE_LIMIT_INVALID');
    }
    this._window = windowRef;
    this._document = documentRef;
    this._adapterResolver = adapterResolver;
    this._maximumCandidates = maximumCandidates;
  }

  inspect({
    surface = null,
    actuationContext = null,
  } = {}) {
    const measurementStartedAt = startFeedFlowDiagnosticMeasure();
    let result = null;
    try {
      result = this._inspect({ surface, actuationContext });
      return result;
    } finally {
      recordFeedFlowDiagnosticEvent('topology_probe', {
        phase: 'shipped_health',
        status: result?.status || 'invalid',
        surfaceMode: surface?.surfaceMode || 'unknown',
        durationMs: readFeedFlowDiagnosticElapsedMs(measurementStartedAt),
      });
    }
  }

  _inspect({
    surface = null,
    actuationContext = null,
  } = {}) {
    const adapter = this._adapterResolver({
      profileId: surface?.profileId,
      semanticSurfaceId: surface?.semanticSurfaceId,
      surfaceMode: surface?.surfaceMode,
    });
    if (!adapter || typeof adapter.capability !== 'string') {
      throw new Error('FEED_SHIPPED_TOPOLOGY_ADAPTER_CONTRACT_INVALID');
    }
    if (adapter.capability === 'observe_only') {
      return this._result('unsupported', ['shipped_topology_not_declared'], adapter);
    }
    if (!this._document) {
      return this._result('unavailable', ['shipped_topology_document_unavailable'], adapter);
    }
    if (
      !isFeedTopologyElement(actuationContext?.referenceNode, this._document)
      || actuationContext.referenceNode.isConnected !== true
    ) {
      return this._result('pending', ['shipped_topology_reference_pending'], adapter);
    }

    const selector = normalizeSelector(surface?.candidateItemSelectors);
    if (!selector) {
      return this._result('invalid', ['shipped_topology_candidate_selector_missing'], adapter);
    }

    let referenceItem = null;
    try {
      referenceItem = closestFeedTopologyCandidate(
        actuationContext.referenceNode,
        selector,
        this._document,
      );
    } catch (_) {
      return this._result('invalid', ['shipped_topology_candidate_selector_invalid'], adapter);
    }
    if (!referenceItem?.isConnected) {
      return this._result('mismatch', ['shipped_topology_candidate_anchor_mismatch'], adapter);
    }

    if (adapter.endpointTopology) {
      let declaredTopology;
      try {
        declaredTopology = inspectDeclaredFeedEndpointTopology(
          referenceItem,
          adapter,
          this._window,
          this._document,
        );
      } catch (_) {
        return this._result('invalid', ['shipped_topology_declaration_invalid'], adapter);
      }
      if (declaredTopology?.status !== 'resolved') {
        return this._result('mismatch', ['shipped_topology_declared_tuple_mismatch'], adapter);
      }
      const scrollerInspection = inspectDeclaredFeedEndpointScroller(
        declaredTopology,
        actuationContext?.activeScroller,
        this._document,
      );
      if (scrollerInspection.status === 'mismatch') {
        return this._result('mismatch', ['shipped_topology_scroller_mismatch'], adapter);
      }
      return this._result('resolved', ['shipped_topology_live_match'], adapter);
    }

    let candidates = [];
    try {
      candidates = collectOutermostFeedTopologyCandidates(
        this._document,
        selector,
        { limit: this._maximumCandidates },
      );
    } catch (_) {
      return this._result('invalid', ['shipped_topology_candidate_selector_invalid'], adapter);
    }
    if (!candidates.includes(referenceItem)) {
      return this._result('mismatch', ['shipped_topology_candidate_anchor_mismatch'], adapter);
    }

    const lane = resolveFeedTopologyLane(referenceItem, candidates, this._document);
    if (!lane?.isConnected || isUnsafeFeedTopologyLane(lane, this._document)) {
      return this._result('mismatch', ['shipped_topology_repeated_lane_mismatch'], adapter);
    }
    return this._result('resolved', ['shipped_topology_live_match'], adapter);
  }

  _result(status, reasons, adapter) {
    return Object.freeze({
      contract: FEED_SHIPPED_TOPOLOGY_PROBE_CONTRACT,
      status,
      reasons: Object.freeze([...reasons]),
      adapterId: adapter?.adapterId || '',
      topologyId: adapter?.endpointTopology?.topologyId || '',
    });
  }
}

export default FeedShippedTopologyProbe;
