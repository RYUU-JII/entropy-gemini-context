import DBManager from '../dbManager.js';
import { STORES } from '../dbConstants.js';
import {
  MODEL_STATE_PROFILE_EPOCH_ROW_KEY,
  normalizeModelStateProfileEpoch,
  requireModelStateProfileEpochId,
} from '../../../model/ProfileEpochContract.js';

export const ZEN_ARTIFACT_THEME_ID = 'zen';
export const ZEN_ARTIFACT_SCHEMA_VERSION = 1;
export const ZEN_ARTIFACT_RECORD_TYPE = Object.freeze({
  ARTIFACT: 'artifact',
  META: 'meta',
});
export const ZEN_ARTIFACT_TYPE = Object.freeze({
  BONSAI: 'bonsai',
});

const DEFAULT_META_UPDATED_AT = 0;
const ZEN_ARTIFACT_RECORD_KEYS = Object.freeze([
  'id',
  'recordType',
  'themeId',
  'artifactType',
  'label',
  'seed',
  'latent',
  'structureMode',
  'structureDepth',
  'score',
  'phenotypeSummary',
  'source',
  'treeType',
  'createdAt',
  'updatedAt',
  'schemaVersion',
]);
const ZEN_ARTIFACT_META_RECORD_KEYS = Object.freeze([
  'id',
  'recordType',
  'themeId',
  'artifactType',
  'mainEntryId',
  'updatedAt',
  'schemaVersion',
]);
const ZEN_ARTIFACT_COMMAND_KEYS = Object.freeze(
  ZEN_ARTIFACT_RECORD_KEYS.filter((key) => key !== 'recordType'),
);
const ZEN_ARTIFACT_DEFAULTED_COMMAND_KEYS = Object.freeze(
  ZEN_ARTIFACT_COMMAND_KEYS.filter((key) => key !== 'treeType'),
);
const ZEN_ARTIFACT_COLLECTION_REPLACE_COMMAND_KEYS = Object.freeze([
  'artifactType',
  'expectedProfileGeneration',
  'mainEntryId',
  'records',
  'themeId',
  'updatedAt',
]);
const MODEL_STATE_PROFILE_EPOCH_RECORD_KEYS = Object.freeze([
  'key',
  'updatedAt',
  'value',
]);

function createZenArtifactContractError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

const normalizeArtifactType = (artifactType = ZEN_ARTIFACT_TYPE.BONSAI) => {
  if (artifactType !== ZEN_ARTIFACT_TYPE.BONSAI) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_TYPE_UNSUPPORTED');
  }
  return ZEN_ARTIFACT_TYPE.BONSAI;
};

const normalizeThemeId = (themeId = ZEN_ARTIFACT_THEME_ID) => {
  if (themeId !== ZEN_ARTIFACT_THEME_ID) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_THEME_UNSUPPORTED');
  }
  return ZEN_ARTIFACT_THEME_ID;
};

const normalizeArtifactTreeType = (treeType, { allowDefault = false } = {}) => {
  if (allowDefault && treeType === undefined) return 'sakura';
  if (treeType !== 'sakura') {
    throw createZenArtifactContractError('ZEN_ARTIFACT_TREE_TYPE_UNSUPPORTED');
  }
  return 'sakura';
};

const buildMetaRecordId = ({
  themeId = ZEN_ARTIFACT_THEME_ID,
  artifactType = ZEN_ARTIFACT_TYPE.BONSAI,
} = {}) => `${normalizeThemeId(themeId)}_artifact_meta_${normalizeArtifactType(artifactType)}`;

const toTimestamp = (value, fallback = Date.now()) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
};

const clonePlainValue = (value) => {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
};

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const hasExactKeys = (value, expectedKeys) => {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const canonicalKeys = [...expectedKeys].sort();
  return actualKeys.length === canonicalKeys.length
    && actualKeys.every((key, index) => key === canonicalKeys[index]);
};

