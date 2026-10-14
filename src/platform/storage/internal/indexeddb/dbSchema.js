import { DB_VERSION, STORES } from './dbConstants.js';

const INDEXED_DB_V1_SCHEMA = Object.freeze([
  {
    name: STORES.LOGS,
    options: { keyPath: 'id', autoIncrement: true },
    indexes: [['timestamp', 'timestamp', { unique: false }]],
  },
  {
    name: STORES.STATS_HOURLY,
    options: { keyPath: 'bucketStartTs' },
    indexes: [
      ['dateStr', 'dateStr', { unique: false }],
      ['dateHour', ['dateStr', 'hour'], { unique: true }],
    ],
  },
  {
    name: STORES.STATS_DAILY,
    options: { keyPath: 'dateStr' },
    indexes: [['finalizedAt', 'finalizedAt', { unique: false }]],
  },
  {
    name: STORES.STATS_FEATURE_PACK_DAILY,
    options: { keyPath: 'id' },
    indexes: [
      ['dateStr', 'dateStr', { unique: false }],
      ['domain', 'domain', { unique: false }],
      ['date_domain', ['dateStr', 'domain'], { unique: true }],
      ['generatedAt', 'generatedAt', { unique: false }],
      ['sourceStatsRevision', 'sourceStatsRevision', { unique: false }],
    ],
  },
  {
    name: STORES.INTERVENTION_EXPOSURES,
    options: { keyPath: 'exposureId' },
    indexes: [
      ['dateStr', 'dateStr', { unique: false }],
      ['domain', 'domain', { unique: false }],
      ['shownAt', 'shownAt', { unique: false }],
      ['outcomeAt', 'outcomeAt', { unique: false }],
      ['artifact', ['artifactFamily', 'artifactId'], { unique: false }],
      ['date_domain', ['dateStr', 'domain'], { unique: false }],
    ],
  },
  {
    name: STORES.INTERVENTION_EFFECT_DAILY,
    options: { keyPath: 'id' },
    indexes: [
      ['dateStr', 'dateStr', { unique: false }],
      ['domain', 'domain', { unique: false }],
      ['artifact', ['artifactFamily', 'artifactId'], { unique: false }],
      ['date_domain', ['dateStr', 'domain'], { unique: false }],
      ['updatedAt', 'updatedAt', { unique: false }],
    ],
  },
  { name: STORES.FAVICONS, options: { keyPath: 'domain' }, indexes: [] },
  { name: STORES.MODEL_STATE, options: { keyPath: 'key' }, indexes: [] },
  {
    name: STORES.ZEN_ARTIFACTS,
    options: { keyPath: 'id' },
    indexes: [
      ['theme_artifact_record', ['themeId', 'artifactType', 'recordType'], { unique: false }],
      ['updatedAt', 'updatedAt', { unique: false }],
    ],
  },
  {
    name: STORES.CLSE_BUCKETS_60S,
    options: { keyPath: 'ts_start' },
    indexes: [['ts_start', 'ts_start', { unique: true }]],
  },
  {
    name: STORES.CLSE_BUCKETS_5MIN,
    options: { keyPath: 'ts_start' },
    indexes: [['ts_start', 'ts_start', { unique: true }]],
  },
  {
    name: STORES.CLSE_LOOP_EVENTS,
    options: { keyPath: 'ts' },
    indexes: [
      ['ts', 'ts', { unique: false }],
      ['site_key', 'site_key', { unique: false }],
    ],
  },
  { name: STORES.CLSE_BASELINE, options: { keyPath: 'id' }, indexes: [] },
  {
    name: STORES.CLSE_AGGRESSION_LOGS,
    options: { keyPath: 'ts' },
    indexes: [
      ['ts', 'ts', { unique: true }],
      ['bucket_ts', 'bucket_ts', { unique: false }],
      ['type', 'type', { unique: false }],
    ],
  },
  {
    name: STORES.CLSE_DAILY_SUMMARIES,
    options: { keyPath: 'dateStr' },
    indexes: [['updatedAt', 'updatedAt', { unique: false }]],
  },
]);

function toNameList(value) {
  return Array.from(value || [], (entry) => String(entry)).sort();
}

