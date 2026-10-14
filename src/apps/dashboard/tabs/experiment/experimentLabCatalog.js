const EMPTY_WIDGET_TYPES = Object.freeze([]);
const PREFERENCE_PROTOCOL_HYDRATION = Object.freeze(['preference', 'protocol']);

export const EXPERIMENT_LAB_MODULE_OWNERS = Object.freeze({
  WORKSPACE: 'workspace',
  CLSE: 'clse',
});

export const EXPERIMENT_LAB_SECTION_IDS = Object.freeze({
  HOME: 'home',
  BONSAI_CLASSIC: 'bonsai_classic',
  SAKURA_REFINEMENT: 'sakura_refinement',
  BONSAI_VNEXT: 'bonsai_vnext',
  BONSAI_RENDER_DEBUG: 'bonsai_render_debug',
  SENTINEL_PROTOCOL: 'sentinel_protocol',
  BOOT: 'boot',
  RUNTIME: 'runtime',
  STATS_SITES: 'stats_rules',
  CEREMONY: 'ceremony',
  POND: 'pond',
  SOLAR_TOKEN_REFINEMENT: 'solar_token_refinement',
  ARTIFACT_DISCLOSURE: 'artifact_disclosure',
  ARTIFACT: 'artifact',
  CLSE: 'clse',
});

const EXPERIMENT_LAB_ORDER = Object.freeze([
  EXPERIMENT_LAB_SECTION_IDS.BONSAI_CLASSIC,
  EXPERIMENT_LAB_SECTION_IDS.SAKURA_REFINEMENT,
  EXPERIMENT_LAB_SECTION_IDS.BONSAI_VNEXT,
  EXPERIMENT_LAB_SECTION_IDS.BONSAI_RENDER_DEBUG,
  EXPERIMENT_LAB_SECTION_IDS.SENTINEL_PROTOCOL,
  EXPERIMENT_LAB_SECTION_IDS.BOOT,
  EXPERIMENT_LAB_SECTION_IDS.RUNTIME,
  EXPERIMENT_LAB_SECTION_IDS.STATS_SITES,
  EXPERIMENT_LAB_SECTION_IDS.CLSE,
  EXPERIMENT_LAB_SECTION_IDS.CEREMONY,
  EXPERIMENT_LAB_SECTION_IDS.POND,
  EXPERIMENT_LAB_SECTION_IDS.SOLAR_TOKEN_REFINEMENT,
  EXPERIMENT_LAB_SECTION_IDS.ARTIFACT_DISCLOSURE,
  EXPERIMENT_LAB_SECTION_IDS.ARTIFACT,
]);

const EXPERIMENT_LAB_CATALOG = Object.freeze({
  [EXPERIMENT_LAB_SECTION_IDS.HOME]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.HOME,
    copyKey: 'home',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.SOLAR_TOKEN_REFINEMENT]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.SOLAR_TOKEN_REFINEMENT,
    copyKey: 'solar_token_refinement',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.SAKURA_REFINEMENT]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.SAKURA_REFINEMENT,
    copyKey: 'sakura_refinement',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.BONSAI_CLASSIC]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.BONSAI_CLASSIC,
    copyKey: 'bonsai_classic',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: Object.freeze(['CoreStatus']),
  }),
  [EXPERIMENT_LAB_SECTION_IDS.BONSAI_VNEXT]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.BONSAI_VNEXT,
    copyKey: 'bonsai_vnext',
    requiresVNext: true,
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.BONSAI_RENDER_DEBUG]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.BONSAI_RENDER_DEBUG,
    copyKey: 'bonsai_render_debug',
    requiresRenderDebug: true,
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.SENTINEL_PROTOCOL]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.SENTINEL_PROTOCOL,
    copyKey: 'sentinel_protocol',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.BOOT]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.BOOT,
    copyKey: 'boot',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.RUNTIME]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.RUNTIME,
    copyKey: 'runtime',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.STATS_SITES]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.STATS_SITES,
    copyKey: 'stats_rules',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.CLSE]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.CLSE,
    copyKey: 'clse',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.CEREMONY]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.CEREMONY,
    copyKey: 'ceremony',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.POND]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.POND,
    copyKey: 'pond',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: Object.freeze(['SignalScanner', 'SignalTuner']),
  }),
  [EXPERIMENT_LAB_SECTION_IDS.ARTIFACT_DISCLOSURE]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.ARTIFACT_DISCLOSURE,
    copyKey: 'artifact_disclosure',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: EMPTY_WIDGET_TYPES,
  }),
  [EXPERIMENT_LAB_SECTION_IDS.ARTIFACT]: Object.freeze({
    id: EXPERIMENT_LAB_SECTION_IDS.ARTIFACT,
    copyKey: 'artifact',
    hydrationKeys: PREFERENCE_PROTOCOL_HYDRATION,
    widgetTypes: Object.freeze([
      'Artifact_Monolith',
      'Artifact_Gate',
      'Artifact_Lethe',
      'Artifact_SentinelFlare',
      'Artifact_SentinelFlareTuner',
      'Artifact_GateTuner',
    ]),
  }),
});

