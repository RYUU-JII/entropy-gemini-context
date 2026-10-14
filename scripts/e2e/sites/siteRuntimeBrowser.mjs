import { randomUUID } from 'node:crypto';

import {
  evaluate,
  getTargetInfos,
  sleep,
} from '../extensionChromiumHarness.mjs';
import {
  createActionRendererMetricSnapshot,
  createActionRuntimeAttribution,
  createCdpMetricSnapshot,
  diffActionRendererMetricSnapshots,
  sanitizeSiteHarnessUrl,
} from './siteRuntimeMetrics.mjs';
import {
  classifyFeedConsumptionOpportunity,
} from './feedConsumptionValidation.mjs';
import {
  RUNTIME_DEBUGGER_AUTOMATION_ACTIONS,
  RUNTIME_DEBUGGER_AUTOMATION_CHANNEL,
} from '../../../src/domains/nudge/runtime-debugger/automation/runtimeDebuggerAutomationContract.dev.js';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { PROGRESSION_DEBUG_ACTIONS } from '../../../src/domains/progression/debug/progressionDebugActions.dev.js';
import {
  MODEL_STATE_INITIAL_PROFILE_EPOCH,
} from '../../../src/platform/storage/model/ProfileEpochContract.js';
import {
  PROGRESSION_FIRST_VISION_STATES,
} from '../../../src/domains/progression/contracts/progressionIds.js';
import {
  createQaScenarioTabActivationRequest,
  requireQaScenarioTabActivationResponse,
} from '../../../src/platform/security/qaScenarioTabActivationContract.dev.js';
import {
  SITE_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KINDS,
} from './scenarioContracts.mjs';
import {
  LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR,
  LAYOUT_CYCLE_OPPORTUNITY_KIND,
} from './layoutCycleAnalysis.mjs';
import {
  performRootVisualContinuityProbe,
} from './rootVisualContinuityProbe.mjs';
import { performVisualMediaMembershipProbe } from './visualMediaMembershipProbe.mjs';
import { performVisualRemovalCostProbe } from './visualRemovalCostProbe.mjs';

const YOUTUBE_WATCH_INFO_VIEW_SOURCE = String.raw`(?:조회수\s*[\d,.]+(?:\.[\d]+)?\s*(?:천|만|억|K|M|B)?\s*회?|[\d,.]+(?:\.[\d]+)?\s*(?:천|만|억|K|M|B)?\s*views?)`;
const YOUTUBE_WATCH_INFO_TIME_SOURCE = String.raw`(?:\d+\s*(?:초|분|시간|일|주|개월|년)\s*전|\d+\s*(?:seconds?|secs?|minutes?|mins?|hours?|days?|weeks?|months?|years?)\s+ago)`;
const YOUTUBE_WATCH_INFO_OPPORTUNITY_CLASSIFIER = Object.freeze({
  kind: LAYOUT_CYCLE_OPPORTUNITY_KIND,
  containerSelector: LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR,
  leafSelector: ':is(span, yt-formatted-string, yt-attributed-string, [role="text"])',
  maximumLeafCount: 48,
  viewOnlyPatternSource: String.raw`^\s*${YOUTUBE_WATCH_INFO_VIEW_SOURCE}\s*$`,
  timeOnlyPatternSource: String.raw`^\s*${YOUTUBE_WATCH_INFO_TIME_SOURCE}\s*$`,
  combinedPatternSource:
    String.raw`^\s*${YOUTUBE_WATCH_INFO_VIEW_SOURCE}\s*(?:[·•|,]\s*)?${YOUTUBE_WATCH_INFO_TIME_SOURCE}\s*$`,
  neutralPatternSource: String.raw`^[·•|,\s]*$`,
});

const HARNESS_SEND_MESSAGE_SOURCE = `async function(message) {
  return await new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const runtimeError = chrome.runtime.lastError && chrome.runtime.lastError.message;
        resolve(runtimeError ? { success: false, error: runtimeError } : response);
      });
    } catch (error) {
      resolve({ success: false, error: String(error && error.message || error) });
    }
  });
}`;
const SCENARIO_RULE_RUNTIME_RECONCILE_KEYS = Object.freeze([
  'blockedUrls',
  'siteGoals',
  'siteGoalMeta',
  'siteRuleTimeline',
]);

const DEFAULT_BLOCKER_SELECTORS = Object.freeze({
  auth: Object.freeze([
    'input[type="password"]',
    'form[action*="login" i]',
    'form[action*="signin" i]',
  ]),
  captcha: Object.freeze([
    'iframe[src*="captcha" i]',
    '[class*="captcha" i]',
    '[id*="captcha" i]',
  ]),
  twoFactor: Object.freeze([
    'input[autocomplete="one-time-code"]',
    'input[name*="otp" i]',
    'input[name*="two_factor" i]',
  ]),
  consent: Object.freeze([
    'form[action*="consent" i]',
    '[data-testid*="consent" i]',
    'form[action*="terms" i]',
  ]),
});

function getScenarioPrimaryUrl(scenario) {
  const value = scenario?.url || scenario?.urls?.primary;
  if (typeof value !== 'string' || !value) {
    throw new Error(`SITE_E2E_SCENARIO_PRIMARY_URL_REQUIRED:${scenario?.id || 'unknown'}`);
  }
  return value;
}

function safeError(error) {
  const message = String(error?.message || error || 'UNKNOWN_ERROR');
  return message
    .replace(
      /(?:https?|chrome-extension):\/\/[^\s)"'\],}]+/gu,
      (url) => sanitizeSiteHarnessUrl(url) || '[url]',
    )
    .slice(0, 500);
}

function createSettingsPropagationResponseError(
  errorCode,
  response,
  { privacyMode = 'public' } = {},
) {
  const error = new Error(`${errorCode}:${response?.error || 'unknown'}`);
  if (
    response?.propagation
    && typeof response.propagation === 'object'
    && !Array.isArray(response.propagation)
  ) {
    error.siteE2ESafeDetails = {
      kind: 'settings_propagation',
      privacyMode,
      propagation: response.propagation,
    };
  }
  return error;
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function sendHarnessMessage(harness, message, { timeoutMs = 20_000 } = {}) {
  return harness.evaluateInTrustedPage(
    `(${HARNESS_SEND_MESSAGE_SOURCE})(${JSON.stringify(message)})`,
    { timeoutMs },
  );
}

function requireSuccessfulHarnessResponse(response, errorCode) {
  if (response?.success !== true) {
    throw new Error(`${errorCode}:${response?.error || 'unknown'}`);
  }
  return response;
}

function requireArtifactDisclosureSnapshot(response, errorCode) {
  const snapshot = requireSuccessfulHarnessResponse(response, errorCode)?.snapshot;
  if (response.profileGeneration !== MODEL_STATE_INITIAL_PROFILE_EPOCH) {
    throw new Error(`${errorCode}:generation_mismatch`);
  }
  if (
    !snapshot
    || typeof snapshot !== 'object'
    || Array.isArray(snapshot)
    || !snapshot.entriesByFamilyId
    || typeof snapshot.entriesByFamilyId !== 'object'
    || Array.isArray(snapshot.entriesByFamilyId)
  ) {
    throw new Error(`${errorCode}:snapshot_invalid`);
  }
  return snapshot;
}

export function resolveRequiredArtifactFamilies(scenarios = []) {
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error('SITE_E2E_ARTIFACT_SCENARIOS_REQUIRED');
  }
  const familyIds = new Set();
  let maximumDay = 0;
  scenarios.forEach((scenario) => {
    const requirements = scenario?.artifactDisclosureRequirements;
    if (
      !requirements
      || typeof requirements !== 'object'
      || Array.isArray(requirements)
      || !requirements.byFeature
      || typeof requirements.byFeature !== 'object'
      || Array.isArray(requirements.byFeature)
      || !Number.isInteger(requirements.scenarioMaxDay)
      || requirements.scenarioMaxDay < 0
    ) {
      throw new Error(
        `SITE_E2E_ARTIFACT_REQUIREMENTS_INVALID:${scenario?.id || 'unknown'}`,
      );
    }
    Object.values(requirements.byFeature).forEach((requirement) => {
      if (typeof requirement?.familyId !== 'string' || !requirement.familyId.trim()) {
        throw new Error(
          `SITE_E2E_ARTIFACT_FAMILY_REQUIRED:${scenario?.id || 'unknown'}`,
        );
      }
      familyIds.add(requirement.familyId);
    });
    maximumDay = Math.max(maximumDay, requirements.scenarioMaxDay);
  });
  return Object.freeze({
    familyIds: Object.freeze([...familyIds]),
    maximumDay,
  });
}

export function analyzeScenarioArtifactDisclosure(scenario, snapshot) {
  const requirements = scenario?.artifactDisclosureRequirements;
  const entriesByFamilyId = snapshot?.entriesByFamilyId;
  if (
    !requirements?.byFeature
    || !entriesByFamilyId
    || typeof entriesByFamilyId !== 'object'
    || Array.isArray(entriesByFamilyId)
  ) {
    return Object.freeze({
      state: 'unavailable',
      reason: 'artifact_disclosure_snapshot_unavailable',
      requiredFamilyIds: Object.freeze([]),
      eligibleFamilyIds: Object.freeze([]),
      lockedFamilyIds: Object.freeze([]),
      byFeature: Object.freeze({}),
    });
  }
  const byFeature = Object.fromEntries(Object.entries(requirements.byFeature).map(([
    featureId,
    requirement,
  ]) => {
    const entry = entriesByFamilyId[requirement.familyId];
    return [featureId, Object.freeze({
      familyId: requirement.familyId,
      childId: requirement.childId,
      disclosureDay: requirement.disclosureDay,
      runtimeEligible: entry?.runtimeEligible === true,
    })];
  }));
  const requiredFamilyIds = [...new Set(
    Object.values(byFeature).map((requirement) => requirement.familyId),
  )];
  const eligibleFamilyIds = requiredFamilyIds.filter(
    (familyId) => entriesByFamilyId[familyId]?.runtimeEligible === true,
  );
  const lockedFamilyIds = requiredFamilyIds.filter(
    (familyId) => entriesByFamilyId[familyId]?.runtimeEligible !== true,
  );
  return Object.freeze({
    state: lockedFamilyIds.length === 0 ? 'measured' : 'unavailable',
    reason: lockedFamilyIds.length === 0 ? null : 'artifact_disclosure_locked',
    requiredFamilyIds: Object.freeze(requiredFamilyIds),
    eligibleFamilyIds: Object.freeze(eligibleFamilyIds),
    lockedFamilyIds: Object.freeze(lockedFamilyIds),
    byFeature: Object.freeze(byFeature),
  });
}

async function readArtifactDisclosureSnapshot(harness) {
  const response = await sendHarnessMessage(harness, {
    action: MESSAGE_ACTIONS.GET_ARTIFACT_DISCLOSURE_SNAPSHOT,
    profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH,
  });
  if (response?.profileGeneration !== MODEL_STATE_INITIAL_PROFILE_EPOCH) {
    throw new Error('SITE_E2E_ARTIFACT_DISCLOSURE_READ_FAILED:generation_mismatch');
  }
  return requireArtifactDisclosureSnapshot(
    response,
    'SITE_E2E_ARTIFACT_DISCLOSURE_READ_FAILED',
  );
}

async function initializeDisposableFirstVision(harness) {
  const profileGeneration = MODEL_STATE_INITIAL_PROFILE_EPOCH;
  const actions = [];
  const readiness = requireSuccessfulHarnessResponse(
    await sendHarnessMessage(harness, {
      action: MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS,
      profileGeneration,
    }),
    'SITE_E2E_PROFILE_GENERATION_READINESS_FAILED',
  );
  if (readiness.profileGeneration !== profileGeneration) {
    throw new Error('SITE_E2E_PROFILE_GENERATION_READINESS_FAILED:response_mismatch');
  }
  const readFirstVision = async () => {
    const response = requireSuccessfulHarnessResponse(
      await sendHarnessMessage(harness, {
        action: MESSAGE_ACTIONS.GET_FIRST_VISION_PROGRESSION_SNAPSHOT,
        profileGeneration,
      }),
      'SITE_E2E_FIRST_VISION_READ_FAILED',
    );
    if (
      response.profileGeneration !== profileGeneration
      || !Object.values(PROGRESSION_FIRST_VISION_STATES).includes(response.snapshot?.state)
    ) {
      throw new Error('SITE_E2E_FIRST_VISION_READ_FAILED:response_mismatch');
    }
    return response.snapshot;
  };

  let firstVision = await readFirstVision();
  if (firstVision.state === PROGRESSION_FIRST_VISION_STATES.PENDING) {
    const response = requireSuccessfulHarnessResponse(
      await sendHarnessMessage(harness, {
        action: MESSAGE_ACTIONS.RECORD_FIRST_VISION_PRESENTED,
        profileGeneration,
      }),
      'SITE_E2E_FIRST_VISION_PRESENT_FAILED',
    );
    if (
      response.profileGeneration !== profileGeneration
      || response.snapshot?.state !== PROGRESSION_FIRST_VISION_STATES.PRESENTED
    ) {
      throw new Error('SITE_E2E_FIRST_VISION_PRESENT_FAILED:response_mismatch');
    }
    actions.push(MESSAGE_ACTIONS.RECORD_FIRST_VISION_PRESENTED);
    firstVision = response.snapshot;
  }
  if (firstVision.state === PROGRESSION_FIRST_VISION_STATES.PRESENTED) {
    const response = requireSuccessfulHarnessResponse(
      await sendHarnessMessage(harness, {
        action: MESSAGE_ACTIONS.RECORD_FIRST_VISION_SPENT,
        profileGeneration,
      }),
      'SITE_E2E_FIRST_VISION_SPEND_FAILED',
    );
    if (
      response.profileGeneration !== profileGeneration
      || response.snapshot?.state !== PROGRESSION_FIRST_VISION_STATES.SPENT
    ) {
      throw new Error('SITE_E2E_FIRST_VISION_SPEND_FAILED:response_mismatch');
    }
    actions.push(MESSAGE_ACTIONS.RECORD_FIRST_VISION_SPENT);
    firstVision = response.snapshot;
  }
  if (firstVision.state !== PROGRESSION_FIRST_VISION_STATES.SPENT) {
    throw new Error(`SITE_E2E_FIRST_VISION_SPEND_FAILED:${firstVision.state}`);
  }
  return Object.freeze({
    profileGeneration,
    readiness: true,
    state: firstVision.state,
    actions: Object.freeze(actions),
  });
}

async function readCanonicalFirstVision(harness) {
  const profileGeneration = MODEL_STATE_INITIAL_PROFILE_EPOCH;
  const response = requireSuccessfulHarnessResponse(
    await sendHarnessMessage(harness, {
      action: MESSAGE_ACTIONS.GET_FIRST_VISION_PROGRESSION_SNAPSHOT,
      profileGeneration,
    }),
    'SITE_E2E_FIRST_VISION_READ_FAILED',
  );
  if (
    response.profileGeneration !== profileGeneration
    || !Object.values(PROGRESSION_FIRST_VISION_STATES).includes(response.snapshot?.state)
  ) {
    throw new Error('SITE_E2E_FIRST_VISION_READ_FAILED:response_mismatch');
  }
  return response.snapshot;
}

function requireSyntheticCanonicalProgressionFixture(snapshot, firstVision, fixture) {
  const unlock = snapshot?.unlockProgress;
  const expectedFamilyIds = snapshot?.orderedFamilyIds;
  if (
    fixture?.synthetic !== true
    || fixture?.status !== 'ready'
    || fixture?.qualifiedUseDayCount !== 5
    || firstVision?.state !== PROGRESSION_FIRST_VISION_STATES.SPENT
    || unlock?.source !== 'canonical'
    || unlock?.debugOverrideActive !== false
    || unlock?.canonicalQualifiedUseDayCount !== 5
    || unlock?.qualifiedUseDayCount !== 5
    || !Number.isSafeInteger(snapshot?.qualifiedActivityDayCount)
    || snapshot.qualifiedActivityDayCount < 5
    || !Array.isArray(expectedFamilyIds)
    || !Array.isArray(unlock?.effectiveFamilyIds)
    || expectedFamilyIds.length !== unlock.effectiveFamilyIds.length
    || expectedFamilyIds.some((familyId, index) => (
      unlock.effectiveFamilyIds[index] !== familyId
    ))
    || snapshot.entriesByFamilyId?.veil?.runtimeEligible !== true
  ) {
    throw new Error('SITE_E2E_QA_CANONICAL_PROGRESSION_FIXTURE_MISMATCH');
  }
}

export async function prepareLaneArtifactDisclosure(harness, {
  lane,
  scenarios,
  disposableProfile,
  canonicalProgressionFixture = null,
} = {}) {
  if (lane !== 'diagnostic' && lane !== 'release') {
    throw new Error(`SITE_E2E_ARTIFACT_LANE_INVALID:${lane}`);
  }
  const requirements = resolveRequiredArtifactFamilies(scenarios);
  if (lane === 'diagnostic') {
    const snapshot = requireArtifactDisclosureSnapshot(
      await sendHarnessMessage(harness, {
        action: PROGRESSION_DEBUG_ACTIONS.SET_UNLOCK_DAY,
        dayCount: requirements.maximumDay,
        profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH,
      }),
      'SITE_E2E_PROGRESSION_DEBUG_OVERRIDE_FAILED',
    );
    if (
      snapshot.unlockProgress?.debugOverrideActive !== true
      || snapshot.unlockProgress?.source !== 'debug_override'
      || snapshot.unlockProgress?.qualifiedUseDayCount !== requirements.maximumDay
    ) {
      throw new Error('SITE_E2E_PROGRESSION_DEBUG_OVERRIDE_FAILED:contract_mismatch');
    }
    return Object.freeze({
      lane,
      mode: 'debug_override',
      requestedDay: requirements.maximumDay,
      firstVision: null,
      snapshot,
    });
  }

  let snapshot = await readArtifactDisclosureSnapshot(harness);
  let firstVision = null;
  if (canonicalProgressionFixture) {
    firstVision = await readCanonicalFirstVision(harness);
    requireSyntheticCanonicalProgressionFixture(
      snapshot,
      firstVision,
      canonicalProgressionFixture,
    );
  }
  const needsInitialFamily = requirements.familyIds.includes('lens')
    && snapshot.entriesByFamilyId?.lens?.runtimeEligible !== true;
  if (disposableProfile === true && needsInitialFamily) {
    firstVision = await initializeDisposableFirstVision(harness);
    snapshot = await readArtifactDisclosureSnapshot(harness);
  }
  return Object.freeze({
    lane,
    mode: canonicalProgressionFixture
      ? 'canonical_synthetic_fixture'
      : firstVision
        ? 'canonical_first_vision'
        : 'canonical_existing',
    requestedDay: null,
    firstVision,
    snapshot,
  });
}

export async function clearDiagnosticArtifactDisclosureOverride(harness, {
  clearQaSessionState = false,
} = {}) {
  const snapshot = requireArtifactDisclosureSnapshot(
    await sendHarnessMessage(harness, {
      action: PROGRESSION_DEBUG_ACTIONS.CLEAR_UNLOCK_OVERRIDE,
      profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH,
    }),
    'SITE_E2E_PROGRESSION_DEBUG_CLEAR_FAILED',
  );
  if (
    snapshot.unlockProgress?.debugOverrideActive !== false
    || snapshot.unlockProgress?.source !== 'canonical'
  ) {
    throw new Error('SITE_E2E_PROGRESSION_DEBUG_CLEAR_FAILED:contract_mismatch');
  }
  if (clearQaSessionState) {
    const cleanup = requireSuccessfulHarnessResponse(
      await sendHarnessMessage(harness, {
        action: PROGRESSION_DEBUG_ACTIONS.CLEAR_QA_SESSION_STATE,
        profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH,
      }),
      'SITE_E2E_PROGRESSION_QA_SESSION_CLEAR_FAILED',
    );
    if (cleanup.result?.sessionCleanup?.absent !== true) {
      throw new Error('SITE_E2E_PROGRESSION_QA_SESSION_CLEAR_FAILED:contract_mismatch');
    }
  }
  return snapshot;
}

export async function sendRuntimeDebuggerAutomationAction(
  harness,
  page,
  action,
  payload = {},
) {
  if (!Object.values(RUNTIME_DEBUGGER_AUTOMATION_ACTIONS).includes(action)) {
    throw new Error(`SITE_E2E_RUNTIME_DEBUGGER_ACTION_INVALID:${action}`);
  }
  const requestId = `site-e2e:${randomUUID()}`;
  const response = await sendHarnessMessage(harness, {
    channel: RUNTIME_DEBUGGER_AUTOMATION_CHANNEL,
    action,
    requestId,
    targetTabId: page.tabId,
    payload,
  }, { timeoutMs: 30_000 });
  if (
    response?.success !== true
    || response.requestId !== requestId
    || response.targetTabId !== page.tabId
    || response.action !== action
  ) {
    throw new Error(
      `SITE_E2E_RUNTIME_DEBUGGER_RELAY_FAILED:${action}:${response?.error || 'response_mismatch'}`,
    );
  }
  return response;
}

export { RUNTIME_DEBUGGER_AUTOMATION_ACTIONS };

export function registeredMatchPatternCoversHostname(pattern, hostname) {
  const normalizedHostname = String(hostname || '').trim().toLowerCase();
  const match = String(pattern || '').trim().toLowerCase().match(
    /^(?:\*|https?|file|ftp):\/\/([^/]+)\//,
  );
  if (!normalizedHostname || !match) return false;

  const registeredHostname = match[1];
  if (registeredHostname === '*') return true;
  if (registeredHostname.startsWith('*.')) {
    const baseHostname = registeredHostname.slice(2);
    return normalizedHostname === baseHostname
      || normalizedHostname.endsWith(`.${baseHostname}`);
  }
  return registeredHostname === normalizedHostname;
}

async function waitForManagedRegistration(harness, hostname, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await harness.evaluateInTrustedPage(`new Promise((resolve) => {
      try {
        chrome.scripting.getRegisteredContentScripts({}, (scripts) => resolve({
          scripts: (scripts || []).map((script) => ({
            id: script.id,
            matches: script.matches || [],
            js: script.js || [],
          })),
          error: chrome.runtime.lastError && chrome.runtime.lastError.message,
        }));
      } catch (error) {
        resolve({ scripts: [], error: String(error && error.message || error) });
      }
    })`);
    const registered = (last?.scripts || []).some((script) => (
      Array.isArray(script.js)
      && script.js.includes('src/apps/content/loader.js')
      && (script.matches || []).some((pattern) => (
        registeredMatchPatternCoversHostname(pattern, hostname)
      ))
    ));
    if (registered) return last;
    await sleep(150);
  }
  throw new Error(`SITE_E2E_MANAGED_REGISTRATION_TIMEOUT:${hostname}:${JSON.stringify(last)}`);
}

