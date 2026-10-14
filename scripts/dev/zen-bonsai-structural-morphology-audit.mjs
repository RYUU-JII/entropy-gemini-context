import { CANONICAL_LEARNING_STAGE } from '../../src/themes/plugins/zen/model/ZenCoreConfig.js';
import { SakuraSpecies } from '../../src/themes/plugins/zen/model/SakuraSpecies.js';
import {
    BonsaiStructuralScoutEvaluator,
} from '../../src/themes/plugins/zen/model/bonsai/evaluation/BonsaiStructuralScoutEvaluator.js';
import {
    BonsaiMorphologyInfluenceModel,
} from '../../src/themes/plugins/zen/model/bonsai/morphology/BonsaiMorphologyInfluenceModel.js';
import {
    BonsaiMorphologyDiscoveryModel,
} from '../../src/themes/plugins/zen/model/bonsai/morphology/BonsaiMorphologyDiscoveryModel.js';
import {
    BonsaiStructuralDescriptorModel,
} from '../../src/themes/plugins/zen/model/bonsai/morphology/BonsaiStructuralDescriptorModel.js';
import {
    compileSakuraPhenotypeFromLatent,
} from '../../src/themes/plugins/zen/model/v2/SakuraCompiler.js';
import {
    DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
    SAKURA_PREFERENCE_BASIN_V2_FIXED_FACTOR_KEYS,
    resolveSakuraLearningLatentDef,
} from '../../src/themes/plugins/zen/model/v2/SakuraLatentParamApi.js';
import {
    SAKURA_FIXED_DRESSING_FACTOR_KEYS,
    SAKURA_FIXED_STRUCTURAL_PRIOR_FACTOR_KEYS,
    listSakuraActiveLearningFactors,
} from '../../src/themes/plugins/zen/model/v2/SakuraLearningFactorPolicy.js';
import { getDefaultSakuraLatent } from '../../src/themes/plugins/zen/model/v2/SakuraLatentSchema.js';

const DEFAULT_SEED_COUNT = 8;
const SEED_BASE = 20260721;
const TOPOLOGY_HEIGHT = 360;
const DISTANCE_VISIBLE_MIN = 0.015;
const FORM_SHIFT_VISIBLE_MIN = 0.04;
const DISCOVERY_HALTON_DESIGN_COUNT = 24;
const DISCOVERY_TIER_HALTON_DESIGN_COUNT = 64;
const HALTON_BASES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];

const round = (value, digits = 5) => Number(Number(value).toFixed(digits));
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

const resolveSeedCount = () => {
    const token = process.argv.slice(2).find((entry) => entry.startsWith('--seeds='));
    if (!token) return DEFAULT_SEED_COUNT;
    const count = Number(token.slice('--seeds='.length));
    if (!Number.isInteger(count) || count < 3 || count > 64) {
        throw new Error(`ZEN_BONSAI_STRUCTURAL_AUDIT_SEED_COUNT_INVALID:${token}`);
    }
    return count;
};

const resolveLevelValue = (definition, ratio) => {
    const value = ratio <= 0
        ? definition.min
        : ratio >= 1
            ? definition.max
            : definition.min + ((definition.max - definition.min) * ratio);
    return definition.integer ? Math.round(value) : value;
};

const halton = (index, base) => {
    let result = 0;
    let fraction = 1 / base;
    let cursor = index;
    while (cursor > 0) {
        result += fraction * (cursor % base);
        cursor = Math.floor(cursor / base);
        fraction /= base;
    }
    return result;
};

const membershipMap = (sample) => new Map(
    sample.structuralMorphology.classification.memberships.map((entry) => [entry.id, entry.score]),
);

const summarizeFormShift = (lowSamples, highSamples) => {
    const formIds = [...membershipMap(lowSamples[0]).keys()];
    return formIds.map((formId) => {
        const low = mean(lowSamples.map((sample) => membershipMap(sample).get(formId)));
        const high = mean(highSamples.map((sample) => membershipMap(sample).get(formId)));
        return {
            formId,
            low: round(low),
            high: round(high),
            delta: round(high - low),
        };
    }).sort((left, right) => (
        Math.abs(right.delta) - Math.abs(left.delta)
        || left.formId.localeCompare(right.formId)
    ));
};

