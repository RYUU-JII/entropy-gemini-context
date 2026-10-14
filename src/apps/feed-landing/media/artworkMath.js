/** Small deterministic geometry helpers. Artwork never depends on network assets. */
export function createArtRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value / 4294967296;
    };
}

export function createWavePath({ centerX, centerY, radius, turns = 5, phase = 0, stretch = 1 }) {
    const points = [];
    const samples = 240;
    for (let index = 0; index <= samples; index += 1) {
        const angle = (index / samples) * Math.PI * 2;
        const modulation = 1 + 0.14 * Math.sin(angle * turns + phase);
        const x = centerX + Math.cos(angle) * radius * modulation * stretch;
        const y = centerY + Math.sin(angle) * radius * modulation;
        points.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return `${points.join(' ')} Z`;
}
