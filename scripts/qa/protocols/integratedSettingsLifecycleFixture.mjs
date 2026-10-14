import { isDeepStrictEqual } from 'node:util';
import { encryptSecurityEnvelope, decryptSecurityEnvelope, requireEncryptedEnvelope,
  decodeBase64Url, ENCRYPTED_BACKUP_MAX_BYTES } from '../../../src/platform/security/vaultCryptography.js';
import path from 'node:path';
import { CONFIG_DEFAULT_FILTER_SETTINGS, normalizeFilterSettings } from '../../../src/domains/settings/config/index.js';
import { DEFAULT_ARTIFACT_CONTROL_STATE } from '../../../src/domains/settings/config/artifactControlState.js';
import { MEMORY_PURGE_SETTINGS_DEFAULTS } from '../../../src/domains/settings/config/siteRules.js';
import { STORAGE_LOCAL_DOC_KEYS } from '../../../src/platform/storage/settings/SettingsDocumentRepository.js';
import { requireSettingsStoredDocument } from '../../../src/platform/storage/settings/settingsStoredValueContract.js';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { requireModelStateProfileEpochId } from '../../../src/platform/storage/model/ProfileEpochContract.js';
import { normalizeProfileResetLifecycleState } from '../../../src/platform/storage/runtime/ProfileResetLifecycleRepository.js';
import {
  normalizeSettingsProfileRecovery, SETTINGS_PROFILE_RECOVERY_CONTRACT,
} from '../../../src/platform/storage/settings/SettingsProfileRecoveryContract.js';

export const INTEGRATED_FRESH_PROTOCOL_DEFAULTS = Object.freeze({
  blockedUrls: [], allowedUrls: [], globalGoal: 0, filteringMode: 'blocklist',
  rulesMode: 'managed', permissionMode: 'selective',
  ...MEMORY_PURGE_SETTINGS_DEFAULTS,
  artifactControlState: structuredClone(DEFAULT_ARTIFACT_CONTROL_STATE),
  filterSettings: normalizeFilterSettings(CONFIG_DEFAULT_FILTER_SETTINGS),
});

export function matchesIntegratedFreshProtocolDefaults(protocol) {
  return Boolean(protocol && Object.entries(INTEGRATED_FRESH_PROTOCOL_DEFAULTS)
    .every(([key, value]) => isDeepStrictEqual(protocol[key], value)));
}

const SNAPSHOT_OPTIONS = Object.freeze({ format: 'entropy-encrypted-storage-snapshot', maxBytes: ENCRYPTED_BACKUP_MAX_BYTES });

export function requireIntegratedPortableSnapshot(response) {
  try {
    if (response?.success !== true) throw new Error('SNAPSHOT_RESPONSE_FAILED');
    return requireEncryptedEnvelope(response.snapshot, SNAPSHOT_OPTIONS);
  } catch {
    throw new Error('QA_INTEGRATED_PORTABLE_SNAPSHOT_INVALID');
  }
}

export function summarizeIntegratedPortableSnapshot(snapshot) {
  requireIntegratedPortableSnapshot({ success: true, snapshot });
  return { format: snapshot.format, formatVersion: snapshot.version, encrypted: true,
    cipher: snapshot.cipher, kdfIterations: snapshot.kdf.iterations,
    ciphertextBytes: decodeBase64Url(snapshot.ciphertext, { maxBytes: ENCRYPTED_BACKUP_MAX_BYTES + 16, minBytes: 17 }).length };
}

async function readIntegratedSnapshotPayload(snapshot, backupPassphrase) {
  requireIntegratedPortableSnapshot({ success: true, snapshot });
  const payload = await decryptSecurityEnvelope(snapshot, backupPassphrase, SNAPSHOT_OPTIONS);
  if (payload?.format !== 'entropy-storage-payload' || payload.version !== 1
    || payload.schemaVersion !== 1 || !payload.local?.documents || !payload.local?.keyring
    || !payload.local?.stateEntries || !payload.indexedDb) {
    throw new Error('QA_INTEGRATED_SNAPSHOT_PAYLOAD_INVALID');
  }
  return payload;
}

export async function integratedPortableState(snapshot, backupPassphrase) {
  const payload = await readIntegratedSnapshotPayload(snapshot, backupPassphrase);
  const { meta: _exportMetadata, ...indexedDb } = payload.indexedDb;
  // Plaintext is private comparison input only; never attach this value to evidence.
  return { format: payload.format, version: payload.version, schemaVersion: payload.schemaVersion,
    local: payload.local, indexedDb };
}

