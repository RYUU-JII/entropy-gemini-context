// Fixed presentation geometry. Weather, clocks and render resources remain with
// the caller; no drop objects or spawn queue are created here.
export const ZEN_RAIN_STREAK_CAPACITY = 16;
export const ZEN_RAIN_BUCKET_COUNT = 2;
export const ZEN_RAIN_STREAKS_PER_BUCKET = 8;
export const ZEN_RAIN_LINE_WIDTH_CSS = Object.freeze([1.15, 2]);

const fract = value => value - Math.floor(value);
const hash = value => {
    let mixed = value | 0;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x45d9f3b);
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x45d9f3b);
    return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967296;
};

export function compileZenRainStreakLayout({ width, height, seed, skyPlane }) {
    if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0
        || !Number.isSafeInteger(seed)) throw Error('ZEN_RAIN_LAYOUT_INVALID');
    if (!Array.isArray(skyPlane) || skyPlane.length !== 4
        || !skyPlane.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)
            && point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height)) {
        throw Error('ZEN_RAIN_SKY_PLANE_INVALID');
    }
    const clipPlanes = new Float64Array(12);
    for (let index = 0; index < 4; index++) {
        const point = skyPlane[index], next = skyPlane[(index + 1) % 4], after = skyPlane[(index + 2) % 4];
        const dx = next.x - point.x, dy = next.y - point.y;
        if (dx * (after.y - next.y) - dy * (after.x - next.x) <= 0) {
            throw Error('ZEN_RAIN_SKY_PLANE_WINDING_INVALID');
        }
        clipPlanes[index * 3] = -dy;
        clipPlanes[index * 3 + 1] = dx;
        clipPlanes[index * 3 + 2] = dy * point.x - dx * point.y;
    }
    const constants = new Float64Array(ZEN_RAIN_STREAK_CAPACITY * 4);
    const cycleDurations = new Float64Array(ZEN_RAIN_STREAK_CAPACITY);
    for (let index = 0; index < ZEN_RAIN_STREAK_CAPACITY; index++) {
        const near = index >= ZEN_RAIN_STREAKS_PER_BUCKET;
        // Retain the approved study's near-bank identities when reducing its
        // capacity from 64 to 16, rather than rerolling the foreground rhythm.
        const identityIndex = near ? index - ZEN_RAIN_STREAKS_PER_BUCKET + 32 : index;
        const identity = Math.imul(identityIndex + 1, 7919) ^ seed, offset = index * 4;
        constants[offset] = hash(identity);
        constants[offset + 1] = hash(identity ^ 0x51ed270b);
        constants[offset + 2] = (near ? 780 : 420) * (0.84 + hash(identity ^ 0x14db4d1f) * 0.32);
        constants[offset + 3] = (near ? 18 : 10) * (0.8 + hash(identity ^ 0x1b873593) * 0.4);
        const flightDuration = (height + 40) / constants[offset + 2];
        const idleDuration = (near ? 2.8 : 2.3) + hash(identity ^ 0x6d2b79f5) * 1.8;
        cycleDurations[index] = flightDuration + idleDuration;
    }
    return Object.freeze({ width, height, seed, constants, cycleDurations, clipPlanes,
        skyPlane: Object.freeze(skyPlane.map(point => Object.freeze({ x: point.x, y: point.y }))), margin: 20 });
}

export function createZenRainGeometryState() {
    return { segments: new Float64Array(ZEN_RAIN_STREAK_CAPACITY * 4),
        visibility: new Uint8Array(ZEN_RAIN_STREAK_CAPACITY) };
}

