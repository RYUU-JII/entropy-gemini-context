import { AB_STYLE_PROFILE, getABStyleProfileOptions } from './ExplorationAB';
import {
    zenDevelopmentWorkspaceState,
} from '@zen-development-workspace-state-entry';
import {
    requireStoredEnumValue,
    requireStoredIntegerInRange,
    requireStoredNumberInRange,
    requireStoredObject,
} from './ZenCoreConfigValidation.js';
import {
    ZEN_BONSAI_DEFAULT_CANOPY_DISTRIBUTION as DEFAULT_CANOPY_DISTRIBUTION_TUNING,
    ZEN_BONSAI_TOPOLOGY_REFERENCE_HEIGHT as TOPOLOGY_REFERENCE_HEIGHT,
    clampZenBonsaiCanopyDistribution as clampCanopyDistributionTuning,
} from '../contracts/ZenBonsaiProfileGenerationDefaults.js';
import {
    BONSAI_AB_MIN_SUPPORTED_CARD_EXTENT_CSS_PX,
} from './bonsai/rendering/BonsaiABViewportContract.js';

export {
    DEFAULT_CANOPY_DISTRIBUTION_TUNING,
    TOPOLOGY_REFERENCE_HEIGHT,
    clampCanopyDistributionTuning,
};

export const STAGE_SEED_OFFSET = 7919;
export const AB_GENERATION_MODE = 'evolve';
export const OPTIMIZER_MODE = 'map_elites';
export const MAIN_TARGET_FPS = 60;
// Structural-pair admission is proven at this same minimum supported CSS card
// extent. Smaller observed cards are not a supported comparison surface and
// remain unpainted instead of weakening the visible-distance contract.
export const MIN_AB_RENDER_SIZE = BONSAI_AB_MIN_SUPPORTED_CARD_EXTENT_CSS_PX;
export const DEFAULT_AB_EXPLORATION_INTENSITY = 0.28;
export const DEFAULT_AB_DISCOVER_RATIO = 0.3;
export const DEFAULT_AB_QUERY_TUNING = {
    bestWorstInterval: 5,
    anchorInterval: 9,
    specialStrength: 1,
};
export const DEFAULT_REDUNDANCY_TUNING = {
    similarityThreshold: 0.9,
    blockThreshold: 0.82,
    penaltyScale: 0.22,
};
export const OBJECTIVE_MODE = {
    ADAPTIVE: 'adaptive',
    BLENDED: 'blended',
    NEURAL: 'neural',
    PAIRWISE: 'pairwise',
};
const SANITIZED_OBJECTIVE_MODE = new Set(Object.values(OBJECTIVE_MODE));

const requireDevelopmentWorkspaceState = (operation) => {
    if (zenDevelopmentWorkspaceState) {
        return zenDevelopmentWorkspaceState;
    }
    const error = new Error(
        `Zen optimization tuning '${operation}' is available only in a development build.`,
    );
    error.code = 'ZEN_OPTIMIZATION_DEVELOPMENT_WORKSPACE_NOT_AVAILABLE';
    error.details = { operation };
    throw error;
};

export const sanitizeObjectiveMode = (value) => (
    SANITIZED_OBJECTIVE_MODE.has(value) ? value : OBJECTIVE_MODE.BLENDED
);

const clampRange = (value, min, max, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, numeric));
};

const DEFAULT_TREE_TYPE = 'sakura';
const resolveTreeType = (treeType = DEFAULT_TREE_TYPE) => {
    if (typeof treeType !== 'string') {
        return DEFAULT_TREE_TYPE;
    }
    const normalized = treeType.trim().toLowerCase();
    return normalized || DEFAULT_TREE_TYPE;
};

const clampIntRange = (value, min, max, fallback) => Math.round(
    clampRange(value, min, max, fallback),
);

