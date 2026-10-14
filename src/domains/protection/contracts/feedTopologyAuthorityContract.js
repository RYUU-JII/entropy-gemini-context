export const FEED_TOPOLOGY_AUTHORITY_VERSION = 'feed-topology-authority-v1';
export const FEED_SHIPPED_TOPOLOGY_PROBE_CONTRACT =
  'feed-shipped-topology-probe-v1';

export const FEED_SHIPPED_TOPOLOGY_HEALTH_STATUSES = Object.freeze({
  UNAVAILABLE: 'unavailable',
  UNSUPPORTED: 'unsupported',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  MISMATCH: 'mismatch',
  INVALID: 'invalid',
});

export const FEED_TOPOLOGY_AUTHORITY_STATES = Object.freeze({
  UNAVAILABLE: 'unavailable',
  UNSUPPORTED: 'unsupported',
  CANONICAL_LEARNING: 'canonical_learning',
  CANONICAL_VERIFIED: 'canonical_verified',
  DRIFT_SUSPECTED: 'drift_suspected',
  SHADOW_LEARNING: 'shadow_learning',
  LOCALLY_CERTIFIED: 'locally_certified',
  QUARANTINED: 'quarantined',
});

export const FEED_TOPOLOGY_AUTHORITY_SOURCES = Object.freeze({
  NONE: 'none',
  SHIPPED_PROFILE: 'shipped_profile',
  DYNAMIC_SHADOW: 'dynamic_shadow',
  LOCAL_CERTIFIED: 'local_certified',
});

export function isFeedTopologyActuationAuthorized(authority = null) {
  const shippedAuthority = (
    authority?.topologyState === FEED_TOPOLOGY_AUTHORITY_STATES.CANONICAL_VERIFIED
    && authority?.topologySource === FEED_TOPOLOGY_AUTHORITY_SOURCES.SHIPPED_PROFILE
  );
  const localAuthority = (
    authority?.topologyState === FEED_TOPOLOGY_AUTHORITY_STATES.LOCALLY_CERTIFIED
    && authority?.topologySource === FEED_TOPOLOGY_AUTHORITY_SOURCES.LOCAL_CERTIFIED
  );
  const baseAuthorized = !!authority
    && authority.contractVersion === FEED_TOPOLOGY_AUTHORITY_VERSION
    && (shippedAuthority || localAuthority)
    && authority.canActuate === true
    && Number.isSafeInteger(authority.topologyEpoch)
    && authority.topologyEpoch > 0
    && typeof authority.adapterId === 'string'
    && !!authority.adapterId
    && authority.capability !== 'observe_only';
  if (!baseAuthorized) return false;
  if (shippedAuthority) return true;
  return typeof authority.topologyFingerprint === 'string'
    && authority.topologyFingerprint.startsWith('lft1:')
    && Number.isSafeInteger(authority.topologyCertificateRevision)
    && authority.topologyCertificateRevision > 0
    && Number.isSafeInteger(authority.topologyCertificateCheckpointRevision)
    && authority.topologyCertificateCheckpointRevision >= 0
    && Number.isSafeInteger(authority.topologyCertificateExpiresAt)
    && Number.isSafeInteger(authority.topologyEvaluatedAt)
    && authority.topologyCertificateExpiresAt > authority.topologyEvaluatedAt;
}
