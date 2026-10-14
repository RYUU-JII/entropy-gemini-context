import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ExtensionChromiumHarness, evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { MESSAGE_ACTIONS, MESSAGE_TYPES } from '../../../src/platform/messaging/contracts/messageTypes.js';
import { CONTENT_RECEIVER_CAPABILITY_VERSION } from '../../../src/platform/messaging/contentReceiverCapability.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../src/domains/settings/config/index.js';
import { requireSettingsRuntimeCommandAcknowledgement } from '../../../src/domains/settings/config/settingsRuntimeCommandAcknowledgement.js';
import { requireBootPrewarmDashboardSnapshot } from '../../../src/apps/boot/bootPrewarmSnapshotContract.js';
import { buildOriginPatternsForDomain, createOriginPermissionMatcher, getUniqueOrigins } from '../../../src/lib/permissions.js';
import { buildSiteRuleHostCandidates } from '../../../src/lib/siteIdentity.js';
import { MAIN_PRESENTATION_PHASES } from '../../../src/themes/core/presentation/mainSceneContract.js';
import enSettings from '../../../src/i18n/locales/en/settings.js';
import koSettings from '../../../src/i18n/locales/ko/settings.js';
import { sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { requireEntropyAttachedArtifactRuntimeIdentity, requireEntropyTrackingRuntimeReadiness } from './attachOnlyActivePageAdapter.mjs';
import { createDashboardPageDiagnostics } from './dashboardCaptureDiagnostics.mjs';
import { createNativeVideoSkipFixture, NATIVE_VIDEO_SKIP_HOST } from './nativeVideoSkipFixture.mjs';
import { INTEGRATED_FIRST_USE_OFF_POLICY, completeIntegratedFirstUseOffPolicy,
  readIntegratedFirstUsePolicy, readIntegratedFirstUseUi, isIntegratedControlReady, observeIntegratedFailureWindows } from './integratedProtectionQaProtocol.mjs';

export const SETTINGS_PERMISSIONS_STEPS = Object.freeze([
  'fresh_no_host_access', 'first_use_off', 'managed_rule_baseline',
  'native_denied', 'native_approved', 'reload_proof',
]);
export const SETTINGS_PERMISSIONS_NATIVE_RESPONSE_TIMEOUT_MS = 120_000;
const MAXIMUM_DURATION_MS = 420_000;
const DOMAIN = NATIVE_VIDEO_SKIP_HOST;
const SETTINGS_KEYS = Object.freeze([
  'blockedUrls', 'allowedUrls', 'siteGoals', 'permissionMode', 'filteringMode', 'rulesMode',
  'filterSettings', 'gateConfig', 'artifactControlState', 'globalGoal', 'trackingExcludedUrls',
  'historyCleanupForBlocked', 'concealBlockedBookmarks', 'tabEvaporationForBlocked', 'tabEvaporationTimeoutMinutes',
  ...Object.keys(INTEGRATED_FIRST_USE_OFF_POLICY),
]);

function requireProof(condition, code, diagnostic) {
  if (condition) return;
  const error = new Error(`QA_SETTINGS_PERMISSIONS_${code}`);
  error.code = `QA_SETTINGS_PERMISSIONS_${code}`;
  error.diagnostic = diagnostic;
  throw error;
}

export function createSettingsPermissionsTemporaryManifest() {
  // Optional manifest ceilings are retained; neither scripting nor an origin
  // is promoted to required permissions in this disposable profile.
  return { requiredPermissions: [], requiredHostPermissions: [] };
}

export function requireSettingsPermissionsPlan({ plan, artifact, browser }) {
  requireProof(plan?.target?.id === 'settings/permissions' && plan.target.protocolId === 'settings_permissions'
    && plan.target.environmentId === 'ephemeral' && plan.mode === 'human'
    && artifact?.id === 'dev_extension' && artifact.releaseProfile === 'dev'
    && browser?.processOwnership === 'owned' && plan.parameters?.theme === 'zen'
    && plan.parameters.allowInitialWindowFocusOnce === true && plan.browserExecution?.headless === false
    && plan.browserExecution.presentation === 'foreground' && plan.target.browserRequirements?.hiddenAllowed === false
    && plan.protocolOptions?.initialWindowPresentation === 'windows_human_permission_present_once'
    && plan.protocolOptions.fixturePolicy === 'owned_ephemeral_native_permissions'
    && plan.protocolOptions.permissionPolicy === 'native_prompt_no_pregrant', 'OWNED_FINITE_HUMAN_REQUIRED');
  return true;
}

export function requireSettingsPermissionsComplete(steps) {
  requireProof(Array.isArray(steps) && steps.length === SETTINGS_PERMISSIONS_STEPS.length
    && steps.every((step, index) => step.id === SETTINGS_PERMISSIONS_STEPS[index] && step.status === 'PASS'), 'INCOMPLETE');
  return true;
}

export function settingsPermissionsRequestedBundle() {
  return { permissions: ['scripting'], origins: getUniqueOrigins(buildSiteRuleHostCandidates(DOMAIN)
    .flatMap(buildOriginPatternsForDomain)).sort() };
}

export function requireSettingsPermissionsApiSnapshot(value) {
  requireProof(value && typeof value.contains === 'boolean' && value.granted
    && Array.isArray(value.granted.permissions) && Array.isArray(value.granted.origins)
    && [value.granted.permissions, value.granted.origins].every(list => list.every(item => typeof item === 'string'
      && item.length > 0 && item === item.trim()) && new Set(list).size === list.length), 'PERMISSION_API_RESULT_INVALID');
  const { permissions, origins } = value.granted;
  const bundle = settingsPermissionsRequestedBundle();
  const acceptedOrigins = new Set(bundle.origins.flatMap(origin => [origin,
    origin.replace(/^\*:/u, 'http:'), origin.replace(/^\*:/u, 'https:')]));
  requireProof(origins.every(origin => acceptedOrigins.has(origin)), 'UNEXPECTED_HOST_ACCESS', { origins });
  const matcher = createOriginPermissionMatcher(origins);
  const scripting = permissions.includes('scripting');
  const originsCovered = buildSiteRuleHostCandidates(DOMAIN).every(candidate => matcher.hasDomain(candidate));
  requireProof(value.contains === (scripting && originsCovered), 'PERMISSION_API_COVERAGE_MISMATCH', {
    contains: value.contains, scripting, originsCovered,
  });
  return { contains: value.contains, scripting, originsCovered, origins: [...origins].sort(),
    granted: { permissions: [...permissions].sort(), origins: [...origins].sort() } };
}

export function matchesSettingsPermissionsNativeResponse(sample, decision) {
  if (!['deny', 'approve'].includes(decision)) return false;
  const ui = sample?.ui, permission = sample?.permission;
  if (!(ui?.documentVisible === true && ui.bootShellPresent === false && ui.activeTab === 'settings'
    && ui.permissionsSectionActive === true && Array.isArray(ui.alerts) && Array.isArray(ui.commands)
    && ui.commands.length === 0 && typeof permission?.contains === 'boolean'
    && typeof permission.scripting === 'boolean' && typeof permission.originsCovered === 'boolean'
    && Array.isArray(permission.origins))) return false;
  return decision === 'deny'
    ? permission.contains === false && permission.originsCovered === false && permission.origins.length === 0
      && ui.deniedAlert === true && ui.alerts.length === 1 && ui.connected === false
      && ui.repairCount === 1 && isIntegratedControlReady(ui.repairControl)
    : permission.contains === true && permission.scripting === true && permission.originsCovered === true
      && ui.deniedAlert === false && ui.alerts.length === 0 && ui.connected === true && ui.repairCount === 0;
}

// SettingsStatus renders its label as a text node beside a decorative span.
// Read the status control in the exact Site access SettingsRow, rather than
// requiring a leaf element or matching Connected in another setting's row.
export function readSettingsPermissionsSiteAccessStatus(labels) {
  const area = document.getElementById('settings-content-area');
  const titles = Array.from(area?.querySelectorAll('div') || []).filter(node => node.childElementCount === 0
    && node.textContent.trim() === labels.siteAccess);
  const row = titles.length === 1 ? titles[0].parentElement?.parentElement : null;
  const status = row?.querySelector(':scope > div:last-child > span');
  return { rowCount: titles.length, connected: Boolean(status && status.textContent.trim() === labels.connected) };
}

// Human input is limited to the native browser prompt. The driver can only
// click the real product CTA and observe its response; no permission setter
// or operator acknowledgement is an admission authority.
export async function runSettingsPermissionsNativeResponse(decision, driver) {
  requireProof(['deny', 'approve'].includes(decision), 'NATIVE_DECISION_INVALID');
  const before = await driver.read();
  driver.requireCanonicalUnchanged(before.settings);
  requireProof(before.permission.contains === false && before.ui.connected === false
    && before.ui.repairCount === 1 && isIntegratedControlReady(before.ui.repairControl)
    && (decision === 'deny' ? before.ui.deniedAlert === false
      : matchesSettingsPermissionsNativeResponse(before, 'deny')), 'NATIVE_RESPONSE_PRECONDITION', before);
  await driver.clickRepair();
  await driver.announce({ event: 'WAITING_FOR_NATIVE_PERMISSION', decision,
    responseTimeoutMs: SETTINGS_PERMISSIONS_NATIVE_RESPONSE_TIMEOUT_MS,
    inputOwner: 'human', requested: true, nativePopupObserved: false,
    nativeClickObserved: false, evidenceKind: 'product_response_only' });
  const response = await driver.until(`native_permission_${decision}`, async () => {
    const value = await driver.read();
    driver.requireCanonicalUnchanged(value.settings);
    requireProof(Array.isArray(value.ui.alerts) && Array.isArray(value.ui.commands), 'NATIVE_RESPONSE_UI_INVALID');
    requireProof((value.ui.alerts.length === 0 || (value.ui.deniedAlert === true && value.ui.alerts.length === 1))
      && !value.ui.commands.includes('apply_error'), 'NATIVE_REQUEST_FAILED', value);
    return value;
  }, value => matchesSettingsPermissionsNativeResponse(value, decision), SETTINGS_PERMISSIONS_NATIVE_RESPONSE_TIMEOUT_MS);
  driver.requireCanonicalUnchanged(response.settings);
  requireProof(matchesSettingsPermissionsNativeResponse(response, decision), 'NATIVE_RESPONSE_NOT_PROVEN', response);
  return { kind: 'human_assisted_native_response', evidenceKind: 'product_response_only', decision,
    nativeClickObserved: false, beforePermission: before.permission, permission: response.permission, ui: response.ui,
    canonicalSettingsUnchanged: true };
}

export function matchesSettingsPermissionsRuntime(proof, expected) {
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const state = proof?.probe?.state, bootstrap = proof?.inspection?.bootstrap, lease = proof?.inspection?.attemptLease;
  return Boolean(typeof proof?.documentId === 'string' && proof.documentId.length > 0 && proof.frameId === 0
    && proof.inspection.url === expected.url && proof.inspection.receiverInstalled === true
    && proof.probe?.ok === true && proof.probe.type === MESSAGE_TYPES.CONTENT_RUNTIME_PROBE
    && proof.probe.buildId === expected.buildId && state?.url === expected.url
    && state.status === 'active' && state.active === true && state.dispatchReady === true && state.error === null
    && state.receiverCapabilityVersion === CONTENT_RECEIVER_CAPABILITY_VERSION && positive(state.attemptId) && positive(state.startedAt)
    && bootstrap?.status === 'active' && bootstrap.active === true && bootstrap.dispatchReady === true && bootstrap.error === null
    && bootstrap.receiverCapabilityVersion === state.receiverCapabilityVersion
    && bootstrap.attemptId === state.attemptId && bootstrap.startedAt === state.startedAt
    && lease?.attemptId === state.attemptId && lease.startedAt === state.startedAt && lease.aborted === false
    && proof.body?.url === expected.url && proof.body.readyState === 'complete'
    && proof.body.present === true && proof.body.documentVisible === true);
}

export async function waitForSettingsPermissionsObservation({ label, read, accept, timeoutMs,
  deadline, signal, now = Date.now, delay = sleep }) {
  const end = Math.min(deadline, now() + timeoutMs);
  let value;
  do {
    signal?.throwIfAborted();
    requireProof(now() < deadline, 'DURATION_EXCEEDED');
    value = await read();
    signal?.throwIfAborted();
    requireProof(now() < deadline, 'DURATION_EXCEEDED');
    if (now() >= end) break;
    if (accept(value)) return value;
    await delay(150);
  } while (now() < end);
  requireProof(false, `TIMEOUT:${label}`, value);
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal, requestInitialOwnedWindowPresentation }) {
  requireSettingsPermissionsPlan({ plan, artifact, browser });
  requireProof(typeof requestInitialOwnedWindowPresentation === 'function', 'INITIAL_PRESENTATION_OWNER_REQUIRED');
  const startedAt = Date.now(), deadline = startedAt + MAXIMUM_DURATION_MS;
  const reportPath = path.join(attachmentsDir, 'settings-permissions.json');
  const report = { schemaVersion: 1, theme: 'zen', buildId: artifact.buildId, browserStarts: 0,
    scope: 'human_assisted_optional_host_permission_product_response', nativeClickObserved: false,
    nativeInputAutomation: false, hostPregranted: false, temporaryManifestPromotion: false,
    canonicalSettingsKeys: ['app-theme', ...SETTINGS_KEYS],
    steps: SETTINGS_PERMISSIONS_STEPS.map(id => ({ id, status: 'NOT_RUN' })), observations: [] };
  const writeReport = () => fs.writeFile(reportPath, `${JSON.stringify({ ...report, durationMs: Date.now() - startedAt }, null, 2)}\n`);
  registerCleanup('settings_permissions_evidence', async () => { await writeReport(); return { reportPath }; });
  const temporaryManifest = createSettingsPermissionsTemporaryManifest();
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path, rootDir: plan.rootDir,
    headless: false, browserExecution: plan.browserExecution, audioPolicy: plan.browserExecution.audioPolicy,
    launchEnvironment: browser.launchEnvironment, displayReceipt: browser.display,
    renderingRequirement: plan.browserExecution.renderingRequirement, keepTemp: false, temporaryManifest,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, tempPrefix: 'entropy-settings-permissions-', recoveryJournal });
  registerCleanup('settings_permissions_browser', () => harness.close());
  const pages = {}, diagnostics = {};
  registerCleanup('settings_permissions_diagnostics', async () => {
    report.pageDiagnostics = {};
    for (const [name, diagnostic] of Object.entries(diagnostics)) {
      report.pageDiagnostics[name] = await diagnostic.snapshot(); diagnostic.dispose();
    }
    return { pages: Object.keys(diagnostics) };
  });
  const checkOpen = () => { signal?.throwIfAborted(); requireProof(Date.now() < deadline, 'DURATION_EXCEEDED'); };
  const dom = (page, expression) => { checkOpen(); return evaluate(harness.cdp, page.sessionId, expression); };
  const send = request => { checkOpen(); return sendTrustedRuntimeMessage(harness, request); };
  async function observe(label, value) {
    report.observations.push({ label, elapsedMs: Date.now() - startedAt, value });
    await evidence.event('QA_SETTINGS_PERMISSIONS_OBSERVATION', { label, value });
  }
  const until = (label, read, accept, timeoutMs = 45_000) => waitForSettingsPermissionsObservation({
    label, read, accept, timeoutMs, deadline, signal,
  });
  async function step(id, run) {
    const entry = report.steps.find(item => item.id === id), begin = Date.now();
    requireProof(entry?.status === 'NOT_RUN', 'STEP_LIFETIME_INVALID');
    entry.status = 'RUNNING'; await evidence.event('QA_SETTINGS_PERMISSIONS_STEP_STARTED', { id });
    try { entry.result = await run(); entry.status = 'PASS'; }
    catch (error) { entry.status = 'FAIL'; entry.error = { code: error.code, message: error.message, diagnostic: error.diagnostic }; throw error; }
    finally { entry.durationMs = Date.now() - begin; await writeReport(); await evidence.event('QA_SETTINGS_PERMISSIONS_STEP_FINISHED', entry); }
    return entry.result;
  }
  async function capture(name, page = pages.dashboard) {
    requireProof(Boolean(page), 'CAPTURE_PAGE_REQUIRED');
    const image = await harness.cdp.send('Page.captureScreenshot', { format: 'png' }, page.sessionId);
    const filename = `${name}.png`;
    await fs.writeFile(path.join(attachmentsDir, filename), Buffer.from(image.data, 'base64')); return filename;
  }
  async function control(expression, scroll = false) {
    return dom(pages.dashboard, `(() => { const node=(${expression}); const state={present:Boolean(node),
      bootShellPresent:Boolean(document.getElementById('entropy-dashboard-boot-shell')),
      documentVisible:document.visibilityState==='visible'};
      if(!node)return state; if(${scroll})node.scrollIntoView({block:'center',behavior:'instant'});
      const r=node.getBoundingClientRect(),s=getComputedStyle(node),point={x:r.x+r.width/2,y:r.y+r.height/2};
      return {...state,point,focused:document.activeElement===node,inert:Boolean(node.closest('[inert]')),
        disabled:node.disabled===true||node.getAttribute('aria-disabled')==='true',
        visible:!document.hidden&&r.width>0&&r.height>0&&s.visibility==='visible'&&Number(s.opacity)>0,
        hit:node.contains(document.elementFromPoint(point.x,point.y))}; })()`);
  }
  async function click(expression) {
    const state = await until('trusted_control', () => control(expression, true), isIntegratedControlReady);
    checkOpen();
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...state.point }, pages.dashboard.sessionId);
    for (const type of ['mousePressed', 'mouseReleased']) await harness.cdp.send('Input.dispatchMouseEvent', {
      type, ...state.point, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1,
    }, pages.dashboard.sessionId);
  }
  async function pressKey(key, code) {
    checkOpen();
    for (const type of ['keyDown', 'keyUp']) await harness.cdp.send('Input.dispatchKeyEvent', {
      type, key, code: key, windowsVirtualKeyCode: code,
    }, pages.dashboard.sessionId);
  }
  const readPresentation = () => dom(pages.dashboard, `({documentVisible:!document.hidden,
    bootShellPresent:Boolean(document.getElementById('entropy-dashboard-boot-shell')),
    activeTab:document.querySelector('[data-dashboard-active-tab]')?.getAttribute('data-dashboard-active-tab'),
    phase:document.querySelector('[data-main-presentation-phase]')?.getAttribute('data-main-presentation-phase')})`);
  async function navigateTab(tab) {
    await until('presentation_released', readPresentation, state => state.documentVisible && !state.bootShellPresent
      && [MAIN_PRESENTATION_PHASES.SETTLED, MAIN_PRESENTATION_PHASES.DEFERRED].includes(state.phase));
    await click(`document.querySelector('[data-tab="${tab}"]')`);
    return until(`tab:${tab}`, readPresentation, state => state.activeTab === tab && state.documentVisible && !state.bootShellPresent);
  }
  async function readPermission() {
    checkOpen();
    const bundle = settingsPermissionsRequestedBundle();
    const value = await harness.evaluateInTrustedPage(`(async () => {
      const [granted, contains] = await Promise.all([chrome.permissions.getAll(),
        chrome.permissions.contains(${JSON.stringify(bundle)})]); return {granted,contains}; })()`);
    return requireSettingsPermissionsApiSnapshot(value);
  }
  async function readSettings() {
    return until('canonical_settings', async () => {
      const reply = await send({ action: MESSAGE_ACTIONS.GET_BOOT_PREWARM_SNAPSHOT,
        force: true, reason: 'settings_permissions_canonical' });
      if (reply?.success === false && reply.error === 'BOOT_PREWARM_SNAPSHOT_INVALIDATED') {
        await observe('canonical_read_invalidated', { code: reply.error }); return { status: 'invalidated' };
      }
      const raw = reply?.snapshot?.protocol;
      const missingKeys = SETTINGS_KEYS.filter(key => !raw || !Object.hasOwn(raw, key));
      requireProof(reply?.success === true && missingKeys.length === 0, 'CANONICAL_READ_FAILED', {
        success: reply?.success, error: reply?.error, missingKeys,
      });
      const snapshot = requireBootPrewarmDashboardSnapshot(reply.snapshot);
      return { status: 'ready', settings: { 'app-theme': snapshot.preference.themeId,
        ...Object.fromEntries(SETTINGS_KEYS.map(key => [key, snapshot.protocol[key]])) } };
    }, value => value.status === 'ready').then(value => value.settings);
  }
  let labels;
  const repairExpression = () => `Array.from(document.querySelectorAll('#settings-content-area button')).find(node =>
    node.textContent.trim() === ${JSON.stringify(labels.fixMissing)})`;
  const permissionSectionExpression = () => `Array.from(document.querySelectorAll('#settings nav button')).find(node =>
    node.querySelector('span span')?.textContent.trim() === ${JSON.stringify(labels.permissionsSection)})`;
  async function readPermissionUi() {
    const ui = await dom(pages.dashboard, `(() => { const area=document.getElementById('settings-content-area');
      const siteAccess=(${readSettingsPermissionsSiteAccessStatus.toString()})(${JSON.stringify(labels)});
      const repair=(${repairExpression()}); const section=(${permissionSectionExpression()});
      const alerts=Array.from(document.querySelectorAll('#settings [role="alert"]')).map(node=>node.textContent.trim().slice(0,240));
      return {documentVisible:!document.hidden,bootShellPresent:Boolean(document.getElementById('entropy-dashboard-boot-shell')),
        activeTab:document.querySelector('[data-dashboard-active-tab]')?.getAttribute('data-dashboard-active-tab'),
        permissionsSectionActive:section?.getAttribute('aria-current')==='page',
        repairCount:Array.from(area?.querySelectorAll('button')||[]).filter(node=>node.textContent.trim()===${JSON.stringify(labels.fixMissing)}).length,
        siteAccessRowCount:siteAccess.rowCount,connected:siteAccess.connected,
        deniedAlert:alerts.includes(${JSON.stringify(labels.denied)}),alerts,
        commands:Array.from(document.querySelectorAll('#settings [data-settings-command-status]')).map(node=>node.getAttribute('data-settings-command-status'))}; })()`);
    return { ...ui, repairControl: await control(repairExpression()) };
  }
  let canonicalBaseline;
  const requireCanonicalUnchanged = settings => requireProof(isDeepStrictEqual(settings, canonicalBaseline),
    'CANONICAL_SETTINGS_CHANGED', { expected: canonicalBaseline, actual: settings });
  async function responseSample() {
    return { permission: await readPermission(), ui: await readPermissionUi(), settings: await readSettings() };
  }
  async function readRuntime(fixtureUrl) {
    const page = pages.content;
    const samples = await harness.evaluateInTrustedPage(`chrome.scripting.executeScript({
      target:{tabId:${page.tabId},frameIds:[0]},world:'ISOLATED',func:()=>{
        const s=globalThis.__entropyContentBootstrapState__,l=globalThis.__entropyContentBootstrapAttemptLease__;
        return {url:location.href,receiverInstalled:globalThis.__entropyProtectionRuntimeReceiverInstalled__,
          bootstrap:s?{status:s.status,attemptId:s.attemptId,startedAt:s.startedAt,dispatchReady:s.dispatchReady,
            active:s.active,receiverCapabilityVersion:s.receiverCapabilityVersion,error:s.error}:null,
          attemptLease:l?{attemptId:l.attemptId,startedAt:l.startedAt,aborted:l.signal.aborted}:null};}})`);
    requireProof(Array.isArray(samples) && samples.length === 1 && samples[0].frameId === 0
      && typeof samples[0].documentId === 'string' && samples[0].documentId.length > 0
      && samples[0].documentId === samples[0].documentId.trim() && samples[0].result?.url === fixtureUrl, 'RUNTIME_DOCUMENT_INSPECTION');
    const sample = samples[0];
    const body = await dom(page, `({url:location.href,readyState:document.readyState,present:Boolean(document.body),documentVisible:!document.hidden})`);
    const proof = { frameId: 0, documentId: sample.documentId, inspection: sample.result, body, probe: null };
    if (sample.result.receiverInstalled !== true || sample.result.bootstrap?.dispatchReady !== true) return proof;
    proof.probe = await harness.evaluateInTrustedPage(`chrome.tabs.sendMessage(${page.tabId},
      ${JSON.stringify({ type: MESSAGE_TYPES.CONTENT_RUNTIME_PROBE })},${JSON.stringify({ frameId: 0, documentId: sample.documentId })})`);
    return proof;
  }
  async function verifyRuntime(fixtureUrl) {
    await harness.activateOwnedEphemeralPageWithoutWindowFocus(pages.content);
    return until('permission_runtime_resync', () => readRuntime(fixtureUrl),
      proof => matchesSettingsPermissionsRuntime(proof, { url: fixtureUrl, buildId: artifact.buildId }));
  }
  try {
    const fixture = await createNativeVideoSkipFixture();
    registerCleanup('settings_permissions_fixture_server', () => fixture.close());
    await harness.start(); report.browserStarts += 1; await reportBrowserGpuCapability(harness.gpuCapability);
    const expectedBuild = { buildId: artifact.buildId, releaseProfile: artifact.releaseProfile };
    const identity = await requireEntropyAttachedArtifactRuntimeIdentity(harness, {
      artifactIdentity: { artifactId: artifact.id, inputDigest: artifact.inputDigest, ...expectedBuild },
      temporaryManifest, trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    });
    await requireEntropyTrackingRuntimeReadiness(harness, { expectedBuild });
    await step('fresh_no_host_access', async () => {
      const permission = await readPermission();
      requireProof(permission.contains === false && permission.scripting === false
        && permission.originsCovered === false && permission.origins.length === 0, 'FRESH_PROFILE_PREGRANTED', permission);
      return { identity, permission, temporaryManifest, nativeClickObserved: false };
    });
    pages.dashboard = await harness.openPage('about:blank', { active: true });
    diagnostics.dashboard = createDashboardPageDiagnostics({ cdp: harness.cdp, sessionId: pages.dashboard.sessionId });
    await diagnostics.dashboard.enable(); diagnostics.dashboard.markNavigationRequested();
    const dashboardUrl = `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=sites`;
    await harness.navigatePage(pages.dashboard, dashboardUrl);
    report.initialPresentation = await requestInitialOwnedWindowPresentation({ child: harness.chrome,
      cdp: harness.cdp, targetId: pages.dashboard.targetId, tabId: pages.dashboard.tabId });
    requireProof(report.initialPresentation?.policy === 'windows_human_permission_present_once', 'INITIAL_PRESENTATION_RECEIPT_INVALID');
    await harness.activateOwnedEphemeralPageWithoutWindowFocus(pages.dashboard);
    await step('first_use_off', () => completeIntegratedFirstUseOffPolicy({ label: 'settings_permissions', until,
      click, pressKey, readPolicy: () => readIntegratedFirstUsePolicy(send),
      readSitesControl: () => control(`document.querySelector('.sites-unified-registry input[type="search"]')`),
      capture: () => capture('00-first-use-off'), observePolicyInvalidation: value => observe('first_use_invalidated', value),
      afterCommit: () => navigateTab('sites'),
      readUi: () => readIntegratedFirstUseUi({ readDom: expression => dom(pages.dashboard, expression),
        readControl: control }),
    }));
    await step('managed_rule_baseline', async () => {
      const filters = Object.fromEntries(Object.entries(structuredClone(CONFIG_DEFAULT_FILTER_SETTINGS))
        .map(([key, value]) => [key, { ...value, isActive: key === 'blur' }]));
      const baseline = { 'app-theme': 'zen', permissionMode: 'selective', filteringMode: 'blocklist', rulesMode: 'managed',
        filterSettings: filters, tabEvaporationForBlocked: false, tabEvaporationTimeoutMinutes: 5,
        ...structuredClone(INTEGRATED_FIRST_USE_OFF_POLICY) };
      requireConsumptionQaSettingsAcknowledgement(await send({ action: MESSAGE_ACTIONS.SET_SETTINGS,
        items: baseline, waitForPropagation: true }), baseline);
      const ack = requireSettingsRuntimeCommandAcknowledgement(MESSAGE_ACTIONS.UPSERT_SITE_RULE,
        await send({ action: MESSAGE_ACTIONS.UPSERT_SITE_RULE, domain: DOMAIN, type: 'blocked',
          goalMinutes: 30, waitForPropagation: true }));
      requireProof(ack.items.siteGoals?.[DOMAIN] === 30 && ack.propagation?.status === 'succeeded', 'SITE_RULE_ACK_REQUIRED');
      canonicalBaseline = await readSettings();
      requireProof(canonicalBaseline.blockedUrls.length === 1 && canonicalBaseline.blockedUrls[0] === DOMAIN
        && canonicalBaseline.allowedUrls.length === 0 && canonicalBaseline.siteGoals[DOMAIN] === 30
        && Object.entries(baseline).every(([key, value]) => isDeepStrictEqual(canonicalBaseline[key], value)), 'BASELINE_CANONICAL_MISMATCH');
      pages.content = await harness.openPage(fixture.url, { active: false, sameWindowAs: pages.dashboard });
      await navigateTab('settings');
      const locale = await dom(pages.dashboard, 'document.documentElement.lang');
      requireProof(typeof locale === 'string' && /^(en|ko)(?:-|$)/u.test(locale), 'SUPPORTED_LOCALE_REQUIRED', { locale });
      const dictionary = locale.startsWith('ko') ? koSettings : enSettings;
      labels = { fixMissing: dictionary.settings_permissions.access.fix_missing_cta.replace('{{count}}', '1'),
        siteAccess: dictionary.recording.site_access, connected: dictionary.recording.access_connected,
        denied: dictionary.status.denied.replace('{{type}}', dictionary.permissions.types.host),
        permissionsSection: dictionary.sections.permissions.title };
      await click(permissionSectionExpression());
      const ui = await until('permission_repair_ready', readPermissionUi, value => value.permissionsSectionActive
        && value.repairCount === 1 && isIntegratedControlReady(value.repairControl) && !value.connected);
      const permission = await readPermission();
      requireProof(permission.contains === false && permission.origins.length === 0, 'BASELINE_PREGRANTED', permission);
      return { settings: canonicalBaseline, permission, ui, screenshot: await capture('01-managed-site-access-needed') };
    });
    const nativeDriver = { read: responseSample, requireCanonicalUnchanged, until,
      clickRepair: () => click(repairExpression()),
      announce: async value => { console.log(JSON.stringify(value)); await evidence.event('WAITING_FOR_NATIVE_PERMISSION', value); } };
    await step('native_denied', async () => ({ ...await runSettingsPermissionsNativeResponse('deny', nativeDriver),
      screenshot: await capture('02-native-denied') }));
    await step('native_approved', async () => {
      const response = await runSettingsPermissionsNativeResponse('approve', nativeDriver);
      const screenshot = await capture('03-native-approved');
      const runtime = await verifyRuntime(fixture.url);
      requireCanonicalUnchanged(await readSettings());
      return { ...response, runtime, screenshot };
    });
    await step('reload_proof', async () => {
      await harness.activateOwnedEphemeralPageWithoutWindowFocus(pages.dashboard);
      report.dashboardBeforeReloadDiagnostics = await diagnostics.dashboard.snapshot();
      diagnostics.dashboard.dispose();
      diagnostics.dashboard = createDashboardPageDiagnostics({ cdp: harness.cdp, sessionId: pages.dashboard.sessionId });
      await diagnostics.dashboard.enable();
      diagnostics.dashboard.markNavigationRequested();
      await harness.navigatePage(pages.dashboard, dashboardUrl); await navigateTab('settings');
      await click(permissionSectionExpression());
      const response = await until('reloaded_connected', responseSample,
        value => { requireCanonicalUnchanged(value.settings); return matchesSettingsPermissionsNativeResponse(value, 'approve'); });
      const screenshot = await capture('04-reloaded-connected');
      const runtime = await verifyRuntime(fixture.url);
      requireCanonicalUnchanged(await readSettings());
      return { permission: response.permission, ui: response.ui, canonicalSettingsUnchanged: true, runtime, screenshot };
    });
    requireSettingsPermissionsComplete(report.steps); report.status = 'PASS'; await writeReport();
    return { status: 'PASS', buildId: artifact.buildId, verdictScope: 'product', scope: report.scope,
      nativeClickObserved: false, nativeInputAutomation: false, reportPath, browserStarts: report.browserStarts, steps: report.steps };
  } catch (error) {
    report.status = 'FAIL'; report.error = { code: error.code, message: error.message, diagnostic: error.diagnostic };
    if (pages.dashboard) {
      try { report.failureWindows = await observeIntegratedFailureWindows({ harness, pages, recoveryJournal }); }
      catch (failure) { report.failureWindowError = String(failure.message).slice(0, 240); }
      try { report.failureScreenshot = await capture('failure'); }
      catch (failure) { report.failureCaptureError = String(failure.message).slice(0, 240); }
    }
    await writeReport(); throw error;
  }
}
