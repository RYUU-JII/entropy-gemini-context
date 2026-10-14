import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useSitesController } from '../../tabs/sites/useSitesController.js';
import { useSitesIntelCaptureProfile } from '@sites-intel-capture-profile';
import { runtimeSendMessage } from '../../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { useUIPreferences } from '../../stores/index.js';
import { useDashboardTabReadiness } from '../../loading/useDashboardTabReadiness.js';
import { useDashboardBackHandler } from '../../hooks/useDashboardNavigationButtonLock.js';
import {
  DashboardTabErrorSurface,
  DashboardTabRetryAction,
} from '../../loading/DashboardTabStateSurfaces.jsx';
import { getThemeWidget } from '../../../../themes/core/registry/index.js';
import { useAppTranslation } from '../../../../ui-kit/hooks/useAppTranslation.js';
import {
  isHostnameInList,
  PERSONAL_BASELINE_ROLES,
} from '../../../../lib/index.js';
import {
  requireSitesRegistryScope,
  SITES_REGISTRY_SCOPE_IDS,
  sortSitesRegistryDomains,
  SitesProtectionMark,
} from '@/themes/core/widgets/shared/sites/index.js';
import SitesHud from '../../tabs/sites/components/SitesHud.jsx';
import ZenSitesGlobalCapTrigger from '../../tabs/sites/components/ZenSitesGlobalCapTrigger.jsx';
import SitesSiteCap from '../../tabs/sites/components/SitesSiteCap.jsx';
import { resolveSitesCapAdmissionStatus } from '../../tabs/sites/components/sitesCapAdmission.js';
import SitesWorkspace from '../../tabs/sites/components/SitesWorkspace.jsx';
import SitesTabLoadingShell from '../../tabs/sites/components/SitesTabLoadingShell.jsx';
import { SitesWorkspaceHeader, SitesNotebookHeader } from '../../tabs/sites/components/SitesWorkspaceHeader.jsx';
import SitesPolicyDetail, { SitesRecordingActions } from '../../tabs/sites/components/SitesPolicyDetail.jsx';
import SitesRegistrationEditor from '../../tabs/sites/components/SitesRegistrationEditor.jsx';
import SitesNotebookTarget from '../../tabs/sites/components/SitesNotebookTarget.jsx';
import SettingsCommandFeedbackBridge from '../../components/SettingsCommandFeedbackBridge.jsx';
import { SETTINGS_COMMAND_CHANNELS } from '../../stores/settingsCommandBus.js';
import ZenSiteProtectionToggle from '../../tabs/sites/components/ZenSiteProtectionToggle.jsx';
import ZenSiteBudgetNote from '../../tabs/sites/components/ZenSiteBudgetNote.jsx';
import { buildProtectionRuntimeInsightCards } from '../../utils/protectionRuntimeInsights.js';
import { useSitesReleaseGuard } from '../../tabs/sites/controller/useSitesReleaseGuard.js';
import { projectSiteIntelViewState } from '../../tabs/sites/presentation/siteIntelViewState.js';
import { useSitesPresentationFeedback } from '../../tabs/sites/presentation/useSitesPresentationFeedback.js';
import { useSiteRegistrationJourney } from '../../progression/useSiteRegistrationJourney.js';
import FurinInstallationReceipt from '../../guidance/FurinInstallationReceipt.jsx';
import { GuidanceSupport } from '../../guidance/DashboardGuidanceProvider.jsx';
import './sitesManagementSurface.css';

// This slot places an app-owned editor without moving its React lifetime into a
// theme reading or a policy-query branch. Moving the same host keeps its draft,
// accepted-save observer and success timer alive through admission changes.
function SitesCapPresentationSlot({ host, placementFocusRef }) {
  const slot = useRef(null);
  useLayoutEffect(() => {
    const container = slot.current;
    const focused = host.contains(document.activeElement) ? document.activeElement : placementFocusRef.current;
    placementFocusRef.current = null;
    container.appendChild(host);
    if (focused?.isConnected && !focused.matches(':disabled')
      && !focused.closest('[hidden], [inert]') && document.activeElement === document.body) {
      focused.focus({ preventScroll: true });
    }
    return () => {
      if (host.parentNode !== container) return;
      if (host.contains(document.activeElement)) placementFocusRef.current = document.activeElement;
      container.removeChild(host);
    };
  }, [host, placementFocusRef]);
  return <div ref={slot} style={{ display: 'contents' }} />;
}

const SITES_WORKSPACE_VARIANTS = new Set(['standard', 'open']);
const SITES_NOTICE_VARIANTS = new Set(['standard', 'paper']);
const SITES_GLOBAL_CAP_VARIANTS = new Set(['standard', 'zen-stone-channel']);
const SITES_FEEDBACK_CHANNELS = Object.freeze([SETTINGS_COMMAND_CHANNELS.PROTOCOL]);

export function resolveSelectedSiteType(domain, {
  blockedTargets = [],
  allowedTargets = [],
  trackedTargets = [],
} = {}) {
  if (!domain) return 'unmanaged';
  if (isHostnameInList(domain, blockedTargets)) return 'blocked';
  if (isHostnameInList(domain, allowedTargets)) return 'allowed';
  if (isHostnameInList(domain, trackedTargets)) return 'tracked';
  return 'unmanaged';
}

function resolveSitesThemePolicy(themeProfile = {}) {
  const requestedGlobalCapVariant = themeProfile?.sites?.globalCapVariant;
  const requestedWorkspaceVariant = themeProfile?.sites?.workspaceVariant;
  const requestedNoticeVariant = themeProfile?.sites?.noticeVariant;
  const globalCapVariant = requestedGlobalCapVariant == null || requestedGlobalCapVariant === ''
    ? 'standard'
    : requestedGlobalCapVariant;
  const workspaceVariant = requestedWorkspaceVariant == null || requestedWorkspaceVariant === ''
    ? 'standard'
    : requestedWorkspaceVariant;
  const noticeVariant = requestedNoticeVariant == null || requestedNoticeVariant === ''
    ? 'standard'
    : requestedNoticeVariant;

  if (!SITES_GLOBAL_CAP_VARIANTS.has(globalCapVariant)) {
    throw new Error(`[SitesTab] Unsupported Sites global cap variant '${globalCapVariant}'.`);
  }
  if (!SITES_WORKSPACE_VARIANTS.has(workspaceVariant)) {
    throw new Error(`[SitesTab] Unsupported Sites workspace variant '${workspaceVariant}'.`);
  }
  if (!SITES_NOTICE_VARIANTS.has(noticeVariant)) {
    throw new Error(`[SitesTab] Unsupported Sites notice variant '${noticeVariant}'.`);
  }

  return {
    globalCapVariant,
    workspaceVariant,
    noticeVariant,
  };
}

function SitesTabErrorState({ t, error, onRetry = null }) {
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : 'Failed to prepare Sites workspace.';
  const detail = error?.code && error.code !== message ? `${message} (${error.code})` : message;

  return (
    <DashboardTabErrorSurface
      tabId="sites-tab"
      title={t('common:status.error')}
      detail={detail}
      testId="sites-tab-error"
      actions={typeof onRetry === 'function' ? (
        <DashboardTabRetryAction
          label={t('common:dashboard.main_panel.retry')}
          onRetry={onRetry}
        />
      ) : null}
    />
  );
}

