import {
    DEFAULT_SAKURA_Phenotype,
    clampPhenotype,
} from '../BonsaiGenetics';
import { SAKURA_FLOWER_COLORS } from './sakuraPetalMaterial.js';

// Shared generation/render contract. Keeping these constants out of the topology
// generator prevents renderer-only worker closures from owning generation code.
export const SAKURA_CONFIG = Object.freeze({
    barkColor: '#3A242B',
    barkShadow: '#211518',
    barkHighlight: '#6B4A54',
    flowerColors: SAKURA_FLOWER_COLORS,
    leafColors: Object.freeze(['#6B7D52', '#82906B', '#9AA587']),
    potColors: Object.freeze(['#CFD8DC', '#B0BEC5', '#90A4AE']),
});

export const getSakuraPotDimensions = (phenotype = DEFAULT_SAKURA_Phenotype) => {
    const normalized = clampPhenotype(phenotype ?? DEFAULT_SAKURA_Phenotype);
    const potWidthScaleBoost = 1.45;
    const potHeightScaleBoost = 1.2;
    return Object.freeze({
        width: Math.round(80 * normalized.potScale * potWidthScaleBoost),
        height: Math.round(32 * normalized.potScale * potHeightScaleBoost),
        isGlazed: true,
        radius: Math.round(9 * normalized.potScale * potWidthScaleBoost),
    });
};
