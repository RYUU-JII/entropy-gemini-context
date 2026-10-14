import { MESSAGE_TYPES } from '../../../../../platform/messaging/messageTypes.js';
import { requireFurinDeliveryForm } from '../../../../../platform/storage/nudge/furinDailyReceiptContract.js';
import { requireGoalEpisodeBinding } from '../../../../nudge/runtime/goalEpisodeBinding.js';
import {
  buildNudgeProtocolClaim,
} from '../../../../nudge/runtime/session/nudgeSessionCore.js';
import {
  deriveSentinelFlareProtocolProfile,
  normalizeSentinelFlareProtocolProfile,
} from '../../../../nudge/runtime/sentinelFlareProtocolProfile.js';
import {
  normalizeNudgePresageConfig,
} from '../../../../settings/config/nudgeConfig.js';

function failTriggerTarget(fieldName) {
  throw new Error(`PROTECTION_NUDGE_MESSAGE_TRIGGER_TARGET_INVALID:${fieldName}`);
}

function requireMessageTriggerTarget(triggerTarget) {
  if (triggerTarget === null || typeof triggerTarget !== 'object' || Array.isArray(triggerTarget)) {
    failTriggerTarget('target');
  }
  if (!Number.isInteger(triggerTarget.targetMs) || triggerTarget.targetMs < 0) {
    failTriggerTarget('targetMs');
  }
  if (
    Object.prototype.hasOwnProperty.call(triggerTarget, 'observedMs')
    && (!Number.isInteger(triggerTarget.observedMs) || triggerTarget.observedMs < 0)
  ) {
    failTriggerTarget('observedMs');
  }
  const source = typeof triggerTarget.source === 'string' ? triggerTarget.source.trim() : '';
  if (!source) {
    failTriggerTarget('source');
  }
  return {
    ...triggerTarget,
    source,
  };
}

export function buildProtectionNudgeCandidateProtocolClaim({
  runtimeSnapshot,
  triggerTarget,
  force = false,
} = {}) {
  const resolvedTriggerTarget = requireMessageTriggerTarget(triggerTarget);
  const protocolProfile = deriveSentinelFlareProtocolProfile({
    runtimeSnapshot,
    triggerTarget: resolvedTriggerTarget,
    reason: resolvedTriggerTarget.source,
    debtMode: false,
    force: !!force,
  });
  return buildNudgeProtocolClaim({
    protocolProfile,
    triggerTarget: resolvedTriggerTarget,
  });
}

export async function buildProtectionNudgeStartMessage({
  config,
  runtimeSnapshot,
  triggerTarget,
  hasDebt = false,
  force = false,
  protocolClaim = null,
  debugOverrides = null,
  dispatchContext,
  hostname,
  dateStr,
  key,
  runId,
  deliveryForm,
  goalBinding = null,
} = {}) {
  const resolvedTriggerTarget = requireMessageTriggerTarget(triggerTarget);
  const admittedDeliveryForm = requireFurinDeliveryForm(deliveryForm);
  if (!force) {
    const binding = requireGoalEpisodeBinding(goalBinding);
    if (binding.key !== key || binding.runId !== runId || binding.hostname !== hostname || binding.dateStr !== dateStr) {
      throw new Error('PROTECTION_NUDGE_MESSAGE_GOAL_BINDING_MISMATCH');
    }
  }
  const runtimeContext = await dispatchContext.resolveRuntimeContext(config.visualThemeId);
  const nudgeReason = force ? 'debug' : (hasDebt ? 'debt_retry' : resolvedTriggerTarget.source);
  const debtProtocolProfile = hasDebt && protocolClaim
    ? normalizeSentinelFlareProtocolProfile({
      protocolScope: protocolClaim.protocolScope,
      protocolVariant: protocolClaim.protocolVariant,
      protocolIntensity: protocolClaim.protocolIntensity,
      escalationReason: 'debt_retry',
    })
    : null;
  const baseProtocolProfile = debtProtocolProfile || deriveSentinelFlareProtocolProfile({
    runtimeSnapshot,
    triggerTarget: resolvedTriggerTarget,
    reason: nudgeReason,
    debtMode: !!hasDebt,
    force: !!force,
  });
  const {
    protocolProfile,
    configOverrides,
  } = force
    ? dispatchContext.normalizeSentinelFlareDebugOverrides(debugOverrides, baseProtocolProfile)
    : { protocolProfile: baseProtocolProfile, configOverrides: {} };
  if (!force && goalBinding.purpose !== (protocolProfile.protocolScope === 'global' ? 'global_goal' : 'site_goal')) {
    throw new Error('PROTECTION_NUDGE_MESSAGE_GOAL_BINDING_MISMATCH');
  }
  const recoveryAwareConfig = {
    ...(await dispatchContext.buildRecoveryAwareNudgeConfig({
      config,
      runtimeContext,
      runtimeSnapshot,
      hostname,
      protocolProfile,
      goalBinding,
    })),
    ...protocolProfile,
    ...configOverrides,
    deliveryForm: admittedDeliveryForm,
    ...(protocolProfile.protocolScope === 'site' ? { siteFurinReflection: {
      ...requireSiteReflection(runtimeSnapshot,hostname,force),
      targetMs:resolvedTriggerTarget.targetMs,
    } } : {}),
  };

  return {
    message: {
      type: force ? MESSAGE_TYPES.NUDGE_DEBUG_START : MESSAGE_TYPES.NUDGE_START,
      payload: {
        hostname,
        dateStr,
        ...(!force ? { key, runId } : {}),
        config: recoveryAwareConfig,
        reason: nudgeReason,
        triggerTargetMs: resolvedTriggerTarget.targetMs,
        episode: resolvedTriggerTarget.episode || null,
        ...(!force ? { goalBinding } : {}),
        debtMode: !!hasDebt,
        runtimeContext,
        protocolProfile,
      },
    },
    nudgeReason,
    protocolProfile,
    recoveryAwareConfig,
    runtimeContext,
  };
}

