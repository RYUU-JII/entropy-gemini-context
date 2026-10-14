import {
  normalizeZenWorldAmbientGrammar,
  requireZenWorldAmbientGrammar,
} from './zenWorldAmbientGrammar.js';

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const MATERIAL_GRAMMAR_FIELDS = Object.freeze(['daylight', 'nightDepth', 'dawnWeight', 'duskWeight',
  'warmth', 'lowSun', 'noonWeight', 'twilightWeight', 'nightWeight']);

const parseColor = (value) => {
  const source = typeof value === 'string' ? value.trim() : '';
  const hex = /^#([\da-f]{6})$/iu.exec(source);
  if (hex) {
    return {
      format: 'hex',
      r: Number.parseInt(hex[1].slice(0, 2), 16),
      g: Number.parseInt(hex[1].slice(2, 4), 16),
      b: Number.parseInt(hex[1].slice(4, 6), 16),
      a: 1,
    };
  }
  const rgba = /^rgba?\(([^)]+)\)$/iu.exec(source);
  if (rgba) {
    const channels = rgba[1].split(',').map((entry) => Number(entry.trim()));
    if (channels.length >= 3 && channels.slice(0, 3).every(Number.isFinite)) {
      return {
        format: 'rgba',
        r: Math.max(0, Math.min(255, channels[0])),
        g: Math.max(0, Math.min(255, channels[1])),
        b: Math.max(0, Math.min(255, channels[2])),
        a: clamp01(Number.isFinite(channels[3]) ? channels[3] : 1),
      };
    }
  }
  throw new Error(`ZEN_AMBIENT_COLOR_INVALID:${String(value)}`);
};

const rgbToHsl = ({ r, g, b }) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) * 0.5;
  let hue = 0;

  if (delta > 1e-6) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = ((blue - red) / delta) + 2;
    else hue = ((red - green) / delta) + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return {
    h: hue,
    s: delta <= 1e-6 ? 0 : delta / (1 - Math.abs((2 * lightness) - 1)),
    l: lightness,
  };
};

const hslToRgb = ({ h, s, l }) => {
  const hue = ((Number(h) % 360) + 360) % 360;
  const saturation = clamp01(s);
  const lightness = clamp01(l);
  const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = lightness - (chroma * 0.5);
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) [red, green, blue] = [chroma, second, 0];
  else if (hue < 120) [red, green, blue] = [second, chroma, 0];
  else if (hue < 180) [red, green, blue] = [0, chroma, second];
  else if (hue < 240) [red, green, blue] = [0, second, chroma];
  else if (hue < 300) [red, green, blue] = [second, 0, chroma];
  else [red, green, blue] = [chroma, 0, second];

  return {
    r: Math.round((red + offset) * 255),
    g: Math.round((green + offset) * 255),
    b: Math.round((blue + offset) * 255),
  };
};

const interpolateHue = (from, to, amount) => {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return from + (delta * amount);
};

