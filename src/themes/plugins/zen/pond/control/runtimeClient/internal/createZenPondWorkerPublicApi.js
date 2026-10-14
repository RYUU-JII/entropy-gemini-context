import { countZenPondDeferredInvitations } from '../../../contracts/zenPondPresentationSceneCommit.js';
import { normalizeZenPondRegistrationEntityId } from '../../../contracts/zenPondRegistrationPresentation.js';

export const createZenPondWorkerPublicApi = ({
    runtime,
    canvas,
    messageType,
    buildInitPayload,
    zenQualityModeFull,
    defaultInitTimeoutMs,
    defaultFirstFrameAckTimeoutMs,
    defaultTelemetryTimeoutMs,
    defaultDisposeAckTimeoutMs = defaultTelemetryTimeoutMs,
    runtimeTaskType,
    runtimePriority,
    isObject: isObjectValue,
    toOptionalUid: toOptionalUidValue,
    toOptionalFiniteNumber: toOptionalFiniteNumberValue,
    runtimeDebug,
    requestClient,
    runRequest,
    runLatest,
    createControlAckValidator,
    syncVisibilityState,
    clearControlCoalescer,
    ackGate,
    onReady,
    emitError,
    emitMetrics,
    taskQueue,
    cancelKey,
    onStartupTimeline = null,
} = {}) => {
    let pendingPetalBatches = 0;
    const readNowMs = () => (
        typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now()
    );
    return {
        async start({
            width,
            height,
            dpr,
            themeId = 'zen',
            sceneGenerationKey = '',
            seed = 0,
            active = true,
            runtimeParams = null,
            fishRoster = [],
            requiredFirstFrameFishCount = 0,
            presentationSceneCommitKey = null,
            presentationRosterSignature = '',
            workerRosterSignature = '',
            expectedFishCount = 0,
            requiredVisibleFishCount = 0,
            awaitFirstFrameAck = true,
        } = {}) {
            if (runtime.disposed) {
                throw new Error('ZEN_POND_WORKER_ALREADY_DISPOSED');
            }
            if (runtime.started) {
                return runtime.capabilities;
            }
            if (runtime.initPromise) {
                return runtime.initPromise;
            }
            runtime.initPromise = (async () => {
                const startupStartedAtMs = readNowMs();
                const emitStartupTimeline = (stage, details = null) => {
                    if (typeof onStartupTimeline !== 'function') return;
                    const nowMs = readNowMs();
                    onStartupTimeline({
                        stage,
                        elapsedMs: Number(Math.max(0, nowMs - startupStartedAtMs).toFixed(1)),
                        ...(isObjectValue(details) ? details : {}),
                    });
                };
                const resolvedActive = active !== false;
                const resolvedFishRoster = Array.isArray(fishRoster) ? fishRoster : [];
                const resolvedRequiredFirstFrameFishCount = Math.max(
                    0,
                    Math.floor(Number(requiredFirstFrameFishCount) || 0),
                );
                emitStartupTimeline('start_enter', {
                    width,
                    height,
                    active: resolvedActive,
                    fishRosterCount: resolvedFishRoster.length,
                    requiredFirstFrameFishCount: resolvedRequiredFirstFrameFishCount,
                    awaitFirstFrameAck: awaitFirstFrameAck !== false,
                });
                runtimeDebug('start_begin', {
                    width,
                    height,
                    dpr,
                    active: resolvedActive,
                    hasRuntimeParams: isObjectValue(runtimeParams),
                    fishRosterCount: resolvedFishRoster.length,
                });
                if (!canvas || typeof canvas.transferControlToOffscreen !== 'function') {
                    throw new Error('ZEN_POND_OFFSCREEN_UNSUPPORTED');
                }
                ackGate.reset();
                emitStartupTimeline('request_client_init_start');
                const ready = await requestClient.init();
                emitStartupTimeline('request_client_init_end', {
                    ready: ready === true,
                });
                runtimeDebug('start_after_request_client_init', { ready });
                if (!ready) {
                    throw new Error(`ZEN_POND_WORKER_INIT_FAILED:${requestClient.lastDisableReason}`);
                }
                emitStartupTimeline('offscreen_transfer_start');
                const offscreenCanvas = canvas.transferControlToOffscreen();
                emitStartupTimeline('offscreen_transfer_end');
                runtimeDebug('start_offscreen_transferred');
                emitStartupTimeline('init_canvas_request_start');
                const initResult = await runRequest({
                    type: messageType.INIT_CANVAS,
                    payload: buildInitPayload({
                        canvas: offscreenCanvas,
                        viewportWidth: width,
                        viewportHeight: height,
                        width,
                        height,
                        dpr,
                        themeId,
                        qualityMode: runtimeParams?.qualityMode ?? zenQualityModeFull,
                        sceneGenerationKey,
                        rendererPreference: 'pixi_offscreen',
                        seed,
                        active: resolvedActive,
                        runtimeParams: isObjectValue(runtimeParams) ? runtimeParams : {},
                        fishRoster: resolvedFishRoster,
                        requiredFirstFrameFishCount: resolvedRequiredFirstFrameFishCount,
                        presentationSceneCommitKey,
                        presentationRosterSignature,
                        workerRosterSignature,
                        expectedFishCount,
                        deferredInvitationCount: countZenPondDeferredInvitations(resolvedFishRoster),
                        requiredVisibleFishCount,
                    }),
                    taskType: runtimeTaskType.ZEN_POND_RENDER_INIT,
                    timeoutMs: defaultInitTimeoutMs,
                });
                emitStartupTimeline('init_canvas_request_end', {
                    hasInitResult: isObjectValue(initResult),
                });
                runtime.started = true;
                runtime.lastVisibilityRequest = resolvedActive;
                runtimeDebug('start_init_canvas_result', initResult);
                if (isObjectValue(initResult)) {
                    runtime.capabilities = {
                        supportsWorkerRaf: typeof initResult.supportsWorkerRaf === 'boolean'
                            ? initResult.supportsWorkerRaf
                            : runtime.capabilities.supportsWorkerRaf,
                        renderer: typeof initResult.renderer === 'string'
                            ? initResult.renderer
                            : (runtime.capabilities.renderer || 'zen_pond_worker_pixi_offscreen'),
                    };
                }
                if (typeof onReady === 'function') {
                    onReady(runtime.capabilities);
                }
                if (resolvedActive && awaitFirstFrameAck !== false) {
                    runtimeDebug('start_wait_first_frame_ack');
                    emitStartupTimeline('first_frame_ack_wait_start');
                    await ackGate.wait({
                        timeoutMs: defaultFirstFrameAckTimeoutMs,
                    });
                    emitStartupTimeline('first_frame_ack_wait_end');
                    runtimeDebug('start_first_frame_ack_ok');
                }
                emitStartupTimeline('start_resolved');
                return runtime.capabilities;
            })();

            try {
                return await runtime.initPromise;
            } catch (error) {
                runtimeDebug('start_failed', {
                    error: String(error?.message || error || 'unknown'),
                });
                throw emitError(error);
            } finally {
                runtime.initPromise = null;
            }
        },

        resize({ width, height, dpr, settled = false } = {}) {
            runLatest({
                type: messageType.RESIZE,
                payload: { width, height, dpr, settled },
                cancelKey: cancelKey.resize,
            });
        },

        setVisibility({ active = true } = {}) {
            const requestActive = active === true;
            syncVisibilityState(requestActive);
        },

        setInputState({
            pointer = null,
            pointerSpace = 'world',
            lockedTarget = null,
            hoverTarget = null,
            selectedFishUid = undefined,
            invitationRegistrationEntityId = null,
            clickPulseToken = null,
            clickPointer = null,
            clickPointerSpace = 'world',
            onAck = null,
        } = {}) {
            const resolvedPointerSpace = String(pointerSpace || '').toLowerCase() === 'viewport'
                ? 'viewport'
                : 'world';
            const resolvedClickPointerSpace = String(clickPointerSpace || '').toLowerCase() === 'viewport'
                ? 'viewport'
                : 'world';
            const hasSelectedFishUid = selectedFishUid !== undefined;
            const resolvedSelectedFishUid = selectedFishUid === null
                ? null
                : toOptionalUidValue(selectedFishUid);
            const resolvedClickPulseTokenRaw = toOptionalFiniteNumberValue(clickPulseToken);
            runLatest({
                type: messageType.SET_INPUT_STATE,
                payload: {
                    pointer: isObjectValue(pointer) ? pointer : null,
                    pointerSpace: resolvedPointerSpace,
                    lockedTarget: typeof lockedTarget === 'string' ? lockedTarget : null,
                    hoverTarget: typeof hoverTarget === 'string' ? hoverTarget.trim() : null,
                    invitationRegistrationEntityId: normalizeZenPondRegistrationEntityId(invitationRegistrationEntityId),
                    clickPulseToken: resolvedClickPulseTokenRaw !== null
                        ? Math.max(0, Math.floor(resolvedClickPulseTokenRaw))
                        : null,
                    clickPointer: isObjectValue(clickPointer) ? clickPointer : null,
                    clickPointerSpace: resolvedClickPointerSpace,
                    ...(hasSelectedFishUid ? { selectedFishUid: resolvedSelectedFishUid } : {}),
                },
                cancelKey: cancelKey.input,
                priority: runtimePriority.BACKGROUND,
                onSuccess: typeof onAck === 'function'
                    ? (result) => onAck(result)
                    : null,
                validateResult: createControlAckValidator({
                    requestType: messageType.SET_INPUT_STATE,
                }),
            });
        },

        async landPetals({ landings, viewportWidth, viewportHeight }) {
            if (!runtime.started || runtime.disposed) {
                throw new Error('ZEN_POND_PETAL_LANDING_RUNTIME_INACTIVE');
            }
            if (pendingPetalBatches >= 4) {
                throw new Error('ZEN_POND_PETAL_LANDING_QUEUE_FULL');
            }
            pendingPetalBatches += 1;
            try {
                return await taskQueue.enqueue({ priority: runtimePriority.BACKGROUND }, async () => {
                    if (runtime.disposed) throw new Error('ZEN_POND_PETAL_LANDING_RUNTIME_INACTIVE');
                    const result = await runRequest({
                        type: messageType.LAND_PETALS,
                        payload: { landings, viewportWidth, viewportHeight },
                        priority: runtimePriority.BACKGROUND,
                    });
                    const error = createControlAckValidator({ requestType: messageType.LAND_PETALS })(result);
                    if (error) throw error;
                    if (!Array.isArray(result.acceptedIds) || !Array.isArray(result.rejectedIds)) {
                        throw new Error('ZEN_POND_PETAL_LANDING_ACK_INVALID');
                    }
                    return result;
                });
            } finally {
                pendingPetalBatches -= 1;
            }
        },

        async injectDebugSurfaceDisturbances({
            fixtureId,
            fixtures,
        } = {}) {
            if (!runtime.started || runtime.disposed) {
                throw new Error(
                    'ZEN_POND_DEBUG_DISTURBANCE_RUNTIME_INACTIVE',
                );
            }
            return runRequest({
                type:
                    messageType
                        .INJECT_DEBUG_SURFACE_DISTURBANCES,
                payload: {
                    fixtureId,
                    fixtures,
                },
                taskType:
                    runtimeTaskType.ZEN_POND_RENDER_CONTROL,
                priority: runtimePriority.USER_VISIBLE,
                timeoutMs: defaultTelemetryTimeoutMs,
            });
        },

        syncSceneSession({ sceneSession = null } = {}) {
            if (!isObjectValue(sceneSession)) return;
            runLatest({
                type: messageType.SYNC_SCENE_SESSION,
                payload: { sceneSession },
                cancelKey: cancelKey.sceneSession,
                priority: runtimePriority.USER_VISIBLE,
                validateResult: createControlAckValidator({
                    requestType: messageType.SYNC_SCENE_SESSION,
                }),
            });
        },

        syncEnvironmentAuthority({ envAuthority = null } = {}) {
            if (!isObjectValue(envAuthority)) return;
            runLatest({
                type: messageType.SYNC_ENVIRONMENT_AUTHORITY,
                payload: { envAuthority },
                cancelKey: cancelKey.environmentAuthority,
                priority: runtimePriority.BACKGROUND,
                validateResult: createControlAckValidator({
                    requestType: messageType.SYNC_ENVIRONMENT_AUTHORITY,
                }),
            });
        },

        syncRuntimeParams({
            runtimeParams = null,
            onAck = null,
        } = {}) {
            if (!isObjectValue(runtimeParams)) return;
            runLatest({
                type: messageType.SYNC_RUNTIME_PARAMS,
                payload: { runtimeParams },
                cancelKey: cancelKey.runtimeParams,
                priority: runtimePriority.BACKGROUND,
                onSuccess: typeof onAck === 'function'
                    ? (result) => onAck(result)
                    : null,
                validateResult: createControlAckValidator({
                    requestType: messageType.SYNC_RUNTIME_PARAMS,
                }),
            });
        },

        syncFishRoster({
            fishRoster = [],
            presentationSceneCommitKey = null,
            presentationRosterSignature = '',
            workerRosterSignature = '',
            expectedFishCount = 0,
            requiredVisibleFishCount = 0,
        } = {}) {
            const resolvedFishRoster = Array.isArray(fishRoster) ? fishRoster : [];
            runLatest({
                type: messageType.SYNC_FISH_ROSTER,
                payload: {
                    fishRoster: resolvedFishRoster,
                    requiredFirstFrameFishCount: resolvedFishRoster.length - countZenPondDeferredInvitations(resolvedFishRoster),
                    presentationSceneCommitKey,
                    presentationRosterSignature,
                    workerRosterSignature,
                    expectedFishCount,
                    deferredInvitationCount: countZenPondDeferredInvitations(resolvedFishRoster),
                    requiredVisibleFishCount,
                },
                cancelKey: cancelKey.fishRoster,
                priority: presentationSceneCommitKey
                    ? runtimePriority.USER_VISIBLE
                    : runtimePriority.BACKGROUND,
                validateResult: createControlAckValidator({
                    requestType: messageType.SYNC_FISH_ROSTER,
                }),
            });
        },

        async flushMetrics() {
            if (!runtime.started || runtime.disposed) {
                return runtime.latestMetrics;
            }
            let resolved = null;
            try {
                const result = await runRequest({
                    type: messageType.FLUSH_METRICS,
                    payload: {},
                    taskType: runtimeTaskType.ZEN_POND_RENDER_TELEMETRY,
                    priority: runtimePriority.BACKGROUND,
                    timeoutMs: defaultTelemetryTimeoutMs,
                });
                resolved = isObjectValue(result)
                    ? (isObjectValue(result.metrics) ? result.metrics : result)
                    : null;
            } catch (error) {
                runtimeDebug('flush_metrics_failed_nonfatal', {
                    error: String(error?.message || error || 'ZEN_POND_FLUSH_METRICS_FAILED'),
                });
                return runtime.latestMetrics;
            }
            // Transport polling may degrade non-fatally, but a received metrics
            // payload still has to satisfy the canonical telemetry contract.
            // Keep normalization outside the transport catch so malformed
            // active-owner telemetry fails loudly instead of returning stale data.
            emitMetrics(resolved);
            return runtime.latestMetrics;
        },

        async dispose({ reason = 'dispose' } = {}) {
            if (runtime.disposed) return runtime.latestMetrics;
            runtime.disposed = true;
            runtime.lastVisibilityRequest = null;
            ackGate.reset();
            clearControlCoalescer();
            taskQueue.clear('ZEN_POND_DISPOSE_CLEAR_QUEUE');
            try {
                if (runtime.started) {
                    const result = await runRequest({
                        type: messageType.DISPOSE,
                        payload: { reason },
                        taskType: runtimeTaskType.ZEN_POND_RENDER_TELEMETRY,
                        priority: runtimePriority.BACKGROUND,
                        timeoutMs: defaultDisposeAckTimeoutMs,
                        minTimeoutMs: defaultDisposeAckTimeoutMs,
                    });
                    const resolved = isObjectValue(result)
                        ? (isObjectValue(result.metrics) ? result.metrics : result)
                        : null;
                    emitMetrics(resolved);
                }
            } catch (error) {
                emitError(error);
            } finally {
                requestClient.disable(`ZEN_POND_CLIENT_DISPOSED:${reason}`);
            }
            return runtime.latestMetrics;
        },

        terminate({ reason = 'terminate' } = {}) {
            if (runtime.disposed) return runtime.latestMetrics;
            runtime.disposed = true;
            runtime.lastVisibilityRequest = null;
            ackGate.reset();
            clearControlCoalescer();
            taskQueue.clear('ZEN_POND_TERMINATE_CLEAR_QUEUE');
            requestClient.disable(`ZEN_POND_CLIENT_TERMINATED:${reason}`);
            return runtime.latestMetrics;
        },

        getMetrics() {
            return runtime.latestMetrics;
        },
    };
};
