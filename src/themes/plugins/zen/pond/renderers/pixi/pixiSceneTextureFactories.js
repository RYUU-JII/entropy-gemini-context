import { drawZenPetal, requireZenPetalAppearance, ZEN_PETAL_SPRITE_SIZE } from '../../../runtime/petals/zenPetalMaterial.js';
import { requireZenWorldBotanicalMaterialLighting } from '../../../runtime/environment/zenWorldBotanicalMaterialLighting.js';
import {
  BLEND_MODES,
  BaseTexture,
  Texture,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { clamp as clampValue } from '../../model/koi/koiMotion.js';
import { resolveFlowerPhaseVariant } from './pixiSceneTextureBuckets.js';
import { createZenDecorGeometryCanvas, createZenDecorGeometryMask } from './zenDecorGeometryMasks.js';
import { bakeZenRockMineralMaterial, ZEN_ROCK_MINERAL_MATERIAL_VERSION } from './zenRockMineralMaterial.js';

const FALLBACK_WATER_COLORS = Object.freeze(['#183D4A', '#24525C', '#326B73']);
const SOFT_LIGHT_BLEND = BLEND_MODES.SOFT_LIGHT ?? BLEND_MODES.OVERLAY ?? BLEND_MODES.NORMAL;

const PETAL_BASE_SIZE = ZEN_PETAL_SPRITE_SIZE;
const RIPPLE_BASE_RADIUS = 96;
const PARTICLE_BASE_RADIUS = 8;
const GLIMMER_BASE_SIZE = 3.2;
const MAX_RENDER_DPR_CAP = 1.5;
const NEUTRAL_PLANT_BAKE_ENV_STATE = Object.freeze({
    // Bake plant material in a lighting-neutral state so runtime tinting can own day/night response.
    lightIntensity: 0.72,
    zenMaterialBake: true,
    sunAngle: Math.PI * 0.75,
    shadowLength: 18,
});

const resolvePixiResolution = ({
    devicePixelRatio,
    dprCap = MAX_RENDER_DPR_CAP,
} = {}) => {
    const numericDevicePixelRatio = Number(devicePixelRatio);
    if (
        !Number.isFinite(numericDevicePixelRatio)
        || numericDevicePixelRatio < 1
        || numericDevicePixelRatio > 3
    ) {
        throw new Error(
            `ZEN_PIXI_SCENE_DEVICE_PIXEL_RATIO_INVALID:${String(devicePixelRatio)}`,
        );
    }
    const safeCap = clampValue(Number(dprCap) || MAX_RENDER_DPR_CAP, 1, MAX_RENDER_DPR_CAP);
    return clampValue(numericDevicePixelRatio, 1, safeCap);
};

const makeCanvas = (width, height) => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
};

const createTextureFromCanvas = (canvas) => {
    if (!canvas) return null;
    return new Texture(new BaseTexture(canvas));
};

const parseRgbTriplet = (raw, fallback = [200, 215, 222]) => {
    if (typeof raw !== 'string') return fallback;
    const parts = raw.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return fallback;
    return [
        clampValue(Number(parts[0]) || fallback[0], 0, 255),
        clampValue(Number(parts[1]) || fallback[1], 0, 255),
        clampValue(Number(parts[2]) || fallback[2], 0, 255),
    ];
};

const createCanvasTexture = (ownedTextures, width, height, draw) => {
    const canvas = makeCanvas(width, height);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;
    try {
        draw(ctx, canvas);
    } catch (error) {
        void error;
        return null;
    }
    const texture = createTextureFromCanvas(canvas);
    ownedTextures.add(texture);
    return texture;
};

const createBaseWaterTexture = (ownedTextures, width, height, colors) => {
    const [c0, c1, c2] = colors;
    return createCanvasTexture(ownedTextures, width, height, (ctx) => {
        const gradient = ctx.createRadialGradient(
            width / 2,
            height / 2,
            0,
            width / 2,
            height / 2,
            width * 1.2,
        );
        gradient.addColorStop(0, c0);
        gradient.addColorStop(0.4, c1);
        gradient.addColorStop(1, c2);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    });
};

