const CONTRACT = 'zen_bonsai_plume_model_timing_v1';
const TRACE_EVENT = 'bonsai_model:timing';
const OPERATIONS = new Set(['PREPARE_PLUME_STUDY', 'PROJECT_PLUME_TOPOLOGY']);
const MODEL_WORKER_URL = /\/assets\/zenBonsaiModel\.worker-[^/]+\.js$/u;
const PAGE_ORDER = ['operation_start', 'request_start', 'request_initialized',
  'request_post_start', 'request_post_end', 'response_received',
  'response_validation_start', 'response_validation_end', 'response_resolved'];
const REQUIRED_MESSAGE_STAGES = new Set(['request_post_start', 'request_post_end',
  'response_received', 'response_validation_start', 'response_validation_end',
  'response_resolved', 'request_received', 'study_start', 'study_end',
  'projection_start', 'projection_end', 'result_post_start', 'result_post_end']);
const PRE_FACTORY_STAGES = new Set(['operation_start', 'request_start', 'init_start']);
const REPEATABLE_STAGES = new Set(['projection_reused', 'projection_life_rebound', 'disabled']);
const finiteTime = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 480;
const unique = values => [...new Set(values)];

function emptyEvidence(status, reasons) {
  return { contract: CONTRACT, status, reasons, operations: [], firstReadyOperation: null,
    accounting: null, cpuCoverage: null };
}

function inspectOperation(operationId, entries) {
  const reasons = [];
  const first = entries[0];
  const stages = { page: new Map(), model_worker: new Map() };
  const latestUiSequences = new Map();
  const workerIds = new Set();
  const messageIds = new Set();
  const origins = { page: new Set(), model_worker: new Set() };
  for (const entry of entries) {
    if (entry.contract !== CONTRACT) reasons.push('contract_mismatch');
    if (entry.operationId !== operationId || entry.operation !== first.operation
      || entry.seed !== first.seed) reasons.push('operation_identity_mismatch');
    if (!OPERATIONS.has(entry.operation) || typeof entry.seed !== 'number' || !Number.isFinite(entry.seed)) reasons.push('operation_identity_invalid');
    if (!Object.hasOwn(stages, entry.realm) || !identity(entry.stage)) {
      reasons.push('stage_identity_invalid');
      continue;
    }
    if (!finiteTime(entry.atMs) || !finiteTime(entry.timeOriginMs)) reasons.push('clock_invalid');
    else origins[entry.realm].add(entry.timeOriginMs);
    if (Object.hasOwn(entry, 'durationMs') && !finiteTime(entry.durationMs)) reasons.push('duration_invalid');
    if (entry.workerInstanceId !== null && entry.workerInstanceId !== undefined) {
      if (!identity(entry.workerInstanceId)) reasons.push('worker_identity_invalid');
      else workerIds.add(entry.workerInstanceId);
    } else if (entry.realm !== 'page' || !PRE_FACTORY_STAGES.has(entry.stage)) reasons.push(`stage_worker_identity_missing:${entry.stage}`);
    if (entry.messageId !== null && entry.messageId !== undefined) {
      if (!Number.isSafeInteger(entry.messageId) || entry.messageId <= 0) reasons.push('message_identity_invalid');
      else messageIds.add(entry.messageId);
    }
    if (REQUIRED_MESSAGE_STAGES.has(entry.stage)
      && (!identity(entry.workerInstanceId) || !Number.isSafeInteger(entry.messageId) || entry.messageId <= 0)) {
      reasons.push(`stage_request_identity_missing:${entry.stage}`);
    }
    const prior = stages[entry.realm].get(entry.stage);
    if (prior) {
      // A same-growth life binding creates a new UI materialization with the
      // original anatomical Worker provenance. Keep the first UI stage for boot
      // accounting; admit later stages only with a newer exact client sequence.
      const newerUiProjection = entry.realm === 'page' && ['ui_accept', 'ui_commit'].includes(entry.stage)
        && Number.isSafeInteger(latestUiSequences.get(entry.stage)) && latestUiSequences.get(entry.stage) > 0
        && Number.isSafeInteger(entry.uiProjectionSequence) && entry.uiProjectionSequence > latestUiSequences.get(entry.stage)
        && entry.initialUiCommit !== true;
      if (!REPEATABLE_STAGES.has(entry.stage) && !newerUiProjection) reasons.push(`duplicate_stage:${entry.realm}:${entry.stage}`);
      else if (prior.sourceOperationId !== entry.sourceOperationId
        || prior.sourceWorkerInstanceId !== entry.sourceWorkerInstanceId) reasons.push(`repeated_stage_identity_mismatch:${entry.stage}`);
      if (newerUiProjection) latestUiSequences.set(entry.stage, entry.uiProjectionSequence);
    } else stages[entry.realm].set(entry.stage, entry);
    if (!prior && entry.realm === 'page' && ['ui_accept', 'ui_commit'].includes(entry.stage)) {
      latestUiSequences.set(entry.stage, entry.uiProjectionSequence);
    }
  }
  if (workerIds.size > 1) reasons.push('worker_identity_mismatch');
  if (messageIds.size > 1) reasons.push('message_identity_mismatch');
  if (origins.page.size > 1 || origins.model_worker.size > 1) reasons.push('clock_origin_mismatch');
  return { operationId, operation: first.operation, seed: first.seed,
    workerInstanceId: workerIds.size === 1 ? [...workerIds][0] : null,
    messageId: messageIds.size === 1 ? [...messageIds][0] : null,
    pageTimeOriginMs: origins.page.size === 1 ? [...origins.page][0] : null,
    workerTimeOriginMs: origins.model_worker.size === 1 ? [...origins.model_worker][0] : null,
    stages, reasons, sourceOperationId: stages.page.get('projection_reused')?.sourceOperationId ?? null };
}

