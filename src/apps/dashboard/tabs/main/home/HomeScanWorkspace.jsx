import { usePreferenceStore } from '@/apps/dashboard/stores/usePreferenceStore.js';
import { useDashboardFirstUse } from '@/apps/dashboard/bootstrap/DashboardFirstUseContext.jsx';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '@/platform/build/releaseCapabilities.js';
import { beginSettingsFlowTiming, endSettingsFlowTiming } from '@/platform/diagnostics/settingsFlowTiming.js';
import { applyZenMainCapturePressureRailProps } from '@zen-main-capture-profile';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ZenGardenFrame from '@/apps/dashboard/workspaces/garden/ZenGardenFrame.jsx';

import {
  applySessionSummaryNarrationToBrief,
  buildSessionSummaryDraftFromHomeScanSnapshot,
  buildSessionSummaryPresentationSignature,
} from '@/apps/dashboard/ai/sessionSummaryPresentation.js';
import {
  isMainPresentationFocusActive,
} from '@/apps/dashboard/presentation/mainPresentationFocus.js';
import BonsaiGrowthReveal from '@/apps/dashboard/progression/BonsaiGrowthReveal.jsx';
import BonsaiFirstBloomPrompt from '@/apps/dashboard/progression/BonsaiFirstBloomPrompt.jsx';
import { useBonsaiFirstBloom } from '@/apps/dashboard/progression/useBonsaiFirstBloom.js';
import { useDashboardPresentationAdmission } from '@/apps/dashboard/presentation/DashboardPresentationAdmission.jsx';
import { isBonsaiFirstBloomReady } from '@/apps/dashboard/progression/bonsaiFirstBloomAdmission.js';
import { useGuidanceAnchor, useGuidancePresenter, useGuidanceInteraction, GuidanceSupport } from '@/apps/dashboard/guidance/DashboardGuidanceProvider.jsx';
import { useInlineGuidanceReceipt } from '@/apps/dashboard/guidance/useInlineGuidanceReceipt.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { projectMainSiteRegistrationAvailability } from './mainSiteRegistrationAvailability.js';
import { useSiteRegistrationJourney } from '@/apps/dashboard/progression/useSiteRegistrationJourney.js';
import { createZenInvitationSlotState, reconcileZenInvitationSlotState, consumeZenInvitationSlot } from './zenInvitationSlotState.js';
import { getThemeProfile } from '@/themes/core/profile.js';
import { getThemeWidget } from '@/themes/core/registry/index.js';
import {
  ZEN_MAIN_SELECTION_MUTATION_POLICIES,
} from '@/themes/plugins/zen/presentation/main/zenMainSceneProjection.js';
import {
  useZenMainWorkerRenderBudget,
} from '@/themes/plugins/zen/runtime/useZenMainWorkerRenderBudget.js';
import {
  resolveZenPondRosterAuthority,
} from '@/themes/plugins/zen/pond/roster/zenPondRosterAuthority.js';
import {
  buildZenBonsaiMaterializationInputSignature,
} from '@/themes/plugins/zen/bonsai/state/ZenBonsaiMaterializationContract.js';
import {
  emitZenMainBootTrace,
} from '@/themes/plugins/zen/runtime/zenMainBootReadinessTrace.js';
import {
  isZenHomeFirstVisualFatalMilestone,
  normalizeZenHomeFirstVisualMilestone,
} from '@/themes/plugins/zen/runtime/zenHomeFirstVisualReadinessContract.js';
import { useZenInteractionStore } from '@/themes/plugins/zen/pond/state/stores/useZenInteractionStore.js';
import { resolveMainWidgetThemeId } from '../themeRegistry.js';
import {
  isZenHomeLiveFirstViewportReady,
  useZenHomeFirstViewportBootFrame,
} from './useZenHomeFirstViewportBootFrame.js';
import {
  isZenHomeBonsaiMaterializationAckCurrent,
  resolveZenHomeBonsaiLifecycleFrameInput,
  resolveZenHomeBonsaiMaterializationAck,
  resolveZenHomePendingBonsaiFrameAck,
  resolveZenHomeBonsaiPreparedMaterialization,
  resolveZenHomeFirstViewportNotification,
  resolveZenHomeSceneAck,
} from './zenHomeBonsaiFrameContract.js';
import {
  ZEN_HOME_PRESENTATION_SCENE_RENDERER_FAILURE_CODE,
  createZenHomePresentationSceneFatalError,
  createZenHomePresentationSceneAckGeneration,
  markZenHomePresentationSceneAckStalled,
  recordZenHomePresentationSceneAckAccepted,
  recordZenHomePresentationSceneAckRejected,
  resolveZenHomePresentationSceneAckStallFatalFailure,
} from './zenHomePresentationSceneAckCoordinator.js';
import {
  useZenHomeCompositionLayoutFrame,
} from './useZenHomeCompositionLayoutFrame.js';
import { resolveZenHomeCompositionReadingSpace } from './zenHomeCompositionLayoutFrame.js';
import { requireZenHomeCanopyReadingEnvelope } from '@/themes/plugins/zen/api/homeCanopyReading.js';
import ZenHomePressureDock from './ZenHomePressureDock.jsx';
import ZenHomeGardenPlanes from './ZenHomeGardenPlanes.jsx';
import { ZEN_HOME_GARDEN_BED_BOUNDARY_OVERSHOOT_CSS_PX } from '@/themes/plugins/zen/api/homeGardenBed.js';
import SessionSummaryAiEnrichment from './SessionSummaryAiEnrichment.jsx';
import ZenInvitationKoiRegistrationEditor from './ZenInvitationKoiRegistrationEditor.jsx';
import { ZEN_POND_REGISTRATION_PRESENTATION } from '@/themes/plugins/zen/pond/contracts/zenPondRegistrationPresentation.js';
import ZenFirstSiteRegistrationFeedback from './ZenFirstSiteRegistrationFeedback.jsx';
import { createFirstSiteRegistrationFeedback } from './firstSiteRegistrationFeedback.js';
import { useZenProtectedSiteKoiCandidates } from './useZenProtectedSiteKoiCandidates.js';
import { emitZenTrace } from '@zen-trace';
import {
  projectZenBonsaiLifecycleInputForProgressionUnlock,
} from '@/themes/plugins/zen/model/ZenBonsaiUnlockProgression.js';
import { projectZenBonsaiDebugLifecycleInput } from '@/themes/plugins/zen/bonsai/debug/zenBonsaiDebugOverrides.js';
import { useDashboardDevelopmentDock } from '@/apps/dashboard/layout/DashboardDevelopmentDockContext.js';
import './homeScanWorkspace.css';

const ZEN_HOME_FRAME_VARIANTS = Object.freeze({
  APERTURE: 'slab-aperture',
  CUT: 'slab-cut',
  INSCRIPTION: 'slab-inscription',
});

const ZEN_HOME_REGISTRATION_STYLE = Object.freeze({
  '--zen-registration-editor-x': `${ZEN_POND_REGISTRATION_PRESENTATION.editor.x * 100}%`,
  '--zen-registration-editor-y': ZEN_POND_REGISTRATION_PRESENTATION.editorTopCss,
});

const ZEN_HOME_FRAME_PAINT_STYLE = Object.freeze({
  '--zen-home-frame-paint-bleed': `${ZEN_HOME_GARDEN_BED_BOUNDARY_OVERSHOOT_CSS_PX}px`,
});

const EMPTY_HOME_LIST = Object.freeze([]);

const HOME_LAYOUT_CLASSNAMES = Object.freeze({
  root: 'home-main-frame relative flex h-full min-h-0 w-full flex-col',
  framedRoot: 'zen-home-frame relative flex h-full min-h-0 w-full flex-col overflow-hidden',
  topRow: 'home-main-vision-grid grid min-h-0 min-w-0 flex-1 gap-4 p-4 pb-4 grid-cols-1 grid-rows-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:grid-cols-[minmax(0,1.58fr)_minmax(320px,0.96fr)] lg:grid-rows-1 lg:gap-5 lg:p-5 lg:pb-5',
  scannerSlot: 'home-main-scanner-slot relative h-full min-h-0 min-w-0',
  coreSlot: 'home-main-core-slot relative h-full min-h-0 min-w-0',
  bottomSlot: 'home-main-brief-slot relative w-full shrink-0 min-h-[132px] basis-[22%] px-4 pb-4',
});

function BottomFallback() {
  return <div className="zen-home-pending-plane" aria-hidden="true" />;
}

function requireThemeWidget(themeId, widgetType, Component) {
  if (Component) return Component;
  throw new Error(`[HomeScanWorkspace] Theme '${themeId}' must declare widget '${widgetType}'.`);
}

function buildTraceSignature(value) {
  try {
    return JSON.stringify(value) || '';
  } catch (error) {
    return `unserializable:${String(error?.message || error || 'unknown')}`;
  }
}

function normalizeVisualDomain(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : '';
}

function roundVisualNumber(value, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
}

function roundVisualMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric / 60_000);
}

function buildVisualDomainSignatureEntries(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry, index) => {
      const domain = normalizeVisualDomain(entry?.domain);
      if (!domain) return null;
      const cohort = typeof entry?.cohort === 'string' ? entry.cohort : '';
      const policyStatus = typeof entry?.policyStatus === 'string' ? entry.policyStatus : '';
      const policyDisposition = typeof entry?.policyDisposition === 'string'
        ? entry.policyDisposition
        : '';
      return {
        domain,
        rank: Math.max(1, Math.floor(Number(entry?.visibleRank || entry?.rank || index + 1))),
        cohort,
        policyStatus,
        policyDisposition,
        pressureShare: roundVisualNumber(entry?.pressureShare, 6),
        blocked: entry?.blocked === true,
        managed: entry?.managed === true,
      };
    })
    .filter(Boolean);
}

function buildPondVisualFrameSignature(frame = null) {
  return buildTraceSignature({
    candidates: buildVisualDomainSignatureEntries(frame?.scannerDomainCandidateList),
    candidateCount: Math.max(0, Math.floor(Number(frame?.scannerDomainCandidateCount) || 0)),
    targetCount: Math.max(0, Math.floor(Number(frame?.signalScannerTargetCount) || 0)),
    statusSnapshotReady: frame?.statusSnapshotReady === true,
    statusSnapshotAvailable: frame?.statusSnapshotAvailable === true,
    statusSnapshotPolicyCurrent: frame?.statusSnapshotPolicyCurrent === true,
    pondRuntimeMountReady: frame?.pondRuntimeMountReady === true,
    requirePondRosterForRuntimeMount: frame?.requirePondRosterForRuntimeMount === true,
    rosterAuthorityState: frame?.pondRosterAuthority?.state || null,
    rosterAuthoritySource: frame?.pondRosterAuthority?.source || null,
  });
}

function buildBonsaiVisualFrameSignature(frame = null) {
  const input = frame?.bonsaiLifecycleInput || null;
  return buildTraceSignature({
    ready: frame?.bonsaiEvidenceReady === true,
    source: frame?.bonsaiLifecycleInputSource || null,
    authorityState: frame?.bonsaiEvidenceAuthorityState || null,
    authorityReason: frame?.bonsaiEvidenceAuthorityReason || null,
    cycleScore: roundVisualNumber(input?.cycleScore, 1),
    dailyScore: roundVisualNumber(input?.dailyScore, 1),
    dailyDisplayScore: roundVisualNumber(input?.dailyDisplayScore, 1),
    dailyLimitPercent: roundVisualNumber(input?.dailyLimitPercent, 1),
    signalCount: Math.max(0, Math.floor(Number(input?.signalCount) || 0)),
    todayActiveMin: roundVisualMs(input?.todayActiveMs),
    todayProtectedMin: roundVisualMs(input?.todayProtectedMs),
    weeklyProtectedAverageMin: roundVisualMs(input?.weeklyProtectedAverageMs),
    registeredSiteSignature: input?.registeredSiteSignature || '',
    registeredSiteGoalCount: Math.max(0, Math.floor(Number(input?.registeredSiteGoalCount) || 0)),
    registeredSiteRuleCount: Math.max(0, Math.floor(Number(input?.registeredSiteRuleCount) || 0)),
    presentationMode: input?.bonsaiPresentationMode || null,
    cultivationLedgerPolicy: input?.bonsaiCultivationLedgerPolicy || null,
    debugLifePreview: input?.bonsaiDebugPreview || null,
    sceneCommitKey: frame?.presentationSceneCommitKey || null,
    materializationPrepared: frame?.bonsaiMaterializationPrepared === true,
    materializationInputSignature: frame?.bonsaiMaterializationInputSignature || '',
    materializationKey: frame?.bonsaiMaterializationKey || '',
  });
}

