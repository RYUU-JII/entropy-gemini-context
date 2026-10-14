import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { removeHarnessTempRoot } from '../e2e/chromiumHarnessTempCleanup.mjs';
import { projectQaBrowserGpuCapability } from '../qa/environment/qaGpuCapability.mjs';
import {
  buildWindowsChromiumSwitchArgumentPattern,
} from '../qa/browser/qaChromiumProcessOwner.mjs';

const WINDOWS_CMD_PATH = '/mnt/c/Windows/System32/cmd.exe';
const WINDOWS_POWERSHELL_PATH = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const WINDOWS_COMMAND_CWD = '/mnt/c/Windows/Temp';

export const CWS_MEASUREMENT_EXTENSION_PUBLIC_KEY = [
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlMHj5IgM4syUeyVGmOI6XZkB4wuPUotXr6',
  'ApQLmGCd9erqTlt1FtPRH1mi3xIopzhblGCENKyp/isvgxtjfTT/J76EVAfqhN9IdXs2BAeHqnKYJZqZ',
  '96cI3zDxcvA+o8qDy8dxPevO0vVM0fOQFUo9H61hw6kp78/TYZKWoNbtrYIxGtdhSSP2SWlX4oCDanO',
  'wBn4DUiWNJ6ZSdOaRLMm4eNBpjEJfSHDvGGesqQV+1p/hEAJ4hdfvSbZJWgt8qC83ueSnuG5PqqvcGxd',
  'fQx+4ey2i7E4IksYxOGfjoQu55IPkVRg1WnYvDp5U0GPVzc97QbQNSrQ27jrjpBpC4ITwIDAQAB',
].join('');
export const CWS_MEASUREMENT_EXTENSION_ID = 'amciafhohbkbchlofkghlokclochehko';

export function deriveChromeExtensionIdFromPublicKey(publicKey) {
  if (
    typeof publicKey !== 'string'
    || publicKey.length === 0
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(publicKey)
  ) {
    throw new Error('CWS_MEASUREMENT_EXTENSION_PUBLIC_KEY_INVALID');
  }
  const decoded = Buffer.from(publicKey, 'base64');
  const canonicalInput = publicKey.replace(/=+$/, '');
  const canonicalDecoded = decoded.toString('base64').replace(/=+$/, '');
  if (decoded.length === 0 || canonicalDecoded !== canonicalInput) {
    throw new Error('CWS_MEASUREMENT_EXTENSION_PUBLIC_KEY_INVALID');
  }
  const prefix = createHash('sha256').update(decoded).digest().subarray(0, 16);
  return [...prefix].map((byte) => (
    String.fromCharCode(97 + (byte >> 4))
    + String.fromCharCode(97 + (byte & 0x0f))
  )).join('');
}

export function isWslWindowsChromeExecutable(candidate, {
  platform = process.platform,
  wslDistro = process.env.WSL_DISTRO_NAME,
} = {}) {
  return (
    platform === 'linux'
    && typeof wslDistro === 'string'
    && wslDistro.length > 0
    && typeof candidate === 'string'
    && /^\/mnt\/[a-z]\//i.test(candidate)
    && /\.exe$/i.test(candidate)
  );
}