const requireInstalledProfileGeneration = (record) => {
  if (
    !hasExactKeys(record, MODEL_STATE_PROFILE_EPOCH_RECORD_KEYS)
    || record.key !== MODEL_STATE_PROFILE_EPOCH_ROW_KEY
    || !Number.isSafeInteger(record.updatedAt)
    || record.updatedAt < 0
  ) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_PROFILE_GENERATION_RECORD_INVALID');
  }
  try {
    return normalizeModelStateProfileEpoch(record.value).profileEpoch;
  } catch (cause) {
    const error = createZenArtifactContractError(
      'ZEN_ARTIFACT_PROFILE_GENERATION_RECORD_INVALID',
    );
    error.cause = cause;
    throw error;
  }
};

const createStaleProfileGenerationError = ({
  expectedProfileGeneration,
  observedProfileGeneration,
}) => {
  const error = createZenArtifactContractError('ZEN_ARTIFACT_PROFILE_GENERATION_STALE');
  error.expectedProfileGeneration = expectedProfileGeneration;
  error.observedProfileGeneration = observedProfileGeneration;
  return error;
};

const areCanonicalValuesEqual = (left, right) => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => areCanonicalValuesEqual(value, right[index]));
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => (
      Object.prototype.hasOwnProperty.call(right, key)
      && areCanonicalValuesEqual(left[key], right[key])
    ));
};

const normalizeArtifactRecord = (record = {}, { requireStoredContract = false } = {}) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_RECORD_REQUIRED');
  }
  if (
    requireStoredContract
    && record.schemaVersion !== ZEN_ARTIFACT_SCHEMA_VERSION
  ) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_SCHEMA_VERSION_UNSUPPORTED');
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'schemaVersion')
    && record.schemaVersion !== ZEN_ARTIFACT_SCHEMA_VERSION
  ) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_SCHEMA_VERSION_UNSUPPORTED');
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'recordType')
    && record.recordType !== ZEN_ARTIFACT_RECORD_TYPE.ARTIFACT
  ) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_RECORD_TYPE_INVALID');
  }
  if (requireStoredContract && (
    record.recordType !== ZEN_ARTIFACT_RECORD_TYPE.ARTIFACT
    || record.themeId !== ZEN_ARTIFACT_THEME_ID
    || record.artifactType !== ZEN_ARTIFACT_TYPE.BONSAI
    || record.treeType !== 'sakura'
    || typeof record.id !== 'string'
    || !record.id.trim()
  )) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_STORED_CONTRACT_INVALID');
  }
  if (requireStoredContract && !hasExactKeys(record, ZEN_ARTIFACT_RECORD_KEYS)) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_STORED_SHAPE_INVALID');
  }
  const createdAt = toTimestamp(record.createdAt);
  const updatedAt = toTimestamp(record.updatedAt, createdAt);
  const normalized = {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : null,
    recordType: ZEN_ARTIFACT_RECORD_TYPE.ARTIFACT,
    themeId: normalizeThemeId(record.themeId),
    artifactType: normalizeArtifactType(record.artifactType),
    label: typeof record.label === 'string' ? record.label : '',
    seed: Number.isFinite(Number(record.seed)) ? Math.floor(Number(record.seed)) : 0,
    latent: clonePlainValue(record.latent || {}),
    structureMode: typeof record.structureMode === 'string' ? record.structureMode : 'tree',
    structureDepth: Number.isFinite(Number(record.structureDepth))
      ? Math.floor(Number(record.structureDepth))
      : 6,
    score: record.score !== null && Number.isFinite(Number(record.score))
      ? Number(record.score)
      : null,
    phenotypeSummary: record.phenotypeSummary ? clonePlainValue(record.phenotypeSummary) : null,
    source: typeof record.source === 'string' && record.source.trim()
      ? record.source.trim()
      : 'manual',
    treeType: normalizeArtifactTreeType(record.treeType, {
      allowDefault: !Object.prototype.hasOwnProperty.call(record, 'treeType'),
    }),
    createdAt,
    updatedAt,
    schemaVersion: ZEN_ARTIFACT_SCHEMA_VERSION,
  };
  if (requireStoredContract && !areCanonicalValuesEqual(record, normalized)) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_STORED_CONTRACT_INVALID');
  }
  return normalized;
};

