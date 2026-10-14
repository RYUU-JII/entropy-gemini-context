import { isHostnameInSiteList } from '../../../lib/siteIdentity.js';
import { resolveScheduleRuntimePolicy } from '../../schedule/core/scheduleRuntimePolicy.js';
import {
  SCHEDULE_DAYS,
  SCHEDULE_MINUTES_IN_DAY,
  SCHEDULE_PLAN_SCHEMA_VERSION,
  isMinuteInScheduleWindow,
  normalizeScheduleDays,
  normalizeScheduleWindows,
  resolveActiveScheduleWindow,
  requireCanonicalScheduleWindows,
} from '../../schedule/core/schedulePlan.js';
import {
  SPECIAL_SESSION_MODES,
  normalizeSpecialSessionState,
} from './specialSession.js';

export const FILTERING_MODES = Object.freeze({
  BLOCKLIST: 'blocklist',
  ALLOWLIST: 'allowlist',
});

export const STANDARD_FRICTION_PHASES = Object.freeze({
  CLEAN: 'clean',
  MUD: 'mud',
  WALL: 'wall',
});

const STANDARD_FRICTION_PROFILE_BY_LEVEL = Object.freeze({
  1: Object.freeze({
    cleanMinutes: 15,
    wallMinutes: 30,
    mudBaseStepDelta: 0,
    mudStepRamp: 1,
    wallStepDelta: 1,
    globalCapMinutes: 0,
    minInputDelayMs: 120,
  }),
  2: Object.freeze({
    cleanMinutes: 12,
    wallMinutes: 25,
    mudBaseStepDelta: 1,
    mudStepRamp: 1,
    wallStepDelta: 2,
    globalCapMinutes: 0,
    minInputDelayMs: 180,
  }),
  3: Object.freeze({
    cleanMinutes: 10,
    wallMinutes: 20,
    mudBaseStepDelta: 1,
    mudStepRamp: 1,
    wallStepDelta: 2,
    globalCapMinutes: 0,
    minInputDelayMs: 220,
  }),
  4: Object.freeze({
    cleanMinutes: 8,
    wallMinutes: 16,
    mudBaseStepDelta: 2,
    mudStepRamp: 0,
    wallStepDelta: 2,
    globalCapMinutes: 0,
    minInputDelayMs: 260,
  }),
  5: Object.freeze({
    cleanMinutes: 5,
    wallMinutes: 12,
    mudBaseStepDelta: 2,
    mudStepRamp: 0,
    wallStepDelta: 2,
    globalCapMinutes: 30,
    minInputDelayMs: 300,
  }),
});

export function getStandardFrictionProfile(userLevel = 3) {
  const level = normalizeFrictionLevel(userLevel, 3);
  return STANDARD_FRICTION_PROFILE_BY_LEVEL[level] || STANDARD_FRICTION_PROFILE_BY_LEVEL[3];
}

export const DEFAULT_RELAXATION_SCHEDULE = Object.freeze({
  schemaVersion: SCHEDULE_PLAN_SCHEMA_VERSION,
  days: [...SCHEDULE_DAYS],
  blocks: [],
  startMin: 0,
  endMin: SCHEDULE_MINUTES_IN_DAY,
});

function clampMinutes(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1440, Math.round(numeric)));
}

function normalizeFrictionLevel(value, fallback = 3) {
  const fallbackLevel = Math.max(1, Math.min(5, Math.floor(Number(fallback) || 3)));
  const level = Math.floor(Number(value));
  if (!Number.isFinite(level)) return fallbackLevel;
  return Math.max(1, Math.min(5, level));
}

function clampMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

function normalizeDays(days, fallback) {
  return normalizeScheduleDays(days, fallback, { requireNonEmpty: true });
}

function normalizeBlocks(blocks, startMin, endMin, fallbackBlocks, fallbackDays = SCHEDULE_DAYS) {
  return normalizeScheduleWindows(blocks, {
    fallbackStart: startMin,
    fallbackEnd: endMin,
    fallbackDays,
    fallbackWindows: Array.isArray(fallbackBlocks) ? fallbackBlocks : [],
  });
}

