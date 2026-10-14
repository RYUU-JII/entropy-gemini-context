export const ZEN_MAIN_CAPTURE_PROFILE_ID = 'zen-main-v1';
export const ZEN_MAIN_CAPTURE_ACTIVATION_PARAM = 'entropy-qa-capture';
export const ZEN_MAIN_CAPTURE_DEVELOPMENT_TOOLS_PARAM = 'entropy-qa-development-tools';

export const ZEN_MAIN_CAPTURE_KOI_STATES = Object.freeze({
  FULL: 'full',
  SPARSE: 'sparse',
  EMPTY: 'empty',
});

export const ZEN_MAIN_CAPTURE_BONSAI_STATES = Object.freeze({
  FULL: 'full',
  FLOWER_BUD: 'flower-bud',
  PRE_BLOOM: 'pre-bloom',
  TRAINED: 'trained',
  YOUNG: 'young',
  SEEDLING: 'seedling',
  FIRST_SIGHT: 'first-sight',
});

export const ZEN_MAIN_CAPTURE_WEATHER_STATES = Object.freeze({
  CLEAR: 'clear',
  OVERCAST: 'overcast',
  RAIN: 'rain',
});

export const ZEN_MAIN_CAPTURE_ENVIRONMENT_CLOCKS = Object.freeze({
  FIXED: 'fixed',
  REALTIME: 'realtime',
});

export const ZEN_MAIN_CAPTURE_PRESSURE_STATES = Object.freeze({
  COLLECTING: 'collecting',
  READY: 'ready',
  NO_PRESSURE: 'no-pressure',
});

export const ZEN_MAIN_CAPTURE_POND_EFFECT_PROFILES = Object.freeze({
  FULL: 'full',
  NO_BENTHIC: 'no-benthic',
  NO_CAUSTICS: 'no-caustics',
  NO_ATMOSPHERE: 'no-atmosphere',
  NO_GOD_RAYS: 'no-god-rays',
  NO_CLOUD_REFLECTION: 'no-cloud-reflection',
  NO_KOMOREBI: 'no-komorebi',
  NO_YOONSEUL: 'no-yoonseul',
  NO_FISH_SHADOWS: 'no-fish-shadows',
  NO_LAYER_EFFECTS: 'no-layer-effects',
  NO_SURFACE_EFFECTS: 'no-surface-effects',
  MINIMAL_WATER: 'minimal-water',
});

export const ZEN_MAIN_CAPTURE_POND_EFFECT_PROFILE_VALUES = Object.freeze(
  Object.values(ZEN_MAIN_CAPTURE_POND_EFFECT_PROFILES),
);

export const DEFAULT_ZEN_MAIN_CAPTURE_INPUT = Object.freeze({
  koiState: ZEN_MAIN_CAPTURE_KOI_STATES.FULL,
  bonsaiState: ZEN_MAIN_CAPTURE_BONSAI_STATES.FULL,
  appearanceTime: '12:00',
  environmentClock: ZEN_MAIN_CAPTURE_ENVIRONMENT_CLOCKS.FIXED,
  weather: ZEN_MAIN_CAPTURE_WEATHER_STATES.CLEAR,
  pressureState: ZEN_MAIN_CAPTURE_PRESSURE_STATES.READY,
  pondEffectProfile: ZEN_MAIN_CAPTURE_POND_EFFECT_PROFILES.FULL,
});

const PRESSURE_PRESENTATION_BY_STATE = Object.freeze({
  [ZEN_MAIN_CAPTURE_PRESSURE_STATES.COLLECTING]: Object.freeze({
    readinessState: 'collecting',
    contentState: 'pending',
    observedDayCount: 2,
  }),
  [ZEN_MAIN_CAPTURE_PRESSURE_STATES.READY]: Object.freeze({
    readinessState: 'ready',
    contentState: 'pressure',
    observedDayCount: 3,
  }),
  [ZEN_MAIN_CAPTURE_PRESSURE_STATES.NO_PRESSURE]: Object.freeze({
    readinessState: 'ready',
    contentState: 'no_pressure',
    observedDayCount: 3,
  }),
});

const KOI_COUNT_BY_STATE = Object.freeze({
  [ZEN_MAIN_CAPTURE_KOI_STATES.FULL]: 5,
  [ZEN_MAIN_CAPTURE_KOI_STATES.SPARSE]: 3,
  [ZEN_MAIN_CAPTURE_KOI_STATES.EMPTY]: 0,
});

const BONSAI_DAY_COUNT_BY_STATE = Object.freeze({
  [ZEN_MAIN_CAPTURE_BONSAI_STATES.FULL]: 5,
  [ZEN_MAIN_CAPTURE_BONSAI_STATES.FLOWER_BUD]: 4,
  [ZEN_MAIN_CAPTURE_BONSAI_STATES.PRE_BLOOM]: 4,
  [ZEN_MAIN_CAPTURE_BONSAI_STATES.TRAINED]: 3,
  [ZEN_MAIN_CAPTURE_BONSAI_STATES.YOUNG]: 2,
  [ZEN_MAIN_CAPTURE_BONSAI_STATES.SEEDLING]: 1,
  [ZEN_MAIN_CAPTURE_BONSAI_STATES.FIRST_SIGHT]: 0,
});