const summarizeFactor = ({ factor, evaluator, seeds, baseLatent }) => {
    const definition = resolveSakuraLearningLatentDef(factor.key, {
        profile: DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
    });
    if (!definition) {
        throw new Error(`ZEN_BONSAI_STRUCTURAL_AUDIT_FACTOR_DEF_REQUIRED:${factor.key}`);
    }
    const levels = [
        { id: 'low', value: resolveLevelValue(definition, 0) },
        { id: 'mid', value: resolveLevelValue(definition, 0.5) },
        { id: 'high', value: resolveLevelValue(definition, 1) },
    ];
    const samplesByLevel = Object.fromEntries(levels.map((level) => [level.id, []]));
    const allSamples = [];

    levels.forEach((level) => {
        seeds.forEach((seed) => {
            const latent = {
                ...baseLatent,
                [factor.key]: level.value,
            };
            const sample = evaluator.evaluate({
                seed,
                latent: { [factor.key]: level.value },
                phenotype: compileSakuraPhenotypeFromLatent(latent),
            });
            samplesByLevel[level.id].push(sample);
            allSamples.push(sample);
        });
    });

    const pairedDistances = seeds.map((_, index) => BonsaiStructuralDescriptorModel.distance(
        samplesByLevel.low[index].structuralMorphology.descriptor,
        samplesByLevel.high[index].structuralMorphology.descriptor,
    ));
    const formShifts = summarizeFormShift(samplesByLevel.low, samplesByLevel.high);
    const influence = BonsaiMorphologyInfluenceModel.analyze(allSamples, {
        factorKeys: [factor.key],
        maxDriversPerForm: 1,
    });
    const associations = Object.entries(influence.byForm).map(([formId, value]) => ({
        formId,
        ...value.drivers[0],
    })).sort((left, right) => (
        right.strength - left.strength
        || Math.abs(right.quartileEffect) - Math.abs(left.quartileEffect)
        || left.formId.localeCompare(right.formId)
    ));
    const meanDistance = mean(pairedDistances);
    const maxDistance = Math.max(...pairedDistances);
    const maxFormShift = Math.max(...formShifts.map((entry) => Math.abs(entry.delta)));
    const observable = meanDistance >= DISTANCE_VISIBLE_MIN
        || maxFormShift >= FORM_SHIFT_VISIBLE_MIN;

    return {
        factorId: factor.key,
        tier: factor.tier,
        declaredObservability: factor.observability,
        range: {
            min: definition.min,
            mid: levels[1].value,
            max: definition.max,
        },
        structuralSignal: {
            observable,
            meanLowHighDistance: round(meanDistance),
            maxLowHighDistance: round(maxDistance),
            maxNamedFormShift: round(maxFormShift),
        },
        strongestFormShifts: formShifts.slice(0, 4),
        strongestAssociations: associations.slice(0, 4),
        design: influence.design,
        causalClaim: influence.causalClaim,
    };
};

