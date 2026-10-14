import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { VISUAL_CAPTURE_TARGETS } from '../../../src/apps/visual-harness/visualSceneContract.js';
import { VISUAL_HARNESS_GLOBAL } from '../../../src/apps/visual-harness/visualHarnessRuntime.js';
import {
  serializeVisualHarnessError,
  writeVisualHarnessJson,
} from './visualHarnessReport.mjs';
import { buildVisualHarnessSceneUrl } from './visualHarnessServer.mjs';
import {
  launchQaPlaywrightBrowser,
  readQaPlaywrightBrowserReceipt,
} from '../../qa/browser/qaPlaywrightBrowserOwner.mjs';

async function settleCaptureSurface(page, timeoutMs) {
  await page.waitForFunction(
    () => !document.fonts || document.fonts.status === 'loaded',
    undefined,
    { timeout: timeoutMs },
  );
  await page.waitForFunction(
    () => Array.from(document.images).every((image) => image.complete),
    undefined,
    { timeout: timeoutMs },
  );
  await page.evaluate(() => new Promise((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(resolveFrame));
  }));
}

async function takeDeclaredCaptures(page, manifest, outputDir) {
  const files = [];
  for (const capture of manifest.captures) {
    const filePath = resolve(outputDir, `${capture.name}.png`);
    const screenshotOptions = {
      path: filePath,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    };

    if (capture.target === VISUAL_CAPTURE_TARGETS.viewport) {
      await page.screenshot({ ...screenshotOptions, fullPage: false });
    } else if (capture.target === VISUAL_CAPTURE_TARGETS.selector) {
      const locator = page.locator(capture.selector);
      const matchCount = await locator.count();
      if (matchCount !== 1) {
        const error = new Error(
          `[VisualHarness] capture '${capture.name}' expected one match for '${capture.selector}', found ${matchCount}.`,
        );
        error.code = 'VISUAL_CAPTURE_SELECTOR_CARDINALITY';
        error.details = {
          sceneId: manifest.id,
          captureName: capture.name,
          selector: capture.selector,
          matchCount,
        };
        throw error;
      }
      await locator.waitFor({ state: 'visible', timeout: manifest.readyTimeoutMs });
      await locator.screenshot(screenshotOptions);
    } else {
      throw new Error(`[VisualHarness] unsupported capture target '${capture.target}'.`);
    }

    files.push({ name: capture.name, path: filePath });
  }
  return files;
}

function createBrowserDiagnostics() {
  return {
    console: [],
    pageErrors: [],
    requestFailures: [],
  };
}

const SOURCE_REQUEST_LIMIT = 64;
const SOURCE_PATH_LIMIT = 240;

function createSourceStartupDiagnostics(origin, sourceCachePath) {
  const allowedOrigin = new URL(origin);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(allowedOrigin.hostname);
  const records = new Map();
  const startedAt = performance.now();
  let omittedCount = 0;
  let evictedCount = 0;
  let observedCount = 0;
  const elapsed = () => Math.round(performance.now() - startedAt);
  function start(request) {
    const resourceType = request.resourceType();
    if (!loopback || !['script', 'stylesheet'].includes(resourceType)) return;
    const url = new URL(request.url());
    if (url.origin !== allowedOrigin.origin) return;
    const sourceModule = /^\/(?:src\/|node_modules\/|@vite\/|@id\/|@react-refresh$)/.test(url.pathname);
    const ownedCacheModule = sourceCachePath !== null && url.pathname.startsWith(sourceCachePath);
    if (!sourceModule && !ownedCacheModule) return;
    observedCount += 1;
    if (records.size >= SOURCE_REQUEST_LIMIT) {
      const settled = [...records].find(([, record]) => record.state !== 'pending');
      if (settled) {
        records.delete(settled[0]);
        evictedCount += 1;
      }
      else {
        omittedCount += 1;
        return;
      }
    }
    records.set(request, {
      path: url.pathname.slice(0, SOURCE_PATH_LIMIT), resourceType,
      startMs: elapsed(), finishMs: null, state: 'pending',
    });
  }
  function settle(request, state) {
    const record = records.get(request);
    if (!record) return;
    record.state = state;
    record.finishMs = elapsed();
  }
  return {
    start,
    finish: request => settle(request, 'finished'),
    fail: request => settle(request, 'failed'),
    snapshot() {
      const now = elapsed();
      return {
        schemaVersion: 1, requestLimit: SOURCE_REQUEST_LIMIT, observedCount, omittedCount, evictedCount,
        requests: [...records.values()].map(record => ({
          ...record, ageMs: Math.max(0, (record.finishMs === null ? now : record.finishMs) - record.startMs),
        })),
      };
    },
  };
}

