import { QA_CHROMIUM_DAWN_EAGER_ARGUMENT } from '../../browser-qa/browser/chromiumGpuInfoCollectionArguments.mjs';

const HISTOGRAM_NAME = 'GPU.Dawn.InfoCollectionTimeMS';
const EAGER_SWITCH = QA_CHROMIUM_DAWN_EAGER_ARGUMENT;
const FORBIDDEN_SWITCHES = [
  '--no-delay-for-dx12-vulkan-info-collection',
  '--disable-gpu-process-for-dx12-info-collection',
  '--disable-gpu',
];

export function requireDashboardGpuInfoCollectionResearch(request, sampleCount) {
  const mode = request.gpuInfoCollection;
  if (!['off', 'browser-default', 'dawn-eager'].includes(mode)) {
    throw new Error('QA_BOOT_GPU_INFO_COLLECTION_MODE_INVALID');
  }
  if (mode !== 'off' && (request.themeId !== 'zen' || request.interaction !== 'none'
    || request.postRevealMs !== 120000 || request.environmentClock !== 'realtime'
    || request.zenMainProfile?.pondEffectProfile !== 'full'
    || request.cpuProfile || request.gpuTiming || sampleCount !== 1
    || request.canopyPreparation !== 'native' || request.traceMode !== 'marks'
    || !request.renderTrace || request.renderTraceProfile !== 'gpu-startup')) {
    throw new Error('QA_BOOT_GPU_INFO_COLLECTION_RESEARCH_SCENARIO_INVALID');
  }
  return mode;
}

export function projectDashboardDawnHistogram(raw) {
  if (!Array.isArray(raw?.histograms)) throw new Error('QA_BOOT_DAWN_HISTOGRAM_RESPONSE_INVALID');
  const rows = raw.histograms.filter(row => row.name === HISTOGRAM_NAME);
  if (rows.length > 1) throw new Error('QA_BOOT_DAWN_HISTOGRAM_DUPLICATE');
  if (!rows.length) return { name: HISTOGRAM_NAME, status: 'not_recorded', histogram: null,
    interpretation: 'No exact histogram currently visible; this does not prove collection did not execute.' };
  const row = rows[0];
  if (!Number.isSafeInteger(row.count) || row.count < 0 || !Number.isFinite(row.sum) || row.sum < 0
    || !Array.isArray(row.buckets) || row.buckets.length > 64
    || row.buckets.some(bucket => !Number.isSafeInteger(bucket.count) || bucket.count < 0
      || !Number.isFinite(bucket.low) || !Number.isFinite(bucket.high) || bucket.high < bucket.low)) {
    throw new Error('QA_BOOT_DAWN_HISTOGRAM_VALUES_INVALID');
  }
  return { name: HISTOGRAM_NAME, status: 'available', histogram: {
    name: row.name, count: row.count, sum: row.sum,
    buckets: row.buckets.map(({ low, high, count }) => ({ low, high, count })),
  }, interpretation: 'Browser-visible cumulative histogram; not an independently synchronized GPU-process timing trace.' };
}

export async function readDashboardGpuInfoCollectionEvidence(cdp, { checkpoint, policy }) {
  if (!['browser-default', 'dawn-eager'].includes(policy)) throw new Error('QA_BOOT_GPU_INFO_COLLECTION_POLICY_INVALID');
  if (!['before_fixture', 'after_observation'].includes(checkpoint)) throw new Error('QA_BOOT_GPU_INFO_COLLECTION_CHECKPOINT_INVALID');
  const result = await cdp.send('Browser.getBrowserCommandLine', {}, undefined, { timeoutMs: 5000 });
  if (!Array.isArray(result?.arguments) || result.arguments.some(arg => typeof arg !== 'string')) {
    throw new Error('QA_BOOT_GPU_INFO_COLLECTION_COMMAND_LINE_INVALID');
  }
  const matches = (argument, flag) => argument === flag || argument.startsWith(`${flag}=`);
  const eagerSwitches = result.arguments.filter(arg => matches(arg, EAGER_SWITCH));
  const forbiddenCount = result.arguments.filter(arg => FORBIDDEN_SWITCHES.some(flag => matches(arg, flag))).length;
  const expectedCount = policy === 'dawn-eager' ? 1 : 0;
  if (forbiddenCount || eagerSwitches.length !== expectedCount || eagerSwitches.some(arg => arg !== EAGER_SWITCH)) {
    throw new Error('QA_BOOT_GPU_INFO_COLLECTION_LIVE_ARGUMENTS_MISMATCH');
  }
  // Never retain the raw argv: it includes per-run private ownership tokens.
  const histogram = projectDashboardDawnHistogram(await cdp.send('Browser.getHistograms', {
    query: HISTOGRAM_NAME, delta: false,
  }, undefined, { timeoutMs: 5000 }));
  return { checkpoint, policy, observedAt: new Date().toISOString(), commandLine: {
    source: 'exact owned browser Browser.getBrowserCommandLine',
    eagerSwitchCount: eagerSwitches.length, conflictingSwitchCount: forbiddenCount,
    rawArgumentsRetained: false,
  }, ...histogram };
}
