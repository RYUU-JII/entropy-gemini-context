import { BaseTexture, Texture, SCALE_MODES, MIPMAP_MODES } from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import {
    ZEN_POND_CANOPY_CROWNS,
    ZEN_POND_CANOPY_LEAF_LENGTH,
    ZEN_POND_CANOPY_DIRECT_PENUMBRA,
    ZEN_POND_CANOPY_SOFT_PENUMBRA,
    ZEN_POND_CANOPY_SKY_PENUMBRA,
    ZEN_POND_CANOPY_EDGE_FEATHER,
    ZEN_POND_CANOPY_INNER_FADE,
    ZEN_POND_CANOPY_MODEL_IDS,
    ZEN_POND_CANOPY_SEED_ROLE,
    ZEN_POND_CANOPY_TEXTURE_SIZE,
} from '../../../../contracts/zenPondCanopyMaterial.js';
import { createZenSeededRandom, sampleZenRange } from '../../../../../shared/zenSeededRandom.js';
import { createCanvas2d } from './canvas2d.js';

const requireCanvas = (size, label) => {
    const { canvas, ctx } = createCanvas2d(size, size, { alpha: true, willReadFrequently: true });
    if (!canvas || !ctx) throw new Error(`ZEN_POND_CANOPY_CANVAS_UNAVAILABLE:${label}`);
    return { canvas, ctx };
};

