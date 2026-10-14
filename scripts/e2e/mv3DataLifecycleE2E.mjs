#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { launchExtensionChromiumHarness } from './extensionChromiumHarness.mjs';
import { completeMv3ProfileMutationHandoff } from './mv3ProfileMutationHandoff.mjs';
import { ensureQaSecurityVaultReady, verifyQaSecurityVaultCredentials } from '../qa/protocols/securityVaultQaFixture.mjs';
import { requireIntegratedPortableSnapshot, summarizeIntegratedPortableSnapshot,
  integratedPortableState } from '../qa/protocols/integratedSettingsLifecycleFixture.mjs';
import { requireCanonicalSecurityKeyring } from '../../src/platform/storage/security/keyMaterialContract.js';
import { RECOMMENDED_LOCAL_ANALYSIS_PROFILE_PATCH } from '../../src/domains/settings/config/localAnalysisProfilePolicy.js';
import { PROFILE_RESET_LIFECYCLE_STORAGE_KEY } from '../../src/platform/storage/internal/chrome-storage/stores/ProfileResetLifecycleStore.js';
import { encryptSecurityEnvelope, decryptSecurityEnvelope, encodeBase64Url, decodeBase64Url,
  ENCRYPTED_BACKUP_MAX_BYTES } from '../../src/platform/security/vaultCryptography.js';
import {
  WORKER_RUNTIME_EVENT_MESSAGE_TYPE,
  WORKER_RUNTIME_EVENT_STORAGE_KEY,
  requireWorkerRuntimeEventGeneration,
} from '../../src/platform/storage/runtime/WorkerRuntimeEventRepository.js';
import {
  admitQaExtensionBrowserChildExecution,
} from '../qa/contracts/qaBrowserChildExecutionContract.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '../..');
const DEFAULT_DIST_DIR = 'dist-prod';
const DEFAULT_REPORT_DIR = '/tmp/entropy-mv3-data-lifecycle-e2e';
const DATABASE_NAME = 'EntropyDB';
const DATABASE_VERSION = 1;
const SEED_THEME = 'matrix';
const MUTATED_THEME = 'entropy';
const THEME_SETTING_KEY = 'app-theme';
const SNAPSHOT_OPTIONS = Object.freeze({ format: 'entropy-encrypted-storage-snapshot', maxBytes: ENCRYPTED_BACKUP_MAX_BYTES });

const MESSAGE_ACTIONS = Object.freeze({
  SET_SETTINGS: 'SET_SETTINGS',
  GET_SETTINGS: 'GET_SETTINGS',
  RESET_APP_DATA: 'RESET_APP_DATA',
  EXPORT_STORAGE_SNAPSHOT: 'EXPORT_STORAGE_SNAPSHOT',
  IMPORT_STORAGE_SNAPSHOT: 'IMPORT_STORAGE_SNAPSHOT',
  GET_STORAGE_INSPECTOR_SNAPSHOT: 'GET_STORAGE_INSPECTOR_SNAPSHOT',
});

