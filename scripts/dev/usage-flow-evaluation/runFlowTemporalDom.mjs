import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const outputDir = path.join(root, '.artifacts', 'flow-temporal-dom');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
const rawPath = path.join(outputDir, `${runId}.json`);
let before = null;
async function publish(report, markdown) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'report.md'), markdown);
}
try {
  await publish({ version: 1, execution: 'invalid', reason: 'run_in_progress', runId },
    '# Temporal DOM evaluation\n\nExecution: **invalid** (run in progress).\n');
  const { snapshotFlowMeasuredSources, assertFlowMeasuredSourcesUnchanged } = await import('./flowMeasuredPressureSources.mjs');
  before = await snapshotFlowMeasuredSources(root);
  const nodeVersion = (await readFile(path.join(root, '.nvmrc'), 'utf8')).trim().replace(/^v/, '');
  if (process.versions.node !== nodeVersion) throw new Error('TEMPORAL_DOM_NODE_VERSION_MISMATCH');
  const { createFlowTemporalDomCorpus, assessFlowTemporalDom } = await import('./flowTemporalDomScenarios.mjs');
  const corpus = createFlowTemporalDomCorpus();
  const child = await new Promise((resolve, reject) => {
    const childProcess = spawn(process.execPath, [path.join(root, 'scripts/dev/run-local-command.mjs'),
      'vitest', 'run', 'tests/flowTemporalDomIntegration.test.js', 'tests/flowTemporalDeclaredDomIntegration.test.js'], { cwd: root, shell: false, stdio: 'inherit',
      env: { ...process.env, FLOW_TEMPORAL_DOM_REPORT_PATH: rawPath } });
    childProcess.once('error', reject); childProcess.once('close', (code, signal) => resolve({ code, signal }));
  });
  if (child.code !== 0 || child.signal !== null) throw new Error(`TEMPORAL_DOM_CHILD_FAILED:${JSON.stringify(child)}`);
  const raw = JSON.parse(await readFile(rawPath, 'utf8'));
  if (raw.version !== 1 || raw.authority !== 'synthetic_dom_descriptive_evidence'
    || raw.scenarios.length !== corpus.length || new Set(raw.scenarios.map((s) => s.id)).size !== corpus.length)
    throw new Error('TEMPORAL_DOM_REPORT_INVALID');
  for (const scenario of corpus) {
    const actual = raw.scenarios.find((s) => s.id === scenario.id);
    if (!actual || JSON.stringify(actual.assessment) !== JSON.stringify(assessFlowTemporalDom(scenario, actual.output)))
      throw new Error('TEMPORAL_DOM_ASSESSMENT_MISMATCH');
  }
  await assertFlowMeasuredSourcesUnchanged(root, before);
  const findings = raw.scenarios.flatMap((s) => s.assessment).filter((check) => check.status === 'finding').length;
  const report = { ...raw, execution: 'valid', runId, generatedAt: new Date().toISOString(),
    summary: { scenarios: corpus.length, findings }, modelStatus: findings ? 'findings' : 'partial_capability',
    sourceSnapshot: { fileCount: before.files.length, ...before.scope }, sourceHashes: before.hashes,
    rawReport: path.relative(root, rawPath).split(path.sep).join('/'),
    limitations: ['synthetic_layout_not_browser_QA', 'descriptors_not_behavioral_accuracy',
      'input_source_unknown', 'no_runtime_interpretation_or_sites_consumer', 'editor_gate_default_off'] };
  await publish(report, ['# Temporal DOM evaluation', '', `Execution: **valid**. Findings: **${findings}**.`, '',
    'Actual capture/sampling owners with authored jsdom geometry. No label accuracy, optimal timing or live-browser PASS is inferred.', '',
    '| Scenario | Review | Forward screenfuls/s | Editor available | Geometry supported |',
    '| --- | --- | ---: | --- | --- |',
    ...raw.scenarios.map((s) => {
      const row = s.output.rows.at(-1);
      return `| ${s.id} | ${s.assessment.filter((c) => c.status === 'finding').map((c) => c.name).join(', ') || 'consistent'} | ${row.windows[0].observedForwardRate.toFixed(4)} | ${row.editorAvailable} | ${row.currentGeometrySupported} |`;
    }), '', `Source inventory: ${before.files.length} inputs matched before child imports and after execution.`, '', `Run: ${runId}`, '',].join('\n'));
  console.log(JSON.stringify({ execution: 'valid', ...report.summary, outputDir }));
  process.exitCode = findings ? 2 : 0;
} catch (error) {
  await publish({ version: 1, execution: 'invalid', runId, error: String(error), sourceHashes: before?.hashes ?? {} },
    `# Temporal DOM evaluation\n\nExecution: **invalid**.\n\n${String(error)}\n`);
  console.error(String(error)); process.exitCode = 1;
}