export async function buildIntegratedMalformedImportSnapshot(snapshot, backupPassphrase) {
  const malformed = await readIntegratedSnapshotPayload(snapshot, backupPassphrase);
  requireSettingsStoredDocument(STORAGE_LOCAL_DOC_KEYS.CORE, malformed.local.documents[STORAGE_LOCAL_DOC_KEYS.CORE]);
  const filters = malformed.local.documents[STORAGE_LOCAL_DOC_KEYS.CORE]?.filterSettings;
  if (!filters?.ensoGate) throw new Error('QA_INTEGRATED_SNAPSHOT_FILTER_FIXTURE_REQUIRED');
  // Keep an authentic current envelope and change one decrypted physical value.
  filters.ensoGate.value = true;
  return encryptSecurityEnvelope(malformed, backupPassphrase, SNAPSHOT_OPTIONS);
}

export function requireIntegratedMalformedImportRejection(response) {
  // The snapshot mutation handler serializes Error.message, including the
  // exact invalid physical key; its custom onError does not project .code.
  if (response?.success !== false || response.error !== 'SETTINGS_STORED_VALUE_INVALID:filterSettings'
    || Reflect.ownKeys(response).length !== 2) {
    const error = new Error('QA_INTEGRATED_PROTECTION_MALFORMED_SNAPSHOT_REJECTION');
    error.diagnostic = { success: response?.success, error: response?.error };
    throw error;
  }
  return { success: false, error: response.error };
}

export const INTEGRATED_SETTINGS_CORRUPTION_KINDS = Object.freeze(['retired_enso_boolean', 'malformed_artifact_pause']);
const seededCorruptions = new WeakMap();

export function requireIntegratedCompletedProfileGeneration(journal, expectedOperation) {
  if (journal?.present !== true) throw new Error('QA_INTEGRATED_PROFILE_LIFECYCLE_REQUIRED');
  const state = normalizeProfileResetLifecycleState(journal.value);
  if (state.status !== 'complete' || state.operation !== expectedOperation) {
    throw new Error('QA_INTEGRATED_PROFILE_LIFECYCLE_NOT_COMPLETE');
  }
  return requireModelStateProfileEpochId(state.resetId);
}

export function requireIntegratedSettingsRecoveryResponse(response, seed, profileGeneration) {
  const generation = requireModelStateProfileEpochId(profileGeneration);
  if (response?.success !== false || response.error !== seed.expectedError
    || response.profileGeneration !== generation || Reflect.ownKeys(response).length !== 4) {
    const error = new Error('QA_INTEGRATED_SETTINGS_RECOVERY_RESPONSE_INVALID');
    error.diagnostic = { kind: seed.kind, error: response?.error, profileGeneration: response?.profileGeneration };
    throw error;
  }
  const recovery = normalizeSettingsProfileRecovery(response.settingsProfileRecovery);
  if (!isDeepStrictEqual(recovery, {
    contract: SETTINGS_PROFILE_RECOVERY_CONTRACT, kind: 'settings_contract_reset',
    failureCode: seed.expectedError, recoveryAction: 'full_reset', documentKey: seed.documentKey, key: seed.key,
  })) throw new Error('QA_INTEGRATED_SETTINGS_RECOVERY_FIXTURE_MISMATCH');
  return { success: false, error: response.error, profileGeneration: generation, settingsProfileRecovery: recovery };
}

export function buildIntegratedCorruptedSettingsDocument(kind, currentDocument) {
  if (!INTEGRATED_SETTINGS_CORRUPTION_KINDS.includes(kind)) throw new Error('QA_INTEGRATED_CORRUPTION_KIND_INVALID');
  requireSettingsStoredDocument(STORAGE_LOCAL_DOC_KEYS.CORE, currentDocument);
  const document = structuredClone(currentDocument);
  let key;
  if (kind === 'retired_enso_boolean') {
    key = 'filterSettings';
    document[key] = structuredClone(currentDocument[key] ?? INTEGRATED_FRESH_PROTOCOL_DEFAULTS.filterSettings);
    document[key].ensoGate.value = true;
  } else {
    key = 'artifactControlState';
    document[key] = structuredClone(currentDocument[key] ?? DEFAULT_ARTIFACT_CONTROL_STATE);
    document[key].globalPaused = 'broken';
  }
  return { kind, documentKey: STORAGE_LOCAL_DOC_KEYS.CORE, key, document,
    expectedError: 'SETTINGS_STORED_VALUE_INVALID' };
}

