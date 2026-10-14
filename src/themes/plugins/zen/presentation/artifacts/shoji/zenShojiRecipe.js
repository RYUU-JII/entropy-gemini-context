function hexToRgb(value) {
    if (typeof value !== 'string') return null;
    const raw = value.trim().replace('#', '');
    if (!/^[\da-fA-F]{3}([\da-fA-F]{3})?$/.test(raw)) return null;
    const fullHex = raw.length === 3
        ? raw.split('').map((char) => char + char).join('')
        : raw;
    return {
        r: parseInt(fullHex.slice(0, 2), 16),
        g: parseInt(fullHex.slice(2, 4), 16),
        b: parseInt(fullHex.slice(4, 6), 16),
    };
}

function withAlpha(value, alpha, fallback) {
    const rgb = hexToRgb(value);
    if (!rgb) return fallback || `rgba(255,255,255,${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function requireUnitInterval(value, field) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`ZEN_SHOJI_VISUAL_${field}_INVALID`);
    }
    return value;
}

function requireBoolean(value, field) {
    if (typeof value !== 'boolean') {
        throw new Error(`ZEN_SHOJI_VISUAL_${field}_INVALID`);
    }
    return value;
}

function requireMotionBudgetMode(value) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error('ZEN_SHOJI_VISUAL_MOTION_BUDGET_MODE_INVALID');
    }
    return value.trim();
}

function requireAccessibility({ ariaHidden, ariaLabel }) {
    requireBoolean(ariaHidden, 'ARIA_HIDDEN');
    if (ariaHidden) {
        if (ariaLabel !== null) {
            throw new Error('ZEN_SHOJI_VISUAL_HIDDEN_LABEL_FORBIDDEN');
        }
        return Object.freeze({
            role: undefined,
            ariaLabel: undefined,
            ariaHidden: true,
        });
    }
    if (typeof ariaLabel !== 'string' || !ariaLabel.trim()) {
        throw new Error('ZEN_SHOJI_VISUAL_ARIA_LABEL_INVALID');
    }
    return Object.freeze({
        role: 'img',
        ariaLabel: ariaLabel.trim(),
        ariaHidden: undefined,
    });
}

function lerp(start, end, amount) {
    return start + ((end - start) * clamp01(amount));
}

function mix(start, end, amount) {
    return Math.round(start + ((end - start) * clamp01(amount)));
}

function blendHex(start, end, amount) {
    const from = hexToRgb(start);
    const to = hexToRgb(end);
    if (!from || !to) return start;
    const channel = (value) => value.toString(16).padStart(2, '0');
    return `#${channel(mix(from.r, to.r, amount))}${channel(mix(from.g, to.g, amount))}${channel(mix(from.b, to.b, amount))}`;
}

function buildPaperTexture({ base, highlight, shadow, fiber, grain = 0.08, glow = 0.18, angle = 135 }) {
    return [
        `linear-gradient(${angle}deg, ${withAlpha(highlight, 0.32 + glow)} 0%, ${withAlpha(base, 0.94)} 46%, ${withAlpha(shadow, 0.58)} 100%)`,
        `radial-gradient(circle at 30% 24%, ${withAlpha(highlight, 0.12 + (glow * 0.64))} 0%, transparent 50%)`,
        `radial-gradient(circle at 72% 70%, ${withAlpha(shadow, 0.1)} 0%, transparent 58%)`,
        `repeating-linear-gradient(0deg, ${withAlpha(fiber, grain * 0.55)} 0 1px, transparent 1px 9px)`,
        `repeating-linear-gradient(90deg, ${withAlpha(fiber, grain * 0.38)} 0 1px, transparent 1px 13px)`,
    ].join(',');
}

const CUBE_SIZE = 152;
const FACE_RENDER_Z = CUBE_SIZE / 2;
const FACE_EDGE_OVERLAP_PX = 1;
const FRAME_THICKNESS = 8;
const CUBE_ROTATION = Object.freeze({ x: 25.25, y: -38.5 });
const GEOMETRY_MODEL = 'joined-cube';
const MOTION_MODEL = 'slow-vertical-float';
const MOTION_POLICY = 'zen-calm-float';
const CAMERA_MODEL = 'static-three-quarter';
const SURFACE_TREATMENT = 'quiet-paper-wood';
const FLOAT_BASE_Y = -20;
const FLOAT_VERTICAL_DURATION_SECONDS = 15;

