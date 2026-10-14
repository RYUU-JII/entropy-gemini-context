import { normalizeFilterSettings } from '../../../domains/settings/config/index.js';
import { normalizeIndicatorConfig } from '../../../domains/settings/config/indicator.js';
import { normalizeGateConfig } from '../../../domains/settings/config/gateConfig.js';
import { requireTabManagement } from '../../../domains/settings/config/tabManagement.js';
import { normalizeStoredNudgeConfig } from '../../../domains/settings/config/nudgeConfig.js';
import { setProtocolGoalEndEnabled } from './protocolSettingsClient.js';
import { normalizeNotificationsConfig } from '../../../domains/settings/config/notificationsConfig.js';
import {
    DEFAULT_DEBUG_CONFIG,
    normalizeDebugConfig,
} from '../../../domains/settings/config/debugConfig.js';
import { normalizeArtifactControlState } from '../../../domains/settings/config/artifactControlState.js';
import {
    commitProtocolSettingsPatch,
    getEffectiveProtocolState,
    isProtocolSettingsIntentAcknowledged,
    runProtocolSiteRuleCommand,
} from './protocolStoreCommands.js';
import {
    buildProtocolSyncResult,
    normalizeSchedule,
    requireProtocolFilterSettingsPayload,
} from './protocolStoreHelpers.js';

