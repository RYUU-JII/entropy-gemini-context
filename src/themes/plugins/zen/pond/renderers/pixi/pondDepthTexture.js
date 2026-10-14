import {
    hashStringFNV1a,
    mulberry32,
} from '../../../shared/zenSeededRandom.js';
import { createCanvas2d } from './waterEffects/textureBake/canvas2d.js';
import {
    requireZenPondBathymetryField,
    sampleZenPondBottomDepth,
} from '../../world/fields/zenPondBathymetryField.js';

export const ZEN_POND_BATHYMETRY_DEPTH_TEXTURE_MODEL_ID =
    'bathymetry_material_projection_v1';

const clamp = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const normalizeHexColor = (hex) => {
    if (typeof hex !== 'string') return '#000000';
    const trimmed = hex.trim();
    const match = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
    if (match) return `#${match[1].toUpperCase()}`;
    return '#000000';
};

const hexToRgb = (hex) => {
    const normalized = normalizeHexColor(hex);
    return {
        r: Number.parseInt(normalized.slice(1, 3), 16),
        g: Number.parseInt(normalized.slice(3, 5), 16),
        b: Number.parseInt(normalized.slice(5, 7), 16),
    };
};

const rgbToHex = (r, g, b) => {
    const channelToHex = (value) => {
        const clamped = clamp(Math.round(value), 0, 255);
        return clamped.toString(16).padStart(2, '0');
    };
    return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`.toUpperCase();
};

const mixHex = (a, b, t) => {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const ratio = clamp(t, 0, 1);
    return rgbToHex(
        ca.r + (cb.r - ca.r) * ratio,
        ca.g + (cb.g - ca.g) * ratio,
        ca.b + (cb.b - ca.b) * ratio,
    );
};

const hexToRgba = (hex, alpha = 1) => {
    const rgb = hexToRgb(hex);
    const resolvedAlpha = clamp(alpha, 0, 1);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${resolvedAlpha})`;
};

// The pond runs on an OffscreenCanvas inside a worker, where `document` does
// not exist. Route through the shared worker-safe helper so the depth wash is
// actually built at runtime instead of being skipped there.
const requireCanvas2d = (width, height) => {
    const { canvas, ctx } = createCanvas2d(width, height, { alpha: true });
    if (!canvas) {
        throw new Error(
            'ZEN_POND_BATHYMETRY_DEPTH_TEXTURE_CANVAS_UNAVAILABLE',
        );
    }
    if (!ctx) {
        throw new Error(
            'ZEN_POND_BATHYMETRY_DEPTH_TEXTURE_CONTEXT_UNAVAILABLE',
        );
    }
    return { canvas, ctx };
};

// Coverage the depth wash carries at the shallow rim and in the deepest
// basin. Depth has to read through opacity: a near-constant alpha left the
// basin and the shelf only a few luminance steps apart once composited, which
// is what made the floor look like flat wallpaper.
const DEPTH_WASH_SHALLOW_COVERAGE = 0.06;
const DEPTH_WASH_DEEP_COVERAGE = 0.86;

const resolveDepthTextureSize = ({ width, height }) => {
    const numericWidth = Number(width);
    const numericHeight = Number(height);
    if (
        !Number.isFinite(numericWidth)
        || !Number.isFinite(numericHeight)
        || numericWidth <= 0
        || numericHeight <= 0
    ) {
        throw new Error(
            'ZEN_POND_BATHYMETRY_DEPTH_TEXTURE_SIZE_INVALID',
        );
    }
    return Object.freeze({
        width: Math.max(200, Math.round(numericWidth * 0.58)),
        height: Math.max(140, Math.round(numericHeight * 0.58)),
    });
};

const resolveDepthPalette = (palette) => {
    const gradientStops = (
        Array.isArray(palette?.gradientStops)
        && palette.gradientStops.length > 0
    )
        ? palette.gradientStops
        : ['#2E4636', '#233829', '#1A2B20'];
    const shallow = normalizeHexColor(gradientStops[0]);
    const middle = normalizeHexColor(
        gradientStops[1] || shallow,
    );
    const deep = normalizeHexColor(
        gradientStops[2] || middle,
    );
    return Object.freeze({
        shallow,
        middle,
        deep,
        stops: Object.freeze([shallow, middle, deep]),
    });
};

