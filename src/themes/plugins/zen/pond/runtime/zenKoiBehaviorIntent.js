import { clamp as clampValue } from '../model/koi/koiMotion.js';
import { requireZenKoiBehaviorTemperament } from '../model/koi/zenKoiPersonality.js';
import { ZEN_KOI_INTERACTION_RESPONSE_KINDS } from './zenKoiInteractionStimulus.js';
import {
    acquireZenKoiBehaviorMemory, advanceZenKoiBehaviorNeeds,
    resolveZenKoiSocialNeighbor, commitZenKoiSocialPartner,
} from './zenKoiBehaviorMemory.js';

const TWO_PI = Math.PI * 2;

const KIND_REST = 'rest';
const KIND_DROWSE = 'drowse';
const KIND_ATTEND = 'attend';
const KIND_NOTICE = 'notice';
const KIND_STARTLE = 'startle';
const KIND_INSPECT = 'inspect';
const KIND_TRAIL = 'trail';
const KIND_PARALLEL = 'parallel';
const KIND_SCOUT = 'scout';
const KIND_GRAZE = 'graze';
const KIND_EXPLORE = 'explore';

const ZERO_VECTOR = Object.freeze({ x: 0, y: 0, weight: 0 });
const MICRO_GOAL_PHASE_APPROACH = 'approach';
const MICRO_GOAL_PHASE_LINGER = 'linger';
const MICRO_GOAL_PHASE_LEAVE = 'leave';
const MICRO_GOAL_PHASE_ACCOMPANY = 'accompany';

