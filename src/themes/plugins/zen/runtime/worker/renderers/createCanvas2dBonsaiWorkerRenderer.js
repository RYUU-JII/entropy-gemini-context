import {
    createAssetCache,
    resolveRenderSpecies,
} from '../../../model/ZenCoreConfigAssetCache.js';
import {
    ZEN_BONSAI_WORKER_RENDER_BACKENDS,
    resolveZenBonsaiWorkerRendererLabel,
} from '../zenBonsaiWorkerProtocol.js';
import { observeSakuraCanvasActualAlphaV1 } from '../../sakuraCanvasActualAlphaObserver.js';
import {ZenBonsaiPlumeRenderSpecies} from '../../../model/bonsai/plume/ZenBonsaiPlumeRenderSpecies.js';
import { releaseZenBonsaiRainCanvas } from '../../rain/zenRainCanvas.js';

const RENDERER_NAME = resolveZenBonsaiWorkerRendererLabel(
    ZEN_BONSAI_WORKER_RENDER_BACKENDS.CANVAS_2D,
);

const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clampPixelExtent = (value) => Math.max(1, Math.round(toNumber(value, 1)));
const nowPerfMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);
const roundMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Number(numeric.toFixed(2)));
};
const clampPixelRatio = (value) => {
    const ratio = Number(value);
    if (!Number.isFinite(ratio) || ratio <= 0) {
        return 1;
    }
    return Math.min(3, ratio);
};

const createWorkerAssetCache = () => {
    if (typeof OffscreenCanvas !== 'function') {
        throw new Error('ZEN_BONSAI_WORKER_OFFSCREEN_CANVAS_UNAVAILABLE');
    }
    return createAssetCache({
        createCanvas: (width, height) => new OffscreenCanvas(
            clampPixelExtent(width),
            clampPixelExtent(height),
        ),
    });
};

export function createCanvas2dBonsaiWorkerRenderer({ canvas } = {}) {
    if (!canvas) {
        throw new Error('ZEN_BONSAI_CANVAS2D_CANVAS_MISSING');
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
        throw new Error('ZEN_BONSAI_WORKER_2D_CONTEXT_UNAVAILABLE');
    }

    const assetCache = createWorkerAssetCache();
    let disposed = false;
    let sizeState = {
        pixelWidth: clampPixelExtent(canvas.width),
        pixelHeight: clampPixelExtent(canvas.height),
        pixelRatio: 1,
    };

    const resize = (nextSizeState = {}) => {
        if (disposed) return;
        sizeState = {
            pixelWidth: clampPixelExtent(nextSizeState.pixelWidth),
            pixelHeight: clampPixelExtent(nextSizeState.pixelHeight),
            pixelRatio: clampPixelRatio(nextSizeState.pixelRatio),
        };
        if (canvas.width !== sizeState.pixelWidth) {
            canvas.width = sizeState.pixelWidth;
        }
        if (canvas.height !== sizeState.pixelHeight) {
            canvas.height = sizeState.pixelHeight;
        }
    };

    const render = ({
        scene,
        frameCount = 0,
        windState = null,
        bloomPresentationProgress = null,
        bloomInvitation = null,
    } = {}) => {
        const renderStartedAtMs = nowPerfMs();
        if (disposed || !scene?.topology) {
            return {
                renderer: RENDERER_NAME,
                rendered: false,
                timing: {
                    totalMs: roundMs(nowPerfMs() - renderStartedAtMs),
                },
            };
        }

        const species = scene.topology?.engine === 'plume' ? ZenBonsaiPlumeRenderSpecies : resolveRenderSpecies(scene.treeType || 'sakura');
        const clearStartMs = nowPerfMs();
        ctx.clearRect(0, 0, sizeState.pixelWidth, sizeState.pixelHeight);
        const clearEndMs = nowPerfMs();
        const speciesRenderStartMs = nowPerfMs();
        species.render({
            ctx,
            topology: scene.topology,
            frameCount,
            pixelRatio: sizeState.pixelRatio,
            currentStage: scene.currentStage,
            assetCache,
            wind: windState,
            bloomPresentationProgress,
            bloomInvitation,
            camera: scene.camera || null,
            options: {
                ...(scene.renderOptions || {}),
                renderPlan: scene.renderPlan,
            },
        });
        const speciesRenderEndMs = nowPerfMs();

        return {
            renderer: RENDERER_NAME,
            rendered: true,
            timing: {
                clearMs: roundMs(clearEndMs - clearStartMs),
                speciesRenderMs: roundMs(speciesRenderEndMs - speciesRenderStartMs),
                totalMs: roundMs(speciesRenderEndMs - renderStartedAtMs),
            },
        };
    };

    const dispose = () => {
        if (disposed) return;
        disposed = true;
        releaseZenBonsaiRainCanvas(ctx);
    };

    const observeActualAlpha = ({
        request,
        scene,
        frameSequence = 0,
        frameCount = 0,
        windState = null,
    } = {}) => {
        if (disposed) {
            throw new Error('ZEN_BONSAI_CANVAS2D_ALPHA_OBSERVER_DISPOSED');
        }
        const species = resolveRenderSpecies(scene?.treeType || 'sakura');
        return observeSakuraCanvasActualAlphaV1({
            request,
            createCanvas: (width, height) => new OffscreenCanvas(width, height),
            species,
            scene,
            assetCache,
            frameSequence,
            frameCount,
            windState,
        });
    };

    return {
        renderer: RENDERER_NAME,
        render,
        observeActualAlpha,
        resize,
        dispose,
    };
}
