import {
  BROWSER_GPU_REQUIREMENTS,
  BROWSER_PROCESS_OWNERSHIP,
  BROWSER_WEBGL_REQUIREMENTS,
  projectBrowserExecutionContract,
} from '../contracts/browserExecutionContract.mjs';

const SWIFTSHADER_WEBGL_ARGUMENTS = Object.freeze([
  '--use-gl=angle',
  '--use-angle=swiftshader-webgl',
  '--enable-unsafe-swiftshader',
]);

function readSwitchName(argument) {
  const match = /^--([^=\s]+)(?:=|$)/u.exec(argument);
  return match?.[1] || null;
}

function appendUniqueArguments(args, additions) {
  const existingSwitches = new Set(args.map(readSwitchName).filter(Boolean));
  for (const argument of additions) {
    const switchName = readSwitchName(argument);
    if (existingSwitches.has(switchName)) {
      throw new Error(`QA_BROWSER_WEBGL_LAUNCH_ARGUMENT_CONFLICT:${switchName}`);
    }
  }
  return Object.freeze([...args, ...additions]);
}

export function resolveQaChromiumGraphicsLaunch({
  args = [],
  executionContract,
  displayReceipt = null,
} = {}) {
  if (!Array.isArray(args) || args.some((argument) => typeof argument !== 'string')) {
    throw new Error('QA_BROWSER_GRAPHICS_LAUNCH_ARGUMENTS_INVALID');
  }
  const contract = projectBrowserExecutionContract(executionContract);
  if (
    contract.processOwnership === BROWSER_PROCESS_OWNERSHIP.ATTACH_ONLY
    || contract.webglRequirement === BROWSER_WEBGL_REQUIREMENTS.OPTIONAL
  ) {
    return Object.freeze({
      args: Object.freeze([...args]),
      policy: 'browser_default',
      displayKind: displayReceipt?.kind || null,
      webglRequirement: contract.webglRequirement,
    });
  }
  if (contract.webglRequirement !== BROWSER_WEBGL_REQUIREMENTS.REQUIRED) {
    throw new Error('QA_BROWSER_WEBGL_REQUIREMENT_UNSUPPORTED');
  }
  if (!displayReceipt || typeof displayReceipt.kind !== 'string') {
    throw new Error('QA_BROWSER_WEBGL_DISPLAY_RECEIPT_REQUIRED');
  }
  if (displayReceipt.kind !== 'managed_xvfb') {
    return Object.freeze({
      args: Object.freeze([...args]),
      policy: 'browser_default_webgl_required',
      displayKind: displayReceipt.kind,
      webglRequirement: contract.webglRequirement,
    });
  }
  if (
    contract.gpuRequirement
    !== BROWSER_GPU_REQUIREMENTS.SOFTWARE_OR_UNCLASSIFIED_ALLOWED
  ) {
    throw new Error('QA_BROWSER_XVFB_SWIFTSHADER_GPU_CONTRACT_CONFLICT');
  }
  return Object.freeze({
    args: appendUniqueArguments(args, SWIFTSHADER_WEBGL_ARGUMENTS),
    policy: 'managed_xvfb_swiftshader_webgl',
    displayKind: displayReceipt.kind,
    webglRequirement: contract.webglRequirement,
  });
}
