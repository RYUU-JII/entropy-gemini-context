export const BROWSER_EXECUTION_CONTRACT_VERSION = 2;
export const BROWSER_EXECUTION_ENVIRONMENT_KEY = 'QA_BROWSER_EXECUTION_CONTRACT';

export const BROWSER_PROCESS_OWNERSHIP = Object.freeze({
  OWNED: 'owned',
  ATTACH_ONLY: 'attach_only',
});

export const BROWSER_START_POLICIES = Object.freeze({
  AUTOMATIC: 'automatic',
  MANAGED_EXPLICIT: 'managed_explicit',
  MANAGED_ENSURE_BEFORE_ATTACH: 'managed_ensure_before_attach',
  EXTERNAL: 'external',
});

export const BROWSER_DISPLAY_POLICIES = Object.freeze({
  NONE: 'none',
  HOST_REQUIRED: 'host_display_required',
  HOST_OR_MANAGED: 'host_or_managed_display',
  EXTERNAL: 'external_display',
});

export const BROWSER_DOCUMENT_VISIBILITY = Object.freeze({
  VISIBLE_REQUIRED: 'visible_required',
  BACKGROUND_ALLOWED: 'background_allowed',
});

export const BROWSER_TARGET_ACTIVATION = Object.freeze({
  ACTIVE: 'active',
  BACKGROUND: 'background',
});

export const BROWSER_OS_FOCUS = Object.freeze({
  NEVER: 'never',
  REQUEST_ONCE: 'request_once',
});

export const BROWSER_AUDIO_POLICIES = Object.freeze({
  MUTED: 'muted',
  AUDIBLE: 'audible',
});

export const BROWSER_GPU_REQUIREMENTS = Object.freeze({
  SOFTWARE_OR_UNCLASSIFIED_ALLOWED: 'software_or_unclassified_allowed',
  HARDWARE_ACTIVE_REQUIRED: 'hardware_active_required',
});

export const BROWSER_WEBGL_REQUIREMENTS = Object.freeze({
  OPTIONAL: 'optional',
  REQUIRED: 'required',
});

export const BROWSER_EXTENSION_RUNTIME = Object.freeze({
  NONE: 'none',
  REQUIRED: 'required',
});

const CONTRACT_KEYS = new Set([
  'contractVersion',
  'processOwnership',
  'headless',
  'startPolicy',
  'displayPolicy',
  'documentVisibility',
  'targetActivation',
  'osFocus',
  'audioPolicy',
  'gpuRequirement',
  'webglRequirement',
  'extensionRuntime',
]);

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function requireEnum(value, values, code) {
  if (!Object.values(values).includes(value)) fail(code, String(value ?? 'missing'));
  return value;
}

function requireExactKeys(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('BROWSER_EXECUTION_CONTRACT_INVALID');
  }
  const unknownKey = Object.keys(raw).find((key) => !CONTRACT_KEYS.has(key));
  if (unknownKey) fail('BROWSER_EXECUTION_CONTRACT_KEY_UNKNOWN', unknownKey);
  const missingKey = [...CONTRACT_KEYS]
    .find((key) => !Object.prototype.hasOwnProperty.call(raw, key));
  if (missingKey) fail('BROWSER_EXECUTION_CONTRACT_KEY_REQUIRED', missingKey);
}

/**
 * Defines the browser runtime leaves that an execution owner must honor.
 * A UI label such as foreground/background/hidden is intentionally absent:
 * adapters may expose presets, but leaf consumers never reconstruct behavior
 * from a preset or a lone headed boolean.
 */