function buildRhythmVisualFrameSignature(snapshot = null) {
  const dailyFlow = snapshot?.dailyFlow || null;
  const series = Array.isArray(dailyFlow?.series) ? dailyFlow.series : [];
  const pressureSeries = Array.isArray(dailyFlow?.pressureProfile?.series)
    ? dailyFlow.pressureProfile.series
    : [];
  return buildTraceSignature({
    lensDomain: normalizeVisualDomain(snapshot?.rhythmLensDomain),
    summaryLensDomain: normalizeVisualDomain(snapshot?.rhythmSummary?.lens?.domain),
    targetDomain: normalizeVisualDomain(dailyFlow?.targetDomain),
    targetMin: roundVisualMs(dailyFlow?.targetMs),
    series: series.map((entry) => ({
      hour: Math.max(0, Math.floor(Number(entry?.hour) || 0)),
      totalMin: roundVisualMs(entry?.totalMs),
      protectedMin: roundVisualMs(entry?.protectedMs),
      targetMin: roundVisualMs(entry?.targetMs),
    })),
    pressureSummary: {
      mode: snapshot?.pressureSummary?.mode || null,
      windowDays: Math.max(0, Math.floor(Number(snapshot?.pressureSummary?.windowDays) || 0)),
      totalMin: roundVisualMs(snapshot?.pressureSummary?.totalMs),
      protectedMin: roundVisualMs(snapshot?.pressureSummary?.protectedMs),
      activeDayCount: Math.max(0, Math.floor(Number(snapshot?.pressureSummary?.activeDayCount) || 0)),
      readinessState: snapshot?.pressureSummary?.readiness?.state || null,
      readinessContentState: snapshot?.pressureSummary?.readiness?.contentState || null,
      readinessObservedDays: Math.max(0, Math.floor(Number(snapshot?.pressureSummary?.readiness?.observedDayCount) || 0)),
      readinessTargetDays: Math.max(0, Math.floor(Number(snapshot?.pressureSummary?.readiness?.targetDayCount) || 0)),
    },
    pressureProfile: {
      selectedActiveDayCount: Math.max(0, Math.floor(Number(dailyFlow?.pressureProfile?.evidence?.selectedActiveDayCount) || 0)),
      activeDayCount: Math.max(0, Math.floor(Number(dailyFlow?.pressureProfile?.evidence?.activeDayCount) || 0)),
      series: pressureSeries.map((entry) => ({
        hour: Math.max(0, Math.floor(Number(entry?.hour) || 0)),
        totalMin: roundVisualMs(entry?.totalPressureMs),
        targetMin: roundVisualMs(entry?.targetPressureMs),
      })),
    },
    topSites: buildVisualDomainSignatureEntries(snapshot?.rhythmTopSites).map((entry, index) => ({
      ...entry,
      rank: Math.max(1, Math.floor(Number(entry?.rank || index + 1))),
    })),
    habitCueId: snapshot?.habitCue?.id || null,
  });
}

const MAIN_SIGNAL_SCANNER_INPUT_MODES = Object.freeze({
  TARGETS: 'targets',
  DOMAIN_CANDIDATES: 'domain-candidates',
});

const HOME_BOTTOM_VARIANTS = Object.freeze({
  BRIEF_CARD: 'brief-card',
  PRESSURE_RAIL: 'pressure-rail',
});

const EMBEDDED_CORE_STATUS_VARIANTS = Object.freeze({
  DEFAULT: 'default',
  AMBIENT_HOME: 'ambient-home',
});

function resolveHomeWorkspacePolicy(themeId) {
  const themeProfile = getThemeProfile(themeId);
  const rawSignalScannerInput = themeProfile?.main?.signalScannerInput;
  const rawHomeBottomVariant = themeProfile?.main?.homeBottomVariant;
  const rawEmbeddedCoreStatusVariant = themeProfile?.main?.embeddedCoreStatusVariant;

  return {
    signalScannerInput: rawSignalScannerInput === MAIN_SIGNAL_SCANNER_INPUT_MODES.DOMAIN_CANDIDATES
      ? MAIN_SIGNAL_SCANNER_INPUT_MODES.DOMAIN_CANDIDATES
      : MAIN_SIGNAL_SCANNER_INPUT_MODES.TARGETS,
    parkSignalScannerRuntimeOnUnmount: Boolean(themeProfile?.main?.parkSignalScannerRuntimeOnUnmount),
    homeBottomVariant: rawHomeBottomVariant === HOME_BOTTOM_VARIANTS.PRESSURE_RAIL
      ? HOME_BOTTOM_VARIANTS.PRESSURE_RAIL
      : HOME_BOTTOM_VARIANTS.BRIEF_CARD,
    embeddedCoreStatusVariant: rawEmbeddedCoreStatusVariant === EMBEDDED_CORE_STATUS_VARIANTS.AMBIENT_HOME
      ? EMBEDDED_CORE_STATUS_VARIANTS.AMBIENT_HOME
      : EMBEDDED_CORE_STATUS_VARIANTS.DEFAULT,
  };
}

