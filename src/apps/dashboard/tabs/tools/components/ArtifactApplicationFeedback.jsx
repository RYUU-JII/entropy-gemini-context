import React, { useEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useDashboardGuidance } from '@/apps/dashboard/guidance/DashboardGuidanceProvider.jsx';

export default function ArtifactApplicationFeedback({ status, handlers }) {
  const { t } = useAppTranslation('tools');
  const guidance = useDashboardGuidance();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const action = status.action;
  const actionLabels = {
    sites: t('artifact_altar.application.actions.sites'),
    permissions: t('artifact_altar.application.actions.permissions'),
    retry_permissions: t('artifact_altar.application.actions.retry_permissions'),
    retry_runtime: t('artifact_altar.application.actions.retry_runtime'),
    tab_groups: t('artifact_altar.application.actions.tab_groups'),
  };
  const requestOwner = useRef({ action, pending: false, generation: 0 });
  if (requestOwner.current.action !== action) {
    requestOwner.current = { action, pending: false, generation: requestOwner.current.generation + 1 };
  }
  useEffect(() => {
    setBusy(false);
    setError(null);
    return () => { requestOwner.current.generation += 1; };
  }, [action]);
  const activate = async () => {
    if (requestOwner.current.pending) return;
    setError(null);
    if (action === 'sites' || action === 'permissions') {
      guidance.navigate(action === 'sites' ? 'sites' : 'settings', action === 'sites' ? undefined : { section: 'permissions' });
      return;
    }
    const generation = ++requestOwner.current.generation;
    requestOwner.current.pending = true;
    setBusy(true);
    try {
      let result;
      if (action === 'retry_permissions') result = await handlers.refreshArtifactCapabilityState();
      else if (action === 'retry_runtime') result = await handlers.refreshArtifactRuntimeSnapshot();
      else if (action === 'tab_groups') result = await handlers.tabManagement.toggle(true);
      else throw new Error('ARTIFACT_APPLICATION_ACTION_INVALID');
      if (result?.error || result?.ok === false) {
        throw result.error || new Error(result.reason || 'ARTIFACT_APPLICATION_ACTION_FAILED');
      }
    } catch (cause) {
      if (requestOwner.current.generation === generation) {
        const detail = cause?.code || cause?.message || String(cause);
        setError(detail.replace(/\bhttps?:\/\/[^\s)]+/gi, '[redacted-url]'));
      }
    } finally {
      if (requestOwner.current.generation === generation) {
        requestOwner.current.pending = false;
        setBusy(false);
      }
    }
  };
  return <>
    <span>{status.detail}</span>{' '}
    <button type="button" disabled={busy} aria-busy={busy} onClick={activate}
      className="text-accent underline underline-offset-4 disabled:opacity-50">
      {busy ? t('artifact_altar.application.actions.pending') : actionLabels[action]}
    </button>
    {error ? <span role="alert" className="ml-2 break-all text-danger">{error}</span> : null}
  </>;
}
