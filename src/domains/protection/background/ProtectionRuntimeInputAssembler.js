import {
  FILTERING_MODES,
} from '../../settings/config/blockingPolicy.js';
import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
  normalizeFilterSettings,
} from '../../settings/config/index.js';
import { resolveDomainUsageRecording, resolveSitesRecordingPolicy } from '../../settings/config/dataCollectionPolicy.js';
import { evaluateProtectionGlobalCapState } from '../domain/protectionGlobalCap.js';
import {
  DEFAULT_RULES_MODE,
  normalizeRulesMode,
} from '../../settings/config/siteRules.js';
import {
  getGateDetourHoldMs,
  getGateEntryHoldMs,
  getGateKeptTabPassWindowMs,
  getGateProtectedContextThreshold,
  getGateProtectedTabThreshold,
  normalizeGateConfig,
} from '../../settings/config/gateConfig.js';
import {
  buildProtectionProtocolStateSnapshot,
  PROTOCOL_SCOPE_BUDGET_ROLES,
} from '../runtime/protocolStateSnapshot.js';
import {
  ensureNumber,
  getLocalDateStr,
} from '../../../lib/index.js';
import {
  getTimeWindowRemainingMs,
  isTimeWindowActive,
} from '../../../lib/timeWindow.js';
import {
  normalizeDirectTriggers,
  normalizePressureSignals,
} from '../contracts/protectionContracts.js';
import { cloneFeedFlowSnapshot } from '../contracts/feedFlowSnapshotBridge.js';
import { requireProtectionCharge } from '../../stats/projection/projectProtectionBudget.js';
import {
  GLOBAL_SENTINEL_PROTECTION_MODE,
  normalizeGlobalSentinelOutcomeState,
} from '../../nudge/runtime/sentinelOutcomeContract.js';
import { resolveProtectionProfile } from './ProfileResolver.js';
import { resolveProtectionScope } from './protocol/engine/ProtectionScopeResolver.js';
import { resolveProtectionProtocolProjection } from './protectionProtocolProjection.js';
import { normalizeGateRuntimeSnapshot } from './runtime/GateRuntimeSnapshotContract.js';
import { GATE_RETURN_LOCK_MS } from './runtime/gateReturnLockPolicy.js';
import { selectShishiConsumptionLevel } from '../domain/shishiConsumptionLevel.js';
import { projectGateRecentConsumption } from '../domain/gateRecentConsumption.js';
import { requireCoolingCurve } from '../../settings/config/coolingCurvePolicy.js';

const GATE_ENTRY_SIGNAL_TTL_MS = 12_000;
const GATE_REENTRY_SIGNAL_TTL_MS = 20_000;
const GATE_CONTEXT_SWITCH_WINDOW_MS = 75_000;

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function mergePressureSignals(...collections) {
  return normalizePressureSignals(collections.flatMap((values) => (
    Array.isArray(values) ? values : []
  )));
}

function mergeDirectTriggers(...collections) {
  return normalizeDirectTriggers(collections.flatMap((values) => (
    Array.isArray(values) ? values : []
  )));
}

function countRecentEvents(values = [], now = Date.now(), windowMs = 0) {
  if (!Array.isArray(values) || windowMs <= 0) return 0;
  return values.reduce((count, value) => {
    const normalizedValue = Math.max(0, Math.floor(Number(value) || 0));
    if (!normalizedValue) return count;
    return normalizedValue <= now && (now - normalizedValue) <= windowMs ? count + 1 : count;
  }, 0);
}

