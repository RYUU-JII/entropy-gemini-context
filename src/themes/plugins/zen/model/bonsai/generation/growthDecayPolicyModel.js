import { HardConstraintModel } from './hardConstraintModel';
import { SAKURA_BRANCH_ORDER } from './shapePriorModel';
import { SakuraBranchRoleModel, SAKURA_ROLE_TIER } from './SakuraBranchRoleModel';

const clamp = (value, min, max) => HardConstraintModel.clamp(value, min, max);
const lerp = (a, b, t) => a + (b - a) * t;

export class GrowthDecayPolicyModel {
    static resolveDecayConservativenessByTier(gene) {
        const globalDecayConservativeness = clamp(Number(gene.decayConservativeness ?? 0.46), 0, 1);
        return {
            trunk: globalDecayConservativeness,
            scaffold: clamp(globalDecayConservativeness * 0.72, 0, 1),
            twig: clamp(globalDecayConservativeness * 0.58, 0, 1),
        };
    }

    static getSakuraLengthRatioByTier(gene) {
        const conservativenessByTier = GrowthDecayPolicyModel.resolveDecayConservativenessByTier(gene);
        const liftTowardMax = (value, max, tierConservativeness, strength = 1) => (
            value + ((max - value) * clamp(tierConservativeness * strength, 0, 1))
        );
        const trunkCenter = clamp(
            liftTowardMax(Number(gene.trunkTierLengthDecay ?? 0.84), 0.992, conservativenessByTier.trunk, 0.92),
            0.65,
            0.992,
        );
        const scaffoldCenter = clamp(
            liftTowardMax(Number(gene.scaffoldTierLengthDecay ?? 0.74), 0.986, conservativenessByTier.scaffold, 1),
            0.5,
            0.986,
        );
        const twigCenter = clamp(
            liftTowardMax(Number(gene.twigTierLengthDecay ?? 0.64), 0.84, conservativenessByTier.twig, 1.08),
            0.36,
            0.84,
        );
        const resolveBand = (center, spreadMin, spreadMax, minClamp, maxClamp) => {
            const min = clamp(center - spreadMin, minClamp, maxClamp);
            const max = clamp(center + spreadMax, min, maxClamp);
            return { min, max };
        };
        return {
            trunkMain: resolveBand(trunkCenter, 0.03, 0.03, 0.65, 0.995),
            branchMain: resolveBand(scaffoldCenter, 0.05, 0.06, 0.5, 0.99),
            branchSide: resolveBand(clamp(scaffoldCenter * 0.96, 0.48, 0.985), 0.06, 0.07, 0.46, 0.985),
            twigMain: resolveBand(twigCenter, 0.07, 0.06, 0.34, 0.86),
            twigSide: resolveBand(clamp(twigCenter * 0.88, 0.3, 0.78), 0.07, 0.06, 0.28, 0.78),
        };
    }

    static getSakuraWidthReductionByTier(gene) {
        const conservativenessByTier = GrowthDecayPolicyModel.resolveDecayConservativenessByTier(gene);
        const liftTowardMax = (value, max, tierConservativeness, strength = 1) => (
            value + ((max - value) * clamp(tierConservativeness * strength, 0, 1))
        );
        const trunkCenter = clamp(
            liftTowardMax(Number(gene.trunkTierWidthDecay ?? 0.92), 0.997, conservativenessByTier.trunk, 0.88),
            0.72,
            0.997,
        );
        const scaffoldCenter = clamp(
            liftTowardMax(Number(gene.scaffoldTierWidthDecay ?? 0.8), 0.994, conservativenessByTier.scaffold, 0.96),
            0.55,
            0.994,
        );
        const twigCenter = clamp(
            liftTowardMax(Number(gene.twigTierWidthDecay ?? 0.68), 0.9, conservativenessByTier.twig, 1.04),
            0.45,
            0.9,
        );
        return {
            trunkMain: trunkCenter,
            branchMain: scaffoldCenter,
            branchSide: clamp(scaffoldCenter * 0.96, 0.55, 0.994),
            twigMain: twigCenter,
            twigSide: clamp(twigCenter * 0.9, 0.45, 0.9),
        };
    }

