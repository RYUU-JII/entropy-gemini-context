import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProtocolStore } from '../stores/useProtocolStore.js';
import { useAppTranslation } from '../../../ui-kit/hooks/useAppTranslation.js';
import { INSIGHTS_CONSENT } from '../../../domains/settings/config/insightsMode.js';
import { requireProtocolSyncSuccess } from '../stores/protocolStoreHelpers.js';
import DashboardSetupCanvas from '../components/DashboardSetupCanvas.jsx';
import { DashboardFirstUseContext } from './DashboardFirstUseContext.jsx';
import DashboardBootRecoverySurface from './DashboardBootRecoverySurface.jsx';

// Protocol readiness precedes Main. An UNSET choice remains fail-closed in the
// collection owner, while Main presents the first useful action in its own flow.
export default function DashboardSetupAdmission({ children }) {
  const { t } = useAppTranslation('dashboard');
  const protocol = useProtocolStore(useShallow((state) => ({
    loaded: state.loaded, insightsConsent: state.insightsConsent,
    initialize: state.initialize, subscribe: state.subscribeExternalProtocolSettings,
    commit: state.completeFirstUseWithoutRecording,
  })));
  const [readFailure, setReadFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const submitting = useRef(false);
  const active = useRef(true);
  const initialize = async () => {
    setReadFailure('');
    try { await protocol.initialize(); }
    catch (error) {
      if (active.current) setReadFailure(error instanceof Error ? error.message : 'DASHBOARD_SETUP_PROTOCOL_READ_FAILED');
    }
  };
  useEffect(() => {
    active.current = true;
    const unsubscribe = protocol.subscribe();
    void initialize();
    return () => { active.current = false; unsubscribe(); };
  }, [protocol.initialize, protocol.subscribe]);
  const browseWithoutRecording = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setStatus('');
    try {
      if (!active.current) return;
      // Conditional UNSET admission and all five policy keys belong to one
      // background mutation. No policy is projected before its canonical ACK.
      requireProtocolSyncSuccess(await protocol.commit());
    } catch (error) {
      if (active.current) setStatus(error instanceof Error && error.message.trim()
        ? error.message : t('main.insights_consent.apply_failed'));
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  };
  if (!protocol.loaded && !readFailure) return <DashboardBootRecoverySurface />;
  if (readFailure) return (
    <DashboardSetupCanvas title={t('main.insights_consent.title')}>
        <p role="alert" className="text-sm leading-6">{readFailure}</p>
        <button type="button" onClick={initialize} className="mt-5 min-h-11 border border-border px-4 py-2 text-sm">
          {t('main.insights_consent.retry_choices')}
        </button>
    </DashboardSetupCanvas>
  );
  return <DashboardFirstUseContext.Provider value={{
    required: protocol.insightsConsent === INSIGHTS_CONSENT.UNSET || busy,
    busy, status, browseWithoutRecording,
  }}>{children}</DashboardFirstUseContext.Provider>;
}
