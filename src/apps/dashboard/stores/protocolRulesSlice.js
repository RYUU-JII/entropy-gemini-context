import { FIRST_USE_POLICY_KEYS } from '../../../domains/settings/config/firstUsePolicy.js';
import {
    DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
    normalizeGlobalCapNotifyOnExceeded,
    normalizeUrlList,
    normalizeGlobalGoal,
    VALID_TAB_EVAPORATION_TIMEOUTS,
} from '../../../domains/settings/config/siteRules.js';
import { normalizeDomain } from '../../../lib/domain.js';
import { normalizeFilteringMode } from '../../../domains/settings/config/blockingPolicy.js';
import {
    assessSiteRuleAdmission,
    SITE_RULE_ADMISSION_STATUS,
} from '../../../domains/settings/config/siteRuleAdmissionPolicy.js';
import {
    setProtocolCoolingCurvePreset,
    setProtocolCoolingCurveFamilyMode,
    setProtocolCoolingCurveAdvanced,
    removeProtocolSiteRule,
    completeProtocolFirstUse,
    updateProtocolSiteRule,
    upsertProtocolSiteRule,
} from './protocolSettingsClient.js';
import {
    commitProtocolSettingsPatch,
    getEffectiveProtocolState,
    isProtocolSettingsIntentAcknowledged,
    runProtocolSiteRuleCommand,
} from './protocolStoreCommands.js';
import {
    buildProtocolCommandResult,
    buildProtocolSyncResult,
    buildSiteRulePendingKeys,
    buildSiteRuleMovePendingKeys,
    buildSiteRuleRemovalPendingKeys,
    buildSiteRuleUpdatePendingKeys,
} from './protocolStoreHelpers.js';

