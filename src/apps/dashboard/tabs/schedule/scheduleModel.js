import {
  SCHEDULE_INPUT_MIN_GAP,
  SCHEDULE_MINUTES_IN_DAY,
  SCHEDULE_PLAN_SCHEMA_VERSION,
  SCHEDULE_STEP_MINUTES,
  SCHEDULE_WINDOW_INTENTS,
  createScheduleWindowId,
  getScheduleWindowDuration,
  normalizeScheduleDays,
  normalizeScheduleStartMinute,
  normalizeScheduleWindowName,
  normalizeScheduleWindowIntent,
  requireScheduleNotificationMode,
  hasScheduleWindowConflict,
  splitScheduleWindowSegments,
  wrapScheduleMinute,
} from '../../../../domains/schedule/core/schedulePlan.js';

export const MINUTES_IN_DAY = SCHEDULE_MINUTES_IN_DAY;
export const STEP_MINUTES = SCHEDULE_STEP_MINUTES;
export const INPUT_MIN_GAP = SCHEDULE_INPUT_MIN_GAP;
export const DEFAULT_BLOCK_INTENT = SCHEDULE_WINDOW_INTENTS.RELAXATION;

export const DAY_PRESETS = {
  weekday: [1, 2, 3, 4, 5],
  weekend: [0, 6],
  all: [0, 1, 2, 3, 4, 5, 6],
};

export const SCHEDULE_SCOPE_GROUPS = Object.freeze({
  weekday: Object.freeze({ id: 'weekday', days: Object.freeze([1, 2, 3, 4, 5]) }),
  weekend: Object.freeze({ id: 'weekend', days: Object.freeze([0, 6]) }),
});

export function normalizeScheduleBlockIntent(value) {
  return normalizeScheduleWindowIntent(value);
}

export function normalizeScheduleBlockName(value) {
  return normalizeScheduleWindowName(value);
}

export function createBlockId() {
  return createScheduleWindowId();
}

export function minToTime(minutes) {
  const safe = Math.max(0, Math.min(MINUTES_IN_DAY, Math.round(minutes || 0)));
  if (safe === MINUTES_IN_DAY) return '24:00';
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function snapMinutes(minutes) {
  return Math.round(minutes / STEP_MINUTES) * STEP_MINUTES;
}

export function clampStart(minutes, minGap = INPUT_MIN_GAP) {
  return Math.max(0, Math.min(MINUTES_IN_DAY - minGap, minutes));
}

export function clampEnd(minutes) {
  return Math.max(0, Math.min(MINUTES_IN_DAY, minutes));
}

function wrapMinutes(minutes) {
  return wrapScheduleMinute(minutes);
}

function normalizeStartMinute(minutes) {
  return normalizeScheduleStartMinute(minutes);
}

function resolveEndFromStartAndDuration(startMin, duration, minGap = STEP_MINUTES) {
  const safeStart = normalizeStartMinute(startMin);
  const maxDuration = Math.max(minGap, MINUTES_IN_DAY - minGap);
  const safeDuration = Math.max(minGap, Math.min(maxDuration, Math.round(duration)));
  const rawEnd = safeStart + safeDuration;
  if (rawEnd < MINUTES_IN_DAY) return rawEnd;
  if (rawEnd === MINUTES_IN_DAY) return MINUTES_IN_DAY;
  return rawEnd - MINUTES_IN_DAY;
}

function splitRangeToSegments(startMin, endMin) {
  const safeStart = normalizeStartMinute(startMin);
  const safeEnd = clampEnd(Math.round(endMin));
  if (safeStart === safeEnd) return [];
  if (safeStart > safeEnd) {
    return [
      { start: safeStart, end: MINUTES_IN_DAY },
      { start: 0, end: safeEnd },
    ];
  }
  return [{ start: safeStart, end: safeEnd }];
}

function getClockwiseDuration(startMin, endMin) {
  const safeStart = normalizeStartMinute(startMin);
  const safeEnd = clampEnd(Math.round(endMin));
  if (safeStart === safeEnd) return 0;
  if (safeStart < safeEnd) return safeEnd - safeStart;
  return MINUTES_IN_DAY - safeStart + safeEnd;
}

export function parseTimeInput(value, allow24 = false) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '').slice(0, 4);
  if (!digits) return null;
  const padded = digits.padStart(4, '0');
  const hours = Number(padded.slice(0, 2));
  const mins = Number(padded.slice(2, 4));
  if (hours === 24 && mins === 0) return allow24 ? MINUTES_IN_DAY : null;
  if (hours < 0 || hours > 23) return null;
  if (mins < 0 || mins > 59) return null;
  return hours * 60 + mins;
}

