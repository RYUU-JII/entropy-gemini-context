import { inferBrowserQaPlatform } from '../../browser-qa/browser/windowsPlatform.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  normalizeBrowserResourceRegistry,
  resolveBrowserInstallation,
  resolveBrowserProfileSlot,
} from '../../browser-qa/lifecycle/browserResourceRegistry.mjs';

export const QA_LOCAL_CONFIG_SCHEMA_VERSION = 1;
const ENVIRONMENT_ID_PATTERN = /^[a-z][a-z0-9_]*$/u;
const CONFIG_KEYS = new Set([
  'schemaVersion',
  'browserResources',
  'environments',
  'artifacts',
]);
const ARTIFACT_KEYS = new Set(['devExtension', 'publicExtension']);
const BROWSER_ENVIRONMENT_KEYS = Object.freeze({
  persistent_authenticated: new Set([
    'browserClass',
    'profileSlotId',
    'profile',
    'profileDirectory',
    'chrome',
    'cdpEndpoint',
  ]),
  managed_persistent: new Set(['browserClass', 'profileSlotId']),
  ephemeral_extension: new Set(['browserClass', 'installationId', 'chrome']),
  deterministic_visual: new Set(['browserClass', 'installationId', 'chrome']),
  release_clean: new Set(['browserClass', 'installationId', 'chrome']),
});

const PLAYWRIGHT_INSTALLATION_ID = 'playwright_chromium';
const BUILTIN_BROWSER_INSTALLATIONS = Object.freeze({
  [PLAYWRIGHT_INSTALLATION_ID]: Object.freeze({
    source: 'playwright',
    platform: 'runtime',
    distribution: 'playwright_chromium',
  }),
});

const DEFAULT_BROWSER_ENVIRONMENTS = Object.freeze({
  visual: Object.freeze({
    id: 'visual',
    browserClass: 'deterministic_visual',
    installationId: PLAYWRIGHT_INSTALLATION_ID,
    profileSlotId: null,
    chrome: null,
    profile: null,
    profileDirectory: null,
    cdpEndpoint: null,
    extensionSlot: null,
    processOwnership: 'owned',
    lifecyclePolicy: 'per_run',
    focusPolicy: 'capture_only',
    audioPolicy: 'muted',
  }),
  ephemeral: Object.freeze({
    id: 'ephemeral',
    browserClass: 'ephemeral_extension',
    installationId: PLAYWRIGHT_INSTALLATION_ID,
    profileSlotId: null,
    chrome: null,
    profile: null,
    profileDirectory: null,
    cdpEndpoint: null,
    extensionSlot: null,
    processOwnership: 'owned',
    lifecyclePolicy: 'per_run',
    focusPolicy: 'never',
    audioPolicy: 'muted',
  }),
  release: Object.freeze({
    id: 'release',
    browserClass: 'release_clean',
    installationId: PLAYWRIGHT_INSTALLATION_ID,
    profileSlotId: null,
    chrome: null,
    profile: null,
    profileDirectory: null,
    cdpEndpoint: null,
    extensionSlot: null,
    processOwnership: 'owned',
    lifecyclePolicy: 'per_run',
    focusPolicy: 'never',
    audioPolicy: 'muted',
  }),
});

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function requireAbsolutePath(value, code) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) fail(code);
  return path.normalize(value);
}

function rejectUnknownKeys(value, allowedKeys, code) {
  const unknownKey = Object.keys(value).find((key) => !allowedKeys.has(key));
  if (unknownKey) fail(code, unknownKey);
}

