import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ExtensionChromiumHarness, evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { normalizeChromiumHarnessTemporaryManifest } from '../../e2e/chromiumHarnessManifestPromotion.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/contracts/messageTypes.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../src/domains/settings/config/index.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { requireSettingsRuntimeCommandAcknowledgement } from '../../../src/domains/settings/config/settingsRuntimeCommandAcknowledgement.js';
import { buildOriginPatternsForDomain } from '../../../src/lib/permissions.js';
import { createDashboardPageDiagnostics } from './dashboardCaptureDiagnostics.mjs';
import { allowsQaOwnedInitialWindowPresentation } from '../contracts/qaInitialWindowFocusPolicy.mjs';
import { sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { requireEntropyAttachedArtifactRuntimeIdentity, requireEntropyTrackingRuntimeReadiness } from './attachOnlyActivePageAdapter.mjs';
import { completeIntegratedFirstUseOffPolicy, readIntegratedFirstUsePolicy, readIntegratedFirstUseUi,
  isIntegratedControlReady, matchesIntegratedArtifactSetting, observeIntegratedFailureWindows,
  readIntegratedDashboardPresentation, matchesIntegratedDashboardNavigationReleased,
  presentIntegratedSitesWorkspace, buildIntegratedArtifactChoiceContract, openIntegratedArtifactControl,
  prepareIntegratedFeatureAccess, prepareIntegratedCanonicalDayZero,
  openIntegratedSitesManagement, openIntegratedFirstUseRegistration,
  readIntegratedDayZeroDisclosure, readIntegratedRestorationRuleMembership,
  readIntegratedFirstUseEntry } from './integratedProtectionQaProtocol.mjs';
import { readSettingsArtifactGalleryNavigation, selectSettingsArtifactGalleryFamily } from './settingsArtifactGalleryNavigation.mjs';
import { PROFILE_RESET_LIFECYCLE_STORAGE_KEY } from '../../../src/platform/storage/internal/chrome-storage/stores/ProfileResetLifecycleStore.js';
import { resolveProfileResetGeneration, isProfileResetWriteAdmissionClosed,
  normalizeProfileResetLifecycleState } from '../../../src/platform/storage/runtime/ProfileResetLifecycleRepository.js';

const DOMAIN = 'native-video.localhost';
const SEARCH = `document.querySelector('.sites-unified-registry input[type="search"]')`;
const CAP = `document.querySelector('[data-site-cap][data-domain="${DOMAIN}"]')`;
const CAP_TRIGGER = `(${CAP})?.querySelector('.sites-cap-readout__value')`;
const CAP_FORM = `(${CAP})?.querySelector('form.sites-cap-inline-editor')`;
const CAP_INPUT = `(${CAP_FORM})?.querySelector('input[type="number"]')`;
const CAP_SAVE = `(${CAP_FORM})?.querySelector('button[type="submit"]')`;
const CAP_SAVE_OBSERVER_KEY = '__ENTROPY_SETTINGS_CONCURRENCY_CAP_SAVE__';
const SETTINGS_KEYS = ['filterSettings', 'tabEvaporationForBlocked', 'tabEvaporationTimeoutMinutes',
  'siteGoals', 'blockedUrls', 'allowedUrls', 'dataCollectionMode', 'insightsConsent', 'trackingExcludedUrls'];

export const SETTINGS_CONCURRENCY_STEPS = Object.freeze([
  'fresh_dashboard', 'two_dashboards', 'stale_site_goal', 'rapid_lens', 'rapid_echo', 'worker_revival',
]);

export function createSettingsConcurrencyTemporaryManifest() {
  return normalizeChromiumHarnessTemporaryManifest({ requiredPermissions: ['scripting'],
    requiredHostPermissions: buildOriginPatternsForDomain(DOMAIN) });
}

function requireProof(condition, code, diagnostic) {
  if (condition) return;
  const error = new Error(`QA_SETTINGS_CONCURRENCY_${code}`);
  error.diagnostic = diagnostic;
  throw error;
}

// Same canonical lifecycle input as the integrated journey. The private raw
// packet stays inside QA; progression commands receive only its typed generation.
export function createSettingsConcurrencyProgressionAccess({ harness, send }) {
  requireProof(typeof harness?.evaluateInTrustedPage === 'function' && typeof send === 'function', 'PROGRESSION_OWNERS_REQUIRED');
  async function currentProfileGeneration() {
    const journal = await harness.evaluateInTrustedPage(`chrome.storage.local.get(${JSON.stringify(PROFILE_RESET_LIFECYCLE_STORAGE_KEY)})
      .then(items => ({ present: Object.hasOwn(items, ${JSON.stringify(PROFILE_RESET_LIFECYCLE_STORAGE_KEY)}),
        value: items[${JSON.stringify(PROFILE_RESET_LIFECYCLE_STORAGE_KEY)}] }))`);
    requireProof(typeof journal?.present === 'boolean', 'PROGRESSION_PROFILE_LIFECYCLE_REQUIRED');
    const lifecycle = journal.present ? normalizeProfileResetLifecycleState(journal.value) : null;
    requireProof(!isProfileResetWriteAdmissionClosed(lifecycle), 'PROGRESSION_PROFILE_LIFECYCLE_CLOSED');
    return resolveProfileResetGeneration(lifecycle);
  }
  return Object.freeze({
    prepareCanonicalDayZero: async () => prepareIntegratedCanonicalDayZero(send, await currentProfileGeneration()),
    readDayZeroDisclosure: async () => readIntegratedDayZeroDisclosure(send, await currentProfileGeneration()),
    prepareFeatureAccess: async () => prepareIntegratedFeatureAccess(send, await currentProfileGeneration()),
  });
}

// Serialized only into the exact owned Dashboard. This observes product DOM;
// its private receipt never changes a control, application state or an ACK.
export function installSettingsConcurrencyCapSaveObservation({ key, domain, appliedMinutes }, observedDocument = document) {
  const view = observedDocument.defaultView;
  const findCap = () => Array.from(observedDocument.querySelectorAll('[data-site-cap]'))
    .find(node => node.getAttribute('data-domain') === domain);
  const cap = findCap(), form = cap?.querySelector('form.sites-cap-inline-editor');
  const formId = form?.id;
  const input = form?.querySelector('input[type="number"]');
  const submit = form?.querySelector('button[type="submit"]');
  if (typeof key !== 'string' || !view || Object.hasOwn(view, key)
    || !cap || !form || !formId || observedDocument.getElementById(formId) !== form || !input || !submit
    || input.form !== form || cap.getAttribute('data-editing') !== 'true'
    || cap.getAttribute('data-save-phase') !== 'idle' || submit.disabled
    || !Number.isSafeInteger(appliedMinutes) || appliedMinutes < 0
    || form.querySelector('[role="alert"]')) {
    throw new Error('QA_SETTINGS_CONCURRENCY_CAP_SAVE_OBSERVER_INVALID');
  }
  let outcome = null, trustedSubmit = false, savingObserved = false, requestedValue;
  let timer;
  const sameNodes = () => cap.isConnected && findCap() === cap
    && cap.querySelector('form.sites-cap-inline-editor') === form && form.isConnected
    && form.id === formId && observedDocument.getElementById(formId) === form
    && form.querySelector('input[type="number"]') === input
    && input.form === form
    && form.querySelector('button[type="submit"]') === submit;
  const stop = () => {
    observer.disconnect(); view.clearTimeout(timer);
    observedDocument.removeEventListener('click', onClick, true);
  };
  const failureSnapshot = () => {
    const currentCap = findCap();
    return {
      identity: Object.freeze({ capConnected: cap.isConnected, capMatches: currentCap === cap,
        formIdMatches: form.id === formId && observedDocument.getElementById(formId) === form,
        formConnected: form.isConnected, formMatches: cap.querySelector('form.sites-cap-inline-editor') === form,
        inputConnected: input.isConnected, inputMatches: form.querySelector('input[type="number"]') === input,
        inputOwnerMatches: input.form === form,
        submitConnected: submit.isConnected, submitMatches: form.querySelector('button[type="submit"]') === submit }),
      phase: cap.getAttribute('data-save-phase'), currentCapPresent: Boolean(currentCap),
      currentPhase: currentCap ? currentCap.getAttribute('data-save-phase') : null,
      formPhase: form.getAttribute('data-save-phase'), trustedSubmit, savingObserved,
      inputValue: input.value, requestedValue, expectedAppliedValue: String(appliedMinutes),
      documentHidden: observedDocument.hidden, documentVisibility: observedDocument.visibilityState,
    };
  };
  const fail = error => { outcome = Object.freeze({ status: 'failed', error, ...failureSnapshot() }); stop(); };
  const sample = () => {
    if (outcome) return;
    if (!sameNodes()) { fail('CAP_SAVE_NODE_REPLACED'); return; }
    const phase = cap.getAttribute('data-save-phase');
    if (phase === 'error' || form.querySelector('[role="alert"]')) { fail('CAP_SAVE_ERROR'); return; }
    if (trustedSubmit && phase === 'saving') savingObserved = true;
    if (phase !== 'success') return;
    if (!trustedSubmit) { fail('CAP_SAVE_TRUSTED_SUBMIT_REQUIRED'); return; }
    if (input.value !== String(appliedMinutes)) { fail('CAP_SAVE_APPLIED_VALUE_INVALID'); return; }
    outcome = Object.freeze({ status: 'succeeded', receipt: Object.freeze({
      phase, value: input.value, errors: Object.freeze([]), domain,
      requestedValue, trustedSubmit: true, nodeIdentity: 'unchanged', savingObserved,
    }) });
    stop();
  };
  const onClick = event => {
    if (outcome || !submit.contains(event.target)) return;
    if (event.isTrusted !== true) { fail('CAP_SAVE_TRUSTED_SUBMIT_REQUIRED'); return; }
    if (!sameNodes() || observedDocument.hidden || submit.disabled
      || cap.getAttribute('data-save-phase') !== 'idle') { fail('CAP_SAVE_INPUT_NOT_READY'); return; }
    trustedSubmit = true; requestedValue = input.value;
  };
  const observer = new view.MutationObserver(sample);
  observer.observe(observedDocument.body, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['data-save-phase', 'data-domain', 'data-editing', 'id', 'form', 'aria-busy', 'role', 'disabled'] });
  observedDocument.addEventListener('click', onClick, true);
  timer = view.setTimeout(() => { if (!outcome) fail('CAP_SAVE_OBSERVATION_TIMEOUT'); }, 30_000);
  Object.defineProperty(view, key, { configurable: true, value: Object.freeze({
    read: () => outcome || Object.freeze({ status: 'pending', trustedSubmit, savingObserved }),
    dispose: () => { stop(); delete view[key]; },
  }) });
  return { status: 'armed', domain, initialPhase: cap.getAttribute('data-save-phase') };
}