export function defineBrowserExecutionContract(raw) {
  requireExactKeys(raw);
  if (raw.contractVersion !== BROWSER_EXECUTION_CONTRACT_VERSION) {
    fail('BROWSER_EXECUTION_CONTRACT_VERSION_INVALID', String(raw.contractVersion));
  }
  const processOwnership = requireEnum(
    raw.processOwnership,
    BROWSER_PROCESS_OWNERSHIP,
    'BROWSER_EXECUTION_PROCESS_OWNERSHIP_INVALID',
  );
  const startPolicy = requireEnum(
    raw.startPolicy,
    BROWSER_START_POLICIES,
    'BROWSER_EXECUTION_START_POLICY_INVALID',
  );
  const displayPolicy = requireEnum(
    raw.displayPolicy,
    BROWSER_DISPLAY_POLICIES,
    'BROWSER_EXECUTION_DISPLAY_POLICY_INVALID',
  );
  const documentVisibility = requireEnum(
    raw.documentVisibility,
    BROWSER_DOCUMENT_VISIBILITY,
    'BROWSER_EXECUTION_DOCUMENT_VISIBILITY_INVALID',
  );
  const targetActivation = requireEnum(
    raw.targetActivation,
    BROWSER_TARGET_ACTIVATION,
    'BROWSER_EXECUTION_TARGET_ACTIVATION_INVALID',
  );
  const osFocus = requireEnum(
    raw.osFocus,
    BROWSER_OS_FOCUS,
    'BROWSER_EXECUTION_OS_FOCUS_INVALID',
  );
  const audioPolicy = requireEnum(
    raw.audioPolicy,
    BROWSER_AUDIO_POLICIES,
    'BROWSER_EXECUTION_AUDIO_POLICY_INVALID',
  );
  const gpuRequirement = requireEnum(
    raw.gpuRequirement,
    BROWSER_GPU_REQUIREMENTS,
    'BROWSER_EXECUTION_GPU_REQUIREMENT_INVALID',
  );
  const webglRequirement = requireEnum(
    raw.webglRequirement,
    BROWSER_WEBGL_REQUIREMENTS,
    'BROWSER_EXECUTION_WEBGL_REQUIREMENT_INVALID',
  );
  const extensionRuntime = requireEnum(
    raw.extensionRuntime,
    BROWSER_EXTENSION_RUNTIME,
    'BROWSER_EXECUTION_EXTENSION_RUNTIME_INVALID',
  );

  if (processOwnership === BROWSER_PROCESS_OWNERSHIP.OWNED) {
    if (typeof raw.headless !== 'boolean') {
      fail('BROWSER_EXECUTION_OWNED_HEADLESS_REQUIRED');
    }
    if (startPolicy !== BROWSER_START_POLICIES.AUTOMATIC) {
      fail('BROWSER_EXECUTION_OWNED_START_POLICY_INVALID', startPolicy);
    }
    if (displayPolicy === BROWSER_DISPLAY_POLICIES.EXTERNAL) {
      fail('BROWSER_EXECUTION_OWNED_EXTERNAL_DISPLAY_FORBIDDEN');
    }
  } else {
    if (raw.headless !== null) {
      fail('BROWSER_EXECUTION_ATTACH_HEADLESS_MUST_BE_NULL');
    }
    if (![
      BROWSER_START_POLICIES.MANAGED_EXPLICIT,
      BROWSER_START_POLICIES.MANAGED_ENSURE_BEFORE_ATTACH,
      BROWSER_START_POLICIES.EXTERNAL,
    ].includes(startPolicy)) {
      fail('BROWSER_EXECUTION_ATTACH_START_POLICY_INVALID', startPolicy);
    }
    if (displayPolicy !== BROWSER_DISPLAY_POLICIES.EXTERNAL) {
      fail('BROWSER_EXECUTION_ATTACH_DISPLAY_POLICY_INVALID', displayPolicy);
    }
  }

  if (raw.headless === true) {
    if (displayPolicy !== BROWSER_DISPLAY_POLICIES.NONE) {
      fail('BROWSER_EXECUTION_HEADLESS_DISPLAY_CONFLICT', displayPolicy);
    }
    if (osFocus !== BROWSER_OS_FOCUS.NEVER) {
      fail('BROWSER_EXECUTION_HEADLESS_OS_FOCUS_FORBIDDEN', osFocus);
    }
  } else if (
    processOwnership === BROWSER_PROCESS_OWNERSHIP.OWNED
    && displayPolicy === BROWSER_DISPLAY_POLICIES.NONE
  ) {
    fail('BROWSER_EXECUTION_HEADED_DISPLAY_REQUIRED');
  }

  if (
    documentVisibility === BROWSER_DOCUMENT_VISIBILITY.VISIBLE_REQUIRED
    && targetActivation !== BROWSER_TARGET_ACTIVATION.ACTIVE
  ) {
    fail('BROWSER_EXECUTION_VISIBLE_TARGET_ACTIVATION_REQUIRED');
  }
  if (
    osFocus === BROWSER_OS_FOCUS.REQUEST_ONCE
    && targetActivation !== BROWSER_TARGET_ACTIVATION.ACTIVE
  ) {
    fail('BROWSER_EXECUTION_FOCUS_TARGET_ACTIVATION_REQUIRED');
  }

  return Object.freeze({
    contractVersion: BROWSER_EXECUTION_CONTRACT_VERSION,
    processOwnership,
    headless: raw.headless,
    startPolicy,
    displayPolicy,
    documentVisibility,
    targetActivation,
    osFocus,
    audioPolicy,
    gpuRequirement,
    webglRequirement,
    extensionRuntime,
  });
}

