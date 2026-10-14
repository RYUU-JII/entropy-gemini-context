#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCwsProbeSettings } from './cwsProbeSettings.mjs';
import { finalizeCwsRuntimeFailureReport } from './cwsRuntimeFailureReport.mjs';
import { MESSAGE_ACTIONS } from '../../src/platform/messaging/messageTypes.js';
import { requireStrongPassphrase } from '../../src/platform/security/vaultCryptography.js';
import { ensureQaSecurityVaultReady } from '../qa/protocols/securityVaultQaFixture.mjs';
import {
  accumulateCwsWorkerRevivalEvidence,
  isCwsWakeRuntimeTelemetrySettled,
  projectCwsDashboardVisualEvidence,
  projectCwsWakeRuntimeContract,
  summarizeCwsDashboardVisualFirstFrames,
  summarizeCwsWakeLatencies,
} from './cwsServiceWorkerWakeContract.mjs';
import {
  quiesceCwsServiceWorkerBeforeColdProbe,
} from './cwsServiceWorkerColdQuiescence.mjs';
import {
  CWS_PAGE_READINESS_SNAPSHOT_EXPRESSION,
  findExtensionServiceWorkerTarget,
  getTargetInfos,
  isCwsPageReadinessSnapshotReady,
  projectCwsPageReadyTimeoutDiagnostics,
  sanitizeServiceWorkerDiagnosticText,
  ServiceWorkerCdpDiagnostics,
} from './cwsServiceWorkerDiagnostics.mjs';
import {
  cleanupOwnedCwsRuntimeTempRoots,
  CWS_MEASUREMENT_EXTENSION_PUBLIC_KEY,
  createCwsRuntimeTempRoots,
  getWslWindowsFreePort,
  isWslWindowsChromeExecutable,
  projectChromeGraphicsInfo,
  resolveChromeLaunchPaths,
} from './cwsChromeRuntime.mjs';
import { CdpConnection } from './cwsCdpConnection.mjs';
import { presentCwsVisualTarget } from './cwsVisualPresentation.mjs';
import {
  closeQaCdpTarget,
  createQaCdpPageTarget,
} from '../qa/browser/qaCdpTargetOwner.mjs';
import {
  installHarnessExtension,
} from '../e2e/extensionChromiumHarness.mjs';
import {
  launchQaOwnedChromiumProcess,
  terminateQaOwnedChromiumProcess,
  verifyQaOwnedChromiumEndpointIdentity,
} from '../qa/browser/qaChromiumProcessOwner.mjs';
import {
  acquireQaBrowserCapacity,
} from '../qa/resources/QaBrowserCapacityLease.mjs';
import {
  QaDisplayLease,
} from '../qa/resources/QaDisplayLease.mjs';
import {
  admitQaExtensionBrowserChildExecution,
} from '../qa/contracts/qaBrowserChildExecutionContract.mjs';
import {
  prepareCwsHistoryCleanupControllerExtension,
  runCwsHistoryCleanupLifecycleScenario,
} from './cwsHistoryCleanupLifecycleScenario.mjs';

const rootDir = process.cwd();
const DEFAULT_DIST_DIR = 'dist-prod';
const DEFAULT_REPORT_DIR = 'reports/perf';
const PROBE_HOST = 'entropy-cws-probe.test';
const PROBE_URL_PATTERN = `http://${PROBE_HOST}/*`;
const MEASURE_PAGE_PATH = '__entropy_measure.html';
const MEASURE_PAGE_SOURCE = `<!doctype html><meta charset="utf-8"><title>Entropy runtime measurement harness</title>`;
const WAKE_RUNTIME_TELEMETRY_WAIT_MS = 10_000;

const NUDGE_SESSION_STORAGE_KEYS = Object.freeze({
  pending: 'runtime.pending_nudges',
  debt: 'runtime.nudge_debt',
  lease: 'runtime.nudge_lease',
  terminal: 'runtime.nudge_terminal',
  terminalOutbox: 'runtime.nudge_terminal_outbox',
  shown: 'runtime.nudge_shown',
  ack: 'runtime.nudge_ack',
});

const DEFAULT_BUDGETS = Object.freeze({
  maxReloadHeapGrowthBytes: 12 * 1024 * 1024,
  maxMutationHeapGrowthBytes: 8 * 1024 * 1024,
  maxStorageLocalGrowthBytes: 1 * 1024 * 1024,
  maxLongTaskTotalMsPerScenario: 1_500,
  maxLongTaskMaxMs: 350,
  maxExtensionDedicatedWorkersAfterClose: 0,
  maxExtensionServiceWorkersAfterIdle: 1,
});

function parseArgs(argv) {
  const options = {
    build: false,
    distDir: DEFAULT_DIST_DIR,
    reportDir: DEFAULT_REPORT_DIR,
    browserProfileDir: null,
    iterations: 8,
    cards: 180,
    churn: 420,
    idleMs: 15_000,
    settleMs: 1_500,
    headless: process.env.ENTROPY_CWS_RUNTIME_HEADLESS !== '0',
    keepTemp: false,
    failOnWarn: false,
    lifecycle: false,
    wakeSamples: 3,
    dashboardVisualSamples: 1,
    requireNonDegradedDashboardFrame: false,
    requireDashboardVisualThreshold: false,
    graphicsMode: 'default',
    pauseWorkerOnStart: false,
    budgets: { ...DEFAULT_BUDGETS },
  };

  for (const arg of argv) {
    if (arg === '--build') {
      options.build = true;
    } else if (arg === '--no-build') {
      options.build = false;
    } else if (arg === '--headed') {
      options.headless = false;
    } else if (arg === '--headless') {
      options.headless = true;
    } else if (arg === '--headed-software-gl') {
      options.headless = false;
      options.graphicsMode = 'software_gl';
    } else if (arg === '--keep-temp') {
      options.keepTemp = true;
    } else if (arg === '--fail-on-warn') {
      options.failOnWarn = true;
    } else if (arg === '--lifecycle') {
      options.lifecycle = true;
    } else if (arg === '--no-lifecycle') {
      options.lifecycle = false;
    } else if (arg === '--pause-worker-on-start') {
      options.pauseWorkerOnStart = true;
    } else if (arg === '--require-nondegraded-dashboard-frame') {
      options.requireNonDegradedDashboardFrame = true;
    } else if (arg === '--require-dashboard-visual-threshold') {
      options.requireDashboardVisualThreshold = true;
    } else if (arg.startsWith('--dist=')) {
      options.distDir = arg.slice('--dist='.length);
    } else if (arg.startsWith('--report-dir=')) {
      options.reportDir = arg.slice('--report-dir='.length);
    } else if (arg.startsWith('--browser-profile-dir=')) {
      options.browserProfileDir = arg.slice('--browser-profile-dir='.length);
    } else if (arg.startsWith('--iterations=')) {
      options.iterations = parsePositiveInteger(arg.slice('--iterations='.length), options.iterations);
    } else if (arg.startsWith('--cards=')) {
      options.cards = parsePositiveInteger(arg.slice('--cards='.length), options.cards);
    } else if (arg.startsWith('--churn=')) {
      options.churn = parsePositiveInteger(arg.slice('--churn='.length), options.churn);
    } else if (arg.startsWith('--idle-ms=')) {
      options.idleMs = parsePositiveInteger(arg.slice('--idle-ms='.length), options.idleMs);
    } else if (arg.startsWith('--settle-ms=')) {
      options.settleMs = parsePositiveInteger(arg.slice('--settle-ms='.length), options.settleMs);
    } else if (arg.startsWith('--wake-samples=')) {
      options.wakeSamples = parsePositiveInteger(
        arg.slice('--wake-samples='.length),
        options.wakeSamples,
      );
    } else if (arg.startsWith('--dashboard-visual-samples=')) {
      options.dashboardVisualSamples = parsePositiveInteger(
        arg.slice('--dashboard-visual-samples='.length),
        options.dashboardVisualSamples,
      );
    } else if (arg.startsWith('--budget=')) {
      const [key, rawValue] = arg.slice('--budget='.length).split('=');
      if (Object.prototype.hasOwnProperty.call(options.budgets, key)) {
        options.budgets[key] = parsePositiveInteger(rawValue, options.budgets[key]);
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.dashboardVisualSamples < 1) {
    throw new Error('CWS_DASHBOARD_VISUAL_SAMPLE_COUNT_INVALID');
  }
  if (options.graphicsMode === 'software_gl' && options.headless) {
    throw new Error('CWS_SOFTWARE_GL_REQUIRES_HEADED_MODE');
  }
  if (options.browserProfileDir !== null && !path.isAbsolute(options.browserProfileDir)) {
    throw new Error('CWS_BROWSER_PROFILE_DIR_ABSOLUTE_PATH_REQUIRED');
  }
  if (options.requireDashboardVisualThreshold && options.dashboardVisualSamples < 10) {
    throw new Error('CWS_DASHBOARD_VISUAL_THRESHOLD_SAMPLE_FLOOR_REQUIRED:10');
  }

  return options;
}

function parsePositiveInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

async function runCommand(command, args, { cwd = rootDir, env = process.env } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
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

async function copyDirectory(sourceDir, targetDir) {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
  await fs.cp(sourceDir, targetDir, { recursive: true });
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (!port) {
          reject(new Error('Failed to allocate an ephemeral port.'));
          return;
        }
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && fsSync.existsSync(candidate)) return candidate;
  }

  const pathCandidates = ['google-chrome-stable', 'google-chrome', 'chromium-browser', 'chromium'];
  for (const command of pathCandidates) {
    const resolved = findOnPath(command);
    if (resolved) return resolved;
  }
  return null;
}

function findOnPath(command) {
  const pathValue = process.env.PATH || '';
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    for (const extension of extensions) {
      const fullPath = path.join(dir, `${command}${extension}`);
      if (fsSync.existsSync(fullPath)) return fullPath;
    }
  }
  return null;
}

async function prepareMeasurementExtension({
  distDir,
  tempRoot,
  includeHistoryCleanupLifecycle = false,
}) {
  const sourceDir = path.resolve(rootDir, distDir);
  if (!(await pathExists(path.join(sourceDir, 'manifest.json')))) {
    throw new Error(`Built extension not found at ${sourceDir}. Run with --build or run npm run cws:preflight first.`);
  }

  const extensionDir = path.join(tempRoot, 'extension');
  await copyDirectory(sourceDir, extensionDir);

  const manifestPath = path.join(extensionDir, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.key = CWS_MEASUREMENT_EXTENSION_PUBLIC_KEY;
  const permissions = new Set(Array.isArray(manifest.permissions) ? manifest.permissions : []);
  permissions.add('scripting');
  if (includeHistoryCleanupLifecycle) permissions.add('history');
  manifest.permissions = Array.from(permissions);
  const promotedOptionalPermissions = new Set(['scripting']);
  if (includeHistoryCleanupLifecycle) promotedOptionalPermissions.add('history');
  manifest.optional_permissions = (Array.isArray(manifest.optional_permissions) ? manifest.optional_permissions : [])
    .filter((permission) => !promotedOptionalPermissions.has(permission));

  const requiredHosts = new Set(Array.isArray(manifest.host_permissions) ? manifest.host_permissions : []);
  requiredHosts.add(`*://${PROBE_HOST}/*`);
  requiredHosts.add(`*://*.${PROBE_HOST}/*`);
  manifest.host_permissions = Array.from(requiredHosts);

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(extensionDir, MEASURE_PAGE_PATH), MEASURE_PAGE_SOURCE);
  return extensionDir;
}

function createProbeHtml({ cards }) {
  const safeCards = Math.max(1, Math.floor(Number(cards) || 180));
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Entropy CWS Runtime Probe</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: Arial, sans-serif; background: #f6f7f8; color: #202124; }
    header { position: sticky; top: 0; z-index: 2; display: flex; gap: 16px; align-items: center; padding: 14px 20px; background: white; border-bottom: 1px solid #dfe3e8; }
    main { width: min(780px, calc(100vw - 32px)); margin: 24px auto 80px; }
    article { background: white; border: 1px solid #dfe3e8; border-radius: 8px; margin: 12px 0; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    .meta, .metrics { display: flex; flex-wrap: wrap; gap: 10px; color: #5f6368; font-size: 13px; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: #dfe3e8; display: inline-block; vertical-align: middle; margin-right: 8px; }
    .body { line-height: 1.5; margin: 12px 0; }
    button, a { margin-right: 8px; }
    img { width: 100%; max-height: 220px; object-fit: cover; background: linear-gradient(135deg, #ccd7e0, #eef2f5); border-radius: 6px; }
  </style>
</head>
<body>
  <header>
    <strong>Entropy runtime probe</strong>
    <span>likes</span>
    <span>views</span>
    <span>followers</span>
    <button id="probe-action">Like</button>
  </header>
  <main id="feed"></main>
  <script>
    const cardCount = ${safeCards};
    const feed = document.getElementById('feed');
    const words = ['focus', 'scroll', 'attention', 'ritual', 'metric', 'timeline', 'signal', 'garden', 'review', 'threshold'];
    function makeCard(i) {
      const article = document.createElement('article');
      article.dataset.probeCard = String(i);
      const likes = (1_000 + i * 37).toLocaleString('en-US');
      const views = (12_000 + i * 391).toLocaleString('en-US');
      const followers = (42_000 + i * 29).toLocaleString('en-US');
      article.innerHTML = '<div><span class="avatar"></span><strong>@probe_user_' + i + '</strong></div>'
        + '<p class="body">' + Array.from({ length: 28 }, (_, j) => words[(i + j) % words.length]).join(' ') + '</p>'
        + '<div class="meta"><span>' + (i % 12 + 1) + 'h ago</span><span>' + followers + ' followers</span><span>Trending #' + (i % 9) + '</span></div>'
        + '<div class="metrics"><span>' + likes + ' likes</span><span>' + (i % 900) + ' replies</span><span>' + views + ' views</span><span>' + Math.floor(i / 3 + 5) + ' shares</span></div>'
        + '<p><a href="/feed?card=' + i + '">Open thread</a><button>Reply</button><button>Share</button></p>';
      return article;
    }
    function fill(count, offset = 0) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < count; i += 1) frag.appendChild(makeCard(i + offset));
      feed.appendChild(frag);
    }
    fill(cardCount);
    document.getElementById('probe-action').addEventListener('click', () => {
      const marker = document.createElement('span');
      marker.textContent = ' clicked';
      document.querySelector('header').appendChild(marker);
    });
    window.__entropyProbeScroll = async function(rounds = 8) {
      for (let i = 0; i < rounds; i += 1) {
        window.scrollTo({ top: (document.body.scrollHeight / Math.max(1, rounds - 1)) * i, behavior: 'instant' });
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.__entropyProbeChurn = async function(count = 300) {
      for (let i = 0; i < count; i += 1) {
        feed.appendChild(makeCard(cardCount + i));
        if (feed.children.length > cardCount + 80) feed.removeChild(feed.firstElementChild);
        if (i % 20 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return { childCount: feed.children.length };
    };
  </script>
</body>
</html>`;
}

function startProbeServer({ cards }) {
  const html = createProbeHtml({ cards });
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${PROBE_HOST}`);
    if (url.pathname === '/health') {
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('ok');
      return;
    }
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(html);
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        reject(new Error('Failed to start probe server.'));
        return;
      }
      resolve({
        port: address.port,
        close: () => new Promise((closeResolve) => server.close(closeResolve)),
      });
    });
    server.on('error', reject);
  });
}