function resolveGateRuntimeContext({
  gateConfig,
  gateRuntimeSnapshot = null,
  now = Date.now(),
} = {}) {
  const normalizedGateConfig = normalizeGateConfig(gateConfig);
  const normalizedSnapshot = normalizeGateRuntimeSnapshot(gateRuntimeSnapshot);
  const entryHoldDurationMs = getGateEntryHoldMs();
  const keptTabPassWindowMs = getGateKeptTabPassWindowMs();
  const contextSwitchThreshold = 0;
  const protectedTabThreshold = getGateProtectedTabThreshold(
    normalizedGateConfig.detourSpreadGuard.maxProtectedTabs,
  );
  const protectedContextThreshold = getGateProtectedContextThreshold();
  const detourHoldDurationMs = getGateDetourHoldMs();
  const contextSwitchCount = countRecentEvents(
    normalizedSnapshot.recentSwitchInAts,
    now,
    GATE_CONTEXT_SWITCH_WINDOW_MS,
  );
  const contextSwitchTriggered = false;
  const protectedTabTriggered = normalizedGateConfig.detourSpreadGuard.enabled
    && protectedTabThreshold > 0
    && normalizedSnapshot.protectedTabCount >= protectedTabThreshold;
  const protectedContextTriggered = normalizedGateConfig.detourSpreadGuard.enabled
    && protectedContextThreshold > 0
    && normalizedSnapshot.consumedProtectedContextCount >= protectedContextThreshold;
  const keptTabPassActive = isTimeWindowActive(normalizedSnapshot.keptTabPassUntil, now);
  const entryApproved = normalizedSnapshot.entryApproved;
  const mediaMaintenanceActive = isTimeWindowActive(normalizedSnapshot.mediaMaintenanceUntil, now);
  const mediaMaintenanceReturnActive = mediaMaintenanceActive
    && normalizedSnapshot.lastMediaMaintenanceReturnAt > 0
    && (now - normalizedSnapshot.lastMediaMaintenanceReturnAt) <= GATE_REENTRY_SIGNAL_TTL_MS;
  // The return lock is held per site by the runtime owner; here it only meets
  // a fresh foreground entry. It is not a question, so neither entry approval
  // nor media maintenance opens it.
  const returnLockActive = normalizedGateConfig.returnGuard.enabled
    && normalizedSnapshot.returnLockActive
    && normalizedSnapshot.returnLockUntil > now;
  const returnLockRemainingMs = returnLockActive
    ? getTimeWindowRemainingMs(normalizedSnapshot.returnLockUntil, now)
    : 0;
  const entryBoundaryAt = Math.max(normalizedSnapshot.lastEnteredAt, normalizedSnapshot.lastReturnAt);
  const entryCheckpointTriggered = normalizedGateConfig.entryCheckpoint.enabled
    && normalizedSnapshot.isForeground
    && entryBoundaryAt > 0
    && (now - entryBoundaryAt) <= GATE_ENTRY_SIGNAL_TTL_MS
    && !keptTabPassActive
    && !entryApproved
    && !mediaMaintenanceReturnActive;
  const returnGuardTriggered = returnLockActive
    && normalizedSnapshot.isForeground
    && entryBoundaryAt > 0
    && (now - entryBoundaryAt) <= GATE_ENTRY_SIGNAL_TTL_MS;
  // Inventory changes alone never replace a page the user is reading. Only
  // an actual foreground entry/activation owns this same-tab decision lane.
  const detourSpreadReviewDue = normalizedSnapshot.protectedTabCount
    > normalizedSnapshot.detourSpreadReviewedCount;
  const detourSpreadTriggered = normalizedGateConfig.detourSpreadGuard.enabled
    && protectedTabTriggered
    && normalizedSnapshot.isForeground
    && normalizedSnapshot.detourEntryObserved
    && detourSpreadReviewDue;

  return {
    pressureSignals: mergePressureSignals(
      returnGuardTriggered ? ['REENTRY_AFTER_BLOCK'] : [],
    ),
    directTriggers: mergeDirectTriggers(
      entryCheckpointTriggered ? ['ENTRY_CHECKPOINT_REQUIRED'] : [],
      returnGuardTriggered ? ['RETURN_GUARD_REQUIRED'] : [],
      detourSpreadTriggered ? ['DETOUR_SPREAD_DETECTED'] : [],
      detourSpreadTriggered && protectedTabTriggered ? ['PROTECTED_TAB_CLUSTER'] : [],
      returnGuardTriggered ? ['RAPID_RETURN'] : [],
    ),
    telemetry: {
      entryCheckpoint: {
        entryDetected: entryCheckpointTriggered,
        lastEnteredAt: normalizedSnapshot.lastEnteredAt,
        entrySignalTtlMs: GATE_ENTRY_SIGNAL_TTL_MS,
        keptTabPassUntil: normalizedSnapshot.keptTabPassUntil,
        keptTabPassActive,
        entryApproved,
        lastContinuityRelation: normalizedSnapshot.lastContinuityRelation,
        mediaMaintenanceReturnActive,
        mediaMaintenanceUntil: normalizedSnapshot.mediaMaintenanceUntil,
        holdDurationMs: entryHoldDurationMs,
        keptTabPassWindowMs: keptTabPassWindowMs,
      },
      returnGuard: {
        lockActive: returnLockActive,
        lockLeftAt: returnLockActive ? normalizedSnapshot.returnLockLeftAt : 0,
        lockUntil: returnLockActive ? normalizedSnapshot.returnLockUntil : 0,
        lockRemainingMs: returnLockRemainingMs,
        lockDurationMs: GATE_RETURN_LOCK_MS,
        entryApproved,
        // The lock is the hold: the Gate opens when the site does.
        holdDurationMs: returnLockRemainingMs,
        triggered: returnGuardTriggered,
      },
      detourSpreadGuard: {
        maxProtectedTabs: normalizedGateConfig.detourSpreadGuard.maxProtectedTabs,
        contextSwitchCount,
        contextSwitchThreshold,
        contextSwitchWindowMs: GATE_CONTEXT_SWITCH_WINDOW_MS,
        contextSwitchRatePerMinute: contextSwitchCount / (GATE_CONTEXT_SWITCH_WINDOW_MS / 60_000),
        protectedTabCount: normalizedSnapshot.protectedTabCount,
        protectedTabHostCount: normalizedSnapshot.protectedTabHostCount,
        protectedTabThreshold,
        detourSpreadNoticedCount: normalizedSnapshot.detourSpreadNoticedCount,
        detourSpreadReviewedCount: normalizedSnapshot.detourSpreadReviewedCount,
        detourSpreadReviewDue,
        protectedTabs: normalizedSnapshot.protectedTabs,
        detourEntryObserved: normalizedSnapshot.detourEntryObserved,
        consumedProtectedContextCount: normalizedSnapshot.consumedProtectedContextCount,
        protectedContextThreshold,
        consumeDwellMs: normalizedSnapshot.consumeDwellMs,
        contextWindowMs: normalizedSnapshot.contextWindowMs,
        hopSignal: contextSwitchTriggered,
        clusterSignal: protectedTabTriggered,
        protectedTabSignal: protectedTabTriggered,
        consumedContextSignal: protectedContextTriggered,
        lastContinueAt: normalizedSnapshot.lastContinueAt,
        lastContinueKind: normalizedSnapshot.lastContinueKind,
        holdDurationMs: detourHoldDurationMs,
        triggered: detourSpreadTriggered,
      },
    },
  };
}