function requireStages(operation, realm, names) {
  const stages = operation.stages[realm];
  for (const name of names) {
    if (!stages.has(name)) operation.reasons.push(`missing_stage:${realm}:${name}`);
  }
  let prior = null;
  for (const name of names) {
    const entry = stages.get(name);
    if (!entry || !finiteTime(entry.atMs)) continue;
    if (prior && entry.atMs < prior.atMs) operation.reasons.push(`stage_order_invalid:${realm}:${prior.stage}:${name}`);
    prior = entry;
  }
}

function interval(operation, realm, from, to) {
  const start = operation.stages[realm].get(from);
  const end = operation.stages[realm].get(to);
  return finiteTime(start?.atMs) && finiteTime(end?.atMs)
    && end.atMs >= start.atMs && start.timeOriginMs === end.timeOriginMs
    ? end.atMs - start.atMs : null;
}

function sumMeasurements(measurements, key, eligible = () => true) {
  const values = measurements.filter(eligible).map(measurement => measurement[key]);
  return values.length && values.every(finiteTime) ? values.reduce((sum, value) => sum + value, 0) : null;
}

function inspectRequest(operation) {
  requireStages(operation, 'page', PAGE_ORDER);
  const worker = operation.stages.model_worker;
  const barrierStart = worker.get('profile_wait_start');
  const barrierEnd = worker.get('profile_wait_end');
  const workerOrder = ['request_received'];
  if (operation.operation === 'PREPARE_PLUME_STUDY') workerOrder.push('study_start', 'study_end');
  const projectionDeclarations = [...operation.stages.page.values(), ...operation.stages.model_worker.values()]
    .filter(entry => Object.hasOwn(entry, 'hasProjection')).map(entry => entry.hasProjection);
  if (!projectionDeclarations.length || projectionDeclarations.some(value => typeof value !== 'boolean')) {
    operation.reasons.push('projection_coverage_declaration_missing_or_invalid');
  }
  if (new Set(projectionDeclarations).size > 1) operation.reasons.push('projection_coverage_declaration_mismatch');
  const hasProjection = projectionDeclarations.some(value => value === true);
  if (operation.operation === 'PROJECT_PLUME_TOPOLOGY' || hasProjection) workerOrder.push('projection_start', 'projection_end');
  if (barrierStart || barrierEnd) workerOrder.push('profile_wait_start', 'profile_wait_end');
  workerOrder.push('result_post_start', 'result_post_end');
  requireStages(operation, 'model_worker', workerOrder);
  if (operation.workerInstanceId === null || operation.messageId === null) operation.reasons.push('request_identity_missing');
  const page = operation.stages.page;
  if (page.has('init_start')) {
    requireStages(operation, 'page', ['request_start', 'init_start', 'worker_created',
      'init_post_start', 'init_post_end', 'init_ready_received', 'request_initialized']);
  }
  let barrierMs = 0;
  if (barrierStart || barrierEnd) {
    requireStages(operation, 'model_worker', ['request_received', 'profile_wait_start',
      'profile_wait_end', 'result_post_start']);
    barrierMs = interval(operation, 'model_worker', 'profile_wait_start', 'profile_wait_end');
  }
  const totalHandlerMs = interval(operation, 'model_worker', 'request_received', 'result_post_end');
  const requestRoundtripMs = interval(operation, 'page', 'request_post_start', 'response_received');
  const validationMs = interval(operation, 'page', 'response_validation_start', 'response_validation_end');
  const responseTailMs = interval(operation, 'page', 'response_received', 'response_resolved');
  if (totalHandlerMs !== null && requestRoundtripMs !== null && totalHandlerMs > requestRoundtripMs) {
    operation.reasons.push('worker_handler_exceeds_page_roundtrip');
  }
  if (validationMs !== null && responseTailMs !== null && validationMs > responseTailMs) {
    operation.reasons.push('validation_exceeds_response_window');
  }
  const localAccountingValid = operation.reasons.length === 0;
  const workerPhaseDurationsMs = {};
  for (const stage of worker.keys()) {
    if (!stage.endsWith('_start')) continue;
    const name = stage.slice(0, -'_start'.length);
    workerPhaseDurationsMs[name] = interval(operation, 'model_worker', stage, `${name}_end`);
  }
  return { initAwaitMs: interval(operation, 'page', 'request_start', 'request_initialized'),
    projectionExpected: operation.operation === 'PROJECT_PLUME_TOPOLOGY' || hasProjection,
    requestRoundtripMs, mainRequestPostMs: interval(operation, 'page', 'request_post_start', 'request_post_end'),
    workerHandlerMs: totalHandlerMs, workerProfileBarrierMs: barrierMs,
    workerHandlerExcludingProfileBarrierMs: totalHandlerMs !== null && barrierMs !== null ? totalHandlerMs - barrierMs : null,
    workerStudyMs: interval(operation, 'model_worker', 'study_start', 'study_end'),
    workerProjectionMs: interval(operation, 'model_worker', 'projection_start', 'projection_end'),
    workerResultPostMs: interval(operation, 'model_worker', 'result_post_start', 'result_post_end'),
    workerPhaseDurationsMs,
    pageResponseValidationMs: validationMs,
    requestTransportSchedulingAndDeserializationResidualMs: localAccountingValid && totalHandlerMs !== null && requestRoundtripMs !== null
      && totalHandlerMs <= requestRoundtripMs ? requestRoundtripMs - totalHandlerMs : null };
}

