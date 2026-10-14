import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
  normalizeFilterSettings,
} from '../../../src/domains/settings/config/index.js';
import {
  SUPPORTED_SITE_IDS,
  resolveSiteId,
} from '../../../src/domains/nudge/targeting/siteIdentityCatalog.js';
import {
  CANONICAL_ARTIFACT_RUNTIME_BINDINGS,
} from '../../../src/domains/protection/runtime/canonicalArtifactRuntimeBinding.js';
import {
  resolveProgressionFamilyUnlockDay,
} from '../../../src/domains/progression/policy/progressionJourneyPolicy.js';
import {
  LAYOUT_CYCLE_ORACLE_KIND,
  LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR,
  LAYOUT_CYCLE_OPPORTUNITY_KIND,
  LAYOUT_CYCLE_ORACLE_RELATION,
} from './layoutCycleAnalysis.mjs';

export const SITE_SCENARIO_SUITE_IDS = Object.freeze([
  'release-core',
  'root-visual-continuity',
  'feed-runtime-public',
  'watch-runtime-public',
  'runtime-contention',
  'feed-horizon-login',
  'targeting-core',
  'targeting-login',
  'login-required',
]);

export const SITE_SCENARIO_EXECUTION_MODES = Object.freeze([
  'automated',
  'metadata_only',
]);

export const SITE_SCENARIO_LANES = Object.freeze([
  'both',
  'diagnostic',
  'release',
]);

export const SITE_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KINDS = Object.freeze({
  HTML_VIDEO_ELEMENT: 'html_video_element',
});

export const SITE_SCENARIO_FEED_OPPORTUNITY_GATED_CONDITION_KINDS = Object.freeze([
  'debug_path_equals',
  'debug_number_at_least',
]);

export const SITE_SCENARIO_ACTION_KINDS = Object.freeze([
  'settings_patch',
  'navigate',
  'reload',
  'scroll',
  'prepare_scroll_contention_fixture',
  'trusted_scroll_probe',
  'trusted_content_load_probe',
  'root_visual_continuity_probe',
  'visual_media_membership_probe',
  'trusted_wheel',
  'trusted_key_scroll',
  'trusted_touch_swipe',
  'wait',
  'play',
  'pause',
  'seek',
  'disable',
  'reenable',
  'takeover_checkpoint',
]);

export const SITE_SCENARIO_BLOCKER_CLASSIFICATIONS = Object.freeze([
  'auth_required',
  'blocked',
  'contract_drift',
  'inconclusive',
]);

export const CANONICAL_SCENARIO_FILTER_KEYS = Object.freeze(
  Object.keys(CONFIG_DEFAULT_FILTER_SETTINGS),
);

export const SUPPORTED_SCENARIO_SITE_IDS = SUPPORTED_SITE_IDS;

const SUITE_ID_SET = new Set(SITE_SCENARIO_SUITE_IDS);
const EXECUTION_MODE_SET = new Set(SITE_SCENARIO_EXECUTION_MODES);
const LANE_SET = new Set(SITE_SCENARIO_LANES);
const ACTION_KIND_SET = new Set(SITE_SCENARIO_ACTION_KINDS);
const BLOCKER_CLASSIFICATION_SET = new Set(SITE_SCENARIO_BLOCKER_CLASSIFICATIONS);
const FILTER_KEY_SET = new Set(CANONICAL_SCENARIO_FILTER_KEYS);
const SITE_ID_SET = new Set(SUPPORTED_SCENARIO_SITE_IDS);
const SCENARIO_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FEED_STEP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FEED_SURFACE_MODE_SET = new Set(['continuous', 'paged', 'hybrid']);
const FEED_OPPORTUNITY_GATED_CONDITION_KIND_SET = new Set(
  SITE_SCENARIO_FEED_OPPORTUNITY_GATED_CONDITION_KINDS,
);
const TARGETING_ORACLE_STYLE_PROPERTY_SET = new Set([
  'letterSpacing',
  'filter',
  'opacity',
  'visibility',
  'display',
]);
const TARGETING_SEMANTIC_NEGATIVE_CONTROL_KIND_SET = new Set(
  Object.values(SITE_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KINDS),
);
const PAGE_RUNTIME_ERROR_ADVISORY_SOURCE_SET = new Set(['network']);
const TRUSTED_FEED_ACTION_KINDS = new Set([
  'trusted_wheel',
  'trusted_key_scroll',
  'trusted_touch_swipe',
]);
const TRUSTED_GESTURE_ACTION_KINDS = new Set([
  ...TRUSTED_FEED_ACTION_KINDS,
  'trusted_scroll_probe',
  'trusted_content_load_probe',
  'root_visual_continuity_probe',
  'play',
  'seek',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]),
    );
  }
  return value;
}

export function deepFreezeScenarioValue(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach((entry) => deepFreezeScenarioValue(entry));
  return Object.freeze(value);
}

function fail(code, details = '') {
  throw new Error(details ? `${code}:${details}` : code);
}

function requirePlainObject(value, code) {
  if (!isPlainObject(value)) fail(code);
  return value;
}

function requireNonEmptyString(value, code) {
  if (typeof value !== 'string' || !value.trim()) fail(code);
  return value.trim();
}

function requireUniqueStrings(values, code, { allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) fail(code);
  const normalized = values.map((value) => requireNonEmptyString(value, code));
  if (new Set(normalized).size !== normalized.length) fail(`${code}_DUPLICATE`);
  return normalized;
}

function sameStringSet(actual, expected) {
  if (actual.length !== expected.length) return false;
  const expectedSet = new Set(expected);
  return actual.every((value) => expectedSet.has(value));
}

function requireKnownValues(values, allowedSet, code, options = {}) {
  const normalized = requireUniqueStrings(values, code, options);
  const unknown = normalized.find((value) => !allowedSet.has(value));
  if (unknown) fail(`${code}_UNKNOWN`, unknown);
  return normalized;
}

function requireExactKeys(value, expectedKeys, code) {
  const actualKeys = Reflect.ownKeys(value);
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
  ) {
    fail(code);
  }
}

function requireHttpsUrl(rawUrl, code) {
  let parsed;
  try {
    parsed = new URL(requireNonEmptyString(rawUrl, code));
  } catch (_) {
    fail(code);
  }
  if (parsed.protocol !== 'https:') fail(`${code}_HTTPS_REQUIRED`, parsed.protocol);
  if (parsed.username || parsed.password) fail(`${code}_CREDENTIALS_FORBIDDEN`);
  return parsed;
}

function requireHttpsOrigin(rawOrigin, code) {
  const declaredOrigin = requireNonEmptyString(rawOrigin, code);
  const parsed = requireHttpsUrl(declaredOrigin, code);
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) fail(`${code}_ORIGIN_REQUIRED`);
  if (declaredOrigin !== parsed.origin) fail(`${code}_CANONICAL_REQUIRED`, parsed.origin);
  return parsed.origin;
}

function createInactiveFilterSettings() {
  return Object.fromEntries(
    Object.entries(CONFIG_DEFAULT_FILTER_SETTINGS).map(([key, entry]) => {
      if (!isPlainObject(entry)) fail('SITE_SCENARIO_FILTER_DEFAULT_INVALID', key);
      return [key, { ...cloneValue(entry), isActive: false }];
    }),
  );
}

function resolveEnabledOverride(filterKey, override) {
  const canonicalDefault = CONFIG_DEFAULT_FILTER_SETTINGS[filterKey];
  if (!canonicalDefault) fail('SITE_SCENARIO_FILTER_KEY_UNKNOWN', filterKey);
  if (override === true) {
    return { ...cloneValue(canonicalDefault), isActive: true };
  }
  if (!isPlainObject(override) || override.isActive !== true) {
    fail('SITE_SCENARIO_FILTER_OVERRIDE_INVALID', filterKey);
  }
  return cloneValue(override);
}

