import { assertPackagedExtensionWorkerCsp } from '../extension/extensionPageWorkerCspContract.js';
import {
  assertCanonicalManifestChromeCompatibility,
} from '../extension/chromeCompatibilityContract.js';

export const EXTENSION_BUILD_TARGETS = Object.freeze({
  CHROME: 'chrome',
  WHALE: 'whale',
  FIREFOX: 'firefox',
  SAFARI: 'safari',
});

export const EXTENSION_RELEASE_PROFILES = Object.freeze({
  PUBLIC: 'public',
  DEV: 'dev',
});

export const CHROME_EXTENSION_OUTPUT_DIRS = Object.freeze({
  DEV: 'dist',
  PUBLIC: 'dist-prod',
});

const CHROMIUM_TARGETS = new Set([
  EXTENSION_BUILD_TARGETS.CHROME,
  EXTENSION_BUILD_TARGETS.WHALE,
]);

const CHROME_ONLY_PERMISSIONS = new Set([
  'favicon',
  'offscreen',
  'tabCapture',
]);

const CHROME_ONLY_OPTIONAL_PERMISSIONS = new Set([
  'tabGroups',
  'tabCapture',
]);

const AUDIO_DULLING_DEV_PERMISSIONS = Object.freeze([
  'activeTab',
  'offscreen',
  'tabCapture',
]);

const CHROMIUM_ONLY_WEB_ACCESSIBLE_RESOURCE_KEYS = new Set([
  'use_dynamic_url',
]);

const CHROME_ONLY_MANIFEST_KEYS = new Set([
  'minimum_chrome_version',
]);

const TARGET_ALIASES = Object.freeze({
  chromium: EXTENSION_BUILD_TARGETS.CHROME,
  edge: EXTENSION_BUILD_TARGETS.CHROME,
  naver_whale: EXTENSION_BUILD_TARGETS.WHALE,
  whale: EXTENSION_BUILD_TARGETS.WHALE,
  firefox_desktop: EXTENSION_BUILD_TARGETS.FIREFOX,
  firefox: EXTENSION_BUILD_TARGETS.FIREFOX,
  safari_ios: EXTENSION_BUILD_TARGETS.SAFARI,
  safari_macos: EXTENSION_BUILD_TARGETS.SAFARI,
  safari: EXTENSION_BUILD_TARGETS.SAFARI,
});

const SAFARI_EXTENSION_PAGE_CSP = "default-src 'self'; script-src 'self'; object-src 'none'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; media-src 'self' blob:; frame-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none';";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function compactStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === 'string' && entry.trim());
}

function removePermissions(manifest, blockedPermissions) {
  manifest.permissions = compactStringArray(manifest.permissions)
    .filter((permission) => !blockedPermissions.has(permission));
}

function addPermissions(manifest, permissions) {
  const nextPermissions = new Set(compactStringArray(manifest.permissions));
  permissions.forEach((permission) => nextPermissions.add(permission));
  manifest.permissions = [...nextPermissions];
}

function removeOptionalPermissions(manifest, blockedPermissions) {
  manifest.optional_permissions = compactStringArray(manifest.optional_permissions)
    .filter((permission) => !blockedPermissions.has(permission));
}

function removeWebAccessibleResourceKeys(manifest, blockedKeys) {
  if (!Array.isArray(manifest.web_accessible_resources)) return;
  manifest.web_accessible_resources = manifest.web_accessible_resources.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const nextEntry = { ...entry };
    for (const key of blockedKeys) {
      delete nextEntry[key];
    }
    return nextEntry;
  });
}

function removeManifestKeys(manifest, blockedKeys) {
  for (const key of blockedKeys) {
    delete manifest[key];
  }
}