function launchChrome({
  chromePath,
  userDataDir,
  extensionDir,
  remoteDebuggingPort,
  probePort,
  headless,
  graphicsMode = 'default',
  additionalExtensionDirs = [],
  launchEnvironment = {},
}) {
  if (!Array.isArray(additionalExtensionDirs)) {
    throw new Error('CWS_ADDITIONAL_EXTENSION_DIRS_INVALID');
  }
  const {
    userDataDir: nativeUserDataDir,
    extensionDir: nativeExtensionDir,
  } = resolveChromeLaunchPaths({ chromePath, userDataDir, extensionDir });
  const nativeExtensionDirs = [
    nativeExtensionDir,
    ...additionalExtensionDirs.map((additionalExtensionDir) => (
      resolveChromeLaunchPaths({
        chromePath,
        userDataDir,
        extensionDir: additionalExtensionDir,
      }).extensionDir
    )),
  ];
  const extensionLoadArgument = nativeExtensionDirs.join(',');
  const args = [
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${nativeUserDataDir}`,
    `--disable-extensions-except=${extensionLoadArgument}`,
    `--load-extension=${extensionLoadArgument}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-automation',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-component-update',
    '--disable-features=Translate,MediaRouter,OptimizationHints',
    `--host-resolver-rules=MAP ${PROBE_HOST} 127.0.0.1,MAP *.${PROBE_HOST} 127.0.0.1`,
    `http://${PROBE_HOST}:${probePort}/health`,
  ];
  if (headless) {
    args.push('--headless=new');
  }
  if (graphicsMode === 'software_gl') {
    args.push(
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
    );
  }
  if (process.platform === 'linux' && process.getuid?.() === 0) {
    args.push('--no-sandbox');
  }
  return launchQaOwnedChromiumProcess({
    chromePath,
    args,
    stdio: ['ignore', 'pipe', 'pipe'],
    launchEnvironment,
  });
}

async function fetchJson(url, { timeoutMs = 1_500 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForDebugEndpoint(port, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }
  throw new Error(`Chrome DevTools endpoint did not become ready: ${lastError?.message || 'timeout'}`);
}

async function collectAttachedServiceWorkerDiagnostics(serviceWorkerDiagnostics, targetInfo) {
  if (!targetInfo?.targetId) return serviceWorkerDiagnostics.snapshot();
  const diagnosticsReady = await serviceWorkerDiagnostics.attachForRead(targetInfo);
  const snapshot = await serviceWorkerDiagnostics.snapshot(targetInfo.targetId);
  await serviceWorkerDiagnostics.detachTarget(targetInfo.targetId);
  return { ...snapshot, diagnosticsReady };
}

function readTargetRuntimeTelemetry(workerDiagnostics, targetId) {
  return workerDiagnostics?.targets?.find((entry) => entry?.targetId === targetId)
    ?.runtimeTelemetry || null;
}

async function collectSettledWakeServiceWorkerDiagnostics(
  serviceWorkerDiagnostics,
  targetInfo,
) {
  const diagnosticsReady = await serviceWorkerDiagnostics.attachForRead(targetInfo);
  const deadline = Date.now() + WAKE_RUNTIME_TELEMETRY_WAIT_MS;
  let snapshot = await serviceWorkerDiagnostics.snapshot(targetInfo.targetId);
  while (
    diagnosticsReady
    && !isCwsWakeRuntimeTelemetrySettled(
      readTargetRuntimeTelemetry(snapshot, targetInfo.targetId),
    )
    && Date.now() < deadline
  ) {
    await sleep(50);
    snapshot = await serviceWorkerDiagnostics.snapshot(targetInfo.targetId);
  }
  return {
    ...snapshot,
    diagnosticsReady,
    runtimeTelemetrySettled: isCwsWakeRuntimeTelemetrySettled(
      readTargetRuntimeTelemetry(snapshot, targetInfo.targetId),
    ),
  };
}

async function waitForExtensionId(cdp, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const targets = await getTargetInfos(cdp);
    const extensionTarget = targets.find((target) => {
      const url = String(target.url || '');
      if (!url.startsWith('chrome-extension://')) return false;
      return url.endsWith('/service-worker-loader.js')
        || url.includes('/src/apps/background/');
    });
    if (extensionTarget) {
      const match = String(extensionTarget.url || '').match(/^chrome-extension:\/\/([^/]+)/);
      if (match) return match[1];
    }
    await sleep(250);
  }
  throw new Error('Loaded extension target was not found. Headless Chrome may not support extensions in this environment.');
}

async function openTarget(cdp, url = 'about:blank', {
  visualPresentation = false,
  requireVisible = false,
  extensionApiProfile = 'entropy_runtime',
} = {}) {
  const initialUrl = url === 'about:blank' ? 'about:blank' : url;
  const { targetId } = await createQaCdpPageTarget(cdp, { url: initialUrl });
  let presentationEvidence = null;
  try {
    const { sessionId } = await cdp.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    await cdp.send('Runtime.enable', {}, sessionId).catch(() => {});
    await cdp.send('Page.enable', {}, sessionId).catch(() => {});
    await cdp.send('Performance.enable', {}, sessionId).catch(() => {});
    await cdp.send('HeapProfiler.enable', {}, sessionId).catch(() => {});
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: PAGE_PERFORMANCE_PROBE_SOURCE,
    }, sessionId).catch(() => {});
    if (visualPresentation) {
      presentationEvidence = await presentCwsVisualTarget(cdp, { targetId, sessionId });
    }
    let readinessSnapshot = null;
    if (url !== 'about:blank') {
      readinessSnapshot = await waitForPageReady(cdp, sessionId, {
        expectedUrl: initialUrl,
        requireVisible,
        extensionApiProfile,
      });
    }
    return {
      targetId,
      sessionId,
      readinessSnapshot,
      presentationEvidence,
    };
  } catch (error) {
    error.cwsVisualPresentation = presentationEvidence;
    const cleanupError = await closeQaCdpTarget(cdp, targetId)
      .then(() => null, (targetCloseError) => targetCloseError);
    if (cleanupError && error instanceof Error) {
      error.message = `${error.message}; cleanup=${cleanupError?.message || cleanupError}`;
    }
    throw error;
  }
}

async function navigateTarget(cdp, sessionId, url) {
  await cdp.send('Page.navigate', { url }, sessionId);
  await waitForPageReady(cdp, sessionId, { expectedUrl: url });
}

async function closeTarget(cdp, targetId) {
  if (!targetId) return;
  await closeQaCdpTarget(cdp, targetId);
}

async function evaluate(cdp, sessionId, expression, {
  awaitPromise = true,
  returnByValue = true,
  timeoutMs = 20_000,
  userGesture = false,
} = {}) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue,
    timeout: timeoutMs,
    userGesture,
  }, sessionId);
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.text || 'Runtime evaluation failed';
    const description = result.exceptionDetails.exception?.description || '';
    throw new Error(`${text}${description ? `: ${description}` : ''}`);
  }
  return result.result?.value;
}

