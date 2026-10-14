import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const outputDir = path.join(root, '.artifacts', 'flow-measured-pressure');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
const rawReportPath = path.join(outputDir, `${runId}.json`);
const args = [path.join(root, 'scripts', 'dev', 'run-local-command.mjs'),
  'vitest', 'run', 'tests/flowMeasuredPressureIntegration.test.js'];
let sourceSnapshot = null;
let childResult = null;

const fail = (detail) => { throw new Error(`FLOW_MEASURED_REPORT_INVALID:${detail}`); };
const text = (value) => String(value).replace(/[|\r\n]/g, ' ');
const number = (value) => Number(value.toPrecision(7)).toString();

function requireNumber(value, detail, maximum = Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) fail(detail);
}

function requireIds(actual, expected, detail) {
  if (!Array.isArray(actual) || actual.length !== expected.length) fail(`${detail}_count`);
  const ids = actual.map((item) => item?.id);
  if (new Set(ids).size !== ids.length || expected.some((item) => !ids.includes(item.id))) fail(`${detail}_ids`);
  if (actual.some((item) => item.status !== 'passed')) fail(`${detail}_status`);
}

function validateSegments(segments, detail) {
  if (!Array.isArray(segments) || segments.length === 0) fail(`${detail}_segments`);
  const keys = new Set();
  for (const segment of segments) {
    if (typeof segment.ownerId !== 'string' || !segment.ownerId.trim()
      || !Number.isSafeInteger(segment.epoch) || segment.epoch < 0) fail(`${detail}_identity`);
    const key = JSON.stringify([segment.ownerId, segment.epoch]);
    if (keys.has(key)) fail(`${detail}_duplicate_segment`);
    keys.add(key);
    requireNumber(segment.observedForwardUnits, `${detail}_forward_units`);
    requireNumber(segment.observedBackwardUnits, `${detail}_backward_units`);
    const terminal = segment.terminal;
    if (!terminal || typeof terminal !== 'object') fail(`${detail}_terminal`);
    requireNumber(terminal.at, `${detail}_terminal_time`);
    requireNumber(terminal.pressure, `${detail}_pressure`, 1);
    requireNumber(terminal.remainingRecoveryMs, `${detail}_recovery`);
  }
}

function validateJournalResult(result, reference, detail) {
  if (result?.version !== 1 || result.unit !== 'scroller_height_displacement'
    || result.source !== 'unknown' || result.itemTransitions !== null || result.measurementConfidence !== null
    || result.scope?.runtime !== 'evaluation_only_no_runtime_consumer'
    || result.scope?.entry !== 'retained_accepted_scroll_journal_no_aggregate_counter_fallback'
    || !Array.isArray(result.segments) || result.segments.length !== reference.segments.length
    || result.diagnostics?.missingEvents !== 0) fail(`${detail}_journal_contract`);
  for (const [index, segment] of result.segments.entries()) {
    const expected = reference.segments[index];
    if (segment.ownerId !== expected.ownerId || segment.epoch !== expected.epoch
      || segment.complete !== true || segment.status !== 'complete_retained_events'
      || segment.missingEvents !== 0 || segment.terminal?.retainedSuffixPressure !== null
      || segment.terminal?.retainedSuffixRemainingRecoveryMs !== null) fail(`${detail}_journal_segment`);
    requireNumber(segment.terminal.pressure, `${detail}_journal_pressure`, 1);
    requireNumber(segment.terminal.remainingRecoveryMs, `${detail}_journal_recovery`);
    for (const [key, counter] of [['knownForwardUnits', 'observedForwardUnits'], ['knownBackwardUnits', 'observedBackwardUnits']]) {
      requireNumber(segment[key], `${detail}_journal_${key}`);
      if (Math.abs(segment[key] - expected[counter]) > 1e-8) fail(`${detail}_journal_amount`);
    }
  }
}

