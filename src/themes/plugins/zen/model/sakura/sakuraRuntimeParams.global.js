import { resolveNumber } from './sakuraRuntimeParams.shared';

export const resolveSakuraGlobalRuntimeParams = (gene = {}) => ({
    vigor: resolveNumber(gene.vigor, 0.55, 0, 1),
});
