import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  hasChromeNotifications,
  hasChromeRuntime,
  permissionsRemoveStrict,
  runtimeSendMessage,
} from '../../../../platform/chrome/ChromeService.js';
import {
  getFreshDashboardPermissionSnapshot,
  invalidateDashboardPermissionSnapshot,
  readDashboardPermissionSnapshot,
} from '../../capabilities/browserPermissionSnapshotResource.js';
import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { useDashboardProfileMutationController } from '../../security/DashboardProfileMutationController.jsx';
import {
  ensureNotificationsPermissionStrict,
  ensureOriginEnforcementPermissionsStrict,
  ensurePrecisionInsightsPermissionBundleStrict,
} from '../../../../platform/security/capabilityGate.js';
import {
  buildOriginPatternsForDomain,
  createOriginPermissionMatcher,
  getUniqueOrigins,
} from '../../../../lib/permissions.js';
import { buildSiteRuleHostCandidates } from '../../../../lib/siteIdentity.js';
import {
  hashPasscode,
  isPasscodeValid,
  verifyPasscode,
} from '../../../../platform/security/passcode.js';
import {
  useAnalysisStore,
  usePreferenceStore,
  useProtocolStore,
  useSecurityStore,
} from '../../stores/index.js';
import { useDashboardTabReadiness } from '../../loading/useDashboardTabReadiness.js';
import { useRuntimeParkedStoreSlice } from '../../hooks/useRuntimeParkedStoreSlice.js';
import {
  DashboardTabErrorSurface,
  DashboardTabLoadingSurface,
  DashboardTabRetryAction,
} from '../../loading/DashboardTabStateSurfaces.jsx';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { PermissionGate } from './components/PermissionGate.jsx';
import {
  areSettingsPermissionStatesEqual,
  EMPTY_SETTINGS_PERMISSION_STATE,
  projectSettingsPermissionState,
} from './settingsPermissionProjection.js';
import {
  preloadSettingsSecondarySectionIntent,
  scheduleSettingsSecondarySectionPreloads,
} from './settingsSectionModuleResource.js';
import SettingsSecondarySectionBoundary from './SettingsSecondarySectionBoundary.jsx';
import SettingsCommandFeedbackBridge from '../../components/SettingsCommandFeedbackBridge.jsx';
import {
  DEFAULT_DATA_COLLECTION_MODE,
  DEFAULT_PRECISION_INSIGHTS_MODE,
  normalizeDataCollectionMode,
  normalizePrecisionInsightsMode,
  normalizePrecisionInsightsSignals,
} from '../../../../domains/settings/config/dataCollectionPolicy.js';
import {
  buildLocalUsagePolicyPatch,
  localUsagePolicyRequiresPrecisionPermission,
} from '../../../../domains/settings/config/localUsagePolicy.js';
import {
  DEFAULT_NOTIFICATIONS_CONFIG,
  normalizeNotificationsConfig,
} from '../../../../domains/settings/config/notificationsConfig.js';
import { getNotificationCapabilityState } from '../../../../domains/notifications/capability/notificationCapability.js';
import SettingsShell from './layout/SettingsShell.jsx';
import { DEFAULT_SETTINGS_SECTION_ID, SETTINGS_SECTION_IDS } from './config/sections.js';
import { requireProtocolSyncSuccess } from '../../stores/protocolStoreHelpers.js';

const RESET_AUTH_FAILURE_CODES = new Set([
  'RESET_AUTH_REQUIRED',
  'RESET_AUTH_FAILED',
  'HIGH_SECURITY_PASSCODE_REQUIRED',
  'UNAUTHORIZED_RUNTIME_SENDER',
]);
const PERMISSION_REFRESH_KEY = 'permissionRefresh';
const EMPTY_ORIGINS = Object.freeze([]);

const selectSettingsProtocolSlice = (state) => ({
  insightsConsent: state.insightsConsent,
  dataCollectionMode: state.dataCollectionMode,
  precisionInsightsMode: state.precisionInsightsMode,
  precisionInsightsSignals: state.precisionInsightsSignals,
  setPrecisionInsightsPolicy: state.setPrecisionInsightsPolicy,
  trackingExcludedUrls: state.trackingExcludedUrls,
  setSiteRecordingExcluded: state.setSiteRecordingExcluded,
  notificationsConfig: state.notificationsConfig,
  setNotificationsConfig: state.setNotificationsConfig,
  solarLocationProfile: state.solarLocationProfile,
  setSolarLocationProfile: state.setSolarLocationProfile,
  blockedUrls: state.blockedUrls,
  allowedUrls: state.allowedUrls,
});