export function requireSettingsConcurrencyComplete(steps) {
  requireProof(Array.isArray(steps) && steps.length === SETTINGS_CONCURRENCY_STEPS.length
    && steps.every((step, index) => step.id === SETTINGS_CONCURRENCY_STEPS[index]
      && step.status === 'PASS'), 'INCOMPLETE');
  return true;
}

export function requireSettingsConcurrencyGoalEvidence(value) {
  requireProof(value?.initialMinutes === 30 && value.requestedMinutes === 120
    && value.draftBeforeOtherSave === '120' && value.draftAfterOtherSave === '120'
    && value.otherAppliedMinutes === 60 && value.otherCommittedMinutes === 60 && value.otherAppliedPhase === 'success'
    && value.appliedMinutes === 90 && value.committedMinutes === 90
    && value.appliedPhase === 'success'
    && Array.isArray(value.bothUiMinutes) && value.bothUiMinutes.length === 2
    && value.bothUiMinutes.every(minutes => minutes === 90)
    && Array.isArray(value.reloadedUiMinutes) && value.reloadedUiMinutes.length === 2
    && value.reloadedUiMinutes.every(minutes => minutes === 90), 'SITE_GOAL_EVIDENCE_REQUIRED', value);
  return value;
}

export function matchesSettingsConcurrencySavedCapReady({ cap, control } = {}) {
  return Boolean(cap?.present === true && cap.phase === 'idle'
    && Array.isArray(cap.errors) && cap.errors.length === 0
    && isIntegratedControlReady(control));
}

