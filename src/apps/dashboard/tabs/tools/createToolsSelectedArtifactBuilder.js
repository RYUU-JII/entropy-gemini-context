import { TOOLS_ARTIFACT_DEFINITIONS } from '@/themes/core/tools/artifacts.js';
import { resolveToolsArtifactActivationFromRuntime } from './artifactActivationState.js';
import { retainArtifactProjection } from '@/apps/dashboard/hooks/artifactSettings/artifactProjectionIdentity.js';
import { assertToolsArtifactFamilyContract, buildMaterializedArtifact } from './artifactCardMaterialization.jsx';

// A selected controller supplies exactly one family's canonical projection.
// Sibling navigation no longer needs configuration, permissions or telemetry.
export function createToolsSelectedArtifactBuilder(schema) {
  if (!schema || typeof schema.id !== 'string' || typeof schema.build !== 'function'
    || typeof schema.extendDerivedState !== 'function') {
    throw new Error('TOOLS_SELECTED_ARTIFACT_SCHEMA_REQUIRED');
  }
  let previous = null;
  return ({ t, components, state, handlers, runtime, selectedArtifactId }) => {
    const definition = TOOLS_ARTIFACT_DEFINITIONS.find((entry) => entry.id === selectedArtifactId);
    if (!definition) throw new Error(`TOOLS_SELECTED_ARTIFACT_UNKNOWN:${selectedArtifactId}`);
    if (schema.id !== selectedArtifactId) throw new Error('TOOLS_SELECTED_ARTIFACT_SCHEMA_MISMATCH');
    assertToolsArtifactFamilyContract({ state, handlers, artifactCardSchemaEntries: [{ definition, schema }] });
    const activation = resolveToolsArtifactActivationFromRuntime({
      artifactId: selectedArtifactId,
      familyState: state.artifactFamilies[selectedArtifactId],
      artifactCapabilityState: state.artifactCapabilityState,
      artifactRuntimeSnapshotError: runtime.artifactRuntimeSnapshotError,
      runtime: runtime.artifactRuntimeProjection.summary,
    });
    const derived = schema.extendDerivedState({ components, state, handlers, t,
      runtime: { artifactRuntimeChildren: runtime.artifactRuntimeProjection.children } });
    const next = buildMaterializedArtifact({
      activationDerivedState: { ...state, ...derived, themeId: components.themeId,
        artifactActivationStates: { [selectedArtifactId]: activation } },
      artifactDisclosureSnapshot: runtime.artifactDisclosureSnapshot,
      components, definition, handlers, schema, t,
    });
    for (const key of ['artifactVisualState', 'artifactActivity', 'artifactPresentation', 'artifactPreviewRenderState']) {
      next[key] = retainArtifactProjection(previous?.[key], next[key]);
    }
    previous = next;
    return next;
  };
}
