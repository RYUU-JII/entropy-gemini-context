import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ExtensionChromiumHarness, evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { allowsQaOwnedInitialWindowPresentation } from '../contracts/qaInitialWindowFocusPolicy.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/contracts/messageTypes.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../src/domains/settings/config/index.js';
import { SETTINGS_PROPAGATION_QA_ACTIONS, requireSettingsPropagationQaSeal,
  requireSettingsPropagationQaFixtureResponse } from '../../../src/domains/settings/config/settingsPropagationQaFixtureContract.dev.js';
import { sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { requireEntropyAttachedArtifactRuntimeIdentity, requireEntropyTrackingRuntimeReadiness } from './attachOnlyActivePageAdapter.mjs';
import { INTEGRATED_FIRST_USE_OFF_POLICY, isIntegratedControlReady,
  observeIntegratedFailureWindows, prepareIntegratedFeatureAccess,
  buildIntegratedArtifactChoiceContract, openIntegratedArtifactControl } from './integratedProtectionQaProtocol.mjs';
import { readSettingsArtifactGalleryNavigation, selectSettingsArtifactGalleryFamily,
  proveSettingsArtifactPathReachability, inspectSettingsArtifactPathGeometry,
  matchesSettingsArtifactPathGeometry } from './settingsArtifactGalleryNavigation.mjs';

export const SETTINGS_PROPAGATION_STEPS = Object.freeze([
  'delayed_completion', 'retained_failure_recovery', 'worker_replacement_recovery', 'superseded_intent',
]);
const MINIMUM_HOLD_MS = 16_000;
const MAXIMUM_DURATION_MS = 240_000;
const FILTER_ROW = `document.querySelector('[data-artifact-control-child-key="blur"]')`;
const choice = enabled => buildIntegratedArtifactChoiceContract('blur', enabled ? 'on' : 'off').choice;
const SETTINGS_KEYS = ['filterSettings', 'tabEvaporationForBlocked', 'tabEvaporationTimeoutMinutes'];

function requireProof(condition, code, diagnostic) {
  if (condition) return;
  const error = new Error(`QA_SETTINGS_PROPAGATION_${code}`);
  error.diagnostic = diagnostic;
  throw error;
}

export function requireSettingsPropagationComplete(steps) {
  requireProof(Array.isArray(steps) && steps.length === SETTINGS_PROPAGATION_STEPS.length
    && steps.every((step, index) => step.id === SETTINGS_PROPAGATION_STEPS[index] && step.status === 'PASS'), 'INCOMPLETE');
  return true;
}

export function buildSettingsPropagationTrustedPageSource(nonce, runId) {
  requireSettingsPropagationQaSeal({ nonce, runId, profileKind: 'ephemeral' });
  return `<!doctype html><meta charset="utf-8"><meta name="entropy-settings-propagation-qa" content="${nonce}">`
    + `<meta name="entropy-settings-propagation-qa-profile" content="ephemeral">`
    + `<meta name="entropy-settings-propagation-qa-run" content="${runId}"><title>Settings propagation QA</title>`;
}

export function requireSettingsPropagationFixtureReply(reply, request) {
  requireSettingsPropagationQaFixtureResponse(reply, request);
  const lease = reply?.lease;
  requireProof(reply.ok === true
    && (request.action !== SETTINGS_PROPAGATION_QA_ACTIONS.ARM || lease.mode === request.payload.mode),
  'FIXTURE_REPLY_INVALID', { action: request.action, ok: reply?.ok, error: reply?.error });
  return lease;
}

export function matchesSettingsPropagationUi(ui, lease, status) {
  return Boolean(Number.isSafeInteger(lease?.taskId) && lease.taskId > 0
    && ['applying', 'apply_error'].includes(status)
    && ui?.documentVisible === true && ui.bootShellPresent === false && ui.overlayCount === 0
    && ui.control?.selected === true && ui.control.pending === false && Array.isArray(ui.control.errors) && ui.control.errors.length === 0
    && ui.operations?.length === 1 && ui.operations[0].channel === 'protocol'
    && ui.operations[0].status === status && ui.operations[0].taskId === lease.taskId
    && ui.operations[0].commitVersion === lease.commitVersion && ui.operations[0].normalLayout === true
    && ui.operations[0].visible === true && ui.operations[0].busy === (status === 'applying')
    && ui.operations[0].retryDisabled === (status === 'applying'));
}

export function matchesSettingsPropagationSettled(ui) {
  return Boolean(ui?.documentVisible === true && ui.bootShellPresent === false && ui.overlayCount === 0
    && ui.operations?.length === 0 && ui.control?.selected === true
    && ui.control.pending === false && Array.isArray(ui.control.errors) && ui.control.errors.length === 0);
}

export async function preserveSettingsPropagationFailure(run, capture) {
  try { return await run(); }
  catch (error) {
    try { await capture(error); }
    catch (captureError) {
      error.diagnostic = { ...error.diagnostic, failureCaptureCode: typeof captureError?.code === 'string'
        ? captureError.code.slice(0, 160) : 'QA_SETTINGS_PROPAGATION_FAILURE_CAPTURE_FAILED' };
    }
    throw error;
  }
}

// The driver supplies existing owned UI/runtime actions. No saved value is
// replayed after the single trusted choice; recovery uses the actual Retry UI.
export async function runSettingsPropagationScenario(id, driver) {
  requireProof(SETTINGS_PROPAGATION_STEPS.includes(id), 'SCENARIO_INVALID');
  const before = await driver.readSettings();
  const enabled = !before.filterSettings.blur.isActive;
  const expected = structuredClone(before);
  expected.filterSettings.blur.isActive = enabled;
  const armed = await driver.arm(id === 'retained_failure_recovery' ? 'fail' : 'hold');
  await driver.choose(enabled);
  const bound = await driver.waitBound(armed);
  requireProof(bound.taskId > 0 && bound.commitVersion >= 0 && bound.changedKeys.includes('filterSettings'), 'TASK_NOT_BOUND');
  const requireState = (state, settings, status = null) => {
    requireProof(isDeepStrictEqual(state?.settings, settings)
      && (status ? matchesSettingsPropagationUi(state.ui, bound, status) : matchesSettingsPropagationSettled(state.ui)),
    'CANONICAL_UI_EVIDENCE_REQUIRED', state);
    return state;
  };
  if (id === 'retained_failure_recovery') {
    const failure = requireState(await driver.waitInline(bound, 'apply_error', enabled, expected), expected, 'apply_error');
    const exhausted = await driver.readLease(bound);
    requireProof(exhausted.attemptCount === 4 && exhausted.status === 'failing', 'RETRY_BUDGET_NOT_EXHAUSTED', exhausted);
    await driver.release(bound);
    await driver.retry();
    const recovered = requireState(await driver.waitSettled(enabled, expected), expected);
    return { taskId: bound.taskId, commitVersion: bound.commitVersion, attemptCount: exhausted.attemptCount,
      savedSettingRetained: true, failure, recovered, recovery: 'actual_retry_control' };
  }
  if (id === 'superseded_intent') {
    await driver.choose(!enabled);
    const superseded = await driver.waitSuperseded(bound);
    requireProof(superseded.status === 'superseded', 'SUPERSESSION_NOT_PROVEN', superseded);
    const newer = requireState(await driver.waitSettled(!enabled, before), before);
    await driver.release(bound);
    const afterLateRelease = requireState(await driver.waitSettled(!enabled, before), before);
    return { taskId: bound.taskId, commitVersion: bound.commitVersion, superseded: true,
      newer, afterLateRelease, canonicalLastIntentMatched: true };
  }
  const held = await driver.waitHeld(bound, enabled, expected);
  requireProof(held.elapsedMs >= MINIMUM_HOLD_MS && held.lease.status === 'holding'
    && held.lease.taskId === bound.taskId && held.lease.commitVersion === bound.commitVersion,
  'REAL_DELAY_NOT_PROVEN', { elapsedMs: held.elapsedMs, status: held.lease?.status });
  requireState(held, expected, 'applying');
  if (id === 'delayed_completion') {
    const released = await driver.release(bound);
    requireProof(released.taskId === bound.taskId && released.commitVersion === bound.commitVersion, 'RELEASE_TASK_CHANGED');
    const completed = requireState(await driver.waitSettled(enabled, expected), expected);
    return { taskId: bound.taskId, commitVersion: bound.commitVersion, elapsedMs: held.elapsedMs,
      held: held.ui, completed, completion: 'same_live_task_wait' };
  }
  const revival = await driver.replaceWorker();
  requireProof(revival.previousTargetId !== revival.revivedTargetId && revival.buildMatched === true, 'FRESH_WORKER_REQUIRED');
  const observationFailure = requireState(await driver.waitInline(bound, 'apply_error', enabled, expected), expected, 'apply_error');
  await driver.retry();
  const recovered = requireState(await driver.waitSettled(enabled, expected), expected);
  return { taskId: bound.taskId, commitVersion: bound.commitVersion, elapsedMs: held.elapsedMs,
    revival, observationFailure, recovered, savedSettingRetained: true, recovery: 'actual_retry_control' };
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal, requestInitialOwnedWindowPresentation }) {
  requireProof(plan.target.id === 'settings/propagation' && plan.target.environmentId === 'ephemeral'
    && artifact.id === 'dev_extension' && artifact.releaseProfile === 'dev' && browser.processOwnership === 'owned'
    && plan.parameters.theme === 'zen', 'OWNED_DEV_REQUIRED');
  const startedAt = Date.now(), deadline = startedAt + MAXIMUM_DURATION_MS;
  const nonce = randomUUID(), seal = { nonce, profileKind: 'ephemeral', runId: plan.runId };
  const report = { schemaVersion: 1, buildId: artifact.buildId, theme: 'zen', browserStarts: 0,
    scope: 'actual_settings_propagation_lifetime', bootstrap: { status: 'RUNNING', phase: 'start' },
    steps: SETTINGS_PROPAGATION_STEPS.map(id => ({ id, status: 'NOT_RUN' })) };
  const reportPath = path.join(attachmentsDir, 'settings-propagation.json');
  const writeReport = () => fs.writeFile(reportPath, `${JSON.stringify({ ...report, durationMs: Date.now() - startedAt }, null, 2)}\n`);
  registerCleanup('settings_propagation_evidence', async () => { await writeReport(); return { reportPath }; });
  const temporaryManifest = { requiredPermissions: [], requiredHostPermissions: [] };
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path, rootDir: plan.rootDir,
    headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    capacityReservationMode: plan.browserCapacityMode,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment,
    displayReceipt: browser.display, renderingRequirement: plan.browserExecution.renderingRequirement,
    keepTemp: false, temporaryManifest, trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    trustedPageSource: buildSettingsPropagationTrustedPageSource(nonce, plan.runId),
    tempPrefix: 'entropy-settings-propagation-', recoveryJournal });
  registerCleanup('settings_propagation_browser', () => harness.close());
  let currentLease = null;
  let page = null;
  const checkOpen = () => { signal?.throwIfAborted(); requireProof(Date.now() < deadline, 'DURATION_EXCEEDED'); };
  const send = request => { checkOpen(); return sendTrustedRuntimeMessage(harness, request); };
  async function fixture(action, payload) {
    const request = { action, requestId: randomUUID(), payload: { ...seal, ...payload } };
    const lease = requireSettingsPropagationFixtureReply(await send(request), request);
    currentLease = lease;
    return lease;
  }
  registerCleanup('settings_propagation_fault', async () => {
    if (!currentLease || ['released', 'superseded', 'expired'].includes(currentLease.status)) return { action: 'not_armed' };
    const request = { action: SETTINGS_PROPAGATION_QA_ACTIONS.RELEASE, requestId: randomUUID(),
      payload: { ...seal, leaseId: currentLease.leaseId } };
    const lease = requireSettingsPropagationFixtureReply(await sendTrustedRuntimeMessage(harness, request), request);
    currentLease = lease;
    return { action: 'released', taskId: lease.taskId };
  });
  return preserveSettingsPropagationFailure(async () => {
  await harness.start(); report.browserStarts++;
  report.bootstrap.phase = 'runtime_identity';
  report.reloadSetup = await harness.prepareDisposableExtensionReload();
  await reportBrowserGpuCapability(harness.gpuCapability);
  const artifactIdentity = { artifactId: artifact.id, buildId: artifact.buildId,
    releaseProfile: artifact.releaseProfile, inputDigest: artifact.inputDigest };
  const proveIdentity = async () => {
    const identity = await requireEntropyAttachedArtifactRuntimeIdentity(harness, {
      artifactIdentity, temporaryManifest, trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    });
    await requireEntropyTrackingRuntimeReadiness(harness, { expectedBuild: {
      buildId: artifact.buildId, releaseProfile: artifact.releaseProfile,
    } });
    return identity;
  };
  await proveIdentity();
  report.bootstrap.phase = 'canonical_baseline';
  const filters = Object.fromEntries(Object.entries(structuredClone(CONFIG_DEFAULT_FILTER_SETTINGS))
    .map(([key, value]) => [key, { ...value, isActive: false }]));
  const baseline = { 'app-theme': 'zen', ...structuredClone(INTEGRATED_FIRST_USE_OFF_POLICY),
    filterSettings: filters, tabEvaporationForBlocked: false, tabEvaporationTimeoutMinutes: 5 };
  requireConsumptionQaSettingsAcknowledgement(await send({ action: MESSAGE_ACTIONS.SET_SETTINGS,
    items: baseline, waitForPropagation: true }), baseline);
  report.featureAccess = await prepareIntegratedFeatureAccess(send);
  report.bootstrap.phase = 'dashboard_open';
  page = await harness.openPage('about:blank', { active: true });
  await harness.navigatePage(page, `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=tools`);
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(page);
  if (allowsQaOwnedInitialWindowPresentation(plan)) {
    requireProof(typeof requestInitialOwnedWindowPresentation === 'function', 'INITIAL_PRESENTATION_OWNER_REQUIRED');
    report.initialPresentation = await requestInitialOwnedWindowPresentation({ child: harness.chrome,
      cdp: harness.cdp, targetId: page.targetId, tabId: page.tabId });
  }
  const dom = expression => evaluate(harness.cdp, page.sessionId, expression);
  async function screenshot(name) {
    const capture = await harness.cdp.send('Page.captureScreenshot', { format: 'png' }, page.sessionId);
    const filename = `${name}.png`;
    await fs.writeFile(path.join(attachmentsDir, filename), Buffer.from(capture.data, 'base64'));
    return filename;
  }
  async function until(label, read, accept, timeoutMs = 25_000) {
    const end = Math.min(deadline, Date.now() + timeoutMs);
    let value;
    do { checkOpen(); value = await read(); if (accept(value)) return value; await sleep(100); } while (Date.now() < end);
    requireProof(false, `TIMEOUT:${label}`, value);
  }
  async function control(expression) {
    return dom(`(() => { const node=(${expression}); const state={present:Boolean(node),
      requestedControl:${JSON.stringify(expression)}, visibilityState:document.visibilityState,
      bootShellPresent:Boolean(document.getElementById('entropy-dashboard-boot-shell'))};
      if(!node)return state; node.scrollIntoView({block:'center',behavior:'instant'});
      const r=node.getBoundingClientRect(),style=getComputedStyle(node),point={x:r.x+r.width/2,y:r.y+r.height/2};
      const hit=document.elementFromPoint(point.x,point.y);
      const describe=item=>item?{tag:item.tagName,role:item.getAttribute('role'),
        id:item.id.slice(0,128),class:(item.getAttribute('class')||'').slice(0,256),
        label:(item.getAttribute('aria-label')||'').slice(0,160)}:null;
      return {...state,point,rect:{x:r.x,y:r.y,width:r.width,height:r.height},
        activeElement:describe(document.activeElement),hitTarget:describe(hit),
        inert:Boolean(node.closest('[inert]')),disabled:node.disabled===true||node.getAttribute('aria-disabled')==='true',
        visible:document.visibilityState==='visible'&&r.width>0&&r.height>0&&style.visibility==='visible'&&Number(style.opacity)>0,
        hit:node.contains(hit)}; })()`);
  }
  async function click(expression) {
    const state = await until('trusted_control', () => control(expression), isIntegratedControlReady, 45_000);
    checkOpen();
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...state.point }, page.sessionId);
    for (const type of ['mousePressed', 'mouseReleased']) await harness.cdp.send('Input.dispatchMouseEvent', {
      type, ...state.point, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1,
    }, page.sessionId);
  }
  // Fresh Zen presentation legitimately selects Main. Navigate through the
  // public control after boot/focus release instead of treating the URL as UI.
  report.bootstrap.phase = 'tools_navigation';
  await click(`document.querySelector('[data-tab="tools"]')`);
  report.bootstrap.phase = 'navigation_geometry';
  report.navigationFit = await until('navigation_fit', () => dom(`(${inspectSettingsArtifactPathGeometry.toString()})()`),
    matchesSettingsArtifactPathGeometry, 45_000);
  const galleryDriver = { until, click: (_page, expression) => click(expression),
    readNavigation: () => readSettingsArtifactGalleryNavigation(dom) };
  report.navigationReachability = await proveSettingsArtifactPathReachability(galleryDriver, page);
  report.bootstrap.phase = 'lens_selection';
  await selectSettingsArtifactGalleryFamily(galleryDriver, page, 'lens');
  const artifactControlDriver = { until, click: (_page, expression) => click(expression),
    readDom: (_page, expression) => dom(expression) };
  await openIntegratedArtifactControl(artifactControlDriver, page, 'blur');
  report.bootstrap = { status: 'PASS', phase: 'complete' };
  async function readSettings() {
    const reply = await send({ action: MESSAGE_ACTIONS.GET_SETTINGS, keys: SETTINGS_KEYS, defaults: {} });
    requireProof(reply?.success === true && SETTINGS_KEYS.every(key => Object.hasOwn(reply.settings, key)), 'CANONICAL_READ_FAILED');
    return reply.settings;
  }
  async function readUi(enabled) {
    return dom(`(() => { const requestedControl=(${buildIntegratedArtifactChoiceContract('blur', enabled ? 'on' : 'off').read});
      const isOverlay=item=>{for(let p=item;p;p=p.parentElement){const style=getComputedStyle(p);
        if(style.position==='fixed'&&style.pointerEvents==='none')return true;}return false;};
      const operations=Array.from(document.querySelectorAll('[data-settings-command-feedback] [data-settings-command-status]')).map(item=>{
        const r=item.getBoundingClientRect(),retry=item.querySelector('[data-settings-command-retry]');
        return {channel:item.dataset.settingsCommandChannel,status:item.dataset.settingsCommandStatus,
          commandId:Number(item.dataset.settingsCommandId),taskId:Number(item.dataset.settingsCommandTaskId),
          commitVersion:Number(item.dataset.settingsCommandCommitVersion),busy:item.getAttribute('aria-busy')==='true',
          retryDisabled:retry?.disabled===true,normalLayout:![item,item.closest('[data-settings-command-feedback]')]
            .some(node=>['fixed','sticky'].includes(getComputedStyle(node).position)),
          visible:r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth
            &&getComputedStyle(item).visibility==='visible'&&Number(getComputedStyle(item).opacity)>0};});
      const overlayCount=Array.from(document.querySelectorAll('[role="alert"][aria-live],[role="status"][aria-live]'))
        .filter(item=>!item.closest('[data-settings-command-feedback]')&&isOverlay(item)).length;
      return {documentVisible:document.visibilityState==='visible',bootShellPresent:Boolean(document.getElementById('entropy-dashboard-boot-shell')),
        operations,overlayCount,control:requestedControl};})()`);
  }
  async function readState(enabled) { return { ui: await readUi(enabled), settings: await readSettings() }; }
  const waitSettled = (enabled, expected) => until('terminal_settlement', () => readState(enabled), state =>
    matchesSettingsPropagationSettled(state.ui) && isDeepStrictEqual(state.settings, expected));
  const driver = {
    readSettings, choose: async enabled => {
      await openIntegratedArtifactControl(artifactControlDriver, page, 'blur');
      return click(choice(enabled));
    },
    arm: mode => fixture(SETTINGS_PROPAGATION_QA_ACTIONS.ARM, { mode, keys: ['filterSettings'] }),
    readLease: lease => fixture(SETTINGS_PROPAGATION_QA_ACTIONS.READ, { leaseId: lease.leaseId }),
    release: lease => fixture(SETTINGS_PROPAGATION_QA_ACTIONS.RELEASE, { leaseId: lease.leaseId }),
    waitBound: lease => until('bound_task', () => fixture(SETTINGS_PROPAGATION_QA_ACTIONS.READ, { leaseId: lease.leaseId }), value =>
      value.taskId > 0 && ['holding', 'failing'].includes(value.status)),
    waitInline: async (lease, status, enabled, expected) => {
      const state = await until(`inline_${status}`, () => readState(enabled), value =>
        matchesSettingsPropagationUi(value.ui, lease, status) && isDeepStrictEqual(value.settings, expected));
      return { ...state, screenshot: await screenshot(`settings-propagation-inline-${lease.taskId}`) };
    },
    waitSettled,
    retry: () => click(`document.querySelector('[data-settings-command-channel="protocol"][data-settings-command-status="apply_error"] [data-settings-command-retry]')`),
    waitHeld: async (lease, enabled, expected) => {
      const boundAt = Date.now();
      const held = await until('live_task_past_timeout', async () => ({ lease: await driver.readLease(lease),
        ...(await readState(enabled)), elapsedMs: Date.now() - boundAt }), state => state.elapsedMs >= MINIMUM_HOLD_MS
        && state.lease.status === 'holding' && matchesSettingsPropagationUi(state.ui, lease, 'applying')
        && isDeepStrictEqual(state.settings, expected), 22_000);
      return { ...held, ui: { ...held.ui, screenshot: await screenshot(`settings-propagation-applying-${lease.taskId}`) } };
    },
    waitSuperseded: lease => until('superseded_task', () => driver.readLease(lease), value => value.status === 'superseded'),
    replaceWorker: async () => {
      const stopped = await harness.stopServiceWorker(); currentLease = null;
      await readSettings();
      const revived = await harness.waitForServiceWorker({ previousTargetId: stopped.targetId });
      const identity = await proveIdentity();
      return { previousTargetId: stopped.targetId, revivedTargetId: revived.targetId, buildMatched: identity.buildId === artifact.buildId };
    },
  };
    for (const id of SETTINGS_PROPAGATION_STEPS) {
      const entry = report.steps.find(step => step.id === id), stageStart = Date.now();
      entry.status = 'RUNNING';
      await evidence.event('QA_SETTINGS_PROPAGATION_STEP_STARTED', { id });
      try {
        entry.result = await runSettingsPropagationScenario(id, driver);
        entry.screenshot = await screenshot(`settings-propagation-${id}`);
        entry.status = 'PASS';
      } catch (error) {
        entry.status = 'FAIL'; entry.error = { message: error.message, diagnostic: error.diagnostic }; throw error;
      } finally {
        entry.durationMs = Date.now() - stageStart;
        await writeReport(); await evidence.event('QA_SETTINGS_PROPAGATION_STEP_FINISHED', entry);
      }
    }
    requireSettingsPropagationComplete(report.steps);
    return { status: 'PASS', verdictScope: 'product', durationMs: Date.now() - startedAt, browserStarts: 1,
      scope: report.scope, steps: report.steps, reportPath, buildId: artifact.buildId };
  }, async (error) => {
    if (report.bootstrap.status === 'RUNNING') report.bootstrap.status = 'FAIL';
    report.failure = { message: error.message.slice(0, 256), diagnostic: error.diagnostic };
    if (page) {
    try {
      report.failureWindows = await observeIntegratedFailureWindows({ harness, pages: { dashboard: page }, recoveryJournal });
    } catch {
      report.failureWindows = { status: 'unavailable', code: 'QA_SETTINGS_FAILURE_WINDOW_OBSERVATION_FAILED', focusRequested: false };
    }
    try {
      const capture = await harness.cdp.send('Page.captureScreenshot', { format: 'png' }, page.sessionId);
      report.failureScreenshot = 'settings-propagation-failure.png';
      await fs.writeFile(path.join(attachmentsDir, report.failureScreenshot), Buffer.from(capture.data, 'base64'));
    } catch (captureError) { report.failureScreenshotError = { message: captureError.message.slice(0, 200) }; }
    try {
      report.failureUi = await evaluate(harness.cdp, page.sessionId, `(() => {
        const tools=document.getElementById('tools');
        return {visibilityState:document.visibilityState,bootShellPresent:Boolean(document.getElementById('entropy-dashboard-boot-shell')),
          toolsPresent:Boolean(tools),toolsDisplay:tools?getComputedStyle(tools).display:null,
          consentDialogPresent:Boolean(document.querySelector('[aria-labelledby="insights-consent-title"]')),
          recoverySurface:document.querySelector('[data-dashboard-profile-recovery]')?.getAttribute('data-dashboard-profile-recovery')||null,
          tabs:Array.from(document.querySelectorAll('[data-tab]')).slice(0,8).map(item=>({
            id:item.dataset.tab,selected:item.getAttribute('aria-selected'),current:item.getAttribute('aria-current'),
            disabled:item.disabled===true||item.getAttribute('aria-disabled')==='true'})),
          families:Array.from(document.querySelectorAll('[data-artifact-gallery-family-id]')).slice(0,7).map(item=>({
            id:item.dataset.artifactGalleryFamilyId,tag:item.tagName,locked:item.dataset.artifactGalleryLockedSlot==='true',
            selected:item.getAttribute('aria-current'),disabled:item.disabled===true||item.getAttribute('aria-disabled')==='true'})),
          loading:Array.from(document.querySelectorAll('[data-loading-frame],[data-testid]')).filter(item=>
            (item.getAttribute('data-testid')||'').startsWith('tools-')||item.hasAttribute('data-loading-frame')).slice(0,8)
            .map(item=>({frame:item.getAttribute('data-loading-frame'),id:item.getAttribute('data-testid')})),
          alerts:Array.from(document.querySelectorAll('[role="alert"]')).slice(0,8).map(item=>item.textContent.slice(0,240))}; })()`);
    } catch (captureError) { report.failureUiError = { message: captureError.message.slice(0, 200) }; }
    }
    await writeReport();
  });
}
