import {
  BROWSER_AUDIO_POLICIES,
  BROWSER_DISPLAY_POLICIES,
  BROWSER_DOCUMENT_VISIBILITY,
  BROWSER_EXECUTION_CONTRACT_VERSION,
  BROWSER_GPU_REQUIREMENTS,
  BROWSER_OS_FOCUS,
  BROWSER_PROCESS_OWNERSHIP,
  BROWSER_START_POLICIES,
  BROWSER_TARGET_ACTIVATION,
  BROWSER_WEBGL_REQUIREMENTS,
  defineBrowserExecutionContract,
} from '../../browser-qa/contracts/browserExecutionContract.mjs';

export const QA_BROWSER_PRESENTATIONS = Object.freeze({
  FOREGROUND: 'foreground',
  BACKGROUND: 'background',
  HIDDEN: 'hidden',
});

export const QA_BROWSER_AUTHENTICATION = Object.freeze({
  NONE: 'none',
  PERSISTENT: 'persistent',
});

export const QA_BROWSER_EXTENSION_RUNTIME = Object.freeze({
  NONE: 'none',
  REQUIRED: 'required',
});

export const QA_BROWSER_RENDERING = Object.freeze({
  HEADLESS_OK: 'headless_ok',
  HEADLESS_REQUIRED: 'headless_required',
  HEADED_REQUIRED: 'headed_required',
  PHYSICAL_GPU_REQUIRED: 'physical_gpu_required',
});

export const QA_BROWSER_AUDIO = Object.freeze({
  MUTED: 'muted',
  AUDIBLE_REQUIRED: 'audible_required',
});

export const QA_BROWSER_WEBGL = BROWSER_WEBGL_REQUIREMENTS;

const REQUIREMENT_KEYS = new Set([
  'authentication',
  'extensionRuntime',
  'rendering',
  'webgl',
  'audio',
  'defaultPresentation',
  'hiddenAllowed',
  'documentVisibility',
  'targetActivation',
  'osFocus',
]);

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function requireEnum(value, values, code) {
  if (!Object.values(values).includes(value)) fail(code, String(value || 'missing'));
  return value;
}

export function normalizeQaBrowserRequirements(rawRequirements, {
  environmentId = null,
} = {}) {
  if (rawRequirements === null || rawRequirements === undefined) {
    if (environmentId) fail('QA_BROWSER_REQUIREMENTS_REQUIRED', environmentId);
    return null;
  }
  if (
    !rawRequirements
    || typeof rawRequirements !== 'object'
    || Array.isArray(rawRequirements)
  ) {
    fail('QA_BROWSER_REQUIREMENTS_INVALID');
  }
  const unknownKey = Object.keys(rawRequirements)
    .find((key) => !REQUIREMENT_KEYS.has(key));
  if (unknownKey) fail('QA_BROWSER_REQUIREMENT_KEY_UNKNOWN', unknownKey);
  const authentication = requireEnum(
    rawRequirements.authentication,
    QA_BROWSER_AUTHENTICATION,
    'QA_BROWSER_AUTHENTICATION_INVALID',
  );
  const extensionRuntime = requireEnum(
    rawRequirements.extensionRuntime,
    QA_BROWSER_EXTENSION_RUNTIME,
    'QA_BROWSER_EXTENSION_RUNTIME_INVALID',
  );
  const rendering = requireEnum(
    rawRequirements.rendering,
    QA_BROWSER_RENDERING,
    'QA_BROWSER_RENDERING_INVALID',
  );
  const webgl = requireEnum(
    rawRequirements.webgl,
    QA_BROWSER_WEBGL,
    'QA_BROWSER_WEBGL_INVALID',
  );
  const audio = requireEnum(
    rawRequirements.audio,
    QA_BROWSER_AUDIO,
    'QA_BROWSER_AUDIO_INVALID',
  );
  const defaultPresentation = requireEnum(
    rawRequirements.defaultPresentation,
    QA_BROWSER_PRESENTATIONS,
    'QA_BROWSER_DEFAULT_PRESENTATION_INVALID',
  );
  if (typeof rawRequirements.hiddenAllowed !== 'boolean') {
    fail('QA_BROWSER_HIDDEN_ALLOWED_INVALID');
  }
  if (
    defaultPresentation === QA_BROWSER_PRESENTATIONS.HIDDEN
    && rawRequirements.hiddenAllowed !== true
  ) {
    fail('QA_BROWSER_HIDDEN_DEFAULT_FORBIDDEN');
  }
  if (
    rawRequirements.hiddenAllowed === true
    && ![QA_BROWSER_RENDERING.HEADLESS_OK, QA_BROWSER_RENDERING.HEADLESS_REQUIRED].includes(rendering)
  ) {
    fail('QA_BROWSER_HIDDEN_RENDERING_CONFLICT', rendering);
  }
  if (rendering === QA_BROWSER_RENDERING.HEADLESS_REQUIRED && (
    authentication !== QA_BROWSER_AUTHENTICATION.NONE || rawRequirements.hiddenAllowed !== true
    || defaultPresentation !== QA_BROWSER_PRESENTATIONS.HIDDEN
  )) fail('QA_BROWSER_HEADLESS_REQUIRED_CONFLICT');
  const documentVisibility = requireEnum(
    rawRequirements.documentVisibility,
    BROWSER_DOCUMENT_VISIBILITY,
    'QA_BROWSER_DOCUMENT_VISIBILITY_INVALID',
  );
  const targetActivation = requireEnum(
    rawRequirements.targetActivation,
    BROWSER_TARGET_ACTIVATION,
    'QA_BROWSER_TARGET_ACTIVATION_INVALID',
  );
  const osFocus = requireEnum(
    rawRequirements.osFocus,
    BROWSER_OS_FOCUS,
    'QA_BROWSER_OS_FOCUS_INVALID',
  );
  if (
    documentVisibility === BROWSER_DOCUMENT_VISIBILITY.VISIBLE_REQUIRED
    && targetActivation !== BROWSER_TARGET_ACTIVATION.ACTIVE
  ) {
    fail('QA_BROWSER_VISIBLE_TARGET_ACTIVATION_REQUIRED');
  }
  if (
    osFocus === BROWSER_OS_FOCUS.REQUEST_ONCE
    && targetActivation !== BROWSER_TARGET_ACTIVATION.ACTIVE
  ) {
    fail('QA_BROWSER_FOCUS_TARGET_ACTIVATION_REQUIRED');
  }
  return Object.freeze({
    authentication,
    extensionRuntime,
    rendering,
    webgl,
    audio,
    defaultPresentation,
    hiddenAllowed: rawRequirements.hiddenAllowed,
    documentVisibility,
    targetActivation,
    osFocus,
  });
}

