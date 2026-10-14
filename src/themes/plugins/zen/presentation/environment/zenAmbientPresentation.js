import {
  resolveZenRealtimeClockContext,
  resolveZenRealtimeSyncIntervalMs,
  sampleZenWorldEnvironment,
} from '../../runtime/environment/zenWorldEnvironmentKernel.js';
import { resolveZenSolarContext } from '../../runtime/environment/zenWorldSolarContext.js';
import {
  DEFAULT_ZEN_WORLD_ID,
  ZEN_WORLD_ENVIRONMENT_CLOCK_MODES,
  buildZenWorldEnvironmentAuthority,
} from '../../runtime/environment/zenWorldEnvironmentAuthority.js';
import {
  requireZenWorldEnvironmentSnapshot,
} from '../../runtime/environment/zenWorldEnvironmentSnapshot.js';
import {
  resolveZenPresentationTimeContext,
} from '../../runtime/environment/zenWorldClock.js';
import {
  buildZenWeatherAuthoritySnapshot,
  normalizeZenWeatherAuthority,
  resolveZenSceneEnvironmentPolicy,
} from '../../runtime/environment/zenWorldWeatherAuthority.js';
import {
  resolveZenAmbientRoleColor,
  resolveZenWorldWeatherSkyPalette,
} from '../../runtime/environment/zenWorldMaterialPalette.js';
import {
  requireZenWorldAmbientGrammar,
} from '../../runtime/environment/zenWorldAmbientGrammar.js';
import {
  requireZenShellMaterialProjection,
} from './zenShellMaterialProjection.js';
import { resolveZenEnvironmentShellMaterials } from './zenEnvironmentShellMaterials.js';

export const ZEN_AMBIENT_PRESENTATION_VERSION = 4;
const ZEN_AMBIENT_PHASES = new Set(['dawn', 'day', 'dusk', 'night']);
const ZEN_AMBIENT_REQUIRED_CSS_VARIABLES = Object.freeze([
  '--zen-ambient-shell-top',
  '--zen-ambient-shell-bottom',
  '--zen-ambient-layer-l2-top',
  '--zen-ambient-layer-l2-bottom',
  '--zen-ambient-layer-l3-top',
  '--zen-ambient-layer-l3-bottom',
  '--zen-ambient-background',
  '--zen-ambient-surface',
  '--zen-ambient-surface-elevated',
  '--zen-ambient-surface-sunken',
  '--zen-ambient-surface-overlay',
  '--zen-ambient-text',
  '--zen-ambient-text-muted',
  '--zen-ambient-text-subtle',
  '--zen-ambient-primary',
  '--zen-ambient-border',
  '--zen-ambient-border-muted',
  '--zen-ambient-border-strong',
  '--zen-ambient-edge',
  '--zen-ambient-cast-shadow',
  '--zen-ambient-shell-glow',
  '--zen-ambient-vignette-shadow',
  '--zen-ambient-light-x',
  '--zen-ambient-light-y',
  '--zen-ambient-rhythm-arc',
  '--zen-ambient-rhythm-light',
  '--zen-ambient-rhythm-ink',
  '--zen-ambient-rhythm-ink-wash',
  '--zen-ambient-garden-sky-top',
  '--zen-ambient-garden-ink',
]);

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function requireFinite(value, fieldName) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`ZEN_AMBIENT_PRESENTATION_FIELD_INVALID:${fieldName}`);
  }
  return numeric;
}

function requireRange(value, fieldName, min, max) {
  const numeric = requireFinite(value, fieldName);
  if (numeric < min || numeric > max) {
    throw new Error(`ZEN_AMBIENT_PRESENTATION_FIELD_INVALID:${fieldName}`);
  }
  return numeric;
}

