import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ExtensionChromiumHarness, evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { sendTrustedRuntimeMessage, sendGateAutomation, waitForGateSurface, driveContinueOutcome } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { INTERVENTION_COLLISION_QA_ACTION, INTERVENTION_COLLISION_QA_CHANNEL } from '../../../src/domains/protection/background/automation/interventionCollisionQaContract.dev.js';
import { GATE_QA_AUTOMATION_ACTIONS as GATE, GATE_QA_AUTOMATION_CHANNEL } from '../../../src/domains/protection/background/automation/gateQaAutomationContract.dev.js';
import { RUNTIME_DEBUGGER_AUTOMATION_ACTIONS as DEBUG, RUNTIME_DEBUGGER_AUTOMATION_CHANNEL } from '../../../src/domains/nudge/runtime-debugger/automation/runtimeDebuggerAutomationContract.dev.js';
import { SENTINEL_PROTOCOL_QA_ACTIONS as SENTINEL, SENTINEL_PROTOCOL_QA_CHANNEL } from '../../../src/domains/nudge/runtime/automation/sentinelProtocolQaAutomationContract.dev.js';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { NUDGE_SESSION_KEYS } from '../../../src/domains/nudge/runtime/session/nudgeSessionShared.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';

function requireProof(condition, code) { if (!condition) throw new Error(`QA_COLLISION_${code}`); }

const observeSettlement = (task) => Promise.resolve().then(task).then(
  (value) => ({ status: 'fulfilled', value }),
  (reason) => ({ status: 'rejected', reason }),
);

export async function settleCollisionTasks(tasks) {
  const results = await Promise.all(tasks.map(observeSettlement));
  const errors = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
  if (errors.length) throw new AggregateError(errors, 'QA_COLLISION_PARALLEL_WORK_FAILED');
  return results.map((result) => result.value);
}

export async function competeCollisionCandidate({ request, waitUntilArmed, demand, competitor }) {
  // Observe the candidate before waiting for its actual entry-seam receipt.
  // Every started operation settles before this function permits run cleanup.
  let candidateSettled = false;
  const candidateWork = observeSettlement(request).then((result) => { candidateSettled = true; return result; });
  let competitorWork = null;
  let preparation = null;
  let input = null;
  let preparationError = null;
  let candidateSettledAtCompetitorStart = null;
  try {
    preparation = await waitUntilArmed();
    requireProof(!candidateSettled, 'RACE_CANDIDATE_SETTLED_BEFORE_INPUT');
    input = await demand();
    // No artificial admission pause: submit Gate as soon as native input has
    // been delivered. Its acknowledgement may already have completed Furin;
    // record that fact instead of assuming overlapping admission requests.
    candidateSettledAtCompetitorStart = candidateSettled;
    competitorWork = observeSettlement(competitor);
  } catch (error) { preparationError = error; }
  const candidate = await candidateWork;
  const competing = competitorWork ? await competitorWork : null;
  if (preparationError) {
    const errors = [preparationError];
    if (candidate.status === 'rejected') errors.push(candidate.reason);
    throw new AggregateError(errors, 'QA_COLLISION_RACE_PREPARATION_FAILED');
  }
  return { candidate, competing, preparation, input, candidateSettledAtCompetitorStart };
}

export function requireCollisionFinalCleanup(snapshot, surfaces) {
  requireProof(snapshot?.admission?.found === true && snapshot.admission.value.owner === null
    && snapshot.admission.value.blockers.length === 0, 'FINAL_OWNER_RETAINED');
  requireProof(Object.keys(snapshot.nudge[NUDGE_SESSION_KEYS.PENDING]).length === 0, 'FINAL_PENDING_RETAINED');
  requireProof(Array.isArray(surfaces) && surfaces.length === 2
    && surfaces.every((surface) => surface.enso === false && surface.furin === false && !surface.gateKind),
  'FINAL_SURFACE_RETAINED');
}

