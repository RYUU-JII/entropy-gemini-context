import {
  FEED_TOPOLOGY_AUTHORITY_SOURCES,
  FEED_TOPOLOGY_AUTHORITY_STATES,
  isFeedTopologyActuationAuthorized,
} from '../../../protection/contracts/feedTopologyAuthorityContract.js';
import {
  FEED_LOCAL_TOPOLOGY_LIVE_CONTRACT,
} from '../topology/FeedLocalTopologyProbe.js';

const MIN_ACTUATION_CONFIDENCE = 0.64;

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function resolveCandidateAnchorStatus(referenceNode, selector) {
  if (!referenceNode || referenceNode.isConnected !== true) return 'missing';
  if (typeof selector !== 'string' || !selector.trim()) return 'selector_missing';
  try {
    return referenceNode.matches?.(selector) === true || !!referenceNode.closest?.(selector)
      ? 'connected'
      : 'missing';
  } catch (_) {
    return 'selector_invalid';
  }
}

function resolveModeCapability(surfaceMode) {
  if (surfaceMode === 'paged') return 'paged_hold';
  if (surfaceMode === 'continuous' || surfaceMode === 'hybrid') {
    return 'anchored_continuous';
  }
  return 'observe_only';
}

function compareTopologyAuthority(authority, contextAuthority, reasons) {
  if (!contextAuthority || typeof contextAuthority !== 'object') {
    reasons.push('actuation_context_topology_authority_missing');
    return;
  }
  if (contextAuthority.contractVersion !== authority.contractVersion) {
    reasons.push('actuation_context_topology_contract_mismatch');
  }
  if (contextAuthority.topologyEpoch !== authority.topologyEpoch) {
    reasons.push('actuation_context_topology_epoch_mismatch');
  }
  if (contextAuthority.topologyState !== authority.topologyState) {
    reasons.push('actuation_context_topology_state_mismatch');
  }
  if (contextAuthority.topologySource !== authority.topologySource) {
    reasons.push('actuation_context_topology_source_mismatch');
  }
  if (contextAuthority.shippedTopologyStatus !== authority.shippedTopologyStatus) {
    reasons.push('actuation_context_shipped_topology_status_mismatch');
  }
  if (contextAuthority.profileId !== authority.profileId) {
    reasons.push('actuation_context_topology_profile_mismatch');
  }
  if (contextAuthority.semanticSurfaceId !== authority.semanticSurfaceId) {
    reasons.push('actuation_context_topology_semantic_surface_mismatch');
  }
  if (contextAuthority.surfaceMode !== authority.surfaceMode) {
    reasons.push('actuation_context_topology_surface_mode_mismatch');
  }
  if (contextAuthority.capability !== authority.capability) {
    reasons.push('actuation_context_topology_capability_mismatch');
  }
  if (contextAuthority.adapterId !== authority.adapterId) {
    reasons.push('actuation_context_adapter_mismatch');
  }
  if (contextAuthority.topologyId !== authority.topologyId) {
    reasons.push('actuation_context_topology_id_mismatch');
  }
  if (contextAuthority.mutationMode !== authority.mutationMode) {
    reasons.push('actuation_context_topology_mutation_mode_mismatch');
  }
  if (contextAuthority.topologyFingerprint !== authority.topologyFingerprint) {
    reasons.push('actuation_context_topology_fingerprint_mismatch');
  }
  if (
    contextAuthority.topologyCertificateRevision
    !== authority.topologyCertificateRevision
  ) {
    reasons.push('actuation_context_topology_certificate_revision_mismatch');
  }
  if (
    contextAuthority.topologyCertificateExpiresAt
    !== authority.topologyCertificateExpiresAt
  ) {
    reasons.push('actuation_context_topology_certificate_expiry_mismatch');
  }
}

function validateLocalTopologyContext(authority, actuationContext, reasons) {
  if (authority.topologySource !== FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED) {
    return;
  }
  const topology = actuationContext?.localTopology;
  if (
    !topology
    || topology.contract !== FEED_LOCAL_TOPOLOGY_LIVE_CONTRACT
    || topology.status !== 'resolved'
  ) {
    reasons.push('actuation_context_local_topology_missing');
    return;
  }
  if (topology.fingerprint !== authority.topologyFingerprint) {
    reasons.push('actuation_context_local_topology_fingerprint_mismatch');
  }
  if (
    topology.referenceItem?.isConnected !== true
    || topology.anchorBranch?.isConnected !== true
    || topology.lane?.isConnected !== true
    || topology.anchorBranch.parentElement !== topology.lane
    || !topology.anchorBranch.contains(topology.referenceItem)
  ) {
    reasons.push('actuation_context_local_topology_ownership_invalid');
  }
}

export class FeedActuationSafetyJudge {
  constructor({
    now = () => Date.now(),
  } = {}) {
    if (typeof now !== 'function') {
      throw new Error('FEED_ACTUATION_SAFETY_CLOCK_REQUIRED');
    }
    this._now = now;
  }