const formatMixedColor = (rgb, alpha, format) => {
  if (format === 'rgba') {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp01(alpha).toFixed(3)})`;
  }
  const channel = (value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
};

// Hue-aware interpolation keeps the warm-to-indigo handoff chromatic instead
// of taking the low-saturation midpoint produced by straight RGB mixing.
export const mixZenAmbientCurveColor = (from, to, amount) => {
  const t = clamp01(amount);
  if (t <= 0) return from;
  if (t >= 1) return to;
  const start = parseColor(from);
  const end = parseColor(to);
  const startHsl = rgbToHsl(start);
  const endHsl = rgbToHsl(end);
  const rgb = hslToRgb({
    h: interpolateHue(startHsl.h, endHsl.h, t),
    s: startHsl.s + ((endHsl.s - startHsl.s) * t),
    l: startHsl.l + ((endHsl.l - startHsl.l) * t),
  });
  return formatMixedColor(
    rgb,
    start.a + ((end.a - start.a) * t),
    start.format === 'rgba' || end.format === 'rgba' ? 'rgba' : 'hex',
  );
};

const mixZenAmbientLinearColor = (from, to, amount) => {
  const t = clamp01(amount);
  if (t <= 0) return from;
  if (t >= 1) return to;
  const start = parseColor(from);
  const end = parseColor(to);
  return formatMixedColor({
    r: Math.round(start.r + ((end.r - start.r) * t)),
    g: Math.round(start.g + ((end.g - start.g) * t)),
    b: Math.round(start.b + ((end.b - start.b) * t)),
  }, start.a + ((end.a - start.a) * t), start.format === 'rgba' || end.format === 'rgba' ? 'rgba' : 'hex');
};

// Canonical chromatic spine. Every material has its own value/chroma response,
// but every material crosses the same day -> warm -> twilight -> indigo phases.
// The garden's sky keeps a cool upper atmosphere over a warm low horizon.
export const ZEN_AMBIENT_SPECTRUM = Object.freeze({
  noon: Object.freeze({
    light: 'rgba(255, 255, 255, 1)',
    water: Object.freeze(['#3C8166', '#326D55', '#24513D']),
    shell: Object.freeze(['#fdfbf7', '#f8f6f0']),
    terrain: Object.freeze(['#fbfaf6', '#ece8df', '#d2cabe']),
    bonsai: Object.freeze(['#DCE9ED', '#E9EFF0', '#F1E9DA', '#DECEB7']),
  }),
  day: Object.freeze({
    light: 'rgba(255, 250, 230, 1)',
    water: Object.freeze(['#216068', '#38959E', '#5DCBD4']),
    shell: Object.freeze(['#fdfbf7', '#f8f6f0']),
    terrain: Object.freeze(['#fbfaf6', '#ece8df', '#d2cabe']),
    bonsai: Object.freeze(['#D8E5E9', '#E4EAEB', '#EFE6D6', '#DECEB7']),
  }),
  warm: Object.freeze({
    light: 'rgba(235, 142, 112, 1)',
    water: Object.freeze(['#567D68', '#426654', '#2C483B']),
    shell: Object.freeze(['#e8cfb5', '#dfc4a8']),
    terrain: Object.freeze(['#f8dfbf', '#d8c1a3', '#cca882']),
    bonsai: Object.freeze(['#BEC8D0', '#E1C6BB', '#EAB58E', '#BA9873']),
  }),
  twilight: Object.freeze({
    light: 'rgba(208, 148, 168, 1)',
    water: Object.freeze(['#9E6C8C', '#684A6E', '#423048']),
    shell: Object.freeze(['#3b3442', '#2f2935']),
    terrain: Object.freeze(['#56475C', '#6E586F', '#524355']),
    bonsai: Object.freeze(['#34384E', '#6E5D74', '#AB7D76', '#3F323A']),
  }),
  night: Object.freeze({
    light: 'rgba(180, 191, 230, 1)',
    water: Object.freeze(['#20284F', '#171E3C', '#11172E']),
    shell: Object.freeze(['#1d2446', '#151b35']),
    terrain: Object.freeze(['#242C4D', '#343E5B', '#29324E']),
    bonsai: Object.freeze(['#1E2646', '#2A3451', '#444F6B', '#39435B']),
  }),
});

export const resolveZenAmbientRoleColor = ({
  day,
  warm,
  twilight,
  night,
}, chromaticState) => {
  const warmed = mixZenAmbientCurveColor(day, warm, chromaticState.warmth);
  const twilit = mixZenAmbientCurveColor(warmed, twilight, chromaticState.twilightWeight);
  return mixZenAmbientCurveColor(twilit, night, chromaticState.nightWeight);
};

const resolveRole = (role, chromaticState) => {
  const daytime = ZEN_AMBIENT_SPECTRUM.day[role];
  const noon = ZEN_AMBIENT_SPECTRUM.noon[role];
  const day = Array.isArray(daytime)
    ? daytime.map((entry, index) => mixZenAmbientLinearColor(entry, noon[index], chromaticState.noonWeight))
    : mixZenAmbientLinearColor(daytime, noon, chromaticState.noonWeight);
  const warm = ZEN_AMBIENT_SPECTRUM.warm[role];
  const twilight = ZEN_AMBIENT_SPECTRUM.twilight[role];
  const night = ZEN_AMBIENT_SPECTRUM.night[role];
  if (Array.isArray(day)) {
    return day.map((entry, index) => {
      if (role === 'water') {
        const warmed = mixZenAmbientLinearColor(entry, warm[index], chromaticState.warmth);
        const twilit = mixZenAmbientCurveColor(warmed, twilight[index], chromaticState.twilightWeight);
        return mixZenAmbientCurveColor(twilit, night[index], chromaticState.nightWeight);
      }
      return resolveZenAmbientRoleColor({
        day: entry,
        warm: warm[index],
        twilight: twilight[index],
        night: night[index],
      }, chromaticState);
    });
  }
  return resolveZenAmbientRoleColor({ day, warm, twilight, night }, chromaticState);
};

export function resolveZenAmbientPalette(chromaticInput = {}) {
  const chromaticState = normalizeZenWorldAmbientGrammar(chromaticInput);
  const shell = resolveRole('shell', chromaticState);
  const terrain = resolveRole('terrain', chromaticState);
  const bonsai = resolveRole('bonsai', chromaticState);
  return Object.freeze({
    ...chromaticState,
    lightColor: resolveRole('light', chromaticState),
    water: Object.freeze(resolveRole('water', chromaticState)),
    shell: Object.freeze({ top: shell[0], bottom: shell[1] }),
    terrain: Object.freeze({ atmosphereTop: terrain[0], sandBase: terrain[1], sandFront: terrain[2] }),
    bonsai: Object.freeze({ skyTop: bonsai[0], skyMid: bonsai[1], skyLow: bonsai[2], floor: bonsai[3] }),
  });
}

function mixSkyWeatherPigment(pigment, diffusePigment, amount) {
  if (amount === 0) return pigment;
  const base = parseColor(pigment);
  const diffuse = parseColor(diffusePigment);
  const luma = color => color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  // A daytime cloud pigment must not brighten the darker dawn/twilight sky.
  const diffuseExposure = Math.min(1, luma(base) * 0.9 / luma(diffuse));
  return formatMixedColor(Object.fromEntries(['r', 'g', 'b'].map(channel => [
    channel,
    Math.round(base[channel] + (diffuse[channel] * diffuseExposure - base[channel]) * amount),
  ])), base.a, base.format);
}

// One weather projection supplies the canvas sky and the inscription's contrast
// surface. The canonical palette still owns time; cloud/rain only change light.
function requireSkyEnvironment(environment) {
  for (const field of ['daylight', 'cloudCover', 'rainIntensity']) {
    const value = environment?.[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`ZEN_WORLD_SKY_ENVIRONMENT_FIELD_INVALID:${field}`);
    }
  }
  return environment;
}

export function projectZenWorldWeatherSkyPalette(solarPalette, environment) {
  requireZenWorldAmbientGrammar(solarPalette);
  requireSkyEnvironment(environment);
  if (!solarPalette.bonsai || typeof solarPalette.bonsai !== 'object') {
    throw new Error('ZEN_WORLD_SKY_SOLAR_PALETTE_REQUIRED');
  }
  const coverage = Math.min(1, environment.cloudCover * 0.72 + environment.rainIntensity * 0.28);
  const solarTransition = Math.max(
    solarPalette.dawnWeight, solarPalette.duskWeight, solarPalette.twilightWeight,
  );
  const response = coverage * environment.daylight
    * (1 - solarPalette.warmth * 0.7) * (1 - solarTransition * 0.75);
  return Object.freeze({
    ...solarPalette,
    bonsai: Object.freeze({
      ...solarPalette.bonsai,
      skyTop: mixSkyWeatherPigment(solarPalette.bonsai.skyTop, '#9eafbd', response * 0.72),
      skyMid: mixSkyWeatherPigment(solarPalette.bonsai.skyMid, '#aebcc6', response * 0.76),
      skyLow: mixSkyWeatherPigment(solarPalette.bonsai.skyLow, '#b5c0cb', response * 0.9),
    }),
  });
}

const skyPalettes = new WeakMap();
let lastSkyKey = '', lastSkyPalette = null;

// Motion and cloud-phase updates can carry a fresh environment object with the
// same pigments. Retain the compiled palette by its consumed numeric inputs,
// with weak per-environment entries and one bounded cross-sample reuse slot.
export function resolveZenWorldWeatherSkyPalette(environment) {
  requireSkyEnvironment(environment);
  const grammar = requireZenWorldAmbientGrammar(environment.ambientChromaticState);
  const key = [...MATERIAL_GRAMMAR_FIELDS.map(field => grammar[field]),
    environment.daylight, environment.cloudCover, environment.rainIntensity].join('|');
  const cached = skyPalettes.get(environment);
  if (cached?.key === key) return cached.palette;
  const palette = key === lastSkyKey ? lastSkyPalette
    : projectZenWorldWeatherSkyPalette(resolveZenAmbientPalette(grammar), environment);
  skyPalettes.set(environment, { key, palette });
  lastSkyKey = key; lastSkyPalette = palette;
  return palette;
}

// A static paint signature follows visible light, not weather scheduling or
// motion metadata. Five-percent light bands match the existing solar bake grain;
// pigment channels use an eight-step grain, below the scene's broad washes.
// Moonlight is visible light too: it washes faint stars out of the baked sky.
export function resolveZenWorldMaterialPaintSignature(environment) {
  requireSkyEnvironment(environment);
  const grammar = requireZenWorldAmbientGrammar(environment.ambientChromaticState);
  const lightFields = ['nightDepth', 'solarElevation', 'directSunlight', 'diffuseSkylight', 'sunDirectionY', 'sunDirectionZ', 'moonlight'];
  for (const field of lightFields) {
    if (!Number.isFinite(environment[field])) throw new Error(`ZEN_WORLD_MATERIAL_ENVIRONMENT_FIELD_INVALID:${field}`);
  }
  const light = parseColor(environment.lightColor);
  const band = value => Math.round(value * 20);
  return ['zen-world-paint-v2', ...MATERIAL_GRAMMAR_FIELDS.map(field => band(grammar[field])),
    band(environment.daylight), band(environment.cloudCover), band(environment.rainIntensity),
    ...lightFields.map(field => band(environment[field])),
    ...['r', 'g', 'b'].map(field => Math.round(light[field] / 8)), light.a].join('|');
}