export function classifyCollisionCompetition(candidate, gate, ownerKind) {
  if (ownerKind === 'site_furin') {
    requireProof(candidate.dispatched === true && gate.success === false
      && gate.error === 'GATE_QA_AUTOMATION_ADMISSION_ACTIVE_INTERVENTION', 'RACE_SITE_WINNER_REFUSAL_REQUIRED');
    return 'shared_admission_gate_refused';
  }
  requireProof(ownerKind === 'gate_interstitial' && gate.success === true && candidate.dispatched === false,
    'RACE_GATE_WINNER_REFUSAL_REQUIRED');
  if (candidate.error === 'active_intervention') return 'shared_admission_furin_refused';
  const documentCancelled = ['entry_cancelled', 'PROTECTION_RECEIVER_OPERATION_CANCELLED'].includes(candidate.error)
    || String(candidate.error).startsWith('PROTECTION_DISPATCH_DOCUMENT_IDENTITY_INVALID:')
    || candidate.skipped === 'content_document_identity_invalid'
    || /^(?:The message port closed before a response was received\.|A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received)$/u.test(candidate.error);
  requireProof(documentCancelled, `RACE_UNRELATED_CANDIDATE_FAILURE:${candidate.error}`);
  return 'gate_navigation_cancelled_furin_delivery';
}

export async function dispatchCollisionCandidate({ request, demand = null, delay = sleep }) {
  let settled = null;
  // Attach both settlement handlers before any input delay. An early route
  // rejection must reach QaRunSession cleanup, never Node's unhandled rejection.
  const work = Promise.resolve().then(request).then(
    (value) => (settled = { status: 'fulfilled', value }),
    (error) => (settled = { status: 'rejected', error }),
  );
  let inputError = null;
  try {
    if (demand) {
      await delay(700, () => settled);
      if (settled === null) await demand();
    }
  } catch (error) { inputError = error; }
  const result = await work;
  if (inputError && result.status === 'rejected') {
    throw new AggregateError([inputError, result.error], 'QA_COLLISION_INPUT_AND_DISPATCH_FAILED');
  }
  if (inputError) throw inputError;
  if (result.status === 'rejected') throw result.error;
  return result.value;
}

