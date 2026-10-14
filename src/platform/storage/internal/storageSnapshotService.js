import { readChromeStorageLocal, removeChromeStorageLocal, writeChromeStorageLocal } from './chrome-storage/localArea.js';
import IndexedDbSnapshotRepository from './indexeddb/IndexedDbSnapshotRepository.js';
import EventLogStore from './indexeddb/stores/EventLogStore.js';
import { STORAGE_LOCAL_STATE_KEYS, SETTINGS_DOCUMENT_KEYS, STORAGE_LOCAL_DOC_KEYS } from './chrome-storage/storageKeyRegistry.js';
import { preflightIndexedDbV1ImportSnapshot } from './indexeddb/dbImportSnapshot.js';
import { EXPORT_STORE_TO_FIELD } from './indexeddb/dbConstants.js';
import SettingsStore from './chrome-storage/stores/SettingsStore.js';
import KeyMaterialRepository from '../security/KeyMaterialRepository.js';
import { requireCanonicalSecurityKeyring } from '../security/keyMaterialContract.js';
import { requireSettingsStoredDocument } from '../settings/settingsStoredValueContract.js';
import { isPlainObject } from './storageValueUtils.js';
import { normalizeProgressionState } from '../../../domains/progression/model/progressionSnapshot.js';
import { requireModelStateProfileEpochId } from '../model/ProfileEpochContract.js';
import { ZEN_THEME_MODEL_STATE_KEYS, requireZenThemeModelStateSnapshotValue } from '../themes/zen/ZenThemeModelStateContract.js';
import { decryptLogRecord } from '../../security/encryptedLogContract.js';
import { decryptSecurityEnvelope, encryptSecurityEnvelope, requireExactKeys,
  requireStrongPassphrase, securityError, ENCRYPTED_BACKUP_MAX_BYTES } from '../../security/vaultCryptography.js';

const SNAPSHOT_FORMAT = 'entropy-encrypted-storage-snapshot';
const PAYLOAD_FORMAT = 'entropy-storage-payload';
const STORAGE_SCHEMA_VERSION = 1;
const SNAPSHOT_DOCUMENT_KEYS = Object.freeze([...SETTINGS_DOCUMENT_KEYS, STORAGE_LOCAL_DOC_KEYS.META]);
const SNAPSHOT_STATE_KEYS = Object.freeze([STORAGE_LOCAL_STATE_KEYS.PROGRESSION_STATE]);
const SNAPSHOT_OPTIONS = Object.freeze({ format: SNAPSHOT_FORMAT, maxBytes: ENCRYPTED_BACKUP_MAX_BYTES });
const preparedImports = new WeakMap();

function defaultsFor(keys) {
  return Object.fromEntries(keys.map((key) => [key, null]));
}

function requireReplaceMode(mode) {
  if (mode !== 'replace') throw securityError('STORAGE_SNAPSHOT_IMPORT_MODE_INVALID');
}

function normalizeSnapshotDocuments(documents) {
  requireExactKeys(documents, SNAPSHOT_DOCUMENT_KEYS, 'STORAGE_SNAPSHOT_DOCUMENT_FIELDS_INVALID');
  return Object.fromEntries(SNAPSHOT_DOCUMENT_KEYS.map((key) => {
    const value = documents[key];
    if (key === STORAGE_LOCAL_DOC_KEYS.META) {
      requireExactKeys(value, ['version'], 'STORAGE_SNAPSHOT_STORAGE_SCHEMA_INVALID');
      if (value.version !== STORAGE_SCHEMA_VERSION) throw securityError('STORAGE_SNAPSHOT_STORAGE_SCHEMA_VERSION_UNSUPPORTED');
    } else if (value !== null) {
      requireSettingsStoredDocument(key, value);
    }
    return [key, structuredClone(value)];
  }));
}

function normalizeStateEntries(entries) {
  requireExactKeys(entries, SNAPSHOT_STATE_KEYS, 'STORAGE_SNAPSHOT_STATE_ENTRY_FIELDS_INVALID');
  const value = entries[STORAGE_LOCAL_STATE_KEYS.PROGRESSION_STATE];
  if (value !== null && !isPlainObject(value)) throw securityError('STORAGE_SNAPSHOT_STATE_ENTRY_INVALID');
  return { [STORAGE_LOCAL_STATE_KEYS.PROGRESSION_STATE]: value === null ? null : normalizeProgressionState(value) };
}