export function createIsolatedScenarioSettings(enabledOverrides = {}) {
  requirePlainObject(enabledOverrides, 'SITE_SCENARIO_FILTER_OVERRIDES_INVALID');
  const sourceFilterKeys = Object.keys(enabledOverrides);
  if (sourceFilterKeys.length === 0) fail('SITE_SCENARIO_FILTER_OVERRIDES_EMPTY');
  requireKnownValues(
    sourceFilterKeys,
    FILTER_KEY_SET,
    'SITE_SCENARIO_SOURCE_FILTER_KEYS_INVALID',
  );

  const completeSettings = createInactiveFilterSettings();
  sourceFilterKeys.forEach((filterKey) => {
    completeSettings[filterKey] = resolveEnabledOverride(
      filterKey,
      enabledOverrides[filterKey],
    );
  });

  const normalized = normalizeFilterSettings(completeSettings);
  const activeKeys = Object.entries(normalized)
    .filter(([, entry]) => entry?.isActive === true)
    .map(([key]) => key);
  const inactiveKeys = CANONICAL_SCENARIO_FILTER_KEYS.filter(
    (filterKey) => !activeKeys.includes(filterKey),
  );
  const derivedKeys = activeKeys.filter((filterKey) => !sourceFilterKeys.includes(filterKey));
  const inactiveSourceKey = sourceFilterKeys.find((filterKey) => !activeKeys.includes(filterKey));
  if (inactiveSourceKey) fail('SITE_SCENARIO_SOURCE_FILTER_NOT_ACTIVE', inactiveSourceKey);

  return deepFreezeScenarioValue({
    sourceFilterKeys: [...sourceFilterKeys],
    activeKeys,
    derivedKeys,
    inactiveKeys,
    values: normalized,
  });
}

function validateScenarioSettings(settings, scenarioId) {
  requirePlainObject(settings, 'SITE_SCENARIO_SETTINGS_REQUIRED');
  const sourceFilterKeys = requireKnownValues(
    settings.sourceFilterKeys,
    FILTER_KEY_SET,
    'SITE_SCENARIO_SOURCE_FILTER_KEYS_INVALID',
  );
  const activeKeys = requireKnownValues(
    settings.activeKeys,
    FILTER_KEY_SET,
    'SITE_SCENARIO_ACTIVE_SETTING_KEYS_INVALID',
  );
  const derivedKeys = requireKnownValues(
    settings.derivedKeys,
    FILTER_KEY_SET,
    'SITE_SCENARIO_DERIVED_SETTING_KEYS_INVALID',
    { allowEmpty: true },
  );
  const inactiveKeys = requireKnownValues(
    settings.inactiveKeys,
    FILTER_KEY_SET,
    'SITE_SCENARIO_INACTIVE_SETTING_KEYS_INVALID',
    { allowEmpty: true },
  );
  requirePlainObject(settings.values, 'SITE_SCENARIO_FILTER_VALUES_REQUIRED');

  const valueKeys = Object.keys(settings.values);
  if (!sameStringSet(valueKeys, CANONICAL_SCENARIO_FILTER_KEYS)) {
    fail('SITE_SCENARIO_FILTER_VALUES_INCOMPLETE', scenarioId);
  }
  const actualActiveKeys = valueKeys.filter(
    (filterKey) => settings.values[filterKey]?.isActive === true,
  );
  const actualInactiveKeys = valueKeys.filter(
    (filterKey) => settings.values[filterKey]?.isActive === false,
  );
  const malformedEntry = valueKeys.find(
    (filterKey) => typeof settings.values[filterKey]?.isActive !== 'boolean',
  );
  if (malformedEntry) fail('SITE_SCENARIO_FILTER_ACTIVE_FLAG_REQUIRED', malformedEntry);
  if (!sameStringSet(actualActiveKeys, activeKeys)) {
    fail('SITE_SCENARIO_ACTIVE_SETTING_KEYS_MISMATCH', scenarioId);
  }
  if (!sameStringSet(actualInactiveKeys, inactiveKeys)) {
    fail('SITE_SCENARIO_INACTIVE_SETTING_KEYS_MISMATCH', scenarioId);
  }
  const expectedDerivedKeys = activeKeys.filter(
    (filterKey) => !sourceFilterKeys.includes(filterKey),
  );
  if (!sameStringSet(derivedKeys, expectedDerivedKeys)) {
    fail('SITE_SCENARIO_DERIVED_SETTING_KEYS_MISMATCH', scenarioId);
  }
  const unexpectedSourceKey = sourceFilterKeys.find(
    (filterKey) => !activeKeys.includes(filterKey),
  );
  if (unexpectedSourceKey) fail('SITE_SCENARIO_SOURCE_FILTER_NOT_ACTIVE', unexpectedSourceKey);
}

function validateScenarioUrls(scenario) {
  const urls = requirePlainObject(scenario.urls, 'SITE_SCENARIO_URLS_REQUIRED');
  const primary = requireHttpsUrl(urls.primary, 'SITE_SCENARIO_PRIMARY_URL_INVALID');
  const additional = Array.isArray(urls.additional) ? urls.additional : [];
  const parsedUrls = [primary, ...additional.map((url) => (
    requireHttpsUrl(url, 'SITE_SCENARIO_ADDITIONAL_URL_INVALID')
  ))];
  const allowlistedOrigins = requireUniqueStrings(
    scenario.allowlistedOrigins,
    'SITE_SCENARIO_ALLOWLIST_REQUIRED',
  ).map((origin) => requireHttpsOrigin(origin, 'SITE_SCENARIO_ALLOWLIST_ORIGIN_INVALID'));
  const redirectOrigins = requireUniqueStrings(
    scenario.redirectOrigins,
    'SITE_SCENARIO_REDIRECT_ORIGINS_REQUIRED',
    { allowEmpty: true },
  ).map((origin) => requireHttpsOrigin(origin, 'SITE_SCENARIO_REDIRECT_ORIGIN_INVALID'));
  if (Object.hasOwn(scenario, 'hostPermissions')) {
    fail('SITE_SCENARIO_HOST_PERMISSIONS_DERIVED', scenario.id);
  }

  parsedUrls.forEach((url) => {
    if (!allowlistedOrigins.includes(url.origin)) {
      fail('SITE_SCENARIO_URL_NOT_ALLOWLISTED', `${scenario.id}:${url.origin}`);
    }
    const resolvedSiteId = resolveSiteId(url.hostname);
    if (resolvedSiteId !== scenario.siteId) {
      fail(
        'SITE_SCENARIO_SITE_OWNER_MISMATCH',
        `${scenario.id}:${resolvedSiteId}:${scenario.siteId}`,
      );
    }
  });
  const duplicatedRedirectOrigin = redirectOrigins.find((origin) => (
    allowlistedOrigins.includes(origin)
  ));
  if (duplicatedRedirectOrigin) {
    fail(
      'SITE_SCENARIO_REDIRECT_ORIGIN_DUPLICATES_ALLOWLIST',
      `${scenario.id}:${duplicatedRedirectOrigin}`,
    );
  }
  redirectOrigins.forEach((origin) => {
    const resolvedSiteId = resolveSiteId(new URL(origin).hostname);
    if (resolvedSiteId !== scenario.siteId) {
      fail(
        'SITE_SCENARIO_REDIRECT_OWNER_MISMATCH',
        `${scenario.id}:${resolvedSiteId}:${scenario.siteId}`,
      );
    }
  });
}

