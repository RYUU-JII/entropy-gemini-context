import { selectCanonicalProtectionArtifactRuntimeState } from '../../../../domains/protection/runtime/canonicalArtifactTelemetry.js';
import { ARTIFACT_CAPABILITY_STATUSES } from '../../utils/protectionArtifactCapabilityState.js';

export const TOOLS_ARTIFACT_ACTIVATION_STATE_VERSION = 1;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

export function resolveConfiguredArtifactChildEnabled(childState = null) {
  const source = isPlainObject(childState) ? childState : {};
  if (hasOwn(source, 'configuredEnabled')) {
    return source.configuredEnabled === true;
  }
  return source.enabled === true;
}

export function resolveArtifactFamilyConfiguredEnabled(familyState = null) {
  const source = isPlainObject(familyState) ? familyState : {};
  if (hasOwn(source, 'configuredEnabled')) {
    return source.configuredEnabled === true;
  }
  if (source.enabled === true) {
    return true;
  }
  const children = isPlainObject(source.children) ? source.children : {};
  return Object.values(children).some((childState) => resolveConfiguredArtifactChildEnabled(childState));
}

function resolveArtifactFamilyEffectiveEnabled(familyState = null) {
  const source = isPlainObject(familyState) ? familyState : {};
  return source.enabled === true;
}

function resolveArtifactControlSuppressed(familyState = null) {
  const source = isPlainObject(familyState) ? familyState : {};
  return source.controlSuppressed === true
    || source.globallyPaused === true
    || source.suspended === true;
}

function buildChildActivationStates(familyState = null) {
  const source = isPlainObject(familyState) ? familyState : {};
  const children = isPlainObject(source.children) ? source.children : {};
  return Object.freeze(
    Object.entries(children).reduce((acc, [childId, childState]) => {
      const childSource = isPlainObject(childState) ? childState : {};
      acc[childId] = Object.freeze({
        childId,
        configuredEnabled: resolveConfiguredArtifactChildEnabled(childSource),
        effectiveEnabled: childSource.enabled === true,
      });
      return acc;
    }, {}),
  );
}

export function getArtifactCapability(artifactCapabilityState = null, artifactId = '') {
  const artifacts = artifactCapabilityState?.artifacts;
  if (!isPlainObject(artifacts)) return null;
  return artifacts[artifactId] || null;
}

export function resolveArtifactCapabilityAllowsPreview() {
  return true;
}

export function resolveArtifactCapabilityAllowsRuntime(capability = null) {
  if (!capability) return true;
  return capability.status !== ARTIFACT_CAPABILITY_STATUSES.PERMISSION_SNAPSHOT_UNAVAILABLE
    && capability.status !== ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_PROTECTION_ACCESS
    && capability.status !== ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_PROTECTED_SITES
    && capability.status !== ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_MEMORY_ACCESS;
}

function normalizeRuntimeSnapshotError(error = '') {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error?.code === 'string' && error.code.trim()) return error.code.trim();
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  return '';
}

function isLiveRuntimeStateSource(runtime = null) {
  return runtime?.bound === true
    && (
      runtime.stateSource === 'runtime_artifacts'
      || runtime.stateSource === 'runtime_filter_plan'
    );
}

function resolveRuntimeState({
  runtime = null,
  hasLiveRuntimeState = false,
  configuredEnabled = false,
  capabilityAllowsRuntime = true,
} = {}) {
  if (!hasLiveRuntimeState) {
    return configuredEnabled ? 'armed' : 'disabled';
  }
  if (!capabilityAllowsRuntime) {
    return configuredEnabled ? 'armed' : 'disabled';
  }
  return runtime?.state === 'disabled' && configuredEnabled
    ? 'armed'
    : runtime?.state || 'disabled';
}

function resolveRuntimeActive({
  runtime = null,
  hasLiveRuntimeState = false,
  capabilityAllowsRuntime = true,
} = {}) {
  if (!capabilityAllowsRuntime) {
    return false;
  }
  if (!hasLiveRuntimeState) {
    return false;
  }
  return runtime?.available === true && runtime?.isActive === true;
}

export function resolveToolsArtifactActivationState({
  artifactRuntimeSnapshot = null,
  ...options
} = {}) {
  return resolveToolsArtifactActivationFromRuntime({
    ...options,
    runtime: selectCanonicalProtectionArtifactRuntimeState(artifactRuntimeSnapshot, options.artifactId),
  });
}

export function resolveToolsArtifactActivationFromRuntime({
  artifactId,
  familyState = null,
  runtime,
  artifactRuntimeSnapshotError = '',
  artifactCapabilityState = null,
  capability = getArtifactCapability(artifactCapabilityState, artifactId),
} = {}) {
  if (typeof artifactId !== 'string' || !artifactId.trim()) {
    throw new Error('[artifactActivationState] artifactId is required.');
  }

  const canonicalArtifactId = artifactId.trim();
  if (!runtime) throw new Error('ARTIFACT_RUNTIME_PROJECTION_REQUIRED');
  const configuredEnabled = resolveArtifactFamilyConfiguredEnabled(familyState);
  const effectiveEnabled = resolveArtifactFamilyEffectiveEnabled(familyState);
  const controlSuppressed = resolveArtifactControlSuppressed(familyState);
  const capabilityAllowsPreview = resolveArtifactCapabilityAllowsPreview(capability);
  const capabilityAllowsRuntime = resolveArtifactCapabilityAllowsRuntime(capability);
  const hasLiveRuntimeState = isLiveRuntimeStateSource(runtime);
  const runtimeSnapshotError = normalizeRuntimeSnapshotError(artifactRuntimeSnapshotError);
  const runtimeState = resolveRuntimeState({
    runtime,
    hasLiveRuntimeState,
    configuredEnabled,
    capabilityAllowsRuntime,
  });
  const isRuntimeActive = resolveRuntimeActive({
    runtime,
    hasLiveRuntimeState,
    capabilityAllowsRuntime,
  });
  const isPreviewActive = configuredEnabled && capabilityAllowsPreview;

  return Object.freeze({
    version: TOOLS_ARTIFACT_ACTIVATION_STATE_VERSION,
    artifactId: canonicalArtifactId,
    configuredEnabled,
    effectiveEnabled,
    controlSuppressed,
    suspended: familyState?.suspended === true,
    globallyPaused: familyState?.globallyPaused === true,
    capability: capability || null,
    capabilityAllowsPreview,
    capabilityAllowsRuntime,
    hasLiveRuntimeState,
    runtime,
    runtimeSnapshotError,
    runtimeAvailable: runtime?.available === true,
    runtimeState,
    isRuntimeActive,
    isPreviewActive,
    children: buildChildActivationStates(familyState),
  });
}
