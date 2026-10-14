import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { createZenSignalScannerSimCore } from './zenSignalScannerSimCore.js';

const PERF_EMIT_INTERVAL_MS = 280;
const nowMs = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
};
const smooth = (current, next, alpha) => {
    if (!Number.isFinite(current) || current <= 0) return next;
    return current + ((next - current) * alpha);
};

export function mountZenSignalScannerRuntimeLoop({
    width,
    height,
    shouldAnimate,
    frameScheduler = 'auto',
    startupFrameWatchdogMs = null,
    isStartupFramePending = null,
    onStartupFrameSchedulerFallback = null,
    animationEnabledRef,
    qualityProfile,
    fishRef,
    activityProfileByDomainRef,
    surfaceDisturbancesRef,
    surfaceDisturbanceTelemetryRef,
    surfaceDisturbanceEventsRef,
    interactionStimuliRef,
    lilyPadsRef,
    waterLilyRef,
    zenIrisClustersRef,
    particlesRef,
    petalsRef,
    glimmersRef,
    mousePos,
    commonEnvContextRef,
    viewportSizeRef,
    sessionSaltRef,
    tuningRef,
    hoveredDomainRef,
    lockedTargetRef,
    selectedFishUidRef,
    invitationRegistrationEntityIdRef,
    frameStateRef,
    envStateRef,
    rendererDebugTogglesRef,
    onPerformanceSample = null,
    onAfterRender = null,
}) {
    if (!width || !height) return undefined;
    const targetFps = Math.max(1, Number(qualityProfile?.targetFps) || 60);
    const collectPerformanceSample = typeof onPerformanceSample === 'function';
    const runtimeStats = {
        frameCount: 0,
        lastRenderTimestamp: 0,
        smoothedFrameMs: 1000 / targetFps,
        smoothedSimMs: 0,
        smoothedDrawMs: 0,
        lastPerfEmitTimestamp: 0,
    };

    const simCore = createZenSignalScannerSimCore({
        width,
        height,
        qualityProfile,
        fishRef,
        activityProfileByDomainRef,
        surfaceDisturbancesRef,
        surfaceDisturbanceTelemetryRef,
        surfaceDisturbanceEventsRef,
        interactionStimuliRef,
        lilyPadsRef,
        waterLilyRef,
        zenIrisClustersRef,
        particlesRef,
        petalsRef,
        glimmersRef,
        mousePos,
        commonEnvContextRef,
        viewportSizeRef,
        sessionSaltRef,
        tuningRef,
        hoveredDomainRef,
        lockedTargetRef,
        selectedFishUidRef,
        invitationRegistrationEntityIdRef,
        frameStateRef,
        envStateRef,
        rendererDebugTogglesRef,
        runtimeStats,
    });

    const emitPerformanceSample = (timestampMs) => {
        if (!collectPerformanceSample) return;
        if ((timestampMs - runtimeStats.lastPerfEmitTimestamp) < PERF_EMIT_INTERVAL_MS) return;
        runtimeStats.lastPerfEmitTimestamp = timestampMs;
        try {
            onPerformanceSample({
                fps: runtimeStats.smoothedFrameMs > 0.001 ? (1000 / runtimeStats.smoothedFrameMs) : 0,
                frameMs: runtimeStats.smoothedFrameMs,
                simMs: runtimeStats.smoothedSimMs,
                drawMs: runtimeStats.smoothedDrawMs,
                fishCount: fishRef.current.length,
                surfaceDisturbanceCount: surfaceDisturbancesRef.current.length,
                particleCount: particlesRef.current.length,
                glimmerCount: glimmersRef.current.length,
            });
        } catch (_) {
        }
    };

    const stopLoop = runRenderLoop({
        enabled: true,
        frameScheduler,
        startupFrameWatchdogMs,
        isStartupFramePending,
        onStartupFrameSchedulerFallback,
        pausedFrameIntervalMs: 250,
        isPaused: () => {
            if (animationEnabledRef && typeof animationEnabledRef === 'object') {
                return animationEnabledRef.current === false;
            }
            return !shouldAnimate;
        },
        simHz: qualityProfile.simHz ?? 60,
        targetFps: qualityProfile.targetFps,
        maxCatchUpSteps: qualityProfile.maxCatchUpSteps ?? 10,
        onSimStep: simCore.onSimStep,
        onRender: (payload) => {
            if (!collectPerformanceSample) {
                if (typeof onAfterRender === 'function') {
                    onAfterRender(payload);
                }
                return;
            }
            const renderStartMs = nowMs();
            if (typeof onAfterRender === 'function') {
                onAfterRender(payload);
            }
            const renderEndMs = nowMs();
            const drawCostMs = Math.max(0, renderEndMs - renderStartMs);
            runtimeStats.smoothedDrawMs = smooth(runtimeStats.smoothedDrawMs, drawCostMs, 0.22);
            if (runtimeStats.lastRenderTimestamp > 0) {
                const frameDeltaMs = Math.max(0.001, renderEndMs - runtimeStats.lastRenderTimestamp);
                runtimeStats.smoothedFrameMs = smooth(runtimeStats.smoothedFrameMs, frameDeltaMs, 0.2);
            }
            runtimeStats.lastRenderTimestamp = renderEndMs;
            emitPerformanceSample(renderEndMs);
        },
    });

    const stop = () => {
        stopLoop?.();
        simCore?.dispose?.();
    };
    stop.wake = () => {
        stopLoop?.wake?.();
    };
    stop.stop = stop;
    stop.setWorldSize = simCore.setWorldSize;

    return stop;
}
