import path from 'node:path';

export const BROWSER_RESOURCE_REGISTRY_CONTRACT_VERSION = 1;

const RESOURCE_ID_PATTERN = /^[a-z][a-z0-9_]*$/u;
const REGISTRY_KEYS = new Set(['installations', 'profileSlots']);
const INSTALLATION_KEYS = new Set([
  'source',
  'executable',
  'platform',
  'distribution',
]);
const PROFILE_SLOT_KEYS = new Set([
  'installationId',
  'userDataDir',
  'profileDirectory',
  'cdpEndpoint',
  'lifecyclePolicy',
  'focusPolicy',
  'launchAudioPolicy',
]);
const INSTALLATION_SOURCES = new Set(['path', 'playwright']);
const INSTALLATION_DISTRIBUTIONS = new Set([
  'chrome_for_testing',
  'google_chrome',
  'chromium',
  'playwright_chromium',
  'chromium_compatible',
]);
const LIFECYCLE_POLICIES = new Set(['external', 'managed']);
const FOCUS_POLICIES = new Set(['never', 'request_once']);
const AUDIO_POLICIES = new Set(['muted', 'audible']);
export const BROWSER_PROFILE_OWNERSHIP_POLICIES = Object.freeze({
  EXTERNAL_OPERATOR: 'external_operator',
  DEDICATED_ADAPTER_PROOF_REQUIRED: 'dedicated_adapter_proof_required',
});

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function rejectUnknownKeys(value, allowedKeys, code) {
  const unknownKey = Object.keys(value).find((key) => !allowedKeys.has(key));
  if (unknownKey) fail(code, unknownKey);
}

function requireRecord(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return value;
}

function requireResourceId(value, code) {
  if (typeof value !== 'string' || !RESOURCE_ID_PATTERN.test(value)) {
    fail(code, value || 'missing');
  }
  return value;
}

function requireAbsolutePath(value, code, platform) {
  const pathApi = platform === 'windows' ? path.win32 : path.posix;
  if (typeof value !== 'string' || !pathApi.isAbsolute(value)) fail(code);
  return pathApi.normalize(value);
}

function requireEnum(value, values, code) {
  if (typeof value !== 'string' || !values.has(value)) {
    fail(code, value || 'missing');
  }
  return value;
}

export function normalizeLoopbackCdpEndpoint(value) {
  let endpoint;
  try {
    endpoint = new URL(value);
  } catch {
    fail('BROWSER_QA_CDP_ENDPOINT_INVALID');
  }
  if (
    endpoint.protocol !== 'http:'
    || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
    || !endpoint.port
    || (endpoint.pathname !== '/' && endpoint.pathname !== '')
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
  ) {
    fail('BROWSER_QA_CDP_ENDPOINT_LOOPBACK_REQUIRED', value);
  }
  const port = Number(endpoint.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    fail('BROWSER_QA_CDP_ENDPOINT_PORT_INVALID', endpoint.port);
  }
  return Object.freeze({
    origin: `http://127.0.0.1:${port}`,
    host: '127.0.0.1',
    port,
  });
}

