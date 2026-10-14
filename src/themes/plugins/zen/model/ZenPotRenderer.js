import {
    beginClassicPotBodyPath,
    beginRoundedRectPath,
} from './ZenPotPathBuilders.js';
import {
    beginZenPotEdgePath,
    beginZenPotSurfacePath,
    resolveZenPotGeometry,
} from './ZenPotGeometry.js';
import {
    beginZenPotShapePath,
    createZenPotEllipseShape as createEllipseShape,
    createZenPotRectBounds as createRectBounds,
    createZenPotRectShape as createRectShape,
    createZenPotRoundRectShape as createRoundRectShape,
    getZenPotShapeBounds,
    mergeZenPotBounds as mergeBounds,
    ZEN_POT_FULL_ARC as FULL_ARC,
} from './ZenPotShapes.js';
import {
    ZEN_HOME_FRAME_GARDEN_BED_POT_STYLE,
} from './ZenPotStyleIds.js';
import {
    ZEN_HOME_GARDEN_BED_COLORS,
} from './bonsai/rendering/zenHomeGardenBedGeometry.js';

export { beginZenPotShapePath } from './ZenPotShapes.js';
export { ZEN_HOME_FRAME_GARDEN_BED_POT_STYLE } from './ZenPotStyleIds.js';

const POT_MATERIAL_PRESETS = Object.freeze({
    satin_ceramic: Object.freeze({
        surfaceAlpha: 0.07,
        textureAlpha: 0.08,
        textureDensity: 0.9,
        speckleLight: 'rgba(255,255,255,0.34)',
        speckleDark: 'rgba(80,70,58,0.18)',
        washTop: 'rgba(255,255,255,0.08)',
        washBottom: 'rgba(55,45,36,0.08)',
        rimGlow: 'rgba(255,255,255,0.18)',
        soilGrainAlpha: 0.16,
    }),
    matte_stone: Object.freeze({
        surfaceAlpha: 0.12,
        textureAlpha: 0.16,
        textureDensity: 1.18,
        speckleLight: 'rgba(255,255,255,0.2)',
        speckleDark: 'rgba(55,49,42,0.2)',
        washTop: 'rgba(255,255,255,0.05)',
        washBottom: 'rgba(42,36,30,0.1)',
        rimGlow: 'rgba(255,255,255,0.12)',
        soilGrainAlpha: 0.18,
    }),
    unglazed_clay: Object.freeze({
        surfaceAlpha: 0.13,
        textureAlpha: 0.18,
        textureDensity: 1.35,
        speckleLight: 'rgba(232,197,160,0.22)',
        speckleDark: 'rgba(65,37,27,0.24)',
        washTop: 'rgba(255,217,177,0.06)',
        washBottom: 'rgba(55,31,24,0.13)',
        rimGlow: 'rgba(255,214,176,0.1)',
        soilGrainAlpha: 0.2,
    }),
    ash_glaze: Object.freeze({
        surfaceAlpha: 0.09,
        textureAlpha: 0.11,
        textureDensity: 1.02,
        speckleLight: 'rgba(220,226,219,0.18)',
        speckleDark: 'rgba(21,25,24,0.22)',
        washTop: 'rgba(255,255,255,0.04)',
        washBottom: 'rgba(8,12,12,0.13)',
        rimGlow: 'rgba(230,238,230,0.1)',
        soilGrainAlpha: 0.17,
    }),
});

const createZenPotStyle = ({
    family,
    palette,
    material = POT_MATERIAL_PRESETS.satin_ceramic,
    profile = null,
}) => Object.freeze({
    family,
    palette: Object.freeze(palette),
    material: Object.freeze(material),
    profile: profile ? Object.freeze(profile) : null,
});