function assertExactNames(actualNames, expectedNames, errorCode, details = {}) {
  const actual = toNameList(actualNames);
  const expected = [...expectedNames].sort();
  if (
    actual.length !== expected.length
    || actual.some((name, index) => name !== expected[index])
  ) {
    const error = new Error(errorCode);
    error.code = errorCode;
    Object.assign(error, details);
    error.actual = actual;
    error.expected = expected;
    throw error;
  }
}

function areKeyPathsEqual(actual, expected) {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual)
      && Array.isArray(expected)
      && actual.length === expected.length
      && actual.every((entry, index) => entry === expected[index]);
  }
  return actual === expected;
}

function createSchemaMismatchError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

export function getIndexedDbV1StoreKeyPath(storeName) {
  const storeSchema = INDEXED_DB_V1_SCHEMA.find(({ name }) => name === storeName);
  if (!storeSchema) {
    throw createSchemaMismatchError('INDEXED_DB_V1_STORE_SCHEMA_NOT_FOUND', { storeName });
  }
  const { keyPath } = storeSchema.options;
  return Array.isArray(keyPath) ? [...keyPath] : keyPath;
}

export function applyIndexedDbV1Schema({ db }) {
  if (!db || typeof db.createObjectStore !== 'function') {
    throw new Error('INDEXED_DB_V1_SCHEMA_DATABASE_REQUIRED');
  }
  if (toNameList(db.objectStoreNames).length > 0) {
    throw new Error('INDEXED_DB_V1_SCHEMA_REQUIRES_FRESH_DATABASE');
  }

  INDEXED_DB_V1_SCHEMA.forEach(({ name, options, indexes }) => {
    const store = db.createObjectStore(name, options);
    indexes.forEach(([indexName, keyPath, indexOptions]) => {
      store.createIndex(indexName, keyPath, indexOptions);
    });
  });
}

export function assertIndexedDbV1Schema(db) {
  if (!db || typeof db.transaction !== 'function') {
    throw new Error('INDEXED_DB_V1_SCHEMA_DATABASE_REQUIRED');
  }
  if (db.version !== DB_VERSION) {
    const error = new Error('INDEXED_DB_VERSION_MISMATCH');
    error.code = 'INDEXED_DB_VERSION_MISMATCH';
    error.actual = db.version;
    error.expected = DB_VERSION;
    throw error;
  }

  const storeNames = INDEXED_DB_V1_SCHEMA.map(({ name }) => name);
  assertExactNames(db.objectStoreNames, storeNames, 'INDEXED_DB_V1_STORE_SET_MISMATCH');
  const transaction = db.transaction(storeNames, 'readonly');
  INDEXED_DB_V1_SCHEMA.forEach(({ name, options, indexes }) => {
    const store = transaction.objectStore(name);
    if (
      !areKeyPathsEqual(store.keyPath, options.keyPath)
      || store.autoIncrement !== (options.autoIncrement === true)
    ) throw createSchemaMismatchError(`INDEXED_DB_V1_STORE_CONTRACT_MISMATCH:${name}`, {
      storeName: name,
      actual: {
        keyPath: Array.isArray(store.keyPath) ? [...store.keyPath] : store.keyPath,
        autoIncrement: store.autoIncrement === true,
      },
      expected: {
        keyPath: Array.isArray(options.keyPath) ? [...options.keyPath] : options.keyPath,
        autoIncrement: options.autoIncrement === true,
      },
    });
    assertExactNames(
      store.indexNames,
      indexes.map(([indexName]) => indexName),
      `INDEXED_DB_V1_INDEX_SET_MISMATCH:${name}`,
      { storeName: name },
    );
    indexes.forEach(([indexName, keyPath, indexOptions]) => {
      const index = store.index(indexName);
      if (
        !areKeyPathsEqual(index.keyPath, keyPath)
        || index.unique !== (indexOptions.unique === true)
        || index.multiEntry !== (indexOptions.multiEntry === true)
      ) throw createSchemaMismatchError(`INDEXED_DB_V1_INDEX_CONTRACT_MISMATCH:${name}:${indexName}`, {
        storeName: name,
        indexName,
        actual: {
          keyPath: Array.isArray(index.keyPath) ? [...index.keyPath] : index.keyPath,
          unique: index.unique === true,
          multiEntry: index.multiEntry === true,
        },
        expected: {
          keyPath: Array.isArray(keyPath) ? [...keyPath] : keyPath,
          unique: indexOptions.unique === true,
          multiEntry: indexOptions.multiEntry === true,
        },
      });
    });
  });
  return db;
}
