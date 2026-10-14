import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { evaluate } from '../../e2e/extensionChromiumHarness.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { requireStrongPassphrase } from '../../../src/platform/security/vaultCryptography.js';
import { requireSecurityVaultStatus } from '../../../src/platform/security/securityVaultStatusContract.js';
import { decryptLogRecord } from '../../../src/platform/security/encryptedLogContract.js';
import { requireCanonicalLogCryptoJwk } from '../../../src/platform/storage/security/keyMaterialContract.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../src/domains/settings/config/index.js';
import { buildFrictionFilters } from '../../../src/domains/settings/config/frictionPipeline.js';
import { integratedPortableState, requireIntegratedPortableSnapshot } from './integratedSettingsLifecycleFixture.mjs';

const FIXTURE_TIMEOUT_MS = 30_000;

// Closed protocol only: first preparation open/Dashboard/blank (3 loads),
// canonical reload management page (1), second preparation open/Dashboard (2).
// Before the comparison, its three owned pages can cause at most five tab
// activations through their three creations and the first two closures. The
// final preparation cleanup happens after comparison and is not admitted here.
const FIXTURE_LIFECYCLE_MAX_PAGE_LOADS = 3 + 1 + 2;
const FIXTURE_LIFECYCLE_MAX_TAB_SWITCHES = 2 + 2 + 1;

function hasExactFields(value, fields) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}

function requireFixtureTabCloseLog(value, record, { startedAt, completedAt }) {
  const filters = buildFrictionFilters(CONFIG_DEFAULT_FILTER_SETTINGS);
  const expectedTacticalState = { activeArtifacts: [], interventionIntensity: 0 };
  for (const [key, filter] of Object.entries(filters)) {
    if (!filter?.isActive) continue;
    expectedTacticalState.activeArtifacts.push(key);
    if (typeof filter.value === 'number') expectedTacticalState.interventionIntensity += filter.value;
  }
  const checks = {
    exactShape: hasExactFields(value, ['logType', 'id', 'timestamp', 'durationInCurrentState', 'reason',
      'metadata', 'operationalEnv', 'reclamationMarkers', 'tacticalState']),
    lifecycleType: value?.logType === 'intelligence' && value.reason === 'tab_closed',
    typedIdentity: Number.isSafeInteger(value?.id) && value.id > 0,
    timestampScope: Number.isSafeInteger(value?.timestamp) && value.timestamp === record.timestamp
      && value.timestamp >= startedAt && value.timestamp <= completedAt,
    typedDuration: Number.isSafeInteger(value?.durationInCurrentState) && value.durationInCurrentState >= 0
      && value.durationInCurrentState <= value.timestamp,
    emptyBrowsingIdentity: hasExactFields(value?.metadata, ['hostname']) && value.metadata.hostname === null,
    typedEnvironment: hasExactFields(value?.operationalEnv, ['totalActiveTabs', 'audibleSignalHosts'])
      && Number.isSafeInteger(value.operationalEnv.totalActiveTabs) && value.operationalEnv.totalActiveTabs > 0
      && Array.isArray(value.operationalEnv.audibleSignalHosts) && value.operationalEnv.audibleSignalHosts.length === 0,
    fixtureNavigationMetrics: hasExactFields(value?.reclamationMarkers,
      ['tabSwitches', 'pageLoads', 'videoInterventions'])
      && Number.isSafeInteger(value.reclamationMarkers.tabSwitches)
      && value.reclamationMarkers.tabSwitches >= 0
      && value.reclamationMarkers.tabSwitches <= FIXTURE_LIFECYCLE_MAX_TAB_SWITCHES
      && Number.isSafeInteger(value.reclamationMarkers.pageLoads)
      && value.reclamationMarkers.pageLoads >= 0
      && value.reclamationMarkers.pageLoads <= FIXTURE_LIFECYCLE_MAX_PAGE_LOADS
      && value.reclamationMarkers.videoInterventions === 0,
    canonicalFreshTacticalState: isDeepStrictEqual(value?.tacticalState, expectedTacticalState),
  };
  if (Object.values(checks).some(passed => !passed)) {
    const classification = value?.logType === 'intelligence' ? 'intelligence'
      : value?.type === 'background_bootstrap_diagnostic' ? 'background_bootstrap_diagnostic'
        : value?.type === 'background_full_init_event_gate_diagnostic' ? 'background_full_init_event_gate_diagnostic'
          : 'unknown_event_type';
    throw new Error(`QA_SECURITY_VAULT_UNEXPECTED_LIFECYCLE_LOG:${JSON.stringify({ classification, checks })}`);
  }
}

