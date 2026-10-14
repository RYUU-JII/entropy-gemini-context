import { isAllowedFaviconDataUrl } from '../../assets/faviconDataUrlPolicy.js';
import { requireEncryptedLogRecord } from '../../../security/encryptedLogContract.js';
import {
  DB_EXPORT_FORMAT_VERSION,
  DB_VERSION,
  ENC_ALGO,
  EXPORT_STORE_TO_FIELD,
  STORES,
} from './dbConstants.js';
import { getIndexedDbV1StoreKeyPath } from './dbSchema.js';
import {
  normalizeDailySummaryDateStr,
  normalizeStatsHourlyBucketReadRow,
  normalizeStatsTransitionDomain,
  toFiniteTimestamp,
} from './dbStatsNormalizers.js';
import {
  STATS_SCHEMA_VERSION,
  normalizeStatsDay,
} from '../../../../domains/stats/contracts/statsContracts.js';
import {
  STATS_FEATURE_PACK_DAILY_VERSION,
  normalizeStatsFeaturePackRow,
} from './stores/StatsFeaturePackStore.js';
import {
  INTERVENTION_EFFECT_DAILY_SCHEMA_VERSION,
  INTERVENTION_EXPOSURE_SCHEMA_VERSION,
  normalizeInterventionEffectDailyRow,
  normalizeInterventionExposureRow,
} from './stores/InterventionEffectStore.js';
import {
  CLSE_DAILY_SUMMARY_SCHEMA_VERSION,
  normalizeClseAggressionLogRow,
  normalizeClseBaselineRow,
  normalizeClseBucket5minRow,
  normalizeClseBucket60sRow,
  normalizeClseDailySummaryRow,
  normalizeClseLoopEventRow,
} from './stores/clseRecordContracts.js';
import {
  ZEN_ARTIFACT_SCHEMA_VERSION,
  ZEN_ARTIFACT_THEME_ID,
  ZEN_ARTIFACT_TYPE,
  requireZenArtifactStoredRecord,
} from './stores/ZenArtifactStore.js';
import {
  requireModelStateSnapshotValue,
} from '../../model/ModelStateSnapshotContract.js';

const IMPORT_ROW_COUNT_LIMITS = Object.freeze({
  logs: 100_000,
  statsHourly: 20_000,
  statsDaily: 2_000,
  statsFeaturePackDaily: 200_000,
  interventionExposures: 100_000,
  interventionEffectDaily: 200_000,
  favicons: 5_000,
  modelState: 5_000,
  zenArtifacts: 1_000,
  clseBuckets60s: 200_000,
  clseBuckets5min: 100_000,
  clseLoopEvents: 200_000,
  clseBaseline: 1,
  clseAggressionLogs: 100_000,
  clseDailySummaries: 2_000,
});

const IMPORT_ROW_SIZE_LIMITS = Object.freeze({
  logs: 1024 * 1024,
  statsHourly: 128 * 1024,
  statsDaily: 256 * 1024,
  statsFeaturePackDaily: 128 * 1024,
  interventionExposures: 64 * 1024,
  interventionEffectDaily: 64 * 1024,
  favicons: 300 * 1024,
  modelState: 5 * 1024 * 1024,
  zenArtifacts: 5 * 1024 * 1024,
  clseBuckets60s: 128 * 1024,
  clseBuckets5min: 128 * 1024,
  clseLoopEvents: 128 * 1024,
  clseBaseline: 512 * 1024,
  clseAggressionLogs: 256 * 1024,
  clseDailySummaries: 128 * 1024,
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJsonObject(value) {
  if (!isPlainObject(value)) return null;
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return null;
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function getJsonByteSize(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch (_) {
    return Number.POSITIVE_INFINITY;
  }
}

function normalizeTrimmedString(value, { maxLength = 512 } = {}) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function normalizeOptionalPositiveInteger(value) {
  if (typeof value === 'undefined' || value === null) return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return null;
  return numeric;
}

function toImportFiniteTimestamp(value) {
  if (typeof value === 'undefined' || value === null || value === '') return null;
  return toFiniteTimestamp(value);
}

function areJsonValuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => areJsonValuesEqual(value, right[index]));
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index]
      && areJsonValuesEqual(left[key], right[key])
    ));
}