export const clampABQueryTuning = (value = {}) => ({
    bestWorstInterval: clampIntRange(
        value?.bestWorstInterval,
        3,
        16,
        DEFAULT_AB_QUERY_TUNING.bestWorstInterval,
    ),
    anchorInterval: clampIntRange(
        value?.anchorInterval,
        5,
        20,
        DEFAULT_AB_QUERY_TUNING.anchorInterval,
    ),
    specialStrength: Number(
        clampRange(
            value?.specialStrength,
            0.6,
            1.6,
            DEFAULT_AB_QUERY_TUNING.specialStrength,
        ).toFixed(2),
    ),
});

export const clampRedundancyTuning = (value = {}) => ({
    similarityThreshold: Number(
        clampRange(
            value?.similarityThreshold,
            0.75,
            0.97,
            DEFAULT_REDUNDANCY_TUNING.similarityThreshold,
        ).toFixed(3),
    ),
    blockThreshold: Number(
        clampRange(
            value?.blockThreshold,
            0.6,
            0.95,
            DEFAULT_REDUNDANCY_TUNING.blockThreshold,
        ).toFixed(3),
    ),
    penaltyScale: Number(
        clampRange(
            value?.penaltyScale,
            0.05,
            0.4,
            DEFAULT_REDUNDANCY_TUNING.penaltyScale,
        ).toFixed(3),
    ),
});

export const getABStyleProfileStorageKey = (treeType) => `zen_bonsai_ab_style_${resolveTreeType(treeType)}`;
export const readABStyleProfile = (treeType) => {
    if (!zenDevelopmentWorkspaceState) {
        return AB_STYLE_PROFILE.DEFAULT;
    }
    const resolvedType = resolveTreeType(treeType);
    const storageKey = getABStyleProfileStorageKey(resolvedType);
    const raw = zenDevelopmentWorkspaceState.readItem(storageKey, null);
    if (raw === null) {
        return AB_STYLE_PROFILE.DEFAULT;
    }
    const allowedValues = new Set(
        getABStyleProfileOptions(resolvedType).map((entry) => entry.id),
    );
    return requireStoredEnumValue(raw, {
        storageKey,
        code: 'ZEN_CORE_CONFIG_AB_STYLE_PROFILE_INVALID',
        label: 'Stored Zen AB style profile',
        allowedValues,
    });
};

export const getABQueryTuningStorageKey = (treeType) => `zen_bonsai_ab_query_tuning_${resolveTreeType(treeType)}`;
export const getRedundancyTuningStorageKey = (treeType) => `zen_bonsai_redundancy_tuning_${resolveTreeType(treeType)}`;
export const getCanopyDistributionTuningStorageKey = (treeType) => `zen_bonsai_canopy_distribution_tuning_${resolveTreeType(treeType)}`;

const parseStoredABQueryTuning = (value, storageKey) => {
    const parsed = requireStoredObject(value, {
        storageKey,
        code: 'ZEN_CORE_CONFIG_AB_QUERY_TUNING_INVALID',
        label: 'Stored Zen AB query tuning',
    });
    return clampABQueryTuning({
        bestWorstInterval: requireStoredIntegerInRange(parsed.bestWorstInterval, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_AB_QUERY_TUNING_INVALID',
            label: 'Stored Zen AB query tuning.bestWorstInterval',
            min: 3,
            max: 16,
        }),
        anchorInterval: requireStoredIntegerInRange(parsed.anchorInterval, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_AB_QUERY_TUNING_INVALID',
            label: 'Stored Zen AB query tuning.anchorInterval',
            min: 5,
            max: 20,
        }),
        specialStrength: requireStoredNumberInRange(parsed.specialStrength, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_AB_QUERY_TUNING_INVALID',
            label: 'Stored Zen AB query tuning.specialStrength',
            min: 0.6,
            max: 1.6,
        }),
    });
};

