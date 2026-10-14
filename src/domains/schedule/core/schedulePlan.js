export const SCHEDULE_MINUTES_IN_DAY = 1440;
export const SCHEDULE_STEP_MINUTES = 10;
export const SCHEDULE_INPUT_MIN_GAP = 30;
export const SCHEDULE_WINDOW_NAME_MAX_LENGTH = 40;
export const SCHEDULE_PLAN_SCHEMA_VERSION = 1;

export const SCHEDULE_WINDOW_INTENTS = Object.freeze({
  RELAXATION: 'relaxation',
  ISOLATION: 'isolation',
});

export const SCHEDULE_DAYS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);
export const SCHEDULE_NOTIFICATION_MODES = Object.freeze(['auto', 'none', 'end', 'both']);
export function requireScheduleNotificationMode(value) {
  if (!SCHEDULE_NOTIFICATION_MODES.includes(value)) throw new Error('SCHEDULE_NOTIFICATION_MODE_INVALID');
  return value;
}

export const DEFAULT_SCHEDULE_PLAN = Object.freeze({
  schemaVersion: SCHEDULE_PLAN_SCHEMA_VERSION,
  days: SCHEDULE_DAYS,
  windows: Object.freeze([]),
  startMin: 0,
  endMin: SCHEDULE_MINUTES_IN_DAY,
});

export function normalizeScheduleWindowIntent(value) {
  // Missing intent is accepted at the existing schedule input boundary only.
  if (value === undefined) return SCHEDULE_WINDOW_INTENTS.RELAXATION;
  if (!Object.values(SCHEDULE_WINDOW_INTENTS).includes(value)) {
    throw new Error('SCHEDULE_WINDOW_INTENT_INVALID');
  }
  return value;
}

export function normalizeScheduleWindowName(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, SCHEDULE_WINDOW_NAME_MAX_LENGTH);
}

export function normalizeScheduleWindowDays(value, fallback = SCHEDULE_DAYS) {
  return normalizeScheduleDays(value, fallback, { requireNonEmpty: true });
}

