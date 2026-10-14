const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export const resolveZenBonsaiCanvasCssExtent = (value) => Math.max(1, Math.floor(toNumber(value, 1)));

const requirePixelRatio = value => {
    if (!Number.isFinite(value) || value <= 0) throw new Error('ZEN_BONSAI_PIXEL_RATIO_INVALID');
    return value;
};

export const resolveZenBonsaiCanvasPixelExtent = (value, pixelRatio) => Math.max(
    1,
    Math.floor(resolveZenBonsaiCanvasCssExtent(value) * requirePixelRatio(pixelRatio)),
);

export const syncZenBonsaiCanvasBackingStore = (canvas, cssWidth, cssHeight, pixelRatio) => {
    const resolvedCssWidth = resolveZenBonsaiCanvasCssExtent(cssWidth);
    const resolvedCssHeight = resolveZenBonsaiCanvasCssExtent(cssHeight);
    const resolvedPixelWidth = resolveZenBonsaiCanvasPixelExtent(resolvedCssWidth, pixelRatio);
    const resolvedPixelHeight = resolveZenBonsaiCanvasPixelExtent(resolvedCssHeight, pixelRatio);

    if (canvas.width !== resolvedPixelWidth) {
        canvas.width = resolvedPixelWidth;
    }
    if (canvas.height !== resolvedPixelHeight) {
        canvas.height = resolvedPixelHeight;
    }

    const nextWidthStyle = `${resolvedCssWidth}px`;
    const nextHeightStyle = `${resolvedCssHeight}px`;
    if (canvas.style.width !== nextWidthStyle) {
        canvas.style.width = nextWidthStyle;
    }
    if (canvas.style.height !== nextHeightStyle) {
        canvas.style.height = nextHeightStyle;
    }

    return {
        cssWidth: resolvedCssWidth,
        cssHeight: resolvedCssHeight,
        pixelWidth: resolvedPixelWidth,
        pixelHeight: resolvedPixelHeight,
        pixelRatio: requirePixelRatio(pixelRatio),
    };
};