const parseStoredRedundancyTuning = (value, storageKey) => {
    const parsed = requireStoredObject(value, {
        storageKey,
        code: 'ZEN_CORE_CONFIG_REDUNDANCY_TUNING_INVALID',
        label: 'Stored Zen redundancy tuning',
    });
    return clampRedundancyTuning({
        similarityThreshold: requireStoredNumberInRange(parsed.similarityThreshold, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_REDUNDANCY_TUNING_INVALID',
            label: 'Stored Zen redundancy tuning.similarityThreshold',
            min: 0.75,
            max: 0.97,
        }),
        blockThreshold: requireStoredNumberInRange(parsed.blockThreshold, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_REDUNDANCY_TUNING_INVALID',
            label: 'Stored Zen redundancy tuning.blockThreshold',
            min: 0.6,
            max: 0.95,
        }),
        penaltyScale: requireStoredNumberInRange(parsed.penaltyScale, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_REDUNDANCY_TUNING_INVALID',
            label: 'Stored Zen redundancy tuning.penaltyScale',
            min: 0.05,
            max: 0.4,
        }),
    });
};

const parseStoredCanopyDistributionTuning = (value, storageKey) => {
    const parsed = requireStoredObject(value, {
        storageKey,
        code: 'ZEN_CORE_CONFIG_CANOPY_DISTRIBUTION_TUNING_INVALID',
        label: 'Stored Zen canopy distribution tuning',
    });
    return clampCanopyDistributionTuning({
        localRatio: requireStoredNumberInRange(parsed.localRatio, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_CANOPY_DISTRIBUTION_TUNING_INVALID',
            label: 'Stored Zen canopy distribution tuning.localRatio',
            min: 0.4,
            max: 0.85,
        }),
        globalNodeCap: requireStoredIntegerInRange(parsed.globalNodeCap, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_CANOPY_DISTRIBUTION_TUNING_INVALID',
            label: 'Stored Zen canopy distribution tuning.globalNodeCap',
            min: 1,
            max: 5,
        }),
        repairBudgetScale: requireStoredNumberInRange(parsed.repairBudgetScale, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_CANOPY_DISTRIBUTION_TUNING_INVALID',
            label: 'Stored Zen canopy distribution tuning.repairBudgetScale',
            min: 0,
            max: 1,
        }),
        minPerAnchor: requireStoredIntegerInRange(parsed.minPerAnchor, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_CANOPY_DISTRIBUTION_TUNING_INVALID',
            label: 'Stored Zen canopy distribution tuning.minPerAnchor',
            min: 0,
            max: 4,
        }),
        branchAffinitySigmaPx: requireStoredNumberInRange(parsed.branchAffinitySigmaPx, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_CANOPY_DISTRIBUTION_TUNING_INVALID',
            label: 'Stored Zen canopy distribution tuning.branchAffinitySigmaPx',
            min: 4,
            max: 28,
        }),
        maxGapPx: requireStoredNumberInRange(parsed.maxGapPx, {
            storageKey,
            code: 'ZEN_CORE_CONFIG_CANOPY_DISTRIBUTION_TUNING_INVALID',
            label: 'Stored Zen canopy distribution tuning.maxGapPx',
            min: 4,
            max: 30,
        }),
    });
};

export const readABQueryTuning = (treeType) => {
    if (!zenDevelopmentWorkspaceState) {
        return { ...DEFAULT_AB_QUERY_TUNING };
    }
    const resolvedType = resolveTreeType(treeType);
    const storageKey = getABQueryTuningStorageKey(resolvedType);
    const raw = zenDevelopmentWorkspaceState.readItem(storageKey, null);
    if (raw === null) {
        return { ...DEFAULT_AB_QUERY_TUNING };
    }
    const parsed = zenDevelopmentWorkspaceState.readJson(storageKey, null);
    return parseStoredABQueryTuning(parsed, storageKey);
};

