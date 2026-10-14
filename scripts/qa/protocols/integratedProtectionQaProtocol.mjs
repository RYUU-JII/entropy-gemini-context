import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { randomBytes } from 'node:crypto';
import { ensureQaSecurityVaultReady, requireQaSecurityVaultStatus, runQaSecurityVaultLogLockStep } from './securityVaultQaFixture.mjs';
import { ExtensionChromiumHarness, evaluate, sleep } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { MESSAGE_ACTIONS, MESSAGE_TYPES } from '../../../src/platform/messaging/messageTypes.js';
import { CONTENT_RECEIVER_CAPABILITY_VERSION } from '../../../src/platform/messaging/contentReceiverCapability.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../src/domains/settings/config/index.js';
import { buildMediaVisualFilterValue, requireVisualFrictionEntry } from '../../../src/domains/settings/config/visualFrictionProfiles.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { DEFAULT_THEME_ID, assertCanonicalThemeId } from '../../../src/themes/core/ids.js';
import { MAIN_PRESENTATION_PHASES } from '../../../src/themes/core/presentation/mainSceneContract.js';
import { PROGRESSION_DEBUG_ACTIONS } from '../../../src/domains/progression/debug/progressionDebugActions.dev.js';
import { PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT } from '../../../src/domains/progression/policy/progressionPreviewPolicy.js';
import { PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT } from '../../../src/domains/progression/policy/progressionJourneyPolicy.js';
import { PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT } from '../../../src/domains/progression/contracts/progressionBonsaiRelease.js';
import { ARTIFACT_DISCLOSURE_FAMILY_ORDER } from '../../../src/domains/progression/policy/artifactDisclosurePolicy.js';
import { buildOriginPatternsForDomain } from '../../../src/lib/permissions.js';
import { sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { createNativeVideoSkipFixture, NATIVE_VIDEO_SKIP_HOST as DOMAIN } from './nativeVideoSkipFixture.mjs';
import { findNativeMediaControl, requireNativeSeekEvidence } from './nativeVideoSkipQaProtocol.mjs';
import { createDashboardPageDiagnostics } from './dashboardCaptureDiagnostics.mjs';
import { readQaCdpPageTargetWindow } from '../../browser-qa/browser/cdpTargetOwner.mjs';
import { observeQaOwnedBrowserWindows } from '../browser/qaOperatorBrowserWindow.mjs';
import { completeMv3ProfileMutationHandoff } from '../../e2e/mv3ProfileMutationHandoff.mjs';
import { normalizeProfileMutationResponseHandoff } from '../../../src/platform/messaging/contracts/profileMutationResponseHandoff.js';
import { readSettingsArtifactGalleryNavigation, selectSettingsArtifactGalleryFamily } from './settingsArtifactGalleryNavigation.mjs';
import { requireBootPrewarmDashboardSnapshot } from '../../../src/apps/boot/bootPrewarmSnapshotContract.js';
import { MODEL_STATE_INITIAL_PROFILE_EPOCH } from '../../../src/platform/storage/model/ProfileEpochContract.js';
import { PROFILE_RESET_LIFECYCLE_STORAGE_KEY } from '../../../src/platform/storage/internal/chrome-storage/stores/ProfileResetLifecycleStore.js';
import { resolveProfileResetGeneration, isProfileResetWriteAdmissionClosed } from '../../../src/platform/storage/runtime/ProfileResetLifecycleRepository.js';
import {
  INTEGRATED_FRESH_PROTOCOL_DEFAULTS, matchesIntegratedFreshProtocolDefaults,
  requireIntegratedPortableSnapshot, summarizeIntegratedPortableSnapshot,
  integratedPortableState, buildIntegratedMalformedImportSnapshot,
  requireIntegratedMalformedImportRejection,
  INTEGRATED_SETTINGS_CORRUPTION_KINDS, seedIntegratedSettingsCorruption,
  verifyIntegratedSettingsCorruptionUnchanged,
  requireIntegratedCompletedProfileGeneration, requireIntegratedSettingsRecoveryResponse,
} from './integratedSettingsLifecycleFixture.mjs';

// One continuous journey. These are assertions, not separately scheduled QA runs.
export const INTEGRATED_PROTECTION_STEPS = Object.freeze([
  'fresh_profile_defaults', 'baseline', 'register_in_sites', 'content_protected', 'popup_protected',
  'dashboard_reload', 'locked_protection_revival', 'artifact_lens_settings', 'artifact_echo_settings',
  'artifact_settings_lifecycle',
  'cancel_release', 'release_after_grace',
  'content_restored', 'popup_restored', 'snapshot_data_lifecycle',
  'settings_corruption_recovery', 'restore_settings',
]);

function requireProof(condition, code, diagnostic) {
  if (condition) return;
  const error = new Error(`QA_INTEGRATED_PROTECTION_${code}`);
  error.diagnostic = diagnostic;
  throw error;
}

export function requireIntegratedJourneyComplete(steps) {
  requireProof(Array.isArray(steps) && steps.length === INTEGRATED_PROTECTION_STEPS.length
    && steps.every((step, index) => step.id === INTEGRATED_PROTECTION_STEPS[index]
      && step.status === 'PASS'), 'INCOMPLETE', steps);
  return true;
}

export function matchesIntegratedContentState(state, enabled) {
  const effectsMatch = state?.runtime?.features?.videoSkipGuard?.active === enabled
    && state.ownership?.count === (enabled ? 1 : 0)
    && (enabled || state.ownership.lock === null);
  if (!effectsMatch) return false;
  return state.runtime.runtime?.featureStates?.videoSkipGuard?.enabled === enabled
    || (!enabled && matchesIntegratedContentTeardown(state.documentProof));
}

export function matchesIntegratedContentTeardown(proof) {
  const positive = value => Number.isSafeInteger(value) && value > 0;
  const identity = value => typeof value === 'string' && value.length > 0 && value === value.trim();
  const expected = proof?.expectedIdentity;
  const probe = proof?.probe;
  const state = probe?.state;
  const bootstrap = proof?.bootstrap;
  const lease = proof?.attemptLease;
  return Boolean(identity(expected?.documentId) && identity(expected?.url) && identity(expected?.buildId)
    && proof.frameId === 0 && proof.documentId === expected.documentId && proof.url === expected.url
    && probe?.ok === true && probe.type === MESSAGE_TYPES.CONTENT_RUNTIME_PROBE
    && probe.buildId === expected.buildId && state?.url === expected.url
    && state.status === 'stale' && state.dispatchReady === false && state.active === false
    && state.receiverCapabilityVersion === null && state.error === null
    && typeof state.reason === 'string' && state.reason.endsWith(':out_of_scope')
    && positive(state.attemptId) && positive(state.startedAt)
    && bootstrap?.attemptId === state.attemptId && bootstrap.startedAt === state.startedAt
    && bootstrap.status === 'stale' && bootstrap.dispatchReady === false && bootstrap.active === false
    && bootstrap.receiverCapabilityVersion === null && bootstrap.error === null && bootstrap.reason === state.reason
    && lease?.attemptId === state.attemptId && lease.startedAt === state.startedAt
    && lease.aborted === true && positive(lease.revokedAt) && lease.revokedAt >= lease.startedAt
    && lease.revokeReason === state.reason && proof.receiverInstalled === false);
}

export function requireIntegratedNativeTimelineDisplay(appearance, expected, diagnostic = {}) {
  requireProof(['allowed', 'blocked'].includes(expected), 'NATIVE_EXPECTATION_INVALID');
  if (expected === 'allowed') requireProof(appearance?.display !== 'none'
    && typeof appearance?.display === 'string', 'NATIVE_TIMELINE_MISSING', { ...diagnostic, appearance });
  else requireProof(appearance?.display === 'none', 'PROTECTED_TIMELINE_NOT_REMOVED', { ...diagnostic, appearance });
  return appearance.display;
}

export function summarizeIntegratedNativeFailureContentState(state) {
  const pick = (source, keys) => source && typeof source === 'object'
    ? Object.fromEntries(keys.filter(key => Object.hasOwn(source, key)).map(key => [key,
      typeof source[key] === 'string' ? source[key].slice(0, 512) : source[key]])) : null;
  const proof = state?.documentProof;
  return {
    ownership: pick(state?.ownership, ['count', 'lock']),
    videoSkipActive: state?.runtime?.features?.videoSkipGuard?.active,
    environment: pick(state?.runtime?.environment, ['generatedAt', 'visibilityState', 'phase']),
    latestAttempt: pick(state?.runtime?.runtimeAttempt, ['source', 'shouldActivate', 'shouldClear',
      'shouldMutate', 'error', 'staleIgnored', 'staleReason', 'needsResync', 'resyncReason',
      'traceId', 'expectedBaseRevision', 'receivedBaseRevision', 'expectedRevision',
      'receivedRevision', 'attemptedAt']),
    latestApplied: pick(state?.runtime?.runtime, ['source', 'shouldActivate', 'shouldClear',
      'shouldMutate', 'traceId', 'revision', 'lastUpdatedAt']),
    documentProof: {
      ...pick(proof, ['frameId', 'documentId', 'url', 'receiverInstalled']),
      expectedIdentity: pick(proof?.expectedIdentity, ['documentId', 'url', 'buildId', 'attemptId']),
      bootstrap: pick(proof?.bootstrap, ['status', 'attemptId', 'startedAt', 'reason',
        'dispatchReady', 'active', 'receiverCapabilityVersion', 'error']),
      attemptLease: pick(proof?.attemptLease, ['attemptId', 'startedAt', 'aborted', 'revokedAt', 'revokeReason']),
      probe: {
        ...pick(proof?.probe, ['ok', 'type', 'buildId']),
        state: pick(proof?.probe?.state, ['status', 'attemptId', 'startedAt', 'reason', 'url',
          'dispatchReady', 'active', 'receiverCapabilityVersion', 'error']),
      },
    },
  };
}

export async function preserveIntegratedNativeFailureEvidence({ run, readContent, observe }) {
  try { return await run(); }
  catch (error) {
    let afterFailure;
    try { afterFailure = { status: 'read', content: summarizeIntegratedNativeFailureContentState(await readContent()) }; }
    catch (readError) { afterFailure = { status: 'failed', error: String(readError.message).slice(0, 512) }; }
    error.diagnostic = { ...error.diagnostic, afterFailure };
    try { await observe(afterFailure); }
    catch (evidenceError) { error.diagnostic.afterFailureEvidenceError = String(evidenceError.message).slice(0, 512); }
    throw error;
  }
}

export async function requireIntegratedRestorationBeforeNativeSeek({ readContent, observe }) {
  const state = await readContent();
  const current = summarizeIntegratedNativeFailureContentState(state);
  await observe(current);
  requireProof(matchesIntegratedContentState(state, false), 'CONTENT_REACTIVATED_BEFORE_SEEK', current);
  return current;
}

export function matchesIntegratedLensContent(state, { enabled, filterSettings, baseline, previousApplied = null }) {
  const content = state?.content;
  const applied = content?.runtime?.runtime;
  const attempt = content?.runtime?.runtimeAttempt;
  const proof = content?.documentProof;
  const identity = proof?.expectedIdentity;
  const visual = content?.mediaVisual;
  const projection = state?.projection;
  const compiled = projection?.runtime?.plan?.filterPlan;
  const blur = compiled?.blur;
  if (!matchesIntegratedContentState(content, true)
    || !identity?.documentId || proof.frameId !== 0 || proof.documentId !== identity.documentId
    || proof.url !== identity.url || proof.probe?.buildId !== identity.buildId
    || proof.probe?.state?.url !== identity.url
    || !['envelope_v2_snapshot', 'envelope_v2_patch'].includes(applied?.source)
    || !Number.isSafeInteger(applied.revision) || applied.revision < 0
    || applied.shouldActivate !== true || applied.shouldMutate !== true || applied.shouldClear !== false
    || typeof applied.traceId !== 'string' || !applied.traceId.trim()
    || attempt?.traceId !== applied.traceId || attempt.receivedRevision !== applied.revision
    || attempt.source !== applied.source || attempt.shouldActivate !== true
    || attempt.shouldMutate !== true || attempt.shouldClear !== false
    || attempt.error !== null || attempt.staleIgnored !== false || attempt.staleReason !== null
    || attempt.needsResync !== false || attempt.resyncReason !== null
    || applied.featureStates?.blur?.enabled !== enabled
    || !Array.isArray(applied.activeFilterKeys) || applied.activeFilterKeys.includes('blur') !== enabled
    || projection?.scope?.host !== DOMAIN || projection.runtime?.available !== true
    || projection.scope.tabId !== null
    || blur?.isActive !== enabled || blur.strength !== filterSettings?.blur?.value
    || filterSettings.blur.isActive !== enabled
    || visual?.visibilityState !== 'visible' || visual.videoCount !== 1 || visual.video?.source !== baseline?.source
    || visual.video.readyState < 2 || visual.video.fullscreen !== false
    || visual.rootFilter !== baseline.rootFilter
    || content.runtime.features?.visualManager?.lastError) return false;
  // The host cache revision belongs to its last evaluation, not this document's
  // delivered envelope revision. Fence toggles with the exact applied trace
  // above and a newer revision in the same document instead.
  if (previousApplied !== null && (previousApplied.documentId !== proof.documentId
    || !Number.isSafeInteger(previousApplied.revision) || previousApplied.revision < 0
    || typeof previousApplied.traceId !== 'string' || !previousApplied.traceId.trim()
    || applied.revision <= previousApplied.revision || applied.traceId === previousApplied.traceId)) return false;
  requireVisualFrictionEntry('blur', blur);
  const expectedMediaFilter = buildMediaVisualFilterValue(compiled);
  const expectedFilter = [baseline.videoFilter === 'none' ? '' : baseline.videoFilter, expectedMediaFilter]
    .filter(Boolean).join(' ') || 'none';
  if (visual.video.filter !== expectedFilter) return false;
  const effects = visual.video.filterEffects;
  return Array.isArray(effects) && effects.length === (enabled ? 1 : 0)
    && effects.every(effect => effect.keyframes.length >= 2
      && effect.keyframes.every(frame => frame.composite === 'add' && frame.filter === expectedMediaFilter));
}

export function matchesIntegratedArtifactSetting(state, expectedItems) {
  return Boolean(state?.control?.selected === true && state.control.pending === false
    && Array.isArray(state.control.errors) && state.control.errors.length === 0
    && state.settings && Object.keys(expectedItems).length > 0 && Object.entries(expectedItems).every(([key, value]) => (
      isDeepStrictEqual(state.settings[key], value)
    )));
}

const artifactRow = child => `document.querySelector('[data-artifact-control-child-key="${child}"]')`;

export function buildIntegratedArtifactDisclosureContract(child) {
  requireProof(typeof child === 'string' && /^[a-zA-Z][a-zA-Z0-9]*$/.test(child), 'ARTIFACT_CONTROL_ID_INVALID');
  const summary = `(${artifactRow(child)})?.querySelector('button[aria-expanded][aria-controls]')`;
  return { summary, read: `(() => {
    const row = (${artifactRow(child)}), summary = (${summary});
    const disclosed = Boolean(row?.hasAttribute('data-zen-artifact-control-box') || summary);
    const raw = summary?.getAttribute('aria-expanded');
    const detail = summary ? document.getElementById(summary.getAttribute('aria-controls')) : null;
    return { present: Boolean(row), disclosed, expanded: raw === 'true',
      valid: Boolean(row && (!disclosed || (summary && ['true', 'false'].includes(raw)
        && detail && row.contains(detail) && detail.hidden === (raw === 'false')))) };
  })()` };
}

// Disclosure uses the protocol's existing hit-tested native click driver. It
// never clicks a hidden input or changes a setting to make a control visible.
export async function openIntegratedArtifactControl(driver, page, child) {
  const contract = buildIntegratedArtifactDisclosureContract(child);
  const inspect = () => driver.readDom(page, contract.read);
  const state = await driver.until(`artifact_control_ready:${child}`, inspect, value => {
    if (!value.present) return false;
    requireProof(value.valid === true, 'ARTIFACT_CONTROL_DISCLOSURE_INVALID', { child, value });
    return true;
  });
  if (!state.disclosed || state.expanded) return state;
  await driver.click(page, contract.summary);
  return driver.until(`artifact_control_open:${child}`, inspect, value => {
    requireProof(value.valid === true, 'ARTIFACT_CONTROL_DISCLOSURE_INVALID', { child, value });
    return value.expanded === true;
  });
}

export function buildIntegratedArtifactChoiceContract(child, value) {
  if (child === 'blur') requireProof(value === 'on' || value === 'off', 'LENS_CHOICE_INVALID', { value });
  const values = value === 'on' ? ['__on__', '1']
    : value === 'off' ? ['__off__', '__artifact_control_off__', '0'] : [String(value)];
  // Blur owns a native switch. Echo retains its declared option identities.
  const selector = child === 'blur' ? 'button[role="switch"]'
    : values.map(item => `button[data-artifact-control-value="${item}"]`).join(',');
  const choice = `(${artifactRow(child)})?.querySelector(${JSON.stringify(selector)})`;
  const selected = child === 'blur'
    ? `node?.getAttribute('aria-checked') === ${JSON.stringify(String(value === 'on'))}`
    : "node?.getAttribute('aria-checked') === 'true' || node?.getAttribute('aria-pressed') === 'true'";
  const disclosedBoolean = child !== 'blur' && (value === 'on' || value === 'off');
  const expectedAction = value === 'on' ? '__off__' : '__on__';
  return { choice, read: `(() => {
    const row = (${artifactRow(child)});
    const disclosedBoolean = ${disclosedBoolean} && row?.hasAttribute('data-zen-artifact-control-box');
    // A disclosed action changes to the opposite verb after input. Its current
    // identity reports intent; the row's ink reports the displayed final frame.
    // Keep that observation separate from the unchanged mutation selector.
    const node = disclosedBoolean
      ? row.querySelector('button[data-artifact-control-value="__on__"],button[data-artifact-control-value="__off__"]')
      : (${choice});
    const configuredSelected = disclosedBoolean
      ? node?.getAttribute('data-artifact-control-value') === ${JSON.stringify(expectedAction)} : (${selected});
    const shownSelected = disclosedBoolean
      ? row.getAttribute('data-zen-artifact-box-state') === ${JSON.stringify(value)} : configuredSelected;
    return { child: ${JSON.stringify(child)}, value: ${JSON.stringify(value)},
      role: node?.getAttribute('role') || (node?.tagName === 'BUTTON' ? 'button' : null),
      accessibleName: node?.getAttribute('aria-label'),
      configuredSelected, shownSelected, selected: configuredSelected && shownSelected,
      pending: row ? row.getAttribute('aria-busy') === 'true' || Boolean(row.querySelector('[aria-busy="true"]')) : null,
      errors: row ? Array.from(row.querySelectorAll('[role="alert"]')).map(item => item.textContent) : null };
  })()` };
}

export function isIntegratedControlReady(state) {
  return Boolean(state?.present === true && state.bootShellPresent === false
    && state.inert === false && state.disabled === false && state.visible === true
    && state.hit === true && Number.isFinite(state.point?.x) && Number.isFinite(state.point?.y));
}

export function inspectIntegratedDashboardPresentation(observedDocument = document) {
  const view = observedDocument.defaultView;
  const bootShellPresent = Boolean(observedDocument.getElementById('entropy-dashboard-boot-shell'));
  const garden = observedDocument.querySelector('[data-garden-mode]');
  const control = garden?.querySelector('.zen-garden-mode-control');
  const edge = control?.querySelector('button[aria-controls="zen-garden-ledger"]');
  let edgeState = { present: Boolean(edge), bootShellPresent };
  if (edge) {
    const rect = edge.getBoundingClientRect(), style = view.getComputedStyle(edge);
    const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    edgeState = { ...edgeState, tab: edge.dataset.tab, mode: edge.dataset.mode,
      busy: edge.getAttribute('aria-busy') === 'true',
      inert: Boolean(edge.closest('[inert]')), disabled: edge.disabled || edge.getAttribute('aria-disabled') === 'true',
      visible: !observedDocument.hidden && rect.width > 0 && rect.height > 0
        && style.visibility === 'visible' && Number(style.opacity) > 0,
      hit: edge.contains(observedDocument.elementFromPoint(point.x, point.y)), point,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  }
  // Only the two Garden sheet/threshold transform owners can move this target.
  // Decorative or infinite animations elsewhere do not delay native input.
  const transformAnimations = garden ? Array.from(garden.querySelectorAll('.zen-garden-threshold, .zen-garden-pathways'))
    .flatMap(owner => owner.getAnimations().filter(animation => animation.transitionProperty === 'transform'
      && (animation.pending || animation.playState === 'running')).map(animation => ({
      owner: owner.classList.contains('zen-garden-threshold') ? 'threshold' : 'sheet',
      playState: animation.playState, pending: animation.pending,
    }))) : [];
  return { hidden: observedDocument.hidden, bootShellPresent,
    themeId: observedDocument.documentElement.getAttribute('data-theme'),
    activeTab: observedDocument.querySelector('[data-dashboard-active-tab]')?.getAttribute('data-dashboard-active-tab'),
    phase: observedDocument.querySelector('[data-main-presentation-phase]')?.getAttribute('data-main-presentation-phase'),
    garden: garden ? { mode: garden.dataset.gardenMode, pendingMode: control?.getAttribute('data-pending') ?? null,
      edge: edgeState, transformAnimations,
      errors: control ? Array.from(control.querySelectorAll('[role="alert"]')).map(node => node.textContent.slice(0, 200)) : [] } : null };
}

export function readIntegratedDashboardPresentation(readDom) {
  return readDom(`(${inspectIntegratedDashboardPresentation.toString()})()`);
}

export function matchesIntegratedDashboardNavigationReleased(state) {
  return Boolean(state?.hidden === false && state.bootShellPresent === false
    && [MAIN_PRESENTATION_PHASES.SETTLED, MAIN_PRESENTATION_PHASES.DEFERRED].includes(state.phase));
}

function matchesIntegratedGardenModeSettled(garden, mode) {
  return garden?.mode === mode && garden.pendingMode === null
    && garden.transformAnimations.length === 0 && garden.errors.length === 0;
}

export function matchesIntegratedGardenSitesEntryReady(state) {
  return matchesIntegratedDashboardNavigationReleased(state) && state.themeId === 'zen' && state.activeTab === 'main'
    && matchesIntegratedGardenModeSettled(state.garden, 'pond')
    && isIntegratedControlReady(state.garden.edge) && state.garden.edge.busy === false
    && state.garden.edge.tab === 'sites' && state.garden.edge.mode === 'pathways';
}

export async function presentIntegratedSitesWorkspace(driver, page) {
  const presentation = await driver.until('app_navigation_released', () => driver.readPresentation(page),
    matchesIntegratedDashboardNavigationReleased, 45_000);
  const themeId = assertCanonicalThemeId(presentation.themeId, 'QA Sites navigation');
  if (presentation.activeTab !== 'sites') {
    if (themeId === 'zen') {
      if (presentation.activeTab !== 'main') {
        await driver.click(page, `document.querySelector('#dashboard-sidebar button[data-tab="main"]')`);
        await driver.until('garden_presented', () => driver.readPresentation(page), state => (
          matchesIntegratedDashboardNavigationReleased(state) && state.activeTab === 'main'
        ), 45_000);
      }
      await driver.until('garden_sites_entry_ready', () => driver.readPresentation(page),
        matchesIntegratedGardenSitesEntryReady, 45_000);
      await driver.click(page, `document.querySelector('button[aria-controls="zen-garden-ledger"][data-tab="sites"]')`);
    } else {
      await driver.click(page, `document.querySelector('#dashboard-sidebar button[data-tab="sites"]')`);
    }
  }
  return driver.until('sites_presented', () => driver.readPresentation(page), state => (
    matchesIntegratedDashboardNavigationReleased(state) && state.activeTab === 'sites'
      && (themeId !== 'zen' || matchesIntegratedGardenModeSettled(state.garden, 'pathways'))
  ), 45_000);
}

export const INTEGRATED_FIRST_USE_OFF_POLICY = Object.freeze({
  dataCollectionMode: 'off', precisionInsightsMode: 'off',
  precisionInsightsSignals: Object.freeze({ clse: true, navigation: true }),
  insightsMode: 'off', insightsConsent: 'later',
});

export async function readIntegratedFirstUsePolicy(send) {
  const keys = Object.keys(INTEGRATED_FIRST_USE_OFF_POLICY);
  const reply = await send({ action: MESSAGE_ACTIONS.GET_BOOT_PREWARM_SNAPSHOT,
    force: true, reason: 'integrated_first_use_policy' });
  const protocol = reply?.snapshot?.protocol;
  const missingKeys = keys.filter(key => !protocol || !Object.hasOwn(protocol, key));
  const diagnostic = { missingKeys, error: reply?.error };
  if (reply?.success === false && reply.error === 'BOOT_PREWARM_SNAPSHOT_INVALIDATED') {
    const error = new Error('QA_INTEGRATED_PROTECTION_FIRST_USE_POLICY_QUERY');
    error.code = 'BOOT_PREWARM_SNAPSHOT_INVALIDATED';
    error.diagnostic = diagnostic;
    throw error;
  }
  requireProof(reply?.success === true, 'FIRST_USE_POLICY_QUERY', diagnostic);
  requireProof(missingKeys.length === 0, 'FIRST_USE_POLICY_QUERY', diagnostic);
  let snapshot;
  try { snapshot = requireBootPrewarmDashboardSnapshot(reply.snapshot); }
  catch (error) { error.diagnostic = diagnostic; throw error; }
  requireProof(keys.every(key => Object.hasOwn(snapshot.protocol, key)), 'FIRST_USE_POLICY_QUERY', diagnostic);
  return Object.fromEntries(keys.map(key => [key, snapshot.protocol[key]]));
}

export async function readIntegratedRestorationRuleMembership(send) {
  const keys = ['blockedUrls', 'allowedUrls'];
  const reply = await send({ action: MESSAGE_ACTIONS.GET_SETTINGS, keys,
    defaults: { blockedUrls: [], allowedUrls: [] } });
  requireProof(reply?.success === true && reply.settings !== null && typeof reply.settings === 'object'
    && !Array.isArray(reply.settings) && keys.every(key => Object.hasOwn(reply.settings, key)
    && Array.isArray(reply.settings[key])), 'RESTORE_RULES_READ', { error: reply?.error });
  return Object.fromEntries(keys.map(key => [key, reply.settings[key]]));
}

const FIRST_USE_SETUP_SELECTOR = '[data-dashboard-setup-canvas="true"]';
export const INTEGRATED_FIRST_USE_COMMIT = 'document.querySelector("[data-first-use-browse]")';
export const INTEGRATED_FIRST_USE_START = 'document.querySelector("[data-first-use-start]")';
export const INTEGRATED_FIRST_USE_ENTRY = 'document.querySelector("[data-first-site-registration-entry]")';
export const INTEGRATED_FIRST_USE_CANCEL = 'document.querySelector("[data-first-site-registration-cancel]")';

function requireIntegratedDayZeroDisclosure(response) {
  const unlock = response?.snapshot?.unlockProgress;
  requireProof(response?.success === true && unlock?.source === 'canonical'
    && unlock.debugOverrideActive === false && unlock.canonicalQualifiedUseDayCount === 0
    && unlock.qualifiedUseDayCount === 0, 'FIRST_USE_CANONICAL_DAY_ZERO_REQUIRED', { error: response?.error, unlock });
  return { source: unlock.source, debugOverrideActive: false,
    canonicalQualifiedUseDayCount: 0, qualifiedUseDayCount: 0 };
}

function requireIntegratedProgressionGeneration(response, profileGeneration) {
  requireProof(typeof profileGeneration === 'string' && !!profileGeneration.trim()
    && response?.profileGeneration === profileGeneration, 'FIRST_USE_PROGRESSION_GENERATION_REQUIRED');
  return response;
}

export async function readIntegratedDayZeroDisclosure(send, profileGeneration) {
  const response = await send({ action: MESSAGE_ACTIONS.GET_ARTIFACT_DISCLOSURE_SNAPSHOT, profileGeneration });
  return requireIntegratedDayZeroDisclosure(requireIntegratedProgressionGeneration(response, profileGeneration));
}

export async function prepareIntegratedCanonicalDayZero(send, profileGeneration) {
  // Absence is the declared dev full-access default. Only this existing command
  // writes the explicit canonical session sentinel; it never earns use days.
  const response = await send({ action: PROGRESSION_DEBUG_ACTIONS.CLEAR_UNLOCK_OVERRIDE, profileGeneration });
  const acknowledgement = requireIntegratedDayZeroDisclosure(requireIntegratedProgressionGeneration(response, profileGeneration));
  const current = await readIntegratedDayZeroDisclosure(send, profileGeneration);
  requireProof(isDeepStrictEqual(current, acknowledgement), 'FIRST_USE_CANONICAL_PREPARATION_MISMATCH');
  return { ...current, sessionMode: 'canonical', canonicalProgressionWrites: false };
}

function matchesIntegratedResidentShadow(state) {
  return state?.pond?.fishCount === 1 && state.pond.shadowSentinelCount === 1
    && state.pond.invitationEnteringCount === 0
    && typeof state.pond.mountId === 'string' && state.pond.mountId.trim().length > 0
    && Number.isSafeInteger(state.pond.sceneSessionSyncCount) && state.pond.sceneSessionSyncCount >= 0
    && typeof state.pond.presentationSceneCommitKey === 'string'
    && state.pond.presentationSceneCommitKey.trim().length > 0;
}

function matchesIntegratedPondScene(before, after) {
  return after.mountId === before.mountId
    && after.sceneSessionSyncCount === before.sceneSessionSyncCount
    && after.presentationSceneCommitKey === before.presentationSceneCommitKey;
}

export async function openIntegratedFirstUseRegistration({
  label, until, readEntry, click, readPolicy, readRules, readDayZero, capture,
}) {
  const dayZero = await readDayZero();
  const beforePolicy = await readPolicy();
  requireProof(beforePolicy.insightsConsent === 'unset', 'FIRST_USE_UNSET_REQUIRED', { label, beforePolicy });
  const closed = state => state?.sidebarPresent === true && state.editorPresent === false
    && state.setupPresent === false && state.activeTab === 'main'
    && isIntegratedControlReady(state.sidebarControl)
    && isIntegratedControlReady(state.entryControl)
    && (state.themeId !== 'zen' || matchesIntegratedResidentShadow(state));
  const initial = await until(`first_use_entry:${label}`, readEntry, closed, 45_000);
  const screenshot = await capture();
  await click(INTEGRATED_FIRST_USE_ENTRY);
  await until(`first_use_entry_open:${label}`, readEntry, state => state.editorPresent === true, 45_000);
  await click(INTEGRATED_FIRST_USE_CANCEL);
  const cancelled = await until(`first_use_entry_cancelled:${label}`, readEntry, closed, 45_000);
  requireProof(isDeepStrictEqual(await readPolicy(), beforePolicy), 'FIRST_USE_CANCEL_POLICY_CHANGED', { label });
  const rules = await readRules();
  requireProof(rules.blockedUrls.length === 0 && rules.allowedUrls.length === 0,
    'FIRST_USE_CANCEL_REGISTERED_SITE', { label, rules });
  if (initial.themeId === 'zen') requireProof(matchesIntegratedPondScene(initial.pond, cancelled.pond),
    'FIRST_USE_CANCEL_SCENE_CHANGED', { label, before: initial.pond, after: cancelled.pond });
  await click(INTEGRATED_FIRST_USE_ENTRY);
  const reopened = await until(`first_use_entry_reopened:${label}`, readEntry,
    state => state.editorPresent === true && (state.themeId !== 'zen' || matchesIntegratedResidentShadow(state)), 45_000);
  if (initial.themeId === 'zen') requireProof(matchesIntegratedPondScene(initial.pond, reopened.pond),
    'FIRST_USE_REOPEN_SCENE_CHANGED', { label, before: initial.pond, after: reopened.pond });
  return { dayZero, sidebarPresent: true, initiallyClosed: true, cancelledWithoutMutation: true,
    entryMethod: initial.themeId === 'zen' ? 'trusted_pond_entry_pointer' : 'trusted_main_entry_pointer',
    // Public renderer metrics prove a stable scene and its resident counts;
    // object/UID reuse belongs to the roster reconciliation unit contract.
    ...(initial.themeId === 'zen' ? { residentShadow: initial.pond,
      residentShadowChecks: { initial: initial.pond, cancelled: cancelled.pond, reopened: reopened.pond },
      continuityEvidence: 'stable_scene_and_resident_counts' } : {}), screenshot };
}

export async function readIntegratedFirstUseEntry({ readDom, readControl, themeId }) {
  return { ...await readDom(`(async () => {
    const pond = ${JSON.stringify(themeId)} === 'zen'
      && globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG
      ? await globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG.metrics() : null;
    const koi = pond?.mainMetrics?.koiRender;
    const rosterEvent = pond?.runtimeHealth?.events?.findLast(event => event.name === 'fish_roster_applied');
    return { themeId: ${JSON.stringify(themeId)},
      activeTab: document.querySelector('[data-dashboard-active-tab]')?.dataset.dashboardActiveTab,
      sidebarPresent: Boolean(document.querySelector('#dashboard-sidebar')),
      editorPresent: Boolean(document.querySelector('[data-first-site-registration-editor]')),
      setupPresent: Boolean(document.querySelector(${JSON.stringify(FIRST_USE_SETUP_SELECTOR)})),
      pond: pond ? { mountId: globalThis.__ZEN_POND_WATER_EFFECTS_DEBUG_OWNER,
        sceneSessionSyncCount: pond.sceneSessionSyncCount,
        presentationSceneCommitKey: rosterEvent?.details?.presentationSceneCommitKey,
        fishRosterSyncCount: pond.fishRosterSyncCount, fishCount: koi?.fishCount,
        shadowSentinelCount: koi?.shadowSentinelCount, invitationEnteringCount: koi?.invitationEnteringCount } : null };
  })()`), entryControl: await readControl(INTEGRATED_FIRST_USE_ENTRY),
  sidebarControl: await readControl('document.querySelector(\'#dashboard-sidebar [data-tab="main"]\')') };
}

export async function readIntegratedFirstUseUi({ readDom, readControl }) {
  const ui = await readDom(`(() => {
    const firstUse = document.querySelector('[data-main-first-use-registration]');
    const recording = firstUse?.querySelector('[data-first-use-recording]');
    return {
      setupPresent: Boolean(document.querySelector(${JSON.stringify(FIRST_USE_SETUP_SELECTOR)})),
      firstUsePresent: Boolean(firstUse), recordingPresent: Boolean(recording),
      recordingChecked: recording?.checked === true,
      bootShellPresent: Boolean(document.getElementById('entropy-dashboard-boot-shell')),
      busy: firstUse?.getAttribute('aria-busy') === 'true',
      errors: Array.from(firstUse?.querySelectorAll('[role="alert"]') || [])
        .map(node => node.textContent.slice(0, 300)),
    };
  })()`);
  return { ...ui, primaryControl: await readControl(INTEGRATED_FIRST_USE_COMMIT),
    startControl: await readControl(INTEGRATED_FIRST_USE_START) };
}

function matchesIntegratedFirstUseCommittedPolicy(state) {
  return Boolean(state?.ui?.setupPresent === false && state.ui.bootShellPresent === false
    && state.ui.firstUsePresent === false && state.ui.busy === false
    && Array.isArray(state.ui.errors) && state.ui.errors.length === 0
    && isDeepStrictEqual(state.settings, INTEGRATED_FIRST_USE_OFF_POLICY));
}

export function matchesIntegratedFirstUseComplete(state) {
  return matchesIntegratedFirstUseCommittedPolicy(state) && isIntegratedControlReady(state.sites);
}

export async function readIntegratedFirstSiteRegistration(send, { pageUrl, hostname }) {
  const response = await send({ action: MESSAGE_ACTIONS.GET_POPUP_SITE_SNAPSHOT, pageUrl, hostname });
  requireProof(response?.success === true, 'FIRST_SITE_SNAPSHOT_QUERY', { error: response?.error });
  // siteGoals is optional persisted state. Request its canonical absence value
  // explicitly so the message transport retains the map when no goal was saved.
  const rules = await send({ action: MESSAGE_ACTIONS.GET_SETTINGS, keys: ['siteGoals'], defaults: { siteGoals: {} } });
  const goals = rules?.settings?.siteGoals;
  requireProof(rules?.success === true && goals !== null && typeof goals === 'object'
    && !Array.isArray(goals), 'FIRST_SITE_GOALS_QUERY', { error: rules?.error,
    success: rules?.success, siteGoalsPresent: Object.hasOwn(rules?.settings || {}, 'siteGoals') });
  return { isProtected: response.snapshot?.protection?.isProtected,
    goalMinutes: Object.hasOwn(goals, hostname) ? goals[hostname] : null };
}

export function buildIntegratedSitesRegistrationCandidateControl(themeId) {
  const theme = assertCanonicalThemeId(themeId, 'QA Sites registration');
  // Zen's ledger add action opens the same composer with the searched domain.
  const action = theme === 'zen' ? '.zen-ledger__add' : '.sites-registry-search-candidate';
  return `document.querySelector('.sites-unified-registry[data-sites-registry-world="${theme}"] ${action}')`;
}

export function selectIntegratedSitesNotebook({ click, hostname }) {
  return click(`Array.from(document.querySelectorAll('button[aria-controls="sites-site-detail"]'))
    .find(node => node.title === ${JSON.stringify(hostname)})`);
}

export async function openIntegratedSitesManagement({ readDom, click, until, hostname }) {
  const read = () => readDom(`(() => {
    const heading = document.querySelector('.sites-notebook-heading');
    const menu = heading?.querySelector('.zen-record-management');
    return { themeId: document.documentElement.getAttribute('data-theme'),
      bootShellPresent: Boolean(document.getElementById('entropy-dashboard-boot-shell')),
      mode: document.querySelector('.sites-sites-workspace')?.dataset.mode,
      domain: heading?.querySelector('h2')?.textContent,
      present: Boolean(menu), open: menu?.open === true };
  })()`);
  const currentNotebook = state => state?.bootShellPresent === false
    && state.mode === 'notebook' && state.domain === hostname
    && (state.themeId !== 'zen' || state.present === true);
  const state = await until('sites_management_ready', read, currentNotebook, 45_000);
  const themeId = assertCanonicalThemeId(state.themeId, 'QA Sites management');
  if (themeId !== 'zen' || state.open === true) return state;
  // The existing trusted click checks visibility, hit testing and boot admission.
  // Reading a closed details subtree does not make its controls actionable.
  await click("document.querySelector('.sites-notebook-heading .zen-record-management > summary')");
  return until('sites_management_open', read, next => currentNotebook(next)
    && next.themeId === themeId && next.open === true, 45_000);
}

export function readIntegratedSitesNotebookUi(readDom) {
  return readDom(`(() => ({
    themeId: document.documentElement.getAttribute('data-theme'),
    bootShellPresent: Boolean(document.getElementById('entropy-dashboard-boot-shell')),
    admission: document.querySelector('#sites-tab')?.dataset.sitesSnapshotAdmission,
    mode: document.querySelector('.sites-sites-workspace')?.dataset.mode,
    domain: document.querySelector('.sites-notebook-heading h2')?.textContent,
    detailDomain: document.querySelector('#sites-site-detail-heading')?.textContent,
    detailLoading: Boolean(document.querySelector('#sites-site-detail .site-intel__query')),
    recordingScope: document.querySelector('.sites-unified-registry')?.dataset.recordingScope,
    recording: document.querySelector('.sites-site-policy-header')?.dataset.recording,
    capDomain: document.querySelector('.sites-site-cap-note [data-site-cap]')?.dataset.domain,
    capAdmission: document.querySelector('.sites-site-cap-note [data-site-cap]')?.dataset.capAdmission,
    capText: document.querySelector('.sites-site-cap-note .sites-cap-readout__value > span')?.textContent,
    capUnavailable: Boolean(document.querySelector('.sites-site-cap-note .sites-cap-readout__value small')),
    capEditing: Boolean(document.querySelector('.sites-site-cap-note form')),
    composers: document.querySelectorAll('.sites-registry-composer').length,
    errors: Array.from(document.querySelectorAll('#sites-tab [role="alert"]')).map(node => node.textContent),
    readOwnerError: document.querySelector('[data-sites-read-error-code]')?.dataset,
    commandReceipts: Array.from(document.querySelectorAll('[data-settings-command-status]')).map(node => ({
      status: node.dataset.settingsCommandStatus, commandId: node.dataset.settingsCommandId,
      commitVersion: node.dataset.settingsCommandCommitVersion, taskId: node.dataset.settingsCommandTaskId }))
  }))()`);
}

export function matchesIntegratedSitesNotebook(state, { hostname, goalMinutes, recordingPolicy, themeId }) {
  const ui = state?.ui;
  return Boolean(typeof hostname === 'string' && hostname.length > 0
    && Number.isSafeInteger(goalMinutes) && goalMinutes > 0
    && recordingPolicy?.dataCollectionMode === 'protected_sites' && recordingPolicy.insightsConsent === 'protected_only'
    && typeof themeId === 'string' && ui?.themeId === themeId
    && ui.bootShellPresent === false && ui.admission === 'ready' && ui.mode === 'notebook'
    && ui.domain === hostname && ui.detailDomain === hostname && ui.detailLoading === false
    && ui.recordingScope === 'protected_sites' && (themeId === 'zen' || ui.recording === 'true')
    && ui.capDomain === hostname && ui.capAdmission === 'ready'
    && ui.capUnavailable === false && ui.capEditing === false && ui.composers === 0
    && Number(ui.capText?.match(/\d+/)?.[0]) === goalMinutes
    && Array.isArray(ui.errors) && ui.errors.length === 0
    && Array.isArray(ui.commandReceipts) && ui.commandReceipts.length === 0
    && state.registration?.isProtected === true && state.registration.goalMinutes === goalMinutes
    && isDeepStrictEqual(state.settings, recordingPolicy));
}

export function requireIntegratedResetReentryProof(proof) {
  const handoff = normalizeProfileMutationResponseHandoff(proof.response?.profileMutationHandoff);
  const generation = requireIntegratedCompletedProfileGeneration(proof.journal, 'full_reset');
  requireProof(proof.response?.success === true && handoff.operation === 'full_reset'
    && handoff.resetId === generation && isDeepStrictEqual(proof.journal, proof.committedJournal),
  'RESET_REENTRY_SAME_COMMIT_REQUIRED', proof);
  requireProof(typeof proof.previousWorkerId === 'string' && proof.previousWorkerId.length > 0
    && proof.workerId === proof.previousWorkerId, 'RESET_REENTRY_SAME_WORKER_REQUIRED', proof);
  requireProof(proof.readiness?.success === false
    && proof.readiness.error === 'PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED'
    && proof.readiness.profileGeneration === generation && Object.keys(proof.readiness).length === 3,
  'RESET_REENTRY_CLOSED_ADMISSION_REQUIRED', proof);
  requireProof(proof.ui?.recovery === 'profile' && proof.ui.bootShellPresent === false
    && proof.ui.lifecycleCode === 'full_reset:complete' && proof.ui.inputCount === 0
    && proof.ui.confirmationCount === 0 && proof.ui.buttonCount === 1
    && Array.isArray(proof.ui.errors) && proof.ui.errors.length === 0
    && isIntegratedControlReady(proof.control), 'RESET_REENTRY_HANDOFF_ONLY_REQUIRED', proof);
  return handoff;
}

export async function retireIntegratedLogLockDocuments({ pages, diagnostics, archive, closePage }) {
  const ids = ['dashboard_fresh_defaults', 'dashboard', 'popup'];
  requireProof(typeof archive === 'function' && typeof closePage === 'function'
    && ids.every(id => typeof pages[id]?.targetId === 'string'
      && typeof diagnostics[id]?.snapshot === 'function' && typeof diagnostics[id]?.dispose === 'function'),
  'LOG_LOCK_DOCUMENT_OWNER_REQUIRED');
  for (const id of ids) {
    await archive(`${id}_before_log_lock_reload`, await diagnostics[id].snapshot());
    diagnostics[id].dispose();
    await closePage(pages[id]);
    delete diagnostics[id];
    delete pages[id];
  }
  return { retiredDocumentCount: ids.length };
}

export async function openIntegratedPopupForActiveContent({
  content, hostname, activateContent, openPopup, readContextDomain, until, observeContext,
}) {
  await activateContent(content);
  const popup = await openPopup(content);
  // Popup binds the actual active tab before its first visible snapshot. Keep
  // content active until tabs.query has rendered the expected domain.
  const contextDomain = await until('popup_context_bound', () => readContextDomain(popup), value => value === hostname);
  const receipt = { contextDomain, sourceTabId: content.tabId };
  await observeContext(receipt);
  return receipt;
}

export async function verifyIntegratedLockedProtectionRevival({
  send, vaultStep, retireDocuments, observePhase, reload, extensionId,
  readSettings, readPortable, proveProtection, passphrase, backupPassphrase,
}) {
  requireProof(typeof vaultStep === 'function', 'LOG_LOCK_DASHBOARD_OWNER_REQUIRED');
  requireProof(typeof retireDocuments === 'function' && typeof observePhase === 'function', 'LOG_LOCK_LIFECYCLE_OWNER_REQUIRED');
  const phase = async (name, operation) => {
    await observePhase({ phase: name, status: 'started' });
    try {
      const value = await operation();
      await observePhase({ phase: name, status: 'complete' });
      return value;
    } catch (error) {
      const code = error?.message === 'Session with given id not found.' ? 'CDP_SESSION_RETIRED'
        : error?.message?.startsWith('CDP_COMMAND_TIMEOUT:') ? 'CDP_COMMAND_TIMEOUT'
          : error?.message === 'QA_SECURITY_VAULT_LOG_LOCK_STEP_FAILED' ? 'QA_SECURITY_VAULT_LOG_LOCK_STEP_FAILED'
            : 'QA_INTEGRATED_PROTECTION_OPERATION_FAILED';
      const diagnostic = { phase: name, code };
      const action = { enable: MESSAGE_ACTIONS.SETUP_SECURITY_VAULT,
        locked_status: MESSAGE_ACTIONS.GET_SECURITY_VAULT_STATUS, unlock: MESSAGE_ACTIONS.UNLOCK_SECURITY_VAULT }[name];
      if (action) diagnostic.action = action;
      await observePhase({ ...diagnostic, status: 'failed' });
      const failure = new Error('QA_INTEGRATED_PROTECTION_LOG_LOCK_PHASE_FAILED');
      failure.diagnostic = diagnostic;
      throw failure;
    }
  };
  const beforeSettings = await phase('before_settings', readSettings);
  const before = await phase('before_portable', readPortable);
  const enablePreparation = await phase('enable', () => vaultStep({ step: 'enable', passphrase }));
  const enabled = requireQaSecurityVaultStatus({ success: true, status: enablePreparation.status });
  requireProof(enabled.state === 'unlocked' && enabled.mode === 'passphrase'
    && enabled.lockScope === 'logs' && enabled.protectionReady === true, 'LOG_LOCK_ENABLE_REQUIRED');
  const retiredDocuments = await phase('retire_documents', retireDocuments);
  const reloaded = await phase('reload', reload);
  requireProof(reloaded?.extensionId === extensionId && reloaded.installMode === 'chrome_developer_private_reload'
    && typeof reloaded.previousWorkerId === 'string' && reloaded.previousWorkerId.length > 0
    && typeof reloaded.workerId === 'string' && reloaded.workerId.length > 0
    && reloaded.workerId !== reloaded.previousWorkerId, 'LOG_LOCK_RELOAD_IDENTITY_REQUIRED');
  const lockedPreparation = await phase('locked_status', () => vaultStep({ step: 'observe_locked' }));
  const locked = requireQaSecurityVaultStatus({ success: true, status: lockedPreparation.status });
  requireProof(locked.state === 'locked' && locked.mode === 'passphrase'
    && locked.lockScope === 'logs' && locked.protectionReady === true, 'LOG_LOCK_RELOAD_REQUIRED');
  requireProof(isDeepStrictEqual(await phase('locked_settings', readSettings), beforeSettings), 'LOG_LOCK_SETTINGS_CHANGED');
  const denied = await phase('locked_export', () => send({ action: MESSAGE_ACTIONS.EXPORT_STORAGE_SNAPSHOT, backupPassphrase }));
  requireProof(denied?.success === false && denied.error === 'SECURITY_VAULT_LOCKED'
    && Object.keys(denied).length === 2, 'LOG_LOCK_EXPORT_REJECTION_REQUIRED');
  const protection = await phase('current_protection', proveProtection);
  requireProof(protection?.dashboardReady === true && matchesIntegratedContentState(protection.runtime, true)
    && protection.seek?.verdict?.blocked === true && protection.seek.verdict.allowed === false,
  'LOG_LOCK_PROTECTION_REQUIRED');
  // The actual protected content and Dashboard must have worked before this
  // unlock. A settings read or stale pre-reload content snapshot is insufficient.
  const unlockPreparation = await phase('unlock', () => vaultStep({ step: 'unlock', passphrase }));
  const unlocked = requireQaSecurityVaultStatus({ success: true, status: unlockPreparation.status });
  requireProof(unlocked.state === 'unlocked' && unlocked.mode === 'passphrase'
    && unlocked.lockScope === 'logs' && unlocked.protectionReady === true, 'LOG_LOCK_UNLOCK_REQUIRED');
  const after = await phase('after_portable', readPortable);
  requireProof(isDeepStrictEqual(before?.local?.keyring, after?.local?.keyring)
    && before?.local?.keyring !== undefined, 'LOG_LOCK_KEYRING_CHANGED');
  requireProof(Array.isArray(before?.indexedDb?.logs) && Array.isArray(after?.indexedDb?.logs)
    && isDeepStrictEqual(after.indexedDb.logs.slice(0, before.indexedDb.logs.length), before.indexedDb.logs),
  'LOG_LOCK_ENCRYPTED_LOG_PREFIX_CHANGED');
  return { reload: reloaded, retiredDocuments, lockScope: locked.lockScope, protectionReady: locked.protectionReady,
    vaultPreparation: { enable: enablePreparation.protection, locked: lockedPreparation.protection,
      unlock: unlockPreparation.protection },
    settingsReadableWhileLocked: true, lockedExportRejected: true, protection,
    sameKeyring: true, originalEncryptedLogsUnchanged: true, originalEncryptedLogCount: before.indexedDb.logs.length };
}

export async function prepareIntegratedFeatureAccess(send, profileGeneration) {
  const response = await send({ action: PROGRESSION_DEBUG_ACTIONS.SET_UNLOCK_DAY,
    dayCount: PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT, profileGeneration });
  requireIntegratedProgressionGeneration(response, profileGeneration);
  const snapshot = response?.snapshot;
  const unlock = snapshot?.unlockProgress;
  requireProof(response?.success === true && unlock?.source === 'debug_override'
    && unlock.debugOverrideActive === true
    && unlock.qualifiedUseDayCount === PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT
    && unlock.bonsaiRelease?.qualifiedUseDayCount === PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT
    && isDeepStrictEqual(snapshot.disclosedFamilyIds, ARTIFACT_DISCLOSURE_FAMILY_ORDER),
  'FEATURE_ACCESS_PREPARATION', { error: response?.error });
  return { source: unlock.source, dayCount: unlock.qualifiedUseDayCount,
    disclosedFamilyIds: snapshot.disclosedFamilyIds, canonicalWrites: false };
}

export async function completeIntegratedFirstUseOffPolicy({
  label, until, readUi, click, readPolicy, readSitesControl, capture,
  observePolicyInvalidation = async () => {}, afterCommit, firstSite, openEntry,
}) {
  requireProof(afterCommit === undefined || typeof afterCommit === 'function', 'FIRST_USE_AFTER_COMMIT_INVALID');
  requireProof(typeof openEntry === 'function', 'FIRST_USE_ENTRY_OWNER_REQUIRED');
  requireProof(firstSite === undefined || (typeof firstSite?.prepare === 'function'
    && typeof firstSite.read === 'function'), 'FIRST_USE_REGISTRATION_OWNER_REQUIRED');
  const committed = state => matchesIntegratedFirstUseCommittedPolicy(state)
    && (firstSite === undefined || state.registration?.isProtected === true
      && state.registration.goalMinutes === null);
  const beforePolicy = await readPolicy();
  requireProof(beforePolicy.insightsConsent === 'unset', 'FIRST_USE_UNSET_REQUIRED', { label, beforePolicy });
  const entry = await openEntry();
  const initial = await until(`first_use_main:${label}`, readUi,
    ui => !ui.setupPresent && !ui.bootShellPresent && !ui.busy && ui.firstUsePresent
      && ui.recordingPresent && ui.recordingChecked === false
      && Array.isArray(ui.errors) && ui.errors.length === 0
      && isIntegratedControlReady(ui.primaryControl), 45_000);
  let initialChoiceControl = initial.primaryControl;
  if (firstSite) {
    await firstSite.prepare();
    const ready = await until(`first_use_registration_ready:${label}`, readUi,
      ui => ui.firstUsePresent && !ui.setupPresent && !ui.busy && !ui.recordingChecked
        && isIntegratedControlReady(ui.startControl), 45_000);
    initialChoiceControl = ready.startControl;
  }
  const screenshot = await capture();
  await click(firstSite === undefined ? INTEGRATED_FIRST_USE_COMMIT : INTEGRATED_FIRST_USE_START);
  let invalidatedPolicyReads = 0;
  let afterCommitCalled = false;
  const complete = await until(`first_use_committed:${label}`, async () => {
    const ui = await readUi();
    let settings;
    try { settings = await readPolicy(); }
    catch (error) {
      if (error?.code !== 'BOOT_PREWARM_SNAPSHOT_INVALIDATED'
        || error.message !== 'QA_INTEGRATED_PROTECTION_FIRST_USE_POLICY_QUERY') throw error;
      invalidatedPolicyReads += 1;
      const policyRead = { status: 'invalidated', error: error.code, invalidatedPolicyReads };
      await observePolicyInvalidation(policyRead);
      return { ui, policyRead };
    }
    const registration = firstSite === undefined ? undefined : await firstSite.read();
    if (afterCommit && !afterCommitCalled && committed({ ui, settings, registration })) {
      // A protocol may prepare its next actual UI surface only after consent
      // reconciliation. Re-read current policy/UI afterward; this observation
      // cannot certify completion with the pre-navigation snapshot.
      afterCommitCalled = true;
      await afterCommit();
      return { ui, settings, registration };
    }
    return { ui, settings, registration, sites: await readSitesControl() };
  }, state => committed(state) && matchesIntegratedFirstUseComplete(state), 45_000);
  return { beforePolicy, entry, initialChoiceControl, settings: complete.settings,
    mainReady: true, recordingDefaultUnchecked: true, sitesReady: true, invalidatedPolicyReads,
    selection: { method: firstSite === undefined ? 'trusted_browse_pointer' : 'trusted_start_pointer', value: 'off' },
    ...(firstSite === undefined ? {} : { registration: complete.registration }), screenshot };
}

export function integratedSiteReleaseControls(themeId) {
  if (!['matrix', 'entropy', 'cyberpunk', 'clinical', 'scp', 'zen'].includes(themeId)) {
    throw new Error('QA_INTEGRATED_PROTECTION_RELEASE_THEME_INVALID');
  }
  const clearStatus = `!document.querySelector('.sites-notebook-heading [role="status"], .sites-notebook-heading [role="alert"], #sites-site-detail [role="status"], #sites-site-detail [role="alert"]')`;
  const clearNotice = `!document.querySelector('[data-testid="sites-pending-release-notice"]')`;
  const root = '.sites-notebook-heading .zen-site-protection';
  const owner = `${root} .sites-release-control`;
  const query = selector => `document.querySelector(${JSON.stringify(selector)})`;
  const idle = query(`${owner}[data-release-phase="idle"] > button`);
  const grace = query(`${owner}[data-release-phase="grace"] > button`);
  return { request: idle,
    confirm: query(`${owner}[data-release-phase="review"] .sites-inline-review > button:first-of-type`),
    cancel: grace, grace: `Boolean(${grace})`,
    cancelled: `Boolean(${idle} && ${clearStatus})`,
    settled: `Boolean(!${query(owner)} && ${query(`${root} > button[aria-busy="false"]`)} && ${clearStatus} && ${clearNotice})` };
}

const WINDOW_OBSERVATION_ERROR_CODES = new Set([
  'QA_INTEGRATED_WINDOW_OBSERVATION_TARGET_NOT_OWNED',
  'QA_INTEGRATED_WINDOW_OBSERVATION_HELPER_REQUIRED',
  'QA_INTEGRATED_WINDOW_OBSERVATION_TAB_INVALID',
  'QA_INTEGRATED_WINDOW_OBSERVATION_ACTIVE_TAB_INVALID',
  'QA_INTEGRATED_WINDOW_OBSERVATION_DOCUMENT_INVALID',
  'QA_OWNED_WINDOW_OBSERVATION_PROCESS_NOT_OWNED',
  'QA_OWNED_WINDOW_OBSERVATION_TABS_INVALID',
  'QA_OWNED_WINDOW_OBSERVATION_IDENTITY_INVALID',
  'QA_OWNED_WINDOW_OBSERVATION_TARGET_WINDOW_MISMATCH',
  'QA_OWNED_WINDOW_OBSERVATION_FOREGROUND_RECEIPT_INVALID',
  'QA_OPERATOR_BROWSER_TARGET_WINDOW_RECEIPT_INVALID',
  'QA_CHROMIUM_ENDPOINT_IDENTITY_MISMATCH',
  'QA_CHROMIUM_PROCESS_NOT_OWNED',
  'CHROMIUM_HARNESS_TAB_RESOLVE_FAILED',
  'WEBSOCKET_CLOSED', 'WEBSOCKET_NOT_OPEN', 'CDP_COMMAND_TIMEOUT',
]);

export function integratedWindowObservationErrorCode(error) {
  const candidate = typeof error?.code === 'string' ? error.code
    : typeof error?.message === 'string' ? error.message.split(':', 1)[0] : '';
  return WINDOW_OBSERVATION_ERROR_CODES.has(candidate) ? candidate : 'unclassified_observation_error';
}

// Failure attribution is a single read before screenshots, never another
// activation/focus attempt. The already admitted helper must still exist.
export async function observeIntegratedFailureWindows({ harness, pages, recoveryJournal,
  readWindows = observeQaOwnedBrowserWindows,
  readDocument = page => evaluate(harness.cdp, page.sessionId,
    '({ hidden: document.hidden, visibilityState: document.visibilityState, readyState: document.readyState, hasFocus: document.hasFocus() })',
    { timeoutMs: 2_000, commandTimeoutMs: 2_000 }),
}) {
  const entries = Object.entries(pages);
  const journal = recoveryJournal?.readSnapshot();
  const epoch = harness.targetLease?.browserEpoch;
  if (entries.length < 1 || journal?.state !== 'active'
    || journal.browser?.processOwnership !== 'owned' || journal.browser.browserEpoch !== epoch
    || entries.some(([, page]) => {
      const owned = harness.pageTargets.get(page.targetId);
      return !owned || owned.sessionId !== page.sessionId || owned.tabId !== page.tabId
        || !harness.targetLease.owns(page.targetId)
        || !journal.targets.some(target => target.state === 'admitted'
          && target.purpose === 'scenario_page' && target.browserEpoch === epoch
          && target.targetId === page.targetId && target.tabId === page.tabId);
    })) {
    throw new Error('QA_INTEGRATED_WINDOW_OBSERVATION_TARGET_NOT_OWNED');
  }
  if (!harness.trustedPageTarget || !harness.targetLease.owns(harness.trustedPageTarget.targetId)
    || !journal.targets.some(target => target.state === 'admitted' && target.purpose === 'trusted_page'
      && target.browserEpoch === epoch && target.targetId === harness.trustedPageTarget.targetId)) {
    throw new Error('QA_INTEGRATED_WINDOW_OBSERVATION_HELPER_REQUIRED');
  }
  const tabs = await Promise.all(entries.map(async ([id, page]) => {
    const tab = await harness.resolveTabForPage(page);
    if (tab?.id !== page.tabId || !Number.isSafeInteger(tab.windowId) || tab.windowId <= 0
      || typeof tab.active !== 'boolean') {
      throw new Error('QA_INTEGRATED_WINDOW_OBSERVATION_TAB_INVALID');
    }
    return { id, page, tab };
  }));
  const windowIds = [...new Set(tabs.map(({ tab }) => tab.windowId))];
  const activeTabs = await harness.evaluateInTrustedPage(`Promise.all(
    ${JSON.stringify(windowIds)}.map(windowId => new Promise(resolve => {
      chrome.tabs.query({ active: true, windowId }, tabs => resolve({
        windowId, error: Boolean(chrome.runtime.lastError),
        tabs: tabs?.map(tab => ({ id: tab.id, windowId: tab.windowId, active: tab.active }))
      }));
    })))`, { timeoutMs: 2_000, commandTimeoutMs: 2_000 });
  if (!Array.isArray(activeTabs) || activeTabs.length !== windowIds.length
    || activeTabs.some((entry, index) => entry?.windowId !== windowIds[index]
      || entry.error !== false || !Array.isArray(entry.tabs) || entry.tabs.length !== 1
      || !Number.isSafeInteger(entry.tabs[0]?.id) || entry.tabs[0].id < 0
      || entry.tabs[0].windowId !== entry.windowId || entry.tabs[0].active !== true)) {
    throw new Error('QA_INTEGRATED_WINDOW_OBSERVATION_ACTIVE_TAB_INVALID');
  }
  const targetTabs = tabs.map(({ page, tab }) => ({ targetId: page.targetId, tabId: tab.id,
    windowId: tab.windowId, active: tab.active,
    activeTabId: activeTabs.find(entry => entry.windowId === tab.windowId).tabs[0].id }));
  const [browser, documents] = await Promise.all([
    harness.browserExecution?.headless === true
      ? Promise.resolve({ contractVersion: 1, status: 'not_applicable',
        reason: 'headless_no_host_window', targets: targetTabs, focusRequested: false })
      : readWindows({ child: harness.chrome, cdp: harness.cdp, targetTabs,
        expectedOwnerTokenSha256: journal.ownedProcess?.ownerTokenSha256 }),
    Promise.all(tabs.map(async ({ id, page }) => {
      try {
        const value = await readDocument(page);
        if (typeof value?.hidden !== 'boolean' || typeof value.hasFocus !== 'boolean'
          || !['visible', 'hidden'].includes(value.visibilityState)
          || value.hidden !== (value.visibilityState === 'hidden')
          || !['loading', 'interactive', 'complete'].includes(value.readyState)) {
          throw new Error('QA_INTEGRATED_WINDOW_OBSERVATION_DOCUMENT_INVALID');
        }
        return { id, targetId: page.targetId, tabId: page.tabId, status: 'observed',
          hidden: value.hidden, visibilityState: value.visibilityState,
          readyState: value.readyState, hasFocus: value.hasFocus };
      } catch (error) {
        return { id, targetId: page.targetId, tabId: page.tabId, status: 'unavailable',
          code: integratedWindowObservationErrorCode(error) };
      }
    })),
  ]);
  return { contractVersion: 1, status: 'observed', browser, documents,
    observation: 'failure_once_before_capture', focusRequested: false };
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal, requestInitialOwnedWindowPresentation }) {
  requireProof(artifact.id === 'dev_extension' && browser.processOwnership === 'owned'
    && plan.target.environmentId === 'ephemeral', 'OWNED_DEV_REQUIRED');
  requireProof(plan.protocolOptions.progressionPreparation === 'post_consent_development_day_five',
    'PROGRESSION_PREPARATION_CONTRACT_REQUIRED');
  const startedAt = Date.now();
  const reportPath = path.join(attachmentsDir, 'integrated-protection.json');
  const report = { schemaVersion: 1, journey: plan.protocolOptions.journey, theme: plan.parameters.theme,
    browserStarts: 0, steps: INTEGRATED_PROTECTION_STEPS.map(id => ({ id, status: 'NOT_RUN' })),
    observations: [], pageDiagnostics: {}, restoration: { status: 'NOT_RUN' },
    scope: { permission: 'fixture_host_pregranted', popup: 'real_document_in_owned_tab',
      progression: plan.protocolOptions.progressionPreparation,
      excludes: ['native_toolbar_popup_lifetime', 'permission_prompt', 'real_site_adapters',
        'foreground_consumption', 'dashboard_boot_performance',
        'artifact_failure_injection', 'idle_tab_close_deadline',
        'canonical_first_vision_journey', 'earned_progression_days'] } };
  const pages = {};
  const diagnostics = {};
  const writeReport = () => fs.writeFile(reportPath,
    `${JSON.stringify({ ...report, durationMs: Date.now() - startedAt }, null, 2)}\n`, 'utf8');
  registerCleanup('integrated_journey_evidence', async () => {
    await writeReport(); return { reportPath, restoration: report.restoration };
  });
  const fixture = await createNativeVideoSkipFixture();
  registerCleanup('integrated_journey_fixture', fixture.close);
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment,
    displayReceipt: browser.display,
    renderingRequirement: plan.browserExecution.renderingRequirement, keepTemp: false,
    temporaryManifest: { requiredPermissions: ['scripting'], requiredHostPermissions: buildOriginPatternsForDomain(DOMAIN) },
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, tempPrefix: 'entropy-integrated-', recoveryJournal });
  registerCleanup('integrated_journey_browser', () => harness.close());
  await harness.start(); report.browserStarts += 1;
  report.reloadSetup = await harness.prepareDisposableExtensionReload();
  await reportBrowserGpuCapability(harness.gpuCapability);
  const send = request => sendTrustedRuntimeMessage(harness, request);
  // Only portable backups require a per-run password. Fresh local key admission
  // must not be replaced with a password setup fixture.
  const backupPassphrase = randomBytes(32).toString('base64url');
  const dom = (page, expression) => evaluate(harness.cdp, page.sessionId, expression);
  const activate = page => harness.activateOwnedEphemeralPageWithoutWindowFocus(page);
  registerCleanup('integrated_journey_diagnostics', async () => {
    for (const [id, diagnostic] of Object.entries(diagnostics)) {
      report.pageDiagnostics[id] = await diagnostic.snapshot(); diagnostic.dispose();
    }
    return { pages: Object.keys(diagnostics) };
  });
  async function observe(label, value) {
    report.observations.push({ label, elapsedMs: Date.now() - startedAt, value });
    await evidence.event('QA_INTEGRATED_PROTECTION_OBSERVATION', { label, value });
    return value;
  }
  async function until(label, read, accept, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    let value;
    do {
      signal?.throwIfAborted(); value = await read();
      if (accept(value)) return value;
      await sleep(100);
    } while (Date.now() < deadline);
    requireProof(false, `TIMEOUT:${label}`, value);
  }
  async function step(id, run) {
    const entry = report.steps.find(item => item.id === id);
    const start = Date.now(); entry.status = 'RUNNING';
    console.log(JSON.stringify({ event: 'QA_INTEGRATED_PROTECTION_STEP_STARTED', id }));
    try { entry.result = await run(); entry.status = 'PASS'; }
    catch (error) {
      entry.status = 'FAIL'; entry.error = { message: error.message, diagnostic: error.diagnostic };
      throw error;
    } finally {
      entry.durationMs = Date.now() - start;
      await writeReport();
      await evidence.event('QA_INTEGRATED_PROTECTION_STEP_FINISHED', entry);
      console.log(JSON.stringify({ event: 'QA_INTEGRATED_PROTECTION_STEP_FINISHED', id, status: entry.status }));
    }
    return entry.result;
  }
  async function open(id, url, active = false, sameWindowAs = null) {
    const page = await harness.openPage('about:blank', { active, sameWindowAs }); pages[id] = page;
    const diagnostic = createDashboardPageDiagnostics({ cdp: harness.cdp, sessionId: page.sessionId });
    diagnostics[id] = diagnostic; await diagnostic.enable();
    await harness.cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
    }, page.sessionId);
    if (url !== 'about:blank') {
      diagnostic.markNavigationRequested();
      await harness.navigatePage(page, url);
    }
    return page;
  }
  async function screenshot(page, name) {
    const capture = await harness.cdp.send('Page.captureScreenshot', { format: 'png' }, page.sessionId);
    const file = `${name}.png`;
    await fs.writeFile(path.join(attachmentsDir, file), Buffer.from(capture.data, 'base64'));
    return file;
  }
  async function captureFailure(error) {
    await observe('failure', { message: error.message, diagnostic: error.diagnostic });
    try {
      await observe('failure_window_attribution', await observeIntegratedFailureWindows({
        harness, pages, recoveryJournal,
      }));
    } catch (observationError) {
      await observe('failure_window_attribution', { contractVersion: 1, status: 'unavailable',
        code: integratedWindowObservationErrorCode(observationError), focusRequested: false });
    }
    for (const [id, page] of Object.entries(pages)) {
      try {
        await observe(`failure_${id}`, { screenshot: await screenshot(page, `failure-${id}`),
          document: await dom(page, '({ url: location.href, text: document.body.innerText.slice(0, 12000) })') });
      } catch (captureError) { await observe(`failure_${id}_capture`, { error: captureError.message }); }
    }
  }
  async function controlState(page, expression, scroll = false) {
    return dom(page, `(() => {
      const node = (${expression});
      const describe = item => item ? { tag: item.tagName, id: item.id.slice(0, 128),
        class: (item.getAttribute('class') || '').slice(0, 256),
        role: item.getAttribute('role')?.slice(0, 64), label: item.getAttribute('aria-label')?.slice(0, 160),
        labelledBy: item.getAttribute('aria-labelledby')?.slice(0, 128),
        profileRecovery: item.getAttribute('data-dashboard-profile-recovery')?.slice(0, 64),
        bootRecovery: item.getAttribute('data-dashboard-boot-recovery')?.slice(0, 64) } : null;
      const state = { requestedControl: ${JSON.stringify(expression)}, present: Boolean(node),
        bootShellPresent: Boolean(document.getElementById('entropy-dashboard-boot-shell')),
        visibilityState: document.visibilityState, activeElement: describe(document.activeElement) };
      if (!node) return state;
      if (${scroll}) node.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = node.getBoundingClientRect(), style = getComputedStyle(node);
      const point = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      const hitTarget = document.elementFromPoint(point.x, point.y);
      const hitAncestors = [];
      for (let item = hitTarget; item && hitAncestors.length < 6; item = item.parentElement) {
        const hitStyle = getComputedStyle(item);
        hitAncestors.push({ ...describe(item), pointerEvents: hitStyle.pointerEvents,
          position: hitStyle.position, zIndex: hitStyle.zIndex });
      }
      return { ...state, point, rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        inert: Boolean(node.closest('[inert]')),
        disabled: node.disabled === true || node.getAttribute('aria-disabled') === 'true',
        visible: r.width > 0 && r.height > 0 && style.visibility === 'visible' && Number(style.opacity) > 0,
        hit: hitTarget !== null && node.contains(hitTarget), hitTarget: describe(hitTarget), hitAncestors,
        focused: document.activeElement === node, value: 'value' in node ? node.value : null };
    })()`);
  }
  async function click(page, expression) {
    // Dashboard controls exist while the boot shell still gates interaction.
    // Admit trusted pointer input only at an unobstructed hit-tested position.
    const state = await until('clickable', () => controlState(page, expression, true), isIntegratedControlReady);
    await pointer(page, state.point);
  }
  const presentSites = page => presentIntegratedSitesWorkspace({ until, click,
    readPresentation: ownedPage => readIntegratedDashboardPresentation(expression => dom(ownedPage, expression)),
  }, page);
  async function pointer(page, { x, y }) {
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, page.sessionId);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await harness.cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left',
        buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 }, page.sessionId);
    }
  }
  async function settings(items) {
    return requireConsumptionQaSettingsAcknowledgement(await send({
      action: MESSAGE_ACTIONS.SET_SETTINGS, items, waitForPropagation: true,
    }), items);
  }
  async function readFirstUsePolicy() {
    return readIntegratedFirstUsePolicy(send);
  }
  async function readFirstUseUi(page) {
    return readIntegratedFirstUseUi({ readDom: expression => dom(page, expression),
      readControl: expression => controlState(page, expression) });
  }
  async function firstUseOffPolicy(page, label, captureName, { registerFirstSite = false } = {}) {
    let featureAccess;
    const firstUse = await completeIntegratedFirstUseOffPolicy({ label, until,
      readUi: () => readFirstUseUi(page), click: expression => click(page, expression),
      readPolicy: readFirstUsePolicy,
      openEntry: () => openIntegratedFirstUseRegistration({ label, until,
        click: expression => click(page, expression), readPolicy: readFirstUsePolicy,
        readRules: () => readIntegratedRestorationRuleMembership(send),
        readDayZero: async () => readIntegratedDayZeroDisclosure(send, await currentProfileGeneration()),
        capture: () => screenshot(page, `${captureName}-day-zero-entry`),
        readEntry: () => readIntegratedFirstUseEntry({ themeId: plan.parameters.theme,
          readDom: expression => dom(page, expression), readControl: expression => controlState(page, expression) }),
      }),
      ...(registerFirstSite ? { firstSite: {
        prepare: async () => {
          const input = "document.querySelector('#zen-invitation-koi-domain')";
          await until('first_site_domain_input', () => controlState(page, input), isIntegratedControlReady, 45_000);
          await click(page, input);
          await harness.cdp.send('Input.insertText', { text: DOMAIN }, page.sessionId);
          await until('first_site_domain_value', () => controlState(page, input),
            value => isIntegratedControlReady(value) && value.focused === true && value.value === DOMAIN);
          requireProof(await dom(page, `!document.querySelector('#zen-invitation-koi-goal')
            && !document.querySelector('#zen-invitation-koi-goal-slider')`), 'FIRST_SITE_NO_IMPLICIT_TIME_GOAL');
        },
        read: () => readIntegratedFirstSiteRegistration(send, { pageUrl: fixture.url, hostname: DOMAIN }),
      } } : {}),
      afterCommit: async () => {
        // Feature coverage starts only after real consent reconciliation. The
        // declared development projection neither earns days nor spends First Vision.
    featureAccess = await prepareIntegratedFeatureAccess(send, await currentProfileGeneration());
        await observe('feature_access_prepared', { label, ...featureAccess });
        await harness.reloadPage(page);
        await presentSites(page);
      },
      observePolicyInvalidation: sample => observe('first_use_policy_invalidated', { label, ...sample }),
      readSitesControl: () => controlState(page, "document.querySelector('.sites-unified-registry input[type=\"search\"]')"),
      capture: async () => {
        const ready = await until(`first_use_editor_visual_settled:${label}`, () => dom(page, `(() => {
          const editor = document.querySelector('[data-first-site-registration-editor][data-main-first-use-registration]');
          if (!editor) return null;
          const style = getComputedStyle(editor), rect = editor.getBoundingClientRect();
          return { connected: editor.isConnected, opacity: Number(style.opacity),
            visible: !document.hidden && style.visibility === 'visible' && rect.width > 0 && rect.height > 0,
            animations: editor.getAnimations().map(animation => ({ name: animation.animationName,
              pending: animation.pending, playState: animation.playState })) };
        })()`), state => state?.connected === true && state.visible === true && state.opacity === 1
          && state.animations.every(animation => !animation.pending
            && (animation.playState === 'finished' || animation.playState === 'idle')), 10_000);
        await observe('first_use_editor_capture_ready', { label, ...ready });
        return screenshot(page, captureName);
      },
    });
    return { ...firstUse, featureAccess };
  }
  async function readFreshDefaults() {
    const reply = await send({ action: MESSAGE_ACTIONS.GET_BOOT_PREWARM_SNAPSHOT, force: true,
      reason: 'integrated_settings_defaults' });
    requireProof(reply?.success === true, 'FRESH_DEFAULTS_QUERY', { error: reply?.error });
    const snapshot = requireBootPrewarmDashboardSnapshot(reply.snapshot);
    requireProof(matchesIntegratedFreshProtocolDefaults(snapshot.protocol)
      && snapshot.preference.themeId === DEFAULT_THEME_ID, 'FRESH_DEFAULTS_MISMATCH');
    return { schemaVersion: snapshot.schemaVersion, theme: snapshot.preference.themeId,
      checkedProtocolKeys: Object.keys(INTEGRATED_FRESH_PROTOCOL_DEFAULTS), matched: true };
  }
  const ensureVaultReady = async () => {
    const receipt = await ensureQaSecurityVaultReady(harness);
    requireProof(receipt.state === 'unlocked' && receipt.mode === 'local'
      && receipt.operation === 'already_unlocked', 'LOCAL_AUTOMATIC_VAULT_REQUIRED');
    await observe('security_vault_ready', receipt);
    return receipt;
  };
  async function prepareCanonicalFirstUse(label) {
    return observe('canonical_first_use_prepared', { label,
      ...await prepareIntegratedCanonicalDayZero(send, await currentProfileGeneration()) });
  }
  async function exportPortableSnapshot() {
    return requireIntegratedPortableSnapshot(await send({ action: MESSAGE_ACTIONS.EXPORT_STORAGE_SNAPSHOT,
      backupPassphrase }));
  }
  async function profileReadiness(profileGeneration) {
    const reply = await send({ action: MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS, profileGeneration });
    requireProof(reply?.success === true && reply.profileGeneration === profileGeneration,
      'PROFILE_GENERATION_HEALTH', { error: reply?.error, profileGeneration });
    return { profileGeneration, ready: true };
  }
  async function lifecycleJournal() {
    return harness.evaluateInTrustedPage(`chrome.storage.local.get(${JSON.stringify(PROFILE_RESET_LIFECYCLE_STORAGE_KEY)})
      .then(items => ({ present: Object.hasOwn(items, ${JSON.stringify(PROFILE_RESET_LIFECYCLE_STORAGE_KEY)}),
        value: items[${JSON.stringify(PROFILE_RESET_LIFECYCLE_STORAGE_KEY)}] ?? null }))`);
  }
  async function currentProfileGeneration() {
    const journal = await lifecycleJournal();
    requireProof(typeof journal?.present === 'boolean', 'PROGRESSION_PROFILE_LIFECYCLE_REQUIRED');
    const lifecycle = journal.present ? journal.value : null;
    requireProof(!isProfileResetWriteAdmissionClosed(lifecycle), 'PROGRESSION_PROFILE_LIFECYCLE_CLOSED');
    return resolveProfileResetGeneration(lifecycle);
  }
  const filters = Object.fromEntries(Object.entries(structuredClone(CONFIG_DEFAULT_FILTER_SETTINGS))
    .map(([key, value]) => [key, { ...value, isActive: key === 'fullscreenVisualRelaxation' || key === 'videoSkipGuard' }]));
  filters.videoSkipGuard.value = { mode: 'hard_block' };
  const configuration = { 'app-theme': plan.parameters.theme, filteringMode: 'blocklist',
    rulesMode: 'managed', permissionMode: 'selective', filterSettings: filters,
    ...structuredClone(INTEGRATED_FIRST_USE_OFF_POLICY),
    historyCleanupForBlocked: false, concealBlockedBookmarks: false,
    tabEvaporationForBlocked: false, tabEvaporationTimeoutMinutes: 5,
    nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS), gateConfig: structuredClone(DEFAULT_GATE_CONFIG) };
  const keys = [...Object.keys(configuration), 'blockedUrls', 'allowedUrls'];
  async function readSettings() {
    const reply = await send({ action: MESSAGE_ACTIONS.GET_SETTINGS, keys,
      defaults: { 'app-theme': DEFAULT_THEME_ID, blockedUrls: [], allowedUrls: [] } });
    if (!reply?.success || !keys.every(key => Object.hasOwn(reply.settings, key))) {
      await observe('settings_read_failed', { requestedKeys: keys, reply });
    }
    requireProof(reply?.success && keys.every(key => Object.hasOwn(reply.settings, key)), 'SETTINGS_READ', reply);
    return reply.settings;
  }
  // A new disposable profile has no persisted settings yet. Prepare a declared
  // canonical baseline, then restore that baseline after the journey. The entire
  // profile is deleted by the harness; no personal/original profile is borrowed.
  const baselineConfiguration = { ...configuration, filterSettings: {
    ...filters, videoSkipGuard: { ...filters.videoSkipGuard, isActive: false },
  } };
  try {
    await step('fresh_profile_defaults', async () => {
      // Keep the one owned scenario/window preparation, but defer application
      // execution until automatic local admission and canonical Day 0 are proved.
      const dashboard = await open('dashboard_fresh_defaults', 'about:blank', true);
      await activate(dashboard);
      if (plan.protocolOptions.initialWindowPresentation === 'windows_agent_present_once'
        && plan.browserExecution.presentation === 'foreground'
        && plan.parameters.allowInitialWindowFocusOnce === true) {
        requireProof(typeof requestInitialOwnedWindowPresentation === 'function', 'INITIAL_WINDOW_PRESENTATION_OWNER_REQUIRED');
        await observe('initial_window_presentation', await requestInitialOwnedWindowPresentation({
          child: harness.chrome, cdp: harness.cdp, targetId: dashboard.targetId, tabId: dashboard.tabId,
        }));
      }
      // The real scenario tab owns the one initial presentation grant. The
      // inactive vault preparation tab must follow that ownership proof.
      const vault = await ensureVaultReady();
      const canonicalPreparation = await prepareCanonicalFirstUse('fresh_profile');
      const defaults = await readFreshDefaults();
      diagnostics.dashboard_fresh_defaults.markNavigationRequested();
      await harness.navigatePage(dashboard,
        `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=sites`);
      const firstUse = await firstUseOffPolicy(dashboard, 'fresh_profile', '00-fresh-profile-first-site-off',
        { registerFirstSite: true });
      // Keep the later unprotected media/Sites baseline. This removes only the
      // loopback rule just registered by the actual first-use Start action.
      const removed = await send({ action: MESSAGE_ACTIONS.REMOVE_SITE_RULE,
        domain: DOMAIN, type: 'blocked', waitForPropagation: true });
      requireProof(removed?.success === true && removed.propagation?.status === 'succeeded',
        'FIRST_SITE_BASELINE_RELEASE_ACK', { error: removed?.error });
      const released = await readIntegratedRestorationRuleMembership(send);
      requireProof(!released.blockedUrls.includes(DOMAIN), 'FIRST_SITE_BASELINE_RELEASE_REQUIRED');
      await until('fresh_default_sites_ready', () => controlState(dashboard,
        "document.querySelector('.sites-unified-registry input[type=\"search\"]')"), isIntegratedControlReady, 45_000);
      return { ...defaults, vault, canonicalPreparation, firstUse, firstSiteBaselineReleased: true,
        screenshot: await screenshot(dashboard, '00-fresh-profile-defaults') };
    });
  } catch (error) { await captureFailure(error); throw error; }
  await settings(baselineConfiguration);
  await observe('fixture_baseline_prepared', { configuration: baselineConfiguration,
    restorationScope: 'prepared_disposable_fixture' });
  const original = await readSettings();
  requireProof(!original.blockedUrls.includes(DOMAIN) && !original.allowedUrls.includes(DOMAIN), 'FRESH_RULE_REQUIRED');
  let restored = false;
  async function restore() {
    if (restored) return report.restoration;
    try {
      const current = await readIntegratedRestorationRuleMembership(send);
      if (current.blockedUrls.includes(DOMAIN)) {
        const result = await send({ action: MESSAGE_ACTIONS.REMOVE_SITE_RULE,
          domain: DOMAIN, type: 'blocked', waitForPropagation: true });
        requireProof(result?.success && result.propagation?.status === 'succeeded', 'RESTORE_RULE_ACK', result);
      }
      await settings(Object.fromEntries(Object.keys(configuration).map(key => [key, original[key]])));
      const after = await readSettings();
      requireProof(isDeepStrictEqual(after, original), 'RESTORE_SETTINGS_MISMATCH', { original, after });
      restored = true; report.restoration = { status: 'PASS', keys, ruleRemoved: DOMAIN };
      return report.restoration;
    } catch (error) { report.restoration = { status: 'FAIL', error: error.message }; throw error; }
  }
  registerCleanup('integrated_journey_settings', restore);
  async function rulePresent(expected) {
    return until('site_rule', readSettings, value => value.blockedUrls.includes(DOMAIN) === expected);
  }
  function artifactChoice(child, value) {
    return buildIntegratedArtifactChoiceContract(child, value).choice;
  }
  async function selectArtifact(family, child) {
    await selectSettingsArtifactGalleryFamily({ until, click,
      readNavigation: page => readSettingsArtifactGalleryNavigation(expression => dom(page, expression)),
    }, pages.dashboard, family);
    await until(`artifact_selected:${family}`, () => dom(pages.dashboard, `Boolean(${artifactRow(child)})`), Boolean);
    await openIntegratedArtifactControl({ until, click, readDom: dom }, pages.dashboard, child);
  }
  async function readArtifactChoice(child, value) {
    return {
      settings: await readSettings(),
      control: await dom(pages.dashboard, buildIntegratedArtifactChoiceContract(child, value).read),
    };
  }
  async function waitArtifactChoice(child, value, expectedItems) {
    return until(`artifact_commit:${child}:${value}`, () => readArtifactChoice(child, value),
      state => matchesIntegratedArtifactSetting(state, expectedItems));
  }
  async function commitArtifactChoice(child, value, expectedItems) {
    await openIntegratedArtifactControl({ until, click, readDom: dom }, pages.dashboard, child);
    await click(pages.dashboard, artifactChoice(child, value));
    return waitArtifactChoice(child, value, expectedItems);
  }
  let contentDocumentIdentity = null;
  async function readContentState() {
      const samples = await harness.evaluateInTrustedPage(`chrome.scripting.executeScript({
        target: { tabId: ${pages.content.tabId}, frameIds: [0] }, world: 'ISOLATED',
        func: () => {
          const bootstrap = globalThis.__entropyContentBootstrapState__;
          const lease = globalThis.__entropyContentBootstrapAttemptLease__;
          const videos = document.querySelectorAll('video[controls]');
          const video = videos[0];
          return {
            runtime: typeof globalThis.__entropyProtectionDiagnosticsSnapshot__ === 'function'
              ? globalThis.__entropyProtectionDiagnosticsSnapshot__() : null,
            mediaVisual: { visibilityState: document.visibilityState,
              rootFilter: getComputedStyle(document.documentElement).filter,
              videoCount: videos.length, video: video ? { source: video.currentSrc,
                readyState: video.readyState, fullscreen: document.fullscreenElement !== null,
                filter: getComputedStyle(video).filter,
                filterEffects: video.getAnimations().filter(animation => animation.effect?.target === video)
                  .map(animation => ({ keyframes: animation.effect.getKeyframes()
                    .filter(frame => typeof frame.filter === 'string')
                    .map(frame => ({ filter: frame.filter, composite: frame.composite })) }))
                  .filter(effect => effect.keyframes.length > 0) } : null },
            url: location.href, receiverInstalled: globalThis.__entropyProtectionRuntimeReceiverInstalled__,
            bootstrap: bootstrap ? { status: bootstrap.status, attemptId: bootstrap.attemptId,
              startedAt: bootstrap.startedAt, reason: bootstrap.reason, dispatchReady: bootstrap.dispatchReady,
              active: bootstrap.active, receiverCapabilityVersion: bootstrap.receiverCapabilityVersion,
              error: bootstrap.error } : null,
            attemptLease: lease ? { attemptId: lease.attemptId, startedAt: lease.startedAt,
              aborted: lease.signal.aborted, revokedAt: lease.revokedAt, revokeReason: lease.revokeReason } : null,
          };
        }
      })`);
      requireProof(Array.isArray(samples) && samples.length === 1 && samples[0].frameId === 0
        && typeof samples[0].documentId === 'string' && samples[0].documentId.length > 0
        && samples[0].documentId === samples[0].documentId.trim(), 'CONTENT_DOCUMENT_INSPECTION');
      const sample = samples[0];
      const probe = await harness.evaluateInTrustedPage(`chrome.tabs.sendMessage(${pages.content.tabId},
        ${JSON.stringify({ type: MESSAGE_TYPES.CONTENT_RUNTIME_PROBE })},
        ${JSON.stringify({ frameId: 0, documentId: sample.documentId })})`);
      requireProof(probe?.ok === true && probe.type === MESSAGE_TYPES.CONTENT_RUNTIME_PROBE
        && probe.buildId === artifact.buildId && probe.state?.url === sample.result.url,
        'CONTENT_DOCUMENT_PROBE', { documentId: sample.documentId, error: probe?.error });
      if (contentDocumentIdentity !== null) requireProof(sample.documentId === contentDocumentIdentity.documentId
        && sample.result.url === contentDocumentIdentity.url, 'CONTENT_DOCUMENT_CHANGED');
      const ownership = await dom(pages.content, `({
        count: document.querySelectorAll('video[controls][data-friction-video-skip-native-owner="1"]').length,
        lock: document.documentElement.getAttribute('data-friction-video-skip-timeline-lock')
      })`);
      const { runtime, mediaVisual, ...inspection } = sample.result;
      return { runtime, ownership, mediaVisual, documentProof: { ...inspection,
        frameId: sample.frameId, documentId: sample.documentId, probe,
        expectedIdentity: contentDocumentIdentity } };
  }
  async function contentState(enabled, { previousDocumentId = null } = {}) {
    const settled = await until('content_state', readContentState,
      state => matchesIntegratedContentState(state, enabled)
        && (previousDocumentId === null || state.documentProof.documentId !== previousDocumentId));
    if (enabled) {
      requireProof(settled.documentProof.probe.state.receiverCapabilityVersion === CONTENT_RECEIVER_CAPABILITY_VERSION
        && ['receiver_ready', 'active'].includes(settled.documentProof.probe.state.status)
        && settled.documentProof.probe.state.dispatchReady === true, 'CONTENT_PROTECTED_RECEIVER');
      contentDocumentIdentity = { documentId: settled.documentProof.documentId, url: settled.documentProof.url,
        buildId: settled.documentProof.probe.buildId, attemptId: settled.documentProof.probe.state.attemptId };
      settled.documentProof.expectedIdentity = contentDocumentIdentity;
    }
    return settled;
  }
  let lensVisualBaseline = null;
  let lensAppliedCheckpoint = null;
  async function lensContentState(enabled, filterSettings, label,
    { previousDocumentId = null, requireRevisionAdvance = false } = {}) {
    await activate(pages.content);
    await contentState(true, { previousDocumentId });
    const previousApplied = requireRevisionAdvance ? lensAppliedCheckpoint : null;
    requireProof(!requireRevisionAdvance || previousApplied !== null, 'LENS_PRIOR_APPLIED_REQUIRED');
    const settled = await until(label, async () => {
      // This query owns a host projection. Exact tab/document delivery evidence
      // comes from readContentState, not an unsupported tabId request field.
      const reply = await send({ action: MESSAGE_ACTIONS.GET_PROTECTION_RUNTIME_SNAPSHOT, hostname: DOMAIN });
      requireProof(reply?.success === true, 'LENS_RUNTIME_QUERY', { error: reply?.error });
      return { content: await readContentState(), projection: reply.snapshot };
    }, state => matchesIntegratedLensContent(state,
      { enabled, filterSettings, baseline: lensVisualBaseline, previousApplied }));
    lensAppliedCheckpoint = { documentId: settled.content.documentProof.documentId,
      revision: settled.content.runtime.runtime.revision, traceId: settled.content.runtime.runtime.traceId };
    settled.previousApplied = previousApplied;
    await observe(label, settled);
    await activate(pages.dashboard);
    return settled;
  }
  const media = () => dom(pages.content, 'window.__entropyNativeVideoFixture.read()');
  let baselineRail;
  async function nativeTimelineScope() {
    return dom(pages.content, `(() => {
      const video = document.querySelector('video[controls]');
      const styles = Array.from(document.querySelectorAll('style')).filter(node =>
        node.textContent.includes('::-webkit-media-controls-timeline'));
      return {
        url: location.href, visibilityState: document.visibilityState,
        htmlLock: document.documentElement.getAttribute('data-friction-video-skip-timeline-lock'),
        videoPresent: Boolean(video),
        videoNativeOwner: video?.getAttribute('data-friction-video-skip-native-owner'),
        videoControls: video?.controls,
        ownedStylePresent: Boolean(document.getElementById('friction-video-skip-control-surface-lock')),
        timelineStyleCount: styles.length,
        timelineStyles: styles.slice(0, 8).map(style => ({ id: style.id,
          owner: style.getAttribute('data-friction-owner'), profile: style.getAttribute('data-friction-profile'),
          sheetPresent: Boolean(style.sheet),
          rules: style.sheet ? Array.from(style.sheet.cssRules).filter(rule =>
            typeof rule.selectorText === 'string' && rule.selectorText.includes('::-webkit-media-controls-timeline'))
            .slice(0, 12).map(rule => {
              const hostSelector = rule.selectorText.split('::-webkit-media-controls-timeline')[0];
              return { selector: rule.selectorText.slice(0, 512), hostSelector: hostSelector.slice(0, 512),
                matchesCurrentVideo: video ? video.matches(hostSelector) : false,
                display: rule.style.getPropertyValue('display'), priority: rule.style.getPropertyPriority('display') };
            }) : null,
        })),
      };
    })()`);
  }
  async function nativeMatchedCss(node) {
    try {
      await harness.cdp.send('CSS.enable', {}, pages.content.sessionId);
      const styles = await harness.cdp.send('CSS.getMatchedStylesForNode', { nodeId: node.nodeId }, pages.content.sessionId);
      return { status: 'read', rules: styles.matchedCSSRules.filter(({ rule }) =>
        rule.style.cssProperties.some(property => ['display', 'visibility', 'opacity'].includes(property.name)))
        .slice(0, 20).map(({ rule, matchingSelectors }) => ({ origin: rule.origin,
          selector: rule.selectorList.text.slice(0, 512), matchingSelectors: matchingSelectors.slice(0, 12),
          properties: rule.style.cssProperties.filter(property => ['display', 'visibility', 'opacity'].includes(property.name))
            .slice(0, 12)
            .map(property => ({ name: property.name, value: property.value, important: property.important === true })) })) };
    } catch (error) { return { status: 'failed', error: error.message }; }
  }
  function nativeSeek(expected, fraction) {
    return preserveIntegratedNativeFailureEvidence({
      run: () => performNativeSeek(expected, fraction), readContent: readContentState,
      observe: sample => observe('content_after_native_seek_failure', sample),
    });
  }
  async function performNativeSeek(expected, fraction) {
    await activate(pages.content);
    const before = await media();
    await harness.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved',
      x: before.rect.left + before.rect.width / 2, y: before.rect.top + before.rect.height / 2 }, pages.content.sessionId);
    await sleep(200);
    // Reactivating the released document may start a fresh content attempt.
    // Verify current ownership after the existing native-control preparation;
    // the original teardown receipt cannot prove that this attempt stayed clear.
    if (expected === 'allowed' && contentDocumentIdentity !== null) {
      await requireIntegratedRestorationBeforeNativeSeek({ readContent: readContentState,
        observe: sample => observe('content_restored_after_native_preparation', sample) });
    }
    const { root } = await harness.cdp.send('DOM.getDocument', { depth: -1, pierce: true }, pages.content.sessionId);
    const pseudo = '-webkit-media-controls-timeline';
    const node = findNativeMediaControl(root, pseudo);
    const { object } = await harness.cdp.send('DOM.resolveNode', { backendNodeId: node.backendNodeId }, pages.content.sessionId);
    let appearance;
    try {
      const result = await harness.cdp.send('Runtime.callFunctionOn', { objectId: object.objectId,
        functionDeclaration: `function() {
          const rect = this.getBoundingClientRect(), style = getComputedStyle(this);
          return { display: style.display, visibility: style.visibility, opacity: style.opacity,
            pointerEvents: style.pointerEvents,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
        }`, returnByValue: true }, pages.content.sessionId);
      requireProof(!result.exceptionDetails && result.result?.value !== null
        && typeof result.result?.value?.display === 'string', 'NATIVE_STYLE_READ', { backendNodeId: node.backendNodeId });
      appearance = result.result.value;
    } finally { await harness.cdp.send('Runtime.releaseObject', { objectId: object.objectId }, pages.content.sessionId); }
    const scope = await nativeTimelineScope();
    const nativeState = { expected, before, backendNodeId: node.backendNodeId, appearance, scope };
    await observe('native_timeline_before_seek', nativeState);
    const wrongDisplay = expected === 'allowed' ? appearance.display === 'none' : appearance.display !== 'none';
    const matchedCss = wrongDisplay ? await nativeMatchedCss(node) : null;
    const display = requireIntegratedNativeTimelineDisplay(appearance, expected, { ...nativeState, matchedCss });
    let geometry;
    if (expected === 'allowed') {
      const { model } = await harness.cdp.send('DOM.getBoxModel', { backendNodeId: node.backendNodeId }, pages.content.sessionId);
      const xs = model.content.filter((_, i) => i % 2 === 0), ys = model.content.filter((_, i) => i % 2 === 1);
      geometry = { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
      baselineRail = { ...geometry, videoRect: before.rect };
    } else {
      requireProof(baselineRail, 'PROTECTED_TIMELINE_NOT_REMOVED');
      geometry = { ...baselineRail,
        left: before.rect.left + (baselineRail.left - baselineRail.videoRect.left) * before.rect.width / baselineRail.videoRect.width,
        top: before.rect.top + (baselineRail.top - baselineRail.videoRect.top) * before.rect.height / baselineRail.videoRect.height };
    }
    const input = { ...geometry, pseudo, backendNodeId: node.backendNodeId, display,
      type: expected === 'allowed' ? 'trusted_native_timeline' : 'former_native_timeline_position',
      geometrySource: expected === 'allowed' ? 'native_content_quad' : 'unprotected_quad_projected_to_video',
      x: geometry.left + geometry.width * fraction, y: geometry.top + geometry.height / 2 };
    await pointer(pages.content, input); await sleep(1000);
    // Chromium's UA shadow controls do not bubble pointer events to the page.
    // CDP dispatch + UA geometry and the real media outcome are the evidence;
    // absence of a page-level pointer listener event is not an input failure.
    const sample = { before, after: await media(), input,
      dispatch: { method: 'Input.dispatchMouseEvent', pressed: true, released: true } };
    return { ...sample, verdict: requireNativeSeekEvidence(sample, expected) };
  }
  async function popupState(protectedSite) {
    const activation = await activate(pages.popup);
    const readAdmission = async () => ({
      activation,
      tab: await harness.resolveTabForPage(pages.popup),
      popupWindow: await readQaCdpPageTargetWindow(harness.cdp, pages.popup.targetId),
      sourceWindow: await readQaCdpPageTargetWindow(harness.cdp, pages.content.targetId),
      document: await dom(pages.popup, '({ url: location.href, hidden: document.hidden, visibilityState: document.visibilityState })'),
    });
    const admission = await readAdmission();
    await observe('popup_document_admission', admission);
    await until('popup_visibility', readAdmission, value => value.tab.active === true
      && value.tab.id === pages.popup.tabId
      && value.tab.windowId === activation.windowId
      && value.popupWindow.windowId === activation.windowId
      && value.sourceWindow.windowId === activation.windowId
      && value.popupWindow.windowBounds.windowState !== 'minimized'
      && value.document.hidden === false && value.document.visibilityState === 'visible');
    const ui = await until('popup_ui', () => dom(pages.popup, `({
      visibilityState: document.visibilityState,
      hidden: document.hidden,
      readyState: document.readyState,
      domain: document.querySelector('.popup-site-header__domain')?.textContent,
      status: document.querySelector('.popup-site-status')?.textContent,
      effects: Boolean(document.querySelector('.popup-effects-trigger')),
      sitesHref: document.querySelector('.popup-rail-button--sites')?.href,
      error: document.querySelector('[role="alert"]')?.textContent
    })`), value => value.domain === DOMAIN && value.effects === protectedSite && Boolean(value.status) && !value.error);
    const reply = await send({ action: MESSAGE_ACTIONS.GET_POPUP_SITE_SNAPSHOT, pageUrl: fixture.url, hostname: DOMAIN });
    requireProof(reply?.success && reply.snapshot?.protection.isProtected === protectedSite, 'POPUP_QUERY', reply);
    requireProof(new URL(ui.sitesHref).searchParams.get('domain') === DOMAIN, 'POPUP_SITES_LINK', ui);
    // DOM presence alone missed controls clipped by the old HTML boot stylesheet.
    // Require the real controls inside the fixed root and unobstructed at both
    // ends; test at the current scroll position before any click helper scrolls.
    const controls = await dom(pages.popup, `(() => {
      const root = document.getElementById('root').getBoundingClientRect();
      const selectors = ['.popup-rail-button--dashboard', '.popup-rail-button--sites',
        ${JSON.stringify(protectedSite ? '.popup-effects-trigger' : '.popup-goal-card__start-surface')}];
      return selectors.map(selector => {
        const node = document.querySelector(selector);
        if (!node) return { selector, visible: false, reason: 'missing' };
        const r = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const hit = y => { const target = document.elementFromPoint(r.x + r.width / 2, y);
          return target !== null && node.contains(target); };
        return { selector, rect: { x: r.x, y: r.y, width: r.width, height: r.height },
          root: { x: root.x, y: root.y, width: root.width, height: root.height },
          visible: r.width > 0 && r.height > 0 && r.left >= root.left && r.right <= root.right
            && r.top >= root.top && r.bottom <= root.bottom && style.visibility === 'visible'
            && Number(style.opacity) > 0 && hit(r.top + 2) && hit(r.bottom - 2) };
      });
    })()`);
    requireProof(controls.every(control => control.visible), 'POPUP_CONTROL_CLIPPED', controls);
    return { ui, controls, snapshot: reply.snapshot };
  }
  async function openContentPopup() {
    return openIntegratedPopupForActiveContent({ content: pages.content, hostname: DOMAIN,
      activateContent: activate,
      openPopup: content => open('popup', `chrome-extension://${harness.extensionId}/src/pages/popup.html`, false, content),
      readContextDomain: popup => dom(popup, "document.querySelector('.popup-shell')?.getAttribute('data-site-domain')"),
      until, observeContext: receipt => observe('popup_context_bound', receipt) });
  }
  const releaseControls = integratedSiteReleaseControls(plan.parameters.theme);
  const searchInput = "document.querySelector('.sites-unified-registry input[type=\"search\"]')";
  let registeredSitesRecordingPolicy = null;
  let artifactSettingsBefore = null;
  let retainedArtifactSettings = null;
  let lifecyclePortableSnapshot = null;
  const openSitesManagement = () => openIntegratedSitesManagement({
    hostname: DOMAIN, until,
    readDom: expression => dom(pages.dashboard, expression),
    click: expression => click(pages.dashboard, expression),
  });
  async function readSavedSitesNotebook() {
    const ui = await readIntegratedSitesNotebookUi(expression => dom(pages.dashboard, expression));
    return { ui, registration: await readIntegratedFirstSiteRegistration(send, { pageUrl: fixture.url, hostname: DOMAIN }),
      settings: await readFirstUsePolicy() };
  }
  function savedSitesNotebookMatches(state) {
    return matchesIntegratedSitesNotebook(state, { hostname: DOMAIN, goalMinutes: 45,
      recordingPolicy: registeredSitesRecordingPolicy, themeId: plan.parameters.theme });
  }
  async function requestRelease() {
    await activate(pages.dashboard); await openSitesManagement();
    await click(pages.dashboard, releaseControls.request);
    await click(pages.dashboard, releaseControls.confirm);
    await until('release_grace', () => dom(pages.dashboard, releaseControls.grace), Boolean);
  }
  try {
    await settings(configuration);
    await step('baseline', async () => {
      await open('content', fixture.url, true); await activate(pages.content);
      await until('media_ready', media, state => state.readyState >= 2 && state.duration >= 170);
      const seek = await nativeSeek('allowed', 0.30);
      await openContentPopup();
      const popup = await popupState(false);
      await open('dashboard', `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=sites`, true);
      await activate(pages.dashboard);
      const search = await until('sites_ready', () => controlState(pages.dashboard, searchInput), isIntegratedControlReady, 45_000);
      return { seek, popup, search, screenshot: await screenshot(pages.dashboard, '01-sites-baseline') };
    });
    await step('register_in_sites', async () => {
      await click(pages.dashboard, searchInput);
      let previousFocusedSearch = null;
      const before = await until('sites_search_focused', () => controlState(pages.dashboard, searchInput), state => {
        const focused = isIntegratedControlReady(state) && state.focused === true && state.value === '';
        const stable = focused && previousFocusedSearch !== null
          && isDeepStrictEqual(state.rect, previousFocusedSearch.rect);
        previousFocusedSearch = focused ? state : null;
        return stable;
      });
      await harness.cdp.send('Input.insertText', { text: DOMAIN }, pages.dashboard.sessionId);
      const after = await until('sites_search_value', () => controlState(pages.dashboard, searchInput), state => (
        isIntegratedControlReady(state) && state.focused === true && state.value === DOMAIN
      ));
      await observe('sites_search_input', { before, after, dispatch: { method: 'Input.insertText', text: DOMAIN } });
      const registryTheme = await dom(pages.dashboard, "document.documentElement.getAttribute('data-theme')");
      await click(pages.dashboard, buildIntegratedSitesRegistrationCandidateControl(registryTheme));
      await until('sites_registration_draft', () => controlState(pages.dashboard,
        "document.querySelector('.sites-registry-composer input[type=\"text\"]')"),
      state => isIntegratedControlReady(state) && state.value === DOMAIN);
      await click(pages.dashboard, "document.querySelector('.sites-registry-composer button[type=\"submit\"]')");
      const committed = await rulePresent(true);
      const notebook = await until('sites_post_registration_snapshot', () => dom(pages.dashboard, `(() => ({
        admission: document.querySelector('#sites-tab')?.dataset.sitesSnapshotAdmission,
        mode: document.querySelector('.sites-sites-workspace')?.dataset.mode,
        domain: document.querySelector('.sites-notebook-heading h2')?.textContent,
        composers: document.querySelectorAll('.sites-registry-composer').length,
        errors: Array.from(document.querySelectorAll('#sites-tab [role="alert"]')).map(node => node.textContent),
        retries: document.querySelectorAll('#sites-tab [data-settings-command-retry], #sites-tab .sites-inline-feedback button').length,
        readOwnerError: document.querySelector('[data-sites-read-error-code]')?.dataset,
        commandReceipts: Array.from(document.querySelectorAll('[data-settings-command-status]')).map(node => ({
          status: node.dataset.settingsCommandStatus, commandId: node.dataset.settingsCommandId,
          commitVersion: node.dataset.settingsCommandCommitVersion, taskId: node.dataset.settingsCommandTaskId }))
      }))()`), state => state.admission === 'ready' && state.mode === 'notebook'
        && state.domain === DOMAIN && state.composers === 0, 45_000);
      await until('policy_detail', () => dom(pages.dashboard, "Boolean(document.querySelector('#sites-site-detail[data-detail-mode=\"policy_only\"]'))"), Boolean);
      const registration = await readIntegratedFirstSiteRegistration(send, { pageUrl: fixture.url, hostname: DOMAIN });
      requireProof(registration.isProtected === true && registration.goalMinutes === null,
        'SITES_REGISTRATION_NO_IMPLICIT_TIME_GOAL', registration);
      requireProof(await dom(pages.dashboard, `Boolean(document.querySelector('.sites-site-cap-note .sites-cap-readout__value small'))
        && !document.querySelector('.sites-registry-composer input[type="number"]')`), 'SITES_RECORDING_OFF_CAP_INACTIVE');

      // Continue through the actual Settings control. Merely registering or
      // entering the notebook must not opt the user into recorded history.
      await openSitesManagement();
      await click(pages.dashboard, "document.querySelector('.sites-recording-actions > button:last-of-type')");
      const scopeSelect = `Array.from(document.querySelectorAll('select')).find(node => node.querySelector('option[value="protected_sites"]'))`;
      await click(pages.dashboard, scopeSelect);
      for (const key of ['Home', 'ArrowDown', 'Enter']) {
        for (const type of ['keyDown', 'keyUp']) await harness.cdp.send('Input.dispatchKeyEvent', { type, key,
          code: key, windowsVirtualKeyCode: { Home: 36, ArrowDown: 40, Enter: 13 }[key] }, pages.dashboard.sessionId);
      }
      const recordingChoice = await until('explicit_sites_recording_choice', readSettings,
        value => value.dataCollectionMode === 'protected_sites' && value.insightsConsent === 'protected_only');
      await presentSites(pages.dashboard);
      await selectIntegratedSitesNotebook({ hostname: DOMAIN, click: expression => click(pages.dashboard, expression) });
      await until('sites_recording_admitted', () => dom(pages.dashboard, `(() => ({
        admission: document.querySelector('#sites-tab')?.dataset.sitesSnapshotAdmission,
        mode: document.querySelector('.sites-sites-workspace')?.dataset.mode,
        domain: document.querySelector('.sites-notebook-heading h2')?.textContent,
        unavailable: Boolean(document.querySelector('.sites-site-cap-note .sites-cap-readout__value small')),
        errors: Array.from(document.querySelectorAll('#sites-tab [role="alert"]')).map(node => node.textContent)
      }))()`), state => state.admission === 'ready' && state.mode === 'notebook' && state.domain === DOMAIN && !state.unavailable, 45_000);
      await openSitesManagement();
      await click(pages.dashboard, "document.querySelector('.sites-site-cap-note .sites-cap-readout__value')");
      const capInput = "document.querySelector('.sites-site-cap-note input[type=\"number\"]')";
      await click(pages.dashboard, capInput);
      for (const type of ['keyDown', 'keyUp']) await harness.cdp.send('Input.dispatchKeyEvent', {
        type, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2,
      }, pages.dashboard.sessionId);
      await harness.cdp.send('Input.insertText', { text: '45' }, pages.dashboard.sessionId);
      await until('explicit_site_cap_draft', () => controlState(pages.dashboard, capInput), state => state.value === '45');
      await click(pages.dashboard, "document.querySelector('.sites-site-cap-note button[type=\"submit\"]')");
      const goal = await until('explicit_site_cap_ack', () => readIntegratedFirstSiteRegistration(send,
        { pageUrl: fixture.url, hostname: DOMAIN }), state => state.goalMinutes === 45);
      await until('explicit_site_cap_settled', () => dom(pages.dashboard, `(() => ({
        formOpen: Boolean(document.querySelector('.sites-site-cap-note form')),
        receipts: Array.from(document.querySelectorAll('[data-settings-command-status]')).map(node => node.dataset.settingsCommandStatus),
        errors: Array.from(document.querySelectorAll('#sites-tab [role="alert"]')).map(node => node.textContent)
      }))()`), state => !state.formOpen && state.receipts.length === 0 && state.errors.length === 0);
      registeredSitesRecordingPolicy = await readFirstUsePolicy();
      const savedNotebook = await until('explicit_site_cap_notebook', readSavedSitesNotebook, savedSitesNotebookMatches, 45_000);
      return { blockedUrls: committed.blockedUrls, notebook, registrationWithoutGoal: registration,
        recordingChoice: { dataCollectionMode: recordingChoice.dataCollectionMode, insightsConsent: recordingChoice.insightsConsent },
        recordingPolicy: registeredSitesRecordingPolicy, explicitlySavedGoal: goal, savedNotebook,
        screenshot: await screenshot(pages.dashboard, '02-sites-protected') };
    });
    await step('content_protected', async () => {
      const runtime = await contentState(true);
      const seek = await nativeSeek('blocked', 0.80);
      return { runtime, seek, screenshot: await screenshot(pages.content, '03-content-protected') };
    });
    await step('popup_protected', async () => {
      const state = await popupState(true);
      await click(pages.popup, "document.querySelector('.popup-effects-trigger')");
      await until('popup_effects_open', () => dom(pages.popup,
        "Boolean(document.querySelector('.popup-detail[role=\"dialog\"] .popup-effects-group'))"), Boolean);
      await click(pages.popup, "document.querySelector('.popup-detail__back')");
      await until('popup_effects_closed', () => dom(pages.popup,
        "!document.querySelector('.popup-detail[role=\"dialog\"]')"), Boolean);
      return { ...state, effectsDetailOpenedAndClosed: true,
        screenshot: await screenshot(pages.popup, '04-popup-protected') };
    });
    await step('dashboard_reload', async () => {
      await activate(pages.dashboard);
      await harness.navigatePage(pages.dashboard,
        report.steps.find(item => item.id === 'popup_protected').result.ui.sitesHref);
      const notebook = await until('reload_saved_sites_notebook', readSavedSitesNotebook, savedSitesNotebookMatches, 45_000);
      await rulePresent(true); return { notebook, runtime: await contentState(true) };
    });
    await step('locked_protection_revival', () => verifyIntegratedLockedProtectionRevival({
      send, extensionId: harness.extensionId, passphrase: randomBytes(32).toString('base64url'), backupPassphrase,
      vaultStep: options => runQaSecurityVaultLogLockStep(harness, options),
      retireDocuments: () => retireIntegratedLogLockDocuments({ pages, diagnostics,
        archive: (id, value) => { report.pageDiagnostics[id] = value; }, closePage: page => harness.closePage(page) }),
      observePhase: value => observe('log_lock_phase', value),
      readSettings, readPortable: async () => integratedPortableState(await exportPortableSnapshot(), backupPassphrase),
      reload: () => harness.reloadExtensionFromSource(),
      proveProtection: async () => {
        const dashboard = await open('dashboard',
          `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=sites&domain=${DOMAIN}`, true);
        await activate(dashboard);
        // Log locking preserves consented aggregate recording and site controls;
        // require their current notebook, not only an interactive search input.
        const notebook = await until('locked_dashboard_sites_ready', readSavedSitesNotebook, savedSitesNotebookMatches, 45_000);
        contentDocumentIdentity = null;
        await harness.reloadPage(pages.content);
        await activate(pages.content);
        await until('locked_media_ready', media, state => state.readyState >= 2 && state.duration >= 170);
        const runtime = await contentState(true);
        const seek = await nativeSeek('blocked', 0.80);
        const popupContext = await openContentPopup();
        return { dashboardReady: true, notebook, runtime, seek, popupContext,
          screenshot: await screenshot(pages.content, '04-locked-content-protected') };
      },
    }));
    await step('artifact_lens_settings', async () => {
      await activate(pages.dashboard);
      await click(pages.dashboard, "document.querySelector('[data-tab=\"tools\"]')");
      await selectArtifact('lens', 'blur');
      const before = await readSettings();
      artifactSettingsBefore = before;
      requireProof(before.filterSettings.blur.isActive === false, 'LENS_OFF_BASELINE', before.filterSettings.blur);
      await activate(pages.content);
      const baselineContent = await contentState(true);
      lensVisualBaseline = { source: new URL('/native.webm', fixture.url).href,
        rootFilter: baselineContent.mediaVisual.rootFilter, videoFilter: baselineContent.mediaVisual.video.filter };
      lensAppliedCheckpoint = { documentId: baselineContent.documentProof.documentId,
        revision: baselineContent.runtime.runtime.revision, traceId: baselineContent.runtime.runtime.traceId };
      requireProof(baselineContent.mediaVisual.videoCount === 1
        && baselineContent.mediaVisual.video.source === lensVisualBaseline.source
        && lensVisualBaseline.videoFilter === 'none'
        && baselineContent.mediaVisual.video.filterEffects.length === 0, 'LENS_NATIVE_FIXTURE_BASELINE', baselineContent);
      await activate(pages.dashboard);
      const enabled = structuredClone(before.filterSettings);
      enabled.blur.isActive = true;
      const on = await commitArtifactChoice('blur', 'on', { filterSettings: enabled });
      const contentOn = await lensContentState(true, enabled, 'lens_content_on', { requireRevisionAdvance: true });
      const off = await commitArtifactChoice('blur', 'off', { filterSettings: before.filterSettings });
      const contentOff = await lensContentState(false, before.filterSettings, 'lens_content_off', { requireRevisionAdvance: true });
      requireProof(isDeepStrictEqual(off.settings, before), 'LENS_SIBLING_SETTINGS_CHANGED', { before, after: off.settings });
      const retained = await commitArtifactChoice('blur', 'on', { filterSettings: enabled });
      const contentRetained = await lensContentState(true, enabled, 'lens_content_retained', { requireRevisionAdvance: true });
      return { family: 'lens', child: 'blur', on, off, retained, baseline: lensVisualBaseline,
        contentOn, contentOff, contentRetained,
        screenshot: await screenshot(pages.dashboard, '08-artifact-lens-settings') };
    });
    await step('artifact_echo_settings', async () => {
      await selectArtifact('echo', 'tabEvaporation');
      const before = await readSettings();
      requireProof(before.tabEvaporationForBlocked === false && before.tabEvaporationTimeoutMinutes === 5,
        'ECHO_OFF_BASELINE', before);
      const selected = await commitArtifactChoice('tabEvaporation', 10, {
        tabEvaporationForBlocked: true, tabEvaporationTimeoutMinutes: 10,
      });
      const off = await commitArtifactChoice('tabEvaporation', 'off', {
        tabEvaporationForBlocked: false, tabEvaporationTimeoutMinutes: 10,
      });
      const restoredTimeout = await commitArtifactChoice('tabEvaporation', 5, {
        tabEvaporationForBlocked: true, tabEvaporationTimeoutMinutes: 5,
      });
      const restored = await commitArtifactChoice('tabEvaporation', 'off', {
        tabEvaporationForBlocked: false, tabEvaporationTimeoutMinutes: 5,
      });
      requireProof(isDeepStrictEqual(restored.settings, before), 'ECHO_SIBLING_SETTINGS_CHANGED', { before, after: restored.settings });
      const retained = await commitArtifactChoice('tabEvaporation', 10, {
        tabEvaporationForBlocked: true, tabEvaporationTimeoutMinutes: 10,
      });
      return { family: 'echo', child: 'tabEvaporation', selected, off, restoredTimeout, restored, retained,
        screenshot: await screenshot(pages.dashboard, '09-artifact-echo-settings') };
    });
    await step('artifact_settings_lifecycle', async () => {
      const expected = await readSettings();
      requireProof(expected.filterSettings.blur.isActive === true && expected.tabEvaporationForBlocked === true
        && expected.tabEvaporationTimeoutMinutes === 10 && expected.blockedUrls.includes(DOMAIN), 'ARTIFACT_RETAINED_INTENT_REQUIRED');
      async function verifyRetainedUi() {
        await selectArtifact('lens', 'blur');
        await waitArtifactChoice('blur', 'on', { filterSettings: expected.filterSettings });
        await selectArtifact('echo', 'tabEvaporation');
        const echo = await waitArtifactChoice('tabEvaporation', 10, {
          tabEvaporationForBlocked: true, tabEvaporationTimeoutMinutes: 10,
        });
        requireProof(isDeepStrictEqual(echo.settings, expected), 'ARTIFACT_LIFECYCLE_SETTINGS_CHANGED');
        return { lensSelected: true, echoSelected: true, canonicalSettingsMatched: true };
      }
      await harness.navigatePage(pages.dashboard,
        `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=tools`);
      const reload = await verifyRetainedUi();
      const previousContentDocumentId = contentDocumentIdentity.documentId;
      contentDocumentIdentity = null;
      await harness.reloadPage(pages.content);
      const contentReload = await lensContentState(true, expected.filterSettings,
        'lens_content_after_refresh', { previousDocumentId: previousContentDocumentId });
      const stopped = await harness.stopServiceWorker();
      const revivedSettings = await readSettings();
      const revived = await harness.waitForServiceWorker({ previousTargetId: stopped.targetId });
      requireProof(isDeepStrictEqual(revivedSettings, expected), 'ARTIFACT_WORKER_REVIVAL_SETTINGS_CHANGED');
      await harness.navigatePage(pages.dashboard,
        `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=tools`);
      const revival = await verifyRetainedUi();
      const contentRevival = await lensContentState(true, expected.filterSettings, 'lens_content_after_worker_revival');
      retainedArtifactSettings = expected;
      lifecyclePortableSnapshot = await exportPortableSnapshot();
      const capture = await screenshot(pages.dashboard, '10-artifact-settings-after-revival');
      await commitArtifactChoice('tabEvaporation', 5, {
        tabEvaporationForBlocked: true, tabEvaporationTimeoutMinutes: 5,
      });
      await commitArtifactChoice('tabEvaporation', 'off', {
        tabEvaporationForBlocked: false, tabEvaporationTimeoutMinutes: 5,
      });
      await selectArtifact('lens', 'blur');
      const restored = await commitArtifactChoice('blur', 'off', { filterSettings: artifactSettingsBefore.filterSettings });
      const contentRestored = await lensContentState(false, artifactSettingsBefore.filterSettings,
        'lens_content_baseline_restored', { requireRevisionAdvance: true });
      requireProof(isDeepStrictEqual(restored.settings, artifactSettingsBefore), 'ARTIFACT_LIFECYCLE_RESTORE_MISMATCH');
      await presentSites(pages.dashboard);
      await selectIntegratedSitesNotebook({ hostname: DOMAIN, click: expression => click(pages.dashboard, expression) });
      const notebook = await until('return_saved_sites_notebook', readSavedSitesNotebook, savedSitesNotebookMatches, 45_000);
      return { reload, revival, previousContentDocumentId, contentReload, contentRevival, contentRestored,
        stoppedTargetId: stopped.targetId, revivedTargetId: revived.targetId,
        portableExport: summarizeIntegratedPortableSnapshot(lifecyclePortableSnapshot),
        restored: true, notebook, runtime: await contentState(true), screenshot: capture };
    });
    await step('cancel_release', async () => {
      await requestRelease(); await rulePresent(true);
      await click(pages.dashboard, releaseControls.cancel);
      await until('grace_cancelled', () => dom(pages.dashboard, releaseControls.cancelled), Boolean);
      // Observe past the product's actual grace deadline; cancellation must stop the write.
      const cancellationStartedAt = Date.now();
      while (Date.now() - cancellationStartedAt < 8_500) {
        signal?.throwIfAborted();
        const current = await readSettings();
        requireProof(current.blockedUrls.includes(DOMAIN), 'CANCEL_REMOVED_RULE', current);
        await sleep(250);
      }
      return { observedMs: Date.now() - cancellationStartedAt, runtime: await contentState(true) };
    });
    await step('release_after_grace', async () => {
      await requestRelease(); const requestedAt = Date.now();
      await rulePresent(true);
      const current = await rulePresent(false);
      requireProof(Date.now() - requestedAt >= 7_500, 'GRACE_SKIPPED');
      requireProof(isDeepStrictEqual(current.allowedUrls, original.allowedUrls), 'UNRELATED_RULE_CHANGED');
      await until('release_ui_settled', () => dom(pages.dashboard, releaseControls.settled), Boolean);
      return { elapsedMs: Date.now() - requestedAt, blockedUrls: current.blockedUrls,
        screenshot: await screenshot(pages.dashboard, '05-sites-released') };
    });
    await step('content_restored', async () => {
      const runtime = await contentState(false);
      await observe('content_restored_before_seek', runtime);
      return { runtime, seek: await nativeSeek('allowed', 0.90),
        screenshot: await screenshot(pages.content, '06-content-restored') };
    });
    await step('popup_restored', async () => ({ ...await popupState(false),
      screenshot: await screenshot(pages.popup, '07-popup-restored') }));
    await step('snapshot_data_lifecycle', async () => {
      requireProof(lifecyclePortableSnapshot !== null && retainedArtifactSettings !== null, 'SNAPSHOT_SEED_REQUIRED');
      const beforeSettings = await readSettings();
      const beforePortable = await exportPortableSnapshot();
      const beforeJournal = await lifecycleJournal();
      const generation = await profileReadiness(MODEL_STATE_INITIAL_PROFILE_EPOCH);
      const rejected = await send({ action: MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT,
        snapshot: await buildIntegratedMalformedImportSnapshot(lifecyclePortableSnapshot, backupPassphrase),
        mode: 'replace', backupPassphrase });
      requireIntegratedMalformedImportRejection(rejected);
      requireProof(isDeepStrictEqual(await readSettings(), beforeSettings), 'MALFORMED_IMPORT_SETTINGS_MUTATED');
      requireProof(isDeepStrictEqual(await integratedPortableState(await exportPortableSnapshot(), backupPassphrase),
        await integratedPortableState(beforePortable, backupPassphrase)), 'MALFORMED_IMPORT_DURABLE_STATE_MUTATED');
      requireProof(isDeepStrictEqual(await lifecycleJournal(), beforeJournal), 'MALFORMED_IMPORT_JOURNAL_MUTATED');
      await profileReadiness(generation.profileGeneration);
      const resetWorker = await harness.getServiceWorker();
      requireProof(typeof resetWorker?.targetId === 'string', 'RESET_REENTRY_PRIOR_WORKER_REQUIRED');
      const resetDocument = pages.dashboard;
      // Exercise the existing trusted Dashboard message contract once. Return
      // the real mutation response but deliberately leave its ACK to a new
      // document's existing recovery UI; no lifecycle/storage state is seeded.
      const reset = await dom(resetDocument,
        `chrome.runtime.sendMessage(${JSON.stringify({ action: MESSAGE_ACTIONS.RESET_APP_DATA })})`);
      requireProof(reset?.success === true && (!Array.isArray(reset.warnings) || reset.warnings.length === 0),
        'SNAPSHOT_RESET', { error: reset?.error });
      const committedHandoff = normalizeProfileMutationResponseHandoff(reset.profileMutationHandoff);
      const committedJournal = await lifecycleJournal();
      requireProof(requireIntegratedCompletedProfileGeneration(committedJournal, 'full_reset') === committedHandoff.resetId,
        'RESET_REENTRY_COMMITTED_GENERATION_REQUIRED', committedJournal);
      report.pageDiagnostics.dashboard_before_reset_reentry = await diagnostics.dashboard.snapshot();
      diagnostics.dashboard.dispose();
      await harness.closePage(resetDocument);
      delete diagnostics.dashboard;
      delete pages.dashboard;
      const resetDashboard = await open('dashboard_snapshot_reset',
        `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=main`, true);
      pages.dashboard = resetDashboard;
      await activate(resetDashboard);
      const recoveryRoot = "document.querySelector('main[data-dashboard-profile-recovery=\"profile\"]')";
      const recoveryUi = await until('reset_reentry_handoff_surface', () => dom(resetDashboard, `(() => {
        const root = (${recoveryRoot});
        return { recovery: root?.dataset.dashboardProfileRecovery,
          bootShellPresent: Boolean(document.getElementById('entropy-dashboard-boot-shell')),
          lifecycleCode: root?.querySelector('section[aria-label] code')?.textContent,
          inputCount: root?.querySelectorAll('input').length,
          confirmationCount: root?.querySelectorAll('[role="group"]').length,
          buttonCount: root?.querySelectorAll('button').length,
          errors: root ? Array.from(root.querySelectorAll('[role="alert"]')).map(node => node.textContent) : null };
      })()`), ui => ui.recovery === 'profile' && !ui.bootShellPresent && ui.buttonCount === 1, 45_000);
      const pendingProof = { response: reset, committedJournal, journal: await lifecycleJournal(),
        previousWorkerId: resetWorker.targetId, workerId: (await harness.getServiceWorker())?.targetId,
        readiness: await send({ action: MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS,
          profileGeneration: committedHandoff.resetId }), ui: recoveryUi,
        control: await controlState(resetDashboard, `(${recoveryRoot})?.querySelector('button')`) };
      requireIntegratedResetReentryProof(pendingProof);
      const reentryCapture = await screenshot(resetDashboard, '11-snapshot-reset-reentry-handoff');
      await observe('reset_reentry_before_ui_ack', { ...pendingProof,
        scope: 'one_canonical_RESET_APP_DATA_from_exact_run_owned_dashboard_without_response_ACK',
        closedTargetId: resetDocument.targetId, reentryTargetId: resetDashboard.targetId, screenshot: reentryCapture });
      await harness.releaseTrustedPage();
      await click(resetDashboard, `(${recoveryRoot})?.querySelector('button')`);
      await harness.waitForServiceWorkerExit({ targetId: resetWorker.targetId });
      await harness.waitForExtensionActive();
      await ensureVaultReady();
      const defaults = await readFreshDefaults();
      const resetRevivedWorker = await harness.waitForServiceWorker({ previousTargetId: resetWorker.targetId });
      const recoveredJournal = await lifecycleJournal();
      requireProof(isDeepStrictEqual(recoveredJournal, committedJournal), 'RESET_REENTRY_REPEATED_MUTATION', recoveredJournal);
      await profileReadiness(committedHandoff.resetId);
      const resetHandoff = { operation: committedHandoff.operation, ackStarted: true,
        previousTargetId: resetWorker.targetId, revivedTargetId: resetRevivedWorker.targetId,
        reentry: { closedTargetId: resetDocument.targetId, recoveryTargetId: resetDashboard.targetId,
          sameWorkerBeforeAck: true, sameCommitAfterAck: true, handoffOnly: true,
          method: 'trusted_recovery_retry_pointer', screenshot: reentryCapture } };
      report.pageDiagnostics.dashboard_snapshot_reset_handoff = await diagnostics.dashboard_snapshot_reset.snapshot();
      diagnostics.dashboard_snapshot_reset.dispose();
      await harness.releasePageTarget(resetDashboard);
      delete diagnostics.dashboard_snapshot_reset;
      delete pages.dashboard_snapshot_reset;
      delete pages.dashboard;
      await prepareCanonicalFirstUse('snapshot_reset');
      const resetHealthyDashboard = await open('dashboard_snapshot_reset_healthy',
        `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=sites`, true);
      pages.dashboard = resetHealthyDashboard;
      await activate(resetHealthyDashboard);
      const resetFirstUse = await firstUseOffPolicy(resetHealthyDashboard, 'snapshot_reset', '11-snapshot-reset-consent-off');
      const imported = await send({ action: MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT,
        snapshot: lifecyclePortableSnapshot, mode: 'replace', backupPassphrase });
      requireProof(imported?.success === true && imported.result?.mode === 'replace', 'SNAPSHOT_REPLACE_IMPORT', { error: imported?.error });
      requireProof(imported.result.vaultState === 'unlocked' && imported.result.vaultMode === 'local',
        'SNAPSHOT_LOCAL_VAULT_RESTORE_REQUIRED');
      const { value: restored, ...importHandoff } = await completeMv3ProfileMutationHandoff(harness, imported, { wakeRuntime: async () => { await ensureVaultReady(); return readSettings(); } });
      requireProof(isDeepStrictEqual(restored, retainedArtifactSettings), 'SNAPSHOT_CANONICAL_RESTORE_MISMATCH');
      const stopped = await harness.stopServiceWorker();
      const revivedSettings = await readSettings();
      const revived = await harness.waitForServiceWorker({ previousTargetId: stopped.targetId });
      requireProof(isDeepStrictEqual(revivedSettings, retainedArtifactSettings), 'SNAPSHOT_REVIVAL_RESTORE_MISMATCH');
      const dashboard = await open('dashboard_snapshot_import',
        `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=tools`, true);
      pages.dashboard = dashboard; await activate(dashboard);
      await selectArtifact('lens', 'blur');
      await waitArtifactChoice('blur', 'on', { filterSettings: retainedArtifactSettings.filterSettings });
      await selectArtifact('echo', 'tabEvaporation');
      await waitArtifactChoice('tabEvaporation', 10, { tabEvaporationForBlocked: true, tabEvaporationTimeoutMinutes: 10 });
      const importedFirstUse = { ui: await readFirstUseUi(dashboard), settings: await readFirstUsePolicy() };
      requireProof(importedFirstUse.ui.setupPresent === false && !importedFirstUse.ui.bootShellPresent
        && !importedFirstUse.ui.firstUsePresent
        && isDeepStrictEqual(importedFirstUse.settings, registeredSitesRecordingPolicy), 'SNAPSHOT_CONSENT_RESTORE_MISMATCH', importedFirstUse);
      const importedRegistration = await readIntegratedFirstSiteRegistration(send, { pageUrl: fixture.url, hostname: DOMAIN });
      requireProof(importedRegistration.isProtected === true && importedRegistration.goalMinutes === 45,
        'SNAPSHOT_SITE_GOAL_RESTORE_MISMATCH', importedRegistration);
      return { portableExport: summarizeIntegratedPortableSnapshot(lifecyclePortableSnapshot),
        malformedImport: { error: rejected.error, durableStateUnchanged: true, journalUnchanged: true, generation },
        reset: { ...resetHandoff, defaults, firstUse: resetFirstUse },
        replaceImport: { ...importHandoff, canonicalSettingsMatched: true, firstUsePolicyMatched: true,
          recordingPolicy: importedFirstUse.settings, registration: importedRegistration },
        revival: { stoppedTargetId: stopped.targetId, revivedTargetId: revived.targetId, canonicalSettingsMatched: true },
        screenshot: await screenshot(dashboard, '11-snapshot-import-restored') };
    });
    await step('settings_corruption_recovery', async () => {
      const cases = [];
      for (const kind of INTEGRATED_SETTINGS_CORRUPTION_KINDS) {
        const profileGeneration = requireIntegratedCompletedProfileGeneration(await lifecycleJournal(),
          kind === INTEGRATED_SETTINGS_CORRUPTION_KINDS[0] ? 'snapshot_import' : 'full_reset');
        await profileReadiness(profileGeneration);
        const seed = await seedIntegratedSettingsCorruption(harness, kind);
        const stopped = await harness.stopServiceWorker();
        const rejection = requireIntegratedSettingsRecoveryResponse(await send({
          action: MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS, profileGeneration,
        }), seed, profileGeneration);
        const failedWorker = await harness.waitForServiceWorker({ previousTargetId: stopped.targetId });
        const dashboard = await open(`dashboard_recovery_${kind}`,
          `chrome-extension://${harness.extensionId}/src/pages/dashboard.html`, true);
        pages.dashboard = dashboard; await activate(dashboard);
        const recoveryRoot = "document.querySelector('main[data-dashboard-profile-recovery=\"settings\"]')";
        await until(`settings_recovery:${kind}`, () => dom(dashboard, `Boolean((${recoveryRoot})
          && !document.getElementById('entropy-dashboard-boot-shell'))`), Boolean, 45_000);
        const diagnostic = await dom(dashboard, `(${recoveryRoot})?.querySelector('section[aria-label]')?.textContent`);
        requireProof(typeof diagnostic === 'string' && diagnostic.includes(seed.expectedError)
          && diagnostic.includes(seed.documentKey) && diagnostic.includes(seed.key), 'SETTINGS_RECOVERY_DIAGNOSTIC', { kind });
        const unchanged = await verifyIntegratedSettingsCorruptionUnchanged(harness);
        const errorCapture = await screenshot(dashboard, `12-settings-${kind}-error`);
        await click(dashboard, `(${recoveryRoot})?.querySelector('button')`);
        await until(`settings_reset_confirmation:${kind}`, () => dom(dashboard,
          `Boolean((${recoveryRoot})?.querySelector('[role="group"] button:last-child'))`), Boolean);
        const confirmationCapture = await screenshot(dashboard, `13-settings-${kind}-confirmation`);
        await harness.releaseTrustedPage();
        await click(dashboard, `(${recoveryRoot})?.querySelector('[role="group"] button:last-child')`);
        // The real recovery UI owns RESET and ACK. No helper duplicates either command.
        await harness.waitForServiceWorkerExit({ targetId: failedWorker.targetId });
        await harness.waitForExtensionActive();
        await ensureVaultReady();
        const defaults = await readFreshDefaults();
        const recoveredWorker = await harness.waitForServiceWorker({ previousTargetId: failedWorker.targetId });
        const journal = await lifecycleJournal();
        requireProof(journal.present && journal.value?.operation === 'full_reset'
          && journal.value.status === 'complete', 'SETTINGS_RECOVERY_RESET_NOT_COMPLETE', { kind });
        await prepareCanonicalFirstUse(`settings_reset:${kind}`);
        const healthy = await open(`dashboard_recovered_${kind}`,
          `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=sites`, true);
        pages.dashboard = healthy; await activate(healthy);
        const firstUse = await firstUseOffPolicy(healthy, `settings_reset:${kind}`, `14-settings-${kind}-consent-off`);
        await until(`settings_recovered_sites:${kind}`, () => controlState(healthy, searchInput), isIntegratedControlReady, 45_000);
        const recoveredCapture = await screenshot(healthy, `14-settings-${kind}-recovered`);
        cases.push({ ...seed, rejection, rejectedReadError: rejection.error, unchanged, defaults, firstUse,
          stoppedTargetId: stopped.targetId, failedWorkerTargetId: failedWorker.targetId,
          recoveredWorkerTargetId: recoveredWorker.targetId, resetId: journal.value.resetId,
          screenshots: [errorCapture, confirmationCapture, recoveredCapture] });
        if (kind !== INTEGRATED_SETTINGS_CORRUPTION_KINDS.at(-1)) {
          await settings({ ...configuration, artifactControlState: INTEGRATED_FRESH_PROTOCOL_DEFAULTS.artifactControlState });
        }
      }
      return { cases, physicalSeedScope: 'exact_settings_core_in_owned_disposable_profile' };
    });
    await step('restore_settings', restore);
    requireIntegratedJourneyComplete(report.steps);
    for (const [id, diagnostic] of Object.entries(diagnostics)) {
      const snapshot = await diagnostic.snapshot();
      requireProof(snapshot.runtimeExceptions.length === 0, `PAGE_EXCEPTION:${id}`, snapshot.runtimeExceptions);
    }
    requireProof(report.browserStarts === 1, 'SINGLE_BROWSER_REQUIRED');
    await observe('journey_complete', { steps: report.steps.length, browserStarts: report.browserStarts });
    return { status: 'PASS', reportPath, steps: report.steps.length, browserStarts: report.browserStarts };
  } catch (error) {
    await captureFailure(error);
    throw error;
  }
}