// Diagnostics describe shape only. Dictionary keys can themselves contain a
// domain or other private value, so only these static schema names are emitted.
const COMPARISON_PATH_FIELDS = new Set([
  'format', 'version', 'schemaVersion', 'local', 'documents', 'keyring', 'stateEntries', 'indexedDb',
  'settings.core', 'settings.rules', 'settings.ui', 'settings.security', 'meta.storage_schema', 'progression.state',
  'logCryptoJwk', 'domainHmacSecret', 'clseHmacJwk', 'alg', 'ext', 'k', 'key_ops', 'kty',
  'logs', 'statsHourly', 'statsDaily', 'statsFeaturePackDaily', 'interventionExposures',
  'interventionEffectDaily', 'favicons', 'modelState', 'zenArtifacts', 'clseBuckets60s',
  'clseBuckets5min', 'clseLoopEvents', 'clseBaseline', 'clseAggressionLogs', 'clseDailySummaries',
  'key', 'value', 'updatedAt', 'createdAt', 'timestamp', 'profileEpoch', 'revision', 'ciphertext',
  'monitor_cycleSettings', 'resetPolicy', 'recommendation', 'stage', 'pending', 'effectiveResetHour',
  'artifactControlState', 'notificationsConfig', 'filterSettings', 'isAnchorUnlocked', 'app-theme',
  'blockedUrls', 'allowedUrls', 'siteGoals', 'masterPasscodeHash', 'blockedUrlHashes', 'allowedUrlHashes',
  'siteGoalHashes', 'lastUpdatedAt', 'updated_at', 'created_at', 'stateRevision', 'model', 'throughAt',
]);

function summarizePortableDifference(actual, expected, phase) {
  const paths = [];
  const collections = [];
  let changedPathCount = 0;
  let visitedNodes = 0;
  let truncatedSubtrees = 0;
  const shape = (value, present) => !present ? 'missing'
    : value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const record = (location, actualValue, expectedValue, actualPresent = true, expectedPresent = true) => {
    changedPathCount += 1;
    if (paths.length < 24) paths.push({ path: location,
      expectedType: shape(expectedValue, expectedPresent), actualType: shape(actualValue, actualPresent) });
  };
  const visit = (actualValue, expectedValue, location) => {
    visitedNodes += 1;
    if (visitedNodes > 100_000) {
      truncatedSubtrees += 1;
      return;
    }
    if (isDeepStrictEqual(actualValue, expectedValue)) return;
    if (Array.isArray(actualValue) && Array.isArray(expectedValue)) {
      if (collections.length < 24) collections.push({ path: location,
        expectedCount: expectedValue.length, actualCount: actualValue.length });
      if (actualValue.length !== expectedValue.length) record(`${location}.length`, actualValue.length, expectedValue.length);
      for (let index = 0; index < Math.max(actualValue.length, expectedValue.length); index += 1) {
        if (index >= actualValue.length || index >= expectedValue.length) {
          record(`${location}[${index}]`, actualValue[index], expectedValue[index],
            index < actualValue.length, index < expectedValue.length);
        } else visit(actualValue[index], expectedValue[index], `${location}[${index}]`);
      }
      return;
    }
    if (actualValue !== null && expectedValue !== null && typeof actualValue === 'object'
      && typeof expectedValue === 'object' && !Array.isArray(actualValue) && !Array.isArray(expectedValue)) {
      const keys = [...new Set([...Object.keys(actualValue), ...Object.keys(expectedValue)])].sort();
      keys.forEach((key, index) => {
        const segment = COMPARISON_PATH_FIELDS.has(key) ? `[${JSON.stringify(key)}]` : `[property:${index}]`;
        const actualPresent = Object.hasOwn(actualValue, key);
        const expectedPresent = Object.hasOwn(expectedValue, key);
        if (!actualPresent || !expectedPresent) {
          record(location + segment, actualValue[key], expectedValue[key], actualPresent, expectedPresent);
        } else visit(actualValue[key], expectedValue[key], location + segment);
      });
      return;
    }
    record(location, actualValue, expectedValue);
  };
  visit(actual, expected, '$');
  return { phase, changedPathCount, paths, collections, pathsTruncated: changedPathCount > paths.length,
    traversalTruncated: truncatedSubtrees > 0 };
}

