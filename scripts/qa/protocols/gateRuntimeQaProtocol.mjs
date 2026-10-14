import { requireShishiConsumptionLevel, SHISHI_CONSUMPTION_PROFILE } from '../../../src/domains/protection/domain/shishiConsumptionLevel.js';
import { requireGateRecentConsumption } from '../../../src/domains/protection/domain/gateRecentConsumption.js';
import { ZEN_SHISHI_WATER_MATERIAL } from '../../../src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiWaterMaterial.js';
import { SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X, SHISHI_ODOSHI_GROUND_SPLASH_WORLD_Y,
  SHISHI_ODOSHI_LIP_SPLASH_LEFT, SHISHI_ODOSHI_STREAM_SOURCE_Y } from '../../../src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiGeometry.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { allowsQaOwnedInitialWindowPresentation } from '../contracts/qaInitialWindowFocusPolicy.mjs';
import { ensureQaSecurityVaultReady } from './securityVaultQaFixture.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  GATE_QA_AUTOMATION_ACTIONS,
  GATE_QA_AUTOMATION_CHANNEL,
} from '../../../src/domains/protection/background/automation/gateQaAutomationContract.dev.js';
import {
  MESSAGE_ACTIONS,
} from '../../../src/platform/messaging/messageTypes.js';
import { requireInterventionExposureSnapshot } from '../../../src/domains/protection/background/runtime/interventionExposureWindow.js';
import {
  ExtensionChromiumHarness,
  evaluate,
  getTargetInfos,
  sleep,
  waitForPageReady,
} from '../../e2e/extensionChromiumHarness.mjs';
import {
  ENTROPY_QA_TRUSTED_PAGE_PATH,
} from '../../e2e/qaProfileArtifactSlot.mjs';
import { createExtensionRuntimeCollector } from '../../e2e/sites/siteRuntimeBrowser.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';

const TARGET_URL = 'https://example.com/';
const GATE_READY_TIMEOUT_MS = 20_000;
const CONTINUE_OUTCOME_TIMEOUT_MS = 25_000;
const GATE_VIEWPORTS = Object.freeze({
  landscape: Object.freeze({ width: 1440, height: 900 }),
  portrait: Object.freeze({ width: 390, height: 844 }),
  'wide-short': Object.freeze({ width: 844, height: 390 }),
  'compact-portrait': Object.freeze({ width: 320, height: 568 }),
});

function shishiGeometryExpression() {
  return `(() => {
    const scene = document.querySelector('[data-zen-shishi-scene="actual"]');
    if (!scene) throw new Error('QA_GATE_GEOMETRY_SCENE_MISSING');
    const rings = [...scene.querySelectorAll('g[data-zen-shishi-part="ground-ripple"]')];
    if (rings.length !== 3 || rings.map(ring => ring.dataset.ringIndex).sort().join(',') !== '0,1,2') {
      throw new Error('QA_GATE_GEOMETRY_RINGS_MISSING');
    }
    const point = (x, y, matrix) => {
      if (!matrix) throw new Error('QA_GATE_GEOMETRY_MATRIX_MISSING');
      const p = new DOMPoint(x, y).matrixTransform(matrix);
      return { x: p.x, y: p.y };
    };
    const bounds = scene.getBoundingClientRect();
    const lips = [...scene.querySelectorAll('g[data-zen-shishi-part="lip-splash"]')];
    if (lips.length !== 1) throw new Error('QA_GATE_GEOMETRY_LIP_CARDINALITY:' + lips.length);
    const lip = lips[0];
    const motion = new DOMMatrix(getComputedStyle(lip).transform);
    const lipActual = point(0, 0, lip.getScreenCTM());
    const lipExpected = point(${SHISHI_ODOSHI_LIP_SPLASH_LEFT} + motion.e,
      ${SHISHI_ODOSHI_STREAM_SOURCE_Y} + motion.f, lip.ownerSVGElement.getScreenCTM());
    const tube = [...scene.querySelectorAll('div')].find((node) => node.style.zIndex === '15');
    if (!tube) throw new Error('QA_GATE_GEOMETRY_TUBE_MISSING');
    const tubeMatrix = new DOMMatrix(getComputedStyle(tube).transform);
    const capturedStream = scene.querySelector('g[clip-path*="captured-stream-clip"]');
    const freeFallStream = scene.querySelector('g[clip-path*="free-fall-stream-clip"]');
    if (!capturedStream || !freeFallStream) throw new Error('QA_GATE_GEOMETRY_STREAM_MISSING');
    const paintedBounds = ['bamboo-grad', 'rock-grad'].map((material) => {
      const node = scene.querySelector('path[fill*="' + material + '"]');
      if (!node) throw new Error('QA_GATE_GEOMETRY_BODY_MISSING:' + material);
      const { x, y, width, height } = node.getBoundingClientRect();
      return { material, x, y, width, height };
    });
    return { viewport: { width: innerWidth, height: innerHeight },
      paintedBounds,
      tubeAngleDeg: Math.atan2(tubeMatrix.b, tubeMatrix.a) * 180 / Math.PI,
      capturedStreamOpacity: Number(getComputedStyle(capturedStream).opacity),
      freeFallStreamOpacity: Number(getComputedStyle(freeFallStream).opacity),
      lip: { actual: lipActual, expected: lipExpected, opacity: Number(getComputedStyle(lip).opacity), errorPx: Math.hypot(lipActual.x - lipExpected.x, lipActual.y - lipExpected.y) },
      stage: document.querySelector('.gate-zen')?.dataset.stage,
      scene: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      rings: rings.map((ring) => {
        const expected = point(${SHISHI_ODOSHI_STREAM_CAPTURE_CENTER_X}, ${SHISHI_ODOSHI_GROUND_SPLASH_WORLD_Y}, ring.ownerSVGElement.getScreenCTM());
        const actual = point(0, 0, ring.getScreenCTM());
        const style = getComputedStyle(ring);
        return { expected, actual, errorPx: Math.hypot(actual.x - expected.x, actual.y - expected.y),
          opacity: Number(style.opacity), transform: style.transform, origin: style.transformOrigin };
      }) };
  })()`;
}

