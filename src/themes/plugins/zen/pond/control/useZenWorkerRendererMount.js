import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    buildEnvironmentAuthorityInputProbe,
    buildRuntimeParamsInputProbe,
    mountZenPondWorkerRenderer,
} from './ZenPondWorkerRuntimeClient.js';
import { acquireZenMainSignalScannerRuntime } from './zenMainSignalScannerRuntime.js';
import {
    ZEN_POND_READINESS_PHASE,
    createInitialZenPondReadinessSnapshot,
    createZenPondReadinessSnapshot,
} from './zenPondReadiness.js';
import {
    emitZenMainBootTrace,
} from '../../runtime/zenMainBootReadinessTrace.js';
import {
    ZEN_HOME_FIRST_VISUAL_MILESTONES,
    createZenHomeFirstVisualPondReadinessMilestone,
    createZenHomeFirstVisualPondMilestoneEvent,
} from '../../runtime/zenHomeFirstVisualReadinessContract.js';
import {
    normalizeZenPondPresentationSceneCommitKey,
} from '../contracts/zenPondPresentationSceneCommit.js';

const ZEN_WORKER_MOUNT_DEBUG = false;
const logMountDebug = (stage, details = null) => {
    if (!ZEN_WORKER_MOUNT_DEBUG) return;
    if (typeof console === 'undefined' || typeof console.log !== 'function') return;
    console.log(`[ZenWorkerMount][debug] ${stage}`, details || null);
};

const toStableControlSignature = (value) => {
    try {
        return JSON.stringify(value) || '';
    } catch (error) {
        return `unserializable:${String(error?.message || error || 'unknown')}`;
    }
};

const resolveDayIndexSignature = (envAuthority = null) => {
    const dayIndex = Number(envAuthority?.timeContext?.dayIndex);
    return Number.isFinite(dayIndex) ? String(Math.trunc(dayIndex)) : 'none';
};

const resolveFishRosterSyncKey = ({
    rosterSnapshot = null,
    appearanceRevision = 0,
    envAuthority = null,
    presentationSceneCommitKey = null,
    presentationSceneRequiredVisibleFishCount = 0,
} = {}) => {
    const rosterSignature = typeof rosterSnapshot?.signature === 'string'
        ? rosterSnapshot.signature
        : '';
    const revision = Number.isFinite(Number(appearanceRevision))
        ? Math.max(0, Math.floor(Number(appearanceRevision)))
        : 0;
    const sceneCommitKey = normalizeZenPondPresentationSceneCommitKey(
        presentationSceneCommitKey,
    );
    return [
        rosterSignature,
        `appearance:${revision}`,
        `day:${resolveDayIndexSignature(envAuthority)}`,
        `scene:${sceneCommitKey || 'none'}`,
        `visible:${sceneCommitKey === null ? 0 : presentationSceneRequiredVisibleFishCount}`,
    ].join('|');
};

