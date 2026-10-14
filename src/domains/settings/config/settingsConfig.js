import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
  requireTextRhythmRuntimeProfile,
} from './index.js';
import { createSeededRandom, shuffleWords } from '../../../lib/textShuffle.js';
import { THEME_CATALOG } from '../../../themes/core/catalog.js';
import { DEFAULT_THEME_ID } from '../../../themes/core/ids.js';
import { SOCIAL_METRIC_SCOPES } from './socialMetricScope.js';

const EXPERIMENTAL_TIER = 'experimental';

export const SETTING_METADATA = {
  fullscreenVisualRelaxation: {
    label: 'Fullscreen visual relaxation',
    control: 'toggle',
    type: 'boolean',
    storage: 'raw',
    category: 'lens',
    tier: 'internal',
    hiddenFromSettings: true,
  },
  blur: {
    label: 'Blur',
    control: 'range',
    type: 'number',
    unit: '',
    unitSuffix: '',
    storage: 'number',
    category: 'lens',
    tier: 'basic',
    order: 10,
    min: '0', max: '100', step: '1',
  },
  hideIcons: {
    label: 'Social Surface',
    control: 'toggle',
    type: 'boolean',
    unit: '',
    unitSuffix: '',
    storage: 'raw',
    category: 'veil',
    tier: 'basic',
    order: 20,
    helper: '프로필 배지, 반응 아이콘, 장식 이모지 같은 표면 신호를 가려서 보상 단서를 한 겹 뒤로 물립니다.',
  },
  saturation: {
    label: 'Grayscale',
    control: 'range',
    type: 'number',
    unit: '',
    unitSuffix: '',
    storage: 'number',
    category: 'lens',
    tier: 'basic',
    order: 20,
    min: '0', max: '100', step: '1',
  },
  brightness: {
    label: 'Brightness',
    control: 'range',
    type: 'number',
    unit: '',
    unitSuffix: '',
    storage: 'number',
    category: 'lens',
    tier: 'basic',
    order: 30,
    min: '0', max: '100', step: '1',
  },
  contrast: {
    label: 'Contrast',
    control: 'range',
    type: 'number',
    unit: '',
    unitSuffix: '',
    storage: 'number',
    category: 'lens',
    tier: 'basic',
    order: 40,
    min: '0', max: '100', step: '1',
  },
  colorSaturation: {
    label: 'Saturation',
    control: 'range',
    type: 'number',
    unit: '',
    unitSuffix: '',
    storage: 'number',
    category: 'lens',
    tier: 'basic',
    order: 50,
    min: '0', max: '100', step: '1',
  },
  textRhythm: {
    label: 'Text Rhythm',
    control: 'toggle',
    type: 'boolean',
    unit: '',
    unitSuffix: '',
    storage: 'raw',
    category: 'barrier',
    tier: 'basic',
    order: 10,
    helper: '자간·투명도·미세 블러·문장 단위 셔플을 하나로 켭니다. 평소에는 기본 리듬, 완화 시간에는 가벼운 리듬, 과사용 압력에서는 강화 리듬으로 자동 조정됩니다.',
  },
  socialMetrics: {
    label: 'Veil',
    control: 'socialMetricScope',
    type: 'object',
    unit: '',
    unitSuffix: '',
    storage: 'raw',
    category: 'veil',
    tier: 'basic',
    order: 10,
    helper: '비교 숫자는 의미 있는 세 범위 중 하나로 고르고, 시간 신호는 별도로 켜고 끕니다.',
    offLabel: '끔',
    scopeOptions: [
      {
        value: SOCIAL_METRIC_SCOPES.REACTIONS,
        label: '반응',
        helper: '좋아요와 댓글 같은 즉각 반응 숫자를 숨깁니다.',
      },
      {
        value: SOCIAL_METRIC_SCOPES.REACTIONS_AND_VIEWS,
        label: '반응 + 조회',
        helper: '반응 수치와 조회 수치를 함께 숨깁니다.',
      },
      {
        value: SOCIAL_METRIC_SCOPES.ALL_COMPARISON,
        label: '전체 비교',
        helper: '팔로워와 구독자 같은 규모 숫자까지 모두 숨깁니다.',
      },
    ],
    timeSignalsOption: {
      label: '시간 신호',
      helper: 'n시간 전, 업로드 날짜 같은 신선도 지표를 숨깁니다.',
    },
  },
  socialEngagement: {
    label: '사회적 지표 숨김',
    control: 'toggle',
    type: 'boolean',
    unit: '',
    unitSuffix: '',
    storage: 'raw',
    category: 'misc',
    tier: 'internal',
    order: 10,
    helper: '좋아요/리포스트/댓글 좋아요 등 반응 지표를 숨깁니다.',
    hiddenFromSettings: true,
  },
  socialExposure: {
    label: '노출·신선도 지표 숨김',
    control: 'toggle',
    type: 'boolean',
    unit: '',
    unitSuffix: '',
    storage: 'raw',
    category: 'misc',
    tier: 'internal',
    order: 20,
    helper: '조회수/업로드 시간 등 노출·신선도 지표를 숨깁니다.',
    hiddenFromSettings: true,
  },
  clickDelay: {
    label: '클릭 일시정지',
    control: 'toggle',
    type: 'boolean',
    unit: '',
    unitSuffix: '',
    storage: 'raw',
    category: 'brake',
    tier: 'basic',
    order: 10,
    helper: '클릭 반응 전에 짧은 일시정지를 넣어, 즉시 반응에 미세한 저항감을 만듭니다.',
  },
  ensoGate: {
    label: '소비 간격',
    control: 'toggle',
    type: 'string',
    unit: '',
    unitSuffix: '',
    storage: 'raw',
    category: 'barrier',
    tier: 'basic',
    order: 10,
    helper: '보호 사이트의 소비 시간이 쌓이면 다음 콘텐츠 경계에서 잠시 멈춥니다. 간격은 도구의 Barrier 설정에서 선택합니다.',
  },
  scrollFriction: {
    label: '스크롤 관성',
    control: 'toggle',
    type: 'boolean',
    unit: '',
    unitSuffix: '',
    storage: 'raw',
    category: 'brake',
    tier: 'basic',
    order: 20,
    helper: '빠른 훑어보기에 낯선 질량감을 주는 하나의 가벼운 관성 프로필을 켜고 끕니다.',
  },
  inputDelay: {
    label: '입력 리듬 제동',
    control: 'range',
    type: 'number',
    unit: 'ms',
    unitSuffix: 'ms',
    storage: 'ms',
    category: 'brake',
    tier: 'basic',
    order: 30,
    helper: '평균 지연보다 간헐적 입력 버스트로 타이핑 리듬을 끊습니다.',
    placeholder: '320',
    min: '0',
    max: '1600',
    step: '10',
    hiddenFromSettings: true,
  },
  navigationButtonLock: {
    label: '되돌리기 잠금',
    control: 'toggle',
    type: 'boolean',
    unit: '',
    unitSuffix: '',
    storage: 'raw',
    category: 'brake',
    tier: 'basic',
    order: 32,
    helper: '마우스 측면 뒤로가기/앞으로가기 버튼을 페이지 안에서 무심코 쓰는 탈출구로 소비하지 못하게 합니다.',
    hiddenFromSettings: true,
  },
  inputVisualBrake: {
    label: '먹의 저항',
    control: 'toggle',
    type: 'boolean',
    unit: '',
    unitSuffix: '',
    storage: 'raw',
    category: 'brake',
    tier: EXPERIMENTAL_TIER,
    order: 35,
    helper: '민감 입력은 읽지 않고, 일반 텍스트 입력은 먹선을 실제로 그릴 때 현재 커서 위치를 한 번만 재어 연속 시각 제동을 겁니다.',
    hiddenFromSettings: true,
  },
};