export async function reconcileScenarioProtectionRuntime(
  harness,
  { privacyMode = 'public' } = {},
) {
  const response = await sendHarnessMessage(harness, {
    action: MESSAGE_ACTIONS.SETTINGS_CHANGED,
    keys: [...SCENARIO_RULE_RUNTIME_RECONCILE_KEYS],
  });
  if (response?.success !== true) {
    throw createSettingsPropagationResponseError(
      'SITE_E2E_PROTECTION_RUNTIME_RECONCILE_FAILED',
      response,
      { privacyMode },
    );
  }
  const changedKeys = Array.isArray(response.changedKeys) ? response.changedKeys : [];
  const exactKeysConfirmed = SCENARIO_RULE_RUNTIME_RECONCILE_KEYS.every(
    (key) => changedKeys.includes(key),
  );
  if (
    !exactKeysConfirmed
    || response?.applied?.refreshed !== true
    || response?.applied?.broadcast !== true
  ) {
    throw new Error('SITE_E2E_PROTECTION_RUNTIME_RECONCILE_CONTRACT_MISMATCH');
  }
  return response;
}

export async function configureScenario(harness, scenario, settings) {
  const privacyMode = scenario?.auth?.mode === 'qa_profile_required' ? 'login' : 'public';
  const settingsResponse = await sendHarnessMessage(harness, {
    action: 'SET_SETTINGS',
    items: settings,
    waitForPropagation: true,
  });
  if (settingsResponse?.success !== true) {
    throw createSettingsPropagationResponseError(
      'SITE_E2E_SET_SETTINGS_FAILED',
      settingsResponse,
      { privacyMode },
    );
  }
  const url = new URL(getScenarioPrimaryUrl(scenario));
  const ruleResponse = await sendHarnessMessage(harness, {
    action: 'UPSERT_SITE_RULE',
    domain: url.hostname,
    type: 'blocked',
    goalMinutes: 1,
  });
  if (ruleResponse?.success !== true) {
    throw createSettingsPropagationResponseError(
      'SITE_E2E_SITE_RULE_FAILED',
      ruleResponse,
      { privacyMode },
    );
  }
  const runtimeReconciliation = await reconcileScenarioProtectionRuntime(harness, { privacyMode });
  const registeredScripts = await waitForManagedRegistration(harness, url.hostname);
  return {
    settings: {
      success: true,
      propagation: settingsResponse?.propagation || null,
    },
    siteRule: {
      success: true,
      propagation: ruleResponse?.propagation || null,
    },
    runtimeReconciliation: {
      success: true,
      changedKeys: [...runtimeReconciliation.changedKeys],
      applied: { ...runtimeReconciliation.applied },
    },
    registeredScripts,
  };
}

export async function activateScenarioTab(harness, page, {
  lane,
  focusWindow = false,
} = {}) {
  if (focusWindow === true) {
    throw new Error('SITE_E2E_OS_FOCUS_ACTIVATION_UNDECLARED');
  }
  if (!['diagnostic', 'release'].includes(lane)) {
    throw new Error(`SITE_E2E_TAB_ACTIVATION_LANE_INVALID:${lane || 'missing'}`);
  }
  if (lane === 'release') {
    if (typeof harness?.activateOwnedEphemeralPageWithoutWindowFocus !== 'function') {
      throw new Error('SITE_E2E_RELEASE_TAB_ACTIVATION_OWNER_REQUIRED');
    }
    const result = await harness.activateOwnedEphemeralPageWithoutWindowFocus(page);
    if (
      result?.active !== true
      || result?.activeTabObserved !== true
      || result?.tabId !== page?.tabId
      || result?.windowFocusRequested !== false
    ) {
      throw new Error(
        `SITE_E2E_RELEASE_TAB_ACTIVATION_FAILED:${result?.tabId || 'unknown'}`,
      );
    }
    return Object.freeze({
      ...result,
      lane,
      proofKind: 'release_external_active_tab',
      trackingObserved: null,
    });
  }
  const request = createQaScenarioTabActivationRequest({
    requestId: `scenario-activation:${randomUUID()}`,
    targetTabId: page?.tabId,
  });
  const response = requireQaScenarioTabActivationResponse(
    await sendHarnessMessage(harness, request),
    request,
  );
  if (response.success !== true) {
    throw new Error(`SITE_E2E_TARGET_TAB_ACTIVATION_FAILED:${response.error}`);
  }
  const result = response.result;
  if (
    result?.active !== true
    || result?.trackingObserved !== true
    || result?.tabId !== page?.tabId
    || result?.windowFocusRequested !== false
  ) {
    throw new Error(
      `SITE_E2E_TARGET_TAB_ACTIVATION_FAILED:${result?.error || result?.tabId || 'unknown'}`,
    );
  }
  return Object.freeze({
    ...result,
    lane,
    proofKind: 'diagnostic_tracking_admission',
  });
}

export async function collectTrackingRuntimeEvidence(harness, page) {
  const response = await sendHarnessMessage(harness, {
    action: 'DEBUG_GET_TRACKING_RUNTIME_STATE',
  });
  if (response?.success !== true || !response?.runtime) {
    return {
      availability: 'unavailable',
      error: safeError(response?.error || 'tracking runtime state unavailable'),
    };
  }
  const runtime = response.runtime;
  const activeTabInfo = runtime.activeTabInfo && typeof runtime.activeTabInfo === 'object'
    ? runtime.activeTabInfo
    : null;
  const lastBatch = runtime.lastTabActivityBatch && typeof runtime.lastTabActivityBatch === 'object'
    ? runtime.lastTabActivityBatch
    : null;
  return {
    availability: 'measured',
    error: null,
    targetTabId: Number.isInteger(page?.tabId) ? page.tabId : null,
    lastActiveTabId: Number.isInteger(runtime.lastActiveTabId)
      ? runtime.lastActiveTabId
      : null,
    focusedWindowId: Number.isInteger(runtime.focusedWindowId)
      ? runtime.focusedWindowId
      : null,
    activeTab: activeTabInfo
      ? {
        tabId: Number.isInteger(activeTabInfo.tabId) ? activeTabInfo.tabId : null,
        hostname: typeof activeTabInfo.hostname === 'string' ? activeTabInfo.hostname : null,
        startedAt: finiteNumberOrNull(activeTabInfo.startedAt),
        audible: activeTabInfo.audible === true,
      }
      : null,
    lastActivityBatch: lastBatch
      ? {
        idleState: typeof lastBatch.idleState === 'string' ? lastBatch.idleState : null,
        focusedWindowId: Number.isInteger(lastBatch.focusedWindowId)
          ? lastBatch.focusedWindowId
          : null,
        activeTabCandidates: finiteNumberOrNull(lastBatch.activeTabCandidates),
        outcome: typeof lastBatch.outcome === 'string' ? lastBatch.outcome : null,
      }
      : null,
  };
}

export async function collectScenarioConfigurationEvidence(harness, scenario) {
  const hostname = new URL(getScenarioPrimaryUrl(scenario)).hostname;
  const response = await sendHarnessMessage(harness, {
    action: 'GET_SETTINGS',
    keys: [
      'filteringMode',
      'permissionMode',
      'rulesMode',
      'dataCollectionMode',
      'insightsConsent',
      'blockedUrls',
      'siteGoals',
      'filterSettings',
    ],
    defaults: {
      filteringMode: null,
      permissionMode: null,
      rulesMode: null,
      dataCollectionMode: null,
      insightsConsent: null,
      blockedUrls: [],
      siteGoals: {},
      filterSettings: {},
    },
  });
  if (response?.success !== true || !response?.settings) {
    throw new Error(
      `SITE_E2E_SETTINGS_READBACK_FAILED:${response?.error || 'settings missing'}`,
    );
  }
  const settings = response.settings;
  const configuredDomains = Array.from(new Set([
    ...(Array.isArray(settings.blockedUrls) ? settings.blockedUrls : []),
    ...Object.keys(settings.siteGoals || {}),
  ])).filter((domain) => typeof domain === 'string' && domain);
  const targetDomain = configuredDomains.find((domain) => (
    hostname === domain || hostname.endsWith(`.${domain}`)
  )) || null;
  const activeFilterSettingKeys = Object.entries(settings.filterSettings || {})
    .filter(([, entry]) => entry?.isActive === true)
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));
  return {
    filteringMode: settings.filteringMode,
    permissionMode: settings.permissionMode,
    rulesMode: settings.rulesMode,
    dataCollectionMode: settings.dataCollectionMode,
    insightsConsent: settings.insightsConsent,
    targetBlocked: targetDomain !== null
      && Array.isArray(settings.blockedUrls)
      && settings.blockedUrls.includes(targetDomain),
    targetGoalMinutes: targetDomain
      ? finiteNumberOrNull(settings.siteGoals?.[targetDomain])
      : null,
    activeFilterSettingKeys,
  };
}

const PROTECTION_TAB_UPDATED_DISPATCH_DIAGNOSTIC_EVENTS = new Set([
  'protection_tab_updated_admission_url_reconciled',
  'protection_tab_updated_dispatch_settled',
  'protection_tab_updated_dispatch_rejected',
]);

function projectProtectionTabUpdatedDispatchDiagnostic(event) {
  if (!PROTECTION_TAB_UPDATED_DISPATCH_DIAGNOSTIC_EVENTS.has(event?.event)) return {};
  const positiveSafeIntegerOrNull = (value) => (
    Number.isSafeInteger(value) && value > 0 ? value : null
  );
  const booleanOrNull = (value) => (typeof value === 'boolean' ? value : null);
  return {
    disposition: safeSiteE2EDiagnosticToken(event?.disposition),
    phase: safeSiteE2EDiagnosticToken(event?.phase),
    receiptIngressSequence: Number.isSafeInteger(event?.receiptIngressSequence)
      && event.receiptIngressSequence > 0
      ? event.receiptIngressSequence
      : null,
    receiptDocumentId: safeSiteE2EDiagnosticToken(event?.receiptDocumentId, 160),
    admissionDocumentId: safeSiteE2EDiagnosticToken(event?.admissionDocumentId, 160),
    expectedDocumentId: safeSiteE2EDiagnosticToken(event?.expectedDocumentId, 160),
    currentDocumentId: safeSiteE2EDiagnosticToken(event?.currentDocumentId, 160),
    committedDocumentId: safeSiteE2EDiagnosticToken(event?.committedDocumentId, 160),
    committedGeneration: positiveSafeIntegerOrNull(event?.committedGeneration),
    committedIngressSequence: positiveSafeIntegerOrNull(event?.committedIngressSequence),
    committedIngressOrder: ['before_receipt', 'after_receipt'].includes(
      event?.committedIngressOrder,
    )
      ? event.committedIngressOrder
      : null,
    historyGeneration: Number.isSafeInteger(event?.historyGeneration)
      && event.historyGeneration > 0
      ? event.historyGeneration
      : null,
    historyIngressSequence: Number.isSafeInteger(event?.historyIngressSequence)
      && event.historyIngressSequence > 0
      ? event.historyIngressSequence
      : null,
    historyIngressOrder: ['before_receipt', 'after_receipt'].includes(event?.historyIngressOrder)
      ? event.historyIngressOrder
      : null,
    receiptSessionGeneration: positiveSafeIntegerOrNull(event?.receiptSessionGeneration),
    errorSessionGeneration: positiveSafeIntegerOrNull(event?.errorSessionGeneration),
    snapshotBeforeGeneration: positiveSafeIntegerOrNull(event?.snapshotBeforeGeneration),
    snapshotAfterGeneration: positiveSafeIntegerOrNull(event?.snapshotAfterGeneration),
    requestedUrlMatchesError: booleanOrNull(event?.requestedUrlMatchesError),
    observedSessionUrlMatchesError: booleanOrNull(event?.observedSessionUrlMatchesError),
    documentMatchesReceipt: booleanOrNull(event?.documentMatchesReceipt),
    liveTabIdMatches: booleanOrNull(event?.liveTabIdMatches),
    liveTabUrlMatchesSession: booleanOrNull(event?.liveTabUrlMatchesSession),
    liveTabUrlMatchesRequested: booleanOrNull(event?.liveTabUrlMatchesRequested),
    livePendingUrlPresent: booleanOrNull(event?.livePendingUrlPresent),
    livePendingUrlMatchesSession: booleanOrNull(event?.livePendingUrlMatchesSession),
    livePendingUrlMatchesRequested: booleanOrNull(event?.livePendingUrlMatchesRequested),
    sessionGenerationStable: booleanOrNull(event?.sessionGenerationStable),
    readyDocumentProbeErrorCode: safeSiteE2EDiagnosticToken(
      event?.readyDocumentProbeErrorCode,
    ),
    probeAttempted: booleanOrNull(event?.probeAttempted),
    probeResultCountExact: booleanOrNull(event?.probeResultCountExact),
    probeFrameMatches: booleanOrNull(event?.probeFrameMatches),
    probeDocumentMatches: booleanOrNull(event?.probeDocumentMatches),
    probeUrlMatchesRequested: booleanOrNull(event?.probeUrlMatchesRequested),
    sessionRefreshGenerationMatched: booleanOrNull(
      event?.sessionRefreshGenerationMatched,
    ),
    sessionRefreshStatusReady: booleanOrNull(event?.sessionRefreshStatusReady),
    sessionRefreshDocumentMatched: booleanOrNull(event?.sessionRefreshDocumentMatched),
    sessionRefreshUrlMatchedExpected: booleanOrNull(
      event?.sessionRefreshUrlMatchedExpected,
    ),
    sessionRefreshCommitted: booleanOrNull(event?.sessionRefreshCommitted),
    sessionRefreshGenerationAdvanced: booleanOrNull(
      event?.sessionRefreshGenerationAdvanced,
    ),
    sessionRefreshDocumentPreserved: booleanOrNull(
      event?.sessionRefreshDocumentPreserved,
    ),
    sessionRefreshUrlMatchesRequested: booleanOrNull(
      event?.sessionRefreshUrlMatchesRequested,
    ),
    refreshedSessionGeneration: positiveSafeIntegerOrNull(event?.refreshedSessionGeneration),
    recapturedAdmissionMatchesRequested: booleanOrNull(
      event?.recapturedAdmissionMatchesRequested,
    ),
  };
}

export async function collectContentRuntimeDiagnostics(harness, page, { limit = 120 } = {}) {
  const requestedLimit = Math.max(1, Math.min(300, Number(limit) || 120));
  const response = await sendHarnessMessage(harness, {
    action: 'DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS',
    targetTabId: page.tabId,
    limit: requestedLimit,
  });
  if (response?.success !== true) {
    return {
      availability: 'unavailable',
      error: safeError(response?.error || 'content diagnostics unavailable'),
      currentSession: null,
      events: [],
      window: {
        requestedLimit,
        returnedCount: 0,
        maxEntries: null,
        totalEntries: null,
        nextSequence: null,
        windowMayBeTruncated: null,
      },
    };
  }
  const snapshot = response.snapshot || {};
  const currentSession = snapshot.currentSession && typeof snapshot.currentSession === 'object'
    ? {
      tabId: Number.isInteger(snapshot.currentSession.tabId)
        ? snapshot.currentSession.tabId
        : null,
      status: snapshot.currentSession.status || null,
      reason: snapshot.currentSession.reason || null,
      startedAt: Number(snapshot.currentSession.startedAt) || null,
      receiverReadyAt: Number(snapshot.currentSession.receiverReadyAt) || null,
      activeAt: Number(snapshot.currentSession.activeAt) || null,
      failedAt: Number(snapshot.currentSession.failedAt) || null,
      error: snapshot.currentSession.error
        ? safeError(snapshot.currentSession.error)
        : null,
      documentId: snapshot.currentSession.documentId || null,
      attemptCount: Number(snapshot.currentSession.attemptCount) || 0,
    }
    : null;
  const events = (Array.isArray(snapshot.events) ? snapshot.events : []).map((event) => ({
    id: Number(event?.id) || null,
    recordedAt: Number(event?.recordedAt) || null,
    event: event?.event || null,
    tabId: Number.isInteger(event?.tabId) ? event.tabId : null,
    frameId: Number.isInteger(event?.frameId) ? event.frameId : null,
    status: event?.status || null,
    reason: event?.reason || null,
    route: event?.route || null,
    messageType: event?.messageType || null,
    hostname: event?.hostname || null,
    documentId: typeof event?.documentId === 'string' ? event.documentId : null,
    sessionKey: typeof event?.sessionKey === 'string' ? event.sessionKey : null,
    attemptId: Number.isSafeInteger(event?.attemptId) && event.attemptId > 0
      ? event.attemptId
      : null,
    startedAt: Number.isSafeInteger(event?.startedAt) && event.startedAt > 0
      ? event.startedAt
      : null,
    trigger: typeof event?.trigger === 'string' ? event.trigger : null,
    syncAttempt: Number.isSafeInteger(event?.syncAttempt) && event.syncAttempt > 0
      ? event.syncAttempt
      : null,
    maxAttempts: Number.isSafeInteger(event?.maxAttempts) && event.maxAttempts > 0
      ? event.maxAttempts
      : null,
    errorCode: typeof event?.errorCode === 'string' ? event.errorCode : null,
    documentDisposition: typeof event?.documentDisposition === 'string'
      ? event.documentDisposition
      : null,
    diagnosticReason: event?.diagnosticReason || null,
    permissionState: event?.permissionState || null,
    visibilityState: event?.visibilityState || null,
    bootstrapStatus: event?.bootstrapStatus || null,
    bootstrapReason: event?.bootstrapReason || null,
    bootstrapError: event?.bootstrapError ? safeError(event.bootstrapError) : null,
    bootstrapToReceiverReadyMs: finiteNumberOrNull(event?.bootstrapToReceiverReadyMs),
    bootstrapToActiveMs: finiteNumberOrNull(event?.bootstrapToActiveMs),
    ...projectProtectionTabUpdatedDispatchDiagnostic(event),
  }));
  return {
    availability: 'measured',
    error: null,
    currentSession,
    events,
    window: {
      requestedLimit,
      returnedCount: events.length,
      maxEntries: Number.isSafeInteger(snapshot.maxEntries) && snapshot.maxEntries > 0
        ? snapshot.maxEntries
        : null,
      totalEntries: Number.isSafeInteger(snapshot.totalEntries) && snapshot.totalEntries >= 0
        ? snapshot.totalEntries
        : null,
      nextSequence: Number.isSafeInteger(snapshot.nextSequence) && snapshot.nextSequence > 0
        ? snapshot.nextSequence
        : null,
      windowMayBeTruncated: events.length >= requestedLimit
        || (
          Number.isSafeInteger(snapshot.maxEntries)
          && snapshot.maxEntries > 0
          && Number.isSafeInteger(snapshot.totalEntries)
          && snapshot.totalEntries >= snapshot.maxEntries
        ),
    },
  };
}

export function getContentRuntimeEventCursor(diagnostics) {
  return (Array.isArray(diagnostics?.events) ? diagnostics.events : []).reduce(
    (latest, event) => Math.max(latest, Number.isInteger(event?.id) ? event.id : 0),
    0,
  );
}

function findLatestProtectionDispatchTerminalEvent(diagnostics, afterEventId) {
  return (Array.isArray(diagnostics?.events) ? diagnostics.events : []).reduce(
    (latest, event) => {
      if (
        !Number.isInteger(event?.id)
        || event.id <= afterEventId
        || (event.event !== 'dispatch_failed' && event.event !== 'dispatch_succeeded')
        || event.route !== 'protection_update'
        || event.messageType !== 'PROTECTION_UPDATE'
      ) {
        return latest;
      }
      return latest === null || event.id > latest.id ? event : latest;
    },
    null,
  );
}

export async function waitForScenarioSettingsPropagation(
  harness,
  page,
  {
    receipt = null,
    afterEventId = 0,
    timeoutMs = 10_000,
    pollIntervalMs = 100,
    now = () => Date.now(),
    delay = sleep,
    readDiagnostics = () => collectContentRuntimeDiagnostics(harness, page),
  } = {},
) {
  if (receipt === null) {
    return {
      state: 'not_required',
      reason: 'settings_propagation_not_scheduled',
      completed: true,
      receipt: null,
      dispatchEvent: null,
    };
  }
  if (receipt?.status === 'timed_out') {
    return {
      state: 'insufficient',
      reason: 'settings_propagation_task_timed_out',
      completed: false,
      receipt,
      dispatchEvent: null,
      waitedMs: 0,
    };
  }
  if (receipt?.status === 'failed' || receipt?.status === 'schedule_failed') {
    return {
      state: 'broken',
      reason: 'settings_propagation_task_failed',
      completed: false,
      receipt,
      dispatchEvent: null,
      waitedMs: 0,
    };
  }
  if (receipt?.status === 'succeeded') {
    if (
      !Number.isInteger(receipt?.taskId)
      || receipt.taskId <= 0
      || receipt?.applied?.broadcast !== true
    ) {
      return {
        state: 'broken',
        reason: 'settings_propagation_broadcast_not_applied',
        completed: false,
        receipt,
        dispatchEvent: null,
        waitedMs: 0,
      };
    }
    const diagnostics = await readDiagnostics();
    const terminalEvent = findLatestProtectionDispatchTerminalEvent(
      diagnostics,
      afterEventId,
    );
    return {
      state: 'measured',
      reason: 'settings_propagation_task_succeeded',
      completed: true,
      receipt,
      dispatchEvent: terminalEvent?.event === 'dispatch_succeeded' ? terminalEvent : null,
      waitedMs: 0,
    };
  }
  if (
    receipt?.status !== 'scheduled'
    || !Number.isInteger(receipt?.taskId)
    || receipt.taskId <= 0
  ) {
    return {
      state: 'broken',
      reason: 'settings_propagation_receipt_invalid',
      completed: false,
      receipt,
      dispatchEvent: null,
    };
  }

  const startedAt = now();
  const deadline = startedAt + Math.max(1, Number(timeoutMs) || 1);
  let diagnostics = null;
  let terminalEvent = null;
  while (now() <= deadline) {
    diagnostics = await readDiagnostics();
    terminalEvent = findLatestProtectionDispatchTerminalEvent(
      diagnostics,
      afterEventId,
    );
    if (terminalEvent?.event === 'dispatch_succeeded') {
      return {
        state: 'measured',
        reason: 'content_protection_dispatch_acknowledged',
        completed: true,
        receipt,
        dispatchEvent: terminalEvent,
        waitedMs: Math.max(0, now() - startedAt),
      };
    }
    if (now() >= deadline) break;
    await delay(Math.min(pollIntervalMs, deadline - now()));
  }
  if (terminalEvent?.event === 'dispatch_failed') {
    return {
      state: 'broken',
      reason: 'content_protection_dispatch_failed',
      completed: false,
      receipt,
      dispatchEvent: terminalEvent,
      waitedMs: Math.max(0, now() - startedAt),
    };
  }
  return {
    state: diagnostics?.availability === 'measured' ? 'insufficient' : 'unavailable',
    reason: diagnostics?.availability === 'measured'
      ? 'content_protection_dispatch_ack_not_observed'
      : 'content_runtime_diagnostics_unavailable',
    completed: false,
    receipt,
    dispatchEvent: null,
    waitedMs: Math.max(0, now() - startedAt),
  };
}

