import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  AUDIO_DULLING_QA_ACTIONS,
  AUDIO_DULLING_QA_CHANNEL,
} from '../../../src/domains/protection/background/audioDulling/audioDullingQaContract.dev.js';
import {
  ExtensionChromiumHarness,
  evaluate,
  sleep,
} from '../../e2e/extensionChromiumHarness.mjs';
import {
  defineEntropyQaAttachedArtifactStage,
  ENTROPY_QA_TRUSTED_PAGE_PATH,
} from '../../e2e/qaProfileArtifactSlot.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';
import {
  openEntropyAttachOnlyActivePage,
  proveEntropyAttachedArtifactRuntimeReadiness,
  readEntropyPostRefreshTrackingRuntimeReadiness,
} from './attachOnlyActivePageAdapter.mjs';
import {
  inspectWindowsChromeProcessPolicy,
  inspectWindowsChromeToolbarOptions,
  pinWindowsChromeExtension,
} from '../drivers/windowsChromeToolbarDriver.mjs';

const ACTIVATION_HOST_ID = 'entropy-audio-dulling-activation-chip';
const RITUAL_STAGES = Object.freeze(['forming', 'rising', 'absorbing']);
const AGENT_MEDIA_READY_TIMEOUT_MS = 15_000;

function requireWebUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (_error) {
    throw new Error('QA_AUDIO_DULLING_URL_INVALID');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('QA_AUDIO_DULLING_URL_INVALID');
  }
  return url.href;
}

function createRequest(action, targetTabId, payload = {}) {
  return {
    channel: AUDIO_DULLING_QA_CHANNEL,
    action,
    requestId: `audio-qa:${randomUUID()}`,
    targetTabId,
    payload,
  };
}

