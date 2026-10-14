import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ExtensionChromiumHarness, evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { RECOMMENDED_LOCAL_ANALYSIS_PROFILE_PATCH } from '../../../src/domains/settings/config/localAnalysisProfilePolicy.js';
import { GATE_QA_AUTOMATION_ACTIONS } from '../../../src/domains/protection/background/automation/gateQaAutomationContract.dev.js';
import { requireSitesSiteDetailQueryResult } from '../../../src/domains/stats/contracts/sitesSiteDetailContracts.js';
import { requireSitesRecordingPolicy } from '../../../src/domains/stats/contracts/sitesRecordingContracts.js';
import { matchesDashboardCaptureViewport, resolveDashboardCaptureViewport } from '../contracts/dashboardCaptureViewportContract.mjs';
import { sendTrustedRuntimeMessage, sendGateAutomation } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { ensureQaSecurityVaultReady } from './securityVaultQaFixture.mjs';
import { runDashboardSitesStoredReadingJourney, requireStoredSitesReadingDetail } from './dashboardSitesStoredReadingJourney.mjs';
import { createDashboardPageDiagnostics, classifyDashboardCaptureHealth } from './dashboardCaptureDiagnostics.mjs';

const DOMAIN = 'ledger.localhost';
const OBSERVE_MS = 8_000;

function requireEvidence(condition, code, diagnostic) {
  if (!condition) {
    const error = new Error('QA_SITES_STORED_' + code);
    error.diagnostic = diagnostic;
    throw error;
  }
}

export function requireStoredStatsDurability(before, after) {
  requireStoredSitesReadingDetail(before, DOMAIN);
  requireStoredSitesReadingDetail(after, DOMAIN, before.intel.todayNotes.dateStr);
  requireEvidence(before.mode === 'analysis' && after.mode === 'analysis'
    && before.domain === DOMAIN && after.domain === DOMAIN
    && before.intel.todayObserved === true && after.intel.todayObserved === true
    && before.intel.todayTotal > 0 && before.intel.todaySessionStats.count > 0
    && before.intel.todaySessionStats.totalMs > 0
    && isDeepStrictEqual(before.intel.todayHourly, after.intel.todayHourly)
    && isDeepStrictEqual(before.intel.todaySessionStats, after.intel.todaySessionStats)
    && isDeepStrictEqual(before.intel.todayCollectionObservation, after.intel.todayCollectionObservation)
    && before.intel.todayTotal === after.intel.todayTotal, 'DURABILITY_FAILED', { before, after });
  return { activeMs: after.intel.todayTotal, hourlyActiveMs: after.intel.todayHourly,
    sessions: after.intel.todaySessionStats, collectionObservation: after.intel.todayCollectionObservation,
    dateStr: after.intel.todayNotes.dateStr };
}