export function sampleZenRainStreakGeometry(layout, counts, activeTimeSec, windOffsetX, windVelocityX, state) {
    if (![activeTimeSec, windOffsetX, windVelocityX].every(Number.isFinite) || activeTimeSec < 0) {
        throw Error('ZEN_RAIN_ACTIVE_TIME_INVALID');
    }
    state.visibility.fill(0);
    const span = layout.width + layout.margin * 2;
    for (let bucket = 0; bucket < ZEN_RAIN_BUCKET_COUNT; bucket++) {
        const first = bucket * ZEN_RAIN_STREAKS_PER_BUCKET;
        for (let index = first; index < first + counts[bucket]; index++) {
            const offset = index * 4, speed = layout.constants[offset + 2];
            const cycles = activeTimeSec / layout.cycleDurations[index] + layout.constants[offset + 1];
            const cycle = Math.floor(cycles), age = fract(cycles) * layout.cycleDurations[index];
            const identityIndex = bucket === 1 ? index - ZEN_RAIN_STREAKS_PER_BUCKET + 32 : index;
            const birthX = fract(layout.constants[offset]
                + hash(cycle ^ Math.imul(identityIndex + 1, 6173) ^ layout.seed) * 0.16);
            const x = fract(birthX + windOffsetX / span) * span - layout.margin;
            const y = age * speed - layout.margin, length = layout.constants[offset + 3];
            state.segments[offset] = x;
            state.segments[offset + 1] = y;
            state.segments[offset + 2] = x - windVelocityX / speed * length;
            state.segments[offset + 3] = y - length;
        }
    }
}

// Inset each endpoint by the quad's projected half-width. All final corners
// remain inside the canonical sky; no extra mask/filter/pass is needed.
export function clipZenRainStreakGeometry(layout, counts, state) {
    let visibleCount = 0;
    for (let bucket = 0; bucket < ZEN_RAIN_BUCKET_COUNT; bucket++) {
        const first = bucket * ZEN_RAIN_STREAKS_PER_BUCKET, halfWidth = ZEN_RAIN_LINE_WIDTH_CSS[bucket] * 0.5;
        for (let index = first; index < first + counts[bucket]; index++) {
            const offset = index * 4, x = state.segments[offset], y = state.segments[offset + 1];
            const dx = state.segments[offset + 2] - x, dy = state.segments[offset + 3] - y;
            const inverseLength = 1 / Math.hypot(dx, dy);
            const px = -dy * inverseLength * halfWidth, py = dx * inverseLength * halfWidth;
            let enter = 0, leave = 1;
            for (let plane = 0; plane < layout.clipPlanes.length; plane += 3) {
                const nx = layout.clipPlanes[plane], ny = layout.clipPlanes[plane + 1];
                const support = Math.abs(nx * px + ny * py);
                const start = nx * x + ny * y + layout.clipPlanes[plane + 2] - support;
                const delta = nx * dx + ny * dy;
                if (delta === 0) {
                    if (start < 0) { leave = -1; break; }
                } else {
                    const crossing = -start / delta;
                    if (delta > 0) enter = Math.max(enter, crossing);
                    else leave = Math.min(leave, crossing);
                    if (enter >= leave) break;
                }
            }
            state.visibility[index] = Number(enter < leave);
            if (state.visibility[index] === 0) continue;
            state.segments[offset] = x + dx * enter;
            state.segments[offset + 1] = y + dy * enter;
            state.segments[offset + 2] = x + dx * leave;
            state.segments[offset + 3] = y + dy * leave;
            visibleCount++;
        }
    }
    return visibleCount;
}

export function createZenRainBucketIndices() {
    const indices = new Uint16Array(ZEN_RAIN_STREAKS_PER_BUCKET * 6);
    for (let index = 0; index < ZEN_RAIN_STREAKS_PER_BUCKET; index++) {
        const offset = index * 6, vertex = index * 4;
        indices.set([vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3], offset);
    }
    return indices;
}

export function packZenRainBucketVertices(counts, state, bucket, output) {
    const first = bucket * ZEN_RAIN_STREAKS_PER_BUCKET, halfWidth = ZEN_RAIN_LINE_WIDTH_CSS[bucket] * 0.5;
    let visible = 0;
    for (let index = first; index < first + counts[bucket]; index++) {
        if (state.visibility[index] === 0) continue;
        const source = index * 4, offset = visible * 8;
        const x = state.segments[source], y = state.segments[source + 1];
        const endX = state.segments[source + 2], endY = state.segments[source + 3];
        const dx = endX - x, dy = endY - y, inverseLength = 1 / Math.hypot(dx, dy);
        const px = -dy * inverseLength * halfWidth, py = dx * inverseLength * halfWidth;
        output[offset] = x + px; output[offset + 1] = y + py;
        output[offset + 2] = x - px; output[offset + 3] = y - py;
        output[offset + 4] = endX - px; output[offset + 5] = endY - py;
        output[offset + 6] = endX + px; output[offset + 7] = endY + py;
        visible++;
    }
    return visible;
}
