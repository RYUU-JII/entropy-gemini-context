import React, { useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { runtimeSendMessage } from '../../../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../../../platform/messaging/messageTypes.js';
import { localUsagePolicyRequiresPrecisionPermission } from '../../../../../domains/settings/config/localUsagePolicy.js';
import {
  SettingsActionButton, SettingsDisclosure, SettingsFeedback,
  SettingsLedger, SettingsRow, SettingsStatus,
} from './SettingsControlPrimitives.jsx';
import { FlowHistoryControls, UsageScopeControl } from './UsageRecordingControls.jsx';

function requirePermissionHandler(handler, code) {
  if (typeof handler !== 'function') throw new Error(code);
  return handler;
}

function StoredDataDetails() {
  const { t } = useAppTranslation('settings');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pendingRef = useRef(false);
  const exportRecords = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const response = await runtimeSendMessage({ action: MESSAGE_ACTIONS.GET_PRECISION_RAW_DATA, daysBack: 14 });
      if (!response?.success || !response.rawData || typeof response.rawData !== 'object' || Array.isArray(response.rawData)) {
        const reason = typeof response?.error === 'string' ? response.error : response?.error?.message;
        throw new Error(reason || 'PRECISION_RAW_DATA_RESULT_INVALID');
      }
      const preview = JSON.stringify(response.rawData, null, 2);
      const url = URL.createObjectURL(new Blob([preview], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'entropy-flow-records-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  };
  return (
    <SettingsDisclosure title={t('recording.data_details')}>
      <SettingsRow title={t('recording.runtime_title')} description={t('recording.runtime_desc')} />
      <SettingsRow title={t('recording.stored_title')} description={t('recording.stored_desc')}>
        <SettingsActionButton disabled={loading} onClick={exportRecords}>
          {t(loading ? 'precision_beta.raw_loading' : 'recording.export_history')}
        </SettingsActionButton>
      </SettingsRow>
      <SettingsFeedback message={error ? t('precision_beta.raw_error', { message: error }) : ''} tone="danger" />
    </SettingsDisclosure>
  );
}

function ExcludedSites({ domains, onRestore, disabled, revealRequest }) {
  const { t } = useAppTranslation('settings');
  const restore = requirePermissionHandler(onRestore, 'PERMISSION_GATE_RESTORE_DOMAIN_HANDLER_REQUIRED');
  const [pendingDomain, setPendingDomain] = useState(null);
  const [error, setError] = useState('');
  const pendingRef = useRef(false);
  const summaryRef = useRef(null);
  const restoreDomain = async (domain) => {
    if (pendingRef.current || disabled) return;
    pendingRef.current = true;
    setPendingDomain(domain);
    setError('');
    try {
      if (await restore(domain) !== true) throw new Error('SETTINGS_TRACKING_DOMAIN_RESTORE_FAILED');
      summaryRef.current?.focus({ preventScroll: true });
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : String(failure);
      setError(`${t('recording.excluded_restore_failed')} ${detail}`);
    } finally {
      pendingRef.current = false;
      setPendingDomain(null);
    }
  };
  return (
    <SettingsDisclosure title={t('settings_permissions.analysis.excluded_title')}
      summary={t('recording.excluded_count', { count: domains.length })}
      revealRequest={revealRequest} summaryRef={summaryRef}>
      <p className="pb-2 text-xs leading-relaxed text-on-surface-muted">{t('settings_permissions.analysis.excluded_desc', { count: domains.length })}</p>
      {domains.length === 0 ? <SettingsRow title={t('recording.excluded_empty')} /> : null}
      {domains.map((domain) => (
        <SettingsRow key={domain} title={domain}>
          <SettingsActionButton disabled={disabled || pendingDomain !== null}
            aria-label={`${domain}: ${t('settings_permissions.analysis.excluded_restore')}`}
            onClick={() => restoreDomain(domain)}>
            {t('settings_permissions.analysis.excluded_restore')}
          </SettingsActionButton>
        </SettingsRow>
      ))}
      <SettingsFeedback message={error} tone="danger" />
    </SettingsDisclosure>
  );
}

export function PermissionGate({
  permissionState, dataCollectionMode, precisionInsightsMode, precisionInsightsSignals,
  insightsConsent, precisionInsightsReady, trackingExcludedUrls,
  onUsagePolicyChange, onRestoreTrackedDomain, onGrantManagedSiteAccess,
  excludedSitesRevealRequest = null,
  managedSiteCount, missingSiteCount, busy = false, statusMessage = '',
}) {
  const { t } = useAppTranslation('settings');
  const change = requirePermissionHandler(onUsagePolicyChange, 'PERMISSION_GATE_USAGE_POLICY_HANDLER_REQUIRED');
  const policy = { dataCollectionMode, precisionInsightsMode, precisionInsightsSignals };
  const historyRequested = localUsagePolicyRequiresPrecisionPermission({ ...policy, insightsConsent });
  const signalCount = Object.values(precisionInsightsSignals).filter(Boolean).length;
  const needsAccess = managedSiteCount > 0 && (!permissionState.scripting || missingSiteCount > 0);
  const grant = needsAccess
    ? requirePermissionHandler(onGrantManagedSiteAccess, 'PERMISSION_GATE_MANAGED_SITE_ACCESS_HANDLER_REQUIRED')
    : null;
  const historySummary = !historyRequested ? t('recording.flow_not_recorded')
    : !precisionInsightsReady ? t('recording.permission_needed')
      : t('recording.flow_allowed_count', { count: signalCount });
  return (
    <SettingsLedger>
      <UsageScopeControl value={dataCollectionMode} disabled={busy}
        onChange={(nextMode) => change({ ...policy, dataCollectionMode: nextMode })} />
      <SettingsDisclosure title={t('recording.flow_details')} summary={historySummary}>
        <p className="pb-3 text-xs leading-relaxed text-on-surface-muted">{t('recording.flow_intro')}</p>
        <FlowHistoryControls policy={policy} onChange={change} disabled={busy} />
        {historyRequested && !precisionInsightsReady ? (
          <SettingsRow title={t('recording.permission_needed')} description={t('recording.permission_desc')}>
            <SettingsActionButton disabled={busy} onClick={() => change(policy)}>{t('recording.permission_connect')}</SettingsActionButton>
          </SettingsRow>
        ) : null}
      </SettingsDisclosure>
      <SettingsFeedback message={statusMessage} tone="danger" />
      <SettingsRow title={t('recording.site_access')}
        description={t(managedSiteCount === 0 ? 'recording.site_access_empty' : 'recording.site_access_desc')}>
        {needsAccess ? (
          <SettingsActionButton onClick={grant} disabled={busy}>
            {missingSiteCount > 0 ? t('settings_permissions.access.fix_missing_cta', { count: missingSiteCount }) : t('settings_permissions.access.connect_cta')}
          </SettingsActionButton>
        ) : (
          <SettingsStatus>{t(managedSiteCount > 0 ? 'recording.access_connected' : 'recording.access_on_demand')}</SettingsStatus>
        )}
      </SettingsRow>
      <ExcludedSites domains={trackingExcludedUrls} onRestore={onRestoreTrackedDomain}
        disabled={busy} revealRequest={excludedSitesRevealRequest} />
      <StoredDataDetails />
    </SettingsLedger>
  );
}

export default PermissionGate;
