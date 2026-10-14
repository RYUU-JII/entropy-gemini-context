const MAX_SLOW_CALLS = 6;
const roundMs = value => Number(value.toFixed(4));
const METHODS = Object.freeze({
  createShader: 'create_shader', shaderSource: 'shader_source', compileShader: 'compile_shader',
  createProgram: 'create_program', attachShader: 'attach_shader',
  transformFeedbackVaryings: 'transform_feedback', linkProgram: 'link_program',
  getProgramParameter: 'query_program', getActiveAttrib: 'active_attribute',
  getAttribLocation: 'attribute_location', bindAttribLocation: 'bind_attribute_location',
  getActiveUniform: 'active_uniform', getUniformLocation: 'uniform_location',
  deleteShader: 'delete_shader', deleteProgram: 'delete_program',
  getShaderParameter: 'query_shader_parameter', getShaderInfoLog: 'query_shader_info_log',
  getShaderSource: 'query_shader_source', getProgramInfoLog: 'query_program_info_log',
});

// Scoped instance wrappers observe calls that Pixi already issues. No GL query,
// shader operation, synchronization, prototype mutation or native flag is added.
export const createZenPixiProgramGlCallDiagnostics = ({ nowMs, recordObservationFailure }) => {
  const activeContexts = new WeakMap();
  const installedContexts = new Set();
  const fail = (frame, reason, error) => {
    frame.observationFailureCount += 1;
    frame.lastObservationFailure = reason;
    try { recordObservationFailure(error || { name: reason }); }
    catch { frame.observationFailureCount += 1; frame.lastObservationFailure = 'failure_recording_failed'; }
  };
  const readClock = frame => {
    try {
      const stamp = nowMs();
      if (Number.isFinite(stamp)) return stamp;
      fail(frame, 'clock_invalid');
    } catch (error) {
      fail(frame, 'clock_failed', error);
    }
    return null;
  };
  const createFrame = () => ({
    enabled: false, reason: 'context_unavailable', count: 0, observedCallCount: 0,
    failedCallCount: 0, totalCallMs: 0, maxCallMs: 0,
    observationFailureCount: 0, lastObservationFailure: null, linkCount: 0,
    groups: new Map(), slowCalls: [], shaders: new WeakMap(),
  });
  const operationGroup = (frame, gl, method, args) => {
    if (method === 'compileShader') {
      const type = frame.shaders.get(args[0]);
      return type === 35633 ? 'compile_vertex' : type === 35632 ? 'compile_fragment' : 'compile_other';
    }
    if (method === 'linkProgram') {
      frame.linkCount += 1;
      return frame.linkCount === 1 ? 'link_first' : frame.linkCount === 2 ? 'link_relink' : 'link_later';
    }
    if (method === 'getProgramParameter') {
      return args[1] === 35714 ? 'query_link_status' : args[1] === 35721 ? 'query_active_attributes'
        : args[1] === 35718 ? 'query_active_uniforms' : 'query_program_other';
    }
    return METHODS[method];
  };
  const restoreContext = (context, frame) => {
    for (let index = context.methods.length - 1; index >= 0; index -= 1) {
      const entry = context.methods[index];
      try {
        const current = Object.getOwnPropertyDescriptor(context.gl, entry.method);
        if (current?.value !== entry.wrapper) {
          fail(frame, 'restore_owner_changed');
          continue;
        }
        if (entry.descriptor) Object.defineProperty(context.gl, entry.method, entry.descriptor);
        else if (!Reflect.deleteProperty(context.gl, entry.method)) fail(frame, 'restore_delete_failed');
      } catch (error) {
        fail(frame, 'restore_failed', error);
      }
    }
  };
  const installContext = (gl, frame) => {
    const context = { gl, methods: [], frames: [] };
    try {
      for (const method of Object.keys(METHODS)) {
        const original = gl[method];
        if (typeof original !== 'function') continue;
        const descriptor = Object.getOwnPropertyDescriptor(gl, method);
        function observeGlCall(...args) {
          const current = context.frames[context.frames.length - 1];
          if (!current) return original.apply(this, args);
          const ordinal = ++current.count;
          let group = METHODS[method];
          try { group = operationGroup(current, gl, method, args); }
          catch (error) { fail(current, 'operation_metadata_failed', error); }
          const startedAtMs = readClock(current);
          let failed = false;
          try {
            const result = original.apply(this, args);
            try {
              if (method === 'createShader' && result !== null && (typeof result === 'object' || typeof result === 'function')) {
                current.shaders.set(result, args[0]);
              }
            } catch (error) { fail(current, 'shader_metadata_failed', error); }
            return result;
          } catch (error) {
            failed = true;
            throw error;
          } finally {
            try {
              const completedAtMs = readClock(current);
              let durationMs = null;
              if (startedAtMs !== null && completedAtMs !== null) {
                if (completedAtMs >= startedAtMs) durationMs = completedAtMs - startedAtMs;
                else fail(current, 'clock_reversed');
              }
              let total = current.groups.get(group);
              if (!total) {
                total = { group, count: 0, observedCallCount: 0, failedCallCount: 0, totalMs: 0, maxMs: 0 };
                current.groups.set(group, total);
              }
              total.count += 1;
              if (failed) { total.failedCallCount += 1; current.failedCallCount += 1; }
              if (durationMs !== null) {
                total.observedCallCount += 1;
                total.totalMs += durationMs;
                total.maxMs = Math.max(total.maxMs, durationMs);
                current.observedCallCount += 1;
                current.totalCallMs += durationMs;
                current.maxCallMs = Math.max(current.maxCallMs, durationMs);
              }
              const detail = Object.freeze({ ordinal, method, group, linkOrdinal: current.linkCount, startedAtMs, completedAtMs,
                durationMs: durationMs === null ? null : roundMs(durationMs), failed,
                receiverMatchesContext: this === gl });
              current.slowCalls.push(detail);
              current.slowCalls.sort((a, b) => (b.durationMs ?? -1) - (a.durationMs ?? -1) || a.ordinal - b.ordinal);
              if (current.slowCalls.length > MAX_SLOW_CALLS) current.slowCalls.pop();
            } catch (error) { fail(current, 'aggregation_failed', error); }
          }
        }
        const replacement = descriptor && 'value' in descriptor
          ? { ...descriptor, value: observeGlCall }
          : { configurable: true, enumerable: descriptor?.enumerable === true, writable: true, value: observeGlCall };
        Object.defineProperty(gl, method, replacement);
        context.methods.push({ method, original, descriptor, wrapper: observeGlCall });
      }
      frame.enabled = true;
      frame.reason = null;
      activeContexts.set(gl, context);
      installedContexts.add(context);
      return context;
    } catch (error) {
      frame.reason = 'instance_methods_unobservable';
      fail(frame, 'install_failed', error);
      restoreContext(context, frame);
      return null;
    }
  };
  const observe = (frame, gl, invoke) => {
    if (gl === null || (typeof gl !== 'object' && typeof gl !== 'function')) return invoke();
    let context = activeContexts.get(gl);
    const ownsContext = !context;
    if (!context) context = installContext(gl, frame);
    if (!context) return invoke();
    frame.enabled = true;
    frame.reason = null;
    context.frames.push(frame);
    try { return invoke(); }
    finally {
      context.frames.pop();
      if (ownsContext) {
        restoreContext(context, frame);
        activeContexts.delete(gl);
        installedContexts.delete(context);
      }
    }
  };
  const suspend = invoke => {
    const contexts = [...installedContexts];
    contexts.forEach(context => context.frames.push(null));
    try { return invoke(); }
    finally { contexts.forEach(context => context.frames.pop()); }
  };
  const snapshot = frame => Object.freeze({
    enabled: frame.enabled, reason: frame.reason, contract: 'zen_pixi_program_gl_calls_v1',
    count: frame.count, observedCallCount: frame.observedCallCount, failedCallCount: frame.failedCallCount,
    timingsComplete: frame.enabled && frame.count === frame.observedCallCount && frame.observationFailureCount === 0,
    totalCallMs: frame.enabled && frame.observedCallCount > 0 ? roundMs(frame.totalCallMs) : null,
    maxCallMs: frame.enabled && frame.observedCallCount > 0 ? roundMs(frame.maxCallMs) : null,
    omittedSlowCallCount: frame.count - frame.slowCalls.length, maxSlowCalls: MAX_SLOW_CALLS,
    observationFailureCount: frame.observationFailureCount, lastObservationFailure: frame.lastObservationFailure,
    groups: Object.freeze([...frame.groups.values()].map(entry => Object.freeze({ ...entry,
      totalMs: entry.observedCallCount > 0 ? roundMs(entry.totalMs) : null,
      maxMs: entry.observedCallCount > 0 ? roundMs(entry.maxMs) : null }))),
    slowCalls: Object.freeze([...frame.slowCalls].sort((a, b) => a.ordinal - b.ordinal)),
  });
  return Object.freeze({ createFrame, observe, suspend, snapshot });
};
