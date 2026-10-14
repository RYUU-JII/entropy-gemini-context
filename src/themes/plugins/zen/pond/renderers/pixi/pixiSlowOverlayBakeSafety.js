import { BLEND_MODES } from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';

const clamp01 = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.min(1, Math.max(0, numeric));
};

const screenChannel = (base, source) => 1 - ((1 - base) * (1 - source));

const alphaScreenOver = (base, source, alpha) => {
    const safeBase = clamp01(base);
    const safeSource = clamp01(source);
    const safeAlpha = clamp01(alpha);
    return (
        safeBase * (1 - safeAlpha)
        + screenChannel(safeBase, safeSource) * safeAlpha
    );
};

export const measureScreenOpaqueBlackBakeError = ({
    baseSamples = [0, 0.12, 0.27, 0.48, 0.73, 1],
    spriteSamples = [
        [0.88, 0.18],
        [0.42, 0.36],
        [0.67, 0.24],
    ],
} = {}) => {
    const sprites = Array.isArray(spriteSamples) ? spriteSamples : [];
    const bakedContribution = sprites.reduce(
        (value, [source, alpha]) => alphaScreenOver(value, source, alpha),
        0,
    );
    let maxError = 0;
    for (let i = 0; i < baseSamples.length; i += 1) {
        const base = clamp01(baseSamples[i]);
        const direct = sprites.reduce(
            (value, [source, alpha]) => alphaScreenOver(value, source, alpha),
            base,
        );
        const baked = screenChannel(base, bakedContribution);
        maxError = Math.max(maxError, Math.abs(direct - baked));
    }
    return {
        maxError,
        bakedContribution,
    };
};

const isSameBlendMode = (left, right) => (
    left === right
    || (left !== undefined && right !== undefined && String(left) === String(right))
);

export const isScreenBlendMode = (blendMode, blendModes = BLEND_MODES) => (
    isSameBlendMode(blendMode, blendModes?.SCREEN)
);

export const isBackgroundDependentBlendMode = (blendMode, blendModes = BLEND_MODES) => (
    isSameBlendMode(blendMode, blendModes?.SOFT_LIGHT)
    || isSameBlendMode(blendMode, blendModes?.OVERLAY)
    || isSameBlendMode(blendMode, blendModes?.HARD_LIGHT)
    || isSameBlendMode(blendMode, blendModes?.MULTIPLY)
);

const collectBlendModes = (objects = []) => (
    Array.isArray(objects)
        ? objects.map((object) => object?.blendMode).filter((blendMode) => blendMode !== undefined)
        : []
);

export const measureSlowOverlayBakeSafety = ({
    refractedSurfaceObjects = [],
    cloudReflectionObjects = [],
    blendModes = BLEND_MODES,
} = {}) => {
    const guideBlendModes = collectBlendModes(refractedSurfaceObjects);
    const cloudBlendModes = collectBlendModes(cloudReflectionObjects);
    const fullOverlayBlendModes = [
        ...guideBlendModes,
        ...cloudBlendModes,
    ];
    const fullOverlaySafe = fullOverlayBlendModes.every((blendMode) => (
        isScreenBlendMode(blendMode, blendModes)
        || !isBackgroundDependentBlendMode(blendMode, blendModes)
    ));
    const cloudOnlySafe = (
        cloudBlendModes.length > 0
        && cloudBlendModes.every((blendMode) => isScreenBlendMode(blendMode, blendModes))
        && measureScreenOpaqueBlackBakeError().maxError <= 1e-12
    );

    return Object.freeze({
        fullOverlaySafe,
        cloudOnlySafe,
        guideBlendModes,
        cloudBlendModes,
    });
};