function normalizeSnapshotPayload(payload) {
  requireExactKeys(payload, ['format', 'version', 'exportedAt', 'schemaVersion', 'local', 'indexedDb'], 'STORAGE_SNAPSHOT_PAYLOAD_INVALID');
  if (payload.format !== PAYLOAD_FORMAT || payload.version !== 1 || payload.schemaVersion !== STORAGE_SCHEMA_VERSION) {
    throw securityError('STORAGE_SNAPSHOT_PAYLOAD_VERSION_UNSUPPORTED');
  }
  if (!Number.isSafeInteger(payload.exportedAt) || payload.exportedAt < 0) throw securityError('STORAGE_SNAPSHOT_EXPORTED_AT_INVALID');
  requireExactKeys(payload.local, ['documents', 'keyring', 'stateEntries'], 'STORAGE_SNAPSHOT_LOCAL_FIELDS_INVALID');
  return {
    format: PAYLOAD_FORMAT, version: 1, exportedAt: payload.exportedAt, schemaVersion: STORAGE_SCHEMA_VERSION,
    local: {
      documents: normalizeSnapshotDocuments(payload.local.documents),
      keyring: requireCanonicalSecurityKeyring(payload.local.keyring),
      stateEntries: normalizeStateEntries(payload.local.stateEntries),
    },
    indexedDb: preflightIndexedDbV1ImportSnapshot(payload.indexedDb),
  };
}

