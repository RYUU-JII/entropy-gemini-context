import {
  DEFAULT_RULES_MODE,
  normalizeRulesMode,
} from '../../settings/config/siteRules.js';
import {
  normalizeDirectTriggers,
  normalizeInterventionPlan,
  normalizePressureSignals,
  normalizeProtectionPosture,
} from '../contracts/protectionContracts.js';
import {
  BASIC_STRATEGY_POLICY_DEFAULTS,
  buildBasicTargetRecommendation,
} from '../strategy/catalog/basicStrategyPolicy.js';
import { buildBasicProtectionRecentUsageTrajectory } from './basicProtectionRecentTrajectory.js';
import { requireCoolingCurve } from '../../settings/config/coolingCurvePolicy.js';

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function normalizeNow(now) {
  const numeric = Number(now);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

function normalizeMinutes(value) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeMs(value) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeStringValue(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function dedupeReasonCodes(reasonCodes = []) {
  return Array.from(new Set(
    (Array.isArray(reasonCodes) ? reasonCodes : [])
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
  ));
}

function elevateOverflowPosture(posture) {
  const normalized = normalizeProtectionPosture(posture, 'balanced');
  if (normalized === 'gentle') return 'balanced';
  if (normalized === 'balanced') return 'strict';
  return 'strict';
}

function buildRuntimeTraceId({ revision, hostname, now }) {
  const safeRevision = Number.isFinite(Number(revision)) ? Number(revision) : 0;
  const safeNow = normalizeNow(now);
  const safeHost = typeof hostname === 'string'
    ? hostname.toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 40)
    : 'unknown';
  return `upe_${safeNow.toString(36)}_${safeRevision.toString(36)}_${safeHost || 'unknown'}`;
}

function normalizeProfileMetadata(profileMetadata = null) {
  const source = profileMetadata && typeof profileMetadata === 'object' ? profileMetadata : {};
  return {
    budgetMinutes: normalizeMinutes(source.budgetMinutes),
    siteGoalMinutes: normalizeMinutes(source.siteGoalMinutes),
    protocolBudgetRole: normalizeStringValue(source.protocolBudgetRole, 'reference'),
    protocolActiveTargetMinutes: normalizeMinutes(source.protocolActiveTargetMinutes),
    protocolActiveTargetSource: normalizeStringValue(source.protocolActiveTargetSource, 'none'),
    referenceTargetMinutes: normalizeMinutes(source.referenceTargetMinutes),
    referenceTargetSource: normalizeStringValue(source.referenceTargetSource, 'none'),
  };
}

function normalizeCapState(capState = null) {
  const source = capState && typeof capState === 'object' ? capState : {};
  return {
    globalGoalMin: normalizeMinutes(source.globalGoalMin),
    globalGoalMs: normalizeMs(source.globalGoalMs),
    blockedTodayMs: normalizeMs(source.blockedTodayMs),
    exceeded: normalizeBoolean(source.exceeded, false),
    dateStr: typeof source.dateStr === 'string' && source.dateStr.trim()
      ? source.dateStr.trim()
      : '',
  };
}

export function resolveProtectionDecisionReason({
  forcedReason = null,
  plan = null,
  defaultReason = 'managed_policy',
} = {}) {
  if (forcedReason) return forcedReason;
  if (plan?.trace?.directTriggers?.includes('BUDGET_NEAR_EXHAUSTED')) return 'budget_near_exhausted';
  if (Array.isArray(plan?.trace?.pressureSignals) && plan.trace.pressureSignals.length > 0) {
    return 'pressure_signal_present';
  }
  return defaultReason || 'managed_policy';
}

export function buildProtectionPolicySummary({
  rulesMode = null,
  reason = 'unknown',
  isHardBlockWindow = false,
  stepDelta = 0,
  siteGoalMinutes = 0,
  protocolBudgetRole = 'reference',
  protocolTargetMinutes = 0,
  protocolTargetSource = 'none',
  referenceTargetMinutes = 0,
  referenceTargetSource = 'none',
  capState = null,
  isAllowedWindow = false,
} = {}) {
  const normalizedCapState = normalizeCapState(capState);
  return {
    mode: rulesMode || null,
    reason: reason || 'unknown',
    hardBlockWindow: !!isHardBlockWindow,
    stepDelta: Number(stepDelta) || 0,
    siteGoalMinutes: normalizeMinutes(siteGoalMinutes),
    protocolBudgetRole: normalizeStringValue(protocolBudgetRole, 'reference'),
    protocolTargetMinutes: normalizeMinutes(protocolTargetMinutes),
    protocolTargetSource: normalizeStringValue(protocolTargetSource, 'none'),
    referenceTargetMinutes: normalizeMinutes(referenceTargetMinutes),
    referenceTargetSource: normalizeStringValue(referenceTargetSource, 'none'),
    globalCapExceeded: !!normalizedCapState.exceeded,
    globalCapBlockedMs: normalizedCapState.blockedTodayMs,
    globalCapLimitMs: normalizedCapState.globalGoalMs,
    isAllowedWindow: !!isAllowedWindow,
  };
}

export function buildProtectionRuntimeTrace({
  revision = 0,
  hostname = '',
  now = Date.now(),
  scope = null,
  reasonCodes = [],
} = {}) {
  return {
    traceId: buildRuntimeTraceId({ revision, hostname, now }),
    source: 'tracking_protection_service',
    reasonCodes: dedupeReasonCodes(reasonCodes),
  };
}

export function buildProtectionStrategyContext({
  declaredTargetMinutes = 0,
  recentUsageTrajectory,
  todayMinutes = 0,
} = {}) {
  const targetRecommendation = buildBasicTargetRecommendation({
    recentUsageTrajectory,
    todayMinutes,
  });
  const normalizedDeclaredTargetMinutes = normalizeMinutes(declaredTargetMinutes);

  return {
    lifecyclePhase: BASIC_STRATEGY_POLICY_DEFAULTS.lifecyclePhase,
    declaredTargetMinutes: normalizedDeclaredTargetMinutes,
    recommendedTargetMinutes: targetRecommendation.recommendedTargetMinutes,
    effectiveTargetMinutes: normalizedDeclaredTargetMinutes,
    effectiveTargetSource: BASIC_STRATEGY_POLICY_DEFAULTS.effectiveTargetSource,
    exceededDaysInWindow: recentUsageTrajectory.evidence.exceededDays,
    recentUsageTrajectory,
    targetRecommendation,
  };
}

export function createProtectionRuntimeDecisionService() {
  function prepareEvaluation({
    hostname = '',
    scope = null,
    rulesMode = DEFAULT_RULES_MODE,
    capState = null,
    isHardBlockWindow = false,
    isAllowedWindow = false,
    profile = null,
    profileMetadata = null,
    statsCache = null,
    domainActivityMs = 0,
    sessionMs = 0,
    pressureSignals = [],
    directTriggers = [],
    now = Date.now(),
    revision = 0,
    coolingCurve,
  } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    const normalizedRulesMode = normalizeRulesMode(rulesMode, DEFAULT_RULES_MODE);
    const normalizedCapState = normalizeCapState(capState);
    const normalizedProfileMetadata = normalizeProfileMetadata(profileMetadata);
    const normalizedNow = normalizeNow(now);

    if (!scope?.ok || !scope?.isBlockedDomain) {
      const reason = scope?.ok ? 'unmanaged' : 'invalid_scope';
      const trace = buildProtectionRuntimeTrace({
        revision,
        hostname: normalizedHostname,
        now: normalizedNow,
        scope,
        reasonCodes: [reason],
      });

      return {
        status: 'inactive',
        hostname: normalizedHostname,
        trace,
        policySummary: buildProtectionPolicySummary({
          rulesMode: normalizedRulesMode,
          reason,
          isHardBlockWindow,
          isAllowedWindow,
          stepDelta: 0,
          siteGoalMinutes: normalizedProfileMetadata.siteGoalMinutes,
          protocolBudgetRole: normalizedProfileMetadata.protocolBudgetRole,
          protocolTargetMinutes: normalizedProfileMetadata.protocolActiveTargetMinutes,
          protocolTargetSource: normalizedProfileMetadata.protocolActiveTargetSource,
          referenceTargetMinutes: normalizedProfileMetadata.referenceTargetMinutes,
          referenceTargetSource: normalizedProfileMetadata.referenceTargetSource,
          capState: normalizedCapState,
        }),
        dispatchDecision: {
          isBlockedDomain: !!scope?.isBlockedDomain,
          shouldApply: false,
          domainClassId: scope?.domainClassId || 'unmanaged',
        },
      };
    }

    const recentUsageTrajectory = buildBasicProtectionRecentUsageTrajectory({
      statsRange: statsCache,
      hostname: normalizedHostname,
      thresholdMs: normalizedProfileMetadata.budgetMinutes * 60_000,
      now: normalizedNow,
    });
    const isOverflowReinforce = normalizedCapState.exceeded;
    const effectiveProfile = isOverflowReinforce
      ? {
        ...(profile || {}),
        posture: elevateOverflowPosture(profile?.posture),
      }
      : profile;

    const strategyContext = buildProtectionStrategyContext({
      declaredTargetMinutes: normalizedProfileMetadata.budgetMinutes,
      recentUsageTrajectory,
      todayMinutes: Math.round(normalizeMs(domainActivityMs) / 60_000),
    });
    const effectiveDomainMs = normalizeMs(domainActivityMs);

    return {
      status: 'active',
      hostname: normalizedHostname,
      scope,
      effectiveProfile,
      isOverflowReinforce,
      strategyContext,
      decisionContext: {
        revision,
        now: normalizedNow,
        rulesMode: normalizedRulesMode,
        isHardBlockWindow: !!isHardBlockWindow,
        isAllowedWindow: !!isAllowedWindow,
        capState: normalizedCapState,
        siteGoalMinutes: normalizedProfileMetadata.siteGoalMinutes,
        protocolBudgetRole: normalizedProfileMetadata.protocolBudgetRole,
        protocolTargetMinutes: normalizedProfileMetadata.protocolActiveTargetMinutes,
        protocolTargetSource: normalizedProfileMetadata.protocolActiveTargetSource,
        referenceTargetMinutes: normalizedProfileMetadata.referenceTargetMinutes,
        referenceTargetSource: normalizedProfileMetadata.referenceTargetSource,
        coolingCurve: requireCoolingCurve(coolingCurve),
      },
      engineInput: {
        host: normalizedHostname,
        profile: effectiveProfile,
        now: normalizedNow,
        context: {
          siteDayMs: effectiveDomainMs,
          sessionMs: normalizeMs(sessionMs),
          pressureSignals: normalizePressureSignals(pressureSignals),
          directTriggers: normalizeDirectTriggers(directTriggers),
          effectiveTargetMinutes: strategyContext.effectiveTargetMinutes,
          strategyContext,
        },
      },
    };
  }

  function finalizeEvaluation({
    preparedEvaluation = null,
    engineResult = null,
  } = {}) {
    if (preparedEvaluation?.status !== 'active') {
      return preparedEvaluation;
    }

    const plan = normalizeInterventionPlan(engineResult?.plan);
    const reason = resolveProtectionDecisionReason({
      plan,
    });
    const trace = buildProtectionRuntimeTrace({
      revision: preparedEvaluation.decisionContext?.revision,
      hostname: preparedEvaluation.hostname,
      now: preparedEvaluation.decisionContext?.now,
      scope: preparedEvaluation.scope,
      reasonCodes: [
        reason,
        ...(preparedEvaluation.isOverflowReinforce ? ['global_cap_reinforced'] : []),
        ...(Array.isArray(plan?.state?.reasons) ? plan.state.reasons : []),
      ],
    });

    return {
      status: 'active',
      hostname: preparedEvaluation.hostname,
      effectiveProfile: preparedEvaluation.effectiveProfile,
      trace,
      reason,
      policySummary: buildProtectionPolicySummary({
        rulesMode: preparedEvaluation.decisionContext?.rulesMode,
        reason,
        isHardBlockWindow: preparedEvaluation.decisionContext?.isHardBlockWindow,
        isAllowedWindow: preparedEvaluation.decisionContext?.isAllowedWindow,
        stepDelta: Math.max(0, (Number(plan?.state?.level) || 1) - 1),
        siteGoalMinutes: preparedEvaluation.decisionContext?.siteGoalMinutes,
        protocolBudgetRole: preparedEvaluation.decisionContext?.protocolBudgetRole,
        protocolTargetMinutes: preparedEvaluation.decisionContext?.protocolTargetMinutes,
        protocolTargetSource: preparedEvaluation.decisionContext?.protocolTargetSource,
        referenceTargetMinutes: preparedEvaluation.decisionContext?.referenceTargetMinutes,
        referenceTargetSource: preparedEvaluation.decisionContext?.referenceTargetSource,
        capState: preparedEvaluation.decisionContext?.capState,
      }),
      dispatchDecision: {
        isBlockedDomain: true,
        domainClassId: preparedEvaluation.scope?.domainClassId || null,
      },
    };
  }

  return {
    prepareEvaluation,
    finalizeEvaluation,
  };
}
