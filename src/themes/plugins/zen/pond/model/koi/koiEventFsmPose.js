import { clamp as clampValue } from './koiMotion.js';
import { KOI_EVENT_TRAILING_WAVELENGTH_LIMITS } from './koiEventMotionLimits.js';

export function applyEventBodyPose(self, params = {}) {
    const {
        coreSegment = 0.34,
        phys = {},
        eventHeadSwayGain = 1,
        eventHeadTurnLeadGain = 1,
        turnNeed = 0,
        waveAmpScale = 1,
        shoulderOffsetX = 0,
        shoulderOffsetY = 0,
        inertiaScale = 1,
        speedNorm = 0,
        stroke = 0.5,
        wrapTurn,
        stiffnessScale = 1,
        activeEvent = 'none',
    } = params;

    const h = self.history;
    const coreIndex = Math.max(1, Math.min(h.length - 2, Math.round((h.length - 1) * coreSegment)));
    const coreT = coreIndex / Math.max(1, h.length - 1);
    const waveLengthScale = clampValue(phys.wavelengthScale ?? 1,
        KOI_EVENT_TRAILING_WAVELENGTH_LIMITS.min, KOI_EVENT_TRAILING_WAVELENGTH_LIMITS.max);
    const phaseTravel = 4.0 / Math.sqrt(waveLengthScale);
    const headCounterOsc = -Math.sin(self.shapePhase);
    const headSwimYaw = headCounterOsc
        * (0.011 + self.tailWaveBlend * 0.029)
        * (1 - self.tailIdleBlend * 0.62)
        * eventHeadSwayGain;
    const headTurnLead = self.turnRate * (0.22 + turnNeed * 0.38) * eventHeadTurnLeadGain;
    const headNormalX = Math.cos(self.bodyHeading - Math.PI / 2);
    const headNormalY = Math.sin(self.bodyHeading - Math.PI / 2);
    const headForwardX = Math.cos(self.bodyHeading);
    const headForwardY = Math.sin(self.bodyHeading);
    const headLateralSway = clampValue(
        (
            headTurnLead * (0.48 + turnNeed * 0.66)
            + headSwimYaw * 0.85
        ) * self.segmentSpacing * (0.82 + waveAmpScale * 0.08),
        -self.segmentSpacing * 0.72,
        self.segmentSpacing * 0.72,
    );
    const headForwardBob = Math.sin(self.propulsionPhase - Math.PI * 0.35) * self.segmentSpacing * 0.08 * (0.22 + self.tailWaveBlend);
    const headYaw = params.headYaw || 0;
    h[0].x = self.x + shoulderOffsetX + headNormalX * headLateralSway + headForwardX * headForwardBob;
    h[0].y = self.y + shoulderOffsetY + headNormalY * headLateralSway + headForwardY * headForwardBob;
    h[0].angle = self.bodyHeading + headYaw + headSwimYaw + headTurnLead;

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
                0.34
                + speedNorm * 0.54
                + stroke * 0.34
                + (self.aiTurnStrokePulse || 0) * 0.18
            ) * self.tailWaveBlend * waveAmpScale;
            const distFromCore = t - coreT;
            const rearDist = Math.max(0, distFromCore);
            const coreBand = Math.exp(-Math.abs(distFromCore) * 5.8);
            const coreCounterWave = headCounterOsc * coreBand * (0.036 + (isFront ? frontAmp : rearAmp) * 0.18);
            const frontHoldWave = headCounterOsc * (frontAmp * waveEnergy * 0.62);
            const rearTravelWave = Math.sin(self.shapePhase - rearDist * phaseTravel) * (rearAmp * waveEnergy);
            const midBridgeWave = Math.sin(self.shapePhase - rearDist * (phaseTravel * 0.58)) * (0.014 + rearNorm * 0.05) * waveEnergy;
            const rawWave = (isFront ? frontHoldWave : rearTravelWave) + coreCounterWave + midBridgeWave;

            const prevWave = self.tailWaveMemory[i] || 0;
            const maxDelta = (0.01 + t * 0.05) / (0.78 + stiffnessScale * 0.22);
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
        const counterBend = -self.turnRate * (1.3 + (self.aiTurnStrokePulse || 0) * 0.66) * counterBlend;
        const targetSpineAngle = baseTarget + counterBend + waveOffset;
        let delta = wrapTurn ? wrapTurn(targetSpineAngle - prev.angle) : (targetSpineAngle - prev.angle);

        // Controlled bend limits - tuned so tail has elastic tension, neither stiff nor jelly
        let bendCap = i <= self.neckIndex ? 0.075 : 0.088 + t * 0.052;
        if (activeEvent === 'glide') bendCap *= 0.88;
        if (activeEvent === 'turn') bendCap *= 1.14;
        if (activeEvent === 'c_turn') bendCap *= 1.45;
        bendCap *= 1 / (0.8 + stiffnessScale * 0.22);
        bendCap *= 1 - speedNorm * 0.2;
        bendCap = clampValue(bendCap, 0.035, 0.18);
        delta = clampValue(delta, -bendCap, bendCap);

        p.angle = prev.angle + delta;
        p.x = prev.x - Math.cos(p.angle) * self.segmentSpacing;
        p.y = prev.y - Math.sin(p.angle) * self.segmentSpacing;
    }

    if (!self.eventBodyFrame) {
        self.eventBodyFrame = {
            centerline: h,
            displayedBend: h[0].angle - h[h.length - 1].angle,
            maneuver: {
                active: false,
                kind: activeEvent === 'none' ? 'cruise' : activeEvent,
                progress: 1,
                serial: 0,
                pendingTurn: 0,
                sweepBias: 0,
                glideKick: false,
            },
        };
    } else {
        self.eventBodyFrame.centerline = h;
        self.eventBodyFrame.displayedBend = h[0].angle - h[h.length - 1].angle;
    }

    return {
        history: h,
        headLateralSway,
    };
}