function createIndexedDbImportError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function requireCanonicalImportRow(row, normalized) {
  return normalized && areJsonValuesEqual(row, normalized) ? normalized : null;
}

function normalizeEncryptedLogImportRow(row) {
  const clone = cloneJsonObject(row);
  if (!clone) return null;
  const id = normalizeOptionalPositiveInteger(clone.id);
  if (id === null) return null;
  try {
    requireEncryptedLogRecord(clone);
  } catch {
    return null;
  }
  return requireCanonicalImportRow(clone, { id, version: clone.version, timestamp: clone.timestamp, iv: clone.iv, data: clone.data });
}

function normalizeStatsHourlyImportRow(row) {
  const clone = cloneJsonObject(row);
  if (!clone) return null;
  return requireCanonicalImportRow(clone, normalizeStatsHourlyBucketReadRow(clone));
}

function normalizeStatsDailyImportRow(row) {
  const clone = cloneJsonObject(row);
  if (!clone) return null;
  const dateStr = normalizeDailySummaryDateStr(clone.dateStr);
  const finalizedAt = toFiniteTimestamp(clone.finalizedAt);
  const sourceHourlyRevision = Number(clone.sourceHourlyRevision);
  if (
    !dateStr
    || dateStr !== clone.dateStr
    || !isPlainObject(clone.dayData)
    || clone.dayData.schemaVersion !== STATS_SCHEMA_VERSION
    || finalizedAt === null
    || finalizedAt !== clone.finalizedAt
    || !Number.isSafeInteger(sourceHourlyRevision)
    || sourceHourlyRevision < 0
  ) return null;
  let normalizedDayData;
  try {
    normalizedDayData = normalizeStatsDay(clone.dayData, { now: finalizedAt });
  } catch {
    // This decoder reports invalid presence to preflightImportRows, which adds
    // the exact store/row error before any import mutation is admitted.
    return null;
  }
  if (!areJsonValuesEqual(clone.dayData, normalizedDayData)) return null;
  return clone;
}

function normalizeStatsFeaturePackImportRow(row) {
  const clone = cloneJsonObject(row);
  if (!clone) return null;
  if (
    clone.schemaVersion !== STATS_FEATURE_PACK_DAILY_VERSION
    || clone.featurePackVersion !== STATS_FEATURE_PACK_DAILY_VERSION
  ) return null;
  return requireCanonicalImportRow(clone, normalizeStatsFeaturePackRow(clone));
}

function normalizeInterventionExposureImportRow(row) {
  const clone = cloneJsonObject(row);
  if (!clone) return null;
  if (clone.schemaVersion !== INTERVENTION_EXPOSURE_SCHEMA_VERSION) return null;
  return requireCanonicalImportRow(clone, normalizeInterventionExposureRow(clone));
}

function normalizeInterventionEffectDailyImportRow(row) {
  const clone = cloneJsonObject(row);
  if (!clone) return null;
  if (clone.schemaVersion !== INTERVENTION_EFFECT_DAILY_SCHEMA_VERSION) return null;
  return requireCanonicalImportRow(clone, normalizeInterventionEffectDailyRow(clone));
}

function normalizeFaviconImportRow(row) {
  const clone = cloneJsonObject(row);
  if (!clone) return null;
  const domain = normalizeStatsTransitionDomain(clone.domain);
  const dataUrl = typeof clone.dataUrl === 'string' ? clone.dataUrl.trim() : '';
  const updatedAt = toFiniteTimestamp(clone.updatedAt);
  if (
    !domain
    || domain !== clone.domain
    || !isAllowedFaviconDataUrl(dataUrl)
    || dataUrl !== clone.dataUrl
    || updatedAt === null
    || updatedAt !== clone.updatedAt
  ) return null;
  return clone;
}

