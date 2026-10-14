import { projectDashboardCpuProfileEvidenceRejection } from './dashboardBootCpuProfileEvidence.mjs';

const MAX_RUNTIME_EXCEPTIONS = 30;
const MAX_CONSOLE_MESSAGES = 40;
const MAX_LOG_ENTRIES = 40;
const MAX_NETWORK_FAILURES = 40;
const MAX_RESOURCE_LOADS = 120;
const MAX_TRACKED_REQUESTS = 800;
const MAX_DIAGNOSTIC_TEXT_LENGTH = 8_000;
const MAX_CPU_PROFILE_ENTRIES = 30;
const MAX_MODEL_CPU_PROFILE_SEGMENTS = 64;
const MODEL_PROFILE_READY_BINDING = '__ENTROPY_QA_ZEN_MODEL_PROFILE_READY__';
const MODEL_PROFILE_ACK_BINDING = '__ENTROPY_QA_ZEN_MODEL_PROFILE_ACK__';
const NATIVE_VISIBILITY_PROBE_KEY = '__ENTROPY_QA_DASHBOARD_NATIVE_VISIBILITY__';

// The observer records native document state only during initial preparation.
// One sticky loss also preserves hidden -> visible changes during navigation.
function installNativeVisibilityProbe(key) {
  if (globalThis !== globalThis.top) return;
  if (Object.hasOwn(globalThis, key)) throw new Error('QA_DASHBOARD_NATIVE_VISIBILITY_PROBE_EXISTS');
  let transitionCount = 0, firstHidden = null;
  const read = () => ({
    visibilityState: document.visibilityState, hidden: document.hidden,
    atMs: performance.now(), timeOrigin: performance.timeOrigin,
  });
  const record = () => {
    transitionCount += 1;
    const state = read();
    if (state.hidden || state.visibilityState !== 'visible') firstHidden ||= state;
  };
  const probe = {
    snapshot: () => ({ ...read(), transitionCount, firstHidden }),
    dispose() {
      document.removeEventListener('visibilitychange', record);
      if (globalThis[key] !== probe) throw new Error('QA_DASHBOARD_NATIVE_VISIBILITY_PROBE_OWNERSHIP_LOST');
      delete globalThis[key];
    },
  };
  globalThis[key] = probe;
  document.addEventListener('visibilitychange', record);
  record();
}
const ZEN_HOME_RENDERER_WORKER_URL_PATTERN = /\/assets\/zenHomeRenderer\.worker-[^/]+\.js$/u;
const ZEN_BONSAI_MODEL_WORKER_URL_PATTERN = /\/assets\/zenBonsaiModel\.worker-[^/]+\.js$/u;
const PERFORMANCE_METRIC_NAMES = Object.freeze([
  'Timestamp',
  'Documents',
  'Frames',
  'JSEventListeners',
  'Nodes',
  'LayoutCount',
  'RecalcStyleCount',
  'LayoutDuration',
  'RecalcStyleDuration',
  'ScriptDuration',
  'V8CompileDuration',
  'TaskDuration',
  'JSHeapUsedSize',
  'JSHeapTotalSize',
]);
const PERFORMANCE_METRIC_NAME_SET = new Set(PERFORMANCE_METRIC_NAMES);

const FAILING_BOOT_WARNING_PATTERNS = Object.freeze([
  /dashboard_boot_renderer_timeout/iu,
  /boot_shell:hard_timeout_fail_open/iu,
  /boot_shell_hard_timeout/iu,
]);

const toBoundedText = (value) => String(value || '').slice(
  0,
  MAX_DIAGNOSTIC_TEXT_LENGTH,
);

