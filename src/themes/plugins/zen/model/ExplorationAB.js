import {
    Phenotype_FACTOR_DEFS,
    LEARNING_Phenotype_FACTOR_KEYS,
    ROOT_COMPOSITION_Phenotype_FACTOR_KEYS,
    clampPhenotype,
    randomPhenotype,
} from './BonsaiGenetics';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const clampInt = (value, min, max) => Math.min(max, Math.max(min, Math.round(value)));
const DEFAULT_TREE_TYPE = 'sakura';
const resolveTreeType = (treeType = DEFAULT_TREE_TYPE) => {
    if (typeof treeType !== 'string') {
        return DEFAULT_TREE_TYPE;
    }
    const normalized = treeType.trim().toLowerCase();
    return normalized || DEFAULT_TREE_TYPE;
};
const IMMUTABLE_AB_KEYS = [];
const V2_ISOLATION_FACTOR_KEYS = [
    'trunkStyle',
    'curvatureBase',
    'curvatureFreq',
    'curvatureStrength',
    'trunkBackboneTiltBias',
    'trunkBackboneAmp',
    'trunkBackboneFreqScale',
    'trunkBackboneDepthDecay',
    'trunkBackboneLockStrength',
    'widthBase',
    'widthTaper',
    'branchingProb',
    'branchAngleBase',
    'maxRelativeBendDeg',
    'twigUpwardBiasProb',
    'verticalBias',
    'flowerChance',
    'seasonalBloomBias',
    'bloomClusterBias',
    'canopyShapeBias',
    'canopyBloomDensity',
    'canopyBloomRadius',
    'potScale',
    'trunkOffsetX',
    'noiseStrength',
];
const V2_LEARNING_PAIR_WEIGHTS = {
    isolation_pair: 0.6,
    mixed_pair: 0.25,
    diversity_pair: 0.15,
};
const V2_LEARNING_PAIR_TYPE = {
    ISOLATION: 'isolation_pair',
    MIXED: 'mixed_pair',
    DIVERSITY: 'diversity_pair',
};

export const AB_EXPLORATION_STRATEGY = {
    ISOLATE: 'isolate',
    DISCOVER: 'discover',
    CHAOS: 'chaos',
};

export const AB_STYLE_PROFILE = {
    DEFAULT: 'default',
    SAKURA_BLOSSOM_COMPACT: 'sakura_blossom_compact',
    SAKURA_PHOTO_BLOOM: 'sakura_photo_bloom',
};

const AB_STYLE_PROFILE_OPTION_MAP = {
    sakura: [
        { id: AB_STYLE_PROFILE.DEFAULT, label: 'Default' },
        { id: AB_STYLE_PROFILE.SAKURA_BLOSSOM_COMPACT, label: 'Sakura Bloom Compact' },
        { id: AB_STYLE_PROFILE.SAKURA_PHOTO_BLOOM, label: 'Sakura Photo Bloom' },
    ],
};