export function toTimeDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.slice(-4).padStart(4, '0');
}

export function formatTimeDigits(digits) {
  const padded = toTimeDigits(digits);
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

export function normalizeDays(days, fallback = []) {
  return normalizeScheduleDays(days, fallback, { requireNonEmpty: Array.isArray(fallback) && fallback.length > 0 });
}

function normalizeBlockDays(days, fallback = DAY_PRESETS.all) {
  const normalized = normalizeDays(days, fallback);
  return normalized.length > 0 ? normalized : DAY_PRESETS.all.slice();
}

function haveSharedDays(leftDays, rightDays) {
  const left = new Set(normalizeBlockDays(leftDays));
  return normalizeBlockDays(rightDays).some((day) => left.has(day));
}

function subtractDays(days, removeDays) {
  const removeSet = new Set(normalizeBlockDays(removeDays));
  return normalizeBlockDays(days).filter((day) => !removeSet.has(day));
}

export function areDaySetsEqual(leftDays, rightDays) {
  const left = normalizeBlockDays(leftDays);
  const right = normalizeBlockDays(rightDays);
  if (left.length !== right.length) return false;
  return left.every((day, index) => day === right[index]);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function areSchedulesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right) return false;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => areSchedulesEqual(value, right[index]));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key, index) => (
      key === rightKeys[index] && areSchedulesEqual(left[key], right[key])
    ));
  }

  return false;
}

export function doesBlockApplyToDays(block, days) {
  return haveSharedDays(block?.days, days);
}

function sortBlocksByStart(blocks = []) {
  return [...blocks].sort((left, right) => {
    const leftStart = Number.isFinite(left?.startMin) ? left.startMin : 0;
    const rightStart = Number.isFinite(right?.startMin) ? right.startMin : 0;
    if (leftStart !== rightStart) return leftStart - rightStart;
    const leftEnd = Number.isFinite(left?.endMin) ? left.endMin : 0;
    const rightEnd = Number.isFinite(right?.endMin) ? right.endMin : 0;
    return leftEnd - rightEnd;
  });
}

function buildScheduleWithBlocks(schedule, blocks) {
  return {
    ...schedule,
    blocks,
    startMin: blocks[0]?.startMin ?? 0,
    endMin: blocks[0]?.endMin ?? MINUTES_IN_DAY,
  };
}

function selectCandidateValue(values, target, preference = 'closest') {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = values;

  if (preference === 'at_or_before') {
    const before = sorted.filter((value) => value <= target);
    return before.length ? before[before.length - 1] : sorted[0];
  }

  if (preference === 'at_or_after') {
    const after = sorted.filter((value) => value >= target);
    return after.length ? after[0] : sorted[sorted.length - 1];
  }

  const circularDistance = (left, right) => {
    const linear = Math.abs(left - right);
    return Math.min(linear, MINUTES_IN_DAY - linear);
  };

  let best = sorted[0];
  let bestDistance = circularDistance(best, target);
  for (let index = 1; index < sorted.length; index += 1) {
    const candidate = sorted[index];
    const distance = circularDistance(candidate, target);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
      continue;
    }
    if (distance === bestDistance && candidate < best) {
      best = candidate;
    }
  }
  return best;
}

function findValidStartForDuration({
  blocks,
  blockId,
  targetStart,
  duration,
  days = DAY_PRESETS.all,
  minGap = STEP_MINUTES,
  preference = 'closest',
}) {
  const maxDuration = Math.max(minGap, MINUTES_IN_DAY - minGap);
  const safeDuration = Math.max(minGap, Math.min(maxDuration, Math.round(duration)));
  const safeTarget = wrapMinutes(targetStart);
  const validStarts = [];

  for (let start = 0; start < MINUTES_IN_DAY; start += STEP_MINUTES) {
    const end = resolveEndFromStartAndDuration(start, safeDuration, minGap);
    if (!hasScheduleWindowConflict({ id: blockId, startMin: start, endMin: end, days }, blocks)) {
      validStarts.push(start);
    }
  }

  return selectCandidateValue(validStarts, safeTarget, preference);
}

