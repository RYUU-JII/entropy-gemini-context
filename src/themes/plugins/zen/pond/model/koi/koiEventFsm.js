import {
    clamp as clampValue,
    computeCTurnEnvelope,
} from './koiMotion.js';
import { PHYSICS_PROPS } from './constants.js';
import { applyContinuousKoiBodyPose } from './koiContinuousBodyRig.js';
import { updateKoiFishEventFsmRuntime } from './koiEventFsmRuntime.js';

const DECISION_INTERVAL_MIN = 150;
const DECISION_INTERVAL_MAX = 300;

const EVENT_NONE = 'none';
const EVENT_TURN = 'turn';
const EVENT_GLIDE = 'glide';
const EVENT_BURST = 'burst';
const EVENT_C_TURN = 'c_turn';

const REFRACTORY_DEFAULT = {
    turn: [60, 120],
    glide: [80, 160],
    burst: [60, 150],
    c_turn: [300, 600],
};

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

function randomChance(probability) {
    return Math.random() < probability;
}

function normalizeSafe(x, y) {
    const m = Math.hypot(x, y);
    if (m < 1e-6) return { x: 0, y: 0 };
    return { x: x / m, y: y / m };
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function eventDuration(self, type) {
    if (type === EVENT_TURN) return randomRangeInt(self, 11, 16);
    if (type === EVENT_GLIDE) return randomRangeInt(self, 70, 140);
    if (type === EVENT_BURST) return randomRangeInt(self, 12, 24);
    if (type === EVENT_C_TURN) return randomRangeInt(self, 22, 32);
    return 0;
}

function setRefractory(self, type) {
    const range = REFRACTORY_DEFAULT[type];
    if (!range) return;
    self.eventRefractory[type] = randomRangeInt(self, range[0], range[1]);
}

function beginEvent(self, type, params = {}) {
    if (!self.eventState) return;
    const duration = params.duration ?? eventDuration(self, type);
    self.eventState.type = type;
    self.eventState.timer = duration;
    self.eventState.duration = duration;
    self.eventState.sign = params.sign ?? 0;
    self.eventState.strength = clampValue(params.strength ?? 1, 0.15, 2.2);
    if (type === EVENT_C_TURN) {
        self.cTurnDirection = self.eventState.sign || (Math.random() < 0.5 ? -1 : 1);
        self.cTurnDuration = duration;
        self.cTurnTimer = duration;
        self.cTurnPhase = 'prepare';
        self.cTurnCooldown = randomRangeInt(
            self,
            Math.max(PHYSICS_PROPS.cTurnCooldownMin, 520),
            Math.max(PHYSICS_PROPS.cTurnCooldownMax, 920),
        );
    }
    setRefractory(self, type);
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
            Math.max(PHYSICS_PROPS.cTurnCooldownMax, 920),
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

function pickCruiseAnchor(self, center, bounds) {
    const bodyLength = self.segmentSpacing * (self.history.length - 1);
    const fx = Math.cos(self.bodyHeading);
    const fy = Math.sin(self.bodyHeading);
    let chosen;
    let bestScore = -Infinity;
    // Sample only when a route ends. Prefer reachable water ahead over a nearby
    // point behind the fish, which otherwise becomes the center of an orbit.
    for (let i = 0; i < 5; i++) {
        self.pickRoamAnchor(center, bounds);
        const candidate = self.roamAnchor;
        const dx = candidate.x - self.x;
        const dy = candidate.y - self.y;
        const distance = Math.hypot(dx, dy);
        const score = Math.min(distance, bodyLength * 4)
            + (dx * fx + dy * fy) * 0.65
            - Math.max(0, bodyLength * 1.8 - distance) * 3;
        if (score > bestScore) {
            bestScore = score;
            chosen = candidate;
        }
    }
    self.roamAnchor = chosen;
    const distance = Math.hypot(chosen.x - self.x, chosen.y - self.y);
    const cruiseSpeed = Math.max(self.lastSpeed, self.baseSpeed * 2);
    self.roamTimer = clampValue(distance / cruiseSpeed + 120, 360, 1200);
}

function computeAIDesiredHeadingEvent(self, context, wallSense, simStepScaleOverride = null) {
    if (context.rosterTransit) return context.rosterTransit.heading;
    const bounds = context.bounds || { width: 1, height: 1, padding: 56 };
    const originX = Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : 0;
    const originY = Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : 0;
    const center = context.center || { x: originX + bounds.width * 0.5, y: originY + bounds.height * 0.5 };
    const formationTarget = context.formationTarget && typeof context.formationTarget === 'object'
        ? context.formationTarget
        : null;
    const behaviorIntent = context.behaviorIntent?.enabled === true
        ? context.behaviorIntent
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
        self.roamTimer -= simStepScale;
        const arrivalRadius = Math.min(
            self.segmentSpacing * (self.history.length - 1) * 1.5,
            Math.min(bounds.width, bounds.height) * 0.26,
        );
        if (self.roamTimer <= 0
            || Math.hypot(self.roamAnchor.x - self.x, self.roamAnchor.y - self.y) < arrivalRadius) {
            pickCruiseAnchor(self, center, bounds);
        }

        const toRoam = normalizeSafe(self.roamAnchor.x - self.x, self.roamAnchor.y - self.y);
        // Anchors already lie inside the pond. A second normalized center pull
        // keeps bending an otherwise settled course even in open water.
        sx = toRoam.x;
        sy = toRoam.y;
    }

    const neighbors = context.neighbors || [];
    const authority = clampValue(behaviorIntent?.steeringAuthority ?? 0, 0, 1);
    if (!formationTarget) {
        sx *= 1 - authority * 0.92;
        sy *= 1 - authority * 0.92;
    }
    const repelScale = formationTarget ? 0.22 : 1;
    for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i];
        const dx = self.x - n.x;
        const dy = self.y - n.y;
        const d = Math.max(1e-6, Math.hypot(dx, dy));
        const companion = behaviorIntent && n.uid === behaviorIntent.partnerUid;
        const separationRadius = companion ? 44 : 132;
        if (d < separationRadius) {
            const repelRatio = 1 - d / separationRadius;
            const repel = repelRatio * repelRatio * 0.62 * repelScale;
            sx += (dx / d) * repel;
            sy += (dy / d) * repel;
        }
    }

    const mouse = context.mousePos;
    if (
        !formationTarget
        && !behaviorIntent
        && mouse
        && mouse.x > originX - 50
        && mouse.x < originX + bounds.width + 50
        && mouse.y > originY - 50
        && mouse.y < originY + bounds.height + 50
    ) {
        const toMouse = normalizeSafe(mouse.x - self.x, mouse.y - self.y);
        const distToMouse = Math.hypot(mouse.x - self.x, mouse.y - self.y);

        // Mouse attraction is intentionally subtle; strong pull causes perpetual circling.
        let attraction = 0.14;
        if (distToMouse < 200) attraction = 0.22;
        if (distToMouse < 100) attraction = 0.08;

        sx += toMouse.x * attraction;
        sy += toMouse.y * attraction;
    }

    if (!formationTarget && behaviorIntent?.headingVector) {
        const intentVector = behaviorIntent.headingVector;
        const safetyYield = wallSense.approachSpeed > 0.002
            ? 1 - clampValue((wallSense.near - 0.65) / 0.35, 0, 1) * 0.9 : 1;
        const weight = clampValue(Number(intentVector.weight) || 0, 0, 1.2) * safetyYield;
        if (weight > 0) {
            sx += (Number(intentVector.x) || 0) * weight;
            sy += (Number(intentVector.y) || 0) * weight;
        }
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

    const microWander = Math.sin(self.sessionJitter.randomPhase + self.sessionJitter.secondaryPhase + self.lastSpeed * 21) * 0.014;
    const heading = Math.atan2(sy, sx);
    return Number.isFinite(heading) ? wrapTurn(heading + microWander) : self.bodyHeading;
}

