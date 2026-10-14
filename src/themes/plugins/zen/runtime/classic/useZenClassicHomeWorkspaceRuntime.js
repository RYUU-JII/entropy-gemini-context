import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useResizeObserver } from '@/ui-kit/hooks/useResizeObserver';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '@/platform/build/releaseCapabilities.js';
import {
    MAIN_TARGET_FPS,
} from '../../model/ZenCoreConfigOptimizationTuning.js';
import {
    STAGES,
} from '../../model/ZenBonsaiStageContract.js';
import { useZenBonsaiSceneStore } from '../../pond/state/stores/useZenBonsaiSceneStore.js';
import {
    clearZenAppPetalSource,
    publishZenAppPetalSource,
} from '../../state/useZenAppPetalSourceStore.js';
import { useZenBonsaiActiveProfileState } from '../../bonsai/runtime/useZenBonsaiActiveProfileState.js';
import {
    useZenClassicHomeTopologyRuntime,
} from './useZenClassicHomeTopologyRuntime.js';
import { useZenBonsaiMaterializationRuntime } from '../../bonsai/runtime/useZenBonsaiMaterializationRuntime.js';
import {
    buildZenBonsaiMaterializationKey,
} from '../../bonsai/state/ZenBonsaiMaterializationContract.js';
import {
    isZenBonsaiEphemeralPresentationScene,
    isZenBonsaiFirstVisionPresentation,
    resolveZenBonsaiPresentationMode,
} from '../../model/ZenBonsaiPresentationPolicy.js';
import {
    resolveZenBonsaiPresentationIdentity,
} from '../../model/ZenBonsaiPresentationIdentity.js';
import { useZenBonsaiRenderSystem } from '../../bonsai/rendering/useZenBonsaiRenderSystem.js';
import {
    resolveZenBonsaiDebugForcedActivationPresentation,
} from '../../bonsai/debug/zenBonsaiDebugOverrides.js';
import {
    DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
    requireZenHomeGardenBedMaterialStyle,
} from '../../model/bonsai/rendering/zenHomeGardenBedGeometry.js';
import {
    DEFAULT_ZEN_BONSAI_PRESENTATION_STYLE,
    requireZenBonsaiPresentationStyle,
} from '../../model/bonsai/rendering/zenBonsaiPresentationStyle.js';
import { useZenHomeTreeRenderer } from '../useZenHomeTreeRenderer.js';
import { resolveZenHomeCanopyReadingEnvelope } from '../../api/homeCanopyReading.js';
import {
    ZEN_BONSAI_MAIN_RENDER_OWNERS,
} from '../zenBonsaiMainRendererOwnership.js';
import {
    resolveZenMainBonsaiWorkerRenderBudget,
} from '../zenMainWorkerRenderBudget.js';
import {
    resolveZenClassicBonsaiPixelRatioCap,
    resolveZenClassicBonsaiCadenceContext,
    resolveZenClassicBonsaiRenderBackend,
    resolveZenClassicBonsaiRenderLoopMode,
    resolveZenClassicBonsaiTargetFps,
    resolveZenClassicCameraPreset,
    resolveZenClassicHomePotStyle,
    resolveZenClassicHomeBonsaiGrowthModel,
    resolveZenClassicHomeBonsaiLineageMode,
    resolveZenClassicRenderSurfaceMeasurement,
    resolveZenClassicWorkspaceLayoutClassName,
} from './zenClassicWorkspaceRuntimeConfig';
import {
    emitZenMainBootTrace,
} from '../zenMainBootReadinessTrace.js';
import {
    ZEN_HOME_FIRST_VISUAL_MILESTONES,
    createZenHomeFirstVisualBonsaiMilestoneEvent,
} from '../zenHomeFirstVisualReadinessContract.js';

