import { installDashboardBootInteractionProbe } from './dashboardBootInteractionProbe.mjs';
import { commitDashboardCaptureLocale } from './dashboardCaptureLocale.mjs';
import { runDashboardSettingsProtectionCapture } from './dashboardSettingsProtectionCapture.mjs';
import { FIRST_SITE_FIXTURE_DOMAIN, FIRST_SITE_TEMPORARY_MANIFEST,
  prepareDashboardFirstSiteJourney, runDashboardFirstSiteJourney } from './dashboardFirstSiteJourney.mjs';
import { observeDashboardRegistrationTiming } from './dashboardRegistrationTimingProbe.mjs';
import { buildSiteRegistrationPath } from '../../../src/lib/firstSiteRegistrationIntent.js';
import { startDashboardBootRenderTrace } from './dashboardBootRenderTrace.mjs';
import { readDashboardGpuInfoCollectionEvidence, requireDashboardGpuInfoCollectionResearch } from './dashboardBootGpuInfoCollectionProbe.mjs';
import { createDashboardCpuProfileEvidenceWriter } from './dashboardBootCpuProfileEvidence.mjs';
import { projectDashboardBootModelTimingEvidence } from './dashboardBootModelTimingEvidence.mjs';
import { activateDashboardArtifactMotion, runDashboardArtifactJourney } from './dashboardArtifactJourney.mjs';
import { artifactGallerySelection } from './dashboardArtifactGallerySelection.mjs';
import { runDashboardArtifactEntryJourney } from './dashboardArtifactEntryJourney.mjs';
import { requireArtifactRuntimeDisclosure, runDashboardArtifactRuntimeJourney } from './dashboardArtifactRuntimeJourney.mjs';
import { captureArtifactUiCpuProfile } from './dashboardArtifactUiEntryDiagnostics.mjs';
import { openDashboardPondLab, runDashboardPondLabJourney } from './dashboardPondLabJourney.mjs';
import { requireMainReturnJourney, runDashboardMainReturnJourney } from './dashboardMainReturnJourney.mjs';
import { runDashboardDevelopmentToolsJourney } from './dashboardDevelopmentToolsJourney.mjs';
import { runDashboardBonsaiDebugJourney } from './dashboardBonsaiDebugJourney.mjs';
import { preparePressureRailLedgerFixture, requirePressureRailJourney, runDashboardPressureRailJourney } from './dashboardPressureRailJourney.mjs';
import { prepareSitesRecordingJourney, requireSitesRecordingScenario, runDashboardSitesRecordingJourney,
  runDashboardSitesObservedReadingRefreshJourney } from './dashboardSitesRecordingJourney.mjs';
import { runDashboardSitesIntelJourney } from './dashboardSitesIntelJourney.mjs';
import { requireDashboardBonsaiRenderIdentity, requireDashboardBonsaiJourneyRenderIdentity } from '../contracts/dashboardBonsaiRenderIdentity.mjs';
import { projectDashboardBonsaiResizeFrame } from '../contracts/dashboardBonsaiResizeFrameContract.mjs';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { normalizeSchedule } from '../../../src/apps/dashboard/tabs/schedule/scheduleModel.js';

import {
  buildZenMainCaptureSearch,
  normalizeZenMainCaptureInput,
  ZEN_MAIN_CAPTURE_DEVELOPMENT_TOOLS_PARAM,
} from '../../../src/apps/dashboard/qa/zenMainCaptureProfileContract.js';
import { PROGRESSION_DEBUG_ACTIONS } from '../../../src/domains/progression/debug/progressionDebugActions.dev.js';
import { PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT } from '../../../src/domains/progression/policy/progressionPreviewPolicy.js';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { MODEL_STATE_INITIAL_PROFILE_EPOCH } from '../../../src/platform/storage/model/ProfileEpochContract.js';
import {
  LOCAL_ANALYSIS_PROFILE_IDS,
  RECOMMENDED_LOCAL_ANALYSIS_PROFILE_PATCH,
} from '../../../src/domains/settings/config/localAnalysisProfilePolicy.js';
import {
  ENTROPY_QA_TRUSTED_PAGE_PATH,
} from '../../e2e/qaProfileArtifactSlot.mjs';
import {
  ExtensionChromiumHarness,
  evaluate,
  sleep,
  waitForPageReady,
} from '../../e2e/extensionChromiumHarness.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';
import { serializeQaError } from '../contracts/qaEvidenceContract.mjs';
import {
  classifyDashboardCaptureHealth,
  createDashboardPageDiagnostics,
} from './dashboardCaptureDiagnostics.mjs';
import {
  readDashboardBootArtifactGraph,
} from './dashboardBootArtifactDiagnostics.mjs';
import {
  installDashboardPostRevealProbe,
  collectDashboardPostRevealProbe,
  requireDashboardPostRevealOptions,
} from './dashboardBootPostRevealProbe.mjs';
import {
  projectDashboardEntryStageTrace,
  requireDashboardEntryStageTraceProjection,
} from '../../../src/apps/dashboard/bootstrap/dashboardEntryStageTraceContract.js';
import { ensureQaSecurityVaultReady } from './securityVaultQaFixture.mjs';

import { MAX_ZEN_APP_PETALS } from '../../../src/themes/plugins/zen/runtime/petals/zenAppPetalBudget.js';

import {
  DEFAULT_DASHBOARD_CAPTURE_VIEWPORT,
  resolveDashboardCaptureViewport,
  matchesDashboardCaptureViewport,
  buildDashboardResizeEvidence,
  isCurrentDashboardPondViewport,
} from '../contracts/dashboardCaptureViewportContract.mjs';

const DASHBOARD_CAPTURE_VIEWPORT = resolveDashboardCaptureViewport(DEFAULT_DASHBOARD_CAPTURE_VIEWPORT);
const READY_TIMEOUT_MS = 60_000;
const BOOT_PROBE_TIMEOUT_MS = 45_000;
const DASHBOARD_CAPTURE_SURFACES = Object.freeze({
  main: Object.freeze({ tabId: 'main' }),
  artifacts: Object.freeze({ tabId: 'tools' }),
  sites: Object.freeze({ tabId: 'sites' }),
  schedule: Object.freeze({ tabId: 'schedule' }),
  settings: Object.freeze({ tabId: 'settings' }),
  'pond-lab': Object.freeze({ tabId: 'experiment' }),
});
const DASHBOARD_CAPTURE_THEME_IDS = new Set([
  'matrix',
  'entropy',
  'cyberpunk',
  'clinical',
  'scp',
  'zen',
]);
const DASHBOARD_PROTOCOL_OPERATIONS = new Set(['boot_probe', 'capture']);
const DASHBOARD_BOOT_ARTIFACT_PREPARATION_POLICY =
  'prepare_built_artifact_in_fresh_owned_browser_before_measurement';
const SCHEDULE_CAPTURE_FIXTURE = normalizeSchedule({
  days: [0, 1, 2, 3, 4, 5, 6],
  blocks: [
    { id: 'qa-evening', name: '저녁의 여백', intent: 'relaxation', days: [1, 2, 3, 4, 5], startMin: 1200, endMin: 1350 },
    { id: 'qa-writing', name: '고요한 작업', intent: 'isolation', days: [1, 2, 3, 4, 5], startMin: 540, endMin: 660 },
    { id: 'qa-afternoon', name: '오후의 여백', intent: 'relaxation', days: [0, 6], startMin: 780, endMin: 900 },
  ],
}).schedule;

function requireDashboardProtocolOperation(value) {
  if (!DASHBOARD_PROTOCOL_OPERATIONS.has(value)) {
    throw new Error(`QA_DASHBOARD_CAPTURE_OPERATION_INVALID:${String(value)}`);
  }
  return value;
}

function requireDashboardCaptureSurface(value) {
  const surface = DASHBOARD_CAPTURE_SURFACES[value];
  if (!surface) {
    throw new Error(`QA_DASHBOARD_CAPTURE_SURFACE_INVALID:${String(value)}`);
  }
  return Object.freeze({ id: value, ...surface });
}

function requireDashboardCaptureThemeId(value) {
  if (!DASHBOARD_CAPTURE_THEME_IDS.has(value)) {
    throw new Error(`QA_DASHBOARD_CAPTURE_THEME_INVALID:${String(value)}`);
  }
  return value;
}

export function resolveDashboardBootArtifactPreparationPolicy(artifact) {
  if (
    artifact?.id !== 'dev_extension'
    || artifact.status !== 'ready'
    || !['built_for_run', 'reused'].includes(artifact.ownership)
  ) {
    throw new Error('QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_CONTRACT_INVALID');
  }
  const required = artifact.ownership === 'built_for_run';
  return Object.freeze({
    contractVersion: 1,
    policyId: DASHBOARD_BOOT_ARTIFACT_PREPARATION_POLICY,
    artifactOwnership: artifact.ownership,
    required,
    reasonCode: required
      ? 'QA_DASHBOARD_BOOT_ARTIFACT_BUILT_FOR_RUN'
      : 'QA_DASHBOARD_BOOT_ARTIFACT_REUSED',
  });
}

export function classifyDashboardBootArtifactPreparationHealth({
  health,
  pageSnapshot,
  gpuCapability,
} = {}) {
  if (health?.status === 'clean') {
    return Object.freeze({
      status: 'clean',
      reasonCode: 'QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_HEALTH_CLEAN',
    });
  }
  const issues = Array.isArray(health?.issues) ? health.issues : [];
  const onlyIssue = issues.length === 1 ? issues[0] : null;
  const details = onlyIssue?.details;
  const boot = pageSnapshot?.boot?.snapshot;
  const softwareVisualWaitOnly = (
    gpuCapability?.activeRendererClass === 'software'
    && onlyIssue?.code === 'dashboard_boot_degraded'
    && details?.status === 'ready'
    && details?.phase === 'ready'
    && details?.themeShellDegraded === false
    && details?.mainTabFirstFrameDegraded === false
    && details?.coreWaitBudgetExceeded === false
    && details?.mainTabFirstFrameWaitBudgetExceeded === true
    && boot?.status === 'ready'
    && boot?.dismissible === true
    && boot?.themeReady === true
    && boot?.coreReady === true
    && boot?.mainTabFirstFrameReady === true
    && boot?.forcedVisualRelease !== true
    && Array.isArray(boot?.errors)
    && boot.errors.length === 0
  );
  if (softwareVisualWaitOnly) {
    return Object.freeze({
      status: 'accepted_software_visual_wait',
      reasonCode:
        'QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_SOFTWARE_VISUAL_WAIT_ONLY',
    });
  }
  return Object.freeze({
    status: 'failed',
    reasonCode: 'QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_HEALTH_FAILED',
  });
}

function createSingleRelease(release) {
  let releasePromise = null;
  return () => {
    releasePromise ||= Promise.resolve().then(release);
    return releasePromise;
  };
}

async function sendTrustedRuntimeMessage(harness, message) {
  const delivery = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
    chrome.runtime.sendMessage(${JSON.stringify(message)}, (response) => {
      resolve({
        error: chrome.runtime.lastError?.message || null,
        response: response || null,
      });
    });
  })`);
  if (delivery?.error) {
    throw new Error(`QA_DASHBOARD_CAPTURE_RUNTIME_MESSAGE_FAILED:${delivery.error}`);
  }
  return delivery?.response;
}

async function prepareDashboardCaptureState(harness, { surfaceId, themeId, zenMainProfile, artifactRuntimeJourney = false }) {
  const securityVault = await ensureQaSecurityVaultReady(harness, {
    passphrase: `Entropy dashboard QA ${randomUUID()}`,
  });
  const recommendedProfile = RECOMMENDED_LOCAL_ANALYSIS_PROFILE_PATCH;
  const themeResponse = await sendTrustedRuntimeMessage(harness, {
    action: MESSAGE_ACTIONS.SET_SETTINGS,
    items: {
      'app-theme': themeId,
      ...recommendedProfile,
    },
  });
  if (
    themeResponse?.success !== true
    || themeResponse?.committedItems?.['app-theme'] !== themeId
    || Object.entries(recommendedProfile).some(([key, value]) => (
      themeResponse?.committedItems?.[key] !== value
    ))
  ) {
    throw new Error(
      `QA_DASHBOARD_CAPTURE_THEME_COMMIT_FAILED:${themeResponse?.error || 'ack_invalid'}`,
    );
  }

  if (surfaceId === 'sites') {
    await sendTrustedRuntimeMessage(harness, {
      action: MESSAGE_ACTIONS.UPSERT_SITE_RULE,
      domain: 'youtube.com',
      type: 'blocked',
      goalMinutes: 30,
    });
    await sendTrustedRuntimeMessage(harness, {
      action: MESSAGE_ACTIONS.UPSERT_SITE_RULE,
      domain: 'x.com',
      type: 'blocked',
      goalMinutes: 15,
    });
  }

  if (surfaceId === 'schedule') {
    const response = await sendTrustedRuntimeMessage(harness, {
      action: MESSAGE_ACTIONS.SET_SETTINGS,
      items: { relaxationSchedule: SCHEDULE_CAPTURE_FIXTURE },
    });
    if (response?.success !== true || !isDeepStrictEqual(response.committedItems?.relaxationSchedule, SCHEDULE_CAPTURE_FIXTURE)) {
      throw new Error('QA_DASHBOARD_SCHEDULE_FIXTURE_COMMIT_FAILED');
    }
  }

  const progressionDayCount = artifactRuntimeJourney ? 5 : themeId === 'zen'
    ? zenMainProfile?.bonsaiDayCount ?? 5
    : null;
  if (progressionDayCount === null) {
    return Object.freeze({
      theme: themeId,
      securityVault,
      localAnalysisProfile: LOCAL_ANALYSIS_PROFILE_IDS.RHYTHM_MAP,
      zenMainProfile: null,
    });
  }

  const progressionResponse = await sendTrustedRuntimeMessage(harness, {
    action: PROGRESSION_DEBUG_ACTIONS.SET_UNLOCK_DAY,
    dayCount: progressionDayCount,
    profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH,
  });
  const unlock = progressionResponse?.snapshot?.unlockProgress;
  if (
    progressionResponse?.success !== true
    || progressionResponse.profileGeneration !== MODEL_STATE_INITIAL_PROFILE_EPOCH
    || unlock?.source !== 'debug_override'
    || unlock?.qualifiedUseDayCount !== progressionDayCount
    || unlock?.bonsaiRelease?.qualifiedUseDayCount !== progressionDayCount
  ) {
    throw new Error(
      `QA_DASHBOARD_CAPTURE_BONSAI_COMMIT_FAILED:${progressionResponse?.error || 'ack_invalid'}`,
    );
  }
  const artifactDisclosure = artifactRuntimeJourney
    ? requireArtifactRuntimeDisclosure(progressionResponse.snapshot) : null;
  return Object.freeze({
    theme: themeId,
    securityVault,
    localAnalysisProfile: LOCAL_ANALYSIS_PROFILE_IDS.RHYTHM_MAP,
    zenMainProfile: zenMainProfile?.profileId ?? null,
    bonsaiDayCount: unlock.qualifiedUseDayCount,
    bonsaiRelease: unlock.bonsaiRelease,
    artifactDisclosure,
  });
}

async function configurePage(harness, page, viewport) {
  await harness.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: false,
  }, page.sessionId);
  await harness.cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  }, page.sessionId);
}

function createDashboardHarness({
  plan,
  artifact,
  browser,
  recoveryJournal,
  tempPrefix,
  temporaryManifest = null,
  gpuInfoCollectionPolicy = 'browser-default',
}) {
  return new ExtensionChromiumHarness({
    chromePath: browser.chrome,
    distDir: artifact.path,
    rootDir: plan.rootDir,
    headless: plan.browserExecution.headless,
    browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy,
    launchEnvironment: browser.launchEnvironment,
    displayReceipt: browser.display,
    renderingRequirement: plan.browserExecution.renderingRequirement,
    keepTemp: false,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    tempPrefix,
    recoveryJournal,
    temporaryManifest,
    gpuInfoCollectionPolicy,
  });
}

function buildDashboardUrl(harness, searchParams) {
  return (
    `chrome-extension://${harness.extensionId}/src/pages/dashboard.html`
    + `?${searchParams.toString()}`
  );
}

function buildDashboardBootSearchParams(
  zenMainProfile,
  traceMode = 'full',
  gpuTiming = false,
  canopyPreparation = 'native',
) {
  const search = zenMainProfile
    ? buildZenMainCaptureSearch(zenMainProfile)
    : '?tab=main';
  const params = new URLSearchParams(search.slice(1));
  params.set('entropy-qa-boot-trace', traceMode);
  if (gpuTiming) params.set('entropy-qa-gpu-timing', '1');
  if (canopyPreparation === 'before-first-draw') {
    params.set('entropy-qa-canopy-preparation', canopyPreparation);
  }
  return params;
}

