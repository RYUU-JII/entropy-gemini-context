import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import {
  GATE_QA_AUTOMATION_ACTIONS,
  GATE_QA_AUTOMATION_CHANNEL,
} from '../../../src/domains/protection/background/automation/gateQaAutomationContract.dev.js';
import {
  RUNTIME_DEBUGGER_AUTOMATION_ACTIONS,
  RUNTIME_DEBUGGER_AUTOMATION_CHANNEL,
} from '../../../src/domains/nudge/runtime-debugger/automation/runtimeDebuggerAutomationContract.dev.js';
import {
  SENTINEL_PROTOCOL_QA_ACTIONS,
  SENTINEL_PROTOCOL_QA_CHANNEL,
} from '../../../src/domains/nudge/runtime/automation/sentinelProtocolQaAutomationContract.dev.js';
import {
  ExtensionChromiumHarness,
  evaluate,
  sleep,
} from '../../e2e/extensionChromiumHarness.mjs';
import {
  defineEntropyQaAttachedArtifactStage,
  ENTROPY_QA_TRUSTED_PAGE_PATH,
} from '../../e2e/qaProfileArtifactSlot.mjs';
import {
  resolveQaHumanSetupFeature,
  resolveQaHumanSetupUrl,
} from '../catalog/qaHumanSetupCatalog.mjs';
import {
  openEntropyAttachOnlyActivePage,
  proveEntropyAttachedArtifactRuntimeReadiness,
  readEntropyPostRefreshTrackingRuntimeReadiness,
} from './attachOnlyActivePageAdapter.mjs';
import {
  inspectHumanSentinelSurface,
  isHumanSentinelReady,
} from './humanSentinelReadiness.mjs';

const HUMAN_SETUP_READY_TIMEOUT_MS = 20_000;
const HUMAN_SETUP_POLL_MS = 100;

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function requireHumanSetupContext(context) {
  const { plan, artifact, browser, requestOperatorHandoff, signal } = context;
  if (plan?.mode !== 'human') fail('QA_HUMAN_SETUP_HUMAN_MODE_REQUIRED');
  if (
    plan?.operatorHandoffPolicy?.focus !== 'operator_request_once'
    || plan.operatorHandoffPolicy.lifetime !== 'until_explicit_cancel'
    || plan.operatorHandoffPolicy.cleanup !== 'exact_owned_targets'
  ) {
    fail('QA_HUMAN_SETUP_OPERATOR_POLICY_REQUIRED');
  }
  if (typeof requestOperatorHandoff !== 'function') {
    fail('QA_HUMAN_SETUP_OPERATOR_HANDOFF_REQUIRED');
  }
  if (!signal || typeof signal.addEventListener !== 'function') {
    fail('QA_HUMAN_SETUP_ABORT_SIGNAL_REQUIRED');
  }
  if (artifact?.id !== 'dev_extension' || artifact?.releaseProfile !== 'dev') {
    fail('QA_HUMAN_SETUP_DEV_ARTIFACT_REQUIRED');
  }
  if (
    browser?.processOwnership !== 'attach_only'
    || browser?.lifecyclePolicy !== 'managed'
    || browser?.focusPolicy !== 'never'
    || browser?.osFocus !== 'never'
    || !browser.cdpEndpoint
  ) {
    fail('QA_HUMAN_SETUP_MANAGED_ATTACH_BROWSER_REQUIRED');
  }
  if (
    plan?.browserExecution?.processOwnership !== 'attach_only'
    || plan.browserExecution.targetActivation !== 'active'
    || plan.browserExecution.osFocus !== 'never'
  ) {
    fail('QA_HUMAN_SETUP_BROWSER_EXECUTION_INVALID');
  }
}

function createAutomationRequest({ channel, action, targetTabId, payload = {} }) {
  if (!Number.isSafeInteger(targetTabId) || targetTabId < 0) {
    fail('QA_HUMAN_SETUP_TARGET_TAB_REQUIRED');
  }
  return Object.freeze({
    channel,
    action,
    requestId: `human-setup:${randomUUID()}`,
    targetTabId,
    payload,
  });
}