const EXPECTED_INDEXED_DB_V1_SCHEMA = Object.freeze([
  {
    name: 'usage_logs',
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'timestamp', keyPath: 'timestamp', unique: false, multiEntry: false },
    ],
  },
  {
    name: 'stats_hourly',
    keyPath: 'bucketStartTs',
    autoIncrement: false,
    indexes: [
      { name: 'dateStr', keyPath: 'dateStr', unique: false, multiEntry: false },
      { name: 'dateHour', keyPath: ['dateStr', 'hour'], unique: true, multiEntry: false },
    ],
  },
  {
    name: 'stats_daily',
    keyPath: 'dateStr',
    autoIncrement: false,
    indexes: [
      { name: 'finalizedAt', keyPath: 'finalizedAt', unique: false, multiEntry: false },
    ],
  },
  {
    name: 'stats_feature_pack_daily',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'dateStr', keyPath: 'dateStr', unique: false, multiEntry: false },
      { name: 'domain', keyPath: 'domain', unique: false, multiEntry: false },
      { name: 'date_domain', keyPath: ['dateStr', 'domain'], unique: true, multiEntry: false },
      { name: 'generatedAt', keyPath: 'generatedAt', unique: false, multiEntry: false },
      { name: 'sourceStatsRevision', keyPath: 'sourceStatsRevision', unique: false, multiEntry: false },
    ],
  },
  {
    name: 'intervention_exposures',
    keyPath: 'exposureId',
    autoIncrement: false,
    indexes: [
      { name: 'dateStr', keyPath: 'dateStr', unique: false, multiEntry: false },
      { name: 'domain', keyPath: 'domain', unique: false, multiEntry: false },
      { name: 'shownAt', keyPath: 'shownAt', unique: false, multiEntry: false },
      { name: 'outcomeAt', keyPath: 'outcomeAt', unique: false, multiEntry: false },
      { name: 'artifact', keyPath: ['artifactFamily', 'artifactId'], unique: false, multiEntry: false },
      { name: 'date_domain', keyPath: ['dateStr', 'domain'], unique: false, multiEntry: false },
    ],
  },
  {
    name: 'intervention_effect_daily',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      { name: 'dateStr', keyPath: 'dateStr', unique: false, multiEntry: false },
      { name: 'domain', keyPath: 'domain', unique: false, multiEntry: false },
      { name: 'artifact', keyPath: ['artifactFamily', 'artifactId'], unique: false, multiEntry: false },
      { name: 'date_domain', keyPath: ['dateStr', 'domain'], unique: false, multiEntry: false },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false, multiEntry: false },
    ],
  },
  {
    name: 'favicons', keyPath: 'domain', autoIncrement: false, indexes: [],
  },
  {
    name: 'model_state', keyPath: 'key', autoIncrement: false, indexes: [],
  },
  {
    name: 'zen_artifacts',
    keyPath: 'id',
    autoIncrement: false,
    indexes: [
      {
        name: 'theme_artifact_record',
        keyPath: ['themeId', 'artifactType', 'recordType'],
        unique: false,
        multiEntry: false,
      },
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false, multiEntry: false },
    ],
  },
  {
    name: 'clse_buckets_60s',
    keyPath: 'ts_start',
    autoIncrement: false,
    indexes: [
      { name: 'ts_start', keyPath: 'ts_start', unique: true, multiEntry: false },
    ],
  },
  {
    name: 'clse_buckets_5min',
    keyPath: 'ts_start',
    autoIncrement: false,
    indexes: [
      { name: 'ts_start', keyPath: 'ts_start', unique: true, multiEntry: false },
    ],
  },
  {
    name: 'clse_loop_events',
    keyPath: 'ts',
    autoIncrement: false,
    indexes: [
      { name: 'ts', keyPath: 'ts', unique: false, multiEntry: false },
      { name: 'site_key', keyPath: 'site_key', unique: false, multiEntry: false },
    ],
  },
  {
    name: 'clse_baseline', keyPath: 'id', autoIncrement: false, indexes: [],
  },
  {
    name: 'clse_aggression_logs',
    keyPath: 'ts',
    autoIncrement: false,
    indexes: [
      { name: 'ts', keyPath: 'ts', unique: true, multiEntry: false },
      { name: 'bucket_ts', keyPath: 'bucket_ts', unique: false, multiEntry: false },
      { name: 'type', keyPath: 'type', unique: false, multiEntry: false },
    ],
  },
  {
    name: 'clse_daily_summaries',
    keyPath: 'dateStr',
    autoIncrement: false,
    indexes: [
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false, multiEntry: false },
    ],
  },
]);

const SEND_RUNTIME_MESSAGE_SOURCE = String(function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || 'RUNTIME_MESSAGE_FAILED'));
        return;
      }
      resolve(response);
    });
  });
});

const READ_WORKER_RUNTIME_EVENT_CACHE_SOURCE = String(function readWorkerRuntimeEventCache(storageKey) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([storageKey], (items) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || 'WORKER_RUNTIME_EVENT_CACHE_PHYSICAL_READ_FAILED'));
        return;
      }
      if (!items || typeof items !== 'object' || Array.isArray(items)) {
        reject(new Error('WORKER_RUNTIME_EVENT_CACHE_PHYSICAL_READ_INVALID'));
        return;
      }
      const present = Object.prototype.hasOwnProperty.call(items, storageKey);
      if (present && !Array.isArray(items[storageKey])) {
        reject(new Error('WORKER_RUNTIME_EVENT_CACHE_PHYSICAL_SHAPE_INVALID'));
        return;
      }
      resolve({ present, eventCount: present ? items[storageKey].length : 0 });
    });
  });
});

const READ_PERMISSIONS_SOURCE = String(function readPermissions() {
  return new Promise((resolve, reject) => {
    chrome.permissions.getAll((permissions) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || 'PERMISSIONS_READ_FAILED'));
        return;
      }
      resolve({
        permissions: Array.isArray(permissions?.permissions) ? permissions.permissions : [],
        origins: Array.isArray(permissions?.origins) ? permissions.origins : [],
      });
    });
  });
});

const READ_INDEXED_DB_SCHEMA_SOURCE = String(function readIndexedDbSchema(databaseName) {
  const normalizeKeyPath = (keyPath) => {
    if (keyPath === null || typeof keyPath === 'string') return keyPath;
    return Array.from(keyPath);
  };
  return new Promise((resolve) => {
    const request = indexedDB.open(databaseName);
    let upgradeAttempted = false;
    request.onupgradeneeded = () => {
      upgradeAttempted = true;
      request.transaction.abort();
    };
    request.onerror = () => {
      resolve({
        success: false,
        error: upgradeAttempted
          ? 'INDEXED_DB_NOT_PREEXISTING'
          : (request.error?.name || 'INDEXED_DB_OPEN_FAILED'),
      });
    };
    request.onsuccess = () => {
      const database = request.result;
      const storeNames = Array.from(database.objectStoreNames, String).sort();
      let transaction;
      try {
        transaction = database.transaction(storeNames, 'readonly');
      } catch (error) {
        database.close();
        resolve({ success: false, error: error?.message || 'INDEXED_DB_SCHEMA_READ_FAILED' });
        return;
      }
      const stores = storeNames.map((name) => {
        const store = transaction.objectStore(name);
        const indexes = Array.from(store.indexNames, String).sort().map((indexName) => {
          const index = store.index(indexName);
          return {
            name: index.name,
            keyPath: normalizeKeyPath(index.keyPath),
            unique: index.unique,
            multiEntry: index.multiEntry,
          };
        });
        return {
          name: store.name,
          keyPath: normalizeKeyPath(store.keyPath),
          autoIncrement: store.autoIncrement,
          indexes,
        };
      });
      transaction.oncomplete = () => {
        const result = {
          success: true,
          name: database.name,
          version: database.version,
          stores,
        };
        database.close();
        resolve(result);
      };
      transaction.onerror = () => {
        const error = transaction.error?.name || 'INDEXED_DB_SCHEMA_TRANSACTION_FAILED';
        database.close();
        resolve({ success: false, error });
      };
      transaction.onabort = transaction.onerror;
    };
  });
});

