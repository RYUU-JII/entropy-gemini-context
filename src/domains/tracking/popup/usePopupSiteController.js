import { useEffect, useRef, useState } from 'react';

import { getHostname } from '../../../lib/url.js';
import {
  runtimeGetURL,
  runtimeSendMessage,
  runtimeSendMessageReliable,
  tabsQuery,
  tabsCreate,
} from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import {
  ensureDomainEnforcementPermissionStrict,
} from '../../../platform/security/capabilityGate.js';
import { normalizeDomain } from '../../../lib/domain.js';
import { buildSiteRegistrationPath } from '../../../lib/firstSiteRegistrationIntent.js';
import { requireSiteRegistrationRejectionDetails } from '../../progression/contracts/siteRegistrationRejection.js';
import {
  buildEmptyPopupSiteSnapshot,
  normalizePopupSiteSnapshot,
} from './contracts/popupSiteSnapshot.js';
import { createPopupSiteSnapshotRefresh } from './popupSiteSnapshotRefresh.js';
import { usePopupMediaSupport } from './usePopupMediaSupport.js';
import {
  resolvePopupDisplayDomain,
  buildPopupDashboardPath,
  resolvePopupGoalControlState,
  resolvePopupStatusMeta,
} from '../../../lib/popup/popupPresentation.js';
import {
  addSpecialSessionTemporaryAllowedSite,
  endSpecialSession,
  startSpecialSession,
} from '../../protection/client/specialSessionClient.js';
import { useAppliedScheduleRuntime } from '../../schedule/client/useAppliedScheduleRuntime.js';
import { endScheduleOccurrence } from '../../schedule/client/scheduleRuntimeClient.js';
import {
  SPECIAL_SESSION_MODES,
  normalizeSpecialSessionState,
} from '../../settings/config/specialSession.js';

const EMPTY_POPUP_SITE_SNAPSHOT = buildEmptyPopupSiteSnapshot();
function resolveManagedSiteCount(snapshot) {
  return Math.max(0, Math.floor(Number(snapshot?.access?.managedSiteCount || 0)));
}

function buildPermissionPromptState({ domain }) { return { domain }; }

function getPopupActionErrorDetail(error, fallback = 'POPUP_ACTION_FAILED') {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  if (typeof error?.error === 'string' && error.error.trim()) return error.error.trim();
  return fallback;
}

function formatPopupActionFailure(t, key, error, fallback) {
  const baseMessage = t(key);
  const detail = getPopupActionErrorDetail(error, fallback);
  const normalizedBase = typeof baseMessage === 'string'
    ? baseMessage.trim().replace(/[.!?]\s*$/, '')
    : String(baseMessage || key);
  return detail ? `${normalizedBase}: ${detail}` : normalizedBase;
}