const normalizeMetaRecord = (record = {}, defaults = {}, { requireStoredContract = false } = {}) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_META_RECORD_REQUIRED');
  }
  if (
    requireStoredContract
    && record.schemaVersion !== ZEN_ARTIFACT_SCHEMA_VERSION
  ) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_META_SCHEMA_VERSION_UNSUPPORTED');
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'schemaVersion')
    && record.schemaVersion !== ZEN_ARTIFACT_SCHEMA_VERSION
  ) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_META_SCHEMA_VERSION_UNSUPPORTED');
  }
  if (
    Object.prototype.hasOwnProperty.call(record, 'recordType')
    && record.recordType !== ZEN_ARTIFACT_RECORD_TYPE.META
  ) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_META_RECORD_TYPE_INVALID');
  }
  if (requireStoredContract && (
    record.recordType !== ZEN_ARTIFACT_RECORD_TYPE.META
    || record.themeId !== ZEN_ARTIFACT_THEME_ID
    || record.artifactType !== ZEN_ARTIFACT_TYPE.BONSAI
    || record.id !== buildMetaRecordId({
      themeId: record.themeId,
      artifactType: record.artifactType,
    })
  )) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_META_STORED_CONTRACT_INVALID');
  }
  if (requireStoredContract && !hasExactKeys(record, ZEN_ARTIFACT_META_RECORD_KEYS)) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_META_STORED_SHAPE_INVALID');
  }
  const themeId = normalizeThemeId(record.themeId || defaults.themeId);
  const artifactType = normalizeArtifactType(record.artifactType || defaults.artifactType);
  const normalized = {
    id: buildMetaRecordId({ themeId, artifactType }),
    recordType: ZEN_ARTIFACT_RECORD_TYPE.META,
    themeId,
    artifactType,
    mainEntryId: typeof record.mainEntryId === 'string' && record.mainEntryId.trim()
      ? record.mainEntryId.trim()
      : null,
    updatedAt: toTimestamp(record.updatedAt, DEFAULT_META_UPDATED_AT),
    schemaVersion: ZEN_ARTIFACT_SCHEMA_VERSION,
  };
  if (requireStoredContract && !areCanonicalValuesEqual(record, normalized)) {
    throw createZenArtifactContractError('ZEN_ARTIFACT_META_STORED_CONTRACT_INVALID');
  }
  return normalized;
};

export function requireZenArtifactStoredRecord(record) {
  if (record?.recordType === ZEN_ARTIFACT_RECORD_TYPE.ARTIFACT) {
    return normalizeArtifactRecord(record, { requireStoredContract: true });
  }
  if (record?.recordType === ZEN_ARTIFACT_RECORD_TYPE.META) {
    return normalizeMetaRecord(record, {}, { requireStoredContract: true });
  }
  throw createZenArtifactContractError('ZEN_ARTIFACT_STORED_RECORD_TYPE_INVALID');
}

export class ZenArtifactStore {
  constructor({ dbManager = DBManager.getInstance() } = {}) {
    this.dbManager = dbManager;
  }

  static getInstance() {
    if (!ZenArtifactStore.instance) {
      ZenArtifactStore.instance = new ZenArtifactStore();
    }
    return ZenArtifactStore.instance;
  }

  async getDatabase() {
    if (!this.dbManager || typeof this.dbManager.getDatabase !== 'function') {
      throw new Error('ZEN_ARTIFACT_STORE_DATABASE_REQUIRED');
    }
    return this.dbManager.getDatabase();
  }