function validateExpectedActivation(scenario) {
  const expected = requirePlainObject(
    scenario.expectedActivation,
    'SITE_SCENARIO_EXPECTED_ACTIVATION_REQUIRED',
  );
  const activeFilterKeys = requireKnownValues(
    expected.activeFilterKeys,
    FILTER_KEY_SET,
    'SITE_SCENARIO_EXPECTED_ACTIVE_FILTER_KEYS_INVALID',
  );
  const runtimeDerivedKeys = requireKnownValues(
    expected.runtimeDerivedKeys,
    FILTER_KEY_SET,
    'SITE_SCENARIO_RUNTIME_DERIVED_KEYS_INVALID',
    { allowEmpty: true },
  );
  const expectedRuntimeDerivedKeys = activeFilterKeys.filter(
    (filterKey) => !scenario.settings.activeKeys.includes(filterKey),
  );
  if (!sameStringSet(runtimeDerivedKeys, expectedRuntimeDerivedKeys)) {
    fail('SITE_SCENARIO_RUNTIME_DERIVED_KEYS_MISMATCH', scenario.id);
  }
  const missingSettingKey = scenario.settings.activeKeys.find(
    (filterKey) => !activeFilterKeys.includes(filterKey),
  );
  if (missingSettingKey) {
    fail('SITE_SCENARIO_ACTIVE_SETTING_MISSING_FROM_RUNTIME', `${scenario.id}:${missingSettingKey}`);
  }
  if (expected.socialMetrics !== null && expected.socialMetrics !== undefined) {
    const socialMetrics = requirePlainObject(
      expected.socialMetrics,
      'SITE_SCENARIO_SOCIAL_EXPECTATION_INVALID',
    );
    requireUniqueStrings(
      socialMetrics.activeMetricKeys,
      'SITE_SCENARIO_SOCIAL_METRIC_KEYS_INVALID',
    );
    if (!Number.isInteger(socialMetrics.compiledPlanCount) || socialMetrics.compiledPlanCount <= 0) {
      fail('SITE_SCENARIO_SOCIAL_PLAN_COUNT_INVALID', scenario.id);
    }
    if (socialMetrics.observerAttached !== true) {
      fail('SITE_SCENARIO_SOCIAL_OBSERVER_EXPECTATION_INVALID', scenario.id);
    }
  }
}

function validateArtifactDisclosureRequirements(scenario) {
  const disclosure = requirePlainObject(
    scenario.artifactDisclosureRequirements,
    'SITE_SCENARIO_ARTIFACT_DISCLOSURE_REQUIRED',
  );
  const byFeature = requirePlainObject(
    disclosure.byFeature,
    'SITE_SCENARIO_ARTIFACT_DISCLOSURE_FEATURES_REQUIRED',
  );
  const featureIds = Object.keys(byFeature);
  if (!sameStringSet(featureIds, scenario.settings.sourceFilterKeys)) {
    fail('SITE_SCENARIO_ARTIFACT_DISCLOSURE_FEATURES_MISMATCH', scenario.id);
  }

  const requiredDays = featureIds.map((featureId) => {
    const requirement = requirePlainObject(
      byFeature[featureId],
      'SITE_SCENARIO_ARTIFACT_DISCLOSURE_FEATURE_INVALID',
    );
    if (requireNonEmptyString(
      requirement.featureId,
      'SITE_SCENARIO_ARTIFACT_DISCLOSURE_FEATURE_ID_REQUIRED',
    ) !== featureId) {
      fail('SITE_SCENARIO_ARTIFACT_DISCLOSURE_FEATURE_ID_MISMATCH', featureId);
    }
    const familyId = requireNonEmptyString(
      requirement.familyId,
      'SITE_SCENARIO_ARTIFACT_DISCLOSURE_FAMILY_REQUIRED',
    );
    const childId = requireNonEmptyString(
      requirement.childId,
      'SITE_SCENARIO_ARTIFACT_DISCLOSURE_CHILD_REQUIRED',
    );
    const binding = CANONICAL_ARTIFACT_RUNTIME_BINDINGS[familyId];
    if (!binding) {
      fail('SITE_SCENARIO_ARTIFACT_DISCLOSURE_FAMILY_UNKNOWN', familyId);
    }
    if (!binding.executionKeys.includes(featureId)) {
      fail(
        'SITE_SCENARIO_ARTIFACT_DISCLOSURE_FAMILY_OWNER_MISMATCH',
        `${featureId}:${familyId}`,
      );
    }
    const childBinding = binding.children?.[childId];
    if (!childBinding) {
      fail(
        'SITE_SCENARIO_ARTIFACT_DISCLOSURE_CHILD_UNKNOWN',
        `${familyId}:${childId}`,
      );
    }
    if (!childBinding.stateFilterKeys?.includes(featureId)) {
      fail(
        'SITE_SCENARIO_ARTIFACT_DISCLOSURE_CHILD_OWNER_MISMATCH',
        `${featureId}:${familyId}:${childId}`,
      );
    }
    const expectedDay = resolveProgressionFamilyUnlockDay(familyId);
    if (requirement.disclosureDay !== expectedDay) {
      fail(
        'SITE_SCENARIO_ARTIFACT_DISCLOSURE_DAY_MISMATCH',
        `${featureId}:${requirement.disclosureDay}:${expectedDay}`,
      );
    }
    return expectedDay;
  });

  const scenarioMaxDay = Math.max(...requiredDays);
  if (disclosure.scenarioMaxDay !== scenarioMaxDay) {
    fail(
      'SITE_SCENARIO_ARTIFACT_DISCLOSURE_MAX_DAY_MISMATCH',
      `${scenario.id}:${disclosure.scenarioMaxDay}:${scenarioMaxDay}`,
    );
  }
}

function validateLaneBoundEntries(entries, code, { allowEmpty = false } = {}) {
  if (!Array.isArray(entries) || (!allowEmpty && entries.length === 0)) fail(code);
  entries.forEach((entry, index) => {
    requirePlainObject(entry, code);
    requireNonEmptyString(entry.id, `${code}_ID_REQUIRED`);
    requireNonEmptyString(entry.kind, `${code}_KIND_REQUIRED`);
    if (!LANE_SET.has(entry.lane)) fail(`${code}_LANE_INVALID`, `${index}:${entry.lane}`);
  });
}

