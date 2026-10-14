import { DEFAULT_SAKURA_Phenotype } from './BonsaiGenetics';
import { measureBonsaiSceneBounds } from './bonsai/rendering/measureBonsaiSceneBounds';
import { SakuraStructuralABSpecies } from './SakuraStructuralABSpecies';
import {
    assertSakuraGenerationDetail,
    SAKURA_GENERATION_DETAIL,
} from './sakura/sakuraGenerationDetail';
import {
    generateSakuraFullTopology,
} from './sakura/sakuraFullTopologyGeneration.js';

export { SakuraStructuralABSpecies } from './SakuraStructuralABSpecies';
export { SAKURA_CONFIG } from './sakura/sakuraTopologyGenerator';

const generateTopology = (
    rng,
    currentStage,
    height,
    phenotype = DEFAULT_SAKURA_Phenotype,
    options = {},
) => {
    const generationDetail = assertSakuraGenerationDetail(
        options?.generationDetail === undefined
            ? SAKURA_GENERATION_DETAIL.FULL
            : options.generationDetail,
    );
    if (generationDetail === SAKURA_GENERATION_DETAIL.STRUCTURAL_SCOUT) {
        return SakuraStructuralABSpecies.generateStructuralTopology(
            rng,
            currentStage,
            height,
            phenotype,
            {
                spineGuide: options?.spineGuide || null,
                spineReferenceFamily: options?.spineReferenceFamily || null,
                formCompositionPrior: options?.formCompositionPrior ?? null,
                formId: options?.formId ?? null,
                formVariantSeed: options?.formVariantSeed ?? null,
                trunkAdaptiveSubdivisionPolicy: options?.trunkAdaptiveSubdivisionPolicy,
            },
        );
    }
    return generateSakuraFullTopology({
        rng,
        currentStage,
        height,
        phenotype,
        options: {
            ...options,
            generationDetail,
        },
    });
};

export const SakuraStructuralSpecies = {
    DEFAULT_Phenotype: SakuraStructuralABSpecies.DEFAULT_Phenotype,
    isAnimated: true,
    getPotDimensions: SakuraStructuralABSpecies.getPotDimensions,
    generateTopology,
    generateStructuralTopology: SakuraStructuralABSpecies.generateStructuralTopology,

    measureSceneBounds: (topology, options = {}) => (
        measureBonsaiSceneBounds(topology, SakuraStructuralSpecies, options)
    ),
};
