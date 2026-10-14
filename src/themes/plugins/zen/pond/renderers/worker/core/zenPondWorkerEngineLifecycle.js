import { commitZenPondViewportReflow } from './zenPondWorkerWorldSync.js';
import {
    buildDefaultRefs,
    buildDefaultRuntimeParams,
    createBackgroundHost,
    createWorldSyncCache,
} from './zenPondWorkerEngine.js';
import { createEnvironmentRuntimeState } from './zenPondWorkerEnvironmentPresentation.js';
import { ZEN_QUALITY_MODE_FULL } from './zenPondWorkerPolicy.js';
import {
    ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED,
    createZenPondRuntimeHealthState,
    recordZenPondBootTimelineEvent,
    recordZenPondRuntimeHealthEvent,
} from './zenPondWorkerRuntimeHealth.js';
import {
    createZenSurfaceDisturbanceTelemetryState,
} from '../../../runtime/surface/zenSurfaceDisturbance.js';
import {
    ZEN_POND_WORKER_STARTUP_READINESS_REASON,
    ZEN_POND_WORKER_STARTUP_STAGE,
    createZenPondWorkerStartupProgress,
    sanitizeZenPondWorkerStartupError,
} from './zenPondWorkerStartupContract.js';

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const buildFirstFrameAssetReadinessDetails = (readiness = null) => {
    const source = isObject(readiness) ? readiness : null;
    const timings = isObject(source?.preparationTimings)
        ? source.preparationTimings
        : null;
    const readBoolean = (value) => (
        typeof value === 'boolean' ? value : null
    );
    const readNumber = (value) => (
        value !== null
        && value !== undefined
        && Number.isFinite(Number(value))
            ? Number(value)
            : null
    );
    return {
        waterLayerRequested: readBoolean(source?.waterLayerRequested),
        waterLayerReady: readBoolean(source?.waterLayerReady),
        surfaceFilterRequested: readBoolean(source?.surfaceFilterRequested),
        surfaceFilterReady: readBoolean(source?.surfaceFilterReady),
        surfaceFieldRequested: readBoolean(source?.surfaceFieldRequested),
        surfaceFieldReady: readBoolean(source?.surfaceFieldReady),
        totalMs: readNumber(timings?.totalMs),
        snapshotResolveMs: readNumber(timings?.snapshotResolveMs),
        layerRequestMs: readNumber(timings?.layerRequestMs),
        surfaceFilterEnsureMs: readNumber(timings?.surfaceFilterEnsureMs),
        surfaceFieldEnsureMs: readNumber(timings?.surfaceFieldEnsureMs),
        layerAwaitMs: readNumber(timings?.layerAwaitMs),
        layerTransitionTotalMs: readNumber(timings?.layerTransitionTotalMs),
        layerFactoryLoadMs: readNumber(timings?.layerFactoryLoadMs),
        layerBuildMs: readNumber(timings?.layerBuildMs),
        layerActivateMs: readNumber(timings?.layerActivateMs),
        layerInitTotalMs: readNumber(timings?.layerInitTotalMs),
        layerTextureBuildTotalMs: readNumber(timings?.layerTextureBuildTotalMs),
        layerTextureSetupMs: readNumber(timings?.layerTextureSetupMs),
        pebbleTextureBuildMs: readNumber(timings?.pebbleTextureBuildMs),
        pebbleDetailTextureBuildMs: readNumber(timings?.pebbleDetailTextureBuildMs),
        causticTextureBuildMs: readNumber(timings?.causticTextureBuildMs),
        mistTextureBuildMs: readNumber(timings?.mistTextureBuildMs),
        topShadowTextureBuildMs: readNumber(timings?.topShadowTextureBuildMs),
        skyReflectionTextureBuildMs: readNumber(timings?.skyReflectionTextureBuildMs),
        layerTextureCacheHit: readBoolean(timings?.layerTextureCacheHit),
        layerTextureBottleneckStage:
            typeof timings?.layerTextureBottleneckStage === 'string'
                ? timings.layerTextureBottleneckStage
                : null,
        layerTextureBottleneckMs: readNumber(timings?.layerTextureBottleneckMs),
    };
};

const AFTER_RENDER_ERROR_BREAKER_THRESHOLD = 3;
const STARTUP_PRIME_RUNTIME_LOOP_FRAMES = 2;
const STARTUP_RAF_LIVENESS_WATCHDOG_MS = 120;

const isRuntimeLoopRenderSource = (source) => (
    typeof source === 'string'
    && source.startsWith('runtime_loop')
);