const POT_STYLE_DEFS = Object.freeze({
    NAVY: Object.freeze({
        family: 'classic',
        palette: Object.freeze({
            base: '#1a237e',
            light: '#3949ab',
            dark: '#000051',
            highlight: 'rgba(255, 255, 255, 0.3)',
            rim: '#283593',
            rimInner: '#202f8a',
            edge: 'rgba(9, 14, 56, 0.65)',
            lipHighlight: 'rgba(255,255,255,0.2)',
            soilLight: '#5a4a3b',
            soilMid: '#433428',
            soilDark: '#2b2119',
            soilEdge: 'rgba(33, 24, 18, 0.5)',
            band: 'rgba(255,255,255,0.1)',
            footTop: '#23308d',
            footBottom: '#131e63',
            shadow: 'rgba(0,0,0,0.1)',
        }),
    }),
    JADE: Object.freeze({
        family: 'classic',
        palette: Object.freeze({
            base: '#2e7d32',
            light: '#66bb6a',
            dark: '#1b5e20',
            highlight: 'rgba(255, 255, 255, 0.25)',
            rim: '#43a047',
            rimInner: '#3b8f43',
            edge: 'rgba(22, 67, 24, 0.58)',
            lipHighlight: 'rgba(255,255,255,0.18)',
            soilLight: '#5f4b39',
            soilMid: '#433327',
            soilDark: '#2b2018',
            soilEdge: 'rgba(33, 24, 18, 0.5)',
            band: 'rgba(255,255,255,0.08)',
            footTop: '#2f7b3d',
            footBottom: '#1a5625',
            shadow: 'rgba(0,0,0,0.1)',
        }),
    }),
    CLAY: Object.freeze({
        family: 'classic',
        palette: Object.freeze({
            base: '#5d4037',
            light: '#8d6e63',
            dark: '#3e2723',
            highlight: 'rgba(255, 255, 255, 0.15)',
            rim: '#6d4c41',
            rimInner: '#5f4438',
            edge: 'rgba(50, 31, 28, 0.56)',
            lipHighlight: 'rgba(255,255,255,0.12)',
            soilLight: '#5a4938',
            soilMid: '#403126',
            soilDark: '#271d16',
            soilEdge: 'rgba(30, 20, 16, 0.48)',
            band: 'rgba(255,255,255,0.06)',
            footTop: '#67473d',
            footBottom: '#442b25',
            shadow: 'rgba(0,0,0,0.1)',
        }),
    }),
    'oval-celadon': Object.freeze({
        family: 'wide_oval',
        palette: Object.freeze({
            base: '#8ea198',
            light: '#dfe7e1',
            dark: '#596961',
            highlight: 'rgba(255,255,255,0.34)',
            rim: '#b6c4ba',
            rimInner: '#d3ded6',
            edge: 'rgba(73, 88, 80, 0.52)',
            lipHighlight: 'rgba(255,255,255,0.4)',
            soilLight: '#7d6048',
            soilMid: '#5c4535',
            soilDark: '#3e2f24',
            soilEdge: 'rgba(40, 29, 21, 0.42)',
            band: 'rgba(84, 100, 92, 0.28)',
            footTop: '#809188',
            footBottom: '#5a6a62',
            shadow: 'rgba(32, 39, 35, 0.14)',
        }),
    }),
    'oval-inkstone': Object.freeze({
        family: 'wide_oval',
        palette: Object.freeze({
            base: '#565e63',
            light: '#9aa3a8',
            dark: '#2d3236',
            highlight: 'rgba(255,255,255,0.16)',
            rim: '#6f787f',
            rimInner: '#8b9398',
            edge: 'rgba(20, 24, 28, 0.6)',
            lipHighlight: 'rgba(255,255,255,0.2)',
            soilLight: '#735946',
            soilMid: '#523f32',
            soilDark: '#362920',
            soilEdge: 'rgba(31, 24, 18, 0.42)',
            band: 'rgba(222, 228, 232, 0.16)',
            footTop: '#656d72',
            footBottom: '#3c4347',
            shadow: 'rgba(18, 22, 25, 0.2)',
        }),
    }),
    'rect-sandstone': Object.freeze({
        family: 'rect',
        palette: Object.freeze({
            base: '#a3886d',
            light: '#deceb8',
            dark: '#6f5946',
            highlight: 'rgba(255,255,255,0.2)',
            rim: '#c2ac8f',
            rimInner: '#d7c7b3',
            edge: 'rgba(82, 64, 50, 0.48)',
            lipHighlight: 'rgba(255,255,255,0.26)',
            soilLight: '#806148',
            soilMid: '#5a4434',
            soilDark: '#3f3025',
            soilEdge: 'rgba(39, 29, 22, 0.4)',
            band: 'rgba(112, 86, 63, 0.22)',
            footTop: '#977d63',
            footBottom: '#685241',
            shadow: 'rgba(50, 40, 31, 0.14)',
        }),
    }),
    'slim-oval-porcelain': Object.freeze({
        family: 'slim_oval',
        palette: Object.freeze({
            base: '#d4cbc0',
            light: '#faf7f1',
            dark: '#a29788',
            highlight: 'rgba(255,255,255,0.5)',
            rim: '#ece4d8',
            rimInner: '#f7f2ea',
            edge: 'rgba(113, 101, 89, 0.34)',
            lipHighlight: 'rgba(255,255,255,0.52)',
            soilLight: '#7a5c45',
            soilMid: '#553f30',
            soilDark: '#392b20',
            soilEdge: 'rgba(38, 28, 21, 0.36)',
            band: 'rgba(131, 113, 95, 0.14)',
            footTop: '#d0c2b3',
            footBottom: '#aa9a88',
            shadow: 'rgba(44, 36, 32, 0.11)',
        }),
    }),
    'shallow-warm-stone': createZenPotStyle({
        family: 'shallow_oval',
        material: POT_MATERIAL_PRESETS.matte_stone,
        palette: {
            base: '#B5AEA1',
            light: '#D9D2C4',
            dark: '#756F65',
            highlight: 'rgba(255,255,255,0.2)',
            rim: '#C8C0B1',
            rimInner: '#8E8678',
            edge: 'rgba(70, 63, 54, 0.42)',
            lipHighlight: 'rgba(255,255,255,0.22)',
            soilLight: '#77604A',
            soilMid: '#514031',
            soilDark: '#35291F',
            soilEdge: 'rgba(35, 27, 20, 0.38)',
            band: 'rgba(93, 84, 72, 0.1)',
            footTop: '#A49B8D',
            footBottom: '#71695E',
            shadow: 'rgba(39, 34, 29, 0.14)',
        },
    }),
    [ZEN_HOME_FRAME_GARDEN_BED_POT_STYLE]: createZenPotStyle({
        family: 'frame_bed',
        materialStyle: 'glazed_ceramic',
        material: POT_MATERIAL_PRESETS.satin_ceramic,
        profile: {
            topWidthFactor: 1.78,
            rearLipHeightFactor: 0.1,
            soilDepthFactor: 0.24,
            sideFaceWidthFactor: 0.045,
        },
        palette: {
            base: ZEN_HOME_GARDEN_BED_COLORS.frameTop,
            light: '#F5F3EB',
            dark: '#999589',
            highlight: 'rgba(255,255,255,0.26)',
            rim: '#E8E5DB',
            rimInner: ZEN_HOME_GARDEN_BED_COLORS.frameInner,
            edge: 'rgba(71, 66, 58, 0.34)',
            lipHighlight: 'rgba(255,255,255,0.3)',
            soilLight: '#7B674D',
            soilMid: ZEN_HOME_GARDEN_BED_COLORS.soil,
            soilDark: '#34291E',
            soilEdge: 'rgba(38, 29, 21, 0.4)',
            band: 'rgba(91, 84, 72, 0.07)',
            footTop: '#B7B3A8',
            footBottom: '#888378',
            shadow: 'rgba(38, 34, 29, 0.12)',
        },
    }),
    'shallow-iron-ash': createZenPotStyle({
        family: 'shallow_oval',
        material: POT_MATERIAL_PRESETS.ash_glaze,
        palette: {
            base: '#4A504D',
            light: '#818985',
            dark: '#252B2A',
            highlight: 'rgba(255,255,255,0.12)',
            rim: '#626A66',
            rimInner: '#3B4240',
            edge: 'rgba(13, 18, 18, 0.58)',
            lipHighlight: 'rgba(227,237,231,0.16)',
            soilLight: '#705944',
            soilMid: '#49382A',
            soilDark: '#2F241B',
            soilEdge: 'rgba(24, 18, 14, 0.42)',
            band: 'rgba(218, 226, 220, 0.08)',
            footTop: '#545C58',
            footBottom: '#2E3432',
            shadow: 'rgba(16, 19, 18, 0.2)',
        },
    }),
    'oval-tokoname-clay': createZenPotStyle({
        family: 'wide_oval',
        material: POT_MATERIAL_PRESETS.unglazed_clay,
        palette: {
            base: '#8C5B46',
            light: '#B98462',
            dark: '#58372B',
            highlight: 'rgba(255,231,201,0.14)',
            rim: '#9E6C51',
            rimInner: '#704936',
            edge: 'rgba(62, 36, 27, 0.48)',
            lipHighlight: 'rgba(255,224,190,0.14)',
            soilLight: '#72553E',
            soilMid: '#4E3929',
            soilDark: '#32241A',
            soilEdge: 'rgba(31, 21, 15, 0.38)',
            band: 'rgba(75, 43, 31, 0.12)',
            footTop: '#80533F',
            footBottom: '#56362A',
            shadow: 'rgba(56, 36, 28, 0.16)',
        },
    }),
    'oval-moss-gray': createZenPotStyle({
        family: 'wide_oval',
        material: POT_MATERIAL_PRESETS.matte_stone,
        palette: {
            base: '#737A6D',
            light: '#A9B0A1',
            dark: '#4B5148',
            highlight: 'rgba(240,246,232,0.16)',
            rim: '#8B927F',
            rimInner: '#626A5F',
            edge: 'rgba(45, 52, 43, 0.45)',
            lipHighlight: 'rgba(244,250,238,0.18)',
            soilLight: '#746047',
            soilMid: '#51402F',
            soilDark: '#34281D',
            soilEdge: 'rgba(32, 25, 18, 0.38)',
            band: 'rgba(42, 49, 39, 0.1)',
            footTop: '#707867',
            footBottom: '#4B5248',
            shadow: 'rgba(30, 35, 29, 0.16)',
        },
    }),
    'rect-river-stone': createZenPotStyle({
        family: 'rect',
        material: POT_MATERIAL_PRESETS.matte_stone,
        palette: {
            base: '#8E918B',
            light: '#C6C8BF',
            dark: '#5B5F5A',
            highlight: 'rgba(255,255,255,0.16)',
            rim: '#AAACA3',
            rimInner: '#747870',
            edge: 'rgba(65, 68, 63, 0.42)',
            lipHighlight: 'rgba(255,255,255,0.18)',
            soilLight: '#755C45',
            soilMid: '#4D3A2B',
            soilDark: '#312419',
            soilEdge: 'rgba(32, 23, 17, 0.38)',
            band: 'rgba(72, 75, 70, 0.1)',
            footTop: '#82867E',
            footBottom: '#5B5F58',
            shadow: 'rgba(35, 38, 35, 0.16)',
        },
    }),
});

