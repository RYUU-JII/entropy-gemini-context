#!/usr/bin/env node

import path from 'node:path';
import { resolveWindowsPowerShellPath } from '../../browser-qa/browser/windowsPlatform.mjs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const WINDOWS_AUTOMATION_TIMEOUT_MS = 15_000;
const SHORTCUT_ACTIONS = Object.freeze(['install', 'validate']);
const SHORTCUT_FIELDS = Object.freeze([
  'shortcutPath',
  'targetPath',
  'arguments',
  'workingDirectory',
  'iconLocation',
  'description',
  'hotkey',
  'windowStyle',
]);

export const ENTROPY_QA_DESKTOP_SHORTCUT_CONTRACT = Object.freeze({
  contractVersion: 1,
  shortcutPath: 'C:\\Users\\113ji\\Desktop\\Entropy QA Chrome.lnk',
  targetPath: process.platform === 'win32' ? process.execPath : 'C:\\Windows\\System32\\wsl.exe',
  arguments: process.platform === 'win32'
    ? `"${path.resolve(moduleDirectory, '../entropyQa.mjs')}" browser page authenticated --url=about:blank`
    : '-d Ubuntu-24.04 --cd /home/ryuji/projects/Entropy zsh -lc '
      + '"npm run qa -- browser page authenticated --url=about:blank"',
  workingDirectory: process.platform === 'win32'
    ? path.resolve(moduleDirectory, '../../..')
    : 'C:\\Users\\113ji',
  iconLocation: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe,0',
  description: 'Open and focus a fresh blank page in the dedicated managed Entropy QA Chrome',
  hotkey: '',
  windowStyle: 1,
});

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function requireExactContract(contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    fail('QA_DESKTOP_SHORTCUT_CONTRACT_INVALID');
  }
  const allowedKeys = new Set(['contractVersion', ...SHORTCUT_FIELDS]);
  const unknownKey = Object.keys(contract).find((key) => !allowedKeys.has(key));
  if (unknownKey) fail('QA_DESKTOP_SHORTCUT_CONTRACT_KEY_UNKNOWN', unknownKey);
  const missingKey = [...allowedKeys].find(
    (key) => !Object.prototype.hasOwnProperty.call(contract, key),
  );
  if (missingKey) fail('QA_DESKTOP_SHORTCUT_CONTRACT_KEY_REQUIRED', missingKey);
  if (contract.contractVersion !== 1) {
    fail(
      'QA_DESKTOP_SHORTCUT_CONTRACT_VERSION_INVALID',
      String(contract.contractVersion),
    );
  }
  SHORTCUT_FIELDS.filter((field) => field !== 'windowStyle').forEach((field) => {
    if (
      typeof contract[field] !== 'string'
      || contract[field] !== contract[field].trim()
      || (field !== 'hotkey' && !contract[field])
    ) {
      fail('QA_DESKTOP_SHORTCUT_CONTRACT_FIELD_INVALID', field);
    }
  });
  if (contract.windowStyle !== 1) {
    fail('QA_DESKTOP_SHORTCUT_WINDOW_STYLE_INVALID', String(contract.windowStyle));
  }
  if (!/^[a-z]:\\/iu.test(contract.shortcutPath) || !/\.lnk$/iu.test(contract.shortcutPath)) {
    fail('QA_DESKTOP_SHORTCUT_PATH_INVALID');
  }
  if (!/^[a-z]:\\/iu.test(contract.targetPath)) {
    fail('QA_DESKTOP_SHORTCUT_TARGET_PATH_INVALID');
  }
  if (!/^[a-z]:\\/iu.test(contract.workingDirectory)) {
    fail('QA_DESKTOP_SHORTCUT_WORKING_DIRECTORY_INVALID');
  }
  if (!/^[a-z]:\\/iu.test(contract.iconLocation.split(',', 1)[0])) {
    fail('QA_DESKTOP_SHORTCUT_ICON_LOCATION_INVALID');
  }
  return Object.freeze({ ...contract });
}

function encodeUtf8(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function resolveAutomationScriptPath() {
  return fileURLToPath(
    new URL('../drivers/windowsEntropyQaDesktopShortcut.ps1', import.meta.url),
  );
}

async function resolveWindowsAutomationScriptPath(execFileImpl) {
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
    fail('QA_DESKTOP_SHORTCUT_AUTOMATION_PATH_INVALID');
  }
  return windowsPath;
}

