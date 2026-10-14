function createWeeklyObservationError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

export function requireWeeklyObservationState(entry, index, {
  source = 'weeklySeries',
} = {}) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw createWeeklyObservationError('SITE_WEEKLY_OBSERVATION_ENTRY_INVALID', {
      source,
      index,
    });
  }
  if (!Object.prototype.hasOwnProperty.call(entry, 'observed')) {
    throw createWeeklyObservationError('SITE_WEEKLY_OBSERVATION_STATE_MISSING', {
      source,
      index,
    });
  }
  if (typeof entry.observed !== 'boolean') {
    throw createWeeklyObservationError('SITE_WEEKLY_OBSERVATION_STATE_INVALID', {
      source,
      index,
    });
  }
  return entry.observed;
}

export function selectObservedWeeklyEntries(values, {
  source = 'weeklySeries',
} = {}) {
  if (!Array.isArray(values)) {
    throw createWeeklyObservationError('SITE_WEEKLY_OBSERVATION_SERIES_INVALID', {
      source,
    });
  }
  return values.filter((entry, index) => requireWeeklyObservationState(entry, index, { source }));
}

export function countObservedWeeklyEntries(values, options) {
  return selectObservedWeeklyEntries(values, options).length;
}

function requireWeeklyActiveMs(entry, index, source) {
  if (typeof entry.activeMs !== 'number'
    || !Number.isFinite(entry.activeMs)
    || entry.activeMs < 0) {
    throw createWeeklyObservationError('SITE_WEEKLY_ACTIVE_MS_INVALID', { source, index });
  }
}

function countTrailingActiveDays(values) {
  let streak = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const entry = values[index];
    if (!entry.observed || entry.activeMs <= 0) break;
    streak += 1;
  }
  return streak;
}

export function countTrailingObservedActiveDays(values, {
  source = 'weeklySeries',
} = {}) {
  if (!Array.isArray(values)) {
    throw createWeeklyObservationError('SITE_WEEKLY_OBSERVATION_SERIES_INVALID', {
      source,
    });
  }
  values.forEach((entry, index) => {
    requireWeeklyObservationState(entry, index, { source });
    requireWeeklyActiveMs(entry, index, source);
  });
  return countTrailingActiveDays(values);
}

export function deriveWeeklyObservationSummary(values, {
  source = 'weeklySeries',
} = {}) {
  if (!Array.isArray(values)) {
    throw createWeeklyObservationError('SITE_WEEKLY_OBSERVATION_SERIES_INVALID', { source });
  }
  const observedEntries = [];
  values.forEach((entry, index) => {
    const observed = requireWeeklyObservationState(entry, index, { source });
    requireWeeklyActiveMs(entry, index, source);
    if (typeof entry.overLimit !== 'boolean') {
      throw createWeeklyObservationError('SITE_WEEKLY_OVER_LIMIT_STATE_INVALID', { source, index });
    }
    if (observed) observedEntries.push(entry);
  });
  return {
    observedEntries,
    observedDays: observedEntries.length,
    activeMsTotal: observedEntries.reduce((sum, entry) => sum + entry.activeMs, 0),
    activeDays: observedEntries.filter((entry) => entry.activeMs > 0).length,
    overLimitDays: observedEntries.filter((entry) => entry.overLimit === true).length,
    streakDays: countTrailingActiveDays(values),
    activeMsMax: observedEntries.reduce((maximum, entry) => Math.max(maximum, entry.activeMs), 0),
  };
}
