import { buildStructuralNodeId } from '../../../bonsai/random/StructuralHashRandom';
import {
    buildTopContributions,
    clamp,
    clamp01,
    lerp,
    rotate2D,
    round,
    signedCentered,
    toNumber,
    vecAdd,
    vecLerp,
    vecNormalize2,
    vecScale,
} from './VNextGrowthMath';

const LINEAGE_ACTIONS = Object.freeze([
    'extend',
    'sweep',
    'settle',
    'lateral_split',
    'spur',
    'terminate',
    'deadwoodize',
]);

const resolveNodeRole = (branchOrder = 0) => {
    if (branchOrder <= 0) {
        return 'trunk';
    }
    if (branchOrder >= 3) {
        return 'twig';
    }
    return 'branch';
};

const resolveLineagePhase = (state = {}, runtime = {}) => {
    const lineage = runtime?.lineage || {};
    if (toNumber(state.branchOrder, 1) >= 3) {
        return 'twig';
    }
    if (toNumber(state.depth, 1) >= Math.max(2, toNumber(lineage.scaffoldDepthLimit, 4))) {
        return 'twig';
    }
    return 'scaffold';
};

const resolveSign = (value = 0, fallback = 1) => {
    const direct = Math.sign(toNumber(value, fallback));
    if (direct !== 0) {
        return direct;
    }
    const backup = Math.sign(toNumber(fallback, 1));
    return backup === 0 ? 1 : backup;
};

const createActionCounter = () => LINEAGE_ACTIONS.reduce((acc, key) => ({
    ...acc,
    [key]: 0,
}), {});

const summarizeActionCounts = (counts = {}) => (
    Object.entries(counts)
        .filter(([, value]) => Number(value) > 0)
        .map(([action, count]) => ({
            action,
            count: Math.max(0, Math.floor(toNumber(count, 0))),
        }))
        .sort((left, right) => Number(right?.count || 0) - Number(left?.count || 0))
);

const pushLimited = (list = [], value = null, limit = 10) => {
    if (!Array.isArray(list) || list.length >= Math.max(1, Math.floor(toNumber(limit, 10)))) {
        return;
    }
    list.push(value);
};

const sumContributions = (contributions = {}) => (
    Object.values(contributions).reduce((acc, value) => acc + Number(value || 0), 0)
);

const resolveInitialLineageMode = (site = {}) => {
    const padIntent = site?.padIntent || null;
    if (typeof padIntent?.primaryAction === 'string' && padIntent.primaryAction.length) {
        return padIntent.primaryAction;
    }
    switch (site?.roleBase || site?.role || 'branch') {
        case 'first_branch':
        case 'counter_branch':
        case 'outer_fill':
            return 'sweep';
        case 'apex_feeder':
        case 'upper_balance':
        case 'upper_fill':
            return 'settle';
        case 'inner_balance':
        case 'inner_fill':
        case 'mid_support':
        default:
            return 'extend';
    }
};

const resolvePadIntentActionFit = ({
    padIntent = null,
    action = 'extend',
    phase = 'scaffold',
    depthNorm = 0.5,
} = {}) => {
    if (!padIntent) {
        return 0.5;
    }
    const sweepBias = clamp01(toNumber(padIntent?.sweepBias, 0.5));
    const recoveryBias = clamp01(toNumber(padIntent?.recoveryBias, 0.5));
    const compactness = clamp01(toNumber(padIntent?.compactness, 0.5));
    const branchingBias = clamp01(toNumber(padIntent?.branchingBias, 0.5));
    const terminalDensity = clamp01(toNumber(padIntent?.terminalDensity, 0.5));
    const reachBias = clamp01(toNumber(padIntent?.reachBias, 0.5));
    const targetDepthBias = clamp01(toNumber(padIntent?.targetDepthBias, 0.5));
    switch (action) {
        case 'sweep':
            return clamp01((sweepBias * 0.62) + (reachBias * 0.22) + ((1 - compactness) * 0.16));
        case 'settle':
            return clamp01((recoveryBias * 0.58) + (compactness * 0.24) + ((1 - reachBias) * 0.18));
        case 'lateral_split':
            return clamp01((branchingBias * 0.62) + ((1 - compactness) * 0.14) + (depthNorm * 0.12) + (targetDepthBias * 0.12));
        case 'spur':
            return clamp01((terminalDensity * 0.68) + (compactness * 0.12) + ((phase === 'twig') ? 0.12 : 0));
        case 'terminate':
            return clamp01((terminalDensity * 0.28) + (compactness * 0.22) + ((1 - targetDepthBias) * 0.24));
        case 'extend':
        default:
            return clamp01((reachBias * 0.42) + (branchingBias * 0.22) + ((1 - compactness) * 0.16) + (targetDepthBias * 0.2));
    }
};

