const NEIGHBOR_RADIUS = 160;
const DEFAULT_MAX_NEIGHBORS = 3;

const getCellKey = (x, y, cellSize) => {
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    return `${cx}:${cy}`;
};

const ensureNeighborPool = (source, maxNeighbors) => {
    if (!source.neighborsPool) {
        source.neighborsPool = [];
        source.activeNeighbors = [];
    }
    while (source.neighborsPool.length < maxNeighbors) {
        source.neighborsPool.push({ uid: null, x: 0, y: 0, angle: 0, vx: 0, vy: 0, distance: 0 });
    }
    if (!source.activeNeighbors) {
        source.activeNeighbors = [];
    }
};

export function createKoiNeighborGrid({
    radius = NEIGHBOR_RADIUS,
    maxNeighbors = DEFAULT_MAX_NEIGHBORS,
} = {}) {
    const safeRadius = Math.max(1, Number(radius) || NEIGHBOR_RADIUS);
    const safeRadiusSq = safeRadius * safeRadius;
    const safeMaxNeighbors = Math.max(1, Math.floor(Number(maxNeighbors) || DEFAULT_MAX_NEIGHBORS));
    const cellSize = safeRadius;

    const buckets = new Map();
    const bucketPool = [];
    const bestNodesScratch = new Array(safeMaxNeighbors).fill(null);
    const bestDistScratch = new Array(safeMaxNeighbors).fill(Infinity);
    let bucketCursor = 0;

    const takeBucket = () => {
        if (bucketCursor < bucketPool.length) {
            const reused = bucketPool[bucketCursor];
            reused.length = 0;
            bucketCursor += 1;
            return reused;
        }
        const created = [];
        bucketPool.push(created);
        bucketCursor += 1;
        return created;
    };

    const build = (fishes) => {
        buckets.clear();
        bucketCursor = 0;
        if (!Array.isArray(fishes)) return;
        for (let i = 0; i < fishes.length; i += 1) {
            const fish = fishes[i];
            if (!fish) continue;
            const x = Number(fish.x);
            const y = Number(fish.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const key = getCellKey(x, y, cellSize);
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = takeBucket();
                buckets.set(key, bucket);
            }
            bucket.push(i);
        }
    };

    const getNearest = (fishes, index) => {
        const source = fishes[index];
        if (!source) return [];
        ensureNeighborPool(source, safeMaxNeighbors);

        const out = source.activeNeighbors;
        out.length = 0;

        const sx = source.x;
        const sy = source.y;
        const cx = Math.floor(sx / cellSize);
        const cy = Math.floor(sy / cellSize);
        let retainedPartner = null;
        let retainedPartnerDistSq = 0;

        for (let i = 0; i < safeMaxNeighbors; i += 1) {
            bestNodesScratch[i] = null;
            bestDistScratch[i] = Infinity;
        }

        for (let oy = -1; oy <= 1; oy += 1) {
            for (let ox = -1; ox <= 1; ox += 1) {
                const bucket = buckets.get(`${cx + ox}:${cy + oy}`);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i += 1) {
                    const candidateIndex = bucket[i];
                    if (candidateIndex === index) continue;
                    const candidate = fishes[candidateIndex];
                    const dx = candidate.x - sx;
                    const dy = candidate.y - sy;
                    const distSq = dx * dx + dy * dy;
                    if (distSq > safeRadiusSq) continue;
                    if (candidate.uid === source.zenKoiBehaviorMemory?.partnerUid) {
                        retainedPartner = candidate;
                        retainedPartnerDistSq = distSq;
                    }

                    for (let slot = 0; slot < safeMaxNeighbors; slot += 1) {
                        if (distSq >= bestDistScratch[slot]) continue;
                        for (let shift = safeMaxNeighbors - 1; shift > slot; shift -= 1) {
                            bestDistScratch[shift] = bestDistScratch[shift - 1];
                            bestNodesScratch[shift] = bestNodesScratch[shift - 1];
                        }
                        bestDistScratch[slot] = distSq;
                        bestNodesScratch[slot] = candidate;
                        break;
                    }
                }
            }
        }

        // Keep two nearest safety neighbors plus the committed companion. A
        // fourth fish passing nearby must not silently change the social target.
        if (retainedPartner && !bestNodesScratch.includes(retainedPartner)) {
            bestNodesScratch[safeMaxNeighbors - 1] = retainedPartner;
            bestDistScratch[safeMaxNeighbors - 1] = retainedPartnerDistSq;
        }
        for (let i = 0; i < safeMaxNeighbors; i += 1) {
            const node = bestNodesScratch[i];
            if (!node) continue;
            const target = source.neighborsPool[i];
            target.uid = node.uid;
            target.x = node.x;
            target.y = node.y;
            target.angle = node.angle;
            target.vx = node.velocity?.x || 0;
            target.vy = node.velocity?.y || 0;
            target.distance = Math.sqrt(bestDistScratch[i] || 0);
            out.push(target);
        }
        return out;
    };

    const forEachNearby = (fishes, x, y, radius, visit, context = null) => {
        if (!Array.isArray(fishes) || typeof visit !== 'function') return;
        const sx = Number(x);
        const sy = Number(y);
        const queryRadius = Math.max(0, Number(radius) || 0);
        if (!Number.isFinite(sx) || !Number.isFinite(sy) || queryRadius <= 0) return;
        const queryRadiusSq = queryRadius * queryRadius;
        const minCx = Math.floor((sx - queryRadius) / cellSize);
        const maxCx = Math.floor((sx + queryRadius) / cellSize);
        const minCy = Math.floor((sy - queryRadius) / cellSize);
        const maxCy = Math.floor((sy + queryRadius) / cellSize);

        for (let cy = minCy; cy <= maxCy; cy += 1) {
            for (let cx = minCx; cx <= maxCx; cx += 1) {
                const bucket = buckets.get(`${cx}:${cy}`);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i += 1) {
                    const candidateIndex = bucket[i];
                    const candidate = fishes[candidateIndex];
                    if (!candidate) continue;
                    const dx = (Number(candidate.x) || 0) - sx;
                    const dy = (Number(candidate.y) || 0) - sy;
                    const distSq = dx * dx + dy * dy;
                    if (distSq > queryRadiusSq) continue;
                    visit(candidate, distSq, candidateIndex, context);
                }
            }
        }
    };

    return {
        build,
        forEachNearby,
        getNearest,
    };
}