export function requireIntegratedDisposableFixtureOwner(harness) {
  const underRoot = candidate => typeof candidate === 'string' && path.isAbsolute(candidate)
    && !path.relative(harness.tempRoot, candidate).startsWith('..')
    && !path.isAbsolute(path.relative(harness.tempRoot, candidate));
  if (!harness || harness.attachOnly !== false || harness.ownedBrowserIdentityVerified !== true
    || harness.browserExecution?.processOwnership !== 'owned'
    || typeof harness.tempRoot !== 'string' || !path.isAbsolute(harness.tempRoot)
    || !underRoot(harness.userDataDir) || !underRoot(harness.extensionDir)
    || typeof harness.extensionId !== 'string' || !harness.extensionId) {
    throw new Error('QA_INTEGRATED_CORRUPTION_DISPOSABLE_OWNER_REQUIRED');
  }
}

export async function seedIntegratedSettingsCorruption(harness, kind) {
  requireIntegratedDisposableFixtureOwner(harness);
  const ownerCheck = `if (location.origin !== ${JSON.stringify(`chrome-extension://${harness.extensionId}`)}
    || location.pathname !== ${JSON.stringify(`/${ENTROPY_QA_TRUSTED_PAGE_PATH}`)})
      throw new Error('QA_INTEGRATED_CORRUPTION_TRUSTED_PAGE_REQUIRED');`;
  const current = await harness.evaluateInTrustedPage(`(async () => {
    ${ownerCheck}
    const items = await chrome.storage.local.get(${JSON.stringify(STORAGE_LOCAL_DOC_KEYS.CORE)});
    return Object.hasOwn(items, ${JSON.stringify(STORAGE_LOCAL_DOC_KEYS.CORE)})
      ? items[${JSON.stringify(STORAGE_LOCAL_DOC_KEYS.CORE)}] : {};
  })()`);
  const fixture = buildIntegratedCorruptedSettingsDocument(kind, current);
  const written = await harness.evaluateInTrustedPage(`(async () => {
    ${ownerCheck}
    const document = ${JSON.stringify(fixture.document)};
    await chrome.storage.local.set({ [${JSON.stringify(fixture.documentKey)}]: document });
    const items = await chrome.storage.local.get(${JSON.stringify(fixture.documentKey)});
    return JSON.stringify(items[${JSON.stringify(fixture.documentKey)}]) === JSON.stringify(document);
  })()`);
  if (written !== true) throw new Error('QA_INTEGRATED_CORRUPTION_WRITE_READBACK_FAILED');
  seededCorruptions.set(harness, fixture);
  // Deliberate invalid physical data is a closed, disposable QA fixture only.
  // Neither the original/candidate document nor values enter evidence output.
  return { kind, documentKey: fixture.documentKey, key: fixture.key,
    expectedError: fixture.expectedError, physicalReadbackMatched: true };
}

export async function verifyIntegratedSettingsCorruptionUnchanged(harness) {
  requireIntegratedDisposableFixtureOwner(harness);
  const fixture = seededCorruptions.get(harness);
  if (!fixture) throw new Error('QA_INTEGRATED_CORRUPTION_SEED_REQUIRED');
  const matches = await harness.evaluateInTrustedPage(`(async () => {
    if (location.origin !== ${JSON.stringify(`chrome-extension://${harness.extensionId}`)}
      || location.pathname !== ${JSON.stringify(`/${ENTROPY_QA_TRUSTED_PAGE_PATH}`)})
      throw new Error('QA_INTEGRATED_CORRUPTION_TRUSTED_PAGE_REQUIRED');
    const items = await chrome.storage.local.get(${JSON.stringify(fixture.documentKey)});
    return JSON.stringify(items[${JSON.stringify(fixture.documentKey)}]) === ${JSON.stringify(JSON.stringify(fixture.document))};
  })()`);
  if (matches !== true) throw new Error('QA_INTEGRATED_CORRUPTION_SILENTLY_REWRITTEN');
  return { unchanged: true, kind: fixture.kind, documentKey: fixture.documentKey, key: fixture.key };
}
