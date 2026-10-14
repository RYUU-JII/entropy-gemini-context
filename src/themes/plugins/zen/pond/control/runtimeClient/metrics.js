import { normalizeZenPondFrameMetrics } from '../../contracts/zenPondFrameMetrics.js';

import { isObject } from './sharedUtils.js';
import {
    normalizeZenRendererWorkJournal,
    ZEN_RENDERER_WORK_JOURNAL_ENABLED,
} from '../../../runtime/worker/zenRendererWorkJournal.js';

import {
    ZEN_SURFACE_DISTURBANCE_SOURCES,
    ZEN_SURFACE_DISTURBANCE_TELEMETRY_CONTRACT,
    ZEN_SURFACE_DISTURBANCE_TELEMETRY_VERSION,
} from '../../runtime/surface/zenSurfaceDisturbance.js';

export { normalizeZenPondWaterEffectsMetrics as normalizeTopShadowProbe } from '../../contracts/zenPondFrameMetrics.js';

const normalizeSurfaceDisturbanceTelemetry = (value) => {
    if (!isObject(value)) return null;
    if (
        value.contract
            !== ZEN_SURFACE_DISTURBANCE_TELEMETRY_CONTRACT
        || value.version
            !== ZEN_SURFACE_DISTURBANCE_TELEMETRY_VERSION
    ) {
        throw new Error(
            'ZEN_SURFACE_DISTURBANCE_TELEMETRY_CONTRACT_INVALID',
        );
    }
    const bySource = {};
    const requested = {};
    Object.values(ZEN_SURFACE_DISTURBANCE_SOURCES).forEach(
        (source) => {
            const bucket = value.bySource?.[source];
            if (!isObject(bucket)) {
                throw new Error(
                    'ZEN_SURFACE_DISTURBANCE_TELEMETRY_SOURCE_MISSING:'
                    + source,
                );
            }
            const requestedValue = value.requested?.[source];
            if (
                requestedValue !== true
                && requestedValue !== false
            ) {
                throw new Error(
                    'ZEN_SURFACE_DISTURBANCE_TELEMETRY_REQUEST_MISSING:'
                    + source,
                );
            }
            requested[source] = requestedValue;
            bySource[source] = {
                candidateCount: Math.max(
                    0,
                    Math.floor(
                        Number(bucket.candidateCount) || 0,
                    ),
                ),
                admittedCount: Math.max(
                    0,
                    Math.floor(
                        Number(bucket.admittedCount) || 0,
                    ),
                ),
                suppressedCount: Math.max(
                    0,
                    Math.floor(
                        Number(bucket.suppressedCount) || 0,
                    ),
                ),
                activeCount: Math.max(
                    0,
                    Math.floor(
                        Number(bucket.activeCount) || 0,
                    ),
                ),
            };
        },
    );
    return {
        contract:
            ZEN_SURFACE_DISTURBANCE_TELEMETRY_CONTRACT,
        version:
            ZEN_SURFACE_DISTURBANCE_TELEMETRY_VERSION,
        sequence: Math.max(
            0,
            Math.floor(Number(value.sequence) || 0),
        ),
        candidateCount: Math.max(
            0,
            Math.floor(Number(value.candidateCount) || 0),
        ),
        admittedCount: Math.max(
            0,
            Math.floor(Number(value.admittedCount) || 0),
        ),
        suppressedCount: Math.max(
            0,
            Math.floor(Number(value.suppressedCount) || 0),
        ),
        activeCount: Math.max(
            0,
            Math.floor(Number(value.activeCount) || 0),
        ),
        requested,
        bySource,
    };
};

const normalizeNullableMetric = (value) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const normalizeNullableNonNegativeMetric = (value) => {
    const numeric = normalizeNullableMetric(value);
    return numeric !== null && numeric >= 0 ? numeric : null;
};

