import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const outputDir = path.join(root, '.artifacts', 'flow-use-journeys');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
const rawPath = path.join(outputDir, `${runId}.json`);
let before = null;
const text = (value) => String(value).replace(/[|\r\n]/g, ' ');
const seconds = (value) => value === null ? 'unobserved' : (value / 1000).toFixed(2);
async function publish(report, markdown) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'report.md'), markdown);
}
try {
  await publish({ version: 1, execution: 'invalid', reason: 'run_in_progress', runId },
    '# Usage journey evaluation\n\nExecution: **invalid** (run in progress).\n');
  const { snapshotFlowMeasuredSources, assertFlowMeasuredSourcesUnchanged } = await import('./flowMeasuredPressureSources.mjs');
  before = await snapshotFlowMeasuredSources(root);
  const nodeVersion = (await readFile(path.join(root, '.nvmrc'), 'utf8')).trim().replace(/^v/, '');
  if (process.versions.node !== nodeVersion) throw new Error('FLOW_USE_JOURNEY_NODE_VERSION_MISMATCH');
  const { createFlowUseJourneyCorpus } = await import('./flowUseJourneyScenarios.mjs');
  const corpus = createFlowUseJourneyCorpus();
  const child = await new Promise((resolve, reject) => {
    const childProcess = spawn(process.execPath, [path.join(root, 'scripts/dev/run-local-command.mjs'),
      'vitest', 'run', 'tests/flowUseJourneyIntegration.test.js'], { cwd: root, shell: false, stdio: 'inherit',
      env: { ...process.env, FLOW_USE_JOURNEY_REPORT_PATH: rawPath } });
    childProcess.once('error', reject); childProcess.once('close', (code, signal) => resolve({ code, signal }));
  });
  if (child.code !== 0 || child.signal !== null) throw new Error(`FLOW_USE_JOURNEY_CHILD_FAILED:${JSON.stringify(child)}`);
  const raw = JSON.parse(await readFile(rawPath, 'utf8'));
  if (raw.version !== 1 || raw.execution !== 'valid' || raw.authority !== corpus.authority
    || raw.scenarios.length !== corpus.scenarios.length || raw.relations.length !== corpus.relations.length
    || new Set(raw.scenarios.map((s) => s.id)).size !== corpus.scenarios.length
    || corpus.scenarios.some((s) => !raw.scenarios.some((r) => r.id === s.id && r.execution === 'valid')))
    throw new Error('FLOW_USE_JOURNEY_REPORT_INVALID');
  const { assessFlowUseJourney, assessFlowUseJourneyRelations } = await import('./flowUseJourneyEvaluation.mjs');
  for (const scenario of raw.scenarios) {
    const expected = corpus.scenarios.find((s) => s.id === scenario.id).expected;
    if (JSON.stringify(scenario.assessment) !== JSON.stringify(assessFlowUseJourney(scenario, expected))) {
      throw new Error('FLOW_USE_JOURNEY_ASSESSMENT_MISMATCH');
    }
  }
  if (JSON.stringify(raw.relations) !== JSON.stringify(assessFlowUseJourneyRelations(raw.scenarios, corpus.relations)))
    throw new Error('FLOW_USE_JOURNEY_RELATIONS_MISMATCH');
  await assertFlowMeasuredSourcesUnchanged(root, before);
  const findings = raw.scenarios.filter((s) => s.assessment.preparation.status === 'finding').length;
  const relationFindings = raw.relations.filter((r) => r.status === 'finding').length;
  const report = { ...raw, generatedAt: new Date().toISOString(), runId,
    modelStatus: findings || relationFindings ? 'findings' : 'partial_capability',
    summary: { scenarios: raw.scenarios.length, preparationFindings: findings, relationFindings,
      admittedWithoutObservedEndpoint: raw.scenarios.filter((s) => s.assessment.delivery.status === 'endpoint_unobserved_after_admission').length,
      temporalInterpretationUnsupported: raw.scenarios.filter((s) => s.assessment.interpretation.status === 'unsupported').length },
    sourceSnapshot: { fileCount: before.files.length, ...before.scope }, sourceHashes: before.hashes,
    rawReport: path.relative(root, rawPath).split(path.sep).join('/') };
  const markdown = ['# Usage journey evaluation', '', `Execution: **valid**. Model status: **${report.modelStatus}**.`, '',
    'Product review windows are provisional hypotheses, not measured optimal timings. All actual production defaults remain unchanged. Temporal pattern output is unsupported, never counted as a classification pass.', '',
    '| Journey | Candidate s | Armed s | Opportunity s | Admission s | Endpoint s | Preparation review |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...raw.scenarios.map((s) => `| ${text(s.id)} | ${['candidate', 'armed', 'opportunityReady', 'admitted', 'endpointActive'].map((key) => seconds(s.assessment.first[key])).join(' | ')} | ${s.assessment.preparation.status}: ${s.assessment.preparation.reason} |`), '',
    'Preparation and delivery are distinct. The following are observation diagnostics, not extra fitted pass thresholds.', '',
    '| Journey | Delivery | Visible sampled coverage | Final sensor reason |',
    '| --- | --- | ---: | --- |',
    ...raw.scenarios.map((s) => {
      const sensor = s.assessment.observation.finalSensor;
      const observedVisibleMs = sensor.sampledCoverageMs + sensor.unavailableVisibleMs + sensor.unsupportedVisibleMs;
      const coverage = observedVisibleMs > 0 ? `${(100 * sensor.sampledCoverageMs / observedVisibleMs).toFixed(1)}%` : 'unavailable';
      return `| ${text(s.id)} | ${s.assessment.delivery.status} | ${coverage} | ${text(sensor.reason)} |`;
    }), '',
    ...raw.limitations.map((limit) => `- ${limit}`), '',
    ...raw.relations.map((r) => `- ${r.id}: ${r.status}.`), '',
    `Source inventory: ${before.files.length} inputs matched before child imports and after execution.`, '',
    `Run: ${runId}`, '',].join('\n');
  await publish(report, markdown);
  console.log(JSON.stringify({ execution: 'valid', modelStatus: report.modelStatus, ...report.summary, outputDir }));
  process.exitCode = findings || relationFindings ? 2 : 0;
} catch (error) {
  await publish({ version: 1, execution: 'invalid', runId, error: String(error), sourceHashes: before?.hashes ?? {} },
    `# Usage journey evaluation\n\nExecution: **invalid**.\n\n${text(error)}\n`);
  console.error(String(error)); process.exitCode = 1;
}
