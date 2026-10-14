import { CANONICAL_LEARNING_STAGE } from '../../src/themes/plugins/zen/model/ZenCoreConfig.js';
import { SakuraSpecies } from '../../src/themes/plugins/zen/model/SakuraSpecies.js';
import {
    BonsaiStructuralScoutEvaluator,
} from '../../src/themes/plugins/zen/model/bonsai/evaluation/BonsaiStructuralScoutEvaluator.js';
import {
    compileSakuraPhenotypeFromLatent,
} from '../../src/themes/plugins/zen/model/v2/SakuraCompiler.js';
import {
    DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
    resolveSakuraLearningLatentDef,
} from '../../src/themes/plugins/zen/model/v2/SakuraLatentParamApi.js';
import { getDefaultSakuraLatent } from '../../src/themes/plugins/zen/model/v2/SakuraLatentSchema.js';

const SEEDS = Object.freeze([20260721, 20365450, 20470179, 20574908]);
const SEARCH_COUNT = 192;
const HALTON_BASES = Object.freeze([2, 3, 5, 7, 11, 13, 17, 19, 23]);
const TARGETS = Object.freeze({
    informal_upright: Object.freeze([
        'trunk_curve_amp',
        'trunk_curve_freq',
        'backbone_tilt_bias',
        'backbone_sway',
        'trunk_kink_prob',
        'trunk_kink_angle_deg',
    ]),
    umbrella_crown: Object.freeze([
        'scaffold_first_attach_ratio',
        'scaffold_upper_coverage',
        'scaffold_density',
        'scaffold_distribution_mode',
        'scaffold_shape_mode',
        'scaffold_length_decay',
        'scaffold_global_pitch_deg',
        'scaffold_gravity_strength',
    ]),
});

const round = (value, digits = 4) => Number(Number(value).toFixed(digits));
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

const definitionFor = (key) => {
    const definition = resolveSakuraLearningLatentDef(key, {
        profile: DEFAULT_SAKURA_LEARNING_KEYSPACE_PROFILE,
    });
    if (!definition) throw new Error(`ZEN_BONSAI_FORM_AUDIT_FACTOR_DEF_REQUIRED:${key}`);
    return definition;
};

const resolveValue = (key, ratio) => {
    const definition = definitionFor(key);
    const value = ratio <= 0
        ? definition.min
        : ratio >= 1
            ? definition.max
            : definition.min + ((definition.max - definition.min) * ratio);
    return definition.integer ? Math.round(value) : value;
};

const evaluator = new BonsaiStructuralScoutEvaluator({
    treeType: 'sakura',
    species: SakuraSpecies,
    stage: { ...CANONICAL_LEARNING_STAGE, depth: 6 },
    topologyHeight: 360,
});
const baseLatent = getDefaultSakuraLatent();

const evaluate = ({ targetId, patch, seed }) => {
    const latent = { ...baseLatent, ...patch };
    let result;
    try {
        result = evaluator.evaluate({
            seed,
            latent: patch,
            phenotype: compileSakuraPhenotypeFromLatent(latent),
        });
    } catch (error) {
        return {
            invalid: true,
            seed,
            patch,
            error: error instanceof Error ? error.message : String(error),
        };
    }
    const classification = result.structuralMorphology.classification;
    const target = classification.memberships.find((entry) => entry.id === targetId);
    const rank = classification.memberships.findIndex((entry) => entry.id === targetId) + 1;
    return {
        seed,
        patch,
        targetScore: target.score,
        rank,
        winnerId: classification.memberships[0].id,
        winnerScore: classification.memberships[0].score,
        primary: classification.primaryFormId === targetId,
        threshold: classification.threshold,
        descriptor: result.structuralMorphology.descriptor,
        memberships: classification.memberships,
        adaptive: result.topology?.trunkDepthModel || null,
    };
};

const buildPatches = (keys) => {
    const axis = keys.flatMap((key) => [0, 1].map((ratio) => ({
        [key]: resolveValue(key, ratio),
    })));
    const search = Array.from({ length: SEARCH_COUNT }, (_, index) => Object.fromEntries(
        keys.map((key, keyIndex) => [
            key,
            resolveValue(key, halton(index + 1, HALTON_BASES[keyIndex])),
        ]),
    ));
    return [{}, ...axis, ...search];
};

