import { clamp } from './sakuraMath';
import {
    createSakuraArticulatedBendEventV1,
    resolveSakuraArticulatedBendTurnDeltaV1,
    SAKURA_ARTICULATED_BEND_KINDS,
    SAKURA_ARTICULATED_BEND_SAMPLE_POLICY,
} from './sakuraArticulatedBendKernel';

export const SAKURA_TRUNK_ARTICULATED_BEND_FLOW_VERSION = 1;

const MAX_BEND_END_ARC_NORM = 0.92;
const MIN_BEND_START_ARC_NORM = 0.08;
const MAX_KINK_ANGLE_RAD = Math.PI * 0.48;
const EPSILON = 1e-9;

const requireRandom = (localRandom) => {
    if (!localRandom || typeof localRandom.next !== 'function') {
        throw new Error('ZEN_SAKURA_TRUNK_ARTICULATED_BEND_RANDOM_REQUIRED');
    }
    return localRandom;
};

const sample = (localRandom, decisionType) => {
    const value = Number(requireRandom(localRandom).next(decisionType));
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`ZEN_SAKURA_TRUNK_ARTICULATED_BEND_RANDOM_INVALID:${decisionType}`);
    }
    return value;
};

const resolveKind = ({ style, angleNorm, kindSample }) => {
    const compoundChance = clamp(
        0.06 + (style * 0.18) + (angleNorm * 0.26),
        0.06,
        0.46,
    );
    const sweepChance = clamp(
        0.28 + ((1 - style) * 0.2) + ((1 - angleNorm) * 0.16),
        0.28,
        0.64,
    );
    if (kindSample < compoundChance) {
        return SAKURA_ARTICULATED_BEND_KINDS.COMPOUND;
    }
    if (kindSample < compoundChance + sweepChance) {
        return SAKURA_ARTICULATED_BEND_KINDS.SWEEP;
    }
    return SAKURA_ARTICULATED_BEND_KINDS.KNUCKLE;
};

const resolveSupportSteps = ({ kind, angleNorm, lockStrength }) => {
    const minimum = SAKURA_ARTICULATED_BEND_SAMPLE_POLICY.minByKind[kind];
    const expression = Math.round((angleNorm * 3) + ((1 - lockStrength) * 2));
    return clamp(minimum + expression, minimum, kind === 'compound' ? 13 : 9);
};

const createEvent = ({ flow, step, depthSpan, localRandom }) => {
    const angleNorm = clamp(
        Math.abs(Number(flow.kinkAngleRad) || 0) / MAX_KINK_ANGLE_RAD,
        0,
        1,
    );
    const style = clamp(Number(flow.trunkStyle) || 0, 0, 1);
    const lockStrength = clamp(
        Number.isFinite(Number(flow.backboneLockStrength))
            ? Number(flow.backboneLockStrength)
            : 0.62,
        0,
        1,
    );
    const kind = resolveKind({
        style,
        angleNorm,
        kindSample: sample(localRandom, `trunk_kink_kind_${step}`),
    });
    const supportSteps = resolveSupportSteps({ kind, angleNorm, lockStrength });
    const supportStartArcNorm = (step - 1) / depthSpan;
    const supportEndArcNorm = supportStartArcNorm + (supportSteps / depthSpan);
    if (supportEndArcNorm > MAX_BEND_END_ARC_NORM + EPSILON) return null;

    const direction = sample(localRandom, `trunk_kink_direction_${step}`) < 0.5 ? -1 : 1;
    const angleScale = 0.84 + (sample(localRandom, `trunk_kink_angle_scale_${step}`) * 0.28);
    const angleRad = direction
        * clamp(Math.abs(Number(flow.kinkAngleRad) || 0), 0, MAX_KINK_ANGLE_RAD)
        * angleScale;
    const extentArcNorm = supportSteps / depthSpan;
    const event = createSakuraArticulatedBendEventV1({
        kind,
        centerArcNorm: supportStartArcNorm + (extentArcNorm / 2),
        extentArcNorm,
        angleRad,
        skew: (sample(localRandom, `trunk_kink_skew_${step}`) - 0.5) * 1.36,
        core: clamp(
            0.42
                + (style * 0.16)
                + (sample(localRandom, `trunk_kink_core_${step}`) * 0.18),
            0.38,
            0.78,
        ),
        secondary: 0.38 + (sample(localRandom, `trunk_kink_secondary_${step}`) * 0.24),
        bridge: 0.1 + (sample(localRandom, `trunk_kink_bridge_${step}`) * 0.14),
    });
    const gapSteps = 2 + Math.round(sample(localRandom, `trunk_kink_gap_${step}`) * 3);
    return {
        event,
        direction,
        nextBendEligibleArcNorm: Math.min(
            1,
            event.supportEndArcNorm + (gapSteps / depthSpan),
        ),
    };
};