export async function sendHumanSetupAutomationRequest(harness, request, {
  timeoutMs = 8_000,
} = {}) {
  const delivery = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
    chrome.runtime.sendMessage(${JSON.stringify(request)}, (response) => {
      resolve({
        error: chrome.runtime.lastError?.message || null,
        response: response || null,
      });
    });
  })`, { timeoutMs });
  if (delivery?.error) {
    fail('QA_HUMAN_SETUP_AUTOMATION_TRANSPORT_FAILED', delivery.error);
  }
  const response = delivery?.response;
  if (
    response?.channel !== request.channel
    || response?.action !== request.action
    || response?.requestId !== request.requestId
    || response?.targetTabId !== request.targetTabId
    || response?.success !== true
  ) {
    fail(
      'QA_HUMAN_SETUP_AUTOMATION_ACTION_FAILED',
      `${request.action}:${response?.error || 'response_invalid'}`,
    );
  }
  return response.result;
}

async function pollHumanSetupReadiness({ signal, read, accept, code }) {
  const deadline = Date.now() + HUMAN_SETUP_READY_TIMEOUT_MS;
  let lastValue = null;
  let lastError = null;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    try {
      lastValue = await read();
      lastError = null;
      if (accept(lastValue)) return lastValue;
    } catch (error) {
      lastError = error;
    }
    await sleep(HUMAN_SETUP_POLL_MS);
  }
  const error = new Error(code, lastError ? { cause: lastError } : undefined);
  error.code = code;
  error.diagnostic = lastValue;
  throw error;
}

function createFeatureCleanupOwner() {
  let release = null;
  let settled = null;
  return Object.freeze({
    install(nextRelease) {
      if (release || typeof nextRelease !== 'function') {
        fail('QA_HUMAN_SETUP_FEATURE_CLEANUP_INVALID');
      }
      release = nextRelease;
    },
    async release() {
      if (settled) return settled;
      settled = release
        ? await release()
        : Object.freeze({ featureStopped: false, reason: 'not_started' });
      return settled;
    },
  });
}

async function inspectExactTargetTab(harness, targetTabId) {
  return harness.evaluateInTrustedPage(`new Promise((resolve) => {
    chrome.tabs.get(${JSON.stringify(targetTabId)}, (tab) => {
      const error = chrome.runtime.lastError?.message || null;
      resolve({
        exists: !error && !!tab,
        error,
        tab: !error && tab ? {
          id: tab.id,
          url: tab.url || null,
          active: tab.active === true,
          windowId: Number.isInteger(tab.windowId) ? tab.windowId : null,
        } : null,
      });
    });
  })`);
}

async function stopWebContentFeature({ harness, targetTabId, targetOrigin, request }) {
  const target = await inspectExactTargetTab(harness, targetTabId);
  if (target.exists !== true) {
    return Object.freeze({
      featureStopped: true,
      mechanism: 'target_closed',
      targetTabId,
      proof: target,
    });
  }
  let currentOrigin = null;
  try {
    currentOrigin = new URL(target.tab.url).origin;
  } catch (_error) {
    currentOrigin = null;
  }
  if (currentOrigin !== targetOrigin) {
    return Object.freeze({
      featureStopped: true,
      mechanism: 'target_navigation_disposed_content',
      targetTabId,
      targetUrl: target.tab.url,
    });
  }
  const result = await sendHumanSetupAutomationRequest(harness, request());
  return Object.freeze({
    featureStopped: true,
    mechanism: 'typed_stop',
    targetTabId,
    result,
  });
}

async function prepareSentinel({
  harness,
  page,
  featureId,
  parameters,
  targetOrigin,
  signal,
  cleanupOwner,
  evidence,
  attachmentsDir,
}) {
  const scope = featureId === 'global_sentinel' ? 'global' : 'site';
  cleanupOwner.install(() => stopWebContentFeature({
    harness,
    targetTabId: page.tabId,
    targetOrigin,
    request: () => createAutomationRequest({
      channel: SENTINEL_PROTOCOL_QA_CHANNEL,
      action: SENTINEL_PROTOCOL_QA_ACTIONS.STOP,
      targetTabId: page.tabId,
    }),
  }));
  const started = await sendHumanSetupAutomationRequest(
    harness,
    createAutomationRequest({
      channel: SENTINEL_PROTOCOL_QA_CHANNEL,
      action: SENTINEL_PROTOCOL_QA_ACTIONS.START,
      targetTabId: page.tabId,
      payload: {
        protocolScope: scope,
        protocolIntensity: parameters.intensityPercent / 100,
        hudVisible: parameters.hudVisible,
      },
    }),
  );
  if (started?.ok !== true) fail('QA_HUMAN_SETUP_SENTINEL_START_INVALID');
  const read = async () => {
    const snapshot = await sendHumanSetupAutomationRequest(
      harness,
      createAutomationRequest({
        channel: SENTINEL_PROTOCOL_QA_CHANNEL,
        action: SENTINEL_PROTOCOL_QA_ACTIONS.SNAPSHOT,
        targetTabId: page.tabId,
      }),
    );
    const surface = await inspectHumanSentinelSurface(harness, page);
    return { snapshot, surface };
  };
  const initial = await read();
  let screenshotPath = null;
  if (parameters.captureScreenshots) {
    await fs.mkdir(attachmentsDir, { recursive: true });
    screenshotPath = path.join(attachmentsDir, 'human-sentinel-start.png');
    const capture = await harness.cdp.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false,
    }, page.sessionId, { timeoutMs: 8_000 });
    if (!capture?.data) fail('QA_HUMAN_SETUP_SCREENSHOT_EMPTY');
    await fs.writeFile(screenshotPath, Buffer.from(capture.data, 'base64'));
  }
  await evidence.event('QA_HUMAN_SETUP_SENTINEL_INVOKED', {
    ...initial, screenshotPath, admissionMode: 'direct_realization',
  });
  const observed = isHumanSentinelReady(initial, scope) ? initial : await pollHumanSetupReadiness({
    signal,
    code: 'QA_HUMAN_SETUP_SENTINEL_READY_TIMEOUT',
    read,
    accept: (value) => isHumanSentinelReady(value, scope),
  });
  return Object.freeze({
    realization: 'sentinel_protocol',
    protocolScope: scope,
    ...observed,
    screenshotPath,
  });
}

async function observeHumanSentinelSession({ harness, page, signal, evidence, attachmentsDir, captureScreenshots }) {
  let previousState = null;
  let captured = false;
  await fs.mkdir(attachmentsDir, { recursive: true });
  while (!signal.aborted) {
    try {
      await delay(1_000, undefined, { signal });
    } catch (error) {
      signal.throwIfAborted();
      throw error;
    }
    let state;
    try {
      const target = await inspectExactTargetTab(harness, page.tabId);
      if (!target.exists || !/^https?:\/\//u.test(target.tab.url)) {
        state = { status: target.exists ? 'target_navigated' : 'target_closed', target };
      } else {
        const snapshot = await sendHumanSetupAutomationRequest(harness, createAutomationRequest({
          channel: SENTINEL_PROTOCOL_QA_CHANNEL,
          action: SENTINEL_PROTOCOL_QA_ACTIONS.SNAPSHOT,
          targetTabId: page.tabId,
        }));
        state = {
          status: snapshot.active ? 'active' : 'inactive',
          mode: snapshot.mode,
          phase: snapshot.snapshot?.diagnostics?.globalSentinelGamePhase,
          runtimeError: snapshot.snapshot?.lastRuntimeError,
          target,
          surface: await inspectHumanSentinelSurface(harness, page),
        };
        if (captureScreenshots && !captured && snapshot.active) {
          const result = await harness.cdp.send('Page.captureScreenshot', {
            format: 'png', fromSurface: true, captureBeyondViewport: false,
          }, page.sessionId, { timeoutMs: 8_000 });
          if (!result?.data) fail('QA_HUMAN_SETUP_SCREENSHOT_EMPTY');
          const screenshotPath = path.join(attachmentsDir, 'human-sentinel-handoff.png');
          await fs.writeFile(screenshotPath, Buffer.from(result.data, 'base64'));
          await evidence.event('QA_HUMAN_SETUP_HANDOFF_CAPTURED', { screenshotPath });
          captured = true;
        }
      }
    } catch (error) {
      signal.throwIfAborted();
      state = { status: 'observation_failed', error: error.message };
    }
    const observedAt = new Date().toISOString();
    await fs.writeFile(path.join(attachmentsDir, 'human-sentinel-latest.json'),
      `${JSON.stringify({ observedAt, ...state }, null, 2)}\n`);
    const stateKey = JSON.stringify([state.status, state.mode, state.phase, state.error]);
    if (previousState !== stateKey) {
      previousState = stateKey;
      await evidence.event('QA_HUMAN_SETUP_STATE_CHANGED', { observedAt, ...state });
      process.stdout.write(`${JSON.stringify({
        event: 'QA_HUMAN_SETUP_STATE_CHANGED', observedAt,
        status: state.status, mode: state.mode, phase: state.phase, error: state.error,
      })}\n`);
    }
  }
  signal.throwIfAborted();
}

async function inspectShishiSurface(harness, page) {
  return evaluate(
    harness.cdp,
    page.sessionId,
    `(() => {
      const root = document.querySelector('.gate-page[data-gate-kind="entryCheckpoint"]');
      return {
        href: location.href,
        readyState: document.readyState,
        gateKind: root?.getAttribute('data-gate-kind') || null,
        themeId: root?.getAttribute('data-theme-id') || null,
        ready: root?.getAttribute('data-ready') || null,
        shishiScenePresent: !!document.querySelector('[data-zen-shishi-scene="actual"]'),
      };
    })()`,
    { timeoutMs: 1_000 },
  );
}

async function prepareShishiOdoshi({ harness, page, signal, cleanupOwner }) {
  cleanupOwner.install(async () => {
    const result = await sendHumanSetupAutomationRequest(
      harness,
      createAutomationRequest({
        channel: GATE_QA_AUTOMATION_CHANNEL,
        action: GATE_QA_AUTOMATION_ACTIONS.DISMISS,
        targetTabId: page.tabId,
      }),
    );
    return Object.freeze({ featureStopped: true, mechanism: 'typed_dismiss', result });
  });
  const presentation = await sendHumanSetupAutomationRequest(
    harness,
    createAutomationRequest({
      channel: GATE_QA_AUTOMATION_CHANNEL,
      action: GATE_QA_AUTOMATION_ACTIONS.PRESENT_ENTRY_CHECKPOINT,
      targetTabId: page.tabId,
      payload: { holdMs: 0 },
    }),
  );
  if (
    presentation?.handled !== true
    || presentation?.gateKind !== 'entryCheckpoint'
    || typeof presentation?.sessionId !== 'string'
  ) {
    fail('QA_HUMAN_SETUP_SHISHI_PRESENTATION_INVALID');
  }
  const surface = await pollHumanSetupReadiness({
    signal,
    code: 'QA_HUMAN_SETUP_SHISHI_READY_TIMEOUT',
    read: () => inspectShishiSurface(harness, page),
    accept: (value) => (
      value?.href?.startsWith('chrome-extension://')
      && value?.gateKind === 'entryCheckpoint'
      && value?.themeId === 'zen'
      && value?.ready === '1'
      && value?.shishiScenePresent === true
    ),
  });
  return Object.freeze({
    realization: 'gate_entry_checkpoint',
    sessionId: presentation.sessionId,
    surface,
  });
}

async function inspectEnsoSurface(harness, page) {
  return evaluate(
    harness.cdp,
    page.sessionId,
    `(() => {
      const root = document.querySelector('.friction-click-enso-gate');
      return {
        present: !!root,
        entry: root?.getAttribute('data-entry') || null,
        zone: root?.getAttribute('data-zone') || null,
        feedback: root?.getAttribute('data-feedback') || null,
        canvasPresent: !!root?.querySelector('.friction-click-enso-gate__gesture-canvas'),
      };
    })()`,
    { timeoutMs: 1_000 },
  );
}

async function prepareEnsoGate({
  harness,
  page,
  targetOrigin,
  signal,
  cleanupOwner,
}) {
  await sendHumanSetupAutomationRequest(
    harness,
    createAutomationRequest({
      channel: RUNTIME_DEBUGGER_AUTOMATION_CHANNEL,
      action: RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.START,
      targetTabId: page.tabId,
      payload: { captureKind: 'live' },
    }),
  );
  cleanupOwner.install(async () => {
    const target = await inspectExactTargetTab(harness, page.tabId);
    if (target.exists !== true) {
      return Object.freeze({
        featureStopped: true,
        mechanism: 'target_closed',
        proof: target,
      });
    }
    let currentOrigin = null;
    try {
      currentOrigin = new URL(target.tab.url).origin;
    } catch (_error) {
      currentOrigin = null;
    }
    if (currentOrigin !== targetOrigin) {
      return Object.freeze({
        featureStopped: true,
        mechanism: 'target_navigation_disposed_content',
        targetUrl: target.tab.url,
      });
    }
    const dismissed = await sendHumanSetupAutomationRequest(
      harness,
      createAutomationRequest({
        channel: RUNTIME_DEBUGGER_AUTOMATION_CHANNEL,
        action: RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.DISMISS_ENSO_GATE,
        targetTabId: page.tabId,
      }),
    );
    const stopped = await sendHumanSetupAutomationRequest(
      harness,
      createAutomationRequest({
        channel: RUNTIME_DEBUGGER_AUTOMATION_CHANNEL,
        action: RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.STOP,
        targetTabId: page.tabId,
      }),
    );
    return Object.freeze({
      featureStopped: true,
      mechanism: 'typed_dismiss_and_stop',
      dismissed,
      stopped,
    });
  });
  const forced = await sendHumanSetupAutomationRequest(
    harness,
    createAutomationRequest({
      channel: RUNTIME_DEBUGGER_AUTOMATION_CHANNEL,
      action: RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.FORCE_ENSO_GATE,
      targetTabId: page.tabId,
    }),
  );
  if (forced?.forced !== true) {
    fail('QA_HUMAN_SETUP_ENSO_FORCE_INVALID', forced?.reason || 'unknown');
  }
  const surface = await pollHumanSetupReadiness({
    signal,
    code: 'QA_HUMAN_SETUP_ENSO_READY_TIMEOUT',
    read: () => inspectEnsoSurface(harness, page),
    accept: (value) => value?.present === true && value?.canvasPresent === true,
  });
  return Object.freeze({
    realization: 'interaction_manager_debug_spawn',
    detectorAdmissionExercised: false,
    surface,
  });
}

async function openOwnedPeerTabs({ harness, targetUrl, count, targetOrigin }) {
  const peers = [];
  for (let index = 0; index < count; index += 1) {
    const page = await harness.openPage(targetUrl, {
      active: false,
      timeoutMs: 45_000,
    });
    await harness.enableNoFocusPageExecution(page);
    const tab = await harness.resolveTabForPage(page);
    let tabOrigin;
    try {
      tabOrigin = new URL(tab.url).origin;
    } catch (_error) {
      tabOrigin = null;
    }
    if (tab.id !== page.tabId || tabOrigin !== targetOrigin) {
      fail('QA_HUMAN_SETUP_DETOUR_PEER_ADMISSION_INVALID', String(page.targetId));
    }
    peers.push(Object.freeze({ page, tab }));
  }
  return Object.freeze(peers);
}

export async function inspectDetourSurface(harness, page) {
  return evaluate(harness.cdp, page.sessionId, `(() => {
    const root = document.querySelector('.gate-page[data-gate-kind="detourSpreadGuard"]');
    return {
      href: location.href,
      topLevel: window === window.top,
      present: !!root,
      presentation: root?.getAttribute('data-presentation') || null,
      count: root?.querySelector('.gate-predator-monolith__quota')?.getAttribute('aria-label') || null,
    };
  })()`, { timeoutMs: 1_000 });
}

function toProtectedTab(tab, { active }) {
  const parsed = new URL(tab.url);
  return Object.freeze({
    tabId: tab.id,
    url: tab.url,
    hostname: parsed.hostname,
    title: typeof tab.title === 'string' && tab.title.trim()
      ? tab.title.trim().slice(0, 180)
      : parsed.hostname,
    favIconUrl: typeof tab.favIconUrl === 'string' ? tab.favIconUrl : '',
    active,
  });
}

async function prepareDetourSpreadGuard({
  harness,
  page,
  targetTab,
  targetUrl,
  targetOrigin,
  parameters,
  signal,
  cleanupOwner,
}) {
  if (parameters.openTabCount <= parameters.maxProtectedTabs) {
    fail('QA_HUMAN_SETUP_DETOUR_TAB_BUDGET_NOT_EXCEEDED');
  }
  const peers = await openOwnedPeerTabs({
    harness,
    targetUrl,
    targetOrigin,
    count: parameters.openTabCount - 1,
  });
  const protectedTabs = Object.freeze([
    toProtectedTab(targetTab, { active: true }),
    ...peers.map(({ tab }) => toProtectedTab(tab, { active: false })),
  ]);
  cleanupOwner.install(async () => {
    const result = await sendHumanSetupAutomationRequest(
      harness,
      createAutomationRequest({
        channel: GATE_QA_AUTOMATION_CHANNEL,
        action: GATE_QA_AUTOMATION_ACTIONS.DISMISS,
        targetTabId: page.tabId,
      }),
    );
    return Object.freeze({ featureStopped: true, mechanism: 'typed_dismiss', result });
  });
  const presentation = await sendHumanSetupAutomationRequest(
    harness,
    createAutomationRequest({
      channel: GATE_QA_AUTOMATION_CHANNEL,
      action: GATE_QA_AUTOMATION_ACTIONS.PRESENT_DETOUR_SPREAD,
      targetTabId: page.tabId,
      payload: {
        maxProtectedTabs: parameters.maxProtectedTabs,
        protectedTabs: protectedTabs.map(({ tabId, url }) => ({ tabId, url })),
      },
    }),
  );
  if (
    presentation?.handled !== true
    || presentation?.gateKind !== 'detourSpreadGuard'
    || presentation.reason !== 'redirected'
    || typeof presentation.gatePageUrl !== 'string'
    || typeof presentation?.sessionId !== 'string'
  ) {
    fail('QA_HUMAN_SETUP_DETOUR_PRESENTATION_INVALID');
  }
  const surface = await pollHumanSetupReadiness({
    signal,
    code: 'QA_HUMAN_SETUP_DETOUR_READY_TIMEOUT',
    read: () => inspectDetourSurface(harness, page),
    accept: (value) => (
      value?.present === true
      && value.count === `${parameters.openTabCount}/${parameters.maxProtectedTabs}`
      && value.topLevel === true
      && value.href === presentation.gatePageUrl
      && value.presentation === 'blocking'
    ),
  });
  return Object.freeze({
    realization: 'gate_detour_spread',
    detectorAdmissionExercised: false,
    sessionId: presentation.sessionId,
    protectedTabIds: Object.freeze(protectedTabs.map(({ tabId }) => tabId)),
    maxProtectedTabs: parameters.maxProtectedTabs,
    surface,
  });
}

const FEATURE_PREPARERS = Object.freeze({
  site_furin: prepareSentinel,
  global_sentinel: prepareSentinel,
  shishi_odoshi: prepareShishiOdoshi,
  enso_gate: prepareEnsoGate,
  detour_spread_guard: prepareDetourSpreadGuard,
});

export function resolveHumanSetupInstructions(featureId) {
  const instructions = {
    site_furin: [
      '중앙의 guide koi를 눌러 Site Furin 흐름을 확인하세요.',
      '포인터를 누른 채 움직여 school을 return current로 이끄세요.',
    ],
    global_sentinel: [
      '중앙의 시작 koi를 선택해 Global Furin을 진행하세요.',
      '균열이 열린 뒤 포털을 선택하면 Room 478까지 확인할 수 있습니다.',
    ],
    shishi_odoshi: [
      'Zen Shishi-odoshi entry checkpoint의 상태와 동작을 확인하세요.',
      'QA는 Continue를 자동으로 누르지 않습니다.',
    ],
    enso_gate: [
      '실제 Enso Gate에서 원을 그리는 제스처와 결과를 확인하세요.',
      '이 setup은 detector admission이 아니라 실제 gate realization을 직접 호출합니다.',
    ],
    detour_spread_guard: [
      'QA가 만든 보호 사이트 탭만 대상으로 탭 정리 UI를 확인하세요.',
      '이 setup은 detector admission이 아니라 실제 Gate session/UI를 직접 호출합니다.',
    ],
  }[featureId];
  if (!instructions) fail('QA_HUMAN_SETUP_FEATURE_UNSUPPORTED', featureId);
  return Object.freeze([...instructions]);
}

export function waitForHumanSetupCancellation(signal) {
  if (!signal || typeof signal.addEventListener !== 'function') {
    fail('QA_HUMAN_SETUP_ABORT_SIGNAL_REQUIRED');
  }
  if (signal.aborted) return Promise.reject(signal.reason || new Error('QA_RUN_ABORTED'));
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      reject(signal.reason || new Error('QA_RUN_ABORTED'));
    }, { once: true });
  });
}

export async function executeQaProtocol(context) {
  requireHumanSetupContext(context);
  const {
    plan,
    artifact,
    browser,
    evidence,
    attachmentsDir,
    recoveryJournal,
    registerCleanup,
    reportBrowserGpuCapability,
    requestOperatorHandoff,
    signal,
  } = context;
  const startupStartedAt = performance.now();
  let lastStageAt = startupStartedAt;
  const startup = [];
  const markStage = async (stage) => {
    const now = performance.now();
    const mark = {
      stage,
      durationMs: Math.round(now - lastStageAt),
      elapsedMs: Math.round(now - startupStartedAt),
    };
    lastStageAt = now;
    startup.push(mark);
    await evidence.event('QA_HUMAN_SETUP_STAGE_READY', mark);
    process.stdout.write(`${JSON.stringify({ event: 'QA_HUMAN_SETUP_STAGE_READY', ...mark })}\n`);
  };
  const feature = resolveQaHumanSetupFeature(plan.protocolOptions.featureId);
  if (feature.targetId !== plan.targetId) {
    fail(
      'QA_HUMAN_SETUP_TARGET_FEATURE_MISMATCH',
      `${plan.targetId}:${feature.id}`,
    );
  }
  const targetUrl = resolveQaHumanSetupUrl({
    siteId: plan.parameters.site,
    url: plan.parameters.url,
  });
  const parsedTargetUrl = new URL(targetUrl);
  const temporaryManifest = Object.freeze({
    requiredPermissions: ['scripting'],
    requiredHostPermissions: [`${parsedTargetUrl.origin}/*`],
  });
  const attachedArtifactStage = defineEntropyQaAttachedArtifactStage({
    browser,
    browserExecution: plan.browserExecution,
    sourceDir: artifact.path,
    artifactIdentity: {
      artifactId: artifact.id,
      inputDigest: artifact.inputDigest,
      buildId: artifact.buildId,
      releaseProfile: artifact.releaseProfile,
    },
    temporaryManifest,
  });
  const harness = new ExtensionChromiumHarness({
    chromePath: browser.chrome,
    distDir: browser.extensionSlot,
    rootDir: plan.rootDir,
    headless: plan.browserExecution.headless,
    browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy,
    launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement,
    cdpEndpoint: browser.cdpEndpoint,
    expectedBrowserIdentity: browser.browserIdentity,
    attachedArtifactStage,
    keepTemp: false,
    qaProfileDir: browser.profile,
    qaProfileDirectory: browser.profileDirectory,
    tempPrefix: `entropy-human-${feature.id.replaceAll('_', '-')}-qa-`,
    loadInPlace: true,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    attachedArtifactRuntimeReadiness: proveEntropyAttachedArtifactRuntimeReadiness,
    recoveryJournal,
  });
  registerCleanup('human_setup_harness', () => harness.close().then(() => ({
    browserProcessPreserved: true,
  })));
  const cleanupOwner = createFeatureCleanupOwner();
  registerCleanup('human_setup_feature', () => cleanupOwner.release());

  await harness.start();
  await markStage('harness_attached');
  await reportBrowserGpuCapability(harness.gpuCapability);
  if (harness.uninstallExtensionOnClose) {
    fail('QA_HUMAN_SETUP_EXTENSION_UNINSTALL_FORBIDDEN');
  }
  await evidence.event('QA_MANAGED_EXTENSION_SLOT_ADMITTED', {
    environmentId: browser.environmentId,
    profileSlotId: browser.profileSlotId,
    action: harness.managedExtensionSlotAction,
    installMode: harness.extensionInstallMode,
    artifactSync: harness.attachedArtifactSyncReceipt,
  });
  const postRefreshRuntimeReadiness = readEntropyPostRefreshTrackingRuntimeReadiness(harness);
  if (postRefreshRuntimeReadiness?.required === true) {
    await evidence.event('QA_TRACKING_RUNTIME_POST_REFRESH_READY', {
      protocol: 'human_setup',
      ...postRefreshRuntimeReadiness,
    });
  }

  const admission = await openEntropyAttachOnlyActivePage({
    harness,
    url: targetUrl,
    browserExecution: plan.browserExecution,
    // Manual Sentinel realization addresses this exact tab. Its native surface
    // readiness below is independent of production foreground-use accounting.
    observation: ['site_furin', 'global_sentinel'].includes(feature.id) ? 'document' : 'emulated',
  });
  const { page, targetTab } = admission;
  await evidence.event('QA_HUMAN_SETUP_TARGET_ADMITTED', admission.receipt);
  await markStage('target_admitted');
  if (!Number.isSafeInteger(page.tabId) || page.tabId !== targetTab.id) {
    fail('QA_HUMAN_SETUP_TARGET_TAB_ADMISSION_INVALID');
  }
  // The explicit setup grant prepares this exact window once. A minimized
  // document cannot mount a visible intervention before that preparation.
  const focusReceipt = await requestOperatorHandoff({
    targetId: page.targetId,
    targetTabId: page.tabId,
    targetWindow: admission.receipt.targetWindow,
  });
  await markStage('operator_window_prepared');
  signal.throwIfAborted();
  const prepareFeature = FEATURE_PREPARERS[feature.id];
  if (!prepareFeature) fail('QA_HUMAN_SETUP_FEATURE_UNSUPPORTED', feature.id);
  const readiness = await prepareFeature({
    harness,
    page,
    targetTab,
    targetUrl,
    targetOrigin: parsedTargetUrl.origin,
    featureId: feature.id,
    parameters: plan.parameters,
    signal,
    cleanupOwner,
    evidence,
    attachmentsDir,
  });
  await markStage('feature_visible');
  signal.throwIfAborted();
  const ready = Object.freeze({
    event: 'QA_HUMAN_SETUP_READY',
    status: 'READY_FOR_HUMAN',
    runId: plan.runId,
    targetId: plan.targetId,
    siteId: plan.parameters.site,
    featureId: feature.id,
    targetOrigin: parsedTargetUrl.origin,
    targetTabId: page.tabId,
    targetWindow: admission.receipt.targetWindow,
    focus: focusReceipt,
    readiness,
    startup,
    syntheticInputCount: 0,
    runnerOwnership: 'retained_until_explicit_cancel',
    stopInstruction: '검증이 끝나면 실행 중인 QA 터미널에서 Ctrl-C를 누르세요.',
    instructions: resolveHumanSetupInstructions(feature.id),
  });
  await evidence.event('QA_HUMAN_SETUP_READY', ready);
  process.stdout.write(`${JSON.stringify(ready)}\n`);
  if (readiness.realization === 'sentinel_protocol') {
    await observeHumanSentinelSession({
      harness, page, signal, evidence, attachmentsDir,
      captureScreenshots: plan.parameters.captureScreenshots,
    });
  }
  await waitForHumanSetupCancellation(signal);
  fail('QA_HUMAN_SETUP_CANCEL_SIGNAL_REQUIRED');
}
