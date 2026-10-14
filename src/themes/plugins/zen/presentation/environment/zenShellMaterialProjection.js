import {
  ZEN_WORLD_AMBIENT_GRAMMAR_VERSION,
  normalizeZenWorldAmbientGrammar,
} from '../../runtime/environment/zenWorldAmbientGrammar.js';

export const ZEN_SHELL_MATERIAL_PROJECTION_VERSION = 2;

const TEXT_CONTRAST_MINIMUM = 4.8;
const SUBTLE_TEXT_CONTRAST_MINIMUM = 4.5;
const STRONG_BORDER_CONTRAST_MINIMUM = 3;

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const freezeRole = (day, warm, twilight, night, response = {}) => Object.freeze({
  day,
  warm,
  twilight,
  night,
  response: Object.freeze({
    warmth: response.warmth ?? 1,
    twilight: response.twilight ?? 1,
    night: response.night ?? 1,
    chromaLimit: response.chromaLimit ?? 0.06,
  }),
});

/*
 * Architectural paper and frame materials share the world ambient grammar,
 * but deliberately react with less chroma than focal scene materials. At
 * night the same paper loses value and takes a restrained indigo light cast.
 * These are perceived-light stops, not changes to the underlying material;
 * content stays lighter than the scene and keeps its dark, legible ink.
 */
const ZEN_SHELL_MATERIAL_ROLES = Object.freeze({
  backdropTop: freezeRole('#fdfbf7', '#ead9c4', '#736b76', '#1a2249', {
    warmth: 0.9,
    twilight: 0.82,
    chromaLimit: 0.08,
  }),
  backdropBottom: freezeRole('#f8f6f0', '#dfccb7', '#625c68', '#141b38', {
    warmth: 0.9,
    twilight: 0.82,
    chromaLimit: 0.07,
  }),
  layerL2Top: freezeRole('#fffdf8', '#f2e5d3', '#ddd2d7', '#a1a8bc', {
    warmth: 0.72,
    twilight: 0.64,
    chromaLimit: 0.035,
  }),
  layerL2Bottom: freezeRole('#faf7ed', '#e8d9c6', '#d1c6cd', '#969db1', {
    warmth: 0.72,
    twilight: 0.64,
    chromaLimit: 0.035,
  }),
  layerL3Top: freezeRole('#fdfbf7', '#ecddca', '#d6cad1', '#979eb2', {
    warmth: 0.74,
    twilight: 0.66,
    chromaLimit: 0.034,
  }),
  layerL3Bottom: freezeRole('#f4f1e1', '#dfcfba', '#c8bdc6', '#8a93a7', {
    warmth: 0.74,
    twilight: 0.66,
    chromaLimit: 0.034,
  }),
  background: freezeRole('#faf7ed', '#eadcc9', '#d3c9cf', '#969fb4', {
    warmth: 0.72,
    twilight: 0.62,
    chromaLimit: 0.032,
  }),
  surface: freezeRole('#ffffff', '#f5e9d8', '#e2d8dc', '#aab1c3', {
    warmth: 0.68,
    twilight: 0.58,
    chromaLimit: 0.028,
  }),
  surfaceElevated: freezeRole('#fffefb', '#f8eddf', '#e8dfe3', '#b3bacb', {
    warmth: 0.68,
    twilight: 0.56,
    chromaLimit: 0.026,
  }),
  surfaceSunken: freezeRole('#f8f6f0', '#e5d4bf', '#cdc2ca', '#8b95ab', {
    warmth: 0.74,
    twilight: 0.66,
    chromaLimit: 0.036,
  }),
  surfaceOverlay: freezeRole('#fffdf8', '#f1e3d1', '#ded3d8', '#9ea7bd', {
    warmth: 0.7,
    twilight: 0.6,
    chromaLimit: 0.03,
  }),
  text: freezeRole('#383733', '#3a3028', '#38323a', '#252b36', {
    warmth: 0.42,
    twilight: 0.42,
    chromaLimit: 0.028,
  }),
  textMuted: freezeRole('#615f5a', '#544a41', '#4b434c', '#37404d', {
    warmth: 0.46,
    twilight: 0.46,
    chromaLimit: 0.026,
  }),
  textSubtle: freezeRole('#6b6963', '#5f554b', '#554d56', '#414b58', {
    warmth: 0.46,
    twilight: 0.46,
    chromaLimit: 0.024,
  }),
  primary: freezeRole('#5d4037', '#59483b', '#51434f', '#3e4b5d', {
    warmth: 0.46,
    twilight: 0.48,
    chromaLimit: 0.038,
  }),
  border: freezeRole('#b8b2aa', '#ae9d8b', '#9e929a', '#84909f', {
    warmth: 0.56,
    twilight: 0.54,
    chromaLimit: 0.028,
  }),
  borderMuted: freezeRole('#d6d2cc', '#cdbfae', '#bbb0b7', '#9ea8b5', {
    warmth: 0.56,
    twilight: 0.54,
    chromaLimit: 0.026,
  }),
  borderStrong: freezeRole('#978f86', '#8e7b69', '#7d717b', '#687483', {
    warmth: 0.56,
    twilight: 0.56,
    chromaLimit: 0.03,
  }),
  edge: freezeRole('#8f867d', '#886f5d', '#796d76', '#667281', {
    warmth: 0.54,
    twilight: 0.56,
    chromaLimit: 0.032,
  }),
  castShadow: freezeRole('#5d4037', '#674a3e', '#554b58', '#3e4a5b', {
    warmth: 0.48,
    twilight: 0.54,
    chromaLimit: 0.04,
  }),
  glow: freezeRole('#7d8e67', '#c4a778', '#a99ba8', '#9daac1', {
    warmth: 0.62,
    twilight: 0.58,
    chromaLimit: 0.055,
  }),
});