const normalizeFrameSpike = (value) => {
    if (!isObject(value)) return null;
    return {
        atMs: normalizeNullableMetric(value.atMs),
        frameCount: Math.max(0, Math.floor(Number(value.frameCount) || 0)),
        frameIntervalMs: normalizeNullableMetric(value.frameIntervalMs),
        frameMs: normalizeNullableMetric(value.frameMs),
        previousFrameStartedAtMs: normalizeNullableNonNegativeMetric(value.previousFrameStartedAtMs),
        previousSceneTickFrameMs: normalizeNullableNonNegativeMetric(value.previousSceneTickFrameMs),
        runtimeParamSyncCount: Math.max(0, Math.floor(Number(value.runtimeParamSyncCount) || 0)),
        fishRosterSyncCount: Math.max(0, Math.floor(Number(value.fishRosterSyncCount) || 0)),
        sceneSessionSyncCount: Math.max(0, Math.floor(Number(value.sceneSessionSyncCount) || 0)),
        mainMetrics: normalizeZenPondFrameMetrics(value.mainMetrics),
    };
};

const normalizeHomeWorkEntry = (value) => {
    if (
        value.channel !== 'bonsai'
        || !['bonsai_scene', 'bonsai_frame'].includes(value.event)
        || !Number.isFinite(value.receivedAtMs)
    ) {
        throw new Error('ZEN_HOME_RENDERER_WORK_JOURNAL_ENTRY_INVALID');
    }
    return {
        event: value.event,
        channel: value.channel,
        channelSessionId: value.channelSessionId,
        sceneSequence: value.sceneSequence,
        sceneSignature: value.sceneSignature,
        sceneCommitKey: value.sceneCommitKey,
        receivedAtMs: value.receivedAtMs,
        frameCount: value.frameCount,
        sceneSyncMs: normalizeNullableMetric(value.sceneSyncMs),
        staticLayersRebaked: value.staticLayersRebaked === true,
        branchRigRebuilt: value.branchRigRebuilt === true,
        workerTiming: normalizeRuntimeHealthMsMap(value.workerTiming),
    };
};

const normalizeRuntimeHealthEvent = (event = null) => {
    if (!isObject(event)) return null;
    const name = typeof event.name === 'string' ? event.name.trim() : '';
    if (!name) return null;
    return {
        seq: Math.max(0, Math.floor(Number(event.seq) || 0)),
        name,
        atMs: Math.max(0, Number((Number(event.atMs) || 0).toFixed(1))),
        frame: Math.max(0, Math.floor(Number(event.frame) || 0)),
        ...(isObject(event.details) ? { details: { ...event.details } } : {}),
        ...(typeof event.stack === 'string' && event.stack ? { stack: event.stack } : {}),
    };
};

const normalizeRuntimeHealthMsMap = (value = null) => {
    if (!isObject(value)) return null;
    const normalized = {};
    Object.entries(value).forEach(([key, entry]) => {
        if (entry === null) {
            normalized[key] = null;
            return;
        }
        const numeric = Number(entry);
        normalized[key] = Number.isFinite(numeric) ? Number(numeric) : null;
    });
    return normalized;
};

const normalizeRendererModuleAdmission = (value = null) => (
    isObject(value)
        ? {
            started: value.started === true,
            completed: value.completed === true,
            startedBeforeInit: value.startedBeforeInit === true,
            startedBeforeEngineWait: value.startedBeforeEngineWait === true,
            completedBeforeEngineWait: value.completedBeforeEngineWait === true,
            durationMs: Number.isFinite(Number(value.durationMs))
                ? Number(value.durationMs)
                : null,
            leadToEngineWaitMs: Number.isFinite(Number(value.leadToEngineWaitMs))
                ? Number(value.leadToEngineWaitMs)
                : null,
        }
        : null
);