const WEATHER_CAUSE_BY_STATE = Object.freeze({
  [ZEN_MAIN_CAPTURE_WEATHER_STATES.CLEAR]: Object.freeze({
    cloudCover: 0.15,
    rainIntensity: 0,
  }),
  [ZEN_MAIN_CAPTURE_WEATHER_STATES.OVERCAST]: Object.freeze({
    cloudCover: 0.82,
    rainIntensity: 0,
  }),
  [ZEN_MAIN_CAPTURE_WEATHER_STATES.RAIN]: Object.freeze({
    cloudCover: 0.9,
    rainIntensity: 0.72,
  }),
});

const requireEnum = (value, values, field) => {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new Error(`ZEN_MAIN_CAPTURE_${field}_INVALID:${String(value)}`);
  }
  return value;
};

export function normalizeZenMainCaptureAppearanceTime(value) {
  if (typeof value !== 'string') {
    throw new Error(`ZEN_MAIN_CAPTURE_APPEARANCE_TIME_INVALID:${String(value)}`);
  }
  const match = /^(\d{2}):(\d{2})$/u.exec(value);
  if (!match) {
    throw new Error(`ZEN_MAIN_CAPTURE_APPEARANCE_TIME_INVALID:${value}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59 || minute % 10 !== 0) {
    throw new Error(`ZEN_MAIN_CAPTURE_APPEARANCE_TIME_INVALID:${value}`);
  }
  return Object.freeze({
    label: value,
    hour: hour + (minute / 60),
    minutes: (hour * 60) + minute,
  });
}

export function normalizeZenMainCaptureInput(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input
    : {};
  const koiState = requireEnum(
    source.koiState ?? DEFAULT_ZEN_MAIN_CAPTURE_INPUT.koiState,
    Object.values(ZEN_MAIN_CAPTURE_KOI_STATES),
    'KOI_STATE',
  );
  const bonsaiState = requireEnum(
    source.bonsaiState ?? DEFAULT_ZEN_MAIN_CAPTURE_INPUT.bonsaiState,
    Object.values(ZEN_MAIN_CAPTURE_BONSAI_STATES),
    'BONSAI_STATE',
  );
  const weather = requireEnum(
    source.weather ?? DEFAULT_ZEN_MAIN_CAPTURE_INPUT.weather,
    Object.values(ZEN_MAIN_CAPTURE_WEATHER_STATES),
    'WEATHER',
  );
  const environmentClock = requireEnum(
    source.environmentClock ?? DEFAULT_ZEN_MAIN_CAPTURE_INPUT.environmentClock,
    Object.values(ZEN_MAIN_CAPTURE_ENVIRONMENT_CLOCKS),
    'ENVIRONMENT_CLOCK',
  );
  const pressureState = requireEnum(
    source.pressureState ?? DEFAULT_ZEN_MAIN_CAPTURE_INPUT.pressureState,
    Object.values(ZEN_MAIN_CAPTURE_PRESSURE_STATES),
    'PRESSURE_STATE',
  );
  const pondEffectProfile = requireEnum(
    source.pondEffectProfile ?? DEFAULT_ZEN_MAIN_CAPTURE_INPUT.pondEffectProfile,
    ZEN_MAIN_CAPTURE_POND_EFFECT_PROFILE_VALUES,
    'POND_EFFECT_PROFILE',
  );
  const pressurePresentation = PRESSURE_PRESENTATION_BY_STATE[pressureState];
  const appearanceTime = normalizeZenMainCaptureAppearanceTime(
    source.appearanceTime ?? DEFAULT_ZEN_MAIN_CAPTURE_INPUT.appearanceTime,
  );
  return Object.freeze({
    profileId: ZEN_MAIN_CAPTURE_PROFILE_ID,
    koiState,
    koiCount: KOI_COUNT_BY_STATE[koiState],
    bonsaiState,
    bonsaiDayCount: BONSAI_DAY_COUNT_BY_STATE[bonsaiState],
    appearanceTime: appearanceTime.label,
    appearanceHour: appearanceTime.hour,
    appearanceMinutes: appearanceTime.minutes,
    environmentClock,
    weather,
    weatherCause: WEATHER_CAUSE_BY_STATE[weather],
    pressureState,
    pressureReadinessState: pressurePresentation.readinessState,
    pressureContentState: pressurePresentation.contentState,
    pressureObservedDayCount: pressurePresentation.observedDayCount,
    pondEffectProfile,
  });
}

export function readZenMainCaptureInputFromSearch(search = '') {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  if (params.get(ZEN_MAIN_CAPTURE_ACTIVATION_PARAM) !== ZEN_MAIN_CAPTURE_PROFILE_ID) {
    return null;
  }
  return normalizeZenMainCaptureInput({
    koiState: params.get('koi-state') ?? undefined,
    bonsaiState: params.get('bonsai-state') ?? undefined,
    appearanceTime: params.get('appearance-time') ?? undefined,
    environmentClock: params.get('environment-clock') ?? undefined,
    weather: params.get('weather') ?? undefined,
    pressureState: params.get('pressure-state') ?? undefined,
    pondEffectProfile: params.get('pond-effects') ?? undefined,
  });
}

export function buildZenMainCaptureSearch(input = {}) {
  const normalized = normalizeZenMainCaptureInput(input);
  const params = new URLSearchParams({
    tab: 'main',
    [ZEN_MAIN_CAPTURE_ACTIVATION_PARAM]: ZEN_MAIN_CAPTURE_PROFILE_ID,
    'koi-state': normalized.koiState,
    'bonsai-state': normalized.bonsaiState,
    'appearance-time': normalized.appearanceTime,
    'environment-clock': normalized.environmentClock,
    weather: normalized.weather,
    'pressure-state': normalized.pressureState,
    'pond-effects': normalized.pondEffectProfile,
  });
  return `?${params.toString()}`;
}
