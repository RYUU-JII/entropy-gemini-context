import { inferBrowserQaPlatform } from '../browser-qa/browser/windowsPlatform.mjs';
import { registerQaChildAbortCleanup } from '../qa/runtime/qaChildAbortRegistry.mjs';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  CdpConnection as BrowserQaCdpConnection,
  DEFAULT_BROWSER_QA_CDP_OPEN_TIMEOUT_MS,
} from '../browser-qa/cdp/CdpConnection.mjs';
import {
  projectBrowserExecutionContract,
} from '../browser-qa/contracts/browserExecutionContract.mjs';
import {
  hasChromiumHarnessManifestPromotion,
  normalizeChromiumHarnessTemporaryManifest,
  promoteManifestForChromiumHarness,
} from './chromiumHarnessManifestPromotion.mjs';
import {
  removeHarnessTempRoot,
} from './chromiumHarnessTempCleanup.mjs';
import {
  acquireQaBrowserCapacity,
} from '../browser-qa/resources/BrowserCapacityLease.mjs';
import {
  resolveBrowserQaPhysicalResourceIdentities,
} from '../browser-qa/resources/browserResourceScope.mjs';
import {
  verifyAttachedBrowserIdentity,
} from '../browser-qa/browser/attachedBrowserIdentity.mjs';
import {
  resolveQaChromiumGraphicsLaunch,
} from '../browser-qa/browser/chromiumGraphicsArguments.mjs';
import {
  requireQaChromiumGpuInfoCollectionPolicy,
  resolveQaChromiumGpuInfoCollectionLaunch,
} from '../browser-qa/browser/chromiumGpuInfoCollectionArguments.mjs';
import {
  QaBrowserTargetLease,
  resolveQaBrowserEpoch,
} from '../qa/resources/QaBrowserTargetLease.mjs';
import {
  probeQaBrowserGpuCapability,
} from '../qa/environment/qaGpuCapability.mjs';
import {
  closeQaCdpTarget,
  createQaCdpPageTarget,
  listQaCdpTargets,
} from '../qa/browser/qaCdpTargetOwner.mjs';
import {
  launchQaOwnedChromiumProcess,
  readQaOwnedChromiumRecoveryIdentity,
  terminateQaOwnedChromiumProcess,
  verifyQaOwnedChromiumEndpointIdentity,
} from '../qa/browser/qaChromiumProcessOwner.mjs';
import {
  validateEntropyQaProfile,
} from '../qa/profile/entropyQaProfileMarker.mjs';
import {
  defineEntropyQaArtifactContentIdentity,
  readEntropyQaArtifactActivationReceipt,
  stageEntropyQaArtifact,
  writeEntropyQaArtifactActivationReceipt,
} from './qaProfileArtifactSlot.mjs';
import {
  ensureManagedAttachedExtensionSlot,
  normalizeBrowserExtensionPath,
} from './internal/managedAttachedExtensionSlot.mjs';

export {
  ENTROPY_QA_PROFILE_MARKER,
  readEntropyQaProfileMarker,
  validateEntropyQaProfile,
} from '../qa/profile/entropyQaProfileMarker.mjs';

const DEFAULT_TRUSTED_PAGE_PATH = 'entropy-e2e.html';
const DEFAULT_TRUSTED_PAGE_SOURCE = '<!doctype html><meta charset="utf-8"><title>Entropy MV3 E2E</title>';
const SERVICE_WORKER_PATH = 'service-worker-loader.js';
const DEFAULT_CDP_COMMAND_TIMEOUT_MS = 20_000;
const DEFAULT_CDP_OPEN_TIMEOUT_MS = DEFAULT_BROWSER_QA_CDP_OPEN_TIMEOUT_MS;
const WINDOWS_PATH_CONVERSION_TIMEOUT_MS = 5_000;
const BROWSER_CLOSE_TIMEOUT_MS = 2_000;
const COMMAND_LINE_EXTENSION_DISCOVERY_TIMEOUT_MS = 1_500;
const CDP_EXTENSION_ACTIVATION_TIMEOUT_MS = 3_000;
const DEFAULT_TRUSTED_PAGE_OPEN_TIMEOUT_MS = 30_000;
const EXACT_BLANK_PAGE_URL = 'about:blank';
const QA_RECOVERY_TARGET_MARKER_PROPERTY = '__entropyQaRecoveryTargetNonceV1';
const execFileAsync = promisify(execFile);


function normalizeOptionalDeadlineAtMs(value, errorCode) {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${errorCode}:${value}`);
  }
  return value;
}

function normalizeQaRecoveryJournal(journal) {
  if (journal === null || journal === undefined) return null;
  const methods = [
    'recordBrowser',
    'recordOwnedProcess',
    'reserveTarget',
    'admitTarget',
    'releaseTarget',
  ];
  if (
    !journal
    || typeof journal !== 'object'
    || methods.some((method) => typeof journal[method] !== 'function')
  ) {
    throw new Error('CHROMIUM_HARNESS_RECOVERY_JOURNAL_INVALID');
  }
  return journal;
}

function buildQaRecoveryTargetMarkerSource(reservation) {
  if (
    reservation?.markerProperty !== QA_RECOVERY_TARGET_MARKER_PROPERTY
    || typeof reservation.targetNonce !== 'string'
    || !reservation.targetNonce
  ) {
    throw new Error('CHROMIUM_HARNESS_RECOVERY_TARGET_RESERVATION_INVALID');
  }
  return `(() => {
    const key = ${JSON.stringify(reservation.markerProperty)};
    const nonce = ${JSON.stringify(reservation.targetNonce)};
    const current = globalThis[key];
    if (current !== undefined && current !== nonce) {
      throw new Error('QA_RECOVERY_TARGET_MARKER_CONFLICT');
    }
    if (current === undefined) {
      Object.defineProperty(globalThis, key, {
        value: nonce,
        writable: false,
        configurable: false,
        enumerable: false,
      });
    }
    return globalThis[key];
  })()`;
}

function requireRemainingDeadlineMs(deadlineAtMs, errorCode) {
  const remainingMs = deadlineAtMs - Date.now();
  if (remainingMs <= 0) throw new Error(errorCode);
  return remainingMs;
}

function renderingRequirementFromBrowserExecution(browserExecution) {
  return browserExecution.gpuRequirement === 'hardware_active_required'
    ? 'physical_gpu_required'
    : 'headless_ok';
}

function normalizeHarnessBrowserExecution(browserExecution, {
  attachOnly,
  headless,
  extensionEnabled,
  audioPolicy,
  renderingRequirement,
}) {
  if (browserExecution === null || browserExecution === undefined) return null;
  const contract = projectBrowserExecutionContract(browserExecution);
  const expectedOwnership = attachOnly ? 'attach_only' : 'owned';
  if (contract.processOwnership !== expectedOwnership) {
    throw new Error('CHROMIUM_HARNESS_BROWSER_EXECUTION_OWNERSHIP_MISMATCH');
  }
  if (contract.headless !== (attachOnly ? null : !!headless)) {
    throw new Error('CHROMIUM_HARNESS_BROWSER_EXECUTION_HEADLESS_MISMATCH');
  }
  const expectedExtensionRuntime = extensionEnabled ? 'required' : 'none';
  if (contract.extensionRuntime !== expectedExtensionRuntime) {
    throw new Error('CHROMIUM_HARNESS_BROWSER_EXECUTION_EXTENSION_MISMATCH');
  }
  if (audioPolicy !== null && audioPolicy !== contract.audioPolicy) {
    throw new Error('CHROMIUM_HARNESS_BROWSER_EXECUTION_AUDIO_MISMATCH');
  }
  if (renderingRequirement !== null) {
    const actualGpuRequirement = renderingRequirement === 'physical_gpu_required'
      ? 'hardware_active_required'
      : 'software_or_unclassified_allowed';
    if (
      actualGpuRequirement !== contract.gpuRequirement
      || (
        renderingRequirement === 'headed_required'
        && contract.processOwnership === 'owned'
        && contract.headless !== false
      )
    ) {
      throw new Error('CHROMIUM_HARNESS_BROWSER_EXECUTION_RENDERING_MISMATCH');
    }
  }
  return contract;
}

export { removeHarnessTempRoot };
export { promoteManifestForChromiumHarness };

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
}

export function isWslWindowsChromeExecutable(
  chromePath,
  { platform = process.platform } = {},
) {
  if (platform !== 'linux' || typeof chromePath !== 'string') return false;
  const normalized = path.posix.normalize(chromePath);
  return /^\/mnt\/[a-z]\//iu.test(normalized) && /\.exe$/iu.test(normalized);
}

export function isWindowsChromeExecutable(chromePath, { platform = process.platform } = {}) {
  return platform === 'win32'
    ? typeof chromePath === 'string' && path.win32.isAbsolute(chromePath) && /\.exe$/iu.test(chromePath)
    : isWslWindowsChromeExecutable(chromePath, { platform });
}

function isLoopbackHostname(hostname) {
  return ['127.0.0.1', 'localhost', '[::1]'].includes(
    String(hostname || '').toLowerCase(),
  );
}

export function normalizeChromiumHarnessCdpEndpoint(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new Error('CHROMIUM_HARNESS_CDP_ENDPOINT_INVALID');
  }
  let endpoint;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error(`CHROMIUM_HARNESS_CDP_ENDPOINT_INVALID:${value}`);
  }
  if (
    endpoint.protocol !== 'http:'
    || !endpoint.port
    || endpoint.pathname !== '/'
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
  ) {
    throw new Error(`CHROMIUM_HARNESS_CDP_ENDPOINT_INVALID:${value}`);
  }
  if (!isLoopbackHostname(endpoint.hostname)) {
    throw new Error(
      `CHROMIUM_HARNESS_CDP_ENDPOINT_LOOPBACK_REQUIRED:${endpoint.hostname}`,
    );
  }
  const port = Number(endpoint.port);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`CHROMIUM_HARNESS_CDP_ENDPOINT_INVALID:${value}`);
  }
  return endpoint.origin;
}

function normalizeHarnessIdentityPath(value, errorCode) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(errorCode);
  const portable = value.trim().replaceAll('\\', '/');
  const wsl = portable.match(/^\/mnt\/([a-z])\/(.*)$/iu);
  if (wsl) return `${wsl[1].toLowerCase()}:/${wsl[2]}`.toLowerCase();
  if (/^[a-z]:\//iu.test(portable)) {
    return path.win32.normalize(portable).replaceAll('\\', '/').toLowerCase();
  }
  if (!path.isAbsolute(portable)) throw new Error(errorCode);
  return path.normalize(portable);
}

function defineHarnessAttachedBrowserIdentity({
  chromePath,
  cdpEndpoint,
  qaProfileDir,
  qaProfileDirectory,
  expectedBrowserIdentity = null,
}) {
  const platform = inferBrowserQaPlatform(chromePath);
  const declared = Object.freeze({
    installationId: expectedBrowserIdentity?.installationId || null,
    executable: chromePath,
    platform,
    profileSlotId: expectedBrowserIdentity?.profileSlotId || null,
    userDataDir: qaProfileDir,
    profileDirectory: qaProfileDirectory,
    cdpEndpoint,
  });
  if (!expectedBrowserIdentity) return declared;
  const expected = {
    executable: expectedBrowserIdentity.executable ?? expectedBrowserIdentity.chrome,
    platform: expectedBrowserIdentity.platform,
    userDataDir: expectedBrowserIdentity.userDataDir ?? expectedBrowserIdentity.profile,
    profileDirectory: expectedBrowserIdentity.profileDirectory,
    cdpEndpoint: normalizeChromiumHarnessCdpEndpoint(
      expectedBrowserIdentity.cdpEndpoint,
    ),
  };
  if (
    expected.platform !== declared.platform
    || normalizeHarnessIdentityPath(
      expected.executable,
      'CHROMIUM_HARNESS_ATTACH_EXPECTED_EXECUTABLE_INVALID',
    ) !== normalizeHarnessIdentityPath(
      declared.executable,
      'CHROMIUM_HARNESS_ATTACH_EXECUTABLE_INVALID',
    )
    || normalizeHarnessIdentityPath(
      expected.userDataDir,
      'CHROMIUM_HARNESS_ATTACH_EXPECTED_PROFILE_INVALID',
    ) !== normalizeHarnessIdentityPath(
      declared.userDataDir,
      'CHROMIUM_HARNESS_ATTACH_PROFILE_INVALID',
    )
    || expected.profileDirectory !== declared.profileDirectory
    || expected.cdpEndpoint !== declared.cdpEndpoint
  ) {
    throw new Error('CHROMIUM_HARNESS_ATTACH_EXPECTED_IDENTITY_MISMATCH');
  }
  return Object.freeze({
    ...declared,
    installationId: expectedBrowserIdentity.installationId || null,
    profileSlotId: expectedBrowserIdentity.profileSlotId || null,
  });
}

export async function verifyExtensionHarnessAttachedBrowser(cdp, {
  cdpEndpoint,
  expectedBrowserIdentity,
  osIdentityVerifier = null,
} = {}) {
  const identity = await verifyAttachedBrowserIdentity(cdp, {
    cdpEndpoint,
    expectedBrowserIdentity,
    ...(osIdentityVerifier ? { osIdentityVerifier } : {}),
  });
  if (identity.status !== 'declared_identity_verified') {
    throw new Error('CHROMIUM_HARNESS_ATTACH_IDENTITY_UNVERIFIED');
  }
  return identity;
}

function isWslWindowsDrivePath(targetPath) {
  return typeof targetPath === 'string'
    && /^\/mnt\/[a-z]\//iu.test(path.posix.normalize(targetPath));
}

async function resolveWslWindowsUserTempParent(chromePath) {
  const driveMount = path.normalize(chromePath).match(/^\/mnt\/[a-z]/iu)?.[0];
  if (!driveMount) {
    throw new Error(`CHROMIUM_HARNESS_WSL_WINDOWS_DRIVE_UNRESOLVED:${chromePath}`);
  }
  const powershellPath = path.join(
    driveMount,
    'Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  let windowsTempPath;
  try {
    const { stdout } = await execFileAsync(powershellPath, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '[IO.Path]::GetTempPath()',
    ], {
      encoding: 'utf8',
      timeout: WINDOWS_PATH_CONVERSION_TIMEOUT_MS,
      maxBuffer: 16 * 1024,
    });
    windowsTempPath = String(stdout || '').trim();
  } catch (error) {
    throw new Error(
      `CHROMIUM_HARNESS_WSL_WINDOWS_TEMP_QUERY_FAILED:${error?.message || error}`,
    );
  }
  if (!/^[a-z]:\\/iu.test(windowsTempPath) || /[\r\n]/u.test(windowsTempPath)) {
    throw new Error('CHROMIUM_HARNESS_WSL_WINDOWS_TEMP_QUERY_INVALID');
  }

  let wslTempPath;
  try {
    const { stdout } = await execFileAsync('wslpath', ['-u', '--', windowsTempPath], {
      encoding: 'utf8',
      timeout: WINDOWS_PATH_CONVERSION_TIMEOUT_MS,
      maxBuffer: 16 * 1024,
    });
    wslTempPath = path.normalize(String(stdout || '').trim());
  } catch (error) {
    throw new Error(
      `CHROMIUM_HARNESS_WSL_WINDOWS_TEMP_CONVERSION_FAILED:${error?.message || error}`,
    );
  }
  if (!isWslWindowsDrivePath(wslTempPath) || /[\r\n]/u.test(wslTempPath)) {
    throw new Error('CHROMIUM_HARNESS_WSL_WINDOWS_TEMP_CONVERSION_INVALID');
  }
  return wslTempPath;
}

export async function resolveChromiumHarnessTempParent(
  chromePath,
  {
    platform = process.platform,
    nativeTempParent = os.tmpdir(),
    resolveWindowsTempParent = resolveWslWindowsUserTempParent,
  } = {},
) {
  if (!isWslWindowsChromeExecutable(chromePath, { platform })) return nativeTempParent;
  return resolveWindowsTempParent(chromePath);
}

async function convertWslPathToWindows(targetPath) {
  let stdout;
  try {
    ({ stdout } = await execFileAsync('wslpath', ['-w', '--', targetPath], {
      encoding: 'utf8',
      timeout: WINDOWS_PATH_CONVERSION_TIMEOUT_MS,
      maxBuffer: 16 * 1024,
    }));
  } catch (error) {
    throw new Error(
      `CHROMIUM_HARNESS_WSL_PATH_CONVERSION_FAILED:${targetPath}:${error?.message || error}`,
    );
  }
  const converted = String(stdout || '').trim();
  if (!/^(?:[a-z]:\\|\\\\)/iu.test(converted) || /[\r\n]/u.test(converted)) {
    throw new Error(`CHROMIUM_HARNESS_WSL_PATH_CONVERSION_INVALID:${targetPath}`);
  }
  return converted;
}

export async function createChromeLaunchSpec({
  chromePath,
  userDataDir,
  profileDirectory = null,
  extensionDir,
  extensionEnabled = true,
  remoteDebuggingPort,
  headless,
  audioPolicy = 'muted',
  browserExecution = null,
  displayReceipt = null,
  gpuInfoCollectionPolicy = 'browser-default',
}, {
  platform = process.platform,
  getUid = () => process.getuid?.(),
  convertWslPath = convertWslPathToWindows,
} = {}) {
  requireQaChromiumGpuInfoCollectionPolicy(gpuInfoCollectionPolicy);
  if (gpuInfoCollectionPolicy === 'dawn-eager' && inferBrowserQaPlatform(chromePath) !== 'windows') {
    throw new Error('QA_BROWSER_GPU_INFO_COLLECTION_NATIVE_WINDOWS_REQUIRED');
  }
  const normalizedProfileDirectory = requireQaProfileDirectoryName(profileDirectory);
  if (!['muted', 'audible'].includes(audioPolicy)) {
    throw new Error(`CHROMIUM_HARNESS_AUDIO_POLICY_INVALID:${audioPolicy}`);
  }
  const windowsInterop = isWslWindowsChromeExecutable(chromePath, { platform });
  if (windowsInterop && !isWslWindowsDrivePath(userDataDir)) {
    throw new Error(
      `CHROMIUM_HARNESS_WSL_WINDOWS_PROFILE_DRIVE_PATH_REQUIRED:${userDataDir}`,
    );
  }
  if (
    extensionEnabled
    && (typeof extensionDir !== 'string' || !extensionDir.trim())
  ) {
    throw new Error('CHROMIUM_HARNESS_EXTENSION_PATH_REQUIRED');
  }
  const launchUserDataDir = windowsInterop
    ? await convertWslPath(userDataDir)
    : userDataDir;
  const launchExtensionDir = extensionEnabled
    ? (windowsInterop ? await convertWslPath(extensionDir) : extensionDir)
    : null;
  const args = [
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${launchUserDataDir}`,
    ...(normalizedProfileDirectory
      ? [`--profile-directory=${normalizedProfileDirectory}`]
      : []),
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-automation',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-features=Translate,MediaRouter,OptimizationHints',
    ...(audioPolicy === 'muted' ? ['--mute-audio'] : []),
    'about:blank',
  ];
  if (extensionEnabled) {
    args.splice(2, 0,
      `--disable-extensions-except=${launchExtensionDir}`,
      `--load-extension=${launchExtensionDir}`,
    );
    args.splice(args.length - 1, 0, '--enable-unsafe-extension-debugging');
  } else {
    args.splice(2, 0, '--disable-extensions');
  }
  if (headless) args.push('--headless=new');
  if (!windowsInterop && platform === 'linux' && getUid() === 0) {
    args.push('--no-sandbox');
  }
  const graphicsLaunch = browserExecution
    ? resolveQaChromiumGraphicsLaunch({
        args,
        executionContract: browserExecution,
        displayReceipt,
      })
    : Object.freeze({
        args: Object.freeze(args),
        policy: 'legacy_browser_default',
      });
  const gpuInfoCollectionLaunch = resolveQaChromiumGpuInfoCollectionLaunch({
    args: graphicsLaunch.args, executionContract: browserExecution,
    policy: gpuInfoCollectionPolicy, platform,
  });
  return Object.freeze({
    chromePath,
    args: gpuInfoCollectionLaunch.args,
    graphicsLaunchPolicy: graphicsLaunch.policy,
    gpuInfoCollectionLaunch: gpuInfoCollectionLaunch.receipt,
    executionMode: windowsInterop ? 'wsl_windows' : 'native',
    userDataDir: launchUserDataDir,
    profileDirectory: normalizedProfileDirectory,
    extensionDir: launchExtensionDir,
    extensionEnabled: !!extensionEnabled,
    audioPolicy,
    remoteDebuggingPort,
  });
}

