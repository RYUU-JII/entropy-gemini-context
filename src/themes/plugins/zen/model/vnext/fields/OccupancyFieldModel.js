import { SpatialIndex } from './SpatialIndex';

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const lerp = (a, b, t) => a + ((b - a) * clamp01(t));

export class OccupancyFieldModel {
    constructor({
        cellSize = 28,
        queryRadius = 48,
        saturationCount = 10,
    } = {}) {
        this.queryRadius = Math.max(4, toNumber(queryRadius, 48));
        this.saturationCount = Math.max(1, Math.floor(toNumber(saturationCount, 10)));
        this.index = new SpatialIndex({
            cellSize,
        });
    }

    clear() {
        this.index.clear();
    }

    addPoint(position, payload = null) {
        this.index.insert(position, payload);
    }

    addSegment(p0 = [0, 0, 0], p1 = [0, 0, 0], payload = null) {
        const dx = toNumber(p1?.[0]) - toNumber(p0?.[0]);
        const dy = toNumber(p1?.[1]) - toNumber(p0?.[1]);
        const dz = toNumber(p1?.[2]) - toNumber(p0?.[2]);
        const distance = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
        const steps = Math.max(1, Math.ceil(distance / Math.max(2, this.queryRadius * 0.35)));
        for (let index = 0; index <= steps; index += 1) {
            const t = index / steps;
            this.index.insert([
                lerp(toNumber(p0?.[0]), toNumber(p1?.[0]), t),
                lerp(toNumber(p0?.[1]), toNumber(p1?.[1]), t),
                lerp(toNumber(p0?.[2]), toNumber(p1?.[2]), t),
            ], payload);
        }
    }

    sampleDensity(position = [0, 0, 0], radius = this.queryRadius) {
        return clamp01(
            this.index.density(
                position,
                Math.max(2, toNumber(radius, this.queryRadius)),
                this.saturationCount,
            ),
        );
    }

    sampleClearance(position = [0, 0, 0], radius = this.queryRadius) {
        return clamp01(1 - this.sampleDensity(position, radius));
    }
}