const buildDiscovery = ({ evaluator, factors, seeds, baseLatent }) => {
    if (factors.length > HALTON_BASES.length) {
        throw new Error(`ZEN_BONSAI_STRUCTURAL_AUDIT_HALTON_DIMENSION_EXCEEDED:${factors.length}`);
    }
    const baseDesignLatent = Object.fromEntries(
        factors.map((factor) => [factor.key, baseLatent[factor.key]]),
    );
    const axisDesignLatents = factors.flatMap((factor) => {
        const definition = resolveSakuraLearningLatentDef(factor.key, {
            profile: DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
        });
        return [definition.min, definition.max].map((value) => ({
            ...baseDesignLatent,
            [factor.key]: value,
        }));
    });
    const haltonDesignLatents = Array.from(
        { length: DISCOVERY_HALTON_DESIGN_COUNT },
        (_, designIndex) => factors.reduce((latent, factor, factorIndex) => {
            const definition = resolveSakuraLearningLatentDef(factor.key, {
                profile: DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
            });
            latent[factor.key] = resolveLevelValue(
                definition,
                halton(designIndex + 1, HALTON_BASES[factorIndex]),
            );
            return latent;
        }, {}),
    );
    const factorsByTier = factors.reduce((groups, factor) => {
        if (!groups[factor.tier]) groups[factor.tier] = [];
        groups[factor.tier].push(factor);
        return groups;
    }, {});
    const tierHaltonDesignLatents = Object.values(factorsByTier).flatMap((tierFactors) => (
        Array.from(
            { length: DISCOVERY_TIER_HALTON_DESIGN_COUNT },
            (_, designIndex) => tierFactors.reduce((latent, factor, factorIndex) => {
                const definition = resolveSakuraLearningLatentDef(factor.key, {
                    profile: DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
                });
                latent[factor.key] = resolveLevelValue(
                    definition,
                    halton(designIndex + 1, HALTON_BASES[factorIndex]),
                );
                return latent;
            }, { ...baseDesignLatent }),
        )
    ));
    const designLatents = [
        baseDesignLatent,
        ...axisDesignLatents,
        ...haltonDesignLatents,
        ...tierHaltonDesignLatents,
    ];
    const discoverySeeds = seeds.slice(0, Math.min(4, seeds.length));
    const samples = discoverySeeds.flatMap((seed) => designLatents.map((designLatent) => {
        const latent = {
            ...baseLatent,
            ...designLatent,
        };
        return evaluator.evaluate({
            seed,
            latent: designLatent,
            phenotype: compileSakuraPhenotypeFromLatent(latent),
        });
    }));
    return BonsaiMorphologyDiscoveryModel.analyze(samples, {
        factorKeys: factors.map((factor) => factor.key),
        maxDriversPerForm: 6,
    });
};

const seedCount = resolveSeedCount();
const seeds = Array.from({ length: seedCount }, (_, index) => SEED_BASE + (index * 104729));
const factors = listSakuraActiveLearningFactors();
const evaluator = new BonsaiStructuralScoutEvaluator({
    treeType: 'sakura',
    species: SakuraSpecies,
    stage: {
        ...CANONICAL_LEARNING_STAGE,
        depth: 6,
    },
    topologyHeight: TOPOLOGY_HEIGHT,
});
const baseLatent = getDefaultSakuraLatent();
const factorReports = factors.map((factor) => summarizeFactor({
    factor,
    evaluator,
    seeds,
    baseLatent,
}));
const formDiscovery = buildDiscovery({
    evaluator,
    factors,
    seeds,
    baseLatent,
});

const output = {
    version: 1,
    source: 'zen_bonsai_structural_morphology_audit_v1',
    learningKeyspaceProfile: DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
    generationDetail: 'structural_scout',
    renderUsed: false,
    seedCount,
    samplesPerFactor: seedCount * 3,
    activeFactorCount: factors.length,
    discoveryDesign: {
        baseDesignCount: 1,
        axisDesignCount: factors.length * 2,
        globalHaltonDesignCount: DISCOVERY_HALTON_DESIGN_COUNT,
        tierHaltonDesignCountPerTier: DISCOVERY_TIER_HALTON_DESIGN_COUNT,
        activeTierCount: new Set(factors.map((factor) => factor.tier)).size,
        rationale: 'global_interactions_plus_tier_conditional_coverage',
    },
    fixedKeyspaceFactorCount: SAKURA_PREFERENCE_BASIN_V2_FIXED_FACTOR_KEYS.length,
    fixedDressingFactorKeys: SAKURA_FIXED_DRESSING_FACTOR_KEYS,
    fixedStructuralPriorFactorKeys: SAKURA_FIXED_STRUCTURAL_PRIOR_FACTOR_KEYS,
    thresholds: {
        meanDescriptorDistance: DISTANCE_VISIBLE_MIN,
        namedFormMembershipShift: FORM_SHIFT_VISIBLE_MIN,
    },
    weakOrUnobservableFactorIds: factorReports
        .filter((report) => !report.structuralSignal.observable)
        .map((report) => report.factorId),
    formReachability: formDiscovery.reachabilitySummary,
    formDiscovery,
    factors: factorReports,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
