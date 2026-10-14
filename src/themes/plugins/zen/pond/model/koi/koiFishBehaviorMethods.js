import { sampleZenKoiSurfaceWake } from './zenKoiSurfaceWake.js';
import { clamp as clampValue, sampleCurlField } from './koiMotion.js';
import { PHYSICS_PROPS } from './constants.js';

const SLOT_MOTION_PROFILES = Object.freeze({
    hero: Object.freeze({
        speedMultiplier: 0.94,
        baseSpeed: 0.95,
        targetAngleVariation: 0.84,
        acceleration: 0.94,
        wiggleAmount: 0.92,
        wiggleSpeed: 0.95,
        flowGain: 0.95,
        roamSpan: 0.84,
    }),
    guardian: Object.freeze({
        speedMultiplier: 0.97,
        baseSpeed: 0.97,
        targetAngleVariation: 0.9,
        acceleration: 0.97,
        wiggleAmount: 0.95,
        wiggleSpeed: 0.97,
        flowGain: 0.96,
        roamSpan: 0.9,
    }),
    resident: Object.freeze({
        speedMultiplier: 1,
        baseSpeed: 1,
        targetAngleVariation: 1,
        acceleration: 1,
        wiggleAmount: 1,
        wiggleSpeed: 1,
        flowGain: 1,
        roamSpan: 1,
    }),
    scout: Object.freeze({
        speedMultiplier: 1.08,
        baseSpeed: 1.06,
        targetAngleVariation: 1.18,
        acceleration: 1.08,
        wiggleAmount: 1.05,
        wiggleSpeed: 1.08,
        flowGain: 1.04,
        roamSpan: 1.08,
    }),
});

const resolveSlotMotionProfile = (slot) => {
    if (typeof slot !== 'string') return SLOT_MOTION_PROFILES.resident;
    const normalized = slot.trim().toLowerCase();
    return SLOT_MOTION_PROFILES[normalized] || SLOT_MOTION_PROFILES.resident;
};

