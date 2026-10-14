import { DEFAULT_SAKURA_Phenotype } from './BonsaiGenetics';
import { SAKURA_GENERATION_DETAIL } from './sakura/sakuraGenerationDetail';
import { createSakuraStructuralBranchGenerator } from './sakura/sakuraStructuralBranchGenerator';
import {
    generateSakuraTopology,
    getSakuraPotDimensions,
} from './sakura/sakuraTopologyGenerator';

const generateStructuralTopology = (
    rng,
    currentStage,
    height,
    phenotype = DEFAULT_SAKURA_Phenotype,
    options = {},
) => {
    if (options?.spineGuide && options?.spineReferenceFamily) {
        throw new Error('ZEN_SAKURA_STRUCTURAL_SPINE_CONDITION_CONFLICT');
    }
    return generateSakuraTopology({
        rng,
        currentStage,
        height,
        phenotype,
        spineGuide: options?.spineGuide || null,
        spineReferenceFamily: options?.spineReferenceFamily || null,
        formCompositionPrior: options?.formCompositionPrior ?? null,
        formId: options?.formId ?? null,
        formVariantSeed: options?.formVariantSeed ?? null,
        trunkAdaptiveSubdivisionPolicy: options?.trunkAdaptiveSubdivisionPolicy,
        generationDetail: SAKURA_GENERATION_DETAIL.STRUCTURAL_SCOUT,
        createBranchGenerator: createSakuraStructuralBranchGenerator,
    });
};

export const SakuraStructuralABSpecies = Object.freeze({
    DEFAULT_Phenotype: DEFAULT_SAKURA_Phenotype,
    getPotDimensions: getSakuraPotDimensions,
    generateStructuralTopology,
});
