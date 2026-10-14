import { nowMs } from './pixiWaterEffectsMath.js';

export const PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS = Object.freeze({
    DISABLED: 'disabled',
    LOADING: 'loading',
    READY: 'ready',
    FAILED: 'failed',
    DISPOSED: 'disposed',
});

const requireSignature = (value) => {
    const signature = typeof value === 'string' ? value.trim() : '';
    if (!signature) {
        throw new Error('ZEN_PIXI_WATER_EFFECTS_LAYER_SIGNATURE_REQUIRED');
    }
    return signature;
};

const normalizeErrorMessage = (error) => (
    String(
        error?.message
        || error
        || 'ZEN_PIXI_WATER_EFFECTS_LAYER_APPLY_FAILED',
    )
);

const roundTimingMs = (value) => (
    Number.isFinite(Number(value))
        ? Math.round(Number(value) * 10) / 10
        : null
);

const createEmptyTransitionTimings = () => Object.freeze({
    totalMs: null,
    loadFactoryMs: null,
    buildLayerMs: null,
    activateLayerMs: null,
});

export const createPixiWaterEffectsLayerTransition = ({
    loadFactory,
    buildLayer,
    activateLayer,
    deactivateLayer,
    isDisposed = null,
} = {}) => {
    if (typeof loadFactory !== 'function') {
        throw new Error('ZEN_PIXI_WATER_EFFECTS_LAYER_FACTORY_LOADER_REQUIRED');
    }
    if (typeof buildLayer !== 'function') {
        throw new Error('ZEN_PIXI_WATER_EFFECTS_LAYER_BUILDER_REQUIRED');
    }
    if (typeof activateLayer !== 'function') {
        throw new Error('ZEN_PIXI_WATER_EFFECTS_LAYER_ACTIVATOR_REQUIRED');
    }
    if (typeof deactivateLayer !== 'function') {
        throw new Error('ZEN_PIXI_WATER_EFFECTS_LAYER_DEACTIVATOR_REQUIRED');
    }

    let generation = 0;
    let requested = false;
    let requestedSignature = '';
    let activeSignature = '';
    let status = PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.DISABLED;
    let errorMessage = '';
    let pendingSignature = '';
    let pendingPromise = null;
    let disposed = false;
    let lastTimings = createEmptyTransitionTimings();

    const runtimeDisposed = () => (
        disposed
        || (typeof isDisposed === 'function' && isDisposed() === true)
    );

    const snapshot = () => Object.freeze({
        generation,
        requested,
        requestedSignature,
        activeSignature,
        status,
        ready: (
            requested !== true
                ? status === PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.DISABLED
                : (
                    status === PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.READY
                    && activeSignature === requestedSignature
                )
        ),
        pending: status === PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.LOADING,
        failed: status === PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.FAILED,
        error: errorMessage,
        timings: lastTimings,
    });

    const disable = ({
        preserveTemporalState = true,
    } = {}) => {
        if (runtimeDisposed()) {
            return snapshot();
        }
        if (
            requested !== true
            && activeSignature === ''
            && status === PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.DISABLED
        ) {
            return snapshot();
        }
        generation += 1;
        requested = false;
        requestedSignature = '';
        pendingSignature = '';
        pendingPromise = null;
        errorMessage = '';
        try {
            deactivateLayer({ preserveTemporalState });
            activeSignature = '';
            status = PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.DISABLED;
        } catch (error) {
            errorMessage = normalizeErrorMessage(error);
            status = PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.FAILED;
            throw new Error(
                `ZEN_PIXI_WATER_EFFECTS_LAYER_DISABLE_FAILED:${errorMessage}`,
            );
        }
        return snapshot();
    };

    const request = ({
        signature,
        context = null,
    } = {}) => {
        if (runtimeDisposed()) {
            throw new Error('ZEN_PIXI_WATER_EFFECTS_LAYER_TRANSITION_DISPOSED');
        }
        const nextSignature = requireSignature(signature);
        if (
            status === PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.FAILED
            && requestedSignature === nextSignature
        ) {
            throw new Error(
                `ZEN_PIXI_WATER_EFFECTS_LAYER_APPLY_FAILED:${errorMessage}`,
            );
        }
        requested = true;
        requestedSignature = nextSignature;

        if (
            status === PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.READY
            && activeSignature === nextSignature
        ) {
            return null;
        }
        if (
            status === PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.LOADING
            && pendingSignature === nextSignature
            && pendingPromise
        ) {
            return pendingPromise;
        }
        generation += 1;
        const requestGeneration = generation;
        const requestStartedMs = nowMs();
        const requestTimings = {
            totalMs: null,
            loadFactoryMs: null,
            buildLayerMs: null,
            activateLayerMs: null,
        };
        const publishRequestTimings = () => {
            if (requestGeneration !== generation) return;
            lastTimings = Object.freeze({
                totalMs: roundTimingMs(requestTimings.totalMs),
                loadFactoryMs: roundTimingMs(requestTimings.loadFactoryMs),
                buildLayerMs: roundTimingMs(requestTimings.buildLayerMs),
                activateLayerMs: roundTimingMs(requestTimings.activateLayerMs),
            });
        };
        lastTimings = createEmptyTransitionTimings();
        pendingSignature = nextSignature;
        errorMessage = '';
        status = PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.LOADING;

        let loadFactoryStartedMs = null;
        const applyPromise = Promise.resolve()
            .then(() => {
                loadFactoryStartedMs = nowMs();
                return loadFactory();
            })
            .then((factory) => {
                requestTimings.loadFactoryMs = nowMs() - loadFactoryStartedMs;
                publishRequestTimings();
                if (
                    runtimeDisposed()
                    || requestGeneration !== generation
                    || requested !== true
                    || requestedSignature !== nextSignature
                ) {
                    return snapshot();
                }
                if (typeof factory !== 'function') {
                    throw new Error('ZEN_PIXI_WATER_EFFECTS_LAYER_FACTORY_INVALID');
                }
                const buildLayerStartedMs = nowMs();
                const nextLayer = buildLayer(factory, context);
                requestTimings.buildLayerMs = nowMs() - buildLayerStartedMs;
                publishRequestTimings();
                if (!nextLayer || typeof nextLayer !== 'object') {
                    throw new Error('ZEN_PIXI_WATER_EFFECTS_LAYER_BUILD_INVALID');
                }
                if (
                    runtimeDisposed()
                    || requestGeneration !== generation
                    || requested !== true
                    || requestedSignature !== nextSignature
                ) {
                    nextLayer.destroy?.();
                    return snapshot();
                }
                const previousActiveSignature = activeSignature;
                try {
                    const activateLayerStartedMs = nowMs();
                    activateLayer(nextLayer, {
                        signature: nextSignature,
                        context,
                    });
                    requestTimings.activateLayerMs = nowMs() - activateLayerStartedMs;
                    publishRequestTimings();
                } catch (error) {
                    activeSignature = typeof error?.waterLayerActiveSignature
                        === 'string'
                        ? error.waterLayerActiveSignature
                        : previousActiveSignature;
                    throw error;
                }
                activeSignature = nextSignature;
                pendingSignature = '';
                errorMessage = '';
                status = PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.READY;
                requestTimings.totalMs = nowMs() - requestStartedMs;
                publishRequestTimings();
                return snapshot();
            })
            .catch((error) => {
                requestTimings.totalMs = nowMs() - requestStartedMs;
                publishRequestTimings();
                if (
                    runtimeDisposed()
                    || requestGeneration !== generation
                    || requestedSignature !== nextSignature
                ) {
                    return snapshot();
                }
                pendingSignature = '';
                errorMessage = normalizeErrorMessage(error);
                status = PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.FAILED;
                throw new Error(
                    `ZEN_PIXI_WATER_EFFECTS_LAYER_APPLY_FAILED:${errorMessage}`,
                );
            })
            .finally(() => {
                if (pendingPromise === applyPromise) {
                    pendingPromise = null;
                }
            });
        pendingPromise = applyPromise;
        return applyPromise;
    };

    const dispose = () => {
        if (disposed) return snapshot();
        generation += 1;
        disposed = true;
        requested = false;
        requestedSignature = '';
        pendingSignature = '';
        pendingPromise = null;
        errorMessage = '';
        let disposeError = null;
        try {
            deactivateLayer({ preserveTemporalState: false });
        } catch (error) {
            disposeError = error;
            errorMessage = normalizeErrorMessage(error);
        } finally {
            activeSignature = '';
            status = PIXI_WATER_EFFECTS_LAYER_APPLY_STATUS.DISPOSED;
        }
        if (disposeError) {
            throw new Error(
                `ZEN_PIXI_WATER_EFFECTS_LAYER_DISPOSE_FAILED:${errorMessage}`,
            );
        }
        return snapshot();
    };

    return Object.freeze({
        request,
        disable,
        dispose,
        snapshot,
    });
};
