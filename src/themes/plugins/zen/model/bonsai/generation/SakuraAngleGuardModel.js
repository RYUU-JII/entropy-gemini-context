import { SAKURA_BRANCH_ORDER } from './shapePriorModel';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const degToRad = (deg) => (deg * Math.PI) / 180;
const TWO_PI = Math.PI * 2;

const SAKURA_ORDER_CAPS_DEG = Object.freeze({
    TRUNK: { min: 30, max: 46 },
    PRIMARY: { min: 44, max: 96 },
    SECONDARY: { min: 52, max: 112 },
    TWIG: { min: 30, max: 58 },
});

const SAKURA_ORDER_CAPS_THIN_DEG = Object.freeze({
    TRUNK: 24,
    PRIMARY: 42,
    SECONDARY: 48,
    TWIG: 30,
});

const wrapAngle = (angle) => {
    let out = Number.isFinite(angle) ? angle : 0;
    while (out <= -Math.PI) out += TWO_PI;
    while (out > Math.PI) out -= TWO_PI;
    return out;
};

const nextRandom = (rng, decisionType) => {
    if (typeof rng?.next === 'function') {
        const value = Number(rng.next(decisionType));
        if (Number.isFinite(value)) {
            return value;
        }
    }
    // Canonical path must stay deterministic under CRN.
    return 0.5;
};

const softClampToRange = (value, min, max, softness = 2) => {
    const safeMin = Number(min);
    const safeMax = Number(max);
    const safeValue = Number(value);
    if (!Number.isFinite(safeMin) || !Number.isFinite(safeMax) || !(safeMax > safeMin)) {
        return safeValue;
    }
    // Preserve in-band values exactly to avoid introducing directional bias
    // when the allowed band is asymmetric around the global vertical axis.
    if (safeValue >= safeMin && safeValue <= safeMax) {
        return safeValue;
    }
    const center = (safeMin + safeMax) * 0.5;
    const radius = Math.max(1e-5, (safeMax - safeMin) * 0.5);
    const normalized = (safeValue - center) / radius;
    const strength = Math.max(0.35, Number(softness) || 1);
    const normalizedSpan = Math.tanh(strength);
    if (normalizedSpan <= 1e-5) {
        return clamp(safeValue, safeMin, safeMax);
    }
    const scaled = clamp(
        Math.tanh(normalized * strength) / normalizedSpan,
        -1,
        1,
    );
    return center + (scaled * radius);
};

const softClampSymmetric = (value, absCap, softness = 2) => {
    const cap = Math.max(1e-5, Number(absCap) || 0);
    return softClampToRange(value, -cap, cap, softness);
};

const alignAngleToReference = (angle, reference) => {
    let out = Number.isFinite(angle) ? angle : 0;
    const ref = Number.isFinite(reference) ? reference : 0;
    while (out - ref <= -Math.PI) out += TWO_PI;
    while (out - ref > Math.PI) out -= TWO_PI;
    return out;
};

const clampAngleAroundReference = ({
    candidateAngle,
    referenceAngle,
    spreadRad,
}) => {
    const ref = Number.isFinite(referenceAngle) ? referenceAngle : 0;
    const spread = Math.max(1e-4, Number(spreadRad) || 0);
    const aligned = alignAngleToReference(candidateAngle, ref);
    return clamp(aligned, ref - spread, ref + spread);
};

const clampAngleByDownwardSinCap = ({
    candidateAngle,
    maxDownSin,
}) => {
    const angle = wrapAngle(candidateAngle);
    const capSin = clamp(Number(maxDownSin), -0.999, 0.999);
    if (!Number.isFinite(capSin)) {
        return angle;
    }
    const currentDownSin = Math.sin(angle);
    if (currentDownSin <= capSin) {
        return angle;
    }
    const side = Math.sign(Math.cos(angle)) || 1;
    const capAbs = Math.asin(capSin);
    const target = side >= 0
        ? capAbs
        : (Math.PI - capAbs);
    return alignAngleToReference(target, angle);
};