const hashStringFNV1a = (value) => {
    const text = String(value ?? '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const hashToUnit = (value) => {
    const hash = hashStringFNV1a(value);
    return clampValue((hash + 0.5) / 4294967296, 0.0005, 0.9995);
};

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeVector = (x, y, weight = 1) => {
    const magnitude = Math.hypot(x, y);
    if (magnitude <= 1e-6) return ZERO_VECTOR;
    return {
        x: x / magnitude,
        y: y / magnitude,
        weight: clampValue(weight, 0, 1.2),
    };
};

const combineHeadingVectors = (baseVector = ZERO_VECTOR, goalVector = ZERO_VECTOR) => {
    const baseWeight = clampValue(Number(baseVector?.weight) || 0, 0, 1.2);
    const goalWeight = clampValue(Number(goalVector?.weight) || 0, 0, 1.2);
    if (baseWeight <= 0 && goalWeight <= 0) return ZERO_VECTOR;
    const x = (Number(baseVector?.x) || 0) * baseWeight + (Number(goalVector?.x) || 0) * goalWeight;
    const y = (Number(baseVector?.y) || 0) * baseWeight + (Number(goalVector?.y) || 0) * goalWeight;
    return normalizeVector(x, y, Math.max(baseWeight, goalWeight));
};

const resolveIntentWindow = ({
    fish = null,
    frameCount = 0,
    sessionSalt = 0,
} = {}) => {
    const domain = typeof fish?.domain === 'string' && fish.domain.trim()
        ? fish.domain.trim()
        : `koi-${fish?.uid || 0}`;
    const uid = Number.isFinite(Number(fish?.uid)) ? Number(fish.uid) : 0;
    const memory = acquireZenKoiBehaviorMemory(fish);
    const baseWindow = memory.intentWindow ? memory.intentWindow.baseWindow
        : 210 + Math.floor(hashToUnit(`${domain}|${uid}|intent-window`) * 210);
    const windowIndex = Math.floor(Math.max(0, Number(frameCount) || 0) / Math.max(1, baseWindow));
    if (memory.intentWindow && memory.intentWindow.windowIndex === windowIndex
        && memory.intentWindow.sessionSalt === sessionSalt) return memory.intentWindow;
    const seed = `${domain}|${uid}|${sessionSalt}|${windowIndex}`;
    memory.intentWindow = {
        baseWindow,
        sessionSalt,
        windowIndex,
        primary: hashToUnit(`${seed}|primary`),
        secondary: hashToUnit(`${seed}|secondary`),
        angle: hashToUnit(`${seed}|angle`) * TWO_PI,
    };
    return memory.intentWindow;
};

const clearMicroGoal = (fish = null) => {
    if (!fish || typeof fish !== 'object') return;
    fish.zenKoiBehaviorMicroGoal = null;
};

const resolveMicroGoalDurations = (kind, personality, intentWindow) => {
    const jitter = Math.round((Number(intentWindow?.secondary) || 0) * 36);
    const eager = Math.round(personality.energy * 24);
    const patient = Math.round(personality.laziness * 28);
    if (kind === KIND_INSPECT) {
        return {
            approachFrames: 90 + jitter - eager,
            lingerFrames: 68 + patient,
            leaveFrames: 56 + Math.round(personality.curiosity * 24),
        };
    }
    if (kind === KIND_ATTEND) {
        return {
            approachFrames: 66 + jitter - eager,
            lingerFrames: 94 + Math.round(personality.curiosity * 34),
            leaveFrames: 38 + Math.round(personality.laziness * 18),
        };
    }
    if (kind === KIND_NOTICE) {
        return {
            approachFrames: 92 + jitter - Math.round(personality.energy * 16),
            lingerFrames: 72 + Math.round(personality.curiosity * 28),
            leaveFrames: 46 + patient,
        };
    }
    if (kind === KIND_SCOUT) {
        return {
            approachFrames: 178 + jitter - eager,
            lingerFrames: 48 + Math.round(personality.curiosity * 26),
            leaveFrames: 82 + Math.round(personality.energy * 20),
        };
    }
    if (kind === KIND_GRAZE) {
        return {
            approachFrames: 152 + jitter - Math.round(personality.energy * 10),
            lingerFrames: 142 + patient + Math.round(personality.curiosity * 32),
            leaveFrames: 66 + Math.round(personality.laziness * 18),
        };
    }
    return {
        approachFrames: 170 + jitter - Math.round(personality.energy * 14),
        lingerFrames: 92 + patient,
        leaveFrames: 70 + Math.round(personality.curiosity * 18),
    };
};

const clampPointToBounds = (point, bounds = null) => {
    const width = Math.max(1, Number(bounds?.width) || 1);
    const height = Math.max(1, Number(bounds?.height) || 1);
    const padding = clampValue(Number(bounds?.padding) || 56, 24, Math.max(24, Math.min(width, height) * 0.32));
    const x = Number(bounds?.x) || 0, y = Number(bounds?.y) || 0;
    return {
        x: clampValue(Number(point?.x) || x + width * 0.5, x + padding, x + Math.max(padding, width - padding)),
        y: clampValue(Number(point?.y) || y + height * 0.5, y + padding, y + Math.max(padding, height - padding)),
    };
};

const resolveWanderMicroGoalTarget = ({
    kind,
    fish,
    bounds,
    center,
    intentWindow,
    personality,
    goalCycle,
} = {}) => {
    const width = Math.max(1, Number(bounds?.width) || 1);
    const height = Math.max(1, Number(bounds?.height) || 1);
    const safeCenter = center && typeof center === 'object'
        ? center
        : { x: width * 0.5, y: height * 0.5 };
    const cycleTurn = (Number(goalCycle) || 0) * 2.399963229728653;
    const angle = (Number(intentWindow?.angle) || 0)
        + cycleTurn
        + (kind === KIND_SCOUT ? personality.energy : personality.curiosity) * 0.54;
    const radiusBlend = 0.46 + (Number(intentWindow?.primary) || 0) * 0.54;
    const scoutScale = kind === KIND_SCOUT ? 0.47 : 0.34;
    const lateralBias = Math.sin((Number(fish?.uid) || 0) * 0.37 + cycleTurn) * 0.18;
    return clampPointToBounds({
        x: Number(safeCenter.x) + Math.cos(angle) * width * scoutScale * radiusBlend + Math.sin(angle) * height * lateralBias,
        y: Number(safeCenter.y) + Math.sin(angle) * height * scoutScale * radiusBlend - Math.cos(angle) * width * lateralBias * 0.45,
    }, bounds);
};

const resolveGrazeMicroGoalTarget = ({
    fish,
    bounds,
    center,
    intentWindow,
    personality,
    goalCycle,
    sessionSalt = 0,
} = {}) => {
    const width = Math.max(1, Number(bounds?.width) || 1);
    const height = Math.max(1, Number(bounds?.height) || 1);
    const safeCenter = center && typeof center === 'object'
        ? center
        : { x: width * 0.5, y: height * 0.5 };
    const domain = typeof fish?.domain === 'string' && fish.domain.trim()
        ? fish.domain.trim()
        : `koi-${fish?.uid || 0}`;
    const seed = `${domain}|${fish?.uid || 0}|${sessionSalt}|${Number(intentWindow?.windowIndex) || 0}|${Number(goalCycle) || 0}|graze`;
    const angle = hashToUnit(`${seed}|angle`) * TWO_PI;
    const radiusBase = Math.min(width, height);
    const radius = radiusBase * (0.1 + hashToUnit(`${seed}|radius`) * 0.34);
    const sideBias = (hashToUnit(`${seed}|side`) - 0.5) * radiusBase * 0.2;
    const lazinessPull = 0.82 + personality.laziness * 0.22;
    return clampPointToBounds({
        x: Number(safeCenter.x) + Math.cos(angle) * radius * lazinessPull + Math.sin(angle) * sideBias,
        y: Number(safeCenter.y) + Math.sin(angle) * radius * lazinessPull - Math.cos(angle) * sideBias * 0.45,
    }, bounds);
};

const buildMicroGoalKey = ({ kind, goalCycle, partnerUid }) => `${kind}:${goalCycle}:${partnerUid}`;

const transitionMicroGoalPhase = (state, phase, frameCount) => {
    state.phase = phase;
    state.phaseStartedFrame = frameCount;
};

const resolveMicroGoalProgress = (phase, phaseAge, durations) => {
    const duration = phase === MICRO_GOAL_PHASE_APPROACH
        ? durations.approachFrames
        : (phase === MICRO_GOAL_PHASE_LINGER ? durations.lingerFrames : durations.leaveFrames);
    return clampValue(phaseAge / Math.max(1, duration), 0, 1);
};

const resolveMicroGoal = ({
    fish,
    kind,
    target,
    bounds,
    personality,
    intentWindow,
    frameCount,
    arriveRadius,
    restartDistance = 180,
} = {}) => {
    if (!fish || typeof fish !== 'object' || !target) return null;
    const frame = Math.max(0, Number(frameCount) || 0);
    const cycle = Math.max(0, Math.floor(Number(fish.zenKoiBehaviorMicroGoalCycle) || 0));
    const safeTarget = clampPointToBounds(target, bounds);
    const key = buildMicroGoalKey({
        kind,
        goalCycle: cycle,
        partnerUid: acquireZenKoiBehaviorMemory(fish).partnerUid,
    });
    const durations = resolveMicroGoalDurations(kind, personality, intentWindow);
    const safeArriveRadius = clampValue(Number(arriveRadius) || 58, 36, 128);
    const previous = fish.zenKoiBehaviorMicroGoal;
    const targetShift = previous
        ? Math.hypot(safeTarget.x - Number(previous.targetX), safeTarget.y - Number(previous.targetY))
        : Number.POSITIVE_INFINITY;
    const reusable = previous
        && previous.kind === kind
        && previous.key === key
        && targetShift <= restartDistance
        && (
            previous.phase === MICRO_GOAL_PHASE_APPROACH
            || previous.phase === MICRO_GOAL_PHASE_LINGER
            || previous.phase === MICRO_GOAL_PHASE_LEAVE
        );
    let state = previous;

    if (!reusable) {
        state = {
            kind,
            key,
            cycle,
            phase: MICRO_GOAL_PHASE_APPROACH,
            startedFrame: frame,
            phaseStartedFrame: frame,
            lastUpdatedFrame: frame,
            targetX: safeTarget.x,
            targetY: safeTarget.y,
            arriveRadius: safeArriveRadius,
            durations,
        };
        fish.zenKoiBehaviorMicroGoal = state;
    } else {
        const elapsed = Math.max(0, frame - state.lastUpdatedFrame);
        const follow = 1 - Math.pow(1 - (kind === KIND_INSPECT ? 0.18 : 0.025), elapsed);
        state.targetX += (safeTarget.x - state.targetX) * follow;
        state.targetY += (safeTarget.y - state.targetY) * follow;
        state.arriveRadius = safeArriveRadius;
        state.lastUpdatedFrame = frame;
    }

    const dx = Number(state.targetX) - Number(fish.x || 0);
    const dy = Number(state.targetY) - Number(fish.y || 0);
    const distance = Math.hypot(dx, dy);
    const phaseStartedFrame = Number.isFinite(Number(state.phaseStartedFrame))
        ? Number(state.phaseStartedFrame)
        : frame;
    let phaseAge = Math.max(0, frame - phaseStartedFrame);

    if (
        state.phase === MICRO_GOAL_PHASE_APPROACH
        && (distance <= safeArriveRadius || phaseAge >= state.durations.approachFrames)
    ) {
        transitionMicroGoalPhase(state, MICRO_GOAL_PHASE_LINGER, frame);
        phaseAge = 0;
    } else if (
        state.phase === MICRO_GOAL_PHASE_LINGER
        && phaseAge >= state.durations.lingerFrames
    ) {
        transitionMicroGoalPhase(state, MICRO_GOAL_PHASE_LEAVE, frame);
        phaseAge = 0;
    } else if (
        state.phase === MICRO_GOAL_PHASE_LEAVE
        && phaseAge >= state.durations.leaveFrames
    ) {
        fish.zenKoiBehaviorMicroGoal = null;
        fish.zenKoiBehaviorMicroGoalCycle = cycle + 1;
        return null;
    }

    const startedFrame = Number.isFinite(Number(state.startedFrame))
        ? Number(state.startedFrame)
        : frame;
    const age = Math.max(0, frame - startedFrame);
    return {
        kind,
        phase: state.phase,
        target: {
            x: state.targetX,
            y: state.targetY,
        },
        distance,
        arriveRadius: safeArriveRadius,
        age,
        phaseAge,
        progress: resolveMicroGoalProgress(state.phase, phaseAge, state.durations),
    };
};

const resolveMicroGoalHeadingVector = ({
    microGoal,
    fish,
    personality,
    intentWindow,
    baseWeight = 0.16,
} = {}) => {
    if (!microGoal) return ZERO_VECTOR;
    const dx = Number(microGoal.target?.x) - Number(fish?.x || 0);
    const dy = Number(microGoal.target?.y) - Number(fish?.y || 0);
    const distance = Math.max(1e-6, Math.hypot(dx, dy));
    const nx = dx / distance;
    const ny = dy / distance;
    if (microGoal.phase === MICRO_GOAL_PHASE_LEAVE) {
        return normalizeVector(-nx, -ny, baseWeight * (0.76 + personality.energy * 0.34));
    }
    if (microGoal.phase === MICRO_GOAL_PHASE_LINGER) {
        const fallbackAngle = Number(intentWindow?.angle) || 0;
        const currentAngle = Number(fish?.bodyHeading ?? fish?.angle ?? fallbackAngle);
        const forwardX = Math.cos(currentAngle);
        const forwardY = Math.sin(currentAngle);
        const tangentX = distance > 1e-3 ? -ny : Math.cos(fallbackAngle + Math.PI * 0.5);
        const tangentY = distance > 1e-3 ? nx : Math.sin(fallbackAngle + Math.PI * 0.5);
        const toward = clampValue((distance - microGoal.arriveRadius * 0.8) / Math.max(1, microGoal.arriveRadius), -0.2, 0.3);
        const blendX = forwardX * 0.72 + tangentX * 0.28 + nx * toward;
        const blendY = forwardY * 0.72 + tangentY * 0.28 + ny * toward;
        return normalizeVector(
            blendX,
            blendY,
            baseWeight * (0.42 + personality.curiosity * 0.2),
        );
    }
    const farEase = clampValue((distance - microGoal.arriveRadius * 0.72) / Math.max(1, microGoal.arriveRadius * 2.1), 0.28, 1);
    return normalizeVector(nx, ny, baseWeight * farEase * (0.9 + personality.energy * 0.18));
};

const outsideSpacingBand = (error, radius) => Math.sign(error) * Math.max(0, Math.abs(error) - radius);

const resolveCompanionIntent = ({ fish, neighbor, kind, frameCount, personality, memory, bounds }) => {
    commitZenKoiSocialPartner(fish, neighbor, kind, frameCount);
    const previous = fish.zenKoiBehaviorMicroGoal;
    let state = previous;
    if (!state || state.kind !== kind || state.partnerUid !== neighbor.uid
        || state.phase !== MICRO_GOAL_PHASE_ACCOMPANY) {
        state = {
            kind, partnerUid: neighbor.uid, phase: MICRO_GOAL_PHASE_ACCOMPANY,
            startedFrame: frameCount, phaseStartedFrame: frameCount, lastUpdatedFrame: frameCount,
            heading: fish.bodyHeading,
            targetX: fish.x, targetY: fish.y,
        };
        fish.zenKoiBehaviorMicroGoal = state;
    }
    // Align with the companion's course, not the bearing to its old position.
    // This filter is in simulation ticks, independent of the intent cache rate.
    const elapsed = Math.max(0, frameCount - state.lastUpdatedFrame);
    const headingDelta = Math.atan2(Math.sin(neighbor.angle - state.heading), Math.cos(neighbor.angle - state.heading));
    state.heading += headingDelta * (1 - Math.exp(-elapsed / 24));
    state.lastUpdatedFrame = frameCount;
    const forwardX = Math.cos(state.heading), forwardY = Math.sin(state.heading);
    const sideX = -forwardY, sideY = forwardX;
    const parallel = kind === KIND_PARALLEL;
    const desiredRearGap = parallel ? 8 + personality.energy * 16 : 44 + personality.curiosity * 30;
    const desiredSideGap = parallel ? (42 + personality.curiosity * 24) * memory.partnerSide : 0;
    const target = clampPointToBounds({
        x: neighbor.x - forwardX * desiredRearGap + sideX * desiredSideGap,
        y: neighbor.y - forwardY * desiredRearGap + sideY * desiredSideGap,
    }, bounds);
    state.targetX = target.x;
    state.targetY = target.y;
    const dx = target.x - fish.x, dy = target.y - fish.y;
    const forwardError = dx * forwardX + dy * forwardY;
    const lateralError = dx * sideX + dy * sideY;
    const speed = toFiniteNumber(fish.lastSpeed, 0);
    // A spacing band allows companions to swim without continual recentering.
    // Longitudinal error changes pace; being ahead never requests a reversal.
    const lateralTrim = clampValue(outsideSpacingBand(lateralError, 14) / Math.max(84, speed * 90), -0.42, 0.42);
    const direction = state.heading + lateralTrim;
    const speedError = Math.hypot(neighbor.vx, neighbor.vy) - speed;
    const throttleBias = clampValue(speedError * 0.05 + outsideSpacingBand(forwardError, 18) * 0.0008, -0.055, 0.045);
    const spacingError = Math.hypot(outsideSpacingBand(forwardError, 18), outsideSpacingBand(lateralError, 14));
    const microGoal = {
        kind, phase: MICRO_GOAL_PHASE_ACCOMPANY, target,
        age: frameCount - state.startedFrame, phaseAge: frameCount - state.phaseStartedFrame,
        progress: clampValue((frameCount - state.startedFrame) / Math.max(1, memory.partnerUntil - state.startedFrame), 0, 1),
        distance: spacingError, arriveRadius: 18,
    };
    return createIntent({
        kind, partnerUid: neighbor.uid, steeringAuthority: 0.5,
        headingVector: normalizeVector(Math.cos(direction), Math.sin(direction), 0.7),
        decisionCadenceScale: 1.1, throttleBias,
        eventBias: { turn: -0.06, glide: spacingError < 18 ? 0.06 : 0.025, burst: -0.04, cTurn: -0.06, strength: -0.04 },
        target, microGoal, socialDistance: neighbor.distance,
    });
};

const resolveInteractionIntent = ({ fish, interactionStimulus, frameCount, bounds }) => {
    if (!interactionStimulus) return null;
    const response = interactionStimulus;
    const target = clampPointToBounds(response, bounds);
    const dx = target.x - fish.x, dy = target.y - fish.y;
    const distance = Math.hypot(dx, dy);
    const bearing = distance > 1 ? Math.atan2(dy, dx) : fish.bodyHeading + response.side * 0.6;
    const phase = response.phase;
    const startle = response.responseKind === ZEN_KOI_INTERACTION_RESPONSE_KINDS.STARTLE;
    const age = Math.max(0, frameCount - response.phaseStartedAt);
    const approach = phase === 'approach';
    const linger = phase === 'linger';
    const leaving = phase === 'leave';
    const progress = clampValue(age / (approach ? 190 : 85), 0, 1);
    // A curved departure continues the inspection's tangent instead of asking
    // for an instantaneous 180-degree reversal at the end of attention.
    let direction = bearing;
    if (startle) direction = bearing + Math.PI;
    else if (linger || leaving) {
        direction = bearing + response.side * (Math.PI * 0.5 + (leaving ? progress * 0.65 : 0));
    }
    const kind = startle ? KIND_STARTLE : response.responseKind === 'attend' ? KIND_ATTEND : KIND_NOTICE;
    const microGoal = {
        kind, phase, target, distance, arriveRadius: 46 + fish.baseSize * 0.4,
        progress, phaseAge: age, age: frameCount - response.startedAt,
    };
    fish.zenKoiBehaviorMicroGoal = microGoal;
    return createIntent({
        kind, target, microGoal,
        headingVector: normalizeVector(Math.cos(direction), Math.sin(direction), leaving ? 0.65 : 1),
        steeringAuthority: leaving ? 0.85 * (1 - progress) : (startle ? 1 : 0.94),
        decisionCadenceScale: 0.7,
        throttleBias: startle ? 0.045 : (linger ? -0.06 : approach && distance > 90 ? 0.035 : -0.025),
        eventBias: { turn: startle ? 0.12 : 0.04, glide: linger ? 0.08 : 0.015,
            burst: startle ? 0.018 : -0.03, cTurn: -0.03, strength: 0.04 },
        interactionKind: response.responseKind,
        interactionStrength: response.strength,
    });
};

const isMouseInsideBounds = (mousePos = null, bounds = null) => {
    if (!mousePos || !bounds) return false;
    const x = Number(mousePos.x);
    const y = Number(mousePos.y);
    const width = Math.max(1, Number(bounds.width) || 1);
    const height = Math.max(1, Number(bounds.height) || 1);
    return Number.isFinite(x)
        && Number.isFinite(y)
        && x >= -24
        && y >= -24
        && x <= width + 24
        && y <= height + 24;
};

const createIntent = ({
    kind,
    steeringAuthority = 0,
    partnerUid = null,
    headingVector = ZERO_VECTOR,
    decisionCadenceScale = 1,
    throttleBias = 0,
    eventBias = null,
    target = null,
    microGoal = null,
    socialDistance = null,
    interactionKind = null,
    interactionStrength = 0,
    restfulness = 0,
} = {}) => ({
    enabled: true,
    steeringAuthority,
    partnerUid,
    kind,
    headingVector,
    decisionCadenceScale: clampValue(decisionCadenceScale, 0.55, 1.7),
    throttleBias: clampValue(throttleBias, -0.22, 0.18),
    eventBias: {
        turn: clampValue(toFiniteNumber(eventBias?.turn, 0), -0.22, 0.28),
        glide: clampValue(toFiniteNumber(eventBias?.glide, 0), -0.18, 0.3),
        burst: clampValue(toFiniteNumber(eventBias?.burst, 0), -0.12, 0.2),
        cTurn: clampValue(toFiniteNumber(eventBias?.cTurn, 0), -0.1, 0.12),
        strength: clampValue(toFiniteNumber(eventBias?.strength, 0), -0.25, 0.35),
    },
    target,
    microGoal,
    socialDistance,
    interactionKind,
    interactionStrength: clampValue(interactionStrength, 0, 1.15),
    restfulness: clampValue(restfulness, 0, 1),
});

export const resolveZenKoiBehaviorIntent = ({
    fish = null,
    neighbors = [],
    envState = null,
    sleepContext = null,
    activation = null,
    energyProfile = null,
    mousePos = null,
    hovered = false,
    focused = false,
    interactionStimulus = null,
    formationTarget = null,
    bounds = null,
    center = null,
    frameCount = 0,
    sessionSalt = 0,
} = {}) => {
    if (!fish) return null;
    if (formationTarget) {
        clearMicroGoal(fish);
        const memory = acquireZenKoiBehaviorMemory(fish);
        memory.response = null;
        memory.partnerUid = null;
        memory.partnerKind = null;
        return null;
    }

    const safeBounds = bounds && typeof bounds === 'object'
        ? bounds
        : { width: 1, height: 1, padding: 56 };
    const safeCenter = center && typeof center === 'object'
        ? center
        : { x: (Number(safeBounds.width) || 1) * 0.5, y: (Number(safeBounds.height) || 1) * 0.5 };
    if (fish.entityKind === 'invitation') {
        clearMicroGoal(fish);
        const attending = fish.invitationAttending === true;
        const phase = frameCount * 0.003;
        const target = attending
            ? { x: fish.x, y: fish.y }
            : {
                x: (safeBounds.x ?? 0) + safeBounds.width * (0.5 + Math.cos(phase) * 0.12),
                y: (safeBounds.y ?? 0) + safeBounds.height * (0.5 + Math.sin(phase) * 0.16),
            };
        return createIntent({
            kind: attending ? 'invitation_attend' : 'invitation_patrol',
            target,
            headingVector: normalizeVector(target.x - fish.x, target.y - fish.y, attending ? 0 : 0.42),
            steeringAuthority: attending ? 0 : 0.6,
            throttleBias: attending ? -0.22 : -0.12,
            decisionCadenceScale: 1.5,
            eventBias: { glide: 0.3, burst: -0.12, cTurn: -0.1, strength: attending ? -0.25 : -0.12 },
        });
    }
    const personality = requireZenKoiBehaviorTemperament(fish);
    const intentWindow = resolveIntentWindow({ fish, frameCount, sessionSalt });
    const sleepBlend = clampValue(toFiniteNumber(sleepContext?.sleepBlend, 0), 0, 1);
    const activationScore = clampValue(
        toFiniteNumber(activation?.activationScore ?? energyProfile?.individualActivityScale, 1),
        0.06,
        1.85,
    );
    const daylight = clampValue(toFiniteNumber(envState?.daylight, 0.5), 0, 1);
    const memory = advanceZenKoiBehaviorNeeds(fish, frameCount, neighbors);
    const nearest = memory.response ? null : resolveZenKoiSocialNeighbor(fish, neighbors, frameCount);
    const mouseInside = isMouseInsideBounds(mousePos, safeBounds);
    const isFocused = Boolean(focused || hovered);

    const restfulness = clampValue(
        sleepBlend * 0.92
        + clampValue((0.52 - activationScore) / 0.46, 0, 1) * 0.4
        + (1 - daylight) * 0.08
        + personality.laziness * 0.08,
        0,
        1,
    );

    const interactionIntent = resolveInteractionIntent({
        fish,
        interactionStimulus,
        bounds: safeBounds,
        personality,
        intentWindow,
        frameCount,
    });
    if (interactionIntent) return interactionIntent;

    if (restfulness > 0.54 && !isFocused) {
        clearMicroGoal(fish);
        const driftAngle = intentWindow.angle + personality.laziness * 0.7;
        return createIntent({
            kind: KIND_REST,
            headingVector: normalizeVector(Math.cos(driftAngle), Math.sin(driftAngle), 0.08),
            decisionCadenceScale: 1.35 + personality.laziness * 0.22,
            throttleBias: -0.16 - restfulness * 0.05,
            eventBias: {
                glide: 0.2 + restfulness * 0.08,
                burst: -0.1,
                turn: -0.08,
                strength: -0.12,
            },
            restfulness,
        });
    }

    const drowseAffinity = clampValue(
        restfulness
        + memory.fatigue * 0.38
        + personality.laziness * 0.24
        + (1 - personality.energy) * 0.12
        + (1 - daylight) * 0.06,
        0,
        1,
    );
    if (!isFocused && !memory.response && (
        restfulness > 0.28
        || (drowseAffinity > 0.34 && intentWindow.secondary < 0.26)
    )) {
        clearMicroGoal(fish);
        const driftAngle = intentWindow.angle + personality.laziness * 0.82 - personality.energy * 0.28;
        return createIntent({
            kind: KIND_DROWSE,
            headingVector: normalizeVector(Math.cos(driftAngle), Math.sin(driftAngle), 0.06 + personality.laziness * 0.04),
            decisionCadenceScale: 1.24 + personality.laziness * 0.2,
            throttleBias: -0.095 - personality.laziness * 0.045,
            eventBias: {
                glide: 0.16 + personality.laziness * 0.08,
                burst: -0.1,
                turn: -0.04,
                cTurn: -0.04,
                strength: -0.08,
            },
            restfulness,
        });
    }

    if (mouseInside && isFocused) {
        const dx = Number(mousePos.x) - Number(fish.x || 0);
        const dy = Number(mousePos.y) - Number(fish.y || 0);
        const distance = Math.hypot(dx, dy);
        const curiosityWeight = clampValue(0.1 + personality.curiosity * 0.28, 0.1, 0.38);
        const closeEase = clampValue((distance - 62) / 180, 0, 1);
        const microGoal = resolveMicroGoal({
            fish,
            kind: KIND_INSPECT,
            target: { x: Number(mousePos.x), y: Number(mousePos.y) },
            bounds: safeBounds,
            personality,
            intentWindow,
            frameCount,
            arriveRadius: 58 + personality.curiosity * 24,
            restartDistance: 240,
        });
        const microGoalVector = resolveMicroGoalHeadingVector({
            microGoal,
            fish,
            personality,
            intentWindow,
            baseWeight: 0.18 + personality.curiosity * 0.1,
        });
        return createIntent({
            kind: KIND_INSPECT,
            steeringAuthority: 0.52,
            headingVector: combineHeadingVectors(
                normalizeVector(dx, dy, curiosityWeight * closeEase),
                microGoalVector,
            ),
            decisionCadenceScale: 0.72,
            throttleBias: distance > 150
                ? 0.045
                : (microGoal?.phase === MICRO_GOAL_PHASE_LINGER ? -0.07 : -0.045),
            eventBias: {
                turn: 0.09,
                glide: microGoal?.phase === MICRO_GOAL_PHASE_LINGER ? 0.13 : (distance < 120 ? 0.08 : -0.03),
                burst: distance > 220 ? 0.05 : -0.02,
                strength: 0.08,
            },
            target: { x: Number(mousePos.x), y: Number(mousePos.y) },
            microGoal,
        });
    }

    const sociality = clampValue(
        0.26
        + personality.curiosity * 0.34
        + personality.energy * 0.18
        + (1 - personality.laziness) * 0.14
        + intentWindow.primary * 0.18 + memory.socialNeed * 0.12
        + (personality.sociality - 0.5) * 0.2 - memory.alertness * 0.22,
        0,
        1,
    );
    if (
        nearest
        && (memory.partnerKind === KIND_PARALLEL || (memory.partnerUid === null
            && nearest.distance >= 92 && nearest.distance <= 220
            && sociality > 0.58 && intentWindow.secondary > 0.32))
    ) {
        return resolveCompanionIntent({ fish, neighbor: nearest, kind: KIND_PARALLEL,
            frameCount, personality, memory, bounds: safeBounds });
    }
    if (nearest && (memory.partnerKind === KIND_TRAIL || (memory.partnerUid === null
        && nearest.distance >= 58 && nearest.distance <= 190 && sociality > 0.64))) {
        return resolveCompanionIntent({ fish, neighbor: nearest, kind: KIND_TRAIL,
            frameCount, personality, memory, bounds: safeBounds });
    }

    const grazeAffinity = clampValue(
        personality.curiosity * 0.28
        + personality.laziness * 0.34
        + (1 - personality.energy) * 0.18
        + clampValue((1.28 - activationScore) / 1.1, 0, 1) * 0.14,
        0,
        1,
    );
    if (
        !isFocused
        && activationScore < 1.36
        && grazeAffinity > 0.48
        && intentWindow.primary > 0.46
        && intentWindow.secondary < 0.58
    ) {
        const microGoal = resolveMicroGoal({
            fish,
            kind: KIND_GRAZE,
            target: resolveGrazeMicroGoalTarget({
                fish,
                bounds: safeBounds,
                center: safeCenter,
                intentWindow,
                personality,
                goalCycle: fish.zenKoiBehaviorMicroGoalCycle,
                sessionSalt,
            }),
            bounds: safeBounds,
            personality,
            intentWindow,
            frameCount,
            arriveRadius: 52 + personality.laziness * 30,
            restartDistance: 210,
        });
        const microGoalVector = resolveMicroGoalHeadingVector({
            microGoal,
            fish,
            personality,
            intentWindow,
            baseWeight: 0.12 + personality.curiosity * 0.06,
        });
        return createIntent({
            kind: KIND_GRAZE,
            headingVector: combineHeadingVectors(
                normalizeVector(
                    Number(safeCenter.x) - Number(fish.x || 0),
                    Number(safeCenter.y) - Number(fish.y || 0),
                    0.045,
                ),
                microGoalVector,
            ),
            decisionCadenceScale: 1.08 + personality.laziness * 0.12,
            throttleBias: microGoal?.phase === MICRO_GOAL_PHASE_APPROACH ? -0.018 : -0.06 - personality.laziness * 0.025,
            eventBias: {
                turn: microGoal?.phase === MICRO_GOAL_PHASE_LINGER ? 0.06 : 0.025,
                glide: microGoal?.phase === MICRO_GOAL_PHASE_LINGER ? 0.16 : 0.07,
                burst: -0.045,
                cTurn: -0.04,
                strength: -0.02,
            },
            target: microGoal?.target || null,
            microGoal,
        });
    }

    const slot = typeof fish.slot === 'string' ? fish.slot : 'resident';
    const scoutBias = slot === 'scout' ? 0.22 : 0;
    const activeScout = activationScore > 1.18 || personality.energy + scoutBias + memory.exploration * 0.12 > 0.86;
    if (activeScout && intentWindow.secondary > 0.28) {
        const travelAngle = (Number(fish.bodyHeading) || Number(fish.angle) || 0)
            + Math.sin(intentWindow.angle) * (0.54 + personality.curiosity * 0.42);
        const microGoal = resolveMicroGoal({
            fish,
            kind: KIND_SCOUT,
            target: resolveWanderMicroGoalTarget({
                kind: KIND_SCOUT,
                fish,
                bounds: safeBounds,
                center: safeCenter,
                intentWindow,
                personality,
                goalCycle: fish.zenKoiBehaviorMicroGoalCycle,
            }),
            bounds: safeBounds,
            personality,
            intentWindow,
            frameCount,
            arriveRadius: 74,
            restartDistance: 260,
        });
        const microGoalVector = resolveMicroGoalHeadingVector({
            microGoal,
            fish,
            personality,
            intentWindow,
            baseWeight: 0.18 + personality.energy * 0.1,
        });
        return createIntent({
            kind: KIND_SCOUT,
            headingVector: combineHeadingVectors(
                normalizeVector(Math.cos(travelAngle), Math.sin(travelAngle), 0.16 + personality.energy * 0.16),
                microGoalVector,
            ),
            decisionCadenceScale: 0.72,
            throttleBias: microGoal?.phase === MICRO_GOAL_PHASE_LINGER
                ? 0.018 + personality.energy * 0.02
                : 0.055 + personality.energy * 0.035,
            eventBias: {
                turn: 0.05,
                burst: microGoal?.phase === MICRO_GOAL_PHASE_APPROACH ? 0.06 + personality.energy * 0.04 : 0.02,
                glide: microGoal?.phase === MICRO_GOAL_PHASE_LINGER ? 0.06 : -0.04,
                strength: 0.06,
            },
            target: microGoal?.target || null,
            microGoal,
        });
    }

    const centerDx = Number(safeCenter.x) - Number(fish.x || 0);
    const centerDy = Number(safeCenter.y) - Number(fish.y || 0);
    const wanderAngle = intentWindow.angle + personality.curiosity * 0.8;
    const wanderX = Math.cos(wanderAngle) * 0.68 + centerDx / Math.max(1, Number(safeBounds.width) || 1);
    const wanderY = Math.sin(wanderAngle) * 0.68 + centerDy / Math.max(1, Number(safeBounds.height) || 1);
    const microGoal = resolveMicroGoal({
        fish,
        kind: KIND_EXPLORE,
        target: resolveWanderMicroGoalTarget({
            kind: KIND_EXPLORE,
            fish,
            bounds: safeBounds,
            center: safeCenter,
            intentWindow,
            personality,
            goalCycle: fish.zenKoiBehaviorMicroGoalCycle,
        }),
        bounds: safeBounds,
        personality,
        intentWindow,
        frameCount,
        arriveRadius: 68 + personality.laziness * 18,
        restartDistance: 240,
    });
    const microGoalVector = resolveMicroGoalHeadingVector({
        microGoal,
        fish,
        personality,
        intentWindow,
        baseWeight: 0.13 + personality.curiosity * 0.08,
    });
    return createIntent({
        kind: KIND_EXPLORE,
        headingVector: combineHeadingVectors(
            normalizeVector(wanderX, wanderY, 0.08 + personality.curiosity * 0.12),
            microGoalVector,
        ),
        decisionCadenceScale: 0.92 + personality.laziness * 0.14,
        throttleBias: microGoal?.phase === MICRO_GOAL_PHASE_LINGER
            ? (personality.energy - 0.5) * 0.025 - 0.018
            : (personality.energy - 0.5) * 0.055,
        eventBias: {
            turn: microGoal?.phase === MICRO_GOAL_PHASE_LINGER ? 0.055 : 0.025 + personality.curiosity * 0.035,
            glide: personality.laziness * 0.045 + (microGoal?.phase === MICRO_GOAL_PHASE_LINGER ? 0.05 : 0),
            burst: microGoal?.phase === MICRO_GOAL_PHASE_APPROACH ? personality.energy * 0.03 : personality.energy * 0.012,
            strength: 0.02,
        },
        target: microGoal?.target || null,
        microGoal,
    });
};

export const ZEN_KOI_BEHAVIOR_INTENT_KINDS = Object.freeze({
    REST: KIND_REST,
    DROWSE: KIND_DROWSE,
    ATTEND: KIND_ATTEND,
    NOTICE: KIND_NOTICE,
    STARTLE: KIND_STARTLE,
    INSPECT: KIND_INSPECT,
    TRAIL: KIND_TRAIL,
    PARALLEL: KIND_PARALLEL,
    SCOUT: KIND_SCOUT,
    GRAZE: KIND_GRAZE,
    EXPLORE: KIND_EXPLORE,
});

export const ZEN_KOI_BEHAVIOR_MICRO_GOAL_PHASES = Object.freeze({
    APPROACH: MICRO_GOAL_PHASE_APPROACH,
    LINGER: MICRO_GOAL_PHASE_LINGER,
    LEAVE: MICRO_GOAL_PHASE_LEAVE,
    ACCOMPANY: MICRO_GOAL_PHASE_ACCOMPANY,
});
