import { clamp as clampValue } from './koiMotion.js';
import { PHYSICS_PROPS } from './constants.js';
import { updateKoiFishEventFsm, updateKoiFishEventFsmLifeV2 } from './koiEventFsm.js';
import { updateKoiFishKinematicHybrid as updateKoiFishKinematicHybridModel } from './koiDynamicsKinematicHybrid.js';
import { updateKoiFishCpgDynamics as updateKoiFishCpgDynamicsModel } from './koiDynamicsCpgRuntime.js';

const EVENT_NONE = 'none';
const EVENT_TURN = 'turn';
const EVENT_GLIDE = 'glide';
const EVENT_BURST = 'burst';
const SWIM_MODEL_CPG_DYNAMICS = 'cpg_dynamics';
const SWIM_MODEL_KINEMATIC_HYBRID = 'kinematic_hybrid';
const SWIM_MODEL_EVENT_FSM = 'event_fsm';
const SWIM_MODEL_EVENT_FSM_LIFE = 'event_fsm_life_v1';
const SWIM_MODEL_EVENT_FSM_LIFE_V2 = 'event_fsm_life_v2';

function resolveSwimModel(value) {
    if (value === SWIM_MODEL_KINEMATIC_HYBRID) return SWIM_MODEL_KINEMATIC_HYBRID;
    if (value === SWIM_MODEL_EVENT_FSM) return SWIM_MODEL_EVENT_FSM;
    if (value === SWIM_MODEL_EVENT_FSM_LIFE) return SWIM_MODEL_EVENT_FSM_LIFE;
    if (value === SWIM_MODEL_EVENT_FSM_LIFE_V2) return SWIM_MODEL_EVENT_FSM_LIFE_V2;
    return SWIM_MODEL_CPG_DYNAMICS;
}

