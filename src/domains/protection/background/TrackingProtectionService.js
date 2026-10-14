import { hasEnabledGoalEnd, isGoalEndEnabled } from '../../settings/config/nudgeConfig.js';
import {
  createProtectionRuntimeDecisionService,
} from '../domain/index.js';
import { resolveMemoryPurgeSettings } from '../../settings/config/siteRules.js';
import { createSentinelFlareArtifactConfig } from '../runtime/flareArtifactConfig.js';
import { deriveSentinelFlareArtifactSummary } from '../runtime/flareArtifactEvaluator.js';
import { resolveEnsoAttentionCoherenceState } from '../runtime/ensoAttentionCoherenceState.js';
import { resolveDomainUsageRecording, resolveSitesRecordingPolicy } from '../../settings/config/dataCollectionPolicy.js';
import { projectGoalEpisodePolicySignature } from '../../nudge/runtime/goalEpisodeBinding.js';
import { readFurinGoalEndState } from '../../nudge/runtime/session/readFurinGoalEndState.js';
import { buildGoalEndSummary } from '../runtime/goalEndSummary.js';
import { createProtectionEngine } from './runtime/ProtectionEngine.js';
import { createBudgetSnapshotReader } from './observe/BudgetSnapshotReader.js';
import { resolveCoolingCurve } from '../runtime/coolingCurveResolver.js';
import { requireProtectionCharge } from '../../stats/projection/projectProtectionBudget.js';
import { createRuntimeSnapshotBuilder } from './runtime/RuntimeSnapshotBuilder.js';
import { createRecoveryFlowResolver } from './strategy/RecoveryFlowResolver.js';
import FrictionModifierSessionRepository from '../../../platform/storage/runtime/FrictionModifierSessionRepository.js';
import {
  FRICTION_MODIFIER_PRIORITIES,
  FRICTION_MODIFIER_SCOPE_KINDS,
  FRICTION_MODIFIER_SOURCES,
  FRICTION_MODIFIER_TARGETS,
  createFilterIntensityModifier,
} from '../runtime/frictionModifierResolver.js';

const TRACKING_PROTECTION_RUNTIME_STATE_COORDINATOR_METHODS = Object.freeze([
  'nextDecisionRevision',
  'clearProtectionRuntimeSnapshot',
  'noteStrategySnapshot',
  'getStrategyEffectivenessSnapshot',
  'setProtectionRuntimeSnapshot',
  'getProtectionRuntimeSnapshot',
  'prepareFeedFlowSnapshot',
  'commitFeedFlowSnapshot',
  'applyGateInterventionDecision',
  'recordGateInterventionShown',
  'recordRecoveryPresented',
  'recordRecoveryOutcome',
]);

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function projectRuntimeActivityDay(statsSnapshot, hostname) {
  if (
    statsSnapshot?.basis !== 'activity-day'
    || !/^\d{4}-\d{2}-\d{2}$/.test(statsSnapshot.dateStr)
    || !Number.isInteger(statsSnapshot.resetHour)
    || statsSnapshot.resetHour < 0 || statsSnapshot.resetHour > 23
    || !statsSnapshot.dates || typeof statsSnapshot.dates !== 'object'
    || Array.isArray(statsSnapshot.dates)
  ) {
    throw new Error('TRACKING_PROTECTION_ACTIVITY_DAY_INVALID');
  }
  const day = statsSnapshot.dates[statsSnapshot.dateStr];
  const domain = day?.domains?.[hostname];
  const activeMs = domain === undefined ? 0
    : requireProtectionCharge(domain.protectedActive, `${statsSnapshot.dateStr}:${hostname}`);
  if (!Number.isFinite(activeMs) || activeMs < 0) {
    throw new Error('TRACKING_PROTECTION_ACTIVITY_DAY_ACTIVE_INVALID');
  }
  return Object.freeze({
    basis: 'activity-day',
    dateStr: statsSnapshot.dateStr,
    resetHour: statsSnapshot.resetHour,
    activeMs: Math.round(activeMs),
    ...(domain && Object.hasOwn(domain,'reflection') ? { reflection:domain.reflection } : {}),
  });
}