function inspectCpuCoverage(operation, diagnostics, requireCpuProfile) {
  if (!requireCpuProfile) return { status: 'NOT_REQUESTED', reasons: [], workerInstanceId: operation.workerInstanceId };
  const profiles = diagnostics?.workerCpuProfiles;
  const matching = Array.isArray(profiles) ? profiles.filter(profile => profile.kind === 'model_worker'
    && profile.runtimeName === operation.workerInstanceId) : [];
  const reasons = [];
  if (matching.length !== 1) reasons.push(matching.length ? 'cpu_profile_worker_identity_ambiguous' : 'cpu_profile_worker_missing');
  const profile = matching.length === 1 ? matching[0] : null;
  const segments = Array.isArray(profile?.profileSegments) ? profile.profileSegments.filter(segment =>
    segment.completionReceipt?.operationId === operation.operationId) : [];
  if (profile && segments.length !== 1) reasons.push(segments.length
    ? 'cpu_profile_operation_identity_ambiguous' : 'cpu_profile_operation_missing');
  const segment = segments.length === 1 ? segments[0] : null;
  if (profile && !MODEL_WORKER_URL.test(profile.url)) reasons.push('cpu_profile_worker_url_invalid');
  if (segment) {
    if (profile.started !== true || profile.error !== null || segment.error !== null
      || !finiteTime(segment.profile?.sampledTimeMs) || segment.profile.sampledTimeMs <= 0
      || !Number.isSafeInteger(segment.profileEvidence?.sampleCount) || segment.profileEvidence.sampleCount <= 0
      || !identity(segment.profileEvidence?.path)) reasons.push('cpu_profile_capture_incomplete');
    const completion = segment.completionReceipt;
    if (segment.capturePhase !== 'before_result' || completion?.phase !== 'before_result'
      || completion.runtimeName !== operation.workerInstanceId || completion.requestId !== operation.messageId
      || completion.requestType !== operation.operation || completion.timeOriginMs !== operation.workerTimeOriginMs
      || !finiteTime(completion.atMs)) reasons.push('cpu_profile_completion_identity_invalid');
    const start = operation.stages.model_worker.get('profile_wait_start');
    const end = operation.stages.model_worker.get('profile_wait_end');
    if (!start || !end) reasons.push('cpu_profile_barrier_unmeasured');
    else if (completion.atMs < start.atMs || completion.atMs > end.atMs) reasons.push('cpu_profile_completion_outside_barrier');
  }
  return { status: reasons.length ? 'INCOMPLETE' : 'COMPLETE', reasons,
    workerInstanceId: operation.workerInstanceId, targetId: profile?.targetId ?? null,
    capturePhase: segment?.capturePhase ?? null, profilePath: segment?.profileEvidence?.path ?? null,
    scope: 'Exact named model Worker through its before-result profiling barrier; result postMessage serialization is outside CPU capture.' };
}

