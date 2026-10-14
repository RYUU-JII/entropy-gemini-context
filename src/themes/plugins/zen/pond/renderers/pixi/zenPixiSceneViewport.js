import { resolveZenPondRenderResolution, resolveZenPondWorldResolution } from '../../runtime/zenPondViewportPolicy.js';

const toViewportExtent = (value, fallback) => (
    Math.max(1, Math.round(Number(value) || fallback))
);

export const applyZenPixiSceneViewport = ({
    renderer,
    worldRenderTexture,
    worldFilterSize,
    currentViewport,
    nextViewport,
    dprCap,
    maxRenderPixels,
} = {}) => {
    if (!renderer || typeof renderer.resize !== 'function') {
        throw new Error('ZEN_PIXI_SCENE_VIEWPORT_RENDERER_REQUIRED');
    }
    const currentWidth = toViewportExtent(currentViewport?.width, 1);
    const currentHeight = toViewportExtent(currentViewport?.height, 1);
    const nextWidth = toViewportExtent(nextViewport?.width, currentWidth);
    const nextHeight = toViewportExtent(nextViewport?.height, currentHeight);
    const nextDevicePixelRatio = Number(nextViewport?.devicePixelRatio);
    const nextResolution = resolveZenPondRenderResolution({
        width: nextWidth, height: nextHeight,
        devicePixelRatio: nextDevicePixelRatio,
        dprCap,
        maxRenderPixels,
    });
    const currentResolution = Number(currentViewport?.resolution);
    if (!Number.isFinite(currentResolution) || currentResolution <= 0) {
        throw new Error('ZEN_PIXI_SCENE_VIEWPORT_RESOLUTION_REQUIRED');
    }
    const resolutionChanged = Math.abs(nextResolution - currentResolution) > 0.001;
    const changed = (
        nextWidth !== currentWidth
        || nextHeight !== currentHeight
        || resolutionChanged
    );

    if (!worldRenderTexture || typeof worldRenderTexture.setResolution !== 'function') {
        throw new Error('ZEN_PIXI_SCENE_WORLD_RENDER_TEXTURE_REQUIRED');
    }
    const worldWidth = toViewportExtent(worldFilterSize?.width, 1);
    const worldHeight = toViewportExtent(worldFilterSize?.height, 1);
    const worldResolution = resolveZenPondWorldResolution({
        worldWidth, worldHeight, width: nextWidth, height: nextHeight, resolution: nextResolution,
        maxRenderPixels,
    });
    if (worldRenderTexture.baseTexture?.resolution !== worldResolution) {
        worldRenderTexture.setResolution(worldResolution);
        worldRenderTexture.resize(worldWidth, worldHeight, true);
    }
    if (resolutionChanged) renderer.resolution = nextResolution;
    if (changed) {
        renderer.resize(nextWidth, nextHeight);
    }

    return Object.freeze({
        changed,
        width: nextWidth,
        height: nextHeight,
        devicePixelRatio: nextDevicePixelRatio,
        resolution: nextResolution,
        resolutionChanged,
    });
};
