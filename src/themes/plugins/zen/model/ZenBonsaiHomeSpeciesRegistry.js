import { SakuraHomeSpecies } from './SakuraHomeSpecies.js';

export const resolveHomeSpecies = (treeType) => {
    if (treeType !== 'sakura') {
        throw new Error(`ZEN_BONSAI_HOME_SPECIES_UNSUPPORTED:${String(treeType)}`);
    }
    return SakuraHomeSpecies;
};

export default resolveHomeSpecies;
