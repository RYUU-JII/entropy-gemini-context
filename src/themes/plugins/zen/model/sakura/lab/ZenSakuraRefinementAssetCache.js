import { SAKURA_CONFIG } from '../sakuraSpeciesRuntimeContract.js';
import { lerp } from '../sakuraMath.js';
import { SAKURA_TERMINAL_PAINT_METRICS } from '../sakuraRenderPaintMetrics.js';
import {
    createProjectedBlossomCacheKey,
    paintProjectedSakuraBlossom,
} from './ZenSakuraProjectedBlossom.js';

const CONFIG = {
    flowerColors: [...SAKURA_CONFIG.flowerColors],
    leafColors: [...SAKURA_CONFIG.leafColors],
};

export const REFINEMENT_CACHE_VERSION = 'zen_sakura_sprites_refinement_v3_fixed_atlas';
export const REFINEMENT_ATLAS_RESOLUTIONS = Object.freeze([96, 128]);

const createDefaultSpriteCanvas = (width, height) => {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    if (typeof OffscreenCanvas === 'function') {
        return new OffscreenCanvas(width, height);
    }
    throw new Error('ZEN_ASSET_CACHE_CANVAS_FACTORY_UNAVAILABLE');
};

export const createRefinementAssetCache = (options = {}) => {
    const LOGICAL_ASSET_SIZE = SAKURA_TERMINAL_PAINT_METRICS.logicalAssetSize;
    const requestedAssetSize = Number(options.assetSize ?? 96);
    if (!REFINEMENT_ATLAS_RESOLUTIONS.includes(requestedAssetSize)) {
        throw new Error(`ZEN_SAKURA_REFINEMENT_ATLAS_RESOLUTION_INVALID:${requestedAssetSize}`);
    }
    const ASSET_SIZE = requestedAssetSize;
    const assetScale = ASSET_SIZE / LOGICAL_ASSET_SIZE;
    const assetCache = {
        version: REFINEMENT_CACHE_VERSION,
        flowers: {},
        leaves: {},
        assetSize: ASSET_SIZE,
        logicalAssetSize: LOGICAL_ASSET_SIZE,
        options: {
            removeDotSpecks: options.removeDotSpecks ?? true,
            softEdgeHighlights: options.softEdgeHighlights ?? true,
            assetSize: ASSET_SIZE,
        },
        diagnostics: {
            atlasMisses: 0,
        },
    };

    const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));

    const parseHexColor = (value = '#FFFFFF') => {
        const hex = String(value || '#FFFFFF').replace('#', '');
        if (hex.length !== 6) return { r: 255, g: 255, b: 255 };
        return {
            r: Number.parseInt(hex.slice(0, 2), 16),
            g: Number.parseInt(hex.slice(2, 4), 16),
            b: Number.parseInt(hex.slice(4, 6), 16),
        };
    };

    const mixHexColors = (fromHex, toHex, mix = 0.5, alpha = 1) => {
        const from = parseHexColor(fromHex);
        const to = parseHexColor(toHex);
        const t = clamp01(mix);
        const r = Math.round(from.r + ((to.r - from.r) * t));
        const g = Math.round(from.g + ((to.g - from.g) * t));
        const b = Math.round(from.b + ((to.b - from.b) * t));
        return `rgba(${r},${g},${b},${alpha})`;
    };

    const createCanvas = typeof options?.createCanvas === 'function'
        ? options.createCanvas
        : createDefaultSpriteCanvas;

    const createOffscreen = (drawFn) => {
        const canvas = createCanvas(ASSET_SIZE, ASSET_SIZE);
        canvas.width = ASSET_SIZE;
        canvas.height = ASSET_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;
        ctx.translate(ASSET_SIZE / 2, ASSET_SIZE / 2);
        ctx.scale(assetScale, assetScale);
        drawFn(ctx);
        return canvas;
    };

    const normalizeBlossomDescriptor = (value = {}) => ({
        bloomStage: ['bud', 'half_open', 'full'].includes(value?.bloomStage) ? value.bloomStage : 'full',
        silhouetteProfile: ['sakura', 'rounded', 'narrow'].includes(value?.silhouetteProfile) ? value.silhouetteProfile : 'sakura',
        layers: 2,
        petalCount: 5,
        openness: clamp01(value?.openness ?? 0.72),
        petalLength: clamp01(value?.petalLength ?? 0.68),
        petalWidth: clamp01(value?.petalWidth ?? 0.54),
        coreSize: clamp01(value?.coreSize ?? 0.24),
        warmth: clamp01(value?.warmth ?? 0.5),
        stamenBurst: clamp01(value?.stamenBurst ?? 0.56),
    });

    const resolvePetalTemplate = (silhouetteProfile = 'sakura', bloomStage = 'full', templateId = 0) => {
        const templates = [
            { upperA: [0.16, -0.34], upperB: [0.58, -0.35], tip: [0.72, -0.08], notchA: [0.76, -0.02], notchB: [0.76, 0.04], notch: [0.71, 0.1], lowerA: [0.58, 0.35], lowerB: [0.22, 0.34], baseReturn: [0.02, 0.06], baseTuck: [-0.02, 0.03], rim: [0.12, -0.18, 0.32, -0.3, 0.58, -0.24, 0.68, -0.07] },
            { upperA: [0.14, -0.36], upperB: [0.56, -0.39], tip: [0.74, -0.09], notchA: [0.78, -0.02], notchB: [0.77, 0.05], notch: [0.7, 0.11], lowerA: [0.55, 0.36], lowerB: [0.2, 0.32], baseReturn: [0.02, 0.05], baseTuck: [-0.018, 0.028], rim: [0.12, -0.19, 0.32, -0.31, 0.58, -0.25, 0.69, -0.08] },
        ];
        return templates[templateId % templates.length];
    };

    const traceSakuraPetalContour = (ctx, size, templateId = 0) => {
        const template = resolvePetalTemplate('sakura', 'full', templateId);
        const [upperAX, upperAY] = template.upperA;
        const [upperBX, upperBY] = template.upperB;
        const [tipX, tipY] = template.tip;
        const [notchAX, notchAY] = template.notchA;
        const [notchBX, notchBY] = template.notchB;
        const [notchX, notchY] = template.notch;
        const [lowerAX, lowerAY] = template.lowerA;
        const [lowerBX, lowerBY] = template.lowerB;
        const [baseReturnX, baseReturnY] = template.baseReturn;
        const [baseTuckX, baseTuckY] = template.baseTuck;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(size * upperAX, size * upperAY, size * upperBX, size * upperBY, size * tipX, size * tipY);
        ctx.bezierCurveTo(size * notchAX, size * notchAY, size * notchBX, size * notchBY, size * notchX, size * notchY);
        ctx.bezierCurveTo(size * lowerAX, size * lowerAY, size * lowerBX, size * lowerBY, size * baseReturnX, size * baseReturnY);
        ctx.bezierCurveTo(size * baseTuckX, size * baseTuckY, size * baseTuckX, size * 0.01, 0, 0);
        ctx.closePath();
    };

    const createRefinementFlowerSprite = (color, blossomInput = {}) => createOffscreen((ctx) => {
        const blossom = normalizeBlossomDescriptor(blossomInput);

        const rgba = (red, green, blue, alpha = 1) => (
            `rgba(${Math.round(red)},${Math.round(green)},${Math.round(blue)},${clamp01(alpha)})`
        );

        const petalBlush = clamp01(0.34 + (blossom.warmth * 0.2));
        const paletteInfluence = 0.08 + (blossom.warmth * 0.035);

        const petalLuminousColor = mixHexColors('#FFFCFD', color, paletteInfluence * 0.42, 0.98);
        const petalMidColor = mixHexColors('#FFE3EB', color, paletteInfluence, 0.97);
        const petalInnerTintColor = rgba(255, 222 + (petalBlush * 16), 234 + (petalBlush * 12), 0.97);
        const petalEdgeColor = mixHexColors('#D77A9E', color, paletteInfluence * 0.8, 0.78);
        const petalDeepEdgeColor = mixHexColors('#BC5A85', color, paletteInfluence * 0.48, 0.44);

        const petalHighlightColor = rgba(255, 255, 255, assetCache.options.removeDotSpecks ? 0.18 : 0.36);
        const translucencyGlowColor = mixHexColors('#FFF9FB', '#FFD8E4', 0.2, 0.22);
        const stamenStrokeColor = mixHexColors('#944A48', '#E3A969', 0.44, 0.78);
        const antherColor = mixHexColors('#9D4B4E', '#D99B61', 0.34, 0.88);

        // Petal Layers
        const renderLayerCount = 2;
        for (let layer = renderLayerCount - 1; layer >= 0; layer -= 1) {
            const isMainLayer = layer === 0;
            const petalsThisLayer = 5;
            const step = (Math.PI * 2) / petalsThisLayer;
            const layerDepthScale = isMainLayer ? 1 : 0.78;
            const petalSize = (4.9 + (blossom.petalLength * 5.2)) * layerDepthScale;
            const petalWidthScale = 0.82 + (blossom.petalWidth * 0.34);
            const petalLengthScale = 0.9 + (blossom.petalLength * 0.22);
            const petalSocket = petalSize * 0.1;
            const layerOffset = isMainLayer ? -Math.PI / 2 : 0.36;

            for (let i = 0; i < petalsThisLayer; i += 1) {
                const petalTemplateId = (i + layer) % 2;

                ctx.save();
                ctx.rotate((i * step) + layerOffset);
                ctx.translate(petalSocket, 0);
                ctx.scale(petalLengthScale, petalWidthScale);

                // Petal base gradient
                const petalGradient = ctx.createRadialGradient(
                    petalSize * 0.08, 0, petalSize * 0.04,
                    petalSize * 0.38, 0, petalSize * 0.68,
                );
                petalGradient.addColorStop(0, petalLuminousColor);
                petalGradient.addColorStop(0.42, petalInnerTintColor);
                petalGradient.addColorStop(0.66, petalMidColor);
                petalGradient.addColorStop(0.84, petalEdgeColor);
                petalGradient.addColorStop(1, petalDeepEdgeColor);
                ctx.fillStyle = petalGradient;

                traceSakuraPetalContour(ctx, petalSize, petalTemplateId);
                ctx.fill();

                // Subsurface tip illumination glow
                ctx.save();
                traceSakuraPetalContour(ctx, petalSize, petalTemplateId);
                ctx.clip();
                const softTipLight = ctx.createLinearGradient(petalSize * 0.06, 0, petalSize * 0.76, 0);
                softTipLight.addColorStop(0, 'rgba(255,255,255,0)');
                softTipLight.addColorStop(0.42, translucencyGlowColor);
                softTipLight.addColorStop(1, petalHighlightColor);
                ctx.fillStyle = softTipLight;
                ctx.fillRect(-petalSize * 0.04, -petalSize * 0.46, petalSize * 0.86, petalSize * 0.92);
                ctx.restore();

                // Hard edge rim stroke: drawn ONLY when removeDotSpecks is false
                if (!assetCache.options.removeDotSpecks) {
                    const template = resolvePetalTemplate('sakura', 'full', petalTemplateId);
                    const [rimStartX, rimStartY, rimC1X, rimC1Y, rimC2X, rimC2Y, rimEndX, rimEndY] = template.rim;
                    ctx.strokeStyle = petalHighlightColor;
                    ctx.lineWidth = Math.max(0.13, petalSize * 0.02);
                    ctx.beginPath();
                    ctx.moveTo(petalSize * rimStartX, petalSize * rimStartY);
                    ctx.bezierCurveTo(petalSize * rimC1X, petalSize * rimC1Y, petalSize * rimC2X, petalSize * rimC2Y, petalSize * rimEndX, petalSize * rimEndY);
                    ctx.stroke();
                }

                ctx.restore();
            }
        }

        // Flower Core
        const coreRadius = 0.9 + (blossom.coreSize * 0.82);
        const coreFill = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 1.42);
        coreFill.addColorStop(0, 'rgba(255,239,142,0.85)');
        coreFill.addColorStop(0.42, 'rgba(238,160,98,0.72)');
        coreFill.addColorStop(0.78, 'rgba(202,86,113,0.32)');
        coreFill.addColorStop(1, 'rgba(202,86,113,0)');
        ctx.fillStyle = coreFill;
        ctx.beginPath();
        ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
        ctx.fill();

        // Stamen Filaments & Anthers
        const stamenCount = 10 + Math.round(blossom.stamenBurst * 4);
        ctx.strokeStyle = stamenStrokeColor;
        ctx.lineWidth = 0.26;
        ctx.lineCap = 'round';

        for (let i = 0; i < stamenCount; i += 1) {
            const angle = (i * Math.PI * 2 / stamenCount) + 0.2;
            const startRadius = coreRadius * 0.34;
            const endRadius = coreRadius * (1.42 + ((i % 3) * 0.1));
            const startX = Math.cos(angle) * startRadius;
            const startY = Math.sin(angle) * startRadius;
            const x = Math.cos(angle) * endRadius;
            const y = Math.sin(angle) * endRadius;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();

            // Anther head: If removeDotSpecks is active, render smooth natural pollen gradient pill instead of hard arc dot
            if (assetCache.options.removeDotSpecks) {
                ctx.fillStyle = antherColor;
                ctx.beginPath();
                ctx.ellipse(x, y, 0.26, 0.16, angle + (Math.PI / 2), 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = antherColor;
                ctx.beginPath();
                ctx.arc(x, y, 0.22, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Core dots: Only drawn when removeDotSpecks is FALSE
        if (!assetCache.options.removeDotSpecks) {
            ctx.fillStyle = 'rgba(118,61,60,0.34)';
            for (let i = 0; i < 7; i += 1) {
                const angle = (i / 7) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * coreRadius * 0.4, Math.sin(angle) * coreRadius * 0.4, 0.14, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });

    const createProjectedFlowerSprite = (color, blossomInput = {}) => createOffscreen((ctx) => {
        paintProjectedSakuraBlossom(ctx, {
            color,
            blossom: blossomInput,
            removeDotSpecks: assetCache.options.removeDotSpecks,
        });
    });

    const createRefinementLeafSprite = (color = '#6B7D52') => createOffscreen((ctx) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 4, -0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(232,239,225,0.42)';
        ctx.lineWidth = 0.42;
        ctx.beginPath();
        ctx.moveTo(-6, 2);
        ctx.lineTo(6, -2);
        ctx.stroke();
    });

    assetCache.resolveFlowerSprite = (input = '#FFCDD2') => {
        const color = typeof input === 'object' ? input.color || '#FFCDD2' : input;
        const blossom = typeof input === 'object' ? input.blossom || {} : {};
        const usesProjectedRenderer = blossom.projectionMode === 'projected';
        const descriptorKey = usesProjectedRenderer
            ? createProjectedBlossomCacheKey(blossom)
            : 'legacy-front';
        const key = `refinement_${color}_${ASSET_SIZE}_${assetCache.options.removeDotSpecks}_${descriptorKey}`;
        if (!assetCache.flowers[key]) {
            assetCache.flowers[key] = usesProjectedRenderer
                ? createProjectedFlowerSprite(color, blossom)
                : createRefinementFlowerSprite(color, blossom);
            assetCache.diagnostics.atlasMisses += 1;
        }
        return assetCache.flowers[key];
    };

    assetCache.resolveLeafSprite = (input = '#6B7D52') => {
        const key = `refinement_leaf_${String(input)}_${ASSET_SIZE}`;
        if (!assetCache.leaves[key]) {
            assetCache.leaves[key] = createRefinementLeafSprite(input);
        }
        return assetCache.leaves[key];
    };

    assetCache.readDiagnostics = () => Object.freeze({
        ...assetCache.diagnostics,
        atlasEntries: Object.keys(assetCache.flowers).length,
        leafEntries: Object.keys(assetCache.leaves).length,
        atlasPixels: Object.keys(assetCache.flowers).length * ASSET_SIZE * ASSET_SIZE,
        atlasRawBytes: Object.keys(assetCache.flowers).length * ASSET_SIZE * ASSET_SIZE * 4,
    });

    return assetCache;
};
