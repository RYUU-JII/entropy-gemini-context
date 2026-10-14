import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { compileZenBonsaiPlumeBloomRegions } from '../model/bonsai/plume/ZenBonsaiPlumeBloomRegions.js';
import { useZenBonsaiRenderPlan } from './useZenBonsaiRenderPlan.js';
import { resolveRenderResolution, resolveRasterResolution } from '@/platform/rendering/renderBudgetContract.js';
import { useZenBonsaiEnvironmentState } from './environment/useZenBonsaiEnvironmentState.js';
import {
    resolveZenSceneEnvironmentPolicy,
} from './environment/zenWorldWeatherAuthority.js';
import {
    ZEN_WORLD_ENVIRONMENT_CLOCK_MODES,
} from './environment/zenWorldEnvironmentAuthority.js';
import {
    resolveAnchoredBonsaiCamera,
    resolveBonsaiCamera,
} from '../model/bonsai/rendering/resolveBonsaiCamera.js';
import {
    measureSakuraFullRenderBounds,
    resolveSakuraFullRenderBoundsDiagnostics,
} from '../model/bonsai/rendering/measureSakuraFullRenderBounds.js';
import {
    isZenBonsaiIntrinsicCanvasRenderPlan,
    measureZenBonsaiRenderPlanBoundsV1,
    supportsZenBonsaiActualAlphaObservation,
    ZEN_BONSAI_G15_CAMERA_FIT_MODES,
    ZEN_BONSAI_G15_HORIZONTAL_COMPOSITION_MODES,
} from '../model/bonsai/rendering/zenBonsaiRenderPlan.js';
import {
    requireSakuraActualAlphaObservationV1,
} from '../model/bonsai/rendering/SakuraActualAlphaObservationContract.js';
import {
    resolveZenHomeGardenBedDeviceMesh,
    resolveZenHomeGardenBedGroundPlane,
    resolveZenHomeGardenBedCanopyViewport,
} from '../model/bonsai/rendering/zenHomeGardenBedGeometry.js';
import {
    ZEN_BONSAI_MAIN_RENDER_OWNERS,
    requireZenBonsaiMainRenderOwner,
} from './zenBonsaiMainRendererOwnership.js';
import { useDevicePixelRatio } from '@/ui-kit/hooks/useDevicePixelRatio.js';
import {
    resolveZenBonsaiEnvironmentSignature,
    resolveZenBonsaiTopologySignature,
} from './zenBonsaiSceneSnapshot.js';
import {
    resolveZenHomeGardenBedCanvasProjection,
    resolveZenOrdinaryBonsaiCanvasSurface,
} from './zenHomeGardenBedCanvasProjection.js';