async function inspectDashboardCapture(harness, page, request) {
  return evaluate(harness.cdp, page.sessionId, `(() => {
    const request = ${JSON.stringify(request)};
    const frame = document.querySelector('.console-frame');
    const stage = document.querySelector('.zen-home-stage');
    const tabRoot = request.surfaceId === 'schedule' ? document.querySelector('[data-schedule-tab]') : document.getElementById(request.tabId)
      || document.getElementById(request.tabId + '-tab');
    const pondLab = document.querySelector('[data-pond-lab]');
    const pondSurface = request.surfaceId === 'pond-lab' ? pondLab : document.querySelector('[data-main-presentation-surface="pond"]');
    const pondCanvas = pondSurface?.querySelector('canvas');
    const bonsaiSurface = document.querySelector('[data-main-presentation-surface="bonsai"]');
    const bonsaiCanvas = bonsaiSurface?.querySelector('canvas[data-main-canvas-presentation-ready="true"]');
    const pressureRail = document.querySelector('[data-testid="zen-pressure-rail"]');
    const artifactPanel = document.querySelector('[data-artifact-panel-mode]');
    const profile = globalThis.__ENTROPY_ZEN_MAIN_CAPTURE_PROFILE__ || null;
    const pondAck = globalThis.__ZEN_POND_LAST_FIRST_FRAME_ACK__ || null;
    const bootSnapshot = globalThis.__ENTROPY_DASHBOARD_BOOT_SNAPSHOT__ || null;
    const bootTelemetry = globalThis.__ENTROPY_BOOT_TELEMETRY__ || null;
    const zenTrace = globalThis.__ENTROPY_ZEN_RENDER_TRACE__ || null;
    const safeRead = (reader, fallback = null) => {
      if (typeof reader !== 'function') return fallback;
      try { return reader(); } catch (error) {
        return { diagnosticReadError: error?.message || String(error) };
      }
    };
    const normalizeResourceName = (value) => {
      try {
        const url = new URL(value, location.href);
        return url.pathname;
      } catch (_) {
        return String(value || '').split(/[?#]/u, 1)[0];
      }
    };
    const navigationEntry = performance.getEntriesByType?.('navigation')?.[0] || null;
    const resourceEntries = (performance.getEntriesByType?.('resource') || [])
      .map((entry) => ({
        name: normalizeResourceName(entry.name),
        initiatorType: entry.initiatorType || '',
        startTimeMs: Number(entry.startTime.toFixed(2)),
        responseEndMs: Number(entry.responseEnd.toFixed(2)),
        durationMs: Number(entry.duration.toFixed(2)),
        transferSize: Number.isFinite(entry.transferSize) ? entry.transferSize : null,
      }))
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 60);
    const paintEntries = (performance.getEntriesByType?.('paint') || []).map((entry) => ({
      name: entry.name,
      startTimeMs: Number(entry.startTime.toFixed(2)),
    }));
    const rect = (element) => {
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    };
    return {
      href: location.href,
      petalFields: [...document.querySelectorAll('[data-zen-app-petal-field]')].map(canvas => ({
        id: canvas.dataset.petalFieldId,
        mode: canvas.dataset.petalMode,
        landingEnabled: canvas.dataset.petalLandingsEnabled === 'true',
        count: Number(canvas.dataset.petalCount || 0),
        landedCount: Number(canvas.dataset.landedPetalCount || 0),
      textureCount: Number(canvas.dataset.petalTextureCount || 0),
      blurredTextureCount: Number(canvas.dataset.blurredPetalTextureCount || 0),
        status: canvas.dataset.petalStatus,
      })),
      sites: request.surfaceId === 'sites' ? {
        loading: Boolean(document.querySelector('[data-testid="sites-tab-loading"]')),
        mode: document.querySelector('.sites-sites-workspace')?.dataset.mode,
        ledgerVisible: Boolean(document.querySelector('.sites-sites-workspace__registry')?.getClientRects().length),
        detailVisible: Boolean(document.querySelector('#sites-site-detail, #sites-site-detail-empty, .sites-policy-detail')?.getClientRects().length),
        detail: Boolean(document.querySelector('#sites-site-detail, #sites-site-detail-empty, .sites-policy-detail')),
        reading: Boolean(document.querySelector(request.themeId === 'zen'
          ? '#sites-site-detail .zen-site-ledger__viewport[data-view]'
          : '#sites-site-detail [data-intel-state]')),
        alerts: [...document.querySelectorAll('#sites-tab [role="alert"]')].map(node => node.textContent),
      } : null,
      schedule: request.surfaceId === 'schedule' ? {
        appliedMode: document.querySelector('[data-schedule-tab]')?.dataset.scheduleAppliedMode,
        selectedIntent: document.querySelector('[role=radio][aria-checked=true]')?.dataset.scheduleMode,
        modeCount: document.querySelectorAll('[data-schedule-workbench] [role=radio]').length,
        workspace: rect(document.querySelector('[data-schedule-rhythm-workspace]')),
        rhythm: rect(document.querySelector('[data-schedule-rhythm-workspace] [role=tablist]')),
        track: rect(document.querySelector('[data-schedule-time-field]')),
        workbench: rect(document.querySelector('[data-schedule-workbench]')),
        workbenchAnimationsActive: document.querySelector('[data-schedule-workbench]')?.getAnimations()
          .some(animation => animation.pending || animation.playState === 'running'),
        optionsExpanded: document.querySelector('[data-schedule-workbench] button[aria-expanded][aria-controls]')?.getAttribute('aria-expanded') === 'true',
        stageAlignment: (() => {
          const stage = document.querySelector('[data-schedule-time-stage]');
          return stage ? getComputedStyle(stage).justifyContent : null;
        })(),
        expectsTopAlignment: document.querySelector('[data-schedule-rhythm-workspace]')?.dataset.attachedPaper === 'true'
          || document.querySelector('[data-ui-orientation]')?.dataset.uiOrientation === 'portrait'
          || matchMedia('(max-height: 40rem)').matches,
        selected: Boolean(document.querySelector('[data-schedule-workbench][data-workbench-state="selected"]')),
        blocks: [...document.querySelectorAll('[data-schedule-block-id]')].map(node => ({ rect: rect(node), id: node.dataset.scheduleBlockId })),
        controls: [...document.querySelectorAll('[data-schedule-workbench] input, [data-schedule-workbench] button')].map(node => ({
          rect: rect(node), name: node.getAttribute('aria-label') || node.textContent, value: node.value,
        })),
      } : null,
      settings: request.surfaceId === 'settings' ? {
        content: rect(document.getElementById('settings-content-area')),
        reading: rect(document.getElementById('settings-content-area')?.firstElementChild),
        scrollbarGutter: (() => {
          const content = document.getElementById('settings-content-area');
          return content ? getComputedStyle(content).scrollbarGutter : null;
        })(),
        sectionSelected: Boolean(document.querySelector('#settings nav button[aria-current="page"]')),
        sectionId: document.querySelector('#settings nav button[aria-current="page"]')?.dataset.settingsSectionId,
        sectionLoading: Boolean(document.querySelector('[data-settings-section-loading]')),
        scrollTop: document.getElementById('settings-content-area')?.scrollTop,
        scrollHeight: document.getElementById('settings-content-area')?.scrollHeight,
        clientHeight: document.getElementById('settings-content-area')?.clientHeight,
        closedDisclosureCount: document.querySelectorAll('#settings-content-area details:not([open])').length,
        loading: Boolean(document.querySelector('[data-testid="settings-tab-loading"]')),
      } : null,
      viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
      readyState: document.readyState,
      locale: document.documentElement.lang,
      zenTypography: request.themeId === 'zen' ? {
        date: (() => {
          const node = document.querySelector('.zen-rhythm-marker__date');
          return node ? { family: getComputedStyle(node).fontFamily, size: getComputedStyle(node).fontSize } : null;
        })(),
        phase: (() => {
          const node = document.querySelector('.zen-rhythm-marker__phase');
          return node ? { family: getComputedStyle(node).fontFamily, size: getComputedStyle(node).fontSize } : null;
        })(),
        koreanSerifLoaded: [...document.fonts].some(face => face.family === 'Zen Korean Serif Local' && face.status === 'loaded'),
        smallText: [...document.querySelectorAll('.console-shell p, .console-shell span, .console-shell button, .console-shell label, .console-shell summary')]
          .filter(node => node.getClientRects().length && getComputedStyle(node).visibility === 'visible'
            && (!node.closest('details:not([open])') || node.closest('summary'))
            && [...node.childNodes].some(child => child.nodeType === 3 && child.textContent.trim())
            && parseFloat(getComputedStyle(node).fontSize) < (node.matches('button, summary') ? 12 : 11))
          .map(node => ({ text: node.textContent.trim().slice(0, 100), className: node.className, size: getComputedStyle(node).fontSize })),
      } : null,
      theme: document.documentElement.dataset.theme || null,
      captureDataset: document.documentElement.dataset.entropyZenMainCapture || null,
      activeTab: frame?.dataset?.dashboardActiveTab || null,
      ambientPhase: document.querySelector('.console-shell')?.dataset?.zenAmbientPhase || null,
      presentationPhase: document.querySelector('[data-main-presentation-phase]')?.dataset.mainPresentationPhase || null,
      profile,
      pondAck,
      pondLab: pondLab ? { readiness: pondLab.dataset.pondLabReadiness, section: pondLab.dataset.pondLabSection } : null,
      frame: rect(frame),
      sidebar: rect(document.querySelector('.console-sidebar')),
      consoleContent: rect(document.querySelector('.console-content')),
      frameRowGap: frame ? Number.parseFloat(getComputedStyle(frame).rowGap) : null,
      documentViewport: {
        clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      },
      frameOverflow: ['.console-frame', '.console-sidebar', '.sidebar-controls', '.nav-button', '.settings-button', '.panel-transition-wrapper', '.console-content', '.panel-viewport', '.zen-home-frame', '.zen-home-stage'].map(selector => {
        const element = document.querySelector(selector);
        if (!element) return { selector, present: false };
        const style = getComputedStyle(element);
        return {
          selector, present: true, rect: rect(element),
          clientWidth: element.clientWidth, clientHeight: element.clientHeight,
          scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
          overflowX: style.overflowX, overflowY: style.overflowY,
          overflowClipMargin: style.overflowClipMargin,
          borderTopWidth: style.borderTopWidth, borderBottomWidth: style.borderBottomWidth,
          borderLeftWidth: style.borderLeftWidth, borderRightWidth: style.borderRightWidth,
          boxShadow: style.boxShadow, clipPath: style.clipPath,
        };
      }),
      layoutMode: document.querySelector('[data-ui-layout]')?.dataset.uiLayout || null,
      tabRoot: rect(tabRoot),
      artifactPanel: artifactPanel ? {
        mode: artifactPanel.dataset.artifactPanelMode || null,
        rect: rect(artifactPanel),
      } : null,
      stage: rect(stage),
      gardenMode: stage?.dataset.gardenMode || null,
      gardenWorkArea: rect(document.querySelector('.zen-garden-pathways')),
      gardenPanelEdgeX: (() => {
        const line = document.querySelector('.zen-home-garden-depth line');
        return line && stage ? stage.getBoundingClientRect().left + line.x1.baseVal.value : null;
      })(),
      pressureGraph: rect(document.querySelector('[data-main-presentation-surface="pressure-rail"]')),
      pond: rect(pondSurface),
      pondCanvas: pondCanvas ? { rect: rect(pondCanvas), width: pondCanvas.width, height: pondCanvas.height, opacity: pondCanvas.style.opacity } : null,
      bonsai: rect(bonsaiSurface),
      bonsaiCanvas: bonsaiCanvas ? {
        rect: rect(bonsaiCanvas),
        width: bonsaiCanvas.width,
        height: bonsaiCanvas.height,
        paintVisible: bonsaiCanvas.dataset.mainCanvasPaintVisible || null,
        pondOverlapHitTest: (() => {
          if (!pondSurface) return null;
          const canvas = bonsaiCanvas.getBoundingClientRect(), pond = pondSurface.getBoundingClientRect();
          const left = Math.max(canvas.left, pond.left), right = Math.min(canvas.right, pond.right);
          const top = Math.max(canvas.top, pond.top), bottom = Math.min(canvas.bottom, pond.bottom);
          const inAperture = (element, x, y) => {
            const bounds = element.getBoundingClientRect();
            if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return false;
            const clip = getComputedStyle(element).clipPath;
            if (clip === 'none') return true;
            if (!clip.startsWith('polygon(')) throw new Error('QA_DASHBOARD_APERTURE_SHAPE_UNSUPPORTED');
            const points = clip.slice(8, -1).split(',').map(pair => pair.trim().split(' ').filter(Boolean).map(value => {
              if (!value.endsWith('px')) throw new Error('QA_DASHBOARD_APERTURE_COORDINATE_INVALID');
              return parseFloat(value);
            }));
            let inside = false;
            const px = x - bounds.left, py = y - bounds.top;
            for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
              const [xi, yi] = points[i], [xj, yj] = points[j];
              if ((yi > py) !== (yj > py) && px < (xj-xi)*(py-yi)/(yj-yi)+xi) inside = !inside;
            }
            return inside;
          };
          const occluders = [...document.querySelectorAll('.zen-home-garden-occlusion > div')];
          const samples = right > left && bottom > top ? [0.12, 0.35, 0.6, 0.85].flatMap(u => [0.2, 0.45, 0.7, 0.93].map(t => {
            const x = left + (right - left) * u, y = top + (bottom - top) * t;
            const expectedPond = stage?.dataset.gardenMode !== 'pathways'
              && inAperture(pondSurface, x, y) && !occluders.some(element => inAperture(element, x, y));
            const hit = document.elementFromPoint(x, y);
            const hitsPond = Boolean(hit && pondSurface.contains(hit));
            return { x, y, expectedPond, hitsPond, matchesExpected: expectedPond === hitsPond, tag: hit?.tagName || null };
          })) : [];
          return { width: Math.max(0, right - left), pointerEvents: getComputedStyle(bonsaiCanvas).pointerEvents, samples };
        })(),
      } : null,
      pressureRail: pressureRail ? {
        readiness: pressureRail.dataset.readiness || null,
        contentState: pressureRail.dataset.contentState || null,
        segmentCount: pressureRail.querySelectorAll('[data-testid="pressure-segment"]').length,
        readinessVisible: Boolean(
          pressureRail.querySelector('[data-testid="pressure-rail-readiness"]')
        ),
        rect: rect(pressureRail),
      } : null,
      boot: {
        snapshot: bootSnapshot,
        telemetrySnapshot: safeRead(bootTelemetry?.getSnapshot?.bind(bootTelemetry)),
        telemetryReport: safeRead(bootTelemetry?.getLatestReport?.bind(bootTelemetry)),
        zenTraceHistory: safeRead(zenTrace?.history?.bind(zenTrace), []),
        shellPresent: Boolean(document.getElementById('entropy-dashboard-boot-shell')),
        rootInert: document.getElementById('root')?.inert,
        rootVisibility: document.getElementById('root')?.style?.visibility || '',
        rootPointerEvents: document.getElementById('root')?.style?.pointerEvents || '',
      },
      performance: {
        timeOriginEpochMs: Number(performance.timeOrigin.toFixed(2)),
        capturedAtMs: Number(performance.now().toFixed(2)),
        navigation: navigationEntry ? {
          fetchStartMs: Number(navigationEntry.fetchStart.toFixed(2)),
          responseStartMs: Number(navigationEntry.responseStart.toFixed(2)),
          responseEndMs: Number(navigationEntry.responseEnd.toFixed(2)),
          domInteractiveMs: Number(navigationEntry.domInteractive.toFixed(2)),
          domContentLoadedEventEndMs: Number(
            navigationEntry.domContentLoadedEventEnd.toFixed(2)
          ),
          loadEventEndMs: Number(navigationEntry.loadEventEnd.toFixed(2)),
        } : null,
        paints: paintEntries,
        slowestResources: resourceEntries,
      },
      fonts: document.fonts?.status || 'unsupported',
    };
  })()`, { timeoutMs: 5_000 });
}

export function requireDashboardCaptureBonsaiRenderIdentity(readySnapshot, finalSnapshot, request) {
  return request.firstSiteJourney || request.mainReturnJourney
    ? requireDashboardBonsaiJourneyRenderIdentity(readySnapshot, finalSnapshot, request)
    : requireDashboardBonsaiRenderIdentity(finalSnapshot, request);
}

