import {
  STORAGE_LOCAL_DOC_KEYS,
} from '../../../../../platform/storage/settings/SettingsDocumentRepository.js';
import {
  STORAGE_LOCAL_KEY_KEYS,
} from '../../../../../platform/storage/security/KeyMaterialRepository.js';
import {
  normalizeSecuritySettingsSnapshot,
} from '../../../../../platform/storage/security/SecuritySettingsQueryService.js';
import {
  STORAGE_SUPPORT_SESSION_KEYS,
} from '../../../../../platform/storage/support/StorageInspectorCapability.js';

function isSupportPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function estimateJsonBytes(value) {
  if (value === null || value === undefined) {
    return { approxBytes: 0, approxBytesError: null };
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    return { approxBytes: 0, approxBytesError: null };
  }
  if (Array.isArray(value) && value.length === 0) {
    return { approxBytes: 0, approxBytesError: null };
  }
  if (isSupportPlainObject(value) && Object.keys(value).length === 0) {
    return { approxBytes: 0, approxBytesError: null };
  }
  try {
    const encoded = new TextEncoder().encode(JSON.stringify(value ?? null));
    return { approxBytes: encoded.length, approxBytesError: null };
  } catch (error) {
    return {
      approxBytes: null,
      approxBytesError: 'BACKGROUND_STORAGE_INSPECTOR_JSON_SIZE_ESTIMATE_FAILED',
      approxBytesErrorDetail: error?.message || String(error || 'UNKNOWN_ERROR'),
    };
  }
}

function hasSupportValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isSupportPlainObject(value)) return Object.keys(value).length > 0;
  return true;
}

function summarizeSupportValue(value) {
  if (!hasSupportValue(value)) return 'empty';
  if (typeof value === 'string') return `${value.length} chars`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `${value.length} items`;
  if (isSupportPlainObject(value)) {
    if (typeof value.dateStr === 'string' && value.dateStr.trim()) return value.dateStr.trim();
    return `${Object.keys(value).length} keys`;
  }
  return typeof value;
}

function buildSupportDefaults(keys = [], fallback = null) {
  return keys.reduce((acc, key) => {
    acc[key] = fallback;
    return acc;
  }, {});
}

function requireStorageInspectorFunction(owner, functionName, errorCode) {
  const fn = owner?.[functionName];
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn.bind(owner);
}