const FACE_DEFS = Object.freeze([
    { id: 'back', type: 'side', transform: `rotateY(180deg) translateZ(${FACE_RENDER_Z}px)` },
    { id: 'right', type: 'side', transform: `rotateY(90deg) translateZ(${FACE_RENDER_Z}px)` },
    { id: 'left', type: 'side', transform: `rotateY(-90deg) translateZ(${FACE_RENDER_Z}px)` },
    { id: 'top', type: 'top', transform: `rotateX(90deg) translateZ(${FACE_RENDER_Z}px)` },
    { id: 'bottom', type: 'bottom', transform: `rotateX(-90deg) translateZ(${FACE_RENDER_Z}px)` },
    { id: 'front', type: 'front', transform: `translateZ(${FACE_RENDER_Z}px)` },
]);

const FRAME_BARS = Object.freeze([
    {
        id: 'top',
        style: Object.freeze({
            left: 0,
            right: 0,
            top: 0,
            height: FRAME_THICKNESS,
            zIndex: 3,
        }),
    },
    {
        id: 'bottom',
        style: Object.freeze({
            left: 0,
            right: 0,
            bottom: 0,
            height: FRAME_THICKNESS,
            zIndex: 4,
        }),
    },
    {
        id: 'left',
        style: Object.freeze({
            left: 0,
            top: 0,
            bottom: 0,
            width: FRAME_THICKNESS,
            zIndex: 5,
        }),
    },
    {
        id: 'right',
        style: Object.freeze({
            right: 0,
            top: 0,
            bottom: 0,
            width: FRAME_THICKNESS,
            zIndex: 6,
        }),
    },
]);

const KUMIKO_LINES = Object.freeze([
    { id: 'v1', left: '33.33%', top: 0, width: '4px', height: '100%' },
    { id: 'v2', left: '66.66%', top: 0, width: '4px', height: '100%' },
    { id: 'h1', left: 0, top: '33.33%', width: '100%', height: '4px' },
    { id: 'h2', left: 0, top: '66.66%', width: '100%', height: '4px' },
]);

function buildFrameBarBackground(barId, palette, faceBase, faceType) {
    if (faceType === 'bottom') {
        const bottomBase = blendHex(faceBase, '#000000', 0.08);
        const bottomShade = blendHex(palette.woodShadow, '#000000', 0.26);
        const bottomRim = blendHex(faceBase, '#ffffff', 0.05);
        const bottomGrain = [
            `repeating-linear-gradient(0deg, ${withAlpha('#ffffff', 0.024)} 0 1px, transparent 1px 10px)`,
            `repeating-linear-gradient(90deg, ${withAlpha('#000000', 0.1)} 0 1px, transparent 1px 12px)`,
        ].join(',');

        if (barId === 'right' || barId === 'bottom') {
            return `linear-gradient(${barId === 'right' ? 90 : 180}deg, ${bottomBase} 0%, ${bottomShade} 100%),${bottomGrain}`;
        }
        return `linear-gradient(${barId === 'left' ? 90 : 180}deg, ${bottomRim} 0%, ${bottomBase} 42%, ${bottomShade} 100%),${bottomGrain}`;
    }

    const highlight = faceType === 'side'
        ? blendHex(palette.woodEdge, faceBase, 0.34)
        : palette.woodEdge;
    const shadow = faceType === 'top'
        ? withAlpha(palette.woodShadow, 0.68)
        : withAlpha(palette.woodShadow, 0.82);
    const grain = [
        `repeating-linear-gradient(0deg, ${withAlpha('#ffffff', faceType === 'top' ? 0.06 : 0.04)} 0 1px, transparent 1px 9px)`,
        `repeating-linear-gradient(90deg, ${withAlpha(palette.woodShadow, faceType === 'side' ? 0.1 : 0.075)} 0 1px, transparent 1px 13px)`,
    ].join(',');
    switch (barId) {
        case 'top':
            return `linear-gradient(180deg, ${highlight} 0%, ${faceBase} 58%, ${shadow} 100%),${grain}`;
        case 'bottom':
            return `linear-gradient(180deg, ${withAlpha(faceBase, 0.98)} 0%, ${palette.woodShadow} 100%),${grain}`;
        case 'left':
            return `linear-gradient(90deg, ${highlight} 0%, ${faceBase} 60%, ${withAlpha(palette.woodShadow, 0.62)} 100%),${grain}`;
        case 'right':
            return `linear-gradient(90deg, ${withAlpha(faceBase, 0.98)} 0%, ${palette.woodShadow} 100%),${grain}`;
        default:
            return faceBase;
    }
}

