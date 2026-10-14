import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const outputDir = path.join(root, '.artifacts', 'flow-model-comparison');
let sourceHashes = {};
const number = (value) => Number(value.toPrecision(7)).toString();

try {
  const { FLOW_COMPARISON_SOURCE_FILES } = await import('./flowEvaluationSources.mjs');
  const { readFlowEvaluationHashes, assertFlowEvaluationHashesUnchanged } = await import('./flowEvaluationSourceSnapshot.mjs');
  sourceHashes = await readFlowEvaluationHashes(root, FLOW_COMPARISON_SOURCE_FILES);
  const { createFlowModelCorpus } = await import('./flowModelScenarios.mjs');
  const { createFlowCandidateCorpus } = await import('./flowCandidateScenarios.mjs');
  const { replayCurrentFlowModel } = await import('./currentFlowModelReplay.mjs');
  const { FLOW_CANDIDATE_CONFIG,
    replayContinuousFlowCandidate, flowRecoveryTimeMs } = await import('./continuousFlowCandidate.mjs');
  const { createFlowComparisonCorpus, compareFlowCandidates } = await import('./compareFlowCandidates.mjs');
  const { auditFlowCandidateRecovery } = await import('./flowCandidateRecoveryAudit.mjs');

  const candidate = (id, role, variant, config) => ({ id, role, metric: 'pressure',
    unit: 'bounded_pressure_from_surface_native_units', upperBound: 1, config,
    replay: (trace) => replayContinuousFlowCandidate(trace, { variant, config }) });
  // A priori scale perturbations probe structural stability. This is not an
  // optimization grid: no winner, labels, or parameter update is computed.
  const configs = [
    ['mass_half', { ...FLOW_CANDIDATE_CONFIG, massScale: FLOW_CANDIDATE_CONFIG.massScale / 2 }],
    ['mass_double', { ...FLOW_CANDIDATE_CONFIG, massScale: FLOW_CANDIDATE_CONFIG.massScale * 2 }],
    ['recovery_half', { ...FLOW_CANDIDATE_CONFIG, recoveryMs: FLOW_CANDIDATE_CONFIG.recoveryMs / 2 }],
    ['recovery_double', { ...FLOW_CANDIDATE_CONFIG, recoveryMs: FLOW_CANDIDATE_CONFIG.recoveryMs * 2 }],
    ['curvature_half', { ...FLOW_CANDIDATE_CONFIG, curvature: FLOW_CANDIDATE_CONFIG.curvature / 2 }],
    ['combined_offset', { massScale: 45, recoveryMs: 120_000, curvature: 0.35 }],
  ];
  const models = [
    { id: 'current_burst', role: 'reference', metric: 'episodeDose',
      unit: 'production_pace_weighted_episode_dose', upperBound: null,
      config: 'shipped_default_confirmed_boundary', replay: replayCurrentFlowModel },
    candidate('bounded_linear', 'control', 'bounded_linear', { ...FLOW_CANDIDATE_CONFIG, curvature: 0 }),
    candidate('convex_boundary_curvature', 'control', 'bounded_convex', { ...FLOW_CANDIDATE_CONFIG, curvature: 0.5 }),
    candidate('bounded_convex', 'candidate', 'bounded_convex', FLOW_CANDIDATE_CONFIG),
    ...configs.map(([id, config]) => candidate(`convex_${id}`, 'sensitivity', 'bounded_convex', config)),
  ];
  const baselineCorpus = createFlowModelCorpus();
  const challengeCorpus = createFlowCandidateCorpus();
  const corpus = createFlowComparisonCorpus(baselineCorpus, challengeCorpus, { challengeUse: 'reused_for_selection' });
  const result = compareFlowCandidates({ corpus, models });
  const recoveryAudits = models.filter((model) => model.role !== 'reference')
    .map((model) => ({ modelId: model.id, role: model.role, ...auditFlowCandidateRecovery(model.config) }));
  if (recoveryAudits.some((audit) => ['candidate', 'sensitivity'].includes(audit.role) && audit.status === 'review')) {
    result.status = 'candidate_findings';
  }
  const recovery = [0, 0.25, 0.5, 0.75, 1].map((pressure) => ({ pressure,
    linearMs: flowRecoveryTimeMs(pressure, { ...FLOW_CANDIDATE_CONFIG, curvature: 0 }),
    convexMs: flowRecoveryTimeMs(pressure, FLOW_CANDIDATE_CONFIG) }));
  await assertFlowEvaluationHashesUnchanged(root, sourceHashes);
  const report = { generatedAt: new Date().toISOString(), nodeVersion: process.version,
    sourceHashes, sourceSnapshot: 'matched_before_model_imports_and_after_evaluation', ...result, recovery, recoveryAudits,
    selection: { initialCurvature: 0.5, chosenCurvature: FLOW_CANDIDATE_CONFIG.curvature,
      reason: 'finite_continuous_drive_onset_slope; chosen value was already in the initial parameter set',
      initialSplit: { development: baselineCorpus.scenarios.length, heldOut: challengeCorpus.scenarios.length },
      challengeStatus: 'consumed_and_promoted_to_development' } };
  const selected = report.models.find((model) => model.role === 'candidate');
  const rebinning = selected.relations.filter((relation) => relation.dimension === 'temporal_rebinning');
  const markdown = [
    '# Continuous flow candidate comparison', '',
    `Generated: ${report.generatedAt} · ${report.nodeVersion}`, '',
    `Execution: **${report.execution}** · outcome: **${report.status}**`, '',
    `${report.summary.scenarios} fictional cases, ${report.summary.models} model/configuration combinations. The initial run separated ${report.selection.initialSplit.development} development and ${report.selection.initialSplit.heldOut} new mechanism cases. After structural review and selection, all ${report.summary.development} inspected cases are development evidence; ${report.summary.heldOut} remain unseen.`, '',
    '**This evaluates pressure memory, not intention classification or live intervention. Production behavior has not switched.**', '',
    '| Model | Satisfied relations | Invariant violations | Hypotheses for review | Unsupported | Diagnostic only | Persistent jump flags |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.models.map((model) => {
      const counts = model.summary.relationCounts;
      return `| ${model.id} | ${counts.satisfied} | ${counts.violated} | ${counts.review} | ${counts.unsupported} | ${counts.diagnostic} | ${model.summary.persistentJumpDiagnostics} |`;
    }), '',
    'These columns compare properties within each model. The reference dose and bounded pressure have different units; a smaller score is not a better classification.', '',
    `Primary candidate response sentinels: ${selected.responseSentinels.filter((sentinel) => sentinel.passed).length}/${selected.responseSentinels.length}. Positive movement, amount sensitivity, recovery and zero-feed input prevent a constant output from earning readiness.`, '',
    `Primary candidate has ${selected.summary.unrefinableProbeDiagnostics} local diagnostics with changed discrete event shapes; these were not refined or counted as continuity passes.`, '',
    '## Accumulation and recovery', '',
    'For confirmed native-unit mass m, pressure p changes by J(p,m)=1−(1−p)exp(−m/M). No count bonus or invented dwell is added. Simultaneous mass partitions compose to the same result.', '',
    'Recovery uses R(p)=p+γp², subtracts elapsed/τ, then inverts R. Intermediate clock reads compose to the same result. At zero there is no retained hidden debt. The linear control uses γ=0.', '',
    `Provisional reference configuration: M=${FLOW_CANDIDATE_CONFIG.massScale} native units, τ=${FLOW_CANDIDATE_CONFIG.recoveryMs / 1000}s, γ=${FLOW_CANDIDATE_CONFIG.curvature}. These are reviewable policy scales, not fitted behavioral constants.`, '',
    '| Starting pressure | Linear recovery to zero | Convex recovery to zero |',
    '| ---: | ---: | ---: |',
    ...recovery.map((row) => `| ${number(row.pressure)} | ${number(row.linearMs / 1000)} s | ${number(row.convexMs / 1000)} s |`), '',
    'The convex candidate takes more than twice as long to clear twice the pressure, while its total recovery duration remains bounded. Wall-memory aging is not evidence that a person rested.', '',
    '## Structural review and recursive revision', '',
    'The first curvature 0.5 has a square-root onset in the idealized continuous-drive equilibrium. It is continuous but has unbounded right slope at onset. The chosen 0.25 was already in the first sensitivity set; its right slope is finite (2). The original 0.5 remains a boundary control, with its finding visible.', '',
    '| Model | Continuous-drive onset | Audit |',
    '| --- | --- | --- |',
    ...recoveryAudits.map((audit) => `| ${audit.modelId} | ${audit.onsetClassification} | ${audit.status} |`), '',
    'This is a structural calculation about the proposed equations, not a measured critical human browsing speed. The challenge set has been consumed by review/selection and is not presented as unseen validation of the revised choice.', '',
    '## Different observation timing remains an open diagnostic', '',
    '| Analytic-path rebinning pair | Absolute terminal pressure difference |',
    '| --- | ---: |',
    ...rebinning.map((relation) => `| ${relation.id} | ${number(relation.terminalAbsoluteDifference)} |`), '',
    'Changing timestamp resolution loses within-interval timing. These pairs deliberately do not assert exact equality. The next integration step must state which temporal support the observer actually supplies.', '',
    '## Interpretation boundaries', '',
    ...report.limitations.map((limit) => `- ${limit}`), '',
    'Report JSON records source hashes, configuration values, split results, per-case endpoints, relation differences, and local refinements. No oracle prose is an automatically tested intent label.', '',
  ].join('\n');
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'report.md'), markdown);
  console.log(JSON.stringify({ execution: report.execution, status: report.status, ...report.summary,
    models: report.models.map((model) => ({ id: model.id, ...model.summary })), outputDir }, null, 2));
  process.exitCode = report.status === 'candidate_findings' ? 2 : 0;
} catch (error) {
  await mkdir(outputDir, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), execution: 'invalid', sourceHashes, error: String(error) };
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'report.md'), `# Continuous flow candidate comparison\n\nExecution: **invalid**.\n\n${String(error)}\n`);
  console.error(String(error));
  process.exitCode = 1;
}
