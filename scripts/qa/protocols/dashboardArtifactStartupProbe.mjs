// Serialized into the named capture's existing page. This observes CPU wall time
// of native calls only; it adds no GL queries, flushes, reads or synchronization.
export function installArtifactWebGlStartupProbe({
  canvasPrototype = HTMLCanvasElement.prototype, now = () => performance.now(), maxCalls = 4096,
} = {}) {
  const methods = {
    shader: ['compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter',
      'getActiveUniform', 'getUniformLocation', 'getActiveAttrib', 'getAttribLocation', 'useProgram'],
    texture: ['texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D', 'texStorage2D', 'texStorage3D', 'generateMipmap'],
    buffer: ['bufferData', 'bufferSubData', 'renderbufferStorage', 'renderbufferStorageMultisample'],
    query: ['getParameter', 'getExtension', 'getShaderPrecisionFormat', 'checkFramebufferStatus', 'getError'],
    draw: ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'clear', 'flush', 'finish', 'readPixels'],
  };
  const calls = [], contexts = [], restores = [], seen = new Map();
  let overflow = false, stopped = false;
  const record = entry => { if (calls.length < maxCalls) calls.push(entry); else overflow = true; };
  const replace = (target, name, wrapper) => {
    const original = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, writable: true, value: wrapper });
    restores.push(() => {
      if (target[name] !== wrapper) throw new Error('QA_ARTIFACT_STARTUP_PROBE_OWNER_CHANGED:' + name);
      if (original) Object.defineProperty(target, name, original);
      else delete target[name];
    });
  };
  const observeContext = (gl, canvas, type) => {
    if (seen.has(gl)) return;
    const contextId = contexts.length + 1;
    seen.set(gl, contextId);
    contexts.push({ contextId, type, role: canvas.dataset?.zenArtifactEngine === 'gallery' ? 'gallery' : 'other-page-canvas',
      connected: canvas.isConnected, width: canvas.width, height: canvas.height });
    for (const [category, names] of Object.entries(methods)) {
      for (const name of names) {
        const original = gl[name];
        if (typeof original !== 'function') continue; // WebGL1 has no WebGL2-only methods.
        replace(gl, name, function (...args) {
          const startedAtMs = now();
          try { return Reflect.apply(original, this, args); }
          finally { record({ contextId, category, method: name, startedAtMs, durationMs: now() - startedAtMs,
            parameter: name === 'getProgramParameter' || name === 'getShaderParameter' ? args[1] : undefined }); }
        });
      }
    }
  };
  const originalGetContext = canvasPrototype.getContext;
  replace(canvasPrototype, 'getContext', function (type, ...args) {
    if (!['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return Reflect.apply(originalGetContext, this, [type, ...args]);
    const startedAtMs = now();
    let gl;
    try { gl = Reflect.apply(originalGetContext, this, [type, ...args]); }
    finally { record({ contextId: null, category: 'context', method: 'getContext:' + type, startedAtMs,
      durationMs: now() - startedAtMs, succeeded: Boolean(gl),
      role: this.dataset?.zenArtifactEngine === 'gallery' ? 'gallery' : 'other-page-canvas' }); }
    if (gl) observeContext(gl, this, type);
    return gl;
  });
  return {
    stop() {
      if (!stopped) {
        stopped = true;
        const failures = [];
        for (const restore of restores.reverse()) {
          try { restore(); } catch (error) { failures.push(error.message); }
        }
        if (failures.length) throw new Error('QA_ARTIFACT_STARTUP_PROBE_RESTORE_FAILED:' + failures.join(','));
      }
      if (overflow) throw new Error('QA_ARTIFACT_STARTUP_PROBE_CAPACITY_EXCEEDED');
      return { contexts, calls, restored: true, maxCalls,
        timingScope: 'Instrumented main-document WebGL native-call CPU wall time; includes driver waits, excludes Worker contexts and GPU execution time. Method coverage is explicit; unobserved JS/native work is residual. No extra GL queries are issued.' };
    },
  };
}