function validateActions(scenario) {
  if (!Array.isArray(scenario.actions)) fail('SITE_SCENARIO_ACTIONS_REQUIRED');
  const feedStepIds = [];
  scenario.actions.forEach((action, index) => {
    requirePlainObject(action, 'SITE_SCENARIO_ACTION_INVALID');
    if (!ACTION_KIND_SET.has(action.kind)) {
      fail('SITE_SCENARIO_ACTION_KIND_INVALID', `${scenario.id}:${index}:${action.kind}`);
    }
    if (!LANE_SET.has(action.lane)) {
      fail('SITE_SCENARIO_ACTION_LANE_INVALID', `${scenario.id}:${index}:${action.lane}`);
    }
    if (
      action.requiresTrustedGesture !== undefined
      && action.requiresTrustedGesture !== true
    ) {
      fail(
        'SITE_SCENARIO_TRUSTED_GESTURE_FLAG_INVALID',
        `${scenario.id}:${index}:${action.kind}`,
      );
    }
    if (
      action.requiresTrustedGesture === true
      && !TRUSTED_GESTURE_ACTION_KINDS.has(action.kind)
    ) {
      fail(
        'SITE_SCENARIO_TRUSTED_GESTURE_ACTION_INVALID',
        `${scenario.id}:${index}:${action.kind}`,
      );
    }
    if (
      action.requiresTrustedGesture === true
      && (action.kind === 'play' || action.kind === 'seek')
    ) {
      requireNonEmptyString(
        action.targetSelector,
        'SITE_SCENARIO_TRUSTED_GESTURE_TARGET_REQUIRED',
      );
    }
    if (action.kind === 'prepare_scroll_contention_fixture') {
      requireExactKeys(
        action,
        ['kind', 'lane', 'initialRowCount', 'initialSettleMs', 'requiredForEvaluation'],
        'SITE_SCENARIO_SCROLL_FIXTURE_ACTION_SHAPE_INVALID',
      );
      if (
        !Number.isInteger(action.initialRowCount)
        || action.initialRowCount < 8
        || action.initialRowCount > 200
      ) {
        fail('SITE_SCENARIO_SCROLL_FIXTURE_ROW_COUNT_INVALID', `${scenario.id}:${index}`);
      }
      if (
        !Number.isInteger(action.initialSettleMs)
        || action.initialSettleMs < 0
        || action.initialSettleMs > 5_000
      ) {
        fail('SITE_SCENARIO_SCROLL_FIXTURE_SETTLE_INVALID', `${scenario.id}:${index}`);
      }
    }
    if (action.kind === 'trusted_scroll_probe') {
      const expectedKeys = [
        'kind',
        'lane',
        'probeId',
        'targetSelector',
        'deltas',
        'cadenceMs',
        'settleMs',
        ...(action.contentBurst === undefined ? [] : ['contentBurst']),
        'requiresTrustedGesture',
        'requiredForEvaluation',
      ];
      requireExactKeys(
        action,
        expectedKeys,
        'SITE_SCENARIO_SCROLL_PROBE_ACTION_SHAPE_INVALID',
      );
      if (action.requiresTrustedGesture !== true) {
        fail('SITE_SCENARIO_SCROLL_PROBE_TRUSTED_GESTURE_REQUIRED', `${scenario.id}:${index}`);
      }
      const probeId = requireNonEmptyString(
        action.probeId,
        'SITE_SCENARIO_SCROLL_PROBE_ID_REQUIRED',
      );
      if (!FEED_STEP_ID_PATTERN.test(probeId)) {
        fail('SITE_SCENARIO_SCROLL_PROBE_ID_INVALID', `${scenario.id}:${probeId}`);
      }
      requireNonEmptyString(
        action.targetSelector,
        'SITE_SCENARIO_SCROLL_PROBE_TARGET_REQUIRED',
      );
      if (
        !Array.isArray(action.deltas)
        || action.deltas.length < 1
        || action.deltas.length > 12
        || action.deltas.some((value) => (
          typeof value !== 'number'
          || !Number.isFinite(value)
          || value === 0
          || Math.abs(value) > 1_800
        ))
      ) {
        fail('SITE_SCENARIO_SCROLL_PROBE_DELTAS_INVALID', `${scenario.id}:${probeId}`);
      }
      if (
        !Number.isInteger(action.cadenceMs)
        || action.cadenceMs < 0
        || action.cadenceMs > 1_000
      ) {
        fail('SITE_SCENARIO_SCROLL_PROBE_CADENCE_INVALID', `${scenario.id}:${probeId}`);
      }
      if (
        !Number.isInteger(action.settleMs)
        || action.settleMs < 50
        || action.settleMs > 5_000
      ) {
        fail('SITE_SCENARIO_SCROLL_PROBE_SETTLE_INVALID', `${scenario.id}:${probeId}`);
      }
      if (action.contentBurst !== undefined) {
        requirePlainObject(
          action.contentBurst,
          'SITE_SCENARIO_SCROLL_PROBE_CONTENT_BURST_INVALID',
        );
        requireExactKeys(
          action.contentBurst,
          ['afterInputIndex', 'rowCount', 'delayMs'],
          'SITE_SCENARIO_SCROLL_PROBE_CONTENT_BURST_SHAPE_INVALID',
        );
        if (
          !Number.isInteger(action.contentBurst.afterInputIndex)
          || action.contentBurst.afterInputIndex < 0
          || action.contentBurst.afterInputIndex >= action.deltas.length
        ) {
          fail(
            'SITE_SCENARIO_SCROLL_PROBE_CONTENT_BURST_INPUT_INDEX_INVALID',
            `${scenario.id}:${probeId}`,
          );
        }
        if (
          !Number.isInteger(action.contentBurst.rowCount)
          || action.contentBurst.rowCount < 1
          || action.contentBurst.rowCount > 200
        ) {
          fail(
            'SITE_SCENARIO_SCROLL_PROBE_CONTENT_BURST_ROW_COUNT_INVALID',
            `${scenario.id}:${probeId}`,
          );
        }
        if (
          !Number.isInteger(action.contentBurst.delayMs)
          || action.contentBurst.delayMs < 0
          || action.contentBurst.delayMs >= action.settleMs
        ) {
          fail(
            'SITE_SCENARIO_SCROLL_PROBE_CONTENT_BURST_DELAY_INVALID',
            `${scenario.id}:${probeId}`,
          );
        }
      }
    }
    if (action.kind === 'trusted_content_load_probe') {
      requireExactKeys(
        action,
        [
          'kind',
          'lane',
          'probeId',
          'opportunitySelectors',
          'minimumOpportunityCount',
          'maximumSteps',
          'deltaY',
          'cadenceMs',
          'settleMs',
          'requiresTrustedGesture',
          'requiredForEvaluation',
        ],
        'SITE_SCENARIO_CONTENT_LOAD_PROBE_ACTION_SHAPE_INVALID',
      );
      if (action.requiresTrustedGesture !== true) {
        fail(
          'SITE_SCENARIO_CONTENT_LOAD_PROBE_TRUSTED_GESTURE_REQUIRED',
          `${scenario.id}:${index}`,
        );
      }
      const probeId = requireNonEmptyString(
        action.probeId,
        'SITE_SCENARIO_CONTENT_LOAD_PROBE_ID_REQUIRED',
      );
      if (!FEED_STEP_ID_PATTERN.test(probeId)) {
        fail('SITE_SCENARIO_CONTENT_LOAD_PROBE_ID_INVALID', `${scenario.id}:${probeId}`);
      }
      requireUniqueStrings(
        action.opportunitySelectors,
        'SITE_SCENARIO_CONTENT_LOAD_PROBE_SELECTORS_REQUIRED',
      );
      if (
        !Number.isInteger(action.minimumOpportunityCount)
        || action.minimumOpportunityCount < 1
        || action.minimumOpportunityCount > 100
      ) {
        fail(
          'SITE_SCENARIO_CONTENT_LOAD_PROBE_MINIMUM_INVALID',
          `${scenario.id}:${probeId}`,
        );
      }
      if (
        !Number.isInteger(action.maximumSteps)
        || action.maximumSteps < 1
        || action.maximumSteps > 12
      ) {
        fail(
          'SITE_SCENARIO_CONTENT_LOAD_PROBE_STEPS_INVALID',
          `${scenario.id}:${probeId}`,
        );
      }
      if (
        typeof action.deltaY !== 'number'
        || !Number.isFinite(action.deltaY)
        || action.deltaY <= 0
        || action.deltaY > 1_800
      ) {
        fail(
          'SITE_SCENARIO_CONTENT_LOAD_PROBE_DELTA_INVALID',
          `${scenario.id}:${probeId}`,
        );
      }
      if (
        !Number.isInteger(action.cadenceMs)
        || action.cadenceMs < 0
        || action.cadenceMs > 1_000
      ) {
        fail(
          'SITE_SCENARIO_CONTENT_LOAD_PROBE_CADENCE_INVALID',
          `${scenario.id}:${probeId}`,
        );
      }
      if (
        !Number.isInteger(action.settleMs)
        || action.settleMs < 100
        || action.settleMs > 5_000
      ) {
        fail(
          'SITE_SCENARIO_CONTENT_LOAD_PROBE_SETTLE_INVALID',
          `${scenario.id}:${probeId}`,
        );
      }
    }
    if (action.kind === 'visual_media_membership_probe') {
      requireExactKeys(action, ['kind', 'lane', 'requiredForEvaluation'],
        'SITE_SCENARIO_MEDIA_MEMBERSHIP_ACTION_SHAPE_INVALID');
      if (scenario.siteId !== 'youtube' || action.requiredForEvaluation !== true) {
        fail('SITE_SCENARIO_MEDIA_MEMBERSHIP_OWNER_INVALID', scenario.id);
      }
    }
    if (action.kind === 'root_visual_continuity_probe') {
      requireExactKeys(
        action,
        [
          'kind',
          'lane',
          'probeId',
          'targetSelector',
          'expectedSourcePath',
          'expectedPathPrefix',
          'expectedGrayscaleStrength',
          'maximumCompositorChromaRatio',
          'routeTimeoutMs',
          'settleMs',
          'minimumAnimationFrameCount',
          'minimumCompositorFrameCount',
          'requiresTrustedGesture',
          'requiredForEvaluation',
        ],
        'SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_ACTION_SHAPE_INVALID',
      );
      if (action.requiresTrustedGesture !== true) {
        fail(
          'SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_TRUSTED_GESTURE_REQUIRED',
          `${scenario.id}:${index}`,
        );
      }
      const probeId = requireNonEmptyString(
        action.probeId,
        'SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_PROBE_ID_REQUIRED',
      );
      if (!FEED_STEP_ID_PATTERN.test(probeId)) {
        fail('SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_PROBE_ID_INVALID', `${scenario.id}:${probeId}`);
      }
      requireNonEmptyString(
        action.targetSelector,
        'SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_TARGET_REQUIRED',
      );
      const expectedSourcePath = requireNonEmptyString(
        action.expectedSourcePath,
        'SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_SOURCE_PATH_REQUIRED',
      );
      if (!expectedSourcePath.startsWith('/')) {
        fail('SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_SOURCE_PATH_INVALID', expectedSourcePath);
      }
      const expectedPathPrefix = requireNonEmptyString(
        action.expectedPathPrefix,
        'SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_PATH_REQUIRED',
      );
      if (!expectedPathPrefix.startsWith('/')) {
        fail('SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_PATH_INVALID', expectedPathPrefix);
      }
      if (
        typeof action.expectedGrayscaleStrength !== 'number'
        || !Number.isFinite(action.expectedGrayscaleStrength)
        || action.expectedGrayscaleStrength <= 0
        || action.expectedGrayscaleStrength > 1
      ) {
        fail(
          'SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_STRENGTH_INVALID',
          `${scenario.id}:${probeId}`,
        );
      }
      if (
        typeof action.maximumCompositorChromaRatio !== 'number'
        || !Number.isFinite(action.maximumCompositorChromaRatio)
        || action.maximumCompositorChromaRatio <= 0
        || action.maximumCompositorChromaRatio >= 1
      ) {
        fail(
          'SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_CHROMA_RATIO_INVALID',
          `${scenario.id}:${probeId}`,
        );
      }
      for (const [field, minimum, maximum] of [
        ['routeTimeoutMs', 1_000, 30_000],
        ['settleMs', 250, 5_000],
        ['minimumAnimationFrameCount', 2, 600],
        ['minimumCompositorFrameCount', 2, 240],
      ]) {
        if (
          !Number.isInteger(action[field])
          || action[field] < minimum
          || action[field] > maximum
        ) {
          fail(
            `SITE_SCENARIO_ROOT_VISUAL_CONTINUITY_${field.toUpperCase()}_INVALID`,
            `${scenario.id}:${probeId}`,
          );
        }
      }
    }
    if (action.kind === 'play' && action.requiresTrustedGesture !== true) {
      fail('SITE_SCENARIO_PLAY_TRUSTED_GESTURE_REQUIRED', `${scenario.id}:${index}`);
    }
    if (
      TRUSTED_FEED_ACTION_KINDS.has(action.kind)
      && action.requiresTrustedGesture !== true
    ) {
      fail('SITE_SCENARIO_FEED_ACTION_TRUSTED_GESTURE_REQUIRED', `${scenario.id}:${index}`);
    }
    if (TRUSTED_FEED_ACTION_KINDS.has(action.kind)) {
      const feedStepId = requireNonEmptyString(
        action.feedStepId,
        'SITE_SCENARIO_FEED_STEP_ID_REQUIRED',
      );
      if (!FEED_STEP_ID_PATTERN.test(feedStepId)) {
        fail('SITE_SCENARIO_FEED_STEP_ID_INVALID', `${scenario.id}:${feedStepId}`);
      }
      feedStepIds.push(feedStepId);
    } else if (Object.hasOwn(action, 'feedStepId')) {
      fail('SITE_SCENARIO_FEED_STEP_ID_ACTION_INVALID', `${scenario.id}:${index}`);
    }
    if (
      action.requiredForEvaluation !== undefined
      && action.requiredForEvaluation !== true
    ) {
      fail(
        'SITE_SCENARIO_REQUIRED_EVALUATION_FLAG_INVALID',
        `${scenario.id}:${index}:${action.kind}`,
      );
    }
  });
  if (new Set(feedStepIds).size !== feedStepIds.length) {
    fail('SITE_SCENARIO_FEED_STEP_ID_DUPLICATE', scenario.id);
  }
  return feedStepIds;
}

