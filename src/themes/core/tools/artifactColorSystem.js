import { assertThemePluginId } from '../runtime/pluginCatalog.js';
import {
  TOOLS_ARTIFACT_DEFINITIONS,
  getToolsArtifactDefinition,
  getToolsArtifactDefinitionByVisualKey,
} from './artifacts.js';
import { ZEN_ARTIFACT_COLOR_TOKENS } from './zenArtifactColorTokens.js';

export { ZEN_ARTIFACT_COLOR_TOKENS };

export const ARTIFACT_COLOR_FAMILIES = Object.freeze({
  pearl: 'pearl',
  antiqueGold: 'antique_gold',
  earthUmber: 'earth_umber',
  sumi: 'sumi',
  jade: 'jade',
  indigo: 'indigo',
  vermilion: 'vermilion',
  resonanceCyan: 'resonance_cyan',
});

const RESERVED_ARTIFACT_COLOR_IDS = Object.freeze({
  resonance: 'resonance',
});

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function assertHexColor(value, field, artifactId) {
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
    throw new Error(
      `[artifactColorSystem] ${artifactId}.${field} must be a six-digit hex color.`,
    );
  }
  return value.toLowerCase();
}

function clampOpacity(value, field, artifactId) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new Error(
      `[artifactColorSystem] ${artifactId}.${field} must be between 0 and 1.`,
    );
  }
  return numeric;
}

function createArtifactColorTokens({
  artifactId,
  family,
  artifact,
  controls,
  navigation,
  scene,
}) {
  if (!artifactId || !family) {
    throw new Error('[artifactColorSystem] Artifact color tokens require artifactId and family.');
  }

  const artifactColor = assertHexColor(artifact?.color, 'artifact.color', artifactId);
  const artifactGlow = assertHexColor(artifact?.glow, 'artifact.glow', artifactId);
  const artifactContrast = assertHexColor(
    artifact?.contrast,
    'artifact.contrast',
    artifactId,
  );
  const controlAccent = assertHexColor(
    controls?.accent,
    'controls.accent',
    artifactId,
  );
  const navigationActive = assertHexColor(
    navigation?.active,
    'navigation.active',
    artifactId,
  );
  const navigationGlow = assertHexColor(
    navigation?.glow,
    'navigation.glow',
    artifactId,
  );
  const sceneTint = assertHexColor(scene?.tint, 'scene.tint', artifactId);

  return Object.freeze({
    artifactId,
    family,
    artifact: Object.freeze({
      color: artifactColor,
      glow: artifactGlow,
      contrast: artifactContrast,
      mode: typeof artifact?.mode === 'string' && artifact.mode.trim()
        ? artifact.mode.trim()
        : 'static',
    }),
    controls: Object.freeze({
      accent: controlAccent,
    }),
    navigation: Object.freeze({
      active: navigationActive,
      glow: navigationGlow,
    }),
    scene: Object.freeze({
      tint: sceneTint,
      vignetteOpacity: clampOpacity(
        scene?.vignetteOpacity,
        'scene.vignetteOpacity',
        artifactId,
      ),
    }),
  });
}

function defineColorTokens(artifactId, family, {
  color,
  glow,
  contrast,
  mode,
  controlAccent = color,
  navigationActive = controlAccent,
  navigationGlow = glow,
  sceneTint = color,
  sceneVignetteOpacity = 0,
}) {
  return createArtifactColorTokens({
    artifactId,
    family,
    artifact: { color, glow, contrast, mode },
    controls: { accent: controlAccent },
    navigation: { active: navigationActive, glow: navigationGlow },
    scene: { tint: sceneTint, vignetteOpacity: sceneVignetteOpacity },
  });
}

