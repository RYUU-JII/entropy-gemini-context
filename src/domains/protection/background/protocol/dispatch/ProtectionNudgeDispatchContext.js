import { isGoalEndEnabled } from '../../../../settings/config/nudgeConfig.js';
import {
  DEFAULT_THEME_ID,
  canonicalizeThemeIdInput,
} from '../../../../../themes/core/ids.js';
import { resolveNudgeThemeVariant } from '../../../../../themes/core/friction/runtime.js';
import { normalizeRuntimeLanguage } from '../../../../settings/i18n/language.js';
import {
  getSentinelFlareNudgeCopy,
  normalizeSentinelFlareNudgeRecoveryAction,
} from '../../../../settings/i18n/nudgeCopy.js';
import {
  assertNudgeRuntimeContext,
  assertNudgeRuntimeThemeId,
  normalizeNudgeRuntimeContext,
} from '../../../../nudge/runtime/nudgeRuntimeContext.js';
import {
  assertSentinelFlareProtocolScope,
  normalizeSentinelFlareProtocolProfile,
  normalizeSentinelFlareProtocolScope,
  SENTINEL_FLARE_PROTOCOL_SCOPES,
  SENTINEL_FLARE_PROTOCOL_VARIANTS,
} from '../../../../nudge/runtime/sentinelFlareProtocolProfile.js';
import { buildProtectionPolicyPayload } from './ProtectionDispatchPolicyPayload.js';
import { toErrorMessage } from './ProtectionDispatchTransport.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireNudgeRuntimeSnapshot(runtimeSnapshot, errorCode) {
  if (!isPlainObject(runtimeSnapshot)) {
    throw new Error(errorCode);
  }
  return runtimeSnapshot;
}

function requirePlainNudgeConfig(config, errorCode) {
  if (!isPlainObject(config)) {
    throw new Error(errorCode);
  }
  return config;
}

function requireRecoveryHostname(hostname) {
  const resolvedHostname = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
  if (!resolvedHostname) {
    throw new Error('PROTECTION_NUDGE_RECOVERY_HOSTNAME_REQUIRED');
  }
  return resolvedHostname;
}

function requireRecoveryProtocolScope(protocolProfile) {
  if (!isPlainObject(protocolProfile)) {
    throw new Error('PROTECTION_NUDGE_RECOVERY_PROTOCOL_PROFILE_REQUIRED');
  }
  return assertSentinelFlareProtocolScope(
    protocolProfile.protocolScope,
    'protection nudge recovery protocol scope',
  );
}

function resolveNudgeTriggerCandidates(runtimeSnapshot, config) {
  const resolvedRuntimeSnapshot = requireNudgeRuntimeSnapshot(
    runtimeSnapshot,
    'PROTECTION_NUDGE_TRIGGER_RUNTIME_SNAPSHOT_REQUIRED',
  );
  requirePlainNudgeConfig(
    config,
    'PROTECTION_NUDGE_TRIGGER_CONFIG_REQUIRED',
  );
  const policy = buildProtectionPolicyPayload(resolvedRuntimeSnapshot.policy ?? null);
  let site = null;
  if (isGoalEndEnabled(config, 'site') && policy.siteGoalMinutes > 0) {
    const activityDay = resolvedRuntimeSnapshot.activityDay;
    if (!isPlainObject(activityDay) || activityDay.basis !== 'activity-day'
      || !Number.isSafeInteger(activityDay.activeMs) || activityDay.activeMs < 0) {
      throw new Error('PROTECTION_NUDGE_TRIGGER_ACTIVITY_DAY_REQUIRED');
    }
    site = { targetMs: policy.siteGoalMinutes * 60_000, source: 'site_goal', observedMs: activityDay.activeMs };
  }
  const global = isGoalEndEnabled(config, 'global') && policy.globalCapLimitMs > 0
    ? { targetMs: policy.globalCapLimitMs, source: 'global_protocol', observedMs: policy.globalCapBlockedMs } : null;
  if (global && site && global.observedMs >= global.targetMs && site.observedMs >= site.targetMs) {
    global.episode = { mode: 'combined_goals', coveredScopes: ['global', 'site'],
      siteTargetMs: site.targetMs, siteObservedMs: site.observedMs,
      globalTargetMs: global.targetMs, globalObservedMs: global.observedMs };
  }
  return [global, site].filter(candidate => candidate !== null);
}

function resolveNudgeRecoveryAction(runtimeSnapshot) {
  const action = typeof runtimeSnapshot?.strategy?.recoveryAction === 'string'
    ? runtimeSnapshot.strategy.recoveryAction.trim()
    : '';
  if (action) return normalizeSentinelFlareNudgeRecoveryAction(action);
  return 'pause';
}

function buildRecoveryDashboardUrl(
  hostname,
  recoveryAction,
  browserPort,
) {
  const params = new URLSearchParams();
  params.set('tab', 'sites');
  params.set('domain', hostname);
  if (recoveryAction !== null) {
    params.set('recovery', recoveryAction);
  }
  const query = params.toString();
  return browserPort.runtimeGetURL(`src/pages/dashboard.html${query ? `?${query}` : ''}`);
}