// Branch endpoints form an open L, rather than a ring around the picture.
// Each crown owns connected twigs and leaf clusters in isotropic coordinates.
// Its two edge signs orient the geometry, independently of solar projection.
const BRANCH_TIPS = Object.freeze([
    [0.14, 0.15], [0.32, 0.14], [0.52, 0.13], [0.72, 0.19],
    [0.19, 0.33], [0.30, 0.40], [0.17, 0.53], [0.24, 0.69], [0.15, 0.87],
]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const createZenCanopyGeometry = ({ sceneGenerationKey, model = 'layered' }) => {
    if (typeof sceneGenerationKey !== 'string' || !sceneGenerationKey.trim()) {
        throw new Error('ZEN_POND_CANOPY_SCENE_KEY_REQUIRED');
    }
    if (model !== 'layered' && model !== 'lacy') throw new Error(`ZEN_POND_CANOPY_MODEL_UNSUPPORTED:${model}`);
    return ZEN_POND_CANOPY_CROWNS.map((crown) => {
        const rng = createZenSeededRandom(sceneGenerationKey, `${ZEN_POND_CANOPY_SEED_ROLE}-${model}-${crown.id}`);
        const range = (min, max) => sampleZenRange(rng, min, max);
        const branches = [];
        const leaves = [];
        const gaps = [];
        const reflect = ([x, y]) => [crown.edgeX < 0 ? 1 - x : x, crown.edgeY < 0 ? 1 - y : y];
        const spine = [[0.015, 0.015], [0.08, 0.13], [0.11, 0.32], [0.09, 0.53], [0.12, 0.76], [0.13, 0.88]];
        const upperArm = [[0.08, 0.13], [0.30, 0.12], [0.51, 0.14], [0.72, 0.19]];
        [spine, upperArm].forEach((path) => {
            for (let index = 1; index < path.length; index += 1) {
                const previous = path[index - 1];
                const next = path[index];
                branches.push({ start: reflect(previous), control: reflect([previous[0], next[1]]), end: reflect(next), width: 0.0028 / crown.size });
            }
        });
        const branchRoots = [[0.08, 0.13], [0.23, 0.12], [0.43, 0.13], [0.61, 0.17], [0.11, 0.32], [0.10, 0.40], [0.09, 0.53], [0.11, 0.68], [0.13, 0.82]];
        const tips = BRANCH_TIPS.map(([x, y]) => [x + range(-0.028, 0.028), y + range(-0.025, 0.025)]);
        tips.forEach(([tipX, tipY], clusterIndex) => {
            const root = branchRoots[clusterIndex];
            const start = reflect(root);
            const tip = reflect([tipX, tipY]);
            branches.push({ start, control: reflect([root[0], tipY]), end: tip, width: range(0.0009, 0.0015) / crown.size });
            const crownAreaRatio = (crown.size / ZEN_POND_CANOPY_CROWNS[0].size) ** 2;
            const leafCount = Math.round((model === 'lacy' ? 48 : 38) * crownAreaRatio);
            for (let index = 0; index < leafCount; index += 1) {
                const angle = range(0, Math.PI * 2);
                const distance = Math.sqrt(rng()) * range(0.07, 0.13);
                const x = clamp(tipX + Math.cos(angle) * distance, 0.014, 0.97);
                const y = clamp(tipY + Math.sin(angle) * distance * 0.75, 0.014, 0.97);
                const centre = reflect([x, y]);
                const length = range(...ZEN_POND_CANOPY_LEAF_LENGTH[model]) / crown.size;
                const rotation = angle + range(-0.6, 0.6);
                leaves.push({ centre, length, width: length * range(0.35, 0.58), rotation: Math.atan2(Math.sin(rotation) * (crown.edgeY < 0 ? -1 : 1), Math.cos(rotation) * (crown.edgeX < 0 ? -1 : 1)), alpha: range(0.38, 0.72), clusterIndex });
                if (index % 7 === 0) {
                    branches.push({ start: tip, control: reflect([(tipX + x) * 0.5, tipY]), end: centre, width: 0.00065 / crown.size });
                }
            }
            // The apertures are holes through a leaf mass. Their direction is
            // botanical geometry, never a baked substitute for the solar angle.
            for (let index = 0; index < 4; index += 1) {
                gaps.push({ centre: reflect([tipX + range(-0.075, 0.075), tipY + range(-0.055, 0.055)]), radius: range(0.006, 0.010) / crown.size, ratio: range(0.6, 1.3), rotation: range(0, Math.PI), alpha: range(0.8, 1) });
            }
        });
        return { id: crown.id, atlas: crown.atlas, branches, leaves, gaps };
    });
};

const paintLeaf = (ctx, leaf) => {
    ctx.save();
    ctx.translate(...leaf.centre);
    ctx.rotate(leaf.rotation);
    const half = leaf.length * 0.5;
    ctx.fillStyle = `rgba(255,255,255,${leaf.alpha})`;
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.bezierCurveTo(-half * 0.3, -leaf.width, half * 0.7, -leaf.width * 0.5, half, 0);
    ctx.bezierCurveTo(half * 0.35, leaf.width * 0.8, -half * 0.7, leaf.width * 0.55, -half, 0);
    ctx.fill();
    ctx.restore();
};

const paintIsland = (ctx, size, geometry, paint) => {
    const [left, top, right, bottom] = geometry.atlas;
    const span = (right - left) * size;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left * size + 1, top * size + 1, span - 2, (bottom - top) * size - 2);
    ctx.clip();
    ctx.translate(left * size, top * size);
    ctx.scale(span, span);
    paint(ctx, geometry);
    ctx.restore();
};

const blurCanopyIslands = (canvas, size, worldRadius, label) => {
    const output = requireCanvas(size, label);
    ZEN_POND_CANOPY_CROWNS.forEach((crown) => {
        const [left, top, right] = crown.atlas;
        const x = left * size;
        const y = top * size;
        const span = (right - left) * size;
        output.ctx.save();
        output.ctx.beginPath();
        output.ctx.rect(x + 1, y + 1, span - 2, span - 2);
        output.ctx.clip();
        output.ctx.filter = `blur(${worldRadius / crown.size * span}px)`;
        output.ctx.drawImage(canvas, x, y, span, span, x, y, span, span);
        output.ctx.restore();
    });
    return output.canvas;
};

const smoothstep = (start, end, value) => {
    const t = clamp((value - start) / (end - start), 0, 1);
    return t * t * (3 - 2 * t);
};