const resolveRoleActionFit = ({
    roleBase = 'branch',
    action = 'extend',
    phase = 'scaffold',
    depthNorm = 0.5,
} = {}) => {
    const twigBias = phase === 'twig' ? 0.08 : 0;
    switch (roleBase) {
        case 'first_branch':
        case 'counter_branch':
            switch (action) {
                case 'sweep':
                    return clamp01(0.76 + ((1 - depthNorm) * 0.18));
                case 'lateral_split':
                    return 0.64;
                case 'settle':
                    return clamp01(0.34 + (depthNorm * 0.32));
                case 'extend':
                    return 0.54;
                case 'terminate':
                    return clamp01(0.18 + (depthNorm * 0.24));
                default:
                    return twigBias;
            }
        case 'apex_feeder':
            switch (action) {
                case 'settle':
                    return 0.82;
                case 'extend':
                    return 0.66;
                case 'spur':
                    return clamp01(0.24 + twigBias + (depthNorm * 0.18));
                case 'sweep':
                    return 0.22;
                default:
                    return clamp01(0.18 + twigBias);
            }
        case 'mid_support':
        case 'inner_balance':
        case 'inner_fill':
            switch (action) {
                case 'extend':
                    return 0.74;
                case 'settle':
                    return 0.68;
                case 'lateral_split':
                    return 0.48;
                case 'sweep':
                    return 0.34;
                default:
                    return clamp01(0.16 + twigBias);
            }
        case 'upper_balance':
        case 'upper_fill':
            switch (action) {
                case 'settle':
                    return 0.76;
                case 'extend':
                    return 0.62;
                case 'spur':
                    return clamp01(0.28 + twigBias + (depthNorm * 0.14));
                default:
                    return clamp01(0.18 + twigBias);
            }
        case 'outer_fill':
            switch (action) {
                case 'sweep':
                    return 0.74;
                case 'lateral_split':
                    return 0.6;
                case 'extend':
                    return 0.5;
                default:
                    return clamp01(0.18 + twigBias);
            }
        case 'branch':
        default:
            switch (action) {
                case 'extend':
                    return 0.68;
                case 'settle':
                    return 0.54;
                case 'sweep':
                    return 0.42;
                case 'lateral_split':
                    return 0.4;
                case 'spur':
                    return clamp01(0.24 + twigBias);
                default:
                    return clamp01(0.16 + twigBias);
            }
    }
};

const resolveModeContinuityFit = ({
    state = {},
    action = 'extend',
} = {}) => {
    const mode = state?.mode || 'extend';
    const streak = Math.max(1, Math.floor(toNumber(state?.actionStreak, 1)));
    if (action === mode) {
        if (action === 'sweep') {
            return streak >= 2 ? 0.72 : 0.88;
        }
        if (action === 'settle') {
            return streak >= 2 ? 0.34 : 0.7;
        }
        if (action === 'spur') {
            return 0.7;
        }
        return 0.78;
    }
    if (mode === 'sweep' && action === 'settle') {
        return streak >= 2 ? 1 : 0.68;
    }
    if (mode === 'settle' && (action === 'extend' || action === 'spur' || action === 'sweep')) {
        return 0.9;
    }
    if (mode === 'spur' && action === 'terminate') {
        return 0.92;
    }
    if (mode === 'lateral_split' && action === 'extend') {
        return 0.8;
    }
    return 0.42;
};

const resolveActionPhaseFit = ({
    action = 'extend',
    phase = 'scaffold',
    depthRemaining = 1,
} = {}) => {
    switch (action) {
        case 'extend':
            return phase === 'scaffold' ? 0.76 : 0.62;
        case 'sweep':
            return phase === 'scaffold' ? 0.88 : 0.46;
        case 'settle':
            return phase === 'twig' ? 0.66 : 0.56;
        case 'lateral_split':
            return depthRemaining > 1 ? (phase === 'scaffold' ? 0.86 : 0.58) : 0.16;
        case 'spur':
            return phase === 'twig' ? 0.96 : 0.34;
        case 'terminate':
            return depthRemaining <= 1 ? 0.84 : 0.32;
        case 'deadwoodize':
            return phase === 'twig' && depthRemaining <= 1 ? 0.78 : 0.08;
        default:
            return 0.4;
    }
};