export function useZenTreeRenderer({
    mainRendererOwner,
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
    bonsaiLifeState = null,
    activationPresentation = null,
    species,
    assetCache,
    mainTargetFps,
    isCollectionMode,
    abPair,
    abCanvasRefA,
    abCanvasRefB,
    abWidthA,
    abHeightA,
    abWidthB,
    abHeightB,
    minABRenderSize,
    mainRenderVersion = 0,
    abRenderVersion = 0,
    onRenderDebugEvent = null,
    hidePot = false,
    showBackboneDebug = false,
    showBranchTierDebug = false,
    solarLocationProfile = null,
    presentationEnvironmentMode = null,
    presentationWeatherAuthority = null,
    potStyleOverride = null,
    homeGardenBedLayoutFrame = null,
    gardenBedMaterialStyle = null,
    presentationStyle = null,
    renderMode = 'full',
    mainRenderQuality = 'full',
    mainCadenceContext = 'workspace',
    cameraPreset = 'workspace',
    pixelRatioCap = 2,
    renderBudget = null,
    renderLoopMode = 'continuous',
    renderBackend = 'canvas2d',
    enableMainRender = true,
    mainSurfaceReady = true,
    mainRenderActive = true,
    suppressMainRenderSceneSync = false,
    presentationSceneCommitKey = null,
    bloomPresentation = null,
    onBloomPresentationComplete = null,
    onBloomRegionTargets = null,
    enableAbPreviewRender = isCollectionMode,
    onFirstFrameReady = null,
    onFirstVisualMilestone = null,
    bootTraceContext = null,
    observeActualAlpha = false,
    onActualAlphaObservation = null,
}, {
    useMainWorkerRenderer,
    useLocalPreviewRenderer,
    useAbRenderer,
} = {}) {
    if (
        typeof useMainWorkerRenderer !== 'function'
        || typeof useLocalPreviewRenderer !== 'function'
        || typeof useAbRenderer !== 'function'
    ) {
        throw new Error('ZEN_BONSAI_RENDERER_HOOK_SET_REQUIRED');
    }
    const resolvedMainRendererOwner = requireZenBonsaiMainRenderOwner(mainRendererOwner);
    const mainRenderEnabled = (
        enableMainRender === true
        && mainSurfaceReady === true
        && isCollectionMode !== true
    );
    const mainRenderSurfaceReady = (
        mainRenderEnabled
        && Number(width) > 0
        && Number(height) > 0
    );
    const environmentPolicy = useMemo(
        () => resolveZenSceneEnvironmentPolicy({
            environmentMode: presentationEnvironmentMode,
        }),
        [presentationEnvironmentMode],
    );
    const {
        envAuthority,
        envRuntimeConfigSignature,
        environmentBundle,
        envState,
    } = useZenBonsaiEnvironmentState({
        solarLocationProfile,
        realtimeClockOwner: 'worker',
        presentationHour: environmentPolicy.presentationHour,
        weatherAuthorityMode: environmentPolicy.weatherAuthorityMode,
        weatherAuthority: presentationWeatherAuthority,
    });
    const renderEnvironmentState = envState;
    const devicePixelRatio = useDevicePixelRatio();
    // The Home canvas includes the garden-bed overscan around the scene. Charge
    // the allocation budget against that full surface, not just its inner scene.
    const rasterWidth = homeGardenBedLayoutFrame === null
        ? Math.max(1, Number(width) || 1) : homeGardenBedLayoutFrame.surfaceSize.width;
    const rasterHeight = homeGardenBedLayoutFrame === null
        ? Math.max(1, Number(height) || 1) : homeGardenBedLayoutFrame.surfaceSize.height;
    const canvasPixelRatio = renderBudget
        ? resolveRenderResolution({
            cssWidth: rasterWidth,
            cssHeight: rasterHeight,
            devicePixelRatio,
            renderBudget,
        }).effectivePixelRatio
        : resolveRasterResolution({ cssWidth: rasterWidth,
            cssHeight: rasterHeight, devicePixelRatio,
            pixelRatioCap, maxRenderPixels: 8_294_400 }).effectivePixelRatio;
    const mainCanvasSurface = useMemo(() => (
        homeGardenBedLayoutFrame === null
            ? resolveZenOrdinaryBonsaiCanvasSurface({
                sceneWidth: width,
                sceneHeight: height,
                pixelRatio: canvasPixelRatio,
            })
            : resolveZenHomeGardenBedCanvasProjection({
                pixelRatio: canvasPixelRatio,
                layoutFrame: homeGardenBedLayoutFrame,
            })
    ), [
        canvasPixelRatio,
        height,
        homeGardenBedLayoutFrame,
        width,
    ]);
    const environmentSignature = useMemo(
        () => resolveZenBonsaiEnvironmentSignature(renderEnvironmentState),
        [renderEnvironmentState],
    );
    const homeGardenBedGeometry = useMemo(() => (
        mainCanvasSurface.projection
            ? resolveZenHomeGardenBedDeviceMesh({
                projection: mainCanvasSurface.projection,
            })
            : null
    ), [mainCanvasSurface.projection]);
    const plumeHomeCanopy = homeGardenBedGeometry !== null && treeTopology?.isPlume === true;
    const treeViewport = plumeHomeCanopy
        ? resolveZenHomeGardenBedCanopyViewport(homeGardenBedGeometry)
        : homeGardenBedGeometry?.sceneViewport;
    const mainPixelWidth = treeViewport ? treeViewport.width : mainCanvasSurface.scenePixelWidth;
    const mainPixelHeight = treeViewport ? treeViewport.height : mainCanvasSurface.scenePixelHeight;
    const sourceTopologySignature = useMemo(() => (
        treeTopology?.isG15 === true || treeTopology?.isPlume === true ? null : resolveZenBonsaiTopologySignature(treeTopology)
    ), [treeTopology]);
    const mainRenderPlan = useZenBonsaiRenderPlan({
        enabled: mainRenderSurfaceReady,

        topology: treeTopology,
        species,
        pixelRatio: canvasPixelRatio,
        sourceTopologySignature,
        surface: {
            pixelWidth: mainPixelWidth,
            pixelHeight: mainPixelHeight,
            treeViewport: {
                x: 0,
                y: 0,
                width: mainPixelWidth,
                height: mainPixelHeight,
            },
            clipTreePaint: homeGardenBedGeometry !== null,
        },
        includePot: homeGardenBedGeometry ? false : !hidePot,
        // Home plants into the garden bed, so the bed's soil surface — not
        // a pot that is never drawn — is the ground the nebari lays on.
        groundPlane: homeGardenBedGeometry
            ? resolveZenHomeGardenBedGroundPlane({
                geometry: homeGardenBedGeometry,
                viewport: treeViewport,
            })
            : null,
        includeGroundShadow: homeGardenBedGeometry ? false : !hidePot,
        includeBackground: false,
        cameraAnchor: homeGardenBedGeometry
            ? {
                fitMode: ZEN_BONSAI_G15_CAMERA_FIT_MODES.ROOTED_ABOVE_GROUND,
                ...(plumeHomeCanopy && homeGardenBedGeometry.support === 'frame-seam' ? {
                    framingViewport: {
                        x: homeGardenBedGeometry.sceneViewport.x - treeViewport.x,
                        y: 0,
                        width: homeGardenBedGeometry.sceneViewport.width,
                        height: homeGardenBedGeometry.sceneViewport.height,
                    },
                } : {}),
                ...(plumeHomeCanopy && homeGardenBedGeometry.support === 'frame-seam' ? {
                    plantingSeam: {
                        left: {
                            x: homeGardenBedGeometry.frameSeam.left.x - treeViewport.x,
                            y: homeGardenBedGeometry.frameSeam.left.y - treeViewport.y,
                        },
                        right: {
                            x: homeGardenBedGeometry.frameSeam.right.x - treeViewport.x,
                            y: homeGardenBedGeometry.frameSeam.right.y - treeViewport.y,
                        },
                        buriedDepth: homeGardenBedGeometry.frameSeam.buriedDepth,
                        preferredRootX: homeGardenBedGeometry.plantingAnchor.x - treeViewport.x,
                    },
                } : { horizontalComposition: {
                mode: ZEN_BONSAI_G15_HORIZONTAL_COMPOSITION_MODES
                    .STRUCTURAL_MASS,
                targetViewportX: homeGardenBedGeometry.sceneViewport.x - treeViewport.x
                    + homeGardenBedGeometry.sceneViewport.width * 0.5,
                maximumRootShiftPx: Math.min(
                    homeGardenBedGeometry.soilRearRightX
                        - homeGardenBedGeometry.soilRearLeftX,
                    homeGardenBedGeometry.soilFrontRightX
                        - homeGardenBedGeometry.soilFrontLeftX,
                ) * 0.1,
                } }),
                world: { x: 0, y: 0, z: 0 },
                viewport: {
                x: homeGardenBedGeometry.plantingAnchor.x
                    - treeViewport.x,
                y: homeGardenBedGeometry.plantingAnchor.y
                    - treeViewport.y,
                },
            }
            : null,
        potStyleOverride,
        growthProjection: currentStage?.growthProjection || null,
        activationPresentation,
        lifeState: bonsaiLifeState,
    });
    const needsBloomRegions = bloomPresentation !== null;
    const bloomRegionTargets = useMemo(() => {
        if (!needsBloomRegions || typeof onBloomRegionTargets !== 'function'
            || !mainRenderSurfaceReady || suppressMainRenderSceneSync || !mainRenderPlan) return null;
        if (treeTopology?.isPlume !== true) throw new Error('ZEN_BONSAI_FIRST_BLOOM_PLUME_REQUIRED');
        const compiled = compileZenBonsaiPlumeBloomRegions(mainRenderPlan.scene.displayPlan);
        if (!compiled.eligible) throw new Error('ZEN_BONSAI_FIRST_BLOOM_FLOWER_SUPPLY_INSUFFICIENT');
        const scaleX = mainCanvasSurface.cssWidth / mainCanvasSurface.pixelWidth;
        const scaleY = mainCanvasSurface.cssHeight / mainCanvasSurface.pixelHeight;
        return Object.freeze({
            sceneCommitKey: presentationSceneCommitKey, inputSignature, bonsaiMaterializationKey,
            renderPlanSignature: mainRenderPlan.signature, canvasRef,
            canvasCssWidth: mainCanvasSurface.cssWidth, canvasCssHeight: mainCanvasSurface.cssHeight,
            regions: Object.freeze(compiled.regions.map(region => Object.freeze({
                regionId: region.regionId,
                x: (region.x + (treeViewport?.x ?? 0)) * scaleX,
                y: (region.y + (treeViewport?.y ?? 0)) * scaleY,
            }))),
        });
    }, [bonsaiMaterializationKey, canvasRef, inputSignature, mainCanvasSurface, mainRenderPlan,
        mainRenderSurfaceReady, needsBloomRegions, onBloomRegionTargets, presentationSceneCommitKey,
        suppressMainRenderSceneSync, treeTopology?.isPlume, treeViewport?.x, treeViewport?.y]);
    useLayoutEffect(() => {
        if (typeof onBloomRegionTargets !== 'function') return undefined;
        onBloomRegionTargets(bloomRegionTargets);
        return () => onBloomRegionTargets(null);
    }, [bloomRegionTargets, onBloomRegionTargets]);
    const mainSceneBounds = useMemo(() => {
        if (!mainRenderPlan) {
            return null;
        }
        if (isZenBonsaiIntrinsicCanvasRenderPlan(mainRenderPlan)) {
            return measureZenBonsaiRenderPlanBoundsV1(mainRenderPlan, {
                topology: treeTopology,
            });
        }
        return measureSakuraFullRenderBounds(mainRenderPlan);
    }, [
        mainRenderPlan,
        treeTopology,
    ]);
    const supportsActualAlphaObservation = mainRenderPlan
        ? supportsZenBonsaiActualAlphaObservation(mainRenderPlan)
        : true;
    if (observeActualAlpha === true && supportsActualAlphaObservation !== true) {
        throw new Error('ZEN_BONSAI_G15_ACTUAL_ALPHA_OBSERVATION_UNSUPPORTED');
    }
    const [actualAlphaObservation, setActualAlphaObservation] = useState(null);
    const handleActualAlphaObservation = useCallback((value) => {
        const observation = requireSakuraActualAlphaObservationV1(value);
        if (
            observation.identity.renderPlanSignature !== mainRenderPlan?.signature
            || observation.identity.bonsaiMaterializationKey !== bonsaiMaterializationKey
            || observation.identity.inputSignature !== inputSignature
            || observation.identity.surface.width !== mainPixelWidth
            || observation.identity.surface.height !== mainPixelHeight
            || observation.identity.surface.pixelRatio !== canvasPixelRatio
            || observation.identity.surface.renderBackend !== renderBackend
        ) {
            throw new Error('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_ACTIVE_SCENE_MISMATCH');
        }
        setActualAlphaObservation(observation);
        if (typeof onActualAlphaObservation === 'function') {
            onActualAlphaObservation(observation);
        }
    }, [
        bonsaiMaterializationKey,
        canvasPixelRatio,
        inputSignature,
        mainPixelHeight,
        mainPixelWidth,
        mainRenderPlan?.signature,
        onActualAlphaObservation,
        renderBackend,
    ]);
    const activeActualAlphaObservation = (
        actualAlphaObservation?.identity?.renderPlanSignature === mainRenderPlan?.signature
        && actualAlphaObservation?.identity?.bonsaiMaterializationKey === bonsaiMaterializationKey
        && actualAlphaObservation?.identity?.inputSignature === inputSignature
        && actualAlphaObservation?.identity?.surface?.width === mainPixelWidth
        && actualAlphaObservation?.identity?.surface?.height === mainPixelHeight
        && actualAlphaObservation?.identity?.surface?.pixelRatio === canvasPixelRatio
        && actualAlphaObservation?.identity?.surface?.renderBackend === renderBackend
    )
        ? actualAlphaObservation
        : null;
    const mainCameraRuntime = useMemo(() => {
        if (!mainRenderSurfaceReady || !mainSceneBounds) {
            return Object.freeze({
                camera: null,
                fitSource: 'unavailable',
            });
        }
        if (isZenBonsaiIntrinsicCanvasRenderPlan(mainRenderPlan)) {
            return Object.freeze({
                camera: null,
                fitSource: 'intrinsic-canvas',
            });
        }
        const resolveCameraForBounds = (sceneBounds) => {
            if (!homeGardenBedGeometry) {
                return resolveBonsaiCamera({
                    viewportWidth: mainPixelWidth,
                    viewportHeight: mainPixelHeight,
                    sceneBounds,
                    preset: cameraPreset,
                });
            }
            if (
                !Number.isFinite(Number(sceneBounds?.trunkOffsetX))
                || !Number.isFinite(Number(sceneBounds?.trunkBaseY))
            ) {
                throw new Error('ZEN_HOME_GARDEN_BED_TREE_ANCHOR_REQUIRED');
            }
            return resolveAnchoredBonsaiCamera({
                viewportWidth: mainPixelWidth,
                viewportHeight: mainPixelHeight,
                sceneBounds,
                preset: cameraPreset,
                worldAnchor: {
                    x: Number(sceneBounds.trunkOffsetX),
                    y: Number(sceneBounds.trunkBaseY),
                },
                viewportAnchor: {
                    x: homeGardenBedGeometry.plantingAnchor.x
                        - homeGardenBedGeometry.sceneViewport.x,
                    y: homeGardenBedGeometry.plantingAnchor.y
                        - homeGardenBedGeometry.sceneViewport.y,
                },
            });
        };
        const currentPaintCamera = resolveCameraForBounds(mainSceneBounds);
        const reserveProbe = resolveSakuraFullRenderBoundsDiagnostics({
            sceneBounds: mainSceneBounds,
            camera: currentPaintCamera,
            viewportWidth: mainPixelWidth,
            viewportHeight: mainPixelHeight,
            clipEnforced: homeGardenBedGeometry !== null,
        });
        const reserveOverflowsViewport = Object.values(
            reserveProbe?.predictedMaximumMotionReserveOverflowPx || {},
        ).some((value) => Number(value) > 0);
        if (!reserveOverflowsViewport || !mainSceneBounds?.maximumMotionReserveBounds) {
            return Object.freeze({
                camera: currentPaintCamera,
                fitSource: 'current-paint',
            });
        }
        const reserveBounds = {
            ...mainSceneBounds.maximumMotionReserveBounds,
            trunkOffsetX: mainSceneBounds.trunkOffsetX,
            trunkBaseY: mainSceneBounds.trunkBaseY,
            potDims: mainSceneBounds.potDims,
            contract: mainSceneBounds.contract,
            source: 'maximum-motion-reserve',
        };
        return Object.freeze({
            camera: resolveCameraForBounds(reserveBounds),
            fitSource: 'maximum-motion-reserve',
        });
    }, [
        cameraPreset,
        homeGardenBedGeometry,
        mainPixelHeight,
        mainPixelWidth,
        mainRenderPlan,
        mainRenderSurfaceReady,
        mainSceneBounds,
    ]);
    const mainCamera = mainCameraRuntime.camera;
    const mainRenderBoundsDiagnostics = useMemo(() => {
        if (isZenBonsaiIntrinsicCanvasRenderPlan(mainRenderPlan)) {
            return mainSceneBounds
                ? Object.freeze({
                    evidenceKind: 'g15-scene-command-viewport',
                    cameraFitSource: 'intrinsic-canvas',
                    predictedBounds: mainSceneBounds,
                    observedAlphaBounds: null,
                    observedAlphaBoundsStatus: 'not-supported',
                })
                : null;
        }
        const diagnostics = resolveSakuraFullRenderBoundsDiagnostics({
            sceneBounds: mainSceneBounds,
            camera: mainCamera,
            viewportWidth: mainPixelWidth,
            viewportHeight: mainPixelHeight,
            clipEnforced: homeGardenBedGeometry !== null,
            paintObservation: activeActualAlphaObservation,
        });
        return diagnostics
            ? Object.freeze({
                ...diagnostics,
                cameraFitSource: mainCameraRuntime.fitSource,
            })
            : null;
    }, [
        homeGardenBedGeometry,
        mainCamera,
        mainCameraRuntime.fitSource,
        mainPixelHeight,
        mainPixelWidth,
        mainRenderPlan,
        mainSceneBounds,
        activeActualAlphaObservation,
    ]);

    const mainWorkerRuntime = useMainWorkerRenderer({
        enabled: (
            mainRenderEnabled
            && resolvedMainRendererOwner === ZEN_BONSAI_MAIN_RENDER_OWNERS.HOME_WORKER
        ),
        active: mainRenderActive === true,
        suppressSceneSync: suppressMainRenderSceneSync === true,
        bonsaiMaterializationKey,
        inputSignature,
        presentationSceneCommitKey,
        bloomPresentation,
        onBloomPresentationComplete,
        canvasRef,
        width: mainRenderSurfaceReady ? mainCanvasSurface.cssWidth : width,
        height: mainRenderSurfaceReady ? mainCanvasSurface.cssHeight : height,
        frameIdRef,
        treeCacheRef,
        lastCacheKeyRef,
        treeType,
        treeSeed,
        currentPhenotype,
        currentStage,
        treeTopology,
        renderPlan: mainRenderPlan,
        bonsaiLifeState,
        activationPresentation,
        species,
        mainTargetFps,
        isCollectionMode,
        mainRenderVersion,
        onRenderDebugEvent,
        hidePot,
        showBackboneDebug,
        showBranchTierDebug,
        renderMode,
        mainRenderQuality,
        mainCadenceContext,
        renderLoopMode,
        renderBackend,
        envAuthority,
        renderEnvironmentState,
        environmentRuntimeConfigSignature: envRuntimeConfigSignature,
        environmentSignature,
        mainCamera,
        cameraPreset,
        canvasPixelRatio,
        potStyleOverride,
        homeGardenBedProjection: mainRenderSurfaceReady
            ? mainCanvasSurface.projection
            : null,
        gardenBedMaterialStyle,
        presentationStyle,
        onFirstFrameReady,
        onFirstVisualMilestone,
        bootTraceContext,
        observeActualAlpha: observeActualAlpha && supportsActualAlphaObservation,
        onActualAlphaObservation: handleActualAlphaObservation,
    }) || {};

    useLocalPreviewRenderer({
        enabled: (
            mainRenderEnabled
            && mainRenderActive === true
            && resolvedMainRendererOwner === ZEN_BONSAI_MAIN_RENDER_OWNERS.LAB_PREVIEW
        ),
        bonsaiMaterializationKey,
        inputSignature,
        canvasRef,
        width: mainRenderSurfaceReady ? mainCanvasSurface.cssWidth : width,
        height: mainRenderSurfaceReady ? mainCanvasSurface.cssHeight : height,
        frameIdRef,
        treeCacheRef,
        lastCacheKeyRef,
        treeType,
        treeSeed,
        currentPhenotype,
        currentStage,
        treeTopology,
        renderPlan: mainRenderPlan,
        bonsaiLifeState,
        activationPresentation,
        species,
        assetCache,
        mainTargetFps,
        mainRenderVersion,
        onRenderDebugEvent,
        hidePot,
        showBackboneDebug,
        showBranchTierDebug,
        renderMode,
        mainRenderQuality,
        renderLoopMode,
        renderBackend,
        renderEnvironmentState,
        environmentSignature,
        mainCamera,
        cameraPreset,
        canvasPixelRatio,
        potStyleOverride,
        homeGardenBedProjection: mainRenderSurfaceReady
            ? mainCanvasSurface.projection
            : null,
        gardenBedMaterialStyle,
        presentationStyle,
        observeActualAlpha: observeActualAlpha && supportsActualAlphaObservation,
        onActualAlphaObservation: handleActualAlphaObservation,
    });

    useAbRenderer({
        enabled: enableAbPreviewRender,
        isCollectionMode,
        abPair,
        abCanvasRefA,
        abCanvasRefB,
        abWidthA,
        abHeightA,
        abWidthB,
        abHeightB,
        species,
        minABRenderSize,
        abRenderVersion,
        onRenderDebugEvent,
        hidePot,
        showBranchTierDebug,
        canvasPixelRatio,
    });

    const reactBonsaiTimeDiagnostics = useMemo(() => {
        const timeContext = environmentBundle?.envAuthority?.timeContext || envAuthority?.timeContext || null;
        const solarCoordinates = environmentBundle?.envAuthority?.solarCoordinates || envAuthority?.solarCoordinates || null;
        const solarState = environmentBundle?.solarState || null;
        const daylight = Number(envState?.daylight);
        const night = Number(envState?.night);
        const phase = typeof solarState?.phase === 'string' && solarState.phase
            ? solarState.phase
            : (Number.isFinite(night) && night >= 0.62
                ? 'night'
                : (Number.isFinite(daylight) && daylight >= 0.62 ? 'day' : 'twilight'));

        return {
            hour: Number(timeContext?.hour),
            timestampMs: Number(timeContext?.timestampMs),
            timeZone: typeof timeContext?.timeZone === 'string' && timeContext.timeZone
                ? timeContext.timeZone
                : (typeof environmentBundle?.envAuthority?.solarTimeZone === 'string'
                    ? environmentBundle.envAuthority.solarTimeZone
                    : (typeof envAuthority?.solarTimeZone === 'string' ? envAuthority.solarTimeZone : '')),
            solarSyncEnabled: (
                environmentBundle?.envAuthority?.clockMode
                === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME
            ),
            solarPhase: phase,
            daylight,
            night,
            solarElevation: Number(envState?.solarElevation),
            lightIntensity: Number(envState?.lightIntensity),
            solarDaylightStrength: Number(solarState?.daylightStrength),
            solarAltitudeDeg: Number(solarState?.position?.altitudeDeg),
            solarCoordinates: solarCoordinates && typeof solarCoordinates === 'object'
                ? {
                    latitude: Number(solarCoordinates.latitude),
                    longitude: Number(solarCoordinates.longitude),
                    label: typeof solarCoordinates.label === 'string' ? solarCoordinates.label : '',
                    source: typeof solarCoordinates.source === 'string' ? solarCoordinates.source : '',
                    presetId: typeof solarCoordinates.presetId === 'string' ? solarCoordinates.presetId : '',
                }
                : null,
            environmentRuntimeConfigSignature: envRuntimeConfigSignature,
            environmentSignature,
        };
    }, [
        envAuthority,
        envRuntimeConfigSignature,
        environmentBundle,
        environmentSignature,
        envState,
    ]);

    const bonsaiTimeDiagnostics = useMemo(() => {
        const workerDiagnostics = mainWorkerRuntime?.workerEnvironmentDiagnostics;
        if (!workerDiagnostics || typeof workerDiagnostics !== 'object') {
            return {
                ...reactBonsaiTimeDiagnostics,
                renderBounds: mainRenderBoundsDiagnostics,
            };
        }
        return {
            ...reactBonsaiTimeDiagnostics,
            ...workerDiagnostics,
            environmentRuntimeConfigSignature: envRuntimeConfigSignature,
            environmentSignature,
            renderBounds: mainRenderBoundsDiagnostics,
        };
    }, [
        envRuntimeConfigSignature,
        environmentSignature,
        mainRenderBoundsDiagnostics,
        mainWorkerRuntime?.workerEnvironmentDiagnostics,
        reactBonsaiTimeDiagnostics,
    ]);

    return {
        bonsaiTimeDiagnostics,
        supportsActualAlphaObservation: mainRenderPlan !== null && supportsActualAlphaObservation,
        mainCanvasSurface,
        mainRenderPlanSignature: mainRenderPlan?.signature || null,
        mainRenderBoundsDiagnostics,
        actualAlphaObservation: activeActualAlphaObservation,
    };
}