function HomeScanWorkspace({
  surfaceActivity,
  gardenMode = 'pond',
  pathwaysSlot = null,
  gardenControlSlot = null,
  gardenTransitionError = null,
  pondPresentationReady = false,
  animateWorkArea = false,
  onPondPresentationReady = null,
  themeId,
  solarLocationProfile = null,
  ctrl,
  scanSnapshot,
  mainPresentationProjection = null,
  zenMainCaptureProfile = null,
  progressionUnlockSnapshot = null,
  journeyProgressSlot = null,
  registrationIntent = null,
  onRegistrationIntentHandled = null,
  onInvitationCapacityAdmitted = null,
  bootShellDismissed = true,
  bootShellRevealStarted = false,
  bootTraceContext = null,
  onFirstVisualMilestone = null,
  onRuntimeFirstFrameReady = null,
  onBonsaiFirstFrameReady = null,
  onFirstViewportReady = null,
  onMainPresentationSceneCommitted = null,
}) {
  const { workspaceActive: isActive, pondActive, bonsaiActive, compositeActive } = surfaceActivity;
  const presentationAdmission = useDashboardPresentationAdmission();
  const pondInteractive = pondActive && gardenMode === 'pond';
  const { t, i18n } = useAppTranslation('main');
  const firstUse = useDashboardFirstUse();
  const firstUseWasRequiredRef = useRef(firstUse.required);
  const locale = i18n?.resolvedLanguage || i18n?.language || 'en';
  const runtimeActiveRef = useRef(isActive);
  runtimeActiveRef.current = isActive;
  const pondActiveRef = useRef(pondActive);
  pondActiveRef.current = pondActive;
  const bonsaiActiveRef = useRef(bonsaiActive);
  bonsaiActiveRef.current = bonsaiActive;
  const compositeActiveRef = useRef(compositeActive);
  compositeActiveRef.current = compositeActive;
  const livePondFrameAckRef = useRef(null);
  if (!pondActive) livePondFrameAckRef.current = null;
  const mainWidgetThemeId = useMemo(() => resolveMainWidgetThemeId(themeId), [themeId]);
  const homeWorkspacePolicy = useMemo(() => resolveHomeWorkspacePolicy(mainWidgetThemeId), [mainWidgetThemeId]);
  const SignalScanner = useMemo(() => getThemeWidget(mainWidgetThemeId, 'SignalScanner'), [mainWidgetThemeId]);
  const CoreStatus = useMemo(() => getThemeWidget(mainWidgetThemeId, 'CoreStatus'), [mainWidgetThemeId]);
  const rendersPressureRailHome = homeWorkspacePolicy.homeBottomVariant === HOME_BOTTOM_VARIANTS.PRESSURE_RAIL;
  const homeStageRef = useRef(null);
  const homePondSlotRef = useRef(null);
  const homeBonsaiSlotRef = useRef(null);
  const homePressureRailSlotRef = useRef(null);
  const registrationEntryRef = useRef(null);
  const [invitationRegistrationOpen, setInvitationRegistrationOpen] = useState(false);
  const invitationGuidance = useGuidancePresenter('garden.first_site');
  useInlineGuidanceReceipt(mainWidgetThemeId === 'zen' ? null : invitationGuidance, registrationEntryRef, false);
  useGuidanceInteraction({ id: 'site_registration', active: invitationRegistrationOpen && pondInteractive,
    retainedGuideId: 'garden.first_site' });
  const [firstSiteRegistrationFeedback, setFirstSiteRegistrationFeedback] = useState(null);
  const [invitationAssignment, setInvitationAssignment] = useState(null);
  const [invitationRegistrationPending, setInvitationRegistrationPending] = useState(false);
  const [invitationAdmissionError, setInvitationAdmissionError] = useState(null);
  const admittedInvitationCapacityRef = useRef(0);
  const [selectedInvitationEntityId, setSelectedInvitationEntityId] = useState(null);
  const [physicalInvitationEntityIds, setPhysicalInvitationEntityIds] = useState([]);
  const handleInvitationKoiMembershipChange = useCallback((entityIds) => {
    setPhysicalInvitationEntityIds(current => JSON.stringify(current) === JSON.stringify(entityIds) ? current : entityIds);
  }, []);
  const [invitationSlotState, setInvitationSlotState] = useState(createZenInvitationSlotState);
  const invitationIdentityRef = useRef(null);
  if (invitationIdentityRef.current === null) invitationIdentityRef.current = crypto.randomUUID();
  const [firstSiteCandidate, setFirstSiteCandidate] = useState(null);
  const handledRegistrationIntentRef = useRef(null);
  const { snapshot: registrationJourney, error: registrationJourneyError } = useSiteRegistrationJourney({
    enabled: pondInteractive, revalidateOnEnable: true,
  });
  const usesZenPressureRailLayout = mainWidgetThemeId === 'zen' && rendersPressureRailHome;
  const [homeCanopyReadingReceipt, setHomeCanopyReadingReceipt] = useState(null);
  const handleHomeCanopyReadingEnvelope = useCallback((receipt) => {
    if (receipt !== null) {
      if (typeof receipt.sceneCommitKey !== 'string' || !receipt.sceneCommitKey) {
        throw new Error('ZEN_HOME_CANOPY_READING_SCENE_REQUIRED');
      }
      requireZenHomeCanopyReadingEnvelope(receipt.envelope);
    }
    setHomeCanopyReadingReceipt(current => JSON.stringify(current) === JSON.stringify(receipt) ? current : receipt);
  }, []);
  const homeCompositionLayoutFrame = useZenHomeCompositionLayoutFrame({
    enabled: usesZenPressureRailLayout && isActive,
    retainFrameWhenDisabled: usesZenPressureRailLayout,
    stageRef: homeStageRef,
    pondRef: homePondSlotRef,
    bonsaiRef: homeBonsaiSlotRef,
    pressureRailRef: homePressureRailSlotRef,
  });
  const homeGardenBedLayoutFrame = homeCompositionLayoutFrame ? homeCompositionLayoutFrame.gardenBed : null;
  const homePressureLayoutFrame = homeCompositionLayoutFrame ? homeCompositionLayoutFrame.pressure : null;
  const pondProjection = mainPresentationProjection?.pond || null;
  const bonsaiProjection = mainPresentationProjection?.bonsai || null;
  const rhythmProjection = mainPresentationProjection?.rhythm || null;
  const interactionProjection = mainPresentationProjection?.interaction || null;
  const visualEmphasisProjection = mainPresentationProjection?.visualEmphasis || null;
  const presentationSceneCommitKey = typeof mainPresentationProjection?.sceneCommitKey === 'string'
    ? mainPresentationProjection.sceneCommitKey
    : null;
  const homeReadingSpace = useMemo(() => resolveZenHomeCompositionReadingSpace({
    compositionFrame: homeCompositionLayoutFrame,
    canopyEnvelope: homeCanopyReadingReceipt?.sceneCommitKey === presentationSceneCommitKey
      && homeCanopyReadingReceipt !== null ? homeCanopyReadingReceipt.envelope : null,
  }), [homeCanopyReadingReceipt, homeCompositionLayoutFrame, presentationSceneCommitKey]);
  const mainPresentationEmphasisMode = visualEmphasisProjection?.active === true
    && typeof visualEmphasisProjection.mode === 'string'
    ? visualEmphasisProjection.mode
    : undefined;
  const mainPresentationInteractionLocked = interactionProjection?.locked === true;
  const pondFirstVisionPresentation = pondProjection?.firstVisionPresentation === true;
  const bonsaiFirstVisionPresentation = bonsaiProjection?.firstVisionPresentation === true;
  const firstVisionFocusActive = mainWidgetThemeId === 'zen'
    && isMainPresentationFocusActive(mainPresentationProjection?.decision);
  const bootVisualHoldActive = mainWidgetThemeId === 'zen'
    && bootShellDismissed !== true
    && firstVisionFocusActive !== true;
  const bootVisualCaptureActive = bootVisualHoldActive
    && bootShellRevealStarted !== true;
  const rhythmAllowsLiveSelection = rhythmProjection?.selectionMutation === ZEN_MAIN_SELECTION_MUTATION_POLICIES.WRITE_CURRENT;
  const presentationSelectionLocked = mainPresentationInteractionLocked;
  const hoveredKoiDomain = useZenInteractionStore((state) => (
    pondInteractive ? state.hoveredDomain : null
  ));
  const setExternalHoverDomain = useZenInteractionStore((state) => state.setExternalHoverDomain);
  const setPressureRailInteractionActive = useZenInteractionStore((state) => state.setPressureRailInteractionActive);
  const scannerDomainCandidates = ctrl.visibleDomainCandidates;
  const scannerDomainCandidateList = useMemo(
    () => (Array.isArray(scannerDomainCandidates) ? scannerDomainCandidates : []),
    [scannerDomainCandidates],
  );
  const allDomainCandidateList = useMemo(
    () => (Array.isArray(ctrl?.domainCandidates) ? ctrl.domainCandidates : []),
    [ctrl?.domainCandidates],
  );
  const scannerLockedTarget = presentationSelectionLocked
    ? undefined
    : (ctrl.rhythmLensDomain || ctrl.lockedTarget || null);
  const scannerLockTargetHandler = presentationSelectionLocked || !pondInteractive
    ? null
    : ctrl.setLockedTarget;
  const registeredSiteDomains = useMemo(() => Array.from(new Set([
    ...Object.keys(ctrl?.goals?.siteLimits || {}),
    ...(Array.isArray(ctrl?.blockedList) ? ctrl.blockedList : []),
    ...(Array.isArray(ctrl?.allowedList) ? ctrl.allowedList : []),
  ])).map((domain) => String(domain).trim().toLowerCase()).filter(Boolean).sort(), [
    ctrl?.allowedList,
    ctrl?.blockedList,
    ctrl?.goals?.siteLimits,
  ]);
  const protectedSiteKoiCandidates = useZenProtectedSiteKoiCandidates({
    registeredSiteDomains,
    domainCandidates: allDomainCandidateList,
    blockedDomains: ctrl?.blockedList,
    focusedDomain: firstSiteRegistrationFeedback?.domain || scannerLockedTarget,
    enabled: mainWidgetThemeId === 'zen' && pondActive && pondFirstVisionPresentation !== true,
  });
  const liveScannerDomainCandidateList = mainWidgetThemeId === 'zen'
    && pondFirstVisionPresentation !== true
    ? protectedSiteKoiCandidates
    : scannerDomainCandidateList;
  const registrationAvailability = useMemo(() => projectMainSiteRegistrationAvailability(
    registrationJourney,
  ), [registrationJourney]);
  const invitationKoiVisible = mainWidgetThemeId === 'zen'
    && bootShellDismissed === true
    && pondFirstVisionPresentation !== true;
  const invitationKoiInteractive = invitationKoiVisible
    && pondInteractive
    && !invitationRegistrationOpen
    && mainPresentationInteractionLocked !== true
    && registrationAvailability?.available === true;
  useEffect(() => {
    if (!pondInteractive || !invitationKoiVisible || registrationJourney === null || invitationRegistrationPending) return;
    setInvitationSlotState(current => reconcileZenInvitationSlotState(current, {
      journey: registrationJourney, identity: invitationIdentityRef.current,
    }));
  }, [pondInteractive, invitationKoiVisible, registrationJourney, invitationRegistrationPending]);
  const invitationSlots = invitationKoiVisible ? invitationSlotState.slots : [];
  const handleInvitationKoiActivate = useCallback((entityId) => {
    if (!pondInteractive || !bootShellDismissed || mainPresentationInteractionLocked
        || registrationAvailability?.available !== true) return;
    const selected = typeof entityId === 'string'
      ? invitationSlots.find(slot => slot.entityId === entityId)
      : invitationSlots.find(slot => physicalInvitationEntityIds.includes(slot.entityId));
    if (mainWidgetThemeId === 'zen' && !selected) return;
    setSelectedInvitationEntityId(selected ? selected.entityId : null);
    setFirstSiteRegistrationFeedback(null);
    setFirstSiteCandidate(null);
    setInvitationRegistrationOpen(true);
  }, [pondInteractive, bootShellDismissed, mainPresentationInteractionLocked, registrationAvailability,
    invitationSlots, mainWidgetThemeId, physicalInvitationEntityIds]);
  const handleInvitationRegistrationClose = useCallback(() => {
    setInvitationRegistrationOpen(false);
    setSelectedInvitationEntityId(null);
    setFirstSiteCandidate(null);
  }, []);
  useEffect(() => {
    if (invitationRegistrationPending) return;
    if (firstUseWasRequiredRef.current && !firstUse.required) handleInvitationRegistrationClose();
    firstUseWasRequiredRef.current = firstUse.required;
  }, [firstUse.required, invitationRegistrationPending, handleInvitationRegistrationClose]);
  const dismissFirstSiteRegistrationFeedback = useCallback(() => setFirstSiteRegistrationFeedback(null), []);
  const commitInvitationRegistration = useCallback(async (command) => {
    if (mainWidgetThemeId === 'zen' && !selectedInvitationEntityId) {
      throw new Error('ZEN_INVITATION_REGISTRATION_IDENTITY_REQUIRED');
    }
    setInvitationRegistrationPending(true);
    try {
      const registrationStarted = BUILD_INCLUDE_DEBUG_TOOLS ? performance.now() : null;
      const result = await command();
      if (BUILD_INCLUDE_DEBUG_TOOLS) console.debug('[SETTINGS_FLOW][timing]', JSON.stringify({
        phase: 'registration_ready', ok: result.ok,
        durationMs: performance.now() - registrationStarted,
      }));
      if (result.ok) {
        const feedbackStarted = beginSettingsFlowTiming();
        if (mainWidgetThemeId === 'zen' && result.kind !== 'already_protected') {
          setInvitationAssignment({ domain: result.domain, receiptId: crypto.randomUUID(),
            invitationEntityId: selectedInvitationEntityId });
          setInvitationSlotState(current => consumeZenInvitationSlot(current, {
            entityId: selectedInvitationEntityId,
          }));
        }
        setFirstSiteRegistrationFeedback(createFirstSiteRegistrationFeedback(result));
        // The guidance provider owns receipt settlement and visible failures;
        // the confirmed registration can finish while that work continues.
        void invitationGuidance?.onComplete();
        endSettingsFlowTiming('registration_feedback_requested', feedbackStarted);
      }
      return result;
    } finally {
      setInvitationRegistrationPending(false);
    }
  }, [mainWidgetThemeId, selectedInvitationEntityId, invitationGuidance]);
  const handleFirstSiteRegistration = useCallback((domain, options) => commitInvitationRegistration(
    () => ctrl.handleRegisterProtectedSite(domain, options),
  ), [ctrl.handleRegisterProtectedSite, commitInvitationRegistration]);
  const handleFirstSiteMoveConfirmation = useCallback((admission, options) => commitInvitationRegistration(
    () => ctrl.handleConfirmProtectedSiteMove(admission, options),
  ), [ctrl.handleConfirmProtectedSiteMove, commitInvitationRegistration]);
  useEffect(() => {
    if (!isActive) {
      setFirstSiteRegistrationFeedback(null);
      setInvitationAssignment(null);
    }
  }, [isActive]);
  const handleInvitationOpenSites = useCallback((domain) => {
    setInvitationRegistrationOpen(false);
    ctrl.handleManageSites(domain);
  }, [ctrl.handleManageSites]);
  useEffect(() => {
    if (mainWidgetThemeId !== 'zen' || invitationKoiVisible) return;
    setInvitationRegistrationOpen(false);
  }, [invitationKoiVisible, mainWidgetThemeId]);
  useEffect(() => {
    if (!pondInteractive || !bootShellDismissed || mainPresentationInteractionLocked || registrationJourney === null) return;
    const candidate = registrationIntent;
    if (!candidate) return;
    if (registrationIntent && handledRegistrationIntentRef.current === registrationIntent) return;
    if (ctrl.blockedList.includes(candidate.domain)) {
      handledRegistrationIntentRef.current = registrationIntent;
      onRegistrationIntentHandled?.();
      return;
    }
    const slot = invitationSlots.find(item => physicalInvitationEntityIds.includes(item.entityId));
    if (mainWidgetThemeId === 'zen' && registrationJourney.available && !slot) return;
    setSelectedInvitationEntityId(slot ? slot.entityId : null);
    setFirstSiteRegistrationFeedback(null);
    setFirstSiteCandidate(candidate);
    setInvitationRegistrationOpen(true);
    handledRegistrationIntentRef.current = registrationIntent;
    onRegistrationIntentHandled?.();
  }, [pondInteractive, bootShellDismissed, mainPresentationInteractionLocked, registrationJourney,
    registrationIntent, invitationSlots, mainWidgetThemeId,
    onRegistrationIntentHandled, ctrl.blockedList, physicalInvitationEntityIds]);
  const zenRenderPreset = usePreferenceStore((state) => state.zenRenderPreset);
  const mainWorkerRenderBudget = useZenMainWorkerRenderBudget({ preset: zenRenderPreset });
  const scannerDomainCandidateCount = liveScannerDomainCandidateList.length;
  const signalScannerTargetCount = Array.isArray(ctrl?.signalScannerTargets)
    ? ctrl.signalScannerTargets.length
    : 0;
  const statusSnapshotReady = ctrl?.statusSnapshotReady === true;
  const statusSnapshotAvailable = ctrl?.statusSnapshotAvailable === true;
  const statusSnapshotPolicyCurrent = ctrl?.statusSnapshotPolicyCurrent === true;
  const pondRosterAuthority = useMemo(() => resolveZenPondRosterAuthority({
    mainWidgetThemeId,
    pondFirstVisionPresentation,
    registeredSiteDomainCount: registeredSiteDomains.length,
    statusSnapshotPolicyCurrent,
    statusSnapshotReady,
  }), [
    mainWidgetThemeId,
    pondFirstVisionPresentation,
    registeredSiteDomains.length,
    statusSnapshotPolicyCurrent,
    statusSnapshotReady,
  ]);
  const pondRuntimeMountReady = pondRosterAuthority.runtimeMountReady;
  const requirePondRosterForRuntimeMount = pondRosterAuthority.requireRosterForRuntimeMount;
  const livePondVisualFrame = useMemo(() => ({
    scannerDomainCandidateList: liveScannerDomainCandidateList,
    scannerDomainCandidateCount,
    signalScannerTargetCount,
    statusSnapshotReady,
    statusSnapshotAvailable,
    statusSnapshotPolicyCurrent,
    pondRosterAuthority,
    pondRuntimeMountReady,
    requirePondRosterForRuntimeMount,
  }), [
    liveScannerDomainCandidateList,
    scannerDomainCandidateCount,
    signalScannerTargetCount,
    statusSnapshotReady,
    statusSnapshotAvailable,
    statusSnapshotPolicyCurrent,
    pondRosterAuthority,
    pondRuntimeMountReady,
    requirePondRosterForRuntimeMount,
  ]);
  const pondVisualFrameSignature = useMemo(
    () => buildPondVisualFrameSignature(livePondVisualFrame),
    [livePondVisualFrame],
  );
  const authoritativeBonsaiLifecycleInput = useMemo(() => {
    if (ctrl?.bonsaiEvidenceReady !== true) {
      return null;
    }
    return {
      bonsaiEvidenceReady: true,
      daysTracked: ctrl?.daysTracked,
      cycleScore: ctrl?.cycleScore,
      dailyScore: ctrl?.dailyScore,
      dailyDisplayScore: ctrl?.dailyDisplayScore,
      dailyScoringMode: ctrl?.dailyScoringMode,
      dailyLimitPercent: ctrl?.dailyLimitPercent,
      signalCount: ctrl?.signalCount,
      todayActiveMs: ctrl?.todayActiveMs,
      todayProtectedMs: ctrl?.todayProtectedMs,
      weeklyProtectedAverageMs: ctrl?.weeklyProtectedAverageMs,
      activeProtectionDayCount: ctrl?.activeProtectionDayCount,
      protectedVisitCount: ctrl?.protectedVisitCount,
      frictionSuccessCount: ctrl?.frictionSuccessCount,
      registeredSiteGoalCount: Object.keys(ctrl?.goals?.siteLimits || {}).filter(
        (domain) => Number(ctrl?.goals?.siteLimits?.[domain]) > 0
      ).length,
      registeredSiteRuleCount: registeredSiteDomains.length,
      registeredSiteDomains,
      registeredSiteSignature: registeredSiteDomains.join(','),
      scoreLedger: ctrl?.scoreLedger,
      scoreSummary: ctrl?.scoreSummary,
      scoreInsights: ctrl?.scoreInsights,
      dailyOutcome: ctrl?.dailyOutcome,
      bonsaiPresentationMode: bonsaiProjection?.profileMode || null,
      bonsaiCultivationLedgerPolicy: bonsaiProjection?.cultivationLedgerPolicy || null,
    };
  }, [
    bonsaiProjection?.cultivationLedgerPolicy,
    bonsaiProjection?.profileMode,
    ctrl?.cycleScore,
    ctrl?.dailyLimitPercent,
    ctrl?.dailyOutcome,
    ctrl?.dailyScore,
    ctrl?.dailyDisplayScore,
    ctrl?.dailyScoringMode,
    ctrl?.daysTracked,
    ctrl?.activeProtectionDayCount,
    ctrl?.bonsaiEvidenceReady,
    ctrl?.blockedList,
    ctrl?.frictionSuccessCount,
    ctrl?.goals?.siteLimits,
    ctrl?.protectedVisitCount,
    registeredSiteDomains,
    ctrl?.scoreInsights,
    ctrl?.scoreLedger,
    ctrl?.scoreSummary,
    ctrl?.signalCount,
    ctrl?.todayActiveMs,
    ctrl?.todayProtectedMs,
    ctrl?.weeklyProtectedAverageMs,
  ]);
  const bonsaiEvidenceAuthority = ctrl?.bonsaiEvidenceAuthority || null;
  const progressionBonsaiLifecycleInput = useMemo(() => (
    mainWidgetThemeId === 'zen' && progressionUnlockSnapshot
      ? projectZenBonsaiLifecycleInputForProgressionUnlock(
        authoritativeBonsaiLifecycleInput,
        progressionUnlockSnapshot,
      )
      : authoritativeBonsaiLifecycleInput
  ), [
    authoritativeBonsaiLifecycleInput,
    mainWidgetThemeId,
    progressionUnlockSnapshot,
  ]);
  const bonsaiLifecycleFrameInput = useMemo(
    () => resolveZenHomeBonsaiLifecycleFrameInput({
      firstVisionPresentation: bonsaiFirstVisionPresentation,
      presentationMode: bonsaiProjection?.profileMode || null,
      cultivationLedgerPolicy: bonsaiProjection?.cultivationLedgerPolicy || null,
      authoritativeInput: progressionBonsaiLifecycleInput,
    }),
    [
      progressionBonsaiLifecycleInput,
      bonsaiFirstVisionPresentation,
      bonsaiProjection?.cultivationLedgerPolicy,
      bonsaiProjection?.profileMode,
    ],
  );
  const [bonsaiDebugPreview, setBonsaiDebugPreview] = useState({
    growthPercent: null,
    bloomPercent: null,
    activationPercent: null,
    baseLifeState: null,
  });
  const bonsaiDebugDock = useDashboardDevelopmentDock();
  const handleBonsaiDebugActivationForce = useCallback(activationPercent => {
    setBonsaiDebugPreview(current => ({ ...current, activationPercent }));
  }, []);
  const bonsaiDebugPreviewAvailable = BUILD_INCLUDE_DEBUG_TOOLS
    && mainWidgetThemeId === 'zen'
    && !bonsaiFirstVisionPresentation
    && !mainPresentationInteractionLocked
    && !zenMainCaptureProfile
    && bonsaiLifecycleFrameInput.input !== null;
  const handleBonsaiDebugGrowthForce = useCallback((growthPercent, lifeState) => {
    setBonsaiDebugPreview((current) => ({
      ...current,
      growthPercent,
      baseLifeState: growthPercent === null && current.bloomPercent === null
        ? null
        : (current.growthPercent !== null || current.bloomPercent !== null
          ? current.baseLifeState : lifeState),
    }));
  }, []);
  const handleBonsaiDebugBloomForce = useCallback((bloomPercent, lifeState) => {
    setBonsaiDebugPreview((current) => ({
      ...current,
      bloomPercent,
      baseLifeState: bloomPercent === null && current.growthPercent === null
        ? null
        : (current.growthPercent !== null || current.bloomPercent !== null
          ? current.baseLifeState : lifeState),
    }));
  }, []);
  const bonsaiLifecycleInput = useMemo(() => (
    bonsaiDebugPreviewAvailable
      ? projectZenBonsaiDebugLifecycleInput(bonsaiLifecycleFrameInput.input, bonsaiDebugPreview)
      : bonsaiLifecycleFrameInput.input
  ), [bonsaiDebugPreview, bonsaiDebugPreviewAvailable, bonsaiLifecycleFrameInput.input]);
  const bonsaiLifeDebugControls = useMemo(() => (
    bonsaiDebugPreviewAvailable ? {
      panelPlacement: bonsaiDebugDock,
      activation: {
        forcedPercent: bonsaiDebugPreview.activationPercent,
        onForce: handleBonsaiDebugActivationForce,
        onReset: () => handleBonsaiDebugActivationForce(null),
      },
      growth: {
        forcedPercent: bonsaiDebugPreview.growthPercent,
        onForce: handleBonsaiDebugGrowthForce,
        onReset: () => handleBonsaiDebugGrowthForce(null),
      },
      bloom: {
        forcedPercent: bonsaiDebugPreview.bloomPercent,
        onForce: handleBonsaiDebugBloomForce,
        onReset: () => handleBonsaiDebugBloomForce(null),
      },
    } : null
  ), [
    bonsaiDebugPreview,
    bonsaiDebugDock,
    handleBonsaiDebugActivationForce,
    bonsaiDebugPreviewAvailable,
    handleBonsaiDebugBloomForce,
    handleBonsaiDebugGrowthForce,
  ]);
  const bonsaiLifecycleInputSource = bonsaiLifecycleFrameInput.source;
  const bonsaiEvidenceAuthorityState = bonsaiEvidenceAuthority?.state || 'unavailable';
  const bonsaiEvidenceAuthorityReason = bonsaiEvidenceAuthority?.reason || null;
  const bonsaiLifecycleInputSignature = useMemo(
    () => buildZenBonsaiMaterializationInputSignature(bonsaiLifecycleInput),
    [bonsaiLifecycleInput],
  );
  const presentationSceneCommitKeyRef = useRef(presentationSceneCommitKey);
  presentationSceneCommitKeyRef.current = presentationSceneCommitKey;
  const mainPresentationPhaseRef = useRef(mainPresentationProjection?.decision?.phase || null);
  mainPresentationPhaseRef.current = mainPresentationProjection?.decision?.phase || null;
  const bonsaiLifecycleInputSignatureRef = useRef(bonsaiLifecycleInputSignature);
  bonsaiLifecycleInputSignatureRef.current = bonsaiLifecycleInputSignature;
  const [preparedBonsaiMaterializationState, setPreparedBonsaiMaterializationState] = useState(null);
  const [acceptedBonsaiFrameState, setAcceptedBonsaiFrameState] = useState(null);
  const [presentationSceneFatalError, setPresentationSceneFatalError] = useState(null);
  const presentationSceneFatalErrorRef = useRef(null);
  const preparedBonsaiMaterialization = useMemo(
    () => resolveZenHomeBonsaiPreparedMaterialization(preparedBonsaiMaterializationState, {
      expectedSceneCommitKey: presentationSceneCommitKey,
      expectedInputSignature: bonsaiLifecycleInputSignature,
    }),
    [
      bonsaiLifecycleInputSignature,
      preparedBonsaiMaterializationState,
      presentationSceneCommitKey,
    ],
  );
  const preparedBonsaiMaterializationRef = useRef(preparedBonsaiMaterialization);
  preparedBonsaiMaterializationRef.current = preparedBonsaiMaterialization;
  const pendingBonsaiFrameAckRef = useRef(null);
  const replayBonsaiFrameAckRef = useRef(null);
  const handleBonsaiMaterializationPrepared = useCallback((metadata = null) => {
    if (bonsaiActiveRef.current !== true) return;
    if (metadata === null) {
      preparedBonsaiMaterializationRef.current = null;
      pendingBonsaiFrameAckRef.current = null;
      setPreparedBonsaiMaterializationState(null);
      setAcceptedBonsaiFrameState(null);
      return;
    }
    const accepted = resolveZenHomeBonsaiPreparedMaterialization(metadata, {
      expectedSceneCommitKey: presentationSceneCommitKeyRef.current,
      expectedInputSignature: bonsaiLifecycleInputSignatureRef.current,
    });
    if (!accepted) {
      emitZenTrace('main_presentation:workspace_stale_bonsai_materialization_ignored', {
        expectedSceneCommitKey: presentationSceneCommitKeyRef.current,
        actualSceneCommitKey: metadata?.sceneCommitKey || null,
        expectedInputSignatureLength: bonsaiLifecycleInputSignatureRef.current.length,
        actualInputSignatureLength: typeof metadata?.inputSignature === 'string'
          ? metadata.inputSignature.length
          : 0,
        bonsaiMaterializationKeyLength: typeof metadata?.bonsaiMaterializationKey === 'string'
          ? metadata.bonsaiMaterializationKey.length
          : 0,
      });
      return;
    }
    preparedBonsaiMaterializationRef.current = accepted;
    setAcceptedBonsaiFrameState((current) => (
      isZenHomeBonsaiMaterializationAckCurrent(current, {
        preparedMaterialization: accepted,
        expectedSceneCommitKey: presentationSceneCommitKeyRef.current,
        expectedInputSignature: bonsaiLifecycleInputSignatureRef.current,
      })
        ? current
        : null
    ));
    const pendingFrameAck = pendingBonsaiFrameAckRef.current;
    if (
      pendingFrameAck !== null
      && typeof replayBonsaiFrameAckRef.current === 'function'
    ) {
      replayBonsaiFrameAckRef.current(pendingFrameAck, {
        replayReason: 'prepared_materialization_arrived',
      });
    }
    setPreparedBonsaiMaterializationState((current) => (
      current?.sceneCommitKey === accepted.sceneCommitKey
      && current?.inputSignature === accepted.inputSignature
      && current?.bonsaiMaterializationKey === accepted.bonsaiMaterializationKey
        ? current
        : accepted
    ));
  }, []);
  const bonsaiEvidenceDiagnosticsSignature = useMemo(
    () => buildTraceSignature(ctrl?.bonsaiEvidenceDiagnostics || null),
    [ctrl?.bonsaiEvidenceDiagnostics],
  );
  const liveBonsaiVisualFrame = useMemo(() => ({
    bonsaiLifecycleInput,
    bonsaiLifecycleInputSource,
    bonsaiEvidenceAuthorityState,
    bonsaiEvidenceAuthorityReason,
    bonsaiLifecycleInputSignature,
    presentationSceneCommitKey,
    bonsaiMaterializationPrepared: preparedBonsaiMaterialization !== null,
    bonsaiMaterializationInputSignature: preparedBonsaiMaterialization?.inputSignature || '',
    bonsaiMaterializationKey: preparedBonsaiMaterialization?.bonsaiMaterializationKey || '',
    bonsaiEvidenceDiagnosticsSignature,
    bonsaiEvidenceReady: ctrl?.bonsaiEvidenceReady === true,
    bonsaiEvidenceDiagnostics: ctrl?.bonsaiEvidenceDiagnostics || null,
  }), [
    bonsaiEvidenceAuthorityReason,
    bonsaiEvidenceAuthorityState,
    bonsaiEvidenceDiagnosticsSignature,
    bonsaiLifecycleInput,
    bonsaiLifecycleInputSignature,
    bonsaiLifecycleInputSource,
    preparedBonsaiMaterialization,
    presentationSceneCommitKey,
    ctrl?.bonsaiEvidenceReady,
    ctrl?.bonsaiEvidenceDiagnostics,
  ]);
  const bonsaiVisualFrameSignature = useMemo(
    () => buildBonsaiVisualFrameSignature(liveBonsaiVisualFrame),
    [liveBonsaiVisualFrame],
  );
  const rhythmVisualFrameSignature = useMemo(
    () => buildRhythmVisualFrameSignature(scanSnapshot),
    [scanSnapshot],
  );
  const firstViewportBootFrame = useZenHomeFirstViewportBootFrame({
    enabled: bootVisualHoldActive,
    captureEnabled: bootVisualCaptureActive,
    frameGenerationKey: presentationSceneCommitKey,
    pondFrame: livePondVisualFrame,
    pondFrameSignature: pondVisualFrameSignature,
    bonsaiFrame: liveBonsaiVisualFrame,
    bonsaiFrameSignature: bonsaiVisualFrameSignature,
    rhythmFrame: scanSnapshot,
    rhythmFrameSignature: rhythmVisualFrameSignature,
  });
  const pondVisualFrame = firstViewportBootFrame.pond.frame;
  const pondVisualFrameSource = firstViewportBootFrame.pond.source;
  const bonsaiVisualFrame = firstViewportBootFrame.bonsai.frame;
  const bonsaiVisualFrameSource = firstViewportBootFrame.bonsai.source;
  const effectiveScanSnapshot = firstViewportBootFrame.rhythm.frame;
  const rhythmVisualFrameSource = firstViewportBootFrame.rhythm.source;
  const firstViewportBootFrameReady = firstViewportBootFrame.lifecycle.ready;
  const firstViewportBootFrameHeld = firstViewportBootFrame.lifecycle.holdActive;
  const firstViewportBootFrameReleaseAfterPaint = firstViewportBootFrame.lifecycle.releaseAfterPaint;
  const firstViewportBootFrameReleaseBlocked = firstViewportBootFrame.lifecycle.releaseBlockedBySignatureMismatch;
  const firstViewportBootFrameReleaseFrameMatch = firstViewportBootFrame.lifecycle.releaseFrameMatch;
  const firstViewportBootFrameDiscardedGeneration = (
    firstViewportBootFrame.lifecycle.discardedGeneration
  );
  const firstViewportBootFramePondReleaseMatch = firstViewportBootFrameReleaseFrameMatch.pond;
  const firstViewportBootFrameBonsaiReleaseMatch = firstViewportBootFrameReleaseFrameMatch.bonsai;
  const firstViewportBootFrameRhythmReleaseMatch = firstViewportBootFrameReleaseFrameMatch.rhythm;
  const firstViewportPondCaptured = firstViewportBootFrame.lifecycle.capturedParts.pond;
  const firstViewportBonsaiCaptured = firstViewportBootFrame.lifecycle.capturedParts.bonsai;
  const firstViewportRhythmCaptured = firstViewportBootFrame.lifecycle.capturedParts.rhythm;
  const firstVisionLiveViewportReady = firstVisionFocusActive && isZenHomeLiveFirstViewportReady({
    pondFrame: livePondVisualFrame,
    bonsaiFrame: liveBonsaiVisualFrame,
    rhythmFrame: scanSnapshot,
  });
  const effectiveScannerDomainCandidateList = pondVisualFrame.scannerDomainCandidateList;
  const effectiveScannerDomainCandidateCount = pondVisualFrame.scannerDomainCandidateCount;
  const effectiveSignalScannerTargetCount = pondVisualFrame.signalScannerTargetCount;
  const effectiveStatusSnapshotReady = pondVisualFrame.statusSnapshotReady;
  const effectiveStatusSnapshotAvailable = pondVisualFrame.statusSnapshotAvailable;
  const effectiveStatusSnapshotPolicyCurrent = pondVisualFrame.statusSnapshotPolicyCurrent;
  const effectivePondRosterAuthority = pondVisualFrame.pondRosterAuthority;
  const effectivePondRuntimeMountReady = pondVisualFrame.pondRuntimeMountReady;
  const effectiveRequirePondRosterForRuntimeMount = pondVisualFrame.requirePondRosterForRuntimeMount;
  const effectiveBonsaiLifecycleInput = bonsaiVisualFrame.bonsaiLifecycleInput;
  const effectiveBonsaiLifecycleInputSource = bonsaiVisualFrame.bonsaiLifecycleInputSource;
  const effectiveBonsaiEvidenceAuthorityState = bonsaiVisualFrame.bonsaiEvidenceAuthorityState;
  const effectiveBonsaiEvidenceAuthorityReason = bonsaiVisualFrame.bonsaiEvidenceAuthorityReason;
  const effectiveBonsaiLifecycleInputSignature = bonsaiVisualFrame.bonsaiLifecycleInputSignature;
  const effectiveBonsaiMaterializationSceneCommitKey = bonsaiVisualFrame.presentationSceneCommitKey;
  const effectiveBonsaiMaterializationInputSignature = bonsaiVisualFrame.bonsaiMaterializationInputSignature;
  const effectiveBonsaiMaterializationKey = bonsaiVisualFrame.bonsaiMaterializationKey;
  const effectiveBonsaiEvidenceDiagnosticsSignature = bonsaiVisualFrame.bonsaiEvidenceDiagnosticsSignature;
  const effectiveBonsaiEvidenceReady = bonsaiVisualFrame.bonsaiEvidenceReady;
  const effectiveBonsaiEvidenceDiagnostics = bonsaiVisualFrame.bonsaiEvidenceDiagnostics;
  const effectiveBonsaiMaterializationCurrent = (
    bonsaiVisualFrame.bonsaiMaterializationPrepared === true
    && effectiveBonsaiMaterializationSceneCommitKey === presentationSceneCommitKey
    && effectiveBonsaiMaterializationInputSignature === effectiveBonsaiLifecycleInputSignature
    && typeof effectiveBonsaiMaterializationKey === 'string'
    && effectiveBonsaiMaterializationKey.length > 0
  );
  const effectiveBonsaiFrameCurrent = isZenHomeBonsaiMaterializationAckCurrent(
    acceptedBonsaiFrameState,
    {
      preparedMaterialization: effectiveBonsaiMaterializationCurrent
        ? {
            sceneCommitKey: effectiveBonsaiMaterializationSceneCommitKey,
            inputSignature: effectiveBonsaiMaterializationInputSignature,
            bonsaiMaterializationKey: effectiveBonsaiMaterializationKey,
          }
        : null,
      expectedSceneCommitKey: presentationSceneCommitKey,
      expectedInputSignature: effectiveBonsaiLifecycleInputSignature,
    },
  );
  const firstViewportVisualReady = (
    firstViewportBootFrameReady || firstVisionLiveViewportReady
  ) && effectiveBonsaiMaterializationCurrent;
  const [bloomRegionTargets, setBloomRegionTargets] = useState(null);
  const handleBloomRegionTargets = useCallback(receipt => setBloomRegionTargets(receipt), []);
  const currentBloomRegionTargets = effectiveBonsaiFrameCurrent
    && bloomRegionTargets?.sceneCommitKey === presentationSceneCommitKey
    && bloomRegionTargets?.inputSignature === effectiveBonsaiLifecycleInputSignature
    && bloomRegionTargets?.bonsaiMaterializationKey === effectiveBonsaiMaterializationKey
      ? bloomRegionTargets : null;
  const firstBloom = useBonsaiFirstBloom({
    unlockProgress: mainWidgetThemeId === 'zen' && !zenMainCaptureProfile
      && bonsaiDebugPreview.growthPercent === null && bonsaiDebugPreview.bloomPercent === null
      && bonsaiDebugPreview.activationPercent === null
      ? progressionUnlockSnapshot : null,
    sceneCommitKey: mainPresentationProjection?.decision?.renderTarget?.kind === 'current'
      ? presentationSceneCommitKey : null,
    ready: presentationAdmission.contextualPresentationAllowed
      && currentBloomRegionTargets !== null && isBonsaiFirstBloomReady({
      homePresented: pondInteractive && bonsaiActive,
      bootShellDismissed,
      exactBonsaiFrameCurrent: effectiveBonsaiFrameCurrent,
      decision: mainPresentationProjection?.decision,
      interactionLocked: mainPresentationInteractionLocked,
      overlayActive: mainPresentationProjection?.overlay?.active,
      registrationOpen: invitationRegistrationOpen,
    }),
  });
  const runtimeFirstFrameReadyRef = useRef(onRuntimeFirstFrameReady);
  runtimeFirstFrameReadyRef.current = onRuntimeFirstFrameReady;
  const pondPresentationReadyRef = useRef(onPondPresentationReady);
  pondPresentationReadyRef.current = onPondPresentationReady;
  const bonsaiFirstFrameReadyRef = useRef(onBonsaiFirstFrameReady);
  bonsaiFirstFrameReadyRef.current = onBonsaiFirstFrameReady;
  const sceneCommittedRef = useRef(onMainPresentationSceneCommitted);
  sceneCommittedRef.current = onMainPresentationSceneCommitted;
  const presentationAckBootTraceContextRef = useRef(bootTraceContext);
  presentationAckBootTraceContextRef.current = bootTraceContext;
  const presentationSceneAckGenerationRef = useRef(null);
  const presentationSceneAckDeadlineTimerRef = useRef(null);

  const clearPresentationSceneAckDeadline = useCallback(() => {
    if (presentationSceneAckDeadlineTimerRef.current === null) return;
    globalThis.clearTimeout(presentationSceneAckDeadlineTimerRef.current);
    presentationSceneAckDeadlineTimerRef.current = null;
  }, []);

  const reportPresentationSceneFatal = useCallback(({
    code,
    sceneCommitKey,
    part,
    reason,
    details = null,
  } = {}) => {
    if (runtimeActiveRef.current !== true) return false;
    const expectedSceneCommitKey = presentationSceneCommitKeyRef.current;
    if (
      typeof sceneCommitKey !== 'string'
      || sceneCommitKey !== expectedSceneCommitKey
    ) {
      emitZenTrace('main_presentation:workspace_stale_scene_failure_ignored', {
        code: code || null,
        part: part || null,
        expectedSceneCommitKey,
        actualSceneCommitKey: sceneCommitKey || null,
      });
      return false;
    }
    if (presentationSceneFatalErrorRef.current) return false;
    const error = createZenHomePresentationSceneFatalError({
      code,
      sceneCommitKey,
      part,
      reason,
      details,
    });
    presentationSceneFatalErrorRef.current = error;
    setPresentationSceneFatalError(error);
    return true;
  }, []);

  const handlePresentationFirstVisualMilestone = useCallback((milestoneEvent = null, metadata = null) => {
    if (runtimeActiveRef.current !== true) return;
    if (typeof onFirstVisualMilestone === 'function') {
      onFirstVisualMilestone(milestoneEvent, metadata);
    }
    if (!isZenHomeFirstVisualFatalMilestone(milestoneEvent)) return;
    const milestone = normalizeZenHomeFirstVisualMilestone(milestoneEvent);
    reportPresentationSceneFatal({
      code: ZEN_HOME_PRESENTATION_SCENE_RENDERER_FAILURE_CODE,
      sceneCommitKey: milestoneEvent?.sceneCommitKey || null,
      part: milestoneEvent?.source || null,
      reason: milestoneEvent?.reason || milestoneEvent?.errorCode || milestone,
      details: {
        milestone,
        errorCode: milestoneEvent?.errorCode || null,
        startupStage: milestoneEvent?.startupStage ?? null,
        startupReadinessReason:
          milestoneEvent?.startupReadinessReason ?? null,
      },
    });
  }, [onFirstVisualMilestone, reportPresentationSceneFatal]);

  const handlePondFirstVisualMilestone = useCallback((...args) => {
    if (pondActiveRef.current === true) handlePresentationFirstVisualMilestone(...args);
  }, [handlePresentationFirstVisualMilestone]);
  const handleBonsaiFirstVisualMilestone = useCallback((...args) => {
    if (bonsaiActiveRef.current === true) handlePresentationFirstVisualMilestone(...args);
  }, [handlePresentationFirstVisualMilestone]);

  const ensurePresentationSceneAckGeneration = useCallback(() => {
    if (compositeActiveRef.current !== true) return null;
    if (mainWidgetThemeId !== 'zen') return null;
    const expectedKey = presentationSceneCommitKeyRef.current;
    if (typeof expectedKey !== 'string' || !expectedKey.trim()) return null;
    const current = presentationSceneAckGenerationRef.current;
    if (current?.sceneCommitKey === expectedKey) return current;
    const next = createZenHomePresentationSceneAckGeneration({
      sceneCommitKey: expectedKey,
      startedAtMs: Date.now(),
    });
    presentationSceneAckGenerationRef.current = next;
    return next;
  }, [mainWidgetThemeId]);

  useEffect(() => {
    clearPresentationSceneAckDeadline();
    if (!compositeActive) {
      const parkedGeneration = presentationSceneAckGenerationRef.current;
      if (parkedGeneration && !parkedGeneration.notified) {
        // A parked surface cannot spend the composite ACK budget. Resume starts
        // a fresh generation for the same canonical scene.
        presentationSceneAckGenerationRef.current = null;
      }
      return undefined;
    }
    const generation = ensurePresentationSceneAckGeneration();
    if (!generation || generation.notified) return undefined;
    const remainingMs = Math.max(0, generation.deadlineAtMs - Date.now());
    presentationSceneAckDeadlineTimerRef.current = globalThis.setTimeout(() => {
      presentationSceneAckDeadlineTimerRef.current = null;
      if (compositeActiveRef.current !== true) return;
      const current = presentationSceneAckGenerationRef.current;
      if (!current || current.sceneCommitKey !== generation.sceneCommitKey) return;
      const stalled = markZenHomePresentationSceneAckStalled(current, {
        observedAtMs: Date.now(),
      });
      presentationSceneAckGenerationRef.current = stalled.state;
      if (!stalled.shouldEmit) return;
      emitZenMainBootTrace(
        'home_workspace:presentation_scene_composite_ack_stalled',
        presentationAckBootTraceContextRef.current,
        stalled.diagnostic,
      );
      const fatalFailure = resolveZenHomePresentationSceneAckStallFatalFailure(
        stalled.diagnostic,
        { phase: mainPresentationPhaseRef.current },
      );
      if (fatalFailure) reportPresentationSceneFatal(fatalFailure);
    }, remainingMs);
    return clearPresentationSceneAckDeadline;
  }, [
    clearPresentationSceneAckDeadline,
    ensurePresentationSceneAckGeneration,
    compositeActive,
    presentationSceneCommitKey,
    reportPresentationSceneFatal,
  ]);

  const recordPresentationSceneRejection = useCallback((part, reason, metadata = null) => {
    const generation = ensurePresentationSceneAckGeneration();
    if (!generation) return;
    presentationSceneAckGenerationRef.current = recordZenHomePresentationSceneAckRejected(
      generation,
      {
        part,
        reason,
        metadata,
        observedAtMs: Date.now(),
      },
    );
  }, [ensurePresentationSceneAckGeneration]);

  const recordPresentationScenePart = useCallback((part, metadata = null) => {
    const generation = ensurePresentationSceneAckGeneration();
    if (!generation) return;
    const previousStalledAtMs = generation.stalledAtMs;
    const result = recordZenHomePresentationSceneAckAccepted(generation, {
      part,
      metadata,
      observedAtMs: Date.now(),
    });
    presentationSceneAckGenerationRef.current = result.state;
    if (!result.shouldCommit) return;
    clearPresentationSceneAckDeadline();
    emitZenTrace('main_presentation:workspace_scene_committed', {
      sceneCommitKey: result.commitMetadata.sceneCommitKey,
    });
    if (previousStalledAtMs !== null) {
      emitZenMainBootTrace(
        'home_workspace:presentation_scene_composite_ack_recovered',
        presentationAckBootTraceContextRef.current,
        {
          sceneCommitKey: result.commitMetadata.sceneCommitKey,
          stalledAtMs: previousStalledAtMs,
          recoveredAtMs: Date.now(),
        },
      );
    }
    if (typeof sceneCommittedRef.current === 'function') {
      sceneCommittedRef.current(result.commitMetadata);
    }
  }, [clearPresentationSceneAckDeadline, ensurePresentationSceneAckGeneration]);

  const handlePondFrameReady = useCallback((metadata = null) => {
    if (pondActiveRef.current !== true) return;
    const resolution = resolveZenHomeSceneAck(
      metadata,
      presentationSceneCommitKeyRef.current,
    );
    if (!resolution.accepted) {
      recordPresentationSceneRejection('pond', resolution.reason, metadata);
      emitZenTrace('main_presentation:workspace_stale_scene_part_ignored', {
        part: 'pond',
        reason: resolution.reason,
        expectedKey: presentationSceneCommitKeyRef.current,
        actualKey: metadata?.sceneCommitKey || null,
      });
      return;
    }
    if (typeof runtimeFirstFrameReadyRef.current === 'function') {
      runtimeFirstFrameReadyRef.current(metadata);
    }
    livePondFrameAckRef.current = metadata;
    recordPresentationScenePart('pond', metadata);
    pondPresentationReadyRef.current?.(metadata);
  }, [recordPresentationScenePart, recordPresentationSceneRejection]);

  const handleBonsaiFrameReady = useCallback((metadata = null, replayContext = null) => {
    if (bonsaiActiveRef.current !== true) return false;
    const resolution = resolveZenHomeBonsaiMaterializationAck(metadata, {
      preparedMaterialization: preparedBonsaiMaterializationRef.current,
      expectedSceneCommitKey: presentationSceneCommitKeyRef.current,
      expectedInputSignature: bonsaiLifecycleInputSignatureRef.current,
    });
    if (!resolution.accepted) {
      pendingBonsaiFrameAckRef.current = resolveZenHomePendingBonsaiFrameAck(
        metadata,
        resolution,
        {
          expectedSceneCommitKey: presentationSceneCommitKeyRef.current,
          expectedInputSignature: bonsaiLifecycleInputSignatureRef.current,
        },
      );
      recordPresentationSceneRejection('bonsai', resolution.reason, metadata);
      emitZenTrace('main_presentation:workspace_stale_bonsai_frame_ignored', {
        reason: resolution.reason,
        expectedSceneCommitKey: presentationSceneCommitKeyRef.current,
        actualSceneCommitKey: metadata?.sceneCommitKey || null,
        expectedInputSignatureLength: bonsaiLifecycleInputSignatureRef.current.length,
        actualInputSignatureLength: typeof metadata?.inputSignature === 'string'
          ? metadata.inputSignature.length
          : 0,
        expectedBonsaiMaterializationKeyLength:
          preparedBonsaiMaterializationRef.current?.bonsaiMaterializationKey?.length || 0,
        actualBonsaiMaterializationKeyLength: typeof metadata?.bonsaiMaterializationKey === 'string'
          ? metadata.bonsaiMaterializationKey.length
          : 0,
        replayReason: replayContext?.replayReason || null,
      });
      return false;
    }
    pendingBonsaiFrameAckRef.current = null;
    setAcceptedBonsaiFrameState((current) => (
      isZenHomeBonsaiMaterializationAckCurrent(current, {
        preparedMaterialization: preparedBonsaiMaterializationRef.current,
        expectedSceneCommitKey: presentationSceneCommitKeyRef.current,
        expectedInputSignature: bonsaiLifecycleInputSignatureRef.current,
      })
        ? current
        : {
            sceneCommitKey: metadata.sceneCommitKey,
            inputSignature: metadata.inputSignature,
            bonsaiMaterializationKey: metadata.bonsaiMaterializationKey,
          }
    ));
    if (typeof bonsaiFirstFrameReadyRef.current === 'function') {
      bonsaiFirstFrameReadyRef.current(metadata);
    }
    recordPresentationScenePart('bonsai', metadata);
    return true;
  }, [recordPresentationScenePart, recordPresentationSceneRejection]);
  replayBonsaiFrameAckRef.current = handleBonsaiFrameReady;

  useEffect(() => {
    if (!compositeActive) return;
    // The sticky Bonsai canvas retains its accepted scene through parking and
    // suppresses duplicate ACKs. The Pond may dispose while parked, so only its
    // continuously active receipt survives. Both receipts must still be current.
    const pondAck = livePondFrameAckRef.current;
    if (pondAck && resolveZenHomeSceneAck(pondAck, presentationSceneCommitKey).accepted) {
      recordPresentationScenePart('pond', pondAck);
    }
    const bonsaiAck = acceptedBonsaiFrameState;
    if (bonsaiAck && isZenHomeBonsaiMaterializationAckCurrent(bonsaiAck, {
      preparedMaterialization: preparedBonsaiMaterialization,
      expectedSceneCommitKey: presentationSceneCommitKey,
      expectedInputSignature: bonsaiLifecycleInputSignature,
    })) {
      recordPresentationScenePart('bonsai', bonsaiAck);
    }
  }, [
    acceptedBonsaiFrameState,
    bonsaiLifecycleInputSignature,
    compositeActive,
    preparedBonsaiMaterialization,
    presentationSceneCommitKey,
    recordPresentationScenePart,
  ]);

  useEffect(() => {
    if (!pondInteractive || !invitationKoiVisible || !effectivePondRuntimeMountReady || registrationJourney === null
        || typeof onInvitationCapacityAdmitted !== 'function') return;
    const capacity = registrationJourney.mode === 'unlimited' ? 5 : Math.min(5, registrationJourney.limit);
    if (capacity <= registrationJourney.admittedInvitationCapacity || capacity <= admittedInvitationCapacityRef.current) return;
    if (invitationSlotState.slots.length !== registrationJourney.invitationCount) return;
    admittedInvitationCapacityRef.current = capacity;
    Promise.resolve(onInvitationCapacityAdmitted(capacity)).catch(setInvitationAdmissionError);
  }, [pondInteractive, invitationKoiVisible, effectivePondRuntimeMountReady, registrationJourney,
    invitationSlotState.slots.length, onInvitationCapacityAdmitted]);

  const scannerProps = useMemo(() => ({
    status: ctrl.scannerStatus,
    ...(homeWorkspacePolicy.signalScannerInput === MAIN_SIGNAL_SCANNER_INPUT_MODES.DOMAIN_CANDIDATES
        ? {
            domainCandidates: effectiveScannerDomainCandidateList,
            rosterAuthoritySource: effectivePondRosterAuthority.source,
          }
        : { signalScannerTargets: ctrl.signalScannerTargets }),
    dailyScore: ctrl.dailyDisplayScore,
    topFactors: ctrl.cycleTopFactors,
    lockedTarget: scannerLockedTarget,
    onLockTarget: scannerLockTargetHandler,
    pondProjection,
    dataIsolationMode: pondProjection?.dataIsolationMode === true,
    solarLocationProfile,
    isTabActive: pondActive,
    runtimeMountReady: effectivePondRuntimeMountReady,
    requireRosterForRuntimeMount: effectiveRequirePondRosterForRuntimeMount,
    parkRuntimeOnUnmount: homeWorkspacePolicy.parkSignalScannerRuntimeOnUnmount,
    showSwimModelBadge: false,
    showRerollControls: false,
    showWaterEffectsDebugPanel: false,
    workerRenderBudget: mainWorkerRenderBudget.pond,
    ...(mainWidgetThemeId === 'zen' ? { frameVariant: ZEN_HOME_FRAME_VARIANTS.APERTURE } : {}),
    className: 'h-full w-full',
    onFirstVisualMilestone: handlePondFirstVisualMilestone,
    onRuntimeFirstFrameReady: handlePondFrameReady,
    presentationSceneCommitKey,
    ...(mainWidgetThemeId === 'zen'
      ? {
          bootTraceContext,
          ...(zenMainCaptureProfile
            ? {
                koiRosterFrame: zenMainCaptureProfile.koiRosterFrame,
                rendererDebugToggles: zenMainCaptureProfile.pondRendererDebugToggles,
                sceneGenerationKey: zenMainCaptureProfile.pondSceneGenerationKey,
              }
            : {}),
          invitationSlots,
          invitationInteractionEnabled: invitationKoiInteractive,
          invitationCapacityFull: registrationAvailability?.available === false,
          invitationAssignment,
          invitationRegistrationEntityId: invitationRegistrationOpen ? selectedInvitationEntityId : null,
          invitationGuidance,
          onInvitationKoiActivate: handleInvitationKoiActivate,
          onInvitationKoiMembershipChange: handleInvitationKoiMembershipChange,
        }
      : {}),
  }), [
    bootTraceContext,
    ctrl.cycleTopFactors,
    ctrl.dailyDisplayScore,
    effectiveScannerDomainCandidateList,
    ctrl.signalScannerTargets,
    scannerLockedTarget,
    scannerLockTargetHandler,
    pondProjection,
    pondProjection?.dataIsolationMode,
    effectivePondRuntimeMountReady,
    effectiveRequirePondRosterForRuntimeMount,
    homeWorkspacePolicy,
    pondActive,
    mainWorkerRenderBudget,
    handlePondFirstVisualMilestone,
    handlePondFrameReady,
    presentationSceneCommitKey,
    ctrl.rhythmLensDomain,
    ctrl.lockedTarget,
    ctrl.scannerStatus,
    effectivePondRosterAuthority.source,
    solarLocationProfile,
    handleInvitationKoiActivate,
    handleInvitationKoiMembershipChange,
    invitationKoiInteractive,
    invitationKoiVisible,
    invitationSlots,
    registrationAvailability,
    invitationAssignment,
    invitationRegistrationOpen,
    selectedInvitationEntityId,
    invitationGuidance,
    zenMainCaptureProfile,
  ]);

  const coreStatusProps = useMemo(() => ({
    integrityScore: Number.isFinite(Number(ctrl?.cycleScore)) ? Number(ctrl.cycleScore) : Number(ctrl?.dailyScore) || 0,
    dailyLimitPercent: Number.isFinite(Number(ctrl?.dailyLimitPercent)) ? Number(ctrl.dailyLimitPercent) : 0,
    bonsaiLifecycleInput: effectiveBonsaiLifecycleInput,
    experimental: false,
    solarLocationProfile,
    onFirstVisualMilestone: handleBonsaiFirstVisualMilestone,
    onBonsaiFirstFrameReady: handleBonsaiFrameReady,
    onBonsaiMaterializationPrepared: handleBonsaiMaterializationPrepared,
    onHomeCanopyReadingEnvelope: handleHomeCanopyReadingEnvelope,
    onBloomRegionTargets: handleBloomRegionTargets,
    bloomPresentation: firstBloom.rendererPresentation,
    onBloomPresentationComplete: firstBloom.handlePlaybackComplete,
    isTabActive: bonsaiActive,
    presentationSceneCommitKey,
    workerRenderBudget: mainWorkerRenderBudget.bonsai,
    showBonsaiDebugPanel: bonsaiDebugPreviewAvailable,
    bonsaiLifeDebugControls,
    ...(mainWidgetThemeId === 'zen'
      ? {
          bootTraceContext,
          frameVariant: ZEN_HOME_FRAME_VARIANTS.APERTURE,
          homeGardenBedLayoutFrame,
          presentationEnvironmentMode: bonsaiProjection?.environmentMode ?? null,
          presentationWeatherAuthority: bonsaiProjection?.weatherAuthority ?? null,
          ...(zenMainCaptureProfile
            ? {
                presentationIdentityOverride:
                  zenMainCaptureProfile.bonsaiPresentationIdentity,
              }
            : {}),
        }
      : {}),
    ...(homeWorkspacePolicy.embeddedCoreStatusVariant === EMBEDDED_CORE_STATUS_VARIANTS.AMBIENT_HOME
      ? { workspaceMode: 'classic', embedded: true, homeEmbedded: true }
      : {}),
  }), [
    bootTraceContext,
    ctrl?.cycleScore,
    ctrl?.dailyLimitPercent,
    ctrl?.dailyScore,
    effectiveBonsaiLifecycleInput,
    bonsaiDebugPreviewAvailable,
    bonsaiLifeDebugControls,
    homeWorkspacePolicy.embeddedCoreStatusVariant,
    mainWorkerRenderBudget,
    mainWidgetThemeId,
    bonsaiProjection?.environmentMode,
    bonsaiProjection?.weatherAuthority,
    homeGardenBedLayoutFrame,
    zenMainCaptureProfile,
    handleBonsaiFirstVisualMilestone,
    handleBonsaiFrameReady,
    handleBonsaiMaterializationPrepared,
    handleHomeCanopyReadingEnvelope,
    handleBloomRegionTargets,
    firstBloom.rendererPresentation,
    firstBloom.handlePlaybackComplete,
    bonsaiActive,
    presentationSceneCommitKey,
    solarLocationProfile,
  ]);

  useEffect(() => {
    if (!isActive || mainWidgetThemeId !== 'zen') return;
    emitZenMainBootTrace('home_workspace:main_visual_inputs', bootTraceContext, {
      isActive,
      pondActive,
      bonsaiActive,
      compositeActive,
      firstVisionFocusActive,
      bootShellDismissed,
      bootShellRevealStarted,
      bootVisualHoldActive,
      bootVisualCaptureActive,
      firstViewportBootFrameReady,
      firstViewportBootFrameHeld,
      firstViewportBootFrameReleaseAfterPaint,
      firstViewportBootFrameReleaseBlocked,
      firstViewportBootFrameReleaseFrameMatch: {
        pond: firstViewportBootFramePondReleaseMatch,
        bonsai: firstViewportBootFrameBonsaiReleaseMatch,
        rhythm: firstViewportBootFrameRhythmReleaseMatch,
      },
      firstViewportCapturedParts: {
        pond: firstViewportPondCaptured,
        bonsai: firstViewportBonsaiCaptured,
        rhythm: firstViewportRhythmCaptured,
      },
      pondVisualFrameSource,
      bonsaiVisualFrameSource,
      rhythmVisualFrameSource,
      pondPresentationMode: pondProjection?.presentationMode || null,
      pondFirstVisionPresentation,
      pondRosterMemoryPolicy: pondProjection?.rosterMemoryPolicy || null,
      bonsaiFirstVisionPresentation,
      bonsaiEnvironmentMode: bonsaiProjection?.environmentMode || null,
      bonsaiLifecycleInputReady: effectiveBonsaiLifecycleInput !== null,
      bonsaiLifecycleInputSource: effectiveBonsaiLifecycleInputSource,
      bonsaiEvidenceAuthorityState: effectiveBonsaiEvidenceAuthorityState,
      bonsaiEvidenceAuthorityReason: effectiveBonsaiEvidenceAuthorityReason,
      bonsaiEvidenceReady: effectiveBonsaiEvidenceReady,
      bonsaiLifecycleInputSignatureLength: effectiveBonsaiLifecycleInputSignature.length,
      bonsaiMaterializationPrepared: effectiveBonsaiMaterializationCurrent,
      bonsaiMaterializationKeyLength: effectiveBonsaiMaterializationKey?.length || 0,
      statusSnapshotReady: effectiveStatusSnapshotReady,
      statusSnapshotAvailable: effectiveStatusSnapshotAvailable,
      statusSnapshotPolicyCurrent: effectiveStatusSnapshotPolicyCurrent,
      mainFrameReadinessOwner: 'main_tab_composite_first_frame',
      bonsaiEvidenceDiagnostics: effectiveBonsaiEvidenceDiagnostics,
      pondRosterAuthorityReady: effectivePondRuntimeMountReady,
      pondRosterAuthorityState: effectivePondRosterAuthority.state,
      pondRosterAuthoritySource: effectivePondRosterAuthority.source,
      pondRuntimeMountReady: effectivePondRuntimeMountReady,
      requirePondRosterForRuntimeMount: effectiveRequirePondRosterForRuntimeMount,
      scannerDomainCandidateCount: effectiveScannerDomainCandidateCount,
      signalScannerTargetCount: effectiveSignalScannerTargetCount,
      registeredSiteDomainCount: registeredSiteDomains.length,
      pondBudget: {
        qualityMode: mainWorkerRenderBudget.pond?.qualityMode || null,
        targetFps: Number(mainWorkerRenderBudget.pond?.targetFps) || 0,
        firstFrameEffectPolicy: mainWorkerRenderBudget.pond?.firstFrameEffectPolicy || null,
      },
      bonsaiBudget: {
        qualityMode: mainWorkerRenderBudget.bonsai?.qualityMode || null,
        targetFps: Number(mainWorkerRenderBudget.bonsai?.targetFps) || 0,
        renderBackend: mainWorkerRenderBudget.bonsai?.renderBackend || null,
      },
    });
  }, [
    bonsaiFirstVisionPresentation,
    bonsaiProjection?.environmentMode,
    bonsaiVisualFrameSource,
    bootShellDismissed,
    bootShellRevealStarted,
    bootVisualHoldActive,
    bootVisualCaptureActive,
    bootTraceContext,
    firstViewportBootFrameReady,
    firstViewportBootFrameHeld,
    firstViewportBootFrameReleaseAfterPaint,
    firstViewportBootFrameReleaseBlocked,
    firstViewportBootFramePondReleaseMatch,
    firstViewportBootFrameBonsaiReleaseMatch,
    firstViewportBootFrameRhythmReleaseMatch,
    firstViewportPondCaptured,
    firstViewportBonsaiCaptured,
    firstViewportRhythmCaptured,
    rhythmVisualFrameSource,
    effectiveBonsaiEvidenceAuthorityReason,
    effectiveBonsaiEvidenceAuthorityState,
    effectiveBonsaiEvidenceDiagnostics,
    effectiveBonsaiEvidenceReady,
    effectiveBonsaiLifecycleInput,
    effectiveBonsaiLifecycleInputSignature.length,
    effectiveBonsaiLifecycleInputSource,
    effectiveBonsaiMaterializationCurrent,
    effectiveBonsaiMaterializationKey,
    effectivePondRosterAuthority.source,
    effectivePondRosterAuthority.state,
    effectivePondRuntimeMountReady,
    effectiveRequirePondRosterForRuntimeMount,
    effectiveScannerDomainCandidateCount,
    effectiveSignalScannerTargetCount,
    effectiveStatusSnapshotAvailable,
    effectiveStatusSnapshotPolicyCurrent,
    effectiveStatusSnapshotReady,
    firstVisionFocusActive,
    isActive,
    pondActive,
    bonsaiActive,
    compositeActive,
    mainWidgetThemeId,
    mainWorkerRenderBudget.bonsai,
    mainWorkerRenderBudget.pond,
    pondVisualFrameSource,
    pondFirstVisionPresentation,
    pondProjection?.presentationMode,
    pondProjection?.rosterMemoryPolicy,
    registeredSiteDomains.length,
  ]);

  const firstViewportReadyNotifiedTokenRef = useRef(null);
  useEffect(() => {
    if (!compositeActive) return;
    const notification = resolveZenHomeFirstViewportNotification({
      firstViewportReady: mainWidgetThemeId === 'zen' && firstViewportVisualReady === true,
      candidateToken: {
        sceneCommitKey: effectiveBonsaiMaterializationSceneCommitKey,
        inputSignature: effectiveBonsaiMaterializationInputSignature,
        bonsaiMaterializationKey: effectiveBonsaiMaterializationKey,
      },
      notifiedToken: firstViewportReadyNotifiedTokenRef.current,
    });
    firstViewportReadyNotifiedTokenRef.current = notification.nextNotifiedToken;
    if (!notification.shouldNotify) return;

    const metadata = {
      source: firstViewportBootFrameReady
        ? 'zen_home_first_viewport_boot_frame'
        : 'zen_home_first_vision_live_viewport',
      firstViewportReady: true,
      firstVisionLiveViewportReady,
      bootVisualHoldActive,
      bootVisualCaptureActive,
      pondCaptured: firstViewportPondCaptured,
      bonsaiCaptured: firstViewportBonsaiCaptured,
      rhythmCaptured: firstViewportRhythmCaptured,
      pondVisualFrameSource,
      bonsaiVisualFrameSource,
      rhythmVisualFrameSource,
      releaseBlockedBySignatureMismatch: firstViewportBootFrameReleaseBlocked,
      discardedBootFrameGeneration: firstViewportBootFrameDiscardedGeneration,
      releaseFrameMatch: {
        pond: firstViewportBootFramePondReleaseMatch,
        bonsai: firstViewportBootFrameBonsaiReleaseMatch,
        rhythm: firstViewportBootFrameRhythmReleaseMatch,
      },
      pondRuntimeMountReady: effectivePondRuntimeMountReady,
      pondRosterAuthorityState: effectivePondRosterAuthority.state,
      pondRosterAuthoritySource: effectivePondRosterAuthority.source,
      bonsaiEvidenceReady: effectiveBonsaiEvidenceReady,
      bonsaiLifecycleInputSource: effectiveBonsaiLifecycleInputSource,
      sceneCommitKey: effectiveBonsaiMaterializationSceneCommitKey,
      inputSignature: effectiveBonsaiMaterializationInputSignature,
      bonsaiMaterializationKey: effectiveBonsaiMaterializationKey,
      rhythmFrameReady: effectiveScanSnapshot !== null && typeof effectiveScanSnapshot === 'object',
      scannerDomainCandidateCount: effectiveScannerDomainCandidateCount,
      signalScannerTargetCount: effectiveSignalScannerTargetCount,
    };

    emitZenMainBootTrace('home_workspace:first_viewport_ready', bootTraceContext, metadata);
    if (typeof onFirstViewportReady === 'function') {
      onFirstViewportReady(metadata);
    }
  }, [
    bonsaiVisualFrameSource,
    bootTraceContext,
    bootVisualCaptureActive,
    bootVisualHoldActive,
    effectiveBonsaiEvidenceReady,
    effectiveBonsaiLifecycleInputSource,
    effectiveBonsaiMaterializationInputSignature,
    effectiveBonsaiMaterializationKey,
    effectiveBonsaiMaterializationSceneCommitKey,
    effectivePondRosterAuthority.source,
    effectivePondRosterAuthority.state,
    effectivePondRuntimeMountReady,
    effectiveScanSnapshot,
    effectiveScannerDomainCandidateCount,
    effectiveSignalScannerTargetCount,
    firstViewportBonsaiCaptured,
    firstViewportBootFrameBonsaiReleaseMatch,
    firstViewportBootFramePondReleaseMatch,
    firstViewportBootFrameReady,
    firstViewportBootFrameDiscardedGeneration,
    firstViewportBootFrameReleaseBlocked,
    firstViewportBootFrameRhythmReleaseMatch,
    firstViewportPondCaptured,
    firstViewportRhythmCaptured,
    firstViewportVisualReady,
    firstVisionLiveViewportReady,
    compositeActive,
    mainWidgetThemeId,
    onFirstViewportReady,
    pondVisualFrameSource,
    rhythmVisualFrameSource,
  ]);

  const bonsaiInputAuthorityTraceRef = useRef('');
  useEffect(() => {
    if (!bonsaiActive || mainWidgetThemeId !== 'zen') return;
    const signature = [
      effectiveBonsaiEvidenceReady === true ? 'ready' : 'not_ready',
      effectiveBonsaiLifecycleInput ? 'input' : 'no_input',
      effectiveBonsaiLifecycleInputSource,
      effectiveBonsaiEvidenceAuthorityState,
      effectiveBonsaiEvidenceAuthorityReason || 'no_reason',
      effectiveStatusSnapshotReady ? 'snapshot' : 'no_snapshot',
      effectiveStatusSnapshotAvailable ? 'available' : 'unavailable',
      effectiveStatusSnapshotPolicyCurrent ? 'policy_current' : 'policy_stale',
      effectiveBonsaiLifecycleInputSignature,
      effectiveBonsaiEvidenceDiagnosticsSignature,
    ].join('|');
    if (bonsaiInputAuthorityTraceRef.current === signature) return;
    const previousSignature = bonsaiInputAuthorityTraceRef.current || null;
    bonsaiInputAuthorityTraceRef.current = signature;
    emitZenMainBootTrace('home_workspace:bonsai_input_authority', bootTraceContext, {
      previousSignatureLength: previousSignature ? previousSignature.length : 0,
      signatureLength: signature.length,
      bootVisualHoldActive,
      bonsaiVisualFrameSource,
      bonsaiEvidenceReady: effectiveBonsaiEvidenceReady,
      bonsaiLifecycleInputReady: effectiveBonsaiLifecycleInput !== null,
      bonsaiLifecycleInputSource: effectiveBonsaiLifecycleInputSource,
      bonsaiEvidenceAuthorityState: effectiveBonsaiEvidenceAuthorityState,
      bonsaiEvidenceAuthorityReason: effectiveBonsaiEvidenceAuthorityReason,
      bonsaiLifecycleInputSignatureLength: effectiveBonsaiLifecycleInputSignature.length,
      bonsaiMaterializationPrepared: effectiveBonsaiMaterializationCurrent,
      bonsaiMaterializationKeyLength: effectiveBonsaiMaterializationKey?.length || 0,
      statusSnapshotReady: effectiveStatusSnapshotReady,
      statusSnapshotAvailable: effectiveStatusSnapshotAvailable,
      statusSnapshotPolicyCurrent: effectiveStatusSnapshotPolicyCurrent,
      diagnostics: effectiveBonsaiEvidenceDiagnostics,
      registeredSiteDomainCount: registeredSiteDomains.length,
      requirePondRosterForRuntimeMount: effectiveRequirePondRosterForRuntimeMount,
      scannerDomainCandidateCount: effectiveScannerDomainCandidateCount,
      signalScannerTargetCount: effectiveSignalScannerTargetCount,
    });
  }, [
    bonsaiVisualFrameSource,
    bootVisualHoldActive,
    bootTraceContext,
    effectiveBonsaiEvidenceAuthorityReason,
    effectiveBonsaiEvidenceAuthorityState,
    effectiveBonsaiEvidenceDiagnostics,
    effectiveBonsaiEvidenceDiagnosticsSignature,
    effectiveBonsaiEvidenceReady,
    effectiveBonsaiLifecycleInput,
    effectiveBonsaiLifecycleInputSignature,
    effectiveBonsaiLifecycleInputSource,
    effectiveBonsaiMaterializationCurrent,
    effectiveBonsaiMaterializationKey,
    effectiveRequirePondRosterForRuntimeMount,
    effectiveScannerDomainCandidateCount,
    effectiveSignalScannerTargetCount,
    effectiveStatusSnapshotAvailable,
    effectiveStatusSnapshotPolicyCurrent,
    effectiveStatusSnapshotReady,
    bonsaiActive,
    mainWidgetThemeId,
    registeredSiteDomains.length,
  ]);

  const handleBriefAction = useCallback((action) => {
    if (runtimeActiveRef.current !== true) return;
    if (action?.tabId !== 'sites') return;
    ctrl.handleManageSites(action?.params?.domain || effectiveScanSnapshot?.rhythmLensDomain || null);
  }, [ctrl.handleManageSites, effectiveScanSnapshot?.rhythmLensDomain]);

  const PressureRail = useMemo(() => (
    rendersPressureRailHome ? getThemeWidget(mainWidgetThemeId, 'PressureRail') : null
  ), [mainWidgetThemeId, rendersPressureRailHome]);
  const RhythmMarker = useMemo(() => (
    rendersPressureRailHome ? getThemeWidget(mainWidgetThemeId, 'RhythmMarker') : null
  ), [mainWidgetThemeId, rendersPressureRailHome]);

  const sessionSummaryDraft = useMemo(
    () => (mainWidgetThemeId === 'zen'
      ? null
      : buildSessionSummaryDraftFromHomeScanSnapshot(effectiveScanSnapshot)),
    [effectiveScanSnapshot, mainWidgetThemeId],
  );
  const sessionSummarySignature = useMemo(() => (
    sessionSummaryDraft
      ? buildSessionSummaryPresentationSignature({
          summaryDraft: sessionSummaryDraft,
          locale,
        })
      : ''
  ), [locale, sessionSummaryDraft]);
  const [aiNarrationState, setAiNarrationState] = useState({
    signature: '',
    narration: null,
  });

  useEffect(() => {
    if (!isActive) return;
    setAiNarrationState((current) => (
      current.signature && current.signature === sessionSummarySignature
        ? current
        : { signature: '', narration: null }
    ));
  }, [isActive, sessionSummarySignature]);

  const handleSessionSummaryNarration = useCallback(({ narration, signature }) => {
    if (runtimeActiveRef.current !== true) return;
    if (!signature || signature !== sessionSummarySignature) return;
    setAiNarrationState({ signature, narration });
  }, [sessionSummarySignature]);

  const resolvedBrief = useMemo(() => {
    const brief = effectiveScanSnapshot?.brief || null;
    if (!brief || !sessionSummarySignature) return brief;
    if (aiNarrationState.signature !== sessionSummarySignature) return brief;
    return applySessionSummaryNarrationToBrief({
      brief,
      narration: aiNarrationState.narration,
    });
  }, [
    aiNarrationState.narration,
    aiNarrationState.signature,
    effectiveScanSnapshot?.brief,
    sessionSummarySignature,
  ]);

  const aiNarrationSlot = sessionSummaryDraft ? (
    <SessionSummaryAiEnrichment
      summaryDraft={sessionSummaryDraft}
      locale={locale}
      mainWidgetThemeId={mainWidgetThemeId}
      isRuntimeActive={isActive}
      postFirstFrameReady={bootShellDismissed}
      interactionLocked={mainPresentationInteractionLocked}
      presentationSignature={sessionSummarySignature}
      onNarration={handleSessionSummaryNarration}
    />
  ) : null;

  const requestedFlowSelectedLensDomain = effectiveScanSnapshot?.rhythmLensDomain || null;
  const flowTopSites = Array.isArray(effectiveScanSnapshot?.rhythmTopSites)
    ? effectiveScanSnapshot.rhythmTopSites
    : EMPTY_HOME_LIST;
  const flowPressureSummary = effectiveScanSnapshot?.pressureSummary || null;
  const flowPressureSites = useMemo(() => mainWidgetThemeId === 'zen'
    ? effectiveScannerDomainCandidateList.filter((candidate) => (
        Number(candidate?.weightedPressureMs) > 0
        && Number(candidate?.pressureShare) > 0
      ))
    : flowTopSites, [effectiveScannerDomainCandidateList, flowTopSites, mainWidgetThemeId]);
  const flowSelectedLensDomain = mainWidgetThemeId === 'zen'
    && !effectiveScannerDomainCandidateList.some(
      (candidate) => candidate?.domain === requestedFlowSelectedLensDomain,
    )
    ? null
    : requestedFlowSelectedLensDomain;
  const flowHoveredDomain = pondInteractive
    && mainWidgetThemeId === 'zen'
    && !mainPresentationInteractionLocked
    ? hoveredKoiDomain
    : null;
  // Pressure-rail hover writes to the external-hover channel of the interaction
  // store; the pond forwards it to the worker so the matching koi glints.
  // (hoveredDomain itself stays authored by the worker's pointer hit-test.)
  const flowHoverDomainHandler = pondInteractive
    && mainWidgetThemeId === 'zen'
    && !mainPresentationInteractionLocked
    ? setExternalHoverDomain
    : null;
  const flowInteractionActiveHandler = pondInteractive
    && mainWidgetThemeId === 'zen'
    && !mainPresentationInteractionLocked
    ? setPressureRailInteractionActive
    : null;

  useGuidanceAnchor({ guideId: 'garden.first_site', copyKey: mainWidgetThemeId === 'zen'
    ? 'guides.garden_first_site_zen' : 'guides.garden_first_site',
    elementRef: mainWidgetThemeId === 'zen' ? homePondSlotRef : registrationEntryRef,
    presentation: 'anchor',
    enabled: pondInteractive && bootShellDismissed && !firstVisionFocusActive && registeredSiteDomains.length === 0
      && registrationAvailability?.available === true,
    onAction: handleInvitationKoiActivate, actionKey: 'guides.garden_first_site_action' });
  const pressureRailProps = useMemo(() => applyZenMainCapturePressureRailProps({
    pressureSummary: flowPressureSummary,
    pressureSites: flowPressureSites,
    selectedLensDomain: flowSelectedLensDomain,
    hoveredDomain: flowHoveredDomain,
    onSelectDomain: !isActive || mainPresentationInteractionLocked
      ? null
      : ctrl.handleManageSites,
    onHoverDomain: flowHoverDomainHandler,
    onInteractionActiveChange: flowInteractionActiveHandler,
    frameVariant: ZEN_HOME_FRAME_VARIANTS.CUT,
  }, zenMainCaptureProfile, requestedFlowSelectedLensDomain), [
    zenMainCaptureProfile,
    ctrl.handleManageSites,
    flowPressureSites,
    flowPressureSummary,
    flowSelectedLensDomain,
    requestedFlowSelectedLensDomain,
    flowHoveredDomain,
    flowHoverDomainHandler,
    flowInteractionActiveHandler,
    isActive,
    mainPresentationInteractionLocked,
    rhythmAllowsLiveSelection,
  ]);

  const rhythmMarkerProps = useMemo(() => ({
    pressureProfile: effectiveScanSnapshot?.dailyFlow?.pressureProfile || null,
    selectedLensDomain: flowSelectedLensDomain,
    frameVariant: ZEN_HOME_FRAME_VARIANTS.INSCRIPTION,
  }), [
    effectiveScanSnapshot?.dailyFlow?.pressureProfile,
    flowSelectedLensDomain,
  ]);

  const HomeBriefCard = useMemo(() => {
    if (rendersPressureRailHome) return null;
    return getThemeWidget(mainWidgetThemeId, 'HomeBriefCard');
  }, [mainWidgetThemeId, rendersPressureRailHome]);

  const briefProps = useMemo(() => ({
    brief: resolvedBrief,
    className: 'h-full w-full',
  }), [resolvedBrief]);

  // Editor, guidance and frame-receipt state belong to Home. They must not
  // rerun a surface's model/hooks when every input to that surface is unchanged.
  // Default shallow comparison retains all scene, activity and callback inputs.
  const ResolvedSignalScanner = useMemo(() => React.memo(
    requireThemeWidget(mainWidgetThemeId, 'SignalScanner', SignalScanner),
  ), [mainWidgetThemeId, SignalScanner]);
  const ResolvedCoreStatus = useMemo(() => React.memo(
    requireThemeWidget(mainWidgetThemeId, 'CoreStatus', CoreStatus),
  ), [mainWidgetThemeId, CoreStatus]);
  const ResolvedPressureRail = useMemo(() => rendersPressureRailHome
    ? React.memo(requireThemeWidget(mainWidgetThemeId, 'PressureRail', PressureRail))
    : null, [mainWidgetThemeId, PressureRail, rendersPressureRailHome]);
  const ResolvedRhythmMarker = useMemo(() => rendersPressureRailHome
    ? React.memo(requireThemeWidget(mainWidgetThemeId, 'RhythmMarker', RhythmMarker))
    : null, [mainWidgetThemeId, RhythmMarker, rendersPressureRailHome]);
  const ResolvedHomeBriefCard = rendersPressureRailHome
    ? null
    : requireThemeWidget(mainWidgetThemeId, 'HomeBriefCard', HomeBriefCard);
  const mainPresentationProjectionTraceRef = useRef(null);
  useEffect(() => {
    if (!isActive || mainWidgetThemeId !== 'zen') return;
    const nextProjection = {
      sceneId: mainPresentationProjection?.decision?.sceneId || null,
      sceneSessionId: mainPresentationProjection?.decision?.sceneSessionId || null,
      kind: mainPresentationProjection?.decision?.kind || null,
      phase: mainPresentationProjection?.decision?.phase || null,
      pondPresentationMode: pondProjection?.presentationMode || null,
      pondFirstVisionPresentation,
      pondRosterMemoryPolicy: pondProjection?.rosterMemoryPolicy || null,
      bonsaiFirstVisionPresentation,
      bonsaiEnvironmentMode: bonsaiProjection?.environmentMode || null,
      bonsaiCultivationLedgerPolicy: bonsaiProjection?.cultivationLedgerPolicy || null,
      firstVisionFocusActive,
      rhythmReadMode: rhythmProjection?.readMode || null,
      rhythmSelectionMutation: rhythmProjection?.selectionMutation || null,
      interactionLocked: mainPresentationInteractionLocked,
      liveSelectionMode: interactionProjection?.liveSelectionMode || null,
      visualEmphasisActive: visualEmphasisProjection?.active === true,
      visualEmphasisMode: visualEmphasisProjection?.mode || null,
      diagnosticsDegraded: mainPresentationProjection?.diagnostics?.degraded === true,
      diagnosticsReason: mainPresentationProjection?.diagnostics?.reason || null,
    };
    const previous = mainPresentationProjectionTraceRef.current;
    const changed = !previous || Object.entries(nextProjection).some(
      ([key, value]) => previous[key] !== value,
    );
    if (!changed) return;
    emitZenTrace('main_presentation:projection', {
      previous,
      next: nextProjection,
    });
    mainPresentationProjectionTraceRef.current = nextProjection;
  }, [
    bonsaiFirstVisionPresentation,
    bonsaiProjection?.environmentMode,
    bonsaiProjection?.cultivationLedgerPolicy,
    firstVisionFocusActive,
    interactionProjection?.liveSelectionMode,
    isActive,
    mainPresentationInteractionLocked,
    mainPresentationProjection,
    mainWidgetThemeId,
    pondFirstVisionPresentation,
    pondProjection?.presentationMode,
    pondProjection?.rosterMemoryPolicy,
    rhythmProjection?.readMode,
    rhythmProjection?.selectionMutation,
    visualEmphasisProjection?.active,
    visualEmphasisProjection?.mode,
  ]);

  if (presentationSceneFatalError) {
    throw presentationSceneFatalError;
  }
  if (registrationJourneyError) throw registrationJourneyError;
  if (invitationAdmissionError) throw invitationAdmissionError;

  const registrationEditor = <ZenInvitationKoiRegistrationEditor
    open={invitationRegistrationOpen}
    initialCandidate={firstSiteCandidate}
    registrationAvailability={registrationAvailability}
    invitationEntityId={selectedInvitationEntityId}
    firstRegistration={ctrl.blockedList.length === 0}
    appearance={mainWidgetThemeId === 'zen' ? 'water' : 'surface'}
    firstUse={firstUse.required}
    recordingIncludesOtherSites={ctrl.blockedList.length > 0}
    onBrowseWithoutRecording={firstUse.browseWithoutRecording}
    browseBusy={firstUse.busy}
    browseStatus={firstUse.status}
    onClose={handleInvitationRegistrationClose}
    onSubmit={handleFirstSiteRegistration}
    onConfirmMove={handleFirstSiteMoveConfirmation}
    onOpenSites={handleInvitationOpenSites}
  />;

  return (
    <section
      className={[
        usesZenPressureRailLayout
          ? HOME_LAYOUT_CLASSNAMES.framedRoot
          : HOME_LAYOUT_CLASSNAMES.root,
      ].filter(Boolean).join(' ')}
      style={usesZenPressureRailLayout ? ZEN_HOME_FRAME_PAINT_STYLE : undefined}
      data-main-presentation-emphasis={mainPresentationEmphasisMode}
    >
      {rendersPressureRailHome ? (
        <ZenGardenFrame
          mode={gardenMode}
          pathwaysSlot={pathwaysSlot}
          workAreaRect={homeCompositionLayoutFrame?.workAreaRect}
          readingSpace={homeReadingSpace}
          textSafeRightCssPx={homeReadingSpace === null ? null : Math.max(0, ...homeReadingSpace.bands.map(band => homeReadingSpace.width - band.right))}
          animateWorkArea={animateWorkArea}
          gardenControlSlot={firstVisionFocusActive ? null : gardenControlSlot}
          transitionError={gardenTransitionError}
          pondPresentationReady={pondPresentationReady}
          stageRef={homeStageRef}
          pondRef={homePondSlotRef}
          bonsaiRef={homeBonsaiSlotRef}
          pondClipPath={homeCompositionLayoutFrame?.gardenAperture?.pondClipPath}
          pendingContent={<BottomFallback />}
          pondSlot={(
            <div className="relative h-full min-w-0"
              style={{ ...ZEN_HOME_REGISTRATION_STYLE, width: homeCompositionLayoutFrame?.gardenAperture?.pondViewportWidth }}>
              {/* The outer measurement slot stays stable; only this renderer
                  viewport ends just beyond the shared water/sky boundary. */}
              <ResolvedSignalScanner {...scannerProps} />
              {registrationEditor}
              {firstSiteRegistrationFeedback && pondInteractive ? (
                <ZenFirstSiteRegistrationFeedback receipt={firstSiteRegistrationFeedback}
                  onDismiss={dismissFirstSiteRegistrationFeedback} />
              ) : null}
            </div>
          )}
          rhythmSlot={<ResolvedRhythmMarker {...rhythmMarkerProps} />}
          bonsaiSlot={(
            <>
              <ResolvedCoreStatus {...coreStatusProps} />
              <BonsaiFirstBloomPrompt {...firstBloom.promptProps} regionTargets={currentBloomRegionTargets} />
              {!firstBloom.suppressGrowthReveal && <BonsaiGrowthReveal
                unlockProgress={progressionUnlockSnapshot}
                ready={bonsaiActive
                  && presentationAdmission.contextualPresentationAllowed
                  && bootShellDismissed === true
                  && !firstVisionFocusActive
                  && effectiveBonsaiFrameCurrent}
              />}
            </>
          )}
          gardenPlanes={homeCompositionLayoutFrame?.gardenAperture ? (
            <ZenHomeGardenPlanes aperture={homeCompositionLayoutFrame.gardenAperture} />
          ) : null}
          pressureDock={(
            <ZenHomePressureDock
              presented={isActive}
              layoutFrame={homePressureLayoutFrame}
              railSlotRef={homePressureRailSlotRef}
              RailComponent={ResolvedPressureRail}
              railProps={pressureRailProps}
              pendingContent={<BottomFallback />}
            />
          )}
        />
      ) : (
        <>
          <div
            className={HOME_LAYOUT_CLASSNAMES.topRow}
            data-main-presentation-layer="vision-surfaces"
          >
            <section className={HOME_LAYOUT_CLASSNAMES.scannerSlot}>
              <div className="relative h-full min-h-0 min-w-0" style={ZEN_HOME_REGISTRATION_STYLE}>
                <ResolvedSignalScanner {...scannerProps} />
                {registrationEditor}
                {firstSiteRegistrationFeedback && pondInteractive ? (
                  <ZenFirstSiteRegistrationFeedback receipt={firstSiteRegistrationFeedback}
                    onDismiss={dismissFirstSiteRegistrationFeedback} />
                ) : null}
              </div>
            </section>

            <div className={HOME_LAYOUT_CLASSNAMES.coreSlot}>
              <ResolvedCoreStatus {...coreStatusProps} />
            </div>
          </div>
          <section
            className={HOME_LAYOUT_CLASSNAMES.bottomSlot}
            data-main-presentation-layer="brief"
          >
            <ResolvedHomeBriefCard
              {...briefProps}
              aiNarrationSlot={aiNarrationSlot}
              onAction={handleBriefAction}
            />
          </section>
        </>
      )}
      {mainWidgetThemeId !== 'zen' && (
        <div className="order-first flex shrink-0 flex-wrap items-start justify-between gap-2 px-4 pt-3">
          {pondInteractive && bootShellDismissed && !mainPresentationInteractionLocked
          && registrationAvailability?.available === true ? (
            <button ref={registrationEntryRef} type="button" data-first-site-registration-entry="true" onClick={handleInvitationKoiActivate}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-primary shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent">
              {t(ctrl.blockedList.length > 0 ? 'invitation_koi.add_title' : 'invitation_koi.title')}
            </button>
          ) : null}
          {journeyProgressSlot}
          <GuidanceSupport />
        </div>
      )}
    </section>
  );
}

export default React.memo(HomeScanWorkspace);
