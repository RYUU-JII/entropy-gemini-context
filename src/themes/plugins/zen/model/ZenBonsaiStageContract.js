export const STAGES = Object.freeze({
    DEAD: Object.freeze({
        min: 0,
        max: 30,
        leafChance: 0,
        flowerChance: 0,
        color: '#8D6E63',
        text: 'Withered... 🥀',
    }),
    WEAK: Object.freeze({
        min: 31,
        max: 60,
        leafChance: 0.3,
        flowerChance: 0,
        color: '#A5D6A7',
        text: 'Recovering... 🌱',
    }),
    HEALTHY: Object.freeze({
        min: 61,
        max: 85,
        leafChance: 0.6,
        flowerChance: 0.1,
        color: '#66BB6A',
        text: 'Growing 🌿',
    }),
    BLOOM: Object.freeze({
        min: 86,
        max: 100,
        leafChance: 0.2,
        flowerChance: 0.9,
        color: '#43A047',
        text: 'In Bloom 🌸',
    }),
});

export const CANONICAL_LEARNING_STAGE = Object.freeze({
    ...STAGES.BLOOM,
    leafChance: 1,
    flowerChance: 1,
    text: 'Canonical Bloom',
});
