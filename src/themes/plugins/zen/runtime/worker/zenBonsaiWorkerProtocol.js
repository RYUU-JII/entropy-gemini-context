export const ZEN_BONSAI_WORKER_PROTOCOL_VERSION = 'zen_bonsai_worker_protocol_v2';

export const ZEN_BONSAI_WORKER_MESSAGE_TYPE = Object.freeze({
    INIT: 'init',
    RESIZE: 'resize',
    SCENE: 'scene',
    ACTIVE: 'active',
    BLOOM_PRESENTATION: 'bloom_presentation',
    BLOOM_PRESENTATION_COMPLETE: 'bloom_presentation_complete',
    DISPOSE: 'dispose',
    READY: 'ready',
    FRAME_RENDERED: 'frame_rendered',
    ERROR: 'error',
});

export const ZEN_BONSAI_WORKER_RENDER_BACKENDS = Object.freeze({
    CANVAS_2D: 'canvas2d',
    PIXI: 'pixi',
    // G15.4 has its own render plan and command stream, so it has its own Pixi
    // backend rather than sharing the classic Sakura one.
    PIXI_G15: 'pixi_g15',
    PIXI_PLUME: 'pixi_plume',
});

export const ZEN_BONSAI_WORKER_RENDERER_LABELS = Object.freeze({
    [ZEN_BONSAI_WORKER_RENDER_BACKENDS.CANVAS_2D]: 'zen_bonsai_worker_canvas2d',
    [ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI]: 'zen_bonsai_worker_pixi',
    [ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_G15]: 'zen_bonsai_worker_pixi_g15',
    [ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_PLUME]: 'zen_bonsai_worker_pixi_plume',
});

export const ZEN_BONSAI_WORKER_RENDER_LOOP_MODES = Object.freeze({
    CONTINUOUS: 'continuous',
    DIRTY: 'dirty',
});

export function resolveZenBonsaiWorkerRendererLabel(renderBackend) {
    const label = ZEN_BONSAI_WORKER_RENDERER_LABELS[renderBackend];
    if (typeof label === 'string') {
        return label;
    }
    throw new Error(`ZEN_BONSAI_WORKER_RENDERER_LABEL_INVALID:${renderBackend || 'missing'}`);
}

export function requireZenBonsaiWorkerProtocolVersion(value) {
    if (value === ZEN_BONSAI_WORKER_PROTOCOL_VERSION) {
        return value;
    }
    throw new Error(`ZEN_BONSAI_WORKER_PROTOCOL_VERSION_MISMATCH:${value || 'missing'}`);
}

export function requireZenBonsaiMaterializationKey(value) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
        throw new Error('ZEN_BONSAI_MATERIALIZATION_KEY_REQUIRED');
    }
    return value;
}

export function requireZenBonsaiInputSignature(value) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
        throw new Error('ZEN_BONSAI_INPUT_SIGNATURE_REQUIRED');
    }
    return value;
}