function getExperimentLabDefinition(sectionId) {
  if (typeof sectionId !== 'string') return null;
  return EXPERIMENT_LAB_CATALOG[sectionId] || null;
}

export function getExperimentLabSections({
  includeVNextSection = false,
  includeRenderDebugSection = false,
} = {}) {
  return EXPERIMENT_LAB_ORDER.filter((sectionId) => {
    const definition = getExperimentLabDefinition(sectionId);
    if (!definition) return false;
    if (definition.requiresVNext && !includeVNextSection) return false;
    if (definition.requiresRenderDebug && !includeRenderDebugSection) return false;
    return true;
  });
}

export function normalizeExperimentLabSectionId(sectionId, {
  includeVNextSection = false,
  includeRenderDebugSection = false,
  fallbackSectionId = EXPERIMENT_LAB_SECTION_IDS.HOME,
} = {}) {
  const rawSectionId = typeof sectionId === 'string' ? sectionId.trim().toLowerCase() : '';
  if (rawSectionId === EXPERIMENT_LAB_SECTION_IDS.HOME) {
    return EXPERIMENT_LAB_SECTION_IDS.HOME;
  }
  const visibleSections = getExperimentLabSections({
    includeVNextSection,
    includeRenderDebugSection,
  });
  return visibleSections.includes(rawSectionId) ? rawSectionId : fallbackSectionId;
}

export function getExperimentLabSectionCopyKeys(sectionId) {
  const definition = getExperimentLabDefinition(sectionId)
    || getExperimentLabDefinition(EXPERIMENT_LAB_SECTION_IDS.HOME);
  const prefix = `experiment.lab_sections.${definition.copyKey}`;
  return Object.freeze({
    label: `${prefix}.label`,
    title: `${prefix}.title`,
    description: `${prefix}.desc`,
  });
}

export function getExperimentLabReadinessProfile(sectionId) {
  const definition = getExperimentLabDefinition(sectionId)
    || getExperimentLabDefinition(EXPERIMENT_LAB_SECTION_IDS.HOME);
  return Object.freeze({
    surfaceId: definition.id,
    hydrationKeys: definition.hydrationKeys,
    widgetTypes: definition.widgetTypes,
  });
}

export function hasAsyncExperimentLabModule(sectionId) {
  return getExperimentLabModuleOwner(sectionId) !== null;
}

export function getExperimentLabModuleOwner(sectionId) {
  const definition = getExperimentLabDefinition(sectionId);
  if (!definition || definition.id === EXPERIMENT_LAB_SECTION_IDS.HOME) {
    return null;
  }
  return definition.id === EXPERIMENT_LAB_SECTION_IDS.CLSE
    ? EXPERIMENT_LAB_MODULE_OWNERS.CLSE
    : EXPERIMENT_LAB_MODULE_OWNERS.WORKSPACE;
}