export const persistABQueryTuning = (treeType, tuning) => {
    const workspaceState = requireDevelopmentWorkspaceState('persist_ab_query_tuning');
    const resolvedType = resolveTreeType(treeType);
    const normalized = clampABQueryTuning(tuning || DEFAULT_AB_QUERY_TUNING);
    workspaceState.writeJson(getABQueryTuningStorageKey(resolvedType), normalized);
    return normalized;
};

export const readRedundancyTuning = (treeType) => {
    if (!zenDevelopmentWorkspaceState) {
        return { ...DEFAULT_REDUNDANCY_TUNING };
    }
    const resolvedType = resolveTreeType(treeType);
    const storageKey = getRedundancyTuningStorageKey(resolvedType);
    const raw = zenDevelopmentWorkspaceState.readItem(storageKey, null);
    if (raw === null) {
        return { ...DEFAULT_REDUNDANCY_TUNING };
    }
    const parsed = zenDevelopmentWorkspaceState.readJson(storageKey, null);
    return parseStoredRedundancyTuning(parsed, storageKey);
};

export const persistRedundancyTuning = (treeType, tuning) => {
    const workspaceState = requireDevelopmentWorkspaceState('persist_redundancy_tuning');
    const resolvedType = resolveTreeType(treeType);
    const normalized = clampRedundancyTuning(tuning || DEFAULT_REDUNDANCY_TUNING);
    workspaceState.writeJson(getRedundancyTuningStorageKey(resolvedType), normalized);
    return normalized;
};

export const readCanopyDistributionTuning = (treeType) => {
    if (!zenDevelopmentWorkspaceState) {
        return { ...DEFAULT_CANOPY_DISTRIBUTION_TUNING };
    }
    const resolvedType = resolveTreeType(treeType);
    const storageKey = getCanopyDistributionTuningStorageKey(resolvedType);
    const raw = zenDevelopmentWorkspaceState.readItem(storageKey, null);
    if (raw === null) {
        return { ...DEFAULT_CANOPY_DISTRIBUTION_TUNING };
    }
    const parsed = zenDevelopmentWorkspaceState.readJson(storageKey, null);
    return parseStoredCanopyDistributionTuning(parsed, storageKey);
};

export const persistCanopyDistributionTuning = (treeType, tuning) => {
    const workspaceState = requireDevelopmentWorkspaceState('persist_canopy_distribution_tuning');
    const resolvedType = resolveTreeType(treeType);
    const normalized = clampCanopyDistributionTuning(tuning || DEFAULT_CANOPY_DISTRIBUTION_TUNING);
    workspaceState.writeJson(getCanopyDistributionTuningStorageKey(resolvedType), normalized);
    return normalized;
};

export const getOptimizationObjectiveModeStorageKey = (treeType) => (
    `zen_bonsai_objective_mode_${resolveTreeType(treeType)}`
);

export const readOptimizationObjectiveMode = (treeType) => {
    if (!zenDevelopmentWorkspaceState) {
        return OBJECTIVE_MODE.BLENDED;
    }
    const storageKey = getOptimizationObjectiveModeStorageKey(treeType);
    const raw = zenDevelopmentWorkspaceState.readItem(storageKey, null);
    if (raw === null) {
        return OBJECTIVE_MODE.BLENDED;
    }
    return requireStoredEnumValue(raw, {
        storageKey,
        code: 'ZEN_CORE_CONFIG_OBJECTIVE_MODE_INVALID',
        label: 'Stored Zen optimization objective mode',
        allowedValues: SANITIZED_OBJECTIVE_MODE,
    });
};

export const persistOptimizationObjectiveMode = (treeType, objectiveMode) => {
    const workspaceState = requireDevelopmentWorkspaceState('persist_optimization_objective_mode');
    const normalized = sanitizeObjectiveMode(objectiveMode);
    workspaceState.writeItem(getOptimizationObjectiveModeStorageKey(treeType), normalized);
    return normalized;
};