function tone() {
  const samples = 8000;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(samples, 24); wav.writeUInt32LE(samples * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(1000 * Math.sin(i * Math.PI * 440 / samples)), 44 + i * 2);
  return wav;
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal }) {
  requireProof(artifact.id === 'dev_extension' && browser.processOwnership === 'owned'
    && plan.target.environmentId === 'ephemeral', 'OWNED_DEV_REQUIRED');
  const audio = tone();
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': request.url === '/tone.wav' ? 'audio/wav' : 'text/html', 'Cache-Control': 'no-store' });
    response.end(request.url === '/tone.wav' ? audio : '<!doctype html><meta charset="utf-8"><title>Intervention collision QA</title><button id="probe" style="position:fixed;left:20px;top:20px;width:140px;height:50px">Input / media probe</button><audio id="media" src="/tone.wav" loop></audio><div style="height:5000px">Local fixture</div><script>window.probeClicks=0;probe.onclick=()=>{window.probeClicks++;media.play().catch(error=>{window.mediaError=error.message})}</script>');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  registerCleanup('collision_fixture', () => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve({ closed: true })); server.closeAllConnections();
  }));
  const url = (host) => `http://collision-${host}.localhost:${server.address().port}/`;
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    capacityReservationMode: plan.browserCapacityMode,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement, keepTemp: false,
    temporaryManifest: { requiredPermissions: ['scripting'],
      requiredHostPermissions: ['http://collision-a.localhost/*', 'http://collision-b.localhost/*'] },
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, tempPrefix: 'entropy-collision-', recoveryJournal });
  registerCleanup('collision_browser', () => harness.close());
  await harness.start(); await reportBrowserGpuCapability(harness.gpuCapability);
  const trace = [];
  registerCleanup('collision_trace', async () => {
    await fs.writeFile(path.join(attachmentsDir, 'collision-trace.json'), JSON.stringify(trace, null, 2));
    return { samples: trace.length };
  });
  async function record(label, value) {
    trace.push({ label, value }); await evidence.event('QA_COLLISION_BOUNDARY', { label, value });
    console.log(JSON.stringify({ event: 'QA_COLLISION_PROGRESS', label })); return value;
  }
  async function call(page, operation, payload = {}) {
    signal?.throwIfAborted();
    const response = await sendTrustedRuntimeMessage(harness, { action: INTERVENTION_COLLISION_QA_ACTION,
      channel: INTERVENTION_COLLISION_QA_CHANNEL, requestId: randomUUID(), targetTabId: page.tabId, operation, payload });
    if (response?.success !== true) await record('route_failure', { operation, response });
    requireProof(response?.success === true, `ROUTE:${operation}:${response?.error}`);
    return response.result;
  }
  async function automation(page, channel, action, payload = {}, expectedSuccess = true) {
    const requestId = randomUUID();
    const response = await sendTrustedRuntimeMessage(harness, { channel, action, payload, requestId, targetTabId: page.tabId });
    const validSuccess = typeof response?.success === 'boolean'
      && (expectedSuccess === null || response.success === expectedSuccess);
    if (!validSuccess) {
      await record('automation_failure', { response, diagnostics: await sendTrustedRuntimeMessage(harness,
        { action: MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS, targetTabId: page.tabId, limit: 120 }) });
    }
    requireProof(response?.requestId === requestId && validSuccess, `AUTOMATION:${action}:${JSON.stringify(response)}`);
    return response;
  }
  async function settings(items) {
    requireConsumptionQaSettingsAcknowledgement(await sendTrustedRuntimeMessage(harness,
      { action: MESSAGE_ACTIONS.SET_SETTINGS, items, waitForPropagation: true }), items);
  }
  async function inspect(page) {
    return evaluate(harness.cdp, page.sessionId, `(() => {
      const furin = document.getElementById('friction-nudge-root');
      return { href:location.href, enso:!!document.querySelector('.friction-click-enso-gate'),
        furin:!!furin && getComputedStyle(furin).display!=='none',
        mediaPaused:document.getElementById('media')?.paused, mediaVolume:document.getElementById('media')?.volume,
        clicks:window.probeClicks, gateKind:document.querySelector('.gate-page')?.getAttribute('data-gate-kind') };
    })()`);
  }
  async function click(page) {
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 80, y: 45, button: 'left', clickCount: 1 }, page.sessionId);
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 80, y: 45, button: 'left', clickCount: 1 }, page.sessionId);
  }
  async function until(label, read, accept, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs;
    let value;
    while (Date.now() < deadline) {
      signal?.throwIfAborted(); value = await read();
      if (accept(value)) return record(label, value);
      await sleep(250);
    }
    await record(`${label}_timeout`, value); throw new Error(`QA_COLLISION_TIMEOUT:${label}`);
  }
  async function dispatch(page, scope, demand = true) {
    const current = demand ? await contentDocument(page) : null;
    if (demand) requireProof(current?.status === 'active' && typeof current.documentId === 'string',
      'DISPATCH_CURRENT_DOCUMENT_REQUIRED');
    const startedAt = Date.now();
    const result = await dispatchCollisionCandidate({
      request: () => call(page, 'furin', { scope }),
      // Wait for this exact document's real listener preparation, or an early
      // refusal. Bundle loading time is not an input-readiness contract.
      delay: async (_unusedMs, readSettlement) => until(`dispatch_${scope}_input_boundary`, async () => {
        const settled = readSettlement();
        if (settled !== null) return { settled: settled.status };
        const events = await entryEvents(page, current.documentId, startedAt);
        return { events, settled: readSettlement()?.status ?? null };
      }, (value) => value.settled !== null || value.events.some((event) => event.type === 'environment_probe'
        && event.payload.phase === 'nudge_entry_seam_armed'
        && event.payload.protocolScope === (scope === 'site' ? 'site' : 'global')), 4000),
      // One bounded real input follows actual candidate preparation. No timer resumes it.
      demand: demand ? () => click(page) : null,
    });
    return record(`dispatch_${scope}`, result);
  }
  const state = (snapshot) => { requireProof(snapshot.admission.found, 'ADMISSION_RECORD_REQUIRED'); return snapshot.admission.value; };
  async function waitRecovery(page, label) {
    const initial = state(await call(page, 'read'));
    requireProof(!initial.owner && initial.blockers.length === 0, 'RECOVERY_HAS_OWNER');
    const deadline = initial.kernel.globalNotBefore;
    requireProof(deadline > Date.now(), 'RECOVERY_REQUIRED');
    while (Date.now() <= deadline + 500) { await sleep(Math.min(5000, deadline + 501 - Date.now())); signal?.throwIfAborted(); }
    const latest = state(await call(page, 'read'));
    requireProof(!latest.owner && latest.blockers.length === 0, 'DEFERRED_BURST');
    return record(label, { deadline, now: Date.now(), state: latest });
  }
  async function dismissIsolation(page) {
    await sendGateAutomation(harness, { action: GATE.DISMISS, targetTabId: page.tabId });
    await harness.navigatePage(page, url('b'));
  }

  async function contentDocument(page) {
    const diagnostics = await sendTrustedRuntimeMessage(harness, {
      action: MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS, targetTabId: page.tabId, limit: 5,
    });
    requireProof(diagnostics?.success === true, 'TARGET_DIAGNOSTICS_UNAVAILABLE');
    return diagnostics.snapshot.currentSession;
  }

  async function waitForCurrentDocument(page, startedAt, label) {
    return until(label, () => contentDocument(page), (session) => session?.status === 'active'
      && session.url === url('b') && session.startedAt >= startedAt);
  }

  async function entryEvents(page, documentId, since) {
    // Read the existing diagnostic owner in the exact document's isolated
    // world. This neither arms the seam nor writes a diagnostic as evidence.
    const results = await harness.evaluateInTrustedPage(`chrome.scripting.executeScript({
      target: { tabId: ${page.tabId}, documentIds: [${JSON.stringify(documentId)}] }, world: 'ISOLATED',
      func: (since) => {
        const read = globalThis.__entropyProtectionDiagnosticsSnapshot__;
        if (typeof read !== 'function') throw new Error('QA_COLLISION_ENTRY_DIAGNOSTICS_REQUIRED');
        return read().history.filter((event) => event.ts >= since && (
          event.type === 'intervention_lifecycle' ||
          (event.type === 'environment_probe' && typeof event.payload.phase === 'string'
            && event.payload.phase.startsWith('nudge_entry_seam_'))
        )).slice(-20);
      }, args: [${since}],
    })`);
    requireProof(results.length === 1 && results[0].documentId === documentId
      && Array.isArray(results[0].result), 'ENTRY_DIAGNOSTIC_DOCUMENT_MISMATCH');
    return results[0].result;
  }

  await settings({ 'app-theme': 'zen', filteringMode: 'blocklist', rulesMode: 'managed',
    gateConfig: structuredClone(DEFAULT_GATE_CONFIG), nudgeConfig: { ...structuredClone(DEFAULT_NUDGE_SETTINGS), goalEnds: { site: true, global: true }, visualThemeId: 'zen', hudVisible: false },
    dataCollectionMode: 'all_sites_minimal', insightsConsent: 'all_sites' });
  for (const domain of ['collision-a.localhost', 'collision-b.localhost']) {
    const result = await sendTrustedRuntimeMessage(harness, { action: MESSAGE_ACTIONS.UPSERT_SITE_RULE,
      domain, type: 'blocked', waitForPropagation: true });
    requireProof(result?.success && result.propagation?.status === 'succeeded', 'SITE_RULE_ACK');
  }
  const a = await harness.openPage('about:blank', { active: true });
  const b = await harness.openPage(url('b'), { active: false });
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(a);
  const consumption = (page) => sendGateAutomation(harness, { action: GATE.READ_CONSUMPTION, targetTabId: page.tabId });
  // An ordinary navigation and real Continue establish intent. Neither a QA
  // PRESENT fixture nor a raw approval write may stand in for this decision.
  // Enable entry while the active source is outside protection. Reapplying it
  // on a freshly entered protected page could already redirect that page before
  // the test's intended navigation, creating two competing preparation events.
  await settings({ gateConfig: { ...DEFAULT_GATE_CONFIG, entryCheckpoint: { enabled: true } } });
  const entrySource = new URL((await record('entry_preparation', await inspect(a))).href);
  requireProof(entrySource.protocol === 'chrome-extension:' && entrySource.hostname === harness.extensionId
    && entrySource.pathname === `/${ENTROPY_QA_TRUSTED_PAGE_PATH}`, 'ENTRY_SOURCE_NOT_READY');
  await harness.navigatePage(a, url('a'));
  const entryGate = await until('entry_before_enso', () => consumption(a), (s) => s.session?.gateKind === 'entryCheckpoint');
  await waitForGateSurface(harness, a);
  await driveContinueOutcome(harness, a, url('a'));
  const entryDecision = (await consumption(a)).entryApproval;
  requireProof(entryDecision.approved && entryDecision.sessionId === entryGate.session.sessionId, 'ORDINARY_ENTRY_APPROVAL_REQUIRED');
  async function approval(label, page = a) {
    const snapshot = await consumption(page);
    requireProof(snapshot.entryApproval.approved && snapshot.entryApproval.sessionId === entryDecision.sessionId
      && snapshot.entryApproval.decisionAt === entryDecision.decisionAt, 'ENTRY_DECISION_CHANGED');
    return record(label, snapshot.entryApproval);
  }
  await waitRecovery(a, 'entry_end_recovery_no_burst');
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(b);
  await harness.reloadPage(b);
  requireProof((await consumption(b)).session === null, 'APPROVED_SECOND_TAB_GATED');
  await approval('entry_approval_in_second_tab', b);
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(a);
  await automation(a, RUNTIME_DEBUGGER_AUTOMATION_CHANNEL, DEBUG.START, { captureKind: 'live' });
  // Continue is a real reflection and resets the ordinary Enso interval. A
  // recovery wait alone cannot mature that interval. Prove refusal first, then
  // prepare an explicitly synthetic prerequisite through the dev fixture owner.
  const immatureEnso = await automation(a, RUNTIME_DEBUGGER_AUTOMATION_CHANNEL, DEBUG.FORCE_ENSO_GATE,
    { admissionMode: 'ordinary' }, false);
  requireProof(['CONSUMPTION_INTERVAL_PENDING', 'NOT_FOREGROUND', 'NOT_CONSUMING'].some((reason) =>
    immatureEnso.error === `RUNTIME_DEBUGGER_AUTOMATION_ENSO_GATE_FORCE_REJECTED:${reason}`), 'IMMATURE_ENSO_REFUSAL_REQUIRED');
  const beforePreparedEnso = state(await call(a, 'read'));
  requireProof(!beforePreparedEnso.owner && beforePreparedEnso.blockers.length === 0
    && beforePreparedEnso.ensoCadence.consumedMs < beforePreparedEnso.ensoCadence.intervalMs
    && !(await inspect(a)).enso, 'IMMATURE_ENSO_MUST_NOT_PRESENT');
  await record('ordinary_enso_before_prerequisite_refused', { response: immatureEnso, cadence: beforePreparedEnso.ensoCadence });
  const ensoPrerequisite = await record('synthetic_enso_operational_prerequisite', await call(a, 'prepare_enso_candidate'));
  requireProof(ensoPrerequisite.synthetic === true && ensoPrerequisite.naturalConsumptionObserved === false
    && ensoPrerequisite.before.consumedMs < ensoPrerequisite.before.intervalMs
    && ensoPrerequisite.after.consumedMs === ensoPrerequisite.after.intervalMs, 'ENSO_PREREQUISITE_RECEIPT_REQUIRED');
  await automation(a, RUNTIME_DEBUGGER_AUTOMATION_CHANNEL, DEBUG.FORCE_ENSO_GATE, { admissionMode: 'ordinary' });
  const ensoSnapshot = await until('enso_presented', () => call(a, 'read'), (s) => s.admission.value?.owner?.presentedAt > 0);
  const enso = state(ensoSnapshot).owner;
  requireProof(enso.kind === 'enso_gate' && enso.manual === false && (await inspect(a)).enso, 'ORDINARY_ENSO_REQUIRED');
  await approval('enso_interrupts_approved_flow');
  const blockedSite = await dispatch(a, 'site');
  // Enso owns page input, so this click must not become renewed consumption.
  requireProof(!blockedSite.dispatched && blockedSite.error === 'entry_candidate_expired'
    && (await inspect(a)).clicks === 0, 'SITE_INTERRUPTED_ENSO');
  const expiredGlobal = await dispatch(a, 'global', false);
  requireProof(!expiredGlobal.dispatched && expiredGlobal.error === 'entry_candidate_expired', 'EXPIRED_GLOBAL_DISPATCHED');
  const ensoAfter = state(await call(a, 'read'));
  requireProof(ensoAfter.owner?.leaseId === enso.leaseId, 'ENSO_OWNER_CHANGED');
  const entryRefusal = await automation(a, GATE_QA_AUTOMATION_CHANNEL, GATE.PRESENT_ENTRY_CHECKPOINT, {}, false);
  const detourRefusal = await automation(a, GATE_QA_AUTOMATION_CHANNEL, GATE.PRESENT_DETOUR_SPREAD, { maxProtectedTabs: 1,
    protectedTabs: [{ tabId: a.tabId, url: url('a') }, { tabId: b.tabId, url: url('b') }] }, false);
  await record('ordinary_gate_refusals', { entryRefusal, detourRefusal });
  requireProof([entryRefusal, detourRefusal].every((response) =>
    response.error === 'GATE_QA_AUTOMATION_ADMISSION_ACTIVE_INTERVENTION'), 'GATE_REFUSAL_PROOF_MISSING');
  requireProof(state(await call(a, 'read')).owner?.leaseId === enso.leaseId && (await inspect(a)).enso, 'ORDINARY_GATE_PREEMPTED');
  const beforeIsolation = await call(a, 'read');
  requireProof(Object.keys(beforeIsolation.nudge[NUDGE_SESSION_KEYS.SHOWN]).length === 0
    && Object.keys(beforeIsolation.nudge[NUDGE_SESSION_KEYS.PENDING]).length === 0, 'FAILED_CANDIDATE_CONSUMED_EXPOSURE');
  await record('enso_protected_and_failed_candidates_unconsumed', beforeIsolation);

  requireProof((await call(b, 'isolation')).handled, 'ISOLATION_NOT_HANDLED');
  requireProof(!(await inspect(a)).enso, 'ENSO_NOT_CLEANED');
  const afterEnsoPreemption = state(await call(a, 'read'));
  requireProof(afterEnsoPreemption.ensoCadence.consumedMs === 0
    && afterEnsoPreemption.ensoCadence.resetAt >= ensoPrerequisite.preparedAt, 'PRESENTED_ENSO_CADENCE_NOT_RESET');
  await record('prepared_enso_prerequisite_reset_after_presentation', afterEnsoPreemption.ensoCadence);
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(b);
  await until('isolation_presented', () => call(b, 'read'), (s) => s.admission.value?.blockers.some((owner) => owner.presentedAt > 0));
  const replay = await call(a, 'replay_enso_end', { leaseId: enso.leaseId, documentId: enso.documentId });
  requireProof(replay.ended.reason === 'stale_lease' && replay.closure.outcome === 'refused'
    && replay.closure.closedTabIds.length === 0, 'STALE_CONCLUSION_ACCEPTED');
  await record('retired_enso_callbacks_refused', replay);
  await dismissIsolation(b);
  const stopped = await harness.stopServiceWorker(); await call(a, 'read');
  await harness.waitForServiceWorker({ previousTargetId: stopped.targetId });
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(a);
  await settings({ gateConfig: structuredClone(DEFAULT_GATE_CONFIG) });
  const recoveryAttempt = await dispatch(a, 'site');
  requireProof(!recoveryAttempt.dispatched && recoveryAttempt.error === 'global_gap', 'RECOVERY_BYPASSED');
  await waitRecovery(a, 'recovery_survives_restart_switch_and_settings');
  await approval('entry_approval_survives_worker_and_recovery');

  await click(a); await until('page_media_playing', () => inspect(a), (s) => s.mediaPaused === false);
  const site = await dispatch(a, 'site'); requireProof(site.dispatched, 'FRESH_SITE_NOT_DISPATCHED');
  await until('site_presented', () => call(a, 'read'), (s) => s.admission.value?.owner?.kind === 'site_furin' && s.admission.value.owner.presentedAt > 0);
  await approval('site_furin_interrupts_approved_flow');
  await until('site_media_suppressed', () => inspect(a), (s) => s.furin && s.mediaPaused);
  const siteOwner = state(await call(a, 'read')).owner;
  const manualBlocked = await automation(a, SENTINEL_PROTOCOL_QA_CHANNEL, SENTINEL.START, { protocolScope: 'global' }, false);
  requireProof(manualBlocked.error === 'SENTINEL_PROTOCOL_QA_PRODUCTION_SESSION_ACTIVE', 'MANUAL_PRODUCTION_REFUSAL_MISSING');
  await record('manual_cannot_take_production', manualBlocked);
  requireProof(!(await dispatch(a, 'combined')).dispatched, 'GLOBAL_INTERRUPTED_SITE');
  const siteAfter = await call(a, 'read');
  requireProof(state(siteAfter).owner?.leaseId === siteOwner.leaseId && !siteAfter.nudge[NUDGE_SESSION_KEYS.ACK][site.key], 'BLOCKED_GLOBAL_ABSORBED_SITE');
  await record('site_protected_and_obligation_preserved', siteAfter);
  requireProof((await call(b, 'isolation')).handled, 'SITE_PREEMPTION_FAILED');
  const cleaned = await until('site_surface_media_cleanup', () => inspect(a), (s) => !s.furin && s.mediaPaused && s.mediaVolume === 1);
  await click(a); requireProof((await inspect(a)).clicks === cleaned.clicks + 1, 'OLD_INPUT_GUARD_RETAINED');
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(b);
  await until('second_isolation_presented', () => call(b, 'read'), (s) => s.admission.value?.blockers.some((owner) => owner.presentedAt > 0));
  const manualNavigationStartedAt = Date.now();
  await dismissIsolation(b); await harness.activateOwnedEphemeralPageWithoutWindowFocus(a);
  await waitRecovery(a, 'second_recovery_no_burst');

  // Global presentation suppresses every later ordinary Furin that day. Check
  // manual exclusion and the fresh Site B candidate before consuming it.
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(b);
  await waitForCurrentDocument(b, manualNavigationStartedAt, 'manual_target_bootstrapped');
  // Manual bypasses recovery only. Automatic START/STOP must preserve its exact owner.
  await automation(b, SENTINEL_PROTOCOL_QA_CHANNEL, SENTINEL.START, { protocolScope: 'site' });
  const manual = await until('manual_presented', () => call(b, 'read'), (s) => s.admission.value?.owner?.manual && s.admission.value.owner.presentedAt > 0);
  const automaticStop = await call(b, 'stop_auto', { runId: site.runId });
  requireProof(automaticStop.stopped === false && automaticStop.reason === 'debug_session_owned', 'AUTO_STOPPED_MANUAL');
  const concurrent = await settleCollisionTasks([() => dispatch(a, 'site'), () => dispatch(b, 'site')]);
  requireProof(concurrent.every((entry) => !entry.dispatched), 'CONCURRENT_TABS_STOLE_MANUAL');
  requireProof(concurrent[1].error === 'production_control_blocked_by_debug', 'AUTO_START_DID_NOT_REACH_MANUAL_OWNER');
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(a);
  const otherTab = await dispatch(a, 'global');
  requireProof(!otherTab.dispatched && otherTab.error === 'active_intervention', 'OTHER_TAB_STOLE_MANUAL');
  requireProof(state(await call(a, 'read')).owner?.leaseId === state(manual).owner.leaseId, 'MANUAL_RESTARTED');
  await record('manual_and_multitab_exclusivity', { automaticStop, concurrent, otherTab, snapshot: await call(a, 'read') });
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(b);
  await automation(b, SENTINEL_PROTOCOL_QA_CHANNEL, SENTINEL.STOP);
  await waitRecovery(b, 'manual_end_recovery_no_burst');

  // Site A already consumed the full form; B must be a genuine brief candidate.
  // Observe its actual armed entry seam, deliver renewed native input, then
  // submit Gate without pausing either product owner. A navigation winner may
  // cancel delivery before Furin reaches admission; report that boundary honestly.
  const raceDocument = await contentDocument(b);
  requireProof(raceDocument?.status === 'active' && raceDocument.url === url('b')
    && typeof raceDocument.documentId === 'string', 'RACE_CURRENT_DOCUMENT_REQUIRED');
  const raceStartedAt = Date.now();
  const race = await competeCollisionCandidate({
    request: () => call(b, 'furin', { scope: 'site' }),
    waitUntilArmed: () => until('race_site_candidate_armed', async () => {
      const events = await entryEvents(b, raceDocument.documentId, raceStartedAt);
      const snapshot = await call(b, 'read');
      return { events, snapshot };
    }, ({ events, snapshot }) => events.some((event) => event.type === 'environment_probe'
      && event.payload.phase === 'nudge_entry_seam_armed' && event.payload.protocolScope === 'site')
      && Object.entries(snapshot.nudge[NUDGE_SESSION_KEYS.PENDING]).some(([key, pending]) =>
        key.endsWith('|collision-b.localhost') && pending.tabId === b.tabId && pending.deliveryForm === 'brief'), 4000),
    demand: async () => {
      const current = await contentDocument(b);
      requireProof(current?.documentId === raceDocument.documentId && current.status === 'active'
        && current.url === url('b'), 'RACE_DOCUMENT_CHANGED_BEFORE_INPUT');
      await click(b);
      return { deliveredAt: Date.now(), documentId: current.documentId };
    },
    competitor: () => automation(b, GATE_QA_AUTOMATION_CHANNEL, GATE.PRESENT_ENTRY_CHECKPOINT, {}, null),
  });
  requireProof(race.candidate.status === 'fulfilled' && race.competing.status === 'fulfilled',
    `RACE_TRANSPORT_FAILED:${JSON.stringify(race, (_, value) => value instanceof Error ? value.message : value)}`);
  const raceSite = race.candidate.value;
  const raceGate = race.competing.value;
  const raced = await until('gate_furin_race_presented', () => call(b, 'read'), (s) => s.admission.value?.owner?.presentedAt > 0);
  const raceOwner = state(raced).owner;
  requireProof(['site_furin', 'gate_interstitial'].includes(raceOwner.kind) && raceOwner.manual === false
    && state(raced).blockers.length === 0, 'RACE_OWNER_INVALID');
  const raceSurface = await inspect(b);
  requireProof(raceOwner.kind === 'site_furin' ? raceSurface.furin && !raceSurface.gateKind
    : raceSurface.gateKind === 'entryCheckpoint' && !raceSurface.furin, 'RACE_SURFACE_OVERLAP');
  const raceBoundary = classifyCollisionCompetition(raceSite, raceGate, raceOwner.kind);
  if (raceOwner.kind === 'site_furin') {
    const events = await entryEvents(b, raceDocument.documentId, raceStartedAt);
    requireProof(events.some((event) => event.type === 'environment_probe'
      && event.payload.phase === 'nudge_entry_seam_commit' && event.payload.eventType === 'click'), 'RACE_RENEWED_INPUT_COMMIT_REQUIRED');
    await record('race_site_input_committed', events);
  } else {
    // Exact delivery/refusal details remain in the trace. A navigation failure
    // is not evidence that both requests entered the shared admission lane.
    requireProof(Object.keys(raced.nudge[NUDGE_SESSION_KEYS.PENDING]).length === 0, 'RACE_LOSER_PENDING_RETAINED');
  }
  await record('gate_furin_competing_candidate_single_owner', { boundary: raceBoundary,
    race, snapshot: raced, surface: raceSurface });
  if (raceOwner.kind === 'site_furin') {
    requireProof((await call(b, 'stop_auto', { runId: raceSite.runId })).stopped === true, 'RACE_SITE_STOP_FAILED');
  } else {
    await waitForGateSurface(harness, b);
    await dismissIsolation(b);
  }
  await until('race_winner_cleaned', () => call(b, 'read'), (s) => !state(s).owner
    && state(s).blockers.length === 0 && Object.keys(s.nudge[NUDGE_SESSION_KEYS.PENDING]).length === 0);
  requireProof(!(await inspect(b)).furin && !(await inspect(b)).gateKind, 'RACE_SURFACE_NOT_CLEANED');
  await waitRecovery(b, 'race_end_recovery_no_burst');

  await harness.activateOwnedEphemeralPageWithoutWindowFocus(a);
  // Only this real Global start may absorb the still-outstanding Site A debt.
  const combined = await dispatch(a, 'combined'); requireProof(combined.dispatched, 'FRESH_COMBINED_NOT_DISPATCHED');
  const globalState = await until('global_presented_and_site_absorbed', () => call(a, 'read'), (s) =>
    s.admission.value?.owner?.kind === 'global_sentinel' && s.admission.value.owner.presentedAt > 0
    && s.nudge[NUDGE_SESSION_KEYS.ACK][site.key] > 0);
  await approval('global_furin_preserves_entry_decision_and_settles_site_debt');
  const staleStop = await call(a, 'stop_auto', { runId: site.runId });
  requireProof(staleStop.stopped === false && staleStop.reason === 'stale_stop'
    && state(await call(a, 'read')).owner?.leaseId === state(globalState).owner.leaseId, 'STALE_AUTO_STOP_ACCEPTED');
  requireProof((await call(b, 'isolation')).handled, 'GLOBAL_PREEMPTION_FAILED');
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(b);
  await until('third_isolation_presented', () => call(b, 'read'), (s) => s.admission.value?.blockers.some((owner) => owner.presentedAt > 0));
  await dismissIsolation(b);
  const finalSnapshot = await until('final_owners_released', () => call(a, 'read'), (s) => state(s).owner === null
    && state(s).blockers.length === 0 && Object.keys(s.nudge[NUDGE_SESSION_KEYS.PENDING]).length === 0);
  const finalSurfaces = await settleCollisionTasks([() => inspect(a), () => inspect(b)]);
  requireCollisionFinalCleanup(finalSnapshot, finalSurfaces);
  await record('final_cleanup', { snapshot: finalSnapshot, surfaces: finalSurfaces });
  await record('final', finalSnapshot);
  await approval('entry_decision_preserved_after_all_collisions');
  return { status: 'PASS', protocol: 'intervention_collision', tracePath: path.join(attachmentsDir, 'collision-trace.json'),
    entryDecision, ensoPrerequisite,
    raceBoundary,
    scope: 'real ordinary Gate Continue; ordinary Enso refusal before an explicitly synthetic operational cadence prerequisite; fixed Enso/Furin candidates with real dispatch, rendering, admission, lifecycle and wall-clock recovery; prepared Site/Gate end-to-end competition with the observed refusal or navigation boundary classified; no natural-consumption timing certification' };
}