function normalizeModelStateImportRow(row) {
  const clone = cloneJsonObject(row);
  if (!clone) return null;
  if (
    Object.keys(clone).length !== 3
    || !Object.prototype.hasOwnProperty.call(clone, 'key')
    || !Object.prototype.hasOwnProperty.call(clone, 'value')
    || !Object.prototype.hasOwnProperty.call(clone, 'updatedAt')
  ) return null;
  const key = normalizeTrimmedString(clone.key, { maxLength: 256 });
  const updatedAt = toFiniteTimestamp(clone.updatedAt);
  if (
    !key
    || key !== clone.key
    || !Object.prototype.hasOwnProperty.call(clone, 'value')
    || updatedAt === null
    || updatedAt !== clone.updatedAt
  ) return null;
  try {
    requireModelStateSnapshotValue(key, clone.value);
    return clone;
  } catch (_) {
    return null;
  }
}

function normalizeZenArtifactImportRow(row) {
  const clone = cloneJsonObject(row);
  if (!clone) return null;
  const id = normalizeTrimmedString(clone.id, { maxLength: 256 });
  const updatedAt = toFiniteTimestamp(clone.updatedAt);
  if (
    !id
    || id !== clone.id
    || clone.schemaVersion !== ZEN_ARTIFACT_SCHEMA_VERSION
    || clone.themeId !== ZEN_ARTIFACT_THEME_ID
    || clone.artifactType !== ZEN_ARTIFACT_TYPE.BONSAI
    || (clone.recordType !== 'artifact' && clone.recordType !== 'meta')
    || updatedAt === null
    || updatedAt !== clone.updatedAt
  ) return null;
  try {
    return requireCanonicalImportRow(clone, requireZenArtifactStoredRecord(clone));
  } catch (_) {
    return null;
  }
}

function normalizeClseImportRow(row, normalizeRow) {
  const clone = cloneJsonObject(row);
  if (!clone) return null;
  return normalizeRow(clone);
}

function normalizeClseDailySummaryImportRow(row) {
  const clone = cloneJsonObject(row);
  if (!clone) return null;
  if (clone.schemaVersion !== CLSE_DAILY_SUMMARY_SCHEMA_VERSION) return null;
  return requireCanonicalImportRow(clone, normalizeClseDailySummaryRow(clone));
}

function createImportPrimaryKeySpec(storeName) {
  const keyPath = getIndexedDbV1StoreKeyPath(storeName);
  if (typeof keyPath !== 'string') {
    throw createIndexedDbImportError('INDEXED_DB_SNAPSHOT_PRIMARY_KEY_PATH_UNSUPPORTED', {
      storeName,
      keyPath,
    });
  }
  return Object.freeze({ storeName, keyPath });
}

function createImportFieldSpec(storeName, normalizeRow) {
  const fieldName = EXPORT_STORE_TO_FIELD[storeName];
  if (typeof fieldName !== 'string' || !fieldName) {
    throw createIndexedDbImportError('INDEXED_DB_SNAPSHOT_FIELD_MAPPING_MISSING', {
      storeName,
    });
  }
  return Object.freeze({
    fieldName,
    normalizeRow,
    primaryKey: createImportPrimaryKeySpec(storeName),
  });
}

const IMPORT_FIELD_SPECS = Object.freeze([
  createImportFieldSpec(STORES.LOGS, normalizeEncryptedLogImportRow),
  createImportFieldSpec(STORES.STATS_HOURLY, normalizeStatsHourlyImportRow),
  createImportFieldSpec(STORES.STATS_DAILY, normalizeStatsDailyImportRow),
  createImportFieldSpec(
    STORES.STATS_FEATURE_PACK_DAILY,
    normalizeStatsFeaturePackImportRow,
  ),
  createImportFieldSpec(
    STORES.INTERVENTION_EXPOSURES,
    normalizeInterventionExposureImportRow,
  ),
  createImportFieldSpec(
    STORES.INTERVENTION_EFFECT_DAILY,
    normalizeInterventionEffectDailyImportRow,
  ),
  createImportFieldSpec(STORES.FAVICONS, normalizeFaviconImportRow),
  createImportFieldSpec(STORES.MODEL_STATE, normalizeModelStateImportRow),
  createImportFieldSpec(STORES.ZEN_ARTIFACTS, normalizeZenArtifactImportRow),
  createImportFieldSpec(
    STORES.CLSE_BUCKETS_60S,
    (row) => normalizeClseImportRow(row, normalizeClseBucket60sRow),
  ),
  createImportFieldSpec(
    STORES.CLSE_BUCKETS_5MIN,
    (row) => normalizeClseImportRow(row, normalizeClseBucket5minRow),
  ),
  createImportFieldSpec(
    STORES.CLSE_LOOP_EVENTS,
    (row) => normalizeClseImportRow(row, normalizeClseLoopEventRow),
  ),
  createImportFieldSpec(
    STORES.CLSE_BASELINE,
    (row) => normalizeClseImportRow(row, normalizeClseBaselineRow),
  ),
  createImportFieldSpec(
    STORES.CLSE_AGGRESSION_LOGS,
    (row) => normalizeClseImportRow(row, normalizeClseAggressionLogRow),
  ),
  createImportFieldSpec(
    STORES.CLSE_DAILY_SUMMARIES,
    normalizeClseDailySummaryImportRow,
  ),
]);

