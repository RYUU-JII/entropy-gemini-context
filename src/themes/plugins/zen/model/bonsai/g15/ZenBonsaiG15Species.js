/**
 * G15.4 Zen Bonsai Species & Renderer Adapter
 *
 * Implements the product species contract for the G15.4 Typed Developmental Scheduler.
 */
import {
    ZenBonsaiKernel,
    ZenBonsaiProductLifeStateAdapter,
} from './index.js';
import {
    ZenBonsaiG15RenderSpecies,
} from './ZenBonsaiG15RenderSpecies.js';
import {
    buildG15Scene,
} from './ZenBonsaiG15Scene.js';

export { buildG15Scene };

export const G15_MODEL_ID = 'g15_4';
export const G15_CONTRACT_ID = 'g15_4_typed_developmental_scheduler_species_v1';

export const DEFAULT_G15_PHENOTYPE = Object.freeze({
    preset: 'moyogi',
    form: 'central_recursive_meander',
    trait: 'balanced_natural',
    density: 0.9,
    corridorStrength: 0.85,
    woodPresentation: true,
    sakuraFlowering: true,
    nebari: true,
});

export function generateG15Topology({
    seed = 150031,
    lifeState = null,
    phenotype = DEFAULT_G15_PHENOTYPE,
    maxEventBudget = 160,
    preset = 'moyogi',
} = {}) {
    const sceneConfig = ZenBonsaiProductLifeStateAdapter.adaptLifeStateToSceneConfig(
        lifeState,
        { maxEventBudget },
    );

    const targetEventCount = sceneConfig.eventResolution.materializedEvents;

    const graph = ZenBonsaiKernel.generate({
        seed: Number(seed) || 150031,
        // Product time is already in absolute event units. Preset scaling is
        // reserved for direct kernel experiments, not a second product clock.
        eventBudget: targetEventCount,
        preset: phenotype?.preset || preset || 'moyogi',
        form: phenotype?.form || 'central_recursive_meander',
        trait: phenotype?.trait || 'balanced_natural',
        density: phenotype?.density ?? 0.9,
        corridorStrength: phenotype?.corridorStrength ?? 0.85,
    });

    return {
        graph,
        sceneConfig,
        lifeState,
        milestone: sceneConfig.eventResolution.milestone,
        milestoneIndex: sceneConfig.eventResolution.milestoneIndex,
        cacheSlotKey: sceneConfig.eventResolution.cacheSlotKey,
        seed,
        phenotype,
        engine: G15_MODEL_ID,
        isG15: true,
    };
}

export const ZenBonsaiG15Species = Object.freeze({
    id: G15_MODEL_ID,
    contract: G15_CONTRACT_ID,
    isAnimated: true,
    DEFAULT_Phenotype: DEFAULT_G15_PHENOTYPE,

    generateTopology: (rng, stage, referenceHeight, phenotype, options) => {
        const seed = rng?.seed || 150031;
        return generateG15Topology({
            seed,
            lifeState: options?.lifeState || null,
            phenotype: phenotype || DEFAULT_G15_PHENOTYPE,
            preset: options?.preset || 'moyogi',
        });
    },

    getPotDimensions: ZenBonsaiG15RenderSpecies.getPotDimensions,
    renderPot: ZenBonsaiG15RenderSpecies.renderPot,
    render: ZenBonsaiG15RenderSpecies.render,
});

export default ZenBonsaiG15Species;
