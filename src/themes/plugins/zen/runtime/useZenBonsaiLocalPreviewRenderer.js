import { useEffect, useRef } from 'react';

import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import {
    resolveZenBonsaiWindState,
} from '../model/zenBonsaiSceneEnvironment.js';
import {
    syncZenBonsaiCanvasBackingStore,
} from './zenBonsaiCanvasMetrics.js';
import {
    createZenBonsaiMainSceneSnapshot,
} from './zenBonsaiSceneSnapshot.js';
import {
    createSakuraActualAlphaObservationRequestV1,
} from '../model/bonsai/rendering/SakuraActualAlphaObservationContract.js';
import { observeSakuraCanvasActualAlphaV1 } from './sakuraCanvasActualAlphaObserver.js';
import { releaseZenBonsaiRainCanvas } from './rain/zenRainCanvas.js';

const LOCAL_PREVIEW_RENDERER = 'canvas2d_local_preview';

const emitRenderDebugEvent = (handler, event) => {
    if (typeof handler === 'function') {
        handler({
            channel: 'main',
            timestamp: Date.now(),
            renderer: LOCAL_PREVIEW_RENDERER,
            ...event,
        });
    }
};

export function useZenBonsaiLocalPreviewRenderer({
    enabled = false,
    bonsaiMaterializationKey,
    inputSignature,
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
    assetCache,
    mainTargetFps = 60,
    mainRenderVersion = 0,
    onRenderDebugEvent = null,
    hidePot = false,
    showBackboneDebug = false,
    showBranchTierDebug = false,
    renderMode = 'full',
    mainRenderQuality = 'full',
    renderLoopMode = 'continuous',
    renderBackend = 'canvas2d',
    renderEnvironmentState = null,
    environmentSignature,
    mainCamera,
    cameraPreset = 'workspace',
    canvasPixelRatio,
    potStyleOverride = null,
    homeGardenBedProjection = null,
    gardenBedMaterialStyle = null,
    observeActualAlpha = false,
    onActualAlphaObservation = null,
}) {
    const alphaObservationArmedRef = useRef(false);
    const alphaObservationPendingRequestRef = useRef(null);
    const alphaObservationRequestSequenceRef = useRef(0);
    const alphaObservationSurfaceRef = useRef({ key: '', generation: 0 });
    useEffect(() => {
        if (observeActualAlpha !== true) {
            alphaObservationArmedRef.current = false;
            alphaObservationPendingRequestRef.current = null;
        }
        if (!enabled) {
            return undefined;
        }
        if (renderBackend !== 'canvas2d') {
            throw new Error(`ZEN_BONSAI_LOCAL_PREVIEW_RENDER_BACKEND_INVALID:${String(renderBackend)}`);
        }
        if (!species || typeof species.render !== 'function') {
            throw new Error('ZEN_BONSAI_LOCAL_PREVIEW_SPECIES_REQUIRED');
        }
        if (!frameIdRef || !treeCacheRef || !lastCacheKeyRef) {
            throw new Error('ZEN_BONSAI_LOCAL_PREVIEW_RENDER_REFS_REQUIRED');
        }

        const canvas = canvasRef?.current || null;
        if (!canvas || Number(width) <= 0 || Number(height) <= 0) {
            emitRenderDebugEvent(onRenderDebugEvent, {
                status: 'waiting',
                reason: 'main_canvas_not_ready',
                width,
                height,
            });
            return undefined;
        }
        if (!treeTopology || typeof treeTopology !== 'object') {
            emitRenderDebugEvent(onRenderDebugEvent, {
                status: 'waiting',
                reason: 'main_topology_not_ready',
                width,
                height,
            });
            return undefined;
        }
        if (!renderPlan || typeof renderPlan !== 'object') {
            throw new Error('ZEN_BONSAI_LOCAL_PREVIEW_RENDER_PLAN_REQUIRED');
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('ZEN_BONSAI_LOCAL_PREVIEW_CONTEXT_UNAVAILABLE');
        }

        const canvasMetrics = syncZenBonsaiCanvasBackingStore(
            canvas,
            width,
            height,
            canvasPixelRatio,
        );
        const sceneSnapshot = createZenBonsaiMainSceneSnapshot({
            bonsaiMaterializationKey,
            inputSignature,
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
            canvasMetrics,
            cameraPreset,
            hidePot,
            potStyleOverride,
            homeGardenBedProjection,
            showBackboneDebug,
            showBranchTierDebug,
            renderMode,
            mainRenderQuality,
            renderLoopMode,
            renderBackend,
            mainRenderVersion,
            gardenBedMaterialStyle,
        });
        const currentCacheKey = sceneSnapshot.sceneSignature;
        const cacheInvalidated = currentCacheKey !== lastCacheKeyRef.current;
        const isAnimated = species.isAnimated !== false && renderLoopMode === 'continuous';
        let staticCacheContext = null;
        const releaseRainContexts = () => {
            releaseZenBonsaiRainCanvas(ctx);
            if (staticCacheContext) releaseZenBonsaiRainCanvas(staticCacheContext);
        };
        let firstFrameReported = false;
        let actualAlphaObserved = false;
        const alphaObservationRequest = observeActualAlpha === true
            && (
                alphaObservationArmedRef.current !== true
                || alphaObservationPendingRequestRef.current !== null
            )
            ? (() => {
                const safeWidth = renderPlan.surface.pixelWidth;
                const safeHeight = renderPlan.surface.pixelHeight;
                const surfaceKey = [safeWidth, safeHeight, canvasPixelRatio, 'canvas2d'].join('|');
                if (alphaObservationSurfaceRef.current.key !== surfaceKey) {
                    alphaObservationSurfaceRef.current = {
                        key: surfaceKey,
                        generation: alphaObservationSurfaceRef.current.generation + 1,
                    };
                }
                const sceneCommitKey = `local-preview:${bonsaiMaterializationKey}`;
                const pendingRequest = alphaObservationPendingRequestRef.current;
                if (
                    pendingRequest?.identity?.sceneSignature === currentCacheKey
                    && pendingRequest.identity.sceneCommitKey === sceneCommitKey
                    && pendingRequest.identity.renderPlanSignature === renderPlan.signature
                    && pendingRequest.identity.bonsaiMaterializationKey === bonsaiMaterializationKey
                    && pendingRequest.identity.inputSignature === inputSignature
                    && pendingRequest.identity.surface.generation
                        === alphaObservationSurfaceRef.current.generation
                    && pendingRequest.identity.surface.width === safeWidth
                    && pendingRequest.identity.surface.height === safeHeight
                    && pendingRequest.identity.surface.pixelRatio === canvasPixelRatio
                    && pendingRequest.identity.surface.renderBackend === 'canvas2d'
                ) {
                    return pendingRequest;
                }
                const requestSequence = alphaObservationRequestSequenceRef.current + 1;
                alphaObservationRequestSequenceRef.current = requestSequence;
                const guard = Math.max(32, Math.min(128, Math.round(
                    Math.max(safeWidth, safeHeight) * 0.12,
                )));
                return createSakuraActualAlphaObservationRequestV1({
                    requestId: `local:${alphaObservationSurfaceRef.current.generation}:${requestSequence}`,
                    identity: {
                        sceneSignature: currentCacheKey,
                        sceneCommitKey,
                        renderPlanSignature: renderPlan.signature,
                        bonsaiMaterializationKey,
                        inputSignature,
                        surface: {
                            generation: alphaObservationSurfaceRef.current.generation,
                            width: safeWidth,
                            height: safeHeight,
                            pixelRatio: canvasPixelRatio,
                            renderBackend: 'canvas2d',
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
        if (alphaObservationRequest) {
            alphaObservationArmedRef.current = true;
            alphaObservationPendingRequestRef.current = alphaObservationRequest;
        }

        const observeFrameAlpha = (frameCount, wind) => {
            if (!alphaObservationRequest || actualAlphaObserved) return;
            actualAlphaObserved = true;
            const observation = observeSakuraCanvasActualAlphaV1({
                request: alphaObservationRequest,
                createCanvas: (pixelWidth, pixelHeight) => {
                    const scratch = document.createElement('canvas');
                    scratch.width = pixelWidth;
                    scratch.height = pixelHeight;
                    return scratch;
                },
                species,
                scene: {
                    topology: treeTopology,
                    currentStage,
                    camera: mainCamera,
                    renderOptions: sceneSnapshot.renderOptions,
                    renderPlan,
                },
                assetCache,
                frameSequence: 0,
                frameCount,
                windState: wind,
            });
            alphaObservationPendingRequestRef.current = null;
            if (typeof onActualAlphaObservation === 'function') {
                onActualAlphaObservation(observation);
            }
        };

        const reportFirstFrame = (frameCount, wind) => {
            if (firstFrameReported) return;
            firstFrameReported = true;
            emitRenderDebugEvent(onRenderDebugEvent, {
                status: 'rendered',
                reason: 'rendered',
                width,
                height,
                pixelWidth: canvasMetrics.pixelWidth,
                pixelHeight: canvasMetrics.pixelHeight,
                treeSeed,
                isAnimated,
                cacheInvalidated,
                frameCount,
                wind: wind.scalar,
            });
        };

        const ensureStaticCache = () => {
            if (!treeCacheRef.current) {
                treeCacheRef.current = document.createElement('canvas');
            }
            const cacheCanvas = treeCacheRef.current;
            if (
                cacheCanvas.width !== canvasMetrics.pixelWidth
                || cacheCanvas.height !== canvasMetrics.pixelHeight
            ) {
                cacheCanvas.width = canvasMetrics.pixelWidth;
                cacheCanvas.height = canvasMetrics.pixelHeight;
            }
            return cacheCanvas;
        };

        const renderFrame = (frameCount = 0) => {
            const wind = resolveZenBonsaiWindState({
                environmentState: renderEnvironmentState,
                frameCount,
            });
            if (!isAnimated && !cacheInvalidated && treeCacheRef.current) {
                ctx.clearRect(0, 0, canvasMetrics.pixelWidth, canvasMetrics.pixelHeight);
                ctx.drawImage(treeCacheRef.current, 0, 0);
                observeFrameAlpha(frameCount, wind);
                reportFirstFrame(frameCount, wind);
                return;
            }

            if (!isAnimated) {
                const cacheCanvas = ensureStaticCache();
                const cacheContext = cacheCanvas.getContext('2d');
                if (!cacheContext) {
                    throw new Error('ZEN_BONSAI_LOCAL_PREVIEW_CACHE_CONTEXT_UNAVAILABLE');
                }
                staticCacheContext = cacheContext;
                cacheContext.clearRect(0, 0, canvasMetrics.pixelWidth, canvasMetrics.pixelHeight);
                species.render({
                    ctx: cacheContext,
                    topology: treeTopology,
                    frameCount: 0,
                    pixelRatio: canvasMetrics.pixelRatio,
                    currentStage,
                    assetCache,
                    wind,
                    camera: mainCamera,
                    options: {
                        ...sceneSnapshot.renderOptions,
                        renderPlan,
                    },
                });
                ctx.clearRect(0, 0, canvasMetrics.pixelWidth, canvasMetrics.pixelHeight);
                ctx.drawImage(cacheCanvas, 0, 0);
                lastCacheKeyRef.current = currentCacheKey;
                observeFrameAlpha(frameCount, wind);
                reportFirstFrame(frameCount, wind);
                return;
            }

            ctx.clearRect(0, 0, canvasMetrics.pixelWidth, canvasMetrics.pixelHeight);
            species.render({
                ctx,
                topology: treeTopology,
                frameCount,
                pixelRatio: canvasMetrics.pixelRatio,
                currentStage,
                assetCache,
                wind,
                camera: mainCamera,
                options: {
                    ...sceneSnapshot.renderOptions,
                    renderPlan,
                },
            });
            lastCacheKeyRef.current = currentCacheKey;
            observeFrameAlpha(frameCount, wind);
            reportFirstFrame(frameCount, wind);
        };

        if (!isAnimated) {
            renderFrame(0);
            return releaseRainContexts;
        }

        let frameCount = 0;
        let renderFailed = false;
        let stopLoop = () => {};
        stopLoop = runRenderLoop({
            enabled: true,
            simHz: 60,
            targetFps: mainTargetFps,
            maxCatchUpSteps: 30,
            frameScheduler: 'auto',
            isPaused: () => typeof document !== 'undefined' && document.hidden,
            onSimStep: () => {
                frameCount += 1;
            },
            onRender: () => {
                if (renderFailed) return;
                try {
                    renderFrame(frameCount);
                } catch (error) {
                    renderFailed = true;
                    emitRenderDebugEvent(onRenderDebugEvent, {
                        status: 'error',
                        reason: error instanceof Error
                            ? error.message
                            : 'ZEN_BONSAI_LOCAL_PREVIEW_RENDER_FAILED',
                    });
                    stopLoop();
                    throw error;
                }
            },
        });
        if (renderFailed) {
            stopLoop();
        }
        frameIdRef.current = stopLoop;

        return () => {
            stopLoop();
            releaseRainContexts();
            if (frameIdRef.current === stopLoop) {
                frameIdRef.current = null;
            }
        };
    }, [
        activationPresentation,
        assetCache,
        bonsaiLifeState,
        bonsaiMaterializationKey,
        cameraPreset,
        canvasPixelRatio,
        canvasRef,
        currentPhenotype,
        currentStage,
        enabled,
        environmentSignature,
        frameIdRef,
        gardenBedMaterialStyle,
        height,
        hidePot,
        homeGardenBedProjection,
        inputSignature,
        lastCacheKeyRef,
        mainCamera,
        mainRenderQuality,
        mainRenderVersion,
        mainTargetFps,
        onRenderDebugEvent,
        observeActualAlpha,
        onActualAlphaObservation,
        potStyleOverride,
        renderBackend,
        renderEnvironmentState,
        renderLoopMode,
        renderMode,
        showBackboneDebug,
        showBranchTierDebug,
        species,
        treeCacheRef,
        treeSeed,
        treeTopology,
        renderPlan,
        treeType,
        width,
    ]);
}