export const SETTINGS_CATEGORY_ORDER = [
  {
    key: 'lens',
    label: 'Lens',
    description: '보이는 강도와 읽는 리듬을 낮춰서 즉시 소비성을 줄입니다.',
  },
  {
    key: 'veil',
    label: 'Veil',
    description: '사회적 신호와 시간 신호를 줄여서 군중 반응이 판단을 선점하지 못하게 합니다.',
  },
  {
    key: 'brake',
    label: 'Brake',
    description: '클릭, 스크롤, 입력 리듬에 저수준 마찰을 더합니다.',
  },
];

export const SETTINGS_THEME_CONFIG = {
  storageKey: 'app-theme',
  defaultTheme: DEFAULT_THEME_ID,
  availableThemes: THEME_CATALOG,
};

const TEXT_SHADOW_OFFSET = { x: 1, y: 1 };
export const TEXT_SHADOW_LEVELS = [
  { level: 1, label: '약', blur: 1, alpha: 0.25 },
  { level: 2, label: '중', blur: 2, alpha: 0.45 },
  { level: 3, label: '강', blur: 3, alpha: 0.65 },
];
export const TEXT_SHADOW_COLORS = [
  { key: 'black', label: '검정', rgb: [0, 0, 0] },
  { key: 'red', label: '빨강', rgb: [239, 68, 68] },
  { key: 'green', label: '초록', rgb: [34, 197, 94] },
  { key: 'blue', label: '파랑', rgb: [59, 130, 246] },
  { key: 'amber', label: '주황', rgb: [245, 158, 11] },
  { key: 'cyan', label: '시안', rgb: [6, 182, 212] },
];
export const DEFAULT_TEXT_SHADOW_COLOR_KEY = 'black';
export const DEFAULT_TEXT_SHADOW_LEVEL = 1;