function requireSupportPlainObject(value, errorCode) {
  if (!isSupportPlainObject(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function readInspectorSecuritySettings(documentEntries) {
  const securityDocument = documentEntries[STORAGE_LOCAL_DOC_KEYS.SECURITY];
  if (securityDocument === null || securityDocument === undefined) {
    return normalizeSecuritySettingsSnapshot({});
  }
  return normalizeSecuritySettingsSnapshot(securityDocument);
}

function readInspectorStatsCacheDates(statsCache) {
  if (statsCache.dates === null || statsCache.dates === undefined) {
    return {};
  }
  return requireSupportPlainObject(
    statsCache.dates,
    'BACKGROUND_STORAGE_INSPECTOR_STATS_CACHE_DATES_REQUIRED',
  );
}

export function createBackgroundStorageInspectorService({
  settingsDocumentRepository,
  keyMaterialRepository,
  runtimeSessionRepository,
  storageInspectorCapability,
  getStatsCache,
  TabTimeTracker,
} = {}) {
  const getDocuments = requireStorageInspectorFunction(
    settingsDocumentRepository,
    'getDocuments',
    'BACKGROUND_STORAGE_INSPECTOR_SETTINGS_REPOSITORY_REQUIRED',
  );
  const getKeyEntries = requireStorageInspectorFunction(
    keyMaterialRepository,
    'getEntries',
    'BACKGROUND_STORAGE_INSPECTOR_KEY_REPOSITORY_REQUIRED',
  );
  const getSessionEntries = requireStorageInspectorFunction(
    runtimeSessionRepository,
    'get',
    'BACKGROUND_STORAGE_INSPECTOR_SESSION_REPOSITORY_REQUIRED',
  );
  const getIndexedDbOverview = requireStorageInspectorFunction(
    storageInspectorCapability,
    'getIndexedDbOverview',
    'BACKGROUND_STORAGE_INSPECTOR_SERVICE_CAPABILITY_REQUIRED',
  );
  const readStatsCache = requireStorageInspectorFunction(
    { getStatsCache },
    'getStatsCache',
    'BACKGROUND_STORAGE_INSPECTOR_STATS_RUNTIME_REQUIRED',
  );
  const getLastActiveTabId = requireStorageInspectorFunction(
    TabTimeTracker,
    'getLastActiveTabId',
    'BACKGROUND_STORAGE_INSPECTOR_TAB_TIME_TRACKER_REQUIRED',
  );
  const getFocusedWindowId = requireStorageInspectorFunction(
    TabTimeTracker,
    'getFocusedWindowId',
    'BACKGROUND_STORAGE_INSPECTOR_TAB_TIME_TRACKER_REQUIRED',
  );

  async function getStorageInspectorSnapshot() {
    const localDocumentDefaults = {
      [STORAGE_LOCAL_DOC_KEYS.CORE]: null,
      [STORAGE_LOCAL_DOC_KEYS.RULES]: null,
      [STORAGE_LOCAL_DOC_KEYS.UI]: null,
      [STORAGE_LOCAL_DOC_KEYS.SECURITY]: null,
      [STORAGE_LOCAL_DOC_KEYS.META]: null,
    };
    const localKeyDefaults = {
      [STORAGE_LOCAL_KEY_KEYS.SECURITY_VAULT]: null,
    };

    const [localDocuments, localKeyEntries, sessionEntries, indexedDb] = await Promise.all([
      getDocuments(Object.keys(localDocumentDefaults)),
      getKeyEntries(Object.keys(localKeyDefaults), null),
      getSessionEntries(buildSupportDefaults(STORAGE_SUPPORT_SESSION_KEYS, null)),
      getIndexedDbOverview(),
    ]);

    const documentEntries = requireSupportPlainObject(
      localDocuments,
      'BACKGROUND_STORAGE_INSPECTOR_LOCAL_DOCUMENTS_REQUIRED',
    );
    const keyEntries = requireSupportPlainObject(
      localKeyEntries,
      'BACKGROUND_STORAGE_INSPECTOR_KEY_ENTRIES_REQUIRED',
    );
    const runtimeEntries = requireSupportPlainObject(
      sessionEntries,
      'BACKGROUND_STORAGE_INSPECTOR_SESSION_ENTRIES_REQUIRED',
    );
    const indexedDbOverview = requireSupportPlainObject(
      indexedDb,
      'BACKGROUND_STORAGE_INSPECTOR_INDEXEDDB_OVERVIEW_REQUIRED',
    );
    const statsCache = requireSupportPlainObject(
      readStatsCache(),
      'BACKGROUND_STORAGE_INSPECTOR_STATS_CACHE_REQUIRED',
    );
    const securitySettings = readInspectorSecuritySettings(documentEntries);
    const statsCacheDates = readInspectorStatsCacheDates(statsCache);

    return {
      generatedAt: Date.now(),
      local: {
        documents: Object.keys(localDocumentDefaults).map((storageKey) => {
          const value = documentEntries[storageKey];
          return {
            storageKey,
            present: hasSupportValue(value),
            fieldCount: isSupportPlainObject(value) ? Object.keys(value).length : 0,
            ...estimateJsonBytes(value),
          };
        }),
        keyEntries: Object.keys(localKeyDefaults).map((storageKey) => {
          const value = keyEntries[storageKey];
          return {
            storageKey,
            present: hasSupportValue(value),
            ...estimateJsonBytes(value),
          };
        }),
        security: {
          resetGuardEnabled: securitySettings.requirePasscodeForReset,
          passcodeConfigured: securitySettings.masterPasscodeHash.trim().length > 0,
        },
      },
      session: {
        entries: STORAGE_SUPPORT_SESSION_KEYS.map((storageKey) => {
          const value = runtimeEntries[storageKey];
          return {
            storageKey,
            present: hasSupportValue(value),
            summary: summarizeSupportValue(value),
            ...estimateJsonBytes(value),
          };
        }),
      },
      indexedDb: indexedDbOverview,
      runtime: {
        statsCachedDates: Object.keys(statsCacheDates).length,
        lastActiveTabId: getLastActiveTabId(),
        focusedWindowId: getFocusedWindowId(),
      },
    };
  }

  return {
    getStorageInspectorSnapshot,
  };
}
