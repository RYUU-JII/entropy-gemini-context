import { normalizePermissionDomainInput } from '@/lib/permissions.js';
import { ensureDomainEnforcementPermissionStrict } from '@/platform/security/capabilityGate.js';
import { requireSiteRegistrationRejectionDetails } from '@/domains/progression/contracts/siteRegistrationRejection.js';
import { beginSettingsFlowTiming, endSettingsFlowTiming } from '@/platform/diagnostics/settingsFlowTiming.js';

export function buildSiteRegistrationLimitFeedback(error) {
    const rejection = requireSiteRegistrationRejectionDetails(error);
    return rejection === null ? null : {
        ok: false,
        kind: 'status',
        messageKey: 'errors.registration_limit_reached',
        messageParams: { limit: rejection.siteRegistrationBudget.limit, nextDay: rejection.nextIncreaseDay },
        registrationRejection: rejection,
    };
}

function describeSiteRuleRegistrationError(error, fallbackCode) {
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    const message = String(error || '').trim();
    return message || fallbackCode;
}

export async function registerSiteRule({
    domain,
    type = 'blocked',
    goalMinutes = null,
    firstUseRecording,
    upsertSiteRule,
    onPersistFailure = null,
} = {}) {
    const normalizedDomain = normalizePermissionDomainInput(domain);
    if (!normalizedDomain) {
        return {
            ok: false,
            kind: 'error',
            messageKey: 'errors.invalid_domain',
            messageParams: {},
        };
    }
    if (type !== 'blocked' && type !== 'allowed') {
        throw new Error('SITE_RULE_REGISTRATION_TYPE_INVALID');
    }
    if (typeof upsertSiteRule !== 'function') {
        throw new Error('SITE_RULE_REGISTRATION_COMMAND_OWNER_REQUIRED');
    }

    let granted = false;
    const permissionStarted = beginSettingsFlowTiming();
    try {
        granted = await ensureDomainEnforcementPermissionStrict(normalizedDomain);
    } catch (error) {
        return {
            ok: false,
            kind: 'error',
            message: describeSiteRuleRegistrationError(error, 'RULE_PERMISSION_OWNER_FAILED'),
        };
    } finally { endSettingsFlowTiming('registration_permission', permissionStarted); }

    if (!granted) {
        return {
            ok: false,
            kind: 'error',
            messageKey: 'errors.permission_required',
            messageParams: {},
        };
    }

    const persistResult = await upsertSiteRule({
        domain: normalizedDomain,
        type,
        ...(goalMinutes === null ? {} : { goalMinutes }),
        ...(firstUseRecording === undefined ? {} : { firstUseRecording }),
    });

    if (persistResult?.error) {
        const limitFeedback = buildSiteRegistrationLimitFeedback(persistResult.error);
        if (limitFeedback) return limitFeedback;
        onPersistFailure?.({ domain: normalizedDomain, type, result: persistResult });
        return {
            ok: false,
            kind: 'error',
            messageKey: 'errors.save_failed',
            messageParams: {},
        };
    }

    const admission = persistResult?.admission || null;
    const existingFirstUse = firstUseRecording !== undefined && persistResult?.firstUseResult === 'already_protected';
    if (!admission || admission.status === 'allow' || existingFirstUse) {
        // "added" acknowledges the saved rule. Shared settings feedback owns
        // apply-error/retry presentation; callers retain the same exact receipt.
        return {
            ok: true, kind: existingFirstUse ? 'already_protected' : 'added', message: '', domain: normalizedDomain,
            ...(persistResult?.propagation ? {
                version: persistResult.version,
                applied: persistResult.applied,
                propagation: persistResult.propagation,
            } : {}),
        };
    }

    if (admission.status === 'redundant_same_side') {
        return {
            ok: false,
            kind: 'status',
            messageKey: admission.messageKey || 'admission.redundant_same_side',
            messageParams: admission.messageParams || {},
            admission,
        };
    }

    if (admission.status === 'move_exact_opposite') {
        return {
            ok: false,
            kind: 'confirm_move',
            messageKey: admission.messageKey || 'admission.move_exact_opposite',
            messageParams: admission.messageParams || {},
            admission,
        };
    }

    return {
        ok: false,
        kind: 'error',
        messageKey: admission.messageKey || 'admission.conflict_covered_by_opposite',
        messageParams: admission.messageParams || {},
        admission,
    };
}

// Confirmation belongs to the calling surface. This command keeps the move and
// optional visible goal inside the existing atomic site-rule owner command.
export async function moveSiteRuleRegistration({
    domain,
    fromType,
    toType,
    goalMinutes = null,
    firstUseRecording,
    moveSiteRule,
} = {}) {
    const normalizedDomain = normalizePermissionDomainInput(domain);
    if (!normalizedDomain) {
        return { ok: false, kind: 'error', messageKey: 'errors.invalid_domain', messageParams: {} };
    }
    if ((fromType !== 'blocked' && fromType !== 'allowed')
        || (toType !== 'blocked' && toType !== 'allowed') || fromType === toType) {
        throw new Error('SITE_RULE_REGISTRATION_MOVE_TYPE_INVALID');
    }
    if (typeof moveSiteRule !== 'function') {
        throw new Error('SITE_RULE_REGISTRATION_MOVE_COMMAND_OWNER_REQUIRED');
    }
    const result = await moveSiteRule({ domain: normalizedDomain, fromType, toType, goalMinutes,
        ...(firstUseRecording === undefined ? {} : { firstUseRecording }) });
    if (result?.error) {
        const limitFeedback = buildSiteRegistrationLimitFeedback(result.error);
        if (limitFeedback) return limitFeedback;
        return { ok: false, kind: 'error', messageKey: 'errors.move_failed', messageParams: {} };
    }
    if (result?.performedMove !== true) {
        return { ok: false, kind: 'error', messageKey: 'errors.move_not_available', messageParams: {} };
    }
    return {
        ok: true,
        kind: result.firstUseResult === 'already_protected' ? 'already_protected' : 'moved',
        domain: normalizedDomain,
        messageKey: toType === 'allowed' ? 'admission.move_completed_allowed' : 'admission.move_completed_blocked',
        messageParams: { domain: normalizedDomain },
        ...(result.propagation ? {
            version: result.version,
            applied: result.applied,
            propagation: result.propagation,
        } : {}),
    };
}
