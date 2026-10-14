export const BOOT_DIAGNOSTICS_REPORT_KIND = 'entropy.dashboard_boot_diagnostics_report.v1';

export const BOOT_DIAGNOSTICS_SECTION_IDS = Object.freeze({
  FULL: 'full',
  SUMMARY: 'summary',
  TIMING: 'timing',
  MAIN_FRAME: 'main_frame',
  ERRORS: 'errors',
  STATE: 'state',
  TRACE: 'trace',
});

const BOOT_ERROR_PATTERN = /(fail|failure|failed|error|timeout|degraded|hard_fail)/i;
const MAIN_FRAME_WAIT_SLOW_MS = 3200;
const TRACE_BOOT_SESSION_EPOCH_MARGIN_MS = 8000;
const MAIN_FRAME_LAZY_TASK_NAMES = Object.freeze([
  'initializeAnalysis',
  'initializeCLSE',
  'warmupDashboardSurface',
  'warmupDashboardSurfaceDeferred',
]);
const MAIN_FRAME_TRACE_PATTERN = /^(main_tab:(first_frame|first_visual|ready_notify)|boot_manager:main_tab_first_frame|pond_(controller|mount|surface):|bonsai_worker:first_frame|home_scan:)/;

const isObject = (value) => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const asArray = (value) => (Array.isArray(value) ? value : []);

const getTelemetrySources = (telemetrySnapshot = null, telemetryReports = []) => (
  isObject(telemetrySnapshot)
    ? [telemetrySnapshot]
    : asArray(telemetryReports).map((report) => report?.snapshot || report).filter(isObject)
);

const resolveTelemetryStartEpochMs = (telemetrySnapshot = null, latestTelemetryReport = null) => (
  toNumberOrNull(telemetrySnapshot?.startedAtEpochMs)
  ?? toNumberOrNull(latestTelemetryReport?.snapshot?.startedAtEpochMs)
  ?? null
);

const filterTraceHistoryForTelemetrySession = (
  traceHistory = [],
  telemetrySnapshot = null,
  latestTelemetryReport = null,
) => {
  const events = asArray(traceHistory);
  const startedAtEpochMs = resolveTelemetryStartEpochMs(telemetrySnapshot, latestTelemetryReport);
  if (startedAtEpochMs == null) return events;
  return events.filter((entry) => {
    const at = toNumberOrNull(entry?.at);
    if (at == null) return false;
    return at >= startedAtEpochMs - TRACE_BOOT_SESSION_EPOCH_MARGIN_MS;
  });
};

const cloneJsonSafe = (value) => {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return String(value);
  }
};

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const compactEvent = (entry = null) => ({
  index: Number(entry?.index) || null,
  event: typeof entry?.event === 'string' ? entry.event : 'unknown',
  elapsedMs: toNumberOrNull(entry?.elapsedMs),
  at: toNumberOrNull(entry?.at),
  details: cloneJsonSafe(entry?.details || null),
});

const compactEventOrNull = (entry = null) => (entry ? compactEvent(entry) : null);

const compactMark = (mark = null) => ({
  type: typeof mark?.type === 'string' ? mark.type : 'unknown',
  atMs: toNumberOrNull(mark?.atMs),
  payload: cloneJsonSafe(mark?.payload || null),
});

const getReportSummary = (telemetrySnapshot = null, latestTelemetryReport = null) => {
  const source = isObject(telemetrySnapshot) ? telemetrySnapshot : latestTelemetryReport?.snapshot;
  return source?.summary || latestTelemetryReport?.summary || null;
};

const findLatestPrewarmMark = (telemetryReports = [], telemetrySnapshot = null) => {
  const sources = getTelemetrySources(telemetrySnapshot, telemetryReports);
  for (const source of sources) {
    const mark = [...asArray(source.marks)]
      .reverse()
      .find((entry) => entry?.type === 'prewarm:snapshot');
    if (mark) return compactMark(mark);
  }
  return null;
};

