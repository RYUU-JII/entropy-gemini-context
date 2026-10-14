import {
    SakuraStructuralSpecies,
} from './SakuraStructuralSpecies';
import { SakuraRenderSpecies } from './SakuraRenderSpecies.js';

export { SAKURA_CONFIG, SakuraStructuralSpecies } from './SakuraStructuralSpecies';
export { SakuraRenderSpecies } from './SakuraRenderSpecies.js';

export const SakuraSpecies = {
    ...SakuraStructuralSpecies,
    ...SakuraRenderSpecies,
};