const AB_STYLE_PROFILE_CONFIG = {
    [AB_STYLE_PROFILE.SAKURA_BLOSSOM_COMPACT]: {
        treeType: 'sakura',
        presetId: 'sakura_blossom_compact',
        presetLabel: 'Sakura Bloom Compact',
        intensityScale: 0.82,
        requiredKeys: [
            'widthBase',
            'lengthBase',
            'flowerChance',
            'bloomClusterBias',
        ],
        priorityKeys: [
            'widthBase',
            'lengthBase',
            'flowerChance',
            'bloomClusterBias',
            'trunkTierBranchingProb',
            'foliageMin',
            'foliageVar',
            'widthTaper',
            'branchingProb',
            'canopyShapeBias',
            'silhouetteTarget',
        ],
        anchors: {
            widthBase: { target: 1.6, blend: 0.7 },
            lengthBase: { target: 0.62, blend: 0.62 },
            flowerChance: { target: 0.82, blend: 0.66 },
            bloomClusterBias: { target: 0.9, blend: 0.7 },
            trunkTierBranchingProb: { target: 0.62, blend: 0.58 },
            foliageMin: { target: 5, blend: 0.62 },
            foliageVar: { target: 6, blend: 0.56 },
            widthTaper: { target: 0.68, blend: 0.46 },
            branchingProb: { target: 0.72, blend: 0.36 },
            canopyShapeBias: { target: 0.68, blend: 0.36 },
            silhouetteTarget: { target: 0.44, blend: 0.34 },
        },
    },
    [AB_STYLE_PROFILE.SAKURA_PHOTO_BLOOM]: {
        treeType: 'sakura',
        presetId: 'sakura_photo_bloom',
        presetLabel: 'Sakura Photo Bloom',
        intensityScale: 0.76,
        requiredKeys: [
            'widthBase',
            'lengthBase',
            'flowerChance',
            'bloomClusterBias',
            'scaffoldStrength',
            'canopyBloomDensity',
            'canopyBloomRadius',
            'trunkTierBranchingProb',
        ],
        priorityKeys: [
            'widthBase',
            'lengthBase',
            'flowerChance',
            'bloomClusterBias',
            'trunkTierBranchingProb',
            'foliageMin',
            'foliageVar',
            'widthTaper',
            'branchingProb',
            'scaffoldStrength',
            'canopyBloomDensity',
            'canopyBloomRadius',
            'canopyShapeBias',
            'silhouetteTarget',
        ],
        anchors: {
            widthBase: { target: 1.45, blend: 0.78 },
            lengthBase: { target: 0.56, blend: 0.74 },
            flowerChance: { target: 0.88, blend: 0.74 },
            bloomClusterBias: { target: 0.95, blend: 0.76 },
            trunkTierBranchingProb: { target: 0.7, blend: 0.68 },
            foliageMin: { target: 5, blend: 0.66 },
            foliageVar: { target: 6, blend: 0.62 },
            widthTaper: { target: 0.66, blend: 0.52 },
            branchingProb: { target: 0.76, blend: 0.52 },
            scaffoldStrength: { target: 0.9, blend: 0.84 },
            canopyBloomDensity: { target: 0.96, blend: 0.9 },
            canopyBloomRadius: { target: 0.78, blend: 0.76 },
            canopyShapeBias: { target: 0.7, blend: 0.46 },
            silhouetteTarget: { target: 0.46, blend: 0.42 },
        },
    },
};

export const getABStyleProfileOptions = (treeType = DEFAULT_TREE_TYPE) => (
    AB_STYLE_PROFILE_OPTION_MAP[resolveTreeType(treeType)]
    || AB_STYLE_PROFILE_OPTION_MAP[DEFAULT_TREE_TYPE]
);

export const sanitizeABStyleProfile = (treeType = 'sakura', styleProfile = AB_STYLE_PROFILE.DEFAULT) => {
    const options = getABStyleProfileOptions(resolveTreeType(treeType));
    if (options.some((entry) => entry.id === styleProfile)) {
        return styleProfile;
    }
    return AB_STYLE_PROFILE.DEFAULT;
};

const pickSubset = (items = [], count = 0, rng = Math.random) => {
    const pool = [...items];
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
};

const mergeFocusKeys = (focusKeys = [], prioritizedKeys = []) => {
    const merged = [...focusKeys];
    let replaceIndex = merged.length - 1;
    prioritizedKeys.forEach((key) => {
        if (merged.includes(key)) {
            return;
        }
        if (replaceIndex >= 0) {
            merged[replaceIndex] = key;
            replaceIndex -= 1;
        } else {
            merged.push(key);
        }
    });
    return Array.from(new Set(merged));
};

const resolveStyleProfileConfig = (treeType, styleProfile) => {
    if (!styleProfile || styleProfile === AB_STYLE_PROFILE.DEFAULT) {
        return null;
    }
    const config = AB_STYLE_PROFILE_CONFIG[styleProfile];
    if (!config) {
        return null;
    }
    if (config.treeType && config.treeType !== treeType) {
        return null;
    }
    return config;
};