export function requireZenAmbientPresentation(presentation) {
  if (
    !presentation
    || typeof presentation !== 'object'
    || presentation.themeId !== 'zen'
    || presentation.version !== ZEN_AMBIENT_PRESENTATION_VERSION
  ) {
    throw new Error('ZEN_AMBIENT_PRESENTATION_REQUIRED');
  }
  if (presentation.source !== 'canonical_solar_environment') {
    throw new Error('ZEN_AMBIENT_PRESENTATION_FIELD_INVALID:source');
  }
  if (
    !presentation.environmentIdentity
    || typeof presentation.environmentIdentity !== 'object'
    || typeof presentation.environmentIdentity.authorityRevision !== 'string'
    || !presentation.environmentIdentity.authorityRevision
    || typeof presentation.environmentIdentity.sampleId !== 'string'
    || !presentation.environmentIdentity.sampleId
  ) {
    throw new Error('ZEN_AMBIENT_PRESENTATION_FIELD_INVALID:environmentIdentity');
  }
  if (!ZEN_AMBIENT_PHASES.has(presentation.phase)) {
    throw new Error('ZEN_AMBIENT_PRESENTATION_FIELD_INVALID:phase');
  }
  [
    'daylight',
    'nightDepth',
    'solarElevation',
    'dawnWeight',
    'duskWeight',
    'warmth',
    'lowSun',
    'twilightWeight',
    'nightWeight',
  ].forEach((fieldName) => requireRange(presentation[fieldName], fieldName, 0, 1));
  requireRange(presentation.hour, 'hour', 0, 24);
  requireRange(presentation.lightVector?.x, 'lightVector.x', -1, 1);
  requireRange(presentation.lightVector?.y, 'lightVector.y', -1, 1);
  requireRange(presentation.lightPosition?.x, 'lightPosition.x', 0, 100);
  requireRange(presentation.lightPosition?.y, 'lightPosition.y', 0, 100);
  if (!presentation.timeContext || typeof presentation.timeContext !== 'object') {
    throw new Error('ZEN_AMBIENT_PRESENTATION_FIELD_INVALID:timeContext');
  }
  if (!presentation.cssVariables || typeof presentation.cssVariables !== 'object') {
    throw new Error('ZEN_AMBIENT_PRESENTATION_FIELD_INVALID:cssVariables');
  }
  requireZenShellMaterialProjection(presentation.shellMaterials);
  ZEN_AMBIENT_REQUIRED_CSS_VARIABLES.forEach((fieldName) => {
    if (typeof presentation.cssVariables[fieldName] !== 'string'
      || !presentation.cssVariables[fieldName].trim()) {
      throw new Error(`ZEN_AMBIENT_PRESENTATION_FIELD_INVALID:cssVariables.${fieldName}`);
    }
  });
  if (presentation.navigationTone !== 'light') {
    throw new Error('ZEN_AMBIENT_PRESENTATION_FIELD_INVALID:navigationTone');
  }
  return presentation;
}

function normalizeHour(value) {
  const numeric = requireFinite(value, 'timeContext.hour');
  return ((numeric % 24) + 24) % 24;
}

