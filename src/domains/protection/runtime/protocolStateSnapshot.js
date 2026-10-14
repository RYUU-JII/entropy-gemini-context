import { getLocalDateStr } from '../../../lib/index.js';
import { resolveSitesRecordingPolicy, resolveTimeCapAvailability } from '../../settings/config/dataCollectionPolicy.js';
import { readActivityDaySiteCharge, requireProtectionCharge } from '../../stats/projection/projectProtectionBudget.js';

export const PROTOCOL_STATE_STATUSES = Object.freeze({
  INACTIVE: 'inactive',
  SAFE: 'safe',
  NEAR: 'near',
  OVER: 'over',
});

export const PROTOCOL_SCOPE_BUDGET_ROLES = Object.freeze({
  REFERENCE: 'reference',
  ACTIVE: 'active',
});

export const PROTOCOL_TARGET_SOURCES = Object.freeze({
  GLOBAL_PROTOCOL: 'global_protocol',
  SITE_GOAL: 'site_goal',
  NONE: 'none',
});

const PROTOCOL_NEAR_LIMIT_RATIO = 0.8;

function resolvePositiveMinutes(value) {
  const minutes = Math.floor(Number(value));
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function toUsageMinutes(activeMs) {
  return requireProtectionCharge(activeMs, 'protocol-usage') / 60000;
}

function buildBudgetSnapshot({
  targetMinutes = 0,
  usageMinutes = 0,
  targetSource = PROTOCOL_TARGET_SOURCES.NONE,
} = {}) {
  const safeTargetMinutes = resolvePositiveMinutes(targetMinutes);
  const safeUsageMinutes = requireProtectionCharge(usageMinutes, 'protocol-minutes');
  const hasTarget = safeTargetMinutes > 0;
  const ratio = hasTarget ? safeUsageMinutes / Math.max(1, safeTargetMinutes) : 0;
  let status = PROTOCOL_STATE_STATUSES.INACTIVE;

  if (hasTarget) {
    if (safeUsageMinutes >= safeTargetMinutes) status = PROTOCOL_STATE_STATUSES.OVER;
    else if (ratio >= PROTOCOL_NEAR_LIMIT_RATIO) status = PROTOCOL_STATE_STATUSES.NEAR;
    else status = PROTOCOL_STATE_STATUSES.SAFE;
  }

  return {
    targetMinutes: safeTargetMinutes,
    usageMinutes: safeUsageMinutes,
    hasTarget,
    status,
    ratio,
    remainingMinutes: hasTarget ? Math.max(safeTargetMinutes - safeUsageMinutes, 0) : 0,
    overMinutes: hasTarget ? Math.max(safeUsageMinutes - safeTargetMinutes, 0) : 0,
    targetSource,
  };
}

function resolveScopeReferenceTarget(domain, siteGoals = {}) {
  const goalMinutes = resolvePositiveMinutes(siteGoals?.[domain]);
  if (goalMinutes > 0) {
    return {
      targetMinutes: goalMinutes,
      targetSource: PROTOCOL_TARGET_SOURCES.SITE_GOAL,
    };
  }

  return {
    targetMinutes: 0,
    targetSource: PROTOCOL_TARGET_SOURCES.NONE,
  };
}

export function buildProtectionProtocolStateSnapshot({
  globalGoal = 0,
  blockedDomains = [],
  siteGoals = {},
  recordingPolicy,
  stats = null,
  scopeBudgetRole = PROTOCOL_SCOPE_BUDGET_ROLES.REFERENCE,
  nowTs = Date.now(),
} = {}) {
  if (!recordingPolicy || typeof recordingPolicy !== 'object') throw new Error('PROTECTION_PROTOCOL_RECORDING_POLICY_REQUIRED');
  const recording = resolveSitesRecordingPolicy(recordingPolicy);
  const dateStr = stats?.basis === 'activity-day' ? stats.dateStr : getLocalDateStr(nowTs);
  const dayEntry = stats?.dates?.[dateStr];
  const safeBlockedDomains = Array.from(new Set(
    (Array.isArray(blockedDomains) ? blockedDomains : [])
      .map((domain) => (typeof domain === 'string' ? domain.trim().toLowerCase() : ''))
      .filter(Boolean),
  ));

  const globalUsageMinutes = recording.globalCapAvailable ? toUsageMinutes(
    dayEntry === undefined ? 0 : requireProtectionCharge(dayEntry.totals?.blockedActive, `${dateStr}:global`),
  ) : 0;
  const globalBudget = buildBudgetSnapshot({
    targetMinutes: recording.globalCapAvailable ? globalGoal : 0,
    usageMinutes: globalUsageMinutes,
    targetSource: PROTOCOL_TARGET_SOURCES.GLOBAL_PROTOCOL,
  });

  const global = { ...globalBudget };

  const scopes = safeBlockedDomains.reduce((acc, domain) => {
    const available = resolveTimeCapAvailability(domain, recordingPolicy).available;
    const usageMinutes = available ? toUsageMinutes(readActivityDaySiteCharge(dayEntry, domain, {
      blockedTargets: safeBlockedDomains, allowedTargets: recordingPolicy.allowedUrls,
    })) : 0;
    const referenceTargetMeta = resolveScopeReferenceTarget(domain, siteGoals);
    const referenceTarget = buildBudgetSnapshot({
      targetMinutes: available ? referenceTargetMeta.targetMinutes : 0,
      usageMinutes,
      targetSource: referenceTargetMeta.targetSource,
    });
    const activeTarget = !available ? buildBudgetSnapshot() : scopeBudgetRole === PROTOCOL_SCOPE_BUDGET_ROLES.ACTIVE
      && referenceTarget.hasTarget
      ? referenceTarget
      : {
        ...globalBudget,
        targetSource: PROTOCOL_TARGET_SOURCES.GLOBAL_PROTOCOL,
      };

    acc[domain] = {
      scopeKey: domain,
      protected: true,
      budgetRole: scopeBudgetRole,
      usageMinutes,
      referenceTarget,
      activeTarget,
    };
    return acc;
  }, {});

  return {
    capturedAt: nowTs,
    global,
    scopes,
  };
}
