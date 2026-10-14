const roundMs = (value) => (
    Number.isFinite(Number(value))
        ? Math.round(Number(value) * 10) / 10
        : null
);

const requireRendererFactory = (module, factoryName) => {
    if (typeof module?.[factoryName] !== 'function') {
        throw new Error(`ZEN_BONSAI_PIXI_RENDERER_FACTORY_MISSING:${factoryName}`);
    }
    return module[factoryName];
};

const normalizeAdmissionError = (error) => {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = new Error(`ZEN_BONSAI_PIXI_RENDERER_MODULE_ADMISSION_FAILED:${message}`);
    normalized.cause = error;
    return normalized;
};

export const createZenBonsaiPixiRendererModuleAdmission = ({
    loadRendererModule = () => import('../../pixi/createPixiBonsaiRenderer.js'),
    factoryName = 'createPixiBonsaiRenderer',
    readNowMs = () => globalThis.performance.now(),
} = {}) => {
    let state = 'idle';
    let startedAtMs = null;
    let settledAtMs = null;
    let terminalPromise = null;

    const prepare = () => {
        if (terminalPromise) return terminalPromise;

        state = 'loading';
        startedAtMs = Number(readNowMs());
        terminalPromise = Promise.resolve().then(loadRendererModule).then((module) => {
            const createPixiBonsaiRenderer = requireRendererFactory(module, factoryName);
            settledAtMs = Number(readNowMs());
            state = 'ready';
            return Object.freeze({ createPixiBonsaiRenderer });
        }).catch((error) => {
            settledAtMs = Number(readNowMs());
            state = 'failed';
            throw normalizeAdmissionError(error);
        });
        return terminalPromise;
    };

    return Object.freeze({
        prepare,
        loadRendererFactory: async () => {
            const admitted = await prepare();
            return admitted.createPixiBonsaiRenderer;
        },
        getSnapshot: () => {
            const hasStart = startedAtMs !== null;
            const hasSettlement = settledAtMs !== null;
            const start = hasStart ? Number(startedAtMs) : Number.NaN;
            const settlement = hasSettlement ? Number(settledAtMs) : Number.NaN;
            return Object.freeze({
                state,
                startedAtMs: Number.isFinite(start) ? roundMs(start) : null,
                settledAtMs: Number.isFinite(settlement) ? roundMs(settlement) : null,
                durationMs: Number.isFinite(start) && Number.isFinite(settlement)
                    ? roundMs(settlement - start)
                    : null,
            });
        },
    });
};

export const zenBonsaiPixiRendererModuleAdmission = (
    createZenBonsaiPixiRendererModuleAdmission()
);

// G15.4's own Pixi backend. Kept as a separate admission so a failure to load
// one tree's renderer cannot be mistaken for the other's.
export const zenBonsaiG15PixiRendererModuleAdmission = (
    createZenBonsaiPixiRendererModuleAdmission({
        loadRendererModule: () => import('../../pixi/createZenBonsaiG15PixiRenderer.js'),
        factoryName: 'createZenBonsaiG15PixiRenderer',
    })
);

export const zenBonsaiPlumePixiRendererModuleAdmission = createZenBonsaiPixiRendererModuleAdmission({
    loadRendererModule: () => import('../../pixi/createZenBonsaiPlumePixiRenderer.js'),
    factoryName: 'createZenBonsaiPlumePixiRenderer',
});
