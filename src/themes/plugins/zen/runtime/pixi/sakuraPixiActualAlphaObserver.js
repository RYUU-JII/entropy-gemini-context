import {
  Matrix,
  RenderTexture,
} from '@/themes/plugins/zen/runtime/worker/zenPixiWorkerRuntime.js';

import {
    requireSakuraActualAlphaObservationRequestV1,
    scanSakuraActualAlphaObservationV1,
} from '../../model/bonsai/rendering/SakuraActualAlphaObservationContract.js';

const createCaptureTransform = (captureRect, viewportOrigin) => {
    const transform = new Matrix();
    transform.translate(
        -captureRect.x - viewportOrigin.x,
        -captureRect.y - viewportOrigin.y,
    );
    return transform;
};

const requireViewportOrigin = (value) => {
    const x = Number(value?.x);
    const y = Number(value?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error('ZEN_SAKURA_PIXI_ACTUAL_ALPHA_VIEWPORT_ORIGIN_INVALID');
    }
    return Object.freeze({ x, y });
};

/**
 * Reads the live Pixi tree rig before its viewport mask is applied.
 *
 * The caller must invoke this only after the requested scene frame completed.
 * `treeRoot` must be the branch-rig container, never app.stage/root, so the
 * backdrop, garden bed, pot, and final framebuffer cannot enter the sample.
 */
export function observeSakuraPixiActualAlphaV1({
    request,
    renderer,
    treeRoot,
    viewportOrigin = { x: 0, y: 0 },
    frameSequence = 0,
    frameCount = 0,
} = {}) {
    const resolvedRequest = requireSakuraActualAlphaObservationRequestV1(request);
    if (!renderer || typeof renderer.render !== 'function') {
        throw new Error('ZEN_SAKURA_PIXI_ACTUAL_ALPHA_RENDERER_REQUIRED');
    }
    if (typeof renderer?.extract?.pixels !== 'function') {
        throw new Error('ZEN_SAKURA_PIXI_ACTUAL_ALPHA_EXTRACTOR_REQUIRED');
    }
    if (!treeRoot || typeof treeRoot !== 'object') {
        throw new Error('ZEN_SAKURA_PIXI_ACTUAL_ALPHA_TREE_ROOT_REQUIRED');
    }
    if (treeRoot.visible !== true) {
        throw new Error('ZEN_SAKURA_PIXI_ACTUAL_ALPHA_TREE_ROOT_NOT_VISIBLE');
    }
    const resolvedViewportOrigin = requireViewportOrigin(viewportOrigin);

    const captureRect = resolvedRequest.captureRect;
    const renderTexture = RenderTexture.create({
        width: captureRect.width,
        height: captureRect.height,
        resolution: 1,
    });
    if (!renderTexture || typeof renderTexture.destroy !== 'function') {
        throw new Error('ZEN_SAKURA_PIXI_ACTUAL_ALPHA_RENDER_TEXTURE_UNAVAILABLE');
    }

    const retainedMask = treeRoot.mask;
    try {
        treeRoot.mask = null;
        renderer.render(treeRoot, {
            renderTexture,
            clear: true,
            transform: createCaptureTransform(captureRect, resolvedViewportOrigin),
            skipUpdateTransform: false,
        });
        const data = renderer.extract.pixels(renderTexture);
        return scanSakuraActualAlphaObservationV1({
            request: resolvedRequest,
            pixels: {
                width: captureRect.width,
                height: captureRect.height,
                data,
            },
            frameSequence,
            frameCount,
        });
    } finally {
        treeRoot.mask = retainedMask;
        renderTexture.destroy(true);
    }
}

export default observeSakuraPixiActualAlphaV1;
