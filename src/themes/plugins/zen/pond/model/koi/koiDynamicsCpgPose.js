import { clamp as clampValue } from './koiMotion.js';

export function applyCpgBodyPose(self, params = {}) {
    const {
        coreSegment,
        phys,
        turnNeed,
        waveAmpScale,
        inertiaScale,
        speedNorm,
        stroke,
        swimFrequencyGain,
        headYaw,
        shoulderOffsetX,
        shoulderOffsetY,
        wrapTurn,
        stiffnessScale,
    } = params;

    const h = self.history;
    const coreIndex = Math.max(1, Math.min(h.length - 2, Math.round((h.length - 1) * coreSegment)));
    const coreT = coreIndex / Math.max(1, h.length - 1);
    const waveLengthScale = clampValue(phys.wavelengthScale ?? 1, 1.0, 6.0);
    const phaseTravel = 5.6 / Math.pow(waveLengthScale, 0.82);
    const coreBandSharpness = clampValue(6.6 / Math.pow(waveLengthScale, 0.52), 2.2, 7.2);
    const headCounterOsc = -Math.sin(self.shapePhase);
    const headSwimYaw = headCounterOsc * (0.011 + self.tailWaveBlend * 0.029) * (1 - self.tailIdleBlend * 0.62);
    const rearWaveSample = self.tailWaveMemory[Math.max(self.neckIndex + 1, Math.floor(h.length * 0.56))] || 0;
    const tipWaveSample = self.tailWaveMemory[h.length - 1] || 0;
    const headWaveCouple = clampValue(rearWaveSample * 0.46 + tipWaveSample * 0.24, -0.13, 0.13);
    const headTurnLead = self.turnRate * (0.22 + turnNeed * 0.32);
    const headDriftYaw = headCounterOsc * (0.006 + self.tailWaveBlend * 0.018 * (0.72 + waveAmpScale * 0.2));
    const headCompositeYaw = headYaw
        + headSwimYaw
        + headWaveCouple
        + headTurnLead
        + headDriftYaw
        + self.cpgCurvature * (0.018 + self.cpgAmplitude * 0.024);
    const headLateralSway = clampValue(
        (
            headWaveCouple * 1.6
            + self.turnRate * 1.18
            + self.cpgCurvature * (0.16 + self.cpgAmplitude * 0.28)
        ) * self.segmentSpacing * (0.85 + waveAmpScale * 0.12),
        -self.segmentSpacing * 0.62,
        self.segmentSpacing * 0.62,
    );
    const headForwardBob = Math.sin(self.propulsionPhase - Math.PI * 0.35) * self.segmentSpacing * 0.08 * (0.2 + self.tailWaveBlend);
    const headNormalX = Math.cos(self.bodyHeading - Math.PI / 2);
    const headNormalY = Math.sin(self.bodyHeading - Math.PI / 2);
    const headForwardX = Math.cos(self.bodyHeading);
    const headForwardY = Math.sin(self.bodyHeading);
    const turnArcShift = self.turnRate * self.segmentSpacing * (0.18 + self.cpgAmplitude * 0.22);
    const turnArcX = headNormalX * turnArcShift;
    const turnArcY = headNormalY * turnArcShift;

    h[0].x = self.x + shoulderOffsetX + turnArcX + headNormalX * headLateralSway + headForwardX * headForwardBob;
    h[0].y = self.y + shoulderOffsetY + turnArcY + headNormalY * headLateralSway + headForwardY * headForwardBob;
    h[0].angle = self.bodyHeading + headCompositeYaw;

    for (let i = 1; i < h.length; i++) {
        const t = i / (h.length - 1);
        const p = h[i];
        const prev = h[i - 1];
        const followAngle = Math.atan2(prev.y - p.y, prev.x - p.x);
        const frontWeight = i <= self.neckIndex ? 0.34 : 0.25 + t * 0.15;
        const followWeight = clampValue(frontWeight * (0.84 + stiffnessScale * 0.16), 0.08, 0.7);
        const baseTarget = self.lerpAngle(prev.angle, followAngle, followWeight);

        let waveOffset = 0;
        if (self.tailWaveBlend > 0.01) {
            const isFront = i <= coreIndex;
            const rearNorm = clampValue((t - coreT) / Math.max(1e-6, 1 - coreT), 0, 1);
            const frontNorm = clampValue((coreT - t) / Math.max(1e-6, coreT), 0, 1);
            const ampMass = 1 / Math.sqrt(inertiaScale);
            const frontAmp = (0.018 + Math.pow(frontNorm, 1.2) * 0.078) * ampMass;
            const rearAmp = (0.033 + Math.pow(rearNorm, 1.06) * 0.154) * ampMass;
            const waveEnergy = (
                0.26
                + speedNorm * 0.48
                + stroke * 0.32
                + Math.abs(self.cpgCurvature) * 0.26
            ) * self.tailWaveBlend * waveAmpScale * swimFrequencyGain;
            const distFromCore = t - coreT;
            const rearDist = Math.max(0, distFromCore) * clampValue(1 / Math.pow(waveLengthScale, 0.22), 0.64, 1);
            const coreBand = Math.exp(-Math.abs(distFromCore) * coreBandSharpness);
            const coreCounterWave = headCounterOsc * coreBand * (0.036 + (isFront ? frontAmp : rearAmp) * 0.18);
            const frontHoldWave = headCounterOsc * (frontAmp * waveEnergy * 0.62);
            const rearTravelWave = Math.sin(self.shapePhase - rearDist * phaseTravel) * (rearAmp * waveEnergy);
            const midBridgeWave = Math.sin(self.shapePhase - rearDist * (phaseTravel * 0.58)) * (0.014 + rearNorm * 0.05) * waveEnergy;
            const rawWave = (isFront ? frontHoldWave : rearTravelWave) + coreCounterWave + midBridgeWave;

            const prevWave = self.tailWaveMemory[i] || 0;
            const maxDelta = (
                (0.01 + t * 0.05)
                * (0.82 + waveAmpScale * 0.28)
                * (0.78 + swimFrequencyGain * 0.16)
            ) / (0.78 + stiffnessScale * 0.22);
            const limitedWave = prevWave + clampValue(rawWave - prevWave, -maxDelta, maxDelta);
            self.tailWaveMemory[i] = limitedWave;
            self.segmentWave[i] = limitedWave;
            const offsetGain = isFront ? (0.12 + frontNorm * 0.06) : (0.14 + rearNorm * 0.1);
            waveOffset = limitedWave * offsetGain;
        } else {
            self.tailWaveMemory[i] = 0;
            self.segmentWave[i] = 0;
        }

        const counterBlend = clampValue(1 - t / 0.72, 0, 1);
        const counterBend = (
            -self.turnRate * (0.16 + self.cpgAmplitude * 0.16)
            - self.cpgCurvature * (0.04 + self.cpgAmplitude * 0.06)
        ) * counterBlend;
        const targetSpineAngle = baseTarget + counterBend + waveOffset;
        let delta = wrapTurn(targetSpineAngle - prev.angle);

        let bendCap = i <= self.neckIndex ? 0.078 : 0.092 + t * 0.058;
        bendCap *= 1 / (0.82 + stiffnessScale * 0.2);
        bendCap *= (0.74 + waveAmpScale * 0.18);
        bendCap *= 1 - speedNorm * 0.16;
        bendCap = clampValue(bendCap, 0.036, 0.2);
        delta = clampValue(delta, -bendCap, bendCap);

        p.angle = prev.angle + delta;
        p.x = prev.x - Math.cos(p.angle) * self.segmentSpacing;
        p.y = prev.y - Math.sin(p.angle) * self.segmentSpacing;
    }

    return {
        history: h,
        phaseTravel,
        waveLengthScale,
        headLateralSway,
    };
}

