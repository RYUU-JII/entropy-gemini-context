import { nowMs, smooth } from './zenSimUtils.js';
import { createZenSimSystemRegistry } from './zenSimSystemRegistry.js';
import { createZenSurfaceDisturbanceSystem } from '../systems/zenSurfaceDisturbanceSystem.js';
import { createZenFishSimulationSystem } from '../systems/zenFishSimulationSystem.js';
import { createZenAmbientSimulationSystem } from '../systems/zenAmbientSimulationSystem.js';

export const createZenSignalScannerSimKernel = ({
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
} = {}) => {
    const registry = createZenSimSystemRegistry();
    const systems = [
        createZenSurfaceDisturbanceSystem({
            width,
            height,
            surfaceDisturbancesRef,
            surfaceDisturbanceTelemetryRef,
            rendererDebugTogglesRef,
            surfaceDisturbanceEventsRef,
            frameStateRef,
        }),
        createZenFishSimulationSystem({
            width,
            height,
            qualityProfile,
            fishRef,
            activityProfileByDomainRef,
            surfaceDisturbancesRef,
            surfaceDisturbanceTelemetryRef,
            rendererDebugTogglesRef,
            interactionStimuliRef,
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
        }),
        createZenAmbientSimulationSystem({
            width,
            height,
            qualityProfile,
            fishRef,
            surfaceDisturbancesRef,
            surfaceDisturbanceTelemetryRef,
            rendererDebugTogglesRef,
            lilyPadsRef,
            waterLilyRef,
            zenIrisClustersRef,
            particlesRef,
            petalsRef,
            glimmersRef,
            tuningRef,
            frameStateRef,
            envStateRef,
        }),
    ];
    for (let i = 0; i < systems.length; i += 1) {
        registry.register(systems[i]);
    }

    const onSimStep = ({ simStepSec, simTimeMs, elapsedMs }) => {
        const simStartMs = nowMs();
        runtimeStats.frameCount += 1;
        const simStepCount = runtimeStats.frameCount;
        registry.stepAll({
            simStepSec,
            simTimeMs,
            elapsedMs,
            simStepCount,
            frameCount: simStepCount,
        });
        const simCostMs = Math.max(0, nowMs() - simStartMs);
        runtimeStats.smoothedSimMs = smooth(runtimeStats.smoothedSimMs, simCostMs, 0.18);
    };

    return {
        onSimStep,
        setWorldSize: (nextWidth, nextHeight) => {
            for (const system of systems) system.setWorldSize(nextWidth, nextHeight);
        },
        registerSystem: registry.register,
        unregisterSystem: registry.unregister,
        dispose: registry.dispose,
    };
};
