import { useRef } from 'react';

import { useResizeObserver } from '@/ui-kit/hooks/useResizeObserver';
import { useZenClassicWorkspaceInteractionRuntime } from './useZenClassicWorkspaceInteractionRuntime';
import { useZenClassicWorkspaceSessionRuntime } from './useZenClassicWorkspaceSessionRuntime';
import { useZenClassicWorkspaceViewRuntime } from './useZenClassicWorkspaceViewRuntime';
export {
    resolveZenClassicBonsaiPixelRatioCap,
    resolveZenClassicBonsaiRenderBackend,
    resolveZenClassicBonsaiCadenceContext,
    resolveZenClassicBonsaiRenderLoopMode,
    resolveZenClassicBonsaiTargetFps,
    resolveZenClassicCameraPreset,
    resolveZenClassicExperimentGardenBedLayoutFrame,
    resolveZenClassicExperimentBonsaiGrowthModel,
    resolveZenClassicHomeBonsaiGrowthModel,
    resolveZenClassicLabInspectorVisible,
    resolveZenClassicMainRenderQuality,
    resolveZenClassicRenderSurfaceMeasurement,
    resolveZenClassicWorkspaceLayoutClassName,
} from './zenClassicWorkspaceRuntimeConfig';

export function useZenClassicWorkspaceRuntime({
    experimental = false,
    labRuntimeActive = experimental,
    embedded = false,
    homeEmbedded = false,
    solarLocationProfile = null,
    bonsaiLifecycleInput = null,
    bonsaiGrowthLabControls = null,
    bonsaiGrowthModel = null,
}) {
    // Full interactive runtime owner for the classic experiment workspace.
    // Main/home rendering now goes through a lighter runtime seam.
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const abCanvasRefA = useRef(null);
    const abCanvasRefB = useRef(null);
    const abContainerRefA = useRef(null);
    const abContainerRefB = useRef(null);
    const mainViewportRef = useRef(null);
    const frameId = useRef(null);
    const treeCacheRef = useRef(null);
    const lastCacheKey = useRef('');

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
    const {
        width: abWidthA,
        height: abHeightA,
        targetRef: abContainerTargetRefA,
    } = useResizeObserver(abContainerRefA);
    const {
        width: abWidthB,
        height: abHeightB,
        targetRef: abContainerTargetRefB,
    } = useResizeObserver(abContainerRefB);

    const renderWidth = mainViewportWidth || width || 1;
    const renderHeight = mainViewportHeight || height || 1;
    const sessionRuntime = useZenClassicWorkspaceSessionRuntime({
        experimental,
        labRuntimeActive,
        renderWidth,
        renderHeight,
        bonsaiLifecycleInput,
        bonsaiGrowthModel,
    });
    const interactionRuntime = useZenClassicWorkspaceInteractionRuntime({
        experimental,
        labRuntimeActive,
        renderWidth,
        renderHeight,
        sessionRuntime,
    });

    return useZenClassicWorkspaceViewRuntime({
        experimental,
        embedded,
        homeEmbedded,
        solarLocationProfile,
        bonsaiGrowthLabControls,
        refs: {
            canvasRef,
            containerRef: containerTargetRef,
            abCanvasRefA,
            abCanvasRefB,
            abContainerRefA: abContainerTargetRefA,
            abContainerRefB: abContainerTargetRefB,
            mainViewportRef: mainViewportTargetRef,
            frameId,
            treeCacheRef,
            lastCacheKey,
        },
        dimensions: {
            renderWidth,
            renderHeight,
            abWidthA,
            abHeightA,
            abWidthB,
            abHeightB,
        },
        sessionRuntime,
        interactionRuntime,
    });
}

export default useZenClassicWorkspaceRuntime;
