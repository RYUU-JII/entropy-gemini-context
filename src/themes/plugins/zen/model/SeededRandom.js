/**
 * Simple pseudo-random number generator for seeded tree growth
 */
export class SeededRandom {
    constructor(seed) {
        this.seed = seed;
        this.initialSeed = seed;
    }
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}
