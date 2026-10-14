export const NUDGE_TERMINAL_SEQUENCE_OUTCOMES = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
});

export const NUDGE_TERMINAL_SEQUENCE_MODES = Object.freeze({
  BANISH: 'banish',
  RESYNC: 'resync',
});

export const NUDGE_TERMINAL_SEQUENCE_SCENE_PHASES = Object.freeze({
  BANISH: 'banish',
  RESYNCING: 'resyncing',
});

export const NUDGE_TERMINAL_SEQUENCE_DURATIONS_MS = Object.freeze({
  [NUDGE_TERMINAL_SEQUENCE_MODES.BANISH]: 1800,
  [NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC]: 1600,
});

// Keep the original fracture canvas after the actors have gone. The host owns
// this quiet ending too; neither QA cleanup nor rift navigation may skip it.
export const NUDGE_TERMINAL_SEQUENCE_SETTLE_MS = 4000;

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeTimestamp(value, fallback = Date.now()) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function normalizeDurationMs(value, fallback) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric > 0
    ? clamp(numeric, 120, 4000)
    : fallback;
}

function normalizeOutcome(value) {
  if (value === NUDGE_TERMINAL_SEQUENCE_OUTCOMES.SUCCESS) {
    return NUDGE_TERMINAL_SEQUENCE_OUTCOMES.SUCCESS;
  }
  if (value === NUDGE_TERMINAL_SEQUENCE_OUTCOMES.FAILURE) {
    return NUDGE_TERMINAL_SEQUENCE_OUTCOMES.FAILURE;
  }
  throw new Error(`nudge_terminal_sequence_outcome_invalid:${String(value)}`);
}

export function normalizeNudgeTerminalSequenceMode(value, fallback = NUDGE_TERMINAL_SEQUENCE_MODES.BANISH) {
  if (value === NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC) {
    return NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC;
  }
  if (value === NUDGE_TERMINAL_SEQUENCE_MODES.BANISH) {
    return NUDGE_TERMINAL_SEQUENCE_MODES.BANISH;
  }
  if (value !== null && value !== undefined && value !== '') {
    throw new Error(`nudge_terminal_sequence_mode_invalid:${String(value)}`);
  }
  return fallback === NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC
    ? NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC
    : NUDGE_TERMINAL_SEQUENCE_MODES.BANISH;
}

export function resolveNudgeTerminalSequenceModeForOutcome(outcome) {
  return normalizeOutcome(outcome) === NUDGE_TERMINAL_SEQUENCE_OUTCOMES.FAILURE
    ? NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC
    : NUDGE_TERMINAL_SEQUENCE_MODES.BANISH;
}

export function resolveNudgeTerminalSequenceScenePhase(mode) {
  return normalizeNudgeTerminalSequenceMode(mode) === NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC
    ? NUDGE_TERMINAL_SEQUENCE_SCENE_PHASES.RESYNCING
    : NUDGE_TERMINAL_SEQUENCE_SCENE_PHASES.BANISH;
}

export function createNudgeTerminalSequenceState({
  outcome = NUDGE_TERMINAL_SEQUENCE_OUTCOMES.SUCCESS,
  mode = null,
  now = Date.now(),
  durationMs = null,
} = {}) {
  const normalizedOutcome = normalizeOutcome(outcome);
  const normalizedMode = normalizeNudgeTerminalSequenceMode(
    mode,
    resolveNudgeTerminalSequenceModeForOutcome(normalizedOutcome),
  );
  const durationFallback = NUDGE_TERMINAL_SEQUENCE_DURATIONS_MS[normalizedMode];
  return {
    outcome: normalizedOutcome,
    mode: normalizedMode,
    scenePhase: resolveNudgeTerminalSequenceScenePhase(normalizedMode),
    startedAtMs: normalizeTimestamp(now),
    durationMs: normalizeDurationMs(durationMs, durationFallback),
  };
}

export function normalizeNudgeTerminalSequenceState(raw = null) {
  if (!raw || typeof raw !== 'object') return null;
  const mode = normalizeNudgeTerminalSequenceMode(raw.mode, resolveNudgeTerminalSequenceModeForOutcome(raw.outcome));
  const durationFallback = NUDGE_TERMINAL_SEQUENCE_DURATIONS_MS[mode];
  const startedAtMs = normalizeTimestamp(raw.startedAtMs, 0);
  if (!startedAtMs) return null;
  return {
    outcome: normalizeOutcome(raw.outcome),
    mode,
    scenePhase: resolveNudgeTerminalSequenceScenePhase(mode),
    startedAtMs,
    durationMs: normalizeDurationMs(raw.durationMs, durationFallback),
  };
}

function easeOutCubic(t) {
  const p = clamp(t, 0, 1);
  return 1 - ((1 - p) ** 3);
}

function easeInOutQuad(t) {
  const p = clamp(t, 0, 1);
  return p < 0.5 ? 2 * p * p : 1 - (((-2 * p + 2) ** 2) / 2);
}

export function resolveNudgeTerminalSequenceProgress(sequence = null, {
  now = Date.now(),
  delayMs = 0,
} = {}) {
  const normalized = normalizeNudgeTerminalSequenceState(sequence);
  if (!normalized) {
    return {
      active: false,
      done: false,
      mode: '',
      progress: 0,
      eased: 0,
      alpha: 1,
      scale: 1,
      driftPx: 0,
    };
  }

  const delay = clamp(delayMs, 0, 500);
  const elapsedMs = Math.max(0, normalizeTimestamp(now) - normalized.startedAtMs - delay);
  const durationMs = Math.max(1, normalized.durationMs);
  const progress = clamp(elapsedMs / durationMs, 0, 1);
  const isResync = normalized.mode === NUDGE_TERMINAL_SEQUENCE_MODES.RESYNC;
  const eased = isResync ? easeInOutQuad(progress) : easeOutCubic(progress);
  return {
    ...normalized,
    active: true,
    done: progress >= 1,
    elapsedMs,
    progress,
    eased,
    alpha: clamp(1 - eased, 0, 1),
    scale: isResync
      ? clamp(1 + eased * 0.12, 1, 1.12)
      : clamp(1 - eased * 0.46, 0.54, 1),
    driftPx: isResync
      ? eased * 18
      : eased * 34,
  };
}

export function getNudgeTerminalSequenceTotalMs(sequence = null) {
  const normalized = normalizeNudgeTerminalSequenceState(sequence);
  if (!normalized) return 0;
  return normalized.durationMs + NUDGE_TERMINAL_SEQUENCE_SETTLE_MS;
}

export function isNudgeTerminalSequenceDone(sequence = null, {
  now = Date.now(),
  settleMs = NUDGE_TERMINAL_SEQUENCE_SETTLE_MS,
} = {}) {
  const normalized = normalizeNudgeTerminalSequenceState(sequence);
  if (!normalized) return false;
  return normalizeTimestamp(now) >= normalized.startedAtMs + normalized.durationMs + clamp(settleMs, 0, 5000);
}