export function normalizeFilteringMode(value, fallback = FILTERING_MODES.BLOCKLIST) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === FILTERING_MODES.BLOCKLIST || raw === FILTERING_MODES.ALLOWLIST) return raw;
  return fallback;
}

export function resolveStandardFriction({
  userLevel = 3,
  activeTimeMs = 0,
  blockedTodayMs = 0,
} = {}) {
  const level = normalizeFrictionLevel(userLevel, 3);
  const profile = getStandardFrictionProfile(level);
  const activeMs = clampMs(activeTimeMs);
  const blockedMs = clampMs(blockedTodayMs);
  const cleanMs = profile.cleanMinutes * 60_000;
  const wallMs = Math.max((profile.cleanMinutes + 1) * 60_000, profile.wallMinutes * 60_000);
  const capLimitMs = Math.max(0, Math.floor(Number(profile.globalCapMinutes) || 0) * 60_000);
  const capExceeded = capLimitMs > 0 && blockedMs >= capLimitMs;

  let phase = STANDARD_FRICTION_PHASES.CLEAN;
  let shouldApply = false;
  let stepDelta = 0;
  let reason = 'standard_clean_phase';
  let minInputDelayMs = 0;

  if (capExceeded) {
    phase = STANDARD_FRICTION_PHASES.WALL;
    shouldApply = true;
    stepDelta = 3;
    reason = 'global_cap_exceeded';
    minInputDelayMs = profile.minInputDelayMs;
  } else if (activeMs >= wallMs) {
    phase = STANDARD_FRICTION_PHASES.WALL;
    shouldApply = true;
    stepDelta = Math.max(0, Math.min(3, Math.floor(Number(profile.wallStepDelta) || 0)));
    reason = 'standard_wall_phase';
    minInputDelayMs = profile.minInputDelayMs;
  } else if (activeMs >= cleanMs) {
    phase = STANDARD_FRICTION_PHASES.MUD;
    shouldApply = true;
    const minutesIntoMud = Math.max(0, Math.floor((activeMs - cleanMs) / 60_000));
    const ramp = Math.max(0, Math.min(3, Math.floor(Number(profile.mudStepRamp) || 0)));
    stepDelta = Math.max(
      0,
      Math.min(
        3,
        Math.floor(Number(profile.mudBaseStepDelta) || 0) + Math.min(ramp, minutesIntoMud)
      )
    );
    reason = 'standard_mud_phase';
    minInputDelayMs = profile.minInputDelayMs;
  }

  return {
    level,
    phase,
    shouldApply,
    stepDelta,
    reason,
    capLimitMs,
    capExceeded,
    forceStepKeys: [],
    minInputDelayMs,
  };
}

export function normalizeRelaxationSchedule(rawSchedule, fallback = DEFAULT_RELAXATION_SCHEDULE) {
  if (!rawSchedule || typeof rawSchedule !== 'object' || Array.isArray(rawSchedule)) {
    throw new Error('RELAXATION_SCHEDULE_CONTRACT_INVALID');
  }
  if (rawSchedule.schemaVersion !== SCHEDULE_PLAN_SCHEMA_VERSION) {
    throw new Error('RELAXATION_SCHEDULE_VERSION_UNSUPPORTED');
  }
  if (!Array.isArray(rawSchedule.days) || !Array.isArray(rawSchedule.blocks)) {
    throw new Error('RELAXATION_SCHEDULE_CONTRACT_INVALID');
  }
  const source = rawSchedule;
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : DEFAULT_RELAXATION_SCHEDULE;

  const startMin = clampMinutes(source.startMin, clampMinutes(fallbackSource.startMin, 0));
  const endMin = clampMinutes(source.endMin, clampMinutes(fallbackSource.endMin, 1440));
  const days = normalizeDays(source.days, fallbackSource.days);
  const blocks = normalizeBlocks(source.blocks, startMin, endMin, fallbackSource.blocks, days);
  requireCanonicalScheduleWindows(blocks);

  return {
    schemaVersion: SCHEDULE_PLAN_SCHEMA_VERSION,
    days,
    blocks,
    startMin: blocks[0]?.startMin ?? startMin,
    endMin: blocks[0]?.endMin ?? endMin,
  };
}