export function convertWslPathForWindows(value, {
  execFile = execFileSync,
} = {}) {
  const converted = execFile('wslpath', ['-w', value], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (!converted || !/^(?:[a-z]:\\|\\\\)/i.test(converted)) {
    throw new Error(`CWS_WSL_WINDOWS_PATH_CONVERSION_INVALID:${value}`);
  }
  return converted;
}

export function resolveChromeLaunchPaths({
  chromePath,
  userDataDir,
  extensionDir,
} = {}, {
  useWslWindowsPaths = isWslWindowsChromeExecutable(chromePath),
  convertPath = convertWslPathForWindows,
} = {}) {
  return {
    userDataDir: useWslWindowsPaths ? convertPath(userDataDir) : userDataDir,
    extensionDir: useWslWindowsPaths ? convertPath(extensionDir) : extensionDir,
  };
}

export function resolveWslWindowsTempBase({
  execFile = execFileSync,
  exists = fsSync.existsSync,
} = {}) {
  if (!exists(WINDOWS_CMD_PATH) || !exists(WINDOWS_COMMAND_CWD)) {
    throw new Error('CWS_WSL_WINDOWS_TEMP_OWNER_UNAVAILABLE');
  }
  const windowsTemp = execFile(WINDOWS_CMD_PATH, ['/d', '/c', 'echo %TEMP%'], {
    cwd: WINDOWS_COMMAND_CWD,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (!/^[a-z]:\\/i.test(windowsTemp)) {
    throw new Error('CWS_WSL_WINDOWS_TEMP_PATH_INVALID');
  }
  const wslTemp = execFile('wslpath', ['-u', windowsTemp], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (!/^\/mnt\/[a-z]\//i.test(wslTemp) || !path.isAbsolute(wslTemp)) {
    throw new Error('CWS_WSL_WINDOWS_TEMP_PATH_CONVERSION_INVALID');
  }
  return wslTemp;
}

export function getWslWindowsFreePort({
  execFile = execFileSync,
  exists = fsSync.existsSync,
} = {}) {
  if (!exists(WINDOWS_POWERSHELL_PATH) || !exists(WINDOWS_COMMAND_CWD)) {
    throw new Error('CWS_WSL_WINDOWS_PORT_OWNER_UNAVAILABLE');
  }
  const rawPort = execFile(WINDOWS_POWERSHELL_PATH, [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0); try { $listener.Start(); $listener.LocalEndpoint.Port } finally { $listener.Stop() }',
  ], {
    cwd: WINDOWS_COMMAND_CWD,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('CWS_WSL_WINDOWS_DEBUG_PORT_INVALID');
  }
  return port;
}

export function buildWindowsChromeProfileArgumentPattern(nativeProfilePath) {
  return buildWindowsChromiumSwitchArgumentPattern(
    'user-data-dir',
    nativeProfilePath,
  );
}

export async function cleanupOwnedCwsRuntimeTempRoots({
  tempRoot = null,
  browserProfileRoot = null,
  ownsBrowserProfileRoot = false,
} = {}, {
  removeRoot = removeHarnessTempRoot,
} = {}) {
  const ownedRoots = [];
  if (
    ownsBrowserProfileRoot
    && browserProfileRoot
    && browserProfileRoot !== tempRoot
  ) {
    ownedRoots.push(browserProfileRoot);
  }
  if (tempRoot) ownedRoots.push(tempRoot);

  const cleanupErrors = [];
  for (const ownedRoot of ownedRoots) {
    try {
      await removeRoot(ownedRoot);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length === 1) throw cleanupErrors[0];
  if (cleanupErrors.length > 1) {
    throw new AggregateError(
      cleanupErrors,
      'CWS_RUNTIME_OWNED_TEMP_ROOT_CLEANUP_FAILED',
    );
  }
}

export async function createCwsRuntimeTempRoots(chromePath, {
  browserProfileDir = null,
} = {}, {
  mkdtemp = fs.mkdtemp,
  mkdir = fs.mkdir,
  runtimeTmpdir = os.tmpdir,
  resolveWindowsTempBase = resolveWslWindowsTempBase,
  useWslWindowsChrome = isWslWindowsChromeExecutable(chromePath),
  cleanupOwnedRoots = cleanupOwnedCwsRuntimeTempRoots,
} = {}) {
  const harnessTempBase = useWslWindowsChrome ? '/tmp' : runtimeTmpdir();
  let ownership = {
    tempRoot: null,
    browserProfileRoot: null,
    ownsBrowserProfileRoot: false,
  };
  try {
    const tempRoot = await mkdtemp(path.join(harnessTempBase, 'entropy-cws-runtime-'));
    ownership = { ...ownership, tempRoot };
    if (browserProfileDir) {
      await mkdir(browserProfileDir, { recursive: true });
      return {
        tempRoot,
        browserProfileRoot: browserProfileDir,
        userDataDir: browserProfileDir,
        ownsBrowserProfileRoot: false,
      };
    }
    if (!useWslWindowsChrome) {
      return {
        tempRoot,
        browserProfileRoot: tempRoot,
        userDataDir: path.join(tempRoot, 'profile'),
        ownsBrowserProfileRoot: true,
      };
    }
    const browserProfileRoot = await mkdtemp(path.join(
      resolveWindowsTempBase(),
      'entropy-cws-browser-profile-',
    ));
    ownership = {
      tempRoot,
      browserProfileRoot,
      ownsBrowserProfileRoot: true,
    };
    return {
      ...ownership,
      userDataDir: path.join(browserProfileRoot, 'profile'),
    };
  } catch (initializationError) {
    try {
      await cleanupOwnedRoots(ownership);
    } catch (cleanupError) {
      throw new AggregateError(
        [initializationError, cleanupError],
        'CWS_RUNTIME_TEMP_ROOT_INITIALIZATION_AND_CLEANUP_FAILED',
        { cause: initializationError },
      );
    }
    throw initializationError;
  }
}

export function projectChromeGraphicsInfo(raw) {
  return projectQaBrowserGpuCapability(raw);
}
