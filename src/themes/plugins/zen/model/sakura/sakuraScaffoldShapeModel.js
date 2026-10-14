import {
    clamp,
    lerp,
    degToRad,
} from './sakuraMath';
import {
    normalizeAngle,
    smoothstep,
    blendAngles,
    shortestAngleDelta,
} from './sakuraAngleUtils';
import { nextRandom } from './sakuraRandomUtils';
import { sampleCenteredNoise } from './sakuraBranchDynamics';

const TWO_PI = Math.PI * 2;
const MIN_PHYSICAL_WIDTH = 0.05;
const GRAVITY_LOAD_NORMALIZER = 14;

const pow4 = (value) => {
    const v = Math.max(0, Number(value) || 0);
    const squared = v * v;
    return squared * squared;
};

export const createScaffoldBackbonePlan = ({
    rng = null,
    rootAngle = 0,
    sideSign = 1,
    depthLimit = 5,
    gravityStrength = 0.34,
    windStrength = 0.12,
    windBias = 0,
}) => ({
    depthLimit: Math.max(2, Math.round(Number(depthLimit) || 2)),
    rootAngle: normalizeAngle(rootAngle),
    sideSign: sideSign >= 0 ? 1 : -1,
    gravityStrength: clamp(Number(gravityStrength) || 0, 0, 1),
    windStrength: clamp(Number(windStrength) || 0, 0, 1),
    windBias: clamp(Number(windBias) || 0, -1, 1),
    swayPhase: nextRandom(rng, 'scaffold_axis_sway_phase') * TWO_PI,
    swayFreq: lerp(0.42, 1.2, nextRandom(rng, 'scaffold_axis_sway_freq')),
});

export const resolveScaffoldBackboneTargetAngle = (plan = null, depthNorm = 0, physics = null) => {
    if (!plan) {
        return 0;
    }
    const t = clamp(depthNorm, 0, 1);
    const bendingSignal = resolveScaffoldBendingSignal({
        depthNorm: t,
        ...(physics || {}),
    });
    const rootWeight = Math.max(0, 1 - (t * lerp(1.1, 0.8, plan.gravityStrength)))
        * clamp(1 - (bendingSignal.bendPressure * 0.38), 0.22, 1);
    const gravityWeight = plan.gravityStrength * t * bendingSignal.gravityGain;
    const windWeight = plan.windStrength * t * 0.72
        * clamp(1 - (bendingSignal.bendPressure * 0.24), 0.42, 1);
    const tipReleaseWeight = (1 - plan.gravityStrength) * smoothstep(0.72, 1, t) * 0.12
        * clamp(1 - (bendingSignal.bendPressure * 0.52), 0.18, 1);
    const outwardAngle = normalizeAngle(
        plan.rootAngle + ((plan.sideSign >= 0 ? 1 : -1) * degToRad(12)),
    );
    const windAngle = plan.windBias >= 0 ? 0 : Math.PI;

    let vx = Math.cos(plan.rootAngle) * rootWeight;
    let vy = Math.sin(plan.rootAngle) * rootWeight;
    vx += Math.cos(Math.PI / 2) * gravityWeight;
    vy += Math.sin(Math.PI / 2) * gravityWeight;
    vx += Math.cos(windAngle) * windWeight;
    vy += Math.sin(windAngle) * windWeight;
    vx += Math.cos(outwardAngle) * tipReleaseWeight;
    vy += Math.sin(outwardAngle) * tipReleaseWeight;

    const baseAngle = Math.atan2(vy, vx);
    const swayEnvelope = (1 - t) * (0.42 + plan.windStrength * 0.58)
        * clamp(1 - (bendingSignal.bendPressure * 0.28), 0.3, 1);
    const swayAmp = degToRad(lerp(0.3, 4.2, plan.windStrength));
    const sway = Math.sin(plan.swayPhase + (t * TWO_PI * plan.swayFreq)) * swayAmp * swayEnvelope;
    return normalizeAngle(baseAngle + sway);
};

