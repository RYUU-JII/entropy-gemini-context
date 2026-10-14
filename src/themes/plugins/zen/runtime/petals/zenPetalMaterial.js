import {
    SAKURA_FLOWER_COLORS, SAKURA_PETAL_SHAPES, traceSakuraPetalPath,
    resolveSakuraPetalPigment, createSakuraPetalBodyGradient,
} from '../../model/sakura/sakuraPetalMaterial.js';
import {
    ZEN_BOTANICAL_NEUTRAL_MATERIAL_LIGHTING, createZenBotanicalMaterialContext,
} from '../environment/zenWorldBotanicalMaterialLighting.js';

export const ZEN_PETAL_COLORS = SAKURA_FLOWER_COLORS;
export const ZEN_PETAL_SHAPE_COUNT = 6;
export const ZEN_PETAL_SPRITE_SIZE = 16;

export const requireZenPetalAppearance = ({ color, shapeType }) => {
    if (!ZEN_PETAL_COLORS.includes(color)) throw new Error('ZEN_PETAL_COLOR_INVALID');
    if (!Number.isInteger(shapeType) || shapeType < 0 || shapeType >= ZEN_PETAL_SHAPE_COUNT) {
        throw new Error('ZEN_PETAL_SHAPE_INVALID');
    }
};

// Cosmetic full-petal pigment, independent of high-frequency bonsai state.
const pigments = new Map(ZEN_PETAL_COLORS.map(color => [color, resolveSakuraPetalPigment({
    color, warmth: 0.5, centerDepth: 0.55, lightExposure: 0.8, fallAmount: 0.15, translucency: 0.5,
})]));

// Three shared laminae, each seen open or partly folded. The outline stays
// within the existing 1.1 * size footprint used by the pond landing bridge.
const drawZenPetalShapePath = (ctx, size, shapeType) => {
    const folded = shapeType % 2 === 1;
    const shape = SAKURA_PETAL_SHAPES[Math.floor(shapeType / 2)];
    traceSakuraPetalPath(ctx, shape, (x, y) => [
        size * (x * (folded ? 0.9 : 1.6) + (folded ? y * y * 0.18 : 0)),
        size * (0.78 + y * 1.6),
    ]);
};

// Bake the same body, blush, rim and veins for both the app canvas and pond.
// Authored material studies may paint neutral pigment; product surfaces supply
// the required world projection. Color/shape identity remains unchanged.
export const drawZenPetal = (context, size, shapeType, color, materialLighting = ZEN_BOTANICAL_NEUTRAL_MATERIAL_LIGHTING) => {
    const ctx = materialLighting.night === 0 ? context
        : createZenBotanicalMaterialContext(context, materialLighting.mapFlowerColor);
    requireZenPetalAppearance({ color, shapeType });
    const pigment = pigments.get(color);
    ctx.save();
    ctx.beginPath();
    drawZenPetalShapePath(ctx, size, shapeType);
    ctx.closePath();
    ctx.fillStyle = createSakuraPetalBodyGradient(ctx, pigment,
        0, size * 0.78, 0, -size * 0.82);
    ctx.fill();
    ctx.strokeStyle = pigment.petalBoundaryColor;
    ctx.lineWidth = size * 0.025;
    ctx.stroke();
    ctx.clip();

    const sheen = ctx.createLinearGradient(-size * 0.5, size * 0.5, size * 0.4, -size * 0.8);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.58, pigment.petalHighlightColor);
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(-size, -size * 1.1, size * 2, size * 2.2);

    const baseShade = ctx.createRadialGradient(0, size * 0.72, 0, 0, size * 0.65, size * 0.58);
    baseShade.addColorStop(0, pigment.petalBaseShadeColor);
    baseShade.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = baseShade;
    ctx.fillRect(-size, 0, size * 2, size);

    ctx.strokeStyle = pigment.petalVeinColor;
    ctx.lineWidth = size * 0.026;
    for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, size * 0.7);
        ctx.quadraticCurveTo(side * size * 0.12, size * 0.06, side * size * 0.3, -size * 0.6);
        ctx.stroke();
    }
    ctx.strokeStyle = pigment.petalHighlightColor;
    ctx.lineWidth = size * 0.038;
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, size * 0.56);
    ctx.quadraticCurveTo(-size * 0.31, -size * 0.1, -size * 0.23, -size * 0.54);
    ctx.stroke();
    ctx.restore();
};
