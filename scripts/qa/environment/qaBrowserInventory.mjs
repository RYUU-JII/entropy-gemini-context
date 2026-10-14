import { inferBrowserQaPlatform } from '../../browser-qa/browser/windowsPlatform.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  resolveQaBrowserEpoch,
} from '../resources/QaBrowserTargetLease.mjs';
import {
  verifyQaPersistentBrowserIdentity,
} from '../browser/qaPersistentBrowserLifecycle.mjs';
import {
  inspectQaBrowserBroker,
  readQaBrowserBrokerObservation,
} from '../resources/QaBrowserBroker.mjs';
import {
  DEFAULT_QA_LOCAL_CONFIG_RELATIVE_PATH,
  loadQaConfigForRoot,
} from '../runtime/QaRunCompiler.mjs';
import {
  listQaBrowserEnvironments,
  resolveQaBrowserEnvironment,
} from './qaLocalConfig.mjs';
import {
  resolveBrowserProfileSlot,
} from '../../browser-qa/lifecycle/browserResourceRegistry.mjs';
import {
  inspectQaEnvironment,
} from './qaDoctor.mjs';

const KNOWN_BROWSER_PATHS = Object.freeze(process.platform === 'win32' ? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
] : [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
  '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
]);

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

async function fileStatus(filePath) {
  const stat = await fs.stat(filePath).catch(() => null);
  return stat?.isFile() ? 'available' : 'missing';
}

function classifyBrowserPath(browserPath) {
  const normalized = browserPath.toLowerCase();
  const platform = inferBrowserQaPlatform(browserPath);
  let distribution = 'chromium_compatible';
  if (normalized.includes('chrome-for-testing')) distribution = 'chrome_for_testing';
  else if (normalized.includes('ms-playwright')) distribution = 'playwright_chromium';
  else if (normalized.includes('google') || normalized.includes('chrome')) {
    distribution = 'google_chrome';
  } else if (normalized.includes('chromium')) {
    distribution = 'chromium';
  }
  return Object.freeze({ platform, distribution });
}

async function resolvePlaywrightChromiumExecutable() {
  try {
    const { chromium } = await import('playwright');
    return chromium.executablePath();
  } catch {
    return null;
  }
}

async function loadInventoryConfig({
  rootDir,
  configPath = null,
  requireConfig = false,
} = {}) {
  const resolvedConfigPath = configPath || path.join(
    rootDir,
    DEFAULT_QA_LOCAL_CONFIG_RELATIVE_PATH,
  );
  return Object.freeze({
    configPath: path.normalize(resolvedConfigPath),
    config: await loadQaConfigForRoot({
      rootDir,
      configPath: path.normalize(resolvedConfigPath),
      requireExisting: requireConfig,
    }),
  });
}

async function resolveEffectiveEnvironment(environment, {
  playwrightExecutableResolver = resolvePlaywrightChromiumExecutable,
} = {}) {
  if (!environment || environment.chrome || environment.processOwnership !== 'owned') {
    return environment;
  }
  const chrome = await playwrightExecutableResolver();
  return Object.freeze({
    ...environment,
    chrome,
    executableSource: chrome ? 'playwright_default' : 'unresolved',
  });
}

function addInstallationCandidate(candidates, browserPath, source, {
  environmentId = null,
  installationId = null,
  platform = null,
  distribution = null,
} = {}) {
  if (typeof browserPath !== 'string' || !path.isAbsolute(browserPath)) return;
  const normalizedPath = path.normalize(browserPath);
  const existing = candidates.get(normalizedPath) || {
    path: normalizedPath,
    sources: new Set(),
    environmentIds: new Set(),
    installationIds: new Set(),
    platform: null,
    distribution: null,
  };
  existing.sources.add(source);
  if (environmentId) existing.environmentIds.add(environmentId);
  if (installationId) existing.installationIds.add(installationId);
  if (platform) {
    if (existing.platform && existing.platform !== platform) {
      fail('QA_BROWSER_INSTALLATION_PLATFORM_CONFLICT', normalizedPath);
    }
    existing.platform = platform;
  }
  if (distribution) {
    if (existing.distribution && existing.distribution !== distribution) {
      fail('QA_BROWSER_INSTALLATION_DISTRIBUTION_CONFLICT', normalizedPath);
    }
    existing.distribution = distribution;
  }
  candidates.set(normalizedPath, existing);
}