const resolveDownwardAbsoluteCap = ({
    isTrunkParent,
    isTwigParent,
    parentDepth,
    verticalBias,
    trunkStyle,
    nextOrder,
    isContinuationChild,
    childDepth,
    maxDepth,
    twigDownwardRatio = 0,
}) => {
    const cascadeAllowance = clamp((trunkStyle - 0.76) * 1.2, 0, 0.55);
    const baseCap = (
        isTrunkParent
            ? lerp(0.24, -0.02, verticalBias)
            : (isTwigParent
                ? lerp(0.46, 0.16, verticalBias)
                : (parentDepth <= 4
                    ? lerp(0.38, 0.08, verticalBias)
                    : lerp(0.72, 0.26, verticalBias)))
    );
    const depthNorm = clamp(
        ((Number(childDepth) || 1) - 1) / Math.max(1, (Number(maxDepth) || 1) - 1),
        0,
        1,
    );
    const isScaffoldChild = (
        nextOrder === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH
        || nextOrder === SAKURA_BRANCH_ORDER.SECONDARY_BRANCH
    );
    const isTwigChild = nextOrder === SAKURA_BRANCH_ORDER.TERMINAL_TWIG;
    const sideSpreadAllowance = !isContinuationChild
        ? (
            isScaffoldChild
                ? (
                    lerp(0.18, 0.62, 1 - verticalBias)
                    + lerp(0.06, 0.24, depthNorm)
                )
                : (isTwigChild
                    ? (
                        lerp(0.12, 0.36, 1 - verticalBias)
                        + lerp(0.04, 0.18, depthNorm)
                    )
                    : 0)
        )
        : 0;
    const continuationEase = isContinuationChild
        ? lerp(0, 0.16, depthNorm * (1 - verticalBias))
        : 0;
    const defaultCap = clamp(
        baseCap + cascadeAllowance + sideSpreadAllowance + continuationEase,
        -0.08,
        1.12,
    );
    const formDownwardRatio = isTwigChild
        ? clamp(Number(twigDownwardRatio) || 0, 0, 1)
        : 0;
    return lerp(defaultCap, degToRad(86), formDownwardRatio);
};

const resolveRelativeBendCap = ({
    maxRelativeBendDeg,
    learningProgress,
    isTrunkMainTransition,
    isSecondTrunkTransition,
    verticalBias,
    trunkTierAngleVar = 0.15,
    trunkTierBranchAngle = 0.5,
    trunkBackboneLockStrength = 0.62,
    nextOrder,
    nextTwigLevel,
    childDepth,
    maxDepth,
    nextWidth,
}) => {
    const relaxedRelativeCap = Math.PI - 0.12;
    const baseRelativeCap = degToRad(maxRelativeBendDeg);
    const annealedRelativeCap = lerp(baseRelativeCap, relaxedRelativeCap, learningProgress);
    let cap = annealedRelativeCap;
    if (isTrunkMainTransition) {
        const trunkTierAngleVarNorm = clamp(trunkTierAngleVar, 0, 1);
        const trunkTierBranchAngleNorm = clamp((trunkTierBranchAngle - 0.1) / 1.4, 0, 1);
        const trunkBackboneLockNorm = clamp(trunkBackboneLockStrength, 0, 1);
        const depthRelativeCapDeg = (
            isSecondTrunkTransition
                ? lerp(78, 96, verticalBias)
                : lerp(92, 114, verticalBias)
        ) + lerp(0, 18, trunkTierAngleVarNorm)
            + lerp(0, 14, trunkTierBranchAngleNorm)
            - lerp(0, 10, trunkBackboneLockNorm);
        cap = Math.min(cap, degToRad(clamp(depthRelativeCapDeg, 62, 132)));
    }
    if (nextOrder === SAKURA_BRANCH_ORDER.TERMINAL_TWIG) {
        const twigLevelNorm = clamp(nextTwigLevel / 3, 0, 1);
        const overMaxDepthNorm = clamp((childDepth - maxDepth + 1) / 3, 0, 1);
        const twigWidthThinness = clamp((0.42 - nextWidth) / 0.3, 0, 1);
        const continuityPhase = Math.max(twigLevelNorm, overMaxDepthNorm, twigWidthThinness);
        const twigContinuityCap = lerp(degToRad(86), degToRad(34), continuityPhase);
        cap = Math.min(cap, twigContinuityCap);
    }
    return Math.max(0.12, cap);
};