function requireDisposableOwner(harness) {
  const underRoot = (candidate) => {
    if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) return false;
    const relative = path.relative(harness.tempRoot, candidate);
    return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep)
      && !path.isAbsolute(relative);
  };
  if (!harness || harness.attachOnly !== false || harness.ownedBrowserIdentityVerified !== true
    || harness.browserExecution?.processOwnership !== 'owned' || harness.qaProfileDir
    || harness.loadInPlace || typeof harness.tempRoot !== 'string' || !path.isAbsolute(harness.tempRoot)
    || !underRoot(harness.userDataDir) || !underRoot(harness.extensionDir)
    || typeof harness.extensionId !== 'string' || !harness.extensionId
    || typeof harness.cdp?.send !== 'function' || typeof harness.cdp?.subscribe !== 'function'
    || ['openPage', 'navigatePage', 'closePage'].some((name) => typeof harness[name] !== 'function')) {
    throw new Error('QA_SECURITY_VAULT_DISPOSABLE_OWNER_REQUIRED');
  }
}

// A preparation tab proves the real Dashboard sender without executing or
// loading its app. Never seed storage, widen the product route, or log a key.
async function withSecurityVaultDashboard(harness, worker) {
  requireDisposableOwner(harness);
  const dashboardUrl = `chrome-extension://${harness.extensionId}/src/pages/dashboard.html`;
  const page = await harness.openPage('about:blank', { active: false, timeoutMs: FIXTURE_TIMEOUT_MS });
  const pendingInterceptions = new Set();
  let interceptionError = null;
  let assetsBlocked = 0;
  const unsubscribers = [];
  let interceptionEnabled = false;
  let networkEnabled = false;
  let scriptsDisabled = false;
  let operationError = null;
  let receipt = null;
  const track = (promise) => {
    const pending = promise.catch((error) => { interceptionError ||= error; });
    pendingInterceptions.add(pending);
    void pending.then(() => pendingInterceptions.delete(pending));
  };
  try {
    unsubscribers.push(harness.cdp.subscribe('Fetch.requestPaused', (event) => {
      if (event.sessionId !== page.sessionId) return;
      const { requestId, resourceType, request } = event.params;
      if (resourceType === 'Document' && request.url === dashboardUrl) {
        track(harness.cdp.send('Fetch.continueRequest', { requestId }, page.sessionId));
      } else {
        assetsBlocked += 1;
        track(harness.cdp.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, page.sessionId));
      }
    }));
    unsubscribers.push(harness.cdp.subscribe('Network.responseReceived', (event) => {
      if (event.sessionId === page.sessionId && event.params.type !== 'Document'
        && event.params.response?.status >= 200 && event.params.response.status < 400) {
        interceptionError ||= new Error('QA_SECURITY_VAULT_DASHBOARD_ASSET_LOADED');
      }
    }));
    await harness.cdp.send('Emulation.setScriptExecutionDisabled', { value: true }, page.sessionId);
    scriptsDisabled = true;
    await harness.cdp.send('Network.enable', {}, page.sessionId);
    networkEnabled = true;
    await harness.cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, page.sessionId);
    interceptionEnabled = true;
    await harness.navigatePage(page, dashboardUrl, { timeoutMs: FIXTURE_TIMEOUT_MS });

    const send = async (request) => {
      const delivery = await evaluate(harness.cdp, page.sessionId, `new Promise((resolve) => {
        if (location.href !== ${JSON.stringify(dashboardUrl)}) throw new Error('QA_SECURITY_VAULT_DASHBOARD_REQUIRED');
        if (document.getElementById('root')?.childElementCount !== 0)
          throw new Error('QA_SECURITY_VAULT_DASHBOARD_EXECUTED');
        chrome.runtime.sendMessage(${JSON.stringify(request)}, (response) => {
          resolve({ error: chrome.runtime.lastError?.message || null, response: response || null });
        });
      })`, { timeoutMs: FIXTURE_TIMEOUT_MS });
      if (interceptionError) throw interceptionError;
      const response = delivery?.response;
      if (delivery?.error || typeof response?.success !== 'boolean') {
        throw new Error('QA_SECURITY_VAULT_RESPONSE_INVALID');
      }
      return response;
    };
    const value = await worker(send);
    await Promise.all([...pendingInterceptions]);
    if (interceptionError) throw interceptionError;
    receipt = { value, protection: Object.freeze({
      dashboardApplicationExecuted: false, dashboardAssetsLoaded: 0, assetRequestsBlocked: assetsBlocked }) };
  } catch (error) {
    operationError = error;
  }

  const cleanupErrors = [];
  const attempt = async (task) => {
    try { await task(); return true; } catch (error) { cleanupErrors.push(error); return false; }
  };
  // Leave Dashboard before restoring scripts/interception: delayed page work
  // must never run during fixture cleanup and warm a measured cold sample.
  const leftDashboard = await attempt(() => harness.navigatePage(page, 'about:blank', { timeoutMs: FIXTURE_TIMEOUT_MS }));
  if (leftDashboard) {
    if (scriptsDisabled) await attempt(() => harness.cdp.send('Emulation.setScriptExecutionDisabled', { value: false }, page.sessionId));
    if (interceptionEnabled) await attempt(() => harness.cdp.send('Fetch.disable', {}, page.sessionId));
    if (networkEnabled) await attempt(() => harness.cdp.send('Network.disable', {}, page.sessionId));
  }
  await Promise.all([...pendingInterceptions]);
  if (interceptionError && interceptionError !== operationError) cleanupErrors.push(interceptionError);
  for (const unsubscribe of unsubscribers) await attempt(unsubscribe);
  await attempt(() => harness.closePage(page));
  if (cleanupErrors.length) {
    throw new AggregateError([...(operationError ? [operationError] : []), ...cleanupErrors], 'QA_SECURITY_VAULT_FIXTURE_CLEANUP_FAILED');
  }
  if (operationError) throw operationError;
  return receipt;
}