export async function collectProtectionRuntimeEvidence(
  harness,
  scenario,
  { refresh = false } = {},
) {
  const hostname = new URL(getScenarioPrimaryUrl(scenario)).hostname;
  const response = await sendHarnessMessage(harness, {
    action: refresh
      ? 'REFRESH_PROTECTION_RUNTIME_SNAPSHOT'
      : 'GET_PROTECTION_RUNTIME_SNAPSHOT',
    hostname,
  });
  if (response?.success !== true || !response?.snapshot) {
    return {
      availability: 'unavailable',
      error: safeError(response?.error || 'protection runtime snapshot unavailable'),
    };
  }
  const snapshot = response.snapshot;
  const runtime = snapshot.runtime || {};
  const observation = runtime.observation || {};
  const strategy = runtime.strategy || {};
  return {
    availability: runtime.available === true ? 'measured' : 'inactive',
    error: null,
    host: snapshot.scope?.host || null,
    revision: finiteNumberOrNull(runtime.revision),
    observation: {
      budgetRatio: finiteNumberOrNull(observation.budgetRatio),
      siteDayMs: finiteNumberOrNull(observation.siteDayMs),
      sessionMs: finiteNumberOrNull(observation.sessionMs),
      directTriggers: Array.isArray(observation.directTriggers)
        ? [...observation.directTriggers]
        : [],
      pressureSignals: Array.isArray(observation.pressureSignals)
        ? [...observation.pressureSignals]
        : [],
    },
    strategy: {
      state: typeof strategy.state === 'string' ? strategy.state : null,
      intensity: finiteNumberOrNull(strategy.intensity),
    },
  };
}

export async function collectStorageSummary(harness) {
  return harness.evaluateInTrustedPage(`(async () => {
    const byteLength = (value) => {
      try { return new TextEncoder().encode(JSON.stringify(value ?? null)).length; }
      catch (_) { return 0; }
    };
    const read = (area) => new Promise((resolve) => {
      area.get(null, (values) => {
        const runtimeError = chrome.runtime.lastError && chrome.runtime.lastError.message;
        if (runtimeError) {
          resolve({ bytes: null, entries: [], error: runtimeError });
          return;
        }
        const source = values && typeof values === 'object' ? values : {};
        resolve({
          bytes: byteLength(source),
          entries: Object.entries(source).map(([key, value]) => ({
            key,
            bytes: byteLength(value),
          })).sort((left, right) => right.bytes - left.bytes),
          error: null,
        });
      });
    });
    return {
      local: await read(chrome.storage.local),
      session: chrome.storage.session
        ? await read(chrome.storage.session)
        : { bytes: null, entries: [], error: 'chrome.storage.session unavailable' },
    };
  })()`, { timeoutMs: 20_000 });
}

function resolveLayoutCycleOpportunityClassifier(oracle) {
  if (oracle === null) return null;
  if (oracle?.opportunityKind !== LAYOUT_CYCLE_OPPORTUNITY_KIND) {
    throw new Error(
      `SITE_LAYOUT_CYCLE_OPPORTUNITY_KIND_UNSUPPORTED:${oracle?.opportunityKind || 'missing'}`,
    );
  }
  return YOUTUBE_WATCH_INFO_OPPORTUNITY_CLASSIFIER;
}

function pageProbeExpression(scenario) {
  const readinessSelectors = scenario?.readiness?.selectors || [];
  const blockerSelectors = scenario?.blockerClassifiers?.selectors || {};
  const candidateSelectors = scenario?.observableEffects?.candidateSelectors || [];
  const appliedSelectors = scenario?.observableEffects?.appliedSelectors || [];
  const rootAttributes = scenario?.observableEffects?.rootAttributes || [];
  const rootAttributeActiveValues = scenario?.observableEffects?.rootAttributeActiveValues || {};
  const disableCleanupScope = scenario?.observableEffects?.disableCleanup?.scope || null;
  const disableCleanupSelectors = scenario?.observableEffects?.disableCleanup?.selectors || [];
  const disableCleanupRootAttributes = scenario?.observableEffects?.disableCleanup?.rootAttributes || [];
  const targetingOracle = scenario?.observableEffects?.targetingOracle || null;
  const layoutCycleOracle = scenario?.observableEffects?.layoutCycleOracle || null;
  const layoutCycleOpportunityClassifier = resolveLayoutCycleOpportunityClassifier(
    layoutCycleOracle,
  );
  const allConditions = [
    ...(scenario?.readiness?.conditions || []),
    ...(scenario?.observableEffects?.conditions || []),
    ...(scenario?.settle?.conditions || []),
  ];
  const settleSelectors = (scenario?.settle?.conditions || []).flatMap((condition) => [
    ...(typeof condition?.selector === 'string' ? [condition.selector] : []),
    ...(Array.isArray(condition?.selectors) ? condition.selectors : []),
  ]);
  const conditionSelectorsById = Object.fromEntries(allConditions.map((condition) => [
    condition.id,
    [
      ...(typeof condition?.selector === 'string' ? [condition.selector] : []),
      ...(Array.isArray(condition?.selectors) ? condition.selectors : []),
    ],
  ]));
  const conditionAttributesById = Object.fromEntries(allConditions.map((condition) => [
    condition.id,
    typeof condition?.attribute === 'string' ? condition.attribute : null,
  ]));
  return `((input) => {
    const count = (selectors) => selectors.reduce((total, selector) => {
      try { return total + document.querySelectorAll(selector).length; }
      catch (_) { return total; }
    }, 0);
    const present = (selectors) => selectors.some((selector) => {
      try { return document.querySelector(selector) !== null; }
      catch (_) { return false; }
    });
    const rootSignalActive = (name) => {
      if (!document.documentElement.hasAttribute(name)) return false;
      const expectedValue = input.rootAttributeActiveValues[name];
      return typeof expectedValue !== 'string'
        || document.documentElement.getAttribute(name) === expectedValue;
    };
    const renderedSurfacePresent = (selectors) => selectors.some((selector) => {
      try {
        return Array.from(document.querySelectorAll(selector)).some((element) => {
          if (!(element instanceof Element)) return false;
          const style = getComputedStyle(element);
          if (
            style.display === 'none'
            || style.visibility === 'hidden'
            || style.visibility === 'collapse'
            || Number.parseFloat(style.opacity) === 0
          ) return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      } catch (_) {
        return false;
      }
    });
    const selectUniqueElements = (selectors) => {
      const selected = [];
      const seen = new Set();
      selectors.forEach((selector) => {
        let matches = [];
        try { matches = Array.from(document.querySelectorAll(selector)); }
        catch (_) { return; }
        matches.forEach((element) => {
          if (!(element instanceof Element) || seen.has(element)) return;
          seen.add(element);
          selected.push(element);
        });
      });
      return selected;
    };
    const measureLayoutCycle = (oracle, opportunityClassifier) => {
      if (!oracle) return null;
      const markerElements = selectUniqueElements([oracle.ownerMarkerSelector]);
      const restoredCandidates = selectUniqueElements(oracle.restoredCandidateSelectors);
      const isCollapsedCandidate = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display === 'none' && rect.width === 0 && rect.height === 0;
      };
      const isVisibleCandidate = (element) => {
        const style = getComputedStyle(element);
        if (
          style.display === 'none'
          || style.visibility === 'hidden'
          || style.visibility === 'collapse'
          || Number.parseFloat(style.opacity) === 0
        ) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const normalizeAccessibleText = (element) => String(
        element?.getAttribute?.('aria-label')
        || element?.getAttribute?.('title')
        || element?.textContent
        || '',
      ).replace(/\\s+/gu, ' ').trim();
      const classifyNativeOpportunity = (container) => {
        if (!(container instanceof Element) || !opportunityClassifier) return null;
        let matchesOpportunityContainer = false;
        let rawLeaves = [];
        try {
          matchesOpportunityContainer = container.matches(
            opportunityClassifier.containerSelector,
          );
          rawLeaves = Array.from(
            container.querySelectorAll(opportunityClassifier.leafSelector),
          ).slice(0, opportunityClassifier.maximumLeafCount);
        } catch (_) {
          return null;
        }
        if (!matchesOpportunityContainer) return null;
        const meaningfulLeaves = rawLeaves.filter((leaf) => {
          const text = normalizeAccessibleText(leaf);
          if (!text) return false;
          return !rawLeaves.some((nested) => (
            nested !== leaf
            && leaf.contains(nested)
            && normalizeAccessibleText(nested)
          ));
        });
        const viewOnlyPattern = new RegExp(
          opportunityClassifier.viewOnlyPatternSource,
          'iu',
        );
        const timeOnlyPattern = new RegExp(
          opportunityClassifier.timeOnlyPatternSource,
          'iu',
        );
        const combinedPattern = new RegExp(
          opportunityClassifier.combinedPatternSource,
          'iu',
        );
        const neutralPattern = new RegExp(
          opportunityClassifier.neutralPatternSource,
          'u',
        );
        let hasView = false;
        let hasTime = false;
        const signalLeaves = [];
        for (const leaf of meaningfulLeaves) {
          const text = normalizeAccessibleText(leaf);
          if (neutralPattern.test(text)) continue;
          if (combinedPattern.test(text)) {
            hasView = true;
            hasTime = true;
            signalLeaves.push(leaf);
            continue;
          }
          if (viewOnlyPattern.test(text)) {
            hasView = true;
            signalLeaves.push(leaf);
            continue;
          }
          if (timeOnlyPattern.test(text)) {
            hasTime = true;
            signalLeaves.push(leaf);
            continue;
          }
          return null;
        }
        return hasView && hasTime && signalLeaves.length > 0
          ? { container, signalLeaves }
          : null;
      };
      const isNativeSignalStyleVisible = (element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && style.visibility !== 'collapse'
          && Number.parseFloat(style.opacity) !== 0;
      };
      const candidateOwnerMarkers = [];
      const candidateDescendantOwnerMarkers = new Set();
      restoredCandidates.forEach((candidate) => {
        let ownerMarked = false;
        let descendantMarkers = [];
        try {
          ownerMarked = candidate.matches(oracle.ownerMarkerSelector);
          descendantMarkers = Array.from(
            candidate.querySelectorAll(oracle.ownerMarkerSelector),
          );
        } catch (_) {
          return;
        }
        if (ownerMarked) candidateOwnerMarkers.push(candidate);
        descendantMarkers.forEach((marker) => candidateDescendantOwnerMarkers.add(marker));
      });
      const matchesDeclaredCollapsedContainer = (element) => {
        try {
          return oracle.collapsedContainerSelectors.some(
            (selector) => element.matches(selector),
          );
        } catch (_) {
          return false;
        }
      };
      const declaredCollapsedContainerMarkers = markerElements.filter(
        matchesDeclaredCollapsedContainer,
      );
      const collapsedOwnedMetadataContainers = declaredCollapsedContainerMarkers.filter(
        (marker) => {
          let ownsSocialMetricDescendant = false;
          try {
            ownsSocialMetricDescendant = oracle.ownedMetricSelectors.some(
              (selector) => marker.querySelector(selector) !== null,
            );
          } catch (_) {
            return false;
          }
          return ownsSocialMetricDescendant && isCollapsedCandidate(marker);
        },
      );
      const nativeOpportunities = restoredCandidates
        .map((candidate) => classifyNativeOpportunity(candidate))
        .filter((entry) => entry !== null);
      const nativeOpportunityContainers = new Set(
        nativeOpportunities.map((entry) => entry.container),
      );
      const collapsedOwnedNativeOpportunityCount =
        collapsedOwnedMetadataContainers.filter(
          (container) => nativeOpportunityContainers.has(container),
        ).length;
      const visibleNativeOpportunityCount = nativeOpportunities.filter((entry) => (
        isVisibleCandidate(entry.container)
        && entry.signalLeaves.every(isNativeSignalStyleVisible)
      )).length;
      const collapsedCount = restoredCandidates.filter(isCollapsedCandidate).length;
      const visibleRestoredTargetCount = restoredCandidates.filter(isVisibleCandidate).length;
      const visibleDeclaredCollapsedContainerMarkerCount =
        declaredCollapsedContainerMarkers.filter(isVisibleCandidate).length;
      const visibleRestoredAncestorOfCollapsedContainerCount = restoredCandidates.filter(
        (candidate) => (
          isVisibleCandidate(candidate)
          && collapsedOwnedMetadataContainers.some((container) => (
            candidate === container || candidate.contains(container)
          ))
        ),
      ).length;
      return {
        markerCount: markerElements.length,
        candidateCount: restoredCandidates.length,
        candidateOwnerMarkerCount: candidateOwnerMarkers.length,
        candidateDescendantOwnerMarkerCount: candidateDescendantOwnerMarkers.size,
        declaredCollapsedContainerMarkerCount: declaredCollapsedContainerMarkers.length,
        visibleDeclaredCollapsedContainerMarkerCount,
        collapsedOwnedMetadataContainerCount: collapsedOwnedMetadataContainers.length,
        nativeOpportunityCount: nativeOpportunities.length,
        collapsedOwnedNativeOpportunityCount,
        visibleNativeOpportunityCount,
        visibleRestoredAncestorOfCollapsedContainerCount,
        visibleOwnerMarkedCandidateCount:
          candidateOwnerMarkers.filter(isVisibleCandidate).length,
        collapsedCount,
        visibleRestoredTargetCount,
      };
    };
    const href = location.href;
    const path = location.pathname.toLowerCase();
    const authPath = /(?:^|\\/)(?:login|signin|accounts?)(?:\\/|$)/u.test(path);
    const firstCandidate = input.candidateSelectors.reduce((found, selector) => {
      if (found) return found;
      try { return document.querySelector(selector); }
      catch (_) { return null; }
    }, null);
    const sampleTargetingElementStyles = (elements, {
      keyPrefix,
      maximumSamplesPerSelector,
      positiveGeometry = null,
    } = {}) => elements.flatMap((element, matchIndex) => {
        if (!(element instanceof Element)) return [];
        const style = getComputedStyle(element);
        if (
          style.display === 'none'
          || style.visibility === 'hidden'
          || Number.parseFloat(style.opacity) === 0
        ) return [];
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return [];
        if (
          positiveGeometry
          && (
            rect.width < positiveGeometry.minimumWidth
            || rect.height < positiveGeometry.minimumHeight
            || (rect.width * rect.height) < positiveGeometry.minimumArea
          )
        ) return [];
        return [{
          key: keyPrefix + ':' + matchIndex,
          style: {
            letterSpacing: style.letterSpacing,
            filter: style.filter,
            opacity: style.opacity,
            visibility: style.visibility,
            display: style.display,
          },
        }];
      }).slice(0, maximumSamplesPerSelector);
    const sampleTargetingStyles = (selectors, options = {}) => selectors.flatMap(
      (selector, selectorIndex) => {
        let matches = [];
        try {
          matches = Array.from(document.querySelectorAll(selector));
        } catch (_) {
          return [];
        }
        return sampleTargetingElementStyles(matches, {
          ...options,
          keyPrefix: String(selectorIndex),
        });
      },
    );
    const sampleSemanticNegativeControlStyles = (controls, options = {}) => controls.flatMap(
      (control) => {
        let matches = [];
        if (
          control.kind === ${JSON.stringify(
            SITE_TARGETING_SEMANTIC_NEGATIVE_CONTROL_KINDS.HTML_VIDEO_ELEMENT,
          )}
          && typeof HTMLVideoElement === 'function'
        ) {
          matches = Array.from(document.getElementsByTagName('video')).filter(
            (element) => element instanceof HTMLVideoElement,
          );
        }
        return sampleTargetingElementStyles(matches, {
          ...options,
          keyPrefix: 'semantic:' + control.kind,
        });
      },
    );
    const candidateStyle = firstCandidate instanceof Element
      ? (() => {
        const style = getComputedStyle(firstCandidate);
        return {
          letterSpacing: style.letterSpacing,
          filter: style.filter,
          opacity: style.opacity,
          visibility: style.visibility,
          display: style.display,
        };
      })()
      : null;
    const targeting = input.targetingOracle
      ? {
        styleProperties: input.targetingOracle.styleProperties,
        negativeControlRequired:
          input.targetingOracle.negativeSelectors.length > 0
          || input.targetingOracle.semanticNegativeControls.length > 0,
        positiveSamples: sampleTargetingStyles(
          input.targetingOracle.positiveSelectors,
          {
            maximumSamplesPerSelector:
              input.targetingOracle.maximumSamplesPerSelector,
            positiveGeometry: input.targetingOracle.positiveGeometry,
          },
        ),
        negativeSamples: [
          ...sampleTargetingStyles(input.targetingOracle.negativeSelectors, {
            maximumSamplesPerSelector:
              input.targetingOracle.maximumSamplesPerSelector,
          }),
          ...sampleSemanticNegativeControlStyles(
            input.targetingOracle.semanticNegativeControls,
            {
              maximumSamplesPerSelector:
                input.targetingOracle.maximumSamplesPerSelector,
            },
          ),
        ],
      }
      : null;
    const layoutCycle = measureLayoutCycle(
      input.layoutCycleOracle,
      input.layoutCycleOpportunityClassifier,
    );
    const appliedElements = input.appliedSelectors.flatMap((selector) => {
      try { return Array.from(document.querySelectorAll(selector)); }
      catch (_) { return []; }
    });
    const appliedHiddenCount = appliedElements.filter((element) => {
      if (!(element instanceof Element)) return false;
      const style = getComputedStyle(element);
      return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0;
    }).length;
    const video = document.querySelector('video');
    return {
      readyState: document.readyState,
      readinessSatisfied: present(input.readinessSelectors),
      readinessMatchCount: count(input.readinessSelectors),
      candidateCount: targeting
        ? targeting.positiveSamples.length
        : count(input.candidateSelectors),
      appliedTargetCount: count(input.appliedSelectors),
      disableCleanupScope: input.disableCleanupScope,
      disableCleanupAppliedTargetCount: count(input.disableCleanupSelectors),
      appliedHiddenCount,
      activeRootSignalCount: input.rootAttributes.reduce((total, name) => (
        total + (rootSignalActive(name) ? 1 : 0)
      ), 0),
      disableCleanupRootSignalCount: input.disableCleanupRootAttributes.reduce((total, name) => (
        total + (rootSignalActive(name) ? 1 : 0)
      ), 0),
      rootAttributeValues: Object.fromEntries(input.rootAttributes.map((name) => [
        name,
        document.documentElement.hasAttribute(name)
          ? document.documentElement.getAttribute(name)
          : null,
      ])),
      settleSelectorCount: count(input.settleSelectors),
      conditionSelectorCounts: Object.fromEntries(Object.entries(input.conditionSelectorsById)
        .map(([id, selectors]) => [id, count(selectors)])),
      conditionAttributePresent: Object.fromEntries(Object.entries(input.conditionAttributesById)
        .map(([id, attribute]) => [
          id,
          typeof attribute === 'string'
            ? document.documentElement.hasAttribute(attribute)
            : null,
        ])),
      candidateStyle,
      targeting,
      layoutCycle,
      videoCount: document.querySelectorAll('video').length,
      media: video instanceof HTMLVideoElement ? {
        currentTime: Number.isFinite(video.currentTime) ? video.currentTime : null,
        duration: Number.isFinite(video.duration) ? video.duration : null,
        paused: video.paused,
        readyState: video.readyState,
      } : null,
      authSurface: authPath || present(input.authSelectors),
      captchaSurface: renderedSurfacePresent(input.captchaSelectors),
      twoFactorSurface: present(input.twoFactorSelectors),
      consentSurface: present(input.consentSelectors),
      pathname: location.pathname,
      url: href,
    };
  })(${JSON.stringify({
    readinessSelectors,
    candidateSelectors,
    appliedSelectors,
    rootAttributes,
    rootAttributeActiveValues,
    disableCleanupScope,
    disableCleanupSelectors,
    disableCleanupRootAttributes,
    targetingOracle,
    layoutCycleOracle,
    layoutCycleOpportunityClassifier,
    settleSelectors,
    conditionSelectorsById,
    conditionAttributesById,
    authSelectors: blockerSelectors.auth || DEFAULT_BLOCKER_SELECTORS.auth,
    captchaSelectors: blockerSelectors.captcha || DEFAULT_BLOCKER_SELECTORS.captcha,
    twoFactorSelectors: blockerSelectors.twoFactor || DEFAULT_BLOCKER_SELECTORS.twoFactor,
    consentSelectors: blockerSelectors.consent || DEFAULT_BLOCKER_SELECTORS.consent,
  })})`;
}

export async function readScenarioPageState(harness, page, scenario) {
  const value = await evaluate(harness.cdp, page.sessionId, pageProbeExpression(scenario), {
    timeoutMs: 5_000,
  });
  return {
    ...value,
    url: sanitizeSiteHarnessUrl(value?.url),
  };
}

export async function waitForScenarioReadiness(
  harness,
  page,
  scenario,
  { timeoutMs = null } = {},
) {
  const resolvedTimeout = Math.max(
    1_000,
    Number(timeoutMs ?? scenario?.readiness?.timeoutMs) || 20_000,
  );
  const deadline = Date.now() + resolvedTimeout;
  let last = null;
  while (Date.now() < deadline) {
    last = await readScenarioPageState(harness, page, scenario).catch((error) => ({
      error: safeError(error),
    }));
    if (last?.captchaSurface) {
      return { ready: false, blocker: { classification: 'blocked', reason: 'captcha' }, state: last };
    }
    if (last?.twoFactorSurface) {
      return { ready: false, blocker: { classification: 'blocked', reason: 'two_factor' }, state: last };
    }
    if (last?.authSurface) {
      return { ready: false, blocker: { classification: 'auth_required', reason: 'login_surface' }, state: last };
    }
    if (last?.consentSurface) {
      return { ready: false, blocker: { classification: 'blocked', reason: 'consent_takeover' }, state: last };
    }
    if (
      last?.readinessSatisfied === true
      && (last.readyState === 'interactive' || last.readyState === 'complete')
    ) {
      return { ready: true, blocker: null, state: last };
    }
    await sleep(250);
  }
  return {
    ready: false,
    blocker: {
      classification: last?.error ? 'blocked' : 'contract_drift',
      reason: last?.error ? 'page_unavailable' : 'readiness_timeout',
    },
    state: last,
  };
}

async function performScroll(harness, page, action) {
  const rounds = Math.max(1, Math.min(20, Number(action.rounds ?? action.maximumSteps) || 4));
  const deltaY = Math.max(120, Math.min(1800, Number(action.deltaY ?? action.maximumDeltaY) || 700));
  const intervalMs = Math.max(
    50,
    Math.min(2_000, Number(action.intervalMs ?? action.minimumDwellMs) || 180),
  );
  for (let index = 0; index < rounds; index += 1) {
    await evaluate(harness.cdp, page.sessionId, `window.scrollBy({ top: ${deltaY}, left: 0, behavior: 'instant' })`);
    await sleep(intervalMs);
  }
}