const pickRandomFactorKeys = (count = 6, rng = Math.random) => {
    const keys = LEARNING_Phenotype_FACTOR_KEYS.filter((key) => !IMMUTABLE_AB_KEYS.includes(key));
    for (let i = keys.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    return keys.slice(0, Math.max(1, Math.min(count, keys.length)));
};

const clampByDef = (key, value) => {
    const def = Phenotype_FACTOR_DEFS[key];
    if (!def) {
        return value;
    }
    const clamped = Math.min(def.max, Math.max(def.min, value));
    return def.integer ? Math.round(clamped) : Number(clamped);
};
const alignExcludedPhenotypeFactors = (phenotype = {}, anchorPhenotype = {}) => {
    const next = clampPhenotype(phenotype);
    const anchor = clampPhenotype(anchorPhenotype);
    ROOT_COMPOSITION_Phenotype_FACTOR_KEYS.forEach((key) => {
        if (Number.isFinite(Number(anchor?.[key]))) {
            next[key] = Number(anchor[key]);
        }
    });
    return clampPhenotype(next);
};

export const buildIsolationABPairPhenotype = ({
    basePhenotype = {},
    treeType = 'sakura',
    intensity = 0.2,
    focusKey = null,
    rng = Math.random,
}) => {
    const base = clampPhenotype(basePhenotype);
    const safeTreeType = resolveTreeType(treeType);
    const allowedKeys = V2_ISOLATION_FACTOR_KEYS.filter(
        (key) => Object.prototype.hasOwnProperty.call(Phenotype_FACTOR_DEFS, key),
    );
    const targetKey = (
        focusKey
        && allowedKeys.includes(focusKey)
        && !IMMUTABLE_AB_KEYS.includes(focusKey)
    )
        ? focusKey
        : allowedKeys[Math.floor(rng() * allowedKeys.length)];

    if (!targetKey) {
        return buildExplorationABPairPhenotype({
            basePhenotype: base,
            treeType: safeTreeType,
            focusCount: 1,
            intensity: clamp01(intensity),
            rng,
        });
    }

    const def = Phenotype_FACTOR_DEFS[targetKey];
    const span = Math.max(1e-6, def.max - def.min);
    const safeIntensity = clamp01(Number.isFinite(intensity) ? intensity : 0.2);
    const direction = rng() > 0.5 ? 1 : -1;
    const delta = span * (0.12 + safeIntensity * 0.34);
    const baseValue = Number.isFinite(base[targetKey]) ? base[targetKey] : def.min;

    const phenotypeA = { ...base };
    const phenotypeB = { ...base };
    phenotypeA[targetKey] = clampByDef(targetKey, baseValue + delta * direction);
    phenotypeB[targetKey] = clampByDef(targetKey, baseValue - delta * direction);

    // Keep generator mode stable in A/B so structure regime does not leak into preference choice.

    return {
        phenotypeA: clampPhenotype(phenotypeA),
        phenotypeB: clampPhenotype(phenotypeB),
        context: {
            mode: 'learn_mode',
            presetId: 'v2_isolation_single_factor',
            presetLabel: 'V2 Isolation',
            pairType: V2_LEARNING_PAIR_TYPE.ISOLATION,
            sharedSeedPolicy: 'shared',
            treeType: safeTreeType,
            focusCount: 1,
            intensity: round(safeIntensity, 3),
            changedFactors: [
                {
                    id: targetKey,
                    label: 'Isolation',
                    a: round(Number(phenotypeA[targetKey]), 4),
                    b: round(Number(phenotypeB[targetKey]), 4),
                    deltaNorm: round((Number(phenotypeA[targetKey]) - Number(phenotypeB[targetKey])) / span, 4),
                },
            ],
            lockedFactors: LEARNING_Phenotype_FACTOR_KEYS.filter((key) => key !== targetKey),
        },
    };
};

const pickV2PairType = (rng = Math.random) => {
    const roll = clamp01(Number(rng()));
    const isolationCutoff = V2_LEARNING_PAIR_WEIGHTS.isolation_pair;
    const mixedCutoff = isolationCutoff + V2_LEARNING_PAIR_WEIGHTS.mixed_pair;
    if (roll < isolationCutoff) {
        return V2_LEARNING_PAIR_TYPE.ISOLATION;
    }
    if (roll < mixedCutoff) {
        return V2_LEARNING_PAIR_TYPE.MIXED;
    }
    return V2_LEARNING_PAIR_TYPE.DIVERSITY;
};

const phenotypeDistance = (phenotypeA = {}, phenotypeB = {}) => {
    const keys = LEARNING_Phenotype_FACTOR_KEYS.filter((key) => !IMMUTABLE_AB_KEYS.includes(key));
    if (!keys.length) {
        return 0;
    }
    const mse = keys.reduce((acc, key) => {
        const def = Phenotype_FACTOR_DEFS[key];
        if (!def) {
            return acc;
        }
        const span = Math.max(1e-6, def.max - def.min);
        const diff = (Number(phenotypeA?.[key]) - Number(phenotypeB?.[key])) / span;
        return acc + (diff * diff);
    }, 0) / keys.length;
    return Math.sqrt(mse);
};

export const buildMixedABPairPhenotype = ({
    basePhenotype = {},
    treeType = 'sakura',
    intensity = 0.24,
    rng = Math.random,
}) => {
    const pair = buildExplorationABPairPhenotype({
        basePhenotype,
        treeType,
        focusCount: clampInt(2 + (rng() * 2), 2, 3),
        intensity: clamp01(intensity),
        rng,
    });
    return {
        ...pair,
        context: {
            ...(pair.context || {}),
            mode: 'learn_mode',
            presetId: 'v2_mixed_pair',
            presetLabel: 'V2 Mixed',
            pairType: V2_LEARNING_PAIR_TYPE.MIXED,
            sharedSeedPolicy: 'independent',
        },
    };
};

export const buildDiversityABPairPhenotype = ({
    basePhenotype = {},
    treeType = 'sakura',
    rng = Math.random,
}) => {
    const safeTreeType = resolveTreeType(treeType);
    const base = clampPhenotype(basePhenotype);

    let bestPair = null;
    let bestDistance = Number.NEGATIVE_INFINITY;
    const attemptCount = 6;
    for (let attempt = 0; attempt < attemptCount; attempt += 1) {
        const candidateA = alignExcludedPhenotypeFactors(clampPhenotype({
            ...randomPhenotype(safeTreeType, rng),
        }), base);
        const candidateB = alignExcludedPhenotypeFactors(clampPhenotype({
            ...randomPhenotype(safeTreeType, rng),
        }), base);
        const distance = phenotypeDistance(candidateA, candidateB);
        if (distance > bestDistance) {
            bestDistance = distance;
            bestPair = { phenotypeA: candidateA, phenotypeB: candidateB };
        }
    }

    const phenotypeA = bestPair?.phenotypeA || clampPhenotype({ ...base });
    const phenotypeB = bestPair?.phenotypeB || clampPhenotype({ ...base });
    return {
        phenotypeA,
        phenotypeB,
        context: {
            mode: 'learn_mode',
            presetId: 'v2_diversity_pair',
            presetLabel: 'V2 Diversity',
            pairType: V2_LEARNING_PAIR_TYPE.DIVERSITY,
            sharedSeedPolicy: 'independent',
            treeType: safeTreeType,
            focusCount: Math.max(6, Math.round(LEARNING_Phenotype_FACTOR_KEYS.length * 0.22)),
            intensity: 1,
            distance: round(bestDistance, 4),
            changedFactors: [],
            lockedFactors: [],
        },
    };
};

export const buildV2LearningABPairPhenotype = ({
    basePhenotype = {},
    treeType = 'sakura',
    intensity = 0.2,
    roundIndex = 0,
    rng = Math.random,
}) => {
    const pairType = pickV2PairType(rng);
    if (pairType === V2_LEARNING_PAIR_TYPE.MIXED) {
        return {
            strategy: AB_EXPLORATION_STRATEGY.DISCOVER,
            sharedSeed: false,
            roundIndex,
            pairType,
            phenotypePair: buildMixedABPairPhenotype({
                basePhenotype,
                treeType,
                intensity: clamp01(intensity * (1.05 + (rng() * 0.2))),
                rng,
            }),
        };
    }
    if (pairType === V2_LEARNING_PAIR_TYPE.DIVERSITY) {
        return {
            strategy: AB_EXPLORATION_STRATEGY.DISCOVER,
            sharedSeed: false,
            roundIndex,
            pairType,
            phenotypePair: buildDiversityABPairPhenotype({
                basePhenotype,
                treeType,
                rng,
            }),
        };
    }
    return {
        strategy: AB_EXPLORATION_STRATEGY.ISOLATE,
        sharedSeed: true,
        roundIndex,
        pairType,
        phenotypePair: buildIsolationABPairPhenotype({
            basePhenotype,
            treeType,
            intensity,
            rng,
        }),
    };
};

export const buildExplorationABPairPhenotype = ({
    basePhenotype = {},
    treeType = 'sakura',
    styleProfile = AB_STYLE_PROFILE.DEFAULT,
    focusCount = 10,
    intensity = 0.45,
    rng = Math.random,
}) => {
    const base = clampPhenotype(basePhenotype);
    const safeTreeType = resolveTreeType(treeType);
    const safeStyleProfile = sanitizeABStyleProfile(safeTreeType, styleProfile);
    const styleConfig = resolveStyleProfileConfig(safeTreeType, safeStyleProfile);
    const desiredFocusCount = Math.max(1, Math.min(focusCount, LEARNING_Phenotype_FACTOR_KEYS.length));
    let focusKeys = pickRandomFactorKeys(desiredFocusCount, rng);
    if (styleConfig?.priorityKeys?.length) {
        const requiredSet = new Set(styleConfig.requiredKeys || []);
        const prioritizedCount = clampInt(
            Math.ceil(desiredFocusCount * 0.6),
            2,
            Math.min(desiredFocusCount, styleConfig.priorityKeys.length),
        );
        const prioritizedPool = styleConfig.priorityKeys.filter((key) => !requiredSet.has(key));
        const prioritizedKeys = pickSubset(prioritizedPool, prioritizedCount, rng);
        focusKeys = mergeFocusKeys(focusKeys, prioritizedKeys);
        if (Array.isArray(styleConfig.requiredKeys) && styleConfig.requiredKeys.length) {
            const requiredKeys = styleConfig.requiredKeys.slice(0, desiredFocusCount);
            focusKeys = mergeFocusKeys(focusKeys, requiredKeys);
        }
        focusKeys = focusKeys.slice(0, desiredFocusCount);
    }

    // Prefer keeping one high-impact driver without exceeding requested focusCount.
    const highImpact = ['trunkStyle', 'widthBase', 'taperExponent', 'branchingProb', 'trunkTierBranchingProb']
        .filter((key) => LEARNING_Phenotype_FACTOR_KEYS.includes(key));
    const guaranteed = highImpact.length
        ? highImpact[Math.floor(rng() * highImpact.length)]
        : null;
    if (!styleConfig && guaranteed && !focusKeys.includes(guaranteed)) {
        focusKeys[focusKeys.length - 1] = guaranteed;
    }

    const baseIntensity = clamp01(Number.isFinite(intensity) ? intensity : 0.45);
    const safeIntensity = clamp01(baseIntensity * (styleConfig?.intensityScale ?? 1));
    const phenotypeA = { ...base };
    const phenotypeB = { ...base };
    const changedFactors = [];

    focusKeys.forEach((key) => {
        const def = Phenotype_FACTOR_DEFS[key];
        if (!def) {
            return;
        }
        const span = Math.max(1e-6, def.max - def.min);
        const centerBase = Number.isFinite(base[key]) ? base[key] : def.min;
        const anchor = styleConfig?.anchors?.[key];
        const target = anchor
            ? clampByDef(key, anchor.target)
            : centerBase;
        const center = anchor
            ? clampByDef(key, centerBase + ((target - centerBase) * clamp01(anchor.blend ?? 0.5)))
            : centerBase;
        let direction = rng() > 0.5 ? 1 : -1;
        if (anchor && Number.isFinite(target) && target !== center) {
            direction = target > center ? 1 : -1;
        }
        const deltaScale = anchor ? (0.5 + rng() * 0.28) : (0.8 + rng() * 0.4);
        const delta = span * safeIntensity * deltaScale;

        const nextA = clampByDef(key, center + (delta * direction));
        const nextB = clampByDef(key, center - (delta * direction));
        phenotypeA[key] = nextA;
        phenotypeB[key] = nextB;

        const deltaNorm = (Number(nextA) - Number(nextB)) / span;
        changedFactors.push({
            id: key,
            label: 'Exploration',
            a: round(Number(nextA), 4),
            b: round(Number(nextB), 4),
            deltaNorm: round(deltaNorm, 4),
        });
    });

    const lockedFactors = LEARNING_Phenotype_FACTOR_KEYS.filter((key) => !focusKeys.includes(key));
    return {
        phenotypeA: clampPhenotype(phenotypeA),
        phenotypeB: clampPhenotype(phenotypeB),
        context: {
            mode: 'evolve',
            presetId: styleConfig?.presetId || 'exploration',
            presetLabel: styleConfig?.presetLabel || 'Exploration',
            styleProfile: safeStyleProfile,
            focusCount: focusKeys.length,
            intensity: round(safeIntensity, 3),
            changedFactors,
            lockedFactors,
        },
    };
};