const koiFishBehaviorMethods = {
applySlotMotionProfile() {
    const baseline = this.slotMotionBaseline || {
        speedMultiplier: Number(this.speedMultiplier) || 1,
        baseSpeed: Number(this.baseSpeed) || 0.08,
        targetAngleVariation: Number(this.targetAngleVariation) || 0.06,
        acceleration: Number(this.acceleration) || 0.0125,
        wiggleAmount: Number(this.wiggleAmount) || 0.18,
        wiggleSpeed: Number(this.wiggleSpeed) || 0.01,
    };
    const sessionBaseline = this.sessionJitterBase || {
        flowGain: Number(this.sessionJitter?.flowGain) || 1,
        roamSpan: Number(this.sessionJitter?.roamSpan) || 0.34,
    };
    const profile = resolveSlotMotionProfile(this.slot);

    this.slotMotionBaseline = baseline;
    this.sessionJitterBase = sessionBaseline;
    this.slotMotionProfile = profile;
    this.speedMultiplier = baseline.speedMultiplier * profile.speedMultiplier;
    this.baseSpeed = baseline.baseSpeed * profile.baseSpeed;
    this.targetAngleVariation = baseline.targetAngleVariation * profile.targetAngleVariation;
    this.acceleration = baseline.acceleration * profile.acceleration;
    this.wiggleAmount = baseline.wiggleAmount * profile.wiggleAmount;
    this.wiggleSpeed = baseline.wiggleSpeed * profile.wiggleSpeed;
    if (this.sessionJitter) {
        this.sessionJitter.flowGain = sessionBaseline.flowGain * profile.flowGain;
        this.sessionJitter.roamSpan = sessionBaseline.roamSpan * profile.roamSpan;
    }
},

configureSessionJitter(sessionSalt = 0) {
    if (this.sessionSalt === sessionSalt) return;
    const domainKey = this.domain || `dummy-${Math.round(this.flowSeed * 100000)}`;
    const seed = this.hashString(`${domainKey}|${sessionSalt}`);
    const rng = this.makeRng(seed);

    this.sessionSalt = sessionSalt;
    this.sessionJitter = {
        flowGain: 0.88 + rng() * 0.32,
        randomPhase: rng() * Math.PI * 2,
        secondaryPhase: rng() * Math.PI * 2,
        wakePhase: rng() * Math.PI * 2,
        roamSpan: 0.28 + rng() * 0.22,
    };
    this.sessionJitterBase = {
        flowGain: this.sessionJitter.flowGain,
        roamSpan: this.sessionJitter.roamSpan,
    };
    this.throttle = PHYSICS_PROPS.baseCruiseThrottle;
    this.brake = 0;
    this.actionState = 'cruise';
    this.isCTurning = false;
    this.cTurnCooldown = this.randomInt(PHYSICS_PROPS.cTurnCooldownMin, PHYSICS_PROPS.cTurnCooldownMax);
    this.cTurnTimer = 0;
    this.cTurnDuration = 0;
    this.cTurnDirection = 0;
    this.cTurnPhase = 'none';
    this.bodyHeading = this.angle;
    this.propulsionDir = this.angle;
    this.tailIdleBlend = 1;
    this.roamTimer = 0;
    this.tailWaveMemory = Array.from({ length: this.historyLength }, () => 0);
    this.segmentWave = Array.from({ length: this.historyLength }, () => 0);
    this.tailWaveBlend = 0;
    this.controlRudder = 0;
    this.manualThrottle = PHYSICS_PROPS.baseCruiseThrottle;
    this.hoverMotionBlend = 0;
    this.aiHeadingFiltered = this.angle;
    this.turnStrokeCooldown = 0;
    this.prevKickPhase = 0;
    this.aiDecisionTimer = this.randomInt(5, 11);
    this.aiHeadingSampleState = null;
    this.flowSampleState = null;
    this.flowVector = { x: 0, y: 0, angle: 0 };
    this.applySlotMotionProfile();
},

getBehaviorBoundaryPressure(bounds) {
    const width = Math.max(1, bounds?.width || 1);
    const height = Math.max(1, bounds?.height || 1);
    const originX = Number.isFinite(Number(bounds?.x)) ? Number(bounds.x) : 0;
    const originY = Number.isFinite(Number(bounds?.y)) ? Number(bounds.y) : 0;
    const pad = bounds?.padding ?? 56;
    const minEdge = Math.min(
        this.x - (originX + pad),
        (originX + width - pad) - this.x,
        this.y - (originY + pad),
        (originY + height - pad) - this.y,
    );
    return 1 - clampValue(minEdge / Math.max(1, pad), 0, 1);
},

getWallSense(bounds, heading = this.angle, px = this.x, py = this.y) {
    const width = Math.max(1, bounds?.width || 1);
    const height = Math.max(1, bounds?.height || 1);
    const originX = Number.isFinite(Number(bounds?.x)) ? Number(bounds.x) : 0;
    const originY = Number.isFinite(Number(bounds?.y)) ? Number(bounds.y) : 0;
    const pad = bounds?.padding ?? 56;
    const left = px - (originX + pad);
    const right = (originX + width - pad) - px;
    const top = py - (originY + pad);
    const bottom = (originY + height - pad) - py;

    let distance = left;
    let normal = { x: 1, y: 0 };
    if (right < distance) {
        distance = right;
        normal = { x: -1, y: 0 };
    }
    if (top < distance) {
        distance = top;
        normal = { x: 0, y: 1 };
    }
    if (bottom < distance) {
        distance = bottom;
        normal = { x: 0, y: -1 };
    }

    const sensor = Math.max(18, pad * 1.35);
    const near = clampValue((sensor - distance) / sensor, 0, 1);
    const hx = Math.cos(heading);
    const hy = Math.sin(heading);
    const t1 = { x: -normal.y, y: normal.x };
    const t2 = { x: normal.y, y: -normal.x };
    const t1Score = t1.x * hx + t1.y * hy;
    const t2Score = t2.x * hx + t2.y * hy;
    const tangent = t1Score >= t2Score ? t1 : t2;
    const tangentAngle = Math.atan2(tangent.y, tangent.x);
    const inwardAngle = Math.atan2(normal.y, normal.x);
    const escapeAngle = this.lerpAngle(tangentAngle, inwardAngle, 0.28 + near * 0.34);

    const vn = this.velocity.x * normal.x + this.velocity.y * normal.y;
    const approachSpeed = Math.max(0, -vn);
    const ttc = approachSpeed > 1e-4
        ? Math.max(0, distance) / approachSpeed
        : Infinity;

    return {
        near,
        distance,
        normal,
        tangent,
        escapeAngle,
        approachSpeed,
        ttc,
    };
},

startCTurn(direction) {
    const dir = direction === 0 ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(direction);
    this.cTurnDirection = dir || 1;
    this.cTurnDuration = this.randomInt(10, 16);
    this.cTurnTimer = this.cTurnDuration;
    this.cTurnPhase = 'prepare';
    this.isCTurning = true;
    this.actionState = 'c_turn';
    this.cTurnCooldown = this.randomInt(PHYSICS_PROPS.cTurnCooldownMin, PHYSICS_PROPS.cTurnCooldownMax);
},

getFlowVector(width, height, frameCount) {
    const cadenceRaw = Number(this.tuning?.physics?.flowSampleCadence);
    const cadence = Math.max(1, Math.round(Number.isFinite(cadenceRaw) ? cadenceRaw : 2));
    if (!this.flowSampleState) {
        const phaseSeed = ((this.uid || 1) * 0.61803398875) % 1;
        const phaseOffset = cadence > 1
            ? Math.floor(phaseSeed * cadence)
            : 0;
        this.flowSampleState = {
            nextFrame: frameCount + phaseOffset,
            phaseOffset,
            sampledX: 0,
            sampledY: 0,
            sampledAngle: 0,
            sampleScratch: { x: 0, y: 0, angle: 0 },
        };
    }
    if (frameCount >= this.flowSampleState.nextFrame) {
        const sampled = sampleCurlField({
            x: this.x,
            y: this.y,
            width,
            height,
            time: frameCount + this.sessionJitter.randomPhase * 50,
            seed: this.flowSeed + this.sessionJitter.secondaryPhase,
            strength: 0.0125 + (1 - this.depth) * 0.005,
            out: this.flowSampleState.sampleScratch,
        });
        this.flowSampleState.sampledX = sampled.x;
        this.flowSampleState.sampledY = sampled.y;
        this.flowSampleState.sampledAngle = sampled.angle;
        this.flowSampleState.nextFrame = frameCount + cadence;
    }

    this.driftBias.x = this.lerp(this.driftBias.x, this.flowSampleState.sampledX, 0.003);
    this.driftBias.y = this.lerp(this.driftBias.y, this.flowSampleState.sampledY, 0.003);

    if (!this.flowVector) {
        this.flowVector = { x: 0, y: 0, angle: 0 };
    }
    this.flowVector.x = (this.flowSampleState.sampledX - this.driftBias.x) * this.sessionJitter.flowGain;
    this.flowVector.y = (this.flowSampleState.sampledY - this.driftBias.y) * this.sessionJitter.flowGain;
    this.flowVector.angle = this.flowSampleState.sampledAngle;
    return this.flowVector;
},

resolveHoverMotionState(isHovered = false, simStepScale = 1) {
    const target = isHovered ? 1 : 0;
    const current = clampValue(Number(this.hoverMotionBlend) || 0, 0, 1);
    const step = clampValue(Number(simStepScale) || 1, 0.2, 3);
    const riseRate = clampValue(0.24 * step, 0.08, 0.5);
    const fallRate = clampValue(0.1 * step, 0.03, 0.28);
    const followRate = target > current ? riseRate : fallRate;
    const next = clampValue(this.lerp(current, target, followRate), 0, 1);
    this.hoverMotionBlend = next;
    return {
        motionScale: clampValue(1 - next * 0.6, 0.4, 1),
        rhythmScale: clampValue(1 - next * 0.38, 0.62, 1),
        blend: next,
    };
},

pickRoamAnchor(center, bounds) {
    const width = Math.max(1, bounds?.width || 1);
    const height = Math.max(1, bounds?.height || 1);
    const originX = Number.isFinite(Number(bounds?.x)) ? Number(bounds.x) : 0;
    const originY = Number.isFinite(Number(bounds?.y)) ? Number(bounds.y) : 0;
    const pad = bounds?.padding ?? 56;
    const spanX = width * (this.sessionJitter?.roamSpan ?? 0.34);
    const spanY = height * (this.sessionJitter?.roamSpan ?? 0.34);
    const centerX = Number.isFinite(Number(center?.x)) ? Number(center.x) : originX + width * 0.5;
    const centerY = Number.isFinite(Number(center?.y)) ? Number(center.y) : originY + height * 0.5;
    const weightedX = (Math.random() - 0.5) * spanX * 1.6 + (Math.random() - 0.5) * width * 0.36;
    const weightedY = (Math.random() - 0.5) * spanY * 1.6 + (Math.random() - 0.5) * height * 0.36;
    this.roamAnchor = {
        x: clampValue(centerX + weightedX, originX + pad, originX + width - pad),
        y: clampValue(centerY + weightedY, originY + pad, originY + height - pad),
    };
    this.roamTimer = 180 + Math.floor(Math.random() * 200);
},

getWakeSample(stepScale = 1) {
    return sampleZenKoiSurfaceWake(this, stepScale);
}
};

export { koiFishBehaviorMethods };