export function buildEntropyQaDesktopShortcutPowerShellArgs({
  operation,
  contract = ENTROPY_QA_DESKTOP_SHORTCUT_CONTRACT,
  windowsScriptPath,
} = {}) {
  if (!SHORTCUT_ACTIONS.includes(operation)) {
    fail('QA_DESKTOP_SHORTCUT_ACTION_INVALID', operation || 'missing');
  }
  const normalized = requireExactContract(contract);
  if (
    typeof windowsScriptPath !== 'string'
    || !windowsScriptPath
    || !/^(?:[a-z]:\\|\\\\wsl(?:\.localhost)?\\)/iu.test(windowsScriptPath)
  ) {
    fail('QA_DESKTOP_SHORTCUT_AUTOMATION_PATH_INVALID');
  }
  return Object.freeze([
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    windowsScriptPath,
    '-Operation',
    operation,
    '-ContractVersion',
    String(normalized.contractVersion),
    '-ShortcutPathBase64',
    encodeUtf8(normalized.shortcutPath),
    '-TargetPathBase64',
    encodeUtf8(normalized.targetPath),
    '-ArgumentsBase64',
    encodeUtf8(normalized.arguments),
    '-WorkingDirectoryBase64',
    encodeUtf8(normalized.workingDirectory),
    '-IconLocationBase64',
    encodeUtf8(normalized.iconLocation),
    '-DescriptionBase64',
    encodeUtf8(normalized.description),
    '-HotkeyBase64',
    encodeUtf8(normalized.hotkey),
    '-WindowStyle',
    String(normalized.windowStyle),
  ]);
}

function parseAutomationOutput(stdout) {
  const raw = String(stdout || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (!raw) fail('QA_DESKTOP_SHORTCUT_AUTOMATION_OUTPUT_MISSING');
  try {
    const result = JSON.parse(raw);
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      fail('QA_DESKTOP_SHORTCUT_AUTOMATION_OUTPUT_INVALID');
    }
    return result;
  } catch (error) {
    if (error?.message === 'QA_DESKTOP_SHORTCUT_AUTOMATION_OUTPUT_INVALID') {
      throw error;
    }
    throw new Error('QA_DESKTOP_SHORTCUT_AUTOMATION_OUTPUT_INVALID', {
      cause: error,
    });
  }
}

function requireExactReceipt(result, operation, contract) {
  if (
    result?.ok !== true
    || result.operation !== operation
    || result.contractVersion !== contract.contractVersion
    || result.status !== (operation === 'install' ? 'INSTALLED' : 'VALID')
  ) {
    fail('QA_DESKTOP_SHORTCUT_AUTOMATION_RECEIPT_INVALID');
  }
  const actual = result.actual;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
    fail('QA_DESKTOP_SHORTCUT_AUTOMATION_RECEIPT_INVALID');
  }
  const mismatch = SHORTCUT_FIELDS.find(
    (field) => actual[field] !== contract[field],
  );
  if (mismatch) fail('QA_DESKTOP_SHORTCUT_CONTRACT_MISMATCH', mismatch);
  return Object.freeze({
    contractVersion: result.contractVersion,
    ok: true,
    operation,
    status: result.status,
    actual: Object.freeze(Object.fromEntries(
      SHORTCUT_FIELDS.map((field) => [field, actual[field]]),
    )),
  });
}

export async function runEntropyQaDesktopShortcutAction({
  operation,
  contract = ENTROPY_QA_DESKTOP_SHORTCUT_CONTRACT,
  execFileImpl = execFileAsync,
  windowsScriptPath = null,
} = {}) {
  const normalized = requireExactContract(contract);
  if (typeof execFileImpl !== 'function') {
    fail('QA_DESKTOP_SHORTCUT_EXEC_OWNER_REQUIRED');
  }
  const effectiveWindowsScriptPath = windowsScriptPath
    || await resolveWindowsAutomationScriptPath(execFileImpl);
  const args = buildEntropyQaDesktopShortcutPowerShellArgs({
    operation,
    contract: normalized,
    windowsScriptPath: effectiveWindowsScriptPath,
  });
  const powershellPath = resolveWindowsPowerShellPath();
  let stdout;
  try {
    ({ stdout } = await execFileImpl(powershellPath, args, {
      encoding: 'utf8',
      timeout: WINDOWS_AUTOMATION_TIMEOUT_MS,
      maxBuffer: 256 * 1024,
      windowsHide: true,
    }));
  } catch (error) {
    let detail = null;
    try {
      detail = parseAutomationOutput(error?.stdout);
    } catch {
      // The stable wrapper code below remains canonical.
    }
    const code = typeof detail?.code === 'string' && detail.code
      ? detail.code
      : 'QA_DESKTOP_SHORTCUT_AUTOMATION_FAILED';
    const wrapped = new Error(`${code}:${operation}`, { cause: error });
    wrapped.code = code.split(':', 1)[0];
    wrapped.detail = detail;
    throw wrapped;
  }
  return requireExactReceipt(
    parseAutomationOutput(stdout),
    operation,
    normalized,
  );
}
