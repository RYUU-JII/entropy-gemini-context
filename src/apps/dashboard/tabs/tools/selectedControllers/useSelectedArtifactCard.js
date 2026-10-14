import { useLayoutEffect, useMemo, useRef } from 'react';
import { createToolsSelectedArtifactBuilder } from '../createToolsSelectedArtifactBuilder.js';

export function useSelectedArtifactCard(controller, presentation, isActive, schema) {
  const buildArtifact = useMemo(() => createToolsSelectedArtifactBuilder(schema), [schema]);
  const retainedRef = useRef(null);
  const { artifactId, artifactState, artifactHandlers, artifactRuntimeProjection, artifactRuntimeSnapshotError, navigationBlocked } = controller;
  const { themeId, artifactDisclosureSnapshot, t } = presentation;
  const artifact = useMemo(() => {
    if (!isActive) return retainedRef.current;
    return buildArtifact({
      t, components: { themeId }, state: artifactState, handlers: artifactHandlers,
      runtime: { artifactRuntimeProjection, artifactRuntimeSnapshotError, artifactDisclosureSnapshot },
      selectedArtifactId: artifactId,
    });
  }, [buildArtifact, t, themeId, artifactState, artifactHandlers, artifactRuntimeProjection,
    artifactRuntimeSnapshotError, artifactDisclosureSnapshot, artifactId, isActive]);
  useLayoutEffect(() => { if (isActive) retainedRef.current = artifact; }, [artifact, isActive]);
  return useMemo(() => ({ artifactId, artifact, navigationBlocked }), [artifactId, artifact, navigationBlocked]);
}