export async function createChromeAttachSpec({
  chromePath,
  userDataDir,
  profileDirectory = null,
  extensionDir,
}, {
  platform = process.platform,
  convertWslPath = convertWslPathToWindows,
} = {}) {
  const normalizedProfileDirectory = requireQaProfileDirectoryName(profileDirectory);
  const windowsInterop = isWslWindowsChromeExecutable(chromePath, { platform });
  if (windowsInterop && !isWslWindowsDrivePath(userDataDir)) {
    throw new Error(
      `CHROMIUM_HARNESS_WSL_WINDOWS_PROFILE_DRIVE_PATH_REQUIRED:${userDataDir}`,
    );
  }
  if (typeof extensionDir !== 'string' || !extensionDir.trim()) {
    throw new Error('CHROMIUM_HARNESS_EXTENSION_PATH_REQUIRED');
  }
  return Object.freeze({
    chromePath,
    executionMode: windowsInterop ? 'wsl_windows' : 'native',
    userDataDir: windowsInterop
      ? await convertWslPath(userDataDir)
      : userDataDir,
    profileDirectory: normalizedProfileDirectory,
    extensionDir: windowsInterop
      ? await convertWslPath(extensionDir)
      : extensionDir,
  });
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}


function requireExplicitQaProfilePath(qaProfileDir) {
  if (qaProfileDir === null || qaProfileDir === undefined) return null;
  if (typeof qaProfileDir !== 'string' || !qaProfileDir.trim()) {
    throw new Error('CHROMIUM_HARNESS_QA_PROFILE_PATH_REQUIRED');
  }
  if (!path.isAbsolute(qaProfileDir)) {
    throw new Error(`CHROMIUM_HARNESS_QA_PROFILE_PATH_ABSOLUTE_REQUIRED:${qaProfileDir}`);
  }
  return path.normalize(qaProfileDir);
}

function requireQaProfileDirectoryName(profileDirectory) {
  if (profileDirectory === null || profileDirectory === undefined) return null;
  if (
    typeof profileDirectory !== 'string'
    || !profileDirectory.trim()
    || profileDirectory !== profileDirectory.trim()
    || profileDirectory === '.'
    || profileDirectory === '..'
    || profileDirectory.length > 128
    || /[\/\\\0-\x1f\x7f]/u.test(profileDirectory)
  ) {
    throw new Error('CHROMIUM_HARNESS_QA_PROFILE_DIRECTORY_NAME_INVALID');
  }
  return profileDirectory;
}

async function validateQaProfileDirectoryName(qaProfileDir, profileDirectory) {
  const normalizedName = requireQaProfileDirectoryName(profileDirectory);
  if (!normalizedName) return null;
  const profilePath = path.join(qaProfileDir, normalizedName);
  const stat = await fs.lstat(profilePath).catch(() => null);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`CHROMIUM_HARNESS_QA_PROFILE_DIRECTORY_MISSING:${profilePath}`);
  }
  return normalizedName;
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (!port) {
          reject(new Error('CHROMIUM_HARNESS_PORT_ALLOCATION_FAILED'));
          return;
        }
        resolve(port);
      });
    });
  });
}

async function getWslWindowsFreePort(chromePath) {
  const driveMount = path.normalize(chromePath).match(/^\/mnt\/[a-z]/iu)?.[0];
  if (!driveMount) {
    throw new Error(`CHROMIUM_HARNESS_WSL_WINDOWS_DRIVE_UNRESOLVED:${chromePath}`);
  }
  const powershellPath = path.join(
    driveMount,
    'Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  try {
    const { stdout } = await execFileAsync(powershellPath, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      [
        '$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)',
        '$listener.Start()',
        '$port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port',
        '$listener.Stop()',
        '$port',
      ].join('\n'),
    ], {
      encoding: 'utf8',
      timeout: WINDOWS_PATH_CONVERSION_TIMEOUT_MS,
      maxBuffer: 16 * 1024,
    });
    const port = Number(String(stdout || '').trim());
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error(`invalid_port:${String(stdout || '').trim()}`);
    }
    return port;
  } catch (error) {
    throw new Error(
      `CHROMIUM_HARNESS_WSL_WINDOWS_PORT_ALLOCATION_FAILED:${error?.message || error}`,
    );
  }
}

export async function allocateChromiumHarnessDebugPort(
  chromePath,
  {
    platform = process.platform,
    allocateNative = getFreePort,
    allocateWindows = getWslWindowsFreePort,
  } = {},
) {
  const port = isWslWindowsChromeExecutable(chromePath, { platform })
    ? await allocateWindows(chromePath)
    : await allocateNative();
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`CHROMIUM_HARNESS_PORT_ALLOCATION_INVALID:${port}`);
  }
  return port;
}

async function fetchJson(url, { timeoutMs = 1_500 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function requireChromiumDebugEndpointPayload(payload, cdpEndpoint) {
  if (
    !payload
    || typeof payload !== 'object'
    || typeof payload.webSocketDebuggerUrl !== 'string'
    || !payload.webSocketDebuggerUrl
  ) {
    throw new Error('CHROMIUM_DEBUG_ENDPOINT_WEBSOCKET_REQUIRED');
  }
  let webSocketUrl;
  try {
    webSocketUrl = new URL(payload.webSocketDebuggerUrl);
  } catch {
    throw new Error('CHROMIUM_DEBUG_ENDPOINT_WEBSOCKET_INVALID');
  }
  const endpoint = new URL(cdpEndpoint);
  if (
    webSocketUrl.protocol !== 'ws:'
    || !isLoopbackHostname(webSocketUrl.hostname)
    || webSocketUrl.port !== endpoint.port
    || webSocketUrl.username
    || webSocketUrl.password
  ) {
    throw new Error('CHROMIUM_DEBUG_ENDPOINT_WEBSOCKET_LOOPBACK_REQUIRED');
  }
  return payload;
}

export async function readChromiumDebugEndpoint(cdpEndpoint, {
  timeoutMs = 1_500,
} = {}) {
  const normalizedEndpoint = normalizeChromiumHarnessCdpEndpoint(cdpEndpoint);
  if (!normalizedEndpoint) {
    throw new Error('CHROMIUM_HARNESS_CDP_ENDPOINT_REQUIRED');
  }
  const payload = await fetchJson(`${normalizedEndpoint}/json/version`, {
    timeoutMs,
  }).catch((error) => {
    throw new Error(
      `CHROMIUM_HARNESS_CDP_ATTACH_FAILED:${error?.message || error}`,
    );
  });
  return requireChromiumDebugEndpointPayload(payload, normalizedEndpoint);
}

async function waitForDebugEndpoint(port, timeoutMs = 15_000) {
  const cdpEndpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return await readChromiumDebugEndpoint(cdpEndpoint);
    } catch (error) {
      lastError = error;
      await sleep(200);
    }
  }
  throw new Error(
    `CHROMIUM_DEBUG_ENDPOINT_TIMEOUT:${lastError?.message || 'unknown'}`,
  );
}

function mapHarnessCdpError(error) {
  switch (error?.code) {
    case 'BROWSER_QA_CDP_WEBSOCKET_OPEN_TIMEOUT': {
      const mapped = new Error(`CDP_WEBSOCKET_OPEN_TIMEOUT:${error.timeoutMs}`, {
        cause: error,
      });
      mapped.code = 'CDP_WEBSOCKET_OPEN_TIMEOUT';
      return mapped;
    }
    case 'BROWSER_QA_CDP_WEBSOCKET_OPEN_FAILED':
    case 'BROWSER_QA_CDP_WEBSOCKET_OPEN_CLOSED':
    case 'BROWSER_QA_CDP_WEBSOCKET_OPEN_ABORTED': {
      const mapped = new Error('CDP_WEBSOCKET_OPEN_FAILED', { cause: error });
      mapped.code = 'CDP_WEBSOCKET_OPEN_FAILED';
      return mapped;
    }
    case 'BROWSER_QA_CDP_WEBSOCKET_NOT_OPEN': {
      const mapped = new Error('CDP_WEBSOCKET_NOT_OPEN', { cause: error });
      mapped.code = 'CDP_WEBSOCKET_NOT_OPEN';
      return mapped;
    }
    case 'BROWSER_QA_CDP_REQUEST_TIMEOUT_INVALID':
      return new Error(`CDP_COMMAND_TIMEOUT_INVALID:${error.timeoutMs}`);
    case 'BROWSER_QA_CDP_REQUEST_TIMEOUT':
      return new Error(
        `CDP_COMMAND_TIMEOUT:${error.cdpMethod}:${error.timeoutMs}`,
      );
    case 'BROWSER_QA_CDP_PROTOCOL_ERROR':
      return new Error(
        `${error.protocolMessage || 'CDP_ERROR'} ${error.protocolData || ''}`.trim(),
      );
    case 'BROWSER_QA_CDP_WEBSOCKET_CLOSED':
    case 'BROWSER_QA_CDP_WEBSOCKET_ERROR':
      return new Error('CDP_WEBSOCKET_CLOSED', { cause: error });
    case 'BROWSER_QA_CDP_SEND_FAILED':
      return error.cause instanceof Error ? error.cause : error;
    default:
      return error;
  }
}

// Compatibility adapter for the extension harness. The reusable transport
// owns WebSocket state, open/request bounds, pending cleanup, and event fanout.
export class CdpConnection extends BrowserQaCdpConnection {
  constructor(webSocketUrl, {
    commandTimeoutMs = DEFAULT_CDP_COMMAND_TIMEOUT_MS,
    openTimeoutMs = DEFAULT_CDP_OPEN_TIMEOUT_MS,
    WebSocketImpl = globalThis.WebSocket,
    setOpenTimeout = setTimeout,
    clearOpenTimeout = clearTimeout,
    setRequestTimeout = setTimeout,
    clearRequestTimeout = clearTimeout,
  } = {}) {
    const normalizedCommandTimeoutMs = Number(commandTimeoutMs);
    if (!Number.isFinite(normalizedCommandTimeoutMs) || normalizedCommandTimeoutMs <= 0) {
      throw new Error(`CDP_COMMAND_TIMEOUT_INVALID:${commandTimeoutMs}`);
    }
    if (typeof WebSocketImpl !== 'function') {
      throw new Error('CDP_WEBSOCKET_IMPLEMENTATION_REQUIRED');
    }
    const normalizedOpenTimeoutMs = Number(openTimeoutMs);
    if (!Number.isFinite(normalizedOpenTimeoutMs) || normalizedOpenTimeoutMs <= 0) {
      throw new Error(`CDP_OPEN_TIMEOUT_INVALID:${openTimeoutMs}`);
    }
    super(webSocketUrl, {
      WebSocketImpl,
      openTimeoutMs: normalizedOpenTimeoutMs,
      requestTimeoutMs: normalizedCommandTimeoutMs,
      setOpenTimeout,
      clearOpenTimeout,
      setRequestTimeout,
      clearRequestTimeout,
    });
    this.commandTimeoutMs = Math.floor(normalizedCommandTimeoutMs);
  }

  open() {
    return super.open().catch((error) => Promise.reject(mapHarnessCdpError(error)));
  }

  subscribe(method, listener) {
    if ((typeof method !== 'string' || !method) && method !== '*') {
      throw new Error('CDP_EVENT_METHOD_REQUIRED');
    }
    if (typeof listener !== 'function') {
      throw new Error(`CDP_EVENT_LISTENER_REQUIRED:${method}`);
    }
    return super.subscribe(method, listener);
  }

  send(method, params = {}, sessionId = null, {
    timeoutMs = this.commandTimeoutMs,
  } = {}) {
    return super.send(method, params, sessionId, { timeoutMs })
      .catch((error) => Promise.reject(mapHarnessCdpError(error)));
  }
}

export async function evaluate(cdp, sessionId, expression, {
  awaitPromise = true,
  returnByValue = true,
  timeoutMs = 20_000,
  commandTimeoutMs = timeoutMs + 1_000,
} = {}) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue,
    timeout: timeoutMs,
  }, sessionId, { timeoutMs: commandTimeoutMs });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.text || 'RUNTIME_EVALUATION_FAILED';
    const description = result.exceptionDetails.exception?.description || '';
    throw new Error(`${text}${description ? `: ${description}` : ''}`);
  }
  return result.result?.value;
}

