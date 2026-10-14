import {
  assertBrowserExecutionContractMatches,
  readBrowserExecutionEnvironmentIfPresent,
} from '../../browser-qa/contracts/browserExecutionContract.mjs';

export function renderingRequirementFromBrowserExecution(browserExecution) {
  return browserExecution?.gpuRequirement === 'hardware_active_required'
    ? 'physical_gpu_required'
    : 'headless_ok';
}

function requireRenderingRequirement(value) {
  if (![
    'headless_ok',
    'headed_required',
    'physical_gpu_required',
  ].includes(value)) {
    throw new Error(`QA_BROWSER_CHILD_RENDERING_CONTRACT_INVALID:${value}`);
  }
  return value;
}

function requireCompatibleRenderingRequirement(browserExecution, declared) {
  if (declared === undefined) {
    return renderingRequirementFromBrowserExecution(browserExecution);
  }
  requireRenderingRequirement(declared);
  const physicalRequired = browserExecution.gpuRequirement
    === 'hardware_active_required';
  const compatible = declared === 'physical_gpu_required'
    ? physicalRequired
    : !physicalRequired && (
      declared === 'headless_ok'
      || (
        declared === 'headed_required'
        && (
          browserExecution.processOwnership === 'attach_only'
          || browserExecution.headless === false
        )
      )
    );
  if (!compatible) {
    throw new Error(
      'QA_BROWSER_CHILD_RENDERING_CONTRACT_MISMATCH:'
      + `${declared}:${renderingRequirementFromBrowserExecution(browserExecution)}`,
    );
  }
  return declared;
}

function resolveDeclaredRenderingRequirement(options, environment) {
  const optionRequirement = options?.renderingRequirement;
  const environmentRequirement = environment.QA_BROWSER_RENDERING_REQUIREMENT;
  if (
    optionRequirement !== undefined
    && environmentRequirement !== undefined
    && optionRequirement !== environmentRequirement
  ) {
    throw new Error(
      'QA_BROWSER_CHILD_RENDERING_INPUT_MISMATCH:'
      + `${optionRequirement}:${environmentRequirement}`,
    );
  }
  return optionRequirement ?? environmentRequirement;
}

export function admitQaBrowserChildExecution({
  environment = process.env,
  headless,
  expectations = {},
} = {}) {
  const browserExecution = readBrowserExecutionEnvironmentIfPresent(environment);
  if (!browserExecution) return null;
  const admitted = assertBrowserExecutionContractMatches(browserExecution, {
    processOwnership: 'owned',
    startPolicy: 'automatic',
    ...(headless === undefined ? {} : { headless }),
    ...expectations,
  });
  const declaredRenderingRequirement = environment.QA_BROWSER_RENDERING_REQUIREMENT;
  const renderingRequirement = requireCompatibleRenderingRequirement(
    admitted,
    declaredRenderingRequirement,
  );
  return Object.freeze({
    browserExecution: admitted,
    renderingRequirement,
  });
}

export function admitQaExtensionBrowserChildExecution(options, {
  environment = process.env,
} = {}) {
  const admission = admitQaBrowserChildExecution({
    environment,
    headless: options?.headless,
    expectations: {
      documentVisibility: 'visible_required',
      targetActivation: 'active',
      osFocus: 'never',
      audioPolicy: 'muted',
      extensionRuntime: 'required',
    },
  });
  if (!admission) {
    const renderingRequirement = requireRenderingRequirement(
      options?.renderingRequirement
        ?? environment.QA_BROWSER_RENDERING_REQUIREMENT
        ?? 'headless_ok',
    );
    return Object.freeze({
      ...options,
      browserExecution: null,
      audioPolicy: 'muted',
      renderingRequirement,
    });
  }
  return Object.freeze({
    ...options,
    headless: admission.browserExecution.headless,
    browserExecution: admission.browserExecution,
    audioPolicy: admission.browserExecution.audioPolicy,
    renderingRequirement: admission.renderingRequirement,
  });
}

export function admitQaAttachedExtensionBrowserChildExecution(options, {
  environment = process.env,
} = {}) {
  const browserExecution = readBrowserExecutionEnvironmentIfPresent(environment);
  const declaredRenderingRequirement = resolveDeclaredRenderingRequirement(
    options,
    environment,
  );
  if (!browserExecution) {
    return Object.freeze({
      ...options,
      browserExecution: null,
      audioPolicy: 'muted',
      renderingRequirement: requireRenderingRequirement(
        declaredRenderingRequirement
          ?? (options?.cdpEndpoint || options?.headless === false
            ? 'headed_required'
            : 'headless_ok'),
      ),
    });
  }
  if (!options?.cdpEndpoint) {
    throw new Error('QA_BROWSER_CHILD_ATTACH_ENDPOINT_REQUIRED');
  }
  const admitted = assertBrowserExecutionContractMatches(browserExecution, {
    processOwnership: 'attach_only',
    headless: null,
    displayPolicy: 'external_display',
    documentVisibility: 'visible_required',
    targetActivation: 'active',
    osFocus: 'never',
    audioPolicy: 'muted',
    extensionRuntime: 'required',
  });
  if (!['external', 'managed_ensure_before_attach'].includes(admitted.startPolicy)) {
    throw new Error(
      `QA_BROWSER_CHILD_ATTACH_START_POLICY_INVALID:${admitted.startPolicy}`,
    );
  }
  return Object.freeze({
    ...options,
    browserExecution: admitted,
    audioPolicy: admitted.audioPolicy,
    renderingRequirement: requireCompatibleRenderingRequirement(
      admitted,
      declaredRenderingRequirement,
    ),
  });
}