function serializeStartupReadError(error) {
  return {
    name: (error instanceof Error ? error.name : 'Error').slice(0, 80),
    code: typeof error?.code === 'string' ? error.code.slice(0, 120) : '',
    message: (error instanceof Error ? error.message : String(error)).slice(0, 512),
  };
}

function registerBrowserDiagnostics(page, diagnostics, sourceStartup) {
  page.on('request', sourceStartup.start);
  page.on('requestfinished', sourceStartup.finish);
  page.on('console', (message) => {
    diagnostics.console.push({
      type: message.type(),
      text: message.text(),
      location: message.location(),
    });
  });
  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(serializeVisualHarnessError(error));
  });
  page.on('requestfailed', (request) => {
    sourceStartup.fail(request);
    diagnostics.requestFailures.push({
      method: request.method(),
      url: request.url(),
      failure: request.failure(),
    });
  });
}

function assertCleanBrowserDiagnostics(diagnostics, sceneId) {
  const consoleErrors = diagnostics.console.filter((entry) => entry.type === 'error');
  if (
    consoleErrors.length === 0
    && diagnostics.pageErrors.length === 0
    && diagnostics.requestFailures.length === 0
  ) {
    return;
  }

  const error = new Error(`[VisualHarness] scene '${sceneId}' emitted blocking browser diagnostics.`);
  error.code = 'VISUAL_SCENE_BROWSER_DIAGNOSTICS';
  error.details = {
    sceneId,
    consoleErrorCount: consoleErrors.length,
    pageErrorCount: diagnostics.pageErrors.length,
    requestFailureCount: diagnostics.requestFailures.length,
  };
  throw error;
}

function buildCaptureReport({
  browser,
  captureFiles,
  completedAt,
  diagnostics,
  error = null,
  gitState,
  manifest,
  outputDir,
  responseStatus,
  runtimeState,
  startedAt,
  url,
}) {
  return {
    status: error ? 'failed' : 'passed',
    scene: manifest,
    url,
    responseStatus,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    browserVersion: browser.version(),
    browserOwner: readQaPlaywrightBrowserReceipt(browser),
    git: gitState,
    runtime: runtimeState,
    diagnostics,
    captures: captureFiles,
    ...(error ? { error: serializeVisualHarnessError(error) } : {}),
    outputDir,
  };
}

export async function launchVisualHarnessBrowser(headed, {
  executablePath = null,
  audioPolicy = 'muted',
  launchEnvironment = {},
  renderingRequirement = 'headless_ok',
  displayReceipt = null,
  executionPlan = null,
  capacityLease = null,
} = {}) {
  if (!['muted', 'audible'].includes(audioPolicy)) {
    throw new Error(`VISUAL_HARNESS_AUDIO_POLICY_INVALID:${audioPolicy}`);
  }
  try {
    return await launchQaPlaywrightBrowser({
      headless: !headed,
      ...(executablePath ? { executablePath } : {}),
    }, {
      ownerId: `visual-harness:pid=${process.pid}`,
      audioPolicy,
      displayReceipt,
      executionPlan,
      presentation: executionPlan?.presentation || null,
      launchEnvironment,
      renderingRequirement,
      ...(capacityLease ? { capacityLease, capacityMode: 'shared_capture' } : {}),
    });
  } catch (error) {
      const wrapped = new Error(
        '[VisualHarness] The declared Chromium browser could not be started. See the recorded cause.',
        { cause: error },
    );
    wrapped.code = 'VISUAL_HARNESS_BROWSER_UNAVAILABLE';
    wrapped.details = { cause: serializeVisualHarnessError(error) };
    throw wrapped;
  }
}