function addFirefoxBackgroundProfile(manifest) {
  const serviceWorker = manifest?.background?.service_worker;
  if (typeof serviceWorker !== 'string' || !serviceWorker.trim()) {
    throw new Error('Firefox extension target requires a background.service_worker source in the base manifest.');
  }

  manifest.background = {
    ...manifest.background,
    scripts: [serviceWorker],
    service_worker: serviceWorker,
    preferred_environment: ['document', 'service_worker'],
  };

  manifest.browser_specific_settings = {
    ...(manifest.browser_specific_settings || {}),
    gecko: {
      ...(manifest.browser_specific_settings?.gecko || {}),
      id: 'entropy@local.extension',
      strict_min_version: '121.0',
    },
  };
}

function addSafariBackgroundProfile(manifest) {
  const serviceWorker = manifest?.background?.service_worker;
  if (typeof serviceWorker !== 'string' || !serviceWorker.trim()) {
    throw new Error('Safari extension target requires a background.service_worker source in the base manifest.');
  }

  manifest.background = {
    ...manifest.background,
    scripts: [serviceWorker],
    service_worker: serviceWorker,
    preferred_environment: ['service_worker', 'document'],
  };
  manifest.content_security_policy ||= {};
  manifest.content_security_policy.extension_pages = SAFARI_EXTENSION_PAGE_CSP;
}

function annotateTarget(manifest, target) {
  manifest.version_name = target === EXTENSION_BUILD_TARGETS.CHROME
    ? manifest.version_name
    : `${manifest.version}-${target}`;
  if (!manifest.version_name) {
    delete manifest.version_name;
  }
}

export function normalizeExtensionBuildTarget(value, fallback = EXTENSION_BUILD_TARGETS.CHROME) {
  const normalized = normalizeString(value);
  if (!normalized) return fallback;
  if (Object.values(EXTENSION_BUILD_TARGETS).includes(normalized)) return normalized;
  if (TARGET_ALIASES[normalized]) return TARGET_ALIASES[normalized];
  throw new Error(
    `[extension-target] Unknown target "${value}". Expected one of: ${Object.values(EXTENSION_BUILD_TARGETS).join(', ')}.`,
  );
}

export function normalizeExtensionReleaseProfile(
  value,
  fallback = EXTENSION_RELEASE_PROFILES.PUBLIC,
) {
  const normalized = normalizeString(value);
  if (!normalized) return fallback;
  if (Object.values(EXTENSION_RELEASE_PROFILES).includes(normalized)) return normalized;
  throw new Error(
    `[extension-release-profile] Unknown profile "${value}". Expected one of: ${Object.values(EXTENSION_RELEASE_PROFILES).join(', ')}.`,
  );
}

export function isChromiumExtensionTarget(target) {
  return CHROMIUM_TARGETS.has(normalizeExtensionBuildTarget(target));
}

