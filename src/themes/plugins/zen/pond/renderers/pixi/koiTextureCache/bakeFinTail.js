import { createPackedKoiShadowTexture } from './packShadow.js';
import { ZEN_KOI_SHADOW_PADDING } from '../../../contracts/zenKoiShadowMaterial.js';
import { createZenKoiFinShadowAtlas } from './bakeFinShadow.js';

export const createFinTailBakeApi = ({
    createTextureFromCanvas,
    createTextureFromRgba8,
    createCanvas,
    normalizeHistoryAnglesInPlace,
    parseHexColorSafe,
    toClampedNumber,
    toPositiveInt,
    FALLBACK_FISH_SIZE,
    SHADOW_TAIL_ALPHA_BAKE_FALLBACK,
    SHADOW_TAIL_SEAM_CLEAR_RADIUS_SIZE_FACTOR,
    SHADOW_TAIL_SEAM_CLEAR_RADIUS_SPACING_FACTOR,
} = {}) => {
    const drawFinCanvas = (fishInfo, size, isMain, isShadow = false) => {
        // Draw a single pectoral fin. We will mirror it dynamically in Pixi for the other side.
        const safeSize = toClampedNumber(size, fishInfo?.baseSize ?? FALLBACK_FISH_SIZE, 1, 1024);
        const tuning = fishInfo?.tuning || {};
        const fs = safeSize * (isMain ? (tuning.pectoralSize ?? 0.9) : (tuning.ventralSize ?? 0.45));
        if (!Number.isFinite(fs) || fs <= 0) return null;
        const w = toPositiveInt(Math.ceil(fs * 4), Math.ceil(safeSize * 2));
        const h = toPositiveInt(Math.ceil(fs * 4), Math.ceil(safeSize * 2));

        const { canvas, ctx } = createCanvas(w, h);
        if (!ctx) return null;

        const mockFish = {
            ...fishInfo,
            tuning,
        };

        // Fin rendering is usually offset and rotated. We just need it centered.
        ctx.translate(w / 2, h / 2);

        // Mimic raw shape generation from koiFishRenderFinMethods.
        const finBaseColor = isShadow ? { r: 0, g: 0, b: 0 } : parseHexColorSafe(mockFish.colorFin, '#FFFFFF');
        const { r: fr, g: fgChannel, b: fb } = finBaseColor;
        const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, fs);
        const shade = isMain ? 1.0 : 0.84;
        const r1 = Math.round(fr * shade);
        const g1 = Math.round(fgChannel * shade);
        const b1 = Math.round(fb * shade);

        fg.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${isShadow ? 0.08 : 0.95})`);
        if (isShadow) fg.addColorStop(0.25, 'rgba(0, 0, 0, 0.5)');
        fg.addColorStop(0.6, `rgba(${r1}, ${g1}, ${b1}, ${isShadow ? 0.35 : 0.76})`);
        fg.addColorStop(1, `rgba(${r1}, ${g1}, ${b1}, ${isShadow ? 0.15 : 0.38})`);
        ctx.fillStyle = fg;

        ctx.beginPath();
        ctx.moveTo(0, 0);

        if (mockFish.finStyle === 'flowing') {
            const widthScale = mockFish.tuning.pectoralWidthScale !== undefined ? mockFish.tuning.pectoralWidthScale : 1.0;
            const tipRoundness = mockFish.tuning.pectoralTipRoundness !== undefined ? mockFish.tuning.pectoralTipRoundness : 1.0;
            const leadCurve = mockFish.tuning.pectoralLeadingCurvature !== undefined ? mockFish.tuning.pectoralLeadingCurvature : 0.0;
            const trailCurve = mockFish.tuning.pectoralTrailingCurvature !== undefined ? mockFish.tuning.pectoralTrailingCurvature : 0.0;

            ctx.quadraticCurveTo(
                fs * (0.1 + leadCurve), fs * 0.4,
                -fs * 0.3, fs * 1.0,
            );
            ctx.bezierCurveTo(
                -fs * (0.5 * widthScale * tipRoundness), fs * 0.9,
                -fs * (0.75 * widthScale + trailCurve), fs * 0.4,
                0, 0,
            );
        } else {
            ctx.lineTo(-fs * 0.6, fs * 0.2);
            ctx.lineTo(-fs, fs * 0.8);
            ctx.lineTo(-fs * 0.2, fs);
            ctx.closePath();
        }
        ctx.fill();

        if (isShadow) return canvas;

        // Bake delicate rays into the existing web, so fin articulation gains
        // structure without extra sprites, per-frame paths or texture variants.
        ctx.save();
        ctx.clip();
        const rays = ctx.createRadialGradient(0, 0, fs * 0.06, 0, 0, fs);
        rays.addColorStop(0, 'rgba(55, 63, 58, 0.18)');
        rays.addColorStop(0.7, 'rgba(55, 63, 58, 0.10)');
        rays.addColorStop(1, 'rgba(55, 63, 58, 0)');
        ctx.strokeStyle = rays;
        ctx.lineWidth = Math.max(0.35, fs * 0.014);
        ctx.lineCap = 'round';
        const widthScale = tuning.pectoralWidthScale ?? 1;
        const roundness = tuning.pectoralTipRoundness ?? 1;
        const trailing = tuning.pectoralTrailingCurvature ?? 0;
        for (let i = 0; i < 7; i += 1) {
            const t = 0.08 + i * 0.115;
            const u = 1 - t;
            const x = mockFish.finStyle === 'flowing'
                ? -0.3 * u ** 3 - 1.5 * u * u * t * widthScale * roundness
                    - 3 * u * t * t * (0.75 * widthScale + trailing)
                : -0.2 - t * 0.8;
            const y = mockFish.finStyle === 'flowing'
                ? u ** 3 + 2.7 * u * u * t + 1.2 * u * t * t
                : 1 - t * 0.2;
            ctx.beginPath();
            ctx.moveTo(-fs * 0.025, fs * 0.07);
            ctx.quadraticCurveTo(fs * (x * 0.46 + 0.025), fs * y * 0.56, fs * x, fs * y);
            ctx.stroke();
        }
        ctx.restore();

        return canvas;
    };

    const drawFinTexture = (fishInfo, size, isMain) => createTextureFromCanvas(drawFinCanvas(fishInfo, size, isMain));
    const drawFinShadowAtlas = (fishInfo, size) => createZenKoiFinShadowAtlas({
        main: drawFinCanvas(fishInfo, size, true, true),
        sub: drawFinCanvas(fishInfo, size, false, true),
        createCanvas, createTextureFromRgba8,
    });

    const drawTailTexture = (fishInfo, size, isShadow = false) => {
        const cfg = fishInfo.tuning || {};
        const safeSize = toClampedNumber(size, fishInfo?.baseSize ?? FALLBACK_FISH_SIZE, 1, 1024);
        const tailLength = safeSize * (fishInfo.variant === 'elegant' ? 1.1 : 0.9) * (cfg.tailFinSize || 1.0);
        if (!Number.isFinite(tailLength) || tailLength <= 0) return null;
        const w = toPositiveInt(Math.ceil(tailLength * 3.8), Math.ceil(safeSize * 3));
        const h = toPositiveInt(Math.ceil(tailLength * 2.8), Math.ceil(safeSize * 2));

        const { canvas, ctx } = createCanvas(w, h);
        if (!ctx) return null;

        const segmentSpacing = safeSize * 0.21;
        const tailPos = {
            x: w * 0.72,
            y: h * 0.5,
            angle: 0,
        };
        const peduncle = {
            x: tailPos.x + segmentSpacing,
            y: tailPos.y,
            angle: 0,
        };
        const headStub = {
            x: peduncle.x + segmentSpacing,
            y: tailPos.y,
            angle: 0,
        };

        const mockFish = {
            ...fishInfo,
            tuning: fishInfo.tuning || {},
            history: [headStub, peduncle, tailPos],
            tailPos,
            turnRate: 0,
            banking: 0,
            variant: fishInfo.variant || 'elegant',
            colorTail: fishInfo.colorTail,
            colorFin: fishInfo.colorFin,
            getBodyRadius: typeof fishInfo.getBodyRadius === 'function'
                ? fishInfo.getBodyRadius
                : () => safeSize * 0.18,
            shadowTailAlpha: SHADOW_TAIL_ALPHA_BAKE_FALLBACK,
        };
        normalizeHistoryAnglesInPlace(mockFish.history);
        mockFish.angle = Number(mockFish.history?.[0]?.angle) || 0;

        fishInfo.drawTailFin.call(mockFish, ctx, tailPos, size, isShadow);
        if (isShadow) {
            // Prevent double-dark seam where body shadow and tail shadow overlap near peduncle.
            const seamX = peduncle.x;
            const seamY = peduncle.y;
            const clearRadius = Math.max(
                safeSize * SHADOW_TAIL_SEAM_CLEAR_RADIUS_SIZE_FACTOR,
                segmentSpacing * SHADOW_TAIL_SEAM_CLEAR_RADIUS_SPACING_FACTOR,
            );
            const seamFade = ctx.createRadialGradient(
                seamX,
                seamY,
                clearRadius * 0.1,
                seamX,
                seamY,
                clearRadius,
            );
            seamFade.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
            seamFade.addColorStop(0.55, 'rgba(0, 0, 0, 0.18)');
            seamFade.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = seamFade;
            ctx.beginPath();
            ctx.arc(seamX, seamY, clearRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        const padding = isShadow ? ZEN_KOI_SHADOW_PADDING : 0;
        return {
            texture: isShadow ? createPackedKoiShadowTexture(canvas, createCanvas, createTextureFromRgba8) : createTextureFromCanvas(canvas),
            anchor: {
                x: (tailPos.x + padding) / (w + padding * 2),
                y: (tailPos.y + padding) / (h + padding * 2),
            },
        };
    };

    return {
        drawFinTexture,
        drawFinShadowAtlas,
        drawTailTexture,
    };
};
