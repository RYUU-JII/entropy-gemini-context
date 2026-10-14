const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const resolveCellKey = (position, cellSize) => {
    const x = Math.floor(toNumber(position?.[0], 0) / cellSize);
    const y = Math.floor(toNumber(position?.[1], 0) / cellSize);
    const z = Math.floor(toNumber(position?.[2], 0) / cellSize);
    return `${x}:${y}:${z}`;
};

export class SpatialIndex {
    constructor({ cellSize = 32 } = {}) {
        this.cellSize = Math.max(1, toNumber(cellSize, 32));
        this.buckets = new Map();
        this.pointCount = 0;
    }

    clear() {
        this.buckets.clear();
        this.pointCount = 0;
    }

    insert(position = [0, 0, 0], payload = null) {
        const key = resolveCellKey(position, this.cellSize);
        const entry = {
            position: [
                toNumber(position?.[0], 0),
                toNumber(position?.[1], 0),
                toNumber(position?.[2], 0),
            ],
            payload,
        };
        if (!this.buckets.has(key)) {
            this.buckets.set(key, []);
        }
        this.buckets.get(key).push(entry);
        this.pointCount += 1;
        return entry;
    }

    queryRadius(position = [0, 0, 0], radius = 24) {
        const safeRadius = Math.max(0, toNumber(radius, 24));
        const cs = this.cellSize;
        const originX = Math.floor(toNumber(position?.[0], 0) / cs);
        const originY = Math.floor(toNumber(position?.[1], 0) / cs);
        const originZ = Math.floor(toNumber(position?.[2], 0) / cs);
        const steps = Math.max(1, Math.ceil(safeRadius / cs));
        const radiusSq = safeRadius * safeRadius;
        const out = [];

        for (let ix = originX - steps; ix <= originX + steps; ix += 1) {
            for (let iy = originY - steps; iy <= originY + steps; iy += 1) {
                for (let iz = originZ - steps; iz <= originZ + steps; iz += 1) {
                    const key = `${ix}:${iy}:${iz}`;
                    const bucket = this.buckets.get(key);
                    if (!bucket?.length) {
                        continue;
                    }
                    bucket.forEach((entry) => {
                        const dx = entry.position[0] - toNumber(position?.[0], 0);
                        const dy = entry.position[1] - toNumber(position?.[1], 0);
                        const dz = entry.position[2] - toNumber(position?.[2], 0);
                        const distSq = (dx * dx) + (dy * dy) + (dz * dz);
                        if (distSq <= radiusSq) {
                            out.push({
                                ...entry,
                                distSq,
                            });
                        }
                    });
                }
            }
        }
        return out;
    }

    density(position = [0, 0, 0], radius = 24, saturationCount = 10) {
        const neighbors = this.queryRadius(position, radius);
        const count = neighbors.length;
        return Math.min(1, count / Math.max(1, toNumber(saturationCount, 10)));
    }
}

