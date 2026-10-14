import fs from 'node:fs/promises';
import path from 'node:path';
import { readQaCdpPageTargetWindow } from '../../browser-qa/browser/cdpTargetOwner.mjs';
import { ExtensionChromiumHarness, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { defineEntropyQaAttachedArtifactStage, ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { openEntropyAttachOnlyActivePage, proveEntropyAttachedArtifactRuntimeReadiness,
  requireEntropyAttachedPageExecution,
  requireEntropyTrackingAdmission } from './attachOnlyActivePageAdapter.mjs';
import { sendTrustedRuntimeMessage, sendGateAutomation, waitForGateSurface, driveContinueOutcome, inspectGatePage } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { GATE_QA_AUTOMATION_ACTIONS as GATE } from '../../../src/domains/protection/background/automation/gateQaAutomationContract.dev.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { requireShishiConsumptionLevel } from '../../../src/domains/protection/domain/shishiConsumptionLevel.js';
import { DEFAULT_THEME_ID } from '../../../src/themes/core/ids.js';
import { SYNC_SETTINGS_DEFAULTS } from '../../../src/domains/settings/config/siteRules.js';
import { GATE_ENTRY_DEPARTURE_MS, GATE_ENTRY_OBSERVATION_GAP_MS } from '../../../src/domains/protection/background/runtime/gateEntryApprovalPolicy.js';

const SITES = Object.freeze({ youtube: 'https://www.youtube.com/', x: 'https://x.com/home', outside: 'https://example.com/' });
function requireProof(value, code) { if (!value) throw new Error(`QA_PROTECTED_SITES_${code}`); }

// No candidate, model, clock, foreground or history injection. A no-focus
// browser may provide only unknown consumption evidence: report that limit.
export function classifyProtectedSitesCoverage({ protectedDeltaMs, unknownDeltaMs, gatePresented, sourceSequenceVerified }) {
  requireProof(Number.isFinite(protectedDeltaMs) && protectedDeltaMs >= 0
    && Number.isFinite(unknownDeltaMs) && unknownDeltaMs >= 0 && typeof gatePresented === 'boolean'
    && typeof sourceSequenceVerified === 'boolean', 'COVERAGE_INVALID');
  return protectedDeltaMs >= 120_000 && gatePresented && sourceSequenceVerified ? 'PASS' : 'INCONCLUSIVE';
}

export function hasProtectedSourceSequence({ contexts, since, tabIds }) {
  const sources = contexts.filter((context) => context.endedAt - Math.max(context.startedAt, since) >= 30_000)
    .map((context) => context.tabId);
  return sources.some((id, index) => id === tabIds[0]
    && tabIds.every((tabId, offset) => sources[index + offset] === tabId));
}

export function hasNewReadyDocument(diagnostic, { predecessorId, notBefore, url }) {
  const session = diagnostic?.snapshot?.currentSession;
  return diagnostic?.success === true && session?.status === 'active'
    && typeof session.documentId === 'string' && session.documentId.length > 0
    && session.documentId !== predecessorId && session.startedAt >= notBefore
    && session.url === url && session.failedAt === null && session.error === null;
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, recoveryJournal, signal }) {
  requireProof(artifact.id === 'dev_extension' && browser.processOwnership === 'attach_only', 'MANAGED_DEV_REQUIRED');
  const attachedArtifactStage = defineEntropyQaAttachedArtifactStage({ browser, browserExecution: plan.browserExecution,
    sourceDir: artifact.path, artifactIdentity: { artifactId: artifact.id, inputDigest: artifact.inputDigest,
      buildId: artifact.buildId, releaseProfile: artifact.releaseProfile },
    temporaryManifest: { requiredPermissions: ['scripting'], requiredHostPermissions: Object.values(SITES).map((url) => `${new URL(url).origin}/*`) } });
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: browser.extensionSlot,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement, cdpEndpoint: browser.cdpEndpoint,
    expectedBrowserIdentity: browser.browserIdentity, attachedArtifactStage, keepTemp: false,
    qaProfileDir: browser.profile, qaProfileDirectory: browser.profileDirectory, loadInPlace: true,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, attachedArtifactRuntimeReadiness: proveEntropyAttachedArtifactRuntimeReadiness,
    recoveryJournal });
  registerCleanup('protected_sites_browser', () => harness.close());
  const trace = [];
  registerCleanup('protected_sites_trace', async () => {
    await fs.writeFile(path.join(attachmentsDir, 'protected-sites-trace.json'), JSON.stringify(trace, null, 2));
    return { samples: trace.length };
  });
  await harness.start(); await reportBrowserGpuCapability(harness.gpuCapability);
  async function record(label, value) {
    trace.push({ label, at: Date.now(), value }); await evidence.event('QA_PROTECTED_SITES_BOUNDARY', { label, value });
    console.log(JSON.stringify({ event: 'QA_PROTECTED_SITES_PROGRESS', label })); return value;
  }
  async function settings(items) {
    return requireConsumptionQaSettingsAcknowledgement(await sendTrustedRuntimeMessage(harness,
      { action: MESSAGE_ACTIONS.SET_SETTINGS, items, waitForPropagation: true }), items);
  }
  const read = (page) => sendGateAutomation(harness, { action: GATE.READ_CONSUMPTION, targetTabId: page.tabId });
  const diagnostics = (page) => sendTrustedRuntimeMessage(harness,
    { action: MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS, targetTabId: page.tabId, limit: 120 });
  async function executionReady(page, label) {
    await record(label, await requireEntropyAttachedPageExecution(harness, page, plan.browserObservation));
  }
  const open = (url) => openEntropyAttachOnlyActivePage({ harness, url,
    browserExecution: plan.browserExecution, observation: plan.browserObservation });
  async function until(label, readValue, accept, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    let value;
    do {
      signal?.throwIfAborted(); value = await readValue();
      if (accept(value)) return record(label, value);
      await sleep(500);
    } while (Date.now() < deadline);
    await record(`${label}_timeout`, value); throw new Error(`QA_PROTECTED_SITES_TIMEOUT:${label}`);
  }
  async function activate(page) {
    await harness.activateOwnedPageWithoutWindowFocus(page);
    if (plan.browserObservation === 'foreground') await requireEntropyTrackingAdmission(harness, page);
  }
  async function observe(page, label, durationMs = 75_000) {
    await activate(page);
    const started = Date.now();
    let nextProbe = started;
    while (Date.now() - started < durationMs) {
      signal?.throwIfAborted();
      if (Date.now() >= nextProbe) {
        await executionReady(page, `${label}_execution`);
        nextProbe = Date.now() + 15_000;
      }
      // Fixed wheel-only input. No social clicks, media start, model-driven
      // stimulus or browser-window focus request.
      await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 460, y: 360,
        deltaX: 0, deltaY: 360 }, page.sessionId);
      await sleep(5000);
    }
    return record(label, { consumption: await read(page), diagnostics: await diagnostics(page) });
  }
  const configuration = { 'app-theme': 'zen', filteringMode: 'blocklist', permissionMode: 'selective', rulesMode: 'managed',
    historyCleanupForBlocked: false, concealBlockedBookmarks: false,
    dataCollectionMode: 'all_sites_minimal', insightsConsent: 'all_sites',
    nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS), gateConfig: structuredClone(DEFAULT_GATE_CONFIG) };
  const keys = Object.keys(configuration);
  const original = await sendTrustedRuntimeMessage(harness, { action: MESSAGE_ACTIONS.GET_SETTINGS,
    keys: [...keys, 'blockedUrls', 'allowedUrls'],
    defaults: { 'app-theme': DEFAULT_THEME_ID, allowedUrls: SYNC_SETTINGS_DEFAULTS.allowedUrls } });
  await record('configuration_snapshot', original);
  requireProof(original?.success && keys.every((key) => Object.hasOwn(original.settings, key))
    && Array.isArray(original.settings.blockedUrls) && Array.isArray(original.settings.allowedUrls), 'SETTINGS_SNAPSHOT');
  const addedRules = [];
  let ownedEntrySessionId = null;
  let entryTabId = null;
  registerCleanup('protected_sites_configuration', async () => {
    // Disable the run's entry trigger before removing only the run's rules.
    // Restore settings through their owner; never restore a raw storage dump.
    await settings({ gateConfig: structuredClone(DEFAULT_GATE_CONFIG) });
    if (ownedEntrySessionId !== null) {
      const released = await sendGateAutomation(harness, { action: GATE.RELEASE_ENTRY_APPROVAL,
        targetTabId: entryTabId, payload: { sessionId: ownedEntrySessionId } });
      requireProof(released.released || released.reason === 'different_session', 'ENTRY_APPROVAL_CLEANUP');
    }
    for (const domain of addedRules) {
      const reply = await sendTrustedRuntimeMessage(harness, { action: MESSAGE_ACTIONS.REMOVE_SITE_RULE,
        domain, type: 'blocked', waitForPropagation: true });
      requireProof(reply?.success && reply.propagation?.status === 'succeeded', 'RULE_RESTORE_ACK');
    }
    await settings(Object.fromEntries(keys.map((key) => [key, original.settings[key]])));
    return { restored: true, removedOwnedRules: addedRules };
  });
  const matches = (hostname, domain) => hostname === domain || hostname.endsWith(`.${domain}`);
  requireProof(!original.settings.blockedUrls.some((domain) => matches('example.com', domain)), 'OUTSIDE_ALREADY_PROTECTED');
  await settings(configuration);
  for (const hostname of ['www.youtube.com', 'x.com']) {
    requireProof(!original.settings.allowedUrls.some((domain) => matches(hostname, domain)), 'SITE_EXPLICITLY_ALLOWED');
    if (original.settings.blockedUrls.some((domain) => matches(hostname, domain))) continue;
    // Existing domain rules, budgets, presets and their metadata are preserved.
    addedRules.push(hostname);
    const reply = await sendTrustedRuntimeMessage(harness, { action: MESSAGE_ACTIONS.UPSERT_SITE_RULE,
      domain: hostname, type: 'blocked', goalMinutes: 60, waitForPropagation: true });
    requireProof(reply?.success && reply.propagation?.status === 'succeeded', 'RULE_ACK');
  }
  const pages = {};
  try {
    // Prove the actual presentation before the multi-minute consumption soak.
    // This page also serves as the outside phase and the automatic entry source.
    const preparation = await open(SITES.outside);
    pages.outside = preparation.page;
    const entryState = await record('entry_approval_baseline', await read(preparation.page));
    requireProof(typeof entryState.entryApproval?.approved === 'boolean', 'ENTRY_APPROVAL_OWNER_REQUIRED');
    if (entryState.entryApproval.approved) return { status: 'BLOCKED', reason: 'existing_entry_approval_preserved' };
    await record('opened_outside', preparation.receipt);
    await executionReady(preparation.page, 'initial_execution');
    const preparationSites = plan.parameters.scope === 'entry' ? {} : { youtube: SITES.youtube, x: SITES.x };
    for (const [id, url] of Object.entries(preparationSites)) {
      const admission = await open(url);
      pages[id] = admission.page;
      await record(`opened_${id}`, admission.receipt);
    }
    const { youtube, x, outside } = pages;
    let initial, beforeOutside;
    if (plan.parameters.scope === 'journey') {
      initial = await until('initial_model', () => read(youtube), (s) => s.memory.status === 'ready', 100_000);
      await observe(youtube, 'youtube_first');
      await observe(x, 'x_between');
      beforeOutside = await observe(youtube, 'youtube_return');
      const outsideStartedAt = Date.now();
      const afterOutside = await observe(outside, 'outside_unknown');
      requireProof(afterOutside.consumption.memory.status === 'ready', 'MODEL_LOST');
      const outsideDelta = afterOutside.consumption.memory.projection.durations.outside
        - beforeOutside.consumption.memory.projection.durations.outside;
      requireProof(outsideDelta >= 0 && outsideDelta <= Date.now() - outsideStartedAt,
        'OUTSIDE_EXCEEDS_OBSERVED_INTERVAL');
      // Switching away closes the final protected context through Tracking.
      // Read its committed facts, rather than accepting an unfinished segment.
      beforeOutside = afterOutside;
    }
    // Ordinary entry policy is turned on through settings, then a real document
    // navigation generates the candidate. No PRESENT_GATE or score fixture.
    await settings({ gateConfig: { ...DEFAULT_GATE_CONFIG, entryCheckpoint: { enabled: true } } });
    const entry = outside;
    await activate(entry);
    const navigationAt = Date.now();
    await harness.navigatePage(entry, SITES.youtube);
    const gate = await until('automatic_entry', () => read(entry), (s) => s.session?.gateKind === 'entryCheckpoint');
    ownedEntrySessionId = gate.session.sessionId;
    entryTabId = entry.tabId;
    const frozen = requireShishiConsumptionLevel(gate.session.metrics.shishiIntensity);
    requireProof(frozen.reason !== 'manual_qa_fixture', 'FIXTURE_GATE_FORBIDDEN');
    await waitForGateSurface(harness, entry);
    await record('gate_level', { navigationAt, frozen, memory: gate.memory });
    await executionReady(entry, 'gate_render_delivery');
    const predecessor = await diagnostics(entry);
    requireProof(predecessor?.success && typeof predecessor.snapshot?.currentSession?.documentId === 'string',
      'PREDECESSOR_DOCUMENT_REQUIRED');
    const continueStartedAt = Date.now();
    try {
      await driveContinueOutcome(harness, entry, SITES.youtube);
    } catch (error) {
      await record('continue_failed', { error: error.message, page: await inspectGatePage(harness, entry),
        consumption: await read(entry), diagnostics: await diagnostics(entry) });
      throw error;
    }
    const recovered = await until('new_document_ready', () => diagnostics(entry), (d) => hasNewReadyDocument(d,
      { predecessorId: predecessor.snapshot.currentSession.documentId, notBefore: continueStartedAt, url: SITES.youtube }));
    // Repeat same-URL document replacement. Automatic protection uses its
    // document-bound transaction; cached readiness must not apply to a successor.
    const oldDocument = recovered.snapshot.currentSession.documentId;
    const reloadStartedAt = Date.now();
    await harness.reloadPage(entry);
    const latest = await until('reload_document_ready', () => diagnostics(entry), (d) => hasNewReadyDocument(d,
      { predecessorId: oldDocument, notBefore: reloadStartedAt, url: SITES.youtube }));
    const session = latest.snapshot.currentSession;
    requireProof(session.documentId && session.failedAt === null && session.error === null, 'RELOAD_FAILED');
    const approved = await record('approved_after_reload', await read(entry));
    requireProof(approved.entryApproval.approved && approved.entryApproval.sessionId === ownedEntrySessionId,
      'EXPLICIT_ENTRY_APPROVAL_REQUIRED');
    // Beyond scheduler recovery, a different protected domain must still honor
    // the same explicit decision. No clock, model or candidate is injected.
    const recovery = await sendGateAutomation(harness, { action: GATE.READ_EXPOSURE, targetTabId: entry.tabId });
    await record('recovery_before_shared_entry', recovery);
    await sleep(46_000);
    await settings({ gateConfig: { ...DEFAULT_GATE_CONFIG, entryCheckpoint: { enabled: true } } });
    const switchedAt = Date.now();
    await harness.navigatePage(entry, SITES.x);
    await until('cross_domain_ready', () => diagnostics(entry), (d) => hasNewReadyDocument(d,
      { predecessorId: session.documentId, notBefore: switchedAt, url: SITES.x }));
    const final = await record('final', await read(entry));
    await record('final_window', await readQaCdpPageTargetWindow(harness.cdp, entry.targetId));
    requireProof(final.session === null, 'ENTRY_REPLAYED_AFTER_CONTINUE');
    requireProof(final.entryApproval.approved && final.entryApproval.decisionAt === approved.entryApproval.decisionAt,
      'SHARED_ENTRY_APPROVAL_CHANGED');
    const anotherOpenedAt = Date.now();
    const another = (await open(SITES.youtube)).page;
    await until('second_protected_tab_ready', () => diagnostics(another), (d) => hasNewReadyDocument(d,
      { predecessorId: session.documentId, notBefore: anotherOpenedAt, url: SITES.youtube }));
    for (const page of [entry, another, entry]) {
      await activate(page);
      const snapshot = await read(page);
      requireProof(snapshot.session === null && snapshot.entryApproval.approved
        && snapshot.entryApproval.sessionId === ownedEntrySessionId, 'MULTITAB_APPROVAL_LOST');
    }
    const oldWorker = await harness.stopServiceWorker();
    const resumed = await record('approved_worker_restart', await read(entry));
    await harness.waitForServiceWorker({ previousTargetId: oldWorker.targetId });
    requireProof(resumed.entryApproval.approved && resumed.entryApproval.decisionAt === approved.entryApproval.decisionAt,
      'APPROVAL_RESTART_LOST');
    await settings({ gateConfig: { ...DEFAULT_GATE_CONFIG, entryCheckpoint: { enabled: true } } });
    let departure = null;
    if (plan.parameters.verifyDeparture) {
      // Real elapsed time and the existing Tracking heartbeat only. Reads cannot
      // advance departure; missing/engaged samples make this run inconclusive.
      await activate(another);
      await harness.navigatePage(another, SITES.outside);
      const observationDeadline = Date.now() + 100_000;
      let start;
      do {
        signal?.throwIfAborted();
        start = await read(another);
        if (start.entryApproval.approved && start.entryApproval.awaySince !== null) break;
        await sleep(5000);
      } while (Date.now() < observationDeadline);
      await record('departure_observed', start);
      if (!start.entryApproval.approved || start.entryApproval.awaySince === null) return {
        status: 'INCONCLUSIVE', reason: 'departure_not_observed', observed: start.entryApproval,
        scope: 'entry/multitab/restart passed; live presence did not establish the departure prerequisite' };
      const since = start.entryApproval.awaySince;
      const deadline = since + GATE_ENTRY_DEPARTURE_MS;
      let halfChecked = false;
      let previousObservedAt = start.entryApproval.observedAt;
      let ended = null;
      while (Date.now() <= deadline + GATE_ENTRY_OBSERVATION_GAP_MS) {
        signal?.throwIfAborted();
        const snapshot = await read(another);
        const intent = snapshot.entryApproval;
        requireProof(intent.sessionId === ownedEntrySessionId && snapshot.session === null, 'DEPARTURE_QUEUED_GATE');
        if (intent.approved && (intent.awaySince !== since
          || intent.observedAt - previousObservedAt > GATE_ENTRY_OBSERVATION_GAP_MS)) {
          return { status: 'INCONCLUSIVE', reason: 'continuous_departure_not_observed',
            scope: 'entry/multitab/restart passed; real departure continuity changed', observed: intent };
        }
        previousObservedAt = intent.observedAt;
        if (!halfChecked && intent.observedAt >= since + 5 * 60_000 && intent.observedAt < deadline) {
          requireProof(intent.approved, 'FIVE_MINUTE_DEPARTURE_REVOKED_ENTRY');
          await record('five_minute_departure_keeps_entry', intent); halfChecked = true;
        }
        if (!intent.approved) {
          requireProof(intent.observedAt >= deadline && halfChecked, 'ENTRY_EXPIRED_WITHOUT_OBSERVED_DEPARTURE');
          ended = await record('ten_minute_departure_ends_entry', intent); break;
        }
        await sleep(5000);
      }
      if (!ended) return { status: 'INCONCLUSIVE', reason: 'departure_heartbeat_not_completed',
        scope: 'entry/multitab/restart passed; no expiry was fabricated' };
      await harness.navigatePage(another, SITES.youtube);
      const nextGate = await until('fresh_entry_after_departure', () => read(another), (s) => s.session?.gateKind === 'entryCheckpoint');
      requireProof(nextGate.session.sessionId !== ownedEntrySessionId, 'OLD_GATE_REPLAYED');
      await waitForGateSurface(harness, another);
      departure = { since, ended, nextSessionId: nextGate.session.sessionId };
    }
    if (plan.parameters.scope === 'entry') return { status: 'PASS', frozen,
      departure, scope: 'automatic entry, Continue, reload, cross-domain and multi-tab approval, worker restart; optional real departure; consumption journey not exercised' };
    const before = initial.memory.projection.durations;
    const after = beforeOutside.consumption.memory.projection.durations;
    const sourceSequenceVerified = hasProtectedSourceSequence({ contexts: beforeOutside.consumption.flow.contexts,
      since: initial.now, tabIds: [youtube.tabId, x.tabId, youtube.tabId] });
    const coverage = { protectedDeltaMs: after.protected_use - before.protected_use,
      unknownDeltaMs: after.unknown - before.unknown, gatePresented: true, sourceSequenceVerified };
    const status = classifyProtectedSitesCoverage(coverage);
    await record('coverage', { status, ...coverage, limit: status === 'INCONCLUSIVE'
      ? 'No-focus browser supplied insufficient confirmed foreground; no focus/consumption was fabricated.' : null });
    return { status, coverage, frozen, departure, tracePath: path.join(attachmentsDir, 'protected-sites-trace.json'),
      scope: 'fixed wheel journey on real sites; actual tracking and automatic entry; no Furin or Enso detector injection' };
  } catch (error) {
    if (error.code !== 'QA_ATTACH_TRACKING_ADMISSION_FAILED'
      || error.cause?.code !== 'QA_ATTACH_TRACKING_TARGET_NOT_ADMITTED') throw error;
    const windows = await harness.evaluateInTrustedPage(`new Promise((resolve, reject) => {
      chrome.windows.getAll({ populate: false }, (windows) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(windows.map(({ id, focused, state }) => ({ id, focused, state })));
      });
    })`);
    requireProof(Array.isArray(windows) && windows.length > 0
      && windows.every((window) => typeof window.focused === 'boolean'), 'WINDOW_EVIDENCE_INVALID');
    if (windows.some((window) => window.focused)) throw error;
    // Explicit no-focus observation limit. Do not bypass admission or continue
    // the journey on a tab that Tracking has not accepted as its source.
    await record('foreground_unavailable', { error: error.message, windows,
      tracking: await sendTrustedRuntimeMessage(harness, { action: 'DEBUG_GET_TRACKING_RUNTIME_STATE' }) });
    return { status: 'INCONCLUSIVE', reason: 'no_focused_browser_window_tracking_source_not_admitted',
      completedBoundaries: trace.map(({ label }) => label),
      scope: 'setup observations only; multi-site consumption and automatic entry not exercised' };
  }
}
