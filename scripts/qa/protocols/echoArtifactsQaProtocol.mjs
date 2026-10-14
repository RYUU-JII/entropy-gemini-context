import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ExtensionChromiumHarness, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { normalizeChromiumHarnessTemporaryManifest } from '../../e2e/chromiumHarnessManifestPromotion.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/contracts/messageTypes.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../src/domains/settings/config/index.js';
import { DEFAULT_ARTIFACT_CONTROL_STATE, requireArtifactControlState } from '../../../src/domains/settings/config/artifactControlState.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { requireSettingsRuntimeCommandAcknowledgement } from '../../../src/domains/settings/config/settingsRuntimeCommandAcknowledgement.js';
import { STORAGE_SESSION_KEYS } from '../../../src/platform/storage/runtime/RuntimeSessionRepository.js';
import { requireTabEvaporationCheckpoint } from '../../../src/platform/storage/runtime/TabEvaporationCheckpointRepository.js';
import { getAlarmName } from '../../../src/domains/tracking/background/AlarmScheduler.js';
import { sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { requireEntropyAttachedArtifactRuntimeIdentity, requireEntropyTrackingRuntimeReadiness } from './attachOnlyActivePageAdapter.mjs';
import { requireIntegratedDisposableFixtureOwner } from './integratedSettingsLifecycleFixture.mjs';

export const ECHO_QA_HOST = 'echo-artifact.localhost';
const SAFE_HOST = 'echo-safe.localhost';
const POLICY_KEYS = ['blockedUrls', 'historyCleanupForBlocked', 'concealBlockedBookmarks',
  'tabEvaporationForBlocked', 'tabEvaporationTimeoutMinutes', 'artifactControlState'];
const CHILD_INTENT = { historyCleanupForBlocked: true, concealBlockedBookmarks: true,
  tabEvaporationForBlocked: true, tabEvaporationTimeoutMinutes: 5 };
export const ECHO_ARTIFACT_QA_STEPS = Object.freeze(['owned_fixture', 'consent_off', 'family_pause',
  'global_pause', 'paused_worker_revival', 'resume_removal', 'inactive_worker_revival', 'real_tab_evaporation']);

function requireProof(condition, code, diagnostic) {
  if (condition) return;
  const error = new Error(`QA_ECHO_ARTIFACT_${code}`);
  error.code = `QA_ECHO_ARTIFACT_${code}`;
  error.diagnostic = diagnostic;
  throw error;
}

export function createEchoArtifactsTemporaryManifest() {
  return normalizeChromiumHarnessTemporaryManifest({ requiredPermissions: ['history', 'bookmarks', 'scripting'],
    requiredHostPermissions: [`http://${ECHO_QA_HOST}/*`] });
}

export function requireEchoArtifactsPlan({ plan, artifact, browser }) {
  requireProof(plan?.target?.id === 'artifacts/echo' && plan.target.protocolId === 'echo_artifacts'
    && plan.target.environmentId === 'ephemeral' && plan.mode === 'agent'
    && artifact?.id === 'dev_extension' && artifact.releaseProfile === 'dev'
    && browser?.processOwnership === 'owned' && plan.browserExecution?.processOwnership === 'owned'
    && plan.browserExecution.osFocus === 'never'
    && plan.protocolOptions?.fixturePolicy === 'owned_ephemeral_echo_specimens'
    && plan.protocolOptions.permissionPolicy === 'temporary_manifest_history_bookmarks'
    && plan.protocolOptions.idlePolicy === 'real_five_minute_checkpoint', 'DISPOSABLE_DEV_REQUIRED');
  return true;
}

// Serialized into only the harness-owned trusted extension page. The finite
// fixture API creates specimens and observes results; it exposes no deletion,
// permission grant, storage write, alarm replacement or runtime method call.
export async function callEchoFixtureApi({ method, args }, browserApi = chrome) {
  const allowed = ['history.addUrl', 'history.getVisits', 'bookmarks.create', 'bookmarks.getTree',
    'tabs.query', 'storage.session.get', 'permissions.contains', 'alarms.get'];
  if (!allowed.includes(method) || !Array.isArray(args)) throw new Error('QA_ECHO_FIXTURE_API_FORBIDDEN');
  const parts = method.split('.'), name = parts.pop();
  const owner = parts.reduce((value, key) => value?.[key], browserApi);
  if (typeof owner?.[name] !== 'function') throw new Error(`QA_ECHO_FIXTURE_API_REQUIRED:${method}`);
  return new Promise((resolve, reject) => {
    owner[name](...args, result => {
      const error = browserApi.runtime.lastError;
      if (error) reject(new Error(`QA_ECHO_FIXTURE_API_FAILED:${method}:${error.message}`));
      else resolve(result === undefined ? { completed: true } : result);
    });
  });
}

export function requireEchoPreservedEvidence(state) {
  requireProof(state && Array.isArray(state.visits) && state.visits.length > 0
    && state.visits.every(item => Number.isSafeInteger(item.count) && item.count > 0)
    && Array.isArray(state.bookmarks) && state.bookmarks.length > 0 && state.bookmarks.every(item => item.present === true)
    && state.safeHistoryCount > 0 && state.safeBookmarkPresent === true
    && Array.isArray(state.tabs) && state.tabs.length === 2 && state.tabs.every(item => item.present === true)
    && state.tabs[0].active === false,
  'SPECIMENS_NOT_PRESERVED', state);
  return state;
}

export function requireEchoPolicyEvidence(settings, { childrenEnabled, familyPaused, globalPaused }) {
  const control = requireArtifactControlState(settings?.artifactControlState);
  requireProof([childrenEnabled, familyPaused, globalPaused].every(value => typeof value === 'boolean')
    && isDeepStrictEqual(settings.blockedUrls, [ECHO_QA_HOST, 'youtube.com', 'x.com'])
    && ['historyCleanupForBlocked', 'concealBlockedBookmarks', 'tabEvaporationForBlocked']
      .every(key => settings[key] === childrenEnabled)
    && settings.tabEvaporationTimeoutMinutes === 5 && control.familySuspensions.echo === familyPaused
    && control.globalPaused === globalPaused, 'CURRENT_POLICY_MISMATCH', settings);
  return settings;
}

export function requireEchoRemovedEvidence(state, { tabRemoved = false } = {}) {
  requireProof(state && Array.isArray(state.visits) && state.visits.length > 0
    && state.visits.every(item => item.count === 0)
    && Array.isArray(state.bookmarks) && state.bookmarks.length > 0 && state.bookmarks.every(item => item.present === false)
    && state.safeHistoryCount > 0 && state.safeBookmarkPresent === true
    && Array.isArray(state.tabs) && state.tabs.length === 2
    && state.tabs[0].present === !tabRemoved && state.tabs[1].present === true,
  'EXACT_REMOVALS_NOT_PROVEN', state);
  return state;
}

export function requireEchoWorkerEvidence({ stopped, revived, settings, expected, checkpointBefore, checkpointAfter }) {
  requireProof(typeof stopped?.targetId === 'string' && typeof revived?.targetId === 'string'
    && stopped.targetId.length > 0 && revived.targetId.length > 0 && stopped.targetId !== revived.targetId
    && isDeepStrictEqual(settings, expected), 'WORKER_CONTINUITY_NOT_PROVEN', { stopped, revived, settings, expected });
  if (checkpointBefore !== undefined || checkpointAfter !== undefined) {
    requireTabEvaporationCheckpoint(checkpointBefore);
    requireTabEvaporationCheckpoint(checkpointAfter);
    requireProof(isDeepStrictEqual(checkpointBefore, checkpointAfter), 'INACTIVITY_INTERVAL_CHANGED', { checkpointBefore, checkpointAfter });
  }
  return { stoppedTargetId: stopped.targetId, revivedTargetId: revived.targetId, settings,
    ...(checkpointBefore === undefined ? {} : { checkpointBefore, checkpointAfter }) };
}

export function requireEchoArtifactsComplete(steps) {
  requireProof(Array.isArray(steps) && steps.length === ECHO_ARTIFACT_QA_STEPS.length
    && steps.every((step, index) => step.id === ECHO_ARTIFACT_QA_STEPS[index] && step.status === 'PASS'), 'INCOMPLETE');
  return true;
}

export async function observeEchoPreservedTick({ label, readHealth, readState, until }) {
  const before = await readHealth();
  const after = await until(label, async () => {
    const state = requireEchoPreservedEvidence(await readState());
    return { state, health: await readHealth() };
  }, sample => sample.health.counters.tickCompleted > before.counters.tickCompleted
    && sample.health.lastTickSource === 'alarm' && sample.health.lastTickCompletedAt > before.lastTickCompletedAt, 90_000);
  requireProof(after.health.counters.tickFailed === before.counters.tickFailed, 'TICK_FAILED', after.health);
  // The tick may delete between the poll's state read and its health read.
  // Only a new browser inventory after completed-tick admission proves survival.
  const postTickState = requireEchoPreservedEvidence(await readState());
  return { postTickState, health: after.health, priorTickCompleted: before.counters.tickCompleted };
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal }) {
  requireEchoArtifactsPlan({ plan, artifact, browser });
  const startedAt = Date.now(), reportPath = path.join(attachmentsDir, 'echo-artifacts.json');
  const report = { schemaVersion: 1, browserStarts: 0, specimens: null,
    scope: { browserApis: 'real_chrome', fixture: 'owned_disposable_profile', tabTimeoutMs: 300_000,
      clock: 'real_wall_clock', checkpointWrites: false, alarmReplacement: false,
      tabDeadlineEvidence: 'first_absence_poll_2s_resolution',
      excludes: ['native_permission_prompt', 'dashboard_confirmation_ui', 'ceremony', 'inflight_native_delete_race',
        'mature_tab_suppression_deadline', 'extension_disable_enable_activation'] },
    steps: ECHO_ARTIFACT_QA_STEPS.map(id => ({ id, status: 'NOT_RUN' })) };
  const writeReport = () => fs.writeFile(reportPath, `${JSON.stringify({ ...report, durationMs: Date.now() - startedAt }, null, 2)}\n`);
  registerCleanup('echo_artifacts_evidence', async () => { await writeReport(); return { reportPath }; });
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (![ECHO_QA_HOST, SAFE_HOST].includes(url.hostname)) { response.writeHead(403); response.end(); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('<!doctype html><meta charset="utf-8"><title>Disposable Echo QA specimen</title><p>Run-owned inert fixture</p>');
  });
  registerCleanup('echo_artifacts_fixture_server', () => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve({ closed: true })); server.closeAllConnections();
  }));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = host => `http://${host}:${server.address().port}/`;
  const temporaryManifest = createEchoArtifactsTemporaryManifest();
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment, displayReceipt: browser.display,
    renderingRequirement: plan.browserExecution.renderingRequirement, temporaryManifest, keepTemp: false,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, tempPrefix: 'entropy-echo-artifacts-', recoveryJournal });
  registerCleanup('echo_artifacts_browser', () => harness.close());
  await harness.start(); report.browserStarts += 1;
  requireIntegratedDisposableFixtureOwner(harness);
  await reportBrowserGpuCapability(harness.gpuCapability);
  const send = request => sendTrustedRuntimeMessage(harness, request);
  const api = (method, ...args) => {
    requireIntegratedDisposableFixtureOwner(harness);
    return harness.evaluateInTrustedPage(`(${callEchoFixtureApi.toString()})(${JSON.stringify({ method, args })})`);
  };
  async function settings(items) {
    signal?.throwIfAborted();
    return requireConsumptionQaSettingsAcknowledgement(await send({ action: MESSAGE_ACTIONS.SET_SETTINGS,
      items, waitForPropagation: true }), items);
  }
  async function readSettings() {
    const result = await send({ action: MESSAGE_ACTIONS.GET_SETTINGS, keys: POLICY_KEYS });
    requireProof(result?.success === true && result.settings && POLICY_KEYS.every(key => Object.hasOwn(result.settings, key)), 'SETTINGS_REQUIRED', result);
    return result.settings;
  }
  async function until(label, read, accept, timeoutMs = 20_000, pollMs = 500) {
    const deadline = Date.now() + timeoutMs;
    let value, nextProgressAt = Date.now() + 30_000;
    do {
      signal?.throwIfAborted(); value = await read();
      if (accept(value)) return value;
      if (Date.now() >= nextProgressAt) {
        await evidence.event('QA_ECHO_ARTIFACT_WAIT', { label, elapsedMs: Date.now() - startedAt });
        console.log(JSON.stringify({ event: 'QA_ECHO_ARTIFACT_WAIT', label, elapsedMs: Date.now() - startedAt }));
        nextProgressAt = Date.now() + 30_000;
      }
      await sleep(pollMs);
    } while (Date.now() < deadline);
    requireProof(false, 'TIMEOUT', { label, value });
  }
  async function step(id, work) {
    const entry = report.steps.find(item => item.id === id), beganAt = Date.now();
    entry.status = 'RUNNING'; await evidence.event('QA_ECHO_ARTIFACT_STEP_STARTED', { id });
    try { entry.result = await work(); entry.status = 'PASS'; }
    catch (error) { entry.status = 'FAIL'; entry.error = { code: error.code, message: error.message, diagnostic: error.diagnostic }; throw error; }
    finally { entry.durationMs = Date.now() - beganAt; await writeReport(); await evidence.event('QA_ECHO_ARTIFACT_STEP_FINISHED', entry); }
    return entry.result;
  }
  async function health() {
    const key = STORAGE_SESSION_KEYS.STATS_HEALTH, values = await api('storage.session.get', key);
    const state = values[key];
    requireProof(state?.schemaVersion === 1 && Number.isSafeInteger(state.counters?.tickCompleted)
      && Number.isSafeInteger(state.counters?.tickFailed), 'TICK_HEALTH_REQUIRED', state);
    return state;
  }
  async function checkpoint() {
    const key = STORAGE_SESSION_KEYS.TAB_EVAPORATION, values = await api('storage.session.get', key);
    return Object.hasOwn(values, key) ? requireTabEvaporationCheckpoint(values[key]) : null;
  }
  async function snapshot() {
    const fixture = report.specimens;
    requireProof(fixture !== null, 'SPECIMENS_REQUIRED');
    const visits = [];
    for (const url of fixture.historyUrls) {
      const entries = await api('history.getVisits', { url });
      requireProof(Array.isArray(entries), 'VISITS_INVALID'); visits.push({ url, count: entries.length });
    }
    const safeVisits = await api('history.getVisits', { url: fixture.safeUrl });
    const tree = await api('bookmarks.getTree'), bookmarkNodes = new Map();
    const walk = nodes => { for (const node of nodes) { bookmarkNodes.set(node.id, node); if (node.children) walk(node.children); } };
    requireProof(Array.isArray(tree) && Array.isArray(safeVisits), 'BROWSER_INVENTORY_INVALID'); walk(tree);
    const tabs = await api('tabs.query', {});
    requireProof(Array.isArray(tabs), 'TAB_INVENTORY_INVALID');
    return { visits, bookmarks: fixture.bookmarks.map(item => {
      const node = bookmarkNodes.get(item.id);
      requireProof(node === undefined || node.url === item.url, 'BOOKMARK_IDENTITY_CHANGED', { item, node });
      return { ...item, present: node !== undefined };
    }), safeHistoryCount: safeVisits.length, safeBookmarkPresent: bookmarkNodes.has(fixture.safeBookmarkId),
    tabs: [fixture.protectedTab, fixture.safeTab].map(page => {
      const tab = tabs.find(item => item.id === page.tabId);
      requireProof(tab === undefined || tab.url === page.url, 'TAB_IDENTITY_CHANGED', { page, tab });
      return { tabId: page.tabId, url: page.url, present: tab !== undefined,
        ...(tab === undefined ? {} : { active: tab.active, pinned: tab.pinned, audible: tab.audible,
          lastAccessed: tab.lastAccessed, status: tab.status }) };
    }) };
  }
  async function tickWhilePreserved(label) {
    return observeEchoPreservedTick({ label, readHealth: health, readState: snapshot, until });
  }
  const expectedBuild = { buildId: artifact.buildId, releaseProfile: artifact.releaseProfile };
  async function verifyBuild() {
    const identity = await requireEntropyAttachedArtifactRuntimeIdentity(harness, {
      artifactIdentity: { artifactId: artifact.id, inputDigest: artifact.inputDigest, ...expectedBuild },
      temporaryManifest, trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH });
    await requireEntropyTrackingRuntimeReadiness(harness, { expectedBuild });
    return identity;
  }
  const controlState = (familyPaused, globalPaused) => ({ ...structuredClone(DEFAULT_ARTIFACT_CONTROL_STATE),
    globalPaused, familySuspensions: { ...DEFAULT_ARTIFACT_CONTROL_STATE.familySuspensions, echo: familyPaused } });
  try {
    await step('owned_fixture', async () => {
      const build = await verifyBuild();
      requireProof(await api('permissions.contains', { permissions: ['history', 'bookmarks', 'scripting'],
        origins: [`http://${ECHO_QA_HOST}/*`] }) === true, 'FIXTURE_PERMISSIONS_REQUIRED');
      const alarm = await api('alarms.get', getAlarmName());
      requireProof(alarm?.name === getAlarmName() && alarm.periodInMinutes === 1, 'ORDINARY_TICK_ALARM_REQUIRED', alarm);
      const filters = structuredClone(CONFIG_DEFAULT_FILTER_SETTINGS);
      for (const filter of Object.values(filters)) filter.isActive = false;
      await settings({ filteringMode: 'blocklist', permissionMode: 'selective', rulesMode: 'managed',
        filterSettings: filters, gateConfig: structuredClone(DEFAULT_GATE_CONFIG), nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS),
        dataCollectionMode: 'off', precisionInsightsMode: 'off', insightsMode: 'off', insightsConsent: 'later',
        historyCleanupForBlocked: false, concealBlockedBookmarks: false, tabEvaporationForBlocked: false,
        tabEvaporationTimeoutMinutes: 5, artifactControlState: controlState(false, false) });
      // Rule lists stay in the canonical site-rule command lane. The exact
      // allowed-to-blocked move materializes its empty opposite list.
      const upsert = async (domain, type, confirmExactMove = false) => {
        const reply = requireSettingsRuntimeCommandAcknowledgement(MESSAGE_ACTIONS.UPSERT_SITE_RULE,
          await send({ action: MESSAGE_ACTIONS.UPSERT_SITE_RULE, domain, type, confirmExactMove, waitForPropagation: true }));
        requireProof(reply.propagation?.status === 'succeeded', 'SITE_RULE_PROPAGATION_REQUIRED', reply);
        return reply;
      };
      await upsert(ECHO_QA_HOST, 'allowed');
      await upsert(ECHO_QA_HOST, 'blocked', true);
      for (const domain of ['youtube.com', 'x.com']) await upsert(domain, 'blocked');
      requireEchoPolicyEvidence(await readSettings(), { childrenEnabled: false, familyPaused: false, globalPaused: false });
      const protectedUrl = `${base(ECHO_QA_HOST)}inactive`, safeUrl = `${base(SAFE_HOST)}retained`;
      const protectedTab = await harness.openPage(protectedUrl, { active: false });
      const safeTab = await harness.openPage(safeUrl, { active: false });
      requireProof(Number.isInteger(protectedTab.tabId) && Number.isInteger(safeTab.tabId), 'OWNED_TAB_IDS_REQUIRED');
      const historyUrls = [`${base(ECHO_QA_HOST)}history`, 'https://youtu.be/entropy-qa-specimen', 'https://twitter.com/entropy-qa-specimen'];
      const bookmarks = [];
      for (const url of historyUrls) {
        await api('history.addUrl', { url });
        const node = await api('bookmarks.create', { title: 'Entropy disposable Echo specimen', url });
        requireProof(typeof node?.id === 'string' && node.url === url, 'BOOKMARK_SEED_REQUIRED');
        bookmarks.push({ id: node.id, url });
      }
      await api('history.addUrl', { url: safeUrl });
      const safeBookmark = await api('bookmarks.create', { title: 'Entropy retained control', url: safeUrl });
      requireProof(typeof safeBookmark?.id === 'string' && safeBookmark.url === safeUrl, 'SAFE_BOOKMARK_SEED_REQUIRED');
      report.specimens = { historyUrls, bookmarks, safeUrl, safeBookmarkId: safeBookmark.id,
        protectedTab: { targetId: protectedTab.targetId, tabId: protectedTab.tabId, url: protectedUrl },
        safeTab: { targetId: safeTab.targetId, tabId: safeTab.tabId, url: safeUrl } };
      return { build, permissions: ['history', 'bookmarks', 'scripting'], state: requireEchoPreservedEvidence(await snapshot()) };
    });
    await step('consent_off', async () => ({ settings: requireEchoPolicyEvidence(await readSettings(),
      { childrenEnabled: false, familyPaused: false, globalPaused: false }), ...await tickWhilePreserved('consent_off_tick') }));
    await step('family_pause', async () => {
      const acknowledgement = await settings({ ...CHILD_INTENT, artifactControlState: controlState(true, false) });
      // Generate a real onVisited event after suppression and enabled consent
      // have both committed; an old pre-pause visit cannot prove this ingress.
      await api('history.addUrl', { url: report.specimens.historyUrls[0] });
      return { acknowledgement, settings: requireEchoPolicyEvidence(await readSettings(),
        { childrenEnabled: true, familyPaused: true, globalPaused: false }), ...await tickWhilePreserved('family_pause_tick') };
    });
    await step('global_pause', async () => {
      const acknowledgement = await settings({ artifactControlState: controlState(false, true) });
      await api('history.addUrl', { url: report.specimens.historyUrls[0] });
      return { acknowledgement, settings: requireEchoPolicyEvidence(await readSettings(),
        { childrenEnabled: true, familyPaused: false, globalPaused: true }), ...await tickWhilePreserved('global_pause_tick') };
    });
    await step('paused_worker_revival', async () => {
      const expected = await readSettings(), stopped = await harness.stopServiceWorker();
      const settings = await readSettings(), revived = await harness.waitForServiceWorker({ previousTargetId: stopped.targetId });
      await verifyBuild();
      return { ...requireEchoWorkerEvidence({ stopped, revived, settings, expected }), ...await tickWhilePreserved('paused_revived_tick') };
    });
    await step('resume_removal', async () => {
      const acknowledgement = await settings({ artifactControlState: controlState(false, false) });
      const state = await until('history_and_bookmark_removed', snapshot, value => value.visits.every(item => item.count === 0)
        && value.bookmarks.every(item => item.present === false));
      requireEchoRemovedEvidence(state);
      const saved = requireEchoPolicyEvidence(await readSettings(), { childrenEnabled: true, familyPaused: false, globalPaused: false });
      return { acknowledgement, settings: saved, state };
    });
    await step('inactive_worker_revival', async () => {
      const before = await until('real_inactive_checkpoint', checkpoint, value => value !== null
        && value.tabs.some(tab => tab.tabId === report.specimens.protectedTab.tabId), 90_000);
      const entry = before.tabs.find(tab => tab.tabId === report.specimens.protectedTab.tabId);
      requireProof(entry.url === report.specimens.protectedTab.url && Date.now() - entry.inactiveSince < 300_000,
        'REAL_INACTIVE_INTERVAL_REQUIRED', entry);
      const expected = await readSettings(), stopped = await harness.stopServiceWorker();
      const settings = await readSettings(), revived = await harness.waitForServiceWorker({ previousTargetId: stopped.targetId });
      await verifyBuild();
      return { ...requireEchoWorkerEvidence({ stopped, revived, settings, expected,
        checkpointBefore: before, checkpointAfter: await checkpoint() }), state: requireEchoRemovedEvidence(await snapshot()) };
    });
    await step('real_tab_evaporation', async () => {
      const before = report.steps.find(entry => entry.id === 'inactive_worker_revival').result.checkpointBefore;
      const interval = before.tabs.find(tab => tab.tabId === report.specimens.protectedTab.tabId);
      const observation = await until('real_five_minute_removal', async () => {
        const value = await snapshot();
        const observedAtEpochMs = Date.now();
        requireEchoRemovedEvidence(value, { tabRemoved: !value.tabs[0].present });
        requireProof(value.tabs[0].present || observedAtEpochMs - interval.inactiveSince >= 300_000, 'TAB_REMOVED_BEFORE_DEADLINE');
        return { state: value, observedAtEpochMs };
      }, value => value.state.tabs[0].present === false, 420_000, 2_000);
      const state = observation.state;
      requireEchoRemovedEvidence(state, { tabRemoved: true });
      const after = await until('removed_tab_checkpoint', checkpoint, value => value !== null
        && !value.tabs.some(tab => tab.tabId === report.specimens.protectedTab.tabId));
      return { state, checkpointBefore: before, checkpointAfter: after,
        observedAtEpochMs: observation.observedAtEpochMs,
        observedIdleMs: observation.observedAtEpochMs - interval.inactiveSince,
        removalEvidence: 'first_absence_poll', removalPollIntervalMs: 2_000, health: await health() };
    });
    requireEchoArtifactsComplete(report.steps);
    return { status: 'PASS', protocol: 'echo_artifacts', verdictScope: 'product', buildId: artifact.buildId,
      reportPath, scope: report.scope, browserStarts: report.browserStarts, steps: report.steps };
  } catch (error) {
    await evidence.event('QA_ECHO_ARTIFACT_FAILURE', { code: error.code, message: error.message, diagnostic: error.diagnostic });
    throw error;
  }
}