const selectSettingsSecuritySlice = (state) => ({
  clearMasterPasscodeHash: state.clearMasterPasscodeHash,
  highSecurityMode: state.highSecurityMode,
  masterPasscodeHash: state.masterPasscodeHash,
  refreshSecuritySettings: state.refreshSecuritySettings,
  requirePasscodeForReset: state.requirePasscodeForReset,
  setHighSecurityMode: state.setHighSecurityMode,
  setMasterPasscodeHash: state.setMasterPasscodeHash,
  setRequirePasscodeForReset: state.setRequirePasscodeForReset,
});

function createSettingsNotificationCapabilityPort() {
  return {
    notificationsCanCreate: hasChromeNotifications,
    runtimeCanGetURL: hasChromeRuntime,
  };
}

function resolveSettingsNotificationCapability(browserPort) {
  try {
    return getNotificationCapabilityState({ browserPort });
  } catch (error) {
    return {
      ready: false,
      code: describeSettingsActionError(error, 'SETTINGS_NOTIFICATION_CAPABILITY_INVALID'),
    };
  }
}

function isNotificationCapabilityOwnerError(capability) {
  return typeof capability?.code === 'string'
    && capability.code.startsWith('NOTIFICATION_CAPABILITY_');
}

function getRuntimeWarningCodes(source) {
  return Array.isArray(source?.warnings)
    ? source.warnings
      .map((warning) => (typeof warning?.code === 'string' ? warning.code.trim() : ''))
      .filter(Boolean)
    : [];
}

function appendRuntimeWarningCodes(message, ...sources) {
  const codes = sources.flatMap((source) => getRuntimeWarningCodes(source));
  return codes.length > 0 ? `${message} ${codes.join(' ')}` : message;
}

function describeSettingsActionError(error, fallbackCode) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  const message = String(error || '').trim();
  return message || fallbackCode;
}