function createSitesThemeWidgetError(themeId, missingWidgetTypes) {
  const missing = Array.isArray(missingWidgetTypes)
    ? missingWidgetTypes.filter(Boolean)
    : [];
  const error = new Error(
    `SITES_THEME_WIDGET_REQUIRED: theme '${themeId}' is missing ${missing.join(', ')}.`,
  );
  error.code = 'SITES_THEME_WIDGET_REQUIRED';
  error.details = {
    themeId,
    missingWidgetTypes: missing,
  };
  return error;
}

function SitesManagementContent({
  isRuntimeActive,
  embedded,
  params,
  onTabChange,
  sitesThemePolicy,
  themeId,
  t,
  tTabs,
  RegistryPanel,
  registrationJourney,
  presentationStateRef,
}) {
  const presentation = presentationStateRef.current;
  presentation.registry ||= {};
  presentation.capDrafts ||= {};
  presentation.registrationDrafts ||= {};
  presentation.notebookScroll ||= {};
  presentation.globalCapDraft ||= {};
  presentation.workspaceLayout ||= {};
  presentation.notebookReadings ||= {};
  const routeDomain = typeof params?.domain === 'string' ? params.domain.trim().toLowerCase() : '';
  const requestsLedger = params?.view === 'ledger' && params?.add !== true && !routeDomain;
  const hasExplicitWorkspaceIntent = requestsLedger || params?.add === true || routeDomain.length > 0;
  const [selectedDomain, setSelectedDomain] = useState(() => presentation.selectedDomain || null);
  const [workspaceMode, setWorkspaceMode] = useState(() => requestsLedger ? 'ledger' : presentation.workspaceMode || 'ledger');
  const [globalCapRequested, setGlobalCapOpen] = useState(() => !requestsLedger && themeId === 'zen' && presentation.globalCapOpen === true);
  const globalCapOpen = themeId === 'zen' && globalCapRequested;
  useEffect(() => { if (themeId !== 'zen') setGlobalCapOpen(false); }, [themeId]);
  const [registrationRequest, setRegistrationRequest] = useState(() => requestsLedger ? null : presentation.registrationRequest || null);
  const workspaceRef = useRef(null);
  const notebookNavigationRef = useRef(null);
  const siteCapNavigationRef = useRef(null);
  const globalCapNavigationRef = useRef(null);
  const siteCapPlacementFocusRef = useRef(null);
  const [siteCapHost] = useState(() => {
    const host = document.createElement('div');
    host.style.display = 'contents';
    return host;
  });
  const runtimeActiveRef = useRef(isRuntimeActive);
  runtimeActiveRef.current = isRuntimeActive;
  const globalCapPaneRef = useRef(null);
  const restoreGlobalCapFocusRef = useRef(false);
  const globalCapScrollRef = useRef(0);
  const globalCapReturnTargetRef = useRef(workspaceMode === 'ledger' ? 'ledger-menu' : 'trigger');
  const ledgerScrollRef = useRef(presentation.ledgerScroll || 0);
  const explicitSelectionRef = useRef(presentation.selectedDomain || null);
  const [consumedRoute, setConsumedRoute] = useState(() => presentation.consumedRoute);
  const workspaceIntentPending = hasExplicitWorkspaceIntent && consumedRoute !== params;
  const [activeRegistryScope, setActiveRegistryScope] = useState(() => presentation.activeRegistryScope || SITES_REGISTRY_SCOPE_IDS.ALL);
  useLayoutEffect(() => {
    Object.assign(presentation, { selectedDomain, workspaceMode, activeRegistryScope, registrationRequest, globalCapOpen });
  }, [presentation, selectedDomain, workspaceMode, activeRegistryScope, registrationRequest, globalCapOpen]);
  const openGlobalCap = (event) => {
    const ledgerMenu = event.currentTarget.closest('[data-sites-ledger-menu]');
    globalCapReturnTargetRef.current = ledgerMenu ? 'ledger-menu' : 'trigger';
    if (ledgerMenu) ledgerMenu.open = false;
    globalCapScrollRef.current = workspaceRef.current?.scrollTop || 0;
    setGlobalCapOpen(true);
    if (workspaceRef.current) workspaceRef.current.scrollTop = 0;
  };
  const closeGlobalCap = () => {
    const focused = document.activeElement;
    restoreGlobalCapFocusRef.current = isRuntimeActive && globalCapOpen
      && (focused === document.body || globalCapPaneRef.current?.contains(focused));
    setGlobalCapOpen(false);
  };
  const labels = useMemo(() => ({
    registry: {
      title: t('registry.title'),
      description: t('registry.description'),
      helperText: t('registry.helper_text'),
      blockedLabel: t('registry.blocked_label'),
      allowedLabel: t('registry.allowed_label'),
      trackedLabel: t('registry.tracked_label'),
      addLabel: t('registry.add_label'),
      searchPlaceholder: t('registry.search_placeholder'),
      blockedPlaceholder: t('registry.search_placeholder'),
      allowedPlaceholder: t('registry.allowed_placeholder'),
      trackedPlaceholder: t('registry.tracked_placeholder'),
    },
    targetRegistry: {
      title: t('target_protocol.title'),
      statusBlocked: t('target_protocol.status_blocked'),
      statusAllowed: t('target_protocol.status_allowed'),
      statusTracked: t('target_protocol.status_tracked'),
      statusUnmanaged: t('target_protocol.status_unmanaged'),
      selectPrompt: t('target_protocol.select_prompt'),
      healthLabel: t('target_protocol.health_label'),
      healthStatus: t('target_protocol.health_status'),
      growthLabel: t('target_protocol.growth_label'),
      growthStatus: t('target_protocol.growth_status'),
    },
    safeZone: {},
  }), [t]);

  const registrySurfaceLabels = useMemo(() => ({
    ...labels.registry,
    title: '',
    description: '',
    helperText: '',
  }), [labels.registry]);

  const {
    blockedTargets,
    allowedTargets,
    trackedTargets,
    trackingExcludedTargets,
    siteDetails,
    observedSiteDetails,
    siteRegistry,
    siteGoals,
    siteIntels,
    selectedSiteDetail,
    siteDetailStatus,
    siteDetailError,
    retrySiteDetail,
    sitesSnapshotStatus,
    sitesSnapshotError,
    retrySitesSnapshot,
    globalGoal,
    handleAdd,
    handleConfirmMove,
    handleRemove,
    handleExcludeTracked,
    handleUnexcludeTracked,
    handleGlobalGoalChange,
    handleSiteGoalChange,
    totalExposure,
    globalExposureAverage,
    recording,
    sitesSnapshotRevision,
    sitesPolicyFingerprint,
    resolveSiteSelectionDomain,
    sitesSnapshotComputedAt,
  } = useSitesController({
    selectedDomain,
    isActive: isRuntimeActive,
    detailEnabled: workspaceMode === 'notebook' && registrationRequest === null && !globalCapOpen
      && !workspaceIntentPending,
  });
  const currentSnapshotReady = globalExposureAverage !== null;
  // Retain only frame lifetime; current-policy query owners still withdraw all DTOs.
  const [workspaceAdmitted, setWorkspaceAdmitted] = useState(() => presentation.workspaceAdmitted === true);
  useLayoutEffect(() => { if (currentSnapshotReady) { setWorkspaceAdmitted(true); presentation.workspaceAdmitted = true; } }, [currentSnapshotReady, presentation]);
  useLayoutEffect(() => {
    if (globalCapOpen || !restoreGlobalCapFocusRef.current) return;
    const focused = document.activeElement;
    if (!isRuntimeActive || (focused !== document.body && !globalCapPaneRef.current?.contains(focused))) {
      restoreGlobalCapFocusRef.current = false;
      return;
    }
    const returnSelector = globalCapReturnTargetRef.current === 'ledger-menu'
      ? '[data-sites-ledger-menu-trigger]' : '[data-sites-global-cap-trigger]';
    const trigger = Array.from(workspaceRef.current?.querySelectorAll(returnSelector) || [])
      .find((node) => {
        if (node.closest('[hidden], [inert]')) return false;
        return node.matches('[data-sites-ledger-menu-trigger]') || !node.closest('details:not([open])');
      });
    // A command may withdraw the registry until its matching policy snapshot.
    // Keep this one focus request pending; never revive it after focus moved.
    if (!trigger) return;
    restoreGlobalCapFocusRef.current = false;
    if (workspaceRef.current) workspaceRef.current.scrollTop = globalCapScrollRef.current;
    trigger.focus({ preventScroll: true });
  }, [currentSnapshotReady, globalCapOpen, isRuntimeActive]);
  const capAdmissionStatus = resolveSitesCapAdmissionStatus({ currentSnapshotReady, snapshotStatus: sitesSnapshotStatus });
  const selectedEntry = currentSnapshotReady
    ? selectedSiteDetail?.domain === selectedDomain ? selectedSiteDetail.registryEntry : siteRegistry.byDomain[selectedDomain]
    : null;
  const selectedType = useMemo(() => resolveSelectedSiteType(selectedDomain, {
    blockedTargets,
    allowedTargets,
    trackedTargets,
  }), [allowedTargets, blockedTargets, selectedDomain, trackedTargets]);
  const selectedGoalMinutes = selectedDomain && Object.hasOwn(siteGoals, selectedDomain) ? siteGoals[selectedDomain] : 0;
  if (currentSnapshotReady && selectedDomain && selectedType === 'blocked' && selectedEntry?.type !== 'blocked') {
    throw new Error('SITES_CAP_CURRENT_ENTRY_REQUIRED');
  }
  const openRecordingSettings = useCallback(() => onTabChange('settings', { section: 'permissions' }), [onTabChange]);
  const openExcludedSettings = useCallback(() => onTabChange('settings', { section: 'permissions', focus: 'recording-exclusions' }), [onTabChange]);
  const [releaseReview, setReleaseReview] = useState(null);
  const [moveReview, setMoveReview] = useState(null);
  const { error: sitesAddError, status: sitesAddStatus, setError: setSitesAddError, setStatus: setSitesAddStatus } = useSitesPresentationFeedback(presentation);
  const localFrameMountedRef = useRef(true);
  useEffect(() => { localFrameMountedRef.current = true; return () => { localFrameMountedRef.current = false; }; }, []);
  const removeWithFeedback = useCallback(async (domain, type) => {
    try {
      const result = await handleRemove(domain, type);
      if (result === false && !localFrameMountedRef.current) setSitesAddError(t('release.failed_body'));
      return result;
    } catch (error) {
      if (!localFrameMountedRef.current) setSitesAddError(t('release.failed_body'));
      throw error;
    }
  }, [handleRemove, setSitesAddError, t]);
  const {
    pending: pendingRelease,
    requestRelease,
    undoRelease,
  } = useSitesReleaseGuard({ onRemove: removeWithFeedback, enabled: isRuntimeActive && currentSnapshotReady && workspaceMode === 'notebook' && !globalCapOpen });
  const [selectedRuntimeSnapshot, setSelectedRuntimeSnapshot] = useState(null);
  const [reviewRecommendationDismissed, setReviewRecommendationDismissed] = useState(false);
  const reviewRecommendationSequenceRef = useRef(0);
  const [recentlyExcludedDomains, setRecentlyExcludedDomains] = useState([]);
  const trackingRestorePendingDomainsRef = useRef(new Set());
  const [trackingRestorePendingDomains, setTrackingRestorePendingDomains] = useState(() => new Set());

  const routeRecovery = typeof params?.recovery === 'string' ? params.recovery.trim() : '';
  const requestRegistration = useCallback(({ domain = '', type = 'blocked' } = {}) => {
    const normalizedDomain = typeof domain === 'string' ? domain.trim().toLowerCase() : '';
    if (workspaceMode === 'ledger') ledgerScrollRef.current = workspaceRef.current?.scrollTop || 0;
    const request = { domain: normalizedDomain, type, key: `${type}:${normalizedDomain || 'new'}` };
    presentation.registrationDrafts[request.key] ||= { domainDraft: normalizedDomain };
    explicitSelectionRef.current = normalizedDomain;
    setSelectedDomain(normalizedDomain || null);
    setRegistrationRequest(request);
    setGlobalCapOpen(false);
    restoreGlobalCapFocusRef.current = false;
    setWorkspaceMode('notebook');
  }, [presentation, workspaceMode]);

  const handleSelectDomain = useCallback((domain, requestedScope = null) => {
    const normalizedDomain = typeof domain === 'string' ? domain.trim().toLowerCase() : '';
    if (!normalizedDomain) return;
    const managedDomain = resolveSiteSelectionDomain(normalizedDomain);
    const inferredScope = resolveSelectedSiteType(managedDomain, {
      blockedTargets,
      allowedTargets,
      trackedTargets,
    });
    if (requestedScope === SITES_REGISTRY_SCOPE_IDS.ALL || inferredScope !== 'blocked') setActiveRegistryScope(SITES_REGISTRY_SCOPE_IDS.ALL);
    explicitSelectionRef.current = managedDomain;
    setGlobalCapOpen(false);
    restoreGlobalCapFocusRef.current = false;
    setRegistrationRequest(null);
    setSelectedDomain(managedDomain);
    if (workspaceMode === 'ledger') ledgerScrollRef.current = workspaceRef.current?.scrollTop || 0;
    setWorkspaceMode('notebook');
    if (workspaceRef.current) workspaceRef.current.scrollTop = 0;
  }, [allowedTargets, blockedTargets, trackedTargets, resolveSiteSelectionDomain, workspaceMode]);

  useLayoutEffect(() => {
    if (!isRuntimeActive || !recording || consumedRoute === params) return;
    if (params?.add === true && registrationJourney.snapshot === null) return;
    setConsumedRoute(params);
    presentation.consumedRoute = params;
    if (params?.add === true) {
      requestRegistration({ domain: routeDomain });
    } else if (routeDomain) handleSelectDomain(routeDomain);
    else if (requestsLedger) {
      restoreGlobalCapFocusRef.current = false;
      setGlobalCapOpen(false);
      setRegistrationRequest(null);
      setWorkspaceMode('ledger');
    }
  }, [isRuntimeActive, recording, params, consumedRoute, presentation, requestsLedger, routeDomain, handleSelectDomain, registrationJourney.snapshot, requestRegistration]);

  const clearSitesAddFeedback = useCallback(() => {
    setSitesAddError('');
    setSitesAddStatus('');
  }, []);

  const handleRequestSiteRelease = useCallback(async (domain, type) => {
    if (type !== 'blocked' && type !== 'allowed') return false;
    if (pendingRelease && pendingRelease.domain !== domain) {
      setSitesAddError(t('release.pending_other', { domain: pendingRelease.domain }));
      return false;
    }

    setReleaseReview({ domain, type });
    clearSitesAddFeedback();
    return true;
  }, [clearSitesAddFeedback, pendingRelease, t]);

  const handleConfirmSiteRelease = useCallback((domain, type) => {
    const currentTargets = type === 'blocked' ? blockedTargets : allowedTargets;
    if (!currentTargets.includes(domain)) {
      setReleaseReview(null);
      setSitesAddError(t('release.failed_body'));
      return false;
    }
    const scheduled = requestRelease(domain, type);
    if (scheduled) setReleaseReview(null);
    return Boolean(scheduled);
  }, [allowedTargets, blockedTargets, requestRelease, t]);

  const handleCancelSiteRelease = useCallback(() => {
    const cancelled = undoRelease();
    if (cancelled) {
      setSitesAddStatus(t('release.cancelled'));
      setSitesAddError('');
    }
    return cancelled;
  }, [t, undoRelease]);

  const handleExcludeTrackedWithUndo = useCallback(async (domain) => {
    const normalizedDomain = typeof domain === 'string' ? domain.trim().toLowerCase() : '';
    if (!normalizedDomain) return false;
    setSitesAddError('');
    setSitesAddStatus('');
    try {
      const excluded = await handleExcludeTracked(normalizedDomain);
      if (excluded === false) {
        setSitesAddError(t('tracking_exclusion.exclude_failed'));
        return false;
      }
      setRecentlyExcludedDomains((current) => (
        current.includes(normalizedDomain)
          ? current
          : [...current, normalizedDomain]
      ));
      return true;
    } catch (error) {
      setSitesAddError(t('tracking_exclusion.exclude_failed'));
      return false;
    }
  }, [handleExcludeTracked, t]);

  const handleRestoreTracking = useCallback(async (domain) => {
    const normalizedDomain = typeof domain === 'string' ? domain.trim().toLowerCase() : '';
    if (!normalizedDomain || trackingRestorePendingDomainsRef.current.has(normalizedDomain)) {
      return false;
    }
    trackingRestorePendingDomainsRef.current.add(normalizedDomain);
    setTrackingRestorePendingDomains(new Set(trackingRestorePendingDomainsRef.current));
    setSitesAddError('');
    try {
      const restored = await handleUnexcludeTracked(normalizedDomain);
      if (restored === false) {
        setSitesAddError(t('tracking_exclusion.restore_failed'));
        return false;
      }
      setRecentlyExcludedDomains((current) => (
        current.filter((candidate) => candidate !== normalizedDomain)
      ));
      setSitesAddStatus(t('tracking_exclusion.restored'));
      return true;
    } catch (error) {
      setSitesAddError(t('tracking_exclusion.restore_failed'));
      return false;
    } finally {
      trackingRestorePendingDomainsRef.current.delete(normalizedDomain);
      setTrackingRestorePendingDomains(new Set(trackingRestorePendingDomainsRef.current));
    }
  }, [handleUnexcludeTracked, t]);

  const resolveSitesMessage = useCallback((messageKey, messageParams = {}) => {
    if (!messageKey) return t('common:status.error');
    return t(messageKey, messageParams);
  }, [t]);

  const handleAddWithFeedback = useCallback(async (value, type, { goalMinutes = null, moveFromType = null, structured = false } = {}) => {
    clearSitesAddFeedback();
    if (type === 'blocked') {
      if (registrationJourney.snapshot === null) {
        const message = registrationJourney.error ? registrationJourney.error.message : t('common:status.loading');
        if (!structured) setSitesAddError(message);
        return structured ? { ok: false, message } : false;
      }
    }
    let result;
    try {
      result = await handleAdd(value, type, goalMinutes);
    if (result?.kind === 'confirm_move') {
      const admission = result.admission;
      if (moveFromType !== admission.existingType) {
        if (!structured) setMoveReview({ domain: admission.normalizedDomain, fromType: admission.existingType, toType: type,
          message: resolveSitesMessage(result.messageKey, result.messageParams) });
        return structured ? result : false;
      }
      result = await handleConfirmMove({ domain: admission.normalizedDomain, fromType: admission.existingType, toType: type, goalMinutes });
    }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('errors.save_failed');
      if (!structured) setSitesAddError(message);
      return structured ? { ok: false, message } : false;
    }
    if (result?.ok || result === true) {
      setMoveReview(null);
      return structured ? result : true;
    }
    const message = result?.message || resolveSitesMessage(result?.messageKey, result?.messageParams);
    if (!structured) setSitesAddError(message);
    return structured ? { ...result, ok: false, message } : false;
  }, [clearSitesAddFeedback, handleAdd, handleConfirmMove, resolveSitesMessage, t, registrationJourney.error, registrationJourney.snapshot]);

  const sortedBlocked = useMemo(() => sortSitesRegistryDomains(siteRegistry.entries.filter((entry) => entry.type === 'blocked').map((entry) => entry.domain), {
    type: 'blocked',
    siteRegistry,
    observedSiteDetails,
  }), [blockedTargets, observedSiteDetails, siteRegistry]);
  const sortedAllowed = useMemo(() => sortSitesRegistryDomains(allowedTargets, {
    type: 'allowed',
    siteRegistry,
    observedSiteDetails,
  }), [allowedTargets, observedSiteDetails, siteRegistry]);
  const sortedTracked = useMemo(() => sortSitesRegistryDomains(trackedTargets, {
    type: 'tracked',
    siteRegistry,
    observedSiteDetails,
  }), [observedSiteDetails, siteRegistry, trackedTargets]);
  const registryTargetsByScope = useMemo(() => ({
    [SITES_REGISTRY_SCOPE_IDS.ALL]: sortSitesRegistryDomains(siteRegistry.entries.map((entry) => entry.domain), { siteRegistry }),
    [SITES_REGISTRY_SCOPE_IDS.BLOCKED]: sortedBlocked,
    [SITES_REGISTRY_SCOPE_IDS.ALLOWED]: sortedAllowed,
    [SITES_REGISTRY_SCOPE_IDS.TRACKED]: sortedTracked,
  }), [sortedAllowed, sortedBlocked, sortedTracked, siteRegistry]);
  const visibleRegistryScope = recording?.effectiveScope === 'all_sites' ? activeRegistryScope : SITES_REGISTRY_SCOPE_IDS.BLOCKED;
  const handleRegistryScopeChange = useCallback((nextScope) => {
    const resolvedScope = requireSitesRegistryScope(nextScope);
    explicitSelectionRef.current = null;
    setActiveRegistryScope(resolvedScope);
    setSelectedDomain((current) => registryTargetsByScope[resolvedScope].includes(current) ? current : null);
  }, [registryTargetsByScope]);
  const handleSelectBlocked = useCallback(
    (domain) => handleSelectDomain(domain, SITES_REGISTRY_SCOPE_IDS.BLOCKED),
    [handleSelectDomain],
  );
  const handleSelectAllowed = useCallback(
    (domain) => handleSelectDomain(domain, SITES_REGISTRY_SCOPE_IDS.ALLOWED),
    [handleSelectDomain],
  );
  const handleSelectTracked = useCallback(
    (domain) => handleSelectDomain(domain, SITES_REGISTRY_SCOPE_IDS.TRACKED),
    [handleSelectDomain],
  );
  useEffect(() => {
    // Route consumption updates selection in a layout effect. This render's old
    // selection must not reconcile against its newly written explicit-domain ref.
    if (!isRuntimeActive || !recording || workspaceIntentPending) return;
    const targets = registryTargetsByScope[visibleRegistryScope];
    if (selectedDomain && targets.includes(selectedDomain)) return;
    // Explicit navigation remains valid outside list membership; the detail owner
    // resolves recording admission and can return a policy-only view.
    if (selectedDomain && selectedDomain === explicitSelectionRef.current) return;
    // Allowlist management may select a policy outside the current recording scope.
    if (selectedDomain && allowedTargets.includes(selectedDomain) && !siteRegistry.byDomain[selectedDomain]) return;
    if (routeDomain && !selectedDomain) return;
    if (selectedDomain) {
      setSelectedDomain(null);
      setWorkspaceMode('ledger');
    }
  }, [isRuntimeActive, recording, registryTargetsByScope, visibleRegistryScope, selectedDomain, allowedTargets, siteRegistry, routeDomain, workspaceIntentPending]);
  const detailMatchesSelection = selectedSiteDetail?.domain === selectedDomain;
  const selectedIntelSource = detailMatchesSelection
    ? selectedSiteDetail.intel
    : siteIntels[selectedDomain];
  const selectedIntelRegistryEntry = detailMatchesSelection
    ? selectedSiteDetail.registryEntry
    : siteRegistry.byDomain[selectedDomain] || null;
  // Snapshot polling may replace every registry row while the same full detail
  // is retained. Only rebuild its analysis projection when its own inputs change.
  const selectedLiveIntel = useMemo(() => {
    if (!selectedDomain) return null;
    if (!selectedIntelSource) {
      return {
        domain: selectedDomain,
        type: selectedType,
        registryEntry: selectedIntelRegistryEntry,
        isReady: false,
      };
    }
    return {
      ...selectedIntelSource,
      type: selectedType,
      registryEntry: selectedIntelRegistryEntry,
      isReady: detailMatchesSelection || selectedIntelSource.detailTier === 'full',
    };
  }, [selectedDomain, selectedType, selectedIntelSource, selectedIntelRegistryEntry, detailMatchesSelection]);
  const selectedIntel = useSitesIntelCaptureProfile(selectedLiveIntel);
  const contentReady = currentSnapshotReady && (globalCapOpen || workspaceMode === 'ledger'
    || registrationRequest !== null || selectedEntry?.recording.enabled === false
    || selectedIntel?.isReady === true || siteDetailStatus === 'ready');
  const workspacePresentationKey = globalCapOpen ? 'global-cap' : workspaceMode === 'ledger' ? 'ledger' : `notebook:${selectedDomain || 'registration'}`;
  const retainsContentFootprint = Boolean(presentation.workspaceLayout.footprints?.[workspacePresentationKey]);
  useLayoutEffect(() => {
    if (!workspaceRef.current || globalCapOpen || !currentSnapshotReady || (!contentReady && retainsContentFootprint)) return;
    workspaceRef.current.scrollTop = workspaceMode === 'ledger' ? ledgerScrollRef.current : presentation.notebookScroll[selectedDomain || 'registration'] || 0;
  }, [contentReady, currentSnapshotReady, retainsContentFootprint, globalCapOpen, presentation, selectedDomain, workspaceMode]);
  const targetPanelWeekdayLabels = useMemo(() => ([
    t('target_panel.weekday_short.sun'),
    t('target_panel.weekday_short.mon'),
    t('target_panel.weekday_short.tue'),
    t('target_panel.weekday_short.wed'),
    t('target_panel.weekday_short.thu'),
    t('target_panel.weekday_short.fri'),
    t('target_panel.weekday_short.sat'),
  ]), [t]);
  const targetPanelState = useMemo(() => projectSiteIntelViewState({
    intel: selectedIntel,
    recordingEnabled: selectedEntry?.recording.enabled,
    weeklyFallbackLabels: targetPanelWeekdayLabels,
  }), [selectedIntel, targetPanelWeekdayLabels, selectedEntry?.recording.enabled]);

  useEffect(() => {
    const isReviewGoalRequest = routeRecovery === 'reviewGoal'
      && selectedEntry?.recording.enabled === true
      && routeDomain
      && selectedDomain
      && isHostnameInList(routeDomain, [selectedDomain]);
    if (!isRuntimeActive || globalCapOpen || workspaceMode !== 'notebook') return undefined;
    if (!isReviewGoalRequest) {
      setSelectedRuntimeSnapshot(null);
      return undefined;
    }

    let cancelled = false;
    void runtimeSendMessage({
      action: MESSAGE_ACTIONS.REFRESH_PROTECTION_RUNTIME_SNAPSHOT,
      hostname: selectedDomain,
    }).then((response) => {
      if (cancelled) return;
      setSelectedRuntimeSnapshot(response?.success ? response.snapshot || null : null);
    }).catch(() => {
      if (!cancelled) {
        setSelectedRuntimeSnapshot(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isRuntimeActive, globalCapOpen, workspaceMode, routeDomain, routeRecovery, selectedDomain, selectedEntry?.recording.enabled]);

  const {
    snapshot: normalizedRuntimeInsightSnapshot,
    cards: runtimeInsightCards,
  } = useMemo(
    () => buildProtectionRuntimeInsightCards(selectedRuntimeSnapshot, tTabs),
    [selectedRuntimeSnapshot, tTabs],
  );
  const reviewGoalAction = useMemo(
    () => runtimeInsightCards
      .flatMap((card) => (Array.isArray(card?.actions) ? card.actions : []))
      .find((action) => action?.id === 'review-goal' && action?.params?.domain === selectedDomain) || null,
    [runtimeInsightCards, selectedDomain],
  );
  const reviewGoalCard = useMemo(
    () => runtimeInsightCards.find((card) => card.id === 'target') || null,
    [runtimeInsightCards],
  );
  const reviewRecommendation = useMemo(() => {
    if (selectedEntry?.recording.enabled !== true || !reviewGoalAction) return null;
    const strategy = normalizedRuntimeInsightSnapshot.runtime?.strategy || null;
    const targetRecommendation = strategy?.targetRecommendation || null;
    const domain = normalizedRuntimeInsightSnapshot.scope?.host || '';
    if (!selectedDomain || !domain || !isHostnameInList(domain, [selectedDomain])) return null;
    if (targetRecommendation?.role !== PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE
      || targetRecommendation.requiresUserReview !== true
      || targetRecommendation.autoApply !== false) return null;

    const recommendedTargetMinutes = targetRecommendation.recommendedTargetMinutes;
    const declaredTargetMinutes = strategy.declaredTargetMinutes;

    if (!recommendedTargetMinutes) return null;
    if (declaredTargetMinutes > 0 && recommendedTargetMinutes <= declaredTargetMinutes) return null;

    return {
      domain: selectedDomain,
      recommendedTargetMinutes,
      declaredTargetMinutes,
      title: reviewGoalCard?.title || tTabs('runtime_insights.target_review_title'),
      body: reviewGoalCard?.body || tTabs('runtime_insights.target_review_body', {
        declared: declaredTargetMinutes,
        recommended: recommendedTargetMinutes,
      }),
    };
  }, [
    selectedEntry?.recording.enabled,
    reviewGoalAction,
    reviewGoalCard?.body,
    reviewGoalCard?.title,
    normalizedRuntimeInsightSnapshot,
    selectedDomain,
    tTabs,
  ]);
  const reviewRecommendationKey = reviewRecommendation
    ? `${reviewRecommendation.domain}:${reviewRecommendation.recommendedTargetMinutes}`
    : '';

  useLayoutEffect(() => {
    if (!isRuntimeActive) return;
    reviewRecommendationSequenceRef.current += 1;
    setReviewRecommendationDismissed(false);
  }, [isRuntimeActive, reviewRecommendationKey]);

  const handleDismissReviewRecommendation = useCallback(() => {
    setReviewRecommendationDismissed(true);
  }, []);

  const visibleReviewRecommendation = reviewRecommendationDismissed ? null : reviewRecommendation;
  const notices = <><SettingsCommandFeedbackBridge channels={SITES_FEEDBACK_CHANNELS} includeSaveFailures={false} /><FurinInstallationReceipt enabled={isRuntimeActive && currentSnapshotReady} /><GuidanceSupport />{(sitesAddStatus || sitesAddError || sitesSnapshotError) && <div className="sites-inline-feedback" role={sitesAddError || sitesSnapshotError ? 'alert' : 'status'}
    data-sites-read-error-code={sitesSnapshotError?.code} data-sites-read-error-owner={sitesSnapshotError ? 'stats.GET_SITES_SNAPSHOT' : undefined}>
    <p>{sitesAddError || (sitesSnapshotError ? t('site_workspace.snapshot_unavailable_body') : sitesAddStatus)}</p>
    {sitesSnapshotError?.code && <code>{sitesSnapshotError.code}</code>}
    {!sitesAddError && sitesSnapshotError && <DashboardTabRetryAction label={t('common:dashboard.main_panel.retry')} onRetry={retrySitesSnapshot} />}
  </div>}</>;

  const globalCapTrigger = themeId === 'zen' ? <ZenSitesGlobalCapTrigger goalMinutes={globalGoal}
    inactive={currentSnapshotReady && !recording.globalCapAvailable} onClick={openGlobalCap} t={t} /> : null;
  const globalCap = <SitesHud
    variant={sitesThemePolicy.globalCapVariant}
    totalExposure={totalExposure} globalExposureAverage={globalExposureAverage}
    globalGoal={globalGoal} recording={recording} admissionStatus={capAdmissionStatus}
    presentationState={presentation.globalCapDraft} showAdmissionFeedback={themeId === 'zen'}
    onGlobalGoalChange={handleGlobalGoalChange}
    isRuntimeActive={isRuntimeActive && (themeId !== 'zen' || globalCapOpen)}
    presentation={themeId === 'zen' ? 'workspace' : 'inline'} isPresented={themeId !== 'zen' || globalCapOpen}
    navigationRef={themeId === 'zen' ? globalCapNavigationRef : null}
    onRequestClose={closeGlobalCap} compact={themeId === 'zen'} />;

  const notebookSpread = false;
  const zenNotebook = themeId === 'zen' && workspaceMode === 'notebook' && registrationRequest === null;
  const boundedNotebook = zenNotebook && !globalCapOpen;
  const registryPane = currentSnapshotReady ? (
    <RegistryPanel
      layout={notebookSpread ? 'notebook' : 'ledger'}
      isPresented={(workspaceMode === 'ledger' || notebookSpread) && !globalCapOpen}
      policyControl={globalCapTrigger}
      onRequestRegistration={requestRegistration}
      registrationPending={registrationJourney.snapshot === null}
      presentationState={presentation.registry}
      blockedTargets={sortedBlocked}
      allowedTargets={sortedAllowed}
      trackedTargets={sortedTracked}
      trackingExcludedTargets={trackingExcludedTargets}
      siteDetails={siteDetails}
      observedSiteDetails={observedSiteDetails}
      siteRegistry={siteRegistry}
      recording={recording}
      policyFingerprint={sitesPolicyFingerprint}
      onOpenRecordingSettings={openRecordingSettings}
      onManageExclusions={openExcludedSettings}
      siteGoals={siteGoals}
      siteIntels={siteIntels}
      onProtectTracked={(val) => handleAddWithFeedback(val, 'blocked')}
      onAllowTracked={(val) => handleAddWithFeedback(val, 'allowed')}
      onExcludeTracked={handleExcludeTrackedWithUndo}
      onUnexcludeTracked={handleUnexcludeTracked}
      pendingRelease={pendingRelease}
      activeScope={visibleRegistryScope}
      selectedDomain={selectedDomain}
      selectedType={selectedType}
      onScopeChange={handleRegistryScopeChange}
      onSelectBlocked={handleSelectBlocked}
      onSelectAllowed={handleSelectAllowed}
      onSelectTracked={handleSelectTracked}
      labels={registrySurfaceLabels}
      targetLabels={labels.targetRegistry}
      safeZoneLabels={labels.safeZone}
    />
  ) : null;

  const ownsSelectedPolicy = selectedType === 'blocked'
    ? siteRegistry.byDomain[selectedDomain]?.type === 'blocked'
    : selectedType === 'allowed' && allowedTargets.includes(selectedDomain);
  const releaseControl = selectedDomain && ownsSelectedPolicy
    ? {
      type: selectedType,
      phase: pendingRelease?.domain === selectedDomain ? pendingRelease.phase : releaseReview?.domain === selectedDomain ? 'review' : 'idle',
      remainingSeconds: pendingRelease?.domain === selectedDomain
        ? pendingRelease.remainingSeconds
        : 0,
      error: pendingRelease?.domain === selectedDomain ? pendingRelease.error : null,
      blockedByOtherPending: Boolean(pendingRelease && pendingRelease.domain !== selectedDomain),
      onRequest: () => handleRequestSiteRelease(selectedDomain, selectedType),
      onCancel: () => { setReleaseReview(null); return handleCancelSiteRelease(); },
      onConfirm: () => handleConfirmSiteRelease(selectedDomain, selectedType),
      onKeep: () => setReleaseReview(null),
    }
    : null;

  const selectedPolicyLabels = {
    blocked: t('target_protocol.status_blocked'),
    allowed: t('target_protocol.status_allowed'),
    tracked: t('target_protocol.status_tracked'),
    unmanaged: t('target_protocol.status_unmanaged'),
  };
  const selectedSiteCap = selectedDomain && selectedType === 'blocked' ? <>
    <SitesSiteCap domain={selectedDomain} type={selectedType} goalMinutes={selectedGoalMinutes}
      capAvailability={selectedEntry?.capAvailability} admissionStatus={capAdmissionStatus}
      presentationState={presentation.capDrafts[selectedDomain] ||= {}} showAdmissionFeedback={false}
      recommendation={visibleReviewRecommendation} onDismissRecommendation={handleDismissReviewRecommendation}
      onGoalChange={handleSiteGoalChange} minimal={themeId === 'zen'}
      presentation="inline"
      navigationRef={themeId === 'zen' ? siteCapNavigationRef : null}
      isRuntimeActive={isRuntimeActive && workspaceMode === 'notebook' && registrationRequest === null && !globalCapOpen} />
    {themeId === 'zen' && currentSnapshotReady && <ZenSiteBudgetNote entry={siteRegistry.byDomain[selectedDomain]} goalMinutes={selectedGoalMinutes} t={t} />}
  </> : null;
  const selectedSiteCapSlot = themeId === 'zen' && selectedSiteCap
    ? <SitesCapPresentationSlot host={siteCapHost} placementFocusRef={siteCapPlacementFocusRef} /> : selectedSiteCap;
  const selectedRecordingControl = selectedEntry && <SitesRecordingActions key={selectedDomain}
    minimal={themeId === 'zen'} isPresented={isRuntimeActive && workspaceMode === 'notebook' && !globalCapOpen} domain={selectedDomain}
    recording={selectedEntry.recording} type={selectedType} releaseControl={releaseControl}
    onProtect={(domain) => handleAddWithFeedback(domain, 'blocked')} onExclude={handleExcludeTrackedWithUndo}
    onSettings={openRecordingSettings} onManageExclusions={openExcludedSettings}
    excluded={recentlyExcludedDomains.includes(selectedDomain)} restoring={trackingRestorePendingDomains.has(selectedDomain)} onRestore={handleRestoreTracking} />;
  const handleRegistered = (domain) => {
    setRegistrationRequest(null);
    explicitSelectionRef.current = domain;
    setSelectedDomain(domain);
    setWorkspaceMode('notebook');
  };
  const detailPane = registrationRequest ? (
    <SitesRegistrationEditor key={registrationRequest.key} type={registrationRequest.type} initialDomain={registrationRequest.domain}
      presentationState={presentation.registrationDrafts[registrationRequest.key]}
      disabled={!currentSnapshotReady || registrationJourney.snapshot === null}
      onRegister={handleAddWithFeedback} onRegistered={handleRegistered} onCancel={() => handleBackToLedger()} t={t} />
  ) : !currentSnapshotReady ? (
    null
  ) : selectedEntry?.recording.enabled === false ? (
    <SitesPolicyDetail world={themeId} entry={selectedEntry} />
  ) : (
    <SitesNotebookTarget
      notebookNavigation={notebookNavigationRef}
      presentationState={presentation.notebookReadings[selectedDomain] ||= {}}
      themeId={themeId}
      isRuntimeActive={isRuntimeActive && workspaceMode === 'notebook' && selectedDomain !== null && !globalCapOpen}
      t={t}
      intel={selectedIntel}
      targetPanelViewModel={targetPanelState.viewModel}
      targetPanelError={targetPanelState.error}
      detailStatus={siteDetailStatus}
      detailError={siteDetailError}
      usageEntry={siteRegistry.byDomain[selectedDomain] || null}
      averageWindow={siteRegistry.averageWindow}
      siteCapControl={null}
      labels={labels.targetRegistry}
      siteIntels={siteIntels}
      onRetry={retrySiteDetail}
      onExclude={handleExcludeTrackedWithUndo}
    />
  );

  useEffect(() => { setReleaseReview(null); setMoveReview(null); }, [selectedDomain, isRuntimeActive, currentSnapshotReady, workspaceMode, globalCapOpen]);

  useEffect(() => {
    if (pendingRelease && pendingRelease.domain !== selectedDomain && pendingRelease.phase !== 'committing') undoRelease();
  }, [pendingRelease, selectedDomain, undoRelease]);

  const handleBackToLedger = () => {
    const ownsFocus = workspaceRef.current?.contains(document.activeElement)
      || document.activeElement === document.body;
    restoreGlobalCapFocusRef.current = false;
    setGlobalCapOpen(false);
    setRegistrationRequest(null);
    setWorkspaceMode('ledger');
    requestAnimationFrame(() => {
      if (!runtimeActiveRef.current || !ownsFocus
        || (document.activeElement !== document.body && !workspaceRef.current?.contains(document.activeElement))) return;
      if (workspaceRef.current) workspaceRef.current.scrollTop = ledgerScrollRef.current;
      const row = Array.from(workspaceRef.current?.querySelectorAll('button[aria-controls="sites-site-detail"]') || []).find((button) => button.title === selectedDomain);
      if (row) row.focus({ preventScroll: true });
      else workspaceRef.current?.querySelector('.sites-unified-registry__search input')?.focus({ preventScroll: true });
    });
  };

  const isWorkspaceNavigationLocked = () => {
    const capDraft = globalCapOpen ? presentation.globalCapDraft
      : workspaceMode === 'notebook' ? presentation.capDrafts[selectedDomain] : null;
    const registrationDraft = registrationRequest
      ? presentation.registrationDrafts[registrationRequest.key] : null;
    return Boolean(registrationDraft?.pending || capDraft?.pendingOperation
      || capDraft?.savePhase === 'saving' || capDraft?.savePhase === 'success'
      || pendingRelease?.phase === 'committing');
  };
  const requestWorkspaceBack = () => {
    if (!isRuntimeActive) return false;
    if (isWorkspaceNavigationLocked()) return true;
    if (releaseReview) { setReleaseReview(null); return true; }
    if (moveReview) { setMoveReview(null); return true; }
    if (globalCapOpen) {
      if (globalCapNavigationRef.current?.back() === true) return true;
      closeGlobalCap();
      return true;
    }
    if (workspaceMode === 'notebook' && registrationRequest === null && selectedDomain !== null
      && siteCapNavigationRef.current?.domain === selectedDomain
      && siteCapNavigationRef.current.back() === true) return true;
    const management = workspaceRef.current?.querySelector('.zen-record-management[open]');
    if (management) {
      management.open = false;
      management.querySelector('summary').focus({ preventScroll: true });
      return true;
    }
    if (workspaceMode === 'notebook' && registrationRequest === null
      && currentSnapshotReady && selectedDomain !== null
      && notebookNavigationRef.current?.domain === selectedDomain
      && notebookNavigationRef.current?.back() === true) return true;
    if (workspaceMode === 'notebook') { handleBackToLedger(); return true; }
    return false;
  };
  const handleWorkspaceEscapeCapture = (event) => {
    if (themeId !== 'zen' || !isRuntimeActive || event.key !== 'Escape'
      || event.defaultPrevented || event.repeat || event.nativeEvent.isComposing) return;
    if (isWorkspaceNavigationLocked()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const handleWorkspaceEscape = (event) => {
    if (themeId !== 'zen' || !isRuntimeActive || event.key !== 'Escape'
      || event.defaultPrevented || event.repeat || event.nativeEvent.isComposing) return;
    if (requestWorkspaceBack()) event.preventDefault();
  };
  useDashboardBackHandler({
    enabled: embedded && themeId === 'zen' && isRuntimeActive,
    priority: 20,
    onBack: requestWorkspaceBack,
  });

  // Theme modules can be ready before the first canonical statistics snapshot.
  // Keep missing data explicit instead of presenting a fabricated empty average.
  if (!workspaceAdmitted && !currentSnapshotReady) {
    return sitesSnapshotStatus === 'error'
      ? <><SettingsCommandFeedbackBridge channels={SITES_FEEDBACK_CHANNELS} includeSaveFailures={false} /><SitesTabErrorState t={t} error={sitesSnapshotError} onRetry={retrySitesSnapshot} /></>
      : <SitesTabLoadingShell workspaceVariant={sitesThemePolicy.workspaceVariant} t={t} />;
  }

  return (
    <section ref={workspaceRef} id="sites-tab" onKeyDownCapture={handleWorkspaceEscapeCapture} onKeyDown={handleWorkspaceEscape} onScroll={(event) => {
      if (event.target !== workspaceRef.current || globalCapOpen || !currentSnapshotReady || (!contentReady && retainsContentFootprint)) return;
      if (workspaceMode === 'ledger') { ledgerScrollRef.current = event.currentTarget.scrollTop; presentation.ledgerScroll = event.currentTarget.scrollTop; }
      else presentation.notebookScroll[selectedDomain || 'registration'] = event.currentTarget.scrollTop;
    }} data-sites-embedded={embedded ? 'garden' : undefined} data-sites-fit={themeId === 'zen' && workspaceMode === 'notebook' ? 'notebook' : undefined} data-sites-canvas={boundedNotebook || (themeId === 'zen' && workspaceMode === 'ledger' && !globalCapOpen) ? 'bounded' : undefined} data-sites-snapshot-admission={capAdmissionStatus} data-sites-snapshot-revision={sitesSnapshotRevision} data-sites-snapshot-computed-at={sitesSnapshotComputedAt} className="flex h-full min-h-0 flex-col overflow-y-auto bg-transparent font-sans">
      {registrationJourney.snapshot === null && (
        <div className="px-6 py-3" role={registrationJourney.error ? 'alert' : 'status'} aria-busy={registrationJourney.loading}>
          <p>{registrationJourney.error ? registrationJourney.error.message : t('common:status.loading')}</p>
          {registrationJourney.error && <DashboardTabRetryAction label={t('common:dashboard.main_panel.retry')} onRetry={registrationJourney.refresh} />}
        </div>
      )}
      {themeId === 'zen' && (workspaceMode === 'ledger' || globalCapOpen) && <h1 className="sr-only">{t('workspace.ledger_title')}</h1>}
      <SitesWorkspace
        contentReady={contentReady}
        presentationKey={workspacePresentationKey}
        presentationState={presentation.workspaceLayout}
        variant={sitesThemePolicy.workspaceVariant}
        mode={workspaceMode}
        minimal={themeId === 'zen'}
        notebookSpread={notebookSpread}
        bounded={boundedNotebook || (themeId === 'zen' && workspaceMode === 'ledger' && !globalCapOpen)}
        toolbar={globalCapOpen || (themeId === 'zen' && (workspaceMode === 'ledger' || registrationRequest === null)) ? null : (
          <SitesWorkspaceHeader t={t} mode={workspaceMode} minimal={themeId === 'zen'}
            onBack={themeId === 'zen' ? requestWorkspaceBack : handleBackToLedger}
            backLabel={themeId === 'zen' ? t('workspace.ledger_title') : null} globalCap={
            themeId === 'zen' ? null : globalCap} />
        )}
        utilityOpen={globalCapOpen}
        utilityPane={themeId === 'zen' && <section ref={globalCapPaneRef} id="zen-sites-global-cap"
          className="zen-sites-global-cap" aria-labelledby="zen-sites-global-cap-heading">
          <h2 id="zen-sites-global-cap-heading">{t('zen_minimal.global_limit')}</h2>
          <p>{t('sites_cap.global_scope')}</p>
          {globalCap}
        </section>}
        notebookHeader={registrationRequest ? <SitesNotebookHeader domain={registrationRequest.domain}
          title={registrationRequest.domain || t(registrationRequest.type === 'blocked' ? 'registry.add_protected' : 'recording.add_allowed')}
          isOpen={isRuntimeActive && workspaceMode === 'notebook'} t={t} minimal={themeId === 'zen'} /> : selectedDomain && <SitesNotebookHeader domain={selectedDomain}
          domains={Array.from(new Set([selectedDomain, ...registryTargetsByScope[visibleRegistryScope]]))}
          isOpen={isRuntimeActive && workspaceMode === 'notebook'} t={t} onSelect={handleSelectDomain} minimal={themeId === 'zen'}
          onBack={themeId === 'zen' ? requestWorkspaceBack : null}
          protectionControl={<ZenSiteProtectionToggle key={selectedDomain} domain={selectedDomain} type={selectedType}
            releaseControl={releaseControl} onProtect={(domain) => handleAddWithFeedback(domain, 'blocked')} t={t} />}
          recordingControl={selectedRecordingControl}
          policyLabel={selectedPolicyLabels[selectedType]}
          siteCapControl={themeId === 'zen' ? selectedSiteCapSlot : null}
          policyFeedback={moveReview?.domain === selectedDomain && <div className="sites-inline-review">
            <p>{moveReview.message}</p>
            <button type="button" onClick={() => void handleAddWithFeedback(moveReview.domain, moveReview.toType, { moveFromType: moveReview.fromType })}>{t(moveReview.toType === 'blocked' ? 'admission.move_to_blocked' : 'admission.move_to_allowed')}</button>
            <button type="button" onClick={() => setMoveReview(null)}>{t('common:action.cancel')}</button>
          </div>} />}
        notices={notices}
        registryPane={registryPane}
        siteCap={!registrationRequest && selectedDomain && themeId !== 'zen' && <div className="sites-site-policy-header" data-policy={selectedType} data-recording={currentSnapshotReady ? selectedEntry?.recording.enabled : 'pending'}>
          {themeId !== 'zen' && currentSnapshotReady && (selectedEntry?.recording.enabled !== false ? <>
            <SitesProtectionMark world={themeId} size={36} className="sites-site-policy-header__mark" />
            <div className="sites-site-policy-header__identity"><h3>{t('workspace.protection_title')}<span>{selectedPolicyLabels[selectedType]}</span></h3><p>{t(selectedType === 'blocked' ? 'workspace.protection_active' : 'workspace.protection_optional')}</p></div>
          </> : <div className="sites-site-policy-header__identity"><h3>{t('workspace.policy_controls')}</h3><p>{t('workspace.policy_recording_off')}</p></div>)}
          {selectedSiteCapSlot}
        </div>}
        detailPane={detailPane}
      />
      {themeId === 'zen' && createPortal(selectedSiteCap, siteCapHost)}
    </section>
  );
}

export default function SitesManagementSurface({
  isActive,
  isPresented = isActive,
  isRuntimeActive = isActive,
  params,
  onTabChange,
  presentationStateRef,
  embedded = false,
}) {
  const localPresentationStateRef = useRef({});
  const resolvedPresentationStateRef = presentationStateRef || localPresentationStateRef;
  const { themeId, themeProfile } = useUIPreferences();
  const { t } = useAppTranslation('sites');
  const { t: tTabs } = useAppTranslation('filter');
  const registrationJourney = useSiteRegistrationJourney({ enabled: isRuntimeActive });
  const [managementFrameAdmitted, setManagementFrameAdmitted] = useState(false);
  useLayoutEffect(() => {
    if (registrationJourney.snapshot?.sitesManagementVisible === true) setManagementFrameAdmitted(true);
  }, [registrationJourney.snapshot]);
  const sitesThemePolicy = useMemo(
    () => resolveSitesThemePolicy(themeProfile),
    [themeProfile],
  );
  const sitesTabReadiness = useDashboardTabReadiness({
    tabId: 'sites',
    themeId,
    isActive: isRuntimeActive,
  });
  const RegistryPanel = useMemo(() => (
    sitesTabReadiness.ready ? getThemeWidget(themeId, 'SitesRegistry') : null
  ), [sitesTabReadiness.ready, sitesTabReadiness.readyKey, themeId]);

  // The Garden paper plane needs the admitted DOM while it slides closed.
  // Its parent owns inert/visibility; controller/query work is parked below.
  if (!isPresented && !embedded) return null;

  if (!managementFrameAdmitted && registrationJourney.error) {
    return <SitesTabErrorState t={t} error={registrationJourney.error} onRetry={registrationJourney.refresh} />;
  }
  if (!managementFrameAdmitted && (registrationJourney.loading || registrationJourney.snapshot?.sitesManagementVisible === false)) {
    return <SitesTabLoadingShell workspaceVariant={sitesThemePolicy.workspaceVariant} t={t} />;
  }

  if (sitesTabReadiness.phase === 'loading') {
    return <SitesTabLoadingShell workspaceVariant={sitesThemePolicy.workspaceVariant} t={t} />;
  }

  if (sitesTabReadiness.phase === 'error') {
    return (
      <SitesTabErrorState
        t={t}
        error={sitesTabReadiness.error}
        onRetry={sitesTabReadiness.retry}
      />
    );
  }

  if (!RegistryPanel) {
    const missingWidgetTypes = [
      !RegistryPanel ? 'SitesRegistry' : null,
    ].filter(Boolean);
    return (
      <SitesTabErrorState
        t={t}
        error={createSitesThemeWidgetError(themeId, missingWidgetTypes)}
      />
    );
  }

  return (
    <SitesManagementContent
      isRuntimeActive={isRuntimeActive}
      embedded={embedded}
      params={params}
      onTabChange={onTabChange}
      sitesThemePolicy={sitesThemePolicy}
      themeId={themeId}
      t={t}
      tTabs={tTabs}
      RegistryPanel={RegistryPanel}
      registrationJourney={registrationJourney}
      presentationStateRef={resolvedPresentationStateRef}
    />
  );
}
