import {
  BROWSER_PROCESS_OWNERSHIP,
  BROWSER_START_POLICIES,
  BROWSER_WEBGL_REQUIREMENTS,
  projectBrowserExecutionContract,
} from '../contracts/browserExecutionContract.mjs';

const CANONICAL_OWNER = 'scripts/browser-qa/browser/chromiumGpuInfoCollectionArguments.mjs';
export const QA_CHROMIUM_DAWN_EAGER_ARGUMENT = '--collect-dawn-info-eagerly';
const PROTECTED_COLLECTION_SWITCHES = new Set([
  'collect-dawn-info-eagerly',
  'no-delay-for-dx12-vulkan-info-collection',
  'disable-gpu-process-for-dx12-info-collection',
]);
const GPU_BACKEND_SWITCHES = new Set(['disable-gpu', 'use-gl', 'use-angle', 'enable-unsafe-swiftshader']);

export function requireQaChromiumGpuInfoCollectionPolicy(policy) {
  if (typeof policy !== 'string' || !['browser-default', 'dawn-eager'].includes(policy)) {
    throw new Error('QA_BROWSER_GPU_INFO_COLLECTION_POLICY_INVALID');
  }
  return policy;
}

export function resolveQaChromiumGpuInfoCollectionLaunch({
  args,
  policy = 'browser-default',
  executionContract = null,
  platform = process.platform,
} = {}) {
  requireQaChromiumGpuInfoCollectionPolicy(policy);
  if (!Array.isArray(args) || Array.from(args).some(argument => typeof argument !== 'string')) {
    throw new Error('QA_BROWSER_GPU_INFO_COLLECTION_ARGUMENTS_INVALID');
  }
  if (args.some(argument => PROTECTED_COLLECTION_SWITCHES.has(/^--([^=\s]+)(?:=|$)/u.exec(argument)?.[1]))) {
    throw new Error('QA_BROWSER_GPU_INFO_COLLECTION_ARGUMENT_CONFLICT');
  }
  const contract = executionContract === null ? null : projectBrowserExecutionContract(executionContract);
  if (policy === 'dawn-eager') {
    if (args.some(argument => GPU_BACKEND_SWITCHES.has(/^--([^=\s]+)(?:=|$)/u.exec(argument)?.[1]))) {
      throw new Error('QA_BROWSER_GPU_INFO_COLLECTION_GPU_BACKEND_CONFLICT');
    }
    if (!contract) throw new Error('QA_BROWSER_GPU_INFO_COLLECTION_EXECUTION_REQUIRED');
    if (contract.processOwnership !== BROWSER_PROCESS_OWNERSHIP.OWNED
      || contract.startPolicy !== BROWSER_START_POLICIES.AUTOMATIC) {
      throw new Error('QA_BROWSER_GPU_INFO_COLLECTION_OWNED_PROCESS_REQUIRED');
    }
    if (platform !== 'win32') throw new Error('QA_BROWSER_GPU_INFO_COLLECTION_NATIVE_WINDOWS_REQUIRED');
    if (contract.headless !== false || contract.webglRequirement !== BROWSER_WEBGL_REQUIREMENTS.REQUIRED) {
      throw new Error('QA_BROWSER_GPU_INFO_COLLECTION_HEADED_WEBGL_REQUIRED');
    }
  }
  const appliedArguments = Object.freeze(policy === 'dawn-eager' ? [QA_CHROMIUM_DAWN_EAGER_ARGUMENT] : []);
  return Object.freeze({
    args: Object.freeze([...args, ...appliedArguments]),
    receipt: Object.freeze({ policy, appliedArguments,
      processOwnership: contract ? contract.processOwnership : null,
      executionContractValidated: contract !== null, platform,
      effect: policy === 'dawn-eager' ? 'request_without_delay_host_not_forced' : 'browser_default',
      canonicalOwner: CANONICAL_OWNER }),
  });
}
