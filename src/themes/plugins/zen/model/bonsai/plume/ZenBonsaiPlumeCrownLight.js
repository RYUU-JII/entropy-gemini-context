import { projectZenCherryDirection } from './annual/render.js';

export const ZEN_PLUME_CROWN_LIGHT_CONTRACT = 'zen-plume-crown-light-v1';

// Direction toward the key light in the unmirrored camera frame (x right,
// y down, z toward the viewer): the same upper-left key as the baked laminae
// and the bark, raised so a blossom's own puff and the limbs above shade it.
const TOWARD_LIGHT = (() => {
    const v = [-.3, -.95, .1], length = Math.hypot(...v);
    return v.map(value => value / length);
})();
// Any orthonormal pair across the light: occluders are binned by where they
// cross the receiving blossom's light ray.
const ACROSS_A = (() => {
    const v = [TOWARD_LIGHT[1], -TOWARD_LIGHT[0], 0], length = Math.hypot(...v);
    return v.map(value => value / length);
})();
const ACROSS_B = [
    TOWARD_LIGHT[1] * ACROSS_A[2] - TOWARD_LIGHT[2] * ACROSS_A[1],
    TOWARD_LIGHT[2] * ACROSS_A[0] - TOWARD_LIGHT[0] * ACROSS_A[2],
    TOWARD_LIGHT[0] * ACROSS_A[1] - TOWARD_LIGHT[1] * ACROSS_A[0],
];
// Petals are thin and translucent: a blossom fully across the ray passes most
// of the light. Distant occluders soften like a penumbra instead of cutting.
const OCCLUDER_OPACITY = .15;
const PENUMBRA_RADII = 6;
// Occluders level with the receiver (a neighbor beside it) do not shade it.
const MINIMUM_LEAD_RADII = .25;
// Light scatters within a puff: neighbors share a local mean so one blossom
// does not flip tone against the bunch it belongs to.
const SCATTER_RADII = 2.5;
// Shadow rank and the existing front/back rank meet in one light exposure.
const DEPTH_WEIGHT = .15;
// Fixed tone curve, not crown statistics: a growing or thinning crown keeps
// each blossom's absolute light instead of renormalizing its neighbors.
const LIGHT_PIVOT = .55, LIGHT_CONTRAST = 1.6;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Uniform bins over the crown's own bounds (counting sort, no hashing). A query
// visits the 3^d cells around a point; callers size cells to their reach.
function createGrid(axes, cell) {
    const count = axes[0].length, minimum = [], size = [], stride = [];
    let cells = 1;
    for (let axis = axes.length - 1; axis >= 0; axis--) {
        let low = Infinity, high = -Infinity;
        for (const value of axes[axis]) { low = Math.min(low, value); high = Math.max(high, value); }
        minimum[axis] = low; size[axis] = Math.floor((high - low) / cell) + 1; stride[axis] = cells; cells *= size[axis];
    }
    const coordinate = (axis, value) => Math.floor((value - minimum[axis]) / cell);
    const cellOf = index => { let id = 0; for (let axis = 0; axis < axes.length; axis++) id += coordinate(axis, axes[axis][index]) * stride[axis]; return id; };
    const start = new Int32Array(cells + 1), items = new Int32Array(count), owner = new Int32Array(count);
    for (let index = 0; index < count; index++) { owner[index] = cellOf(index); start[owner[index] + 1]++; }
    for (let id = 0; id < cells; id++) start[id + 1] += start[id];
    const fill = start.slice(0, cells);
    for (let index = 0; index < count; index++) items[fill[owner[index]]++] = index;
    return {
        start, items,
        // Cell id ranges [from,to) of the neighborhood, as a flat list.
        around(index, ranges) {
            ranges.length = 0;
            const low = [], high = [];
            for (let axis = 0; axis < axes.length; axis++) {
                const at = coordinate(axis, axes[axis][index]);
                low[axis] = Math.max(0, at - 1); high[axis] = Math.min(size[axis] - 1, at + 1);
            }
            // The last axis is contiguous: one run of cells per outer pair.
            const last = axes.length - 1;
            const visit = (axis, base) => {
                if (axis === last) { ranges.push(start[base + low[last]], start[base + high[last] + 1]); return; }
                for (let at = low[axis]; at <= high[axis]; at++) visit(axis + 1, base + at * stride[axis]);
            };
            visit(0, 0);
            return ranges;
        },
    };
}