async function inspectShishiGeometry(harness, page) {
  return evaluate(harness.cdp, page.sessionId, shishiGeometryExpression());
}

function normalizeRuntimeException(event) {
  const details = event?.params?.exceptionDetails || event?.exceptionDetails || {};
  return Object.freeze({
    text: typeof details.text === 'string' ? details.text : '',
    lineNumber: Number.isInteger(details.lineNumber) ? details.lineNumber : null,
    columnNumber: Number.isInteger(details.columnNumber) ? details.columnNumber : null,
    url: typeof details.url === 'string' ? details.url : '',
    exception: typeof details.exception?.description === 'string'
      ? details.exception.description.slice(0, 2_000)
      : '',
  });
}

function normalizeConsoleEntry(event) {
  const params = event?.params || event || {};
  return Object.freeze({
    type: typeof params.type === 'string' ? params.type : '',
    args: Array.isArray(params.args)
      ? params.args.slice(0, 8).map((entry) => (
        typeof entry?.value === 'string'
          ? entry.value.slice(0, 500)
          : typeof entry?.description === 'string'
            ? entry.description.slice(0, 500)
            : entry?.type || 'unknown'
      ))
      : [],
  });
}

export async function inspectGatePage(harness, page) {
  const [documentSnapshot, tab, targetInfo] = await Promise.all([
    evaluate(
      harness.cdp,
      page.sessionId,
      `(() => {
        const gate = document.querySelector('.gate-page[data-gate-kind]');
        const pageRoot = document.querySelector('.gate-page');
        const status = document.querySelector('.gate-status-card');
        return {
          href: location.href,
          readyState: document.readyState,
          title: document.title,
          gateKind: gate?.getAttribute('data-gate-kind') || null,
          themeId: gate?.getAttribute('data-theme-id') || null,
          ready: gate?.getAttribute('data-ready') || null,
          stage: gate?.getAttribute('data-stage') || null,
          enterReady: gate?.getAttribute('data-enter-ready') || null,
          sceneReady: !!document.querySelector('[data-zen-shishi-scene="actual"]'),
          pourDisabled: document.querySelector('.gate-zen__pour')?.disabled ?? null,
          pending: gate?.getAttribute('data-pending') || null,
          visibilityState: document.visibilityState,
          documentHasFocus: document.hasFocus(),
          primaryDisabled: document.querySelector('.gate-button--primary')?.disabled ?? null,
          pageClass: pageRoot?.className || null,
          statusTitle: status?.querySelector('.gate-status-card__title')?.textContent || null,
          statusBody: status?.querySelector('.gate-status-card__body')?.textContent || null,
          rootChildCount: document.querySelector('#root')?.childElementCount ?? null,
          scriptCount: document.scripts.length,
          bodyTextLength: document.body?.innerText?.length ?? 0,
        };
      })()`,
      { timeoutMs: 1_000 },
    ).catch((error) => ({
      evaluationError: error?.message || String(error),
    })),
    harness.resolveTabForPage(page).catch((error) => ({
      resolutionError: error?.message || String(error),
    })),
    getTargetInfos(harness.cdp).then(
      (targets) => targets.find((target) => target?.targetId === page.targetId) || null,
      (error) => ({ resolutionError: error?.message || String(error) }),
    ),
  ]);
  return Object.freeze({
    document: documentSnapshot,
    tab: tab
      ? {
        id: Number.isInteger(tab.id) ? tab.id : null,
        url: typeof tab.url === 'string' ? tab.url : '',
        status: typeof tab.status === 'string' ? tab.status : '',
        active: tab.active === true,
        resolutionError: tab.resolutionError || null,
      }
      : null,
    target: targetInfo
      ? {
        targetId: targetInfo.targetId || null,
        type: targetInfo.type || null,
        url: targetInfo.url || '',
        title: targetInfo.title || '',
        resolutionError: targetInfo.resolutionError || null,
      }
      : null,
  });
}