export function projectBrowserExecutionContract(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('BROWSER_EXECUTION_CONTRACT_INVALID');
  }
  return defineBrowserExecutionContract(Object.fromEntries(
    [...CONTRACT_KEYS].map((key) => [key, raw[key]]),
  ));
}

export function createBrowserExecutionEnvironment(raw) {
  const contract = projectBrowserExecutionContract(raw);
  return Object.freeze({
    [BROWSER_EXECUTION_ENVIRONMENT_KEY]: JSON.stringify(contract),
  });
}

export function readBrowserExecutionEnvironment(environment = process.env) {
  const serialized = environment?.[BROWSER_EXECUTION_ENVIRONMENT_KEY];
  if (typeof serialized !== 'string' || !serialized.trim()) {
    fail('BROWSER_EXECUTION_ENVIRONMENT_REQUIRED');
  }
  let raw;
  try {
    raw = JSON.parse(serialized);
  } catch (error) {
    throw new Error('BROWSER_EXECUTION_ENVIRONMENT_JSON_INVALID', { cause: error });
  }
  return defineBrowserExecutionContract(raw);
}

export function readBrowserExecutionEnvironmentIfPresent(
  environment = process.env,
) {
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) {
    fail('BROWSER_EXECUTION_ENVIRONMENT_INVALID');
  }
  if (!Object.prototype.hasOwnProperty.call(
    environment,
    BROWSER_EXECUTION_ENVIRONMENT_KEY,
  )) {
    return null;
  }
  return readBrowserExecutionEnvironment(environment);
}

export function assertBrowserExecutionContractMatches(raw, expected = {}) {
  const contract = projectBrowserExecutionContract(raw);
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
    fail('BROWSER_EXECUTION_EXPECTATION_INVALID');
  }
  const unknownKey = Object.keys(expected).find((key) => !CONTRACT_KEYS.has(key));
  if (unknownKey) fail('BROWSER_EXECUTION_EXPECTATION_KEY_UNKNOWN', unknownKey);
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (expectedValue === undefined) continue;
    if (contract[key] !== expectedValue) {
      fail(
        'BROWSER_EXECUTION_CONTRACT_MISMATCH',
        `${key}:${String(expectedValue)}:${String(contract[key])}`,
      );
    }
  }
  return contract;
}

/**
 * An attach-only headed run cannot guarantee `osFocus: never` while creating
 * the browser's first page/window. Such runs require one pre-existing operator
 * page so target activation remains an in-window tab change.
 */
export function requiresBrowserNoFocusBaselinePage(raw) {
  if (raw?.contractVersion !== BROWSER_EXECUTION_CONTRACT_VERSION) return false;
  const contract = projectBrowserExecutionContract(raw);
  return contract.processOwnership === BROWSER_PROCESS_OWNERSHIP.ATTACH_ONLY
    && contract.documentVisibility === BROWSER_DOCUMENT_VISIBILITY.VISIBLE_REQUIRED
    && contract.targetActivation === BROWSER_TARGET_ACTIVATION.ACTIVE
    && contract.osFocus === BROWSER_OS_FOCUS.NEVER;
}