function preflightImportRows(value, spec) {
  const { fieldName, normalizeRow, primaryKey = null } = spec;
  if (!Array.isArray(value)) throw createIndexedDbImportError(
    `INDEXED_DB_SNAPSHOT_STORE_INVALID:${fieldName}`,
    { fieldName },
  );

  const rowLimit = IMPORT_ROW_COUNT_LIMITS[fieldName] ?? Number.MAX_SAFE_INTEGER;
  const sizeLimit = IMPORT_ROW_SIZE_LIMITS[fieldName] ?? 1024 * 1024;
  if (value.length > rowLimit) throw createIndexedDbImportError(
    'INDEXED_DB_SNAPSHOT_ROW_LIMIT_EXCEEDED',
    { fieldName, actual: value.length, limit: rowLimit },
  );

  const rowIndexByPrimaryKey = primaryKey ? new Map() : null;

  return value.map((row, index) => {
    if (getJsonByteSize(row) > sizeLimit) {
      throw createIndexedDbImportError('INDEXED_DB_SNAPSHOT_ROW_TOO_LARGE', {
        fieldName,
        rowIndex: index,
        limit: sizeLimit,
      });
    }

    const normalized = normalizeRow(row);
    if (!normalized || !areJsonValuesEqual(row, normalized)) throw createIndexedDbImportError(
      'INDEXED_DB_SNAPSHOT_ROW_INVALID',
      { fieldName, rowIndex: index },
    );
    if (getJsonByteSize(normalized) > sizeLimit) {
      throw createIndexedDbImportError('INDEXED_DB_SNAPSHOT_ROW_TOO_LARGE', {
        fieldName,
        rowIndex: index,
        limit: sizeLimit,
      });
    }
    if (rowIndexByPrimaryKey) {
      const key = normalized[primaryKey.keyPath];
      if (rowIndexByPrimaryKey.has(key)) {
        throw createIndexedDbImportError(
          'INDEXED_DB_SNAPSHOT_PRIMARY_KEY_DUPLICATE',
          {
            fieldName,
            storeName: primaryKey.storeName,
            keyPath: primaryKey.keyPath,
            key,
            firstRowIndex: rowIndexByPrimaryKey.get(key),
            rowIndex: index,
          },
        );
      }
      rowIndexByPrimaryKey.set(key, index);
    }
    return normalized;
  });
}

function requireClseBaselineCardinality(snapshot) {
  const baselineRows = snapshot.clseBaseline;
  if (baselineRows.length > 1) {
    throw createIndexedDbImportError(
      'INDEXED_DB_SNAPSHOT_CLSE_BASELINE_CARDINALITY_INVALID',
      {
        fieldName: 'clseBaseline',
        actual: baselineRows.length,
        maximum: 1,
      },
    );
  }
}

function requireCanonicalClseEpochRelation(snapshot) {
  requireClseBaselineCardinality(snapshot);
  const baselineRows = snapshot.clseBaseline;
  const aggressionRows = snapshot.clseAggressionLogs;
  if (aggressionRows.length === 0) return;
  if (baselineRows.length !== 1) {
    throw createIndexedDbImportError(
      'INDEXED_DB_SNAPSHOT_CLSE_AGGRESSION_BASELINE_REQUIRED',
      {
        fieldName: 'clseAggressionLogs',
      },
    );
  }

  const resetEpoch = baselineRows[0].reset_epoch;
  const mismatchIndex = aggressionRows.findIndex((row) => (
    row.baseline_reset_epoch !== resetEpoch
  ));
  if (mismatchIndex !== -1) {
    throw createIndexedDbImportError(
      'INDEXED_DB_SNAPSHOT_CLSE_AGGRESSION_RESET_EPOCH_MISMATCH',
      {
        fieldName: 'clseAggressionLogs',
        rowIndex: mismatchIndex,
        baselineResetEpoch: resetEpoch,
        aggressionResetEpoch: aggressionRows[mismatchIndex].baseline_reset_epoch,
      },
    );
  }
}

