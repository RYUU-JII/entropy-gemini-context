import {
  SENTINEL_FLARE_PROTOCOL_SCOPES,
  SENTINEL_FLARE_PROTOCOL_VARIANTS,
  normalizeSentinelFlareProtocolScope,
  normalizeSentinelFlareProtocolVariant,
} from '../runtime/sentinelFlareProtocolProfile.js';

export const GLOBAL_SENTINEL_PROTOCOL_SYSTEM = 'global_sentinel_simulation';
export const GLOBAL_SENTINEL_ENTRY_STAGES = Object.freeze({
  IMPACT: 0,
  DETACHMENT: 350,
  SHADOW_DEPARTURE: 1700,
  ELECTRICAL_CASCADE: 2350,
  SHADOW_EXIT: 6100,
  POWER_CUT: 6700,
  WHITE_FIELD: 7350,
  GIANT_RETURN: 9500,
  REPAIR_COMPLETE: 17000,
  HANDOFF: 18500,
});
export const GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS = GLOBAL_SENTINEL_ENTRY_STAGES.HANDOFF;
export const GLOBAL_SENTINEL_ENTRY_ELECTRICAL_MS = GLOBAL_SENTINEL_ENTRY_STAGES.POWER_CUT
  - GLOBAL_SENTINEL_ENTRY_STAGES.ELECTRICAL_CASCADE;
// Distinct electrical blows, shared with the DOM projection and sound. Spatial
// assignment and defect variation are seeded by the fracture material owner.
export const GLOBAL_SENTINEL_ENTRY_FAULT_CUES = Object.freeze([2350, 3190, 4020, 5060, 6100]);
export const GLOBAL_SENTINEL_ENTRY_POWER_CUT_MS = GLOBAL_SENTINEL_ENTRY_STAGES.POWER_CUT;
export const GLOBAL_SENTINEL_RIFT_APERTURE_OPEN_MS = 2600;
export const GLOBAL_SENTINEL_TERMINAL_MA_MS = 900;

function clampEntryUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function resolveEntryPhase(progress, start, end) {
  const span = Math.max(0.001, end - start);
  return clampEntryUnit((progress - start) / span);
}

function easeEntryOutCubic(value) {
  const t = clampEntryUnit(value);
  return 1 - ((1 - t) ** 3);
}

