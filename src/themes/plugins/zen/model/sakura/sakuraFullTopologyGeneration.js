import { createSakuraBranchGenerator } from './sakuraBranchGenerator.js';
import { createSakuraCanopyBloomLayer } from './sakuraCanopyBloom.js';
import {
    assertSakuraGenerationDetail,
    SAKURA_GENERATION_DETAIL,
} from './sakuraGenerationDetail.js';
import {
    generateSakuraTopology,
} from './sakuraTopologyGenerator.js';

export const generateSakuraFullTopology = ({
    rng,
    currentStage,
    height,
    phenotype,
    options = {},
} = {}) => {
    const generationDetail = assertSakuraGenerationDetail(
        options?.generationDetail === undefined
            ? SAKURA_GENERATION_DETAIL.FULL
            : options.generationDetail,
    );
    if (generationDetail !== SAKURA_GENERATION_DETAIL.FULL) {
        throw new Error('ZEN_SAKURA_FULL_TOPOLOGY_GENERATION_DETAIL_REQUIRED');
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
        generationDetail,
        createBranchGenerator: createSakuraBranchGenerator,
        createCanopyBloomLayer: createSakuraCanopyBloomLayer,
    });
};

export default generateSakuraFullTopology;