export function clampShadowLevel(level) {
  const n = parseInt(String(level), 10);
  if (!Number.isFinite(n)) return DEFAULT_TEXT_SHADOW_LEVEL;
  return Math.max(1, Math.min(TEXT_SHADOW_LEVELS.length, n));
}

function getShadowColorByKey(key) {
  return TEXT_SHADOW_COLORS.find((color) => color.key === key) || TEXT_SHADOW_COLORS[0];
}

export function shadowColorCss(color) {
  return `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`;
}

export function buildTextShadowValue(level, colorKey) {
  const clampedLevel = clampShadowLevel(level);
  const color = getShadowColorByKey(colorKey);
  const meta = TEXT_SHADOW_LEVELS[clampedLevel - 1];
  const rgba = `rgba(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]}, ${meta.alpha})`;
  return `${TEXT_SHADOW_OFFSET.x}px ${TEXT_SHADOW_OFFSET.y}px ${meta.blur}px ${rgba}`;
}

function parseHexColor(raw) {
  const hex = String(raw || '').replace('#', '').trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { rgb: [r, g, b], alpha: null };
  }
  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : null;
    return { rgb: [r, g, b], alpha };
  }
  return null;
}

function parseShadowColor(raw) {
  if (!raw) return null;
  const rgbaMatch = String(raw).match(/rgba?\s*\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)(?:[,\s]+([0-9.]+))?\s*\)/i);
  if (rgbaMatch) {
    const r = Math.max(0, Math.min(255, parseFloat(rgbaMatch[1])));
    const g = Math.max(0, Math.min(255, parseFloat(rgbaMatch[2])));
    const b = Math.max(0, Math.min(255, parseFloat(rgbaMatch[3])));
    const aRaw = rgbaMatch[4];
    const alpha = aRaw === undefined ? 1 : Math.max(0, Math.min(1, parseFloat(aRaw)));
    return { rgb: [r, g, b], alpha };
  }

  const hexMatch = String(raw).match(/#([0-9a-f]{3,8})/i);
  if (hexMatch) {
    return parseHexColor(hexMatch[1]);
  }

  return null;
}

function parseShadowBlur(raw) {
  const matches = String(raw || '').match(/-?\d+(?:\.\d+)?px/g) || [];
  if (matches.length < 3) return null;
  const blur = parseFloat(matches[2]);
  return Number.isFinite(blur) ? blur : null;
}

function getClosestShadowColor(targetRgb) {
  if (!Array.isArray(targetRgb) || targetRgb.length !== 3) return getShadowColorByKey(DEFAULT_TEXT_SHADOW_COLOR_KEY);
  let best = TEXT_SHADOW_COLORS[0];
  let bestDiff = Infinity;
  TEXT_SHADOW_COLORS.forEach((color) => {
    const dr = color.rgb[0] - targetRgb[0];
    const dg = color.rgb[1] - targetRgb[1];
    const db = color.rgb[2] - targetRgb[2];
    const diff = dr * dr + dg * dg + db * db;
    if (diff < bestDiff) {
      best = color;
      bestDiff = diff;
    }
  });
  return best;
}

function getClosestShadowLevelByAlpha(alpha) {
  const normalized = Math.max(0, Math.min(1, Number(alpha)));
  let bestLevel = DEFAULT_TEXT_SHADOW_LEVEL;
  let bestDiff = Infinity;
  TEXT_SHADOW_LEVELS.forEach((level) => {
    const diff = Math.abs(level.alpha - normalized);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestLevel = level.level;
    }
  });
  return bestLevel;
}

function getClosestShadowLevelByBlur(blur) {
  let bestLevel = DEFAULT_TEXT_SHADOW_LEVEL;
  let bestDiff = Infinity;
  TEXT_SHADOW_LEVELS.forEach((level) => {
    const diff = Math.abs(level.blur - blur);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestLevel = level.level;
    }
  });
  return bestLevel;
}

