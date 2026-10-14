import { BLEND_MODES } from './zenPondPixiRuntime.js';
import { createPixiSurfaceSourceBakeRuntime } from './pixiSurfaceSourceBakeRuntime.js';

export const buildPixiDecorBakeSignature = (container) => JSON.stringify([
    container.alpha,
    ...container.children.map((mesh) => {
        if (typeof mesh.getBakeContentSignature !== 'function') {
            throw new Error('ZEN_DECOR_BAKE_CONTENT_OWNER_REQUIRED');
        }
        return [
            mesh.visible, mesh.alpha, mesh.tint, mesh.x, mesh.y, mesh.rotation,
            mesh.scale.x, mesh.scale.y, mesh.getBakeContentSignature(),
        ];
    }),
]);

export const createPixiDecorBakeRuntime = ({ renderer, width, height, container, shadow }) => {
    if (!container?.parent || typeof shadow !== 'boolean') throw new Error('ZEN_DECOR_BAKE_SOURCE_REQUIRED');
    return createPixiSurfaceSourceBakeRuntime({
        renderer,
        width,
        height,
        surfaceFilterContainer: container,
        renderContainer: container,
        spriteParentContainer: container.parent,
        spriteInsertIndex: container.parent.getChildIndex(container),
        requiredSourceContainer: container,
        sourceContainers: [container],
        // A cast is an RGB light transfer. Compose onto opaque white, then
        // multiply the cached result at the original position above caustics.
        // Transparent black would destroy the transfer on the first bake.
        clearColor: shadow ? [1, 1, 1, 1] : [0, 0, 0, 0],
        bakedSpriteBlendMode: shadow ? BLEND_MODES.MULTIPLY : BLEND_MODES.NORMAL,
        getSourceContentSignature: () => buildPixiDecorBakeSignature(container),
        getSourceBounds: () => container.getLocalBounds(),
    });
};