async function waitForPageReady(cdp, sessionId, {
  expectedUrl,
  previousDocumentGeneration = null,
  requireVisible = false,
  extensionApiProfile = 'entropy_runtime',
  timeoutMs = 15_000,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot = null;
  while (Date.now() < deadline) {
    lastSnapshot = await evaluate(cdp, sessionId, CWS_PAGE_READINESS_SNAPSHOT_EXPRESSION, {
      awaitPromise: false,
      returnByValue: true,
      timeoutMs: 1_000,
    }).catch(() => null);
    if (isCwsPageReadinessSnapshotReady(lastSnapshot, {
      expectedUrl,
      previousDocumentGeneration,
      requireVisible,
      extensionApiProfile,
    })) {
      return lastSnapshot;
    }
    await sleep(100);
  }
  throw new Error(`CWS_PAGE_READY_TIMEOUT:${JSON.stringify(
    projectCwsPageReadyTimeoutDiagnostics({
      expectedUrl,
      previousDocumentGeneration,
      requireVisible,
      extensionApiProfile,
      lastSnapshot,
    }),
  )}`);
}

function projectPageReadinessEvidence(snapshot, presentationEvidence = null) {
  const evidence = {
    documentGeneration: snapshot?.documentGeneration ?? null,
    visibilityState: snapshot?.visibilityState ?? null,
  };
  if (presentationEvidence) {
    evidence.presentation = presentationEvidence;
  }
  return evidence;
}

function attachDashboardVisualAdmissionDiagnostics(error, {
  lifecyclePhase,
  visualSampleIndex = null,
  presentationEvidence = null,
  documentReadiness = null,
  completedVisualSampleReadiness = [],
  sequenceState = null,
} = {}) {
  error.cwsRuntimeDiagnostics = {
    ...(error.cwsRuntimeDiagnostics || {}),
    lifecyclePhase,
    visualSampleIndex,
    presentationEvidence,
    documentReadiness,
    completedVisualSampleReadiness,
    sequenceState,
  };
  return error;
}

async function collectTargetSnapshot(cdp, extensionId = null) {
  const targets = await getTargetInfos(cdp);
  const extensionPrefix = extensionId ? `chrome-extension://${extensionId}/` : 'chrome-extension://';
  const extensionTargets = targets
    .filter((target) => String(target.url || '').startsWith(extensionPrefix))
    .map((target) => ({
      type: target.type,
      url: target.url,
      attached: !!target.attached,
    }));
  const countsByType = {};
  for (const target of targets) {
    countsByType[target.type] = (countsByType[target.type] || 0) + 1;
  }
  return {
    total: targets.length,
    countsByType,
    extensionTargets,
    extensionDedicatedWorkers: extensionTargets.filter((target) => (
      target.type === 'worker' || target.type === 'shared_worker'
    )),
    extensionServiceWorkers: extensionTargets.filter((target) => target.type === 'service_worker'),
  };
}

async function waitForExtensionServiceWorker(cdp, extensionId, {
  previousTargetId = null,
  timeoutMs = 12_000,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastTarget = null;
  while (Date.now() < deadline) {
    lastTarget = findExtensionServiceWorkerTarget(await getTargetInfos(cdp), extensionId);
    if (lastTarget && (!previousTargetId || lastTarget.targetId !== previousTargetId)) {
      return lastTarget;
    }
    await sleep(100);
  }
  throw new Error(`EXTENSION_SERVICE_WORKER_WAKE_TIMEOUT:${JSON.stringify({
    extensionId,
    previousTargetId,
    lastTarget,
  })}`);
}

async function stopExtensionServiceWorker(cdp, extensionId, serviceWorkerDiagnostics) {
  const current = findExtensionServiceWorkerTarget(await getTargetInfos(cdp), extensionId);
  if (!current?.targetId) {
    throw new Error('EXTENSION_SERVICE_WORKER_TARGET_MISSING');
  }
  const quiescence = await quiesceCwsServiceWorkerBeforeColdProbe({
    initialTarget: current,
    observeOwnedTarget: async () => findExtensionServiceWorkerTarget(
      await getTargetInfos(cdp),
      extensionId,
    ),
    detachTarget: async (target) => serviceWorkerDiagnostics.detachTarget(target.targetId),
    closeTarget: async (target) => {
      await closeQaCdpTarget(cdp, target.targetId);
      return { success: true };
    },
  });
  return {
    ...quiescence.lastClosedTarget,
    coldQuiescence: quiescence.diagnostics,
  };
}

async function wakeExtensionServiceWorker(
  cdp,
  extensionId,
  previousTargetId,
  serviceWorkerDiagnostics,
  { messageSessionId = null } = {},
) {
  let timedPairDispatchAtHostEpochMs = null;
  let timedPairCompletedAtHostEpochMs = null;
  const sendTimedPair = async (sessionId) => {
    timedPairDispatchAtHostEpochMs = Date.now();
    const result = await evaluate(
      cdp,
      sessionId,
      `(${HARNESS_TIMED_MESSAGE_PAIR_SOURCE})(${JSON.stringify({
        action: MESSAGE_ACTIONS.GET_SETTINGS,
        defaults: { filteringMode: 'blocklist' },
        keys: ['filteringMode'],
      })})`,
    );
    timedPairCompletedAtHostEpochMs = Date.now();
    return result;
  };
  const probe = messageSessionId
    ? await sendTimedPair(messageSessionId)
    : await withHarnessPage(cdp, extensionId, sendTimedPair);
  const target = await waitForExtensionServiceWorker(cdp, extensionId, { previousTargetId });
  const workerDiagnostics = await collectSettledWakeServiceWorkerDiagnostics(
    serviceWorkerDiagnostics,
    target,
  );
  const diagnosticsReady = workerDiagnostics.diagnosticsReady === true;
  const targetDiagnostic = workerDiagnostics.targets.find((entry) => (
    entry.targetId === target.targetId
  )) || null;
  const timing = {
    targetId: target.targetId,
    generation: targetDiagnostic?.generation ?? null,
    timedPairDispatchAtHostEpochMs,
    timedPairCompletedAtHostEpochMs,
    requestSentAtEpochMs: probe?.cold?.sentAtEpochMs ?? null,
    targetObservedAtEpochMs: targetDiagnostic?.observedAtEpochMs ?? null,
    diagnosticsAttachedAtEpochMs: targetDiagnostic?.diagnosticsAttachedAtEpochMs ?? null,
    firstResponseAtEpochMs: probe?.cold?.respondedAtEpochMs ?? null,
    warmRequestSentAtEpochMs: probe?.warm?.sentAtEpochMs ?? null,
    warmResponseAtEpochMs: probe?.warm?.respondedAtEpochMs ?? null,
    coldResponseLatencyMs: probe?.cold?.latencyMs ?? null,
    warmResponseLatencyMs: probe?.warm?.latencyMs ?? null,
    responseError: probe?.cold?.response?.error || null,
    warmResponseError: probe?.warm?.response?.error || null,
    diagnosticsReady,
  };
  const result = {
    response: probe?.cold?.response || null,
    warmResponse: probe?.warm?.response || null,
    target,
    timing,
    workerDiagnostics,
  };
  await serviceWorkerDiagnostics.detachTarget(target.targetId);
  if (!result.response?.success || !result.warmResponse?.success) {
    const error = new Error(`EXTENSION_SERVICE_WORKER_WAKE_MESSAGE_FAILED:${JSON.stringify({
      responseError: timing.responseError,
      timing,
      workerDiagnostics,
    })}`);
    error.cwsRuntimeDiagnostics = result;
    throw error;
  }
  return result;
}

function metricsArrayToMap(metrics = []) {
  const map = {};
  for (const metric of metrics) {
    if (typeof metric?.name === 'string') map[metric.name] = metric.value;
  }
  return map;
}

async function collectPageMetrics(cdp, sessionId, label) {
  await cdp.send('HeapProfiler.collectGarbage', {}, sessionId).catch(() => {});
  await sleep(80);
  const performanceResult = await cdp.send('Performance.getMetrics', {}, sessionId).catch(() => ({ metrics: [] }));
  const domCounters = await cdp.send('Memory.getDOMCounters', {}, sessionId).catch(() => ({}));
  const pageProbe = await evaluate(cdp, sessionId, PAGE_COLLECT_METRICS_EXPRESSION, {
    timeoutMs: 10_000,
  }).catch((error) => ({ error: error.message }));

  const performance = metricsArrayToMap(performanceResult.metrics || []);
  return {
    label,
    ts: new Date().toISOString(),
    performance,
    domCounters,
    pageProbe,
    summary: {
      jsHeapUsedBytes: Math.round(Number(performance.JSHeapUsedSize) || 0),
      jsHeapTotalBytes: Math.round(Number(performance.JSHeapTotalSize) || 0),
      nodes: Math.round(Number(domCounters.nodes ?? performance.Nodes) || 0),
      documents: Math.round(Number(domCounters.documents ?? performance.Documents) || 0),
      longTaskCount: Number(pageProbe?.longTaskCount) || 0,
      longTaskTotalMs: Math.round(Number(pageProbe?.longTaskTotalMs) || 0),
      longTaskMaxMs: Math.round(Number(pageProbe?.longTaskMaxMs) || 0),
      entropyMarkedElements: Number(pageProbe?.entropyMarkedElements) || 0,
      rootFilter: pageProbe?.rootFilter || '',
    },
  };
}

async function withHarnessPage(cdp, extensionId, worker) {
  const harnessUrl = `chrome-extension://${extensionId}/${MEASURE_PAGE_PATH}`;
  const target = await openTarget(cdp, harnessUrl);
  try {
    return await worker(target.sessionId);
  } finally {
    await closeTarget(cdp, target.targetId);
  }
}

export function createCwsSecurityVaultPreparation({
  cdp,
  extensionId,
  browserExecution,
  ownedBrowserIdentityVerified,
  tempRoot,
  userDataDir,
  extensionDir,
  browserProfileDir,
  passphrase,
}) {
  if (passphrase !== undefined) requireStrongPassphrase(passphrase).fill(0);
  const expectedMode = passphrase === undefined ? 'local' : 'passphrase';
  const owner = {
    attachOnly: false,
    ownedBrowserIdentityVerified,
    browserExecution,
    tempRoot,
    userDataDir,
    extensionDir,
    extensionId,
    qaProfileDir: browserProfileDir,
    loadInPlace: false,
    cdp,
    openPage: (url) => openTarget(cdp, url),
    navigatePage: (page, url) => navigateTarget(cdp, page.sessionId, url),
    closePage: (page) => closeTarget(cdp, page.targetId),
  };
  return async (expectedOperation) => {
    if (!['setup', 'unlock'].includes(expectedOperation)) {
      throw new Error('CWS_SECURITY_VAULT_PHASE_INVALID');
    }
    const receipt = await ensureQaSecurityVaultReady(owner, passphrase === undefined ? {} : { passphrase });
    if (receipt?.state !== 'unlocked' || receipt.version !== 1) {
      throw new Error('CWS_SECURITY_VAULT_NOT_UNLOCKED');
    }
    if (receipt.mode !== expectedMode) {
      throw new Error(`CWS_SECURITY_VAULT_MODE_MISMATCH:${expectedMode}:${receipt.mode}`);
    }
    const allowedOperations = expectedMode === 'local' ? ['already_unlocked']
      : expectedOperation === 'setup' ? ['setup', 'already_unlocked'] : ['unlock'];
    if (!allowedOperations.includes(receipt.operation)) {
      throw new Error(`CWS_SECURITY_VAULT_OPERATION_MISMATCH:${expectedOperation}:${receipt.operation}`);
    }
    return receipt;
  };
}

export async function configureExtension(cdp, extensionId, { prepareSecurityVault }) {
  const securityVault = await prepareSecurityVault('setup');
  const settings = buildCwsProbeSettings();
  return withHarnessPage(cdp, extensionId, async (sessionId) => {
    const settingsResponse = await evaluate(cdp, sessionId, `(${HARNESS_SEND_MESSAGE_SOURCE})(${JSON.stringify({
      action: MESSAGE_ACTIONS.SET_SETTINGS,
      items: settings,
      waitForPropagation: true,
    })})`);
    if (!settingsResponse?.success) {
      throw new Error(`SET_SETTINGS failed: ${settingsResponse?.error || JSON.stringify(settingsResponse)}`);
    }
    if (settingsResponse?.propagation?.status !== 'succeeded') {
      throw new Error(
        `SET_SETTINGS propagation incomplete: ${JSON.stringify(settingsResponse?.propagation || null)}`,
      );
    }
    const siteRuleResponse = await evaluate(cdp, sessionId, `(${HARNESS_SEND_MESSAGE_SOURCE})(${JSON.stringify({
      action: MESSAGE_ACTIONS.UPSERT_SITE_RULE,
      domain: PROBE_HOST,
      type: 'blocked',
      goalMinutes: 1,
      waitForPropagation: true,
    })})`);
    if (!siteRuleResponse?.success) {
      throw new Error(`UPSERT_SITE_RULE failed: ${siteRuleResponse?.error || JSON.stringify(siteRuleResponse)}`);
    }
    if (siteRuleResponse?.propagation?.status !== 'succeeded') {
      throw new Error(
        `UPSERT_SITE_RULE propagation incomplete: ${JSON.stringify(siteRuleResponse?.propagation || null)}`,
      );
    }
    const permissions = await evaluate(cdp, sessionId, `(${HARNESS_PERMISSIONS_SOURCE})()`);
    const registrationDeadline = Date.now() + 8_000;
    let registeredScripts = { scripts: [], error: null };
    while (Date.now() < registrationDeadline) {
      registeredScripts = await evaluate(cdp, sessionId, `(${HARNESS_REGISTERED_SCRIPTS_SOURCE})()`);
      if (Array.isArray(registeredScripts?.scripts) && registeredScripts.scripts.some((script) => (
        Array.isArray(script?.js) && script.js.includes('src/apps/content/loader.js')
      ))) {
        break;
      }
      await sleep(100);
    }
    if (!Array.isArray(registeredScripts?.scripts) || !registeredScripts.scripts.some((script) => (
      Array.isArray(script?.js) && script.js.includes('src/apps/content/loader.js')
    ))) {
      const storageSummary = await collectStorageSummary(cdp, extensionId);
      throw new Error(
        `MANAGED_CONTENT_SCRIPT_REGISTRATION_TIMEOUT:${JSON.stringify({
          error: registeredScripts?.error || null,
          scripts: registeredScripts?.scripts || [],
          permissions,
          settingsPropagation: settingsResponse?.propagation || null,
          siteRulePropagation: siteRuleResponse?.propagation || null,
          storageSummary,
        })}`,
      );
    }
    return {
      securityVault,
      settingsResponse,
      siteRuleResponse,
      permissions,
      registeredScripts,
    };
  });
}

async function collectHarnessSnapshot(cdp, extensionId, {
  targetUrl = null,
  diagnosticsLimit = 80,
  includeGlobalContentRuntimeDiagnostics = false,
} = {}) {
  return withHarnessPage(cdp, extensionId, async (sessionId) => {
    return evaluate(cdp, sessionId, `(${HARNESS_COLLECT_SNAPSHOT_SOURCE})(${JSON.stringify({
      targetUrl,
      diagnosticsLimit,
      includeGlobalContentRuntimeDiagnostics,
    })})`, { timeoutMs: 20_000 });
  });
}

async function collectStorageSummary(cdp, extensionId) {
  return withHarnessPage(cdp, extensionId, async (sessionId) => evaluate(
    cdp,
    sessionId,
    `(${HARNESS_COLLECT_STORAGE_SUMMARY_SOURCE})()`,
    { timeoutMs: 8_000 },
  ));
}

async function collectBootPrewarmResponseError(cdp, extensionId) {
  const response = await withHarnessPage(cdp, extensionId, async (sessionId) => evaluate(
    cdp,
    sessionId,
    `(${HARNESS_SEND_MESSAGE_SOURCE})(${JSON.stringify({
      action: MESSAGE_ACTIONS.GET_BOOT_PREWARM_SNAPSHOT,
      reason: 'mv3_lifecycle_failure_diagnostic',
    })})`,
    { timeoutMs: 8_000 },
  ));
  return {
    success: response?.success === true,
    responseError: typeof response?.error === 'string' ? response.error : null,
  };
}

async function waitForContentDiagnostics(cdp, extensionId, url, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot = null;
  while (Date.now() < deadline) {
    lastSnapshot = await collectHarnessSnapshot(cdp, extensionId, {
      targetUrl: url,
      diagnosticsLimit: 120,
    }).catch((error) => ({ error: error.message }));
    const events = lastSnapshot?.diagnostics?.snapshot?.events || [];
    const hasReady = events.some((event) => (
      event?.event === 'bootstrap_state_observed'
      && (event.status === 'receiver_ready' || event.status === 'active')
    )) || events.some((event) => (
      event?.event === 'dispatch_succeeded' || event?.event === 'ensure_ready_succeeded'
    ));
    const currentSession = lastSnapshot?.diagnostics?.snapshot?.currentSession || null;
    const currentSessionReady = currentSession
      && (currentSession.status === 'receiver_ready' || currentSession.status === 'active')
      && currentSession.url === url;
    if (hasReady && currentSessionReady) return lastSnapshot;
    await sleep(350);
  }
  return lastSnapshot;
}

function requireActiveContentSession(snapshot, label) {
  const session = snapshot?.diagnostics?.snapshot?.currentSession || null;
  if (!session || (session.status !== 'receiver_ready' && session.status !== 'active')) {
    throw new Error(`${label}:${JSON.stringify({
      session,
      diagnosticsError: snapshot?.diagnostics?.error || null,
    })}`);
  }
  if (typeof session.documentId !== 'string' || !session.documentId.trim()) {
    throw new Error(`${label}_DOCUMENT_ID_MISSING`);
  }
  return session;
}

function countContentLifecycleMutationEvents(snapshot) {
  const mutationEvents = new Set([
    'bootstrap_state_observed',
    'inject_started',
    'inject_succeeded',
    'inject_failed',
    'media_frame_sidecar_inject_started',
    'media_frame_sidecar_inject_succeeded',
    'media_frame_sidecar_inject_failed',
    'session_marked_stale',
    'teardown_requested',
    'teardown_completed',
  ]);
  const events = snapshot?.diagnostics?.snapshot?.events || [];
  return events.filter((event) => mutationEvents.has(event?.event)).length;
}

function getContentRuntimeEventCursor(snapshot) {
  return (snapshot?.diagnostics?.snapshot?.events || []).reduce((cursor, event) => (
    Number.isFinite(Number(event?.id)) ? Math.max(cursor, Number(event.id)) : cursor
  ), 0);
}

function listContentLifecycleMutationEventsAfter(snapshot, cursor) {
  const mutationEvents = new Set([
    'bootstrap_state_observed',
    'inject_started',
    'inject_succeeded',
    'inject_failed',
    'media_frame_sidecar_inject_started',
    'media_frame_sidecar_inject_succeeded',
    'media_frame_sidecar_inject_failed',
    'session_marked_stale',
    'teardown_requested',
    'teardown_completed',
  ]);
  return (snapshot?.diagnostics?.snapshot?.events || []).filter((event) => (
    Number(event?.id) > cursor && mutationEvents.has(event?.event)
  ));
}

async function runSpaContinuityScenario(cdp, extensionId, pageSessionId, targetUrl) {
  const beforeSnapshot = await collectHarnessSnapshot(cdp, extensionId, {
    targetUrl,
    diagnosticsLimit: 200,
  });
  const beforeSession = requireActiveContentSession(
    beforeSnapshot,
    'MV3_SPA_PRE_NAVIGATION_SESSION_NOT_READY',
  );
  const beforeEventCount = countContentLifecycleMutationEvents(beforeSnapshot);
  const beforeEventCursor = getContentRuntimeEventCursor(beforeSnapshot);
  const navigation = await evaluate(cdp, pageSessionId, `(async () => {
    const originalUrl = location.href;
    const original = new URL(originalUrl);
    history.pushState({ entropyLifecycleE2E: 'push' }, '', original.pathname + original.search + '#mv3-spa-push');
    history.replaceState({ entropyLifecycleE2E: 'replace' }, '', original.pathname + original.search + '#mv3-spa-replace');
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      addEventListener('popstate', finish, { once: true });
      history.back();
      setTimeout(finish, 1500);
    });
    return { originalUrl, finalUrl: location.href };
  })()`, { timeoutMs: 4_000 });
  if (navigation?.finalUrl !== navigation?.originalUrl) {
    throw new Error(`MV3_SPA_HISTORY_DID_NOT_RETURN:${JSON.stringify(navigation)}`);
  }
  await sleep(250);
  const afterSnapshot = await collectHarnessSnapshot(cdp, extensionId, {
    targetUrl: navigation.finalUrl,
    diagnosticsLimit: 200,
  });
  const afterSession = requireActiveContentSession(
    afterSnapshot,
    'MV3_SPA_POST_NAVIGATION_SESSION_NOT_READY',
  );
  const afterEventCount = countContentLifecycleMutationEvents(afterSnapshot);
  const newLifecycleMutationEvents = listContentLifecycleMutationEventsAfter(
    afterSnapshot,
    beforeEventCursor,
  );
  if (afterSession.documentId !== beforeSession.documentId) {
    throw new Error(`MV3_SPA_DOCUMENT_ID_CHANGED:${JSON.stringify({
      before: beforeSession.documentId,
      after: afterSession.documentId,
    })}`);
  }
  if (newLifecycleMutationEvents.length > 0) {
    throw new Error(`MV3_SPA_CONTENT_LIFECYCLE_EVENT_DRIFT:${JSON.stringify({
      beforeEventCount,
      afterEventCount,
      beforeEventCursor,
      newLifecycleMutationEvents,
    })}`);
  }
  return {
    documentId: afterSession.documentId,
    beforeEventCount,
    afterEventCount,
    beforeEventCursor,
    navigation,
  };
}

async function runWorkerRevivalScenario(
  cdp,
  extensionId,
  targetUrl,
  serviceWorkerDiagnostics,
) {
  const beforeSnapshot = await collectHarnessSnapshot(cdp, extensionId, {
    targetUrl,
    diagnosticsLimit: 160,
  });
  const beforeSession = requireActiveContentSession(
    beforeSnapshot,
    'MV3_LIFECYCLE_PRE_RESTART_SESSION_NOT_READY',
  );
  const stoppedTarget = await stopExtensionServiceWorker(
    cdp,
    extensionId,
    serviceWorkerDiagnostics,
  );
  const wake = await wakeExtensionServiceWorker(
    cdp,
    extensionId,
    stoppedTarget.targetId,
    serviceWorkerDiagnostics,
  );

  const deadline = Date.now() + 12_000;
  let afterSnapshot = null;
  let revivalEvidence = accumulateCwsWorkerRevivalEvidence(null, null);
  let firstGlobalSyncSnapshot = null;
  const observedCatchUpReadinessEvents = new Map();
  const observedCatchUpPlanEvents = new Map();
  const observedManagedSyncEvents = new Map();
  while (Date.now() < deadline) {
    afterSnapshot = await collectHarnessSnapshot(cdp, extensionId, {
      targetUrl,
      diagnosticsLimit: 200,
      includeGlobalContentRuntimeDiagnostics: true,
    });
    const globalSnapshot = afterSnapshot?.globalContentRuntimeDiagnostics?.snapshot || null;
    if (firstGlobalSyncSnapshot === null && globalSnapshot?.lastSyncSnapshot) {
      firstGlobalSyncSnapshot = structuredClone(globalSnapshot.lastSyncSnapshot);
    }
    for (const event of globalSnapshot?.events || []) {
      if (
        event?.event !== 'catch_up_readiness_completed'
        && event?.event !== 'managed_sync_catch_up_plan_resolved'
        && event?.event !== 'catch_up_readiness_started'
        && event?.event !== 'catch_up_readiness_failed'
        && event?.event !== 'managed_sync_failed'
      ) continue;
      const eventKey = Number.isInteger(event.id)
        ? `id:${event.id}`
        : JSON.stringify(event);
      if (event.event === 'catch_up_readiness_completed') {
        observedCatchUpReadinessEvents.set(eventKey, { ...event });
      } else if (event.event === 'managed_sync_catch_up_plan_resolved') {
        observedCatchUpPlanEvents.set(eventKey, { ...event });
      } else {
        observedManagedSyncEvents.set(eventKey, { ...event });
      }
    }
    revivalEvidence = accumulateCwsWorkerRevivalEvidence(
      revivalEvidence,
      afterSnapshot,
    );
    const currentSession = afterSnapshot?.diagnostics?.snapshot?.currentSession || null;
    if (
      revivalEvidence.catchUpReadinessEvent
      && currentSession
      && (currentSession.status === 'receiver_ready' || currentSession.status === 'active')
    ) {
      break;
    }
    await sleep(150);
  }

  const afterSession = requireActiveContentSession(
    afterSnapshot,
    'MV3_LIFECYCLE_POST_RESTART_SESSION_NOT_READY',
  );
  const {
    loaderReinjectedEvent,
    runtimeProbeRecoveredEvent,
    catchUpReadinessEvent,
  } = revivalEvidence;
  if (!catchUpReadinessEvent) {
    throw new Error(`MV3_LIFECYCLE_CATCH_UP_READINESS_EVENT_MISSING:${JSON.stringify({
      beforeSession,
      afterSession,
      events: afterSnapshot?.diagnostics?.snapshot?.events || [],
      globalContentRuntimeDiagnostics:
        afterSnapshot?.globalContentRuntimeDiagnostics || null,
      firstGlobalSyncSnapshot,
      observedCatchUpReadinessEvents: [...observedCatchUpReadinessEvents.values()],
      observedCatchUpPlanEvents: [...observedCatchUpPlanEvents.values()],
      observedManagedSyncEvents: [...observedManagedSyncEvents.values()],
    })}`);
  }
  if (
    !Number.isInteger(catchUpReadinessEvent.attemptedCount)
    || catchUpReadinessEvent.attemptedCount < 1
    || catchUpReadinessEvent.successCount !== catchUpReadinessEvent.attemptedCount
    || catchUpReadinessEvent.failureCount !== 0
  ) {
    throw new Error(`MV3_LIFECYCLE_CATCH_UP_READINESS_FAILED:${JSON.stringify({
      beforeSession,
      afterSession,
      loaderReinjectedEvent,
      runtimeProbeRecoveredEvent,
      catchUpReadinessEvent,
    })}`);
  }
  if (afterSession.documentId !== beforeSession.documentId) {
    throw new Error(`MV3_LIFECYCLE_DOCUMENT_ID_CHANGED:${JSON.stringify({
      before: beforeSession.documentId,
      after: afterSession.documentId,
    })}`);
  }

  const continuityMode = runtimeProbeRecoveredEvent
    ? 'runtime_probe_recovered'
    : loaderReinjectedEvent
      ? 'loader_reinjected'
      : 'retained_session';

  return {
    stoppedTargetId: stoppedTarget.targetId,
    coldQuiescence: stoppedTarget.coldQuiescence,
    revivedTargetId: wake.target.targetId,
    wakeResponse: wake.response,
    wakeTiming: wake.timing,
    workerDiagnostics: wake.workerDiagnostics,
    documentId: afterSession.documentId,
    continuityMode,
    loaderReinjectedEvent,
    runtimeProbeRecoveredEvent,
    catchUpReadinessEvent,
    beforeSession,
    afterSession,
  };
}

async function runHistoryCleanupLifecycleScenario({
  cdp,
  extensionId,
  controllerExtensionId,
  pageSessionId,
  probeUrl,
  serviceWorkerDiagnostics,
  prepareSecurityVault,
} = {}) {
  return runCwsHistoryCleanupLifecycleScenario({
    extensionId,
    controllerExtensionId,
    pageSessionId,
    probeUrl,
    withExtensionPage: (worker) => withHarnessPage(cdp, extensionId, worker),
    evaluate: (sessionId, expression, options) => evaluate(
      cdp,
      sessionId,
      expression,
      options,
    ),
    sendExtensionMessage: (sessionId, message) => evaluate(
      cdp,
      sessionId,
      `(${HARNESS_SEND_MESSAGE_SOURCE})(${JSON.stringify(message)})`,
    ),
    openOwnedTarget: (url, options) => openTarget(cdp, url, options),
    closeOwnedTarget: (targetId) => closeTarget(cdp, targetId),
    navigateOwnedTarget: (sessionId, url) => navigateTarget(cdp, sessionId, url),
    sendCdp: (method, params = {}, sessionId = undefined) => (
      cdp.send(method, params, sessionId)
    ),
    getExtensionWorkerTarget: async () => findExtensionServiceWorkerTarget(
      await getTargetInfos(cdp),
      extensionId,
    ),
    sleep,
    serviceWorkerDiagnostics,
    prepareSecurityVault,
  });
}

async function runServiceWorkerWakeMeasurementScenario({
  cdp,
  extensionId,
  serviceWorkerDiagnostics,
  sampleCount,
} = {}) {
  const samples = [];
  const messageTransport = await openTarget(
    cdp,
    `chrome-extension://${extensionId}/${MEASURE_PAGE_PATH}`,
  );
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const currentTarget = findExtensionServiceWorkerTarget(
        await getTargetInfos(cdp),
        extensionId,
      );
      if (!currentTarget?.targetId) {
        throw new Error(`MV3_WAKE_MEASUREMENT_TARGET_MISSING:${index}`);
      }
      const stoppedTarget = await stopExtensionServiceWorker(
        cdp,
        extensionId,
        serviceWorkerDiagnostics,
      );
      let wake;
      let wakeError = null;
      try {
        wake = await wakeExtensionServiceWorker(
          cdp,
          extensionId,
          stoppedTarget.targetId,
          serviceWorkerDiagnostics,
          { messageSessionId: messageTransport.sessionId },
        );
      } catch (error) {
        if (!error?.cwsRuntimeDiagnostics) throw error;
        wake = error.cwsRuntimeDiagnostics;
        wakeError = sanitizeServiceWorkerDiagnosticText(error?.message || error);
      }
      samples.push({
        index,
        stoppedTargetId: stoppedTarget.targetId,
        coldQuiescence: stoppedTarget.coldQuiescence,
        revivedTargetId: wake.target.targetId,
        status: wakeError ? 'failed' : 'passed',
        error: wakeError,
        timing: wake.timing,
        response: wake.response,
        warmResponse: wake.warmResponse,
        workerDiagnostics: wake.workerDiagnostics,
      });
    }
  } finally {
    await closeTarget(cdp, messageTransport.targetId);
  }
  const diagnosticSnapshot = await serviceWorkerDiagnostics.snapshot();
  samples.forEach((sample) => {
    const timingComplete = [
      sample?.timing?.coldResponseLatencyMs,
      sample?.timing?.warmResponseLatencyMs,
      sample?.timing?.requestSentAtEpochMs,
      sample?.timing?.firstResponseAtEpochMs,
      sample?.timing?.warmRequestSentAtEpochMs,
      sample?.timing?.warmResponseAtEpochMs,
    ].every((value) => typeof value === 'number' && Number.isFinite(value));
    const runtimeContract = projectCwsWakeRuntimeContract(sample);
    sample.runtimeContract = runtimeContract;
    const diagnosticsComplete = sample?.timing?.diagnosticsReady === true
      && sample?.workerDiagnostics?.collectorErrors?.length === 0
      && runtimeContract.valid;
    if (!timingComplete || !diagnosticsComplete) {
      sample.status = 'failed';
      sample.error = sample.error || (!timingComplete
        ? 'MV3_WAKE_MEASUREMENT_TIMING_INCOMPLETE'
        : 'MV3_WAKE_MEASUREMENT_DIAGNOSTICS_INCOMPLETE');
    }
  });
  const failedSampleCount = samples.filter((sample) => sample.status === 'failed').length;
  const thresholdSampleFloor = 20;
  const sampleClass = sampleCount >= thresholdSampleFloor
    ? 'threshold_candidate'
    : 'exploratory';
  const admittedSamples = samples.filter((sample) => sample.status === 'passed');
  return {
    sampleCount: samples.length,
    instrumentationMode: diagnosticSnapshot.instrumentationMode,
    sampleClass,
    thresholdSampleFloor,
    thresholdEligible: diagnosticSnapshot.thresholdEligible
      && failedSampleCount === 0
      && sampleClass === 'threshold_candidate',
    failedSampleCount,
    summary: {
      cold: summarizeCwsWakeLatencies(admittedSamples, 'coldResponseLatencyMs', 'response'),
      warm: summarizeCwsWakeLatencies(admittedSamples, 'warmResponseLatencyMs', 'warmResponse'),
      observedCold: summarizeCwsWakeLatencies(samples, 'coldResponseLatencyMs'),
      observedWarm: summarizeCwsWakeLatencies(samples, 'warmResponseLatencyMs'),
    },
    samples,
  };
}