const getTelemetryTaskErrors = (telemetrySnapshot = null, telemetryReports = []) => {
  const taskErrors = [];
  const sources = getTelemetrySources(telemetrySnapshot, telemetryReports);
  sources.forEach((source) => {
    asArray(source.tasks).forEach((task) => {
      if (!task?.error && !task?.errorDetails) return;
      taskErrors.push({
        task: task.task || 'unknown',
        startAtMs: toNumberOrNull(task.startAtMs),
        endAtMs: toNumberOrNull(task.endAtMs),
        durationMs: toNumberOrNull(task.durationMs),
        error: task.error || task.errorDetails?.message || 'Unknown error',
        errorDetails: cloneJsonSafe(task.errorDetails || null),
        metadata: cloneJsonSafe(task.metadata || null),
      });
    });
  });
  return taskErrors;
};

const getTelemetryDiagnosticMarks = (telemetrySnapshot = null, telemetryReports = []) => {
  const marks = [];
  const sources = getTelemetrySources(telemetrySnapshot, telemetryReports);
  sources.forEach((source) => {
    asArray(source.marks).forEach((mark) => {
      if (!BOOT_ERROR_PATTERN.test(String(mark?.type || ''))) return;
      marks.push(compactMark(mark));
    });
  });
  return marks;
};

const getTraceErrorEvents = (traceHistory = []) => (
  asArray(traceHistory)
    .filter((entry) => (
      BOOT_ERROR_PATTERN.test(String(entry?.event || ''))
      || BOOT_ERROR_PATTERN.test(String(entry?.details?.reason || ''))
      || BOOT_ERROR_PATTERN.test(String(entry?.details?.code || ''))
      || BOOT_ERROR_PATTERN.test(String(entry?.details?.message || ''))
    ))
    .map(compactEvent)
);

const resolveDiagnosticMode = (traceHistory = []) => {
  const traceStart = asArray(traceHistory).find((entry) => entry?.event === 'trace:enabled');
  const source = typeof traceStart?.details?.source === 'string' ? traceStart.details.source : '';
  if (source === 'experiment_boot_lab_cold_visual_reload') return 'cold_visual_reload';
  if (source === 'experiment_boot_lab_reload') return 'reload_diagnostics';
  return null;
};

const getWorkerHardFailEvents = (traceHistory = [], diagnosticMarks = []) => {
  const fromTrace = asArray(traceHistory)
    .filter((entry) => (
      String(entry?.event || '').includes('hard_fail')
      || String(entry?.details?.message || '').includes('ZEN_POND_WORKER_HARD_FAIL')
      || String(entry?.details?.reason || '').includes('first_frame_fish_roster_mismatch')
    ))
    .map(compactEvent);
  const fromMarks = asArray(diagnosticMarks)
    .filter((mark) => (
      String(mark?.type || '').includes('worker')
      || String(mark?.payload?.message || '').includes('ZEN_POND_WORKER_HARD_FAIL')
      || String(mark?.payload?.metadata?.reason || '').includes('first_frame_fish_roster_mismatch')
    ));
  return [...fromTrace, ...fromMarks];
};

const collectStackSamples = (value, output = [], path = 'root', depth = 0) => {
  if (output.length >= 8 || depth > 5 || value == null) return output;
  if (typeof value === 'string') return output;
  if (!isObject(value) && !Array.isArray(value)) return output;
  if (typeof value.stack === 'string' && value.stack.trim()) {
    output.push({
      path,
      name: typeof value.name === 'string' ? value.name : null,
      message: typeof value.message === 'string' ? value.message : null,
      stack: value.stack,
    });
  }
  if (Array.isArray(value)) {
    value.slice(0, 24).forEach((entry, index) => {
      collectStackSamples(entry, output, `${path}[${index}]`, depth + 1);
    });
    return output;
  }
  Object.keys(value).slice(0, 24).forEach((key) => {
    collectStackSamples(value[key], output, `${path}.${key}`, depth + 1);
  });
  return output;
};

const getTiming = (telemetrySnapshot = null, latestTelemetryReport = null) => {
  const source = isObject(telemetrySnapshot) ? telemetrySnapshot : latestTelemetryReport?.snapshot;
  const timing = latestTelemetryReport?.timing || {};
  return {
    phases: asArray(source?.phases || timing.phases),
    tasks: asArray(source?.tasks || timing.tasks),
    loader: source?.loader || timing.loader || null,
    performance: source?.performance || timing.performance || null,
    paints: source?.performance?.paints || timing.paints || {},
    longTasks: source?.performance?.longTasks || timing.longTasks || null,
  };
};