function parseHexColor(value) {
  const source = typeof value === 'string' ? value.trim().replace(/^#/, '') : '';
  if (!/^[\da-f]{6}$/iu.test(source)) {
    throw new Error(`ZEN_AMBIENT_COLOR_INVALID:${String(value)}`);
  }
  return {
    r: Number.parseInt(source.slice(0, 2), 16),
    g: Number.parseInt(source.slice(2, 4), 16),
    b: Number.parseInt(source.slice(4, 6), 16),
  };
}

function toHexChannel(value) {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
}

export function mixZenAmbientColor(from, to, amount) {
  const start = parseHexColor(from);
  const end = parseHexColor(to);
  const t = clamp01(amount);
  return `#${toHexChannel(start.r + ((end.r - start.r) * t))}${toHexChannel(start.g + ((end.g - start.g) * t))}${toHexChannel(start.b + ((end.b - start.b) * t))}`;
}

function withAlpha(color, alpha) {
  const rgb = parseHexColor(color);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp01(alpha).toFixed(3)})`;
}

// The Home inscription sits inside the scene's sky, whose night value differs
// from the shell paper. Resolve its ink against that same world palette.
function resolveGardenInk(background) {
  const luminance = color => {
    const { r, g, b } = parseHexColor(color);
    const linear = value => value <= 10.31475 ? value / 3294.6 : ((value / 255 + 0.055) / 1.055) ** 2.4;
    return linear(r) * 0.2126 + linear(g) * 0.7152 + linear(b) * 0.0722;
  };
  const backdrop = luminance(background);
  const contrast = color => (Math.max(backdrop, luminance(color)) + 0.05)
    / (Math.min(backdrop, luminance(color)) + 0.05);
  const dark = backdrop > 0.179;
  const base = dark ? '#4e5f58' : '#d5deed';
  const endpoint = dark ? '#000000' : '#ffffff';
  for (let step = 0; step <= 10; step += 1) {
    const ink = mixZenAmbientColor(base, endpoint, step / 10);
    if (contrast(ink) >= 4.5) return ink;
  }
  throw new Error('ZEN_GARDEN_INSCRIPTION_CONTRAST_UNSATISFIABLE');
}

function mixAmbientSurface(day, warm, twilight, night, chromaticState, {
  warmScale = 0.12,
  twilightScale = 0.24,
  nightScale = 0.14,
} = {}) {
  return resolveZenAmbientRoleColor({ day, warm, twilight, night }, {
    ...chromaticState,
    warmth: chromaticState.warmth * warmScale,
    twilightWeight: chromaticState.twilightWeight * twilightScale,
    nightWeight: chromaticState.nightWeight * nightScale,
  });
}

function resolvePhase({ dawnWeight, duskWeight, nightDepth }) {
  if (nightDepth >= 0.7 && dawnWeight < 0.24 && duskWeight < 0.24) return 'night';
  if (dawnWeight >= duskWeight && dawnWeight >= 0.2) return 'dawn';
  if (duskWeight > dawnWeight && duskWeight >= 0.2) return 'dusk';
  return 'day';
}

function buildShellCssVariables({
  chromaticState,
  envState,
  lightPosition,
  shellMaterials,
}) {
  const {
    daylight,
    dawnWeight,
    duskWeight,
    nightDepth,
    lowSun,
    warmth,
    twilightWeight,
    nightWeight,
  } = chromaticState;
  const {
    backdrop,
    layers,
    surfaces,
    content,
    boundaries,
  } = requireZenShellMaterialProjection(shellMaterials);
  const rhythmArcColor = mixAmbientSurface('#625f58', '#725b48', '#6f5b72', '#52627d', chromaticState, {
    warmScale: 0.38,
    twilightScale: 0.48,
    nightScale: 0.52,
  });
  const rhythmInkColor = mixAmbientSurface('#4e5f58', '#65584c', '#65566d', '#4b5871', chromaticState, {
    warmScale: 0.3,
    twilightScale: 0.4,
    nightScale: 0.44,
  });
  const gardenSkyTop = resolveZenWorldWeatherSkyPalette(envState).bonsai.skyTop;
  return Object.freeze({
    '--zen-ambient-daylight': daylight.toFixed(4),
    '--zen-ambient-dawn': dawnWeight.toFixed(4),
    '--zen-ambient-dusk': duskWeight.toFixed(4),
    '--zen-ambient-night-depth': nightDepth.toFixed(4),
    '--zen-ambient-low-sun': lowSun.toFixed(4),
    '--zen-ambient-warmth': warmth.toFixed(4),
    '--zen-ambient-twilight': twilightWeight.toFixed(4),
    '--zen-ambient-night-weight': nightWeight.toFixed(4),
    '--zen-ambient-light-x': `${lightPosition.x.toFixed(2)}%`,
    '--zen-ambient-light-y': `${lightPosition.y.toFixed(2)}%`,
    '--zen-ambient-shell-top': backdrop.top,
    '--zen-ambient-shell-bottom': backdrop.bottom,
    '--zen-ambient-layer-l2-top': layers.l2Top,
    '--zen-ambient-layer-l2-bottom': layers.l2Bottom,
    '--zen-ambient-layer-l3-top': layers.l3Top,
    '--zen-ambient-layer-l3-bottom': layers.l3Bottom,
    '--zen-ambient-background': surfaces.background,
    '--zen-ambient-surface': surfaces.base,
    '--zen-ambient-surface-elevated': surfaces.elevated,
    '--zen-ambient-surface-sunken': surfaces.sunken,
    '--zen-ambient-surface-overlay': surfaces.overlay,
    '--zen-ambient-edge': withAlpha(boundaries.edge, 0.065 + (nightDepth * 0.025)),
    '--zen-ambient-cast-shadow': withAlpha(boundaries.castShadow, 0.08 + (lowSun * 0.055)),
    '--zen-ambient-shell-glow': withAlpha(boundaries.glow, 0.028 + (warmth * 0.035) + ((1 - nightDepth) * 0.012)),
    '--zen-ambient-vignette-shadow': withAlpha('#181410', 0.04 + (nightDepth * 0.16) + (warmth * 0.06)),
    '--zen-ambient-rhythm-arc': withAlpha(rhythmArcColor, 0.16 + (lowSun * 0.055)),
    '--zen-ambient-rhythm-light': withAlpha(boundaries.glow, 0.3 + (warmth * 0.12) + (nightDepth * 0.04)),
    '--zen-ambient-rhythm-ink': withAlpha(rhythmInkColor, 0.78),
    '--zen-ambient-rhythm-ink-wash': withAlpha(rhythmInkColor, 0.3),
    '--zen-ambient-garden-sky-top': gardenSkyTop,
    '--zen-ambient-garden-ink': resolveGardenInk(gardenSkyTop),
    '--zen-ambient-text': content.text,
    '--zen-ambient-primary': content.primary,
    '--zen-ambient-text-muted': content.muted,
    '--zen-ambient-text-subtle': content.subtle,
    '--zen-ambient-border': boundaries.border,
    '--zen-ambient-border-muted': boundaries.borderMuted,
    '--zen-ambient-border-strong': boundaries.borderStrong,
  });
}

export function buildZenAmbientPresentation({
  envState,
  timeContext,
  solarTimeZone = '',
  hasSolarCoordinates = false,
  environmentIdentity = null,
} = {}) {
  if (!envState || typeof envState !== 'object') {
    throw new Error('ZEN_AMBIENT_PRESENTATION_ENVIRONMENT_REQUIRED');
  }
  if (!timeContext || typeof timeContext !== 'object') {
    throw new Error('ZEN_AMBIENT_PRESENTATION_TIME_CONTEXT_REQUIRED');
  }

  const hour = normalizeHour(timeContext.hour);
  const daylight = clamp01(requireFinite(envState.daylight, 'envState.daylight'));
  const nightDepth = clamp01(requireFinite(envState.night, 'envState.night'));
  const solarElevation = clamp01(requireFinite(envState.solarElevation, 'envState.solarElevation'));
  const chromaticState = requireZenWorldAmbientGrammar(envState.ambientChromaticState);
  const {
    dawnWeight,
    duskWeight,
    warmth,
    lowSun,
    twilightWeight,
    nightWeight,
    noonWeight,
  } = chromaticState;
  const lightVector = Object.freeze({
    x: Number(requireFinite(envState.sunDirectionX, 'envState.sunDirectionX').toFixed(4)),
    y: Number(requireFinite(envState.sunDirectionY, 'envState.sunDirectionY').toFixed(4)),
  });
  const lightPosition = Object.freeze({
    x: 50 + (lightVector.x * 28),
    y: 16 + ((1 - solarElevation) * 9),
  });
  const phase = resolvePhase({ dawnWeight, duskWeight, nightDepth });
  const shellMaterials = resolveZenEnvironmentShellMaterials(envState);
  const cssVariables = buildShellCssVariables({
    chromaticState,
    envState,
    lightPosition,
    shellMaterials,
  });

  const presentation = Object.freeze({
    version: ZEN_AMBIENT_PRESENTATION_VERSION,
    themeId: 'zen',
    source: 'canonical_solar_environment',
    environmentIdentity: Object.freeze(environmentIdentity || {
      authorityRevision: 'zen_world_environment:direct_material_projection',
      sampleId: `zen_world_environment:direct_material_projection:${Number(hour.toFixed(4))}`,
      sampledAtMs: Number.isFinite(Number(timeContext.timestampMs))
        ? Math.floor(Number(timeContext.timestampMs))
        : null,
    }),
    phase,
    hour: Number(hour.toFixed(4)),
    daylight: Number(daylight.toFixed(4)),
    nightDepth: Number(nightDepth.toFixed(4)),
    solarElevation: Number(solarElevation.toFixed(4)),
    dawnWeight: Number(dawnWeight.toFixed(4)),
    duskWeight: Number(duskWeight.toFixed(4)),
    warmth: Number(warmth.toFixed(4)),
    lowSun: Number(lowSun.toFixed(4)),
    twilightWeight: Number(twilightWeight.toFixed(4)),
    nightWeight: Number(nightWeight.toFixed(4)),
    noonWeight: Number(noonWeight.toFixed(4)),
    lightVector,
    lightPosition,
    navigationTone: 'light',
    timeContext: Object.freeze({ ...timeContext }),
    solar: Object.freeze({
      timeZone: typeof solarTimeZone === 'string' ? solarTimeZone : '',
      hasCoordinates: hasSolarCoordinates === true,
    }),
    shellMaterials,
    cssVariables,
  });
  return requireZenAmbientPresentation(presentation);
}

export function projectZenAmbientPresentation(worldSnapshot) {
  const snapshot = requireZenWorldEnvironmentSnapshot(worldSnapshot);
  return buildZenAmbientPresentation({
    envState: snapshot.environment,
    timeContext: snapshot.timeContext,
    solarTimeZone: snapshot.solar.timeZone,
    hasSolarCoordinates: Boolean(snapshot.solar.coordinates),
    environmentIdentity: snapshot.identity,
  });
}

export function resolveZenAmbientPresentation({
  solarLocationProfile = null,
  nowMs = Date.now(),
  clockMode = ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.REALTIME,
  environmentMode = null,
  weatherAuthority = null,
} = {}) {
  const timestampMs = requireFinite(nowMs, 'nowMs');
  const { solarCoordinates, solarTimeZone } = resolveZenSolarContext(solarLocationProfile);
  const environmentPolicy = resolveZenSceneEnvironmentPolicy({ environmentMode });
  const hasPresentationHour = environmentPolicy.presentationHour !== null;
  const resolvedClockMode = hasPresentationHour
    ? ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.FIXED
    : clockMode;
  const sampledTimeContext = resolvedClockMode === ZEN_WORLD_ENVIRONMENT_CLOCK_MODES.FIXED
    ? resolveZenPresentationTimeContext(
      resolveZenRealtimeClockContext(solarTimeZone, { now: timestampMs }),
      environmentPolicy.presentationHour,
    )
    : undefined;
  const authority = buildZenWorldEnvironmentAuthority({
    worldId: solarCoordinates?.worldId || DEFAULT_ZEN_WORLD_ID,
    timeContext: sampledTimeContext,
    solarCoordinates,
    solarTimeZone,
    clockMode: resolvedClockMode,
    weatherAuthority: weatherAuthority === null
      ? buildZenWeatherAuthoritySnapshot({
          mode: environmentPolicy.weatherAuthorityMode,
        })
      : normalizeZenWeatherAuthority(weatherAuthority),
  });
  return projectZenAmbientPresentation(sampleZenWorldEnvironment({
    authority,
    now: timestampMs,
  }));
}

export function resolveZenAmbientRefreshIntervalMs({
  presentation,
  documentVisible = true,
} = {}) {
  requireZenAmbientPresentation(presentation);
  return resolveZenRealtimeSyncIntervalMs({
    timeContext: presentation.timeContext,
    documentVisible,
    solarSyncEnabled: true,
  });
}
