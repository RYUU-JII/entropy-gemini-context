import { requireZenWorldAmbientGrammar } from '../../runtime/environment/zenWorldAmbientGrammar.js';
import { projectZenShellMaterials } from './zenShellMaterialProjection.js';

// The immutable canonical environment is retained between material ticks in
// each realm. Shell CSS and canvas frame paint share this projection owner;
// motion frames do not recalculate architectural materials or their contrast.
const materials = new WeakMap();
const grammarFields = ['daylight', 'nightDepth', 'dawnWeight', 'duskWeight', 'warmth',
    'lowSun', 'noonWeight', 'twilightWeight', 'nightWeight'];
const weatherFields = ['cloudCover', 'rainIntensity', 'directSunlight', 'diffuseSkylight'];
let lastKey = '', lastProjection = null;

export function resolveZenEnvironmentShellMaterials(environmentState) {
    if (!environmentState || typeof environmentState !== 'object') {
        throw Error('ZEN_SHELL_MATERIAL_ENVIRONMENT_REQUIRED');
    }
    const chromaticState = requireZenWorldAmbientGrammar(environmentState.ambientChromaticState);
    const key = [...grammarFields.map(field => chromaticState[field]),
        ...weatherFields.map(field => `${typeof environmentState[field]}:${environmentState[field]}`)].join('|');
    const cached = materials.get(environmentState);
    if (cached?.key === key) return cached.projection;
    const projection = key === lastKey ? lastProjection : projectZenShellMaterials(chromaticState, environmentState);
    materials.set(environmentState, { key, projection });
    lastKey = key; lastProjection = projection;
    return projection;
}
