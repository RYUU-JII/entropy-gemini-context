import { resolveArtifactScopeConfig } from './artifactScopeConfigResolver.js';
import {
  SENTINEL_FLARE_POLICY_BASES,
  normalizeSentinelFlareArtifactConfig,
} from './flareArtifactConfig.js';
import {
  PROTOCOL_SCOPE_BUDGET_ROLES,
  PROTOCOL_STATE_STATUSES,
  PROTOCOL_TARGET_SOURCES,
} from './protocolStateSnapshot.js';

const STATUS_PRIORITY = Object.freeze({
  [PROTOCOL_STATE_STATUSES.INACTIVE]: 0,
  [PROTOCOL_STATE_STATUSES.SAFE]: 1,
  [PROTOCOL_STATE_STATUSES.NEAR]: 2,
  [PROTOCOL_STATE_STATUSES.OVER]: 3,
});

function matchesStatusThreshold(status, threshold) {
  const current = STATUS_PRIORITY[status] ?? 0;
  const required = STATUS_PRIORITY[threshold] ?? 0;
  return current >= required;
}

function resolveBasisSnapshot({
  protocolState,
  scopeEntry,
  basis,
}) {
  const globalBudget = protocolState?.global || null;
  const scopeBudget = scopeEntry?.activeTarget || scopeEntry?.referenceTarget || null;

  if (basis === SENTINEL_FLARE_POLICY_BASES.SCOPE_TARGET) {
    return scopeBudget || globalBudget;
  }

  if (basis === SENTINEL_FLARE_POLICY_BASES.GLOBAL_OR_SCOPE) {
    const globalPriority = STATUS_PRIORITY[globalBudget?.status] ?? 0;
    const scopePriority = STATUS_PRIORITY[scopeBudget?.status] ?? 0;
    return scopePriority > globalPriority ? scopeBudget : globalBudget;
  }

  return globalBudget;
}

function buildEmptySummary() {
  return {
    enabled: false,
    basis: SENTINEL_FLARE_POLICY_BASES.GLOBAL_PROTOCOL,
    overallStatus: 'off',
    sitesInScopeCount: 0,
    basisAffectedCount: 0,
    engagedCount: 0,
    referenceExceededCount: 0,
    targets: [],
    topTargets: [],
  };
}

export function deriveSentinelFlareArtifactSummary({
  protocolState,
  artifactConfig,
  artifactScopeConfigs = {},
  blockedDomains = [],
} = {}) {
  const config = normalizeSentinelFlareArtifactConfig(artifactConfig);
  const safeBlockedDomains = Array.from(new Set(
    (Array.isArray(blockedDomains) ? blockedDomains : [])
      .map((domain) => (typeof domain === 'string' ? domain.trim().toLowerCase() : ''))
      .filter(Boolean),
  ));

  if (!safeBlockedDomains.length) {
    return {
      ...buildEmptySummary(),
      enabled: config.enabled,
      overallStatus: config.enabled ? 'idle' : 'off',
    };
  }

  const targets = safeBlockedDomains
    .map((scopeKey) => {
      const scopeEntry = protocolState?.scopes?.[scopeKey] || null;
      const { effectiveConfig, provenance } = resolveArtifactScopeConfig({
        artifactId: 'flare',
        childId: 'sentinelFlare',
        artifactConfig: config,
        artifactScopeConfigs,
        scopeKey,
      });
      const basisSnapshot = resolveBasisSnapshot({
        protocolState,
        scopeEntry,
        basis: effectiveConfig.policy.basis,
      });
      const referenceTarget = scopeEntry?.referenceTarget || {};
      const usageMinutes = Math.max(0, Number(scopeEntry?.usageMinutes) || 0);
      const referenceTargetMinutes = Math.max(0, Number(referenceTarget.targetMinutes) || 0);
      const referenceRatio = Number.isFinite(referenceTarget?.ratio) ? referenceTarget.ratio : 0;
      const referenceStatus = referenceTarget?.status || PROTOCOL_STATE_STATUSES.INACTIVE;

      return {
        domain: scopeKey,
        activeMs: usageMinutes * 60000,
        targetMs: referenceTargetMinutes * 60000,
        targetMinutes: referenceTargetMinutes,
        ratio: referenceRatio,
        breached: referenceStatus === PROTOCOL_STATE_STATUSES.OVER,
        referenceOnly: scopeEntry?.budgetRole === PROTOCOL_SCOPE_BUDGET_ROLES.REFERENCE,
        referenceSource: referenceTarget?.targetSource || PROTOCOL_TARGET_SOURCES.NONE,
        basis: effectiveConfig.policy.basis,
        basisStatus: basisSnapshot?.status || PROTOCOL_STATE_STATUSES.INACTIVE,
        basisAffected: matchesStatusThreshold(
          basisSnapshot?.status || PROTOCOL_STATE_STATUSES.INACTIVE,
          effectiveConfig.policy.armOn,
        ),
        engaged: matchesStatusThreshold(
          basisSnapshot?.status || PROTOCOL_STATE_STATUSES.INACTIVE,
          effectiveConfig.policy.engageOn,
        ),
        provenanceSource: provenance.source,
      };
    })
    .sort((a, b) => {
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      return b.activeMs - a.activeMs;
    });

  const strongestBasisStatus = targets.reduce((best, entry) => {
    const currentPriority = STATUS_PRIORITY[entry.basisStatus] ?? 0;
    const bestPriority = STATUS_PRIORITY[best] ?? 0;
    return currentPriority > bestPriority ? entry.basisStatus : best;
  }, PROTOCOL_STATE_STATUSES.INACTIVE);

  let overallStatus = 'idle';
  if (!config.enabled) overallStatus = 'off';
  else if (matchesStatusThreshold(strongestBasisStatus, config.policy.engageOn)) overallStatus = 'engaged';
  else if (matchesStatusThreshold(strongestBasisStatus, config.policy.armOn)) overallStatus = 'armed';
  else overallStatus = 'monitoring';

  return {
    enabled: config.enabled,
    basis: config.policy.basis,
    overallStatus,
    sitesInScopeCount: targets.length,
    basisAffectedCount: targets.filter((entry) => entry.basisAffected).length,
    engagedCount: targets.filter((entry) => entry.engaged).length,
    referenceExceededCount: targets.filter((entry) => entry.breached).length,
    targets,
    topTargets: targets.slice(0, 4),
  };
}