function validateReport(report, corpus, encodingContract) {
  if (report?.version !== 1 || report.execution !== 'valid'
    || report.scope !== 'synthetic_dom_contract_evaluation_not_human_classification_or_browser_layout_qa') fail('execution');
  if (report.journalEncoding?.version !== encodingContract.version
    || report.journalEncoding?.format !== encodingContract.format) fail('journal_encoding');
  requireIds(report.scenarios, corpus.scenarios, 'scenarios');
  requireIds(report.relations, corpus.relations, 'relations');
  for (const scenario of report.scenarios) {
    const unsupported = ['consumptionTransitions', 'userAttribution', 'reading'];
    if (!Array.isArray(scenario.capabilityChecks) || scenario.capabilityChecks.length !== unsupported.length
      || new Set(scenario.capabilityChecks.map((entry) => entry.capability)).size !== unsupported.length
      || unsupported.some((capability) => !scenario.capabilityChecks.some((entry) => (
        entry.capability === capability && entry.status === 'unsupported'
      )))) fail(`${scenario.id}_unsupported_capabilities`);
    const result = scenario.result;
    if (!result || result.version !== 1 || result.unit !== 'scroller_height_displacement'
      || result.source !== 'unknown' || result.itemTransitions !== null
      || result.measurementConfidence !== null
      || result.scope?.runtime !== 'evaluation_only_no_runtime_consumer') fail(`${scenario.id}_scope`);
    validateSegments(result.segments, scenario.id);
    validateJournalResult(scenario.journalResult, result, scenario.id);
    const timing = scenario.timingComparison;
    if (!timing || timing.status !== 'diagnostic'
      || timing.convention !== 'previous_capture_edge') fail(`${scenario.id}_timing_scope`);
    validateSegments(timing.segments, `${scenario.id}_timing`);
    if (timing.segments.length !== result.segments.length || result.segments.some((segment, index) => (
      segment.ownerId !== timing.segments[index].ownerId || segment.epoch !== timing.segments[index].epoch
    ))) fail(`${scenario.id}_timing_segment_match`);
    const sensitivityIds = ['mass_half', 'mass_double', 'recovery_half', 'recovery_double'];
    if (!Array.isArray(scenario.sensitivity) || scenario.sensitivity.length !== sensitivityIds.length
      || new Set(scenario.sensitivity.map((entry) => entry.id)).size !== sensitivityIds.length
      || sensitivityIds.some((id) => !scenario.sensitivity.some((entry) => entry.id === id))) fail(`${scenario.id}_sensitivity`);
    for (const sensitivity of scenario.sensitivity) validateSegments(sensitivity.segments, `${scenario.id}_${sensitivity.id}`);
  }
  const partition = report.relations.find((relation) => relation.id === 'reader_partition');
  if (partition?.journalComparison?.status !== 'passed') fail('journal_reader_partition');
  requireIds(report.journalContracts, [{ id: 'producer_overflow_abstention' }], 'journal_contracts');
  const overflow = report.journalContracts[0];
  if (!Number.isSafeInteger(overflow.missingEvents) || overflow.missingEvents < 1
    || overflow.sparse?.pressure !== null || overflow.sparse?.remainingRecoveryMs !== null) fail('journal_overflow_abstention');
  requireNumber(overflow.dense?.pressure, 'journal_dense_pressure', 1);
  requireNumber(overflow.sparse?.retainedSuffixPressure, 'journal_suffix_diagnostic', 1);
}

async function runIntegration() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, shell: false, stdio: 'inherit',
      env: { ...process.env, FLOW_MEASURED_PRESSURE_REPORT_PATH: rawReportPath } });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
}

async function publish(report, markdown) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'report.md'), markdown);
}

function markdownFor(report) {
  const rows = report.scenarios.flatMap((scenario) => scenario.result.segments.map((segment, index) => {
    const alternative = scenario.timingComparison.segments[index];
    const difference = Math.abs(segment.terminal.pressure - alternative.terminal.pressure);
    const journal = scenario.journalResult.segments[index];
    return `| ${text(scenario.id)} | ${index + 1} | ${number(segment.observedForwardUnits)} | ${number(segment.observedBackwardUnits)} | ${number(segment.terminal.pressure)} | ${number(difference)} | ${number(journal.terminal.pressure)} |`;
  }));
  return ['# Measured displacement pressure evaluation', '',
    `Execution: **valid** · ${report.scenarios.length} synthetic scenarios · ${report.relations.length} observation relations.`, '',
    'Actual sensor/capture owners run against authored DOM, geometry and event timelines in jsdom. This is not browser paint, real-user validation, or intent-classification accuracy. The candidate remains evaluation-only.', '',
    '| Scenario | Independent segment | Forward units | Backward units | Counter pressure | Counter timing difference | Journal pressure |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |', ...rows, '',
    'Units are measured displacement divided by scroller height; source remains unknown. Backward units are diagnostic and add no candidate mass. Each owner/epoch segment starts independently; pressure is not summed across segments.', '',
    'Timing compares accounting-right-edge with previous-capture-edge placement. Differences show sensitivity to unobserved arrival timing; these are not guaranteed bounds or reconstructed events. Four predeclared mass/recovery scale variants are retained in JSON; no tuning winner is selected.', '',
    'The separate journal replay uses retained producer callback timestamps and sequence, never cumulative-counter catchup. Dense and sparse readers produce the same chronological curve when they retain every event after their common baseline. Callback time is not a claim about the exact physical motion time.', '',
    `Overflow contract: ${report.journalContracts[0].missingEvents} unread events were lost at capacity ${report.journalContracts[0].capacity}. Exact pressure and recovery are null; the retained suffix is only a separate zero-origin diagnostic. Journal completeness does not establish continuous measurement or attention.`, '',
    'JSON stores each journal record once per scenario/owner/sequence. Frame eventRange references preserve exactly the original retained windows, capture times and loss metadata; use decodeFlowMeasuredReport before replaying archived trace frames. Evaluation runs on the actual raw snapshots before this lossless report encoding.', '',
    '**Unsupported:** item-consumption transitions, user attribution, reading, and detector confidence. Visible-set changes are not item counts. Zero feed displacement is not a healthy-use or writing-intent classification.', '',
    'Observation relations:', '',
    ...report.relations.map((relation) => `- ${text(relation.id)}: ${text(relation.status)} (${text(relation.kind)}).`), '',
    `Source verification: ${report.sourceSnapshot.fileCount} files matched before child imports and after successful completion, including additions/deletions checks. The broad inventory covers src, scripts, tests, package/lock/toolchain and Vite/Vitest/CSS configuration; installed dependencies and host environment bytes are not hashed.`, '',
    `Run: ${report.runId} · ${report.nodeVersion} · ${report.generatedAt}`, '',
  ].join('\n');
}

