const clamp01 = (value) => Math.min(1, Math.max(0, value));

export class RandomFactorModel {
    constructor({ rng = Math.random } = {}) {
        this.rng = typeof rng === 'function' ? rng : Math.random;
    }

    next() {
        const value = Number(this.rng());
        if (!Number.isFinite(value)) {
            return Math.random();
        }
        return clamp01(value);
    }

    chance(probability = 0.5) {
        return this.next() < clamp01(probability);
    }

    range(min = 0, max = 1) {
        const low = Math.min(min, max);
        const high = Math.max(min, max);
        return low + (high - low) * this.next();
    }

    int(min = 0, max = 1) {
        const low = Math.ceil(Math.min(min, max));
        const high = Math.floor(Math.max(min, max));
        if (high <= low) {
            return low;
        }
        return low + Math.floor(this.next() * ((high - low) + 1));
    }

    randomSeed(maxExclusive = 1000000) {
        const safeMax = Math.max(2, Math.floor(maxExclusive));
        return this.int(0, safeMax - 1);
    }

    pick(items = [], fallback = null) {
        if (!Array.isArray(items) || !items.length) {
            return fallback;
        }
        return items[this.int(0, items.length - 1)];
    }

    shuffle(items = []) {
        const output = Array.isArray(items) ? [...items] : [];
        for (let index = output.length - 1; index > 0; index -= 1) {
            const swapIndex = this.int(0, index);
            [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
        }
        return output;
    }

    pickTournament(items = [], scoreSelector = (entry) => entry, size = 4) {
        if (!Array.isArray(items) || !items.length) {
            return null;
        }
        const tournamentSize = Math.min(Math.max(1, Math.floor(size)), items.length);
        let winner = this.pick(items, items[0]);
        for (let i = 1; i < tournamentSize; i += 1) {
            const challenger = this.pick(items, winner);
            if (Number(scoreSelector(challenger)) > Number(scoreSelector(winner))) {
                winner = challenger;
            }
        }
        return winner;
    }
}