async function readNudgeLifecycleMonitor(cdp, sessionId, key) {
  return evaluate(
    cdp,
    sessionId,
    `(${HARNESS_READ_NUDGE_LIFECYCLE_MONITOR_SOURCE})(${JSON.stringify({
      key,
      storageKeys: NUDGE_SESSION_STORAGE_KEYS,
    })})`,
    { timeoutMs: 4_000 },
  );
}

async function waitForNudgeLifecycleEvidence(
  cdp,
  sessionId,
  key,
  predicate,
  errorCode,
  timeoutMs = 25_000,
) {
  const deadline = Date.now() + timeoutMs;
  let snapshot = null;
  while (Date.now() < deadline) {
    snapshot = await readNudgeLifecycleMonitor(cdp, sessionId, key);
    const match = predicate(snapshot);
    if (match) return { snapshot, match };
    await sleep(100);
  }
  throw new Error(`${errorCode}:${JSON.stringify(snapshot)}`);
}

async function runNudgeSessionLifecycleScenario(
  cdp,
  extensionId,
  targetUrl,
  serviceWorkerDiagnostics,
) {
  const harnessUrl = `chrome-extension://${extensionId}/${MEASURE_PAGE_PATH}`;
  const monitor = await openTarget(cdp, harnessUrl);
  const issuedAt = Date.now();
  // Synthetic session fixture still uses the production activity-date shape.
  // Its unique runId, not an invalid date prefix, distinguishes each attempt.
  const key = `${new Date(issuedAt).toISOString().slice(0, 10)}|${PROBE_HOST}`;
  const runId = `mv3_nudge_${issuedAt.toString(36)}`;

  try {
    await evaluate(
      cdp,
      monitor.sessionId,
      `(${HARNESS_INSTALL_NUDGE_LIFECYCLE_MONITOR_SOURCE})(${JSON.stringify({
        key,
        storageKeys: NUDGE_SESSION_STORAGE_KEYS,
      })})`,
      { timeoutMs: 4_000 },
    );

    const targetSnapshot = await collectHarnessSnapshot(cdp, extensionId, {
      targetUrl,
      diagnosticsLimit: 160,
    });
    const targetTabId = targetSnapshot?.targetTab?.id;
    if (!Number.isInteger(targetTabId)) {
      throw new Error(`MV3_NUDGE_TARGET_TAB_MISSING:${JSON.stringify(targetSnapshot?.tabs || null)}`);
    }

    const seedResult = await evaluate(
      cdp,
      monitor.sessionId,
      `(${HARNESS_SEED_ISSUED_NUDGE_RUN_SOURCE})(${JSON.stringify({
        key,
        runId,
        tabId: targetTabId,
        now: issuedAt,
        hostname: PROBE_HOST,
        storageKeys: NUDGE_SESSION_STORAGE_KEYS,
      })})`,
      { timeoutMs: 8_000 },
    );
    if (seedResult?.success !== true) {
      throw new Error(`MV3_NUDGE_ISSUED_RUN_SEED_FAILED:${JSON.stringify(seedResult)}`);
    }

    const dispatching = await waitForNudgeLifecycleEvidence(
      cdp,
      monitor.sessionId,
      key,
      (snapshot) => snapshot?.events?.find((event) => (
        event?.pending?.phase === 'dispatching'
        && event.pending.runId
        && event.pending.runId === event?.lease?.runId
        && event.pending.tabId === event?.lease?.tabId
        && event.atomicPendingLease === true
      )),
      'MV3_NUDGE_ATOMIC_DISPATCH_EVIDENCE_MISSING',
      8_000,
    );
    const issuedRunId = dispatching.match.pending.runId;
    const issuedTabId = dispatching.match.pending.tabId;

    const presentedDelivery = await evaluate(
      cdp,
      monitor.sessionId,
      `(${HARNESS_SEND_TAB_NUDGE_LIFECYCLE_SOURCE})(${JSON.stringify({
        tabId: targetTabId,
        message: {
          action: 'NUDGE_PRESENTED',
          key,
          runId,
          mode: 'auto',
          startedAt: issuedAt,
        },
      })})`,
      { timeoutMs: 15_000 },
    );
    if (presentedDelivery?.success !== true || presentedDelivery?.response?.success !== true) {
      throw new Error(`MV3_NUDGE_PRESENTED_DELIVERY_FAILED:${JSON.stringify(presentedDelivery)}`);
    }

    const presented = await waitForNudgeLifecycleEvidence(
      cdp,
      monitor.sessionId,
      key,
      (snapshot) => snapshot?.events?.find((event) => (
        event?.pending?.phase === 'presented'
        && event.pending.runId === issuedRunId
        && event.pending.tabId === issuedTabId
      )),
      'MV3_NUDGE_PRESENTED_EVIDENCE_MISSING',
      8_000,
    );

    const stoppedTarget = await stopExtensionServiceWorker(
      cdp,
      extensionId,
      serviceWorkerDiagnostics,
    );
    const wake = await wakeExtensionServiceWorker(
      cdp,
      extensionId,
      stoppedTarget.targetId,
      serviceWorkerDiagnostics,
    );
    const revivedSnapshot = await readNudgeLifecycleMonitor(cdp, monitor.sessionId, key);
    if (
      revivedSnapshot?.current?.pending?.phase !== 'presented'
      || revivedSnapshot.current.pending.runId !== issuedRunId
      || revivedSnapshot.current.pending.tabId !== issuedTabId
      || revivedSnapshot.current.terminal?.present === true
    ) {
      throw new Error(`MV3_NUDGE_PRESENTED_REVIVAL_INVALID:${JSON.stringify(revivedSnapshot)}`);
    }

    const abortedDelivery = await evaluate(
      cdp,
      monitor.sessionId,
      `(${HARNESS_SEND_TAB_NUDGE_LIFECYCLE_SOURCE})(${JSON.stringify({
        tabId: targetTabId,
        message: {
          action: 'NUDGE_ABORTED',
          key,
          runId,
          mode: 'auto',
          reason: 'mv3_lifecycle_cleanup',
          hostname: PROBE_HOST,
        },
      })})`,
      { timeoutMs: 15_000 },
    );
    if (abortedDelivery?.success !== true || abortedDelivery?.response?.success !== true) {
      throw new Error(`MV3_NUDGE_ABORTED_DELIVERY_FAILED:${JSON.stringify(abortedDelivery)}`);
    }

    const aborted = await waitForNudgeLifecycleEvidence(
      cdp,
      monitor.sessionId,
      key,
      (snapshot) => snapshot?.events?.find((event) => (
        event?.terminal?.status === 'aborted'
        && event.terminal.runId === issuedRunId
        && event.pending?.present === false
        && event.lease?.present === false
      )),
      'MV3_NUDGE_ABORTED_EVIDENCE_MISSING',
      8_000,
    );
    const drained = await waitForNudgeLifecycleEvidence(
      cdp,
      monitor.sessionId,
      key,
      (snapshot) => (
        snapshot?.current?.terminalOutbox?.runId === issuedRunId
        && snapshot.current.terminalOutbox.state === 'completed'
      ),
      'MV3_NUDGE_TERMINAL_OUTBOX_DRAIN_MISSING',
      8_000,
    );

    return {
      atomicPendingLease: dispatching.match.atomicPendingLease === true,
      sameRunAcrossPhases: presented.match.pending.runId === issuedRunId
        && aborted.match.terminal.runId === issuedRunId,
      sameTabAcrossPresentation: presented.match.pending.tabId === issuedTabId,
      phaseSequence: ['dispatching', 'presented', 'aborted'],
      presentedSurvivedWorkerRevival: revivedSnapshot.current.pending.phase === 'presented',
      terminalOutboxDrained: drained.match === true,
      stoppedTargetId: stoppedTarget.targetId,
      coldQuiescence: stoppedTarget.coldQuiescence,
      revivedTargetId: wake.target.targetId,
      wakeTiming: wake.timing,
      workerDiagnostics: wake.workerDiagnostics,
    };
  } finally {
    try {
      const cleanup = await evaluate(
        cdp,
        monitor.sessionId,
        `(${HARNESS_CLEAR_NUDGE_RUN_SOURCE})(${JSON.stringify({
          key,
          storageKeys: NUDGE_SESSION_STORAGE_KEYS,
        })})`,
        { timeoutMs: 8_000 },
      );
      if (cleanup?.success !== true || cleanup?.remaining?.length > 0) {
        throw new Error(`MV3_NUDGE_FIXTURE_CLEANUP_FAILED:${JSON.stringify(cleanup)}`);
      }
    } finally {
      await closeTarget(cdp, monitor.targetId);
    }
  }
}

