import {
  DEFAULT_VISIBLE_DOMAIN_COUNT,
  isVisibleProtectedDomainCandidate,
  resolveStatusDomainCandidateDisposition,
  resolveVisibleDomainCandidateUsageMs,
  selectVisibleDomainCandidates,
} from '../../analysis/index.js';
import { toNumber } from './statsAnalysisQueryShared.js';

const MINUTE_MS = 60_000;
const STATUS_HABIT_FEEDBACK_SCHEMA_VERSION = 1;
const STATUS_HABIT_DOMAIN_CUE_LIMIT = 4;
const STATUS_HABIT_DOMAIN_MIN_PRESSURE_MS = 20 * MINUTE_MS;
const STATUS_HABIT_DOMAIN_STRONG_PRESSURE_MS = 60 * MINUTE_MS;
const STATUS_HABIT_AGGREGATE_MIN_PRESSURE_MS = 30 * MINUTE_MS;
const STATUS_HABIT_AGGREGATE_MIN_DOMAIN_COUNT = 2;
const STATUS_HABIT_AGGREGATE_MULTI_DOMAIN_MIN_PRESSURE_MS = 20 * MINUTE_MS;
const STATUS_HABIT_AGGREGATE_STRONG_PRESSURE_MS = 90 * MINUTE_MS;
export const PRESSURE_RAIL_READINESS_STATES = Object.freeze({
  COLLECTING: 'collecting',
  READY: 'ready',
  ERROR: 'error',
});
export const PRESSURE_RAIL_CONTENT_STATES = Object.freeze({
  PENDING: 'pending',
  PRESSURE: 'pressure',
  NO_PRESSURE: 'no_pressure',
  UNAVAILABLE: 'unavailable',
});

function normalizeStatusDomain(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : '';
}

function clampUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function roundStatusNumber(value, digits = 4) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
}

export function buildEmptyStatusHabitFeedback(now = Date.now()) {
  return {
    schemaVersion: STATUS_HABIT_FEEDBACK_SCHEMA_VERSION,
    source: 'status_snapshot_rolling_pressure',
    computedAtEpochMs: now,
    primaryCueId: null,
    aggregateCue: null,
    domainCues: [],
    cues: [],
  };
}

function normalizeStatusHabitCandidate(candidate = null) {
  const domain = normalizeStatusDomain(candidate?.domain);
  if (!domain) return null;
  const pressureMs = Math.max(0, resolveVisibleDomainCandidateUsageMs(candidate));
  if (pressureMs <= 0) return null;
  const activeDays = Math.max(0, Math.floor(toNumber(candidate?.activeDays)));
  const todayActiveMs = Math.max(0, toNumber(candidate?.todayActiveMs));
  const rawWindowMs = Math.max(0, toNumber(candidate?.rawWindowMs));
  const protectedDomain = isVisibleProtectedDomainCandidate(candidate);
  return {
    domain,
    pressureMs,
    rawWindowMs,
    todayActiveMs,
    activeDays,
    pressureShare: clampUnit(candidate?.pressureShare),
    pressureRank: Math.max(0, Math.floor(toNumber(candidate?.pressureRank))),
    visibleRank: Math.max(0, Math.floor(toNumber(candidate?.visibleRank))),
    protected: protectedDomain,
    managed: candidate?.managed === true || candidate?.blocked === true || protectedDomain,
    policyStatus: candidate?.policyStatus || null,
  };
}

function buildStatusHabitDomainCue(candidate, index) {
  const strong = candidate.pressureMs >= STATUS_HABIT_DOMAIN_STRONG_PRESSURE_MS
    || candidate.activeDays >= 3;
  return {
    id: `domain:${candidate.domain}`,
    scope: 'domain',
    kind: 'selected_domain_pressure',
    domain: candidate.domain,
    tone: strong ? 'strong' : 'watch',
    priority: roundStatusNumber(
      50
      + Math.min(candidate.pressureMs / MINUTE_MS, 90)
      + (candidate.protected ? 12 : 0)
      + Math.min(candidate.activeDays, 7) * 2
      + Math.max(0, 6 - index),
      3,
    ),
    labelKey: 'main.habit_cue_selected_domain_label',
    metricKey: 'main.habit_cue_selected_domain_metric',
    metricParams: {
      durationMs: candidate.pressureMs,
      activeDays: candidate.activeDays,
    },
    evidence: {
      pressureMs: candidate.pressureMs,
      rawWindowMs: candidate.rawWindowMs,
      todayActiveMs: candidate.todayActiveMs,
      activeDays: candidate.activeDays,
      pressureShare: candidate.pressureShare,
      pressureRank: candidate.pressureRank,
      visibleRank: candidate.visibleRank,
      protected: candidate.protected,
      managed: candidate.managed,
      policyStatus: candidate.policyStatus,
    },
  };
}

