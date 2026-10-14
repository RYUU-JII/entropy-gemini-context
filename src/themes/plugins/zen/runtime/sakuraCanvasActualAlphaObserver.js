import {
    requireSakuraActualAlphaObservationRequestV1,
    scanSakuraActualAlphaObservationV1,
} from '../model/bonsai/rendering/SakuraActualAlphaObservationContract.js';
import {
    SAKURA_RENDER_LAYERS,
} from '../model/sakura/sakuraRenderer.js';
import {
    SAKURA_TREE_CONTENT_LAYERS,
} from '../model/sakura/sakuraRenderBranchLayer.js';

const createObservationCamera = (camera, captureRect) => {
    const offsetX = Number(camera?.offsetX);
    const offsetY = Number(camera?.offsetY);
    const scale = Number(camera?.scale);
    if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY) || !Number.isFinite(scale)) {
        throw new Error('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CAMERA_INVALID');
    }
    return {
        scale,
        offsetX: offsetX - captureRect.x,
        offsetY: offsetY - captureRect.y,
        originScreen: {
            x: offsetX - captureRect.x,
            y: offsetY - captureRect.y,
        },
    };
};

export function observeSakuraCanvasActualAlphaV1({
    request,
    createCanvas,
    species,
    scene,
    assetCache,
    frameSequence = 0,
    frameCount = 0,
    windState = null,
} = {}) {
    const resolvedRequest = requireSakuraActualAlphaObservationRequestV1(request);
    if (typeof createCanvas !== 'function') {
        throw new Error('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CANVAS_FACTORY_REQUIRED');
    }
    if (!species || typeof species.render !== 'function') {
        throw new Error('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SPECIES_REQUIRED');
    }
    if (!scene?.topology || !scene?.renderPlan) {
        throw new Error('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCENE_REQUIRED');
    }
    const captureRect = resolvedRequest.captureRect;
    const canvas = createCanvas(captureRect.width, captureRect.height);
    if (!canvas) {
        throw new Error('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CANVAS_UNAVAILABLE');
    }
    canvas.width = captureRect.width;
    canvas.height = captureRect.height;
    const ctx = canvas.getContext('2d', {
        alpha: true,
        willReadFrequently: true,
    });
    if (!ctx || typeof ctx.getImageData !== 'function') {
        throw new Error('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CONTEXT_UNAVAILABLE');
    }
    ctx.clearRect(0, 0, captureRect.width, captureRect.height);
    species.render({
        ctx,
        topology: scene.topology,
        frameCount,
        currentStage: scene.currentStage,
        assetCache,
        wind: windState,
        camera: createObservationCamera(scene.camera, captureRect),
        options: {
            ...(scene.renderOptions || {}),
            renderPlan: scene.renderPlan,
            renderLayer: SAKURA_RENDER_LAYERS.TREE,
            renderTreeContent: SAKURA_TREE_CONTENT_LAYERS.ALL,
            renderBackdrop: false,
            skipPot: true,
            showGroundBranchShadow: false,
            homeGardenBedProjection: null,
            treePaintObservationMode: true,
        },
    });
    const pixels = ctx.getImageData(0, 0, captureRect.width, captureRect.height);
    return scanSakuraActualAlphaObservationV1({
        request: resolvedRequest,
        pixels,
        frameSequence,
        frameCount,
    });
}

export default observeSakuraCanvasActualAlphaV1;