const getPrewarmDiagnostics = (prewarm = null) => {
  const diagnostics = prewarm?.payload?.diagnostics;
  return isObject(diagnostics) ? cloneJsonSafe(diagnostics) : null;
};

const findPhase = (phases = [], phaseName) => (
  asArray(phases).find((phase) => phase?.phase === phaseName) || null
);

const getTimedEntryWindow = (entry = null) => {
  const startAtMs = toNumberOrNull(entry?.startAtMs);
  const rawEndAtMs = toNumberOrNull(entry?.endAtMs);
  const durationMs = toNumberOrNull(entry?.durationMs);
  const endAtMs = rawEndAtMs ?? (
    startAtMs != null && durationMs != null
      ? Number((startAtMs + durationMs).toFixed(2))
      : null
  );
  const inferredStartAtMs = startAtMs ?? (
    endAtMs != null && durationMs != null
      ? Number(Math.max(0, endAtMs - durationMs).toFixed(2))
      : null
  );
  return {
    startAtMs: inferredStartAtMs,
    endAtMs,
    durationMs,
  };
};

const buildCoreToMainFrameWindow = (phases = []) => {
  const corePhase = findPhase(phases, 'core_ready');
  const mainFramePhase = findPhase(phases, 'main_frame_ready');
  const coreWindow = getTimedEntryWindow(corePhase);
  const mainFrameWindow = getTimedEntryWindow(mainFramePhase);
  const startAtMs = coreWindow.startAtMs;
  const endAtMs = coreWindow.endAtMs ?? mainFrameWindow.startAtMs;
  const durationMs = coreWindow.durationMs ?? (
    startAtMs != null && endAtMs != null
      ? Number(Math.max(0, endAtMs - startAtMs).toFixed(2))
      : null
  );
  return {
    sourcePhase: corePhase?.phase || null,
    startAtMs,
    endAtMs,
    durationMs,
    mainFramePhaseStartAtMs: mainFrameWindow.startAtMs,
    mainFramePhaseDurationMs: mainFrameWindow.durationMs,
  };
};

const overlapsWindow = (window = null, entryWindow = null) => {
  if (!window || !entryWindow) return false;
  if (window.startAtMs == null || window.endAtMs == null) return false;
  if (entryWindow.startAtMs == null || entryWindow.endAtMs == null) return false;
  return entryWindow.startAtMs <= window.endAtMs && entryWindow.endAtMs >= window.startAtMs;
};

const compactTaskTiming = (task = null) => {
  const window = getTimedEntryWindow(task);
  return {
    task: task?.task || 'unknown',
    startAtMs: window.startAtMs,
    endAtMs: window.endAtMs,
    durationMs: window.durationMs,
    error: task?.error || null,
    metadata: cloneJsonSafe(task?.metadata || null),
  };
};

const compactLongTaskTiming = (entry = null) => {
  const startAtMs = toNumberOrNull(entry?.startAtMs);
  const durationMs = toNumberOrNull(entry?.durationMs);
  return {
    name: typeof entry?.name === 'string' ? entry.name : 'longtask',
    startAtMs,
    endAtMs: startAtMs != null && durationMs != null
      ? Number((startAtMs + durationMs).toFixed(2))
      : null,
    durationMs,
  };
};

const getEventElapsedMs = (entry = null) => toNumberOrNull(entry?.elapsedMs);

const latestTraceEvent = (traceEvents = [], predicate) => (
  [...asArray(traceEvents)].reverse().find(predicate) || null
);

const findBootManagerTraceEvent = (traceHistory = [], eventName, {
  sessionId = null,
} = {}) => (
  latestTraceEvent(asArray(traceHistory), (entry) => (
    entry?.event === eventName
    && (!sessionId || entry?.sessionId === sessionId)
  ))
);