  evaluate({ decision = null, surface = null, readiness = null, actuationContext = null } = {}) {
    const surfaceMode = typeof decision?.surfaceMode === 'string' && decision.surfaceMode
      ? decision.surfaceMode
      : (typeof surface?.surfaceMode === 'string' ? surface.surfaceMode : 'unknown');
    const capability = typeof readiness?.capability === 'string'
      ? readiness.capability
      : 'observe_only';
    const readinessStatus = typeof readiness?.status === 'string'
      ? readiness.status
      : (typeof readiness?.state === 'string' ? readiness.state : 'pending');
    const reasons = [];

    if (surfaceMode === 'document' || surface?.contentClass === 'document') {
      return {
        status: 'unsafe',
        capability: 'observe_only',
        reasons: ['document_surface_excluded'],
      };
    }

    if (readinessStatus === 'invalid' || readinessStatus === 'volatile') {
      return {
        status: 'unsafe',
        capability: 'observe_only',
        reasons: [
          `structure_${readinessStatus}`,
          readiness?.topologyState === FEED_TOPOLOGY_AUTHORITY_STATES.QUARANTINED
            ? 'feed_topology_quarantined'
            : 'feed_topology_drift_suspected',
        ],
      };
    }

    if (readinessStatus !== 'ready') {
      return {
        status: 'pending',
        capability: 'observe_only',
        reasons: [readinessStatus === 'warming' ? 'structure_learning_warming' : 'structure_learning_pending'],
      };
    }

    const readinessCapability = capability;
    const readinessSurfaceMode = typeof readiness?.surfaceMode === 'string'
      ? readiness.surfaceMode
      : '';
    const learnedSurfaceMode = typeof readiness?.learnedSurfaceMode === 'string'
      ? readiness.learnedSurfaceMode
      : '';
    if (readinessSurfaceMode !== surfaceMode) reasons.push('readiness_surface_mode_mismatch');
    if (learnedSurfaceMode !== surfaceMode) reasons.push('learned_surface_mode_mismatch');
    if (
      isFeedTopologyActuationAuthorized(readiness)
      && readinessCapability !== resolveModeCapability(surfaceMode)
    ) {
      reasons.push('readiness_capability_mismatch');
    }
    if (reasons.length > 0) {
      return {
        status: 'unsafe',
        capability: 'observe_only',
        reasons,
      };
    }

    if (!isFeedTopologyActuationAuthorized(readiness)) {
      return {
        status: 'unsafe',
        capability: 'observe_only',
        reasons: [
          readiness?.topologyState === FEED_TOPOLOGY_AUTHORITY_STATES.SHADOW_LEARNING
            ? 'feed_endpoint_topology_shadow_only'
            : 'feed_endpoint_adapter_unavailable',
        ],
      };
    }
    if (
      readiness.topologySource === FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED
      && (
        !Number.isSafeInteger(readiness.topologyCertificateExpiresAt)
        || readiness.topologyCertificateExpiresAt <= this._readNow()
      )
    ) {
      return {
        status: 'unsafe',
        capability: 'observe_only',
        reasons: ['feed_topology_local_certificate_expired'],
      };
    }

    const advanceCount = Math.max(0, Math.round(Number(decision?.metrics?.advanceCount) || 0));
    if (advanceCount <= 0) {
      return {
        status: 'pending',
        capability,
        reasons: ['feed_observation_not_mature'],
      };
    }

    if (clamp01(decision?.confidence) < MIN_ACTUATION_CONFIDENCE) {
      reasons.push('decision_confidence_insufficient');
    }
    const contextSurfaceMode = typeof actuationContext?.surfaceMode === 'string'
      ? actuationContext.surfaceMode
      : '';
    const contextProfileId = typeof actuationContext?.profileId === 'string'
      ? actuationContext.profileId
      : '';
    const contextSemanticSurfaceId = typeof actuationContext?.semanticSurfaceId === 'string'
      ? actuationContext.semanticSurfaceId
      : '';
    if (contextSurfaceMode !== surfaceMode) reasons.push('actuation_context_surface_mode_mismatch');
    if (contextProfileId !== surface?.profileId) reasons.push('actuation_context_profile_mismatch');
    if (contextSemanticSurfaceId !== surface?.semanticSurfaceId) {
      reasons.push('actuation_context_semantic_surface_mismatch');
    }
    compareTopologyAuthority(
      readiness,
      actuationContext?.topologyAuthority,
      reasons,
    );
    validateLocalTopologyContext(readiness, actuationContext, reasons);
    const candidateSelector = (
      readiness.topologySource === FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED
      && typeof actuationContext?.localTopology?.candidateSelector === 'string'
    )
      ? actuationContext.localTopology.candidateSelector
      : surface?.candidateItemSelectors;
    const anchorStatus = resolveCandidateAnchorStatus(
      actuationContext?.referenceNode || decision?.referenceNode,
      candidateSelector,
    );
    if (anchorStatus !== 'connected') {
      reasons.push('connected_candidate_anchor_missing');
      if (anchorStatus === 'selector_invalid') reasons.push('candidate_anchor_selector_invalid');
      if (anchorStatus === 'selector_missing') reasons.push('candidate_anchor_selector_missing');
    }

    if (reasons.length > 0) {
      return {
        status: 'unsafe',
        capability,
        reasons,
      };
    }

    return {
      status: 'safe',
      capability,
      reasons: [
        'structure_ready',
        'connected_candidate_anchor_confirmed',
        'feed_topology_authority_confirmed',
      ],
    };
  }

  _readNow() {
    const value = Math.round(Number(this._now()));
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('FEED_ACTUATION_SAFETY_CLOCK_INVALID');
    }
    return value;
  }
}

export default FeedActuationSafetyJudge;
