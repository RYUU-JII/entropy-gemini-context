import { getToolsArtifactDefinition } from '../../../../themes/core/tools/artifacts.js';
import { getCanonicalArtifactDefinition } from '../../../../domains/protection/catalog/artifactFamilyCatalog.js';
import {
  ARTIFACT_CAPABILITY_KINDS,
  ARTIFACT_CAPABILITY_STATUSES,
} from '../../utils/protectionArtifactCapabilityState.js';
import { resolveArtifactCapabilityAllowsPreview } from './artifactActivationState.js';

const ARTIFACT_RUNTIME_TONE_CLASS = Object.freeze({
  unavailable: 'text-on-surface-muted',
  disabled: 'text-on-surface-muted',
  armed: 'text-warning',
  engaged: 'text-danger',
  cleanup: 'text-success',
});

function buildCapabilityDetail(t, capability = null) {
  if (!capability) return '';
  if (capability.status === ARTIFACT_CAPABILITY_STATUSES.PERMISSION_SNAPSHOT_UNAVAILABLE) {
    return t('artifact_altar.application.detail_permission_snapshot_unavailable', {
      error: capability.readError || 'PERMISSION_SNAPSHOT_READ_FAILED',
    });
  }
  if (capability.status === ARTIFACT_CAPABILITY_STATUSES.PARTIAL_PROTECTION_ACCESS) {
    return t('artifact_altar.application.detail_partial_protection', {
      covered: capability.coveredDomainCount,
      total: capability.managedDomainCount,
      missing: capability.missingDomainCount,
    });
  }
  if (capability.status === ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_PROTECTION_ACCESS) {
    return t('artifact_altar.application.detail_protection_access');
  }
  if (capability.status === ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_PROTECTED_SITES) {
    return t('artifact_altar.application.detail_no_protected_sites');
  }
  if (capability.status === ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_MEMORY_ACCESS) {
    const missing = Array.isArray(capability.missingPermissions)
      ? capability.missingPermissions.join(', ')
      : '';
    return t('artifact_altar.application.detail_memory_access', { missing });
  }
  return '';
}

function buildApplicationStatus({
  capability = null,
  capabilityAllowsPreview = resolveArtifactCapabilityAllowsPreview(capability),
  configuredActive = false,
  runtimeState = 'disabled',
  runtime = null,
  runtimeSnapshotError = '',
  t,
} = {}) {
  if (!configuredActive) return null;

  const status = capability?.status || ARTIFACT_CAPABILITY_STATUSES.READY;
  if (status === ARTIFACT_CAPABILITY_STATUSES.PERMISSION_SNAPSHOT_UNAVAILABLE) {
    return {
      text: t('artifact_altar.application.permission_snapshot_unavailable'),
      action: 'retry_permissions',
      detail: buildCapabilityDetail(t, capability),
      tone: 'warning',
      canPreview: capabilityAllowsPreview,
    };
  }
  if (status === ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_PROTECTION_ACCESS) {
    return {
      text: t('artifact_altar.application.inactive_protection_access'),
      action: 'permissions',
      detail: buildCapabilityDetail(t, capability),
      tone: 'warning',
      canPreview: capabilityAllowsPreview,
    };
  }
  if (status === ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_PROTECTED_SITES) {
    return {
      text: t('artifact_altar.application.inactive_protected_sites'),
      action: 'sites',
      detail: buildCapabilityDetail(t, capability),
      tone: 'muted',
      canPreview: capabilityAllowsPreview,
    };
  }
  if (status === ARTIFACT_CAPABILITY_STATUSES.INACTIVE_UNTIL_MEMORY_ACCESS) {
    return {
      text: t('artifact_altar.application.inactive_memory_access'),
      action: 'permissions',
      detail: buildCapabilityDetail(t, capability),
      tone: 'warning',
      canPreview: capabilityAllowsPreview,
    };
  }
  if (status === ARTIFACT_CAPABILITY_STATUSES.PARTIAL_PROTECTION_ACCESS) {
    return {
      text: t('artifact_altar.application.partial_protection_access'),
      action: 'permissions',
      detail: buildCapabilityDetail(t, capability),
      tone: 'warning',
      canPreview: capabilityAllowsPreview,
    };
  }

  if (capability?.kind === ARTIFACT_CAPABILITY_KINDS.MEMORY) {
    return {
      text: t('artifact_altar.application.ready_memory'),
      detail: t('artifact_altar.application.detail_ready_memory'),
      tone: 'success',
      canPreview: capabilityAllowsPreview,
    };
  }

  if (runtimeSnapshotError) {
    return {
      text: t('artifact_altar.application.runtime_snapshot_unavailable'),
      action: 'retry_runtime',
      detail: t('artifact_altar.application.detail_runtime_snapshot_unavailable', {
        error: runtimeSnapshotError,
      }),
      tone: 'warning',
      canPreview: capabilityAllowsPreview,
    };
  }

  if (runtime?.available && runtimeState === 'engaged') {
    return {
      text: t('artifact_altar.application.active_on_page'),
      detail: runtime.scopeHost
        ? t('artifact_altar.application.detail_active_on_host', { host: runtime.scopeHost })
        : '',
      tone: 'success',
      canPreview: capabilityAllowsPreview,
    };
  }

  if (runtime?.available) {
    return {
      text: t('artifact_altar.application.ready_on_page'),
      detail: runtime.scopeHost
        ? t('artifact_altar.application.detail_ready_on_host', { host: runtime.scopeHost })
        : t('artifact_altar.application.detail_ready_protection'),
      tone: 'success',
      canPreview: capabilityAllowsPreview,
    };
  }

  return {
    text: t('artifact_altar.application.ready_protection'),
    detail: t('artifact_altar.application.detail_ready_protection'),
    tone: 'muted',
    canPreview: capabilityAllowsPreview,
  };
}