const getBootTraceRelativeMs = (entry = null, bootStartEntry = null) => {
  const elapsedMs = getEventElapsedMs(entry);
  if (elapsedMs == null) return null;
  const bootStartElapsedMs = getEventElapsedMs(bootStartEntry);
  if (bootStartElapsedMs == null) return elapsedMs;
  return Number(Math.max(0, elapsedMs - bootStartElapsedMs).toFixed(2));
};

const isMainFrameTraceEvent = (entry = null) => {
  const event = String(entry?.event || '');
  if (MAIN_FRAME_TRACE_PATTERN.test(event)) return true;
  const milestone = String(entry?.details?.milestone || entry?.details?.metadata?.milestone || '');
  return milestone.includes('first_frame') || milestone.includes('first_visual');
};

const buildMainFrameTrace = (traceHistory = []) => {
  const mainFrameTraceEvents = asArray(traceHistory)
    .filter(isMainFrameTraceEvent);
  const partReadyEvents = mainFrameTraceEvents
    .filter((entry) => entry?.event === 'main_tab:first_frame_part_ready');
  return {
    keyEventCount: mainFrameTraceEvents.length,
    waitStart: compactEventOrNull(latestTraceEvent(
      mainFrameTraceEvents,
      (entry) => entry?.event === 'main_tab:first_frame_wait_start',
    )),
    readyNotify: compactEventOrNull(latestTraceEvent(
      mainFrameTraceEvents,
      (entry) => entry?.event === 'main_tab:ready_notify',
    )),
    bootReady: compactEventOrNull(latestTraceEvent(
      mainFrameTraceEvents,
      (entry) => entry?.event === 'boot_manager:main_tab_first_frame_ready',
    )),
    parts: {
      pond: compactEventOrNull(latestTraceEvent(
        partReadyEvents,
        (entry) => entry?.details?.part === 'pond',
      )),
      bonsai: compactEventOrNull(latestTraceEvent(
        partReadyEvents,
        (entry) => entry?.details?.part === 'bonsai',
      )),
    },
    recent: mainFrameTraceEvents.slice(-40).map(compactEvent),
  };
};

const buildPondAckDiagnostics = (mainFrameTrace = null) => {
  const metadata = mainFrameTrace?.parts?.pond?.details?.metadata;
  if (!isObject(metadata)) return null;
  const deltas = isObject(metadata.deltasMs) ? metadata.deltasMs : {};
  const waitGaps = isObject(metadata.waitGapsMs) ? metadata.waitGapsMs : {};
  const frameMetrics = isObject(metadata.frameMetrics) ? metadata.frameMetrics : {};
  const firstRenderEndToAckMs = toNumberOrNull(deltas.firstRenderTickEndToAck)
    ?? toNumberOrNull(waitGaps.firstRenderEndToAck);
  return {
    source: metadata.source || null,
    reason: metadata.reason || null,
    ackElapsedMs: toNumberOrNull(metadata.ackElapsedMs),
    firstFrameAckDeferredCount: toNumberOrNull(metadata.firstFrameAckDeferredCount),
    firstRenderEndToAckMs,
    renderMs: toNumberOrNull(frameMetrics.renderMs),
    worldRenderMs: toNumberOrNull(frameMetrics.worldRenderMs),
    stageRenderMs: toNumberOrNull(frameMetrics.stageRenderMs),
    frameMs: toNumberOrNull(frameMetrics.frameMs),
    runtimeLoopFrameCount: toNumberOrNull(metadata.runtimeLoopFrameCount),
    requiredRuntimeLoopFrameCount: toNumberOrNull(metadata.requiredRuntimeLoopFrameCount),
    surfaceEffectsEnabled: metadata.surfaceEffectsEnabled === true,
    waterLayerProbeReady: metadata.waterLayerProbeReady === true,
    essentialWaterAtmosphereReady: metadata.essentialWaterAtmosphereReady === true,
    fishCount: toNumberOrNull(metadata.fishCount),
    visibleFishCount: toNumberOrNull(metadata.visibleFishCount),
    requiredFirstFrameFishCount: toNumberOrNull(metadata.requiredFirstFrameFishCount),
  };
};