export function createQaBrowserPresentationParameter(browserRequirements) {
  if (!browserRequirements) return null;
  return Object.freeze({
    type: 'enum',
    cliName: 'presentation',
    values: Object.freeze(Object.values(QA_BROWSER_PRESENTATIONS).filter(
      value => browserRequirements.rendering === QA_BROWSER_RENDERING.HEADLESS_REQUIRED
        ? value === QA_BROWSER_PRESENTATIONS.HIDDEN
        : value !== QA_BROWSER_PRESENTATIONS.HIDDEN || browserRequirements.hiddenAllowed,
    )),
    default: browserRequirements.defaultPresentation,
  });
}

function presentationFromLegacy(rawParameters) {
  const requested = [];
  if (Object.prototype.hasOwnProperty.call(rawParameters, 'headed')) {
    const value = rawParameters.headed;
    if (![true, false, 'true', 'false'].includes(value)) {
      fail('QA_RUN_PARAMETER_BOOLEAN_INVALID', `headed=${String(value)}`);
    }
    requested.push(
      value === true || value === 'true'
        ? QA_BROWSER_PRESENTATIONS.FOREGROUND
        : QA_BROWSER_PRESENTATIONS.HIDDEN,
    );
  }
  if (Object.prototype.hasOwnProperty.call(rawParameters, 'headless')) {
    const value = rawParameters.headless;
    if (![true, false, 'true', 'false'].includes(value)) {
      fail('QA_RUN_PARAMETER_BOOLEAN_INVALID', `headless=${String(value)}`);
    }
    requested.push(
      value === true || value === 'true'
        ? QA_BROWSER_PRESENTATIONS.HIDDEN
        : QA_BROWSER_PRESENTATIONS.FOREGROUND,
    );
  }
  if (new Set(requested).size > 1) {
    fail('QA_BROWSER_LEGACY_PRESENTATION_CONFLICT');
  }
  return requested[0] || null;
}

export function normalizeLegacyBrowserPresentationInput(target, rawParameters = {}) {
  if (!rawParameters || typeof rawParameters !== 'object' || Array.isArray(rawParameters)) {
    fail('QA_RUN_PARAMETERS_INVALID');
  }
  const hasPresentation = Object.values(target?.parameters || {})
    .some((schema) => schema.cliName === 'presentation');
  if (!hasPresentation) return rawParameters;
  const legacyPresentation = presentationFromLegacy(rawParameters);
  if (!legacyPresentation) return rawParameters;
  if (
    Object.prototype.hasOwnProperty.call(rawParameters, 'presentation')
    && rawParameters.presentation !== legacyPresentation
  ) {
    fail('QA_BROWSER_PRESENTATION_COMPATIBILITY_CONFLICT');
  }
  const normalized = { ...rawParameters };
  delete normalized.headed;
  delete normalized.headless;
  normalized.presentation = legacyPresentation;
  return normalized;
}