function findValidStartForFixedEnd({
  blocks,
  blockId,
  targetStart,
  fixedEnd,
  days = DAY_PRESETS.all,
  minGap = STEP_MINUTES,
}) {
  const safeEnd = clampEnd(Math.round(fixedEnd));
  const maxDuration = Math.max(minGap, MINUTES_IN_DAY - minGap);
  const safeTarget = wrapMinutes(targetStart);
  const validStarts = [];

  for (let start = 0; start < MINUTES_IN_DAY; start += STEP_MINUTES) {
    const duration = getClockwiseDuration(start, safeEnd);
    if (duration < minGap || duration > maxDuration) continue;
    if (!hasScheduleWindowConflict({ id: blockId, startMin: start, endMin: safeEnd, days }, blocks)) {
      validStarts.push(start);
    }
  }

  return selectCandidateValue(validStarts, safeTarget, 'closest');
}

function findValidEndForFixedStart({
  blocks,
  blockId,
  fixedStart,
  targetEnd,
  days = DAY_PRESETS.all,
  minGap = STEP_MINUTES,
}) {
  const safeStart = normalizeStartMinute(fixedStart);
  const maxDuration = Math.max(minGap, MINUTES_IN_DAY - minGap);
  const safeTarget = wrapMinutes(targetEnd);
  const validEnds = [];

  for (let end = STEP_MINUTES; end <= MINUTES_IN_DAY; end += STEP_MINUTES) {
    const duration = getClockwiseDuration(safeStart, end);
    if (duration < minGap || duration > maxDuration) continue;
    if (!hasScheduleWindowConflict({ id: blockId, startMin: safeStart, endMin: end, days }, blocks)) {
      validEnds.push(end);
    }
  }

  return selectCandidateValue(validEnds, safeTarget, 'closest');
}

export function normalizeBlocks(blocks, fallbackStart, fallbackEnd, fallbackDays = DAY_PRESETS.all) {
  let didChange = false;
  let nextBlocks = Array.isArray(blocks) ? blocks : [];
  // Empty block list is valid until user defines a window.
  if (!Array.isArray(blocks)) {
    // If invalid/missing, default to empty list.
    didChange = true;
  }

  const normalized = nextBlocks.map((block) => {
    const normalizedIntent = normalizeScheduleBlockIntent(block?.intent);
    const normalizedDays = normalizeBlockDays(block?.days, fallbackDays);
    const isAllDay = block?.allDay === true;
    const startRaw = isAllDay ? 0 : (Number.isFinite(block?.startMin) ? block.startMin : fallbackStart);
    const endRaw = isAllDay ? MINUTES_IN_DAY : (Number.isFinite(block?.endMin) ? block.endMin : fallbackEnd);
    let startMin = isAllDay ? 0 : normalizeStartMinute(startRaw);
    let endMin = isAllDay ? MINUTES_IN_DAY : clampEnd(Math.round(endRaw));
    if (startMin !== startRaw || endMin !== endRaw) didChange = true;
    let id = typeof block?.id === 'string' && block.id ? block.id : createBlockId();
    if (id !== block?.id) didChange = true;
    if (!isAllDay && startMin === endMin) {
      endMin = resolveEndFromStartAndDuration(startMin, INPUT_MIN_GAP, INPUT_MIN_GAP);
      didChange = true;
    }
    const normalizedName = normalizeScheduleBlockName(block?.name);
    if (normalizedIntent !== block?.intent) didChange = true;
    if (!areDaySetsEqual(normalizedDays, block?.days || fallbackDays)) didChange = true;
    if (normalizedName !== (typeof block?.name === 'string' ? block.name : '')) didChange = true;
    const nextBlock = { id, startMin, endMin, intent: normalizedIntent, days: normalizedDays };
    if (normalizedName) nextBlock.name = normalizedName;
    if (isAllDay) nextBlock.allDay = true;
    if (block.notificationMode !== undefined) nextBlock.notificationMode = requireScheduleNotificationMode(block.notificationMode);
    return nextBlock;
  });

  const sorted = sortBlocksByStart(normalized);
  if (sorted.some((block, index) => block?.id !== normalized[index]?.id)) {
    didChange = true;
  }

  const nonOverlapping = [];
  sorted.forEach((block) => {
    const startMin = normalizeStartMinute(block.startMin);
    const duration = Math.max(INPUT_MIN_GAP, Math.round(getBlockDuration(block)));
    const resolvedStart = findValidStartForDuration({
      blocks: nonOverlapping,
      blockId: null,
      targetStart: startMin,
      duration,
      days: block.days,
      minGap: INPUT_MIN_GAP,
      preference: 'at_or_after',
    });

    if (resolvedStart === null) {
      didChange = true;
      return;
    }

    const resolvedEnd = resolveEndFromStartAndDuration(resolvedStart, duration, INPUT_MIN_GAP);
    if (resolvedStart !== block.startMin || resolvedEnd !== block.endMin) {
      didChange = true;
    }

    nonOverlapping.push({
      ...block,
      startMin: block.allDay === true ? 0 : resolvedStart,
      endMin: block.allDay === true ? MINUTES_IN_DAY : resolvedEnd,
    });
  });

  return { blocks: nonOverlapping, didChange };
}