const writeBathymetryRaster = ({
    ctx,
    field,
    palette,
    depthStrength,
    contourDensity,
}) => {
    const columns = field.columns;
    const rows = field.rows;
    const { canvas: fieldCanvas, ctx: fieldCtx } =
        requireCanvas2d(columns, rows);
    const image = fieldCtx.createImageData(columns, rows);
    const data = image.data;
    const minDepth = field.minDepth;
    const depthRange = Math.max(
        1e-6,
        field.maxDepth - minDepth,
    );
    const depthGain = clamp(depthStrength, 0, 2);
    const contourGain = clamp(contourDensity, 0, 2);

    for (let row = 0; row < rows; row += 1) {
        const y = (
            rows <= 1
                ? 0
                : (row / (rows - 1)) * field.worldHeight
        );
        for (let column = 0; column < columns; column += 1) {
            const x = (
                columns <= 1
                    ? 0
                    : (column / (columns - 1))
                        * field.worldWidth
            );
            const depth = sampleZenPondBottomDepth(
                field,
                x,
                y,
            );
            const normalized = clamp(
                (depth - minDepth) / depthRange,
                0,
                1,
            );
            const baseColor = normalized < 0.52
                ? mixHex(
                    palette.shallow,
                    palette.middle,
                    normalized / 0.52,
                )
                : mixHex(
                    palette.middle,
                    palette.deep,
                    (normalized - 0.52) / 0.48,
                );
            const depthColor = mixHex(
                baseColor,
                '#000000',
                normalized * (0.16 + depthGain * 0.16),
            );
            const rgb = hexToRgb(depthColor);
            const leftDepth = column > 0
                ? sampleZenPondBottomDepth(
                    field,
                    ((column - 1) / (columns - 1))
                        * field.worldWidth,
                    y,
                )
                : depth;
            const upDepth = row > 0
                ? sampleZenPondBottomDepth(
                    field,
                    x,
                    ((row - 1) / (rows - 1))
                        * field.worldHeight,
                )
                : depth;
            const localSlope = clamp(
                (
                    Math.abs(depth - leftDepth)
                    + Math.abs(depth - upDepth)
                ) / 0.08,
                0,
                1,
            );
            const contourBand = (
                Math.abs(
                    ((depth * (8 + contourGain * 8)) % 1)
                    - 0.5,
                ) < (0.018 + contourGain * 0.012)
            )
                ? 1
                : 0;
            const lightLift = (
                localSlope * (4 + contourGain * 7)
                + contourBand * contourGain * 4
            );
            const offset = (row * columns + column) * 4;
            data[offset] = clamp(rgb.r + lightLift, 0, 255);
            data[offset + 1] = clamp(rgb.g + lightLift, 0, 255);
            data[offset + 2] = clamp(rgb.b + lightLift, 0, 255);
            data[offset + 3] = Math.round(
                255 * clamp(
                    DEPTH_WASH_SHALLOW_COVERAGE
                    + normalized
                        * (
                            DEPTH_WASH_DEEP_COVERAGE
                            - DEPTH_WASH_SHALLOW_COVERAGE
                        )
                        * (0.72 + depthGain * 0.28),
                    0,
                    1,
                ),
            );
        }
    }
    fieldCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
        fieldCanvas,
        0,
        0,
        ctx.canvas.width,
        ctx.canvas.height,
    );
};