function requireTrackingProtectionRuntimeStateCoordinator(runtimeStateCoordinator) {
  for (const methodName of TRACKING_PROTECTION_RUNTIME_STATE_COORDINATOR_METHODS) {
    if (!runtimeStateCoordinator || typeof runtimeStateCoordinator[methodName] !== 'function') {
      throw new Error(
        `TRACKING_PROTECTION_RUNTIME_STATE_COORDINATOR_METHOD_REQUIRED:${methodName}`,
      );
    }
  }
}

function normalizeProtectedTelemetryTabs(values = []) {
  if (!Array.isArray(values)) return [];
  const seenTabIds = new Set();
  return values.reduce((acc, entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return acc;
    const tabId = Number(entry.tabId);
    const hostname = normalizeHost(entry.hostname);
    const url = typeof entry.url === 'string' ? entry.url.trim() : '';
    if (!Number.isInteger(tabId) || tabId < 0 || seenTabIds.has(tabId) || !hostname || !url) return acc;
    seenTabIds.add(tabId);
    const protectedTab = {
      tabId,
      hostname,
      url,
      title: typeof entry.title === 'string' ? entry.title.trim() : '',
      favIconUrl: typeof entry.favIconUrl === 'string' ? entry.favIconUrl.trim() : '',
      active: entry.active === true,
    };
    if (Number.isInteger(Number(entry.windowId)) && Number(entry.windowId) >= 0) {
      protectedTab.windowId = Number(entry.windowId);
    }
    if (Number.isInteger(Number(entry.index)) && Number(entry.index) >= 0) {
      protectedTab.index = Number(entry.index);
    }
    if (Number.isInteger(Number(entry.openerTabId)) && Number(entry.openerTabId) >= 0) {
      protectedTab.openerTabId = Number(entry.openerTabId);
    }
    acc.push(protectedTab);
    return acc;
  }, []);
}

