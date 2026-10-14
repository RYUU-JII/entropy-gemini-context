import { resolveWindowsPowerShellPath } from '../../browser-qa/browser/windowsPlatform.mjs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  isWindowsChromeExecutable,
  normalizeChromiumHarnessCdpEndpoint,
} from '../../e2e/extensionChromiumHarness.mjs';

const execFileAsync = promisify(execFile);
const TOOLBAR_AUTOMATION_TIMEOUT_MS = 12_000;
const PROCESS_ONLY_OPERATIONS = Object.freeze([
  'inspect_process',
  'inspect_foreground',
  'minimize_window',
  'focus_window',
]);

function resolveAutomationScriptPath() {
  return fileURLToPath(
    new URL('./windowsChromeToolbarAutomation.ps1', import.meta.url),
  );
}

function requireWindowsDriveMount(chromePath) {
  if (!isWindowsChromeExecutable(chromePath)) {
    throw new Error('QA_WINDOWS_CHROME_TOOLBAR_AUTOMATION_REQUIRED');
  }
  if (process.platform === 'win32') return null;
  const driveMount = path.normalize(chromePath).match(/^\/mnt\/[a-z]/iu)?.[0];
  if (!driveMount) {
    throw new Error('QA_WINDOWS_CHROME_DRIVE_UNRESOLVED');
  }
  return driveMount;
}

function requireCdpPort(cdpEndpoint) {
  const endpoint = new URL(normalizeChromiumHarnessCdpEndpoint(cdpEndpoint));
  const port = Number(endpoint.port);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('QA_WINDOWS_CHROME_CDP_PORT_INVALID');
  }
  return port;
}

function decodeInspectionNames(result) {
  if (!Array.isArray(result?.elements)) return result;
  return {
    ...result,
    elements: result.elements.map((element) => ({
      ...element,
      name: Buffer.from(element.nameBase64 || '', 'base64').toString('utf8'),
      nameBase64: undefined,
    })),
  };
}

function requireExpectedWindowBounds(value) {
  if (value === null) return null;
  const expectedKeys = ['height', 'left', 'top', 'width', 'windowState'];
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expectedKeys)
    || !Number.isSafeInteger(value.left)
    || !Number.isSafeInteger(value.top)
    || !Number.isSafeInteger(value.width)
    || value.width <= 0
    || !Number.isSafeInteger(value.height)
    || value.height <= 0
    || !['normal', 'minimized', 'maximized', 'fullscreen'].includes(
      value.windowState,
    )
  ) {
    throw new Error('QA_WINDOWS_CHROME_EXPECTED_WINDOW_BOUNDS_INVALID');
  }
  return Object.freeze({ ...value });
}