const createCanopyEdgeCoverage = (size) => {
    const coverage = new Float32Array(size * size);
    ZEN_POND_CANOPY_CROWNS.forEach((crown) => {
        const [left, top, right, bottom] = crown.atlas.map((value) => Math.round(value * size));
        const span = right - left;
        // Keep double intermediates and the final Float32 write. Monotonic
        // smoothstep factors separate by axis without changing the coverage.
        const featherX = new Float64Array(span);
        const innerX = new Float64Array(span);
        for (let offset = 0; offset < span; offset += 1) {
            const u = (offset + 0.5) / span;
            featherX[offset] = smoothstep(0, ZEN_POND_CANOPY_EDGE_FEATHER, Math.min(u, 1 - u) * crown.size);
            const inwardX = crown.edgeX === 0 ? 1 : crown.edgeX > 0 ? u : 1 - u;
            innerX[offset] = 1 - smoothstep(...ZEN_POND_CANOPY_INNER_FADE, inwardX * crown.size);
        }
        for (let y = top; y < bottom; y += 1) {
            const v = (y - top + 0.5) / span;
            const featherY = smoothstep(0, ZEN_POND_CANOPY_EDGE_FEATHER, Math.min(v, 1 - v) * crown.size);
            const inwardY = crown.edgeY === 0 ? 1 : crown.edgeY > 0 ? v : 1 - v;
            const innerY = 1 - smoothstep(...ZEN_POND_CANOPY_INNER_FADE, inwardY * crown.size);
            for (let x = left; x < right; x += 1) {
                const offset = x - left;
                coverage[y * size + x] = Math.min(featherX[offset], featherY)
                    * Math.max(innerX[offset], innerY) * crown.density;
            }
        }
    });
    return coverage;
};