    static resolveSakuraDimensions({
        gene,
        progress,
        isTrunk: _isTrunk,
        isTwig,
        config,
        branchOrder = SAKURA_BRANCH_ORDER.TRUNK,
        length,
        width,
        lengthMult,
        trunkInternodeDecay = null,
        trunkWidthDecay = null,
        lengthRatioByTier,
        widthReductionByTier,
        morphologyProfile = null,
        twigLevel = 0,
    }) {
        const isContinuation = config?.isContinuation === true;
        const transitionWidthBoost = clamp(
            Number(config?.transitionWidthBoost ?? 1),
            0.75,
            1.5,
        );
        const sideWidthFloorBoost = clamp(
            Number(config?.sideWidthFloorBoost ?? 1),
            1,
            1.8,
        );
        const profile = {
            trunkMass: clamp(Number(morphologyProfile?.trunkMass ?? 0.5), 0, 1),
            taperStrength: clamp(Number(morphologyProfile?.taperStrength ?? 0.5), 0, 1),
            branchFineness: clamp(Number(morphologyProfile?.branchFineness ?? 0.5), 0, 1),
            twigStartShortness: clamp(Number(morphologyProfile?.twigStartShortness ?? 0.5), 0, 1),
            twigPersistence: clamp(Number(morphologyProfile?.twigPersistence ?? 0.5), 0, 1),
        };
        const tierStartWidth = {
            trunk: clamp(Number(gene.trunkTierStartWidth ?? 1), 0.8, 2.5),
            scaffold: clamp(Number(gene.scaffoldTierStartWidth ?? 1), 0.5, 1.5),
            twig: clamp(Number(gene.twigTierStartWidth ?? 0.9), 0.3, 1.2),
        };
        const tierStartNorm = {
            trunk: clamp((tierStartWidth.trunk - 0.8) / 1.7, 0, 1),
            scaffold: clamp((tierStartWidth.scaffold - 0.5) / 1, 0, 1),
            twig: clamp((tierStartWidth.twig - 0.3) / 0.9, 0, 1),
        };
        let transitionLengthScale = 1;
        let transitionWidthScale = 1;
        if (!isContinuation) {
            if (branchOrder === SAKURA_BRANCH_ORDER.TRUNK) {
                // Decouple first scaffold width from trunk thickness to avoid "thick trunk -> sparse side canopy" lock.
                const scaffoldToTrunkRatio = clamp(
                    tierStartWidth.scaffold / Math.max(0.85, tierStartWidth.trunk),
                    0.35,
                    1.25,
                );
                transitionWidthScale = clamp(
                    (0.74 + tierStartNorm.scaffold * 0.2)
                    * Math.pow(scaffoldToTrunkRatio, 0.45)
                    * lerp(1.02, 0.98, tierStartNorm.trunk),
                    0.72,
                    0.96,
                );
                transitionLengthScale = clamp(
                    lerp(0.97, 1.1, tierStartNorm.scaffold)
                    * lerp(1.01, 0.95, tierStartNorm.trunk),
                    0.94,
                    1.14,
                );
            } else if (branchOrder === SAKURA_BRANCH_ORDER.TERMINAL_TWIG) {
                transitionWidthScale = lerp(0.76, 0.94, tierStartNorm.twig);
                transitionLengthScale = lerp(0.88, 1.04, tierStartNorm.twig);
            } else {
                // Non-continuation children from scaffold tiers become terminal twigs.
                const twigToScaffoldRatio = clamp(
                    tierStartWidth.twig / Math.max(0.45, tierStartWidth.scaffold),
                    0.28,
                    1.35,
                );
                transitionWidthScale = clamp(
                    (0.28 + tierStartNorm.twig * 0.64)
                    * Math.pow(twigToScaffoldRatio, 0.7)
                    * lerp(1.02, 0.88, tierStartNorm.scaffold),
                    0.18,
                    0.98,
                );
                transitionLengthScale = clamp(
                    lerp(0.78, 1.06, tierStartNorm.twig)
                    * lerp(1.02, 0.9, tierStartNorm.scaffold),
                    0.72,
                    1.1,
                );
            }
        }
        const role = SakuraBranchRoleModel.classify({ branchOrder });
        const resolvedIsTwig = typeof isTwig === 'boolean' ? isTwig : role.isTwig;

        const branchTier = SakuraBranchRoleModel.resolveTier({
            branchOrder,
            isContinuation,
            forceTerminalTwig: resolvedIsTwig && branchOrder !== SAKURA_BRANCH_ORDER.TERMINAL_TWIG,
        });
        const conservativenessByTier = GrowthDecayPolicyModel.resolveDecayConservativenessByTier(gene);
        const tierConservativeness = (
            branchTier === SAKURA_ROLE_TIER.TRUNK_MAIN
                ? conservativenessByTier.trunk
                : (
                    branchTier === SAKURA_ROLE_TIER.BRANCH_MAIN || branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE
                        ? conservativenessByTier.scaffold
                        : conservativenessByTier.twig
                )
        );
        const liftTowardMax = (value, max, tierConservativeness, strength = 1) => (
            value + ((max - value) * clamp(tierConservativeness * strength, 0, 1))
        );
        const trunkLengthDecay = clamp(
            liftTowardMax(Number(gene.trunkTierLengthDecay ?? 0.84), 0.995, conservativenessByTier.trunk, 0.92),
            0.65,
            0.995,
        );
        const scaffoldLengthDecay = clamp(
            liftTowardMax(Number(gene.scaffoldTierLengthDecay ?? 0.74), 0.99, conservativenessByTier.scaffold, 1),
            0.5,
            0.99,
        );
        const twigLengthDecay = clamp(
            liftTowardMax(Number(gene.twigTierLengthDecay ?? 0.64), 0.84, conservativenessByTier.twig, 1.08),
            0.36,
            0.84,
        );
        const resolvedTrunkInternodeDecay = Number.isFinite(trunkInternodeDecay)
            ? clamp(trunkInternodeDecay, 0.9, 0.999)
            : trunkLengthDecay;
        const continuationLengthDecay = (() => {
            if (branchTier === SAKURA_ROLE_TIER.TRUNK_MAIN) {
                return clamp(
                    Math.max(
                        trunkLengthDecay,
                        lerp(resolvedTrunkInternodeDecay, 1, conservativenessByTier.trunk * 0.08),
                    ),
                    0.9,
                    0.998,
                );
            }
            if (branchTier === SAKURA_ROLE_TIER.BRANCH_MAIN || branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE) {
                return scaffoldLengthDecay;
            }
            return clamp(
                twigLengthDecay * lerp(0.88, 0.98, profile.twigPersistence),
                0.34,
                0.84,
            );
        })();
        const mainDepthDecay = isContinuation ? continuationLengthDecay : 1;

        const lengthBounds = lengthRatioByTier[branchTier];
        const rawLengthRatio = lengthMult * mainDepthDecay;
        const boundedLengthRatio = clamp(rawLengthRatio, lengthBounds.min, lengthBounds.max);
        let finalLengthRatio = boundedLengthRatio;
        if (branchTier === SAKURA_ROLE_TIER.TWIG_MAIN || branchTier === SAKURA_ROLE_TIER.TWIG_SIDE) {
            const twigDepthNorm = clamp(twigLevel / 3, 0, 1);
            const startShortScale = lerp(1, lerp(0.88, 0.68, profile.twigStartShortness), 1 - twigDepthNorm);
            const persistenceScale = lerp(1, lerp(0.9, 1.02, profile.twigPersistence), twigDepthNorm);
            finalLengthRatio = clamp(boundedLengthRatio * startShortScale * persistenceScale, 0.32, 0.86);
        }
        if (!isContinuation) {
            finalLengthRatio = clamp(finalLengthRatio * transitionLengthScale, 0.32, 0.98);
        }
        const lengthLossScaleBase = (() => {
            if (branchTier === SAKURA_ROLE_TIER.TRUNK_MAIN) return 0.32;
            if (branchTier === SAKURA_ROLE_TIER.BRANCH_MAIN) return 0.28;
            if (branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE) return 0.34;
            if (branchTier === SAKURA_ROLE_TIER.TWIG_MAIN) return 0.74;
            return 0.82;
        })();
        const lengthLossScale = clamp(
            lengthLossScaleBase * lerp(1, 0.55, tierConservativeness),
            0.06,
            0.92,
        );
        const continuationTier = (
            branchTier === SAKURA_ROLE_TIER.TRUNK_MAIN
            || branchTier === SAKURA_ROLE_TIER.BRANCH_MAIN
            || branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE
        );
        const effectiveLengthRatio = clamp(
            1 - ((1 - finalLengthRatio) * lengthLossScale),
            continuationTier ? 0.4 : 0.36,
            continuationTier ? 0.988 : 0.982,
        );
        const nextLength = length * effectiveLengthRatio;

        const taperPowBase = Math.max(0.62, gene.taperExponent * (0.88 + progress * 0.16));
        const taperPow = resolvedIsTwig ? taperPowBase * 0.82 : taperPowBase;
        const tierTaperPow = branchTier === SAKURA_ROLE_TIER.TRUNK_MAIN
            ? Math.min(1.05, taperPow)
            : branchTier === SAKURA_ROLE_TIER.BRANCH_MAIN
                ? Math.min(1.08, taperPow * 0.94)
                : branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE
                    ? Math.min(1.12, taperPow * 0.96)
                    : taperPow;
        const trunkWidthReduction = clamp(
            liftTowardMax(Number(gene.trunkTierWidthDecay ?? 0.92), 0.997, conservativenessByTier.trunk, 0.88),
            0.72,
            0.997,
        );
        const resolvedTrunkWidthDecay = Number.isFinite(trunkWidthDecay)
            ? clamp(trunkWidthDecay, 0.88, 0.9995)
            : trunkWidthReduction;
        let reduction = widthReductionByTier[branchTier];
        if (branchTier === SAKURA_ROLE_TIER.TRUNK_MAIN) {
            reduction = Math.max(trunkWidthReduction, resolvedTrunkWidthDecay);
            reduction *= lerp(1.04, 0.84, profile.taperStrength);
            reduction *= lerp(0.95, 1.04, profile.trunkMass);
        } else if (!isContinuation) {
            const sideBase = Number.isFinite(config.widthMult) ? config.widthMult : 0.7;
            reduction *= clamp(0.92 + (sideBase - 0.7) * 0.45, 0.82, 1.08);
        }
        if (branchTier !== SAKURA_ROLE_TIER.TRUNK_MAIN) {
            reduction *= lerp(1.02, 0.96, profile.branchFineness);
        }
        const reductionWindow = (() => {
            if (branchTier === SAKURA_ROLE_TIER.TRUNK_MAIN) {
                return { min: 0.9, max: 0.978 };
            }
            if (branchTier === SAKURA_ROLE_TIER.BRANCH_MAIN) {
                return isContinuation
                    ? { min: 0.8, max: 0.945 }
                    : { min: 0.72, max: 0.89 };
            }
            if (branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE) {
                return { min: 0.68, max: 0.88 };
            }
            if (branchTier === SAKURA_ROLE_TIER.TWIG_MAIN) {
                return { min: 0.6, max: 0.86 };
            }
            return { min: 0.54, max: 0.82 };
        })();
        const effectiveReduction = clamp(
            reduction,
            reductionWindow.min,
            reductionWindow.max,
        );
        const nextWidthRaw = width
            * Math.pow(effectiveReduction, tierTaperPow)
            * transitionWidthScale
            * transitionWidthBoost;
        const widthFloor = branchTier === SAKURA_ROLE_TIER.TRUNK_MAIN
            ? 1.2
            : branchTier === SAKURA_ROLE_TIER.BRANCH_MAIN
                ? 0.78
                : branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE
                    ? 0.52
                    : 0.12;
        const adjustedWidthFloor = branchTier === SAKURA_ROLE_TIER.TRUNK_MAIN
            ? lerp(1.05, 1.5, profile.trunkMass)
            : branchTier === SAKURA_ROLE_TIER.BRANCH_MAIN
                ? lerp(0.88, 0.66, profile.branchFineness)
                : branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE
                    ? lerp(0.58, 0.4, profile.branchFineness)
                    : lerp(0.15, 0.08, profile.branchFineness);
        const branchSideFloor = branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE
            ? widthFloor * sideWidthFloorBoost
            : widthFloor;
        const adjustedBranchSideFloor = branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE
            ? adjustedWidthFloor * sideWidthFloorBoost
            : adjustedWidthFloor;
        const floor = branchTier === SAKURA_ROLE_TIER.TRUNK_MAIN
            ? Math.max(branchSideFloor, adjustedBranchSideFloor)
            : (
                branchTier === SAKURA_ROLE_TIER.BRANCH_MAIN || branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE
                    ? Math.max(branchSideFloor, adjustedBranchSideFloor)
                    : Math.min(branchSideFloor, adjustedBranchSideFloor)
            );
        let nextWidth = Math.max(floor, nextWidthRaw);
        if (
            !isContinuation
            && branchOrder === SAKURA_BRANCH_ORDER.TRUNK
            && (
                branchTier === SAKURA_ROLE_TIER.BRANCH_MAIN
                || branchTier === SAKURA_ROLE_TIER.BRANCH_SIDE
            )
        ) {
            const sideBase = Number.isFinite(config?.widthMult) ? Number(config.widthMult) : 0.7;
            const maxSideRatio = clamp(0.5 + (sideBase - 0.6) * 0.22, 0.42, 0.64);
            const minSideRatio = clamp(0.24 + (sideBase - 0.6) * 0.08, 0.18, 0.36);
            nextWidth = clamp(nextWidth, width * minSideRatio, width * maxSideRatio);
        }
        const monotonicWidthCap = branchTier === SAKURA_ROLE_TIER.TRUNK_MAIN
            ? (isContinuation ? 0.999 : 0.99)
            : (isContinuation ? 0.994 : 0.988);
        nextWidth = Math.min(nextWidth, width * monotonicWidthCap);
        nextWidth = Math.max(0.04, nextWidth);

        return {
            branchTier,
            nextLength,
            nextWidth,
        };
    }

}