function validateFeedConsumption(scenario, feedStepIds) {
  const conditions = [
    ...(scenario.readiness?.conditions || []),
    ...(scenario.observableEffects?.conditions || []),
    ...(scenario.settle?.conditions || []),
  ];
  const workloadGatedConditions = conditions.filter((condition) => (
    isPlainObject(condition)
    && Object.hasOwn(condition, 'minimumFeedOpportunityCount')
  ));
  if (feedStepIds.length === 0) {
    if (Object.hasOwn(scenario, 'feedConsumption')) {
      fail('SITE_SCENARIO_FEED_CONSUMPTION_ACTION_REQUIRED', scenario.id);
    }
    if (workloadGatedConditions.length > 0) {
      fail(
        'SITE_SCENARIO_FEED_OPPORTUNITY_GATE_ACTION_REQUIRED',
        `${scenario.id}:${workloadGatedConditions[0].id}`,
      );
    }
    return;
  }
  const feedConsumption = requirePlainObject(
    scenario.feedConsumption,
    'SITE_SCENARIO_FEED_CONSUMPTION_REQUIRED',
  );
  if (!FEED_SURFACE_MODE_SET.has(feedConsumption.surfaceMode)) {
    fail(
      'SITE_SCENARIO_FEED_SURFACE_MODE_INVALID',
      `${scenario.id}:${feedConsumption.surfaceMode}`,
    );
  }
  const oracle = requirePlainObject(
    feedConsumption.oracle,
    'SITE_SCENARIO_FEED_ORACLE_REQUIRED',
  );
  if (oracle.kind !== 'dominant_item') {
    fail('SITE_SCENARIO_FEED_ORACLE_KIND_INVALID', `${scenario.id}:${oracle.kind}`);
  }
  requireUniqueStrings(
    oracle.selectors,
    'SITE_SCENARIO_FEED_ORACLE_SELECTORS_REQUIRED',
  );
  if (
    !Number.isInteger(oracle.maximumCandidates)
    || oracle.maximumCandidates < 1
    || oracle.maximumCandidates > 64
  ) {
    fail('SITE_SCENARIO_FEED_ORACLE_CANDIDATE_LIMIT_INVALID', scenario.id);
  }
  if (
    typeof oracle.minimumProgressRatio !== 'number'
    || !Number.isFinite(oracle.minimumProgressRatio)
    || oracle.minimumProgressRatio <= 0
    || oracle.minimumProgressRatio > 1
  ) {
    fail('SITE_SCENARIO_FEED_ORACLE_PROGRESS_RATIO_INVALID', scenario.id);
  }
  if (
    !Number.isInteger(oracle.readinessTimeoutMs)
    || oracle.readinessTimeoutMs < 1_000
    || oracle.readinessTimeoutMs > 30_000
  ) {
    fail('SITE_SCENARIO_FEED_ORACLE_READINESS_TIMEOUT_INVALID', scenario.id);
  }
  if (
    !Number.isInteger(oracle.minimumStableSamples)
    || oracle.minimumStableSamples < 1
    || oracle.minimumStableSamples > 4
  ) {
    fail('SITE_SCENARIO_FEED_ORACLE_STABILITY_SAMPLE_COUNT_INVALID', scenario.id);
  }
  workloadGatedConditions.forEach((condition) => {
    if (!FEED_OPPORTUNITY_GATED_CONDITION_KIND_SET.has(condition.kind)) {
      fail(
        'SITE_SCENARIO_FEED_OPPORTUNITY_GATE_KIND_INVALID',
        `${scenario.id}:${condition.id}:${condition.kind}`,
      );
    }
    if (
      !Number.isInteger(condition.minimumFeedOpportunityCount)
      || condition.minimumFeedOpportunityCount < 1
      || condition.minimumFeedOpportunityCount > feedStepIds.length
    ) {
      fail(
        'SITE_SCENARIO_FEED_OPPORTUNITY_GATE_INVALID',
        `${scenario.id}:${condition.id}`,
      );
    }
  });
}