async function waitForDashboardBoot(
  cdp,
  sessionId,
  label,
  timeoutMs = 30_000,
  {
    navigationStartedAtEpochMs = null,
    pageReadyAtEpochMs = Date.now(),
  } = {},
) {
  const startedAtEpochMs = pageReadyAtEpochMs;
  const deadline = Date.now() + timeoutMs;
  let snapshot = null;
  let previousSignature = null;
  const stageTimeline = [];
  while (Date.now() < deadline) {
    snapshot = await evaluate(
      cdp,
      sessionId,
      'window.__ENTROPY_DASHBOARD_BOOT_SNAPSHOT__ || null',
      { timeoutMs: 2_000 },
    ).catch(() => null);
    const mainTabErrorDetail = await evaluate(
      cdp,
      sessionId,
      `(() => {
        const surface = document.querySelector('[data-testid="main-module-error"]');
        return surface?.textContent?.trim() || null;
      })()`,
      { timeoutMs: 1_000 },
    ).catch(() => null);
    const stage = {
      observedAtEpochMs: Date.now(),
      elapsedMs: Math.max(0, Date.now() - startedAtEpochMs),
      status: snapshot?.status || null,
      phase: snapshot?.phase || null,
      bootPerformanceStartedAtMs: Number.isFinite(Number(snapshot?.startedAt))
        ? Number(snapshot.startedAt)
        : null,
      themeReady: snapshot?.themeReady === true,
      coreReady: snapshot?.coreReady === true,
      mainTabFirstFrameReady: snapshot?.mainTabFirstFrameReady === true,
      mainTabFirstFrameDegraded: snapshot?.mainTabFirstFrameDegraded === true,
      forcedVisualRelease: snapshot?.forcedVisualRelease === true,
      dismissible: snapshot?.dismissible === true,
      mainTabErrorDetail: mainTabErrorDetail
        ? sanitizeServiceWorkerDiagnosticText(mainTabErrorDetail)
        : null,
      errorCodes: (Array.isArray(snapshot?.errors) ? snapshot.errors : [])
        .map((entry) => sanitizeServiceWorkerDiagnosticText(
          entry?.code || entry?.message || entry,
        ))
        .filter(Boolean)
        .slice(0, 8),
    };
    const signature = JSON.stringify({ ...stage, observedAtEpochMs: 0, elapsedMs: 0 });
    if (signature !== previousSignature && stageTimeline.length < 40) {
      stageTimeline.push(stage);
      previousSignature = signature;
    }
    if (snapshot?.status === 'failed') {
      const error = new Error(`${label}_FAILED:${JSON.stringify(snapshot)}`);
      error.cwsDashboardBoot = {
        navigationStartedAtEpochMs,
        pageReadyAtEpochMs,
        navigationToLastObservationMs: Number.isFinite(navigationStartedAtEpochMs)
          ? Math.max(0, Date.now() - navigationStartedAtEpochMs)
          : null,
        stageTimeline,
        lastSnapshot: snapshot,
      };
      throw error;
    }
    if (snapshot?.coreReady === true && snapshot?.dismissible === true) {
      const duplicateError = (Array.isArray(snapshot.errors) ? snapshot.errors : []).find((error) => (
        String(error?.code || error?.message || error || '').includes('DUPLICATE')
      ));
      if (duplicateError) {
        throw new Error(`${label}_DUPLICATE_SIGNAL:${JSON.stringify(duplicateError)}`);
      }
      return {
        snapshot,
        timing: {
          navigationStartedAtEpochMs,
          pageReadyAtEpochMs,
          bootReadyAtEpochMs: Date.now(),
          navigationToBootReadyMs: Number.isFinite(navigationStartedAtEpochMs)
            ? Math.max(0, Date.now() - navigationStartedAtEpochMs)
            : null,
          pageReadyToBootReadyMs: Math.max(0, Date.now() - pageReadyAtEpochMs),
          stageTimeline,
        },
      };
    }
    await sleep(100);
  }
  const error = new Error(`${label}_TIMEOUT:${JSON.stringify(snapshot)}`);
  error.cwsDashboardBoot = {
    navigationStartedAtEpochMs,
    pageReadyAtEpochMs,
    navigationToLastObservationMs: Number.isFinite(navigationStartedAtEpochMs)
      ? Math.max(0, Date.now() - navigationStartedAtEpochMs)
      : null,
    stageTimeline,
    lastSnapshot: snapshot,
  };
  throw error;
}

async function runDashboardColdReloadScenario(
  cdp,
  extensionId,
  serviceWorkerDiagnostics,
  sequenceState,
  {
    visualSampleCount = 1,
    requireNonDegradedVisual = false,
    requireVisualThreshold = false,
    visualEnvironment = null,
  } = {},
) {
  const dashboardUrl = `chrome-extension://${extensionId}/src/pages/dashboard.html`;
  const initialNavigationStartedAtEpochMs = Date.now();
  let dashboard;
  try {
    dashboard = await openTarget(cdp, dashboardUrl, {
      visualPresentation: true,
      requireVisible: true,
    });
  } catch (error) {
    error.cwsRuntimeDiagnostics = {
      ...(error.cwsRuntimeDiagnostics || {}),
      lifecyclePhase: 'dashboard_initial_page_admission',
      initialPresentationEvidence: error.cwsVisualPresentation || null,
      sequenceState,
    };
    throw error;
  }
  const initialPageReadyAtEpochMs = Date.now();
  const initialDocumentReadiness = projectPageReadinessEvidence(
    dashboard.readinessSnapshot,
    dashboard.presentationEvidence,
  );
  try {
    let initial;
    try {
      initial = await waitForDashboardBoot(
        cdp,
        dashboard.sessionId,
        'MV3_DASHBOARD_INITIAL_BOOT',
        30_000,
        {
          navigationStartedAtEpochMs: initialNavigationStartedAtEpochMs,
          pageReadyAtEpochMs: initialPageReadyAtEpochMs,
        },
      );
    } catch (error) {
      const activeTarget = findExtensionServiceWorkerTarget(
        await getTargetInfos(cdp),
        extensionId,
      );
      error.cwsRuntimeDiagnostics = {
        ...(error.cwsRuntimeDiagnostics || {}),
        lifecyclePhase: 'dashboard_initial_boot',
        dashboardBoot: error.cwsDashboardBoot || null,
        initialDocumentReadiness,
        sequenceState,
        bootPrewarmResponse: await collectBootPrewarmResponseError(cdp, extensionId).catch(
          (responseError) => ({
            success: false,
            responseError: sanitizeServiceWorkerDiagnosticText(
              responseError?.message || responseError,
            ),
          }),
        ),
        storageAtFailure: await collectStorageSummary(cdp, extensionId).catch((storageError) => ({
          error: sanitizeServiceWorkerDiagnosticText(storageError?.message || storageError),
        })),
        workerDiagnostics: await collectAttachedServiceWorkerDiagnostics(
          serviceWorkerDiagnostics,
          activeTarget,
        ),
      };
      error.message = `${error.message}:CWS_RUNTIME_DIAGNOSTICS:${JSON.stringify(error.cwsRuntimeDiagnostics)}`;
      throw error;
    }
    const coldReloads = [];
    for (let sampleIndex = 0; sampleIndex < visualSampleCount; sampleIndex += 1) {
      const completedVisualSampleReadiness = coldReloads.map((sample) => ({
        index: sample.index,
        documentReadiness: sample.documentReadiness,
      }));
      let presentationEvidence;
      try {
        presentationEvidence = await presentCwsVisualTarget(cdp, dashboard);
      } catch (error) {
        throw attachDashboardVisualAdmissionDiagnostics(error, {
          lifecyclePhase: 'dashboard_visual_presentation',
          visualSampleIndex: sampleIndex,
          completedVisualSampleReadiness,
          sequenceState,
        });
      }
      let previousReadinessSnapshot;
      try {
        previousReadinessSnapshot = await waitForPageReady(
          cdp,
          dashboard.sessionId,
          {
            expectedUrl: dashboardUrl,
            requireVisible: true,
          },
        );
      } catch (error) {
        throw attachDashboardVisualAdmissionDiagnostics(error, {
          lifecyclePhase: 'dashboard_visual_page_admission',
          visualSampleIndex: sampleIndex,
          presentationEvidence,
          completedVisualSampleReadiness,
          sequenceState,
        });
      }
      const beforeReloadReadiness = projectPageReadinessEvidence(
        previousReadinessSnapshot,
        presentationEvidence,
      );
      let stoppedTarget;
      try {
        stoppedTarget = await stopExtensionServiceWorker(
          cdp,
          extensionId,
          serviceWorkerDiagnostics,
        );
      } catch (error) {
        throw attachDashboardVisualAdmissionDiagnostics(error, {
          lifecyclePhase: 'dashboard_visual_cold_quiescence',
          visualSampleIndex: sampleIndex,
          presentationEvidence,
          documentReadiness: { beforeReload: beforeReloadReadiness },
          completedVisualSampleReadiness,
          sequenceState,
        });
      }
      const reloadNavigationStartedAtEpochMs = Date.now();
      let reloadReadinessSnapshot;
      try {
        await cdp.send('Page.reload', { ignoreCache: false }, dashboard.sessionId);
        reloadReadinessSnapshot = await waitForPageReady(cdp, dashboard.sessionId, {
          expectedUrl: dashboardUrl,
          previousDocumentGeneration: previousReadinessSnapshot.documentGeneration,
          requireVisible: true,
        });
      } catch (error) {
        throw attachDashboardVisualAdmissionDiagnostics(error, {
          lifecyclePhase: 'dashboard_visual_reload_page_admission',
          visualSampleIndex: sampleIndex,
          presentationEvidence,
          documentReadiness: { beforeReload: beforeReloadReadiness },
          completedVisualSampleReadiness,
          sequenceState,
        });
      }
      const documentReadiness = {
        beforeReload: beforeReloadReadiness,
        afterReload: projectPageReadinessEvidence(reloadReadinessSnapshot),
      };
      const reloadPageReadyAtEpochMs = Date.now();
      let reloaded;
      try {
        reloaded = await waitForDashboardBoot(
          cdp,
          dashboard.sessionId,
          `MV3_DASHBOARD_COLD_RELOAD_${sampleIndex + 1}`,
          30_000,
          {
            navigationStartedAtEpochMs: reloadNavigationStartedAtEpochMs,
            pageReadyAtEpochMs: reloadPageReadyAtEpochMs,
          },
        );
      } catch (error) {
        const revivedTargetAtFailure = findExtensionServiceWorkerTarget(
          await getTargetInfos(cdp),
          extensionId,
        );
        error.cwsRuntimeDiagnostics = {
          ...(error.cwsRuntimeDiagnostics || {}),
          lifecyclePhase: 'dashboard_cold_reload',
          visualSampleIndex: sampleIndex,
          dashboardBoot: error.cwsDashboardBoot || null,
          documentReadiness,
          completedVisualSampleReadiness,
          sequenceState,
          bootPrewarmResponse: await collectBootPrewarmResponseError(cdp, extensionId).catch(
            (responseError) => ({
              success: false,
              responseError: sanitizeServiceWorkerDiagnosticText(
                responseError?.message || responseError,
              ),
            }),
          ),
          storageAtFailure: await collectStorageSummary(cdp, extensionId).catch((storageError) => ({
            error: sanitizeServiceWorkerDiagnosticText(storageError?.message || storageError),
          })),
          workerDiagnostics: await collectAttachedServiceWorkerDiagnostics(
            serviceWorkerDiagnostics,
            revivedTargetAtFailure,
          ),
        };
        error.message = `${error.message}:CWS_RUNTIME_DIAGNOSTICS:${JSON.stringify(error.cwsRuntimeDiagnostics)}`;
        throw error;
      }
      const revivedTarget = await waitForExtensionServiceWorker(cdp, extensionId, {
        previousTargetId: stoppedTarget.targetId,
      });
      coldReloads.push({
        index: sampleIndex,
        stoppedTargetId: stoppedTarget.targetId,
        coldQuiescence: stoppedTarget.coldQuiescence,
        revivedTargetId: revivedTarget.targetId,
        documentReadiness,
        snapshot: reloaded.snapshot,
        timing: reloaded.timing,
      });
    }
    const firstReload = coldReloads[0];
    const finalReload = coldReloads.at(-1);
    const finalWorkerTarget = findExtensionServiceWorkerTarget(
      await getTargetInfos(cdp),
      extensionId,
    );
    const visualFirstFrameMeasurement = projectCwsDashboardVisualEvidence(
      summarizeCwsDashboardVisualFirstFrames(coldReloads),
      visualEnvironment,
    );
    if (requireNonDegradedVisual && visualFirstFrameMeasurement.invalidSampleCount > 0) {
      const error = new Error('MV3_DASHBOARD_NONDEGRADED_FIRST_FRAME_REQUIRED');
      error.cwsRuntimeDiagnostics = {
        lifecyclePhase: 'dashboard_visual_first_frame',
        visualFirstFrameMeasurement,
      };
      throw error;
    }
    if (requireVisualThreshold && visualFirstFrameMeasurement.releaseThresholdEligible !== true) {
      const error = new Error('MV3_DASHBOARD_VISUAL_THRESHOLD_REQUIRED');
      error.cwsRuntimeDiagnostics = {
        lifecyclePhase: 'dashboard_visual_first_frame',
        visualFirstFrameMeasurement,
      };
      throw error;
    }
    return {
      dashboardUrl,
      stoppedTargetId: firstReload.stoppedTargetId,
      revivedTargetId: firstReload.revivedTargetId,
      initialSnapshot: initial.snapshot,
      initialBootTiming: initial.timing,
      initialDocumentReadiness,
      reloadedSnapshot: firstReload.snapshot,
      reloadedBootTiming: firstReload.timing,
      visualColdReloads: coldReloads,
      visualFirstFrameMeasurement,
      sequenceState,
      workerDiagnostics: await collectAttachedServiceWorkerDiagnostics(
        serviceWorkerDiagnostics,
        finalWorkerTarget?.targetId === finalReload.revivedTargetId
          ? finalWorkerTarget
          : null,
      ),
    };
  } finally {
    await closeTarget(cdp, dashboard.targetId);
  }
}

function diffMetric(after, before, pathName) {
  const next = getPath(after, pathName);
  const previous = getPath(before, pathName);
  if (!Number.isFinite(Number(next)) || !Number.isFinite(Number(previous))) return null;
  return Number(next) - Number(previous);
}

function getPath(source, pathName) {
  return String(pathName).split('.').reduce((value, key) => (
    value && typeof value === 'object' ? value[key] : undefined
  ), source);
}

