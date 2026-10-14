import fs from 'node:fs/promises';
import path from 'node:path';
import { listQaProtocolIds } from '../catalog/qaProtocolRegistry.mjs';

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/u;
const TARGET_ID = /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/u;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/u;
const STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED', 'INCONCLUSIVE', 'READY_FOR_HUMAN']);
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_EVENT_BYTES = 256 * 1024;
const MAX_LOG_ENTRIES = 1000;
const MAX_SAMPLES = 20;
const REPORT_KEYS = ['reportJsonPath', 'reportPath', 'bootReportPath'];
const BUILD_ID = /^\d{14}-[a-f0-9]{12}-(?:dirty|clean)$/u;
const VERDICT_SCOPES = new Set(['infrastructure', 'product', 'observation', 'research']);
const ACTIVATION_ACTIONS = new Set(['loaded_exact_slot', 'reloaded_exact_slot', 'reused_active_runtime', 'reused_exact_slot']);
const PROTOCOL_IDS = new Set(listQaProtocolIds());

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const boolean = (value) => typeof value === 'boolean' ? value : null;
const number = (value) => Number.isFinite(value) && value >= 0 ? value : null;
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const token = (value) => typeof value === 'string' && TOKEN.test(value) ? value : null;
const arrayCount = (value) => Array.isArray(value) ? value.length : null;
const buildId = (value) => typeof value === 'string' && BUILD_ID.test(value) ? value : null;
const closedValue = (value, values) => values.has(value) ? value : null;

function projectResult(run) {
  const result = object(run.result) ? run.result : null;
  const checks = object(result?.checks) ? Object.values(result.checks) : null;
  const booleanChecks = checks && checks.length <= 32 && checks.every((value) => typeof value === 'boolean')
    ? checks : null;
  return {
    protocolId: closedValue(run.protocolId, PROTOCOL_IDS) || closedValue(result?.protocol, PROTOCOL_IDS),
    verdictScope: closedValue(result?.verdictScope, VERDICT_SCOPES),
    buildId: buildId(result?.buildId),
    artifactBuildId: buildId(result?.artifact?.buildId),
    liveBuildId: buildId(result?.readiness?.artifactRuntimeIdentity?.buildId),
    publishedBuildId: buildId(result?.publishedBuildId),
    activationAction: closedValue(result?.activationAction, ACTIVATION_ACTIONS),
    runtimeReadyProved: boolean(result?.runtimeReadyProved),
    runtimeReady: boolean(result?.readiness?.runtimeReady),
    captureCount: arrayCount(result?.captures),
    observedPhaseCount: arrayCount(result?.observedPhases),
    runCount: count(result?.runCount),
    controlCount: count(result?.controlCount),
    checkCount: booleanChecks ? booleanChecks.length : null,
    passedCheckCount: booleanChecks ? booleanChecks.filter(Boolean).length : null,
    productionGateExpected: boolean(result?.productionGateExpected),
    manualGateExpected: boolean(result?.manualGateExpected),
    browserProcessPreserved: boolean(result?.browserProcessPreserved),
  };
}

function projectEvidenceContract(run) {
  if (!Object.hasOwn(run, 'evidenceContract')) return { status: 'legacy_unknown', reportRequired: null };
  if (!object(run.evidenceContract) || typeof run.evidenceContract.reportRequired !== 'boolean') {
    return { status: 'invalid', reportRequired: null };
  }
  return { status: 'recorded', reportRequired: run.evidenceContract.reportRequired };
}

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

async function plainDirectory(directory) {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('QA_REPORT_UNSAFE_PATH');
}

async function readJson(runRoot, relativePath) {
  const segments = relativePath.split('/');
  let current = runRoot;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    await plainDirectory(current);
  }
  const filePath = path.join(runRoot, ...segments);
  const stat = await fs.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('QA_REPORT_UNSAFE_PATH');
  if (stat.size > MAX_JSON_BYTES) fail('QA_REPORT_EVIDENCE_TOO_LARGE');
  let value;
  try {
    value = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) fail('QA_REPORT_JSON_INVALID');
    throw error;
  }
  return { value, filePath };
}