function validateReadiness(readiness) {
  requirePlainObject(readiness, 'SITE_SCENARIO_READINESS_REQUIRED');
  requireUniqueStrings(
    readiness.selectors,
    'SITE_SCENARIO_READINESS_SELECTORS_REQUIRED',
  );
  if (readiness.selectorMatch !== 'any') {
    fail('SITE_SCENARIO_READINESS_SELECTOR_MATCH_INVALID', readiness.selectorMatch);
  }
  validateLaneBoundEntries(
    readiness.conditions,
    'SITE_SCENARIO_READINESS_CONDITIONS_REQUIRED',
  );
}

function validatePageRuntimeErrorPolicy(policy) {
  if (policy === undefined) return;
  requirePlainObject(policy, 'SITE_SCENARIO_PAGE_RUNTIME_ERROR_POLICY_INVALID');
  requireExactKeys(
    policy,
    ['advisorySources'],
    'SITE_SCENARIO_PAGE_RUNTIME_ERROR_POLICY_SHAPE_INVALID',
  );
  requireKnownValues(
    policy.advisorySources,
    PAGE_RUNTIME_ERROR_ADVISORY_SOURCE_SET,
    'SITE_SCENARIO_PAGE_RUNTIME_ERROR_ADVISORY_SOURCES_INVALID',
  );
}