// Only the HTTP document is provided by QA. Production Chrome ingress creates
// elapsed/session facts and the typed stats owners commit them to IndexedDB.
// No clock, source-stat fixture, direct DB access or synthetic duration is used.
export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal, requestInitialOwnedWindowPresentation }) {
  requireEvidence(plan.browserExecution.presentation === 'foreground' && !plan.browserExecution.headless
    && browser.processOwnership === 'owned' && artifact.id === 'dev_extension', 'OWNED_FOREGROUND_REQUIRED');
  const trace = [];
  const record = async (phase, data) => {
    trace.push({ phase, data });
    await evidence.event('QA_SITES_STORED_READING_BOUNDARY', { phase, data });
    console.log(JSON.stringify({ event: 'QA_SITES_STORED_READING_BOUNDARY_REACHED', phase }));
  };
  registerCleanup('sites_stored_reading_trace', async () => {
    await fs.writeFile(path.join(attachmentsDir, 'stored-records-trace.json'), JSON.stringify(trace, null, 2));
    return { action: 'written', samples: trace.length };
  });
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('<!doctype html><html><meta charset="utf-8"><title>Entropy local collection QA</title><body><h1>Local collection observation</h1><p>This page supplies no statistics.</p></body></html>');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  registerCleanup('sites_stored_reading_server', () => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve({ action: 'closed' }));
    server.closeAllConnections();
  }));
  const address = server.address();
  requireEvidence(address !== null && typeof address === 'object', 'LOOPBACK_ADDRESS_REQUIRED');
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment,
    displayReceipt: browser.display, renderingRequirement: plan.browserExecution.renderingRequirement,
    keepTemp: false, trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    tempPrefix: 'entropy-sites-stored-reading-', recoveryJournal });
  registerCleanup('sites_stored_reading_browser', () => harness.close());
  await harness.start();
  await reportBrowserGpuCapability(harness.gpuCapability);
  try {
  const send = message => sendTrustedRuntimeMessage(harness, message);
  const requireReply = (reply, operation) => {
    requireEvidence(reply?.success === true, operation + '_FAILED', reply);
    return reply;
  };
  const settings = async items => requireConsumptionQaSettingsAcknowledgement(
    await send({ action: MESSAGE_ACTIONS.SET_SETTINGS, items, waitForPropagation: true }), items);
  await settings({ 'app-theme': 'zen', ...RECOMMENDED_LOCAL_ANALYSIS_PROFILE_PATCH,
    globalGoal: 120, trackingExcludedUrls: [], filteringMode: 'blocklist', rulesMode: 'managed',
    nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS), gateConfig: structuredClone(DEFAULT_GATE_CONFIG) });
  const rule = requireReply(await send({ action: MESSAGE_ACTIONS.UPSERT_SITE_RULE,
    domain: DOMAIN, type: 'blocked', waitForPropagation: true }), 'RULE');
  requireEvidence(rule.propagation?.status === 'succeeded', 'RULE_PROPAGATION_REQUIRED', rule);
  const source = await harness.openPage(`http://${DOMAIN}:${address.port}/`, { active: true });
  if (plan.parameters.allowInitialWindowFocusOnce === true) {
    requireEvidence(typeof requestInitialOwnedWindowPresentation === 'function', 'INITIAL_WINDOW_OWNER_REQUIRED');
    await record('initial-window', await requestInitialOwnedWindowPresentation({
      child: harness.chrome, cdp: harness.cdp, targetId: source.targetId, tabId: source.tabId,
    }));
  } else {
    // Explicit focus opt-out: observe the native foreground state, never repair
    // focus or substitute visible-document state for a foreground window.
    await record('focus-opt-out-foreground-required', { targetTabId: source.tabId, title: 'Entropy local collection QA' });
    const deadline = Date.now() + 90_000;
    let native;
    do {
      signal?.throwIfAborted();
      native = await harness.evaluateInTrustedPage(`(async () => {
        const tab = await chrome.tabs.get(${source.tabId});
        const window = await chrome.windows.get(tab.windowId);
        return { active: tab.active, focused: window.focused, state: window.state };
      })()`);
      if (native.active && native.focused && native.state !== 'minimized') break;
      await sleep(500);
    } while (Date.now() < deadline);
    requireEvidence(native.active && native.focused && native.state !== 'minimized', 'FOCUS_OPT_OUT_FOREGROUND_REQUIRED', native);
    await record('focus-opt-out-foreground-observed', native);
  }
  await ensureQaSecurityVaultReady(harness, { passphrase: `Entropy stored reading QA ${randomUUID()}` });
  const sink = await harness.openPage('about:blank', { active: false });

  const until = async (read, predicate, code, timeoutMs = 30_000) => {
    const deadline = Date.now() + timeoutMs;
    let value;
    do {
      signal?.throwIfAborted();
      value = await read();
      if (predicate(value)) return value;
      await sleep(250);
    } while (Date.now() < deadline);
    requireEvidence(false, code, value);
  };
  const runtime = async () => requireReply(await send({ action: MESSAGE_ACTIONS.DEBUG_GET_TRACKING_RUNTIME_STATE }), 'TRACKING').runtime;
  const query = async () => {
    const snapshot = requireReply(await send({ action: MESSAGE_ACTIONS.GET_SITES_SNAPSHOT }), 'SNAPSHOT').sitesSnapshot;
    requireSitesRecordingPolicy(snapshot.recording);
    const result = requireSitesSiteDetailQueryResult(requireReply(await send({
      action: MESSAGE_ACTIONS.GET_SITES_SITE_DETAIL, domain: DOMAIN,
      siteDetailRevision: snapshot.siteDetailRevision,
    }), 'DETAIL'));
    return { snapshot, detail: result.sitesSiteDetail };
  };
  const nativeSource = async () => {
    const native = await harness.evaluateInTrustedPage(`(async () => {
      const tab = await chrome.tabs.get(${source.tabId});
      const window = await chrome.windows.get(tab.windowId);
      return { tabId: tab.id, active: tab.active, windowId: window.id, focused: window.focused, state: window.state };
    })()`);
    const document = await evaluate(harness.cdp, source.sessionId,
      '({visibility:document.visibilityState, focused:document.hasFocus(), host:location.hostname})');
    const tracking = await runtime();
    requireEvidence(native.tabId === source.tabId && native.active && native.focused && native.state !== 'minimized'
      && document.visibility === 'visible' && document.focused && document.host === DOMAIN
      && tracking.lastActiveTabId === source.tabId && tracking.focusedWindowId === native.windowId
      && tracking.activeTabInfo?.tabId === source.tabId && tracking.activeTabInfo.hostname === DOMAIN
      && Number.isFinite(tracking.activeTabInfo.startedAt) && tracking.activeTabInfo.startedAt > 0,
    'NATIVE_FOREGROUND_NOT_ADMITTED', { native, document, tracking });
    return { native, document, activeTabInfo: tracking.activeTabInfo };
  };
  const collect = async (destination, phase) => {
    await harness.activateOwnedEphemeralPageWithoutWindowFocus(source);
    await until(runtime, state => state.activeTabInfo?.tabId === source.tabId
      && state.activeTabInfo.hostname === DOMAIN && state.activeTabInfo.startedAt > 0, 'SOURCE_NOT_ADMITTED');
    const before = await nativeSource();
    const startedAt = Date.now();
    while (Date.now() - startedAt < OBSERVE_MS) {
      signal?.throwIfAborted();
      await sleep(1000);
      await nativeSource();
    }
    const after = await nativeSource();
    await harness.activateOwnedEphemeralPageWithoutWindowFocus(destination);
    const settlement = await until(runtime, state => state.lastActiveTabId === destination.tabId
      && state.lastPreviousTabSettlement?.hostname === DOMAIN
      && state.lastPreviousTabSettlement.targetTabId === source.tabId
      && state.lastPreviousTabSettlement.status === 'pass'
      && state.lastPreviousTabSettlement.code === 'foreground_segment_closed'
      && state.lastPreviousTabSettlement.elapsedMs > 0, 'FOREGROUND_NOT_COMMITTED');
    requireReply(await send({ action: MESSAGE_ACTIONS.DEBUG_FORCE_SAVE }), 'SAVE');
    const consumption = await sendGateAutomation(harness, {
      action: GATE_QA_AUTOMATION_ACTIONS.READ_CONSUMPTION, targetTabId: source.tabId,
    });
    requireEvidence(consumption.flow.basis === 'collection-admitted-foreground'
      && consumption.flow.protectedForegroundMs > 0
      && consumption.flow.contexts.some(context => context.hostname === DOMAIN && context.tabId === source.tabId
        && context.closed === true && context.endedAt > context.startedAt), 'COLLECTED_CONTEXT_REQUIRED', consumption.flow);
    await record(phase, { before, after, wallElapsedMs: Date.now() - startedAt,
      settlement: settlement.lastPreviousTabSettlement, flow: consumption.flow });
    return until(query, value => value.detail.intel?.todayObserved === true
      && value.detail.intel.todayTotal > 0 && value.detail.intel.todaySessionStats.count > 0,
    'STORED_DAY_NOT_OBSERVED');
  };

  const first = await collect(sink, 'first-real-collection');
  await record('before-worker-stop', first.detail);
  const stopped = await harness.stopServiceWorker();
  const restored = await query();
  const revived = await harness.waitForServiceWorker({ previousTargetId: stopped.targetId });
  requireEvidence(revived.targetId !== stopped.targetId, 'WORKER_NOT_RECREATED');
  const durability = requireStoredStatsDurability(first.detail, restored.detail);
  await record('stored-after-worker-recreation', { beforeWorker: stopped.targetId, afterWorker: revived.targetId, durability });

  const viewport = resolveDashboardCaptureViewport(plan.parameters.viewport);
  const page = await harness.openPage('about:blank', { active: false });
  await harness.cdp.send('Emulation.setDeviceMetricsOverride', { ...viewport, mobile: false }, page.sessionId);
  const diagnostics = createDashboardPageDiagnostics({ cdp: harness.cdp, sessionId: page.sessionId });
  registerCleanup('sites_stored_reading_observers', () => diagnostics.dispose());
  await diagnostics.enable();
  const params = new URLSearchParams({ tab: 'sites', domain: DOMAIN });
  await harness.navigatePage(page, `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?${params}`);
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(page);
  await until(() => evaluate(harness.cdp, page.sessionId, `(() => {
    const reading = document.querySelector('#sites-site-detail .zen-site-ledger__viewport');
    const root = document.getElementById('root');
    const boot = globalThis.__ENTROPY_DASHBOARD_BOOT_SNAPSHOT__;
    return Boolean(reading?.getClientRects().length && document.querySelector('#sites-tab')?.dataset.sitesSnapshotAdmission === 'ready'
      && boot?.status === 'ready' && boot.shellDismissed === true
      && !document.getElementById('entropy-dashboard-boot-shell') && root?.inert === false);
  })()`), ready => ready === true, 'DASHBOARD_NOT_READY', 60_000);
  const readViewport = () => evaluate(harness.cdp, page.sessionId,
    '({width:innerWidth,height:innerHeight,deviceScaleFactor:devicePixelRatio})');
  const viewportBefore = await readViewport();
  requireEvidence(matchesDashboardCaptureViewport({ viewport: viewportBefore }, viewport),
    'VIEWPORT_NOT_APPLIED', { expected: viewport, actual: viewportBefore });
  let latest = restored.detail;
  const journey = await runDashboardSitesStoredReadingJourney({ harness, page, send, signal, evidence,
    domain: DOMAIN, detail: latest,
    advanceStoredRecords: async () => {
      const previous = latest;
      await collect(page, 'additional-real-collection');
      const increased = await until(query, value => value.detail.intel.todayTotal > previous.intel.todayTotal
        && value.detail.intel.todaySessionStats.count > previous.intel.todaySessionStats.count,
      'REAL_RECORDS_DID_NOT_INCREASE');
      latest = increased.detail;
      await record('updated-stored-detail', latest);
      return latest;
    },
    capture: async phase => {
      const screenshot = await harness.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, page.sessionId);
      await fs.writeFile(path.join(attachmentsDir, `stored-reading-${phase}.png`), Buffer.from(screenshot.data, 'base64'));
    },
  });
  const viewportAfter = await readViewport();
  requireEvidence(matchesDashboardCaptureViewport({ viewport: viewportAfter }, viewport),
    'VIEWPORT_CHANGED', { expected: viewport, actual: viewportAfter });
  await record('reading-journey-complete', { viewportBefore, viewportAfter, journey });
  const boot = await evaluate(harness.cdp, page.sessionId, 'globalThis.__ENTROPY_DASHBOARD_BOOT_SNAPSHOT__');
  const pageDiagnostics = await diagnostics.snapshot();
  const health = classifyDashboardCaptureHealth({ pageSnapshot: { boot: { snapshot: boot } }, pageDiagnostics });
  await record('dashboard-health', { health, boot, runtimeExceptions: pageDiagnostics.runtimeExceptions,
    consoleMessages: pageDiagnostics.consoleMessages, networkFailures: pageDiagnostics.networkFailures,
    logEntries: pageDiagnostics.logEntries });
  requireEvidence(health.status === 'clean', 'DASHBOARD_HEALTH_FAILED', health);
  const result = { status: 'PASS', artifactBuildId: artifact.buildId, viewport: plan.parameters.viewport,
    viewportProof: { before: viewportBefore, after: viewportAfter },
    source: 'production foreground collection and typed IndexedDB stats; no source-stat fixture or clock injection',
    durability, journey, health };
  await fs.writeFile(path.join(attachmentsDir, 'stored-reading-refresh.json'), JSON.stringify(result, null, 2));
  return result;
  } catch (error) {
    await record('failure', { message: error.message, code: error.code,
      detail: error.detail, diagnostic: error.diagnostic });
    throw error;
  }
}
