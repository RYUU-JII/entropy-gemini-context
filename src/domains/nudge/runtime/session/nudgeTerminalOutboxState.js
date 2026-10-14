import {
  completeNudgeTerminalOutboxStage,
  normalizeNudgeTerminalOutboxMap,
  pruneNudgeTerminalOutboxMap,
  recordNudgeTerminalOutboxStageFailure,
  resolveNudgeTerminalOutboxReplay,
} from './nudgeTerminalOutboxContract.js';
import {
  getSession,
  setSession,
  withNudgeSessionLock,
} from './nudgeSessionStore.js';
import {
  NUDGE_SESSION_KEYS,
  readNudgeSessionMap,
} from './nudgeSessionShared.js';

export async function readPendingNudgeTerminalOutboxEntries() {
  const session = await getSession({
    [NUDGE_SESSION_KEYS.TERMINAL_OUTBOX]: {},
  });
  const outbox = normalizeNudgeTerminalOutboxMap(
    readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL_OUTBOX),
  );
  return Object.values(outbox)
    .filter((entry) => entry.state === 'pending')
    .sort((a, b) => a.committedAt - b.committedAt);
}

export async function markNudgeTerminalOutboxStageCompleted(
  runId,
  {
    key,
    tabId,
    status,
    stage,
    now = Date.now(),
  } = {},
) {
  return withNudgeSessionLock(async () => {
    const session = await getSession({
      [NUDGE_SESSION_KEYS.TERMINAL_OUTBOX]: {},
    });
    const outbox = normalizeNudgeTerminalOutboxMap(
      readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL_OUTBOX),
    );
    const replay = resolveNudgeTerminalOutboxReplay(outbox[runId], {
      key,
      runId,
      tabId,
      status,
    });
    if (!replay) {
      return {
        outcome: 'rejected',
        reason: 'NUDGE_TERMINAL_OUTBOX_ENTRY_MISSING',
        entry: null,
      };
    }
    if (replay.outcome === 'conflict') return replay;

    const previous = replay.entry;
    if (previous.completedStages.includes(stage)) {
      return {
        outcome: 'already_completed',
        reason: null,
        entry: previous,
      };
    }
    const next = completeNudgeTerminalOutboxStage(previous, stage, now);

    outbox[runId] = next;
    await setSession({
      [NUDGE_SESSION_KEYS.TERMINAL_OUTBOX]: pruneNudgeTerminalOutboxMap(outbox, now),
    });
    return {
      outcome: 'completed',
      reason: null,
      entry: next,
    };
  });
}

export async function markNudgeTerminalOutboxStageFailed(
  runId,
  {
    key,
    tabId,
    status,
    stage,
    code,
    now = Date.now(),
  } = {},
) {
  return withNudgeSessionLock(async () => {
    const session = await getSession({
      [NUDGE_SESSION_KEYS.TERMINAL_OUTBOX]: {},
    });
    const outbox = normalizeNudgeTerminalOutboxMap(
      readNudgeSessionMap(session, NUDGE_SESSION_KEYS.TERMINAL_OUTBOX),
    );
    const replay = resolveNudgeTerminalOutboxReplay(outbox[runId], {
      key,
      runId,
      tabId,
      status,
    });
    if (!replay) {
      return {
        outcome: 'rejected',
        reason: 'NUDGE_TERMINAL_OUTBOX_ENTRY_MISSING',
        entry: null,
      };
    }
    if (replay.outcome === 'conflict') return replay;

    if (replay.entry.completedStages.includes(stage)) {
      return {
        outcome: 'already_completed',
        reason: null,
        entry: replay.entry,
      };
    }

    const next = recordNudgeTerminalOutboxStageFailure(replay.entry, stage, code, now);
    outbox[runId] = next;
    await setSession({
      [NUDGE_SESSION_KEYS.TERMINAL_OUTBOX]: pruneNudgeTerminalOutboxMap(outbox, now),
    });
    return {
      outcome: 'recorded',
      reason: null,
      entry: next,
    };
  });
}