export function createEmptyExportSnapshot() {
  return {
    meta: {
      version: DB_VERSION,
      formatVersion: DB_EXPORT_FORMAT_VERSION,
      exportedAt: Date.now(),
      algo: ENC_ALGO,
    },
    logs: [],
    statsHourly: [],
    statsDaily: [],
    statsFeaturePackDaily: [],
    interventionExposures: [],
    interventionEffectDaily: [],
    favicons: [],
    modelState: [],
    zenArtifacts: [],
    clseBuckets60s: [],
    clseBuckets5min: [],
    clseLoopEvents: [],
    clseBaseline: [],
    clseAggressionLogs: [],
    clseDailySummaries: [],
  };
}

function assertExactObjectKeys(value, expectedKeys, errorCode) {
  const actualKeys = Object.keys(value).sort();
  const canonicalKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== canonicalKeys.length
    || actualKeys.some((key, index) => key !== canonicalKeys[index])
  ) throw createIndexedDbImportError(errorCode, {
    actualKeys,
    expectedKeys: canonicalKeys,
  });
}

export function validateIndexedDbV1SnapshotEnvelope(json) {
  if (!isPlainObject(json)) throw new Error('INDEXED_DB_SNAPSHOT_INVALID');
  if (!isPlainObject(json.meta)) {
    throw new Error('INDEXED_DB_SNAPSHOT_META_INVALID');
  }
  IMPORT_FIELD_SPECS.forEach(({ fieldName }) => {
    if (!Object.prototype.hasOwnProperty.call(json, fieldName)) {
      throw new Error(`INDEXED_DB_SNAPSHOT_STORE_MISSING:${fieldName}`);
    }
    if (!Array.isArray(json[fieldName])) {
      throw new Error(`INDEXED_DB_SNAPSHOT_STORE_INVALID:${fieldName}`);
    }
  });
  assertExactObjectKeys(
    json,
    ['meta', ...IMPORT_FIELD_SPECS.map(({ fieldName }) => fieldName)],
    'INDEXED_DB_SNAPSHOT_FIELDS_INVALID',
  );
  assertExactObjectKeys(
    json.meta,
    ['version', 'formatVersion', 'exportedAt', 'algo'],
    'INDEXED_DB_SNAPSHOT_META_FIELDS_INVALID',
  );
  if (json.meta.version !== DB_VERSION) {
    throw new Error('UNSUPPORTED_INDEXED_DB_DATABASE_VERSION');
  }
  if (json.meta.formatVersion !== DB_EXPORT_FORMAT_VERSION) {
    throw new Error('UNSUPPORTED_INDEXED_DB_SNAPSHOT_VERSION');
  }
  if (json.meta.algo !== ENC_ALGO) {
    throw new Error('UNSUPPORTED_INDEXED_DB_SNAPSHOT_ALGORITHM');
  }
  if (!Number.isSafeInteger(json.meta.exportedAt) || json.meta.exportedAt < 0) {
    throw new Error('INDEXED_DB_SNAPSHOT_EXPORTED_AT_INVALID');
  }
  return json;
}

export function preflightIndexedDbV1ImportSnapshot(json) {
  // An earlier admission does not authorize a caller's mutable object. Each
  // import owns a newly validated copy before entering asynchronous owner lanes.
  const source = validateIndexedDbV1SnapshotEnvelope(json);
  requireClseBaselineCardinality(source);
  const normalized = IMPORT_FIELD_SPECS.reduce((acc, spec) => {
    acc[spec.fieldName] = preflightImportRows(source[spec.fieldName], spec);
    return acc;
  }, {});
  requireCanonicalClseEpochRelation(normalized);

  const snapshot = {
    meta: { ...source.meta },
    ...normalized,
  };
  return snapshot;
}
