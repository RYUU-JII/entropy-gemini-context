import { createScheduleRuntimeCoordinator } from '../../schedule/background/scheduleRuntimeCoordinator.js';
import { STORAGE_SESSION_KEYS } from '../../../platform/storage/runtime/RuntimeSessionRepository.js';
import { NOTIFICATION_EVENT_TYPES } from '../../notifications/contracts/notificationTypes.js';
import { parseLocalDateParts } from '../../stats/shared/dateMath.js';
import { requireSettingsPropagationContext } from '../../settings/contracts/settingsPropagationContext.js';

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDateStr(value) {
    const dateStr = typeof value === 'string' && value.trim() ? value.trim() : null;
    return dateStr && parseLocalDateParts(dateStr) ? dateStr : null;
}

function normalizeNonEmptyString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRequiredTimestamp(value, errorCode) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error(errorCode);
    }
    return Math.max(0, Math.floor(numeric));
}

function createGlobalCapMetricError(fieldName) {
    const error = new Error(`TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_METRIC_INVALID:${fieldName}`);
    error.code = 'TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_METRIC_INVALID';
    error.field = fieldName;
    return error;
}

function requireGlobalCapMetric(capState, fieldName) {
    const value = capState[fieldName];
    if (!Number.isInteger(value) || value < 0) {
        throw createGlobalCapMetricError(fieldName);
    }
    return value;
}

function requireGlobalCapState(capState) {
    if (!isPlainObject(capState) || typeof capState.exceeded !== 'boolean') {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_STATE_INVALID');
    }
    const dateStr = normalizeDateStr(capState.dateStr);
    if (!dateStr) {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_DATE_INVALID');
    }
    return {
        ...capState,
        dateStr,
        exceeded: capState.exceeded,
        blockedTodayMs: requireGlobalCapMetric(capState, 'blockedTodayMs'),
        globalGoalMin: requireGlobalCapMetric(capState, 'globalGoalMin'),
    };
}

function createGlobalCapApplyError(result) {
    const code = 'TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_APPLY_FAILED';
    const text = (value, limit = 240) => typeof value === 'string' ? value.trim().slice(0, limit) : null;
    const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
    const failures = Array.isArray(result?.failures) ? result.failures : null;
    const details = {
        resultType: result === null ? 'null' : typeof result,
        success: typeof result?.success === 'boolean' ? result.success : null,
        mode: text(result?.mode, 64),
        attemptedCount: count(result?.attemptedCount),
        acknowledgedCount: count(result?.acknowledgedCount),
        skippedCount: count(result?.skippedCount),
        failedCount: count(result?.failedCount),
        failures: failures === null ? null : failures.slice(0, 8).map((failure) => ({
            tabId: count(failure?.tabId),
            code: text(failure?.code, 96),
            message: text(failure?.message),
            reason: text(failure?.reason, 96),
        })),
        omittedFailureCount: failures === null ? null : Math.max(0, failures.length - 8),
    };
    // Keep the dispatcher result diagnosable in error-only consumers such as
    // Chrome's extension error list. Do not copy target URLs or raw payloads.
    const error = new Error(`${code} summary=${JSON.stringify(details)}`);
    error.code = code;
    error.phase = 'global_cap_broadcast';
    error.details = details;
    return error;
}

function normalizeGlobalCapRuntimeState(rawValue) {
    if (rawValue == null) return null;
    if (!isPlainObject(rawValue) || typeof rawValue.exceeded !== 'boolean') {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_SESSION_STATE_INVALID');
    }
    const dateStr = normalizeDateStr(rawValue.dateStr);
    if (!dateStr) {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_SESSION_STATE_INVALID');
    }
    return {
        dateStr,
        exceeded: rawValue.exceeded,
    };
}

function buildGlobalCapNotificationDeliveryKey(dateStr) {
    const safeDateStr = normalizeDateStr(dateStr);
    if (!safeDateStr) {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_DATE_INVALID');
    }
    return `global_cap:exceeded:${safeDateStr}`;
}

function requireNotificationService(notificationService) {
    if (!notificationService || typeof notificationService.handleEvent !== 'function') {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_NOTIFICATION_SERVICE_REQUIRED');
    }
    return notificationService;
}

function requireSettingsService(settingsService) {
    if (!settingsService || typeof settingsService.ensureSettingsCache !== 'function') {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_SETTINGS_SERVICE_REQUIRED');
    }
    return settingsService;
}

function requireSettingsCache(settingsCache) {
    if (!isPlainObject(settingsCache)) {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_SETTINGS_CACHE_REQUIRED');
    }
    return settingsCache;
}

function requireGlobalCapStateOwner(getGlobalCapState) {
    if (typeof getGlobalCapState !== 'function') {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_OWNER_REQUIRED');
    }
    return getGlobalCapState;
}

function requireNotificationDispatchResult(result) {
    if (!result || typeof result !== 'object' || typeof result.dispatched !== 'boolean') {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_NOTIFICATION_RESULT_INVALID');
    }
    if (result.dispatched !== true && (typeof result.reason !== 'string' || !result.reason.trim())) {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_NOTIFICATION_RESULT_INVALID');
    }
    return result;
}