const resolveTraceAlignedMainFrameWindow = ({
  telemetryWindow,
  traceHistory,
} = {}) => {
  const mainFrameReadyEntry = findBootManagerTraceEvent(traceHistory, 'boot_manager:main_tab_first_frame_ready');
  const traceSessionId = typeof mainFrameReadyEntry?.sessionId === 'string' && mainFrameReadyEntry.sessionId
    ? mainFrameReadyEntry.sessionId
    : null;
  const bootStartEntry = findBootManagerTraceEvent(traceHistory, 'boot_manager:start_sequence', {
    sessionId: traceSessionId,
  });
  const coreReadyEntry = findBootManagerTraceEvent(traceHistory, 'boot_manager:core_ready', {
    sessionId: traceSessionId,
  });
  const traceMainFrameReadyAtMs = getBootTraceRelativeMs(mainFrameReadyEntry, bootStartEntry);
  if (traceMainFrameReadyAtMs == null) {
    return {
      waitWindow: telemetryWindow,
      traceTiming: null,
    };
  }

  const traceCoreReadyAtMs = getBootTraceRelativeMs(coreReadyEntry, bootStartEntry);
  const telemetryMainFrameStartAtMs = telemetryWindow?.mainFramePhaseStartAtMs;
  const telemetryEndAtMs = telemetryWindow?.endAtMs;
  const telemetryReadyAtMs = telemetryMainFrameStartAtMs ?? telemetryEndAtMs;
  const mismatchThresholdMs = 250;
  const traceIsEarlierThanTelemetry = (
    telemetryReadyAtMs != null
    && traceMainFrameReadyAtMs + mismatchThresholdMs < telemetryReadyAtMs
  );
  const telemetryMissingMainFrame = telemetryMainFrameStartAtMs == null;

  const traceTiming = {
    source: 'boot_manager_trace',
    bootStartElapsedMs: getEventElapsedMs(bootStartEntry),
    coreReadyAtMs: traceCoreReadyAtMs,
    mainFrameReadyAtMs: traceMainFrameReadyAtMs,
    telemetryMainFrameReadyAtMs: telemetryReadyAtMs,
    mismatch: traceIsEarlierThanTelemetry,
  };

  if (!traceIsEarlierThanTelemetry && !telemetryMissingMainFrame) {
    return {
      waitWindow: telemetryWindow,
      traceTiming,
    };
  }

  const startAtMs = telemetryWindow?.startAtMs ?? traceCoreReadyAtMs;
  const endAtMs = traceMainFrameReadyAtMs;
  const durationMs = startAtMs != null && endAtMs != null
    ? Number(Math.max(0, endAtMs - startAtMs).toFixed(2))
    : null;
  return {
    waitWindow: {
      ...telemetryWindow,
      sourcePhase: telemetryWindow?.sourcePhase || (traceCoreReadyAtMs != null ? 'core_ready' : null),
      startAtMs,
      endAtMs,
      durationMs,
      mainFramePhaseStartAtMs: traceMainFrameReadyAtMs,
      mainFramePhaseDurationMs: telemetryWindow?.mainFramePhaseDurationMs ?? null,
      source: 'boot_manager_trace',
    },
    traceTiming,
  };
};

const buildMainFrameSegment = ({
  timing,
  traceHistory,
} = {}) => {
  const phases = asArray(timing?.phases);
  const tasks = asArray(timing?.tasks);
  const telemetryWindow = buildCoreToMainFrameWindow(phases);
  const { waitWindow, traceTiming } = resolveTraceAlignedMainFrameWindow({
    telemetryWindow,
    traceHistory,
  });
  const lazyTasks = tasks
    .filter((task) => MAIN_FRAME_LAZY_TASK_NAMES.includes(task?.task))
    .map(compactTaskTiming);
  const tasksOverlappingWait = lazyTasks.filter((task) => overlapsWindow(waitWindow, task));
  const longTasksDuringWait = asArray(timing?.longTasks?.entries)
    .map(compactLongTaskTiming)
    .filter((entry) => overlapsWindow(waitWindow, entry));
  const trace = buildMainFrameTrace(traceHistory);

  return {
    waitWindow,
    thresholds: {
      slowMs: MAIN_FRAME_WAIT_SLOW_MS,
    },
    lazyTasks,
    tasksOverlappingWait,
    longTasksDuringWait,
    traceTiming,
    trace,
    pondAck: buildPondAckDiagnostics(trace),
  };
};