export const createSakuraTrunkArticulatedBendFlowStateV1 = () => Object.freeze({
    version: SAKURA_TRUNK_ARTICULATED_BEND_FLOW_VERSION,
    activeEvent: null,
    nextBendEligibleArcNorm: MIN_BEND_START_ARC_NORM,
    lastDirection: 0,
});

export const resolveSakuraTrunkArticulatedBendStepV1 = ({
    bendFlow,
    flow,
    step,
    depthSpan,
    localRandom,
} = {}) => {
    if (
        !bendFlow
        || bendFlow.version !== SAKURA_TRUNK_ARTICULATED_BEND_FLOW_VERSION
    ) {
        throw new Error('ZEN_SAKURA_TRUNK_ARTICULATED_BEND_FLOW_INVALID');
    }
    if (!Number.isSafeInteger(step) || step < 1) {
        throw new Error('ZEN_SAKURA_TRUNK_ARTICULATED_BEND_STEP_INVALID');
    }
    if (!Number.isSafeInteger(depthSpan) || depthSpan < 2 || step > depthSpan) {
        throw new Error('ZEN_SAKURA_TRUNK_ARTICULATED_BEND_DEPTH_SPAN_INVALID');
    }
    requireRandom(localRandom);

    const arcStartNorm = (step - 1) / depthSpan;
    const arcEndNorm = step / depthSpan;
    let activeEvent = bendFlow.activeEvent;
    let nextBendEligibleArcNorm = Number(bendFlow.nextBendEligibleArcNorm);
    let lastDirection = Number(bendFlow.lastDirection) || 0;
    let started = false;

    const canStart = (
        !activeEvent
        && arcStartNorm + EPSILON >= nextBendEligibleArcNorm
        && arcStartNorm >= MIN_BEND_START_ARC_NORM - EPSILON
        && Number(flow?.kinkChance) > 0
        && Number(flow?.kinkAngleRad) > 0
    );
    if (canStart) {
        const gate = sample(localRandom, `trunk_kink_gate_${step}`);
        const chance = clamp(Number(flow.kinkChance) || 0, 0, 1) * 0.12;
        if (gate < chance) {
            const created = createEvent({ flow, step, depthSpan, localRandom });
            if (created) {
                activeEvent = created.event;
                nextBendEligibleArcNorm = created.nextBendEligibleArcNorm;
                lastDirection = created.direction;
                started = true;
            }
        }
    }

    const turnDeltaRad = activeEvent
        ? resolveSakuraArticulatedBendTurnDeltaV1({
            event: activeEvent,
            arcStartNorm,
            arcEndNorm,
        })
        : 0;
    const completed = Boolean(
        activeEvent
        && arcEndNorm >= activeEvent.supportEndArcNorm - EPSILON,
    );
    const event = activeEvent;

    return Object.freeze({
        turnDeltaRad,
        started,
        completed,
        event,
        flow: Object.freeze({
            version: SAKURA_TRUNK_ARTICULATED_BEND_FLOW_VERSION,
            activeEvent: completed ? null : activeEvent,
            nextBendEligibleArcNorm,
            lastDirection,
        }),
    });
};
