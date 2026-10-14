export const FEED_HORIZON_INSPECTION_COMMANDS = Object.freeze({
  ARM: 'arm',
  REARM: 'rearm',
  DISARM: 'disarm',
});

export const FEED_HORIZON_INSPECTION_HANDOFF_MODES = Object.freeze({
  PRODUCTION: 'production',
  FEEDBACK_ONLY: 'feedback_only',
});

const COMMAND_SET = new Set(Object.values(FEED_HORIZON_INSPECTION_COMMANDS));
const HANDOFF_MODE_SET = new Set(Object.values(FEED_HORIZON_INSPECTION_HANDOFF_MODES));
const ACTIVE_CONTROL_KEYS = new Set(['command', 'handoffMode', 'stillGateMs']);

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeFeedHorizonInspectionControl(value) {
  if (!isRecord(value)) {
    throw new Error('FEED_HORIZON_INSPECTION_CONTROL_OBJECT_REQUIRED');
  }
  const keys = Object.keys(value);
  const command = value.command;
  if (!COMMAND_SET.has(command)) {
    throw new Error('FEED_HORIZON_INSPECTION_COMMAND_INVALID');
  }
  if (command === FEED_HORIZON_INSPECTION_COMMANDS.DISARM) {
    if (keys.length !== 1 || keys[0] !== 'command') {
      throw new Error('FEED_HORIZON_INSPECTION_DISARM_KEYS_INVALID');
    }
    return Object.freeze({ command });
  }
  if (keys.some((key) => !ACTIVE_CONTROL_KEYS.has(key))) {
    throw new Error('FEED_HORIZON_INSPECTION_CONTROL_KEYS_INVALID');
  }

  const stillGateMs = value.stillGateMs ?? null;
  if (
    stillGateMs !== null
    && (
      !Number.isSafeInteger(stillGateMs)
      || stillGateMs < 0
      || stillGateMs > 30_000
    )
  ) {
    throw new Error('FEED_HORIZON_INSPECTION_STILL_GATE_INVALID');
  }
  const handoffMode = value.handoffMode
    ?? FEED_HORIZON_INSPECTION_HANDOFF_MODES.PRODUCTION;
  if (!HANDOFF_MODE_SET.has(handoffMode)) {
    throw new Error('FEED_HORIZON_INSPECTION_HANDOFF_MODE_INVALID');
  }
  if (
    handoffMode === FEED_HORIZON_INSPECTION_HANDOFF_MODES.FEEDBACK_ONLY
    && stillGateMs === null
  ) {
    throw new Error('FEED_HORIZON_INSPECTION_FEEDBACK_STILL_GATE_REQUIRED');
  }
  return Object.freeze({
    command,
    stillGateMs,
    handoffMode,
  });
}

export function createInactiveFeedHorizonInspectionSnapshot() {
  return {
    version: 2,
    active: false,
    cycleId: 0,
    source: null,
    startedAt: 0,
    command: null,
    stillGateMs: null,
    handoffMode: FEED_HORIZON_INSPECTION_HANDOFF_MODES.PRODUCTION,
    phase: 'inactive',
    endpointReady: false,
    boundaryReached: false,
    boundaryReachedAt: 0,
    holdRemainingMs: 0,
    controlsLive: false,
    feedbackPresentedAt: 0,
    finishedReason: null,
  };
}