function buildStatusHabitAggregateCue(protectedCandidates = [], rollingPressure = null) {
  const candidateCount = protectedCandidates.length;
  const pressureMs = protectedCandidates.reduce((sum, candidate) => sum + candidate.pressureMs, 0);
  const hasEnoughAggregatePressure = pressureMs >= STATUS_HABIT_AGGREGATE_MIN_PRESSURE_MS
    || (
      candidateCount >= STATUS_HABIT_AGGREGATE_MIN_DOMAIN_COUNT
      && pressureMs >= STATUS_HABIT_AGGREGATE_MULTI_DOMAIN_MIN_PRESSURE_MS
    );
  if (!hasEnoughAggregatePressure) {
    return null;
  }
  const activeDays = protectedCandidates.reduce((max, candidate) => Math.max(max, candidate.activeDays), 0);
  const strong = pressureMs >= STATUS_HABIT_AGGREGATE_STRONG_PRESSURE_MS
    || candidateCount >= 3
    || activeDays >= 4;
  return {
    id: 'protected_set:rolling_pressure',
    scope: 'protected_set',
    kind: 'protected_pressure',
    tone: strong ? 'strong' : 'watch',
    priority: roundStatusNumber(
      100
      + Math.min(pressureMs / MINUTE_MS, 120)
      + candidateCount * 5
      + Math.min(activeDays, 7) * 2,
      3,
    ),
    labelKey: 'main.habit_cue_protected_pressure_label',
    metricKey: 'main.habit_cue_protected_pressure_metric',
    metricParams: {
      count: candidateCount,
      durationMs: pressureMs,
    },
    evidence: {
      pressureMs,
      candidateCount,
      activeDays,
      windowDays: Math.max(0, Math.floor(toNumber(rollingPressure?.windowDays))),
      basis: rollingPressure?.basis || null,
      temporal: rollingPressure?.temporal || null,
      domains: protectedCandidates.slice(0, STATUS_HABIT_DOMAIN_CUE_LIMIT).map((candidate) => ({
        domain: candidate.domain,
        pressureMs: candidate.pressureMs,
        activeDays: candidate.activeDays,
        pressureShare: candidate.pressureShare,
        pressureRank: candidate.pressureRank,
      })),
    },
  };
}