const buildRiskHints = ({
  bootSnapshot,
  timing,
  prewarm,
  errors,
  mainFrameSegment,
} = {}) => {
  const hints = [];
  if (bootSnapshot?.forcedVisualRelease === true) {
    hints.push({
      id: 'forced_visual_release',
      signal: bootSnapshot?.forcedVisualReleaseReason || 'forced',
      detail: {
        reason: bootSnapshot?.forcedVisualReleaseReason || null,
        status: bootSnapshot?.status || null,
        phase: bootSnapshot?.phase || null,
        degraded: bootSnapshot?.degraded === true,
        dismissible: bootSnapshot?.dismissible === true,
        themeReady: bootSnapshot?.themeReady === true,
        coreReady: bootSnapshot?.coreReady === true,
        mainTabFirstFrameReady: bootSnapshot?.mainTabFirstFrameReady === true,
        mainTabFirstFrameDegraded: bootSnapshot?.mainTabFirstFrameDegraded === true,
        mainTabFirstFrameWaitBudgetExceeded: bootSnapshot?.mainTabFirstFrameWaitBudgetExceeded === true,
      },
    });
  }
  const fetchPrewarmTask = asArray(timing?.tasks).find((task) => task?.task === 'fetchBootPrewarmSnapshot');
  if (fetchPrewarmTask?.error || Number(fetchPrewarmTask?.durationMs) > 900) {
    const detail = isObject(fetchPrewarmTask)
      ? {
        ...fetchPrewarmTask,
        diagnostics: getPrewarmDiagnostics(prewarm),
      }
      : null;
    hints.push({
      id: 'boot_prewarm_pressure',
      signal: fetchPrewarmTask?.error ? 'failed' : 'slow',
      detail,
    });
  }
  if (prewarm?.payload?.available === false) {
    hints.push({
      id: 'boot_prewarm_unavailable',
      signal: 'missing',
      detail: prewarm.payload,
    });
  }
  const coreTasks = asArray(timing?.tasks).filter((task) => (
    task?.task === 'initializePreference'
    || task?.task === 'initializeProtocol'
  ));
  const slowCoreTask = coreTasks.find((task) => Number(task?.durationMs) > 900);
  if (slowCoreTask) {
    hints.push({
      id: 'core_init_slow',
      signal: slowCoreTask.task,
      detail: slowCoreTask,
    });
  }
  if (bootSnapshot?.mainTabFirstFrameDegraded === true || bootSnapshot?.mainTabFirstFrameWaitBudgetExceeded === true) {
    hints.push({
      id: 'main_first_frame_degraded',
      signal: 'visual',
      detail: {
        mainTabFirstFrameDegraded: bootSnapshot.mainTabFirstFrameDegraded,
        mainTabFirstFrameWaitBudgetExceeded: bootSnapshot.mainTabFirstFrameWaitBudgetExceeded,
      },
    });
  }
  if (mainFrameSegment?.traceTiming?.mismatch === true) {
    hints.push({
      id: 'boot_diagnostics_timeline_mismatch',
      signal: 'diagnostic',
      detail: {
        traceTiming: mainFrameSegment.traceTiming,
        waitWindow: mainFrameSegment.waitWindow,
      },
    });
  }
  const traceBootReady = mainFrameSegment?.trace?.bootReady;
  const bootReadyTraceDegraded = traceBootReady?.details?.degraded === true;
  if (
    bootSnapshot?.mainTabFirstFrameDegraded === true
    && traceBootReady
    && bootReadyTraceDegraded === false
  ) {
    hints.push({
      id: 'boot_state_trace_mismatch',
      signal: 'diagnostic',
      detail: {
        mainTabFirstFrameDegraded: bootSnapshot.mainTabFirstFrameDegraded,
        bootReadyTrace: traceBootReady,
      },
    });
  }
  if (Number(mainFrameSegment?.waitWindow?.durationMs) > MAIN_FRAME_WAIT_SLOW_MS) {
    hints.push({
      id: 'main_frame_wait_slow',
      signal: 'slow',
      detail: {
        waitWindow: mainFrameSegment.waitWindow,
        lazyTasks: asArray(mainFrameSegment.tasksOverlappingWait).length
          ? mainFrameSegment.tasksOverlappingWait
          : mainFrameSegment.lazyTasks,
        longTasksDuringWait: mainFrameSegment.longTasksDuringWait,
        trace: {
          keyEventCount: mainFrameSegment.trace?.keyEventCount || 0,
          parts: mainFrameSegment.trace?.parts || null,
          readyNotify: mainFrameSegment.trace?.readyNotify || null,
          bootReady: mainFrameSegment.trace?.bootReady || null,
        },
        pondAck: mainFrameSegment.pondAck || null,
      },
    });
  }
  if (asArray(errors?.workerHardFails).length > 0) {
    hints.push({
      id: 'pond_worker_hard_fail',
      signal: 'worker',
      detail: errors.workerHardFails[0],
    });
  }
  return hints;
};

