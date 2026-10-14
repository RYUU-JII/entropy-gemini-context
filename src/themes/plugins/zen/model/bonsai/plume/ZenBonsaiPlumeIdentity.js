export const ZEN_BONSAI_PLUME_MODEL_ID = 'plume';
export const ZEN_BONSAI_PLUME_SPECIES_CONTRACT = 'zen_bonsai_plume_species_v1';
export const ZEN_BONSAI_PLUME_TOPOLOGY_CONTRACT = 'zen_bonsai_plume_topology_v1';
export const ZEN_BONSAI_PLUME_PROJECTED_SNAPSHOT_CONTRACT = 'zen_bonsai_plume_projected_snapshot_v1';
export const ZEN_BONSAI_PLUME_PROMOTED_SOURCE = '410419029aac89d01cc4f0034da90dfdf77484a54d0076f5484ac13cdaa6c6a1';
export const ZEN_BONSAI_PLUME_ANATOMY_SOURCE = '3a872e67e2e1676048fb56cd9208b83ed9933636973267766d8954e9e56e7bdb';
export const ZEN_BONSAI_PLUME_SEED_CONTRACT = 'zen_plume_seed_projection_v1';

// Durable identity and the promoted generator's positive uint32 input domain
// meet at this pure contract, independently of life/presentation projection.
export function resolveZenBonsaiPlumeSourceSeed(seed) {
    if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('ZEN_PLUME_PRODUCT_SEED_INVALID');
    return seed === 0 ? 0xffffffff : 1 + ((seed - 1) % 0xffffffff);
}