export function requireQaSecurityVaultStatus(response) {
  if (response?.success !== true) throw new Error('QA_SECURITY_VAULT_RESPONSE_INVALID');
  try { return requireSecurityVaultStatus(response.status); }
  catch { throw new Error('QA_SECURITY_VAULT_RESPONSE_INVALID'); }
}

export async function ensureQaSecurityVaultReady(harness, { passphrase } = {}) {
  const { value, protection } = await withSecurityVaultDashboard(harness, async (send) => {
    const status = requireQaSecurityVaultStatus(await send({ action: MESSAGE_ACTIONS.GET_SECURITY_VAULT_STATUS }));
    if (status.state === 'incompatible') throw new Error('QA_SECURITY_VAULT_INCOMPATIBLE');
    const operation = status.state === 'setup_required' ? 'setup' : status.state === 'locked' ? 'unlock' : 'already_unlocked';
    let ready = status;
    if (operation !== 'already_unlocked') {
      requireStrongPassphrase(passphrase).fill(0);
      const action = operation === 'setup' ? MESSAGE_ACTIONS.SETUP_SECURITY_VAULT : MESSAGE_ACTIONS.UNLOCK_SECURITY_VAULT;
      ready = requireQaSecurityVaultStatus(await send({ action, passphrase }));
      if (ready.state !== 'unlocked' || ready.mode !== 'passphrase') throw new Error('QA_SECURITY_VAULT_NOT_UNLOCKED');
    }
    return { ...ready, operation };
  });
  return Object.freeze({ ...value, ...protection });
}

const LOG_LOCK_STEP_ACTIONS = Object.freeze({
  enable: MESSAGE_ACTIONS.SETUP_SECURITY_VAULT,
  observe_locked: MESSAGE_ACTIONS.GET_SECURITY_VAULT_STATUS,
  unlock: MESSAGE_ACTIONS.UNLOCK_SECURITY_VAULT,
});
const LOG_LOCK_PUBLIC_FAILURE_CODES = new Set([
  'SECURITY_VAULT_UNAUTHORIZED_SENDER', 'SECURITY_VAULT_REQUEST_INVALID',
  'SECURITY_VAULT_LOCKED', 'SECURITY_VAULT_INCOMPATIBLE',
  'SECURITY_PASSPHRASE_INVALID', 'SECURITY_ENVELOPE_AUTHENTICATION_FAILED',
]);