export const buildDashboardBootDiagnosticsReport = ({
  bootSnapshot = null,
  bootTelemetrySnapshot = null,
  bootTelemetryReports = [],
  zenTraceHistory = [],
  capturedAtEpochMs = Date.now(),
} = {}) => {
  const reports = asArray(bootTelemetryReports).filter(isObject);
  const latestTelemetryReport = reports[0] || null;
  const sessionTraceHistory = filterTraceHistoryForTelemetrySession(
    zenTraceHistory,
    bootTelemetrySnapshot,
    latestTelemetryReport,
  );
  const summary = getReportSummary(bootTelemetrySnapshot, latestTelemetryReport);
  const timing = getTiming(bootTelemetrySnapshot, latestTelemetryReport);
  const mainFrameSegment = buildMainFrameSegment({
    timing,
    traceHistory: sessionTraceHistory,
  });
  const diagnosticMarks = getTelemetryDiagnosticMarks(bootTelemetrySnapshot, reports);
  const taskErrors = getTelemetryTaskErrors(bootTelemetrySnapshot, reports);
  const traceErrors = getTraceErrorEvents(sessionTraceHistory);
  const workerHardFails = getWorkerHardFailEvents(sessionTraceHistory, diagnosticMarks);
  const errors = {
    bootErrors: asArray(bootSnapshot?.errors),
    taskErrors,
    diagnosticMarks,
    traceErrors,
    workerHardFails,
    stackSamples: collectStackSamples({
      bootSnapshot,
      taskErrors,
      diagnosticMarks,
      traceErrors,
    }),
  };
  const prewarm = findLatestPrewarmMark(reports, bootTelemetrySnapshot);
  const trace = {
    enabledEventCount: asArray(sessionTraceHistory).length,
    storedEventCount: asArray(zenTraceHistory).length,
    filteredStaleEventCount: Math.max(
      0,
      asArray(zenTraceHistory).length - asArray(sessionTraceHistory).length,
    ),
    recent: asArray(sessionTraceHistory).slice(-80).map(compactEvent),
    errors: traceErrors,
  };
  const diagnosticMode = resolveDiagnosticMode(sessionTraceHistory);

  const state = {
    bootSnapshot: cloneJsonSafe(bootSnapshot || null),
    telemetryStatus: bootTelemetrySnapshot?.status || latestTelemetryReport?.status || null,
    telemetrySessionId: bootTelemetrySnapshot?.id || latestTelemetryReport?.sessionId || null,
    storedReportCount: reports.length,
    prewarm,
  };
  const report = {
    kind: BOOT_DIAGNOSTICS_REPORT_KIND,
    capturedAtEpochMs,
    capturedAt: new Date(capturedAtEpochMs).toISOString(),
    summary: {
      status: bootSnapshot?.status || summary?.status || 'unknown',
      phase: bootSnapshot?.phase || null,
      degraded: bootSnapshot?.degraded === true,
      dismissible: bootSnapshot?.dismissible === true,
      themeReady: bootSnapshot?.themeReady === true,
      coreReady: bootSnapshot?.coreReady === true,
      mainTabFirstFrameReady: bootSnapshot?.mainTabFirstFrameReady === true,
      mainTabFirstFrameDegraded: bootSnapshot?.mainTabFirstFrameDegraded === true,
      forcedVisualRelease: bootSnapshot?.forcedVisualRelease === true,
      forcedVisualReleaseReason: bootSnapshot?.forcedVisualReleaseReason || null,
      diagnosticMode,
      totalDurationMs: summary?.totalDurationMs ?? null,
      loaderVisibleForMs: summary?.loaderVisibleForMs ?? null,
      mainFrameWaitMs: mainFrameSegment.waitWindow?.durationMs ?? null,
      longTaskCount: summary?.longTaskCount ?? 0,
      errorCount: asArray(errors.bootErrors).length
        + asArray(errors.taskErrors).length
        + asArray(errors.traceErrors).length,
      traceEventCount: trace.enabledEventCount,
      storedReportCount: reports.length,
    },
    risks: [],
    segments: {
      mainFrame: mainFrameSegment,
    },
    timing,
    errors,
    state,
    trace,
    raw: {
      bootTelemetrySnapshot: cloneJsonSafe(bootTelemetrySnapshot || null),
      bootTelemetryReports: cloneJsonSafe(reports),
    },
  };
  report.risks = buildRiskHints({
    bootSnapshot,
    timing,
    prewarm,
    errors,
    mainFrameSegment,
  });
  return report;
};

