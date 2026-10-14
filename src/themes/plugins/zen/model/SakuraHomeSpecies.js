import { DEFAULT_SAKURA_Phenotype } from './BonsaiGenetics.js';
import {
    getSakuraPotDimensions,
} from './sakura/sakuraSpeciesRuntimeContract.js';
import {
    generateSakuraFullTopology,
} from './sakura/sakuraFullTopologyGeneration.js';

const generateTopology = (
    rng,
    currentStage,
    height,
    phenotype = DEFAULT_SAKURA_Phenotype,
    options = {},
) => generateSakuraFullTopology({
    rng,
    currentStage,
    height,
    phenotype,
    options,
});

// Main/Home owns generation plus render-plan anchoring only. Canvas/Pixi paint
// stays inside the renderer worker and structural A/B stays in the Lab seam.
export const SakuraHomeSpecies = Object.freeze({
    DEFAULT_Phenotype: DEFAULT_SAKURA_Phenotype,
    isAnimated: true,
    getPotDimensions: getSakuraPotDimensions,
    generateTopology,
});

export default SakuraHomeSpecies;
