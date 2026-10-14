import { Container, Renderer } from './zenPondPixiRuntime.js';

// Startup observation only. Native allocation/read results and errors stay authoritative.
export const createZenPondPixiRendererAdmissionDiagnostics = ({ nowMs }) => {
    if (typeof nowMs !== 'function') throw new Error('ZEN_POND_PIXI_ADMISSION_CLOCK_REQUIRED');
    const stages = {
        constructor: { atMs: null, totalMs: null, failed: false },
        stencil: { atMs: null, totalMs: null, failed: false },
    };
    let observationFailureCount = 0;
    let lastObservationFailureName = null;
    const recordObservationFailure = (error) => {
        observationFailureCount += 1;
        lastObservationFailureName = typeof error?.name === 'string' ? error.name.slice(0, 80) : 'Error';
    };
    const readClock = () => {
        try {
            const value = nowMs();
            if (!Number.isFinite(value) || value < 0) throw new RangeError('ZEN_POND_PIXI_ADMISSION_CLOCK_INVALID');
            return value;
        } catch (error) {
            recordObservationFailure(error);
            return null;
        }
    };
    const measure = (stage, operation) => {
        stage.atMs = readClock();
        try {
            return operation();
        } catch (error) {
            stage.failed = true;
            throw error;
        } finally {
            const endMs = readClock();
            if (stage.atMs !== null && endMs !== null) {
                if (endMs >= stage.atMs) stage.totalMs = Number((endMs - stage.atMs).toFixed(4));
                else recordObservationFailure(new RangeError('ZEN_POND_PIXI_ADMISSION_CLOCK_REGRESSED'));
            }
        }
    };
    return Object.freeze({
        measureConstructor: (operation) => measure(stages.constructor, operation),
        measureStencilRead: (operation) => measure(stages.stencil, operation),
        snapshot: (contextUid = null) => Object.freeze({
            enabled: true,
            contextUid: Number.isInteger(contextUid) && contextUid >= 0 ? contextUid : null,
            constructorAtMs: stages.constructor.atMs,
            constructorMs: stages.constructor.totalMs,
            constructorFailed: stages.constructor.failed,
            stencilAtMs: stages.stencil.atMs,
            stencilReadMs: stages.stencil.totalMs,
            stencilReadFailed: stages.stencil.failed,
            observationFailureCount,
            lastObservationFailureName,
            timingScope: 'Original public Pixi Renderer constructor and required host stencil-read wall time, including driver waits; not GPU execution time.',
        }),
    });
};

// Pond owns its frame loop and viewport; admission creates only its real WebGL renderer.
export const createZenPondPixiRendererHost = (options, admissionDiagnostics = null) => {
    const rendererOptions = { ...options, zenPondSpriteBatchDialect: true, zenPondTilingSpriteDialect: true };
    const renderer = admissionDiagnostics
        ? admissionDiagnostics.measureConstructor(() => new Renderer(rendererOptions))
        : new Renderer(rendererOptions);
    let stage;
    try {
        const readContextAttributes = () => renderer.gl?.getContextAttributes?.();
        const contextAttributes = admissionDiagnostics
            ? admissionDiagnostics.measureStencilRead(readContextAttributes)
            : readContextAttributes();
        if (contextAttributes?.stencil !== true) {
            throw new Error('ZEN_POND_PIXI_STENCIL_REQUIRED');
        }
        stage = new Container();
    } catch (error) {
        try {
            renderer.destroy(false);
        } catch (cleanupError) {
            const creationFailure = String(error?.message ?? error).slice(0, 256);
            const failure = new AggregateError(
                [error, cleanupError],
                `ZEN_POND_PIXI_RENDERER_HOST_CREATE_FAILED:${creationFailure}`,
                { cause: error },
            );
            failure.code = 'ZEN_POND_PIXI_RENDERER_HOST_CREATE_FAILED';
            throw failure;
        }
        throw error;
    }

    const host = {
        renderer,
        stage,
        getRendererAdmissionDiagnostics: admissionDiagnostics
            ? () => admissionDiagnostics.snapshot(renderer.CONTEXT_UID)
            : undefined,
        get view() {
            return host.renderer?.view;
        },
        destroy(removeView = false, stageOptions) {
            const errors = [];
            try {
                host.stage?.destroy(stageOptions);
            } catch (error) {
                errors.push(error);
            } finally {
                host.stage = null;
            }
            try {
                host.renderer?.destroy(removeView);
            } catch (error) {
                errors.push(error);
            } finally {
                host.renderer = null;
            }
            if (errors.length > 0) {
                throw new AggregateError(
                    errors,
                    'ZEN_POND_PIXI_RENDERER_HOST_DISPOSE_FAILED',
                    { cause: errors[0] },
                );
            }
        },
    };
    return host;
};