async function prepareScrollContentionFixture(harness, page, action) {
  const initialRowCount = Math.max(8, Math.min(200, Number(action.initialRowCount) || 32));
  const initialSettleMs = Math.max(0, Math.min(5_000, Number(action.initialSettleMs) || 0));
  const result = await evaluate(harness.cdp, page.sessionId, `((input) => {
    const stateKey = '__entropyQaScrollContentionFixtureV1';
    if (window[stateKey]) {
      throw new Error('SITE_E2E_SCROLL_CONTENTION_FIXTURE_STATE_DUPLICATE');
    }
    const fixtureId = 'entropy-qa-scroll-contention-fixture';
    if (document.getElementById(fixtureId)) {
      throw new Error('SITE_E2E_SCROLL_CONTENTION_FIXTURE_DUPLICATE');
    }
    const fixture = document.createElement('section');
    fixture.id = fixtureId;
    fixture.setAttribute('data-entropy-qa-scroll-fixture', '1');
    fixture.style.cssText = [
      'box-sizing:border-box',
      'display:grid',
      'grid-template-columns:repeat(2,minmax(0,1fr))',
      'gap:16px',
      'margin:16px auto',
      'padding:16px',
      'width:min(960px,calc(100vw - 32px))',
      'background:#f3f0e8',
      'color:#24211c',
    ].join(';');
    const pixel = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2232%22%3E%3Crect width=%2248%22 height=%2232%22 fill=%22%238b765c%22/%3E%3C/svg%3E';
    const createRow = (laneId, index) => {
      const row = document.createElement('article');
      row.setAttribute('data-entropy-qa-scroll-row', laneId + '-' + index);
      row.style.cssText = [
        'box-sizing:border-box',
        'display:grid',
        'grid-template-columns:48px 1fr',
        'align-items:center',
        'gap:10px',
        'min-height:72px',
        'padding:10px',
        'border-bottom:1px solid #e4ded1',
      ].join(';');
      const image = document.createElement('img');
      image.src = pixel;
      image.alt = '';
      image.width = 48;
      image.height = 32;
      const text = document.createElement('p');
      text.textContent = 'Entropy runtime contention sample ' + laneId + '-' + index;
      row.append(image, text);
      return row;
    };
    const lanesById = {};
    ['a', 'b'].forEach((laneId) => {
      const lane = document.createElement('div');
      lane.setAttribute('data-entropy-qa-scroll-lane', laneId);
      lane.tabIndex = 0;
      lane.style.cssText = [
        'box-sizing:border-box',
        'height:360px',
        'overflow:auto',
        'overscroll-behavior:contain',
        'border:1px solid #b6ab98',
        'background:#fffdf7',
      ].join(';');
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < input.initialRowCount; index += 1) {
        fragment.append(createRow(laneId, index));
      }
      lane.append(fragment);
      fixture.append(lane);
      lanesById[laneId] = lane;
    });
    document.body.append(fixture);
    window[stateKey] = {
      fixture,
      lanesById,
      bursts: Object.create(null),
      nextRowByLane: {
        a: input.initialRowCount,
        b: input.initialRowCount,
      },
      appendRows(laneId, rowCount) {
        const lane = this.lanesById[laneId];
        if (!(lane instanceof HTMLElement)) {
          throw new Error('SITE_E2E_SCROLL_CONTENTION_LANE_REQUIRED:' + laneId);
        }
        const fragment = document.createDocumentFragment();
        const startIndex = this.nextRowByLane[laneId];
        for (let offset = 0; offset < rowCount; offset += 1) {
          fragment.append(createRow(laneId, startIndex + offset));
        }
        lane.append(fragment);
        this.nextRowByLane[laneId] += rowCount;
        return { startIndex, rowCount };
      },
    };
    fixture.scrollIntoView({ block: 'start', behavior: 'instant' });
    const lanes = Array.from(fixture.querySelectorAll('[data-entropy-qa-scroll-lane]'));
    return {
      status: 'performed',
      prepared: true,
      laneCount: lanes.length,
      rowCount: fixture.querySelectorAll('[data-entropy-qa-scroll-row]').length,
      scrollableLaneCount: lanes.filter((lane) => lane.scrollHeight > lane.clientHeight).length,
    };
  })(${JSON.stringify({ initialRowCount })})`);
  if (initialSettleMs > 0) await sleep(initialSettleMs);
  return {
    ...result,
    initialRowCount,
    initialSettleMs,
  };
}

async function captureFeedConsumptionOracleSample(harness, page, feedConsumption) {
  return evaluate(harness.cdp, page.sessionId, `((input) => {
    const oracle = input && input.oracle;
    if (!oracle || oracle.kind !== 'dominant_item') {
      throw new Error('SITE_E2E_FEED_ORACLE_CONTRACT_INVALID');
    }
    const selectors = Array.isArray(oracle.selectors) ? oracle.selectors : [];
    if (selectors.length === 0) {
      throw new Error('SITE_E2E_FEED_ORACLE_SELECTORS_REQUIRED');
    }
    const selector = selectors.join(', ');
    const maximumCandidates = Math.max(1, Math.min(64, Number(oracle.maximumCandidates) || 48));
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const matchedCandidates = Array.from(document.querySelectorAll(selector));
    const candidateSet = new Set(matchedCandidates);
    const outermostCandidates = matchedCandidates.filter((candidate) => {
      let ancestor = candidate.parentElement;
      while (ancestor) {
        if (candidateSet.has(ancestor)) return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    });
    const boundedCandidateCount = Math.min(outermostCandidates.length, maximumCandidates);
    const candidates = outermostCandidates.filter((candidate) => {
      if (!(candidate instanceof Element) || !candidate.isConnected) return false;
      const rect = candidate.getBoundingClientRect();
      return (
        rect.width > 0
        && rect.height > 0
        && Math.min(viewportWidth, rect.right) > Math.max(0, rect.left)
        && Math.min(viewportHeight, rect.bottom) > Math.max(0, rect.top)
      );
    }).slice(0, maximumCandidates);
    const stateKey = '__entropySiteE2EFeedOracleV1';
    let state = window[stateKey];
    if (!state || !(state.identities instanceof WeakMap)) {
      state = {
        identities: new WeakMap(),
        signatureTokens: new Map(),
        nextToken: 1,
      };
      Object.defineProperty(window, stateKey, {
        configurable: true,
        enumerable: false,
        writable: false,
        value: state,
      });
    } else if (!(state.signatureTokens instanceof Map)) {
      state.signatureTokens = new Map();
    }
    const hash = (value) => {
      let result = 2166136261;
      const text = String(value || '');
      if (!text) return 0;
      for (let index = 0; index < text.length; index += 1) {
        result ^= text.charCodeAt(index);
        result = Math.imul(result, 16777619);
      }
      return result >>> 0;
    };
    const readPreferredVideo = (node) => {
      const videos = node.matches && node.matches('video')
        ? [node]
        : Array.from(node.querySelectorAll && node.querySelectorAll('video') || []);
      return videos.find((video) => (
        video
        && video.paused === false
        && video.ended !== true
        && Number(video.readyState) >= 2
      )) || videos[0] || null;
    };
    const readSignatureHash = (node) => {
      const parts = [];
      ['data-item-id', 'data-video-id', 'data-post-id', 'data-id'].forEach((name) => {
        const value = node.getAttribute && node.getAttribute(name);
        if (value) parts.push(name + ':' + value);
      });
      const contentLinkSelector = [
        'a[href*="/video/"]',
        'a[href*="/reel/"]',
        'a[href*="/reels/"]',
        'a[href*="/shorts/"]',
      ].join(', ');
      const link = node.matches && node.matches(contentLinkSelector)
        ? node
        : node.querySelector && node.querySelector(contentLinkSelector);
      if (link) {
        try {
          parts.push('path:' + new URL(link.href, location.href).pathname);
        } catch (_) {
          parts.push('path-invalid');
        }
      }
      if (parts.length === 0) {
        const video = readPreferredVideo(node);
        if (video) {
          const mediaKey = video.currentSrc
            || (video.getAttribute && video.getAttribute('src'))
            || (video.getAttribute && video.getAttribute('poster'))
            || '';
          if (mediaKey) parts.push('media:' + mediaKey.replace(/[?#].*$/u, ''));
        }
      }
      return hash(parts.join('|'));
    };
    const readIdentity = (node) => {
      const signatureHash = readSignatureHash(node);
      let identity = state.identities.get(node);
      if (!identity) {
        let token = signatureHash !== 0
          ? state.signatureTokens.get(signatureHash)
          : null;
        if (!token) {
          token = state.nextToken;
          state.nextToken += 1;
          if (signatureHash !== 0) state.signatureTokens.set(signatureHash, token);
        }
        identity = { token, signatureHash };
        state.identities.set(node, identity);
      } else if (
        signatureHash !== 0
        && identity.signatureHash !== 0
        && signatureHash !== identity.signatureHash
      ) {
        let token = state.signatureTokens.get(signatureHash);
        if (!token) {
          token = state.nextToken;
          state.nextToken += 1;
          state.signatureTokens.set(signatureHash, token);
        }
        identity.token = token;
        identity.signatureHash = signatureHash;
      } else if (signatureHash !== 0) {
        if (!state.signatureTokens.has(signatureHash)) {
          state.signatureTokens.set(signatureHash, identity.token);
        }
        identity.signatureHash = signatureHash;
      }
      return 'item-' + identity.token;
    };
    let winner = null;
    let bestScore = 0;
    let winnerActiveMedia = false;
    candidates.forEach((candidate) => {
      if (!(candidate instanceof Element) || !candidate.isConnected) return;
      const rect = candidate.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return;
      const visibleWidth = Math.max(
        0,
        Math.min(viewportWidth, rect.right) - Math.max(0, rect.left),
      );
      const visibleHeight = Math.max(
        0,
        Math.min(viewportHeight, rect.bottom) - Math.max(0, rect.top),
      );
      const visibleArea = visibleWidth * visibleHeight;
      if (visibleArea <= 0) return;
      const areaScore = Math.min(1, visibleArea / (viewportWidth * viewportHeight));
      const centerDistance = Math.abs((rect.top + (rect.height / 2)) - (viewportHeight / 2));
      const centerScore = Math.max(0, 1 - (centerDistance / viewportHeight));
      const video = readPreferredVideo(candidate);
      const activeMedia = !!(
        video
        && video.paused === false
        && video.ended !== true
        && Number(video.readyState) >= 2
      );
      const score = (activeMedia ? 1 : 0) + (areaScore * 0.55) + (centerScore * 0.45);
      if (score > bestScore) {
        bestScore = score;
        winner = candidate;
        winnerActiveMedia = activeMedia;
      }
    });
    const scroller = document.scrollingElement || document.documentElement;
    const dominantSignatureHash = winner ? readSignatureHash(winner) : 0;
    return {
      state: 'measured',
      dominantToken: winner ? readIdentity(winner) : null,
      dominantIdentitySource: winner
        ? dominantSignatureHash !== 0 ? 'content_signature' : 'node_fallback'
        : null,
      dominantActiveMedia: winner ? winnerActiveMedia : null,
      dominantScore: winner ? Math.round(bestScore * 10000) / 10000 : null,
      candidateCount: boundedCandidateCount,
      scrollTop: Math.max(0, Number(scroller && scroller.scrollTop) || window.scrollY || 0),
      scrollHeight: Math.max(0, Number(scroller && scroller.scrollHeight) || 0),
      clientHeight: Math.max(0, Number(scroller && scroller.clientHeight) || viewportHeight),
    };
  })(${JSON.stringify(feedConsumption)})`);
}

async function waitForFeedConsumptionOracleReadiness(
  harness,
  page,
  feedConsumption,
) {
  const timeoutMs = Math.max(
    1_000,
    Math.min(30_000, Number(feedConsumption?.oracle?.readinessTimeoutMs) || 8_000),
  );
  const minimumStableSamples = Math.max(
    1,
    Math.min(4, Number(feedConsumption?.oracle?.minimumStableSamples) || 1),
  );
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let sample = null;
  let sampleCount = 0;
  let stableSampleCount = 0;
  let stableDominantToken = '';
  let probeMs = 0;

  do {
    const probeStartedAt = Date.now();
    sample = await captureFeedConsumptionOracleSample(harness, page, feedConsumption);
    probeMs += Math.max(0, Date.now() - probeStartedAt);
    sampleCount += 1;
    if (
      sample?.state === 'measured'
      && typeof sample.dominantToken === 'string'
      && sample.dominantToken
    ) {
      if (sample.dominantToken === stableDominantToken) {
        stableSampleCount += 1;
      } else {
        stableDominantToken = sample.dominantToken;
        stableSampleCount = 1;
      }
      if (stableSampleCount >= minimumStableSamples) {
        return {
          state: 'ready',
          sample,
          sampleCount,
          stableSampleCount,
          probeMs,
          waitedMs: Math.max(0, Date.now() - startedAt),
        };
      }
    } else {
      stableDominantToken = '';
      stableSampleCount = 0;
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(250, remainingMs));
  } while (Date.now() < deadline);

  return {
    state: 'timed_out',
    sample,
    sampleCount,
    stableSampleCount,
    probeMs,
    waitedMs: Math.max(0, Date.now() - startedAt),
  };
}

export function resolveVisibleTrustedInputPoint(rect, viewportWidth, viewportHeight) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const height = Math.max(1, Number(viewportHeight) || 1);
  const left = Number(rect?.left);
  const right = Number(rect?.right);
  const top = Number(rect?.top);
  const bottom = Number(rect?.bottom);
  if (![left, right, top, bottom].every(Number.isFinite)) return null;
  const visibleLeft = Math.max(0, left);
  const visibleRight = Math.min(width, right);
  const visibleTop = Math.max(0, top);
  const visibleBottom = Math.min(height, bottom);
  if (visibleRight - visibleLeft <= 1 || visibleBottom - visibleTop <= 1) return null;
  return {
    x: Math.max(1, Math.min(width - 1, visibleLeft + ((visibleRight - visibleLeft) / 2))),
    y: Math.max(1, Math.min(height - 1, visibleTop + ((visibleBottom - visibleTop) / 2))),
    viewportWidth: width,
    viewportHeight: height,
  };
}

async function readTrustedInputPoint(harness, page, action) {
  return evaluate(harness.cdp, page.sessionId, `((input) => {
    const resolveVisibleTrustedInputPoint = ${resolveVisibleTrustedInputPoint.toString()};
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    if (typeof input.targetSelector === 'string' && input.targetSelector) {
      const target = document.querySelector(input.targetSelector);
      if (!(target instanceof Element)) return null;
      const rect = target.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return null;
      return resolveVisibleTrustedInputPoint(rect, viewportWidth, viewportHeight);
    }
    return {
      x: Math.max(1, Math.round(viewportWidth / 2)),
      y: Math.max(1, Math.round(viewportHeight / 2)),
      viewportWidth,
      viewportHeight,
    };
  })(${JSON.stringify(action)})`);
}

async function readTrustedScrollTargetState(harness, page, action) {
  return evaluate(harness.cdp, page.sessionId, `((selector) => {
    const target = document.querySelector(selector);
    if (!(target instanceof HTMLElement)) return null;
    return {
      scrollTop: Math.max(0, Number(target.scrollTop) || 0),
      scrollHeight: Math.max(0, Number(target.scrollHeight) || 0),
      clientHeight: Math.max(0, Number(target.clientHeight) || 0),
    };
  })(${JSON.stringify(action.targetSelector)})`);
}

async function scheduleScrollContentionBurst(harness, page, action) {
  return evaluate(harness.cdp, page.sessionId, `((input) => {
    const state = window.__entropyQaScrollContentionFixtureV1;
    if (!state || typeof state.appendRows !== 'function') {
      throw new Error('SITE_E2E_SCROLL_CONTENTION_BURST_STATE_REQUIRED');
    }
    if (state.bursts[input.probeId]) {
      throw new Error('SITE_E2E_SCROLL_CONTENTION_BURST_DUPLICATE:' + input.probeId);
    }
    const lane = document.querySelector(input.targetSelector);
    const laneId = lane?.getAttribute('data-entropy-qa-scroll-lane');
    if (!laneId || state.lanesById[laneId] !== lane) {
      throw new Error('SITE_E2E_SCROLL_CONTENTION_BURST_LANE_REQUIRED:' + input.probeId);
    }
    const burst = {
      probeId: input.probeId,
      laneId,
      status: 'scheduled',
      rowCount: input.contentBurst.rowCount,
      scheduledAtMs: performance.now(),
      startedAtMs: null,
      endedAtMs: null,
      durationMs: null,
    };
    state.bursts[input.probeId] = burst;
    setTimeout(() => {
      burst.status = 'running';
      burst.startedAtMs = performance.now();
      const appended = state.appendRows(laneId, input.contentBurst.rowCount);
      burst.endedAtMs = performance.now();
      burst.durationMs = burst.endedAtMs - burst.startedAtMs;
      burst.startIndex = appended.startIndex;
      burst.status = 'completed';
    }, input.contentBurst.delayMs);
    return { ...burst };
  })(${JSON.stringify(action)})`);
}

async function readScrollContentionBurst(harness, page, probeId) {
  return evaluate(harness.cdp, page.sessionId, `((probeId) => {
    const burst = window.__entropyQaScrollContentionFixtureV1?.bursts?.[probeId];
    if (!burst) throw new Error('SITE_E2E_SCROLL_CONTENTION_BURST_MISSING:' + probeId);
    return { ...burst };
  })(${JSON.stringify(probeId)})`);
}

async function performTrustedScrollProbe(harness, page, action) {
  const point = await readTrustedInputPoint(harness, page, action);
  if (!point) return { status: 'unavailable', reason: 'trusted_scroll_probe_target_unavailable' };
  const before = await readTrustedScrollTargetState(harness, page, action);
  if (!before || before.scrollHeight <= before.clientHeight) {
    return { status: 'unavailable', reason: 'trusted_scroll_probe_target_not_scrollable' };
  }
  const deltas = action.deltas.map((value) => Number(value));
  const cadenceMs = Math.max(0, Math.min(1_000, Number(action.cadenceMs) || 0));
  let contentBurstScheduled = false;
  for (let index = 0; index < deltas.length; index += 1) {
    await harness.cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: point.x,
      y: point.y,
      deltaX: 0,
      deltaY: deltas[index],
    }, page.sessionId);
    if (action.contentBurst?.afterInputIndex === index) {
      await scheduleScrollContentionBurst(harness, page, action);
      contentBurstScheduled = true;
    }
    if (cadenceMs > 0 && index < deltas.length - 1) await sleep(cadenceMs);
  }
  await sleep(Math.max(50, Math.min(5_000, Number(action.settleMs) || 800)));
  const after = await readTrustedScrollTargetState(harness, page, action);
  const contentBurst = contentBurstScheduled
    ? await readScrollContentionBurst(harness, page, action.probeId)
    : null;
  if (contentBurst && contentBurst.status !== 'completed') {
    throw new Error(`SITE_E2E_SCROLL_CONTENTION_BURST_INCOMPLETE:${action.probeId}:${contentBurst.status}`);
  }
  return {
    status: 'performed',
    probeId: action.probeId,
    trustedInput: true,
    inputKind: 'wheel',
    inputCount: deltas.length,
    totalDeltaY: deltas.reduce((total, value) => total + value, 0),
    cadenceMs,
    beforeScrollTop: before.scrollTop,
    afterScrollTop: after?.scrollTop ?? null,
    movedPx: after ? after.scrollTop - before.scrollTop : null,
    contentBurst,
  };
}

async function readContentLoadOpportunity(harness, page, action) {
  return evaluate(harness.cdp, page.sessionId, `((selectors) => {
    const combinedSelector = selectors.join(',');
    const countsBySelector = Object.fromEntries(selectors.map((selector) => [
      selector,
      document.querySelectorAll(selector).length,
    ]));
    return {
      count: combinedSelector ? document.querySelectorAll(combinedSelector).length : 0,
      countsBySelector,
      observedAtMs: performance.now(),
    };
  })(${JSON.stringify(action.opportunitySelectors)})`, {
    awaitPromise: false,
    timeoutMs: 2_000,
  });
}

async function performTrustedContentLoadProbe(harness, page, action) {
  const point = await readTrustedInputPoint(harness, page, action);
  if (!point) {
    return { status: 'unavailable', reason: 'trusted_content_load_probe_target_unavailable' };
  }
  const before = await readContentLoadOpportunity(harness, page, action);
  const cadenceMs = Math.max(0, Math.min(1_000, Number(action.cadenceMs) || 0));
  const deltaY = Math.max(1, Math.min(1_800, Number(action.deltaY) || 1));
  const minimumOpportunityCount = Math.max(
    1,
    Math.min(100, Number(action.minimumOpportunityCount) || 1),
  );
  let after = before;
  let inputCount = 0;
  let firstOpportunityAtMs = before.count >= minimumOpportunityCount
    ? before.observedAtMs
    : null;

  for (let index = 0; index < action.maximumSteps; index += 1) {
    await harness.cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: point.x,
      y: point.y,
      deltaX: 0,
      deltaY,
    }, page.sessionId);
    inputCount += 1;
    if (cadenceMs > 0) await sleep(cadenceMs);
    after = await readContentLoadOpportunity(harness, page, action);
    if (after.count >= minimumOpportunityCount) {
      firstOpportunityAtMs = after.observedAtMs;
      break;
    }
  }

  await sleep(Math.max(100, Math.min(5_000, Number(action.settleMs) || 1_000)));
  after = await readContentLoadOpportunity(harness, page, action);
  const opportunityObserved = after.count >= minimumOpportunityCount;
  return {
    status: opportunityObserved ? 'performed' : 'unavailable',
    ...(opportunityObserved ? {} : { reason: 'content_load_opportunity_not_observed' }),
    probeId: action.probeId,
    trustedInput: true,
    inputKind: 'wheel',
    inputCount,
    totalDeltaY: inputCount * deltaY,
    cadenceMs,
    minimumOpportunityCount,
    opportunityObserved,
    firstOpportunityAtMs,
    beforeOpportunityCount: before.count,
    afterOpportunityCount: after.count,
    beforeCountsBySelector: before.countsBySelector,
    afterCountsBySelector: after.countsBySelector,
  };
}

const TRUSTED_WHEEL_OVERFLOW_VALUES = new Set([
  'auto',
  'clip',
  'hidden',
  'overlay',
  'scroll',
  'visible',
]);

function normalizeTrustedWheelScrollContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const normalizeTagName = (candidate) => (
    typeof candidate === 'string' && /^[a-z][a-z0-9-]{0,31}$/u.test(candidate)
      ? candidate
      : null
  );
  const normalizeOverflowY = (candidate) => (
    typeof candidate === 'string' && TRUSTED_WHEEL_OVERFLOW_VALUES.has(candidate)
      ? candidate
      : 'other'
  );
  const normalizeCount = (candidate) => {
    const numeric = finiteNumberOrNull(candidate);
    return numeric === null ? null : Math.max(0, Math.min(20, Math.trunc(numeric)));
  };
  const normalizeMetric = (candidate) => {
    const numeric = finiteNumberOrNull(candidate);
    return numeric === null ? null : Math.max(0, numeric);
  };
  return {
    pointSource: value.pointSource === 'selector' ? 'selector' : 'viewport',
    pointAvailable: value.pointAvailable === true,
    targetAvailable: value.targetAvailable === true,
    targetVisible: value.targetVisible === true,
    hitAvailable: value.hitAvailable === true,
    hitTagName: normalizeTagName(value.hitTagName),
    hitInsideTarget: value.hitInsideTarget === true,
    hitInsideMain: value.hitInsideMain === true,
    scrollOwnerCandidateKind: value.scrollOwnerCandidateKind === 'element'
      ? 'element'
      : 'root',
    scrollOwnerCandidateTagName: normalizeTagName(value.scrollOwnerCandidateTagName),
    scrollOwnerCandidateDepthFromHit: normalizeCount(
      value.scrollOwnerCandidateDepthFromHit,
    ),
    scrollOwnerCandidateIsTarget: value.scrollOwnerCandidateIsTarget === true,
    scrollOwnerCandidateIsMain: value.scrollOwnerCandidateIsMain === true,
    scrollOwnerCandidateMatchesBefore: value.scrollOwnerCandidateMatchesBefore === true,
    scrollOwnerCandidateScrollTop: normalizeMetric(value.scrollOwnerCandidateScrollTop),
    scrollOwnerCandidateScrollHeight: normalizeMetric(value.scrollOwnerCandidateScrollHeight),
    scrollOwnerCandidateClientHeight: normalizeMetric(value.scrollOwnerCandidateClientHeight),
    scrollOwnerCandidateOverflowY: normalizeOverflowY(value.scrollOwnerCandidateOverflowY),
    scrollOwnerCandidateCanScrollForward: value.scrollOwnerCandidateCanScrollForward === true,
    rootScrollTop: normalizeMetric(value.rootScrollTop),
    rootScrollHeight: normalizeMetric(value.rootScrollHeight),
    rootClientHeight: normalizeMetric(value.rootClientHeight),
    rootOverflowY: normalizeOverflowY(value.rootOverflowY),
    rootHasScrollRange: value.rootHasScrollRange === true,
    rootCanScrollForward: value.rootCanScrollForward === true,
    rootOverflowLocked: value.rootOverflowLocked === true,
    htmlOverflowY: normalizeOverflowY(value.htmlOverflowY),
    bodyOverflowY: normalizeOverflowY(value.bodyOverflowY),
    htmlOverflowLocked: value.htmlOverflowLocked === true,
    bodyOverflowLocked: value.bodyOverflowLocked === true,
    bodyPositionFixed: value.bodyPositionFixed === true,
    renderedDialogCount: normalizeCount(value.renderedDialogCount),
  };
}

export function buildTrustedWheelScrollEvidence(beforeValue, afterValue) {
  const before = normalizeTrustedWheelScrollContext(beforeValue);
  const after = normalizeTrustedWheelScrollContext(afterValue);
  const rootDelta = (
    Number.isFinite(before?.rootScrollTop)
    && Number.isFinite(after?.rootScrollTop)
  )
    ? after.rootScrollTop - before.rootScrollTop
    : null;
  const scrollOwnerCandidateComparable = (
    before !== null
    && after !== null
    && after.scrollOwnerCandidateMatchesBefore === true
  );
  const scrollOwnerCandidateDelta = (
    scrollOwnerCandidateComparable
    && Number.isFinite(before?.scrollOwnerCandidateScrollTop)
    && Number.isFinite(after?.scrollOwnerCandidateScrollTop)
  )
    ? after.scrollOwnerCandidateScrollTop - before.scrollOwnerCandidateScrollTop
    : null;
  return {
    schemaVersion: 1,
    state: before && after ? 'measured' : before ? 'before_only' : 'unavailable',
    before,
    after,
    rootDelta,
    scrollOwnerCandidateDelta,
    scrollOwnerCandidateComparable,
  };
}

async function readTrustedWheelScrollContext(harness, page, point, action, phase) {
  return evaluate(harness.cdp, page.sessionId, `((input) => {
    const overflowValue = (element) => {
      if (!(element instanceof Element)) return 'other';
      const value = getComputedStyle(element).overflowY;
      return ['auto', 'clip', 'hidden', 'overlay', 'scroll', 'visible'].includes(value)
        ? value
        : 'other';
    };
    const isLockedOverflow = (value) => value === 'hidden' || value === 'clip';
    const isRendered = (element) => {
      if (!(element instanceof Element)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0
        && rect.height > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.visibility !== 'collapse';
    };
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const pointAvailable = Number.isFinite(input.point?.x) && Number.isFinite(input.point?.y);
    const resolvedPoint = pointAvailable
      ? input.point
      : { x: Math.round(viewportWidth / 2), y: Math.round(viewportHeight / 2) };
    const root = document.scrollingElement || document.documentElement || document.body;
    const target = typeof input.targetSelector === 'string' && input.targetSelector
      ? document.querySelector(input.targetSelector)
      : null;
    const main = document.querySelector('main[role="main"]');
    const targetRect = target instanceof Element ? target.getBoundingClientRect() : null;
    const targetVisible = target instanceof Element
      && isRendered(target)
      && targetRect.right > 0
      && targetRect.bottom > 0
      && targetRect.left < viewportWidth
      && targetRect.top < viewportHeight;
    const hit = document.elementFromPoint(resolvedPoint.x, resolvedPoint.y);
    let scrollOwnerCandidate = null;
    let scrollOwnerCandidateDepthFromHit = 0;
    let cursor = hit;
    while (cursor instanceof Element) {
      const overflowY = overflowValue(cursor);
      if (
        cursor === root
        || (
          (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
          && cursor.scrollHeight > cursor.clientHeight + 1
        )
      ) {
        scrollOwnerCandidate = cursor;
        break;
      }
      cursor = cursor.parentElement;
      scrollOwnerCandidateDepthFromHit += 1;
    }
    if (!(scrollOwnerCandidate instanceof Element)) {
      scrollOwnerCandidate = root;
      scrollOwnerCandidateDepthFromHit = null;
    }
    const priorState = window.__entropyQaTrustedWheelScrollEvidenceV1;
    const scrollOwnerCandidateMatchesBefore = input.phase === 'after'
      && priorState?.document === document
      && priorState?.scrollOwnerCandidate === scrollOwnerCandidate;
    if (input.phase === 'before') {
      window.__entropyQaTrustedWheelScrollEvidenceV1 = {
        document,
        scrollOwnerCandidate,
      };
    } else if (input.phase === 'after') {
      delete window.__entropyQaTrustedWheelScrollEvidenceV1;
    }
    const htmlOverflowY = overflowValue(document.documentElement);
    const bodyOverflowY = overflowValue(document.body);
    const rootOverflowY = overflowValue(root);
    const rootScrollHeight = Math.max(0, Number(root?.scrollHeight) || 0);
    const rootClientHeight = Math.max(0, Number(root?.clientHeight) || 0);
    const rootScrollTop = Math.max(0, Number(root?.scrollTop) || 0);
    const scrollOwnerCandidateScrollHeight = Math.max(
      0,
      Number(scrollOwnerCandidate?.scrollHeight) || 0,
    );
    const scrollOwnerCandidateClientHeight = Math.max(
      0,
      Number(scrollOwnerCandidate?.clientHeight) || 0,
    );
    const scrollOwnerCandidateScrollTop = Math.max(
      0,
      Number(scrollOwnerCandidate?.scrollTop) || 0,
    );
    const renderedDialogCount = Math.min(
      20,
      Array.from(document.querySelectorAll('[role="dialog"]')).filter(isRendered).length,
    );
    return {
      pointSource: input.targetSelector ? 'selector' : 'viewport',
      pointAvailable,
      targetAvailable: target instanceof Element,
      targetVisible,
      hitAvailable: hit instanceof Element,
      hitTagName: hit instanceof Element ? hit.tagName.toLowerCase() : null,
      hitInsideTarget: target instanceof Element && hit instanceof Element && target.contains(hit),
      hitInsideMain: main instanceof Element && hit instanceof Element && main.contains(hit),
      scrollOwnerCandidateKind: scrollOwnerCandidate === root ? 'root' : 'element',
      scrollOwnerCandidateTagName: scrollOwnerCandidate instanceof Element
        ? scrollOwnerCandidate.tagName.toLowerCase()
        : null,
      scrollOwnerCandidateDepthFromHit,
      scrollOwnerCandidateIsTarget: target instanceof Element && scrollOwnerCandidate === target,
      scrollOwnerCandidateIsMain: main instanceof Element && scrollOwnerCandidate === main,
      scrollOwnerCandidateMatchesBefore,
      scrollOwnerCandidateScrollTop,
      scrollOwnerCandidateScrollHeight,
      scrollOwnerCandidateClientHeight,
      scrollOwnerCandidateOverflowY: overflowValue(scrollOwnerCandidate),
      scrollOwnerCandidateCanScrollForward: (
        scrollOwnerCandidateScrollTop + scrollOwnerCandidateClientHeight
        < scrollOwnerCandidateScrollHeight - 1
      ),
      rootScrollTop,
      rootScrollHeight,
      rootClientHeight,
      rootOverflowY,
      rootHasScrollRange: rootScrollHeight > rootClientHeight + 1,
      rootCanScrollForward: rootScrollTop + rootClientHeight < rootScrollHeight - 1,
      rootOverflowLocked: isLockedOverflow(rootOverflowY),
      htmlOverflowY,
      bodyOverflowY,
      htmlOverflowLocked: isLockedOverflow(htmlOverflowY),
      bodyOverflowLocked: isLockedOverflow(bodyOverflowY),
      bodyPositionFixed: document.body instanceof Element
        && getComputedStyle(document.body).position === 'fixed',
      renderedDialogCount,
    };
  })(${JSON.stringify({
    point: point ? { x: point.x, y: point.y } : null,
    targetSelector: action.targetSelector || null,
    phase,
  })})`);
}

export function resolveTrustedWheelMagnitude(action, scrollContext) {
  if (Object.hasOwn(action, 'scrollPageRatio')) {
    if (Object.hasOwn(action, 'deltaY') || Object.hasOwn(action, 'maximumDeltaY')) {
      throw new Error('SITE_E2E_WHEEL_MAGNITUDE_CONFLICT');
    }
    if (!Number.isFinite(action.scrollPageRatio)
      || action.scrollPageRatio <= 0 || action.scrollPageRatio > 1) {
      throw new Error('SITE_E2E_SCROLL_PAGE_RATIO_INVALID');
    }
    const height = scrollContext?.scrollOwnerCandidateClientHeight;
    if (!Number.isFinite(height) || height <= 0) {
      throw new Error('SITE_E2E_SCROLL_PAGE_HEIGHT_REQUIRED');
    }
    return Math.max(120, Math.min(1800, Math.round(height * action.scrollPageRatio)));
  }
  return Math.max(120,
    Math.min(1800, Math.abs(Number(action.deltaY ?? action.maximumDeltaY) || 700)));
}

async function performTrustedWheel(harness, page, action) {
  const point = await readTrustedInputPoint(harness, page, action);
  if (!point) {
    const scrollContext = action.collectScrollEvidence === true
      ? await readTrustedWheelScrollContext(harness, page, null, action, 'single')
      : null;
    return {
      status: 'unavailable',
      reason: 'trusted_wheel_target_unavailable',
      ...(scrollContext
        ? { scrollEvidence: buildTrustedWheelScrollEvidence(scrollContext, null) }
        : {}),
    };
  }
  const collectScrollEvidence = action.collectScrollEvidence === true
    || Object.hasOwn(action, 'scrollPageRatio');
  const beforeScrollContext = collectScrollEvidence
    ? await readTrustedWheelScrollContext(harness, page, point, action, 'before')
    : null;
  const magnitude = resolveTrustedWheelMagnitude(action, beforeScrollContext);
  const deltaY = action.direction === 'backward' ? -magnitude : magnitude;
  await harness.cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: point.x,
    y: point.y,
    deltaX: 0,
    deltaY,
  }, page.sessionId);
  await sleep(Math.max(50, Math.min(2_000, Number(action.minimumDwellMs) || 350)));
  const afterScrollContext = collectScrollEvidence
    ? await readTrustedWheelScrollContext(harness, page, point, action, 'after')
    : null;
  return {
    status: 'performed',
    trustedInput: true,
    inputKind: 'wheel',
    deltaY,
    ...(collectScrollEvidence
      ? { scrollEvidence: buildTrustedWheelScrollEvidence(beforeScrollContext, afterScrollContext) }
      : {}),
  };
}

const TRUSTED_SCROLL_KEYS = Object.freeze({
  ArrowUp: Object.freeze({ code: 'ArrowUp', keyCode: 38 }),
  ArrowDown: Object.freeze({ code: 'ArrowDown', keyCode: 40 }),
  PageUp: Object.freeze({ code: 'PageUp', keyCode: 33 }),
  PageDown: Object.freeze({ code: 'PageDown', keyCode: 34 }),
  End: Object.freeze({ code: 'End', keyCode: 35 }),
  ' ': Object.freeze({ code: 'Space', keyCode: 32 }),
});

async function performTrustedKeyScroll(harness, page, action) {
  const key = typeof action.key === 'string' ? action.key : 'PageDown';
  const descriptor = TRUSTED_SCROLL_KEYS[key];
  if (!descriptor) throw new Error(`SITE_E2E_TRUSTED_SCROLL_KEY_INVALID:${key}`);
  await harness.cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key,
    code: descriptor.code,
    windowsVirtualKeyCode: descriptor.keyCode,
    nativeVirtualKeyCode: descriptor.keyCode,
  }, page.sessionId);
  await harness.cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code: descriptor.code,
    windowsVirtualKeyCode: descriptor.keyCode,
    nativeVirtualKeyCode: descriptor.keyCode,
  }, page.sessionId);
  await sleep(Math.max(50, Math.min(2_000, Number(action.minimumDwellMs) || 350)));
  return { status: 'performed', trustedInput: true, inputKind: 'keydown' };
}

async function performTrustedTouchSwipe(harness, page, action) {
  const point = await readTrustedInputPoint(harness, page, action);
  if (!point) return { status: 'unavailable', reason: 'trusted_touch_target_unavailable' };
  const travelY = Math.max(
    80,
    Math.min(point.viewportHeight * 0.75, Number(action.travelY) || point.viewportHeight * 0.5),
  );
  const backward = action.direction === 'backward';
  const startY = backward
    ? Math.max(2, point.y - (travelY / 2))
    : Math.min(point.viewportHeight - 2, point.y + (travelY / 2));
  const endY = backward
    ? Math.min(point.viewportHeight - 2, startY + travelY)
    : Math.max(2, startY - travelY);
  const touchPoint = (y) => [{ x: point.x, y, radiusX: 1, radiusY: 1, force: 1, id: 1 }];
  await harness.cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 1,
  }, page.sessionId);
  try {
    await harness.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: touchPoint(startY),
    }, page.sessionId);
    for (let index = 1; index <= 4; index += 1) {
      const y = startY + ((endY - startY) * (index / 4));
      await harness.cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: touchPoint(y),
      }, page.sessionId);
      await sleep(20);
    }
    await harness.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    }, page.sessionId);
  } finally {
    await harness.cdp.send('Emulation.setTouchEmulationEnabled', {
      enabled: false,
      maxTouchPoints: 1,
    }, page.sessionId);
  }
  await sleep(Math.max(50, Math.min(2_000, Number(action.minimumDwellMs) || 350)));
  return { status: 'performed', trustedInput: true, inputKind: 'touch' };
}

async function readPageMonotonicNow(harness, page) {
  const value = await evaluate(
    harness.cdp,
    page.sessionId,
    'performance.now()',
    { awaitPromise: false, timeoutMs: 2_000 },
  );
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('SITE_E2E_ACTION_MONOTONIC_CLOCK_INVALID');
  }
  return numeric;
}

async function readActionRendererMetricSnapshot(harness, page) {
  await harness.cdp.send('Performance.enable', {}, page.sessionId);
  const response = await harness.cdp.send('Performance.getMetrics', {}, page.sessionId);
  if (!Array.isArray(response?.metrics) || response.metrics.length === 0) {
    throw new Error('SITE_E2E_ACTION_RENDERER_METRICS_REQUIRED');
  }
  return createActionRendererMetricSnapshot(response.metrics);
}

async function performRuntimeMeasuredAction(
  harness,
  page,
  perform,
  { collectContention = false, projectCausalWindow = null } = {},
) {
  const before = await readActionRendererMetricSnapshot(harness, page);
  const startedAt = await readPageMonotonicNow(harness, page);
  const value = await perform();
  const endedAt = await readPageMonotonicNow(harness, page);
  const after = await readActionRendererMetricSnapshot(harness, page);
  const renderer = diffActionRendererMetricSnapshots(before, after);
  let contentionWindow = null;
  if (collectContention) {
    const projectionResponse = await sendRuntimeDebuggerAutomationAction(
      harness,
      page,
      RUNTIME_DEBUGGER_AUTOMATION_ACTIONS.PROJECT_CONTENTION_WINDOW,
      { startedAt, endedAt },
    );
    contentionWindow = projectionResponse?.result;
    if (!contentionWindow || typeof contentionWindow !== 'object') {
      throw new Error('SITE_E2E_ACTION_CONTENTION_WINDOW_REQUIRED');
    }
  }
  const causalWindow = typeof projectCausalWindow === 'function'
    ? projectCausalWindow({ startedAt, endedAt })
    : null;
  if (typeof projectCausalWindow === 'function' && (!causalWindow || typeof causalWindow !== 'object')) {
    throw new Error('SITE_E2E_ACTION_CAUSAL_WINDOW_REQUIRED');
  }
  const window = contentionWindow?.window || {
    startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - startedAt),
  };
  return {
    value,
    runtimeCost: {
      schemaVersion: 3,
      state: renderer.state === 'measured'
        && (!collectContention || contentionWindow?.state === 'measured')
        && (!projectCausalWindow || causalWindow?.state === 'measured')
        ? 'measured'
        : 'unavailable',
      measurementMode: collectContention
        ? 'renderer_contention_and_page_causal'
        : projectCausalWindow
          ? 'renderer_and_page_causal'
          : 'renderer_only',
      clock: 'document_performance_now',
      window,
      renderer,
      contentionWindow,
      causalWindow,
      attribution: createActionRuntimeAttribution({ renderer, contentionWindow }),
      harnessOverhead: {
        includedInRendererCounters: true,
        semantics: collectContention
          ? 'two_performance_now_markers_only;contention_projection_excluded'
          : 'two_performance_now_markers_only',
        extraDomReads: 0,
      },
    },
  };
}

async function dispatchTrustedFeedInput(harness, page, action) {
  if (action.kind === 'trusted_wheel') {
    return performTrustedWheel(harness, page, action);
  }
  if (action.kind === 'trusted_key_scroll') {
    return performTrustedKeyScroll(harness, page, action);
  }
  if (action.kind === 'trusted_touch_swipe') {
    return performTrustedTouchSwipe(harness, page, action);
  }
  throw new Error(`SITE_E2E_FEED_ACTION_UNSUPPORTED:${action.kind}`);
}

async function performFeedConsumptionAction(
  harness,
  page,
  scenario,
  action,
  {
    collectFeedOracle = false,
    collectRuntimeCost = false,
    collectRuntimeContention = false,
    projectCausalWindow = null,
  } = {},
) {
  if (collectRuntimeCost && action.collectScrollEvidence === true) {
    throw new Error('SITE_E2E_SCROLL_EVIDENCE_RUNTIME_COST_INCOMPATIBLE');
  }
  if (!collectFeedOracle) {
    const measured = collectRuntimeCost
      ? await performRuntimeMeasuredAction(
        harness,
        page,
        () => dispatchTrustedFeedInput(harness, page, action),
        { collectContention: collectRuntimeContention, projectCausalWindow },
      )
      : { value: await dispatchTrustedFeedInput(harness, page, action), runtimeCost: null };
    return {
      kind: action.kind,
      stepId: action.feedStepId,
      direction: action.direction || null,
      ...measured.value,
      ...(measured.runtimeCost ? { runtimeCost: measured.runtimeCost } : {}),
    };
  }
  const feedConsumption = scenario?.feedConsumption;
  const oracleReadiness = await waitForFeedConsumptionOracleReadiness(
    harness,
    page,
    feedConsumption,
  );
  const before = oracleReadiness.sample;
  const beforeProbeMs = oracleReadiness.probeMs;
  if (oracleReadiness.state !== 'ready') {
    const finishedAt = Date.now();
    return {
      kind: action.kind,
      stepId: action.feedStepId,
      direction: action.direction || null,
      status: 'unavailable',
      reason: 'feed_oracle_not_ready',
      trustedInput: false,
      oracleReadiness: {
        state: oracleReadiness.state,
        sampleCount: oracleReadiness.sampleCount,
        stableSampleCount: oracleReadiness.stableSampleCount,
        waitedMs: oracleReadiness.waitedMs,
      },
      oracleProbe: {
        sampleCount: oracleReadiness.sampleCount,
        totalMs: beforeProbeMs,
        beforeMs: beforeProbeMs,
        afterMs: 0,
      },
      opportunity: {
        ...classifyFeedConsumptionOpportunity({
          stepId: action.feedStepId,
          surfaceMode: feedConsumption.surfaceMode,
          minimumProgressRatio: feedConsumption.oracle.minimumProgressRatio,
          before,
          after: null,
          startedAt: finishedAt,
          finishedAt,
        }),
        state: 'insufficient',
        reason: 'feed_oracle_not_ready',
      },
    };
  }
  const startedAt = Date.now();
  const measured = collectRuntimeCost
    ? await performRuntimeMeasuredAction(
      harness,
      page,
      () => dispatchTrustedFeedInput(harness, page, action),
      { collectContention: collectRuntimeContention, projectCausalWindow },
    )
    : { value: await dispatchTrustedFeedInput(harness, page, action), runtimeCost: null };
  const actionResult = measured.value;
  const oracleSettlement = await waitForFeedConsumptionOracleReadiness(
    harness,
    page,
    feedConsumption,
  );
  const after = oracleSettlement.sample;
  const afterProbeMs = oracleSettlement.probeMs;
  const finishedAt = Date.now();
  const classifiedOpportunity = classifyFeedConsumptionOpportunity({
    stepId: action.feedStepId,
    surfaceMode: feedConsumption.surfaceMode,
    minimumProgressRatio: feedConsumption.oracle.minimumProgressRatio,
    before,
    after,
    startedAt,
    finishedAt,
  });
  return {
    kind: action.kind,
    stepId: action.feedStepId,
    direction: action.direction || null,
    ...actionResult,
    ...(measured.runtimeCost ? { runtimeCost: measured.runtimeCost } : {}),
    oracleReadiness: {
      state: oracleReadiness.state,
      sampleCount: oracleReadiness.sampleCount,
      stableSampleCount: oracleReadiness.stableSampleCount,
      waitedMs: oracleReadiness.waitedMs,
    },
    oracleSettlement: {
      state: oracleSettlement.state,
      sampleCount: oracleSettlement.sampleCount,
      stableSampleCount: oracleSettlement.stableSampleCount,
      waitedMs: oracleSettlement.waitedMs,
    },
    oracleProbe: {
      sampleCount: oracleReadiness.sampleCount + oracleSettlement.sampleCount,
      totalMs: beforeProbeMs + afterProbeMs,
      beforeMs: beforeProbeMs,
      afterMs: afterProbeMs,
    },
    opportunity: actionResult.status === 'performed' && oracleSettlement.state === 'ready'
      ? classifiedOpportunity
      : {
        ...classifiedOpportunity,
        state: 'insufficient',
        reason: actionResult.status !== 'performed'
          ? 'trusted_input_not_performed'
          : 'feed_oracle_not_settled',
      },
  };
}