export function buildStatusHabitFeedback({
  visibleDomainCandidates = [],
  rollingPressure = null,
  now = Date.now(),
} = {}) {
  const empty = buildEmptyStatusHabitFeedback(now);
  const candidates = (Array.isArray(visibleDomainCandidates) ? visibleDomainCandidates : [])
    .map(normalizeStatusHabitCandidate)
    .filter(Boolean);
  if (candidates.length <= 0) return empty;

  const protectedCandidates = candidates.filter((candidate) => candidate.protected);
  const aggregateCue = buildStatusHabitAggregateCue(protectedCandidates, rollingPressure);
  const domainCues = candidates
    .filter((candidate) => candidate.managed && candidate.pressureMs >= STATUS_HABIT_DOMAIN_MIN_PRESSURE_MS)
    .sort((left, right) => {
      const pressureDiff = right.pressureMs - left.pressureMs;
      if (pressureDiff !== 0) return pressureDiff;
      const protectedDiff = Number(right.protected) - Number(left.protected);
      if (protectedDiff !== 0) return protectedDiff;
      return left.domain.localeCompare(right.domain);
    })
    .slice(0, STATUS_HABIT_DOMAIN_CUE_LIMIT)
    .map(buildStatusHabitDomainCue);
  const cues = [
    aggregateCue,
    ...domainCues,
  ]
    .filter(Boolean)
    .sort((left, right) => {
      const priorityDiff = toNumber(right?.priority) - toNumber(left?.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return String(left?.id || '').localeCompare(String(right?.id || ''));
    });

  return {
    ...empty,
    primaryCueId: cues[0]?.id || null,
    aggregateCue,
    domainCues,
    cues,
  };
}

export function buildVisibleDomainSelection({
  domainCandidates = [],
  rollingPressure = null,
  maxCount = DEFAULT_VISIBLE_DOMAIN_COUNT,
} = {}) {
  const pressureDomainSet = new Set(
    (Array.isArray(rollingPressure?.domains) ? rollingPressure.domains : [])
      .map((entry) => (typeof entry?.domain === 'string' ? entry.domain.trim().toLowerCase() : ''))
      .filter(Boolean),
  );
  const pressureCandidates = (Array.isArray(domainCandidates) ? domainCandidates : [])
    .filter((candidate) => {
      const domain = typeof candidate?.domain === 'string' ? candidate.domain.trim().toLowerCase() : '';
      if (!domain || !pressureDomainSet.has(domain)) return false;
      return toNumber(candidate?.weightedPressureMs) > 0 || toNumber(candidate?.rawWindowMs) > 0;
    });
  const visibleDomainCandidates = selectVisibleDomainCandidates(pressureCandidates, { maxCount })
    .map((candidate) => ({
      ...candidate,
      policyDisposition: resolveStatusDomainCandidateDisposition(candidate),
    }));
  const pressureRailReadiness = buildPressureRailReadiness({
    rollingPressure,
    visibleDomainCandidates,
  });

  return {
    schemaVersion: 1,
    source: 'rolling_pressure',
    basis: rollingPressure?.basis || null,
    temporal: rollingPressure?.temporal || null,
    maxCount,
    candidateCount: pressureCandidates.length,
    visibleCount: visibleDomainCandidates.length,
    pressureRailReadiness,
    candidates: visibleDomainCandidates,
  };
}

export function buildPressureRailReadiness({
  rollingPressure = null,
  visibleDomainCandidates = [],
} = {}) {
  if (rollingPressure === null || rollingPressure === undefined) {
    return {
      state: PRESSURE_RAIL_READINESS_STATES.COLLECTING,
      contentState: PRESSURE_RAIL_CONTENT_STATES.PENDING,
      reason: 'rolling_pressure_pending',
      observedDayCount: 0,
      positiveDayCount: 0,
      targetDayCount: 3,
      stableDayCount: 7,
      candidateCount: 0,
    };
  }
  const evidence = rollingPressure?.evidence;
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('PRESSURE_RAIL_READINESS_EVIDENCE_MISSING');
  }
  const countFields = [
    'formingTargetDays',
    'completedTargetDays',
    'completedObservedDays',
    'completedPositiveDays',
  ];
  if (countFields.some((field) => !Number.isInteger(evidence[field]) || evidence[field] < 0)) {
    throw new Error('PRESSURE_RAIL_READINESS_EVIDENCE_COUNT_INVALID');
  }
  if (evidence.formingTargetDays < 1 || evidence.completedTargetDays < evidence.formingTargetDays) {
    throw new Error('PRESSURE_RAIL_READINESS_EVIDENCE_TARGET_INVALID');
  }
  if (
    evidence.completedObservedDays > evidence.completedTargetDays
    || evidence.completedPositiveDays > evidence.completedObservedDays
  ) {
    throw new Error('PRESSURE_RAIL_READINESS_EVIDENCE_RELATION_INVALID');
  }
  if (typeof evidence.currentObserved !== 'boolean' || typeof evidence.currentPositive !== 'boolean') {
    throw new Error('PRESSURE_RAIL_READINESS_CURRENT_EVIDENCE_INVALID');
  }
  if (evidence.currentPositive && !evidence.currentObserved) {
    throw new Error('PRESSURE_RAIL_READINESS_CURRENT_EVIDENCE_RELATION_INVALID');
  }
  const targetDayCount = evidence.formingTargetDays;
  const stableDayCount = evidence.completedTargetDays;
  const observedDayCount = evidence.completedObservedDays;
  const positiveDayCount = evidence.completedPositiveDays
    + (evidence.currentPositive === true ? 1 : 0);
  const candidateCount = (Array.isArray(visibleDomainCandidates) ? visibleDomainCandidates : [])
    .filter((candidate) => (
      toNumber(candidate?.weightedPressureMs) > 0 && toNumber(candidate?.pressureShare) > 0
    )).length;
  const totalPressureMs = Math.max(0, toNumber(rollingPressure?.totalPressureMs));
  let state = PRESSURE_RAIL_READINESS_STATES.READY;
  let contentState = PRESSURE_RAIL_CONTENT_STATES.PRESSURE;
  let reason = 'forming_evidence_ready';

  if (observedDayCount < targetDayCount) {
    state = PRESSURE_RAIL_READINESS_STATES.COLLECTING;
    contentState = PRESSURE_RAIL_CONTENT_STATES.PENDING;
    reason = 'forming_evidence_incomplete';
  } else {
    const pressureEvidenceCount = [
      positiveDayCount > 0,
      totalPressureMs > 0,
      candidateCount > 0,
    ].filter(Boolean).length;

    if (pressureEvidenceCount === 0) {
      contentState = PRESSURE_RAIL_CONTENT_STATES.NO_PRESSURE;
      reason = 'observed_without_pressure';
    } else if (pressureEvidenceCount !== 3) {
      throw new Error('PRESSURE_RAIL_READINESS_PRESSURE_EVIDENCE_INCONSISTENT');
    } else if (observedDayCount >= stableDayCount) {
      reason = 'stable_evidence_ready';
    }
  }

  return {
    state,
    contentState,
    reason,
    observedDayCount,
    positiveDayCount,
    targetDayCount,
    stableDayCount,
    candidateCount,
  };
}