export const resolveScaffoldBendingSignal = ({
    depthNorm = 0,
    segmentLength = 1,
    segmentWidth = MIN_PHYSICAL_WIDTH,
    remainingDepth = 1,
    widthDecay = 0.8,
    lengthDecay = 0.74,
    inheritedLoad = 0,
} = {}) => {
    const t = clamp(depthNorm, 0, 1);
    const safeLength = Math.max(1e-4, Number(segmentLength) || 0);
    const safeWidth = Math.max(MIN_PHYSICAL_WIDTH, Number(segmentWidth) || 0);
    const safeRemainingDepth = Math.max(1, Math.round(Number(remainingDepth) || 1));
    const safeWidthDecay = clamp(Number(widthDecay) || 0.8, 0.45, 0.995);
    const safeLengthDecay = clamp(Number(lengthDecay) || 0.74, 0.34, 0.995);

    let projectedSelfLoad = 0;
    let iterLength = safeLength;
    let iterArea = safeWidth * safeWidth;
    const areaDecay = safeWidthDecay * safeWidthDecay;
    for (let i = 0; i < safeRemainingDepth; i += 1) {
        const localDepthNorm = safeRemainingDepth > 1
            ? (i / (safeRemainingDepth - 1))
            : 0;
        const canopyMassBoost = 1 + (localDepthNorm * 0.35);
        projectedSelfLoad += iterLength * iterArea * canopyMassBoost;
        iterLength *= safeLengthDecay;
        iterArea *= areaDecay;
        if (iterLength <= 1e-6 || iterArea <= 1e-8) {
            break;
        }
    }

    const accumulatedLoad = Math.max(0, Number(inheritedLoad) || 0) + projectedSelfLoad;
    const stiffness = Math.max(1e-6, pow4(safeWidth));
    const bendPressure = accumulatedLoad / (stiffness * GRAVITY_LOAD_NORMALIZER);
    const depthGravityGain = lerp(0.72, 1.36, Math.pow(t, 1.18));
    const gravityGain = clamp(depthGravityGain + Math.min(0.9, bendPressure * 0.82), 0.42, 2.3);

    return {
        projectedSelfLoad,
        accumulatedLoad,
        stiffness,
        bendPressure,
        depthGravityGain,
        gravityGain,
    };
};

export const resolveScaffoldProfileDepthScale = ({
    modeNorm = 0.5,
    depthNorm = 0,
}) => {
    const t = clamp(depthNorm, 0, 1);
    const mode = clamp(modeNorm, 0, 1);

    const triangularLength = lerp(1.18, 0.44, Math.pow(t, 0.78));
    const triangularWidth = lerp(1.02, 0.42, Math.pow(t, 0.98));

    const roundedLength = (
        0.92
        + (Math.sin(Math.PI * t) * 0.24)
        - (smoothstep(0.82, 1, t) * 0.08)
    );
    const roundedWidth = (
        0.94
        + (Math.sin(Math.PI * t) * 0.18)
        - (smoothstep(0.86, 1, t) * 0.06)
    );

    const mushroomLength = (
        0.82
        + (Math.sin(Math.PI * clamp(t / 0.74, 0, 1)) * 0.32)
        - (smoothstep(0.74, 1, t) * 0.24)
    );
    const mushroomWidth = (
        0.82
        + (smoothstep(0.2, 0.66, t) * 0.36)
        - (smoothstep(0.86, 1, t) * 0.22)
    );

    const triToRound = clamp(mode / 0.5, 0, 1);
    const roundToMushroom = clamp((mode - 0.5) / 0.5, 0, 1);
    const lengthScale = mode <= 0.5
        ? lerp(triangularLength, roundedLength, triToRound)
        : lerp(roundedLength, mushroomLength, roundToMushroom);
    const widthScale = mode <= 0.5
        ? lerp(triangularWidth, roundedWidth, triToRound)
        : lerp(roundedWidth, mushroomWidth, roundToMushroom);

    return {
        lengthScale: clamp(lengthScale, 0.44, 1.18),
        widthScale: clamp(widthScale, 0.4, 1.16),
    };
};