const normalizeRuntimeHealthInitOrder = (value = null) => (
    isObject(value)
        ? {
            initCanvasReceived: value.initCanvasReceived === true,
            canvasInitialized: value.canvasInitialized === true,
            runtimeParamsApplied: value.runtimeParamsApplied === true,
            frameStateReady: value.frameStateReady === true,
            ambientSyncAttempted: value.ambientSyncAttempted === true,
            ambientSyncCompleted: value.ambientSyncCompleted === true,
            firstFrameAcked: value.firstFrameAcked === true,
            frameStateBeforeAmbient: value.frameStateBeforeAmbient === true,
            ambientBeforeFirstFrame: value.ambientBeforeFirstFrame === true,
            rendererModuleAdmission: normalizeRendererModuleAdmission(
                value.rendererModuleAdmission,
            ),
            fromInitMs: normalizeRuntimeHealthMsMap(value.fromInitMs),
            deltasMs: normalizeRuntimeHealthMsMap(value.deltasMs),
            waitGapsMs: normalizeRuntimeHealthMsMap(value.waitGapsMs),
            workSpansMs: normalizeRuntimeHealthMsMap(value.workSpansMs),
            budgetMs: normalizeRuntimeHealthMsMap(value.budgetMs),
            ok: value.ok === true,
        }
        : null
);

const normalizeRuntimeHealth = (value = null) => {
    if (!isObject(value)) return null;
    const milestones = {};
    Object.entries(value.milestones || {}).forEach(([name, event]) => {
        const normalized = normalizeRuntimeHealthEvent(event);
        if (normalized) milestones[name] = normalized;
    });
    return {
        sequence: Math.max(0, Math.floor(Number(value.sequence) || 0)),
        eventLimit: Math.max(0, Math.floor(Number(value.eventLimit) || 0)),
        initOrder: normalizeRuntimeHealthInitOrder(value.initOrder),
        milestones,
        events: Array.isArray(value.events)
            ? value.events.map(normalizeRuntimeHealthEvent).filter(Boolean)
            : [],
    };
};

export const normalizeMetrics = (value) => (
    isObject(value)
        ? {
            path: 'worker',
            sampleFrames: Math.max(0, Math.floor(Number(value.sampleFrames) || 0)),
            totalDtMs: Number(value.totalDtMs) || 0,
            avgDtMs: Number(value.avgDtMs) || 0,
            maxDtMs: Number(value.maxDtMs) || 0,
            over24: Math.max(0, Math.floor(Number(value.over24) || 0)),
            over32: Math.max(0, Math.floor(Number(value.over32) || 0)),
            over50: Math.max(0, Math.floor(Number(value.over50) || 0)),
            over100: Math.max(0, Math.floor(Number(value.over100) || 0)),
            sceneSessionSyncCount: Math.max(0, Math.floor(Number(value.sceneSessionSyncCount) || 0)),
            runtimeParamSyncCount: Math.max(0, Math.floor(Number(value.runtimeParamSyncCount) || 0)),
            fishRosterSyncCount: Math.max(0, Math.floor(Number(value.fishRosterSyncCount) || 0)),
            ambientPopulationSyncCount: Math.max(0, Math.floor(Number(value.ambientPopulationSyncCount) || 0)),
            viewportReflowCount: Number(value.viewportReflowCount),
            viewport: value.viewport,
            sceneLayout: value.sceneLayout,
            staticSceneSyncCount: Math.max(0, Math.floor(Number(value.staticSceneSyncCount) || 0)),
            supportsWorkerRaf: typeof value.supportsWorkerRaf === 'boolean'
                ? value.supportsWorkerRaf
                : null,
            qualityMode: typeof value.qualityMode === 'string' ? value.qualityMode : null,
            mainMetrics: normalizeZenPondFrameMetrics(value.mainMetrics),
            ...(ZEN_RENDERER_WORK_JOURNAL_ENABLED ? {
                lastSpike: normalizeFrameSpike(value.lastSpike),
                spikeJournal: normalizeZenRendererWorkJournal(value.spikeJournal, normalizeFrameSpike),
                homeRendererJournal: normalizeZenRendererWorkJournal(value.homeRendererJournal, normalizeHomeWorkEntry),
            } : {}),
            surfaceDisturbanceTelemetry:
                normalizeSurfaceDisturbanceTelemetry(
                    value.surfaceDisturbanceTelemetry,
                ),
            runtimeHealth: normalizeRuntimeHealth(value.runtimeHealth),
        }
        : null
);
