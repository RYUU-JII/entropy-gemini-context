import { useCallback, useEffect, useRef, useState } from 'react';
import {
    serializeBonsaiCameraSnapshot,
} from '../model/bonsai/rendering/resolveBonsaiCamera.js';
import {
    mountZenBonsaiWorkerRenderer,
    resolveZenBonsaiWorkerCanvasMetrics,
} from './worker/ZenBonsaiWorkerRendererClient.js';
import {
    requireZenBonsaiInputSignature,
    requireZenBonsaiMaterializationKey,
    resolveZenBonsaiWorkerRendererLabel,
} from './worker/zenBonsaiWorkerProtocol.js';
import {
    createZenBonsaiMainSceneSnapshot,
} from './zenBonsaiSceneSnapshot.js';
import {
    emitZenMainBootTrace,
} from './zenMainBootReadinessTrace.js';
import {
    ZEN_HOME_FIRST_VISUAL_MILESTONES,
    createZenHomeFirstVisualBonsaiMilestoneEvent,
} from './zenHomeFirstVisualReadinessContract.js';
import {
    assertSakuraActualAlphaObservationMatchesRequestV1,
    createSakuraActualAlphaObservationRequestV1,
} from '../model/bonsai/rendering/SakuraActualAlphaObservationContract.js';
import {
    ZEN_BONSAI_FIRST_BLOOM_FULL_MASK,
} from '../model/bonsai/plume/ZenBonsaiPlumeBloomPresentationContract.js';

const nowPerfMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const roundMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Number(numeric.toFixed(2)));
};

const normalizePresentationSceneCommitKey = (value) => (
    typeof value === 'string' && value.length > 0 ? value : null
);

const resolveWorkerFailureDetails = (error) => (
    error?.zenBonsaiWorkerFailureDetails
    && typeof error.zenBonsaiWorkerFailureDetails === 'object'
    && !Array.isArray(error.zenBonsaiWorkerFailureDetails)
        ? error.zenBonsaiWorkerFailureDetails
        : null
);

export const resolveZenBonsaiFirstFrameAck = ({
    retainedFrameReady = false,
    renderedSceneSignature = '',
    renderedSceneCommitKey = null,
    renderedBonsaiMaterializationKey,
    renderedInputSignature,
    pendingSceneSignature = '',
    pendingSceneCommitKey = null,
    pendingBonsaiMaterializationKey,
    pendingInputSignature,
    lastRenderedSceneSignature = '',
    lastRenderedSceneCommitKey = null,
    lastRenderedBonsaiMaterializationKey = null,
    lastRenderedInputSignature = null,
} = {}) => {
    const rendered = typeof renderedSceneSignature === 'string' ? renderedSceneSignature : '';
    const pending = typeof pendingSceneSignature === 'string' ? pendingSceneSignature : '';
    const lastRendered = typeof lastRenderedSceneSignature === 'string'
        ? lastRenderedSceneSignature
        : '';
    const renderedCommitKey = normalizePresentationSceneCommitKey(renderedSceneCommitKey);
    const pendingCommitKey = normalizePresentationSceneCommitKey(pendingSceneCommitKey);
    const lastRenderedCommitKey = normalizePresentationSceneCommitKey(lastRenderedSceneCommitKey);
    const renderedMaterializationKey = requireZenBonsaiMaterializationKey(
        renderedBonsaiMaterializationKey,
    );
    const renderedInput = requireZenBonsaiInputSignature(renderedInputSignature);
    if (retainedFrameReady === true) {
        const lastMaterializationKey = requireZenBonsaiMaterializationKey(
            lastRenderedBonsaiMaterializationKey,
        );
        const lastInput = requireZenBonsaiInputSignature(lastRenderedInputSignature);
        const renderedSignatureMatches = Boolean(
            lastRendered
            && rendered
            && rendered === lastRendered
        );
        const renderedCommitKeyMatches = renderedCommitKey === lastRenderedCommitKey;
        const materializationKeyMatches = renderedMaterializationKey === lastMaterializationKey;
        const inputSignatureMatches = renderedInput === lastInput;
        const accepted = renderedSignatureMatches
            && renderedCommitKeyMatches
            && materializationKeyMatches
            && inputSignatureMatches;
        return Object.freeze({
            accepted,
            ackedSceneSignature: accepted ? lastRendered : '',
            ackedSceneCommitKey: accepted ? lastRenderedCommitKey : null,
            ackedBonsaiMaterializationKey: accepted ? lastMaterializationKey : '',
            ackedInputSignature: accepted ? lastInput : '',
        });
    }
    if (!pending && lastRendered) {
        const lastMaterializationKey = requireZenBonsaiMaterializationKey(
            lastRenderedBonsaiMaterializationKey,
        );
        const lastInput = requireZenBonsaiInputSignature(lastRenderedInputSignature);
        const accepted = (
            rendered === lastRendered
            && renderedCommitKey === lastRenderedCommitKey
            && renderedMaterializationKey === lastMaterializationKey
            && renderedInput === lastInput
        );
        return Object.freeze({
            accepted,
            ackedSceneSignature: accepted ? lastRendered : '',
            ackedSceneCommitKey: accepted ? lastRenderedCommitKey : null,
            ackedBonsaiMaterializationKey: accepted ? lastMaterializationKey : '',
            ackedInputSignature: accepted ? lastInput : '',
        });
    }
    const pendingMaterializationKey = requireZenBonsaiMaterializationKey(
        pendingBonsaiMaterializationKey,
    );
    const pendingInput = requireZenBonsaiInputSignature(pendingInputSignature);
    const sceneSignatureMatches = Boolean(pending && rendered && pending === rendered);
    const sceneCommitKeyMatches = pendingCommitKey === renderedCommitKey;
    const materializationKeyMatches = pendingMaterializationKey === renderedMaterializationKey;
    const inputSignatureMatches = pendingInput === renderedInput;
    const accepted = sceneSignatureMatches
        && sceneCommitKeyMatches
        && materializationKeyMatches
        && inputSignatureMatches;
    return Object.freeze({
        accepted,
        ackedSceneSignature: accepted ? rendered : '',
        ackedSceneCommitKey: accepted ? (renderedCommitKey || pendingCommitKey) : null,
        ackedBonsaiMaterializationKey: accepted ? renderedMaterializationKey : '',
        ackedInputSignature: accepted ? renderedInput : '',
    });
};