function validateObservableEffects(observableEffects) {
  requirePlainObject(observableEffects, 'SITE_SCENARIO_OBSERVABLE_EFFECTS_REQUIRED');
  requireUniqueStrings(
    observableEffects.candidateSelectors,
    'SITE_SCENARIO_EFFECT_CANDIDATE_SELECTORS_REQUIRED',
  );
  const appliedSelectors = requireUniqueStrings(
    observableEffects.appliedSelectors,
    'SITE_SCENARIO_EFFECT_APPLIED_SELECTORS_REQUIRED',
  );
  const rootAttributes = requireUniqueStrings(
    observableEffects.rootAttributes,
    'SITE_SCENARIO_EFFECT_ROOT_ATTRIBUTES_REQUIRED',
  );
  if (Object.hasOwn(observableEffects, 'rootAttributeActiveValues')) {
    const rootAttributeActiveValues = requirePlainObject(
      observableEffects.rootAttributeActiveValues,
      'SITE_SCENARIO_EFFECT_ROOT_ATTRIBUTE_ACTIVE_VALUES_INVALID',
    );
    Object.entries(rootAttributeActiveValues).forEach(([attribute, activeValue]) => {
      if (!rootAttributes.includes(attribute)) {
        fail('SITE_SCENARIO_EFFECT_ROOT_ATTRIBUTE_ACTIVE_VALUE_UNOWNED', attribute);
      }
      requireNonEmptyString(
        activeValue,
        'SITE_SCENARIO_EFFECT_ROOT_ATTRIBUTE_ACTIVE_VALUE_INVALID',
      );
    });
  }
  const disableCleanup = requirePlainObject(
    observableEffects.disableCleanup,
    'SITE_SCENARIO_DISABLE_CLEANUP_REQUIRED',
  );
  if (disableCleanup.scope !== 'user_settings') {
    fail('SITE_SCENARIO_DISABLE_CLEANUP_SCOPE_INVALID', disableCleanup.scope);
  }
  const cleanupSelectors = requireUniqueStrings(
    disableCleanup.selectors,
    'SITE_SCENARIO_DISABLE_CLEANUP_SELECTORS_REQUIRED',
    { allowEmpty: true },
  );
  const cleanupRootAttributes = requireUniqueStrings(
    disableCleanup.rootAttributes,
    'SITE_SCENARIO_DISABLE_CLEANUP_ROOT_ATTRIBUTES_REQUIRED',
    { allowEmpty: true },
  );
  const unknownCleanupSelector = cleanupSelectors.find(
    (selector) => !appliedSelectors.includes(selector),
  );
  if (unknownCleanupSelector) {
    fail('SITE_SCENARIO_DISABLE_CLEANUP_SELECTOR_UNOWNED', unknownCleanupSelector);
  }
  const unknownCleanupRootAttribute = cleanupRootAttributes.find(
    (attribute) => !rootAttributes.includes(attribute),
  );
  if (unknownCleanupRootAttribute) {
    fail('SITE_SCENARIO_DISABLE_CLEANUP_ROOT_ATTRIBUTE_UNOWNED', unknownCleanupRootAttribute);
  }
  validateLaneBoundEntries(
    observableEffects.conditions,
    'SITE_SCENARIO_OBSERVABLE_EFFECT_CONDITIONS_REQUIRED',
  );
  if (Object.hasOwn(observableEffects, 'targetingOracle')) {
    const oracle = requirePlainObject(
      observableEffects.targetingOracle,
      'SITE_SCENARIO_TARGETING_ORACLE_INVALID',
    );
    requireExactKeys(
      oracle,
      [
        'kind',
        'positiveSelectors',
        'negativeSelectors',
        'semanticNegativeControls',
        'styleProperties',
        'maximumSamplesPerSelector',
        'positiveGeometry',
      ],
      'SITE_SCENARIO_TARGETING_ORACLE_SHAPE_INVALID',
    );
    if (oracle.kind !== 'computed_style_delta') {
      fail('SITE_SCENARIO_TARGETING_ORACLE_KIND_INVALID', oracle.kind);
    }
    const positiveSelectors = requireUniqueStrings(
      oracle.positiveSelectors,
      'SITE_SCENARIO_TARGETING_ORACLE_POSITIVE_SELECTORS_REQUIRED',
    );
    requireUniqueStrings(
      oracle.negativeSelectors,
      'SITE_SCENARIO_TARGETING_ORACLE_NEGATIVE_SELECTORS_REQUIRED',
      { allowEmpty: true },
    );
    if (!Array.isArray(oracle.semanticNegativeControls)) {
      fail('SITE_SCENARIO_TARGETING_SEMANTIC_NEGATIVE_CONTROLS_REQUIRED');
    }
    const semanticNegativeControlKinds = oracle.semanticNegativeControls.map(
      (rawControl) => {
        const control = requirePlainObject(
          rawControl,
          'SITE_SCENARIO_TARGETING_SEMANTIC_NEGATIVE_CONTROL_INVALID',
        );
        requireExactKeys(
          control,
          ['kind', 'minimum'],
          'SITE_SCENARIO_TARGETING_SEMANTIC_NEGATIVE_CONTROL_SHAPE_INVALID',
        );
        const kind = requireNonEmptyString(
          control.kind,
          'SITE_SCENARIO_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KIND_REQUIRED',
        );
        if (!TARGETING_SEMANTIC_NEGATIVE_CONTROL_KIND_SET.has(kind)) {
          fail('SITE_SCENARIO_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KIND_INVALID', kind);
        }
        if (control.minimum !== 1) {
          fail('SITE_SCENARIO_TARGETING_SEMANTIC_NEGATIVE_CONTROL_MINIMUM_INVALID', kind);
        }
        return kind;
      },
    );
    if (new Set(semanticNegativeControlKinds).size !== semanticNegativeControlKinds.length) {
      fail('SITE_SCENARIO_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KIND_DUPLICATE');
    }
    const unknownPositiveSelector = positiveSelectors.find(
      (selector) => !observableEffects.candidateSelectors.includes(selector),
    );
    if (unknownPositiveSelector) {
      fail(
        'SITE_SCENARIO_TARGETING_ORACLE_POSITIVE_SELECTOR_UNOWNED',
        unknownPositiveSelector,
      );
    }
    requireKnownValues(
      oracle.styleProperties,
      TARGETING_ORACLE_STYLE_PROPERTY_SET,
      'SITE_SCENARIO_TARGETING_ORACLE_STYLE_PROPERTIES_INVALID',
    );
    if (
      !Number.isInteger(oracle.maximumSamplesPerSelector)
      || oracle.maximumSamplesPerSelector < 1
      || oracle.maximumSamplesPerSelector > 8
    ) {
      fail(
        'SITE_SCENARIO_TARGETING_ORACLE_SAMPLE_LIMIT_INVALID',
        oracle.maximumSamplesPerSelector,
      );
    }
    const positiveGeometry = requirePlainObject(
      oracle.positiveGeometry,
      'SITE_SCENARIO_TARGETING_ORACLE_POSITIVE_GEOMETRY_REQUIRED',
    );
    ['minimumWidth', 'minimumHeight', 'minimumArea'].forEach((key) => {
      if (
        typeof positiveGeometry[key] !== 'number'
        || !Number.isFinite(positiveGeometry[key])
        || positiveGeometry[key] < 0
      ) {
        fail(
          'SITE_SCENARIO_TARGETING_ORACLE_POSITIVE_GEOMETRY_INVALID',
          key,
        );
      }
    });
  }
  if (Object.hasOwn(observableEffects, 'layoutCycleOracle')) {
    const oracle = requirePlainObject(
      observableEffects.layoutCycleOracle,
      'SITE_SCENARIO_LAYOUT_CYCLE_ORACLE_INVALID',
    );
    requireExactKeys(
      oracle,
      [
        'kind',
        'opportunityKind',
        'relation',
        'ownerMarkerSelector',
        'ownedMetricSelectors',
        'collapsedContainerSelectors',
        'restoredCandidateSelectors',
      ],
      'SITE_SCENARIO_LAYOUT_CYCLE_ORACLE_SHAPE_INVALID',
    );
    if (oracle.kind !== LAYOUT_CYCLE_ORACLE_KIND) {
      fail('SITE_SCENARIO_LAYOUT_CYCLE_ORACLE_KIND_INVALID', oracle.kind);
    }
    if (oracle.opportunityKind !== LAYOUT_CYCLE_OPPORTUNITY_KIND) {
      fail(
        'SITE_SCENARIO_LAYOUT_CYCLE_OPPORTUNITY_KIND_INVALID',
        oracle.opportunityKind,
      );
    }
    if (oracle.relation !== LAYOUT_CYCLE_ORACLE_RELATION) {
      fail('SITE_SCENARIO_LAYOUT_CYCLE_ORACLE_RELATION_INVALID', oracle.relation);
    }
    const ownerMarkerSelector = requireNonEmptyString(
      oracle.ownerMarkerSelector,
      'SITE_SCENARIO_LAYOUT_CYCLE_OWNER_MARKER_SELECTOR_REQUIRED',
    );
    const restoredCandidateSelectors = requireUniqueStrings(
      oracle.restoredCandidateSelectors,
      'SITE_SCENARIO_LAYOUT_CYCLE_RESTORED_CANDIDATE_SELECTORS_REQUIRED',
    );
    const ownedMetricSelectors = requireUniqueStrings(
      oracle.ownedMetricSelectors,
      'SITE_SCENARIO_LAYOUT_CYCLE_OWNED_METRIC_SELECTORS_REQUIRED',
    );
    const collapsedContainerSelectors = requireUniqueStrings(
      oracle.collapsedContainerSelectors,
      'SITE_SCENARIO_LAYOUT_CYCLE_COLLAPSED_CONTAINER_SELECTORS_REQUIRED',
    );
    if (ownedMetricSelectors.includes(ownerMarkerSelector)) {
      fail('SITE_SCENARIO_LAYOUT_CYCLE_OWNED_METRIC_MARKER_COLLISION');
    }
    const markerDependentRestoredSelector = restoredCandidateSelectors.find(
      (selector) => selector.includes(ownerMarkerSelector),
    );
    if (markerDependentRestoredSelector) {
      fail(
        'SITE_SCENARIO_LAYOUT_CYCLE_RESTORED_CANDIDATE_MARKER_DEPENDENT',
        markerDependentRestoredSelector,
      );
    }
    const markerDependentContainerSelector = collapsedContainerSelectors.find(
      (selector) => selector.includes(ownerMarkerSelector),
    );
    if (markerDependentContainerSelector) {
      fail(
        'SITE_SCENARIO_LAYOUT_CYCLE_COLLAPSED_CONTAINER_MARKER_DEPENDENT',
        markerDependentContainerSelector,
      );
    }
    const containerWithoutRestoreCandidate = collapsedContainerSelectors.find(
      (selector) => !restoredCandidateSelectors.includes(selector),
    );
    if (containerWithoutRestoreCandidate) {
      fail(
        'SITE_SCENARIO_LAYOUT_CYCLE_COLLAPSED_CONTAINER_RESTORE_CANDIDATE_REQUIRED',
        containerWithoutRestoreCandidate,
      );
    }
    if (
      !collapsedContainerSelectors.includes(LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR)
      || !restoredCandidateSelectors.includes(LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR)
    ) {
      fail(
        'SITE_SCENARIO_LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_REQUIRED',
        LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR,
      );
    }
  }
}

function validateBlockerClassifiers(scenario) {
  if (!Array.isArray(scenario.blockerClassifiers)) {
    fail('SITE_SCENARIO_BLOCKER_CLASSIFIERS_REQUIRED');
  }
  const classifications = [];
  scenario.blockerClassifiers.forEach((classifier) => {
    requirePlainObject(classifier, 'SITE_SCENARIO_BLOCKER_CLASSIFIER_INVALID');
    if (!BLOCKER_CLASSIFICATION_SET.has(classifier.classification)) {
      fail('SITE_SCENARIO_BLOCKER_CLASSIFICATION_INVALID', classifier.classification);
    }
    if (classifier.match !== 'any' && classifier.match !== 'all') {
      fail('SITE_SCENARIO_BLOCKER_MATCH_INVALID', classifier.match);
    }
    requireUniqueStrings(
      classifier.signalIds,
      'SITE_SCENARIO_BLOCKER_SIGNALS_INVALID',
    );
    if (typeof classifier.takeoverCheckpoint !== 'boolean') {
      fail('SITE_SCENARIO_BLOCKER_TAKEOVER_FLAG_REQUIRED', classifier.classification);
    }
    classifications.push(classifier.classification);
  });
  if (!sameStringSet(classifications, SITE_SCENARIO_BLOCKER_CLASSIFICATIONS)) {
    fail('SITE_SCENARIO_BLOCKER_CLASSIFICATIONS_INCOMPLETE', scenario.id);
  }
}