export function usePopupSiteController({ t }) {
  const [pageUrl, setPageUrl] = useState('');
  const [mediaTabId, setMediaTabId] = useState(null);
  const mediaSupport = usePopupMediaSupport({ tabId: mediaTabId });
  const [hostname, setHostname] = useState('');
  const [snapshot, setSnapshot] = useState(EMPTY_POPUP_SITE_SNAPSHOT);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const scheduleRuntime = useAppliedScheduleRuntime();
  const specialSession = scheduleRuntime.state
    ? { ...scheduleRuntime.state.isolationSession, source: scheduleRuntime.state.source }
    : normalizeSpecialSessionState(null);
  const [specialSessionAction, setSpecialSessionAction] = useState('idle');
  const [isolationPickerOpen, setIsolationPickerOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messageCode, setMessageCode] = useState('idle');
  const [snapshotError, setSnapshotError] = useState('');
  const [permissionPromptState, setPermissionPromptState] = useState(null);
  const pendingPermissionDomainRef = useRef('');
  const snapshotRefreshRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let refreshOwner = null;

    const init = async () => {
      try {
        const [tab] = await tabsQuery({ active: true, currentWindow: true });
        const nextPageUrl = typeof tab?.url === 'string' ? tab.url : '';
        const nextHostname = nextPageUrl ? getHostname(nextPageUrl) : '';
        if (!mounted) return;

        setPageUrl(nextPageUrl);
        setHostname(nextHostname);
        setMediaTabId(/^https?:\/\//i.test(nextPageUrl) && Number.isInteger(tab?.id) ? tab.id : null);

        if (!nextHostname) {
          const nextSnapshot = normalizePopupSiteSnapshot(null);
          setSnapshot(nextSnapshot);
          setIsReady(true);
          setMessage(t('popup.messages.page_unavailable'));
          setMessageCode('page_unavailable');
          return;
        }

        refreshOwner = createPopupSiteSnapshotRefresh({
          readSnapshot: async () => {
            const delivery = await runtimeSendMessageReliable({
              action: MESSAGE_ACTIONS.GET_POPUP_SITE_SNAPSHOT,
              pageUrl: nextPageUrl,
              hostname: nextHostname,
            }, { timeoutMs: 8000 });
            if (!delivery.ok || !delivery.response?.success || !delivery.response?.snapshot) {
              throw new Error(delivery.response?.error || delivery.error || 'POPUP_SITE_SNAPSHOT_FAILED');
            }
            return normalizePopupSiteSnapshot(delivery.response.snapshot);
          },
          onSnapshot: (nextSnapshot) => {
            if (!mounted) return;
            setSnapshot(nextSnapshot);
            setSnapshotError('');
            setIsReady(true);
            if (!nextSnapshot.site.supported) {
              setMessage(t('popup.messages.page_unavailable'));
              setMessageCode('page_unavailable');
            }
          },
          onError: () => {
            if (!mounted) return;
            setIsReady(true);
            setSnapshotError(t('popup.messages.load_error'));
          },
        });
        snapshotRefreshRef.current = refreshOwner;
      } catch (_) {
        if (!mounted) return;
        setIsReady(true);
        setSnapshotError(t('popup.messages.load_error'));
      }
    };

    init();

    return () => {
      mounted = false;
      refreshOwner?.dispose();
      if (snapshotRefreshRef.current === refreshOwner) snapshotRefreshRef.current = null;
    };
  }, [t]);

  useEffect(() => () => {
    const pendingDomain = normalizeDomain(pendingPermissionDomainRef.current);
    if (!pendingDomain) return;
    void runtimeSendMessage({
      action: MESSAGE_ACTIONS.POPUP_CANCEL_BLOCK_DOMAIN,
      domain: pendingDomain,
    });
  }, []);

  const siteDomain = snapshot.site.hostname || hostname;
  const resolvedPageUrl = snapshot.site.pageUrl || pageUrl;

  const todayMs = snapshot.metrics.todayMs || 0;
  const weeklyAverageDailyMs = snapshot.metrics.weeklyAverageDailyMs || 0;
  const shareOfTracked = snapshot.metrics.shareOfTracked || 0;
  const statusMeta = resolvePopupStatusMeta({ snapshot, t });
  const displayDomain = resolvePopupDisplayDomain({ snapshot, hostname, isReady, t });
  const normalizedSiteDomain = normalizeDomain(siteDomain);
  const dashboardHref = runtimeGetURL(buildPopupDashboardPath());
  const registrationHref = runtimeGetURL(buildSiteRegistrationPath({
    domain: normalizedSiteDomain,
  }));
  const sitesHref = snapshot.access.sitesManagementVisible && normalizedSiteDomain
    ? runtimeGetURL(buildPopupDashboardPath({ domain: normalizedSiteDomain }))
    : '';
  const goalControlState = resolvePopupGoalControlState({
    snapshot,
    isSaving,
    messageCode,
    t,
  });
  const isSupported = snapshot.site.supported;
  const isSpecialSessionSaving = !scheduleRuntime.state || Boolean(scheduleRuntime.error) || specialSessionAction !== 'idle';
  const canAllowCurrentSiteForSession = Boolean(
    specialSession.active
      && specialSession.source === 'manual'
      && specialSession.mode === SPECIAL_SESSION_MODES.ISOLATION
      && normalizedSiteDomain
      && !specialSession.temporaryAllowedHosts.includes(normalizedSiteDomain),
  );

  const applyProtectedSnapshot = ({
    domain,
    addedManagedSite = false,
    accessPatch = {},
    successMessageKey = 'popup.messages.protect_success',
    successMessageCode = 'protect_success',
  }) => {
    const nextManagedSiteCount = resolveManagedSiteCount(snapshot) + (addedManagedSite ? 1 : 0);
    const nextSnapshot = normalizePopupSiteSnapshot({
      ...snapshot,
      site: {
        ...snapshot.site,
        hostname: domain,
        pageUrl: snapshot.site.pageUrl || pageUrl,
        supported: true,
      },
      protection: {
        ...snapshot.protection,
        isProtected: true,
      },
      access: {
        ...(snapshot.access || {}),
        managedSiteCount: nextManagedSiteCount,
        ...accessPatch,
      },
    });
    setSnapshot(nextSnapshot);
    setMessage(t(successMessageKey, { hostname: domain }));
    setMessageCode(successMessageCode);
    setPermissionPromptState(null);
    pendingPermissionDomainRef.current = '';
    snapshotRefreshRef.current?.refresh();
  };

  const commitPendingPopupProtection = async ({
    domain,
    accessPatch = {},
    successMessageKey = 'popup.messages.protect_success',
    successMessageCode = 'protect_success',
  }) => {
    const commitResult = await runtimeSendMessageReliable(
      {
        action: MESSAGE_ACTIONS.POPUP_COMMIT_BLOCK_DOMAIN,
        domain,
      },
      { timeoutMs: 8000 },
    );

    if (!commitResult.ok || !commitResult.response?.success) {
      const errorCode = commitResult.response?.error || commitResult.error || 'POPUP_COMMIT_BLOCK_FAILED';
      if (errorCode === 'PERMISSION_MISSING') {
        await clearPendingPopupPermissionIntent(domain);
        setMessage(t('popup.messages.permission_required'));
        setMessageCode('permission_required');
      } else {
        await clearPendingPopupPermissionIntent(domain);
        showProtectionFailure(commitResult.response ? commitResult.response : errorCode, 'POPUP_COMMIT_BLOCK_FAILED');
      }
      setPermissionPromptState(null);
      return false;
    }

    if (commitResult.response.requiresDashboard) {
      await clearPendingPopupPermissionIntent(domain);
      setPermissionPromptState(null);
      const openedTab = await tabsCreate({ url: runtimeGetURL(buildSiteRegistrationPath({
        domain,
      })) });
      if (!openedTab) throw new Error('SITE_REGISTRATION_DASHBOARD_OPEN_FAILED');
      return false;
    }

    applyProtectedSnapshot({
      domain,
      addedManagedSite: !snapshot.protection.isProtected,
      accessPatch,
      successMessageKey,
      successMessageCode,
    });
    return true;
  };

  const showProtectionFailure = (source, fallback) => {
    const rejection = requireSiteRegistrationRejectionDetails(source);
    if (rejection !== null) {
      setMessage(t('popup.messages.registration_limit_reached', {
        limit: rejection.siteRegistrationBudget.limit,
        nextDay: rejection.nextIncreaseDay,
      }));
      setMessageCode('registration_limit_reached');
      return;
    }
    setMessage(formatPopupActionFailure(t, 'popup.messages.protect_error', source, fallback));
    setMessageCode('protect_error');
  };

  const clearPendingPopupPermissionIntent = async (domain) => {
    const normalized = normalizeDomain(domain);
    if (!normalized) return false;
    pendingPermissionDomainRef.current = '';
    try {
      await runtimeSendMessage({
        action: MESSAGE_ACTIONS.POPUP_CANCEL_BLOCK_DOMAIN,
        domain: normalized,
      });
      return true;
    } catch (error) {
      console.warn('[Popup] Failed to clear pending protection intent:', error);
      return false;
    }
  };

  const handleCancelPermissionPrompt = async () => {
    const domain = normalizeDomain(permissionPromptState?.domain);
    setPermissionPromptState(null);
    if (!domain) return;
    await clearPendingPopupPermissionIntent(domain);
  };

  const handleConfirmPermissionPrompt = async () => {
    const domain = normalizeDomain(permissionPromptState?.domain);
    if (!domain) {
      setPermissionPromptState(null);
      return;
    }

    setIsSaving(true);
    setMessage('');
    setMessageCode('idle');

    try {
      const granted = await ensureDomainEnforcementPermissionStrict(domain);
      if (!granted) {
        await clearPendingPopupPermissionIntent(domain);
        setPermissionPromptState(null);
        setMessage(t('popup.messages.permission_required'));
        setMessageCode('permission_required');
        return;
      }

      await commitPendingPopupProtection({ domain });
    } catch (error) {
      await clearPendingPopupPermissionIntent(domain);
      showProtectionFailure(error, 'POPUP_PERMISSION_CONFIRM_FAILED');
      setPermissionPromptState(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleProtectSite = async () => {
    const domain = normalizeDomain(snapshot.site.hostname || hostname);
    if (!domain || !snapshot.site.supported) {
      setMessage(t('popup.messages.page_unavailable'));
      setMessageCode('page_unavailable');
      return;
    }

    if (goalControlState.actionDisabled) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setMessageCode('idle');

    try {
      if (snapshot.access.requiresDashboardRegistration) {
        const openedTab = await tabsCreate({ url: registrationHref });
        if (!openedTab) throw new Error('SITE_REGISTRATION_DASHBOARD_OPEN_FAILED');
        return;
      }
      const queuedResult = await runtimeSendMessageReliable(
        {
          action: MESSAGE_ACTIONS.POPUP_QUEUE_BLOCK_DOMAIN,
          domain,
        },
        { timeoutMs: 8000 },
      );

      if (!queuedResult.ok || !queuedResult.response?.success) {
        const errorCode = queuedResult.response?.error || queuedResult.error || 'POPUP_QUEUE_BLOCK_FAILED';
        showProtectionFailure(queuedResult.response ? queuedResult.response : errorCode, 'POPUP_QUEUE_BLOCK_FAILED');
        return;
      }

      if (queuedResult.response.blocked) {
        applyProtectedSnapshot({
          domain,
          addedManagedSite: !snapshot.protection.isProtected,
        });
        return;
      }
      if (queuedResult.response.requiresDashboard) {
        const openedTab = await tabsCreate({ url: registrationHref });
        if (!openedTab) throw new Error('SITE_REGISTRATION_DASHBOARD_OPEN_FAILED');
        return;
      }
      pendingPermissionDomainRef.current = domain;
      setPermissionPromptState(buildPermissionPromptState({
        domain,
      }));
    } catch (error) {
      showProtectionFailure(error, 'POPUP_QUEUE_BLOCK_FAILED');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleIsolationPicker = () => {
    if (isSpecialSessionSaving || specialSession.active) return;
    setIsolationPickerOpen((open) => !open);
  };

  const handleCancelIsolationPicker = () => {
    setIsolationPickerOpen(false);
  };

  const handleConfirmStartIsolationSession = async (durationMinutes) => {
    if (isSpecialSessionSaving || specialSession.active) return;
    setSpecialSessionAction('start');
    setMessage('');
    setMessageCode('idle');

    try {
      await startSpecialSession({ durationMinutes });
      await scheduleRuntime.refresh();
      setMessage(t('popup.messages.special_session_started', { minutes: durationMinutes }));
      setMessageCode('special_session_started');
      setIsolationPickerOpen(false);
    } catch (error) {
      setMessage(formatPopupActionFailure(
        t,
        'popup.messages.special_session_error',
        error,
        'SPECIAL_SESSION_START_FAILED',
      ));
      setMessageCode('special_session_error');
    } finally {
      setSpecialSessionAction('idle');
    }
  };

  const handleEndSpecialSession = async () => {
    if (isSpecialSessionSaving || !specialSession.active) return;
    setSpecialSessionAction('end');
    setMessage('');
    setMessageCode('idle');

    try {
      if (specialSession.source === 'schedule') await endScheduleOccurrence(specialSession.id);
      else await endSpecialSession(specialSession.id);
      await scheduleRuntime.refresh();
      setMessage(t('popup.messages.special_session_ended'));
      setMessageCode('special_session_ended');
    } catch (error) {
      setMessage(formatPopupActionFailure(
        t,
        'popup.messages.special_session_end_error',
        error,
        'SPECIAL_SESSION_END_FAILED',
      ));
      setMessageCode('special_session_end_error');
    } finally {
      setSpecialSessionAction('idle');
    }
  };

  const handleAllowCurrentSiteForSession = async () => {
    if (isSpecialSessionSaving || !canAllowCurrentSiteForSession) return;
    setSpecialSessionAction('allow');
    setMessage('');
    setMessageCode('idle');

    try {
      await addSpecialSessionTemporaryAllowedSite(normalizedSiteDomain, specialSession.id);
      await scheduleRuntime.refresh();
      setMessage(t('popup.messages.special_session_site_allowed', {
        hostname: normalizedSiteDomain,
      }));
      setMessageCode('special_session_site_allowed');
    } catch (error) {
      setMessage(formatPopupActionFailure(
        t,
        'popup.messages.special_session_site_allow_error',
        error,
        'SPECIAL_SESSION_SITE_ALLOW_FAILED',
      ));
      setMessageCode('special_session_site_allow_error');
    } finally {
      setSpecialSessionAction('idle');
    }
  };

  return {
    canAllowCurrentSiteForSession,
    contextDomain: normalizedSiteDomain,
    dashboardHref,
    displayDomain,
    handleAllowCurrentSiteForSession,
    handleCancelIsolationPicker,
    handleConfirmStartIsolationSession,
    handleEndSpecialSession,
    handleProtectSite,
    handleToggleIsolationPicker,
    isolationPickerOpen,
    isReady,
    isSaving,
    isSpecialSessionSaving,
    isSupported,
    mediaSupport,
    goalControlState,
    message: snapshotError || (scheduleRuntime.error ? formatPopupActionFailure(t, 'popup.messages.special_session_load_error', scheduleRuntime.error, 'SCHEDULE_RUNTIME_LOAD_FAILED') : message),
    messageCode: snapshotError ? 'load_error' : scheduleRuntime.error ? 'special_session_load_error' : messageCode,
    permissionPromptState,
    pageUrl: resolvedPageUrl,
    handleCancelPermissionPrompt,
    handleConfirmPermissionPrompt,
    snapshot,
    sitesHref,
    specialSession,
    specialSessionAction,
    statusMeta,
    todayMs,
    weeklyAverageDailyMs,
    shareOfTracked,
  };
}
