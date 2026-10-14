import { toggleClass } from '../visual/index.js';
import { tRuntime } from '../../settings/i18n/runtime.js';
import {
  clearPublishedSentinelTelemetry,
  createInitialSentinelHudTelemetryText,
  formatSentinelHudTelemetryText,
  publishSentinelTelemetrySnapshot,
  resolveSentinelHudTelemetrySnapshot,
  SENTINEL_TELEMETRY_GLOBAL_KEY,
} from '../nudge/nudgeGameHudTelemetry.js';
import {
  setSentinelHudText,
  updateSentinelHud,
} from '../nudge/nudgeGameHud.js';
import {
  resolveSentinelProtocolProgressPresentation,
  shouldShowSentinelRitualGuide,
} from '../nudge/sentinelProtocolPresentation.js';
import { resolveNudgeScenePresentation } from '../nudge/nudgeGameScene.js';
import { applySentinelThemePresentation } from '../nudge/nudgeGameThemePresentation.js';
import { applySentinelRitualProgressDom } from './SentinelProtocolPresentationAdapter.js';
import { GLOBAL_SENTINEL_GAME_PHASES } from '../nudge/nudgeGameGlobalSentinelProtocol.js';

export function createSentinelProtocolPresentationController({
  buildStamp = '',
  getRefs = () => ({}),
  getConfig = () => ({}),
  getRuntimeContext = () => null,
  getActiveThemeId = () => '',
  getActiveTheme = () => null,
  getRuntimeStage = () => '',
  getHudRuntimeContext = () => null,
  getLastRuntimeError = () => '',
  getStartedAtMs = () => 0,
  getScenePhase = () => '',
  isModalOpen = () => false,
  isWorkerRuntimeActive = () => false,
  getWorkerRuntimeStatsSnapshot = () => null,
  getWorkerRuntimeTelemetrySnapshot = () => null,
  getMainRuntimeStats = () => ({}),
  resolveActiveProtocolProgress = () => ({}),
  isProtocolInputRuntimeReady = () => true,
  createDefaultConfig = () => ({}),
  syncRenderOptions = (presentation) => presentation,
  applyRuptureRevealPresentation = () => false,
} = {}) {
  let ritualGuideWakeProgress = 0;
  let lastHudUpdateAt = 0;
  let telemetryConsoleAnnounced = false;
  let telemetryPublication = null;

  function resolveRitualText(progress) {
    const activeThemeId = getActiveThemeId();
    const options = {
      context: activeThemeId,
      progressPercent: Math.round((Number(progress.returnProgress) || 0) * 100),
      seconds: Math.ceil(Math.max(0, Number(progress.remainingMs) || 0) / 1000),
      syncPercent: Math.round((Number(progress.syncLevel) || 0) * 100),
    };
    if (progress.protocolScope === 'global') {
      const outcomeAnnouncementKey = progress.failed === true
        ? 'global_sentinel_outcome_failure'
        : (progress.completed === true ? 'global_sentinel_outcome_success' : '');
      const outcomeAnnouncement = progress.failed === true
        ? tRuntime('tools:sentinel_flare_protocol.global_sentinel_outcome_failure_announcement', options)
        : (progress.completed === true
          ? tRuntime('tools:sentinel_flare_protocol.global_sentinel_outcome_success_announcement', options)
          : '');
      const body = progress.failed
        ? tRuntime('tools:sentinel_flare_protocol.global_sentinel_failed', options)
        : (progress.ready
          ? tRuntime('tools:sentinel_flare_protocol.global_sentinel_ready', options)
          : (progress.completed
            ? tRuntime('tools:sentinel_flare_protocol.global_sentinel_hold', options)
            : tRuntime('tools:sentinel_flare_protocol.global_sentinel_step', options)));
      const globalActionLabel = progress.gamePhase === GLOBAL_SENTINEL_GAME_PHASES.AWAITING_START
        ? tRuntime('tools:sentinel_flare_protocol.global_sentinel_action_start', options)
        : tRuntime('tools:sentinel_flare_protocol.global_sentinel_action_repair', options);
      return {
        title: tRuntime('tools:sentinel_flare_protocol.global_sentinel_title', { context: activeThemeId }),
        body,
        globalActionLabel,
        outcomeAnnouncement,
        outcomeAnnouncementKey,
      };
    }

    return { title: tRuntime('tools:sentinel_flare_protocol.site_furin_chime_label'),
      body: tRuntime('tools:sentinel_flare_protocol.site_furin_chime_caption'), hint: '', siteActionLabel: '' };
  }

  function resolveSiteFurinCompletionMessage() {
    return { title: tRuntime('tools:sentinel_flare_protocol.site_furin_chime_complete_title'),
      body: tRuntime('tools:sentinel_flare_protocol.site_furin_chime_complete_body'),
      systemTag: 'FURIN',
      primaryCta: tRuntime('tools:sentinel_flare_protocol.site_furin_chime_leave'), primaryDesc: '',
      secondaryCta: tRuntime('tools:sentinel_flare_protocol.site_furin_chime_continue'), secondaryDesc: '' };
  }

  function isHudVisible() {
    return getConfig()?.hudVisible === true;
  }

  function updateRitualPresentation() {
    const refs = getRefs();
    if (!refs.root || !refs.scene) return;
    const progress = resolveActiveProtocolProgress();
    const presentation = resolveSentinelProtocolProgressPresentation(progress, {
      globalActionReady: isProtocolInputRuntimeReady(),
      siteActionReady: isProtocolInputRuntimeReady(),
    });
    const ritualGuideVisible = shouldShowSentinelRitualGuide({
      progress,
      hudVisible: isHudVisible(),
    });
    const result = applySentinelRitualProgressDom({
      ...refs,
      modalOpen: isModalOpen(),
      progress,
      text: resolveRitualText(progress),
      presentation,
      ritualGuideVisible,
      guideWakeProgress: ritualGuideWakeProgress,
      applyRuptureReveal: () => applyRuptureRevealPresentation(Date.now()),
    });
    ritualGuideWakeProgress = result.guideWakeProgress;
  }

  function applyHudPresentation() {
    const refs = getRefs();
    const visible = isHudVisible();
    if (refs.scene) toggleClass(refs.scene, 'is-hud-visible', visible);
    if (refs.hud) {
      refs.hud.hidden = !visible;
      refs.hud.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }
  }

  function applyProtocolPresentation() {
    const config = getConfig();
    const presentation = syncRenderOptions(resolveNudgeScenePresentation({
      config,
      phase: getScenePhase(),
    }));
    const refs = getRefs();
    if (!refs.root) return;
    if (refs.scene) {
      for (const [className, enabled] of Object.entries(presentation.sceneClasses)) {
        toggleClass(refs.scene, className, enabled);
      }
    }
    for (const [name, value] of Object.entries(presentation.styleVars)) {
      refs.root.style.setProperty(name, value);
    }
    updateRitualPresentation();
    applyHudPresentation();
  }

  function applyThemeVars(theme = getActiveTheme()) {
    const refs = getRefs();
    if (applySentinelThemePresentation({
      root: refs.root,
      scene: refs.scene,
      theme,
      activeThemeId: getActiveThemeId(),
    })) {
      applyProtocolPresentation();
    }
  }

  function setHudText(protocol) {
    const refs = getRefs();
    setSentinelHudText({
      protocol,
      defaults: createDefaultConfig(getRuntimeContext()),
      ...refs,
      activeThemeId: getActiveThemeId(),
      buildStamp,
      protocolScope: getConfig()?.protocolScope,
      translate: tRuntime,
      createInitialTelemetryText: createInitialSentinelHudTelemetryText,
    });
  }

  function resolveHudTelemetrySnapshot() {
    const stats = getMainRuntimeStats();
    return resolveSentinelHudTelemetrySnapshot({
      workerRuntimeActive: isWorkerRuntimeActive(),
      getWorkerRuntimeStatsSnapshot,
      getWorkerRuntimeTelemetrySnapshot,
      activeThemeId: getActiveThemeId(),
      renderPressureLevel: stats.renderPressureLevel,
      renderBudgetPolicyId: stats.renderBudgetPolicyId,
      entityCount: stats.liveCount,
      totalSpawned: stats.totalSpawned,
      totalSplitSpawned: stats.totalSplitSpawned,
      globalSentinelStats: stats,
    });
  }

  function formatHudTelemetryText(syncPercent, protocolProgress = null) {
    const refs = getRefs();
    return formatSentinelHudTelemetryText({
      syncPercent,
      protocolProgress,
      snapshot: resolveHudTelemetrySnapshot(),
      activeThemeId: getActiveThemeId(),
      activeTheme: getActiveTheme(),
      runtimeStage: getRuntimeStage(),
      sceneClassName: refs.scene?.className || '',
      lastRuntimeError: getLastRuntimeError(),
      runtimeContext: getHudRuntimeContext(),
      translate: tRuntime,
    });
  }

  function publishTelemetry(syncPercent) {
    const result = publishSentinelTelemetrySnapshot({
      telemetryGlobalKey: SENTINEL_TELEMETRY_GLOBAL_KEY,
      syncPercent,
      snapshot: resolveHudTelemetrySnapshot(),
      activeThemeId: getActiveThemeId(),
      startedAt: getStartedAtMs(),
      telemetryConsoleAnnounced,
    });
    telemetryConsoleAnnounced = result.telemetryConsoleAnnounced;
    telemetryPublication = {
      type: 'publish',
      published: result.published,
      error: result.error,
      warningError: result.warningError,
    };
  }

  function updateHud(syncLevel) {
    if (!isHudVisible()) {
      lastHudUpdateAt = Date.now();
      return;
    }
    const refs = getRefs();
    lastHudUpdateAt = updateSentinelHud({
      syncLevel,
      protocolProgress: resolveActiveProtocolProgress({ now: Date.now() }),
      lastHudUpdateAt,
      updateIntervalMs: getHudRuntimeContext()?.entry?.active === true ? 50 : 200,
      ...refs,
      activeThemeId: getActiveThemeId(),
      translate: tRuntime,
      formatTelemetryText: formatHudTelemetryText,
      publishTelemetrySnapshot: publishTelemetry,
    });
  }

  function clearPublishedTelemetry() {
    telemetryPublication = {
      type: 'clear',
      ...clearPublishedSentinelTelemetry({
        telemetryGlobalKey: SENTINEL_TELEMETRY_GLOBAL_KEY,
      }),
    };
  }

  function resetSession({ clearTelemetry = false } = {}) {
    ritualGuideWakeProgress = 0;
    lastHudUpdateAt = 0;
    telemetryConsoleAnnounced = false;
    if (clearTelemetry) clearPublishedTelemetry();
  }

  return {
    resolveSiteFurinCompletionMessage,
    updateRitualPresentation,
    applyHudPresentation,
    applyProtocolPresentation,
    applyThemeVars,
    setHudText,
    resolveHudTelemetrySnapshot,
    formatHudTelemetryText,
    updateHud,
    clearPublishedTelemetry,
    resetSession,
    resetRitual: () => {
      ritualGuideWakeProgress = 0;
    },
    resetTelemetryConsole: () => {
      telemetryConsoleAnnounced = false;
    },
    setLastHudUpdateAt: (value) => {
      lastHudUpdateAt = Number(value) || 0;
    },
    getTelemetryPublication: () => telemetryPublication,
  };
}
