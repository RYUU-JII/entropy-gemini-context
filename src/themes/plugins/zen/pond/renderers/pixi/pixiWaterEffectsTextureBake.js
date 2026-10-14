import { BaseTexture, Texture } from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import { createCanvas2d } from './waterEffects/textureBake/canvas2d.js';

const clamp01 = (value) => clampValue(value, 0, 1);
const randomRange = (min, max) => min + (Math.random() * (max - min));

const applyAlphaCutoffToCanvas = (
    ctx,
    textureSize,
    alphaCutoff = 0,
    gamma = 1,
    coverageAlphaThreshold = null,
) => {
    if (!ctx || !Number.isFinite(textureSize) || textureSize <= 0) return;
    const cutoffSafe = clampValue(Number(alphaCutoff) || 0, 0, 0.9);
    if (cutoffSafe <= 0) return;
    const gammaSafe = clampValue(Number(gamma) || 1, 0.6, 2.4);
    const imageData = ctx.getImageData(0, 0, textureSize, textureSize);
    const pixels = imageData.data;
    const spread = Math.max(1e-4, 1 - cutoffSafe);
    const tracksCoverage = Number.isFinite(coverageAlphaThreshold);
    let visiblePixelCount = 0;
    for (let i = 3; i < pixels.length; i += 4) {
        const alpha01 = pixels[i] / 255;
        let nextAlpha = 0;
        if (alpha01 <= cutoffSafe) {
            nextAlpha = 0;
        } else {
            const normalized = (alpha01 - cutoffSafe) / spread;
            nextAlpha = Math.round(Math.pow(normalized, gammaSafe) * 255);
        }
        pixels[i] = nextAlpha;
        if (tracksCoverage && nextAlpha > coverageAlphaThreshold) {
            visiblePixelCount += 1;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return tracksCoverage ? visiblePixelCount : null;
};

const applySeamlessBlurToCanvas = (canvas, textureSize, blurPx = 0) => {
    const blurPxSafe = clampValue(Number(blurPx) || 0, 0, 8);
    if (blurPxSafe <= 0.01) {
        return new Texture(new BaseTexture(canvas));
    }
    const { canvas: blurCanvas, ctx: blurCtx } = createCanvas2d(textureSize, textureSize, { alpha: true });
    if (!blurCanvas || !blurCtx) {
        return new Texture(new BaseTexture(canvas));
    }
    blurCtx.filter = `blur(${blurPxSafe}px)`;
    for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
            blurCtx.drawImage(canvas, dx * textureSize, dy * textureSize);
        }
    }
    return new Texture(new BaseTexture(blurCanvas));
};