export function isMinuteInScheduleBlock(minuteOfDay, block) {
  return isMinuteInScheduleWindow(minuteOfDay, block);
}

export function getActiveScheduleBlock(schedule, ts = Date.now()) {
  if (!schedule || typeof schedule !== 'object') return null;
  const normalized = normalizeRelaxationSchedule(schedule, DEFAULT_RELAXATION_SCHEDULE);
  return resolveActiveScheduleWindow({
    schemaVersion: normalized.schemaVersion,
    days: normalized.days,
    windows: normalized.blocks,
    startMin: normalized.startMin,
    endMin: normalized.endMin,
  }, ts);
}

export function resolveFilteringModeBySchedule({
  filteringMode = FILTERING_MODES.BLOCKLIST,
  schedule = null,
  ts = Date.now(),
} = {}) {
  const fallbackMode = normalizeFilteringMode(filteringMode, FILTERING_MODES.BLOCKLIST);
  return resolveScheduleRuntimePolicy({ schedule, now: ts }).mode === 'isolation'
    ? FILTERING_MODES.ALLOWLIST : fallbackMode;
}

export function resolveFilteringModeBySpecialSession({
  filteringMode = FILTERING_MODES.BLOCKLIST,
  specialSession = null,
  ts = Date.now(),
} = {}) {
  const fallbackMode = normalizeFilteringMode(filteringMode, FILTERING_MODES.BLOCKLIST);
  const session = normalizeSpecialSessionState(specialSession, { now: ts });
  if (!session.active) return fallbackMode;
  return FILTERING_MODES.ALLOWLIST;
}

export function resolveFilteringModeByRuntimePolicy({
  filteringMode = FILTERING_MODES.BLOCKLIST,
  schedule = null,
  ts = Date.now(),
  specialSession = null,
  skippedOccurrenceId = null,
} = {}) {
  const state = resolveScheduleRuntimePolicy({ schedule, specialSession, skippedOccurrenceId, now: ts });
  return state.mode === 'isolation' ? FILTERING_MODES.ALLOWLIST : normalizeFilteringMode(filteringMode);
}

export function isWithinRelaxationScheduleWindow(schedule, ts = Date.now()) {
  if (!schedule || typeof schedule !== 'object') return false;
  return getActiveScheduleBlock(schedule, ts)?.intent === 'relaxation';
}

export function isRelaxationScheduleActive(schedule, ts = Date.now()) {
  return isWithinRelaxationScheduleWindow(schedule, ts);
}

export function resolveDomainBlockState({
  hostname,
  blockedUrls = [],
  allowedUrls = [],
  temporaryAllowedUrls = [],
  filteringMode = FILTERING_MODES.BLOCKLIST,
  blockedByHash = null,
  allowedByHash = null,
} = {}) {
  const mode = normalizeFilteringMode(filteringMode);
  const blockedList = Array.isArray(blockedUrls) ? blockedUrls : [];
  const allowedList = Array.isArray(allowedUrls) ? allowedUrls : [];
  const temporaryAllowedList = Array.isArray(temporaryAllowedUrls) ? temporaryAllowedUrls : [];

  const isBlockedListed = blockedByHash === null
    ? isHostnameInSiteList(hostname, blockedList)
    : !!blockedByHash;
  const isTemporaryAllowedListed = isHostnameInSiteList(hostname, temporaryAllowedList);
  const isAllowedListed = isTemporaryAllowedListed || (
    allowedByHash === null
      ? isHostnameInSiteList(hostname, allowedList)
      : !!allowedByHash
  );

  const isBlockedDomain = mode === FILTERING_MODES.ALLOWLIST
    ? !isAllowedListed
    : isBlockedListed;

  return {
    filteringMode: mode,
    isBlockedDomain,
    isBlockedListed,
    isAllowedListed,
  };
}
