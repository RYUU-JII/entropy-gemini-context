import { createZenPixiProgramGlCallDiagnostics } from './zenPixiProgramGlCallDiagnostics.js';

const PROGRAM_GL_DIAGNOSTICS_BUILD_ENABLED = (
  typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
    ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
    : true
);
const DIAGNOSTIC_OWNER = Symbol('zenPixiProgramDiagnosticOwner');
const MAX_DIAGNOSTIC_PROGRAMS = 24;
const MAX_DIAGNOSTIC_CONTEXTS = 2;
const roundMs = value => Math.max(0, Number(value.toFixed(4)));
const boundedErrorName = error => {
  try { return typeof error?.name === 'string' ? error.name.slice(0, 80) : 'Error'; }
  catch { return 'Error'; }
};

const stableProgramName = (vertexSrc, fragmentSrc) => {
  let hash = 2166136261;
  for (const source of [vertexSrc, '\u0000', fragmentSrc]) {
    const normalized = source.replace(/^#define SHADER_NAME [^\r\n]+/m, '#define SHADER_NAME');
    for (let index = 0; index < normalized.length; index += 1) {
      hash = Math.imul(hash ^ normalized.charCodeAt(index), 16777619);
    }
  }
  const sourceName = fragmentSrc.match(/^#define SHADER_NAME ([^\r\n]+)/m)?.[1];
  const name = sourceName ? sourceName.trim().replace(/-\d+$/, '').slice(0, 80) : 'shader';
  return `${name}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

// Observe the existing instance method; Pixi retains every compilation, metadata,
// cache and disposal decision. No GL operation is issued by this owner.
export function installZenPixiProgramDiagnostics(renderer, { enabled, nowMs }) {
  if (enabled !== true) return null;
  const shaderSystem = renderer?.shader;
  if (typeof shaderSystem?.generateProgram !== 'function' || shaderSystem.renderer !== renderer) {
    throw new Error('ZEN_PIXI_PROGRAM_DIAGNOSTIC_RENDERER_REQUIRED');
  }
  if (typeof nowMs !== 'function') throw new Error('ZEN_PIXI_PROGRAM_DIAGNOSTIC_CLOCK_REQUIRED');
  if (shaderSystem[DIAGNOSTIC_OWNER]) throw new Error('ZEN_PIXI_PROGRAM_DIAGNOSTIC_ALREADY_INSTALLED');
  const originalGenerateProgram = shaderSystem.generateProgram;
  const originalDescriptor = Object.getOwnPropertyDescriptor(shaderSystem, 'generateProgram');
  const owner = {};
  const programs = [];
  const contexts = [];
  let phase = 'scene_mount';
  let finished = false;
  let programCount = 0;
  let admittedProgramCount = 0;
  let droppedContextCount = 0;
  let observationFailureCount = 0;
  let lastObservationFailureName = null;
  const recordObservationFailure = error => {
    observationFailureCount += 1;
    lastObservationFailureName = boundedErrorName(error);
  };
  const readProgramClock = () => {
    const value = nowMs();
    if (!Number.isFinite(value)) throw new RangeError('ZEN_PIXI_PROGRAM_DIAGNOSTIC_CLOCK_INVALID');
    return value;
  };
  const glCalls = PROGRAM_GL_DIAGNOSTICS_BUILD_ENABLED
    ? createZenPixiProgramGlCallDiagnostics({ nowMs, recordObservationFailure }) : null;
  const activePrograms = [];

  const snapshot = () => Object.freeze({
    enabled: true, finished, maxPrograms: MAX_DIAGNOSTIC_PROGRAMS,
    programCount, droppedProgramCount: programCount - programs.length, droppedContextCount,
    observationFailureCount, lastObservationFailureName,
    contexts: Object.freeze([...contexts]), programs: Object.freeze([...programs].sort((a, b) => a.programOrdinal - b.programOrdinal)),
    timingScope: 'Original Pixi generateProgram Worker wall time including driver waits and opt-in observation overhead; GL operation spans are nested native-call observations, not GPU execution or additive costs.',
  });
  function observeGenerateProgram(...args) {
    if (finished) return originalGenerateProgram.apply(this, args);
    programCount += 1;
    const programOrdinal = programCount;
    if (admittedProgramCount >= MAX_DIAGNOSTIC_PROGRAMS) {
      return PROGRAM_GL_DIAGNOSTICS_BUILD_ENABLED
        ? glCalls.suspend(() => originalGenerateProgram.apply(this, args))
        : originalGenerateProgram.apply(this, args);
    }
    let observation = null;
    let skipObservation = false;
    try {
      const contextUid = this.renderer?.CONTEXT_UID;
      if (!contexts.some(context => context.contextUid === contextUid)) {
        if (contexts.length >= MAX_DIAGNOSTIC_CONTEXTS) {
          droppedContextCount += 1;
          skipObservation = true;
        } else {
          contexts.push(Object.freeze({ contextUid, atMs: readProgramClock() }));
        }
      }
      if (!skipObservation) {
        const program = args[0]?.program;
        const vertexSrc = typeof program?.vertexSrc === 'string' ? program.vertexSrc : '';
        const fragmentSrc = typeof program?.fragmentSrc === 'string' ? program.fragmentSrc : '';
        observation = { programOrdinal, parentProgramOrdinal: activePrograms[activePrograms.length - 1] ?? null,
          name: stableProgramName(vertexSrc, fragmentSrc), contextUid, phase,
          vertexSourceLength: vertexSrc.length, fragmentSourceLength: fragmentSrc.length, atMs: readProgramClock() };
        admittedProgramCount += 1;
      }
    } catch (error) {
      recordObservationFailure(error);
    }
    let failed = false;
    let nativeError = null;
    let glFrame = null;
    let originalGl = null;
    if (PROGRAM_GL_DIAGNOSTICS_BUILD_ENABLED && observation) {
      glFrame = glCalls.createFrame();
      try { originalGl = this.gl; } catch (error) { recordObservationFailure(error); }
    }
    activePrograms.push(programOrdinal);
    try {
      const invoke = () => originalGenerateProgram.apply(this, args);
      return PROGRAM_GL_DIAGNOSTICS_BUILD_ENABLED && glFrame
        ? glCalls.observe(glFrame, originalGl, invoke)
        : PROGRAM_GL_DIAGNOSTICS_BUILD_ENABLED ? glCalls.suspend(invoke) : invoke();
    } catch (error) {
      failed = true;
      nativeError = error;
      throw error;
    } finally {
      activePrograms.pop();
      if (observation) {
        try {
          const completedAtMs = readProgramClock();
          programs.push(Object.freeze({ ...observation,
            completedAtMs, totalMs: roundMs(completedAtMs - observation.atMs), failed,
            errorName: failed ? boundedErrorName(nativeError) : null,
            ...(PROGRAM_GL_DIAGNOSTICS_BUILD_ENABLED && glFrame ? { glCalls: glCalls.snapshot(glFrame) } : {}) }));
        } catch (error) {
          recordObservationFailure(error);
        }
      }
    }
  }
  shaderSystem.generateProgram = observeGenerateProgram;
  shaderSystem[DIAGNOSTIC_OWNER] = owner;

  const restore = () => {
    finished = true;
    if (shaderSystem.generateProgram === observeGenerateProgram) {
      if (originalDescriptor) Object.defineProperty(shaderSystem, 'generateProgram', originalDescriptor);
      else delete shaderSystem.generateProgram;
    }
    if (shaderSystem[DIAGNOSTIC_OWNER] === owner) delete shaderSystem[DIAGNOSTIC_OWNER];
  };
  return Object.freeze({
    setDiagnosticPhase: value => { if (!finished && typeof value === 'string') phase = value.slice(0, 40); },
    getStartupDiagnostics: snapshot,
    finishStartupDiagnostics: () => { restore(); return snapshot(); },
    dispose: restore,
  });
}
