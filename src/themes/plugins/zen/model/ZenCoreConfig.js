import {
    zenDevelopmentWorkspaceState,
} from '@zen-development-workspace-state-entry';
import {
    requireStoredEnumValue,
    requireStoredIntegerInRange,
} from './ZenCoreConfigValidation.js';
import {
    ZEN_BONSAI_STRUCTURE_MODE as STRUCTURE_MODE,
} from '../contracts/ZenBonsaiProfileGenerationDefaults.js';
import {
    CANONICAL_LEARNING_STAGE,
    STAGES,
} from './ZenBonsaiStageContract.js';
import {
    clampStructureDepth,
    withStructureDepth,
} from './ZenBonsaiStageProjection.js';
export { STRUCTURE_MODE };
export {
    CANONICAL_LEARNING_STAGE,
    STAGES,
} from './ZenBonsaiStageContract.js';
export {
    clampStructureDepth,
    withStructureDepth,
} from './ZenBonsaiStageProjection.js';
export {
    createAssetCache,
    ZEN_ASSET_CACHE_VERSION,
} from './ZenCoreConfigAssetCache.js';
export { resolveSpecies } from './ZenCoreSpeciesRegistry.js';
export { createZenCoreConfigError } from './ZenCoreConfigValidation.js';
export {
    AB_GENERATION_MODE,
    clampABQueryTuning,
    clampCanopyDistributionTuning,
    clampRedundancyTuning,
    DEFAULT_AB_DISCOVER_RATIO,
    DEFAULT_AB_EXPLORATION_INTENSITY,
    DEFAULT_AB_QUERY_TUNING,
    DEFAULT_CANOPY_DISTRIBUTION_TUNING,
    DEFAULT_REDUNDANCY_TUNING,
    getABQueryTuningStorageKey,
    getABStyleProfileStorageKey,
    getCanopyDistributionTuningStorageKey,
    getOptimizationObjectiveModeStorageKey,
    getRedundancyTuningStorageKey,
    MAIN_TARGET_FPS,
    MIN_AB_RENDER_SIZE,
    OBJECTIVE_MODE,
    OPTIMIZER_MODE,
    persistABQueryTuning,
    persistCanopyDistributionTuning,
    persistOptimizationObjectiveMode,
    persistRedundancyTuning,
    readABQueryTuning,
    readABStyleProfile,
    readCanopyDistributionTuning,
    readOptimizationObjectiveMode,
    readRedundancyTuning,
    sanitizeObjectiveMode,
    STAGE_SEED_OFFSET,
    TOPOLOGY_REFERENCE_HEIGHT,
} from './ZenCoreConfigOptimizationTuning.js';

const DEFAULT_BONSAI_STRUCTURE_DEPTH = 6;
const STRUCTURE_DEPTH_MIN = 1;
const STRUCTURE_DEPTH_MAX = 9;

const STRUCTURE_MODE_VALUES = new Set(Object.values(STRUCTURE_MODE));

const STRUCTURE_DEPTH_RANGE_BY_MODE = {
    [STRUCTURE_MODE.BONSAI]: { min: 1, max: 4 },
    [STRUCTURE_MODE.TREE]: { min: 3, max: 8 },
};

export const sanitizeStructureMode = (value) => (
    value === STRUCTURE_MODE.BONSAI || value === STRUCTURE_MODE.TREE
        ? value
        : STRUCTURE_MODE.TREE
);

export const getStructureDepthRange = (structureMode) => (
    STRUCTURE_DEPTH_RANGE_BY_MODE[sanitizeStructureMode(structureMode)]
    || STRUCTURE_DEPTH_RANGE_BY_MODE[STRUCTURE_MODE.TREE]
);

export const getStructureDepthStorageKey = (treeType) => `zen_bonsai_structure_depth_${treeType}`;
export const getStructureModeStorageKey = (treeType) => `zen_bonsai_structure_mode_${treeType}`;

export const readStructureDepth = (treeType) => {
    if (!zenDevelopmentWorkspaceState) {
        return DEFAULT_BONSAI_STRUCTURE_DEPTH;
    }
    const storageKey = getStructureDepthStorageKey(treeType);
    const raw = zenDevelopmentWorkspaceState.readItem(storageKey, null);
    if (raw === null) {
        return DEFAULT_BONSAI_STRUCTURE_DEPTH;
    }
    return requireStoredIntegerInRange(raw, {
        storageKey,
        code: 'ZEN_CORE_CONFIG_STRUCTURE_DEPTH_INVALID',
        label: 'Stored Zen structure depth',
        min: STRUCTURE_DEPTH_MIN,
        max: STRUCTURE_DEPTH_MAX,
    });
};

export const readStructureMode = (treeType) => {
    if (!zenDevelopmentWorkspaceState) {
        return STRUCTURE_MODE.TREE;
    }
    const storageKey = getStructureModeStorageKey(treeType);
    const raw = zenDevelopmentWorkspaceState.readItem(storageKey, null);
    if (raw === null) {
        return STRUCTURE_MODE.TREE;
    }
    return requireStoredEnumValue(raw, {
        storageKey,
        code: 'ZEN_CORE_CONFIG_STRUCTURE_MODE_INVALID',
        label: 'Stored Zen structure mode',
        allowedValues: STRUCTURE_MODE_VALUES,
    });
};

export const validateStructureDepthForMode = (
    structureMode,
    structureDepth,
    details = null,
) => {
    const resolvedMode = requireStoredEnumValue(structureMode, {
        storageKey: details?.storageKey || null,
        code: 'ZEN_CORE_CONFIG_STRUCTURE_MODE_INVALID',
        label: 'Zen structure mode',
        allowedValues: STRUCTURE_MODE_VALUES,
    });
    const range = getStructureDepthRange(resolvedMode);
    return requireStoredIntegerInRange(structureDepth, {
        storageKey: details?.storageKey || null,
        code: 'ZEN_CORE_CONFIG_STRUCTURE_DEPTH_RANGE_INVALID',
        label: `Zen structure depth for mode '${resolvedMode}'`,
        min: range.min,
        max: range.max,
    });
};

export const createEvaluationStageProfiles = (structureDepth) => [
    // Keep evaluation single-stage for speed/consistency during current tuning.
    { id: 'stage_bloom', stage: withStructureDepth(STAGES.BLOOM, structureDepth), weight: 1 },
];
export const createCanonicalEvaluationStageProfiles = (structureDepth) => [
    { id: 'stage_bloom', stage: withStructureDepth(CANONICAL_LEARNING_STAGE, structureDepth), weight: 1 },
];