const CANONICAL_ARTIFACT_COLOR_TOKENS = Object.freeze({
  lens: defineColorTokens('lens', ARTIFACT_COLOR_FAMILIES.pearl, {
    color: '#d7e6eb',
    glow: '#f4f9fb',
    contrast: '#334155',
    mode: 'opal',
  }),
  veil: defineColorTokens('veil', ARTIFACT_COLOR_FAMILIES.antiqueGold, {
    color: '#c8a56a',
    glow: '#e4c891',
    contrast: '#3f2f18',
    mode: 'seal',
  }),
  barrier: defineColorTokens('barrier', ARTIFACT_COLOR_FAMILIES.sumi, {
    color: '#e7e5e4',
    glow: '#f8fafc',
    contrast: '#1c1917',
    mode: 'anchor',
  }),
  gate: defineColorTokens('gate', ARTIFACT_COLOR_FAMILIES.jade, {
    color: '#8b5cf6',
    glow: '#7c3aed',
    contrast: '#f5f3ff',
    mode: 'distortion',
  }),
  brake: defineColorTokens('brake', ARTIFACT_COLOR_FAMILIES.earthUmber, {
    color: '#57534e',
    glow: '#d6d3d1',
    contrast: '#fafaf9',
    mode: 'friction',
  }),
  flare: defineColorTokens('flare', ARTIFACT_COLOR_FAMILIES.vermilion, {
    color: '#ef4444',
    glow: '#ff2a2a',
    contrast: '#fff1f2',
    mode: 'hazard',
  }),
  echo: defineColorTokens('echo', ARTIFACT_COLOR_FAMILIES.indigo, {
    color: '#0ea5e9',
    glow: '#22d3ee',
    contrast: '#f0f9ff',
    mode: 'pulse',
  }),
  [RESERVED_ARTIFACT_COLOR_IDS.resonance]: defineColorTokens(
    RESERVED_ARTIFACT_COLOR_IDS.resonance,
    ARTIFACT_COLOR_FAMILIES.resonanceCyan,
    {
      color: '#38bdf8',
      glow: '#7dd3fc',
      contrast: '#f0f9ff',
      mode: 'resonance',
    },
  ),
});

// Clinical's light surfaces need separate readable control/navigation accents.
// Keep the canonical object material and glow identities independent of those roles.
const CLINICAL_ARTIFACT_CONTROL_ACCENTS = Object.freeze({
  lens: '#0f6472',
  veil: '#765018',
  barrier: '#334155',
  gate: '#6d28d9',
  brake: '#475569',
  flare: '#b42332',
  echo: '#035e82',
});
const CLINICAL_ARTIFACT_COLOR_TOKENS = Object.freeze(Object.fromEntries(
  Object.entries(CLINICAL_ARTIFACT_CONTROL_ACCENTS).map(([artifactId, accent]) => {
    const canonical = CANONICAL_ARTIFACT_COLOR_TOKENS[artifactId];
    return [artifactId, createArtifactColorTokens({
      ...canonical,
      controls: { accent },
      navigation: { ...canonical.navigation, active: accent },
    })];
  }),
));

// Controls on the enamel Entropy shell and illuminated key caps need their
// own pigment, while object signals and dark-bay navigation retain their light.
const ENTROPY_ARTIFACT_CONTROL_ACCENTS = Object.freeze({
  lens: '#246070', veil: '#715021', brake: '#655c4c', barrier: '#45494d',
  gate: '#6d3ead', flare: '#af2c23', echo: '#175f7d',
});
const LIGHT_ARTIFACT_SIGNAL_ACCENTS = Object.freeze({
  lens: '#d7e6eb', veil: '#e4c891', brake: '#d6d3d1', barrier: '#e7e5e4',
  gate: '#c4b5fd', flare: '#fca5a5', echo: '#7dd3fc',
});
function createControlRoleTokens(accents, navigationAccents) {
  return Object.freeze(Object.fromEntries(Object.entries(accents).map(([artifactId, accent]) => {
    const canonical = CANONICAL_ARTIFACT_COLOR_TOKENS[artifactId];
    return [artifactId, createArtifactColorTokens({
      ...canonical, controls: { accent },
      navigation: { ...canonical.navigation, active: navigationAccents[artifactId] },
    })];
  })));
}
const ENTROPY_ARTIFACT_COLOR_TOKENS = createControlRoleTokens(ENTROPY_ARTIFACT_CONTROL_ACCENTS, LIGHT_ARTIFACT_SIGNAL_ACCENTS);
const SCP_ARTIFACT_COLOR_TOKENS = createControlRoleTokens(LIGHT_ARTIFACT_SIGNAL_ACCENTS, LIGHT_ARTIFACT_SIGNAL_ACCENTS);
const MATRIX_ARTIFACT_COLOR_TOKENS = createControlRoleTokens(LIGHT_ARTIFACT_SIGNAL_ACCENTS, LIGHT_ARTIFACT_SIGNAL_ACCENTS);
const CYBERPUNK_ARTIFACT_COLOR_TOKENS = createControlRoleTokens(LIGHT_ARTIFACT_SIGNAL_ACCENTS, LIGHT_ARTIFACT_SIGNAL_ACCENTS);

