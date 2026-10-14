import { clamp } from './sakuraMath';

export const resolveSakuraMorphologyProfile = ({
    gene,
    morphologyRandom,
    nextRandom,
}) => {
    const jitter = (scale, key) => (nextRandom(morphologyRandom, key) - 0.5) * scale;
    const nWidthBase = clamp((gene.widthBase - 1) / 6, 0, 1);
    const nTrunkStartWidth = clamp((gene.trunkTierStartWidth - 0.8) / 1.4, 0, 1);
    const nTaperExponent = clamp((gene.taperExponent - 0.8) / 1.4, 0, 1);
    const nWidthTaper = clamp((gene.widthTaper - 0.45) / 0.55, 0, 1);
    const nScaffoldStart = clamp((gene.scaffoldTierStartWidth - 0.7) / 0.8, 0, 1);
    const nTwigStart = clamp((gene.twigTierStartWidth - 0.65) / 0.6, 0, 1);
    const nBranchAngleVar = clamp(gene.branchAngleVar / 0.85, 0, 1);
    const nBranchChaos = clamp(gene.branchChaos, 0, 1);
    const nCurveVar = clamp(gene.curvatureVar, 0, 1);
    const nTwigLengthDecay = clamp((gene.twigTierLengthDecay - 0.5) / 0.46, 0, 1);
    const nTwigWidthDecay = clamp((gene.twigTierWidthDecay - 0.52) / 0.4, 0, 1);

    const baseProfile = {
        trunkMass: clamp(
            0.2 + (nWidthBase * 0.5) + (nTrunkStartWidth * 0.3) + jitter(0.14, 'base_trunk_mass'),
            0,
            1,
        ),
        taperStrength: clamp(
            0.18 + (nTaperExponent * 0.58) + ((1 - nWidthTaper) * 0.34) + jitter(0.14, 'base_taper'),
            0,
            1,
        ),
        branchFineness: clamp(
            0.18 + ((1 - nScaffoldStart) * 0.46) + ((1 - nTwigStart) * 0.3) + (nTaperExponent * 0.12) + jitter(0.16, 'base_fineness'),
            0,
            1,
        ),
        branchStraightness: clamp(
            0.14 + ((1 - nBranchAngleVar) * 0.42) + ((1 - nBranchChaos) * 0.28) + ((1 - nCurveVar) * 0.16) + jitter(0.18, 'base_straightness'),
            0,
            1,
        ),
        twigStartShortness: clamp(
            0.1 + ((1 - nTwigStart) * 0.5) + (nTaperExponent * 0.16) + ((1 - clamp(gene.lengthBase, 0, 1)) * 0.24) + jitter(0.16, 'base_twig_short'),
            0,
            1,
        ),
        twigPersistence: clamp(
            0.12 + (nTwigLengthDecay * 0.58) + (nTwigWidthDecay * 0.26) + (nWidthTaper * 0.12) + jitter(0.14, 'base_twig_persist'),
            0,
            1,
        ),
    };

    const archetypes = [
        {
            trunkMass: 0.74,
            taperStrength: 0.76,
            branchFineness: 0.62,
            branchStraightness: 0.58,
            twigStartShortness: 0.64,
            twigPersistence: 0.72,
        },
        {
            trunkMass: 0.48,
            taperStrength: 0.42,
            branchFineness: 0.34,
            branchStraightness: 0.28,
            twigStartShortness: 0.32,
            twigPersistence: 0.46,
        },
        {
            trunkMass: 0.38,
            taperStrength: 0.84,
            branchFineness: 0.82,
            branchStraightness: 0.84,
            twigStartShortness: 0.8,
            twigPersistence: 0.64,
        },
    ];
    const w0 = 0.2 + nextRandom(morphologyRandom, 'arch_w0');
    const w1 = 0.2 + nextRandom(morphologyRandom, 'arch_w1');
    const w2 = 0.2 + nextRandom(morphologyRandom, 'arch_w2');
    const sumW = w0 + w1 + w2;
    const weights = [w0 / sumW, w1 / sumW, w2 / sumW];
    const arch = archetypes.reduce((acc, item, idx) => {
        acc.trunkMass += item.trunkMass * weights[idx];
        acc.taperStrength += item.taperStrength * weights[idx];
        acc.branchFineness += item.branchFineness * weights[idx];
        acc.branchStraightness += item.branchStraightness * weights[idx];
        acc.twigStartShortness += item.twigStartShortness * weights[idx];
        acc.twigPersistence += item.twigPersistence * weights[idx];
        return acc;
    }, {
        trunkMass: 0,
        taperStrength: 0,
        branchFineness: 0,
        branchStraightness: 0,
        twigStartShortness: 0,
        twigPersistence: 0,
    });

    return {
        trunkMass: clamp(baseProfile.trunkMass * 0.68 + arch.trunkMass * 0.32 + jitter(0.08, 'mix_trunk_mass'), 0, 1),
        taperStrength: clamp(baseProfile.taperStrength * 0.7 + arch.taperStrength * 0.3 + jitter(0.08, 'mix_taper'), 0, 1),
        branchFineness: clamp(baseProfile.branchFineness * 0.66 + arch.branchFineness * 0.34 + jitter(0.1, 'mix_fineness'), 0, 1),
        branchStraightness: clamp(baseProfile.branchStraightness * 0.64 + arch.branchStraightness * 0.36 + jitter(0.1, 'mix_straightness'), 0, 1),
        twigStartShortness: clamp(baseProfile.twigStartShortness * 0.68 + arch.twigStartShortness * 0.32 + jitter(0.1, 'mix_twig_short'), 0, 1),
        twigPersistence: clamp(baseProfile.twigPersistence * 0.68 + arch.twigPersistence * 0.32 + jitter(0.08, 'mix_twig_persist'), 0, 1),
    };
};
