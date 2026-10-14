import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal,
} from '../localArea.js';
import {
  EARLY_APPLY_RUNTIME_FILTER_KEYS,
  EARLY_APPLY_VISUAL_FILTER_KEYS,
} from '../../../../../domains/settings/config/frictionPipeline.js';
import { buildRootVisualFilterValue, isAdaptiveFrictionFeatureKey, requireAdaptiveFrictionEntry } from '../../../../../domains/settings/config/index.js';
import { normalizeRulesMode } from '../../../../../domains/settings/config/siteRules.js';
import {
  STORAGE_LOCAL_CACHE_KEYS,
} from '../storageKeyRegistry.js';
import {
  isPlainObject,
} from '../../storageValueUtils.js';

export const FRICTION_BOOTSTRAP_SCHEMA_VERSION = 1;
export const FRICTION_ROOT_VISUAL_SCHEMA_VERSION = 1;
export const FRICTION_BOOTSTRAP_CACHE_GENERATION = 7;
export const DEFAULT_FRICTION_BOOTSTRAP_TTL_MS = 10 * 60_000;

const CACHE_GENERATION_STORAGE_KEY = STORAGE_LOCAL_CACHE_KEYS.BOOTSTRAP_CACHE_GENERATION;
const STORAGE_KEY = STORAGE_LOCAL_CACHE_KEYS.BOOTSTRAP_FRICTION;
const ROOT_VISUAL_STORAGE_KEY = STORAGE_LOCAL_CACHE_KEYS.BOOTSTRAP_ROOT_VISUAL;
const MAX_HOST_ENTRIES = 24;
const MAX_SERIALIZED_BYTES = 48 * 1024;
const MAX_ROOT_VISUAL_SERIALIZED_BYTES = 24 * 1024;
const VISUAL_FILTER_KEYS = Array.from(EARLY_APPLY_VISUAL_FILTER_KEYS);
const RUNTIME_FILTER_KEYS = Array.from(EARLY_APPLY_RUNTIME_FILTER_KEYS);

function createBootstrapSnapshotContractError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toFiniteNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function cloneJsonValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return null;
  }
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return actualKeys.length === sortedExpectedKeys.length
    && actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
}

function areJsonValuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((entry, index) => areJsonValuesEqual(entry, right[index]));
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

function normalizeFeatureEntry(entry, key) {
  if (!isPlainObject(entry)) return null;

  if (isAdaptiveFrictionFeatureKey(key)) {
    requireAdaptiveFrictionEntry(key, entry);
    // Preserve the selected profile and modifier arbitration evidence. The
    // bootstrap path must not reinterpret a compiled plan as user settings.
    return cloneJsonValue(entry);
  }

  const normalized = {
    isActive: entry.isActive === true,
  };

  if (Object.prototype.hasOwnProperty.call(entry, 'value')) {
    normalized.value = cloneJsonValue(entry.value);
  } else {
    normalized.value = null;
  }

  const step = toFiniteNumber(entry.step, null);
  if (step !== null) {
    normalized.step = Math.max(0, Math.floor(step));
  }

  const level = toFiniteNumber(entry.level, null);
  if (level !== null) {
    normalized.level = Math.max(0, Math.floor(level));
  }

  return normalized;
}

function normalizeDecision(decision) {
  const source = isPlainObject(decision) ? decision : {};
  return {
    shouldApply: source.shouldApply === true,
    isBlockedDomain: source.isBlockedDomain === true,
    reason: typeof source.reason === 'string' && source.reason.trim()
      ? source.reason.trim()
      : null,
    rulesMode: normalizeRulesMode(source.rulesMode),
    filteringMode: typeof source.filteringMode === 'string' && source.filteringMode.trim()
      ? source.filteringMode.trim()
      : null,
  };
}

function normalizeVisualFilters(visual) {
  const source = isPlainObject(visual?.filters) ? visual.filters : {};
  return VISUAL_FILTER_KEYS.reduce((acc, key) => {
    acc[key] = normalizeFeatureEntry(source[key], key);
    return acc;
  }, {});
}

function normalizeRuntimeFilters(runtime) {
  const source = isPlainObject(runtime) ? runtime : {};
  return RUNTIME_FILTER_KEYS.reduce((acc, key) => {
    acc[key] = normalizeFeatureEntry(source[key], key);
    return acc;
  }, {});
}