// A closed operation creates and retires its own fenced Dashboard sender. No
// callback or pre-reload page can escape into the next extension generation.
export async function runQaSecurityVaultLogLockStep(harness, options) {
  const step = options?.step;
  if (!Object.hasOwn(LOG_LOCK_STEP_ACTIONS, step)
    || options === null || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => key !== 'step' && key !== 'passphrase')
    || (step === 'observe_locked' && Object.hasOwn(options, 'passphrase'))) {
    throw new Error('QA_SECURITY_VAULT_LOG_LOCK_STEP_INVALID');
  }
  const action = LOG_LOCK_STEP_ACTIONS[step];
  if (step !== 'observe_locked') requireStrongPassphrase(options.passphrase).fill(0);
  const fail = code => {
    const error = new Error('QA_SECURITY_VAULT_LOG_LOCK_STEP_FAILED');
    error.diagnostic = { step, action, code };
    throw error;
  };
  const { value, protection } = await withSecurityVaultDashboard(harness, async send => {
    const request = step === 'observe_locked' ? { action } : { action, passphrase: options.passphrase };
    const response = await send(request);
    if (response.success !== true) fail(LOG_LOCK_PUBLIC_FAILURE_CODES.has(response.error)
      ? response.error : 'QA_SECURITY_VAULT_OPERATION_FAILED');
    let status;
    try { status = requireQaSecurityVaultStatus(response); }
    catch { fail('QA_SECURITY_VAULT_RESPONSE_INVALID'); }
    if (status.state !== (step === 'observe_locked' ? 'locked' : 'unlocked')
      || status.mode !== 'passphrase' || status.lockScope !== 'logs' || status.protectionReady !== true) {
      fail('QA_SECURITY_VAULT_LOG_LOCK_STATE_INVALID');
    }
    return status;
  });
  return Object.freeze({ status: value, protection });
}