// Completeness is a diagnostic verdict. It cannot promote or relax the owning
// dashboard boot readiness, timeout, health or artifact acceptance contract.
export function projectDashboardBootModelTimingEvidence(pageSnapshot, request = {}, diagnostics = {}) {
  if (request.themeId !== 'zen' || request.traceMode === 'off'
    || (request.surfaceId !== undefined && request.surfaceId !== 'main')
    || request.zenMainProfile?.bonsaiState === 'empty') return emptyEvidence('NOT_REQUESTED', ['model_timing_not_requested']);
  const history = pageSnapshot?.boot?.zenTraceHistory;
  if (!Array.isArray(history)) return emptyEvidence('INCOMPLETE', ['trace_history_missing']);
  const events = history.filter(entry => entry?.event === TRACE_EVENT);
  if (!events.length) return emptyEvidence('INCOMPLETE', [request.traceMode === 'marks' ? 'timing_payloads_absent_marks' : 'model_timing_events_missing']);
  const reasons = [];
  const groups = new Map();
  const sessions = new Set();
  for (const event of events) {
    if (!identity(event.sessionId)) reasons.push('trace_session_missing');
    else sessions.add(event.sessionId);
    const entry = event.details;
    if (!entry || typeof entry !== 'object' || !identity(entry.operationId)) {
      reasons.push('timing_payload_missing_or_invalid');
      continue;
    }
    if (!groups.has(entry.operationId)) groups.set(entry.operationId, []);
    groups.get(entry.operationId).push(entry);
  }
  if (sessions.size > 1) reasons.push('trace_session_mismatch');
  const operations = [...groups].map(([operationId, entries]) => inspectOperation(operationId, entries));
  const byId = new Map(operations.map(operation => [operation.operationId, operation]));
  const committed = operations.filter(operation => operation.stages.page.get('ui_commit')?.initialUiCommit === true);
  if (!committed.length) return { ...emptyEvidence('INCOMPLETE', unique([...reasons, 'ui_commit_missing'])),
    operations: operations.map(operation => ({ operationId: operation.operationId, operation: operation.operation,
      workerInstanceId: operation.workerInstanceId, reasons: unique(operation.reasons) })) };
  const pageOrigins = new Set(committed.map(operation => operation.pageTimeOriginMs));
  if (pageOrigins.size !== 1 || pageOrigins.has(null)) reasons.push('committed_page_clock_origin_mismatch');
  committed.sort((left, right) => left.stages.page.get('ui_commit').atMs - right.stages.page.get('ui_commit').atMs);
  const selected = committed[0];
  let source = selected;
  if (selected.stages.page.has('projection_reused')) {
    source = byId.get(selected.sourceOperationId);
    if (!source || !OPERATIONS.has(source.operation)) reasons.push('reused_projection_source_missing');
    else if (source.seed !== selected.seed || source.pageTimeOriginMs !== selected.pageTimeOriginMs
      || source.workerInstanceId !== selected.workerInstanceId) reasons.push('reused_projection_source_identity_mismatch');
    requireStages(selected, 'page', ['operation_start', 'projection_reused', 'ui_accept', 'ui_commit']);
    if (source === selected) requireStages(selected, 'page', ['response_resolved', 'projection_reused', 'ui_accept', 'ui_commit']);
  } else requireStages(selected, 'page', [...PAGE_ORDER, 'ui_accept', 'ui_commit']);
  const chain = [];
  const visited = new Set();
  let dependency = source;
  while (dependency) {
    if (visited.has(dependency.operationId)) { reasons.push('preparation_dependency_cycle'); break; }
    visited.add(dependency.operationId);
    chain.unshift(dependency);
    const start = dependency.stages.page.get('operation_start');
    if (!start?.preparationOperationId) break;
    const prepared = byId.get(start.preparationOperationId);
    if (!prepared || prepared.operation !== 'PREPARE_PLUME_STUDY') {
      reasons.push('preparation_dependency_missing');
      break;
    }
    if (prepared.seed !== dependency.seed || prepared.pageTimeOriginMs !== dependency.pageTimeOriginMs
      || prepared.workerInstanceId !== start.preparationWorkerInstanceId) {
      reasons.push('preparation_dependency_identity_mismatch');
    }
    dependency = prepared;
  }
  if (source?.operation === 'PROJECT_PLUME_TOPOLOGY'
    && !source.stages.page.get('operation_start')?.preparationOperationId) reasons.push('initial_projection_preparation_dependency_missing');
  const perRequest = chain.map(operation => ({ operationId: operation.operationId,
    operation: operation.operation, workerInstanceId: operation.workerInstanceId,
    messageId: operation.messageId, ...inspectRequest(operation) }));
  for (let index = 1; index < chain.length; index += 1) {
    const previous = chain[index - 1].stages.page.get('response_resolved');
    const next = chain[index].stages.page.get('request_start');
    if (!previous || !next || previous.timeOriginMs !== next.timeOriginMs || previous.atMs > next.atMs) {
      reasons.push('preparation_requests_overlap_or_clock_mismatch');
    }
  }
  for (const operation of chain) reasons.push(...operation.reasons);
  reasons.push(...selected.reasons);
  const firstReadyOperation = { operationId: selected.operationId, sourceOperationId: source?.operationId ?? null,
    operation: selected.operation, workerInstanceId: source?.workerInstanceId ?? null,
    messageId: source?.messageId ?? null, seed: selected.seed,
    pageTimeOriginMs: selected.pageTimeOriginMs, workerTimeOriginMs: source?.workerTimeOriginMs ?? null,
    preparationOperationId: chain.length > 1 ? chain[0].operationId : null,
    operationIds: chain.map(operation => operation.operationId) };
  let accounting = null;
  if (source && perRequest.length) {
    const measurements = perRequest.at(-1);
    const start = chain[0].stages.page.get('operation_start');
    const commit = selected.stages.page.get('ui_commit');
    const response = source.stages.page.get('response_received');
    const totalMs = finiteTime(start?.atMs) && finiteTime(commit?.atMs)
      && start.timeOriginMs === commit.timeOriginMs && commit.atMs >= start.atMs ? commit.atMs - start.atMs : null;
    const uiTailMs = finiteTime(response?.atMs) && finiteTime(commit?.atMs)
      && response.timeOriginMs === commit.timeOriginMs && commit.atMs >= response.atMs ? commit.atMs - response.atMs : null;
    if (totalMs === null || uiTailMs === null) reasons.push('operation_to_ui_clock_or_order_invalid');
    const known = perRequest.flatMap(measurement => [measurement.initAwaitMs,
      measurement.workerHandlerMs, measurement.pageResponseValidationMs]);
    const measuredMs = known.every(finiteTime) ? known.reduce((sum, value) => sum + value, 0) : null;
    if (measuredMs !== null && totalMs !== null && measuredMs > totalMs) reasons.push('measured_work_exceeds_operation_total');
    const validResidual = reasons.length === 0 && measuredMs !== null && totalMs !== null && measuredMs <= totalMs;
    const aggregateKeys = ['initAwaitMs', 'requestRoundtripMs', 'mainRequestPostMs', 'workerHandlerMs',
      'workerProfileBarrierMs', 'workerHandlerExcludingProfileBarrierMs', 'workerResultPostMs',
      'pageResponseValidationMs', 'requestTransportSchedulingAndDeserializationResidualMs'];
    const aggregated = Object.fromEntries(aggregateKeys.map(key => [key, sumMeasurements(perRequest, key)]));
    aggregated.workerStudyMs = sumMeasurements(perRequest, 'workerStudyMs', measurement => measurement.operation === 'PREPARE_PLUME_STUDY');
    aggregated.workerProjectionMs = sumMeasurements(perRequest, 'workerProjectionMs', measurement => measurement.projectionExpected);
    accounting = { totalOperationToUiCommitMs: totalMs, ...aggregated,
      workerPhaseDurationsMs: chain.length === 1 ? measurements.workerPhaseDurationsMs : null,
      perRequest, responseToUiCommitMs: uiTailMs,
      measuredInitWorkerHandlerAndValidationMs: measuredMs,
      unattributedTransportSchedulingClientAndUiResidualMs: validResidual ? totalMs - measuredMs : null,
      scope: 'Page elapsed intervals share one time origin. Worker intervals share their own time origin; only durations enter residual accounting. Main request postMessage time is observational and may overlap Worker work, so it is not added. The residual combines transport, event queues, deserialization and uninstrumented client/UI work; it is not pure clone cost. CPU barrier time remains in raw totals and is separately identified.' };
  }
  const perRequestCpuCoverage = chain.map(operation => ({ operationId: operation.operationId,
    ...inspectCpuCoverage(operation, diagnostics, request.cpuProfile === true) }));
  const selectedCpuCoverage = perRequestCpuCoverage.at(-1);
  const cpuReasons = unique(perRequestCpuCoverage.flatMap(coverage => coverage.reasons));
  const cpuCoverage = selectedCpuCoverage ? { ...selectedCpuCoverage, perRequest: perRequestCpuCoverage,
    status: request.cpuProfile === true ? (cpuReasons.length ? 'INCOMPLETE' : 'COMPLETE') : 'NOT_REQUESTED',
    reasons: cpuReasons } : { status: request.cpuProfile === true ? 'INCOMPLETE' : 'NOT_REQUESTED', reasons: ['source_operation_missing'] };
  if (cpuCoverage.status === 'INCOMPLETE') reasons.push(...cpuCoverage.reasons);
  return { contract: CONTRACT, status: reasons.length ? 'INCOMPLETE' : 'COMPLETE', reasons: unique(reasons),
    traceSessionId: sessions.size === 1 ? [...sessions][0] : null,
    operations: operations.map(operation => ({ operationId: operation.operationId, operation: operation.operation,
      seed: operation.seed, workerInstanceId: operation.workerInstanceId, messageId: operation.messageId,
      stages: { page: [...operation.stages.page.keys()], model_worker: [...operation.stages.model_worker.keys()] },
      reasons: unique(operation.reasons) })), firstReadyOperation, accounting, cpuCoverage };
}
