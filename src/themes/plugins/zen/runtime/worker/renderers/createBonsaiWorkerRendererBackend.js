import {
    ZEN_BONSAI_WORKER_RENDER_BACKENDS,
} from '../zenBonsaiWorkerProtocol.js';
import {
    zenBonsaiG15PixiRendererModuleAdmission,
    zenBonsaiPlumePixiRendererModuleAdmission,
    zenBonsaiPixiRendererModuleAdmission,
} from './zenBonsaiPixiRendererModuleAdmission.js';

export const BONSAI_WORKER_RENDER_BACKENDS = ZEN_BONSAI_WORKER_RENDER_BACKENDS;

const BACKEND_LOADERS = Object.freeze({
    [BONSAI_WORKER_RENDER_BACKENDS.CANVAS_2D]: async () => (
        (await import('./createCanvas2dBonsaiWorkerRenderer.js')).createCanvas2dBonsaiWorkerRenderer
    ),
    [BONSAI_WORKER_RENDER_BACKENDS.PIXI]: () => (
        zenBonsaiPixiRendererModuleAdmission.loadRendererFactory()
    ),
    [BONSAI_WORKER_RENDER_BACKENDS.PIXI_G15]: () => (
        zenBonsaiG15PixiRendererModuleAdmission.loadRendererFactory()
    ),
    [BONSAI_WORKER_RENDER_BACKENDS.PIXI_PLUME]: () => zenBonsaiPlumePixiRendererModuleAdmission.loadRendererFactory(),
});

export function resolveBonsaiWorkerRenderBackend(value) {
    const backend = typeof value === 'string' ? value.trim() : '';
    if (backend === BONSAI_WORKER_RENDER_BACKENDS.CANVAS_2D) {
        return BONSAI_WORKER_RENDER_BACKENDS.CANVAS_2D;
    }
    if (backend === BONSAI_WORKER_RENDER_BACKENDS.PIXI) {
        return BONSAI_WORKER_RENDER_BACKENDS.PIXI;
    }
    if (backend === BONSAI_WORKER_RENDER_BACKENDS.PIXI_G15) {
        return BONSAI_WORKER_RENDER_BACKENDS.PIXI_G15;
    }
    if (backend === BONSAI_WORKER_RENDER_BACKENDS.PIXI_PLUME) return BONSAI_WORKER_RENDER_BACKENDS.PIXI_PLUME;
    throw new Error(`ZEN_BONSAI_WORKER_RENDER_BACKEND_INVALID:${backend || 'missing'}`);
}

export async function createBonsaiWorkerRendererBackend({
    renderBackend,
    canvas,
} = {}) {
    const backend = resolveBonsaiWorkerRenderBackend(renderBackend);
    const loadFactory = BACKEND_LOADERS[backend];
    const createRenderer = await loadFactory();
    const renderer = createRenderer({ canvas });
    if (
        !renderer
        || typeof renderer.render !== 'function'
        || typeof renderer.resize !== 'function'
        || typeof renderer.dispose !== 'function'
    ) {
        throw new Error(`ZEN_BONSAI_WORKER_RENDERER_CONTRACT_INVALID:${backend}`);
    }
    return renderer;
}
