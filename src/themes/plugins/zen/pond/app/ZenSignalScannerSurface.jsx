import { resolveZenPondQaTelemetry } from '../control/zenPondQaTelemetry.js';
import { resolveZenPondViewportLayout } from '../runtime/zenPondViewportPolicy.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useResizeObserver } from '@/ui-kit/hooks/useResizeObserver';
import { useVisibilityGate } from '@/ui-kit/rendering/useVisibilityGate.js';
import { DEFAULT_KOI_TUNING } from '../model/koi/constants.js';
import { buildWaterPaletteRenderState } from '../world/pondPalettes.js';
import ZenSignalScannerView from '../../widgets/signals/signalScanner/ui/ZenSignalScannerView.jsx';
import {
    DEFAULT_QUALITY_PROFILE,
    QUALITY_PROFILES,
    resolveQualityMode,
} from '../runtime/zenSignalScannerConfig.js';
import { useZenAppearanceStore } from '../state/stores/useZenAppearanceStore.js';
import { useZenBonsaiSceneStore } from '../state/stores/useZenBonsaiSceneStore.js';
import { useZenWorkerRendererMount } from '../control/useZenWorkerRendererMount.js';
import { useZenPondEnvironmentAuthority } from './hooks/useZenPondEnvironmentAuthority.js';
import { useZenAppearanceActions } from './hooks/useZenAppearanceActions.js';
import { useZenPondModelDataRuntime } from './hooks/useZenPondModelDataRuntime.js';
import { useZenSceneSession } from './hooks/useZenSceneSession.js';
import { useZenInteractionRefs } from './hooks/useZenInteractionRefs.js';
import { useZenInteractionController } from './hooks/useZenInteractionController.js';
import { useZenSelectionAutoRelease } from './hooks/useZenSelectionAutoRelease.js';
import { useZenViewStateController } from './hooks/useZenViewStateController.js';
import {
    resolveZenPondProjectionDataIsolationMode,
    resolveZenPondProjectionEnvironmentPolicy,
    resolveZenPondProjectionFirstVisionPresentation,
    resolveZenPresentationPondBioticSignal,
} from './zenSignalScannerPresentation.js';
import {
    normalizeZenRendererDebugToggles,
    resolveZenRendererDebugTogglePreset,
    ZEN_RENDERER_DEBUG_TOGGLES_GLOBAL_KEY,
} from '../contracts/zenRendererDebugToggles.js';
import ZenWaterEffectsDebugPanel from './ZenWaterEffectsDebugPanel.jsx';
import {
    applyZenPondWaterEffectDebugPatch,
    ZEN_POND_WATER_EFFECTS_DEBUG_GLOBAL_KEY,
} from '../control/runtimeClient/waterEffectsDebugControls.js';
import {
    normalizeZenKoiRosterSnapshot,
} from '../roster/zenKoiRosterContract.js';
import {
    FIRST_VISION_KOI_COUNT,
} from '../roster/zenFirstVisionKoiRoster.js';
import {
    resolveZenMainPondWorkerRenderBudget,
} from '../../runtime/zenMainWorkerRenderBudget.js';
import {
    emitZenMainBootTrace,
} from '../../runtime/zenMainBootReadinessTrace.js';
import {
    ZEN_HOME_FIRST_VISUAL_MILESTONES,
    createZenHomeFirstVisualPondMilestoneEvent,
} from '../../runtime/zenHomeFirstVisualReadinessContract.js';
import {
    resolveZenPondFirstFrameRendererDebugToggles,
    shouldDeferZenPondYoonseulForFirstFrame,
} from '../contracts/zenPondFirstFrameEffectPolicy.js';
import {
    normalizeZenPondPresentationSceneCommitKey,
} from '../contracts/zenPondPresentationSceneCommit.js';
import {
    requireZenPondVisualProfile,
} from '../contracts/zenPondVisualProfile.js';
import { normalizeZenPondRegistrationEntityId } from '../contracts/zenPondRegistrationPresentation.js';

const readGlobalRendererDebugToggles = () => {
    const debugGlobal = typeof globalThis !== 'undefined' ? globalThis : null;
    const globalToggles = debugGlobal?.[ZEN_RENDERER_DEBUG_TOGGLES_GLOBAL_KEY];
    return globalToggles && typeof globalToggles === 'object' ? globalToggles : null;
};

const publishRendererDebugToggles = (toggles) => {
    const debugGlobal = typeof globalThis !== 'undefined' ? globalThis : null;
    if (!debugGlobal) return;
    const normalized = normalizeZenRendererDebugToggles(toggles);
    debugGlobal[ZEN_RENDERER_DEBUG_TOGGLES_GLOBAL_KEY] = { ...normalized };
    const controls = debugGlobal[ZEN_POND_WATER_EFFECTS_DEBUG_GLOBAL_KEY];
    if (!controls || typeof controls.set !== 'function') return;
    try {
        controls.set(normalized);
    } catch (_) {
        // Runtime debug controls can briefly disappear while the worker remounts.
    }
};