function requireSiteReflection(runtimeSnapshot,hostname,manual) {
  if (!runtimeSnapshot.activityDay || typeof runtimeSnapshot.activityDay !== 'object') throw new Error('PROTECTION_NUDGE_ACTIVITY_DAY_REQUIRED');
  if (Object.hasOwn(runtimeSnapshot.activityDay,'reflection')) return runtimeSnapshot.activityDay.reflection;
  if (!manual) throw new Error('PROTECTION_NUDGE_SITE_REFLECTION_REQUIRED');
  // A manual trigger may have no admitted domain history. No sample facts enter
  // production; named QA realization owns its separate synthetic fixture.
  return {schemaVersion:1,hostname,cycleStartAt:null,observedAt:null,
    activeMs:runtimeSnapshot.activityDay.activeMs,representedMs:0,segments:[],coverage:'unavailable'};
}

export async function buildProtectionNudgePresageMessage({
  config,
  runtimeSnapshot,
  triggerTarget,
  protocolClaim = null,
  dispatchContext,
  hostname,
  dateStr,
  key,
  presageConfig = null,
} = {}) {
  const resolvedTriggerTarget = requireMessageTriggerTarget(triggerTarget);
  const derivedProtocolProfile = deriveSentinelFlareProtocolProfile({
    runtimeSnapshot,
    triggerTarget: resolvedTriggerTarget,
    reason: resolvedTriggerTarget.source,
    debtMode: false,
    force: false,
  });
  const protocolProfile = protocolClaim
    ? normalizeSentinelFlareProtocolProfile({
      protocolScope: protocolClaim.protocolScope,
      protocolVariant: protocolClaim.protocolVariant,
      protocolIntensity: protocolClaim.protocolIntensity,
      escalationReason: derivedProtocolProfile.escalationReason,
    }, derivedProtocolProfile)
    : derivedProtocolProfile;
  if (protocolProfile.protocolScope !== 'global') {
    throw new Error(`PROTECTION_NUDGE_PRESAGE_SCOPE_UNSUPPORTED:${protocolProfile.protocolScope || 'unknown'}`);
  }
  const runtimeContext = await dispatchContext.resolveRuntimeContext(config.visualThemeId);
  const presage = normalizeNudgePresageConfig({
    ...(config?.presage && typeof config.presage === 'object' ? config.presage : {}),
    ...(presageConfig && typeof presageConfig === 'object' ? presageConfig : {}),
  });
  const oneShotPresage = {
    ...presage,
    count: 1,
  };

  return {
    message: {
      type: MESSAGE_TYPES.NUDGE_PRESAGE,
      payload: {
        hostname,
        dateStr,
        key,
        config: {
          ...config,
          ...protocolProfile,
          presage: oneShotPresage,
        },
        reason: 'presage',
        triggerTargetMs: resolvedTriggerTarget.targetMs,
        observedMs: Object.prototype.hasOwnProperty.call(resolvedTriggerTarget, 'observedMs')
          ? resolvedTriggerTarget.observedMs
          : null,
        episode: resolvedTriggerTarget.episode || null,
        runtimeContext,
        protocolProfile,
        presage: oneShotPresage,
      },
    },
    protocolProfile,
    runtimeContext,
  };
}