async function dispatchTrustedPrimaryClick(harness, page, geometry) {
  await harness.cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: geometry.x,
    y: geometry.y,
    button: 'left',
    clickCount: 1,
  }, page.sessionId);
  await harness.cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: geometry.x,
    y: geometry.y,
    button: 'left',
    clickCount: 1,
  }, page.sessionId);
}

function normalizePausedState(value) {
  return typeof value === 'boolean' ? value : null;
}

export async function restoreMediaPlaybackState(harness, page, {
  pausedBefore,
  pausedAfterSeek,
} = {}) {
  const normalizedPausedBefore = normalizePausedState(pausedBefore);
  const normalizedPausedAfterSeek = normalizePausedState(pausedAfterSeek);
  const requestedState = normalizedPausedBefore === null
    ? null
    : normalizedPausedBefore ? 'paused' : 'playing';
  if (normalizedPausedBefore === null || normalizedPausedAfterSeek === null) {
    return {
      status: 'unavailable',
      reason: 'playback_state_unavailable',
      required: null,
      attempted: false,
      action: null,
      requestedState,
      pausedBefore: normalizedPausedBefore,
      pausedAfterSeek: normalizedPausedAfterSeek,
      pausedAfterRestore: normalizedPausedAfterSeek,
      errorName: null,
    };
  }
  if (normalizedPausedBefore === normalizedPausedAfterSeek) {
    return {
      status: 'not_required',
      reason: 'playback_state_unchanged',
      required: false,
      attempted: false,
      action: null,
      requestedState,
      pausedBefore: normalizedPausedBefore,
      pausedAfterSeek: normalizedPausedAfterSeek,
      pausedAfterRestore: normalizedPausedAfterSeek,
      errorName: null,
    };
  }

  const restorationAction = normalizedPausedBefore ? 'pause' : 'play';
  const result = await evaluate(harness.cdp, page.sessionId, `((input) => {
    const video = document.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) {
      return { status: 'unavailable', pausedAfterRestore: null, errorName: null };
    }
    const snapshot = () => ({
      status: video.paused === input.pausedBefore ? 'restored' : 'failed',
      pausedAfterRestore: video.paused,
      errorName: null,
    });
    const failed = (error) => {
      const candidate = String(error && error.name || 'Error');
      return {
        status: 'failed',
        pausedAfterRestore: video.paused,
        errorName: /^[A-Za-z][A-Za-z0-9]*Error$/.test(candidate) ? candidate : 'Error',
      };
    };
    if (input.action === 'pause') {
      try {
        video.pause();
        return snapshot();
      } catch (error) {
        return failed(error);
      }
    }
    try {
      return Promise.resolve(video.play()).then(snapshot, failed);
    } catch (error) {
      return failed(error);
    }
  })(${JSON.stringify({
    action: restorationAction,
    pausedBefore: normalizedPausedBefore,
  })})`, { timeoutMs: 8_000 }).catch(() => ({
    status: 'failed',
    pausedAfterRestore: normalizedPausedAfterSeek,
    errorName: 'EvaluationError',
  }));
  const status = result?.status === 'restored'
    ? 'restored'
    : result?.status === 'unavailable' ? 'unavailable' : 'failed';
  const errorName = typeof result?.errorName === 'string'
    && /^[A-Za-z][A-Za-z0-9]*Error$/u.test(result.errorName)
    ? result.errorName
    : null;
  return {
    status,
    reason: status === 'restored'
      ? 'playback_state_restored'
      : status === 'unavailable'
        ? 'playback_media_unavailable'
        : 'playback_state_restoration_failed',
    required: true,
    attempted: true,
    action: restorationAction,
    requestedState,
    pausedBefore: normalizedPausedBefore,
    pausedAfterSeek: normalizedPausedAfterSeek,
    pausedAfterRestore: normalizePausedState(result?.pausedAfterRestore),
    errorName,
  };
}

export async function performTrustedMediaPlayAction(harness, page, action) {
  if (typeof action.targetSelector !== 'string' || !action.targetSelector) {
    return { status: 'unavailable', reason: 'trusted_play_target_missing' };
  }
  const geometry = await evaluate(harness.cdp, page.sessionId, `((input) => {
    const video = document.querySelector('video');
    const target = document.querySelector(input.targetSelector);
    if (!(video instanceof HTMLVideoElement) || !(target instanceof HTMLElement)) return null;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: rect.left + (rect.width / 2),
      y: rect.top + (rect.height / 2),
      paused: video.paused,
      currentTime: video.currentTime,
    };
  })(${JSON.stringify(action)})`);
  if (!geometry) {
    return { status: 'unavailable', reason: 'trusted_play_target_unavailable' };
  }
  if (geometry.paused === false) {
    return {
      status: 'performed',
      reason: 'media_already_playing',
      trustedGesture: false,
      clickRequired: false,
      pausedBefore: false,
      pausedAfter: false,
      currentTime: finiteNumberOrNull(geometry.currentTime),
    };
  }

  await dispatchTrustedPrimaryClick(harness, page, geometry);
  const observationWindowMs = Math.max(
    250,
    Math.min(3_000, Number(action.observationWindowMs) || 1_500),
  );
  const observationStartedAt = Date.now();
  let observationCount = 0;
  let latest = null;
  while (Date.now() - observationStartedAt < observationWindowMs) {
    await sleep(50);
    latest = await evaluate(harness.cdp, page.sessionId, `(() => {
      const video = document.querySelector('video');
      if (!(video instanceof HTMLVideoElement)) return null;
      return { paused: video.paused, currentTime: video.currentTime };
    })()`).catch(() => null);
    observationCount += 1;
    if (latest?.paused === false) {
      const dwellMs = Math.max(
        0,
        Math.min(5_000, Number(action.maximumDurationMs) || 0),
      );
      if (dwellMs > 0) {
        await sleep(dwellMs);
        latest = await evaluate(harness.cdp, page.sessionId, `(() => {
          const video = document.querySelector('video');
          if (!(video instanceof HTMLVideoElement)) return null;
          return { paused: video.paused, currentTime: video.currentTime };
        })()`).catch(() => latest);
      }
      return {
        status: 'performed',
        reason: 'trusted_play_observed',
        trustedGesture: true,
        clickRequired: true,
        pausedBefore: true,
        pausedAfter: normalizePausedState(latest?.paused),
        currentTime: finiteNumberOrNull(latest.currentTime),
        observationCount,
        observationWindowMs,
        dwellMs,
      };
    }
  }
  return {
    status: 'unavailable',
    reason: latest === null
      ? 'trusted_play_media_unavailable_after_click'
      : 'trusted_play_not_observed',
    trustedGesture: true,
    clickRequired: true,
    pausedBefore: true,
    pausedAfter: normalizePausedState(latest?.paused),
    currentTime: finiteNumberOrNull(latest?.currentTime),
    observationCount,
    observationWindowMs,
  };
}

export async function performMediaAction(harness, page, action) {
  if (action.kind === 'play' && action.requiresTrustedGesture === true) {
    return performTrustedMediaPlayAction(harness, page, action);
  }
  if (action.kind === 'seek' && action.requiresTrustedGesture === true) {
    if (typeof action.targetSelector !== 'string' || !action.targetSelector) {
      return { status: 'unavailable', reason: 'trusted_seek_target_missing' };
    }
    const geometry = await evaluate(harness.cdp, page.sessionId, `((input) => {
      const video = document.querySelector('video');
      const target = document.querySelector(input.targetSelector);
      if (!(video instanceof HTMLVideoElement) || !(target instanceof HTMLElement)) return null;
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      const before = video.currentTime;
      const seconds = Math.max(0.5, Math.min(10, Number(input.maximumSeconds) || 5));
      const ratio = duration === null ? 0.5 : Math.max(0.02, Math.min(0.98, (before + seconds) / duration));
      return {
        x: rect.left + (rect.width * ratio),
        y: rect.top + (rect.height / 2),
        before,
        paused: video.paused,
        duration,
      };
    })(${JSON.stringify(action)})`);
    if (!geometry) return { status: 'unavailable', reason: 'trusted_seek_target_unavailable' };
    await dispatchTrustedPrimaryClick(harness, page, geometry);
    const observationWindowMs = Math.max(
      250,
      Math.min(3_000, Number(action.revertObservationWindowMs) || 800),
    );
    const observationStartedAt = Date.now();
    let observationCount = 0;
    let latest = null;
    let closestAfter = null;
    let minimumDriftSeconds = null;
    while (Date.now() - observationStartedAt < observationWindowMs) {
      await sleep(50);
      latest = await evaluate(harness.cdp, page.sessionId, `(() => {
        const video = document.querySelector('video');
        if (!(video instanceof HTMLVideoElement)) return null;
        return { currentTime: video.currentTime, paused: video.paused };
      })()`);
      const currentTime = Number(latest?.currentTime);
      if (!Number.isFinite(currentTime)) continue;
      observationCount += 1;
      const drift = Math.abs(currentTime - geometry.before);
      if (minimumDriftSeconds === null || drift < minimumDriftSeconds) {
        minimumDriftSeconds = drift;
        closestAfter = currentTime;
      }
    }
    const pausedAfterSeek = typeof latest?.paused === 'boolean' ? latest.paused : null;
    const playbackStateRestoration = await restoreMediaPlaybackState(harness, page, {
      pausedBefore: geometry.paused,
      pausedAfterSeek,
    });
    return {
      status: 'performed',
      before: geometry.before,
      after: Number.isFinite(Number(latest?.currentTime)) ? Number(latest.currentTime) : null,
      closestAfter,
      minimumDriftSeconds,
      observationCount,
      observationWindowMs,
      pausedBefore: geometry.paused,
      pausedAfterSeek,
      pausedAfter: playbackStateRestoration.pausedAfterRestore,
      playbackStateRestoration,
      trustedGesture: true,
    };
  }
  return evaluate(harness.cdp, page.sessionId, `((input) => {
    const video = document.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) return { status: 'unavailable' };
    if (input.kind === 'play') {
      return Promise.resolve(video.play()).then(
        () => ({ status: 'performed', currentTime: video.currentTime }),
        (error) => ({ status: 'unavailable', error: String(error && error.name || error) }),
      );
    }
    if (input.kind === 'pause') {
      video.pause();
      return { status: 'performed', currentTime: video.currentTime };
    }
    const duration = Number.isFinite(video.duration) ? video.duration : null;
    const requestedSeconds = Number(input.deltaSeconds ?? input.maximumSeconds) || 5;
    const direction = input.direction === 'backward' ? -1 : 1;
    const deltaSeconds = Math.max(-10, Math.min(10, requestedSeconds * direction));
    const target = duration === null
      ? Math.max(0, video.currentTime + deltaSeconds)
      : Math.max(0, Math.min(Math.max(0, duration - 0.25), video.currentTime + deltaSeconds));
    const before = video.currentTime;
    video.currentTime = target;
    return { status: 'performed', before, requested: target, after: video.currentTime };
  })(${JSON.stringify(action)})`, { timeoutMs: 8_000 });
}

async function performSafeClick(harness, page, action, scenario) {
  const allowedSelectors = new Set(scenario?.allowedActions?.safeClickSelectors || []);
  if (!allowedSelectors.has(action.selector)) {
    throw new Error(`SITE_E2E_CLICK_SELECTOR_NOT_ALLOWLISTED:${action.selector}`);
  }
  return evaluate(harness.cdp, page.sessionId, `((selector) => {
    const target = document.querySelector(selector);
    if (!(target instanceof HTMLElement)) return { status: 'unavailable' };
    if (target.closest('form') || target.matches('[type="submit"], [download]')) {
      return { status: 'forbidden_target' };
    }
    target.click();
    return { status: 'performed' };
  })(${JSON.stringify(action.selector)})`);
}

export async function runScenarioActions(
  harness,
  page,
  scenario,
  actions = scenario.actions || [],
  {
    collectFeedOracle = false,
    collectRuntimeCost = false,
    collectRuntimeContention = false,
    projectCausalWindow = null,
  } = {},
) {
  const results = [];
  for (const action of actions) {
    if (action.kind === 'scroll') {
      await performScroll(harness, page, action);
      results.push({ kind: action.kind, status: 'performed' });
    } else if (action.kind === 'prepare_scroll_contention_fixture') {
      results.push({
        kind: action.kind,
        ...(action.requiredForEvaluation === true ? { requiredForEvaluation: true } : {}),
        ...(await prepareScrollContentionFixture(harness, page, action)),
      });
    } else if (action.kind === 'trusted_scroll_probe') {
      const measured = collectRuntimeCost
        ? await performRuntimeMeasuredAction(
          harness,
          page,
          () => performTrustedScrollProbe(harness, page, action),
          { collectContention: collectRuntimeContention, projectCausalWindow },
        )
        : { value: await performTrustedScrollProbe(harness, page, action), runtimeCost: null };
      results.push({
        kind: action.kind,
        ...(action.requiredForEvaluation === true ? { requiredForEvaluation: true } : {}),
        ...measured.value,
        ...(measured.runtimeCost ? { runtimeCost: measured.runtimeCost } : {}),
      });
    } else if (action.kind === 'trusted_content_load_probe') {
      const measured = collectRuntimeCost
        ? await performRuntimeMeasuredAction(
          harness,
          page,
          () => performTrustedContentLoadProbe(harness, page, action),
          { collectContention: collectRuntimeContention, projectCausalWindow },
        )
        : { value: await performTrustedContentLoadProbe(harness, page, action), runtimeCost: null };
      results.push({
        kind: action.kind,
        ...(action.requiredForEvaluation === true ? { requiredForEvaluation: true } : {}),
        ...measured.value,
        ...(measured.runtimeCost ? { runtimeCost: measured.runtimeCost } : {}),
      });
    } else if (action.kind === 'visual_media_membership_probe') {
      const membership = await performVisualMediaMembershipProbe(harness, page);
      results.push({
        kind: action.kind,
        requiredForEvaluation: true,
        ...membership,
        ...(collectRuntimeCost ? { removalCostRequired: true,
          removalCost: await performVisualRemovalCostProbe(harness, page, work => performRuntimeMeasuredAction(
            harness, page, work, { collectContention: collectRuntimeContention, projectCausalWindow },
          )),
        } : {}),
      });
    } else if (action.kind === 'root_visual_continuity_probe') {
      results.push({
        kind: action.kind,
        ...(action.requiredForEvaluation === true ? { requiredForEvaluation: true } : {}),
        ...(await performRootVisualContinuityProbe(harness, page, action)),
      });
    } else if (
      action.kind === 'trusted_wheel'
      || action.kind === 'trusted_key_scroll'
      || action.kind === 'trusted_touch_swipe'
    ) {
      results.push(await performFeedConsumptionAction(
        harness,
        page,
        scenario,
        action,
        {
          collectFeedOracle,
          collectRuntimeCost,
          collectRuntimeContention,
          projectCausalWindow,
        },
      ));
    } else if (action.kind === 'reload') {
      await harness.reloadPage(page, { ignoreCache: action.ignoreCache === true });
      results.push({ kind: action.kind, status: 'performed' });
    } else if (action.kind === 'navigate') {
      let actionUrl = action.url;
      if (!actionUrl && action.urlId === 'primary') actionUrl = getScenarioPrimaryUrl(scenario);
      if (!actionUrl && String(action.urlId || '').startsWith('additional:')) {
        const index = Number(String(action.urlId).slice('additional:'.length));
        actionUrl = scenario?.urls?.additional?.[index];
      }
      const allowlistedUrls = [
        getScenarioPrimaryUrl(scenario),
        ...(scenario?.urls?.additional || []),
        ...(scenario.allowedActions?.navigationUrls || []),
      ];
      if (!actionUrl || !allowlistedUrls.includes(actionUrl)) {
        throw new Error(`SITE_E2E_NAVIGATION_NOT_ALLOWLISTED:${actionUrl || action.urlId}`);
      }
      await harness.navigatePage(page, actionUrl);
      if (action.expectedRedirectPath) await sleep(500);
      const observedPath = await evaluate(
        harness.cdp,
        page.sessionId,
        'location.pathname',
        { awaitPromise: false, timeoutMs: 2_000 },
      ).catch(() => null);
      results.push({
        kind: action.kind,
        status: 'performed',
        urlId: action.urlId || null,
        expectedRedirectPath: action.expectedRedirectPath || null,
        observedPath,
      });
    } else if (action.kind === 'play' || action.kind === 'pause' || action.kind === 'seek') {
      results.push({
        kind: action.kind,
        ...(action.requiredForEvaluation === true ? { requiredForEvaluation: true } : {}),
        ...(await performMediaAction(harness, page, action)),
      });
    } else if (action.kind === 'click') {
      results.push({ kind: action.kind, ...(await performSafeClick(harness, page, action, scenario)) });
    } else if (action.kind === 'wait') {
      await sleep(Math.max(0, Math.min(10_000, Number(action.ms) || 0)));
      results.push({ kind: action.kind, status: 'performed' });
    } else if (
      action.kind === 'settings_patch'
      || action.kind === 'disable'
      || action.kind === 'reenable'
      || action.kind === 'takeover_checkpoint'
    ) {
      results.push({ kind: action.kind, status: 'owned_by_runner' });
    } else {
      throw new Error(`SITE_E2E_ACTION_UNSUPPORTED:${action.kind}`);
    }
  }
  return results;
}

function classifyTargets(targets, extensionId, siteOrigin = null) {
  const sanitized = targets.map((target) => ({
    targetId: target.targetId,
    type: target.type,
    url: sanitizeSiteHarnessUrl(String(target.url || '')),
  }));
  const extensionPrefix = `chrome-extension://${extensionId}/`;
  const extensionTargets = sanitized.filter((target) => String(target.url || '').startsWith(extensionPrefix));
  const siteTargets = siteOrigin
    ? sanitized.filter((target) => String(target.url || '').startsWith(siteOrigin))
    : [];
  return {
    extensionTargets,
    extensionDedicatedWorkers: extensionTargets.filter((target) => (
      target.type === 'worker' || target.type === 'shared_worker'
    )),
    extensionServiceWorkers: extensionTargets.filter((target) => target.type === 'service_worker'),
    siteWorkers: siteTargets.filter((target) => (
      target.type === 'worker' || target.type === 'shared_worker' || target.type === 'service_worker'
    )),
  };
}

export async function collectTargetSnapshot(harness, scenario) {
  const siteOrigin = new URL(getScenarioPrimaryUrl(scenario)).origin;
  const targets = await getTargetInfos(harness.cdp);
  return classifyTargets(targets, harness.extensionId, siteOrigin);
}

async function queryPrototypeInstanceCount(harness, page, constructorName) {
  const objectGroup = `entropy-site-e2e-cardinality-${constructorName}`;
  try {
    const prototype = await harness.cdp.send('Runtime.evaluate', {
      expression: `globalThis[${JSON.stringify(constructorName)}]?.prototype`,
      objectGroup,
      returnByValue: false,
      silent: true,
    }, page.sessionId);
    const prototypeObjectId = prototype?.result?.objectId;
    if (!prototypeObjectId) return null;
    const objects = await harness.cdp.send('Runtime.queryObjects', {
      prototypeObjectId,
      objectGroup,
    }, page.sessionId);
    if (!objects?.objects?.objectId) return null;
    const length = await harness.cdp.send('Runtime.callFunctionOn', {
      objectId: objects.objects.objectId,
      functionDeclaration: 'function () { return this.length; }',
      returnByValue: true,
      silent: true,
    }, page.sessionId);
    return finiteNumberOrNull(length?.result?.value);
  } catch (_error) {
    return null;
  } finally {
    await harness.cdp.send('Runtime.releaseObjectGroup', { objectGroup }, page.sessionId)
      .catch(() => {});
  }
}

async function collectPageObjectCardinality(harness, page) {
  const constructors = [
    ['mutationObservers', 'MutationObserver'],
    ['intersectionObservers', 'IntersectionObserver'],
    ['resizeObservers', 'ResizeObserver'],
    ['workers', 'Worker'],
  ];
  const values = await Promise.all(constructors.map(([, constructorName]) => (
    queryPrototypeInstanceCount(harness, page, constructorName)
  )));
  return Object.fromEntries(constructors.map(([key], index) => [key, values[index]]));
}

export async function collectPageMetrics(harness, page, {
  label,
  longTasks = [],
  longTaskMeasurement = null,
  scenario,
} = {}) {
  await harness.cdp.send('HeapProfiler.enable', {}, page.sessionId).catch(() => {});
  await harness.cdp.send('Performance.enable', {}, page.sessionId).catch(() => {});
  await harness.cdp.send('HeapProfiler.collectGarbage', {}, page.sessionId).catch(() => {});
  await sleep(80);
  const [performance, domCounters, targets, objectCardinality] = await Promise.all([
    harness.cdp.send('Performance.getMetrics', {}, page.sessionId).catch(() => ({ metrics: [] })),
    harness.cdp.send('Memory.getDOMCounters', {}, page.sessionId).catch(() => ({})),
    collectTargetSnapshot(harness, scenario),
    collectPageObjectCardinality(harness, page),
  ]);
  return createCdpMetricSnapshot({
    label,
    performanceMetrics: performance.metrics || [],
    domCounters,
    longTasks,
    longTaskMeasurement,
    targets,
    objectCardinality,
  });
}