/**
 * Crown-scale light over retained blossoms at their rest points. Each blossom
 * is shaded by the displayed blossoms between it and the key light, so the
 * underside and interior of every puff, and lower crown beneath upper limbs,
 * fall into shadow while sunlit tops stay clear. It reads no current bloom,
 * opening or alpha: a blossom keeps its light while it develops.
 * Returns exposure in [0,1] by flower id (1 = fully lit and near).
 */
export function resolveZenBonsaiPlumeCrownExposure(flowers, camera, { radiusScale, depthOf }) {
    if (!Array.isArray(flowers) || !(radiusScale > 0 && Number.isFinite(radiusScale)) || typeof depthOf !== 'function')
        throw Error('ZEN_PLUME_CROWN_LIGHT_INPUT');
    const count = flowers.length, sign = camera.horizontalSign;
    // Light frame per blossom: lead toward the light, then two axes across it.
    const lead = new Float64Array(count), across = new Float64Array(count), up = new Float64Array(count), radius = new Float64Array(count);
    let maximumRadius = 0;
    for (let index = 0; index < count; index++) {
        const flower = flowers[index], q = projectZenCherryDirection(flower.position, camera);
        if (!(flower.radius > 0 && Number.isFinite(flower.radius))) throw Error('ZEN_PLUME_CROWN_LIGHT_RADIUS');
        // Undo the camera reflection: the key light reflects with the scene.
        q[0] *= sign;
        lead[index] = dot(q, TOWARD_LIGHT); across[index] = dot(q, ACROSS_A); up[index] = dot(q, ACROSS_B);
        radius[index] = flower.radius * radiusScale; maximumRadius = Math.max(maximumRadius, radius[index]);
    }
    const exposure = new Map();
    if (!count) return exposure;
    // A shading pair overlaps across the light within 2 * maximumRadius and a
    // scattering pair lies within SCATTER_RADII * maximumRadius.
    const shadowGrid = createGrid([across, up], 2 * maximumRadius), scatterGrid = createGrid([lead, across, up], SCATTER_RADII * maximumRadius);
    const transmitted = new Float64Array(count), ranges = [];
    for (let index = 0; index < count; index++) {
        const x = across[index], y = up[index], z = lead[index], r = radius[index];
        let light = 1;
        shadowGrid.around(index, ranges);
        for (let range = 0; range < ranges.length; range += 2) for (let slot = ranges[range]; slot < ranges[range + 1]; slot++) {
            const other = shadowGrid.items[slot], pair = (r + radius[other]) / 2, ahead = lead[other] - z;
            if (ahead < MINIMUM_LEAD_RADII * pair) continue;
            const dx = across[other] - x, dy = up[other] - y, reach = 2 * pair, squared = dx * dx + dy * dy;
            if (squared >= reach * reach) continue;
            const cover = 1 - Math.sqrt(squared) / reach;
            light *= 1 - OCCLUDER_OPACITY * cover * cover / (1 + ahead / (PENUMBRA_RADII * pair));
        }
        transmitted[index] = light;
    }
    for (let index = 0; index < count; index++) {
        const x = lead[index], y = across[index], z = up[index], r = radius[index];
        let total = 0, weight = 0;
        scatterGrid.around(index, ranges);
        for (let range = 0; range < ranges.length; range += 2) for (let slot = ranges[range]; slot < ranges[range + 1]; slot++) {
            const other = scatterGrid.items[slot], reach = SCATTER_RADII * (r + radius[other]) / 2;
            const dx = lead[other] - x, dy = across[other] - y, dz = up[other] - z, squared = dx * dx + dy * dy + dz * dz;
            if (squared >= reach * reach) continue;
            const near = 1 - Math.sqrt(squared) / reach, share = near * near;
            total += share * transmitted[other]; weight += share;
        }
        const depth = depthOf(flowers[index]);
        if (!(depth >= 0 && depth <= 1)) throw Error('ZEN_PLUME_CROWN_LIGHT_DEPTH');
        const light = total / weight * (1 - DEPTH_WEIGHT + DEPTH_WEIGHT * depth);
        exposure.set(flowers[index].id, Math.max(0, Math.min(1, LIGHT_PIVOT + (light - LIGHT_PIVOT) * LIGHT_CONTRAST)));
    }
    return exposure;
}