export function useZenClassicHomeWorkspaceRuntime({
    embedded = false,
    homeEmbedded = false,
    frameVariant = 'card',
    homeGardenBedLayoutFrame = null,
    solarLocationProfile = null,
    presentationEnvironmentMode = null,
    presentationWeatherAuthority = null,
    presentationIdentityOverride = null,
    bonsaiLifecycleInput = null,
    showBonsaiTimeDiagnostics = false,
    showBonsaiDebugPanel = false,
    bonsaiLifeDebugControls = null,
    raiseBonsaiTimeDiagnostics = false,
    isTabActive = true,
    presentationSceneCommitKey = null,
    bloomPresentation = null,
    onBloomPresentationComplete = null,
    onFirstVisualMilestone = null,
    onBonsaiFirstFrameReady = null,
    onBonsaiMaterializationPrepared = null,
    onHomeCanopyReadingEnvelope = null,
    onBloomRegionTargets = null,
    workerRenderBudget = null,
    bootTraceContext = null,
} = {}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const mainViewportRef = useRef(null);
    const frameId = useRef(null);
    const treeCacheRef = useRef(null);
    const lastCacheKey = useRef('');
    const [bonsaiDebugOverrides, setBonsaiDebugOverrides] = useState(() => ({
        forcedActivationPercent: null,
        gardenBedMaterialStyle: DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
        presentationStyle: DEFAULT_ZEN_BONSAI_PRESENTATION_STYLE,
    }));
    const [actualAlphaObservationRequested, setActualAlphaObservationRequested] = useState(false);
    const [actualAlphaObservation, setActualAlphaObservation] = useState(null);

    const {
        width,
        height,
        targetRef: containerTargetRef,
    } = useResizeObserver(containerRef);
    const {
        width: mainViewportWidth,
        height: mainViewportHeight,
        targetRef: mainViewportTargetRef,
    } = useResizeObserver(mainViewportRef);
    const gardenBedProjectionRequired = (
        homeEmbedded
        && frameVariant === 'slab-aperture'
    );
    const retainedHomeGardenBedLayoutFrameRef = useRef(null);
    if (!gardenBedProjectionRequired) {
        retainedHomeGardenBedLayoutFrameRef.current = null;
    } else if (homeGardenBedLayoutFrame !== null) {
        retainedHomeGardenBedLayoutFrameRef.current = homeGardenBedLayoutFrame;
    }
    const effectiveHomeGardenBedLayoutFrame = gardenBedProjectionRequired
        ? retainedHomeGardenBedLayoutFrameRef.current
        : null;
    const gardenBedLayoutReady = (
        !gardenBedProjectionRequired
        || effectiveHomeGardenBedLayoutFrame !== null
    );
    const renderSurfaceMeasurement = useMemo(() => resolveZenClassicRenderSurfaceMeasurement({
        viewportWidth: mainViewportWidth,
        viewportHeight: mainViewportHeight,
        containerWidth: width,
        containerHeight: height,
    }), [height, mainViewportHeight, mainViewportWidth, width]);
    const retainedRenderSurfaceMeasurementRef = useRef({
        renderWidth: 1,
        renderHeight: 1,
    });
    if (renderSurfaceMeasurement.isMeasured) {
        retainedRenderSurfaceMeasurementRef.current = {
            renderWidth: renderSurfaceMeasurement.renderWidth,
            renderHeight: renderSurfaceMeasurement.renderHeight,
        };
    }
    const retainedRenderSurfaceMeasurement = renderSurfaceMeasurement.isMeasured
        ? renderSurfaceMeasurement
        : retainedRenderSurfaceMeasurementRef.current;
    const renderWidth = retainedRenderSurfaceMeasurement.renderWidth;
    const renderHeight = retainedRenderSurfaceMeasurement.renderHeight;
    const measuredRenderWidth = renderSurfaceMeasurement.isMeasured
        ? renderSurfaceMeasurement.renderWidth
        : 0;
    const measuredRenderHeight = renderSurfaceMeasurement.isMeasured
        ? renderSurfaceMeasurement.renderHeight
        : 0;
    const publishPondSignal = useZenBonsaiSceneStore((state) => state.publishPondBioticSignal);
    const petalSourceOwnerRef = useRef(Symbol('zen-home-petal-source'));
    const petalSourceSignalRef = useRef(null);
    const firstBloomHeld = bloomPresentation !== null;
    const firstBloomHeldRef = useRef(firstBloomHeld);
    firstBloomHeldRef.current = firstBloomHeld;
    const publishPondBioticSignal = useCallback((signal) => {
        publishPondSignal(signal);
        petalSourceSignalRef.current = signal;
        if (homeEmbedded) publishZenAppPetalSource(petalSourceOwnerRef.current,
            firstBloomHeldRef.current ? { ...signal, petalCapacity: 0, bloomRatio: 0, previewPetalRate: 0 } : signal);
    }, [homeEmbedded, publishPondSignal]);
    useEffect(() => {
        const signal = petalSourceSignalRef.current;
        if (homeEmbedded && signal !== null) {
            publishZenAppPetalSource(petalSourceOwnerRef.current,
                firstBloomHeld ? { ...signal, petalCapacity: 0, bloomRatio: 0, previewPetalRate: 0 } : signal);
        }
    }, [firstBloomHeld, homeEmbedded]);
    useEffect(() => {
        if (!homeEmbedded) return undefined;
        const owner = petalSourceOwnerRef.current;
        return () => clearZenAppPetalSource(owner);
    }, [homeEmbedded]);
    const ephemeralBonsaiPresentationScene = isZenBonsaiEphemeralPresentationScene(
        bonsaiLifecycleInput,
    );
    const canonicalPresentationIdentity = resolveZenBonsaiPresentationIdentity(
        bonsaiLifecycleInput,
    );
    if (presentationIdentityOverride !== null && !ephemeralBonsaiPresentationScene) {
        throw new Error('ZEN_BONSAI_PRESENTATION_IDENTITY_OVERRIDE_REQUIRES_EPHEMERAL_SCENE');
    }
    const presentationIdentity = presentationIdentityOverride
        || canonicalPresentationIdentity;
    if (isZenBonsaiFirstVisionPresentation(bonsaiLifecycleInput) && presentationIdentity === null) {
        throw new Error('ZEN_BONSAI_HOME_EPHEMERAL_PRESENTATION_IDENTITY_REQUIRED');
    }
    const workspaceState = useZenBonsaiActiveProfileState({
        durableProfileRequired: presentationIdentity === null,
        presentationIdentity,
    });
    // Ephemeral lineage does not imply an ephemeral identity: progression debug uses the durable profile.
    const bonsaiIdentityReady = workspaceState.profileReady === true;
    const handleRerollBonsai = useCallback(() => {
        const candidate = Math.floor(Math.random() * 100000);
        const nextSeed = candidate === workspaceState.treeSeed ? (candidate + 1) % 100000 : candidate;
        return workspaceState.commitActiveIdentityPatch({
            treeSeed: nextSeed,
        });
    }, [workspaceState.commitActiveIdentityPatch, workspaceState.treeSeed]);
    // Reroll rides the debug surface's own admission.
    //
    // The action policy stays the single owner of whether reroll exists; this
    // just supplies the development grant it already understands, gated on the
    // same flag that admits the debug panel. It also waits for the durable
    // profile, because rerolling is an identity CAS and there is no identity to
    // rotate until the profile has hydrated.
    const bonsaiActionPolicyInput = useMemo(() => ({
        developmentReroll: BUILD_INCLUDE_DEBUG_TOOLS && showBonsaiDebugPanel === true
            && presentationIdentity === null && bonsaiIdentityReady === true,
    }), [bonsaiIdentityReady, presentationIdentity, showBonsaiDebugPanel]);
    const handleActivationForce = useCallback((value) => {
        setBonsaiDebugOverrides((current) => ({
            ...current,
            forcedActivationPercent: Number(value),
        }));
    }, []);
    const handleActivationForceReset = useCallback(() => {
        setBonsaiDebugOverrides((current) => ({
            ...current,
            forcedActivationPercent: null,
        }));
    }, []);
    // Home controls all preview intent before event admission. Standalone
    // surfaces explicitly keep their own local presentation controls.
    const activationForceControl = bonsaiLifeDebugControls?.activation;
    if (activationForceControl !== undefined && (!activationForceControl
        || typeof activationForceControl.onForce !== 'function'
        || typeof activationForceControl.onReset !== 'function')) {
        throw new Error('ZEN_BONSAI_DEBUG_CONTROLLED_ACTIVATION_INVALID');
    }
    const forcedActivationPercent = activationForceControl === undefined
        ? bonsaiDebugOverrides.forcedActivationPercent : activationForceControl.forcedPercent;
    const handlePresentationStyleChange = useCallback((styleId) => {
        const presentationStyle = requireZenBonsaiPresentationStyle(styleId);
        setBonsaiDebugOverrides((current) => ({
            ...current,
            presentationStyle,
        }));
    }, []);
    const handleGardenBedMaterialStyleChange = useCallback((styleId) => {
        const gardenBedMaterialStyle = requireZenHomeGardenBedMaterialStyle(styleId);
        setBonsaiDebugOverrides((current) => ({
            ...current,
            gardenBedMaterialStyle,
        }));
    }, []);
    const handleActualAlphaObservationRequest = useCallback(() => {
        setActualAlphaObservation(null);
        setActualAlphaObservationRequested(true);
    }, []);
    const handleActualAlphaObservationCancel = useCallback(() => {
        setActualAlphaObservationRequested(false);
    }, []);
    const handleActualAlphaObservation = useCallback((observation) => {
        setActualAlphaObservation(observation);
        setActualAlphaObservationRequested(false);
    }, []);
    const bonsaiMaterializationRuntime = useZenBonsaiMaterializationRuntime(bonsaiLifecycleInput, {
        bootTraceContext,
    });
    const bonsaiMaterializationReady = bonsaiMaterializationRuntime.materializationReady === true;
    const [bonsaiFrameAck, setBonsaiFrameAck] = useState(null);
    const retainedAckCanvasRef = useRef(null);
    const retainedAckTreeIdentityRef = useRef(null);
    const bonsaiTopologyEnabled = (
        bonsaiIdentityReady
        &&
        isTabActive !== false
        && renderSurfaceMeasurement.isMeasured === true
        && bonsaiMaterializationReady
    );
    const homeTopologyRuntime = useZenClassicHomeTopologyRuntime({
        treeType: workspaceState.treeType,
        currentPhenotype: workspaceState.currentPhenotype,
        treeSeed: workspaceState.treeSeed,
        structureDepth: workspaceState.structureDepth,
        publishPondBioticSignal,
        bonsaiLifeState: bonsaiMaterializationRuntime.lifeState,
        bonsaiGrowthModel: resolveZenClassicHomeBonsaiGrowthModel(),
        classic2LineageMode: resolveZenClassicHomeBonsaiLineageMode({
            ephemeralPresentationScene: ephemeralBonsaiPresentationScene,
        }),
        classic2StructureMode: workspaceState.structureMode,
        classic2IdentityRevision: workspaceState.identityRevision,
        classic2CanonicalLatent: workspaceState.sakuraV2Latent,
        classic2CanonicalLatentVersion: workspaceState.sakuraV2LatentState.version,
        classic2ProfileEpoch: workspaceState.profileEpoch,
        classic2CanonicalTreeIdentity: workspaceState.activeIdentity,
        classic2CanonicalGenerationInputs: workspaceState.generationInputs,
        bootTraceContext,
        onFirstVisualMilestone,
        enabled: bonsaiTopologyEnabled,
        candidatePreparationEnabled: (
            bonsaiIdentityReady
            &&
            isTabActive !== false
            && renderSurfaceMeasurement.isMeasured === true
        ),
    });
    const bonsaiRenderReady = (
        bonsaiTopologyEnabled
        && homeTopologyRuntime.modelMaterializationReady === true
    );
    const retainedMainRendererLifetimeRef = useRef(false);
    const mainRendererLifetimeEnabled = bonsaiRenderReady || retainedMainRendererLifetimeRef.current;
    useLayoutEffect(() => {
        if (bonsaiRenderReady) retainedMainRendererLifetimeRef.current = true;
    }, [bonsaiRenderReady]);
    const bonsaiLifecycleInputSignature = bonsaiMaterializationRuntime.inputSignature;
    const bonsaiMaterializationKey = useMemo(() => {
        if (!bonsaiRenderReady) return null;
        return buildZenBonsaiMaterializationKey({
            inputSignature: bonsaiLifecycleInputSignature,
            evidenceSignature: bonsaiMaterializationRuntime.materialization.evidenceSignature,
            lifeSignature: bonsaiMaterializationRuntime.lifeSignature,
            presentationMode: resolveZenBonsaiPresentationMode(bonsaiLifecycleInput),
            modelId: homeTopologyRuntime.modelId,
            modelMode: homeTopologyRuntime.modelMode,
            modelTopologyFingerprint: homeTopologyRuntime.modelFingerprint,
            modelIdentityFingerprint: homeTopologyRuntime.modelIdentityFingerprint,
            modelCommitSignature:
                homeTopologyRuntime.modelCommittedRequestSignature,
            modelStateRevision: homeTopologyRuntime.modelStateRevision,
        });
    }, [
        homeTopologyRuntime.modelCommittedRequestSignature,
        homeTopologyRuntime.modelFingerprint,
        homeTopologyRuntime.modelIdentityFingerprint,
        homeTopologyRuntime.modelMode,
        homeTopologyRuntime.modelStateRevision,
        bonsaiLifecycleInput,
        bonsaiLifecycleInputSignature,
        bonsaiMaterializationRuntime.lifeSignature,
        bonsaiMaterializationRuntime.materialization,
        bonsaiRenderReady,
    ]);
    const preparedBonsaiMaterialization = useMemo(() => (
        bonsaiRenderReady && bonsaiMaterializationKey
            ? Object.freeze({
                sceneCommitKey: presentationSceneCommitKey,
                inputSignature: bonsaiLifecycleInputSignature,
                bonsaiMaterializationKey,
            })
            : null
    ), [
        bonsaiLifecycleInputSignature,
        bonsaiMaterializationKey,
        bonsaiRenderReady,
        presentationSceneCommitKey,
    ]);
    const preparedBonsaiMaterializationRef = useRef(preparedBonsaiMaterialization);
    preparedBonsaiMaterializationRef.current = preparedBonsaiMaterialization;
    useEffect(() => {
        if (typeof onBonsaiMaterializationPrepared === 'function') {
            onBonsaiMaterializationPrepared(preparedBonsaiMaterialization);
        }
    }, [onBonsaiMaterializationPrepared, preparedBonsaiMaterialization]);
    const retainedRendererIdentityRef = useRef(null);
    const retainedRendererIdentityRevisionRef = useRef(null);
    if (preparedBonsaiMaterialization) {
        retainedRendererIdentityRef.current = preparedBonsaiMaterialization;
        retainedRendererIdentityRevisionRef.current = workspaceState.identityRevision;
    }
    const rendererIdentity = preparedBonsaiMaterialization || retainedRendererIdentityRef.current;
    const retainedRendererIdentityCurrent = Boolean(
        retainedRendererIdentityRef.current
        && retainedRendererIdentityRef.current.sceneCommitKey === presentationSceneCommitKey
        && retainedRendererIdentityRef.current.inputSignature === bonsaiLifecycleInputSignature
        && retainedRendererIdentityRevisionRef.current === workspaceState.identityRevision
    );
    const canvasPresentationIdentity = preparedBonsaiMaterialization
        || (retainedRendererIdentityCurrent ? retainedRendererIdentityRef.current : null);
    const bonsaiCanvasPresentationReady = Boolean(
        canvasPresentationIdentity
        && bonsaiFrameAck?.sceneCommitKey === canvasPresentationIdentity.sceneCommitKey
        && bonsaiFrameAck?.inputSignature === canvasPresentationIdentity.inputSignature
        && bonsaiFrameAck?.bonsaiMaterializationKey
            === canvasPresentationIdentity.bonsaiMaterializationKey
    );
    const bonsaiCanvasPaintVisible = Boolean(
        bonsaiFrameAck
        && retainedAckCanvasRef.current !== null
        && retainedAckCanvasRef.current === canvasRef.current
        && bonsaiFrameAck.sceneCommitKey === presentationSceneCommitKey
        && retainedAckTreeIdentityRef.current === workspaceState.activeIdentityFingerprint
    );
    const handleBonsaiFirstFrameReady = useCallback((metadata = null) => {
        const expected = preparedBonsaiMaterializationRef.current;
        if (
            !expected
            || metadata?.sceneCommitKey !== expected.sceneCommitKey
            || metadata?.inputSignature !== expected.inputSignature
            || metadata?.bonsaiMaterializationKey !== expected.bonsaiMaterializationKey
        ) {
            return;
        }
        retainedAckCanvasRef.current = canvasRef.current;
        retainedAckTreeIdentityRef.current = workspaceState.activeIdentityFingerprint;
        setBonsaiFrameAck(Object.freeze({
            sceneCommitKey: expected.sceneCommitKey,
            inputSignature: expected.inputSignature,
            bonsaiMaterializationKey: expected.bonsaiMaterializationKey,
            renderedPresentation: metadata.renderedPresentation || null,
        }));
        if (typeof onBonsaiFirstFrameReady === 'function') {
            onBonsaiFirstFrameReady(metadata);
        }
    }, [onBonsaiFirstFrameReady, workspaceState.activeIdentityFingerprint]);
    useEffect(() => {
        emitZenMainBootTrace('bonsai_home:runtime_readiness_inputs', bootTraceContext, {
            renderSurfaceMeasured: renderSurfaceMeasurement.isMeasured === true,
            measuredRenderWidth,
            measuredRenderHeight,
            retainedRenderWidth: renderWidth,
            retainedRenderHeight: renderHeight,
            isTabActive: isTabActive !== false,
            bonsaiMaterializationReady,
            materializationStatus: bonsaiMaterializationRuntime.materializationStatus,
            lifeSignatureLength: typeof bonsaiMaterializationRuntime.lifeSignature === 'string'
                ? bonsaiMaterializationRuntime.lifeSignature.length
                : 0,
            targetSignatureLength: typeof bonsaiMaterializationRuntime.targetSignature === 'string'
                ? bonsaiMaterializationRuntime.targetSignature.length
                : 0,
            hasLifecycleInput: bonsaiLifecycleInput !== null,
            lifecycleInputSignatureLength: bonsaiLifecycleInputSignature.length,
            topologyEnabled: bonsaiTopologyEnabled,
            bonsaiRenderReady,
            mainRendererLifetimeEnabled,
            bonsaiModelId: homeTopologyRuntime.modelId,
            bonsaiModelReady: homeTopologyRuntime.modelReady,
            bonsaiModelMaterializationReady:
                homeTopologyRuntime.modelMaterializationReady,
            bonsaiModelStatus: homeTopologyRuntime.modelStatus,
            bonsaiModelMode: homeTopologyRuntime.modelMode,
            ephemeralBonsaiPresentationScene,
            bonsaiModelFingerprintLength:
                typeof homeTopologyRuntime.modelFingerprint === 'string'
                    ? homeTopologyRuntime.modelFingerprint.length
                    : 0,
            bonsaiModelIdentityFingerprintLength:
                typeof homeTopologyRuntime.modelIdentityFingerprint === 'string'
                    ? homeTopologyRuntime.modelIdentityFingerprint.length
                    : 0,
            bonsaiMaterializationKeyLength: typeof bonsaiMaterializationKey === 'string'
                ? bonsaiMaterializationKey.length
                : 0,
            gardenBedLayoutReady,
            startupFirstFrameReady: bonsaiCanvasPresentationReady,
            retainedCanvasPaintVisible: bonsaiCanvasPaintVisible,
            mainFrameReadinessOwner: 'main_tab_composite_first_frame',
        });
        if (typeof onFirstVisualMilestone === 'function') {
            onFirstVisualMilestone(createZenHomeFirstVisualBonsaiMilestoneEvent(
                bonsaiRenderReady
                    ? ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_RUNTIME_INPUTS_READY
                    : ZEN_HOME_FIRST_VISUAL_MILESTONES.BONSAI_RUNTIME_INPUTS_WAIT,
                {
                    renderSurfaceMeasured: renderSurfaceMeasurement.isMeasured === true,
                    bonsaiMaterializationReady,
                    bonsaiModelId: homeTopologyRuntime.modelId,
                    bonsaiModelReady: homeTopologyRuntime.modelReady,
                    bonsaiModelMaterializationReady:
                        homeTopologyRuntime.modelMaterializationReady,
                    bonsaiModelStatus: homeTopologyRuntime.modelStatus,
                    hasLifecycleInput: bonsaiLifecycleInput !== null,
                },
            ));
        }
    }, [
        bootTraceContext,
        bonsaiLifecycleInput,
        bonsaiLifecycleInputSignature.length,
        bonsaiMaterializationKey,
        bonsaiMaterializationReady,
        bonsaiMaterializationRuntime.lifeSignature,
        bonsaiMaterializationRuntime.materializationStatus,
        bonsaiMaterializationRuntime.targetSignature,
        bonsaiTopologyEnabled,
        bonsaiRenderReady,
        ephemeralBonsaiPresentationScene,
        gardenBedLayoutReady,
        bonsaiCanvasPresentationReady,
        bonsaiCanvasPaintVisible,
        homeTopologyRuntime.modelFingerprint,
        homeTopologyRuntime.modelId,
        homeTopologyRuntime.modelIdentityFingerprint,
        homeTopologyRuntime.modelMaterializationReady,
        homeTopologyRuntime.modelMode,
        homeTopologyRuntime.modelReady,
        homeTopologyRuntime.modelStatus,
        measuredRenderHeight,
        measuredRenderWidth,
        isTabActive,
        mainRendererLifetimeEnabled,
        renderHeight,
        renderWidth,
        onFirstVisualMilestone,
        renderSurfaceMeasurement.isMeasured,
    ]);
    const bonsaiRenderSystem = useZenBonsaiRenderSystem({
        lifecycleInput: bonsaiLifecycleInput,
        lifeState: bonsaiMaterializationRuntime.lifeState,
        targetLifeState: bonsaiMaterializationRuntime.targetLifeState,
        habitSignal: bonsaiMaterializationRuntime.habitSignal,
        structureDepth: workspaceState.structureDepth,
        actionPolicyInput: bonsaiActionPolicyInput,
    });
    const debugActivationPresentation = useMemo(() => (
        resolveZenBonsaiDebugForcedActivationPresentation(
            bonsaiRenderSystem.activationPresentation,
            showBonsaiDebugPanel ? forcedActivationPercent : null,
        )
    ), [
        forcedActivationPercent,
        bonsaiRenderSystem.activationPresentation,
        showBonsaiDebugPanel,
    ]);
    const renderGrowthStage = homeTopologyRuntime.currentGrowthStage || STAGES.BLOOM;
    const bonsaiDebugControls = useMemo(() => {
        const liveActivationRatio = bonsaiRenderSystem.activationPresentation === null
            ? null : bonsaiRenderSystem.activationPresentation.ratio;
        return Object.freeze({
            panelPlacement: bonsaiLifeDebugControls?.panelPlacement || null,
            treeSeed: workspaceState.treeSeed,
            identityRevision: workspaceState.identityRevision,
            bonsaiRelease: bonsaiLifecycleInput?.bonsaiRelease || null,
            growth: Object.freeze({
                ...bonsaiLifeDebugControls?.growth,
                livePercent: bonsaiMaterializationRuntime.lifeState?.growth * 100,
                onForce: typeof bonsaiLifeDebugControls?.growth?.onForce === 'function'
                    ? value => bonsaiLifeDebugControls.growth.onForce(value, bonsaiMaterializationRuntime.lifeState)
                    : undefined,
            }),
            bloom: Object.freeze({
                ...bonsaiLifeDebugControls?.bloom,
                livePercent: bonsaiMaterializationRuntime.lifeState?.bloom * 100,
                onForce: typeof bonsaiLifeDebugControls?.bloom?.onForce === 'function'
                    ? value => bonsaiLifeDebugControls.bloom.onForce(value, bonsaiMaterializationRuntime.lifeState)
                    : undefined,
            }),
            activation: Object.freeze({
                livePercent: liveActivationRatio === null ? null : liveActivationRatio * 100,
                forcedPercent: forcedActivationPercent,
                rendered: bonsaiFrameAck?.renderedPresentation || null,
                onForce: activationForceControl === undefined ? handleActivationForce : activationForceControl.onForce,
                onReset: activationForceControl === undefined ? handleActivationForceReset : activationForceControl.onReset,
            }),
            gardenBedMaterialStyle: bonsaiDebugOverrides.gardenBedMaterialStyle,
            gardenBedMaterialEditable: effectiveHomeGardenBedLayoutFrame?.support === 'planter',
            onGardenBedMaterialStyleChange: handleGardenBedMaterialStyleChange,
            presentationStyle: bonsaiDebugOverrides.presentationStyle,
            presentationStyleEditable: homeTopologyRuntime.modelId !== 'plume',
            onPresentationStyleChange: handlePresentationStyleChange,
            // The render knob, not the scoring one: this is exactly what the
            // wood presentation's brush dryness and dropout key off, so a
            // report of "it looks broken near strained" needs this reading
            // beside the picture, not the activation-score pressure numbers.
            lifeState: bonsaiMaterializationRuntime.lifeState,
            actualAlpha: Object.freeze({
                requested: actualAlphaObservationRequested,
                observation: actualAlphaObservation,
                onRequest: handleActualAlphaObservationRequest,
                onCancel: handleActualAlphaObservationCancel,
            }),
        });
    }, [
        actualAlphaObservation,
        actualAlphaObservationRequested,
        forcedActivationPercent,
        activationForceControl,
        bonsaiDebugOverrides.gardenBedMaterialStyle,
        bonsaiDebugOverrides.presentationStyle,
        bonsaiLifecycleInput?.bonsaiRelease,
        bonsaiLifeDebugControls,
        bonsaiMaterializationRuntime.lifeState,
        bonsaiFrameAck,
        effectiveHomeGardenBedLayoutFrame?.support,
        homeTopologyRuntime.modelId,
        workspaceState.treeSeed,
        workspaceState.identityRevision,
        bonsaiRenderSystem.activationPresentation?.ratio,
        handleActivationForce,
        handleActivationForceReset,
        handleGardenBedMaterialStyleChange,
        handlePresentationStyleChange,
        handleActualAlphaObservationCancel,
        handleActualAlphaObservationRequest,
    ]);
    const bonsaiWorkerRenderBudget = useMemo(() => {
        const fallbackCadenceContext = resolveZenClassicBonsaiCadenceContext({
            embedded,
            homeEmbedded,
        });
        const fallbackTargetFps = resolveZenClassicBonsaiTargetFps({
            embedded,
            homeEmbedded,
            defaultTargetFps: MAIN_TARGET_FPS,
        });
        const fallbackPixelRatioCap = resolveZenClassicBonsaiPixelRatioCap({
            homeEmbedded,
        });
        return resolveZenMainBonsaiWorkerRenderBudget({
            cadenceContext: workerRenderBudget?.cadenceContext || fallbackCadenceContext,
            qualityMode: workerRenderBudget?.qualityMode || 'full',
            targetFps: Number.isFinite(Number(workerRenderBudget?.targetFps))
                ? Number(workerRenderBudget.targetFps)
                : fallbackTargetFps,
            pixelRatioCap: Number.isFinite(Number(workerRenderBudget?.pixelRatioCap))
                ? Number(workerRenderBudget.pixelRatioCap)
                : fallbackPixelRatioCap,
        });
    }, [
        embedded,
        homeEmbedded,
        workerRenderBudget,
    ]);

    const submittedSceneInputsRef = useRef(null);
    const currentSceneInputs = {
        treeType: workspaceState.treeType,
        treeSeed: workspaceState.treeSeed,
        currentPhenotype: workspaceState.currentPhenotype,
        currentStage: renderGrowthStage,
        treeTopology: homeTopologyRuntime.treeTopology,
        bonsaiLifeState: bonsaiMaterializationRuntime.lifeState,
        activationPresentation: debugActivationPresentation,
        species: homeTopologyRuntime.species,
    };
    const submittedScene = submittedSceneInputsRef.current;
    const submittedSceneMatchesTree = (
        submittedScene !== null
        && submittedScene.profileEpoch === workspaceState.profileEpoch
        && submittedScene.inputs.treeSeed === workspaceState.treeSeed
    );
    useLayoutEffect(() => {
        if (preparedBonsaiMaterialization !== null) {
            submittedSceneInputsRef.current = {
                profileEpoch: workspaceState.profileEpoch,
                inputs: currentSceneInputs,
            };
        } else if (!submittedSceneMatchesTree) {
            submittedSceneInputsRef.current = null;
        }
    });
    const animateRetainedModelScene = (
        homeTopologyRuntime.modelProjectionPending === true
        && homeTopologyRuntime.modelReady === true
        && bonsaiCanvasPaintVisible
        && submittedSceneMatchesTree
    );
    // A same-seed model projection is a candidate, not a new rendered scene.
    // Keep the exact prior scene/life inputs and its animation while computing;
    // new SCENE submission and readiness still require current materialization.
    // A reset may reuse the fingerprint, but never the previous profile's scene.
    // The snapshot is committed above so an abandoned render cannot replace it.
    const rendererSceneInputs = animateRetainedModelScene
        ? submittedScene.inputs
        : currentSceneInputs;
    const homeCanopyReadingEnvelope = useMemo(() => {
        if (typeof onHomeCanopyReadingEnvelope !== 'function'
            || effectiveHomeGardenBedLayoutFrame?.support !== 'frame-seam'
            || homeTopologyRuntime.modelReady !== true) return null;
        if (rendererSceneInputs.treeTopology?.isPlume !== true) {
            throw new Error('ZEN_HOME_CANOPY_READING_PLUME_REQUIRED');
        }
        return resolveZenHomeCanopyReadingEnvelope({
            cameraSnapshots: rendererSceneInputs.treeTopology.cameraSnapshots,
            layoutFrame: effectiveHomeGardenBedLayoutFrame,
        });
    }, [effectiveHomeGardenBedLayoutFrame, homeTopologyRuntime.modelReady, onHomeCanopyReadingEnvelope,
        rendererSceneInputs.treeTopology?.cameraSnapshots]);
    useLayoutEffect(() => {
        if (typeof onHomeCanopyReadingEnvelope === 'function') {
            onHomeCanopyReadingEnvelope(homeCanopyReadingEnvelope === null ? null : {
                sceneCommitKey: presentationSceneCommitKey,
                envelope: homeCanopyReadingEnvelope,
            });
        }
    }, [homeCanopyReadingEnvelope, onHomeCanopyReadingEnvelope, presentationSceneCommitKey]);
    const treeRendererRuntime = useZenHomeTreeRenderer({
        mainRendererOwner: ZEN_BONSAI_MAIN_RENDER_OWNERS.HOME_WORKER,
        bonsaiMaterializationKey: rendererIdentity?.bonsaiMaterializationKey || null,
        inputSignature: rendererIdentity?.inputSignature || null,
        canvasRef,
        width: renderWidth,
        height: renderHeight,
        frameIdRef: frameId,
        treeCacheRef,
        lastCacheKeyRef: lastCacheKey,
        ...rendererSceneInputs,
        mainTargetFps: bonsaiWorkerRenderBudget.targetFps,
        mainCadenceContext: bonsaiWorkerRenderBudget.cadenceContext,
        pixelRatioCap: bonsaiWorkerRenderBudget.pixelRatioCap,
        renderBudget: bonsaiWorkerRenderBudget.render,
        renderLoopMode: resolveZenClassicBonsaiRenderLoopMode({
            homeEmbedded,
        }),
        renderBackend: resolveZenClassicBonsaiRenderBackend({
            homeEmbedded,
            modelId: homeTopologyRuntime.modelId,
        }),
        isCollectionMode: false,
        abPair: null,
        abCanvasRefA: null,
        abCanvasRefB: null,
        abWidthA: 0,
        abHeightA: 0,
        abWidthB: 0,
        abHeightB: 0,
        hidePot: false,
        potStyleOverride: resolveZenClassicHomePotStyle({
            homeEmbedded,
            frameVariant,
        }),
        homeGardenBedLayoutFrame: effectiveHomeGardenBedLayoutFrame,
        gardenBedMaterialStyle: showBonsaiDebugPanel
            ? bonsaiDebugOverrides.gardenBedMaterialStyle : DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
        presentationStyle: showBonsaiDebugPanel
            ? bonsaiDebugOverrides.presentationStyle : DEFAULT_ZEN_BONSAI_PRESENTATION_STYLE,
        mainSurfaceReady: gardenBedLayoutReady,
        showBackboneDebug: false,
        showBranchTierDebug: false,
        solarLocationProfile,
        presentationEnvironmentMode,
        presentationWeatherAuthority,
        renderMode: 'full',
        mainRenderQuality: bonsaiWorkerRenderBudget.qualityMode,
        enableMainRender: mainRendererLifetimeEnabled,
        mainRenderActive: (
            mainRendererLifetimeEnabled
            && isTabActive !== false
            && (preparedBonsaiMaterialization !== null || animateRetainedModelScene)
        ),
        suppressMainRenderSceneSync: (
            mainRendererLifetimeEnabled
            && (isTabActive === false || preparedBonsaiMaterialization === null)
        ),
        presentationSceneCommitKey,
        cameraPreset: resolveZenClassicCameraPreset({
            experimental: false,
            embedded,
            homeEmbedded,
            frameVariant,
        }),
        bloomPresentation,
        onBloomPresentationComplete,
        onBloomRegionTargets,
        onFirstFrameReady: handleBonsaiFirstFrameReady,
        onFirstVisualMilestone,
        bootTraceContext,
        observeActualAlpha: actualAlphaObservationRequested,
        onActualAlphaObservation: handleActualAlphaObservation,
    });

    return {
        shellProps: {
            containerRef: containerTargetRef,
            experimental: false,
            embedded,
            homeEmbedded,
        },
        workspaceLayoutClassName: resolveZenClassicWorkspaceLayoutClassName({
            experimental: false,
        }),
        viewportBaseProps: {
            mainViewportRef: mainViewportTargetRef,
            experimental: false,
            embedded,
            isCollectionMode: false,
            canvasRef,
            mainCanvasWidth: treeRendererRuntime.mainCanvasSurface.cssWidth,
            mainCanvasHeight: treeRendererRuntime.mainCanvasSurface.cssHeight,
            mainCanvasStyle: treeRendererRuntime.mainCanvasSurface.expanded === true
                ? {
                    position: 'absolute',
                    zIndex: 10,
                    pointerEvents: 'none',
                    top: `${treeRendererRuntime.mainCanvasSurface.cssOffsetY}px`,
                    left: `${treeRendererRuntime.mainCanvasSurface.cssOffsetX}px`,
                    width: `${treeRendererRuntime.mainCanvasSurface.cssWidth}px`,
                    height: `${treeRendererRuntime.mainCanvasSurface.cssHeight}px`,
                }
                : null,
            mainCanvasPresentationReady: bonsaiCanvasPresentationReady,
            mainCanvasPaintVisible: bonsaiCanvasPaintVisible,
            bonsaiExperience: bonsaiMaterializationReady ? bonsaiRenderSystem.experience : null,
            bonsaiActionPolicy: bonsaiMaterializationReady ? bonsaiRenderSystem.actionPolicy : null,
            bonsaiActivationDebug: bonsaiMaterializationReady ? bonsaiRenderSystem.activationDebug : null,
            bonsaiDebugControls: { ...bonsaiDebugControls, actualAlpha: {
                ...bonsaiDebugControls.actualAlpha,
                supported: treeRendererRuntime.supportsActualAlphaObservation === true,
            } },
            showBonsaiDebugPanel: showBonsaiDebugPanel === true,
            bonsaiTimeDiagnostics: showBonsaiTimeDiagnostics
                ? treeRendererRuntime.bonsaiTimeDiagnostics
                : null,
            raiseBonsaiTimeDiagnostics: showBonsaiTimeDiagnostics && raiseBonsaiTimeDiagnostics,
            onRerollBonsai: bonsaiRenderSystem.actionPolicy.reroll.available
                ? handleRerollBonsai
                : null,
        },
    };
}

export default useZenClassicHomeWorkspaceRuntime;
