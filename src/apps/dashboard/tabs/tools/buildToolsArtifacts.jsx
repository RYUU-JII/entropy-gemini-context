import { assertToolsArtifactFamilyContract, buildMaterializedArtifact } from './artifactCardMaterialization.jsx';
import { getToolsArtifactCardSchema } from './artifactCardSchemas.jsx';
import {
  buildToolsArtifactDisplayCopy,
  buildToolsArtifactShell,
} from './artifactShells.js';
import { TOOLS_ARTIFACT_DEFINITIONS } from '../../../../themes/core/tools/artifacts.js';
import { resolveToolsArtifactActivationState } from './artifactActivationState.js';
import { selectCanonicalProtectionArtifactChildRuntimeStates } from '@/domains/protection/runtime/canonicalArtifactTelemetry.js';

function resolveToolsArtifactCardSchema(definition) {
  const schema = getToolsArtifactCardSchema(definition.id);
  if (!schema || typeof schema !== 'object') {
    throw new Error(`Missing tools artifact card schema for "${definition.id}".`);
  }
  if (typeof schema.build !== 'function') {
    throw new Error(`Missing tools artifact card builder for "${definition.id}".`);
  }
  return schema;
}

function sortArtifactCardSchemaEntriesByDisclosureSnapshot(entries, artifactDisclosureSnapshot) {
  const orderedArtifactIds = Array.isArray(artifactDisclosureSnapshot?.orderedFamilyIds)
    ? artifactDisclosureSnapshot.orderedFamilyIds
    : [];
  if (!orderedArtifactIds.length) return entries;

  const rankByArtifactId = orderedArtifactIds.reduce((acc, artifactId, index) => {
    if (typeof artifactId === 'string' && artifactId.trim()) {
      acc[artifactId.trim()] = index;
    }
    return acc;
  }, {});

  return [...entries].sort((left, right) => {
    const leftRank = Object.prototype.hasOwnProperty.call(rankByArtifactId, left.definition.id)
      ? rankByArtifactId[left.definition.id]
      : Number.MAX_SAFE_INTEGER;
    const rightRank = Object.prototype.hasOwnProperty.call(rankByArtifactId, right.definition.id)
      ? rankByArtifactId[right.definition.id]
      : Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return TOOLS_ARTIFACT_DEFINITIONS.findIndex((definition) => definition.id === left.definition.id)
      - TOOLS_ARTIFACT_DEFINITIONS.findIndex((definition) => definition.id === right.definition.id);
  });
}

function resolveToolsArtifactCardSchemaEntries({ artifactDisclosureSnapshot = null } = {}) {
  const entries = TOOLS_ARTIFACT_DEFINITIONS.map((definition) => Object.freeze({
    definition,
    schema: resolveToolsArtifactCardSchema(definition),
  }));
  return sortArtifactCardSchemaEntriesByDisclosureSnapshot(entries, artifactDisclosureSnapshot);
}

function buildDerivedArtifactState({
  components = {},
  state = {},
  handlers = {},
  runtime = {},
  artifactCardSchemaEntries = resolveToolsArtifactCardSchemaEntries(),
  t,
} = {}) {
  const baseState = {
    ...state,
    themeId: components.themeId || '',
  };

  return artifactCardSchemaEntries.reduce((derivedState, { definition, schema }) => {
    if (typeof schema?.extendDerivedState !== 'function') {
      return derivedState;
    }
    return {
      ...derivedState,
      ...schema.extendDerivedState({ components, state, handlers, runtime: {
        ...runtime,
        artifactRuntimeChildren: selectCanonicalProtectionArtifactChildRuntimeStates(runtime.artifactRuntimeSnapshot, definition.id),
      }, t }),
    };
  }, baseState);
}

function resolveGalleryMaterializedArtifactId(artifactCardSchemaEntries, selectedArtifactId = '') {
  if (typeof selectedArtifactId !== 'string') {
    throw new Error('[buildToolsArtifacts] Selected artifact id must be a string.');
  }
  const normalizedSelectedArtifactId = selectedArtifactId.trim();
  const selectedEntry = artifactCardSchemaEntries.find(
    ({ definition }) => definition.id === normalizedSelectedArtifactId,
  );
  return selectedEntry?.definition.id || artifactCardSchemaEntries[0]?.definition.id || '';
}