const createRingTexture = (ownedTextures, lineWidth) => {
    const size = 256;
    const center = size / 2;
    const texture = createCanvasTexture(ownedTextures, size, size, (ctx) => {
        ctx.strokeStyle = 'rgba(255,255,255,1)';
        ctx.lineWidth = clampValue(lineWidth, 0.7, 2.8) * 2;
        ctx.beginPath();
        ctx.arc(center, center, RIPPLE_BASE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
    });
    if (!texture) return { texture: Texture.WHITE, baseRadius: 1 };
    return { texture, baseRadius: RIPPLE_BASE_RADIUS };
};

const createParticleTexture = (ownedTextures, colorTriplet) => {
    const [r, g, b] = parseRgbTriplet(colorTriplet);
    const size = 32;
    const center = size / 2;
    const texture = createCanvasTexture(ownedTextures, size, size, (ctx) => {
        const grad = ctx.createRadialGradient(center, center, 0, center, center, PARTICLE_BASE_RADIUS);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.95)`);
        grad.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, 0.4)`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(center, center, PARTICLE_BASE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    });
    if (!texture) return { texture: Texture.WHITE, baseRadius: 1 };
    return { texture, baseRadius: PARTICLE_BASE_RADIUS };
};

const createGlimmerTexture = (ownedTextures) => {
    const size = 64;
    const center = size / 2;
    const texture = createCanvasTexture(ownedTextures, size, size, (ctx) => {
        ctx.translate(center, center);
        const lightGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, GLIMMER_BASE_SIZE * 0.85);
        lightGrad.addColorStop(0, 'rgba(255,253,231,0.9)');
        lightGrad.addColorStop(1, 'rgba(255,253,231,0)');
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.arc(0, 0, GLIMMER_BASE_SIZE * 0.85, 0, Math.PI * 2);
        ctx.fill();

        const dots = 7;
        const baseRadius = GLIMMER_BASE_SIZE * 0.7;
        const arcRadius = GLIMMER_BASE_SIZE * 0.92;
        ctx.fillStyle = 'rgba(255,253,231,0.72)';
        for (let i = 0; i < dots; i += 1) {
            const angle = (Math.PI * 2 * i) / dots;
            const drift = Math.sin(i * 0.9) * 0.45;
            const radius = baseRadius * (0.35 + (i / dots) * 0.7);
            const x = Math.cos(angle + drift) * radius;
            const y = Math.sin(angle + drift) * radius;
            const size = 0.35 + Math.sin(i * 0.8) * 0.2 + 0.2;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            const tailX = Math.cos(angle + drift * 1.3) * (radius + arcRadius * 0.35);
            const tailY = Math.sin(angle + drift * 1.3) * (radius + arcRadius * 0.35);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(tailX, tailY);
            ctx.lineWidth = 0.45 + (i % 2) * 0.12;
            ctx.strokeStyle = 'rgba(255,253,231,0.42)';
            ctx.stroke();
        }
    });
    if (!texture) return { texture: Texture.WHITE, baseSize: 1 };
    return { texture, baseSize: GLIMMER_BASE_SIZE };
};

const createPetalTexture = (ownedTextures, baseColor, shapeType, initialLighting) => {
    const size = PETAL_BASE_SIZE;
    const width = Math.ceil(size * 3.5);
    const height = Math.ceil(size * 3.5);
    requireZenPetalAppearance({ color: baseColor, shapeType });
    requireZenWorldBotanicalMaterialLighting(initialLighting);
    const canvas = makeCanvas(width, height);
    if (!canvas) throw new Error('ZEN_LANDED_PETAL_CANVAS_UNAVAILABLE');
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('ZEN_LANDED_PETAL_CONTEXT_UNAVAILABLE');
    let materialLighting = initialLighting;
    const paint = () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.translate(width / 2, height / 2);
        drawZenPetal(ctx, size, shapeType, baseColor, materialLighting);
    };
    paint();
    const texture = createTextureFromCanvas(canvas);
    ownedTextures.add(texture);
    return {
        texture, baseSize: PETAL_BASE_SIZE,
        setMaterialLighting(lighting) {
            if (lighting === materialLighting) return;
            requireZenWorldBotanicalMaterialLighting(lighting);
            const changed = lighting.signature !== materialLighting.signature;
            materialLighting = lighting;
            if (changed) {
                paint();
                texture.baseTexture.update();
            }
        },
    };
};