const summarize = (targetId, keys) => {
    const attemptedRows = buildPatches(keys).flatMap((patch) => (
        SEEDS.map((seed) => evaluate({ targetId, patch, seed }))
    ));
    const rows = attemptedRows.filter((row) => !row.invalid);
    const invalidRows = attemptedRows.filter((row) => row.invalid);
    const thresholdRows = rows.filter((row) => row.targetScore >= row.threshold);
    const competitionLosses = thresholdRows.filter((row) => !row.primary);
    const lossesByWinner = Object.fromEntries([...new Set(
        competitionLosses.map((row) => row.winnerId),
    )].sort().map((winnerId) => [winnerId, competitionLosses.filter(
        (row) => row.winnerId === winnerId,
    ).length]));
    const top = [...rows].sort((left, right) => (
        right.targetScore - left.targetScore
        || left.rank - right.rank
        || left.seed - right.seed
    ))[0];
    const topCompetitionLoss = [...competitionLosses].sort((left, right) => (
        right.targetScore - left.targetScore || left.seed - right.seed
    ))[0] || null;
    const bestPrimary = [...rows].filter((row) => row.primary).sort((left, right) => (
        right.targetScore - left.targetScore || left.seed - right.seed
    ))[0] || null;
    const compact = (row) => row && ({
        seed: row.seed,
        patch: row.patch,
        targetScore: row.targetScore,
        rank: row.rank,
        winnerId: row.winnerId,
        winnerScore: row.winnerScore,
        descriptor: {
            trunk: row.descriptor.trunk,
            crown: row.descriptor.crown,
            topology: row.descriptor.topology,
            bounds: row.descriptor.bounds,
            structure: row.descriptor.structure,
        },
        memberships: row.memberships.slice(0, 5),
    });
    const crossSeed = bestPrimary
        ? Array.from({ length: 64 }, (_, index) => evaluate({
            targetId,
            patch: bestPrimary.patch,
            seed: 20260721 + (index * 104729),
        })).filter((row) => !row.invalid)
        : [];
    return {
        targetId,
        search: {
            factorKeys: keys,
            patchCount: buildPatches(keys).length,
            seedCount: SEEDS.length,
            attemptedSampleCount: attemptedRows.length,
            validSampleCount: rows.length,
            invalidSampleCount: invalidRows.length,
            invalidErrors: Object.fromEntries([...new Set(
                invalidRows.map((row) => row.error),
            )].sort().map((error) => [error, invalidRows.filter(
                (row) => row.error === error,
            ).length])),
            invalidSamples: invalidRows.slice(0, 4),
            arcBalanceLimitedSamples: rows.filter((row) => (
                row.adaptive?.trunkAdaptiveArcBalanceLimitedByHardCap
            )).slice(0, 8).map((row) => ({
                seed: row.seed,
                patch: row.patch,
                achievedMaxAdjacentArcRatio:
                    row.adaptive.trunkAdaptiveAchievedMaxAdjacentArcRatio,
            })),
        },
        thresholdCount: thresholdRows.length,
        targetRankOneCount: rows.filter((row) => row.rank === 1).length,
        primaryCount: rows.filter((row) => row.primary).length,
        competitionLossCount: competitionLosses.length,
        competitionLossesByWinner: lossesByWinner,
        topSample: compact(top),
        topCompetitionLoss: compact(topCompetitionLoss),
        bestPrimarySample: compact(bestPrimary),
        bestPrimaryPatchCrossSeed: bestPrimary ? {
            seedCount: crossSeed.length,
            primaryCount: crossSeed.filter((row) => row.primary).length,
            primaryRate: round(crossSeed.filter((row) => row.primary).length / crossSeed.length),
            meanTargetScore: round(
                crossSeed.reduce((sum, row) => sum + row.targetScore, 0) / crossSeed.length,
            ),
            competitorCounts: Object.fromEntries([...new Set(
                crossSeed.filter((row) => !row.primary).map((row) => row.winnerId),
            )].sort().map((winnerId) => [winnerId, crossSeed.filter(
                (row) => !row.primary && row.winnerId === winnerId,
            ).length])),
        } : null,
    };
};

process.stdout.write(`${JSON.stringify({
    version: 1,
    source: 'zen_bonsai_form_competition_audit_v1',
    generationDetail: 'structural_scout',
    renderUsed: false,
    targets: Object.fromEntries(Object.entries(TARGETS).map(([targetId, keys]) => (
        [targetId, summarize(targetId, keys)]
    ))),
}, null, 2)}\n`);