export function createScheduleWindowId() {
  return `window-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function clampScheduleMinute(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(SCHEDULE_MINUTES_IN_DAY, Math.round(numeric)));
}

export function normalizeScheduleStartMinute(value, fallback = 0) {
  const minute = clampScheduleMinute(value, fallback);
  return minute === SCHEDULE_MINUTES_IN_DAY ? 0 : minute;
}

export function wrapScheduleMinute(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return ((Math.round(numeric) % SCHEDULE_MINUTES_IN_DAY) + SCHEDULE_MINUTES_IN_DAY) % SCHEDULE_MINUTES_IN_DAY;
}

export function normalizeScheduleDays(days, fallback = [], options = {}) {
  const {
    requireNonEmpty = false,
  } = options || {};
  const source = Array.isArray(days) ? days : fallback;
  const unique = new Set();

  if (Array.isArray(source)) {
    source.forEach((day) => {
      const value = Number(day);
      if (Number.isInteger(value) && value >= 0 && value <= 6) {
        unique.add(value);
      }
    });
  }

  if (unique.size === 0 && requireNonEmpty) {
    return [...SCHEDULE_DAYS];
  }

  return Array.from(unique).sort((a, b) => a - b);
}

export function getScheduleWindowDuration(window) {
  const startMin = Number.isFinite(window?.startMin) ? window.startMin : null;
  const endMin = Number.isFinite(window?.endMin) ? window.endMin : null;
  if (startMin === null || endMin === null || startMin === endMin) return 0;
  if (startMin > endMin) {
    return SCHEDULE_MINUTES_IN_DAY - startMin + endMin;
  }
  return endMin - startMin;
}

function normalizeScheduleWindowMinDuration(value) {
  const numeric = Number(value);
  const rounded = Number.isFinite(numeric) ? Math.round(numeric) : SCHEDULE_INPUT_MIN_GAP;
  return Math.max(
    SCHEDULE_STEP_MINUTES,
    Math.min(SCHEDULE_MINUTES_IN_DAY - SCHEDULE_STEP_MINUTES, rounded),
  );
}

function resolveScheduleEndFromDuration(startMin, duration) {
  const safeStart = normalizeScheduleStartMinute(startMin);
  const safeDuration = normalizeScheduleWindowMinDuration(duration);
  const rawEnd = safeStart + safeDuration;
  if (rawEnd < SCHEDULE_MINUTES_IN_DAY) return rawEnd;
  if (rawEnd === SCHEDULE_MINUTES_IN_DAY) return SCHEDULE_MINUTES_IN_DAY;
  return rawEnd - SCHEDULE_MINUTES_IN_DAY;
}

export function splitScheduleWindowSegments(window) {
  if (!window) return [];
  const startMin = normalizeScheduleStartMinute(window.startMin);
  const endMin = clampScheduleMinute(window.endMin, SCHEDULE_MINUTES_IN_DAY);
  if (startMin === endMin) return [];
  if (startMin > endMin) {
    return [
      { start: startMin, end: SCHEDULE_MINUTES_IN_DAY },
      { start: 0, end: endMin },
    ];
  }
  return [{ start: startMin, end: endMin }];
}

export function isMinuteInScheduleWindow(minuteOfDay, window) {
  const minute = Number(minuteOfDay);
  if (!Number.isFinite(minute)) return false;
  const startMin = Number.isFinite(window?.startMin) ? window.startMin : null;
  const endMin = Number.isFinite(window?.endMin) ? window.endMin : null;
  if (startMin === null || endMin === null || startMin === endMin) return false;
  if (startMin > endMin) {
    return minute >= startMin || minute < endMin;
  }
  return minute >= startMin && minute < endMin;
}

export function normalizeScheduleWindow(rawWindow, options = {}) {
  const {
    fallbackStart = 0,
    fallbackEnd = SCHEDULE_MINUTES_IN_DAY,
    fallbackDays = SCHEDULE_DAYS,
    createMissingId = false,
    minDuration = SCHEDULE_INPUT_MIN_GAP,
  } = options || {};
  const source = rawWindow && typeof rawWindow === 'object' ? rawWindow : {};
  const isAllDay = source.allDay === true;
  const startMin = isAllDay ? 0 : normalizeScheduleStartMinute(
    Number.isFinite(source.startMin) ? source.startMin : fallbackStart,
    fallbackStart,
  );
  let endMin = isAllDay ? SCHEDULE_MINUTES_IN_DAY : clampScheduleMinute(
    Number.isFinite(source.endMin) ? source.endMin : fallbackEnd,
    fallbackEnd,
  );
  const safeMinDuration = normalizeScheduleWindowMinDuration(minDuration);
  const duration = getScheduleWindowDuration({ startMin, endMin });

  if (!isAllDay && duration < safeMinDuration) {
    endMin = resolveScheduleEndFromDuration(startMin, safeMinDuration);
  }

  const intent = normalizeScheduleWindowIntent(source.intent);
  const name = normalizeScheduleWindowName(source.name);
  const days = normalizeScheduleWindowDays(source.days, fallbackDays);
  const id = typeof source.id === 'string' && source.id.trim()
    ? source.id.trim()
    : (createMissingId ? createScheduleWindowId() : '');
  const window = { startMin, endMin, intent, days };

  if (id) window.id = id;
  if (name) window.name = name;
  if (isAllDay) window.allDay = true;
  if (source.notificationMode !== undefined) window.notificationMode = requireScheduleNotificationMode(source.notificationMode);

  return window;
}

export function normalizeScheduleWindows(rawWindows, options = {}) {
  const {
    fallbackStart = 0,
    fallbackEnd = SCHEDULE_MINUTES_IN_DAY,
    fallbackDays = SCHEDULE_DAYS,
    fallbackWindows = [],
    createMissingIds = false,
  } = options || {};
  const source = Array.isArray(rawWindows) ? rawWindows : fallbackWindows;
  if (!Array.isArray(source)) return [];

  return source
    .map((window) => normalizeScheduleWindow(window, {
      fallbackStart,
      fallbackEnd,
      fallbackDays,
      createMissingId: createMissingIds,
      minDuration: options?.minDuration,
    }))
    .filter(Boolean);
}

export function normalizeSchedulePlan(rawPlan, options = {}) {
  const {
    requireNonEmptyDays = true,
    createMissingWindowIds = false,
  } = options || {};
  const source = rawPlan && typeof rawPlan === 'object' ? rawPlan : {};
  const startMin = clampScheduleMinute(source.startMin, DEFAULT_SCHEDULE_PLAN.startMin);
  const endMin = clampScheduleMinute(source.endMin, DEFAULT_SCHEDULE_PLAN.endMin);
  const days = normalizeScheduleDays(source.days, DEFAULT_SCHEDULE_PLAN.days, {
    requireNonEmpty: requireNonEmptyDays,
  });
  const windows = normalizeScheduleWindows(
    Array.isArray(source.windows) ? source.windows : source.blocks,
    {
      fallbackStart: startMin,
      fallbackEnd: endMin,
      fallbackDays: days,
      createMissingIds: createMissingWindowIds,
    },
  );
  return {
    schemaVersion: SCHEDULE_PLAN_SCHEMA_VERSION,
    days,
    windows,
    startMin: windows[0]?.startMin ?? startMin,
    endMin: windows[0]?.endMin ?? endMin,
  };
}

export function toRelaxationSchedule(plan) {
  const normalized = normalizeSchedulePlan(plan);
  return {
    schemaVersion: SCHEDULE_PLAN_SCHEMA_VERSION,
    days: [...normalized.days],
    blocks: normalized.windows.map((window) => ({ ...window })),
    startMin: normalized.startMin,
    endMin: normalized.endMin,
  };
}

function getDateParts(ts) {
  const date = new Date(Number.isFinite(Number(ts)) ? Number(ts) : Date.now());
  const day = date.getDay();
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  const previousDay = (day + 6) % 7;
  return { day, minuteOfDay, previousDay };
}

function createOccurrence(window, windowIndex, occurrenceDay, segment, ts) {
  const date = new Date(ts);
  if (segment === 'after_midnight') date.setDate(date.getDate() - 1);
  const calendarDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const start = new Date(date);
  start.setHours(0, window.startMin, 0, 0);
  const end = new Date(date);
  if (window.startMin > window.endMin) end.setDate(end.getDate() + 1);
  end.setHours(0, window.endMin, 0, 0);
  return { window, windowIndex, occurrenceDay, segment,
    occurrenceId: `${window.id}:${calendarDay}`, startedAt: start.getTime(), endsAt: end.getTime() };
}

function resolveRecurringWindowsForDay(normalizedPlan, day) {
  return normalizedPlan.windows.filter((window) => (
    normalizeScheduleWindowDays(window.days, normalizedPlan.days).includes(day)
  ));
}

export function resolveScheduleWindowOccurrence(plan, ts = Date.now()) {
  const normalized = normalizeSchedulePlan(plan, {
    requireNonEmptyDays: true,
  });
  if (!Array.isArray(normalized.windows) || normalized.windows.length === 0) return null;

  const {
    day,
    minuteOfDay,
    previousDay,
  } = getDateParts(ts);
  const todayWindows = resolveRecurringWindowsForDay(normalized, day);
  const previousWindows = resolveRecurringWindowsForDay(normalized, previousDay);

  for (let index = 0; index < todayWindows.length; index += 1) {
    const window = todayWindows[index];
    const startMin = Number.isFinite(window?.startMin) ? window.startMin : null;
    const endMin = Number.isFinite(window?.endMin) ? window.endMin : null;
    if (startMin === null || endMin === null || startMin === endMin) continue;

    if (startMin > endMin) {
      if (minuteOfDay >= startMin) {
        return createOccurrence(window, index, day, 'start_day', ts);
      }
      continue;
    }

    if (minuteOfDay >= startMin && minuteOfDay < endMin) {
      return createOccurrence(window, index, day, 'same_day', ts);
    }
  }

  for (let index = 0; index < previousWindows.length; index += 1) {
    const window = previousWindows[index];
    const startMin = Number.isFinite(window?.startMin) ? window.startMin : null;
    const endMin = Number.isFinite(window?.endMin) ? window.endMin : null;
    if (startMin === null || endMin === null || startMin <= endMin) continue;
    if (minuteOfDay < endMin) {
      return createOccurrence(window, index, previousDay, 'after_midnight', ts);
    }
  }

  return null;
}

export function resolveActiveScheduleWindow(plan, ts = Date.now()) {
  return resolveScheduleWindowOccurrence(plan, ts)?.window ?? null;
}

export function isSchedulePlanActiveAt(plan, ts = Date.now()) {
  return !!resolveScheduleWindowOccurrence(plan, ts);
}

export function hasScheduleWindowConflict(candidate, windows) {
  const week = 7 * SCHEDULE_MINUTES_IN_DAY;
  const intervals = (window) => window.days.map((day) => ({
    start: day * SCHEDULE_MINUTES_IN_DAY + window.startMin,
    end: day * SCHEDULE_MINUTES_IN_DAY + window.startMin + getScheduleWindowDuration(window),
  }));
  return windows.some((window) => window.id !== candidate.id && intervals(candidate).some((left) => (
    intervals(window).some((right) => [-week, 0, week].some((offset) => (
      left.start < right.end + offset && right.start + offset < left.end
    )))
  )));
}

export function requireCanonicalScheduleWindows(windows) {
  const ids = new Set();
  for (const window of windows) {
    if (typeof window.id !== 'string' || !window.id || ids.has(window.id)
      || !Object.values(SCHEDULE_WINDOW_INTENTS).includes(window.intent)
      || !Array.isArray(window.days) || !window.days.length
      || window.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
      || !Number.isInteger(window.startMin) || window.startMin < 0 || window.startMin >= 1440
      || !Number.isInteger(window.endMin) || window.endMin < 0 || window.endMin > 1440
      || window.startMin % SCHEDULE_STEP_MINUTES !== 0 || window.endMin % SCHEDULE_STEP_MINUTES !== 0
      || getScheduleWindowDuration(window) < SCHEDULE_INPUT_MIN_GAP
      || (window.allDay === true && (window.startMin !== 0 || window.endMin !== 1440))) {
      throw new Error('SCHEDULE_WINDOW_CONTRACT_INVALID');
    }
    ids.add(window.id);
    if (window.notificationMode !== undefined) requireScheduleNotificationMode(window.notificationMode);
  }
  for (const window of windows) if (hasScheduleWindowConflict(window, windows)) throw new Error('SCHEDULE_WINDOWS_OVERLAP');
  return windows;
}