export function normalizeSchedule(rawSchedule) {
  const base = rawSchedule && typeof rawSchedule === 'object' ? rawSchedule : {};
  let didChange = false;

  let baseDays = normalizeDays(base.days);
  if (baseDays.length === 0) {
    baseDays = DAY_PRESETS.all.slice();
    if (!Array.isArray(base.days) || base.days.length !== baseDays.length) didChange = true;
  }

  const fallbackStart = Number.isFinite(base.startMin) ? base.startMin : 0;
  const fallbackEnd = Number.isFinite(base.endMin) ? base.endMin : MINUTES_IN_DAY;
  const fallbackDays = normalizeBlockDays(baseDays, DAY_PRESETS.all);
  const blockResult = normalizeBlocks(base.blocks, fallbackStart, fallbackEnd, fallbackDays);
  if (blockResult.didChange) didChange = true;

  const blocks = blockResult.blocks;
  const startMin = blocks[0]?.startMin ?? 0;
  const endMin = blocks[0]?.endMin ?? MINUTES_IN_DAY;
  const days = blocks.length > 0
    ? Array.from(new Set(blocks.flatMap((block) => normalizeBlockDays(block.days)))).sort((a, b) => a - b)
    : fallbackDays;
  if (Number(base.schemaVersion) !== SCHEDULE_PLAN_SCHEMA_VERSION) didChange = true;

  if (base.startMin !== startMin || base.endMin !== endMin) didChange = true;
  if (!areDaySetsEqual(days, base.days || fallbackDays)) didChange = true;

  return {
    schedule: {
      schemaVersion: SCHEDULE_PLAN_SCHEMA_VERSION,
      days,
      blocks,
      startMin,
      endMin,
    },
    didChange,
  };
}

export function getBlockDuration(block) {
  return getScheduleWindowDuration(block);
}

export function getBlockSegments(block) {
  return splitScheduleWindowSegments(block);
}