export async function waitForPageReady(cdp, sessionId, timeoutMs = 15_000, {
  deadlineAtMs = null,
} = {}) {
  const absoluteDeadlineAtMs = normalizeOptionalDeadlineAtMs(
    deadlineAtMs,
    'CHROMIUM_PAGE_READY_DEADLINE_INVALID',
  );
  const deadline = Math.min(
    Date.now() + timeoutMs,
    absoluteDeadlineAtMs ?? Number.MAX_SAFE_INTEGER,
  );
  while (Date.now() < deadline) {
    const remainingMs = deadline - Date.now();
    const readyState = await evaluate(cdp, sessionId, 'document.readyState', {
      awaitPromise: false,
      timeoutMs: Math.min(1_000, remainingMs),
      commandTimeoutMs: remainingMs,
    }).catch(() => null);
    if (readyState === 'interactive' || readyState === 'complete') return;
    const remainingAfterProbeMs = deadline - Date.now();
    if (remainingAfterProbeMs > 0) {
      await sleep(Math.min(100, remainingAfterProbeMs));
    }
  }
  throw new Error('CHROMIUM_PAGE_READY_TIMEOUT');
}

async function runPageNavigation(cdp, sessionId, method, params, {
  timeoutMs = 30_000,
  deadlineAtMs = null,
} = {}) {
  if (typeof cdp.subscribe !== 'function') {
    throw new Error('CDP_EVENT_SUBSCRIPTION_REQUIRED');
  }
  let lifecycleObserved = false;
  let lastReadyState = null;
  let lastProbeError = null;
  let lastMainFrame = null;
  let lastDocument = null;
  let navigationResult = null;
  const unsubscribe = cdp.subscribe('Page.domContentEventFired', (event) => {
    if (!event.sessionId || event.sessionId === sessionId) lifecycleObserved = true;
  });
  const unsubscribeFrame = cdp.subscribe('Page.frameNavigated', (event) => {
    if (event.sessionId && event.sessionId !== sessionId) return;
    const frame = event.params?.frame;
    if (!frame || frame.parentId) return;
    lastMainFrame = { frameId: frame.id, loaderId: frame.loaderId,
      url: String(frame.url || '').split(/[?#]/u)[0] };
  });
  const navigationTimeoutError = () => new Error(
    `CHROMIUM_PAGE_NAVIGATION_READY_TIMEOUT:${method}:${JSON.stringify({
      lifecycleObserved, lastReadyState, lastProbeError, lastMainFrame, lastDocument, navigationResult,
    })}`,
  );
  try {
    const absoluteDeadlineAtMs = normalizeOptionalDeadlineAtMs(
      deadlineAtMs,
      'CHROMIUM_PAGE_NAVIGATION_DEADLINE_INVALID',
    );
    const deadline = Math.min(
      Date.now() + timeoutMs,
      absoluteDeadlineAtMs ?? Number.MAX_SAFE_INTEGER,
    );
    const readMainFrame = async () => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) throw navigationTimeoutError();
      const response = await cdp.send('Page.getFrameTree', {}, sessionId, { timeoutMs: remainingMs });
      const frame = response?.frameTree?.frame;
      if (!frame?.id || !frame.loaderId || frame.parentId) throw new Error('CHROMIUM_PAGE_MAIN_FRAME_IDENTITY_REQUIRED');
      return { frameId: frame.id, loaderId: frame.loaderId,
        url: `${frame.url}${frame.urlFragment || ''}` };
    };
    const previousFrame = await readMainFrame();
    const navigationTimeoutMs = deadline - Date.now();
    if (navigationTimeoutMs <= 0) {
      throw navigationTimeoutError();
    }
    const result = await cdp.send(method, params, sessionId, {
      timeoutMs: navigationTimeoutMs,
    });
    navigationResult = result;
    if (result?.errorText) {
      throw new Error(`CHROMIUM_PAGE_NAVIGATION_FAILED:${result.errorText}`);
    }
    if (result?.isDownload) throw new Error('CHROMIUM_PAGE_NAVIGATION_IS_DOWNLOAD');
    const expectedFrameId = method === 'Page.reload' ? previousFrame.frameId : result?.frameId;
    if (!expectedFrameId) throw new Error('CHROMIUM_PAGE_NAVIGATION_FRAME_ID_REQUIRED');
    const sameDocument = method === 'Page.navigate' && !result.loaderId;
    const requestedUrl = sameDocument ? new URL(params.url).href : null;
    const matchesNavigation = (frame) => frame.frameId === expectedFrameId && (
      method === 'Page.reload' ? frame.loaderId !== previousFrame.loaderId
        : sameDocument ? frame.loaderId === previousFrame.loaderId && frame.url === requestedUrl
          : frame.loaderId === result.loaderId
    );
    while (Date.now() < deadline) {
      try {
        const before = await readMainFrame();
        lastMainFrame = { ...before, url: before.url.split(/[?#]/u)[0] };
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) break;
        const document = await evaluate(cdp, sessionId,
          '({ readyState: document.readyState, url: location.href })', {
            awaitPromise: false,
            timeoutMs: Math.min(1_000, remainingMs),
            commandTimeoutMs: remainingMs,
          });
        lastReadyState = document?.readyState ?? null;
        lastDocument = document && { ...document, url: String(document.url).split(/[?#]/u)[0] };
        if (matchesNavigation(before)
          && (document?.readyState === 'interactive' || document?.readyState === 'complete')
          && document.url === before.url) {
          // Bind readiness to the committed document, not an uncorrelated
          // DOMContentLoaded event. Recheck identity across the context probe
          // so a completed old document or a racing navigation cannot pass.
          const after = await readMainFrame();
          if (matchesNavigation(after) && after.loaderId === before.loaderId && after.url === before.url) return result;
        }
      } catch (error) {
        lastProbeError = String(error?.message || error).slice(0, 400);
      }
      const remainingAfterProbeMs = deadline - Date.now();
      if (remainingAfterProbeMs > 0) {
        await sleep(Math.min(100, remainingAfterProbeMs));
      }
    }
    throw navigationTimeoutError();
  } finally {
    unsubscribe?.();
    unsubscribeFrame?.();
  }
}

export async function navigatePageTarget(cdp, sessionId, url, options = {}) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('CHROMIUM_PAGE_URL_REQUIRED');
  }
  return runPageNavigation(cdp, sessionId, 'Page.navigate', { url }, options);
}

export async function reloadPageTarget(cdp, sessionId, {
  ignoreCache = false,
  timeoutMs = 30_000,
} = {}) {
  return runPageNavigation(cdp, sessionId, 'Page.reload', {
    ignoreCache: !!ignoreCache,
  }, { timeoutMs });
}

export async function openPageTarget(cdp, url = 'about:blank', {
  targetId: attachedTargetId = null,
  timeoutMs = 30_000,
  background = false,
  deadlineAtMs = null,
  browserEpoch = null,
  onTargetReady = null,
} = {}) {
  const absoluteDeadlineAtMs = normalizeOptionalDeadlineAtMs(
    deadlineAtMs,
    'CHROMIUM_PAGE_OPEN_DEADLINE_INVALID',
  );
  const remainingTimeoutMs = () => (
    absoluteDeadlineAtMs === null
      ? timeoutMs
      : Math.min(
        timeoutMs,
        requireRemainingDeadlineMs(
          absoluteDeadlineAtMs,
          'CHROMIUM_PAGE_OPEN_DEADLINE_EXHAUSTED',
        ),
      )
  );
  const createdTarget = !attachedTargetId;
  if (
    createdTarget
    && (typeof browserEpoch !== 'string' || !browserEpoch || browserEpoch !== browserEpoch.trim())
  ) {
    throw new Error('CHROMIUM_PAGE_TARGET_BROWSER_EPOCH_REQUIRED');
  }
  if (onTargetReady !== null && typeof onTargetReady !== 'function') {
    throw new Error('CHROMIUM_PAGE_TARGET_READY_OWNER_INVALID');
  }
  const createdTargetReceipt = createdTarget
    ? await createQaCdpPageTarget(cdp, {
      url: 'about:blank',
      background,
      recoverAmbiguousCreation: true,
      ownerPurpose: 'extension_page',
      browserEpoch,
      deadlineAtMs: absoluteDeadlineAtMs,
      ...(absoluteDeadlineAtMs === null ? {} : { timeoutMs: remainingTimeoutMs() }),
    })
    : null;
  const targetId = attachedTargetId || createdTargetReceipt.targetId;
  if (typeof targetId !== 'string' || !targetId) {
    throw new Error('CHROMIUM_PAGE_TARGET_ID_MISSING');
  }
  let sessionId = null;
  try {
    const attachParams = { targetId, flatten: true };
    ({ sessionId } = absoluteDeadlineAtMs === null
      ? await cdp.send('Target.attachToTarget', attachParams)
      : await cdp.send('Target.attachToTarget', attachParams, null, {
        timeoutMs: remainingTimeoutMs(),
      }));
    if (typeof sessionId !== 'string' || !sessionId) {
      throw new Error('CHROMIUM_PAGE_SESSION_ID_MISSING');
    }
    if (absoluteDeadlineAtMs === null) {
      await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Page.enable', {}, sessionId);
    } else {
      await cdp.send('Runtime.enable', {}, sessionId, {
        timeoutMs: remainingTimeoutMs(),
      });
      await cdp.send('Page.enable', {}, sessionId, {
        timeoutMs: remainingTimeoutMs(),
      });
    }
    await waitForPageReady(cdp, sessionId, remainingTimeoutMs(), {
      deadlineAtMs: absoluteDeadlineAtMs,
    });
    await onTargetReady?.(Object.freeze({
      targetId,
      sessionId,
      createdTargetReceipt,
    }));
    if (url !== 'about:blank') {
      await navigatePageTarget(cdp, sessionId, url, {
        timeoutMs: remainingTimeoutMs(),
        deadlineAtMs: absoluteDeadlineAtMs,
      });
    }
    return { targetId, sessionId };
  } catch (error) {
    if (createdTarget) {
      try {
        await closePageTarget(cdp, targetId);
      } catch (cleanupError) {
        if (error instanceof Error) {
          error.message = `${error.message}; cleanup=${cleanupError?.message || cleanupError}`;
        }
      }
    }
    throw error;
  }
}

export async function closePageTarget(cdp, targetId, {
  timeoutMs = 1_000,
  pollIntervalMs = 20,
  allowConfirmedBrowserDisconnect = false,
} = {}) {
  try {
    return await closeQaCdpTarget(cdp, targetId, {
      timeoutMs,
      pollIntervalMs,
      allowConfirmedBrowserDisconnect,
    });
  } catch (error) {
    throw new Error(
      String(error?.message || error).replace(
        /^QA_CDP_TARGET/u,
        'CHROMIUM_PAGE_TARGET',
      ),
      { cause: error },
    );
  }
}

export async function getTargetInfos(cdp) {
  return listQaCdpTargets(cdp);
}

function isExactBlankPageTarget(target) {
  return target?.type === 'page'
    && target?.url === EXACT_BLANK_PAGE_URL
    && typeof target?.targetId === 'string'
    && target.targetId.length > 0;
}

function describeDriftTargets(driftTargets) {
  if (!Array.isArray(driftTargets) || driftTargets.length === 0) return '';
  // A bare count says the load was blocked without saying by what, which leaves
  // the only route to the cause a millisecond-wide race that status polling
  // cannot observe. Name the pages so the failure is diagnosable from evidence.
  const described = driftTargets
    .slice(0, 8)
    .map((target) => String(target?.url || 'about:unknown').slice(0, 120))
    .join(',');
  return `:pages=${described}`;
}

function managedExtensionLoadTargetBlocked(
  reason,
  quarantinedPageCount = 0,
  driftTargets = null,
) {
  const boundedCount = Number.isInteger(quarantinedPageCount)
    ? Math.max(0, Math.min(quarantinedPageCount, 999))
    : 0;
  const error = new Error(
    `CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_BLOCKED:${reason}:count=${boundedCount}`
    + describeDriftTargets(driftTargets),
  );
  error.code = 'CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_BLOCKED';
  error.stage = 'managed_extension_load_target_cleanup';
  error.quarantinedPageCount = boundedCount;
  return error;
}

// Chrome opens its window pages a moment after the window itself, so the
// baseline waits for a stable page count instead of a fixed sleep.
const MANAGED_WINDOW_SETTLE_INTERVAL_MS = 120;
const MANAGED_WINDOW_SETTLE_STABLE_READS = 2;
const MANAGED_WINDOW_SETTLE_TIMEOUT_MS = 10_000;

function findUnexpectedPageTargets(targets, baselineTargetIds, anchorTargetId) {
  return targets.filter((target) => (
    target?.type === 'page'
    && typeof target?.targetId === 'string'
    && target.targetId
    && target.targetId !== anchorTargetId
    && !baselineTargetIds.has(target.targetId)
  ));
}

export async function closeExactStartupBlankPageTargets(cdp, targetIds = []) {
  const requestedTargetIds = new Set(
    Array.from(targetIds).filter((targetId) => (
      typeof targetId === 'string' && targetId.length > 0
    )),
  );
  if (requestedTargetIds.size === 0) return [];

  const targets = (await getTargetInfos(cdp)).filter((target) => (
    isExactBlankPageTarget(target) && requestedTargetIds.has(target.targetId)
  ));
  const closedTargetIds = [];
  for (const target of targets) {
    await closePageTarget(cdp, target.targetId);
    closedTargetIds.push(target.targetId);
  }
  return closedTargetIds;
}

export async function closeQaProfileStartupPageTargets(cdp, targetIds = []) {
  const requestedTargetIds = new Set(
    Array.from(targetIds).filter((targetId) => (
      typeof targetId === 'string' && targetId.length > 0
    )),
  );
  if (requestedTargetIds.size === 0) return [];

  const targets = (await getTargetInfos(cdp)).filter((target) => (
    target?.type === 'page'
    && requestedTargetIds.has(target.targetId)
    && typeof target.targetId === 'string'
    && target.targetId.length > 0
  ));
  const closedTargetIds = [];
  for (const target of targets) {
    await closePageTarget(cdp, target.targetId);
    closedTargetIds.push(target.targetId);
  }
  return closedTargetIds;
}

async function waitForPageTargetByUrl(cdp, url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const target = (await getTargetInfos(cdp)).find((candidate) => (
      candidate?.type === 'page' && candidate?.url === url
    ));
    if (target?.targetId) return target;
    await sleep(100);
  }
  throw new Error(`CHROMIUM_PAGE_TARGET_NOT_FOUND:${url}`);
}

function requireHarnessPage(page) {
  if (
    !page
    || typeof page !== 'object'
    || typeof page.targetId !== 'string'
    || !page.targetId
    || typeof page.sessionId !== 'string'
    || !page.sessionId
  ) {
    throw new Error('CHROMIUM_HARNESS_PAGE_REQUIRED');
  }
  return page;
}

function requireExactOwnedHarnessPage(harness, page, errorCode) {
  const target = requireHarnessPage(page);
  const ownedTarget = harness.pageTargets.get(target.targetId);
  if (
    !ownedTarget
    || !harness.targetLease.owns(target.targetId)
    || ownedTarget.sessionId !== target.sessionId
    || ownedTarget.tabId !== target.tabId
  ) {
    throw new Error(errorCode);
  }
  return ownedTarget;
}

async function createTabThroughTrustedPage(harness, url, active, windowId = null) {
  const result = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
    chrome.tabs.create(${JSON.stringify({ url, active: !!active, ...(windowId === null ? {} : { windowId }) })}, (tab) => {
      const error = chrome.runtime.lastError?.message || null;
      resolve({
        error,
        tab: tab && Number.isInteger(tab.id) ? {
          id: tab.id,
          url: tab.url || null,
          status: tab.status || null,
          active: tab.active === true,
          windowId: Number.isInteger(tab.windowId) ? tab.windowId : null,
        } : null,
      });
    });
  })`);
  if (result?.error || !Number.isInteger(result?.tab?.id)) {
    throw new Error(`CHROMIUM_HARNESS_TAB_CREATE_FAILED:${result?.error || 'tab id missing'}`);
  }
  return result.tab;
}

async function readTabThroughTrustedPage(harness, tabId) {
  const result = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
    chrome.tabs.get(${JSON.stringify(tabId)}, (tab) => {
      const error = chrome.runtime.lastError?.message || null;
      resolve({
        error,
        tab: tab && Number.isInteger(tab.id) ? {
          id: tab.id,
          url: tab.url || null,
          status: tab.status || null,
          active: tab.active === true,
          windowId: Number.isInteger(tab.windowId) ? tab.windowId : null,
        } : null,
      });
    });
  })`);
  if (result?.error || result?.tab?.id !== tabId) {
    throw new Error(`CHROMIUM_HARNESS_TAB_RESOLVE_FAILED:${result?.error || tabId}`);
  }
  return result.tab;
}