const resolveLineageShape = ({
    action = 'extend',
    state = {},
    phase = 'scaffold',
    bounds = {},
    lineageRuntime = {},
    padIntent = null,
    baseMeanDeg = 24,
    turnVarianceDeg = 12,
    phototropicLift = 0,
    cascadeDrop = 0,
    windTilt = 0,
    sampleRandom,
} = {}) => {
    const motionSign = resolveSign(state?.motionSign, state?.sideSign || state?.heading?.[0] || 1);
    const sweepPersistence = clamp01(lineageRuntime?.sweepPersistence);
    const settleBias = clamp01(lineageRuntime?.settleBias);
    const splitBias = clamp01(lineageRuntime?.splitBias);
    const spurRate = clamp01(lineageRuntime?.spurRate);
    const recoveryBias = clamp01(lineageRuntime?.recoveryBias);
    const padSweepBias = clamp01(toNumber(padIntent?.sweepBias, sweepPersistence));
    const padRecoveryBias = clamp01(toNumber(padIntent?.recoveryBias, recoveryBias));
    const padCompactness = clamp01(toNumber(padIntent?.compactness, 0.5));
    const padBranchingBias = clamp01(toNumber(padIntent?.branchingBias, splitBias));
    const padTerminalDensity = clamp01(toNumber(padIntent?.terminalDensity, spurRate));
    const padReachBias = clamp01(toNumber(padIntent?.reachBias, 0.5));
    const padDroopBias = clamp01(toNumber(padIntent?.droopBias, lineageRuntime?.cascadeBias));
    const jitter = signedCentered(sampleRandom(`${state.id}_${action}_jitter`, state.depth));
    const secondaryJitter = signedCentered(sampleRandom(`${state.id}_${action}_secondary`, state.depth + 7));
    const splitRoll = clamp01(sampleRandom(`${state.id}_${action}_split_roll`, state.depth + 11));
    const xNorm = clamp01(Math.abs(toNumber(state?.position?.[0], 0)) / Math.max(24, toNumber(bounds?.width, 420) * 0.34));
    const centerSign = -resolveSign(state?.position?.[0], motionSign);
    let heading = vecNormalize2(state?.heading || [0, 1, 0]);
    let lengthScale = 1;
    let radiusScale = 1;
    let vigorScale = phase === 'twig' ? 0.84 : 0.92;
    let energyCost = 0.14;
    let spawnLateral = false;
    let lateralHeading = null;
    let lateralVigorScale = 0.78;
    let nextMode = action;
    let nextMotionSign = motionSign;
    let continuationDepthCost = 1;
    let lateralDepthCost = 2;

    switch (action) {
        case 'sweep': {
            const sweepDeg = (motionSign * lerp(baseMeanDeg * 0.42, baseMeanDeg * 1.08, clamp01((sweepPersistence * 0.56) + (padSweepBias * 0.44))))
                + (jitter * turnVarianceDeg * 0.36)
                + (windTilt * 0.68)
                - ((cascadeDrop + (padDroopBias * 4)) * (phase === 'twig' ? 0.18 : 0.08));
            heading = rotate2D(heading, (sweepDeg * Math.PI) / 180);
            lengthScale = phase === 'twig'
                ? lerp(0.82, 1.08, clamp01((padSweepBias * 0.58) + (padReachBias * 0.42)))
                : lerp(1.08, 1.42, clamp01((padSweepBias * 0.54) + (padReachBias * 0.46)));
            radiusScale = 1.02;
            vigorScale = phase === 'twig' ? 0.86 : 0.96;
            energyCost = 0.16;
            nextMode = 'sweep';
            nextMotionSign = motionSign;
            break;
        }
        case 'settle': {
            const settleTurnDeg = (centerSign * lerp(5, 20, clamp01((recoveryBias * 0.46) + (padRecoveryBias * 0.54))))
                + (jitter * turnVarianceDeg * 0.18)
                + (windTilt * 0.2)
                + (phototropicLift * 0.44)
                - ((cascadeDrop + (padDroopBias * 2)) * (phase === 'twig' ? 0.18 : 0.06));
            const settleTurnHeading = rotate2D(heading, (settleTurnDeg * Math.PI) / 180);
            const settleTarget = vecNormalize2([
                lerp(settleTurnHeading[0], centerSign * xNorm * 0.12, 0.3 + (padRecoveryBias * 0.28)),
                Math.abs(settleTurnHeading[1]) + lerp(0.18, 0.5, clamp01((settleBias * 0.44) + (padCompactness * 0.28) + (padRecoveryBias * 0.28))),
                0,
            ]);
            heading = vecNormalize2(vecLerp(settleTurnHeading, settleTarget, 0.42 + (padRecoveryBias * 0.22)));
            lengthScale = phase === 'twig'
                ? lerp(0.74, 0.88, 1 - padCompactness)
                : lerp(0.86, 1, 1 - padCompactness);
            radiusScale = 0.98;
            vigorScale = phase === 'twig' ? 0.88 : 0.94;
            energyCost = 0.07;
            nextMode = 'settle';
            nextMotionSign = resolveSign(heading[0], motionSign);
            break;
        }
        case 'lateral_split': {
            const splitTurnDeg = (jitter * turnVarianceDeg * 0.44)
                + (windTilt * 0.52)
                + (phototropicLift * (phase === 'twig' ? 0.14 : 0.06))
                - (cascadeDrop * (phase === 'twig' ? 0.18 : 0.08));
            heading = rotate2D(heading, (splitTurnDeg * Math.PI) / 180);
            const alternationSign = splitRoll < clamp01(lineageRuntime?.alternationBias) ? -motionSign : motionSign;
            lateralHeading = rotate2D(
                heading,
                ((alternationSign * lerp(baseMeanDeg * 0.58, baseMeanDeg * 1.14, clamp01((splitBias * 0.48) + (padBranchingBias * 0.52))))
                    + (secondaryJitter * turnVarianceDeg * 0.34)) * Math.PI / 180,
            );
            lengthScale = phase === 'twig'
                ? lerp(0.78, 0.94, padBranchingBias)
                : lerp(0.94, 1.12, padBranchingBias);
            radiusScale = 0.96;
            vigorScale = phase === 'twig' ? 0.84 : 0.92;
            energyCost = 0.18;
            spawnLateral = true;
            lateralVigorScale = phase === 'twig' ? 0.78 : 0.86;
            nextMode = 'lateral_split';
            nextMotionSign = resolveSign(heading[0], motionSign);
            continuationDepthCost = 1;
            lateralDepthCost = phase === 'twig' ? 2 : 1;
            break;
        }
        case 'spur': {
            const spurTurnDeg = (jitter * turnVarianceDeg * 0.16)
                + (windTilt * 0.12)
                + (phototropicLift * 0.34)
                - (cascadeDrop * 0.12);
            const spurHeading = rotate2D(heading, (spurTurnDeg * Math.PI) / 180);
            const spurTarget = vecNormalize2([
                lerp(spurHeading[0], motionSign * 0.12, 0.42),
                Math.abs(spurHeading[1]) + lerp(0.32, 0.44, padTerminalDensity),
                0,
            ]);
            heading = vecNormalize2(vecLerp(spurHeading, spurTarget, 0.54));
            lengthScale = lerp(0.28, 0.56, clamp01((spurRate * 0.42) + (padTerminalDensity * 0.58)));
            radiusScale = 0.88;
            vigorScale = 0.8;
            energyCost = 0.08;
            nextMode = 'spur';
            nextMotionSign = resolveSign(heading[0], motionSign);
            continuationDepthCost = 1;
            break;
        }
        case 'deadwoodize': {
            const deadwoodTurnDeg = (jitter * turnVarianceDeg * 0.22)
                + (windTilt * 0.14)
                - (cascadeDrop * 0.22);
            heading = rotate2D(heading, (deadwoodTurnDeg * Math.PI) / 180);
            heading = vecNormalize2([heading[0], heading[1] - 0.08, 0]);
            lengthScale = 0.76;
            radiusScale = 0.9;
            vigorScale = 0.62;
            energyCost = 0.1;
            nextMode = 'deadwoodize';
            nextMotionSign = resolveSign(heading[0], motionSign);
            continuationDepthCost = 2;
            break;
        }
        case 'terminate': {
            lengthScale = 0;
            radiusScale = 1;
            vigorScale = 0.72;
            energyCost = 0;
            nextMode = 'terminate';
            break;
        }
        case 'extend':
        default: {
            const extendTurnDeg = (jitter * turnVarianceDeg * 0.28)
                + (windTilt * 0.58)
                + (phototropicLift * (phase === 'twig' ? 0.18 : 0.08))
                - (cascadeDrop * (phase === 'twig' ? 0.22 : 0.08));
            heading = rotate2D(heading, (extendTurnDeg * Math.PI) / 180);
            if (phase === 'twig') {
                const droopGain = clamp01((toNumber(lineageRuntime?.sakura?.droopTendency, 0) * 0.58) + (padDroopBias * 0.42)) * lerp(0.08, 0.24, clamp01(toNumber(state?.depth, 1) / Math.max(1, toNumber(lineageRuntime?.twigDepthLimit, 3))));
                heading = vecNormalize2([heading[0], heading[1] - droopGain, 0]);
            }
            lengthScale = phase === 'twig'
                ? lerp(0.82, 0.98, padReachBias)
                : lerp(0.98, 1.12, padReachBias);
            radiusScale = phase === 'twig' ? 0.94 : 1;
            vigorScale = phase === 'twig' ? 0.84 : 0.92;
            energyCost = 0.12;
            nextMode = 'extend';
            nextMotionSign = resolveSign(heading[0], motionSign);
            break;
        }
    }

    return {
        action,
        heading,
        lengthScale,
        radiusScale,
        vigorScale,
        energyCost,
        spawnLateral,
        lateralHeading,
        lateralVigorScale,
        nextMode,
        nextMotionSign,
        continuationDepthCost,
        lateralDepthCost,
    };
};