function normalizeMeta(meta) {
  const source = isPlainObject(meta) ? meta : {};
  const themeId = typeof source.themeId === 'string' && source.themeId.trim()
    ? source.themeId.trim()
    : null;
  const styleVariant = typeof source.styleVariant === 'string' && source.styleVariant.trim()
    ? source.styleVariant.trim()
    : null;
  return {
    source: typeof source.source === 'string' && source.source.trim()
      ? source.source.trim()
      : 'background-protection-runtime',
    revision: Math.max(0, Math.floor(toFiniteNumber(source.revision, 0) || 0)),
    themeId,
    styleVariant,
  };
}

function normalizeSnapshotEntry(rawSnapshot, {
  hostname = '',
  now = Date.now(),
  requireCanonical = false,
} = {}) {
  if (!isPlainObject(rawSnapshot)) {
    throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_SNAPSHOT_INVALID');
  }

  const schemaVersion = Math.floor(toFiniteNumber(rawSnapshot.schemaVersion, 0) || 0);
  if (schemaVersion !== FRICTION_BOOTSTRAP_SCHEMA_VERSION) {
    throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_SCHEMA_VERSION_UNSUPPORTED');
  }

  const snapshotHostname = normalizeHostname(rawSnapshot?.host?.hostname);
  if (!snapshotHostname) {
    throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_HOSTNAME_REQUIRED');
  }

  const expectedHostname = normalizeHostname(hostname);
  if (expectedHostname && expectedHostname !== snapshotHostname) return null;

  const generatedAtEpochMs = toFiniteNumber(rawSnapshot.generatedAtEpochMs, null);
  const staleAfterEpochMs = toFiniteNumber(rawSnapshot.staleAfterEpochMs, null);
  if (generatedAtEpochMs === null || generatedAtEpochMs <= 0) {
    throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_GENERATED_AT_INVALID');
  }
  if (staleAfterEpochMs === null || staleAfterEpochMs <= generatedAtEpochMs) {
    throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_STALE_AFTER_INVALID');
  }

  const normalized = {
    schemaVersion: FRICTION_BOOTSTRAP_SCHEMA_VERSION,
    generatedAtEpochMs,
    staleAfterEpochMs,
    host: {
      hostname: snapshotHostname,
    },
    decision: normalizeDecision(rawSnapshot.decision),
    visual: {
      filters: normalizeVisualFilters(rawSnapshot.visual),
    },
    runtime: normalizeRuntimeFilters(rawSnapshot.runtime),
    meta: normalizeMeta(rawSnapshot.meta),
  };
  if (requireCanonical && !areJsonValuesEqual(rawSnapshot, normalized)) {
    throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_SNAPSHOT_CONTRACT_INVALID');
  }
  if (Number.isFinite(Number(now)) && Number(now) > staleAfterEpochMs) {
    return null;
  }
  return normalized;
}

function normalizeSnapshotEntries(rawContainer, now = Date.now()) {
  if (rawContainer === null || typeof rawContainer === 'undefined') return {};
  if (!isPlainObject(rawContainer)) {
    throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_CONTAINER_INVALID');
  }
  if (rawContainer.schemaVersion !== FRICTION_BOOTSTRAP_SCHEMA_VERSION) {
    throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_CONTAINER_VERSION_UNSUPPORTED');
  }
  if (!isPlainObject(rawContainer.entries)) {
    throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_ENTRIES_INVALID');
  }
  if (!hasExactKeys(rawContainer, ['schemaVersion', 'entries'])) {
    throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_CONTAINER_CONTRACT_INVALID');
  }

  const entriesSource = rawContainer.entries;
  const normalized = {};

  Object.entries(entriesSource).forEach(([entryKey, entry]) => {
    const normalizedEntryKey = normalizeHostname(entryKey);
    if (!normalizedEntryKey || normalizedEntryKey !== entryKey) {
      throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_ENTRY_KEY_INVALID');
    }
    const storedHostname = normalizeHostname(entry?.host?.hostname);
    if (storedHostname !== normalizedEntryKey) {
      throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_ENTRY_KEY_MISMATCH');
    }
    const nextEntry = normalizeSnapshotEntry(entry, { now, requireCanonical: true });
    if (!nextEntry) return;
    normalized[nextEntry.host.hostname] = nextEntry;
  });

  return normalized;
}

function buildContainer(entries = {}) {
  return {
    schemaVersion: FRICTION_BOOTSTRAP_SCHEMA_VERSION,
    entries,
  };
}

function estimateSerializedBytes(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch (_) {
    return Infinity;
  }
}