export function buildToolsArtifactShell({
  artifactId,
  activationState,
  themeId = '',
  t,
}) {
  const definition = getToolsArtifactDefinition(artifactId);
  const canonicalArtifactId = definition?.id || '';
  const artifactDefinition = getCanonicalArtifactDefinition(canonicalArtifactId);
  if (!definition) {
    throw new Error(`[buildToolsArtifacts] Unknown artifact id: ${artifactId}`);
  }
  if (!activationState || activationState.artifactId !== canonicalArtifactId) {
    throw new Error(`[buildToolsArtifacts] Missing activation state for artifact id: ${canonicalArtifactId}`);
  }

  const runtime = activationState.runtime;
  const capability = activationState.capability;
  const configuredActive = activationState.configuredEnabled;
  const hasLiveRuntimeState = activationState.hasLiveRuntimeState;
  const applicationStatus = buildApplicationStatus({
    capability,
    capabilityAllowsPreview: activationState.capabilityAllowsPreview,
    configuredActive,
    runtime,
    runtimeSnapshotError: activationState.runtimeSnapshotError,
    runtimeState: activationState.runtimeState,
    t,
  });
  const runtimeState = activationState.runtimeState;
  const runtimeStateLabel = hasLiveRuntimeState
    ? (
      activationState.runtimeAvailable
        ? t(`artifacts.runtime.states.${runtimeState}`)
        : (activationState.capabilityAllowsPreview && configuredActive ? t('status.on') : t('artifacts.runtime.unavailable'))
    )
    : (configuredActive ? t('status.on') : t('status.off'));
  const runtimeScopeLabel = hasLiveRuntimeState
    ? (runtime.scopeHost || '')
    : (runtime.executionKind ? t(`artifacts.runtime.execution_kinds.${runtime.executionKind}`) : '');
  const runtimeToneClass = hasLiveRuntimeState
    ? (
      activationState.runtimeAvailable
        ? (ARTIFACT_RUNTIME_TONE_CLASS[runtimeState] || 'text-on-surface-muted')
        : (activationState.capabilityAllowsPreview && configuredActive ? 'text-accent' : 'text-on-surface-muted')
    )
    : (configuredActive ? 'text-accent' : 'text-on-surface-muted');

  return {
    activationState,
    canonicalId: canonicalArtifactId,
    artifactId: canonicalArtifactId,
    familyId: canonicalArtifactId,
    themeId,
    artifactTitleKey: artifactDefinition?.titleKey || '',
    artifactDescriptionKey: artifactDefinition?.descriptionKey || '',
    manifestationKey: definition.manifestationKey || '',
    visualKey: definition.visualKey,
    runtimeState,
    runtimeStateLabel,
    runtimeScopeLabel,
    runtimeToneClass,
    isRuntimeActive: activationState.isRuntimeActive,
    isPreviewActive: activationState.isPreviewActive,
    capability,
    applicationStatus,
  };
}

export { buildToolsArtifactDisplayCopy } from './artifactDisplayCopy.js';
