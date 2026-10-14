import { resolveZenBonsaiPondBioticSignal } from '../../zenBonsaiPondBioticSignal.js';
import { selectZenBonsaiPlumeCrownFlowers } from './ZenBonsaiPlumeCrownAppearance.js';

const unit = value => Number.isFinite(value) && value >= 0 && value <= 1;
const round = value => Number(value.toFixed(4));

// Runs with topology/life changes. The existing scene source and app-wide
// emitter still own publication, quantization, rate policy, and particles.
export function resolveZenBonsaiPlumeBioticSignal({ topology, source }) {
    if (topology === null) return null; // Canonical topology is still preparing.
    if (topology?.contract !== 'zen_bonsai_plume_topology_v1' || topology.engine !== 'plume') {
        throw new Error('ZEN_PLUME_BIOTIC_TOPOLOGY');
    }
    const flowers = topology.snapshot?.flowers;
    const development = topology.snapshot?.live?.development?.flower?.flowers;
    if (!Array.isArray(flowers) || !Array.isArray(development) || flowers.length !== development.length) {
        throw new Error('ZEN_PLUME_BIOTIC_FLOWER_DEVELOPMENT');
    }
    const ids = new Set(flowers.map(flower => flower.id));
    if (ids.size !== flowers.length) throw new Error('ZEN_PLUME_BIOTIC_FLOWER_IDS');
    const retainedFlowers = selectZenBonsaiPlumeCrownFlowers(flowers);
    let visiblePetals = 0;
    for (const flower of development) {
        if (!ids.delete(flower.id) || !unit(flower.alpha) || !unit(flower.petalOpacity)) {
            throw new Error('ZEN_PLUME_BIOTIC_FLOWER_DEVELOPMENT');
        }
        if (retainedFlowers.has(flower.id)) visiblePetals += flower.alpha * flower.petalOpacity;
    }
    const signal = resolveZenBonsaiPondBioticSignal({
        // The retained picture owns its life while a new lifecycle query is pending.
        lifeState: topology.lifeState, source, engine: 'plume', stageId: 'bloom', seasonSpanDays: 7,
    });
    if (!signal) throw new Error('ZEN_PLUME_BIOTIC_LIFE_STATE');
    const flowerAlpha = topology.snapshot.live.presentation.flowerAlpha;
    if (!unit(flowerAlpha)) throw new Error('ZEN_PLUME_BIOTIC_FLOWER_ALPHA');
    const availability = retainedFlowers.size === 0 ? 0 : visiblePetals / retainedFlowers.size * flowerAlpha;
    return {
        ...signal,
        flowerCount: Math.round(visiblePetals * flowerAlpha),
        petalCapacity: round(signal.petalCapacity * availability),
        bloomRatio: round(signal.bloomRatio * availability),
        petalFallLimit: round(signal.petalFallLimit * availability),
        previewPetalRate: round(signal.previewPetalRate * availability),
    };
}