export const getBootDiagnosticsSectionPayload = (report, sectionId = BOOT_DIAGNOSTICS_SECTION_IDS.FULL) => {
  if (!report || typeof report !== 'object') return null;
  switch (sectionId) {
    case BOOT_DIAGNOSTICS_SECTION_IDS.SUMMARY:
      return {
        kind: `${BOOT_DIAGNOSTICS_REPORT_KIND}.summary`,
        capturedAt: report.capturedAt,
        summary: report.summary,
        risks: report.risks,
      };
    case BOOT_DIAGNOSTICS_SECTION_IDS.TIMING:
      return {
        kind: `${BOOT_DIAGNOSTICS_REPORT_KIND}.timing`,
        capturedAt: report.capturedAt,
        timing: report.timing,
        prewarm: report.state?.prewarm || null,
        mainFrame: report.segments?.mainFrame || null,
      };
    case BOOT_DIAGNOSTICS_SECTION_IDS.MAIN_FRAME:
      return {
        kind: `${BOOT_DIAGNOSTICS_REPORT_KIND}.main_frame`,
        capturedAt: report.capturedAt,
        summary: report.summary,
        mainFrame: report.segments?.mainFrame || null,
        risks: asArray(report.risks).filter((risk) => (
          risk?.id === 'main_frame_wait_slow'
          || risk?.id === 'main_first_frame_degraded'
          || risk?.id === 'forced_visual_release'
          || risk?.id === 'pond_worker_hard_fail'
        )),
      };
    case BOOT_DIAGNOSTICS_SECTION_IDS.ERRORS:
      return {
        kind: `${BOOT_DIAGNOSTICS_REPORT_KIND}.errors`,
        capturedAt: report.capturedAt,
        errors: report.errors,
        risks: report.risks,
      };
    case BOOT_DIAGNOSTICS_SECTION_IDS.STATE:
      return {
        kind: `${BOOT_DIAGNOSTICS_REPORT_KIND}.state`,
        capturedAt: report.capturedAt,
        state: report.state,
        summary: report.summary,
      };
    case BOOT_DIAGNOSTICS_SECTION_IDS.TRACE:
      return {
        kind: `${BOOT_DIAGNOSTICS_REPORT_KIND}.trace`,
        capturedAt: report.capturedAt,
        trace: report.trace,
      };
    case BOOT_DIAGNOSTICS_SECTION_IDS.FULL:
    default:
      return report;
  }
};

export const serializeBootDiagnosticsSection = (report, sectionId = BOOT_DIAGNOSTICS_SECTION_IDS.FULL) => {
  const payload = getBootDiagnosticsSectionPayload(report, sectionId);
  return payload ? JSON.stringify(payload, null, 2) : '';
};