async function verifySnapshotLogs(payload) {
  const key = await crypto.subtle.importKey('jwk', payload.local.keyring.logCryptoJwk,
    { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  // Keep verification bounded in memory instead of scheduling every row at once.
  for (const record of payload.indexedDb.logs) await decryptLogRecord(key, record);
}

function snapshotSummary(payload) {
  return {
    format: SNAPSHOT_FORMAT, formatVersion: 1, encrypted: true, exportedAt: payload.exportedAt,
    documentCounts: Object.fromEntries(SNAPSHOT_DOCUMENT_KEYS.map((key) =>
      [key, isPlainObject(payload.local.documents[key]) ? Object.keys(payload.local.documents[key]).length : 0])),
    indexedDbCounts: Object.fromEntries(Object.values(EXPORT_STORE_TO_FIELD).map((key) => [key, payload.indexedDb[key].length])),
  };
}

export async function preflightStorageSnapshot(snapshot, {
  backupPassphrase, restorePassphrase, mode = 'replace',
} = {}) {
  requireReplaceMode(mode);
  // The backup always requires its own password. A destination password is an
  // explicit opt-in; omission restores the same keyring in local automatic mode.
  requireStrongPassphrase(backupPassphrase).fill(0);
  if (restorePassphrase !== undefined) requireStrongPassphrase(restorePassphrase).fill(0);
  const payload = normalizeSnapshotPayload(await decryptSecurityEnvelope(snapshot, backupPassphrase, SNAPSHOT_OPTIONS));
  await verifySnapshotLogs(payload);
  const keyMaterialRepository = KeyMaterialRepository.getInstance();
  const preparedVault = await keyMaterialRepository.prepareRestoredVault(payload.local.keyring, restorePassphrase);
  const prepared = Object.freeze(snapshotSummary(payload));
  preparedImports.set(prepared, { source: snapshot, payload, preparedVault });
  return prepared;
}

export async function exportStorageSnapshot({ backupPassphrase } = {}) {
  requireStrongPassphrase(backupPassphrase).fill(0);
  const keyMaterialRepository = KeyMaterialRepository.getInstance();
  const keyring = await keyMaterialRepository.requireUnlocked();
  const eventLogStore = EventLogStore.getInstance();
  if (typeof eventLogStore.forceFlush !== 'function') throw securityError('STORAGE_SNAPSHOT_EVENT_LOG_FORCE_FLUSH_REQUIRED');
  await eventLogStore.forceFlush();
  const [documents, meta, stateEntries, indexedDb] = await Promise.all([
    SettingsStore.getInstance().getDocuments(SETTINGS_DOCUMENT_KEYS),
    readChromeStorageLocal([STORAGE_LOCAL_DOC_KEYS.META]),
    readChromeStorageLocal(defaultsFor(SNAPSHOT_STATE_KEYS)),
    IndexedDbSnapshotRepository.getInstance().exportSnapshot(),
  ]);
  const payload = normalizeSnapshotPayload({
    format: PAYLOAD_FORMAT, version: 1, exportedAt: Date.now(), schemaVersion: STORAGE_SCHEMA_VERSION,
    local: {
      documents: {
        ...Object.fromEntries(SETTINGS_DOCUMENT_KEYS.map((key) => [key, Object.hasOwn(documents, key) ? documents[key] : null])),
        [STORAGE_LOCAL_DOC_KEYS.META]: Object.hasOwn(meta, STORAGE_LOCAL_DOC_KEYS.META)
          ? meta[STORAGE_LOCAL_DOC_KEYS.META] : { version: STORAGE_SCHEMA_VERSION },
      },
      keyring,
      stateEntries,
    },
    indexedDb,
  });
  await verifySnapshotLogs(payload);
  await keyMaterialRepository.requireUnlocked();
  return encryptSecurityEnvelope(payload, backupPassphrase, SNAPSHOT_OPTIONS);
}

export async function importStorageSnapshot(snapshot, {
  preparedImport, mode = 'replace', targetProfileEpoch = null, targetProfileAggregate = null,
} = {}) {
  requireReplaceMode(mode);
  const preparation = preparedImports.get(preparedImport);
  if (!preparation || preparation.source !== snapshot) throw securityError('STORAGE_SNAPSHOT_PREPARED_IMPORT_REQUIRED');
  const resolvedTargetProfileEpoch = requireModelStateProfileEpochId(targetProfileEpoch, 'STORAGE_SNAPSHOT_TARGET_PROFILE_EPOCH_REQUIRED');
  if (!isPlainObject(targetProfileAggregate) || targetProfileAggregate.profileEpoch !== resolvedTargetProfileEpoch) {
    throw securityError('STORAGE_SNAPSHOT_TARGET_PROFILE_AGGREGATE_INVALID');
  }
  try {
    requireZenThemeModelStateSnapshotValue(ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE, targetProfileAggregate);
  } catch (cause) {
    throw securityError('STORAGE_SNAPSHOT_TARGET_PROFILE_AGGREGATE_INVALID', cause);
  }
  preparedImports.delete(preparedImport);
  const { payload, preparedVault } = preparation;
  const documents = Object.fromEntries(SETTINGS_DOCUMENT_KEYS.map((key) => [key, payload.local.documents[key]]));
  const settingsResult = await SettingsStore.getInstance().writeDocuments(documents, { removeMissing: true });
  await writeChromeStorageLocal({ [STORAGE_LOCAL_DOC_KEYS.META]: payload.local.documents[STORAGE_LOCAL_DOC_KEYS.META] });
  const stateKeysWritten = [];
  const stateKeysRemoved = [];
  for (const key of SNAPSHOT_STATE_KEYS) {
    const value = payload.local.stateEntries[key];
    if (value === null) {
      await removeChromeStorageLocal([key]);
      stateKeysRemoved.push(key);
    } else {
      await writeChromeStorageLocal({ [key]: value });
      stateKeysWritten.push(key);
    }
  }
  const indexedDbResult = await IndexedDbSnapshotRepository.getInstance().importSnapshot(payload.indexedDb, {
    mode: 'replace', targetProfileEpoch: resolvedTargetProfileEpoch, targetProfileAggregate,
  });
  const vaultStatus = await KeyMaterialRepository.getInstance().installRestoredVault(preparedVault);
  return {
    mode: 'replace', encrypted: true, vaultState: vaultStatus.state, vaultMode: vaultStatus.mode,
    imported: { documentsWritten: [...settingsResult.written, STORAGE_LOCAL_DOC_KEYS.META],
      documentsRemoved: settingsResult.removed, stateKeysWritten, stateKeysRemoved, indexedDb: indexedDbResult },
    diagnostics: [],
  };
}

export function getStorageSnapshotFormat() {
  return { format: SNAPSHOT_FORMAT, formatVersion: 1, encrypted: true, maxBytes: ENCRYPTED_BACKUP_MAX_BYTES };
}