function normalizeInstallation(id, rawInstallation) {
  const installation = requireRecord(
    rawInstallation,
    `BROWSER_QA_INSTALLATION_INVALID:${id}`,
  );
  rejectUnknownKeys(
    installation,
    INSTALLATION_KEYS,
    `BROWSER_QA_INSTALLATION_KEY_UNKNOWN:${id}`,
  );
  const source = installation.source || 'path';
  requireEnum(source, INSTALLATION_SOURCES, `BROWSER_QA_INSTALLATION_SOURCE_INVALID:${id}`);
  if (source === 'playwright') {
    if (
      installation.executable !== undefined
      || installation.platform !== 'runtime'
      || installation.distribution !== 'playwright_chromium'
    ) {
      fail('BROWSER_QA_PLAYWRIGHT_INSTALLATION_CONTRACT_INVALID', id);
    }
    return Object.freeze({
      id,
      source,
      executable: null,
      platform: 'runtime',
      distribution: 'playwright_chromium',
    });
  }
  const platform = requireEnum(
    installation.platform,
    new Set(['linux', 'windows_via_wsl', 'windows']),
    `BROWSER_QA_INSTALLATION_PLATFORM_INVALID:${id}`,
  );
  const executable = requireAbsolutePath(
    installation.executable,
    `BROWSER_QA_INSTALLATION_EXECUTABLE_ABSOLUTE_REQUIRED:${id}`,
    platform,
  );
  const distribution = requireEnum(
    installation.distribution,
    INSTALLATION_DISTRIBUTIONS,
    `BROWSER_QA_INSTALLATION_DISTRIBUTION_INVALID:${id}`,
  );
  if (
    platform === 'windows_via_wsl'
    && (!/^\/mnt\/[a-z]\//iu.test(executable) || !/\.exe$/iu.test(executable))
  ) {
    fail('BROWSER_QA_WINDOWS_WSL_EXECUTABLE_INVALID', id);
  }
  if (platform === 'windows' && (!path.win32.isAbsolute(executable) || !/\.exe$/iu.test(executable))) {
    fail('BROWSER_QA_WINDOWS_NATIVE_EXECUTABLE_INVALID', id);
  }
  if (platform === 'linux' && /\.exe$/iu.test(executable)) {
    fail('BROWSER_QA_LINUX_EXECUTABLE_INVALID', id);
  }
  return Object.freeze({
    id,
    source,
    executable,
    platform,
    distribution,
  });
}

function normalizeProfileSlot(id, rawProfileSlot, installations) {
  const profileSlot = requireRecord(
    rawProfileSlot,
    `BROWSER_QA_PROFILE_SLOT_INVALID:${id}`,
  );
  rejectUnknownKeys(
    profileSlot,
    PROFILE_SLOT_KEYS,
    `BROWSER_QA_PROFILE_SLOT_KEY_UNKNOWN:${id}`,
  );
  const installationId = requireResourceId(
    profileSlot.installationId,
    `BROWSER_QA_PROFILE_SLOT_INSTALLATION_ID_INVALID:${id}`,
  );
  const installation = installations[installationId];
  if (!installation) {
    fail('BROWSER_QA_PROFILE_SLOT_INSTALLATION_UNKNOWN', `${id}:${installationId}`);
  }
  if (installation.source !== 'path') {
    fail('BROWSER_QA_PERSISTENT_INSTALLATION_PATH_REQUIRED', `${id}:${installationId}`);
  }
  const userDataDir = requireAbsolutePath(
    profileSlot.userDataDir,
    `BROWSER_QA_PROFILE_SLOT_USER_DATA_DIR_ABSOLUTE_REQUIRED:${id}`,
    installation.platform,
  );
  if (
    installation.platform === 'windows_via_wsl'
    && !/^\/mnt\/[a-z]\//iu.test(userDataDir)
  ) {
    fail('BROWSER_QA_WINDOWS_WSL_PROFILE_DRIVE_PATH_REQUIRED', id);
  }
  const profileDirectory = typeof profileSlot.profileDirectory === 'string'
    ? profileSlot.profileDirectory
    : '';
  if (
    !profileDirectory
    || profileDirectory !== profileDirectory.trim()
    || profileDirectory === '.'
    || profileDirectory === '..'
    || /[\\/\r\n]/u.test(profileDirectory)
  ) {
    fail('BROWSER_QA_PROFILE_DIRECTORY_INVALID', id);
  }
  const cdp = normalizeLoopbackCdpEndpoint(profileSlot.cdpEndpoint);
  const lifecyclePolicy = requireEnum(
    profileSlot.lifecyclePolicy,
    LIFECYCLE_POLICIES,
    `BROWSER_QA_PROFILE_LIFECYCLE_POLICY_INVALID:${id}`,
  );
  const focusPolicy = profileSlot.focusPolicy || 'never';
  requireEnum(focusPolicy, FOCUS_POLICIES, `BROWSER_QA_PROFILE_FOCUS_POLICY_INVALID:${id}`);
  if (lifecyclePolicy === 'managed' && focusPolicy !== 'never') {
    fail('BROWSER_QA_MANAGED_PROFILE_FOCUS_POLICY_NEVER_REQUIRED', id);
  }
  const launchAudioPolicy = profileSlot.launchAudioPolicy || 'muted';
  requireEnum(
    launchAudioPolicy,
    AUDIO_POLICIES,
    `BROWSER_QA_PROFILE_AUDIO_POLICY_INVALID:${id}`,
  );
  return Object.freeze({
    id,
    installationId,
    installation,
    userDataDir,
    profileDirectory,
    cdpEndpoint: cdp.origin,
    cdp,
    lifecyclePolicy,
    profileOwnershipPolicy: lifecyclePolicy === 'managed'
      ? BROWSER_PROFILE_OWNERSHIP_POLICIES.DEDICATED_ADAPTER_PROOF_REQUIRED
      : BROWSER_PROFILE_OWNERSHIP_POLICIES.EXTERNAL_OPERATOR,
    focusPolicy,
    launchAudioPolicy,
  });
}

export function normalizeBrowserResourceRegistry(rawRegistry = {}) {
  const registry = requireRecord(rawRegistry, 'BROWSER_QA_RESOURCE_REGISTRY_INVALID');
  rejectUnknownKeys(registry, REGISTRY_KEYS, 'BROWSER_QA_RESOURCE_REGISTRY_KEY_UNKNOWN');
  const rawInstallations = registry.installations || {};
  const rawProfileSlots = registry.profileSlots || {};
  requireRecord(rawInstallations, 'BROWSER_QA_INSTALLATIONS_INVALID');
  requireRecord(rawProfileSlots, 'BROWSER_QA_PROFILE_SLOTS_INVALID');

  const installations = Object.freeze(Object.fromEntries(
    Object.entries(rawInstallations).map(([id, installation]) => {
      requireResourceId(id, 'BROWSER_QA_INSTALLATION_ID_INVALID');
      return [id, normalizeInstallation(id, installation)];
    }),
  ));
  const profileSlots = Object.freeze(Object.fromEntries(
    Object.entries(rawProfileSlots).map(([id, profileSlot]) => {
      requireResourceId(id, 'BROWSER_QA_PROFILE_SLOT_ID_INVALID');
      return [id, normalizeProfileSlot(id, profileSlot, installations)];
    }),
  ));
  return Object.freeze({
    contractVersion: BROWSER_RESOURCE_REGISTRY_CONTRACT_VERSION,
    installations,
    profileSlots,
  });
}

export function resolveBrowserInstallation(registry, installationId) {
  const normalizedId = requireResourceId(
    installationId,
    'BROWSER_QA_INSTALLATION_ID_INVALID',
  );
  const installation = registry?.installations?.[normalizedId];
  if (!installation) fail('BROWSER_QA_INSTALLATION_UNKNOWN', normalizedId);
  return installation;
}

export function resolveBrowserProfileSlot(registry, profileSlotId) {
  const normalizedId = requireResourceId(
    profileSlotId,
    'BROWSER_QA_PROFILE_SLOT_ID_INVALID',
  );
  const profileSlot = registry?.profileSlots?.[normalizedId];
  if (!profileSlot) fail('BROWSER_QA_PROFILE_SLOT_UNKNOWN', normalizedId);
  return profileSlot;
}
