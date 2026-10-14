import { SakuraSpecies } from './SakuraSpecies.js';

// Generation-capable species registry. Renderer-only workers must use the
// narrower resolver owned by ZenCoreConfigAssetCache instead.
export const resolveSpecies = () => SakuraSpecies;