export function getTextShadowState(rawValue) {
  const fallbackColor = getShadowColorByKey(DEFAULT_TEXT_SHADOW_COLOR_KEY);
  const fallbackLevel = DEFAULT_TEXT_SHADOW_LEVEL;
  if (!rawValue) return { color: fallbackColor, level: fallbackLevel };

  const parsedColor = parseShadowColor(rawValue);
  const blur = parseShadowBlur(rawValue);
  const color = parsedColor?.rgb ? getClosestShadowColor(parsedColor.rgb) : fallbackColor;

  let level = fallbackLevel;
  if (typeof parsedColor?.alpha === 'number') level = getClosestShadowLevelByAlpha(parsedColor.alpha);
  else if (typeof blur === 'number') level = getClosestShadowLevelByBlur(blur);

  return { color, level };
}

export function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function valueForInput(meta, storedValue) {
  const entry = storedValue && typeof storedValue === 'object' && !Array.isArray(storedValue)
    ? storedValue
    : null;
  const value = entry ? (entry.value ?? '') : (storedValue ?? '');

  if (typeof meta?.fromStorage === 'function') return meta.fromStorage(value);

  if (meta.storage === 'ms') {
    if (typeof value === 'number') return value;
    const n = parseInt(String(value), 10);
    return Number.isFinite(n) ? n : 0;
  }


  if (meta.storage === 'raw') return String(value);

  if (meta.storage === 'secondsCss') {
    if (typeof value === 'number') return value;
    const s = String(value);
    const match = s.match(/-?\d+(\.\d+)?/);
    const n = match ? parseFloat(match[0]) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  if (meta.storage === 'cssUnit') {
    const s = String(value);
    if (meta.unitSuffix && s.endsWith(meta.unitSuffix)) return s.slice(0, -meta.unitSuffix.length);
    const match = s.match(/^-?(\d*\.)?\d+/);
    return match ? match[0] : '';
  }

  if (meta.storage === 'numberString') {
    if (typeof value === 'number') return value;
    const n = parseFloat(String(value));
    return Number.isFinite(n) ? n : '';
  }

  if (meta.storage === 'number') {
    const n = parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
  }

  return String(value);
}

export function valueForStorage(_key, meta, inputValue) {
  const raw = inputValue ?? '';

  if (typeof meta?.toStorage === 'function') return meta.toStorage(raw);

  if (meta.storage === 'ms') return parseInt(String(raw), 10) || 0;
  if (meta.storage === 'raw') return String(raw);
  if (meta.storage === 'secondsCss') {
    const num = parseFloat(String(raw)) || 0;
    const unit = meta.unitSuffix || meta.unit || 's';
    return `${num}${unit}`;
  }
  if (meta.storage === 'cssUnit') {
    const unit = meta.unitSuffix || meta.unit || '';
    return `${raw}${unit}`;
  }
  if (meta.storage === 'numberString') {
    const n = parseFloat(String(raw));
    if (!Number.isFinite(n)) return '';
    return String(n);
  }
  if (meta.storage === 'number') {
    const n = parseFloat(String(raw));
    return Number.isFinite(n) ? n : 0;
  }

  return raw;
}

export function getCategoryEntries(category, showExperimental) {
  return Object.entries(SETTING_METADATA)
    .filter(([, meta]) => meta.category === category)
    .filter(([, meta]) => !meta.hiddenFromSettings)
    .filter(([, meta]) => meta?.tier !== EXPERIMENTAL_TIER || showExperimental)
    .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
}



// Helper to safely get a setting entry or default

export function getSettingEntry(settings, key) {
  if (settings && settings[key]) return settings[key];
  if (CONFIG_DEFAULT_FILTER_SETTINGS[key]) return CONFIG_DEFAULT_FILTER_SETTINGS[key];
  return { isActive: false, value: '' };
}

export function getTextRhythmShuffleDistanceDistribution(setting) {
  if (!setting || typeof setting !== 'object' || Array.isArray(setting)) {
    throw new Error('TEXT_RHYTHM_PREVIEW_ENTRY_INVALID');
  }
  if (typeof setting.isActive !== 'boolean') {
    throw new Error('TEXT_RHYTHM_PREVIEW_ENTRY_INVALID');
  }
  if (!setting.isActive) return null;
  const profile = requireTextRhythmRuntimeProfile(setting.value);
  return profile.shuffle.enabled ? profile.shuffle.distanceDistribution : null;
}

export function seededShuffleWords(text, seedStr, distanceDistribution) {
  if (!distanceDistribution) return String(text || '');
  const random = createSeededRandom(seedStr);
  return shuffleWords(text, {
    distanceDistribution,
    random,
  });
}