const isToggleObject = (value) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
);

const buildWaterEffectsAllOnToggles = () => resolveZenRendererDebugTogglePreset('on');
const buildWaterEffectsAllOffToggles = () => resolveZenRendererDebugTogglePreset('off');


const resolvePaletteStops = (waterPalette = null) => {
    const stops = Array.isArray(waterPalette?.gradientStops)
        ? waterPalette.gradientStops.filter((value) => typeof value === 'string' && value.trim())
        : [];
    const center = stops[0] || '#2E4636';
    const middle = stops[1] || center;
    const edge = stops[2] || middle;
    return { center, middle, edge };
};

const buildZenPondUnderpaintStyle = (waterPalette = null) => {
    const { center, middle, edge } = resolvePaletteStops(waterPalette);
    return {
        backgroundColor: edge,
        backgroundImage: [
            `radial-gradient(circle at 38% 32%, ${center} 0%, ${middle} 44%, ${edge} 100%)`,
            `linear-gradient(145deg, ${waterPalette?.sheenStart || 'rgba(255,255,255,0.06)'} 0%, ${waterPalette?.sheenMid || 'rgba(255,255,255,0)'} 44%, ${waterPalette?.sheenEnd || 'rgba(255,255,255,0.04)'} 100%)`,
            `radial-gradient(circle at 50% 48%, rgba(2, 8, 8, 0) 48%, ${waterPalette?.vignetteOuter || 'rgba(1, 8, 10, 0.58)'} 100%)`,
        ].join(', '),
    };
};