// A preserved run may still name its former checkout. Only its exact run suffix
// is relocated; the reader never follows that original path or searches for files.
function attachmentRelativePath(reference, runId) {
  if (typeof reference !== 'string' || reference.length > 4096 || /[\u0000-\u001f]/u.test(reference)) fail('QA_REPORT_REFERENCE_INVALID');
  const normalized = reference.replaceAll('\\', '/');
  if (/^(?:[A-Za-z][A-Za-z0-9+.-]*:)?\/\//u.test(normalized)
    || (normalized.includes(':') && !/^[A-Za-z]:\//u.test(normalized))) fail('QA_REPORT_REFERENCE_INVALID');
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) fail('QA_REPORT_REFERENCE_INVALID');
  const marker = `.artifacts/qa/runs/${runId}/`;
  const markerIndex = normalized.indexOf(marker);
  let relative = normalized;
  if (markerIndex !== -1) {
    if ((markerIndex > 0 && normalized[markerIndex - 1] !== '/')
      || normalized.indexOf(marker, markerIndex + marker.length) !== -1) fail('QA_REPORT_REFERENCE_INVALID');
    relative = normalized.slice(markerIndex + marker.length);
  }
  if (!/^attachments\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.json$/u.test(relative)) {
    fail('QA_REPORT_REFERENCE_INVALID');
  }
  return relative;
}

function addIssue(summary, code, source) {
  if (!summary.coverageIssues.some((issue) => issue.code === code && issue.source === source)) {
    summary.coverageIssues.push({ code, source });
  }
}

function projectFrame(summary, source, snapshot) {
  if (!object(snapshot)) return;
  const frame = {
    source,
    phase: token(snapshot.phase),
    degraded: boolean(snapshot.degraded),
    firstFrameReady: boolean(snapshot.mainTabFirstFrameReady),
    firstFrameDegraded: boolean(snapshot.mainTabFirstFrameDegraded),
    shellDismissed: boolean(snapshot.shellDismissed),
    errorCount: arrayCount(snapshot.errors),
  };
  summary.dashboardFrames.push(frame);
  if (frame.degraded === true || frame.firstFrameDegraded === true) addIssue(summary, 'FIRST_FRAME_DEGRADED', source);
  if (frame.firstFrameReady === false) addIssue(summary, 'FIRST_FRAME_NOT_READY', source);
}

function projectMeasurement(summary, name, measurement) {
  if (!object(measurement)) return;
  const projected = {
    name,
    sampleCount: count(measurement.sampleCount),
    validSampleCount: count(measurement.validSampleCount),
    invalidSampleCount: count(measurement.invalidSampleCount),
    failedSampleCount: count(measurement.failedSampleCount),
    sampleClass: token(measurement.sampleClass),
    thresholdEligible: boolean(measurement.thresholdEligible),
    releaseThresholdEligible: boolean(measurement.releaseThresholdEligible),
    thresholdSampleFloor: count(measurement.thresholdSampleFloor),
    coldP50Ms: number(measurement.summary?.cold?.p50Ms),
    warmP50Ms: number(measurement.summary?.warm?.p50Ms),
    coldDurationMs: number(measurement.coldDurationMs),
    warmMedianDurationMs: number(measurement.warmMedianDurationMs),
  };
  summary.measurements.push(projected);
  if (projected.sampleClass === 'exploratory') addIssue(summary, 'MEASUREMENT_EXPLORATORY', name);
  if (projected.thresholdEligible === false || projected.releaseThresholdEligible === false) {
    addIssue(summary, 'MEASUREMENT_THRESHOLD_INELIGIBLE', name);
  }
  if (projected.invalidSampleCount > 0 || projected.failedSampleCount > 0) addIssue(summary, 'MEASUREMENT_INVALID_SAMPLES', name);
}

function projectLogs(summary, source, diagnostics, chromeStderr) {
  const targets = Array.isArray(diagnostics?.targets) ? diagnostics.targets.slice(0, MAX_SAMPLES) : null;
  const groups = targets
    ? targets.map((target) => target?.entries).filter(Array.isArray)
    : Array.isArray(diagnostics?.consoleMessages) ? [diagnostics.consoleMessages] : [];
  if (groups.length === 0 && !object(diagnostics) && !Array.isArray(chromeStderr)) return;
  const entries = groups.flatMap((group) => group.slice(0, MAX_LOG_ENTRIES)).slice(0, MAX_LOG_ENTRIES);
  const knownEntries = groups.length > 0;
  const level = (entry) => entry?.level || entry?.type;
  const projected = {
    source,
    entryCount: knownEntries ? groups.reduce((total, group) => total + group.length, 0) : null,
    errorCount: knownEntries ? entries.filter((entry) => ['error', 'diagnostic_serialization_error'].includes(level(entry))).length : null,
    warningCount: knownEntries ? entries.filter((entry) => ['warn', 'warning'].includes(level(entry))).length : null,
    cspCount: knownEntries ? entries.filter((entry) => {
      const text = typeof entry?.text === 'string' ? entry.text : typeof entry?.message === 'string' ? entry.message : '';
      return /Content Security Policy|Fetch API cannot load|violates.*CSP/iu.test(text.slice(0, 4096));
    }).length : null,
    runtimeExceptionCount: arrayCount(diagnostics?.runtimeExceptions),
    networkFailureCount: arrayCount(diagnostics?.networkFailures),
    chromeStderrCount: arrayCount(chromeStderr),
    droppedEntryCount: targets && targets.every((target) => count(target?.droppedEntryCount) !== null)
      ? targets.reduce((total, target) => total + target.droppedEntryCount, 0) : null,
    collectorErrorCount: arrayCount(diagnostics?.collectorErrors),
    bounded: groups.reduce((total, group) => total + group.length, 0) > MAX_LOG_ENTRIES
      || (Array.isArray(diagnostics?.targets) && diagnostics.targets.length > MAX_SAMPLES),
  };
  summary.logs.push(projected);
  if (projected.bounded) addIssue(summary, 'LOG_COUNTS_BOUNDED', source);
  if (projected.collectorErrorCount > 0) addIssue(summary, 'LOG_COLLECTOR_ERRORS', source);
}

function projectReport(summary, source, report) {
  if (!object(report)) {
    addIssue(summary, 'REPORT_OBJECT_INVALID', source);
    return;
  }
  const dashboard = report.scenarios?.lifecycle?.dashboardColdReload;
  projectFrame(summary, `${source}:initial`, dashboard?.initialSnapshot);
  projectFrame(summary, `${source}:reload`, dashboard?.reloadedSnapshot);
  projectFrame(summary, `${source}:page`, report.page?.boot?.snapshot);
  projectFrame(summary, `${source}:ready`, report.readySnapshot?.boot?.snapshot);
  projectFrame(summary, `${source}:final`, report.finalSnapshot?.boot?.snapshot);
  projectMeasurement(summary, `${source}:visual-first-frame`, dashboard?.visualFirstFrameMeasurement);
  projectMeasurement(summary, `${source}:worker-wake`, report.scenarios?.lifecycle?.workerWakeMeasurement);
  if (Array.isArray(report.samples) && object(report.summary)) {
    projectMeasurement(summary, `${source}:dashboard-boot`, report.summary);
    report.samples.slice(0, MAX_SAMPLES).forEach((sample, index) => {
      projectFrame(summary, `${source}:sample-${index + 1}`, sample?.page?.boot?.snapshot);
    });
    if (report.samples.length > MAX_SAMPLES) addIssue(summary, 'FRAME_SUMMARY_BOUNDED', source);
  }
  projectLogs(summary, `${source}:service-worker`, report.diagnostics?.serviceWorker);
  projectLogs(summary, `${source}:worker-revival`, report.scenarios?.lifecycle?.workerRevival?.workerDiagnostics);
  const pageDiagnostics = object(report.pageDiagnostics) ? report.pageDiagnostics
    : object(report.diagnostics) && !object(report.diagnostics.serviceWorker) ? report.diagnostics : null;
  projectLogs(summary, `${source}:page`, pageDiagnostics, report.chromeStderr);
  if (report.chrome?.graphics) {
    summary.browser.hardwareActive = boolean(report.chrome.graphics.hardwareActive);
    summary.browser.webgl = token(report.chrome.graphics.featureStatus?.webgl);
  }
  if (Array.isArray(report.failures) && report.failures.length > 0) addIssue(summary, 'REPORT_RECORDED_FAILURES', source);
  if (object(report.health) && report.health.status !== 'clean') addIssue(summary, 'DASHBOARD_HEALTH_NOT_CLEAN', source);
  if (summary.status === 'PASS' && report.status === 'failed') addIssue(summary, 'REPORT_STATUS_MISMATCH', source);
}

async function optionalJson(summary, runRoot, relativePath, source) {
  try {
    return await readJson(runRoot, relativePath);
  } catch (error) {
    addIssue(summary, error?.code === 'ENOENT' ? 'EVIDENCE_MISSING' : token(error?.code) || 'EVIDENCE_INVALID', source);
    return null;
  }
}

async function readEventReferences(summary, runRoot) {
  const references = [];
  try {
    const filePath = path.join(runRoot, 'events.jsonl');
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('QA_REPORT_UNSAFE_PATH');
    summary.evidencePaths.events = filePath;
    if (stat.size > MAX_EVENT_BYTES) {
      addIssue(summary, 'EVENT_REFERENCES_BOUNDED', 'events');
      return references;
    }
    const lines = (await fs.readFile(filePath, 'utf8')).split('\n').filter((line) => line.trim());
    for (const line of lines.slice(-256)) {
      const event = JSON.parse(line);
      if (event?.runId !== summary.runId) {
        addIssue(summary, 'EVENT_RUN_ID_MISMATCH', 'events');
        continue;
      }
      if (!/^QA_DASHBOARD_(?:BOOT|CAPTURE)_(?:FINISHED|FAILED)$/u.test(event.type)) continue;
      for (const key of REPORT_KEYS) {
        if (object(event.payload) && event.payload[key] !== undefined && event.payload[key] !== null) {
          references.push({ key, reference: event.payload[key] });
        }
      }
    }
    if (lines.length > 256) addIssue(summary, 'EVENT_REFERENCES_BOUNDED', 'events');
  } catch (error) {
    if (error?.code !== 'ENOENT') addIssue(summary, token(error?.code) || 'EVENT_EVIDENCE_INVALID', 'events');
  }
  return references;
}

export async function readQaRunReport({ rootDir, runId } = {}) {
  if (typeof rootDir !== 'string' || !path.isAbsolute(rootDir)) fail('QA_REPORT_ROOT_ABSOLUTE_REQUIRED');
  if (typeof runId !== 'string' || !RUN_ID.test(runId)) fail('QA_REPORT_RUN_ID_INVALID');
  let runRoot = path.resolve(rootDir);
  try {
    await plainDirectory(runRoot);
    if (path.relative(await fs.realpath(runRoot), runRoot) !== '') fail('QA_REPORT_UNSAFE_PATH');
    for (const segment of ['.artifacts', 'qa', 'runs', runId]) {
      runRoot = path.join(runRoot, segment);
      await plainDirectory(runRoot);
    }
  } catch (error) {
    if (error?.code === 'ENOENT') fail('QA_REPORT_RUN_NOT_FOUND');
    throw error;
  }
  let envelope;
  try {
    envelope = await readJson(runRoot, 'run.json');
  } catch (error) {
    if (error?.code === 'ENOENT') fail('QA_REPORT_RUN_NOT_FOUND');
    throw error;
  }
  const run = envelope.value;
  if (!object(run) || ![1, 2].includes(run.contractVersion) || run.runId !== runId
    || typeof run.targetId !== 'string' || run.targetId.length > 160 || !TARGET_ID.test(run.targetId) || !STATUSES.has(run.status)) {
    fail('QA_REPORT_RUN_ENVELOPE_INVALID');
  }
  const summary = {
    contractVersion: 1,
    runId,
    targetId: run.targetId,
    mode: token(run.mode),
    status: run.status,
    durationMs: number(run.durationMs),
    resultSummary: projectResult(run),
    evidenceContract: projectEvidenceContract(run),
    browser: { headless: boolean(run.browserExecution?.headless), hardwareActive: null, webgl: null },
    cleanup: { status: 'unknown', entryCount: null, releasedCount: null, failedCount: null, journalComplete: null, activeProcessCount: null },
    dashboardFrames: [],
    measurements: [],
    logs: [],
    coverageIssues: [],
    evidencePaths: { run: envelope.filePath, cleanup: null, journal: null, events: null, attachments: [] },
  };
  const cleanup = await optionalJson(summary, runRoot, 'cleanup.json', 'cleanup');
  if (cleanup) {
    summary.evidencePaths.cleanup = cleanup.filePath;
    if (Array.isArray(cleanup.value) && cleanup.value.every((entry) => object(entry)
      && typeof entry.id === 'string' && entry.id.length > 0 && ['released', 'failed'].includes(entry.status))) {
      summary.cleanup.entryCount = cleanup.value.length;
      summary.cleanup.releasedCount = cleanup.value.filter((entry) => entry.status === 'released').length;
      summary.cleanup.failedCount = cleanup.value.filter((entry) => entry.status === 'failed').length;
      summary.cleanup.status = summary.cleanup.failedCount === 0 ? 'complete' : 'incomplete';
      if (summary.cleanup.status === 'incomplete') addIssue(summary, 'CLEANUP_INCOMPLETE', 'cleanup');
      if (Array.isArray(run.cleanup) && JSON.stringify(run.cleanup.map((entry) => [entry?.id, entry?.status]))
        !== JSON.stringify(cleanup.value.map((entry) => [entry.id, entry.status]))) addIssue(summary, 'CLEANUP_ENVELOPE_MISMATCH', 'cleanup');
    } else addIssue(summary, 'CLEANUP_INVALID', 'cleanup');
  }
  // The journal is supplementary: older envelopes may legitimately omit it.
  try {
    const journal = await readJson(runRoot, 'recovery-journal.json');
    if (!object(journal.value) || journal.value.runId !== runId) fail('QA_REPORT_JOURNAL_INVALID');
    summary.evidencePaths.journal = journal.filePath;
    summary.cleanup.journalComplete = boolean(journal.value.cleanupComplete);
    if (journal.value.state && !['terminal', 'recovered'].includes(journal.value.state)) addIssue(summary, 'JOURNAL_NOT_TERMINAL', 'journal');
    if (journal.value.state === 'recovered' && journal.value.recovery?.status === 'RECOVERED') {
      summary.cleanup.recoveryStatus = 'RECOVERED';
    }
    const jobs = journal.value.childJobs;
    if (Array.isArray(jobs) && jobs.length > 0 && jobs.every((job) => count(job?.receipt?.activeProcessCount) !== null)) {
      summary.cleanup.activeProcessCount = jobs.reduce((total, job) => total + job.receipt.activeProcessCount, 0);
    }
    if (summary.cleanup.journalComplete === false || summary.cleanup.activeProcessCount > 0) {
      summary.cleanup.status = 'incomplete';
      addIssue(summary, 'JOURNAL_CLEANUP_INCOMPLETE', 'journal');
    }
    if (journal.value.terminalStatus && journal.value.terminalStatus !== run.status) addIssue(summary, 'JOURNAL_STATUS_MISMATCH', 'journal');
  } catch (error) {
    if (error?.code !== 'ENOENT') addIssue(summary, token(error?.code) || 'JOURNAL_INVALID', 'journal');
  }
  projectFrame(summary, 'run:final', run.result?.snapshot?.boot?.snapshot);
  const references = REPORT_KEYS.flatMap((key) => {
    const referencesForKey = [];
    for (const holder of [run.result, run.error?.diagnostic]) {
      if (object(holder) && holder[key] !== undefined && holder[key] !== null) referencesForKey.push({ key, reference: holder[key] });
    }
    return referencesForKey;
  });
  if (references.length === 0 && ['dashboard/boot', 'dashboard/capture'].includes(run.targetId)) {
    references.push(...await readEventReferences(summary, runRoot));
  }
  const seen = new Set();
  for (const { key, reference } of references) {
    let relative;
    try {
      relative = attachmentRelativePath(reference, runId);
    } catch {
      addIssue(summary, 'REFERENCE_INVALID', key);
      continue;
    }
    if (seen.has(relative)) continue;
    if (seen.size === 4) {
      addIssue(summary, 'REPORT_REFERENCES_BOUNDED', 'attachments');
      break;
    }
    seen.add(relative);
    const report = await optionalJson(summary, runRoot, relative, key);
    if (!report) continue;
    summary.evidencePaths.attachments.push(report.filePath);
    projectReport(summary, key, report.value);
  }
  if (references.length === 0 && summary.evidenceContract.reportRequired === true) {
    addIssue(summary, 'NO_REFERENCED_REPORT', 'attachments');
  }
  if (summary.evidenceContract.status === 'invalid') addIssue(summary, 'EVIDENCE_CONTRACT_INVALID', 'run');
  if (object(run.result) && run.result.status && run.result.status !== run.status) addIssue(summary, 'RESULT_STATUS_MISMATCH', 'run');
  return summary;
}

const display = (value) => value === null ? 'unknown' : String(value);

export function renderQaRunReport(summary) {
  const lines = [
    `${summary.targetId} ${summary.status} (${summary.runId})`,
    `Cleanup: ${summary.cleanup.status}; released ${display(summary.cleanup.releasedCount)}/${display(summary.cleanup.entryCount)}; active processes ${display(summary.cleanup.activeProcessCount)}`,
  ];
  const result = summary.resultSummary;
  if (result) {
    const identity = ['protocolId', 'verdictScope', 'buildId', 'artifactBuildId', 'liveBuildId', 'publishedBuildId']
      .filter((key) => result[key] !== null).map((key) => `${key}=${result[key]}`);
    if (identity.length > 0) lines.push(`Result: ${identity.join(', ')}`);
    const outcomes = ['activationAction', 'runtimeReadyProved', 'runtimeReady', 'captureCount', 'observedPhaseCount',
      'runCount', 'controlCount', 'checkCount', 'passedCheckCount', 'productionGateExpected', 'manualGateExpected', 'browserProcessPreserved']
      .filter((key) => result[key] !== null).map((key) => `${key}=${result[key]}`);
    if (outcomes.length > 0) lines.push(`Observed result: ${outcomes.join(', ')}`);
  }
  if (summary.evidenceContract?.status === 'legacy_unknown') lines.push('Evidence contract: legacy run; required report unknown');
  if (summary.cleanup.recoveryStatus) lines.push(`Recovery: ${summary.cleanup.recoveryStatus}; recorded verdict and cleanup remain historical`);
  for (const frame of summary.dashboardFrames) {
    lines.push(`First frame ${frame.source}: phase=${display(frame.phase)}, ready=${display(frame.firstFrameReady)}, degraded=${display(frame.degraded)}, frame degraded=${display(frame.firstFrameDegraded)}, shell dismissed=${display(frame.shellDismissed)}`);
  }
  for (const measurement of summary.measurements) {
    lines.push(`Measurement ${measurement.name}: samples=${display(measurement.sampleCount)}, valid=${display(measurement.validSampleCount)}, class=${display(measurement.sampleClass)}, threshold eligible=${display(measurement.thresholdEligible)}, release eligible=${display(measurement.releaseThresholdEligible)}`);
    const timings = ['coldP50Ms', 'warmP50Ms', 'coldDurationMs', 'warmMedianDurationMs']
      .filter((key) => measurement[key] !== null).map((key) => `${key}=${measurement[key]}`);
    if (timings.length > 0) lines.push(`  Recorded timing: ${timings.join(', ')}`);
  }
  for (const log of summary.logs) {
    lines.push(`Logs ${log.source}: errors=${display(log.errorCount)}, warnings=${display(log.warningCount)}, CSP=${display(log.cspCount)}, browser stderr=${display(log.chromeStderrCount)}${log.bounded ? ' (bounded counts)' : ''}`);
  }
  if (summary.coverageIssues.length > 0) lines.push(`Coverage: ${summary.coverageIssues.map((issue) => `${issue.code} [${issue.source}]`).join('; ')}`);
  lines.push(`Evidence: ${[summary.evidencePaths.run, summary.evidencePaths.cleanup, summary.evidencePaths.journal, summary.evidencePaths.events, ...summary.evidencePaths.attachments].filter(Boolean).join(', ')}`);
  return `${lines.join('\n')}\n`;
}
