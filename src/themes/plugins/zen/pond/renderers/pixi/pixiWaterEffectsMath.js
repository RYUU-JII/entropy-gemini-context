import { clamp as clampValue } from '../../model/koi/koiMotion.js';

const nowMs = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
};

const setVisibleFromAlpha = (sprite, threshold = 0.001) => {
    if (!sprite) return;
    sprite.visible = (Number(sprite.alpha) || 0) > threshold;
};

const blendChannel = (a, b, t) => (a * (1 - t)) + (b * t);

const clamp01 = (value) => clampValue(value, 0, 1);

const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
};

const smoothNoise1D = (value) => {
    const x = Number(value);
    if (!Number.isFinite(x)) return 0.5;
    return clamp01(
        0.5
        + Math.sin(x) * 0.24
        + Math.sin(x * 0.47 + 1.7) * 0.17
        + Math.sin(x * 0.13 + 4.2) * 0.09,
    );
};

const wrapWithMargin = (value, span, margin = 0) => {
    const safeSpan = Math.max(1, Number(span) || 1);
    const safeMargin = Math.max(0, Number(margin) || 0);
    const period = safeSpan + safeMargin * 2;
    let wrapped = (Number(value) + safeMargin) % period;
    if (wrapped < 0) wrapped += period;
    return wrapped - safeMargin;
};

const smoothTowards = (current, target, deltaFrames, responseFrames = 8) => {
    const safeCurrent = Number.isFinite(Number(current)) ? Number(current) : target;
    const safeTarget = Number.isFinite(Number(target)) ? Number(target) : safeCurrent;
    const safeDelta = Math.max(0, Number(deltaFrames) || 0);
    const safeResponse = Math.max(0.001, Number(responseFrames) || 1);
    const blend = 1 - Math.exp(-safeDelta / safeResponse);
    return safeCurrent + (safeTarget - safeCurrent) * blend;
};

export {
    blendChannel,
    nowMs,
    setVisibleFromAlpha,
    smoothNoise1D,
    smoothstep01,
    smoothTowards,
    wrapWithMargin,
};
