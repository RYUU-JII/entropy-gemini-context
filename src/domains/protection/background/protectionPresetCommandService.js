import {
  DEFAULT_PROTECTION_PRESET_ASSIGNMENTS,
  DEFAULT_PROTECTION_PRESET_ID,
  PROTECTION_PRESET_KINDS,
  isBuiltinProtectionPresetId,
  normalizeProtectionPresetAssignments,
  normalizeProtectionPresetCatalog,
  normalizeProtectionPresetDefinition,
  normalizeProtectionPresetId,
} from '../catalog/presetContract.js';
import {
  buildResolvedProtectionPresetCatalog,
  cloneProtectionPresetDefinition,
  generateUniqueProtectionPresetId,
} from '../catalog/presetCatalog.js';
import { completeSettingsOwnerAcknowledgement } from '../../settings/config/settingsCommitAcknowledgement.js';

function createProtectionPresetCommandError(code, extra = {}) {
  const message = typeof code === 'string' && code.trim()
    ? code.trim()
    : 'PROTECTION_PRESET_COMMAND_FAILED';
  const error = new Error(message);
  error.code = message;
  Object.assign(error, extra);
  return error;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function areValuesEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      if (!areValuesEqual(a[index], b[index])) return false;
    }
    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let index = 0; index < aKeys.length; index += 1) {
      const key = aKeys[index];
      if (key !== bKeys[index]) return false;
      if (!areValuesEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

function buildNoopCommandResult(extra = {}) {
  return {
    changedKeys: [],
    version: null,
    applied: {
      refreshed: false,
      syncScripts: false,
      broadcast: false,
    },
    items: {},
    ...extra,
  };
}

export function createProtectionPresetCommandService({
  settingsService,
} = {}) {
  if (!settingsService || typeof settingsService.commitSettingsMutation !== 'function') {
    throw new Error('PROTECTION_PRESET_COMMAND_SETTINGS_SERVICE_REQUIRED');
  }

  function readCustomCatalog(settingsCache) {
    return normalizeProtectionPresetCatalog(settingsCache.protectionPresetCatalog);
  }

  function readResolvedCatalog(settingsCache) {
    return buildResolvedProtectionPresetCatalog(settingsCache.protectionPresetCatalog);
  }

  function readAssignments(settingsCache) {
    return normalizeProtectionPresetAssignments(settingsCache.protectionPresetAssignments);
  }

  async function applyProtectionPresetChange({
    actionReason,
    acknowledgementKeys = [],
    prepare,
    sender,
    buildExtra = () => ({}),
  }) {
    let settingsSnapshot = null;
    let preparedItems = null;
    const result = await settingsService.commitSettingsMutation({
      actionReason,
      prepare: (snapshot) => {
        settingsSnapshot = snapshot;
        preparedItems = prepare(snapshot);
        return preparedItems;
      },
      sender,
      emitSettingsUpdated: false,
      invalidateFilterCache: true,
      refreshForBroadcast: false,
      reportBroadcastAsRefresh: false,
    });
    return {
      ...result,
      items: completeSettingsOwnerAcknowledgement({
        committedItems: result?.committedItems,
        requiredCommittedKeys: Object.keys(isPlainObject(preparedItems) ? preparedItems : {}),
        settingsSnapshot,
        acknowledgementKeys,
      }),
      ...buildExtra(),
    };
  }

  async function createProtectionPreset({
    label = '',
    sourcePresetId = '',
    sender = null,
    actionReason = 'create_protection_preset',
  } = {}) {
    let createdPreset = null;

    return applyProtectionPresetChange({
      actionReason,
      acknowledgementKeys: ['protectionPresetCatalog'],
      prepare: (settingsCache) => {
        const currentCatalog = readCustomCatalog(settingsCache);
        const currentAssignments = readAssignments(settingsCache);
        const resolvedCatalog = readResolvedCatalog(settingsCache);
        const hasExplicitSource = typeof sourcePresetId === 'string' && !!sourcePresetId.trim();
        const explicitSourceId = hasExplicitSource
          ? normalizeProtectionPresetId(sourcePresetId, '')
          : '';
        if (hasExplicitSource && (!explicitSourceId || !resolvedCatalog[explicitSourceId])) {
          throw createProtectionPresetCommandError('PROTECTION_PRESET_NOT_FOUND', {
            presetId: explicitSourceId || sourcePresetId.trim(),
          });
        }
        const basePresetId = explicitSourceId
          || currentAssignments.globalPresetId
          || DEFAULT_PROTECTION_PRESET_ID;
        const basePreset = resolvedCatalog[basePresetId];
        if (!basePreset) {
          throw createProtectionPresetCommandError('PROTECTION_PRESET_NOT_FOUND', {
            presetId: basePresetId,
          });
        }
        const nextLabel = typeof label === 'string' && label.trim()
          ? label.trim()
          : `${basePreset.label} Copy`;
        const nextId = generateUniqueProtectionPresetId(currentCatalog, nextLabel);
        createdPreset = cloneProtectionPresetDefinition(basePreset, {
          presetId: nextId,
          label: nextLabel,
        });

        if (!createdPreset) {
          throw createProtectionPresetCommandError('PROTECTION_PRESET_CREATE_FAILED');
        }
        return {
          protectionPresetCatalog: {
            ...currentCatalog,
            [createdPreset.id]: createdPreset,
          },
        };
      },
      sender,
      buildExtra: () => ({
        preset: createdPreset,
        presetId: createdPreset?.id || '',
      }),
    });
  }

  async function updateProtectionPreset({
    presetId = '',
    patch = {},
    sender = null,
    actionReason = 'update_protection_preset',
  } = {}) {
    const rawPresetId = typeof presetId === 'string' ? presetId.trim() : '';
    const normalizedPresetId = normalizeProtectionPresetId(rawPresetId);
    if (!rawPresetId || !normalizedPresetId) {
      throw createProtectionPresetCommandError('INVALID_PROTECTION_PRESET_ID');
    }
    if (isBuiltinProtectionPresetId(normalizedPresetId)) {
      throw createProtectionPresetCommandError('PROTECTION_PRESET_BUILTIN_READONLY', {
        presetId: normalizedPresetId,
      });
    }

    let updatedPreset = null;

    return applyProtectionPresetChange({
      actionReason,
      acknowledgementKeys: ['protectionPresetCatalog'],
      prepare: (settingsCache) => {
        const currentCatalog = readCustomCatalog(settingsCache);
        const current = currentCatalog[normalizedPresetId];
        if (!current) {
          throw createProtectionPresetCommandError('PROTECTION_PRESET_NOT_FOUND', {
            presetId: normalizedPresetId,
          });
        }

        updatedPreset = normalizeProtectionPresetDefinition({
          ...current,
          ...(isPlainObject(patch) ? patch : {}),
          id: normalizedPresetId,
          kind: PROTECTION_PRESET_KINDS.CUSTOM,
        }, {
          fallbackId: normalizedPresetId,
          fallbackKind: PROTECTION_PRESET_KINDS.CUSTOM,
        });

        if (!updatedPreset) {
          throw createProtectionPresetCommandError('PROTECTION_PRESET_UPDATE_FAILED', {
            presetId: normalizedPresetId,
          });
        }
        if (areValuesEqual(current, updatedPreset)) return {};
        return {
          protectionPresetCatalog: {
            ...currentCatalog,
            [normalizedPresetId]: updatedPreset,
          },
        };
      },
      sender,
      buildExtra: () => ({
        preset: updatedPreset,
        presetId: normalizedPresetId,
      }),
    });
  }

  async function deleteProtectionPreset({
    presetId = '',
    sender = null,
    actionReason = 'delete_protection_preset',
  } = {}) {
    const rawPresetId = typeof presetId === 'string' ? presetId.trim() : '';
    const normalizedPresetId = normalizeProtectionPresetId(rawPresetId);
    if (!rawPresetId || !normalizedPresetId || isBuiltinProtectionPresetId(normalizedPresetId)) {
      return buildNoopCommandResult({
        presetId: normalizedPresetId || '',
        deleted: false,
      });
    }

    let deleted = false;

    return applyProtectionPresetChange({
      actionReason,
      acknowledgementKeys: [
        'protectionPresetCatalog',
        'protectionPresetAssignments',
      ],
      prepare: (settingsCache) => {
        const currentCatalog = readCustomCatalog(settingsCache);
        if (!currentCatalog[normalizedPresetId]) return {};
        deleted = true;
        const nextCatalog = { ...currentCatalog };
        delete nextCatalog[normalizedPresetId];

        const currentAssignments = readAssignments(settingsCache);
        const nextSitePresetIds = Object.fromEntries(
          Object.entries(currentAssignments.sitePresetIds || {}).filter(([, value]) => value !== normalizedPresetId),
        );
        const nextAssignments = normalizeProtectionPresetAssignments({
          ...currentAssignments,
          globalPresetId: currentAssignments.globalPresetId === normalizedPresetId
            ? DEFAULT_PROTECTION_PRESET_ASSIGNMENTS.globalPresetId
            : currentAssignments.globalPresetId,
          sitePresetIds: nextSitePresetIds,
        });

        const items = {
          protectionPresetCatalog: nextCatalog,
        };
        if (!areValuesEqual(currentAssignments, nextAssignments)) {
          items.protectionPresetAssignments = nextAssignments;
        }
        return items;
      },
      sender,
      buildExtra: () => ({
        presetId: normalizedPresetId,
        deleted,
      }),
    });
  }

  async function assignGlobalProtectionPreset({
    presetId = '',
    sender = null,
    actionReason = 'assign_global_protection_preset',
  } = {}) {
    const rawPresetId = typeof presetId === 'string' ? presetId.trim() : '';
    const normalizedPresetId = normalizeProtectionPresetId(rawPresetId, '');
    if (rawPresetId && !normalizedPresetId) {
      throw createProtectionPresetCommandError('INVALID_PROTECTION_PRESET_ID');
    }

    const nextGlobalPresetId = normalizedPresetId || DEFAULT_PROTECTION_PRESET_ASSIGNMENTS.globalPresetId;

    return applyProtectionPresetChange({
      actionReason,
      acknowledgementKeys: ['protectionPresetAssignments'],
      prepare: (settingsCache) => {
        const resolvedCatalog = readResolvedCatalog(settingsCache);
        if (!resolvedCatalog[nextGlobalPresetId]) {
          throw createProtectionPresetCommandError('PROTECTION_PRESET_NOT_FOUND', {
            presetId: nextGlobalPresetId,
          });
        }

        const currentAssignments = readAssignments(settingsCache);
        const nextAssignments = normalizeProtectionPresetAssignments({
          ...currentAssignments,
          globalPresetId: nextGlobalPresetId,
        });
        if (areValuesEqual(currentAssignments, nextAssignments)) return {};
        return {
          protectionPresetAssignments: nextAssignments,
        };
      },
      sender,
      buildExtra: () => ({
        presetId: nextGlobalPresetId,
        assignedPresetId: nextGlobalPresetId,
      }),
    });
  }

  return {
    assignGlobalProtectionPreset,
    createProtectionPreset,
    deleteProtectionPreset,
    updateProtectionPreset,
  };
}

export default createProtectionPresetCommandService;