function roundCausalMetric(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function createCausalPhaseSummary({
  id,
  startedAt,
  endedAt,
  resourceLoads,
  domMutationBursts,
  longTasks,
  longAnimationFrames,
}) {
  const startsWithinPhase = (entry) => {
    const value = Number(entry?.startTime ?? entry?.callbackAtMs);
    return Number.isFinite(value) && value >= startedAt && value < endedAt;
  };
  const resources = resourceLoads.filter(startsWithinPhase);
  const mutations = domMutationBursts.filter(startsWithinPhase);
  const tasks = longTasks.filter(startsWithinPhase);
  const frames = longAnimationFrames.filter(startsWithinPhase);
  const resourcesByInitiator = Object.create(null);
  for (const entry of resources) {
    const initiatorType = typeof entry.initiatorType === 'string' && entry.initiatorType
      ? entry.initiatorType
      : 'unknown';
    const current = resourcesByInitiator[initiatorType] || {
      count: 0,
      transferSizeBytes: 0,
      decodedBodySizeBytes: 0,
    };
    current.count += 1;
    current.transferSizeBytes += Number(entry.transferSize) || 0;
    current.decodedBodySizeBytes += Number(entry.decodedBodySize) || 0;
    resourcesByInitiator[initiatorType] = current;
  }
  const scriptBuckets = Object.create(null);
  for (const frame of frames) {
    for (const [source, counters] of Object.entries(frame.scriptBuckets || {})) {
      const current = scriptBuckets[source] || {
        scriptCount: 0,
        durationMs: 0,
        forcedStyleAndLayoutDurationMs: 0,
      };
      current.scriptCount += Number(counters?.scriptCount) || 0;
      current.durationMs += Number(counters?.durationMs) || 0;
      current.forcedStyleAndLayoutDurationMs += (
        Number(counters?.forcedStyleAndLayoutDurationMs) || 0
      );
      scriptBuckets[source] = current;
    }
  }
  return {
    id,
    startedAt: roundCausalMetric(startedAt),
    endedAt: roundCausalMetric(endedAt),
    durationMs: roundCausalMetric(endedAt - startedAt),
    resources: {
      count: resources.length,
      transferSizeBytes: resources.reduce(
        (total, entry) => total + (Number(entry.transferSize) || 0),
        0,
      ),
      decodedBodySizeBytes: resources.reduce(
        (total, entry) => total + (Number(entry.decodedBodySize) || 0),
        0,
      ),
      byInitiator: Object.fromEntries(Object.entries(resourcesByInitiator).map(
        ([initiatorType, counters]) => [initiatorType, {
          ...counters,
          transferSizeBytes: roundCausalMetric(counters.transferSizeBytes),
          decodedBodySizeBytes: roundCausalMetric(counters.decodedBodySizeBytes),
        }],
      )),
    },
    domMutations: {
      callbackCount: mutations.length,
      recordCount: mutations.reduce(
        (total, entry) => total + (Number(entry.recordCount) || 0),
        0,
      ),
      addedNodeCount: mutations.reduce(
        (total, entry) => total + (Number(entry.addedNodeCount) || 0),
        0,
      ),
      removedNodeCount: mutations.reduce(
        (total, entry) => total + (Number(entry.removedNodeCount) || 0),
        0,
      ),
      attributeCount: mutations.reduce(
        (total, entry) => total + (Number(entry.attributeCount) || 0),
        0,
      ),
      characterDataCount: mutations.reduce(
        (total, entry) => total + (Number(entry.characterDataCount) || 0),
        0,
      ),
      observerCallbackDurationMs: roundCausalMetric(mutations.reduce(
        (total, entry) => total + (Number(entry.callbackDurationMs) || 0),
        0,
      )),
    },
    longTasks: {
      count: tasks.length,
      durationMs: roundCausalMetric(tasks.reduce(
        (total, entry) => total + (Number(entry.duration) || 0),
        0,
      )),
      maxMs: roundCausalMetric(Math.max(
        0,
        ...tasks.map((entry) => Number(entry.duration) || 0),
      )),
    },
    longAnimationFrames: {
      count: frames.length,
      durationMs: roundCausalMetric(frames.reduce(
        (total, entry) => total + (Number(entry.duration) || 0),
        0,
      )),
      blockingDurationMs: roundCausalMetric(frames.reduce(
        (total, entry) => total + (Number(entry.blockingDuration) || 0),
        0,
      )),
      scriptBuckets: Object.fromEntries(Object.entries(scriptBuckets).map(
        ([source, counters]) => [source, {
          scriptCount: counters.scriptCount,
          durationMs: roundCausalMetric(counters.durationMs),
          forcedStyleAndLayoutDurationMs: roundCausalMetric(
            counters.forcedStyleAndLayoutDurationMs,
          ),
        }],
      )),
    },
  };
}

export function projectPageCausalWindow({
  startedAt,
  endedAt,
  resourceLoads = [],
  resourceMeasurement = null,
  domMutationBursts = [],
  domMutationMeasurement = null,
  longTasks = [],
  longTaskMeasurement = null,
  longAnimationFrames = [],
  longAnimationFrameMeasurement = null,
}) {
  if (
    !Number.isFinite(startedAt)
    || !Number.isFinite(endedAt)
    || endedAt < startedAt
  ) {
    throw new Error('SITE_E2E_CAUSAL_WINDOW_RANGE_INVALID');
  }
  const measurements = {
    resources: resourceMeasurement ? { ...resourceMeasurement } : null,
    domMutations: domMutationMeasurement ? { ...domMutationMeasurement } : null,
    longTasks: longTaskMeasurement ? { ...longTaskMeasurement } : null,
    longAnimationFrames: longAnimationFrameMeasurement
      ? { ...longAnimationFrameMeasurement }
      : null,
  };
  const requiredMeasurements = [
    measurements.resources,
    measurements.domMutations,
    measurements.longTasks,
    measurements.longAnimationFrames,
  ];
  const state = requiredMeasurements.every((measurement) => measurement?.state === 'measured')
    ? 'measured'
    : 'unavailable';
  const boundaries = [
    { id: 'input_response', startedAt, endedAt: Math.min(endedAt, startedAt + 250) },
    {
      id: 'initial_load',
      startedAt: Math.min(endedAt, startedAt + 250),
      endedAt: Math.min(endedAt, startedAt + 1_000),
    },
    { id: 'settling', startedAt: Math.min(endedAt, startedAt + 1_000), endedAt },
  ].filter((phase) => phase.endedAt > phase.startedAt);
  const windowResources = resourceLoads
    .filter((entry) => Number(entry?.startTime) >= startedAt && Number(entry?.startTime) < endedAt)
    .sort((left, right) => (Number(right.transferSize) || 0) - (Number(left.transferSize) || 0))
    .slice(0, 16)
    .map((entry) => ({ ...entry }));
  return {
    schemaVersion: 1,
    state,
    reason: state === 'measured' ? 'causal_collectors_ready' : 'causal_collector_unavailable',
    window: {
      startedAt: roundCausalMetric(startedAt),
      endedAt: roundCausalMetric(endedAt),
      durationMs: roundCausalMetric(endedAt - startedAt),
    },
    measurements,
    phases: boundaries.map((phase) => createCausalPhaseSummary({
      ...phase,
      resourceLoads,
      domMutationBursts,
      longTasks,
      longAnimationFrames,
    })),
    largestResources: windowResources,
  };
}

export async function createPageRuntimeCollector(
  harness,
  page,
  { privacyMode = 'public' } = {},
) {
  const bindingName = `__entropySiteTiming_${String(page.targetId || '').replace(/[^a-z0-9]/giu, '').slice(-12)}`;
  const longTasks = [];
  const longAnimationFrames = [];
  const resourceLoads = [];
  const domMutationBursts = [];
  const errors = [];
  const documentResponses = [];
  const longTaskMeasurement = {
    state: 'unavailable',
    reason: 'awaiting_instrumented_document',
    readyCount: 0,
    failureCount: 0,
  };
  const longAnimationFrameMeasurement = {
    state: 'unavailable',
    reason: 'awaiting_instrumented_document',
    readyCount: 0,
    failureCount: 0,
  };
  const resourceMeasurement = {
    state: 'unavailable',
    reason: 'awaiting_instrumented_document',
    readyCount: 0,
    failureCount: 0,
  };
  const domMutationMeasurement = {
    state: 'unavailable',
    reason: 'awaiting_instrumented_document',
    readyCount: 0,
    failureCount: 0,
  };
  const pushBounded = (target, entry, limit = 200) => {
    target.push(entry);
    if (target.length > limit) target.splice(0, target.length - limit);
  };
  const unsubscribe = harness.cdp.subscribe('*', (event) => {
    if (event.sessionId !== page.sessionId) return;
    if (event.method === 'Runtime.bindingCalled' && event.params?.name === bindingName) {
      try {
        const payload = JSON.parse(String(event.params?.payload || '{}'));
        const collectorId = [
          'long_task',
          'long_animation_frame',
          'resource',
          'dom_mutation',
        ].includes(payload.collector)
          ? payload.collector
          : 'long_task';
        const measurement = {
          long_task: longTaskMeasurement,
          long_animation_frame: longAnimationFrameMeasurement,
          resource: resourceMeasurement,
          dom_mutation: domMutationMeasurement,
        }[collectorId];
        if (payload.instrumentationStatus === 'ready') {
          measurement.readyCount += 1;
          if (measurement.failureCount === 0) {
            measurement.state = 'measured';
            measurement.reason = 'observer_ready';
          }
          return;
        }
        if (payload.instrumentationStatus === 'unavailable') {
          measurement.state = 'unavailable';
          measurement.reason = typeof payload.reason === 'string'
            ? payload.reason
            : `${collectorId}_api_unavailable`;
          return;
        }
        if (payload.instrumentationStatus === 'broken' || payload.instrumentationError) {
          measurement.state = 'broken';
          measurement.reason = typeof payload.reason === 'string'
            ? payload.reason
            : 'observer_install_failed';
          measurement.failureCount += 1;
          pushBounded(errors, {
            source: `${collectorId}_instrumentation`,
            kind: 'instrumentation_broken',
            message: safeError(payload.instrumentationError || measurement.reason),
          });
          return;
        }
        if (collectorId === 'resource') {
          if (!Array.isArray(payload.entries)) {
            throw new Error('RESOURCE_BINDING_PAYLOAD_INVALID');
          }
          for (const entry of payload.entries.slice(0, 128)) {
            const startTime = finiteNumberOrNull(entry?.startTime);
            const duration = finiteNumberOrNull(entry?.duration);
            if (startTime === null || duration === null || startTime < 0 || duration < 0) {
              throw new Error('RESOURCE_BINDING_ENTRY_INVALID');
            }
            pushBounded(resourceLoads, {
              url: sanitizeSiteHarnessUrl(entry?.name),
              initiatorType: typeof entry?.initiatorType === 'string'
                ? entry.initiatorType.slice(0, 40)
                : 'unknown',
              startTime: roundCausalMetric(startTime),
              duration: roundCausalMetric(duration),
              responseStart: finiteNumberOrNull(entry?.responseStart),
              responseEnd: finiteNumberOrNull(entry?.responseEnd),
              transferSize: finiteNumberOrNull(entry?.transferSize),
              encodedBodySize: finiteNumberOrNull(entry?.encodedBodySize),
              decodedBodySize: finiteNumberOrNull(entry?.decodedBodySize),
            }, 800);
          }
          return;
        }
        if (collectorId === 'dom_mutation') {
          const callbackAtMs = finiteNumberOrNull(payload.callbackAtMs);
          const callbackDurationMs = finiteNumberOrNull(payload.callbackDurationMs);
          const numericKeys = [
            'recordCount',
            'addedNodeCount',
            'removedNodeCount',
            'attributeCount',
            'characterDataCount',
          ];
          if (
            callbackAtMs === null
            || callbackDurationMs === null
            || callbackAtMs < 0
            || callbackDurationMs < 0
            || numericKeys.some((key) => (
              !Number.isFinite(Number(payload[key])) || Number(payload[key]) < 0
            ))
          ) {
            throw new Error('DOM_MUTATION_BINDING_PAYLOAD_INVALID');
          }
          pushBounded(domMutationBursts, {
            callbackAtMs: roundCausalMetric(callbackAtMs),
            callbackDurationMs: roundCausalMetric(callbackDurationMs),
            ...Object.fromEntries(numericKeys.map((key) => [key, Number(payload[key])])),
          }, 800);
          return;
        }
        const duration = finiteNumberOrNull(payload.duration);
        if (payload.entryType === 'long-animation-frame') {
          if (duration === null || duration < 0) {
            throw new Error('LONG_ANIMATION_FRAME_BINDING_PAYLOAD_INVALID');
          }
          const scriptBuckets = Object.fromEntries(
            Object.entries(payload.scriptBuckets || {})
              .filter(([bucket]) => [
                'entropy_extension',
                'page',
                'third_party',
                'unknown',
              ].includes(bucket))
              .map(([bucket, counters]) => [bucket, {
                scriptCount: finiteNumberOrNull(counters?.scriptCount),
                durationMs: finiteNumberOrNull(counters?.durationMs),
                forcedStyleAndLayoutDurationMs: finiteNumberOrNull(
                  counters?.forcedStyleAndLayoutDurationMs,
                ),
              }]),
          );
          const rawScriptTimeline = payload.scriptTimeline;
          const scriptTimelineEntries = Array.isArray(rawScriptTimeline?.entries)
            ? rawScriptTimeline.entries.slice(0, 64).flatMap((entry) => {
              const source = typeof entry?.source === 'string' ? entry.source : 'unknown';
              const startedAt = finiteNumberOrNull(entry?.startedAt);
              const endedAt = finiteNumberOrNull(entry?.endedAt);
              const durationMs = finiteNumberOrNull(entry?.durationMs);
              const forcedStyleAndLayoutDurationMs = finiteNumberOrNull(
                entry?.forcedStyleAndLayoutDurationMs,
              );
              if (
                !['entropy_extension', 'page', 'third_party', 'unknown'].includes(source)
                || startedAt === null
                || endedAt === null
                || durationMs === null
                || forcedStyleAndLayoutDurationMs === null
                || endedAt < startedAt
                || durationMs < 0
                || forcedStyleAndLayoutDurationMs < 0
              ) return [];
              return [{
                source,
                startedAt,
                endedAt,
                durationMs,
                forcedStyleAndLayoutDurationMs,
              }];
            })
            : [];
          const scriptTimelineTotalEntryCount = finiteNumberOrNull(
            rawScriptTimeline?.totalEntryCount,
          );
          const scriptTimelineInvalidEntryCount = finiteNumberOrNull(
            rawScriptTimeline?.invalidEntryCount,
          );
          const scriptTimelineDroppedEntryCount = finiteNumberOrNull(
            rawScriptTimeline?.droppedEntryCount,
          );
          const scriptTimelineComplete = rawScriptTimeline?.complete === true
            && scriptTimelineTotalEntryCount !== null
            && scriptTimelineInvalidEntryCount === 0
            && scriptTimelineDroppedEntryCount === 0
            && scriptTimelineEntries.length === scriptTimelineTotalEntryCount;
          pushBounded(longAnimationFrames, {
            duration: Math.round(duration * 100) / 100,
            blockingDuration: finiteNumberOrNull(payload.blockingDuration),
            startTime: finiteNumberOrNull(payload.startTime),
            renderStart: finiteNumberOrNull(payload.renderStart),
            styleAndLayoutStart: finiteNumberOrNull(payload.styleAndLayoutStart),
            firstUIEventTimestamp: finiteNumberOrNull(payload.firstUIEventTimestamp),
            scriptBuckets,
            scriptTimeline: {
              state: scriptTimelineComplete ? 'measured' : 'incomplete',
              reason: scriptTimelineComplete
                ? 'sanitized_script_timeline_measured'
                : 'sanitized_script_timeline_incomplete',
              totalEntryCount: scriptTimelineTotalEntryCount,
              retainedEntryCount: scriptTimelineEntries.length,
              invalidEntryCount: scriptTimelineInvalidEntryCount,
              droppedEntryCount: scriptTimelineDroppedEntryCount,
              entries: scriptTimelineEntries,
            },
          }, 400);
          return;
        }
        if (duration !== null && duration >= 0) {
          pushBounded(longTasks, {
            duration: Math.round(duration * 100) / 100,
            startTime: finiteNumberOrNull(payload.startTime) === null
              ? null
              : Math.round(finiteNumberOrNull(payload.startTime) * 100) / 100,
          }, 400);
          return;
        }
        throw new Error('LONG_TASK_BINDING_PAYLOAD_INVALID');
      } catch (_error) {
        longTaskMeasurement.state = 'broken';
        longTaskMeasurement.reason = 'binding_payload_invalid';
        longTaskMeasurement.failureCount += 1;
        longAnimationFrameMeasurement.state = 'broken';
        longAnimationFrameMeasurement.reason = 'binding_payload_invalid';
        longAnimationFrameMeasurement.failureCount += 1;
        resourceMeasurement.state = 'broken';
        resourceMeasurement.reason = 'binding_payload_invalid';
        resourceMeasurement.failureCount += 1;
        domMutationMeasurement.state = 'broken';
        domMutationMeasurement.reason = 'binding_payload_invalid';
        domMutationMeasurement.failureCount += 1;
        pushBounded(errors, { source: 'cdp_binding', kind: 'payload_invalid' });
      }
      return;
    }
    if (event.method === 'Network.responseReceived' && event.params?.type === 'Document') {
      const response = event.params.response || {};
      pushBounded(documentResponses, {
        status: finiteNumberOrNull(response.status),
        url: sanitizeSiteHarnessUrl(response.url),
      }, 40);
      return;
    }
    if (event.method === 'Runtime.exceptionThrown') {
      const details = event.params?.exceptionDetails || {};
      const rawMessage = details.exception?.description || details.text || 'uncaught_exception';
      pushBounded(errors, {
        source: 'page_runtime',
        kind: 'uncaught_exception',
        message: privacyMode === 'login' ? null : safeError(rawMessage),
        url: sanitizeSiteHarnessUrl(details.url),
        lineNumber: finiteNumberOrNull(details.lineNumber),
      });
      return;
    }
    if (event.method === 'Log.entryAdded') {
      const entry = event.params?.entry || {};
      if (entry.level !== 'error') return;
      pushBounded(errors, {
        source: entry.source || 'page_log',
        kind: 'console_error',
        message: privacyMode === 'login' ? null : safeError(entry.text || 'console_error'),
        url: sanitizeSiteHarnessUrl(entry.url),
        lineNumber: finiteNumberOrNull(entry.lineNumber),
      });
    }
  });

  await harness.cdp.send('Runtime.enable', {}, page.sessionId);
  await harness.cdp.send('Log.enable', {}, page.sessionId).catch(() => {});
  await harness.cdp.send('Network.enable', {}, page.sessionId).catch(() => {});
  await harness.cdp.send('Runtime.addBinding', { name: bindingName }, page.sessionId);
  await harness.cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    worldName: 'entropy-site-e2e-instrumentation',
    source: `(() => {
      const emit = globalThis[${JSON.stringify(bindingName)}];
      if (typeof emit !== 'function') return;
      const emitStatus = (collector, instrumentationStatus, reason, error) => {
        emit(JSON.stringify({
          collector,
          instrumentationStatus,
          ...(reason ? { reason } : {}),
          ...(error ? { instrumentationError: String(error && error.name || error) } : {}),
        }));
      };
      const performanceObserverAvailable = typeof PerformanceObserver === 'function';
      if (!performanceObserverAvailable) {
        emitStatus('long_task', 'unavailable', 'performance_observer_unavailable');
        emitStatus('long_animation_frame', 'unavailable', 'performance_observer_unavailable');
        emitStatus('resource', 'unavailable', 'performance_observer_unavailable');
      }
      const supported = performanceObserverAvailable
        && Array.isArray(PerformanceObserver.supportedEntryTypes)
        ? PerformanceObserver.supportedEntryTypes
        : null;
      const install = (collector, type, project) => {
        if (!performanceObserverAvailable) return;
        if (supported && !supported.includes(type)) {
          emitStatus(collector, 'unavailable', collector + '_entry_type_unavailable');
          return;
        }
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              emit(JSON.stringify({ collector, entryType: type, ...project(entry) }));
            }
          });
          observer.observe({ type, buffered: true });
          emitStatus(collector, 'ready');
        } catch (error) {
          emitStatus(collector, 'broken', 'observer_install_failed', error);
        }
      };
      install('long_task', 'longtask', (entry) => ({
        duration: entry.duration,
        startTime: entry.startTime,
      }));
      if (performanceObserverAvailable && (!supported || supported.includes('resource'))) {
        try {
          const resourceObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries().slice(0, 128).map((entry) => ({
              name: entry.name,
              initiatorType: entry.initiatorType,
              startTime: entry.startTime,
              duration: entry.duration,
              responseStart: entry.responseStart,
              responseEnd: entry.responseEnd,
              transferSize: entry.transferSize,
              encodedBodySize: entry.encodedBodySize,
              decodedBodySize: entry.decodedBodySize,
            }));
            if (entries.length > 0) {
              emit(JSON.stringify({ collector: 'resource', entries }));
            }
          });
          resourceObserver.observe({ type: 'resource', buffered: true });
          emitStatus('resource', 'ready');
        } catch (error) {
          emitStatus('resource', 'broken', 'observer_install_failed', error);
        }
      } else if (performanceObserverAvailable) {
        emitStatus('resource', 'unavailable', 'resource_entry_type_unavailable');
      }
      const extensionPrefix = ${JSON.stringify(
        harness.extensionId ? `chrome-extension://${harness.extensionId}/` : null,
      )};
      const classifySource = (sourceURL) => {
        if (typeof sourceURL !== 'string' || sourceURL.length === 0) return 'unknown';
        if (extensionPrefix && sourceURL.startsWith(extensionPrefix)) {
          return 'entropy_extension';
        }
        try {
          return new URL(sourceURL, location.href).origin === location.origin
            ? 'page'
            : 'third_party';
        } catch (_error) {
          return 'unknown';
        }
      };
      install('long_animation_frame', 'long-animation-frame', (entry) => {
        const scriptBuckets = Object.create(null);
        const scriptTimelineEntries = [];
        let scriptTimelineInvalidEntryCount = 0;
        let scriptTimelineDroppedEntryCount = 0;
        const scripts = Array.isArray(entry.scripts) ? entry.scripts : [];
        for (const script of scripts) {
          const bucket = classifySource(script.sourceURL);
          const current = scriptBuckets[bucket] || {
            scriptCount: 0,
            durationMs: 0,
            forcedStyleAndLayoutDurationMs: 0,
          };
          current.scriptCount += 1;
          current.durationMs += Number(script.duration) || 0;
          current.forcedStyleAndLayoutDurationMs += (
            Number(script.forcedStyleAndLayoutDuration) || 0
          );
          scriptBuckets[bucket] = current;
          const executionStart = Number(script.executionStart);
          const durationMs = Number(script.duration);
          const forcedStyleAndLayoutDurationMs = Number(
            script.forcedStyleAndLayoutDuration,
          ) || 0;
          if (
            !Number.isFinite(executionStart)
            || !Number.isFinite(durationMs)
            || durationMs < 0
            || forcedStyleAndLayoutDurationMs < 0
          ) {
            scriptTimelineInvalidEntryCount += 1;
            continue;
          }
          if (scriptTimelineEntries.length >= 64) {
            scriptTimelineDroppedEntryCount += 1;
            continue;
          }
          scriptTimelineEntries.push({
            source: bucket,
            startedAt: executionStart,
            endedAt: executionStart + durationMs,
            durationMs,
            forcedStyleAndLayoutDurationMs,
          });
        }
        return {
          duration: entry.duration,
          blockingDuration: entry.blockingDuration,
          startTime: entry.startTime,
          renderStart: entry.renderStart,
          styleAndLayoutStart: entry.styleAndLayoutStart,
          firstUIEventTimestamp: entry.firstUIEventTimestamp,
          scriptBuckets,
          scriptTimeline: {
            complete: scriptTimelineInvalidEntryCount === 0
              && scriptTimelineDroppedEntryCount === 0,
            totalEntryCount: scripts.length,
            invalidEntryCount: scriptTimelineInvalidEntryCount,
            droppedEntryCount: scriptTimelineDroppedEntryCount,
            entries: scriptTimelineEntries,
          },
        };
      });
      if (typeof MutationObserver !== 'function') {
        emitStatus('dom_mutation', 'unavailable', 'mutation_observer_unavailable');
      } else {
        let mutationObserverInstalled = false;
        const installMutationObserver = () => {
          if (mutationObserverInstalled || !document.documentElement) return;
          mutationObserverInstalled = true;
          let aggregate = null;
          let flushTimer = 0;
          const flush = () => {
            flushTimer = 0;
            if (!aggregate) return;
            emit(JSON.stringify({ collector: 'dom_mutation', ...aggregate }));
            aggregate = null;
          };
          const mutationObserver = new MutationObserver((records) => {
            const callbackStartedAt = performance.now();
            const current = aggregate || {
              callbackAtMs: callbackStartedAt,
              callbackDurationMs: 0,
              recordCount: 0,
              addedNodeCount: 0,
              removedNodeCount: 0,
              attributeCount: 0,
              characterDataCount: 0,
            };
            current.recordCount += records.length;
            for (const record of records) {
              current.addedNodeCount += record.addedNodes.length;
              current.removedNodeCount += record.removedNodes.length;
              if (record.type === 'attributes') current.attributeCount += 1;
              if (record.type === 'characterData') current.characterDataCount += 1;
            }
            current.callbackDurationMs += performance.now() - callbackStartedAt;
            aggregate = current;
            if (!flushTimer) flushTimer = setTimeout(flush, 100);
          });
          mutationObserver.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
          emitStatus('dom_mutation', 'ready');
        };
        installMutationObserver();
        if (!mutationObserverInstalled) {
          addEventListener('DOMContentLoaded', installMutationObserver, { once: true });
        }
      }
    })();`,
  }, page.sessionId);

  return {
    snapshot() {
      return {
        longTasks: longTasks.map((entry) => ({ ...entry })),
        longTaskMeasurement: { ...longTaskMeasurement },
        longAnimationFrames: longAnimationFrames.map((entry) => ({
          ...entry,
          scriptBuckets: Object.fromEntries(Object.entries(entry.scriptBuckets || {})
            .map(([bucket, counters]) => [bucket, { ...counters }])),
          scriptTimeline: entry.scriptTimeline
            ? {
              ...entry.scriptTimeline,
              entries: entry.scriptTimeline.entries.map((script) => ({ ...script })),
            }
            : null,
        })),
        longAnimationFrameMeasurement: { ...longAnimationFrameMeasurement },
        resourceLoads: resourceLoads.map((entry) => ({ ...entry })),
        resourceMeasurement: { ...resourceMeasurement },
        domMutationBursts: domMutationBursts.map((entry) => ({ ...entry })),
        domMutationMeasurement: { ...domMutationMeasurement },
        errors: errors.map((entry) => ({ ...entry })),
        documentResponses: documentResponses.map((entry) => ({ ...entry })),
      };
    },
    projectCausalWindow({ startedAt, endedAt }) {
      return projectPageCausalWindow({
        startedAt,
        endedAt,
        resourceLoads,
        resourceMeasurement,
        domMutationBursts,
        domMutationMeasurement,
        longTasks,
        longTaskMeasurement,
        longAnimationFrames,
        longAnimationFrameMeasurement,
      });
    },
    clearLongTasks() {
      longTasks.splice(0);
    },
    clearLongAnimationFrames() {
      longAnimationFrames.splice(0);
    },
    dispose() {
      unsubscribe();
    },
  };
}

export async function createExtensionRuntimeCollector(
  harness,
  { privacyMode = 'public' } = {},
) {
  const expectedWorkerUrl = `chrome-extension://${harness.extensionId}/service-worker-loader.js`;
  const errorRecords = [];
  const ownedErrorCursorSequences = new WeakMap();
  const sessions = new Map();
  const pendingAttachments = new Map();
  const seenTargetIds = new Set();
  const lostTargetIds = new Set();
  let currentWorkerTargetId = null;
  let initialWorkerUnavailable = false;
  let collectorBroken = false;
  let disposed = false;
  let restartCount = 0;
  let reattachCount = 0;
  let coverageGapCount = 0;
  let attachFailureCount = 0;
  let errorSequence = 0;
  let lastReason = 'worker_target_unresolved';

  const pushError = (entry) => {
    errorSequence += 1;
    errorRecords.push({
      sequence: errorSequence,
      entry,
    });
    if (errorRecords.length > 200) {
      errorRecords.splice(0, errorRecords.length - 200);
    }
  };
  const createErrorCursor = async () => {
    await reconcileWorker();
    await Promise.all([...pendingAttachments.values()]);
    await sleep(0);
    const cursor = Object.freeze({});
    ownedErrorCursorSequences.set(cursor, errorSequence);
    return cursor;
  };
  const requireErrorCursorSequence = (cursor) => {
    if (
      !cursor
      || typeof cursor !== 'object'
      || !ownedErrorCursorSequences.has(cursor)
    ) {
      throw new Error('SITE_E2E_EXTENSION_ERROR_CURSOR_INVALID');
    }
    return ownedErrorCursorSequences.get(cursor);
  };
  const projectErrors = (cursor = null) => {
    const cursorSequence = cursor === null ? null : requireErrorCursorSequence(cursor);
    return errorRecords
      .filter(({ sequence, entry }) => (
        entry.source === 'extension_service_worker_collector'
        || cursorSequence === null
        || sequence > cursorSequence
      ))
      .map(({ entry }) => ({ ...entry }));
  };
  const isExpectedWorker = (targetInfo) => (
    targetInfo?.type === 'service_worker'
    && String(targetInfo?.url || '') === expectedWorkerUrl
    && typeof targetInfo?.targetId === 'string'
    && targetInfo.targetId.length > 0
  );
  const markCoverageGap = (targetId, reason) => {
    if (!targetId || lostTargetIds.has(targetId)) return;
    lostTargetIds.add(targetId);
    coverageGapCount += 1;
    lastReason = reason;
    for (const [sessionId, sessionTargetId] of sessions) {
      if (sessionTargetId === targetId) sessions.delete(sessionId);
    }
    if (currentWorkerTargetId === targetId) currentWorkerTargetId = null;
  };
  const resolveAvailability = () => {
    if (collectorBroken) return 'broken';
    if (!currentWorkerTargetId) return 'unavailable';
    if (initialWorkerUnavailable || coverageGapCount > 0 || restartCount > 0) {
      return 'insufficient';
    }
    return 'measured';
  };

  const attachWorker = async (worker) => {
    if (
      disposed
      || !isExpectedWorker(worker)
      || [...sessions.values()].includes(worker.targetId)
    ) return;
    if (pendingAttachments.has(worker.targetId)) {
      await pendingAttachments.get(worker.targetId);
      return;
    }
    const attachment = (async () => {
      const previouslySeen = seenTargetIds.has(worker.targetId);
      const replacingTarget = seenTargetIds.size > 0 && !previouslySeen;
      let attachedSessionId = null;
      try {
        const attached = await harness.cdp.send('Target.attachToTarget', {
          targetId: worker.targetId,
          flatten: true,
        });
        if (typeof attached?.sessionId !== 'string' || !attached.sessionId) {
          throw new Error('EXTENSION_SERVICE_WORKER_SESSION_MISSING');
        }
        attachedSessionId = attached.sessionId;
        sessions.set(attachedSessionId, worker.targetId);
        await harness.cdp.send('Runtime.enable', {}, attachedSessionId);
        await harness.cdp.send('Log.enable', {}, attachedSessionId);
        if (disposed) {
          sessions.delete(attachedSessionId);
          await harness.cdp.send('Target.detachFromTarget', {
            sessionId: attachedSessionId,
          }).catch(() => {});
          return;
        }
        if (replacingTarget) restartCount += 1;
        if (seenTargetIds.size > 0 || previouslySeen || initialWorkerUnavailable) {
          reattachCount += 1;
        }
        seenTargetIds.add(worker.targetId);
        lostTargetIds.delete(worker.targetId);
        currentWorkerTargetId = worker.targetId;
        lastReason = replacingTarget || previouslySeen
          ? 'worker_reattached'
          : 'worker_attached';
      } catch (error) {
        if (attachedSessionId) {
          sessions.delete(attachedSessionId);
          await harness.cdp.send('Target.detachFromTarget', {
            sessionId: attachedSessionId,
          }).catch(() => {});
        }
        collectorBroken = true;
        attachFailureCount += 1;
        lastReason = 'worker_attach_failed';
        pushError({
          source: 'extension_service_worker_collector',
          kind: 'collector_attach_failed',
          message: safeError(error),
          url: null,
        });
      }
    })();
    pendingAttachments.set(worker.targetId, attachment);
    try {
      await attachment;
    } finally {
      pendingAttachments.delete(worker.targetId);
    }
  };

  const reconcileWorker = async () => {
    if (disposed) return;
    try {
      const worker = await harness.getServiceWorker();
      if (worker?.targetId) await attachWorker(worker);
    } catch (error) {
      collectorBroken = true;
      lastReason = 'worker_target_query_failed';
      pushError({
        source: 'extension_service_worker_collector',
        kind: 'collector_target_query_failed',
        message: safeError(error),
        url: null,
      });
    }
  };

  const unsubscribe = harness.cdp.subscribe('*', (event) => {
    if (disposed) return;
    if (
      (event.method === 'Target.targetCreated' || event.method === 'Target.targetInfoChanged')
      && isExpectedWorker(event.params?.targetInfo)
    ) {
      void attachWorker(event.params.targetInfo);
      return;
    }
    if (event.method === 'Target.targetDestroyed') {
      const targetId = event.params?.targetId;
      if (seenTargetIds.has(targetId)) {
        markCoverageGap(targetId, 'worker_target_destroyed');
      }
      return;
    }
    if (event.method === 'Target.detachedFromTarget') {
      const detachedSessionId = event.params?.sessionId;
      const targetId = sessions.get(detachedSessionId) || event.params?.targetId;
      if (targetId && seenTargetIds.has(targetId)) {
        sessions.delete(detachedSessionId);
        markCoverageGap(targetId, 'worker_session_detached');
        void reconcileWorker();
      }
      return;
    }
    if (!sessions.has(event.sessionId)) return;
    if (event.method === 'Runtime.exceptionThrown') {
      const details = event.params?.exceptionDetails || {};
      pushError({
        source: 'extension_service_worker',
        kind: 'uncaught_exception',
        message: privacyMode === 'login'
          ? null
          : safeError(details.exception?.description || details.text || 'uncaught_exception'),
        url: sanitizeSiteHarnessUrl(details.url),
      });
    } else if (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error') {
      const entry = event.params.entry;
      pushError({
        source: entry.source || 'extension_service_worker',
        kind: 'console_error',
        message: privacyMode === 'login' ? null : safeError(entry.text || 'console_error'),
        url: sanitizeSiteHarnessUrl(entry.url),
      });
    } else if (
      event.method === 'Runtime.consoleAPICalled'
      && event.params?.type === 'error'
    ) {
      const args = Array.isArray(event.params?.args) ? event.params.args.slice(0, 16) : [];
      const message = args
        .map((arg) => {
          if (['string', 'number', 'boolean', 'bigint'].includes(arg?.type)) {
            return String(arg?.value ?? arg?.description ?? arg?.type).slice(0, 200);
          }
          return String(arg?.description || arg?.className || arg?.type || 'unknown').slice(0, 200);
        })
        .join(' ');
      const firstFrame = event.params?.stackTrace?.callFrames?.[0] || null;
      pushError({
        source: 'extension_service_worker',
        kind: 'console_error',
        message: privacyMode === 'login' ? null : safeError(message || 'console_error'),
        url: sanitizeSiteHarnessUrl(firstFrame?.url),
      });
    }
  });

  try {
    await harness.cdp.send('Target.setDiscoverTargets', { discover: true });
  } catch (error) {
    collectorBroken = true;
    lastReason = 'target_discovery_failed';
    pushError({
      source: 'extension_service_worker_collector',
      kind: 'collector_target_discovery_failed',
      message: safeError(error),
      url: null,
    });
  }
  const initialWorker = await harness.getServiceWorker().catch((error) => {
    collectorBroken = true;
    lastReason = 'worker_target_query_failed';
    pushError({
      source: 'extension_service_worker_collector',
      kind: 'collector_target_query_failed',
      message: safeError(error),
      url: null,
    });
    return null;
  });
  if (initialWorker?.targetId) {
    await attachWorker(initialWorker);
  } else if (!collectorBroken) {
    initialWorkerUnavailable = true;
    lastReason = 'initial_worker_target_unavailable';
  }

  const createSnapshot = (errors) => ({
    availability: resolveAvailability(),
    reason: lastReason,
    errors,
    workerTargetId: currentWorkerTargetId,
    workerTargetIds: [...seenTargetIds],
    restartCount,
    reattachCount,
    coverageGapCount,
    attachFailureCount,
  });
  const snapshot = () => createSnapshot(projectErrors());
  const snapshotAfterErrorCursor = (cursor) => createSnapshot(projectErrors(cursor));
  return {
    get availability() {
      return resolveAvailability();
    },
    createErrorCursor,
    snapshot,
    snapshotAfterErrorCursor,
    async refresh() {
      await reconcileWorker();
      await Promise.all([...pendingAttachments.values()]);
      return snapshot();
    },
    async refreshAfterErrorCursor(cursor) {
      requireErrorCursorSequence(cursor);
      await reconcileWorker();
      await Promise.all([...pendingAttachments.values()]);
      return snapshotAfterErrorCursor(cursor);
    },
    async dispose() {
      disposed = true;
      unsubscribe();
      await Promise.all([...pendingAttachments.values()]);
      await Promise.all([...sessions.keys()].map((sessionId) => (
        harness.cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {})
      )));
      sessions.clear();
    },
  };
}