function requireContentScriptRuntimeSync(contentScriptRuntimeSync) {
    if (!contentScriptRuntimeSync || typeof contentScriptRuntimeSync.syncManagedContentScripts !== 'function') {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_CONTENT_SCRIPT_SYNC_OWNER_REQUIRED');
    }
    return contentScriptRuntimeSync;
}

function requireProtectionDispatcher(protectionDispatcher) {
    if (
        !protectionDispatcher
        || typeof protectionDispatcher.refreshDispatchPermissionCaches !== 'function'
    ) {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_PROTECTION_DISPATCHER_REQUIRED');
    }
    return protectionDispatcher;
}

function createContentScriptSyncResultError(fieldName) {
    const error = new Error(`TRACKING_RUNTIME_COORDINATOR_CONTENT_SCRIPT_SYNC_RESULT_INVALID:${fieldName}`);
    error.code = 'TRACKING_RUNTIME_COORDINATOR_CONTENT_SCRIPT_SYNC_RESULT_INVALID';
    error.field = fieldName;
    return error;
}

function requireContentScriptSyncResultObject(result) {
    if (!isPlainObject(result)) {
        throw createContentScriptSyncResultError('result');
    }
    return result;
}

function requireContentScriptSyncArray(result, fieldName) {
    if (!Array.isArray(result[fieldName])) {
        throw createContentScriptSyncResultError(fieldName);
    }
    return result[fieldName];
}

function requireContentScriptSyncBoolean(result, fieldName) {
    if (typeof result[fieldName] !== 'boolean') {
        throw createContentScriptSyncResultError(fieldName);
    }
    return result[fieldName];
}

function requireContentScriptSyncCount(value, fieldName) {
    if (!Number.isInteger(value) || value < 0) {
        throw createContentScriptSyncResultError(fieldName);
    }
    return value;
}

function requireContentScriptSyncInjectionSummary(result) {
    const summary = result.injectionSummary;
    if (!isPlainObject(summary)) {
        throw createContentScriptSyncResultError('injectionSummary');
    }
    return {
        attemptedCount: requireContentScriptSyncCount(
            summary.attemptedCount,
            'injectionSummary.attemptedCount',
        ),
        successCount: requireContentScriptSyncCount(
            summary.successCount,
            'injectionSummary.successCount',
        ),
        failureCount: requireContentScriptSyncCount(
            summary.failureCount,
            'injectionSummary.failureCount',
        ),
    };
}

function requireContentScriptSyncReport(result) {
    const source = requireContentScriptSyncResultObject(result);
    return {
        missingDomains: requireContentScriptSyncArray(source, 'missingDomains'),
        hasScripting: requireContentScriptSyncBoolean(source, 'hasScripting'),
        injectionSummary: requireContentScriptSyncInjectionSummary(source),
    };
}

function requireRuntimeFlagSessionResult(session) {
    if (!isPlainObject(session)) {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_RUNTIME_FLAG_SESSION_INVALID');
    }
    return session;
}

