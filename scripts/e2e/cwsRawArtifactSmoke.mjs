#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  ExtensionChromiumHarness,
  evaluate,
} from './extensionChromiumHarness.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const rootDir = path.resolve(scriptDir, '../..');
const DEFAULT_REPORT_DIR = '/tmp/entropy-cws-raw-artifact-smoke';

function sortedStrings(values) {
  return Array.from(values || [], String).sort((left, right) => left.localeCompare(right));
}

function assertCondition(condition, code, details = null) {
  if (condition) return;
  const suffix = details === null ? '' : `:${JSON.stringify(details)}`;
  throw new Error(`${code}${suffix}`);
}

function findOverlap(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

export function assertGrantedPermissionContract({ manifest, granted }) {
  const requiredPermissions = sortedStrings(manifest?.permissions);
  const requiredOrigins = sortedStrings(manifest?.host_permissions);
  const optionalPermissions = sortedStrings(manifest?.optional_permissions);
  const optionalOrigins = sortedStrings(manifest?.optional_host_permissions);
  const grantedPermissions = sortedStrings(granted?.permissions);
  const grantedOrigins = sortedStrings(granted?.origins);

  const classifiedPermissionOverlap = findOverlap(requiredPermissions, optionalPermissions);
  const classifiedOriginOverlap = findOverlap(requiredOrigins, optionalOrigins);
  assertCondition(
    classifiedPermissionOverlap.length === 0 && classifiedOriginOverlap.length === 0,
    'CWS_RAW_ARTIFACT_MANIFEST_PERMISSION_CLASSIFICATION_OVERLAP',
    {
      permissions: classifiedPermissionOverlap,
      origins: classifiedOriginOverlap,
    },
  );

  const pregrantedOptionalPermissions = findOverlap(
    grantedPermissions,
    optionalPermissions,
  );
  const pregrantedOptionalOrigins = findOverlap(grantedOrigins, optionalOrigins);
  assertCondition(
    pregrantedOptionalPermissions.length === 0 && pregrantedOptionalOrigins.length === 0,
    'CWS_RAW_ARTIFACT_OPTIONAL_PERMISSION_PREGRANTED',
    {
      permissions: pregrantedOptionalPermissions,
      origins: pregrantedOptionalOrigins,
    },
  );
  assertCondition(
    isDeepStrictEqual(grantedPermissions, requiredPermissions)
      && isDeepStrictEqual(grantedOrigins, requiredOrigins),
    'CWS_RAW_ARTIFACT_REQUIRED_PERMISSION_MISMATCH',
    {
      expected: {
        permissions: requiredPermissions,
        origins: requiredOrigins,
      },
      actual: {
        permissions: grantedPermissions,
        origins: grantedOrigins,
      },
    },
  );

  return {
    required: {
      permissions: requiredPermissions,
      origins: requiredOrigins,
    },
    optional: {
      permissions: optionalPermissions,
      origins: optionalOrigins,
    },
    granted: {
      permissions: grantedPermissions,
      origins: grantedOrigins,
    },
    pregrantedOptional: {
      permissions: pregrantedOptionalPermissions,
      origins: pregrantedOptionalOrigins,
    },
  };
}

async function walkArtifactDirectory(rootPath, currentPath, entries) {
  const children = await fs.readdir(currentPath, { withFileTypes: true });
  children.sort((left, right) => left.name.localeCompare(right.name));
  for (const child of children) {
    const absolutePath = path.join(currentPath, child.name);
    const relativePath = path.relative(rootPath, absolutePath).split(path.sep).join('/');
    const stat = await fs.lstat(absolutePath);
    if (stat.isSymbolicLink()) {
      throw new Error(`CWS_RAW_ARTIFACT_SYMLINK_FORBIDDEN:${relativePath}`);
    }
    if (stat.isDirectory()) {
      entries.push({
        path: `${relativePath}/`,
        type: 'directory',
        mode: stat.mode & 0o777,
      });
      await walkArtifactDirectory(rootPath, absolutePath, entries);
      continue;
    }
    if (!stat.isFile()) {
      throw new Error(`CWS_RAW_ARTIFACT_SPECIAL_FILE_FORBIDDEN:${relativePath}`);
    }
    const contents = await fs.readFile(absolutePath);
    entries.push({
      path: relativePath,
      type: 'file',
      mode: stat.mode & 0o777,
      bytes: contents.length,
      sha256: createHash('sha256').update(contents).digest('hex'),
    });
  }
}

export async function snapshotArtifactDirectory(distPath) {
  const resolvedPath = path.resolve(distPath);
  const rootStat = await fs.lstat(resolvedPath).catch(() => null);
  assertCondition(rootStat?.isDirectory(), 'CWS_RAW_ARTIFACT_DIST_NOT_FOUND', {
    distPath: resolvedPath,
  });
  const entries = [];
  await walkArtifactDirectory(resolvedPath, resolvedPath, entries);
  const serialized = JSON.stringify(entries);
  return {
    path: resolvedPath,
    sha256: createHash('sha256').update(serialized).digest('hex'),
    fileCount: entries.filter((entry) => entry.type === 'file').length,
    totalBytes: entries.reduce((sum, entry) => sum + (entry.bytes || 0), 0),
    entries,
  };
}

export function diffArtifactSnapshots(before, after) {
  const beforeByPath = new Map(before.entries.map((entry) => [entry.path, entry]));
  const afterByPath = new Map(after.entries.map((entry) => [entry.path, entry]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const [entryPath, entry] of afterByPath) {
    if (!beforeByPath.has(entryPath)) {
      added.push(entryPath);
    } else if (!isDeepStrictEqual(beforeByPath.get(entryPath), entry)) {
      changed.push(entryPath);
    }
  }
  for (const entryPath of beforeByPath.keys()) {
    if (!afterByPath.has(entryPath)) removed.push(entryPath);
  }
  return { added, removed, changed };
}

export function parseCwsRawArtifactSmokeArgs(argv) {
  const options = {
    distDir: null,
    reportDir: DEFAULT_REPORT_DIR,
    reportPath: null,
    chromePath: null,
    headless: true,
    keepTemp: false,
  };
  for (const arg of argv) {
    if (arg === '--headless') {
      options.headless = true;
    } else if (arg === '--headed') {
      options.headless = false;
    } else if (arg === '--keep-temp') {
      options.keepTemp = true;
    } else if (arg.startsWith('--dist=')) {
      options.distDir = arg.slice('--dist='.length);
    } else if (arg.startsWith('--report-dir=')) {
      options.reportDir = arg.slice('--report-dir='.length);
    } else if (arg.startsWith('--report=')) {
      options.reportPath = arg.slice('--report='.length);
    } else if (arg.startsWith('--chrome=')) {
      options.chromePath = arg.slice('--chrome='.length);
    } else {
      throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
    }
  }
  if (!options.distDir?.trim()) {
    throw new Error('CWS_RAW_ARTIFACT_DIST_REQUIRED');
  }
  return options;
}

function summarizeArtifactSnapshot(snapshot) {
  return {
    path: snapshot.path,
    sha256: snapshot.sha256,
    fileCount: snapshot.fileCount,
    totalBytes: snapshot.totalBytes,
  };
}

function isPathInside(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === ''
    || (!relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath));
}

async function readManifest(distPath) {
  const manifestPath = path.join(distPath, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  assertCondition(manifest?.manifest_version === 3, 'CWS_RAW_ARTIFACT_MANIFEST_V3_REQUIRED', {
    manifestPath,
  });
  assertCondition(
    typeof manifest?.background?.service_worker === 'string',
    'CWS_RAW_ARTIFACT_SERVICE_WORKER_REQUIRED',
  );
  assertCondition(
    typeof manifest?.action?.default_popup === 'string',
    'CWS_RAW_ARTIFACT_POPUP_REQUIRED',
  );
  return manifest;
}

async function inspectServiceWorker(harness, manifest) {
  const target = await harness.waitForServiceWorker();
  const expectedUrl = `chrome-extension://${harness.extensionId}/${manifest.background.service_worker}`;
  assertCondition(target?.type === 'service_worker', 'CWS_RAW_ARTIFACT_WORKER_TYPE_MISMATCH', {
    actual: target?.type || null,
  });
  assertCondition(target?.url === expectedUrl, 'CWS_RAW_ARTIFACT_WORKER_URL_MISMATCH', {
    expected: expectedUrl,
    actual: target?.url || null,
  });
  return {
    targetId: target.targetId,
    type: target.type,
    url: target.url,
    runtimeId: harness.extensionId,
    extensionVersion: manifest.version,
  };
}

async function inspectPopupAndPermissions(harness, manifest) {
  return harness.withTrustedPage(async (sessionId) => {
    const page = await evaluate(harness.cdp, sessionId, `({
      href: location.href,
      readyState: document.readyState,
      title: document.title,
      runtimeId: chrome.runtime.id,
      manifestVersion: chrome.runtime.getManifest().manifest_version,
      extensionVersion: chrome.runtime.getManifest().version,
      rootPresent: document.getElementById('root') instanceof HTMLElement,
    })`);
    const granted = await evaluate(harness.cdp, sessionId, `new Promise((resolve, reject) => {
      chrome.permissions.getAll((value) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message || 'PERMISSIONS_READ_FAILED'));
          return;
        }
        resolve({
          permissions: Array.isArray(value?.permissions) ? value.permissions : [],
          origins: Array.isArray(value?.origins) ? value.origins : [],
        });
      });
    })`);
    const expectedUrl = `chrome-extension://${harness.extensionId}/${manifest.action.default_popup}`;
    assertCondition(page?.href === expectedUrl, 'CWS_RAW_ARTIFACT_POPUP_URL_MISMATCH', {
      expected: expectedUrl,
      actual: page?.href || null,
    });
    assertCondition(page?.runtimeId === harness.extensionId, 'CWS_RAW_ARTIFACT_POPUP_ID_MISMATCH');
    assertCondition(page?.manifestVersion === 3, 'CWS_RAW_ARTIFACT_POPUP_MANIFEST_MISMATCH');
    assertCondition(
      page?.extensionVersion === manifest.version,
      'CWS_RAW_ARTIFACT_POPUP_EXTENSION_VERSION_MISMATCH',
    );
    assertCondition(page?.rootPresent === true, 'CWS_RAW_ARTIFACT_POPUP_ROOT_MISSING');
    return {
      popup: page,
      permissions: assertGrantedPermissionContract({ manifest, granted }),
    };
  });
}

export async function runCwsRawArtifactSmoke({
  chromePath,
  distDir,
  headless = true,
  keepTemp = false,
}) {
  const distPath = path.resolve(rootDir, distDir);
  const manifest = await readManifest(distPath);
  const before = await snapshotArtifactDirectory(distPath);
  const harness = new ExtensionChromiumHarness({
    chromePath,
    distDir: distPath,
    rootDir,
    headless,
    keepTemp,
    loadInPlace: true,
    trustedPagePath: manifest.action.default_popup,
    tempPrefix: 'entropy-cws-raw-artifact-',
  });
  let browser = null;
  let extension = null;
  let permissions = null;
  let failure = null;
  try {
    await harness.start();
    const browserProduct = String(harness.browserVersion?.Browser || '').trim();
    assertCondition(browserProduct, 'CWS_RAW_ARTIFACT_CHROME_PRODUCT_MISSING');
    browser = {
      product: browserProduct,
      protocolVersion: harness.browserVersion?.['Protocol-Version'] || null,
      userAgent: harness.browserVersion?.['User-Agent'] || null,
    };
    const serviceWorker = await inspectServiceWorker(harness, manifest);
    const inspected = await inspectPopupAndPermissions(harness, manifest);
    permissions = inspected.permissions;
    extension = {
      id: harness.extensionId,
      version: manifest.version,
      serviceWorker,
      popup: inspected.popup,
    };
  } catch (error) {
    failure = error;
  } finally {
    try {
      await harness.close();
    } catch (error) {
      failure ||= error;
    }
  }

  let after = null;
  let artifactDiff = null;
  try {
    after = await snapshotArtifactDirectory(distPath);
    artifactDiff = diffArtifactSnapshots(before, after);
    assertCondition(
      before.sha256 === after.sha256 && isDeepStrictEqual(before.entries, after.entries),
      'CWS_RAW_ARTIFACT_MUTATED_DURING_SMOKE',
      artifactDiff,
    );
  } catch (error) {
    failure ||= error;
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    passed: failure === null,
    error: failure ? (failure.stack || failure.message || String(failure)) : null,
    browser,
    artifact: {
      before: summarizeArtifactSnapshot(before),
      after: after ? summarizeArtifactSnapshot(after) : null,
      unchanged: after ? before.sha256 === after.sha256 : false,
      difference: artifactDiff,
    },
    extension,
    permissions,
  };
}

async function resolveChromeExecutable(explicitPath) {
  if (explicitPath?.trim()) return explicitPath;
  if (process.env.CHROME_BIN?.trim()) return process.env.CHROME_BIN;
  const { chromium } = await import('playwright');
  return chromium.executablePath();
}

async function writeReport(report, options, distPath) {
  const reportPath = options.reportPath
    ? path.resolve(rootDir, options.reportPath)
    : path.join(
      path.resolve(rootDir, options.reportDir),
      `cws-raw-artifact-smoke-${new Date().toISOString().replace(/[:.]/gu, '-')}.json`,
    );
  assertCondition(
    !isPathInside(distPath, reportPath),
    'CWS_RAW_ARTIFACT_REPORT_INSIDE_DIST_FORBIDDEN',
    { reportPath },
  );
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  return reportPath;
}

async function main() {
  const options = parseCwsRawArtifactSmokeArgs(process.argv.slice(2));
  const distPath = path.resolve(rootDir, options.distDir);
  const report = await runCwsRawArtifactSmoke({
    chromePath: await resolveChromeExecutable(options.chromePath),
    distDir: distPath,
    headless: options.headless,
    keepTemp: options.keepTemp,
  });
  const reportPath = await writeReport(report, options, distPath);
  console.log(`[cws-raw-artifact-smoke] report=${reportPath}`);
  console.log(`[cws-raw-artifact-smoke] chrome=${report.browser?.product || 'unavailable'}`);
  console.log(`[cws-raw-artifact-smoke] ${report.passed ? 'PASS' : 'FAIL'}`);
  if (!report.passed) process.exitCode = 1;
}

if (path.resolve(process.argv[1] || '') === scriptPath) {
  main().catch((error) => {
    console.error(`[cws-raw-artifact-smoke] FAIL ${error?.stack || error}`);
    process.exitCode = 1;
  });
}