export function validateSiteScenario(scenario) {
  requirePlainObject(scenario, 'SITE_SCENARIO_REQUIRED');
  const scenarioId = requireNonEmptyString(scenario.id, 'SITE_SCENARIO_ID_REQUIRED');
  if (!SCENARIO_ID_PATTERN.test(scenarioId)) fail('SITE_SCENARIO_ID_INVALID', scenarioId);
  requireKnownValues(scenario.suites, SUITE_ID_SET, 'SITE_SCENARIO_SUITES_INVALID');
  if (!SITE_ID_SET.has(scenario.siteId)) fail('SITE_SCENARIO_SITE_ID_UNSUPPORTED', scenario.siteId);
  requireNonEmptyString(scenario.featureGroup, 'SITE_SCENARIO_FEATURE_GROUP_REQUIRED');

  const execution = requirePlainObject(
    scenario.execution,
    'SITE_SCENARIO_EXECUTION_REQUIRED',
  );
  if (!EXECUTION_MODE_SET.has(execution.mode)) {
    fail('SITE_SCENARIO_EXECUTION_MODE_INVALID', execution.mode);
  }
  if (typeof execution.requiresExplicitQaProfile !== 'boolean') {
    fail('SITE_SCENARIO_QA_PROFILE_FLAG_REQUIRED', scenario.id);
  }
  const auth = requirePlainObject(scenario.auth, 'SITE_SCENARIO_AUTH_REQUIRED');
  if (auth.mode !== 'public_no_login' && auth.mode !== 'qa_profile_required') {
    fail('SITE_SCENARIO_AUTH_MODE_INVALID', auth.mode);
  }
  if (typeof auth.storePageContent !== 'boolean' || auth.storePageContent !== false) {
    fail('SITE_SCENARIO_PAGE_CONTENT_STORAGE_FORBIDDEN', scenario.id);
  }

  validateScenarioUrls(scenario);
  validateScenarioSettings(scenario.settings, scenario.id);
  validateExpectedActivation(scenario);
  validateArtifactDisclosureRequirements(scenario);
  validateReadiness(scenario.readiness);
  validatePageRuntimeErrorPolicy(scenario.pageRuntimeErrorPolicy);
  const feedStepIds = validateActions(scenario);
  validateFeedConsumption(scenario, feedStepIds);
  validateObservableEffects(scenario.observableEffects);
  validateLaneBoundEntries(
    scenario.settle?.conditions,
    'SITE_SCENARIO_SETTLE_CONDITIONS_REQUIRED',
  );
  for (const condition of scenario.settle.conditions) {
    if (condition.waitTimeoutMs === undefined) continue;
    if (
      condition.lane !== 'diagnostic'
      || !['debug_path_equals', 'debug_path_in', 'debug_paths_match'].includes(condition.kind)
      || !Number.isSafeInteger(condition.waitTimeoutMs)
      || condition.waitTimeoutMs < 1
      || condition.waitTimeoutMs > 30_000
    ) fail('SITE_SCENARIO_SETTLE_WAIT_INVALID', condition.id);
  }
  requireUniqueStrings(
    scenario.forbiddenActions,
    'SITE_SCENARIO_FORBIDDEN_ACTIONS_REQUIRED',
  );
  validateBlockerClassifiers(scenario);
  return true;
}

export function validateSiteScenarioCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    fail('SITE_SCENARIO_CATALOG_REQUIRED');
  }
  const ids = catalog.map((scenario) => scenario?.id);
  if (new Set(ids).size !== ids.length) fail('SITE_SCENARIO_CATALOG_ID_DUPLICATE');
  catalog.forEach((scenario) => validateSiteScenario(scenario));
  SITE_SCENARIO_SUITE_IDS.forEach((suiteId) => {
    if (!catalog.some((scenario) => scenario.suites.includes(suiteId))) {
      fail('SITE_SCENARIO_SUITE_EMPTY', suiteId);
    }
  });
  return true;
}

export function defineSiteScenario(definition) {
  const cloned = cloneValue(definition);
  validateSiteScenario(cloned);
  return deepFreezeScenarioValue(cloned);
}

export function selectSiteScenarios(
  catalog,
  { suiteId, siteId = null, featureGroup = null } = {},
) {
  validateSiteScenarioCatalog(catalog);
  if (!SUITE_ID_SET.has(suiteId)) fail('SITE_SCENARIO_SUITE_UNKNOWN', suiteId || 'missing');
  if (siteId !== null && !SITE_ID_SET.has(siteId)) {
    fail('SITE_SCENARIO_SITE_ID_UNSUPPORTED', siteId);
  }
  if (featureGroup !== null && (typeof featureGroup !== 'string' || !featureGroup.trim())) {
    fail('SITE_SCENARIO_FEATURE_GROUP_INVALID', featureGroup || 'missing');
  }
  const selected = catalog.filter((scenario) => (
    scenario.suites.includes(suiteId)
    && (siteId === null || scenario.siteId === siteId)
    && (featureGroup === null || scenario.featureGroup === featureGroup)
  ));
  if (selected.length === 0) {
    fail(
      'SITE_SCENARIO_SELECTION_EMPTY',
      `${suiteId}:${siteId || 'all'}:${featureGroup || 'all'}`,
    );
  }
  return selected;
}

export function collectScenarioHostPermissions(scenarios) {
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    fail('SITE_SCENARIO_SELECTION_REQUIRED');
  }
  const permissions = new Set();
  scenarios.forEach((scenario) => {
    validateSiteScenario(scenario);
    [...scenario.allowlistedOrigins, ...scenario.redirectOrigins]
      .forEach((origin) => permissions.add(`${origin}/*`));
  });
  return Array.from(permissions).sort();
}

export function cloneScenarioFilterSettings(scenario) {
  validateSiteScenario(scenario);
  return cloneValue(scenario.settings.values);
}

export function buildScenarioSettings(scenario, { enabled = true } = {}) {
  validateSiteScenario(scenario);
  if (typeof enabled !== 'boolean') fail('SITE_SCENARIO_SETTINGS_ENABLED_FLAG_INVALID');
  if (enabled) return cloneValue(scenario.settings.values);
  return normalizeFilterSettings(createInactiveFilterSettings());
}

export function resolveScenarioBlockerClassification(scenario, observedSignalIds = []) {
  validateSiteScenario(scenario);
  const observed = new Set(requireUniqueStrings(
    observedSignalIds,
    'SITE_SCENARIO_OBSERVED_SIGNALS_INVALID',
    { allowEmpty: true },
  ));
  for (const classifier of scenario.blockerClassifiers) {
    const matched = classifier.match === 'all'
      ? classifier.signalIds.every((signalId) => observed.has(signalId))
      : classifier.signalIds.some((signalId) => observed.has(signalId));
    if (matched) {
      return {
        classification: classifier.classification,
        takeoverCheckpoint: classifier.takeoverCheckpoint,
        matchedSignalIds: classifier.signalIds.filter((signalId) => observed.has(signalId)),
      };
    }
  }
  return null;
}