export function buildCpgDebugInfo(params = {}) {
    const {
        self,
        cycleRate,
        netDrive,
        flowGain,
        headingError,
        kappaRef,
        presetState,
        speedScale,
        simStepScale,
        finFlutterSpeed,
        swimSpeedInput,
        swimScale,
        waveAmpScale,
        waveLengthScale,
        stiffnessScale,
        phaseTravel,
        headLateralSway,
        slipDeg,
        turnAuthority,
        normalized,
    } = params;

    return {
        model: 'cpg-dynamics',
        mode: self.actionState,
        cTurn: 'none',
        speed: self.lastSpeed,
        throttle: self.manualThrottle,
        brake: self.brake,
        turnRate: self.turnRate,
        cycleRate,
        waveBlend: self.tailWaveBlend,
        output: netDrive,
        flowGain,
        turnAcc: Math.abs(headingError),
        turnRef: self.cpgCurvature,
        turnCommit: kappaRef,
        preset: presetState,
        speedScale,
        simStepScale,
        finFlutterSpeed,
        swimSpeedInput,
        swimScale,
        waveAmp: waveAmpScale,
        waveLen: waveLengthScale,
        spineStiffness: stiffnessScale,
        phaseTravel,
        headSway: headLateralSway,
        slipDeg,
        cpgAmp: self.cpgAmplitude,
        cpgOmega: self.cpgOmega,
        turnAuthority,
        spinStall: self.spinStallTimer,
        globalActivity: normalized.globalActivityScale ?? 1,
        sleepBlend: normalized.sleepBlend ?? self.sleepBlend ?? 0,
        finalActivity: normalized.activationScore ?? 1,
        normTargetSpeed: normalized.targetSpeed,
        normSpeed: normalized.calibratedSpeed,
        normSlipDeg: normalized.slipDeg,
        normSlipLimitDeg: normalized.slipLimitDeg,
    };
}