const resolveHardBendCap = ({
    nextOrder,
    isContinuationChild,
    isTrunkMainTransition,
    isSecondTrunkTransition,
    trunkTierAngleVar = 0.15,
    trunkTierBranchAngle = 0.5,
    trunkBackboneLockStrength = 0.62,
    nextWidth,
    childDepth,
    maxDepth,
    branchChaos = 0.5,
    branchAngleVar = 0.35,
    maxRelativeBendDeg = 96,
    verticalBias = 0.5,
    rng = null,
    decisionPrefix = 'guard',
}) => {
    const chaos = clamp(branchChaos, 0, 1);
    const branchAngleVarNorm = clamp(branchAngleVar / 0.9, 0, 1);
    const verticalNorm = clamp(verticalBias, 0, 1);
    const trunkTierAngleVarNorm = clamp(trunkTierAngleVar, 0, 1);
    const trunkTierBranchAngleNorm = clamp((trunkTierBranchAngle - 0.1) / 1.4, 0, 1);
    const trunkBackboneLockNorm = clamp(trunkBackboneLockStrength, 0, 1);
    const userBendDeg = clamp(
        Number.isFinite(Number(maxRelativeBendDeg)) ? Number(maxRelativeBendDeg) : 96,
        55,
        140,
    );
    const userBendScale = clamp(
        1 + (((userBendDeg - 96) / 34) * 0.28),
        0.68,
        1.34,
    );
    if (isTrunkMainTransition) {
        const baseDeg = isSecondTrunkTransition
            ? lerp(46, 62, chaos)
            : lerp(52, 70, chaos);
        const tunedDeg = baseDeg
            + lerp(0, 16, trunkTierAngleVarNorm)
            + lerp(0, 12, trunkTierBranchAngleNorm)
            - lerp(0, 10, trunkBackboneLockNorm);
        const scaledDeg = tunedDeg * userBendScale;
        return degToRad(
            clamp(
                scaledDeg,
                isSecondTrunkTransition ? 30 : 34,
                102,
            ),
        );
    }
    const capProfile = nextOrder === SAKURA_BRANCH_ORDER.TRUNK
        ? SAKURA_ORDER_CAPS_DEG.TRUNK
        : nextOrder === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH
            ? SAKURA_ORDER_CAPS_DEG.PRIMARY
            : nextOrder === SAKURA_BRANCH_ORDER.SECONDARY_BRANCH
                ? (isContinuationChild ? SAKURA_ORDER_CAPS_DEG.PRIMARY : SAKURA_ORDER_CAPS_DEG.SECONDARY)
                : SAKURA_ORDER_CAPS_DEG.TWIG;
    const thinProfileDeg = nextOrder === SAKURA_BRANCH_ORDER.TRUNK
        ? SAKURA_ORDER_CAPS_THIN_DEG.TRUNK
        : nextOrder === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH
            ? SAKURA_ORDER_CAPS_THIN_DEG.PRIMARY
            : nextOrder === SAKURA_BRANCH_ORDER.SECONDARY_BRANCH
                ? (isContinuationChild ? SAKURA_ORDER_CAPS_THIN_DEG.PRIMARY : SAKURA_ORDER_CAPS_THIN_DEG.SECONDARY)
                : SAKURA_ORDER_CAPS_THIN_DEG.TWIG;
    const capMix = clamp(
        chaos * 0.68
        + branchAngleVarNorm * 0.24
        + (1 - verticalNorm) * 0.08,
        0,
        1,
    );
    let cap = degToRad(lerp(capProfile.min, capProfile.max, capMix));
    const capJitterDeg = (nextRandom(rng, `${decisionPrefix}_hard_cap_jitter`) - 0.5)
        * lerp(4, 10, branchAngleVarNorm);
    cap = clamp(
        (cap + degToRad(capJitterDeg)) * userBendScale,
        degToRad(capProfile.min - 8),
        degToRad(capProfile.max + 26),
    );
    const depthOver = clamp((childDepth - maxDepth) / 2, 0, 1);
    const thinness = clamp((0.36 - nextWidth) / 0.24, 0, 1);
    const tighten = Math.max(depthOver, thinness);
    return clamp(
        lerp(cap, degToRad(thinProfileDeg), tighten),
        degToRad(16),
        degToRad(124),
    );
};