const OVAL_PROFILES = Object.freeze({
    wide_oval: Object.freeze({
        topWidthFactor: 1.12,
        midWidthFactor: 1.09,
        bottomWidthFactor: 1.01,
        rimHeightFactor: 0.128,
        bodyEdgeYFactor: 0.036,
        bodyBottomYFactor: 0.061,
        shoulderCurveFactor: 0.22,
        bellyCurveFactor: 0.06,
        shadowWidthFactor: 0.68,
        shadowHeightFactor: 0.05,
        highlightOffsetXFactor: -0.18,
        highlightOffsetYFactor: -0.46,
        highlightRadiusFactor: 0.42,
        footMode: 'none',
        frontClipStartFactor: 0.42,
        soilInsetFactor: 0.84,
        soilHeightFactor: 0.72,
        soilFrontInsetFactor: 0.8,
        showBand: false,
    }),
    slim_oval: Object.freeze({
        topWidthFactor: 1.2,
        midWidthFactor: 1.16,
        bottomWidthFactor: 1.06,
        rimHeightFactor: 0.106,
        bodyEdgeYFactor: 0.026,
        bodyBottomYFactor: 0.042,
        shoulderCurveFactor: 0.18,
        bellyCurveFactor: 0.046,
        shadowWidthFactor: 0.7,
        shadowHeightFactor: 0.045,
        highlightOffsetXFactor: -0.16,
        highlightOffsetYFactor: -0.42,
        highlightRadiusFactor: 0.4,
        footMode: 'none',
        frontClipStartFactor: 0.4,
        soilInsetFactor: 0.88,
        soilHeightFactor: 0.67,
        soilFrontInsetFactor: 0.84,
        showBand: false,
    }),
    shallow_oval: Object.freeze({
        topWidthFactor: 1.36,
        midWidthFactor: 1.29,
        bottomWidthFactor: 1.16,
        rimHeightFactor: 0.15,
        bodyEdgeYFactor: 0.032,
        bodyBottomYFactor: 0.068,
        shoulderCurveFactor: 0.13,
        bellyCurveFactor: 0.04,
        shadowWidthFactor: 0.9,
        shadowHeightFactor: 0.048,
        highlightOffsetXFactor: -0.18,
        highlightOffsetYFactor: -0.36,
        highlightRadiusFactor: 0.36,
        footMode: 'ring',
        ringTopFactor: 0.024,
        ringHeightFactor: 0.038,
        ringTopWidthFactor: 0.8,
        ringBottomWidthFactor: 0.72,
        ringBellyFactor: 0.008,
        frontClipStartFactor: 0.36,
        soilInsetFactor: 0.9,
        soilHeightFactor: 1.08,
        soilFrontInsetFactor: 0.86,
        showBand: false,
    }),
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const DEFAULT_POT_STYLE_KEY = 'shallow-warm-stone';

const hashPotUnit = (value = '') => {
    const source = String(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000003) / 1000003;
};

const resolvePotStyleKey = (type = DEFAULT_POT_STYLE_KEY) => {
    if (typeof type !== 'string') {
        throw new Error('ZEN_BONSAI_POT_STYLE_INVALID:missing');
    }
    const trimmed = type.trim();
    if (!trimmed) {
        throw new Error('ZEN_BONSAI_POT_STYLE_INVALID:missing');
    }
    if (POT_STYLE_DEFS[trimmed]) {
        return trimmed;
    }
    throw new Error(`ZEN_BONSAI_POT_STYLE_INVALID:${trimmed}`);
};

const resolvePotStyle = (type = DEFAULT_POT_STYLE_KEY) => (
    POT_STYLE_DEFS[resolvePotStyleKey(type)]
);

export const DEFAULT_ZEN_BONSAI_POT_STYLE = DEFAULT_POT_STYLE_KEY;

const resolvePotMaterialProfile = (style) => Object.freeze({
    ...POT_MATERIAL_PRESETS.satin_ceramic,
    ...(style?.material || {}),
});

const createClassicPotModel = (width, height, styleKey, style) => {
    const palette = style.palette;
    const halfWidth = width / 2;
    const rimHeight = height * 0.176;
    const footHeight = height * 0.12;
    const bodyBottomY = height * 0.218;
    const bodyEdgeY = height * 0.068;
    const bodyY = -height + rimHeight * 0.5;
    const topWidth = width;
    const bottomWidth = width * 0.85;
    const rimY = -height;
    const footWidth = width * 0.15;
    const footOffset = width * 0.25;
    const footY = bodyBottomY - footHeight * 0.34;
    const shadowShape = createEllipseShape({
        cx: 0,
        cy: bodyBottomY + footHeight * 0.62,
        rx: width * 0.52,
        ry: height * 0.055,
    });
    const soilSurfaceShape = createEllipseShape({
        cx: 0,
        cy: rimY + (rimHeight * 0.24),
        rx: topWidth * 0.392,
        ry: Math.max(1.2, rimHeight * 0.62),
    });
    const rootSpreadY = Math.max(5.8, rimHeight * 1.08);
    const rootClipShape = createEllipseShape({
        cx: 0,
        cy: soilSurfaceShape.cy + (rimHeight * 0.04),
        rx: soilSurfaceShape.rx * 1.05,
        ry: Math.max(rootSpreadY * 0.84, soilSurfaceShape.ry * 1.7),
    });
    const frontWallClipShape = createRectShape({
        x: -width,
        y: rimY + (rimHeight * 0.44),
        width: width * 2,
        height: height * 1.6,
    });
    const rimOuterShape = createEllipseShape({
        cx: 0,
        cy: rimY,
        rx: topWidth * 0.5,
        ry: rimHeight,
    });
    const potBounds = mergeBounds(
        createRectBounds(-topWidth * 0.5, -height, topWidth * 0.5, bodyBottomY),
        createRectBounds(
            -footOffset - (footWidth * 0.5),
            footY,
            footOffset + (footWidth * 0.5),
            footY + footHeight,
        ),
        getZenPotShapeBounds(rimOuterShape),
    );

    return {
        styleKey,
        style,
        palette,
        material: resolvePotMaterialProfile(style),
        family: style.family,
        profile: null,
        baseWidth: width,
        baseHeight: height,
        metrics: {
            halfWidth,
            rimHeight,
            footHeight,
            bodyBottomY,
            bodyEdgeY,
            bodyY,
            topWidth,
            bottomWidth,
            rimY,
            footWidth,
            footOffset,
            footY,
        },
        shapes: {
            shadowShape,
            soilSurfaceShape,
            rootClipShape,
            frontWallClipShape,
            rimOuterShape,
        },
        rootZone: {
            rimY,
            spreadX: soilSurfaceShape.rx,
            spreadY: rootSpreadY,
            clipShape: rootClipShape,
        },
        potBounds,
        shadowBounds: getZenPotShapeBounds(shadowShape),
        visualBounds: mergeBounds(potBounds, getZenPotShapeBounds(shadowShape)),
    };
};

const resolveFootBoundsFromProfile = (width, height, profile) => {
    const bodyBottomY = height * profile.bodyBottomYFactor;
    if (profile.footMode === 'pedestal') {
        const topY = bodyBottomY + (height * profile.pedestalTopFactor);
        const footHeight = height * profile.pedestalHeightFactor;
        const bottomHalfWidth = width * profile.pedestalBottomWidthFactor;
        return createRectBounds(
            -bottomHalfWidth * 0.5,
            topY,
            bottomHalfWidth * 0.5,
            topY + footHeight,
        );
    }
    if (profile.footMode === 'ring') {
        const topY = bodyBottomY + (height * profile.ringTopFactor);
        const footHeight = height * profile.ringHeightFactor;
        const bottomHalfWidth = width * profile.ringBottomWidthFactor;
        const belly = height * (profile.ringBellyFactor || 0.03);
        return createRectBounds(
            -bottomHalfWidth * 0.5,
            topY,
            bottomHalfWidth * 0.5,
            topY + footHeight + belly,
        );
    }
    return createRectBounds(0, 0, 0, 0);
};

const createOvalPotModel = (width, height, styleKey, style, profile) => {
    const palette = style.palette;
    const topWidth = width * profile.topWidthFactor;
    const midWidth = width * (profile.midWidthFactor || ((profile.topWidthFactor + profile.bottomWidthFactor) * 0.5));
    const bottomWidth = width * profile.bottomWidthFactor;
    const rimHeight = height * profile.rimHeightFactor;
    const bodyEdgeY = height * profile.bodyEdgeYFactor;
    const bodyBottomY = height * profile.bodyBottomYFactor;
    const rimY = -height;
    const frontWallTopArcDepth = rimHeight * 0.92;
    const shadowShape = createEllipseShape({
        cx: 0,
        cy: bodyBottomY + (height * 0.09),
        rx: width * (profile.shadowWidthFactor * 0.92),
        ry: Math.max(1.2, height * (profile.shadowHeightFactor * 0.74)),
    });
    const soilSurfaceShape = createEllipseShape({
        cx: 0,
        cy: rimY + (rimHeight * 0.22),
        rx: topWidth * profile.soilInsetFactor * 0.47,
        ry: Math.max(1.2, rimHeight * profile.soilHeightFactor * 0.56),
    });
    const rootSpreadY = Math.max(5.8, rimHeight * 1.14);
    const rootClipShape = createEllipseShape({
        cx: 0,
        cy: soilSurfaceShape.cy + (rimHeight * 0.02),
        rx: soilSurfaceShape.rx * 1.04,
        ry: Math.max(rootSpreadY * 0.86, soilSurfaceShape.ry * 1.86),
    });
    const frontWallClipShape = createRectShape({
        x: -topWidth,
        y: rimY + (rimHeight * profile.frontClipStartFactor),
        width: topWidth * 2,
        height: height * 1.7,
    });
    const potBounds = mergeBounds(
        createRectBounds(
            -Math.max(topWidth, midWidth, bottomWidth) * 0.5,
            -height,
            Math.max(topWidth, midWidth, bottomWidth) * 0.5,
            bodyBottomY,
        ),
        getZenPotShapeBounds(createEllipseShape({
            cx: 0,
            cy: rimY,
            rx: topWidth * 0.5,
            ry: rimHeight,
        })),
        resolveFootBoundsFromProfile(width, height, profile),
    );

    const model = {
        styleKey,
        style,
        palette,
        material: resolvePotMaterialProfile(style),
        family: style.family,
        profile,
        baseWidth: width,
        baseHeight: height,
        metrics: {
            topWidth,
            midWidth,
            bottomWidth,
            rimHeight,
            bodyEdgeY,
            bodyBottomY,
            rimY,
            frontWallTopArcDepth,
        },
        shapes: {
            shadowShape,
            soilSurfaceShape,
            rootClipShape,
            frontWallClipShape,
        },
        rootZone: {
            rimY,
            spreadX: soilSurfaceShape.rx,
            spreadY: rootSpreadY,
            clipShape: rootClipShape,
        },
        potBounds,
        shadowBounds: getZenPotShapeBounds(shadowShape),
        visualBounds: mergeBounds(potBounds, getZenPotShapeBounds(shadowShape)),
    };
    return {
        ...model,
        geometry: resolveZenPotGeometry(model),
    };
};

const createRectPotModel = (width, height, styleKey, style) => {
    const palette = style.palette;
    const rimY = -height;
    const bodyTopY = rimY + (height * 0.08);
    const bodyBottomY = height * 0.18;
    const bodyHeight = bodyBottomY - bodyTopY;
    const rimHeight = height * 0.12;
    const cornerRadius = Math.max(4, width * 0.05);
    const innerInset = Math.max(5, width * 0.07);
    const shadowShape = createEllipseShape({
        cx: 0,
        cy: bodyBottomY + (height * 0.08),
        rx: width * 0.56,
        ry: height * 0.05,
    });
    const soilSurfaceShape = createRoundRectShape({
        x: -(width * 0.5) + (innerInset * 1.3),
        y: rimY + (rimHeight * 0.42),
        width: width - (innerInset * 2.6),
        height: Math.max(1.2, rimHeight * 0.42),
        radius: Math.max(2, cornerRadius - 4),
    });
    const rootSpreadY = Math.max(5.8, soilSurfaceShape.height * 1.12);
    const rootClipShape = createRoundRectShape({
        x: -(width * 0.5) + (innerInset * 1.15),
        y: rimY + (rimHeight * 0.26),
        width: width - (innerInset * 2.3),
        height: Math.max(rootSpreadY * 0.92, rimHeight * 0.96),
        radius: Math.max(2, cornerRadius - 4),
    });
    const frontWallClipShape = createRectShape({
        x: -width,
        y: rimY + (height * 0.12),
        width: width * 2,
        height: height * 1.5,
    });
    const potBounds = mergeBounds(
        createRectBounds(-(width * 0.5), bodyTopY, width * 0.5, bodyBottomY),
        createRectBounds(-(width * 0.5), rimY, width * 0.5, rimY + rimHeight),
    );

    return {
        styleKey,
        style,
        palette,
        material: resolvePotMaterialProfile(style),
        family: style.family,
        profile: null,
        baseWidth: width,
        baseHeight: height,
        metrics: {
            rimY,
            bodyTopY,
            bodyBottomY,
            bodyHeight,
            rimHeight,
            cornerRadius,
            innerInset,
        },
        shapes: {
            shadowShape,
            soilSurfaceShape,
            rootClipShape,
            frontWallClipShape,
        },
        rootZone: {
            rimY,
            spreadX: soilSurfaceShape.width * 0.5,
            spreadY: rootSpreadY,
            clipShape: rootClipShape,
        },
        potBounds,
        shadowBounds: getZenPotShapeBounds(shadowShape),
        visualBounds: mergeBounds(potBounds, getZenPotShapeBounds(shadowShape)),
    };
};

const createFrameBedPotModel = (width, height, styleKey, style) => {
    const palette = style.palette;
    const profile = style.profile;
    const topWidth = width * profile.topWidthFactor;
    const rimY = -height;
    const rearLipHeight = Math.max(2, height * profile.rearLipHeightFactor);
    const soilDepth = Math.max(5.8, height * profile.soilDepthFactor);
    const sideFaceWidth = Math.max(3, topWidth * profile.sideFaceWidthFactor);
    const bodyBottomY = 0;
    const soilSurfaceShape = createRectShape({
        x: -(topWidth * 0.5) + sideFaceWidth,
        y: rimY - (soilDepth * 0.18),
        width: topWidth - (sideFaceWidth * 2),
        height: soilDepth,
    });
    const rootSpreadY = Math.max(5.8, soilDepth * 0.72);
    const rootClipShape = createRectShape({
        x: soilSurfaceShape.x,
        y: rimY - (rootSpreadY * 0.7),
        width: soilSurfaceShape.width,
        height: rootSpreadY * 2.1,
    });
    const frontWallClipShape = createRectShape({
        x: -(topWidth * 0.5),
        y: rimY,
        width: topWidth,
        height,
    });
    const potBounds = createRectBounds(
        -(topWidth * 0.5),
        rimY - rearLipHeight,
        topWidth * 0.5,
        bodyBottomY,
    );
    const shadowShape = createRectShape({
        x: 0,
        y: bodyBottomY,
        width: 0,
        height: 0,
    });

    return {
        styleKey,
        style,
        palette,
        materialStyle: style.materialStyle || 'glazed_ceramic',
        material: resolvePotMaterialProfile(style),
        family: style.family,
        profile,
        baseWidth: width,
        baseHeight: height,
        metrics: {
            topWidth,
            rimY,
            rearLipHeight,
            soilDepth,
            sideFaceWidth,
            bodyBottomY,
        },
        shapes: {
            shadowShape,
            soilSurfaceShape,
            rootClipShape,
            frontWallClipShape,
        },
        rootZone: {
            rimY,
            spreadX: soilSurfaceShape.width * 0.5,
            spreadY: rootSpreadY,
            clipShape: rootClipShape,
        },
        potBounds,
        shadowBounds: getZenPotShapeBounds(shadowShape),
        visualBounds: potBounds,
    };
};

export const resolveZenPotRenderModel = ({
    width,
    height,
    type = DEFAULT_ZEN_BONSAI_POT_STYLE,
} = {}) => {
    const styleKey = resolvePotStyleKey(
        type === undefined || type === null ? DEFAULT_ZEN_BONSAI_POT_STYLE : type,
    );
    const style = resolvePotStyle(styleKey);
    const safeWidth = Math.max(12, Number(width) || 0);
    const safeHeight = Math.max(8, Number(height) || 0);

    if (style.family === 'classic') {
        return createClassicPotModel(safeWidth, safeHeight, styleKey, style);
    }
    if (style.family === 'rect') {
        return createRectPotModel(safeWidth, safeHeight, styleKey, style);
    }
    if (style.family === 'frame_bed') {
        return createFrameBedPotModel(safeWidth, safeHeight, styleKey, style);
    }

    const profile = style.profile || OVAL_PROFILES[style.family] || OVAL_PROFILES.wide_oval;
    return createOvalPotModel(safeWidth, safeHeight, styleKey, style, profile);
};

const drawPotSurfaceTexture = ({
    ctx,
    model,
    seed,
    bounds,
    beginPath,
}) => {
    const material = model.material || POT_MATERIAL_PRESETS.satin_ceramic;
    const textureAlpha = clamp(Number(material.textureAlpha) || 0, 0, 1);
    const surfaceAlpha = clamp(Number(material.surfaceAlpha) || 0, 0, 1);
    if (textureAlpha <= 0 && surfaceAlpha <= 0) {
        return;
    }
    const safeBounds = bounds || createRectBounds(
        -(model.baseWidth || 80) * 0.5,
        -(model.baseHeight || 32),
        (model.baseWidth || 80) * 0.5,
        (model.baseHeight || 32) * 0.18,
    );
    const width = Math.max(1, safeBounds.width);
    const height = Math.max(1, safeBounds.height);
    const density = clamp(Number(material.textureDensity) || 1, 0.2, 2.4);
    const speckleCount = Math.min(72, Math.max(10, Math.round((width * height * 0.012) * density)));

    ctx.save();
    beginPath();
    ctx.clip();

    if (surfaceAlpha > 0) {
        const wash = ctx.createLinearGradient(
            safeBounds.minX,
            safeBounds.minY,
            safeBounds.maxX,
            safeBounds.maxY,
        );
        wash.addColorStop(0, material.washTop || 'rgba(255,255,255,0.04)');
        wash.addColorStop(1, material.washBottom || 'rgba(0,0,0,0.06)');
        ctx.globalAlpha = surfaceAlpha;
        ctx.fillStyle = wash;
        ctx.fillRect(safeBounds.minX, safeBounds.minY, width, height);
    }

    for (let index = 0; index < speckleCount; index += 1) {
        const x = safeBounds.minX + (hashPotUnit(`${seed}|speckle_x|${index}`) * width);
        const y = safeBounds.minY + (hashPotUnit(`${seed}|speckle_y|${index}`) * height);
        const scale = 0.46 + (hashPotUnit(`${seed}|speckle_scale|${index}`) * 0.92);
        const radiusX = Math.max(0.18, model.baseHeight * 0.006 * scale);
        const radiusY = Math.max(0.12, model.baseHeight * 0.004 * scale);
        ctx.globalAlpha = textureAlpha * (0.34 + (hashPotUnit(`${seed}|speckle_alpha|${index}`) * 0.54));
        ctx.fillStyle = hashPotUnit(`${seed}|speckle_tone|${index}`) > 0.56
            ? (material.speckleLight || 'rgba(255,255,255,0.18)')
            : (material.speckleDark || 'rgba(48,40,32,0.18)');
        ctx.beginPath();
        ctx.ellipse(
            x,
            y,
            radiusX,
            radiusY,
            hashPotUnit(`${seed}|speckle_angle|${index}`) * Math.PI,
            0,
            FULL_ARC,
        );
        ctx.fill();
    }

    ctx.restore();
};

const drawPotRimGlow = ({
    ctx,
    model,
    shape,
    lineWidth = 1,
}) => {
    const material = model.material || POT_MATERIAL_PRESETS.satin_ceramic;
    if (!shape || !material.rimGlow) {
        return;
    }
    ctx.save();
    ctx.strokeStyle = material.rimGlow;
    ctx.lineWidth = Math.max(0.5, lineWidth);
    beginZenPotShapePath(ctx, shape);
    ctx.stroke();
    ctx.restore();
};

const strokeInsetEllipseArc = (ctx, shape, inset = 0) => {
    if (shape?.kind !== 'ellipse') {
        beginZenPotShapePath(ctx, shape);
        ctx.stroke();
        return;
    }

    ctx.beginPath();
    ctx.ellipse(
        shape.cx,
        shape.cy,
        shape.rx,
        shape.ry,
        shape.rotation || 0,
        (shape.start ?? 0) + inset,
        (shape.end ?? FULL_ARC) - inset,
        Boolean(shape.anticlockwise),
    );
    ctx.stroke();
};

const drawOvalBackRimDetail = ({
    ctx,
    palette,
    edges,
    topWidth,
    rimHeight,
    rimY,
}) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(0.58, rimHeight * 0.12);
    beginZenPotEdgePath(ctx, edges.rimBack);
    ctx.stroke();

    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = palette.lipHighlight;
    ctx.lineWidth = Math.max(0.42, rimHeight * 0.065);
    ctx.beginPath();
    ctx.ellipse(
        0,
        rimY - (rimHeight * 0.48),
        topWidth * 0.42,
        rimHeight * 0.26,
        0,
        Math.PI + 0.18,
        (Math.PI * 2) - 0.18,
        false,
    );
    ctx.stroke();
    ctx.restore();
};

const drawPotSoilTexture = ({
    ctx,
    model,
    seed,
    soilShape,
}) => {
    const bounds = getZenPotShapeBounds(soilShape);
    if (!bounds.width || !bounds.height) {
        return;
    }
    const material = model.material || POT_MATERIAL_PRESETS.satin_ceramic;
    const palette = model.palette;
    const grainAlpha = clamp(Number(material.soilGrainAlpha) || 0.14, 0, 0.34);
    const count = Math.min(52, Math.max(14, Math.round(bounds.width * bounds.height * 0.08)));

    ctx.save();
    beginZenPotShapePath(ctx, soilShape);
    ctx.clip();
    for (let index = 0; index < count; index += 1) {
        const x = bounds.minX + (hashPotUnit(`${seed}|soil_x|${index}`) * bounds.width);
        const y = bounds.minY + (hashPotUnit(`${seed}|soil_y|${index}`) * bounds.height);
        const edge = Math.abs((x - ((bounds.minX + bounds.maxX) * 0.5)) / Math.max(1, bounds.width * 0.5));
        const scale = 0.56 + (hashPotUnit(`${seed}|soil_scale|${index}`) * 0.92);
        ctx.globalAlpha = grainAlpha * (0.42 + ((1 - edge) * 0.5));
        ctx.fillStyle = hashPotUnit(`${seed}|soil_tone|${index}`) > 0.5
            ? (palette.soilLight || '#725640')
            : (palette.soilDark || '#30231A');
        ctx.beginPath();
        ctx.ellipse(
            x,
            y,
            Math.max(0.22, model.baseHeight * 0.008 * scale),
            Math.max(0.14, model.baseHeight * 0.005 * scale),
            hashPotUnit(`${seed}|soil_angle|${index}`) * Math.PI,
            0,
            FULL_ARC,
        );
        ctx.fill();
    }
    ctx.restore();
};

const drawClassicPot = (ctx, model) => {
    const {
        palette,
        baseWidth: width,
        baseHeight: height,
        metrics: {
            halfWidth,
            rimHeight,
            footHeight,
            bodyBottomY,
            bodyEdgeY,
            bodyY,
            topWidth,
            rimY,
            footWidth,
            footOffset,
            footY,
        },
        shapes: {
            shadowShape,
            soilSurfaceShape,
            rimOuterShape,
        },
    } = model;

    ctx.fillStyle = palette.shadow;
    beginZenPotShapePath(ctx, shadowShape);
    ctx.fill();

    const bodyGradient = ctx.createLinearGradient(-halfWidth, bodyY, halfWidth, bodyY);
    bodyGradient.addColorStop(0, palette.dark);
    bodyGradient.addColorStop(0.2, palette.light);
    bodyGradient.addColorStop(0.5, palette.base);
    bodyGradient.addColorStop(0.9, palette.dark);
    bodyGradient.addColorStop(1, palette.dark);

    ctx.fillStyle = bodyGradient;
    beginClassicPotBodyPath(ctx, width, height, bodyEdgeY, bodyBottomY);
    ctx.fill();

    const specGradient = ctx.createRadialGradient(
        -width * 0.2,
        -height * 0.6,
        0,
        -width * 0.2,
        -height * 0.6,
        width * 0.5,
    );
    specGradient.addColorStop(0, palette.highlight);
    specGradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGradient;
    beginClassicPotBodyPath(ctx, width, height, bodyEdgeY, bodyBottomY);
    ctx.fill();
    drawPotSurfaceTexture({
        ctx,
        model,
        seed: `${model.styleKey}|classic_body`,
        bounds: createRectBounds(-topWidth * 0.54, -height, topWidth * 0.54, bodyBottomY),
        beginPath: () => beginClassicPotBodyPath(ctx, width, height, bodyEdgeY, bodyBottomY),
    });

    ctx.fillStyle = palette.dark;
    beginRoundedRectPath(ctx, -footOffset - (footWidth * 0.5), footY, footWidth, footHeight, 2);
    ctx.fill();
    beginRoundedRectPath(ctx, footOffset - (footWidth * 0.5), footY, footWidth, footHeight, 2);
    ctx.fill();

    ctx.fillStyle = palette.rim;
    beginZenPotShapePath(ctx, rimOuterShape);
    ctx.fill();
    drawPotRimGlow({
        ctx,
        model,
        shape: rimOuterShape,
        lineWidth: Math.max(0.5, rimHeight * 0.12),
    });

    ctx.fillStyle = palette.rimInner;
    ctx.beginPath();
    ctx.ellipse(
        0,
        rimY + (rimHeight * 0.05),
        topWidth * 0.44,
        rimHeight * 0.78,
        0,
        0,
        Math.PI * 2,
    );
    ctx.fill();

    const soilGradient = ctx.createRadialGradient(
        0,
        soilSurfaceShape.cy - (soilSurfaceShape.ry * 0.36),
        Math.max(0.4, soilSurfaceShape.ry * 0.12),
        0,
        soilSurfaceShape.cy,
        soilSurfaceShape.rx * 1.02,
    );
    soilGradient.addColorStop(0, palette.soilLight);
    soilGradient.addColorStop(0.48, palette.soilMid);
    soilGradient.addColorStop(1, palette.soilDark);
    ctx.fillStyle = soilGradient;
    beginZenPotShapePath(ctx, soilSurfaceShape);
    ctx.fill();
    drawPotSoilTexture({
        ctx,
        model,
        seed: `${model.styleKey}|classic_soil`,
        soilShape: soilSurfaceShape,
    });

    ctx.fillStyle = palette.soilEdge || 'rgba(0,0,0,0.12)';
    [
        { x: -0.28, y: -0.05, r: 0.1 },
        { x: -0.08, y: 0.04, r: 0.08 },
        { x: 0.13, y: -0.04, r: 0.11 },
        { x: 0.3, y: 0.03, r: 0.07 },
    ].forEach((dot) => {
        ctx.beginPath();
        ctx.arc(
            dot.x * topWidth * 0.5,
            rimY + (dot.y * rimHeight * 1.4),
            Math.max(0.7, dot.r * rimHeight * 2.2),
            0,
            Math.PI * 2,
        );
        ctx.fill();
    });
};

const drawClassicPotFrontOverlay = (ctx, model) => {
    const {
        palette,
        baseWidth: width,
        baseHeight: height,
        metrics: {
            halfWidth,
            rimHeight,
            bodyBottomY,
            bodyEdgeY,
            bodyY,
            topWidth,
            bottomWidth,
            rimY,
        },
        shapes: {
            frontWallClipShape,
        },
    } = model;

    ctx.save();
    beginZenPotShapePath(ctx, frontWallClipShape);
    ctx.clip();

    const frontGradient = ctx.createLinearGradient(-halfWidth, bodyY, halfWidth, bodyY);
    frontGradient.addColorStop(0, palette.dark);
    frontGradient.addColorStop(0.22, palette.light);
    frontGradient.addColorStop(0.52, palette.base);
    frontGradient.addColorStop(1, palette.dark);
    ctx.fillStyle = frontGradient;
    beginClassicPotBodyPath(ctx, width, height, bodyEdgeY, bodyBottomY);
    ctx.fill();
    drawPotSurfaceTexture({
        ctx,
        model,
        seed: `${model.styleKey}|classic_front`,
        bounds: createRectBounds(-topWidth * 0.54, -height, topWidth * 0.54, bodyBottomY),
        beginPath: () => beginClassicPotBodyPath(ctx, width, height, bodyEdgeY, bodyBottomY),
    });
    ctx.restore();

    ctx.strokeStyle = palette.rim;
    ctx.lineWidth = Math.max(1, rimHeight * 0.58);
    ctx.beginPath();
    ctx.ellipse(0, rimY, topWidth * 0.5, rimHeight, 0, 0.02, Math.PI - 0.02, false);
    ctx.stroke();
};

const drawPedestalFoot = (ctx, width, height, palette, profile) => {
    const bodyBottomY = height * profile.bodyBottomYFactor;
    const topY = bodyBottomY + (height * profile.pedestalTopFactor);
    const footHeight = height * profile.pedestalHeightFactor;
    const topHalfWidth = width * profile.pedestalTopWidthFactor;
    const bottomHalfWidth = width * profile.pedestalBottomWidthFactor;
    const footGradient = ctx.createLinearGradient(0, topY, 0, topY + footHeight);
    footGradient.addColorStop(0, palette.footTop);
    footGradient.addColorStop(1, palette.footBottom);

    ctx.fillStyle = footGradient;
    ctx.beginPath();
    ctx.moveTo(-topHalfWidth * 0.5, topY);
    ctx.lineTo(topHalfWidth * 0.5, topY);
    ctx.lineTo(bottomHalfWidth * 0.5, topY + footHeight);
    ctx.lineTo(-bottomHalfWidth * 0.5, topY + footHeight);
    ctx.closePath();
    ctx.fill();
};

const drawRingFoot = (ctx, width, height, palette, profile) => {
    const bodyBottomY = height * profile.bodyBottomYFactor;
    const topY = bodyBottomY + (height * profile.ringTopFactor);
    const footHeight = height * profile.ringHeightFactor;
    const topHalfWidth = width * profile.ringTopWidthFactor;
    const bottomHalfWidth = width * profile.ringBottomWidthFactor;
    const belly = height * (profile.ringBellyFactor || 0.03);
    const footGradient = ctx.createLinearGradient(0, topY, 0, topY + footHeight);
    footGradient.addColorStop(0, palette.footTop);
    footGradient.addColorStop(1, palette.footBottom);

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = footGradient;
    ctx.beginPath();
    ctx.moveTo(-topHalfWidth * 0.5, topY);
    ctx.lineTo(topHalfWidth * 0.5, topY);
    ctx.bezierCurveTo(
        topHalfWidth * 0.58,
        topY + (footHeight * 0.28),
        bottomHalfWidth * 0.55,
        topY + footHeight,
        bottomHalfWidth * 0.5,
        topY + footHeight,
    );
    ctx.quadraticCurveTo(0, topY + footHeight + belly, -bottomHalfWidth * 0.5, topY + footHeight);
    ctx.bezierCurveTo(
        -bottomHalfWidth * 0.55,
        topY + footHeight,
        -topHalfWidth * 0.58,
        topY + (footHeight * 0.28),
        -topHalfWidth * 0.5,
        topY,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.lineCap = 'round';
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(0.45, height * 0.012);
    ctx.beginPath();
    ctx.ellipse(
        0,
        topY + (footHeight * 0.68),
        bottomHalfWidth * 0.38,
        Math.max(0.55, footHeight * 0.2),
        0,
        0.18,
        Math.PI - 0.18,
        false,
    );
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = palette.lipHighlight;
    ctx.lineWidth = Math.max(0.6, height * 0.018);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(0, topY + (footHeight * 0.2), topHalfWidth * 0.4, footHeight * 0.14, 0, 0.12, Math.PI - 0.12, false);
    ctx.stroke();
    ctx.restore();
};

const drawOvalPot = (ctx, model) => {
    const {
        palette,
        profile,
        baseWidth: width,
        baseHeight: height,
        metrics: {
            topWidth,
            rimHeight,
            bodyBottomY,
            rimY,
        },
    } = model;
    const geometry = model.geometry || resolveZenPotGeometry(model);
    const { edges, surfaces } = geometry;

    ctx.fillStyle = palette.shadow;
    beginZenPotShapePath(ctx, surfaces.shadow.shape);
    ctx.fill();

    const bodyGradient = ctx.createLinearGradient(0, -height, 0, bodyBottomY + (height * 0.42));
    bodyGradient.addColorStop(0, palette.light);
    bodyGradient.addColorStop(0.46, palette.base);
    bodyGradient.addColorStop(1, palette.dark);
    ctx.fillStyle = bodyGradient;
    beginZenPotSurfacePath(ctx, surfaces.body);
    ctx.fill();

    const sideGradient = ctx.createLinearGradient(-topWidth * 0.5, 0, topWidth * 0.5, 0);
    sideGradient.addColorStop(0, 'rgba(0,0,0,0.22)');
    sideGradient.addColorStop(0.18, 'rgba(255,255,255,0.08)');
    sideGradient.addColorStop(0.52, 'rgba(255,255,255,0.02)');
    sideGradient.addColorStop(0.84, 'rgba(0,0,0,0.1)');
    sideGradient.addColorStop(1, 'rgba(0,0,0,0.24)');
    ctx.fillStyle = sideGradient;
    beginZenPotSurfacePath(ctx, surfaces.body);
    ctx.fill();

    const specGradient = ctx.createRadialGradient(
        width * profile.highlightOffsetXFactor,
        height * profile.highlightOffsetYFactor,
        0,
        width * profile.highlightOffsetXFactor,
        height * profile.highlightOffsetYFactor,
        width * profile.highlightRadiusFactor,
    );
    specGradient.addColorStop(0, palette.highlight);
    specGradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGradient;
    beginZenPotSurfacePath(ctx, surfaces.body);
    ctx.fill();
    drawPotSurfaceTexture({
        ctx,
        model,
        seed: `${model.styleKey}|oval_body`,
        bounds: surfaces.body.bounds,
        beginPath: () => beginZenPotSurfacePath(ctx, surfaces.body),
    });

    ctx.save();
    beginZenPotSurfacePath(ctx, surfaces.body);
    ctx.clip();
    const lowerShade = ctx.createLinearGradient(0, bodyBottomY - (height * 0.2), 0, bodyBottomY + (height * 0.04));
    lowerShade.addColorStop(0, 'rgba(255,255,255,0)');
    lowerShade.addColorStop(0.55, 'rgba(44,39,32,0.05)');
    lowerShade.addColorStop(1, 'rgba(28,24,20,0.14)');
    ctx.fillStyle = lowerShade;
    ctx.fillRect(-topWidth * 0.56, bodyBottomY - (height * 0.22), topWidth * 1.12, height * 0.3);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.48;
    ctx.lineCap = 'round';
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(0.55, height * 0.014);
    strokeInsetEllipseArc(ctx, edges.lowerFront.shape, 0.16);
    ctx.restore();

    if (profile.showBand !== false) {
        ctx.strokeStyle = palette.band;
        ctx.lineWidth = Math.max(1, height * 0.06);
        ctx.beginPath();
        ctx.ellipse(0, bodyBottomY - (height * 0.02), width * 0.38, height * 0.08, 0, 0.14, Math.PI - 0.14, false);
        ctx.stroke();
    }

    if (profile.footMode === 'pedestal') {
        drawPedestalFoot(ctx, width, height, palette, profile);
    } else if (profile.footMode === 'ring') {
        drawRingFoot(ctx, width, height, palette, profile);
    } else {
        ctx.strokeStyle = palette.edge;
        ctx.lineWidth = 1.05;
        beginZenPotShapePath(ctx, edges.lowerFront.shape);
        ctx.stroke();

        ctx.strokeStyle = palette.lipHighlight;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(
            0,
            bodyBottomY - (height * 0.01),
            edges.lowerFront.shape.rx * 0.82,
            Math.max(1, edges.lowerFront.shape.ry * 0.48),
            0,
            0.16,
            Math.PI - 0.16,
            false,
        );
        ctx.stroke();
    }

    ctx.fillStyle = palette.rim;
    beginZenPotShapePath(ctx, surfaces.rimOuter.shape);
    ctx.fill();
    drawPotRimGlow({
        ctx,
        model,
        shape: surfaces.rimOuter.shape,
        lineWidth: Math.max(0.5, rimHeight * 0.14),
    });

    ctx.fillStyle = palette.rimInner;
    beginZenPotShapePath(ctx, surfaces.rimInner.shape);
    ctx.fill();

    ctx.save();
    beginZenPotShapePath(ctx, surfaces.rimInner.shape);
    ctx.clip();
    const innerWallShade = ctx.createLinearGradient(0, rimY - rimHeight, 0, rimY + rimHeight);
    innerWallShade.addColorStop(0, 'rgba(255,255,255,0.16)');
    innerWallShade.addColorStop(0.46, 'rgba(255,255,255,0.02)');
    innerWallShade.addColorStop(1, 'rgba(32,28,22,0.16)');
    ctx.fillStyle = innerWallShade;
    ctx.fillRect(-topWidth * 0.46, rimY - rimHeight, topWidth * 0.92, rimHeight * 2.1);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.strokeStyle = palette.lipHighlight;
    ctx.lineWidth = Math.max(0.5, rimHeight * 0.1);
    ctx.beginPath();
    ctx.ellipse(
        0,
        rimY - (rimHeight * 0.02),
        topWidth * 0.47,
        rimHeight * 0.68,
        0,
        Math.PI + 0.12,
        (Math.PI * 2) - 0.12,
        false,
    );
    ctx.stroke();
    ctx.globalAlpha = 0.46;
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(0.45, rimHeight * 0.08);
    ctx.beginPath();
    ctx.ellipse(
        0,
        rimY + (rimHeight * 0.18),
        topWidth * 0.41,
        rimHeight * 0.54,
        0,
        Math.PI + 0.18,
        (Math.PI * 2) - 0.18,
        false,
    );
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(0.7, rimHeight * 0.18);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(0, rimY + (rimHeight * 0.12), topWidth * 0.43, rimHeight * 0.62, 0, 0.08, Math.PI - 0.08, false);
    ctx.stroke();

    const soilSurfaceShape = surfaces.soil.shape;
    const soilGradient = ctx.createRadialGradient(
        0,
        soilSurfaceShape.cy - (soilSurfaceShape.ry * 0.34),
        Math.max(0.4, soilSurfaceShape.ry * 0.12),
        0,
        soilSurfaceShape.cy,
        soilSurfaceShape.rx * 1.02,
    );
    soilGradient.addColorStop(0, palette.soilLight);
    soilGradient.addColorStop(0.55, palette.soilMid);
    soilGradient.addColorStop(1, palette.soilDark);
    ctx.fillStyle = soilGradient;
    beginZenPotShapePath(ctx, surfaces.soil.shape);
    ctx.fill();
    drawPotSoilTexture({
        ctx,
        model,
        seed: `${model.styleKey}|oval_soil`,
        soilShape: surfaces.soil.shape,
    });

    drawOvalBackRimDetail({
        ctx,
        palette,
        edges,
        topWidth,
        rimHeight,
        rimY,
    });
};

const drawOvalPotFrontOverlay = (ctx, model) => {
    const {
        palette,
        baseHeight: height,
        metrics: {
            topWidth,
            bodyBottomY,
            rimHeight,
        },
    } = model;
    const geometry = model.geometry || resolveZenPotGeometry(model);
    const { edges, surfaces } = geometry;

    ctx.save();
    beginZenPotSurfacePath(ctx, surfaces.frontWall);
    ctx.clip();

    const frontGradient = ctx.createLinearGradient(0, -height, 0, height * 0.4);
    frontGradient.addColorStop(0, palette.light);
    frontGradient.addColorStop(0.42, palette.base);
    frontGradient.addColorStop(1, palette.dark);
    ctx.fillStyle = frontGradient;
    beginZenPotSurfacePath(ctx, surfaces.frontWall);
    ctx.fill();

    const frontSheen = ctx.createLinearGradient(-topWidth * 0.48, -height * 0.82, topWidth * 0.48, bodyBottomY);
    frontSheen.addColorStop(0, 'rgba(0,0,0,0.12)');
    frontSheen.addColorStop(0.3, 'rgba(255,255,255,0.1)');
    frontSheen.addColorStop(0.64, 'rgba(255,255,255,0.02)');
    frontSheen.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = frontSheen;
    beginZenPotSurfacePath(ctx, surfaces.frontWall);
    ctx.fill();

    drawPotSurfaceTexture({
        ctx,
        model,
        seed: `${model.styleKey}|oval_front`,
        bounds: surfaces.frontWall.bounds,
        beginPath: () => beginZenPotSurfacePath(ctx, surfaces.frontWall),
    });

    const lowerShade = ctx.createLinearGradient(0, bodyBottomY - (height * 0.22), 0, bodyBottomY + (height * 0.06));
    lowerShade.addColorStop(0, 'rgba(255,255,255,0)');
    lowerShade.addColorStop(0.56, 'rgba(42,37,31,0.05)');
    lowerShade.addColorStop(1, 'rgba(25,22,18,0.13)');
    ctx.fillStyle = lowerShade;
    ctx.fillRect(-topWidth * 0.56, bodyBottomY - (height * 0.24), topWidth * 1.12, height * 0.32);

    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = palette.shadow;
    ctx.beginPath();
    ctx.ellipse(
        0,
        bodyBottomY + (height * 0.018),
        topWidth * 0.38,
        Math.max(1, height * 0.024),
        0,
        0,
        FULL_ARC,
    );
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.lineCap = 'round';
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(0.45, height * 0.011);
    strokeInsetEllipseArc(ctx, edges.lowerFront.shape, 0.18);
    ctx.restore();

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = palette.rim;
    ctx.lineWidth = Math.max(0.9, rimHeight * 0.2);
    beginZenPotEdgePath(ctx, edges.rimFront);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.56;
    ctx.strokeStyle = palette.lipHighlight;
    ctx.lineWidth = Math.max(0.45, rimHeight * 0.07);
    ctx.lineCap = 'round';
    beginZenPotEdgePath(ctx, edges.rimFront);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(0.56, rimHeight * 0.1);
    beginZenPotEdgePath(ctx, edges.rimFront);
    ctx.stroke();
    ctx.restore();
};

const drawRectPot = (ctx, model) => {
    const {
        palette,
        metrics: {
            rimY,
            bodyTopY,
            bodyBottomY,
            bodyHeight,
            rimHeight,
            cornerRadius,
            innerInset,
        },
        shapes: {
            shadowShape,
            soilSurfaceShape,
        },
        baseWidth: width,
    } = model;

    ctx.fillStyle = palette.shadow;
    beginZenPotShapePath(ctx, shadowShape);
    ctx.fill();

    const bodyGradient = ctx.createLinearGradient(0, bodyTopY, 0, bodyBottomY + (model.baseHeight * 0.2));
    bodyGradient.addColorStop(0, palette.light);
    bodyGradient.addColorStop(0.44, palette.base);
    bodyGradient.addColorStop(1, palette.dark);
    ctx.fillStyle = bodyGradient;
    beginRoundedRectPath(ctx, -(width * 0.5), bodyTopY, width, bodyHeight, cornerRadius);
    ctx.fill();
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = 1;
    ctx.stroke();
    drawPotSurfaceTexture({
        ctx,
        model,
        seed: `${model.styleKey}|rect_body`,
        bounds: createRectBounds(-(width * 0.5), bodyTopY, width * 0.5, bodyBottomY),
        beginPath: () => beginRoundedRectPath(ctx, -(width * 0.5), bodyTopY, width, bodyHeight, cornerRadius),
    });

    const faceGradient = ctx.createLinearGradient(0, bodyTopY + 6, 0, bodyBottomY + (model.baseHeight * 0.08));
    faceGradient.addColorStop(0, 'rgba(255,255,255,0.2)');
    faceGradient.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = faceGradient;
    beginRoundedRectPath(
        ctx,
        -(width * 0.5) + innerInset,
        bodyTopY + 8,
        width - (innerInset * 2),
        bodyHeight - 18,
        Math.max(3, cornerRadius - 2),
    );
    ctx.fill();

    ctx.strokeStyle = palette.band;
    ctx.lineWidth = Math.max(0.6, model.baseHeight * 0.026);
    ctx.beginPath();
    ctx.moveTo(-(width * 0.38), bodyTopY + (bodyHeight * 0.65));
    ctx.lineTo(width * 0.38, bodyTopY + (bodyHeight * 0.65));
    ctx.stroke();

    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-(width * 0.34), bodyBottomY + (model.baseHeight * 0.01));
    ctx.lineTo(width * 0.34, bodyBottomY + (model.baseHeight * 0.01));
    ctx.stroke();

    ctx.fillStyle = palette.rim;
    beginRoundedRectPath(ctx, -(width * 0.5), rimY, width, rimHeight, Math.max(3, cornerRadius - 1));
    ctx.fill();
    drawPotRimGlow({
        ctx,
        model,
        shape: createRoundRectShape({
            x: -(width * 0.5),
            y: rimY,
            width,
            height: rimHeight,
            radius: Math.max(3, cornerRadius - 1),
        }),
        lineWidth: Math.max(0.5, rimHeight * 0.14),
    });

    ctx.fillStyle = palette.rimInner;
    beginRoundedRectPath(
        ctx,
        -(width * 0.5) + innerInset,
        rimY + 4,
        width - (innerInset * 2),
        rimHeight - 4,
        Math.max(2, cornerRadius - 3),
    );
    ctx.fill();

    const soilGradient = ctx.createLinearGradient(
        0,
        soilSurfaceShape.y,
        0,
        soilSurfaceShape.y + soilSurfaceShape.height,
    );
    soilGradient.addColorStop(0, palette.soilLight);
    soilGradient.addColorStop(0.56, palette.soilMid);
    soilGradient.addColorStop(1, palette.soilDark);
    ctx.fillStyle = soilGradient;
    beginZenPotShapePath(ctx, soilSurfaceShape);
    ctx.fill();
    drawPotSoilTexture({
        ctx,
        model,
        seed: `${model.styleKey}|rect_soil`,
        soilShape: soilSurfaceShape,
    });
};

const drawRectPotFrontOverlay = (ctx, model) => {
    const {
        palette,
        baseWidth: width,
        metrics: {
            rimY,
            bodyTopY,
            bodyBottomY,
            bodyHeight,
            cornerRadius,
        },
        shapes: {
            frontWallClipShape,
        },
    } = model;

    ctx.save();
    beginZenPotShapePath(ctx, frontWallClipShape);
    ctx.clip();

    const frontGradient = ctx.createLinearGradient(0, bodyTopY, 0, bodyBottomY + (model.baseHeight * 0.18));
    frontGradient.addColorStop(0, palette.light);
    frontGradient.addColorStop(0.42, palette.base);
    frontGradient.addColorStop(1, palette.dark);
    ctx.fillStyle = frontGradient;
    beginRoundedRectPath(ctx, -(width * 0.5), bodyTopY, width, bodyHeight, cornerRadius);
    ctx.fill();
    drawPotSurfaceTexture({
        ctx,
        model,
        seed: `${model.styleKey}|rect_front`,
        bounds: createRectBounds(-(width * 0.5), bodyTopY, width * 0.5, bodyBottomY),
        beginPath: () => beginRoundedRectPath(ctx, -(width * 0.5), bodyTopY, width, bodyHeight, cornerRadius),
    });
    ctx.restore();

    ctx.strokeStyle = palette.rim;
    ctx.lineWidth = Math.max(1.1, model.baseHeight * 0.045);
    ctx.beginPath();
    ctx.moveTo(-(width * 0.42), rimY + (model.baseHeight * 0.055));
    ctx.lineTo(width * 0.42, rimY + (model.baseHeight * 0.055));
    ctx.stroke();
};

export const drawGlazedPot = (ctx, x, y, width, height, type = DEFAULT_ZEN_BONSAI_POT_STYLE) => {
    const model = resolveZenPotRenderModel({ width, height, type });

    ctx.save();
    ctx.translate(x, y);

    if (model.family === 'classic') {
        drawClassicPot(ctx, model);
    } else if (model.family === 'rect') {
        drawRectPot(ctx, model);
    } else if (model.family === 'frame_bed') {
        // The Home garden-bed compositor owns the projected planes; this model
        // still supplies the shared soil and nebari geometry contract.
    } else {
        drawOvalPot(ctx, model);
    }

    ctx.restore();
};

export const drawGlazedPotFrontOverlay = (ctx, x, y, width, height, type = DEFAULT_ZEN_BONSAI_POT_STYLE) => {
    const model = resolveZenPotRenderModel({ width, height, type });

    ctx.save();
    ctx.translate(x, y);

    if (model.family === 'classic') {
        drawClassicPotFrontOverlay(ctx, model);
    } else if (model.family === 'rect') {
        drawRectPotFrontOverlay(ctx, model);
    } else if (model.family === 'frame_bed') {
        // The Home garden-bed compositor supplies the front occlusion plane.
    } else {
        drawOvalPotFrontOverlay(ctx, model);
    }

    ctx.restore();
};