const drawContourRidges = (ctx, width, height, rng, colorA, colorB, density = 1) => {
    const densityGain = clamp(density, 0, 2);
    const lineCount = Math.max(4, Math.round((height / 26) * (0.45 + densityGain * 0.8)));
    ctx.lineCap = 'round';
    for (let i = 0; i < lineCount; i += 1) {
        const yBase = ((i + 0.5) / lineCount) * height;
        const amp = (3 + rng() * 10) * (0.7 + densityGain * 0.28);
        const freq = (0.005 + rng() * 0.015) * (0.78 + densityGain * 0.3);
        const phase = rng() * Math.PI * 2;
        const thickness = 0.7 + rng() * 1.25;
        ctx.strokeStyle = i % 2 === 0 ? colorA : colorB;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        for (let x = -8; x <= width + 8; x += 12) {
            const y = yBase + Math.sin(x * freq + phase) * amp;
            if (x <= 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
};

const drawSedimentGrain = (ctx, width, height, rng, color, density = 1) => {
    const densityGain = clamp(density, 0, 2);
    const dotCount = Math.max(240, Math.round((width * height) / 180 * (0.15 + densityGain * 0.95)));
    ctx.fillStyle = color;
    for (let i = 0; i < dotCount; i += 1) {
        const x = rng() * width;
        const y = rng() * height;
        const s = 0.35 + rng() * 1.6;
        ctx.fillRect(x, y, s, s);
    }
};

const drawRockClusters = (ctx, width, height, rng, colorDark, colorLight, density = 1) => {
    const densityGain = clamp(density, 0, 2);
    const rockCount = Math.max(0, Math.round(2 + densityGain * 8));
    for (let i = 0; i < rockCount; i += 1) {
        const cx = rng() * width;
        const cy = rng() * height;
        const rx = 6 + rng() * 24;
        const ry = 4 + rng() * 14;
        const rot = rng() * Math.PI * 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);

        const g = ctx.createRadialGradient(-rx * 0.2, -ry * 0.3, 0, 0, 0, rx * 1.6);
        g.addColorStop(0, colorLight);
        g.addColorStop(1, colorDark);
        ctx.fillStyle = g;

        ctx.beginPath();
        ctx.moveTo(-rx, -ry * 0.2);
        ctx.quadraticCurveTo(-rx * 0.4, -ry, rx * 0.4, -ry * 0.75);
        ctx.quadraticCurveTo(rx * 1.05, -ry * 0.2, rx * 0.8, ry * 0.45);
        ctx.quadraticCurveTo(0, ry * 1.1, -rx * 0.9, ry * 0.35);
        ctx.closePath();
        ctx.fill();

        // Subtle contact shadow for floor anchoring.
        ctx.fillStyle = hexToRgba('#000000', 0.08 + densityGain * 0.03);
        ctx.beginPath();
        ctx.ellipse(0, ry * 0.62, rx * 0.95, ry * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
};

const getSeedForTexture = ({ width, height, paletteId, gradientStops, seedSalt = 0 }) => {
    const stops = Array.isArray(gradientStops) ? gradientStops.join('|') : '';
    const raw = `${paletteId || 'palette'}|${width}x${height}|${stops}|${seedSalt}`;
    return hashStringFNV1a(raw);
};

export const buildPondDepthTextureKey = ({
    width,
    height,
    palette,
    bathymetryField,
    depthStrength = 1,
    contourDensity = 1,
    sedimentAmount = 1,
    seedSalt = 0,
}) => {
    const field = requireZenPondBathymetryField(bathymetryField);
    const w = Math.max(200, Math.round(width * 0.58));
    const h = Math.max(140, Math.round(height * 0.58));
    const stops = Array.isArray(palette?.gradientStops) ? palette.gradientStops.join('|') : '';
    const depthKey = clamp(depthStrength, 0, 2).toFixed(2);
    const contourKey = clamp(contourDensity, 0, 2).toFixed(2);
    const sedimentKey = clamp(sedimentAmount, 0, 2).toFixed(2);
    const seedKey = Math.abs(Math.round(Number(seedSalt) || 0)).toString(36);
    return [
        palette?.presetId || 'default',
        `${w}x${h}`,
        stops,
        field.key,
        field.fingerprint,
        `d${depthKey}`,
        `c${contourKey}`,
        `s${sedimentKey}`,
        `seed:${seedKey}`,
    ].join('|');
};

export const buildPondBathymetryDepthTextureKey = ({
    width,
    height,
    palette,
    bathymetryField,
    depthStrength = 1,
    contourDensity = 1,
} = {}) => {
    const field = requireZenPondBathymetryField(
        bathymetryField,
    );
    const size = resolveDepthTextureSize({ width, height });
    const resolvedPalette = resolveDepthPalette(palette);
    const depthKey = clamp(
        depthStrength,
        0,
        2,
    ).toFixed(2);
    const contourKey = clamp(
        contourDensity,
        0,
        2,
    ).toFixed(2);
    return [
        ZEN_POND_BATHYMETRY_DEPTH_TEXTURE_MODEL_ID,
        field.key,
        field.fingerprint,
        `${size.width}x${size.height}`,
        palette?.presetId || 'default',
        resolvedPalette.stops.join('|'),
        `d${depthKey}`,
        `c${contourKey}`,
    ].join('|');
};

export const createPondBathymetryDepthTexture = ({
    width,
    height,
    palette,
    bathymetryField,
    depthStrength = 1,
    contourDensity = 1,
} = {}) => {
    const field = requireZenPondBathymetryField(
        bathymetryField,
    );
    const size = resolveDepthTextureSize({ width, height });
    const { canvas, ctx } = requireCanvas2d(
        size.width,
        size.height,
    );
    const resolvedPalette = resolveDepthPalette(palette);
    writeBathymetryRaster({
        ctx,
        field,
        palette: resolvedPalette,
        depthStrength,
        contourDensity,
    });
    return canvas;
};

export const createPondDepthTexture = ({
    width,
    height,
    palette,
    bathymetryField,
    depthStrength = 1,
    contourDensity = 1,
    sedimentAmount = 1,
    seedSalt = 0,
} = {}) => {
    const field = requireZenPondBathymetryField(bathymetryField);
    const size = resolveDepthTextureSize({ width, height });
    const w = size.width;
    const h = size.height;
    const { canvas, ctx } = requireCanvas2d(w, h);

    const gradientStops = Array.isArray(palette?.gradientStops) && palette.gradientStops.length
        ? palette.gradientStops
        : ['#2E4636', '#233829', '#1A2B20'];
    const centerColor = gradientStops[0];
    const midColor = gradientStops[1] || centerColor;
    const edgeColor = gradientStops[2] || midColor;
    const depthGain = clamp(depthStrength, 0, 2);
    const contourGain = clamp(contourDensity, 0, 2);
    const sedimentGain = clamp(sedimentAmount, 0, 2);

    const seed = getSeedForTexture({
        width: w,
        height: h,
        paletteId: palette?.presetId,
        gradientStops,
        seedSalt,
    });
    const rng = mulberry32(seed);

    // Depth comes from the canonical bathymetry basin, not from scattered
    // blobs. The random deep pockets and shallow shelves this replaces read as
    // arbitrary stains that contradicted the basin the koi actually navigate:
    // shallow rim and deep centre landed wherever the seed put them.
    writeBathymetryRaster({
        ctx,
        field,
        palette: resolveDepthPalette(palette),
        depthStrength,
        contourDensity,
    });

    // Pebble/rock accents on the floor.
    drawRockClusters(
        ctx,
        w,
        h,
        rng,
        hexToRgba(mixHex(edgeColor, '#2D2620', 0.52), 0.18 + sedimentGain * 0.12),
        hexToRgba(mixHex(midColor, '#CEC4AE', 0.42), 0.12 + sedimentGain * 0.08),
        (depthGain * 0.55) + (sedimentGain * 0.95),
    );

    drawContourRidges(
        ctx,
        w,
        h,
        rng,
        hexToRgba(mixHex(centerColor, '#FFFFFF', 0.4), 0.018 + contourGain * 0.03),
        hexToRgba(mixHex(midColor, '#000000', 0.34), 0.014 + contourGain * 0.03),
        contourGain,
    );

    drawSedimentGrain(
        ctx,
        w,
        h,
        rng,
        hexToRgba(mixHex(midColor, '#A08E68', 0.28), 0.012 + sedimentGain * 0.034),
        sedimentGain,
    );

    return canvas;
};
