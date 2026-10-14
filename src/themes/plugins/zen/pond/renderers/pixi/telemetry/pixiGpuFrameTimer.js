const GPU_TIME_NS_PER_MS = 1_000_000;
const DEFAULT_MAX_PENDING_QUERIES = 4;

const roundMs = (value) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Number(Math.max(0, numeric).toFixed(4));
};

const createUnsupportedSnapshot = (reason, {
    enabled = false,
} = {}) => Object.freeze({
    enabled,
    supported: false,
    api: null,
    reason,
    pendingQueryCount: 0,
    sampleCount: 0,
    disjointCount: 0,
    droppedFrameCount: 0,
    failedQueryCount: 0,
    lastGpuMs: null,
    avgGpuMs: null,
    minGpuMs: null,
    maxGpuMs: null,
});

const resolveTimerQueryApi = (gl) => {
    if (!gl || typeof gl.getExtension !== 'function') {
        return null;
    }
    const webgl2Extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (
        webgl2Extension
        && typeof gl.createQuery === 'function'
        && typeof gl.beginQuery === 'function'
        && typeof gl.endQuery === 'function'
        && typeof gl.getQueryParameter === 'function'
        && typeof gl.deleteQuery === 'function'
    ) {
        return Object.freeze({
            id: 'webgl2_ext_disjoint_timer_query',
            extension: webgl2Extension,
            timeElapsedTarget: webgl2Extension.TIME_ELAPSED_EXT,
            disjointParameter: webgl2Extension.GPU_DISJOINT_EXT,
            createQuery: () => gl.createQuery(),
            beginQuery: (query) => gl.beginQuery(
                webgl2Extension.TIME_ELAPSED_EXT,
                query,
            ),
            endQuery: () => gl.endQuery(webgl2Extension.TIME_ELAPSED_EXT),
            isResultAvailable: (query) => (
                gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) === true
            ),
            readResultNs: (query) => gl.getQueryParameter(
                query,
                gl.QUERY_RESULT,
            ),
            deleteQuery: (query) => gl.deleteQuery(query),
        });
    }

    const webgl1Extension = gl.getExtension('EXT_disjoint_timer_query');
    if (
        webgl1Extension
        && typeof webgl1Extension.createQueryEXT === 'function'
        && typeof webgl1Extension.beginQueryEXT === 'function'
        && typeof webgl1Extension.endQueryEXT === 'function'
        && typeof webgl1Extension.getQueryObjectEXT === 'function'
        && typeof webgl1Extension.deleteQueryEXT === 'function'
    ) {
        return Object.freeze({
            id: 'webgl1_ext_disjoint_timer_query',
            extension: webgl1Extension,
            timeElapsedTarget: webgl1Extension.TIME_ELAPSED_EXT,
            disjointParameter: webgl1Extension.GPU_DISJOINT_EXT,
            createQuery: () => webgl1Extension.createQueryEXT(),
            beginQuery: (query) => webgl1Extension.beginQueryEXT(
                webgl1Extension.TIME_ELAPSED_EXT,
                query,
            ),
            endQuery: () => webgl1Extension.endQueryEXT(
                webgl1Extension.TIME_ELAPSED_EXT,
            ),
            isResultAvailable: (query) => (
                webgl1Extension.getQueryObjectEXT(
                    query,
                    webgl1Extension.QUERY_RESULT_AVAILABLE_EXT,
                ) === true
            ),
            readResultNs: (query) => webgl1Extension.getQueryObjectEXT(
                query,
                webgl1Extension.QUERY_RESULT_EXT,
            ),
            deleteQuery: (query) => webgl1Extension.deleteQueryEXT(query),
        });
    }
    return null;
};

