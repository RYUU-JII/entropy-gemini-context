import {
    OPTIMIZATION_PROTOCOL_STEPS,
    MAP_ELITES_DEFAULT_BINS_X,
    MAP_ELITES_DEFAULT_BINS_Y,
    MAP_ELITES_DEFAULT_DIVERSE_TOP_K,
} from './bonsai/optimizer/shared';
import { optimizeTreeDesignSingle } from './bonsai/optimizer/optimizeSingle';
import { optimizeTreeDesignMapElites } from './bonsai/optimizer/optimizeMapElites';

export { OPTIMIZATION_PROTOCOL_STEPS };

export const optimizeTreeDesign = ({
    mode = 'single',
    objectiveMode = 'blended',
    binsX = MAP_ELITES_DEFAULT_BINS_X,
    binsY = MAP_ELITES_DEFAULT_BINS_Y,
    diverseTopK = MAP_ELITES_DEFAULT_DIVERSE_TOP_K,
    ...rest
}) => {
    if (mode === 'map_elites') {
        return optimizeTreeDesignMapElites({
            ...rest,
            objectiveMode,
            binsX,
            binsY,
            diverseTopK,
        });
    }
    return optimizeTreeDesignSingle({
        ...rest,
        objectiveMode,
    });
};