// Config domain: gate/nudge/notifications/debug configs, the hard-block
// schedule, filter settings, artifact control state, and the status indicator.
export function createProtocolConfigSlice(set, get) {
    return {
        setGoalEndEnabled: (scope, enabled) => runProtocolSiteRuleCommand(get, set, {
            pendingKeys: ['nudgeConfig'], execute: () => setProtocolGoalEndEnabled(scope, enabled),
        }),
        setTabManagement: (next) => {
            const current = getEffectiveProtocolState(get).tabManagement;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = requireTabManagement(value);
            if (isProtocolSettingsIntentAcknowledged(get, { tabManagement: resolved })) {
                return Promise.resolve({ ...buildProtocolSyncResult(), value: resolved });
            }
            return commitProtocolSettingsPatch(get, set, { tabManagement: resolved }, {
                pendingKeys: ['tabManagement'],
            });
        },
        setGateConfig: (next) => {
            const current = getEffectiveProtocolState(get).gateConfig;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeGateConfig(value, { defaults: current });
            if (isProtocolSettingsIntentAcknowledged(get, { gateConfig: resolved })) {
                return Promise.resolve({
                    ...buildProtocolSyncResult(),
                    value: resolved,
                });
            }
            return commitProtocolSettingsPatch(get, set, { gateConfig: resolved }, {
                pendingKeys: ['gateConfig'],
            }).then((result) => ({
                ...result,
                value: resolved,
            }));
        },

        setNudgeConfig: (next) => {
            const current = getEffectiveProtocolState(get).nudgeConfig;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeStoredNudgeConfig(value, { defaults: current });
            if (isProtocolSettingsIntentAcknowledged(get, { nudgeConfig: resolved })) {
                return Promise.resolve({
                    ...buildProtocolSyncResult(),
                    value: resolved,
                });
            }
            return commitProtocolSettingsPatch(get, set, { nudgeConfig: resolved }, {
                pendingKeys: ['nudgeConfig'],
            }).then((result) => ({
                ...result,
                value: resolved,
            }));
        },

        setNotificationsConfig: (next) => {
            const current = getEffectiveProtocolState(get).notificationsConfig;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeNotificationsConfig(value, { defaults: current });
            if (isProtocolSettingsIntentAcknowledged(get, { notificationsConfig: resolved })) {
                return Promise.resolve({
                    ...buildProtocolSyncResult(),
                    value: resolved,
                });
            }
            return commitProtocolSettingsPatch(get, set, { notificationsConfig: resolved }, {
                pendingKeys: ['notificationsConfig'],
            }).then((result) => ({
                ...result,
                value: resolved,
            }));
        },

        setDebugConfig: (next) => {
            const current = getEffectiveProtocolState(get).debugConfig;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeDebugConfig(value, { defaults: current || DEFAULT_DEBUG_CONFIG });
            if (isProtocolSettingsIntentAcknowledged(get, { debugConfig: resolved })) {
                return Promise.resolve({
                    ...buildProtocolSyncResult(),
                    value: resolved,
                });
            }
            return commitProtocolSettingsPatch(get, set, { debugConfig: resolved }, {
                pendingKeys: ['debugConfig'],
            }).then((result) => ({
                ...result,
                value: resolved,
            }));
        },

        setSchedule: (next) => {
            const current = getEffectiveProtocolState(get).schedule;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeSchedule(value);
            if (isProtocolSettingsIntentAcknowledged(get, { schedule: resolved })) return;
            return commitProtocolSettingsPatch(get, set, { schedule: resolved }, {
                pendingKeys: ['relaxationSchedule'],
            });
        },

        setFilterSettings: (next) => {
            const state = getEffectiveProtocolState(get);
            const current = state.filterSettings;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeFilterSettings(requireProtocolFilterSettingsPayload(value, {
                source: 'protocol.setFilterSettings',
            }));
            if (isProtocolSettingsIntentAcknowledged(get, { filterSettings: resolved })) return;
            return commitProtocolSettingsPatch(get, set, { filterSettings: resolved }, { pendingKeys: ['filterSettings'] });
        },

        setArtifactControlState: (next) => {
            const current = getEffectiveProtocolState(get).artifactControlState;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeArtifactControlState(value, { defaults: current });
            if (isProtocolSettingsIntentAcknowledged(get, { artifactControlState: resolved })) {
                return Promise.resolve({
                    ...buildProtocolSyncResult(),
                    value: resolved,
                });
            }
            return commitProtocolSettingsPatch(get, set, { artifactControlState: resolved }, {
                pendingKeys: ['artifactControlState'],
            }).then((result) => ({
                ...result,
                value: resolved,
            }));
        },

        setArtifactGlobalPaused: (next) => {
            const current = getEffectiveProtocolState(get).artifactControlState;
            const nextValue = typeof next === 'function'
                ? next(!!current?.globalPaused)
                : next;
            if (typeof nextValue !== 'boolean') throw new Error('ARTIFACT_GLOBAL_PAUSED_INTENT_INVALID');
            return get().setArtifactControlState({
                ...current,
                globalPaused: nextValue,
            });
        },

        setArtifactFamilySuspended: (familyId, next) => {
            if (typeof familyId !== 'string' || !familyId.trim()) {
                throw new Error('ARTIFACT_FAMILY_ID_REQUIRED');
            }
            const current = getEffectiveProtocolState(get).artifactControlState;
            const currentFamilyValue = !!current?.familySuspensions?.[familyId];
            const nextValue = typeof next === 'function'
                ? next(currentFamilyValue)
                : next;
            if (typeof nextValue !== 'boolean') throw new Error('ARTIFACT_FAMILY_SUSPENSION_INTENT_INVALID');
            return get().setArtifactControlState({
                ...current,
                familySuspensions: {
                    ...(current?.familySuspensions || {}),
                    [familyId]: nextValue,
                },
            });
        },

        setIndicatorConfig: (next) => {
            const current = getEffectiveProtocolState(get).indicatorConfig;
            const value = typeof next === 'function' ? next(current) : next;
            const merged = { ...current, ...(value && typeof value === 'object' ? value : {}) };
            const resolved = normalizeIndicatorConfig(merged);
            if (isProtocolSettingsIntentAcknowledged(get, { indicatorConfig: resolved })) return;
            return commitProtocolSettingsPatch(get, set, { indicatorConfig: resolved }, { pendingKeys: ['indicatorConfig'] });
        },
    };
}