export function createProtectionRuntimeInputAssembler({
  defaultFilterSettings = CONFIG_DEFAULT_FILTER_SETTINGS,
  resolveScope = resolveProtectionScope,
  resolveProfile = resolveProtectionProfile,
  mergeNudgeConfig,
} = {}) {
  if (typeof mergeNudgeConfig !== 'function') {
    throw new Error('PROTECTION_RUNTIME_INPUT_ASSEMBLER_NUDGE_CONFIG_OWNER_REQUIRED');
  }

  function assembleRuntimeInput(rawInput = {}) {
    const normalizedHostname = normalizeHost(rawInput.hostname);
    const now = Math.max(0, Math.floor(Number(rawInput.now) || Date.now()));
    const settingsSnapshot = rawInput.settingsSnapshot && typeof rawInput.settingsSnapshot === 'object'
      ? rawInput.settingsSnapshot
      : {};
    const ruleHashSnapshot = rawInput.ruleHashSnapshot && typeof rawInput.ruleHashSnapshot === 'object'
      ? rawInput.ruleHashSnapshot
      : {};
    const domainRecording = resolveDomainUsageRecording(normalizedHostname, settingsSnapshot);
    const recordingPolicy = resolveSitesRecordingPolicy(settingsSnapshot);
    const rawStatsSnapshot = rawInput.statsSnapshot && typeof rawInput.statsSnapshot === 'object'
      ? rawInput.statsSnapshot
      : { dates: {} };
    const statsSnapshot = domainRecording.enabled ? rawStatsSnapshot : { ...rawStatsSnapshot, dates: {} };
    const dateStr = statsSnapshot?.dateStr || getLocalDateStr(now);
    const globalSentinelOutcome = normalizeGlobalSentinelOutcomeState(
      rawInput.globalSentinelOutcome,
      { now, dateStr },
    );
    const globalSentinelReleaseActive = globalSentinelOutcome?.protectionMode
      === GLOBAL_SENTINEL_PROTECTION_MODE.RELEASE;
    const globalSentinelMaxFilterActive = globalSentinelOutcome?.protectionMode
      === GLOBAL_SENTINEL_PROTECTION_MODE.MAX_FILTER;
    const rulesMode = normalizeRulesMode(settingsSnapshot.rulesMode, DEFAULT_RULES_MODE);
    const scope = resolveScope({
      hostname: normalizedHostname,
      now,
      rulesMode,
      blockedUrls: settingsSnapshot.blockedUrls,
      allowedUrls: settingsSnapshot.allowedUrls,
      filteringMode: settingsSnapshot.filteringMode,
      relaxationSchedule: settingsSnapshot.relaxationSchedule,
      specialSession: rawInput.specialSession,
      skippedOccurrenceId: rawInput.skippedOccurrenceId,
      capExceeded: rawInput.capState?.exceeded === true,
      blockedByHash: ruleHashSnapshot.blockedByHash,
      allowedByHash: ruleHashSnapshot.allowedByHash,
    });

    const protocolSiteGoals = (() => {
      if (!normalizedHostname) {
        return settingsSnapshot?.siteGoals || {};
      }
      const rawSiteGoalFromHash = ruleHashSnapshot?.siteGoalFromHash;
      const siteGoalFromHash = rawSiteGoalFromHash === null || rawSiteGoalFromHash === undefined || rawSiteGoalFromHash === ''
        ? Number.NaN
        : Number(rawSiteGoalFromHash);
      if (!Number.isFinite(siteGoalFromHash)) {
        return settingsSnapshot?.siteGoals || {};
      }
      return {
        ...(settingsSnapshot?.siteGoals || {}),
        [normalizedHostname]: siteGoalFromHash,
      };
    })();
    const coolingSiteGoalMinutes = Object.hasOwn(protocolSiteGoals, normalizedHostname) ? protocolSiteGoals[normalizedHostname] : 0;
    if (!Number.isSafeInteger(coolingSiteGoalMinutes) || coolingSiteGoalMinutes < 0) throw new Error('COOLING_CURVE_SITE_GOAL_INVALID');
    const protocolState = buildProtectionProtocolStateSnapshot({
      globalGoal: settingsSnapshot.globalGoal,
      blockedDomains: settingsSnapshot.blockedUrls,
      siteGoals: protocolSiteGoals,
      recordingPolicy: settingsSnapshot,
      // Global retains its independent recorded total. The protocol owner
      // applies per-host recording admission to Site targets itself.
      stats: rawStatsSnapshot,
      scopeBudgetRole: PROTOCOL_SCOPE_BUDGET_ROLES.ACTIVE,
      nowTs: now,
    });
    const {
      protocolScope,
      protocolReferenceTargetSource,
      protocolActiveTargetSource,
      protocolTargetMinutes,
      protocolReferenceTargetMinutes,
    } = resolveProtectionProtocolProjection(protocolState, normalizedHostname);
    const siteGoalMeta = normalizedHostname ? settingsSnapshot?.siteGoalMeta?.[normalizedHostname] || null : null;
    const specialSession = scope.specialSession;
    const specialSessionActive = specialSession.active === true;
    const isScheduleWindowActive = scope.temporalPolicy.source === 'schedule';
    const isScheduleRelaxationActive = scope.temporalPolicy.mode === 'relaxation';
    const isHardBlockWindow = scope.temporalPolicy.mode === 'isolation';
    const isAllowedWindow = scope?.filteringMode === FILTERING_MODES.ALLOWLIST;
    const normalizedFilterSettings = normalizeFilterSettings(
      rawInput.filterSettings || settingsSnapshot.filterSettings || defaultFilterSettings,
    );
    const baseFilters = normalizedFilterSettings;
    const coolingCurve = requireCoolingCurve(settingsSnapshot.coolingCurve);
    const capState = recordingPolicy.globalCapAvailable ? rawInput.capState || null
      : evaluateProtectionGlobalCapState({ globalGoalMin: 0, blockedTodayMs: 0, now, dateStr });
    const feedFlowSnapshot = rawInput.feedFlowSnapshot && typeof rawInput.feedFlowSnapshot === 'object'
      ? cloneFeedFlowSnapshot(rawInput.feedFlowSnapshot)
      : null;
    const runtimeDirectTriggers = Array.isArray(rawInput.directTriggers)
      ? rawInput.directTriggers
      : [];
    const gateRuntime = resolveGateRuntimeContext({
      gateConfig: settingsSnapshot?.gateConfig,
      gateRuntimeSnapshot: rawInput.gateRuntimeSnapshot,
      now,
    });
    const recentConsumption = projectGateRecentConsumption(rawInput.consumptionContext, now);
    gateRuntime.telemetry.entryCheckpoint.recentConsumption = recentConsumption;
    gateRuntime.telemetry.returnGuard.recentConsumption = recentConsumption;
    gateRuntime.telemetry.entryCheckpoint.shishiIntensity = selectShishiConsumptionLevel({
      enabled: normalizeGateConfig(settingsSnapshot.gateConfig).entryCheckpoint.enabled,
      memoryRead: rawInput.consumptionContext?.memory,
      now,
    });

    if (!scope.ok || !scope.isBlockedDomain) {
      return {
        hostname: normalizedHostname,
        now,
        baseFilters,
        capState,
        coolingCurve,
        recordingAvailable: domainRecording.enabled,
        coolingSiteGoalMinutes,
        rulesMode,
        scope,
        protocolState,
        protocolScope,
        protocolTargetMinutes,
        protocolActiveTargetSource,
        protocolReferenceTargetMinutes,
        protocolReferenceTargetSource,
        siteGoalMeta,
        isHardBlockWindow,
        isScheduleRelaxationActive,
        isAllowedWindow,
        specialSession,
        directTriggers: mergeDirectTriggers(runtimeDirectTriggers),
        pressureSignals: [],
        feedFlowSnapshot,
        gateRuntime,
        globalSentinelOutcome,
      };
    }

    if (globalSentinelReleaseActive) {
      return {
        hostname: normalizedHostname,
        now,
        baseFilters,
        capState,
        coolingCurve,
        recordingAvailable: domainRecording.enabled,
        coolingSiteGoalMinutes,
        rulesMode,
        scope,
        protocolState,
        protocolScope,
        protocolTargetMinutes,
        protocolActiveTargetSource,
        protocolReferenceTargetMinutes,
        protocolReferenceTargetSource,
        siteGoalMeta,
        isHardBlockWindow,
        isScheduleRelaxationActive,
        isAllowedWindow,
        specialSession,
        directTriggers: [],
        pressureSignals: [],
        feedFlowSnapshot,
        gateRuntime,
        globalSentinelOutcome,
        releaseReason: 'global_sentinel_resynchronized',
      };
    }

    const { profile, metadata } = resolveProfile({
      hostname: normalizedHostname,
      scope,
      filterSettings: normalizedFilterSettings,
      rulesMode,
      protocolScope,
      settingsSnapshot,
      artifactDisclosureSnapshot: rawInput.artifactDisclosureSnapshot,
      mergeNudgeConfig,
    });
    const domainFact = statsSnapshot?.dates?.[dateStr]?.domains?.[normalizedHostname];
    const domainActivityMs = domainFact === undefined ? 0
      : requireProtectionCharge(domainFact.protectedActive, `${dateStr}:${normalizedHostname}`);
    const sessionMs = domainRecording.enabled ? ensureNumber(rawInput.sessionDwellMs) : 0;
    const pressureSignals = [];
    const directTriggers = mergeDirectTriggers(
      runtimeDirectTriggers,
      gateRuntime.directTriggers,
      specialSessionActive ? ['ISOLATION_SESSION_ACTIVE'] : [],
      globalSentinelMaxFilterActive ? ['GLOBAL_PROTOCOL_LOCK'] : [],
    );

    return {
      hostname: normalizedHostname,
      now,
      baseFilters,
      capState,
      coolingCurve,
      recordingAvailable: domainRecording.enabled,
      coolingSiteGoalMinutes,
      rulesMode,
      scope,
      siteGoalMeta,
      isHardBlockWindow,
      isScheduleRelaxationActive,
      isAllowedWindow,
      specialSession,
      profile,
      profileMetadata: metadata,
      statsCache: statsSnapshot,
      domainActivityMs,
      sessionMs,
      pressureSignals,
      directTriggers,
      feedFlowSnapshot,
      gateRuntime,
      protocolState,
      protocolScope,
      protocolTargetMinutes,
      protocolActiveTargetSource,
      protocolReferenceTargetMinutes,
      protocolReferenceTargetSource,
      globalSentinelOutcome,
    };
  }

  return {
    assembleRuntimeInput,
  };
}