export function useZenBonsaiMainWorkerRenderer({
    enabled = true,
    active = true,
    suppressSceneSync = false,
    bonsaiMaterializationKey,
    inputSignature,
    presentationSceneCommitKey = null,
    bloomPresentation = null,
    onBloomPresentationComplete = null,
    canvasRef,
    width,
    height,
    frameIdRef,
    treeCacheRef,
    lastCacheKeyRef,
    treeType,
    treeSeed,
    currentPhenotype,
    currentStage,
    treeTopology,
    renderPlan,
    bonsaiLifeState = null,
    activationPresentation = null,
    species,
    mainTargetFps,
    isCollectionMode,
    mainRenderVersion = 0,
    onRenderDebugEvent = null,
    hidePot = false,
    showBackboneDebug = false,
    showBranchTierDebug = false,
    renderMode = 'full',
    mainRenderQuality = 'full',
    mainCadenceContext = 'workspace',
    renderLoopMode = 'continuous',
    renderBackend = 'canvas2d',
    envAuthority = null,
    renderEnvironmentState = null,
    environmentRuntimeConfigSignature = '',
    environmentSignature,
    mainCamera,
    cameraPreset = 'workspace',
    canvasPixelRatio,
    potStyleOverride = null,
    homeGardenBedProjection = null,
    gardenBedMaterialStyle = null,
    presentationStyle = null,
    onFirstFrameReady = null,
    onFirstVisualMilestone = null,
    bootTraceContext = null,
    observeActualAlpha = false,
    onActualAlphaObservation = null,
}) {
    const resolvedBonsaiMaterializationKey = enabled
        ? requireZenBonsaiMaterializationKey(bonsaiMaterializationKey)
        : null;
    const resolvedInputSignature = enabled
        ? requireZenBonsaiInputSignature(inputSignature)
        : null;
    const mainWorkerRendererRef = useRef(null);
    const bloomControlOwnerRef = useRef(null);
    const bloomPresentationRef = useRef(bloomPresentation);
    bloomPresentationRef.current = bloomPresentation;
    const bloomCompleteCallbackRef = useRef(onBloomPresentationComplete);
    bloomCompleteCallbackRef.current = onBloomPresentationComplete;
    const bloomIdentityRef = useRef(null);
    bloomIdentityRef.current = { sceneCommitKey: presentationSceneCommitKey,
        bonsaiMaterializationKey: resolvedBonsaiMaterializationKey, inputSignature: resolvedInputSignature };
    const notifyBloomPresentationComplete = useCallback((receipt) => {
        const identity = bloomIdentityRef.current;
        const presentation = bloomPresentationRef.current;
        if (receipt && presentation && receipt.eventId === presentation.eventId
            && receipt.completedMask === ZEN_BONSAI_FIRST_BLOOM_FULL_MASK
            && (receipt.reason === 'finished' || receipt.reason === 'tree_identity_changed')
            && receipt.sceneCommitKey === identity.sceneCommitKey
            && receipt.bonsaiMaterializationKey === identity.bonsaiMaterializationKey
            && receipt.inputSignature === identity.inputSignature) {
            bloomCompleteCallbackRef.current?.(receipt);
        }
    }, []);
    const mainWorkerCanvasRef = useRef(null);
    const mainWorkerRenderBackendRef = useRef('');
    const firstFrameReadyNotifiedRef = useRef(false);
    const pendingSceneSignatureRef = useRef('');
    const pendingSceneCommitKeyRef = useRef(null);
    const pendingBonsaiMaterializationKeyRef = useRef(null);
    const pendingInputSignatureRef = useRef(null);
    const lastRenderedSceneSignatureRef = useRef('');
    const lastRenderedSceneCommitKeyRef = useRef(null);
    const lastRenderedBonsaiMaterializationKeyRef = useRef(null);
    const lastRenderedInputSignatureRef = useRef(null);
    const lastNotifiedSceneAckIdentityRef = useRef('');
    const workerDiagnosticsSignatureRef = useRef('');
    const workerMountRequestedAtRef = useRef(0);
    const sceneUpdateRequestedAtRef = useRef(0);
    const alphaObservationSurfaceRef = useRef({ key: '', generation: 0 });
    const alphaObservationRequestSequenceRef = useRef(0);
    const alphaObservationArmedRef = useRef(false);
    const pendingAlphaObservationRequestRef = useRef(null);
    const bootTraceContextRef = useRef(bootTraceContext);
    bootTraceContextRef.current = bootTraceContext;
    const [workerEnvironmentDiagnostics, setWorkerEnvironmentDiagnostics] = useState(null);
    const emitBonsaiBootTrace = useCallback((event, details = null) => {
        emitZenMainBootTrace(event, bootTraceContextRef.current, details);
    }, []);
    const emitFirstVisualMilestone = useCallback((milestone, details = null) => {
        if (typeof onFirstVisualMilestone !== 'function') return;
        onFirstVisualMilestone(createZenHomeFirstVisualBonsaiMilestoneEvent(milestone, details));
    }, [onFirstVisualMilestone]);

    const notifyFirstFrameReady = useCallback((metadata = null) => {
        const notifiedAtMs = nowPerfMs();
        const retainedFrameReady = metadata?.retainedFrameReady === true;
        const workerMountElapsedMs = workerMountRequestedAtRef.current > 0
            ? roundMs(notifiedAtMs - workerMountRequestedAtRef.current)
            : null;
        const sceneUpdateAckElapsedMs = !retainedFrameReady && sceneUpdateRequestedAtRef.current > 0
            ? roundMs(notifiedAtMs - sceneUpdateRequestedAtRef.current)
            : null;
        const renderedSceneSignature = typeof metadata?.sceneSignature === 'string'
            ? metadata.sceneSignature
            : '';
        const renderedSceneCommitKey = normalizePresentationSceneCommitKey(
            metadata?.sceneCommitKey,
        );
        const renderedBonsaiMaterializationKey = requireZenBonsaiMaterializationKey(
            metadata?.bonsaiMaterializationKey,
        );
        const renderedInputSignature = requireZenBonsaiInputSignature(
            metadata?.inputSignature,
        );
        const pendingSceneSignature = pendingSceneSignatureRef.current;
        const pendingSceneCommitKey = pendingSceneCommitKeyRef.current;
        const pendingBonsaiMaterializationKey = pendingBonsaiMaterializationKeyRef.current;
        const pendingInputSignature = pendingInputSignatureRef.current;
        const ack = resolveZenBonsaiFirstFrameAck({
            retainedFrameReady,
            renderedSceneSignature,
            renderedSceneCommitKey,
            renderedBonsaiMaterializationKey,
            renderedInputSignature,
            pendingSceneSignature,
            pendingSceneCommitKey,
            pendingBonsaiMaterializationKey,
            pendingInputSignature,
            lastRenderedSceneSignature: lastRenderedSceneSignatureRef.current,
            lastRenderedSceneCommitKey: lastRenderedSceneCommitKeyRef.current,
            lastRenderedBonsaiMaterializationKey: lastRenderedBonsaiMaterializationKeyRef.current,
            lastRenderedInputSignature: lastRenderedInputSignatureRef.current,
        });
        if (!ack.accepted) {
            emitBonsaiBootTrace('bonsai_worker:stale_frame_ack_ignored', {
                renderedSceneSignatureLength: renderedSceneSignature.length,
                pendingSceneSignatureLength: pendingSceneSignature.length,
                renderedSceneCommitKey,
                pendingSceneCommitKey,
                renderedBonsaiMaterializationKeyLength: renderedBonsaiMaterializationKey.length,
                pendingBonsaiMaterializationKeyLength: typeof pendingBonsaiMaterializationKey === 'string'
                    ? pendingBonsaiMaterializationKey.length
                    : 0,
                inputSignaturesMatch: Boolean(
                    renderedInputSignature
                    && pendingInputSignature
                    && renderedInputSignature === pendingInputSignature
                ),
                signaturesMatch: Boolean(
                    renderedSceneSignature
                    && pendingSceneSignature
                    && renderedSceneSignature === pendingSceneSignature
                ),
            });
            return;
        }
        const ackedSceneSignature = ack.ackedSceneSignature;
        const ackedSceneCommitKey = ack.ackedSceneCommitKey;
        const ackedBonsaiMaterializationKey = ack.ackedBonsaiMaterializationKey;
        const ackedInputSignature = ack.ackedInputSignature;
        if (ackedSceneSignature) {
            lastRenderedSceneSignatureRef.current = ackedSceneSignature;
            lastRenderedSceneCommitKeyRef.current = ackedSceneCommitKey;
            lastRenderedBonsaiMaterializationKeyRef.current = ackedBonsaiMaterializationKey;
            lastRenderedInputSignatureRef.current = ackedInputSignature;
            if (
                pendingSceneSignatureRef.current === ackedSceneSignature
                && pendingBonsaiMaterializationKeyRef.current === ackedBonsaiMaterializationKey
                && pendingInputSignatureRef.current === ackedInputSignature
            ) {
                pendingSceneSignatureRef.current = '';
                pendingSceneCommitKeyRef.current = null;
                pendingBonsaiMaterializationKeyRef.current = null;
                pendingInputSignatureRef.current = null;
            }
        }
        const resolvedMetadata = {
            source: 'zen_bonsai_worker_first_frame',
            ...(metadata && typeof metadata === 'object' ? metadata : {}),
            sceneSignature: ackedSceneSignature,
            sceneCommitKey: ackedSceneCommitKey,
            bonsaiMaterializationKey: ackedBonsaiMaterializationKey,
            inputSignature: ackedInputSignature,
            workerMountElapsedMs,
            sceneUpdateAckElapsedMs,
        };
        if (!firstFrameReadyNotifiedRef.current && typeof onFirstFrameReady === 'function') {
            firstFrameReadyNotifiedRef.current = true;
            emitBonsaiBootTrace('bonsai_worker:first_frame_ready', {
                workerMountElapsedMs,
                sceneUpdateAckElapsedMs,
                workerTiming: metadata?.workerTiming || null,
                clientTiming: metadata?.clientTiming || null,
                metadata: resolvedMetadata,
            });
            emitFirstVisualMilestone(ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_FIRST_FRAME_READY, {
                workerMountElapsedMs,
                sceneUpdateAckElapsedMs,
                retainedFrameReady,
                workerTiming: metadata?.workerTiming || null,
                clientTiming: metadata?.clientTiming || null,
                metadata: resolvedMetadata,
            });
        }
        if (typeof onFirstFrameReady !== 'function') {
            return;
        }
        const sceneAckIdentity = [
            ackedSceneSignature,
            ackedSceneCommitKey || '',
            ackedBonsaiMaterializationKey,
            ackedInputSignature,
        ].join('\u0000');
        if (lastNotifiedSceneAckIdentityRef.current === sceneAckIdentity) {
            return;
        }
        lastNotifiedSceneAckIdentityRef.current = sceneAckIdentity;
        emitBonsaiBootTrace('bonsai_worker:scene_frame_committed', {
            treeSeed: metadata?.treeSeed,
            renderedPresentation: metadata?.renderedPresentation || null,
            sceneSignatureLength: ackedSceneSignature.length,
            sceneCommitKey: ackedSceneCommitKey,
            bonsaiMaterializationKeyLength: ackedBonsaiMaterializationKey.length,
            inputSignatureLength: ackedInputSignature.length,
            retainedFrameReady,
            sceneUpdateAckElapsedMs,
        });
        onFirstFrameReady(resolvedMetadata);
    }, [emitBonsaiBootTrace, emitFirstVisualMilestone, onFirstFrameReady]);

    const handleWorkerRenderDebugEvent = useCallback((event = null) => {
        const diagnostics = event?.environmentDiagnostics;
        if (diagnostics && typeof diagnostics === 'object') {
            const signature = [
                diagnostics.hour,
                diagnostics.timestampMs,
                diagnostics.timeZone,
                diagnostics.solarPhase,
                diagnostics.workerClockOwned,
                diagnostics.daylight,
                diagnostics.night,
            ].join('|');
            if (signature !== workerDiagnosticsSignatureRef.current) {
                workerDiagnosticsSignatureRef.current = signature;
                setWorkerEnvironmentDiagnostics(diagnostics);
            }
        }
        if (event?.status === 'worker_ready') {
            const workerReadyDetails = {
                renderer: event?.renderer || null,
                renderBackend: event?.renderBackend || null,
                workerTiming: event?.workerTiming || null,
                clientTiming: event?.clientTiming || null,
            };
            emitBonsaiBootTrace('bonsai_worker:worker_ready', workerReadyDetails);
            emitFirstVisualMilestone(ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_WORKER_READY, workerReadyDetails);
        }
        if (event?.status === 'error') {
            const sceneCommitKey = pendingSceneCommitKeyRef.current
                || lastRenderedSceneCommitKeyRef.current;
            const bonsaiMaterializationKey = pendingBonsaiMaterializationKeyRef.current
                || lastRenderedBonsaiMaterializationKeyRef.current;
            const inputSignature = pendingInputSignatureRef.current
                || lastRenderedInputSignatureRef.current;
            const reason = String(event?.reason || 'zen_bonsai_worker_runtime_failed');
            emitBonsaiBootTrace('bonsai_worker:runtime_failed', {
                sceneCommitKey,
                reason,
            });
            emitFirstVisualMilestone(
                ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_FAILED_MOUNT_OR_UPDATE,
                {
                    sceneCommitKey,
                    bonsaiMaterializationKey,
                    inputSignature,
                    reason,
                    errorCode: event?.failureCode || event?.code || null,
                },
            );
        }
        let actualAlphaObservation = null;
        if (event?.actualAlphaObservation) {
            const pendingRequest = pendingAlphaObservationRequestRef.current;
            if (!pendingRequest) {
                throw new Error('ZEN_BONSAI_WORKER_ALPHA_OBSERVATION_UNSOLICITED');
            }
            actualAlphaObservation = assertSakuraActualAlphaObservationMatchesRequestV1({
                request: pendingRequest,
                observation: event.actualAlphaObservation,
            });
            pendingAlphaObservationRequestRef.current = null;
        }
        const resolvedEvent = actualAlphaObservation
            ? { ...event, actualAlphaObservation }
            : event;
        if (typeof onRenderDebugEvent === 'function') {
            onRenderDebugEvent(resolvedEvent);
        }
        if (actualAlphaObservation && typeof onActualAlphaObservation === 'function') {
            onActualAlphaObservation(actualAlphaObservation);
        }
    }, [
        emitBonsaiBootTrace,
        emitFirstVisualMilestone,
        onActualAlphaObservation,
        onRenderDebugEvent,
    ]);

    useEffect(() => {
        workerDiagnosticsSignatureRef.current = '';
        setWorkerEnvironmentDiagnostics(null);
    }, [environmentRuntimeConfigSignature]);

    useEffect(() => {
        return () => {
            if (mainWorkerRendererRef.current) {
                emitBonsaiBootTrace('bonsai_worker:dispose_on_unmount', {
                    reason: 'tree_renderer_unmount',
                });
                mainWorkerRendererRef.current.dispose({
                    reason: 'tree_renderer_unmount',
                    deferMs: 0,
                });
                mainWorkerRendererRef.current = null;
            }
            mainWorkerCanvasRef.current = null;
            mainWorkerRenderBackendRef.current = '';
            firstFrameReadyNotifiedRef.current = false;
            pendingSceneSignatureRef.current = '';
            pendingSceneCommitKeyRef.current = null;
            pendingBonsaiMaterializationKeyRef.current = null;
            pendingInputSignatureRef.current = null;
            lastRenderedSceneSignatureRef.current = '';
            lastRenderedSceneCommitKeyRef.current = null;
            lastRenderedBonsaiMaterializationKeyRef.current = null;
            lastRenderedInputSignatureRef.current = null;
            lastNotifiedSceneAckIdentityRef.current = '';
            workerDiagnosticsSignatureRef.current = '';
            alphaObservationArmedRef.current = false;
            pendingAlphaObservationRequestRef.current = null;
            frameIdRef.current = null;
        };
    }, [emitBonsaiBootTrace, frameIdRef]);

    useEffect(() => {
        if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
            return undefined;
        }
        const syncWorkerVisibility = () => {
            const canRender = (
                enabled
                && active === true
                && document.hidden !== true
                && (suppressSceneSync !== true || Boolean(lastRenderedSceneSignatureRef.current))
                && (renderPlan != null || Boolean(lastRenderedSceneSignatureRef.current))
                && isCollectionMode !== true
                && Boolean(canvasRef.current)
                && Boolean(width)
                && Boolean(height)
            );
            emitBonsaiBootTrace('bonsai_worker:visibility_sync', {
                canRender,
                enabled,
                active,
                documentHidden: document.hidden === true,
                isCollectionMode,
                width,
                height,
            });
            mainWorkerRendererRef.current?.setActive?.(canRender);
        };
        document.addEventListener('visibilitychange', syncWorkerVisibility);
        syncWorkerVisibility();
        return () => {
            document.removeEventListener('visibilitychange', syncWorkerVisibility);
        };
    }, [active, canvasRef, emitBonsaiBootTrace, enabled, height, isCollectionMode, renderPlan, suppressSceneSync, width]);

    useEffect(() => {
        if (!enabled) {
            if (mainWorkerRendererRef.current) {
                emitBonsaiBootTrace('bonsai_worker:dispose_disabled', {
                    reason: 'lab_runtime_disabled',
                });
                mainWorkerRendererRef.current.dispose({ reason: 'lab_runtime_disabled', deferMs: 0 });
                mainWorkerRendererRef.current = null;
            }
            mainWorkerCanvasRef.current = null;
            mainWorkerRenderBackendRef.current = '';
            firstFrameReadyNotifiedRef.current = false;
            pendingSceneSignatureRef.current = '';
            pendingSceneCommitKeyRef.current = null;
            pendingBonsaiMaterializationKeyRef.current = null;
            pendingInputSignatureRef.current = null;
            lastRenderedSceneSignatureRef.current = '';
            lastRenderedSceneCommitKeyRef.current = null;
            lastRenderedBonsaiMaterializationKeyRef.current = null;
            lastRenderedInputSignatureRef.current = null;
            lastNotifiedSceneAckIdentityRef.current = '';
            workerDiagnosticsSignatureRef.current = '';
            alphaObservationArmedRef.current = false;
            pendingAlphaObservationRequestRef.current = null;
            setWorkerEnvironmentDiagnostics(null);
            frameIdRef.current = null;
            if (onRenderDebugEvent) {
                onRenderDebugEvent({
                    channel: 'main',
                    status: 'idle',
                    reason: 'main_runtime_disabled',
                    width,
                    height,
                    timestamp: Date.now(),
                });
            }
            return undefined;
        }

        if (isCollectionMode) {
            mainWorkerRendererRef.current?.setActive?.(false);
            emitBonsaiBootTrace('bonsai_worker:skip_collection_mode', {
                width,
                height,
            });
            if (onRenderDebugEvent) {
                onRenderDebugEvent({
                    channel: 'main',
                    status: 'skipped',
                    reason: 'collection_mode_active',
                    width,
                    height,
                    timestamp: Date.now(),
                });
            }
            return undefined;
        }

        const canvas = canvasRef.current;
        if (!canvas || !width || !height) {
            mainWorkerRendererRef.current?.setActive?.(false);
            const waitingCanvasDetails = {
                hasCanvas: Boolean(canvas),
                width,
                height,
            };
            emitBonsaiBootTrace('bonsai_worker:waiting_canvas', waitingCanvasDetails);
            emitFirstVisualMilestone(ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_WAITING_CANVAS, waitingCanvasDetails);
            if (onRenderDebugEvent) {
                onRenderDebugEvent({
                    channel: 'main',
                    status: 'waiting',
                    reason: 'main_canvas_not_ready',
                    width,
                    height,
                    timestamp: Date.now(),
                });
            }
            return undefined;
        }

        const canvasMetrics = resolveZenBonsaiWorkerCanvasMetrics({
            width,
            height,
            pixelRatio: canvasPixelRatio,
        });
        const workerRuntimeSignature = [
            renderLoopMode,
            renderBackend,
            mainRenderQuality,
            mainCadenceContext,
            Number.isFinite(Number(mainTargetFps)) ? Math.round(Number(mainTargetFps)) : '',
        ].join('|');
        if (mainWorkerCanvasRef.current && mainWorkerCanvasRef.current !== canvas) {
            emitBonsaiBootTrace('bonsai_worker:dispose_canvas_replaced');
            mainWorkerRendererRef.current?.dispose?.({ reason: 'tree_canvas_replaced', deferMs: 0 });
            mainWorkerRendererRef.current = null;
            mainWorkerRenderBackendRef.current = '';
            pendingSceneSignatureRef.current = '';
            pendingSceneCommitKeyRef.current = null;
            pendingBonsaiMaterializationKeyRef.current = null;
            pendingInputSignatureRef.current = null;
            lastRenderedSceneSignatureRef.current = '';
            lastRenderedSceneCommitKeyRef.current = null;
            lastRenderedBonsaiMaterializationKeyRef.current = null;
            lastRenderedInputSignatureRef.current = null;
            lastNotifiedSceneAckIdentityRef.current = '';
            alphaObservationArmedRef.current = false;
            pendingAlphaObservationRequestRef.current = null;
        }
        if (mainWorkerRendererRef.current && mainWorkerRenderBackendRef.current !== renderBackend) {
            emitBonsaiBootTrace('bonsai_worker:dispose_backend_changed', {
                from: mainWorkerRenderBackendRef.current,
                to: renderBackend,
            });
            mainWorkerRendererRef.current.dispose({ reason: 'tree_render_backend_changed', deferMs: 0 });
            mainWorkerRendererRef.current = null;
            mainWorkerRenderBackendRef.current = '';
            pendingSceneSignatureRef.current = '';
            pendingSceneCommitKeyRef.current = null;
            pendingBonsaiMaterializationKeyRef.current = null;
            pendingInputSignatureRef.current = null;
            lastRenderedSceneSignatureRef.current = '';
            lastRenderedSceneCommitKeyRef.current = null;
            lastRenderedBonsaiMaterializationKeyRef.current = null;
            lastRenderedInputSignatureRef.current = null;
            lastNotifiedSceneAckIdentityRef.current = '';
            alphaObservationArmedRef.current = false;
            pendingAlphaObservationRequestRef.current = null;
        }
        const canRenderMainScene = active === true
            && !(typeof document !== 'undefined' && document.hidden === true);
        const normalizedSceneCommitKey = normalizePresentationSceneCommitKey(
            presentationSceneCommitKey,
        );
        const retainedSceneSignature = lastRenderedSceneSignatureRef.current;
        if ((suppressSceneSync && !retainedSceneSignature) || (!active && renderPlan == null)) {
            // Parking before the first ACK has no retained scene to present.
            // This is a lifecycle wait, never a fabricated first-frame success.
            mainWorkerRendererRef.current?.setActive(false);
            const waitingSceneDetails = {
                reason: 'waiting_for_current_plan',
                suppressSceneSync,
                hasRenderPlan: renderPlan != null,
                retainedScene: Boolean(retainedSceneSignature),
                width,
                height,
            };
            emitBonsaiBootTrace('bonsai_worker:waiting_scene', waitingSceneDetails);
            onRenderDebugEvent?.({ channel: 'main', status: 'waiting', ...waitingSceneDetails, timestamp: Date.now() });
            return undefined;
        }
        if (suppressSceneSync && mainWorkerRendererRef.current && retainedSceneSignature) {
            const controller = mainWorkerRendererRef.current;
            controller.updateCallbacks({
                onRenderDebugEvent: handleWorkerRenderDebugEvent,
                onFirstFrameReady: notifyFirstFrameReady,
                onBloomPresentationComplete: notifyBloomPresentationComplete,
            });
            const resizeDispatchStartMs = nowPerfMs();
            controller.resize({
                width,
                height,
                pixelRatio: canvasPixelRatio,
            });
            const resizeDispatchElapsedMs = roundMs(nowPerfMs() - resizeDispatchStartMs);
            const activeDispatchStartMs = nowPerfMs();
            controller.setActive(canRenderMainScene);
            const activeDispatchElapsedMs = roundMs(nowPerfMs() - activeDispatchStartMs);
            frameIdRef.current = () => controller.setActive(false);
            const updateSceneHeldDetails = {
                retainedScene: true,
                currentSceneRendered: (
                    lastRenderedSceneCommitKeyRef.current === normalizedSceneCommitKey
                    && lastRenderedBonsaiMaterializationKeyRef.current === resolvedBonsaiMaterializationKey
                    && lastRenderedInputSignatureRef.current === resolvedInputSignature
                ),
                cacheInvalidated: false,
                width,
                height,
                renderLoopMode,
                renderBackend,
                workerRuntimeSignature,
                sceneSignatureLength: retainedSceneSignature.length,
                resizeDispatchElapsedMs,
                activeDispatchElapsedMs,
            };
            emitBonsaiBootTrace('bonsai_worker:update_scene_held', updateSceneHeldDetails);
            emitFirstVisualMilestone(ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_UPDATE_SCENE_HELD, updateSceneHeldDetails);
            return undefined;
        }
        if (!renderPlan || !renderPlan.source || typeof renderPlan.source.topologySignature !== 'string') {
            throw new Error('ZEN_BONSAI_MAIN_ACTIVE_RENDER_PLAN_REQUIRED');
        }
        const sceneSnapshotStartMs = nowPerfMs();
        const sceneSnapshot = createZenBonsaiMainSceneSnapshot({
            bonsaiMaterializationKey: resolvedBonsaiMaterializationKey,
            inputSignature: resolvedInputSignature,
            treeType,
            treeSeed,
            currentPhenotype,
            currentStage,
            treeTopology,
            topologySignature: renderPlan.source.topologySignature,
            renderPlan,
            lifeState: bonsaiLifeState,
            activationPresentation,
            environmentState: renderEnvironmentState,
            environmentSignature,
            environmentRuntimeConfigSignature,
            canvasMetrics,
            cameraPreset,
            hidePot,
            potStyleOverride,
            showBackboneDebug,
            showBranchTierDebug,
            renderMode,
            mainRenderQuality,
            renderLoopMode,
            renderBackend,
            mainRenderVersion,
            homeGardenBedProjection,
            gardenBedMaterialStyle,
            presentationStyle,
        });
        const sceneSnapshotBuildMs = roundMs(nowPerfMs() - sceneSnapshotStartMs);
        const currentCacheKey = sceneSnapshot.sceneSignature;
        if (observeActualAlpha !== true) {
            alphaObservationArmedRef.current = false;
        }
        const alphaObservationRequest = (
            observeActualAlpha === true
            && alphaObservationArmedRef.current !== true
        )
            ? (() => {
                const safeWidth = renderPlan.surface.pixelWidth;
                const safeHeight = renderPlan.surface.pixelHeight;
                const surfaceKey = [
                    renderBackend,
                    safeWidth,
                    safeHeight,
                    canvasPixelRatio,
                ].join('|');
                if (alphaObservationSurfaceRef.current.key !== surfaceKey) {
                    alphaObservationSurfaceRef.current = {
                        key: surfaceKey,
                        generation: alphaObservationSurfaceRef.current.generation + 1,
                    };
                }
                const generation = alphaObservationSurfaceRef.current.generation;
                const requestSequence = alphaObservationRequestSequenceRef.current + 1;
                alphaObservationRequestSequenceRef.current = requestSequence;
                const guard = Math.max(32, Math.min(128, Math.round(
                    Math.max(safeWidth, safeHeight) * 0.12,
                )));
                return createSakuraActualAlphaObservationRequestV1({
                    requestId: `worker:${generation}:${requestSequence}`,
                    identity: {
                        sceneSignature: currentCacheKey,
                        sceneCommitKey: normalizedSceneCommitKey
                            || `worker-scene:${currentCacheKey}`,
                        renderPlanSignature: renderPlan.signature,
                        bonsaiMaterializationKey: resolvedBonsaiMaterializationKey,
                        inputSignature: resolvedInputSignature,
                        surface: {
                            generation,
                            width: safeWidth,
                            height: safeHeight,
                            pixelRatio: canvasPixelRatio,
                            renderBackend,
                        },
                    },
                    safeViewportRect: { x: 0, y: 0, width: safeWidth, height: safeHeight },
                    captureRect: {
                        x: -guard,
                        y: -guard,
                        width: safeWidth + (guard * 2),
                        height: safeHeight + (guard * 2),
                    },
                    minimumAlpha: 1,
                });
            })()
            : null;
        const cacheInvalidated = currentCacheKey !== lastCacheKeyRef.current;

        const isAnimated = species?.isAnimated !== false && renderLoopMode !== 'dirty';

        try {
            let mountControllerElapsedMs = null;
            if (!mainWorkerRendererRef.current) {
                workerMountRequestedAtRef.current = nowPerfMs();
                const mountRendererDetails = {
                    width,
                    height,
                    pixelRatio: canvasPixelRatio,
                    renderBackend,
                };
                emitBonsaiBootTrace('bonsai_worker:mount_renderer', mountRendererDetails);
                emitFirstVisualMilestone(ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_MOUNT_RENDERER, mountRendererDetails);
                const mountControllerStartMs = nowPerfMs();
                mainWorkerRendererRef.current = mountZenBonsaiWorkerRenderer({
                    canvas,
                    width,
                    height,
                    pixelRatio: canvasPixelRatio,
                    renderBackend,
                    onRenderDebugEvent: handleWorkerRenderDebugEvent,
                    onFirstFrameReady: notifyFirstFrameReady,
                    onBloomPresentationComplete: notifyBloomPresentationComplete,
                });
                mountControllerElapsedMs = roundMs(nowPerfMs() - mountControllerStartMs);
                mainWorkerCanvasRef.current = canvas;
                mainWorkerRenderBackendRef.current = renderBackend;
                const mountRendererReadyDetails = {
                    width,
                    height,
                    pixelRatio: canvasPixelRatio,
                    renderBackend,
                    mountControllerElapsedMs,
                };
                emitBonsaiBootTrace('bonsai_worker:mount_renderer_ready', mountRendererReadyDetails);
                emitFirstVisualMilestone(
                    ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_MOUNT_RENDERER_READY,
                    mountRendererReadyDetails,
                );
            } else {
                emitBonsaiBootTrace('bonsai_worker:update_callbacks', {
                    renderBackend,
                });
                mainWorkerRendererRef.current.updateCallbacks({
                    onRenderDebugEvent: handleWorkerRenderDebugEvent,
                    onFirstFrameReady: notifyFirstFrameReady,
                    onBloomPresentationComplete: notifyBloomPresentationComplete,
                });
            }

            const controller = mainWorkerRendererRef.current;
            const resizeDispatchStartMs = nowPerfMs();
            const resolvedMetrics = controller.resize({
                width,
                height,
                pixelRatio: canvasPixelRatio,
            });
            const resizeDispatchElapsedMs = roundMs(nowPerfMs() - resizeDispatchStartMs);
            const activeDispatchStartMs = nowPerfMs();
            controller.setActive(canRenderMainScene);
            const activeDispatchElapsedMs = roundMs(nowPerfMs() - activeDispatchStartMs);
            frameIdRef.current = () => controller.setActive(false);

            const currentSceneRendered = (
                typeof currentCacheKey === 'string'
                && currentCacheKey
                && lastRenderedSceneSignatureRef.current === currentCacheKey
                && lastRenderedSceneCommitKeyRef.current === normalizedSceneCommitKey
                && lastRenderedBonsaiMaterializationKeyRef.current === resolvedBonsaiMaterializationKey
                && lastRenderedInputSignatureRef.current === resolvedInputSignature
            );
            if (suppressSceneSync) {
                const updateSceneHeldDetails = {
                    currentSceneRendered,
                    cacheInvalidated,
                    width,
                    height,
                    renderLoopMode,
                    renderBackend,
                    workerRuntimeSignature,
                    sceneSignatureLength: typeof currentCacheKey === 'string' ? currentCacheKey.length : 0,
                    sceneSnapshotBuildMs,
                    mountControllerElapsedMs,
                    resizeDispatchElapsedMs,
                    activeDispatchElapsedMs,
                };
                emitBonsaiBootTrace('bonsai_worker:update_scene_held', updateSceneHeldDetails);
                emitFirstVisualMilestone(ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_UPDATE_SCENE_HELD, updateSceneHeldDetails);
                return undefined;
            }
            const requiresFrameAck = Boolean(currentCacheKey && !currentSceneRendered);
            const sceneDispatchStartMs = nowPerfMs();
            const sceneBloomPresentation = bloomPresentationRef.current;
            const sceneUpdated = controller.updateScene({
                bloomPresentation: sceneBloomPresentation,
                sceneSignature: currentCacheKey,
                sceneCommitKey: normalizedSceneCommitKey,
                bonsaiMaterializationKey: resolvedBonsaiMaterializationKey,
                inputSignature: resolvedInputSignature,
                treeType,
                treeSeed,
                topology: treeTopology,
                renderPlan,
                alphaObservationRequest,
                currentStage,
                envAuthority,
                environmentState: renderEnvironmentState,
                camera: serializeBonsaiCameraSnapshot(mainCamera),
                targetFps: mainTargetFps,
                cadenceContext: mainCadenceContext,
                renderLoopMode,
                renderBackend,
                workerRuntimeSignature,
                width,
                height,
                cacheInvalidated,
                topologySignature: sceneSnapshot.topologySignature,
                staticLayerSignatures: sceneSnapshot.staticLayerSignatures,
                branchRigSignature: sceneSnapshot.branchRigSignature,
                renderOptions: sceneSnapshot.renderOptions,
            }, {
                force: requiresFrameAck,
            });
            const sceneDispatchElapsedMs = roundMs(nowPerfMs() - sceneDispatchStartMs);
            if (sceneUpdated) {
                bloomControlOwnerRef.current = sceneBloomPresentation === null
                    ? null : { controller, eventId: sceneBloomPresentation.eventId };
                sceneUpdateRequestedAtRef.current = nowPerfMs();
                pendingAlphaObservationRequestRef.current = alphaObservationRequest;
                if (alphaObservationRequest) {
                    alphaObservationArmedRef.current = true;
                }
            }
            const updateSceneDetails = {
                sceneUpdated,
                requiresFrameAck,
                currentSceneRendered,
                cacheInvalidated,
                width,
                height,
                renderLoopMode,
                renderBackend,
                workerRuntimeSignature,
                sceneSignatureLength: typeof currentCacheKey === 'string' ? currentCacheKey.length : 0,
                sceneSnapshotBuildMs,
                mountControllerElapsedMs,
                resizeDispatchElapsedMs,
                activeDispatchElapsedMs,
                sceneDispatchElapsedMs,
            };
            emitBonsaiBootTrace('bonsai_worker:update_scene', updateSceneDetails);
            emitFirstVisualMilestone(
                sceneUpdated
                    ? ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_UPDATE_SCENE_SENT
                    : ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_UPDATE_SCENE_SKIPPED,
                updateSceneDetails,
            );
            if (sceneUpdated) {
                pendingSceneSignatureRef.current = currentCacheKey;
                pendingSceneCommitKeyRef.current = normalizedSceneCommitKey;
                pendingBonsaiMaterializationKeyRef.current = resolvedBonsaiMaterializationKey;
                pendingInputSignatureRef.current = resolvedInputSignature;
                lastCacheKeyRef.current = currentCacheKey;
                treeCacheRef.current = null;
            } else if (!currentSceneRendered) {
                if (onRenderDebugEvent) {
                    onRenderDebugEvent({
                        channel: 'main',
                        status: 'waiting',
                        reason: 'worker_scene_waiting_for_first_frame_ack',
                        renderer: resolveZenBonsaiWorkerRendererLabel(renderBackend),
                        width,
                        height,
                        pixelWidth: resolvedMetrics.pixelWidth,
                        pixelHeight: resolvedMetrics.pixelHeight,
                        treeSeed,
                        isAnimated,
                        renderLoopMode,
                        renderBackend,
                        cacheInvalidated,
                        timestamp: Date.now(),
                    });
                }
            } else if (onRenderDebugEvent) {
                lastCacheKeyRef.current = currentCacheKey;
                onRenderDebugEvent({
                    channel: 'main',
                    status: 'retained',
                    reason: 'worker_scene_unchanged',
                    renderer: resolveZenBonsaiWorkerRendererLabel(renderBackend),
                    width,
                    height,
                    pixelWidth: resolvedMetrics.pixelWidth,
                    pixelHeight: resolvedMetrics.pixelHeight,
                    treeSeed,
                    isAnimated,
                    renderLoopMode,
                    renderBackend,
                    cacheInvalidated: false,
                    timestamp: Date.now(),
                });
                notifyFirstFrameReady({
                    reason: 'worker_scene_retained',
                    firstFrameAcked: false,
                    retainedFrameReady: true,
                    sceneSignature: currentCacheKey,
                    sceneCommitKey: normalizedSceneCommitKey,
                    bonsaiMaterializationKey: resolvedBonsaiMaterializationKey,
                    inputSignature: resolvedInputSignature,
                    renderer: resolveZenBonsaiWorkerRendererLabel(renderBackend),
                    width,
                    height,
                    pixelWidth: resolvedMetrics.pixelWidth,
                    pixelHeight: resolvedMetrics.pixelHeight,
                    treeSeed,
                    isAnimated,
                    renderLoopMode,
                    renderBackend,
                    cacheInvalidated: false,
                });
            } else {
                lastCacheKeyRef.current = currentCacheKey;
                notifyFirstFrameReady({
                    reason: 'worker_scene_retained',
                    firstFrameAcked: false,
                    retainedFrameReady: true,
                    sceneSignature: currentCacheKey,
                    sceneCommitKey: normalizedSceneCommitKey,
                    bonsaiMaterializationKey: resolvedBonsaiMaterializationKey,
                    inputSignature: resolvedInputSignature,
                    renderer: resolveZenBonsaiWorkerRendererLabel(renderBackend),
                    width,
                    height,
                    pixelWidth: resolvedMetrics.pixelWidth,
                    pixelHeight: resolvedMetrics.pixelHeight,
                    treeSeed,
                    isAnimated,
                    renderLoopMode,
                    renderBackend,
                    cacheInvalidated: false,
                });
            }
        } catch (error) {
            emitBonsaiBootTrace('bonsai_worker:mount_or_update_failed', { error });
            emitFirstVisualMilestone(ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_FAILED_MOUNT_OR_UPDATE, {
                sceneCommitKey: normalizedSceneCommitKey,
                inputSignature: resolvedInputSignature,
                bonsaiMaterializationKey: resolvedBonsaiMaterializationKey,
                reason: String(error?.message || error || 'zen_bonsai_worker_mount_failed'),
            });
            const workerFailureDetails = resolveWorkerFailureDetails(error);
            if (onRenderDebugEvent) {
                onRenderDebugEvent({
                    channel: 'main',
                    status: 'error',
                    reason: String(error?.message || error || 'zen_bonsai_worker_mount_failed'),
                    width,
                    height,
                    timestamp: Date.now(),
                    ...(workerFailureDetails || {}),
                });
            }
        }

        return undefined;
    }, [
        width,
        height,
        enabled,
        active,
        suppressSceneSync,
        bonsaiMaterializationKey,
        inputSignature,
        presentationSceneCommitKey,
        currentStage,
        treeTopology,
        renderPlan,
        bonsaiLifeState,
        activationPresentation,
        treeType,
        species,
        currentPhenotype,
        treeSeed,
        canvasRef,
        frameIdRef,
        treeCacheRef,
        lastCacheKeyRef,
        mainTargetFps,
        isCollectionMode,
        mainRenderVersion,
        onRenderDebugEvent,
        hidePot,
        potStyleOverride,
        homeGardenBedProjection,
        gardenBedMaterialStyle,
        presentationStyle,
        showBackboneDebug,
        showBranchTierDebug,
        renderMode,
        mainRenderQuality,
        mainCadenceContext,
        renderLoopMode,
        renderBackend,
        envAuthority,
        renderEnvironmentState,
        environmentRuntimeConfigSignature,
        environmentSignature,
        emitBonsaiBootTrace,
        emitFirstVisualMilestone,
        mainCamera,
        cameraPreset,
        canvasPixelRatio,
        handleWorkerRenderDebugEvent,
        notifyFirstFrameReady,
        onFirstFrameReady,
        observeActualAlpha,
        onActualAlphaObservation,
    ]);

    useEffect(() => {
        const controller = mainWorkerRendererRef.current;
        if (!enabled || !controller || !resolvedBonsaiMaterializationKey || !resolvedInputSignature) return;
        const owner = bloomControlOwnerRef.current;
        const controllerOwned = owner?.controller === controller;
        const eventOwned = controllerOwned && bloomPresentation !== null
            && owner.eventId === bloomPresentation.eventId;
        // A retained pre-release tree can have no flowers while the qualifying
        // projection is computing. Its first held pose belongs to the next
        // SCENE, never that old display plan. Existing events must still receive
        // their pause control while a replacement materialization is pending.
        if (suppressSceneSync && bloomPresentation !== null && !eventOwned) return;
        if (bloomPresentation === null && !controllerOwned) return;
        controller.updateBloomPresentation(bloomPresentation, {
            sceneCommitKey: normalizePresentationSceneCommitKey(presentationSceneCommitKey),
            bonsaiMaterializationKey: resolvedBonsaiMaterializationKey,
            inputSignature: resolvedInputSignature,
        });
        bloomControlOwnerRef.current = bloomPresentation === null
            ? null : { controller, eventId: bloomPresentation.eventId };
    }, [bloomPresentation, enabled, presentationSceneCommitKey, suppressSceneSync,
        resolvedBonsaiMaterializationKey, resolvedInputSignature]);

    return {
        workerEnvironmentDiagnostics,
    };
}