function pathsOverlap(left, right) {
  const leftToRight = path.relative(left, right);
  const rightToLeft = path.relative(right, left);
  const isWithin = (relativePath) => (
    relativePath === ''
    || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
  return isWithin(leftToRight) || isWithin(rightToLeft);
}

function assertSafeArtifactPath(artifactPath, { rootDir, label }) {
  const artifactToRoot = path.relative(artifactPath, rootDir);
  if (
    artifactToRoot === ''
    || (!artifactToRoot.startsWith('..') && !path.isAbsolute(artifactToRoot))
  ) {
    fail('QA_ARTIFACT_PATH_PROJECT_ANCESTOR_FORBIDDEN', label);
  }
}

function inferInlineBrowserPlatform(executable) {
  return inferBrowserQaPlatform(executable);
}

function inferInlineBrowserDistribution(executable) {
  const normalized = executable.toLowerCase();
  if (normalized.includes('chrome-for-testing')) return 'chrome_for_testing';
  if (normalized.includes('google') || normalized.includes('chrome')) {
    return 'google_chrome';
  }
  if (normalized.includes('chromium')) return 'chromium';
  return 'chromium_compatible';
}

function inlineInstallationId(environmentId) {
  return `inline_${environmentId}_installation`;
}

function inlineProfileSlotId(environmentId) {
  return `inline_${environmentId}_profile`;
}

function materializeBrowserResources(rawConfig) {
  const rawResources = rawConfig.browserResources || {};
  if (!rawResources || typeof rawResources !== 'object' || Array.isArray(rawResources)) {
    fail('QA_BROWSER_RESOURCES_INVALID');
  }
  const rawInstallations = rawResources.installations || {};
  const rawProfileSlots = rawResources.profileSlots || {};
  if (
    !rawInstallations
    || typeof rawInstallations !== 'object'
    || Array.isArray(rawInstallations)
    || !rawProfileSlots
    || typeof rawProfileSlots !== 'object'
    || Array.isArray(rawProfileSlots)
  ) {
    fail('QA_BROWSER_RESOURCES_INVALID');
  }
  if (Object.prototype.hasOwnProperty.call(rawInstallations, PLAYWRIGHT_INSTALLATION_ID)) {
    fail('QA_BROWSER_INSTALLATION_ID_RESERVED', PLAYWRIGHT_INSTALLATION_ID);
  }
  const installations = {
    ...BUILTIN_BROWSER_INSTALLATIONS,
    ...rawInstallations,
  };
  const profileSlots = { ...rawProfileSlots };

  Object.entries(rawConfig.environments || {}).forEach(([id, environment]) => {
    if (!environment || typeof environment !== 'object' || Array.isArray(environment)) return;
    const browserClass = environment.browserClass;
    if (browserClass === 'persistent_authenticated' && !environment.profileSlotId) {
      const installationId = inlineInstallationId(id);
      const profileSlotId = inlineProfileSlotId(id);
      if (installations[installationId] || profileSlots[profileSlotId]) {
        fail('QA_BROWSER_INLINE_RESOURCE_ID_CONFLICT', id);
      }
      const executable = requireAbsolutePath(
        environment.chrome,
        `QA_ENVIRONMENT_CHROME_ABSOLUTE_REQUIRED:${id}`,
      );
      installations[installationId] = {
        executable,
        platform: inferInlineBrowserPlatform(executable),
        distribution: inferInlineBrowserDistribution(executable),
      };
      profileSlots[profileSlotId] = {
        installationId,
        userDataDir: environment.profile,
        profileDirectory: environment.profileDirectory,
        cdpEndpoint: environment.cdpEndpoint,
        lifecyclePolicy: 'external',
        focusPolicy: 'never',
        launchAudioPolicy: 'muted',
      };
      return;
    }
    if (
      ['ephemeral_extension', 'deterministic_visual', 'release_clean'].includes(browserClass)
      && environment.chrome
    ) {
      if (environment.installationId) {
        fail('QA_ENVIRONMENT_BROWSER_INSTALLATION_AMBIGUOUS', id);
      }
      const installationId = inlineInstallationId(id);
      if (installations[installationId]) {
        fail('QA_BROWSER_INLINE_RESOURCE_ID_CONFLICT', id);
      }
      const executable = requireAbsolutePath(
        environment.chrome,
        `QA_ENVIRONMENT_CHROME_ABSOLUTE_REQUIRED:${id}`,
      );
      installations[installationId] = {
        executable,
        platform: inferInlineBrowserPlatform(executable),
        distribution: inferInlineBrowserDistribution(executable),
      };
    }
  });
  return normalizeBrowserResourceRegistry({ installations, profileSlots });
}

function normalizeBrowserEnvironment(id, rawEnvironment, browserResources) {
  if (!rawEnvironment || typeof rawEnvironment !== 'object') {
    fail('QA_ENVIRONMENT_INVALID', id);
  }
  const browserClass = typeof rawEnvironment.browserClass === 'string'
    ? rawEnvironment.browserClass.trim()
    : '';
  if (![
    'persistent_authenticated',
    'managed_persistent',
    'ephemeral_extension',
    'deterministic_visual',
    'release_clean',
  ].includes(browserClass)) {
    fail('QA_ENVIRONMENT_BROWSER_CLASS_INVALID', `${id}:${browserClass || 'missing'}`);
  }
  rejectUnknownKeys(
    rawEnvironment,
    BROWSER_ENVIRONMENT_KEYS[browserClass],
    `QA_ENVIRONMENT_KEY_UNKNOWN:${id}`,
  );
  if (['persistent_authenticated', 'managed_persistent'].includes(browserClass)) {
    const usesNamedProfileSlot = typeof rawEnvironment.profileSlotId === 'string';
    if (
      usesNamedProfileSlot
      && ['profile', 'profileDirectory', 'chrome', 'cdpEndpoint']
        .some((key) => rawEnvironment[key] !== undefined)
    ) {
      fail('QA_ENVIRONMENT_PROFILE_SLOT_AMBIGUOUS', id);
    }
    if (browserClass === 'managed_persistent' && !usesNamedProfileSlot) {
      fail('QA_ENVIRONMENT_MANAGED_PROFILE_SLOT_REQUIRED', id);
    }
    const profileSlotId = usesNamedProfileSlot
      ? rawEnvironment.profileSlotId
      : inlineProfileSlotId(id);
    const profileSlot = resolveBrowserProfileSlot(browserResources, profileSlotId);
    const expectedLifecycle = browserClass === 'managed_persistent'
      ? 'managed'
      : 'external';
    if (profileSlot.lifecyclePolicy !== expectedLifecycle) {
      fail(
        'QA_ENVIRONMENT_PROFILE_LIFECYCLE_MISMATCH',
        `${id}:${profileSlot.lifecyclePolicy}`,
      );
    }
    return Object.freeze({
      id,
      browserClass,
      installationId: profileSlot.installationId,
      profileSlotId,
      profileSlot,
      chrome: profileSlot.installation.executable,
      profile: profileSlot.userDataDir,
      profileDirectory: profileSlot.profileDirectory,
      cdpEndpoint: profileSlot.cdpEndpoint,
      extensionSlot: `${profileSlot.userDataDir}.entropy-extension-slot`,
      processOwnership: 'attach_only',
      lifecyclePolicy: profileSlot.lifecyclePolicy,
      focusPolicy: profileSlot.focusPolicy,
      audioPolicy: 'muted',
    });
  }
  if (rawEnvironment.chrome && rawEnvironment.installationId) {
    fail('QA_ENVIRONMENT_BROWSER_INSTALLATION_AMBIGUOUS', id);
  }
  const installationId = rawEnvironment.installationId
    || (rawEnvironment.chrome ? inlineInstallationId(id) : PLAYWRIGHT_INSTALLATION_ID);
  const installation = resolveBrowserInstallation(browserResources, installationId);
  return Object.freeze({
    id,
    browserClass,
    installationId,
    profileSlotId: null,
    profileSlot: null,
    chrome: installation.executable,
    profile: null,
    profileDirectory: null,
    cdpEndpoint: null,
    extensionSlot: null,
    processOwnership: 'owned',
    lifecyclePolicy: 'per_run',
    focusPolicy: browserClass === 'deterministic_visual' ? 'capture_only' : 'never',
    audioPolicy: 'muted',
  });
}

function normalizeArtifactConfig(rootDir, rawArtifacts = {}) {
  if (!rawArtifacts || typeof rawArtifacts !== 'object' || Array.isArray(rawArtifacts)) {
    fail('QA_ARTIFACT_CONFIG_INVALID');
  }
  rejectUnknownKeys(rawArtifacts, ARTIFACT_KEYS, 'QA_ARTIFACT_CONFIG_KEY_UNKNOWN');
  const artifacts = {
    devExtension: rawArtifacts.devExtension === undefined
      ? path.join(rootDir, 'dist')
      : requireAbsolutePath(
        rawArtifacts.devExtension,
        'QA_ARTIFACT_DEV_EXTENSION_ABSOLUTE_REQUIRED',
      ),
    publicExtension: rawArtifacts.publicExtension === undefined
      ? path.join(rootDir, 'dist-prod')
      : requireAbsolutePath(
        rawArtifacts.publicExtension,
        'QA_ARTIFACT_PUBLIC_EXTENSION_ABSOLUTE_REQUIRED',
      ),
  };
  if (pathsOverlap(artifacts.devExtension, artifacts.publicExtension)) {
    fail('QA_ARTIFACT_PATHS_MUST_NOT_OVERLAP');
  }
  Object.entries(artifacts).forEach(([label, artifactPath]) => {
    assertSafeArtifactPath(artifactPath, { rootDir, label });
  });
  return Object.freeze(artifacts);
}

export function validateQaLocalConfig(rawConfig, { rootDir }) {
  if (!path.isAbsolute(rootDir || '')) {
    fail('QA_LOCAL_CONFIG_ROOT_ABSOLUTE_REQUIRED');
  }
  if (!rawConfig || rawConfig.schemaVersion !== QA_LOCAL_CONFIG_SCHEMA_VERSION) {
    fail('QA_LOCAL_CONFIG_SCHEMA_INVALID');
  }
  rejectUnknownKeys(rawConfig, CONFIG_KEYS, 'QA_LOCAL_CONFIG_KEY_UNKNOWN');
  const rawEnvironments = rawConfig.environments;
  if (
    !rawEnvironments
    || typeof rawEnvironments !== 'object'
    || Array.isArray(rawEnvironments)
  ) {
    fail('QA_LOCAL_CONFIG_ENVIRONMENTS_REQUIRED');
  }
  const browserResources = materializeBrowserResources(rawConfig);
  const environments = Object.freeze(Object.fromEntries(
    Object.entries(rawEnvironments).map(([id, environment]) => {
      if (!ENVIRONMENT_ID_PATTERN.test(id)) {
        fail('QA_ENVIRONMENT_ID_INVALID', id || 'missing');
      }
      return [id, normalizeBrowserEnvironment(id, environment, browserResources)];
    }),
  ));
  const artifacts = normalizeArtifactConfig(rootDir, rawConfig.artifacts);
  Object.values(environments).forEach((environment) => {
    [environment.profile, environment.extensionSlot]
      .filter(Boolean)
      .forEach((protectedPath) => {
        Object.entries(artifacts).forEach(([label, artifactPath]) => {
          if (pathsOverlap(artifactPath, protectedPath)) {
            fail(
              'QA_ARTIFACT_PATH_BROWSER_STATE_OVERLAP_FORBIDDEN',
              `${label}:${environment.id}`,
            );
          }
        });
      });
  });
  return Object.freeze({
    schemaVersion: QA_LOCAL_CONFIG_SCHEMA_VERSION,
    browserResources,
    environments,
    artifacts,
  });
}

export async function readQaLocalConfig(configPath, { rootDir }) {
  if (!path.isAbsolute(configPath || '')) {
    fail('QA_LOCAL_CONFIG_ABSOLUTE_PATH_REQUIRED');
  }
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`QA_LOCAL_CONFIG_UNAVAILABLE:${configPath}`, { cause: error });
  }
  return validateQaLocalConfig(raw, { rootDir });
}

