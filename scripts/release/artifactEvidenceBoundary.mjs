// Build evidence is validated beside the artifact and excluded from its payload.
export const ARTIFACT_BUILD_EVIDENCE_DIRECTORY = '.vite';

// Callers supply the directory path relative to the artifact root.
export function isArtifactBuildEvidenceDirectory(relativePath) {
  return relativePath === ARTIFACT_BUILD_EVIDENCE_DIRECTORY;
}