export async function captureVisualScene({ browser, gitState, manifest, origin, outputRoot, sourceCachePath = null }) {
  if (sourceCachePath !== null && !/^\/\.artifacts\/visual-harness-cache\/[a-f0-9-]{36}\/$/u.test(sourceCachePath)) {
    throw new Error('VISUAL_HARNESS_SOURCE_CACHE_PATH_INVALID');
  }
  const outputDir = resolve(outputRoot, ...manifest.id.split('/'));
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    rm(resolve(outputDir, 'debug.html'), { force: true }),
    rm(resolve(outputDir, 'debug.png'), { force: true }),
  ]);

  const startedAt = new Date();
  const diagnostics = createBrowserDiagnostics();
  const sourceStartup = createSourceStartupDiagnostics(origin, sourceCachePath);
  const context = await browser.newContext({
    viewport: {
      width: manifest.viewport.width,
      height: manifest.viewport.height,
    },
    deviceScaleFactor: manifest.viewport.deviceScaleFactor,
    locale: manifest.locale === 'ko' ? 'ko-KR' : 'en-US',
    timezoneId: 'UTC',
    reducedMotion: manifest.browserPreferences.reducedMotion,
    colorScheme: manifest.browserPreferences.colorScheme,
  });
  try {
    const page = await context.newPage();
    const url = buildVisualHarnessSceneUrl(origin, manifest.id);
    registerBrowserDiagnostics(page, diagnostics, sourceStartup);

    let runtimeState = null;
    let responseStatus = 0;
    let captureFiles = [];

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: manifest.readyTimeoutMs,
      });
      responseStatus = response?.status() || 0;
      if (!response || !response.ok()) {
        const error = new Error(`[VisualHarness] harness navigation failed with HTTP ${responseStatus || 'unknown'}.`);
        error.code = 'VISUAL_HARNESS_NAVIGATION_FAILED';
        error.details = { sceneId: manifest.id, responseStatus, url };
        throw error;
      }

      await page.waitForFunction(
        (globalName) => {
          const state = window[globalName];
          return state?.status === 'ready' || state?.status === 'error';
        },
        VISUAL_HARNESS_GLOBAL,
        { timeout: manifest.readyTimeoutMs },
      );
      runtimeState = await page.evaluate((globalName) => window[globalName], VISUAL_HARNESS_GLOBAL);
      if (runtimeState?.status === 'error') {
        const error = new Error(
          runtimeState.error?.message || `[VisualHarness] scene '${manifest.id}' failed before readiness.`,
        );
        error.code = runtimeState.error?.code || 'VISUAL_SCENE_BOOT_FAILED';
        error.details = runtimeState.error?.details || { sceneId: manifest.id };
        throw error;
      }
      if (runtimeState?.scene?.id !== manifest.id) {
        const error = new Error('[VisualHarness] browser scene manifest does not match the requested scene.');
        error.code = 'VISUAL_SCENE_MANIFEST_MISMATCH';
        error.details = {
          requestedSceneId: manifest.id,
          browserSceneId: runtimeState?.scene?.id || '',
        };
        throw error;
      }

      await settleCaptureSurface(page, manifest.readyTimeoutMs);
      captureFiles = await takeDeclaredCaptures(page, manifest, outputDir);
      assertCleanBrowserDiagnostics(diagnostics, manifest.id);
      diagnostics.sourceStartup = sourceStartup.snapshot();

      const report = buildCaptureReport({
        browser,
        captureFiles,
        completedAt: new Date(),
        diagnostics,
        gitState,
        manifest,
        outputDir,
        responseStatus,
        runtimeState,
        startedAt,
        url,
      });
      await writeVisualHarnessJson(resolve(outputDir, 'capture.json'), report);
      return report;
    } catch (caughtError) {
      const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
      diagnostics.sourceStartup = sourceStartup.snapshot();
      try {
        const observation = await page.evaluate((globalName) => ({
          runtime: window[globalName] || null,
          readyState: document.readyState,
        }), VISUAL_HARNESS_GLOBAL);
        runtimeState = runtimeState || observation.runtime;
        diagnostics.sourceStartup.document = {
          readyState: observation.readyState,
          runtimeRead: observation.runtime === null ? 'missing' : 'available',
          readError: null,
        };
      } catch (readError) {
        diagnostics.sourceStartup.document = {
          readyState: null, runtimeRead: 'failed', readError: serializeStartupReadError(readError),
        };
      }
      const debugHtml = await page.content().catch(() => '');
      if (debugHtml) {
        await writeFile(resolve(outputDir, 'debug.html'), debugHtml, 'utf8');
      }
      await page.screenshot({
        path: resolve(outputDir, 'debug.png'),
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      }).catch(() => {});

      const report = buildCaptureReport({
        browser,
        captureFiles,
        completedAt: new Date(),
        diagnostics,
        error,
        gitState,
        manifest,
        outputDir,
        responseStatus,
        runtimeState,
        startedAt,
        url,
      });
      await writeVisualHarnessJson(resolve(outputDir, 'capture.json'), report);
      error.details = {
        ...(error.details && typeof error.details === 'object' ? error.details : {}),
        outputDir,
      };
      throw error;
    }
  } finally {
    await context.close();
  }
}