// This closed protocol exposes no arbitrary command, storage read or callback.
// Envelopes and decrypted comparisons remain private to this invocation.
export async function verifyQaSecurityVaultCredentials(harness, {
  currentPassphrase, newPassphrase, wrongPassphrase, backupPassphrase,
} = {}) {
  requireDisposableOwner(harness);
  const phrases = [currentPassphrase, newPassphrase, wrongPassphrase, backupPassphrase];
  for (const phrase of phrases) requireStrongPassphrase(phrase).fill(0);
  if (new Set(phrases).size !== phrases.length) throw new Error('QA_SECURITY_VAULT_DISTINCT_PHRASES_REQUIRED');
  if (typeof harness.reloadExtensionFromSource !== 'function') throw new Error('QA_SECURITY_VAULT_RELOAD_OWNER_REQUIRED');

  const expectState = async (send, expected) => {
    const status = requireQaSecurityVaultStatus(await send({ action: MESSAGE_ACTIONS.GET_SECURITY_VAULT_STATUS }));
    if (status.state !== expected) throw new Error(`QA_SECURITY_VAULT_STATE_MISMATCH:${expected}:${status.state}`);
    return status;
  };
  const readPortable = async (send) => integratedPortableState(requireIntegratedPortableSnapshot(
    await send({ action: MESSAGE_ACTIONS.EXPORT_STORAGE_SNAPSHOT, backupPassphrase }),
  ), backupPassphrase);
  const rejectAuthentication = async (send, request) => {
    const response = await send(request);
    if (response.success !== false || response.error !== 'SECURITY_ENVELOPE_AUTHENTICATION_FAILED'
      || Object.keys(response).length !== 2) throw new Error('QA_SECURITY_VAULT_AUTHENTICATION_REJECTION_REQUIRED');
  };
  const requirePreserved = (actual, expected, phase) => {
    if (!isDeepStrictEqual(actual, expected)) {
      const diagnostic = summarizePortableDifference(actual, expected, phase);
      throw new Error(`QA_SECURITY_VAULT_CREDENTIAL_MUTATED_DURABLE_STATE:${JSON.stringify(diagnostic)}`);
    }
  };
  let fixtureCloseStartedAt;
  let passphraseEnabledFromLocal = false;

  const verifyReloadState = async (actual, expected) => {
    const baselineLogs = expected.indexedDb.logs;
    const actualLogs = actual.indexedDb.logs;
    if (!Array.isArray(baselineLogs) || baselineLogs.length === 0 || !Array.isArray(actualLogs)) {
      throw new Error('QA_SECURITY_VAULT_NONEMPTY_ENCRYPTED_LOG_BASELINE_REQUIRED');
    }
    requirePreserved(actualLogs.slice(0, baselineLogs.length), baselineLogs, 'reload_log_prefix');
    requirePreserved({ ...actual, indexedDb: { ...actual.indexedDb, logs: baselineLogs } }, expected, 'reload_unlock');
    if (actualLogs.length !== baselineLogs.length + 1) {
      throw new Error(`QA_SECURITY_VAULT_LIFECYCLE_LOG_APPEND_COUNT_INVALID:${JSON.stringify({
        expectedCount: baselineLogs.length + 1, actualCount: actualLogs.length,
      })}`);
    }
    let key;
    try {
      key = await crypto.subtle.importKey('jwk', requireCanonicalLogCryptoJwk(actual.local.keyring.logCryptoJwk),
        { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    } catch {
      throw new Error('QA_SECURITY_VAULT_RELOAD_LOG_KEY_INVALID');
    }
    let previousId = 0;
    for (let index = 0; index < actualLogs.length; index += 1) {
      const record = actualLogs[index];
      if (!Number.isSafeInteger(record.id) || record.id <= previousId) {
        throw new Error('QA_SECURITY_VAULT_RELOAD_LOG_ID_ORDER_INVALID');
      }
      previousId = record.id;
      let plaintext;
      try {
        // Authenticate the preserved nonempty rows with the keyring obtained
        // after new-passphrase unlock, as well as the one new lifecycle row.
        plaintext = await decryptLogRecord(key, record);
      } catch {
        throw new Error('QA_SECURITY_VAULT_RELOAD_LOG_AUTHENTICATION_FAILED');
      }
      if (plaintext === null || typeof plaintext !== 'object' || Array.isArray(plaintext)
        || plaintext.timestamp !== record.timestamp) throw new Error('QA_SECURITY_VAULT_RELOAD_LOG_PAYLOAD_INVALID');
      if (index >= baselineLogs.length) requireFixtureTabCloseLog(plaintext, record,
        { startedAt: fixtureCloseStartedAt, completedAt: Date.now() });
    }
    return { nonLogDurableStateUnchanged: true, originalEncryptedLogsUnchanged: true,
      existingEncryptedLogsDecrypted: baselineLogs.length, appendedLifecycleLogsValidated: 1,
      lifecycleLogType: 'intelligence', lifecycleLogReason: 'tab_closed',
      emptyBrowsingIdentityVerified: true, fixtureNavigationMetricsValidated: true };
  };

  const beforeReload = await withSecurityVaultDashboard(harness, async (send) => {
    const initialStatus = await expectState(send, 'unlocked');
    const baseline = await readPortable(send);
    if (initialStatus.mode === 'local') {
      const enabled = requireQaSecurityVaultStatus(await send({ action: MESSAGE_ACTIONS.SETUP_SECURITY_VAULT,
        passphrase: currentPassphrase }));
      if (enabled.state !== 'unlocked' || enabled.mode !== 'passphrase') {
        throw new Error('QA_SECURITY_VAULT_PASSPHRASE_ENABLE_REQUIRED');
      }
      requirePreserved(await readPortable(send), baseline, 'enable_passphrase');
      passphraseEnabledFromLocal = true;
    }
    await rejectAuthentication(send, { action: MESSAGE_ACTIONS.UNLOCK_SECURITY_VAULT, passphrase: wrongPassphrase });
    await expectState(send, 'unlocked');
    requirePreserved(await readPortable(send), baseline, 'wrong_unlock');
    await rejectAuthentication(send, { action: MESSAGE_ACTIONS.CHANGE_SECURITY_VAULT_PASSPHRASE,
      currentPassphrase: wrongPassphrase, newPassphrase });
    await expectState(send, 'unlocked');
    requirePreserved(await readPortable(send), baseline, 'wrong_current_passphrase');
    const rotated = requireQaSecurityVaultStatus(await send({ action: MESSAGE_ACTIONS.CHANGE_SECURITY_VAULT_PASSPHRASE,
      currentPassphrase, newPassphrase }));
    if (rotated.state !== 'unlocked' || rotated.mode !== 'passphrase') throw new Error('QA_SECURITY_VAULT_ROTATION_NOT_UNLOCKED');
    requirePreserved(await readPortable(send), baseline, 'rotation');
    fixtureCloseStartedAt = Date.now();
    return baseline;
  });

  // Close the preparation context first. The canonical exact-id reload owner
  // retires the old worker and trusted context, then proves the active new worker.
  const reload = await harness.reloadExtensionFromSource();
  if (reload?.extensionId !== harness.extensionId || reload.installMode !== 'chrome_developer_private_reload'
    || typeof reload.previousWorkerId !== 'string' || !reload.previousWorkerId
    || typeof reload.workerId !== 'string' || !reload.workerId || reload.workerId === reload.previousWorkerId) {
    throw new Error('QA_SECURITY_VAULT_RELOAD_IDENTITY_INVALID');
  }
  const afterReload = await withSecurityVaultDashboard(harness, async (send) => {
    const locked = await expectState(send, 'locked');
    if (locked.lockScope !== 'logs' || locked.protectionReady !== true) {
      throw new Error('QA_SECURITY_VAULT_LOG_ONLY_LOCK_REQUIRED');
    }
    const settings = await send({ action: MESSAGE_ACTIONS.GET_SETTINGS,
      keys: ['blockedUrls', 'allowedUrls', 'siteGoals'], defaults: { blockedUrls: [], allowedUrls: [], siteGoals: {} } });
    if (settings.success !== true || !Array.isArray(settings.settings?.blockedUrls)
      || !Array.isArray(settings.settings?.allowedUrls) || settings.settings?.siteGoals === null
      || typeof settings.settings?.siteGoals !== 'object' || Array.isArray(settings.settings.siteGoals)) {
      throw new Error('QA_SECURITY_VAULT_LOCKED_SETTINGS_REQUIRED');
    }
    const rejectedExport = await send({ action: MESSAGE_ACTIONS.EXPORT_STORAGE_SNAPSHOT, backupPassphrase });
    if (rejectedExport.success !== false || rejectedExport.error !== 'SECURITY_VAULT_LOCKED'
      || Object.keys(rejectedExport).length !== 2) throw new Error('QA_SECURITY_VAULT_LOCKED_EXPORT_REJECTION_REQUIRED');
    await rejectAuthentication(send, { action: MESSAGE_ACTIONS.UNLOCK_SECURITY_VAULT, passphrase: currentPassphrase });
    await expectState(send, 'locked');
    const unlocked = requireQaSecurityVaultStatus(await send({ action: MESSAGE_ACTIONS.UNLOCK_SECURITY_VAULT, passphrase: newPassphrase }));
    if (unlocked.state !== 'unlocked' || unlocked.mode !== 'passphrase') throw new Error('QA_SECURITY_VAULT_NEW_PASSPHRASE_UNLOCK_REQUIRED');
    return verifyReloadState(await readPortable(send), beforeReload.value);
  });
  return Object.freeze({
    enable: { fromLocal: passphraseEnabledFromLocal, mode: 'passphrase', keyringUnchanged: true },
    wrongUnlock: { rejected: true, error: 'SECURITY_ENVELOPE_AUTHENTICATION_FAILED', durableStateUnchanged: true },
    wrongCurrentPassphrase: { rejected: true, error: 'SECURITY_ENVELOPE_AUTHENTICATION_FAILED', durableStateUnchanged: true },
    rotation: { unlocked: true, durableStateUnchanged: true, keyringUnchanged: true },
    reload: { ...reload, lockedBeforeUnlock: true, oldPassphraseRejected: true,
      lockScope: 'logs', protectionReady: true, settingsReadableWhileLocked: true, lockedExportRejected: true,
      newPassphraseUnlocked: true, keyringUnchanged: true, ...afterReload.value },
    preparation: { beforeReload: beforeReload.protection, afterReload: afterReload.protection },
  });
}