function chooseAIEvent(self, headingNeed, wallSense, canCTurn, speedNorm, behaviorIntent = null, strokeSteering = false) {
    const ref = self.eventRefractory || {};
    const nearWall = wallSense.near > 0.95 && wallSense.approachSpeed > 0.025 && wallSense.ttc < 20;
    const eventBias = behaviorIntent?.enabled === true && behaviorIntent?.eventBias
        ? behaviorIntent.eventBias
        : null;
    const turnBias = clampValue(Number(eventBias?.turn) || 0, -0.22, 0.28);
    const glideBias = clampValue(Number(eventBias?.glide) || 0, -0.18, 0.3);
    const burstBias = clampValue(Number(eventBias?.burst) || 0, -0.12, 0.2);
    const cTurnBias = clampValue(Number(eventBias?.cTurn) || 0, -0.1, 0.12);
    const strengthBias = clampValue(Number(eventBias?.strength) || 0, -0.25, 0.35);
    const turnThreshold = clampValue(0.75 - turnBias, 0.5, 0.88);

    if (nearWall) {
        if (canCTurn && headingNeed > (strokeSteering ? 2.05 : 0.88) - cTurnBias
            && ref.c_turn <= 0 && wallSense.ttc < (strokeSteering ? 12 : 24)) {
            return { type: EVENT_C_TURN, strength: clampValue(1.15 + strengthBias, 0.75, 1.45) };
        }
        if (ref.turn <= 0) {
            return {
                type: EVENT_TURN,
                strength: clampValue(0.7 + headingNeed * 0.6 + strengthBias, 0.7, 1.42),
                sign: Math.sign(wrapTurn(self.steerTargetAngle - self.bodyHeading)) || (Math.random() < 0.5 ? -1 : 1),
            };
        }
    }

    // Heading error normally biases the swimming stroke. A separate trunk
    // gesture is reserved for an imminent wall threat.
    if (!strokeSteering && headingNeed > turnThreshold && ref.turn <= 0) {
        return {
            type: EVENT_TURN,
            strength: clampValue(0.65 + headingNeed * 0.45 + strengthBias, 0.55, 1.38),
            sign: Math.sign(wrapTurn(self.steerTargetAngle - self.bodyHeading)) || (Math.random() < 0.5 ? -1 : 1),
        };
    }

    const glideHeadingWindow = strokeSteering
        ? clampValue(0.6 + Math.max(0, glideBias) * 0.3, 0.45, 0.78)
        : clampValue(0.3 + Math.max(0, glideBias) * 0.45, 0.18, 0.46);
    const glideChance = clampValue((strokeSteering ? 0.2 : 0.1) + glideBias, 0, strokeSteering ? 0.4 : 0.38);
    const glideSafe = !strokeSteering || (!behaviorIntent?.interactionKind && wallSense.near < 0.78);
    if (glideSafe && headingNeed < glideHeadingWindow
        && speedNorm > 0.25 && ref.glide <= 0 && randomChance(glideChance)) {
        return { type: EVENT_GLIDE, strength: clampValue(1.3 + strengthBias, 0.9, 1.55) };
    }

    const burstHeadingWindow = clampValue(0.25 + Math.max(0, burstBias) * 0.32, 0.12, 0.36);
    const burstChance = clampValue(0.05 + burstBias, 0, 0.24);
    if (headingNeed < burstHeadingWindow && speedNorm < 0.7 && ref.burst <= 0 && randomChance(burstChance)) {
        return { type: EVENT_BURST, strength: clampValue(0.85 + Math.random() * 0.35 + strengthBias, 0.7, 1.45) };
    }

    return { type: EVENT_NONE, strength: 1 };
}