export const resolveScaffoldRootBaseLength = ({
    anchorDepthNorm = 0,
    anchorRandom = null,
    planIndex = 0,
    trunkTargetHeight = null,
    scaffoldStrength = 0.5,
    scaffoldShapeMode = 0.5,
}) => {
    if (
        typeof trunkTargetHeight !== 'number'
        || !Number.isFinite(trunkTargetHeight)
        || trunkTargetHeight <= 0
    ) {
        throw new Error('ZEN_SAKURA_SCAFFOLD_TRUNK_TARGET_HEIGHT_REQUIRED');
    }
    const trunkHeightRef = Math.max(48, trunkTargetHeight);
    const depthNorm = clamp(anchorDepthNorm, 0, 1);
    const strengthScale = lerp(0.9, 1.08, clamp(scaffoldStrength, 0, 1));
    const jitter = 1 + (
        nextRandom(anchorRandom, `anchor_${planIndex}_root_length_jitter`) - 0.5
    ) * 0.2;

    // Apply strict Shape Mode (Silhouette) logic to the root lengths
    // mode <= 0.5 is Triangular (Mountain), mode > 0.5 is Rounded/Mushroom
    let shapeRatio = 1;
    if (scaffoldShapeMode <= 0.5) {
        shapeRatio = lerp(
            lerp(0.11, 0.052, Math.pow(depthNorm, 0.72)),
            lerp(0.096, 0.064, Math.pow(depthNorm, 0.9)),
            scaffoldShapeMode * 2
        );
    } else {
        // Rounded / Mushroom Shape: Thickest in the middle or retaining width
        const roundToMushroom = clamp((scaffoldShapeMode - 0.5) * 2, 0, 1);
        const roundedRatio = lerp(0.08, 0.06, depthNorm);
        const mushroomRatio = lerp(0.065, 0.09, Math.sin(depthNorm * Math.PI)) * lerp(1, 0.4, Math.pow(depthNorm, 2));
        shapeRatio = lerp(roundedRatio, mushroomRatio, roundToMushroom);
    }

    return clamp(
        trunkHeightRef * shapeRatio * strengthScale * jitter,
        4.5,
        trunkHeightRef * 0.35, // Allow slightly longer max reach
    );
};

export const resolveScaffoldRootAngle = ({
    childAttach,
    scaffoldSideSign = 1,
    scaffoldRootGlobalPitch = 0,
    scaffoldRootLocalWeight = 0.2,
    worldDownwardRatio = 0,
    localScaffoldOffset = 0,
    rng = null,
    planIndex = 0,
}) => {
    const parentAngle = Number(childAttach?.angle) || 0;
    const localWeight = clamp(scaffoldRootLocalWeight, 0, 1);
    const globalPitch = clamp(Number(scaffoldRootGlobalPitch) || 0, -0.7, 0.7);
    const outwardPitch = degToRad(lerp(10, 20, 1 - localWeight)) + globalPitch;
    // Treat global pitch as outward spread from the trunk, not a world-horizontal target.
    const outwardScaffoldAngle = normalizeAngle(
        parentAngle + ((scaffoldSideSign >= 0 ? 1 : -1) * outwardPitch),
    );
    const localScaffoldAngle = normalizeAngle(parentAngle + localScaffoldOffset);
    const blendedScaffoldAngle = blendAngles(
        outwardScaffoldAngle,
        localScaffoldAngle,
        clamp(0.58 + (localWeight * 0.42), 0, 1),
    );
    const downwardRatio = clamp(Number(worldDownwardRatio) || 0, 0, 1);
    const downwardProgress = smoothstep(0.18, 0.82, downwardRatio);
    const downwardTargetAngle = normalizeAngle(
        (Math.PI / 2)
        - ((scaffoldSideSign >= 0 ? 1 : -1) * degToRad(18)),
    );
    const compositionAngle = blendAngles(
        blendedScaffoldAngle,
        downwardTargetAngle,
        downwardProgress * 0.78,
    );
    const rootAngleJitter = sampleCenteredNoise(
        rng,
        degToRad(2.1),
        `anchor_${planIndex}_root_angle_jitter`,
    );
    const targetRootAngle = normalizeAngle(compositionAngle + rootAngleJitter);
    const desiredRelativeOffset = shortestAngleDelta(targetRootAngle, parentAngle);
    return {
        finalRelativeOffset: desiredRelativeOffset,
        finalChildAngle: normalizeAngle(parentAngle + desiredRelativeOffset),
    };
};