export function matchesSettingsConcurrencyNavigationReleased(state) {
  return matchesIntegratedDashboardNavigationReleased(state);
}

export function inspectSettingsConcurrencyCap({ domain }, observedDocument = document) {
  const cap = Array.from(observedDocument.querySelectorAll('[data-site-cap]')).find(node => node.dataset.domain === domain);
  const form = cap?.querySelector('form.sites-cap-inline-editor'), input = form?.querySelector('input[type="number"]');
  return { present: Boolean(cap), value: input?.value, phase: cap?.dataset.savePhase,
    expanded: cap?.dataset.editing === 'true' && Boolean(form),
    busy: form?.getAttribute('aria-busy') === 'true',
    errors: form ? Array.from(form.querySelectorAll('[role="alert"]')).map(node => node.textContent.slice(0, 160)) : [],
    document: { hidden: observedDocument.hidden, visibilityState: observedDocument.visibilityState, readyState: observedDocument.readyState,
      bootShellPresent: Boolean(observedDocument.getElementById('entropy-dashboard-boot-shell')),
      activeTab: observedDocument.querySelector('[data-dashboard-active-tab]')?.getAttribute('data-dashboard-active-tab'),
      presentationPhase: observedDocument.querySelector('[data-main-presentation-phase]')?.getAttribute('data-main-presentation-phase'),
      detailPresent: Boolean(observedDocument.getElementById('sites-site-detail')) },
    readouts: Array.from(observedDocument.querySelectorAll('[data-site-cap]')).slice(0, 4).map(node => ({
      domain: node.getAttribute('data-domain')?.slice(0, 128), phase: node.getAttribute('data-save-phase') })) };
}

export function settingsConcurrencyDashboardUrl(extensionId, tab, domainScoped) {
  requireProof(['sites', 'tools'].includes(tab) && typeof domainScoped === 'boolean', 'DASHBOARD_SCOPE_INVALID');
  const query = new URLSearchParams({ tab });
  if (domainScoped) query.set('domain', DOMAIN);
  return `chrome-extension://${extensionId}/src/pages/dashboard.html?${query}`;
}

export async function presentSettingsConcurrencySitesWorkspace(driver, page) {
  return presentIntegratedSitesWorkspace(driver, page);
}

export async function presentSettingsConcurrencySites(driver, page) {
  const presented = await presentSettingsConcurrencySitesWorkspace(driver, page);
  await driver.ensureSelectedDomain(page);
  return presented;
}