try {
  // Replace an older success immediately; an interrupted or failed child must
  // never leave that result looking like the current execution's evidence.
  await publish({ version: 1, execution: 'invalid', reason: 'run_in_progress', runId },
    '# Measured displacement pressure evaluation\n\nExecution: **invalid** (run in progress).\n');
  const { snapshotFlowMeasuredSources, assertFlowMeasuredSourcesUnchanged } = await import('./flowMeasuredPressureSources.mjs');
  sourceSnapshot = await snapshotFlowMeasuredSources(root);
  const preferredNode = (await readFile(path.join(root, '.nvmrc'), 'utf8')).trim().replace(/^v/, '');
  if (process.versions.node !== preferredNode) throw new Error(`FLOW_MEASURED_NODE_VERSION_MISMATCH:${process.versions.node}:${preferredNode}`);
  // The corpus is import-free metadata; load it only after the source snapshot.
  const { createFlowMeasuredPressureCorpus } = await import('./flowMeasuredPressureScenarios.mjs');
  const { FLOW_MEASURED_JOURNAL_ENCODING } = await import('./flowMeasuredReportEncoding.mjs');
  const corpus = createFlowMeasuredPressureCorpus();
  childResult = await runIntegration();
  if (childResult.code !== 0 || childResult.signal !== null) throw new Error(`FLOW_MEASURED_CHILD_FAILED:${JSON.stringify(childResult)}`);
  const raw = JSON.parse(await readFile(rawReportPath, 'utf8'));
  validateReport(raw, corpus, FLOW_MEASURED_JOURNAL_ENCODING);
  await assertFlowMeasuredSourcesUnchanged(root, sourceSnapshot);
  const report = { ...raw, generatedAt: new Date().toISOString(), runId, nodeVersion: process.version,
    platform: process.platform, childResult, rawReport: path.relative(root, rawReportPath).split(path.sep).join('/'),
    sourceHashes: sourceSnapshot.hashes,
    sourceSnapshot: { status: 'matched_before_child_imports_and_after_successful_execution',
      fileCount: sourceSnapshot.files.length, ...sourceSnapshot.scope } };
  await publish(report, markdownFor(report));
  console.log(JSON.stringify({ execution: 'valid', scenarios: raw.scenarios.length,
    relations: raw.relations.length, sourceFiles: sourceSnapshot.files.length, outputDir }));
} catch (error) {
  const report = { version: 1, execution: 'invalid', generatedAt: new Date().toISOString(), runId,
    nodeVersion: process.version, childResult, rawReport: path.relative(root, rawReportPath).split(path.sep).join('/'),
    error: String(error), sourceHashes: sourceSnapshot?.hashes ?? {},
    sourceSnapshot: { status: 'not_verified', scope: sourceSnapshot?.scope ?? null },
    sourceChanges: { added: error?.addedFiles ?? [], removed: error?.removedFiles ?? [], changed: error?.changedFiles ?? [] } };
  await publish(report, `# Measured displacement pressure evaluation\n\nExecution: **invalid**.\n\n${text(error)}\n`);
  console.error(String(error));
  process.exitCode = 1;
}
