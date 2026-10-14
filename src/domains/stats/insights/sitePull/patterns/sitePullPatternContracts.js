import {
  clamp,
  clamp01,
  toNumber,
} from '../sitePullMath.js';

export const SITE_PULL_PATTERN_ENGINE_VERSION = 'site-pull-patterns-v1';

export const SITE_PULL_PATTERN_CATEGORIES = Object.freeze({
  DATA: 'data',
  PLAN: 'plan',
  TIME: 'time',
  CHECKING: 'checking',
  ROUTE: 'route',
  IMMERSION: 'immersion',
  HABIT: 'habit',
  TREND: 'trend',
  CIRCADIAN: 'circadian',
  INTERVENTION: 'intervention',
  STEADY: 'steady',
});

export const SITE_PULL_PATTERN_LEVELS = Object.freeze({
  ATOMIC: 'atomic',
  COMPOSITE: 'composite',
  STATE: 'state',
});

export const SITE_PULL_PATTERN_POLARITIES = Object.freeze({
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
  POSITIVE: 'positive',
});

const PATTERN_LEVEL_SET = new Set(Object.values(SITE_PULL_PATTERN_LEVELS));
const PATTERN_POLARITY_SET = new Set(Object.values(SITE_PULL_PATTERN_POLARITIES));

function normalizePatternLevel(level) {
  return PATTERN_LEVEL_SET.has(level) ? level : SITE_PULL_PATTERN_LEVELS.ATOMIC;
}

function inferPatternPolarity({ severity, tone } = {}) {
  if (severity === 'positive' || tone === 'positive') {
    return SITE_PULL_PATTERN_POLARITIES.POSITIVE;
  }
  if (severity === 'danger' || severity === 'warning' || tone === 'danger' || tone === 'warning') {
    return SITE_PULL_PATTERN_POLARITIES.NEGATIVE;
  }
  return SITE_PULL_PATTERN_POLARITIES.NEUTRAL;
}

function normalizePatternPolarity(polarity, signal = {}) {
  return PATTERN_POLARITY_SET.has(polarity)
    ? polarity
    : inferPatternPolarity(signal);
}

function normalizePatternIdList(ids) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  return ids
    .filter((id) => typeof id === 'string' && id.length > 0)
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function normalizePatternPresentation(presentation) {
  if (!presentation || typeof presentation !== 'object') return {};
  const normalized = {};
  const rank = Number(presentation.rank);
  const detectorIndex = Number(presentation.detectorIndex);
  if (Number.isFinite(rank)) normalized.rank = rank;
  if (typeof presentation.group === 'string' && presentation.group) {
    normalized.group = presentation.group;
  }
  if (typeof presentation.slot === 'string' && presentation.slot) {
    normalized.slot = presentation.slot;
  }
  if (Number.isFinite(detectorIndex)) {
    normalized.detectorIndex = Math.max(0, Math.floor(detectorIndex));
  }
  return normalized;
}

export function createSitePullPatternSignal({
  id,
  category,
  severity,
  tone,
  score = 0,
  confidence = 0,
  evidence = {},
  recommendedAction = null,
  source = 'rule',
  sourceList = [],
  mergedSignalCount = 1,
  level = SITE_PULL_PATTERN_LEVELS.ATOMIC,
  polarity = null,
  componentIds = [],
  suppresses = [],
  presentation = null,
} = {}) {
  if (!id) return null;
  const normalizedSourceList = normalizePatternIdList(sourceList);
  const normalizedMergedSignalCount = Math.max(1, Math.floor(toNumber(mergedSignalCount)) || 1);
  return {
    id,
    category,
    severity,
    tone,
    level: normalizePatternLevel(level),
    polarity: normalizePatternPolarity(polarity, { severity, tone }),
    componentIds: normalizePatternIdList(componentIds),
    suppresses: normalizePatternIdList(suppresses),
    presentation: normalizePatternPresentation(presentation),
    score: Math.round(clamp(toNumber(score), 0, 100)),
    confidence: Number(clamp01(confidence).toFixed(2)),
    evidence: evidence && typeof evidence === 'object' ? evidence : {},
    recommendedAction,
    source,
    ...(normalizedSourceList.length > 0 ? { sourceList: normalizedSourceList } : {}),
    ...(normalizedMergedSignalCount > 1 ? { mergedSignalCount: normalizedMergedSignalCount } : {}),
    engineVersion: SITE_PULL_PATTERN_ENGINE_VERSION,
  };
}
