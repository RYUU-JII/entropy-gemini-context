import { requireArtifactControlState } from '../../settings/config/artifactControlState.js';
import { describeArtifactControlStateForFamily } from './ArtifactControlService.js';

export function isEchoArtifactMutationSuppressed(settings) {
  const controlState = requireArtifactControlState(settings?.artifactControlState);
  return describeArtifactControlStateForFamily(controlState, 'echo').suppressed;
}

export function requireEchoArtifactMutationCurrent(isCurrent) {
  if (typeof isCurrent !== 'function') {
    throw new Error('ECHO_ARTIFACT_MUTATION_POLICY_REQUIRED');
  }
  const current = isCurrent();
  if (typeof current !== 'boolean') {
    throw new Error('ECHO_ARTIFACT_MUTATION_POLICY_RESULT_INVALID');
  }
  if (!current) {
    const error = new Error('ECHO_ARTIFACT_MUTATION_CANCELLED');
    error.code = 'ECHO_ARTIFACT_MUTATION_CANCELLED';
    throw error;
  }
}
