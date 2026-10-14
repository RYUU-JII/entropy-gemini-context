/**
 * Stats runtime orchestration entrypoint.
 *
 * Background callers use this service to access hot runtime state, persistence,
 * and stats facts queries through the canonical stats owner path.
 */

import {
    createStatsRuntimeState,
    ensureStatsRuntimeState,
    getStatsFactsRuntimeRangeCacheDiagnostics,
    getStatsRuntimeDiagnostics,
    invalidateStatsFactsRuntimeRangeCacheFor,
} from './statsRuntimeCache.js';
import {
    createEmptyCategoryTotals,
    createEmptyDomainBehaviorStats,
    createEmptyDomainInterventionStats,
    createEmptyDomainNavigationStats,
    createEmptyDomainSessionStats,
    createEmptyHourlyRollup,
    STATS_SCHEMA_VERSION,
} from '../../contracts/statsContracts.js';
import {
    createStatsEventBridge,
} from '../contracts/statsEventBridge.js';
import {
    shouldEmitStatsCommittedEvent,
} from '../contracts/statsEventPolicy.js';
import { createStatsRuntimePersistenceService } from '../persistence/statsRuntimePersistenceService.js';
import { createStatsProfileMutationAdmissionOwner } from './statsProfileMutationAdmission.js';
import { createStatsFactsQueryService } from '../query/statsFactsQueryService.js';

const SWITCH_COUNTER_DEFAULTS = { toBlocked: 0, toAllowed: 0, toUnmanaged: 0, internal: 0 };
const SESSION_COUNTER_DEFAULTS = { count: 0, totalMs: 0 };

function resolveStatsRuntimeBrowserPort(browserPort) {
    if (
        typeof browserPort?.runtimeSendMessage !== 'function'
    ) {
        throw new Error('STATS_RUNTIME_BROWSER_PORT_REQUIRED');
    }
    return browserPort;
}

function requireStatsRuntimeOwnerMethod(owner, methodName, errorCode) {
    if (!owner || typeof owner[methodName] !== 'function') {
        throw new Error(errorCode);
    }
}

export function ensureDateTotals(dateData) {
    dateData.schemaVersion = STATS_SCHEMA_VERSION;
    if (!dateData.totals) dateData.totals = { totalActive: 0, totalBackground: 0, blockedActive: 0, blockedBackground: 0 };
    if (!dateData.byCategory) dateData.byCategory = createEmptyCategoryTotals();
    if (!dateData.switches) dateData.switches = { ...SWITCH_COUNTER_DEFAULTS };
    if (!dateData.sessions) dateData.sessions = { ...SESSION_COUNTER_DEFAULTS };
    if (!dateData.hourlyRollup) dateData.hourlyRollup = createEmptyHourlyRollup();
    if (!dateData.domains) dateData.domains = {};
}

export function ensureHourlyArrays(domainData) {
    if (!domainData.hourly) domainData.hourly = Array(24).fill(0);
    if (!domainData.hourlyActive) domainData.hourlyActive = Array(24).fill(0);
    if (!domainData.hourlyBackground) domainData.hourlyBackground = Array(24).fill(0);
    if (!domainData.hourlyVisits) domainData.hourlyVisits = Array(24).fill(0);
    if (!domainData.sessions) domainData.sessions = createEmptyDomainSessionStats();
    domainData.behavior = { ...createEmptyDomainBehaviorStats(), ...(domainData.behavior || {}) };
    if (!domainData.interventions) domainData.interventions = createEmptyDomainInterventionStats();
    if (!domainData.navigation) domainData.navigation = createEmptyDomainNavigationStats();
}

export function createStatsRuntimeService({
    runtimeState = createStatsRuntimeState(),
    statsRepository,
    statsAggregateRepository,
    browserPort,
    statsRuntimeHealthLedger,
} = {}) {
    if (
        !statsRepository
        || typeof statsRepository.loadRuntimeDaySnapshot !== 'function'
        || typeof statsRepository.readPendingHistoricalDayMaterializations !== 'function'
    ) {
        throw new Error('STATS_RUNTIME_SERVICE_REPOSITORY_REQUIRED');
    }
    if (
        !statsAggregateRepository
        || typeof statsAggregateRepository.upsertHourlyFactBuckets !== 'function'
        || typeof statsAggregateRepository.finalizeHistoricalDayFacts !== 'function'
    ) {
        throw new Error('STATS_RUNTIME_SERVICE_AGGREGATE_REPOSITORY_REQUIRED');
    }
    [
        'getSnapshot',
        'init',
        'quiesceForProfileMutation',
        'recordSaveStarted',
        'recordSaveCompleted',
        'recordSaveFailed',
    ].forEach((methodName) => {
        requireStatsRuntimeOwnerMethod(
            statsRuntimeHealthLedger,
            methodName,
            'STATS_RUNTIME_SERVICE_HEALTH_LEDGER_REQUIRED',
        );
    });

    const resolvedBrowserPort = resolveStatsRuntimeBrowserPort(browserPort);
    const statsEventBridge = createStatsEventBridge({
        browserPort: resolvedBrowserPort,
    });
    const runtime = ensureStatsRuntimeState(runtimeState);
    const profileMutationAdmissionOwner = createStatsProfileMutationAdmissionOwner();

    const persistenceService = createStatsRuntimePersistenceService({
        runtimeState: runtime,
        statsRepository,
        statsAggregateRepository,
        emitStatsCommitted: statsEventBridge.emitStatsCommitted,
        emitStatsReset: statsEventBridge.emitStatsReset,
        emitStatsRollover: statsEventBridge.emitStatsRollover,
        shouldEmitStatsCommittedEvent,
        statsRuntimeHealthLedger,
        profileMutationAdmissionOwner,
    });

    const statsFactsQueryService = createStatsFactsQueryService({
        runtimeState: runtime,
        statsRepository,
    });

    function invalidateStatsFactsRangeCache(options = {}) {
        profileMutationAdmissionOwner.assertOpen();
        return invalidateStatsFactsRuntimeRangeCacheFor(runtime, options);
    }

    function getStatsFactsRange(options = {}) {
        profileMutationAdmissionOwner.assertOpen();
        return statsFactsQueryService.getStatsFactsRange(options);
    }

    function quiesceForProfileMutation(context = {}) {
        const persistenceQuiesce = persistenceService.quiesceForProfileMutation(context);
        // Accepted saves may still publish their completion/failure diagnostics.
        // Close that producer before closing and draining its diagnostic mirror.
        // A failed producer drain forbids deletion and leaves this dependent
        // consumer available for the same terminal operation's retry diagnostics.
        return persistenceQuiesce.then(async (persistenceResult) => {
            const healthResult = await statsRuntimeHealthLedger.quiesceForProfileMutation(context);
            return Object.freeze({
                quiesced: true,
                reused: persistenceResult?.reused === true && healthResult?.reused === true,
            });
        });
    }

    return {
        ...persistenceService,
        getStatsRuntimeHealth: () => statsRuntimeHealthLedger.getSnapshot(),
        getStatsDiagnostics: () => getStatsRuntimeDiagnostics(runtime),
        getStatsFactsCacheDiagnostics: () => getStatsFactsRuntimeRangeCacheDiagnostics(runtime),
        getStatsFactsRange,
        initStatsRuntimeHealth: (options) => statsRuntimeHealthLedger.init(options),
        invalidateStatsFactsRangeCache,
        quiesceForProfileMutation,
    };
}