async function removeTabThroughTrustedPage(harness, tabId) {
  let result;
  try {
    result = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
      chrome.tabs.remove(${JSON.stringify(tabId)}, () => {
        resolve({ error: chrome.runtime.lastError?.message || null });
      });
    })`);
  } catch (error) {
    throw new Error(
      `CHROMIUM_HARNESS_TAB_REMOVE_FAILED:${tabId}:${error?.message || error}`,
      { cause: error },
    );
  }
  if (result?.error) {
    throw new Error(`CHROMIUM_HARNESS_TAB_REMOVE_FAILED:${tabId}:${result.error}`);
  }
  return Object.freeze({ tabId, status: 'removed' });
}

async function waitForExtensionId(cdp, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const targets = await getTargetInfos(cdp);
    const extensionTarget = targets.find((target) => {
      const url = String(target?.url || '');
      if (!url.startsWith('chrome-extension://')) return false;
      return url.endsWith(`/${SERVICE_WORKER_PATH}`)
        || url.includes('/src/apps/background/');
    });
    const match = String(extensionTarget?.url || '').match(/^chrome-extension:\/\/([^/]+)/);
    if (match) return match[1];
    await sleep(200);
  }
  throw new Error('EXTENSION_TARGET_NOT_FOUND');
}

function findUnpackedExtensionByPath(extensions, extensionPath) {
  const expectedPath = normalizeBrowserExtensionPath(extensionPath);
  if (!expectedPath || !Array.isArray(extensions)) return null;
  return extensions.find((extension) => (
    normalizeBrowserExtensionPath(extension?.path) === expectedPath
  )) || null;
}

function isExtensionAlreadyAbsentError(error) {
  return /could not find extension/iu.test(String(error?.message || error || ''));
}

async function readUnpackedExtensionByPath(cdp, extensionPath) {
  const result = await cdp.send('Extensions.getExtensions');
  return findUnpackedExtensionByPath(result?.extensions, extensionPath);
}

export async function resolveAttachedHarnessExtension(cdp, extensionPath) {
  if (!cdp || typeof cdp.send !== 'function') {
    throw new Error('CHROMIUM_HARNESS_CDP_REQUIRED');
  }
  if (typeof extensionPath !== 'string' || !extensionPath.trim()) {
    throw new Error('CHROMIUM_HARNESS_EXTENSION_PATH_REQUIRED');
  }
  let extension;
  try {
    extension = await readUnpackedExtensionByPath(cdp, extensionPath);
  } catch (error) {
    throw new Error(
      `CHROMIUM_HARNESS_ATTACH_EXTENSION_DISCOVERY_REQUIRED:${error?.message || error}`,
    );
  }
  if (!extension) {
    throw new Error(
      `CHROMIUM_HARNESS_ATTACH_EXTENSION_PATH_MISMATCH:${extensionPath}`,
    );
  }
  if (
    extension.enabled !== true
    || typeof extension.id !== 'string'
    || !extension.id
  ) {
    throw new Error(
      `CHROMIUM_HARNESS_ATTACH_EXTENSION_NOT_ACTIVE:${extensionPath}`,
    );
  }
  return Object.freeze({
    extensionId: extension.id,
    installMode: 'attached_existing',
    uninstallOnClose: false,
  });
}

async function waitForActiveUnpackedExtension(cdp, extensionPath, extensionId, {
  timeoutMs = CDP_EXTENSION_ACTIVATION_TIMEOUT_MS,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const extension = await readUnpackedExtensionByPath(cdp, extensionPath);
    if (extension?.enabled === true && extension.id === extensionId) return extension;
    await sleep(100);
  }
  return null;
}

export async function installHarnessExtension(cdp, extensionPath, {
  discoverCommandLineExtension = waitForExtensionId,
} = {}) {
  if (!cdp || typeof cdp.send !== 'function') {
    throw new Error('CHROMIUM_HARNESS_CDP_REQUIRED');
  }
  if (typeof extensionPath !== 'string' || !extensionPath.trim()) {
    throw new Error('CHROMIUM_HARNESS_EXTENSION_PATH_REQUIRED');
  }

  let extensionListSupported = true;
  try {
    const existing = await readUnpackedExtensionByPath(cdp, extensionPath);
    if (existing?.enabled === true && typeof existing.id === 'string' && existing.id) {
      return Object.freeze({
        extensionId: existing.id,
        installMode: 'command_line',
        uninstallOnClose: false,
      });
    }
  } catch {
    extensionListSupported = false;
  }

  let loadError = null;
  try {
    const result = await cdp.send('Extensions.loadUnpacked', {
      path: extensionPath,
    });
    if (typeof result?.id !== 'string' || !result.id) {
      throw new Error('EXTENSION_LOAD_UNPACKED_ID_MISSING');
    }
    if (extensionListSupported) {
      const activeExtension = await waitForActiveUnpackedExtension(
        cdp,
        extensionPath,
        result.id,
      );
      if (!activeExtension) {
        await cdp.send('Extensions.uninstall', { id: result.id }).catch(() => {});
        throw new Error(
          'EXTENSION_CDP_INSTALL_NOT_ACTIVE:enable_chrome_extension_developer_mode_or_use_chrome_for_testing',
        );
      }
    }
    return Object.freeze({
      extensionId: result.id,
      installMode: 'cdp',
      uninstallOnClose: true,
    });
  } catch (error) {
    loadError = error;
  }

  if (extensionListSupported) {
    try {
      const existing = await readUnpackedExtensionByPath(cdp, extensionPath);
      if (existing?.enabled === true && typeof existing.id === 'string' && existing.id) {
        return Object.freeze({
          extensionId: existing.id,
          installMode: 'command_line',
          uninstallOnClose: false,
        });
      }
    } catch {
      extensionListSupported = false;
    }
  }

  if (!extensionListSupported) {
    try {
      const extensionId = await discoverCommandLineExtension(
        cdp,
        COMMAND_LINE_EXTENSION_DISCOVERY_TIMEOUT_MS,
      );
      return Object.freeze({
        extensionId,
        installMode: 'command_line_legacy',
        uninstallOnClose: false,
      });
    } catch {
      // Preserve the authoritative CDP installation failure below.
    }
  }

  throw new Error(
    `EXTENSION_LOAD_FAILED:${loadError?.message || 'Extensions.loadUnpacked unavailable'}`,
  );
}

function findExtensionServiceWorker(targets, extensionId) {
  const expectedUrl = `chrome-extension://${extensionId}/${SERVICE_WORKER_PATH}`;
  return (Array.isArray(targets) ? targets : []).find((target) => (
    target?.type === 'service_worker' && String(target?.url || '') === expectedUrl
  )) || null;
}