export function parseWindowsChromeToolbarResult(stdout, {
  decodeNames = false,
} = {}) {
  const lines = String(stdout || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const raw = lines.at(-1);
  if (!raw) throw new Error('QA_WINDOWS_CHROME_TOOLBAR_OUTPUT_MISSING');
  let result;
  try {
    result = JSON.parse(raw);
  } catch (error) {
    throw new Error('QA_WINDOWS_CHROME_TOOLBAR_OUTPUT_INVALID', { cause: error });
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('QA_WINDOWS_CHROME_TOOLBAR_OUTPUT_INVALID');
  }
  return Object.freeze(decodeNames ? decodeInspectionNames(result) : result);
}

async function resolveWindowsScriptPath(execFileImpl) {
  if (process.platform === 'win32') return resolveAutomationScriptPath();
  const { stdout } = await execFileImpl(
    'wslpath',
    ['-w', '--', resolveAutomationScriptPath()],
    {
      encoding: 'utf8',
      timeout: 5_000,
      maxBuffer: 16 * 1024,
    },
  );
  const windowsPath = String(stdout || '').trim();
  if (
    !/^(?:[a-z]:\\|\\\\wsl(?:\.localhost)?\\)/iu.test(windowsPath)
    || /[\r\n]/u.test(windowsPath)
  ) {
    throw new Error('QA_WINDOWS_CHROME_TOOLBAR_SCRIPT_PATH_INVALID');
  }
  return windowsPath;
}

export async function runWindowsChromeToolbarOperation({
  operation,
  chromePath,
  cdpEndpoint,
  expectedName,
  expectedProcessId = null,
  expectedWindowBounds = null,
  timeoutMs = TOOLBAR_AUTOMATION_TIMEOUT_MS,
  execFileImpl = execFileAsync,
  windowsScriptPath = null,
}) {
  if (![
    'inspect_process',
    'inspect_foreground',
    'minimize_window',
    'focus_window',
    'inspect',
    'inspect_options',
    'pin',
  ].includes(operation)) {
    throw new Error(`QA_WINDOWS_CHROME_TOOLBAR_OPERATION_INVALID:${operation}`);
  }
  if (
    !PROCESS_ONLY_OPERATIONS.includes(operation)
    && (typeof expectedName !== 'string' || !expectedName.trim())
  ) {
    throw new Error('QA_WINDOWS_CHROME_TOOLBAR_EXPECTED_NAME_REQUIRED');
  }
  const effectiveExpectedName = PROCESS_ONLY_OPERATIONS.includes(operation)
    ? 'process'
    : expectedName;
  if (
    expectedProcessId !== null
    && (!Number.isSafeInteger(expectedProcessId) || expectedProcessId <= 0)
  ) {
    throw new Error('QA_WINDOWS_CHROME_EXPECTED_PROCESS_ID_INVALID');
  }
  const normalizedWindowBounds = requireExpectedWindowBounds(expectedWindowBounds);
  if (operation === 'focus_window'
    && (expectedProcessId === null || normalizedWindowBounds === null)) {
    throw new Error('QA_WINDOWS_CHROME_TARGET_WINDOW_PROOF_REQUIRED');
  }
  if (normalizedWindowBounds !== null && operation !== 'focus_window') {
    throw new Error('QA_WINDOWS_CHROME_EXPECTED_WINDOW_OPERATION_INVALID');
  }
  const driveMount = requireWindowsDriveMount(chromePath);
  const powershellPath = resolveWindowsPowerShellPath({ wslDriveMount: driveMount });
  const effectiveWindowsScriptPath = windowsScriptPath
    || await resolveWindowsScriptPath(execFileImpl);
  const args = [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    effectiveWindowsScriptPath,
    '-Operation',
    operation,
    '-RemoteDebuggingPort',
    String(requireCdpPort(cdpEndpoint)),
    '-ExpectedNameBase64',
    Buffer.from(effectiveExpectedName, 'utf8').toString('base64'),
    ...(expectedProcessId === null
      ? []
      : ['-ExpectedProcessId', String(expectedProcessId)]),
    ...(normalizedWindowBounds === null
      ? []
      : [
        '-ExpectedWindowBoundsBase64',
        Buffer.from(JSON.stringify(normalizedWindowBounds), 'utf8').toString('base64'),
      ]),
  ];
  let stdout = '';
  try {
    ({ stdout } = await execFileImpl(powershellPath, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    }));
  } catch (error) {
    let result = null;
    try {
      result = parseWindowsChromeToolbarResult(error?.stdout);
    } catch {
      // The normalized child-process code below remains the canonical failure.
    }
    const code = typeof result?.code === 'string' && result.code
      ? result.code
      : 'QA_WINDOWS_CHROME_TOOLBAR_OPERATION_FAILED';
    const childCode = typeof error?.code === 'string' || Number.isInteger(error?.code)
      ? String(error.code)
      : 'unknown';
    const wrapped = new Error(`${code}:${operation}`, {
      cause: new Error(`QA_WINDOWS_CHROME_TOOLBAR_CHILD_EXIT:${childCode}`),
    });
    wrapped.code = code.split(':', 1)[0];
    wrapped.detail = result;
    throw wrapped;
  }
  const result = parseWindowsChromeToolbarResult(stdout, {
    decodeNames: operation.startsWith('inspect'),
  });
  if (result.ok !== true || result.operation !== operation) {
    throw new Error(`QA_WINDOWS_CHROME_TOOLBAR_RESULT_INVALID:${operation}`);
  }
  return result;
}

export function inspectWindowsChromeToolbar(options) {
  return runWindowsChromeToolbarOperation({
    ...options,
    operation: 'inspect',
  });
}

export function inspectWindowsChromeProcessPolicy(options) {
  return runWindowsChromeToolbarOperation({
    ...options,
    operation: 'inspect_process',
  });
}

export function inspectWindowsChromeForegroundState(options) {
  return runWindowsChromeToolbarOperation({
    ...options,
    operation: 'inspect_foreground',
  });
}

export function minimizeWindowsChromeWindow(options) {
  return runWindowsChromeToolbarOperation({
    ...options,
    operation: 'minimize_window',
  });
}

export function focusWindowsChromeWindow(options) {
  return runWindowsChromeToolbarOperation({
    ...options,
    operation: 'focus_window',
  });
}

export function inspectWindowsChromeToolbarOptions(options) {
  return runWindowsChromeToolbarOperation({
    ...options,
    operation: 'inspect_options',
  });
}

export function pinWindowsChromeExtension(options) {
  return runWindowsChromeToolbarOperation({
    ...options,
    operation: 'pin',
  });
}
