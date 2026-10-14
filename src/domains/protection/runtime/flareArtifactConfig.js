import { PROTOCOL_STATE_STATUSES } from './protocolStateSnapshot.js';

export const SENTINEL_FLARE_POLICY_BASES = Object.freeze({
  GLOBAL_PROTOCOL: 'global_protocol',
  SCOPE_TARGET: 'scope_target',
  GLOBAL_OR_SCOPE: 'global_or_scope',
});

const STATUS_SET = new Set(Object.values(PROTOCOL_STATE_STATUSES));
const BASIS_SET = new Set(Object.values(SENTINEL_FLARE_POLICY_BASES));

export const DEFAULT_SENTINEL_FLARE_ARTIFACT_CONFIG = Object.freeze({
  artifactId: 'flare',
  childId: 'sentinelFlare',
  enabled: false,
  policy: Object.freeze({
    basis: SENTINEL_FLARE_POLICY_BASES.GLOBAL_PROTOCOL,
    armOn: PROTOCOL_STATE_STATUSES.NEAR,
    engageOn: PROTOCOL_STATE_STATUSES.OVER,
  }),
});

export function normalizeSentinelFlareArtifactConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const policySource = source.policy && typeof source.policy === 'object'
    ? source.policy
    : {};
  const basis = BASIS_SET.has(policySource.basis)
    ? policySource.basis
    : DEFAULT_SENTINEL_FLARE_ARTIFACT_CONFIG.policy.basis;
  const armOn = STATUS_SET.has(policySource.armOn)
    ? policySource.armOn
    : DEFAULT_SENTINEL_FLARE_ARTIFACT_CONFIG.policy.armOn;
  const engageOn = STATUS_SET.has(policySource.engageOn)
    ? policySource.engageOn
    : DEFAULT_SENTINEL_FLARE_ARTIFACT_CONFIG.policy.engageOn;

  return {
    artifactId: 'flare',
    childId: 'sentinelFlare',
    enabled: !!source.enabled,
    policy: {
      basis,
      armOn,
      engageOn,
    },
  };
}

export function createSentinelFlareArtifactConfig({
  enabled = false,
} = {}) {
  return normalizeSentinelFlareArtifactConfig({
    enabled,
    policy: {
      basis: SENTINEL_FLARE_POLICY_BASES.GLOBAL_PROTOCOL,
      armOn: PROTOCOL_STATE_STATUSES.NEAR,
      engageOn: PROTOCOL_STATE_STATUSES.OVER,
    },
  });
}