export const createZenPondCanopyField = ({ sceneGenerationKey, model = 'layered' } = {}) => {
    const geometry = createZenCanopyGeometry({ sceneGenerationKey, model });
    const size = ZEN_POND_CANOPY_TEXTURE_SIZE;
    const leaves = requireCanvas(size, 'leaves');
    const apertures = requireCanvas(size, 'apertures');
    geometry.forEach((crown) => {
        paintIsland(leaves.ctx, size, crown, (ctx, { branches, leaves: leafShapes }) => {
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(255,255,255,0.65)';
            branches.forEach((branch) => {
                ctx.lineWidth = branch.width;
                ctx.beginPath();
                ctx.moveTo(...branch.start);
                ctx.quadraticCurveTo(...branch.control, ...branch.end);
                ctx.stroke();
            });
            leafShapes.forEach((leaf) => paintLeaf(ctx, leaf));
        });
        paintIsland(apertures.ctx, size, crown, (ctx, { gaps }) => {
            gaps.forEach((gap) => {
                ctx.fillStyle = `rgba(255,255,255,${gap.alpha})`;
                ctx.save();
                ctx.translate(...gap.centre);
                ctx.rotate(gap.rotation);
                ctx.scale(gap.radius, gap.radius * gap.ratio);
                ctx.beginPath();
                ctx.moveTo(-1, 0.1);
                ctx.quadraticCurveTo(-0.2, -1, 0.3, -0.6);
                ctx.quadraticCurveTo(0.7, -0.25, 1, 0.05);
                ctx.quadraticCurveTo(0.25, 0.9, -0.4, 0.35);
                ctx.quadraticCurveTo(-1, 0.3, -1, 0.1);
                ctx.fill();
                ctx.restore();
            });
        });
    });
    // Blur the actual perforated silhouette, not a sharp hole multiplied into
    // an already-soft leaf. Both sides of each aperture share one penumbra.
    const punched = requireCanvas(size, 'punched-leaves');
    punched.ctx.drawImage(leaves.canvas, 0, 0);
    punched.ctx.globalCompositeOperation = 'destination-out';
    punched.ctx.drawImage(apertures.canvas, 0, 0);
    const leafOutput = blurCanopyIslands(leaves.canvas, size, ZEN_POND_CANOPY_DIRECT_PENUMBRA, 'leaf-penumbra');
    const punchedOutput = blurCanopyIslands(punched.canvas, size, ZEN_POND_CANOPY_DIRECT_PENUMBRA, 'aperture-penumbra');
    const leafPixels = leafOutput.getContext('2d').getImageData(0, 0, size, size).data;
    const punchedPixels = punchedOutput.getContext('2d').getImageData(0, 0, size, size).data;
    const softLeaf = blurCanopyIslands(leaves.canvas, size, ZEN_POND_CANOPY_SOFT_PENUMBRA, 'soft-leaf-penumbra');
    const softPunched = blurCanopyIslands(punched.canvas, size, ZEN_POND_CANOPY_SOFT_PENUMBRA, 'soft-aperture-penumbra');
    const softLeafPixels = softLeaf.getContext('2d').getImageData(0, 0, size, size).data;
    const softPunchedPixels = softPunched.getContext('2d').getImageData(0, 0, size, size).data;
    // Four independent data channels. A canvas upload would premultiply RGB by
    // the fourth mask and erase data; fromBuffer preserves the unassociated bytes.
    const packed = new Uint8Array(size * size * 4);
    const edgeCoverage = createCanopyEdgeCoverage(size);
    let shadePixels = 0;
    let supportedGapPixels = 0;
    for (let index = 0; index < leafPixels.length; index += 4) {
        const coverage = edgeCoverage[index / 4];
        const leaf = Math.round(leafPixels[index + 3] * coverage);
        const shade = Math.min(leaf, Math.round(punchedPixels[index + 3] * coverage));
        const gap = leaf - shade;
        const soft = Math.round(softLeafPixels[index + 3] * coverage);
        packed[index] = leaf;
        packed[index + 1] = shade;
        packed[index + 2] = soft;
        packed[index + 3] = Math.min(soft, Math.round(softPunchedPixels[index + 3] * coverage));
        if (shade > 10) shadePixels += 1;
        if (gap > 10) supportedGapPixels += 1;
    }
    const shadeCoverageRatio = shadePixels / (size * size);
    const sunlightCoverageRatio = supportedGapPixels / (size * size);
    if (shadeCoverageRatio < 0.035 || shadeCoverageRatio > 0.5 || sunlightCoverageRatio < 0.001) {
        throw new Error(`ZEN_POND_CANOPY_GEOMETRY_COVERAGE_INVALID:${shadeCoverageRatio}:${sunlightCoverageRatio}`);
    }
    const sky = blurCanopyIslands(leaves.canvas, size, ZEN_POND_CANOPY_SKY_PENUMBRA, 'diffuse-sky-occlusion');
    const skyContext = sky.getContext('2d');
    const skyPixels = skyContext.getImageData(0, 0, size, size);
    for (let index = 0; index < edgeCoverage.length; index += 1) {
        skyPixels.data[index * 4 + 3] = Math.round(skyPixels.data[index * 4 + 3] * edgeCoverage[index]);
    }

    // Both sky consumers read only alpha. Retain the existing CPU pixels for
    // native upload/reupload without a Canvas write and premultiplication pass.
    return Object.freeze({
        directOcclusionTexture: new Texture(BaseTexture.fromBuffer(packed, size, size, {
            scaleMode: SCALE_MODES.LINEAR, mipmap: MIPMAP_MODES.OFF,
        })),
        skyOcclusionTexture: new Texture(BaseTexture.fromBuffer(skyPixels.data, size, size, {
            scaleMode: SCALE_MODES.LINEAR, mipmap: MIPMAP_MODES.OFF,
        })),
        modelId: model === 'lacy' ? ZEN_POND_CANOPY_MODEL_IDS.LACY : ZEN_POND_CANOPY_MODEL_IDS.LAYERED,
        gapCount: geometry.reduce((sum, crown) => sum + crown.gaps.length, 0),
        foliageLobeCount: geometry.reduce((sum, crown) => sum + crown.leaves.length, 0),
        shadeCoverageRatio: Number(shadeCoverageRatio.toFixed(6)),
        sunlightCoverageRatio: Number(sunlightCoverageRatio.toFixed(6)),
    });
};
