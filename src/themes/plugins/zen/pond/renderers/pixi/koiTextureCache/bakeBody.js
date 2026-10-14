import { resolveCanonicalKoiBodyMaterialTones } from '../../../model/koi/koiBodyMaterialCore.js';

export const createBodyBakeApi = ({
    createTextureFromCanvas,
    createTextureFromRgba8,
    normalizeHistoryAnglesInPlace,
    toClampedNumber,
    toPositiveInt,
    isFinitePoint,
    createLinearGradientSafe,
    KOI_BAKE_RESOLUTION,
    KOI_BODY_BAKE_RESOLUTION,
    FALLBACK_FISH_SIZE,
    MAX_CANVAS_EDGE,
} = {}) => {
    const createCanvas = (w, h, resolution = KOI_BAKE_RESOLUTION, contextAttributes = { alpha: true }) => {
        if (typeof document === 'undefined') return { canvas: null, ctx: null };
        const canvas = document.createElement('canvas');
        const textureResolution = toClampedNumber(resolution, KOI_BAKE_RESOLUTION, 0.5, 4);
        const logicalWidth = toPositiveInt(w, 1);
        const logicalHeight = toPositiveInt(h, 1);
        canvas.width = toPositiveInt(Math.ceil(logicalWidth * textureResolution), 1, 1, MAX_CANVAS_EDGE);
        canvas.height = toPositiveInt(Math.ceil(logicalHeight * textureResolution), 1, 1, MAX_CANVAS_EDGE);
        const ctx = canvas.getContext('2d', contextAttributes);
        if (ctx) {
            ctx.setTransform(textureResolution, 0, 0, textureResolution, 0, 0);
            ctx.imageSmoothingEnabled = true;
            if (typeof ctx.imageSmoothingQuality === 'string') {
                ctx.imageSmoothingQuality = 'high';
            }
        }
        return { canvas, ctx };
    };

    const buildBodyBakeData = (fishInfo, size) => {
        const safeSize = toClampedNumber(
            size,
            toClampedNumber(fishInfo?.baseSize, FALLBACK_FISH_SIZE, 1, 1024),
            1,
            1024,
        );
        // Keep bake history straight and resolve angles from the same head->tail contract as simulation.
        const segmentSpacing = safeSize * 0.21;
        const historyLength = toPositiveInt(fishInfo?.historyLength || 20, 20, 3, 256);
        const spineLength = Math.max(segmentSpacing, (historyLength - 1) * segmentSpacing);
        const headInset = safeSize * 0.2;
        const tailInset = safeSize * 0.15;
        const w = toPositiveInt(Math.ceil(headInset + spineLength + tailInset), Math.ceil(safeSize * 2));
        const h = toPositiveInt(Math.ceil(safeSize * 4), Math.ceil(safeSize * 4));

        // Shape construction uses Path2D only. Raster owners allocate their
        // own canvases; the form owner constructs opaque bytes directly.
        // Create a temporary mock fish instance just for rendering its shape
        const mockFish = {
            ...fishInfo,
            x: headInset, // Head at the left so rope point 0 maps near texture start
            y: h / 2,
            angle: 0, // Placeholder; resolved from history by normalizeHistoryAnglesInPlace.
            tuning: fishInfo.tuning || {},
        };

        // Populate history in a straight line.
        mockFish.history = [];
        for (let i = 0; i < historyLength; i++) {
            mockFish.history.push({
                x: headInset + i * segmentSpacing,
                y: h / 2,
                angle: 0,
            });
        }
        normalizeHistoryAnglesInPlace(mockFish.history);
        mockFish.angle = Number(mockFish.history?.[0]?.angle) || 0;

        // The renderer-owned bake source restores the narrow visual contract
        // without coupling the worker simulation entity to Canvas rendering.
        mockFish.createBodyPath = fishInfo.createBodyPath;
        mockFish.getBodyRadius = fishInfo.getBodyRadius;
        mockFish.drawPattern = fishInfo.drawPattern;
        mockFish.drawDorsalFin = fishInfo.drawDorsalFin;
        mockFish.drawEyeSimple = fishInfo.drawEyeSimple;
        mockFish.mixColor = fishInfo.mixColor;
        mockFish.tuning = fishInfo.tuning || {};

        const bodyPathData = mockFish.createBodyPath(null, safeSize, true);
        if (!bodyPathData?.path) return null;

        return {
            w,
            h,
            size: safeSize,
            mockFish,
            bodyPathData,
        };
    };

    const resolveBodyRadiusAtIndex = (fishInfo, index, size) => {
        if (typeof fishInfo?.getBodyRadius !== 'function') return Math.max(1, size * 0.28);
        const historyLength = Math.max(2, Number(fishInfo?.historyLength) || Number(fishInfo?.history?.length) || 20);
        const safeIndex = Math.max(0, Math.min(historyLength - 1, Math.round(index)));
        return Math.max(1, fishInfo.getBodyRadius(safeIndex / (historyLength - 1), size));
    };

    const drawHeadShoulderBreakAccent = (ctx, fishInfo, size) => {
        const history = fishInfo?.history;
        if (!ctx || !Array.isArray(history) || history.length < 7) return;

        const physics = fishInfo?.tuning?.physics || {};
        const eyeAnchorRaw = Number(physics.eventEyeAnchorIndex);
        const eyeAnchorIdx = Number.isFinite(eyeAnchorRaw) ? Math.round(eyeAnchorRaw) : 3;
        const pectoralShift = Number(fishInfo?.tuning?.pectoralPosShift) || 0;
        const baseNeckIdx = Number.isFinite(Number(fishInfo?.neckIndex))
            ? Number(fishInfo.neckIndex)
            : 3;
        const rawPectoralIdx = Math.round(history.length * 0.3) + pectoralShift;
        const pectoralIdx = Math.max(
            3,
            Math.min(history.length - 4, Math.max(baseNeckIdx + 1, rawPectoralIdx)),
        );
        const breakIdx = Math.max(
            eyeAnchorIdx + 1,
            Math.min(pectoralIdx, Math.round((eyeAnchorIdx + pectoralIdx) * 0.6)),
        );
        const point = history[breakIdx];
        if (!isFinitePoint(point)) return;

        const radius = resolveBodyRadiusAtIndex(fishInfo, breakIdx, size);
        // Anchor the seam near the pectoral root area, but bow it headward to suggest the operculum.
        const startX = point.x + size * 0.08;
        const startY = point.y - radius * 0.94;
        const endX = point.x + size * 0.05;
        const endY = point.y + radius * 0.72;
        const stroke = createLinearGradientSafe(ctx, startX, startY, endX, endY);
        if (!stroke) return;

        stroke.addColorStop(0, 'rgba(0, 0, 0, 0.18)');
        stroke.addColorStop(0.5, 'rgba(0, 0, 0, 0.11)');
        stroke.addColorStop(0.82, 'rgba(0, 0, 0, 0.05)');
        stroke.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(0.9, size * 0.042);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(
            point.x - size * 0.32,
            point.y - radius * 0.48,
            point.x - size * 0.28,
            point.y + radius * 0.28,
            endX,
            endY,
        );
        ctx.stroke();
        ctx.restore();
    };

    const drawPeduncleSeamAccent = (ctx, fishInfo, size) => {
        const history = fishInfo?.history;
        if (!ctx || !Array.isArray(history) || history.length < 7) return;

        const peduncleIdx = Math.max(2, history.length - 3);
        const point = history[peduncleIdx];
        if (!isFinitePoint(point)) return;

        const radius = resolveBodyRadiusAtIndex(fishInfo, peduncleIdx, size) * 0.9;
        const startX = point.x;
        const startY = point.y - radius;
        const endX = point.x;
        const endY = point.y + radius;
        const stroke = createLinearGradientSafe(ctx, startX, startY, endX, endY);
        if (!stroke) return;

        stroke.addColorStop(0, 'rgba(0, 0, 0, 0.11)');
        stroke.addColorStop(0.5, 'rgba(0, 0, 0, 0.08)');
        stroke.addColorStop(1, 'rgba(0, 0, 0, 0.04)');

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(0.7, size * 0.026);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(
            point.x + size * 0.18,
            point.y,
            endX,
            endY,
        );
        ctx.stroke();
        ctx.restore();
    };

    const drawAnatomicalAccents = (ctx, fishInfo, bodyPathData, size) => {
        if (!ctx || !bodyPathData?.path || !fishInfo) return;
        ctx.save();
        ctx.clip(bodyPathData.path);
        drawHeadShoulderBreakAccent(ctx, fishInfo, size);
        drawPeduncleSeamAccent(ctx, fishInfo, size);
        ctx.restore();
    };

    const drawBodyBaseTexture = (fishInfo, size, bakeData = null) => {
        const bake = bakeData || buildBodyBakeData(fishInfo, size);
        if (!bake) return null;
        const { w, h, mockFish, bodyPathData } = bake;
        const safeSize = toClampedNumber(size, bake.size, 1, 1024);

        const { canvas, ctx } = createCanvas(w, h, KOI_BODY_BAKE_RESOLUTION);
        if (!ctx) throw new Error('ZEN_KOI_BODY_CONTEXT_REQUIRED');

        const eyeFB = 0.5;
        const eyeSP = 0.5;

        // Draw body base color + pattern once.
        const head = mockFish.history[0];
        const tailPos = mockFish.history[mockFish.history.length - 1];
        const g = isFinitePoint(head) && isFinitePoint(tailPos)
            ? createLinearGradientSafe(ctx, head.x, head.y, tailPos.x, tailPos.y)
            : null;
        if (g && typeof mockFish.mixColor === 'function') {
            const bodyMaterial = resolveCanonicalKoiBodyMaterialTones(mockFish.colorBody);
            g.addColorStop(0, bodyMaterial.headHighlight);
            g.addColorStop(0.3, bodyMaterial.body);
            g.addColorStop(1, bodyMaterial.tailShade);
            ctx.fillStyle = g;
        } else {
            ctx.fillStyle = mockFish.colorBody || '#ffffff';
        }
        ctx.fill(bodyPathData.path);

        ctx.save();
        ctx.clip(bodyPathData.path);
        mockFish.drawPattern(ctx, safeSize);
        ctx.restore();

        drawAnatomicalAccents(ctx, mockFish, bodyPathData, safeSize);

        // Keep dorsal fin and eyes in base so they stay crisp.
        mockFish.drawDorsalFin(ctx, safeSize);
        mockFish.drawEyeSimple(ctx, safeSize, eyeFB, eyeSP);

        return createTextureFromCanvas(canvas, KOI_BODY_BAKE_RESOLUTION);
    };

    const drawBodyFormTexture = (fishInfo, size, bakeData = null) => {
        const bake = bakeData || buildBodyBakeData(fishInfo, size);
        if (!bake) throw new Error('ZEN_KOI_FORM_BAKE_REQUIRED');
        const { w, h, mockFish } = bake;
        const pixels = new Uint8Array(w * h * 4);
        const headX = mockFish.history[0].x;
        const length = mockFish.history.at(-1).x - headX;
        const cell = Math.max(2.5, size * 0.19);
        for (let x = 0; x < w; x++) {
            const t = Math.max(0, Math.min(1, (x - headX) / length));
            const radius = Math.max(0.5, mockFish.getBodyRadius(t, size));
            for (let y = 0; y < h; y++) {
                const side = Math.max(-1, Math.min(1, (y + 0.5 - h / 2) / radius)) * 0.88;
                const row = Math.floor((y - h / 2) / cell);
                const col = Math.floor(x / cell + (row & 1) * 0.5);
                const grain = ((Math.imul(col + 19, 1597334677) ^ Math.imul(row + 37, 3812015801)) >>> 0) / 4294967296;
                // Skin remains smooth. Sparse ginrin scales change reflectance,
                // never the pigment pattern or random seed during animation.
                const micro = fishInfo.scaleType === 'doitsu' ? 0.1 : 0.17 + grain * 0.12;
                const gloss = fishInfo.isGinrin && grain > 0.9 && t > 0.24 ? 0.82 : micro;
                const i = (y * w + x) * 4;
                pixels[i] = Math.round((side * 0.5 + 0.5) * 255);
                pixels[i + 1] = Math.round(Math.sqrt(1 - side * side) * 255);
                pixels[i + 2] = Math.round(gloss * 255);
                pixels[i + 3] = 255;
            }
        }
        return createTextureFromRgba8({ kind: 'rgba8', data: pixels, width: w, height: h });
    };

    return {
        createCanvas,
        buildBodyBakeData,
        drawBodyBaseTexture,
        drawBodyFormTexture,
    };
};