// Text editing is an exact, atomic range change. Pointer editing uses the
// constrained/magnetic helpers below; a typed range must never move silently.
export function parseScheduleEditorTime(value, allow24 = false) {
  const text = String(value).trim();
  let hours;
  let minutes;
  const clock = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (clock) {
    hours = Number(clock[1]);
    minutes = Number(clock[2]);
  } else if (/^\d{1,4}$/.test(text)) {
    hours = text.length <= 2 ? Number(text) : Number(text.slice(0, -2));
    minutes = text.length <= 2 ? 0 : Number(text.slice(-2));
  } else return null;
  if (hours === 24 && minutes === 0) return allow24 ? MINUTES_IN_DAY : null;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function editScheduleBlock(schedule, blockId, { startMin, endMin, name, allDay = false, intent, notificationMode }) {
  const index = schedule.blocks.findIndex((block) => block.id === blockId);
  if (index < 0) throw new Error('SCHEDULE_EDITOR_BLOCK_MISSING');
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin)
    || startMin < 0 || startMin >= MINUTES_IN_DAY || endMin < 0 || endMin > MINUTES_IN_DAY) {
    return { error: 'invalid_time' };
  }
  if (startMin % STEP_MINUTES !== 0 || endMin % STEP_MINUTES !== 0) return { error: 'time_step' };
  const duration = getClockwiseDuration(startMin, endMin);
  const isAllDay = allDay || (startMin === 0 && endMin === MINUTES_IN_DAY);
  if (duration < INPUT_MIN_GAP || (!isAllDay && duration > MINUTES_IN_DAY - INPUT_MIN_GAP)) {
    return { error: 'minimum_duration' };
  }
  if (isAllDay && (startMin !== 0 || endMin !== MINUTES_IN_DAY)) return { error: 'invalid_time' };
  const block = schedule.blocks[index];
  if (hasScheduleWindowConflict({ ...block, startMin, endMin }, schedule.blocks)) return { error: 'overlap' };
  const edited = { ...block, startMin, endMin };
  if (intent !== undefined) edited.intent = normalizeScheduleBlockIntent(intent);
  if (notificationMode !== undefined) edited.notificationMode = requireScheduleNotificationMode(notificationMode);
  if (isAllDay) edited.allDay = true;
  else delete edited.allDay;
  const normalizedName = normalizeScheduleBlockName(name);
  if (normalizedName) edited.name = normalizedName;
  else delete edited.name;
  const blocks = schedule.blocks.map((candidate, candidateIndex) => candidateIndex === index ? edited : candidate);
  return { schedule: buildScheduleWithBlocks(schedule, sortBlocksByStart(blocks)), block: edited, error: null };
}

export function updateBlockTime(schedule, blockId, isStart, minutes, options = {}) {
  const { snap = true, minGap = STEP_MINUTES } = options;
  if (!schedule || !Array.isArray(schedule.blocks)) return schedule;
  const idx = schedule.blocks.findIndex((block) => block.id === blockId);
  if (idx === -1) return schedule;

  const blocks = schedule.blocks.map((block) => ({ ...block }));
  const block = { ...blocks[idx] };
  const blockDays = normalizeBlockDays(block.days, schedule.days || DAY_PRESETS.all);
  const safeMinGap = Math.max(INPUT_MIN_GAP, Math.round(minGap) || INPUT_MIN_GAP);
  const baseMinutes = Number.isFinite(minutes) ? minutes : (isStart ? block.startMin : block.endMin);
  const nextMinutes = snap ? snapMinutes(baseMinutes) : Math.round(baseMinutes);
  if (block.allDay === true) delete block.allDay;

  if (isStart) {
    const fixedEnd = clampEnd(Math.round(block.endMin));
    const targetStart = wrapMinutes(nextMinutes);
    const resolvedStart = findValidStartForFixedEnd({
      blocks,
      blockId,
      targetStart,
      fixedEnd,
      days: blockDays,
      minGap: safeMinGap,
    });
    if (resolvedStart === null) return schedule;
    block.startMin = resolvedStart;
    block.endMin = fixedEnd;
  } else {
    const fixedStart = normalizeStartMinute(block.startMin);
    const targetEnd = clampEnd(nextMinutes);
    const resolvedEnd = findValidEndForFixedStart({
      blocks,
      blockId,
      fixedStart,
      targetEnd,
      days: blockDays,
      minGap: safeMinGap,
    });
    if (resolvedEnd === null) return schedule;
    block.startMin = fixedStart;
    block.endMin = resolvedEnd;
  }

  blocks[idx] = block;
  return buildScheduleWithBlocks(schedule, blocks);
}

