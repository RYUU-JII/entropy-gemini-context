import { smoothstep } from './sakuraAngleUtils';
import { clamp, lerp } from './sakuraMath';

const requireDepth = (value, field) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`ZEN_SAKURA_TWIG_SILHOUETTE_DEPTH_REQUIRED:${field}`);
    }
    return value;
};

const scaleSignedOffset = (relativeOffset, scale) => {
    const offset = Number(relativeOffset);
    if (!Number.isFinite(offset)) {
        throw new Error('ZEN_SAKURA_TWIG_SILHOUETTE_OFFSET_REQUIRED');
    }
    return offset * scale;
};

export const resolveSakuraCanopyNegativeSpace = (scaffoldDepthNorm) => {
    const depthNorm = clamp(requireDepth(scaffoldDepthNorm, 'scaffoldDepthNorm'), 0, 1);
    return Object.freeze({
        crownRelease: smoothstep(0.7, 1, depthNorm),
        midCanopySupport: Math.pow(Math.sin(Math.PI * depthNorm), 0.72),
    });
};

export const resolveSakuraTwigRootOpenOffset = ({
    relativeOffset,
    scaffoldDepthNorm,
}) => scaleSignedOffset(
    relativeOffset,
    lerp(
        1.06,
        1.12,
        smoothstep(0.55, 1, clamp(requireDepth(scaffoldDepthNorm, 'scaffoldDepthNorm'), 0, 1)),
    ),
);

export const resolveSakuraTwigOpenForkBias = (twigDepth) => {
    const depth = Math.max(1, Math.floor(requireDepth(twigDepth, 'twigDepth')));
    if (depth === 1) return 0.82;
    if (depth === 2) return 0.77;
    return 0.74;
};