function evaluateBudgets(report, budgets) {
  const checks = [];
  const firstReload = report.scenarios.reloads[0]?.metrics;
  const lastReload = report.scenarios.reloads.at(-1)?.metrics;
  const reloadHeapGrowth = firstReload && lastReload
    ? diffMetric(lastReload, firstReload, 'summary.jsHeapUsedBytes')
    : null;
  checks.push(createBudgetCheck(
    'reload_heap_growth',
    reloadHeapGrowth,
    budgets.maxReloadHeapGrowthBytes,
    'JS heap growth across protected-page reload loop after forced GC',
  ));

  const mutationBefore = report.scenarios.mutation.before;
  const mutationAfter = report.scenarios.mutation.after;
  const mutationHeapGrowth = mutationBefore && mutationAfter
    ? diffMetric(mutationAfter, mutationBefore, 'summary.jsHeapUsedBytes')
    : null;
  checks.push(createBudgetCheck(
    'mutation_heap_growth',
    mutationHeapGrowth,
    budgets.maxMutationHeapGrowthBytes,
    'JS heap growth across same-page DOM churn after forced GC',
  ));

  const initialLocalBytes = report.storage.initial?.local?.bytes;
  const finalLocalBytes = report.storage.final?.local?.bytes;
  const localStorageGrowth = Number.isFinite(Number(initialLocalBytes)) && Number.isFinite(Number(finalLocalBytes))
    ? Number(finalLocalBytes) - Number(initialLocalBytes)
    : null;
  checks.push(createBudgetCheck(
    'local_storage_growth',
    localStorageGrowth,
    budgets.maxStorageLocalGrowthBytes,
    'chrome.storage.local payload growth during filter-only runtime probe',
  ));

  const allPageMetrics = [
    ...report.scenarios.reloads.map((entry) => entry.metrics),
    report.scenarios.mutation.before,
    report.scenarios.mutation.after,
  ].filter(Boolean);
  const maxLongTaskTotal = Math.max(0, ...allPageMetrics.map((entry) => Number(entry.summary?.longTaskTotalMs) || 0));
  checks.push(createBudgetCheck(
    'long_task_total_per_scenario',
    maxLongTaskTotal,
    budgets.maxLongTaskTotalMsPerScenario,
    'Largest scenario long-task total observed by PerformanceObserver',
  ));

  const maxLongTask = Math.max(0, ...allPageMetrics.map((entry) => Number(entry.summary?.longTaskMaxMs) || 0));
  checks.push(createBudgetCheck(
    'long_task_max',
    maxLongTask,
    budgets.maxLongTaskMaxMs,
    'Largest single long task observed by PerformanceObserver',
  ));

  const finalTargets = report.targets.afterCloseAndIdle;
  checks.push(createBudgetCheck(
    'extension_dedicated_workers_after_close',
    finalTargets?.extensionDedicatedWorkers?.length ?? null,
    budgets.maxExtensionDedicatedWorkersAfterClose,
    'Extension dedicated/shared worker targets remaining after protected pages close',
  ));
  checks.push(createBudgetCheck(
    'extension_service_workers_after_idle',
    finalTargets?.extensionServiceWorkers?.length ?? null,
    budgets.maxExtensionServiceWorkersAfterIdle,
    'Extension service worker targets remaining after idle wait',
  ));

  return checks;
}

function createBudgetCheck(name, actual, limit, note) {
  const actualNumber = Number(actual);
  const limitNumber = Number(limit);
  if (!Number.isFinite(actualNumber) || !Number.isFinite(limitNumber)) {
    return {
      name,
      status: 'warn',
      actual,
      limit,
      note: `${note}; metric unavailable`,
    };
  }
  return {
    name,
    status: actualNumber <= limitNumber ? 'pass' : 'fail',
    actual: Math.round(actualNumber),
    limit: Math.round(limitNumber),
    note,
  };
}