const buildTopShadowEdgeMaskCanvas = ({
    textureSize,
    sideBand,
    sideCore,
    vignetteStrength,
}) => {
    const { canvas: maskCanvas, ctx: maskCtx } = createCanvas2d(textureSize, textureSize, { alpha: true });
    if (!maskCanvas || !maskCtx) return null;

    const vignetteStrengthSafe = clampValue(Number(vignetteStrength) || 0, 0, 1);
    const sideRadius = textureSize * (0.16 + sideBand * 0.9 + vignetteStrengthSafe * 0.08);
    const sideCenterOffset = textureSize * (0.11 + sideBand * 0.28);
    const sideCenterY = textureSize * 0.5;

    const paintSideArc = (centerX, strength = 1) => {
        const sideArc = maskCtx.createRadialGradient(
            centerX,
            sideCenterY,
            sideRadius * 0.08,
            centerX,
            sideCenterY,
            sideRadius,
        );
        sideArc.addColorStop(0, `rgba(255,255,255,${clamp01(0.9 * strength)})`);
        sideArc.addColorStop(0.54, `rgba(255,255,255,${clamp01((0.44 + vignetteStrengthSafe * 0.22) * strength)})`);
        sideArc.addColorStop(1, 'rgba(255,255,255,0)');
        maskCtx.fillStyle = sideArc;
        maskCtx.fillRect(0, 0, textureSize, textureSize);
    };
    paintSideArc(-sideCenterOffset, 1);
    paintSideArc(textureSize + sideCenterOffset, 1);

    const topArc = maskCtx.createRadialGradient(
        textureSize * 0.5,
        -textureSize * 0.08,
        textureSize * 0.04,
        textureSize * 0.5,
        -textureSize * 0.08,
        textureSize * (0.45 + vignetteStrengthSafe * 0.08),
    );
    topArc.addColorStop(0, `rgba(255,255,255,${clamp01(0.18 + vignetteStrengthSafe * 0.14)})`);
    topArc.addColorStop(1, 'rgba(255,255,255,0)');
    maskCtx.fillStyle = topArc;
    maskCtx.fillRect(0, 0, textureSize, textureSize);

    const cornerRadius = textureSize * (0.1 + vignetteStrengthSafe * 0.05);
    const drawCorner = (cx, cy, alphaGain = 1) => {
        const corner = maskCtx.createRadialGradient(cx, cy, 0, cx, cy, cornerRadius);
        corner.addColorStop(0, `rgba(255,255,255,${clamp01((0.14 + vignetteStrengthSafe * 0.2) * alphaGain)})`);
        corner.addColorStop(1, 'rgba(255,255,255,0)');
        maskCtx.fillStyle = corner;
        maskCtx.fillRect(cx - cornerRadius, cy - cornerRadius, cornerRadius * 2, cornerRadius * 2);
    };
    drawCorner(0, 0, 1.0);
    drawCorner(textureSize, 0, 1.0);
    drawCorner(0, textureSize, 0.68);
    drawCorner(textureSize, textureSize, 0.68);

    const verticalMask = maskCtx.createLinearGradient(0, 0, 0, textureSize);
    verticalMask.addColorStop(0, 'rgba(255,255,255,1)');
    verticalMask.addColorStop(0.38, 'rgba(255,255,255,0.84)');
    verticalMask.addColorStop(0.74, 'rgba(255,255,255,0.24)');
    verticalMask.addColorStop(1, 'rgba(255,255,255,0.04)');
    maskCtx.globalCompositeOperation = 'multiply';
    maskCtx.fillStyle = verticalMask;
    maskCtx.fillRect(0, 0, textureSize, textureSize);

    // Keep the center clean so the effect reads as side shadows, not full-screen fog.
    const centerCut = maskCtx.createRadialGradient(
        textureSize * 0.5,
        textureSize * 0.52,
        0,
        textureSize * 0.5,
        textureSize * 0.52,
        textureSize * (0.34 + sideCore * 0.46),
    );
    centerCut.addColorStop(0, 'rgba(0,0,0,0.94)');
    centerCut.addColorStop(0.78, 'rgba(0,0,0,0.16)');
    centerCut.addColorStop(1, 'rgba(0,0,0,0)');
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.fillStyle = centerCut;
    maskCtx.fillRect(0, 0, textureSize, textureSize);
    maskCtx.globalCompositeOperation = 'source-over';

    return maskCanvas;
};