export const createZenPondWorkerEngineLifecycle = ({
    modules,
    state,
    messageType,
    rendererKind,
    nowMs,
    telemetry,
    applyWorkerCanvasEventSurface,
    collectWorkerRendererDiagnostics,
    collectCanvasWebGLTextureCaps,
    resolveDepthTexture,
    syncAmbientEntitiesForState,
    syncFishRosterForState,
    updateRuntimeEnvironmentForState,
    recordFrameMetrics,
    emitRendererEvent,
    emitWorkerRuntimeDebug,
    emitWorkerRuntimeWarn,
    emitWorkerStartupProgress,
} = {}) => {
    let startRequestId = 0;
    let consecutiveAfterRenderErrors = 0;
    let emittedStartupProgressSignatures = new Set();

    const reportStartupProgress = (stage, reason = null) => {
        const progress = createZenPondWorkerStartupProgress({ stage, reason });
        const signature = `${progress.stage}:${progress.reason || ''}`;
        if (emittedStartupProgressSignatures.has(signature)) return progress;
        emittedStartupProgressSignatures.add(signature);
        emitWorkerStartupProgress(progress);
        return progress;
    };

    const bumpStartRequestId = () => {
        startRequestId += 1;
        return startRequestId;
    };

    const isActiveStartRequest = (requestId) => (
        requestId === startRequestId
    );

    const resolveMountZenPixiSceneRenderer = async () => {
        if (typeof modules.loadZenPixiSceneRenderer === 'function') {
            return modules.loadZenPixiSceneRenderer();
        }
        if (typeof modules.mountZenPixiSceneRenderer === 'function') {
            return modules.mountZenPixiSceneRenderer;
        }
        throw new Error('ZEN_POND_WORKER_RENDERER_LOADER_MISSING');
    };

    const stopEngine = ({
        keepData = true,
        invalidatePendingStart = true,
        preserveCanvasContext = false,
    } = {}) => {
        if (invalidatePendingStart) {
            bumpStartRequestId();
        }
        try {
            state.runtimeStopLoop?.();
        } catch (error) {
            emitWorkerRuntimeWarn('stop_engine_loop', error);
        }
        state.runtimeStopLoop = null;

        try {
            state.scene?.dispose?.({
                preserveCanvasContext: preserveCanvasContext === true,
            });
        } catch (error) {
            emitWorkerRuntimeWarn('stop_engine_scene_dispose', error);
        }
        state.scene = null;

        state.depthTextureCache = { key: '', canvas: null };
        state.lastSceneFrameMetrics = null;
        state.lastSceneFrameSpike = null;
        state.lastFrameAtMs = 0;
        state.firstFrameRuntimeLoopMounted = false;
        consecutiveAfterRenderErrors = 0;

        if (!keepData) {
            state.refs.fishRef.current = [];
            state.refs.fishRef.rosterLifecycle = null;
            state.refs.activityProfileByDomainRef.current = new Map();
            state.refs.dummyFishRef.current = [];
            state.refs.surfaceDisturbancesRef.current = [];
            state.refs.surfaceDisturbanceTelemetryRef.current =
                createZenSurfaceDisturbanceTelemetryState();
            state.refs.surfaceDisturbanceEventsRef.current = [];
            state.refs.interactionStimuliRef.current = [];
            state.refs.bathymetryFieldRef.current = null;
            state.refs.lilyPadsRef.current = [];
            state.refs.waterLilyRef.current = [];
            state.refs.zenIrisClustersRef.current = [];
            state.refs.particlesRef.current = [];
            state.refs.petalsRef.current = [];
            state.refs.glimmersRef.current = [];
            state.refs.rocksRef.current = [];
            state.refs.commonEnvContextRef.current = null;
            state.environmentRuntime = createEnvironmentRuntimeState();
        }
    };

    const startEngine = async ({ requestId } = {}) => {
        if (!state.canvas || !state.width || !state.height) {
            throw new Error('ZEN_POND_WORKER_NOT_READY');
        }
        emittedStartupProgressSignatures = new Set();
        reportStartupProgress(ZEN_POND_WORKER_STARTUP_STAGE.ENGINE_STARTING);

        let recordedProgramCompilationCount = 0;
        let recordedProgramContextCount = 0;
        let recordedFirstRenderCalls = false;
        const recordFirstRenderCalls = (diagnostics, timestampMs) => {
            if (ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED !== true) return;
            if (recordedFirstRenderCalls || diagnostics?.enabled !== true) return;
            recordedFirstRenderCalls = true;
            recordZenPondBootTimelineEvent(state, 'first_render_call_summary', {
                contract: diagnostics.contract,
                scope: diagnostics.scope,
                timingScope: diagnostics.timingScope,
                count: diagnostics.count,
                topLevelCount: diagnostics.topLevelCount,
                nestedCount: diagnostics.nestedCount,
                maxDepth: diagnostics.maxDepth,
                observedCallCount: diagnostics.observedCallCount,
                observedTopLevelCount: diagnostics.observedTopLevelCount,
                timingsComplete: diagnostics.timingsComplete,
                totalInclusiveCallMs: diagnostics.totalInclusiveCallMs,
                totalTopLevelMs: diagnostics.totalTopLevelMs,
                totalSelfMs: diagnostics.totalSelfMs,
                omittedCallCount: diagnostics.omittedCallCount,
                observationFailureCount: diagnostics.observationFailureCount,
                lastObservationFailure: diagnostics.lastObservationFailure,
            }, { timestampMs });
            diagnostics.calls.forEach(entry => {
                recordZenPondBootTimelineEvent(state, `first_render_call:${entry.ordinal}`, entry, {
                    timestampMs: entry.startedAtMs ?? timestampMs,
                });
            });
            diagnostics.phaseTotals.forEach(entry => {
                recordZenPondBootTimelineEvent(state, `first_render_call_phase:${entry.phase}`, entry, { timestampMs });
            });
        };
        const recordStartupProgramCompilation = () => {
            if (ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED !== true) return;
            const diagnostics = state.scene?.getProgramCompilationDiagnostics?.();
            if (diagnostics?.enabled !== true) return;
            diagnostics.contexts.slice(recordedProgramContextCount).forEach((context) => {
                recordZenPondBootTimelineEvent(state, `startup_program_context:${context.contextUid}`, context, {
                    timestampMs: context.atMs,
                });
            });
            diagnostics.programs.slice(recordedProgramCompilationCount).forEach((program) => {
                recordZenPondBootTimelineEvent(state, `startup_program_compile:${recordedProgramCompilationCount}`, program, {
                    timestampMs: program.atMs,
                });
                const glCalls = program.glCalls;
                if (glCalls) {
                    const correlation = {
                        programOrdinal: program.programOrdinal,
                        parentProgramOrdinal: program.parentProgramOrdinal,
                        name: program.name, contextUid: program.contextUid, phase: program.phase,
                    };
                    const groupTotals = {};
                    glCalls.groups.forEach((group) => {
                        groupTotals[`${group.group}Count`] = group.count;
                        groupTotals[`${group.group}ObservedCallCount`] = group.observedCallCount;
                        groupTotals[`${group.group}FailedCallCount`] = group.failedCallCount;
                        groupTotals[`${group.group}TotalMs`] = group.totalMs;
                        groupTotals[`${group.group}MaxMs`] = group.maxMs;
                    });
                    recordZenPondBootTimelineEvent(state, `startup_program_gl_summary:${program.programOrdinal}`, {
                        ...correlation, contract: glCalls.contract, enabled: glCalls.enabled, reason: glCalls.reason,
                        programStartedAtMs: program.atMs, programCompletedAtMs: program.completedAtMs,
                        programTotalMs: program.totalMs, count: glCalls.count,
                        observedCallCount: glCalls.observedCallCount, failedCallCount: glCalls.failedCallCount,
                        timingsComplete: glCalls.timingsComplete, totalCallMs: glCalls.totalCallMs,
                        maxCallMs: glCalls.maxCallMs, groupCount: glCalls.groups.length,
                        maxSlowCalls: glCalls.maxSlowCalls, omittedSlowCallCount: glCalls.omittedSlowCallCount,
                        observationFailureCount: glCalls.observationFailureCount,
                        lastObservationFailure: glCalls.lastObservationFailure, ...groupTotals,
                    }, { timestampMs: program.atMs });
                    glCalls.slowCalls.forEach((call) => {
                        recordZenPondBootTimelineEvent(state, `startup_program_gl_call:${program.programOrdinal}:${call.ordinal}`, {
                            ...correlation, ...call,
                        }, { timestampMs: call.startedAtMs ?? program.atMs });
                    });
                }
                recordedProgramCompilationCount += 1;
            });
            recordedProgramContextCount = diagnostics.contexts.length;
            recordedProgramCompilationCount = diagnostics.programs.length;
            recordZenPondBootTimelineEvent(state, 'startup_program_compilation_summary', {
                programCount: diagnostics.programCount,
                droppedProgramCount: diagnostics.droppedProgramCount,
                droppedContextCount: diagnostics.droppedContextCount,
                maxPrograms: diagnostics.maxPrograms,
                timingScope: diagnostics.timingScope,
                observationFailureCount: diagnostics.observationFailureCount,
                lastObservationFailureName: diagnostics.lastObservationFailureName,
            });
        };

        const renderSceneFrame = ({
            elapsedMs = 16.667,
            source = 'runtime_loop',
        } = {}) => {
            try {
                if (!state.scene?.active) {
                    if (state.firstFrameAckEmitted !== true) {
                        recordZenPondBootTimelineEvent(state, 'first_render_tick_skipped', {
                            reason: 'scene_inactive',
                            source,
                            hasScene: Boolean(state.scene),
                            active: state.active === true,
                        });
                    }
                    return false;
                }
                const stamp = nowMs();
                const shouldRecordFirstRenderTick = state.firstRenderTickRecorded !== true;
                if (shouldRecordFirstRenderTick) {
                    recordZenPondBootTimelineEvent(state, 'first_render_tick_start', {
                        elapsedMs: Number((Number(elapsedMs) || 0).toFixed(3)),
                        source,
                    }, {
                        timestampMs: stamp,
                    });
                }
                updateRuntimeEnvironmentForState?.(modules, state, stamp);
                const tickMetrics = state.scene.tick(Number(elapsedMs) || 16.667);
                const frameReadyStamp = nowMs();
                if (state.firstFrameAckEmitted !== true) recordStartupProgramCompilation();
                consecutiveAfterRenderErrors = 0;
                recordFrameMetrics(state, tickMetrics, stamp);
                if (isRuntimeLoopRenderSource(source)) {
                    state.firstFrameRuntimeLoopFrameCount = Math.max(
                        0,
                        Math.floor(Number(state.firstFrameRuntimeLoopFrameCount) || 0),
                    ) + 1;
                }
                state.firstFrameLastRenderSource = source;
                if (shouldRecordFirstRenderTick) {
                    const textureUploads = isObject(tickMetrics?.textureUploads)
                        ? tickMetrics.textureUploads
                        : null;
                    const stageMetrics = isObject(tickMetrics?.stageMs)
                        ? tickMetrics.stageMs
                        : null;
                    const renderCalls = ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED
                        && isObject(tickMetrics?.renderCalls) ? tickMetrics.renderCalls : null;
                    recordZenPondBootTimelineEvent(state, 'first_render_tick_end', {
                        frameMs: Number(tickMetrics?.frameMs) || 0,
                        updateMs: Number(tickMetrics?.updateMs) || 0,
                        renderMs: Number(tickMetrics?.renderMs) || 0,
                        worldRenderMs: Number(tickMetrics?.worldRenderMs) || 0,
                        stageRenderMs: Number(tickMetrics?.stageRenderMs) || 0,
                        textureUploadProbeEnabled: textureUploads?.enabled === true,
                        textureUploadCount: Number(textureUploads?.count) || 0,
                        textureUploadTotalMs: Number(textureUploads?.totalMs) || 0,
                        textureUploadTotalBytes: Number(textureUploads?.totalBytes) || 0,
                        textureUploadScope: textureUploads?.scope || null,
                        textureUploadOmittedCount: Number(textureUploads?.omittedUploadCount) || 0,
                        textureUploadObservationFailureCount: Number(textureUploads?.observationFailureCount) || 0,
                        beginFrameMs: Number(stageMetrics?.beginFrameMs) || 0,
                        readabilityMs: Number(stageMetrics?.readabilityMs) || 0,
                        waterPassMs: Number(stageMetrics?.waterPassMs) || 0,
                        backgroundFxTickMs: Number(stageMetrics?.backgroundFxTickMs) || 0,
                        waterEffectsTickMs: Number(stageMetrics?.waterEffectsTickMs) || 0,
                        waterSurfaceFilterTickMs: Number(stageMetrics?.waterSurfaceFilterTickMs) || 0,
                        surfaceFieldSubmitMs: Number(stageMetrics?.surfaceFieldSubmitMs) || 0,
                        cloudReflectionBakeMs: Number(stageMetrics?.cloudReflectionBakeMs) || 0,
                        staticBaseBakeMs: Number(stageMetrics?.staticBaseBakeMs) || 0,
                        floorBaseBakeMs: Number(stageMetrics?.floorBaseBakeMs) || 0,
                        rockCastBakeMs: Number(stageMetrics?.rockCastBakeMs) || 0,
                        rockMaterialBakeMs: Number(stageMetrics?.rockMaterialBakeMs) || 0,
                        entitySyncMs: Number(stageMetrics?.entitySyncMs) || 0,
                        createdFishCount: Number(tickMetrics?.koiRender?.createdFishCount) || 0,
                        fishCreationMs: Number(tickMetrics?.koiRender?.creationTotalMs) || 0,
                        fishUpdateMs: Number(tickMetrics?.koiRender?.updateTotalMs) || 0,
                        slowestFishCreationMs: Number(tickMetrics?.koiRender?.slowestCreationMs) || 0,
                        slowestFishCreationUid: tickMetrics?.koiRender?.slowestCreationUid || '',
                        koiBodyCacheEntryCount: Number(tickMetrics?.koiRender?.bodyCacheEntryCount) || 0,
                        koiBodyCacheReferenceCount: Number(tickMetrics?.koiRender?.bodyCacheReferenceCount) || 0,
                        source,
                        ...(ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED ? {
                            renderCallProbeEnabled: renderCalls?.enabled === true,
                            renderCallScope: renderCalls?.scope ?? null,
                            renderCallCount: renderCalls?.count ?? null,
                            renderCallTopLevelCount: renderCalls?.topLevelCount ?? null,
                            renderCallNestedCount: renderCalls?.nestedCount ?? null,
                            renderCallTimingsComplete: renderCalls?.timingsComplete ?? null,
                            renderCallTopLevelMs: renderCalls?.totalTopLevelMs ?? null,
                            renderCallInclusiveMs: renderCalls?.totalInclusiveCallMs ?? null,
                            renderCallSelfMs: renderCalls?.totalSelfMs ?? null,
                            renderCallOmittedCount: renderCalls?.omittedCallCount ?? null,
                            renderCallObservationFailureCount: renderCalls?.observationFailureCount ?? null,
                        } : {}),
                    }, {
                        timestampMs: frameReadyStamp,
                    });
                    recordFirstRenderCalls(renderCalls, frameReadyStamp);
                    if (textureUploads?.enabled === true) {
                        textureUploads.phaseTotals?.forEach?.((entry) => {
                            recordZenPondBootTimelineEvent(state, `first_render_texture_phase:${entry.phase}`, {
                                phase: entry.phase, count: entry.count,
                                totalMs: entry.totalMs, totalBytes: entry.totalBytes,
                            }, { timestampMs: frameReadyStamp });
                        });
                        textureUploads.topUploads?.forEach?.((entry, index) => {
                            recordZenPondBootTimelineEvent(state, 'first_render_texture_upload', {
                                rank: index + 1,
                                ordinal: Number.isInteger(entry?.ordinal) && entry.ordinal > 0
                                    ? entry.ordinal : null,
                                startedAtMs: typeof entry?.startedAtMs === 'number'
                                    && Number.isFinite(entry.startedAtMs) ? entry.startedAtMs : null,
                                completedAtMs: typeof entry?.completedAtMs === 'number'
                                    && Number.isFinite(entry.completedAtMs) ? entry.completedAtMs : null,
                                phase: entry?.phase || '',
                                durationMs: Number(entry?.durationMs) || 0,
                                width: Number(entry?.width) || 0,
                                height: Number(entry?.height) || 0,
                                bytes: Number(entry?.bytes) || 0,
                                resourceType: entry?.resourceType || '',
                                sourceType: entry?.sourceType || '',
                                textureUid: entry?.textureUid ?? null,
                                sourceBytes: Number(entry?.sourceBytes) || 0,
                            }, {
                                timestampMs: frameReadyStamp,
                            });
                        });
                    }
                    state.firstRenderTickRecorded = true;
                }
                const firstFrameAcked = telemetry.markFirstFrame(state, frameReadyStamp, tickMetrics, {
                    source,
                });
                if (firstFrameAcked === true) {
                    const compilation = state.scene?.finishProgramCompilationDiagnostics?.();
                    if (compilation?.enabled === true) {
                        recordZenPondBootTimelineEvent(state, 'startup_program_compilation_finished', {
                            programCount: compilation.programCount,
                            droppedProgramCount: compilation.droppedProgramCount,
                            droppedContextCount: compilation.droppedContextCount,
                            maxPrograms: compilation.maxPrograms,
                            observationFailureCount: compilation.observationFailureCount,
                            lastObservationFailureName: compilation.lastObservationFailureName,
                        });
                    }
                }
                if (firstFrameAcked !== true && state.firstFrameAckEmitted !== true) {
                    reportStartupProgress(
                        ZEN_POND_WORKER_STARTUP_STAGE.FIRST_FRAME_DEFERRED,
                        state.firstFrameAckDeferredReason
                            || ZEN_POND_WORKER_STARTUP_READINESS_REASON.RUNTIME_WARMUP,
                    );
                }
                telemetry.markPresentationSceneFrame(
                    state,
                    frameReadyStamp,
                    tickMetrics,
                    { source },
                );
                const frameCount = Number(state.metrics?.sampleFrames) || 0;
                // Water-effect probe reads are pull-based through flushMetrics; pushing them
                // during steady animation creates periodic structured-clone work.
                if (frameCount <= 3 || frameCount % 30 === 0) {
                    emitWorkerRuntimeDebug('after_render_frame', {
                        frameCount,
                        elapsedMs: Number((Number(elapsedMs) || 0).toFixed(3)),
                        source,
                        tickMetrics,
                    });
                }
                return true;
            } catch (error) {
                consecutiveAfterRenderErrors += 1;
                const startupPending = state.firstFrameAckEmitted !== true;
                if (startupPending) recordStartupProgramCompilation();
                if (startupPending && ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED) {
                    recordFirstRenderCalls(state.scene?.getFirstTickRenderCallDiagnostics?.(), nowMs());
                }
                const sanitizedStartupError = startupPending
                    ? sanitizeZenPondWorkerStartupError(error)
                    : null;
                const errorMessage = sanitizedStartupError?.message
                    || String(error?.message || error || 'ZEN_POND_WORKER_AFTER_RENDER_FAILED');
                const fatal = startupPending
                    || consecutiveAfterRenderErrors >= AFTER_RENDER_ERROR_BREAKER_THRESHOLD;
                const startupProgress = startupPending
                    ? reportStartupProgress(
                        ZEN_POND_WORKER_STARTUP_STAGE.STARTUP_RENDER_FAILED,
                        ZEN_POND_WORKER_STARTUP_READINESS_REASON.RENDER_EXCEPTION,
                    )
                    : null;
                emitWorkerRuntimeDebug('after_render_error', {
                    error: errorMessage,
                    consecutiveErrors: consecutiveAfterRenderErrors,
                    fatal,
                    source,
                });
                const runtimeEvent = fatal ? 'worker_runtime_error' : 'worker_runtime_warn';
                emitRendererEvent(runtimeEvent, {
                    type: 'AFTER_RENDER',
                    error: errorMessage,
                    ...(!startupPending && typeof error?.stack === 'string' ? {
                        errorStack: error.stack,
                    } : {}),
                    warning: errorMessage,
                    consecutiveErrors: consecutiveAfterRenderErrors,
                    fatal,
                    ...(startupProgress ? {
                        errorCode: sanitizedStartupError.code,
                        startupProgress,
                    } : {}),
                });
                if (fatal) {
                    stopEngine({
                        keepData: true,
                        invalidatePendingStart: false,
                    });
                }
                return false;
            }
        };

        emitWorkerRuntimeDebug('start_engine_begin', {
            width: state.width,
            height: state.height,
            viewportWidth: state.viewportWidth,
            viewportHeight: state.viewportHeight,
            dpr: state.dpr,
            active: state.active === true,
            qualityMode: state.qualityMode,
            fishRosterPayloadCount: Array.isArray(state.fishRosterPayload) ? state.fishRosterPayload.length : 0,
        });
        recordZenPondRuntimeHealthEvent(state, 'start_engine_begin', {
            width: state.width,
            height: state.height,
            active: state.active === true,
        });
        stopEngine({
            keepData: true,
            invalidatePendingStart: false,
            preserveCanvasContext: true,
        });
        telemetry.resetFirstFrameState(state);

        syncAmbientEntitiesForState(modules, state);
        syncFishRosterForState(modules, state);

        if (!isActiveStartRequest(requestId)) {
            return false;
        }

        const rendererAdmissionBeforeWait = (
            typeof modules.getZenPondRendererModuleAdmissionSnapshot === 'function'
                ? modules.getZenPondRendererModuleAdmissionSnapshot()
                : null
        );
        recordZenPondBootTimelineEvent(state, 'renderer_module_load_start', {
            hasLazyLoader: typeof modules.loadZenPixiSceneRenderer === 'function',
            admissionState: rendererAdmissionBeforeWait?.state || 'untracked',
            admissionStartedBeforeEngine: (
                rendererAdmissionBeforeWait?.state !== 'idle'
                && rendererAdmissionBeforeWait?.startedAtMs !== null
                && Number.isFinite(Number(rendererAdmissionBeforeWait?.startedAtMs))
                && Number(rendererAdmissionBeforeWait.startedAtMs) < nowMs()
            ),
        });
        reportStartupProgress(
            ZEN_POND_WORKER_STARTUP_STAGE.RENDERER_MODULE_LOADING,
        );
        const mountZenPixiSceneRenderer = await resolveMountZenPixiSceneRenderer();
        const rendererAdmissionAfterWait = (
            typeof modules.getZenPondRendererModuleAdmissionSnapshot === 'function'
                ? modules.getZenPondRendererModuleAdmissionSnapshot()
                : null
        );
        recordZenPondBootTimelineEvent(state, 'renderer_module_load_end', {
            hasRenderer: typeof mountZenPixiSceneRenderer === 'function',
            admissionState: rendererAdmissionAfterWait?.state || 'untracked',
            admissionDurationMs: rendererAdmissionAfterWait?.durationMs ?? null,
            sceneModuleDurationMs: rendererAdmissionAfterWait?.sceneModuleDurationMs ?? null,
            waterModuleDurationMs: rendererAdmissionAfterWait?.waterModuleDurationMs ?? null,
            waterFactoryAdmissionDurationMs: (
                rendererAdmissionAfterWait?.waterFactoryAdmissionDurationMs ?? null
            ),
        });
        if (!isActiveStartRequest(requestId) || !state.canvas) {
            return false;
        }

        state.backgroundHost = createBackgroundHost();
        applyWorkerCanvasEventSurface(state.canvas);

        const mountScene = () => mountZenPixiSceneRenderer({
            backgroundHost: state.backgroundHost,
            width: state.width,
            height: state.height,
            viewportWidth: state.viewportWidth || state.width,
            viewportHeight: state.viewportHeight || state.height,
            devicePixelRatio: state.dpr,
            view: state.canvas,
            shouldAnimate: true,
            qualityProfile: state.qualityProfile,
            resolveDepthTexture: (palette, depthConfig) => resolveDepthTexture(palette, depthConfig),
            waterPaletteRef: state.refs.waterPaletteRef,
            fishRef: state.refs.fishRef,
            bathymetryFieldRef: state.refs.bathymetryFieldRef,
            hoveredDomainRef: state.refs.hoveredDomainRef,
            lockedTargetRef: state.refs.lockedTargetRef,
            selectedFishUidRef: state.refs.selectedFishUidRef,
            frameStateRef: state.refs.frameStateRef,
            surfaceDisturbancesRef: state.refs.surfaceDisturbancesRef,
            lilyPadsRef: state.refs.lilyPadsRef,
            waterLilyRef: state.refs.waterLilyRef,
            zenIrisClustersRef: state.refs.zenIrisClustersRef,
            particlesRef: state.refs.particlesRef,
            petalsRef: state.refs.petalsRef,
            glimmersRef: state.refs.glimmersRef,
            rocksRef: state.refs.rocksRef,
            sceneGenerationKey: state.sceneGenerationKey,
            rendererDebugToggles: state.refs.rendererDebugTogglesRef.current,
            rendererDebugTogglesRef: state.refs.rendererDebugTogglesRef,
            visualProfile: state.runtimeParams.visualProfile,
            useTicker: false,
        });
        recordZenPondBootTimelineEvent(state, 'scene_mount_start', {
            width: state.width,
            height: state.height,
            viewportWidth: state.viewportWidth || state.width,
            viewportHeight: state.viewportHeight || state.height,
        });
        reportStartupProgress(ZEN_POND_WORKER_STARTUP_STAGE.SCENE_MOUNTING);
        const mountedScene = mountScene();
        if (!isActiveStartRequest(requestId)) {
            try {
                mountedScene?.dispose?.();
            } catch (error) {
                emitWorkerRuntimeWarn('start_engine_stale_scene_dispose', error);
            }
            return false;
        }
        state.scene = mountedScene;
        if (ZEN_POND_RUNTIME_HEALTH_DEBUG_TIMELINE_ENABLED === true) {
            const admission = state.scene?.getRendererAdmissionDiagnostics?.();
            if (admission?.enabled === true) {
                recordZenPondBootTimelineEvent(state, 'startup_renderer_admission', admission, {
                    timestampMs: admission.constructorAtMs ?? undefined,
                });
            }
        }
        const initialSceneReason = typeof state.scene?.reason === 'string' ? state.scene.reason : null;
        recordZenPondBootTimelineEvent(state, 'scene_mount_end', {
            active: state.scene?.active === true,
            reason: initialSceneReason || '',
        });
        emitWorkerRuntimeDebug('start_engine_scene_mounted', {
            sceneActive: state.scene?.active === true,
            sceneReason: initialSceneReason,
        });
        recordZenPondRuntimeHealthEvent(state, 'scene_mounted', {
            active: state.scene?.active === true,
        });

        if (!state.scene?.active) {
            const diagnostics = {
                hasCanvas: !!state.canvas,
                canvasHasContext: typeof state.canvas?.getContext === 'function',
                canvasHasAddEventListener: typeof state.canvas?.addEventListener === 'function',
                canvasHasRemoveEventListener: typeof state.canvas?.removeEventListener === 'function',
                canvasHasStyle: !!state.canvas?.style,
                hasOffscreenCanvasCtor: typeof OffscreenCanvas === 'function',
                sceneReasonInitial: initialSceneReason,
                ...collectWorkerRendererDiagnostics({ runtimeState: state }),
                ...collectCanvasWebGLTextureCaps(state.canvas),
            };
            throw new Error(`ZEN_POND_WORKER_SCENE_MOUNT_FAILED:${JSON.stringify(diagnostics)}`);
        }

        if (typeof state.scene.prepareFirstFrameAssets === 'function') {
            recordZenPondBootTimelineEvent(state, 'first_frame_assets_prepare_start', {
                rendererKind,
            });
            reportStartupProgress(
                ZEN_POND_WORKER_STARTUP_STAGE.FIRST_FRAME_ASSETS_PREPARING,
            );
            const firstFrameAssetReadiness = await state.scene.prepareFirstFrameAssets();
            if (!isActiveStartRequest(requestId)) {
                return false;
            }
            const readinessDetails = buildFirstFrameAssetReadinessDetails(
                firstFrameAssetReadiness,
            );
            recordZenPondBootTimelineEvent(
                state,
                'first_frame_assets_prepare_end',
                readinessDetails,
            );
            recordZenPondRuntimeHealthEvent(
                state,
                'first_frame_assets_ready',
                readinessDetails,
            );
        }

        const firstFrameRenderedBeforeLoop = false;

        recordZenPondBootTimelineEvent(state, 'runtime_loop_mount_start', {
            active: state.active === true,
            firstFrameAckEmitted: state.firstFrameAckEmitted === true,
            firstFrameRenderedBeforeLoop,
        });
        reportStartupProgress(
            ZEN_POND_WORKER_STARTUP_STAGE.RUNTIME_LOOP_MOUNTING,
        );
        state.runtimeStopLoop = modules.mountZenSignalScannerRuntimeLoop({
            width: state.width,
            height: state.height,
            shouldAnimate: true,
            frameScheduler: 'auto',
            startupFrameWatchdogMs: STARTUP_RAF_LIVENESS_WATCHDOG_MS,
            isStartupFramePending: () => state.firstFrameAckEmitted !== true,
            onStartupFrameSchedulerFallback: () => {
                reportStartupProgress(
                    ZEN_POND_WORKER_STARTUP_STAGE.RAF_LIVENESS_FALLBACK,
                    ZEN_POND_WORKER_STARTUP_READINESS_REASON.RAF_CALLBACK_STALLED,
                );
            },
            animationEnabledRef: state.refs.animationEnabledRef,
            qualityProfile: state.qualityProfile,
            fishRef: state.refs.fishRef,
            activityProfileByDomainRef: state.refs.activityProfileByDomainRef,
            surfaceDisturbancesRef: state.refs.surfaceDisturbancesRef,
            surfaceDisturbanceTelemetryRef:
                state.refs.surfaceDisturbanceTelemetryRef,
            surfaceDisturbanceEventsRef: state.refs.surfaceDisturbanceEventsRef,
            interactionStimuliRef: state.refs.interactionStimuliRef,
            lilyPadsRef: state.refs.lilyPadsRef,
            waterLilyRef: state.refs.waterLilyRef,
            zenIrisClustersRef: state.refs.zenIrisClustersRef,
            particlesRef: state.refs.particlesRef,
            petalsRef: state.refs.petalsRef,
            glimmersRef: state.refs.glimmersRef,
            mousePos: state.refs.mousePos,
            commonEnvContextRef: state.refs.commonEnvContextRef,
            viewportSizeRef: state.refs.viewportSizeRef,
            sessionSaltRef: state.refs.sessionSaltRef,
            tuningRef: state.refs.tuningRef,
            hoveredDomainRef: state.refs.hoveredDomainRef,
            lockedTargetRef: state.refs.lockedTargetRef,
            selectedFishUidRef: state.refs.selectedFishUidRef,
            frameStateRef: state.refs.frameStateRef,
            envStateRef: state.refs.envStateRef,
            invitationRegistrationEntityIdRef: state.refs.invitationRegistrationEntityIdRef,
            rendererDebugTogglesRef:
                state.refs.rendererDebugTogglesRef,
            onPerformanceSample: (sample = null) => {
                state.performanceSample = isObject(sample) ? sample : null;
            },
            onAfterRender: ({ elapsedMs } = {}) => {
                renderSceneFrame({ elapsedMs, source: 'runtime_loop' });
            },
        });
        state.scene.setViewport({ width: state.viewportWidth, height: state.viewportHeight, devicePixelRatio: state.dpr });
        if (state.pendingViewportReflow) {
            commitZenPondViewportReflow(state);
            state.pendingViewportReflow = false;
        }
        state.firstFrameRuntimeLoopMounted = typeof state.runtimeStopLoop === 'function';
        emitWorkerRuntimeDebug('start_engine_runtime_loop_mounted');
        recordZenPondRuntimeHealthEvent(state, 'runtime_loop_mounted', {
            active: state.active === true,
            firstFrameAckEmitted: state.firstFrameAckEmitted === true,
            firstFrameRenderedBeforeLoop,
            runtimeLoopMounted: state.firstFrameRuntimeLoopMounted === true,
        });
        for (
            let i = 0;
            i < STARTUP_PRIME_RUNTIME_LOOP_FRAMES && state.firstFrameAckEmitted !== true;
            i += 1
        ) {
            reportStartupProgress(
                ZEN_POND_WORKER_STARTUP_STAGE.PRIME_RENDERING,
            );
            const didRender = renderSceneFrame({
                elapsedMs: 16.667,
                source: 'runtime_loop_prime',
            });
            if (!didRender) {
                if (state.scene === null && state.firstFrameAckEmitted !== true) {
                    return false;
                }
                break;
            }
        }
        if (state.firstFrameAckEmitted !== true) {
            reportStartupProgress(
                ZEN_POND_WORKER_STARTUP_STAGE.WAITING_RUNTIME_FRAME,
                state.firstFrameAckDeferredReason
                    || ZEN_POND_WORKER_STARTUP_READINESS_REASON.RUNTIME_WARMUP,
            );
        }
        return true;
    };

    const remountEngine = () => {
        if (!state.started || !state.canvas) return null;
        return startEngineAsync();
    };

    const resetRuntimeState = () => {
        state.started = false;
        state.active = true;
        state.canvas = null;
        state.width = 0;
        state.height = 0;
        state.viewportWidth = 0;
        state.viewportHeight = 0;
        state.dpr = 1;
        state.backgroundHost = null;
        state.sceneGenerationKey = 'worker_scene';
        state.runtimeParams = buildDefaultRuntimeParams();
        state.qualityMode = ZEN_QUALITY_MODE_FULL;
        state.qualityProfile = null;
        state.qualitySignature = '';
        state.visualProfileSignature = '';
        state.refs = buildDefaultRefs();
        state.environmentRuntime = createEnvironmentRuntimeState();
        state.fishRosterPayload = [];
        state.requiredFirstFrameFishCount = 0;
        state.firstFrameAckDeferredCount = 0;
        state.firstFrameAckDeferredReason = null;
        state.fishAppearanceByDomain.clear();
        state.depthTextureCache = { key: '', canvas: null };
        state.worldSyncCache = createWorldSyncCache();
        state.pendingViewportReflow = false;
        state.pondComposition = null;
        state.sceneLayout = null;
        state.startedAtMs = 0;
        state.lastFrameAtMs = 0;
        state.presentationSceneCommitRequest = null;
        state.lastPresentationSceneCommitAck = null;
        state.lastSceneFrameMetrics = null;
        state.lastSceneFrameSpike = null;
        state.performanceSample = null;
        state.firstFrameAckEmitted = false;
        state.firstFrameAtMs = 0;
        state.firstRenderTickRecorded = false;
        state.firstFrameRuntimeLoopMounted = false;
        state.firstFrameRuntimeLoopFrameCount = 0;
        state.firstFrameLastRenderSource = '';
        state.lastInputClickPulseToken = 0;
        state.pendingInputClickLockDomain = null;
        state.petalLandingHistory.clear();
        state.metrics = {
            viewportReflowCount: 0,
            sampleFrames: 0,
            totalDtMs: 0,
            maxDtMs: 0,
            over24: 0,
            over32: 0,
            over50: 0,
            over100: 0,
            sceneSessionSyncCount: 0,
            runtimeParamSyncCount: 0,
            fishRosterSyncCount: 0,
            ambientPopulationSyncCount: 0,
            staticSceneSyncCount: 0,
        };
        state.runtimeHealth = createZenPondRuntimeHealthState();
    };

    const startEngineAsync = () => {
        const requestId = bumpStartRequestId();
        recordZenPondBootTimelineEvent(state, 'start_engine_async_queued', {
            hasCanvas: !!state?.canvas,
        });
        return Promise.resolve().then(() => {
            emitWorkerRuntimeDebug('start_engine_async_begin', {
                hasCanvas: !!state?.canvas,
                width: state?.width || 0,
                height: state?.height || 0,
                dpr: state?.dpr || 1,
                active: state?.active === true,
            });
            if (!state?.canvas) {
                throw new Error('ZEN_POND_WORKER_CANVAS_MISSING_DURING_ASYNC_START');
            }
            recordZenPondBootTimelineEvent(state, 'start_engine_async_begin', {
                width: state?.width || 0,
                height: state?.height || 0,
                active: state?.active === true,
            });
            state.startedAtMs = nowMs();
            return startEngine({ requestId });
        }).then((didStart) => {
            if (!didStart || !isActiveStartRequest(requestId)) {
                return false;
            }
            state.started = true;
            emitWorkerRuntimeDebug('start_engine_async_wait_first_render_frame', {
                startedAtMs: state.startedAtMs,
            });
            emitWorkerRuntimeDebug('start_engine_async_success', {
                startedAtMs: state.startedAtMs,
                qualityMode: state.qualityMode,
            });
            emitRendererEvent('pixi_scene_initialized', {
                rendererKind,
                width: state.width,
                height: state.height,
                viewportWidth: state.viewportWidth,
                viewportHeight: state.viewportHeight,
                dpr: state.dpr,
                qualityMode: state.qualityMode,
            });
            return true;
        }).catch((error) => {
            if (!isActiveStartRequest(requestId)) {
                return false;
            }
            state.started = false;
            const sanitizedStartupError = sanitizeZenPondWorkerStartupError(error);
            const startupProgress = reportStartupProgress(
                ZEN_POND_WORKER_STARTUP_STAGE.STARTUP_RENDER_FAILED,
                ZEN_POND_WORKER_STARTUP_READINESS_REASON.RENDER_EXCEPTION,
            );
            emitWorkerRuntimeDebug('start_engine_async_failed', {
                error: sanitizedStartupError.message,
            });
            emitRendererEvent('worker_runtime_error', {
                type: messageType.INIT_CANVAS,
                error: sanitizedStartupError.message,
                errorCode: sanitizedStartupError.code,
                startupProgress,
            });
            return false;
        });
    };

    return {
        stopEngine,
        startEngine,
        remountEngine,
        resetRuntimeState,
        startEngineAsync,
    };
};