function resolvePackagedExtensionPage(extensionDir, pagePath) {
  if (typeof pagePath !== 'string' || !pagePath.trim()) {
    throw new Error('PACKAGED_EXTENSION_PAGE_REQUIRED');
  }
  const cleanPagePath = pagePath.split(/[?#]/u, 1)[0];
  const resolvedPagePath = path.resolve(extensionDir, cleanPagePath);
  const relativePagePath = path.relative(extensionDir, resolvedPagePath);
  if (
    !relativePagePath
    || relativePagePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePagePath)
  ) {
    throw new Error(`PACKAGED_EXTENSION_PAGE_PATH_INVALID:${pagePath}`);
  }
  return {
    relativePagePath: relativePagePath.split(path.sep).join('/'),
    resolvedPagePath,
  };
}

export async function prepareExtensionForChromiumHarness({
  sourceDir,
  tempRoot,
  trustedPagePath,
  trustedPageSource,
  loadInPlace,
  temporaryManifest = null,
}) {
  const manifestPath = path.join(sourceDir, 'manifest.json');
  if (!(await pathExists(manifestPath))) {
    throw new Error(`EXTENSION_BUILD_NOT_FOUND:${sourceDir}`);
  }
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (manifest?.manifest_version !== 3) {
    throw new Error(`EXTENSION_MANIFEST_V3_REQUIRED:${manifestPath}`);
  }
  const normalizedTemporaryManifest = normalizeChromiumHarnessTemporaryManifest(
    temporaryManifest,
  );

  if (loadInPlace) {
    if (hasChromiumHarnessManifestPromotion(normalizedTemporaryManifest)) {
      throw new Error('CHROMIUM_HARNESS_TEMPORARY_MANIFEST_REQUIRES_COPIED_EXTENSION');
    }
    const packagedPagePath = trustedPagePath || manifest?.action?.default_popup;
    const resolvedPage = resolvePackagedExtensionPage(sourceDir, packagedPagePath);
    if (!(await pathExists(resolvedPage.resolvedPagePath))) {
      throw new Error(`PACKAGED_EXTENSION_PAGE_NOT_FOUND:${resolvedPage.resolvedPagePath}`);
    }
    return {
      extensionDir: sourceDir,
      manifest,
      trustedPagePath: resolvedPage.relativePagePath,
    };
  }

  const extensionDir = path.join(tempRoot, 'extension');
  await fs.cp(sourceDir, extensionDir, { recursive: true });
  const preparedManifest = promoteManifestForChromiumHarness(
    manifest,
    normalizedTemporaryManifest,
  );
  if (hasChromiumHarnessManifestPromotion(normalizedTemporaryManifest)) {
    await fs.writeFile(
      path.join(extensionDir, 'manifest.json'),
      `${JSON.stringify(preparedManifest, null, 2)}\n`,
    );
  }
  const injectedPagePath = trustedPagePath || DEFAULT_TRUSTED_PAGE_PATH;
  const resolvedInjectedPage = resolvePackagedExtensionPage(extensionDir, injectedPagePath);
  await fs.mkdir(path.dirname(resolvedInjectedPage.resolvedPagePath), {
    recursive: true,
  });
  await fs.writeFile(resolvedInjectedPage.resolvedPagePath, trustedPageSource);
  return {
    extensionDir,
    manifest: preparedManifest,
    trustedPagePath: resolvedInjectedPage.relativePagePath,
  };
}

function launchChrome({
  chromePath,
  args,
  audioPolicy = 'muted',
  launchEnvironment = {},
}) {
  return launchQaOwnedChromiumProcess({
    chromePath,
    args,
    audioPolicy,
    stdio: ['ignore', 'ignore', 'pipe'],
    launchEnvironment,
  });
}

function requireChromeExecutable(chromePath) {
  if (typeof chromePath !== 'string' || !chromePath.trim()) {
    throw new Error('CHROMIUM_EXECUTABLE_REQUIRED');
  }
  const resolved = path.resolve(chromePath);
  if (!fsSync.existsSync(resolved)) {
    throw new Error(`CHROMIUM_EXECUTABLE_NOT_FOUND:${resolved}`);
  }
  return resolved;
}

export class ExtensionChromiumHarness {
  constructor({
    chromePath,
    distDir,
    rootDir = process.cwd(),
    headless = true,
    keepTemp = false,
    loadInPlace = false,
    qaProfileDir = null,
    qaProfileDirectory = null,
    temporaryManifest = null,
    cdpCommandTimeoutMs = DEFAULT_CDP_COMMAND_TIMEOUT_MS,
    tempPrefix = 'entropy-extension-e2e-',
    trustedPagePath = null,
    trustedPageSource = DEFAULT_TRUSTED_PAGE_SOURCE,
    extensionEnabled = true,
    audioPolicy = null,
    launchEnvironment = {},
    displayReceipt = null,
    renderingRequirement = process.env.QA_BROWSER_RENDERING_REQUIREMENT || null,
    browserExecution = null,
    capacityReservationMode = 'exclusive',
    gpuInfoCollectionPolicy = 'browser-default',
    allowProvisioningQaProfile = false,
    cdpEndpoint = null,
    expectedBrowserIdentity = null,
    attachedArtifactStage = null,
    attachedArtifactRuntimeReadiness = null,
    recoveryJournal = null,
  }) {
    this.chromePath = requireChromeExecutable(chromePath);
    this.rootDir = path.resolve(rootDir);
    this.cdpEndpoint = normalizeChromiumHarnessCdpEndpoint(cdpEndpoint);
    this.attachOnly = this.cdpEndpoint !== null;
    this.recoveryJournal = normalizeQaRecoveryJournal(recoveryJournal);
    this.recoveryTargets = new Map();
    this.extensionEnabled = extensionEnabled !== false;
    this.browserExecution = normalizeHarnessBrowserExecution(browserExecution, {
      attachOnly: this.attachOnly,
      headless,
      extensionEnabled: this.extensionEnabled,
      audioPolicy,
      renderingRequirement,
    });
    this.gpuInfoCollectionPolicy = requireQaChromiumGpuInfoCollectionPolicy(gpuInfoCollectionPolicy);
    resolveQaChromiumGpuInfoCollectionLaunch({ args: [], executionContract: this.browserExecution,
      policy: this.gpuInfoCollectionPolicy });
    if (this.gpuInfoCollectionPolicy === 'dawn-eager' && inferBrowserQaPlatform(this.chromePath) !== 'windows') {
      throw new Error('QA_BROWSER_GPU_INFO_COLLECTION_NATIVE_WINDOWS_REQUIRED');
    }
    const effectiveAudioPolicy = audioPolicy
      ?? this.browserExecution?.audioPolicy
      ?? 'muted';
    if (!['muted', 'audible'].includes(effectiveAudioPolicy)) {
      throw new Error(`CHROMIUM_HARNESS_AUDIO_POLICY_INVALID:${effectiveAudioPolicy}`);
    }
    this.audioPolicy = effectiveAudioPolicy;
    if (
      !launchEnvironment
      || typeof launchEnvironment !== 'object'
      || Array.isArray(launchEnvironment)
      || Object.values(launchEnvironment).some((value) => typeof value !== 'string')
    ) {
      throw new Error('CHROMIUM_HARNESS_LAUNCH_ENVIRONMENT_INVALID');
    }
    this.launchEnvironment = Object.freeze({ ...launchEnvironment });
    this.displayReceipt = displayReceipt;
    if (
      renderingRequirement !== null
      && !['headless_ok', 'headed_required', 'physical_gpu_required']
        .includes(renderingRequirement)
    ) {
      throw new Error(
        `CHROMIUM_HARNESS_RENDERING_REQUIREMENT_INVALID:${renderingRequirement}`,
      );
    }
    this.renderingRequirement = renderingRequirement
      ?? (this.browserExecution
        ? renderingRequirementFromBrowserExecution(this.browserExecution)
        : null);
    this.sourceDir = this.extensionEnabled ? path.resolve(this.rootDir, distDir) : null;
    this.attachedArtifactStage = attachedArtifactStage === null
      ? null
      : Object.freeze({ ...attachedArtifactStage });
    this.attachedArtifactRuntimeReadiness = attachedArtifactRuntimeReadiness;
    this.headless = this.attachOnly ? null : !!headless;
    this.keepTemp = !!keepTemp;
    this.loadInPlace = !!loadInPlace;
    this.qaProfileDir = requireExplicitQaProfilePath(qaProfileDir);
    this.qaProfileDirectory = requireQaProfileDirectoryName(qaProfileDirectory);
    if (!['exclusive', 'isolated_functional'].includes(capacityReservationMode)
      || (capacityReservationMode === 'isolated_functional' && (
        this.attachOnly || this.qaProfileDir !== null || this.qaProfileDirectory !== null
        || this.browserExecution?.processOwnership !== 'owned'
        || this.browserExecution.headless !== true
        || this.browserExecution.startPolicy !== 'automatic'
        || this.browserExecution.osFocus !== 'never'
        || this.browserExecution.gpuRequirement === 'hardware_active_required'
      ))) throw new Error('CHROMIUM_HARNESS_CAPACITY_RESERVATION_INVALID');
    this.capacityReservationMode = capacityReservationMode;
    if (this.qaProfileDirectory && !this.qaProfileDir) {
      throw new Error('CHROMIUM_HARNESS_QA_PROFILE_DIRECTORY_REQUIRES_PROFILE');
    }
    this.allowProvisioningQaProfile = allowProvisioningQaProfile === true;
    this.temporaryManifest = normalizeChromiumHarnessTemporaryManifest(temporaryManifest);
    if (!this.extensionEnabled && this.loadInPlace) {
      throw new Error('CHROMIUM_HARNESS_EXTENSION_DISABLED_LOAD_IN_PLACE_FORBIDDEN');
    }
    if (
      !this.extensionEnabled
      && hasChromiumHarnessManifestPromotion(this.temporaryManifest)
    ) {
      throw new Error('CHROMIUM_HARNESS_EXTENSION_DISABLED_MANIFEST_PROMOTION_FORBIDDEN');
    }
    if (this.attachOnly) {
      if (!this.qaProfileDir || !this.qaProfileDirectory) {
        throw new Error(
          'CHROMIUM_HARNESS_ATTACH_QA_PROFILE_AND_DIRECTORY_REQUIRED',
        );
      }
      if (!this.extensionEnabled || !this.loadInPlace) {
        throw new Error(
          'CHROMIUM_HARNESS_ATTACH_EXISTING_EXTENSION_REQUIRED',
        );
      }
      if (this.allowProvisioningQaProfile) {
        throw new Error(
          'CHROMIUM_HARNESS_ATTACH_PROVISIONING_PROFILE_FORBIDDEN',
        );
      }
    }
    this.expectedBrowserIdentity = this.attachOnly
      ? defineHarnessAttachedBrowserIdentity({
        chromePath: this.chromePath,
        cdpEndpoint: this.cdpEndpoint,
        qaProfileDir: this.qaProfileDir,
        qaProfileDirectory: this.qaProfileDirectory,
        expectedBrowserIdentity,
      })
      : null;
    if (this.attachedArtifactStage !== null) {
      const stage = this.attachedArtifactStage;
      let canonicalStageContentIdentity = null;
      try {
        canonicalStageContentIdentity = defineEntropyQaArtifactContentIdentity({
          artifactIdentity: stage.artifactIdentity,
          temporaryManifest: stage.temporaryManifest,
        });
      } catch {
        canonicalStageContentIdentity = null;
      }
      const canonicalSlotDir = this.qaProfileDir
        ? path.normalize(`${this.qaProfileDir}.entropy-extension-slot`)
        : null;
      if (
        !this.attachOnly
        || !this.extensionEnabled
        || !this.loadInPlace
        || !stage
        || typeof stage !== 'object'
        || Array.isArray(stage)
        || stage.contractVersion !== 2
        || stage.kind !== 'entropy_attached_artifact_stage'
        || stage.mutationPolicy !== 'managed_atomic_sync'
        || !['ready', 'pending_stage'].includes(stage.slotAdmission)
        || stage.lifecyclePolicy !== 'managed'
        || this.browserExecution?.startPolicy !== 'managed_ensure_before_attach'
        || (stage.profileSlotId || null)
          !== (this.expectedBrowserIdentity?.profileSlotId || null)
        || path.normalize(stage.profileDir || '') !== this.qaProfileDir
        || path.normalize(stage.slotDir || '') !== canonicalSlotDir
        || path.normalize(stage.slotDir || '') !== this.sourceDir
        || typeof stage.sourceDir !== 'string'
        || !path.isAbsolute(stage.sourceDir)
        || path.normalize(stage.sourceDir) === canonicalSlotDir
        || !stage.artifactIdentity
        || !stage.contentIdentity
        || !canonicalStageContentIdentity
        || JSON.stringify(stage.contentIdentity)
          !== JSON.stringify(canonicalStageContentIdentity)
        || stage.contentIdentity.digest !== stage.contentIdentityDigest
        || this.browserExecution?.processOwnership !== 'attach_only'
        || this.browserExecution?.extensionRuntime !== 'required'
        || typeof this.attachedArtifactRuntimeReadiness !== 'function'
      ) {
        throw new Error('CHROMIUM_HARNESS_ATTACHED_ARTIFACT_STAGE_INVALID');
      }
    } else if (this.browserExecution?.startPolicy === 'managed_ensure_before_attach') {
      throw new Error('CHROMIUM_HARNESS_MANAGED_ARTIFACT_STAGE_REQUIRED');
    } else if (this.attachedArtifactRuntimeReadiness !== null) {
      throw new Error('CHROMIUM_HARNESS_ARTIFACT_READINESS_WITHOUT_STAGE_FORBIDDEN');
    }
    this.cdpCommandTimeoutMs = Number(cdpCommandTimeoutMs);
    if (!Number.isFinite(this.cdpCommandTimeoutMs) || this.cdpCommandTimeoutMs <= 0) {
      throw new Error(`CDP_COMMAND_TIMEOUT_INVALID:${cdpCommandTimeoutMs}`);
    }
    this.tempPrefix = tempPrefix;
    this.trustedPagePath = trustedPagePath;
    this.trustedPageSource = trustedPageSource;
    this.tempRoot = null;
    this.userDataDir = null;
    this.extensionDir = null;
    this.extensionId = null;
    this.extensionInstallMode = null;
    this.managedExtensionSlotAction = null;
    this.managedExtensionLoadAnchorCleanupCount = 0;
    this.managedDeveloperModeReceipt = null;
    this.attachedArtifactStageReceipt = null;
    this.attachedArtifactSyncReceipt = null;
    this.uninstallExtensionOnClose = false;
    this.manifest = null;
    this.browserVersion = null;
    this.browserIdentity = null;
    this.ownedBrowserIdentityVerified = false;
    this.gpuCapability = null;
    this.chrome = null;
    this.chromeLaunchSpec = null;
    this.chromeAttachSpec = null;
    this.browserOwnership = this.attachOnly
      ? 'external_qa_browser'
      : 'harness_launched_browser';
    this.cdp = null;
    this.trustedPageTarget = null;
    this.pageTargets = new Map();
    this.startupBlankTargetIds = new Set();
    this.startupQaPageTargetIds = new Set();
    this.browserTargetOwnerId = `extension-chromium:${randomUUID()}`;
    this.targetLease = new QaBrowserTargetLease({
      browserEpoch: this.cdpEndpoint || 'owned-browser:pending',
      ownerId: this.browserTargetOwnerId,
    });
    this.chromeStderr = [];
    this.browserCapacityLease = null;
  }

  resetBrowserTargetLease(startupTargets = []) {
    const targetIds = startupTargets
      .map((target) => target?.targetId)
      .filter((targetId) => typeof targetId === 'string' && targetId);
    this.targetLease = new QaBrowserTargetLease({
      browserEpoch: resolveQaBrowserEpoch(
        this.browserVersion,
        this.cdpEndpoint || 'owned-browser:pending',
      ),
      ownerId: this.browserTargetOwnerId,
      baselineTargetIds: this.attachOnly ? targetIds : [],
    });
  }

  /**
   * A managed browser started with no startup window has no window at all, and
   * Chrome opens one lazily the first time a target is created -- bringing its
   * own `about:blank` and `chrome://newtab/` with it. The extension-load guard
   * downstream assumes creating the anchor adds exactly one page, so those two
   * arrive as foreign pages and block the load before it is issued.
   *
   * Make the window exist first, so the anchor really is the only delta the
   * guard has to account for. When a page already exists this is a no-op, which
   * is every case except a browser that has just been started.
   */
  async materializeManagedBrowserWindow() {
    const initialTargets = await getTargetInfos(this.cdp);
    if (initialTargets.some((target) => target?.type === 'page')) {
      return Object.freeze({ materialized: false, reason: 'window_present' });
    }
    const reservation = await this.reserveRecoveryTarget(
      'managed_browser_window_bootstrap',
    );
    const bootstrapTarget = await createQaCdpPageTarget(this.cdp, {
      url: EXACT_BLANK_PAGE_URL,
      background: true,
      recoverAmbiguousCreation: true,
      ownerPurpose: 'managed_browser_window_bootstrap',
      browserEpoch: this.targetLease.browserEpoch,
    });
    await this.registerOwnedTarget(
      bootstrapTarget,
      'managed_browser_window_bootstrap',
      bootstrapTarget.initialUrl,
      { recoveryReservation: reservation },
    );
    // Chrome's own pages arrive a moment after the window does, so settle on a
    // stable count rather than a fixed sleep. Failing loudly here is better than
    // proceeding into a baseline that is still moving.
    const deadline = Date.now() + MANAGED_WINDOW_SETTLE_TIMEOUT_MS;
    let previousPageCount = -1;
    let stableReads = 0;
    while (Date.now() < deadline) {
      await sleep(MANAGED_WINDOW_SETTLE_INTERVAL_MS);
      const targets = await getTargetInfos(this.cdp);
      const pageCount = targets.filter((target) => target?.type === 'page').length;
      stableReads = pageCount === previousPageCount ? stableReads + 1 : 0;
      previousPageCount = pageCount;
      if (stableReads >= MANAGED_WINDOW_SETTLE_STABLE_READS) {
        return Object.freeze({
          materialized: true,
          bootstrapTargetId: bootstrapTarget.targetId,
          pageCount,
        });
      }
    }
    throw new Error('CHROMIUM_HARNESS_MANAGED_WINDOW_SETTLE_TIMEOUT');
  }

  async reserveRecoveryTarget(purpose, initialUrl = null) {
    if (!this.recoveryJournal) return null;
    return this.recoveryJournal.reserveTarget({
      browserEpoch: this.targetLease.browserEpoch,
      purpose,
      initialUrl,
    });
  }

  async installRecoveryTargetMarker(target, reservation) {
    if (!this.recoveryJournal || !reservation) return null;
    if (typeof target?.sessionId !== 'string' || !target.sessionId) {
      throw new Error('CHROMIUM_HARNESS_RECOVERY_TARGET_SESSION_REQUIRED');
    }
    const source = buildQaRecoveryTargetMarkerSource(reservation);
    await this.cdp.send(
      'Page.addScriptToEvaluateOnNewDocument',
      { source },
      target.sessionId,
    );
    const marker = await evaluate(this.cdp, target.sessionId, source, {
      awaitPromise: false,
      timeoutMs: 1_000,
    });
    if (marker !== reservation.targetNonce) {
      throw new Error('CHROMIUM_HARNESS_RECOVERY_TARGET_MARKER_UNVERIFIED');
    }
    await this.recoveryJournal.admitTarget({
      reservationId: reservation.reservationId,
      targetId: target.targetId,
      tabId: Number.isInteger(target.tabId) ? target.tabId : null,
      proofKind: 'runtime_marker',
      initialUrl: reservation.initialUrl,
    });
    return reservation;
  }

  async registerOwnedTarget(
    target,
    purpose,
    initialUrl = null,
    { recoveryReservation = null, recoveryAdmitted = false, journal = true } = {},
  ) {
    const record = this.targetLease.register({
      targetId: target.targetId,
      tabId: Number.isInteger(target.tabId) ? target.tabId : null,
      purpose,
      initialUrl,
    });
    if (!this.recoveryJournal || journal !== true) return record;
    let reservation = recoveryReservation;
    if (!reservation) {
      reservation = await this.reserveRecoveryTarget(purpose, initialUrl);
    }
    if (!recoveryAdmitted) {
      if (typeof target.sessionId === 'string' && target.sessionId) {
        await this.installRecoveryTargetMarker(target, reservation);
      } else if (
        typeof initialUrl === 'string'
        && /^about:blank#browser-qa-owner=[a-f0-9-]+$/u.test(initialUrl)
      ) {
        await this.recoveryJournal.admitTarget({
          reservationId: reservation.reservationId,
          targetId: target.targetId,
          tabId: Number.isInteger(target.tabId) ? target.tabId : null,
          proofKind: 'exact_initial_url',
          initialUrl,
        });
      } else {
        throw new Error('CHROMIUM_HARNESS_RECOVERY_TARGET_PROOF_REQUIRED');
      }
    }
    this.recoveryTargets.set(target.targetId, reservation.reservationId);
    return record;
  }

  async releaseOwnedTarget(targetId, {
    allowConfirmedBrowserDisconnect = false,
  } = {}) {
    const receipt = await this.targetLease.release(targetId, {
      closeTarget: (ownedTargetId) => closePageTarget(this.cdp, ownedTargetId, {
        allowConfirmedBrowserDisconnect,
      }),
    });
    if (this.recoveryTargets.has(targetId)) {
      await this.recoveryJournal.releaseTarget({
        targetId,
        status: receipt.status,
      });
      this.recoveryTargets.delete(targetId);
    }
    return receipt;
  }

  async runManagedAttachedExtensionLoadMutation(operation, {
    loadExtension = (params) => this.cdp.send('Extensions.loadUnpacked', params),
  } = {}) {
    if (
      !this.cdp
      || !this.attachOnly
      || this.browserExecution?.startPolicy !== 'managed_ensure_before_attach'
      || typeof operation !== 'function'
      || typeof loadExtension !== 'function'
      || !this.chromeAttachSpec?.extensionDir
    ) {
      throw new Error('CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_OWNER_INVALID');
    }
    let loadIssued = false;
    let anchorTarget = null;
    let baselineTargetIds = null;
    let operationResult;
    let operationError = null;
    try {
      operationResult = await operation(async (params) => {
        if (
          loadIssued
          || !params
          || typeof params !== 'object'
          || Array.isArray(params)
          || Object.keys(params).length !== 1
          || params.path !== this.chromeAttachSpec.extensionDir
        ) {
          throw new Error('CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_REQUEST_INVALID');
        }
        await this.materializeManagedBrowserWindow();
        this.managedDeveloperModeReceipt = await this.prepareExtensionDeveloperMode({ managed: true });
        const baselineTargets = await getTargetInfos(this.cdp);
        baselineTargetIds = new Set(
          baselineTargets.map((target) => target.targetId),
        );
        const recoveryReservation = await this.reserveRecoveryTarget(
          'managed_extension_load_anchor',
        );
        anchorTarget = await createQaCdpPageTarget(this.cdp, {
          url: EXACT_BLANK_PAGE_URL,
          background: true,
          recoverAmbiguousCreation: true,
          ownerPurpose: 'managed_extension_load_anchor',
          browserEpoch: this.targetLease.browserEpoch,
        });
        if (baselineTargetIds.has(anchorTarget.targetId)) {
          throw managedExtensionLoadTargetBlocked('anchor_identity_collision');
        }
        await this.registerOwnedTarget(
          anchorTarget,
          'managed_extension_load_anchor',
          anchorTarget.initialUrl,
          { recoveryReservation },
        );
        let preLoadTargets;
        try {
          preLoadTargets = await getTargetInfos(this.cdp);
        } catch {
          throw managedExtensionLoadTargetBlocked(
            'preload_target_snapshot_unavailable',
          );
        }
        const preLoadPageDrift = findUnexpectedPageTargets(
          preLoadTargets,
          baselineTargetIds,
          anchorTarget.targetId,
        );
        if (preLoadPageDrift.length > 0) {
          throw managedExtensionLoadTargetBlocked(
            'preload_page_delta',
            preLoadPageDrift.length,
            preLoadPageDrift,
          );
        }
        loadIssued = true;
        let result;
        let loadError = null;
        try {
          result = await loadExtension({ path: this.chromeAttachSpec.extensionDir });
        } catch (error) {
          loadError = error;
        }
        let responseTargets;
        try {
          responseTargets = await getTargetInfos(this.cdp);
        } catch {
          throw managedExtensionLoadTargetBlocked(
            'response_target_snapshot_unavailable',
          );
        }
        const responsePageDrift = findUnexpectedPageTargets(
          responseTargets,
          baselineTargetIds,
          anchorTarget.targetId,
        );
        if (responsePageDrift.length > 0) {
          throw managedExtensionLoadTargetBlocked(
            'postload_page_delta',
            responsePageDrift.length,
            responsePageDrift,
          );
        }
        if (loadError) throw loadError;
        return result;
      });
    } catch (error) {
      operationError = error;
    }

    if (loadIssued && anchorTarget && baselineTargetIds) {
      try {
        const finalTargets = await getTargetInfos(this.cdp);
        const finalPageDrift = findUnexpectedPageTargets(
          finalTargets,
          baselineTargetIds,
          anchorTarget.targetId,
        );
        if (finalPageDrift.length > 0) {
          operationError = managedExtensionLoadTargetBlocked(
            'postload_page_delta',
            finalPageDrift.length,
            finalPageDrift,
          );
        }
      } catch (error) {
        operationError = error?.code === 'CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_BLOCKED'
          ? error
          : managedExtensionLoadTargetBlocked('final_target_snapshot_unavailable');
      }
    }
    let anchorCleanupError = null;
    if (anchorTarget && this.targetLease.owns(anchorTarget.targetId)) {
      try {
        await this.releaseOwnedTarget(anchorTarget.targetId);
        this.managedExtensionLoadAnchorCleanupCount += 1;
      } catch (error) {
        anchorCleanupError = error;
      }
    }
    if (anchorCleanupError && operationError) {
      const error = new AggregateError(
        [operationError, anchorCleanupError],
        'CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_AND_ANCHOR_CLEANUP_FAILED',
      );
      error.code = 'CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_AND_ANCHOR_CLEANUP_FAILED';
      error.stage = 'managed_extension_load_anchor_cleanup';
      throw error;
    }
    if (anchorCleanupError) {
      const error = new Error(
        'CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_ANCHOR_CLEANUP_FAILED',
      );
      error.code = 'CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_ANCHOR_CLEANUP_FAILED';
      error.stage = 'managed_extension_load_anchor_cleanup';
      throw error;
    }
    if (operationError) throw operationError;
    return operationResult;
  }

  async synchronizeManagedAttachedArtifactRuntime(extensionInstall) {
    if (!this.attachedArtifactStage) return null;
    if (
      this.browserExecution?.startPolicy !== 'managed_ensure_before_attach'
      || this.attachedArtifactStage.mutationPolicy !== 'managed_atomic_sync'
      || !this.attachedArtifactStageReceipt
      || !['reused_exact_slot', 'staged_changed']
        .includes(this.attachedArtifactStageReceipt.action)
      || this.attachedArtifactStageReceipt.contentIdentityDigest
        !== this.attachedArtifactStage.contentIdentityDigest
      || !extensionInstall
      || extensionInstall.extensionId !== this.extensionId
      || !['already_active', 'loaded_exact_slot'].includes(
        extensionInstall.managedSlotAction,
      )
    ) {
      throw new Error('CHROMIUM_HARNESS_MANAGED_ARTIFACT_SYNC_CONTRACT_INVALID');
    }
    const browserEpoch = this.targetLease.browserEpoch;
    let activationAction = null;
    let reloadIssued = false;
    let runtimeRefresh = false;
    let runtimeReadiness = null;
    if (extensionInstall.managedSlotAction === 'loaded_exact_slot') {
      activationAction = 'loaded_exact_slot';
      runtimeRefresh = true;
    } else {
      const activationReceipt = this.attachedArtifactStageReceipt.action
        === 'reused_exact_slot'
        ? await readEntropyQaArtifactActivationReceipt({
          slotDir: this.extensionDir,
          contentIdentityDigest: this.attachedArtifactStageReceipt.contentIdentityDigest,
          browserEpoch,
          extensionId: this.extensionId,
        })
        : null;
      if (activationReceipt) {
        activationAction = 'reused_active_runtime';
      } else {
        await this.reloadExtensionFromSource();
        activationAction = 'reloaded_exact_slot';
        reloadIssued = true;
        runtimeRefresh = true;
      }
    }
    {
      const readinessContext = Object.freeze({
        harness: this,
        stageAction: this.attachedArtifactStageReceipt.action,
        activationAction,
        contentIdentityDigest: this.attachedArtifactStageReceipt.contentIdentityDigest,
        browserEpoch,
        extensionId: this.extensionId,
        artifactIdentity: this.attachedArtifactStage.artifactIdentity,
        temporaryManifest: this.attachedArtifactStage.temporaryManifest,
        trustedPagePath: this.trustedPagePath,
        runtimeRefresh,
        reloadIssued,
      });
      runtimeReadiness = await this.attachedArtifactRuntimeReadiness(readinessContext);
      const runtimeArtifactIdentity = runtimeReadiness?.artifactRuntimeIdentity;
      if (
        !runtimeReadiness
        || typeof runtimeReadiness !== 'object'
        || Array.isArray(runtimeReadiness)
        || runtimeReadiness.status !== 'attached_artifact_runtime_ready'
        || runtimeReadiness.runtimeReady !== true
        || runtimeReadiness.contentIdentityDigest
          !== this.attachedArtifactStageReceipt.contentIdentityDigest
        || runtimeArtifactIdentity?.status !== 'artifact_runtime_identity_verified'
        || runtimeArtifactIdentity.buildId
          !== this.attachedArtifactStage.artifactIdentity.buildId
        || runtimeArtifactIdentity.releaseProfile
          !== this.attachedArtifactStage.artifactIdentity.releaseProfile
        || runtimeArtifactIdentity.trustedPagePath !== this.trustedPagePath
        || JSON.stringify(runtimeArtifactIdentity.requiredPermissions)
          !== JSON.stringify(this.attachedArtifactStage.temporaryManifest.requiredPermissions)
        || JSON.stringify(runtimeArtifactIdentity.requiredHostPermissions)
          !== JSON.stringify(
            this.attachedArtifactStage.temporaryManifest.requiredHostPermissions,
          )
      ) {
        throw new Error('CHROMIUM_HARNESS_ATTACHED_ARTIFACT_RUNTIME_NOT_READY');
      }
      await writeEntropyQaArtifactActivationReceipt({
        slotDir: this.extensionDir,
        contentIdentityDigest: this.attachedArtifactStageReceipt.contentIdentityDigest,
        browserEpoch,
        extensionId: this.extensionId,
      });
    }
    return Object.freeze({
      status: 'managed_artifact_runtime_ready',
      stageAction: this.attachedArtifactStageReceipt.action,
      activationAction,
      contentIdentityDigest: this.attachedArtifactStageReceipt.contentIdentityDigest,
      browserEpoch,
      extensionId: this.extensionId,
      runtimeRefresh,
      reloadIssued,
      runtimeReadyProved: true,
      runtimeReadiness: Object.freeze({ ...runtimeReadiness }),
    });
  }

  async start() {
    this.unregisterChildAbortCleanup = registerQaChildAbortCleanup(async () => {
      // Startup's own failure path releases partial resources. Wait for that
      // owner before attempting another close; a stuck startup gets Job-bound escalation.
      try { await this.childStartupOperation; } catch { /* close below must still prove cleanup */ }
      await this.close();
    });
    this.childStartupOperation = this.startInternal();
    return this.childStartupOperation;
  }

  async startInternal() {
    if (this.cdp) throw new Error('CHROMIUM_HARNESS_ALREADY_STARTED');
    const tempParent = await resolveChromiumHarnessTempParent(this.chromePath);
    const tempParentStat = await fs.lstat(tempParent).catch(() => null);
    if (!tempParentStat?.isDirectory() || tempParentStat.isSymbolicLink()) {
      throw new Error(`CHROMIUM_HARNESS_TEMP_PARENT_INVALID:${tempParent}`);
    }
    this.tempRoot = await fs.mkdtemp(path.join(tempParent, this.tempPrefix));

    try {
      const browserResourceIdentities = this.attachOnly
        ? resolveBrowserQaPhysicalResourceIdentities({
          cdpEndpoint: this.cdpEndpoint,
          userDataDir: this.expectedBrowserIdentity.userDataDir,
          profileDirectory: this.expectedBrowserIdentity.profileDirectory,
        })
        : null;
      this.browserCapacityLease = await acquireQaBrowserCapacity({
        rootDir: this.rootDir,
        ownerId: `extension-chromium:${this.tempPrefix}:pid=${process.pid}`,
        browserResourceIdentities,
        reservationMode: this.capacityReservationMode,
      });
      if (this.qaProfileDir) {
        this.userDataDir = await validateEntropyQaProfile(this.qaProfileDir, {
          allowProvisioning: this.allowProvisioningQaProfile,
          allowLocked: this.attachOnly,
        });
        this.qaProfileDirectory = await validateQaProfileDirectoryName(
          this.userDataDir,
          this.qaProfileDirectory,
        );
        if (
          isWslWindowsChromeExecutable(this.chromePath)
          && !isWslWindowsDrivePath(this.userDataDir)
        ) {
          throw new Error(
            `CHROMIUM_HARNESS_WSL_WINDOWS_QA_PROFILE_DRIVE_PATH_REQUIRED:${this.userDataDir}`,
          );
        }
      } else {
        this.userDataDir = path.join(this.tempRoot, 'profile');
        await fs.mkdir(this.userDataDir, { recursive: true });
      }
      if (this.attachedArtifactStage) {
        const staged = await stageEntropyQaArtifact({
          profileDir: this.userDataDir,
          sourceDir: this.attachedArtifactStage.sourceDir,
          expectedSlotDir: this.sourceDir,
          temporaryManifest: this.attachedArtifactStage.temporaryManifest || null,
          artifactIdentity: this.attachedArtifactStage.artifactIdentity,
          reuseExisting: true,
        });
        if (path.normalize(staged.slotDir) !== this.sourceDir) {
          throw new Error('CHROMIUM_HARNESS_ATTACHED_ARTIFACT_STAGE_RECEIPT_INVALID');
        }
        this.attachedArtifactStageReceipt = staged;
      }
      if (this.extensionEnabled) {
        const prepared = await prepareExtensionForChromiumHarness({
          sourceDir: this.sourceDir,
          tempRoot: this.tempRoot,
          trustedPagePath: this.trustedPagePath,
          trustedPageSource: this.trustedPageSource,
          loadInPlace: this.loadInPlace,
          temporaryManifest: this.temporaryManifest,
        });
        this.extensionDir = prepared.extensionDir;
        this.manifest = prepared.manifest;
        this.trustedPagePath = prepared.trustedPagePath;
      }

      if (this.attachOnly) {
        this.chromeAttachSpec = await createChromeAttachSpec({
          chromePath: this.chromePath,
          userDataDir: this.userDataDir,
          profileDirectory: this.qaProfileDirectory,
          extensionDir: this.extensionDir,
        });
        this.browserVersion = await readChromiumDebugEndpoint(this.cdpEndpoint);
        this.cdp = new CdpConnection(this.browserVersion.webSocketDebuggerUrl, {
          commandTimeoutMs: this.cdpCommandTimeoutMs,
        });
        await this.cdp.open();
        this.browserIdentity = await verifyExtensionHarnessAttachedBrowser(this.cdp, {
          cdpEndpoint: this.cdpEndpoint,
          expectedBrowserIdentity: this.expectedBrowserIdentity,
        });
        if (this.renderingRequirement) {
          this.gpuCapability = await probeQaBrowserGpuCapability(this.cdp, {
            renderingRequirement: this.renderingRequirement,
          });
        }
        const attachBaselineTargets = await getTargetInfos(this.cdp);
        this.resetBrowserTargetLease(attachBaselineTargets);
        await this.recoveryJournal?.recordBrowser({
          processOwnership: 'attach_only',
          browserEpoch: this.targetLease.browserEpoch,
          cdpEndpoint: this.cdpEndpoint,
          executable: this.expectedBrowserIdentity.executable,
          userDataDir: this.expectedBrowserIdentity.userDataDir,
          profileDirectory: this.expectedBrowserIdentity.profileDirectory,
          profileSlotId: this.expectedBrowserIdentity.profileSlotId || null,
          installationId: this.expectedBrowserIdentity.installationId || null,
          platform: this.expectedBrowserIdentity.platform || null,
        });
        const extensionInstall = this.browserExecution?.startPolicy
          === 'managed_ensure_before_attach'
          ? await this.runManagedAttachedExtensionLoadMutation((loadUnpacked) => (
            ensureManagedAttachedExtensionSlot(
              this.cdp,
              this.chromeAttachSpec.extensionDir,
              { loadUnpacked },
            )
          ))
          : await resolveAttachedHarnessExtension(
            this.cdp,
            this.chromeAttachSpec.extensionDir,
          );
        this.extensionId = extensionInstall.extensionId;
        this.extensionInstallMode = extensionInstall.installMode;
        this.managedExtensionSlotAction = extensionInstall.managedSlotAction || null;
        this.uninstallExtensionOnClose = extensionInstall.uninstallOnClose;
        this.attachedArtifactSyncReceipt = await this
          .synchronizeManagedAttachedArtifactRuntime(extensionInstall);
        return this;
      }

      const remoteDebuggingPort = await allocateChromiumHarnessDebugPort(this.chromePath);
      this.chromeLaunchSpec = await createChromeLaunchSpec({
        chromePath: this.chromePath,
        userDataDir: this.userDataDir,
        profileDirectory: this.qaProfileDirectory,
        extensionDir: this.extensionDir,
        extensionEnabled: this.extensionEnabled,
        remoteDebuggingPort,
        headless: this.headless,
        audioPolicy: this.audioPolicy,
        browserExecution: this.browserExecution,
        displayReceipt: this.displayReceipt,
        gpuInfoCollectionPolicy: this.gpuInfoCollectionPolicy,
      });
      this.chrome = launchChrome({
        ...this.chromeLaunchSpec,
        launchEnvironment: this.launchEnvironment,
      });
      this.chrome.stderr.on('data', (chunk) => {
        const message = String(chunk).trim();
        if (!message) return;
        this.chromeStderr.push(message);
        if (this.chromeStderr.length > 20) this.chromeStderr.shift();
      });

      this.browserVersion = await waitForDebugEndpoint(remoteDebuggingPort);
      this.cdp = new CdpConnection(this.browserVersion.webSocketDebuggerUrl, {
        commandTimeoutMs: this.cdpCommandTimeoutMs,
      });
      await this.cdp.open();
      this.browserIdentity = await verifyQaOwnedChromiumEndpointIdentity(
        this.chrome,
        this.cdp,
      );
      this.ownedBrowserIdentityVerified = true;
      if (this.renderingRequirement) {
        this.gpuCapability = await probeQaBrowserGpuCapability(this.cdp, {
          renderingRequirement: this.renderingRequirement,
        });
      }
      const startupTargets = await getTargetInfos(this.cdp);
      this.startupBlankTargetIds = new Set(
        startupTargets
          .filter((target) => isExactBlankPageTarget(target))
          .map((target) => target.targetId),
      );
      this.startupQaPageTargetIds = new Set(
        this.qaProfileDir
          ? startupTargets
            .filter((target) => target?.type === 'page' && target?.targetId)
            .map((target) => target.targetId)
          : [],
      );
      this.resetBrowserTargetLease(startupTargets);
      await this.recoveryJournal?.recordBrowser({
        processOwnership: 'owned',
        browserEpoch: this.targetLease.browserEpoch,
        cdpEndpoint: `http://127.0.0.1:${remoteDebuggingPort}`,
        executable: this.chromePath,
        userDataDir: this.userDataDir,
        profileDirectory: this.qaProfileDirectory,
      });
      await this.recoveryJournal?.recordOwnedProcess(
        readQaOwnedChromiumRecoveryIdentity(this.chrome),
      );
      for (const targetId of new Set([
        ...this.startupBlankTargetIds,
        ...this.startupQaPageTargetIds,
      ])) {
        const target = startupTargets.find((candidate) => (
          candidate?.targetId === targetId
        ));
        await this.registerOwnedTarget(
          { targetId, tabId: null },
          'browser_startup_page',
          target?.url || null,
          { journal: false },
        );
      }
      if (this.extensionEnabled) {
        const extensionInstall = await installHarnessExtension(
          this.cdp,
          this.chromeLaunchSpec.extensionDir,
        );
        this.extensionId = extensionInstall.extensionId;
        this.extensionInstallMode = extensionInstall.installMode;
        this.uninstallExtensionOnClose = extensionInstall.uninstallOnClose;
      } else {
        this.extensionInstallMode = 'disabled';
      }
      return this;
    } catch (error) {
      const stderr = this.chromeStderr.at(-1);
      const cleanupError = await this.close().then(() => null, (closeError) => closeError);
      if (stderr && error instanceof Error) {
        error.message = `${error.message}; chromium=${stderr}`;
      }
      if (cleanupError && error instanceof Error) {
        error.message = `${error.message}; cleanup=${cleanupError?.message || cleanupError}`;
      }
      throw error;
    }
  }

  async withTrustedPage(worker, {
    openTimeoutMs = DEFAULT_TRUSTED_PAGE_OPEN_TIMEOUT_MS,
    deadlineAtMs = null,
  } = {}) {
    if (!this.extensionEnabled) {
      throw new Error('CHROMIUM_HARNESS_EXTENSION_DISABLED');
    }
    if (!this.cdp || !this.extensionId) {
      throw new Error('CHROMIUM_HARNESS_NOT_STARTED');
    }
    if (!Number.isInteger(openTimeoutMs) || openTimeoutMs <= 0) {
      throw new Error(`CHROMIUM_HARNESS_TRUSTED_PAGE_OPEN_TIMEOUT_INVALID:${openTimeoutMs}`);
    }
    const absoluteDeadlineAtMs = normalizeOptionalDeadlineAtMs(
      deadlineAtMs,
      'CHROMIUM_HARNESS_TRUSTED_PAGE_DEADLINE_INVALID',
    );
    const remainingTimeoutMs = () => (
      absoluteDeadlineAtMs === null
        ? openTimeoutMs
        : Math.min(
          openTimeoutMs,
          requireRemainingDeadlineMs(
            absoluteDeadlineAtMs,
            'CHROMIUM_HARNESS_TRUSTED_PAGE_DEADLINE_EXHAUSTED',
          ),
        )
    );
    if (!this.trustedPageTarget) {
      const trustedUrl = `chrome-extension://${this.extensionId}/${this.trustedPagePath}`;
      const recoveryReservation = await this.reserveRecoveryTarget(
        'trusted_page',
        'about:blank',
      );
      const target = await openPageTarget(this.cdp, trustedUrl, {
        background: this.attachOnly,
        timeoutMs: remainingTimeoutMs(),
        deadlineAtMs: absoluteDeadlineAtMs,
        browserEpoch: this.targetLease.browserEpoch,
        onTargetReady: recoveryReservation
          ? (readyTarget) => this.installRecoveryTargetMarker(
            readyTarget,
            recoveryReservation,
          )
          : null,
      });
      await this.registerOwnedTarget(target, 'trusted_page', 'about:blank', {
        recoveryReservation,
        recoveryAdmitted: recoveryReservation !== null,
      });
      try {
        const urlProofTimeoutMs = Math.min(1_000, remainingTimeoutMs());
        const actualUrl = await evaluate(this.cdp, target.sessionId, 'location.href', {
          awaitPromise: false,
          timeoutMs: urlProofTimeoutMs,
          commandTimeoutMs: remainingTimeoutMs(),
        });
        if (actualUrl !== trustedUrl) {
          throw new Error(`TRUSTED_EXTENSION_PAGE_LOAD_FAILED:${actualUrl || 'unknown'}`);
        }
      } catch (error) {
        const cleanupError = await this.releaseOwnedTarget(target.targetId)
          .then(() => null, (releaseError) => releaseError);
        if (cleanupError && error instanceof Error) {
          error.message = `${error.message}; cleanup=${cleanupError?.message || cleanupError}`;
        }
        throw error;
      }
      this.trustedPageTarget = target;
    }
    if (absoluteDeadlineAtMs !== null) remainingTimeoutMs();
    return worker(this.trustedPageTarget.sessionId, this.trustedPageTarget);
  }

  async evaluateInTrustedPage(expression, options = {}) {
    const {
      trustedPageDeadlineAtMs = null,
      ...evaluationOptions
    } = options;
    if (trustedPageDeadlineAtMs === null) {
      return this.withTrustedPage((sessionId) => evaluate(
        this.cdp,
        sessionId,
        expression,
        evaluationOptions,
      ));
    }
    const remainingUntilDeadline = () => {
      normalizeOptionalDeadlineAtMs(
        trustedPageDeadlineAtMs,
        'CHROMIUM_HARNESS_TRUSTED_PAGE_DEADLINE_INVALID',
      );
      return requireRemainingDeadlineMs(
        trustedPageDeadlineAtMs,
        'CHROMIUM_HARNESS_TRUSTED_PAGE_DEADLINE_EXHAUSTED',
      );
    };
    const requestedEvaluationTimeoutMs = evaluationOptions.timeoutMs
      ?? DEFAULT_CDP_COMMAND_TIMEOUT_MS;
    if (
      !Number.isInteger(requestedEvaluationTimeoutMs)
      || requestedEvaluationTimeoutMs <= 0
    ) {
      throw new Error(
        `CHROMIUM_HARNESS_TRUSTED_PAGE_EVALUATION_TIMEOUT_INVALID:`
          + `${requestedEvaluationTimeoutMs}`,
      );
    }
    const openTimeoutMs = remainingUntilDeadline();
    return this.withTrustedPage((sessionId) => evaluate(
      this.cdp,
      sessionId,
      expression,
      {
        ...evaluationOptions,
        timeoutMs: Math.min(
          requestedEvaluationTimeoutMs,
          remainingUntilDeadline(),
        ),
        commandTimeoutMs: remainingUntilDeadline(),
      },
    ), {
      openTimeoutMs,
      deadlineAtMs: trustedPageDeadlineAtMs,
    });
  }

  async closeStartupBlankPages() {
    if (this.attachOnly) return [];
    if (this.qaProfileDir && this.startupQaPageTargetIds.size > 0) {
      const startupTargetIds = [...this.startupQaPageTargetIds];
      const closedTargetIds = [];
      for (const targetId of startupTargetIds) {
        await this.releaseOwnedTarget(targetId);
        this.startupQaPageTargetIds.delete(targetId);
        this.startupBlankTargetIds.delete(targetId);
        closedTargetIds.push(targetId);
      }
      return closedTargetIds;
    }
    if (!this.cdp || this.startupBlankTargetIds.size === 0) return [];
    const startupTargetIds = new Set(this.startupBlankTargetIds);
    const exactBlankTargetIds = (await getTargetInfos(this.cdp))
      .filter((target) => (
        isExactBlankPageTarget(target) && startupTargetIds.has(target.targetId)
      ))
      .map((target) => target.targetId);
    const closedTargetIds = [];
    for (const targetId of exactBlankTargetIds) {
      await this.releaseOwnedTarget(targetId);
      closedTargetIds.push(targetId);
    }
    this.startupBlankTargetIds.clear();
    return closedTargetIds;
  }

  async openPage(url, {
    active = false,
    timeoutMs = 30_000,
    sameWindowAs = null,
  } = {}) {
    if (!this.cdp || (this.extensionEnabled && !this.extensionId)) {
      throw new Error('CHROMIUM_HARNESS_NOT_STARTED');
    }
    if (typeof url !== 'string' || !url.trim()) {
      throw new Error('CHROMIUM_PAGE_URL_REQUIRED');
    }
    if (this.attachOnly && active === true) {
      throw new Error('CHROMIUM_HARNESS_ATTACH_ACTIVE_TAB_FORBIDDEN');
    }
    let windowId = null;
    if (sameWindowAs !== null) {
      if (this.attachOnly || !this.extensionEnabled) {
        throw new Error('CHROMIUM_HARNESS_SAME_WINDOW_OWNED_EXTENSION_REQUIRED');
      }
      if (this.browserExecution && (
        this.browserExecution.processOwnership !== 'owned'
        || this.browserExecution.targetActivation !== 'active'
        || this.browserExecution.osFocus !== 'never'
      )) {
        throw new Error('CHROMIUM_HARNESS_SAME_WINDOW_CONTRACT_MISMATCH');
      }
      const referencePage = requireExactOwnedHarnessPage(
        this, sameWindowAs, 'CHROMIUM_HARNESS_SAME_WINDOW_PAGE_NOT_OWNED',
      );
      const referenceTab = await this.resolveTabForPage(referencePage);
      if (!Number.isInteger(referenceTab.windowId)) {
        throw new Error('CHROMIUM_HARNESS_SAME_WINDOW_ID_REQUIRED');
      }
      windowId = referenceTab.windowId;
    }
    if (!this.extensionEnabled) {
      const recoveryReservation = await this.reserveRecoveryTarget(
        'scenario_page',
        'about:blank',
      );
      const target = await openPageTarget(this.cdp, url, {
        timeoutMs,
        browserEpoch: this.targetLease.browserEpoch,
        onTargetReady: recoveryReservation
          ? (readyTarget) => this.installRecoveryTargetMarker(
            readyTarget,
            recoveryReservation,
          )
          : null,
      });
      const page = { ...target, tabId: null };
      await this.registerOwnedTarget(page, 'scenario_page', 'about:blank', {
        recoveryReservation,
        recoveryAdmitted: recoveryReservation !== null,
      });
      try {
        await this.closeStartupBlankPages();
        this.pageTargets.set(page.targetId, page);
        return page;
      } catch (error) {
        const cleanupError = await this.releaseOwnedTarget(page.targetId)
          .then(() => null, (releaseError) => releaseError);
        if (cleanupError && error instanceof Error) {
          error.message = `${error.message}; cleanup=${cleanupError?.message || cleanupError}`;
        }
        throw error;
      }
    }
    const recoveryReservation = await this.reserveRecoveryTarget('scenario_page');
    const pageNonce = recoveryReservation?.targetNonce || randomUUID();
    const markerUrl = `chrome-extension://${this.extensionId}/${this.trustedPagePath}`
      + `?entropyHarnessPage=${encodeURIComponent(pageNonce)}`;
    let tab = null;
    let target = null;
    try {
      tab = await createTabThroughTrustedPage(this, markerUrl, active, windowId);
      if (windowId !== null && (tab.windowId !== windowId || tab.active !== !!active)) {
        throw new Error('CHROMIUM_HARNESS_SAME_WINDOW_CREATE_MISMATCH');
      }
      const targetInfo = await waitForPageTargetByUrl(this.cdp, markerUrl, timeoutMs);
      target = await openPageTarget(this.cdp, url, {
        targetId: targetInfo.targetId,
        timeoutMs,
        onTargetReady: recoveryReservation
          ? (readyTarget) => this.installRecoveryTargetMarker(
            { ...readyTarget, tabId: tab.id },
            recoveryReservation,
          )
          : null,
      });
      const page = {
        ...target,
        tabId: tab.id,
      };
      await this.registerOwnedTarget(page, 'scenario_page', markerUrl, {
        recoveryReservation,
        recoveryAdmitted: recoveryReservation !== null,
      });
      await this.closeStartupBlankPages();
      this.pageTargets.set(page.targetId, page);
      return page;
    } catch (error) {
      const cleanupErrors = [];
      if (tab?.id) {
        await removeTabThroughTrustedPage(this, tab.id).catch((cleanupError) => {
          cleanupErrors.push(cleanupError);
        });
      }
      if (target?.targetId) {
        const closePromise = this.targetLease.owns(target.targetId)
          ? this.releaseOwnedTarget(target.targetId)
          : closePageTarget(this.cdp, target.targetId);
        await closePromise.catch((cleanupError) => {
          cleanupErrors.push(cleanupError);
        });
      }
      if (cleanupErrors.length > 0 && error instanceof Error) {
        error.message = `${error.message}; cleanup=${cleanupErrors
          .map((cleanupError) => cleanupError?.message || cleanupError)
          .join('|')}`;
      }
      throw error;
    }
  }

  async resolveTabForPage(page) {
    if (!this.extensionEnabled) {
      throw new Error('CHROMIUM_HARNESS_EXTENSION_DISABLED');
    }
    requireHarnessPage(page);
    if (!Number.isInteger(page.tabId)) {
      throw new Error('CHROMIUM_HARNESS_PAGE_TAB_ID_REQUIRED');
    }
    return readTabThroughTrustedPage(this, page.tabId);
  }

  async activateOwnedPageWithoutWindowFocus(page) {
    if (!this.attachOnly) {
      throw new Error('CHROMIUM_HARNESS_NO_FOCUS_ACTIVATION_ATTACH_ONLY');
    }
    const target = requireExactOwnedHarnessPage(
      this,
      page,
      'CHROMIUM_HARNESS_NO_FOCUS_ACTIVATION_PAGE_NOT_OWNED',
    );
    if (!Number.isInteger(target.tabId)) {
      throw new Error('CHROMIUM_HARNESS_PAGE_TAB_ID_REQUIRED');
    }
    const result = await this.evaluateInTrustedPage(`new Promise((resolve) => {
      chrome.tabs.update(${JSON.stringify(target.tabId)}, { active: true }, (tab) => {
        const error = chrome.runtime.lastError?.message || null;
        resolve({
          error,
          tab: tab && Number.isInteger(tab.id) ? {
            id: tab.id,
            url: tab.url || null,
            status: tab.status || null,
            active: tab.active === true,
            windowId: Number.isInteger(tab.windowId) ? tab.windowId : null,
          } : null,
        });
      });
    })`);
    if (
      result?.error
      || result?.tab?.id !== target.tabId
      || result?.tab?.active !== true
    ) {
      throw new Error(
        `CHROMIUM_HARNESS_NO_FOCUS_ACTIVATION_FAILED:${result?.error || target.tabId}`,
      );
    }
    return Object.freeze({
      ...result.tab,
      windowFocusRequested: false,
    });
  }

  async activateOwnedEphemeralPageWithoutWindowFocus(page) {
    if (this.attachOnly) {
      throw new Error('CHROMIUM_HARNESS_EPHEMERAL_ACTIVATION_OWNED_BROWSER_REQUIRED');
    }
    if (
      this.browserExecution
      && (
        this.browserExecution.processOwnership !== 'owned'
        || this.browserExecution.targetActivation !== 'active'
        || this.browserExecution.osFocus !== 'never'
      )
    ) {
      throw new Error('CHROMIUM_HARNESS_EPHEMERAL_ACTIVATION_CONTRACT_MISMATCH');
    }
    const target = requireExactOwnedHarnessPage(
      this,
      page,
      'CHROMIUM_HARNESS_EPHEMERAL_ACTIVATION_PAGE_NOT_OWNED',
    );
    if (!Number.isInteger(target.tabId)) {
      throw new Error('CHROMIUM_HARNESS_PAGE_TAB_ID_REQUIRED');
    }
    const result = await this.evaluateInTrustedPage(`new Promise((resolve) => {
      chrome.tabs.update(${JSON.stringify(target.tabId)}, { active: true }, (updatedTab) => {
        const updateError = chrome.runtime.lastError?.message || null;
        if (
          updateError
          || !updatedTab
          || updatedTab.id !== ${JSON.stringify(target.tabId)}
          || updatedTab.active !== true
          || !Number.isInteger(updatedTab.windowId)
        ) {
          resolve({ updateError, queryError: null, updatedTab: null, activeTabIds: null });
          return;
        }
        chrome.tabs.query({ active: true, windowId: updatedTab.windowId }, (activeTabs) => {
          const queryError = chrome.runtime.lastError?.message || null;
          resolve({
            updateError: null,
            queryError,
            updatedTab: {
              id: updatedTab.id,
              active: updatedTab.active === true,
              windowId: updatedTab.windowId,
            },
            activeTabIds: Array.isArray(activeTabs)
              ? activeTabs
                .filter((tab) => Number.isInteger(tab?.id) && tab.active === true)
                .map((tab) => tab.id)
              : null,
          });
        });
      });
    })`);
    if (
      result?.updateError
      || result?.queryError
      || result?.updatedTab?.id !== target.tabId
      || result?.updatedTab?.active !== true
      || !Number.isInteger(result?.updatedTab?.windowId)
      || !Array.isArray(result?.activeTabIds)
      || result.activeTabIds.length !== 1
      || result.activeTabIds[0] !== target.tabId
    ) {
      throw new Error(
        'CHROMIUM_HARNESS_EPHEMERAL_ACTIVATION_FAILED:'
          + `${result?.updateError || result?.queryError || target.tabId}`,
      );
    }
    return Object.freeze({
      active: true,
      activeTabObserved: true,
      tabId: target.tabId,
      windowId: result.updatedTab.windowId,
      windowFocusRequested: false,
    });
  }

  async navigatePage(page, url, {
    timeoutMs = 30_000,
  } = {}) {
    const target = requireHarnessPage(page);
    return navigatePageTarget(this.cdp, target.sessionId, url, { timeoutMs });
  }

  async reloadPage(page, {
    ignoreCache = false,
    timeoutMs = 30_000,
  } = {}) {
    const target = requireHarnessPage(page);
    return reloadPageTarget(this.cdp, target.sessionId, { ignoreCache, timeoutMs });
  }

  async enableNoFocusPageExecution(page) {
    if (!this.attachOnly) {
      throw new Error('CHROMIUM_HARNESS_NO_FOCUS_EXECUTION_ATTACH_ONLY');
    }
    const target = requireHarnessPage(page);
    if (!this.pageTargets.has(target.targetId)) {
      throw new Error('CHROMIUM_HARNESS_NO_FOCUS_EXECUTION_PAGE_NOT_OWNED');
    }
    await this.cdp.send('Emulation.setFocusEmulationEnabled', {
      enabled: true,
    }, target.sessionId);
    await this.cdp.send('Page.setWebLifecycleState', {
      state: 'active',
    }, target.sessionId);
    const state = await evaluate(
      this.cdp,
      target.sessionId,
      `({
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus(),
      })`,
      { awaitPromise: false, timeoutMs: 1_000 },
    );
    if (state?.visibilityState !== 'visible' || state?.hasFocus !== true) {
      throw new Error(
        `CHROMIUM_HARNESS_NO_FOCUS_EXECUTION_NOT_CONFIRMED:${JSON.stringify(state)}`,
      );
    }
    return Object.freeze({
      visibilityState: state.visibilityState,
      hasFocus: state.hasFocus,
      windowFocusRequested: false,
    });
  }

  async closePage(page) {
    const target = requireHarnessPage(page);
    if (!this.pageTargets.has(target.targetId) || !this.targetLease.owns(target.targetId)) {
      throw new Error(`CHROMIUM_HARNESS_PAGE_NOT_OWNED:${target.targetId}`);
    }
    if (Number.isInteger(target.tabId)) {
      await removeTabThroughTrustedPage(this, target.tabId);
    }
    await this.releasePageTarget(target);
  }

  async releasePageTarget(page) {
    const target = requireHarnessPage(page);
    if (!this.pageTargets.has(target.targetId) || !this.targetLease.owns(target.targetId)) {
      throw new Error(`CHROMIUM_HARNESS_PAGE_NOT_OWNED:${target.targetId}`);
    }
    await this.releaseOwnedTarget(target.targetId);
    this.pageTargets.delete(target.targetId);
  }

  async getServiceWorker() {
    if (!this.extensionEnabled) {
      throw new Error('CHROMIUM_HARNESS_EXTENSION_DISABLED');
    }
    if (!this.cdp || !this.extensionId) {
      throw new Error('CHROMIUM_HARNESS_NOT_STARTED');
    }
    return findExtensionServiceWorker(await getTargetInfos(this.cdp), this.extensionId);
  }

  async waitForServiceWorker({ previousTargetId = null, timeoutMs = 12_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastTarget = null;
    while (Date.now() < deadline) {
      lastTarget = await this.getServiceWorker();
      if (lastTarget && (!previousTargetId || lastTarget.targetId !== previousTargetId)) {
        return lastTarget;
      }
      await sleep(100);
    }
    throw new Error(`EXTENSION_SERVICE_WORKER_WAKE_TIMEOUT:${JSON.stringify({
      previousTargetId,
      lastTargetId: lastTarget?.targetId || null,
    })}`);
  }

  async releaseTrustedPage() {
    if (!this.trustedPageTarget) return;
    await this.releaseOwnedTarget(this.trustedPageTarget.targetId);
    this.trustedPageTarget = null;
  }

  async waitForExtensionActive() {
    const extensionPath = this.attachOnly ? this.chromeAttachSpec?.extensionDir : this.chromeLaunchSpec?.extensionDir;
    if (!extensionPath || !this.extensionId || !this.cdp) throw new Error('CHROMIUM_HARNESS_NOT_STARTED');
    const active = await waitForActiveUnpackedExtension(this.cdp, extensionPath, this.extensionId);
    if (!active) {
      const observed = await readUnpackedExtensionByPath(this.cdp, extensionPath);
      throw new Error(`CHROMIUM_HARNESS_EXTENSION_RELOAD_NOT_ACTIVE:${JSON.stringify({
        expectedId: this.extensionId, observedId: observed?.id || null, enabled: observed?.enabled === true,
      })}`);
    }
  }

  async withExtensionManagementPage(worker, { managed = false } = {}) {
    if (managed) {
      if (!this.attachOnly || this.browserExecution?.startPolicy !== 'managed_ensure_before_attach'
        || !this.browserIdentity || !this.browserCapacityLease || !this.attachedArtifactStageReceipt
        || !this.chromeAttachSpec?.extensionDir || !this.qaProfileDir) {
        throw new Error('CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_OWNER_INVALID');
      }
      const inventory = await this.cdp.send('Extensions.getExtensions');
      if (!Array.isArray(inventory?.extensions) || inventory.extensions.some((item) =>
        normalizeBrowserExtensionPath(item.path) !== normalizeBrowserExtensionPath(this.chromeAttachSpec.extensionDir))) {
        throw managedExtensionLoadTargetBlocked('noncanonical_unpacked_extension_present');
      }
    } else if (this.attachOnly || this.qaProfileDir || !this.ownedBrowserIdentityVerified) {
      throw new Error('CHROMIUM_HARNESS_EXTENSION_MANAGEMENT_DISPOSABLE_BROWSER_REQUIRED');
    }
    if (!this.cdp) throw new Error('CHROMIUM_HARNESS_NOT_STARTED');
    const reservation = await this.reserveRecoveryTarget('scenario_page', 'about:blank');
    const page = await openPageTarget(this.cdp, 'chrome://extensions/', {
      background: true,
      timeoutMs: 5_000,
      browserEpoch: this.targetLease.browserEpoch,
      onTargetReady: reservation
        ? (target) => this.installRecoveryTargetMarker(target, reservation)
        : null,
    });
    await this.registerOwnedTarget(page, 'scenario_page', 'about:blank', {
      recoveryReservation: reservation,
      recoveryAdmitted: reservation !== null,
    });
    try {
      return await worker(page);
    } finally {
      await this.releaseOwnedTarget(page.targetId);
    }
  }

  async prepareDisposableExtensionReload() {
    return this.prepareExtensionDeveloperMode();
  }

  async prepareExtensionDeveloperMode(options = {}) {
    return this.withExtensionManagementPage(async (page) => {
      const result = await evaluate(this.cdp, page.sessionId, `(async () => {
        if (location.href !== 'chrome://extensions/') throw new Error('EXTENSION_RELOAD_SETUP_URL_INVALID');
        const before = await chrome.developerPrivate.getProfileConfiguration();
        if (!before.inDeveloperMode) {
          await chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true });
        }
        const after = await chrome.developerPrivate.getProfileConfiguration();
        if (after.inDeveloperMode !== true) throw new Error('EXTENSION_RELOAD_DEVELOPER_MODE_NOT_ACTIVE');
        return { inDeveloperMode: true, changed: !before.inDeveloperMode };
      })()`, { timeoutMs: 5_000 });
      if (result?.inDeveloperMode !== true) {
        throw new Error('CHROMIUM_HARNESS_EXTENSION_RELOAD_SETUP_INVALID');
      }
      return Object.freeze(result);
    }, options);
  }

  async readExtensionReloadDiagnostics() {
    return this.withExtensionManagementPage((page) => (
      evaluate(this.cdp, page.sessionId, `(async () => {
        if (location.href !== 'chrome://extensions/') throw new Error('RELOAD_DIAGNOSTICS_URL_INVALID');
        const info = await chrome.developerPrivate.getExtensionInfo(${JSON.stringify(this.extensionId)});
        const profile = await chrome.developerPrivate.getProfileConfiguration();
        return {
          id: info.id, state: info.state, disableReasons: info.disableReasons,
          inDeveloperMode: profile.inDeveloperMode,
          manifestErrors: info.manifestErrors.slice(0, 8).map((error) => error.message.slice(0, 400)),
          runtimeErrors: info.runtimeErrors.slice(0, 8).map((error) => error.message.slice(0, 400)),
        };
      })()`, { timeoutMs: 5_000 })
    ));
  }

  async reloadExtensionFromSource() {
    if (!this.cdp || !this.extensionId || !this.extensionDir) {
      throw new Error('CHROMIUM_HARNESS_NOT_STARTED');
    }
    const browserExtensionDir = this.attachOnly
      ? this.chromeAttachSpec?.extensionDir
      : this.chromeLaunchSpec?.extensionDir;
    if (!browserExtensionDir) {
      throw new Error('CHROMIUM_HARNESS_BROWSER_EXTENSION_PATH_REQUIRED');
    }
    const expectedExtensionId = this.extensionId;
    const reload = async (loadUnpacked) => {
      const previousWorker = await this.getServiceWorker();
      const result = await loadUnpacked({ path: browserExtensionDir });
      if (result?.id !== expectedExtensionId) {
        throw new Error(
          `CHROMIUM_HARNESS_EXTENSION_ID_CHANGED:${expectedExtensionId}:${result?.id || 'missing'}`,
        );
      }
      // A load ACK and new files do not prove that the old worker has exited.
      if (previousWorker !== null) {
        await this.waitForServiceWorkerExit({ targetId: previousWorker.targetId });
      }
      const worker = await this.waitForServiceWorker({ previousTargetId: previousWorker?.targetId });
      await this.releaseTrustedPage();
      const activeExtension = await waitForActiveUnpackedExtension(
        this.cdp,
        browserExtensionDir,
        expectedExtensionId,
      );
      if (!activeExtension) {
        throw new Error(`CHROMIUM_HARNESS_EXTENSION_RELOAD_NOT_ACTIVE:${expectedExtensionId}`);
      }
      return Object.freeze({
        extensionId: expectedExtensionId,
        installMode: 'chrome_developer_private_reload',
        previousWorkerId: previousWorker?.targetId ?? null,
        workerId: worker.targetId,
      });
    };
    const managed = this.attachOnly
      && this.browserExecution?.startPolicy === 'managed_ensure_before_attach';
    // Existing extensions must use Chrome's Reload operation. Re-registering
    // an unchanged loader URL through loadUnpacked can keep old worker scripts.
    // This is the sole reload strategy; failure never attempts a second API.
    return this.withExtensionManagementPage(async (page) => {
      const reloadExact = async ({ path: extensionPath }) => {
        if (extensionPath !== browserExtensionDir) {
          throw new Error('CHROMIUM_HARNESS_EXTENSION_RELOAD_PATH_MISMATCH');
        }
        return evaluate(this.cdp, page.sessionId, `(async () => {
          if (location.href !== 'chrome://extensions/') throw new Error('EXTENSION_RELOAD_URL_INVALID');
          const id = ${JSON.stringify(expectedExtensionId)};
          const info = await chrome.developerPrivate.getExtensionInfo(id);
          if (info.id !== id || info.state !== 'ENABLED') throw new Error('EXTENSION_RELOAD_EXACT_ID_NOT_ACTIVE');
          const loadError = await chrome.developerPrivate.reload(id, {
            failQuietly: true, populateErrorForUnpacked: true,
          });
          if (loadError) throw new Error('EXTENSION_RELOAD_FAILED:' + JSON.stringify(loadError));
          return { id };
        })()`, { timeoutMs: 12_000 });
      };
      return managed
        ? this.runManagedAttachedExtensionLoadMutation(reload, { loadExtension: reloadExact })
        : reload(reloadExact);
    }, { managed });
  }

  async stopServiceWorker() {
    const current = await this.getServiceWorker();
    if (!current?.targetId) {
      throw new Error('EXTENSION_SERVICE_WORKER_TARGET_MISSING');
    }
    await closeQaCdpTarget(this.cdp, current.targetId);
    await this.waitForServiceWorkerExit({ targetId: current.targetId, timeoutMs: 8_000 });
    return current;
  }

  async waitForServiceWorkerExit({ targetId, timeoutMs = 12_000 }) {
    if (typeof targetId !== 'string' || !targetId) throw new Error('EXTENSION_SERVICE_WORKER_TARGET_REQUIRED');
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const next = await this.getServiceWorker();
      if (!next || next.targetId !== targetId) return;
      await sleep(100);
    }
    throw new Error(`EXTENSION_SERVICE_WORKER_STOP_TIMEOUT:${targetId}`);
  }

  async close() {
    if (this.childCloseOperation) return this.childCloseOperation;
    this.childCloseOperation = this.closeInternal();
    try {
      await this.childCloseOperation;
      this.unregisterChildAbortCleanup?.();
    } finally { this.childCloseOperation = null; }
  }

  async closeInternal() {
    let browserCleanupComplete = this.attachOnly;
    try {
      let extensionUninstallError = null;
      const cleanupErrors = [];
      const recordCleanupError = (owner, error) => {
        cleanupErrors.push({ owner, error });
      };
      if (this.cdp) {
        for (const page of this.pageTargets.values()) {
          if (!this.targetLease.owns(page.targetId)) {
            await this.registerOwnedTarget(page, 'scenario_page', null, {
              journal: false,
            });
          }
        }
        if (
          this.trustedPageTarget?.targetId
          && !this.targetLease.owns(this.trustedPageTarget.targetId)
        ) {
          await this.registerOwnedTarget(
            this.trustedPageTarget,
            'trusted_page',
            null,
            { journal: false },
          );
        }
        const allowConfirmedBrowserDisconnect = !this.attachOnly
          && this.ownedBrowserIdentityVerified
          && !this.uninstallExtensionOnClose;
        for (const target of this.targetLease.snapshot().ownedTargets) {
          await this.releaseOwnedTarget(target.targetId, {
            allowConfirmedBrowserDisconnect,
          }).catch((error) => {
            recordCleanupError(`browser_target_lease:${target.targetId}`, error);
          });
        }
      }
      for (const targetId of [...this.pageTargets.keys()]) {
        if (!this.targetLease.owns(targetId)) this.pageTargets.delete(targetId);
      }
      this.startupBlankTargetIds.clear();
      this.startupQaPageTargetIds.clear();
      if (
        this.trustedPageTarget?.targetId
        && !this.targetLease.owns(this.trustedPageTarget.targetId)
      ) {
        this.trustedPageTarget = null;
      }
      if (this.attachOnly && this.uninstallExtensionOnClose) {
        extensionUninstallError = new Error(
          'CHROMIUM_HARNESS_ATTACH_EXTENSION_UNINSTALL_FORBIDDEN',
        );
      } else if (this.cdp && this.uninstallExtensionOnClose && this.extensionId) {
        await this.cdp.send('Extensions.uninstall', {
          id: this.extensionId,
        }).catch((error) => {
          if (!isExtensionAlreadyAbsentError(error)) {
            extensionUninstallError = error;
          }
        });
      }
      this.uninstallExtensionOnClose = false;
      this.extensionInstallMode = null;
      this.managedExtensionSlotAction = null;
      this.managedExtensionLoadAnchorCleanupCount = 0;
      this.attachedArtifactStageReceipt = null;
      this.attachedArtifactSyncReceipt = null;
      this.extensionId = null;
      const browserCloseRequested = !!this.cdp
        && !this.attachOnly
        && this.ownedBrowserIdentityVerified;
      if (browserCloseRequested) {
        await this.cdp.send('Browser.close', {}, null, {
          timeoutMs: BROWSER_CLOSE_TIMEOUT_MS,
        }).catch(() => {});
      }
      try {
        this.cdp?.close();
      } catch (error) {
        recordCleanupError('cdp_connection', error);
      }
      this.cdp = null;
      let processTerminationComplete = false;
      try {
        if (this.chrome) {
          await terminateQaOwnedChromiumProcess(this.chrome, {
            graceMs: browserCloseRequested ? BROWSER_CLOSE_TIMEOUT_MS : 0,
          });
        }
        processTerminationComplete = true;
      } catch (error) {
        recordCleanupError('chromium_process', error);
      }
      if (!this.attachOnly) {
        browserCleanupComplete = processTerminationComplete;
      }
      if (browserCleanupComplete) {
        this.chrome = null;
        this.chromeLaunchSpec = null;
        this.chromeAttachSpec = null;
        this.ownedBrowserIdentityVerified = false;
      }
      if (browserCleanupComplete && this.tempRoot && !this.keepTemp) {
        await removeHarnessTempRoot(this.tempRoot).catch((error) => {
          recordCleanupError('temporary_root', error);
        });
      }
      if (extensionUninstallError) {
        throw new Error(
          `CHROMIUM_HARNESS_EXTENSION_UNINSTALL_FAILED:${extensionUninstallError?.message || extensionUninstallError}`,
        );
      }
      if (cleanupErrors.length > 0) {
        // Keep the process owner's separate child-exit and OS-identity failures
        // visible through the bounded QA error serializer instead of replacing
        // their AggregateError with an undiagnosable message-only error.
        const failures = cleanupErrors.flatMap(({ owner, error }) => (
          error instanceof AggregateError && Array.isArray(error.errors)
            ? error.errors.slice(0, 4).map((nestedError) => ({ owner, error: nestedError }))
            : [{ owner, error }]
        )).slice(0, 4);
        const details = failures.map(({ owner, error }) => {
          const detail = new Error(String(error?.message || error).slice(0, 2_048), { cause: error });
          if (typeof error?.code === 'string') detail.code = error.code;
          detail.stage = owner.split(':', 1)[0];
          return detail;
        });
        const error = new AggregateError(details,
          `CHROMIUM_HARNESS_CLEANUP_FAILED:${failures
            .map(({ owner }, index) => `${owner}:${details[index].message}`)
            .join('|')}`, { cause: cleanupErrors[0].error });
        error.code = 'CHROMIUM_HARNESS_CLEANUP_FAILED';
        throw error;
      }
    } finally {
      if (browserCleanupComplete) {
        const browserCapacityLease = this.browserCapacityLease;
        this.browserCapacityLease = null;
        await browserCapacityLease?.release();
      }
    }
  }
}

export async function launchExtensionChromiumHarness(options) {
  const harness = new ExtensionChromiumHarness(options);
  return harness.start();
}