export async function sendTrustedRuntimeMessage(harness, message) {
  const delivery = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
    chrome.runtime.sendMessage(${JSON.stringify(message)}, (response) => {
      resolve({
        error: chrome.runtime.lastError?.message || null,
        response: response || null,
      });
    });
  })`);
  if (delivery?.error) {
    throw new Error(`QA_GATE_RUNTIME_MESSAGE_FAILED:${delivery.error}`);
  }
  return delivery?.response;
}

export async function sendGateAutomation(harness, {
  action,
  targetTabId,
  payload = {},
}) {
  const request = {
    channel: GATE_QA_AUTOMATION_CHANNEL,
    action,
    requestId: `gate:${randomUUID()}`,
    targetTabId,
    payload,
  };
  const response = await sendTrustedRuntimeMessage(harness, request);
  if (
    response?.success !== true
    || response.channel !== request.channel
    || response.action !== request.action
    || response.requestId !== request.requestId
    || response.targetTabId !== request.targetTabId
  ) {
    throw new Error(
      `QA_GATE_RUNTIME_AUTOMATION_FAILED:${response?.error || 'response_invalid'}`,
    );
  }
  return response.result;
}

async function collectGateLifecycleDiagnostics(harness, targetTabId) {
  const response = await sendTrustedRuntimeMessage(harness, {
    action: MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS,
    targetTabId,
    limit: 120,
  });
  if (response?.success !== true) {
    return Object.freeze({
      available: false,
      error: response?.error || 'diagnostics_unavailable',
      events: Object.freeze([]),
    });
  }
  const events = Array.isArray(response?.snapshot?.events)
    ? response.snapshot.events.filter((entry) => (
      typeof entry?.event === 'string'
      && entry.event.startsWith('gate_interstitial_')
    ))
    : [];
  return Object.freeze({
    available: true,
    error: null,
    events: Object.freeze(events),
  });
}

export async function waitForGateSurface(harness, page) {
  const deadline = Date.now() + GATE_READY_TIMEOUT_MS;
  let lastDiagnostic = null;
  while (Date.now() < deadline) {
    lastDiagnostic = await inspectGatePage(harness, page);
    const snapshot = lastDiagnostic.document;
    if (
      snapshot?.href?.startsWith('chrome-extension://')
      && snapshot?.gateKind === 'entryCheckpoint'
      && snapshot?.themeId === 'zen'
      && snapshot?.sceneReady === true
      && snapshot.pourDisabled === false
    ) {
      return Object.freeze(snapshot);
    }
    await sleep(100);
  }
  const error = new Error('QA_GATE_RUNTIME_SURFACE_TIMEOUT');
  error.code = 'QA_GATE_RUNTIME_SURFACE_TIMEOUT';
  error.diagnostic = lastDiagnostic;
  throw error;
}

async function captureGateScreenshot(harness, page, outputPath) {
  const screenshot = await harness.cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  }, page.sessionId);
  if (typeof screenshot?.data !== 'string' || !screenshot.data) {
    throw new Error('QA_GATE_RUNTIME_SCREENSHOT_REQUIRED');
  }
  await fs.writeFile(outputPath, Buffer.from(screenshot.data, 'base64'));
  return outputPath;
}

export async function readAuthorizedGateSession(harness, page, sessionId) {
  return evaluate(
    harness.cdp,
    page.sessionId,
    `new Promise((resolve) => {
      chrome.runtime.sendMessage(${JSON.stringify({
        action: MESSAGE_ACTIONS.GET_GATE_INTERSTITIAL_SESSION,
        sessionId,
      })}, (response) => {
        resolve({
          error: chrome.runtime.lastError?.message || null,
          response: response || null,
        });
      });
    })`,
  );
}

function actionLayoutExpression(actionName) {
  if (actionName !== 'pour') throw new Error('QA_GATE_ACTION_INVALID');
  return `(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error('QA_GATE_LAYOUT_NODE_MISSING:' + selector);
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    };
    const selector = ${JSON.stringify('.gate-zen__' + actionName)};
    const action = rect(selector);
    const textStyle = (selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return { fontSize: style.fontSize, lineHeight: style.lineHeight, fontFamily: style.fontFamily,
        color: style.color, opacity: style.opacity, letterSpacing: style.letterSpacing };
    };
    const bamboo = document.querySelector('[data-zen-shishi-scene] path[fill*="bamboo-grad"]');
    if (!bamboo) throw new Error('QA_GATE_INTERACTIVE_BAMBOO_MISSING');
    const bambooBounds = bamboo.getBoundingClientRect();
    const pointer = { x: bambooBounds.x + bambooBounds.width / 2,
      y: bambooBounds.y + bambooBounds.height / 2 };
    return {
      action, pointer, hit: Boolean(document.elementFromPoint(pointer.x, pointer.y)?.closest(selector)),
      actionEnabled: !document.querySelector(selector).disabled,
      enterReady: document.querySelector('.gate-zen').dataset.enterReady === '1',
      stage: document.querySelector('.gate-zen').dataset.stage,
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      host: { ...rect('.gate-zen__host'), ...textStyle('.gate-zen__host') },
      separateControls: document.querySelector('.gate-zen__inscription').querySelectorAll('button, [role="button"]').length,
      recentUsePresent: Boolean(document.querySelector('.gate-zen__recent')),
      waterFilters: document.querySelectorAll('[data-zen-shishi-scene] feTurbulence, [data-zen-shishi-scene] feDisplacementMap').length,
      waterColors: [...document.querySelectorAll('[id*="liquid-stream-base-grad"] stop')].map((node) => node.getAttribute('stop-color')),
      boxes: ['stage', 'inscription'].map((name) => ({
        name, ...rect('.gate-zen__' + name),
      })),
    };
  })()`;
}

async function inspectActionLayout(harness, page, actionName = 'pour') {
  return evaluate(harness.cdp, page.sessionId, actionLayoutExpression(actionName));
}

async function inspectMotionFrame(harness, page, actionName) {
  return evaluate(harness.cdp, page.sessionId,
    `({ layout: ${actionLayoutExpression(actionName)}, geometry: ${shishiGeometryExpression()} })`);
}

function isActionLayoutClipped(sample) {
  return sample.scrollWidth > sample.viewport.width
    || sample.action.width < 44 || sample.action.height < 44
    || sample.action.x < 0 || sample.action.y < 0
    || sample.action.x + sample.action.width > sample.viewport.width
    || sample.action.y + sample.action.height > sample.viewport.height;
}

function isShishiBodyClipped(geometry) {
  return geometry.paintedBounds.some(({ x, y, width, height }) =>
    width <= 0 || height <= 0 || x < -1 || y < -1
    || x + width > geometry.viewport.width + 1
    || y + height > geometry.viewport.height + 1);
}

async function activateNativeGateAction(harness, page, readyLayout, input, actionName) {
  if (!['keyboard', 'pointer'].includes(input) || actionName !== 'pour') throw new Error('QA_GATE_NATIVE_ACTION_INVALID');
  const focusedExpression = `document.activeElement?.matches(${JSON.stringify('.gate-zen__' + actionName)})`;
  if (input === 'pointer') {
    const pointer = readyLayout.pointer;
    await harness.cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', ...pointer, button: 'left', buttons: 1, clickCount: 1,
    }, page.sessionId);
    await harness.cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', ...pointer, button: 'left', buttons: 0, clickCount: 1,
    }, page.sessionId);
  } else {
    // Native Tab navigation selects the requested action. No focus/visibility injection.
    for (let step = 0; step < 3; step++) {
      if (await evaluate(harness.cdp, page.sessionId, focusedExpression)) break;
      for (const type of ['keyDown', 'keyUp']) await harness.cdp.send('Input.dispatchKeyEvent', {
        type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
      }, page.sessionId);
    }
    if (!await evaluate(harness.cdp, page.sessionId, focusedExpression)) {
      throw new Error('QA_GATE_ENTRY_KEYBOARD_TARGET_MISSING');
    }
    for (const type of ['keyDown', 'keyUp']) await harness.cdp.send('Input.dispatchKeyEvent', {
      type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
      ...(type === 'keyDown' ? { text: '\r', unmodifiedText: '\r' } : {}),
    }, page.sessionId);
  }
}

export async function driveContinueOutcome(harness, page, targetUrl = TARGET_URL, { onGateFrame } = {}) {
  const deadline = Date.now() + CONTINUE_OUTCOME_TIMEOUT_MS;
  if (onGateFrame) await onGateFrame();
  while (Date.now() < deadline) {
    const target = (await getTargetInfos(harness.cdp)).find((entry) => entry.targetId === page.targetId);
    if (!target) throw new Error('QA_GATE_WAIT_TARGET_CLOSED');
    if (target.url === targetUrl) return target.url;
    await sleep(100);
  }
  throw new Error('QA_GATE_RUNTIME_CONTINUE_OUTCOME_TIMEOUT');
}

async function driveLeaveOutcome(harness, page, { input, onGateFrame }) {
  const layout = await inspectActionLayout(harness, page, 'pour');
  if (!layout.actionEnabled || !layout.hit || layout.enterReady) throw new Error('QA_GATE_IMMEDIATE_LEAVE_NOT_READY');
  const startedAt = Date.now();
  await activateNativeGateAction(harness, page, layout, input, 'pour');
  await sleep(180);
  // Stay on the live document during its one-second gesture. Tab/session
  // diagnostics can outlast the scene and belong after the motion capture.
  const pouring = await onGateFrame({ phase: 'pour', elapsedMs: Date.now() - startedAt });
  if (pouring.stage !== 'pouring' || pouring.actionEnabled || pouring.enterReady) {
    throw new Error(`QA_GATE_LEAVE_CHOICE_NOT_LATCHED:${Date.now() - startedAt}`);
  }
  for (const [phase, desiredElapsedMs] of [['dump', 450], ['return', 800]]) {
    const remainingMs = desiredElapsedMs - (Date.now() - startedAt);
    if (remainingMs > 0) await sleep(remainingMs);
    await onGateFrame({ phase, elapsedMs: Date.now() - startedAt });
  }
  while (Date.now() - startedAt < 5000) {
    if (!(await getTargetInfos(harness.cdp)).some((target) => target.targetId === page.targetId)) {
      const elapsedMs = Date.now() - startedAt;
      // The product closed this exact tab. Release its lease while the trusted page is still live.
      await harness.releasePageTarget(page);
      return { closed: true, elapsedMs };
    }
    await sleep(100);
  }
  throw new Error('QA_GATE_LEAVE_TARGET_NOT_CLOSED');
}

export async function executeQaProtocol({
  plan,
  artifact,
  browser,
  evidence,
  attachmentsDir,
  registerCleanup,
  reportBrowserGpuCapability,
  signal,
  recoveryJournal,
  requestInitialOwnedWindowPresentation,
}) {
  signal?.throwIfAborted();
  if (artifact?.id !== 'dev_extension' || artifact?.releaseProfile !== 'dev') {
    throw new Error('QA_GATE_RUNTIME_DEV_ARTIFACT_REQUIRED');
  }
  if (browser?.processOwnership !== 'owned' || !browser.chrome) {
    throw new Error('QA_GATE_RUNTIME_OWNED_BROWSER_REQUIRED');
  }
  const harness = new ExtensionChromiumHarness({
    chromePath: browser.chrome,
    distDir: artifact.path,
    rootDir: plan.rootDir,
    headless: plan.browserExecution.headless,
    browserExecution: plan.browserExecution,
    capacityReservationMode: plan.browserCapacityMode,
    audioPolicy: plan.browserExecution.audioPolicy,
    launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement,
    keepTemp: false,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    tempPrefix: 'entropy-gate-runtime-qa-',
    recoveryJournal,
  });
  registerCleanup('gate_runtime_browser', () => harness.close());
  await harness.start();
  await reportBrowserGpuCapability(harness.gpuCapability);
  const extensionRuntimeCollector = await createExtensionRuntimeCollector(harness);
  registerCleanup('gate_runtime_worker_diagnostics', () => extensionRuntimeCollector.dispose());
  signal?.throwIfAborted();
  const runtimeExceptions = [];
  const consoleEntries = [];
  const navigationTimeline = [];
  let page = null;
  const unsubscribeRuntimeExceptions = harness.cdp.subscribe(
    'Runtime.exceptionThrown',
    (event) => {
      if (event.sessionId === page?.sessionId && runtimeExceptions.length < 20) {
        runtimeExceptions.push(normalizeRuntimeException(event));
      }
    },
  );
  const unsubscribeConsole = harness.cdp.subscribe(
    'Runtime.consoleAPICalled',
    (event) => {
      const type = event?.params?.type || event?.type;
      if (
        event.sessionId === page?.sessionId
        && (type === 'error' || type === 'warning')
        && consoleEntries.length < 20
      ) {
        consoleEntries.push(normalizeConsoleEntry(event));
      }
    },
  );
  const recordNavigationEvent = (kind, payload) => {
    if (navigationTimeline.length >= 40) return;
    navigationTimeline.push(Object.freeze({
      at: new Date().toISOString(),
      kind,
      ...payload,
    }));
  };
  const unsubscribeFrameNavigation = harness.cdp.subscribe(
    'Page.frameNavigated',
    (event) => {
      if (
        event.sessionId === page?.sessionId
        && event.params?.frame?.parentId === undefined
      ) {
        recordNavigationEvent('frame', {
          url: event.params.frame.url || '',
          loaderId: event.params.frame.loaderId || '',
        });
      }
    },
  );
  const unsubscribeTargetChanges = harness.cdp.subscribe(
    'Target.targetInfoChanged',
    (event) => {
      if (event.params?.targetInfo?.targetId === page?.targetId) {
        recordNavigationEvent('target', {
          url: event.params.targetInfo.url || '',
          title: event.params.targetInfo.title || '',
        });
      }
    },
  );
  registerCleanup('gate_runtime_diagnostics', () => {
    unsubscribeRuntimeExceptions?.();
    unsubscribeConsole?.();
    unsubscribeFrameNavigation?.();
    unsubscribeTargetChanges?.();
    return { action: 'subscriptions_released' };
  });
  page = await harness.openPage(TARGET_URL, {
    active: plan.browserExecution.targetActivation === 'active',
    timeoutMs: 30_000,
  });
  if (allowsQaOwnedInitialWindowPresentation(plan)) {
    if (typeof requestInitialOwnedWindowPresentation !== 'function') throw new Error('QA_GATE_INITIAL_WINDOW_OWNER_REQUIRED');
    await evidence.event('QA_GATE_INITIAL_WINDOW_PRESENTED', await requestInitialOwnedWindowPresentation({
      child: harness.chrome, cdp: harness.cdp, targetId: page.targetId, tabId: page.tabId,
    }));
  }
  // Keep the real scenario tab first for initial presentation ownership. The
  // disposable profile must then unlock through the canonical Dashboard route
  // before any key-dependent Gate runtime message is admitted.
  const securityVault = await ensureQaSecurityVaultReady(harness, {
    passphrase: randomBytes(32).toString('base64url'),
  });
  await evidence.event('QA_GATE_SECURITY_VAULT_READY', securityVault);
  let viewport = GATE_VIEWPORTS[plan.parameters.viewport];
  if (!viewport) throw new Error('QA_GATE_VIEWPORT_INVALID');
  await harness.cdp.send('Emulation.setDeviceMetricsOverride', {
    ...viewport, deviceScaleFactor: 1, mobile: false,
  }, page.sessionId);
  signal?.throwIfAborted();
  let gateSessionActive = false;
  registerCleanup('gate_runtime_session', async () => {
    if (!gateSessionActive) return { action: 'already_resolved' };
    await sendGateAutomation(harness, {
      action: GATE_QA_AUTOMATION_ACTIONS.DISMISS,
      targetTabId: page.tabId,
    });
    gateSessionActive = false;
    return { action: 'dismissed' };
  });

  let presentation;
  try {
    presentation = await sendGateAutomation(harness, {
      action: GATE_QA_AUTOMATION_ACTIONS.PRESENT_ENTRY_CHECKPOINT,
      targetTabId: page.tabId,
      payload: { holdMs: plan.parameters.holdMs, intensity: plan.parameters.intensity, recentUse: plan.parameters.recentUse },
    });
  } catch (error) {
    const lifecycleDiagnostics = await collectGateLifecycleDiagnostics(
      harness,
      page.tabId,
    ).catch((diagnosticError) => ({
      available: false,
      error: diagnosticError?.message || String(diagnosticError),
      events: [],
    }));
    const diagnostic = Object.freeze({
      stage: 'presentation',
      error: error?.message || String(error),
      requestedTabId: page.tabId,
      page: await inspectGatePage(harness, page).catch((inspectionError) => ({
        inspectionError: inspectionError?.message || String(inspectionError),
      })),
      runtimeExceptions: Object.freeze(runtimeExceptions),
      consoleEntries: Object.freeze(consoleEntries),
      navigationTimeline: Object.freeze(navigationTimeline),
      lifecycleDiagnostics,
      extensionRuntime: extensionRuntimeCollector.snapshot(),
      chromeStderr: Object.freeze(harness.chromeStderr.slice(-10)),
    });
    const diagnosticPath = path.join(
      attachmentsDir,
      'gate-runtime-presentation-diagnostic.json',
    );
    await Promise.all([
      fs.writeFile(
        diagnosticPath,
        `${JSON.stringify(diagnostic, null, 2)}\n`,
        'utf8',
      ),
      evidence.event('QA_GATE_RUNTIME_PRESENTATION_DIAGNOSTIC', diagnostic),
    ]);
    throw error;
  }
  gateSessionActive = true;
  signal?.throwIfAborted();
  const lifecycleDiagnosticsAfterPresentation = await collectGateLifecycleDiagnostics(
    harness,
    page.tabId,
  );
  await evidence.event('QA_GATE_RUNTIME_PRESENTATION_COMMITTED', {
    sessionId: presentation.sessionId,
    gateKind: presentation.gateKind,
    gatePageUrl: presentation.gatePageUrl,
    targetTabId: page.tabId,
    sessionCommit: presentation.sessionCommit,
    lifecycleDiagnosticsAfterPresentation,
    navigationTimeline: Object.freeze([...navigationTimeline]),
  });
  let surface;
  try {
    await waitForPageReady(harness.cdp, page.sessionId, GATE_READY_TIMEOUT_MS);
    surface = await waitForGateSurface(harness, page);
  } catch (error) {
    const lifecycleDiagnostics = await collectGateLifecycleDiagnostics(
      harness,
      page.tabId,
    ).catch((diagnosticError) => ({
      available: false,
      error: diagnosticError?.message || String(diagnosticError),
      events: [],
    }));
    const diagnostic = Object.freeze({
      presentation,
      page: error?.diagnostic || await inspectGatePage(harness, page).catch(
        (inspectionError) => ({
          inspectionError: inspectionError?.message || String(inspectionError),
        }),
      ),
      runtimeExceptions: Object.freeze(runtimeExceptions),
      consoleEntries: Object.freeze(consoleEntries),
      navigationTimeline: Object.freeze(navigationTimeline),
      sessionCommit: presentation.sessionCommit,
      lifecycleDiagnosticsAfterPresentation,
      lifecycleDiagnostics,
      chromeStderr: Object.freeze(harness.chromeStderr.slice(-10)),
    });
    const diagnosticPath = path.join(attachmentsDir, 'gate-runtime-diagnostic.json');
    const failureScreenshotPath = path.join(
      attachmentsDir,
      'gate-runtime-failure.png',
    );
    const failureScreenshot = await captureGateScreenshot(
      harness,
      page,
      failureScreenshotPath,
    ).then(
      () => ({ captured: true, path: failureScreenshotPath, error: null }),
      (screenshotError) => ({
        captured: false,
        path: null,
        error: screenshotError?.message || String(screenshotError),
      }),
    );
    await Promise.all([
      fs.writeFile(
        diagnosticPath,
        `${JSON.stringify({ ...diagnostic, failureScreenshot }, null, 2)}\n`,
        'utf8',
      ),
      evidence.event('QA_GATE_RUNTIME_SURFACE_DIAGNOSTIC', {
        ...diagnostic,
        failureScreenshot,
      }),
    ]);
    throw error;
  }
  signal?.throwIfAborted();
  const authorizedSession = await readAuthorizedGateSession(
    harness,
    page,
    presentation.sessionId,
  );
  if (
    authorizedSession?.error
    || authorizedSession?.response?.success !== true
    || authorizedSession?.response?.session?.sessionId !== presentation.sessionId
    || authorizedSession?.response?.session?.gateKind !== 'entryCheckpoint'
    || authorizedSession?.response?.session?.themeId !== 'zen'
  ) {
    throw new Error('QA_GATE_RUNTIME_AUTHORIZED_SESSION_INVALID');
  }

  const screenshotPath = path.join(attachmentsDir, 'gate-runtime.png');
  const intensity = requireShishiConsumptionLevel(authorizedSession.response.session.metrics.shishiIntensity);
  const expectedExtension = plan.parameters.intensity === 'maximum' ? SHISHI_CONSUMPTION_PROFILE.maximumWaitExtensionMs : 0;
  if (intensity.waitExtensionMs !== expectedExtension || intensity.reason !== 'manual_qa_fixture') {
    throw new Error('QA_GATE_RUNTIME_FROZEN_INTENSITY_INVALID');
  }
  await evidence.event('QA_GATE_RUNTIME_INTENSITY_VERIFIED', { fixture: plan.parameters.intensity, intensity });
  await captureGateScreenshot(harness, page, screenshotPath);
  const layoutAudit = [];
  if (plan.parameters.auditLayout) {
    for (const [name, auditViewport] of Object.entries(GATE_VIEWPORTS)) {
      signal?.throwIfAborted();
      await harness.cdp.send('Emulation.setDeviceMetricsOverride', {
        ...auditViewport, deviceScaleFactor: 1, mobile: false,
      }, page.sessionId);
      await sleep(160);
      const layout = await inspectActionLayout(harness, page, 'pour');
      const geometry = await inspectShishiGeometry(harness, page);
      const auditScreenshotPath = path.join(attachmentsDir, `gate-runtime-${name}.png`);
      await captureGateScreenshot(harness, page, auditScreenshotPath);
      layoutAudit.push({ name, layout, geometry, actionClipped: isActionLayoutClipped(layout),
        screenshotPath: auditScreenshotPath });
    }
    await harness.cdp.send('Emulation.setDeviceMetricsOverride', {
      ...viewport, deviceScaleFactor: 1, mobile: false,
    }, page.sessionId);
    await sleep(160);
    const layoutAuditPath = path.join(attachmentsDir, 'gate-runtime-layout-audit.json');
    await fs.writeFile(layoutAuditPath, JSON.stringify(layoutAudit, null, 2));
    await evidence.event('QA_GATE_RUNTIME_LAYOUT_AUDIT', { layoutAuditPath, samples: layoutAudit });
  }
  let resizeEvidence = null;
  if (plan.parameters.resizeTo !== 'none') {
    const before = await inspectShishiGeometry(harness, page);
    const beforeLayout = await inspectActionLayout(harness, page);
    const nextViewport = GATE_VIEWPORTS[plan.parameters.resizeTo];
    if (!nextViewport) throw new Error('QA_GATE_RESIZE_VIEWPORT_INVALID');
    await harness.cdp.send('Emulation.setDeviceMetricsOverride', {
      ...nextViewport, deviceScaleFactor: 1, mobile: false,
    }, page.sessionId);
    await sleep(160);
    const after = await inspectShishiGeometry(harness, page);
    const afterLayout = await inspectActionLayout(harness, page);
    const resizedScreenshotPath = path.join(attachmentsDir, 'gate-runtime-resized.png');
    await captureGateScreenshot(harness, page, resizedScreenshotPath);
    resizeEvidence = { before, after, beforeLayout, afterLayout, resizedScreenshotPath };
    await fs.writeFile(path.join(attachmentsDir, 'gate-runtime-resize.json'), JSON.stringify(resizeEvidence, null, 2));
    await evidence.event('QA_GATE_RUNTIME_RESIZED', resizeEvidence);
    if ([before, after].some((sample) => sample.lip.errorPx > 1.5
      || sample.rings.some((ring) => ring.errorPx > 1.5))) throw new Error('QA_GATE_RESIZE_WATER_DISPLACED');
    viewport = nextViewport;
  }
  const geometry = [];
  for (let sample = 0; sample < 12; sample += 1) {
    signal?.throwIfAborted();
    geometry.push(await inspectShishiGeometry(harness, page));
    await sleep(100);
  }
  const geometryPath = path.join(attachmentsDir, 'gate-runtime-geometry.json');
  await fs.writeFile(geometryPath, JSON.stringify({ viewport: plan.parameters.viewport, samples: geometry }, null, 2));
  const maxCenterErrorPx = Math.max(...geometry.flatMap((sample) => sample.rings.map((ring) => ring.errorPx)));
  await evidence.event('QA_GATE_RUNTIME_GEOMETRY', { viewport, maxCenterErrorPx, geometryPath });
  if (!Number.isFinite(maxCenterErrorPx) || maxCenterErrorPx > 1.5) {
    throw new Error(`QA_GATE_RIPPLE_CENTER_DISPLACED:${maxCenterErrorPx}`);
  }
  await evidence.event('QA_GATE_RUNTIME_PRESENTED', {
    sessionId: presentation.sessionId,
    gateKind: surface.gateKind,
    themeId: surface.themeId,
    gatePageUrl: presentation.gatePageUrl,
  });
  const exposureWhileOpen = requireInterventionExposureSnapshot(await sendGateAutomation(harness, {
    action: GATE_QA_AUTOMATION_ACTIONS.READ_EXPOSURE, targetTabId: page.tabId,
  }));
  if (exposureWhileOpen.status !== 'observed'
    || !exposureWhileOpen.intervals.some((item) => item.kind === 'uncertain')) {
    throw new Error('QA_GATE_RUNTIME_OPEN_EXPOSURE_REQUIRED');
  }

  signal?.throwIfAborted();
  const decision = plan.parameters.decision;
  const actionName = 'pour';
  let leaveOutcome;
  let outcomeUrl;
  let readyGeometry = null;
  const motionSamples = [];
  const layoutSamples = [await inspectActionLayout(harness, page, actionName)];
  const recentConsumption = requireGateRecentConsumption(authorizedSession.response.session.metrics.recentConsumption);
  const recordedUse = plan.parameters.recentUse === 'recorded';
  if (layoutSamples[0].recentUsePresent !== false
    || (recordedUse && (recentConsumption.status !== 'observed' || recentConsumption.foregroundMs !== 32 * 60_000
      || recentConsumption.evaluatedAt - recentConsumption.lastObservedAt !== 18 * 60_000))
    || (!recordedUse && recentConsumption.status !== 'unavailable')) throw new Error('QA_GATE_RECENT_USE_INVALID');
  if (layoutSamples[0].waterFilters !== 0 || !layoutSamples[0].waterColors.includes(ZEN_SHISHI_WATER_MATERIAL.body)) {
    throw new Error('QA_GATE_WATER_MATERIAL_INVALID');
  }
  await evidence.event('QA_GATE_RECENT_USE_AND_WATER_VERIFIED', {
    recentConsumption, waterFilters: layoutSamples[0].waterFilters, waterColors: layoutSamples[0].waterColors,
  });
  const readyScreenshotPath = path.join(attachmentsDir, decision === 'leave' ? 'gate-runtime-pour.png' : 'gate-runtime-waiting.png');
  try {
    const onGateFrame = async (frame) => {
      const { layout, geometry } = await inspectMotionFrame(harness, page, actionName);
      layoutSamples.push(layout);
      readyGeometry = geometry;
      // One early image fits the real one-second close. Later slots retain
      // geometry without blocking on another screenshot's compositor/PNG work.
      const frameScreenshotPath = frame?.phase === 'return' || frame?.phase === 'dump' ? null : readyScreenshotPath;
      if (frameScreenshotPath) await captureGateScreenshot(harness, page, frameScreenshotPath);
      motionSamples.push({ ...frame, geometry, screenshotPath: frameScreenshotPath });
      await fs.writeFile(path.join(attachmentsDir, 'gate-runtime-motion.json'), JSON.stringify(motionSamples, null, 2));
      return layout;
    };
    if (decision === 'leave') {
      leaveOutcome = await driveLeaveOutcome(harness, page, { input: plan.parameters.input, onGateFrame });
    } else {
      outcomeUrl = await driveContinueOutcome(harness, page, TARGET_URL, { onGateFrame });
    }
  } catch (error) {
    if (decision === 'leave'
      && !(await getTargetInfos(harness.cdp)).some((target) => target.targetId === page.targetId)) {
      await harness.releasePageTarget(page);
      gateSessionActive = false;
    }
    const diagnostic = {
      stage: decision, error: error.message, exposureWhileOpen, layoutSamples, motionSamples,
      page: await inspectGatePage(harness, page),
      runtimeExceptions, consoleEntries, navigationTimeline,
      lifecycleDiagnostics: await collectGateLifecycleDiagnostics(harness, page.tabId),
    };
    await fs.writeFile(path.join(attachmentsDir, 'gate-runtime-outcome-diagnostic.json'), `${JSON.stringify(diagnostic, null, 2)}\n`);
    await evidence.event('QA_GATE_RUNTIME_OUTCOME_DIAGNOSTIC', diagnostic);
    throw error;
  }
  if (decision === 'continue') await sendGateAutomation(harness, {
    action: GATE_QA_AUTOMATION_ACTIONS.DISMISS,
    targetTabId: page.tabId,
  });
  gateSessionActive = false;
  const exposureAfterEnd = requireInterventionExposureSnapshot(await sendGateAutomation(harness, {
    action: GATE_QA_AUTOMATION_ACTIONS.READ_EXPOSURE, targetTabId: page.tabId,
  }));
  const presentedIntervals = exposureAfterEnd.intervals.filter((item) => item.kind === 'presented');
  if (exposureAfterEnd.status !== 'observed' || presentedIntervals.length !== 1) {
    throw new Error('QA_GATE_RUNTIME_ENDED_EXPOSURE_REQUIRED');
  }
  const exposureEvidence = { whileOpen: exposureWhileOpen, afterEnd: exposureAfterEnd };
  await fs.writeFile(path.join(attachmentsDir, 'gate-runtime-exposure.json'), `${JSON.stringify(exposureEvidence, null, 2)}\n`);
  await evidence.event('QA_GATE_RUNTIME_EXPOSURE_VERIFIED', exposureEvidence);
  signal?.throwIfAborted();
  await evidence.event('QA_GATE_RUNTIME_OUTCOME', {
    decision,
    outcomeUrl,
    leaveOutcome,
  });
  if (!readyGeometry) throw new Error('QA_GATE_READY_GEOMETRY_NOT_OBSERVED');
  const layoutPath = path.join(attachmentsDir, 'gate-runtime-interaction.json');
  const baselineLayout = layoutSamples[0];
  const maxLayoutShiftPx = Math.max(...layoutSamples.flatMap((sample) => sample.boxes.flatMap((box, index) =>
    ['x', 'y', 'width', 'height'].map((key) => Math.abs(box[key] - baselineLayout.boxes[index][key])))));
  const layoutEvidence = { input: plan.parameters.input, maxLayoutShiftPx, samples: layoutSamples };
  await fs.writeFile(layoutPath, JSON.stringify(layoutEvidence, null, 2));
  if (!Number.isFinite(maxLayoutShiftPx) || maxLayoutShiftPx > 1) throw new Error(`QA_GATE_LAYOUT_SHIFT:${maxLayoutShiftPx}`);
  if (layoutSamples.some(isActionLayoutClipped)) {
    throw new Error('QA_GATE_ACTION_LAYOUT_CLIPPED');
  }
  if ([...layoutSamples, ...layoutAudit.map((sample) => sample.layout)].some((sample) => sample.separateControls !== 0)) {
    throw new Error('QA_GATE_SEPARATE_CONTROLS_PRESENT');
  }
  await evidence.event('QA_GATE_RUNTIME_INTERACTION_VERIFIED', { input: plan.parameters.input, maxLayoutShiftPx, layoutPath });
  const lipCenterErrorPx = Math.max(...motionSamples.map((sample) => sample.geometry.lip.errorPx));
  if (!Number.isFinite(lipCenterErrorPx) || lipCenterErrorPx > 1.5) throw new Error('QA_GATE_LIP_DISPLACED');
  const motionRippleCenterErrorPx = Math.max(...motionSamples.flatMap((sample) => sample.geometry.rings.map((ring) => ring.errorPx)));
  if (!Number.isFinite(motionRippleCenterErrorPx) || motionRippleCenterErrorPx > 1.5) throw new Error('QA_GATE_MOTION_RIPPLE_DISPLACED');
  if (layoutAudit.some((sample) => sample.geometry.lip.errorPx > 1.5
    || sample.geometry.rings.some((ring) => ring.errorPx > 1.5))) throw new Error('QA_GATE_AUDIT_WATER_DISPLACED');
  if (layoutAudit.some((sample) => sample.actionClipped)) {
    throw new Error(`QA_GATE_AUDIT_ACTION_LAYOUT_CLIPPED:${layoutAudit.filter((sample) => sample.actionClipped).map((sample) => sample.name).join(',')}`);
  }
  if (layoutAudit.some((sample) => isShishiBodyClipped(sample.geometry))
    || motionSamples.some((sample) => isShishiBodyClipped(sample.geometry))) {
    throw new Error('QA_GATE_SHISHI_BODY_CLIPPED');
  }
  return Object.freeze({
    status: QA_RUN_STATUSES.PASS,
    protocol: 'gate_runtime',
    gateKind: 'entryCheckpoint',
    themeId: 'zen',
    sessionId: presentation.sessionId,
    surface,
    outcome: Object.freeze({
      decision,
      url: outcomeUrl,
      ...leaveOutcome,
    }),
    screenshotPath,
    exposureEvidence,
    intensity,
    interaction: { input: plan.parameters.input, maxLayoutShiftPx, layoutPath, layoutAudit },
    geometry: { viewport, maxCenterErrorPx, motionRippleCenterErrorPx, lipCenterErrorPx, geometryPath, readyScreenshotPath, motionSamples, resizeEvidence },
  });
}
