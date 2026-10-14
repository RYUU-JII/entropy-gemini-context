import {
    STAGES,
} from '../../model/ZenBonsaiStageContract.js';
import {
    withStructureDepth,
} from '../../model/ZenBonsaiStageProjection.js';
import {
    applyZenBonsaiGrowthProjectionToStage,
    resolveZenBonsaiGrowthProjection,
    resolveZenBonsaiStageFlowerAvailability,
} from '../../model/ZenBonsaiGrowthProjection.js';

const clampStructureDepthForLifePhase = (structureDepth, maxDepth) => {
    const numeric = Math.round(Number(structureDepth) || 1);
    return Math.max(1, Math.min(maxDepth, numeric));
};

export const resolveZenClassicDisplayGrowthStage = ({
    baseStage,
    lifeState = null,
    structureDepth,
    learningProgress,
    canopyDistributionProfile,
} = {}) => {
    const phase = typeof lifeState?.phase === 'string' ? lifeState.phase : 'mature';
    const growthProjection = resolveZenBonsaiGrowthProjection({
        lifeState,
        structureDepth,
    });
    const withGrowthProjection = (stage) => applyZenBonsaiGrowthProjectionToStage(
        stage,
        growthProjection,
    );
    if (phase === 'seedling') {
        return withGrowthProjection({
            ...withStructureDepth(
                STAGES.HEALTHY,
                clampStructureDepthForLifePhase(structureDepth, 3),
            ),
            leafChance: 0.74,
            flowerChance: resolveZenBonsaiStageFlowerAvailability({
                phase,
                lifeState,
                growthProjection,
                baseFlowerChance: 0.02,
            }),
            learningProgress,
            canopyTuning: canopyDistributionProfile,
            previewMode: false,
        });
    }
    if (phase === 'juvenile') {
        return withGrowthProjection({
            ...withStructureDepth(
                STAGES.HEALTHY,
                clampStructureDepthForLifePhase(structureDepth, 4),
            ),
            leafChance: 0.68,
            flowerChance: resolveZenBonsaiStageFlowerAvailability({
                phase,
                lifeState,
                growthProjection,
                baseFlowerChance: 0.08,
            }),
            learningProgress,
            canopyTuning: canopyDistributionProfile,
            previewMode: false,
        });
    }
    return withGrowthProjection({
        ...withStructureDepth(baseStage, structureDepth),
        learningProgress,
        canopyTuning: canopyDistributionProfile,
        previewMode: false,
    });
};
