import {
  attachQaPlaywrightBrowserOverCdp as attachNeutralPlaywrightBrowserOverCdp,
  launchQaPlaywrightBrowser as launchNeutralPlaywrightBrowser,
  readQaPlaywrightBrowserReceipt,
} from '../../browser-qa/browser/playwrightBrowserOwner.mjs';
import {
  BROWSER_EXECUTION_CONTRACT_VERSION,
  defineBrowserExecutionContract,
} from '../../browser-qa/contracts/browserExecutionContract.mjs';

function renderingRequirementToGpuRequirement(renderingRequirement = 'headless_ok') {
  if (!['headless_ok', 'headed_required', 'physical_gpu_required']
    .includes(renderingRequirement)) {
    throw new Error(
      `QA_PLAYWRIGHT_RENDERING_REQUIREMENT_INVALID:${renderingRequirement}`,
    );
  }
  return renderingRequirement === 'physical_gpu_required'
    ? 'hardware_active_required'
    : 'software_or_unclassified_allowed';
}

function legacyAudioPolicy(management) {
  return management.audioPolicy || 'muted';
}

function synthesizeLegacyAttachExecutionContract(management) {
  const renderingRequirement = management.renderingRequirement || 'headless_ok';
  return defineBrowserExecutionContract({
    contractVersion: BROWSER_EXECUTION_CONTRACT_VERSION,
    processOwnership: 'attach_only',
    headless: null,
    startPolicy: 'external',
    displayPolicy: 'external_display',
    documentVisibility: 'background_allowed',
    targetActivation: 'background',
    osFocus: 'never',
    audioPolicy: legacyAudioPolicy(management),
    gpuRequirement: renderingRequirementToGpuRequirement(renderingRequirement),
    webglRequirement: 'optional',
    extensionRuntime: 'none',
  });
}

function synthesizeLegacyLaunchExecutionContract(launchOptions, management) {
  const headless = launchOptions.headless === undefined
    ? true
    : launchOptions.headless === true;
  const presentation = management.presentation || (headless ? 'hidden' : 'foreground');
  const renderingRequirement = management.renderingRequirement || 'headless_ok';
  return {
    executionPlan: defineBrowserExecutionContract({
      contractVersion: BROWSER_EXECUTION_CONTRACT_VERSION,
      processOwnership: 'owned',
      headless,
      startPolicy: 'automatic',
      displayPolicy: headless
        ? 'none'
        : presentation === 'foreground'
          ? 'host_display_required'
          : 'host_or_managed_display',
      documentVisibility: presentation === 'foreground'
        ? 'visible_required'
        : 'background_allowed',
      targetActivation: presentation === 'foreground' ? 'active' : 'background',
      osFocus: 'never',
      audioPolicy: legacyAudioPolicy(management),
      gpuRequirement: renderingRequirementToGpuRequirement(renderingRequirement),
      webglRequirement: 'optional',
      extensionRuntime: 'none',
    }),
    presentation,
  };
}

function adaptExplicitManagement(management) {
  const presentation = management.presentation
    ?? management.executionPlan?.presentation
    ?? null;
  const renderingRequirement = management.renderingRequirement
    ?? management.executionPlan?.renderingRequirement
    ?? null;
  return {
    ...management,
    ...(presentation === null ? {} : { presentation }),
    ...(renderingRequirement === null ? {} : { renderingRequirement }),
  };
}

function adaptLegacyAttachManagement(management) {
  if (management.executionPlan) return adaptExplicitManagement(management);
  return {
    ...management,
    executionPlan: synthesizeLegacyAttachExecutionContract(management),
    audioPolicy: legacyAudioPolicy(management),
    renderingRequirement: management.renderingRequirement || 'headless_ok',
  };
}

function adaptLegacyLaunchManagement(launchOptions, management) {
  if (management.executionPlan) return adaptExplicitManagement(management);
  const synthesized = synthesizeLegacyLaunchExecutionContract(
    launchOptions,
    management,
  );
  return {
    ...management,
    ...synthesized,
    audioPolicy: legacyAudioPolicy(management),
    renderingRequirement: management.renderingRequirement || 'headless_ok',
  };
}

export function attachQaPlaywrightBrowserOverCdp(
  cdpEndpoint,
  connectOptions = {},
  management = {},
) {
  return attachNeutralPlaywrightBrowserOverCdp(
    cdpEndpoint,
    connectOptions,
    adaptLegacyAttachManagement(management),
  );
}

export function launchQaPlaywrightBrowser(
  launchOptions = {},
  management = {},
) {
  return launchNeutralPlaywrightBrowser(
    launchOptions,
    adaptLegacyLaunchManagement(launchOptions, management),
  );
}

export {
  attachQaPlaywrightBrowserOverCdp as attachPlaywrightBrowserOverCdp,
  launchQaPlaywrightBrowser as launchPlaywrightBrowser,
  readQaPlaywrightBrowserReceipt,
  readQaPlaywrightBrowserReceipt as readPlaywrightBrowserReceipt,
};
