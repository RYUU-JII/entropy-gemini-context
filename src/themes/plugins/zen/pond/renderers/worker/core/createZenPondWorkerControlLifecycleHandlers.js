export const createZenPondWorkerControlLifecycleHandlers = ({
    runtimeState,
    buildMetrics,
    respondResult,
    stopEngine,
    resetRuntimeState,
    sessionGate,
} = {}) => {
    const handleFlushMetrics = (id) => {
        respondResult(id, {
            metrics: buildMetrics(runtimeState),
        });
    };

    const handleDispose = (id) => {
        const metrics = buildMetrics(runtimeState);
        stopEngine(runtimeState, { keepData: false });
        resetRuntimeState(runtimeState);
        sessionGate.reset();
        respondResult(id, {
            disposed: true,
            metrics,
        });
    };

    return {
        handleFlushMetrics,
        handleDispose,
    };
};

