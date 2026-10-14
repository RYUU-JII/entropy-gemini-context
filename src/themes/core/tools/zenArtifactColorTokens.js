const ZEN_ARTIFACT_COLOR_FAMILIES = Object.freeze({
  pearl: 'pearl',
  antiqueGold: 'antique_gold',
  earthUmber: 'earth_umber',
  sumi: 'sumi',
  jade: 'jade',
  indigo: 'indigo',
  vermilion: 'vermilion',
  resonanceCyan: 'resonance_cyan',
});

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function requireHexColor(value, field, artifactId) {
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
    throw new Error(
      `[zenArtifactColorTokens] ${artifactId}.${field} must be a six-digit hex color.`,
    );
  }
  return value.toLowerCase();
}

function requireOpacity(value, field, artifactId) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new Error(
      `[zenArtifactColorTokens] ${artifactId}.${field} must be between 0 and 1.`,
    );
  }
  return numeric;
}

function defineZenArtifactColorTokens(artifactId, family, {
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
  if (!artifactId || !family) {
    throw new Error('[zenArtifactColorTokens] artifactId and family are required.');
  }
  return Object.freeze({
    artifactId,
    family,
    artifact: Object.freeze({
      color: requireHexColor(color, 'artifact.color', artifactId),
      glow: requireHexColor(glow, 'artifact.glow', artifactId),
      contrast: requireHexColor(contrast, 'artifact.contrast', artifactId),
      mode: typeof mode === 'string' && mode.trim() ? mode.trim() : 'static',
    }),
    controls: Object.freeze({
      accent: requireHexColor(controlAccent, 'controls.accent', artifactId),
    }),
    navigation: Object.freeze({
      active: requireHexColor(navigationActive, 'navigation.active', artifactId),
      glow: requireHexColor(navigationGlow, 'navigation.glow', artifactId),
    }),
    scene: Object.freeze({
      tint: requireHexColor(sceneTint, 'scene.tint', artifactId),
      vignetteOpacity: requireOpacity(
        sceneVignetteOpacity,
        'scene.vignetteOpacity',
        artifactId,
      ),
    }),
  });
}

export const ZEN_ARTIFACT_COLOR_TOKENS = Object.freeze({
  lens: defineZenArtifactColorTokens('lens', ZEN_ARTIFACT_COLOR_FAMILIES.pearl, {
    color: '#cbd9d6',
    glow: '#f4f8f6',
    contrast: '#364440',
    mode: 'opal',
    navigationActive: '#718e88',
    navigationGlow: '#cbd9d6',
    sceneTint: '#91a7a2',
    sceneVignetteOpacity: 0.055,
  }),
  veil: defineZenArtifactColorTokens('veil', ZEN_ARTIFACT_COLOR_FAMILIES.antiqueGold, {
    color: '#c5a14a',
    glow: '#e9d18e',
    contrast: '#3f3217',
    mode: 'seal',
    sceneTint: '#9f7f34',
    sceneVignetteOpacity: 0.065,
  }),
  barrier: defineZenArtifactColorTokens('barrier', ZEN_ARTIFACT_COLOR_FAMILIES.sumi, {
    color: '#17191c',
    glow: '#d8d6cf',
    contrast: '#f3f0e9',
    mode: 'void',
    controlAccent: '#7f7c75',
    navigationActive: '#77736d',
    sceneTint: '#34363b',
    sceneVignetteOpacity: 0.085,
  }),
  gate: defineZenArtifactColorTokens('gate', ZEN_ARTIFACT_COLOR_FAMILIES.jade, {
    color: '#5f8a6d',
    glow: '#a7c5ad',
    contrast: '#f0f7f1',
    mode: 'pulse',
    sceneTint: '#557a63',
    sceneVignetteOpacity: 0.07,
  }),
  brake: defineZenArtifactColorTokens('brake', ZEN_ARTIFACT_COLOR_FAMILIES.earthUmber, {
    color: '#8a6752',
    glow: '#be9b82',
    contrast: '#fbf5ef',
    mode: 'friction',
    sceneTint: '#75533f',
    sceneVignetteOpacity: 0.06,
  }),
  flare: defineZenArtifactColorTokens('flare', ZEN_ARTIFACT_COLOR_FAMILIES.vermilion, {
    color: '#c84f42',
    glow: '#f08a77',
    contrast: '#fff4f1',
    mode: 'hazard',
    sceneTint: '#a43f35',
    sceneVignetteOpacity: 0.065,
  }),
  echo: defineZenArtifactColorTokens('echo', ZEN_ARTIFACT_COLOR_FAMILIES.indigo, {
    color: '#2f6f9e',
    glow: '#78b3d2',
    contrast: '#f2f8fb',
    mode: 'pulse',
    sceneTint: '#285c82',
    sceneVignetteOpacity: 0.075,
  }),
  resonance: defineZenArtifactColorTokens(
    'resonance',
    ZEN_ARTIFACT_COLOR_FAMILIES.resonanceCyan,
    {
      color: '#4fa9bd',
      glow: '#9ed4dd',
      contrast: '#f1fbfc',
      mode: 'resonance',
      sceneTint: '#3c8292',
      sceneVignetteOpacity: 0.06,
    },
  ),
});

export function getZenArtifactColorTokens(artifactId) {
  const resolvedArtifactId = typeof artifactId === 'string' ? artifactId.trim() : '';
  if (
    resolvedArtifactId
    && Object.prototype.hasOwnProperty.call(ZEN_ARTIFACT_COLOR_TOKENS, resolvedArtifactId)
  ) {
    return ZEN_ARTIFACT_COLOR_TOKENS[resolvedArtifactId];
  }
  throw new Error(
    `[zenArtifactColorTokens] unknown canonical Zen artifact "${resolvedArtifactId || '<empty>'}".`,
  );
}
