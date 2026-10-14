import { DEFAULT_SAKURA_Phenotype } from './BonsaiGenetics';
import { renderSakura, renderSakuraPot } from './sakura/sakuraRenderer';
import {
    getSakuraPotDimensions,
    SAKURA_CONFIG,
} from './sakura/sakuraSpeciesRuntimeContract.js';
import { ZenBonsaiG15RenderSpecies } from './bonsai/g15/ZenBonsaiG15RenderSpecies.js';

// Renderer-only species surface. It deliberately excludes topology generation so
// the production Home renderer worker consumes the materialized topology it is sent.
export const SakuraRenderSpecies = {
    DEFAULT_Phenotype: DEFAULT_SAKURA_Phenotype,
    isAnimated: true,
    getPotDimensions: getSakuraPotDimensions,

    renderPot: ({ ctx, topology, potType = 'NAVY' }) => {
        if (topology?.isG15 || topology?.engine === 'g15_4') {
            return ZenBonsaiG15RenderSpecies.renderPot({ ctx, topology, potType });
        }
        return renderSakuraPot({
            ctx,
            topology,
            species: SakuraRenderSpecies,
            potType,
        });
    },

    render: ({ ctx, topology, frameCount, currentStage, assetCache, wind, camera = null, options = {}, pixelRatio = 1 }) => {
        if (topology?.isG15 || topology?.engine === 'g15_4') {
            return ZenBonsaiG15RenderSpecies.render({
                ctx,
                topology,
                frameCount,
                wind,
                pixelRatio,
                camera,
                options,
            });
        }
        return renderSakura({
            ctx,
            topology,
            frameCount,
            currentStage,
            assetCache,
            wind,
            camera,
            options,
            species: SakuraRenderSpecies,
            config: SAKURA_CONFIG,
            pixelRatio,
        });
    },
};
