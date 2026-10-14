import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const model = 'src/domains/behavior/consumption/consumptionMemoryModel.js';
const level = 'src/domains/protection/domain/shishiConsumptionLevel.js';
const candidates = new Set([model, level]);
const modelReaders = new Set([
  level,
  'src/domains/behavior/consumption/ConsumptionMemoryService.js',
  'src/domains/protection/background/ProtectionRuntimeInputProvider.js',
  'src/platform/storage/model/ConsumptionMemoryCheckpointContract.js',
]);
const intensityReaders = new Set([
  'src/domains/protection/background/ProtectionRuntimeInputAssembler.js',
  'src/domains/protection/background/GateInterstitialController.js',
  'src/domains/protection/background/automation/gateQaAutomationContract.dev.js',
  'src/platform/storage/runtime/GateInterventionSessionRepository.js',
  'src/apps/gate/gateShishiRitual.js',
]);
async function walk(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => entry.isDirectory()
    ? walk(path.join(folder, entry.name)) : [path.join(folder, entry.name)]))).flat();
}
const failures = [];
for (const absolute of await walk(path.join(root, 'src'))) {
  if (!/\.[cm]?[jt]sx?$/.test(absolute)) continue;
  const file = path.relative(root, absolute).replaceAll('\\', '/');
  const source = await fs.readFile(absolute, 'utf8');
  const imports = [...source.matchAll(/(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)];
  for (const [, target] of imports) {
    const resolved = path.relative(root, path.resolve(path.dirname(absolute), target)).replaceAll('\\', '/');
    if (resolved === model && !modelReaders.has(file)) failures.push(`${file} imports model outside its declared writer/read-contract seams`);
    if (resolved === level && !intensityReaders.has(file)) failures.push(`${file} imports intensity outside its declared selection/session/physics seams`);
    if (resolved === level && file !== 'src/domains/protection/background/ProtectionRuntimeInputAssembler.js'
      && /\b(selectShishiConsumptionLevel|projectShishiConsumptionLevel)\s*\(/.test(source)) {
      failures.push(`${file} reselects intensity outside the input assembler`);
    }
    if (resolved.startsWith('scripts/dev/consumption-memory-evaluation/')) failures.push(`${file} imports offline evaluation ${resolved}`);
  }
  if (candidates.has(file)) {
    for (const token of ['Date.now(', 'setTimeout(', 'setInterval(', 'chrome.', 'localStorage', 'platform/storage/', 'addEventListener(', 'getInterventionAdmissionService']) {
      if (source.includes(token)) failures.push(`${file} owns forbidden side effect ${token}`);
    }
  }
}
const service = await fs.readFile(path.join(root, 'src/domains/behavior/consumption/ConsumptionMemoryService.js'), 'utf8');
for (const token of ['setTimeout(', 'setInterval(', 'chrome.', 'localStorage', 'Date.now(']) {
  if (service.includes(token)) failures.push(`ConsumptionMemoryService adds another clock or storage/browser owner: ${token}`);
}
const observe = service.slice(service.indexOf('  async function observe('), service.indexOf('  function getSnapshot('));
if (observe.includes('beginExposureRecording(')) failures.push('Observation inside a stats batch cannot wait on the admission mutation lane');
const read = service.slice(service.indexOf('  function getSnapshot('), service.indexOf('  async function reset('));
if (/repository\.|await |observe\(/.test(read)) failures.push('Runtime memory reads must be warm and side-effect free');
const tracker = await fs.readFile(path.join(root, 'src/domains/tracking/background/TabTimeTracker.js'), 'utf8');
const batch = tracker.slice(tracker.indexOf('    async function trackAllTabsBatch('), tracker.indexOf('    recordActiveTabDurationRef ='));
if (/await\s+consumptionLedger\.runAfterFacts|await\s+memoryCompletion/.test(batch)) {
  failures.push('Tracking source batches cannot await descriptive model completion');
}
const ledger = await fs.readFile(path.join(root, 'src/domains/tracking/background/TrackingConsumptionLedger.js'), 'utf8');
if (!ledger.includes('await Promise.all([tail, postFactTail])')) failures.push('Tracking profile drain must include source and model work');
for (const token of ["pending.resolve({ status: 'coalesced'", 'pending = null;', 'function resetAfterFacts(', 'postFactTail = pump()']) {
  if (!ledger.includes(token)) failures.push(`Tracking must bound observations and preserve the reset barrier: ${token}`);
}
for (const token of ['exposure.settledThroughAt', 'policyEvidence', 'advanceConsumptionPolicyEvidence']) {
  if (!observe.includes(token)) failures.push(`Model commit must retain settled evidence and uncertainty: ${token}`);
}
const controller = await fs.readFile(path.join(root, 'src/domains/protection/background/GateInterstitialController.js'), 'utf8');
if (!controller.includes('requireShishiConsumptionLevel(existingSession.metrics.shishiIntensity)')) failures.push('A reused Gate session must retain its frozen intensity');
if (!controller.includes('requireShishiConsumptionLevel(payload.metrics?.shishiIntensity)')
  || controller.includes('session_without_adaptive_input')) failures.push('New entry sessions must reject missing intensity proposals');
const physics = await fs.readFile(path.join(root, 'src/apps/gate/gateShishiRitual.js'), 'utf8');
if (!physics.includes("session.gateKind !== 'entryCheckpoint'") || !physics.includes('GATE_SHISHI_WAIT_MS + intensity.waitExtensionMs')) failures.push('Only the canonical entry foreground wait may consume intensity');
const geometry = await fs.readFile(path.join(root, 'src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiGeometry.js'), 'utf8');
if (/\bimport\b|Date\.now\(|setTimeout\(|setInterval\(/.test(geometry.replace(/\/\/[^\n]*/g, ''))) failures.push('Shared Shishi geometry must remain dependency-free');
const join = await fs.readFile(path.join(root, 'src/domains/behavior/consumption/consumptionObservedIntervals.js'), 'utf8');
if (!join.includes('from >= admittedSince')) failures.push('All interval evidence requires continuous collection admission');
if (failures.length) {
  console.error(`[consumption-memory-boundary] FAIL: ${failures.join('; ')}`);
  process.exitCode = 1;
} else console.log('[consumption-memory-boundary] PASS: bounded Tracking model, settled evidence, one frozen entry-intensity policy and warm reads.');
