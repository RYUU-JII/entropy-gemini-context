import { formatMinutes } from '@/apps/dashboard/utils/formatters.js';

const HOME_HABIT_FEEDBACK_SOURCE = 'status_snapshot_rolling_pressure';
const HOME_HABIT_CUE_SCOPES = new Set(['domain', 'protected_set']);
const HOME_HABIT_CUE_TONES = new Set(['watch', 'strong']);

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatAbsoluteMinutes = (ms) => (
  formatMinutes(Math.max(0, toNumber(ms)))
);

function normalizeCueDomain(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : '';
}

function createHomeHabitCueError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  return error;
}

function requireFiniteMetric(value, code, details = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw createHomeHabitCueError(code, details);
  }
  return numeric;
}

function assertHabitFeedbackContract(habitFeedback) {
  if (!habitFeedback) return;
  if (habitFeedback.source !== HOME_HABIT_FEEDBACK_SOURCE) {
    throw createHomeHabitCueError('HOME_HABIT_FEEDBACK_SOURCE_INVALID', {
      source: habitFeedback.source || null,
    });
  }
  if (!Array.isArray(habitFeedback.cues)) {
    throw createHomeHabitCueError('HOME_HABIT_FEEDBACK_CUES_INVALID');
  }
}

function assertHabitCueContract(cue = {}) {
  if (!cue.id) {
    throw createHomeHabitCueError('HOME_HABIT_CUE_ID_REQUIRED');
  }
  if (!HOME_HABIT_CUE_SCOPES.has(cue.scope)) {
    throw createHomeHabitCueError('HOME_HABIT_CUE_SCOPE_INVALID', {
      cueId: cue.id,
      scope: cue.scope || null,
    });
  }
  if (!cue.kind) {
    throw createHomeHabitCueError('HOME_HABIT_CUE_KIND_REQUIRED', { cueId: cue.id });
  }
  if (!HOME_HABIT_CUE_TONES.has(cue.tone)) {
    throw createHomeHabitCueError('HOME_HABIT_CUE_TONE_INVALID', {
      cueId: cue.id,
      tone: cue.tone || null,
    });
  }
  if (!cue.labelKey || !cue.metricKey) {
    throw createHomeHabitCueError('HOME_HABIT_CUE_COPY_KEYS_REQUIRED', { cueId: cue.id });
  }
  if (!cue.metricParams || typeof cue.metricParams !== 'object' || Array.isArray(cue.metricParams)) {
    throw createHomeHabitCueError('HOME_HABIT_CUE_METRIC_PARAMS_REQUIRED', { cueId: cue.id });
  }
  if (cue.scope === 'domain' && !normalizeCueDomain(cue.domain)) {
    throw createHomeHabitCueError('HOME_HABIT_CUE_DOMAIN_REQUIRED', { cueId: cue.id });
  }
  const durationMs = requireFiniteMetric(cue.metricParams.durationMs, 'HOME_HABIT_CUE_DURATION_INVALID', {
    cueId: cue.id,
  });
  if (durationMs <= 0) {
    throw createHomeHabitCueError('HOME_HABIT_CUE_DURATION_REQUIRED', { cueId: cue.id });
  }
  if (cue.scope === 'protected_set') {
    const count = requireFiniteMetric(cue.metricParams.count, 'HOME_HABIT_CUE_COUNT_INVALID', {
      cueId: cue.id,
    });
    if (count <= 0) {
      throw createHomeHabitCueError('HOME_HABIT_CUE_COUNT_REQUIRED', { cueId: cue.id });
    }
  }
}

function buildHabitCueMetricParams(cue = {}) {
  const sourceParams = cue.metricParams;
  const durationMs = Math.max(0, toNumber(sourceParams.durationMs));
  return {
    ...sourceParams,
    count: Math.max(0, Math.floor(toNumber(sourceParams.count))),
    activeDays: Math.max(0, Math.floor(toNumber(sourceParams.activeDays))),
    duration: formatAbsoluteMinutes(durationMs),
  };
}

export function resolveHomeHabitCue({
  habitFeedback = null,
  rhythmLensDomain = '',
  tTabs,
} = {}) {
  assertHabitFeedbackContract(habitFeedback);
  const cues = habitFeedback?.cues || [];
  if (cues.length <= 0) return null;
  if (typeof tTabs !== 'function') {
    throw createHomeHabitCueError('HOME_HABIT_CUE_TRANSLATOR_REQUIRED');
  }
  cues.forEach(assertHabitCueContract);

  const selectedDomain = normalizeCueDomain(rhythmLensDomain);
  const selectedDomainCue = selectedDomain
    ? cues.find((cue) => cue?.scope === 'domain' && normalizeCueDomain(cue?.domain) === selectedDomain) || null
    : null;
  const aggregateCue = cues.find((cue) => cue?.scope === 'protected_set') || null;
  const selectedCue = selectedDomainCue || aggregateCue || cues[0] || null;

  const metricParams = buildHabitCueMetricParams(selectedCue);
  const label = tTabs(selectedCue.labelKey, metricParams);
  const metric = selectedCue.metricKey ? tTabs(selectedCue.metricKey, metricParams) : '';
  return {
    id: selectedCue.id,
    scope: selectedCue.scope || null,
    kind: selectedCue.kind || null,
    tone: selectedCue.tone || 'watch',
    domain: normalizeCueDomain(selectedCue.domain),
    eyebrow: tTabs('main.habit_cue_eyebrow', {}),
    label,
    metric,
    ariaLabel: tTabs('main.habit_cue_aria', { label, metric }),
    source: habitFeedback.source,
    evidence: selectedCue.evidence || null,
  };
}
