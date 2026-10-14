// Domain-warped multi-wave model:
// keeps a coherent flow direction, then perturbs it with slow gust/turbulence
// so the water reads organic and less "loop-like".
import { pixiWaterSurfaceBaseShader } from './waterSurfaceShader/pixiWaterSurfaceBaseShader.js';
import { pixiWaterSurfaceMainShader } from './waterSurfaceShader/pixiWaterSurfaceMainShader.js';
import { pixiWaterSurfaceOpticsShader } from './waterSurfaceShader/pixiWaterSurfaceOpticsShader.js';
import { pixiWaterScreenRefractionShader } from './waterSurfaceShader/pixiWaterScreenRefractionShader.js';
import { pixiWaterSurfaceSheenShader } from './waterSurfaceShader/pixiWaterSurfaceSheenShader.js';
import { pixiWaterYoonseulOnlyBaseShader } from './waterSurfaceShader/pixiWaterYoonseulOnlyBaseShader.js';
import { pixiWaterYoonseulOnlyMainShader } from './waterSurfaceShader/pixiWaterYoonseulOnlyMainShader.js';
import { pixiWaterYoonseulCompositionShader } from './waterSurfaceShader/pixiWaterYoonseulCompositionShader.js';
import { pixiWaterYoonseulShader } from './waterSurfaceShader/pixiWaterYoonseulShader.js';
import {
    pixiWaterSurfaceFieldOpticsBaseShader,
    pixiWaterSurfaceFieldConsumerShader,
    pixiWaterSurfaceFieldOpticsMainShader,
    pixiWaterSurfaceFieldYoonseulOnlyBaseShader,
    pixiWaterSurfaceFieldYoonseulOnlyMainShader,
} from './waterSurfaceField/pixiWaterSurfaceFieldConsumerShader.js';
import { pixiWaterSkyReflectionShader } from './waterSurfaceField/pixiWaterSkyReflectionShader.js';
import { zenWaterSurfaceDomainShader } from './waterSurfaceField/zenWaterOpticalDomain.js';
import { zenWaterLightTransportShader } from './waterSurfaceField/zenWaterLightTransportShader.js';
import { PIXI_WATER_SURFACE_PIPELINE_MODES } from './pixiWaterSurfaceFeatureUniforms.js';
import { isZenWaterSurfaceFieldAlgorithm } from '../../contracts/zenWaterReflectionAlgorithms.js';

export const pixiWaterSurfaceOpticsFragmentShader = [
    pixiWaterSurfaceBaseShader,
    pixiWaterSurfaceOpticsShader,
    pixiWaterScreenRefractionShader,
    pixiWaterSurfaceSheenShader,
    pixiWaterYoonseulShader,
    pixiWaterYoonseulCompositionShader,
    pixiWaterSurfaceMainShader,
].join('\n\n');

export const pixiWaterYoonseulOnlyFragmentShader = [
    pixiWaterYoonseulOnlyBaseShader,
    pixiWaterSurfaceOpticsShader,
    pixiWaterSurfaceSheenShader,
    pixiWaterYoonseulShader,
    pixiWaterYoonseulCompositionShader,
    pixiWaterYoonseulOnlyMainShader,
].join('\n\n');

export const pixiWaterSurfaceFieldFragmentShader = [
    pixiWaterSurfaceFieldYoonseulOnlyBaseShader,
    zenWaterSurfaceDomainShader,
    zenWaterLightTransportShader,
    pixiWaterSurfaceOpticsShader,
    pixiWaterSkyReflectionShader,
    pixiWaterSurfaceFieldConsumerShader,
    pixiWaterSurfaceFieldYoonseulOnlyMainShader,
].join('\n\n');

export const pixiWaterSurfaceFieldOpticsFragmentShader = [
    pixiWaterSurfaceFieldOpticsBaseShader,
    zenWaterSurfaceDomainShader,
    zenWaterLightTransportShader,
    pixiWaterSurfaceOpticsShader,
    pixiWaterScreenRefractionShader,
    pixiWaterSkyReflectionShader,
    pixiWaterSurfaceFieldConsumerShader,
    pixiWaterSurfaceFieldOpticsMainShader,
].join('\n\n');

export const pixiWaterSurfaceFragmentShader = pixiWaterSurfaceFieldFragmentShader;

export const resolvePixiWaterSurfaceFragmentShader = (
    pipelineMode,
    waterReflectionAlgorithm,
) => {
    if (isZenWaterSurfaceFieldAlgorithm(waterReflectionAlgorithm)) {
        return pipelineMode === PIXI_WATER_SURFACE_PIPELINE_MODES.OPTICS_EXPERIMENTAL
            ? pixiWaterSurfaceFieldOpticsFragmentShader
            : pixiWaterSurfaceFieldFragmentShader;
    }
    return pipelineMode === PIXI_WATER_SURFACE_PIPELINE_MODES.OPTICS_EXPERIMENTAL
        ? pixiWaterSurfaceOpticsFragmentShader
        : pixiWaterYoonseulOnlyFragmentShader;
};
