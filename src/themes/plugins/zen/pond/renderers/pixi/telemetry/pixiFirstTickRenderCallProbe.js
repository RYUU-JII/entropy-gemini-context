const FIRST_TICK_RENDER_CALL_PROBE_BUILD_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : true
);

const MAX_RENDER_CALLS = 32;
const MAX_PHASES = 16;
const nowMs = () => performance.now();
const roundMs = value => Number(value.toFixed(4));
const finiteOrNull = value => Number.isFinite(value) ? value : null;

const createDisabledProbe = reason => {
    const snapshot = Object.freeze({ enabled: false, reason });
    return Object.freeze({
        start: () => false,
        setPhase: () => false,
        finish: () => snapshot,
        dispose: () => false,
    });
};

// Observe one original public renderer instance method. This owner submits no
// GL work and does not inspect render arguments until the native call finishes.
export const createPixiFirstTickRenderCallProbe = ({ renderer, enabled = false, clock = nowMs } = {}) => {
    if (!FIRST_TICK_RENDER_CALL_PROBE_BUILD_ENABLED) return createDisabledProbe('build_capability_disabled');
    if (enabled !== true) return createDisabledProbe('telemetry_disabled');
    if (!renderer || typeof renderer.render !== 'function') return createDisabledProbe('renderer_unavailable');

    const originalRender = renderer.render;
    const originalDescriptor = Object.getOwnPropertyDescriptor(renderer, 'render');
    let active = false;
    let finished = false;
    let phase = 'begin_frame';
    let count = 0;
    let topLevelCount = 0;
    let maxDepth = 0;
    let observedCallCount = 0;
    let observedTopLevelCount = 0;
    let totalInclusiveCallMs = 0;
    let totalTopLevelMs = 0;
    let totalSelfMs = 0;
    let observationFailureCount = 0;
    let lastObservationFailure = null;
    const calls = [];
    const stack = [];
    const phaseTotals = new Map();
    const admittedPhases = new Set([phase]);

    const recordFailure = reason => {
        observationFailureCount += 1;
        lastObservationFailure = reason;
    };
    const readClock = () => {
        try {
            const value = clock();
            if (!Number.isFinite(value)) {
                recordFailure('clock_invalid');
                return null;
            }
            return value;
        } catch {
            recordFailure('clock_failed');
            return null;
        }
    };
    const restore = () => {
        if (!active) return false;
        // Preserve an owner installed later rather than overwriting its method.
        if (renderer.render === observeRender) {
            if (originalDescriptor) Object.defineProperty(renderer, 'render', originalDescriptor);
            else delete renderer.render;
        } else {
            recordFailure('restore_owner_changed');
        }
        active = false;
        return true;
    };

    function observeRender(...args) {
        const ordinal = ++count;
        const depth = stack.length;
        const parent = stack[depth - 1];
        const call = { ordinal, phase, depth, parentOrdinal: parent?.ordinal ?? null,
            startedAtMs: readClock(), childMs: 0, childrenComplete: true };
        if (depth === 0) topLevelCount += 1;
        maxDepth = Math.max(maxDepth, depth);
        stack.push(call);
        let failed = false;
        let nativeError;
        try {
            return originalRender.apply(this, args);
        } catch (error) {
            failed = true;
            nativeError = error;
            throw error;
        } finally {
            const completedAtMs = readClock();
            stack.pop();
            let durationMs = null;
            if (call.startedAtMs !== null && completedAtMs !== null) {
                if (completedAtMs >= call.startedAtMs) durationMs = completedAtMs - call.startedAtMs;
                else recordFailure('clock_reversed');
            }
            let selfMs = null;
            if (durationMs !== null && call.childrenComplete) {
                if (durationMs >= call.childMs) selfMs = durationMs - call.childMs;
                else recordFailure('nested_duration_invalid');
            }
            if (parent) {
                if (durationMs === null) parent.childrenComplete = false;
                else parent.childMs += durationMs;
            }
            if (durationMs !== null) {
                observedCallCount += 1;
                totalInclusiveCallMs += durationMs;
                if (depth === 0) {
                    observedTopLevelCount += 1;
                    totalTopLevelMs += durationMs;
                }
            }
            if (selfMs !== null) totalSelfMs += selfMs;
            let phaseTotal = phaseTotals.get(call.phase);
            if (!phaseTotal) {
                phaseTotal = { phase: call.phase, count: 0, topLevelCount: 0,
                    observedCallCount: 0, totalInclusiveCallMs: 0, totalTopLevelMs: 0, totalSelfMs: 0 };
                phaseTotals.set(call.phase, phaseTotal);
            }
            phaseTotal.count += 1;
            if (depth === 0) phaseTotal.topLevelCount += 1;
            if (durationMs !== null) {
                phaseTotal.observedCallCount += 1;
                phaseTotal.totalInclusiveCallMs += durationMs;
                if (depth === 0) phaseTotal.totalTopLevelMs += durationMs;
            }
            if (selfMs !== null) phaseTotal.totalSelfMs += selfMs;

            if (ordinal <= MAX_RENDER_CALLS) {
                const entry = { ordinal, phase: call.phase, depth, parentOrdinal: call.parentOrdinal,
                    startedAtMs: call.startedAtMs, completedAtMs,
                    durationMs: durationMs === null ? null : roundMs(durationMs),
                    selfMs: selfMs === null ? null : roundMs(selfMs), failed,
                    errorName: null, targetKind: null, targetWidth: null, targetHeight: null, targetResolution: null };
                try {
                    const target = args[1]?.renderTexture;
                    entry.targetKind = target ? 'texture' : 'screen';
                    entry.targetWidth = finiteOrNull(target ? target.width : renderer.screen?.width);
                    entry.targetHeight = finiteOrNull(target ? target.height : renderer.screen?.height);
                    entry.targetResolution = finiteOrNull(target ? target.baseTexture?.resolution : renderer.resolution);
                    if (failed) entry.errorName = typeof nativeError?.name === 'string' ? nativeError.name.slice(0, 80) : 'Error';
                } catch {
                    recordFailure('metadata_failed');
                }
                calls.push(Object.freeze(entry));
            }
        }
    }

    const snapshot = () => Object.freeze({
        enabled: true,
        contract: 'zen_pond_first_tick_render_calls_v1',
        scope: 'first_pond_tick',
        timingScope: 'Original public Pixi renderer.render Worker wall time, including nested program, upload and driver waits; not GPU execution or pure CPU raster time.',
        maxCalls: MAX_RENDER_CALLS,
        maxPhases: MAX_PHASES,
        count, topLevelCount, nestedCount: count - topLevelCount, maxDepth,
        observedCallCount, observedTopLevelCount,
        timingsComplete: observedCallCount === count && observationFailureCount === 0,
        totalInclusiveCallMs: roundMs(totalInclusiveCallMs),
        totalTopLevelMs: roundMs(totalTopLevelMs),
        totalSelfMs: roundMs(totalSelfMs),
        omittedCallCount: count - calls.length,
        observationFailureCount, lastObservationFailure,
        phaseTotals: Object.freeze([...phaseTotals.values()].map(entry => Object.freeze({ ...entry,
            totalInclusiveCallMs: roundMs(entry.totalInclusiveCallMs),
            totalTopLevelMs: roundMs(entry.totalTopLevelMs), totalSelfMs: roundMs(entry.totalSelfMs) }))),
        calls: Object.freeze([...calls].sort((a, b) => a.ordinal - b.ordinal)),
    });

    return Object.freeze({
        start() {
            if (finished) throw new Error('ZEN_PIXI_RENDER_CALL_PROBE_ALREADY_FINISHED');
            if (active) return false;
            if (renderer.render !== originalRender) throw new Error('ZEN_PIXI_RENDER_CALL_PROBE_OWNER_CONFLICT');
            renderer.render = observeRender;
            active = true;
            return true;
        },
        setPhase(value) {
            if (!active) return false;
            if (typeof value !== 'string' || !value.trim() || value.trim().length > 40
                || (!admittedPhases.has(value.trim()) && admittedPhases.size >= MAX_PHASES)) {
                recordFailure('phase_invalid');
                return false;
            }
            phase = value.trim();
            admittedPhases.add(phase);
            return true;
        },
        finish() {
            restore();
            finished = true;
            return snapshot();
        },
        dispose: restore,
    });
};
