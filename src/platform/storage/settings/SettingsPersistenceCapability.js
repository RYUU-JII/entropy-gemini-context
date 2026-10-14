import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../domains/settings/config/index.js';
import {
  normalizeSiteGoals,
  normalizeUrlList,
} from '../../../domains/settings/config/siteRules.js';
import {
  hashDomainList,
  hashDomainValueMap,
  clearDomainHmacKeyCache,
} from '../../security/domainHashing.js';
import {
  FEATURE_KEYS,
  toFilterSettingsFeatureChangedKey,
} from '../../../domains/protection/protocol/features/featureCatalog.js';
import {
  KNOWN_FLAT_SETTING_KEYS,
  resolveKeyStoreStorageKey,
  resolveSettingsDocumentKey,
} from '../internal/chrome-storage/storageKeyRegistry.js';
import { requireSettingsStoredValue } from './settingsStoredValueContract.js';
import { areValuesEqual, isPlainObject } from '../internal/storageValueUtils.js';
import SettingsDocumentRepository from './SettingsDocumentRepository.js';
import KeyMaterialRepository from '../security/KeyMaterialRepository.js';
import {
  BOOTSTRAP_HOST_SETTING_KEYS, createBootstrapHostChangedKey, isBootstrapHostChangedKey,
} from '../../../domains/settings/config/bootstrapSnapshotInvalidation.js';
import { requireCanonicalDomainHmacSecret } from '../security/keyMaterialContract.js';

const DOMAIN_HMAC_SECRET_KEY = 'domainHmacSecret';
const BLOCKED_HASHES_KEY = 'blockedUrlHashes';
const ALLOWED_HASHES_KEY = 'allowedUrlHashes';
const SITE_GOAL_HASHES_KEY = 'siteGoalHashes';
const KNOWN_SETTINGS_KEY_SET = new Set(KNOWN_FLAT_SETTING_KEYS);

const DOMAIN_RULE_SETTING_KEYS = new Set([
  'blockedUrls',
  'allowedUrls',
  'siteGoals',
  'siteGoalMeta',
  'siteRuleTimeline',
]);

export const SETTINGS_BOUNDARY_ERROR_CODES = Object.freeze({
  FULL_SNAPSHOT_FORBIDDEN: 'SETTINGS_FULL_SNAPSHOT_FORBIDDEN',
  MALFORMED_VALUE: 'SETTINGS_MALFORMED_VALUE',
  UNKNOWN_KEYS: 'SETTINGS_UNKNOWN_KEYS',
});

function createSettingsBoundaryError(code, extra = {}) {
  const message = typeof code === 'string' && code.trim()
    ? code.trim()
    : SETTINGS_BOUNDARY_ERROR_CODES.UNKNOWN_KEYS;
  const error = new Error(message);
  error.code = message;
  Object.assign(error, extra);
  return error;
}

function normalizeRequestedKeys(source = {}) {
  return Object.keys(isPlainObject(source) ? source : {});
}

function collectUnknownSettingsKeys(source = {}) {
  return normalizeRequestedKeys(source).filter((key) => !KNOWN_SETTINGS_KEY_SET.has(key));
}

function assertKnownSettingsKeys(source = {}) {
  const unknownKeys = collectUnknownSettingsKeys(source);
  if (unknownKeys.length === 0) return;
  throw createSettingsBoundaryError(SETTINGS_BOUNDARY_ERROR_CODES.UNKNOWN_KEYS, {
    unknownKeys,
  });
}

function describeSettingsValueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function assertPlainSettingsValue(key, value) {
  if (isPlainObject(value)) return value;
  throw createSettingsBoundaryError(SETTINGS_BOUNDARY_ERROR_CODES.MALFORMED_VALUE, {
    key,
    valueType: describeSettingsValueType(value),
  });
}

export function isSettingsBoundaryError(error) {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  return code === SETTINGS_BOUNDARY_ERROR_CODES.FULL_SNAPSHOT_FORBIDDEN
    || code === SETTINGS_BOUNDARY_ERROR_CODES.MALFORMED_VALUE
    || code === SETTINGS_BOUNDARY_ERROR_CODES.UNKNOWN_KEYS;
}

function collectChangedFilterFeatureKeys(previousSettings, nextSettings) {
  return FEATURE_KEYS.filter((featureKey) => !areValuesEqual(
    previousSettings?.[featureKey] ?? null,
    nextSettings?.[featureKey] ?? null,
  ));
}

function partitionStoragePayload(items = {}) {
  const payload = isPlainObject(items) ? items : {};
  const settingsItems = {};
  const keyItems = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (resolveSettingsDocumentKey(key)) {
      settingsItems[key] = value;
      return;
    }
    if (resolveKeyStoreStorageKey(key)) {
      keyItems[key] = value;
    }
  });

  return { settingsItems, keyItems };
}