function wrapTurn(angle) {
    let a = angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

function randomRangeInt(self, min, max) {
    if (typeof self.randomInt === 'function') return self.randomInt(min, max);
    const lo = Math.floor(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function normalizeSafe(x, y) {
    const m = Math.hypot(x, y);
    if (m < 1e-6) return { x: 0, y: 0 };
    return { x: x / m, y: y / m };
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function smoothstep(t) {
    const x = clampValue(t, 0, 1);
    return x * x * (3 - 2 * x);
}

function applyOpacityTransition(self, frameCount, targetOpacity, currentOpacity) {
    const transition = self.opacityTransition;
    if (!transition || typeof transition !== 'object') return false;
    const target = clampValue(
        Number.isFinite(Number(transition.targetOpacity)) ? Number(transition.targetOpacity) : targetOpacity,
        0,
        1,
    );
    const durationFrames = Math.max(1, Math.floor(Number(transition.durationFrames) || 1));
    const safeFrame = Math.max(0, Math.floor(Number(frameCount) || 0));
    if (transition.startFrame === null || !Number.isFinite(Number(transition.startFrame))) {
        transition.startFrame = safeFrame;
        transition.fromOpacity = currentOpacity;
    }
    const startFrame = Math.max(0, Math.floor(Number(transition.startFrame) || 0));
    const fromOpacity = clampValue(
        Number.isFinite(Number(transition.fromOpacity)) ? Number(transition.fromOpacity) : currentOpacity,
        0,
        1,
    );
    const progress = clampValue((safeFrame - startFrame) / durationFrames, 0, 1);
    self.opacity = lerp(fromOpacity, target, smoothstep(progress));
    if (progress >= 1) {
        self.opacity = target;
        self.opacityTransition = null;
    }
    return true;
}

function clampLateralSlip(velocity, heading, slipLimitDeg = 14) {
    const fx = Math.cos(heading);
    const fy = Math.sin(heading);
    const lx = -fy;
    const ly = fx;

    const forward = velocity.x * fx + velocity.y * fy;
    const lateral = velocity.x * lx + velocity.y * ly;
    const baseForward = Math.max(0.012, Math.abs(forward));
    const maxLat = Math.tan((Math.max(0, slipLimitDeg) * Math.PI) / 180) * baseForward;
    const clampedLat = clampValue(lateral, -maxLat, maxLat);
    const out = {
        x: fx * forward + lx * clampedLat,
        y: fy * forward + ly * clampedLat,
        forward,
        lateral: clampedLat,
        slipDeg: Math.abs(Math.atan2(clampedLat, baseForward) * (180 / Math.PI)),
    };
    return out;
}

function ensureBehaviorState(self, center) {
    if (!Number.isFinite(self.bodyHeading)) self.bodyHeading = self.angle;
    if (!Number.isFinite(self.propulsionDir)) self.propulsionDir = self.angle;
    if (!Number.isFinite(self.steerTargetAngle)) self.steerTargetAngle = self.angle;
    if (!Number.isFinite(self.aiHeadingFiltered)) self.aiHeadingFiltered = self.angle;
    if (!Number.isFinite(self.controlRudder)) self.controlRudder = 0;
    if (!Number.isFinite(self.manualThrottle)) self.manualThrottle = PHYSICS_PROPS.baseCruiseThrottle;
    if (!Number.isFinite(self.brake)) self.brake = 0;
    if (!Number.isFinite(self.turnStrokeCooldown)) self.turnStrokeCooldown = 0;
    if (!Number.isFinite(self.aiTurnStrokePulse)) self.aiTurnStrokePulse = 0;
    if (!Number.isFinite(self.spinStallTimer)) self.spinStallTimer = 0;
    if (!Number.isFinite(self.tailIdleBlend)) self.tailIdleBlend = 0.14;
    if (!Number.isFinite(self.tailWaveBlend)) self.tailWaveBlend = 0.42;
    if (!Number.isFinite(self.decisionTimer)) self.decisionTimer = randomRangeInt(self, 0, 40);
    if (!self.eventState) {
        self.eventState = { type: EVENT_NONE, timer: 0, duration: 0, sign: 0, strength: 1 };
    }
    if (!self.eventRefractory) {
        self.eventRefractory = { turn: 0, glide: 0, burst: 0, c_turn: 0 };
    }
    if (!Number.isFinite(self.cTurnCooldown)) {
        self.cTurnCooldown = randomRangeInt(
            self,
            Math.max(PHYSICS_PROPS.cTurnCooldownMin, 520),
            Math.max(PHYSICS_PROPS.cTurnCooldownMax, 920)
        );
    }
    if (!Array.isArray(self.tailWaveMemory) || self.tailWaveMemory.length !== self.historyLength) {
        self.tailWaveMemory = Array.from({ length: self.historyLength }, () => 0);
    }
    if (!Array.isArray(self.segmentWave) || self.segmentWave.length !== self.historyLength) {
        self.segmentWave = Array.from({ length: self.historyLength }, () => 0);
    }
    if (!self.roamAnchor) {
        self.roamAnchor = { x: center.x, y: center.y };
        self.roamTimer = 0;
    }
}

function computeAIDesiredHeading(self, context, wallSense, simStepScaleOverride = null) {
    if (context.rosterTransit) return context.rosterTransit.heading;
    const bounds = context.bounds || { width: 1, height: 1, padding: 56 };
    const originX = Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : 0;
    const originY = Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : 0;
    const center = context.center || { x: originX + bounds.width * 0.5, y: originY + bounds.height * 0.5 };
    const formationTarget = context.formationTarget && typeof context.formationTarget === 'object'
        ? context.formationTarget
        : null;
    const simStepScale = clampValue(
        simStepScaleOverride ?? context.simStepScale ?? 1,
        0.05,
        4.0,
    );
    let sx;
    let sy;
    if (formationTarget) {
        const toFormation = normalizeSafe(formationTarget.x - self.x, formationTarget.y - self.y);
        const tangent = normalizeSafe(formationTarget.tangentX, formationTarget.tangentY);
        const tangentInfluenceRaw = Number(formationTarget.tangentInfluence);
        const tangentInfluence = Number.isFinite(tangentInfluenceRaw)
            ? clampValue(tangentInfluenceRaw, 0, 1)
            : 1;
        const distance = Math.hypot(formationTarget.x - self.x, formationTarget.y - self.y);
        const catchup = clampValue(distance / Math.max(48, Number(formationTarget.radiusReference) * 0.35), 0, 1);
        const tangentWeight = (0.58 + (1 - catchup) * 0.3) * tangentInfluence;
        sx = toFormation.x * (0.82 + catchup * 0.92) + tangent.x * tangentWeight;
        sy = toFormation.y * (0.82 + catchup * 0.92) + tangent.y * tangentWeight;
    } else {
        if (!self.roamAnchor || self.roamTimer <= 0) {
            self.pickRoamAnchor(center, bounds);
        } else {
            self.roamTimer -= simStepScale;
            const distToRoam = Math.hypot(self.roamAnchor.x - self.x, self.roamAnchor.y - self.y);
            if (distToRoam < 75 && self.roamTimer > 40) {
                self.roamTimer = 30;
            }
        }

        const toRoam = normalizeSafe(self.roamAnchor.x - self.x, self.roamAnchor.y - self.y);
        const toCenter = normalizeSafe(center.x - self.x, center.y - self.y);
        sx = toRoam.x * 0.76 + toCenter.x * 0.24;
        sy = toRoam.y * 0.76 + toCenter.y * 0.24;
    }

    const neighbors = context.neighbors || [];
    const repelScale = formationTarget ? 0.22 : 1;
    for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i];
        const dx = self.x - n.x;
        const dy = self.y - n.y;
        const d = Math.max(1e-6, Math.hypot(dx, dy));
        if (d < 132) {
            const repelRatio = 1 - d / 132;
            const repel = repelRatio * repelRatio * 0.62 * repelScale;
            sx += (dx / d) * repel;
            sy += (dy / d) * repel;
        }
    }

    // Keep mouse influence subtle; strong attraction creates perpetual circular turns.
    const mouse = context.mousePos;
    if (
        !formationTarget
        && mouse
        && mouse.x > originX - 50
        && mouse.x < originX + bounds.width + 50
        && mouse.y > originY - 50
        && mouse.y < originY + bounds.height + 50
    ) {
        const toMouse = normalizeSafe(mouse.x - self.x, mouse.y - self.y);
        const distToMouse = Math.hypot(mouse.x - self.x, mouse.y - self.y);

        let attraction = 0.14;
        if (distToMouse < 200) attraction = 0.22;
        if (distToMouse < 100) attraction = 0.08;

        sx += toMouse.x * attraction;
        sy += toMouse.y * attraction;
    }

    if (wallSense.near > 0.18 && wallSense.approachSpeed > 0.002) {
        const wallGuide = Math.pow(wallSense.near, 1.1) * 0.82;
        sx += Math.cos(wallSense.escapeAngle) * wallGuide;
        sy += Math.sin(wallSense.escapeAngle) * wallGuide;
    }

    if (wallSense.near > 0.8 && self.lastSpeed < 0.02) {
        sx += wallSense.tangent.x * 0.36;
        sy += wallSense.tangent.y * 0.36;
    }

    const microWander = Math.sin(self.sessionJitter.randomPhase + self.sessionJitter.secondaryPhase + self.lastSpeed * 21) * 0.012;
    const heading = Math.atan2(sy, sx);
    return Number.isFinite(heading) ? wrapTurn(heading + microWander) : self.bodyHeading;
}

function applyRefractoryDecay(self, stepScale = 1) {
    if (!self.eventRefractory) return;
    self.eventRefractory.turn = Math.max(0, (self.eventRefractory.turn || 0) - stepScale);
    self.eventRefractory.glide = Math.max(0, (self.eventRefractory.glide || 0) - stepScale);
    self.eventRefractory.burst = Math.max(0, (self.eventRefractory.burst || 0) - stepScale);
    self.eventRefractory.c_turn = Math.max(0, (self.eventRefractory.c_turn || 0) - stepScale);
}

const COMMON_MODEL_HELPERS = Object.freeze({
    wrapTurn,
    ensureBehaviorState,
    applyRefractoryDecay,
    computeAIDesiredHeading,
    clampLateralSlip,
    lerp,
    EVENT_NONE,
    EVENT_TURN,
    EVENT_GLIDE,
    EVENT_BURST,
});

const KINEMATIC_MODEL_HELPERS = Object.freeze({
    ...COMMON_MODEL_HELPERS,
    SWIM_MODEL_KINEMATIC_HYBRID,
});

const CPG_MODEL_HELPERS = Object.freeze({
    ...COMMON_MODEL_HELPERS,
    SWIM_MODEL_CPG_DYNAMICS,
});

export function updateKoiFish(width, height, frameCount, isHovered, targetRisk, context = {}) {
    if (targetRisk !== undefined && Math.abs(this.risk - targetRisk) > 0.01) {
        this.risk = this.lerp(this.risk, targetRisk, 0.05);
    }
    const targetOpacityRaw = Number(this.targetOpacity);
    const targetOpacity = clampValue(
        Number.isFinite(targetOpacityRaw) ? targetOpacityRaw : 1,
        0,
        1,
    );
    const currentOpacity = clampValue(
        Number.isFinite(Number(this.opacity)) ? Number(this.opacity) : targetOpacity,
        0,
        1,
    );
    if (!applyOpacityTransition(this, frameCount, targetOpacity, currentOpacity)) {
        const opacityFollowGain = targetOpacity < currentOpacity ? 0.06 : 0.09;
        this.opacity = lerp(currentOpacity, targetOpacity, opacityFollowGain);
    }
    const swimModel = resolveSwimModel(this.tuning?.physics?.swimModel);
    if (swimModel !== SWIM_MODEL_EVENT_FSM && swimModel !== SWIM_MODEL_EVENT_FSM_LIFE) {
        this.eventBodyFrame = null;
    }
    if (swimModel !== SWIM_MODEL_EVENT_FSM_LIFE_V2) {
        this.appendagePose = null;
    }
    if (swimModel === SWIM_MODEL_KINEMATIC_HYBRID) {
        return updateKoiFishKinematicHybridModel.call(
            this,
            width,
            height,
            frameCount,
            isHovered,
            context,
            KINEMATIC_MODEL_HELPERS,
        );
    }
    if (swimModel === SWIM_MODEL_EVENT_FSM_LIFE_V2) {
        return updateKoiFishEventFsmLifeV2.call(this, width, height, frameCount, isHovered, context);
    }
    if (swimModel === SWIM_MODEL_EVENT_FSM || swimModel === SWIM_MODEL_EVENT_FSM_LIFE) {
        return updateKoiFishEventFsm.call(this, width, height, frameCount, isHovered, context);
    }

    return updateKoiFishCpgDynamicsModel.call(
        this,
        width,
        height,
        frameCount,
        isHovered,
        context,
        CPG_MODEL_HELPERS,
    );
}