export default function ZenSignalScannerSurface({
    status = 'safe',
    koiRosterFrame = undefined,
    dailyScore = null,
    lockedTarget,
    onLockTarget,
    onInvitationKoiActivate = null,
    onInvitationKoiMembershipChange = null,
    invitationRegistrationEntityId = null,
    invitationGuidance = null,
    invitationCapacityFull = false,
    koiTuning,
    visualProfile,
    solarLocationProfile = null,
    forcedSwimModel = null,
    panelLabel = '',
    showSwimModelBadge = true,
    hardResetToken = 0,
    sceneGenerationKey = null,
    isTabActive = true,
    runtimeMountReady = true,
    requireRosterForRuntimeMount = false,
    onFirstVisualMilestone = null,
    onRuntimeFirstFrameReady = null,
    onRuntimeReadinessChange = null,
    presentationSceneCommitKey = null,
    parkRuntimeOnUnmount = false,
    rendererDebugToggles = null,
    showWaterEffectsDebugPanel = false,
    showRerollControls = true,
    dataIsolationMode = false,
    pondProjection = null,
    workerRenderBudget = null,
    bootTraceContext = null,
    frameVariant = 'card',
    className = "",
}) {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
        throw new Error('ZEN_SIGNAL_SCANNER_WORKER_ONLY_RUNTIME_REQUIRED');
    }

    const { t } = useAppTranslation('tools');
    const { t: mainT } = useAppTranslation('main');
    const { t: guidanceT } = useAppTranslation('guidance');
    const registrationEntityId = normalizeZenPondRegistrationEntityId(invitationRegistrationEntityId);
    const containerRef = useRef(null), viewportRef = useRef(null), backgroundHostRef = useRef(null), foregroundHostRef = useRef(null);
    const interactionSurfaceRef = useRef(null);
    const {
        width: observedWidth,
        height: observedHeight,
        targetRef: viewportTargetRef,
    } = useResizeObserver(viewportRef);
    const width = observedWidth > 0 ? Math.round(observedWidth) : 0;
    const height = observedHeight > 0 ? Math.round(observedHeight) : 0;
    const stableViewportSizeRef = useRef({ width: 0, height: 0 });
    if (width > 0 && height > 0) {
        stableViewportSizeRef.current = { width, height };
    }
    const rendererWidth = width > 0 ? width : stableViewportSizeRef.current.width;
    const rendererHeight = height > 0 ? height : stableViewportSizeRef.current.height;
    const rendererSizeRef = useRef({ width: 0, height: 0 });
    if (rendererWidth > 0 && rendererHeight > 0) {
        rendererSizeRef.current = {
            width: rendererWidth,
            height: rendererHeight,
        };
    }
    const worldSizeRef = useRef({ width: 0, height: 0 });
    if (
        (!worldSizeRef.current.width || !worldSizeRef.current.height)
        && rendererWidth > 0
        && rendererHeight > 0
    ) {
        worldSizeRef.current = resolveZenPondViewportLayout({ width: rendererWidth, height: rendererHeight });
    }
    const worldWidth = Number(worldSizeRef.current.width) || 0;
    const worldHeight = Number(worldSizeRef.current.height) || 0;
    const pondWorkerRenderBudget = useMemo(
        () => resolveZenMainPondWorkerRenderBudget(workerRenderBudget),
        [workerRenderBudget],
    );
    const resolvedVisualProfile = useMemo(
        () => requireZenPondVisualProfile(visualProfile),
        [visualProfile],
    );
    const pondQualityMode = resolveQualityMode(pondWorkerRenderBudget.qualityMode);
    const resolveInitialFirstFrameEffectsCommitted = useCallback(() => (
        !shouldDeferZenPondYoonseulForFirstFrame({
            firstFrameEffectPolicy: pondWorkerRenderBudget.firstFrameEffectPolicy,
            firstFrameCommitted: false,
        })
    ), [pondWorkerRenderBudget.firstFrameEffectPolicy]);
    const [pondFirstFrameEffectsCommitted, setPondFirstFrameEffectsCommitted] = useState(
        () => resolveInitialFirstFrameEffectsCommitted(),
    );
    const [pondStartupFirstFrameReady, setPondStartupFirstFrameReady] = useState(false);
    const defaultWaterEffectDebugToggles = useMemo(buildWaterEffectsAllOnToggles, []);
    const [waterEffectDebugToggles, setWaterEffectDebugToggles] = useState(() => {
        const explicitToggles = isToggleObject(rendererDebugToggles)
            ? rendererDebugToggles
            : readGlobalRendererDebugToggles();
        if (isToggleObject(explicitToggles)) {
            return normalizeZenRendererDebugToggles(explicitToggles);
        }
        return buildWaterEffectsAllOnToggles();
    });
    const requestedRendererDebugToggles = showWaterEffectsDebugPanel
        ? waterEffectDebugToggles
        : (
            isToggleObject(rendererDebugToggles)
                ? rendererDebugToggles
                : defaultWaterEffectDebugToggles
        );
    const normalizedRendererDebugToggles = useMemo(() => (
        resolveZenPondFirstFrameRendererDebugToggles({
            toggles: requestedRendererDebugToggles,
            firstFrameEffectPolicy: pondWorkerRenderBudget.firstFrameEffectPolicy,
            firstFrameCommitted: pondFirstFrameEffectsCommitted,
        })
    ), [
        pondFirstFrameEffectsCommitted,
        pondWorkerRenderBudget.firstFrameEffectPolicy,
        requestedRendererDebugToggles,
    ]);
    const yoonseulDeferredForFirstFrame = shouldDeferZenPondYoonseulForFirstFrame({
        firstFrameEffectPolicy: pondWorkerRenderBudget.firstFrameEffectPolicy,
        firstFrameCommitted: pondFirstFrameEffectsCommitted,
    });
    const rendererDebugTogglesRef = useRef(normalizedRendererDebugToggles);
    rendererDebugTogglesRef.current = normalizedRendererDebugToggles;
    useEffect(() => {
        if (showWaterEffectsDebugPanel) return;
        setWaterEffectDebugToggles(
            isToggleObject(rendererDebugToggles)
                ? normalizeZenRendererDebugToggles(rendererDebugToggles)
                : defaultWaterEffectDebugToggles,
        );
    }, [defaultWaterEffectDebugToggles, rendererDebugToggles, showWaterEffectsDebugPanel]);
    useEffect(() => {
        if (!showWaterEffectsDebugPanel) return;
        publishRendererDebugToggles(normalizedRendererDebugToggles);
    }, [normalizedRendererDebugToggles, showWaterEffectsDebugPanel]);
    const resolvedKoiRosterFrame = useMemo(() => {
        if (koiRosterFrame === undefined) {
            throw new Error('ZEN_POND_KOI_ROSTER_FRAME_REQUIRED');
        }
        if (lockedTarget === undefined) {
            return normalizeZenKoiRosterSnapshot(koiRosterFrame);
        }
        return normalizeZenKoiRosterSnapshot({
            ...koiRosterFrame,
            focusDomain: lockedTarget,
        });
    }, [koiRosterFrame, lockedTarget]);
    const rosterSnapshotRef = useRef(resolvedKoiRosterFrame);
    rosterSnapshotRef.current = resolvedKoiRosterFrame;
    const rosterFishCount = Array.isArray(resolvedKoiRosterFrame?.items)
        ? resolvedKoiRosterFrame.items.length
        : 0;
    const upstreamRuntimeMountReady = runtimeMountReady === true
        && (requireRosterForRuntimeMount !== true || rosterFishCount > 0);
    const workerInputSyncRef = useRef(() => false);
    const {
        sceneGenerationKeyRef,
        sessionSaltRef,
        previousHardResetTokenRef,
        sceneRerollRevision,
        rerollSceneState,
        hashSceneGenerationKey,
    } = useZenSceneSession({
        hardResetToken,
        sceneGenerationKey,
    });
    const {
        domainAppearanceMap,
        appearanceRevision,
        bindAppearancePersistenceEvents,
    } = useZenAppearanceStore(useShallow((state) => ({
        domainAppearanceMap: state.domainAppearanceMap,
        appearanceRevision: state.revision,
        bindAppearancePersistenceEvents: state.bindPersistenceEvents,
    })));
    const { pondBioticSignal } = useZenBonsaiSceneStore(useShallow((state) => ({
        pondBioticSignal: state.pondBioticSignal,
    })));
    const resolvedFirstVisionPresentation = useMemo(() => resolveZenPondProjectionFirstVisionPresentation({
        pondProjection,
    }), [pondProjection]);
    const environmentPolicy = useMemo(() => resolveZenPondProjectionEnvironmentPolicy({
        pondProjection,
    }), [pondProjection]);
    const isolatedDataMode = useMemo(() => resolveZenPondProjectionDataIsolationMode({
        pondProjection,
        requestedDataIsolationMode: dataIsolationMode,
    }), [dataIsolationMode, pondProjection]);
    const pondDataRuntime = useZenPondModelDataRuntime({
        isolatedDataMode,
        bindAppearancePersistenceEvents,
    });
    const resolvedRuntimeMountReady = upstreamRuntimeMountReady
        && pondDataRuntime.ready === true;
    const resolvedPresentationSceneCommitKey = useMemo(() => (
        normalizeZenPondPresentationSceneCommitKey(presentationSceneCommitKey)
    ), [presentationSceneCommitKey]);
    const presentationSceneRequiredVisibleFishCount = useMemo(() => {
        if (resolvedPresentationSceneCommitKey === null) return 0;
        if (resolvedFirstVisionPresentation === true) {
            if (rosterFishCount !== FIRST_VISION_KOI_COUNT) {
                throw new Error(
                    `ZEN_POND_FIRST_VISION_ROSTER_COUNT_INVALID:expected=${FIRST_VISION_KOI_COUNT}:actual=${rosterFishCount}`,
                );
            }
            return FIRST_VISION_KOI_COUNT;
        }
        return rosterFishCount > 0 ? 1 : 0;
    }, [
        resolvedFirstVisionPresentation,
        resolvedPresentationSceneCommitKey,
        rosterFishCount,
    ]);
    const presentationPondBioticSignal = useMemo(() => resolveZenPresentationPondBioticSignal({
        pondProjection,
        pondBioticSignal: isolatedDataMode ? null : pondBioticSignal,
    }), [isolatedDataMode, pondBioticSignal, pondProjection]);
    const appearanceMapRef = useRef({});
    appearanceMapRef.current = isolatedDataMode ? {} : domainAppearanceMap;
    const tuning = useMemo(() => {
        const forcedModel = forcedSwimModel || null;
        const next = {
            ...DEFAULT_KOI_TUNING,
            ...(koiTuning || {}),
            sceneBonsaiPetalCapacity: Number(presentationPondBioticSignal?.petalCapacity ?? 0),
            sceneBonsaiBloomRatio: Number(presentationPondBioticSignal?.bloomRatio ?? 0),
            sceneBonsaiPetalFallLimit: Number(presentationPondBioticSignal?.petalFallLimit ?? 0),
            sceneBonsaiLeafBudSignal: Number(presentationPondBioticSignal?.leafBudSignal ?? 0),
            sceneBonsaiBudSignal: Number(presentationPondBioticSignal?.budSignal ?? 0),
            sceneBonsaiPreviewPetalRate: Number(presentationPondBioticSignal?.previewPetalRate ?? 0),
            sceneBonsaiRippleVitality: Number(presentationPondBioticSignal?.rippleVitality ?? 0),
            physics: {
                ...DEFAULT_KOI_TUNING.physics,
                ...(koiTuning?.physics || {}),
            },
        };
        if (forcedModel) {
            next.physics = {
                ...next.physics,
                swimModel: forcedModel,
            };
        }
        return next;
    }, [koiTuning, forcedSwimModel, presentationPondBioticSignal]);
    const { shouldAnimate: shouldAnimateScanner, documentVisible } = useVisibilityGate(
        containerRef,
        {
            active: isTabActive,
            threshold: 0.08,
            rootMargin: '140px',
        },
    );
    const {
        animationEnabledRef,
        animationEnabled,
        canMountRenderer,
        swimModelBadge,
        waterClarity,
    } = useZenViewStateController({
        t,
        tuning,
        panelLabel,
        dailyScore,
        status,
        rendererWidth,
        rendererHeight,
        isTabActive,
        shouldAnimateScanner,
        documentVisible,
        runtimeMountReady: resolvedRuntimeMountReady,
    });
    useEffect(() => {
        emitZenMainBootTrace('pond_surface:size_state', bootTraceContext, {
            observedWidth: width,
            observedHeight: height,
            rendererWidth,
            rendererHeight,
            worldWidth,
            worldHeight,
        });
    }, [bootTraceContext, height, rendererHeight, rendererWidth, width, worldHeight, worldWidth]);
    useEffect(() => {
        emitZenMainBootTrace('pond_surface:runtime_gate_state', bootTraceContext, {
            canMountRenderer,
            animationEnabled,
            isTabActive,
            shouldAnimateScanner,
            documentVisible,
            runtimeMountReady: resolvedRuntimeMountReady,
            upstreamRuntimeMountReady: runtimeMountReady === true,
            pondModelDataReady: pondDataRuntime.ready === true,
            pondModelDataStatus: pondDataRuntime.status,
            requireRosterForRuntimeMount: requireRosterForRuntimeMount === true,
            firstVisionPresentation: Boolean(resolvedFirstVisionPresentation),
            firstFrameEffectPolicy: pondWorkerRenderBudget.firstFrameEffectPolicy,
            yoonseulDeferredForFirstFrame,
            startupFirstFrameReady: pondStartupFirstFrameReady,
            mainFrameReadinessOwner: 'main_tab_composite_first_frame',
            rosterFishCount,
            presentationSceneCommitKey: resolvedPresentationSceneCommitKey,
            presentationSceneRequiredVisibleFishCount,
            rosterSignatureLength: typeof resolvedKoiRosterFrame?.signature === 'string'
                ? resolvedKoiRosterFrame.signature.length
                : 0,
        });
    }, [
        animationEnabled,
        bootTraceContext,
        canMountRenderer,
        documentVisible,
        isTabActive,
        pondWorkerRenderBudget.firstFrameEffectPolicy,
        pondStartupFirstFrameReady,
        pondDataRuntime.ready,
        pondDataRuntime.status,
        requireRosterForRuntimeMount,
        resolvedRuntimeMountReady,
        resolvedKoiRosterFrame?.items,
        resolvedKoiRosterFrame?.signature,
        rosterFishCount,
        runtimeMountReady,
        resolvedFirstVisionPresentation,
        resolvedPresentationSceneCommitKey,
        presentationSceneRequiredVisibleFishCount,
        shouldAnimateScanner,
        yoonseulDeferredForFirstFrame,
    ]);
    const runtimeQualityProfile = useMemo(() => {
        const qualityMode = resolveQualityMode(pondQualityMode);
        const qualityProfile = QUALITY_PROFILES[qualityMode] || DEFAULT_QUALITY_PROFILE;
        return {
            ...qualityProfile,
            telemetry: resolveZenPondQaTelemetry(),
            qualityMode,
            renderBudget: pondWorkerRenderBudget.render,
            dprCap: Math.min(qualityProfile.dprCap, pondWorkerRenderBudget.render.pixelRatioCap),
            targetFps: pondWorkerRenderBudget.targetFps,
            effectIntensityScale: pondWorkerRenderBudget.effectIntensityScale,
            firstFrameEffectPolicy: pondWorkerRenderBudget.firstFrameEffectPolicy,
            firstFrameEffectsCommitted: pondFirstFrameEffectsCommitted,
            cadenceTier: pondWorkerRenderBudget.cadenceTier,
        };
    }, [
        pondQualityMode,
        pondWorkerRenderBudget.render,
        pondWorkerRenderBudget.cadenceTier,
        pondWorkerRenderBudget.effectIntensityScale,
        pondWorkerRenderBudget.firstFrameEffectPolicy,
        pondWorkerRenderBudget.targetFps,
        pondFirstFrameEffectsCommitted,
    ]);

    useEffect(() => {
        emitZenMainBootTrace('pond_surface:boot_inputs', bootTraceContext, {
            qualityMode: runtimeQualityProfile.qualityMode,
            targetFps: Number(runtimeQualityProfile.targetFps) || 0,
            effectIntensityScale: Number(runtimeQualityProfile.effectIntensityScale) || 0,
            firstFrameEffectPolicy: runtimeQualityProfile.firstFrameEffectPolicy || null,
            firstFrameEffectsCommitted: runtimeQualityProfile.firstFrameEffectsCommitted === true,
            startupFirstFrameReady: pondStartupFirstFrameReady,
            mainFrameReadinessOwner: 'main_tab_composite_first_frame',
            firstVisionPresentation: Boolean(resolvedFirstVisionPresentation),
            presentationHour: environmentPolicy.presentationHour,
            petalCapacity: Number(presentationPondBioticSignal?.petalCapacity) || 0,
            bloomRatio: Number(presentationPondBioticSignal?.bloomRatio) || 0,
            rendererWidth,
            rendererHeight,
            worldWidth,
            worldHeight,
        });
    }, [
        bootTraceContext,
        presentationPondBioticSignal?.bloomRatio,
        presentationPondBioticSignal?.petalCapacity,
        pondStartupFirstFrameReady,
        rendererHeight,
        rendererWidth,
        resolvedFirstVisionPresentation,
        runtimeQualityProfile,
        resolvedVisualProfile,
        environmentPolicy.presentationHour,
        worldHeight,
        worldWidth,
    ]);

    const {
        envAuthorityRef,
        envRuntimeConfigSignature,
    } = useZenPondEnvironmentAuthority({
        tuning,
        solarLocationProfile,
        realtimeClockOwner: 'worker',
        presentationHour: environmentPolicy.presentationHour,
        weatherAuthorityMode: environmentPolicy.weatherAuthorityMode,
        weatherAuthority: pondProjection?.weatherAuthority || null,
    });
    const handleInputStateChanged = useCallback(({ force = false } = {}) => {
        const requestInputStateSync = workerInputSyncRef.current;
        if (typeof requestInputStateSync === 'function') {
            requestInputStateSync({ force });
        }
    }, []);
    const handleInteractionAction = useCallback((action, { entityId }) => {
        if (registrationEntityId !== null) return;
        if (action !== 'register_protected_site') return;
        if (typeof entityId !== 'string' || !entityId.trim()) throw new Error('ZEN_INVITATION_CLICK_IDENTITY_REQUIRED');
        if (typeof onInvitationKoiActivate === 'function') {
            onInvitationKoiActivate(entityId);
        }
    }, [onInvitationKoiActivate, registrationEntityId]);
    const {
        mousePos,
        clickPulseRef,
        hoveredDomain,
        hoveredAction,
        invitationEntityIds,
        externalHoverDomain,
        pressureRailInteractionActive,
        selectedFishIntentUid,
        handlePointerMove,
        handlePointerDown,
        handlePointerLeave,
        handleWorkerInteractionFeedback,
        clearSelectedFishSelection,
        resetInteractionState,
    } = useZenInteractionController({
        width: worldWidth,
        height: worldHeight,
        lockedTarget,
        onLockTarget,
        onInputStateChanged: handleInputStateChanged,
        onInteractionAction: handleInteractionAction,
    });
    useEffect(() => {
        if (typeof onInvitationKoiMembershipChange === 'function') onInvitationKoiMembershipChange(invitationEntityIds);
    }, [invitationEntityIds, onInvitationKoiMembershipChange]);
    // Let a selection fade on its own after a stretch of no interaction.
    const releaseSelection = useCallback(() => {
        // The domain lock and the worker-local uid must clear together. A
        // lock-only release leaves `localSelected` true in the Pixi sync pass.
        clearSelectedFishSelection();
        if (typeof onLockTarget === 'function') onLockTarget(null);
    }, [clearSelectedFishSelection, onLockTarget]);
    useZenSelectionAutoRelease({
        lockedTarget,
        interactionActive: Boolean(hoveredDomain || pressureRailInteractionActive),
        onRelease: releaseSelection,
    });

    const waterPalette = useMemo(() => {
        return buildWaterPaletteRenderState({
            paletteId: tuning.pondPaletteId,
            waterClarity,
            clarityBlend: tuning.pondClarityBlend,
        });
    }, [
        waterClarity,
        tuning.pondPaletteId,
        tuning.pondClarityBlend,
    ]);
    const {
        lockedTargetRef,
        hoverTargetRef,
        selectedFishIntentUidRef,
        invitationRegistrationEntityIdRef,
        tuningRef,
        waterPaletteRef,
        resetControlInputState,
    } = useZenInteractionRefs({
        lockedTarget,
        hoverTarget: externalHoverDomain,
        selectedFishIntentUid,
        invitationRegistrationEntityId: registrationEntityId,
        tuning,
        waterPalette,
        mousePosRef: mousePos,
    });

    const {
        activeDomainForReroll,
        domainBadgeText,
        domainSelectPromptText,
        rerollWithinLabel,
        rerollBreedLabel,
        rerollAllColorLabel,
        rerollAllBreedLabel,
        rerollSceneLabel,
        handleRerollWithinBreed,
        handleRerollBreed,
        handleRerollAllColor,
        handleRerollAllBreed,
        handleRerollScene,
    } = useZenAppearanceActions({
        t,
        lockedTarget,
        hoveredDomain,
        rosterSnapshot: resolvedKoiRosterFrame,
        onRerollScene: rerollSceneState,
    });

    const handleWaterEffectDebugPatch = useCallback((patch) => {
        setWaterEffectDebugToggles((current) => (
            applyZenPondWaterEffectDebugPatch(current, patch)
        ));
    }, []);
    const handleWaterEffectsAllOff = useCallback(() => {
        setWaterEffectDebugToggles(buildWaterEffectsAllOffToggles());
    }, []);
    const handleWaterEffectsAllOn = useCallback(() => {
        setWaterEffectDebugToggles(buildWaterEffectsAllOnToggles());
    }, []);
    const waterEffectsDebugPanel = useMemo(() => (
        showWaterEffectsDebugPanel ? (
            <ZenWaterEffectsDebugPanel
                toggles={waterEffectDebugToggles}
                onPatch={handleWaterEffectDebugPatch}
                onAllOff={handleWaterEffectsAllOff}
                onAllOn={handleWaterEffectsAllOn}
            />
        ) : null
    ), [
        handleWaterEffectDebugPatch,
        handleWaterEffectsAllOff,
        handleWaterEffectsAllOn,
        showWaterEffectsDebugPanel,
        waterEffectDebugToggles,
    ]);

    useEffect(() => {
        if (!hardResetToken && !sceneRerollRevision) return;
        const didHardResetTokenChange = hardResetToken !== previousHardResetTokenRef.current;
        previousHardResetTokenRef.current = hardResetToken;
        resetControlInputState();
        const baseSessionSalt = hashSceneGenerationKey(sceneGenerationKeyRef.current);
        if (didHardResetTokenChange && hardResetToken > 0) {
            const tokenSalt = Math.imul((Number(hardResetToken) >>> 0), 2654435761) >>> 0;
            const randomSalt = Math.floor(Math.random() * 0xffffffff) >>> 0;
            sessionSaltRef.current = (baseSessionSalt ^ tokenSalt ^ randomSalt) >>> 0;
        } else {
            sessionSaltRef.current = baseSessionSalt;
        }
        resetInteractionState();
    }, [hardResetToken, sceneRerollRevision, hashSceneGenerationKey, resetControlInputState, resetInteractionState]);
    useEffect(() => {
        setPondFirstFrameEffectsCommitted(resolveInitialFirstFrameEffectsCommitted());
        setPondStartupFirstFrameReady(false);
    }, [
        hardResetToken,
        sceneRerollRevision,
        resolveInitialFirstFrameEffectsCommitted,
    ]);
    useEffect(() => {
        if (canMountRenderer) return;
        setPondFirstFrameEffectsCommitted(resolveInitialFirstFrameEffectsCommitted());
        setPondStartupFirstFrameReady(false);
    }, [canMountRenderer, resolveInitialFirstFrameEffectsCommitted]);
    const releasePondFirstFrameEffects = useCallback((metadata = null, releaseReason = 'first_frame_ready') => {
        if (pondFirstFrameEffectsCommitted) return;
        setPondFirstFrameEffectsCommitted(true);
        emitZenMainBootTrace('pond_surface:first_frame_effect_budget_released', bootTraceContext, {
            reason: releaseReason,
            firstFrameEffectPolicy: pondWorkerRenderBudget.firstFrameEffectPolicy,
            yoonseulDeferredForFirstFrame,
            metadata,
        });
    }, [
        bootTraceContext,
        pondFirstFrameEffectsCommitted,
        pondWorkerRenderBudget.firstFrameEffectPolicy,
        yoonseulDeferredForFirstFrame,
    ]);
    const handleRuntimeFirstFrameReady = useCallback((metadata = null) => {
        setPondStartupFirstFrameReady(true);
        releasePondFirstFrameEffects(metadata, 'first_frame_ready');
        if (typeof onFirstVisualMilestone === 'function') {
            onFirstVisualMilestone(createZenHomeFirstVisualPondMilestoneEvent(
                ZEN_HOME_FIRST_VISUAL_MILESTONES.POND_FIRST_FRAME_CALLBACK,
                {
                    metadata,
                },
            ));
        }
        if (typeof onRuntimeFirstFrameReady === 'function') {
            onRuntimeFirstFrameReady(metadata);
        }
    }, [
        onRuntimeFirstFrameReady,
        onFirstVisualMilestone,
        releasePondFirstFrameEffects,
    ]);
    const {
        pondReadiness,
        requestInputStateSync,
    } = useZenWorkerRendererMount({
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
        visualProfile: resolvedVisualProfile,
        mousePos,
        clickPulseRef,
        onWorkerInteractionFeedback: handleWorkerInteractionFeedback,
        sessionSaltRef,
        tuningRef,
        tuning,
        lockedTarget,
        lockedTargetRef,
        hoverTarget: externalHoverDomain,
        hoverTargetRef,
        selectedFishIntentUid,
        selectedFishIntentUidRef,
        invitationRegistrationEntityId: registrationEntityId,
        invitationRegistrationEntityIdRef,
        envAuthorityRef,
        envRuntimeConfigSignature,
        waterPaletteRef,
        waterPalette,
        appearanceMapRef,
        appearanceRevision,
        rendererDebugTogglesRef,
        rendererDebugToggles: normalizedRendererDebugToggles,
        sceneGenerationKeyRef,
        hardResetToken,
        sceneSessionRevision: sceneRerollRevision,
        rosterSnapshot: resolvedKoiRosterFrame,
        presentationSceneCommitKey: resolvedPresentationSceneCommitKey,
        presentationSceneRequiredVisibleFishCount,
        animationEnabled,
        onRuntimeFirstFrameReady: handleRuntimeFirstFrameReady,
        onFirstVisualMilestone,
        parkRuntimeOnUnmount,
        bootTraceContext,
    });
    workerInputSyncRef.current = requestInputStateSync;
    useEffect(() => {
        onRuntimeReadinessChange?.(pondReadiness);
    }, [onRuntimeReadinessChange, pondReadiness]);
    const pondUnderpaintStyle = useMemo(() => (
        buildZenPondUnderpaintStyle(waterPalette)
    ), [waterPalette]);

    if (!isolatedDataMode && pondDataRuntime.error) {
        throw pondDataRuntime.error;
    }

    return (
        <ZenSignalScannerView
            className={className}
            frameVariant={frameVariant}
            containerRef={containerRef}
            viewportRef={viewportTargetRef}
            backgroundHostRef={backgroundHostRef}
            foregroundHostRef={foregroundHostRef}
            interactionSurfaceRef={interactionSurfaceRef}
            hoveredDomain={hoveredDomain}
            hoveredAction={hoveredAction}
            invitationInteractive={resolvedKoiRosterFrame.items.some((item) => item.interactionAction === 'register_protected_site'
                && invitationEntityIds.includes(item.entityId))}
            invitationRegistrationActive={registrationEntityId !== null}
            invitationPresentationVisible={isTabActive && documentVisible && pondReadiness.firstFrameCommitted}
            invitationGuidance={invitationGuidance}
            invitationHint={invitationGuidance === null ? ''
                : guidanceT(invitationGuidance.item.copyKey, invitationGuidance.item.copyOptions)}
            invitationApproachHint={mainT(invitationCapacityFull
                ? 'invitation_koi.boundary_approach_hint' : 'invitation_koi.approach_hint')}
            onInvitationKoiActivate={() => {
                const slot = resolvedKoiRosterFrame.items.find(item => item.interactionAction === 'register_protected_site'
                    && invitationEntityIds.includes(item.entityId));
                if (slot && typeof onInvitationKoiActivate === 'function') onInvitationKoiActivate(slot.entityId);
            }}
            handlePointerMove={handlePointerMove}
            handlePointerDown={handlePointerDown}
            handlePointerLeave={handlePointerLeave}
            pondReadiness={pondReadiness}
            pondUnderpaintStyle={pondUnderpaintStyle}
            showSwimModelBadge={showSwimModelBadge}
            showRerollControls={showRerollControls}
            swimModelBadge={swimModelBadge}
            activeDomainForReroll={activeDomainForReroll}
            domainBadgeText={domainBadgeText}
            domainSelectPromptText={domainSelectPromptText}
            rerollWithinLabel={rerollWithinLabel}
            rerollBreedLabel={rerollBreedLabel}
            rerollAllColorLabel={rerollAllColorLabel}
            rerollAllBreedLabel={rerollAllBreedLabel}
            rerollSceneLabel={rerollSceneLabel}
            handleRerollWithinBreed={handleRerollWithinBreed}
            handleRerollBreed={handleRerollBreed}
            handleRerollAllColor={handleRerollAllColor}
            handleRerollAllBreed={handleRerollAllBreed}
            handleRerollScene={handleRerollScene}
            canRerollAll={resolvedKoiRosterFrame.items.length > 0}
            waterEffectsDebugPanel={waterEffectsDebugPanel}
        />
    );
}