const resolveEligibleActions = ({
    state = {},
    phase = 'scaffold',
    lineageRuntime = {},
    options = {},
} = {}) => {
    const actions = ['extend', 'settle'];
    const depthRemaining = Math.max(0, Math.floor(toNumber(state?.depthRemaining, 0)));
    const padIntent = state?.padIntent || null;
    if (phase === 'scaffold' || toNumber(state?.branchOrder, 1) <= 2) {
        actions.push('sweep');
    }
    if (
        ((((phase === 'twig') && depthRemaining > 0) || depthRemaining > 1))
        && Math.max(0, Math.floor(toNumber(state?.remainingSplitBudget, 0))) > 0
        && toNumber(state?.branchOrder, 1) < 4
        && (
            phase === 'twig'
            || clamp01(toNumber(padIntent?.branchingBias, 0.5)) >= 0.42
        )
    ) {
        actions.push('lateral_split');
    }
    if (
        phase === 'twig'
        || depthRemaining <= 2
        || toNumber(state?.branchOrder, 1) >= 2
        || clamp01(toNumber(padIntent?.terminalDensity, 0.5)) >= 0.6
    ) {
        actions.push('spur');
    }
    if (depthRemaining <= 1 || clamp01(toNumber(state?.energy, 0.5)) < 0.46) {
        actions.push('terminate');
    }
    if (
        options?.enableDeadwood !== false
        && phase === 'twig'
        && depthRemaining <= 1
        && clamp01(toNumber(lineageRuntime?.deadwoodRate, 0)) > 0.01
    ) {
        actions.push('deadwoodize');
    }
    return [...new Set(actions)];
};

const resolveNextDepthBudget = ({
    runtime = {},
    currentState = {},
    nextBranchOrder = 1,
    nextDepth = 1,
    nextDepthRemaining = 0,
} = {}) => {
    const currentPhase = resolveLineagePhase(currentState, runtime);
    const nextPhase = resolveLineagePhase({
        ...currentState,
        branchOrder: nextBranchOrder,
        depth: nextDepth,
    }, runtime);
    if (nextPhase === 'twig' && currentPhase !== 'twig') {
        return Math.max(
            Math.max(0, Math.floor(toNumber(nextDepthRemaining, 0))),
            Math.max(1, Math.floor(toNumber(runtime?.lineage?.twigDepthLimit, 3))) - 1,
        );
    }
    return Math.max(0, Math.floor(toNumber(nextDepthRemaining, 0)));
};

