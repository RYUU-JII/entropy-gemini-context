import { hasEnabledGoalEnd } from '../../settings/config/nudgeConfig.js';
import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
  normalizeFilterSettings,
  normalizeSocialMetricOptions,
} from '../../settings/config/index.js';
import { VISUAL_FRICTION_FEATURE_KEYS } from '../../settings/config/visualFrictionProfiles.js';
import {
  normalizeGateConfig,
} from '../../settings/config/gateConfig.js';
import {
  resolveMemoryPurgeSettings,
} from '../../settings/config/siteRules.js';
import {
  normalizeProtectionProfile,
} from '../contracts/protectionContracts.js';
import { DEFAULT_PROTECTION_PRESET_ID } from '../catalog/presetContract.js';
import { resolveProtectionPresetSelection } from '../catalog/presetCatalog.js';
import {
  CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS,
  expandCanonicalArtifactPreferenceMapToRuntimePreferences,
  normalizeCanonicalArtifactPreferenceMap,
} from '../runtime/canonicalArtifactRuntimeBinding.js';
import { applyArtifactControlStateToPreferences } from '../runtime/ArtifactControlService.js';
import { applyArtifactDisclosureEligibilityToPreferences } from '../runtime/ArtifactDisclosureEligibilityService.js';
import { resolveProtectionProtocolScopeProjection } from './protectionProtocolProjection.js';
import { normalizeCoolingCurve, resolveCoolingCurvePosture } from '../../settings/config/coolingCurvePolicy.js';

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function requireNudgeConfigMergeOwner(mergeNudgeConfig, errorCode) {
  if (typeof mergeNudgeConfig !== 'function') {
    throw new Error(errorCode);
  }
  return mergeNudgeConfig;
}

function resolveArtifactPreferences({
  filterSettings,
  settingsSnapshot,
  mergeNudgeConfig,
} = {}) {
  const normalizedFilters = normalizeFilterSettings(filterSettings || CONFIG_DEFAULT_FILTER_SETTINGS);
  const memoryPurgeSettings = resolveMemoryPurgeSettings(settingsSnapshot);
  const nudgeConfig = mergeNudgeConfig(settingsSnapshot?.nudgeConfig);
  const visualFiltersEnabled = VISUAL_FRICTION_FEATURE_KEYS.some(
    (featureKey) => normalizedFilters[featureKey].isActive,
  );
  const textRhythmEnabled = !!normalizedFilters?.textRhythm?.isActive;
  const socialMetricsSetting = normalizedFilters?.socialMetrics || CONFIG_DEFAULT_FILTER_SETTINGS.socialMetrics;
  const socialMetricOptions = normalizeSocialMetricOptions(socialMetricsSetting?.value);
  const veilSocialMetricsEnabled = !!socialMetricsSetting?.isActive
    && (
      socialMetricOptions.feedbackCounts
      || socialMetricOptions.viewCounts
      || socialMetricOptions.audienceCounts
    );
  const veilTimeSignalsEnabled = !!socialMetricsSetting?.isActive && socialMetricOptions.timeSignals;
  const clickDelayEnabled = !!normalizedFilters?.clickDelay?.isActive;
  const ensoGateEnabled = !!normalizedFilters?.ensoGate?.isActive;
  const scrollFrictionEnabled = !!normalizedFilters?.scrollFriction?.isActive;
  const navigationButtonLockEnabled = !!normalizedFilters?.navigationButtonLock?.isActive;
  const inputVisualBrakeEnabled = !!normalizedFilters?.inputVisualBrake?.isActive;
  const skipFrictionEnabled = !!normalizedFilters?.videoSkipGuard?.isActive;
  const shortformBlockEnabled = !!normalizedFilters?.shortFormBlock?.isActive;
  const normalizedGateConfig = normalizeGateConfig(settingsSnapshot?.gateConfig);
  const detourSpreadGuardEnabled = !!normalizedGateConfig.detourSpreadGuard?.enabled;
  const shojiEnabled = visualFiltersEnabled;
  const brakeEnabled = clickDelayEnabled || scrollFrictionEnabled || navigationButtonLockEnabled || inputVisualBrakeEnabled || skipFrictionEnabled;
  const barrierEnabled = textRhythmEnabled || ensoGateEnabled || detourSpreadGuardEnabled;
  const echoEnabled = memoryPurgeSettings.historyCleanupForBlocked
    || memoryPurgeSettings.concealBlockedBookmarks;
  const gateEnabled = !!normalizedGateConfig.entryCheckpoint?.enabled
    || !!normalizedGateConfig.returnGuard?.enabled;

  return normalizeCanonicalArtifactPreferenceMap({
    lens: {
      enabled: shojiEnabled,
      autoTrigger: shojiEnabled,
    },
    veil: {
      enabled: veilSocialMetricsEnabled || veilTimeSignalsEnabled || shortformBlockEnabled,
      autoTrigger: veilSocialMetricsEnabled || veilTimeSignalsEnabled || shortformBlockEnabled,
    },
    brake: {
      enabled: brakeEnabled,
      autoTrigger: brakeEnabled,
    },
    barrier: {
      enabled: barrierEnabled,
      autoTrigger: barrierEnabled,
    },
    flare: {
      enabled: hasEnabledGoalEnd(nudgeConfig),
      autoTrigger: hasEnabledGoalEnd(nudgeConfig),
    },
    echo: {
      enabled: echoEnabled,
      autoTrigger: echoEnabled,
    },
    gate: {
      enabled: gateEnabled,
      autoTrigger: gateEnabled,
    },
  });
}