function buildFrameBarShadow(barId, palette, faceType) {
    if (faceType === 'bottom') {
        return [
            `inset 0 0 0 1px ${withAlpha('#000000', 0.28)}`,
            `inset 0 1px 2px ${withAlpha('#000000', 0.2)}`,
            `inset 0 -2px 5px ${withAlpha('#000000', 0.3)}`,
        ].join(',');
    }

    switch (barId) {
        case 'top':
            return [
                `inset 0 1px 0 ${withAlpha('#ffffff', faceType === 'top' ? 0.14 : 0.08)}`,
                `inset 0 -1px 5px ${withAlpha(palette.woodShadow, 0.62)}`,
            ].join(',');
        case 'bottom':
            return [
                `inset 0 1px 4px ${withAlpha('#000000', 0.28)}`,
                `inset 0 -1px 0 ${withAlpha('#ffffff', 0.04)}`,
            ].join(',');
        case 'left':
            return [
                `inset 1px 0 0 ${withAlpha('#ffffff', faceType === 'top' ? 0.1 : 0.06)}`,
                `inset -1px 0 5px ${withAlpha(palette.woodShadow, 0.56)}`,
            ].join(',');
        case 'right':
            return [
                `inset 1px 0 5px ${withAlpha('#000000', 0.3)}`,
                `inset -1px 0 0 ${withAlpha('#ffffff', 0.035)}`,
            ].join(',');
        default:
            return 'none';
    }
}

function buildFaceFinishBackground(faceType, palette) {
    if (faceType === 'top') {
        return [
            `linear-gradient(156deg, ${withAlpha('#ffffff', 0.2)} 0%, transparent 38%, ${withAlpha(palette.woodShadow, 0.12)} 100%)`,
            `radial-gradient(circle at 28% 18%, ${withAlpha('#ffffff', 0.08)} 0%, transparent 48%)`,
        ].join(',');
    }
    if (faceType === 'side') {
        return [
            `linear-gradient(90deg, ${withAlpha('#000000', 0.2)} 0%, transparent 42%, ${withAlpha('#000000', 0.3)} 100%)`,
            `radial-gradient(circle at 62% 28%, ${withAlpha('#ffffff', 0.035)} 0%, transparent 44%)`,
            `linear-gradient(180deg, ${withAlpha('#ffffff', 0.055)} 0%, transparent 34%, ${withAlpha('#000000', 0.1)} 100%)`,
        ].join(',');
    }
    if (faceType === 'bottom') {
        return [
            `linear-gradient(180deg, ${withAlpha('#000000', 0.16)} 0%, ${withAlpha('#000000', 0.3)} 100%)`,
            `radial-gradient(circle at 50% 30%, ${withAlpha('#ffffff', 0.018)} 0%, transparent 54%)`,
        ].join(',');
    }

    const shadeAlpha = faceType === 'bottom' ? 0.24 : 0.08;
    return [
        `linear-gradient(142deg, ${withAlpha('#ffffff', 0.13)} 0%, transparent 36%, ${withAlpha(palette.woodShadow, shadeAlpha)} 100%)`,
        `radial-gradient(circle at 24% 18%, ${withAlpha('#ffffff', 0.07)} 0%, transparent 48%)`,
        `radial-gradient(circle at 78% 72%, ${withAlpha(palette.woodShadow, 0.1)} 0%, transparent 54%)`,
    ].join(',');
}

function getFaceFinishOpacity(faceType, nightDepth) {
    if (faceType === 'bottom') return lerp(0.1, 0.14, nightDepth);
    if (faceType === 'side') return lerp(0.42, 0.5, nightDepth);
    if (faceType === 'top') return lerp(0.38, 0.46, nightDepth);
    return lerp(0.44, 0.5, nightDepth);
}

function buildKumikoBackground(lineId, palette, faceBase, faceType) {
    const isVertical = lineId.startsWith('v');
    const angle = isVertical ? 90 : 180;
    if (faceType === 'bottom') {
        const base = blendHex(faceBase, '#000000', 0.2);
        return `linear-gradient(${angle}deg, ${blendHex(base, '#ffffff', 0.04)} 0%, ${base} 45%, ${blendHex(base, '#000000', 0.36)} 100%)`;
    }
    const highlight = faceType === 'top'
        ? blendHex(faceBase, '#ffffff', 0.18)
        : blendHex(faceBase, palette.woodEdge, 0.22);
    return `linear-gradient(${angle}deg, ${highlight} 0%, ${faceBase} 46%, ${blendHex(faceBase, palette.woodShadow, 0.48)} 100%)`;
}

function buildKumikoShadow(palette, faceType) {
    if (faceType === 'bottom') {
        return `1px 1px 3px ${withAlpha('#000000', 0.74)}`;
    }
    return [
        `1px 1px 3px ${withAlpha(palette.woodShadow, 0.72)}`,
        `-1px -1px 0 ${withAlpha('#ffffff', faceType === 'top' ? 0.08 : 0.04)}`,
    ].join(',');
}

