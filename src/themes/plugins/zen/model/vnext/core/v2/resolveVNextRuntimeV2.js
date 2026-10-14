import {
    getDefaultFactorVectorV2,
    normalizeFactorVectorV2,
} from '../../factors/FactorSchemaV2';
import {
    clamp,
    clamp01,
    lerp,
    round,
    signedCentered,
    toNumber,
} from './VNextGrowthMath';
import { resolveVNextSakuraProfileV2 } from '../../species/VNextSakuraProfileV2';

const resolveStageProfile = (stage = 'mature') => {
    switch (stage) {
        case 'seedling':
            return {
                vigorGain: 0.84,
                trainingGain: 0.34,
                ramificationGain: 0.42,
            };
        case 'mid':
            return {
                vigorGain: 0.96,
                trainingGain: 0.58,
                ramificationGain: 0.72,
            };
        case 'display':
            return {
                vigorGain: 0.9,
                trainingGain: 0.72,
                ramificationGain: 1,
            };
        case 'mature':
        default:
            return {
                vigorGain: 1,
                trainingGain: 0.66,
                ramificationGain: 0.88,
            };
    }
};

export const resolveVNextRuntimeV2 = ({
    factors = {},
    stage = 'mature',
    constraints = {},
} = {}) => {
    const factorVector = normalizeFactorVectorV2({
        ...getDefaultFactorVectorV2(),
        ...(factors || {}),
    });
    const stageProfile = resolveStageProfile(stage);
    const maxDepth = Math.max(3, Math.floor(toNumber(constraints?.maxDepth, 8)));
    const width = Math.max(120, toNumber(constraints?.bounds?.width, 420));
    const height = Math.max(120, toNumber(constraints?.bounds?.height, 420));

    const trunkDivision = clamp01(factorVector.trunk_division);
    const trunkLean = clamp01(factorVector.trunk_lean);
    const trunkMovement = clamp01(factorVector.trunk_movement);
    const trunkPrimarySweep = clamp01(factorVector.trunk_primary_sweep);
    const trunkCounterSweep = clamp01(factorVector.trunk_counter_sweep);
    const trunkApexReach = clamp01(factorVector.trunk_apex_reach);
    const trunkVoidRespect = clamp01(factorVector.trunk_void_respect);
    const trunkTaper = clamp01(factorVector.trunk_taper);
    const trunkHeight = clamp01(factorVector.trunk_height);
    const firstBranchHeight = clamp01(factorVector.first_branch_height);
    const apexSoftnessInput = clamp01(factorVector.apex_softness);
    const branchDensity = clamp01(factorVector.branch_density);
    const branchSpread = clamp01(factorVector.branch_spread);
    const lineageSweepPersistence = clamp01(factorVector.lineage_sweep_persistence);
    const lineageRecoveryBias = clamp01(factorVector.lineage_recovery_bias);
    const padCompactnessInput = clamp01(factorVector.pad_compactness);
    const padTerminalDensityInput = clamp01(factorVector.pad_terminal_density);
    const padSweepBiasInput = clamp01(factorVector.pad_sweep_bias);
    const ramification = clamp01(factorVector.ramification);
    const crownOpennessInput = clamp01(factorVector.crown_openness);
    const droopBias = clamp01(factorVector.droop_bias);
    const blossomBias = clamp01(factorVector.blossom_bias);

    const openness = clamp01(
        (crownOpennessInput * 0.68)
        + ((1 - branchDensity) * 0.32),
    );
    const lightSeeking = clamp01(
        0.18
        + (crownOpennessInput * 0.28)
        + (trunkHeight * 0.24)
        + (apexSoftnessInput * 0.1)
        + (stageProfile.vigorGain * 0.24)
        - (droopBias * 0.08),
    );
    const trainingIntensity = clamp01(
        (apexSoftnessInput * 0.34)
        + (trunkMovement * 0.24)
        + (ramification * 0.16)
        + (trunkDivision * 0.1)
        + (stageProfile.trainingGain * 0.16),
    );
    const vigor = clamp01(
        (trunkHeight * 0.3)
        + (lightSeeking * 0.24)
        + (ramification * 0.16)
        + ((1 - droopBias) * 0.08)
        + (stageProfile.vigorGain * 0.22),
    );
    const branchVariation = clamp01(
        0.18
        + (trunkMovement * 0.34)
        + (ramification * 0.18)
        + (crownOpennessInput * 0.14)
        + (Math.abs(signedCentered(trunkLean)) * 0.16),
    );
    const branchRhythm = clamp01(
        (branchSpread * 0.52)
        + (branchVariation * 0.28)
        + (apexSoftnessInput * 0.2),
    );
    const deadwoodRate = clamp01(
        0.02
        + ((1 - vigor) * 0.05)
        + (droopBias * 0.04)
        + (trunkMovement * 0.02),
    );
    const sakuraProfile = resolveVNextSakuraProfileV2({
        factorVector,
        stage,
        descriptors: {
            openness,
            trainingIntensity,
            vigor,
            branchRhythm,
        },
    });
    const padCompactness = clamp01(
        (padCompactnessInput * 0.74)
        + (branchDensity * 0.08)
        + ((1 - branchSpread) * 0.08)
        + (apexSoftnessInput * 0.06)
        + ((1 - crownOpennessInput) * 0.04),
    );
    const padTerminalDensity = clamp01(
        (padTerminalDensityInput * 0.72)
        + (blossomBias * 0.08)
        + (branchDensity * 0.08)
        + (ramification * 0.08)
        + (clamp01(sakuraProfile.flowerChance) * 0.04),
    );
    const padSweepBias = clamp01(
        (padSweepBiasInput * 0.74)
        + (branchSpread * 0.1)
        + (trunkMovement * 0.08)
        + (lineageSweepPersistence * 0.08),
    );

    const runtime = {
        stageProfile,
        sakura: sakuraProfile,
        bounds: {
            width,
            height,
        },
        descriptors: {
            openness: round(openness, 6),
            lightSeeking: round(lightSeeking, 6),
            trainingIntensity: round(trainingIntensity, 6),
            vigor: round(vigor, 6),
            branchRhythm: round(branchRhythm, 6),
            branchVariation: round(branchVariation, 6),
        },
        backbone: {
            trunkCount: trunkDivision < 0.34 ? 1 : (trunkDivision < 0.82 ? 2 : 3),
            segmentCount: clamp(
                Math.round(lerp(
                    6,
                    Math.max(8, maxDepth + 6),
                    clamp01(
                        (trunkHeight * 0.46)
                        + (ramification * 0.16)
                        + (trunkMovement * 0.24)
                        + (Math.max(trunkPrimarySweep, trunkCounterSweep) * 0.14)
                    ),
                )),
                5,
                Math.max(8, maxDepth + 6),
            ),
            baseLength: lerp(
                height * 0.086,
                height * 0.162,
                clamp01(
                    (trunkHeight * 0.58)
                    + (trunkMovement * 0.24)
                    + (Math.max(trunkPrimarySweep, trunkCounterSweep) * 0.18)
                ),
            ),
            taperStrength: trunkTaper,
            curveEnergy: trunkMovement,
            primarySweep: clamp01((trunkPrimarySweep * 0.62) + (trunkMovement * 0.38)),
            counterSweep: clamp01((trunkCounterSweep * 0.64) + (trunkMovement * 0.36)),
            apexReach: clamp01((trunkApexReach * 0.72) + (apexSoftnessInput * 0.28)),
            voidRespect: clamp01((trunkVoidRespect * 0.68) + (crownOpennessInput * 0.32)),
            lean: signedCentered(trunkLean) * 0.56,
            spread: clamp01(0.08 + (trunkDivision * 0.84)),
            apexSubstitutionRate: clamp01(lerp(0.18, 0.92, apexSoftnessInput)),
            firstSplitHeightRatio: firstBranchHeight,
            trainingIntensity,
            vigor,
            windsweptBias: signedCentered(trunkLean) * lerp(0.04, 0.18, trunkMovement),
            apexSoftness: sakuraProfile.apexSoftness,
        },
        budField: {
            targetCount: clamp(
                Math.round(lerp(
                    6,
                    20,
                    clamp01(
                        (branchDensity * 0.52)
                        + (ramification * 0.2)
                        + (branchSpread * 0.12)
                        + (trunkMovement * 0.08)
                        + (crownOpennessInput * 0.08)
                    ),
                )),
                5,
                Math.max(8, maxDepth * 4),
            ),
            openness,
            branchAngleMeanDeg: lerp(16, 58, branchSpread),
            branchAngleVarDeg: lerp(4, 18, branchVariation),
            phototropism: lightSeeking,
            negativeSpaceTarget: openness,
            massBalanceGain: clamp01(0.42 + ((1 - Math.abs(signedCentered(trunkLean))) * 0.16) + (crownOpennessInput * 0.14)),
            spaceAvoidGain: clamp01(0.32 + (crownOpennessInput * 0.44) + (branchDensity * 0.14)),
            crownOpenness: sakuraProfile.crownOpenness,
        },
        scaffold: {
            maxRoots: clamp(
                Math.round(lerp(
                    4,
                    Math.max(6, maxDepth + 2),
                    clamp01(
                        (branchDensity * 0.48)
                        + (ramification * 0.2)
                        + (trunkDivision * 0.14)
                        + (trunkMovement * 0.1)
                        + (crownOpennessInput * 0.08)
                    ),
                )),
                3,
                Math.max(5, maxDepth + 3),
            ),
            supportBias: clamp01(0.46 + (trunkTaper * 0.24) + (apexSoftnessInput * 0.18) + (vigor * 0.12)),
            branchDepthBudget: ramification,
            alternationBias: clamp01(0.38 + ((1 - branchSpread) * 0.18) + (trunkMovement * 0.12) + (crownOpennessInput * 0.1)),
            crownOpenness: openness,
            spurTendency: sakuraProfile.spurTendency,
        },
        pad: {
            compactness: padCompactness,
            terminalDensity: padTerminalDensity,
            sweepBias: padSweepBias,
        },
        lineage: {
            scaffoldDepthLimit: clamp(
                Math.round(lerp(
                    2,
                    Math.max(4, maxDepth + 1),
                    clamp01(
                        (ramification * 0.52)
                        + (trunkHeight * 0.16)
                        + (branchDensity * 0.12)
                        + (trunkMovement * 0.2)
                    ),
                )),
                2,
                Math.max(4, maxDepth + 1),
            ),
            twigDepthLimit: clamp(
                Math.round(lerp(
                    2,
                    Math.max(4, maxDepth + 2),
                    clamp01(
                        (ramification * 0.46)
                        + (stageProfile.ramificationGain * 0.26)
                        + (branchDensity * 0.14)
                        + (trunkMovement * 0.14)
                    ),
                )),
                2,
                Math.max(4, maxDepth + 2),
            ),
            branchDensity,
            branchLengthDecay: clamp01(
                0.32
                + (ramification * 0.24)
                + ((1 - openness) * 0.04)
                + (crownOpennessInput * 0.08)
                + (branchDensity * 0.08)
                - (trunkMovement * 0.06),
            ),
            branchRadiusDecay: clamp01(
                0.4
                + (ramification * 0.12)
                + (trunkTaper * 0.18)
                + (branchDensity * 0.08),
            ),
            apicalDominance: clamp01(0.44 + (trunkHeight * 0.16) + (trunkTaper * 0.18) + ((1 - apexSoftnessInput) * 0.12) + (vigor * 0.1)),
            alternationBias: clamp01(0.38 + ((1 - branchSpread) * 0.18) + (trunkMovement * 0.12) + (crownOpennessInput * 0.1)),
            phototropism: lightSeeking,
            cascadeBias: droopBias,
            windsweptBias: signedCentered(trunkLean) * lerp(0.04, 0.18, trunkMovement),
            trainingIntensity,
            vigor,
            branchRhythm,
            turnVariance: clamp01(
                0.18
                + (branchVariation * 0.5)
                + (trunkMovement * 0.16)
                + (branchSpread * 0.08)
                + (droopBias * 0.08)
                + (ramification * 0.08),
            ),
            sweepPersistence: clamp01(
                (lineageSweepPersistence * 0.74)
                + (clamp01(
                    0.18
                    + (branchSpread * 0.42)
                    + (trainingIntensity * 0.18)
                    + (trunkMovement * 0.14)
                    + (ramification * 0.08)
                ) * 0.26),
            ),
            settleBias: clamp01(
                0.08
                + (apexSoftnessInput * 0.2)
                + (crownOpennessInput * 0.14)
                + ((1 - branchSpread) * 0.1)
                + (trainingIntensity * 0.12)
                + ((1 - trunkMovement) * 0.06),
            ),
            splitBias: clamp01(
                0.18
                + (branchDensity * 0.3)
                + (ramification * 0.24)
                + (openness * 0.16)
                + (branchSpread * 0.08)
                + (trunkMovement * 0.06),
            ),
            spurRate: clamp01(
                0.12
                + (ramification * 0.24)
                + (clamp01(sakuraProfile.spurTendency) * 0.38)
                + (crownOpennessInput * 0.14)
                + (branchDensity * 0.1),
            ),
            recoveryBias: clamp01(
                (lineageRecoveryBias * 0.74)
                + (clamp01(
                    0.2
                    + (trainingIntensity * 0.26)
                    + (vigor * 0.18)
                    + (crownOpennessInput * 0.14)
                    + ((1 - droopBias) * 0.08)
                ) * 0.26),
            ),
            deadwoodRate,
            deadwoodPersistence: clamp01(0.18 + ((1 - vigor) * 0.18) + (trunkMovement * 0.12)),
            sakura: sakuraProfile,
        },
        traceInputs: {
            v2_openness: round(openness, 6),
            v2_light_seeking: round(lightSeeking, 6),
            v2_training_intensity: round(trainingIntensity, 6),
            v2_vigor: round(vigor, 6),
            v2_branch_rhythm: round(branchRhythm, 6),
            v2_lineage_sweep_persistence: round(lineageSweepPersistence, 6),
            v2_lineage_recovery_bias: round(lineageRecoveryBias, 6),
            v2_pad_compactness: round(padCompactnessInput, 6),
            v2_pad_terminal_density: round(padTerminalDensityInput, 6),
            v2_pad_sweep_bias: round(padSweepBiasInput, 6),
            v2_trunk_division: round(trunkDivision, 6),
            v2_trunk_primary_sweep: round(trunkPrimarySweep, 6),
            v2_trunk_counter_sweep: round(trunkCounterSweep, 6),
            v2_trunk_apex_reach: round(trunkApexReach, 6),
            v2_trunk_void_respect: round(trunkVoidRespect, 6),
            v2_blossom_bias: round(sakuraProfile.flowerChance, 6),
            v2_blossom_preference: round(blossomBias, 6),
        },
    };

    return {
        factorVector,
        runtime,
    };
};
