import { useCallback } from 'react';

import { SITE_GOAL_INCREASE_CAP_MINUTES } from '../../../../../domains/settings/config/siteGoalPolicy.js';
import { normalizeDomain } from '../../../../../lib/domain.js';
import { moveSiteRuleRegistration, registerSiteRule } from '../../../commands/registerSiteRule.js';
import { logRuleMutationFailure } from './sitesMutationLogging.js';
import { requireProtocolSyncSuccess } from '../../../stores/protocolStoreHelpers.js';

export function useSitesMutations({
    setGlobalGoal,
    setSiteRecordingExcluded,
    removeSiteRule,
    updateSiteRule,
    upsertSiteRule,
    moveSiteRule,
}) {
    const handleExcludeTracked = useCallback(async (domain) => {
        requireProtocolSyncSuccess(await setSiteRecordingExcluded({ domain, excluded: true }));
        return true;
    }, [setSiteRecordingExcluded]);

    const handleUnexcludeTracked = useCallback(async (domain) => {
        requireProtocolSyncSuccess(await setSiteRecordingExcluded({ domain, excluded: false }));
        return true;
    }, [setSiteRecordingExcluded]);

    const handleAdd = useCallback(async (domain, type, goalMinutes = null) => {
        return registerSiteRule({
            goalMinutes,
            domain,
            type,
            upsertSiteRule,
            onPersistFailure: ({ result }) => {
                logRuleMutationFailure('save', { domain, type }, result);
            },
        });
    }, [upsertSiteRule]);

    const handleConfirmMove = useCallback(async ({ domain, fromType, toType, goalMinutes = null } = {}) => (
        moveSiteRuleRegistration({ domain, fromType, toType, goalMinutes, moveSiteRule })
    ), [moveSiteRule]);

    const handleRemove = useCallback(async (domain, type) => {
        if (!domain) return false;
        const persistResult = await removeSiteRule({ domain, type });
        if (persistResult?.error) {
            logRuleMutationFailure('remove', { domain, type }, persistResult);
            return false;
        }
        return true;
    }, [removeSiteRule]);

    const handleSiteGoalChange = useCallback(async (domain, minutes) => {
        const normalizedDomain = normalizeDomain(domain);
        const requestedMinutes = Number(minutes);
        if (!Number.isSafeInteger(requestedMinutes) || requestedMinutes < 0) {
            throw new Error('SITE_GOAL_REQUEST_INVALID');
        }
        if (!normalizedDomain) {
            return {
                ok: false,
                capped: false,
                appliedMinutes: 0,
                requestedMinutes,
            };
        }
        const persistResult = await updateSiteRule({
            domain: normalizedDomain,
            goalMinutes: requestedMinutes,
        });
        if (persistResult?.error) {
            logRuleMutationFailure('update_goal', {
                domain: normalizedDomain,
                requestedMinutes,
            }, persistResult);
            return {
                ok: false,
                requestedMinutes,
            };
        }
        const appliedMinutes = persistResult?.appliedMinutes;
        if (!Number.isInteger(appliedMinutes) || appliedMinutes < 0) {
            throw new Error('SITE_GOAL_ACKNOWLEDGEMENT_INVALID');
        }
        return {
            ok: true,
            requestedMinutes,
            appliedMinutes,
            capped: appliedMinutes < requestedMinutes,
            capMinutes: SITE_GOAL_INCREASE_CAP_MINUTES,
        };
    }, [updateSiteRule]);

    const applyScoreSetupDraft = useCallback(async (draft = null) => {
        const domain = typeof draft?.domain === 'string' ? draft.domain.trim().toLowerCase() : '';
        const suggestedMinutes = Math.max(0, Math.floor(Number(draft?.suggestedMinutes) || 0));
        if (!domain || suggestedMinutes <= 0) return { ok: false };
        return handleSiteGoalChange(domain, suggestedMinutes);
    }, [handleSiteGoalChange]);

    const handleGlobalGoalChange = useCallback(async (globalGoal) => {
        if (typeof setGlobalGoal !== 'function') {
            throw new Error('SITES_GLOBAL_GOAL_HANDLER_REQUIRED');
        }
        const result = await setGlobalGoal(globalGoal);
        return requireProtocolSyncSuccess(result);
    }, [setGlobalGoal]);

    return {
        handleAdd,
        handleConfirmMove,
        handleRemove,
        handleExcludeTracked,
        handleUnexcludeTracked,
        handleSiteGoalChange,
        applyScoreSetupDraft,
        handleGlobalGoalChange,
    };
}
