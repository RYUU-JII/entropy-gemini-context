import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ExtensionChromiumHarness, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { GATE_QA_AUTOMATION_ACTIONS } from '../../../src/domains/protection/background/automation/gateQaAutomationContract.dev.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { requireSettingsCommitAcknowledgement } from '../../../src/domains/settings/config/settingsCommitAcknowledgement.js';
import { requireShishiConsumptionLevel } from '../../../src/domains/protection/domain/shishiConsumptionLevel.js';
import { sendTrustedRuntimeMessage, sendGateAutomation, waitForGateSurface,
  readAuthorizedGateSession, driveContinueOutcome } from './gateRuntimeQaProtocol.mjs';

function requireEvidence(condition, code) {
  if (!condition) throw new Error(`QA_CONSUMPTION_ENTRY_${code}`);
}

export function requireConsumptionQaSettingsAcknowledgement(result, items) {
  requireEvidence(result?.success === true && Array.isArray(result.changedKeys), 'SETTINGS_ACK_REQUIRED');
  const committed = requireSettingsCommitAcknowledgement(result.committedItems, Object.keys(items));
  const unchanged = result.changedKeys.length === 0 && result.propagation === null;
  if (unchanged) {
    requireEvidence(Object.keys(items).every((key) => isDeepStrictEqual(committed[key], items[key])), 'SETTINGS_NOOP_VALUE_MISMATCH');
  } else {
    requireEvidence(result.propagation?.status === 'succeeded', 'SETTINGS_PROPAGATION_REQUIRED');
  }
  return result;
}