function boundEntries(entries = {}, maxBytes = MAX_SERIALIZED_BYTES, build = buildContainer) {
  const sortedEntries = Object.values(isPlainObject(entries) ? entries : {})
    .sort((a, b) => b.generatedAtEpochMs - a.generatedAtEpochMs)
    .slice(0, MAX_HOST_ENTRIES);
  const boundedEntries = {};

  sortedEntries.forEach((entry) => {
    boundedEntries[entry.host.hostname] = entry;
  });

  while (Object.keys(boundedEntries).length > 0) {
    if (estimateSerializedBytes(build(boundedEntries)) <= maxBytes) {
      return boundedEntries;
    }

    const oldestHost = Object.values(boundedEntries)
      .sort((a, b) => a.generatedAtEpochMs - b.generatedAtEpochMs)[0]
      ?.host?.hostname;
    if (!oldestHost) break;
    delete boundedEntries[oldestHost];
  }

  return boundedEntries;
}

function buildRootVisualFilter(snapshot) {
  return buildRootVisualFilterValue(snapshot?.visual?.filters);
}

function buildRootVisualSnapshot(snapshot) {
  if (!snapshot) return null;

  return {
    schemaVersion: FRICTION_ROOT_VISUAL_SCHEMA_VERSION,
    generatedAtEpochMs: snapshot.generatedAtEpochMs,
    staleAfterEpochMs: snapshot.staleAfterEpochMs,
    host: {
      hostname: snapshot.host.hostname,
    },
    decision: {
      shouldApply: snapshot?.decision?.shouldApply === true,
    },
    rootFilter: buildRootVisualFilter(snapshot),
    visualFilters: normalizeVisualFilters(snapshot.visual),
    meta: normalizeMeta(snapshot.meta),
  };
}

function normalizeRootVisualEntry(rawEntry, {
  hostname = '',
  now = Date.now(),
  requireCanonical = false,
} = {}) {
  if (!isPlainObject(rawEntry)) {
    throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_SNAPSHOT_INVALID');
  }

  const schemaVersion = Math.floor(toFiniteNumber(rawEntry.schemaVersion, 0) || 0);
  if (schemaVersion !== FRICTION_ROOT_VISUAL_SCHEMA_VERSION) {
    throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_SCHEMA_VERSION_UNSUPPORTED');
  }

  const snapshotHostname = normalizeHostname(rawEntry?.host?.hostname);
  if (!snapshotHostname) {
    throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_HOSTNAME_REQUIRED');
  }

  const expectedHostname = normalizeHostname(hostname);
  if (expectedHostname && expectedHostname !== snapshotHostname) return null;

  const generatedAtEpochMs = toFiniteNumber(rawEntry.generatedAtEpochMs, null);
  const staleAfterEpochMs = toFiniteNumber(rawEntry.staleAfterEpochMs, null);
  if (generatedAtEpochMs === null || generatedAtEpochMs <= 0) {
    throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_GENERATED_AT_INVALID');
  }
  if (staleAfterEpochMs === null || staleAfterEpochMs <= generatedAtEpochMs) {
    throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_STALE_AFTER_INVALID');
  }

  const rootFilter = typeof rawEntry.rootFilter === 'string'
    ? rawEntry.rootFilter.trim().replace(/\s+/g, ' ')
    : '';

  const normalized = {
    schemaVersion: FRICTION_ROOT_VISUAL_SCHEMA_VERSION,
    generatedAtEpochMs,
    staleAfterEpochMs,
    host: {
      hostname: snapshotHostname,
    },
    decision: {
      shouldApply: rawEntry?.decision?.shouldApply === true,
    },
    rootFilter,
    visualFilters: normalizeVisualFilters({ filters: rawEntry.visualFilters }),
    meta: normalizeMeta(rawEntry.meta),
  };
  if (requireCanonical && !areJsonValuesEqual(rawEntry, normalized)) {
    throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_SNAPSHOT_CONTRACT_INVALID');
  }
  if (Number.isFinite(Number(now)) && Number(now) > staleAfterEpochMs) {
    return null;
  }
  return normalized;
}

