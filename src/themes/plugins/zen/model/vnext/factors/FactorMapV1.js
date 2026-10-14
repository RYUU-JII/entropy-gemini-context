import {
    VNEXT_FACTOR_KEYS_V1,
    VNEXT_FACTOR_OWNER,
    VNEXT_FACTOR_SCHEMA_V1,
    getFactorSchemaDefV1,
} from './FactorSchemaV1';

const MAP_ENTRY_BY_FACTOR = Object.freeze({
    trunk_count: {
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        affects: ['init.trunkSeedCount'],
        traceKey: 'trunk_seed_count',
    },
    trunk_lean: {
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        affects: ['trunkPolicy.targetLeanAngleDeg'],
        traceKey: 'trunk_lean_bias',
    },
    trunk_curve_energy: {
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        affects: ['trunkPolicy.curveEnergy'],
        traceKey: 'trunk_curve_energy',
    },
    trunk_taper_strength: {
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        affects: ['thicknessPolicy.trunkTaperStrength'],
        traceKey: 'trunk_taper_strength',
    },
    trunk_apex_substitution_rate: {
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        affects: ['actionPolicy.apexSubstitutionRate'],
        traceKey: 'apex_substitute_rate',
    },
    trunk_split_bias: {
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        affects: ['actionPolicy.trunkSplitBias'],
        traceKey: 'trunk_split_bias',
    },
    trunk_height_bias: {
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        affects: ['growthBudgetPolicy.trunkHeightWeight'],
        traceKey: 'trunk_height_bias',
    },
    first_split_height_ratio: {
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        affects: ['growthBudgetPolicy.firstSplitHeightRatio'],
        traceKey: 'first_split_height_ratio',
    },
    trunk_base_spread: {
        owner: VNEXT_FACTOR_OWNER.TRUNK_POLICY,
        affects: ['init.trunkBaseSpreadRadius'],
        traceKey: 'trunk_base_spread',
    },
    branch_density: {
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        affects: ['actionPolicy.splitProbability'],
        traceKey: 'branch_density',
    },
    branch_angle_mean: {
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        affects: ['branchPolicy.angleMeanDeg'],
        traceKey: 'branch_angle_mean',
    },
    branch_angle_var: {
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        affects: ['branchPolicy.angleStdDeg'],
        traceKey: 'branch_angle_var',
    },
    branch_depth_budget: {
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        affects: ['growthBudgetPolicy.branchDepthBudget'],
        traceKey: 'branch_depth_budget',
    },
    branch_length_decay: {
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        affects: ['thicknessPolicy.branchLengthDecay'],
        traceKey: 'branch_length_decay',
    },
    branch_radius_decay: {
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        affects: ['thicknessPolicy.branchRadiusDecay'],
        traceKey: 'branch_radius_decay',
    },
    apical_dominance: {
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        affects: ['resourcePolicy.apicalDominance'],
        traceKey: 'apical_dominance',
    },
    alternation_bias: {
        owner: VNEXT_FACTOR_OWNER.BRANCH_POLICY,
        affects: ['branchPolicy.alternationBias'],
        traceKey: 'alternation_bias',
    },
    phototropism_gain: {
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        affects: ['utility.weights.lightAlign'],
        traceKey: 'w_light_align',
    },
    space_avoid_gain: {
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        affects: ['utility.weights.spaceClearance'],
        traceKey: 'w_space_clearance',
    },
    collision_prune_gain: {
        owner: VNEXT_FACTOR_OWNER.PRUNE_POLICY,
        affects: ['prunePolicy.collisionGain'],
        traceKey: 'collision_prune_gain',
    },
    pad_separation_target: {
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        affects: ['fieldPolicy.padSeparationTarget'],
        traceKey: 'pad_separation_target',
    },
    negative_space_target: {
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        affects: ['fieldPolicy.negativeSpaceTarget'],
        traceKey: 'negative_space_target',
    },
    canopy_envelope_bias: {
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        affects: ['fieldPolicy.canopyEnvelopeBias'],
        traceKey: 'canopy_envelope_bias',
    },
    mass_balance_gain: {
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        affects: ['utility.weights.massBalance'],
        traceKey: 'w_mass_balance',
    },
    cascade_bias: {
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        affects: ['stylePolicy.cascadeBias'],
        traceKey: 'style_cascade_bias',
    },
    windswept_bias: {
        owner: VNEXT_FACTOR_OWNER.FIELD_POLICY,
        affects: ['stylePolicy.windsweptBias'],
        traceKey: 'style_windswept_bias',
    },
    jin_rate: {
        owner: VNEXT_FACTOR_OWNER.AGING_POLICY,
        affects: ['agingPolicy.jinRate', 'node.liveVeinRatio'],
        traceKey: 'aging_jin_rate',
    },
    shari_rate: {
        owner: VNEXT_FACTOR_OWNER.AGING_POLICY,
        affects: ['agingPolicy.shariRate', 'node.liveVeinRatio'],
        traceKey: 'aging_shari_rate',
    },
    deadwood_persistence: {
        owner: VNEXT_FACTOR_OWNER.AGING_POLICY,
        affects: ['agingPolicy.deadwoodPersistence', 'resourcePolicy.deadwoodCarryOver'],
        traceKey: 'deadwood_persistence',
    },
});

const buildMapEntry = (name) => {
    const schemaDef = getFactorSchemaDefV1(name);
    const mapDef = MAP_ENTRY_BY_FACTOR[name];
    if (!schemaDef || !mapDef) {
        return null;
    }
    return Object.freeze({
        name,
        range: [schemaDef.min, schemaDef.max],
        owner: mapDef.owner,
        transform: schemaDef.transform,
        affects: [...mapDef.affects],
        traceKey: mapDef.traceKey,
    });
};

export const VNEXT_FACTOR_MAP_V1 = Object.freeze(
    VNEXT_FACTOR_KEYS_V1
        .map((name) => buildMapEntry(name))
        .filter(Boolean),
);

export const VNEXT_FACTOR_MAP_BY_NAME_V1 = Object.freeze(
    VNEXT_FACTOR_MAP_V1.reduce((acc, entry) => {
        acc[entry.name] = entry;
        return acc;
    }, {}),
);

export const listFactorMapEntriesV1 = () => (
    [...VNEXT_FACTOR_MAP_V1]
);

export const getFactorMapEntryV1 = (name = '') => (
    VNEXT_FACTOR_MAP_BY_NAME_V1[name] || null
);

export const assertFactorMapConsistencyV1 = () => {
    const missing = VNEXT_FACTOR_KEYS_V1.filter((key) => !VNEXT_FACTOR_MAP_BY_NAME_V1[key]);
    if (missing.length) {
        throw new Error(`[FactorMapV1] Missing map entries: ${missing.join(', ')}`);
    }
    const invalid = VNEXT_FACTOR_MAP_V1.filter((entry) => {
        const schemaDef = VNEXT_FACTOR_SCHEMA_V1[entry.name];
        if (!schemaDef) {
            return true;
        }
        if (!Array.isArray(entry.affects) || !entry.affects.length) {
            return true;
        }
        if (typeof entry.traceKey !== 'string' || !entry.traceKey.trim()) {
            return true;
        }
        return entry.owner !== schemaDef.owner;
    });
    if (invalid.length) {
        throw new Error(`[FactorMapV1] Invalid entries: ${invalid.map((entry) => entry.name).join(', ')}`);
    }
    return true;
};