function parseArgs(argv) {
  const options = {
    distDir: DEFAULT_DIST_DIR,
    reportDir: DEFAULT_REPORT_DIR,
    headless: true,
    keepTemp: false,
  };
  for (const arg of argv) {
    if (arg === '--headless') {
      options.headless = true;
    } else if (arg === '--headed') {
      options.headless = false;
    } else if (arg === '--keep-temp') {
      options.keepTemp = true;
    } else if (arg.startsWith('--dist=')) {
      options.distDir = arg.slice('--dist='.length);
    } else if (arg.startsWith('--report-dir=')) {
      options.reportDir = arg.slice('--report-dir='.length);
    } else {
      throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
    }
  }
  return options;
}

function assertCondition(condition, code, details = null) {
  if (condition) return;
  const suffix = details === null ? '' : `:${JSON.stringify(details)}`;
  throw new Error(`${code}${suffix}`);
}

async function probePackagedPageEgress() {
  const blockedURI = 'https://egress.invalid/';
  const violations = new Map();
  const controller = new AbortController();
  const image = new Image();
  let finish;
  const observed = new Promise((resolve) => { finish = resolve; });
  const onViolation = (event) => {
    if (!['connect-src', 'img-src'].includes(event.effectiveDirective)
      || event.disposition !== 'enforce') return;
    let canonicalURI;
    try { canonicalURI = new URL(event.blockedURI).href; } catch { return; }
    if (canonicalURI !== blockedURI) return;
    violations.set(event.effectiveDirective, {
      effectiveDirective: event.effectiveDirective,
      blockedURI: canonicalURI,
      disposition: event.disposition,
    });
    if (violations.size === 2) finish(true);
  };
  document.addEventListener('securitypolicyviolation', onViolation);
  const timer = setTimeout(() => finish(false), 3_000);
  try {
    // A network error is insufficient: each request needs enforced CSP evidence.
    void fetch(blockedURI, { credentials: 'omit', cache: 'no-store', signal: controller.signal }).catch(() => {});
    image.src = blockedURI;
    if (!await observed) throw new Error('PACKAGED_PAGE_EGRESS_CSP_VIOLATION_MISSING');
    return { enforced: true, blockedRequests: ['connect-src', 'img-src'].map((directive) => violations.get(directive)) };
  } finally {
    clearTimeout(timer);
    controller.abort();
    image.removeAttribute('src');
    document.removeEventListener('securitypolicyviolation', onViolation);
  }
}

export async function verifyPackagedPageNoEgress(harness) {
  return harness.evaluateInTrustedPage(`(${probePackagedPageEgress.toString()})()`);
}

function sortedStrings(values) {
  return Array.from(values || [], String).sort();
}