function easeEntryInOutSine(value) {
  const t = clampEntryUnit(value);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// One clock owns the click impact, accumulating LCD faults, power loss and
// whole-frame simulation cut. Depth belongs exclusively to the success rift.
export function resolveGlobalSentinelEntryRuptureTimeline(value = 0) {
  const progress = clampEntryUnit(value);
  const elapsedMs = progress * GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS;
  const stages = GLOBAL_SENTINEL_ENTRY_STAGES;
  const electricalProgress = Math.max(0, elapsedMs - stages.ELECTRICAL_CASCADE)
    / GLOBAL_SENTINEL_ENTRY_ELECTRICAL_MS;
  const stage = elapsedMs < stages.DETACHMENT ? 'impact'
    : elapsedMs < stages.SHADOW_DEPARTURE ? 'detachment'
      : elapsedMs < stages.ELECTRICAL_CASCADE ? 'shadow_departure'
        : elapsedMs < stages.POWER_CUT ? 'electrical_cascade'
          : elapsedMs < stages.WHITE_FIELD ? 'power_cut'
            : elapsedMs < stages.GIANT_RETURN ? 'false_calm'
              : elapsedMs < stages.REPAIR_COMPLETE ? 'giant_return' : 'handoff';
  return Object.freeze({
    stage,
    elapsedMs,
    blackout: elapsedMs >= stages.POWER_CUT && elapsedMs < stages.WHITE_FIELD ? 1 : 0,
    signalKick: elapsedMs >= stages.ELECTRICAL_CASCADE - 95 && elapsedMs < stages.POWER_CUT ? 1 : 0,
    panelFailure: resolveEntryPhase(electricalProgress, 0.12, 1),
    fieldVisible: elapsedMs >= stages.WHITE_FIELD,
    fieldLock: easeEntryInOutSine(resolveEntryPhase(elapsedMs, stages.WHITE_FIELD, stages.WHITE_FIELD + 550)),
    handoff: easeEntryInOutSine(resolveEntryPhase(elapsedMs, stages.REPAIR_COMPLETE, stages.HANDOFF)),
    recoverySweep: resolveEntryPhase(elapsedMs, stages.GIANT_RETURN, stages.REPAIR_COMPLETE),
    recoveryRewind: resolveEntryPhase(elapsedMs, stages.GIANT_RETURN, stages.REPAIR_COMPLETE),
    shikigamiRelease: easeEntryInOutSine(resolveEntryPhase(elapsedMs, 500, 1450)),
    shadowDetach: resolveEntryPhase(elapsedMs, stages.DETACHMENT, stages.SHADOW_DEPARTURE),
    shadowDeparture: resolveEntryPhase(elapsedMs, stages.SHADOW_DEPARTURE, stages.SHADOW_EXIT),
    shadowGlitch: resolveEntryPhase(elapsedMs, 950, 1700) * (elapsedMs < stages.SHADOW_EXIT ? 1 : 0),
    falseCalm: resolveEntryPhase(elapsedMs, stages.WHITE_FIELD, stages.GIANT_RETURN),
    giantApproach: resolveEntryPhase(elapsedMs, stages.GIANT_RETURN, stages.GIANT_RETURN + 2600),
    electricalProgress,
    inkTransfer: easeEntryInOutSine(resolveEntryPhase(elapsedMs, 80, 500)),
    progress,
    impact: easeEntryOutCubic(resolveEntryPhase(elapsedMs, 15, 300)),
    sealCollapse: easeEntryOutCubic(resolveEntryPhase(elapsedMs, 0, 350)),
  });
}

// Success does not replace the completed fracture with a second portal. The
// already-resolved crack skeleton opens into the decompression space on one
// short protocol clock so worker renderers can keep the handoff deterministic.
export function resolveGlobalSentinelRiftApertureTimeline(value = 0) {
  const progress = clampEntryUnit(value);
  return Object.freeze({
    depth: easeEntryInOutSine(resolveEntryPhase(progress, 0.2, 0.82)),
    edge: easeEntryOutCubic(resolveEntryPhase(progress, 0.08, 0.58)),
    progress,
    puncture: easeEntryOutCubic(resolveEntryPhase(progress, 0, 0.22)),
    settle: easeEntryInOutSine(resolveEntryPhase(progress, 0.68, 1)),
    unfold: easeEntryOutCubic(resolveEntryPhase(progress, 0.06, 0.78)),
  });
}

export const GLOBAL_SENTINEL_GAME_PHASES = Object.freeze({
  AWAITING_START: 'awaiting_start',
  REPAIR_RACE: 'repair_race',
  FRACTURE_OPEN: 'fracture_open',
  RESYNC_COMPLETE: 'resync_complete',
});

export const GLOBAL_SENTINEL_RHYTHM_PHASES = Object.freeze({
  BREATH: 'breath',
  APPROACH: 'approach',
  LOCK: 'lock',
  ACTIVE: 'active',
  RECOVERY: 'recovery',
});

export const GLOBAL_SENTINEL_MIN_INTERVENTION_QUALITY = 0.82;
export const GLOBAL_SENTINEL_RESISTANCE_ACTS = Object.freeze([
  Object.freeze({ id: 'discovery', breathMs: 1800, approachOffsetMs: 0, windowOffsetMs: 0, slowMotionScale: 0.34 }),
  Object.freeze({ id: 'system_surge', breathMs: 2600, approachOffsetMs: 400, windowOffsetMs: 200, slowMotionScale: 0.24 }),
  Object.freeze({ id: 'final_decision', breathMs: 3400, approachOffsetMs: 1000, windowOffsetMs: 2700, slowMotionScale: 0.1 }),
]);

const GLOBAL_SENTINEL_SIMULATION_POLICY = Object.freeze({
  targetDormantCount: 4,
  syncDurationMs: 54_000,
  collapseHoldMs: 2400,
  hardTimeLimitMs: 60_000,
  fractureThreshold: 0.92,
  successMaxSyncPressure: 0.55,
  syncPressureReliefPerHit: 0.12,
  maxSyncPressureRelief: 0.58,
  syncPressureFailureThreshold: 1,
  rapidHitWindowMs: 0,
  minHitEfficiency: 1,
  hitAftermathWindowMs: 1620,
  fractureStableRatio: 0.72,
  missRepairImpulse: 0.08,
  missRepairDurationMs: 1200,
  vulnerabilityInitialDelayMs: GLOBAL_SENTINEL_ENTRY_RUPTURE_REVEAL_MS + 4400,
  vulnerabilityApproachMs: 2600,
  vulnerabilityLockMs: 600,
  vulnerabilityCycleMs: 6800,
  vulnerabilityWindowMs: 1800,
  vulnerabilitySlowMotionScale: 0.34,
});

function normalizeTime(value, fallback = Date.now()) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function normalizePositiveInt(value, fallback, min, max) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeUnit(value, fallback, min = 0, max = 1) {
  const numeric = Number(value);
  const source = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(min, Math.min(max, Number.isFinite(source) ? source : 0));
}

function assertGlobalSentinelProfile(config = null) {
  const protocolScope = normalizeSentinelFlareProtocolScope(
    config?.protocolScope,
    SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL,
  );
  if (protocolScope !== SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL) {
    throw new Error(`global_sentinel_protocol_scope_mismatch:${protocolScope}`);
  }
  const protocolVariant = normalizeSentinelFlareProtocolVariant(
    config?.protocolVariant,
    SENTINEL_FLARE_PROTOCOL_VARIANTS.GLOBAL_SENTINEL,
  );
  if (protocolVariant !== SENTINEL_FLARE_PROTOCOL_VARIANTS.GLOBAL_SENTINEL) {
    throw new Error(`global_sentinel_protocol_variant_mismatch:${protocolVariant}`);
  }
}

export function resolveGlobalSentinelSimulationPolicy(config = null) {
  assertGlobalSentinelProfile(config);
  const globalSentinel = config?.globalSentinel && typeof config.globalSentinel === 'object'
    ? config.globalSentinel
    : {};
  const targetDormantCount = normalizePositiveInt(
    globalSentinel.targetDormantCount,
    GLOBAL_SENTINEL_SIMULATION_POLICY.targetDormantCount,
    3,
    16,
  );
  const syncDurationMs = normalizePositiveInt(
    globalSentinel.syncDurationMs,
    GLOBAL_SENTINEL_SIMULATION_POLICY.syncDurationMs,
    4000,
    60_000,
  );
  const hardTimeLimitMs = normalizePositiveInt(
    globalSentinel.hardTimeLimitMs,
    GLOBAL_SENTINEL_SIMULATION_POLICY.hardTimeLimitMs,
    syncDurationMs,
    90_000,
  );
  return {
    protocolSystem: GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
    protocolScope: SENTINEL_FLARE_PROTOCOL_SCOPES.GLOBAL,
    protocolVariant: SENTINEL_FLARE_PROTOCOL_VARIANTS.GLOBAL_SENTINEL,
    targetDormantCount,
    syncDurationMs,
    collapseHoldMs: normalizePositiveInt(
      globalSentinel.collapseHoldMs,
      GLOBAL_SENTINEL_SIMULATION_POLICY.collapseHoldMs,
      0,
      6000,
    ),
    hardTimeLimitMs,
    fractureImpulse: normalizeUnit(
      globalSentinel.fractureImpulse,
      1 / Math.max(1, targetDormantCount),
      0.03,
      1,
    ),
    fractureThreshold: normalizeUnit(
      globalSentinel.fractureThreshold,
      GLOBAL_SENTINEL_SIMULATION_POLICY.fractureThreshold,
      0.35,
      1,
    ),
    successMaxSyncPressure: normalizeUnit(
      globalSentinel.successMaxSyncPressure,
      GLOBAL_SENTINEL_SIMULATION_POLICY.successMaxSyncPressure,
      0.15,
      1,
    ),
    syncPressureReliefPerHit: normalizeUnit(
      globalSentinel.syncPressureReliefPerHit,
      GLOBAL_SENTINEL_SIMULATION_POLICY.syncPressureReliefPerHit,
      0,
      0.45,
    ),
    maxSyncPressureRelief: normalizeUnit(
      globalSentinel.maxSyncPressureRelief,
      GLOBAL_SENTINEL_SIMULATION_POLICY.maxSyncPressureRelief,
      0,
      0.85,
    ),
    syncPressureFailureThreshold: GLOBAL_SENTINEL_SIMULATION_POLICY.syncPressureFailureThreshold,
    rapidHitWindowMs: normalizePositiveInt(
      globalSentinel.rapidHitWindowMs,
      GLOBAL_SENTINEL_SIMULATION_POLICY.rapidHitWindowMs,
      0,
      2000,
    ),
    minHitEfficiency: normalizeUnit(
      globalSentinel.minHitEfficiency,
      GLOBAL_SENTINEL_SIMULATION_POLICY.minHitEfficiency,
      0.15,
      1,
    ),
    hitAftermathWindowMs: normalizePositiveInt(
      globalSentinel.hitAftermathWindowMs,
      GLOBAL_SENTINEL_SIMULATION_POLICY.hitAftermathWindowMs,
      0,
      2400,
    ),
    fractureStableRatio: normalizeUnit(
      globalSentinel.fractureStableRatio,
      GLOBAL_SENTINEL_SIMULATION_POLICY.fractureStableRatio,
      0.5,
      0.92,
    ),
    missRepairImpulse: normalizeUnit(
      globalSentinel.missRepairImpulse,
      GLOBAL_SENTINEL_SIMULATION_POLICY.missRepairImpulse,
      0,
      0.3,
    ),
    missRepairDurationMs: normalizePositiveInt(
      globalSentinel.missRepairDurationMs,
      GLOBAL_SENTINEL_SIMULATION_POLICY.missRepairDurationMs,
      240,
      2400,
    ),
    vulnerabilityInitialDelayMs: normalizePositiveInt(
      globalSentinel.vulnerabilityInitialDelayMs,
      GLOBAL_SENTINEL_SIMULATION_POLICY.vulnerabilityInitialDelayMs,
      0,
      30_000,
    ),
    vulnerabilityApproachMs: normalizePositiveInt(
      globalSentinel.vulnerabilityApproachMs,
      GLOBAL_SENTINEL_SIMULATION_POLICY.vulnerabilityApproachMs,
      360,
      5000,
    ),
    vulnerabilityLockMs: normalizePositiveInt(
      globalSentinel.vulnerabilityLockMs,
      GLOBAL_SENTINEL_SIMULATION_POLICY.vulnerabilityLockMs,
      80,
      900,
    ),
    vulnerabilityCycleMs: normalizePositiveInt(
      globalSentinel.vulnerabilityCycleMs,
      GLOBAL_SENTINEL_SIMULATION_POLICY.vulnerabilityCycleMs,
      1200,
      18_000,
    ),
    vulnerabilityWindowMs: normalizePositiveInt(
      globalSentinel.vulnerabilityWindowMs,
      GLOBAL_SENTINEL_SIMULATION_POLICY.vulnerabilityWindowMs,
      240,
      5000,
    ),
    vulnerabilitySlowMotionScale: normalizeUnit(
      globalSentinel.vulnerabilitySlowMotionScale,
      GLOBAL_SENTINEL_SIMULATION_POLICY.vulnerabilitySlowMotionScale,
      0.15,
      0.8,
    ),
  };
}

export function resolveGlobalSentinelMinimumStrokeBudget(config = null) {
  assertGlobalSentinelProfile(config);
  return 1 + GLOBAL_SENTINEL_RESISTANCE_ACTS.length;
}

function clampUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeInteger(value, fallback = 0) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function isGlobalSentinelTerminalGamePhase(phase) {
  return phase === GLOBAL_SENTINEL_GAME_PHASES.FRACTURE_OPEN
    || phase === GLOBAL_SENTINEL_GAME_PHASES.RESYNC_COMPLETE;
}

function resolveBaseSyncPressureAtMs(timeMs, startedAtMs, deadlineAtMs) {
  return Math.max(
    0,
    (normalizeTime(timeMs) - startedAtMs) / Math.max(1, deadlineAtMs - startedAtMs),
  );
}

function isGlobalSentinelAwaitingStart(state = null) {
  if (!state || typeof state !== 'object') return true;
  if (state.awaitingStart === true) return true;
  const startedAtMs = Number(state.startedAtMs) || 0;
  const strokeCount = Number(state.strokeCount) || 0;
  const fracture = Number(state.fracture) || 0;
  return startedAtMs <= 0
    && strokeCount <= 0
    && fracture <= 0
    && state.completed !== true
    && state.failed !== true;
}

function smoothstepUnit(value) {
  const t = clampUnit(value);
  return t * t * (3 - 2 * t);
}

// Every act starts from the previous accepted action. Missing a contact repeats
// that act, never skips the reveal or advances a wall-clock story in the host.
function resolveResistanceActSchedule(state, policy) {
  const acceptedCount = Math.max(0, normalizeInteger(state?.strokeCount) - 1);
  const actIndex = Math.min(GLOBAL_SENTINEL_RESISTANCE_ACTS.length - 1, acceptedCount);
  const act = GLOBAL_SENTINEL_RESISTANCE_ACTS[actIndex];
  const approachMs = policy.vulnerabilityApproachMs + act.approachOffsetMs;
  const windowMs = policy.vulnerabilityWindowMs + act.windowOffsetMs;
  const recoveryMs = Math.max(2400, policy.vulnerabilityCycleMs
    - policy.vulnerabilityApproachMs - policy.vulnerabilityWindowMs);
  const cycleMs = approachMs + windowMs + recoveryMs;
  const startedAtMs = normalizeTime(state?.startedAtMs, 0);
  const cueAtMs = actIndex === 0
    ? startedAtMs + policy.vulnerabilityInitialDelayMs - approachMs
    : normalizeTime(state?.lastStrokeAtMs, startedAtMs) + act.breathMs;
  return {
    act, actIndex, approachMs, windowMs, recoveryMs, cycleMs, cueAtMs,
    activeAtMs: cueAtMs + approachMs,
    beatOffset: acceptedCount + Math.max(0, normalizeInteger(state?.missCount)),
  };
}

export function resolveGlobalSentinelRhythmState(state = null, config = null, {
  now = Date.now(),
} = {}) {
  const policy = resolveGlobalSentinelSimulationPolicy(config);
  const idle = {
    active: false, beatIndex: -1, attemptIndex: 0, consumed: false,
    firstActiveAtMs: 0, phase: GLOBAL_SENTINEL_RHYTHM_PHASES.BREATH,
    phaseProgress: 0, slowMotion: 0, telegraphProgress: 0,
    vulnerabilityProgress: 0, actIndex: -1, actId: 'entry', actProgress: 0,
    motionScale: 1, repairPressure: 0,
  };
  if (isGlobalSentinelAwaitingStart(state)) return Object.freeze(idle);
  if (policy.vulnerabilityLockMs > policy.vulnerabilityApproachMs) {
    throw new Error('GLOBAL_SENTINEL_RHYTHM_LOCK_EXCEEDS_APPROACH');
  }
  if (policy.vulnerabilityCycleMs < policy.vulnerabilityApproachMs + policy.vulnerabilityWindowMs + 240) {
    throw new Error('GLOBAL_SENTINEL_RHYTHM_CYCLE_TOO_SHORT');
  }
  const schedule = resolveResistanceActSchedule(state, policy);
  const nowMs = normalizeTime(now);
  const { act, actIndex, approachMs, windowMs, cycleMs, cueAtMs: firstCueAtMs } = schedule;
  const base = {
    ...idle,
    firstActiveAtMs: schedule.activeAtMs,
    actIndex, actId: act.id,
    actProgress: clampUnit((Number(state?.strokeCount) - 1) / GLOBAL_SENTINEL_RESISTANCE_ACTS.length),
    windowMs, cycleMs,
  };
  if (state?.completed === true || state?.failed === true) {
    return Object.freeze({ ...base, consumed: true, actProgress: state.completed ? 1 : base.actProgress });
  }
  if (nowMs < firstCueAtMs) {
    return Object.freeze({ ...base, phaseProgress: clampUnit(
      (nowMs - Number(state.lastStrokeAtMs)) / Math.max(1, firstCueAtMs - Number(state.lastStrokeAtMs)),
    ) });
  }
  const attemptIndex = Math.max(0, Math.floor((nowMs - firstCueAtMs) / cycleMs));
  const cueAtMs = firstCueAtMs + attemptIndex * cycleMs;
  const activeAtMs = cueAtMs + approachMs;
  const activeEndAtMs = activeAtMs + windowMs;
  const lockMs = Math.min(approachMs, policy.vulnerabilityLockMs + actIndex * 160);
  const lockAtMs = activeAtMs - lockMs;
  const beatIndex = schedule.beatOffset + attemptIndex;
  const common = { ...base, activeAtMs, activeEndAtMs, cueAtMs, beatIndex, attemptIndex };
  const activeMotionScale = Math.min(policy.vulnerabilitySlowMotionScale, act.slowMotionScale);
  if (nowMs < lockAtMs) {
    const phaseProgress = clampUnit((nowMs - cueAtMs) / Math.max(1, lockAtMs - cueAtMs));
    return Object.freeze({ ...common, active: true, phase: GLOBAL_SENTINEL_RHYTHM_PHASES.APPROACH,
      phaseProgress, telegraphProgress: phaseProgress * 0.72,
      repairPressure: (0.25 + actIndex * 0.2) * phaseProgress });
  }
  if (nowMs < activeAtMs) {
    const phaseProgress = clampUnit((nowMs - lockAtMs) / lockMs);
    const slowMotion = smoothstepUnit(phaseProgress);
    return Object.freeze({ ...common, active: true, phase: GLOBAL_SENTINEL_RHYTHM_PHASES.LOCK,
      phaseProgress, slowMotion, motionScale: 1 - slowMotion * (1 - activeMotionScale),
      telegraphProgress: 0.72 + phaseProgress * 0.28, repairPressure: 0.5 + actIndex * 0.2 });
  }
  if (nowMs < activeEndAtMs) {
    const phaseProgress = clampUnit((nowMs - activeAtMs) / windowMs);
    // The last decision remains suspended for the entire generous contact window.
    const slowMotion = actIndex === 2 ? 1 : 1 - smoothstepUnit((phaseProgress - 0.52) / 0.46);
    return Object.freeze({ ...common, active: true, phase: GLOBAL_SENTINEL_RHYTHM_PHASES.ACTIVE,
      phaseProgress, slowMotion, motionScale: 1 - slowMotion * (1 - activeMotionScale),
      telegraphProgress: 1, vulnerabilityProgress: phaseProgress,
      repairPressure: clampUnit(0.6 + actIndex * 0.2) });
  }
  return Object.freeze({ ...common, phase: GLOBAL_SENTINEL_RHYTHM_PHASES.RECOVERY,
    phaseProgress: clampUnit((nowMs - activeEndAtMs) / schedule.recoveryMs),
    repairPressure: 1 - clampUnit((nowMs - activeEndAtMs) / policy.missRepairDurationMs) });
}
function resolveFractureChannels(state = null) {
  const stableFracture = Number(state?.stableFracture);
  const volatileFracture = Number(state?.volatileFracture);
  const fracture = Number(state?.fracture);
  if (![stableFracture, volatileFracture, fracture].every(Number.isFinite)) {
    throw new Error('GLOBAL_SENTINEL_FRACTURE_CHANNELS_REQUIRED');
  }
  const normalizedStable = clampUnit(stableFracture);
  const normalizedVolatile = clampUnit(volatileFracture);
  const normalizedFracture = clampUnit(fracture);
  if (Math.abs((normalizedStable + normalizedVolatile) - normalizedFracture) > 1e-7) {
    throw new Error('GLOBAL_SENTINEL_FRACTURE_CHANNELS_MISMATCH');
  }
  return {
    stableFracture: normalizedStable,
    volatileFracture: normalizedVolatile,
    fracture: normalizedFracture,
  };
}

function resolveMissRepairSnapshot(state = null, policy, {
  now = Date.now(),
} = {}) {
  const channels = resolveFractureChannels(state);
  if (state?.completed === true) {
    return {
      ...channels,
      evaluatedThroughBeatIndex: normalizeInteger(state?.evaluatedThroughBeatIndex, -1),
      fractureRepairAmount: 0,
      fractureRepairPressure: 0,
      fractureRepairElapsedMs: 0,
      latestMissAtMs: 0,
      fractureRepairBeatIndex: -1,
      missCount: Math.max(0, Math.round(Number(state?.missCount) || 0)),
    };
  }

  const evaluatedThroughBeatIndex = normalizeInteger(state?.evaluatedThroughBeatIndex, -1);
  const schedule = resolveResistanceActSchedule(state, policy);
  const repairNowMs = Math.min(normalizeTime(now), Number(state.hardDeadlineAtMs));
  if (!Number.isFinite(repairNowMs)) throw new Error('GLOBAL_SENTINEL_REPAIR_DEADLINE_REQUIRED');
  const firstActiveEndAtMs = schedule.activeAtMs + schedule.windowMs;
  const expiredAttemptIndex = repairNowMs < firstActiveEndAtMs ? -1
    : Math.floor((repairNowMs - firstActiveEndAtMs) / schedule.cycleMs);
  if (expiredAttemptIndex < 0) {
    return {
      ...channels,
      evaluatedThroughBeatIndex,
      fractureRepairAmount: 0,
      fractureRepairPressure: 0,
      fractureRepairElapsedMs: 0,
      latestMissAtMs: 0,
      fractureRepairBeatIndex: -1,
      missCount: Math.max(0, Math.round(Number(state?.missCount) || 0)),
    };
  }

  let repairAmount = 0;
  let latestMissAtMs = 0;
  let latestRepairProgress = 0;
  for (let attemptIndex = 0; attemptIndex <= expiredAttemptIndex; attemptIndex += 1) {
    const missAtMs = firstActiveEndAtMs + attemptIndex * schedule.cycleMs;
    const progress = smoothstepUnit(
      (repairNowMs - missAtMs) / Math.max(1, policy.missRepairDurationMs),
    );
    repairAmount = Math.min(
      channels.volatileFracture,
      repairAmount + policy.missRepairImpulse * progress,
    );
    latestMissAtMs = missAtMs;
    latestRepairProgress = progress;
  }
  const volatileFracture = clampUnit(channels.volatileFracture - repairAmount);
  const repairPulse = Math.sin(Math.PI * latestRepairProgress);
  return {
    stableFracture: channels.stableFracture,
    volatileFracture,
    fracture: clampUnit(channels.stableFracture + volatileFracture),
    evaluatedThroughBeatIndex,
    fractureRepairAmount: repairAmount,
    fractureRepairPressure: clampUnit(repairPulse),
    fractureRepairElapsedMs: latestMissAtMs > 0
      ? Math.max(0, repairNowMs - latestMissAtMs)
      : 0,
    latestMissAtMs,
    fractureRepairBeatIndex: schedule.beatOffset + expiredAttemptIndex,
    missCount: Math.max(0, Math.round(Number(state?.missCount) || 0))
      + expiredAttemptIndex + 1,
  };
}

function resolveGlobalSentinelGameState(state = null, config = null, {
  now = Date.now(),
} = {}) {
  const policy = resolveGlobalSentinelSimulationPolicy(config);
  if (isGlobalSentinelAwaitingStart(state)) {
    return {
      gamePhase: GLOBAL_SENTINEL_GAME_PHASES.AWAITING_START,
      baseSyncPressure: 0,
      syncPressure: 0,
      syncPressureRelief: 0,
      syncPressureFailureThreshold: policy.syncPressureFailureThreshold,
      fracture: 0,
      fractureThreshold: policy.fractureThreshold,
      fractureRepairAmount: 0,
      fractureRepairPressure: 0,
      fractureRepairElapsedMs: 0,
      fractureRepairBeatIndex: -1,
      fractureUpdatedAtMs: 0,
      stableFracture: 0,
      volatileFracture: 0,
      missCount: 0,
      evaluatedThroughBeatIndex: -1,
      rhythmBeatIndex: -1,
      rhythmPhase: GLOBAL_SENTINEL_RHYTHM_PHASES.BREATH,
      rhythmPhaseProgress: 0,
      rhythmSlowMotion: 0,
      rhythmActIndex: -1,
      rhythmActId: 'entry',
      rhythmActProgress: 0,
      rhythmAttemptIndex: 0,
      rhythmRepairPressure: 0,
      rhythmPhaseRemainingMs: 0,
      sentinelIntegrity: 1,
      hardDeadlineAtMs: 0,
      hardExpired: false,
    };
  }
  const startedAtMs = normalizeTime(state?.startedAtMs, now);
  const deadlineAtMs = Number(state?.deadlineAtMs) > 0
    ? Number(state.deadlineAtMs)
    : resolveDeadlineAtMs(startedAtMs, policy);
  const hardDeadlineAtMs = Number(state?.hardDeadlineAtMs) > 0
    ? Number(state.hardDeadlineAtMs)
    : resolveHardDeadlineAtMs(startedAtMs, policy);
  if (!Number.isFinite(Number(state?.fracture))) {
    throw new Error('GLOBAL_SENTINEL_FRACTURE_REQUIRED');
  }
  const syncPressureRelief = clampUnit(Number(state?.syncPressureRelief) || 0);
  const baseSyncPressure = resolveBaseSyncPressureAtMs(now, startedAtMs, deadlineAtMs);
  const syncPressure = state?.failed === true
    ? policy.syncPressureFailureThreshold
    : clampUnit(baseSyncPressure - syncPressureRelief);
  const repair = resolveMissRepairSnapshot(state, policy, {
    now,
    startedAtMs,
  });
  const fracture = repair.fracture;
  const sentinelIntegrity = clampUnit(1 - fracture);
  const completed = state?.completed === true || (
    Number(state?.strokeCount) >= resolveGlobalSentinelMinimumStrokeBudget(config)
    && fracture >= policy.fractureThreshold
    && syncPressure <= policy.successMaxSyncPressure
  );
  const hardExpired = normalizeTime(now) >= hardDeadlineAtMs;
  const failed = !completed && (
    state?.failed === true
    || syncPressure >= policy.syncPressureFailureThreshold
    || hardExpired
  );
  let gamePhase = GLOBAL_SENTINEL_GAME_PHASES.REPAIR_RACE;
  if (failed) gamePhase = GLOBAL_SENTINEL_GAME_PHASES.RESYNC_COMPLETE;
  else if (completed) gamePhase = GLOBAL_SENTINEL_GAME_PHASES.FRACTURE_OPEN;
  const rhythm = resolveGlobalSentinelRhythmState(state, config, { now });

  return {
    gamePhase,
    baseSyncPressure,
    syncPressure,
    syncPressureRelief,
    syncPressureFailureThreshold: policy.syncPressureFailureThreshold,
    fracture,
    fractureThreshold: policy.fractureThreshold,
    fractureRepairAmount: repair.fractureRepairAmount,
    fractureRepairPressure: repair.fractureRepairPressure,
    fractureRepairElapsedMs: repair.fractureRepairElapsedMs,
    fractureRepairBeatIndex: repair.fractureRepairBeatIndex,
    fractureUpdatedAtMs: normalizeTime(state?.fractureUpdatedAtMs, startedAtMs),
    stableFracture: repair.stableFracture,
    volatileFracture: repair.volatileFracture,
    missCount: repair.missCount,
    evaluatedThroughBeatIndex: repair.evaluatedThroughBeatIndex,
    latestMissAtMs: repair.latestMissAtMs,
    rhythmBeatIndex: rhythm.beatIndex,
    rhythmPhase: rhythm.phase,
    rhythmPhaseProgress: rhythm.phaseProgress,
    rhythmSlowMotion: rhythm.slowMotion,
    rhythmActIndex: rhythm.actIndex,
    rhythmActId: rhythm.actId,
    rhythmActProgress: rhythm.actProgress,
    rhythmAttemptIndex: rhythm.attemptIndex,
    rhythmRepairPressure: rhythm.repairPressure,
    rhythmPhaseRemainingMs: rhythm.phase === GLOBAL_SENTINEL_RHYTHM_PHASES.APPROACH
      || rhythm.phase === GLOBAL_SENTINEL_RHYTHM_PHASES.LOCK
      ? Math.max(0, rhythm.activeAtMs - normalizeTime(now))
      : rhythm.phase === GLOBAL_SENTINEL_RHYTHM_PHASES.ACTIVE
        ? Math.max(0, rhythm.activeEndAtMs - normalizeTime(now)) : 0,
    sentinelIntegrity,
    hardDeadlineAtMs,
    hardExpired,
  };
}

export function createGlobalSentinelSimulationState({
  now = Date.now(),
} = {}) {
  return {
    protocolSystem: GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
    awaitingStart: true,
    createdAtMs: normalizeTime(now),
    startedAtMs: 0,
    dormantCount: 0,
    completed: false,
    failed: false,
    completedAtMs: 0,
    readyAtMs: 0,
    deadlineAtMs: 0,
    hardDeadlineAtMs: 0,
    lastStrokeAtMs: 0,
    strokeCount: 0,
    lastHitEfficiency: 0,
    lastFractureImpulse: 0,
    lastSyncPressureRelief: 0,
    fractureUpdatedAtMs: 0,
    fractureRepairAmount: 0,
    fractureRepairPressure: 0,
    fractureRepairElapsedMs: 0,
    stableFracture: 0,
    volatileFracture: 0,
    missCount: 0,
    evaluatedThroughBeatIndex: -1,
    latestMissAtMs: 0,
    gamePhase: GLOBAL_SENTINEL_GAME_PHASES.AWAITING_START,
    baseSyncPressure: 0,
    syncPressure: 0,
    syncPressureRelief: 0,
    syncPressureFailureThreshold: GLOBAL_SENTINEL_SIMULATION_POLICY.syncPressureFailureThreshold,
    fracture: 0,
    fractureThreshold: GLOBAL_SENTINEL_SIMULATION_POLICY.fractureThreshold,
    sentinelIntegrity: 1,
  };
}

function resolveDeadlineAtMs(startedAtMs, policy) {
  return startedAtMs + policy.syncDurationMs;
}

function resolveHardDeadlineAtMs(startedAtMs, policy) {
  return startedAtMs + policy.hardTimeLimitMs;
}

function resolveStrokeEfficiency(state = null, policy, strokeAtMs) {
  if (policy.rapidHitWindowMs <= 0 || policy.minHitEfficiency >= 1) return 1;
  const lastStrokeAtMs = Number(state?.lastStrokeAtMs) || 0;
  if (lastStrokeAtMs <= 0) return 1;
  const intervalMs = Math.max(0, strokeAtMs - lastStrokeAtMs);
  if (intervalMs >= policy.rapidHitWindowMs) return 1;
  const blend = intervalMs / Math.max(1, policy.rapidHitWindowMs);
  return normalizeUnit(
    policy.minHitEfficiency + (1 - policy.minHitEfficiency) * blend,
    policy.minHitEfficiency,
    policy.minHitEfficiency,
    1,
  );
}

function resolveDormantCountFromFracture(fracture, policy) {
  const fractureRatio = clampUnit(fracture / Math.max(0.01, policy.fractureThreshold));
  return Math.min(
    policy.targetDormantCount,
    Math.max(0, Math.floor(fractureRatio * policy.targetDormantCount + 1e-9)),
  );
}

export function isGlobalSentinelSimulationExpired(state = null, config = null, {
  now = Date.now(),
} = {}) {
  if (!state || state.completed || state.failed) return false;
  if (isGlobalSentinelAwaitingStart(state)) return false;
  const policy = resolveGlobalSentinelSimulationPolicy(config);
  const startedAtMs = normalizeTime(state.startedAtMs, now);
  const deadlineAtMs = Number(state.deadlineAtMs) > 0
    ? Number(state.deadlineAtMs)
    : resolveDeadlineAtMs(startedAtMs, policy);
  const hardDeadlineAtMs = Number(state.hardDeadlineAtMs) > 0
    ? Number(state.hardDeadlineAtMs)
    : resolveHardDeadlineAtMs(startedAtMs, policy);
  const gameState = resolveGlobalSentinelGameState({
    ...state,
    startedAtMs,
    deadlineAtMs,
    hardDeadlineAtMs,
  }, config, { now });
  return gameState.gamePhase === GLOBAL_SENTINEL_GAME_PHASES.RESYNC_COMPLETE;
}

export function advanceGlobalSentinelSimulationOnStroke(state = null, config = null, {
  now = Date.now(),
  hitEfficiency: explicitHitEfficiency = null,
} = {}) {
  const current = state && typeof state === 'object'
    ? state
    : createGlobalSentinelSimulationState({ now });
  const policy = resolveGlobalSentinelSimulationPolicy(config);
  const strokeAtMs = normalizeTime(now);
  const awaitingStart = isGlobalSentinelAwaitingStart(current);
  const startedAtMs = awaitingStart
    ? strokeAtMs
    : normalizeTime(current.startedAtMs, now);
  const deadlineAtMs = Number(current.deadlineAtMs) > 0
    ? Number(current.deadlineAtMs)
    : resolveDeadlineAtMs(startedAtMs, policy);
  const hardDeadlineAtMs = Number(current.hardDeadlineAtMs) > 0
    ? Number(current.hardDeadlineAtMs)
    : resolveHardDeadlineAtMs(startedAtMs, policy);
  if (current.failed || isGlobalSentinelSimulationExpired({
    ...current,
    startedAtMs,
    deadlineAtMs,
    hardDeadlineAtMs,
  }, config, { now })) {
    const failedState = {
      ...current,
      protocolSystem: GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
      awaitingStart: false,
      startedAtMs,
      failed: true,
      completed: false,
      readyAtMs: 0,
      deadlineAtMs,
      hardDeadlineAtMs,
      lastStrokeAtMs: strokeAtMs,
      fractureUpdatedAtMs: strokeAtMs,
    };
    return {
      ...failedState,
      ...resolveGlobalSentinelGameState(failedState, config, { now: strokeAtMs }),
    };
  }
  if (current.completed) {
    const completedState = {
      ...current,
      protocolSystem: GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
      awaitingStart: false,
      startedAtMs,
      deadlineAtMs,
      hardDeadlineAtMs,
      lastStrokeAtMs: strokeAtMs,
      fractureUpdatedAtMs: normalizeTime(current.fractureUpdatedAtMs, strokeAtMs),
    };
    return {
      ...completedState,
      ...resolveGlobalSentinelGameState(completedState, config, { now: strokeAtMs }),
    };
  }

  const before = resolveGlobalSentinelGameState({
    ...current,
    startedAtMs,
    deadlineAtMs,
    hardDeadlineAtMs,
  }, config, { now: strokeAtMs });
  const hasExplicitEfficiency = explicitHitEfficiency !== null && explicitHitEfficiency !== undefined;
  const explicitEfficiency = Number(explicitHitEfficiency);
  const hitEfficiency = hasExplicitEfficiency && Number.isFinite(explicitEfficiency)
    ? normalizeUnit(explicitEfficiency, 1)
    : resolveStrokeEfficiency(current, policy, strokeAtMs);
  const strokeCount = Math.max(0, Number(current.strokeCount) || 0) + 1;
  const isFinalAct = strokeCount >= resolveGlobalSentinelMinimumStrokeBudget(config);
  // Damage is physical feedback, while the three accepted resistance acts own
  // narrative completion. A repaired volatile edge never costs a completed act.
  const fractureCeiling = isFinalAct ? policy.fractureThreshold
    : policy.fractureThreshold * (awaitingStart ? 0.36 : strokeCount === 2 ? 0.58 : 0.82);
  const fractureImpulse = isFinalAct
    ? Math.max(policy.fractureImpulse * hitEfficiency, policy.fractureThreshold - before.fracture)
    : policy.fractureImpulse * hitEfficiency;
  const syncPressureRelief = Math.min(
    policy.maxSyncPressureRelief,
    before.syncPressureRelief + policy.syncPressureReliefPerHit * hitEfficiency,
  );
  const acceptedFractureImpulse = Math.min(
    fractureImpulse,
    Math.max(0, fractureCeiling - before.fracture),
  );
  const stableImpulse = acceptedFractureImpulse * policy.fractureStableRatio;
  const volatileImpulse = acceptedFractureImpulse - stableImpulse;
  const stableFracture = clampUnit(before.stableFracture + stableImpulse);
  const volatileFracture = isFinalAct
    ? policy.fractureThreshold - stableFracture
    : clampUnit(before.volatileFracture + volatileImpulse);
  const fracture = isFinalAct ? policy.fractureThreshold : clampUnit(stableFracture + volatileFracture);
  const dormantCount = resolveDormantCountFromFracture(fracture, policy);
  const completed = isFinalAct && fracture >= policy.fractureThreshold;
  const completedAtMs = completed ? strokeAtMs : 0;
  const readyAtMs = completed ? strokeAtMs + policy.collapseHoldMs : 0;
  const evaluatedThroughBeatIndex = awaitingStart
    ? -1
    : Math.max(
      before.evaluatedThroughBeatIndex,
      Math.max(0, before.rhythmBeatIndex),
    );

  const nextState = {
    protocolSystem: GLOBAL_SENTINEL_PROTOCOL_SYSTEM,
    awaitingStart: false,
    startedAtMs,
    dormantCount,
    strokeCount,
    completed,
    failed: false,
    completedAtMs,
    readyAtMs,
    deadlineAtMs,
    hardDeadlineAtMs,
    lastStrokeAtMs: strokeAtMs,
    fractureUpdatedAtMs: strokeAtMs,
    stableFracture,
    volatileFracture,
    missCount: before.missCount,
    evaluatedThroughBeatIndex,
    latestMissAtMs: before.latestMissAtMs,
    lastHitEfficiency: hitEfficiency,
    lastFractureImpulse: acceptedFractureImpulse,
    lastSyncPressureRelief: syncPressureRelief - before.syncPressureRelief,
    syncPressureRelief,
    fracture,
  };
  return {
    ...nextState,
    ...resolveGlobalSentinelGameState(nextState, config, { now: strokeAtMs }),
  };
}

export function isGlobalSentinelSimulationReady(state = null, {
  now = Date.now(),
} = {}) {
  if (!state?.completed) return false;
  const readyAtMs = normalizeTime(state.readyAtMs, Number.POSITIVE_INFINITY);
  return normalizeTime(now) >= readyAtMs;
}

export function resolveGlobalSentinelSimulationProgress(state = null, config = null, {
  now = Date.now(),
} = {}) {
  const policy = resolveGlobalSentinelSimulationPolicy(config);
  if (isGlobalSentinelAwaitingStart(state)) {
    const gameState = resolveGlobalSentinelGameState(state, config, { now });
    return {
      ...policy,
      ...gameState,
      dormantCount: 0,
      targetDormantCount: policy.targetDormantCount,
      completed: false,
      failed: false,
      ready: false,
      progress: 0,
      syncLevel: 0,
      startedAtMs: 0,
      completedAtMs: 0,
      readyAtMs: 0,
      deadlineAtMs: 0,
      hardDeadlineAtMs: 0,
      strokeCount: 0,
      lastHitEfficiency: 0,
      lastFractureImpulse: 0,
      lastSyncPressureRelief: 0,
      remainingMs: 0,
      timeProgress: 0,
      outcome: 'running',
    };
  }
  const startedAtMs = normalizeTime(state?.startedAtMs, now);
  const deadlineAtMs = Number(state?.deadlineAtMs) > 0
    ? Number(state.deadlineAtMs)
    : resolveDeadlineAtMs(startedAtMs, policy);
  const hardDeadlineAtMs = Number(state?.hardDeadlineAtMs) > 0
    ? Number(state.hardDeadlineAtMs)
    : resolveHardDeadlineAtMs(startedAtMs, policy);
  const gameState = resolveGlobalSentinelGameState({
    ...state,
    startedAtMs,
    deadlineAtMs,
    hardDeadlineAtMs,
  }, config, { now });
  const dormantCount = resolveDormantCountFromFracture(gameState.fracture, policy);
  const completed = state?.completed === true || (
    Number(state?.strokeCount) >= resolveGlobalSentinelMinimumStrokeBudget(config)
    && gameState.fracture >= policy.fractureThreshold
    && gameState.syncPressure <= policy.successMaxSyncPressure
  );
  const failed = !completed && (
    state?.failed === true
    || gameState.syncPressure >= policy.syncPressureFailureThreshold
    || gameState.hardExpired
  );
  const ready = !failed && isGlobalSentinelSimulationReady(state, { now });
  const completedAtMs = normalizeTime(state?.completedAtMs, 0);
  const readyAtMs = normalizeTime(state?.readyAtMs, 0);
  const holdDurationMs = completed && readyAtMs > completedAtMs
    ? Math.max(1, readyAtMs - completedAtMs)
    : 0;
  const holdProgress = holdDurationMs > 0
    ? Math.min(1, Math.max(0, (normalizeTime(now) - completedAtMs) / holdDurationMs))
    : (completed ? 1 : 0);
  const progress = gameState.fracture;
  const syncLevel = Math.min(
    1,
    Math.max(0, (normalizeTime(now) - startedAtMs) / Math.max(1, deadlineAtMs - startedAtMs)),
  );
  const pressureFailureAtMs = startedAtMs
    + Math.max(1, deadlineAtMs - startedAtMs) * (policy.syncPressureFailureThreshold + gameState.syncPressureRelief);
  const failureAtMs = Math.min(pressureFailureAtMs, hardDeadlineAtMs);
  const remainingMs = failed ? 0 : Math.max(0, failureAtMs - normalizeTime(now));

  return {
    ...policy,
    ...gameState,
    dormantCount: Math.min(policy.targetDormantCount, dormantCount),
    targetDormantCount: policy.targetDormantCount,
    completed,
    failed,
    ready,
    progress,
    syncLevel,
    startedAtMs,
    completedAtMs,
    readyAtMs,
    deadlineAtMs,
    hardDeadlineAtMs,
    strokeCount: Math.max(0, Number(state?.strokeCount) || 0),
    lastHitEfficiency: normalizeUnit(state?.lastHitEfficiency, 0),
    lastFractureImpulse: normalizeUnit(state?.lastFractureImpulse, 0),
    lastSyncPressureRelief: normalizeUnit(state?.lastSyncPressureRelief, 0),
    remainingMs,
    timeProgress: completed ? holdProgress : gameState.syncPressure,
    outcome: failed ? 'failure' : (ready ? 'success' : 'running'),
  };
}