function buildFaceMaterials({ palette, nightDepth }) {
    return Object.freeze({
        top: Object.freeze({
            paper: buildPaperTexture({
                base: palette.topPaperBase,
                highlight: palette.topPaperHighlight,
                shadow: palette.topPaperShadow,
                fiber: palette.fiber,
                grain: 0.08,
                glow: 0.2,
                angle: 175,
            }),
            woodBase: palette.topWoodBase,
            paperShade: [
                `linear-gradient(156deg, ${withAlpha('#ffffff', lerp(0.14, 0.09, nightDepth))} 0%, transparent 44%, ${withAlpha(palette.woodShadow, 0.12)} 100%)`,
                `radial-gradient(circle at 22% 18%, ${withAlpha('#ffffff', 0.06)} 0%, transparent 46%)`,
            ].join(','),
        }),
        front: Object.freeze({
            paper: buildPaperTexture({
                base: palette.paperBase,
                highlight: palette.paperHighlight,
                shadow: palette.paperShadow,
                fiber: palette.fiber,
                grain: 0.1,
                glow: 0.18,
            }),
            woodBase: palette.woodBase,
            paperShade: 'transparent',
        }),
        side: Object.freeze({
            paper: buildPaperTexture({
                base: palette.sidePaperBase,
                highlight: palette.sidePaperHighlight,
                shadow: palette.sidePaperShadow,
                fiber: palette.fiber,
                grain: 0.075,
                glow: 0.14,
                angle: 92,
            }),
            woodBase: palette.sideWoodBase,
            paperShade: [
                `linear-gradient(90deg, ${withAlpha('#000000', lerp(0.22, 0.28, nightDepth))} 0%, ${withAlpha('#000000', lerp(0.12, 0.16, nightDepth))} 58%, transparent 100%)`,
                `linear-gradient(180deg, ${withAlpha('#ffffff', 0.045)} 0%, transparent 36%, ${withAlpha('#000000', 0.12)} 100%)`,
            ].join(','),
        }),
        bottom: Object.freeze({
            paper: buildPaperTexture({
                base: blendHex(palette.woodShadow, '#000000', 0.04),
                highlight: blendHex(palette.woodShadow, '#ffffff', 0.08),
                shadow: '#000000',
                fiber: palette.fiber,
                grain: 0.06,
                glow: 0.08,
            }),
            woodBase: blendHex(palette.woodShadow, '#000000', 0.08),
            paperShade: `linear-gradient(180deg, ${withAlpha('#000000', 0.2)} 0%, ${withAlpha('#000000', 0.32)} 100%)`,
        }),
    });
}

export function buildZenShojiPalette(nightDepth) {
        const woodBase = blendHex('#8c6845', '#5c432d', nightDepth);
        const woodEdge = blendHex('#a37c56', '#7a5a3d', nightDepth);
        const woodShadow = blendHex('#573f27', '#2e2116', nightDepth);
        const paperBase = blendHex('#fcfaf5', '#e6e1d5', nightDepth);
        const paperShadow = blendHex('#d1cabb', '#a3a9b0', nightDepth);
        const fiber = blendHex('#b8ae9a', '#8a9199', nightDepth);

        return Object.freeze({
            woodBase,
            woodEdge,
            woodShadow,
            paperBase,
            paperHighlight: '#ffffff',
            paperShadow,
            fiber,
            topPaperBase: blendHex('#fff8ea', '#e5d8c3', nightDepth),
            topPaperHighlight: '#ffffff',
            topPaperShadow: blendHex('#d4c2a8', '#a99c89', nightDepth),
            topWoodBase: blendHex('#b07f52', '#7d5636', nightDepth),
            sidePaperBase: blendHex('#d4d0c6', '#aeb2b5', nightDepth),
            sidePaperHighlight: blendHex('#e2ded5', '#c4c9cd', nightDepth),
            sidePaperShadow: blendHex('#aaa396', '#7b8185', nightDepth),
            sideWoodBase: blendHex('#67482c', '#402d1d', nightDepth),
        });
}

export { withAlpha, requireUnitInterval, requireBoolean, requireMotionBudgetMode, requireAccessibility, buildFrameBarBackground, buildFrameBarShadow, buildFaceFinishBackground, getFaceFinishOpacity, buildKumikoBackground, buildKumikoShadow, buildFaceMaterials, CUBE_SIZE, FACE_EDGE_OVERLAP_PX, FRAME_THICKNESS, CUBE_ROTATION, GEOMETRY_MODEL, MOTION_MODEL, MOTION_POLICY, CAMERA_MODEL, SURFACE_TREATMENT, FLOAT_BASE_Y, FLOAT_VERTICAL_DURATION_SECONDS, FACE_DEFS, FRAME_BARS, KUMIKO_LINES };