export async function runSettingsConcurrencyGoalConflict(driver, pages) {
  await driver.activate(pages.a);
  const initial = await driver.inspectSavedGoal(pages.a, 30);
  const draft = await driver.editGoal(pages.a, 120);
  requireProof(draft.value === '120', 'UNCUT_DRAFT_REQUIRED', draft);
  await driver.activate(pages.b);
  await driver.editGoal(pages.b, 60);
  const other = await driver.saveGoal(pages.b, 60);
  const otherCommitted = await driver.waitGoal(60);
  await driver.activate(pages.a);
  const stale = await driver.openGoal(pages.a);
  requireProof(stale.value === '120', 'STALE_DRAFT_LOST', stale);
  const applied = await driver.saveGoal(pages.a, 90);
  const committed = await driver.waitGoal(90);
  const bothUiMinutes = [], reloadedUiMinutes = [];
  for (const page of [pages.a, pages.b]) {
    await driver.activate(page);
    bothUiMinutes.push(Number((await driver.inspectSavedGoal(page, 90)).value));
  }
  for (const page of [pages.a, pages.b]) {
    await driver.reloadSites(page);
    reloadedUiMinutes.push(Number((await driver.inspectSavedGoal(page, 90)).value));
  }
  return requireSettingsConcurrencyGoalEvidence({ initialMinutes: Number(initial.value), requestedMinutes: 120,
    draftBeforeOtherSave: draft.value, draftAfterOtherSave: stale.value,
    otherAppliedMinutes: Number(other.value), otherAppliedPhase: other.phase, otherCommittedMinutes: otherCommitted.siteGoals[DOMAIN],
    appliedMinutes: Number(applied.value), appliedPhase: applied.phase,
    committedMinutes: committed.siteGoals[DOMAIN], bothUiMinutes, reloadedUiMinutes });
}

export function requireSettingsConcurrencyRapidEvidence({ sequence, samples, settled, expectedSettings }) {
  requireProof(Array.isArray(sequence) && sequence.length >= 3
    && Array.isArray(samples) && samples.length === sequence.length
    && samples.every((sample, index) => Object.is(sample.value, sequence[index])
      && sample.dispatch === 'trusted_pointer' && sample.disabled === false)
    && samples.slice(1).some(sample => sample.pendingBeforeInput === true), 'RAPID_OVERLAP_NOT_PROVEN', { samples });
  requireProof(matchesIntegratedArtifactSetting(settled, expectedSettings)
    && isDeepStrictEqual(settled.settings, expectedSettings), 'RAPID_LAST_INTENT_REQUIRED', settled);
  return { sequence, samples, settled };
}

export async function runSettingsConcurrencyRapidInput({ sequence, expectedSettings, click, readSettled, until }) {
  const samples = [];
  // No command-completion wait or canonical settings query between inputs.
  for (const value of sequence) samples.push(await click(value));
  const settled = await until('rapid_last_intent', readSettled, state => (
    matchesIntegratedArtifactSetting(state, expectedSettings)
      && isDeepStrictEqual(state.settings, expectedSettings)
  ));
  return requireSettingsConcurrencyRapidEvidence({ sequence, samples, settled, expectedSettings });
}