const createPeriodicValueNoiseState = () => {
    const tableSize = 256;
    const perm = new Uint8Array(tableSize * 2);
    const vals = new Float32Array(tableSize * 2);
    for (let i = 0; i < tableSize; i += 1) {
        perm[i] = i;
        vals[i] = Math.random();
    }
    for (let i = tableSize - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = perm[i];
        perm[i] = perm[j];
        perm[j] = temp;
    }
    for (let i = 0; i < tableSize; i += 1) {
        perm[tableSize + i] = perm[i];
        vals[tableSize + i] = vals[i];
    }
    const latticeByPeriod = [];
    const samplerByPeriod = [];
    const resolveLattice = (period) => {
        const cached = latticeByPeriod[period];
        if (cached) return cached;
        const lattice = new Float32Array(period * period);
        for (let iy = 0; iy < period; iy += 1) {
            for (let ix = 0; ix < period; ix += 1) {
                lattice[(iy * period) + ix] = vals[perm[perm[ix] + iy]];
            }
        }
        latticeByPeriod[period] = lattice;
        return lattice;
    };
    const lerp = (a, b, t) => a + t * (b - a);
    const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const resolveSampler = (period) => {
        const cached = samplerByPeriod[period];
        if (cached) return cached;
        const lattice = resolveLattice(period);
        const periodMask = period - 1;
        const powerOfTwoPeriod = (period & periodMask) === 0;
        const sample = powerOfTwoPeriod
            ? (x, y) => {
                const ix = Math.floor(x);
                const iy = Math.floor(y);
                const ix0 = ix & periodMask;
                const iy0 = iy & periodMask;
                const ix1 = (ix0 + 1) & periodMask;
                const iy1 = (iy0 + 1) & periodMask;
                const sx = smooth(x - ix);
                const sy = smooth(y - iy);
                const row0 = iy0 * period;
                const row1 = iy1 * period;
                return lerp(
                    lerp(lattice[row0 + ix0], lattice[row0 + ix1], sx),
                    lerp(lattice[row1 + ix0], lattice[row1 + ix1], sx),
                    sy,
                );
            }
            : (x, y) => {
                const ix = Math.floor(x);
                const iy = Math.floor(y);
                const ixRemainder = ix % period;
                const iyRemainder = iy % period;
                const ix0 = ixRemainder < 0 ? ixRemainder + period : ixRemainder;
                const iy0 = iyRemainder < 0 ? iyRemainder + period : iyRemainder;
                const ix1 = ix0 + 1 === period ? 0 : ix0 + 1;
                const iy1 = iy0 + 1 === period ? 0 : iy0 + 1;
                const sx = smooth(x - ix);
                const sy = smooth(y - iy);
                const row0 = iy0 * period;
                const row1 = iy1 * period;
                return lerp(
                    lerp(lattice[row0 + ix0], lattice[row0 + ix1], sx),
                    lerp(lattice[row1 + ix0], lattice[row1 + ix1], sx),
                    sy,
                );
            };
        samplerByPeriod[period] = sample;
        return sample;
    };
    const createFbmSampler = (period) => {
        const octave0 = resolveSampler(period);
        const octave1 = resolveSampler(period * 2);
        const octave2 = resolveSampler(period * 4);
        const octave3 = resolveSampler(period * 8);
        return (x, y) => (
            octave0(x, y) * 0.5
            + octave1(x * 2, y * 2) * 0.25
            + octave2(x * 4, y * 4) * 0.125
            + octave3(x * 8, y * 8) * 0.0625
        ) / 0.9375;
    };
    return {
        resolveSampler,
        createFbmSampler,
    };
};