function normalizeRootVisualEntries(rawContainer, now = Date.now()) {
  if (rawContainer === null || typeof rawContainer === 'undefined') return {};
  if (!isPlainObject(rawContainer)) {
    throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_CONTAINER_INVALID');
  }
  if (rawContainer.schemaVersion !== FRICTION_ROOT_VISUAL_SCHEMA_VERSION) {
    throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_CONTAINER_VERSION_UNSUPPORTED');
  }
  if (!isPlainObject(rawContainer.entries)) {
    throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_ENTRIES_INVALID');
  }
  if (!hasExactKeys(rawContainer, ['schemaVersion', 'entries'])) {
    throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_CONTAINER_CONTRACT_INVALID');
  }

  const entriesSource = rawContainer.entries;
  const normalized = {};

  Object.entries(entriesSource).forEach(([entryKey, entry]) => {
    const normalizedEntryKey = normalizeHostname(entryKey);
    if (!normalizedEntryKey || normalizedEntryKey !== entryKey) {
      throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_ENTRY_KEY_INVALID');
    }
    const storedHostname = normalizeHostname(entry?.host?.hostname);
    if (storedHostname !== normalizedEntryKey) {
      throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_ENTRY_KEY_MISMATCH');
    }
    const nextEntry = normalizeRootVisualEntry(entry, { now, requireCanonical: true });
    if (!nextEntry) return;
    normalized[nextEntry.host.hostname] = nextEntry;
  });

  return normalized;
}

function buildRootVisualContainer(entries = {}) {
  return {
    schemaVersion: FRICTION_ROOT_VISUAL_SCHEMA_VERSION,
    entries,
  };
}

export class BootstrapSnapshotStore {
  static getInstance() {
    if (!BootstrapSnapshotStore.instance) {
      BootstrapSnapshotStore.instance = new BootstrapSnapshotStore();
    }
    return BootstrapSnapshotStore.instance;
  }

  constructor() {
    this.cacheGenerationPreparationResult = null;
    this.cacheGenerationPreparationPromise = null;
  }

  async _prepareCurrentCacheGeneration() {
    const items = await readChromeStorageLocal({
      [CACHE_GENERATION_STORAGE_KEY]: null,
    });
    if (items?.[CACHE_GENERATION_STORAGE_KEY] === FRICTION_BOOTSTRAP_CACHE_GENERATION) {
      return Object.freeze({
        generation: FRICTION_BOOTSTRAP_CACHE_GENERATION,
        invalidated: false,
      });
    }

    await removeChromeStorageLocal([STORAGE_KEY, ROOT_VISUAL_STORAGE_KEY]);
    await writeChromeStorageLocal({
      [CACHE_GENERATION_STORAGE_KEY]: FRICTION_BOOTSTRAP_CACHE_GENERATION,
    });
    return Object.freeze({
      generation: FRICTION_BOOTSTRAP_CACHE_GENERATION,
      invalidated: true,
    });
  }

  async prepareCurrentCacheGeneration() {
    if (this.cacheGenerationPreparationResult) {
      return this.cacheGenerationPreparationResult;
    }
    if (this.cacheGenerationPreparationPromise) {
      return this.cacheGenerationPreparationPromise;
    }
    const preparationPromise = this._prepareCurrentCacheGeneration();
    this.cacheGenerationPreparationPromise = preparationPromise;
    try {
      const result = await preparationPromise;
      this.cacheGenerationPreparationResult = result;
      return result;
    } finally {
      if (this.cacheGenerationPreparationPromise === preparationPromise) {
        this.cacheGenerationPreparationPromise = null;
      }
    }
  }

  async getFrictionSnapshot({ hostname = '', now = Date.now() } = {}) {
    const resolvedHostname = normalizeHostname(hostname);
    if (!resolvedHostname) return null;

    const items = await readChromeStorageLocal({ [STORAGE_KEY]: null });
    const entries = normalizeSnapshotEntries(items?.[STORAGE_KEY], now);
    return entries[resolvedHostname] || null;
  }

  async getRootVisualSnapshot({ hostname = '', now = Date.now() } = {}) {
    const resolvedHostname = normalizeHostname(hostname);
    if (!resolvedHostname) return null;

    const items = await readChromeStorageLocal({ [ROOT_VISUAL_STORAGE_KEY]: null });
    const entries = normalizeRootVisualEntries(items?.[ROOT_VISUAL_STORAGE_KEY], now);
    return entries[resolvedHostname] || null;
  }

  async listRootVisualSnapshots({ now = Date.now() } = {}) {
    const items = await readChromeStorageLocal({ [ROOT_VISUAL_STORAGE_KEY]: null });
    return Object.values(normalizeRootVisualEntries(items?.[ROOT_VISUAL_STORAGE_KEY], now))
      .sort((a, b) => a.host.hostname.localeCompare(b.host.hostname));
  }

  async listFrictionSnapshots({ now = Date.now() } = {}) {
    const items = await readChromeStorageLocal({ [STORAGE_KEY]: null });
    return Object.values(normalizeSnapshotEntries(items?.[STORAGE_KEY], now))
      .sort((a, b) => a.host.hostname.localeCompare(b.host.hostname));
  }