export function requireSettingsConcurrencyWorkerEvidence({ stopped, revived, settings, expectedSettings }) {
  requireProof(typeof stopped?.targetId === 'string' && stopped.targetId.length > 0
    && typeof revived?.targetId === 'string' && revived.targetId.length > 0
    && stopped.targetId !== revived.targetId, 'DIFFERENT_WORKER_REQUIRED');
  requireProof(isDeepStrictEqual(settings, expectedSettings), 'WORKER_SETTINGS_CHANGED', { settings });
  return { stoppedTargetId: stopped.targetId, revivedTargetId: revived.targetId, canonicalSettingsMatched: true };
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal, requestInitialOwnedWindowPresentation }) {
  requireProof(plan.target.id === 'settings/concurrency' && plan.target.environmentId === 'ephemeral'
    && artifact.id === 'dev_extension' && artifact.releaseProfile === 'dev' && browser.processOwnership === 'owned'
    && plan.parameters.theme === 'zen', 'OWNED_DEV_REQUIRED');
  const startedAt = Date.now();
  const reportPath = path.join(attachmentsDir, 'settings-concurrency.json');
  const report = { schemaVersion: 1, theme: 'zen', browserStarts: 0,
    steps: SETTINGS_CONCURRENCY_STEPS.map(id => ({ id, status: 'NOT_RUN' })), observations: [],
    scope: { twoDashboardLifetimes: true, fixtureHostPregranted: true,
      excludes: ['permission_prompt', 'propagation_failure_injection', 'idle_tab_close_deadline', 'content_actuation'] } };
  const writeReport = () => fs.writeFile(reportPath, `${JSON.stringify({ ...report, durationMs: Date.now() - startedAt }, null, 2)}\n`);
  registerCleanup('settings_concurrency_evidence', async () => { await writeReport(); return { reportPath }; });
  const temporaryManifest = createSettingsConcurrencyTemporaryManifest();
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    capacityReservationMode: plan.browserCapacityMode,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment, displayReceipt: browser.display,
    renderingRequirement: plan.browserExecution.renderingRequirement, keepTemp: false, temporaryManifest,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, tempPrefix: 'entropy-settings-concurrency-', recoveryJournal });
  registerCleanup('settings_concurrency_browser', () => harness.close());
  await harness.start(); report.browserStarts += 1;
  await reportBrowserGpuCapability(harness.gpuCapability);
  const send = request => sendTrustedRuntimeMessage(harness, request);
  const progression = createSettingsConcurrencyProgressionAccess({ harness, send });
  const dom = (page, expression) => evaluate(harness.cdp, page.sessionId, expression);
  const expectedBuild = { buildId: artifact.buildId, releaseProfile: artifact.releaseProfile };
  async function verifyBuild() {
    const served = await requireEntropyAttachedArtifactRuntimeIdentity(harness, {
      artifactIdentity: { artifactId: artifact.id, inputDigest: artifact.inputDigest, ...expectedBuild },
      temporaryManifest, trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    });
    await requireEntropyTrackingRuntimeReadiness(harness, { expectedBuild });
    return served;
  }
  async function until(label, read, accept, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    let value;
    do {
      signal?.throwIfAborted(); value = await read();
      if (accept(value)) return value;
      await sleep(50);
    } while (Date.now() < deadline);
    requireProof(false, `TIMEOUT:${label}`, value);
  }
  async function observe(label, value) {
    report.observations.push({ label, elapsedMs: Date.now() - startedAt, value });
    await evidence.event('QA_SETTINGS_CONCURRENCY_OBSERVATION', { label, value });
  }
  async function step(id, run) {
    const entry = report.steps.find(item => item.id === id), start = Date.now();
    entry.status = 'RUNNING';
    await evidence.event('QA_SETTINGS_CONCURRENCY_STEP_STARTED', { id });
    try { entry.result = await run(); entry.status = 'PASS'; }
    catch (error) { entry.status = 'FAIL'; entry.error = { message: error.message, diagnostic: error.diagnostic }; throw error; }
    finally { entry.durationMs = Date.now() - start; await writeReport(); await evidence.event('QA_SETTINGS_CONCURRENCY_STEP_FINISHED', entry); }
    return entry.result;
  }
  const pages = {}, diagnostics = {};
  registerCleanup('settings_concurrency_diagnostics', async () => {
    report.pageDiagnostics = {};
    for (const [name, diagnostic] of Object.entries(diagnostics)) {
      report.pageDiagnostics[name] = await diagnostic.snapshot(); diagnostic.dispose();
    }
    return { pages: Object.keys(diagnostics) };
  });
  const dashboardUrl = (tab, domainScoped = true) => settingsConcurrencyDashboardUrl(harness.extensionId, tab, domainScoped);
  async function openDashboard(name, sameWindowAs = null, { domainScoped = true } = {}) {
    const page = await harness.openPage('about:blank', { active: true, sameWindowAs }); pages[name] = page;
    const diagnostic = createDashboardPageDiagnostics({ cdp: harness.cdp, sessionId: page.sessionId });
    diagnostics[name] = diagnostic; await diagnostic.enable(); diagnostic.markNavigationRequested();
    await harness.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await harness.navigatePage(page, dashboardUrl('sites', domainScoped));
    return page;
  }
  async function activate(page) {
    const receipt = await harness.activateOwnedEphemeralPageWithoutWindowFocus(page);
    await until('native_document_visible', () => dom(page, '({ hidden: document.hidden, visibilityState: document.visibilityState })'),
      value => value.hidden === false && value.visibilityState === 'visible');
    return receipt;
  }
  async function screenshot(page, name) {
    const capture = await harness.cdp.send('Page.captureScreenshot', { format: 'png' }, page.sessionId);
    const file = `${name}.png`; await fs.writeFile(path.join(attachmentsDir, file), Buffer.from(capture.data, 'base64')); return file;
  }
  async function controlState(page, expression, scroll = false) {
    return dom(page, `(() => {
      const node = (${expression});
      const state = { present: Boolean(node), bootShellPresent: Boolean(document.getElementById('entropy-dashboard-boot-shell')),
        hidden: document.hidden, visibilityState: document.visibilityState };
      if (!node) return state;
      if (${scroll}) node.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = node.getBoundingClientRect(), style = getComputedStyle(node);
      const point = { x: r.x + r.width / 2, y: r.y + r.height / 2 }, hit = document.elementFromPoint(point.x, point.y);
      return { ...state, point, focused: document.activeElement === node, value: 'value' in node ? node.value : null,
        inert: Boolean(node.closest('[inert]')), disabled: node.disabled === true || node.getAttribute('aria-disabled') === 'true',
        visible: !document.hidden && r.width > 0 && r.height > 0 && style.visibility === 'visible' && Number(style.opacity) > 0,
        hit: hit !== null && node.contains(hit) };
    })()`);
  }
  async function pointer(page, point) {
    signal?.throwIfAborted();
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }, page.sessionId);
    for (const type of ['mousePressed', 'mouseReleased']) await harness.cdp.send('Input.dispatchMouseEvent', {
      type, ...point, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1,
    }, page.sessionId);
  }
  async function click(page, expression) {
    const state = await until('input_ready', () => controlState(page, expression, true), isIntegratedControlReady, 45_000);
    await pointer(page, state.point); return state;
  }
  async function pressKey(page, key, virtualCode, modifiers = 0) {
    for (const type of ['keyDown', 'keyUp']) await harness.cdp.send('Input.dispatchKeyEvent', {
      type, key, code: key, windowsVirtualKeyCode: virtualCode, modifiers,
    }, page.sessionId);
  }
  async function readSettings() {
    const response = await send({ action: MESSAGE_ACTIONS.GET_SETTINGS, keys: SETTINGS_KEYS });
    const missingKeys = SETTINGS_KEYS.filter(key => !response?.settings || !Object.hasOwn(response.settings, key));
    requireProof(response?.success === true && response.settings && missingKeys.length === 0, 'SETTINGS_READ', {
      success: response?.success, error: response?.error, missingKeys,
      presentKeys: response?.settings ? Object.keys(response.settings) : [],
    });
    return response.settings;
  }
  async function settings(items) {
    const response = await send({ action: MESSAGE_ACTIONS.SET_SETTINGS, items, waitForPropagation: true });
    requireProof(response?.success === true && Array.isArray(response.changedKeys), 'SETTINGS_WRITE', {
      success: response?.success, error: response?.error, requestedKeys: Object.keys(items),
    });
    return requireConsumptionQaSettingsAcknowledgement(response, items);
  }
  async function capState(page) {
    return dom(page, `(${inspectSettingsConcurrencyCap.toString()})(${JSON.stringify({ domain: DOMAIN })})`);
  }
  async function openGoal(page) {
    await openIntegratedSitesManagement({ readDom: expression => dom(page, expression),
      click: expression => click(page, expression), until, hostname: DOMAIN });
    if (!(await capState(page)).expanded) await click(page, CAP_TRIGGER);
    return until('cap_input', () => capState(page), value => typeof value.value === 'string' && !value.busy && value.errors.length === 0);
  }
  async function editGoal(page, minutes) {
    await openGoal(page); await click(page, CAP_INPUT);
    await until('cap_focus', () => controlState(page, CAP_INPUT), state => isIntegratedControlReady(state) && state.focused);
    await pressKey(page, 'a', 65, 2);
    await harness.cdp.send('Input.insertText', { text: String(minutes) }, page.sessionId);
    return until('cap_draft', () => capState(page), value => value.value === String(minutes) && !value.busy);
  }
  async function saveGoal(page, appliedMinutes) {
    const options = JSON.stringify({ key: CAP_SAVE_OBSERVER_KEY, domain: DOMAIN, appliedMinutes });
    const armed = await dom(page, `(${installSettingsConcurrencyCapSaveObservation.toString()})(${options})`);
    requireProof(armed?.status === 'armed', 'CAP_SAVE_OBSERVER_REQUIRED', armed);
    let saveError;
    try {
      await click(page, CAP_SAVE);
      const observed = await until('cap_ack', () => dom(page, `(() => {
        const observation = window[${JSON.stringify(CAP_SAVE_OBSERVER_KEY)}];
        if (!observation) throw new Error('QA_SETTINGS_CONCURRENCY_CAP_SAVE_OBSERVER_MISSING');
        return observation.read();
      })()`), value => {
        requireProof(value.status !== 'failed', value.error, value);
        return value.status === 'succeeded';
      }, 30_000);
      requireProof(observed.receipt.phase === 'success' && observed.receipt.value === String(appliedMinutes)
        && observed.receipt.errors.length === 0, 'CAP_SAVE_RECEIPT_INVALID', observed);
      return observed.receipt;
    } catch (error) { saveError = error; throw error;
    } finally {
      try {
        const disposed = await dom(page, `(() => { const observation = window[${JSON.stringify(CAP_SAVE_OBSERVER_KEY)}];
          if (observation) observation.dispose(); return !Object.hasOwn(window, ${JSON.stringify(CAP_SAVE_OBSERVER_KEY)}); })()`);
        requireProof(disposed === true, 'CAP_SAVE_OBSERVER_CLEANUP_FAILED');
      } catch {
        if (!saveError) requireProof(false, 'CAP_SAVE_OBSERVER_CLEANUP_FAILED');
        saveError.diagnostic = { observation: saveError.diagnostic, cleanup: { code: 'CAP_SAVE_OBSERVER_CLEANUP_FAILED' } };
      }
    }
  }
  async function inspectSavedGoal(page, minutes) {
    await openIntegratedSitesManagement({ readDom: expression => dom(page, expression),
      click: expression => click(page, expression), until, hostname: DOMAIN });
    // Initial/reloaded pages must first admit their actual saved cap control.
    // A missing readout is UI initialization, not a pending save or an idle phase.
    await until('cap_readout_ready', async () => ({ cap: await capState(page),
      control: await controlState(page, CAP_TRIGGER, true) }), matchesSettingsConcurrencySavedCapReady, 45_000);
    return until('cap_current_saved_value', async () => {
      const value = await openGoal(page);
      await click(page, `(${CAP_FORM})?.querySelector('button[type="button"]')`);
      return value;
    }, value => value.value === String(minutes));
  }
  const readPresentation = page => readIntegratedDashboardPresentation(expression => dom(page, expression));
  async function presentSites(page) {
    const presented = await presentSettingsConcurrencySites({ until, readPresentation, click,
      ensureSelectedDomain: async selectedPage => {
        if (!(await capState(selectedPage)).present) {
          await click(selectedPage, `Array.from(document.querySelectorAll('button[aria-controls="sites-site-detail"]')).find(node => node.title === '${DOMAIN}')`);
        }
      } }, page);
    await observe('sites_presented', { targetId: page.targetId, ...presented, domain: DOMAIN });
  }
  async function reloadSites(page) {
    await activate(page); await harness.navigatePage(page, dashboardUrl('sites'));
    await presentSites(page);
  }
  const artifactRow = child => `document.querySelector('[data-artifact-control-child-key="${child}"]')`;
  const artifactChoice = (child, value) => buildIntegratedArtifactChoiceContract(child, value).choice;
  async function selectArtifact(page, family, child) {
    await until('artifact_navigation_released', () => readPresentation(page), matchesSettingsConcurrencyNavigationReleased, 45_000);
    await click(page, `document.querySelector('[data-tab="tools"]')`);
    await selectSettingsArtifactGalleryFamily({ until, click,
      readNavigation: ownedPage => readSettingsArtifactGalleryNavigation(expression => dom(ownedPage, expression)),
    }, page, family);
    await until('artifact_family', () => dom(page, `Boolean(${artifactRow(child)})`), Boolean);
    await openIntegratedArtifactControl({ until, click, readDom: dom }, page, child);
  }
  async function readArtifact(page, child, value) {
    return { settings: await readSettings(), control: await dom(page, buildIntegratedArtifactChoiceContract(child, value).read) };
  }
  async function verifyBothArtifacts(expectedSettings, reload = false) {
    const results = [];
    for (const page of [pages.a, pages.b]) {
      await activate(page);
      if (reload) await harness.navigatePage(page, dashboardUrl('tools'));
      await selectArtifact(page, 'lens', 'blur');
      await until('both_lens', () => readArtifact(page, 'blur', 'on'), state => matchesIntegratedArtifactSetting(state, expectedSettings));
      await selectArtifact(page, 'echo', 'tabEvaporation');
      const echo = await until('both_echo', () => readArtifact(page, 'tabEvaporation', 10), state => matchesIntegratedArtifactSetting(state, expectedSettings));
      results.push({ targetId: page.targetId, canonicalSettingsMatched: isDeepStrictEqual(echo.settings, expectedSettings), selected: true, pending: false });
    }
    requireProof(results.every(result => result.canonicalSettingsMatched), 'BOTH_ARTIFACTS_MISMATCH');
    return results;
  }
  async function rapid(child, family, sequence, expectedSettings) {
    await activate(pages.a); await selectArtifact(pages.a, family, child);
    return runSettingsConcurrencyRapidInput({ sequence, expectedSettings, until,
      readSettled: () => readArtifact(pages.a, child, sequence.at(-1)),
      click: async value => {
        const state = await controlState(pages.a, artifactChoice(child, value), true);
        const pendingBeforeInput = (await dom(pages.a, buildIntegratedArtifactChoiceContract(child, value).read)).pending;
        requireProof(isIntegratedControlReady(state), state.disabled ? 'RAPID_INPUT_DISABLED' : 'RAPID_INPUT_NOT_READY', { value, state, pendingBeforeInput });
        await pointer(pages.a, state.point);
        return { value, pendingBeforeInput, disabled: false, dispatch: 'trusted_pointer', elapsedMs: Date.now() - startedAt };
      } });
  }
  try {
    await step('fresh_dashboard', async () => {
      const build = await verifyBuild();
      const canonicalPreparation = await progression.prepareCanonicalDayZero();
      await observe('canonical_first_use_prepared', canonicalPreparation);
      const a = await openDashboard('a', null, { domainScoped: false }); await harness.activateOwnedEphemeralPageWithoutWindowFocus(a);
      requireProof(plan.protocolOptions.initialWindowPresentation === 'windows_agent_present_once', 'INITIAL_WINDOW_POLICY_REQUIRED');
      if (allowsQaOwnedInitialWindowPresentation(plan)) {
        requireProof(typeof requestInitialOwnedWindowPresentation === 'function', 'INITIAL_WINDOW_OWNER_REQUIRED');
        await observe('initial_window_presentation', await requestInitialOwnedWindowPresentation({ child: harness.chrome, cdp: harness.cdp, targetId: a.targetId, tabId: a.tabId }));
      }
      await activate(a);
      const firstUse = await completeIntegratedFirstUseOffPolicy({ label: 'settings_concurrency', until,
        openEntry: () => openIntegratedFirstUseRegistration({ label: 'settings_concurrency', until,
          click: expression => click(a, expression), readPolicy: () => readIntegratedFirstUsePolicy(send),
          readRules: () => readIntegratedRestorationRuleMembership(send),
          readDayZero: () => progression.readDayZeroDisclosure(),
          capture: () => screenshot(a, '00-day-zero-entry'),
          readEntry: () => readIntegratedFirstUseEntry({ themeId: 'zen',
            readDom: expression => dom(a, expression), readControl: expression => controlState(a, expression) }),
        }),
        afterCommit: async () => {
          await observe('feature_access_prepared', await progression.prepareFeatureAccess());
          await harness.reloadPage(a);
          const presented = await presentSettingsConcurrencySitesWorkspace({ until, readPresentation, click }, a);
          await observe('sites_workspace_presented', { pageTargetId: a.targetId, ...presented });
        },
        readPolicy: () => readIntegratedFirstUsePolicy(send), click: expression => click(a, expression),
        pressKey: (key, code) => pressKey(a, key, code), readSitesControl: () => controlState(a, SEARCH),
        capture: () => screenshot(a, '01-first-use-off'), observePolicyInvalidation: sample => observe('first_use_invalidated', sample),
        readUi: () => readIntegratedFirstUseUi({ readDom: expression => dom(a, expression),
          readControl: expression => controlState(a, expression) }),
      });
      return { build, canonicalPreparation, firstUse };
    });
    await step('two_dashboards', async () => {
      const filters = structuredClone(CONFIG_DEFAULT_FILTER_SETTINGS); filters.blur.isActive = false;
      await settings({ 'app-theme': 'zen', filterSettings: filters, filteringMode: 'blocklist', rulesMode: 'managed',
        permissionMode: 'selective', dataCollectionMode: 'all_sites_minimal', insightsConsent: 'all_sites', trackingExcludedUrls: [],
        tabEvaporationForBlocked: false, tabEvaporationTimeoutMinutes: 5,
        nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS), gateConfig: structuredClone(DEFAULT_GATE_CONFIG) });
      // Materialize both rule lists through their canonical owner in this fresh
      // fixture: an exact allowed-to-blocked move leaves a persisted empty list.
      requireSettingsRuntimeCommandAcknowledgement(MESSAGE_ACTIONS.UPSERT_SITE_RULE,
        await send({ action: MESSAGE_ACTIONS.UPSERT_SITE_RULE, domain: DOMAIN, type: 'allowed', waitForPropagation: true }));
      const seeded = requireSettingsRuntimeCommandAcknowledgement(MESSAGE_ACTIONS.UPSERT_SITE_RULE,
        await send({ action: MESSAGE_ACTIONS.UPSERT_SITE_RULE, domain: DOMAIN, type: 'blocked', confirmExactMove: true, goalMinutes: 30, waitForPropagation: true }));
      requireProof(seeded.items.siteGoals?.[DOMAIN] === 30
        && Array.isArray(seeded.items.allowedUrls) && seeded.items.allowedUrls.length === 0
        && seeded.propagation?.status === 'succeeded', 'GOAL_SEED_ACK_REQUIRED');
      await presentSites(pages.a);
      await until('a_goal_seed', () => inspectSavedGoal(pages.a, 30), Boolean);
      const b = await openDashboard('b', pages.a); await activate(b);
      await presentSites(b);
      await until('b_goal_seed', () => inspectSavedGoal(b, 30), Boolean);
      requireProof(pages.a.targetId !== b.targetId && pages.a.tabId !== b.tabId && pages.a.sessionId !== b.sessionId, 'TWO_LIFETIMES_REQUIRED');
      return { aTargetId: pages.a.targetId, bTargetId: b.targetId, initialMinutes: 30 };
    });
    await step('stale_site_goal', async () => {
      const goal = await runSettingsConcurrencyGoalConflict({ activate, editGoal, openGoal, saveGoal, inspectSavedGoal, reloadSites,
        waitGoal: minutes => until('canonical_goal', readSettings, settings => settings.siteGoals[DOMAIN] === minutes) }, pages);
      return { ...goal, screenshot: await screenshot(pages.b, '02-sites-converged') };
    });
    let expected;
    await step('rapid_lens', async () => {
      expected = await readSettings(); expected.filterSettings.blur.isActive = true;
      return rapid('blur', 'lens', ['on', 'off', 'on'], expected);
    });
    await step('rapid_echo', async () => {
      expected = { ...structuredClone(expected), tabEvaporationForBlocked: true, tabEvaporationTimeoutMinutes: 10 };
      const result = await rapid('tabEvaporation', 'echo', [10, 5, 10, 'off', 10], expected);
      return { ...result, bothUi: await verifyBothArtifacts(expected), screenshot: await screenshot(pages.b, '03-artifacts-converged') };
    });
    await step('worker_revival', async () => {
      const beforeReload = await verifyBothArtifacts(expected, true);
      const stopped = await harness.stopServiceWorker();
      const build = await verifyBuild();
      const settings = await readSettings();
      const revived = await harness.waitForServiceWorker({ previousTargetId: stopped.targetId });
      const worker = requireSettingsConcurrencyWorkerEvidence({ stopped, revived, settings, expectedSettings: expected });
      const bothUi = await verifyBothArtifacts(expected, true);
      return { ...worker, build, beforeReload, bothUi, screenshot: await screenshot(pages.b, '04-worker-revival') };
    });
    requireSettingsConcurrencyComplete(report.steps);
    return { status: 'PASS', buildId: artifact.buildId, verdictScope: 'product', reportPath, steps: report.steps,
      scope: report.scope, browserStarts: report.browserStarts };
  } catch (error) {
    await observe('failure', { message: error.message, diagnostic: error.diagnostic });
    try {
      await observe('failure_window_attribution', await observeIntegratedFailureWindows({ harness, pages, recoveryJournal }));
    } catch {
      await observe('failure_window_attribution', { status: 'unavailable', code: 'QA_SETTINGS_FAILURE_WINDOW_OBSERVATION_FAILED', focusRequested: false });
    }
    for (const [name, page] of Object.entries(pages)) {
      try { await screenshot(page, `failure-${name}`); }
      catch (captureError) { await observe(`failure_capture_${name}`, { message: String(captureError.message).slice(0, 160) }); }
    }
    throw error;
  }
}
