import { getExtensionApi } from '../../../../platform/extension/extensionApi.js';
import {
  normalizeProfileMutationResponseHandoff,
} from '../../../../platform/messaging/contracts/profileMutationResponseHandoff.js';

function requireRuntimeReload(extensionApi) {
  const runtime = extensionApi?.runtime;
  if (!runtime || typeof runtime.reload !== 'function') {
    throw new Error('PROFILE_MUTATION_RUNTIME_RELOAD_PORT_REQUIRED');
  }
  return runtime.reload.bind(runtime);
}

export function createBackgroundKernelProfileMutationRuntimeLifetimePort({
  extensionApi = getExtensionApi(),
} = {}) {
  const reloadRuntime = requireRuntimeReload(extensionApi);

  return Object.freeze({
    completeProfileMutationRuntimeHandoff({ profileMutationHandoff } = {}) {
      normalizeProfileMutationResponseHandoff(profileMutationHandoff);
      try {
        reloadRuntime();
      } catch (cause) {
        const error = new Error('PROFILE_MUTATION_RUNTIME_RELOAD_HANDOFF_FAILED');
        error.code = 'PROFILE_MUTATION_RUNTIME_RELOAD_HANDOFF_FAILED';
        error.cause = cause;
        throw error;
      }
    },
  });
}

export default createBackgroundKernelProfileMutationRuntimeLifetimePort;