function normalizeSchema(schema = []) {
  return [...schema]
    .map((store) => ({
      ...store,
      indexes: [...store.indexes].sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function sendRuntimeMessage(harness, message) {
  return harness.evaluateInTrustedPage(
    `(${SEND_RUNTIME_MESSAGE_SOURCE})(${JSON.stringify(message)})`,
  );
}

async function requireRuntimeSuccess(harness, message, errorCode) {
  const response = await sendRuntimeMessage(harness, message);
  assertCondition(response?.success === true, errorCode, {
    action: message.action,
    error: response?.error || null,
  });
  return response;
}

async function readSetting(harness, key) {
  const response = await requireRuntimeSuccess(harness, {
    action: MESSAGE_ACTIONS.GET_SETTINGS,
    defaults: {},
    keys: [key],
  }, 'GET_SETTINGS_FAILED');
  return response.settings?.[key];
}

async function writeSetting(harness, key, value) {
  const response = await requireRuntimeSuccess(harness, {
    action: MESSAGE_ACTIONS.SET_SETTINGS,
    items: { [key]: value },
  }, 'SET_SETTINGS_FAILED');
  assertCondition(response.committedItems?.[key] === value, 'SETTINGS_COMMIT_ACK_MISMATCH', {
    key,
    expected: value,
    actual: response.committedItems?.[key] ?? null,
  });
  return response;
}

async function readInspector(harness) {
  const response = await requireRuntimeSuccess(harness, {
    action: MESSAGE_ACTIONS.GET_STORAGE_INSPECTOR_SNAPSHOT,
  }, 'STORAGE_INSPECTOR_FAILED');
  assertCondition(response.snapshot && typeof response.snapshot === 'object', 'STORAGE_INSPECTOR_PAYLOAD_INVALID');
  return response.snapshot;
}

async function readWorkerRuntimeEventCachePresence(harness) {
  return harness.evaluateInTrustedPage(
    `(${READ_WORKER_RUNTIME_EVENT_CACHE_SOURCE})(${JSON.stringify(WORKER_RUNTIME_EVENT_STORAGE_KEY)})`,
  );
}

async function captureWorkerRuntimeEventGeneration(harness) {
  const response = await requireRuntimeSuccess(harness, {
    type: WORKER_RUNTIME_EVENT_MESSAGE_TYPE,
    operation: 'capture',
  }, 'WORKER_RUNTIME_EVENT_CACHE_CAPTURE_FAILED');
  assertCondition(
    response.type === WORKER_RUNTIME_EVENT_MESSAGE_TYPE && response.operation === 'capture',
    'WORKER_RUNTIME_EVENT_CACHE_CAPTURE_ACK_INVALID',
  );
  return requireWorkerRuntimeEventGeneration(response.profileGeneration);
}

async function seedWorkerRuntimeEventCache(harness, operation) {
  const profileGeneration = await captureWorkerRuntimeEventGeneration(harness);
  const events = [{ type: 'qa_data_lifecycle_cache_probe', operation }];
  const response = await requireRuntimeSuccess(harness, {
    type: WORKER_RUNTIME_EVENT_MESSAGE_TYPE,
    operation: 'set',
    profileGeneration,
    events,
  }, 'WORKER_RUNTIME_EVENT_CACHE_SEED_FAILED');
  assertCondition(
    response.type === WORKER_RUNTIME_EVENT_MESSAGE_TYPE
      && response.operation === 'set'
      && response.profileGeneration === profileGeneration
      && isDeepStrictEqual(response.events, events),
    'WORKER_RUNTIME_EVENT_CACHE_SEED_ACK_INVALID',
  );
  const physical = await readWorkerRuntimeEventCachePresence(harness);
  assertCondition(physical?.present === true && physical.eventCount >= 1, 'WORKER_RUNTIME_EVENT_CACHE_SEED_NOT_PERSISTED');
  return { profileGeneration, eventCount: physical.eventCount };
}

async function verifyWorkerRuntimeEventCacheReplacement(harness, seed) {
  const physical = await readWorkerRuntimeEventCachePresence(harness);
  assertCondition(physical?.present === false, 'WORKER_RUNTIME_EVENT_CACHE_SURVIVED_PROFILE_REPLACEMENT');
  const currentGeneration = await captureWorkerRuntimeEventGeneration(harness);
  assertCondition(currentGeneration !== seed.profileGeneration, 'WORKER_RUNTIME_EVENT_CACHE_GENERATION_NOT_REPLACED');
  const staleResponse = await sendRuntimeMessage(harness, {
    type: WORKER_RUNTIME_EVENT_MESSAGE_TYPE,
    operation: 'set',
    profileGeneration: seed.profileGeneration,
    events: [{ type: 'qa_data_lifecycle_stale_cache_probe' }],
  });
  assertCondition(
    staleResponse?.success === false
      && staleResponse.error === 'WORKER_RUNTIME_EVENTS_PROFILE_GENERATION_STALE',
    'WORKER_RUNTIME_EVENT_CACHE_STALE_WRITE_NOT_REJECTED',
    { error: staleResponse?.error || null },
  );
  const afterStaleWrite = await readWorkerRuntimeEventCachePresence(harness);
  assertCondition(afterStaleWrite?.present === false, 'WORKER_RUNTIME_EVENT_CACHE_STALE_WRITE_RECREATED_CACHE');
  return {
    seededEventCount: seed.eventCount,
    physicalPresentBeforeReplacement: true,
    physicalAbsentAfterReplacement: true,
    generationChanged: true,
    staleWriteRejected: true,
    staleWriteError: staleResponse.error,
  };
}

async function exportEncryptedSnapshot(harness, backupPassphrase) {
  return requireIntegratedPortableSnapshot(await requireRuntimeSuccess(harness, {
    action: MESSAGE_ACTIONS.EXPORT_STORAGE_SNAPSHOT,
    backupPassphrase,
  }, 'STORAGE_SNAPSHOT_EXPORT_FAILED'));
}

function summarizeKeyringContracts(keyring) {
  requireCanonicalSecurityKeyring(keyring);
  return { version: keyring.version, keyCount: 3,
    logCryptoJwk: { present: true, algorithm: 'A256GCM', contractValid: true },
    domainHmacSecret: { present: true, contractValid: true },
    clseHmacJwk: { present: true, algorithm: 'HS256', contractValid: true } };
}

async function readLifecycleJournal(harness) {
  return harness.evaluateInTrustedPage(`chrome.storage.local.get(${JSON.stringify(PROFILE_RESET_LIFECYCLE_STORAGE_KEY)})
    .then(items => ({ present: Object.hasOwn(items, ${JSON.stringify(PROFILE_RESET_LIFECYCLE_STORAGE_KEY)}),
      value: items[${JSON.stringify(PROFILE_RESET_LIFECYCLE_STORAGE_KEY)}] ?? null }))`);
}

async function captureImportPreflightState(harness, backupPassphrase) {
  return {
    durableState: await integratedPortableState(await exportEncryptedSnapshot(harness, backupPassphrase), backupPassphrase),
    generation: await captureWorkerRuntimeEventGeneration(harness),
    journal: await readLifecycleJournal(harness),
  };
}

function summarizeInspector(snapshot) {
  const documents = Array.isArray(snapshot?.local?.documents) ? snapshot.local.documents : [];
  const keyEntries = Array.isArray(snapshot?.local?.keyEntries) ? snapshot.local.keyEntries : [];
  const sessionEntries = Array.isArray(snapshot?.session?.entries) ? snapshot.session.entries : [];
  const stores = Array.isArray(snapshot?.indexedDb?.stores) ? snapshot.indexedDb.stores : [];
  return {
    localDocuments: documents.map((entry) => ({
      storageKey: entry.storageKey,
      present: entry.present === true,
      fieldCount: Number(entry.fieldCount) || 0,
    })),
    presentKeyMaterialCount: keyEntries.filter((entry) => entry?.present === true).length,
    presentSessionEntryCount: sessionEntries.filter((entry) => entry?.present === true).length,
    indexedDbStoreCounts: stores.map((entry) => ({
      storeName: entry.storeName,
      count: Number(entry.count) || 0,
    })),
  };
}

function collectDifferencePaths(left, right, pathPrefix = '', output = []) {
  if (output.length >= 40 || isDeepStrictEqual(left, right)) return output;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      output.push(pathPrefix || '<root>');
      return output;
    }
    if (left.length !== right.length) {
      output.push(`${pathPrefix}.length`);
    }
    const sharedLength = Math.min(left.length, right.length);
    for (let index = 0; index < sharedLength && output.length < 40; index += 1) {
      collectDifferencePaths(left[index], right[index], `${pathPrefix}[${index}]`, output);
    }
    return output;
  }
  const leftIsObject = left !== null && typeof left === 'object';
  const rightIsObject = right !== null && typeof right === 'object';
  if (!leftIsObject || !rightIsObject) {
    output.push(pathPrefix || '<root>');
    return output;
  }
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  for (const key of keys) {
    if (output.length >= 40) break;
    const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (
      !Object.prototype.hasOwnProperty.call(left, key)
      || !Object.prototype.hasOwnProperty.call(right, key)
    ) {
      output.push(nextPath);
      continue;
    }
    collectDifferencePaths(left[key], right[key], nextPath, output);
  }
  return output;
}

async function assertBasePermissionProfile(harness) {
  const manifestPermissions = sortedStrings(harness.manifest?.permissions);
  const manifestHostPermissions = sortedStrings(harness.manifest?.host_permissions);
  assertCondition(!manifestPermissions.includes('scripting'), 'BASE_MANIFEST_SCRIPTING_PERMISSION_ELEVATED');
  assertCondition(manifestHostPermissions.length === 0, 'BASE_MANIFEST_HOST_PERMISSION_ELEVATED', {
    hostPermissionCount: manifestHostPermissions.length,
  });

  const granted = await harness.evaluateInTrustedPage(`(${READ_PERMISSIONS_SOURCE})()`);
  const grantedPermissions = sortedStrings(granted?.permissions);
  const grantedOrigins = sortedStrings(granted?.origins);
  assertCondition(
    isDeepStrictEqual(grantedPermissions, manifestPermissions),
    'FRESH_PROFILE_OPTIONAL_PERMISSION_ALREADY_GRANTED',
    { manifestPermissions, grantedPermissions },
  );
  assertCondition(
    isDeepStrictEqual(grantedOrigins, manifestHostPermissions),
    'FRESH_PROFILE_OPTIONAL_HOST_ALREADY_GRANTED',
    { manifestOriginCount: manifestHostPermissions.length, grantedOriginCount: grantedOrigins.length },
  );
  return {
    permissions: grantedPermissions,
    originCount: grantedOrigins.length,
    scriptingGranted: grantedPermissions.includes('scripting'),
  };
}

async function readAndAssertIndexedDbV1Schema(harness) {
  const result = await harness.evaluateInTrustedPage(
    `(${READ_INDEXED_DB_SCHEMA_SOURCE})(${JSON.stringify(DATABASE_NAME)})`,
  );
  assertCondition(result?.success === true, 'INDEXED_DB_SCHEMA_READ_FAILED', {
    error: result?.error || null,
  });
  assertCondition(result.name === DATABASE_NAME, 'INDEXED_DB_NAME_MISMATCH', {
    expected: DATABASE_NAME,
    actual: result.name,
  });
  assertCondition(result.version === DATABASE_VERSION, 'INDEXED_DB_VERSION_MISMATCH', {
    expected: DATABASE_VERSION,
    actual: result.version,
  });
  const actualSchema = normalizeSchema(result.stores);
  const expectedSchema = normalizeSchema(EXPECTED_INDEXED_DB_V1_SCHEMA);
  assertCondition(
    isDeepStrictEqual(actualSchema, expectedSchema),
    'INDEXED_DB_V1_SCHEMA_MISMATCH',
    {
      expectedStores: expectedSchema.map((store) => store.name),
      actualStores: actualSchema.map((store) => store.name),
    },
  );
  return {
    name: result.name,
    version: result.version,
    stores: actualSchema.map((store) => ({
      name: store.name,
      indexes: store.indexes.map((index) => index.name),
    })),
  };
}

async function withFreshHarness(options, label, worker) {
  console.log(`[mv3-data-lifecycle] START ${label}`);
  const harness = await launchExtensionChromiumHarness({
    chromePath: options.chromePath,
    distDir: options.distDir,
    rootDir,
    headless: options.headless,
    browserExecution: options.browserExecution,
    audioPolicy: options.audioPolicy,
    renderingRequirement: options.renderingRequirement,
    keepTemp: options.keepTemp,
    tempPrefix: `entropy-mv3-data-${label}-`,
  });
  try {
    const reloadSetup = await harness.prepareDisposableExtensionReload();
    const vaultPassphrase = randomBytes(32).toString('base64url');
    const backupPassphrase = randomBytes(32).toString('base64url');
    const vaultSetup = await ensureQaSecurityVaultReady(harness);
    assertCondition(vaultSetup.operation === 'already_unlocked' && vaultSetup.mode === 'local',
      'FRESH_PROFILE_LOCAL_AUTOMATIC_VAULT_REQUIRED');
    const result = await worker(harness, { vaultPassphrase, backupPassphrase, vaultSetup });
    console.log(`[mv3-data-lifecycle] PASS ${label}`);
    return {
      result: { ...result, reloadSetup },
      browser: harness.browserVersion?.Browser || null,
    };
  } catch (error) {
    const extensionDiagnostics = await harness.readExtensionReloadDiagnostics().then(
      (result) => ({ status: 'available', ...result }),
      (diagnosticError) => ({ status: 'unavailable', error: diagnosticError.message }),
    );
    console.error(`[mv3-data-lifecycle] browser failure ${JSON.stringify({
      installMode: harness.extensionInstallMode, extensionDiagnostics,
      chromiumErrors: harness.chromeStderr.slice(-8).map((line) => line.slice(0, 500)),
    })}`);
    throw error;
  } finally {
    await harness.close();
  }
}

async function runFreshInstallScenario(options) {
  return withFreshHarness(options, 'fresh-install', async (harness, { backupPassphrase, vaultSetup }) => {
    const permissions = await assertBasePermissionProfile(harness);
    const noEgress = await verifyPackagedPageNoEgress(harness);
    const inspector = await readInspector(harness);
    const schema = await readAndAssertIndexedDbV1Schema(harness);
    const snapshot = await exportEncryptedSnapshot(harness, backupPassphrase);
    return { extensionId: harness.extensionId, permissions, schema, vaultSetup, noEgress,
      inspector: summarizeInspector(inspector), encryptedExport: summarizeIntegratedPortableSnapshot(snapshot) };
  });
}

export async function runEncryptedKeyringExportScenario(options) {
  return withFreshHarness(options, 'encrypted-keyring-export', async (harness, { vaultPassphrase, backupPassphrase, vaultSetup }) => {
    const permissions = await assertBasePermissionProfile(harness);
    await readInspector(harness);
    // This fixture deliberately needs existing encrypted records. Fresh user
    // defaults stay recording-free; opt in through the canonical compound command.
    const recordingPolicy = { ...RECOMMENDED_LOCAL_ANALYSIS_PROFILE_PATCH,
      precisionInsightsSignals: { clse: true, navigation: true } };
    const committed = await requireRuntimeSuccess(harness, { action: MESSAGE_ACTIONS.SET_SETTINGS,
      items: recordingPolicy, waitForPropagation: true }, 'CREDENTIAL_RECORDING_OPT_IN_FAILED');
    assertCondition(Object.keys(recordingPolicy).every(key => isDeepStrictEqual(committed.committedItems?.[key], recordingPolicy[key]))
      && committed.propagation?.status === 'succeeded', 'CREDENTIAL_RECORDING_OPT_IN_ACK_REQUIRED');
    const readback = await requireRuntimeSuccess(harness, { action: MESSAGE_ACTIONS.GET_SETTINGS,
      keys: Object.keys(recordingPolicy) }, 'CREDENTIAL_RECORDING_OPT_IN_READ_FAILED');
    assertCondition(Object.keys(recordingPolicy).every(key => isDeepStrictEqual(readback.settings?.[key], recordingPolicy[key])),
      'CREDENTIAL_RECORDING_OPT_IN_READBACK_REQUIRED');
    const credentials = await verifyQaSecurityVaultCredentials(harness, {
      currentPassphrase: vaultPassphrase, newPassphrase: randomBytes(32).toString('base64url'),
      wrongPassphrase: randomBytes(32).toString('base64url'), backupPassphrase,
    });
    const snapshot = await exportEncryptedSnapshot(harness, backupPassphrase);
    const state = await integratedPortableState(snapshot, backupPassphrase);
    return { permissions, vaultSetup, recordingFixture: { explicitOptIn: true, policy: recordingPolicy },
      credentials, encryptedExport: summarizeIntegratedPortableSnapshot(snapshot),
      keyContracts: summarizeKeyringContracts(state.local.keyring) };
  });
}

export async function runRoundTripScenario(options) {
  return withFreshHarness(options, 'round-trip', async (harness, { vaultPassphrase, backupPassphrase, vaultSetup }) => {
    const permissions = await assertBasePermissionProfile(harness);
    await readInspector(harness);
    await writeSetting(harness, THEME_SETTING_KEY, SEED_THEME);
    const seededTheme = await readSetting(harness, THEME_SETTING_KEY);
    assertCondition(seededTheme === SEED_THEME, 'CANONICAL_SEED_READBACK_MISMATCH');

    const snapshot = await exportEncryptedSnapshot(harness, backupPassphrase);
    const before = await captureImportPreflightState(harness, backupPassphrase);
    const malformedPayload = await decryptSecurityEnvelope(snapshot, backupPassphrase, SNAPSHOT_OPTIONS);
    malformedPayload.version = 999;
    const malformedSnapshot = await encryptSecurityEnvelope(malformedPayload, backupPassphrase, SNAPSHOT_OPTIONS);
    const ciphertext = decodeBase64Url(snapshot.ciphertext, { maxBytes: ENCRYPTED_BACKUP_MAX_BYTES + 16, minBytes: 17 });
    ciphertext[0] ^= 1;
    const tamperedSnapshot = { ...snapshot, ciphertext: encodeBase64Url(ciphertext) };
    ciphertext.fill(0);
    const rejections = {};
    const cases = [
      { name: 'malformedImport', snapshot: malformedSnapshot, expected: 'STORAGE_SNAPSHOT_PAYLOAD_VERSION_UNSUPPORTED' },
      { name: 'wrongPassphrase', backupPassphrase: randomBytes(32).toString('base64url'), expected: 'SECURITY_ENVELOPE_AUTHENTICATION_FAILED' },
      { name: 'tamperedCiphertext', snapshot: tamperedSnapshot, expected: 'SECURITY_ENVELOPE_AUTHENTICATION_FAILED' },
      { name: 'invalidMode', mode: 'upgrade', expected: 'STORAGE_SNAPSHOT_IMPORT_MODE_INVALID' },
    ];
    for (const testCase of cases) {
      const response = await sendRuntimeMessage(harness, {
        action: MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT,
        snapshot: testCase.snapshot ?? snapshot,
        backupPassphrase: testCase.backupPassphrase ?? backupPassphrase,
        restorePassphrase: vaultPassphrase,
        mode: testCase.mode ?? 'replace',
      });
      assertCondition(response?.success === false && response.error === testCase.expected,
        'SNAPSHOT_PREFLIGHT_REJECTION_MISMATCH', { case: testCase.name, error: response?.error || null });
      assertCondition(await readSetting(harness, THEME_SETTING_KEY) === SEED_THEME,
        'SNAPSHOT_PREFLIGHT_MUTATED_CANONICAL_SETTING', { case: testCase.name });
      const after = await captureImportPreflightState(harness, backupPassphrase);
      assertCondition(isDeepStrictEqual(after, before), 'SNAPSHOT_PREFLIGHT_MUTATED_PROFILE', {
        case: testCase.name, differencePaths: collectDifferencePaths(before, after),
      });
      rejections[testCase.name] = { rejected: true, error: response.error,
        durableStateUnchanged: true, canonicalSettingUnchanged: true, generationUnchanged: true, journalUnchanged: true };
    }

    await writeSetting(harness, THEME_SETTING_KEY, MUTATED_THEME);
    assertCondition(await readSetting(harness, THEME_SETTING_KEY) === MUTATED_THEME, 'CANONICAL_MUTATION_READBACK_MISMATCH');
    // This discardable diagnostic cache is deliberately outside the backup.
    const cacheBeforeReset = await seedWorkerRuntimeEventCache(harness, 'full_reset');
    const resetResponse = await requireRuntimeSuccess(harness, { action: MESSAGE_ACTIONS.RESET_APP_DATA }, 'RESET_APP_DATA_FAILED');
    assertCondition(!Array.isArray(resetResponse.warnings) || resetResponse.warnings.length === 0, 'RESET_APP_DATA_WARNINGS');
    let resetVault;
    const { value: themeAfterReset, ...resetHandoff } = await completeMv3ProfileMutationHandoff(harness, resetResponse, {
      wakeRuntime: async () => {
        resetVault = await ensureQaSecurityVaultReady(harness);
        assertCondition(resetVault.operation === 'already_unlocked' && resetVault.mode === 'local',
          'RESET_LOCAL_AUTOMATIC_VAULT_REQUIRED');
        return readSetting(harness, THEME_SETTING_KEY);
      },
    });
    assertCondition(themeAfterReset !== SEED_THEME && themeAfterReset !== MUTATED_THEME, 'RESET_APP_DATA_RETAINED_MUTATED_SETTING');
    const resetCacheEvidence = await verifyWorkerRuntimeEventCacheReplacement(harness, cacheBeforeReset);

    const cacheBeforeImport = await seedWorkerRuntimeEventCache(harness, 'snapshot_import');
    const importResponse = await requireRuntimeSuccess(harness, {
      action: MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT, snapshot, mode: 'replace',
      backupPassphrase, restorePassphrase: vaultPassphrase,
    }, 'STORAGE_SNAPSHOT_REPLACE_IMPORT_FAILED');
    assertCondition(importResponse.result?.mode === 'replace' && importResponse.result.encrypted === true
      && importResponse.result.vaultState === 'locked' && importResponse.result.vaultMode === 'passphrase',
    'STORAGE_SNAPSHOT_IMPORT_RESULT_INVALID');
    let importVault;
    const { value: restoredTheme, ...importHandoff } = await completeMv3ProfileMutationHandoff(harness, importResponse, {
      wakeRuntime: async () => {
        importVault = await ensureQaSecurityVaultReady(harness, { passphrase: vaultPassphrase });
        assertCondition(importVault.operation === 'unlock' && importVault.mode === 'passphrase',
          'IMPORT_VAULT_LOCKED_RESUME_REQUIRED');
        return readSetting(harness, THEME_SETTING_KEY);
      },
    });
    assertCondition(restoredTheme === SEED_THEME, 'REPLACE_IMPORT_RESTORE_MISMATCH');
    const importCacheEvidence = await verifyWorkerRuntimeEventCacheReplacement(harness, cacheBeforeImport);

    const stoppedWorker = await harness.stopServiceWorker();
    const revivalVault = await ensureQaSecurityVaultReady(harness, { passphrase: vaultPassphrase });
    assertCondition(revivalVault.operation === 'already_unlocked', 'WORKER_REVIVAL_VAULT_SESSION_NOT_PRESERVED');
    const revivedTheme = await readSetting(harness, THEME_SETTING_KEY);
    const revivedWorker = await harness.waitForServiceWorker({ previousTargetId: stoppedWorker.targetId });
    assertCondition(revivedTheme === SEED_THEME, 'WORKER_REVIVAL_RESTORE_MISMATCH');
    const restoredState = await integratedPortableState(await exportEncryptedSnapshot(harness, backupPassphrase), backupPassphrase);
    assertCondition(isDeepStrictEqual(restoredState.local.keyring, before.durableState.local.keyring), 'REPLACE_IMPORT_KEYRING_RESTORE_MISMATCH');

    return { extensionId: harness.extensionId, permissions, vaultSetup,
      seed: { key: THEME_SETTING_KEY, value: seededTheme }, ...rejections,
      reset: { success: true, handoff: resetHandoff, vault: resetVault,
        themeAfterReset: themeAfterReset ?? null, workerRuntimeEventCache: resetCacheEvidence },
      replaceImport: { mode: importResponse.result.mode, handoff: importHandoff, vault: importVault,
        restoredTheme, keyringRestored: true, workerRuntimeEventCache: importCacheEvidence },
      workerRevival: { stoppedTargetId: stoppedWorker.targetId, revivedTargetId: revivedWorker.targetId,
        vault: revivalVault, restoredTheme: revivedTheme },
      encryptedExport: summarizeIntegratedPortableSnapshot(snapshot) };
  });
}

async function writeReport(report, reportDir) {
  const resolvedReportDir = path.resolve(rootDir, reportDir);
  await fs.mkdir(resolvedReportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(resolvedReportDir, `mv3-data-lifecycle-${stamp}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

async function main() {
  const admittedOptions = admitQaExtensionBrowserChildExecution(
    parseArgs(process.argv.slice(2)),
  );
  const options = {
    ...admittedOptions,
    chromePath: process.env.CHROME_BIN || chromium.executablePath(),
  };
  const freshInstall = await runFreshInstallScenario(options);
  const encryptedKeyringExport = await runEncryptedKeyringExportScenario(options);
  const roundTrip = await runRoundTripScenario(options);
  const report = {
    schemaVersion: 1,
    passed: true,
    generatedAt: new Date().toISOString(),
    distDir: path.relative(rootDir, path.resolve(rootDir, options.distDir)),
    browser: freshInstall.browser || encryptedKeyringExport.browser || roundTrip.browser,
    scenarios: {
      freshInstall: freshInstall.result,
      encryptedKeyringExport: encryptedKeyringExport.result,
      roundTrip: roundTrip.result,
    },
  };
  const reportPath = await writeReport(report, options.reportDir);
  console.log(`[mv3-data-lifecycle] report=${reportPath}`);
  console.log('[mv3-data-lifecycle] PASS all');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[mv3-data-lifecycle] FAIL ${error?.stack || error}`);
    process.exitCode = 1;
  });
}