function safeSiteE2EDiagnosticToken(candidate, maxLength = 120) {
  return typeof candidate === 'string'
    && candidate.length <= maxLength
    && /^[A-Za-z0-9_.:-]+$/u.test(candidate)
    ? candidate
    : null;
}

function sanitizeSettingsPropagationDetails(value) {
  const propagation = value?.propagation;
  if (!propagation || typeof propagation !== 'object' || Array.isArray(propagation)) {
    return null;
  }
  const applied = propagation.applied;
  const safeApplied = applied && typeof applied === 'object' && !Array.isArray(applied)
    ? Object.fromEntries([
      'refreshed',
      'autoPurged',
      'syncedBlockedBookmarks',
      'runtimeAdapters',
      'syncScripts',
      'broadcast',
    ].map((key) => [key, typeof applied[key] === 'boolean' ? applied[key] : null]))
    : null;
  const failures = (Array.isArray(propagation.failures) ? propagation.failures : [])
    .slice(0, 16)
    .map((failure) => ({
      stage: safeSiteE2EDiagnosticToken(failure?.stage),
      retryCount: Number.isInteger(failure?.retryCount) && failure.retryCount >= 0
        ? failure.retryCount
        : null,
      error: {
        code: safeSiteE2EDiagnosticToken(failure?.error?.code),
        name: safeSiteE2EDiagnosticToken(failure?.error?.name),
        message: value?.privacyMode === 'login'
          ? null
          : safeError(failure?.error?.message || 'UNKNOWN_ERROR'),
      },
    }));
  return {
    kind: 'settings_propagation',
    propagation: {
      status: safeSiteE2EDiagnosticToken(propagation.status),
      taskId: Number.isInteger(propagation.taskId) && propagation.taskId >= 0
        ? propagation.taskId
        : null,
      commitVersion: Number.isInteger(propagation.commitVersion) && propagation.commitVersion >= 0
        ? propagation.commitVersion
        : null,
      changedKeys: (Array.isArray(propagation.changedKeys) ? propagation.changedKeys : [])
        .map((key) => safeSiteE2EDiagnosticToken(key))
        .filter(Boolean)
        .slice(0, 64),
      applied: safeApplied,
      failures,
    },
  };
}

function sanitizeSiteE2ESafeErrorDetails(value) {
  if (value?.kind === 'settings_propagation') {
    return sanitizeSettingsPropagationDetails(value);
  }
  if (
    value?.kind !== 'diagnostic_baseline_settle'
    || !value.settle
    || typeof value.settle !== 'object'
    || Array.isArray(value.settle)
  ) {
    return null;
  }
  const safeToken = (candidate) => safeSiteE2EDiagnosticToken(candidate, 80);
  const safeBoolean = (candidate) => (
    typeof candidate === 'boolean' ? candidate : null
  );
  const safeTokenList = (candidate) => (Array.isArray(candidate) ? candidate : [])
    .map((entry) => safeToken(entry))
    .filter(Boolean)
    .slice(0, 32);
  const safePending = (pending) => ({
    observerMutations: finiteNumberOrNull(pending?.observerMutations),
    socialQueue: finiteNumberOrNull(pending?.socialQueue),
    socialDirtyRoots: finiteNumberOrNull(pending?.socialDirtyRoots),
    socialOwnedMutations: finiteNumberOrNull(pending?.socialOwnedMutations),
    socialOwnedMutationOldestAgeMs:
      finiteNumberOrNull(pending?.socialOwnedMutationOldestAgeMs),
    socialTimer: safeBoolean(pending?.socialTimer),
    socialIdle: safeBoolean(pending?.socialIdle),
    socialCurrentScan: safeBoolean(pending?.socialCurrentScan),
    socialForceFullScan: safeBoolean(pending?.socialForceFullScan),
    textPendingNodes: finiteNumberOrNull(pending?.textPendingNodes),
    textPendingSubtrees: finiteNumberOrNull(pending?.textPendingSubtrees),
    textPendingSubtreeTasks: finiteNumberOrNull(pending?.textPendingSubtreeTasks),
    textFlushScheduled: safeBoolean(pending?.textFlushScheduled),
    textIdleChunkScheduled: safeBoolean(pending?.textIdleChunkScheduled),
  });
  const safeOwners = (owners) => {
    if (!owners || typeof owners !== 'object' || Array.isArray(owners)) return null;
    const entries = ['observerHub', 'socialMetrics', 'textShuffle'].flatMap((ownerId) => {
      const owner = owners[ownerId];
      if (!owner || typeof owner !== 'object' || Array.isArray(owner)) return [];
      return [[ownerId, {
        required: safeBoolean(owner.required),
        state: safeToken(owner.state),
        reason: safeToken(owner.reason),
        ownerState: safeToken(owner.ownerState),
        ownerReason: safeToken(owner.ownerReason),
        settled: safeBoolean(owner.settled),
        unsettledFields: safeTokenList(owner.unsettledFields),
        unavailableFields: safeTokenList(owner.unavailableFields),
      }]];
    });
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  };
  const safeProbeContracts = (probeContracts) => {
    if (
      !probeContracts
      || typeof probeContracts !== 'object'
      || Array.isArray(probeContracts)
    ) {
      return null;
    }
    const entries = ['socialMetrics', 'shortForm'].flatMap((probeId) => {
      const probe = probeContracts[probeId];
      if (!probe || typeof probe !== 'object' || Array.isArray(probe)) return [];
      return [[probeId, {
        matchCount: finiteNumberOrNull(probe.matchCount),
        status: safeToken(probe.status),
        reason: safeToken(probe.reason),
        measurable: safeBoolean(probe.measurable),
        operationCount: finiteNumberOrNull(probe.operationCount),
        canonicalActive: safeBoolean(probe.canonicalActive),
        baselineCovered: safeBoolean(probe.baselineCovered),
        targetingHealthValidity: safeToken(probe.targetingHealthValidity),
        targetingHealthReasonCode: safeToken(probe.targetingHealthReasonCode),
        targetingHealthContractError: safeToken(probe.targetingHealthContractError),
        baselineTargetingHealthContractError:
          safeToken(probe.baselineTargetingHealthContractError),
        targetingHealthProbeContractError:
          safeToken(probe.targetingHealthProbeContractError),
      }]];
    });
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  };
  const safeProtectionActivation = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const safeRevision = (candidate) => (
      Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null
    );
    const safeTimestamp = (candidate) => (
      Number.isFinite(candidate) && candidate >= 0 ? candidate : null
    );
    const applied = value.applied;
    const attempt = value.attempt;
    const safeApplied = applied && typeof applied === 'object' && !Array.isArray(applied)
      ? {
        source: safeToken(applied.source),
        shouldActivate: safeBoolean(applied.shouldActivate),
        shouldMutate: safeBoolean(applied.shouldMutate),
        traceId: safeToken(applied.traceId),
        revision: safeRevision(applied.revision),
        activeFilterKeys: safeTokenList(applied.activeFilterKeys),
        lastUpdatedAt: safeTimestamp(applied.lastUpdatedAt),
      }
      : null;
    const safeAttempt = attempt && typeof attempt === 'object' && !Array.isArray(attempt)
      ? {
        source: safeToken(attempt.source),
        shouldActivate: safeBoolean(attempt.shouldActivate),
        shouldMutate: safeBoolean(attempt.shouldMutate),
        error: safeToken(attempt.error),
        staleIgnored: safeBoolean(attempt.staleIgnored),
        staleReason: safeToken(attempt.staleReason),
        needsResync: safeBoolean(attempt.needsResync),
        resyncReason: safeToken(attempt.resyncReason),
        traceId: safeToken(attempt.traceId),
        expectedBaseRevision: safeRevision(attempt.expectedBaseRevision),
        receivedBaseRevision: safeRevision(attempt.receivedBaseRevision),
        expectedRevision: safeRevision(attempt.expectedRevision),
        receivedRevision: safeRevision(attempt.receivedRevision),
        attemptedAt: safeTimestamp(attempt.attemptedAt),
      }
      : null;
    return safeApplied || safeAttempt
      ? { applied: safeApplied, attempt: safeAttempt }
      : null;
  };
  const safeSettle = (settle) => {
    const protectionActivation = safeProtectionActivation(settle?.protectionActivation);
    return {
      state: safeToken(settle?.state),
      reason: safeToken(settle?.reason),
      settled: safeBoolean(settle?.settled),
      timedOut: safeBoolean(settle?.timedOut),
      attempts: finiteNumberOrNull(settle?.attempts),
      elapsedMs: finiteNumberOrNull(settle?.elapsedMs),
      unsettledFields: safeTokenList(settle?.unsettledFields),
      unavailableFields: safeTokenList(settle?.unavailableFields),
      owners: safeOwners(settle?.owners),
      probeContracts: safeProbeContracts(settle?.probeContracts),
      ...(protectionActivation ? { protectionActivation } : {}),
      pendingTrajectory: (Array.isArray(settle?.pendingTrajectory)
        ? settle.pendingTrajectory
        : []
      ).slice(0, 32).map((entry) => ({
        attempt: finiteNumberOrNull(entry?.attempt),
        elapsedMs: finiteNumberOrNull(entry?.elapsedMs),
        settled: safeBoolean(entry?.settled),
        pending: safePending(entry?.pending),
      })),
      pendingTrajectoryTruncated: safeBoolean(settle?.pendingTrajectoryTruncated),
    };
  };
  const lazyBaselineReset = value.lazyBaselineReset;
  return {
    kind: 'diagnostic_baseline_settle',
    settle: safeSettle(value.settle),
    ...(lazyBaselineReset
      && typeof lazyBaselineReset === 'object'
      && !Array.isArray(lazyBaselineReset)
      ? {
        lazyBaselineReset: {
          reason: safeToken(lazyBaselineReset.reason),
          eligible: safeBoolean(lazyBaselineReset.eligible),
          attempted: safeBoolean(lazyBaselineReset.attempted),
          completed: safeBoolean(lazyBaselineReset.completed),
          initialSettle: safeSettle(lazyBaselineReset.initialSettle),
        },
      }
      : {}),
  };
}

export function createSafeRuntimeError(error, phase = 'runtime') {
  const details = sanitizeSiteE2ESafeErrorDetails(error?.siteE2ESafeDetails);
  return {
    phase,
    message: safeError(error),
    ...(details ? { details } : {}),
  };
}