export function createEmptyQaLocalConfig({ rootDir }) {
  return validateQaLocalConfig({
    schemaVersion: QA_LOCAL_CONFIG_SCHEMA_VERSION,
    environments: {},
  }, { rootDir });
}

export function resolveQaBrowserEnvironment(environmentId, config, {
  required = true,
} = {}) {
  if (environmentId === null || environmentId === undefined) return null;
  const normalizedId = typeof environmentId === 'string' ? environmentId.trim() : '';
  if (!ENVIRONMENT_ID_PATTERN.test(normalizedId)) {
    fail('QA_ENVIRONMENT_ID_INVALID', normalizedId || 'missing');
  }
  const environment = config?.environments?.[normalizedId]
    || DEFAULT_BROWSER_ENVIRONMENTS[normalizedId]
    || null;
  if (!environment && required) {
    fail('QA_TARGET_ENVIRONMENT_UNAVAILABLE', normalizedId);
  }
  return environment;
}

export function listQaBrowserEnvironments(config) {
  const environmentIds = new Set([
    ...Object.keys(DEFAULT_BROWSER_ENVIRONMENTS),
    ...Object.keys(config?.environments || {}),
  ]);
  return [...environmentIds]
    .sort()
    .map((environmentId) => resolveQaBrowserEnvironment(environmentId, config));
}

export function resolveQaTargetEnvironment(target, config) {
  return resolveQaBrowserEnvironment(target.environmentId, config);
}
