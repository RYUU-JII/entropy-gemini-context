import {
    accumulateBoundedDrift,
    resolveDriftWrapSpan,
} from '../../../../runtime/core/zenDriftAccumulator.js';

export const updateCausticPass = ({
    frame,
    deltaFrames,
    sunAngle,
    temporalDirectionalAngle,
    temporalDirectionalDrift,
    temporalFlowTransport,
    unifiedWaveEnergy,
    unifiedWindIntensity,
    causticTextureSize,
    causticLayerPrimary,
    causticLayerSecondary,
    causticDriftState,
    driftWrapBaseSpan,
}) => {
    const size = causticTextureSize;
    const causticFlowAngle = (sunAngle * 0.16) + (temporalDirectionalAngle * 0.42) + (temporalDirectionalDrift * 0.95);
    const causticFlowX = Math.cos(causticFlowAngle);
    const causticFlowY = Math.sin(causticFlowAngle);
    const causticCrossX = -causticFlowY;
    const causticCrossY = causticFlowX;
    const causticDriftStep = (
        0.09
        + unifiedWaveEnergy * 0.12
        + temporalFlowTransport * 0.18
    ) * (0.72 + unifiedWindIntensity * 0.34) * deltaFrames;
    const causticPulsePhase = frame * 0.00019;
    const causticTexNorm = (Math.PI * 2) / Math.max(64, size);
    const primaryScalePulse = 1 + Math.sin(causticPulsePhase + temporalDirectionalAngle * 0.8) * 0.07;
    const secondaryScalePulse = 1 + Math.cos(causticPulsePhase * 1.17 + temporalDirectionalDrift * 6.2) * 0.045;
    const primaryWarp = Math.sin(
        (causticDriftState.primaryV * causticTexNorm * 3.4)
        + (causticPulsePhase * 1.42),
    ) * (0.14 + unifiedWaveEnergy * 0.16);
    const secondaryWarp = Math.cos(
        (causticDriftState.secondaryU * causticTexNorm * 2.8)
        + (causticPulsePhase * 1.28),
    ) * (0.08 + temporalFlowTransport * 0.12);
    causticLayerPrimary.tileScale.set(1.56 * primaryScalePulse, 1.64 / primaryScalePulse);
    causticLayerSecondary.tileScale.set(1.22 * secondaryScalePulse, 1.32 / secondaryScalePulse);
    causticDriftState.primaryU = accumulateBoundedDrift(
        causticDriftState.primaryU,
        (causticFlowX * 0.84 + causticCrossX * (0.16 + primaryWarp)) * causticDriftStep,
        resolveDriftWrapSpan(driftWrapBaseSpan, Math.max(1, size / 512)),
    );
    causticDriftState.primaryV = accumulateBoundedDrift(
        causticDriftState.primaryV,
        (causticFlowY * (0.62 + primaryWarp * 0.24) + causticCrossY * 0.22) * causticDriftStep,
        resolveDriftWrapSpan(driftWrapBaseSpan, Math.max(1, size / 512)),
    );
    causticLayerPrimary.tilePosition.set(causticDriftState.primaryU, causticDriftState.primaryV);
    causticDriftState.secondaryU = accumulateBoundedDrift(
        causticDriftState.secondaryU,
        (
            -causticFlowX * 0.46 + causticCrossX * (0.24 + secondaryWarp * 0.18)
        ) * causticDriftStep * 0.92,
        resolveDriftWrapSpan(driftWrapBaseSpan, Math.max(1, size / 512)),
    );
    causticDriftState.secondaryV = accumulateBoundedDrift(
        causticDriftState.secondaryV,
        (
            causticFlowY * (0.42 + secondaryWarp * 0.16) - causticCrossY * 0.22
        ) * causticDriftStep * 0.88,
        resolveDriftWrapSpan(driftWrapBaseSpan, Math.max(1, size / 512)),
    );
    causticLayerSecondary.tilePosition.set(causticDriftState.secondaryU, causticDriftState.secondaryV);
};
