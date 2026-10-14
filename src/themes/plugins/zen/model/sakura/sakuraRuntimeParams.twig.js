import {
    clampInt,
    resolveNumber,
} from './sakuraRuntimeParams.shared';

export const resolveSakuraTwigRuntimeParams = (gene = {}) => ({
    nodeBudgetCap: clampInt(gene.twigNodeBudgetCap ?? 20, 6, 40),
    spawnMinWidth: resolveNumber(gene.twigSpawnMinWidth, 0.14, 0.08, 0.6),
});