async function sendTrustedRuntimeMessage(harness, request) {
  const delivery = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
    chrome.runtime.sendMessage(${JSON.stringify(request)}, (response) => {
      resolve({
        error: chrome.runtime.lastError?.message || null,
        response: response || null,
      });
    });
  })`);
  if (delivery?.error) {
    throw new Error(`QA_AUDIO_DULLING_MESSAGE_FAILED:${delivery.error}`);
  }
  const response = delivery?.response;
  if (
    response?.channel !== request.channel
    || response?.action !== request.action
    || response?.requestId !== request.requestId
    || response?.success !== true
  ) {
    throw new Error(
      `QA_AUDIO_DULLING_ACTION_FAILED:${request.action}:${response?.error || 'response_invalid'}`,
    );
  }
  return response.result;
}

function writeProgress(mode, payload) {
  process.stdout.write(`${JSON.stringify({
    status: mode === 'human'
      ? 'HUMAN_OBSERVATION_PROGRESS'
      : 'AGENT_CANARY_PROGRESS',
    ...payload,
  })}\n`);
}

async function readActionUserSettings(harness) {
  const settings = await harness.evaluateInTrustedPage(
    'chrome.action.getUserSettings()',
  );
  if (!settings || typeof settings.isOnToolbar !== 'boolean') {
    throw new Error('QA_AUDIO_DULLING_ACTION_SETTINGS_INVALID');
  }
  return settings;
}

async function waitForToolbarPinned(harness, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  let settings = null;
  while (Date.now() < deadline) {
    settings = await readActionUserSettings(harness);
    if (settings.isOnToolbar) return settings;
    await sleep(100);
  }
  const error = new Error('QA_AUDIO_DULLING_TOOLBAR_PIN_NOT_CONFIRMED');
  error.code = 'QA_AUDIO_DULLING_TOOLBAR_PIN_NOT_CONFIRMED';
  error.settings = settings;
  throw error;
}

export function assertAudioDullingNativeFocusPermission(osFocus) {
  if (osFocus === 'request_once') return osFocus;
  const error = new Error(
    'QA_AUDIO_DULLING_NATIVE_FOCUS_PERMISSION_REQUIRED:'
      + 'configure_external_profile_focusPolicy=request_once_or_pin_manually',
  );
  error.code = 'QA_AUDIO_DULLING_NATIVE_FOCUS_PERMISSION_REQUIRED';
  throw error;
}

async function ensureAgentToolbarPinned({
  harness,
  browser,
  evidence,
  attachmentsDir,
  osFocus,
}) {
  const before = await readActionUserSettings(harness);
  if (before.isOnToolbar) {
    await evidence.event('QA_AUDIO_DULLING_TOOLBAR_PIN_CONFIRMED', {
      alreadyPinned: true,
      focusChanged: false,
    });
    return Object.freeze({
      alreadyPinned: true,
      focusChanged: false,
      settings: before,
    });
  }
  assertAudioDullingNativeFocusPermission(osFocus);
  const extensionName = await harness.evaluateInTrustedPage(
    "chrome.i18n.getMessage('extName')",
  );
  if (typeof extensionName !== 'string' || !extensionName.trim()) {
    throw new Error('QA_AUDIO_DULLING_EXTENSION_NAME_REQUIRED');
  }
  const driverOptions = {
    chromePath: browser.chrome,
    cdpEndpoint: browser.cdpEndpoint,
    expectedName: extensionName,
  };
  let pinResult;
  try {
    pinResult = await pinWindowsChromeExtension(driverOptions);
  } catch (error) {
    const diagnosticPath = path.join(
      attachmentsDir,
      'windows-chrome-toolbar-diagnostic.json',
    );
    const diagnostic = await inspectWindowsChromeToolbarOptions(driverOptions)
      .catch((diagnosticError) => ({
        ok: false,
        code: diagnosticError?.code || diagnosticError?.message || 'unknown',
      }));
    await fs.writeFile(
      diagnosticPath,
      `${JSON.stringify(diagnostic, null, 2)}\n`,
      'utf8',
    );
    await evidence.event('QA_AUDIO_DULLING_TOOLBAR_PIN_FAILED', {
      code: error?.code || error?.message || 'unknown',
      diagnosticAttachment: path.basename(diagnosticPath),
    });
    error.diagnosticAttachment = path.basename(diagnosticPath);
    throw error;
  }
  const settings = await waitForToolbarPinned(harness);
  await evidence.event('QA_AUDIO_DULLING_TOOLBAR_PIN_CONFIRMED', {
    alreadyPinned: false,
    focusChanged: true,
    driverOperation: pinResult.operation,
  });
  return Object.freeze({
    alreadyPinned: false,
    focusChanged: true,
    settings,
  });
}

async function inspectAgentBrowserAudioOutput(browser, evidence) {
  const processPolicy = await inspectWindowsChromeProcessPolicy({
    chromePath: browser.chrome,
    cdpEndpoint: browser.cdpEndpoint,
  });
  const result = Object.freeze({
    browserMuteArgumentPresent: processPolicy.muteAudioArgumentPresent === true,
  });
  await evidence.event('QA_AUDIO_DULLING_BROWSER_AUDIO_PREFLIGHT', result);
  if (result.browserMuteArgumentPresent) {
    const error = new Error('QA_AUDIO_DULLING_BROWSER_MUTED');
    error.code = 'QA_AUDIO_DULLING_BROWSER_MUTED';
    throw error;
  }
  return result;
}

async function capturePageScreenshot(harness, page, outputPath) {
  const screenshot = await harness.cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  }, page.sessionId);
  if (typeof screenshot?.data !== 'string' || !screenshot.data) {
    throw new Error('QA_AUDIO_DULLING_SCREENSHOT_REQUIRED');
  }
  await fs.writeFile(outputPath, Buffer.from(screenshot.data, 'base64'));
  return path.basename(outputPath);
}

async function captureMediaDomDiagnostic(harness, page, attachmentsDir) {
  const diagnostic = await evaluate(
    harness.cdp,
    page.sessionId,
    `(() => {
      const entries = Array.from(
        document.querySelectorAll('video, audio, iframe, [role="button"]'),
      ).slice(0, 120).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || '',
          className: typeof element.className === 'string'
            ? element.className.slice(0, 240)
            : '',
          role: element.getAttribute('role') || '',
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          media: element instanceof HTMLMediaElement
            ? {
              paused: element.paused,
              ended: element.ended,
              muted: element.muted,
              volume: element.volume,
              readyState: element.readyState,
              hasCurrentSource: Boolean(element.currentSrc),
            }
            : null,
        };
      });
      return {
        href: location.href,
        readyState: document.readyState,
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus(),
        entries,
      };
    })()`,
    { awaitPromise: false, timeoutMs: 2_000 },
  );
  const outputPath = path.join(attachmentsDir, 'media-dom-diagnostic.json');
  await fs.writeFile(outputPath, `${JSON.stringify(diagnostic, null, 2)}\n`, 'utf8');
  return path.basename(outputPath);
}

async function startAgentMediaPlayback(harness, page) {
  await harness.cdp.send('Emulation.setEmulatedMedia', {
    features: [{
      name: 'prefers-reduced-motion',
      value: 'no-preference',
    }],
  }, page.sessionId);
  const expression = `(async () => {
    const deadline = Date.now() + ${AGENT_MEDIA_READY_TIMEOUT_MS};
    let last = null;
    while (Date.now() < deadline) {
      const candidates = Array.from(document.querySelectorAll('video, audio'))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            element,
            area: Math.max(1, rect.width * rect.height),
          };
        })
        .sort((left, right) => right.area - left.area);
      const media = candidates[0]?.element || null;
      if (media) {
        media.muted = false;
        media.volume = 1;
        let playError = null;
        try {
          await media.play();
        } catch (error) {
          playError = error?.name || 'PLAY_FAILED';
        }
        last = {
          tag: media.tagName.toLowerCase(),
          hasCurrentSource: Boolean(media.currentSrc),
          paused: media.paused,
          ended: media.ended,
          muted: media.muted,
          volume: media.volume,
          readyState: media.readyState,
          playError,
        };
        if (
          last.hasCurrentSource
          && !last.paused
          && !last.ended
          && !last.muted
          && last.volume > 0.01
          && last.readyState >= 2
        ) {
          return { ok: true, ...last };
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return { ok: false, last };
  })()`;
  const evaluation = await harness.cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  }, page.sessionId, {
    timeoutMs: AGENT_MEDIA_READY_TIMEOUT_MS + 2_000,
  });
  if (evaluation?.exceptionDetails) {
    throw new Error('QA_AUDIO_DULLING_MEDIA_PLAYBACK_EVALUATION_FAILED');
  }
  const result = evaluation?.result?.value;
  if (result?.ok !== true) {
    const error = new Error('INCONCLUSIVE_AUDIO_DULLING_MEDIA_NOT_AUDIBLE');
    error.code = 'INCONCLUSIVE_AUDIO_DULLING_MEDIA_NOT_AUDIBLE';
    error.media = result?.last || null;
    throw error;
  }
  return Object.freeze(result);
}

async function resolveAgentTabTargetId(harness, page) {
  const targets = await harness.cdp.send('Target.getTargets', {
    filter: [{}],
  });
  const targetInfos = Array.isArray(targets?.targetInfos)
    ? targets.targetInfos
    : [];
  const pageInfo = targetInfos.find((entry) => (
    entry.type === 'page' && entry.targetId === page.targetId
  ));
  if (!pageInfo) {
    throw new Error('QA_AUDIO_DULLING_PAGE_TARGET_INFO_REQUIRED');
  }
  const tabTargets = targetInfos.filter((entry) => (
    entry.type === 'tab' && entry.url === pageInfo.url
  ));
  if (tabTargets.length !== 1) {
    throw new Error(
      `QA_AUDIO_DULLING_TAB_TARGET_COUNT_INVALID:${tabTargets.length}`,
    );
  }
  return tabTargets[0].targetId;
}

async function captureRitualStages({
  harness,
  page,
  attachmentsDir,
  timeoutMs,
  evidence,
}) {
  const deadline = Date.now() + timeoutMs;
  const captured = {};
  while (Date.now() < deadline && Object.keys(captured).length < RITUAL_STAGES.length) {
    const stage = await evaluate(
      harness.cdp,
      page.sessionId,
      `document.getElementById(${JSON.stringify(ACTIVATION_HOST_ID)})?.dataset?.stage || null`,
      { awaitPromise: false, timeoutMs: 1_000 },
    ).catch(() => null);
    if (RITUAL_STAGES.includes(stage) && !captured[stage]) {
      const outputPath = path.join(
        attachmentsDir,
        `suikinkutsu-${stage}.png`,
      );
      captured[stage] = await capturePageScreenshot(harness, page, outputPath);
      await evidence.event('QA_AUDIO_DULLING_RITUAL_STAGE_CAPTURED', {
        stage,
        attachment: captured[stage],
      });
    }
    await sleep(32);
  }
  const missingStages = RITUAL_STAGES.filter((stage) => !captured[stage]);
  if (missingStages.length > 0) {
    const error = new Error(
      `QA_AUDIO_DULLING_RITUAL_STAGE_MISSING:${missingStages.join(',')}`,
    );
    error.code = 'QA_AUDIO_DULLING_RITUAL_STAGE_MISSING';
    error.captured = captured;
    throw error;
  }
  return Object.freeze(captured);
}

const TERMINAL_FAILURE_PHASES = new Set([
  'action_claim_failed',
  'action_pulse_failed',
  'action_restore_failed',
  'capture_failed',
  'invitation_expired',
]);

async function waitForPreparedSnapshot(
  harness,
  targetTabId,
  timeoutMs,
  evidence,
  {
    predicate,
    timeoutCode,
    mode,
  },
) {
  const deadline = Date.now() + timeoutMs;
  let lastPhase = null;
  let lastSnapshot = null;
  while (Date.now() < deadline) {
    lastSnapshot = await sendTrustedRuntimeMessage(
      harness,
      createRequest(AUDIO_DULLING_QA_ACTIONS.SNAPSHOT, targetTabId),
    );
    if (lastSnapshot?.phase !== lastPhase) {
      lastPhase = lastSnapshot?.phase || 'missing';
      await evidence.event('QA_AUDIO_DULLING_PHASE_OBSERVED', {
        phase: lastPhase,
        targetTabId,
      });
      writeProgress(mode, {
        phase: lastPhase,
        targetTabId,
      });
    }
    if (predicate(lastSnapshot)) return lastSnapshot;
    if (TERMINAL_FAILURE_PHASES.has(lastSnapshot?.phase)) {
      const error = new Error(
        `QA_AUDIO_DULLING_TERMINAL_PHASE:${lastSnapshot.phase}:${lastSnapshot?.error || 'unknown'}`,
      );
      error.code = `QA_AUDIO_DULLING_${lastSnapshot.phase.toUpperCase()}`;
      throw error;
    }
    await sleep(100);
  }
  const error = new Error(`${timeoutCode}:${lastSnapshot?.phase || 'unknown'}`);
  error.code = timeoutCode;
  throw error;
}

async function waitForCapture(
  harness,
  targetTabId,
  timeoutMs,
  evidence,
  {
    expectedPhase,
    timeoutCode,
    mode,
  },
) {
  return waitForPreparedSnapshot(
    harness,
    targetTabId,
    timeoutMs,
    evidence,
    {
      timeoutCode,
      mode,
      predicate: (snapshot) => (
        snapshot?.phase === expectedPhase
        && snapshot?.state?.status === 'capturing'
        && snapshot?.state?.offscreenState?.status === 'capturing_processed'
      ),
    },
  );
}

function buildConfig(plan, intensity) {
  return {
    preset: 'resolution',
    intensity,
    wet: 1,
    rampMs: plan.parameters.rampMs,
    captureMode: 'manual',
  };
}

async function updatePhase(
  harness,
  targetTabId,
  config,
  holdMs,
  evidence,
  phase,
  mode,
) {
  const snapshot = await sendTrustedRuntimeMessage(
    harness,
    createRequest(AUDIO_DULLING_QA_ACTIONS.UPDATE, targetTabId, {
      config,
    }),
  );
  await evidence.event('QA_AUDIO_DULLING_DSP_PHASE', {
    phase,
    holdMs,
    plan: snapshot?.state?.offscreenState?.plan || null,
  });
  writeProgress(mode, {
    phase,
    holdMs,
    plan: snapshot?.state?.offscreenState?.plan || null,
  });
  if (holdMs > 0) await sleep(holdMs);
  return snapshot;
}

export async function executeQaProtocol(context) {
  const {
    plan,
    artifact,
    browser,
    evidence,
    attachmentsDir,
    registerCleanup,
    reportBrowserGpuCapability,
    recoveryJournal,
  } = context;
  if (!['human', 'agent'].includes(plan.mode)) {
    throw new Error('QA_AUDIO_DULLING_MODE_INVALID');
  }
  if (artifact?.id !== 'dev_extension' || artifact?.releaseProfile !== 'dev') {
    throw new Error('QA_AUDIO_DULLING_DEV_ARTIFACT_REQUIRED');
  }
  if (browser?.processOwnership !== 'attach_only' || !browser.cdpEndpoint) {
    throw new Error('QA_AUDIO_DULLING_ATTACH_ONLY_BROWSER_REQUIRED');
  }
  const targetUrl = requireWebUrl(plan.parameters.url);
  const temporaryManifest = Object.freeze({
      requiredPermissions: ['scripting'],
      requiredHostPermissions: [`${new URL(targetUrl).origin}/*`],
  });
  const attachedArtifactStage = browser.lifecyclePolicy === 'managed'
    ? defineEntropyQaAttachedArtifactStage({
      browser,
      browserExecution: plan.browserExecution,
      sourceDir: artifact.path,
      artifactIdentity: {
        artifactId: artifact.id,
        inputDigest: artifact.inputDigest,
        buildId: artifact.buildId,
        releaseProfile: artifact.releaseProfile,
      },
      temporaryManifest,
    })
    : null;
  const qaArtifact = Object.freeze({
    slotDir: browser.extensionSlot,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
  });
  const harness = new ExtensionChromiumHarness({
    chromePath: browser.chrome,
    distDir: qaArtifact.slotDir,
    rootDir: plan.rootDir,
    headless: plan.browserExecution.headless,
    browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy,
    launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement,
    cdpEndpoint: browser.cdpEndpoint,
    expectedBrowserIdentity: browser.browserIdentity,
    attachedArtifactStage,
    keepTemp: false,
    qaProfileDir: browser.profile,
    qaProfileDirectory: browser.profileDirectory,
    tempPrefix: 'entropy-audio-dulling-qa-',
    loadInPlace: true,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    attachedArtifactRuntimeReadiness: browser.lifecyclePolicy === 'managed'
      ? proveEntropyAttachedArtifactRuntimeReadiness
      : null,
    recoveryJournal,
  });
  registerCleanup('audio_dulling_harness', () => harness.close().then(() => ({
    browserProcessPreserved: true,
  })));
  await harness.start();
  await reportBrowserGpuCapability(harness.gpuCapability);
  if (browser.lifecyclePolicy === 'managed') {
    await evidence.event('QA_MANAGED_EXTENSION_SLOT_ADMITTED', {
      environmentId: browser.environmentId,
      profileSlotId: browser.profileSlotId,
      action: harness.managedExtensionSlotAction,
      installMode: harness.extensionInstallMode,
      artifactSync: harness.attachedArtifactSyncReceipt,
    });
  }
  if (harness.uninstallExtensionOnClose) {
    throw new Error('QA_AUDIO_DULLING_EXTENSION_UNINSTALL_FORBIDDEN');
  }
  const postRefreshRuntimeReadiness = readEntropyPostRefreshTrackingRuntimeReadiness(harness);
  if (postRefreshRuntimeReadiness?.required === true) {
    await evidence.event('QA_TRACKING_RUNTIME_POST_REFRESH_READY', {
      protocol: 'audio_dulling',
      ...postRefreshRuntimeReadiness,
    });
  }
  let toolbarPin = null;
  let browserAudioOutput = null;
  if (plan.mode === 'agent') {
    browserAudioOutput = await inspectAgentBrowserAudioOutput(browser, evidence);
    toolbarPin = await ensureAgentToolbarPinned({
      harness,
      browser,
      evidence,
      attachmentsDir,
      osFocus: plan.browserExecution.osFocus,
    });
  } else {
    const settings = await readActionUserSettings(harness);
    if (!settings.isOnToolbar) {
      throw new Error('QA_AUDIO_DULLING_TOOLBAR_PIN_REQUIRED');
    }
  }

  const attachPageAdmission = await openEntropyAttachOnlyActivePage({
    harness,
    url: targetUrl,
    browserExecution: plan.browserExecution,
  });
  const { page, targetTab } = attachPageAdmission;
  const targetTabId = Number(targetTab?.id);
  if (!Number.isInteger(targetTabId) || targetTabId < 0) {
    throw new Error('QA_AUDIO_DULLING_TARGET_TAB_REQUIRED');
  }

  let stopRequired = false;
  registerCleanup('audio_dulling_session', async () => {
    if (!stopRequired) return { stopped: false };
    const result = await sendTrustedRuntimeMessage(
      harness,
      createRequest(AUDIO_DULLING_QA_ACTIONS.STOP, targetTabId),
    );
    stopRequired = false;
    return result;
  });

  const dryConfig = buildConfig(plan, 0);
  const processedConfig = buildConfig(
    plan,
    plan.parameters.intensityPercent / 100,
  );
  const invitationDelayMs = Math.max(
    plan.parameters.revealDelayMs,
    plan.parameters.baselineMs,
  );
  const prepared = await sendTrustedRuntimeMessage(
    harness,
    createRequest(AUDIO_DULLING_QA_ACTIONS.PREPARE, targetTabId, {
      config: dryConfig,
      activationConfig: processedConfig,
      revealDelayMs: invitationDelayMs,
      invitationWindowMs: plan.parameters.invitationWindowMs,
    }),
  );
  stopRequired = true;

  let mediaPlayback = null;
  let ritualEvidence = null;
  let actionSurface = null;
  let captured = null;
  if (plan.mode === 'human') {
    process.stdout.write(`${JSON.stringify({
      status: 'OPERATOR_SETUP_REQUIRED',
      targetTabId,
      targetUrl,
      phase: prepared?.phase || null,
      instructions: [
        'QA Chrome에서 새로 열린 미디어 탭을 활성화합니다.',
        '청취 가능한 볼륨으로 미디어를 재생하되, 아직 툴바 아이콘은 누르지 않습니다.',
      ],
    })}\n`);
    await evidence.event('QA_AUDIO_DULLING_READY_FOR_HUMAN', {
      targetTabId,
      targetUrl,
      revealDelayMs: invitationDelayMs,
      invitationWindowMs: plan.parameters.invitationWindowMs,
      browserProcessPreserved: true,
      focusChanged: false,
      audioMutated: false,
    });
    process.stdout.write(`${JSON.stringify({
      status: 'READY_FOR_HUMAN',
      targetTabId,
      targetUrl,
      phase: prepared?.phase || null,
      audioPolicy: browser.effectiveAudioPolicy,
      audioMutatedByHarness: false,
      browserProcessPolicy: 'attach_only_preserve_browser',
      instructions: [
        '필터가 없는 원음 상태를 먼저 확인합니다.',
        '화면 아래에서 큰 물방울이 형성되어 오른쪽 위 툴바 쪽으로 빨려 올라가는 장면을 봅니다.',
        '툴바 아이콘에 水 배지가 보이는 동안 그 아이콘을 한 번 누르면 팝업 없이 필터가 즉시 적용됩니다.',
      ],
    })}\n`);
    captured = await waitForCapture(
      harness,
      targetTabId,
      plan.parameters.timeoutMs,
      evidence,
      {
        expectedPhase: 'capturing_processed',
        timeoutCode: 'INCONCLUSIVE_AUDIO_DULLING_ACTION_TIMEOUT',
        mode: plan.mode,
      },
    );
  } else {
    try {
      mediaPlayback = await startAgentMediaPlayback(harness, page);
    } catch (error) {
      const diagnosticAttachment = await captureMediaDomDiagnostic(
        harness,
        page,
        attachmentsDir,
      ).catch(() => null);
      await evidence.event('QA_AUDIO_DULLING_MEDIA_PLAYBACK_FAILED', {
        code: error?.code || error?.message || 'unknown',
        diagnosticAttachment,
      });
      throw error;
    }
    await evidence.event('QA_AUDIO_DULLING_AGENT_MEDIA_READY', {
      targetTabId,
      mediaPlayback,
      tabActivated: true,
      audioMutated: true,
    });
    writeProgress(plan.mode, {
      phase: 'audible_media_ready',
      targetTabId,
      mediaPlayback,
    });

    ritualEvidence = await captureRitualStages({
      harness,
      page,
      attachmentsDir,
      timeoutMs: invitationDelayMs + 5_000,
      evidence,
    });
    const arrived = await waitForPreparedSnapshot(
      harness,
      targetTabId,
      Math.min(plan.parameters.timeoutMs, 5_000),
      evidence,
      {
        mode: plan.mode,
        timeoutCode: 'QA_AUDIO_DULLING_INVITATION_ARRIVAL_TIMEOUT',
        predicate: (snapshot) => (
          snapshot?.phase === 'waiting_for_toolbar_action'
          && Number.isFinite(snapshot?.invitationArrivedAt)
        ),
      },
    );
    actionSurface = await harness.evaluateInTrustedPage(`Promise.all([
      chrome.action.getPopup({ tabId: ${targetTabId} }),
      chrome.action.getTitle({ tabId: ${targetTabId} }),
      chrome.action.getBadgeText({ tabId: ${targetTabId} }),
    ]).then(([popup, title, badgeText]) => ({ popup, title, badgeText }))`);
    if (
      actionSurface?.popup !== ''
      || typeof actionSurface?.title !== 'string'
      || actionSurface?.badgeText !== '水'
    ) {
      throw new Error('QA_AUDIO_DULLING_ACTION_SURFACE_NOT_ARMED');
    }
    await evidence.event('QA_AUDIO_DULLING_AGENT_INVITATION_ARRIVED', {
      targetTabId,
      badgePhase: arrived.badgePhase || null,
      actionSurface,
      ritualEvidence,
    });

    const tabTargetId = await resolveAgentTabTargetId(harness, page);
    await harness.cdp.send('Extensions.triggerAction', {
      id: harness.extensionId,
      targetId: tabTargetId,
    });
    await evidence.event('QA_AUDIO_DULLING_AGENT_ACTION_TRIGGERED', {
      targetTabId,
      pageTargetId: page.targetId,
      tabTargetId,
      driver: 'cdp_extensions_trigger_action',
    });
    captured = await waitForCapture(
      harness,
      targetTabId,
      plan.parameters.timeoutMs,
      evidence,
      {
        expectedPhase: 'capturing_processed',
        timeoutCode: 'QA_AUDIO_DULLING_AGENT_ACTION_TIMEOUT',
        mode: plan.mode,
      },
    );
  }

  const processedPlan = captured?.state?.offscreenState?.plan || null;
  await evidence.event('QA_AUDIO_DULLING_DSP_PHASE', {
    phase: 'resolution_reduced',
    holdMs: plan.parameters.processedMs,
    plan: processedPlan,
  });
  writeProgress(plan.mode, {
    phase: 'resolution_reduced',
    holdMs: plan.parameters.processedMs,
    plan: processedPlan,
  });
  if (plan.parameters.processedMs > 0) {
    await sleep(plan.parameters.processedMs);
  }
  const recovered = await updatePhase(
    harness,
    targetTabId,
    dryConfig,
    plan.parameters.recoveryMs,
    evidence,
    'recovery_dry',
    plan.mode,
  );
  const stopped = await sendTrustedRuntimeMessage(
    harness,
    createRequest(AUDIO_DULLING_QA_ACTIONS.STOP, targetTabId),
  );
  stopRequired = false;

  return Object.freeze({
    status: QA_RUN_STATUSES.PASS,
    protocol: 'audio_dulling',
    targetTabId,
    targetUrl,
    rawBaselineMs: plan.parameters.baselineMs,
    captured,
    processedPlan,
    recoveredPlan: recovered?.state?.offscreenState?.plan || null,
    stopped,
    browserProcessPreserved: true,
    targetAdmission: Object.freeze({
      ...attachPageAdmission.receipt,
      postRefreshRuntimeReadiness,
    }),
    focusChanged: toolbarPin?.focusChanged === true,
    tabActivated: attachPageAdmission.receipt.targetTabActive,
    audioPolicy: browser.effectiveAudioPolicy,
    effectiveAudioPolicy: plan.mode === 'agent'
      ? 'audible_media_required'
      : 'operator_controlled',
    audioMutatedByHarness: plan.mode === 'agent',
    browserAudioOutput,
    toolbarPin,
    mediaPlayback,
    ritualEvidence,
    actionSurface,
    actionDriver: plan.mode === 'agent'
      ? 'cdp_extensions_trigger_action'
      : 'operator_toolbar_click',
  });
}