function summarizeTopStorageKeys(storageArea = {}) {
  const entries = Array.isArray(storageArea?.entries) ? storageArea.entries : [];
  return entries
    .filter((entry) => (
      entry
      && typeof entry.key === 'string'
      && Number.isFinite(Number(entry.bytes))
    ))
    .map((entry) => ({
      key: entry.key,
      bytes: Number(entry.bytes),
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 12);
}

function assertStorageReportProjection(storage = {}) {
  for (const stage of ['initial', 'afterMutation', 'final']) {
    const snapshot = storage?.[stage];
    if (!snapshot) continue;
    for (const areaName of ['local', 'session']) {
      const area = snapshot?.[areaName];
      if (!area) continue;
      if (Object.prototype.hasOwnProperty.call(area, 'values')) {
        throw new Error(`CWS_RUNTIME_REPORT_RAW_STORAGE_VALUES:${stage}:${areaName}`);
      }
      if (!Array.isArray(area.entries)) {
        throw new Error(`CWS_RUNTIME_REPORT_STORAGE_SUMMARY_MISSING:${stage}:${areaName}`);
      }
      for (const entry of area.entries) {
        const entryKeys = Object.keys(entry || {}).sort();
        if (
          entryKeys.length !== 2
          || entryKeys[0] !== 'bytes'
          || entryKeys[1] !== 'key'
          || typeof entry.key !== 'string'
          || !Number.isFinite(Number(entry.bytes))
        ) {
          throw new Error(`CWS_RUNTIME_REPORT_STORAGE_ENTRY_INVALID:${stage}:${areaName}`);
        }
      }
    }
  }
}

async function writeReport(report, reportDir) {
  const resolvedReportDir = path.resolve(rootDir, reportDir);
  await fs.mkdir(resolvedReportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(resolvedReportDir, `cws-runtime-${stamp}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

function printSummary(report, reportPath) {
  console.log('\n[cws-runtime] Measurement summary');
  console.log(`[cws-runtime] report=${path.relative(rootDir, reportPath)}`);
  console.log(`[cws-runtime] extensionId=${report.extensionId}`);
  console.log(`[cws-runtime] probeUrl=${report.probeUrl}`);
  console.log(`[cws-runtime] registeredScripts=${JSON.stringify(report.configuration.registeredScripts?.scripts || [])}`);
  if (report.scenarios?.lifecycle) {
    console.log(
      `[cws-runtime] spaContinuity=document:${report.scenarios.lifecycle.spaContinuity.documentId}`
      + ` events:${report.scenarios.lifecycle.spaContinuity.beforeEventCount}`
      + `->${report.scenarios.lifecycle.spaContinuity.afterEventCount}`,
    );
    console.log(
      `[cws-runtime] workerRevival=${report.scenarios.lifecycle.workerRevival.stoppedTargetId}`
      + `->${report.scenarios.lifecycle.workerRevival.revivedTargetId}`,
    );
    console.log(
      `[cws-runtime] nudgeSessionLifecycle=${report.scenarios.lifecycle.nudgeSessionLifecycle.phaseSequence.join('->')}`
      + ` worker:${report.scenarios.lifecycle.nudgeSessionLifecycle.stoppedTargetId}`
      + `->${report.scenarios.lifecycle.nudgeSessionLifecycle.revivedTargetId}`,
    );
    const dashboardColdReload = report.scenarios.lifecycle.dashboardColdReload;
    console.log(dashboardColdReload?.status === 'failed'
      ? `[cws-runtime] dashboardColdReload=FAILED:${dashboardColdReload.error}`
      : `[cws-runtime] dashboardColdReload=${dashboardColdReload?.stoppedTargetId}`
        + `->${dashboardColdReload?.revivedTargetId}`);
    const visualMeasurement = dashboardColdReload?.visualFirstFrameMeasurement;
    if (visualMeasurement) {
      console.log(
        `[cws-runtime] dashboardVisual=${visualMeasurement.sampleClass}`
        + ` samples:${visualMeasurement.sampleCount}`
        + ` valid:${visualMeasurement.validSampleCount}`
        + ` environment:${visualMeasurement.environment?.class || 'unknown'}`
        + ` releaseEligible:${visualMeasurement.releaseThresholdEligible === true}`
        + ` navigation(p50/p95/max):${visualMeasurement.navigationToBootReady.p50Ms}`
        + `/${visualMeasurement.navigationToBootReady.p95Ms}`
        + `/${visualMeasurement.navigationToBootReady.maxMs}ms`,
      );
    }
    const wakeMeasurement = report.scenarios.lifecycle.workerWakeMeasurement;
    if (wakeMeasurement?.status === 'failed' && !wakeMeasurement?.summary) {
      console.log(`[cws-runtime] workerWake=FAILED:${wakeMeasurement.error}`);
    } else {
      console.log(
        `[cws-runtime] workerWake=${wakeMeasurement?.instrumentationMode}`
        + ` samples:${wakeMeasurement?.sampleCount}`
        + ` cold(p50/p95/max):${wakeMeasurement?.summary?.cold?.p50Ms}`
        + `/${wakeMeasurement?.summary?.cold?.p95Ms}`
        + `/${wakeMeasurement?.summary?.cold?.maxMs}ms`
        + ` warm(p50/p95/max):${wakeMeasurement?.summary?.warm?.p50Ms}`
        + `/${wakeMeasurement?.summary?.warm?.p95Ms}`
        + `/${wakeMeasurement?.summary?.warm?.maxMs}ms`,
      );
    }
    const historyCleanup = report.scenarios.lifecycle.historyCleanupReactivation;
    console.log(historyCleanup?.status === 'failed'
      ? `[cws-runtime] historyCleanupReactivation=FAILED:${historyCleanup.error}`
      : `[cws-runtime] historyCleanupReactivation=${historyCleanup?.reactivation?.workerBeforeTargetId}`
        + `->${historyCleanup?.reactivation?.workerAfterTargetId}`
        + ` visits:${historyCleanup?.finalState?.visitCount}`);
  }
  console.log(`[cws-runtime] storage.local.initial=${report.storage.initial?.local?.bytes ?? 'n/a'}B final=${report.storage.final?.local?.bytes ?? 'n/a'}B`);
  console.log('[cws-runtime] top local storage keys:');
  for (const entry of summarizeTopStorageKeys(report.storage.final?.local)) {
    console.log(`  ${entry.bytes}B ${entry.key}`);
  }
  console.log('[cws-runtime] budget checks:');
  for (const check of report.budgetChecks) {
    console.log(`  ${check.status.toUpperCase()} ${check.name}: actual=${check.actual} limit=${check.limit}`);
  }
  const finalWorkers = report.targets.afterCloseAndIdle?.extensionTargets || [];
  console.log('[cws-runtime] extension targets after close+idle:');
  for (const target of finalWorkers) {
    console.log(`  ${target.type} ${target.url}`);
  }
}

async function cleanupCwsRuntime({
  browserProfileRoot,
  cdp,
  chrome,
  chromePath,
  ownsBrowserProfileRoot,
  ownedBrowserIdentityVerified,
  options,
  probeServer,
  serviceWorkerDiagnostics,
  tempRoot,
  userDataDir,
}) {
  serviceWorkerDiagnostics?.stop();
  const wslWindowsChrome = isWslWindowsChromeExecutable(chromePath);
  if (cdp && wslWindowsChrome && ownedBrowserIdentityVerified === true) {
    try {
      await cdp.send('Browser.close', {}, null, { timeoutMs: 2_000 });
      await sleep(250);
    } catch (_) {}
  }
  cdp?.close();
  let chromeTerminationError = null;
  try {
    if (chrome) {
      await terminateQaOwnedChromiumProcess(chrome, {
        graceMs: wslWindowsChrome ? 1_500 : 0,
        terminateTimeoutMs: 1_500,
        killTimeoutMs: 2_500,
      });
    }
  } catch (error) {
    chromeTerminationError = error;
  }
  if (probeServer) await probeServer.close();
  if (!options.keepTemp && !chromeTerminationError) {
    await cleanupOwnedCwsRuntimeTempRoots({
      tempRoot,
      browserProfileRoot,
      ownsBrowserProfileRoot,
    });
  } else if (tempRoot) {
    console.log(`[cws-runtime] tempRoot=${tempRoot}`);
    if (browserProfileRoot !== tempRoot) {
      console.log(`[cws-runtime] browserProfileRoot=${browserProfileRoot}`);
    }
  }
  if (chromeTerminationError) throw chromeTerminationError;
}

async function main() {
  const parsedOptions = parseArgs(process.argv.slice(2));
  const options = admitQaExtensionBrowserChildExecution({
    ...parsedOptions,
    renderingRequirement: parsedOptions.requireDashboardVisualThreshold
      ? 'physical_gpu_required'
      : parsedOptions.headless
        ? 'headless_ok'
        : 'headed_required',
  });
  if (
    options.requireDashboardVisualThreshold
    && options.renderingRequirement !== 'physical_gpu_required'
  ) {
    throw new Error('CWS_BROWSER_EXECUTION_GPU_REQUIREMENT_MISMATCH');
  }
  if (options.build) {
    await runCommand('npm', ['run', 'cws:preflight']);
  }

  const chromePath = findChromeExecutable();
  if (!chromePath) {
    throw new Error('Chrome/Chromium executable not found. Set CHROME_BIN=/path/to/chrome to run runtime measurement.');
  }

  let tempRoot = null;
  let browserProfileRoot = null;
  let userDataDir = null;
  let ownsBrowserProfileRoot = false;
  let probeServer = null;
  let chrome = null;
  let cdp = null;
  let ownedBrowserIdentityVerified = false;
  let serviceWorkerDiagnostics = null;
  let lifecycleControllerInstall = null;
  let lifecycleControllerExtensionId = null;
  let reportPath = null;
  let displayLease = null;
  let displayReceipt = null;
  let failure = null;
  let failureStage = 'browser_preparation';
  const browserCapacityLease = await acquireQaBrowserCapacity({
    rootDir,
    ownerId: `cws-runtime:pid=${process.pid}`,
  });
  try {
    displayLease = new QaDisplayLease({
      rootDir,
      executionPlan: options.browserExecution
        ? {
          ...options.browserExecution,
          renderingRequirement: options.renderingRequirement,
        }
        : {
          headless: options.headless,
          displayPolicy: options.headless ? 'none' : 'host_display_required',
          gpuRequirement: options.requireDashboardVisualThreshold
            ? 'hardware_active_required'
            : 'software_or_unclassified_allowed',
          renderingRequirement: options.renderingRequirement,
        },
      browser: {
        processOwnership: 'owned',
        chrome: chromePath,
      },
    });
    displayReceipt = await displayLease.acquire();
    ({
      tempRoot,
      browserProfileRoot,
      userDataDir,
      ownsBrowserProfileRoot,
    } = await createCwsRuntimeTempRoots(chromePath, {
      browserProfileDir: options.browserProfileDir,
    }));
    await fs.mkdir(userDataDir, { recursive: true });
    const extensionDir = await prepareMeasurementExtension({
      distDir: options.distDir,
      tempRoot,
      includeHistoryCleanupLifecycle: options.lifecycle,
    });
    const controllerExtensionDir = options.lifecycle
      ? await prepareCwsHistoryCleanupControllerExtension({ tempRoot })
      : null;
    probeServer = await startProbeServer({ cards: options.cards });
    const wslWindowsChrome = isWslWindowsChromeExecutable(chromePath);
    const remoteDebuggingPort = wslWindowsChrome
      ? getWslWindowsFreePort()
      : await getFreePort();
    chrome = launchChrome({
      chromePath,
      userDataDir,
      extensionDir,
      remoteDebuggingPort,
      probePort: probeServer.port,
      headless: options.headless,
      graphicsMode: options.graphicsMode,
      additionalExtensionDirs: controllerExtensionDir ? [controllerExtensionDir] : [],
      launchEnvironment: displayReceipt.launchEnvironment,
    });
    chrome.stderr.on('data', (chunk) => {
      const text = String(chunk).trim();
      if (text) console.error(`[chrome] ${text}`);
    });

    const version = await waitForDebugEndpoint(remoteDebuggingPort);
    cdp = new CdpConnection(version.webSocketDebuggerUrl);
    await cdp.open();
    await verifyQaOwnedChromiumEndpointIdentity(chrome, cdp);
    ownedBrowserIdentityVerified = true;
    const chromeGraphics = await cdp.send('SystemInfo.getInfo')
      .then(projectChromeGraphicsInfo)
      .catch((error) => ({
        error: sanitizeServiceWorkerDiagnosticText(error?.message || error),
      }));
    const extensionId = await waitForExtensionId(cdp);
    if (options.lifecycle) {
      const nativeControllerExtensionDir = resolveChromeLaunchPaths({
        chromePath,
        userDataDir,
        extensionDir: controllerExtensionDir,
      }).extensionDir;
      const controllerLoad = await installHarnessExtension(
        cdp,
        nativeControllerExtensionDir,
      );
      lifecycleControllerInstall = controllerLoad;
      if (
        lifecycleControllerInstall.installMode !== 'command_line'
        || lifecycleControllerInstall.uninstallOnClose !== false
      ) {
        throw new Error('MV3_LIFECYCLE_CONTROLLER_COMMAND_LINE_OWNERSHIP_REQUIRED');
      }
      lifecycleControllerExtensionId = lifecycleControllerInstall.extensionId;
    }
    serviceWorkerDiagnostics = new ServiceWorkerCdpDiagnostics(cdp, extensionId, {
      pauseWorkerOnStart: options.pauseWorkerOnStart,
    });
    await serviceWorkerDiagnostics.start();
    const probeUrl = `http://${PROBE_HOST}:${probeServer.port}/feed`;

    failureStage = 'extension_configuration';
    const prepareSecurityVault = createCwsSecurityVaultPreparation({
      cdp,
      extensionId,
      browserExecution: options.browserExecution,
      ownedBrowserIdentityVerified,
      tempRoot,
      userDataDir,
      extensionDir,
      browserProfileDir: options.browserProfileDir,
    });
    const configuration = await configureExtension(cdp, extensionId, { prepareSecurityVault });
    const storageInitial = await collectHarnessSnapshot(cdp, extensionId, {
      targetUrl: probeUrl,
      diagnosticsLimit: 40,
    });
    const targetsInitial = await collectTargetSnapshot(cdp, extensionId);

    failureStage = 'content_reload_measurement';
    const page = await openTarget(cdp);
    const reloads = [];
    for (let i = 0; i < options.iterations; i += 1) {
      const url = `${probeUrl}?run=reload-${i}&cards=${options.cards}&ts=${Date.now()}`;
      await navigateTarget(cdp, page.sessionId, url);
      await waitForContentDiagnostics(cdp, extensionId, url);
      await evaluate(cdp, page.sessionId, 'window.__entropyProbeScroll?.(6)', { timeoutMs: 12_000 }).catch(() => null);
      await sleep(options.settleMs);
      reloads.push({
        index: i,
        url,
        metrics: await collectPageMetrics(cdp, page.sessionId, `reload-${i}`),
        targets: await collectTargetSnapshot(cdp, extensionId),
      });
    }

    let lifecycle = null;
    let deferredLifecycleError = null;
    let deferredWorkerWakeError = null;
    let deferredHistoryCleanupError = null;
    if (options.lifecycle) {
      failureStage = 'mv3_lifecycle';
      const lifecycleTargetUrl = reloads.at(-1)?.url || probeUrl;
      console.error('[cws-runtime] lifecycle START spa-continuity');
      const spaContinuity = await runSpaContinuityScenario(
        cdp,
        extensionId,
        page.sessionId,
        lifecycleTargetUrl,
      );
      console.error('[cws-runtime] lifecycle PASS spa-continuity');
      console.error('[cws-runtime] lifecycle START worker-revival');
      const workerRevival = await runWorkerRevivalScenario(
        cdp,
        extensionId,
        lifecycleTargetUrl,
        serviceWorkerDiagnostics,
      );
      console.error('[cws-runtime] lifecycle PASS worker-revival');
      console.error('[cws-runtime] lifecycle START nudge-session-revival');
      const nudgeSessionLifecycle = await runNudgeSessionLifecycleScenario(
        cdp,
        extensionId,
        lifecycleTargetUrl,
        serviceWorkerDiagnostics,
      );
      console.error('[cws-runtime] lifecycle PASS nudge-session-revival');
      const activeWorkerBeforeDashboard = findExtensionServiceWorkerTarget(
        await getTargetInfos(cdp),
        extensionId,
      );
      const dashboardSequenceState = {
        storage: await collectStorageSummary(cdp, extensionId),
        workerDiagnostics: await serviceWorkerDiagnostics.snapshot(
          activeWorkerBeforeDashboard?.targetId,
        ),
      };
      console.error('[cws-runtime] lifecycle START dashboard-cold-reload');
      let dashboardColdReload;
      try {
        dashboardColdReload = await runDashboardColdReloadScenario(
          cdp,
          extensionId,
          serviceWorkerDiagnostics,
          dashboardSequenceState,
          {
            visualSampleCount: options.dashboardVisualSamples,
            requireNonDegradedVisual: options.requireNonDegradedDashboardFrame,
            requireVisualThreshold: options.requireDashboardVisualThreshold,
            visualEnvironment: {
              headless: options.headless,
              graphicsMode: options.graphicsMode,
              softwareRendererDetected: chromeGraphics?.softwareRendererDetected ?? null,
            },
          },
        );
        console.error('[cws-runtime] lifecycle PASS dashboard-cold-reload');
      } catch (error) {
        deferredLifecycleError = error;
        dashboardColdReload = {
          status: 'failed',
          error: sanitizeServiceWorkerDiagnosticText(error?.message || error),
          diagnostics: error?.cwsRuntimeDiagnostics || null,
        };
        console.error(
          `[cws-runtime] lifecycle FAIL dashboard-cold-reload (deferred): ${error?.message || error}`,
        );
      }
      console.error(`[cws-runtime] lifecycle START worker-wake-measurement samples=${options.wakeSamples}`);
      let workerWakeMeasurement;
      try {
        workerWakeMeasurement = await runServiceWorkerWakeMeasurementScenario({
          cdp,
          extensionId,
          serviceWorkerDiagnostics,
          sampleCount: Math.max(1, options.wakeSamples),
        });
        if (workerWakeMeasurement.failedSampleCount > 0) {
          deferredWorkerWakeError = new Error(
            `MV3_WORKER_WAKE_MEASUREMENT_FAILED:${JSON.stringify({
              failedSampleCount: workerWakeMeasurement.failedSampleCount,
              samples: workerWakeMeasurement.samples,
            })}`,
          );
          deferredWorkerWakeError.cwsRuntimeDiagnostics = workerWakeMeasurement;
          console.error('[cws-runtime] lifecycle FAIL worker-wake-measurement (deferred)');
        } else {
          console.error('[cws-runtime] lifecycle PASS worker-wake-measurement');
        }
      } catch (error) {
        deferredWorkerWakeError = error;
        workerWakeMeasurement = {
          status: 'failed',
          error: sanitizeServiceWorkerDiagnosticText(error?.message || error),
          diagnostics: error?.cwsRuntimeDiagnostics || null,
        };
        console.error(
          `[cws-runtime] lifecycle FAIL worker-wake-measurement (deferred): ${error?.message || error}`,
        );
      }
      console.error('[cws-runtime] lifecycle START history-cleanup-reactivation');
      let historyCleanupReactivation;
      try {
        historyCleanupReactivation = await runHistoryCleanupLifecycleScenario({
          cdp,
          extensionId,
          controllerExtensionId: lifecycleControllerExtensionId,
          pageSessionId: page.sessionId,
          probeUrl,
          serviceWorkerDiagnostics,
          prepareSecurityVault,
        });
        console.error('[cws-runtime] lifecycle PASS history-cleanup-reactivation');
      } catch (error) {
        deferredHistoryCleanupError = error;
        historyCleanupReactivation = {
          status: 'failed',
          error: sanitizeServiceWorkerDiagnosticText(error?.message || error),
          diagnostics: error?.cwsRuntimeDiagnostics || null,
        };
        console.error(
          `[cws-runtime] lifecycle FAIL history-cleanup-reactivation (deferred): ${error?.message || error}`,
        );
      }
      lifecycle = {
        spaContinuity,
        workerRevival,
        nudgeSessionLifecycle,
        dashboardColdReload,
        workerWakeMeasurement,
        historyCleanupReactivation,
      };
    }

    failureStage = 'mutation_measurement';
    const mutationBefore = await collectPageMetrics(cdp, page.sessionId, 'mutation-before');
    await evaluate(cdp, page.sessionId, `window.__entropyProbeChurn?.(${options.churn})`, { timeoutMs: 20_000 }).catch(() => null);
    await evaluate(cdp, page.sessionId, 'window.__entropyProbeScroll?.(10)', { timeoutMs: 12_000 }).catch(() => null);
    await sleep(options.settleMs);
    const mutationAfter = await collectPageMetrics(cdp, page.sessionId, 'mutation-after');
    const storageAfterMutation = await collectHarnessSnapshot(cdp, extensionId, {
      targetUrl: probeUrl,
      diagnosticsLimit: 160,
    });
    const targetsBeforeClose = await collectTargetSnapshot(cdp, extensionId);

    await closeTarget(cdp, page.targetId);
    await sleep(options.idleMs);
    const targetsAfterCloseAndIdle = await collectTargetSnapshot(cdp, extensionId);
    const storageFinal = await collectHarnessSnapshot(cdp, extensionId, {
      targetUrl: probeUrl,
      diagnosticsLimit: 200,
    });

    failureStage = 'report';
    const report = {
      schemaVersion: 3,
      status: deferredLifecycleError || deferredWorkerWakeError || deferredHistoryCleanupError
        ? 'failed'
        : 'passed',
      failures: [
        ...(deferredLifecycleError ? [{
          scenario: 'dashboard-cold-reload',
          error: sanitizeServiceWorkerDiagnosticText(
            deferredLifecycleError?.message || deferredLifecycleError,
          ),
          diagnostics: deferredLifecycleError?.cwsRuntimeDiagnostics || null,
        }] : []),
        ...(deferredWorkerWakeError ? [{
          scenario: 'worker-wake-measurement',
          error: sanitizeServiceWorkerDiagnosticText(
            deferredWorkerWakeError?.message || deferredWorkerWakeError,
          ),
          diagnostics: deferredWorkerWakeError?.cwsRuntimeDiagnostics || null,
        }] : []),
        ...(deferredHistoryCleanupError ? [{
          scenario: 'history-cleanup-reactivation',
          error: sanitizeServiceWorkerDiagnosticText(
            deferredHistoryCleanupError?.message || deferredHistoryCleanupError,
          ),
          diagnostics: deferredHistoryCleanupError?.cwsRuntimeDiagnostics || null,
        }] : []),
      ],
      generatedAt: new Date().toISOString(),
      measurementMode: 'public-build-temporary-required-permissions',
      note: options.lifecycle
        ? 'dist-prod code is copied to a temporary harness extension; scripting, history, and probe-host access are promoted only in that copy. Lifecycle mode also loads a run-owned management/history controller that disables and re-enables only the known Entropy extension id.'
        : 'dist-prod code is copied to a temporary harness extension; scripting and probe-host access are promoted only in that copy.',
      options,
      chrome: {
        executable: chromePath,
        product: version.Browser,
        protocolVersion: version['Protocol-Version'],
        headless: options.headless,
        graphics: chromeGraphics,
        display: displayReceipt,
      },
      extensionId,
      lifecycleControllerExtensionId,
      lifecycleControllerInstall,
      probeUrl,
      configuration,
      storage: {
        initial: storageInitial?.storage || null,
        afterMutation: storageAfterMutation?.storage || null,
        final: storageFinal?.storage || null,
      },
      diagnostics: {
        initial: storageInitial?.diagnostics || null,
        afterMutation: storageAfterMutation?.diagnostics || null,
        final: storageFinal?.diagnostics || null,
        serviceWorker: await serviceWorkerDiagnostics.snapshot(),
      },
      targets: {
        initial: targetsInitial,
        beforeClose: targetsBeforeClose,
        afterCloseAndIdle: targetsAfterCloseAndIdle,
      },
      scenarios: {
        reloads,
        lifecycle,
        mutation: {
          before: mutationBefore,
          after: mutationAfter,
        },
      },
    };
    assertStorageReportProjection(report.storage);
    report.budgetChecks = evaluateBudgets(report, options.budgets);
    const failed = report.budgetChecks.filter((check) => check.status === 'fail');
    const warned = report.budgetChecks.filter((check) => check.status === 'warn');
    if (failed.length > 0 || (options.failOnWarn && warned.length > 0)) {
      report.status = 'failed';
    }
    reportPath = await writeReport(report, options.reportDir);
    printSummary(report, reportPath);

    const deferredFailure = (
      deferredLifecycleError
      || deferredWorkerWakeError
      || deferredHistoryCleanupError
    );
    if (deferredFailure) {
      deferredFailure.message = `${deferredFailure.message}:REPORT:${reportPath}`;
      throw deferredFailure;
    }

    if (failed.length > 0 || (options.failOnWarn && warned.length > 0)) {
      process.exitCode = 1;
    }
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    const cleanup = [];
    const cleanupErrors = [];
    const release = async (owner, work) => {
      try { await work(); cleanup.push({ owner, status: 'released' }); }
      catch (error) {
        cleanupErrors.push(error);
        cleanup.push({ owner, status: 'failed', error: sanitizeServiceWorkerDiagnosticText(error?.message || error) });
      }
    };
    await release('runtime', () => cleanupCwsRuntime({
        browserProfileRoot,
        cdp,
        chrome,
        chromePath,
        ownsBrowserProfileRoot,
        ownedBrowserIdentityVerified,
        options,
        probeServer,
        serviceWorkerDiagnostics,
        tempRoot,
        userDataDir,
      }));
    await release('display', () => displayLease?.release());
    await release('capacity', () => browserCapacityLease.release());
    reportPath = await finalizeCwsRuntimeFailureReport({
      reportPath, stage: failureStage, error: failure, cleanup,
      writeReport: report => writeReport(report, options.reportDir),
    });
    if (failure || cleanupErrors.length) console.error(`[cws-runtime] failure report=${reportPath}`);
    if (cleanupErrors.length) {
      throw new AggregateError([...(failure ? [failure] : []), ...cleanupErrors], 'CWS_RUNTIME_CLEANUP_FAILED');
    }
  }
}

const PAGE_PERFORMANCE_PROBE_SOURCE = `(() => {
  if (window.__entropyPerfProbe) return;
  const state = {
    startedAt: performance.now(),
    longTasks: [],
  };
  window.__entropyPerfProbe = state;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTasks.push({
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
        });
        if (state.longTasks.length > 400) state.longTasks.shift();
      }
    });
    observer.observe({ type: 'longtask', buffered: true });
    state.longTaskObserverActive = true;
  } catch (error) {
    state.longTaskObserverActive = false;
    state.longTaskObserverError = String(error && error.message || error);
  }
})();`;

const PAGE_COLLECT_METRICS_EXPRESSION = `(() => {
  const longTasks = Array.isArray(window.__entropyPerfProbe?.longTasks)
    ? window.__entropyPerfProbe.longTasks
    : [];
  const entropyMarkedElements = document.querySelectorAll([
    '[data-friction-social-feedback]',
    '[data-friction-social-exposure]',
    '[data-friction-social-audience]',
    '[data-friction-social-time]',
    '[data-entropy-prepaint-suppressed]',
    '[data-entropy-state-click]',
    '[data-entropy-state-scroll]'
  ].join(',')).length;
  const entropyAttributeCount = Array.from(document.querySelectorAll('*')).reduce((count, element) => {
    return count + Array.from(element.attributes || []).filter((attr) => (
      attr.name.startsWith('data-friction') || attr.name.startsWith('data-entropy')
    )).length;
  }, 0);
  const durations = longTasks.map((entry) => Number(entry.duration) || 0);
  return {
    href: location.href,
    readyState: document.readyState,
    title: document.title,
    elementCount: document.querySelectorAll('*').length,
    entropyMarkedElements,
    entropyAttributeCount,
    rootFilter: document.documentElement.style.getPropertyValue('filter') || '',
    rootFilterPriority: document.documentElement.style.getPropertyPriority('filter') || '',
    rootAttrs: Array.from(document.documentElement.attributes || [])
      .filter((attr) => attr.name.startsWith('data-entropy') || attr.name.startsWith('data-friction'))
      .map((attr) => [attr.name, attr.value]),
    longTaskObserverActive: window.__entropyPerfProbe?.longTaskObserverActive === true,
    longTaskCount: longTasks.length,
    longTaskTotalMs: durations.reduce((sum, value) => sum + value, 0),
    longTaskMaxMs: durations.length ? Math.max(...durations) : 0,
    longTasks: longTasks.slice(-20),
  };
})()`;

const HARNESS_SEND_MESSAGE_SOURCE = `async function(message) {
  return await new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const error = chrome.runtime.lastError && chrome.runtime.lastError.message;
        if (error) {
          resolve({ success: false, error });
          return;
        }
        resolve(response || { success: false, error: 'EMPTY_RESPONSE' });
      });
    } catch (error) {
      resolve({ success: false, error: String(error && error.message || error) });
    }
  });
}`;

const HARNESS_TIMED_MESSAGE_PAIR_SOURCE = `async function(message) {
  const send = async () => {
    const sentAtEpochMs = Date.now();
    const response = await (${HARNESS_SEND_MESSAGE_SOURCE})(message);
    const respondedAtEpochMs = Date.now();
    return {
      sentAtEpochMs,
      respondedAtEpochMs,
      latencyMs: Math.max(0, respondedAtEpochMs - sentAtEpochMs),
      response: {
        success: response && response.success === true,
        error: response && typeof response.error === 'string' ? response.error : null,
      },
    };
  };
  return { cold: await send(), warm: await send() };
}`;

const HARNESS_SEED_ISSUED_NUDGE_RUN_SOURCE = `async function(input) {
  const values = await new Promise((resolve) => {
    chrome.storage.session.get([
      input.storageKeys.pending,
      input.storageKeys.lease,
    ], (result) => resolve(result || {}));
  });
  const pendingMap = values[input.storageKeys.pending] || {};
  const leaseMap = values[input.storageKeys.lease] || {};
  if (
    !pendingMap
    || typeof pendingMap !== 'object'
    || Array.isArray(pendingMap)
    || !leaseMap
    || typeof leaseMap !== 'object'
    || Array.isArray(leaseMap)
  ) {
    return { success: false, error: 'NUDGE_SESSION_MAP_INVALID' };
  }
  const pending = {
    ...pendingMap,
    [input.key]: {
      ts: input.now,
      runId: input.runId,
      tabId: input.tabId,
      phase: 'dispatching',
      hostname: input.hostname,
      deliveryForm: 'full',
      protocolClaim: {
        protocolScope: 'site',
        protocolVariant: 'site_furin',
        protocolIntensity: 0.62,
        triggerSource: 'mv3_lifecycle_e2e',
        priority: 10,
      },
    },
  };
  const lease = {
    ...leaseMap,
    [input.key]: {
      runId: input.runId,
      tabId: input.tabId,
      acquiredAt: input.now,
      expiresAt: input.now + 120000,
    },
  };
  await new Promise((resolve, reject) => {
    chrome.storage.session.set({
      [input.storageKeys.pending]: pending,
      [input.storageKeys.lease]: lease,
    }, () => {
      const error = chrome.runtime.lastError && chrome.runtime.lastError.message;
      if (error) reject(new Error(error));
      else resolve();
    });
  });
  return { success: true };
}`;

const HARNESS_SEND_TAB_NUDGE_LIFECYCLE_SOURCE = `async function(input) {
  return await new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: input.tabId, frameIds: [0] },
      func: async (message) => await new Promise((finish) => {
        chrome.runtime.sendMessage(message, (response) => {
          const error = chrome.runtime.lastError && chrome.runtime.lastError.message;
          finish({ response: response || null, error: error || null });
        });
      }),
      args: [input.message],
    }, (results) => {
      const injectionError = chrome.runtime.lastError && chrome.runtime.lastError.message;
      const result = Array.isArray(results) ? results[0]?.result : null;
      resolve({
        success: !injectionError && !result?.error && !!result?.response,
        error: injectionError || result?.error || null,
        response: result?.response || null,
      });
    });
  });
}`;

const HARNESS_CLEAR_NUDGE_RUN_SOURCE = `async function(input) {
  const storageKeyList = Object.values(input.storageKeys);
  const values = await new Promise((resolve) => {
    chrome.storage.session.get(storageKeyList, (result) => resolve(result || {}));
  });
  const patch = {};
  const isFixtureEntry = (storageKey, mapKey, entry) => {
    if (storageKey === input.storageKeys.terminalOutbox) {
      return !!(entry && typeof entry === 'object' && entry.key === input.key);
    }
    return mapKey === input.key;
  };
  for (const storageKey of storageKeyList) {
    const current = values[storageKey];
    if (!current || typeof current !== 'object' || Array.isArray(current)) continue;
    const next = { ...current };
    for (const [mapKey, entry] of Object.entries(next)) {
      if (isFixtureEntry(storageKey, mapKey, entry)) delete next[mapKey];
    }
    patch[storageKey] = next;
  }
  await new Promise((resolve, reject) => {
    chrome.storage.session.set(patch, () => {
      const error = chrome.runtime.lastError && chrome.runtime.lastError.message;
      if (error) reject(new Error(error));
      else resolve();
    });
  });
  const after = await new Promise((resolve, reject) => {
    chrome.storage.session.get(storageKeyList, (result) => {
      const error = chrome.runtime.lastError && chrome.runtime.lastError.message;
      if (error) reject(new Error(error));
      else resolve(result || {});
    });
  });
  const remaining = storageKeyList.filter((storageKey) => {
    const map = after[storageKey];
    if (!map || typeof map !== 'object' || Array.isArray(map)) return false;
    return Object.entries(map).some(([mapKey, entry]) => (
      isFixtureEntry(storageKey, mapKey, entry)
    ));
  });
  return { success: remaining.length === 0, remaining };
}`;

const HARNESS_INSTALL_NUDGE_LIFECYCLE_MONITOR_SOURCE = `function(input) {
  const key = input.key;
  const storageKeys = input.storageKeys;
  const summarizeEntry = (value, kind) => {
    const map = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const entry = map[key];
    if (!entry || typeof entry !== 'object') return { present: false };
    if (kind === 'pending') {
      return {
        present: true,
        runId: typeof entry.runId === 'string' ? entry.runId : null,
        tabId: Number.isInteger(entry.tabId) ? entry.tabId : null,
        phase: typeof entry.phase === 'string' ? entry.phase : null,
      };
    }
    if (kind === 'lease') {
      return {
        present: true,
        runId: typeof entry.runId === 'string' ? entry.runId : null,
        tabId: Number.isInteger(entry.tabId) ? entry.tabId : null,
      };
    }
    return {
      present: true,
      runId: typeof entry.runId === 'string' ? entry.runId : null,
      status: typeof entry.status === 'string' ? entry.status : null,
    };
  };
  if (window.__entropyNudgeLifecycleMonitor?.listener) {
    chrome.storage.onChanged.removeListener(window.__entropyNudgeLifecycleMonitor.listener);
  }
  const state = { events: [] };
  const listener = (changes, areaName) => {
    if (areaName !== 'session') return;
    const changedKeys = Object.keys(changes || {}).filter((storageKey) => (
      Object.values(storageKeys).includes(storageKey)
    ));
    if (!changedKeys.length) return;
    const pending = summarizeEntry(changes[storageKeys.pending]?.newValue, 'pending');
    const lease = summarizeEntry(changes[storageKeys.lease]?.newValue, 'lease');
    const terminal = summarizeEntry(changes[storageKeys.terminal]?.newValue, 'terminal');
    state.events.push({
      changedKeys: changedKeys.sort(),
      atomicPendingLease: changedKeys.includes(storageKeys.pending)
        && changedKeys.includes(storageKeys.lease)
        && pending.present === true
        && lease.present === true,
      pending,
      lease,
      terminal,
    });
    if (state.events.length > 80) state.events.shift();
  };
  state.listener = listener;
  window.__entropyNudgeLifecycleMonitor = state;
  chrome.storage.onChanged.addListener(listener);
  return { installed: true };
}`;

const HARNESS_READ_NUDGE_LIFECYCLE_MONITOR_SOURCE = `async function(input) {
  const key = input.key;
  const storageKeys = input.storageKeys;
  const values = await new Promise((resolve) => {
    chrome.storage.session.get(Object.values(storageKeys), (result) => resolve(result || {}));
  });
  const readEntry = (storageKey) => {
    const map = values[storageKey];
    if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
    const entry = map[key];
    return entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : null;
  };
  const pending = readEntry(storageKeys.pending);
  const lease = readEntry(storageKeys.lease);
  const terminal = readEntry(storageKeys.terminal);
  const terminalOutboxMap = values[storageKeys.terminalOutbox];
  const terminalOutbox = terminalOutboxMap
    && typeof terminalOutboxMap === 'object'
    && !Array.isArray(terminalOutboxMap)
    ? Object.values(terminalOutboxMap).find((entry) => (
      entry && typeof entry === 'object' && entry.key === key
    )) || null
    : null;
  const shownMap = values[storageKeys.shown];
  const ackMap = values[storageKeys.ack];
  return {
    events: (window.__entropyNudgeLifecycleMonitor?.events || []).map((event) => ({ ...event })),
    current: {
      pending: pending ? {
        present: true,
        runId: typeof pending.runId === 'string' ? pending.runId : null,
        tabId: Number.isInteger(pending.tabId) ? pending.tabId : null,
        phase: typeof pending.phase === 'string' ? pending.phase : null,
      } : { present: false },
      lease: lease ? {
        present: true,
        runId: typeof lease.runId === 'string' ? lease.runId : null,
        tabId: Number.isInteger(lease.tabId) ? lease.tabId : null,
      } : { present: false },
      terminal: terminal ? {
        present: true,
        runId: typeof terminal.runId === 'string' ? terminal.runId : null,
        status: typeof terminal.status === 'string' ? terminal.status : null,
      } : { present: false },
      terminalOutbox: terminalOutbox ? {
        present: true,
        runId: typeof terminalOutbox.runId === 'string' ? terminalOutbox.runId : null,
        state: typeof terminalOutbox.state === 'string' ? terminalOutbox.state : null,
      } : { present: false },
      shown: !!(shownMap && typeof shownMap === 'object' && shownMap[key]),
      acknowledged: !!(ackMap && typeof ackMap === 'object' && ackMap[key]),
    },
  };
}`;

const HARNESS_PERMISSIONS_SOURCE = `async function() {
  const callback = (method, arg) => new Promise((resolve) => {
    try {
      method(arg, (result) => resolve({ result, error: chrome.runtime.lastError && chrome.runtime.lastError.message }));
    } catch (error) {
      resolve({ result: null, error: String(error && error.message || error) });
    }
  });
  const getAll = await new Promise((resolve) => {
    chrome.permissions.getAll((result) => resolve({ result, error: chrome.runtime.lastError && chrome.runtime.lastError.message }));
  });
  const scripting = await callback(chrome.permissions.contains, { permissions: ['scripting'] });
  const host = await callback(chrome.permissions.contains, { origins: ['*://${PROBE_HOST}/*'] });
  return { getAll, scripting, host };
}`;

const HARNESS_REGISTERED_SCRIPTS_SOURCE = `async function() {
  if (!chrome.scripting || typeof chrome.scripting.getRegisteredContentScripts !== 'function') {
    return { scripts: [], error: 'scripting.getRegisteredContentScripts unavailable' };
  }
  return await new Promise((resolve) => {
    chrome.scripting.getRegisteredContentScripts((scripts) => {
      resolve({
        scripts: (scripts || []).map((script) => ({
          id: script.id,
          matches: script.matches || [],
          js: script.js || [],
          css: script.css || [],
          runAt: script.runAt || null,
          persistAcrossSessions: script.persistAcrossSessions,
        })),
        error: chrome.runtime.lastError && chrome.runtime.lastError.message,
      });
    });
  });
}`;

const HARNESS_COLLECT_STORAGE_SUMMARY_SOURCE = `async function() {
  const getBytes = (value) => {
    try { return JSON.stringify(value ?? null).length; } catch (_) { return 0; }
  };
  const readArea = (area) => new Promise((resolve) => {
    try {
      area.get(null, (values) => {
        const snapshot = values && typeof values === 'object' ? values : {};
        resolve({
          entries: Object.entries(snapshot).map(([key, value]) => ({
            key,
            bytes: getBytes(value),
          })),
          bytes: getBytes(snapshot),
          error: chrome.runtime.lastError && chrome.runtime.lastError.message,
        });
      });
    } catch (error) {
      resolve({ entries: [], bytes: 0, error: String(error && error.message || error) });
    }
  });
  return {
    local: await readArea(chrome.storage.local),
    session: chrome.storage.session
      ? await readArea(chrome.storage.session)
      : { entries: [], bytes: 0, error: 'chrome.storage.session unavailable' },
  };
}`;

const HARNESS_COLLECT_SNAPSHOT_SOURCE = `async function(input) {
  const options = input && typeof input === 'object' ? input : {};
  const sendMessage = ${HARNESS_SEND_MESSAGE_SOURCE};
  const getBytes = (value) => {
    try { return JSON.stringify(value ?? null).length; } catch (_) { return 0; }
  };
  const storageGet = (area) => new Promise((resolve) => {
    try {
      area.get(null, (values) => {
        const snapshot = values && typeof values === 'object' ? values : {};
        resolve({
          entries: Object.entries(snapshot).map(([key, value]) => ({
            key,
            bytes: getBytes(value),
          })),
          bytes: getBytes(snapshot),
          error: chrome.runtime.lastError && chrome.runtime.lastError.message,
        });
      });
    } catch (error) {
      resolve({ entries: [], bytes: 0, error: String(error && error.message || error) });
    }
  });
  const queryTabs = () => new Promise((resolve) => {
    try {
      chrome.tabs.query({ url: ['${PROBE_URL_PATTERN}'] }, (tabs) => resolve({
        tabs: (tabs || []).map((tab) => ({ id: tab.id, url: tab.url, status: tab.status, active: tab.active })),
        error: chrome.runtime.lastError && chrome.runtime.lastError.message,
      }));
    } catch (error) {
      resolve({ tabs: [], error: String(error && error.message || error) });
    }
  });
  const registeredScripts = await (${HARNESS_REGISTERED_SCRIPTS_SOURCE})();
  const tabs = await queryTabs();
  const targetTab = options.targetUrl
    ? tabs.tabs.find((tab) => tab.url === options.targetUrl) || tabs.tabs[0] || null
    : tabs.tabs[0] || null;
  const diagnostics = await sendMessage({
    action: '${MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS}',
    targetTabId: targetTab && Number.isInteger(targetTab.id) ? targetTab.id : undefined,
    limit: Number(options.diagnosticsLimit) || 80,
  });
  const globalContentRuntimeDiagnostics = options.includeGlobalContentRuntimeDiagnostics === true
    ? await sendMessage({
      action: '${MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS}',
      limit: Number(options.diagnosticsLimit) || 80,
    })
    : null;
  return {
    storage: {
      local: await storageGet(chrome.storage.local),
      session: chrome.storage.session ? await storageGet(chrome.storage.session) : { entries: [], bytes: 0, error: 'chrome.storage.session unavailable' },
    },
    tabs,
    targetTab,
    registeredScripts,
    diagnostics,
    globalContentRuntimeDiagnostics,
  };
}`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[cws-runtime] FAIL: ${error?.stack || error?.message || error}`);
    process.exitCode = 1;
  });
}