export function resolveToolsArtifactGalleryMaterializedArtifactId(
  artifactDisclosureSnapshot,
  selectedArtifactId = '',
) {
  if (!artifactDisclosureSnapshot || typeof artifactDisclosureSnapshot !== 'object') {
    throw new Error('[buildToolsArtifacts] Canonical artifact disclosure snapshot is required.');
  }
  const artifactCardSchemaEntries = resolveToolsArtifactCardSchemaEntries({ artifactDisclosureSnapshot })
    .filter(({ definition }) => (
      artifactDisclosureSnapshot.entriesByFamilyId?.[definition.id]?.visible === true
    ));
  return resolveGalleryMaterializedArtifactId(artifactCardSchemaEntries, selectedArtifactId);
}

function buildArtifactNavigationItem({
  activationDerivedState,
  artifactDisclosureSnapshot,
  components,
  definition,
  t,
}) {
  const artifactActivationState = activationDerivedState.artifactActivationStates[definition.id];
  const shell = buildToolsArtifactShell({
    artifactId: definition.id,
    activationState: artifactActivationState,
    themeId: components.themeId,
    t,
  });

  return {
    ...shell,
    ...buildToolsArtifactDisplayCopy(shell, t),
    artifactDisclosure: artifactDisclosureSnapshot.entriesByFamilyId?.[definition.id] || null,
  };
}

function buildToolsArtifactCollection({
  t,
  components = {},
  state = {},
  handlers = {},
  runtime = {},
  selectedArtifactId = '',
  materializeSelectedOnly = false,
}) {
  const artifactDisclosureSnapshot = runtime.artifactDisclosureSnapshot;
  if (!artifactDisclosureSnapshot || typeof artifactDisclosureSnapshot !== 'object') {
    throw new Error('[buildToolsArtifacts] Canonical artifact disclosure snapshot is required.');
  }
  const artifactCardSchemaEntries = resolveToolsArtifactCardSchemaEntries({ artifactDisclosureSnapshot })
    .filter(({ definition }) => (
      artifactDisclosureSnapshot.entriesByFamilyId?.[definition.id]?.visible === true
    ));
  assertToolsArtifactFamilyContract({
    state,
    handlers,
    artifactCardSchemaEntries,
  });
  const materializedArtifactId = materializeSelectedOnly
    ? resolveGalleryMaterializedArtifactId(artifactCardSchemaEntries, selectedArtifactId)
    : '';
  const derivedStateEntries = materializeSelectedOnly
    ? artifactCardSchemaEntries.filter(({ definition }) => definition.id === materializedArtifactId)
    : artifactCardSchemaEntries;
  const derivedState = buildDerivedArtifactState({
    components,
    state,
    handlers,
    runtime,
    artifactCardSchemaEntries: derivedStateEntries,
    t,
  });
  const artifactActivationStates = artifactCardSchemaEntries.reduce((acc, { definition }) => {
    acc[definition.id] = resolveToolsArtifactActivationState({
      artifactId: definition.id,
      familyState: derivedState.artifactFamilies?.[definition.id],
      artifactRuntimeSnapshot: runtime.artifactRuntimeSnapshot,
      artifactRuntimeSnapshotError: runtime.artifactRuntimeSnapshotError,
      artifactCapabilityState: derivedState.artifactCapabilityState,
    });
    return acc;
  }, {});
  const activationDerivedState = {
    ...derivedState,
    artifactActivationStates: Object.freeze(artifactActivationStates),
  };

  return artifactCardSchemaEntries.map(({ definition, schema }) => (
    materializeSelectedOnly && definition.id !== materializedArtifactId
      ? buildArtifactNavigationItem({
        activationDerivedState,
        artifactDisclosureSnapshot,
        components,
        definition,
        t,
      })
      : buildMaterializedArtifact({
        activationDerivedState,
        artifactDisclosureSnapshot,
        components,
        definition,
        handlers,
        schema,
        t,
      })
  ));
}

export function buildToolsArtifacts(options = {}) {
  return buildToolsArtifactCollection(options);
}

export function buildToolsArtifactGalleryItems(options = {}) {
  return buildToolsArtifactCollection({
    ...options,
    materializeSelectedOnly: true,
  });
}
