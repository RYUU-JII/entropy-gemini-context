import {
  hasActiveSocialMetricOptions,
  normalizeFilterSettings,
  normalizeSocialMetricOptions,
} from '../../settings/config/index.js';
import { VISUAL_FRICTION_FEATURE_KEYS } from '../../settings/config/visualFrictionProfiles.js';
import {
  DEFAULT_GATE_CONFIG,
  normalizeGateConfig,
} from '../../settings/config/gateConfig.js';
import {
  DEFAULT_NUDGE_SETTINGS,
  hasEnabledGoalEnd,
  normalizeStoredNudgeConfig,
} from '../../settings/config/nudgeConfig.js';
import {
  PROTECTION_CANONICAL_ARTIFACT_ID_LIST,
} from '../catalog/artifactFamilyCatalog.js';
import {
  DEFAULT_PROTECTION_PRESET_ID,
  normalizeProtectionPresetAssignments,
} from '../catalog/presetContract.js';
import { buildResolvedProtectionPresetCatalog } from '../catalog/presetCatalog.js';

function anyFilterActive(filterSettings, keys) {
  return keys.some((key) => filterSettings[key]?.isActive === true);
}

function selectPresetConfiguredArtifactFamilyMap(settingsSnapshot = {}) {
  const catalog = buildResolvedProtectionPresetCatalog(
    settingsSnapshot.protectionPresetCatalog,
  );
  const assignments = normalizeProtectionPresetAssignments(
    settingsSnapshot.protectionPresetAssignments,
  );
  const assignedPresetIds = new Set([
    assignments.globalPresetId,
    ...Object.values(assignments.sitePresetIds),
  ]);
  assignedPresetIds.delete(DEFAULT_PROTECTION_PRESET_ID);

  return PROTECTION_CANONICAL_ARTIFACT_ID_LIST.reduce((acc, familyId) => {
    acc[familyId] = Array.from(assignedPresetIds).some(
      (presetId) => catalog[presetId]?.artifacts?.[familyId]?.enabled === true,
    );
    return acc;
  }, {});
}

export function selectConfiguredArtifactFamilyMap(settingsSnapshot = {}) {
  const source = settingsSnapshot && typeof settingsSnapshot === 'object'
    ? settingsSnapshot
    : {};
  const filterSettings = normalizeFilterSettings(source.filterSettings || {});
  const gateConfig = normalizeGateConfig(source.gateConfig || DEFAULT_GATE_CONFIG);
  const nudgeConfig = normalizeStoredNudgeConfig(source.nudgeConfig, {
    defaults: DEFAULT_NUDGE_SETTINGS,
  });
  const socialMetrics = filterSettings.socialMetrics;
  const socialMetricOptions = normalizeSocialMetricOptions(socialMetrics?.value);
  const presetConfigured = selectPresetConfiguredArtifactFamilyMap(source);

  const configured = {
    lens: presetConfigured.lens || anyFilterActive(filterSettings, VISUAL_FRICTION_FEATURE_KEYS),
    veil: presetConfigured.veil || (
      (socialMetrics?.isActive === true && hasActiveSocialMetricOptions(socialMetricOptions))
      || filterSettings.shortFormBlock?.isActive === true
    ),
    brake: presetConfigured.brake
      || anyFilterActive(filterSettings, [
        'clickDelay',
        'scrollFriction',
        'navigationButtonLock',
        'inputVisualBrake',
        'videoSkipGuard',
      ]),
    barrier: presetConfigured.barrier
      || anyFilterActive(filterSettings, ['ensoGate', 'textRhythm'])
      || gateConfig.detourSpreadGuard?.enabled === true,
    gate: presetConfigured.gate
      || gateConfig.entryCheckpoint?.enabled === true
      || gateConfig.returnGuard?.enabled === true,
    flare: hasEnabledGoalEnd(nudgeConfig),
    echo: presetConfigured.echo
      || source.historyCleanupForBlocked === true
      || source.concealBlockedBookmarks === true,
  };

  return Object.freeze(PROTECTION_CANONICAL_ARTIFACT_ID_LIST.reduce((acc, familyId) => {
    acc[familyId] = configured[familyId] === true;
    return acc;
  }, {}));
}

export function selectConfiguredArtifactFamilyIds(settingsSnapshot = {}) {
  const configuredMap = selectConfiguredArtifactFamilyMap(settingsSnapshot);
  return Object.freeze(PROTECTION_CANONICAL_ARTIFACT_ID_LIST.filter(
    (familyId) => configuredMap[familyId] === true,
  ));
}