  async read(id) {
    if (!id) return null;
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ZEN_ARTIFACTS, 'readonly');
      const store = tx.objectStore(STORES.ZEN_ARTIFACTS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async readAll() {
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ZEN_ARTIFACTS, 'readonly');
      const store = tx.objectStore(STORES.ZEN_ARTIFACTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getArtifact(id) {
    if (typeof id !== 'string' || !id.trim()) return null;
    const stored = await this.read(id.trim());
    if (!stored) return null;
    return normalizeArtifactRecord(stored, { requireStoredContract: true });
  }

  async listArtifacts({
    themeId = ZEN_ARTIFACT_THEME_ID,
    artifactType = ZEN_ARTIFACT_TYPE.BONSAI,
  } = {}) {
    const records = await this.readAll();
    const normalizedThemeId = normalizeThemeId(themeId);
    const normalizedArtifactType = normalizeArtifactType(artifactType);
    return records
      .map((record) => requireZenArtifactStoredRecord(record))
      .filter((record) => (
        record.recordType === ZEN_ARTIFACT_RECORD_TYPE.ARTIFACT
        && record.themeId === normalizedThemeId
        && record.artifactType === normalizedArtifactType
      ))
      .sort((left, right) => (
        Number(right.updatedAt || 0) - Number(left.updatedAt || 0)
      ));
  }

  async readArtifactCollection({
    themeId = ZEN_ARTIFACT_THEME_ID,
    artifactType = ZEN_ARTIFACT_TYPE.BONSAI,
  } = {}) {
    const normalizedThemeId = normalizeThemeId(themeId);
    const normalizedArtifactType = normalizeArtifactType(artifactType);
    const metaId = buildMetaRecordId({
      themeId: normalizedThemeId,
      artifactType: normalizedArtifactType,
    });
    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ZEN_ARTIFACTS, 'readonly');
      const store = tx.objectStore(STORES.ZEN_ARTIFACTS);
      const allRequest = store.getAll();
      const metaRequest = store.get(metaId);
      let settled = false;
      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      allRequest.onerror = () => rejectOnce(allRequest.error);
      metaRequest.onerror = () => rejectOnce(metaRequest.error);
      tx.oncomplete = () => {
        if (settled) return;
        try {
          const entries = (Array.isArray(allRequest.result) ? allRequest.result : [])
            .map((record) => requireZenArtifactStoredRecord(record))
            .filter((record) => (
              record.recordType === ZEN_ARTIFACT_RECORD_TYPE.ARTIFACT
              && record.themeId === normalizedThemeId
              && record.artifactType === normalizedArtifactType
            ))
            .sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt));
          const meta = metaRequest.result
            ? normalizeMetaRecord(
              metaRequest.result,
              { themeId: normalizedThemeId, artifactType: normalizedArtifactType },
              { requireStoredContract: true },
            )
            : normalizeMetaRecord({}, {
              themeId: normalizedThemeId,
              artifactType: normalizedArtifactType,
            });
          settled = true;
          resolve(Object.freeze({
            entries: Object.freeze(entries),
            mainEntryId: meta.mainEntryId,
            updatedAt: meta.updatedAt,
          }));
        } catch (error) {
          rejectOnce(error);
        }
      };
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => rejectOnce(
        tx.error || createZenArtifactContractError('ZEN_ARTIFACT_COLLECTION_READ_ABORTED'),
      );
    });
  }

  async replaceArtifactCollectionForProfileGeneration(command = {}) {
    if (!hasExactKeys(command, ZEN_ARTIFACT_COLLECTION_REPLACE_COMMAND_KEYS)) {
      throw createZenArtifactContractError('ZEN_ARTIFACT_COLLECTION_REPLACE_COMMAND_INVALID');
    }
    if (!Array.isArray(command.records)) {
      throw createZenArtifactContractError('ZEN_ARTIFACT_ENTRIES_REQUIRED');
    }
    const themeId = normalizeThemeId(command.themeId);
    const artifactType = normalizeArtifactType(command.artifactType);
    const expectedProfileGeneration = requireModelStateProfileEpochId(
      command.expectedProfileGeneration,
      'ZEN_ARTIFACT_EXPECTED_PROFILE_GENERATION_INVALID',
    );
    const records = command.records.map((record) => {
      if (
        !hasExactKeys(record, ZEN_ARTIFACT_RECORD_KEYS)
        && !hasExactKeys(record, ZEN_ARTIFACT_COMMAND_KEYS)
        && !hasExactKeys(record, ZEN_ARTIFACT_DEFAULTED_COMMAND_KEYS)
      ) {
        throw createZenArtifactContractError('ZEN_ARTIFACT_COMMAND_SHAPE_INVALID');
      }
      return normalizeArtifactRecord(record);
    });
    if (records.some((record) => !record.id)) {
      throw createZenArtifactContractError('ZEN_ARTIFACT_ID_REQUIRED');
    }
    const recordIds = new Set(records.map((record) => record.id));
    if (recordIds.size !== records.length) {
      throw createZenArtifactContractError('ZEN_ARTIFACT_COLLECTION_DUPLICATE_ID');
    }
    const mainEntryId = command.mainEntryId === null
      ? null
      : (typeof command.mainEntryId === 'string'
        && command.mainEntryId.length > 0
        && command.mainEntryId.trim() === command.mainEntryId
        ? command.mainEntryId
        : null);
    if (command.mainEntryId !== null && mainEntryId === null) {
      throw createZenArtifactContractError('ZEN_ARTIFACT_MAIN_ENTRY_ID_INVALID');
    }
    if (mainEntryId !== null && !recordIds.has(mainEntryId)) {
      throw createZenArtifactContractError('ZEN_ARTIFACT_MAIN_ENTRY_ID_MISSING');
    }
    if (!Number.isSafeInteger(command.updatedAt) || command.updatedAt < 0) {
      throw createZenArtifactContractError('ZEN_ARTIFACT_COLLECTION_UPDATED_AT_INVALID');
    }
    const meta = normalizeMetaRecord({
      mainEntryId,
      updatedAt: command.updatedAt,
      themeId,
      artifactType,
    }, { themeId, artifactType });

    const db = await this.getDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORES.ZEN_ARTIFACTS, STORES.MODEL_STATE],
        'readwrite',
      );
      const artifactStore = tx.objectStore(STORES.ZEN_ARTIFACTS);
      const modelStateStore = tx.objectStore(STORES.MODEL_STATE);
      const currentArtifactsRequest = artifactStore.getAll();
      const profileEpochRequest = modelStateStore.get(MODEL_STATE_PROFILE_EPOCH_ROW_KEY);
      let artifactsReady = false;
      let profileEpochReady = false;
      let mutationScheduled = false;
      let settled = false;

      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const abortWith = (error) => {
        try {
          tx.abort();
        } catch {
          // The transaction may already be aborting after a request failure.
        }
        rejectOnce(error);
      };
      const scheduleMutationWhenReady = () => {
        if (
          settled
          || mutationScheduled
          || !artifactsReady
          || !profileEpochReady
        ) return;
        try {
          const observedProfileGeneration = requireInstalledProfileGeneration(
            profileEpochRequest.result,
          );
          if (observedProfileGeneration !== expectedProfileGeneration) {
            throw createStaleProfileGenerationError({
              expectedProfileGeneration,
              observedProfileGeneration,
            });
          }
          const currentRecords = Array.isArray(currentArtifactsRequest.result)
            ? currentArtifactsRequest.result.map((record) => requireZenArtifactStoredRecord(record))
            : [];
          currentRecords
            .filter((record) => (
              record.recordType === ZEN_ARTIFACT_RECORD_TYPE.ARTIFACT
              && record.themeId === themeId
              && record.artifactType === artifactType
              && !recordIds.has(record.id)
            ))
            .forEach((record) => artifactStore.delete(record.id));
          records.forEach((record) => artifactStore.put(record));
          artifactStore.put(meta);
          mutationScheduled = true;
        } catch (error) {
          abortWith(error);
        }
      };

      currentArtifactsRequest.onsuccess = () => {
        artifactsReady = true;
        scheduleMutationWhenReady();
      };
      profileEpochRequest.onsuccess = () => {
        profileEpochReady = true;
        scheduleMutationWhenReady();
      };
      currentArtifactsRequest.onerror = () => abortWith(currentArtifactsRequest.error);
      profileEpochRequest.onerror = () => abortWith(profileEpochRequest.error);
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(Object.freeze({
          entries: Object.freeze(records),
          mainEntryId,
          updatedAt: meta.updatedAt,
          profileGeneration: expectedProfileGeneration,
        }));
      };
      tx.onerror = () => rejectOnce(tx.error);
      tx.onabort = () => rejectOnce(
        tx.error || createZenArtifactContractError('ZEN_ARTIFACT_COLLECTION_REPLACE_ABORTED'),
      );
    });
  }

  async clearForProfileMutation() {
    const db = await this.getDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ZEN_ARTIFACTS, 'readwrite');
      const store = tx.objectStore(STORES.ZEN_ARTIFACTS);
      const req = store.clear();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(
        tx.error || createZenArtifactContractError('ZEN_ARTIFACT_PROFILE_MUTATION_CLEAR_ABORTED'),
      );
    });
  }
}

export default ZenArtifactStore;