// Rules domain: URL lists, site-rule CRUD, filtering mode, site goals, and the
// global protection limits.
export function createProtocolRulesSlice(set, get) {
    return {
        completeFirstUseWithoutRecording: () => runProtocolSiteRuleCommand(get, set, {
            pendingKeys: FIRST_USE_POLICY_KEYS,
            execute: () => completeProtocolFirstUse(),
        }),
        // Protection commands never change this independent recording choice.
        setSiteRecordingExcluded: ({ domain, excluded } = {}) => {
            const normalizedDomain = normalizeDomain(domain);
            if (!normalizedDomain || typeof excluded !== 'boolean') {
                return Promise.resolve(buildProtocolSyncResult({
                    error: new Error('SITE_RECORDING_EXCLUSION_INTENT_INVALID'),
                }));
            }
            return get().setTrackingExcludedUrls((current) => {
                if (!Array.isArray(current)) {
                    throw new Error('SITE_RECORDING_EXCLUSIONS_STATE_INVALID');
                }
                if (excluded) return current.includes(normalizedDomain) ? current : [...current, normalizedDomain];
                return current.filter((entry) => entry !== normalizedDomain);
            });
        },

        setTrackingExcludedUrls: (next) => {
            const current = getEffectiveProtocolState(get).trackingExcludedUrls;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeUrlList(value, []);
            if (isProtocolSettingsIntentAcknowledged(get, { trackingExcludedUrls: resolved })) {
                return Promise.resolve(buildProtocolSyncResult());
            }
            return commitProtocolSettingsPatch(
                get,
                set,
                { trackingExcludedUrls: resolved },
                {
                    pendingKeys: ['trackingExcludedUrls'],
                    acknowledgeUnchangedKeys: ['trackingExcludedUrls'],
                },
            );
        },

        upsertSiteRule: async ({
            domain,
            type = 'blocked',
            goalMinutes = null,
            firstUseRecording,
        } = {}) => {
            const normalizedDomain = normalizeDomain(domain);
            if (type !== 'blocked' && type !== 'allowed') {
                return buildProtocolSyncResult({
                    error: new Error('INVALID_SITE_RULE_TYPE'),
                });
            }
            const resolvedType = type;
            const pendingKeys = [...buildSiteRulePendingKeys({
                type: resolvedType,
                goalMinutes,
            }), ...(firstUseRecording === undefined ? [] : FIRST_USE_POLICY_KEYS)];

            if (!normalizedDomain) {
                return buildProtocolSyncResult({
                    changedKeys: pendingKeys,
                    error: new Error('INVALID_DOMAIN'),
                });
            }

            const currentState = getEffectiveProtocolState(get);
            const admission = assessSiteRuleAdmission({
                domain: normalizedDomain,
                type: resolvedType,
                blockedUrls: currentState.blockedUrls,
                allowedUrls: currentState.allowedUrls,
            });

            if (!admission?.isValid) {
                return buildProtocolCommandResult({
                    changedKeys: pendingKeys,
                    error: new Error('INVALID_DOMAIN'),
                }, {
                    admission,
                });
            }

            const completesExistingProtection = firstUseRecording !== undefined
                && resolvedType === 'blocked' && admission.status === SITE_RULE_ADMISSION_STATUS.REDUNDANT_SAME_SIDE
                && admission.existingDomain === normalizedDomain;
            if (admission.status !== SITE_RULE_ADMISSION_STATUS.ALLOW && !completesExistingProtection) {
                return buildProtocolCommandResult({}, {
                    admission,
                });
            }

            try {
                const result = await runProtocolSiteRuleCommand(get, set, {
                    pendingKeys,
                    execute: () => upsertProtocolSiteRule({
                        domain: normalizedDomain,
                        type: resolvedType,
                        goalMinutes,
                        ...(firstUseRecording === undefined ? {} : { firstUseRecording }),
                    }),
                    ...(firstUseRecording === undefined ? {} : { onAcknowledged: (acknowledgement) => {
                        if (!['registered', 'already_protected'].includes(acknowledgement.firstUseResult)) {
                            throw new Error('FIRST_USE_SITE_ACK_INVALID');
                        }
                        return buildProtocolCommandResult(acknowledgement, { firstUseResult: acknowledgement.firstUseResult });
                    } }),
                });
                return buildProtocolCommandResult(result, {
                    admission,
                    ...(firstUseRecording === undefined ? {} : { firstUseResult: result.firstUseResult }),
                });
            } catch (error) {
                return buildProtocolCommandResult({
                    changedKeys: pendingKeys,
                    error,
                }, {
                    admission,
                });
            }
        },

        moveSiteRule: async ({
            domain,
            fromType = 'blocked',
            toType = 'allowed',
            goalMinutes = null,
            firstUseRecording,
        } = {}) => {
            const normalizedDomain = normalizeDomain(domain);
            if (
                (fromType !== 'blocked' && fromType !== 'allowed')
                || (toType !== 'blocked' && toType !== 'allowed')
            ) {
                return buildProtocolSyncResult({
                    error: new Error('INVALID_SITE_RULE_TYPE'),
                });
            }
            const normalizedFromType = fromType;
            const normalizedToType = toType;
            const pendingKeys = [...buildSiteRuleMovePendingKeys({
                fromType: normalizedFromType,
                toType: normalizedToType,
                goalMinutes,
            }), ...(firstUseRecording === undefined ? [] : FIRST_USE_POLICY_KEYS)];

            if (!normalizedDomain || normalizedFromType === normalizedToType) {
                return buildProtocolSyncResult({
                    changedKeys: pendingKeys,
                    error: new Error('INVALID_SITE_RULE_MOVE'),
                });
            }

            const currentState = getEffectiveProtocolState(get);
            const admission = assessSiteRuleAdmission({
                domain: normalizedDomain,
                type: normalizedToType,
                blockedUrls: currentState.blockedUrls,
                allowedUrls: currentState.allowedUrls,
            });

            if (admission.status !== SITE_RULE_ADMISSION_STATUS.MOVE_EXACT_OPPOSITE) {
                return buildProtocolCommandResult({}, {
                    admission,
                    performedMove: false,
                });
            }

            const result = await runProtocolSiteRuleCommand(get, set, {
                pendingKeys,
                execute: () => upsertProtocolSiteRule({
                    domain: normalizedDomain,
                    type: normalizedToType,
                    goalMinutes,
                    confirmExactMove: true,
                    ...(firstUseRecording === undefined ? {} : { firstUseRecording }),
                }),
                ...(firstUseRecording === undefined ? {} : { onAcknowledged: acknowledgement => buildProtocolCommandResult(
                    acknowledgement, { firstUseResult: acknowledgement.firstUseResult },
                ) }),
            });

            return buildProtocolCommandResult(result, {
                admission,
                performedMove: !result?.error,
                ...(firstUseRecording === undefined ? {} : { firstUseResult: result.firstUseResult }),
            });
        },

        removeSiteRule: async ({
            domain,
            type = null,
        } = {}) => {
            const normalizedDomain = normalizeDomain(domain);
            if (type !== null && type !== 'blocked' && type !== 'allowed') {
                return buildProtocolSyncResult({
                    error: new Error('INVALID_SITE_RULE_TYPE'),
                });
            }
            const pendingKeys = buildSiteRuleRemovalPendingKeys({ type });

            if (!normalizedDomain) {
                return buildProtocolSyncResult({
                    changedKeys: pendingKeys,
                    error: new Error('INVALID_DOMAIN'),
                });
            }

            return runProtocolSiteRuleCommand(get, set, {
                pendingKeys,
                execute: () => removeProtocolSiteRule({
                    domain: normalizedDomain,
                    type,
                }),
            });
        },

        updateSiteRule: async (input = {}) => {
            const source = input && typeof input === 'object' ? input : {};
            const normalizedDomain = normalizeDomain(source.domain);
            const pendingKeys = buildSiteRuleUpdatePendingKeys(source);

            if (!normalizedDomain) {
                return buildProtocolSyncResult({
                    changedKeys: pendingKeys,
                    error: new Error('INVALID_DOMAIN'),
                });
            }
            if (pendingKeys.length === 0) {
                return buildProtocolSyncResult();
            }

            return runProtocolSiteRuleCommand(get, set, {
                pendingKeys,
                execute: () => updateProtocolSiteRule({
                    domain: normalizedDomain,
                    ...(Object.prototype.hasOwnProperty.call(source, 'goalMinutes')
                        ? { goalMinutes: source.goalMinutes }
                        : {}),
                    ...(Object.prototype.hasOwnProperty.call(source, 'presetId')
                        ? { presetId: source.presetId }
                        : {}),
                }),
                onAcknowledged: (acknowledgement) => {
                    if (!Object.hasOwn(source, 'goalMinutes')) return buildProtocolSyncResult(acknowledgement);
                    const goals = acknowledgement.items?.siteGoals;
                    if (!goals || typeof goals !== 'object' || Array.isArray(goals)) {
                        throw new Error('SITE_GOAL_ACKNOWLEDGEMENT_INVALID');
                    }
                    // An absent entry in the complete canonical map means no site cap.
                    const appliedMinutes = Object.hasOwn(goals, normalizedDomain) ? goals[normalizedDomain] : 0;
                    if (!Number.isInteger(appliedMinutes) || appliedMinutes < 0) {
                        throw new Error('SITE_GOAL_ACKNOWLEDGEMENT_INVALID');
                    }
                    return buildProtocolCommandResult(acknowledgement, { appliedMinutes });
                },
            });
        },

        setFilteringMode: (next) => {
            const current = getEffectiveProtocolState(get).filteringMode;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeFilteringMode(value);
            if (isProtocolSettingsIntentAcknowledged(get, { filteringMode: resolved })) return;
            return commitProtocolSettingsPatch(get, set, { filteringMode: resolved }, { pendingKeys: ['filteringMode'] });
        },

        setCoolingCurvePreset: preset => runProtocolSiteRuleCommand(get, set, {
            pendingKeys: ['coolingCurve'], execute: () => setProtocolCoolingCurvePreset(preset),
        }),
        setCoolingCurveFamilyMode: (family, mode) => runProtocolSiteRuleCommand(get, set, {
            pendingKeys: ['coolingCurve'], execute: () => setProtocolCoolingCurveFamilyMode(family, mode),
        }),
        setCoolingCurveAdvanced: advanced => runProtocolSiteRuleCommand(get, set, {
            pendingKeys: ['coolingCurve'], execute: () => setProtocolCoolingCurveAdvanced(advanced),
        }),

        setGlobalGoal: (next) => {
            const current = getEffectiveProtocolState(get).globalGoal;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeGlobalGoal(value);
            if (isProtocolSettingsIntentAcknowledged(get, { globalGoal: resolved })) {
                return Promise.resolve(buildProtocolSyncResult());
            }
            const commit = () => commitProtocolSettingsPatch(get, set, { globalGoal: resolved }, {
                pendingKeys: ['globalGoal'], acknowledgeUnchangedKeys: ['globalGoal'],
            });
            return commit();
        },

        setGlobalCapNotifyOnExceeded: (next) => {
            const current = getEffectiveProtocolState(get).globalCapNotifyOnExceeded;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeGlobalCapNotifyOnExceeded(
                value,
                DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
            );
            if (isProtocolSettingsIntentAcknowledged(get, { globalCapNotifyOnExceeded: resolved })) return;
            return commitProtocolSettingsPatch(
                get,
                set,
                { globalCapNotifyOnExceeded: resolved },
                { pendingKeys: ['globalCapNotifyOnExceeded'] },
            );
        },

        setHistoryCleanupForBlocked: (next) => {
            const current = getEffectiveProtocolState(get).historyCleanupForBlocked;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = !!value;
            if (isProtocolSettingsIntentAcknowledged(get, { historyCleanupForBlocked: resolved })) return;
            return commitProtocolSettingsPatch(
                get,
                set,
                { historyCleanupForBlocked: resolved },
                { pendingKeys: ['historyCleanupForBlocked'] },
            );
        },

        setConcealBlockedBookmarks: (next) => {
            const current = getEffectiveProtocolState(get).concealBlockedBookmarks;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = !!value;
            if (isProtocolSettingsIntentAcknowledged(get, { concealBlockedBookmarks: resolved })) {
                return Promise.resolve({
                    ...buildProtocolSyncResult(),
                    value: resolved,
                });
            }
            return commitProtocolSettingsPatch(get, set, { concealBlockedBookmarks: resolved }, {
                pendingKeys: ['concealBlockedBookmarks'],
            }).then((result) => ({
                ...result,
                value: resolved,
            }));
        },

        setTabEvaporationForBlocked: (next) => {
            const current = getEffectiveProtocolState(get).tabEvaporationForBlocked;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = !!value;
            if (isProtocolSettingsIntentAcknowledged(get, { tabEvaporationForBlocked: resolved })) return;
            return commitProtocolSettingsPatch(
                get,
                set,
                { tabEvaporationForBlocked: resolved },
                { pendingKeys: ['tabEvaporationForBlocked'] },
            );
        },

        setTabEvaporationConfig: ({ enabled, timeoutMinutes } = {}) => {
            if (typeof enabled !== 'boolean' || !VALID_TAB_EVAPORATION_TIMEOUTS.includes(timeoutMinutes)) {
                return Promise.resolve(buildProtocolSyncResult({
                    error: new Error('TAB_EVAPORATION_CONFIG_INTENT_INVALID'),
                }));
            }
            const patch = {
                tabEvaporationForBlocked: enabled,
                tabEvaporationTimeoutMinutes: timeoutMinutes,
            };
            if (isProtocolSettingsIntentAcknowledged(get, patch)) return Promise.resolve(buildProtocolSyncResult());
            return commitProtocolSettingsPatch(get, set, patch, { pendingKeys: Object.keys(patch) });
        },

        setTabEvaporationTimeoutMinutes: (next) => {
            const current = getEffectiveProtocolState(get).tabEvaporationTimeoutMinutes;
            const value = typeof next === 'function' ? next(current) : next;
            if (!VALID_TAB_EVAPORATION_TIMEOUTS.includes(value)) {
                return Promise.resolve(buildProtocolSyncResult({ error: new Error('TAB_EVAPORATION_TIMEOUT_INTENT_INVALID') }));
            }
            const resolved = value;
            if (isProtocolSettingsIntentAcknowledged(get, { tabEvaporationTimeoutMinutes: resolved })) return;
            return commitProtocolSettingsPatch(
                get,
                set,
                { tabEvaporationTimeoutMinutes: resolved },
                { pendingKeys: ['tabEvaporationTimeoutMinutes'] },
            );
        },
    };
}