export function buildEventDebugInfo(params = {}) {
    const {
        self,
        cTurnEnv,
        cycleRate,
        netDrive,
        flowGain,
        headingError,
        canRecoverSpin,
        forwardSpeed,
        headLateralSway,
        eventHeadYawGain,
        eventHeadTurnLeadGain,
        eventHeadSwayGain,
        eventHeadPivotFollow,
        finFlutterSpeed,
        swimFrequencyGain,
        eventPropulsionGain,
        behaviorIntent,
        normalized,
        debugModelName,
    } = params;

    const frame = self.eventBodyFrame;
    const motor = frame?.maneuver;

    return {
        model: debugModelName || (behaviorIntent?.enabled === true ? 'event-fsm-life' : 'event-fsm'),
        mode: self.actionState,
        cTurn: cTurnEnv ? cTurnEnv.phase : 'none',
        speed: self.lastSpeed,
        throttle: self.manualThrottle,
        brake: self.brake,
        turnRate: self.turnRate,
        cycleRate,
        waveBlend: self.tailWaveBlend,
        output: netDrive,
        flowGain,
        turnAcc: Math.abs(headingError),
        turnRef: self.turnStrokeCooldown || 0,
        turnCommit: self.decisionTimer || 0,
        strokeKind: motor ? motor.kind : null,
        strokeProgress: motor ? motor.progress : null,
        strokeSequence: motor ? motor.serial : null,
        strokePendingTurn: motor ? motor.pendingTurn : null,
        strokeBias: motor ? motor.sweepBias : null,
        strokeGlideKick: motor ? motor.glideKick : false,
        turnAuthority: canRecoverSpin ? 1 : 0,
        spinStall: self.spinStallTimer,
        forwardSpeed,
        headSway: headLateralSway,
        eventHeadYawGain,
        eventHeadTurnLeadGain,
        eventHeadSwayGain,
        eventHeadPivotFollow,
        finFlutterSpeed,
        swimFrequencyGain,
        eventPropulsionGain,
        intentKind: behaviorIntent?.kind || 'none',
        intentThrottleBias: Number(behaviorIntent?.throttleBias) || 0,
        intentHeadingWeight: Number(behaviorIntent?.headingVector?.weight) || 0,
        intentDecisionCadenceScale: Number(behaviorIntent?.decisionCadenceScale) || 1,
        microGoalKind: behaviorIntent?.microGoal?.kind || 'none',
        microGoalPhase: behaviorIntent?.microGoal?.phase || 'none',
        microGoalProgress: Number(behaviorIntent?.microGoal?.progress) || 0,
        microGoalDistance: Number(behaviorIntent?.microGoal?.distance) || 0,
        microGoalTargetX: Number(behaviorIntent?.microGoal?.target?.x) || 0,
        microGoalTargetY: Number(behaviorIntent?.microGoal?.target?.y) || 0,
        globalActivity: normalized?.globalActivityScale ?? 1,
        sleepBlend: normalized?.sleepBlend ?? self.sleepBlend ?? 0,
        finalActivity: normalized?.activationScore ?? 1,
        normTargetSpeed: normalized?.targetSpeed,
        normSpeed: normalized?.calibratedSpeed,
        normSlipDeg: normalized?.slipDeg,
        normSlipLimitDeg: normalized?.slipLimitDeg,
    };
}
