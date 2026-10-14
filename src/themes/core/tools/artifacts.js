import { PROTECTION_CANONICAL_ARTIFACT_ID_LIST } from '../../../domains/protection/catalog/artifactFamilyCatalog.js';

const TOOLS_ARTIFACT_DEFINITION_MAP = Object.freeze({
  veil: Object.freeze({
    id: 'veil',
    manifestationKey: 'enso',
    visualKey: 'veil',
    widgetType: 'Artifact_Veil',
    renderTier: 'motion',
  }),
  lens: Object.freeze({
    id: 'lens',
    manifestationKey: 'shoji',
    visualKey: 'lens',
    widgetType: 'Artifact_Lens',
    renderTier: 'motion',
  }),
  barrier: Object.freeze({
    id: 'barrier',
    manifestationKey: 'time_anchor',
    visualKey: 'monolith',
    widgetType: 'Artifact_Monolith',
    renderTier: 'motion',
  }),
  gate: Object.freeze({
    id: 'gate',
    manifestationKey: 'loop_breaker',
    visualKey: 'gate',
    widgetType: 'Artifact_Gate',
    renderTier: 'simulation',
  }),
  brake: Object.freeze({
    id: 'brake',
    manifestationKey: 'rhythm_brake',
    visualKey: 'brake',
    widgetType: 'Artifact_Brake',
    renderTier: 'motion',
  }),
  flare: Object.freeze({
    id: 'flare',
    manifestationKey: 'sentinel_flare',
    visualKey: 'sentinelFlare',
    widgetType: 'Artifact_SentinelFlare',
    renderTier: 'simulation',
  }),
  echo: Object.freeze({
    id: 'echo',
    manifestationKey: 'memory_purge',
    visualKey: 'lethe',
    widgetType: 'Artifact_Lethe',
    renderTier: 'motion',
  }),
});

function assertToolsArtifactDefinitionContract() {
  const definitionIds = Object.keys(TOOLS_ARTIFACT_DEFINITION_MAP);
  if (
    definitionIds.length !== PROTECTION_CANONICAL_ARTIFACT_ID_LIST.length
    || PROTECTION_CANONICAL_ARTIFACT_ID_LIST.some((artifactId) => !definitionIds.includes(artifactId))
  ) {
    throw new Error('[toolsArtifacts] Theme manifestation definitions must cover every canonical artifact family exactly once.');
  }

  const visualKeys = new Set();
  const widgetTypes = new Set();
  definitionIds.forEach((artifactId) => {
    const definition = TOOLS_ARTIFACT_DEFINITION_MAP[artifactId];
    if (definition?.id !== artifactId) {
      throw new Error(`[toolsArtifacts] Definition key/id mismatch for "${artifactId}".`);
    }
    ['manifestationKey', 'visualKey', 'widgetType', 'renderTier'].forEach((field) => {
      if (typeof definition[field] !== 'string' || !definition[field].trim()) {
        throw new Error(`[toolsArtifacts] "${artifactId}" is missing ${field}.`);
      }
    });
    if (visualKeys.has(definition.visualKey)) {
      throw new Error(`[toolsArtifacts] Duplicate artifact visual key "${definition.visualKey}".`);
    }
    if (widgetTypes.has(definition.widgetType)) {
      throw new Error(`[toolsArtifacts] Duplicate artifact widget type "${definition.widgetType}".`);
    }
    visualKeys.add(definition.visualKey);
    widgetTypes.add(definition.widgetType);
  });
}

assertToolsArtifactDefinitionContract();

export const TOOLS_ARTIFACT_DEFINITIONS = Object.freeze(
  PROTECTION_CANONICAL_ARTIFACT_ID_LIST.map(
    (artifactId) => TOOLS_ARTIFACT_DEFINITION_MAP[artifactId],
  ),
);

const TOOLS_ARTIFACT_VISUAL_KEY_MAP = Object.freeze(
  TOOLS_ARTIFACT_DEFINITIONS.reduce((acc, definition) => {
    acc[definition.visualKey] = definition;
    return acc;
  }, {}),
);

export const TOOLS_ARTIFACT_VISUAL_KEYS = Object.freeze(
  TOOLS_ARTIFACT_DEFINITIONS.map((definition) => definition.visualKey),
);

export const TOOLS_ARTIFACT_WIDGET_TYPES = Object.freeze(
  [...new Set(TOOLS_ARTIFACT_DEFINITIONS.map((definition) => definition.widgetType))],
);

export function getToolsArtifactDefinition(artifactId) {
  const normalized = typeof artifactId === 'string' ? artifactId.trim() : '';
  if (!normalized) return null;
  return TOOLS_ARTIFACT_DEFINITION_MAP[normalized] || null;
}

export function getToolsArtifactDefinitionByVisualKey(visualKey) {
  const normalized = typeof visualKey === 'string' ? visualKey.trim() : '';
  if (!normalized) return null;
  return TOOLS_ARTIFACT_VISUAL_KEY_MAP[normalized] || null;
}

export function getToolsArtifactVisualKey(artifactId, fallback = '') {
  return getToolsArtifactDefinition(artifactId)?.visualKey || fallback;
}

export function getToolsArtifactWidgetTypeByVisualKey(visualKey, fallback = '') {
  return getToolsArtifactDefinitionByVisualKey(visualKey)?.widgetType || fallback;
}

export function getToolsArtifactWidgetTypes() {
  return [...TOOLS_ARTIFACT_WIDGET_TYPES];
}

export function getToolsArtifactRenderTier(artifactId, fallback = 'motion') {
  const tier = getToolsArtifactDefinition(artifactId)?.renderTier;
  return typeof tier === 'string' && tier.trim() ? tier : fallback;
}

export function getToolsArtifactCopyKey(artifactId, fallback = '') {
  const definition = getToolsArtifactDefinition(artifactId);
  return definition?.manifestationKey || definition?.id || fallback;
}