function mergeArtifactPreferences({
  baseArtifacts = {},
  presetArtifacts = {},
  preferPreset = false,
} = {}) {
  const normalizedBaseArtifacts = normalizeCanonicalArtifactPreferenceMap(baseArtifacts);
  const normalizedPresetArtifacts = normalizeCanonicalArtifactPreferenceMap(presetArtifacts);
  return CANONICAL_PROTECTION_ARTIFACT_PREFERENCE_IDS.reduce((acc, artifactId) => {
    if (preferPreset) {
      const preset = normalizedPresetArtifacts?.[artifactId] || {};
      acc[artifactId] = {
        enabled: !!preset.enabled,
        autoTrigger: !!preset.autoTrigger,
      };
      return acc;
    }

    const base = normalizedBaseArtifacts?.[artifactId] || {};
    acc[artifactId] = {
      enabled: !!base.enabled,
      autoTrigger: !!base.autoTrigger,
    };
    return acc;
  }, {});
}

function shouldApplySelectedPreset(presetSelection) {
  const presetId = typeof presetSelection?.presetId === 'string' ? presetSelection.presetId.trim() : '';
  return !!presetId && presetId !== DEFAULT_PROTECTION_PRESET_ID;
}

export function resolveProtectionProfile({
  hostname,
  scope,
  filterSettings,
  protocolScope = null,
  siteGoalMinutes = 0,
  settingsSnapshot,
  artifactDisclosureSnapshot,
  mergeNudgeConfig,
} = {}) {
  const mergeNudgeConfigOwner = requireNudgeConfigMergeOwner(
    mergeNudgeConfig,
    'PROTECTION_PROFILE_NUDGE_CONFIG_OWNER_REQUIRED',
  );
  const source = settingsSnapshot && typeof settingsSnapshot === 'object' ? settingsSnapshot : {};
  const normalizedHostname = normalizeHost(hostname);
  const presetSelection = resolveProtectionPresetSelection({
    catalog: source?.protectionPresetCatalog,
    assignments: source?.protectionPresetAssignments,
    host: normalizedHostname,
  });
  const selectedPreset = presetSelection?.preset || null;
  const applyPreset = shouldApplySelectedPreset(presetSelection);
  const posture = applyPreset
    ? selectedPreset?.posture
    : resolveCoolingCurvePosture(normalizeCoolingCurve(source.coolingCurve));
  const directSiteGoalMinutes = Math.max(0, Math.floor(Number(siteGoalMinutes) || 0));
  const {
    protocolBudgetRole,
    protocolReferenceTargetMinutes,
    protocolReferenceTargetSource,
    protocolActiveTargetMinutes,
    protocolActiveTargetSource,
  } = resolveProtectionProtocolScopeProjection(protocolScope);
  const resolvedReferenceTargetMinutes = protocolReferenceTargetMinutes > 0
    ? protocolReferenceTargetMinutes
    : directSiteGoalMinutes;
  const resolvedReferenceTargetSource = protocolReferenceTargetMinutes > 0
    ? protocolReferenceTargetSource
    : directSiteGoalMinutes > 0
      ? 'site_goal'
      : 'none';
  const siteGoalBudgetMinutes = resolvedReferenceTargetSource === 'site_goal'
    ? resolvedReferenceTargetMinutes
    : directSiteGoalMinutes;
  const budgetMinutes = scope?.isBlockedDomain
    ? siteGoalBudgetMinutes
    : 0;
  const mergedArtifacts = mergeArtifactPreferences({
    baseArtifacts: resolveArtifactPreferences({
      filterSettings,
      settingsSnapshot: source,
      mergeNudgeConfig: mergeNudgeConfigOwner,
    }),
    presetArtifacts: applyPreset ? selectedPreset?.artifacts : null,
    preferPreset: applyPreset,
  });
  // Goal-end choices are canonical across presets; preset recommendations cannot
  // turn a disabled scope on or conceal an explicitly enabled goal end.
  const goalEndsEnabled = hasEnabledGoalEnd(mergeNudgeConfigOwner(source.nudgeConfig));
  mergedArtifacts.flare = { enabled: goalEndsEnabled, autoTrigger: goalEndsEnabled };
  const artifacts = applyArtifactDisclosureEligibilityToPreferences(
    applyArtifactControlStateToPreferences(mergedArtifacts, source?.artifactControlState), artifactDisclosureSnapshot,
  );

  const profile = normalizeProtectionProfile({
    posture,
    budgets: budgetMinutes > 0 && normalizedHostname
      ? {
        [normalizedHostname]: { dailyMinutes: budgetMinutes },
      }
      : {},
    artifacts: expandCanonicalArtifactPreferenceMapToRuntimePreferences(artifacts),
    levelLanes: applyPreset ? (selectedPreset?.lanes || null) : null,
  });

  return {
    profile,
    metadata: {
      posture,
      budgetMinutes,
      siteGoalMinutes: siteGoalBudgetMinutes,
      protocolBudgetRole,
      protocolActiveTargetMinutes,
      protocolActiveTargetSource,
      referenceTargetMinutes: resolvedReferenceTargetMinutes,
      referenceTargetSource: resolvedReferenceTargetSource,
      presetId: presetSelection?.presetId || null,
      presetSource: presetSelection?.source || 'default',
      presetLabel: selectedPreset?.label || null,
      presetKind: selectedPreset?.kind || null,
      canonicalArtifacts: artifacts,
    },
  };
}

export function createProtectionProfileResolver({
  settingsSnapshot = null,
  settingsCache = null,
  mergeNudgeConfig,
} = {}) {
  const mergeNudgeConfigOwner = requireNudgeConfigMergeOwner(
    mergeNudgeConfig,
    'PROTECTION_PROFILE_RESOLVER_NUDGE_CONFIG_OWNER_REQUIRED',
  );
  const resolvedSettingsSnapshot = settingsSnapshot || settingsCache || {};

  function resolveProfile(options = {}) {
    return resolveProtectionProfile({
      ...options,
      settingsSnapshot: resolvedSettingsSnapshot,
      mergeNudgeConfig: mergeNudgeConfigOwner,
    });
  }

  return {
    resolveProfile,
  };
}