const THEME_ARTIFACT_COLOR_TOKEN_OVERRIDES = Object.freeze({
  clinical: CLINICAL_ARTIFACT_COLOR_TOKENS,
  entropy: ENTROPY_ARTIFACT_COLOR_TOKENS,
  matrix: MATRIX_ARTIFACT_COLOR_TOKENS,
  cyberpunk: CYBERPUNK_ARTIFACT_COLOR_TOKENS,
  scp: SCP_ARTIFACT_COLOR_TOKENS,
  zen: ZEN_ARTIFACT_COLOR_TOKENS,
});

function assertColorSystemCoverage() {
  for (const definition of TOOLS_ARTIFACT_DEFINITIONS) {
    if (!CANONICAL_ARTIFACT_COLOR_TOKENS[definition.id]) {
      throw new Error(
        `[artifactColorSystem] Missing canonical color tokens for artifact "${definition.id}".`,
      );
    }
  }
}

assertColorSystemCoverage();

export function assertArtifactColorId(artifactId, context = 'artifact color lookup') {
  const normalized = typeof artifactId === 'string' ? artifactId.trim() : '';
  if (CANONICAL_ARTIFACT_COLOR_TOKENS[normalized]) {
    return normalized;
  }
  throw new Error(
    `[artifactColorSystem] ${context} requires a canonical artifact id; received "${normalized || '<empty>'}".`,
  );
}

export function resolveArtifactColorIdFromVisualKey(
  visualKey,
  context = 'artifact visual color lookup',
) {
  const normalized = typeof visualKey === 'string' ? visualKey.trim() : '';
  const definition = getToolsArtifactDefinitionByVisualKey(normalized);
  if (definition) return definition.id;
  if (normalized === RESERVED_ARTIFACT_COLOR_IDS.resonance) return normalized;
  throw new Error(
    `[artifactColorSystem] ${context} references unknown visual key "${normalized || '<empty>'}".`,
  );
}

export function getArtifactColorTokens(themeId, artifactId) {
  const resolvedThemeId = assertThemePluginId(themeId, 'artifact color token lookup');
  const resolvedArtifactId = assertArtifactColorId(artifactId);
  const themeTokens = THEME_ARTIFACT_COLOR_TOKEN_OVERRIDES[resolvedThemeId];
  if (themeTokens && Object.prototype.hasOwnProperty.call(themeTokens, resolvedArtifactId)) {
    return themeTokens[resolvedArtifactId];
  }
  return CANONICAL_ARTIFACT_COLOR_TOKENS[resolvedArtifactId];
}

export function getArtifactColorTokensByVisualKey(themeId, visualKey) {
  return getArtifactColorTokens(
    themeId,
    resolveArtifactColorIdFromVisualKey(visualKey),
  );
}

export function getArtifactColorTokensForDefinition(themeId, artifactId) {
  const definition = getToolsArtifactDefinition(artifactId);
  if (!definition) {
    throw new Error(
      `[artifactColorSystem] Artifact definition color lookup references unknown canonical id "${artifactId || '<empty>'}".`,
    );
  }
  return getArtifactColorTokens(themeId, definition.id);
}