// Real Chrome events, real 60s Tracking beats, real IDB and real policy. The
// fixture supplies only local pages/settings; it cannot inject time or scores.
export async function executeQaProtocol({ plan, artifact, browser, evidence,
  attachmentsDir, registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal, requestInitialOwnedWindowPresentation }) {
  requireEvidence(plan.browserExecution.presentation === 'foreground', 'FOREGROUND_REQUIRED');
  requireEvidence(artifact.id === 'dev_extension' && browser.processOwnership === 'owned', 'OWNED_DEV_REQUIRED');
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end('<!doctype html><meta charset="utf-8"><title>Consumption QA</title><p>Local observation fixture</p>');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  registerCleanup('consumption_fixture_server', () => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve({ action: 'closed' }));
    server.closeAllConnections();
  }));
  const port = server.address().port;
  const url = (host) => `http://${host}:${port}/`;
  const hosts = ['a.localhost', 'b.localhost'];
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement, keepTemp: false,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, tempPrefix: 'entropy-consumption-entry-', recoveryJournal });
  registerCleanup('consumption_entry_browser', () => harness.close());
  await harness.start(); await reportBrowserGpuCapability(harness.gpuCapability);
  const trace = [];
  registerCleanup('consumption_entry_trace', async () => {
    await fs.writeFile(path.join(attachmentsDir, 'consumption-entry-trace.json'), JSON.stringify(trace, null, 2));
    return { action: 'written', samples: trace.length };
  });
  async function settings(items) {
    const result = await sendTrustedRuntimeMessage(harness, { action: MESSAGE_ACTIONS.SET_SETTINGS, items, waitForPropagation: true });
    requireConsumptionQaSettingsAcknowledgement(result, items);
  }
  async function read(page) {
    signal?.throwIfAborted();
    return sendGateAutomation(harness, { action: GATE_QA_AUTOMATION_ACTIONS.READ_CONSUMPTION, targetTabId: page.tabId });
  }
  async function record(label, snapshot) {
    trace.push({ label, snapshot });
    await evidence.event('QA_CONSUMPTION_ENTRY_BOUNDARY', { label, snapshot });
    console.log(JSON.stringify({ event: 'QA_CONSUMPTION_ENTRY_BOUNDARY_REACHED', label,
      memoryStatus: snapshot.memory.status, protectedUseMs: snapshot.memory.projection?.durations.protected_use }));
    return snapshot;
  }
  async function until(page, label, predicate, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let snapshot;
    do {
      snapshot = await read(page);
      if (predicate(snapshot)) return record(label, snapshot);
      await sleep(1000);
    } while (Date.now() < deadline);
    await record(`${label}_timeout`, snapshot);
    throw new Error(`QA_CONSUMPTION_ENTRY_TIMEOUT:${label}`);
  }
  await settings({ 'app-theme': 'zen', filteringMode: 'blocklist', rulesMode: 'managed',
    dataCollectionMode: 'all_sites_minimal', insightsConsent: 'all_sites',
    nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS), gateConfig: structuredClone(DEFAULT_GATE_CONFIG) });
  for (const domain of hosts) {
    const result = await sendTrustedRuntimeMessage(harness, { action: MESSAGE_ACTIONS.UPSERT_SITE_RULE,
      domain, type: 'blocked', waitForPropagation: true });
    requireEvidence(result?.success === true && result.propagation?.status === 'succeeded', `SITE_RULE_FAILED:${JSON.stringify(result)}`);
  }
  const a = await harness.openPage(url(hosts[0]), { active: true });
  if (plan.parameters.allowInitialWindowFocusOnce === true) {
    requireEvidence(typeof requestInitialOwnedWindowPresentation === 'function', 'INITIAL_WINDOW_OWNER_REQUIRED');
    await evidence.event('QA_CONSUMPTION_INITIAL_WINDOW_PRESENTED', await requestInitialOwnedWindowPresentation({
      child: harness.chrome, cdp: harness.cdp, targetId: a.targetId, tabId: a.tabId,
    }));
  }
  const b = await harness.openPage(url(hosts[1]), { active: false });
  const outside = await harness.openPage(url('outside.localhost'), { active: false });
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(a);
  const initial = await until(a, 'initialized', (s) => s.memory.status === 'ready'
    && s.flow.environment?.foreground === 'protected', 100_000);
  const initialUse = initial.memory.projection.durations.protected_use;
  await until(a, 'protected_a', (s) => s.memory.status === 'ready'
    && s.memory.projection.durations.protected_use >= initialUse + 110_000, 190_000);
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(b);
  const switched = await until(b, 'protected_b', (s) => s.memory.status === 'ready'
    && s.memory.projection.durations.protected_use >= initialUse + 290_000
    && s.flow.environment?.foreground === 'protected', 250_000);
  requireEvidence(switched.flow.contexts.some((c) => c.hostname === hosts[0])
    && switched.flow.contexts.some((c) => c.hostname === hosts[1]), 'CROSS_DOMAIN_SOURCE_MISSING');

  // Enabling the consumer is a real settings command. A fresh protected entry
  // is then processed by the ordinary browser event / protection sync owner.
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(outside);
  await settings({ gateConfig: { ...DEFAULT_GATE_CONFIG, entryCheckpoint: { enabled: true } } });
  const entry = await harness.openPage(url('outside.localhost') + 'new-entry', { active: true });
  await harness.navigatePage(entry, url(hosts[0]) + 'entry');
  const presented = await until(entry, 'automatic_gate', (s) => s.session?.gateKind === 'entryCheckpoint', 20_000);
  const frozen = requireShishiConsumptionLevel(presented.session.metrics.shishiIntensity);
  requireEvidence(frozen.reason === 'bounded_consumption_memory'
    && ['adapted', 'remembered'].includes(frozen.status) && frozen.waitExtensionMs > 0, 'LIVE_ADAPTATION_REQUIRED');
  requireEvidence(presented.memory.status === 'ready' && presented.memory.projection.memory > 0, 'MODEL_REQUIRED');
  await waitForGateSurface(harness, entry);
  const authorized = await readAuthorizedGateSession(harness, entry, presented.session.sessionId);
  requireEvidence(authorized?.response?.success === true
    && JSON.stringify(authorized.response.session.metrics.shishiIntensity) === JSON.stringify(frozen), 'FROZEN_SESSION_MISMATCH');

  const stopped = await harness.stopServiceWorker();
  const restored = await read(entry);
  const revived = await harness.waitForServiceWorker({ previousTargetId: stopped.targetId });
  await record('worker_restarted_in_gate', restored);
  requireEvidence(revived.targetId !== stopped.targetId && restored.session?.sessionId === presented.session.sessionId
    && JSON.stringify(restored.session.metrics.shishiIntensity) === JSON.stringify(frozen), 'RESTART_SESSION_CHANGED');
  // A warm model can be not_ready after restart; the open Gate must still use
  // its admitted value, and the first ordinary batch must restore durable use.
  const outcomeUrl = await driveContinueOutcome(harness, entry, url(hosts[0]) + 'entry');
  const exposure = await sendGateAutomation(harness, { action: GATE_QA_AUTOMATION_ACTIONS.READ_EXPOSURE, targetTabId: entry.tabId });
  await fs.writeFile(path.join(attachmentsDir, 'consumption-entry-exposure.json'), JSON.stringify({ afterContinue: exposure }, null, 2));
  await evidence.event('QA_CONSUMPTION_ENTRY_EXPOSURE', { label: 'after_continue', snapshot: exposure });
  requireEvidence(exposure.intervals.filter((item) => item.kind === 'presented').length === 1, 'ONE_EXPOSURE_REQUIRED');
  const stoppedAfterEnd = await harness.stopServiceWorker();
  await record('worker_restarted_in_recovery', await read(entry));
  await harness.waitForServiceWorker({ previousTargetId: stoppedAfterEnd.targetId });
  const recoveryEntry = await harness.openPage(url('outside.localhost') + 'recovery-entry', { active: true });
  await harness.navigatePage(recoveryEntry, url(hosts[1]) + 'during-recovery');
  await settings({ gateConfig: { ...DEFAULT_GATE_CONFIG, entryCheckpoint: { enabled: true } } });
  for (let i = 0; i < 3; i++) {
    await sleep(4000);
    const recovering = await record(`approval_after_switch_and_settings_${i}`, await read(recoveryEntry));
    requireEvidence(recovering.session === null && recovering.entryApproval.approved
      && recovering.entryApproval.sessionId === presented.session.sessionId, 'SHARED_APPROVAL_LOST');
  }
  const recoveredMemory = await until(recoveryEntry, 'durable_memory_restored', (s) => s.memory.status === 'ready'
    && s.memory.projection.durations.protected_use >= switched.memory.projection.durations.protected_use, 100_000);
  requireEvidence(recoveredMemory.memory.projection.memory > 0, 'RESTART_ZERO_RESET');
  requireEvidence(recoveredMemory.session === null, 'DEFERRED_GATE_BURST');

  // Keep entry enabled. More confirmed use must not turn its increasing memory
  // into a second Gate while the same explicit decision remains approved.
  const continued = await until(recoveryEntry, 'approved_consumption_continues', (s) => s.memory.status === 'ready'
    && s.memory.projection.durations.protected_use >= recoveredMemory.memory.projection.durations.protected_use + 60_000, 190_000);
  requireEvidence(continued.session === null && continued.entryApproval.approved
    && continued.entryApproval.sessionId === presented.session.sessionId, 'CONSUMPTION_REVOKED_ENTRY');
  requireEvidence(continued.memory.projection.memory > recoveredMemory.memory.projection.memory, 'CONTINUED_USE_NOT_RETAINED');

  await harness.activateOwnedEphemeralPageWithoutWindowFocus(outside);
  const outsideStart = await until(outside, 'outside_point', (s) => s.memory.status === 'ready'
    && s.flow.environment?.foreground === 'outside', 100_000);
  const outsideEnd = await until(outside, 'five_minute_outside_remains_unknown', (s) => s.memory.status === 'ready'
    && s.memory.projection.durations.unknown >= outsideStart.memory.projection.durations.unknown + 300_000, 420_000);
  requireEvidence(outsideEnd.memory.projection.durations.outside === 0, 'FABRICATED_REST');
  requireEvidence(outsideEnd.memory.projection.memory > 0 && outsideEnd.entryApproval.approved
    && outsideEnd.entryApproval.sessionId === presented.session.sessionId, 'SHORT_DEPARTURE_RESET_FLOW');
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(entry);
  const resumed = await until(entry, 'approved_return_consumption', (s) => s.memory.status === 'ready'
    && s.memory.projection.durations.protected_use >= outsideEnd.memory.projection.durations.protected_use + 60_000, 190_000);
  requireEvidence(resumed.session === null && resumed.entryApproval.approved
    && resumed.entryApproval.sessionId === presented.session.sessionId, 'RETURN_REPLAYED_ENTRY');
  const finalExposure = await sendGateAutomation(harness, { action: GATE_QA_AUTOMATION_ACTIONS.READ_EXPOSURE, targetTabId: outside.tabId });
  await fs.writeFile(path.join(attachmentsDir, 'consumption-entry-exposure.json'), JSON.stringify({ afterContinue: exposure, final: finalExposure }, null, 2));
  await evidence.event('QA_CONSUMPTION_ENTRY_FINAL_EXPOSURE', finalExposure);
  requireEvidence(finalExposure.intervals.filter((item) => item.kind === 'presented').length === 1, 'DEFERRED_EXPOSURE_BURST');
  return { status: 'PASS', protocol: 'consumption_entry', frozen, outcomeUrl,
    worker: { before: stopped.targetId, after: revived.targetId }, tracePath: path.join(attachmentsDir, 'consumption-entry-trace.json'),
    scope: 'real local pages and wall clock; bounded nonzero intensity, frozen Gate, continued approved use, five-minute unknown departure and approved return; no attention inference or long-session acceleration' };
}
