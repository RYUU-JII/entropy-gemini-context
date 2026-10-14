import { ZenBonsaiPlumeRenderSpecies } from './ZenBonsaiPlumeRenderSpecies.js';
import { ZEN_BONSAI_PLUME_MODEL_ID, ZEN_BONSAI_PLUME_SPECIES_CONTRACT } from './ZenBonsaiPlumeIdentity.js';

// UI presentation descriptor only. Product topology is admitted through the
// specialized asynchronous model client, never a generic local generator.
export const ZenBonsaiPlumeSpecies = Object.freeze({
    id: ZEN_BONSAI_PLUME_MODEL_ID, contract: ZEN_BONSAI_PLUME_SPECIES_CONTRACT, isAnimated: true,
    getPotDimensions: ZenBonsaiPlumeRenderSpecies.getPotDimensions,
    render: ZenBonsaiPlumeRenderSpecies.render,
    renderPot: ZenBonsaiPlumeRenderSpecies.renderPot,
});
