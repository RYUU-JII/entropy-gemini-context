import { DEFAULT_SAKURA_Phenotype } from '../../BonsaiGenetics';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const lerp = (a, b, t) => a + ((b - a) * clamp01(t));
const toNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

export const resolveVNextSakuraProfileV2 = ({
    factorVector = {},
    stage = 'mature',
    descriptors = {},
} = {}) => {
    const defaults = DEFAULT_SAKURA_Phenotype || {};
    const openness = clamp01(descriptors?.openness);
    const trainingIntensity = clamp01(descriptors?.trainingIntensity);
    const vigor = clamp01(descriptors?.vigor);
    const branchRhythm = clamp01(descriptors?.branchRhythm);
    const trunkMovement = clamp01(factorVector.trunk_movement);
    const ramification = clamp01(factorVector.ramification);
    const branchDensity = clamp01(factorVector.branch_density);
    const branchSpread = clamp01(factorVector.branch_spread);
    const apexSoftnessInput = clamp01(factorVector.apex_softness);
    const droopBias = clamp01(factorVector.droop_bias);
    const blossomBias = clamp01(factorVector.blossom_bias);
    const stageBloomGain = stage === 'display'
        ? 0.96
        : (stage === 'mature' ? 0.86 : (stage === 'mid' ? 0.72 : 0.54));
    const bloomPeak = clamp01(lerp(
        0.28,
        0.98,
        (stageBloomGain * 0.42)
        + (blossomBias * 0.34)
        + (openness * 0.12)
        + ((1 - branchDensity) * 0.12),
    ));
    const leafSuppressionAtPeak = clamp01(lerp(
        0.04,
        0.82,
        (bloomPeak * 0.48)
        + (blossomBias * 0.24)
        + (openness * 0.16)
        + ((1 - branchDensity) * 0.12),
    ));
    const petalWarmth = clamp01(lerp(
        0.16,
        0.72,
        (blossomBias * 0.38)
        + (stageBloomGain * 0.26)
        + (trainingIntensity * 0.12)
        + (openness * 0.1),
    ));
    const leafFreshness = clamp01(lerp(
        0.18,
        0.9,
        (bloomPeak * 0.34)
        + (vigor * 0.24)
        + (stageBloomGain * 0.18)
        + (openness * 0.14)
        + ((1 - droopBias) * 0.1),
    ));
    const petalFallDensity = clamp01(lerp(
        0.08,
        0.58,
        (bloomPeak * 0.44)
        + (blossomBias * 0.24)
        + (openness * 0.16)
        + (branchSpread * 0.12),
    ));
    const bloomOuterAdvance = clamp01(lerp(
        0.18,
        0.9,
        (bloomPeak * 0.28)
        + (blossomBias * 0.24)
        + (openness * 0.18)
        + (branchSpread * 0.18)
        + (ramification * 0.12),
    ));
    const bloomInnerDelay = clamp01(lerp(
        0.16,
        0.86,
        ((1 - openness) * 0.2)
        + ((1 - bloomPeak) * 0.12)
        + (branchDensity * 0.24)
        + (ramification * 0.18)
        + ((1 - branchSpread) * 0.12),
    ));
    const bloomPhaseGradient = clamp01(lerp(
        0.22,
        0.96,
        (bloomPeak * 0.24)
        + (blossomBias * 0.22)
        + (openness * 0.18)
        + (branchSpread * 0.16)
        + (ramification * 0.2),
    ));
    const bloomWaveAmplitude = clamp01(lerp(
        0.12,
        0.86,
        (bloomPeak * 0.22)
        + (blossomBias * 0.24)
        + (openness * 0.16)
        + (branchSpread * 0.18)
        + (ramification * 0.2),
    ));
    const bloomWaveApexDelay = clamp01(lerp(
        0.14,
        0.84,
        (apexSoftnessInput * 0.2)
        + (blossomBias * 0.18)
        + (branchDensity * 0.18)
        + ((1 - openness) * 0.16)
        + (ramification * 0.18)
        + ((1 - branchSpread) * 0.1),
    ));
    const bloomWaveLateralAdvance = clamp01(lerp(
        0.18,
        0.92,
        (branchSpread * 0.24)
        + (openness * 0.18)
        + (blossomBias * 0.22)
        + (ramification * 0.16)
        + (bloomOuterAdvance * 0.2),
    ));
    const bloomWaveLineageVariance = clamp01(lerp(
        0.08,
        0.72,
        (branchRhythm * 0.24)
        + (ramification * 0.22)
        + (trainingIntensity * 0.18)
        + (branchSpread * 0.16)
        + (bloomPhaseGradient * 0.2),
    ));
    const petalFallWaveAmplitude = clamp01(lerp(
        0.12,
        0.92,
        (petalFallDensity * 0.34)
        + (blossomBias * 0.18)
        + (branchSpread * 0.16)
        + (bloomWaveAmplitude * 0.18)
        + (ramification * 0.14),
    ));
    const petalFallOuterDrift = clamp01(lerp(
        0.16,
        0.94,
        (petalFallDensity * 0.22)
        + (branchSpread * 0.22)
        + (openness * 0.14)
        + (bloomOuterAdvance * 0.22)
        + (bloomWaveLateralAdvance * 0.2),
    ));
    const petalFallShelterDelay = clamp01(lerp(
        0.12,
        0.84,
        (branchDensity * 0.24)
        + (ramification * 0.18)
        + ((1 - openness) * 0.16)
        + (bloomInnerDelay * 0.18)
        + (bloomWaveApexDelay * 0.12),
    ));
    const petalFallLineageVariance = clamp01(lerp(
        0.08,
        0.72,
        (branchRhythm * 0.22)
        + (trainingIntensity * 0.18)
        + (petalFallDensity * 0.16)
        + (ramification * 0.18)
        + (bloomWaveLineageVariance * 0.2),
    ));

    const profile = {
        bloomPeak,
        leafSuppressionAtPeak,
        petalWarmth,
        leafFreshness,
        petalFallDensity,
        bloomOuterAdvance,
        bloomInnerDelay,
        bloomPhaseGradient,
        bloomWaveAmplitude,
        bloomWaveApexDelay,
        bloomWaveLateralAdvance,
        bloomWaveLineageVariance,
        petalFallWaveAmplitude,
        petalFallOuterDrift,
        petalFallShelterDelay,
        petalFallLineageVariance,
        speciesCharacter: clamp01(lerp(
            toNumber(defaults.speciesCharacter, 0.83) * 0.88,
            0.94,
            (branchRhythm * 0.38) + (openness * 0.18) + (blossomBias * 0.2) + (trunkMovement * 0.24),
        )),
        branchChaos: clamp01(lerp(
            0.18,
            0.72,
            (trunkMovement * 0.42)
            + ((1 - branchSpread) * 0.12)
            + (trainingIntensity * 0.22)
            + (openness * 0.1)
            + (ramification * 0.14),
        )),
        lengthBase: clamp01(lerp(
            0.46,
            0.82,
            (vigor * 0.28)
            + ((1 - ramification) * 0.18)
            + (trainingIntensity * 0.14)
            + (branchSpread * 0.2)
            + (openness * 0.2),
        )),
        flowerChance: clamp01(lerp(
            0.32,
            0.82,
            (stageBloomGain * 0.32)
            + (openness * 0.18)
            + (blossomBias * 0.38)
            + ((1 - branchDensity) * 0.12),
        )),
        seasonalBloomBias: clamp01(lerp(
            toNumber(defaults.seasonalBloomBias, 0.78),
            0.96,
            stageBloomGain,
        )),
        bloomClusterBias: clamp01(lerp(
            0.24,
            0.66,
            (openness * 0.26)
            + (stageBloomGain * 0.18)
            + (blossomBias * 0.38)
            + (ramification * 0.18),
        )),
        foliageMin: Math.max(2, Math.round(lerp(
            2,
            5,
            (stageBloomGain * 0.4) + (openness * 0.28) + (vigor * 0.32),
        ))),
        foliageVar: Math.max(2, Math.round(lerp(
            2,
            6,
            (branchDensity * 0.36)
            + (ramification * 0.32)
            + (openness * 0.12)
            + (stageBloomGain * 0.2),
        ))),
        twigNodeBloomChance: clamp01(lerp(
            0.06,
            0.3,
            (stageBloomGain * 0.34)
            + (openness * 0.14)
            + (blossomBias * 0.34)
            + (ramification * 0.18),
        )),
        flowerDominance: clamp01(lerp(
            0.14,
            0.68,
            (stageBloomGain * 0.28)
            + (blossomBias * 0.42)
            + (openness * 0.14)
            + ((1 - branchDensity) * 0.08)
            + (ramification * 0.08),
        )),
        flowerOuterBias: clamp01(lerp(
            0.22,
            0.76,
            (openness * 0.3)
            + (branchSpread * 0.18)
            + (blossomBias * 0.32)
            + (stageBloomGain * 0.2),
        )),
        flowerClusterTightness: clamp01(lerp(
            0.08,
            0.52,
            (blossomBias * 0.38)
            + (ramification * 0.22)
            + (openness * 0.18)
            + (stageBloomGain * 0.22),
        )),
        flowerClusterCountBias: clamp01(lerp(
            0.08,
            0.54,
            (blossomBias * 0.34)
            + (branchDensity * 0.16)
            + (ramification * 0.16)
            + (stageBloomGain * 0.2)
            + (openness * 0.14),
        )),
        spurTendency: clamp01(lerp(
            0.18,
            0.84,
            (stageBloomGain * 0.26)
            + (trainingIntensity * 0.16)
            + (openness * 0.24)
            + (blossomBias * 0.2)
            + (ramification * 0.14),
        )),
        apexSoftness: clamp01(lerp(
            0.24,
            0.9,
            (apexSoftnessInput * 0.58)
            + (openness * 0.12)
            + (trainingIntensity * 0.16)
            + (trunkMovement * 0.14),
        )),
        crownOpenness: clamp01(lerp(
            0.34,
            0.94,
            openness,
        )),
        droopTendency: clamp01(lerp(
            0.08,
            0.46,
            (droopBias * 0.56)
            + ((1 - vigor) * 0.18)
            + (openness * 0.18)
            + (branchSpread * 0.08),
        )),
        canopyBloomDensity: clamp01(lerp(
            toNumber(defaults.canopyBloomDensity, 0.56) * 0.72,
            0.68,
            (stageBloomGain * 0.26)
            + (openness * 0.18)
            + (blossomBias * 0.42)
            + (ramification * 0.14),
        )),
    };

    return profile;
};