const evaluateLineageCandidate = ({
    action = 'extend',
    state = {},
    phase = 'scaffold',
    phaseDepthLimit = 3,
    bounds = {},
    occupancyField,
    lightField,
    styleField,
    runtime = {},
    sampleRandom,
    options = {},
} = {}) => {
    const lineageRuntime = runtime?.lineage || {};
    const sakura = lineageRuntime?.sakura || {};
    const padIntent = state?.padIntent || null;
    const baseMeanDeg = lerp(14, 54, clamp01(lineageRuntime.branchRhythm));
    const turnVarianceDeg = lerp(3, 26, clamp01(lineageRuntime.turnVariance));
    const phototropicLift = clamp01(lineageRuntime.phototropism) * 10;
    const cascadeDrop = clamp01(lineageRuntime.cascadeBias) * 12;
    const windTilt = toNumber(lineageRuntime.windsweptBias, 0) * lerp(1.4, 8.2, clamp01(toNumber(state?.depth, 1) / Math.max(1, phaseDepthLimit)));
    const shape = resolveLineageShape({
        action,
        state,
        phase,
        bounds,
        lineageRuntime,
        padIntent,
        baseMeanDeg,
        turnVarianceDeg,
        phototropicLift,
        cascadeDrop,
        windTilt,
        sampleRandom,
    });
    const energy = clamp01(toNumber(state?.energy, state?.vigor || 0.5));
    const depthNorm = clamp01(toNumber(state?.depth, 1) / Math.max(1, phaseDepthLimit));
    const probeLength = Math.max(
        2,
        lerp(8, 18, clamp01(toNumber(state?.depthRemaining, 1) / Math.max(1, phaseDepthLimit)))
        * Math.max(0.26, shape.lengthScale || 0),
    );
    const probePosition = shape.action === 'terminate'
        ? [...(state?.position || [0, 0, 0])]
        : vecAdd(state.position, vecScale(shape.heading, probeLength));
    const occupancy = occupancyField?.sampleDensity(probePosition, phase === 'twig' ? 24 : 40) || 0;
    const light = lightField?.sampleWithPhototropism({
        position: probePosition,
        heading: shape.heading,
        bounds,
        phototropismGain: lineageRuntime.phototropism,
    }) || { lightAlign: 0.5, openSkyGain: 0.5 };
    const style = styleField?.sample({
        position: probePosition,
        heading: shape.heading,
        bounds,
    }) || { styleAlign: 0.5, massBalance: 0.5 };
    const roleBase = state?.rootRoleBase || state?.roleBase || 'branch';
    const roleFit = resolveRoleActionFit({
        roleBase,
        action,
        phase,
        depthNorm,
    });
    const padIntentFit = resolvePadIntentActionFit({
        padIntent,
        action,
        phase,
        depthNorm,
    });
    const phaseFit = resolveActionPhaseFit({
        action,
        phase,
        depthRemaining: state?.depthRemaining,
    });
    const continuityFit = resolveModeContinuityFit({
        state,
        action,
    });
    const settleBias = clamp01(lineageRuntime.settleBias);
    const splitBias = clamp01(lineageRuntime.splitBias);
    const spurRate = clamp01(lineageRuntime.spurRate);
    const recoveryBias = clamp01(lineageRuntime.recoveryBias);
    const centerRecovery = clamp01(
        (
            (Math.abs(toNumber(state?.position?.[0], 0)) / Math.max(24, toNumber(bounds?.width, 420) * 0.28))
            + occupancy
            + (Math.max(0, Math.floor(toNumber(state?.actionStreak, 1))) >= 2 ? 0.24 : 0)
            + (recoveryBias * 0.4)
        ) * 0.58,
    );
    const splitFit = action === 'lateral_split'
        ? clamp01(((1 - occupancy) * 0.42) + (splitBias * 0.34) + (phase === 'scaffold' ? 0.16 : 0.06) + (Math.max(0, Math.floor(toNumber(state?.remainingSplitBudget, 0))) > 0 ? 0.08 : 0))
        : 0;
    const spurFit = action === 'spur'
        ? clamp01((spurRate * 0.48) + (clamp01(sakura.spurTendency) * 0.26) + (phase === 'twig' ? 0.18 : 0) + (toNumber(state?.depthRemaining, 0) <= 2 ? 0.12 : 0))
        : 0;
    const terminatePressure = clamp01(((1 - energy) * 0.44) + (occupancy * 0.24) + (toNumber(state?.depthRemaining, 0) <= 1 ? 0.2 : 0) + (phase === 'twig' ? 0.06 : 0));
    const deadwoodFit = action === 'deadwoodize'
        ? clamp01((clamp01(lineageRuntime.deadwoodRate) * 0.46) + (terminatePressure * 0.34) + (clamp01(lineageRuntime.deadwoodPersistence) * 0.2))
        : 0;
    const flowFit = clamp01(
        (clamp01(toNumber(shape?.heading?.[1], 0)) * 0.54)
        + ((1 - clamp01(Math.abs(toNumber(shape?.heading?.[0], 0)))) * 0.18)
        + (clamp01(light?.openSkyGain ?? 0.5) * 0.28),
    );
    const actionPrior = (() => {
        switch (action) {
            case 'extend':
                return 0.04;
            case 'sweep':
                return 0.08;
            case 'settle':
                return 0.02;
            case 'lateral_split':
                return 0.07;
            case 'spur':
                return 0.06;
            case 'terminate':
                return -0.02;
            case 'deadwoodize':
                return -0.04;
            default:
                return 0;
        }
    })();
    const contributions = {
        line_light: round(clamp01(light.lightAlign) * 0.18, 6),
        line_style: round(clamp01(style.styleAlign) * 0.14, 6),
        line_balance: round(clamp01(style.massBalance) * 0.1, 6),
        line_vigor: round(clamp01(toNumber(state?.vigor, 0.5)) * 0.1, 6),
        line_energy: round(energy * 0.12, 6),
        line_clearance: round((1 - occupancy) * 0.14, 6),
        line_flow: round(flowFit * 0.08, 6),
        line_role_fit: round(roleFit * 0.12, 6),
        line_pad_intent: round(padIntentFit * 0.14, 6),
        line_phase_fit: round(phaseFit * 0.1, 6),
        line_continuity: round(continuityFit * 0.06, 6),
        line_action_prior: round(actionPrior, 6),
        line_training: round(clamp01(lineageRuntime.trainingIntensity) * 0.04, 6),
        line_density_penalty: round(-occupancy * 0.14, 6),
        line_termination_penalty: round(
            (action === 'terminate' || action === 'deadwoodize')
                ? 0
                : (-terminatePressure * 0.1),
            6,
        ),
    };

    if (action === 'settle') {
        contributions.line_recovery = round(centerRecovery * 0.08, 6);
        contributions.line_settle_bias = round(settleBias * 0.03, 6);
    }
    if (action === 'sweep') {
        contributions.line_sweep_persistence = round(clamp01(lineageRuntime.sweepPersistence) * 0.16, 6);
    }
    if (action === 'lateral_split') {
        contributions.line_split_fit = round(splitFit * 0.2, 6);
    }
    if (action === 'spur') {
        contributions.line_spur_fit = round(spurFit * 0.24, 6);
    }
    if (action === 'terminate') {
        contributions.line_terminate_pressure = round(terminatePressure * 0.24, 6);
    }
    if (action === 'deadwoodize') {
        contributions.line_deadwood_fit = round(deadwoodFit * 0.22, 6);
    }

    const total = round(sumContributions(contributions), 6);
    const allowSelection = action === 'terminate'
        ? true
        : (action === 'deadwoodize' ? options?.enableDeadwood !== false : true);

    return {
        ...shape,
        action,
        phase,
        occupancy,
        light,
        style,
        total,
        contributions,
        allowSelection,
    };
};

