import { clamp as clampValue } from './koiMotion.js';

const DEFAULT_EVENT_NONE = 'none';
const DEFAULT_EVENT_GLIDE = 'glide';
const DEFAULT_EVENT_TURN = 'turn';
const DEFAULT_EVENT_C_TURN = 'c_turn';

const TAU = Math.PI * 2;

function smoothRange(edge0, edge1, value) {
    const x = clampValue((value - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
    return x * x * (3 - 2 * x);
}

function wrapLocal(angle) {
    let a = angle;
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
}

function finite(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

export function resolveContinuousKoiBodyBands(t) {
    const s = clampValue(t, 0, 1);
    const headLock = 1 - smoothRange(0.04, 0.28, s);
    const shoulder = smoothRange(0.08, 0.34, s) * (1 - smoothRange(0.48, 0.76, s));
    const torso = smoothRange(0.18, 0.52, s) * (1 - smoothRange(0.76, 0.98, s));
    const peduncle = smoothRange(0.56, 0.98, s);
    const waveEnvelope = Math.pow(smoothRange(0.22, 1.0, s), 1.12);
    const turnEnvelope = smoothRange(0.12, 0.42, s) * (1 - smoothRange(0.94, 1.0, s) * 0.38);
    return {
        headLock,
        shoulder,
        torso,
        peduncle,
        waveEnvelope,
        turnEnvelope,
    };
}

export function resolveContinuousKoiBodyLocalAngle(t, params = {}) {
    const bands = resolveContinuousKoiBodyBands(t);
    const stiffnessScale = clampValue(finite(params.stiffnessScale, 1), 0.6, 4.8);
    const waveAmpScale = clampValue(finite(params.waveAmpScale, 1), 0.2, 6.0);
    const speedNorm = clampValue(finite(params.speedNorm, 0), 0, 1);
    const stroke = clampValue(finite(params.stroke, 0), 0, 1);
    const turnNeed = clampValue(finite(params.turnNeed, 0), 0, 1);
    const tailWaveBlend = clampValue(finite(params.tailWaveBlend, 0), 0, 1);
    const tailIdleBlend = clampValue(finite(params.tailIdleBlend, 0), 0, 1);
    const aiTurnStrokePulse = clampValue(finite(params.aiTurnStrokePulse, 0), 0, 1.6);
    const turnRate = finite(params.turnRate, 0);
    const phase = finite(params.shapePhase, 0);
    const waveLengthScale = clampValue(finite(params.waveLengthScale, 1), 0.6, 6.0);
    const activeEvent = params.activeEvent || DEFAULT_EVENT_NONE;
    const eventTurn = params.EVENT_TURN || DEFAULT_EVENT_TURN;
    const eventGlide = params.EVENT_GLIDE || DEFAULT_EVENT_GLIDE;
    const eventCTurn = params.EVENT_C_TURN || DEFAULT_EVENT_C_TURN;
    const cTurnEnv = params.cTurnEnv || null;

    const flex = clampValue(1.18 / Math.sqrt(stiffnessScale), 0.36, 1.18);
    const phaseTravel = 4.75 / Math.sqrt(waveLengthScale);
    const pulseEnergy = 0.28 + speedNorm * 0.48 + stroke * 0.32 + aiTurnStrokePulse * 0.16;
    const waveEnergy = pulseEnergy * tailWaveBlend * (1 - tailIdleBlend * 0.52) * waveAmpScale * flex;
    const baseWave = Math.sin(phase - t * phaseTravel);
    const overtone = Math.sin(phase * 1.62 - t * phaseTravel * 1.58) * 0.18;
    const localWave = (baseWave + overtone)
        * bands.waveEnvelope
        * waveEnergy
        * 0.086;

    const turnAbs = Math.abs(turnRate);
    const turnSign = Math.sign(turnRate) || 0;
    const turnIntent = clampValue(turnAbs * 10.5 + turnNeed * 0.72 + aiTurnStrokePulse * 0.16, 0, 1.65);
    let turnCurve = -turnSign
        * bands.turnEnvelope
        * turnIntent
        * (0.052 + speedNorm * 0.012)
        * flex;
    if (activeEvent === eventTurn) {
        turnCurve *= 1.22;
    } else if (activeEvent === eventGlide) {
        turnCurve *= 0.72;
    }

    const tailFollow = turnRate * bands.peduncle * (0.28 + speedNorm * 0.2 + aiTurnStrokePulse * 0.18);
    let cTurnCurl = 0;
    if (activeEvent === eventCTurn && cTurnEnv) {
        const cSign = Math.sign(finite(params.cTurnDirection, 0) || turnRate || 1);
        const snapPower = clampValue(finite(cTurnEnv.snapPower, 0), 0, 1.4);
        const waveGain = clampValue(finite(cTurnEnv.waveGain, 0.6), 0, 1.8);
        const prepareBias = cTurnEnv.phase === 'prepare' ? 1 : 0.42;
        cTurnCurl = -cSign
            * Math.sin(Math.PI * t)
            * (0.08 + snapPower * 0.14 + waveGain * 0.035)
            * prepareBias
            * flex;
    }

    const shoulderRecoil = -turnRate * bands.shoulder * (0.08 + turnNeed * 0.08);
    const locked = 1 - bands.headLock * 0.86;
    const raw = (localWave + turnCurve + tailFollow + cTurnCurl + shoulderRecoil) * locked;
    const bendCap = clampValue(
        (0.048 + t * 0.102) * (activeEvent === eventCTurn ? 1.55 : 1) / (0.78 + stiffnessScale * 0.12),
        0.034,
        0.21,
    );
    return clampValue(raw, -bendCap, bendCap);
}

export function buildContinuousKoiBodySamples(params = {}) {
    const sampleCount = Math.max(2, Math.floor(finite(params.sampleCount, 2)));
    const segmentSpacing = Math.max(0.1, finite(params.segmentSpacing, 1));
    const heading = finite(params.heading, 0);
    const headX = finite(params.headX, 0);
    const headY = finite(params.headY, 0);
    const headAngleOffset = finite(params.headAngleOffset, 0);
    const samples = Array.from({ length: sampleCount }, () => ({ x: 0, y: 0, angle: 0, localAngle: 0 }));
    samples[0].x = headX;
    samples[0].y = headY;
    samples[0].angle = heading + headAngleOffset;
    samples[0].localAngle = headAngleOffset;

    for (let i = 1; i < sampleCount; i += 1) {
        const t = i / Math.max(1, sampleCount - 1);
        const localAngle = resolveContinuousKoiBodyLocalAngle(t, params);
        const angle = heading + localAngle;
        const prev = samples[i - 1];
        samples[i].x = prev.x - Math.cos(angle) * segmentSpacing;
        samples[i].y = prev.y - Math.sin(angle) * segmentSpacing;
        samples[i].angle = angle;
        samples[i].localAngle = localAngle;
    }

    return samples;
}

export function resolveContinuousKoiAppendagePose(params = {}) {
    const speedNorm = clampValue(finite(params.speedNorm, 0), 0, 1);
    const stroke = clampValue(finite(params.stroke, 0), 0, 1);
    const turnRate = finite(params.turnRate, 0);
    const tailWaveBlend = clampValue(finite(params.tailWaveBlend, 0), 0, 1);
    const tailIdleBlend = clampValue(finite(params.tailIdleBlend, 0), 0, 1);
    const cTurnEnv = params.cTurnEnv || null;
    const cTurnSnap = clampValue(finite(cTurnEnv?.snapPower, 0), 0, 1.4);
    const brake = clampValue(finite(params.brake, 0), 0, 1);
    const turnAbs = Math.abs(turnRate);
    const pectoralBrake = clampValue(brake * 0.72 + turnAbs * 4.8 + cTurnSnap * 0.32, 0, 1);
    return {
        model: 'continuous_body_v1',
        tailFan: clampValue(0.12 + tailWaveBlend * 0.34 + stroke * 0.2 + turnAbs * 4.2 + cTurnSnap * 0.42, 0, 1),
        tailFold: clampValue(tailIdleBlend * 0.22 + (1 - tailWaveBlend) * 0.08, 0, 0.34),
        tailKick: clampValue(Math.abs(Math.sin(finite(params.propulsionPhase, 0))) * tailWaveBlend, 0, 1),
        pectoralBrake,
        pectoralDrive: clampValue(0.18 + speedNorm * 0.42 + stroke * 0.34, 0, 1),
        bodyFlex: clampValue(turnAbs * 7.5 + tailWaveBlend * 0.28 + cTurnSnap * 0.48, 0, 1),
    };
}

export function applyContinuousKoiBodyPose(self, params = {}) {
    const h = self.history;
    const activeEvent = params.activeEvent || DEFAULT_EVENT_NONE;
    const eventGlide = params.EVENT_GLIDE || DEFAULT_EVENT_GLIDE;
    const waveAmpScale = clampValue(finite(params.waveAmpScale, 1), 0.2, 6.0);
    const turnNeed = clampValue(finite(params.turnNeed, 0), 0, 1);
    const eventHeadSwayGain = finite(params.eventHeadSwayGain, 1);
    const eventHeadTurnLeadGain = finite(params.eventHeadTurnLeadGain, 1);
    const headCounterOsc = -Math.sin(finite(self.shapePhase, 0));
    const headSwimYaw = headCounterOsc
        * (0.007 + self.tailWaveBlend * 0.019)
        * (1 - self.tailIdleBlend * 0.68)
        * eventHeadSwayGain;
    const headTurnLead = self.turnRate * (0.2 + turnNeed * 0.46) * eventHeadTurnLeadGain;
    const headYaw = finite(params.headYaw, 0);
    const headNormalX = Math.cos(self.bodyHeading - Math.PI / 2);
    const headNormalY = Math.sin(self.bodyHeading - Math.PI / 2);
    const headForwardX = Math.cos(self.bodyHeading);
    const headForwardY = Math.sin(self.bodyHeading);
    const headLateralSway = clampValue(
        (
            headTurnLead * (0.44 + turnNeed * 0.7)
            + headSwimYaw * 0.76
        ) * self.segmentSpacing * (0.76 + waveAmpScale * 0.055),
        -self.segmentSpacing * 0.68,
        self.segmentSpacing * 0.68,
    );
    const headForwardBob = Math.sin(self.propulsionPhase - Math.PI * 0.38)
        * self.segmentSpacing
        * (activeEvent === eventGlide ? 0.028 : 0.064)
        * (0.18 + self.tailWaveBlend);
    const headX = self.x
        + finite(params.shoulderOffsetX, 0)
        + headNormalX * headLateralSway
        + headForwardX * headForwardBob;
    const headY = self.y
        + finite(params.shoulderOffsetY, 0)
        + headNormalY * headLateralSway
        + headForwardY * headForwardBob;

    const samples = buildContinuousKoiBodySamples({
        ...params,
        sampleCount: h.length,
        segmentSpacing: self.segmentSpacing,
        heading: self.bodyHeading,
        headX,
        headY,
        headAngleOffset: headYaw + headSwimYaw + headTurnLead,
        shapePhase: self.shapePhase,
        propulsionPhase: self.propulsionPhase,
        turnRate: self.turnRate,
        tailWaveBlend: self.tailWaveBlend,
        tailIdleBlend: self.tailIdleBlend,
        aiTurnStrokePulse: self.aiTurnStrokePulse,
        brake: self.brake,
        cTurnDirection: self.cTurnDirection,
        waveLengthScale: params.phys?.wavelengthScale,
    });

    h[0].x = samples[0].x;
    h[0].y = samples[0].y;
    h[0].angle = samples[0].angle;
    self.tailWaveMemory[0] = 0;
    self.segmentWave[0] = 0;

    for (let i = 1; i < h.length; i += 1) {
        const sample = samples[i];
        h[i].x = sample.x;
        h[i].y = sample.y;
        h[i].angle = sample.angle;
        const prevLocal = finite(samples[i - 1]?.localAngle, 0);
        const wave = wrapLocal(sample.localAngle - prevLocal);
        self.tailWaveMemory[i] = wave;
        self.segmentWave[i] = wave;
    }

    self.appendagePose = resolveContinuousKoiAppendagePose({
        ...params,
        turnRate: self.turnRate,
        speedNorm: params.speedNorm,
        stroke: params.stroke,
        tailWaveBlend: self.tailWaveBlend,
        tailIdleBlend: self.tailIdleBlend,
        propulsionPhase: self.propulsionPhase,
        brake: self.brake,
    });

    return {
        history: h,
        headLateralSway,
    };
}