export async function readQaBrowserInventory({
  rootDir,
  configPath = null,
  requireConfig = false,
  playwrightExecutableResolver = resolvePlaywrightChromiumExecutable,
  environment = process.env,
} = {}) {
  if (!path.isAbsolute(rootDir || '')) fail('QA_RUN_ROOT_ABSOLUTE_REQUIRED');
  const loaded = await loadInventoryConfig({ rootDir, configPath, requireConfig });
  const declaredEnvironments = listQaBrowserEnvironments(loaded.config);
  const candidates = new Map();
  declaredEnvironments.forEach((entry) => {
    addInstallationCandidate(candidates, entry.chrome, 'qa_environment', {
      environmentId: entry.id,
      installationId: entry.installationId,
    });
  });
  Object.values(loaded.config.browserResources?.installations || {})
    .filter((installation) => installation.source === 'path')
    .forEach((installation) => {
      addInstallationCandidate(
        candidates,
        installation.executable,
        'browser_resource_registry',
        {
          installationId: installation.id,
          platform: installation.platform,
          distribution: installation.distribution,
        },
      );
    });
  addInstallationCandidate(candidates, environment.CHROME_BIN, 'CHROME_BIN');
  addInstallationCandidate(
    candidates,
    environment.GOOGLE_CHROME_BIN,
    'GOOGLE_CHROME_BIN',
  );
  const playwrightExecutable = await playwrightExecutableResolver();
  addInstallationCandidate(
    candidates,
    playwrightExecutable,
    'playwright_default',
    { installationId: 'playwright_chromium' },
  );
  KNOWN_BROWSER_PATHS.forEach((browserPath) => {
    addInstallationCandidate(candidates, browserPath, 'known_system_path');
  });

  const installations = await Promise.all([...candidates.values()].map(async (entry) => (
    Object.freeze({
      path: entry.path,
      ...classifyBrowserPath(entry.path),
      ...(entry.platform ? { platform: entry.platform } : {}),
      ...(entry.distribution ? { distribution: entry.distribution } : {}),
      status: await fileStatus(entry.path),
      sources: Object.freeze([...entry.sources].sort()),
      environmentIds: Object.freeze([...entry.environmentIds].sort()),
      installationIds: Object.freeze([...entry.installationIds].sort()),
    })
  )));
  const environments = await Promise.all(declaredEnvironments.map(async (entry) => {
    const effective = await resolveEffectiveEnvironment(entry, {
      playwrightExecutableResolver: async () => playwrightExecutable,
    });
    const [brokerOwner, brokerObservation] = await Promise.all([
      inspectQaBrowserBroker({ rootDir, environment: effective }),
      readQaBrowserBrokerObservation({ rootDir, environment: effective }),
    ]);
    return Object.freeze({
      id: effective.id,
      browserClass: effective.browserClass,
      processOwnership: effective.processOwnership,
      lifecyclePolicy: effective.lifecyclePolicy,
      installationId: effective.installationId,
      profileSlotId: effective.profileSlotId,
      chrome: effective.chrome,
      executableSource: effective.executableSource
        || (entry.chrome ? 'qa_environment' : null),
      profile: effective.profile,
      profileDirectory: effective.profileDirectory,
      cdpEndpoint: effective.cdpEndpoint,
      focusPolicy: effective.focusPolicy,
      audioPolicy: effective.audioPolicy,
      broker: Object.freeze({
        status: brokerOwner ? 'leased' : 'available',
        owner: brokerOwner,
        observation: brokerObservation,
      }),
    });
  }));
  return Object.freeze({
    contractVersion: 1,
    configPath: loaded.configPath,
    environments: Object.freeze(environments),
    installations: Object.freeze(installations.sort((left, right) => (
      left.path.localeCompare(right.path)
    ))),
  });
}

async function probeCdpRuntime(endpoint, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 2_000,
} = {}) {
  if (!endpoint) return null;
  const request = async (pathname) => {
    const response = await fetchImpl(new URL(pathname, endpoint), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`${pathname}:${response.status}`);
    return response.json();
  };
  try {
    const [version, targets] = await Promise.all([
      request('/json/version'),
      request('/json/list'),
    ]);
    if (
      typeof version?.Browser !== 'string'
      || typeof version?.webSocketDebuggerUrl !== 'string'
      || !Array.isArray(targets)
    ) {
      fail('QA_BROWSER_CDP_INVENTORY_CONTRACT_INVALID');
    }
    const pageTargets = targets.filter((target) => target?.type === 'page');
    return Object.freeze({
      status: 'ready',
      browser: version.Browser,
      protocolVersion: version['Protocol-Version'] || null,
      browserEpoch: resolveQaBrowserEpoch(version),
      targetCounts: Object.freeze({
        total: targets.length,
        page: pageTargets.length,
        aboutBlank: pageTargets.filter((target) => target?.url === 'about:blank').length,
      }),
    });
  } catch (error) {
    return Object.freeze({
      status: 'unavailable',
      error: error?.message || String(error),
    });
  }
}

