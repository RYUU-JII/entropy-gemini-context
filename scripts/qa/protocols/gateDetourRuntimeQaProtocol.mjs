import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ExtensionChromiumHarness, evaluate, getTargetInfos, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { normalizeChromiumHarnessTemporaryManifest } from '../../e2e/chromiumHarnessManifestPromotion.mjs';
import { createExtensionRuntimeCollector } from '../../e2e/sites/siteRuntimeBrowser.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/contracts/messageTypes.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../src/domains/settings/config/index.js';
import { DEFAULT_ARTIFACT_CONTROL_STATE } from '../../../src/domains/settings/config/artifactControlState.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { INTERVENTION_RECOVERY_MS } from '../../../src/domains/nudge/runtime/interventionPolicy.js';
import { requireSettingsRuntimeCommandAcknowledgement } from '../../../src/domains/settings/config/settingsRuntimeCommandAcknowledgement.js';
import { GATE_QA_AUTOMATION_ACTIONS } from '../../../src/domains/protection/background/automation/gateQaAutomationContract.dev.js';
import { inspectGatePage, readAuthorizedGateSession, sendGateAutomation, sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { requireEntropyAttachedArtifactRuntimeIdentity, requireEntropyTrackingRuntimeReadiness } from './attachOnlyActivePageAdapter.mjs';
import { requireIntegratedDisposableFixtureOwner } from './integratedSettingsLifecycleFixture.mjs';
import { ensureQaSecurityVaultReady } from './securityVaultQaFixture.mjs';
import { QA_RUN_STATUSES } from '../contracts/qaTargetContract.mjs';

export const DETOUR_RUNTIME_QA_HOST = 'gate-detour.localhost';
const SAFE_HOST = 'gate-detour-safe.localhost';
export const DETOUR_RUNTIME_QA_STEPS = Object.freeze([
  'owned_fixture', 'external_budget_resume', 'tutorial_unchanged', 'selected_close_resume',
]);

function requireProof(condition, code, diagnostic) {
  if (condition) return;
  const error = new Error(`QA_GATE_DETOUR_${code}`);
  error.code = `QA_GATE_DETOUR_${code}`;
  error.diagnostic = diagnostic;
  throw error;
}

export function requireDetourRuntimePlan({ plan, artifact, browser }) {
  requireProof(plan?.target?.id === 'gate/detour-spread/runtime'
    && plan.target.protocolId === 'gate_detour_runtime' && plan.target.environmentId === 'ephemeral'
    && plan.mode === 'agent' && artifact?.id === 'dev_extension' && artifact.releaseProfile === 'dev'
    && browser?.processOwnership === 'owned' && plan.browserExecution?.processOwnership === 'owned'
    && plan.browserExecution.osFocus === 'never'
    && plan.protocolOptions?.fixturePolicy === 'owned_ephemeral_detour_selection', 'DISPOSABLE_DEV_REQUIRED');
  return true;
}

export function requireDetourRuntimeSurface({ inspection, document, session, presentation, protectedTabs }) {
  requireProof(inspection?.document?.href === presentation.gatePageUrl
    && inspection.tab?.url === presentation.gatePageUrl && inspection.target?.url === presentation.gatePageUrl
    && inspection.document.gateKind === 'detourSpreadGuard' && document?.topLevel === true
    && document.iframeCount === 0 && document.presentation === 'blocking'
    && document.visibilityState === 'visible' && document.submitDisabled === true
    && Array.isArray(document.visibleErrors) && document.visibleErrors.length === 0
    && session?.sessionId === presentation.sessionId && session.gateKind === 'detourSpreadGuard'
    && session.tabId === presentation.sessionCommit.tabId && session.status === 'pending'
    && session.metrics?.detourEnabled === true && session.metrics.maxProtectedTabs === 1
    && typeof session.metrics.gateDocumentId === 'string' && session.metrics.gateDocumentId.length > 0
    && session.protectedTabs?.length === 2 && session.metrics.protectedTabCount === 2
    && protectedTabs.every(expected => session.protectedTabs.some(actual => actual.tabId === expected.tabId && actual.url === expected.url)),
  'FULLPAGE_SURFACE_INVALID', { inspection, document, session });
  return true;
}

export function requireDetourTutorialUnchanged(before, after) {
  requireProof(before === false && after === false, 'EXTERNAL_CLOSE_COMPLETED_TUTORIAL', { before, after });
  return true;
}

export function requireDetourRuntimeComplete(steps) {
  requireProof(Array.isArray(steps) && steps.length === DETOUR_RUNTIME_QA_STEPS.length
    && steps.every((step, index) => step.id === DETOUR_RUNTIME_QA_STEPS[index] && step.status === 'PASS'), 'INCOMPLETE');
  return true;
}

export function buildDetourRuntimeResult(report, reportPath) {
  requireDetourRuntimeComplete(report.steps);
  return { status: QA_RUN_STATUSES.PASS, protocolId: 'gate_detour_runtime',
    verdictScope: 'fullpage_detour_selection_and_external_resume', buildId: report.buildId,
    checkCount: report.steps.length, passedCheckCount: report.steps.length, reportPath };
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal }) {
  requireDetourRuntimePlan({ plan, artifact, browser });
  const startedAt = Date.now(), reportPath = path.join(attachmentsDir, 'gate-detour-runtime.json');
  const report = { schemaVersion: 1, buildId: artifact.buildId, browserStarts: 0, specimens: null,
    scope: { fixture: 'owned_disposable_profile', admission: 'direct_dev_presentation_canonical_controller',
      settings: 'canonical_commands', inventory: 'real_global_protected_tabs', rawStorage: false,
      input: 'native_pointer', foregroundDetector: 'not_exercised',
      decisionHistoryPersistence: 'unit_covered_no_canonical_runtime_read',
      tutorialPersistence: 'authorized_gate_session_read_after_external_resume',
      excludes: ['foreground_entry_detector', 'native_permission_prompt', 'current_tab_selected_close', 'multiwindow', 'incognito'] },
    steps: DETOUR_RUNTIME_QA_STEPS.map(id => ({ id, status: 'NOT_RUN' })) };
  const writeReport = () => fs.writeFile(reportPath, `${JSON.stringify({ ...report, durationMs: Date.now() - startedAt }, null, 2)}\n`);
  registerCleanup('gate_detour_evidence', async () => { await writeReport(); return { reportPath }; });
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (![DETOUR_RUNTIME_QA_HOST, SAFE_HOST].includes(url.hostname)) { response.writeHead(403); response.end(); return; }
    const title = url.pathname.startsWith('/current') ? 'Detour current' : url.pathname.startsWith('/external') ? 'Detour external' : 'Detour sibling';
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(`<!doctype html><meta charset="utf-8"><title>${title}</title><p>Run-owned inert Detour fixture</p>`);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  registerCleanup('gate_detour_fixture_server', () => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve({ closed: true })); server.closeAllConnections();
  }));
  const url = (host, pathname) => `http://${host}:${server.address().port}${pathname}`;
  const originalUrl = url(DETOUR_RUNTIME_QA_HOST, '/current?exact=1#return');
  const externalUrl = url(DETOUR_RUNTIME_QA_HOST, '/external');
  const siblingUrl = url(DETOUR_RUNTIME_QA_HOST, '/sibling');
  const temporaryManifest = normalizeChromiumHarnessTemporaryManifest({ requiredPermissions: ['scripting'],
    requiredHostPermissions: [`http://${DETOUR_RUNTIME_QA_HOST}/*`] });
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment, displayReceipt: browser.display,
    renderingRequirement: plan.browserExecution.renderingRequirement, temporaryManifest, keepTemp: false,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, tempPrefix: 'entropy-gate-detour-', recoveryJournal });
  registerCleanup('gate_detour_browser', () => harness.close());
  await harness.start(); report.browserStarts += 1;
  requireIntegratedDisposableFixtureOwner(harness);
  await reportBrowserGpuCapability(harness.gpuCapability);
  const collector = await createExtensionRuntimeCollector(harness);
  registerCleanup('gate_detour_worker_diagnostics', () => collector.dispose());
  const send = request => sendTrustedRuntimeMessage(harness, request);
  const settings = async items => requireConsumptionQaSettingsAcknowledgement(await send({
    action: MESSAGE_ACTIONS.SET_SETTINGS, items, waitForPropagation: true }), items);
  async function until(label, read, accept, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    let value;
    do { signal?.throwIfAborted(); value = await read(); if (accept(value)) return value; await sleep(100); }
    while (Date.now() < deadline);
    requireProof(false, 'TIMEOUT', { label, value });
  }
  async function step(id, work) {
    const entry = report.steps.find(item => item.id === id), beganAt = Date.now();
    entry.status = 'RUNNING'; await evidence.event('QA_GATE_DETOUR_STEP_STARTED', { id });
    try { entry.result = await work(); entry.status = 'PASS'; }
    catch (error) { entry.status = 'FAIL'; entry.error = { code: error.code, message: error.message, diagnostic: error.diagnostic }; throw error; }
    finally { entry.durationMs = Date.now() - beganAt; await writeReport(); await evidence.event('QA_GATE_DETOUR_STEP_FINISHED', entry); }
    return entry.result;
  }
  let current, external, sibling, firstTutorial, externalReturnedAt;
  const readSurface = () => evaluate(harness.cdp, current.sessionId, `({ topLevel: window.top === window,
    iframeCount: document.querySelectorAll('iframe').length,
    presentation: document.querySelector('.gate-page')?.dataset.presentation,
    visibilityState: document.visibilityState,
    submitDisabled: document.querySelector('.zen-pruning-action__button')?.disabled,
    visibleErrors: [...document.querySelectorAll('[role="alert"], .gate-predator-rail__error')]
      .filter(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden')
      .map(node => node.textContent) })`);
  async function present(protectedPage, protectedUrl, captureName) {
    const protectedTabs = [{ tabId: current.tabId, url: originalUrl }, { tabId: protectedPage.tabId, url: protectedUrl }];
    const presentation = await sendGateAutomation(harness, { action: GATE_QA_AUTOMATION_ACTIONS.PRESENT_DETOUR_SPREAD,
      targetTabId: current.tabId, payload: { maxProtectedTabs: 1, protectedTabs } });
    await until('fullpage_surface', () => inspectGatePage(harness, current), value => value.document?.gateKind === 'detourSpreadGuard'
      && value.document.href === presentation.gatePageUrl && value.tab?.url === presentation.gatePageUrl);
    const authorized = await readAuthorizedGateSession(harness, current, presentation.sessionId);
    requireProof(!authorized.error && authorized.response?.success === true, 'AUTHORIZED_SESSION_REQUIRED', authorized);
    const session = authorized.response.session;
    // Confirm the real visible Gate has reached durable shown admission before
    // an external tab close can attempt the ordinary admitted continuation.
    await until('shown_admission', async () => (await readAuthorizedGateSession(harness, current, presentation.sessionId)).response,
      value => value?.success === true && value.session?.metrics?.admissionPresentedAt > 0);
    // Include a real periodic refresh before accepting the initial surface.
    await sleep(1100);
    const document = await readSurface(), inspection = await inspectGatePage(harness, current);
    requireDetourRuntimeSurface({ inspection, document, session, presentation, protectedTabs });
    const screenshotPath = path.join(attachmentsDir, `${captureName}.png`);
    const screenshot = await harness.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, current.sessionId);
    requireProof(typeof screenshot.data === 'string' && screenshot.data.length > 0, 'SCREENSHOT_REQUIRED');
    await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    return { presentation, session, inspection, document, screenshotPath };
  }
  async function returned(closedPage) {
    const targets = await until('exact_original_resume', () => getTargetInfos(harness.cdp), value =>
      value.some(target => target.targetId === current.targetId && target.url === originalUrl)
      && !value.some(target => target.targetId === closedPage.targetId));
    const tab = await until('returned_document_complete', async () => ({
      tab: await harness.resolveTabForPage(current),
      document: await evaluate(harness.cdp, current.sessionId, `({ href: location.href, readyState: document.readyState })`),
    }), value => value.tab?.url === originalUrl && value.tab.status === 'complete'
      && value.document.href === originalUrl && value.document.readyState === 'complete').then(value => value.tab);
    requireProof(tab.id === current.tabId && tab.url === originalUrl, 'EXACT_ORIGINAL_RETURN_REQUIRED', tab);
    return { tabId: tab.id, url: tab.url, closedTargetAbsent: !targets.some(target => target.targetId === closedPage.targetId) };
  }
  async function clickNative(expression) {
    const point = await evaluate(harness.cdp, current.sessionId, `(() => { const node = ${expression};
      if (!node || node.disabled) throw new Error('QA_GATE_DETOUR_ACTION_UNAVAILABLE');
      const rect = node.getBoundingClientRect(); const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      if (!(rect.width > 0 && rect.height > 0) || !node.contains(document.elementFromPoint(x, y))) throw new Error('QA_GATE_DETOUR_ACTION_NOT_HITTABLE');
      return { x, y }; })()`);
    for (const type of ['mousePressed', 'mouseReleased']) await harness.cdp.send('Input.dispatchMouseEvent', {
      type, ...point, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1,
    }, current.sessionId);
  }
  try {
    await step('owned_fixture', async () => {
      const vault = await ensureQaSecurityVaultReady(harness, { passphrase: randomBytes(32).toString('base64url') });
      await evidence.event('QA_GATE_DETOUR_SECURITY_VAULT_READY', vault);
      const expectedBuild = { buildId: artifact.buildId, releaseProfile: artifact.releaseProfile };
      const identity = await requireEntropyAttachedArtifactRuntimeIdentity(harness, { artifactIdentity: {
        artifactId: artifact.id, inputDigest: artifact.inputDigest, ...expectedBuild }, temporaryManifest, trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH });
      await requireEntropyTrackingRuntimeReadiness(harness, { expectedBuild });
      const filters = structuredClone(CONFIG_DEFAULT_FILTER_SETTINGS);
      for (const filter of Object.values(filters)) filter.isActive = false;
      const gateConfig = { ...structuredClone(DEFAULT_GATE_CONFIG), detourSpreadGuard: { enabled: true, maxProtectedTabs: 1 } };
      await settings({ tabManagement: { groupProtectedTabs: false }, filteringMode: 'blocklist', permissionMode: 'selective', rulesMode: 'managed',
        filterSettings: filters, gateConfig: structuredClone(DEFAULT_GATE_CONFIG), nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS),
        dataCollectionMode: 'off', precisionInsightsMode: 'off', insightsMode: 'off', insightsConsent: 'later',
        historyCleanupForBlocked: false, concealBlockedBookmarks: false, tabEvaporationForBlocked: false,
        artifactControlState: structuredClone(DEFAULT_ARTIFACT_CONTROL_STATE) });
      for (const [type, confirmExactMove] of [['allowed', false], ['blocked', true]]) {
        const reply = requireSettingsRuntimeCommandAcknowledgement(MESSAGE_ACTIONS.UPSERT_SITE_RULE,
          await send({ action: MESSAGE_ACTIONS.UPSERT_SITE_RULE, domain: DETOUR_RUNTIME_QA_HOST, type, confirmExactMove, waitForPropagation: true }));
        requireProof(reply.propagation?.status === 'succeeded', 'SITE_RULE_PROPAGATION_REQUIRED', reply);
      }
      current = await harness.openPage(originalUrl, { active: true });
      external = await harness.openPage(externalUrl, { active: false, sameWindowAs: current });
      sibling = await harness.openPage(url(SAFE_HOST, '/parked'), { active: false, sameWindowAs: current });
      requireProof([current, external, sibling].every(page => Number.isInteger(page.tabId)), 'OWNED_TAB_IDS_REQUIRED');
      report.specimens = { current: { tabId: current.tabId, targetId: current.targetId, url: originalUrl },
        external: { tabId: external.tabId, targetId: external.targetId, url: externalUrl },
        sibling: { tabId: sibling.tabId, targetId: sibling.targetId, parkedUrl: url(SAFE_HOST, '/parked'), protectedUrl: siblingUrl } };
      // Enable the policy only after these bounded fixture navigations. This
      // target measures canonical presentation/decisions, not entry detection.
      await settings({ gateConfig });
      return { identity, gateConfig, specimens: report.specimens };
    });
    await step('external_budget_resume', async () => {
      const shown = await present(external, externalUrl, 'gate-detour-runtime');
      firstTutorial = shown.session.pruningTutorialCompleted;
      requireProof(firstTutorial === false, 'FRESH_TUTORIAL_REQUIRED');
      await harness.closePage(external);
      const outcome = await returned(external);
      externalReturnedAt = Date.now();
      return { shown, return: outcome, decisionSubmitted: false };
    });
    let second;
    await step('tutorial_unchanged', async () => {
      await evidence.event('QA_GATE_DETOUR_RECOVERY_WAIT_STARTED', { recoveryMs: INTERVENTION_RECOVERY_MS });
      while (Date.now() - externalReturnedAt < INTERVENTION_RECOVERY_MS) {
        signal?.throwIfAborted();
        await sleep(Math.min(1000, INTERVENTION_RECOVERY_MS - (Date.now() - externalReturnedAt)));
      }
      const recoveryWaitMs = Date.now() - externalReturnedAt;
      await evidence.event('QA_GATE_DETOUR_RECOVERY_WAIT_FINISHED', { recoveryWaitMs });
      await harness.navigatePage(sibling, siblingUrl);
      second = await present(sibling, siblingUrl, 'gate-detour-selection');
      requireDetourTutorialUnchanged(firstTutorial, second.session.pruningTutorialCompleted);
      return { sessionId: second.presentation.sessionId, before: firstTutorial, after: second.session.pruningTutorialCompleted, inventoryCount: second.session.protectedTabs.length, recoveryWaitMs };
    });
    await step('selected_close_resume', async () => {
      const document = await readSurface();
      requireProof(document.visibleErrors.length === 0, 'VISIBLE_ERROR_BEFORE_SELECTION', document);
      await clickNative(`[...document.querySelectorAll('.gate-tab-chip')].find(node => node.dataset.current === '0' && node.querySelector('.gate-tab-chip__title')?.textContent === 'Detour sibling')`);
      await until('selection_ready', () => evaluate(harness.cdp, current.sessionId,
        `({ disabled: document.querySelector('.zen-pruning-action__button')?.disabled })`), value => value.disabled === false);
      await clickNative(`document.querySelector('.zen-pruning-action__button')`);
      const outcome = await returned(sibling);
      await harness.releasePageTarget(sibling);
      return { sessionId: second.presentation.sessionId, selectedTabIds: [sibling.tabId], currentKept: true, return: outcome };
    });
    const result = buildDetourRuntimeResult(report, reportPath);
    report.status = result.status; await writeReport();
    return result;
  } catch (error) {
    report.status = 'FAIL'; report.error = { code: error.code, message: error.message, diagnostic: error.diagnostic };
    report.extensionRuntime = collector.snapshot(); report.chromeStderr = harness.chromeStderr.slice(-10);
    if (current) report.page = await inspectGatePage(harness, current);
    await writeReport(); await evidence.event('QA_GATE_DETOUR_FAILURE', { code: error.code, message: error.message, reportPath });
    throw error;
  }
}
