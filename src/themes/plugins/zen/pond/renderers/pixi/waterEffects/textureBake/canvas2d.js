let canvas2dSupportCached = null;

const toPositiveInt = (value, fallback = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(1, Math.round(numeric));
};

const createCanvasElement = (width, height) => {
    const safeWidth = toPositiveInt(width, 1);
    const safeHeight = toPositiveInt(height, 1);
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = safeWidth;
        canvas.height = safeHeight;
        return canvas;
    }
    if (typeof OffscreenCanvas === 'function') {
        return new OffscreenCanvas(safeWidth, safeHeight);
    }
    return null;
};

export const createCanvas2d = (
    width = 1,
    height = 1,
    contextAttributes = { alpha: true },
) => {
    let canvas = null;
    try {
        canvas = createCanvasElement(width, height);
    } catch (_) {
        canvas = null;
    }
    if (!canvas || typeof canvas.getContext !== 'function') {
        return { canvas: null, ctx: null };
    }
    let ctx = null;
    try {
        ctx = canvas.getContext('2d', contextAttributes);
    } catch (_) {
        ctx = null;
    }
    return { canvas, ctx };
};

export const hasCanvas2dSupport = () => {
    if (canvas2dSupportCached !== null) return canvas2dSupportCached;
    const { ctx } = createCanvas2d(1, 1, { alpha: true });
    canvas2dSupportCached = Boolean(ctx);
    return canvas2dSupportCached;
};