const sanitizeDiagnosticUrl = (value) => {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`.slice(
      0,
      MAX_DIAGNOSTIC_TEXT_LENGTH,
    );
  } catch (_) {
    return toBoundedText(value.split(/[?#]/u, 1)[0]);
  }
};

const normalizeRuntimeException = (event) => {
  const details = event?.params?.exceptionDetails || {};
  return Object.freeze({
    text: toBoundedText(details.text),
    url: sanitizeDiagnosticUrl(details.url),
    lineNumber: Number.isInteger(details.lineNumber) ? details.lineNumber : null,
    columnNumber: Number.isInteger(details.columnNumber) ? details.columnNumber : null,
    exception: toBoundedText(details.exception?.description),
  });
};

async function serializeConsoleArgument(cdp, sessionId, entry) {
  if (Object.prototype.hasOwnProperty.call(entry || {}, 'value')) {
    return entry.value;
  }
  if (typeof entry?.objectId !== 'string') {
    return entry?.description || entry?.type || '';
  }
  const serialized = await cdp.send('Runtime.callFunctionOn', {
    objectId: entry.objectId,
    functionDeclaration: `function () {
      if (this instanceof Error) {
        return JSON.stringify({
          name: this.name,
          message: this.message,
          stack: this.stack,
          code: this.code || null,
          details: this.details || null,
        });
      }
      try { return JSON.stringify(this); } catch (_) { return String(this); }
    }`,
    returnByValue: true,
    silent: true,
  }, sessionId, { timeoutMs: 5_000 });
  return serialized?.result?.value || entry.description || entry.type || '';
}

async function normalizeConsoleMessage(cdp, sessionId, event, sequence) {
  const params = event?.params || {};
  const values = await Promise.all((params.args || []).map((entry) => (
    serializeConsoleArgument(cdp, sessionId, entry)
  )));
  return Object.freeze({
    sequence,
    type: params.type || '',
    text: toBoundedText(values.map((value) => (
      typeof value === 'string' ? value : JSON.stringify(value)
    )).join(' ')),
    timestamp: Number.isFinite(Number(params.timestamp))
      ? Number(params.timestamp)
      : null,
  });
}

const normalizeLogEntry = (event) => {
  const entry = event?.params?.entry || {};
  return Object.freeze({
    source: entry.source || '',
    level: entry.level || '',
    text: toBoundedText(entry.text),
    url: sanitizeDiagnosticUrl(entry.url),
    lineNumber: Number.isInteger(entry.lineNumber) ? entry.lineNumber : null,
    timestamp: Number.isFinite(Number(entry.timestamp))
      ? Number(entry.timestamp)
      : null,
  });
};

const freezeIssue = (code, details = null) => Object.freeze({
  code,
  details: details && typeof details === 'object'
    ? Object.freeze({ ...details })
    : null,
});

function summarizeCpuProfile(profile) {
  const nodes = Array.isArray(profile?.nodes) ? profile.nodes : [];
  const samples = Array.isArray(profile?.samples) ? profile.samples : [];
  const timeDeltas = Array.isArray(profile?.timeDeltas) ? profile.timeDeltas : [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const aggregates = new Map();
  let sampledTimeMicroseconds = 0;

  samples.forEach((nodeId, index) => {
    const delta = Number(timeDeltas[index]);
    if (!Number.isFinite(delta) || delta < 0) return;
    sampledTimeMicroseconds += delta;
    const node = nodeMap.get(nodeId);
    const frame = node?.callFrame || {};
    const url = sanitizeDiagnosticUrl(frame.url);
    const functionName = toBoundedText(frame.functionName || '(anonymous)');
    const lineNumber = Number.isInteger(frame.lineNumber) ? frame.lineNumber : null;
    const columnNumber = Number.isInteger(frame.columnNumber) ? frame.columnNumber : null;
    const key = `${functionName}\n${url}\n${lineNumber}\n${columnNumber}`;
    const current = aggregates.get(key) || {
      functionName,
      url,
      lineNumber,
      columnNumber,
      selfTimeMicroseconds: 0,
      sampleCount: 0,
    };
    current.selfTimeMicroseconds += delta;
    current.sampleCount += 1;
    aggregates.set(key, current);
  });

  const topSelfTime = [...aggregates.values()]
    .sort((left, right) => (
      right.selfTimeMicroseconds - left.selfTimeMicroseconds
      || right.sampleCount - left.sampleCount
    ))
    .slice(0, MAX_CPU_PROFILE_ENTRIES)
    .map((entry) => Object.freeze({
      functionName: entry.functionName,
      url: entry.url,
      lineNumber: entry.lineNumber,
      columnNumber: entry.columnNumber,
      selfTimeMs: Number((entry.selfTimeMicroseconds / 1_000).toFixed(3)),
      sampleCount: entry.sampleCount,
    }));

  return Object.freeze({
    startTime: Number.isFinite(Number(profile?.startTime)) ? Number(profile.startTime) : null,
    endTime: Number.isFinite(Number(profile?.endTime)) ? Number(profile.endTime) : null,
    sampledTimeMs: Number((sampledTimeMicroseconds / 1_000).toFixed(3)),
    sampleCount: samples.length,
    topSelfTime: Object.freeze(topSelfTime),
  });
}

const buildWorkerCpuProfileSnapshot = (entry) => Object.freeze({
  kind: entry.kind,
  targetId: entry.targetId,
  type: entry.type,
  url: entry.url,
  runtimeName: entry.runtimeName,
  attachedAtEpochMs: entry.attachedAtEpochMs,
  detachedAtEpochMs: entry.detachedAtEpochMs,
  terminatedBeforeProfileStop: entry.terminatedBeforeProfileStop,
  started: entry.started,
  stopped: entry.stopped,
  startReceipt: entry.startReceipt ? Object.freeze({ ...entry.startReceipt }) : null,
  trailingProfileLost: entry.trailingProfileLost,
  profileSegments: Object.freeze([...entry.profileSegments]),
  profile: entry.profile,
  ...(entry.profileEvidence ? { profileEvidence: entry.profileEvidence } : {}),
  ...(entry.profileEvidenceRejection ? { profileEvidenceRejection: entry.profileEvidenceRejection } : {}),
  error: entry.error,
});

export function createDashboardPageDiagnostics({
  cdp,
  sessionId,
  nowEpochMs = () => Date.now(),
  cpuProfile = false,
  writeCpuProfileEvidence = null,
} = {}) {
  if (!cdp || typeof cdp.send !== 'function' || typeof cdp.subscribe !== 'function') {
    throw new Error('QA_DASHBOARD_CAPTURE_DIAGNOSTIC_CDP_REQUIRED');
  }
  if (typeof sessionId !== 'string' || !sessionId || sessionId !== sessionId.trim()) {
    throw new Error('QA_DASHBOARD_CAPTURE_DIAGNOSTIC_SESSION_REQUIRED');
  }
  if (typeof nowEpochMs !== 'function') {
    throw new Error('QA_DASHBOARD_CAPTURE_DIAGNOSTIC_CLOCK_REQUIRED');
  }
  if (writeCpuProfileEvidence !== null && typeof writeCpuProfileEvidence !== 'function') {
    throw new Error('QA_DASHBOARD_CPU_PROFILE_WRITER_INVALID');
  }

  const runtimeExceptions = [];
  const consoleMessages = [];
  const consoleMessageTasks = [];
  const logEntries = [];
  const networkFailures = [];
  const resourceLoads = [];
  const requests = new Map();
  const performanceCheckpoints = [];
  const performanceCheckpointLabels = new Set();
  const unsubscribe = [];
  let disposed = false;
  let cpuProfileStarted = false;
  let cpuProfileSummary = null;
  let cpuProfileEvidence = null;
  let cpuProfileStartReceipt = null;
  let cpuProfileError = null;
  let workerAutoAttachEnabled = false;
  const workerCpuProfiles = [];
  const workerCpuProfileEntries = new Map();
  const workerCpuProfileTasks = [];
  const autoAttachedWorkerSessions = new Set();
  let consoleSequence = 0;
  let nativePreparationAttempted = false, nativePreparationArmed = false;
  let nativeVisibilityScriptId = null, nativePreparation = null;
  const snapshotNativePreparation = () => nativePreparation
    ? Object.freeze({ ...nativePreparation }) : null;
  const failNativePreparation = (code, stage) => {
    nativePreparation = { ...nativePreparation, status: 'failed', failure: { code, stage } };
    const error = new Error(code);
    error.code = code;
    error.diagnostic = snapshotNativePreparation();
    throw error;
  };
  const readNativeState = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: false,
    }, sessionId, { timeoutMs: 5_000 });
    if (result.exceptionDetails) {
      const error = new Error('QA_DASHBOARD_NATIVE_VISIBILITY_OBSERVATION_FAILED', {
        cause: new Error(toBoundedText(result.exceptionDetails.exception?.description || result.exceptionDetails.text)),
      });
      error.code = 'QA_DASHBOARD_NATIVE_VISIBILITY_OBSERVATION_FAILED';
      throw error;
    }
    return result.result?.value;
  };
  const timeline = {
    sessionReadyAtEpochMs: nowEpochMs(),
    navigationRequestedAtEpochMs: null,
    domContentObservedAtEpochMs: null,
    loadObservedAtEpochMs: null,
    captureReadyAtEpochMs: null,
    captureFinishedAtEpochMs: null,
  };

  const isOwnedSessionEvent = (event) => event?.sessionId === sessionId;
  const listen = (method, listener) => {
    unsubscribe.push(cdp.subscribe(method, listener));
  };

  const resumeAttachedWorker = async (workerSessionId) => {
    await cdp.send(
      'Runtime.runIfWaitingForDebugger',
      {},
      workerSessionId,
      { timeoutMs: 5_000 },
    );
  };

  listen('Target.attachedToTarget', (event) => {
    if (!cpuProfile || event?.sessionId !== sessionId) return;
    const params = event?.params || {};
    const targetInfo = params.targetInfo || {};
    const workerSessionId = params.sessionId;
    if (
      targetInfo.type !== 'worker'
      || typeof workerSessionId !== 'string'
      || !workerSessionId
    ) {
      return;
    }
    autoAttachedWorkerSessions.add(workerSessionId);
    const sanitizedUrl = sanitizeDiagnosticUrl(targetInfo.url);
    const kind = ZEN_HOME_RENDERER_WORKER_URL_PATTERN.test(sanitizedUrl) ? 'home_worker'
      : ZEN_BONSAI_MODEL_WORKER_URL_PATTERN.test(sanitizedUrl) ? 'model_worker' : null;
    const entry = kind
      ? {
        kind,
        targetId: typeof targetInfo.targetId === 'string' ? targetInfo.targetId : '',
        type: targetInfo.type,
        url: sanitizedUrl,
        sessionId: workerSessionId,
        runtimeName: null,
        attachedAtEpochMs: nowEpochMs(),
        detachedAtEpochMs: null,
        terminatedBeforeProfileStop: false,
        trailingProfileLost: false,
        profileSegments: [],
        completedRequestIds: new Set(),
        started: false,
        stopped: false,
        profile: null,
        profileEvidence: null,
        profileEvidenceRejection: null,
        startReceipt: null,
        error: null,
      }
      : null;
    if (entry) {
      workerCpuProfileEntries.set(workerSessionId, entry);
    }
    const task = (async () => {
      try {
        if (entry) {
          if (entry.kind === 'model_worker') {
            await cdp.send('Runtime.enable', {}, workerSessionId, { timeoutMs: 5_000 });
            await cdp.send('Runtime.addBinding', {
              name: MODEL_PROFILE_READY_BINDING,
            }, workerSessionId, { timeoutMs: 5_000 });
          }
          await cdp.send('Profiler.enable', {}, workerSessionId, { timeoutMs: 5_000 });
          entry.startReceipt = { requestedAtEpochMs: nowEpochMs() };
          await cdp.send('Profiler.start', {}, workerSessionId, { timeoutMs: 5_000 });
          entry.startReceipt.confirmedAtEpochMs = nowEpochMs();
          entry.started = true;
          if (entry.kind === 'model_worker') {
            // Read only the native worker identity in this exact attached realm.
            // Profiling already runs; finally always releases debugger startup.
            const identity = await cdp.send('Runtime.evaluate', {
              expression: 'self.name', returnByValue: true, silent: true,
            }, workerSessionId, { timeoutMs: 5_000 });
            if (identity.exceptionDetails || typeof identity.result?.value !== 'string'
              || !identity.result.value || identity.result.value.length > MAX_DIAGNOSTIC_TEXT_LENGTH) {
              throw new Error('QA_DASHBOARD_MODEL_WORKER_IDENTITY_MISSING');
            }
            entry.runtimeName = identity.result.value;
          }
        }
      } catch (error) {
        if (entry) entry.error = toBoundedText(error?.message || error);
      } finally {
        try {
          await resumeAttachedWorker(workerSessionId);
        } catch (error) {
          if (entry && !entry.error) {
            entry.error = toBoundedText(error?.message || error);
          }
        }
      }
    })();
    workerCpuProfileTasks.push(task);
  });

  const stopWorkerProfile = async (entry, completionReceipt = null) => {
    entry.stopped = true;
    const segment = { capturePhase: completionReceipt ? 'before_result' : 'terminal',
      completionReceipt, startReceipt: Object.freeze({ ...entry.startReceipt }),
      stopReceipt: { requestedAtEpochMs: nowEpochMs() }, profile: null,
      profileEvidence: null, profileEvidenceRejection: null, error: null };
    try {
      const response = await cdp.send('Profiler.stop', {}, entry.sessionId, { timeoutMs: 10_000 });
      segment.stopReceipt.confirmedAtEpochMs = nowEpochMs();
      segment.profile = summarizeCpuProfile(response?.profile);
      if (writeCpuProfileEvidence) segment.profileEvidence = await writeCpuProfileEvidence({
        kind: entry.kind, profile: response.profile, startReceipt: entry.startReceipt,
      });
      entry.profile = segment.profile;
      entry.profileEvidence = segment.profileEvidence;
    } catch (error) {
      segment.error = toBoundedText(error?.message || error);
      segment.profileEvidenceRejection = projectDashboardCpuProfileEvidenceRejection(error);
      entry.error = segment.error;
      entry.profileEvidenceRejection = segment.profileEvidenceRejection;
    }
    segment.stopReceipt = Object.freeze(segment.stopReceipt);
    entry.profileSegments.push(Object.freeze(segment));
    return segment;
  };

  listen('Runtime.bindingCalled', (event) => {
    if (!cpuProfile || event?.params?.name !== MODEL_PROFILE_READY_BINDING) return;
    const entry = workerCpuProfileEntries.get(event.sessionId);
    if (!entry || entry.kind !== 'model_worker') return;
    const task = (async () => {
      let receipt;
      try {
        if (typeof event.params.payload !== 'string' || event.params.payload.length > MAX_DIAGNOSTIC_TEXT_LENGTH) {
          throw new Error('QA_DASHBOARD_MODEL_PROFILE_RECEIPT_INVALID');
        }
        const value = JSON.parse(event.params.payload);
        if (value.runtimeName !== entry.runtimeName || !Number.isInteger(value.requestId) || value.requestId < 1
          || !['PREPARE_PLUME_STUDY', 'PROJECT_PLUME_TOPOLOGY'].includes(value.requestType)
          || typeof value.operationId !== 'string' || !value.operationId || value.operationId.length > 200
          || value.phase !== 'before_result' || !Number.isFinite(value.atMs) || value.atMs < 0
          || !Number.isFinite(value.timeOriginMs) || value.timeOriginMs <= 0
          || entry.completedRequestIds.has(value.requestId) || entry.profileSegments.length >= MAX_MODEL_CPU_PROFILE_SEGMENTS) {
          throw new Error('QA_DASHBOARD_MODEL_PROFILE_RECEIPT_INVALID');
        }
        receipt = Object.freeze({ runtimeName: value.runtimeName, requestId: value.requestId,
          requestType: value.requestType, operationId: value.operationId, phase: value.phase,
          atMs: value.atMs, timeOriginMs: value.timeOriginMs });
        entry.completedRequestIds.add(receipt.requestId);
        if (!entry.started || entry.stopped) throw new Error('QA_DASHBOARD_MODEL_PROFILE_NOT_RUNNING');
        await stopWorkerProfile(entry, receipt);
        // Each operation owns one complete segment. A final idle tail may end
        // with the canonical zero-delay worker release after RESULT.
        if (cpuProfileStarted) {
          entry.startReceipt = { requestedAtEpochMs: nowEpochMs() };
          await cdp.send('Profiler.start', {}, entry.sessionId, { timeoutMs: 5_000 });
          entry.startReceipt.confirmedAtEpochMs = nowEpochMs();
          entry.stopped = false;
        }
      } catch (error) {
        entry.error = toBoundedText(error?.message || error);
      } finally {
        if (receipt) {
          try {
            const ack = await cdp.send('Runtime.evaluate', {
              expression: `globalThis[${JSON.stringify(MODEL_PROFILE_ACK_BINDING)}](${receipt.requestId})`,
              returnByValue: true, silent: true,
            }, entry.sessionId, { timeoutMs: 5_000 });
            if (ack.exceptionDetails || ack.result?.value !== receipt.requestId) {
              throw new Error('QA_DASHBOARD_MODEL_PROFILE_ACK_FAILED');
            }
          } catch (error) { entry.error = toBoundedText(error?.message || error); }
        }
      }
    })();
    workerCpuProfileTasks.push(task);
  });

  listen('Target.detachedFromTarget', (event) => {
    if (!cpuProfile || event?.sessionId !== sessionId) return;
    const entry = workerCpuProfileEntries.get(event?.params?.sessionId);
    if (!entry) return;
    entry.detachedAtEpochMs = nowEpochMs();
    if (!entry.stopped) {
      if (entry.kind === 'model_worker' && entry.profileSegments.some(segment => segment.completionReceipt)) {
        entry.trailingProfileLost = true;
      } else {
        entry.terminatedBeforeProfileStop = true;
        if (!entry.error) entry.error = 'QA_DASHBOARD_WORKER_TERMINATED_BEFORE_PROFILE_STOP';
      }
    }
  });

  listen('Runtime.exceptionThrown', (event) => {
    if (isOwnedSessionEvent(event) && runtimeExceptions.length < MAX_RUNTIME_EXCEPTIONS) {
      runtimeExceptions.push(normalizeRuntimeException(event));
    }
  });
  listen('Runtime.consoleAPICalled', (event) => {
    if (
      !isOwnedSessionEvent(event)
      || !['error', 'warning'].includes(event.params?.type)
      || consoleMessageTasks.length >= MAX_CONSOLE_MESSAGES
    ) {
      return;
    }
    consoleSequence += 1;
    const sequence = consoleSequence;
    consoleMessageTasks.push(
      normalizeConsoleMessage(cdp, sessionId, event, sequence).then(
        (normalized) => consoleMessages.push(normalized),
        (error) => consoleMessages.push(Object.freeze({
          sequence,
          type: 'diagnostic_serialization_error',
          text: toBoundedText(error?.message || error),
          timestamp: null,
        })),
      ),
    );
  });
  listen('Log.entryAdded', (event) => {
    if (
      isOwnedSessionEvent(event)
      && ['error', 'warning'].includes(event.params?.entry?.level)
      && logEntries.length < MAX_LOG_ENTRIES
    ) {
      logEntries.push(normalizeLogEntry(event));
    }
  });
  listen('Network.requestWillBeSent', (event) => {
    if (!isOwnedSessionEvent(event) || typeof event.params?.requestId !== 'string') return;
    if (requests.size >= MAX_TRACKED_REQUESTS) {
      requests.delete(requests.keys().next().value);
    }
    requests.set(event.params.requestId, {
      url: sanitizeDiagnosticUrl(event.params?.request?.url),
      resourceType: event.params?.type || '',
      startedAt: Number.isFinite(Number(event.params?.timestamp))
        ? Number(event.params.timestamp)
        : null,
      responseAt: null,
      status: null,
      mimeType: '',
      fromDiskCache: false,
      fromServiceWorker: false,
    });
  });
  listen('Network.responseReceived', (event) => {
    if (!isOwnedSessionEvent(event) || typeof event.params?.requestId !== 'string') return;
    const request = requests.get(event.params.requestId);
    if (!request) return;
    const response = event.params?.response || {};
    request.responseAt = Number.isFinite(Number(event.params?.timestamp))
      ? Number(event.params.timestamp)
      : null;
    request.status = Number.isFinite(Number(response.status)) ? Number(response.status) : null;
    request.mimeType = response.mimeType || '';
    request.fromDiskCache = response.fromDiskCache === true;
    request.fromServiceWorker = response.fromServiceWorker === true;
  });
  listen('Network.loadingFinished', (event) => {
    if (!isOwnedSessionEvent(event) || typeof event.params?.requestId !== 'string') return;
    const request = requests.get(event.params.requestId);
    if (request && resourceLoads.length < MAX_RESOURCE_LOADS) {
      const finishedAt = Number.isFinite(Number(event.params?.timestamp))
        ? Number(event.params.timestamp)
        : null;
      const timingOrderValid = Number.isFinite(request.startedAt)
        && Number.isFinite(request.responseAt)
        && Number.isFinite(finishedAt)
        && request.startedAt <= request.responseAt
        && request.responseAt <= finishedAt;
      const durationOrderValid = Number.isFinite(request.startedAt)
        && Number.isFinite(finishedAt)
        && request.startedAt <= finishedAt;
      resourceLoads.push(Object.freeze({
        url: request.url,
        resourceType: request.resourceType,
        status: request.status,
        mimeType: request.mimeType,
        durationMs: durationOrderValid
          ? Number(((finishedAt - request.startedAt) * 1_000).toFixed(2))
          : null,
        responseDelayMs: timingOrderValid
          ? Number(((request.responseAt - request.startedAt) * 1_000).toFixed(2))
          : null,
        timingOrderValid,
        encodedDataLength: Number.isFinite(Number(event.params?.encodedDataLength))
          ? Number(event.params.encodedDataLength)
          : null,
        fromDiskCache: request.fromDiskCache,
        fromServiceWorker: request.fromServiceWorker,
      }));
    }
    requests.delete(event.params.requestId);
  });
  listen('Network.loadingFailed', (event) => {
    if (!isOwnedSessionEvent(event) || networkFailures.length >= MAX_NETWORK_FAILURES) return;
    const params = event.params || {};
    const request = requests.get(params.requestId);
    networkFailures.push(Object.freeze({
      url: request?.url || '',
      resourceType: params.type || request?.resourceType || '',
      errorText: toBoundedText(params.errorText),
      canceled: params.canceled === true,
      blockedReason: params.blockedReason || null,
      corsErrorStatus: params.corsErrorStatus || null,
    }));
    requests.delete(params.requestId);
  });
  listen('Page.domContentEventFired', (event) => {
    if (
      isOwnedSessionEvent(event)
      && timeline.navigationRequestedAtEpochMs !== null
      && timeline.domContentObservedAtEpochMs === null
    ) {
      timeline.domContentObservedAtEpochMs = nowEpochMs();
    }
  });
  listen('Page.loadEventFired', (event) => {
    if (
      isOwnedSessionEvent(event)
      && timeline.navigationRequestedAtEpochMs !== null
      && timeline.loadObservedAtEpochMs === null
    ) {
      timeline.loadObservedAtEpochMs = nowEpochMs();
    }
  });

  return Object.freeze({
    async prepareNativePage(harness, page) {
      if (disposed || nativePreparationAttempted) throw new Error('QA_DASHBOARD_NATIVE_PREPARATION_NOT_ADMITTED');
      nativePreparationAttempted = true;
      if (page?.sessionId !== sessionId) throw new Error('QA_DASHBOARD_NATIVE_PREPARATION_SESSION_MISMATCH');
      nativePreparation = { status: 'preparing', activation: null, initialDocument: null, lastObservation: null, failure: null };
      try {
        const activation = await harness.activateOwnedEphemeralPageWithoutWindowFocus(page);
        nativePreparation.activation = activation;
        const initialDocument = await readNativeState(`({
          href: location.href, visibilityState: document.visibilityState, hidden: document.hidden,
          hasFocus: document.hasFocus(), atMs: performance.now(), timeOrigin: performance.timeOrigin,
        })`);
        nativePreparation.initialDocument = initialDocument;
        if (activation?.tabId !== page.tabId || activation.active !== true
          || activation.activeTabObserved !== true || !Number.isInteger(activation.windowId)
          || activation.windowFocusRequested !== false) {
          failNativePreparation('QA_DASHBOARD_NATIVE_TAB_ACTIVATION_INVALID', 'initial_page');
        }
        // openPage('about:blank') retains the extension harness's nonce marker page.
        // The activation owner proves exact page ownership; the URL is evidence,
        // not a second ownership test based on an assumed blank-document address.
        if (initialDocument?.visibilityState !== 'visible'
          || initialDocument.hidden !== false) {
          failNativePreparation('QA_DASHBOARD_NATIVE_DOCUMENT_NOT_VISIBLE', 'initial_page');
        }
        const installed = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
          source: `(${installNativeVisibilityProbe.toString()})(${JSON.stringify(NATIVE_VISIBILITY_PROBE_KEY)})`,
        }, sessionId, { timeoutMs: 5_000 });
        if (typeof installed?.identifier !== 'string' || !installed.identifier) {
          failNativePreparation('QA_DASHBOARD_NATIVE_VISIBILITY_SCRIPT_ID_REQUIRED', 'initial_page');
        }
        nativeVisibilityScriptId = installed.identifier;
        nativePreparationArmed = true;
        nativePreparation.status = 'admitted';
        return snapshotNativePreparation();
      } catch (error) {
        if (!nativePreparation.failure) {
          nativePreparation.status = 'failed';
          nativePreparation.failure = { code: error?.code === 'QA_DASHBOARD_NATIVE_VISIBILITY_OBSERVATION_FAILED'
            ? error.code : 'QA_DASHBOARD_NATIVE_PREPARATION_FAILED', stage: 'initial_page',
            reason: toBoundedText(error?.message || error) };
        }
        throw error;
      }
    },
    async requireNativePageVisible(stage) {
      if (!nativePreparationArmed) return;
      let observation;
      try {
        observation = await readNativeState(`(() => {
          const probe = globalThis[${JSON.stringify(NATIVE_VISIBILITY_PROBE_KEY)}];
          if (!probe) throw new Error('QA_DASHBOARD_NATIVE_VISIBILITY_PROBE_MISSING');
          return probe.snapshot();
        })()`);
      } catch (error) {
        nativePreparation.status = 'failed';
        nativePreparation.failure = { code: 'QA_DASHBOARD_NATIVE_VISIBILITY_OBSERVATION_FAILED', stage,
          reason: toBoundedText(error?.message || error) };
        throw error;
      }
      nativePreparation.lastObservation = { stage, ...observation };
      if (!observation || !Number.isInteger(observation.transitionCount) || observation.transitionCount < 1) {
        failNativePreparation('QA_DASHBOARD_NATIVE_VISIBILITY_OBSERVATION_INVALID', stage);
      }
      if (observation.visibilityState !== 'visible' || observation.hidden !== false || observation.firstHidden !== null) {
        failNativePreparation('QA_DASHBOARD_NATIVE_DOCUMENT_VISIBILITY_LOST', stage);
      }
    },
    async stopNativePagePreparation() {
      if (nativeVisibilityScriptId === null) return;
      nativePreparationArmed = false;
      const identifier = nativeVisibilityScriptId;
      nativeVisibilityScriptId = null;
      const results = await Promise.allSettled([
        readNativeState(`(() => {
          const probe = globalThis[${JSON.stringify(NATIVE_VISIBILITY_PROBE_KEY)}];
          if (probe) probe.dispose();
        })()`),
        cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier }, sessionId, { timeoutMs: 5_000 }),
      ]);
      const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
      if (errors.length) {
        nativePreparation.cleanupError = toBoundedText(errors[0]?.message || errors[0]);
        if (errors.length === 1) throw errors[0];
        throw new AggregateError(errors, 'QA_DASHBOARD_NATIVE_PREPARATION_CLEANUP_FAILED', { cause: errors[0] });
      }
      if (nativePreparation.status !== 'failed') nativePreparation.status = 'completed';
    },
    async enable() {
      await Promise.all([
        cdp.send('Network.enable', {}, sessionId, { timeoutMs: 5_000 }),
        cdp.send('Log.enable', {}, sessionId, { timeoutMs: 5_000 }),
        cdp.send('Performance.enable', {}, sessionId, { timeoutMs: 5_000 }),
        cdp.send(
          'Page.setLifecycleEventsEnabled',
          { enabled: true },
          sessionId,
          { timeoutMs: 5_000 },
        ),
        ...(cpuProfile
          ? [
            cdp.send('Profiler.enable', {}, sessionId, { timeoutMs: 5_000 }),
            cdp.send('Target.setAutoAttach', {
              autoAttach: true,
              waitForDebuggerOnStart: true,
              flatten: true,
              filter: [
                { type: 'worker', exclude: false },
                { exclude: true },
              ],
            }, sessionId, { timeoutMs: 5_000 }),
          ]
          : []),
      ]);
      if (cpuProfile) {
        workerAutoAttachEnabled = true;
        cpuProfileStartReceipt = { requestedAtEpochMs: nowEpochMs() };
        await cdp.send('Profiler.start', {}, sessionId, { timeoutMs: 5_000 });
        cpuProfileStartReceipt.confirmedAtEpochMs = nowEpochMs();
        cpuProfileStarted = true;
      }
    },
    markNavigationRequested() {
      if (timeline.navigationRequestedAtEpochMs !== null) {
        throw new Error('QA_DASHBOARD_CAPTURE_NAVIGATION_ALREADY_RECORDED');
      }
      timeline.navigationRequestedAtEpochMs = nowEpochMs();
    },
    markCaptureReady() {
      timeline.captureReadyAtEpochMs = nowEpochMs();
    },
    markCaptureFinished() {
      timeline.captureFinishedAtEpochMs = nowEpochMs();
    },
    async capturePerformanceCheckpoint(label) {
      if (
        typeof label !== 'string'
        || !/^[a-z][a-z0-9_]*$/u.test(label)
      ) {
        throw new Error('QA_DASHBOARD_CAPTURE_PERFORMANCE_LABEL_INVALID');
      }
      if (performanceCheckpointLabels.has(label)) {
        throw new Error(`QA_DASHBOARD_CAPTURE_PERFORMANCE_LABEL_DUPLICATE:${label}`);
      }
      const response = await cdp.send(
        'Performance.getMetrics',
        {},
        sessionId,
        { timeoutMs: 5_000 },
      );
      const metrics = Object.freeze(Object.fromEntries(
        (response?.metrics || [])
          .filter((entry) => (
            PERFORMANCE_METRIC_NAME_SET.has(entry?.name)
            && Number.isFinite(Number(entry?.value))
          ))
          .map((entry) => [entry.name, Number(entry.value)]),
      ));
      performanceCheckpointLabels.add(label);
      const checkpoint = Object.freeze({
        label,
        capturedAtEpochMs: nowEpochMs(),
        metrics,
      });
      performanceCheckpoints.push(checkpoint);
      return checkpoint;
    },
    async stopCpuProfile() {
      if (!cpuProfile || !cpuProfileStarted) return cpuProfileSummary;
      cpuProfileStarted = false;
      await Promise.allSettled(workerCpuProfileTasks);
      for (const entry of workerCpuProfileEntries.values()) {
        if (entry.started && !entry.stopped && !entry.trailingProfileLost) {
          await stopWorkerProfile(entry);
        }
        workerCpuProfiles.push(buildWorkerCpuProfileSnapshot(entry));
      }
      if (workerAutoAttachEnabled) {
        workerAutoAttachEnabled = false;
        await cdp.send('Target.setAutoAttach', {
          autoAttach: false,
          waitForDebuggerOnStart: false,
          flatten: true,
        }, sessionId, { timeoutMs: 5_000 }).catch((error) => {
          cpuProfileError = toBoundedText(error?.message || error);
        });
      }
      for (const workerSessionId of autoAttachedWorkerSessions) {
        await cdp.send(
          'Target.detachFromTarget',
          { sessionId: workerSessionId },
          sessionId,
          { timeoutMs: 5_000 },
        ).catch(() => {});
      }
      try {
        const response = await cdp.send(
          'Profiler.stop',
          {},
          sessionId,
          { timeoutMs: 10_000 },
        );
        cpuProfileSummary = summarizeCpuProfile(response?.profile);
        if (writeCpuProfileEvidence) cpuProfileEvidence = await writeCpuProfileEvidence({
          kind: 'page', profile: response.profile, startReceipt: cpuProfileStartReceipt,
        });
        return cpuProfileSummary;
      } catch (error) {
        cpuProfileError = toBoundedText(error?.message || error);
        return null;
      }
    },
    async snapshot() {
      await Promise.allSettled(consoleMessageTasks);
      const orderedConsoleMessages = [...consoleMessages]
        .sort((left, right) => left.sequence - right.sequence);
      return Object.freeze({
        timeline: Object.freeze({ ...timeline }),
        runtimeExceptions: Object.freeze([...runtimeExceptions]),
        consoleMessages: Object.freeze(orderedConsoleMessages),
        logEntries: Object.freeze([...logEntries]),
        networkFailures: Object.freeze([...networkFailures]),
        resourceLoads: Object.freeze([...resourceLoads]
          .sort((left, right) => (right.durationMs || 0) - (left.durationMs || 0))),
        performanceCheckpoints: Object.freeze([...performanceCheckpoints]),
        ...(nativePreparation ? { nativePagePreparation: snapshotNativePreparation() } : {}),
        cpuProfile: cpuProfileSummary,
        ...(cpuProfileEvidence ? { cpuProfileEvidence } : {}),
        cpuProfileError,
        workerCpuProfiles: Object.freeze([...workerCpuProfiles]),
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const release of unsubscribe.splice(0).reverse()) {
        release?.();
      }
      requests.clear();
    },
  });
}

export function classifyDashboardCaptureHealth({
  pageSnapshot = null,
  pageDiagnostics = null,
  requireCpuProfile = false,
  requireModelCpuProfile = false,
  probeError = null,
} = {}) {
  const issues = [];
  const bootSnapshot = pageSnapshot?.boot?.snapshot || null;
  const telemetrySnapshot = pageSnapshot?.boot?.telemetrySnapshot || null;
  const addIssue = (code, details = null) => {
    if (!issues.some((issue) => issue.code === code)) {
      issues.push(freezeIssue(code, details));
    }
  };

  if (probeError) addIssue('dashboard_boot_probe_failed', { message: String(probeError) });
  if (pageDiagnostics?.nativePagePreparation?.failure) {
    addIssue('dashboard_native_page_capability_failed', pageDiagnostics.nativePagePreparation.failure);
  }
  if (!bootSnapshot) {
    addIssue('dashboard_boot_snapshot_missing');
  } else {
    if (bootSnapshot.status === 'failed') {
      addIssue('dashboard_boot_failed', { phase: bootSnapshot.phase || null });
    }
    if (bootSnapshot.forcedVisualRelease === true) {
      addIssue('dashboard_boot_forced_visual_release', {
        reason: bootSnapshot.forcedVisualReleaseReason || null,
      });
    }
    if (
      bootSnapshot.degraded === true
      || bootSnapshot.themeShellDegraded === true
      || bootSnapshot.mainTabFirstFrameDegraded === true
      || bootSnapshot.coreWaitBudgetExceeded === true
      || bootSnapshot.mainTabFirstFrameWaitBudgetExceeded === true
    ) {
      addIssue('dashboard_boot_degraded', {
        status: bootSnapshot.status || null,
        phase: bootSnapshot.phase || null,
        themeShellDegraded: bootSnapshot.themeShellDegraded === true,
        mainTabFirstFrameDegraded: bootSnapshot.mainTabFirstFrameDegraded === true,
        coreWaitBudgetExceeded: bootSnapshot.coreWaitBudgetExceeded === true,
        mainTabFirstFrameWaitBudgetExceeded:
          bootSnapshot.mainTabFirstFrameWaitBudgetExceeded === true,
      });
    }
    const bootErrors = Array.isArray(bootSnapshot.errors) ? bootSnapshot.errors : [];
    if (bootErrors.length > 0) {
      addIssue('dashboard_boot_errors_recorded', { count: bootErrors.length });
    }
  }

  if (
    telemetrySnapshot
    && !['running', 'ready'].includes(telemetrySnapshot.status)
  ) {
    addIssue('dashboard_boot_telemetry_failed', {
      status: telemetrySnapshot.status || null,
    });
  }
  if (requireModelCpuProfile === true) {
    const modelProfiles = (pageDiagnostics?.workerCpuProfiles || []).filter((entry) => (
      entry?.kind === 'model_worker' && ZEN_BONSAI_MODEL_WORKER_URL_PATTERN.test(entry?.url || '')
    ));
    if (modelProfiles.length === 0) {
      addIssue('dashboard_model_worker_cpu_profile_missing', { profileCount: 0 });
    } else {
      const incomplete = modelProfiles.filter((entry) => entry.error !== null
        || !entry.runtimeName || entry.terminatedBeforeProfileStop === true
        || !entry.profileSegments?.some(segment => segment.completionReceipt)
        || entry.profileSegments?.some(segment => segment.completionReceipt
          && (segment.error !== null || Number(segment.profile?.sampleCount) <= 0
            || !segment.profileEvidence?.path)));
      if (incomplete.length > 0) addIssue('dashboard_model_worker_cpu_profile_incomplete', {
        profileCount: modelProfiles.length,
        incomplete: Object.freeze(incomplete.map((entry) => Object.freeze({
          targetId: entry.targetId, runtimeName: entry.runtimeName,
          terminatedBeforeProfileStop: entry.terminatedBeforeProfileStop === true,
          sampleCount: Number(entry?.profile?.sampleCount) || 0, error: entry.error,
        }))),
      });
    }
  }
  if (
    requireCpuProfile === true
    && Number(pageDiagnostics?.cpuProfile?.sampleCount) > 0
    && !(pageDiagnostics?.workerCpuProfiles || []).some((entry) => (
      entry?.error === null
      && Number(entry?.profile?.sampleCount) > 0
      && ZEN_HOME_RENDERER_WORKER_URL_PATTERN.test(entry?.url || '')
    ))
  ) {
    addIssue('dashboard_home_worker_cpu_profile_missing', {
      profileCount: Array.isArray(pageDiagnostics?.workerCpuProfiles)
        ? pageDiagnostics.workerCpuProfiles.length
        : 0,
      errors: Object.freeze((pageDiagnostics?.workerCpuProfiles || [])
        .map((entry) => entry?.error)
        .filter(Boolean)),
    });
  }
  if ((pageDiagnostics?.runtimeExceptions || []).length > 0) {
    addIssue('dashboard_runtime_exceptions_observed', {
      count: pageDiagnostics.runtimeExceptions.length,
    });
  }
  const consoleErrors = (pageDiagnostics?.consoleMessages || []).filter(
    (entry) => entry.type === 'error' || entry.type === 'diagnostic_serialization_error',
  );
  if (consoleErrors.length > 0) {
    addIssue('dashboard_console_errors_observed', { count: consoleErrors.length });
  }
  const fatalWarnings = (pageDiagnostics?.consoleMessages || []).filter((entry) => (
    entry.type === 'warning'
    && FAILING_BOOT_WARNING_PATTERNS.some((pattern) => pattern.test(entry.text || ''))
  ));
  if (fatalWarnings.length > 0) {
    addIssue('dashboard_boot_timeout_warning_observed', { count: fatalWarnings.length });
  }
  const browserLogErrors = (pageDiagnostics?.logEntries || []).filter(
    (entry) => entry.level === 'error',
  );
  if (browserLogErrors.length > 0) {
    addIssue('dashboard_browser_log_errors_observed', { count: browserLogErrors.length });
  }
  const resourceFailures = (pageDiagnostics?.networkFailures || []).filter(
    (entry) => entry.canceled !== true,
  );
  if (resourceFailures.length > 0) {
    addIssue('dashboard_resource_load_failures_observed', { count: resourceFailures.length });
  }
  const httpFailures = (pageDiagnostics?.resourceLoads || []).filter(
    (entry) => Number(entry.status) >= 400,
  );
  if (httpFailures.length > 0) {
    addIssue('dashboard_resource_http_failures_observed', { count: httpFailures.length });
  }
  if (
    requireCpuProfile === true
    && (
      !pageDiagnostics?.cpuProfile
      || Number(pageDiagnostics.cpuProfile.sampleCount) <= 0
      || pageDiagnostics?.cpuProfileError
    )
  ) {
    addIssue('dashboard_cpu_profile_missing', {
      sampleCount: Number(pageDiagnostics?.cpuProfile?.sampleCount) || 0,
      error: pageDiagnostics?.cpuProfileError || null,
    });
  }

  return Object.freeze({
    status: issues.length === 0 ? 'clean' : 'failed',
    issues: Object.freeze(issues),
  });
}