function normalizeSentinelFlareDebugOverrides(debugOverrides, baseProfile) {
  if (!debugOverrides || typeof debugOverrides !== 'object') {
    return {
      protocolProfile: baseProfile,
      configOverrides: {},
    };
  }

  const protocolScope = normalizeSentinelFlareProtocolScope(
    debugOverrides.protocolScope,
    baseProfile?.protocolScope,
  );
  const protocolVariant = protocolScope === SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL
    ? SENTINEL_FLARE_PROTOCOL_VARIANTS.GLOBAL_SENTINEL
    : SENTINEL_FLARE_PROTOCOL_VARIANTS.SITE_FURIN;
  const defaultProtocolIntensity = protocolScope === SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL
    ? 0.92
    : baseProfile?.protocolIntensity;
  const configOverrides = typeof debugOverrides.hudVisible === 'boolean'
    ? { hudVisible: debugOverrides.hudVisible }
    : {};

  return {
    protocolProfile: normalizeSentinelFlareProtocolProfile({
      protocolScope,
      protocolVariant,
      protocolIntensity: debugOverrides.protocolIntensity ?? defaultProtocolIntensity,
      escalationReason: 'debug',
    }, baseProfile),
    configOverrides,
  };
}

export function createProtectionNudgeDispatchContext({
  runtimeLanguageStore,
  browserPort,
  readThemePreference,
  recordDiagnostic,
  defaultThemeId = DEFAULT_THEME_ID,
} = {}) {
  if (!runtimeLanguageStore || typeof runtimeLanguageStore.get !== 'function') {
    throw new Error('PROTECTION_NUDGE_CONTEXT_LANGUAGE_STORE_REQUIRED');
  }
  if (!browserPort || typeof browserPort.getUILanguage !== 'function' || typeof browserPort.runtimeGetURL !== 'function') {
    throw new Error('PROTECTION_NUDGE_CONTEXT_BROWSER_PORT_REQUIRED');
  }
  if (typeof readThemePreference !== 'function') {
    throw new Error('PROTECTION_NUDGE_CONTEXT_THEME_READER_REQUIRED');
  }
  if (typeof recordDiagnostic !== 'function') {
    throw new Error('PROTECTION_NUDGE_CONTEXT_DIAGNOSTICS_REQUIRED');
  }

  async function resolveRuntimeLanguage() {
    try {
      const runtimeLanguage = await runtimeLanguageStore.get('en');
      if (runtimeLanguage) {
        return normalizeRuntimeLanguage(runtimeLanguage, 'en');
      }
    } catch (error) {
      recordDiagnostic('nudge_runtime_language_store_read_failed', {
        error: toErrorMessage(error),
      });
    }
    try {
      const uiLanguage = browserPort.getUILanguage();
      if (uiLanguage) {
        return normalizeRuntimeLanguage(uiLanguage, 'en');
      }
    } catch (error) {
      recordDiagnostic('nudge_runtime_ui_language_read_failed', {
        error: toErrorMessage(error),
      });
    }
    return normalizeRuntimeLanguage(
      typeof navigator !== 'undefined' ? navigator?.language : '',
      'en',
    );
  }

  async function resolveRuntimeContext(overrideThemeId = null) {
    const rawOverrideThemeId = typeof overrideThemeId === 'string'
      ? overrideThemeId.trim()
      : '';
    let themeId = '';
    if (rawOverrideThemeId) {
      themeId = canonicalizeThemeIdInput(rawOverrideThemeId, '');
      if (!themeId) {
        assertNudgeRuntimeThemeId(
          rawOverrideThemeId,
          'protection nudge override theme',
        );
      }
    }
    if (!themeId) {
      themeId = assertNudgeRuntimeThemeId(
        await readThemePreference(defaultThemeId),
        'protection nudge stored theme preference',
      );
    }
    const language = await resolveRuntimeLanguage();
    const variant = resolveNudgeThemeVariant(themeId);
    return normalizeNudgeRuntimeContext({
      themeId,
      language,
      variantId: variant?.styleVariant || themeId,
    });
  }

  async function buildRecoveryAwareNudgeConfig({
    config,
    runtimeContext,
    runtimeSnapshot,
    hostname,
    protocolProfile,
    goalBinding = null,
  } = {}) {
    const resolvedConfig = requirePlainNudgeConfig(
      config,
      'PROTECTION_NUDGE_RECOVERY_CONFIG_REQUIRED',
    );
    const resolvedRuntimeContext = assertNudgeRuntimeContext(
      runtimeContext,
      'protection nudge recovery runtime context',
    );
    const resolvedRuntimeSnapshot = requireNudgeRuntimeSnapshot(
      runtimeSnapshot,
      'PROTECTION_NUDGE_RECOVERY_RUNTIME_SNAPSHOT_REQUIRED',
    );
    const resolvedHostname = requireRecoveryHostname(hostname);
    const protocolScope = requireRecoveryProtocolScope(protocolProfile);
    const recoveryAction = resolveNudgeRecoveryAction(resolvedRuntimeSnapshot);
    const copy = getSentinelFlareNudgeCopy(resolvedRuntimeContext, {
      recoveryAction,
      protocolScope,
      combinedGoals: goalBinding !== null && goalBinding.coveredScopes.join(',') === 'global,site',
    });
    return {
      ...resolvedConfig,
      protocol: copy.protocol,
      message: copy.message,
      recovery: {
        action: recoveryAction,
        dashboardUrl: buildRecoveryDashboardUrl(
          resolvedHostname,
          recoveryAction,
          browserPort,
        ),
        hostname: resolvedHostname,
      },
    };
  }

  return {
    buildRecoveryAwareNudgeConfig,
    normalizeSentinelFlareDebugOverrides,
    resolveNudgeTriggerCandidates,
    resolveRuntimeContext,
    resolveRuntimeLanguage,
  };
}
