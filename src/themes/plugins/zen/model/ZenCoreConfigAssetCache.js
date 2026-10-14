import { resolveSakuraPetalPigment, createSakuraPetalGradient } from './sakura/sakuraPetalMaterial.js';
import { SakuraRenderSpecies } from './SakuraRenderSpecies.js';
import { SAKURA_CONFIG } from './sakura/sakuraSpeciesRuntimeContract.js';
import { lerp } from './sakura/sakuraMath.js';
import { SAKURA_TERMINAL_PAINT_METRICS } from './sakura/sakuraRenderPaintMetrics.js';

const CONFIG = {
    flowerColors: [...SAKURA_CONFIG.flowerColors],
    leafColors: [...SAKURA_CONFIG.leafColors],
};

export const ZEN_ASSET_CACHE_VERSION = 'zen_sakura_sprites_v1';

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

export const createAssetCache = (options = {}) => {
    const LOGICAL_ASSET_SIZE = SAKURA_TERMINAL_PAINT_METRICS.logicalAssetSize;
    const ASSET_SIZE = 128;
    const assetScale = ASSET_SIZE / LOGICAL_ASSET_SIZE;
    const assetCache = {
        version: ZEN_ASSET_CACHE_VERSION,
        flowers: {},
        leaves: {},
        assetSize: ASSET_SIZE,
        logicalAssetSize: LOGICAL_ASSET_SIZE,
    };
    const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));
    const quantizeUnit = (value, step = 0.1) => {
        const safeStep = Math.max(0.001, Number(step) || 0.1);
        return clamp01(Math.round(clamp01(value) / safeStep) * safeStep);
    };
    const quantizeSignedUnit = (value, step = 0.25) => {
        const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
        const safeStep = Math.max(0.001, Number(step) || 0.25);
        return Math.max(-1, Math.min(1, Math.round(numeric / safeStep) * safeStep));
    };
    const clampInt = (value, min, max, fallback) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return fallback;
        }
        return Math.max(min, Math.min(max, Math.round(numeric)));
    };
    const parseHexColor = (value = '#FFFFFF') => {
        const hex = String(value || '#FFFFFF').replace('#', '');
        if (hex.length !== 6) {
            return { r: 255, g: 255, b: 255 };
        }
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
        if (!ctx) {
            return canvas;
        }
        ctx.translate(ASSET_SIZE / 2, ASSET_SIZE / 2);
        ctx.scale(assetScale, assetScale);
        drawFn(ctx);
        return canvas;
    };

    const normalizePetalCount = (value) => {
        const count = clampInt(value, 5, 13, 5);
        return count % 2 === 0 ? Math.max(5, count - 1) : count;
    };

    const normalizeBlossomDescriptor = (value = {}) => ({
        bloomStage: ['bud', 'half_open', 'full'].includes(value?.bloomStage) ? value.bloomStage : 'full',
        form: ['open', 'cupped', 'layered'].includes(value?.form) ? value.form : 'open',
        silhouetteProfile: ['sakura', 'rounded', 'narrow'].includes(value?.silhouetteProfile)
            ? value.silhouetteProfile
            : 'sakura',
        layers: clampInt(value?.layers, 1, 4, 1),
        petalCount: normalizePetalCount(value?.petalCount),
        openness: clamp01(value?.openness ?? 0.72),
        petalLength: clamp01(value?.petalLength ?? 0.68),
        petalWidth: clamp01(value?.petalWidth ?? 0.54),
        ruffle: clamp01(value?.ruffle ?? 0.12),
        coreSize: clamp01(value?.coreSize ?? 0.24),
        innerScale: clamp01(value?.innerScale ?? 0.48),
        warmth: clamp01(value?.warmth ?? 0.5),
        petalFall: clamp01(value?.petalFall ?? 0),
        lightExposure: clamp01(value?.lightExposure ?? 0.56),
        notchDepth: clamp01(value?.notchDepth ?? 0.62),
        translucency: clamp01(value?.translucency ?? 0.58),
        stamenBurst: clamp01(value?.stamenBurst ?? 0.56),
        centerDepth: clamp01(value?.centerDepth ?? 0.5),
        facingYaw: Math.max(-1, Math.min(1, Number(value?.facingYaw ?? 0))),
        facingPitch: Math.max(-1, Math.min(1, Number(value?.facingPitch ?? 0))),
    });

    const quantizeBlossomSpriteDescriptor = (blossom = {}) => ({
        ...blossom,
        openness: quantizeUnit(blossom.openness, 0.08),
        petalLength: quantizeUnit(blossom.petalLength, 0.08),
        petalWidth: quantizeUnit(blossom.petalWidth, 0.08),
        ruffle: quantizeUnit(blossom.ruffle, 0.08),
        coreSize: quantizeUnit(blossom.coreSize, 0.08),
        innerScale: quantizeUnit(blossom.innerScale, 0.08),
        warmth: quantizeUnit(blossom.warmth, 0.12),
        petalFall: quantizeUnit(blossom.petalFall, 0.12),
        lightExposure: quantizeUnit(blossom.lightExposure, 0.12),
        notchDepth: quantizeUnit(blossom.notchDepth, 0.1),
        translucency: quantizeUnit(blossom.translucency, 0.12),
        stamenBurst: quantizeUnit(blossom.stamenBurst, 0.12),
        centerDepth: quantizeUnit(blossom.centerDepth, 0.12),
        facingYaw: quantizeSignedUnit(blossom.facingYaw, 0.25),
        facingPitch: quantizeSignedUnit(blossom.facingPitch, 0.25),
    });

    const resolveFlowerSpriteSpec = (input = '#FFCDD2') => {
        if (input && typeof input === 'object' && !Array.isArray(input)) {
            const color = String(input?.color || '#FFCDD2');
            const blossom = quantizeBlossomSpriteDescriptor(
                normalizeBlossomDescriptor(input?.blossom || {}),
            );
            const key = [
                ZEN_ASSET_CACHE_VERSION,
                color,
                blossom.bloomStage,
                blossom.form,
                blossom.silhouetteProfile,
                blossom.layers,
                blossom.petalCount,
                blossom.openness.toFixed(2),
                blossom.petalLength.toFixed(2),
                blossom.petalWidth.toFixed(2),
                blossom.ruffle.toFixed(2),
                blossom.coreSize.toFixed(2),
                blossom.innerScale.toFixed(2),
                blossom.warmth.toFixed(2),
                blossom.petalFall.toFixed(2),
                blossom.lightExposure.toFixed(2),
                blossom.notchDepth.toFixed(2),
                blossom.translucency.toFixed(2),
                blossom.stamenBurst.toFixed(2),
                blossom.centerDepth.toFixed(2),
                blossom.facingYaw.toFixed(2),
                blossom.facingPitch.toFixed(2),
            ].join('|');
            return { key, color, blossom };
        }
        return {
            key: `${ZEN_ASSET_CACHE_VERSION}|${String(input || '#FFCDD2')}`,
            color: String(input || '#FFCDD2'),
            blossom: normalizeBlossomDescriptor({}),
        };
    };

    const resolveBloomStageRenderProfile = (stage) => {
        if (stage === 'bud') {
            return {
                bloomScale: 0.72,
                opennessScale: 0.5,
                widthScale: 0.92,
                stamenAlpha: 0.1,
                stamenScale: 0.56,
                coreAlpha: 0.58,
                haloAlpha: 0.012,
                haloRadius: 0.34,
                shadowScale: 0.4,
                ruffleScale: 0.28,
                sepalAlpha: 0.54,
                liftBias: 0.26,
                rimAlpha: 0.1,
                subsurfaceAlpha: 0.12,
                notchGain: 0.92,
            };
        }
        if (stage === 'half_open') {
            return {
                bloomScale: 0.9,
                opennessScale: 0.74,
                widthScale: 1,
                stamenAlpha: 0.34,
                stamenScale: 0.78,
                coreAlpha: 0.64,
                haloAlpha: 0.018,
                haloRadius: 0.42,
                shadowScale: 0.46,
                ruffleScale: 0.34,
                sepalAlpha: 0.18,
                liftBias: 0.1,
                rimAlpha: 0.16,
                subsurfaceAlpha: 0.18,
                notchGain: 1.08,
            };
        }
        return {
            bloomScale: 0.98,
            opennessScale: 0.96,
            widthScale: 1.04,
            stamenAlpha: 0.58,
            stamenScale: 0.92,
            coreAlpha: 0.72,
            haloAlpha: 0.022,
            haloRadius: 0.46,
            shadowScale: 0.52,
            ruffleScale: 0.38,
            sepalAlpha: 0,
            liftBias: 0,
            rimAlpha: 0.22,
            subsurfaceAlpha: 0.22,
            notchGain: 1.18,
        };
    };

    const PETAL_TEMPLATE_LIBRARY = Object.freeze({
        sakura: Object.freeze([
            { upperA: [0.16, -0.34], upperB: [0.58, -0.35], tip: [0.72, -0.08], notchA: [0.76, -0.02], notchB: [0.76, 0.04], notch: [0.71, 0.1], lowerA: [0.58, 0.35], lowerB: [0.22, 0.34], baseReturn: [0.02, 0.06], baseTuck: [-0.02, 0.03], rim: [0.12, -0.18, 0.32, -0.3, 0.58, -0.24, 0.68, -0.07], veinTop: -0.02, veinBottom: 0.08 },
            { upperA: [0.14, -0.36], upperB: [0.56, -0.39], tip: [0.74, -0.09], notchA: [0.78, -0.02], notchB: [0.77, 0.05], notch: [0.7, 0.11], lowerA: [0.55, 0.36], lowerB: [0.2, 0.32], baseReturn: [0.02, 0.05], baseTuck: [-0.018, 0.028], rim: [0.12, -0.19, 0.32, -0.31, 0.58, -0.25, 0.69, -0.08], veinTop: -0.025, veinBottom: 0.075 },
            { upperA: [0.18, -0.31], upperB: [0.61, -0.32], tip: [0.7, -0.07], notchA: [0.75, -0.015], notchB: [0.75, 0.035], notch: [0.72, 0.09], lowerA: [0.6, 0.32], lowerB: [0.24, 0.35], baseReturn: [0.025, 0.065], baseTuck: [-0.02, 0.032], rim: [0.13, -0.16, 0.33, -0.27, 0.57, -0.22, 0.67, -0.06], veinTop: -0.015, veinBottom: 0.09 },
        ]),
        rounded: Object.freeze([
            { upperA: [0.17, -0.3], upperB: [0.62, -0.31], tip: [0.75, -0.065], notchA: [0.79, -0.01], notchB: [0.79, 0.045], notch: [0.74, 0.095], lowerA: [0.64, 0.31], lowerB: [0.26, 0.33], baseReturn: [0.03, 0.06], baseTuck: [-0.018, 0.03], rim: [0.13, -0.15, 0.35, -0.25, 0.61, -0.2, 0.71, -0.055], veinTop: -0.015, veinBottom: 0.085 },
            { upperA: [0.16, -0.32], upperB: [0.6, -0.33], tip: [0.73, -0.07], notchA: [0.77, -0.015], notchB: [0.78, 0.04], notch: [0.73, 0.09], lowerA: [0.62, 0.33], lowerB: [0.24, 0.34], baseReturn: [0.025, 0.058], baseTuck: [-0.018, 0.03], rim: [0.12, -0.16, 0.34, -0.26, 0.6, -0.21, 0.7, -0.06], veinTop: -0.018, veinBottom: 0.082 },
        ]),
        narrow: Object.freeze([
            { upperA: [0.14, -0.39], upperB: [0.54, -0.43], tip: [0.72, -0.11], notchA: [0.76, -0.03], notchB: [0.74, 0.055], notch: [0.67, 0.12], lowerA: [0.52, 0.39], lowerB: [0.18, 0.34], baseReturn: [0.018, 0.055], baseTuck: [-0.016, 0.026], rim: [0.1, -0.22, 0.29, -0.34, 0.56, -0.28, 0.68, -0.09], veinTop: -0.03, veinBottom: 0.07 },
            { upperA: [0.12, -0.4], upperB: [0.5, -0.45], tip: [0.7, -0.12], notchA: [0.75, -0.035], notchB: [0.73, 0.06], notch: [0.65, 0.125], lowerA: [0.5, 0.4], lowerB: [0.17, 0.33], baseReturn: [0.018, 0.052], baseTuck: [-0.016, 0.024], rim: [0.1, -0.23, 0.28, -0.35, 0.54, -0.29, 0.66, -0.1], veinTop: -0.035, veinBottom: 0.068 },
        ]),
        bud: Object.freeze([
            { upperA: [0.1, -0.28], upperB: [0.42, -0.42], tip: [0.56, -0.11], notchA: [0.58, -0.05], notchB: [0.57, 0.02], notch: [0.52, 0.065], lowerA: [0.42, 0.3], lowerB: [0.14, 0.24], baseReturn: [0.012, 0.04], baseTuck: [-0.012, 0.018], rim: [0.08, -0.16, 0.22, -0.25, 0.43, -0.22, 0.52, -0.08], veinTop: -0.025, veinBottom: 0.05 },
        ]),
    });

    const resolvePetalTemplate = (silhouetteProfile = 'sakura', bloomStage = 'full', templateId = 0) => {
        const key = bloomStage === 'bud'
            ? 'bud'
            : (PETAL_TEMPLATE_LIBRARY[silhouetteProfile] ? silhouetteProfile : 'sakura');
        const templates = PETAL_TEMPLATE_LIBRARY[key];
        return templates[templateId % templates.length] || templates[0] || PETAL_TEMPLATE_LIBRARY.sakura[0];
    };

    const traceSakuraPetalContour = (ctx, size, templateId = 0, notchDepth = 0.62, silhouetteProfile = 'sakura', bloomStage = 'full') => {
        const safeNotchDepth = clamp01(notchDepth);
        const template = resolvePetalTemplate(silhouetteProfile, bloomStage, templateId);
        const stageTuck = bloomStage === 'bud' ? 0.62 : (bloomStage === 'half_open' ? 0.86 : 1);
        const notchPull = safeNotchDepth * (bloomStage === 'bud' ? 0.018 : 0.042);
        const notchDrop = safeNotchDepth * (bloomStage === 'bud' ? 0.018 : 0.056);
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
        ctx.bezierCurveTo(
            size * upperAX * stageTuck,
            size * upperAY,
            size * upperBX * stageTuck,
            size * upperBY,
            size * (tipX + (safeNotchDepth * 0.018)) * stageTuck,
            size * (tipY - (safeNotchDepth * 0.018)),
        );
        ctx.bezierCurveTo(
            size * (notchAX + notchPull) * stageTuck,
            size * notchAY,
            size * (notchBX + (notchPull * 0.72)) * stageTuck,
            size * (notchBY + (notchDrop * 0.34)),
            size * (notchX - notchPull) * stageTuck,
            size * (notchY + notchDrop),
        );
        ctx.bezierCurveTo(
            size * lowerAX * stageTuck,
            size * (lowerAY + (safeNotchDepth * 0.012)),
            size * lowerBX * stageTuck,
            size * lowerBY,
            size * baseReturnX,
            size * baseReturnY,
        );
        ctx.bezierCurveTo(
            size * baseTuckX,
            size * baseTuckY,
            size * baseTuckX,
            size * 0.01,
            0,
            0,
        );
        ctx.closePath();
    };

    const createFlowerSprite = (color, blossomInput = {}) => createOffscreen((ctx) => {
        const blossom = normalizeBlossomDescriptor(blossomInput);
        const stageProfile = resolveBloomStageRenderProfile(blossom.bloomStage);
        const fallAmount = clamp01(blossom.petalFall);
        const lightExposure = clamp01(blossom.lightExposure);
        const facingYaw = Math.max(-1, Math.min(1, blossom.facingYaw || 0));
        const facingPitch = Math.max(-1, Math.min(1, blossom.facingPitch || 0));
        const perspectiveWidthScale = 1 - (Math.abs(facingYaw) * 0.2);
        const perspectiveHeightScale = 1 - (Math.max(0, facingPitch) * 0.08) + (Math.max(0, -facingPitch) * 0.04);
        const perspectiveShear = facingYaw * 0.14;
        const perspectiveShiftX = facingYaw * 1.6;
        const perspectiveShiftY = (facingPitch * -1.4) + (Math.abs(facingYaw) * 0.24);
        const coreShiftX = facingYaw * 1.1;
        const coreShiftY = facingPitch * -0.4;
        const bloomCount = Math.max(5, blossom.petalCount);
        const rgba = (red, green, blue, alpha = 1) => (
            `rgba(${Math.round(red)},${Math.round(green)},${Math.round(blue)},${clamp01(alpha)})`
        );
        const petalPigment = resolveSakuraPetalPigment({
            color, warmth: blossom.warmth, centerDepth: blossom.centerDepth,
            lightExposure, fallAmount, translucency: blossom.translucency,
        });
        const {
            petalDeepEdgeColor, petalBoundaryColor, petalBaseShadeColor,
            petalVeinColor, petalHighlightColor,
        } = petalPigment;
        const petalRimColor = mixHexColors(
            '#FFFFFF',
            '#FFEAF1',
            0.46,
            (stageProfile.rimAlpha * 0.88) + (blossom.translucency * 0.035),
        );
        const translucencyGlowColor = mixHexColors(
            '#FFF9FB',
            '#FFD8E4',
            0.2 + (blossom.translucency * 0.18),
            stageProfile.subsurfaceAlpha * (0.08 + (blossom.translucency * 0.05) + (lightExposure * 0.02)),
        );
        const stamenStrokeColor = mixHexColors(
            '#944A48',
            '#E3A969',
            0.44,
            Math.min(1, (stageProfile.stamenAlpha * 0.72) + (blossom.stamenBurst * 0.1) + (lightExposure * 0.04)),
        );
        const antherColor = mixHexColors(
            '#9D4B4E',
            '#D99B61',
            0.34,
            Math.min(1, (stageProfile.stamenAlpha * 0.78) + (blossom.stamenBurst * 0.08) + (lightExposure * 0.04)),
        );
        const haloRadius = (8.8 + (blossom.layers * 0.36)) * stageProfile.haloRadius;
        const halo = ctx.createRadialGradient(0, -1.2, 1.2, 0, -0.8, haloRadius);
        halo.addColorStop(0, `rgba(255,255,255,${((stageProfile.haloAlpha * 0.14) * (1 - (fallAmount * 0.34))).toFixed(2)})`);
        halo.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.ellipse(
            perspectiveShiftX * 0.22,
            -0.8 + (perspectiveShiftY * 0.12),
            haloRadius * lerp(1, perspectiveWidthScale, 0.58),
            haloRadius * lerp(1, perspectiveHeightScale, 0.3),
            0,
            0,
            Math.PI * 2,
        );
        ctx.fill();

        const blossomShadow = ctx.createRadialGradient(
            0,
            2.8,
            0.6,
            0,
            3.1,
            (5.4 + blossom.layers * 0.34) * stageProfile.shadowScale,
        );
        blossomShadow.addColorStop(0, `rgba(92,58,70,${(0.025 * stageProfile.shadowScale * (1 - fallAmount * 0.24)).toFixed(2)})`);
        blossomShadow.addColorStop(0.72, 'rgba(92,58,70,0.015)');
        blossomShadow.addColorStop(1, 'rgba(92,58,70,0)');
        ctx.fillStyle = blossomShadow;
        ctx.beginPath();
        ctx.ellipse(
            perspectiveShiftX * 0.12,
            3.2 + (Math.max(0, facingPitch) * 0.24),
            (4.8 + blossom.layers * 0.28) * stageProfile.shadowScale * lerp(1, perspectiveWidthScale, 0.68),
            1.22 * stageProfile.shadowScale * lerp(1, perspectiveHeightScale, 0.22),
            0,
            0,
            Math.PI * 2,
        );
        ctx.fill();

        ctx.save();
        ctx.transform(1, 0, perspectiveShear, 1, perspectiveShiftX, perspectiveShiftY);
        ctx.scale(perspectiveWidthScale, perspectiveHeightScale);
        if (stageProfile.sepalAlpha > 0) {
            ctx.fillStyle = `rgba(116,146,81,${stageProfile.sepalAlpha})`;
            ctx.beginPath();
            ctx.moveTo(-4.4, 3.8);
            ctx.quadraticCurveTo(-1.4, 1.2, 0, 3.4);
            ctx.quadraticCurveTo(1.8, 1.1, 4.5, 3.6);
            ctx.quadraticCurveTo(1.8, 6.1, 0, 5.2);
            ctx.quadraticCurveTo(-1.8, 6.2, -4.4, 3.8);
            ctx.fill();
        }

        const renderLayerCount = blossom.bloomStage === 'bud'
            ? 1
            : Math.max(2, Math.min(4, blossom.layers + 1));
        for (let layer = renderLayerCount - 1; layer >= 0; layer -= 1) {
            const isMainLayer = layer === 0;
            const petalsThisLayer = 5;
            const step = (Math.PI * 2) / petalsThisLayer;
            const bloomDensity = clamp01((bloomCount - 5) / 8);
            const silhouetteWidthBias = blossom.silhouetteProfile === 'rounded'
                ? 1.08
                : (blossom.silhouetteProfile === 'narrow' ? 0.9 : 1);
            const silhouetteLengthBias = blossom.silhouetteProfile === 'rounded'
                ? 0.92
                : (blossom.silhouetteProfile === 'narrow' ? 1.08 : 1);
            const layerDepthScale = isMainLayer
                ? 1
                : Math.max(0.52, 0.72 - ((layer - 1) * 0.1));
            const petalSize = (4.9 + (blossom.petalLength * 5.2))
                * stageProfile.bloomScale
                * silhouetteLengthBias
                * layerDepthScale;
            const petalWidthScale = (0.82 + (blossom.petalWidth * 0.34))
                * stageProfile.widthScale
                * silhouetteWidthBias
                * (blossom.form === 'cupped' ? 0.9 : 1)
                * (isMainLayer ? 1 : 0.96);
            const petalLengthScale = (0.9 + (blossom.petalLength * 0.22))
                * (blossom.form === 'cupped' ? 0.88 : 1.02)
                * (0.98 + (blossom.openness * 0.06))
                * stageProfile.opennessScale
                * (isMainLayer ? 1 : 0.96);
            const countSpread = lerp(1.06, 0.96, bloomDensity);
            const petalSocket = petalSize * (
                isMainLayer
                    ? ((blossom.bloomStage === 'bud' ? 0.02 : 0.1)
                        + (blossom.openness * 0.055)
                        + (blossom.form === 'open' ? 0.01 : 0))
                        * countSpread
                    : (0.08 + (blossom.innerScale * 0.035))
            );
            const layerOffset = isMainLayer
                ? -Math.PI / 2
                : 0.36 + (layer * 0.16);

            for (let i = 0; i < petalsThisLayer; i += 1) {
                const petalTemplateId = (i + layer) % 3;
                const petalTemplate = resolvePetalTemplate(
                    blossom.silhouetteProfile,
                    blossom.bloomStage,
                    petalTemplateId,
                );
                const resolvedNotchDepth = clamp01(blossom.notchDepth * stageProfile.notchGain);
                const ruffleAmount = blossom.ruffle * stageProfile.ruffleScale;
                const petalRotationJitter = Math.sin(((i + 1) * 1.37) + (blossom.warmth * 2.2) + (layer * 0.5))
                    * (0.024 + (ruffleAmount * 0.072))
                    * (blossom.bloomStage === 'bud' ? 0.25 : 1);
                const petalWidthVariance = 1 + (Math.cos(((i + 1) * 1.57) + (blossom.warmth * 1.6)) * (0.032 + (ruffleAmount * 0.04)));
                const petalLengthVariance = 1 + (Math.sin(((i + 1) * 1.91) + (blossom.openness * 1.8)) * (0.028 + (ruffleAmount * 0.036)));
                const petalSocketJitter = Math.sin(((i + 1) * 2.41) + (layer * 0.7)) * petalSize * ruffleAmount * 0.032;
                const petalLateralJitter = Math.cos(((i + 1) * 2.17) + blossom.warmth) * petalSize * ruffleAmount * 0.024;
                ctx.save();
                ctx.rotate((i * step) + layerOffset + petalRotationJitter);
                ctx.translate(petalSocket + petalSocketJitter, petalLateralJitter);
                ctx.scale(
                    petalLengthScale * petalLengthVariance,
                    petalWidthScale * petalWidthVariance,
                );
                ctx.globalAlpha = (isMainLayer
                    ? 1
                    : 0.4 + (blossom.innerScale * 0.14) - (layer * 0.014))
                    * (1 - (fallAmount * 0.11));

                const petalGradient = createSakuraPetalGradient(
                    ctx, petalPigment,
                    petalSize * 0.08,
                    0,
                    petalSize * 0.04,
                    petalSize * 0.38,
                    0,
                    petalSize * 0.68,
                );
                ctx.fillStyle = petalGradient;
                traceSakuraPetalContour(
                    ctx,
                    petalSize,
                    petalTemplateId,
                    resolvedNotchDepth,
                    blossom.silhouetteProfile,
                    blossom.bloomStage,
                );
                ctx.fill();

                ctx.save();
                traceSakuraPetalContour(
                    ctx,
                    petalSize,
                    petalTemplateId,
                    resolvedNotchDepth,
                    blossom.silhouetteProfile,
                    blossom.bloomStage,
                );
                ctx.clip();
                const softTipLight = ctx.createLinearGradient(
                    petalSize * 0.06,
                    0,
                    petalSize * 0.76,
                    0,
                );
                softTipLight.addColorStop(0, 'rgba(255,255,255,0)');
                softTipLight.addColorStop(0.42, translucencyGlowColor);
                softTipLight.addColorStop(1, petalHighlightColor);
                ctx.fillStyle = softTipLight;
                ctx.fillRect(-petalSize * 0.04, -petalSize * 0.46, petalSize * 0.86, petalSize * 0.92);
                ctx.restore();

                ctx.save();
                traceSakuraPetalContour(
                    ctx,
                    petalSize,
                    petalTemplateId,
                    resolvedNotchDepth,
                    blossom.silhouetteProfile,
                    blossom.bloomStage,
                );
                ctx.clip();
                const baseShade = ctx.createRadialGradient(
                    petalSize * 0.04,
                    0,
                    petalSize * 0.04,
                    petalSize * 0.06,
                    0,
                    petalSize * 0.34,
                );
                baseShade.addColorStop(0, petalBaseShadeColor);
                baseShade.addColorStop(0.5, 'rgba(255,255,255,0)');
                baseShade.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = baseShade;
                ctx.beginPath();
                ctx.ellipse(
                    petalSize * 0.08,
                    petalSize * 0.01,
                    petalSize * 0.24,
                    petalSize * 0.11,
                    0,
                    0,
                    Math.PI * 2,
                );
                ctx.fill();

                const sideBlush = ctx.createRadialGradient(
                    petalSize * 0.62,
                    petalSize * 0.1,
                    petalSize * 0.08,
                    petalSize * 0.62,
                    petalSize * 0.04,
                    petalSize * 0.42,
                );
                sideBlush.addColorStop(0, petalDeepEdgeColor);
                sideBlush.addColorStop(0.54, 'rgba(255,255,255,0)');
                sideBlush.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = sideBlush;
                ctx.fillRect(petalSize * 0.08, -petalSize * 0.44, petalSize * 0.76, petalSize * 0.9);
                ctx.restore();

                ctx.strokeStyle = petalBoundaryColor;
                ctx.lineWidth = 0.12;
                ctx.beginPath();
                ctx.moveTo(petalSize * 0.02, petalSize * 0.045);
                ctx.quadraticCurveTo(petalSize * 0.1, petalSize * 0.12, petalSize * 0.22, petalSize * 0.105);
                ctx.stroke();

                ctx.strokeStyle = petalRimColor;
                ctx.lineWidth = 0.14;
                traceSakuraPetalContour(
                    ctx,
                    petalSize,
                    petalTemplateId,
                    resolvedNotchDepth,
                    blossom.silhouetteProfile,
                    blossom.bloomStage,
                );
                ctx.stroke();

                ctx.strokeStyle = petalVeinColor;
                ctx.lineWidth = Math.max(0.11, petalSize * 0.014);
                ctx.beginPath();
                ctx.moveTo(petalSize * 0.08, 0);
                ctx.quadraticCurveTo(
                    petalSize * 0.34,
                    petalSize * petalTemplate.veinTop,
                    petalSize * 0.62,
                    -petalSize * 0.04,
                );
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(petalSize * 0.08, petalSize * 0.01);
                ctx.quadraticCurveTo(
                    petalSize * 0.33,
                    petalSize * petalTemplate.veinBottom,
                    petalSize * 0.58,
                    petalSize * 0.1,
                );
                ctx.stroke();

                const [rimStartX, rimStartY, rimC1X, rimC1Y, rimC2X, rimC2Y, rimEndX, rimEndY] = petalTemplate.rim;
                ctx.strokeStyle = petalHighlightColor;
                ctx.lineWidth = Math.max(0.13, petalSize * 0.02);
                ctx.beginPath();
                ctx.moveTo(petalSize * rimStartX, petalSize * rimStartY);
                ctx.bezierCurveTo(
                    petalSize * rimC1X,
                    petalSize * rimC1Y,
                    petalSize * rimC2X,
                    petalSize * rimC2Y,
                    petalSize * rimEndX,
                    petalSize * rimEndY,
                );
                ctx.stroke();

                if (resolvedNotchDepth > 0.32) {
                    ctx.strokeStyle = rgba(188, 78, 128, 0.055 + (resolvedNotchDepth * 0.055));
                    ctx.lineWidth = 0.1 + (resolvedNotchDepth * 0.04);
                    ctx.beginPath();
                    ctx.moveTo(petalSize * 0.69, -petalSize * 0.045);
                    ctx.quadraticCurveTo(
                        petalSize * 0.76,
                        petalSize * 0.02,
                        petalSize * 0.69,
                        petalSize * 0.085,
                    );
                    ctx.stroke();
                }
                ctx.restore();
            }
        }

        const coreHalo = ctx.createRadialGradient(0, -0.1, 0, 0, 0.1, 2.2 + (blossom.innerScale * 0.44));
        coreHalo.addColorStop(0, mixHexColors('#FFFFFF', '#FFF3F7', 0.52, Math.max(0.02, stageProfile.haloAlpha * 0.3)));
        coreHalo.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = coreHalo;
        ctx.beginPath();
        ctx.arc(coreShiftX, 0.2 + coreShiftY, 2.2 + (blossom.innerScale * 0.44), 0, Math.PI * 2);
        ctx.fill();

        const coreRadius = 0.9 + (blossom.coreSize * 0.82);
        const coreFill = ctx.createRadialGradient(
            coreShiftX - 0.12,
            0.06 + coreShiftY,
            0,
            coreShiftX,
            0.2 + coreShiftY,
            coreRadius * 1.42,
        );
        const coreAlpha = 0.72 * stageProfile.coreAlpha * (1 - (fallAmount * 0.12));
        coreFill.addColorStop(0, `rgba(255,239,142,${Math.min(1, coreAlpha + 0.18).toFixed(2)})`);
        coreFill.addColorStop(0.42, `rgba(238,160,98,${Math.min(1, coreAlpha + 0.08).toFixed(2)})`);
        coreFill.addColorStop(0.78, `rgba(202,86,113,${Math.max(0.08, coreAlpha * 0.44).toFixed(2)})`);
        coreFill.addColorStop(1, 'rgba(202,86,113,0)');
        ctx.fillStyle = coreFill;
        ctx.beginPath();
        ctx.arc(coreShiftX, 0.2 + coreShiftY, coreRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = stamenStrokeColor;
        ctx.lineWidth = 0.28 + (blossom.stamenBurst * 0.08);
        ctx.lineCap = 'round';
        const stamenCount = blossom.bloomStage === 'bud'
            ? 0
            : 9 + Math.round(blossom.stamenBurst * 4);
        for (let i = 0; i < stamenCount; i += 1) {
            const angle = (i * Math.PI * 2 / stamenCount)
                + 0.2
                + (facingYaw * 0.08)
                + (Math.sin((i + 1) * 1.73 + blossom.warmth) * 0.025);
            const startRadius = coreRadius * 0.34;
            const endRadius = coreRadius
                * (1.42 + ((i % 3) * 0.1) + (blossom.stamenBurst * 0.12))
                * stageProfile.stamenScale
                * (0.9 + (blossom.openness * 0.14));
            const startX = coreShiftX + (Math.cos(angle) * startRadius * 0.88);
            const startY = (0.2 + coreShiftY) + (Math.sin(angle) * startRadius * 0.72);
            const x = coreShiftX + (Math.cos(angle) * endRadius * 0.96);
            const y = (0.2 + coreShiftY) + (Math.sin(angle) * endRadius * 0.8);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();

            ctx.fillStyle = antherColor;
            ctx.beginPath();
            ctx.arc(x, y, 0.18 + (blossom.coreSize * 0.05) + (blossom.stamenBurst * 0.04), 0, Math.PI * 2);
            ctx.fill();
        }

        const coreSpeckCount = blossom.bloomStage === 'bud'
            ? 0
            : 6 + Math.round(blossom.stamenBurst * 5);
        ctx.fillStyle = mixHexColors('#763D3C', '#EFA05F', 0.42, Math.max(0.16, stageProfile.coreAlpha * 0.44));
        for (let i = 0; i < coreSpeckCount; i += 1) {
            const angle = (i / Math.max(1, coreSpeckCount)) * Math.PI * 2 + blossom.warmth;
            const radius = coreRadius * (0.22 + ((i % 3) * 0.12));
            ctx.beginPath();
            ctx.arc(
                coreShiftX + (Math.cos(angle) * radius * 0.86),
                0.2 + coreShiftY + (Math.sin(angle) * radius * 0.62),
                0.1 + (blossom.coreSize * 0.035),
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }

        ctx.fillStyle = mixHexColors('#763D3C', '#EFA05F', 0.18, Math.max(0.12, 0.34 * stageProfile.coreAlpha));
        ctx.beginPath();
        ctx.arc(
            coreShiftX,
            0.2 + coreShiftY,
            (0.18 + (blossom.openness * 0.03)) * stageProfile.bloomScale,
            0,
            Math.PI * 2,
        );
        ctx.fill();
        ctx.restore();
    });

    const LEAF_TEMPLATE_LIBRARY = Object.freeze([
        Object.freeze({
            baseLeftX: -5.8,
            baseLeftY: 0.9,
            baseRightX: 5.6,
            baseRightY: 0.9,
            leftOuterX: -9.2,
            leftOuterY: -2.6,
            leftShoulderX: -5.6,
            leftShoulderY: -10.8,
            tipX: 0.4,
            tipY: -13.6,
            rightShoulderX: 6.2,
            rightShoulderY: -10.2,
            rightOuterX: 9.4,
            rightOuterY: -2.2,
            veinBend: -0.8,
            sideVeins: [[-1.2, -4.4, -4.3, -6.6], [0.1, -7.2, -2.6, -9.6], [1.3, -4.1, 4.2, -6.1]],
            highlightX: -1.1,
            highlightY: -6.2,
            highlightW: 3.9,
            highlightH: 1.2,
            highlightRot: -0.52,
        }),
        Object.freeze({
            baseLeftX: -4.8,
            baseLeftY: 0.8,
            baseRightX: 4.6,
            baseRightY: 0.8,
            leftOuterX: -7.2,
            leftOuterY: -1.8,
            leftShoulderX: -4.2,
            leftShoulderY: -11.8,
            tipX: 0,
            tipY: -15.2,
            rightShoulderX: 4.5,
            rightShoulderY: -11.3,
            rightOuterX: 7.1,
            rightOuterY: -1.6,
            veinBend: 0.2,
            sideVeins: [[-0.8, -4.9, -3.2, -7.9], [0.2, -7.6, -1.7, -10.9], [1.1, -4.6, 3.5, -7.2]],
            highlightX: -0.4,
            highlightY: -7.2,
            highlightW: 2.8,
            highlightH: 1.1,
            highlightRot: -0.24,
        }),
        Object.freeze({
            baseLeftX: -6.4,
            baseLeftY: 0.9,
            baseRightX: 6.2,
            baseRightY: 0.9,
            leftOuterX: -10.2,
            leftOuterY: -1.2,
            leftShoulderX: -7.2,
            leftShoulderY: -9.2,
            tipX: 1.1,
            tipY: -11.8,
            rightShoulderX: 7.6,
            rightShoulderY: -8.6,
            rightOuterX: 10.6,
            rightOuterY: -0.8,
            veinBend: -1.4,
            sideVeins: [[-1.8, -3.4, -5.2, -4.9], [-0.2, -5.6, -3.4, -7.2], [2.2, -3.1, 5.6, -4.4]],
            highlightX: -1.6,
            highlightY: -4.9,
            highlightW: 4.6,
            highlightH: 1.4,
            highlightRot: -0.34,
        }),
    ]);

    const normalizeLeafDescriptor = (value = {}) => ({
        color: String(value?.color || '#6B7D52'),
        leafTemplateId: clampInt(value?.leafTemplateId, 0, LEAF_TEMPLATE_LIBRARY.length - 1, 0),
    });

    const resolveLeafSpriteSpec = (input = '#6B7D52') => {
        if (input && typeof input === 'object' && !Array.isArray(input)) {
            const leaf = normalizeLeafDescriptor(input);
            return {
                key: `${ZEN_ASSET_CACHE_VERSION}|${leaf.color}|leaf:${leaf.leafTemplateId}`,
                color: leaf.color,
                leaf,
            };
        }
        const color = String(input || '#6B7D52');
        return {
            key: `${ZEN_ASSET_CACHE_VERSION}|${color}|leaf:0`,
            color,
            leaf: normalizeLeafDescriptor({ color }),
        };
    };

    const traceLeafContour = (ctx, template) => {
        ctx.beginPath();
        ctx.moveTo(template.baseLeftX, template.baseLeftY);
        ctx.bezierCurveTo(
            template.leftOuterX,
            template.leftOuterY,
            template.leftShoulderX,
            template.leftShoulderY,
            template.tipX,
            template.tipY,
        );
        ctx.bezierCurveTo(
            template.rightShoulderX,
            template.rightShoulderY,
            template.rightOuterX,
            template.rightOuterY,
            template.baseRightX,
            template.baseRightY,
        );
        ctx.quadraticCurveTo(0.3, 4.8, template.baseLeftX, template.baseLeftY);
        ctx.closePath();
    };

    const createLeafSprite = (input) => createOffscreen((ctx) => {
        const { color, leaf } = resolveLeafSpriteSpec(input);
        const template = LEAF_TEMPLATE_LIBRARY[leaf.leafTemplateId] || LEAF_TEMPLATE_LIBRARY[0];
        const leafBase = mixHexColors(color, '#6A5C47', 0.22, 1);
        const leafShadow = mixHexColors(color, '#49533F', 0.54, 1);
        const leafHighlight = mixHexColors(color, '#D5DEC9', 0.18, 0.92);
        const gradient = ctx.createLinearGradient(template.baseLeftX, template.tipY, template.baseRightX, 8);
        gradient.addColorStop(0, leafHighlight);
        gradient.addColorStop(0.46, color);
        gradient.addColorStop(1, leafShadow);
        ctx.fillStyle = gradient;
        traceLeafContour(ctx, template);
        ctx.fill();

        ctx.strokeStyle = mixHexColors(color, '#314029', 0.62, 0.32);
        ctx.lineWidth = 0.28;
        traceLeafContour(ctx, template);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(232,239,225,0.52)';
        ctx.lineWidth = 0.54;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 1.4);
        ctx.quadraticCurveTo(template.veinBend, -3.8, template.tipX * 0.54, template.tipY + 1.6);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(92,108,77,0.3)';
        ctx.lineWidth = 0.34;
        template.sideVeins.forEach(([x1, y1, x2, y2]) => {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.quadraticCurveTo((x1 + x2) * 0.44, (y1 + y2) * 0.5, x2, y2);
            ctx.stroke();
        });

        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.ellipse(
            template.highlightX,
            template.highlightY,
            template.highlightW,
            template.highlightH,
            template.highlightRot,
            0,
            Math.PI * 2,
        );
        ctx.fill();
    });

    assetCache.resolveFlowerSprite = (input = '#FFCDD2') => {
        const { key, color, blossom } = resolveFlowerSpriteSpec(input);
        if (!assetCache.flowers[key]) {
            assetCache.flowers[key] = createFlowerSprite(color, blossom);
        }
        return assetCache.flowers[key];
    };
    assetCache.resolveLeafSprite = (input = '#6B7D52') => {
        const { key, leaf } = resolveLeafSpriteSpec(input);
        if (!assetCache.leaves[key]) {
            assetCache.leaves[key] = createLeafSprite(leaf);
        }
        return assetCache.leaves[key];
    };

    CONFIG.flowerColors.forEach((color) => {
        assetCache.resolveFlowerSprite({ color });
    });
    CONFIG.leafColors.forEach((color) => {
        assetCache.resolveLeafSprite(color);
    });

    return assetCache;
};

export const resolveRenderSpecies = () => SakuraRenderSpecies;
