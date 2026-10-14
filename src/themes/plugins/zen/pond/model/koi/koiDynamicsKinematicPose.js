import { clamp as clampValue } from './koiMotion.js';

export function applyKinematicBodyPose(self, params = {}) {
    const {
        coreSegment,
        wavelengthScale,
        tailStroke,
        waveAmpScale,
        hybridHeadSwayGain,
        shoulderOffsetX,
        shoulderOffsetY,
        hybridRearWaveGain,
        aiWaveScale,
        stiffnessScale,
        wrapTurn,
    } = params;

    const h = self.history;
    const coreT = clampValue(coreSegment, 0.02, 0.55);
    const phaseTravel = 5.2 / Math.pow(wavelengthScale, 0.82);
    const headForwardX = Math.cos(self.bodyHeading);
    const headForwardY = Math.sin(self.bodyHeading);
    const headNormalX = Math.cos(self.bodyHeading - Math.PI / 2);
    const headNormalY = Math.sin(self.bodyHeading - Math.PI / 2);
    const headLateralSway = clampValue(
        (
            self.kHybridCurvature * (0.18 + self.kHybridAmp * 0.32)
            - tailStroke * (0.018 + self.kHybridAmp * 0.012)
        )
            * self.segmentSpacing
            * (0.9 + waveAmpScale * 0.18)
            * hybridHeadSwayGain,
        -self.segmentSpacing * 0.62,
        self.segmentSpacing * 0.62,
    );
    const headForwardBob = Math.sin(self.kHybridPhase - Math.PI * 0.35) * self.segmentSpacing * 0.07 * (0.28 + self.kHybridAmp);
    const headYaw = params.headCounterYaw + self.kHybridCurvature * 0.026 + self.turnRate * 0.38;

    h[0].x = self.x + shoulderOffsetX + headNormalX * headLateralSway + headForwardX * headForwardBob;
    h[0].y = self.y + shoulderOffsetY + headNormalY * headLateralSway + headForwardY * headForwardBob;
    h[0].angle = self.bodyHeading + headYaw;
    self.segmentWave[0] = 0;
    self.tailWaveMemory[0] = 0;

    for (let i = 1; i < h.length; i++) {
        const t = i / (h.length - 1);
        const rearNorm = clampValue((t - coreT) / Math.max(1e-6, 1 - coreT), 0, 1);
        const frontNorm = clampValue((coreT - t) / Math.max(1e-6, coreT), 0, 1);

        const rearEnvelope = Math.pow(rearNorm, 1.16);
        const wave = Math.sin(self.kHybridPhase - t * phaseTravel)
            * self.kHybridAmp
            * (0.018 + rearEnvelope * 0.32 * hybridRearWaveGain)
            * (0.72 + waveAmpScale * 0.24 + aiWaveScale * 0.18);

        const bodyCurve = self.kHybridCurvature * (0.24 + (1 - t) * 0.34);
        const frontCounter = -tailStroke * frontNorm * 0.028;
        const targetSpineAngle = self.bodyHeading + bodyCurve + wave + frontCounter;

        const prev = h[i - 1];
        const p = h[i];
        const followAngle = Math.atan2(prev.y - p.y, prev.x - p.x);
        const followWeight = clampValue((0.54 - t * 0.18) / (0.96 + stiffnessScale * 0.08), 0.14, 0.84);
        const baseAngle = self.lerpAngle(followAngle, targetSpineAngle, followWeight);

        let delta = wrapTurn(baseAngle - prev.angle);
        const bendCap = clampValue((0.12 + t * 0.1) / (0.88 + stiffnessScale * 0.1), 0.07, 0.34);
        delta = clampValue(delta, -bendCap, bendCap);

        p.angle = prev.angle + delta;
        p.x = prev.x - Math.cos(p.angle) * self.segmentSpacing;
        p.y = prev.y - Math.sin(p.angle) * self.segmentSpacing;
        self.segmentWave[i] = wave;
        self.tailWaveMemory[i] = wave;
    }

    return {
        history: h,
        phaseTravel,
        headLateralSway,
    };
}

export function buildKinematicDebugInfo(params = {}) {
    const {
        self,
        netDrive,
        flowGain,
        headingError,
        curvatureTarget,
        speedScale,
        simStepScale,
        finFlutterSpeed,
        swimSpeedInput,
        swimScale,
        waveAmpScale,
        wavelengthScale,
        stiffnessScale,
        phaseTravel,
        headLateralSway,
        slipDeg,
        slipLimitDeg,
        arcDrive,
        turnAuthority,
        hybridCurvatureGain,
        hybridTurnResponse,
        hybridThrustGain,
        hybridRearWaveGain,
        hybridCounterYawGain,
        hybridHeadSwayGain,
        normalized,
    } = params;

    return {
        model: 'kinematic-hybrid',
        mode: self.actionState,
        cTurn: 'none',
        speed: self.lastSpeed,
        throttle: self.manualThrottle,
        brake: self.brake,
        turnRate: self.turnRate,
        cycleRate: self.kHybridOmega,
        waveBlend: self.tailWaveBlend,
        output: netDrive,
        flowGain,
        turnAcc: Math.abs(headingError),
        turnRef: self.kHybridCurvature,
        turnCommit: curvatureTarget,
        preset: 'kinematic',
        speedScale,
        simStepScale,
        finFlutterSpeed,
        swimSpeedInput,
        swimScale,
        waveAmp: waveAmpScale,
        waveLen: wavelengthScale,
        spineStiffness: stiffnessScale,
        phaseTravel,
        headSway: headLateralSway,
        slipDeg,
        slipLimitDeg,
        arcDrive,
        cpgAmp: self.kHybridAmp,
        cpgOmega: self.kHybridOmega,
        turnAuthority,
        spinStall: self.spinStallTimer,
        globalActivity: normalized.globalActivityScale ?? 1,
        sleepBlend: normalized.sleepBlend ?? self.sleepBlend ?? 0,
        finalActivity: normalized.activationScore ?? 1,
        hybridCurvatureGain,
        hybridTurnResponse,
        hybridThrustGain,
        hybridRearWaveGain,
        hybridCounterYawGain,
        hybridHeadSwayGain,
        normTargetSpeed: normalized.targetSpeed,
        normSpeed: normalized.calibratedSpeed,
        normSlipDeg: normalized.slipDeg,
        normSlipLimitDeg: normalized.slipLimitDeg,
    };
}