const resolveTerminalTags = ({
    selected = {},
    phase = 'scaffold',
    childOrder = 1,
    depthRemaining = 0,
    lineageRuntime = {},
    padIntent = null,
} = {}) => {
    const terminalMode = typeof padIntent?.terminalMode === 'string' ? padIntent.terminalMode : 'mixed';
    const intentTerminalDensity = clamp01(toNumber(padIntent?.terminalDensity, 0.5));
    if (selected?.action === 'spur' && terminalMode !== 'cluster') {
        return ['terminal:spur'];
    }
    const blossomPotential = clamp01(
        (clamp01(selected?.light?.openSkyGain ?? 0.5) * 0.34)
        + (clamp01(selected?.light?.lightAlign ?? 0.5) * 0.18)
        + ((1 - clamp01(selected?.occupancy)) * 0.18)
        + (clamp01(lineageRuntime?.spurRate) * 0.1)
        + (clamp01(lineageRuntime?.sakura?.flowerChance) * 0.14)
        + (intentTerminalDensity * 0.14)
        + (((phase === 'twig') || childOrder >= 3) ? 0.1 : 0)
        + (selected?.action === 'settle' ? 0.08 : 0)
        + (selected?.action === 'sweep' ? 0.06 : 0)
        + (toNumber(depthRemaining, 0) <= 2 ? 0.1 : 0)
    );
    if (
        (
            terminalMode === 'cluster'
            || ((childOrder >= 2) || phase === 'twig')
        )
        && blossomPotential >= 0.54
    ) {
        return ['terminal:cluster'];
    }
    return [];
};

