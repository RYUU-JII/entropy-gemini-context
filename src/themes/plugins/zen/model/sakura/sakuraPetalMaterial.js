// Pure pigment contract shared by attached blossoms and airborne/landed petals.
// This leaf must not pull topology, asset-cache or renderer owners into the field.
export const SAKURA_FLOWER_COLORS = Object.freeze(['#F3D6DC', '#F0CED9', '#E9BBCC']);

// F4-inspired tapered lamina with a shallow cleft, not two round heart lobes.
// Blossoms and airborne/landed petals share these three stable proportions.
export const SAKURA_PETAL_SHAPES = Object.freeze([
    Object.freeze({ width: 0.44, notch: 0.91, cup: 0.07 }),
    Object.freeze({ width: 0.46, notch: 0.925, cup: 0.11 }),
    Object.freeze({ width: 0.42, notch: 0.90, cup: 0.14 }),
]);

export const traceSakuraPetalPath = (ctx, shape, project) => {
    const w = shape.width;
    ctx.moveTo(...project(0, 0));
    ctx.bezierCurveTo(...project(-w * 0.40, -0.18), ...project(-w * 0.98, -0.58), ...project(-w * 0.33, -1));
    const cleft = 1 - shape.notch;
    ctx.bezierCurveTo(...project(-w * 0.22, -1 + cleft / 3), ...project(-w * 0.11, -1 + cleft * 2 / 3), ...project(0, -shape.notch));
    ctx.bezierCurveTo(...project(w * 0.11, -1 + cleft * 2 / 3), ...project(w * 0.22, -1 + cleft / 3), ...project(w * 0.33, -1));
    ctx.bezierCurveTo(...project(w * 0.98, -0.58), ...project(w * 0.40, -0.18), ...project(0, 0));
    ctx.closePath();
};

const mix = (from, to, weight, alpha) => {
    const channels = [1, 3, 5].map((offset) => {
        const start = Number.parseInt(from.slice(offset, offset + 2), 16);
        return Math.round(start + (Number.parseInt(to.slice(offset, offset + 2), 16) - start) * weight);
    });
    return `rgba(${channels.join(',')},${alpha})`;
};

export const resolveSakuraPetalPigment = ({ color, warmth, centerDepth, lightExposure, fallAmount, translucency }) => {
    if (!/^#[0-9a-f]{6}$/i.test(color)
        || ![warmth, centerDepth, lightExposure, fallAmount, translucency]
            .every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
        throw new Error('SAKURA_PETAL_PIGMENT_INVALID');
    }
    const blush = Math.min(1, 0.34 + warmth * 0.2 + centerDepth * 0.12
        + (1 - lightExposure) * 0.08 + fallAmount * 0.04);
    const influence = 0.08 + warmth * 0.035 + (1 - lightExposure) * 0.025;
    return {
        petalRootColor: mix('#C87591', color, 0.12 + warmth * 0.06, 0.98),
        petalTipColor: mix('#F5DDE3', color, 0.28 + lightExposure * 0.06, 0.99),
        // Broad diffuse light and a folded tip restore the small-scale value
        // separation of F4. The fold and tip stay clean rose rather than dusty
        // mauve: minified crowns otherwise grey out along every blossom edge.
        // These body fields also paint the detached petals;
        // the older radial comparison material keeps its existing pigments.
        petalBodyLightColor: mix('#FFF7F6', color, 0.26 + influence * 0.3, 0.995),
        petalBodyMidColor: mix('#FFE5ED', color, 0.4 + influence * 0.2, 0.99),
        petalBodyFoldColor: mix('#E2B2C1', color, 0.30 + warmth * 0.04, 0.97),
        petalBodyTipColor: mix('#CE8AA0', color, 0.40 + warmth * 0.04, 0.95),
        petalLuminousColor: mix('#F5E0E4', color, influence * 0.42, 0.98 - fallAmount * 0.04),
        petalMidColor: mix('#EFC6D4', color, influence, 0.97 - fallAmount * 0.055),
        petalInnerTintColor: mix('#F1D4DC', color, blush * 0.16, 0.97 - fallAmount * 0.055),
        petalEdgeColor: mix('#CD91A8', color, influence * 0.8, 0.55 - fallAmount * 0.06),
        petalDeepEdgeColor: mix('#AF768C', color, influence * 0.48, 0.38 + centerDepth * 0.07 + (1 - lightExposure) * 0.04),
        petalBoundaryColor: mix('#D184A0', '#B95C82', 0.4 + centerDepth * 0.12, 0.14 + centerDepth * 0.08 + (1 - lightExposure) * 0.04),
        petalBaseShadeColor: mix('#F1A8BA', '#D67194', 0.36 + centerDepth * 0.14, 0.16 + centerDepth * 0.08 + (1 - lightExposure) * 0.04),
        petalVeinColor: mix('#C86F91', '#DFA2B4', 0.42, 0.12 + centerDepth * 0.08 + translucency * 0.04),
        petalHighlightColor: `rgba(248,229,233,${0.12 + lightExposure * 0.08})`,
    };
};

// A small warm throat, broad diffuse light and a shaded fold. The light belongs
// to the body, not a glossy rim; attached and falling petals share this bake.
export const createSakuraPetalBodyGradient = (ctx, pigment, ...geometry) => {
    const gradient = ctx.createLinearGradient(...geometry);
    gradient.addColorStop(0, pigment.petalRootColor);
    gradient.addColorStop(0.12, pigment.petalBodyLightColor);
    gradient.addColorStop(0.54, pigment.petalBodyMidColor);
    gradient.addColorStop(0.84, pigment.petalBodyFoldColor);
    gradient.addColorStop(1, pigment.petalBodyTipColor);
    return gradient;
};

export const createSakuraPetalGradient = (ctx, pigment, ...geometry) => {
    const gradient = ctx.createRadialGradient(...geometry);
    gradient.addColorStop(0, pigment.petalLuminousColor);
    gradient.addColorStop(0.42, pigment.petalInnerTintColor);
    gradient.addColorStop(0.66, pigment.petalMidColor);
    gradient.addColorStop(0.84, pigment.petalEdgeColor);
    gradient.addColorStop(1, pigment.petalDeepEdgeColor);
    return gradient;
};