  async _setRootVisualSnapshot(snapshot) {
    const normalizedSnapshot = normalizeRootVisualEntry(snapshot, {
      hostname: snapshot?.host?.hostname,
      now: snapshot?.staleAfterEpochMs,
    });
    if (!normalizedSnapshot) {
      throw createBootstrapSnapshotContractError('FRICTION_ROOT_VISUAL_SNAPSHOT_EXPIRED');
    }

    const items = await readChromeStorageLocal({ [ROOT_VISUAL_STORAGE_KEY]: null });
    const entries = normalizeRootVisualEntries(items?.[ROOT_VISUAL_STORAGE_KEY], Date.now());
    entries[normalizedSnapshot.host.hostname] = normalizedSnapshot;

    const boundedEntries = boundEntries(
      entries,
      MAX_ROOT_VISUAL_SERIALIZED_BYTES,
      buildRootVisualContainer,
    );
    if (Object.keys(boundedEntries).length === 0) {
      await removeChromeStorageLocal(ROOT_VISUAL_STORAGE_KEY);
      return null;
    }

    await writeChromeStorageLocal({
      [ROOT_VISUAL_STORAGE_KEY]: buildRootVisualContainer(boundedEntries),
    });
    return normalizedSnapshot;
  }

  async setFrictionSnapshot(snapshot) {
    await this.prepareCurrentCacheGeneration();
    const normalizedSnapshot = normalizeSnapshotEntry(snapshot, {
      hostname: snapshot?.host?.hostname,
      now: snapshot?.staleAfterEpochMs,
    });
    if (!normalizedSnapshot) {
      throw createBootstrapSnapshotContractError('FRICTION_BOOTSTRAP_SNAPSHOT_EXPIRED');
    }

    const items = await readChromeStorageLocal({ [STORAGE_KEY]: null });
    const entries = normalizeSnapshotEntries(items?.[STORAGE_KEY], Date.now());
    entries[normalizedSnapshot.host.hostname] = normalizedSnapshot;

    const boundedEntries = boundEntries(entries);
    if (Object.keys(boundedEntries).length === 0) {
      await removeChromeStorageLocal([STORAGE_KEY, ROOT_VISUAL_STORAGE_KEY]);
      return null;
    }

    await writeChromeStorageLocal({
      [STORAGE_KEY]: buildContainer(boundedEntries),
    });
    await this._setRootVisualSnapshot(buildRootVisualSnapshot(normalizedSnapshot));
    return normalizedSnapshot;
  }

  async clearFrictionSnapshot({ hostname = '' } = {}) {
    await this.prepareCurrentCacheGeneration();
    const resolvedHostname = normalizeHostname(hostname);
    if (!resolvedHostname) {
      await removeChromeStorageLocal([STORAGE_KEY, ROOT_VISUAL_STORAGE_KEY]);
      return;
    }

    const [snapshotItems, rootVisualItems] = await Promise.all([
      readChromeStorageLocal({ [STORAGE_KEY]: null }),
      readChromeStorageLocal({ [ROOT_VISUAL_STORAGE_KEY]: null }),
    ]);

    const snapshotEntries = normalizeSnapshotEntries(snapshotItems?.[STORAGE_KEY], Date.now());
    const rootVisualEntries = normalizeRootVisualEntries(rootVisualItems?.[ROOT_VISUAL_STORAGE_KEY], Date.now());
    delete snapshotEntries[resolvedHostname];
    delete rootVisualEntries[resolvedHostname];

    if (Object.keys(snapshotEntries).length === 0 && Object.keys(rootVisualEntries).length === 0) {
      await removeChromeStorageLocal([STORAGE_KEY, ROOT_VISUAL_STORAGE_KEY]);
      return;
    }

    const writes = {};
    if (Object.keys(snapshotEntries).length === 0) {
      await removeChromeStorageLocal(STORAGE_KEY);
    } else {
      writes[STORAGE_KEY] = buildContainer(snapshotEntries);
    }

    if (Object.keys(rootVisualEntries).length === 0) {
      await removeChromeStorageLocal(ROOT_VISUAL_STORAGE_KEY);
    } else {
      writes[ROOT_VISUAL_STORAGE_KEY] = buildRootVisualContainer(rootVisualEntries);
    }

    if (Object.keys(writes).length > 0) {
      await writeChromeStorageLocal(writes);
    }
  }
}

export default BootstrapSnapshotStore;