export const growVNextLineages = ({
    tree,
    occupancyField,
    lightField,
    styleField,
    runtime,
    constraints,
    selectedScaffolds = [],
    sampleRandom,
    pushEvent,
    options = {},
} = {}) => {
    const lineageRuntime = runtime?.lineage || {};
    const bounds = runtime?.bounds || constraints?.bounds || { width: 420, height: 420 };
    const childSlotByParent = new Map();
    const nextSlot = (parentNodeId) => {
        const key = typeof parentNodeId === 'string' ? parentNodeId : 'root';
        const value = childSlotByParent.get(key) || 0;
        childSlotByParent.set(key, value + 1);
        return value;
    };
    const splitBudget = clamp(
        Math.round(lerp(
            2,
            4,
            (clamp01(lineageRuntime.splitBias) * 0.52)
            + (clamp01(lineageRuntime.branchDensity) * 0.32)
            + (clamp01(lineageRuntime.spurRate) * 0.16),
        )),
        2,
        4,
    );
    const queue = selectedScaffolds.map((site, index) => ({
        id: `lineage_${index}`,
        parentNodeId: site.parentNodeId,
        position: site.position,
        heading: site.heading,
        branchOrder: 1,
        depth: 1,
        depthRemaining: Math.max(1, toNumber(lineageRuntime.scaffoldDepthLimit, 4)),
        vigor: clamp01(0.54 + (toNumber(site.vigor, 0.5) * 0.34)),
        energy: clamp01(0.42 + (toNumber(site.vigor, 0.5) * 0.38) + (clamp01(lineageRuntime.vigor) * 0.12)),
        lineIndex: index,
        sideSign: resolveSign(site.sideSign, site.position?.[0] || site.heading?.[0] || 1),
        motionSign: resolveSign(site.sideSign, site.position?.[0] || site.heading?.[0] || 1),
        rootRoleBase: site.roleBase || site.role || 'branch',
        padIntent: site.padIntent || null,
        mode: resolveInitialLineageMode(site),
        actionStreak: 1,
        remainingSplitBudget: Math.max(
            0,
            splitBudget - ((site?.roleBase || site?.role) === 'apex_feeder' ? 1 : 0),
        ),
    }));
    let pruneCount = 0;
    let deadwoodCount = 0;
    const actionCounts = createActionCounter();
    const transitionCounts = {};
    const selectedSamples = [];
    let decisionCount = 0;
    let candidateTotal = 0;

    while (queue.length && tree.nodeCount() < Math.max(24, Math.floor(toNumber(constraints?.maxNodes, 220)))) {
        const state = queue.shift();
        if (!state) {
            continue;
        }
        const parentNode = tree.getNode(state.parentNodeId);
        if (!parentNode || state.depthRemaining <= 0) {
            continue;
        }
        const phase = resolveLineagePhase(state, runtime);
        const phaseDepthLimit = phase === 'twig'
            ? Math.max(2, toNumber(lineageRuntime.twigDepthLimit, state.depthRemaining + 1))
            : Math.max(2, toNumber(lineageRuntime.scaffoldDepthLimit, state.depthRemaining + 1));
        const candidateActions = resolveEligibleActions({
            state,
            phase,
            lineageRuntime,
            options,
        });
        const candidates = candidateActions
            .map((action) => evaluateLineageCandidate({
                action,
                state,
                phase,
                phaseDepthLimit,
                bounds,
                occupancyField,
                lightField,
                styleField,
                runtime,
                sampleRandom,
                options,
            }))
            .filter((candidate) => candidate?.allowSelection !== false)
            .sort((left, right) => Number(right?.total || 0) - Number(left?.total || 0));

        if (!candidates.length) {
            pruneCount += 1;
            continue;
        }

        const selected = candidates[0];
        decisionCount += 1;
        candidateTotal += candidates.length;
        actionCounts[selected.action] = Math.max(0, Math.floor(toNumber(actionCounts[selected.action], 0))) + 1;
        const transitionKey = `${state.mode || 'start'}->${selected.nextMode || selected.action || 'extend'}`;
        transitionCounts[transitionKey] = Math.max(0, Math.floor(toNumber(transitionCounts[transitionKey], 0))) + 1;
        pushLimited(selectedSamples, {
            phase,
            action: selected.action,
            roleBase: state.rootRoleBase || 'branch',
            depth: Math.max(1, Math.floor(toNumber(state.depth, 1))),
            score: round(toNumber(selected.total, 0), 6),
            energy: round(clamp01(toNumber(state.energy, 0.5)), 6),
        }, 12);

        const actionName = `lineage_${selected.action}`;
        pushEvent?.(state.depth, 'ACTION_SELECTED', {
            action: actionName,
            phase,
            candidateCount: Math.max(1, candidates.length),
            scoreTotal: round(toNumber(selected.total, 0), 6),
            topPositive: buildTopContributions(selected.contributions, { positive: true }),
            topNegative: buildTopContributions(selected.contributions, { positive: false }),
        }, {
            nodeId: state.parentNodeId,
            budId: state.id,
            contributions: selected.contributions,
        });

        if (selected.action === 'terminate') {
            pruneCount += 1;
            continue;
        }

        const parentRadius = Math.max(0.18, toNumber(parentNode.radius1, parentNode.radius0 || 0.4));
        const baseLength = Math.max(
            1.2,
            lerp(11, 30, clamp01(toNumber(state.depthRemaining, 1) / Math.max(1, phaseDepthLimit)))
            * lerp(0.58, 0.92, 1 - clamp01(lineageRuntime.branchLengthDecay))
            * (phase === 'twig' ? 0.78 : 1)
            * lerp(0.8, 1.08, clamp01(toNumber(state.vigor, 0.5))),
        );
        const length = Math.max(1, baseLength * Math.max(0.24, toNumber(selected.lengthScale, 1)));
        const p0 = [...state.position];
        const p1 = vecAdd(p0, vecScale(selected.heading, length));
        const radius0 = Math.max(
            0.12,
            parentRadius
            * lerp(0.58, 0.92, 1 - clamp01(lineageRuntime.branchRadiusDecay))
            * (phase === 'twig' ? 0.78 : 0.98)
            * Math.max(0.78, toNumber(selected.radiusScale, 1)),
        );
        const radius1 = Math.max(0.09, radius0 * lerp(0.76, 0.94, clamp01(lineageRuntime.apicalDominance)));
        const childOrder = Math.max(1, Math.floor(toNumber(state.branchOrder, 1)));
        const nodeId = buildStructuralNodeId({
            parentNodeId: parentNode.id,
            depth: parentNode.depth + 1,
            nodeRole: resolveNodeRole(childOrder),
            nodeSlot: nextSlot(parentNode.id),
            decisionType: `${phase}_${state.depth}_${actionName}`,
        });
        const shouldDeadwood = selected.action === 'deadwoodize';
        const role = shouldDeadwood ? 'deadwood' : resolveNodeRole(childOrder);
        const terminalTags = resolveTerminalTags({
            selected,
            phase,
            childOrder,
            depthRemaining: state.depthRemaining,
            lineageRuntime,
            padIntent: state?.padIntent || null,
        });
        const padIntent = state?.padIntent || null;
        const node = tree.addNode({
            id: nodeId,
            parentId: parentNode.id,
            depth: parentNode.depth + 1,
            order: childOrder,
            role,
            p0,
            p1,
            dir: selected.heading,
            length,
            radius0,
            radius1,
            age: parentNode.age + 1,
            vigor: clamp01(toNumber(state.vigor, 0.5) * Math.max(0.62, toNumber(selected.vigorScale, 0.9))),
            lightBudget: clamp01(selected?.light?.lightAlign),
            resourceBudget: clamp01(toNumber(parentNode.resourceBudget, 0.5) * (shouldDeadwood ? 0.7 : 0.9)),
            liveVeinRatio: clamp01(toNumber(parentNode.liveVeinRatio, 1) * (shouldDeadwood ? 0.54 : 0.96)),
            sapFlow: clamp01(toNumber(parentNode.sapFlow, 0.5) * (shouldDeadwood ? 0.58 : 0.92)),
            tags: [
                'engine:v2',
                `phase:${phase}`,
                `action:${actionName}`,
                `gesture:${selected.action}`,
                `lineage_role:${state.rootRoleBase || 'branch'}`,
                ...(padIntent?.id ? [`pad:${padIntent.id}`] : []),
                ...(padIntent?.profile ? [`pad_profile:${padIntent.profile}`] : []),
                ...(padIntent?.terminalMode ? [`pad_terminal:${padIntent.terminalMode}`] : []),
                ...(padIntent?.compactnessClass ? [`pad_compactness:${padIntent.compactnessClass}`] : []),
                ...terminalTags,
                'species:sakura',
            ],
        });
        if (!node) {
            continue;
        }
        occupancyField?.addSegment(p0, p1, {
            nodeId,
            phase,
        });
        if (shouldDeadwood) {
            deadwoodCount += 1;
        }
        pushEvent?.(state.depth, 'SEGMENT_EMITTED', {
            action: actionName,
            phase,
            nodeId,
            parentId: parentNode.id,
            length: round(length, 4),
            order: childOrder,
        }, {
            nodeId,
        });
        if (shouldDeadwood) {
            continue;
        }

        const nextEnergy = clamp01(
            (clamp01(toNumber(state.energy, 0.5)) * 0.68)
            + (clamp01(node.lightBudget) * 0.18)
            + ((1 - clamp01(selected.occupancy)) * 0.12)
            - (Math.max(0, toNumber(selected.energyCost, 0)) * 0.28),
        );
        const nextBaseDepthRemaining = Math.max(0, Math.floor(toNumber(state.depthRemaining, 0)) - Math.max(1, Math.floor(toNumber(selected.continuationDepthCost, 1))));
        const nextDepth = Math.max(1, Math.floor(toNumber(state.depth, 1)) + 1);
        const continuationDepthRemaining = resolveNextDepthBudget({
            runtime,
            currentState: state,
            nextBranchOrder: childOrder,
            nextDepth,
            nextDepthRemaining: nextBaseDepthRemaining,
        });
        if (continuationDepthRemaining > 0) {
            queue.push({
                ...state,
                parentNodeId: nodeId,
                position: p1,
                heading: selected.heading,
                depth: nextDepth,
                depthRemaining: continuationDepthRemaining,
                vigor: clamp01(node.vigor * lerp(0.86, 0.98, clamp01(lineageRuntime.apicalDominance))),
                energy: nextEnergy,
                branchOrder: childOrder,
                mode: selected.nextMode || selected.action,
                actionStreak: (state.mode === (selected.nextMode || selected.action))
                    ? (Math.max(1, Math.floor(toNumber(state.actionStreak, 1))) + 1)
                    : 1,
                motionSign: resolveSign(selected.nextMotionSign, state.motionSign || state.sideSign || 1),
                padIntent: state.padIntent || null,
                remainingSplitBudget: Math.max(
                    0,
                    Math.floor(toNumber(state.remainingSplitBudget, 0)) - (selected.spawnLateral ? 1 : 0),
                ),
            });
        }

        if (
            selected.spawnLateral
            && selected.lateralHeading
            && tree.nodeCount() < Math.max(24, Math.floor(toNumber(constraints?.maxNodes, 220)))
        ) {
            const lateralBranchOrder = Math.min(4, childOrder + 1);
            const lateralDepthRemaining = resolveNextDepthBudget({
                runtime,
                currentState: state,
                nextBranchOrder: lateralBranchOrder,
                nextDepth,
                nextDepthRemaining: Math.max(
                    0,
                    Math.floor(toNumber(state.depthRemaining, 0)) - Math.max(1, Math.floor(toNumber(selected.lateralDepthCost, 1))),
                ),
            });
            if (lateralDepthRemaining > 0) {
                queue.push({
                    id: `${state.id}_lat_${state.depth}`,
                    parentNodeId: nodeId,
                    position: p1,
                    heading: selected.lateralHeading,
                    branchOrder: lateralBranchOrder,
                    depth: nextDepth,
                    depthRemaining: lateralDepthRemaining,
                    vigor: clamp01(node.vigor * Math.max(0.62, toNumber(selected.lateralVigorScale, 0.78))),
                    energy: clamp01(nextEnergy * 0.84),
                    lineIndex: state.lineIndex,
                    sideSign: resolveSign(selected.lateralHeading?.[0], -resolveSign(state.sideSign, state.motionSign || 1)),
                    motionSign: resolveSign(selected.lateralHeading?.[0], -resolveSign(state.motionSign, state.sideSign || 1)),
                    rootRoleBase: state.rootRoleBase || 'branch',
                    padIntent: state.padIntent || null,
                    mode: lateralBranchOrder >= 3 ? 'spur' : 'extend',
                    actionStreak: 1,
                    remainingSplitBudget: Math.max(0, Math.floor(toNumber(state.remainingSplitBudget, 0)) - 1),
                });
            }
        }
    }

    return {
        pruneCount,
        deadwoodCount,
        debug: {
            candidateAverage: round(
                decisionCount > 0
                    ? (candidateTotal / decisionCount)
                    : 0,
                6,
            ),
            decisionCount: Math.max(0, Math.floor(decisionCount)),
            actionCounts,
            transitionCounts,
            topActions: summarizeActionCounts(actionCounts).slice(0, 5),
            selectedSamples,
        },
    };
};