const createLilyPadTexture = (ownedTextures, lilyPad) => {
    const padSize = Math.max(12, Number(lilyPad?.size) || 24);
    const textureSize = Math.ceil(padSize * 6);
    const texture = createCanvasTexture(ownedTextures, textureSize, textureSize, (ctx) => {
        const cx = textureSize * 0.5;
        const cy = textureSize * 0.5;
        const proto = Object.getPrototypeOf(lilyPad) || Object.prototype;
        const mock = Object.assign(Object.create(proto), lilyPad, {
            x: cx,
            y: cy,
            rotation: 0,
            currentRotation: 0,
            timeSec: 0,
            zenMaterialBake: true,
            bodyGradient: null,
            flowerScale: 1,
            flowerStateScale: 1,
            flowerPhase: resolveFlowerPhaseVariant(lilyPad?.flowerPhase),
            flowerOffsetSwayPhase: 0,
        });

        // Keep a compact fixed contact AO for grounding; dynamic cast is handled at runtime.
        const baseAO = ctx.createRadialGradient(
            cx,
            cy + (padSize * 0.06),
            padSize * 0.18,
            cx,
            cy + (padSize * 0.06),
            padSize * 1.05,
        );
        baseAO.addColorStop(0, 'rgba(3, 14, 12, 0.04)');
        baseAO.addColorStop(0.6, 'rgba(3, 14, 12, 0.03)');
        baseAO.addColorStop(1, 'rgba(3, 14, 12, 0)');
        ctx.fillStyle = baseAO;
        ctx.beginPath();
        ctx.ellipse(cx, cy + (padSize * 0.06), padSize * 1.008, padSize * 0.99, 0, 0, Math.PI * 2);
        ctx.fill();

        if (mock?.hasFlower && typeof mock.resolveFlowerAnchorLocal === 'function') {
            const anchor = mock.resolveFlowerAnchorLocal();
            const fx = cx + (Number(anchor?.x) || 0);
            const fy = cy + (Number(anchor?.y) || 0);
            const blossomAO = ctx.createRadialGradient(
                fx,
                fy + (padSize * 0.02),
                padSize * 0.04,
                fx,
                fy + (padSize * 0.02),
                padSize * 0.34,
            );
            blossomAO.addColorStop(0, 'rgba(4, 13, 11, 0.08)');
            blossomAO.addColorStop(1, 'rgba(4, 13, 11, 0)');
            ctx.fillStyle = blossomAO;
            ctx.beginPath();
            ctx.ellipse(fx, fy + (padSize * 0.02), padSize * 0.32, padSize * 0.18, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        if (typeof mock.draw === 'function') {
            mock.draw(ctx, NEUTRAL_PLANT_BAKE_ENV_STATE, {
                renderGroundShadow: false,
            });
        }
    });
    if (!texture) return { texture: Texture.WHITE };
    return createZenDecorMaterialRecord({ ownedTextures, texture, entity: lilyPad, kind: 'lily' });
};

const createWaterLilyBloomTexture = (ownedTextures, waterLilyBloom) => {
    const bloomSize = Math.max(10, Number(waterLilyBloom?.size) || 18);
    const textureSize = Math.ceil(bloomSize * 6.8);
    const texture = createCanvasTexture(ownedTextures, textureSize, textureSize, (ctx) => {
        const cx = textureSize * 0.5;
        const cy = textureSize * 0.5;
        const proto = Object.getPrototypeOf(waterLilyBloom) || Object.prototype;
        const mock = Object.assign(Object.create(proto), waterLilyBloom, {
            x: cx,
            y: cy,
            zenMaterialBake: true,
            currentRootOffsetX: 0,
            currentRootOffsetY: 0,
            currentRotation: 0,
            timeSec: 0,
            flowerScale: 1,
            flowerStateScale: 1,
            flowerPhase: resolveFlowerPhaseVariant(waterLilyBloom?.flowerPhase),
        });
        if (typeof mock.resolveRootWorld === 'function') {
            const root = mock.resolveRootWorld();
            const rootX = Number(root?.x) || cx;
            const rootY = Number(root?.y) || cy;
            const rootAO = ctx.createRadialGradient(
                rootX,
                rootY + (bloomSize * 0.02),
                bloomSize * 0.04,
                rootX,
                rootY + (bloomSize * 0.02),
                bloomSize * 0.34,
            );
            rootAO.addColorStop(0, 'rgba(4, 13, 11, 0.18)');
            rootAO.addColorStop(1, 'rgba(4, 13, 11, 0)');
            ctx.fillStyle = rootAO;
            ctx.beginPath();
            ctx.ellipse(rootX, rootY + (bloomSize * 0.02), bloomSize * 0.28, bloomSize * 0.16, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (typeof mock.draw === 'function') {
            mock.draw(ctx, NEUTRAL_PLANT_BAKE_ENV_STATE, {
                renderWaterLily: true,
                renderStem: true,
                renderGroundShadow: false,
            });
        }
    });

    if (!texture) {
        return {
            texture: Texture.WHITE,
            baseSize: 1,
        };
    }
    return { ...createZenDecorMaterialRecord({ ownedTextures, texture, entity: waterLilyBloom, kind: 'flower' }), baseSize: bloomSize };
};

const createClassicLilyPadTexture = (ownedTextures, lilyPad) => {
    const padSize = Math.max(12, Number(lilyPad?.size) || 24);
    const textureSize = Math.ceil(padSize * 6);
    const texture = createCanvasTexture(ownedTextures, textureSize, textureSize, (ctx) => {
        const cx = textureSize * 0.5;
        const cy = textureSize * 0.5;
        const proto = Object.getPrototypeOf(lilyPad) || Object.prototype;
        const mock = Object.assign(Object.create(proto), lilyPad, {
            x: cx,
            y: cy,
            rotation: 0,
            currentRotation: 0,
            timeSec: 0,
            bodyGradient: null,
            flowerScale: 1,
            flowerStateScale: 1,
            flowerPhase: resolveFlowerPhaseVariant(lilyPad?.flowerPhase),
            flowerOffsetSwayPhase: 0,
        });

        const baseAO = ctx.createRadialGradient(
            cx,
            cy + (padSize * 0.06),
            padSize * 0.18,
            cx,
            cy + (padSize * 0.06),
            padSize * 1.05,
        );
        baseAO.addColorStop(0, 'rgba(3, 14, 12, 0.08)');
        baseAO.addColorStop(0.6, 'rgba(3, 14, 12, 0.03)');
        baseAO.addColorStop(1, 'rgba(3, 14, 12, 0)');
        ctx.fillStyle = baseAO;
        ctx.beginPath();
        ctx.ellipse(cx, cy + (padSize * 0.06), padSize * 0.9, padSize * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();

        if (typeof mock.drawClassicPad === 'function') {
            mock.drawClassicPad(ctx, NEUTRAL_PLANT_BAKE_ENV_STATE, {
                renderGroundShadow: false,
            });
        } else if (typeof mock.draw === 'function') {
            mock.draw(ctx, NEUTRAL_PLANT_BAKE_ENV_STATE, {
                renderGroundShadow: false,
                style: 'classic',
            });
        }
    });
    if (!texture) return { texture: Texture.WHITE };
    return { texture };
};

const createClassicWaterLilyBloomTexture = (ownedTextures, waterLilyBloom) => {
    const bloomSize = Math.max(10, Number(waterLilyBloom?.size) || 18);
    const textureSize = Math.ceil(bloomSize * 6.8);
    const texture = createCanvasTexture(ownedTextures, textureSize, textureSize, (ctx) => {
        const cx = textureSize * 0.5;
        const cy = textureSize * 0.5;
        const proto = Object.getPrototypeOf(waterLilyBloom) || Object.prototype;
        const mock = Object.assign(Object.create(proto), waterLilyBloom, {
            x: cx,
            y: cy,
            currentRootOffsetX: 0,
            currentRootOffsetY: 0,
            currentRotation: 0,
            timeSec: 0,
            flowerScale: 1,
            flowerStateScale: 1,
            flowerPhase: resolveFlowerPhaseVariant(waterLilyBloom?.flowerPhase),
        });
        if (typeof mock.draw === 'function') {
            mock.draw(ctx, NEUTRAL_PLANT_BAKE_ENV_STATE, {
                renderWaterLily: true,
                renderStem: true,
                renderGroundShadow: false,
                style: 'classic',
            });
        }
    });

    if (!texture) {
        return {
            texture: Texture.WHITE,
            baseSize: 1,
        };
    }
    return {
        texture,
        baseSize: bloomSize,
    };
};

const createZenIrisClusterTexture = (ownedTextures, irisCluster) => {
    const irisSize = Math.max(8, Number(irisCluster?.size) || 18);
    const textureWidth = Math.ceil(irisSize * 7.4);
    const textureHeight = Math.ceil(irisSize * 7.4);
    const baseX = textureWidth * 0.5;
    const baseY = textureHeight * 0.5;
    const texture = createCanvasTexture(ownedTextures, textureWidth, textureHeight, (ctx) => {
        const proto = Object.getPrototypeOf(irisCluster) || Object.prototype;
        const mock = Object.assign(Object.create(proto), irisCluster, {
            x: baseX,
            y: baseY,
            rotation: 0,
            currentRotation: 0,
            currentScaleX: 1,
            currentScaleY: 1,
            timeSec: 0,
        });
        if (typeof mock.draw === 'function') {
            mock.draw(ctx, NEUTRAL_PLANT_BAKE_ENV_STATE, {
                renderIris: true,
                renderContactShadow: true,
            });
        }
    });

    if (!texture) {
        return {
            texture: Texture.WHITE,
            baseSize: 1,
            anchorY: 0.5,
        };
    }
    return {
        texture,
        baseSize: irisSize,
        anchorY: baseY / textureHeight,
    };
};

const createRockTexture = (ownedTextures, rock) => {
    const size = Number(rock?.size);
    if (!Number.isFinite(size) || size < 32 || typeof rock.draw !== 'function') {
        throw new Error('ZEN_ROCK_MINERAL_ENTITY_REQUIRED');
    }
    const rockSize = Math.max(40, size);
    const maskSize = Math.ceil(size * 2.7);
    const textureWidth = Math.ceil(rockSize * 2.7);
    const textureHeight = Math.ceil(rockSize * 2.45);
    const mock = Object.assign(Object.create(Object.getPrototypeOf(rock)), rock, { x: 0, y: 0, rotation: 0 });
    const formCanvas = createZenDecorGeometryCanvas({
        width: maskSize, height: maskSize,
        draw: (ctx) => mock.draw(ctx, null, { renderContactShadow: false, renderSilhouette: true }),
    });
    const formContext = formCanvas.getContext('2d');
    const coverage = formContext.getImageData(0, 0, maskSize, maskSize);
    const { pigment, formCoverage } = bakeZenRockMineralMaterial({ coverage: coverage.data, width: maskSize, height: maskSize, rock });
    const pigmentImage = formContext.createImageData(maskSize, maskSize);
    pigmentImage.data.set(pigment);
    formContext.putImageData(pigmentImage, 0, 0);
    const colorCanvas = makeCanvas(textureWidth, textureHeight);
    if (!colorCanvas) throw new Error('ZEN_ROCK_MINERAL_CANVAS_REQUIRED');
    const colorContext = colorCanvas.getContext('2d', { alpha: true });
    if (!colorContext) throw new Error('ZEN_ROCK_MINERAL_CONTEXT_REQUIRED');
    colorContext.drawImage(formCanvas, (textureWidth - maskSize) / 2, (textureHeight - maskSize) / 2);
    coverage.data.set(formCoverage);
    formContext.putImageData(coverage, 0, 0);
    // Both canvases are complete before admission. Form RGB reuses the existing
    // silhouette texture; shadow consumers continue to sample its exact alpha.
    const texture = createTextureFromCanvas(colorCanvas);
    const silhouetteTexture = createTextureFromCanvas(formCanvas);
    ownedTextures.add(texture); ownedTextures.add(silhouetteTexture);
    return createZenDecorMaterialRecord({
        ownedTextures, texture, entity: rock, kind: 'rock', silhouetteTexture,
        surfaceFormEncoding: ZEN_ROCK_MINERAL_MATERIAL_VERSION,
    });
};

export const createZenDecorMaterialRecord = ({ ownedTextures, texture, entity, kind, silhouetteTexture: preparedSilhouette = null, surfaceFormEncoding = 'analytic' }) => {
    const size = Number(entity.size);
    if (!Number.isFinite(size) || size <= 0) throw new Error('ZEN_DECOR_GEOMETRY_SIZE_REQUIRED');
    const maskSize = Math.ceil(size * (kind === 'rock' ? 2.7 : 3.6));
    const mock = Object.assign(Object.create(Object.getPrototypeOf(entity)), entity, {
        x: 0, y: 0, rotation: 0, currentRotation: 0, zenMaterialBake: true,
        currentRootOffsetX: 0, currentRootOffsetY: 0,
        flowerPhase: resolveFlowerPhaseVariant(entity.flowerPhase),
    });
    if (surfaceFormEncoding !== 'analytic' && (surfaceFormEncoding !== ZEN_ROCK_MINERAL_MATERIAL_VERSION || kind !== 'rock' || !preparedSilhouette)) {
        throw new Error('ZEN_DECOR_FORM_ENCODING_INVALID');
    }
    if (preparedSilhouette && (preparedSilhouette.width !== maskSize || preparedSilhouette.height !== maskSize)) {
        throw new Error('ZEN_DECOR_PREPARED_MASK_SIZE_INVALID');
    }
    const silhouetteTexture = preparedSilhouette === null ? createZenDecorGeometryMask({
        ownedTextures, width: maskSize, height: maskSize,
        draw(ctx) {
            if (kind === 'rock') mock.draw(ctx, null, { renderContactShadow: false, renderSilhouette: true });
            else if (kind === 'lily') {
                ctx.scale(mock.scaleX || 1.025, mock.scaleY || 0.985);
                mock.buildPadPath(ctx, 1);
                ctx.fill();
            } else if (kind === 'flower') mock.drawWaterLily(ctx, size, 1);
            else throw new Error(`ZEN_DECOR_GEOMETRY_KIND_INVALID:${kind}`);
        },
    }) : preparedSilhouette;
    const flower = kind === 'flower' ? mock.resolveFlowerWorld() : { x: 0, y: 0 };
    const extent = size * (kind === 'rock' ? 1.05 : kind === 'flower' ? 1.6 : 1.45);
    const bodyBounds = kind === 'lily' && entity.hasFlower
        ? [-texture.width / 2, -texture.height / 2, texture.width / 2, texture.height / 2]
        : [Math.min(-size * 0.2, flower.x - extent), Math.min(-size * 0.2, flower.y - extent), Math.max(size * 0.2, flower.x + extent), Math.max(size * 0.2, flower.y + extent)];
    return {
        texture, silhouetteTexture,
        materialGeometry: Object.freeze({
            kind, size, maskSize, maskExtent: extent, bodyBounds: Object.freeze(bodyBounds), surfaceFormEncoding,
            colorAnchor: 'entity_root',
            silhouetteAnchor: kind === 'flower' ? 'flower_center' : 'body_center',
            silhouetteOffsetX: flower.x, silhouetteOffsetY: flower.y,
            centerX: flower.x, centerY: flower.y,
            radiusX: size * (kind === 'rock' ? 0.62 : 1),
            radiusY: size * (kind === 'rock' ? 0.36 : 1),
        }),
    };
};

export {
    FALLBACK_WATER_COLORS,
    SOFT_LIGHT_BLEND,
    PETAL_BASE_SIZE,
    NEUTRAL_PLANT_BAKE_ENV_STATE,
    resolvePixiResolution,
    createBaseWaterTexture,
    createRingTexture,
    createParticleTexture,
    createGlimmerTexture,
    createPetalTexture,
    createLilyPadTexture,
    createWaterLilyBloomTexture,
    createClassicLilyPadTexture,
    createClassicWaterLilyBloomTexture,
    createZenIrisClusterTexture,
    createRockTexture,
};
