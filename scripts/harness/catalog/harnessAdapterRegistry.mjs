import {
  PROJECT_HARNESS_INTELLIGENCE_POLICY,
} from '../contracts/projectHarnessEnvelope.mjs';

const ADAPTER_MANIFESTS = Object.freeze([
  Object.freeze({
    contractVersion: 1,
    id: 'entropy-qa',
    title: 'Entropy QA control plane',
    operations: Object.freeze(['list', 'describe', 'plan', 'run']),
    intelligencePolicy: PROJECT_HARNESS_INTELLIGENCE_POLICY,
  }),
  Object.freeze({
    contractVersion: 1,
    id: 'zen-bonsai-morphology',
    title: 'Zen bonsai structural smoke, one deterministic loop',
    operations: Object.freeze(['list', 'describe', 'plan', 'run']),
    intelligencePolicy: PROJECT_HARNESS_INTELLIGENCE_POLICY,
  }),
  Object.freeze({
    contractVersion: 1,
    id: 'zen-bonsai-developmental',
    title: 'Zen bonsai developmental V10, one deterministic proposal',
    operations: Object.freeze(['list', 'describe', 'plan', 'run']),
    intelligencePolicy: PROJECT_HARNESS_INTELLIGENCE_POLICY,
  }),
]);

const ADAPTER_LOADERS = Object.freeze({
  'entropy-qa': async () => {
    const module = await import('../adapters/entropyQaHarnessAdapter.mjs');
    return module.entropyQaHarnessAdapter;
  },
  'zen-bonsai-morphology': async () => {
    const module = await import(
      '../adapters/zenBonsaiMorphologyHarnessAdapter.mjs'
    );
    return module.zenBonsaiMorphologyHarnessAdapter;
  },
  'zen-bonsai-developmental': async () => {
    const module = await import(
      '../adapters/zenBonsaiDevelopmentalHarnessAdapter.mjs'
    );
    return module.zenBonsaiDevelopmentalHarnessAdapter;
  },
});

export function listHarnessAdapters() {
  return [...ADAPTER_MANIFESTS];
}

export async function loadHarnessAdapter(adapterId) {
  const normalized = typeof adapterId === 'string' ? adapterId.trim() : '';
  const loader = ADAPTER_LOADERS[normalized];
  if (!loader) {
    throw new Error(`PROJECT_HARNESS_ADAPTER_UNKNOWN:${normalized || 'missing'}`);
  }
  const adapter = await loader();
  if (
    adapter?.id !== normalized
    || typeof adapter.list !== 'function'
    || typeof adapter.describe !== 'function'
    || typeof adapter.plan !== 'function'
    || typeof adapter.run !== 'function'
  ) {
    throw new Error(`PROJECT_HARNESS_ADAPTER_INVALID:${normalized}`);
  }
  return adapter;
}