function SettingsTabReadyContent({ tab, params, isRuntimeActive, onTabChange, t }) {
  const profileMutation = useDashboardProfileMutationController();
  const {
    insightsConsent,
    dataCollectionMode,
    precisionInsightsMode,
    precisionInsightsSignals,
    setPrecisionInsightsPolicy,
    trackingExcludedUrls,
    setSiteRecordingExcluded,
    notificationsConfig,
    setNotificationsConfig,
    solarLocationProfile,
    setSolarLocationProfile,
    blockedUrls,
    allowedUrls,
  } = useRuntimeParkedStoreSlice(
    useProtocolStore,
    selectSettingsProtocolSlice,
    isRuntimeActive,
  );
  const {
    clearMasterPasscodeHash,
    highSecurityMode,
    masterPasscodeHash,
    refreshSecuritySettings,
    requirePasscodeForReset: requireResetPasscode,
    setHighSecurityMode,
    setMasterPasscodeHash,
    setRequirePasscodeForReset,
  } = useRuntimeParkedStoreSlice(
    useSecurityStore,
    selectSettingsSecuritySlice,
    isRuntimeActive,
  );
  const [activeSectionId, setActiveSectionId] = useState(DEFAULT_SETTINGS_SECTION_ID);
  const lastNavigationIntentRef = useRef(null);
  const [excludedSitesRevealRequest, setExcludedSitesRevealRequest] = useState(null);
  const handleSectionChange = useCallback((sectionId) => {
    setExcludedSitesRevealRequest(null);
    setActiveSectionId(sectionId);
  }, []);
  useEffect(() => {
    if (!isRuntimeActive || !params || params === lastNavigationIntentRef.current) return;
    if (!Object.values(SETTINGS_SECTION_IDS).includes(params.section)) return;
    lastNavigationIntentRef.current = params;
    setActiveSectionId(params.section);
    if (params.section === SETTINGS_SECTION_IDS.PERMISSIONS && params.focus === 'recording-exclusions') {
      setExcludedSitesRevealRequest(params);
    }
  }, [isRuntimeActive, params]);
  const [permissionState, setPermissionState] = useState(() => {
    const freshSnapshot = isRuntimeActive
      ? getFreshDashboardPermissionSnapshot()
      : null;
    return freshSnapshot
      ? projectSettingsPermissionState(freshSnapshot, blockedUrls)
      : EMPTY_SETTINGS_PERMISSION_STATE;
  });
  const [permissionStatus, setPermissionStatus] = useState('');
  const [usagePolicyBusy, setUsagePolicyBusy] = useState(false);
  const usagePolicyBusyRef = useRef(false);
  const [notificationsStatus, setNotificationsStatus] = useState('');
  const [solarLocationStatus, setSolarLocationStatus] = useState('');
  const [securityStatus, setSecurityStatus] = useState('');

  const [dataStatus, setDataStatus] = useState('');
  const [dataStatusTone, setDataStatusTone] = useState('neutral');
  const [pendingDangerAction, setPendingDangerAction] = useState(null);
  const [dataActionBusy, setDataActionBusy] = useState(false);
  const permissionCommitOwnerRef = useRef({
    blockedUrls,
    generation: 0,
    isRuntimeActive,
  });
  if (
    permissionCommitOwnerRef.current.blockedUrls !== blockedUrls
    || permissionCommitOwnerRef.current.isRuntimeActive !== isRuntimeActive
  ) {
    permissionCommitOwnerRef.current = {
      blockedUrls,
      generation: permissionCommitOwnerRef.current.generation + 1,
      isRuntimeActive,
    };
  }

  const hasPasscode = !!masterPasscodeHash;
  const managedDomains = useMemo(() => ([...new Set([
    ...(Array.isArray(blockedUrls) ? blockedUrls : []),
    ...(Array.isArray(allowedUrls) ? allowedUrls : []),
  ])]), [allowedUrls, blockedUrls]);
  const originPermissionMatcher = useMemo(
    () => createOriginPermissionMatcher(permissionState.origins),
    [permissionState.origins],
  );
  const missingManagedSiteAccess = useMemo(() => {
    if (!managedDomains.length) {
      return { origins: EMPTY_ORIGINS, siteCount: 0 };
    }
    const missingOrigins = [];
    let siteCount = 0;
    managedDomains.forEach((domain) => {
      let siteNeedsAccess = false;
      buildSiteRuleHostCandidates(domain).forEach((candidate) => {
        if (originPermissionMatcher.hasDomain(candidate)) return;
        siteNeedsAccess = true;
        missingOrigins.push(...buildOriginPatternsForDomain(candidate));
      });
      if (siteNeedsAccess) siteCount += 1;
    });
    return {
      origins: getUniqueOrigins(missingOrigins),
      siteCount,
    };
  }, [managedDomains, originPermissionMatcher]);
  const resolvedDataCollectionMode = normalizeDataCollectionMode(
    dataCollectionMode,
    DEFAULT_DATA_COLLECTION_MODE,
  );
  const resolvedPrecisionInsightsMode = normalizePrecisionInsightsMode(
    precisionInsightsMode,
    DEFAULT_PRECISION_INSIGHTS_MODE,
  );
  const precisionInsightsReady = permissionState.behavior;
  const resolvedPrecisionInsightsSignals = normalizePrecisionInsightsSignals(precisionInsightsSignals);
  const permissionsCoverageReady = missingManagedSiteAccess.siteCount === 0;
  const resolvedNotificationsConfig = useMemo(
    () => normalizeNotificationsConfig(notificationsConfig, {
      defaults: DEFAULT_NOTIFICATIONS_CONFIG,
    }),
    [notificationsConfig],
  );
  const notificationCapabilityPort = useMemo(createSettingsNotificationCapabilityPort, []);
  const notificationCapability = useMemo(() => (
    resolveSettingsNotificationCapability(notificationCapabilityPort)
  ), [notificationCapabilityPort]);
  const notificationsPermissionGranted = permissionState.notifications === true;
  const displayNotificationsConfig = useMemo(() => ({
    ...resolvedNotificationsConfig,
    enabled: resolvedNotificationsConfig.enabled && notificationsPermissionGranted,
  }), [notificationsPermissionGranted, resolvedNotificationsConfig]);
  const notificationCapabilityOwnerError = isNotificationCapabilityOwnerError(notificationCapability);
  const notificationsCapabilityReady = notificationCapabilityOwnerError
    ? false
    : (notificationsPermissionGranted
      ? notificationCapability.ready
      : true);
  const notificationsCapabilityMessage = notificationsCapabilityReady
    ? ''
    : (notificationCapabilityOwnerError
      ? notificationCapability.code
      : t('settings_workspace.notifications.capability_unavailable'));
  const effectiveNotificationsStatus = notificationsStatus || (!notificationsCapabilityReady
    ? (notificationCapabilityOwnerError
      ? notificationCapability.code
      : t('status.notifications_unavailable'))
    : '');

  const permissionTypeLabel = useCallback((type) => (
    t(`permissions.types.${type}`, { })
  ), [t]);

  const refreshPermissionState = useCallback(async ({ force = false } = {}) => {
    const requestGeneration = permissionCommitOwnerRef.current.generation + 1;
    permissionCommitOwnerRef.current.generation = requestGeneration;
    const granted = await readDashboardPermissionSnapshot({ force, tabId: 'settings' });
    const nextPermissionState = projectSettingsPermissionState(granted, blockedUrls);
    if (
      permissionCommitOwnerRef.current.isRuntimeActive
      && permissionCommitOwnerRef.current.generation === requestGeneration
    ) {
      setPermissionState((currentPermissionState) => (
        areSettingsPermissionStatesEqual(currentPermissionState, nextPermissionState)
          ? currentPermissionState
          : nextPermissionState
      ));
    }
    return nextPermissionState;
  }, [blockedUrls]);

  const refreshPermissionStateAfterMutation = useCallback(async () => {
    invalidateDashboardPermissionSnapshot();
    return refreshPermissionState({ force: true });
  }, [refreshPermissionState]);

  const notifySettingsChangedToBackground = useCallback(async (keys = []) => {
    const payload = { action: MESSAGE_ACTIONS.SETTINGS_CHANGED };
    if (Array.isArray(keys) && keys.length > 0) {
      payload.keys = keys;
    }
    const response = await runtimeSendMessage(payload);
    if (!response?.success) {
      const code = String(response?.error || 'SETTINGS_PROPAGATION_FAILED');
      const error = new Error(code);
      error.code = code;
      if (response?.propagation && typeof response.propagation === 'object') {
        error.propagation = response.propagation;
      }
      throw error;
    }
    return response;
  }, []);

  useEffect(() => {
    if (!isRuntimeActive) return;
    let cancelled = false;
    refreshPermissionState().catch((error) => {
      if (cancelled) return;
      setPermissionStatus(describeSettingsActionError(error, 'SETTINGS_PERMISSION_REFRESH_FAILED'));
    });
    return () => {
      cancelled = true;
    };
  }, [isRuntimeActive, refreshPermissionState]);

  useEffect(() => {
    if (!isRuntimeActive || activeSectionId !== SETTINGS_SECTION_IDS.SAFETY) return;
    refreshSecuritySettings().catch((error) => {
      setSecurityStatus(describeSettingsActionError(error, 'SECURITY_SETTINGS_REFRESH_FAILED'));
    });
  }, [activeSectionId, isRuntimeActive, refreshSecuritySettings]);

  useEffect(() => {
    if (!isRuntimeActive) {
      setPendingDangerAction(null);
    }
  }, [isRuntimeActive]);

  useEffect(() => {
    if (!isRuntimeActive) return undefined;
    return scheduleSettingsSecondarySectionPreloads();
  }, [isRuntimeActive]);

  const handleUsagePolicyChange = useCallback(async (selection) => {
    if (usagePolicyBusyRef.current) return;
    usagePolicyBusyRef.current = true;
    setUsagePolicyBusy(true);
    setPermissionStatus('');
    try {
      const patch = buildLocalUsagePolicyPatch(selection);
      if (localUsagePolicyRequiresPrecisionPermission(patch)) {
        const granted = await ensurePrecisionInsightsPermissionBundleStrict();
        await refreshPermissionStateAfterMutation();
        if (!granted) {
          setPermissionStatus(t('recording.permission_denied'));
          return;
        }
      }
      requireProtocolSyncSuccess(await setPrecisionInsightsPolicy(patch));
      setPermissionStatus('');
      await notifySettingsChangedToBackground([PERMISSION_REFRESH_KEY]);
    } catch (error) {
      setPermissionStatus(describeSettingsActionError(error, 'SETTINGS_USAGE_POLICY_SAVE_FAILED'));
    } finally {
      usagePolicyBusyRef.current = false;
      setUsagePolicyBusy(false);
    }
  }, [
    notifySettingsChangedToBackground,
    refreshPermissionStateAfterMutation, setPrecisionInsightsPolicy, t,
  ]);

  const handleRestoreTrackedDomain = useCallback(async (domain) => {
    requireProtocolSyncSuccess(await setSiteRecordingExcluded({ domain, excluded: false }));
    return true;
  }, [setSiteRecordingExcluded]);

  const grantManagedSiteAccess = useCallback(async () => {
    if (!managedDomains.length) return;
    try {
      const granted = await ensureOriginEnforcementPermissionsStrict(
        missingManagedSiteAccess.origins,
      );
      setPermissionStatus(granted ? '' : t('status.denied', { type: permissionTypeLabel('host') }));
      await refreshPermissionStateAfterMutation();
      await notifySettingsChangedToBackground([PERMISSION_REFRESH_KEY]);
    } catch (error) {
      setPermissionStatus(describeSettingsActionError(error, 'SETTINGS_HOST_PERMISSION_GRANT_FAILED'));
    }
  }, [
    managedDomains.length,
    missingManagedSiteAccess.origins,
    notifySettingsChangedToBackground,
    permissionTypeLabel,
    refreshPermissionStateAfterMutation,
    t,
  ]);

  const updateNotificationsConfig = useCallback(async (nextConfig) => {
    requireProtocolSyncSuccess(await setNotificationsConfig(nextConfig));
    setNotificationsStatus('');
  }, [setNotificationsConfig]);

  const ensureNotificationsReadyForEnable = useCallback(async () => {
    const granted = await ensureNotificationsPermissionStrict();
    await refreshPermissionStateAfterMutation();
    if (!granted) {
      setNotificationsStatus(t('status.denied', { type: permissionTypeLabel('notifications') }));
      return false;
    }
    const capability = resolveSettingsNotificationCapability(notificationCapabilityPort);
    if (!capability.ready) {
      setNotificationsStatus(isNotificationCapabilityOwnerError(capability)
        ? capability.code
        : t('status.notifications_unavailable'));
      return false;
    }
    return true;
  }, [notificationCapabilityPort, permissionTypeLabel, refreshPermissionStateAfterMutation, t]);

  const handleNotificationsEnabledToggle = useCallback(async (nextEnabled) => {
    try {
      if (nextEnabled) {
        const ready = await ensureNotificationsReadyForEnable();
        if (!ready) return;
      } else {
        await permissionsRemoveStrict({ permissions: ['notifications'] });
        await refreshPermissionStateAfterMutation();
      }
      await updateNotificationsConfig({
        enabled: !!nextEnabled,
        sessionStart: { enabled: !!nextEnabled },
        sessionEnd: { enabled: !!nextEnabled },
        journey: { enabled: !!nextEnabled },
      });
    } catch (error) {
      setNotificationsStatus(describeSettingsActionError(error, 'SETTINGS_NOTIFICATIONS_SAVE_FAILED'));
    }
  }, [ensureNotificationsReadyForEnable, refreshPermissionStateAfterMutation, updateNotificationsConfig]);

  const handleSolarLocationSave = useCallback(async (nextProfile) => {
    try {
      requireProtocolSyncSuccess(await setSolarLocationProfile(nextProfile));
      setSolarLocationStatus('');
      return true;
    } catch (error) {
      setSolarLocationStatus(describeSettingsActionError(
        error,
        'SETTINGS_SOLAR_LOCATION_SAVE_FAILED',
      ));
      return false;
    }
  }, [setSolarLocationProfile]);

  const verifyMasterPasscode = useCallback(async (passcodeInput) => (
    verifyPasscode(passcodeInput, masterPasscodeHash)
  ), [masterPasscodeHash]);

  const handleSavePasscode = useCallback(async (current, next, confirm) => {
    const nextStr = String(next || '').trim();
    if (!isPasscodeValid(nextStr)) {
      setSecurityStatus(t('status.passcode_valid'));
      return false;
    }
    if (nextStr !== confirm) {
      setSecurityStatus(t('status.passcode_mismatch'));
      return false;
    }

    if (hasPasscode) {
      const ok = await verifyMasterPasscode(current);
      if (!ok) {
        setSecurityStatus(t('status.passcode_incorrect'));
        return false;
      }
    }

    const nextHash = await hashPasscode(nextStr);
    try {
      await setMasterPasscodeHash(nextHash, hasPasscode ? { kind: 'passcode', passcode: current } : null);
      setSecurityStatus('');
      return true;
    } catch (error) {
      setSecurityStatus(describeSettingsActionError(error, 'SECURITY_SETTINGS_PASSCODE_SAVE_FAILED'));
      return false;
    }
  }, [hasPasscode, setMasterPasscodeHash, t, verifyMasterPasscode]);

  const handleRemovePasscode = useCallback(async (current) => {
    if (!hasPasscode) return false;
    if (highSecurityMode) {
      setSecurityStatus(t('status.high_security_disable_before_passcode_remove'));
      return false;
    }
    const ok = await verifyMasterPasscode(current);
    if (!ok) {
      setSecurityStatus(t('status.passcode_incorrect'));
      return false;
    }
    try {
      await clearMasterPasscodeHash({ kind: 'passcode', passcode: current });
      setSecurityStatus('');
      return true;
    } catch (error) {
      setSecurityStatus(describeSettingsActionError(error, 'SECURITY_SETTINGS_PASSCODE_REMOVE_FAILED'));
      return false;
    }
  }, [clearMasterPasscodeHash, hasPasscode, highSecurityMode, t, verifyMasterPasscode]);

  const handleResetGuardToggle = useCallback(async (next, current = '') => {
    try {
      await setRequirePasscodeForReset(!!next, !next ? { kind: 'passcode', passcode: current } : null);
      setSecurityStatus('');
      return true;
    } catch (error) {
      setSecurityStatus(describeSettingsActionError(error, 'SECURITY_SETTINGS_RESET_GUARD_SAVE_FAILED'));
      return false;
    }
  }, [setRequirePasscodeForReset, t]);

  const handleHighSecurityModeToggle = useCallback(async (next, current = '') => {
    const enabled = next === true;
    if (enabled && !hasPasscode) {
      setSecurityStatus(t('status.high_security_requires_passcode'));
      return;
    }
    try {
      if (enabled && !requireResetPasscode) {
        await setRequirePasscodeForReset(true);
      }
      await setHighSecurityMode(enabled, !enabled ? { kind: 'passcode', passcode: current } : null);
      setSecurityStatus('');
      return true;
    } catch (error) {
      setSecurityStatus(describeSettingsActionError(error, 'SECURITY_SETTINGS_HIGH_SECURITY_SAVE_FAILED'));
      return false;
    }
  }, [hasPasscode, requireResetPasscode, setHighSecurityMode, setRequirePasscodeForReset, t]);

  const refreshClientStateAfterDataMutation = useCallback(async (action) => {
    if (action === MESSAGE_ACTIONS.RESET_ANALYTICS_DATA) {
      useAnalysisStore.setState({ loaded: false });
      await useAnalysisStore.getState().initialize();
      return;
    }
  }, []);

  const confirmDangerAction = useCallback(async (passcodeInput = '') => {
    if (!pendingDangerAction || dataActionBusy) return;
    const nextAction = pendingDangerAction;

    setDataActionBusy(true);
    setDataStatus('');
    setDataStatusTone('neutral');
    let mutationSucceeded = false;
    try {
      if (nextAction.action === MESSAGE_ACTIONS.RESET_APP_DATA) {
        await profileMutation.reset({ authorization: { kind: 'passcode', passcode: String(passcodeInput || '') } });
        setPendingDangerAction(null);
        return;
      }
      const response = await runtimeSendMessage({
        action: nextAction.action,
        authorization: {
          kind: 'passcode',
          passcode: String(passcodeInput || ''),
        },
      });
      if (response?.success) {
        mutationSucceeded = true;
        setPendingDangerAction(null);
        setDataStatus(appendRuntimeWarningCodes(t('status.reset_complete'), response));
        setDataStatusTone(getRuntimeWarningCodes(response).length > 0 ? 'warning' : 'neutral');
        await refreshPermissionState();
        await refreshSecuritySettings();
        await refreshClientStateAfterDataMutation(nextAction.action);
      } else {
        const errorCode = String(response?.error || '');
        if (RESET_AUTH_FAILURE_CODES.has(errorCode)) {
          setDataStatus(t('status.auth_failed'));
        } else {
          setDataStatus(response?.error || t('status.reset_failed'));
        }
        setDataStatusTone('danger');
      }
    } catch (error) {
      const code = describeSettingsActionError(error, 'SETTINGS_DATA_ACTION_FAILED');
      setDataStatus(mutationSucceeded
        ? `${t('status.reset_complete')} ${code}`
        : RESET_AUTH_FAILURE_CODES.has(code) ? t('status.auth_failed') : code);
      setDataStatusTone('danger');
    } finally {
      setDataActionBusy(false);
    }
  }, [
    dataActionBusy,
    pendingDangerAction,
    profileMutation,
    refreshClientStateAfterDataMutation,
    refreshPermissionState,
    refreshSecuritySettings,
    t,
  ]);

  const requestResetAction = useCallback((action) => {
    if (dataActionBusy || pendingDangerAction) return;
    const isFactoryReset = action === MESSAGE_ACTIONS.RESET_APP_DATA;
    setDataStatus('');
    setDataStatusTone('neutral');
    setPendingDangerAction({
      action,
      title: isFactoryReset
        ? t('data.factory_reset_dialog_title')
        : t('data.analytics_dialog_title'),
      message: isFactoryReset ? t('confirm.factory_reset') : t('confirm.clear_history'),
      confirmLabel: isFactoryReset ? t('data.reset_everything') : t('data.clear_history'),
    });
  }, [dataActionBusy, pendingDangerAction, t]);

  const cancelDangerAction = useCallback(() => {
    setDataStatus('');
    setDataStatusTone('neutral');
    setPendingDangerAction(null);
  }, []);

  const permissionAttention = useMemo(() => {
    let count = 0;
    if (managedDomains.length > 0 && !permissionState.scripting) count += 1;
    if (!permissionsCoverageReady) count += 1;
    return count;
  }, [managedDomains.length, permissionState.scripting, permissionsCoverageReady]);

  const settingsSections = useMemo(() => [
    { id: SETTINGS_SECTION_IDS.WORKSPACE, label: t('sections.workspace.title'), badge: '' },
    { id: SETTINGS_SECTION_IDS.PROTECTION, label: t('sections.protection.title'), badge: '' },
    {
      id: SETTINGS_SECTION_IDS.PERMISSIONS,
      label: t('sections.permissions.title'),
      badge: permissionAttention > 0 ? t('sections.badges.attention') : '',
    },
    {
      id: SETTINGS_SECTION_IDS.SAFETY,
      label: t('sections.safety.title'),
      badge: (requireResetPasscode || highSecurityMode) && !hasPasscode
        ? t('sections.badges.passcode_needed') : '',
    },
  ], [hasPasscode, highSecurityMode, permissionAttention, requireResetPasscode, t]);

  const destructiveActionRequiresPasscode = (requireResetPasscode || highSecurityMode) && hasPasscode;

  useEffect(() => {
    if (settingsSections.some((section) => section.id === activeSectionId)) return;
    setActiveSectionId(DEFAULT_SETTINGS_SECTION_ID);
  }, [activeSectionId, settingsSections]);

  const handleSectionIntent = useCallback((sectionId) => {
    if (!isRuntimeActive) return;
    preloadSettingsSecondarySectionIntent(sectionId);
  }, [isRuntimeActive]);

  return (
    <section id={tab?.id || 'settings'} className="flex h-full min-h-0 flex-col bg-background font-sans text-on-surface">
      <SettingsCommandFeedbackBridge />
      <SettingsShell
        eyebrowLabel={t('header.title')}
        sections={settingsSections}
        activeSectionId={activeSectionId || DEFAULT_SETTINGS_SECTION_ID}
        onSectionChange={handleSectionChange}
        onSectionIntent={handleSectionIntent}
      >
        {activeSectionId === SETTINGS_SECTION_IDS.PROTECTION ? (
          <SettingsSecondarySectionBoundary
            key={SETTINGS_SECTION_IDS.PROTECTION}
            sectionId={SETTINGS_SECTION_IDS.PROTECTION}
            t={t}
            sectionProps={{ isRuntimeActive, onNavigate: onTabChange,
              onOpenRecording: () => handleSectionChange(SETTINGS_SECTION_IDS.PERMISSIONS) }}
          />
        ) : null}

        {activeSectionId === SETTINGS_SECTION_IDS.PERMISSIONS ? (
          <PermissionGate
            permissionState={permissionState}
            dataCollectionMode={resolvedDataCollectionMode}
            precisionInsightsMode={resolvedPrecisionInsightsMode}
            precisionInsightsSignals={resolvedPrecisionInsightsSignals}
            insightsConsent={insightsConsent}
            precisionInsightsReady={precisionInsightsReady}
            trackingExcludedUrls={trackingExcludedUrls}
            onUsagePolicyChange={handleUsagePolicyChange}
            onRestoreTrackedDomain={handleRestoreTrackedDomain}
            excludedSitesRevealRequest={excludedSitesRevealRequest}
            onGrantManagedSiteAccess={grantManagedSiteAccess}
            managedSiteCount={managedDomains.length}
            missingSiteCount={missingManagedSiteAccess.siteCount}
            busy={usagePolicyBusy}
            statusMessage={permissionStatus}
          />
        ) : null}

        {activeSectionId === SETTINGS_SECTION_IDS.SAFETY ? (
          <SettingsSecondarySectionBoundary
            key={SETTINGS_SECTION_IDS.SAFETY}
            sectionId={SETTINGS_SECTION_IDS.SAFETY}
            t={t}
            sectionProps={{
              actionBusy: dataActionBusy,
              isRuntimeActive,
              dataResultMessage: dataStatus,
              dataResultTone: dataStatusTone,
              hasPasscode,
              highSecurityMode,
              onDangerCancel: cancelDangerAction,
              onDangerConfirm: confirmDangerAction,
              onRemovePasscode: handleRemovePasscode,
              onResetAnalytics: () => requestResetAction(MESSAGE_ACTIONS.RESET_ANALYTICS_DATA),
              onResetEverything: () => requestResetAction(MESSAGE_ACTIONS.RESET_APP_DATA),
              onSavePasscode: handleSavePasscode,
              onToggleHighSecurityMode: handleHighSecurityModeToggle,
              onToggleResetGuard: handleResetGuardToggle,
              pendingDangerAction,
              requirePasscode: destructiveActionRequiresPasscode,
              requireResetPasscode,
              securityStatusMessage: securityStatus,
            }}
          />
        ) : null}

        {activeSectionId === SETTINGS_SECTION_IDS.WORKSPACE ? (
          <SettingsSecondarySectionBoundary
            key={SETTINGS_SECTION_IDS.WORKSPACE}
            sectionId={SETTINGS_SECTION_IDS.WORKSPACE}
            t={t}
            sectionProps={{
              capabilityMessage: notificationsCapabilityMessage,
              isRuntimeActive,
              capabilityReady: notificationsCapabilityReady,
              notificationsConfig: displayNotificationsConfig,
              notificationsStatusMessage: effectiveNotificationsStatus,
              onSaveSolarLocation: handleSolarLocationSave,
              onToggleNotificationsEnabled: handleNotificationsEnabledToggle,
              solarLocationProfile,
              solarStatusMessage: solarLocationStatus,
              t,
            }}
          />
        ) : null}

      </SettingsShell>
    </section>
  );
}