export function updateBlockDetails(schedule, blockId, patch = {}) {
  if (!schedule || !Array.isArray(schedule.blocks)) return schedule;
  const idx = schedule.blocks.findIndex((block) => block.id === blockId);
  if (idx === -1) return schedule;

  const blocks = schedule.blocks.map((block) => ({ ...block }));
  const block = { ...blocks[idx] };
  const fallbackDays = schedule.days || DAY_PRESETS.all;
  let didChange = false;

  if (Object.prototype.hasOwnProperty.call(patch, 'intent')) {
    const nextIntent = normalizeScheduleBlockIntent(patch.intent);
    if (block.intent !== nextIntent) {
      block.intent = nextIntent;
      didChange = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
    const nextName = normalizeScheduleBlockName(patch.name);
    if (nextName) {
      if (block.name !== nextName) {
        block.name = nextName;
        didChange = true;
      }
    } else if (Object.prototype.hasOwnProperty.call(block, 'name')) {
      delete block.name;
      didChange = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'days')) {
    const nextDays = normalizeBlockDays(patch.days, block.days || fallbackDays);
    if (!areDaySetsEqual(block.days, nextDays)) {
      block.days = nextDays;
      didChange = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'allDay')) {
    const nextAllDay = patch.allDay === true;
    if (nextAllDay) {
      if (block.startMin !== 0 || block.endMin !== MINUTES_IN_DAY || block.allDay !== true) {
        block.startMin = 0;
        block.endMin = MINUTES_IN_DAY;
        block.allDay = true;
        didChange = true;
      }
    } else if (block.allDay === true) {
      block.startMin = 20 * 60;
      block.endMin = 21 * 60;
      delete block.allDay;
      didChange = true;
    }
  }

  if (!didChange) return schedule;
  blocks[idx] = block;
  let nextBlocks = blocks;
  if (block.allDay === true) {
    const targetDays = normalizeBlockDays(block.days, fallbackDays);
    nextBlocks = blocks.flatMap((candidate, candidateIndex) => {
      if (candidateIndex === idx) return [block];
      if (!haveSharedDays(candidate.days, targetDays)) return [candidate];
      const remainingDays = subtractDays(candidate.days, targetDays);
      if (remainingDays.length === 0) return [];
      return [{ ...candidate, days: remainingDays }];
    });
  }
  return buildScheduleWithBlocks(schedule, nextBlocks);
}

export function moveBlockTime(schedule, blockId, startMinutes, options = {}) {
  const { snap = true, minGap = STEP_MINUTES, preference = 'closest' } = options;
  if (!schedule || !Array.isArray(schedule.blocks)) return schedule;
  const idx = schedule.blocks.findIndex((block) => block.id === blockId);
  if (idx === -1) return schedule;

  const blocks = schedule.blocks.map((block) => ({ ...block }));
  const block = { ...blocks[idx] };
  const blockDays = normalizeBlockDays(block.days, schedule.days || DAY_PRESETS.all);
  const safeMinGap = Math.max(INPUT_MIN_GAP, Math.round(minGap) || INPUT_MIN_GAP);
  const duration = Math.max(safeMinGap, Math.round(getBlockDuration(block)));
  const baseStart = Number.isFinite(startMinutes) ? startMinutes : block.startMin;
  const targetStartRaw = snap ? snapMinutes(baseStart) : Math.round(baseStart);
  const targetStart = wrapMinutes(targetStartRaw);
  const resolvedStart = findValidStartForDuration({
    blocks,
    blockId,
    targetStart,
    duration,
    days: blockDays,
    minGap: safeMinGap,
    preference,
  });

  if (resolvedStart === null) return schedule;

  blocks[idx] = {
    ...block,
    startMin: resolvedStart,
    endMin: resolveEndFromStartAndDuration(resolvedStart, duration, safeMinGap),
  };

  return buildScheduleWithBlocks(schedule, blocks);
}

export function addScheduleBlockAtTime(schedule, minutes, options = {}) {
  const {
    duration = 60,
    minGap = INPUT_MIN_GAP,
    preference = 'closest',
    intent = DEFAULT_BLOCK_INTENT,
    name = '',
    days = schedule?.days || DAY_PRESETS.weekday,
    allDay = false,
  } = options;
  const blocks = Array.isArray(schedule?.blocks) ? schedule.blocks.map((block) => ({ ...block })) : [];
  const safeMinGap = Math.max(INPUT_MIN_GAP, Math.round(minGap) || INPUT_MIN_GAP);
  const normalizedIntent = normalizeScheduleBlockIntent(intent);
  const normalizedName = normalizeScheduleBlockName(name);
  const normalizedDays = normalizeBlockDays(days, schedule?.days || DAY_PRESETS.all);

  if (allDay === true) {
    const prunedBlocks = blocks.flatMap((block) => {
      if (!haveSharedDays(block.days, normalizedDays)) return [block];
      const remainingDays = subtractDays(block.days, normalizedDays);
      if (remainingDays.length === 0) return [];
      return [{ ...block, days: remainingDays }];
    });
    const newBlock = {
      id: createBlockId(),
      startMin: 0,
      endMin: MINUTES_IN_DAY,
      intent: normalizedIntent,
      days: normalizedDays,
      allDay: true,
      notificationMode: 'none',
    };
    if (normalizedName) newBlock.name = normalizedName;
    const nextBlocks = sortBlocksByStart([...prunedBlocks, newBlock]);
    return {
      schedule: buildScheduleWithBlocks(schedule, nextBlocks),
      blockId: newBlock.id,
      added: true,
    };
  }

  const baseDuration = Number.isFinite(duration) ? Math.round(duration) : 60;
  const snappedDuration = Math.max(safeMinGap, snapMinutes(baseDuration));
  const rawStart = Number.isFinite(minutes) ? minutes : 0;
  const targetStartRaw = snapMinutes(rawStart);

  let resolved = null;
  for (let candidateDuration = snappedDuration; candidateDuration >= safeMinGap; candidateDuration -= STEP_MINUTES) {
    const maxStart = Math.max(0, MINUTES_IN_DAY - candidateDuration);
    const targetStart = Math.max(0, Math.min(maxStart, targetStartRaw));
    const resolvedStart = findValidStartForDuration({
      blocks,
      blockId: null,
      targetStart,
      duration: candidateDuration,
      days: normalizedDays,
      minGap: safeMinGap,
      preference,
    });
    if (resolvedStart === null) continue;
    resolved = { startMin: resolvedStart, endMin: resolveEndFromStartAndDuration(resolvedStart, candidateDuration, safeMinGap) };
    break;
  }

  if (!resolved) {
    return {
      schedule: buildScheduleWithBlocks(schedule, blocks),
      blockId: null,
      added: false,
    };
  }

  const newBlock = {
    id: createBlockId(),
    startMin: resolved.startMin,
    endMin: clampEnd(resolved.endMin),
    intent: normalizedIntent,
    days: normalizedDays,
    notificationMode: 'none',
  };
  if (normalizedName) newBlock.name = normalizedName;
  const nextBlocks = sortBlocksByStart([...blocks, newBlock]);

  return {
    schedule: buildScheduleWithBlocks(schedule, nextBlocks),
    blockId: newBlock.id,
    added: true,
  };
}

export function addScheduleBlock(schedule, options = {}) {
  const blocks = Array.isArray(schedule?.blocks) ? schedule.blocks : [];
  const sorted = sortBlocksByStart(blocks);
  let startMin = 9 * 60;
  if (sorted.length > 0) {
    const base = sorted[sorted.length - 1];
    const candidate = clampEnd(snapMinutes(base.endMin));
    startMin = candidate >= MINUTES_IN_DAY ? 0 : candidate;
  }
  return addScheduleBlockAtTime(schedule, startMin, {
    duration: 60,
    minGap: INPUT_MIN_GAP,
    preference: 'at_or_after',
    intent: normalizeScheduleBlockIntent(options.intent),
    days: normalizeBlockDays(options.days, DAY_PRESETS.weekday),
    allDay: options.allDay === true,
  });
}

export function removeScheduleBlock(schedule, blockId) {
  const blocks = Array.isArray(schedule?.blocks) ? schedule.blocks : [];
  const nextBlocks = blocks.filter((block) => block.id !== blockId).map((block) => ({ ...block }));
  return {
    ...schedule,
    blocks: nextBlocks,
    startMin: nextBlocks[0]?.startMin ?? 0,
    endMin: nextBlocks[0]?.endMin ?? MINUTES_IN_DAY,
  };
}
