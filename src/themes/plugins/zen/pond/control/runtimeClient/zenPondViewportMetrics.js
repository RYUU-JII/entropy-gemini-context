export const createZenPondViewportMetrics = ({ width, height, dpr }) => {
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        throw new Error('ZEN_POND_VIEWPORT_SIZE_INVALID');
    }
    if (!Number.isFinite(dpr) || dpr <= 0) {
        throw new Error('ZEN_POND_DEVICE_PIXEL_RATIO_INVALID');
    }
    return { width, height, dpr, signature: `${width}x${height}@${dpr}` };
};