export function createTrackingRuntimeCoordinator({
    settingsService,
    settingsCache,
    getGlobalCapState,
    broadcastSettingsUpdate,
    sweepExpiredPendingNudges,
    contentScriptRuntimeSync,
    protectionDispatcher,
    runtimeFlagRepository,
    notificationService,
    publishScheduleRuntimeState,
    globalCapSessionKey = STORAGE_SESSION_KEYS.GLOBAL_CAP_STATE,
} = {}) {
    if (
        !runtimeFlagRepository
        || typeof runtimeFlagRepository.get !== 'function'
        || typeof runtimeFlagRepository.set !== 'function'
    ) {
        throw new Error('TRACKING_RUNTIME_COORDINATOR_RUNTIME_FLAG_REPOSITORY_REQUIRED');
    }
    const settingsRuntime = requireSettingsService(settingsService);
    const settingsRuntimeCache = requireSettingsCache(settingsCache);
    const readGlobalCapState = requireGlobalCapStateOwner(getGlobalCapState);
    const notificationRuntime = requireNotificationService(notificationService);
    const contentScriptSync = requireContentScriptRuntimeSync(contentScriptRuntimeSync);
    const protectionRuntime = requireProtectionDispatcher(protectionDispatcher);
    let globalCapCheckTail = Promise.resolve();

    async function dispatchNotificationEvent(event) {
        return requireNotificationDispatchResult(await notificationRuntime.handleEvent(event));
    }

    async function runGlobalCapStatusCheck(now, { reportBootPhase = null } = {}) {
        if (reportBootPhase !== null && typeof reportBootPhase !== 'function') {
            throw new Error('TRACKING_RUNTIME_COORDINATOR_GLOBAL_CAP_BOOT_REPORTER_INVALID');
        }
        // Only startup supplies this synchronous diagnostic port. Ordinary cap
        // checks retain the same owner calls without recording a second history.
        const runPhase = reportBootPhase === null
            ? (_phase, task) => task()
            : async (phase, task) => {
                reportBootPhase(phase, { phase: 'started', failed: false });
                let failed = true;
                try {
                    const result = await task();
                    failed = false;
                    return result;
                } finally {
                    reportBootPhase(phase, { phase: 'settled', failed });
                }
            };
        await runPhase('settings', () => settingsRuntime.ensureSettingsCache());
        const capState = await runPhase('cap', async () => requireGlobalCapState(await readGlobalCapState(now)));
        const nextExceeded = capState.exceeded;
        const key = capState.dateStr;

        const prev = await runPhase('session_read', async () => {
            const session = requireRuntimeFlagSessionResult(
                await runtimeFlagRepository.get({ [globalCapSessionKey]: null }),
            );
            return normalizeGlobalCapRuntimeState(session[globalCapSessionKey]);
        });
        const prevExceeded = prev?.dateStr === key ? prev.exceeded : null;
        const shouldNotify = prevExceeded !== null && prevExceeded !== true
            && nextExceeded === true
            && settingsRuntimeCache.globalCapNotifyOnExceeded === true;

        if (prevExceeded === null || prevExceeded !== nextExceeded) {
            await runPhase('broadcast', async () => {
                const applied = await broadcastSettingsUpdate({ capStateOverride: capState });
                if (applied?.success !== true) throw createGlobalCapApplyError(applied);
            });
            await runPhase('session_write', () => runtimeFlagRepository.set({
                [globalCapSessionKey]: { dateStr: key, exceeded: nextExceeded },
            }));
            if (shouldNotify) {
                await runPhase('notification', () => dispatchNotificationEvent({
                    type: NOTIFICATION_EVENT_TYPES.GLOBAL_CAP_EXCEEDED,
                    deliveryKey: buildGlobalCapNotificationDeliveryKey(key),
                    occurredAt: now,
                    dateStr: key,
                    blockedTodayMs: capState.blockedTodayMs,
                    globalGoalMin: capState.globalGoalMin,
                }));
            }
        }
    }

    async function checkGlobalCapStatus(now = Date.now(), { reportBootPhase = null } = {}) {
        const operation = globalCapCheckTail.then(() => runGlobalCapStatusCheck(now, { reportBootPhase }));
        // The lane tracks settlement only. Each caller retains its own result or
        // rejection, and a later explicit check rereads the canonical checkpoint.
        globalCapCheckTail = operation.then(() => undefined, () => undefined);
        return operation;
    }

    async function syncManagedContentScripts({ injectOpenTabs = true, reason = 'unspecified', propagationContext = null } = {}) {
        requireSettingsPropagationContext(propagationContext);
        // Registration/prepaint reconciliation does not change browser grants.
        // Actual permission ingress still revokes existing dispatch receipts.
        protectionRuntime.refreshDispatchPermissionCaches();
        const result = await contentScriptSync.syncManagedContentScripts({
            injectOpenTabs,
            reason,
            propagationContext,
        });
        const report = requireContentScriptSyncReport(result);
        const { missingDomains, injectionSummary } = report;
        const catchUpReadinessAttemptedCount = injectionSummary.attemptedCount;
        const catchUpReadinessSuccessCount = injectionSummary.successCount;
        const catchUpReadinessFailureCount = injectionSummary.failureCount;

        if (report.hasScripting === false) {
            console.debug('[ManagedContentScriptSync][report] scripting permission missing', {
                reason,
                missingDomainCount: missingDomains.length,
            });
        } else if (missingDomains.length > 0 || catchUpReadinessFailureCount > 0) {
            console.debug('[ManagedContentScriptSync][report]', {
                reason,
                missingDomainCount: missingDomains.length,
                catchUpReadinessAttemptedCount,
                catchUpReadinessSuccessCount,
                catchUpReadinessFailureCount,
                sampleMissingDomains: missingDomains.slice(0, 8),
            });
        }

        return result;
    }

    const { checkScheduleStatus, endScheduleOccurrence, runManualSessionMutation, getSkippedOccurrenceId, getManualSession, applyScheduleRuntimeSettings } = createScheduleRuntimeCoordinator({
        settingsService: settingsRuntime, settingsCache: settingsRuntimeCache,
        runtimeFlagRepository, getGlobalCapState: readGlobalCapState,
        applyProtection: broadcastSettingsUpdate, notificationService: notificationRuntime,
        publishState: publishScheduleRuntimeState,
    });

    async function runNudgePendingSweep(source = 'alarm') {
        const now = Date.now();
        try {
            await sweepExpiredPendingNudges({
                now,
                reason: 'pending_timeout',
            });
        } catch (error) {
            console.warn('[TrackingService] Nudge pending sweep failed:', error?.message || error, source);
        }
    }

    return {
        checkGlobalCapStatus,
        syncManagedContentScripts,
        checkScheduleStatus,
        endScheduleOccurrence, runManualSessionMutation,
        getSkippedOccurrenceId,
        getManualSession, applyScheduleRuntimeSettings,
        runNudgePendingSweep,
    };
}