function assertEnvironmentCompatibility(requirements, environment, targetId) {
  if (!environment) fail('QA_BROWSER_ENVIRONMENT_REQUIRED', targetId);
  if (
    requirements.authentication === QA_BROWSER_AUTHENTICATION.PERSISTENT
    && environment.processOwnership !== 'attach_only'
  ) {
    fail('QA_BROWSER_PERSISTENT_ENVIRONMENT_REQUIRED', targetId);
  }
  if (
    requirements.authentication === QA_BROWSER_AUTHENTICATION.NONE
    && environment.processOwnership !== 'owned'
  ) {
    fail('QA_BROWSER_OWNED_ENVIRONMENT_REQUIRED', targetId);
  }
}

export function resolveQaBrowserExecutionPlan({
  targetId,
  requirements,
  environment,
  parameters,
} = {}) {
  if (!requirements) return null;
  assertEnvironmentCompatibility(requirements, environment, targetId || 'unknown');
  const presentation = requireEnum(
    parameters?.presentation,
    QA_BROWSER_PRESENTATIONS,
    'QA_BROWSER_PRESENTATION_INVALID',
  );
  if (requirements.rendering === QA_BROWSER_RENDERING.HEADLESS_REQUIRED
    && presentation !== QA_BROWSER_PRESENTATIONS.HIDDEN) {
    fail('QA_BROWSER_HEADLESS_REQUIRED_PRESENTATION', targetId);
  }
  const attachOnly = environment.processOwnership === 'attach_only';
  let startPolicy;
  if (attachOnly) {
    if (environment.lifecyclePolicy === 'managed') {
      startPolicy = BROWSER_START_POLICIES.MANAGED_ENSURE_BEFORE_ATTACH;
    } else if (environment.lifecyclePolicy === 'external') {
      startPolicy = BROWSER_START_POLICIES.EXTERNAL;
    } else {
      fail(
        'QA_BROWSER_ATTACH_LIFECYCLE_POLICY_INVALID',
        String(environment.lifecyclePolicy ?? 'missing'),
      );
    }
  } else if (environment.lifecyclePolicy === 'per_run') {
    startPolicy = BROWSER_START_POLICIES.AUTOMATIC;
  } else {
    fail(
      'QA_BROWSER_OWNED_LIFECYCLE_POLICY_INVALID',
      String(environment.lifecyclePolicy ?? 'missing'),
    );
  }
  if (presentation === QA_BROWSER_PRESENTATIONS.HIDDEN) {
    if (!requirements.hiddenAllowed) {
      fail('QA_BROWSER_PRESENTATION_FORBIDDEN', `${targetId}:hidden`);
    }
    if (attachOnly) {
      fail('QA_BROWSER_HIDDEN_ATTACH_ONLY_UNAVAILABLE', targetId);
    }
  }
  if (
    requirements.osFocus === BROWSER_OS_FOCUS.REQUEST_ONCE
    && environment.focusPolicy !== BROWSER_OS_FOCUS.REQUEST_ONCE
  ) {
    fail('QA_BROWSER_OS_FOCUS_ENVIRONMENT_FORBIDDEN', targetId);
  }

  const headless = attachOnly
    ? null
    : presentation === QA_BROWSER_PRESENTATIONS.HIDDEN;
  const executionContract = defineBrowserExecutionContract({
    contractVersion: BROWSER_EXECUTION_CONTRACT_VERSION,
    processOwnership: attachOnly
      ? BROWSER_PROCESS_OWNERSHIP.ATTACH_ONLY
      : BROWSER_PROCESS_OWNERSHIP.OWNED,
    headless,
    startPolicy,
    displayPolicy: attachOnly
      ? BROWSER_DISPLAY_POLICIES.EXTERNAL
      : headless
        ? BROWSER_DISPLAY_POLICIES.NONE
        : presentation === QA_BROWSER_PRESENTATIONS.FOREGROUND
          ? BROWSER_DISPLAY_POLICIES.HOST_REQUIRED
          : BROWSER_DISPLAY_POLICIES.HOST_OR_MANAGED,
    documentVisibility: requirements.documentVisibility,
    targetActivation: requirements.targetActivation,
    osFocus: requirements.osFocus,
    audioPolicy: requirements.audio === QA_BROWSER_AUDIO.MUTED
      ? BROWSER_AUDIO_POLICIES.MUTED
      : BROWSER_AUDIO_POLICIES.AUDIBLE,
    gpuRequirement: requirements.rendering === QA_BROWSER_RENDERING.PHYSICAL_GPU_REQUIRED
      ? BROWSER_GPU_REQUIREMENTS.HARDWARE_ACTIVE_REQUIRED
      : BROWSER_GPU_REQUIREMENTS.SOFTWARE_OR_UNCLASSIFIED_ALLOWED,
    webglRequirement: requirements.webgl,
    extensionRuntime: requirements.extensionRuntime,
  });
  return Object.freeze({
    presentation,
    ...executionContract,
    // Target policy can require headless; downstream renderer capability stays
    // neutral. The V2 headless/display/focus leaves enforce that compiled choice.
    renderingRequirement: requirements.rendering === QA_BROWSER_RENDERING.HEADLESS_REQUIRED
      ? QA_BROWSER_RENDERING.HEADLESS_OK : requirements.rendering,
  });
}
