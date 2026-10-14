export const PROTECTION_CANONICAL_ARTIFACT_IDS = Object.freeze({
  VEIL: 'veil',
  LENS: 'lens',
  BARRIER: 'barrier',
  GATE: 'gate',
  BRAKE: 'brake',
  FLARE: 'flare',
  ECHO: 'echo',
});

const {
  VEIL,
  LENS,
  BARRIER,
  GATE,
  BRAKE,
  FLARE,
  ECHO,
} = PROTECTION_CANONICAL_ARTIFACT_IDS;

const LENS_RELEASE_CHILD_GROUPS = Object.freeze([
  Object.freeze({ id: 'primary', children: Object.freeze(['saturation', 'brightness', 'blur']) }),
  Object.freeze({ id: 'secondary', children: Object.freeze(['contrast', 'grayscale']) }),
]);

export const PROTECTION_CANONICAL_ARTIFACT_CATALOG = Object.freeze({
  [VEIL]: Object.freeze({
    id: VEIL,
    titleKey: 'artifacts.veil.title',
    descriptionKey: 'artifacts.veil.desc',
    releaseChildren: Object.freeze([
      'socialMetrics',
      'timeSignals',
      'shortformBlock',
    ]),
  }),
  [LENS]: Object.freeze({
    id: LENS,
    titleKey: 'artifacts.lens.title',
    descriptionKey: 'artifacts.lens.desc',
    releaseChildGroups: LENS_RELEASE_CHILD_GROUPS,
    releaseChildren: Object.freeze(LENS_RELEASE_CHILD_GROUPS.flatMap(group => group.children)),
  }),
  [BARRIER]: Object.freeze({
    id: BARRIER,
    titleKey: 'artifacts.barrier.title',
    descriptionKey: 'artifacts.barrier.desc',
    releaseChildren: Object.freeze([
      'textRhythm',
      'intentThreshold',
      'detourSpreadGuard',
    ]),
  }),
  [GATE]: Object.freeze({
    id: GATE,
    titleKey: 'artifacts.gate.title',
    descriptionKey: 'artifacts.gate.desc',
    releaseChildren: Object.freeze([
      'entryCheckpoint',
      'returnGuard',
    ]),
  }),
  [BRAKE]: Object.freeze({
    id: BRAKE,
    titleKey: 'artifacts.brake.title',
    descriptionKey: 'artifacts.brake.desc',
    releaseChildren: Object.freeze([
      'clickPause',
      'scrollFriction',
      'inputVisualBrake',
      'skipFriction',
    ]),
  }),
  [FLARE]: Object.freeze({
    id: FLARE,
    titleKey: 'artifacts.flare.title',
    descriptionKey: 'artifacts.flare.desc',
    releaseChildren: Object.freeze([
      'sentinelFlare',
    ]),
  }),
  [ECHO]: Object.freeze({
    id: ECHO,
    titleKey: 'artifacts.echo.title',
    descriptionKey: 'artifacts.echo.desc',
    releaseChildren: Object.freeze([
      'historyCleanup',
      'bookmarkConceal',
      'tabEvaporation',
    ]),
  }),
});

function assertCanonicalArtifactCatalog() {
  const declaredIds = Object.values(PROTECTION_CANONICAL_ARTIFACT_IDS);
  const catalogIds = Object.keys(PROTECTION_CANONICAL_ARTIFACT_CATALOG);

  if (new Set(declaredIds).size !== declaredIds.length) {
    throw new Error('[artifactFamilyCatalog] Canonical artifact ids must be unique.');
  }
  if (
    declaredIds.length !== catalogIds.length
    || declaredIds.some((artifactId) => !catalogIds.includes(artifactId))
  ) {
    throw new Error('[artifactFamilyCatalog] Canonical artifact ids and catalog entries must match exactly.');
  }

  catalogIds.forEach((artifactId) => {
    const definition = PROTECTION_CANONICAL_ARTIFACT_CATALOG[artifactId];
    if (definition?.id !== artifactId) {
      throw new Error(`[artifactFamilyCatalog] Catalog key/id mismatch for "${artifactId}".`);
    }
    if (typeof definition.titleKey !== 'string' || !definition.titleKey.trim()) {
      throw new Error(`[artifactFamilyCatalog] Missing title key for "${artifactId}".`);
    }
    if (typeof definition.descriptionKey !== 'string' || !definition.descriptionKey.trim()) {
      throw new Error(`[artifactFamilyCatalog] Missing description key for "${artifactId}".`);
    }
    if (!Array.isArray(definition.releaseChildren) || definition.releaseChildren.length === 0) {
      throw new Error(`[artifactFamilyCatalog] "${artifactId}" must declare release children.`);
    }
    if (new Set(definition.releaseChildren).size !== definition.releaseChildren.length) {
      throw new Error(`[artifactFamilyCatalog] "${artifactId}" release children must be unique.`);
    }
    if (definition.releaseChildGroups) {
      const groups = definition.releaseChildGroups;
      if (!Array.isArray(groups) || !groups.length
        || groups.some(group => typeof group?.id !== 'string' || !group.id.trim()
          || !Array.isArray(group.children) || !group.children.length)
        || new Set(groups.map(group => group.id)).size !== groups.length
        || groups.flatMap(group => group.children).join('|') !== definition.releaseChildren.join('|')) {
        throw new Error(`[artifactFamilyCatalog] "${artifactId}" release child groups must exhaust its ordered children exactly once.`);
      }
    }

    definition.releaseChildren.forEach((childId) => {
      if (typeof childId !== 'string' || !childId.trim()) {
        throw new Error(`[artifactFamilyCatalog] "${artifactId}" contains an invalid release child id.`);
      }
    });
  });
}

assertCanonicalArtifactCatalog();

export const PROTECTION_CANONICAL_ARTIFACT_ID_LIST = Object.freeze(
  Object.keys(PROTECTION_CANONICAL_ARTIFACT_CATALOG),
);

export function getCanonicalArtifactDefinition(artifactId) {
  return PROTECTION_CANONICAL_ARTIFACT_CATALOG?.[artifactId] || null;
}

export function isCanonicalArtifactId(value) {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(PROTECTION_CANONICAL_ARTIFACT_CATALOG, value);
}

export const PROTECTION_ARTIFACT_FAMILY_IDS = PROTECTION_CANONICAL_ARTIFACT_IDS;
export const PROTECTION_ARTIFACT_FAMILY_CATALOG = PROTECTION_CANONICAL_ARTIFACT_CATALOG;
export const getArtifactFamilyDefinition = getCanonicalArtifactDefinition;
export const isArtifactFamilyId = isCanonicalArtifactId;