const useZenWorkerRendererMount = ({
    canMountRenderer,
    backgroundHostRef,
    interactionSurfaceRef,
    rendererSizeRef,
    rendererWidth,
    rendererHeight,
    worldWidth,
    worldHeight,
    rosterSnapshotRef,
    animationEnabledRef,
    runtimeQualityProfile,
    visualProfile,
    animationEnabled,
    mousePos,
    clickPulseRef,
    onWorkerInteractionFeedback,
    sessionSaltRef,
    tuningRef,
    tuning,
    lockedTarget = null,
    lockedTargetRef,
    hoverTarget = null,
    hoverTargetRef = null,
    selectedFishIntentUid = undefined,
    selectedFishIntentUidRef,
    invitationRegistrationEntityId = null,
    invitationRegistrationEntityIdRef,
    envAuthorityRef,
    envRuntimeConfigSignature = '',
    waterPaletteRef,
    waterPalette,
    appearanceMapRef,
    appearanceRevision = 0,
    rendererDebugTogglesRef,
    rendererDebugToggles,
    sceneGenerationKeyRef,
    hardResetToken,
    sceneSessionRevision = 0,
    rosterSnapshot = null,
    presentationSceneCommitKey = null,
    presentationSceneRequiredVisibleFishCount = 0,
    onRuntimeFirstFrameReady,
    onFirstVisualMilestone = null,
    parkRuntimeOnUnmount = false,
    bootTraceContext = null,
}) => {
    const controllerRef = useRef(null);
    const runtimeOptionsRef = useRef(null);
    const pendingInputSyncFrameRef = useRef(null);
    const bootTraceContextRef = useRef(bootTraceContext);
    bootTraceContextRef.current = bootTraceContext;
    const emitMountBootTrace = useCallback((event, details = null) => {
        emitZenMainBootTrace(event, bootTraceContextRef.current, details);
    }, []);
    const [pondReadiness, setPondReadiness] = useState(() => (
        createInitialZenPondReadinessSnapshot('hook_idle')
    ));
    const latestEventHandlersRef = useRef({
        onWorkerInteractionFeedback: null,
        onRuntimeFirstFrameReady: null,
        onFirstVisualMilestone: null,
    });
    latestEventHandlersRef.current.onWorkerInteractionFeedback = onWorkerInteractionFeedback;
    latestEventHandlersRef.current.onRuntimeFirstFrameReady = onRuntimeFirstFrameReady;
    latestEventHandlersRef.current.onFirstVisualMilestone = onFirstVisualMilestone;
    const runtimeEventBridgeRef = useRef(null);
    if (!runtimeEventBridgeRef.current) {
        runtimeEventBridgeRef.current = {
            handleWorkerInteractionFeedback(feedback = null) {
                const callback = latestEventHandlersRef.current.onWorkerInteractionFeedback;
                if (typeof callback === 'function') {
                    callback(feedback);
                }
            },
            handleFirstFrameReady(metadata = null) {
                emitZenMainBootTrace('pond_mount:first_frame_callback_bridge', bootTraceContextRef.current, {
                    metadata,
                });
                const milestoneCallback = latestEventHandlersRef.current.onFirstVisualMilestone;
                if (typeof milestoneCallback === 'function') {
                    milestoneCallback(createZenHomeFirstVisualPondMilestoneEvent(
                        ZEN_HOME_FIRST_VISUAL_MILESTONES.POND_FIRST_FRAME_COMMITTED,
                        {
                            metadata,
                        },
                    ));
                }
                const callback = latestEventHandlersRef.current.onRuntimeFirstFrameReady;
                if (typeof callback === 'function') {
                    callback(metadata);
                }
            },
            handleReadinessChange(snapshot = null) {
                if (!snapshot || typeof snapshot !== 'object') return;
                emitZenMainBootTrace('pond_mount:readiness_change', bootTraceContextRef.current, {
                    phase: snapshot.phase,
                    reason: snapshot.reason,
                    mountId: snapshot.mountId,
                    firstFrameCommitted: snapshot.firstFrameCommitted === true,
                    degraded: snapshot.degraded === true,
                    failed: snapshot.failed === true,
                    atMs: Number(snapshot.atMs) || null,
                });
                const milestoneCallback = latestEventHandlersRef.current.onFirstVisualMilestone;
                if (typeof milestoneCallback === 'function') {
                    milestoneCallback(createZenHomeFirstVisualPondMilestoneEvent(
                        createZenHomeFirstVisualPondReadinessMilestone(snapshot.phase),
                        {
                            phase: snapshot.phase,
                            reason: snapshot.reason,
                            mountId: snapshot.mountId,
                            firstFrameCommitted: snapshot.firstFrameCommitted === true,
                            degraded: snapshot.degraded === true,
                            failed: snapshot.failed === true,
                            sceneCommitKey:
                                snapshot.metadata?.presentationSceneCommitKey || null,
                            errorCode: snapshot.metadata?.errorCode || null,
                            startupStage:
                                snapshot.metadata?.startupProgress?.stage || null,
                            startupReadinessReason:
                                snapshot.metadata?.startupProgress?.reason || null,
                        },
                    ));
                }
                setPondReadiness(snapshot);
            },
        };
    }
    const runtimeEventBridge = runtimeEventBridgeRef.current;

    runtimeOptionsRef.current = {
        backgroundHost: backgroundHostRef.current,
        interactionSurfaceRef,
        rendererSizeRef,
        width: rendererWidth,
        height: rendererHeight,
        worldWidth,
        worldHeight,
        rosterSnapshotRef,
        animationEnabledRef,
        qualityProfile: runtimeQualityProfile,
        visualProfile,
        mousePos,
        clickPulseRef,
        onWorkerInteractionFeedback: runtimeEventBridge.handleWorkerInteractionFeedback,
        sessionSaltRef,
        tuningRef,
        lockedTargetRef,
        hoverTargetRef,
        selectedFishIntentUidRef,
        invitationRegistrationEntityIdRef,
        envAuthorityRef,
        waterPaletteRef,
        appearanceMapRef,
        rendererDebugTogglesRef,
        sceneGenerationKeyRef,
        onFirstFrameReady: runtimeEventBridge.handleFirstFrameReady,
        onReadinessChange: runtimeEventBridge.handleReadinessChange,
        hardResetToken,
        sceneSessionRevision,
        appearanceRevision,
        presentationSceneCommitKey,
        presentationSceneRequiredVisibleFishCount,
        bootTraceContext,
    };
    const runtimeParamsSyncKey = useMemo(() => {
        if (!canMountRenderer) return 'disabled';
        const options = runtimeOptionsRef.current;
        if (!options) return '';
        const probe = buildRuntimeParamsInputProbe(options);
        return toStableControlSignature(probe);
    }, [
        canMountRenderer,
        rendererDebugToggles,
        runtimeQualityProfile,
        visualProfile,
        tuning,
        waterPalette,
    ]);
    const environmentAuthoritySyncKey = useMemo(() => {
        if (!canMountRenderer) return 'disabled';
        const options = runtimeOptionsRef.current;
        if (!options) return '';
        const probe = buildEnvironmentAuthorityInputProbe(options);
        return toStableControlSignature(probe);
    }, [
        canMountRenderer,
        envRuntimeConfigSignature,
    ]);
    const fishRosterSyncKey = useMemo(() => resolveFishRosterSyncKey({
        rosterSnapshot: canMountRenderer ? rosterSnapshot : null,
        appearanceRevision: canMountRenderer ? appearanceRevision : 0,
        envAuthority: canMountRenderer ? envAuthorityRef?.current : null,
        presentationSceneCommitKey: canMountRenderer ? presentationSceneCommitKey : null,
        presentationSceneRequiredVisibleFishCount: canMountRenderer
            ? presentationSceneRequiredVisibleFishCount
            : 0,
    }), [
        canMountRenderer,
        appearanceRevision,
        envAuthorityRef?.current?.timeContext?.dayIndex,
        presentationSceneCommitKey,
        presentationSceneRequiredVisibleFishCount,
        rosterSnapshot?.signature,
    ]);
    const hasRosterSnapshot = Boolean(rosterSnapshot);

    const syncControllerOptions = useCallback(() => {
        const controller = controllerRef.current;
        if (!controller) return null;
        controller.updateOptions(runtimeOptionsRef.current);
        return controller;
    }, []);

    const flushInputStateSync = useCallback(({ force = false } = {}) => {
        if (!canMountRenderer) return false;
        const controller = force === true
            ? syncControllerOptions()
            : controllerRef.current;
        if (!controller || typeof controller.syncInputState !== 'function') {
            return false;
        }
        return controller.syncInputState({ force }) === true;
    }, [canMountRenderer, syncControllerOptions]);
    const requestInputStateSync = useCallback(({ force = false } = {}) => {
        if (force) {
            if (pendingInputSyncFrameRef.current !== null && typeof window !== 'undefined') {
                window.cancelAnimationFrame?.(pendingInputSyncFrameRef.current);
                pendingInputSyncFrameRef.current = null;
            }
            return flushInputStateSync({ force: true });
        }
        if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
            return flushInputStateSync({ force: false });
        }
        if (pendingInputSyncFrameRef.current !== null) {
            return true;
        }
        pendingInputSyncFrameRef.current = window.requestAnimationFrame(() => {
            pendingInputSyncFrameRef.current = null;
            flushInputStateSync({ force: false });
        });
        return true;
    }, [flushInputStateSync]);

    // Move the retained canvas back into its visible host before the return
    // commit can paint. The worker still owns asynchronous renderer startup.
    useLayoutEffect(() => {
        const hostAtStart = backgroundHostRef.current;
        logMountDebug('effect_enter', {
            canMountRenderer,
            hasHost: !!hostAtStart,
            rendererWidth: Number(rendererWidth) || 0,
            rendererHeight: Number(rendererHeight) || 0,
            hostClientWidth: Number(hostAtStart?.clientWidth) || 0,
            hostClientHeight: Number(hostAtStart?.clientHeight) || 0,
            hardResetToken: Number(hardResetToken) || 0,
            sceneGenerationKey: typeof sceneGenerationKeyRef?.current === 'string'
                ? sceneGenerationKeyRef.current
                : '',
        });
        emitMountBootTrace('pond_mount:effect_enter', {
            canMountRenderer,
            hasHost: !!hostAtStart,
            rendererWidth: Number(rendererWidth) || 0,
            rendererHeight: Number(rendererHeight) || 0,
            worldWidth: Number(worldWidth) || 0,
            worldHeight: Number(worldHeight) || 0,
            hostClientWidth: Number(hostAtStart?.clientWidth) || 0,
            hostClientHeight: Number(hostAtStart?.clientHeight) || 0,
            animationEnabled,
            parkRuntimeOnUnmount,
            hardResetToken: Number(hardResetToken) || 0,
            runtimeParamsSyncKeyLength: runtimeParamsSyncKey.length,
            fishRosterSyncKeyLength: fishRosterSyncKey.length,
        });

        if (!canMountRenderer) {
            logMountDebug('effect_skip_can_mount_false');
            setPondReadiness(createZenPondReadinessSnapshot({
                phase: ZEN_POND_READINESS_PHASE.MOUNT_WAIT,
                reason: 'can_mount_renderer_false',
            }));
            emitMountBootTrace('pond_mount:skip_can_mount_false', {
                rendererWidth: Number(rendererWidth) || 0,
                rendererHeight: Number(rendererHeight) || 0,
                worldWidth: Number(worldWidth) || 0,
                worldHeight: Number(worldHeight) || 0,
                animationEnabled,
            });
            return undefined;
        }
        const backgroundHost = backgroundHostRef.current;
        if (!backgroundHost) {
            logMountDebug('effect_skip_host_missing');
            setPondReadiness(createZenPondReadinessSnapshot({
                phase: ZEN_POND_READINESS_PHASE.MOUNT_WAIT,
                reason: 'host_missing',
            }));
            emitMountBootTrace('pond_mount:skip_host_missing', {
                rendererWidth: Number(rendererWidth) || 0,
                rendererHeight: Number(rendererHeight) || 0,
            });
            return undefined;
        }
        const runtimeOptions = {
            ...runtimeOptionsRef.current,
            backgroundHost,
        };
        runtimeOptionsRef.current = runtimeOptions;
        if (parkRuntimeOnUnmount) {
            emitMountBootTrace('pond_mount:acquire_parkable_runtime', {
                hardResetToken: Number(hardResetToken) || 0,
                rendererWidth: Number(rendererWidth) || 0,
                rendererHeight: Number(rendererHeight) || 0,
                runtimeParamsSyncKeyLength: runtimeParamsSyncKey.length,
                fishRosterSyncKeyLength: fishRosterSyncKey.length,
            });
            const runtimeLease = acquireZenMainSignalScannerRuntime(runtimeOptions);
            controllerRef.current = runtimeLease.controller || null;
            logMountDebug('parkable_runtime_acquired');
            return () => {
                logMountDebug('cleanup_park_start');
                emitMountBootTrace('pond_mount:release_parkable_runtime', {
                    reason: 'main_tab_hidden',
                });
                controllerRef.current = null;
                runtimeLease.release({ reason: 'main_tab_hidden' });
                logMountDebug('cleanup_park_done');
            };
        }
        emitMountBootTrace('pond_mount:mount_runtime', {
            hardResetToken: Number(hardResetToken) || 0,
            rendererWidth: Number(rendererWidth) || 0,
            rendererHeight: Number(rendererHeight) || 0,
            hostClientWidth: Number(backgroundHost?.clientWidth) || 0,
            hostClientHeight: Number(backgroundHost?.clientHeight) || 0,
            runtimeParamsSyncKeyLength: runtimeParamsSyncKey.length,
            fishRosterSyncKeyLength: fishRosterSyncKey.length,
        });
        const controller = mountZenPondWorkerRenderer(runtimeOptions);
        controllerRef.current = controller;
        logMountDebug('mounted');
        return () => {
            logMountDebug('cleanup_start');
            emitMountBootTrace('pond_mount:dispose_runtime', {
                reason: 'renderer_unmount',
            });
            controllerRef.current = null;
            controller?.dispose?.({ reason: 'renderer_unmount' });
            logMountDebug('cleanup_done');
        };
    }, [
        canMountRenderer,
        emitMountBootTrace,
        hardResetToken,
        parkRuntimeOnUnmount,
    ]);

    useLayoutEffect(() => {
        if (!canMountRenderer) return;
        const controller = syncControllerOptions();
        const sent = controller?.syncRuntimeGate?.({ forcePush: true });
        emitMountBootTrace('pond_mount:sync_runtime_gate', {
            animationEnabled,
            forcePush: true,
            sent: sent === true,
        });
    }, [animationEnabled, canMountRenderer, emitMountBootTrace, syncControllerOptions]);

    useEffect(() => {
        if (!canMountRenderer) return;
        const controller = syncControllerOptions();
        const sent = controller?.syncRendererSize?.({ force: true });
        emitMountBootTrace('pond_mount:sync_renderer_size', {
            rendererWidth: Number(rendererWidth) || 0,
            rendererHeight: Number(rendererHeight) || 0,
            force: true,
            sent: sent === true,
        });
    }, [canMountRenderer, emitMountBootTrace, rendererWidth, rendererHeight, syncControllerOptions]);

    useEffect(() => {
        if (!canMountRenderer) return;
        const controller = syncControllerOptions();
        const sent = controller?.syncSceneSession?.({ force: false });
        emitMountBootTrace('pond_mount:sync_scene_session', {
            hardResetToken: Number(hardResetToken) || 0,
            sceneSessionRevision: Number(sceneSessionRevision) || 0,
            force: false,
            sent: sent === true,
        });
    }, [
        canMountRenderer,
        emitMountBootTrace,
        hardResetToken,
        sceneSessionRevision,
        syncControllerOptions,
    ]);

    useEffect(() => {
        if (!canMountRenderer) return;
        const controller = syncControllerOptions();
        const sent = controller?.syncEnvironmentAuthority?.({ force: false });
        emitMountBootTrace('pond_mount:sync_environment_authority', {
            envRuntimeConfigSignature,
            environmentAuthoritySyncKeyLength: environmentAuthoritySyncKey.length,
            force: false,
            sent: sent === true,
        });
    }, [
        canMountRenderer,
        emitMountBootTrace,
        environmentAuthoritySyncKey,
        envRuntimeConfigSignature,
        syncControllerOptions,
    ]);

    useEffect(() => {
        if (!canMountRenderer) return;
        const controller = syncControllerOptions();
        const sent = controller?.syncRuntimeParams?.({ force: false });
        emitMountBootTrace('pond_mount:sync_runtime_params', {
            qualityMode: runtimeQualityProfile?.qualityMode || '',
            runtimeParamsSyncKeyLength: runtimeParamsSyncKey.length,
            sent: sent === true,
        });
    }, [
        canMountRenderer,
        emitMountBootTrace,
        runtimeParamsSyncKey,
        runtimeQualityProfile?.qualityMode,
        syncControllerOptions,
    ]);

    useEffect(() => {
        if (!canMountRenderer) return;
        const controller = syncControllerOptions();
        const sent = controller?.syncFishRoster?.({ force: false });
        emitMountBootTrace('pond_mount:sync_fish_roster', {
            dayIndex: envAuthorityRef?.current?.timeContext?.dayIndex ?? null,
            hasRoster: hasRosterSnapshot,
            force: false,
            fishRosterSyncKeyLength: fishRosterSyncKey.length,
            presentationSceneCommitKey,
            sent: sent === true,
        });
    }, [
        canMountRenderer,
        emitMountBootTrace,
        envAuthorityRef?.current?.timeContext?.dayIndex,
        fishRosterSyncKey,
        hasRosterSnapshot,
        presentationSceneCommitKey,
        syncControllerOptions,
    ]);

    useEffect(() => {
        requestInputStateSync({ force: true });
    }, [
        lockedTarget,
        hoverTarget,
        selectedFishIntentUid,
        invitationRegistrationEntityId,
        requestInputStateSync,
    ]);

    useEffect(() => () => {
        if (pendingInputSyncFrameRef.current !== null && typeof window !== 'undefined') {
            window.cancelAnimationFrame?.(pendingInputSyncFrameRef.current);
            pendingInputSyncFrameRef.current = null;
        }
    }, []);

    return {
        pondReadiness,
        requestInputStateSync,
    };
};

export {
    useZenWorkerRendererMount,
};