function resolveNextAction(environment, inspection, runtime = null, broker = null) {
  if (broker?.status === 'leased') {
    return 'wait_for_browser_broker';
  }
  if (runtime?.status === 'unavailable') {
    return environment.lifecyclePolicy === 'managed'
      ? 'start_managed_browser'
      : 'start_or_reconnect_declared_qa_chrome';
  }
  if (
    runtime?.status === 'ready'
    && runtime.identity?.status !== 'declared_identity_verified'
  ) {
    return 'repair_declared_browser_identity';
  }
  if (inspection.status === 'ready') {
    return environment.processOwnership === 'attach_only'
      ? 'attach_to_declared_cdp'
      : 'lease_then_launch_on_run';
  }
  if (inspection.failures.includes('cdp_unavailable')) {
    return environment.lifecyclePolicy === 'managed'
      ? 'start_managed_browser'
      : 'start_or_reconnect_declared_qa_chrome';
  }
  if (inspection.failures.includes('chrome_unavailable')) {
    return 'repair_declared_chrome_path';
  }
  if (inspection.failures.includes('profile_unavailable')) {
    return 'repair_declared_profile_path';
  }
  if (inspection.failures.includes('dedicated_profile_ownership_unverified')) {
    return 'verify_dedicated_profile_ownership';
  }
  if (inspection.failures.includes('extension_slot_unavailable')) {
    return 'stage_declared_extension_slot';
  }
  return 'inspect_environment_contract';
}

export async function readQaBrowserStatus({
  rootDir,
  environmentId,
  configPath = null,
  requireConfig = false,
  playwrightExecutableResolver = resolvePlaywrightChromiumExecutable,
  fetchImpl = globalThis.fetch,
  timeoutMs = 2_000,
  identityVerifier = verifyQaPersistentBrowserIdentity,
} = {}) {
  if (!path.isAbsolute(rootDir || '')) fail('QA_RUN_ROOT_ABSOLUTE_REQUIRED');
  const loaded = await loadInventoryConfig({ rootDir, configPath, requireConfig });
  const declaredEnvironment = resolveQaBrowserEnvironment(
    environmentId,
    loaded.config,
    { required: false },
  );
  if (!declaredEnvironment) fail('QA_BROWSER_ENVIRONMENT_UNKNOWN', environmentId);
  const effectiveEnvironment = await resolveEffectiveEnvironment(
    declaredEnvironment,
    { playwrightExecutableResolver },
  );
  const [brokerOwner, brokerObservation] = await Promise.all([
    inspectQaBrowserBroker({ rootDir, environment: effectiveEnvironment }),
    readQaBrowserBrokerObservation({ rootDir, environment: effectiveEnvironment }),
  ]);
  const broker = Object.freeze({
    status: brokerOwner ? 'leased' : 'available',
    owner: brokerOwner,
    observation: brokerObservation,
  });
  const inspectedEnvironment = await inspectQaEnvironment(effectiveEnvironment, {
    fetchImpl,
    timeoutMs,
    cdpProbe: broker.status !== 'leased',
  });
  const executableUnavailable = effectiveEnvironment.processOwnership === 'owned'
    && !effectiveEnvironment.chrome;
  const inspection = executableUnavailable
    ? Object.freeze({
      ...inspectedEnvironment,
      status: 'blocked',
      checks: Object.freeze({
        ...inspectedEnvironment.checks,
        chrome: 'missing',
      }),
      failures: Object.freeze([
        ...new Set([...inspectedEnvironment.failures, 'chrome_unavailable']),
      ]),
    })
    : inspectedEnvironment;
  let runtime = inspection.checks?.cdp?.status === 'ready'
    ? await probeCdpRuntime(effectiveEnvironment.cdpEndpoint, { fetchImpl, timeoutMs })
    : null;
  if (
    runtime?.status === 'ready'
    && effectiveEnvironment.profileSlotId
  ) {
    const profileSlot = resolveBrowserProfileSlot(
      loaded.config.browserResources,
      effectiveEnvironment.profileSlotId,
    );
    let identity;
    try {
      identity = await identityVerifier({ rootDir, profileSlot });
    } catch (error) {
      identity = Object.freeze({
        status: 'unclassified',
        reason: error?.code || error?.message || String(error),
      });
    }
    runtime = Object.freeze({ ...runtime, identity });
  }
  const identityReady = !effectiveEnvironment.profileSlotId
    || runtime?.identity?.status === 'declared_identity_verified';
  return Object.freeze({
    contractVersion: 1,
    configPath: loaded.configPath,
    environmentId: effectiveEnvironment.id,
    status: broker.status === 'leased'
      ? 'BUSY'
      : inspection.status === 'ready'
        && (!runtime || runtime.status === 'ready')
        && identityReady
        ? 'READY'
        : 'BLOCKED',
    environment: Object.freeze({
      browserClass: effectiveEnvironment.browserClass,
      processOwnership: effectiveEnvironment.processOwnership,
      lifecyclePolicy: effectiveEnvironment.lifecyclePolicy,
      installationId: effectiveEnvironment.installationId,
      profileSlotId: effectiveEnvironment.profileSlotId,
      chrome: effectiveEnvironment.chrome,
      profile: effectiveEnvironment.profile,
      profileDirectory: effectiveEnvironment.profileDirectory,
      cdpEndpoint: effectiveEnvironment.cdpEndpoint,
      focusPolicy: effectiveEnvironment.focusPolicy,
      audioPolicy: effectiveEnvironment.audioPolicy,
    }),
    inspection,
    runtime,
    broker,
    nextAction: resolveNextAction(effectiveEnvironment, inspection, runtime, broker),
  });
}