export function isCaptureReady(snapshot, request) {
  if (request.locale !== undefined && snapshot?.locale !== request.locale) return false;
  const baseReady = snapshot?.readyState === 'complete'
    && snapshot?.theme === request.themeId
    && snapshot?.activeTab === request.tabId
    && snapshot?.boot?.snapshot?.shellDismissed === true
    && snapshot?.boot?.shellPresent === false
    && snapshot?.boot?.rootInert === false
    && (snapshot?.fonts === 'loaded' || snapshot?.fonts === 'loading' || snapshot?.fonts === 'unsupported');
  if (!baseReady || !matchesDashboardCaptureViewport(snapshot, request.viewport)) return false;
  if (!request.zenMainProfile) {
    if (request.surfaceId === 'settings') {
      return Number(snapshot.settings?.content?.width) > 1
        && Number(snapshot.settings?.content?.height) > 1
        && snapshot.settings?.sectionSelected === true && snapshot.settings?.loading === false
        && (request.settingsSection === undefined || (snapshot.settings.sectionId === request.settingsSection
          && snapshot.settings.sectionLoading === false));
    }
    if (request.surfaceId === 'schedule') {
      return Number(snapshot.schedule?.workspace?.width) > 1 && Number(snapshot.schedule?.track?.height) > 1
        && Number(snapshot.schedule?.workbench?.height) > 1 && snapshot.boot?.snapshot?.shellDismissed === true
        && ['protected', 'relaxation', 'isolation'].includes(snapshot.schedule.appliedMode);
    }
    if (request.surfaceId === 'sites') {
      const readingRequired = ['intel-reading', 'observed-reading-refresh'].includes(request.sitesScenario);
      return Number(snapshot?.tabRoot?.width) > 0 && snapshot.sites?.loading === false
        && (snapshot.sites?.mode === 'ledger'
          ? snapshot.sites.ledgerVisible === true && !readingRequired
          : snapshot.sites?.mode === 'notebook' && snapshot.sites.detailVisible === true
            && (!readingRequired || snapshot.sites.reading === true));
    }
    if (request.surfaceId === 'pond-lab') {
      return snapshot?.pondLab?.readiness === 'first_frame_committed'
        && Number(snapshot?.pondCanvas?.width) > 1 && Number(snapshot?.pondCanvas?.height) > 1;
    }
    if (request.surfaceId === 'artifacts') {
      return Number(snapshot?.tabRoot?.width) > 1
        && Number(snapshot?.tabRoot?.height) > 1
        && Number(snapshot?.artifactPanel?.rect?.width) > 1
        && Number(snapshot?.artifactPanel?.rect?.height) > 1;
    }
    const mainReady = Number(snapshot?.tabRoot?.width) > 1
      && Number(snapshot?.tabRoot?.height) > 1
      && snapshot?.boot?.snapshot?.shellDismissed === true;
    if (request.themeId !== 'zen') return mainReady;
    return mainReady && snapshot?.presentationPhase === 'settled'
      && snapshot?.bonsaiCanvas?.paintVisible === 'true'
      && Number(snapshot?.pondCanvas?.rect?.width) > 1
      && Number(snapshot?.pondCanvas?.rect?.height) > 1
      && snapshot?.pondCanvas?.opacity === '1';
  }
  const profile = request.zenMainProfile;
  return snapshot?.readyState === 'complete'
    && snapshot?.captureDataset === profile.profileId
    && snapshot?.profile?.profileId === profile.profileId
    && snapshot?.profile?.koiState === profile.koiState
    && snapshot?.profile?.bonsaiState === profile.bonsaiState
    && snapshot?.profile?.appearanceTime === profile.appearanceTime
    && snapshot?.profile?.environmentClock === profile.environmentClock
    && snapshot?.profile?.weather === profile.weather
    && snapshot?.profile?.pressureState === profile.pressureState
    && snapshot?.profile?.pressureReadinessState === profile.pressureReadinessState
    && snapshot?.profile?.pressureContentState === profile.pressureContentState
    && snapshot?.profile?.pondEffectProfile === profile.pondEffectProfile
    && snapshot?.pressureRail?.readiness === profile.pressureReadinessState
    && snapshot?.pressureRail?.contentState === profile.pressureContentState
    && (
      profile.pressureContentState === 'pressure'
        ? Number(snapshot?.pressureRail?.segmentCount) > 0
        : Number(snapshot?.pressureRail?.segmentCount) === 0
    )
    && snapshot?.pressureRail?.readinessVisible === (
      profile.pressureContentState !== 'pressure'
    )
    && snapshot?.pondAck?.fishCount === profile.koiCount
    && snapshot?.bonsaiCanvas?.paintVisible === 'true'
    && Number(snapshot?.bonsaiCanvas?.width) > 1
    && Number(snapshot?.bonsaiCanvas?.height) > 1
    // A fixed desktop-width threshold rejects the supported compact layout.
    // Readiness requires painted content in measurable scene regions instead.
    && Number(snapshot?.stage?.width) > 1
    && Number(snapshot?.stage?.height) > 1
    && Number(snapshot?.pond?.width) > 1
    && Number(snapshot?.pond?.height) > 1
    && Number(snapshot?.pondCanvas?.rect?.width) > 1
    && Number(snapshot?.pondCanvas?.rect?.height) > 1
    && snapshot?.pondCanvas?.opacity === '1'
    && snapshot?.fonts === 'loaded';
}

export function requireZenDashboardFrameEdges(snapshot, request) {
  if (request.themeId !== 'zen') return;
  const { frame, sidebar, consoleContent: content, frameRowGap, layoutMode, stage, pressureGraph } = snapshot;
  const validRect = rect => rect && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key]))
    && rect.width > 0 && rect.height > 0;
  const near = (a, b) => Math.abs(a - b) < 0.1;
  const right = rect => rect.x + rect.width, bottom = rect => rect.y + rect.height;
  const checks = { rectangles: [frame, sidebar, content].every(validRect) };
  if (checks.rectangles) {
    checks.sidebarOrigin = near(sidebar.x, frame.x) && near(sidebar.y, frame.y);
    checks.contentRight = near(right(content), right(frame));
    checks.contentBottom = near(bottom(content), bottom(frame));
    if (layoutMode === 'landscape') {
      checks.sidebarBottom = near(bottom(sidebar), bottom(frame));
      checks.contentTop = near(content.y, frame.y);
      checks.sidebarContentJoint = near(right(sidebar), content.x);
      if (['main', 'sites'].includes(request.surfaceId)) {
        checks.gardenRectangles = [stage, pressureGraph].every(validRect);
        if (checks.gardenRectangles) {
          checks.gardenTop = near(stage.y, content.y);
          checks.gardenSides = near(stage.x, content.x) && near(right(stage), right(content));
          checks.gardenBottom = near(bottom(stage), bottom(content));
          checks.graphBottom = near(bottom(pressureGraph), bottom(content));
          checks.graphSides = near(pressureGraph.x, stage.x) && near(right(pressureGraph), right(stage));
        }
      }
    } else if (['portrait-compact', 'portrait-desktop'].includes(layoutMode)) {
      checks.sidebarRight = near(right(sidebar), right(frame));
      checks.contentLeft = near(content.x, frame.x);
      checks.dockContentJoint = Number.isFinite(frameRowGap)
        && near(content.y - bottom(sidebar), frameRowGap);
    } else checks.layoutMode = false;
  }
  if (Object.values(checks).some(value => !value)) {
    const error = new Error('QA_DASHBOARD_FRAME_EDGE_MISMATCH');
    error.diagnostic = { checks, frame, sidebar, content, frameRowGap, layoutMode, stage, pressureGraph };
    throw error;
  }
}

export function isArtifactEntryOriginReady(snapshot, request) {
  if (request.tabId !== 'main') return isCaptureReady(snapshot, request);
  const boot = snapshot?.boot?.snapshot;
  if (boot?.status === 'failed' || boot?.forcedVisualRelease === true || boot?.degraded === true) {
    const error = new Error('QA_ARTIFACT_ENTRY_MAIN_BOOT_UNCLEAN');
    error.diagnostic = snapshot;
    throw error;
  }
  return isCaptureReady(snapshot, request) && boot?.status === 'ready'
    && boot.themeReady === true && boot.coreReady === true && boot.mainTabFirstFrameReady === true
    && boot.dismissible === true && boot.shellDismissed === true;
}

export function isCaptureInteractiveReady(snapshot, request) {
  return isCaptureReady(snapshot, request)
    && snapshot.boot?.snapshot?.shellDismissed === true
    && snapshot.boot?.shellPresent === false
    && snapshot.boot?.rootInert === false;
}

async function waitForCaptureReady(harness, page, request, signal, isReady = isCaptureReady, pageDiagnostics = null) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastSnapshot = null;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    await pageDiagnostics?.requireNativePageVisible('capture_ready_wait');
    lastSnapshot = await inspectDashboardCapture(harness, page, request).catch((error) => ({
      inspectionError: error?.message || String(error),
    }));
    if (isReady(lastSnapshot, request)) return lastSnapshot;
    await sleep(120);
  }
  const error = new Error('QA_DASHBOARD_CAPTURE_READY_TIMEOUT');
  error.diagnostic = lastSnapshot;
  throw error;
}

async function captureScreenshot(harness, page, outputPath) {
  const result = await harness.cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  }, page.sessionId, { timeoutMs: 20_000 });
  if (typeof result?.data !== 'string' || !result.data) {
    throw new Error('QA_DASHBOARD_CAPTURE_SCREENSHOT_EMPTY');
  }
  await fs.writeFile(outputPath, Buffer.from(result.data, 'base64'));
  return outputPath;
}

const projectArtifactIdentity = (artifact) => Object.freeze({
  id: artifact?.id || null,
  ownership: artifact?.ownership || null,
  buildId: artifact?.buildId || null,
  releaseProfile: artifact?.releaseProfile || null,
  inputDigest: artifact?.inputDigest || null,
  inputFileCount: Number.isInteger(artifact?.inputFileCount)
    ? artifact.inputFileCount
    : null,
});

async function writeDashboardBootEvidence({
  attachmentsDir,
  artifact,
  request,
  captureStateCommit,
  pageSnapshot,
  pageDiagnostics,
  health,
  harness,
  error = null,
  screenshotPath = null,
}) {
  const reportPath = path.join(attachmentsDir, 'dashboard-boot.json');
  const report = Object.freeze({
    schemaVersion: 1,
    request,
    artifact: projectArtifactIdentity(artifact),
    captureStateCommit,
    page: pageSnapshot ? Object.freeze({
      href: pageSnapshot.href || null,
      readyState: pageSnapshot.readyState || null,
      theme: pageSnapshot.theme || null,
      activeTab: pageSnapshot.activeTab || null,
      boot: pageSnapshot.boot || null,
      performance: pageSnapshot.performance || null,
    }) : null,
    diagnostics: pageDiagnostics,
    health,
    screenshotPath,
    error: error?.message || null,
    sourceDiagnostic: error?.diagnostic || null,
    chromeStderr: Object.freeze(harness.chromeStderr.slice(-20)),
    graphicsLaunchPolicy: harness.chromeLaunchSpec?.graphicsLaunchPolicy || null,
  });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return Object.freeze({ report, reportPath });
}

async function captureFailureScreenshot(harness, page, outputPath) {
  if (!page) return Object.freeze({ path: null, error: null });
  try {
    await captureScreenshot(harness, page, outputPath);
    return Object.freeze({ path: outputPath, error: null });
  } catch (error) {
    return Object.freeze({
      path: null,
      error: error?.message || String(error),
    });
  }
}

function isDashboardBootTerminal(snapshot) {
  const boot = snapshot?.boot?.snapshot;
  if (!boot || typeof boot !== 'object') return false;
  if (boot.status === 'failed' || boot.forcedVisualRelease === true) return true;
  return boot.dismissible === true
    && boot.themeReady === true
    && boot.coreReady === true
    && boot.mainTabFirstFrameReady === true;
}

async function waitForDashboardBootTerminal(harness, page, request, signal, pageDiagnostics) {
  const deadline = Date.now() + BOOT_PROBE_TIMEOUT_MS;
  let lastSnapshot = null;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    await pageDiagnostics.requireNativePageVisible('boot_ready_wait');
    lastSnapshot = await inspectDashboardCapture(harness, page, request).catch((error) => ({
      inspectionError: error?.message || String(error),
    }));
    if (isDashboardBootTerminal(lastSnapshot)) return lastSnapshot;
    await sleep(100);
  }
  const error = new Error('QA_DASHBOARD_BOOT_TERMINAL_TIMEOUT');
  error.diagnostic = lastSnapshot;
  throw error;
}

function projectBootTraceStages(pageSnapshot) {
  const history = pageSnapshot?.boot?.zenTraceHistory;
  return projectDashboardEntryStageTrace(history);
}

function projectHomeWorkerTimeline(pageSnapshot) {
  const history = pageSnapshot?.boot?.zenTraceHistory;
  if (!Array.isArray(history)) return Object.freeze([]);
  return Object.freeze(history
    .filter((entry) => (
      typeof entry?.event === 'string'
      && entry.event.startsWith('zen_home_worker:')
    ))
    .map((entry) => Object.freeze({
      event: entry.event.slice('zen_home_worker:'.length),
      elapsedMs: Number.isFinite(Number(entry?.elapsedMs))
        ? Number(entry.elapsedMs)
        : null,
      generation: Number.isFinite(Number(entry?.details?.generation))
        ? Number(entry.details.generation)
        : null,
      workerAtMs: Number.isFinite(Number(entry?.details?.workerAtMs))
        ? Number(entry.details.workerAtMs)
        : null,
      sincePhysicalWorkerCreateMs: Number.isFinite(
        Number(entry?.details?.sincePhysicalWorkerCreateMs),
      )
        ? Number(entry.details.sincePhysicalWorkerCreateMs)
        : null,
      details: entry?.details?.details || null,
    })));
}