function parseHexColor(value) {
  const source = typeof value === 'string' ? value.trim().replace(/^#/, '') : '';
  if (!/^[\da-f]{6}$/iu.test(source)) {
    throw new Error(`ZEN_SHELL_MATERIAL_COLOR_INVALID:${String(value)}`);
  }
  return [0, 2, 4].map((offset) => Number.parseInt(source.slice(offset, offset + 2), 16) / 255);
}

function toHexColor(channels) {
  const channel = (value) => Math.round(clamp01(value) * 255).toString(16).padStart(2, '0');
  return `#${channels.map(channel).join('')}`;
}

function srgbToLinear(value) {
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
  return value <= 0.0031308
    ? value * 12.92
    : (1.055 * (Math.max(0, value) ** (1 / 2.4))) - 0.055;
}

function hexToOklch(value) {
  const [red, green, blue] = parseHexColor(value).map(srgbToLinear);
  const l = Math.cbrt((0.4122214708 * red) + (0.5363325363 * green) + (0.0514459929 * blue));
  const m = Math.cbrt((0.2119034982 * red) + (0.6806995451 * green) + (0.1073969566 * blue));
  const s = Math.cbrt((0.0883024619 * red) + (0.2817188376 * green) + (0.6299787005 * blue));
  const lightness = (0.2104542553 * l) + (0.793617785 * m) - (0.0040720468 * s);
  const axisA = (1.9779984951 * l) - (2.428592205 * m) + (0.4505937099 * s);
  const axisB = (0.0259040371 * l) + (0.7827717662 * m) - (0.808675766 * s);
  return {
    l: lightness,
    c: Math.sqrt((axisA ** 2) + (axisB ** 2)),
    h: ((Math.atan2(axisB, axisA) * 180 / Math.PI) + 360) % 360,
  };
}

function oklchToHex({ l, c, h }) {
  const radians = h * Math.PI / 180;
  const axisA = c * Math.cos(radians);
  const axisB = c * Math.sin(radians);
  const lPrime = l + (0.3963377774 * axisA) + (0.2158037573 * axisB);
  const mPrime = l - (0.1055613458 * axisA) - (0.0638541728 * axisB);
  const sPrime = l - (0.0894841775 * axisA) - (1.291485548 * axisB);
  const lCube = lPrime ** 3;
  const mCube = mPrime ** 3;
  const sCube = sPrime ** 3;
  return toHexColor([
    linearToSrgb((4.0767416621 * lCube) - (3.3077115913 * mCube) + (0.2309699292 * sCube)),
    linearToSrgb((-1.2684380046 * lCube) + (2.6097574011 * mCube) - (0.3413193965 * sCube)),
    linearToSrgb((-0.0041960863 * lCube) - (0.7034186147 * mCube) + (1.707614701 * sCube)),
  ]);
}

function interpolateHue(from, to, amount) {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return from + (delta * amount);
}

function mixOklchColor(from, to, amount, chromaLimit = 0.06) {
  const t = clamp01(amount);
  if (t <= 0) return from;
  if (t >= 1 && hexToOklch(to).c <= chromaLimit) return to;
  const start = hexToOklch(from);
  const end = hexToOklch(to);
  const startHue = start.c < 0.0001 ? end.h : start.h;
  const endHue = end.c < 0.0001 ? start.h : end.h;
  return oklchToHex({
    l: start.l + ((end.l - start.l) * t),
    c: Math.min(chromaLimit, start.c + ((end.c - start.c) * t)),
    h: interpolateHue(startHue, endHue, t),
  });
}

function resolveMaterialRole(role, chromaticState) {
  const { response } = role;
  const warmed = mixOklchColor(
    role.day,
    role.warm,
    chromaticState.warmth * response.warmth,
    response.chromaLimit,
  );
  const twilit = mixOklchColor(
    warmed,
    role.twilight,
    chromaticState.twilightWeight * response.twilight,
    response.chromaLimit,
  );
  return mixOklchColor(
    twilit,
    role.night,
    chromaticState.nightWeight * response.night,
    response.chromaLimit,
  );
}

function resolveWeatherOcclusion(environment) {
  if (!environment || typeof environment !== 'object') {
    throw new Error('ZEN_SHELL_MATERIAL_ENVIRONMENT_REQUIRED');
  }
  const fields = {
    cloudCover: 1,
    rainIntensity: 1,
    directSunlight: 1.35,
    diffuseSkylight: 1.35,
  };
  Object.entries(fields).forEach(([field, maximum]) => {
    const value = environment[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
      throw new Error(`ZEN_SHELL_MATERIAL_ENVIRONMENT_FIELD_INVALID:${field}`);
    }
  });
  const totalSunlight = environment.directSunlight + environment.diffuseSkylight;
  // The diffuse ratio loses influence as daylight vanishes. A finite light
  // floor keeps the exact zero-light sample continuous with late twilight.
  const diffuseShare = environment.diffuseSkylight / (totalSunlight + 0.02);
  return clamp01(
    environment.cloudCover * (0.35 + (diffuseShare * 0.65))
    + (environment.rainIntensity * 0.25),
  );
}

function resolveWeatherMaterial(color, chromaticState, weatherOcclusion, lightnessLoss) {
  if (weatherOcclusion === 0) return color;
  const pigment = hexToOklch(color);
  // Weather changes the light on the existing solar pigment. A small cool
  // diffuse cast preserves dawn/dusk warmth; it never chooses a new time phase.
  const weatherWeight = weatherOcclusion * (0.15 + (chromaticState.daylight * 0.85));
  const coolWeight = weatherWeight * 0.36 * (1 - (chromaticState.warmth * 0.7));
  const hue = pigment.h * Math.PI / 180;
  const coolHue = 250 * Math.PI / 180;
  const axisA = (pigment.c * Math.cos(hue) * (1 - coolWeight))
    + (0.035 * Math.cos(coolHue) * coolWeight);
  const axisB = (pigment.c * Math.sin(hue) * (1 - coolWeight))
    + (0.035 * Math.sin(coolHue) * coolWeight);
  return oklchToHex({
    l: pigment.l - (weatherWeight * lightnessLoss),
    c: Math.hypot(axisA, axisB),
    h: Math.atan2(axisB, axisA) * 180 / Math.PI,
  });
}

function relativeLuminance(value) {
  const [red, green, blue] = parseHexColor(value).map(srgbToLinear);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

function minimumContrast(foreground, backgrounds) {
  return Math.min(...backgrounds.map((background) => contrastRatio(foreground, background)));
}

function ensureDarkForegroundContrast(candidate, backgrounds, minimum) {
  if (minimumContrast(candidate, backgrounds) >= minimum) return candidate;
  let lower = 0;
  let upper = 1;
  for (let index = 0; index < 16; index += 1) {
    const amount = (lower + upper) * 0.5;
    const resolved = mixOklchColor(candidate, '#000000', amount, 0.06);
    if (minimumContrast(resolved, backgrounds) >= minimum) upper = amount;
    else lower = amount;
  }
  const resolved = mixOklchColor(candidate, '#000000', upper, 0.06);
  if (minimumContrast(resolved, backgrounds) < minimum) {
    throw new Error('ZEN_SHELL_MATERIAL_CONTRAST_UNSATISFIABLE');
  }
  return resolved;
}

function freezeColors(record) {
  return Object.freeze({ ...record });
}

function requireColorRecord(record, fieldName, requiredFields) {
  if (!record || typeof record !== 'object') {
    throw new Error(`ZEN_SHELL_MATERIAL_PROJECTION_FIELD_INVALID:${fieldName}`);
  }
  requiredFields.forEach((key) => parseHexColor(record[key]));
}

export function requireZenShellMaterialProjection(projection) {
  if (
    !projection
    || typeof projection !== 'object'
    || projection.version !== ZEN_SHELL_MATERIAL_PROJECTION_VERSION
    || projection.sourceGrammarVersion !== ZEN_WORLD_AMBIENT_GRAMMAR_VERSION
  ) {
    throw new Error('ZEN_SHELL_MATERIAL_PROJECTION_REQUIRED');
  }
  requireColorRecord(projection.backdrop, 'backdrop', ['top', 'bottom']);
  requireColorRecord(projection.layers, 'layers', ['l2Top', 'l2Bottom', 'l3Top', 'l3Bottom']);
  requireColorRecord(projection.surfaces, 'surfaces', [
    'background',
    'base',
    'elevated',
    'sunken',
    'overlay',
  ]);
  requireColorRecord(projection.content, 'content', ['text', 'muted', 'subtle', 'primary']);
  requireColorRecord(projection.boundaries, 'boundaries', [
    'border',
    'borderMuted',
    'borderStrong',
    'edge',
    'castShadow',
    'glow',
  ]);
  const requiredContrast = {
    text: TEXT_CONTRAST_MINIMUM,
    muted: TEXT_CONTRAST_MINIMUM,
    subtle: SUBTLE_TEXT_CONTRAST_MINIMUM,
    primary: TEXT_CONTRAST_MINIMUM,
    borderStrong: STRONG_BORDER_CONTRAST_MINIMUM,
  };
  Object.entries(requiredContrast).forEach(([fieldName, minimum]) => {
    const ratio = Number(projection.contrast?.[fieldName]);
    if (!Number.isFinite(ratio) || ratio < minimum) {
      throw new Error(`ZEN_SHELL_MATERIAL_PROJECTION_CONTRAST_INVALID:${fieldName}`);
    }
  });
  return projection;
}

export function projectZenShellMaterials(chromaticInput = {}, environment) {
  const chromaticState = normalizeZenWorldAmbientGrammar(chromaticInput);
  const weatherOcclusion = resolveWeatherOcclusion(environment);
  const resolve = (roleName) => resolveMaterialRole(ZEN_SHELL_MATERIAL_ROLES[roleName], chromaticState);
  const resolveWeather = (roleName, lightnessLoss) => resolveWeatherMaterial(
    resolve(roleName), chromaticState, weatherOcclusion, lightnessLoss,
  );
  const backdrop = freezeColors({
    top: resolveWeather('backdropTop', 0.11),
    bottom: resolveWeather('backdropBottom', 0.11),
  });
  const layers = freezeColors({
    l2Top: resolveWeather('layerL2Top', 0.06),
    l2Bottom: resolveWeather('layerL2Bottom', 0.06),
    l3Top: resolveWeather('layerL3Top', 0.06),
    l3Bottom: resolveWeather('layerL3Bottom', 0.06),
  });
  const surfaces = freezeColors({
    background: resolveWeather('background', 0.065),
    base: resolveWeather('surface', 0.055),
    elevated: resolveWeather('surfaceElevated', 0.045),
    sunken: resolveWeather('surfaceSunken', 0.065),
    overlay: resolveWeather('surfaceOverlay', 0.055),
  });
  const readableSurfaces = Object.freeze([
    layers.l2Top,
    layers.l2Bottom,
    layers.l3Top,
    layers.l3Bottom,
    ...Object.values(surfaces),
  ]);
  const content = freezeColors({
    text: ensureDarkForegroundContrast(resolve('text'), readableSurfaces, TEXT_CONTRAST_MINIMUM),
    muted: ensureDarkForegroundContrast(resolve('textMuted'), readableSurfaces, TEXT_CONTRAST_MINIMUM),
    subtle: ensureDarkForegroundContrast(resolve('textSubtle'), readableSurfaces, SUBTLE_TEXT_CONTRAST_MINIMUM),
    primary: ensureDarkForegroundContrast(resolve('primary'), readableSurfaces, TEXT_CONTRAST_MINIMUM),
  });
  const borderStrong = ensureDarkForegroundContrast(
    resolve('borderStrong'),
    readableSurfaces,
    STRONG_BORDER_CONTRAST_MINIMUM,
  );
  const boundaries = freezeColors({
    border: resolve('border'),
    borderMuted: resolve('borderMuted'),
    borderStrong,
    edge: resolve('edge'),
    castShadow: resolve('castShadow'),
    glow: resolveWeather('glow', 0.075),
  });
  const contrast = Object.freeze({
    text: Number(minimumContrast(content.text, readableSurfaces).toFixed(4)),
    muted: Number(minimumContrast(content.muted, readableSurfaces).toFixed(4)),
    subtle: Number(minimumContrast(content.subtle, readableSurfaces).toFixed(4)),
    primary: Number(minimumContrast(content.primary, readableSurfaces).toFixed(4)),
    borderStrong: Number(minimumContrast(boundaries.borderStrong, readableSurfaces).toFixed(4)),
  });

  return requireZenShellMaterialProjection(Object.freeze({
    version: ZEN_SHELL_MATERIAL_PROJECTION_VERSION,
    sourceGrammarVersion: chromaticState.version,
    backdrop,
    layers,
    surfaces,
    content,
    boundaries,
    contrast,
  }));
}