export class SettingsPersistenceCapability {
  constructor({
    settingsDocumentRepository = SettingsDocumentRepository.getInstance(),
    keyMaterialRepository = KeyMaterialRepository.getInstance(),
  } = {}) {
    this.settingsDocumentRepository = settingsDocumentRepository;
    this.keyMaterialRepository = keyMaterialRepository;
    this.filterSettingsCache = null;
    this.domainHmacSecretCache = null;
    this.keyMaterialRepository.onLock?.(() => {
      this.domainHmacSecretCache = null;
      clearDomainHmacKeyCache();
    });
  }

  static getInstance() {
    if (!SettingsPersistenceCapability.instance) {
      SettingsPersistenceCapability.instance = new SettingsPersistenceCapability();
    }
    return SettingsPersistenceCapability.instance;
  }

  async get(defaults = {}) {
    if (defaults === null) {
      throw createSettingsBoundaryError(SETTINGS_BOUNDARY_ERROR_CODES.FULL_SNAPSHOT_FORBIDDEN);
    }

    const requested = isPlainObject(defaults) ? defaults : {};
    const requestedKeys = Object.keys(requested);
    if (!requestedKeys.length) return {};
    assertKnownSettingsKeys(requested);

    const { settingsItems, keyItems } = partitionStoragePayload(requested);
    const settingsValues = Object.keys(settingsItems).length > 0
      ? await this.settingsDocumentRepository.get(settingsItems)
      : {};

    const keyValues = {};
    await Promise.all(Object.keys(keyItems).map(async (flatKey) => {
      const storageKey = resolveKeyStoreStorageKey(flatKey);
      if (!storageKey) {
        keyValues[flatKey] = requested[flatKey];
        return;
      }
      const storedValue = flatKey === DOMAIN_HMAC_SECRET_KEY
        ? await this.keyMaterialRepository.getDomainHmacSecret()
        : await this.keyMaterialRepository.get(storageKey);
      keyValues[flatKey] = flatKey === DOMAIN_HMAC_SECRET_KEY
        && storedValue !== null
        && typeof storedValue !== 'undefined'
        ? requireCanonicalDomainHmacSecret(storedValue)
        : storedValue;
    }));

    const resolved = {};
    requestedKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(settingsValues, key)) {
        resolved[key] = settingsValues[key];
        return;
      }
      if (Object.prototype.hasOwnProperty.call(keyValues, key)) {
        resolved[key] = keyValues[key];
        return;
      }
      resolved[key] = requested[key];
    });

    return resolved;
  }

  invalidateFilterSettingsCache() {
    this.filterSettingsCache = null;
  }

  async getFilterSettings() {
    if (this.filterSettingsCache) return this.filterSettingsCache;
    const items = await this.get({ filterSettings: CONFIG_DEFAULT_FILTER_SETTINGS });
    const next = requireSettingsStoredValue('filterSettings', items.filterSettings);
    this.filterSettingsCache = next;
    return next;
  }

  updateLocalCachesFromPayload(payload = {}) {
    if (Object.prototype.hasOwnProperty.call(payload, 'filterSettings')) {
      this.filterSettingsCache = assertPlainSettingsValue('filterSettings', payload.filterSettings);
    }
    if (Object.prototype.hasOwnProperty.call(payload, DOMAIN_HMAC_SECRET_KEY)) {
      const secret = payload[DOMAIN_HMAC_SECRET_KEY];
      this.domainHmacSecretCache = secret === null || typeof secret === 'undefined'
        ? null
        : requireCanonicalDomainHmacSecret(secret);
    }
  }

  async set(items = {}) {
    const payload = isPlainObject(items) ? items : {};
    const payloadKeys = Object.keys(payload);
    if (!payloadKeys.length) return [];
    assertKnownSettingsKeys(payload);
    for (const [key, value] of Object.entries(payload)) {
      if (resolveSettingsDocumentKey(key)) requireSettingsStoredValue(key, value);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'filterSettings')) {
      assertPlainSettingsValue('filterSettings', payload.filterSettings);
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, DOMAIN_HMAC_SECRET_KEY)
      && payload[DOMAIN_HMAC_SECRET_KEY] !== null
      && typeof payload[DOMAIN_HMAC_SECRET_KEY] !== 'undefined'
    ) {
      requireCanonicalDomainHmacSecret(payload[DOMAIN_HMAC_SECRET_KEY]);
    }

    const { settingsItems, keyItems } = partitionStoragePayload(payload);
    const keyDefaults = Object.fromEntries(Object.keys(keyItems).map((key) => [key, undefined]));
    // Validate existing key material before any document can commit. Settings
    // changes are decided by the document writer's own serialized read instead.
    const currentKeyValues = await this.get(keyDefaults);
    const keyPayload = {};
    Object.entries(keyItems).forEach(([key, value]) => {
      if (!areValuesEqual(currentKeyValues[key], value)) keyPayload[key] = value;
    });
    const receipt = Object.keys(settingsItems).length > 0
      ? await this.settingsDocumentRepository.commitItems(settingsItems)
      : { changedKeys: [], previousItems: {} };
    const documentChangedKeys = new Set(receipt.changedKeys);
    const changedKeys = [];
    payloadKeys.forEach((key) => {
      if (!documentChangedKeys.has(key) && !Object.prototype.hasOwnProperty.call(keyPayload, key)) return;
      changedKeys.push(key);
      const previous = receipt.previousItems[key];
      const value = payload[key];
      if (BOOTSTRAP_HOST_SETTING_KEYS.has(key) && isPlainObject(previous) && isPlainObject(value)) {
        const domains = [...new Set([...Object.keys(previous), ...Object.keys(value)])]
          .filter((domain) => !areValuesEqual(previous[domain], value[domain]));
        changedKeys.push(createBootstrapHostChangedKey(key, domains));
      }
    });

    if (!changedKeys.length) {
      this.updateLocalCachesFromPayload(payload);
      return [];
    }

    await Promise.all(Object.entries(keyPayload).map(([flatKey, value]) => {
      const storageKey = resolveKeyStoreStorageKey(flatKey);
      return storageKey ? this.keyMaterialRepository.set(storageKey, value) : Promise.resolve();
    }));

    this.updateLocalCachesFromPayload(payload);

    return changedKeys;
  }

  async setFilterSettings(filterSettings, { changedFeatureKeys = [] } = {}) {
    const nextFilterSettings = assertPlainSettingsValue('filterSettings', filterSettings);
    const changedKeys = await this.set({ filterSettings: nextFilterSettings });
    if (!Array.isArray(changedKeys) || !changedKeys.includes('filterSettings')) {
      return changedKeys;
    }

    const featureChangedSettingKeys = Array.from(
      new Set(
        (Array.isArray(changedFeatureKeys) ? changedFeatureKeys : [])
          .map((featureKey) => toFilterSettingsFeatureChangedKey(featureKey))
          .filter(Boolean),
      ),
    );

    return Array.from(new Set([
      ...changedKeys,
      ...featureChangedSettingKeys,
    ]));
  }

  async getDomainHmacSecret() {
    // Setup owns creation; reads require protection admission, including log-locked profiles.
    const existing = await this.keyMaterialRepository.getDomainHmacSecret();
    this.domainHmacSecretCache = requireCanonicalDomainHmacSecret(existing);
    return this.domainHmacSecretCache;
  }

  async syncDomainHashArtifacts(partialItems = {}) {
    const payload = partialItems && typeof partialItems === 'object' ? partialItems : {};
    const keys = Object.keys(payload);
    if (!keys.length) return;

    const hasDomainKeys = (
      Object.prototype.hasOwnProperty.call(payload, 'blockedUrls')
      || Object.prototype.hasOwnProperty.call(payload, 'allowedUrls')
      || Object.prototype.hasOwnProperty.call(payload, 'siteGoals')
    );
    if (!hasDomainKeys) return;

    const secret = await this.getDomainHmacSecret();
    const hashPayload = {};

    if (Object.prototype.hasOwnProperty.call(payload, 'blockedUrls')) {
      hashPayload[BLOCKED_HASHES_KEY] = await hashDomainList(
        normalizeUrlList(payload.blockedUrls, []),
        secret,
      );
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'allowedUrls')) {
      hashPayload[ALLOWED_HASHES_KEY] = await hashDomainList(
        normalizeUrlList(payload.allowedUrls, []),
        secret,
      );
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'siteGoals')) {
      hashPayload[SITE_GOAL_HASHES_KEY] = await hashDomainValueMap(
        normalizeSiteGoals(payload.siteGoals),
        secret,
      );
    }

    if (Object.keys(hashPayload).length > 0) {
      await this.set(hashPayload);
    }
  }

  async setDomainItemsWithHashArtifacts(domainItems = {}) {
    const payload = domainItems && typeof domainItems === 'object' ? domainItems : {};
    const keys = Object.keys(payload);
    if (!keys.length) return [];

    const mergedPayload = await this.buildDomainItemsWithHashArtifacts(payload);
    return this.set(mergedPayload);
  }

  async buildDomainItemsWithHashArtifacts(domainItems = {}) {
    const payload = domainItems && typeof domainItems === 'object' ? domainItems : {};
    const keys = Object.keys(payload);
    if (!keys.length) return {};

    const secret = await this.getDomainHmacSecret();
    const mergedPayload = {
      ...payload,
      [DOMAIN_HMAC_SECRET_KEY]: secret,
    };

    if (Object.prototype.hasOwnProperty.call(payload, 'blockedUrls')) {
      mergedPayload[BLOCKED_HASHES_KEY] = await hashDomainList(
        normalizeUrlList(payload.blockedUrls, []),
        secret,
      );
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'allowedUrls')) {
      mergedPayload[ALLOWED_HASHES_KEY] = await hashDomainList(
        normalizeUrlList(payload.allowedUrls, []),
        secret,
      );
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'siteGoals')) {
      mergedPayload[SITE_GOAL_HASHES_KEY] = await hashDomainValueMap(
        normalizeSiteGoals(payload.siteGoals),
        secret,
      );
    }

    return mergedPayload;
  }

  async applyPatch(items = {}, { emitSettingsUpdated = true } = {}) {
    void emitSettingsUpdated;
    const payload = isPlainObject(items) ? items : {};
    const payloadKeys = Object.keys(payload);
    if (!payloadKeys.length) return [];
    assertKnownSettingsKeys(payload);

    const domainPayload = {};
    const standardPayload = {};
    const nextChangedKeys = new Set();
    const hasFilterSettings = Object.prototype.hasOwnProperty.call(payload, 'filterSettings');
    const filterSettingsPayload = hasFilterSettings
      ? assertPlainSettingsValue('filterSettings', payload.filterSettings)
      : null;

    payloadKeys.forEach((key) => {
      if (key === 'filterSettings') {
        return;
      }
      if (DOMAIN_RULE_SETTING_KEYS.has(key)) {
        domainPayload[key] = payload[key];
        return;
      }
      standardPayload[key] = payload[key];
    });

    const currentFilterSettings = hasFilterSettings
      ? await this.getFilterSettings()
      : null;
    const changedFeatureKeys = hasFilterSettings
      ? collectChangedFilterFeatureKeys(currentFilterSettings, filterSettingsPayload)
      : [];
    const domainStoragePayload = Object.keys(domainPayload).length > 0
      ? await this.buildDomainItemsWithHashArtifacts(domainPayload)
      : {};
    const storagePayload = {
      ...domainStoragePayload,
      ...(hasFilterSettings ? { filterSettings: filterSettingsPayload } : {}),
      ...standardPayload,
    };
    const physicalChangedKeys = await this.set(storagePayload);
    const physicalChangedKeySet = new Set(physicalChangedKeys);

    payloadKeys.forEach((key) => {
      if (physicalChangedKeySet.has(key)) nextChangedKeys.add(key);
    });
    physicalChangedKeys.filter(isBootstrapHostChangedKey).forEach((key) => nextChangedKeys.add(key));
    if (nextChangedKeys.has('filterSettings')) {
      changedFeatureKeys.forEach((featureKey) => {
        nextChangedKeys.add(toFilterSettingsFeatureChangedKey(featureKey));
      });
    }

    return Array.from(nextChangedKeys);
  }

  async ensureDomainHashArtifacts() {
    const items = await this.get({
      blockedUrls: [],
      allowedUrls: [],
      siteGoals: {},
      [DOMAIN_HMAC_SECRET_KEY]: undefined,
      [BLOCKED_HASHES_KEY]: undefined,
      [ALLOWED_HASHES_KEY]: undefined,
      [SITE_GOAL_HASHES_KEY]: undefined,
    });
    const storedSecret = items?.[DOMAIN_HMAC_SECRET_KEY];
    const missingSecret = storedSecret === null || typeof storedSecret === 'undefined';
    if (!missingSecret) {
      this.domainHmacSecretCache = requireCanonicalDomainHmacSecret(storedSecret);
    }

    const missingBlockedHashes = !Array.isArray(items?.[BLOCKED_HASHES_KEY]);
    const missingAllowedHashes = !Array.isArray(items?.[ALLOWED_HASHES_KEY]);
    const missingGoalHashes = !isPlainObject(items?.[SITE_GOAL_HASHES_KEY]);

    const needsRepair = (
      missingSecret
      || missingBlockedHashes
      || missingAllowedHashes
      || missingGoalHashes
    );

    if (!needsRepair) return false;

    await this.syncDomainHashArtifacts({
      blockedUrls: normalizeUrlList(items?.blockedUrls, []),
      allowedUrls: normalizeUrlList(items?.allowedUrls, []),
      siteGoals: normalizeSiteGoals(items?.siteGoals),
    });
    return true;
  }
}

export default SettingsPersistenceCapability;
