import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ExtensionChromiumHarness, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { normalizeChromiumHarnessTemporaryManifest } from '../../e2e/chromiumHarnessManifestPromotion.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/contracts/messageTypes.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../src/domains/settings/config/index.js';
import { DEFAULT_ARTIFACT_CONTROL_STATE } from '../../../src/domains/settings/config/artifactControlState.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { requireSettingsRuntimeCommandAcknowledgement } from '../../../src/domains/settings/config/settingsRuntimeCommandAcknowledgement.js';
import { STORAGE_SESSION_KEYS } from '../../../src/platform/storage/runtime/RuntimeSessionRepository.js';
import { requireProtectedTabGroupsState } from '../../../src/platform/storage/runtime/ProtectedTabGroupsRepository.js';
import { sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { requireEntropyAttachedArtifactRuntimeIdentity, requireEntropyTrackingRuntimeReadiness } from './attachOnlyActivePageAdapter.mjs';
import { requireIntegratedDisposableFixtureOwner } from './integratedSettingsLifecycleFixture.mjs';
import { ensureQaSecurityVaultReady } from './securityVaultQaFixture.mjs';

export const TAB_MANAGEMENT_QA_HOST = 'tab-management.localhost';
const SAFE_HOST = 'tab-management-safe.localhost';
export const TAB_MANAGEMENT_QA_STEPS = Object.freeze([
  'owned_fixture', 'initial_native_groups', 'manual_detach', 'worker_revival', 'unprotected_navigation', 'grouping_off',
]);

function requireProof(condition, code, diagnostic) {
  if (condition) return;
  const error = new Error(`QA_TAB_MANAGEMENT_${code}`);
  error.code = `QA_TAB_MANAGEMENT_${code}`;
  error.diagnostic = diagnostic;
  throw error;
}

export function createTabManagementTemporaryManifest() {
  return normalizeChromiumHarnessTemporaryManifest({ requiredPermissions: ['tabGroups', 'scripting'],
    requiredHostPermissions: [`http://${TAB_MANAGEMENT_QA_HOST}/*`] });
}

export function requireTabManagementPlan({ plan, artifact, browser }) {
  requireProof(plan?.target?.id === 'artifacts/tab-management' && plan.target.protocolId === 'tab_management'
    && plan.target.environmentId === 'ephemeral' && plan.mode === 'agent'
    && artifact?.id === 'dev_extension' && artifact.releaseProfile === 'dev'
    && browser?.processOwnership === 'owned' && plan.browserExecution?.processOwnership === 'owned'
    && plan.browserExecution.osFocus === 'never' && plan.browserExecution.targetActivation === 'active'
    && plan.protocolOptions?.fixturePolicy === 'owned_ephemeral_native_tab_groups'
    && plan.protocolOptions.permissionPolicy === 'temporary_manifest_tab_groups', 'DISPOSABLE_DEV_REQUIRED');
  return true;
}

// Runs only in the verified harness-owned trusted page. Native group/update
// mutations seed user organization or simulate explicit manual detachment;
// every measured Entropy grouping is triggered by canonical settings/events.
export async function callTabManagementFixtureApi({ method, args }, browserApi = chrome) {
  const allowed = ['tabs.query', 'tabs.update', 'tabs.group', 'tabs.ungroup', 'tabGroups.query', 'tabGroups.update',
    'action.getBadgeText', 'storage.session.get', 'permissions.contains'];
  if (!allowed.includes(method) || !Array.isArray(args)) throw new Error('QA_TAB_MANAGEMENT_FIXTURE_API_FORBIDDEN');
  const parts = method.split('.'), name = parts.pop();
  const owner = parts.reduce((value, key) => value?.[key], browserApi);
  if (typeof owner?.[name] !== 'function') throw new Error(`QA_TAB_MANAGEMENT_FIXTURE_API_REQUIRED:${method}`);
  return new Promise((resolve, reject) => {
    owner[name](...args, result => {
      const error = browserApi.runtime.lastError;
      if (error) reject(new Error(`QA_TAB_MANAGEMENT_FIXTURE_API_FAILED:${method}:${error.message}`));
      else resolve(result === undefined ? { completed: true } : result);
    });
  });
}

export function requireTabManagementNativeEvidence(state, { groupedIds, pinnedId, userId, userGroupId,
  detachedIds = [], ungroupedIds = [], protectedCount }) {
  requireProof(Array.isArray(state?.tabs) && Array.isArray(state.groups) && typeof state.badge === 'string'
    && Array.isArray(groupedIds) && groupedIds.length > 0 && Number.isInteger(protectedCount)
    && state.badge === String(protectedCount), 'NATIVE_EVIDENCE_INVALID', state);
  const byId = new Map(state.tabs.map(tab => [tab.id, tab]));
  const managed = byId.get(groupedIds[0]);
  const group = state.groups.find(item => item.id === managed?.groupId);
  requireProof(Number.isInteger(managed?.groupId) && managed.groupId >= 0
    && group?.windowId === managed.windowId && group.title === 'Entropy' && group.color === 'grey'
    && groupedIds.every(id => byId.get(id)?.groupId === group.id && byId.get(id).windowId === group.windowId)
    && byId.get(pinnedId)?.pinned === true && byId.get(pinnedId).groupId === -1
    && byId.get(userId)?.groupId === userGroupId
    && state.groups.some(item => item.id === userGroupId && item.title === 'Personal fixture group' && item.color === 'blue' && item.collapsed === true)
    && [...detachedIds, ...ungroupedIds].every(id => byId.get(id)?.groupId === -1), 'USER_ORGANIZATION_CHANGED', state);
  const checkpoint = requireProtectedTabGroupsState(state.checkpoint);
  requireProof(detachedIds.every(id => checkpoint.processedTabIds.includes(id) && !checkpoint.memberTabIds.includes(id)),
    'MANUAL_DETACH_NOT_RETAINED', checkpoint);
  return state;
}

export function requireTabManagementComplete(steps) {
  requireProof(Array.isArray(steps) && steps.length === TAB_MANAGEMENT_QA_STEPS.length
    && steps.every((step, index) => step.id === TAB_MANAGEMENT_QA_STEPS[index] && step.status === 'PASS'), 'INCOMPLETE');
  return true;
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal }) {
  requireTabManagementPlan({ plan, artifact, browser });
  const startedAt = Date.now(), reportPath = path.join(attachmentsDir, 'tab-management.json');
  const report = { schemaVersion: 1, browserStarts: 0, specimens: null,
    scope: { browserApis: 'real_chrome', fixture: 'owned_disposable_profile', checkpointWrites: false,
      windows: 'one_native_window', userActions: 'fixture_group_pin_and_manual_detach',
      excludes: ['native_permission_prompt', 'dashboard_toggle_ui', 'multiwindow_browser', 'gate_navigation', 'incognito'] },
    steps: TAB_MANAGEMENT_QA_STEPS.map(id => ({ id, status: 'NOT_RUN' })) };
  const writeReport = () => fs.writeFile(reportPath, `${JSON.stringify({ ...report, durationMs: Date.now() - startedAt }, null, 2)}\n`);
  registerCleanup('tab_management_evidence', async () => { await writeReport(); return { reportPath }; });
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (![TAB_MANAGEMENT_QA_HOST, SAFE_HOST].includes(url.hostname)) { response.writeHead(403); response.end(); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('<!doctype html><meta charset="utf-8"><title>Native tab group QA</title><p>Run-owned inert fixture</p>');
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  registerCleanup('tab_management_fixture_server', () => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve({ closed: true })); server.closeAllConnections();
  }));
  const base = host => `http://${host}:${server.address().port}/`;
  const temporaryManifest = createTabManagementTemporaryManifest();
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment, displayReceipt: browser.display,
    renderingRequirement: plan.browserExecution.renderingRequirement, temporaryManifest, keepTemp: false,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, tempPrefix: 'entropy-tab-management-', recoveryJournal });
  registerCleanup('tab_management_browser', () => harness.close());
  await harness.start(); report.browserStarts += 1;
  requireIntegratedDisposableFixtureOwner(harness);
  await reportBrowserGpuCapability(harness.gpuCapability);
  const send = request => sendTrustedRuntimeMessage(harness, request);
  const api = (method, ...args) => {
    requireIntegratedDisposableFixtureOwner(harness);
    return harness.evaluateInTrustedPage(`(${callTabManagementFixtureApi.toString()})(${JSON.stringify({ method, args })})`);
  };
  async function settings(items) {
    signal?.throwIfAborted();
    return requireConsumptionQaSettingsAcknowledgement(await send({ action: MESSAGE_ACTIONS.SET_SETTINGS,
      items, waitForPropagation: true }), items);
  }
  async function readSettings() {
    const response = await send({ action: MESSAGE_ACTIONS.GET_SETTINGS, keys: ['tabManagement', 'gateConfig', 'artifactControlState'] });
    requireProof(response?.success === true && response.settings?.tabManagement && response.settings.gateConfig
      && response.settings.artifactControlState, 'SETTINGS_REQUIRED', response);
    return response.settings;
  }
  async function snapshot() {
    const [tabs, groups, badge, values] = await Promise.all([api('tabs.query', {}), api('tabGroups.query', {}),
      api('action.getBadgeText', {}), api('storage.session.get', STORAGE_SESSION_KEYS.PROTECTED_TAB_GROUPS)]);
    return { tabs, groups, badge, checkpoint: values[STORAGE_SESSION_KEYS.PROTECTED_TAB_GROUPS] };
  }
  async function until(label, read, accept, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    let value;
    do {
      signal?.throwIfAborted(); value = await read();
      if (accept(value)) return value;
      await sleep(250);
    } while (Date.now() < deadline);
    requireProof(false, 'TIMEOUT', { label, value });
  }
  async function step(id, work) {
    const entry = report.steps.find(item => item.id === id), beganAt = Date.now();
    entry.status = 'RUNNING'; await evidence.event('QA_TAB_MANAGEMENT_STEP_STARTED', { id });
    try { entry.result = await work(); entry.status = 'PASS'; }
    catch (error) { entry.status = 'FAIL'; entry.error = { code: error.code, message: error.message, diagnostic: error.diagnostic }; throw error; }
    finally { entry.durationMs = Date.now() - beganAt; await writeReport(); await evidence.event('QA_TAB_MANAGEMENT_STEP_FINISHED', entry); }
    return entry.result;
  }
  const expectedBuild = { buildId: artifact.buildId, releaseProfile: artifact.releaseProfile };
  async function verifyBuild() {
    const identity = await requireEntropyAttachedArtifactRuntimeIdentity(harness, {
      artifactIdentity: { artifactId: artifact.id, inputDigest: artifact.inputDigest, ...expectedBuild },
      temporaryManifest, trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH });
    await requireEntropyTrackingRuntimeReadiness(harness, { expectedBuild });
    return identity;
  }
  const gateConfig = { ...structuredClone(DEFAULT_GATE_CONFIG), detourSpreadGuard: { enabled: false, maxProtectedTabs: 7 } };
  let pages, userGroupId;
  const expected = (groupedIds, protectedCount, detachedIds = [], ungroupedIds = []) => ({ groupedIds, protectedCount,
    detachedIds, ungroupedIds, pinnedId: pages.pinned.tabId, userId: pages.user.tabId, userGroupId });
  try {
    await step('owned_fixture', async () => {
      const securityVault = await ensureQaSecurityVaultReady(harness, {
        passphrase: randomBytes(32).toString('base64url'),
      });
      await evidence.event('QA_TAB_MANAGEMENT_SECURITY_VAULT_READY', securityVault);
      const build = await verifyBuild();
      requireProof(await api('permissions.contains', { permissions: ['tabGroups', 'scripting'],
        origins: [`http://${TAB_MANAGEMENT_QA_HOST}/*`] }) === true, 'FIXTURE_PERMISSIONS_REQUIRED');
      const filters = structuredClone(CONFIG_DEFAULT_FILTER_SETTINGS);
      for (const filter of Object.values(filters)) filter.isActive = false;
      await settings({ tabManagement: { groupProtectedTabs: false }, filteringMode: 'blocklist', permissionMode: 'selective', rulesMode: 'managed',
        filterSettings: filters, gateConfig, nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS),
        dataCollectionMode: 'off', precisionInsightsMode: 'off', insightsMode: 'off', insightsConsent: 'later',
        historyCleanupForBlocked: false, concealBlockedBookmarks: false, tabEvaporationForBlocked: false,
        artifactControlState: structuredClone(DEFAULT_ARTIFACT_CONTROL_STATE) });
      for (const [type, confirmExactMove] of [['allowed', false], ['blocked', true]]) {
        const reply = requireSettingsRuntimeCommandAcknowledgement(MESSAGE_ACTIONS.UPSERT_SITE_RULE,
          await send({ action: MESSAGE_ACTIONS.UPSERT_SITE_RULE, domain: TAB_MANAGEMENT_QA_HOST, type, confirmExactMove, waitForPropagation: true }));
        requireProof(reply.propagation?.status === 'succeeded', 'SITE_RULE_PROPAGATION_REQUIRED', reply);
      }
      pages = {};
      for (const name of ['first', 'second', 'manual', 'pinned', 'user', 'safe']) {
        const url = `${base(name === 'safe' ? SAFE_HOST : TAB_MANAGEMENT_QA_HOST)}${name}`;
        pages[name] = await harness.openPage(url, { active: !pages.first, ...(pages.first ? { sameWindowAs: pages.first } : {}) });
        requireProof(Number.isInteger(pages[name].tabId), 'OWNED_TAB_ID_REQUIRED');
      }
      await api('tabs.update', pages.pinned.tabId, { pinned: true });
      userGroupId = await api('tabs.group', { tabIds: [pages.user.tabId] });
      requireProof(Number.isInteger(userGroupId), 'USER_GROUP_REQUIRED');
      await api('tabGroups.update', userGroupId, { title: 'Personal fixture group', color: 'blue', collapsed: true });
      report.specimens = Object.fromEntries(Object.entries(pages).map(([name, page]) => [name, { tabId: page.tabId, targetId: page.targetId }]));
      return { build, securityVault, userGroupId, settings: await readSettings(), state: await snapshot() };
    });
    await step('initial_native_groups', async () => {
      const acknowledgement = await settings({ tabManagement: { groupProtectedTabs: true } });
      const state = await until('initial_groups', snapshot, value => value.badge === '5'
        && ['first', 'second', 'manual'].every(name => value.tabs.some(tab => tab.id === pages[name].tabId && tab.groupId >= 0 && tab.groupId !== userGroupId)));
      return { acknowledgement, state: requireTabManagementNativeEvidence(state,
        expected([pages.first.tabId, pages.second.tabId, pages.manual.tabId], 5, [], [pages.safe.tabId])) };
    });
    await step('manual_detach', async () => {
      await api('tabs.ungroup', [pages.manual.tabId]);
      const state = await until('manual_detach', snapshot, value => value.checkpoint?.processedTabIds.includes(pages.manual.tabId)
        && !value.checkpoint.memberTabIds.includes(pages.manual.tabId));
      return { state: requireTabManagementNativeEvidence(state, expected([pages.first.tabId, pages.second.tabId], 5, [pages.manual.tabId], [pages.safe.tabId])) };
    });
    await step('worker_revival', async () => {
      const saved = await readSettings(), stopped = await harness.stopServiceWorker();
      const restored = await readSettings(), revived = await harness.waitForServiceWorker({ previousTargetId: stopped.targetId });
      requireProof(stopped.targetId !== revived.targetId && isDeepStrictEqual(saved, restored), 'WORKER_CONTINUITY_REQUIRED');
      const build = await verifyBuild();
      pages.fresh = await harness.openPage(`${base(TAB_MANAGEMENT_QA_HOST)}after-worker`, { active: false, sameWindowAs: pages.first });
      const state = await until('revived_group', snapshot, value => value.badge === '6'
        && value.tabs.some(tab => tab.id === pages.fresh.tabId && tab.groupId >= 0));
      return { stoppedTargetId: stopped.targetId, revivedTargetId: revived.targetId, build,
        state: requireTabManagementNativeEvidence(state, expected([pages.first.tabId, pages.second.tabId, pages.fresh.tabId], 6, [pages.manual.tabId], [pages.safe.tabId])) };
    });
    await step('unprotected_navigation', async () => {
      await harness.navigatePage(pages.second, `${base(SAFE_HOST)}released`);
      const state = await until('unprotected_cleanup', snapshot, value => value.badge === '5'
        && value.tabs.some(tab => tab.id === pages.second.tabId && tab.groupId === -1));
      return { state: requireTabManagementNativeEvidence(state, expected([pages.first.tabId, pages.fresh.tabId], 5, [pages.manual.tabId], [pages.safe.tabId, pages.second.tabId])) };
    });
    await step('grouping_off', async () => {
      const before = await snapshot();
      const acknowledgement = await settings({ tabManagement: { groupProtectedTabs: false } });
      pages.off = await harness.openPage(`${base(TAB_MANAGEMENT_QA_HOST)}grouping-off`, { active: false, sameWindowAs: pages.first });
      const state = await until('grouping_off', snapshot, value => value.badge === ''
        && value.tabs.some(tab => tab.id === pages.off.tabId && tab.status === 'complete' && tab.groupId === -1));
      const saved = await readSettings();
      const oldGroup = before.tabs.find(tab => tab.id === pages.first.tabId).groupId;
      requireProof(saved.tabManagement.groupProtectedTabs === false && isDeepStrictEqual(saved.gateConfig, gateConfig)
        && [pages.first.tabId, pages.fresh.tabId].every(id => state.tabs.find(tab => tab.id === id)?.groupId === oldGroup)
        && state.tabs.find(tab => tab.id === pages.user.tabId)?.groupId === userGroupId
        && state.tabs.find(tab => tab.id === pages.manual.tabId)?.groupId === -1, 'OFF_INDEPENDENCE_REQUIRED', { saved, state });
      return { acknowledgement, settings: saved, state };
    });
    requireTabManagementComplete(report.steps);
    return { status: 'PASS', protocol: 'tab_management', verdictScope: 'product', buildId: artifact.buildId,
      reportPath, scope: report.scope, browserStarts: report.browserStarts, steps: report.steps };
  } catch (error) {
    await evidence.event('QA_TAB_MANAGEMENT_FAILURE', { code: error.code, message: error.message, diagnostic: error.diagnostic });
    throw error;
  }
}