export function createTrackingProtectionService({
  readProfileGeneration,
  readGoalEndState = readFurinGoalEndState,
  runtimeInputProvider,
  runtimeInputAssembler,
  runtimeStateCoordinator,
  protectionEngine = createProtectionEngine(),
  budgetSnapshotReader = createBudgetSnapshotReader(),
  runtimeSnapshotBuilder = createRuntimeSnapshotBuilder(),
  runtimeDecisionService = createProtectionRuntimeDecisionService(),
  recoveryFlowResolver = createRecoveryFlowResolver(),
  frictionModifierSessionRepository = FrictionModifierSessionRepository.getInstance(),
  mergeNudgeConfig,
} = {}) {
  if (!runtimeInputProvider || typeof runtimeInputProvider.provideRuntimeInput !== 'function') {
    throw new Error('createTrackingProtectionService requires a runtimeInputProvider');
  }
  if (!runtimeInputAssembler || typeof runtimeInputAssembler.assembleRuntimeInput !== 'function') {
    throw new Error('createTrackingProtectionService requires a runtimeInputAssembler');
  }
  requireTrackingProtectionRuntimeStateCoordinator(runtimeStateCoordinator);
  if (typeof mergeNudgeConfig !== 'function') {
    throw new Error('TRACKING_PROTECTION_SERVICE_NUDGE_CONFIG_OWNER_REQUIRED');
  }

  function readCoolingCurvePlan(assembledInput, activityDay, observation = null) {
    const siteGoalMinutes = assembledInput.coolingSiteGoalMinutes;
    const hasBasis = siteGoalMinutes > 0 && assembledInput.recordingAvailable === true;
    const budgetRatio = !hasBasis ? null : observation !== null
      ? observation.budgetRatio
      : budgetSnapshotReader.readSnapshot({
        profile: null,
        host: assembledInput.hostname,
        context: { effectiveTargetMinutes: siteGoalMinutes, siteDayMs: activityDay.activeMs },
      }).budgetRatio;
    return resolveCoolingCurve({
      hostname: assembledInput.hostname, budgetRatio, siteGoalMinutes,
      recordingAvailable: assembledInput.recordingAvailable, coolingCurve: assembledInput.coolingCurve,
    });
  }

  function buildProtectionRuntimeTelemetryContext({
    rawInput = {},
    assembledInput = {},
  } = {}) {
    const settingsSnapshot = rawInput?.settingsSnapshot && typeof rawInput.settingsSnapshot === 'object'
      ? rawInput.settingsSnapshot
      : {};
    const memoryPurgeSettings = resolveMemoryPurgeSettings(settingsSnapshot);
    const nudgeConfig = mergeNudgeConfig(settingsSnapshot?.nudgeConfig);
    const flareArtifactConfig = createSentinelFlareArtifactConfig({
      enabled: hasEnabledGoalEnd(nudgeConfig),
    });
    const flareArtifactSummary = deriveSentinelFlareArtifactSummary({
      protocolState: assembledInput?.protocolState,
      artifactConfig: flareArtifactConfig,
      blockedDomains: Array.isArray(settingsSnapshot?.blockedUrls) ? settingsSnapshot.blockedUrls : [],
    });
    const gateTelemetry = assembledInput?.gateRuntime?.telemetry
      && typeof assembledInput.gateRuntime.telemetry === 'object'
      ? assembledInput.gateRuntime.telemetry
      : {};
    const gateEntry = gateTelemetry.entryCheckpoint && typeof gateTelemetry.entryCheckpoint === 'object'
      ? gateTelemetry.entryCheckpoint
      : {};
    const gateReturn = gateTelemetry.returnGuard && typeof gateTelemetry.returnGuard === 'object'
      ? gateTelemetry.returnGuard
      : {};
    const gateDetour = gateTelemetry.detourSpreadGuard && typeof gateTelemetry.detourSpreadGuard === 'object'
      ? gateTelemetry.detourSpreadGuard
      : {};
    const ensoAttentionCoherence = resolveEnsoAttentionCoherenceState({
      gateTelemetry,
      feedFlowSnapshot: assembledInput?.feedFlowSnapshot,
      directTriggers: assembledInput?.directTriggers,
      pressureSignals: assembledInput?.pressureSignals,
    });
    const echoSafeguardCount = [
      memoryPurgeSettings.historyCleanupForBlocked,
      memoryPurgeSettings.concealBlockedBookmarks,
    ].filter(Boolean).length;

    return {
      flare: {
        sentinelFlare: {
          basis: typeof flareArtifactSummary?.basis === 'string' ? flareArtifactSummary.basis : '',
          overallStatus: typeof flareArtifactSummary?.overallStatus === 'string'
            ? flareArtifactSummary.overallStatus
            : 'off',
          referenceExceededCount: Math.max(
            0,
            Number(flareArtifactSummary?.referenceExceededCount) || 0,
          ),
          sitesInScopeCount: Math.max(
            0,
            Number(flareArtifactSummary?.sitesInScopeCount) || 0,
          ),
          targets: Array.isArray(flareArtifactSummary?.targets)
            ? flareArtifactSummary.targets.map((entry) => ({ ...entry }))
            : [],
          topTargets: Array.isArray(flareArtifactSummary?.topTargets)
            ? flareArtifactSummary.topTargets.map((entry) => ({ ...entry }))
            : [],
        },
      },
      echo: {
        memoryPurge: {
          safeguardCount: echoSafeguardCount,
          safeguardMax: 2,
        },
      },
      veil: {
        attentionCoherence: ensoAttentionCoherence,
      },
      gate: {
        entryCheckpoint: {
          entryDetected: gateEntry.entryDetected === true,
          shishiIntensity: gateEntry.shishiIntensity,
          recentConsumption: gateEntry.recentConsumption,
          lastEnteredAt: Math.max(0, Math.floor(Number(gateEntry.lastEnteredAt) || 0)),
          entrySignalTtlMs: Math.max(0, Math.floor(Number(gateEntry.entrySignalTtlMs) || 0)),
          keptTabPassUntil: Math.max(0, Math.floor(Number(gateEntry.keptTabPassUntil) || 0)),
          keptTabPassActive: gateEntry.keptTabPassActive === true,
          entryApproved: gateEntry.entryApproved === true,
          holdDurationMs: Math.max(0, Math.floor(Number(gateEntry.holdDurationMs) || 0)),
          keptTabPassWindowMs: Math.max(0, Math.floor(Number(gateEntry.keptTabPassWindowMs) || 0)),
        },
        returnGuard: {
          lockActive: gateReturn.lockActive === true,
          recentConsumption: gateReturn.recentConsumption,
          entryApproved: gateReturn.entryApproved === true,
          lockLeftAt: Math.max(0, Math.floor(Number(gateReturn.lockLeftAt) || 0)),
          lockUntil: Math.max(0, Math.floor(Number(gateReturn.lockUntil) || 0)),
          lockRemainingMs: Math.max(0, Math.floor(Number(gateReturn.lockRemainingMs) || 0)),
          lockDurationMs: Math.max(0, Math.floor(Number(gateReturn.lockDurationMs) || 0)),
          holdDurationMs: Math.max(0, Math.floor(Number(gateReturn.holdDurationMs) || 0)),
          triggered: gateReturn.triggered === true,
        },
        detourSpreadGuard: {
          maxProtectedTabs: Math.max(1, Math.floor(Number(gateDetour.maxProtectedTabs) || 1)),
          contextSwitchCount: Math.max(0, Math.floor(Number(gateDetour.contextSwitchCount) || 0)),
          contextSwitchThreshold: Math.max(0, Math.floor(Number(gateDetour.contextSwitchThreshold) || 0)),
          contextSwitchWindowMs: Math.max(0, Math.floor(Number(gateDetour.contextSwitchWindowMs) || 0)),
          contextSwitchRatePerMinute: Math.max(0, Number(gateDetour.contextSwitchRatePerMinute) || 0),
          protectedTabCount: Math.max(0, Math.floor(Number(gateDetour.protectedTabCount) || 0)),
          protectedTabHostCount: Math.max(0, Math.floor(Number(gateDetour.protectedTabHostCount) || 0)),
          protectedTabThreshold: Math.max(0, Math.floor(Number(gateDetour.protectedTabThreshold) || 0)),
          protectedTabs: normalizeProtectedTelemetryTabs(gateDetour.protectedTabs),
          detourEntryObserved: gateDetour.detourEntryObserved === true,
          consumedProtectedContextCount: Math.max(0, Math.floor(Number(gateDetour.consumedProtectedContextCount) || 0)),
          protectedContextThreshold: Math.max(0, Math.floor(Number(gateDetour.protectedContextThreshold) || 0)),
          consumeDwellMs: Math.max(0, Math.floor(Number(gateDetour.consumeDwellMs) || 0)),
          contextWindowMs: Math.max(0, Math.floor(Number(gateDetour.contextWindowMs) || 0)),
          hopSignal: gateDetour.hopSignal === true,
          clusterSignal: gateDetour.clusterSignal === true,
          protectedTabSignal: gateDetour.protectedTabSignal === true,
          consumedContextSignal: gateDetour.consumedContextSignal === true,
          lastContinueAt: Math.max(0, Math.floor(Number(gateDetour.lastContinueAt) || 0)),
          lastContinueKind: typeof gateDetour.lastContinueKind === 'string' ? gateDetour.lastContinueKind : '',
          holdDurationMs: Math.max(0, Math.floor(Number(gateDetour.holdDurationMs) || 0)),
          triggered: gateDetour.triggered === true,
        },
      },
    };
  }

  async function getGlobalCapState(now = Date.now()) {
    return runtimeInputProvider.getGlobalCapState(now);
  }

  async function readCoolingCurveRuntimeState({ hostname, now = Date.now() } = {}) {
    const rawInput = await runtimeInputProvider.provideRuntimeInput(hostname, { now });
    const assembledInput = runtimeInputAssembler.assembleRuntimeInput(rawInput);
    const activityDay = projectRuntimeActivityDay(rawInput.statsSnapshot, assembledInput.hostname);
    return { activityDay, coolingCurve: readCoolingCurvePlan(assembledInput, activityDay).coolingCurve,
      applicationOverride: assembledInput.globalSentinelOutcome?.protectionMode === 'release' ? 'release'
        : assembledInput.globalSentinelOutcome?.protectionMode === 'max_filter' ? 'max_filter' : null };
  }

  async function resolveProtectionRuntime(
    hostname,
    {
      now = Date.now(),
      filterSettings = null,
      capStateOverride = null,
      directTriggers = [],
      feedFlowSource = null,
      gateEntryObserved = false,
      tabId = null,
      previousEnvelopeState = null,
      previousRevision = 0,
      forceSnapshot = false,
      includeGoalEpisodeSettings = false,
    } = {},
  ) {
    const rawInput = await runtimeInputProvider.provideRuntimeInput(hostname, {
      now,
      filterSettings,
      capStateOverride,
      directTriggers,
      feedFlowSource,
      gateEntryObserved,
      tabId,
    });
    const assembledInput = runtimeInputAssembler.assembleRuntimeInput(rawInput);
    const activityDay = projectRuntimeActivityDay(rawInput.statsSnapshot, assembledInput.hostname);
    const telemetryContext = buildProtectionRuntimeTelemetryContext({
      rawInput,
      assembledInput,
    });
    const decisionRevision = runtimeStateCoordinator.nextDecisionRevision();
    const normalizedHostname = assembledInput.hostname;
    const storedRuntimeModifiers = await frictionModifierSessionRepository.getActiveModifiersForHostname(
      normalizedHostname,
      { now: assembledInput.now },
    );
    const runtimeModifiers = [
      ...storedRuntimeModifiers,
      ...(assembledInput.isScheduleRelaxationActive ? [createFilterIntensityModifier({
        id: 'schedule_relaxation',
        source: FRICTION_MODIFIER_SOURCES.SCHEDULE_RELAXATION,
        scope: { kind: FRICTION_MODIFIER_SCOPE_KINDS.GLOBAL_SESSION },
        target: { kind: FRICTION_MODIFIER_TARGETS.ADJUSTABLE_FILTERS },
        delta: -1,
        priority: FRICTION_MODIFIER_PRIORITIES.SCHEDULE_RELAXATION,
      })] : []),
    ];

    const releaseActive = typeof assembledInput.releaseReason === 'string' && assembledInput.releaseReason;
    if (!assembledInput.scope?.ok || !assembledInput.scope?.isBlockedDomain || releaseActive) {
      protectionEngine.reset({ host: normalizedHostname });
      const inactiveScope = releaseActive
        ? {
          ...(assembledInput.scope || {}),
          isBlockedDomain: false,
          domainClassId: 'unmanaged',
        }
        : assembledInput.scope;
      const inactiveDecision = runtimeDecisionService.prepareEvaluation({
        hostname: normalizedHostname,
        scope: inactiveScope,
        now: assembledInput.now,
        rulesMode: assembledInput.rulesMode,
        capState: assembledInput.capState,
        isHardBlockWindow: assembledInput.isHardBlockWindow,
        isAllowedWindow: assembledInput.isAllowedWindow,
        profileMetadata: {
          budgetMinutes: assembledInput.protocolTargetMinutes,
          protocolBudgetRole: assembledInput.protocolScope?.budgetRole || 'reference',
          protocolActiveTargetMinutes: assembledInput.protocolTargetMinutes,
          protocolActiveTargetSource: assembledInput.protocolActiveTargetSource,
          referenceTargetMinutes: assembledInput.protocolReferenceTargetMinutes,
          referenceTargetSource: assembledInput.protocolReferenceTargetSource,
        },
        revision: decisionRevision,
        coolingCurve: assembledInput.coolingCurve,
      });

      const coolingCurvePlan = readCoolingCurvePlan(assembledInput, activityDay);
      runtimeStateCoordinator.clearProtectionRuntimeSnapshot({ hostname: normalizedHostname });
      const inactiveRuntimeSnapshot = runtimeSnapshotBuilder.build({
        hostname: normalizedHostname,
        profile: null,
        plan: runtimeSnapshotBuilder.buildNoopPlan(inactiveDecision.trace.reasonCodes),
        baseFilters: assembledInput.baseFilters,
        runtimeModifiers,
        coolingCurvePlan,
        coolingCurveApplicationOverride: releaseActive ? 'release' : null,
        scope: inactiveScope,
        policy: { ...inactiveDecision.policySummary, coolingCurve: coolingCurvePlan.coolingCurve },
        dispatch: inactiveDecision.dispatchDecision,
        trace: inactiveDecision.trace,
        previousEnvelopeState,
        previousRevision,
        forceSnapshot,
        mainEnabled: false,
      });
      return {
        ...inactiveRuntimeSnapshot,
        releaseReason: assembledInput.releaseReason || null,
        globalSentinelOutcome: assembledInput.globalSentinelOutcome || null,
        activityDay,
        ...(includeGoalEpisodeSettings ? { goalEpisodeSettings: rawInput.settingsSnapshot } : {}),
        telemetryContext: { ...telemetryContext, coolingCurve: coolingCurvePlan.coolingCurve },
      };
    }

    const preparedEvaluation = runtimeDecisionService.prepareEvaluation({
      hostname: normalizedHostname,
      scope: assembledInput.scope,
      rulesMode: assembledInput.rulesMode,
      siteGoalMeta: assembledInput.siteGoalMeta,
      capState: assembledInput.capState,
      isHardBlockWindow: assembledInput.isHardBlockWindow,
      isAllowedWindow: assembledInput.isAllowedWindow,
      profile: assembledInput.profile,
      profileMetadata: assembledInput.profileMetadata,
      statsCache: assembledInput.statsCache,
      domainActivityMs: assembledInput.domainActivityMs,
      sessionMs: assembledInput.sessionMs,
      pressureSignals: assembledInput.pressureSignals,
      directTriggers: assembledInput.directTriggers,
      now: assembledInput.now,
      revision: decisionRevision,
      coolingCurve: assembledInput.coolingCurve,
    });
    const engineResult = protectionEngine.evaluate(preparedEvaluation.engineInput);
    const finalizedEvaluation = runtimeDecisionService.finalizeEvaluation({
      preparedEvaluation,
      engineResult,
    });
    const coolingCurvePlan = readCoolingCurvePlan(assembledInput, activityDay, engineResult.observation);
    if (finalizedEvaluation.policySummary.globalCapExceeded === true) {
      runtimeModifiers.push(createFilterIntensityModifier({
        id: 'global_target_overrun',
        source: FRICTION_MODIFIER_SOURCES.FURIN_OVERRUN,
        scope: { kind: FRICTION_MODIFIER_SCOPE_KINDS.GLOBAL_SESSION },
        target: { kind: FRICTION_MODIFIER_TARGETS.ADJUSTABLE_FILTERS },
        delta: 1,
        priority: FRICTION_MODIFIER_PRIORITIES.FURIN_OVERRUN,
      }));
    }

    runtimeStateCoordinator.noteStrategySnapshot({
      hostname: normalizedHostname,
      strategy: engineResult.strategy,
      observation: engineResult.observation,
      now: assembledInput.now,
    });
    const effectiveness = runtimeStateCoordinator.getStrategyEffectivenessSnapshot({
      hostname: normalizedHostname,
    });
    const recovery = recoveryFlowResolver.resolve({
      host: normalizedHostname,
      strategy: engineResult.strategy,
      effectiveness,
    });

    const runtimeSnapshot = runtimeSnapshotBuilder.build({
      hostname: normalizedHostname,
      profile: finalizedEvaluation.effectiveProfile,
      plan: engineResult.plan,
      baseFilters: assembledInput.baseFilters,
      runtimeModifiers,
      coolingCurvePlan,
      coolingCurveApplicationOverride: assembledInput.globalSentinelOutcome?.protectionMode === 'max_filter' ? 'max_filter' : null,
      canonicalArtifacts: assembledInput.profileMetadata?.canonicalArtifacts || null,
      scope: assembledInput.scope,
      policy: { ...finalizedEvaluation.policySummary, coolingCurve: coolingCurvePlan.coolingCurve },
      dispatch: finalizedEvaluation.dispatchDecision,
      trace: finalizedEvaluation.trace,
      previousEnvelopeState,
      previousRevision,
      forceSnapshot,
      strategy: engineResult.strategy,
      recovery,
      effectiveness,
    });

    runtimeSnapshot.telemetryContext = { ...telemetryContext, coolingCurve: coolingCurvePlan.coolingCurve };
    runtimeSnapshot.activityDay = activityDay;
    if (includeGoalEpisodeSettings) runtimeSnapshot.goalEpisodeSettings = rawInput.settingsSnapshot;

    runtimeStateCoordinator.setProtectionRuntimeSnapshot({
      hostname: normalizedHostname,
      plan: runtimeSnapshot.plan,
      observation: engineResult.observation,
      revision: runtimeSnapshot.envelopeResult.revision,
      strategy: engineResult.strategy,
      recovery,
      effectiveness,
      coolingCurve: coolingCurvePlan.coolingCurve,
    });
    return runtimeSnapshot;
  }

  function getProtectionRuntimeSnapshot({ hostname } = {}) {
    return runtimeStateCoordinator.getProtectionRuntimeSnapshot({ hostname });
  }

  function prepareFeedFlowSnapshot({
    hostname = '',
    tabId = null,
    documentId = null,
    snapshot = null,
  } = {}) {
    return runtimeStateCoordinator.prepareFeedFlowSnapshot({
      hostname,
      tabId,
      documentId,
      snapshot,
    });
  }

  function commitFeedFlowSnapshot(prepared) {
    return runtimeStateCoordinator.commitFeedFlowSnapshot(prepared);
  }

  async function getProtectionRuntimeTelemetryContext({
    hostname,
    now = Date.now(),
    filterSettings = null,
    capStateOverride = null,
  } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return null;

    const rawInput = await runtimeInputProvider.provideRuntimeInput(normalizedHostname, {
      now,
      filterSettings,
      capStateOverride,
    });
    const assembledInput = runtimeInputAssembler.assembleRuntimeInput(rawInput);
    const telemetryContext = buildProtectionRuntimeTelemetryContext({
      rawInput,
      assembledInput,
    });
    if (typeof readProfileGeneration !== 'function') throw new Error('TRACKING_PROTECTION_GOAL_SUMMARY_GENERATION_OWNER_REQUIRED');
    const activityDay = projectRuntimeActivityDay(rawInput.statsSnapshot, normalizedHostname);
    const coolingCurvePlan = readCoolingCurvePlan(assembledInput, activityDay);
    const settings = rawInput.settingsSnapshot;
    const profileGeneration = await readProfileGeneration();
    if (typeof profileGeneration !== 'string' || !profileGeneration.trim()) throw new Error('TRACKING_PROTECTION_GOAL_SUMMARY_GENERATION_INVALID');
    const isProtected = assembledInput.scope.isBlockedDomain === true;
    const applying = assembledInput.scope.ok === true && isProtected && !assembledInput.releaseReason;
    const flarePreference = assembledInput.profile?.artifacts?.sentinelFlare;
    const flareEligible = flarePreference?.enabled === true && flarePreference.autoTrigger === true;
    const siteTargetMs = assembledInput.profileMetadata === undefined ? 0
      : assembledInput.profileMetadata.siteGoalMinutes * 60_000;
    const cap = assembledInput.capState;
    if (typeof readGoalEndState !== 'function') throw new Error('TRACKING_PROTECTION_GOAL_SUMMARY_STATE_OWNER_REQUIRED');
    const state = await readGoalEndState();
    const isBindingCurrent = binding => binding.profileGeneration === profileGeneration
      && binding.hostname === normalizedHostname
      && binding.dateStr === activityDay.dateStr && binding.resetHour === activityDay.resetHour
      && (binding.siteTargetMs === null || binding.siteTargetMs === siteTargetMs)
      && (binding.globalTargetMs === null || binding.globalTargetMs === cap.globalGoalMs)
      && binding.policySignature === projectGoalEpisodePolicySignature({
        hostname: normalizedHostname, coveredScopes: binding.coveredScopes, settings,
        protected: isProtected, applying, flareEligible,
      });
    return { ...telemetryContext, coolingCurve: coolingCurvePlan.coolingCurve, goalEndSummary: buildGoalEndSummary({
      hostname: normalizedHostname, dateStr: activityDay.dateStr, resetHour: activityDay.resetHour, now,
      profileGeneration,
      siteTargetMs, siteActiveMs: activityDay.activeMs,
      globalTargetMs: cap.globalGoalMs, globalActiveMs: cap.blockedTodayMs,
      enabled: { site: isGoalEndEnabled(settings.nudgeConfig, 'site') && flareEligible,
        global: isGoalEndEnabled(settings.nudgeConfig, 'global') && flareEligible },
      recording: { site: resolveDomainUsageRecording(normalizedHostname, settings).enabled,
        global: resolveSitesRecordingPolicy(settings).globalCapAvailable },
      protected: isProtected && applying, state, isBindingCurrent,
    }) };
  }

  async function refreshProtectionRuntimeSnapshot({ hostname, now = Date.now() } = {}) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return null;
    await resolveProtectionRuntime(normalizedHostname, { now });
    return runtimeStateCoordinator.getProtectionRuntimeSnapshot({ hostname: normalizedHostname });
  }

  function applyGateInterventionDecision(payload = {}) {
    return runtimeStateCoordinator.applyGateInterventionDecision(payload);
  }
  const getGateEntryApproval = () => runtimeStateCoordinator.getGateEntryApproval();
  const releaseGateEntryApprovalForQa = (payload) => runtimeStateCoordinator.releaseGateEntryApprovalForQa(payload);

  function recordGateInterventionShown(payload = {}) {
    return runtimeStateCoordinator.recordGateInterventionShown(payload);
  }

  function recordRecoveryPresented(payload = {}) {
    return runtimeStateCoordinator.recordRecoveryPresented(payload);
  }

  function recordRecoveryOutcome(payload = {}) {
    const recoveryResult = runtimeStateCoordinator.recordRecoveryOutcome(payload);
    const entry = recoveryResult?.entry || null;
    const resolvedHost = recoveryResult?.hostname || '';
    if (!entry || !resolvedHost || !recoveryResult.runtime) {
      return entry;
    }

    const effectiveness = recoveryResult.effectiveness
      || runtimeStateCoordinator.getStrategyEffectivenessSnapshot({ hostname: resolvedHost });
    runtimeStateCoordinator.setProtectionRuntimeSnapshot({
      hostname: resolvedHost,
      plan: recoveryResult.runtime.plan,
      observation: recoveryResult.runtime.observation,
      revision: recoveryResult.runtime.revision,
      strategy: recoveryResult.runtime.strategy,
      recovery: recoveryFlowResolver.resolve({
        host: resolvedHost,
        strategy: recoveryResult.runtime.strategy,
        effectiveness,
      }),
      effectiveness,
      coolingCurve: recoveryResult.runtime.coolingCurve,
    });
    return entry;
  }

  function getStrategyEffectivenessSnapshot({ hostname = '' } = {}) {
    return runtimeStateCoordinator.getStrategyEffectivenessSnapshot({ hostname });
  }

  return {
    getGlobalCapState,
    readCoolingCurveRuntimeState,
    readProtectedTabInventory: (options) => runtimeInputProvider.readProtectedTabInventory(options),
    observeGateSitePresence: (options) => runtimeInputProvider.observeGateSitePresence(options),
    prepareFeedFlowSnapshot,
    commitFeedFlowSnapshot,
    getProtectionRuntimeSnapshot,
    getProtectionRuntimeTelemetryContext,
    refreshProtectionRuntimeSnapshot,
    resolveProtectionRuntime,
    applyGateInterventionDecision,
    getGateEntryApproval,
    releaseGateEntryApprovalForQa,
    recordGateInterventionShown,
    recordRecoveryPresented,
    recordRecoveryOutcome,
    getStrategyEffectivenessSnapshot,
  };
}