export default function SettingsTab({
  tab,
  onTabChange,
  params = null,
  isActive,
  isPresented = isActive,
  isRuntimeActive = isActive,
}) {
  const { t } = useAppTranslation('settings');
  const themeId = usePreferenceStore((state) => state.themeId);
  const settingsTabReadiness = useDashboardTabReadiness({
    tabId: 'settings',
    themeId,
    isActive: isRuntimeActive,
  });

  if (!isPresented) {
    return (
      <section id={tab?.id || 'settings'} className="hidden h-full min-h-0 flex-col bg-background font-sans" />
    );
  }

  if (settingsTabReadiness.phase === 'loading') {
    return (
      <DashboardTabLoadingSurface
        tabId={tab?.id || 'settings'}
        label={t('status.loading')}
        sectionClassName="bg-background"
      />
    );
  }

  if (settingsTabReadiness.phase === 'error') {
    return (
      <DashboardTabErrorSurface
        tabId={tab?.id || 'settings'}
        title={t('status.error')}
        detail={settingsTabReadiness.error?.message}
        sectionClassName="bg-background"
        actions={settingsTabReadiness.retry ? (
          <DashboardTabRetryAction
            label={t('common:dashboard.main_panel.retry')}
            onRetry={settingsTabReadiness.retry}
          />
        ) : null}
      />
    );
  }

  return (
    <SettingsTabReadyContent
      tab={tab}
      params={params}
      isRuntimeActive={isRuntimeActive}
      onTabChange={onTabChange}
      t={t}
    />
  );
}
