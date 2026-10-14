const DASHBOARD_ENTRY_STAGE_EVENT_PREFIX = 'dashboard_entry:stage_import';

export const DASHBOARD_ENTRY_STAGE_IDS = Object.freeze([
  'react_host',
  'i18n',
  'document_theme',
  'app',
  'theme_boot_runtime',
]);

export const DASHBOARD_ENTRY_STAGE_PHASES = Object.freeze([
  'start',
  'ready',
  'failed',
]);

const STAGE_ID_SET = new Set(DASHBOARD_ENTRY_STAGE_IDS);
const STAGE_PHASE_SET = new Set(DASHBOARD_ENTRY_STAGE_PHASES);

const requireStageId = (value) => {
  if (!STAGE_ID_SET.has(value)) {
    throw new Error(`DASHBOARD_ENTRY_STAGE_ID_INVALID:${String(value)}`);
  }
  return value;
};

const requireStagePhase = (value) => {
  if (!STAGE_PHASE_SET.has(value)) {
    throw new Error(`DASHBOARD_ENTRY_STAGE_PHASE_INVALID:${String(value)}`);
  }
  return value;
};

const readElapsedMs = (entry) => {
  const elapsedMs = Number(entry?.elapsedMs);
  return Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : null;
};

export const createDashboardEntryStageTraceEvent = (stageId, phase) => (
  `${DASHBOARD_ENTRY_STAGE_EVENT_PREFIX}`
  + `:${requireStageId(stageId)}`
  + `:${requireStagePhase(phase)}`
);

export const parseDashboardEntryStageTraceEvent = (event) => {
  if (typeof event !== 'string') return null;
  const prefix = `${DASHBOARD_ENTRY_STAGE_EVENT_PREFIX}:`;
  if (!event.startsWith(prefix)) return null;
  const tokens = event.slice(prefix.length).split(':');
  if (tokens.length !== 2) return null;
  const [stageId, phase] = tokens;
  if (!STAGE_ID_SET.has(stageId) || !STAGE_PHASE_SET.has(phase)) return null;
  return Object.freeze({ stageId, phase });
};

export const projectDashboardEntryStageTrace = (history) => {
  if (!Array.isArray(history)) return Object.freeze([]);
  const startedAtByStage = new Map();
  const stages = [];

  history.forEach((entry) => {
    const parsed = parseDashboardEntryStageTraceEvent(entry?.event);
    if (!parsed) return;
    const elapsedMs = readElapsedMs(entry);
    if (parsed.phase === 'start') {
      if (elapsedMs !== null) startedAtByStage.set(parsed.stageId, elapsedMs);
      return;
    }
    if (parsed.phase !== 'ready') return;

    const detailDuration = entry?.details?.durationMs;
    const detailDurationMs = Number(detailDuration);
    const hasDetailDuration = (
      detailDuration !== null
      && detailDuration !== undefined
      && Number.isFinite(detailDurationMs)
      && detailDurationMs >= 0
    );
    const startedAtMs = startedAtByStage.get(parsed.stageId);
    const derivedDurationMs = (
      elapsedMs !== null
      && Number.isFinite(startedAtMs)
      && elapsedMs >= startedAtMs
    )
      ? Number((elapsedMs - startedAtMs).toFixed(2))
      : null;
    stages.push(Object.freeze({
      stageId: parsed.stageId,
      durationMs: hasDetailDuration
        ? detailDurationMs
        : derivedDurationMs,
      elapsedMs,
    }));
  });

  return Object.freeze(stages);
};

export const requireDashboardEntryStageTraceProjection = (projection) => {
  if (!Array.isArray(projection)) {
    throw new Error('DASHBOARD_ENTRY_STAGE_TRACE_PROJECTION_REQUIRED');
  }
  const observedCounts = new Map();
  projection.forEach((entry) => {
    if (!STAGE_ID_SET.has(entry?.stageId)) {
      throw new Error('DASHBOARD_ENTRY_STAGE_TRACE_STAGE_INVALID');
    }
    if (
      !Number.isFinite(Number(entry?.durationMs))
      || Number(entry.durationMs) < 0
      || !Number.isFinite(Number(entry?.elapsedMs))
      || Number(entry.elapsedMs) < 0
    ) {
      throw new Error(
        `DASHBOARD_ENTRY_STAGE_TRACE_TIMING_INVALID:${entry.stageId}`,
      );
    }
    observedCounts.set(entry.stageId, (observedCounts.get(entry.stageId) || 0) + 1);
  });
  const invalidStage = DASHBOARD_ENTRY_STAGE_IDS.find(
    (stageId) => observedCounts.get(stageId) !== 1,
  );
  if (invalidStage) {
    throw new Error(
      `DASHBOARD_ENTRY_STAGE_TRACE_CARDINALITY_INVALID`
      + `:${invalidStage}:${observedCounts.get(invalidStage) || 0}`,
    );
  }
  return projection;
};
