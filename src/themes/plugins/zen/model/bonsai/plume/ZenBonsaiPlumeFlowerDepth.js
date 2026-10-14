import { projectZenCherryDirection } from './annual/render.js';

export const ZEN_PLUME_FLOWER_DEPTH_CONTRACT = 'zen-plume-flower-depth-v1';

// One immutable mature envelope determines depth presentation for the whole
// life of the tree. A late bud or newly visible flower cannot renormalize it.
export function createZenBonsaiPlumeFlowerDepthRange(flowers, camera) {
    if (!Array.isArray(flowers) || !flowers.length) throw Error('ZEN_PLUME_FLOWER_DEPTH_ENVELOPE');
    const depths = flowers.map(flower => projectZenCherryDirection(flower.position, camera)[2])
        .sort((a, b) => a - b);
    return {
        contract: ZEN_PLUME_FLOWER_DEPTH_CONTRACT,
        farDepth: depths[Math.floor((depths.length - 1) * .1)],
        nearDepth: depths[Math.ceil((depths.length - 1) * .9)],
    };
}

export function resolveZenBonsaiPlumeFlowerDepth(position, camera, range) {
    if (!range || range.contract !== ZEN_PLUME_FLOWER_DEPTH_CONTRACT
        || !Number.isFinite(range.farDepth) || !Number.isFinite(range.nearDepth)
        || range.nearDepth < range.farDepth) throw Error('ZEN_PLUME_FLOWER_DEPTH_RANGE');
    const depth = projectZenCherryDirection(position, camera)[2];
    // A genuinely planar envelope has no front/back rank. Give it the neutral
    // near material instead of inventing depth or dividing by zero.
    if (range.nearDepth === range.farDepth) return 1;
    return Math.max(0, Math.min(1, (depth - range.farDepth) / (range.nearDepth - range.farDepth)));
}