export const createPixiGpuFrameTimer = ({
    renderer = null,
    enabled = false,
    maxPendingQueries = DEFAULT_MAX_PENDING_QUERIES,
} = {}) => {
    if (enabled !== true) {
        const snapshot = createUnsupportedSnapshot('telemetry_disabled');
        return Object.freeze({
            begin: () => false,
            end: () => false,
            snapshot: () => snapshot,
            dispose: () => false,
        });
    }

    const gl = renderer?.gl || null;
    const api = resolveTimerQueryApi(gl);
    if (!api) {
        const snapshot = createUnsupportedSnapshot(
            gl ? 'timer_query_extension_unavailable' : 'webgl_context_unavailable',
            { enabled: true },
        );
        return Object.freeze({
            begin: () => false,
            end: () => false,
            snapshot: () => snapshot,
            dispose: () => false,
        });
    }

    const pendingQueries = [];
    const pendingLimit = Math.max(
        1,
        Math.min(16, Math.floor(Number(maxPendingQueries) || DEFAULT_MAX_PENDING_QUERIES)),
    );
    let activeQuery = null;
    let disposed = false;
    let reason = 'collecting';
    let sampleCount = 0;
    let disjointCount = 0;
    let droppedFrameCount = 0;
    let failedQueryCount = 0;
    let lastGpuMs = null;
    let totalGpuMs = 0;
    let minGpuMs = null;
    let maxGpuMs = null;

    const deleteQuery = (query) => {
        if (!query) return;
        try {
            api.deleteQuery(query);
        } catch (_) {
            failedQueryCount += 1;
        }
    };

    const poll = () => {
        if (disposed || pendingQueries.length === 0) return;
        let disjoint = false;
        try {
            disjoint = gl.getParameter(api.disjointParameter) === true;
        } catch (_) {
            failedQueryCount += 1;
            reason = 'disjoint_state_read_failed';
            return;
        }
        if (disjoint) {
            disjointCount += 1;
            reason = 'gpu_disjoint';
            while (pendingQueries.length > 0) {
                deleteQuery(pendingQueries.shift());
            }
            return;
        }

        while (pendingQueries.length > 0) {
            const query = pendingQueries[0];
            let available = false;
            try {
                available = api.isResultAvailable(query);
            } catch (_) {
                failedQueryCount += 1;
                reason = 'query_availability_read_failed';
                pendingQueries.shift();
                deleteQuery(query);
                continue;
            }
            if (!available) break;
            pendingQueries.shift();
            try {
                const elapsedNs = Number(api.readResultNs(query));
                const gpuMs = elapsedNs / GPU_TIME_NS_PER_MS;
                if (!Number.isFinite(gpuMs) || gpuMs < 0) {
                    throw new Error('PIXEL_GPU_TIMER_RESULT_INVALID');
                }
                sampleCount += 1;
                lastGpuMs = gpuMs;
                totalGpuMs += gpuMs;
                minGpuMs = minGpuMs === null ? gpuMs : Math.min(minGpuMs, gpuMs);
                maxGpuMs = maxGpuMs === null ? gpuMs : Math.max(maxGpuMs, gpuMs);
                reason = 'ok';
            } catch (_) {
                failedQueryCount += 1;
                reason = 'query_result_read_failed';
            } finally {
                deleteQuery(query);
            }
        }
    };

    const begin = () => {
        if (disposed || activeQuery !== null) return false;
        poll();
        if (pendingQueries.length >= pendingLimit) {
            droppedFrameCount += 1;
            reason = 'pending_query_limit';
            return false;
        }
        try {
            const query = api.createQuery();
            if (!query) {
                failedQueryCount += 1;
                reason = 'query_create_failed';
                return false;
            }
            api.beginQuery(query);
            activeQuery = query;
            return true;
        } catch (_) {
            if (activeQuery) deleteQuery(activeQuery);
            activeQuery = null;
            failedQueryCount += 1;
            reason = 'query_begin_failed';
            return false;
        }
    };

    const end = () => {
        if (disposed || activeQuery === null) return false;
        const query = activeQuery;
        activeQuery = null;
        try {
            api.endQuery();
            pendingQueries.push(query);
            poll();
            return true;
        } catch (_) {
            deleteQuery(query);
            failedQueryCount += 1;
            reason = 'query_end_failed';
            return false;
        }
    };

    const snapshot = () => {
        poll();
        return Object.freeze({
            enabled: true,
            supported: true,
            api: api.id,
            reason,
            pendingQueryCount: pendingQueries.length,
            sampleCount,
            disjointCount,
            droppedFrameCount,
            failedQueryCount,
            lastGpuMs: roundMs(lastGpuMs),
            avgGpuMs: sampleCount > 0 ? roundMs(totalGpuMs / sampleCount) : null,
            minGpuMs: roundMs(minGpuMs),
            maxGpuMs: roundMs(maxGpuMs),
        });
    };

    const dispose = () => {
        if (disposed) return false;
        disposed = true;
        if (activeQuery !== null) {
            try {
                api.endQuery();
            } catch (_) {
                failedQueryCount += 1;
            }
            deleteQuery(activeQuery);
            activeQuery = null;
        }
        while (pendingQueries.length > 0) {
            deleteQuery(pendingQueries.shift());
        }
        return true;
    };

    return Object.freeze({
        begin,
        end,
        snapshot,
        dispose,
    });
};

export default createPixiGpuFrameTimer;
