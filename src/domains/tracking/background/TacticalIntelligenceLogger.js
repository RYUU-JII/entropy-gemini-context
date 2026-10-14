/**
 * TacticalIntelligenceLogger
 * 
 * Manages the collection of "Intelligence Snapshots" (Reclaimed Attention Data).
 * Stripped of simulation-noise (clicks, scrolls) to ensure absolute privacy and focus on sovereignty.
 */

import { buildFrictionFilters } from '../../settings/config/frictionPipeline.js';
import {
    resolveRetentionCutoffTimestamp,
    STORAGE_RETENTION_DAYS,
} from '../../../platform/storage/retention/storageRetentionPolicy.js';

const INTELLIGENCE_RETENTION_DAYS = STORAGE_RETENTION_DAYS.USAGE_LOGS;

function createEmptyTacticalBuffer() {
    return {
        tabSwitchCount: 0,
        pageLoadCount: 0,
        videoSkipCount: 0,
    };
}

function toErrorMessage(error) {
    return String(error?.message || error || 'UNKNOWN_ERROR');
}

export function createTacticalIntelligenceLogger({
    eventLogStore,
} = {}) {
    if (!eventLogStore || typeof eventLogStore.append !== 'function' || typeof eventLogStore.flush !== 'function') {
        throw new Error('TACTICAL_INTELLIGENCE_EVENT_LOG_STORE_REQUIRED');
    }

    let tacticalBuffer = createEmptyTacticalBuffer();
    let opSequence = 0;
    let isProcessing = false;
    let lastOperationalChangeAt = Date.now();

    function resetTacticalBuffer() {
        tacticalBuffer = createEmptyTacticalBuffer();
    }

    function getTacticalBuffer() {
        return tacticalBuffer;
    }

    function incrementTabSwitch() {
        tacticalBuffer.tabSwitchCount += 1;
    }

    function incrementPageLoad() {
        tacticalBuffer.pageLoadCount += 1;
    }

    function incrementVideoSkip() {
        tacticalBuffer.videoSkipCount += 1;
    }

    function updateOperationalTimestamp() {
        lastOperationalChangeAt = Date.now();
    }

    async function flushTacticalLogs({
        reason = 'heartbeat',
        activeTabInfo = null,
        buildBackgroundContext,
        readFilterSettings = null,
    } = {}) {
        if (isProcessing) {
            return {
                ok: false,
                skipped: true,
                reason,
                error: 'TACTICAL_LOG_FLUSH_IN_FLIGHT',
            };
        }
        isProcessing = true;

        try {
            if (typeof buildBackgroundContext !== 'function') {
                throw new Error('TACTICAL_BACKGROUND_CONTEXT_OWNER_REQUIRED');
            }
            const snapshot = { ...tacticalBuffer };
            resetTacticalBuffer();

            const now = Date.now();
            const hostname = activeTabInfo?.hostname || null;
            const diagnostics = [];

            let bgContext = { totalTabs: 0, audibleTabs: [], idleTabs: [] };

            try {
                const context = await buildBackgroundContext(now);
                if (!context || !Number.isSafeInteger(context.totalTabs) || context.totalTabs < 0
                    || !Array.isArray(context.audibleTabs) || !Array.isArray(context.idleTabs)) {
                    throw new Error('TACTICAL_BACKGROUND_CONTEXT_INVALID');
                }
                bgContext = context;
            } catch (error) {
                diagnostics.push({
                    code: 'TACTICAL_BACKGROUND_CONTEXT_FAILED',
                    error: toErrorMessage(error),
                });
            }

            let activeArtifacts = [];
            let interventionIntensity = 0;
            try {
                const filterSettings = typeof readFilterSettings === 'function'
                    ? await readFilterSettings()
                    : null;
                const filters = buildFrictionFilters(filterSettings || {});
                for (const [key, val] of Object.entries(filters)) {
                    if (val?.isActive) {
                        activeArtifacts.push(key);
                        if (typeof val.value === 'number') interventionIntensity += val.value;
                    }
                }
            } catch (error) {
                diagnostics.push({
                    code: 'TACTICAL_FILTER_SETTINGS_FAILED',
                    error: toErrorMessage(error),
                });
            }

            const logEntry = {
                logType: 'intelligence',
                id: ++opSequence,
                timestamp: now,
                durationInCurrentState: now - lastOperationalChangeAt,
                reason,
                metadata: {
                    hostname,
                    ...(diagnostics.length > 0 ? { diagnostics } : {}),
                },
                operationalEnv: {
                    totalActiveTabs: bgContext.totalTabs,
                    audibleSignalHosts: bgContext.audibleTabs,
                },
                reclamationMarkers: {
                    tabSwitches: snapshot.tabSwitchCount,
                    pageLoads: snapshot.pageLoadCount,
                    videoInterventions: snapshot.videoSkipCount,
                },
                tacticalState: {
                    activeArtifacts,
                    interventionIntensity,
                },
            };

            const receipt = await eventLogStore.append(logEntry);
            if (receipt?.accepted === false && receipt.reason === 'data_locked') {
                return { ok: true, skipped: true, reason: 'data_locked', trigger: reason, diagnostics };
            }
            if (receipt?.accepted !== true) throw new Error('TACTICAL_LOG_APPEND_RECEIPT_INVALID');
            await eventLogStore.flush();
            return {
                ok: true,
                skipped: false,
                reason,
                diagnostics,
            };
        } catch (err) {
            console.error(`[TacticalLogger] Dispatch failed: ${toErrorMessage(err)}`);
            return {
                ok: false,
                skipped: false,
                reason,
                error: toErrorMessage(err),
            };
        } finally {
            isProcessing = false;
        }
    }

    async function cleanupOldIntelligenceLogs({ now = Date.now() } = {}) {
        const cutoffTs = resolveRetentionCutoffTimestamp({
            now,
            days: INTELLIGENCE_RETENTION_DAYS,
            fallbackDays: STORAGE_RETENTION_DAYS.USAGE_LOGS,
        });
        await eventLogStore.flush();
        const removed = await eventLogStore.pruneBefore(cutoffTs);
        return {
            removed: Number(removed) || 0,
            cutoffTs,
            retentionDays: INTELLIGENCE_RETENTION_DAYS,
        };
    }

    return {
        cleanupOldIntelligenceLogs,
        flushTacticalLogs,
        getTacticalBuffer,
        incrementPageLoad,
        incrementTabSwitch,
        incrementVideoSkip,
        resetTacticalBuffer,
        updateOperationalTimestamp,
    };
}