function stepEvent(self, stepScale = 1) {
    const event = self.eventState;
    if (!event || event.type === EVENT_NONE) return { type: EVENT_NONE, env: 0, cTurnEnv: null };
    const progress = 1 - event.timer / Math.max(1, event.duration);
    let env = Math.sin(progress * Math.PI);
    env = clampValue(env, 0, 1);
    let cTurnEnv = null;
    if (event.type === EVENT_C_TURN) {
        cTurnEnv = computeCTurnEnvelope(progress);
        self.cTurnPhase = cTurnEnv.phase;
    } else {
        self.cTurnPhase = 'none';
    }
    event.timer -= stepScale;
    if (event.timer <= 0) {
        event.type = EVENT_NONE;
        event.timer = 0;
        event.duration = 0;
        event.sign = 0;
        event.strength = 1;
        self.cTurnPhase = 'none';
    }
    return { type: self.eventState.type === EVENT_NONE ? EVENT_NONE : event.type, env, cTurnEnv };
}

function applyRefractoryDecay(self, stepScale = 1) {
    if (!self.eventRefractory) return;
    self.eventRefractory.turn = Math.max(0, (self.eventRefractory.turn || 0) - stepScale);
    self.eventRefractory.glide = Math.max(0, (self.eventRefractory.glide || 0) - stepScale);
    self.eventRefractory.burst = Math.max(0, (self.eventRefractory.burst || 0) - stepScale);
    self.eventRefractory.c_turn = Math.max(0, (self.eventRefractory.c_turn || 0) - stepScale);
}

function buildEventFsmRuntimeHelpers(overrides = {}) {
    return {
        wrapTurn,
        randomRangeInt,
        beginEvent,
        ensureBehaviorState,
        applyRefractoryDecay,
        computeAIDesiredHeadingEvent,
        chooseAIEvent,
        stepEvent,
        lerp,
        DECISION_INTERVAL_MIN,
        DECISION_INTERVAL_MAX,
        EVENT_NONE,
        EVENT_TURN,
        EVENT_GLIDE,
        EVENT_BURST,
        EVENT_C_TURN,
        ...overrides,
    };
}

export function updateKoiFishEventFsm(width, height, frameCount, isHovered, context = {}) {
    return updateKoiFishEventFsmRuntime.call(
        this,
        width,
        height,
        frameCount,
        isHovered,
        context,
        buildEventFsmRuntimeHelpers(),
    );
}

export function updateKoiFishEventFsmLifeV2(width, height, frameCount, isHovered, context = {}) {
    return updateKoiFishEventFsmRuntime.call(
        this,
        width,
        height,
        frameCount,
        isHovered,
        context,
        buildEventFsmRuntimeHelpers({
            applyBodyPose: applyContinuousKoiBodyPose,
            feelModel: 'event_fsm_life_v2',
            debugModelName: 'event-fsm-life-v2',
        }),
    );
}