export function projectPondStartupCost(pageSnapshot) {
  const pondAck = pageSnapshot?.pondAck;
  const initOrder = pondAck?.runtimeHealth?.initOrder;
  if (!pondAck || !initOrder || typeof initOrder !== 'object') return null;
  const events = Array.isArray(pondAck.runtimeHealth?.events)
    ? pondAck.runtimeHealth.events
    : [];
  const textureUploads = events.filter(
    (entry) => entry?.name === 'first_render_texture_upload',
  );
  const rendererAdmissionDetails = pondAck?.runtimeHealth?.milestones
    ?.renderer_module_admission_end?.details;
  const firstTickDetails = pondAck.runtimeHealth?.milestones?.first_render_tick_end?.details;
  const uploadProbeEnabled = firstTickDetails?.textureUploadProbeEnabled === true;
  const finite = (value) => {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  return Object.freeze({
    totalToFirstFrameMs: finite(initOrder?.budgetMs?.totalToFirstFrame),
    knownWorkMs: finite(initOrder?.budgetMs?.knownWork),
    knownWaitMs: finite(initOrder?.budgetMs?.knownWait),
    sceneMountMs: finite(initOrder?.deltasMs?.sceneMount),
    firstFrameAssetsPrepareMs: finite(
      initOrder?.deltasMs?.firstFrameAssetsPrepare,
    ),
    firstRenderTickMs: finite(initOrder?.deltasMs?.firstRenderTick),
    firstRenderEndToAckMs: finite(
      initOrder?.deltasMs?.firstRenderTickEndToAck,
    ),
    firstFrameMs: finite(pondAck?.frameMetrics?.frameMs),
    firstFrameRenderMs: finite(pondAck?.frameMetrics?.renderMs),
    waterPassMs: finite(pondAck?.frameMetrics?.stageMs?.waterPassMs),
    komorebiTextureBuildMs: finite(
      pondAck?.frameMetrics?.waterEffects?.komorebiTextureBuildMs,
    ),
    staticBenthicAssetPrepareMs: finite(
      rendererAdmissionDetails?.staticBenthicAssetDurationMs,
    ),
    staticBenthicAssetBytes: finite(
      rendererAdmissionDetails?.staticBenthicAssetBytes,
    ),
    textureUploadScope: uploadProbeEnabled ? firstTickDetails.textureUploadScope : null,
    textureUploadCount: uploadProbeEnabled ? finite(firstTickDetails.textureUploadCount) : null,
    textureUploadMs: uploadProbeEnabled ? finite(firstTickDetails.textureUploadTotalMs) : null,
    textureUploadBytes: uploadProbeEnabled ? finite(firstTickDetails.textureUploadTotalBytes) : null,
    textureUploadDetailCount: textureUploads.length,
    textureUploadObservationFailureCount: uploadProbeEnabled
      ? finite(firstTickDetails.textureUploadObservationFailureCount) : null,
    activeEffectGates: Object.freeze({
      benthic: finite(pondAck?.frameMetrics?.waterEffects?.benthicGate),
      caustics: finite(pondAck?.frameMetrics?.waterEffects?.causticGate),
      atmosphere: finite(pondAck?.frameMetrics?.waterEffects?.atmosphereGate),
      godRays: finite(pondAck?.frameMetrics?.waterEffects?.godRaysGate),
      cloudReflection: finite(
        pondAck?.frameMetrics?.waterEffects?.cloudReflectionToggleGate,
      ),
      komorebi: pondAck?.frameMetrics?.waterEffects?.komorebiActive === true,
      yoonseul: finite(pondAck?.frameMetrics?.waterEffects?.yoonseulDrive),
      fishShadows: Math.max(0, Math.floor(Number(
        pondAck?.frameMetrics?.koiRender?.shadowEnabledCount,
      ) || 0)),
    }),
  });
}

function projectBootSampleDuration(pageDiagnostics) {
  const timeline = pageDiagnostics?.timeline;
  const startedAt = Number(timeline?.navigationRequestedAtEpochMs);
  const readyAt = Number(timeline?.captureReadyAtEpochMs);
  return Number.isFinite(startedAt) && Number.isFinite(readyAt)
    ? Math.max(0, readyAt - startedAt)
    : null;
}

function summarizeBootSampleDurations(samples) {
  const durations = samples
    .map((sample) => sample.durationMs)
    .filter((value) => Number.isFinite(value));
  const warmDurations = samples
    .filter((sample) => sample.cacheState === 'warm')
    .map((sample) => sample.durationMs)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const median = warmDurations.length === 0
    ? null
    : warmDurations[Math.floor(warmDurations.length / 2)];
  return Object.freeze({
    sampleCount: samples.length,
    cleanSampleCount: samples.filter((sample) => sample.health?.status === 'clean').length,
    failedSampleCount: samples.filter((sample) => sample.health?.status !== 'clean').length,
    coldDurationMs: durations[0] ?? null,
    warmMedianDurationMs: median,
    warmMinimumDurationMs: warmDurations[0] ?? null,
    warmMaximumDurationMs: warmDurations[warmDurations.length - 1] ?? null,
  });
}

function summarizePondStartupCosts(samples) {
  const keys = [
    'totalToFirstFrameMs',
    'knownWorkMs',
    'knownWaitMs',
    'sceneMountMs',
    'firstFrameAssetsPrepareMs',
    'firstRenderTickMs',
    'firstRenderEndToAckMs',
    'firstFrameMs',
    'firstFrameRenderMs',
    'waterPassMs',
    'komorebiTextureBuildMs',
    'staticBenthicAssetPrepareMs',
    'staticBenthicAssetBytes',
    'textureUploadCount',
    'textureUploadMs',
    'textureUploadBytes',
  ];
  const median = (values) => {
    const sorted = values
      .filter((value) => typeof value === 'number' && Number.isFinite(value))
      .sort((left, right) => left - right);
    return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;
  };
  return Object.freeze(Object.fromEntries(keys.map((key) => [
    key,
    median(samples.map((sample) => sample.pondStartupCost?.[key])),
  ])));
}

export function requireDashboardBootEnvironmentClock(snapshot, request) {
  if (request.zenMainProfile && snapshot?.profile?.environmentClock !== request.zenMainProfile.environmentClock) {
    const error = new Error('QA_BOOT_ENVIRONMENT_CLOCK_MISMATCH');
    error.diagnostic = { requested: request.zenMainProfile.environmentClock, observed: snapshot?.profile?.environmentClock };
    throw error;
  }
}

export async function executeDashboardBootSample({
  harness,
  request,
  sampleIndex,
  cacheState = sampleIndex === 0 ? 'cold' : 'warm',
  signal,
  attachmentsDir,
}) {
  let page = null;
  let pageDiagnostics = null;
  let pageSnapshot = null;
  let diagnosticSnapshot = null;
  let postReveal = null;
  let error = null;
  let abortError = null;
  let stopRenderTrace = null;
  let renderTraceAlignment;
  let renderTrace = null;
  let interactionProbe = null;
  let interaction = null;
  let gpuTiming = null;
  let gpuInfoCollectionEvidence = null;
  const postRevealOptions = requireDashboardPostRevealOptions(request);
  try {
    page = await harness.openPage('about:blank', { active: true, timeoutMs: 45_000 });
    await configurePage(harness, page, DASHBOARD_CAPTURE_VIEWPORT);
    pageDiagnostics = createDashboardPageDiagnostics({
      cdp: harness.cdp,
      sessionId: page.sessionId,
      cpuProfile: request.cpuProfile,
      writeCpuProfileEvidence: request.cpuProfile
        ? createDashboardCpuProfileEvidenceWriter(attachmentsDir, sampleIndex) : null,
    });
    await pageDiagnostics.enable();
    await pageDiagnostics.prepareNativePage(harness, page);
    await installDashboardPostRevealProbe(harness.cdp, page.sessionId, postRevealOptions);
    if (request.interaction && request.interaction !== 'none') {
      interactionProbe = await installDashboardBootInteractionProbe(harness, page, request.interaction);
    }
    await pageDiagnostics.capturePerformanceCheckpoint('session_ready');
    const lateGpuTrace = request.renderTrace && request.renderTraceProfile === 'gpu-startup'
      && postRevealOptions.windowMs > 30000;
    const startRenderTrace = () => startDashboardBootRenderTrace(harness.cdp,
      path.join(attachmentsDir, `dashboard-boot-render-trace-${sampleIndex + 1}.json`),
      { profile: request.renderTraceProfile });
    if (request.renderTrace && !lateGpuTrace) {
      stopRenderTrace = await startRenderTrace();
    }
    pageDiagnostics.markNavigationRequested();
    const dashboardUrl = buildDashboardUrl(
      harness,
      buildDashboardBootSearchParams(
        request.zenMainProfile,
        request.traceMode,
        request.gpuTiming,
        request.canopyPreparation,
      ),
    );
    await harness.navigatePage(page, dashboardUrl, { timeoutMs: 45_000 });
    await pageDiagnostics.requireNativePageVisible('navigation_complete');
    await waitForPageReady(harness.cdp, page.sessionId, READY_TIMEOUT_MS);
    await pageDiagnostics.capturePerformanceCheckpoint('document_loaded');
    pageSnapshot = await waitForDashboardBootTerminal(
      harness,
      page,
      request,
      signal,
      pageDiagnostics,
    );
    await pageDiagnostics.requireNativePageVisible('boot_ready');
    await pageDiagnostics.stopNativePagePreparation();
    pageDiagnostics.markCaptureReady();
    await pageDiagnostics.capturePerformanceCheckpoint('boot_terminal');
    requireDashboardBootEnvironmentClock(pageSnapshot, request);
    const onObservation = lateGpuTrace ? async state => {
      if (!Number.isFinite(state.startTime) || !Number.isFinite(state.observedAtMs)) {
        throw new Error('QA_BOOT_GPU_STARTUP_TRACE_OBSERVATION_CLOCK_INVALID');
      }
      if (stopRenderTrace || state.observedAtMs - state.startTime < postRevealOptions.windowMs - 30000) return;
      stopRenderTrace = await startRenderTrace();
      renderTraceAlignment = await evaluate(harness.cdp, page.sessionId, `(() => {
        const probe = window.__ENTROPY_QA_BOOT_POST_REVEAL__;
        if (probe?.status !== 'observing' || !Number.isFinite(probe.startTime)) {
          throw new Error('QA_BOOT_GPU_STARTUP_TRACE_ANCHOR_UNAVAILABLE');
        }
        const markName = 'entropy-qa:gpu-startup-trace-anchor';
        const mark = performance.mark(markName);
        return { markName, markStartTimeMs: mark.startTime, postRevealStartTimeMs: probe.startTime };
      })()`);
    } : null;
    postReveal = await collectDashboardPostRevealProbe(harness, page, signal, postRevealOptions.windowMs, { onObservation });
    if (request.renderTrace && !stopRenderTrace) throw new Error('QA_BOOT_RENDER_TRACE_NOT_STARTED');
    await pageDiagnostics.capturePerformanceCheckpoint('post_reveal_observed');
    if (request.gpuTiming) {
      const readGpu = () => evaluate(harness.cdp, page.sessionId, `(async () => {
        const metrics = await globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG?.metrics();
        const timing = metrics?.mainMetrics?.gpuTiming;
        if (!timing || timing.enabled !== true) throw new Error('QA_BOOT_GPU_TIMING_NOT_ENABLED');
        if (document.visibilityState !== 'visible') throw new Error('QA_BOOT_GPU_TIMING_PAGE_HIDDEN');
        return { timing, observedAt: performance.now() };
      })()`);
      const startGpu = await readGpu();
      await sleep(600);
      let endGpu = await readGpu();
      const sampleDeadline = performance.now() + 2000;
      while (endGpu.timing.supported
        && endGpu.timing.sampleCount === startGpu.timing.sampleCount
        && performance.now() < sampleDeadline) {
        signal?.throwIfAborted();
        await sleep(200);
        endGpu = await readGpu();
      }
      const start = startGpu.timing, end = endGpu.timing;
      const sampleCount = end.sampleCount - start.sampleCount;
      if (end.supported && sampleCount <= 0) throw new Error('QA_BOOT_GPU_TIMING_SAMPLES_MISSING');
      gpuTiming = { ...end, steadyWindow: {
        durationMs: endGpu.observedAt - startGpu.observedAt,
        sampleCount,
        // Cumulative mean is rounded to 4 decimals by the timer owner. Delta
        // error is below 0.001ms for these bounded windows; no startup/max mix.
        avgGpuMs: sampleCount > 0
          ? (end.avgGpuMs * end.sampleCount - start.avgGpuMs * start.sampleCount) / sampleCount
          : null,
        startSnapshot: start, endSnapshot: end,
      } };
    }
    if (interactionProbe) interaction = await interactionProbe.collect(signal);
    pageSnapshot = await inspectDashboardCapture(harness, page, request);
    requireDashboardBootEnvironmentClock(pageSnapshot, request);
    pageSnapshot.bonsaiRenderIdentity = requireDashboardBonsaiRenderIdentity(pageSnapshot, request);
    if (['browser-default', 'dawn-eager'].includes(request.gpuInfoCollection)) {
      gpuInfoCollectionEvidence = await readDashboardGpuInfoCollectionEvidence(harness.cdp, {
        checkpoint: 'after_observation', policy: request.gpuInfoCollection,
      });
    }
  } catch (caughtError) {
    try { signal?.throwIfAborted(); }
    catch (caughtAbortError) {
      error = abortError = caughtAbortError;
      throw caughtAbortError;
    }
    error = caughtError;
    pageSnapshot = page
      ? await inspectDashboardCapture(harness, page, request).catch((inspectionError) => ({
          inspectionError: inspectionError?.message || String(inspectionError),
        }))
      : null;
  } finally {
    const cleanupErrors = [];
    try { await interactionProbe?.dispose(); }
    catch (cleanupError) { cleanupErrors.push(cleanupError); }
    if (stopRenderTrace) {
      try { renderTrace = await stopRenderTrace(postReveal, renderTraceAlignment); }
      catch (traceError) { cleanupErrors.push(traceError); renderTrace = { error: traceError.message }; }
    }
    if (pageDiagnostics) {
      try { await pageDiagnostics.stopNativePagePreparation(); }
      catch (cleanupError) { cleanupErrors.push(cleanupError); }
      try { pageDiagnostics.markCaptureFinished(); }
      catch (cleanupError) { cleanupErrors.push(cleanupError); }
      try { await pageDiagnostics.stopCpuProfile(); }
      catch (cleanupError) { cleanupErrors.push(cleanupError); }
      try { diagnosticSnapshot = await pageDiagnostics.snapshot(); }
      catch (cleanupError) { cleanupErrors.push(cleanupError); }
      try { await pageDiagnostics.dispose(); }
      catch (cleanupError) { cleanupErrors.push(cleanupError); }
    }
    if (page) {
      try { await harness.closePage(page); }
      catch (cleanupError) { cleanupErrors.push(cleanupError); }
    }
    if (cleanupErrors.length) {
      const primaryError = error;
      error = new AggregateError(primaryError ? [primaryError, ...cleanupErrors] : cleanupErrors,
        'QA_DASHBOARD_BOOT_SAMPLE_CLEANUP_FAILED', { cause: primaryError || cleanupErrors[0] });
      if (primaryError?.diagnostic) error.diagnostic = primaryError.diagnostic;
      // Cancellation still propagates instead of producing an ordinary sample.
      if (abortError) throw error;
    }
  }
  diagnosticSnapshot ||= Object.freeze({
    timeline: null,
    runtimeExceptions: Object.freeze([]),
    consoleMessages: Object.freeze([]),
    logEntries: Object.freeze([]),
    networkFailures: Object.freeze([]),
    resourceLoads: Object.freeze([]),
    performanceCheckpoints: Object.freeze([]),
    cpuProfile: null,
    cpuProfileError: null,
    workerCpuProfiles: Object.freeze([]),
  });
  const health = classifyDashboardCaptureHealth({
    pageSnapshot,
    pageDiagnostics: diagnosticSnapshot,
    requireCpuProfile: request.cpuProfile,
    requireModelCpuProfile: request.cpuProfile === true && request.themeId === 'zen'
      && request.surfaceId === 'main' && request.zenMainProfile?.bonsaiState === 'full',
    probeError: error?.message,
  });
  const stageImports = projectBootTraceStages(pageSnapshot);
  // A failed sample may have no complete boot trace. Preserve its primary and
  // cleanup failure receipt; successful traced samples still require all stages.
  if (request.traceMode !== 'off' && !error) {
    requireDashboardEntryStageTraceProjection(stageImports);
  }
  return Object.freeze({
    sampleIndex,
    cacheState,
    durationMs: projectBootSampleDuration(diagnosticSnapshot),
    postReveal,
    renderTrace,
    interaction,
    gpuTiming,
    gpuInfoCollectionEvidence,
    health,
    error: error?.message || null,
    ...(error ? { errorDetail: serializeQaError(error) } : {}),
    sourceDiagnostic: error?.diagnostic || null,
    page: pageSnapshot,
    diagnostics: diagnosticSnapshot,
    stageImports,
    modelTiming: projectDashboardBootModelTimingEvidence(pageSnapshot, request, diagnosticSnapshot),
    homeWorkerTimeline: projectHomeWorkerTimeline(pageSnapshot),
    pondStartupCost: projectPondStartupCost(pageSnapshot),
  });
}

async function executeDashboardBootArtifactPreparation({
  plan,
  artifact,
  browser,
  evidence,
  attachmentsDir,
  registerCleanup,
  signal,
  recoveryJournal,
  request,
}) {
  const policy = resolveDashboardBootArtifactPreparationPolicy(artifact);
  if (!policy.required) {
    const receipt = Object.freeze({
      ...policy,
      status: 'not_required',
      durationMs: 0,
      reportPath: null,
    });
    await evidence.event(
      'QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_SKIPPED',
      receipt,
    );
    return receipt;
  }

  const reportPath = path.join(
    attachmentsDir,
    'dashboard-boot-artifact-preparation.json',
  );
  const harness = createDashboardHarness({
    plan,
    artifact,
    browser,
    recoveryJournal,
    tempPrefix: 'entropy-dashboard-boot-artifact-preparation-qa-',
  });
  const releaseHarness = createSingleRelease(() => harness.close());
  registerCleanup(
    'dashboard_boot_artifact_preparation_browser',
    releaseHarness,
  );
  const startedAtEpochMs = Date.now();
  await evidence.event('QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_STARTED', {
    ...policy,
    reportPath,
  });

  const preparationRequest = Object.freeze({
    ...request,
    postRevealMs: 1000,
    cpuProfile: false,
    renderTrace: false,
    renderTraceProfile: 'rendering',
    gpuTiming: false,
    gpuInfoCollection: 'off',
    canopyPreparation: 'native',
    interaction: 'none',
  });
  let captureStateCommit = null;
  let sample = null;
  let healthAdmission = null;
  let phaseError = null;
  try {
    signal?.throwIfAborted();
    await harness.start();
    captureStateCommit = await prepareDashboardCaptureState(harness, {
      themeId: preparationRequest.themeId,
      zenMainProfile: preparationRequest.zenMainProfile,
    });
    sample = await executeDashboardBootSample({
      harness,
      request: preparationRequest,
      sampleIndex: null,
      cacheState: 'artifact_preparation',
      signal,
    });
    healthAdmission = classifyDashboardBootArtifactPreparationHealth({
      health: sample.health,
      pageSnapshot: sample.page,
      gpuCapability: harness.gpuCapability,
    });
    if (healthAdmission.status === 'failed') {
      const error = new Error(
        'QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_HEALTH_FAILED',
      );
      error.code = 'QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_HEALTH_FAILED';
      error.diagnostic = sample.health;
      throw error;
    }
    if (healthAdmission.status === 'accepted_software_visual_wait') {
      await evidence.event(
        'QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_SOFTWARE_VISUAL_WAIT_ACCEPTED',
        healthAdmission,
      );
    }
  } catch (error) {
    phaseError = error;
  }

  const runtimeEvidence = Object.freeze({
    gpuCapability: harness.gpuCapability || null,
    graphicsLaunchPolicy: harness.chromeLaunchSpec?.graphicsLaunchPolicy || null,
    chromeStderr: Object.freeze(harness.chromeStderr.slice(-20)),
  });
  let cleanupError = null;
  try {
    await releaseHarness();
  } catch (error) {
    cleanupError = error;
  }
  const finishedAtEpochMs = Date.now();
  const receipt = Object.freeze({
    ...policy,
    status: phaseError || cleanupError ? 'failed' : 'prepared',
    startedAtEpochMs,
    finishedAtEpochMs,
    durationMs: Math.max(0, finishedAtEpochMs - startedAtEpochMs),
    reportPath,
    captureStateCommit,
    sample,
    healthAdmission,
    runtime: runtimeEvidence,
    cleanup: cleanupError
      ? Object.freeze({ status: 'failed', error: cleanupError.message })
      : Object.freeze({ status: 'released' }),
    error: phaseError?.message || null,
  });
  await fs.writeFile(reportPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

  if (phaseError || cleanupError) {
    await evidence.event(
      'QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_FAILED',
      receipt,
    );
    if (phaseError && cleanupError) {
      throw new AggregateError(
        [phaseError, cleanupError],
        'QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_AND_CLEANUP_FAILED',
        { cause: phaseError },
      );
    }
    throw phaseError || cleanupError;
  }

  await evidence.event(
    'QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_FINISHED',
    receipt,
  );
  return receipt;
}

async function executeDashboardBootProtocol({
  plan,
  artifact,
  browser,
  evidence,
  attachmentsDir,
  registerCleanup,
  reportBrowserGpuCapability,
  signal,
  recoveryJournal,
}) {
  if (
    plan.protocolOptions.artifactPreparationPolicy
      !== DASHBOARD_BOOT_ARTIFACT_PREPARATION_POLICY
  ) {
    throw new Error('QA_DASHBOARD_BOOT_ARTIFACT_PREPARATION_POLICY_INVALID');
  }
  const themeId = requireDashboardCaptureThemeId(plan.parameters.theme);
  if (plan.parameters.gpuTiming && (themeId !== 'zen' || plan.parameters.interaction !== 'none')) {
    throw new Error('QA_BOOT_GPU_TIMING_REQUIRES_ZEN_IDLE_SCENARIO');
  }
  if (plan.parameters.canopyPreparation === 'before-first-draw' && (
    themeId !== 'zen'
    || plan.parameters.gpuTiming !== true
    || plan.parameters.interaction !== 'none'
    || plan.parameters.pondEffectProfile !== 'full'
    || plan.parameters.environmentClock !== 'fixed'
  )) {
    throw new Error('QA_BOOT_CANOPY_PREPARATION_REQUIRES_ZEN_FULL_FIXED_GPU_IDLE_SCENARIO');
  }
  const zenMainProfile = themeId === 'zen'
    ? normalizeZenMainCaptureInput({
        koiState: 'full',
        bonsaiState: 'full',
        appearanceTime: '12:00',
        environmentClock: plan.parameters.environmentClock,
        weather: 'clear',
        pressureState: 'ready',
        pondEffectProfile: plan.parameters.pondEffectProfile,
      })
    : null;
  const request = Object.freeze({
    surfaceId: 'main',
    tabId: 'main',
    themeId,
    zenMainProfile,
    cpuProfile: plan.parameters.cpuProfile === true,
    postRevealMs: plan.parameters.postRevealMs,
    environmentClock: plan.parameters.environmentClock,
    gpuInfoCollection: plan.parameters.gpuInfoCollection,
    renderTrace: plan.parameters.renderTrace === true,
    renderTraceProfile: plan.parameters.renderTraceProfile,
    gpuTiming: plan.parameters.gpuTiming === true,
    canopyPreparation: plan.parameters.canopyPreparation,
    interaction: plan.parameters.interaction,
    traceMode: plan.parameters.traceMode,
  });
  requireDashboardPostRevealOptions(request);
  const gpuInfoCollectionMode = requireDashboardGpuInfoCollectionResearch(request, plan.parameters.samples);
  await fs.mkdir(attachmentsDir, { recursive: true });
  const moduleGraph = await readDashboardBootArtifactGraph({
    artifactPath: artifact.path,
  });
  const moduleGraphPath = path.join(attachmentsDir, 'dashboard-boot-module-graph.json');
  await fs.writeFile(
    moduleGraphPath,
    `${JSON.stringify(moduleGraph, null, 2)}\n`,
    'utf8',
  );
  await evidence.event('QA_DASHBOARD_BOOT_STARTED', {
    request,
    sampleCount: plan.parameters.samples,
    moduleGraphPath,
    viewport: DASHBOARD_CAPTURE_VIEWPORT,
    presentation: plan.browserExecution.presentation,
    artifactPreparationPolicy: plan.protocolOptions.artifactPreparationPolicy,
  });
  const artifactPreparation = await executeDashboardBootArtifactPreparation({
    plan,
    artifact,
    browser,
    evidence,
    attachmentsDir,
    registerCleanup,
    signal,
    recoveryJournal,
    request,
  });
  const harness = createDashboardHarness({
    plan,
    artifact,
    browser,
    recoveryJournal,
    tempPrefix: 'entropy-dashboard-boot-qa-',
    gpuInfoCollectionPolicy: gpuInfoCollectionMode === 'dawn-eager' ? 'dawn-eager' : 'browser-default',
  });
  registerCleanup('dashboard_boot_browser', () => harness.close());
  await harness.start();
  await reportBrowserGpuCapability(harness.gpuCapability);
  if (gpuInfoCollectionMode !== 'off' && harness.gpuCapability?.hardwareActive !== true) {
    throw new Error('QA_BOOT_GPU_INFO_COLLECTION_RESEARCH_HARDWARE_REQUIRED');
  }
  const gpuInfoCollectionBeforeFixture = gpuInfoCollectionMode === 'off' ? null
    : await readDashboardGpuInfoCollectionEvidence(harness.cdp, {
      checkpoint: 'before_fixture', policy: gpuInfoCollectionMode,
    });
  const captureStateCommit = await prepareDashboardCaptureState(harness, {
    themeId,
    zenMainProfile,
  });
  await evidence.event('QA_DASHBOARD_BOOT_STATE_COMMITTED', captureStateCommit);
  const samples = [];
  for (let sampleIndex = 0; sampleIndex < plan.parameters.samples; sampleIndex += 1) {
    signal?.throwIfAborted();
    await evidence.event('QA_DASHBOARD_BOOT_SAMPLE_STARTED', {
      sampleIndex,
      cacheState: sampleIndex === 0 ? 'cold' : 'warm',
    });
    const sample = await executeDashboardBootSample({
      attachmentsDir,
      harness,
      request,
      sampleIndex,
      signal,
    });
    samples.push(sample);
    const samplePath = path.join(
      attachmentsDir,
      `dashboard-boot-sample-${sampleIndex + 1}.json`,
    );
    await fs.writeFile(samplePath, `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
    await evidence.event('QA_DASHBOARD_BOOT_SAMPLE_FINISHED', {
      sampleIndex,
      cacheState: sample.cacheState,
      durationMs: sample.durationMs,
      health: sample.health,
      modelTimingStatus: sample.modelTiming.status,
      modelTimingReasons: sample.modelTiming.reasons,
      error: sample.error,
      samplePath,
    });
  }
  const summary = summarizeBootSampleDurations(samples);
  const pondStartupCostSummary = summarizePondStartupCosts(samples);
  const modelTimingSummary = Object.freeze({
    required: request.traceMode === 'full' && request.themeId === 'zen'
      && request.surfaceId === 'main' && request.zenMainProfile?.bonsaiState === 'full',
    completeSampleCount: samples.filter(sample => sample.modelTiming.status === 'COMPLETE').length,
    incompleteSampleCount: samples.filter(sample => sample.modelTiming.status === 'INCOMPLETE').length,
    notRequestedSampleCount: samples.filter(sample => sample.modelTiming.status === 'NOT_REQUESTED').length,
  });
  const report = Object.freeze({
    schemaVersion: 2,
    request,
    artifact: projectArtifactIdentity(artifact),
    artifactPreparation,
    captureStateCommit,
    viewport: DASHBOARD_CAPTURE_VIEWPORT,
    samplePolicy: plan.protocolOptions.samplePolicy,
    summary,
    pondStartupCostSummary,
    modelTimingSummary,
    moduleGraphPath,
    moduleGraph,
    samples: Object.freeze(samples),
    chromeStderr: Object.freeze(harness.chromeStderr.slice(-20)),
    graphicsLaunchPolicy: harness.chromeLaunchSpec?.graphicsLaunchPolicy || null,
    gpuInfoCollectionResearch: gpuInfoCollectionMode === 'off' ? { mode: 'off' } : {
      mode: gpuInfoCollectionMode,
      launchReceipt: harness.chromeLaunchSpec.gpuInfoCollectionLaunch,
      beforeFixture: gpuInfoCollectionBeforeFixture,
    },
  });
  const reportPath = path.join(attachmentsDir, 'dashboard-boot.json');
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (summary.failedSampleCount > 0) {
    const error = new Error('QA_DASHBOARD_BOOT_HEALTH_FAILED');
    error.diagnostic = Object.freeze({
      reportPath,
      failedSampleIndexes: Object.freeze(samples
        .filter((sample) => sample.health?.status !== 'clean')
        .map((sample) => sample.sampleIndex)),
    });
    await evidence.event('QA_DASHBOARD_BOOT_FAILED', error.diagnostic);
    throw error;
  }
  if (modelTimingSummary.required && modelTimingSummary.incompleteSampleCount > 0) {
    const error = new Error('QA_DASHBOARD_BOOT_MODEL_TIMING_INCOMPLETE');
    error.diagnostic = Object.freeze({
      reportPath,
      incompleteSamples: Object.freeze(samples.filter(sample => sample.modelTiming.status === 'INCOMPLETE')
        .map(sample => ({ sampleIndex: sample.sampleIndex, reasons: sample.modelTiming.reasons }))),
    });
    await evidence.event('QA_DASHBOARD_BOOT_MODEL_TIMING_INCOMPLETE', error.diagnostic);
    throw error;
  }
  await evidence.event('QA_DASHBOARD_BOOT_FINISHED', {
    reportPath,
    moduleGraphPath,
    summary,
    pondStartupCostSummary,
    modelTimingSummary,
  });
  return Object.freeze({
    status: QA_RUN_STATUSES.PASS,
    protocol: 'dashboard_boot',
    request,
    reportPath,
    moduleGraphPath,
    artifactPreparation,
    summary,
    pondStartupCostSummary,
    modelTimingSummary,
  });
}

async function readDashboardResizeMetrics(harness, page, zenMainProfile) {
  if (!zenMainProfile) return { status: 'not_applicable' };
  return evaluate(harness.cdp, page.sessionId, `(async () => {
    const debug = globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG;
    if (typeof debug?.metrics !== 'function') return { status: 'unavailable' };
    const metrics = await debug.metrics();
    if (!metrics || metrics.error) return { status: 'unavailable', error: metrics?.error || null };
    return {
      status: 'observed',
      viewport: metrics.viewport,
      sampleFrames: metrics.sampleFrames,
      sceneSessionSyncCount: metrics.sceneSessionSyncCount,
      staticSceneSyncCount: metrics.staticSceneSyncCount,
      viewportReflowCount: metrics.viewportReflowCount,
      sceneLayout: metrics.sceneLayout,
      ambientPopulationSyncCount: metrics.ambientPopulationSyncCount,
      fishRosterSyncCount: metrics.fishRosterSyncCount,
    };
  })()`, { timeoutMs: 10_000 });
}

async function readDashboardPondWaterEffects(harness, page) {
  return evaluate(harness.cdp, page.sessionId, `(async () => {
    const debug = globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG;
    if (typeof debug?.metrics !== 'function') throw new Error('QA_DASHBOARD_WATER_EFFECTS_METRICS_UNAVAILABLE');
    const metrics = await debug.metrics();
    const probe = metrics?.mainMetrics?.waterEffects;
    if (metrics?.error || !Number.isFinite(metrics?.sampleFrames) || !probe || typeof probe !== 'object') {
      throw new Error('QA_DASHBOARD_WATER_EFFECTS_METRICS_INVALID');
    }
    return {
      checkpoint: 'before_final_screenshot', capturedAtMs: performance.now(),
      source: 'canonical_worker_metrics', sampleFrames: metrics.sampleFrames, viewport: metrics.viewport,
      caustics: {
        modelId: probe.surfaceFieldCausticModelId,
        requested: probe.surfaceFieldCausticsRequested,
        enabled: probe.surfaceFieldCausticsEnabled,
        suppressed: probe.surfaceFieldCausticsSuppressed,
        requestedStrength: probe.surfaceFieldCausticRequestedStrength,
        strength: probe.surfaceFieldCausticStrength,
        drawCount: probe.surfaceFieldCausticDrawCount,
        receiverModelId: probe.surfaceFieldCausticReceiverModelId,
        legacyLayerGate: probe.causticGate,
      },
      yoonseul: {
        modelId: probe.surfaceFieldYoonseulModelId,
        enabled: probe.yoonseulEnabled, drive: probe.yoonseulDrive,
        intensity: probe.yoonseulIntensity, opacity: probe.yoonseulOpacity,
        time: probe.yoonseulTime,
      },
      probe,
      scope: 'One current Worker metric snapshot before screenshot; independent of first-frame ACK. No GPU readback or exact compositor-frame identity.',
    };
  })()`, { timeoutMs: 10_000 });
}

async function waitForDashboardPondResizeFrame(harness, page, request, signal) {
  const deadline = Date.now() + 20_000;
  let currentFrameCount = null, snapshot = null, metrics = null;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    snapshot = await inspectDashboardCapture(harness, page, request);
    metrics = await readDashboardResizeMetrics(harness, page, request.zenMainProfile);
    if (isCurrentDashboardPondViewport(snapshot, metrics)) {
      if (currentFrameCount !== null && metrics.sampleFrames > currentFrameCount) return;
      currentFrameCount = metrics.sampleFrames;
    } else currentFrameCount = null;
    await sleep(100);
  }
  const error = new Error('QA_DASHBOARD_POND_RESIZE_FRAME_STALE');
  error.diagnostic = { viewport: snapshot?.viewport, canvas: snapshot?.pondCanvas, metrics };
  throw error;
}

async function waitForDashboardBonsaiResizeFrame(harness, page, request, before, signal) {
  const deadline = Date.now() + 20_000;
  let snapshot = null, frame = null;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    snapshot = await inspectDashboardCapture(harness, page, request);
    frame = projectDashboardBonsaiResizeFrame({ before, after: snapshot, request });
    if (frame.status === 'unavailable' || (frame.status === 'ready' && isCaptureReady(snapshot, request))) {
      return { snapshot, frame };
    }
    await sleep(100);
  }
  const error = new Error('QA_DASHBOARD_BONSAI_RESIZE_FRAME_STALE');
  error.diagnostic = { viewport: snapshot?.viewport, canvas: snapshot?.bonsaiCanvas, frame };
  throw error;
}

export function requireDashboardCaptureSettingsSection({ surfaceId, settingsSection }) {
  if (settingsSection !== undefined && !['workspace', 'protection', 'permissions', 'safety'].includes(settingsSection)) {
    throw new Error('QA_DASHBOARD_SETTINGS_SECTION_INVALID');
  }
  if (surfaceId !== 'settings') {
    if (settingsSection !== undefined) throw new Error('QA_DASHBOARD_SETTINGS_SECTION_REQUIRES_SETTINGS');
    return undefined;
  }
  return settingsSection === undefined ? 'workspace' : settingsSection;
}

async function executeDashboardCaptureProtocol({
  plan,
  artifact,
  browser,
  evidence,
  attachmentsDir,
  registerCleanup,
  reportBrowserGpuCapability,
  signal,
  recoveryJournal,
}) {
  signal?.throwIfAborted();
  const initialViewport = resolveDashboardCaptureViewport(plan.parameters.viewport);
  const resizeViewport = plan.parameters.resizeTo === undefined
    ? null : resolveDashboardCaptureViewport(plan.parameters.resizeTo);
  const captureViewport = resizeViewport === null ? initialViewport : resizeViewport;
  const surface = requireDashboardCaptureSurface(plan.parameters.surface);
  const settingsSection = requireDashboardCaptureSettingsSection({ surfaceId: surface.id, settingsSection: plan.parameters.settingsSection });
  const sitesRecordingScenario = requireSitesRecordingScenario({
    scenario: plan.parameters.sitesScenario, surface: surface.id, resizeTo: plan.parameters.resizeTo,
  });
  const sitesObservedReadingRefresh = plan.parameters.sitesScenario === 'observed-reading-refresh';
  const themeId = requireDashboardCaptureThemeId(plan.parameters.theme);
  if (sitesObservedReadingRefresh && themeId !== 'zen') throw new Error('QA_SITES_OBSERVED_REFRESH_REQUIRES_ZEN');
  if (surface.id === 'pond-lab' && themeId !== 'zen') throw new Error('QA_POND_LAB_REQUIRES_ZEN');
  if (plan.parameters.artifactJourney && (surface.id !== 'artifacts' || themeId !== 'zen')) throw new Error('QA_ARTIFACT_JOURNEY_REQUIRES_ZEN_ARTIFACTS');
  if (plan.parameters.artifactRuntimeJourney && surface.id !== 'artifacts') throw new Error('QA_ARTIFACT_RUNTIME_REQUIRES_ARTIFACTS');
  const artifactEntryJourney = plan.parameters.artifactEntryJourney === true;
  const artifactEntryFrom = plan.parameters.artifactEntryFrom;
  if (artifactEntryFrom !== 'sites' && !artifactEntryJourney) throw new Error('QA_ARTIFACT_ENTRY_FROM_REQUIRES_ENTRY_JOURNEY');
  const artifactStartupDiagnostics = plan.parameters.artifactStartupDiagnostics === true;
  const artifactUiDiagnostics = plan.parameters.artifactUiDiagnostics === true;
  const artifactUiExperiment = plan.parameters.artifactUiExperiment;
  if (artifactUiExperiment !== 'none' && !artifactUiDiagnostics) throw new Error('QA_ARTIFACT_UI_EXPERIMENT_REQUIRES_DIAGNOSTICS');
  if (artifactUiDiagnostics && !artifactEntryJourney) throw new Error('QA_ARTIFACT_UI_DIAGNOSTICS_REQUIRES_ENTRY_JOURNEY');
  if (artifactStartupDiagnostics && !artifactEntryJourney) throw new Error('QA_ARTIFACT_STARTUP_DIAGNOSTICS_REQUIRES_ENTRY_JOURNEY');
  if (artifactEntryJourney && (surface.id !== 'artifacts' || themeId !== 'zen' || resizeViewport)) {
    throw new Error('QA_ARTIFACT_ENTRY_REQUIRES_ZEN_ARTIFACTS_WITHOUT_RESIZE');
  }
  const firstVisionJourney = plan.parameters.firstVisionJourney === true;
  const developmentToolsJourney = plan.parameters.developmentToolsJourney === true;
  const bonsaiDebugJourney = plan.parameters.bonsaiDebugJourney === true;
  if (bonsaiDebugJourney && (surface.id !== 'main' || themeId !== 'zen'
    || initialViewport.width <= initialViewport.height || captureViewport.width <= captureViewport.height
    || firstVisionJourney || plan.parameters.firstSiteJourney || plan.parameters.mainReturnJourney
    || plan.parameters.pressureRailJourney || developmentToolsJourney)) {
    throw new Error('QA_BONSAI_DEBUG_JOURNEY_REQUIRES_ISOLATED_LANDSCAPE_ZEN_MAIN');
  }
  if (developmentToolsJourney && (surface.id !== 'main' || themeId !== 'zen'
    || initialViewport.width <= initialViewport.height || captureViewport.width <= captureViewport.height
    || firstVisionJourney || plan.parameters.firstSiteJourney || plan.parameters.mainReturnJourney
    || plan.parameters.pressureRailJourney)) {
    throw new Error('QA_DEVELOPMENT_TOOLS_JOURNEY_REQUIRES_ISOLATED_LANDSCAPE_ZEN_MAIN');
  }
  const firstSiteJourney = plan.parameters.firstSiteJourney === true;
  const firstSiteUiDiagnostics = plan.parameters.firstSiteUiDiagnostics === true;
  if (firstSiteUiDiagnostics && !firstSiteJourney) throw new Error('QA_FIRST_SITE_DIAGNOSTICS_REQUIRES_JOURNEY');
  if (firstSiteJourney && (surface.id !== 'main' || themeId !== 'zen' || resizeViewport
    || plan.parameters.mainReturnJourney || artifactEntryJourney)) {
    throw new Error('QA_FIRST_SITE_JOURNEY_REQUIRES_ISOLATED_ZEN_MAIN');
  }
  if (firstVisionJourney && (surface.id !== 'main' || themeId !== 'zen' || resizeViewport)) {
    throw new Error('QA_FIRST_VISION_JOURNEY_REQUIRES_ZEN_MAIN_WITHOUT_RESIZE');
  }
  const mainReturnJourney = requireMainReturnJourney({
    enabled: plan.parameters.mainReturnJourney, surface: surface.id, theme: themeId,
    resizeTo: plan.parameters.resizeTo, firstVisionJourney,
  });
  const pressureRailJourney = requirePressureRailJourney({
    enabled: plan.parameters.pressureRailJourney, surface: surface.id, theme: themeId,
    pressureState: plan.parameters.pressureState, koiState: plan.parameters.koiState,
    firstVisionJourney, firstSiteJourney, mainReturnJourney,
  });
  const zenMainProfile = surface.id === 'main' && themeId === 'zen' && !firstVisionJourney && !firstSiteJourney && !bonsaiDebugJourney
    ? normalizeZenMainCaptureInput({
        koiState: plan.parameters.koiState,
        bonsaiState: plan.parameters.bonsaiState,
        appearanceTime: plan.parameters.appearanceTime,
        weather: plan.parameters.weather,
        pressureState: plan.parameters.pressureState,
        pondEffectProfile: plan.parameters.pondEffectProfile,
      })
    : null;
  const request = Object.freeze({
    surfaceId: surface.id,
    tabId: surface.tabId,
    ...(settingsSection === undefined ? {} : { settingsSection }),
    themeId,
    locale: plan.parameters.locale,
    zenMainProfile,
    viewport: initialViewport,
    viewportName: plan.parameters.viewport,
    resizeTo: plan.parameters.resizeTo ?? null,
    firstVisionJourney,
    developmentToolsJourney,
    bonsaiDebugJourney,
    firstSiteJourney,
    mainReturnJourney,
    pressureRailJourney,
    sitesScenario: plan.parameters.sitesScenario,
  });
  // Initial entry and the existing layout/navigation journey visit other
  // sections. The final request requires the declared section's own content.
  const entryRequest = settingsSection === undefined ? request : Object.freeze({ ...request, settingsSection: undefined });
  const harness = createDashboardHarness({
    plan,
    artifact,
    browser,
    recoveryJournal,
    tempPrefix: 'entropy-dashboard-capture-qa-',
    temporaryManifest: firstSiteJourney ? FIRST_SITE_TEMPORARY_MANIFEST : null,
  });
  registerCleanup('dashboard_capture_browser', () => harness.close());
  await fs.mkdir(attachmentsDir, { recursive: true });
  await evidence.event('QA_DASHBOARD_CAPTURE_STARTED', {
    request,
    viewport: initialViewport,
    presentation: plan.browserExecution.presentation,
  });
  await harness.start();
  await reportBrowserGpuCapability(harness.gpuCapability);
  let page = null;
  let pageDiagnostics = null;
  let captureStateCommit = null;
  let readySnapshot = null;
  let finalSnapshot = null;
  let screenshotPath = null;
  let reportPath = null;
  let bootReportPath = null;
  let resizeEvidence = null;
  let artifactJourney = null;
  let artifactRuntimeJourney = null;
  let artifactEntry = null;
  let pondLabJourney = null;
  let sitesRecordingJourney = null;
  let sitesIntelJourney = null;
  let sitesObservedReadingRefreshJourney = null;
  let mainReturnEvidence = null;
  let firstSitePrepared = null;
  let firstSiteEvidence = null;
  let pressureRailJourneyEvidence = null;

  try {
    captureStateCommit = await prepareDashboardCaptureState(harness, {
      surfaceId: surface.id,
      themeId,
      zenMainProfile,
        artifactRuntimeJourney: plan.parameters.artifactRuntimeJourney,
    });
    await evidence.event('QA_DASHBOARD_CAPTURE_STATE_COMMITTED', captureStateCommit);
    if (request.locale !== undefined) {
      await evidence.event('QA_DASHBOARD_CAPTURE_LOCALE_COMMITTED',
        await commitDashboardCaptureLocale(message => sendTrustedRuntimeMessage(harness, message), request.locale));
    }
    if (pressureRailJourney) await evidence.event('QA_PRESSURE_RAIL_LEDGER_FIXTURE_COMMITTED',
      await preparePressureRailLedgerFixture(message => sendTrustedRuntimeMessage(harness, message)));
    if (sitesRecordingScenario || sitesObservedReadingRefresh) await prepareSitesRecordingJourney(message => sendTrustedRuntimeMessage(harness, message));
    if (firstVisionJourney || firstSiteJourney) {
      const response = await sendTrustedRuntimeMessage(harness, {
        action: PROGRESSION_DEBUG_ACTIONS.SET_UNLOCK_MODE,
        mode: firstSiteJourney ? 'canonical' : 'first_vision_preview',
        dayCount: firstSiteJourney ? null : PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT,
        profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH,
      });
      if (response?.success !== true || response.profileGeneration !== MODEL_STATE_INITIAL_PROFILE_EPOCH) {
        throw new Error('QA_FIRST_VISION_PREVIEW_COMMIT_FAILED');
      }
    }
    if (firstSiteJourney) {
      firstSitePrepared = await prepareDashboardFirstSiteJourney(message => sendTrustedRuntimeMessage(harness, message));
      await evidence.event('QA_FIRST_SITE_ADMISSION_OBSERVED', firstSitePrepared);
    }
    const captureSearchParams = firstSiteJourney
      ? new URLSearchParams(buildSiteRegistrationPath({ domain: FIRST_SITE_FIXTURE_DOMAIN }).split('?')[1])
      : artifactEntryJourney
      ? new URLSearchParams(artifactEntryFrom === 'sites' ? { tab: 'sites', domain: 'youtube.com' } : { tab: 'main' })
      : zenMainProfile
      ? buildDashboardBootSearchParams(zenMainProfile, 'full')
      : (surface.id === 'sites'
        ? new URLSearchParams(plan.parameters.sitesScenario === 'intel-reading' || sitesObservedReadingRefresh
          ? { tab: 'sites', domain: 'youtube.com' } : { tab: 'sites' })
        : new URLSearchParams({ tab: surface.tabId }));
    captureSearchParams.set('entropy-qa-boot-trace', 'full');
    if (developmentToolsJourney) captureSearchParams.set(ZEN_MAIN_CAPTURE_DEVELOPMENT_TOOLS_PARAM, 'true');
    if (plan.parameters.sitesScenario === 'intel-reading') captureSearchParams.set('entropy-qa-sites-intel', 'long');
    if (sitesObservedReadingRefresh) captureSearchParams.set('entropy-qa-sites-intel', 'mixed');
    const dashboardUrl = buildDashboardUrl(harness, captureSearchParams);
    page = await harness.openPage('about:blank', { active: true, timeoutMs: 45_000 });
    await configurePage(harness, page, initialViewport);
    pageDiagnostics = createDashboardPageDiagnostics({
      cdp: harness.cdp,
      sessionId: page.sessionId,
    });
    registerCleanup('dashboard_capture_observers', () => pageDiagnostics.dispose());
    registerCleanup('dashboard_capture_native_preparation', () => pageDiagnostics.stopNativePagePreparation());
    await pageDiagnostics.enable();
    await evidence.event('QA_DASHBOARD_NATIVE_PAGE_PREPARED', await pageDiagnostics.prepareNativePage(harness, page));
    await pageDiagnostics.capturePerformanceCheckpoint('session_ready');
    pageDiagnostics.markNavigationRequested();
    await evidence.event('QA_DASHBOARD_CAPTURE_NAVIGATION_STARTED', {
      request,
      route: '/src/pages/dashboard.html',
    });
    await harness.navigatePage(page, dashboardUrl, { timeoutMs: 45_000 });
    await pageDiagnostics.requireNativePageVisible('navigation_complete');
    await waitForPageReady(harness.cdp, page.sessionId, READY_TIMEOUT_MS);
    await pageDiagnostics.capturePerformanceCheckpoint('document_loaded');
    if (firstVisionJourney) {
      const phases = [];
      const petalSamples = [];
      const capturedPhases = new Set();
      const deadline = Date.now() + READY_TIMEOUT_MS;
      while (Date.now() < deadline) {
        signal?.throwIfAborted();
        await pageDiagnostics.requireNativePageVisible('first_vision_ready_wait');
        const snapshot = await inspectDashboardCapture(harness, page, request);
        const decisions = snapshot.boot.zenTraceHistory.filter(entry => (
          entry.event === 'dashboard_page:main_presentation_decision'
        ));
        for (const entry of decisions) {
          if (!phases.includes(entry.details.phase)) phases.push(entry.details.phase);
        }
        // Read the phase committed with the rendered petal props. Trace effects
        // may still describe the previous commit while the DOM is already new.
        const phase = snapshot.presentationPhase;
        petalSamples.push({ phase, fields: snapshot.petalFields });
        if (phase === 'presenting' && snapshot.petalFields.some(field => field.count >= 3)
          && !capturedPhases.has('petals')) {
          await captureScreenshot(harness, page, path.join(attachmentsDir, 'first-vision-petals.png'));
          capturedPhases.add('petals');
        }
        if (['presenting', 'preparing_current', 'settled'].includes(phase) && !capturedPhases.has(phase)) {
          await captureScreenshot(harness, page, path.join(attachmentsDir, `first-vision-${phase}.png`));
          capturedPhases.add(phase);
        }
        // DOM commit can precede the trace effect for the same phase. Keep
        // sampling until the terminal painted state and owner trace agree.
        if ((phase === 'settled' && phases.includes('settled')) || phase === 'deferred') break;
        await sleep(120);
      }
      await fs.writeFile(path.join(attachmentsDir, 'first-vision-journey.json'), JSON.stringify({ phases, petalSamples }, null, 2));
      const fields = petalSamples.flatMap(sample => sample.fields);
      const petalContinuity = petalSamples.every(sample => sample.fields.length <= 1)
        && fields.length > 0 && new Set(fields.map(field => field.id)).size === 1
        && fields.every(field => field.status === 'ready' && field.count <= MAX_ZEN_APP_PETALS)
        && fields.some(field => field.mode === 'opening' && field.count > 0)
        && petalSamples.some(sample => sample.phase === 'settled' && sample.fields[0]?.mode === 'ambient')
        && petalSamples.filter(sample => ['covering', 'preparing_current', 'current_committed', 'uncovering'].includes(sample.phase))
          .every(sample => sample.fields.every(field => field.landingEnabled === false));
      await evidence.event('QA_FIRST_VISION_JOURNEY_OBSERVED', { phases, petalContinuity });
      const required = ['preparing_first_vision', 'first_vision_committed', 'presenting', 'covering', 'preparing_current', 'current_committed', 'uncovering', 'settled'];
      const completedInOrder = required.every((phase, index) => (
        phases.indexOf(phase) >= 0
        && (index === 0 || phases.indexOf(phase) > phases.indexOf(required[index - 1]))
      ));
      if (!completedInOrder) {
        throw new Error(`QA_FIRST_VISION_JOURNEY_INCOMPLETE:${phases.join(',')}`);
      }
      if (!petalContinuity) throw new Error('QA_FIRST_VISION_PETAL_CONTINUITY_FAILED');
    }
    if (surface.id === 'pond-lab') await openDashboardPondLab(harness, page);
    if (artifactEntryJourney) {
      const originSnapshot = await waitForCaptureReady(harness, page,
        { ...request, surfaceId: artifactEntryFrom, tabId: artifactEntryFrom }, signal, isArtifactEntryOriginReady, pageDiagnostics);
      await sleep(plan.parameters.settleMs);
      const runEntry = () => runDashboardArtifactEntryJourney(harness, page, { startupDiagnostics: artifactStartupDiagnostics, uiDiagnostics: artifactUiDiagnostics, uiExperiment: artifactUiExperiment, fromTab: artifactEntryFrom });
      artifactEntry = artifactUiDiagnostics ? await captureArtifactUiCpuProfile({ harness, page,
        outputPath: path.join(attachmentsDir, 'dashboard-artifact-entry.cpuprofile'),
        traceOutputPath: path.join(attachmentsDir, 'dashboard-artifact-entry.trace.json'), run: runEntry }) : await runEntry();
      artifactEntry.originReadiness = { tabId: artifactEntryFrom, boot: originSnapshot.boot.snapshot };
      await fs.writeFile(path.join(attachmentsDir, 'dashboard-artifact-entry.json'), JSON.stringify(artifactEntry, null, 2));
      await evidence.event('QA_DASHBOARD_ARTIFACT_ENTRY_FINISHED', { samples: artifactEntry.samples.length });
    }
    // Sites journeys exercise real input ownership. Painted DOM can precede
    // the boot owner's input release, so admit their first action only after
    // shell dismissal and removal of root inertness within the same wait.
    const captureReadiness = sitesRecordingScenario || sitesObservedReadingRefresh || plan.parameters.sitesScenario === 'intel-reading'
      ? isCaptureInteractiveReady : isCaptureReady;
    readySnapshot = await waitForCaptureReady(harness, page, entryRequest, signal, captureReadiness, pageDiagnostics);
    await pageDiagnostics.requireNativePageVisible('capture_ready');
    await pageDiagnostics.stopNativePagePreparation();
    if (surface.id === 'schedule') {
      // The product opens today's rhythm; this fixture edits weekday windows.
      await evaluate(harness.cdp, page.sessionId, `(() => {
        const rhythm = document.querySelector('[role="tab"][data-schedule-rhythm-identity="rhythm-1"]');
        if (!rhythm) throw new Error('QA_DASHBOARD_SCHEDULE_RHYTHM_MISSING');
        rhythm.click();
      })()`);
      readySnapshot = await waitForCaptureReady(harness, page, request, signal,
        (snapshot, captureRequest) => isCaptureReady(snapshot, captureRequest)
          && snapshot.schedule.blocks.some(block => block.id === 'qa-evening'));
      await evaluate(harness.cdp, page.sessionId, `(() => {
        const block = document.querySelector('button[data-schedule-block-id="qa-evening"]');
        if (!block) throw new Error('QA_DASHBOARD_SCHEDULE_WINDOW_MISSING');
        block.click();
      })()`);
      readySnapshot = await waitForCaptureReady(harness, page, request, signal,
        (snapshot, captureRequest) => isCaptureReady(snapshot, captureRequest) && snapshot.schedule?.selected === true);
      await captureScreenshot(harness, page, path.join(attachmentsDir, 'dashboard-schedule-relaxation.png'));
      await evaluate(harness.cdp, page.sessionId, `(() => {
        const block = document.querySelector('button[data-schedule-block-id="qa-writing"]');
        if (!block) throw new Error('QA_DASHBOARD_SCHEDULE_ISOLATION_MISSING');
        block.click();
      })()`);
      readySnapshot = await waitForCaptureReady(harness, page, request, signal,
        (snapshot, captureRequest) => isCaptureReady(snapshot, captureRequest)
          && snapshot.schedule?.selectedIntent === 'isolation' && snapshot.schedule?.modeCount === 2
          && snapshot.schedule.workbenchAnimationsActive === false);
      const schedule = readySnapshot.schedule;
      if (schedule.blocks.some(block => Math.abs(block.rect.y - schedule.track.y) > 2
        || Math.abs(block.rect.height - schedule.track.height) > 2)) throw new Error('QA_DASHBOARD_SCHEDULE_BLOCK_HIT_HEIGHT_INCOMPLETE');
      if (schedule.controls.some(control => control.rect.x < 0 || control.rect.x + control.rect.width > request.viewport.width)) {
        throw new Error('QA_DASHBOARD_SCHEDULE_CONTROL_CLIPPED');
      }
      const optionAnchors = { closed: schedule };
      if (schedule.optionsExpanded) throw new Error('QA_DASHBOARD_SCHEDULE_OPTIONS_INITIAL_STATE_INVALID');
      for (const expanded of [true, false]) {
        await evaluate(harness.cdp, page.sessionId, `(() => {
          const control = document.querySelector('[data-schedule-workbench] button[aria-expanded][aria-controls]');
          if (!control) throw new Error('QA_DASHBOARD_SCHEDULE_OPTIONS_CONTROL_MISSING');
          if ((control.getAttribute('aria-expanded') === 'true') !== ${expanded}) control.click();
        })()`);
        readySnapshot = await waitForCaptureReady(harness, page, request, signal,
          (snapshot, captureRequest) => isCaptureReady(snapshot, captureRequest)
            && snapshot.schedule?.optionsExpanded === expanded
            && snapshot.schedule.workbenchAnimationsActive === false);
        optionAnchors[expanded ? 'expanded' : 'restored'] = readySnapshot.schedule;
      }
      if (!(optionAnchors.expanded.workbench.height > schedule.workbench.height)) {
        throw new Error('QA_DASHBOARD_SCHEDULE_OPTIONS_CONTENT_NOT_EXPANDED');
      }
      if (schedule.expectsTopAlignment) {
        for (const state of Object.values(optionAnchors)) {
          if (state.stageAlignment !== 'flex-start') throw new Error('QA_DASHBOARD_SCHEDULE_STAGE_ALIGNMENT_INVALID');
          for (const key of ['rhythm', 'track', 'workbench']) {
            if (!state[key] || !schedule[key]
              || ['x', 'y', 'width'].some(axis => Math.abs(state[key][axis] - schedule[key][axis]) > 0.25)) {
              throw new Error(`QA_DASHBOARD_SCHEDULE_OPTIONS_ANCHOR_MOVED:${key}`);
            }
          }
        }
      }
      await evidence.event('QA_DASHBOARD_SCHEDULE_OPTIONS_STABILITY', {
        topAligned: schedule.expectsTopAlignment,
        states: Object.fromEntries(Object.entries(optionAnchors).map(([state, sample]) => [state, {
          expanded: sample.optionsExpanded, alignment: sample.stageAlignment,
          workbenchAnimationsActive: sample.workbenchAnimationsActive,
          rhythm: sample.rhythm, track: sample.track, workbench: sample.workbench,
        }])),
      });
      await evidence.event('QA_DASHBOARD_SCHEDULE_EDITOR_READY', schedule);
    }
    if (surface.id === 'settings') {
      await evaluate(harness.cdp, page.sessionId, `(() => {
        const owner = document.getElementById('settings-content-area');
        if (!owner) throw new Error('QA_DASHBOARD_SETTINGS_SCROLL_OWNER_MISSING');
        globalThis.__entropyQaSettingsScrollOwner = owner;
      })()`);
      const settingsNavigation = [];
      for (const targetSection of ['safety', 'workspace']) {
        await evaluate(harness.cdp, page.sessionId, `(() => {
          const control = document.querySelector('#settings nav button[data-settings-section-id="permissions"]');
          if (!control) throw new Error('QA_DASHBOARD_SETTINGS_PERMISSIONS_CONTROL_MISSING');
          control.click();
        })()`);
        const folded = await waitForCaptureReady(harness, page, entryRequest, signal,
          (snapshot, captureRequest) => isCaptureReady(snapshot, captureRequest)
            && snapshot.settings?.sectionId === 'permissions' && !snapshot.settings.sectionLoading);
        await evaluate(harness.cdp, page.sessionId, `(() => {
          for (const summary of document.querySelectorAll('#settings-content-area details:not([open]) > summary')) summary.click();
        })()`);
        await waitForCaptureReady(harness, page, entryRequest, signal,
          (snapshot, captureRequest) => isCaptureReady(snapshot, captureRequest)
            && snapshot.settings?.closedDisclosureCount === 0);
        await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
        const expanded = await inspectDashboardCapture(harness, page, request);
        if (!folded.settings.reading || !expanded.settings.reading
          || ['x', 'width'].some(axis => Math.abs(folded.settings.reading[axis] - expanded.settings.reading[axis]) > 0.25)) {
          throw new Error('QA_DASHBOARD_SETTINGS_DISCLOSURE_READING_WIDTH_MOVED');
        }
        const contentCenter = expanded.settings.content.x + expanded.settings.content.width / 2;
        const readingCenter = expanded.settings.reading.x + expanded.settings.reading.width / 2;
        if (Math.abs(contentCenter - readingCenter) > 0.25) {
          throw new Error('QA_DASHBOARD_SETTINGS_READING_CENTER_MISALIGNED');
        }
        const origin = await evaluate(harness.cdp, page.sessionId, `(() => {
          const owner = document.getElementById('settings-content-area');
          if (owner !== globalThis.__entropyQaSettingsScrollOwner) throw new Error('QA_DASHBOARD_SETTINGS_SCROLL_OWNER_REPLACED');
          owner.scrollTop = Math.min(96, owner.scrollHeight - owner.clientHeight);
          document.querySelector('#settings nav button[data-settings-section-id="permissions"]').click();
          return { scrollTop: owner.scrollTop, scrollable: owner.scrollHeight > owner.clientHeight };
        })()`);
        await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
        const repeated = await inspectDashboardCapture(harness, page, request);
        if (Math.abs(repeated.settings.scrollTop - origin.scrollTop) > 0.25) {
          throw new Error('QA_DASHBOARD_SETTINGS_SAME_SECTION_SCROLL_RESET');
        }
        await evaluate(harness.cdp, page.sessionId, `(() => {
          const control = document.querySelector('#settings nav button[data-settings-section-id="${targetSection}"]');
          if (!control) throw new Error('QA_DASHBOARD_SETTINGS_SECTION_CONTROL_MISSING');
          control.click();
        })()`);
        readySnapshot = await waitForCaptureReady(harness, page, entryRequest, signal,
          (snapshot, captureRequest) => isCaptureReady(snapshot, captureRequest)
            && snapshot.settings?.sectionId === targetSection && !snapshot.settings.sectionLoading);
        const sameOwner = await evaluate(harness.cdp, page.sessionId,
          'document.getElementById("settings-content-area") === globalThis.__entropyQaSettingsScrollOwner');
        if (!sameOwner) throw new Error('QA_DASHBOARD_SETTINGS_SCROLL_OWNER_REPLACED');
        if (Math.abs(readySnapshot.settings.scrollTop) > 0.25) throw new Error('QA_DASHBOARD_SETTINGS_SECTION_SCROLL_NOT_RESET');
        settingsNavigation.push({ targetSection, sameOwner, origin, repeatedScrollTop: repeated.settings.scrollTop,
          targetScrollTop: readySnapshot.settings.scrollTop,
          readingBounds: { folded: folded.settings.reading, expanded: expanded.settings.reading },
          scrollbarGutter: expanded.settings.scrollbarGutter });
      }
      await evaluate(harness.cdp, page.sessionId, 'delete globalThis.__entropyQaSettingsScrollOwner');
      await evidence.event('QA_DASHBOARD_SETTINGS_SECTION_NAVIGATION', { transitions: settingsNavigation });
      await evaluate(harness.cdp, page.sessionId, `(() => {
        const control = document.querySelector('#settings nav button[data-settings-section-id="${settingsSection}"]');
        if (!control) throw new Error('QA_DASHBOARD_SETTINGS_SECTION_CONTROL_MISSING');
        control.click();
      })()`);
      readySnapshot = await waitForCaptureReady(harness, page, request, signal);
      await evidence.event('QA_DASHBOARD_SETTINGS_SECTION_SELECTED', { requestedSection: settingsSection,
        actualSection: readySnapshot.settings.sectionId, sectionLoading: readySnapshot.settings.sectionLoading });
    }
    pageDiagnostics.markCaptureReady();
    await pageDiagnostics.capturePerformanceCheckpoint('capture_ready');
    await evidence.event('QA_DASHBOARD_CAPTURE_READY', readySnapshot);
    await sleep(plan.parameters.settleMs);
    signal?.throwIfAborted();
    if (firstSiteJourney) {
      firstSiteEvidence = await observeDashboardRegistrationTiming({ harness, page,
          cpuProfilePath: firstSiteUiDiagnostics ? path.join(attachmentsDir, 'first-site-ui.cpuprofile') : null,
          record: timings => fs.writeFile(path.join(attachmentsDir, 'first-site-settings-timings.json'), JSON.stringify(timings, null, 2)),
        run: () => runDashboardFirstSiteJourney({ harness, page,
            send: message => sendTrustedRuntimeMessage(harness, message), prepared: firstSitePrepared,
            waitForSettled: () => waitForCaptureReady(harness, page, request, signal),
            capture: name => captureScreenshot(harness, page, path.join(attachmentsDir, `first-site-${name}.png`)) }) });
      await fs.writeFile(path.join(attachmentsDir, 'first-site-journey.json'), JSON.stringify(firstSiteEvidence, null, 2));
      await evidence.event('QA_FIRST_SITE_JOURNEY_OBSERVED', { completed: true, ...firstSiteEvidence });
    }
    if (mainReturnJourney) {
      await waitForCaptureReady(harness, page, request, signal, isArtifactEntryOriginReady);
      mainReturnEvidence = await runDashboardMainReturnJourney({
        harness, page, signal,
        browserAwayMs: plan.parameters.mainReturnAwayMs,
        capture: async kind => {
          const imagePath = path.join(attachmentsDir, 'dashboard-main-' + kind + '.png');
          await captureScreenshot(harness, page, imagePath);
          return imagePath;
        },
        record: result => fs.writeFile(path.join(attachmentsDir, 'dashboard-main-return-journey.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8'),
      });
      await evidence.event('QA_DASHBOARD_MAIN_RETURN_JOURNEY_FINISHED', {
        samples: mainReturnEvidence.samples.length,
      });
    }
    const captureRequest = resizeViewport ? { ...request, viewport: resizeViewport } : request;
    const checkDevelopmentTools = async stage => {
      const layoutRequest = stage === 'initial' ? request : captureRequest;
      let layoutBaseline = await inspectDashboardCapture(harness, page, layoutRequest);
      const result = await runDashboardDevelopmentToolsJourney({
        harness, page, signal,
        settleLayout: async () => {
          await waitForDashboardPondResizeFrame(harness, page, layoutRequest, signal);
          const settled = await waitForDashboardBonsaiResizeFrame(harness, page, layoutRequest, layoutBaseline, signal);
          layoutBaseline = settled.snapshot;
          return settled.frame;
        },
        capture: async kind => {
          const imagePath = path.join(attachmentsDir, `development-tools-${stage}-${kind}.png`);
          await captureScreenshot(harness, page, imagePath);
          return imagePath;
        },
        record: result => fs.writeFile(path.join(attachmentsDir, `development-tools-${stage}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8'),
      });
      await evidence.event('QA_DASHBOARD_DEVELOPMENT_TOOLS_JOURNEY_FINISHED', { stage, completed: result.completed });
      await waitForCaptureReady(harness, page, layoutRequest, signal);
    };
    if (developmentToolsJourney) await checkDevelopmentTools('initial');
    if (resizeViewport) {
      const before = await inspectDashboardCapture(harness, page, request);
      const metricsBefore = await readDashboardResizeMetrics(harness, page, zenMainProfile);
      const beforeResizeImage = path.join(attachmentsDir, `dashboard-${surface.id}-before-resize.png`);
      await captureScreenshot(harness, page, beforeResizeImage);
      await evidence.event('QA_DASHBOARD_CAPTURE_RESIZE_STARTED', {
        pageTargetId: page.targetId, from: initialViewport, to: resizeViewport, beforeResizeImage,
      });
      await configurePage(harness, page, resizeViewport);
      await waitForCaptureReady(harness, page, captureRequest, signal);
      await sleep(plan.parameters.settleMs);
      if (zenMainProfile) await waitForDashboardPondResizeFrame(harness, page, captureRequest, signal);
      signal?.throwIfAborted();
      const bonsaiResize = themeId === 'zen' && ['main', 'sites'].includes(surface.id)
        ? await waitForDashboardBonsaiResizeFrame(harness, page, captureRequest, before, signal)
        : null;
      finalSnapshot = bonsaiResize ? bonsaiResize.snapshot : await inspectDashboardCapture(harness, page, captureRequest);
      const metricsAfter = await readDashboardResizeMetrics(harness, page, zenMainProfile);
      resizeEvidence = Object.freeze({ ...buildDashboardResizeEvidence({
        before, after: finalSnapshot, from: initialViewport, to: resizeViewport,
        pageTargetId: page.targetId, zenMainProfile, metricsBefore, metricsAfter,
      }), ...(bonsaiResize ? { bonsaiFrame: bonsaiResize.frame } : {}) });
      await evidence.event('QA_DASHBOARD_CAPTURE_RESIZE_FINISHED', resizeEvidence);
      await fs.writeFile(path.join(attachmentsDir, 'dashboard-resize.json'), `${JSON.stringify(resizeEvidence, null, 2)}\n`, 'utf8');
      if (!resizeEvidence.viewportApplied || !resizeEvidence.sameDocument
        || (zenMainProfile && resizeEvidence.pondIdentity.status !== 'preserved')) {
        const error = new Error('QA_DASHBOARD_CAPTURE_RESIZE_IDENTITY_FAILED');
        error.diagnostic = resizeEvidence;
        throw error;
      }
    } else {
      finalSnapshot = await inspectDashboardCapture(harness, page, request);
    }
    if (bonsaiDebugJourney) {
      let debugLayoutBaseline = await inspectDashboardCapture(harness, page, captureRequest);
      const result = await runDashboardBonsaiDebugJourney({ harness, page, signal,
        settleLayout: async () => {
          const current = await inspectDashboardCapture(harness, page, captureRequest);
          const before = debugLayoutBaseline.bonsaiCanvas, after = current.bonsaiCanvas;
          const sameSize = before?.rect.width === after?.rect.width && before?.rect.height === after?.rect.height
            && before?.width === after?.width && before?.height === after?.height;
          const settled = sameSize
            ? { snapshot: await waitForCaptureReady(harness, page, captureRequest, signal),
                frame: { status: 'retained', evidence: 'unchanged_canvas_geometry' } }
            : await waitForDashboardBonsaiResizeFrame(harness, page, captureRequest, debugLayoutBaseline, signal);
          debugLayoutBaseline = settled.snapshot;
          await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
          return settled.frame;
        },
        capture: async kind => {
          const imagePath = path.join(attachmentsDir, `bonsai-debug-${kind}.png`);
          await captureScreenshot(harness, page, imagePath); return imagePath;
        },
        record: result => fs.writeFile(path.join(attachmentsDir, 'bonsai-debug-journey.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8'),
      });
      await evidence.event('QA_DASHBOARD_BONSAI_DEBUG_JOURNEY_FINISHED', { completed: result.completed });
      finalSnapshot = await waitForCaptureReady(harness, page, captureRequest, signal);
    }
    if (developmentToolsJourney && resizeViewport) {
      await checkDevelopmentTools('resized');
      finalSnapshot = await inspectDashboardCapture(harness, page, captureRequest);
    }
    if (pressureRailJourney) {
      await evidence.event('QA_DASHBOARD_PRESSURE_RAIL_JOURNEY_STARTED', { pageTargetId: page.targetId });
      pressureRailJourneyEvidence = await runDashboardPressureRailJourney({
        harness, page, signal,
        capture: kind => captureScreenshot(harness, page, path.join(attachmentsDir, `pressure-rail-${kind}.png`)),
        record: result => fs.writeFile(path.join(attachmentsDir, 'dashboard-pressure-rail-journey.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8'),
      });
      await evidence.event('QA_DASHBOARD_PRESSURE_RAIL_JOURNEY_FINISHED', { samples: pressureRailJourneyEvidence.samples.length });
      finalSnapshot = await inspectDashboardCapture(harness, page, captureRequest);
    }
    if (!isCaptureReady(finalSnapshot, captureRequest)) {
      const error = new Error('QA_DASHBOARD_CAPTURE_READY_STATE_LOST');
      error.diagnostic = finalSnapshot;
      throw error;
    }
    const pondWaterEffects = zenMainProfile
      ? await readDashboardPondWaterEffects(harness, page) : null;
    if (pondWaterEffects) {
      await fs.writeFile(path.join(attachmentsDir, 'dashboard-pond-water-effects.json'), `${JSON.stringify(pondWaterEffects, null, 2)}\n`, 'utf8');
    }
    finalSnapshot.bonsaiRenderIdentity = requireDashboardCaptureBonsaiRenderIdentity(
      readySnapshot, finalSnapshot, captureRequest,
    );
    requireZenDashboardFrameEdges(finalSnapshot, captureRequest);
    const overlapHitTest = finalSnapshot.bonsaiCanvas?.pondOverlapHitTest;
    // Transparent canopy overlap is intentional. It must never intercept pond
    // input; the sheet owns input instead while Pathways is presented.
    if (finalSnapshot.gardenMode === 'pond' && overlapHitTest?.samples.length && (overlapHitTest.pointerEvents !== 'none'
      || overlapHitTest.samples.some(sample => !sample.matchesExpected))) {
      const error = new Error('QA_DASHBOARD_CANOPY_BLOCKS_POND_INPUT');
      error.diagnostic = overlapHitTest;
      throw error;
    }
    if (finalSnapshot.gardenMode === 'pathways' && finalSnapshot.gardenPanelEdgeX !== null) {
      const work = finalSnapshot.gardenWorkArea, stage = finalSnapshot.stage;
      if (!work || Math.abs(work.x - stage.x) > 1.5 || Math.abs(work.y - stage.y) > 1.5
        || Math.abs(work.x + work.width - finalSnapshot.gardenPanelEdgeX) > 1.5
        || Math.abs(work.y + work.height - finalSnapshot.pressureGraph.y) > 1.5) {
        throw new Error('QA_DASHBOARD_PATHWAYS_DOES_NOT_COVER_POND');
      }
    }
    if (finalSnapshot.bonsaiRenderIdentity) {
      await evidence.event('QA_DASHBOARD_PLUME_RENDER_IDENTITY_VERIFIED', finalSnapshot.bonsaiRenderIdentity);
    }
    if (plan.parameters.artifactJourney) {
      artifactJourney = await runDashboardArtifactJourney(harness, page);
      await fs.writeFile(path.join(attachmentsDir, 'dashboard-artifact-journey.json'), JSON.stringify(artifactJourney, null, 2));
      await evidence.event('QA_DASHBOARD_ARTIFACT_JOURNEY_FINISHED', { transitions: artifactJourney.transitions.length, lostCanvas: artifactJourney.lostCanvas });
      const kineticMotion = [];
      const artifactScenes = { veil: 'enso', brake: 'tome-ishi', barrier: 'ishidouro', flare: 'furin', gate: 'shishi-odoshi', echo: 'great-wave', lens: 'shoji' };
      for (const family of Object.keys(artifactScenes)) {
        // The Zen path is walked to each family through its edge thresholds.
        await evaluate(harness.cdp, page.sessionId, `(${artifactGallerySelection.toString()})('QA_ARTIFACT_CAPTURE', (stepFamily) => {
          const canvas = document.querySelector('canvas[data-zen-artifact-engine="gallery"]');
          return canvas?.dataset.zenArtifactEngineScene === ${JSON.stringify(artifactScenes)}[stepFamily]
            && canvas?.dataset.zenArtifactEngineStatus === 'ready';
        }).select(${JSON.stringify(family)})`, { timeoutMs: 100000 });
        if (family === 'gate' || family === 'flare') kineticMotion.push(await activateDashboardArtifactMotion(harness, page, family));
        await sleep(family === 'gate' ? 6500 : 350);
        await captureScreenshot(harness, page, path.join(attachmentsDir, `artifact-${family}.png`));
      }
      artifactJourney.kineticMotion = kineticMotion;
      await fs.writeFile(path.join(attachmentsDir, 'dashboard-artifact-journey.json'), JSON.stringify(artifactJourney, null, 2));
    }
    if (plan.parameters.artifactRuntimeJourney) {
      artifactRuntimeJourney = await runDashboardArtifactRuntimeJourney({ harness, page, pageDiagnostics, themeId,
        captureFamilyScreenshot: family => {
          const screenshotPath = path.join(attachmentsDir, `artifact-runtime-${family}.png`);
          return captureScreenshot(harness, page, screenshotPath).then(() => screenshotPath);
        },
      });
      await fs.writeFile(path.join(attachmentsDir, 'dashboard-artifact-runtime.json'), JSON.stringify(artifactRuntimeJourney, null, 2));
      await evidence.event('QA_DASHBOARD_ARTIFACT_RUNTIME_FINISHED', { transitions: artifactRuntimeJourney.transitions.length, parking: artifactRuntimeJourney.parking });
      finalSnapshot = await inspectDashboardCapture(harness, page, captureRequest);
    }
    if (surface.id === 'pond-lab') {
      pondLabJourney = await runDashboardPondLabJourney(harness, page, section => captureScreenshot(harness, page, path.join(attachmentsDir, `pond-lab-${section}.png`)));
      await fs.writeFile(path.join(attachmentsDir, 'dashboard-pond-lab-journey.json'), JSON.stringify(pondLabJourney, null, 2));
      await evidence.event('QA_DASHBOARD_POND_LAB_JOURNEY_FINISHED', pondLabJourney.controls);
      finalSnapshot = await inspectDashboardCapture(harness, page, captureRequest);
    }
    if (plan.parameters.sitesScenario === 'intel-reading') {
      sitesIntelJourney = await runDashboardSitesIntelJourney({
        harness, page, signal,
        capture: id => captureScreenshot(harness, page, path.join(attachmentsDir, 'sites-intel-' + id + '.png')),
      });
      await fs.writeFile(path.join(attachmentsDir, 'dashboard-sites-intel-journey.json'), JSON.stringify(sitesIntelJourney, null, 2));
      await evidence.event('QA_DASHBOARD_SITES_INTEL_JOURNEY_FINISHED', sitesIntelJourney);
      finalSnapshot = await inspectDashboardCapture(harness, page, captureRequest);
    }
    if (sitesRecordingScenario) {
      sitesRecordingJourney = await runDashboardSitesRecordingJourney({
        harness, page, signal, evidence, send: message => sendTrustedRuntimeMessage(harness, message),
        capture: id => captureScreenshot(harness, page, path.join(attachmentsDir, 'sites-recording-' + id + '.png')),
      });
      await fs.writeFile(path.join(attachmentsDir, 'dashboard-sites-recording-journey.json'), `${JSON.stringify(sitesRecordingJourney, null, 2)}\n`, 'utf8');
      await evidence.event('QA_DASHBOARD_SITES_RECORDING_JOURNEY_FINISHED', sitesRecordingJourney);
      finalSnapshot = await inspectDashboardCapture(harness, page, captureRequest);
    }
    if (sitesObservedReadingRefresh) {
      sitesObservedReadingRefreshJourney = await runDashboardSitesObservedReadingRefreshJourney({
        harness, page, signal, evidence, send: message => sendTrustedRuntimeMessage(harness, message),
        resizeReading: async viewportName => {
          const to = viewportName === 'initial' ? initialViewport : resolveDashboardCaptureViewport(viewportName);
          const from = await evaluate(harness.cdp, page.sessionId,
            '({ width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio })');
          const before = await inspectDashboardCapture(harness, page, { ...request, viewport: from });
          const metricsBefore = await readDashboardResizeMetrics(harness, page, zenMainProfile);
          await configurePage(harness, page, to);
          const nextRequest = { ...request, viewport: to };
          await waitForCaptureReady(harness, page, nextRequest, signal);
          const bonsai = await waitForDashboardBonsaiResizeFrame(harness, page, nextRequest, before, signal);
          const metricsAfter = await readDashboardResizeMetrics(harness, page, zenMainProfile);
          const receipt = buildDashboardResizeEvidence({ before, after: bonsai.snapshot, from, to,
            pageTargetId: page.targetId, zenMainProfile, metricsBefore, metricsAfter });
          if (!receipt.viewportApplied || !receipt.sameDocument) {
            const error = new Error('QA_SITES_READING_RESIZE_IDENTITY_FAILED'); error.diagnostic = receipt; throw error;
          }
          await evidence.event('QA_SITES_READING_RESIZED', receipt);
          return receipt;
        },
        capture: id => captureScreenshot(harness, page, path.join(attachmentsDir, 'sites-observed-refresh-' + id + '.png')),
      });
      await fs.writeFile(path.join(attachmentsDir, 'dashboard-sites-observed-reading-refresh.json'),
        `${JSON.stringify(sitesObservedReadingRefreshJourney, null, 2)}\n`, 'utf8');
      await evidence.event('QA_DASHBOARD_SITES_OBSERVED_READING_REFRESH_FINISHED', sitesObservedReadingRefreshJourney);
      finalSnapshot = await inspectDashboardCapture(harness, page, captureRequest);
    }
    if (surface.id === 'settings' && !isCaptureReady(finalSnapshot, captureRequest)) {
      throw new Error('QA_DASHBOARD_SETTINGS_CAPTURE_NOT_READY');
    }
    screenshotPath = path.join(attachmentsDir, `dashboard-${surface.id}.png`);
    await captureScreenshot(harness, page, screenshotPath);
    const settingsProtectionLayout = settingsSection === 'protection'
      ? await runDashboardSettingsProtectionCapture({
        evaluate: expression => evaluate(harness.cdp, page.sessionId, expression),
        waitForSettled: async () => {
          await evaluate(harness.cdp, page.sessionId, 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
          await waitForCaptureReady(harness, page, captureRequest, signal);
        },
        capture: async name => {
          const imagePath = path.join(attachmentsDir, `settings-${name}.png`);
          await captureScreenshot(harness, page, imagePath);
          return imagePath;
        },
      }) : null;
    if (settingsProtectionLayout) {
      await fs.writeFile(path.join(attachmentsDir, 'settings-protection-layout.json'), `${JSON.stringify(settingsProtectionLayout, null, 2)}\n`);
      await evidence.event('QA_DASHBOARD_SETTINGS_PROTECTION_LAYOUT_CAPTURED', settingsProtectionLayout);
    }
    await pageDiagnostics.capturePerformanceCheckpoint('capture_finished');
    pageDiagnostics.markCaptureFinished();
    const diagnosticSnapshot = await pageDiagnostics.snapshot();
    const health = classifyDashboardCaptureHealth({
      pageSnapshot: finalSnapshot,
      pageDiagnostics: diagnosticSnapshot,
    });
    ({ reportPath: bootReportPath } = await writeDashboardBootEvidence({
      attachmentsDir,
      artifact,
      request,
      captureStateCommit,
      pageSnapshot: finalSnapshot,
      pageDiagnostics: diagnosticSnapshot,
      health,
      harness,
      screenshotPath,
    }));
    const consoleErrors = diagnosticSnapshot.consoleMessages.filter(
      (entry) => entry.type === 'error' || entry.type === 'diagnostic_serialization_error',
    );
    const consoleWarnings = diagnosticSnapshot.consoleMessages.filter(
      (entry) => entry.type === 'warning',
    );
    const report = Object.freeze({
      schemaVersion: 2,
      request,
      captureStateCommit,
      viewport: captureViewport,
      initialViewport,
      resizeEvidence,
      settingsProtectionLayout,
      artifactJourney,
      artifactRuntimeJourney,
      artifactEntry,
      pondLabJourney,
      sitesRecordingJourney,
      sitesIntelJourney,
      sitesObservedReadingRefreshJourney,
      mainReturnEvidence,
      firstSiteEvidence,
      pressureRailJourneyEvidence,
      pondWaterEffects,
      readySnapshot,
      finalSnapshot,
      screenshotPath,
      bootReportPath,
      health,
      pageDiagnostics: diagnosticSnapshot,
      runtimeExceptions: diagnosticSnapshot.runtimeExceptions,
      consoleErrors: Object.freeze(consoleErrors),
      consoleWarnings: Object.freeze(consoleWarnings),
      chromeStderr: Object.freeze(harness.chromeStderr.slice(-20)),
      graphicsLaunchPolicy: harness.chromeLaunchSpec?.graphicsLaunchPolicy || null,
    });
    reportPath = path.join(attachmentsDir, 'dashboard-capture.json');
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    if (health.status !== 'clean') {
      const error = new Error('QA_DASHBOARD_CAPTURE_BOOT_HEALTH_FAILED');
      error.diagnostic = health;
      throw error;
    }
    await evidence.event('QA_DASHBOARD_CAPTURE_FINISHED', {
      screenshotPath,
      reportPath,
      bootReportPath,
      request,
      fishCount: finalSnapshot.pondAck?.fishCount ?? null,
      ambientPhase: finalSnapshot.ambientPhase,
      runtimeExceptionCount: diagnosticSnapshot.runtimeExceptions.length,
      consoleErrorCount: consoleErrors.length,
      consoleWarningCount: consoleWarnings.length,
      networkFailureCount: diagnosticSnapshot.networkFailures.length,
      resourceLoadCount: diagnosticSnapshot.resourceLoads.length,
      bootHealth: health.status,
    });
    return Object.freeze({
      status: QA_RUN_STATUSES.PASS,
      protocol: 'dashboard_capture',
      request,
      screenshotPath,
      reportPath,
      bootReportPath,
      snapshot: finalSnapshot,
    });
  } catch (error) {
    const pageSnapshot = page
      ? await inspectDashboardCapture(harness, page, request).catch((inspectionError) => ({
          inspectionError: inspectionError?.message || String(inspectionError),
        }))
      : null;
    const diagnosticSnapshot = pageDiagnostics
      ? await pageDiagnostics.snapshot()
      : Object.freeze({
          timeline: null,
          runtimeExceptions: Object.freeze([]),
          consoleMessages: Object.freeze([]),
          logEntries: Object.freeze([]),
          networkFailures: Object.freeze([]),
          resourceLoads: Object.freeze([]),
        });
    const health = classifyDashboardCaptureHealth({
      pageSnapshot,
      pageDiagnostics: diagnosticSnapshot,
    });
    const failureScreenshot = screenshotPath
      ? Object.freeze({ path: screenshotPath, error: null })
      : await captureFailureScreenshot(
          harness,
          page,
          path.join(attachmentsDir, `dashboard-${surface.id}-failure.png`),
        );
    ({ reportPath: bootReportPath } = await writeDashboardBootEvidence({
      attachmentsDir,
      artifact,
      request,
      captureStateCommit,
      pageSnapshot,
      pageDiagnostics: diagnosticSnapshot,
      health,
      harness,
      error,
      screenshotPath: failureScreenshot.path,
    }));
    const consoleErrors = diagnosticSnapshot.consoleMessages.filter(
      (entry) => entry.type === 'error' || entry.type === 'diagnostic_serialization_error',
    );
    const consoleWarnings = diagnosticSnapshot.consoleMessages.filter(
      (entry) => entry.type === 'warning',
    );
    const diagnostic = Object.freeze({
      error: error?.message || String(error),
      request,
      page: pageSnapshot,
      health,
      pageDiagnostics: diagnosticSnapshot,
      runtimeExceptions: diagnosticSnapshot.runtimeExceptions,
      consoleErrors: Object.freeze(consoleErrors),
      consoleWarnings: Object.freeze(consoleWarnings),
      logEntries: diagnosticSnapshot.logEntries,
      networkFailures: diagnosticSnapshot.networkFailures,
      resourceLoads: diagnosticSnapshot.resourceLoads,
      chromeStderr: Object.freeze(harness.chromeStderr.slice(-20)),
      sourceDiagnostic: error?.diagnostic || null,
      screenshotPath: failureScreenshot.path,
      screenshotError: failureScreenshot.error,
      reportPath,
      bootReportPath,
    });
    await Promise.all([
      fs.writeFile(
        path.join(attachmentsDir, 'dashboard-capture-failure.json'),
        `${JSON.stringify(diagnostic, null, 2)}\n`,
        'utf8',
      ),
      evidence.event('QA_DASHBOARD_CAPTURE_FAILED', diagnostic),
    ]);
    throw error;
  }
}

export async function executeQaProtocol(context) {
  const { plan, artifact, browser } = context;
  if (artifact?.id !== 'dev_extension' || artifact?.releaseProfile !== 'dev') {
    throw new Error('QA_DASHBOARD_CAPTURE_DEV_ARTIFACT_REQUIRED');
  }
  if (browser?.processOwnership !== 'owned' || !browser.chrome) {
    throw new Error('QA_DASHBOARD_CAPTURE_OWNED_BROWSER_REQUIRED');
  }
  const operation = requireDashboardProtocolOperation(plan.protocolOptions?.operation);
  return operation === 'boot_probe'
    ? executeDashboardBootProtocol(context)
    : executeDashboardCaptureProtocol(context);
}
