import { normalizeSentinelFlareProtocolScope } from '../../nudge/runtime/sentinelFlareProtocolProfile.js';
import {
    getBackgroundRuntimeLanguage,
    tBackgroundRuntimeWithLanguage,
} from './backgroundRuntime.js';
import { normalizeRuntimeLanguage } from './language.js';

export const SENTINEL_FLARE_NUDGE_RECOVERY_ACTIONS = Object.freeze({
    PAUSE: 'pause',
    DASHBOARD: 'dashboard',
    REVIEW_GOAL: 'reviewGoal',
});

function resolveCopyContext(runtimeContext = null) {
    if (typeof runtimeContext === 'string') {
        return {
            themeId: runtimeContext || null,
            language: null,
        };
    }
    if (!runtimeContext || typeof runtimeContext !== 'object') {
        return {
            themeId: null,
            language: null,
        };
    }
    const themeId = typeof runtimeContext.themeId === 'string'
        ? runtimeContext.themeId
        : null;
    const language = typeof runtimeContext.language === 'string' && runtimeContext.language.trim()
        ? normalizeRuntimeLanguage(runtimeContext.language, '')
        : null;
    return {
        themeId,
        language: language || null,
    };
}

export function normalizeSentinelFlareNudgeRecoveryAction(value) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || normalized === 'none') {
        return null;
    }
    if (
        normalized === SENTINEL_FLARE_NUDGE_RECOVERY_ACTIONS.PAUSE
        || normalized === SENTINEL_FLARE_NUDGE_RECOVERY_ACTIONS.DASHBOARD
        || normalized === SENTINEL_FLARE_NUDGE_RECOVERY_ACTIONS.REVIEW_GOAL
    ) {
        return normalized;
    }
    if (normalized === 'productiveSite') {
        throw new Error('sentinel_flare_nudge_recovery_action_unsupported:productiveSite');
    }
    throw new Error(`sentinel_flare_nudge_recovery_action_invalid:${normalized}`);
}

function resolveRecoveryCopy(translate, options, recoveryAction = null, protocolScope = 'site') {
    const normalizedRecoveryAction = normalizeSentinelFlareNudgeRecoveryAction(recoveryAction);
    if (!normalizedRecoveryAction) {
        return null;
    }
    const normalizedProtocolScope = normalizeSentinelFlareProtocolScope(protocolScope);
    switch (normalizedRecoveryAction) {
        case 'reviewGoal':
            return {
                body: normalizedProtocolScope === 'global'
                    ? translate('tools:sentinel_flare_protocol.recovery_review_goal_body_global', options)
                    : translate('tools:sentinel_flare_protocol.recovery_review_goal_body', options),
                primaryCta: translate(
                    'tools:sentinel_flare_protocol.recovery_review_goal_primary_cta',
                    options
                ),
                primaryDesc: translate(
                    'tools:sentinel_flare_protocol.recovery_review_goal_primary_desc',
                    options
                ),
                secondaryCta: translate(
                    'tools:sentinel_flare_protocol.recovery_review_goal_secondary_cta',
                    options
                ),
                secondaryDesc: translate(
                    'tools:sentinel_flare_protocol.recovery_review_goal_secondary_desc',
                    options
                ),
            };
        case 'dashboard':
            return {
                body: normalizedProtocolScope === 'global'
                    ? translate('tools:sentinel_flare_protocol.recovery_dashboard_body_global', options)
                    : translate('tools:sentinel_flare_protocol.recovery_dashboard_body', options),
                primaryCta: translate(
                    'tools:sentinel_flare_protocol.recovery_dashboard_primary_cta',
                    options
                ),
                primaryDesc: translate(
                    'tools:sentinel_flare_protocol.recovery_dashboard_primary_desc',
                    options
                ),
                secondaryCta: translate(
                    'tools:sentinel_flare_protocol.recovery_dashboard_secondary_cta',
                    options
                ),
                secondaryDesc: translate(
                    'tools:sentinel_flare_protocol.recovery_dashboard_secondary_desc',
                    options
                ),
            };
        case 'pause':
            return {
                body: normalizedProtocolScope === 'global'
                    ? translate('tools:sentinel_flare_protocol.recovery_pause_body_global', options)
                    : translate('tools:sentinel_flare_protocol.recovery_pause_body', options),
                primaryCta: translate(
                    'tools:sentinel_flare_protocol.recovery_pause_primary_cta',
                    options
                ),
                primaryDesc: translate(
                    'tools:sentinel_flare_protocol.recovery_pause_primary_desc',
                    options
                ),
                secondaryCta: translate(
                    'tools:sentinel_flare_protocol.recovery_pause_secondary_cta',
                    options
                ),
                secondaryDesc: translate(
                    'tools:sentinel_flare_protocol.recovery_pause_secondary_desc',
                    options
                ),
            };
    }
    throw new Error(`sentinel_flare_nudge_recovery_action_unhandled:${normalizedRecoveryAction}`);
}

export function getSentinelFlareNudgeCopy(runtimeContext = null, { recoveryAction = null, protocolScope = 'site', combinedGoals = false } = {}) {
    if (typeof combinedGoals !== 'boolean' || (combinedGoals && protocolScope !== 'global')) throw new Error('NUDGE_COMBINED_GOAL_COPY_INVALID');
    const context = resolveCopyContext(runtimeContext);
    const themeContext = context.themeId || null;
    const language = context.language || getBackgroundRuntimeLanguage();
    const translate = (key, options = {}) => (
        tBackgroundRuntimeWithLanguage(language, key, options)
    );
    const options = themeContext ? { context: themeContext } : {};
    const recoveryCopy = resolveRecoveryCopy(translate, options, recoveryAction, protocolScope);
    return {
        protocol: {
            title: translate('tools:sentinel_flare_protocol.title', options),
            subtitle: translate(
                combinedGoals ? 'tools:sentinel_flare_protocol.combined_goals_title' : 'tools:sentinel_flare_protocol.simulation_drift',
                options
            ),
            hint: translate(
                'tools:sentinel_flare_protocol.hint',
                options
            ),
            rampMs: 45000,
        },
        message: {
            title: translate('tools:sentinel_flare_protocol.title_localized', options),
            body: combinedGoals ? translate('tools:sentinel_flare_protocol.combined_goals_body', options) : recoveryCopy?.body || translate(
                'tools:sentinel_flare_protocol.body',
                options
            ),
            systemTag: translate('tools:sentinel_flare_protocol.system_tag', options),
            primaryCta: recoveryCopy?.primaryCta || translate('tools:sentinel_flare_protocol.primary_cta', options),
            primaryDesc: recoveryCopy?.primaryDesc || translate('tools:sentinel_flare_protocol.primary_desc', options),
            secondaryCta: recoveryCopy?.secondaryCta || translate('tools:sentinel_flare_protocol.secondary_cta', options),
            secondaryDesc: recoveryCopy?.secondaryDesc || translate('tools:sentinel_flare_protocol.secondary_desc', options),
        },
    };
}