export const createMistTexture = (
    textureSize = 512,
    {
        detail = 0.88,
        edgeSoftness = 0.84,
        threshold = 0.56,
        contrast = 1.12,
        alphaCutoff = 0.05,
        blurPx = 1.8,
    } = {},
) => {
    const { canvas, ctx } = createCanvas2d(textureSize, textureSize, { alpha: true, willReadFrequently: true });
    if (!canvas || !ctx) return Texture.WHITE;

    const detailSafe = clampValue(Number(detail) || 0.88, 0.3, 1.4);
    const edgeSoftnessSafe = clampValue(Number(edgeSoftness) || 0.84, 0.35, 1.8);
    const thresholdSafe = clampValue(Number(threshold) || 0.56, 0.3, 0.86);
    const contrastSafe = clampValue(Number(contrast) || 1.12, 0.75, 2.6);
    const period = Math.max(2, Math.floor(2.6 + detailSafe * 2.8));
    const smoothstep01 = (value) => {
        const t = Math.max(0, Math.min(1, value));
        return t * t * (3 - 2 * t);
    };
    const {
        resolveSampler,
        createFbmSampler,
    } = createPeriodicValueNoiseState();
    const valueNoisePeriodic = resolveSampler(period);
    const fbmPeriodic = createFbmSampler(period);
    const veinNoisePeriodic = resolveSampler(period * 2);
    const nxByX = new Float64Array(textureSize);
    const nyByY = new Float64Array(textureSize);
    for (let x = 0; x < textureSize; x += 1) {
        nxByX[x] = (x / textureSize) * period;
    }
    for (let y = 0; y < textureSize; y += 1) {
        nyByY[y] = (y / textureSize) * period;
    }
    const alphaCutoffSafe = clampValue(Number(alphaCutoff) || 0, 0, 0.9);
    const alphaSpread = Math.max(1e-4, 1 - alphaCutoffSafe);
    const alphaGamma = 1.04;
    // The cutoff operates on the already-quantized alpha byte. Resolve its
    // exact 256 outcomes once instead of repeating the same pow per pixel.
    const remappedAlphaByByte = new Uint8ClampedArray(256);
    for (let alphaByte = 0; alphaByte < 256; alphaByte += 1) {
        const alpha01 = alphaByte / 255;
        if (alphaCutoffSafe <= 0) {
            remappedAlphaByByte[alphaByte] = alphaByte;
        } else if (alpha01 <= alphaCutoffSafe) {
            remappedAlphaByByte[alphaByte] = 0;
        } else {
            const normalizedAlpha = (alpha01 - alphaCutoffSafe) / alphaSpread;
            remappedAlphaByByte[alphaByte] = Math.round(
                Math.pow(normalizedAlpha, alphaGamma) * 255,
            );
        }
    }

    const imageData = ctx.createImageData(textureSize, textureSize);
    const pixels = imageData.data;
    for (let y = 0; y < textureSize; y += 1) {
        const ny = nyByY[y];
        for (let x = 0; x < textureSize; x += 1) {
            const nx = nxByX[x];

            const rawWarpX = valueNoisePeriodic(nx + 13.5, ny + 9.2) * 1.2;
            const rawWarpY = valueNoisePeriodic(nx - 4.3, ny + 1.1) * 1.2;
            const warpedNx = (nx + rawWarpX) % period;
            const warpedNy = (ny + rawWarpY) % period;

            const baseNoise = fbmPeriodic(warpedNx, warpedNy);
            const shapeNoise = fbmPeriodic(
                (warpedNx * (1.24 + detailSafe * 0.26)) + 11.4,
                (warpedNy * (0.92 + detailSafe * 0.18)) + 6.7,
            );
            const veinNoise = veinNoisePeriodic(
                (warpedNx * 2.9) + 23.1,
                (warpedNy * 2.3) + 41.2,
            );
            const field = clamp01(baseNoise * 0.7 + shapeNoise * 0.24 + veinNoise * 0.06);
            let alpha = 0;
            if (field > (thresholdSafe - 0.1)) {
                const start = thresholdSafe - (0.12 + detailSafe * 0.06);
                const normalized = clamp01((field - start) / Math.max(1e-4, 1 - start));
                const shaped = Math.pow(normalized, contrastSafe * 0.88);
                alpha = smoothstep01(Math.pow(shaped, edgeSoftnessSafe * 0.86));
                alpha = clamp01(alpha * (0.46 + field * 0.58));
            }

            const idx = (y * textureSize + x) * 4;
            pixels[idx] = 255;
            pixels[idx + 1] = 255;
            pixels[idx + 2] = 255;
            const initialAlphaByte = Math.round(alpha * 255);
            pixels[idx + 3] = remappedAlphaByByte[initialAlphaByte];
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return applySeamlessBlurToCanvas(canvas, textureSize, blurPx);
};

export const createTopShadowTexture = (
    textureSize = 512,
    {
        layer = 'shadow',
        detail = 0.82,
        edgeSoftness = 0.65,
        threshold = 0.62,
        contrast = 1.28,
        alphaCutoff = 0.15,
        blurPx = 1.6,
        edgeBandWidth = 0.12,
        vignetteStrength = 0.48,
    } = {},
) => {
    const { canvas, ctx } = createCanvas2d(textureSize, textureSize, { alpha: true, willReadFrequently: true });
    if (!canvas || !ctx) return Texture.WHITE;

    const layerMode = String(layer || 'shadow').trim().toLowerCase() === 'light'
        ? 'light'
        : 'shadow';
    const detailSafe = clampValue(Number(detail) || 0.82, 0.3, 1.4);
    const edgeSoftnessSafe = clampValue(Number(edgeSoftness) || 0.65, 0.35, 2.4);
    const thresholdSafe = clampValue(Number(threshold) || 0.62, 0.28, 0.9);
    const contrastSafe = clampValue(Number(contrast) || 1.28, 0.65, 3.2);
    const alphaCutoffSafe = clampValue(Number(alphaCutoff) || 0.15, 0, 0.7);
    const blurPxSafe = clampValue(Number(blurPx) || 1.6, 0, 6);
    const edgeBandWidthSafe = clampValue(Number(edgeBandWidth) || 0.12, 0.04, 0.26);
    const vignetteStrengthSafe = clampValue(Number(vignetteStrength) || 0.48, 0, 1);
    const totalArea = textureSize * textureSize;
    const leafDensity = clamp01((1 - thresholdSafe) * (0.7 + detailSafe * 0.34));
    const sideBand = clampValue(0.07 + (1 - thresholdSafe) * 0.13 + detailSafe * 0.025, 0.05, 0.2);
    const sideCore = clampValue(
        sideBand * (layerMode === 'shadow' ? 0.46 : 0.4),
        0.05,
        0.14,
    );
    const topBias = clampValue(
        0.62 + (1 - edgeSoftnessSafe) * 0.08,
        0.46,
        0.84,
    );
    const clusterCount = Math.max(
        12,
        Math.round((12 + detailSafe * 20) * (0.6 + leafDensity * 1.04)),
    );
    const baseRadius = textureSize * (0.024 + detailSafe * 0.032);

    const drawWrappedLeaf = ({
        x,
        y,
        rx,
        ry,
        rotation,
        alpha = 0.3,
        edgeOnly = false,
    }) => {
        const extent = Math.max(rx, ry) + 1;
        const xOffsets = [];
        const yOffsets = [];
        if ((x + extent) >= textureSize) xOffsets.push(-textureSize);
        xOffsets.push(0);
        if ((x - extent) <= 0) xOffsets.push(textureSize);
        if ((y + extent) >= textureSize) yOffsets.push(-textureSize);
        yOffsets.push(0);
        if ((y - extent) <= 0) yOffsets.push(textureSize);
        for (let dxIndex = 0; dxIndex < xOffsets.length; dxIndex += 1) {
            for (let dyIndex = 0; dyIndex < yOffsets.length; dyIndex += 1) {
                ctx.save();
                ctx.translate(
                    x + xOffsets[dxIndex],
                    y + yOffsets[dyIndex],
                );
                ctx.rotate(rotation);
                if (edgeOnly) {
                    const edge = Math.max(0.7, Math.min(rx, ry) * edgeBandWidthSafe * 0.58);
                    ctx.strokeStyle = `rgba(255,255,255,${clamp01(alpha)})`;
                    ctx.lineWidth = edge;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    const gradient = ctx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);
                    gradient.addColorStop(0, `rgba(255,255,255,${clamp01(alpha)})`);
                    gradient.addColorStop(0.58, `rgba(255,255,255,${clamp01(alpha * 0.62)})`);
                    gradient.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        }
    };

    for (let i = 0; i < clusterCount; i += 1) {
        const sideSign = Math.random() < 0.5 ? -1 : 1;
        const centerX = sideSign < 0
            ? randomRange(-textureSize * 0.03, textureSize * sideBand * 0.3)
            : randomRange(textureSize * (1 - sideBand * 0.3), textureSize * 1.03);
        const centerY = Math.random() < topBias
            ? randomRange(-textureSize * 0.03, textureSize * 0.4)
            : randomRange(textureSize * 0.08, textureSize * 0.9);
        const inwardSpan = textureSize * (sideBand * (0.42 + Math.random() * 0.26));
        const verticalSpread = textureSize * (0.05 + Math.random() * 0.11);
        const leavesPerCluster = Math.round(4 + detailSafe * 7 + Math.random() * 6);
        for (let j = 0; j < leavesPerCluster; j += 1) {
            const inward = Math.sqrt(Math.random()) * inwardSpan;
            const x = centerX + (sideSign < 0 ? inward : -inward);
            const y = centerY + randomRange(-verticalSpread, verticalSpread);
            const taper = 0.56 + Math.random() * 0.9;
            const rx = baseRadius * taper * (0.86 + Math.random() * 0.52);
            const ry = baseRadius * (0.28 + Math.random() * 0.48);
            const orientBase = sideSign < 0
                ? randomRange(-0.36, 0.52)
                : randomRange(Math.PI - 0.52, Math.PI + 0.36);
            const rotation = orientBase + randomRange(-0.3, 0.3);
            const edgeFalloff = 1 - clamp01(inward / Math.max(1e-5, inwardSpan));
            const alphaBase = layerMode === 'shadow'
                ? (0.18 + edgeFalloff * 0.52)
                : (0.1 + edgeFalloff * 0.34);
            const alpha = clamp01(
                alphaBase
                * (0.58 + detailSafe * 0.36)
                * Math.pow(0.88 + Math.random() * 0.2, contrastSafe * 0.88),
            );
            drawWrappedLeaf({
                x,
                y,
                rx,
                ry,
                rotation,
                alpha,
                edgeOnly: layerMode === 'light',
            });
        }
    }

    const maskCanvas = buildTopShadowEdgeMaskCanvas({
        textureSize,
        sideBand,
        sideCore,
        vignetteStrength: vignetteStrengthSafe,
    });
    if (maskCanvas) {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
    }

    const visible = applyAlphaCutoffToCanvas(
        ctx,
        textureSize,
        alphaCutoffSafe,
        layerMode === 'shadow'
            ? (1.08 + (contrastSafe - 1) * 0.2)
            : (0.94 + (contrastSafe - 1) * 0.12),
        12,
    );
    if (visible < Math.round(totalArea * 0.01)) {
        ctx.clearRect(0, 0, textureSize, textureSize);
        const fallbackCount = Math.max(16, Math.round(textureSize / 20));
        for (let i = 0; i < fallbackCount; i += 1) {
            const sideSign = i % 2 === 0 ? -1 : 1;
            drawWrappedLeaf({
                x: sideSign < 0
                    ? randomRange(0, textureSize * 0.14)
                    : randomRange(textureSize * 0.86, textureSize),
                y: randomRange(textureSize * 0.04, textureSize * 0.45),
                rx: baseRadius * (0.8 + Math.random() * 0.7),
                ry: baseRadius * (0.3 + Math.random() * 0.34),
                rotation: sideSign < 0
                    ? randomRange(-0.4, 0.6)
                    : randomRange(Math.PI - 0.6, Math.PI + 0.4),
                alpha: layerMode === 'shadow' ? 0.36 : 0.22,
                edgeOnly: layerMode === 'light',
            });
        }
        applyAlphaCutoffToCanvas(ctx, textureSize, alphaCutoffSafe * 0.64, 1);
    }

    return applySeamlessBlurToCanvas(canvas, textureSize, blurPxSafe);
};
