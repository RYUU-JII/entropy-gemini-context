import {
    assignProtocolGlobalProtectionPreset,
    createProtocolProtectionPreset,
    deleteProtocolProtectionPreset,
    updateProtocolProtectionPreset,
} from './protocolSettingsClient.js';
import { runProtocolOwnerCommand } from './protocolStoreCommands.js';
import {
    buildProtectionPresetPendingKeys,
    buildProtocolCommandResult,
} from './protocolStoreHelpers.js';

// Protection-preset domain: create/update/delete catalog presets and assign the
// global preset.
export function createProtocolPresetSlice(set, get) {
    return {
        createProtectionPreset: async ({
            label = '',
            sourcePresetId = '',
        } = {}) => {
            const pendingKeys = buildProtectionPresetPendingKeys();
            return runProtocolOwnerCommand(get, set, {
                pendingKeys,
                execute: () => createProtocolProtectionPreset({
                    label,
                    sourcePresetId,
                }),
                onSuccess: (result) => buildProtocolCommandResult(result, {
                    preset: result?.preset && typeof result.preset === 'object'
                        ? { ...result.preset }
                        : null,
                    presetId: typeof result?.presetId === 'string' ? result.presetId.trim() : '',
                }),
                onFailure: (_error, baseResult) => buildProtocolCommandResult(baseResult, {
                    preset: null,
                    presetId: '',
                }),
            });
        },

        updateProtectionPreset: async ({
            presetId = '',
            patch = {},
        } = {}) => {
            const pendingKeys = buildProtectionPresetPendingKeys();
            return runProtocolOwnerCommand(get, set, {
                pendingKeys,
                execute: () => updateProtocolProtectionPreset({
                    presetId,
                    patch,
                }),
                onSuccess: (result) => buildProtocolCommandResult(result, {
                    preset: result?.preset && typeof result.preset === 'object'
                        ? { ...result.preset }
                        : null,
                    presetId: typeof result?.presetId === 'string' ? result.presetId.trim() : '',
                }),
                onFailure: (_error, baseResult) => buildProtocolCommandResult(baseResult, {
                    preset: null,
                    presetId: typeof presetId === 'string' ? presetId.trim() : '',
                }),
            });
        },

        deleteProtectionPreset: async ({
            presetId = '',
        } = {}) => {
            const pendingKeys = buildProtectionPresetPendingKeys({
                includeAssignments: true,
            });
            return runProtocolOwnerCommand(get, set, {
                pendingKeys,
                execute: () => deleteProtocolProtectionPreset({
                    presetId,
                }),
                onSuccess: (result) => buildProtocolCommandResult(result, {
                    presetId: typeof result?.presetId === 'string' ? result.presetId.trim() : '',
                    deleted: !!result?.deleted,
                }),
                onFailure: (_error, baseResult) => buildProtocolCommandResult(baseResult, {
                    presetId: typeof presetId === 'string' ? presetId.trim() : '',
                    deleted: false,
                }),
            });
        },

        assignGlobalProtectionPreset: async ({
            presetId = '',
        } = {}) => {
            const pendingKeys = ['protectionPresetAssignments'];
            return runProtocolOwnerCommand(get, set, {
                pendingKeys,
                execute: () => assignProtocolGlobalProtectionPreset({
                    presetId,
                }),
                onSuccess: (result) => buildProtocolCommandResult(result, {
                    presetId: typeof result?.presetId === 'string' ? result.presetId.trim() : '',
                    assignedPresetId: typeof result?.assignedPresetId === 'string'
                        ? result.assignedPresetId.trim()
                        : '',
                }),
                onFailure: (_error, baseResult) => buildProtocolCommandResult(baseResult, {
                    presetId: typeof presetId === 'string' ? presetId.trim() : '',
                    assignedPresetId: '',
                }),
            });
        },
    };
}