export function createExtensionManifestProfile(
  baseManifest,
  targetInput = EXTENSION_BUILD_TARGETS.CHROME,
  {
    releaseProfile: releaseProfileInput = EXTENSION_RELEASE_PROFILES.PUBLIC,
  } = {},
) {
  const target = normalizeExtensionBuildTarget(targetInput);
  const releaseProfile = normalizeExtensionReleaseProfile(releaseProfileInput);
  const manifest = cloneJson(baseManifest);
  const hasCanonicalChromeFloor = Object.prototype.hasOwnProperty.call(
    manifest,
    'minimum_chrome_version',
  );

  // Firefox/Safari finalization sees the already-stripped target manifest a
  // second time. Validate every canonical source manifest and all Chromium
  // artifacts, while allowing that intentional second-pass absence only.
  if (hasCanonicalChromeFloor || CHROMIUM_TARGETS.has(target)) {
    assertCanonicalManifestChromeCompatibility(manifest, {
      source: `extension-profile:${target}`,
    });
  }

  assertPackagedExtensionWorkerCsp(manifest.content_security_policy?.extension_pages, {
    source: `extension-profile-input:${target}`,
  });

  if (target === EXTENSION_BUILD_TARGETS.FIREFOX) {
    removePermissions(manifest, CHROME_ONLY_PERMISSIONS);
    removeOptionalPermissions(manifest, CHROME_ONLY_OPTIONAL_PERMISSIONS);
    removeWebAccessibleResourceKeys(manifest, CHROMIUM_ONLY_WEB_ACCESSIBLE_RESOURCE_KEYS);
    removeManifestKeys(manifest, CHROME_ONLY_MANIFEST_KEYS);
    addFirefoxBackgroundProfile(manifest);
  } else if (target === EXTENSION_BUILD_TARGETS.SAFARI) {
    removePermissions(manifest, CHROME_ONLY_PERMISSIONS);
    removeOptionalPermissions(manifest, CHROME_ONLY_OPTIONAL_PERMISSIONS);
    removeWebAccessibleResourceKeys(manifest, CHROMIUM_ONLY_WEB_ACCESSIBLE_RESOURCE_KEYS);
    removeManifestKeys(manifest, CHROME_ONLY_MANIFEST_KEYS);
    addSafariBackgroundProfile(manifest);
  } else if (target === EXTENSION_BUILD_TARGETS.WHALE) {
    // Whale is Chromium-compatible; keep Chrome MV3 semantics and only tag the package.
  } else if (target !== EXTENSION_BUILD_TARGETS.CHROME) {
    throw new Error(`[extension-target] Unhandled target "${target}".`);
  }

  if (CHROMIUM_TARGETS.has(target) && releaseProfile === EXTENSION_RELEASE_PROFILES.DEV) {
    addPermissions(manifest, AUDIO_DULLING_DEV_PERMISSIONS);
    removeOptionalPermissions(manifest, new Set(AUDIO_DULLING_DEV_PERMISSIONS));
  } else {
    removePermissions(manifest, new Set(AUDIO_DULLING_DEV_PERMISSIONS));
    removeOptionalPermissions(manifest, new Set(AUDIO_DULLING_DEV_PERMISSIONS));
  }

  annotateTarget(manifest, target);
  assertPackagedExtensionWorkerCsp(manifest.content_security_policy?.extension_pages, {
    source: `extension-profile-output:${target}`,
  });
  return manifest;
}

export function resolveExtensionOutDir(
  targetInput,
  explicitOutDir = '',
  { releaseProfile = EXTENSION_RELEASE_PROFILES.PUBLIC } = {},
) {
  const target = normalizeExtensionBuildTarget(targetInput);
  const normalizedOutDir = typeof explicitOutDir === 'string' ? explicitOutDir.trim() : '';
  if (normalizedOutDir) return normalizedOutDir;
  const profile = normalizeExtensionReleaseProfile(releaseProfile);
  if (target === EXTENSION_BUILD_TARGETS.CHROME) {
    return profile === EXTENSION_RELEASE_PROFILES.DEV
      ? CHROME_EXTENSION_OUTPUT_DIRS.DEV
      : CHROME_EXTENSION_OUTPUT_DIRS.PUBLIC;
  }
  return `dist-${target}`;
}

export function assertExtensionBuildOutputIsolation({
  targetInput,
  releaseProfile,
  outputDir,
  chromeDevOutputDir,
} = {}) {
  const target = normalizeExtensionBuildTarget(targetInput);
  const profile = normalizeExtensionReleaseProfile(releaseProfile);
  if (
    target === EXTENSION_BUILD_TARGETS.CHROME
    && typeof outputDir === 'string'
    && outputDir === chromeDevOutputDir
  ) {
    if (profile === EXTENSION_RELEASE_PROFILES.DEV) {
      throw new Error(
        `EXTENSION_BUILD_ACTIVE_DEV_OUTPUT_MUTATION:${profile}:${CHROME_EXTENSION_OUTPUT_DIRS.DEV}`,
      );
    }
    throw new Error(
      `EXTENSION_BUILD_OUTPUT_PROFILE_COLLISION:${profile}:${CHROME_EXTENSION_OUTPUT_DIRS.DEV}`,
    );
  }
  return outputDir;
}