export class SakuraAngleGuardModel {
    static resolveGuardedChildAngle({
        attachAngle,
        desiredRelativeOffset,
        nextOrder,
        isContinuationChild,
        nextTwigLevel,
        childDepth,
        maxDepth,
        nextWidth,
        isTrunkMainTransition,
        isSecondTrunkTransition,
        isTrunkParent,
        isTwigParent,
        parentDepth,
        verticalBias,
        trunkStyle,
        trunkTierAngleVar = 0.15,
        trunkTierBranchAngle = 0.5,
        trunkBackboneLockStrength = 0.62,
        maxRelativeBendDeg,
        learningProgress,
        priorStrength,
        twigUpwardBiasProb,
        twigDownwardRatio = 0,
        branchChaos,
        branchAngleVar = 0.35,
        trunkReferenceAngle = null,
        trunkAxisSpreadRad = null,
        trunkProjectionIntent = null,
        rng,
        decisionPrefix,
    }) {
        const relativeCap = resolveRelativeBendCap({
            maxRelativeBendDeg,
            learningProgress,
            isTrunkMainTransition,
            isSecondTrunkTransition,
            verticalBias,
            trunkTierAngleVar,
            trunkTierBranchAngle,
            trunkBackboneLockStrength,
            nextOrder,
            nextTwigLevel,
            childDepth,
            maxDepth,
            nextWidth,
        });
        const downwardAbsoluteCap = resolveDownwardAbsoluteCap({
            isTrunkParent,
            isTwigParent,
            parentDepth,
            verticalBias,
            trunkStyle,
            nextOrder,
            isContinuationChild,
            childDepth,
            maxDepth,
            twigDownwardRatio,
        });
        let relativeOffset = softClampSymmetric(desiredRelativeOffset, relativeCap, 2.05);
        if (nextOrder === SAKURA_BRANCH_ORDER.TERMINAL_TWIG && priorStrength > 0) {
            const upwardPrior = twigUpwardBiasProb * priorStrength;
            if (nextRandom(rng, `${decisionPrefix}_twig_upward_bias_gate`) < upwardPrior) {
                const candidateAngle = attachAngle + relativeOffset;
                const downwardMagnitude = Math.max(0, Math.sin(wrapAngle(candidateAngle)));
                if (downwardMagnitude > 0) {
                    const nudge = downwardMagnitude * lerp(0.08, 0.42, priorStrength);
                    relativeOffset -= nudge;
                    relativeOffset = softClampSymmetric(relativeOffset, relativeCap, 2.05);
                }
            }
        }
        const absoluteGuardedAngle = wrapAngle(attachAngle + relativeOffset);
        const downwardSinCap = Math.sin(downwardAbsoluteCap);
        const symmetricDownwardGuardedAngle = clampAngleByDownwardSinCap({
            candidateAngle: absoluteGuardedAngle,
            maxDownSin: downwardSinCap,
        });
        const softRelativeOffset = softClampSymmetric(
            wrapAngle(symmetricDownwardGuardedAngle - attachAngle),
            relativeCap,
            2.2,
        );
        const hardBendCap = resolveHardBendCap({
            nextOrder,
            isContinuationChild,
            isTrunkMainTransition,
            isSecondTrunkTransition,
            trunkTierAngleVar,
            trunkTierBranchAngle,
            trunkBackboneLockStrength,
            nextWidth,
            childDepth,
            maxDepth,
            branchChaos,
            branchAngleVar,
            maxRelativeBendDeg,
            verticalBias,
            rng,
            decisionPrefix,
        });
        let finalRelativeOffset = softClampSymmetric(softRelativeOffset, hardBendCap, 1.45);
        let finalChildAngle = wrapAngle(attachAngle + finalRelativeOffset);
        if (isTrunkMainTransition) {
            const trunkTierAngleVarNorm = clamp(trunkTierAngleVar, 0, 1);
            const trunkBackboneLockNorm = clamp(trunkBackboneLockStrength, 0, 1);
            const trunkStyleNorm = clamp(trunkStyle, 0, 1);
            const derivedProjectionIntent = clamp((trunkStyleNorm - 0.55) / 0.45, 0, 1);
            const projectionIntent = Number.isFinite(Number(trunkProjectionIntent))
                ? clamp(Number(trunkProjectionIntent), 0, 1)
                : derivedProjectionIntent;
            const axisSpreadDeg = isSecondTrunkTransition
                ? lerp(24, 40, clamp(branchChaos, 0, 1))
                : lerp(32, 50, clamp(branchChaos, 0, 1));
            const resolvedSpread = Number.isFinite(trunkAxisSpreadRad)
                ? clamp(
                    Number(trunkAxisSpreadRad)
                        * lerp(0.9, 1.34, clamp(branchChaos, 0, 1))
                        * lerp(0.9, 1.38, trunkTierAngleVarNorm)
                        * lerp(1.16, 0.78, trunkBackboneLockNorm)
                        * lerp(0.94, 1.46, projectionIntent),
                    degToRad(12),
                    degToRad(82),
                )
                : degToRad(axisSpreadDeg * lerp(1, 1.28, projectionIntent));
            const referenceAngle = Number.isFinite(trunkReferenceAngle)
                ? Number(trunkReferenceAngle)
                : -Math.PI / 2;
            const axisClamped = clampAngleAroundReference({
                candidateAngle: finalChildAngle,
                referenceAngle,
                spreadRad: resolvedSpread,
            });
            finalChildAngle = wrapAngle(axisClamped);
            finalRelativeOffset = clamp(wrapAngle(finalChildAngle - attachAngle), -hardBendCap, hardBendCap);
        }
        return {
            finalChildAngle,
            finalRelativeOffset,
        };
    }
}
